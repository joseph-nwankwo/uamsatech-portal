import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "crypto";
import { state, resetState, iso, lockStats, type Inv } from "./helpers/fake-billing-db";

// AS-P0-SECURITY-004/005 — Paystack / Flutterwave one-time payments:
// paid-through persistence, carry-forward renewal, amount verification,
// idempotency, concurrency, out-of-order delivery, audit.

const PAYSTACK_KEY = "sk_test_paystack_secret_for_unit_tests_only";
const FLW_HASH = "flw-webhook-hash-for-unit-tests";

vi.mock("@/lib/env", () => ({
  env: {
    PAYSTACK_SECRET_KEY: "sk_test_paystack_secret_for_unit_tests_only",
    FLUTTERWAVE_SECRET_KEY: "FLWSECK_TEST-unit-tests-only",
    FLUTTERWAVE_WEBHOOK_SECRET: "flw-webhook-hash-for-unit-tests",
  },
}));
vi.mock("@/lib/auth/rate-limit", () => ({
  checkRateLimit: async () => ({ allowed: true }),
  requestIp: () => "203.0.113.1",
}));
vi.mock("@/lib/analytics/track", () => ({ trackEvent: async () => undefined }));
const logs: { level: string; msg: string; ctx?: Record<string, unknown> }[] = [];
vi.mock("@/lib/logger", () => ({
  logger: {
    info: (msg: string, ctx?: Record<string, unknown>) => logs.push({ level: "info", msg, ctx }),
    warn: (msg: string, ctx?: Record<string, unknown>) => logs.push({ level: "warn", msg, ctx }),
    error: (msg: string, ctx?: Record<string, unknown>) => logs.push({ level: "error", msg, ctx }),
    debug: () => undefined,
  },
}));
vi.mock("@/lib/db", async () => ({ db: (await import("./helpers/fake-billing-db")).client }));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const paystack = await import("@/app/api/billing/paystack/webhook/route");
const flutterwave = await import("@/app/api/billing/flutterwave/webhook/route");
const { evaluateSubscription } = await import("@/lib/portal/entitlement");

beforeEach(() => {
  resetState();
  logs.length = 0;
  fetchMock.mockReset();
});

const META = { billTo: "organization", organizationId: "org-1", productId: "prod-scholar", productPlanId: "plan-monthly" };
const sub = () => state.subs.find((s) => s.organizationId === "org-1" && s.productId === "prod-scholar");
const invoicesByPaidAt = () => [...state.invoices].sort((a, b) => a.paidAt!.getTime() - b.paidAt!.getTime());
const slots = () => invoicesByPaidAt().map((i) => `${iso(i.periodStart)} → ${iso(i.periodEnd)}`);
const contiguous = (list: Inv[]) =>
  list.every((inv, k) => k === 0 || list[k - 1].periodEnd.getTime() <= inv.periodStart.getTime());

// ── Paystack helpers ─────────────────────────────────────────────────────────
function psEvent(over: Record<string, unknown> = {}, meta: Record<string, unknown> = META, event = "charge.success") {
  return {
    event,
    data: {
      status: "success", reference: "psk_ref_1", amount: 150000, currency: "NGN",
      paid_at: "2026-09-20T09:00:00.000Z", customer: { customer_code: "CUS_x" }, metadata: meta, ...over,
    },
  };
}
function psPost(body: unknown, signature?: string) {
  const raw = JSON.stringify(body);
  const sig = signature ?? createHmac("sha512", PAYSTACK_KEY).update(raw).digest("hex");
  return paystack.POST(new Request("https://portal.test/api/billing/paystack/webhook", {
    method: "POST", body: raw, headers: { "x-paystack-signature": sig },
  }));
}
const psVerify = (data: Record<string, unknown>, ok = true) =>
  ({ ok, status: ok ? 200 : 500, json: async () => ({ status: true, data }) });

// ── Flutterwave helpers ──────────────────────────────────────────────────────
function flwPost(body: unknown, hash = FLW_HASH) {
  return flutterwave.POST(new Request("https://portal.test/api/billing/flutterwave/webhook", {
    method: "POST", body: JSON.stringify(body), headers: { "verif-hash": hash },
  }));
}
function flwVerified(over: Record<string, unknown> = {}, meta: Record<string, unknown> = META) {
  return {
    ok: true, status: 200,
    json: async () => ({
      status: "success",
      data: {
        id: 4242, tx_ref: "flw_ref_1", status: "successful", amount: 1500, currency: "NGN",
        created_at: "2026-09-20T09:00:00.000Z", customer: { email: "payer@example.com" }, meta, ...over,
      },
    }),
  };
}
const flwEvent = (id: unknown = 4242, event = "charge.completed") => ({ event, data: { id, status: "successful" } });

