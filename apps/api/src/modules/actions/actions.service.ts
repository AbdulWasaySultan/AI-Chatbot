// The Action Queue: every request an agent cannot finish on its own becomes a visible,
// assignable record (plans/09 §3). This is what makes "we've recorded your request" true.
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { ActionStatus, ActionType, Priority, listActionsQuerySchema, updateActionSchema } from '@fj/shared';
import type { z } from 'zod';
import { withWorkspaceTx, type Db, type Executor } from '../../db/client.ts';
import { actionEvents, actions } from '../../db/schema.ts';
import { AppError, notFound } from '../../lib/errors.ts';
import { uuidv7 } from '../../lib/ids.ts';
import type { WorkspaceContext } from '../../http/context.ts';
import type { TenancyService } from '../tenancy/tenancy.service.ts';

export interface NewAction {
  workspaceId: string;
  conversationId?: string | null;
  type: ActionType;
  priority: Priority;
  title: string;
  payload?: Record<string, unknown>;
  isTest?: boolean;
}

/** Creates an action inside an existing workspace transaction. */
export async function createAction(tx: Executor, input: NewAction) {
  const id = uuidv7();
  const [row] = await tx
    .insert(actions)
    .values({
      id,
      workspaceId: input.workspaceId,
      conversationId: input.conversationId ?? null,
      type: input.type,
      priority: input.priority,
      title: input.title,
      payload: input.payload ?? {},
      isTest: input.isTest ?? false,
    })
    .returning();
  await tx.insert(actionEvents).values({ id: uuidv7(), workspaceId: input.workspaceId, actionId: id, kind: 'created', data: {} });
  return row!;
}

export function createActionsService(db: Db, tenancy: TenancyService) {
  return {
    async list(ctx: WorkspaceContext, query: z.output<typeof listActionsQuerySchema>) {
      return withWorkspaceTx(db, ctx.workspaceId, (tx) => {
        const filters = [eq(actions.workspaceId, ctx.workspaceId)];
        if (query.status) filters.push(eq(actions.status, query.status));
        if (query.type) filters.push(eq(actions.type, query.type));
        if (query.priority) filters.push(eq(actions.priority, query.priority));
        if (!query.includeTests) filters.push(eq(actions.isTest, false));
        // Most urgent first, then oldest first within a priority.
        return tx
          .select()
          .from(actions)
          .where(and(...filters))
          .orderBy(asc(actions.priority), asc(actions.createdAt))
          .limit(query.limit);
      });
    },

    async get(ctx: WorkspaceContext, actionId: string) {
      if (!/^[0-9a-f-]{36}$/i.test(actionId)) throw notFound('Action');
      return withWorkspaceTx(db, ctx.workspaceId, async (tx) => {
        const [action] = await tx
          .select()
          .from(actions)
          .where(and(eq(actions.id, actionId), eq(actions.workspaceId, ctx.workspaceId)));
        if (!action) throw notFound('Action');
        const events = await tx
          .select()
          .from(actionEvents)
          .where(eq(actionEvents.actionId, actionId))
          .orderBy(desc(actionEvents.createdAt));
        return { ...action, events };
      });
    },

    async update(ctx: WorkspaceContext, actionId: string, input: z.output<typeof updateActionSchema>) {
      if (input.assigneeUserId) {
        const members = await tenancy.listWorkspaceMembers(ctx);
        if (!members.some((m) => m.userId === input.assigneeUserId)) {
          throw new AppError('VALIDATION_FAILED', 'The assignee is not a member of this workspace', [
            { path: 'assigneeUserId', message: 'Not a workspace member' },
          ]);
        }
      }
      await withWorkspaceTx(db, ctx.workspaceId, async (tx) => {
        const [action] = await tx
          .select()
          .from(actions)
          .where(and(eq(actions.id, actionId), eq(actions.workspaceId, ctx.workspaceId)));
        if (!action) throw notFound('Action');
        const now = new Date();
        const patch: Partial<typeof actions.$inferInsert> = {};
        if (input.status && input.status !== action.status) {
          patch.status = input.status;
          if (!action.acknowledgedAt && input.status !== 'new') patch.acknowledgedAt = now;
          if (['done', 'cancelled', 'failed'].includes(input.status)) patch.completedAt = now;
          if (input.status === 'new' || input.status === 'in_progress') patch.completedAt = null;
          await tx.insert(actionEvents).values({
            id: uuidv7(),
            workspaceId: ctx.workspaceId,
            actionId,
            kind: 'status_changed',
            actorUserId: ctx.userId,
            data: { from: action.status, to: input.status as ActionStatus },
          });
        }
        if (input.assigneeUserId !== undefined && input.assigneeUserId !== action.assigneeUserId) {
          patch.assigneeUserId = input.assigneeUserId;
          if (!action.acknowledgedAt) patch.acknowledgedAt = now;
          await tx.insert(actionEvents).values({
            id: uuidv7(),
            workspaceId: ctx.workspaceId,
            actionId,
            kind: 'assigned',
            actorUserId: ctx.userId,
            data: { assigneeUserId: input.assigneeUserId },
          });
        }
        if (input.note) {
          await tx.insert(actionEvents).values({
            id: uuidv7(),
            workspaceId: ctx.workspaceId,
            actionId,
            kind: 'note',
            actorUserId: ctx.userId,
            data: { note: input.note },
          });
        }
        if (Object.keys(patch).length) await tx.update(actions).set(patch).where(eq(actions.id, actionId));
      });
      return this.get(ctx, actionId);
    },

    /** Open P0/P1 counts for the navigation badge. */
    async openUrgentCount(ctx: WorkspaceContext) {
      const [row] = await withWorkspaceTx(db, ctx.workspaceId, (tx) =>
        tx
          .select({ n: sql<number>`count(*)::int` })
          .from(actions)
          .where(
            and(
              eq(actions.workspaceId, ctx.workspaceId),
              sql`${actions.status} in ('new', 'in_progress')`,
              sql`${actions.priority} in ('P0', 'P1')`,
              eq(actions.isTest, false)
            )
          )
      );
      return row?.n ?? 0;
    },
  };
}

export type ActionsService = ReturnType<typeof createActionsService>;
