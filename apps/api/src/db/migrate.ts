// `npm run db:migrate` — applies SQL migrations in drizzle/ (a release step for real Postgres).
import { loadConfig } from '../config/env.ts';
import { createDatabase } from './client.ts';

const config = loadConfig();
const database = await createDatabase(config.databaseUrl);
await database.migrate();
await database.close();
console.log(`Migrations applied (${database.kind}).`);
