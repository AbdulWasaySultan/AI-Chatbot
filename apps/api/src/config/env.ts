// Environment configuration, validated at boot (plans/04-backend-architecture.md §6).
import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().optional(),
  PORT: z.coerce.number().int().positive().optional(),
  /** Public origin of the dashboard (Next.js). Auth cookies are issued for this origin. */
  APP_URL: z.url().default('http://localhost:3000'),
  /**
   * Postgres connection string. `pglite://memory` or `pglite://<dir>` runs an embedded
   * Postgres (development and tests only).
   */
  DATABASE_URL: z.string().min(1).default('pglite://.data/dev-db'),
  AUTH_SECRET: z.string().min(32).optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  /** Keeps the in-memory demo endpoints used by the current dashboard (until Phase 3). */
  LEGACY_DEMO_API: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
});

export type AppConfig = ReturnType<typeof loadConfig>;

export function loadConfig(overrides: Record<string, string | undefined> = {}) {
  if (!overrides.SKIP_DOTENV) loadDotenv({ path: path.join(repoRoot, '.env'), quiet: true });
  const parsed = envSchema.safeParse({ ...process.env, ...overrides });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const env = parsed.data;
  const isProd = env.NODE_ENV === 'production';

  if (isProd && !env.AUTH_SECRET) {
    throw new Error('AUTH_SECRET (at least 32 characters) is required in production.');
  }
  if (isProd && env.DATABASE_URL.startsWith('pglite://')) {
    throw new Error('DATABASE_URL must point at a real Postgres server in production.');
  }

  let databaseUrl = env.DATABASE_URL;
  if (databaseUrl.startsWith('pglite://') && databaseUrl !== 'pglite://memory') {
    const dir = databaseUrl.slice('pglite://'.length);
    databaseUrl = `pglite://${path.isAbsolute(dir) ? dir : path.join(repoRoot, dir)}`;
  }

  return {
    env: env.NODE_ENV,
    isProd,
    isTest: env.NODE_ENV === 'test',
    port: env.API_PORT ?? env.PORT ?? 4000,
    appUrl: env.APP_URL.replace(/\/$/, ''),
    databaseUrl,
    // A fixed development secret keeps local sessions valid across restarts. Never used in production.
    authSecret: env.AUTH_SECRET ?? 'dev-only-secret-change-me-0123456789abcdef',
    google:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
        : null,
    legacyDemoApi: env.LEGACY_DEMO_API ?? !isProd,
    logLevel: env.LOG_LEVEL ?? (env.NODE_ENV === 'test' ? 'silent' : isProd ? 'info' : 'debug'),
  };
}
