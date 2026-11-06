import type { SubscriptionStatus } from "@prisma/client";
import { coverageAt, type ReconstructedPeriod } from "@/lib/billing/domain/period-ledger";

/**
 * Multi-source central entitlement decision — pure (AS-P0-SECURITY-007).
 *
 * NOT WIRED yet: the live decision (lib/portal/entitlement.ts, used by the SSO
 * launch route and POST /api/internal/entitlements/verify) is unchanged until
 * the licence/trial/operator/ledger tables exist. When wired, THIS is the
 * single policy for launch, verification, login and refresh.
 *
 * Every source is evaluated INDEPENDENTLY for one product. Access is granted
 * when ANY source is valid; an invalid source never cancels a valid one
 * (a dispute on one payment cannot remove a valid institutional licence or
 * operator grant). Each verdict carries its source and reason.
 */

export type SourceKind = "SUBSCRIPTION" | "LICENCE" | "TRIAL" | "OPERATOR";

export type SourceVerdict = {
  source: SourceKind;
  sourceId: string;
  valid: boolean;
  reason: string;
  /** End of the validity window containing now (valid verdicts only). */
  until: Date | null;
};

const ok = (source: SourceKind, sourceId: string, until: Date): SourceVerdict => ({ source, sourceId, valid: true, reason: "valid", until });
const no = (source: SourceKind, sourceId: string, reason: string): SourceVerdict => ({ source, sourceId, valid: false, reason, until: null });

const inWindow = (startsAt: Date, endsAt: Date, now: Date) =>
  startsAt.getTime() <= now.getTime() && now.getTime() < endsAt.getTime();

// ── 1. Paid subscription (payment-period ledger) ─────────────────────────────

export function evaluateSubscriptionSource(input: {
  product: string;
  subscription: { id: string; productSlug: string; status: SubscriptionStatus };
  periods: readonly ReconstructedPeriod[];
  now: Date;
}): SourceVerdict {
  const { subscription: s, now } = input;
  if (s.productSlug !== input.product) return no("SUBSCRIPTION", s.id, "other_product");
  // TRIALING is never paid entitlement: trials must be explicit central grants.
  if (s.status === "TRIALING") return no("SUBSCRIPTION", s.id, "trial_not_authorized");
  if (s.status === "PAST_DUE") return no("SUBSCRIPTION", s.id, "past_due");
  if (s.status !== "ACTIVE") return no("SUBSCRIPTION", s.id, "canceled");
  const cov = coverageAt(input.periods, now);
  return cov.entitled ? ok("SUBSCRIPTION", s.id, cov.until) : no("SUBSCRIPTION", s.id, cov.reason);
}

// ── 2. Institutional licence ──────────────────────────────────────────────────

export function evaluateLicenceSource(input: {
  product: string;
  licence: { id: string; productSlug: string; licenceType: "INSTITUTION_WIDE" | "SEAT_BASED"; status: string; startsAt: Date; endsAt: Date };
  link: { productSlug: string; status: string } | null;
  /** Verified central Membership of the linked organization. */
  isMember: boolean;
  /** An ACTIVE LicenceSeat for this user on this licence. */
  hasActiveSeat: boolean;
  now: Date;
}): SourceVerdict {
  const { licence: l, link, now } = input;
  if (l.productSlug !== input.product) return no("LICENCE", l.id, "other_product");
  if (!link || link.status !== "VERIFIED" || link.productSlug !== input.product) return no("LICENCE", l.id, "institution_link_unverified");
  if (l.status === "SUSPENDED") return no("LICENCE", l.id, "suspended");
  if (l.status === "REVOKED") return no("LICENCE", l.id, "revoked");
  if (l.status !== "ACTIVE") return no("LICENCE", l.id, "not_active");
  if (!inWindow(l.startsAt, l.endsAt, now)) return no("LICENCE", l.id, now >= l.endsAt ? "expired" : "not_started");
  if (!input.isMember) return no("LICENCE", l.id, "not_a_member");
  if (l.licenceType === "SEAT_BASED" && !input.hasActiveSeat) return no("LICENCE", l.id, "no_seat_assigned");
  return ok("LICENCE", l.id, l.endsAt);
}

// ── 3. Centrally authorized trial ─────────────────────────────────────────────