// ═════════════════════════════════════════════════════════════════════════════
describe("Paystack — paid-through date, renewal and carry-forward", () => {
  it("rejects an invalid signature with 400 and writes nothing", async () => {
    expect((await psPost(psEvent(), "00".repeat(64))).status).toBe(400);
    expect(state.subs).toHaveLength(0);
    expect(state.invoices).toHaveLength(0);
  });

  it("initial payment: period = provider paid_at + one plan month; audited as new_period", async () => {
    expect((await psPost(psEvent())).status).toBe(200);
    expect(sub()).toMatchObject({ status: "ACTIVE", provider: "PAYSTACK", providerSubscriptionId: "psk_ref_1" });
    expect(iso(sub()!.currentPeriodEnd)).toBe("2026-10-20T09:00:00.000Z");
    expect(slots()).toEqual(["2026-09-20T09:00:00.000Z → 2026-10-20T09:00:00.000Z"]);
    expect(state.audit.at(-1)).toMatchObject({
      action: "billing.entitlement_extended", organizationId: "org-1",
      metadata: { mode: "new_period", previousCurrentPeriodEnd: null, currentPeriodEnd: "2026-10-20T09:00:00.000Z" },
    });
  });

  it("yearly plan: twelve calendar months, priced at the yearly plan's own price", async () => {
    await psPost(psEvent({ amount: 1500000 }, { ...META, productPlanId: "plan-yearly" }));
    expect(iso(sub()!.currentPeriodEnd)).toBe("2027-09-20T09:00:00.000Z");
  });

  it("early renewal carries forward: the new period starts at the existing paid-through date", async () => {
    await psPost(psEvent());
    await psPost(psEvent({ reference: "psk_ref_2", paid_at: "2026-10-10T08:00:00.000Z" }));
    expect(iso(sub()!.currentPeriodEnd)).toBe("2026-11-20T09:00:00.000Z");
    expect(slots()).toEqual([
      "2026-09-20T09:00:00.000Z → 2026-10-20T09:00:00.000Z",
      "2026-10-20T09:00:00.000Z → 2026-11-20T09:00:00.000Z",
    ]);
    expect(state.audit.at(-1)!.metadata).toMatchObject({ mode: "carried_forward", previousCurrentPeriodEnd: "2026-10-20T09:00:00.000Z" });
  });

  it("renewal after expiry starts a fresh period at the verified payment time", async () => {
    await psPost(psEvent({ paid_at: "2026-08-01T00:00:00.000Z" }));
    await psPost(psEvent({ reference: "psk_ref_2", paid_at: "2026-10-05T12:00:00.000Z" }));
    expect(iso(sub()!.currentPeriodEnd)).toBe("2026-11-05T12:00:00.000Z");
    expect(state.audit.at(-1)!.metadata).toMatchObject({ mode: "new_period" });
  });

  it("carry-forward across intervals: monthly then yearly early renewal", async () => {
    await psPost(psEvent());
    await psPost(psEvent({ reference: "psk_ref_2", paid_at: "2026-10-01T00:00:00.000Z", amount: 1500000 }, { ...META, productPlanId: "plan-yearly" }));
    expect(iso(sub()!.currentPeriodEnd)).toBe("2027-10-20T09:00:00.000Z");
    expect(sub()!.productPlanId).toBe("plan-yearly");
  });

  it("duplicate delivery is idempotent: one invoice, one extension, coupon counted once", async () => {
    state.coupons.push({ id: "cpn-1", code: "C1", discountType: "PERCENT", discountValue: 20, currency: null, maxRedemptions: null, timesRedeemed: 0, validFrom: new Date(0), validUntil: null, stripeCouponId: null, paystackCouponId: null, isActive: true, createdAt: new Date(0) });
    const ev = psEvent({ amount: 120000 }, { ...META, couponId: "cpn-1" });
    await psPost(ev);
    await psPost(ev);
    expect(state.invoices).toHaveLength(1);
    expect(iso(sub()!.currentPeriodEnd)).toBe("2026-10-20T09:00:00.000Z");
    expect(state.coupons[0].timesRedeemed).toBe(1);
    expect(logs.some((l) => l.ctx?.outcome === "duplicate")).toBe(true);
  });

  it("concurrent duplicate (unique violation after commit) is a duplicate, not an error", async () => {
    await psPost(psEvent());
    state.hideInvoiceOnce = true;
    expect((await psPost(psEvent())).status).toBe(200);
    expect(state.invoices).toHaveLength(1);
  });

  it("D7 (007B): the same reference from ANOTHER provider is not a duplicate; idempotency is provider-scoped", async () => {
    state.invoices.push({
      id: "inv_flw_hist", providerInvoiceId: "psk_ref_1", subscriptionId: "sub-other", provider: "FLUTTERWAVE",
      periodStart: new Date("2026-01-01T00:00:00.000Z"), periodEnd: new Date("2026-02-01T00:00:00.000Z"),
      paidAt: new Date("2026-01-01T00:00:00.000Z"), amountCents: 150000, currency: "NGN", status: "PAID",
      organizationId: "org-2", userId: null,
    });
    expect((await psPost(psEvent())).status).toBe(200);
    expect(state.invoices).toHaveLength(2);
    expect(state.invoices.find((i) => i.id === "inv_flw_hist")).toMatchObject({ provider: "FLUTTERWAVE", providerInvoiceId: "psk_ref_1" });
    expect(state.invoices.filter((i) => i.provider === "PAYSTACK" && i.providerInvoiceId === "psk_ref_1")).toHaveLength(1);
    expect(iso(sub()!.currentPeriodEnd)).toBe("2026-10-20T09:00:00.000Z");
    // …while a second Paystack delivery of that reference is still a duplicate.
    await psPost(psEvent());
    expect(state.invoices).toHaveLength(2);
  });

  it("two different payments processed concurrently BOTH count (row lock serialises them)", async () => {
    await psPost(psEvent()); // establishes the subscription, paid to 2026-10-20
    const before = lockStats.acquired;
    await Promise.all([
      psPost(psEvent({ reference: "psk_b", paid_at: "2026-10-01T00:00:00.000Z" })),
      psPost(psEvent({ reference: "psk_c", paid_at: "2026-10-02T00:00:00.000Z" })),
    ]);
    expect(lockStats.acquired - before).toBe(2);
    expect(iso(sub()!.currentPeriodEnd)).toBe("2026-12-20T09:00:00.000Z");
    expect(state.invoices).toHaveLength(3);
    expect(contiguous(invoicesByPaidAt())).toBe(true);
  });

  it("out-of-order delivery gives the same result as in-order delivery (chain re-slotted)", async () => {
    await psPost(psEvent({ reference: "psk_a" }));
    await psPost(psEvent({ reference: "psk_b", paid_at: "2026-10-10T08:00:00.000Z", amount: 1500000 }, { ...META, productPlanId: "plan-yearly" }));
    const inOrder = { end: iso(sub()!.currentPeriodEnd), slots: slots() };

    resetState();
    await psPost(psEvent({ reference: "psk_b", paid_at: "2026-10-10T08:00:00.000Z", amount: 1500000 }, { ...META, productPlanId: "plan-yearly" }));
    await psPost(psEvent({ reference: "psk_a" }));
    expect({ end: iso(sub()!.currentPeriodEnd), slots: slots() }).toEqual(inOrder);
    expect(inOrder.end).toBe("2027-10-20T09:00:00.000Z");
    expect(sub()!.productPlanId).toBe("plan-yearly"); // plan follows the newest payment
    expect(state.audit.at(-1)!.metadata).toMatchObject({ mode: "recomputed", reslotted: 1 });
  });

  it("a late older payment never shortens the subscription", async () => {
    await psPost(psEvent({ reference: "psk_new", paid_at: "2026-10-30T00:00:00.000Z" }));
    const end = sub()!.currentPeriodEnd!.getTime();
    await psPost(psEvent({ reference: "psk_old", paid_at: "2026-09-01T00:00:00.000Z" }));
    expect(sub()!.currentPeriodEnd!.getTime()).toBeGreaterThanOrEqual(end);
  });

  it("out-of-order onto a chain it cannot rebuild exactly → no extension, flagged for manual review", async () => {
    await psPost(psEvent({ reference: "psk_x", paid_at: "2026-10-01T00:00:00.000Z" }));
    const inv = state.invoices[0]; // simulate a legacy invoice with a non-interval period
    inv.periodStart = new Date("2026-10-01T00:00:00.000Z"); inv.periodEnd = new Date("2026-10-31T00:00:00.000Z");
    const end = iso(sub()!.currentPeriodEnd);
    await psPost(psEvent({ reference: "psk_old", paid_at: "2026-09-15T00:00:00.000Z" }));
    expect(iso(sub()!.currentPeriodEnd)).toBe(end);
    expect(state.invoices).toHaveLength(2);
    expect(state.audit.at(-1)).toMatchObject({ action: "billing.renewal_needs_review", metadata: { mode: "needs_review" } });
  });

  it("entitlement: granted 1 ms before the paid-through date, denied at it and after", async () => {
    await psPost(psEvent());
    const s = sub()! as unknown as Parameters<typeof evaluateSubscription>[0];
    const end = sub()!.currentPeriodEnd!.getTime();
    expect(evaluateSubscription(s, new Date(end - 1))).toEqual({ ok: true });
    expect(evaluateSubscription(s, new Date(end))).toEqual({ ok: false, reason: "expired" });
    expect(evaluateSubscription(s, new Date(end + 864e5))).toEqual({ ok: false, reason: "expired" });
  });
});

