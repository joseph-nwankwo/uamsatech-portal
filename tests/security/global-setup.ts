import type { TestProject } from "vitest/node";
import { loadDotEnv } from "../env-loader";

loadDotEnv();

// db and helpers import after loadDotEnv() runs — both transitively import
// lib/env.ts, which parses process.env at module load time.
const { createTestUser } = await import("./helpers");
const { db } = await import("@/lib/db");

// Signup is rate-limited to 5/hour per IP (a real, intentional control —
// see app/api/auth/signup/route.ts, and don't loosen it just for test
// convenience). Every test file creating its own fresh user would burn
// through that budget in a single run and make reruns flaky. Instead, one
// shared user is created once here and handed to every test file that only
// needs a single identity; only tests/security/idor.test.ts creates an
// additional (second) user, since IDOR inherently needs two distinct
// identities to test against each other.
export default async function setup({ provide }: TestProject) {
  const sharedUser = await createTestUser("security-shared");
  provide("sharedUser", sharedUser);

  return async () => {
    await db.user
      .delete({ where: { id: sharedUser.userId } })
      .catch(() => undefined);
  };
}

declare module "vitest" {
  export interface ProvidedContext {
    sharedUser: Awaited<ReturnType<typeof createTestUser>>;
  }
}
