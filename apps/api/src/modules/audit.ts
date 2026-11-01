import { desc, eq } from 'drizzle-orm';
import { withSystemTx, type Db, type Executor } from '../db/client.ts';
import { auditLogs } from '../db/schema.ts';
import { uuidv7 } from '../lib/ids.ts';
import type { WorkspaceContext } from '../http/context.ts';

export function createAuditService(db: Db) {
  return {
    list: (ctx: WorkspaceContext, limit: number) =>
      withSystemTx(db, (tx) =>
        tx
          .select()
          .from(auditLogs)
          .where(eq(auditLogs.workspaceId, ctx.workspaceId))
          .orderBy(desc(auditLogs.createdAt))
          .limit(limit)
      ),
  };
}

export interface AuditEntry {
  organizationId: string;
  workspaceId?: string | null;
  actorUserId: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  data?: Record<string, unknown>;
}

/** Records a security-relevant change (plans/04 §7). Must run in system scope. */
export async function writeAudit(tx: Executor, entry: AuditEntry): Promise<void> {
  await tx.insert(auditLogs).values({
    id: uuidv7(),
    organizationId: entry.organizationId,
    workspaceId: entry.workspaceId ?? null,
    actorUserId: entry.actorUserId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId ?? null,
    data: entry.data ?? {},
  });
}
