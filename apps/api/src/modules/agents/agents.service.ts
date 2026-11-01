// Agents and their versions (plans/05 §3.3, plans/11 §5.4).
// Each agent has one editable draft. Publishing freezes the draft as an immutable version and
// opens a new draft; rollback republishes an earlier version's configuration as a new version.
import { and, desc, eq, ne } from 'drizzle-orm';
import {
  agentConfigSchema,
  type AgentConfig,
  type AgentConfigPatch,
  type createAgentSchema,
  type updateAgentSchema,
} from '@fj/shared';
import type { z } from 'zod';
import { withSystemTx, withWorkspaceTx, type Db, type Tx } from '../../db/client.ts';
import { agentVersions, agents } from '../../db/schema.ts';
import { AppError, conflict, notFound } from '../../lib/errors.ts';
import { uuidv7 } from '../../lib/ids.ts';
import type { WorkspaceContext } from '../../http/context.ts';
import { writeAudit } from '../audit.ts';

export const defaultAgentConfig = (): AgentConfig => agentConfigSchema.parse({ persona: {} });

function mergeConfig(base: AgentConfig, patch: AgentConfigPatch | undefined): AgentConfig {
  if (!patch) return base;
  return agentConfigSchema.parse({
    ...base,
    ...patch,
    persona: { ...base.persona, ...(patch.persona ?? {}) },
    guardrails: { ...base.guardrails, ...(patch.guardrails ?? {}) },
    webResearch: { ...base.webResearch, ...(patch.webResearch ?? {}) },
    knowledgeScope: { ...base.knowledgeScope, ...(patch.knowledgeScope ?? {}) },
  });
}

/** Problems that block publishing. The UI shows these as a checklist. */
export function publishProblems(config: AgentConfig): string[] {
  const problems: string[] = [];
  if (!config.persona.displayName) problems.push('Give the agent a name customers will see.');
  if (!config.persona.greeting) problems.push('Write a greeting.');
  if (!config.instructions && !config.persona.role) problems.push('Describe what the agent should do.');
  return problems;
}

async function loadAgent(tx: Tx, ctx: WorkspaceContext, agentId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(agentId)) throw notFound('Agent');
  const [agent] = await tx
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.workspaceId, ctx.workspaceId), ne(agents.status, 'archived')));
  if (!agent) throw notFound('Agent');
  return agent;
}

async function loadVersion(tx: Tx, versionId: string | null) {
  if (!versionId) return null;
  const [v] = await tx.select().from(agentVersions).where(eq(agentVersions.id, versionId));
  return v ?? null;
}

function present(agent: typeof agents.$inferSelect, draft: typeof agentVersions.$inferSelect | null, published: typeof agentVersions.$inferSelect | null) {
  return {
    id: agent.id,
    name: agent.name,
    status: agent.status,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
    draft: draft ? { versionId: draft.id, version: draft.version, config: draft.config as AgentConfig } : null,
    published: published
      ? { versionId: published.id, version: published.version, publishedAt: published.publishedAt, config: published.config as AgentConfig }
      : null,
    hasUnpublishedChanges: !published || JSON.stringify(draft?.config) !== JSON.stringify(published.config),
  };
}

