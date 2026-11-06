/**
 * In-memory Prisma double for the billing webhook tests (AS-P0-SECURITY-004/005).
 *
 * Models exactly the calls the billing code makes. Semantics that matter:
 * - writes apply immediately (visible to other "connections");
 * - $transaction rolls back every write if its callback throws;
 * - `SELECT … FOR UPDATE` via tx.$queryRaw is a real per-row mutex held until
 *   the transaction ends, so concurrent transactions on one subscription
 *   serialise like Postgres row locks.
 * Not modelled: unique violations from two concurrent INSERTs of a brand-new
 * subscription row (Postgres raises P2002 and the provider retries).
 */

export type Sub = {
  id: string; organizationId: string | null; userId: string | null; productId: string;
  productPlanId: string | null; couponId: string | null; status: string; provider: string | null;
  providerCustomerId: string | null; providerSubscriptionId: string | null;
  currentPeriodEnd: Date | null; cancelAtPeriodEnd: boolean;
};
export type Inv = {
  id: string; providerInvoiceId: string; subscriptionId: string; provider: string;
  periodStart: Date; periodEnd: Date; paidAt: Date | null; amountCents: number; currency: string; status: string;
  organizationId: string | null; userId: string | null; hostedInvoiceUrl?: string | null;
};
export type Plan = {
  id: string; productId: string; interval: "MONTHLY" | "YEARLY"; priceCents: number; currency: string;
  stripePriceId: string | null;
};
export type Coupon = {
  id: string; code: string; discountType: "PERCENT" | "FIXED"; discountValue: number; currency: string | null;
  maxRedemptions: number | null; timesRedeemed: number; validFrom: Date; validUntil: Date | null;
  stripeCouponId: string | null; paystackCouponId: string | null; isActive: boolean; createdAt: Date;
};
export type Audit = { action: string; userId: string | null; organizationId: string | null; metadata: Record<string, unknown> };

export const state = {
  subs: [] as Sub[],
  invoices: [] as Inv[],
  plans: [] as Plan[],
  coupons: [] as Coupon[],
  orgs: new Set<string>(),
  users: new Set<string>(),
  audit: [] as Audit[],
  failInvoiceCreate: false,
  hideInvoiceOnce: false,
  seq: 0,
};

export function resetState() {
  state.subs = []; state.invoices = []; state.audit = []; state.coupons = [];
  state.failInvoiceCreate = false; state.hideInvoiceOnce = false; state.seq = 0;
  state.orgs = new Set(["org-1"]); state.users = new Set(["user-1"]);
  state.plans = [
    { id: "plan-monthly", productId: "prod-scholar", interval: "MONTHLY", priceCents: 150000, currency: "NGN", stripePriceId: "price_monthly" },
    { id: "plan-yearly", productId: "prod-scholar", interval: "YEARLY", priceCents: 1500000, currency: "NGN", stripePriceId: "price_yearly" },
    { id: "plan-lecture", productId: "prod-lecture", interval: "MONTHLY", priceCents: 90000, currency: "NGN", stripePriceId: "price_lecture" },
    { id: "plan-usd", productId: "prod-scholar", interval: "MONTHLY", priceCents: 1500, currency: "USD", stripePriceId: "price_usd" },
  ];
  locks.clear();
}

type Where = {
  id?: string;
  organizationId_productId?: { organizationId: string; productId: string };
  userId_productId?: { userId: string; productId: string };
};
const findSub = (w: Where) =>
  w.id
    ? state.subs.find((s) => s.id === w.id)
    : w.organizationId_productId
      ? state.subs.find((s) => s.organizationId === w.organizationId_productId!.organizationId && s.productId === w.organizationId_productId!.productId)
      : state.subs.find((s) => s.userId === w.userId_productId!.userId && s.productId === w.userId_productId!.productId);
const clone = <T,>(v: T): T => (v === undefined || v === null ? (null as T) : structuredClone(v));
const t = (d: Date | null) => (d ? d.getTime() : null);

type InvWhere = { subscriptionId: string; status: string; paidAt: { gt?: Date; lte?: Date } };
function invMatch(i: Inv, w: InvWhere) {
  if (i.subscriptionId !== w.subscriptionId || i.status !== w.status || !i.paidAt) return false;
  if (w.paidAt.gt && !(i.paidAt.getTime() > w.paidAt.gt.getTime())) return false;
  if (w.paidAt.lte && !(i.paidAt.getTime() <= w.paidAt.lte.getTime())) return false;
  return true;
}

const locks = new Map<string, Promise<void>>();
async function acquire(id: string): Promise<() => void> {
  const prev = locks.get(id) ?? Promise.resolve();
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  locks.set(id, prev.then(() => held));
  await prev;
  return release;
}

/** Counts lock acquisitions, so a test can prove the code took the lock. */
export const lockStats = { acquired: 0 };

