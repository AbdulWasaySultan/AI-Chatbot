// Authentication (plans/06-tenancy-auth-security.md §3; decision D6).
// Better Auth handles sign-up, sign-in, sessions and OAuth. It is wrapped here so the rest of
// the API only depends on `getSessionUser()` and the mounted handler.
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { fromNodeHeaders, toNodeHandler } from 'better-auth/node';
import type { IncomingHttpHeaders } from 'node:http';
import type { AppConfig } from '../config/env.ts';
import type { Db } from '../db/client.ts';
import * as schema from '../db/schema.ts';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

export function createAuth(db: Db, config: AppConfig) {
  const auth = betterAuth({
    appName: 'FJ-Tech',
    baseURL: config.appUrl,
    basePath: '/api/auth',
    secret: config.authSecret,
    trustedOrigins: [config.appUrl],
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      // Email verification is turned on once an email provider is connected (Phase 2).
      requireEmailVerification: false,
    },
    socialProviders: config.google ? { google: config.google } : {},
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days, rolling
      updateAge: 60 * 60 * 24,
    },
    advanced: {
      useSecureCookies: config.isProd,
      defaultCookieAttributes: { sameSite: 'lax', httpOnly: true, secure: config.isProd },
    },
    rateLimit: { enabled: !config.isTest, window: 60, max: 30 },
  });

  return {
    handler: toNodeHandler(auth),
    api: auth.api,
    async getSessionUser(headers: IncomingHttpHeaders): Promise<SessionUser | null> {
      const result = await auth.api.getSession({ headers: fromNodeHeaders(headers) });
      if (!result?.user) return null;
      return { id: result.user.id, email: result.user.email, name: result.user.name };
    },
  };
}

export type Auth = ReturnType<typeof createAuth>;
