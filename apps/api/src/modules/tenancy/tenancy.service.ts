// Organizations, workspaces, memberships and invitations (plans/01 §3, plans/06 §4).
// These are the tenancy tables themselves, so this module runs in system scope and does its
// own permission checks.
import { createHash } from 'node:crypto';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import {
  effectiveWorkspaceRole,
  type OrgRole,
  type WorkspaceRole,
  type createInvitationSchema,
  type createOrganizationSchema,
  type createWorkspaceSchema,
  type updateWorkspaceSchema,
} from '@fj/shared';
import type { z } from 'zod';
import { withSystemTx, withWorkspaceTx, type Db, type Executor } from '../../db/client.ts';
import {
  businessProfiles,
  invitations,
  memberships,
  organizations,
  user,
  workspaceMembers,
  workspaces,
} from '../../db/schema.ts';
import { AppError, conflict, forbidden, notFound } from '../../lib/errors.ts';
import { randomToken, uuidv7 } from '../../lib/ids.ts';
import type { WorkspaceContext } from '../../http/context.ts';
import { writeAudit } from '../audit.ts';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .slice(0, 48);
  return base || 'workspace';
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

async function orgRoleOf(tx: Executor, organizationId: string, userId: string): Promise<OrgRole | null> {
  const [row] = await tx
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.organizationId, organizationId), eq(memberships.userId, userId)));
  return (row?.role as OrgRole | undefined) ?? null;
}

function requireOrgAdmin(role: OrgRole | null) {
  if (role === null) throw notFound('Organization');
  if (role !== 'owner' && role !== 'admin') throw forbidden('Only organization owners and admins can do this');
}

async function uniqueSlug(tx: Executor, organizationId: string | null, name: string): Promise<string> {
  const base = slugify(name);
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const taken = organizationId
      ? await tx
          .select({ id: workspaces.id })
          .from(workspaces)
          .where(and(eq(workspaces.organizationId, organizationId), eq(workspaces.slug, candidate)))
      : await tx.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, candidate));
    if (taken.length === 0) return candidate;
  }
  return `${base}-${randomToken(4).toLowerCase()}`;
}