function makeClient(txLocks?: (() => void)[]) {
  const c = {
    subscription: {
      findUnique: async ({ where, select }: { where: Where; select?: { productPlan?: unknown } }) => {
        const s = clone(findSub(where) ?? null);
        if (s && select?.productPlan) {
          const plan = state.plans.find((p) => p.id === s.productPlanId);
          return { ...s, productPlan: plan ? { stripePriceId: plan.stripePriceId, currency: plan.currency } : null };
        }
        return s;
      },
      findFirst: async ({ where }: { where: { provider?: string; providerSubscriptionId: string } }) =>
        clone(state.subs.find((s) => s.providerSubscriptionId === where.providerSubscriptionId && (!where.provider || s.provider === where.provider)) ?? null),
      upsert: async ({ where, create, update }: { where: Where; create: Partial<Sub>; update: Partial<Sub> }) => {
        const s = findSub(where);
        if (s) { Object.assign(s, update); return clone(s); }
        const n: Sub = {
          id: `sub_${++state.seq}`, organizationId: null, userId: null, productId: "", productPlanId: null,
          couponId: null, status: "ACTIVE", provider: null, providerCustomerId: null, providerSubscriptionId: null,
          currentPeriodEnd: null, cancelAtPeriodEnd: false, ...create,
        } as Sub;
        state.subs.push(n);
        return clone(n);
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<Sub> }) => {
        const s = state.subs.find((x) => x.id === where.id)!;
        Object.assign(s, data);
        return clone(s);
      },
      updateMany: async ({ where, data }: { where: { id: string; OR: [unknown, { currentPeriodEnd: { lt: Date } }] }; data: Partial<Sub> }) => {
        const s = state.subs.find((x) => x.id === where.id);
        const lt = where.OR[1].currentPeriodEnd.lt;
        if (s && (s.currentPeriodEnd === null || s.currentPeriodEnd.getTime() < lt.getTime())) {
          Object.assign(s, data);
          return { count: 1 };
        }
        return { count: 0 };
      },
    },
    invoice: {
      // D7: mirrors @@unique([provider, providerInvoiceId]) — lookups use the compound key.
      findUnique: async ({ where }: { where: { provider_providerInvoiceId: { provider: string; providerInvoiceId: string } } }) => {
        if (state.hideInvoiceOnce) { state.hideInvoiceOnce = false; return null; }
        const k = where.provider_providerInvoiceId;
        return clone(state.invoices.find((i) => i.provider === k.provider && i.providerInvoiceId === k.providerInvoiceId) ?? null);
      },
      findMany: async ({ where }: { where: InvWhere }) =>
        clone(state.invoices.filter((i) => invMatch(i, where)).sort((a, b) => a.paidAt!.getTime() - b.paidAt!.getTime())),
      findFirst: async ({ where }: { where: InvWhere }) =>
        clone(state.invoices.filter((i) => invMatch(i, where)).sort((a, b) => b.paidAt!.getTime() - a.paidAt!.getTime())[0] ?? null),
      create: async ({ data }: { data: Omit<Inv, "id"> }) => {
        if (state.failInvoiceCreate) throw new Error("connection terminated");
        if (state.invoices.some((i) => i.provider === data.provider && i.providerInvoiceId === data.providerInvoiceId)) {
          throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
        }
        const row = { id: `inv_${++state.seq}`, ...structuredClone(data) } as Inv;
        state.invoices.push(row);
        return clone(row);
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<Inv> }) => {
        const i = state.invoices.find((x) => x.id === where.id)!;
        Object.assign(i, data);
        return clone(i);
      },
    },
    productPlan: {
      findUnique: async ({ where }: { where: { id: string } }) => clone(state.plans.find((p) => p.id === where.id) ?? null),
    },
    coupon: {
      findUnique: async ({ where }: { where: { id: string } }) => clone(state.coupons.find((x) => x.id === where.id) ?? null),
      update: async ({ where }: { where: { id: string } }) => {
        const x = state.coupons.find((k) => k.id === where.id);
        if (x) x.timesRedeemed++;
        return clone(x ?? {});
      },
    },
    organization: { findUnique: async ({ where }: { where: { id: string } }) => (state.orgs.has(where.id) ? { id: where.id } : null) },
    user: { findUnique: async ({ where }: { where: { id: string } }) => (state.users.has(where.id) ? { id: where.id } : null) },
    auditLog: {
      create: async ({ data }: { data: Audit }) => { state.audit.push(structuredClone(data)); return data; },
    },
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      if (!txLocks) throw new Error("FOR UPDATE outside a transaction");
      if (!strings.join("?").includes("FOR UPDATE")) throw new Error("unexpected raw query");
      txLocks.push(await acquire(String(values[0])));
      lockStats.acquired++;
      return [];
    },
    // Prisma's second argument (timeout options) is accepted and ignored.
    $transaction: async <T,>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      const snap = structuredClone({ subs: state.subs, invoices: state.invoices, audit: state.audit, coupons: state.coupons });
      const held: (() => void)[] = [];
      try {
        return await fn(makeClient(held));
      } catch (e) {
        state.subs = snap.subs; state.invoices = snap.invoices; state.audit = snap.audit; state.coupons = snap.coupons;
        throw e;
      } finally {
        held.forEach((release) => release());
      }
    },
  };
  return c;
}

export const client = makeClient();
export const iso = (x: Date | null | undefined) => x?.toISOString() ?? null;
export { t };
