import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    // Unit tests run everywhere (CI, local). Security/integration tests
    // hit a real running server and are excluded by default — see
    // tests/security/README.md and the separate `test:security` script.
    include: ["tests/unit/**/*.test.ts"],
  },
});
