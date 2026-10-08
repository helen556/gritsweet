import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "scripts/shim/server-only.js"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    env: {
      DATABASE_URL: ":memory:",
      SESSION_SECRET: "test-secret-test-secret-test-secret-123",
      PAYMENT_MODE: "provider",
      PAYMENT_PROVIDER: "test",
      PAYMENT_WEBHOOK_SECRET: "whsec_test_only",
      EMAIL_PROVIDER: "none",
      APP_URL: "http://localhost:3000",
    },
    fileParallelism: false,
  },
});