export function evaluateTrialSource(input: {
  product: string;
  trial: { id: string; productSlug: string; targetType: "USER" | "INSTITUTION"; status: string; startsAt: Date; endsAt: Date; authorizedById: string };
  /** For INSTITUTION trials: the verified link and the user's membership. */
  link: { productSlug: string; status: string } | null;
  isMember: boolean;
  userId: string;
  now: Date;
}): SourceVerdict {
  const { trial: t, now } = input;
  if (t.productSlug !== input.product) return no("TRIAL", t.id, "other_product");
  if (t.status !== "ACTIVE") return no("TRIAL", t.id, "revoked");
  if (t.authorizedById === input.userId) return no("TRIAL", t.id, "self_authorized");
  if (!inWindow(t.startsAt, t.endsAt, now)) return no("TRIAL", t.id, now >= t.endsAt ? "expired" : "not_started");
  if (t.targetType === "INSTITUTION") {
    if (!input.link || input.link.status !== "VERIFIED" || input.link.productSlug !== input.product) return no("TRIAL", t.id, "institution_link_unverified");
    if (!input.isMember) return no("TRIAL", t.id, "not_a_member");
  }
  return ok("TRIAL", t.id, t.endsAt);
}

// ── 4. Operator grant ─────────────────────────────────────────────────────────

export function evaluateOperatorSource(input: {
  product: string;
  grant: { id: string; productSlug: string; userId: string; status: string; startsAt: Date; endsAt: Date; issuedById: string };
  /** The issuer was an authorized central operator administrator when the grant was issued. */
  issuerAuthorized: boolean;
  userId: string;
  now: Date;
}): SourceVerdict {
  const { grant: g, now } = input;
  if (g.productSlug !== input.product) return no("OPERATOR", g.id, "other_product");
  if (g.userId !== input.userId) return no("OPERATOR", g.id, "other_user");
  if (g.status !== "ACTIVE") return no("OPERATOR", g.id, "revoked");
  if (g.issuedById === g.userId) return no("OPERATOR", g.id, "self_issued");
  if (!input.issuerAuthorized) return no("OPERATOR", g.id, "issuer_not_authorized");
  if (!inWindow(g.startsAt, g.endsAt, now)) return no("OPERATOR", g.id, now >= g.endsAt ? "expired" : "not_started");
  return ok("OPERATOR", g.id, g.endsAt);
}

// ── Combination ───────────────────────────────────────────────────────────────

/** Reporting precedence among VALID sources. Paid first, so a trial never masks or replaces paid access. */
const PRECEDENCE: readonly SourceKind[] = ["SUBSCRIPTION", "LICENCE", "TRIAL", "OPERATOR"];

/** Status reported when nothing is valid: the most specific condition wins. */
const DENIAL_STATUS: readonly [RegExp, "SUSPENDED" | "REVOKED" | "EXPIRED" | "DENIED"][] = [
  [/^suspended$/, "SUSPENDED"],
  [/^revoked$/, "REVOKED"],
  [/^expired$/, "EXPIRED"],
];

export type CombinedDecision =
  | { decision: "GRANTED"; status: "ACTIVE"; primary: SourceVerdict; until: Date; sources: SourceVerdict[] }
  | { decision: "DENIED"; status: "SUSPENDED" | "REVOKED" | "EXPIRED" | "DENIED" | "NONE"; reason: string; sources: SourceVerdict[] };

export function combineEntitlement(verdicts: readonly SourceVerdict[]): CombinedDecision {
  const sources = [...verdicts];
  const valid = sources.filter((v) => v.valid && v.until);
  if (valid.length) {
    const primary = [...valid].sort((a, b) => PRECEDENCE.indexOf(a.source) - PRECEDENCE.indexOf(b.source))[0];
    // Sources are independent: access lasts while ANY of them does. The cap is
    // re-verified at every refresh, so a source revoked early is noticed then.
    const until = valid.reduce((m, v) => (v.until!.getTime() > m.getTime() ? v.until! : m), valid[0].until!);
    return { decision: "GRANTED", status: "ACTIVE", primary, until, sources };
  }
  if (sources.length === 0) return { decision: "DENIED", status: "NONE", reason: "no_entitlement_source", sources };
  for (const [pattern, status] of DENIAL_STATUS) {
    const hit = sources.find((v) => pattern.test(v.reason));
    if (hit) return { decision: "DENIED", status, reason: `${hit.source.toLowerCase()}_${hit.reason}`, sources };
  }
  return { decision: "DENIED", status: "DENIED", reason: `${sources[0].source.toLowerCase()}_${sources[0].reason}`, sources };
}