export function createTenancyService(db: Db) {
  return {
    async createOrganization(userId: string, input: z.output<typeof createOrganizationSchema>) {
      return withSystemTx(db, async (tx) => {
        const id = uuidv7();
        const slug = await uniqueSlug(tx, null, input.name);
        const [org] = await tx.insert(organizations).values({ id, name: input.name, slug, kind: input.kind }).returning();
        await tx.insert(memberships).values({ id: uuidv7(), organizationId: id, userId, role: 'owner' });
        await writeAudit(tx, { organizationId: id, actorUserId: userId, action: 'organization.created', targetType: 'organization', targetId: id });
        return { ...org!, role: 'owner' as OrgRole };
      });
    },

    async listOrganizations(userId: string) {
      return withSystemTx(db, (tx) =>
        tx
          .select({ id: organizations.id, name: organizations.name, slug: organizations.slug, kind: organizations.kind, role: memberships.role })
          .from(memberships)
          .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
          .where(eq(memberships.userId, userId))
      );
    },

    /** Workspaces the user can open, with their effective role in each. */
    async listWorkspacesForUser(userId: string, organizationId?: string) {
      return withSystemTx(db, async (tx) => {
        const orgRows = await tx
          .select({ organizationId: memberships.organizationId, role: memberships.role })
          .from(memberships)
          .where(eq(memberships.userId, userId));
        const orgRole = new Map(orgRows.map((r) => [r.organizationId, r.role as OrgRole]));
        const direct = await tx
          .select({ workspaceId: workspaceMembers.workspaceId, role: workspaceMembers.role })
          .from(workspaceMembers)
          .where(eq(workspaceMembers.userId, userId));
        const directRole = new Map(direct.map((r) => [r.workspaceId, r.role as WorkspaceRole]));
        const orgIds = [...orgRole.keys()];
        if (orgIds.length === 0) return [];
        const rows = await tx
          .select()
          .from(workspaces)
          .where(and(inArray(workspaces.organizationId, orgIds), isNull(workspaces.deletedAt)));
        return rows
          .filter((w) => !organizationId || w.organizationId === organizationId)
          .map((w) => ({
            id: w.id,
            organizationId: w.organizationId,
            name: w.name,
            slug: w.slug,
            industry: w.industry,
            timezone: w.timezone,
            status: w.status,
            role: effectiveWorkspaceRole(orgRole.get(w.organizationId) ?? null, directRole.get(w.id) ?? null),
          }))
          .filter((w) => w.role !== null);
      });
    },

    async createWorkspace(userId: string, organizationId: string, input: z.output<typeof createWorkspaceSchema>) {
      const ws = await withSystemTx(db, async (tx) => {
        requireOrgAdmin(await orgRoleOf(tx, organizationId, userId));
        const id = uuidv7();
        const slug = await uniqueSlug(tx, organizationId, input.name);
        const [row] = await tx
          .insert(workspaces)
          .values({ id, organizationId, name: input.name, slug, industry: input.industry, timezone: input.timezone, locale: input.locale })
          .returning();
        await writeAudit(tx, { organizationId, workspaceId: id, actorUserId: userId, action: 'workspace.created', targetType: 'workspace', targetId: id });
        return row!;
      });
      // Every workspace starts with an (empty) business profile; nothing is "verified" until filled in.
      await withWorkspaceTx(db, ws.id, (tx) =>
        tx.insert(businessProfiles).values({ workspaceId: ws.id, displayName: input.name, updatedBy: userId })
      );
      return { ...ws, role: 'admin' as WorkspaceRole };
    },

    /** Resolves the caller's access to a workspace. Returns null (→ 404) if they have none. */
    async resolveWorkspaceContext(userId: string, workspaceId: string): Promise<WorkspaceContext | null> {
      if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) return null;
      return withSystemTx(db, async (tx) => {
        const [ws] = await tx
          .select()
          .from(workspaces)
          .where(and(eq(workspaces.id, workspaceId), isNull(workspaces.deletedAt)));
        if (!ws) return null;
        const orgRole = await orgRoleOf(tx, ws.organizationId, userId);
        if (!orgRole) return null;
        const [direct] = await tx
          .select({ role: workspaceMembers.role })
          .from(workspaceMembers)
          .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)));
        const role = effectiveWorkspaceRole(orgRole, (direct?.role as WorkspaceRole | undefined) ?? null);
        if (!role) return null;
        return {
          organizationId: ws.organizationId,
          workspaceId: ws.id,
          workspaceName: ws.name,
          timezone: ws.timezone,
          userId,
          orgRole,
          role,
        };
      });
    },

    async getWorkspace(ctx: WorkspaceContext) {
      const [ws] = await withSystemTx(db, (tx) => tx.select().from(workspaces).where(eq(workspaces.id, ctx.workspaceId)));
      if (!ws) throw notFound('Workspace');
      return { id: ws.id, organizationId: ws.organizationId, name: ws.name, slug: ws.slug, industry: ws.industry, timezone: ws.timezone, locale: ws.locale, status: ws.status, role: ctx.role };
    },

    async updateWorkspace(ctx: WorkspaceContext, input: z.output<typeof updateWorkspaceSchema>) {
      return withSystemTx(db, async (tx) => {
        const [row] = await tx.update(workspaces).set(input).where(eq(workspaces.id, ctx.workspaceId)).returning();
        await writeAudit(tx, { organizationId: ctx.organizationId, workspaceId: ctx.workspaceId, actorUserId: ctx.userId, action: 'workspace.updated', targetType: 'workspace', targetId: ctx.workspaceId, data: input });
        return row!;
      });
    },

    async deleteWorkspace(ctx: WorkspaceContext) {
      await withSystemTx(db, async (tx) => {
        await tx.update(workspaces).set({ deletedAt: new Date(), status: 'archived' }).where(eq(workspaces.id, ctx.workspaceId));
        await writeAudit(tx, { organizationId: ctx.organizationId, workspaceId: ctx.workspaceId, actorUserId: ctx.userId, action: 'workspace.deleted', targetType: 'workspace', targetId: ctx.workspaceId });
      });
    },

    // ---------- Members ----------

    async listOrgMembers(userId: string, organizationId: string) {
      return withSystemTx(db, async (tx) => {
        if (!(await orgRoleOf(tx, organizationId, userId))) throw notFound('Organization');
        return tx
          .select({ userId: user.id, name: user.name, email: user.email, role: memberships.role })
          .from(memberships)
          .innerJoin(user, eq(user.id, memberships.userId))
          .where(eq(memberships.organizationId, organizationId));
      });
    },

    async listWorkspaceMembers(ctx: WorkspaceContext) {
      return withSystemTx(db, async (tx) => {
        const orgMembers = await tx
          .select({ userId: user.id, name: user.name, email: user.email, orgRole: memberships.role })
          .from(memberships)
          .innerJoin(user, eq(user.id, memberships.userId))
          .where(eq(memberships.organizationId, ctx.organizationId));
        const direct = await tx
          .select({ userId: workspaceMembers.userId, role: workspaceMembers.role })
          .from(workspaceMembers)
          .where(eq(workspaceMembers.workspaceId, ctx.workspaceId));
        const directRole = new Map(direct.map((d) => [d.userId, d.role as WorkspaceRole]));
        return orgMembers
          .map((m) => ({ ...m, role: effectiveWorkspaceRole(m.orgRole as OrgRole, directRole.get(m.userId) ?? null) }))
          .filter((m) => m.role !== null);
      });
    },

    async setWorkspaceMemberRole(ctx: WorkspaceContext, targetUserId: string, role: WorkspaceRole) {
      await withSystemTx(db, async (tx) => {
        const targetOrgRole = await orgRoleOf(tx, ctx.organizationId, targetUserId);
        if (!targetOrgRole) throw notFound('Member');
        if (targetOrgRole !== 'member') throw conflict('Organization owners and admins already have admin access to every workspace');
        await tx
          .insert(workspaceMembers)
          .values({ id: uuidv7(), workspaceId: ctx.workspaceId, userId: targetUserId, role })
          .onConflictDoUpdate({ target: [workspaceMembers.workspaceId, workspaceMembers.userId], set: { role } });
        await writeAudit(tx, { organizationId: ctx.organizationId, workspaceId: ctx.workspaceId, actorUserId: ctx.userId, action: 'workspace.member_role_set', targetType: 'user', targetId: targetUserId, data: { role } });
      });
    },

    async removeWorkspaceMember(ctx: WorkspaceContext, targetUserId: string) {
      await withSystemTx(db, async (tx) => {
        const deleted = await tx
          .delete(workspaceMembers)
          .where(and(eq(workspaceMembers.workspaceId, ctx.workspaceId), eq(workspaceMembers.userId, targetUserId)))
          .returning({ id: workspaceMembers.id });
        if (deleted.length === 0) throw notFound('Member');
        await writeAudit(tx, { organizationId: ctx.organizationId, workspaceId: ctx.workspaceId, actorUserId: ctx.userId, action: 'workspace.member_removed', targetType: 'user', targetId: targetUserId });
      });
    },

    // ---------- Invitations ----------
    // Until an email provider is connected (Phase 2) the API returns the invite link so an
    // admin can share it themselves.

    async createInvitation(userId: string, organizationId: string, input: z.output<typeof createInvitationSchema>) {
      return withSystemTx(db, async (tx) => {
        requireOrgAdmin(await orgRoleOf(tx, organizationId, userId));
        if (input.workspaceId) {
          const [ws] = await tx
            .select({ id: workspaces.id })
            .from(workspaces)
            .where(and(eq(workspaces.id, input.workspaceId), eq(workspaces.organizationId, organizationId)));
          if (!ws) throw notFound('Workspace');
        }
        const token = randomToken();
        const id = uuidv7();
        await tx.insert(invitations).values({
          id,
          organizationId,
          workspaceId: input.workspaceId ?? null,
          email: input.email.toLowerCase(),
          orgRole: input.orgRole,
          workspaceRole: input.workspaceRole ?? null,
          tokenHash: hashToken(token),
          invitedBy: userId,
          expiresAt: new Date(Date.now() + INVITE_TTL_MS),
        });
        await writeAudit(tx, { organizationId, workspaceId: input.workspaceId, actorUserId: userId, action: 'invitation.created', targetType: 'invitation', targetId: id, data: { orgRole: input.orgRole, workspaceRole: input.workspaceRole } });
        return { id, token, expiresAt: new Date(Date.now() + INVITE_TTL_MS) };
      });
    },

    async acceptInvitation(sessionUser: { id: string; email: string }, token: string) {
      return withSystemTx(db, async (tx) => {
        const [invite] = await tx.select().from(invitations).where(eq(invitations.tokenHash, hashToken(token)));
        if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) throw notFound('Invitation');
        if (invite.email !== sessionUser.email.toLowerCase()) {
          throw new AppError('FORBIDDEN', 'This invitation was sent to a different email address');
        }
        await tx
          .insert(memberships)
          .values({ id: uuidv7(), organizationId: invite.organizationId, userId: sessionUser.id, role: invite.orgRole })
          .onConflictDoNothing();
        if (invite.workspaceId && invite.workspaceRole) {
          await tx
            .insert(workspaceMembers)
            .values({ id: uuidv7(), workspaceId: invite.workspaceId, userId: sessionUser.id, role: invite.workspaceRole })
            .onConflictDoUpdate({ target: [workspaceMembers.workspaceId, workspaceMembers.userId], set: { role: invite.workspaceRole } });
        }
        await tx.update(invitations).set({ acceptedAt: new Date() }).where(eq(invitations.id, invite.id));
        await writeAudit(tx, { organizationId: invite.organizationId, workspaceId: invite.workspaceId, actorUserId: sessionUser.id, action: 'invitation.accepted', targetType: 'invitation', targetId: invite.id });
        return { organizationId: invite.organizationId, workspaceId: invite.workspaceId };
      });
    },
  };
}

export type TenancyService = ReturnType<typeof createTenancyService>;
