import { defineConfig } from "vitest/config";
import path from "path";

// Separate config for tests/security/**: these hit a real running server
// over HTTP (no mocks — same "test the real thing" philosophy used
// throughout this project's manual E2E verification every phase), so they
// need a longer timeout than unit tests and must run sequentially — several
// tests deliberately exhaust a rate limit, and parallel workers sharing the
// same in-memory limiter would make each other's assertions flaky.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    globalSetup: ["./tests/security/global-setup.ts"],
    include: ["tests/security/**/*.test.ts"],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
