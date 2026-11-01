// /api/v1 routes (plans/04-backend-architecture.md §5). Handlers only parse input, call a
// service and shape the response; permissions are declared per route.
import { Router, type RequestHandler } from 'express';
import {
  businessProfileSchema,
  createAgentSchema,
  createInvitationSchema,
  createOrganizationSchema,
  createWorkspaceSchema,
  listActionsQuerySchema,
  listConversationsQuerySchema,
  publishAgentSchema,
  rollbackAgentSchema,
  sendMessageSchema,
  setWorkspaceMemberSchema,
  updateActionSchema,
  updateAgentSchema,
  updateWorkspaceSchema,
} from '@fj/shared';
import { z } from 'zod';
import { notFound } from '../lib/errors.ts';
import type { Services } from '../app.ts';
import { authorize, parse, rateLimit, requireUser } from './middleware.ts';
import './context.ts';

const param = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0]! : (value ?? ''));

export function buildV1Router(services: Services): Router {
  const { tenancy, profile, agents, actions, conversations } = services;
  const v1 = Router();
  v1.use(requireUser);

  // ---------------------------------------------------------------- Me & organizations
  v1.get('/me', async (req, res) => {
    const [orgs, workspaces] = await Promise.all([
      tenancy.listOrganizations(req.user!.id),
      tenancy.listWorkspacesForUser(req.user!.id),
    ]);
    res.json({ user: req.user, organizations: orgs, workspaces });
  });

  v1.post('/orgs', async (req, res) => {
    const input = parse(createOrganizationSchema, req.body);
    res.status(201).json(await tenancy.createOrganization(req.user!.id, input));
  });

  v1.get('/orgs/:orgId/workspaces', async (req, res) => {
    res.json(await tenancy.listWorkspacesForUser(req.user!.id, param(req.params.orgId)));
  });

  v1.post('/orgs/:orgId/workspaces', async (req, res) => {
    const input = parse(createWorkspaceSchema, req.body);
    res.status(201).json(await tenancy.createWorkspace(req.user!.id, param(req.params.orgId), input));
  });

  v1.get('/orgs/:orgId/members', async (req, res) => {
    res.json(await tenancy.listOrgMembers(req.user!.id, param(req.params.orgId)));
  });

  v1.post('/orgs/:orgId/invitations', async (req, res) => {
    const input = parse(createInvitationSchema, req.body);
    const invite = await tenancy.createInvitation(req.user!.id, param(req.params.orgId), input);
    res.status(201).json({ id: invite.id, expiresAt: invite.expiresAt, acceptPath: `/invite/${invite.token}`, token: invite.token });
  });

  v1.post('/invitations/:token/accept', async (req, res) => {
    res.json(await tenancy.acceptInvitation(req.user!, param(req.params.token)));
  });

  // ---------------------------------------------------------------- Workspace scope
  const ws = Router({ mergeParams: true });
  const loadWorkspace: RequestHandler = async (req, _res, next) => {
    const ctx = await tenancy.resolveWorkspaceContext(req.user!.id, param(req.params.workspaceId));
    // Never reveal whether a workspace exists to someone without access.
    if (!ctx) throw notFound('Workspace');
    req.workspace = ctx;
    next();
  };
  v1.use('/workspaces/:workspaceId', loadWorkspace, ws);
  const ctx = (req: Parameters<RequestHandler>[0]) => req.workspace!;

  ws.get('/', authorize('workspace:read'), async (req, res) => {
    res.json(await tenancy.getWorkspace(ctx(req)));
  });
  ws.patch('/', authorize('workspace:update'), async (req, res) => {
    res.json(await tenancy.updateWorkspace(ctx(req), parse(updateWorkspaceSchema, req.body)));
  });
  ws.delete('/', authorize('workspace:delete'), async (req, res) => {
    await tenancy.deleteWorkspace(ctx(req));
    res.status(204).end();
  });

  // Members
  ws.get('/members', authorize('members:read'), async (req, res) => {
    res.json(await tenancy.listWorkspaceMembers(ctx(req)));
  });
  ws.put('/members/:userId', authorize('members:manage'), async (req, res) => {
    const { role } = parse(setWorkspaceMemberSchema, req.body);
    await tenancy.setWorkspaceMemberRole(ctx(req), param(req.params.userId), role);
    res.status(204).end();
  });
  ws.delete('/members/:userId', authorize('members:manage'), async (req, res) => {
    await tenancy.removeWorkspaceMember(ctx(req), param(req.params.userId));
    res.status(204).end();
  });

  // Business profile
  ws.get('/profile', authorize('profile:read'), async (req, res) => {
    res.json(await profile.get(ctx(req)));
  });
  ws.put('/profile', authorize('profile:update'), async (req, res) => {
    res.json(await profile.replace(ctx(req), parse(businessProfileSchema, req.body)));
  });

  // Agents
  ws.get('/agents', authorize('agent:read'), async (req, res) => {
    res.json(await agents.list(ctx(req)));
  });
  ws.post('/agents', authorize('agent:update'), async (req, res) => {
    res.status(201).json(await agents.create(ctx(req), parse(createAgentSchema, req.body)));
  });
  ws.get('/agents/:agentId', authorize('agent:read'), async (req, res) => {
    res.json(await agents.get(ctx(req), param(req.params.agentId)));
  });
  ws.patch('/agents/:agentId', authorize('agent:update'), async (req, res) => {
    res.json(await agents.update(ctx(req), param(req.params.agentId), parse(updateAgentSchema, req.body)));
  });
  ws.delete('/agents/:agentId', authorize('agent:update'), async (req, res) => {
    await agents.archive(ctx(req), param(req.params.agentId));
    res.status(204).end();
  });
  ws.get('/agents/:agentId/versions', authorize('agent:read'), async (req, res) => {
    res.json(await agents.versions(ctx(req), param(req.params.agentId)));
  });
  ws.post('/agents/:agentId/publish', authorize('agent:publish'), async (req, res) => {
    const { notes } = parse(publishAgentSchema, req.body ?? {});
    res.json(await agents.publish(ctx(req), param(req.params.agentId), notes));
  });
  ws.post('/agents/:agentId/rollback', authorize('agent:publish'), async (req, res) => {
    const { versionId } = parse(rollbackAgentSchema, req.body);
    res.json(await agents.rollback(ctx(req), param(req.params.agentId), versionId));
  });

  // Test conversations (sandbox against the draft)
  const messageLimit = rateLimit({ windowMs: 60_000, max: 60, key: (req) => `msg:${req.user?.id ?? req.ip}` });
  ws.post('/agents/:agentId/test-conversations', authorize('conversation:test'), async (req, res) => {
    res.status(201).json(await conversations.startTest(ctx(req), param(req.params.agentId)));
  });
  ws.post('/conversations/:conversationId/messages', authorize('conversation:test'), messageLimit, async (req, res) => {
    const { text } = parse(sendMessageSchema, req.body);
    res.json(await conversations.sendTestMessage(ctx(req), param(req.params.conversationId), text));
  });
  ws.get('/conversations', authorize('conversation:read'), async (req, res) => {
    res.json(await conversations.list(ctx(req), parse(listConversationsQuerySchema, req.query)));
  });
  ws.get('/conversations/:conversationId', authorize('conversation:read'), async (req, res) => {
    res.json(await conversations.detail(ctx(req), param(req.params.conversationId)));
  });

  // Action Queue
  ws.get('/actions', authorize('action:read'), async (req, res) => {
    const query = parse(listActionsQuerySchema, req.query);
    const [items, openUrgent] = await Promise.all([actions.list(ctx(req), query), actions.openUrgentCount(ctx(req))]);
    res.json({ items, openUrgent });
  });
  ws.get('/actions/:actionId', authorize('action:read'), async (req, res) => {
    res.json(await actions.get(ctx(req), param(req.params.actionId)));
  });
  ws.patch('/actions/:actionId', authorize('action:update'), async (req, res) => {
    res.json(await actions.update(ctx(req), param(req.params.actionId), parse(updateActionSchema, req.body)));
  });

  // Audit log
  ws.get('/audit', authorize('audit:read'), async (req, res) => {
    const { limit } = parse(z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) }), req.query);
    res.json(await services.audit.list(ctx(req), limit));
  });

  return v1;
}
