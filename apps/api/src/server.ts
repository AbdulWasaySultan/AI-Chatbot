// API entry point: `npm run dev -w @fj/api` (watch) or `npm run start -w @fj/api`.
import { loadConfig } from './config/env.ts';
import { createDatabase } from './db/client.ts';
import { createLogger } from './lib/logger.ts';
import { createApp } from './app.ts';
import { seedDemoData, isEmpty } from './db/seed.ts';

const config = loadConfig();
const logger = createLogger(config.logLevel);
const database = await createDatabase(config.databaseUrl);

// Migrations run automatically for the embedded development database. For a real Postgres
// server they are a release step: `npm run db:migrate`.
if (database.kind === 'pglite') {
  await database.migrate();
  if (await isEmpty(database.db)) {
    const demo = await seedDemoData(database.db, config);
    logger.info({ email: demo.email }, 'Seeded demo data. Sign in with the demo account (password in apps/api/src/db/seed.ts).');
  }
}

const { app } = createApp({ config, db: database.db, logger });
const server = app.listen(config.port, () => {
  logger.info(`API listening on http://localhost:${config.port}/api (database: ${database.kind})`);
});

const shutdown = async (signal: string) => {
  logger.info({ signal }, 'shutting down');
  server.close();
  await database.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