export function createAgentsService(db: Db) {
  const audit = (ctx: WorkspaceContext, action: string, targetId: string, data?: Record<string, unknown>) =>
    withSystemTx(db, (tx) =>
      writeAudit(tx, { organizationId: ctx.organizationId, workspaceId: ctx.workspaceId, actorUserId: ctx.userId, action, targetType: 'agent', targetId, data })
    );

  return {
    async list(ctx: WorkspaceContext) {
      return withWorkspaceTx(db, ctx.workspaceId, async (tx) => {
        const rows = await tx
          .select()
          .from(agents)
          .where(and(eq(agents.workspaceId, ctx.workspaceId), ne(agents.status, 'archived')))
          .orderBy(desc(agents.createdAt));
        return Promise.all(
          rows.map(async (a) => present(a, await loadVersion(tx, a.draftVersionId), await loadVersion(tx, a.publishedVersionId)))
        );
      });
    },

    async get(ctx: WorkspaceContext, agentId: string) {
      return withWorkspaceTx(db, ctx.workspaceId, async (tx) => {
        const a = await loadAgent(tx, ctx, agentId);
        return present(a, await loadVersion(tx, a.draftVersionId), await loadVersion(tx, a.publishedVersionId));
      });
    },

    async create(ctx: WorkspaceContext, input: z.output<typeof createAgentSchema>) {
      const result = await withWorkspaceTx(db, ctx.workspaceId, async (tx) => {
        const agentId = uuidv7();
        const versionId = uuidv7();
        const config = mergeConfig(defaultAgentConfig(), input.config);
        await tx.insert(agents).values({ id: agentId, workspaceId: ctx.workspaceId, name: input.name, createdBy: ctx.userId });
        await tx.insert(agentVersions).values({ id: versionId, workspaceId: ctx.workspaceId, agentId, version: 1, state: 'draft', config });
        await tx.update(agents).set({ draftVersionId: versionId }).where(eq(agents.id, agentId));
        const a = await loadAgent(tx, ctx, agentId);
        return present(a, await loadVersion(tx, versionId), null);
      });
      await audit(ctx, 'agent.created', result.id);
      return result;
    },

    async update(ctx: WorkspaceContext, agentId: string, input: z.output<typeof updateAgentSchema>) {
      return withWorkspaceTx(db, ctx.workspaceId, async (tx) => {
        const a = await loadAgent(tx, ctx, agentId);
        const draft = await loadVersion(tx, a.draftVersionId);
        if (!draft) throw new AppError('INTERNAL', 'Agent has no draft version');
        if (input.config) {
          const config = mergeConfig(draft.config as AgentConfig, input.config);
          await tx.update(agentVersions).set({ config }).where(eq(agentVersions.id, draft.id));
        }
        if (input.name) await tx.update(agents).set({ name: input.name }).where(eq(agents.id, a.id));
        const fresh = await loadAgent(tx, ctx, agentId);
        return present(fresh, await loadVersion(tx, fresh.draftVersionId), await loadVersion(tx, fresh.publishedVersionId));
      });
    },

    async archive(ctx: WorkspaceContext, agentId: string) {
      await withWorkspaceTx(db, ctx.workspaceId, async (tx) => {
        const a = await loadAgent(tx, ctx, agentId);
        await tx.update(agents).set({ status: 'archived' }).where(eq(agents.id, a.id));
      });
      await audit(ctx, 'agent.archived', agentId);
    },

    async versions(ctx: WorkspaceContext, agentId: string) {
      return withWorkspaceTx(db, ctx.workspaceId, async (tx) => {
        await loadAgent(tx, ctx, agentId);
        return tx
          .select({
            id: agentVersions.id,
            version: agentVersions.version,
            state: agentVersions.state,
            notes: agentVersions.notes,
            publishedAt: agentVersions.publishedAt,
            publishedBy: agentVersions.publishedBy,
            createdAt: agentVersions.createdAt,
          })
          .from(agentVersions)
          .where(eq(agentVersions.agentId, agentId))
          .orderBy(desc(agentVersions.version));
      });
    },

    async publish(ctx: WorkspaceContext, agentId: string, notes: string) {
      const result = await withWorkspaceTx(db, ctx.workspaceId, async (tx) => {
        const a = await loadAgent(tx, ctx, agentId);
        const draft = await loadVersion(tx, a.draftVersionId);
        if (!draft) throw new AppError('INTERNAL', 'Agent has no draft version');
        const config = agentConfigSchema.parse(draft.config);
        const problems = publishProblems(config);
        if (problems.length) throw new AppError('VALIDATION_FAILED', 'This agent is not ready to publish', problems.map((message) => ({ path: 'config', message })));

        if (a.publishedVersionId) {
          await tx.update(agentVersions).set({ state: 'superseded' }).where(eq(agentVersions.id, a.publishedVersionId));
        }
        await tx
          .update(agentVersions)
          .set({ state: 'published', notes, publishedAt: new Date(), publishedBy: ctx.userId })
          .where(eq(agentVersions.id, draft.id));
        const nextDraftId = uuidv7();
        await tx.insert(agentVersions).values({
          id: nextDraftId,
          workspaceId: ctx.workspaceId,
          agentId,
          version: draft.version + 1,
          state: 'draft',
          config,
        });
        await tx
          .update(agents)
          .set({ publishedVersionId: draft.id, draftVersionId: nextDraftId, status: a.status === 'paused' ? 'paused' : 'live' })
          .where(eq(agents.id, agentId));
        const fresh = await loadAgent(tx, ctx, agentId);
        return present(fresh, await loadVersion(tx, nextDraftId), await loadVersion(tx, draft.id));
      });
      await audit(ctx, 'agent.published', agentId, { version: result.published?.version });
      return result;
    },

    async rollback(ctx: WorkspaceContext, agentId: string, versionId: string) {
      const result = await withWorkspaceTx(db, ctx.workspaceId, async (tx) => {
        const a = await loadAgent(tx, ctx, agentId);
        const target = await loadVersion(tx, versionId);
        if (!target || target.agentId !== agentId) throw notFound('Version');
        if (target.state === 'draft') throw conflict('Only published versions can be restored');
        if (target.id === a.publishedVersionId) throw conflict('That version is already live');
        const draft = await loadVersion(tx, a.draftVersionId);
        const nextVersion = (draft?.version ?? target.version) + 1;
        // The restored config becomes a new published version, so history stays append-only.
        const restoredId = uuidv7();
        if (a.publishedVersionId) {
          await tx.update(agentVersions).set({ state: 'superseded' }).where(eq(agentVersions.id, a.publishedVersionId));
        }
        if (draft) await tx.update(agentVersions).set({ version: nextVersion + 1, config: target.config }).where(eq(agentVersions.id, draft.id));
        await tx.insert(agentVersions).values({
          id: restoredId,
          workspaceId: ctx.workspaceId,
          agentId,
          version: nextVersion,
          state: 'published',
          config: target.config,
          notes: `Restored from version ${target.version}`,
          publishedAt: new Date(),
          publishedBy: ctx.userId,
        });
        await tx.update(agents).set({ publishedVersionId: restoredId }).where(eq(agents.id, agentId));
        const fresh = await loadAgent(tx, ctx, agentId);
        return present(fresh, await loadVersion(tx, fresh.draftVersionId), await loadVersion(tx, restoredId));
      });
      await audit(ctx, 'agent.rolled_back', agentId, { toVersionId: versionId });
      return result;
    },
  };
}

export type AgentsService = ReturnType<typeof createAgentsService>;
