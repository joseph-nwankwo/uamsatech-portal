import type { PlanInterval } from "@prisma/client";

/**
 * Paid-through date arithmetic for one-time provider payments (AS-P0-SECURITY-004).
 *
 * Paystack and Flutterwave checkouts here are one-off transactions (no
 * provider-side recurring plan), so the provider confirms only WHEN a payment
 * succeeded. What that payment bought is the ProductPlan's interval. The
 * paid-through date is therefore: provider-confirmed payment time + one
 * calendar interval of the purchased plan, in UTC. Never a fixed 30 days.
 */

const MONTHS_PER_INTERVAL: Record<PlanInterval, number> = {
  MONTHLY: 1,
  YEARLY: 12,
};

/**
 * Adds one billing interval in UTC calendar terms, clamping to the last day
 * of the target month (31 Jan + 1 month = 28/29 Feb), keeping time of day.
 * Throws on an interval it does not know, never guessing a length.
 */
export function addBillingInterval(start: Date, interval: PlanInterval): Date {
  const months = MONTHS_PER_INTERVAL[interval];
  if (months === undefined) {
    throw new Error(`Unsupported billing interval: ${String(interval)}`);
  }
  if (Number.isNaN(start.getTime())) throw new Error("Invalid start date");

  const year = start.getUTCFullYear();
  const month = start.getUTCMonth() + months; // Date.UTC normalises overflow
  const lastDayOfTarget = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(
      year,
      month,
      Math.min(start.getUTCDate(), lastDayOfTarget),
      start.getUTCHours(),
      start.getUTCMinutes(),
      start.getUTCSeconds(),
      start.getUTCMilliseconds()
    )
  );
}

/** Earliest payment time accepted as plausible provider data. */
const EARLIEST_PLAUSIBLE = Date.UTC(2020, 0, 1);
/** Tolerated clock skew between the provider and this server. */
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

/**
 * Parses a provider timestamp. Accepts only an ISO-8601 string that carries an
 * explicit UTC designator or offset (so it is unambiguous), within a
 * plausible window. Anything else → null: the caller must not invent a date.
 */
export function parseProviderTimestamp(value: unknown, now: Date = new Date()): Date | null {
  if (typeof value !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/.test(value)) {
    return null;
  }
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return null;
  if (ms < EARLIEST_PLAUSIBLE) return null;
  if (ms > now.getTime() + MAX_FUTURE_SKEW_MS) return null;
  return new Date(ms);
}