describe("Paystack — payment amount, currency, plan and payer verification", () => {
  it.each([
    ["monthly price paid for the yearly plan", { amount: 150000 }, { productPlanId: "plan-yearly" }, "amount_mismatch"],
    ["underpayment", { amount: 149999 }, {}, "amount_mismatch"],
    ["overpayment", { amount: 150001 }, {}, "amount_mismatch"],
    ["currency mismatch (USD paid, plan in NGN)", { currency: "USD" }, {}, "currency_mismatch"],
    ["plan belongs to another product", { amount: 90000 }, { productPlanId: "plan-lecture" }, "plan_product_mismatch"],
    ["unknown plan", {}, { productPlanId: "plan-nope" }, "plan_not_found"],
    ["payer organization does not exist", {}, { organizationId: "org-ghost" }, "attribution_not_found"],
    ["coupon referenced but not found", { amount: 120000 }, { couponId: "cpn-ghost" }, "coupon_not_found"],
  ])("%s → rejected, nothing granted, rejection audited", async (_l, over, metaOver, reason) => {
    expect((await psPost(psEvent(over, { ...META, ...metaOver }))).status).toBe(200);
    expect(state.subs).toHaveLength(0);
    expect(state.invoices).toHaveLength(0);
    expect(state.audit.at(-1)).toMatchObject({ action: "billing.payment_rejected", metadata: { reason } });
  });

  it("each plan is checked against its own price and currency (a USD plan in USD is accepted)", async () => {
    await psPost(psEvent({ amount: 1500, currency: "USD" }, { ...META, productPlanId: "plan-usd" }));
    expect(sub()).toBeTruthy();
    expect(state.invoices[0]).toMatchObject({ amountCents: 1500, currency: "USD" });
  });

  it("legitimate coupons are honoured: 20% off and a fixed amount off", async () => {
    state.coupons.push(
      { id: "pct", code: "P", discountType: "PERCENT", discountValue: 20, currency: null, maxRedemptions: null, timesRedeemed: 0, validFrom: new Date(0), validUntil: null, stripeCouponId: null, paystackCouponId: null, isActive: true, createdAt: new Date(0) },
      { id: "fix", code: "F", discountType: "FIXED", discountValue: 50000, currency: "NGN", maxRedemptions: null, timesRedeemed: 0, validFrom: new Date(0), validUntil: null, stripeCouponId: null, paystackCouponId: null, isActive: true, createdAt: new Date(0) },
    );
    await psPost(psEvent({ amount: 120000 }, { ...META, couponId: "pct" }));
    await psPost(psEvent({ reference: "psk_2", amount: 100000, paid_at: "2026-10-01T00:00:00.000Z" }, { ...META, couponId: "fix" }));
    expect(state.invoices).toHaveLength(2);
  });

  it("a coupon does not excuse an amount that does not match the discounted price", async () => {
    state.coupons.push({ id: "pct", code: "P", discountType: "PERCENT", discountValue: 20, currency: null, maxRedemptions: null, timesRedeemed: 0, validFrom: new Date(0), validUntil: null, stripeCouponId: null, paystackCouponId: null, isActive: true, createdAt: new Date(0) });
    await psPost(psEvent({ amount: 100000 }, { ...META, couponId: "pct" }));
    expect(state.subs).toHaveLength(0);
  });
});

