import { z } from "zod";

/**
 * The one canonical form of an email address in this app: trimmed and
 * lowercased. Every email that is written, looked up or compared goes
 * through this function — never an ad-hoc .toLowerCase().
 *
 * The database enforces the same form (CHECK users_email_normalized), so a
 * case variant of an existing address can't be registered as a second account.
 */
export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
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
