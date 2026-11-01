// Express app factory. No listen() here so tests can mount it directly.
import { createRequire } from 'node:module';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { AppConfig } from './config/env.ts';
import type { Db } from './db/client.ts';
import type { Logger } from './lib/logger.ts';
import { createAuth, type Auth } from './auth/auth.ts';
import { errorHandler, loadSession, notFoundHandler, rateLimit, requestId } from './http/middleware.ts';
import { buildV1Router } from './http/routes.ts';
import { createAuditService } from './modules/audit.ts';
import { createTenancyService } from './modules/tenancy/tenancy.service.ts';
import { createProfileService } from './modules/profile/profile.service.ts';
import { createAgentsService } from './modules/agents/agents.service.ts';
import { createActionsService } from './modules/actions/actions.service.ts';
import { createConversationsService } from './modules/conversations/conversations.service.ts';

export function createServices(db: Db) {
  const tenancy = createTenancyService(db);
  return {
    tenancy,
    profile: createProfileService(db),
    agents: createAgentsService(db),
    actions: createActionsService(db, tenancy),
    conversations: createConversationsService(db),
    audit: createAuditService(db),
  };
}
export type Services = ReturnType<typeof createServices>;

export interface AppDeps {
  config: AppConfig;
  db: Db;
  logger: Logger;
  auth?: Auth;
}

export function createApp({ config, db, logger, auth = createAuth(db, config) }: AppDeps): { app: Express; auth: Auth; services: Services } {
  const app = express();
  const services = createServices(db);

  app.disable('x-powered-by');
  app.set('trust proxy', 1); // behind the Next.js rewrite / a load balancer
  app.use(requestId);
  app.use(helmet());
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as express.Request).id,
      customProps: (req) => ({ userId: (req as express.Request).user?.id, workspaceId: (req as express.Request).workspace?.workspaceId }),
      autoLogging: { ignore: (req) => req.url === '/api/health' },
    })
  );

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Better Auth reads the raw body itself, so it is mounted before the JSON parser.
  const authLimit = rateLimit({ windowMs: 60_000, max: config.isTest ? 1000 : 20, key: (req) => `auth:${req.ip}` });
  app.all('/api/auth/{*path}', authLimit, auth.handler);

  app.use(express.json({ limit: '256kb' }));
  app.use(loadSession(auth));
  app.use(
    '/api/v1',
    rateLimit({ windowMs: 60_000, max: config.isTest ? 10_000 : 600, key: (req) => `v1:${req.user?.id ?? req.ip}` }),
    buildV1Router(services)
  );

  // In-memory demo endpoints the current dashboard still uses. Unauthenticated, so they are
  // disabled in production; removed when the dashboard moves to /api/v1 (Phase 3).
  if (config.legacyDemoApi) {
    const require = createRequire(import.meta.url);
    const legacyApp = require('./legacy/server.js') as express.Express;
    app.use(legacyApp);
  }

  app.use('/api', notFoundHandler);
  app.use(errorHandler(logger));
  return { app, auth, services };
}
