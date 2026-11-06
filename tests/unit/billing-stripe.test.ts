import { describe, it, expect, vi, beforeEach } from "vitest";
import { state, resetState, iso, lockStats } from "./helpers/fake-billing-db";

// AS-P0-SECURITY-005 — Stripe paid-through persistence. Webhooks are signed
// for real with the Stripe SDK; only subscriptions.retrieve is stubbed.

const WHSEC = "whsec_unit_test_secret_only";

vi.mock("@/lib/env", () => ({
  env: { STRIPE_SECRET_KEY: "sk_test_unit_tests_only", STRIPE_WEBHOOK_SECRET: "whsec_unit_test_secret_only" },
}));
vi.mock("@/lib/auth/rate-limit", () => ({
  checkRateLimit: async () => ({ allowed: true }),
  requestIp: () => "203.0.113.1",
}));
vi.mock("@/lib/analytics/track", () => ({ trackEvent: async () => undefined }));
vi.mock("@/lib/logger", () => ({ logger: { info: () => undefined, warn: () => undefined, error: () => undefined, debug: () => undefined } }));
vi.mock("@/lib/db", async () => ({ db: (await import("./helpers/fake-billing-db")).client }));

const { getStripeClient } = await import("@/lib/billing/stripe");
const { POST } = await import("@/app/api/billing/stripe/webhook/route");
const { evaluateSubscription } = await import("@/lib/portal/entitlement");

const stripe = getStripeClient();
const retrieve = vi.spyOn(stripe.subscriptions, "retrieve");

const unix = (s: string) => Math.floor(Date.parse(s) / 1000);
const P1_START = "2026-10-20T00:00:00.000Z", P1_END = "2026-11-20T00:00:00.000Z", P2_END = "2026-12-20T00:00:00.000Z";
const META = { billTo: "organization", organizationId: "org-1", productId: "prod-scholar", productPlanId: "plan-monthly" };

function remote(over: Record<string, unknown> = {}, item: Record<string, unknown> = {}) {
  return {
    id: "sub_stripe_1", object: "subscription", status: "active",
    cancel_at_period_end: false, cancel_at: null,
    latest_invoice: { id: "in_1", object: "invoice", status: "paid" },
    items: { object: "list", data: [{ id: "si_1", price: { id: "price_monthly", currency: "ngn" }, current_period_start: unix(P1_START), current_period_end: unix(P1_END), ...item }] },
    ...over,
  };
}

function post(type: string, object: Record<string, unknown>, signature?: string) {
  const payload = JSON.stringify({ id: `evt_${Math.random().toString(36).slice(2)}`, object: "event", type, data: { object }, created: unix("2026-10-20T00:00:00Z") });
  const header = signature ?? stripe.webhooks.generateTestHeaderString({ payload, secret: WHSEC });
  return POST(new Request("https://portal.test/api/billing/stripe/webhook", { method: "POST", body: payload, headers: { "stripe-signature": header } }));
}
const session = (meta: Record<string, unknown> = META, over: Record<string, unknown> = {}) =>
  ({ id: "cs_1", object: "checkout.session", mode: "subscription", subscription: "sub_stripe_1", customer: "cus_1", metadata: meta, ...over });
const invoice = (over: Record<string, unknown> = {}) => ({
  id: "in_2", object: "invoice", status: "paid", amount_paid: 150000, currency: "ngn", hosted_invoice_url: null,
  status_transitions: { paid_at: unix("2026-11-20T00:05:00Z") }, period_start: unix(P1_START), period_end: unix(P1_END),
  lines: { data: [{ period: { start: unix(P1_END), end: unix(P2_END) } }] },
  parent: { subscription_details: { subscription: "sub_stripe_1" } }, ...over,
});
const sub = () => state.subs.find((s) => s.providerSubscriptionId === "sub_stripe_1");

async function checkout(r = remote()) {
  retrieve.mockResolvedValueOnce(r as never);
  return post("checkout.session.completed", session());
}

beforeEach(() => {
  resetState();
  retrieve.mockReset();
});

