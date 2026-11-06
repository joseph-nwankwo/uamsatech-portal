import { describe, it, expect } from "vitest";
import { addBillingInterval, parseProviderTimestamp } from "@/lib/billing/paid-period";

// AS-P0-SECURITY-004 — paid-through date arithmetic (UTC, calendar intervals).

const d = (iso: string) => new Date(iso);

describe("addBillingInterval", () => {
  it("adds one calendar month for MONTHLY, keeping the time of day", () => {
    expect(addBillingInterval(d("2026-03-10T14:30:05.123Z"), "MONTHLY").toISOString()).toBe("2026-04-10T14:30:05.123Z");
  });

  it("adds twelve calendar months for YEARLY (not 365 days)", () => {
    expect(addBillingInterval(d("2026-03-10T00:00:00.000Z"), "YEARLY").toISOString()).toBe("2027-03-10T00:00:00.000Z");
  });

  it("is not a fixed 30 days: Jan → Feb and Mar → Apr differ in length", () => {
    const jan = addBillingInterval(d("2026-01-10T00:00:00Z"), "MONTHLY").getTime() - d("2026-01-10T00:00:00Z").getTime();
    const feb = addBillingInterval(d("2026-02-10T00:00:00Z"), "MONTHLY").getTime() - d("2026-02-10T00:00:00Z").getTime();
    expect(jan / 864e5).toBe(31);
    expect(feb / 864e5).toBe(28);
  });

  it("clamps to the last day of a shorter month (31 Jan → 28 Feb in 2026)", () => {
    expect(addBillingInterval(d("2026-01-31T09:00:00Z"), "MONTHLY").toISOString()).toBe("2026-02-28T09:00:00.000Z");
  });

  it("clamps to 29 Feb in a leap year (31 Jan 2028 → 29 Feb 2028)", () => {
    expect(addBillingInterval(d("2028-01-31T09:00:00Z"), "MONTHLY").toISOString()).toBe("2028-02-29T09:00:00.000Z");
  });

  it("rolls over the year end (15 Dec → 15 Jan)", () => {
    expect(addBillingInterval(d("2026-12-15T00:00:00Z"), "MONTHLY").toISOString()).toBe("2027-01-15T00:00:00.000Z");
  });

  it("a yearly plan bought on 29 Feb ends on 28 Feb next year", () => {
    expect(addBillingInterval(d("2028-02-29T12:00:00Z"), "YEARLY").toISOString()).toBe("2029-02-28T12:00:00.000Z");
  });

  it("works in UTC regardless of the offset the start was expressed in", () => {
    // 2026-01-31T23:30-05:00 is 2026-02-01T04:30Z → +1 month = 2026-03-01T04:30Z
    expect(addBillingInterval(d("2026-01-31T23:30:00-05:00"), "MONTHLY").toISOString()).toBe("2026-03-01T04:30:00.000Z");
  });

  it("refuses an unknown interval instead of guessing a length", () => {
    expect(() => addBillingInterval(d("2026-01-01T00:00:00Z"), "WEEKLY" as never)).toThrow(/Unsupported billing interval/);
  });

  it("refuses an invalid start date", () => {
    expect(() => addBillingInterval(new Date("nope"), "MONTHLY")).toThrow(/Invalid start date/);
  });
});

describe("parseProviderTimestamp", () => {
  const now = d("2026-11-04T12:00:00Z");

  it("accepts an ISO-8601 UTC timestamp", () => {
    expect(parseProviderTimestamp("2026-11-01T10:20:30.000Z", now)?.toISOString()).toBe("2026-11-01T10:20:30.000Z");
  });

  it("accepts an explicit offset and normalises to UTC", () => {
    expect(parseProviderTimestamp("2026-11-01T11:20:30+01:00", now)?.toISOString()).toBe("2026-11-01T10:20:30.000Z");
  });

  it.each([
    ["no timezone (ambiguous)", "2026-11-01T10:20:30"],
    ["date only", "2026-11-01"],
    ["free text", "yesterday"],
    ["epoch number as string", "1793795836"],
    ["impossible date", "2026-13-45T10:00:00Z"],
    ["before 2020", "2019-12-31T23:59:59Z"],
    ["more than 5 minutes in the future", "2026-11-04T12:06:00Z"],
  ])("rejects %s", (_label, value) => {
    expect(parseProviderTimestamp(value, now)).toBeNull();
  });

  it.each([[undefined], [null], [1793795836], [{}]])("rejects a non-string %p", (value) => {
    expect(parseProviderTimestamp(value, now)).toBeNull();
  });

  it("tolerates small clock skew (2 minutes ahead)", () => {
    expect(parseProviderTimestamp("2026-11-04T12:02:00Z", now)).not.toBeNull();
  });
});
