// Conversations, messages and tool calls, persisted per conversation (plans/05 §3.5).
// Phase 1 supports test conversations from the dashboard; public widget conversations arrive in Phase 4.
import { and, asc, desc, eq } from 'drizzle-orm';
import { mostUrgent, type AgentConfig, type Priority, type listConversationsQuerySchema } from '@fj/shared';
import type { z } from 'zod';
import { withSystemTx, withWorkspaceTx, type Db, type Tx } from '../../db/client.ts';
import { actions, agentVersions, agents, conversations, messages, toolCalls, workspaces } from '../../db/schema.ts';
import { AppError, conflict, notFound } from '../../lib/errors.ts';
import { uuidv7 } from '../../lib/ids.ts';
import type { WorkspaceContext } from '../../http/context.ts';
import { createAction } from '../actions/actions.service.ts';
import { readProfile } from '../profile/profile.service.ts';
import {
  actionsFromTools,
  priorityOf,
  runLegacyTurn,
  toLegacyAgent,
  toLegacyTenant,
  type LegacySession,
} from './legacyBridge.ts';

const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

async function loadConversation(tx: Tx, ctx: WorkspaceContext, conversationId: string) {
  if (!isUuid(conversationId)) throw notFound('Conversation');
  const [c] = await tx
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.workspaceId, ctx.workspaceId)));
  if (!c) throw notFound('Conversation');
  return c;
}

