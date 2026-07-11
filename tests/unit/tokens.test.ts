import { describe, it, expect } from "vitest";
import { generateOpaqueToken, hashToken } from "@/lib/auth/tokens";

describe("opaque tokens", () => {
  it("generates a sufficiently long, URL-safe random token", () => {
    const token = generateOpaqueToken();
    // 32 random bytes, base64url-encoded — should be well over 32 chars and
    // contain no characters base64url excludes (+, /, =).
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("never generates the same token twice", () => {
    const tokens = new Set(
      Array.from({ length: 1000 }, () => generateOpaqueToken())
    );
    expect(tokens.size).toBe(1000);
  });

  it("hashes deterministically — the same input always hashes the same way", () => {
    const token = generateOpaqueToken();
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it("produces a hash that reveals nothing about the raw token", () => {
    const token = generateOpaqueToken();
    const hash = hashToken(token);
    expect(hash).not.toBe(token);
    expect(hash).not.toContain(token);
    // sha256 hex digest is always 64 characters.
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("hashes two different tokens to two different values", () => {
    const a = hashToken(generateOpaqueToken());
    const b = hashToken(generateOpaqueToken());
    expect(a).not.toBe(b);
  });
});
