import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['backend/**/*.test.mjs'],
    environment: 'node',
  },
});