describe("Stripe — signature, checkout and paid-through persistence", () => {
  it("rejects an invalid signature with 400, never calls Stripe, writes nothing", async () => {
    const res = await post("checkout.session.completed", session(), "t=1,v1=deadbeef");
    expect(res.status).toBe(400);
    expect(retrieve).not.toHaveBeenCalled();
    expect(state.subs).toHaveLength(0);
  });

  it("checkout: paid-through = Stripe item current_period_end (no month arithmetic), from a fresh API fetch", async () => {
    expect((await checkout()).status).toBe(200);
    expect(retrieve).toHaveBeenCalledWith("sub_stripe_1", { expand: ["latest_invoice"] });
    expect(sub()).toMatchObject({ status: "ACTIVE", provider: "STRIPE" });
    expect(iso(sub()!.currentPeriodEnd)).toBe(P1_END);
    expect(state.audit.at(-1)).toMatchObject({ action: "billing.entitlement_extended", metadata: { provider: "STRIPE", currentPeriodEnd: P1_END } });
  });

  it("an odd-length Stripe period is stored exactly as Stripe reports it", async () => {
    await checkout(remote({}, { current_period_end: unix("2026-11-03T17:45:00Z") }));
    expect(iso(sub()!.currentPeriodEnd)).toBe("2026-11-03T17:45:00.000Z");
  });

  it("cancel_at earlier than the period end caps the paid-through date", async () => {
    await checkout(remote({ cancel_at: unix("2026-11-05T00:00:00Z") }));
    expect(iso(sub()!.currentPeriodEnd)).toBe("2026-11-05T00:00:00.000Z");
  });

  it("cancel at period end: entitled until the paid-through date, denied after", async () => {
    await checkout(remote({ cancel_at_period_end: true }));
    const s = sub()! as unknown as Parameters<typeof evaluateSubscription>[0];
    expect(sub()!.cancelAtPeriodEnd).toBe(true);
    expect(evaluateSubscription(s, new Date(Date.parse(P1_END) - 1))).toEqual({ ok: true });
    expect(evaluateSubscription(s, new Date(P1_END))).toEqual({ ok: false, reason: "expired" });
  });

  it("renewal: invoice.paid re-syncs and extends; the invoice records Stripe's paid_at and service period", async () => {
    await checkout();
    retrieve.mockResolvedValueOnce(remote({ latest_invoice: { id: "in_2", status: "paid" } }, { current_period_start: unix(P1_END), current_period_end: unix(P2_END) }) as never);
    await post("invoice.paid", invoice());
    expect(iso(sub()!.currentPeriodEnd)).toBe(P2_END);
    expect(state.invoices).toHaveLength(1);
    expect(iso(state.invoices[0].paidAt)).toBe("2026-11-20T00:05:00.000Z");
    expect(iso(state.invoices[0].periodStart)).toBe(P1_END);
    expect(iso(state.invoices[0].periodEnd)).toBe(P2_END);
  });

  it("duplicate invoice.paid delivery records one invoice and changes nothing else", async () => {
    await checkout();
    const renewed = remote({ latest_invoice: { id: "in_2", status: "paid" } }, { current_period_end: unix(P2_END) });
    retrieve.mockResolvedValue(renewed as never);
    await post("invoice.paid", invoice());
    await post("invoice.paid", invoice());
    expect(state.invoices).toHaveLength(1);
    expect(iso(sub()!.currentPeriodEnd)).toBe(P2_END);
  });

  it("renewal period advanced but the renewal invoice is not yet paid → no extension", async () => {
    await checkout();
    retrieve.mockResolvedValueOnce(remote({ latest_invoice: { id: "in_2", status: "open" } }, { current_period_end: unix(P2_END) }) as never);
    await post("customer.subscription.updated", remote());
    expect(iso(sub()!.currentPeriodEnd)).toBe(P1_END);
  });

  it("latest invoice not available as an object → no extension", async () => {
    await checkout(remote({ latest_invoice: "in_1" }));
    expect(sub()!.currentPeriodEnd).toBeNull();
  });
});

