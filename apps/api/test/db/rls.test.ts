// Row-level security proves isolation even if application code forgets a workspace filter
// (plans/03 Verification, plans/12 §4 "RLS-only build").
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { createDatabase, withSystemTx, withWorkspaceTx, type Database } from '../../src/db/client.ts';
import * as s from '../../src/db/schema.ts';
import { uuidv7 } from '../../src/lib/ids.ts';

let database: Database;
const org = uuidv7();
const wsA = uuidv7();
const wsB = uuidv7();

beforeAll(async () => {
  database = await createDatabase('pglite://memory');
  await database.migrate();
  await withSystemTx(database.db, async (tx) => {
    await tx.insert(s.organizations).values({ id: org, name: 'Org', slug: 'org' });
    await tx.insert(s.workspaces).values([
      { id: wsA, organizationId: org, name: 'A', slug: 'a' },
      { id: wsB, organizationId: org, name: 'B', slug: 'b' },
    ]);
  });
  for (const [ws, title] of [
    [wsA, 'policy-a'],
    [wsB, 'policy-b'],
  ] as const) {
    await withWorkspaceTx(database.db, ws, (tx) =>
      tx.insert(s.policies).values({ id: uuidv7(), workspaceId: ws, topic: 'custom', title, body: 'x' })
    );
  }
});

afterAll(() => database.close());

describe('row-level security', () => {
  it('runs tenant queries as the restricted role', async () => {
    const res = await withWorkspaceTx(database.db, wsA, (tx) => tx.execute(sql`select current_user as u`));
    const rows = (res as unknown as { rows: { u: string }[] }).rows;
    expect(rows[0]?.u).toBe('app_user');
  });

  it('shows a workspace only its own rows, even without a filter', async () => {
    const rows = await withWorkspaceTx(database.db, wsA, (tx) => tx.select().from(s.policies));
    expect(rows.map((r) => r.title)).toEqual(['policy-a']);
  });

  it("returns nothing when asking for another workspace's rows", async () => {
    const rows = await withWorkspaceTx(database.db, wsA, (tx) =>
      tx.select().from(s.policies).where(eq(s.policies.workspaceId, wsB))
    );
    expect(rows).toHaveLength(0);
  });

  it('blocks writing rows into another workspace', async () => {
    await expect(
      withWorkspaceTx(database.db, wsA, (tx) =>
        tx.insert(s.policies).values({ id: uuidv7(), workspaceId: wsB, topic: 'custom', title: 'x', body: 'x' })
      )
    ).rejects.toThrow();
  });

  it('blocks updating rows of another workspace (silently matches nothing)', async () => {
    await withWorkspaceTx(database.db, wsA, (tx) => tx.update(s.policies).set({ title: 'hacked' }));
    const rows = await withSystemTx(database.db, (tx) => tx.select().from(s.policies));
    expect(rows.map((r) => r.title).sort()).toEqual(['hacked', 'policy-b']);
  });

  it('denies access to tenancy tables from tenant scope', async () => {
    await expect(
      withWorkspaceTx(database.db, wsA, (tx) => tx.select().from(s.workspaces))
    ).rejects.toThrow();
  });

  it('sees nothing when no workspace is set', async () => {
    const rows = await database.db.transaction(async (tx) => {
      await tx.execute(sql`set local role app_user`);
      return tx.select().from(s.policies);
    });
    expect(rows).toHaveLength(0);
  });

  it('covers every tenant table with a policy', async () => {
    const res = await withSystemTx(database.db, (tx) =>
      tx.execute(sql`select tablename from pg_policies where schemaname = 'public'`)
    );
    const withPolicy = new Set((res as unknown as { rows: { tablename: string }[] }).rows.map((r) => r.tablename));
    for (const table of s.TENANT_TABLES) expect(withPolicy.has(table), table).toBe(true);
  });
});
