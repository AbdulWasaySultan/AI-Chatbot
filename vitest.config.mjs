import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['apps/**/test/**/*.test.{ts,mjs}', 'packages/**/test/**/*.test.ts'],
    environment: 'node',
    // Database tests each create their own in-memory Postgres; keep them in separate workers.
    pool: 'forks',
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