describe("Paystack — failures, missing data, provider lookup, database failure", () => {
  it("a charge.success whose status is not 'success' grants nothing", async () => {
    await psPost(psEvent({ status: "failed" }));
    expect(state.subs).toHaveLength(0);
  });

  it.each(["charge.failed", "refund.processed", "refund.pending", "charge.dispute.create", "charge.dispute.resolve", "subscription.disable"])(
    "%s never creates or extends access",
    async (event) => {
      await psPost(psEvent());
      const before = iso(sub()!.currentPeriodEnd);
      await psPost(psEvent({ reference: "psk_other", paid_at: "2026-10-30T00:00:00.000Z" }, META, event));
      expect(iso(sub()!.currentPeriodEnd)).toBe(before);
      expect(state.invoices).toHaveLength(1);
    }
  );

  it("missing paid_at → authenticated verify API, which must agree on reference, amount and currency", async () => {
    fetchMock.mockResolvedValue(psVerify({ status: "success", reference: "psk_ref_1", amount: 150000, currency: "NGN", paid_at: "2026-09-25T10:00:00.000Z" }));
    await psPost(psEvent({ paid_at: undefined }));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.paystack.co/transaction/verify/psk_ref_1");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${PAYSTACK_KEY}`);
    expect(iso(sub()!.currentPeriodEnd)).toBe("2026-10-25T10:00:00.000Z");
  });

  it("a future-dated paid_at is not trusted; the verified provider time is used", async () => {
    fetchMock.mockResolvedValue(psVerify({ status: "success", reference: "psk_ref_1", amount: 150000, currency: "NGN", paid_at: "2026-09-25T10:00:00.000Z" }));
    await psPost(psEvent({ paid_at: new Date(Date.now() + 10 * 864e5).toISOString() }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(iso(sub()!.currentPeriodEnd)).toBe("2026-10-25T10:00:00.000Z");
  });

  it.each([
    ["amount differs", { amount: 1 }],
    ["currency differs", { currency: "USD" }],
    ["reference differs", { reference: "psk_other" }],
    ["status not success", { status: "abandoned" }],
    ["no paid_at either", { paid_at: null }],
  ])("missing paid_at and the verify API %s → no date invented, nothing written", async (_l, over) => {
    fetchMock.mockResolvedValue(psVerify({ status: "success", reference: "psk_ref_1", amount: 150000, currency: "NGN", paid_at: "2026-09-25T10:00:00.000Z", ...over }));
    expect((await psPost(psEvent({ paid_at: "not-a-date" }))).status).toBe(200);
    expect(state.subs).toHaveLength(0);
    expect(logs.some((l) => l.level === "error" && l.msg === "billing.paid_at_unavailable")).toBe(true);
  });

  it("verify API unreachable → fails (Paystack retries), nothing written", async () => {
    fetchMock.mockResolvedValue(psVerify({}, false));
    await expect(psPost(psEvent({ paid_at: undefined }))).rejects.toThrow(/Paystack verify failed/);
    expect(state.subs).toHaveLength(0);
  });

  it("unattributed payment (no metadata) → nothing written", async () => {
    await psPost(psEvent({}, {}));
    expect(state.subs).toHaveLength(0);
  });

  it("database failure mid-transaction → nothing half-applied (subscription, invoice, audit); retry succeeds", async () => {
    state.failInvoiceCreate = true;
    await expect(psPost(psEvent())).rejects.toThrow(/connection terminated/);
    expect(state.subs).toHaveLength(0);
    expect(state.invoices).toHaveLength(0);
    expect(state.audit).toHaveLength(0);
    state.failInvoiceCreate = false;
    await psPost(psEvent());
    expect(iso(sub()!.currentPeriodEnd)).toBe("2026-10-20T09:00:00.000Z");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe("Flutterwave — paid-through date, renewal, verification", () => {
  it("rejects an invalid verif-hash with 400, never calls the provider", async () => {
    expect((await flwPost(flwEvent(), "wrong-hash")).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(state.subs).toHaveLength(0);
  });

  it("initial payment: re-verifies via the API; period = created_at + plan month", async () => {
    fetchMock.mockResolvedValue(flwVerified());
    expect((await flwPost(flwEvent())).status).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.flutterwave.com/v3/transactions/4242/verify");
    expect(iso(sub()!.currentPeriodEnd)).toBe("2026-10-20T09:00:00.000Z");
    expect(state.invoices[0]).toMatchObject({ amountCents: 150000, currency: "NGN" });
  });

  it("early renewal carries forward; duplicate delivery is idempotent", async () => {
    fetchMock.mockResolvedValue(flwVerified());
    await flwPost(flwEvent());
    await flwPost(flwEvent());
    expect(state.invoices).toHaveLength(1);
    fetchMock.mockResolvedValue(flwVerified({ id: 4343, tx_ref: "flw_ref_2", created_at: "2026-10-10T10:00:00.000Z" }));
    await flwPost(flwEvent(4343));
    expect(iso(sub()!.currentPeriodEnd)).toBe("2026-11-20T09:00:00.000Z");
    expect(contiguous(invoicesByPaidAt())).toBe(true);
  });

  it("renewal after expiry starts at the verified payment time", async () => {
    fetchMock.mockResolvedValue(flwVerified({ created_at: "2026-08-01T00:00:00.000Z" }));
    await flwPost(flwEvent());
    fetchMock.mockResolvedValue(flwVerified({ id: 5, tx_ref: "flw_2", created_at: "2026-10-05T12:00:00.000Z" }));
    await flwPost(flwEvent(5));
    expect(iso(sub()!.currentPeriodEnd)).toBe("2026-11-05T12:00:00.000Z");
  });

  it("out-of-order delivery matches in-order delivery", async () => {
    const a = () => flwVerified({ id: 1, tx_ref: "flw_a", created_at: "2026-09-20T09:00:00.000Z" });
    const b = () => flwVerified({ id: 2, tx_ref: "flw_b", created_at: "2026-10-10T08:00:00.000Z" });
    fetchMock.mockResolvedValueOnce(a()).mockResolvedValueOnce(b());
    await flwPost(flwEvent(1)); await flwPost(flwEvent(2));
    const inOrder = { end: iso(sub()!.currentPeriodEnd), slots: slots() };
    resetState();
    fetchMock.mockResolvedValueOnce(b()).mockResolvedValueOnce(a());
    await flwPost(flwEvent(2)); await flwPost(flwEvent(1));
    expect({ end: iso(sub()!.currentPeriodEnd), slots: slots() }).toEqual(inOrder);
  });

  it.each([
    ["amount below plan price", { amount: 1000 }, "amount_mismatch"],
    ["currency mismatch", { currency: "USD" }, "currency_mismatch"],
  ])("%s → rejected and audited", async (_l, over, reason) => {
    fetchMock.mockResolvedValue(flwVerified(over));
    await flwPost(flwEvent());
    expect(state.subs).toHaveLength(0);
    expect(state.audit.at(-1)).toMatchObject({ action: "billing.payment_rejected", metadata: { reason } });
  });

  it.each([
    ["verified status failed", { status: "failed" }],
    ["verified status pending", { status: "pending" }],
    ["verified id differs from the webhook's", { id: 9999 }],
    ["no tx_ref", { tx_ref: "" }],
  ])("%s → nothing written", async (_l, over) => {
    fetchMock.mockResolvedValue(flwVerified(over));
    expect((await flwPost(flwEvent())).status).toBe(200);
    expect(state.subs).toHaveLength(0);
  });

  it("missing or ambiguous created_at → no date invented, nothing written", async () => {
    for (const created_at of [undefined, null, "2026-10-15 09:00:00"]) {
      fetchMock.mockResolvedValue(flwVerified({ created_at }));
      await flwPost(flwEvent());
    }
    expect(state.subs).toHaveLength(0);
    expect(logs.filter((l) => l.msg === "billing.paid_at_unavailable")).toHaveLength(3);
  });

  it("verify API failure → fails (Flutterwave retries), nothing written", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502, json: async () => ({}) });
    await expect(flwPost(flwEvent())).rejects.toThrow(/Flutterwave verify failed/);
    expect(state.subs).toHaveLength(0);
  });

  it("a webhook without a numeric transaction id is ignored without an API call", async () => {
    await flwPost(flwEvent("4242"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["transfer.completed", "refund.completed", "chargeback.created", "subscription.cancelled"])(
    "%s is ignored: no API call, no access change",
    async (event) => {
      await flwPost(flwEvent(4242, event));
      expect(fetchMock).not.toHaveBeenCalled();
      expect(state.subs).toHaveLength(0);
    }
  );

  it("database failure mid-transaction → nothing half-applied", async () => {
    fetchMock.mockResolvedValue(flwVerified());
    state.failInvoiceCreate = true;
    await expect(flwPost(flwEvent())).rejects.toThrow(/connection terminated/);
    expect(state.subs).toHaveLength(0);
    expect(state.invoices).toHaveLength(0);
  });
});
