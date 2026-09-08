import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Test configuration.
 *
 * Integration tests run against a real PostgreSQL database (colbios_test by
 * default) so the constraints that matter — the partial unique indexes, row
 * locking, transactional fulfilment — are actually exercised. Mocking Prisma
 * would test the mock, not the guarantees.
 *
 * `server-only` is aliased to a stub: it is a build-time guard for the Next.js
 * bundler and has no meaning inside the test runner.
 */
export default defineConfig({
  resolve: {
    alias: {
      "server-only": path.resolve(import.meta.dirname, "tests/helpers/server-only-stub.ts"),
      "@": path.resolve(import.meta.dirname),
    },
  },
  test: {
    environment: "node",
    globals: false,
    setupFiles: ["tests/helpers/setup.ts"],
    globalSetup: ["tests/helpers/global-setup.ts"],
    include: ["tests/**/*.test.ts"],
    // Integration tests share one database, so they must not race each other.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
