import { defineConfig } from 'drizzle-kit';

// Generates SQL migrations from src/db/schema.ts. Row-level security lives in a hand-written migration.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
});
