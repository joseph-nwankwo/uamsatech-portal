import { z } from "zod";

/**
 * The characters stripped from both ends of an email: exactly the set
 * ECMAScript String.prototype.trim() removes (WhiteSpace + LineTerminator).
 *
 * The database uses the same set: portal_normalize_email() in migration
 * 20261121120000_s1_normalize_emails, and scripts/preflight-s1.sql.
 * tests/unit/normalize-email.test.ts checks that all three stay identical,
 * so change them together (and see STATUS.md before changing the SQL
 * function: CHECK users_email_normalized depends on it).
 */
export const EMAIL_TRIM_CODE_POINTS: readonly number[] = [
  0x0009, 0x000a, 0x000b, 0x000c, 0x000d, 0x0020, 0x00a0, 0x1680, 0x2000,
  0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009,
  0x200a, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff,
];

const trimClass = EMAIL_TRIM_CODE_POINTS.map(
  (cp) => `\\u${cp.toString(16).padStart(4, "0")}`
).join("");
const EDGE_WHITESPACE = new RegExp(`^[${trimClass}]+|[${trimClass}]+$`, "g");

/**
 * The one canonical form of an email address in this app: edge whitespace
 * (EMAIL_TRIM_CODE_POINTS) stripped, then lowercased. Every email that is
 * written, looked up or compared goes through this function — never an
 * ad-hoc .toLowerCase().
 *
 * The database enforces the same form (CHECK users_email_normalized), so a
 * case or whitespace variant of an existing address can't be registered as
 * a second account.
 */
export function normalizeEmail(input: string): string {
  return input.replace(EDGE_WHITESPACE, "").toLowerCase();
}

/**
 * Zod field for user-supplied email input. Normalizes before validating:
 * z.email() rejects surrounding whitespace, so the order matters.
 * Safe to use in client components (no server imports).
 */
export function emailField(message?: string, max = 320) {
  return z
    .string()
    .max(max, message)
    .transform(normalizeEmail)
    .pipe(z.email(message));
}
