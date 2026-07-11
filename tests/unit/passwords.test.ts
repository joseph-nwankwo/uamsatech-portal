import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/passwords";

describe("password hashing", () => {
  it("produces a bcrypt hash distinct from the plaintext", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).not.toBe("correct horse battery staple");
    expect(hash).toMatch(/^\$2[aby]\$/);
  });

  it("verifies the correct password against its own hash", async () => {
    const hash = await hashPassword("prevail.56");
    await expect(verifyPassword("prevail.56", hash)).resolves.toBe(true);
  });

  it("rejects an incorrect password against a real hash", async () => {
    const hash = await hashPassword("prevail.56");
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });

  it("produces a different hash for the same password each time (real salt)", async () => {
    const [a, b] = await Promise.all([
      hashPassword("same-input"),
      hashPassword("same-input"),
    ]);
    expect(a).not.toBe(b);
  });
});