describe("Stripe — failed, incomplete, trial, cancellation, out-of-order", () => {
  it("invoice.payment_failed → past_due synced: PAST_DUE, no extension, entitlement denied", async () => {
    await checkout();
    retrieve.mockResolvedValueOnce(remote({ status: "past_due", latest_invoice: { id: "in_2", status: "open" } }, { current_period_end: unix(P2_END) }) as never);
    await post("invoice.payment_failed", invoice({ status: "open", status_transitions: { paid_at: null } }));
    expect(sub()!.status).toBe("PAST_DUE");
    expect(iso(sub()!.currentPeriodEnd)).toBe(P1_END);
    const s = sub()! as unknown as Parameters<typeof evaluateSubscription>[0];
    expect(evaluateSubscription(s, new Date("2026-11-01T00:00:00Z"))).toEqual({ ok: false, reason: "past_due" });
  });

  it.each([
    ["incomplete", "CANCELED"],
    ["incomplete_expired", "CANCELED"],
    ["unpaid", "PAST_DUE"],
    ["paused", "CANCELED"],
    ["trialing", "TRIALING"],
  ])("initial status %s → %s with no paid-through date", async (stripeStatus, local) => {
    await checkout(remote({ status: stripeStatus, latest_invoice: { id: "in_1", status: "open" } }));
    expect(sub()!.status).toBe(local);
    expect(sub()!.currentPeriodEnd).toBeNull();
  });

  it.each(["trialing", "past_due", "canceled", "paused"])(
    "status %s never extends, even when the latest invoice is paid (e.g. a $0 trial invoice)",
    async (stripeStatus) => {
      await checkout(remote({ status: stripeStatus, latest_invoice: { id: "in_trial", status: "paid" } }));
      expect(sub()!.currentPeriodEnd).toBeNull();
    }
  );

  it("customer.subscription.deleted → CANCELED; entitlement denied even inside the old period", async () => {
    await checkout();
    retrieve.mockResolvedValueOnce(remote({ status: "canceled" }) as never);
    await post("customer.subscription.deleted", remote({ status: "canceled" }));
    expect(sub()!.status).toBe("CANCELED");
    const s = sub()! as unknown as Parameters<typeof evaluateSubscription>[0];
    expect(evaluateSubscription(s, new Date("2026-11-01T00:00:00Z"))).toEqual({ ok: false, reason: "canceled" });
  });

  it("out-of-order: a stale 'active' payload is ignored in favour of Stripe's current 'canceled' state", async () => {
    await checkout();
    retrieve.mockResolvedValueOnce(remote({ status: "canceled" }) as never);
    await post("customer.subscription.updated", remote({ status: "active" }));
    expect(sub()!.status).toBe("CANCELED");
  });

  it("an older period from Stripe never shortens the stored paid-through date", async () => {
    await checkout(remote({}, { current_period_end: unix(P2_END) }));
    retrieve.mockResolvedValueOnce(remote() as never);
    await post("customer.subscription.updated", remote());
    expect(iso(sub()!.currentPeriodEnd)).toBe(P2_END);
  });

  it("concurrent syncs are serialised by the row lock", async () => {
    await checkout();
    const before = lockStats.acquired;
    retrieve.mockResolvedValueOnce(remote({ status: "past_due", latest_invoice: { id: "x", status: "open" } }) as never);
    retrieve.mockResolvedValueOnce(remote({ status: "canceled" }) as never);
    await Promise.all([post("customer.subscription.updated", remote()), post("customer.subscription.updated", remote())]);
    expect(lockStats.acquired - before).toBe(2);
    expect(sub()!.status).toBe("CANCELED"); // the state fetched last is written last
  });
});

describe("Stripe — price, currency and attribution verification", () => {
  it.each([
    ["price is not the plan's stripePriceId", {}, { price: { id: "price_yearly", currency: "ngn" } }],
    ["currency differs from the plan's", {}, { price: { id: "price_monthly", currency: "usd" } }],
  ])("%s → no extension, flagged for review", async (_l, over, item) => {
    await checkout(remote(over, item));
    expect(sub()!.currentPeriodEnd).toBeNull();
    expect(state.audit.at(-1)).toMatchObject({ action: "billing.renewal_needs_review" });
  });

  it("more than one subscription item → no extension, flagged for review", async () => {
    const r = remote();
    (r.items.data as unknown[]).push({ id: "si_2", price: { id: "price_monthly", currency: "ngn" }, current_period_end: unix(P2_END) });
    await checkout(r);
    expect(sub()!.currentPeriodEnd).toBeNull();
    expect(state.audit.at(-1)!.metadata).toMatchObject({ reason: "unexpected_items" });
  });

  it.each([
    ["plan belongs to another product", { ...META, productPlanId: "plan-lecture" }],
    ["unknown plan", { ...META, productPlanId: "nope" }],
    ["payer organization does not exist", { ...META, organizationId: "org-ghost" }],
    ["no metadata", {}],
  ])("checkout with %s → no subscription created, Stripe not called", async (_l, meta) => {
    await post("checkout.session.completed", session(meta));
    expect(state.subs).toHaveLength(0);
    expect(retrieve).not.toHaveBeenCalled();
  });
});

describe("Stripe — failures, unknown subscriptions, refunds and disputes", () => {
  it("Stripe API failure → error surfaces (Stripe retries); stored status and date unchanged", async () => {
    await checkout();
    retrieve.mockRejectedValueOnce(new Error("api_connection_error"));
    await expect(post("customer.subscription.updated", remote({ status: "canceled" }))).rejects.toThrow(/api_connection_error/);
    expect(sub()).toMatchObject({ status: "ACTIVE" });
    expect(iso(sub()!.currentPeriodEnd)).toBe(P1_END);
  });

  it("events for a subscription we do not know are acknowledged without writes", async () => {
    expect((await post("customer.subscription.updated", remote({ id: "sub_unknown" }))).status).toBe(200);
    expect(retrieve).not.toHaveBeenCalled();
    expect(state.subs).toHaveLength(0);
  });

  it.each(["charge.refunded", "charge.refund.updated", "charge.dispute.created", "charge.dispute.closed", "refund.created"])(
    "%s is acknowledged and changes no entitlement (schema change required first)",
    async (type) => {
      await checkout();
      await post(type, { id: "x", object: "charge" });
      expect(retrieve).toHaveBeenCalledTimes(1); // only the checkout's
      expect(iso(sub()!.currentPeriodEnd)).toBe(P1_END);
      expect(sub()!.status).toBe("ACTIVE");
    }
  );
});