export function createConversationsService(db: Db) {
  return {
    /** Starts a sandbox conversation against the agent's current draft. */
    async startTest(ctx: WorkspaceContext, agentId: string) {
      if (!isUuid(agentId)) throw notFound('Agent');
      return withWorkspaceTx(db, ctx.workspaceId, async (tx) => {
        const [agent] = await tx
          .select()
          .from(agents)
          .where(and(eq(agents.id, agentId), eq(agents.workspaceId, ctx.workspaceId)));
        if (!agent || agent.status === 'archived' || !agent.draftVersionId) throw notFound('Agent');
        const [draft] = await tx.select().from(agentVersions).where(eq(agentVersions.id, agent.draftVersionId));
        const config = draft!.config as AgentConfig;
        const id = uuidv7();
        await tx.insert(conversations).values({
          id,
          workspaceId: ctx.workspaceId,
          agentId,
          agentVersionId: draft!.id,
          isTest: true,
          startedBy: ctx.userId,
        });
        const greeting = config.persona.greeting || `Hello! How can I help you today?`;
        await tx.insert(messages).values({ id: uuidv7(), workspaceId: ctx.workspaceId, conversationId: id, role: 'agent', content: greeting });
        return this.detail(ctx, id, tx);
      });
    },

    async list(ctx: WorkspaceContext, query: z.output<typeof listConversationsQuerySchema>) {
      return withWorkspaceTx(db, ctx.workspaceId, (tx) => {
        const filters = [eq(conversations.workspaceId, ctx.workspaceId)];
        if (!query.includeTests) filters.push(eq(conversations.isTest, false));
        if (query.agentId) filters.push(eq(conversations.agentId, query.agentId));
        return tx
          .select({
            id: conversations.id,
            agentId: conversations.agentId,
            isTest: conversations.isTest,
            status: conversations.status,
            priority: conversations.priority,
            primaryIntent: conversations.primaryIntent,
            outcome: conversations.outcome,
            startedAt: conversations.startedAt,
            lastMessageAt: conversations.lastMessageAt,
          })
          .from(conversations)
          .where(and(...filters))
          .orderBy(desc(conversations.lastMessageAt))
          .limit(query.limit);
      });
    },

    async detail(ctx: WorkspaceContext, conversationId: string, existingTx?: Tx) {
      const run = async (tx: Tx) => {
        const c = await loadConversation(tx, ctx, conversationId);
        const msgs = await tx.select().from(messages).where(eq(messages.conversationId, c.id)).orderBy(asc(messages.createdAt), asc(messages.id));
        const calls = await tx.select().from(toolCalls).where(eq(toolCalls.conversationId, c.id)).orderBy(asc(toolCalls.createdAt));
        const acts = await tx.select().from(actions).where(eq(actions.conversationId, c.id)).orderBy(asc(actions.createdAt));
        const workflow = (c.state as LegacySession).activeWorkflow ?? null;
        return {
          id: c.id,
          agentId: c.agentId,
          agentVersionId: c.agentVersionId,
          isTest: c.isTest,
          status: c.status,
          priority: c.priority,
          primaryIntent: c.primaryIntent,
          workflow: workflow ? { type: workflow.type, state: workflow.state } : null,
          startedAt: c.startedAt,
          lastMessageAt: c.lastMessageAt,
          messages: msgs.map((m) => ({ id: m.id, role: m.role, content: m.content, intents: m.intents, latencyMs: m.latencyMs, createdAt: m.createdAt })),
          toolCalls: calls.map((t) => ({ id: t.id, tool: t.tool, status: t.status, createdAt: t.createdAt })),
          actions: acts.map((a) => ({ id: a.id, type: a.type, priority: a.priority, status: a.status, title: a.title })),
        };
      };
      return existingTx ? run(existingTx) : withWorkspaceTx(db, ctx.workspaceId, run);
    },

    /** A customer turn in a test conversation, run through the agent engine. */
    async sendTestMessage(ctx: WorkspaceContext, conversationId: string, text: string) {
      const [workspace] = await withSystemTx(db, (tx) => tx.select().from(workspaces).where(eq(workspaces.id, ctx.workspaceId)));
      return withWorkspaceTx(db, ctx.workspaceId, async (tx) => {
        const c = await loadConversation(tx, ctx, conversationId);
        if (!c.isTest) throw new AppError('CONFLICT', 'Operators can message customers once live takeover ships (Phase 3).');
        if (c.status === 'closed') throw conflict('This conversation is closed');
        const [version] = await tx.select().from(agentVersions).where(eq(agentVersions.id, c.agentVersionId));
        const [agent] = await tx.select().from(agents).where(eq(agents.id, c.agentId));
        const profile = await readProfile(tx, ctx.workspaceId);
        const tenant = toLegacyTenant(workspace!, profile);
        const legacyAgent = toLegacyAgent(agent!.id, agent!.name, version!.config as AgentConfig, profile);

        const { result, session, executions, latencyMs } = await runLegacyTurn({
          tenant,
          agent: legacyAgent,
          conversationId: c.id,
          state: c.state as LegacySession,
          text,
        });

        // Optimistic concurrency: two simultaneous messages must not overwrite each other's state.
        const priority: Priority = mostUrgent(c.priority as Priority, priorityOf(result));
        const updated = await tx
          .update(conversations)
          .set({
            state: session,
            stateVersion: c.stateVersion + 1,
            priority,
            primaryIntent: c.primaryIntent ?? result.intent,
            lastMessageAt: new Date(),
          })
          .where(and(eq(conversations.id, c.id), eq(conversations.stateVersion, c.stateVersion)))
          .returning({ id: conversations.id });
        if (updated.length === 0) throw conflict('The conversation changed while this message was processed. Please resend.');

        await tx.insert(messages).values({ id: uuidv7(), workspaceId: ctx.workspaceId, conversationId: c.id, role: 'customer', content: text });
        const agentMessageId = uuidv7();
        await tx.insert(messages).values({
          id: agentMessageId,
          workspaceId: ctx.workspaceId,
          conversationId: c.id,
          role: 'agent',
          content: result.reply,
          intents: [{ name: result.intent, confidence: result.confidence }],
          model: 'rules-v1',
          latencyMs,
        });
        for (const e of executions) {
          await tx.insert(toolCalls).values({
            id: uuidv7(),
            workspaceId: ctx.workspaceId,
            conversationId: c.id,
            messageId: agentMessageId,
            tool: e.toolName,
            input: e.input,
            status: e.result.status,
            output: e.result.data ?? null,
          });
        }
        const created = [];
        for (const a of actionsFromTools(executions, { workspaceId: ctx.workspaceId, conversationId: c.id, isTest: c.isTest })) {
          created.push(await createAction(tx, a));
        }

        return {
          reply: result.reply,
          intent: result.intent,
          priority: priorityOf(result),
          workflow: result.workflowState,
          suggestedActions: result.suggestedActions,
          actionsCreated: created.map((a) => ({ id: a.id, type: a.type, priority: a.priority, title: a.title })),
          latencyMs,
        };
      });
    },
  };
}

export type ConversationsService = ReturnType<typeof createConversationsService>;
