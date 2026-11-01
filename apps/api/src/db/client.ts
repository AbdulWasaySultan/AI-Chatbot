// Database access. One Drizzle interface over two drivers:
//  - real Postgres (node-postgres) in production
//  - PGlite, an embedded Postgres, for local development and tests (no server needed)
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from 'drizzle-orm/pg-core';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import * as schema from './schema.ts';

export type Schema = typeof schema;
export type Db = PgDatabase<PgQueryResultHKT, Schema>;
export type Tx = PgTransaction<PgQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>;
/** Either the root database or an open transaction. */
export type Executor = Db | Tx;

export const APP_DB_ROLE = 'app_user';
const MIGRATIONS_DIR = path.resolve(import.meta.dirname, '..', '..', 'drizzle');

export interface Database {
  db: Db;
  kind: 'postgres' | 'pglite';
  migrate(): Promise<void>;
  close(): Promise<void>;
}

export async function createDatabase(url: string): Promise<Database> {
  if (url.startsWith('pglite://')) {
    const { PGlite } = await import('@electric-sql/pglite');
    const { drizzle } = await import('drizzle-orm/pglite');
    const { migrate } = await import('drizzle-orm/pglite/migrator');
    const target = url.slice('pglite://'.length);
    let client: InstanceType<typeof PGlite>;
    if (target === 'memory') {
      client = new PGlite();
    } else {
      mkdirSync(target, { recursive: true });
      client = new PGlite(target);
    }
    const db = drizzle(client, { schema }) as unknown as Db;
    return {
      db,
      kind: 'pglite',
      migrate: () => migrate(db as never, { migrationsFolder: MIGRATIONS_DIR }),
      close: () => client.close(),
    };
  }

  const { Pool } = await import('pg');
  const { drizzle } = await import('drizzle-orm/node-postgres');
  const { migrate } = await import('drizzle-orm/node-postgres/migrator');
  const pool = new Pool({ connectionString: url, max: 10 });
  const db = drizzle(pool, { schema }) as unknown as Db;
  return {
    db,
    kind: 'postgres',
    migrate: () => migrate(db as never, { migrationsFolder: MIGRATIONS_DIR }),
    close: () => pool.end(),
  };
}

/**
 * Runs `fn` in a transaction scoped to one workspace. Row-level security applies:
 * the transaction switches to the restricted app_user role and sets app.workspace_id,
 * so rows from any other workspace are invisible and cannot be written.
 */
export async function withWorkspaceTx<T>(
  db: Db,
  workspaceId: string,
  fn: (tx: Tx) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.workspace_id', ${workspaceId}, true)`);
    await tx.execute(sql.raw(`set local role ${APP_DB_ROLE}`));
    return fn(tx as Tx);
  });
}

/**
 * System scope: runs as the owning role, so RLS does not apply. Use only for tenancy tables
 * (organizations, memberships, workspaces), auth, seeding and cross-workspace jobs.
 */
export async function withSystemTx<T>(db: Db, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => fn(tx as Tx));
}
