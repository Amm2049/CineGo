// vitest.integration.config.ts
// Integration tests: real services against the real database (DATABASE_URL from .env).
// Stripe is replaced by an in-memory fake inside each test file, so these never call Stripe.
// Run: npm run test:integration

import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["dotenv/config"],
    include: ["src/tests/integration/**/*.test.ts"],
    fileParallelism: false, // files share one database
    testTimeout: 60_000, // remote database round trips
    hookTimeout: 60_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
