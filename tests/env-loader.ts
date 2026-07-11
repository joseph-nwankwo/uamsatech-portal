import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Shared by tests/setup.ts (runs per Vitest worker) and
// tests/security/global-setup.ts (runs once, before any worker, in a
// separate process — so it needs its own copy of this, it can't rely on
// setupFiles having already run). Vitest/Vite doesn't load .env into
// process.env by default, only import.meta.env — but lib/env.ts reads
// process.env directly, since it's the same module Next.js's server runtime
// uses. A tiny hand-rolled parser rather than a new dependency (`dotenv`) —
// this project's .env files only ever use simple `KEY="value"` lines.
export function loadDotEnv() {
  const envPath = resolve(__dirname, "../.env");
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    const value = rawValue.replace(/^"(.*)"$/, "$1");
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}
