// Core API behavior: auth, tenancy, roles, profile, agents, conversations and the Action Queue.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  anon,
  createPublishedAgent,
  createTestEnv,
  createWorkspace,
  readyAgentConfig,
  sampleProfile,
  signUp,
  type Client,
  type TestEnv,
} from '../helpers.ts';

let env: TestEnv;
let owner: Client;
let orgId: string;
let workspaceId: string;
const base = () => `/api/v1/workspaces/${workspaceId}`;

beforeAll(async () => {
  env = await createTestEnv();
  ({ client: owner } = await signUp(env.app, 'owner@clinic.test'));
  ({ orgId, workspaceId } = await createWorkspace(owner, 'Clinic'));
});
afterAll(() => env.close());

describe('authentication', () => {
  it('rejects anonymous requests with a structured error', async () => {
    const res = await anon(env.app).get('/api/v1/me').expect(401);
    expect(res.body.error).toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(res.body.error.requestId).toBeTruthy();
  });

  it('returns the user, organizations and workspaces', async () => {
    const res = await owner.get('/api/v1/me').expect(200);
    expect(res.body.user.email).toBe('owner@clinic.test');
    expect(res.body.organizations).toEqual([expect.objectContaining({ id: orgId, role: 'owner' })]);
    expect(res.body.workspaces).toEqual([expect.objectContaining({ id: workspaceId, role: 'admin' })]);
  });

  it('reports unknown routes as NOT_FOUND', async () => {
    const res = await owner.get('/api/v1/nope').expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('business profile', () => {
  it('starts empty and unconfigured', async () => {
    const res = await owner.get(`${base()}/profile`).expect(200);
    expect(res.body.displayName).toBe('Clinic');
    expect(res.body.locations).toEqual([]);
  });

  it('validates input and lists field errors', async () => {
    const bad = { ...sampleProfile('NYC'), locations: [{ name: 'X', hours: [{ weekday: 1, opens: '18:00', closes: '09:00' }] }] };
    const res = await owner.put(`${base()}/profile`).send(bad).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.details).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'locations.0.hours.0.closes' })]));
  });

  it('saves and reads back the full profile', async () => {
    await owner.put(`${base()}/profile`).send(sampleProfile('NYC')).expect(200);
    const res = await owner.get(`${base()}/profile`).expect(200);
    expect(res.body.locations[0]).toMatchObject({ city: 'NYC', hoursConfigured: true });
    expect(res.body.locations[0].hours).toHaveLength(5);
    expect(res.body.services[0]).toMatchObject({ name: 'Consultation', priceMin: 150 });
  });
});

describe('agents and versions', () => {
  let agentId: string;

  it('creates a draft agent', async () => {
    const res = await owner.post(`${base()}/agents`).send({ name: 'Front desk' }).expect(201);
    agentId = res.body.id;
    expect(res.body).toMatchObject({ status: 'draft', published: null, draft: { version: 1 } });
  });

  it('refuses to publish an incomplete agent and says why', async () => {
    const res = await owner.post(`${base()}/agents/${agentId}/publish`).send({}).expect(400);
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });

  it('publishes, opens a new draft, and tracks unpublished changes', async () => {
    await owner.patch(`${base()}/agents/${agentId}`).send({ config: readyAgentConfig }).expect(200);
    const pub = await owner.post(`${base()}/agents/${agentId}/publish`).send({ notes: 'first' }).expect(200);
    expect(pub.body).toMatchObject({ status: 'live', published: { version: 1 }, draft: { version: 2 }, hasUnpublishedChanges: false });

    const edited = await owner
      .patch(`${base()}/agents/${agentId}`)
      .send({ config: { persona: { greeting: 'Hello there!' } } })
      .expect(200);
    expect(edited.body.hasUnpublishedChanges).toBe(true);
    expect(edited.body.draft.config.persona.displayName).toBe('Ava'); // partial update keeps other fields
    expect(edited.body.published.config.persona.greeting).toBe('Hi, I am Ava. How can I help?');
  });

  it('rolls back to an earlier published version as a new version', async () => {
    await owner.post(`${base()}/agents/${agentId}/publish`).send({}).expect(200); // v2
    const versions = await owner.get(`${base()}/agents/${agentId}/versions`).expect(200);
    const v1 = versions.body.find((v: { version: number }) => v.version === 1);
    const res = await owner.post(`${base()}/agents/${agentId}/rollback`).send({ versionId: v1.id }).expect(200);
    expect(res.body.published.config.persona.greeting).toBe('Hi, I am Ava. How can I help?');
    expect(res.body.published.version).toBe(4);
    const after = await owner.get(`${base()}/agents/${agentId}/versions`).expect(200);
    expect(after.body.map((v: { state: string }) => v.state)).toEqual(['draft', 'published', 'superseded', 'superseded']);
  });

  it('archives an agent', async () => {
    await owner.delete(`${base()}/agents/${agentId}`).expect(204);
    await owner.get(`${base()}/agents/${agentId}`).expect(404);
  });
});

describe('test conversations and the Action Queue', () => {
  let agentId: string;
  let conversationId: string;

  beforeAll(async () => {
    agentId = await createPublishedAgent(owner, workspaceId);
  });

  it('starts with the agent greeting', async () => {
    const res = await owner.post(`${base()}/agents/${agentId}/test-conversations`).expect(201);
    conversationId = res.body.id;
    expect(res.body.messages).toEqual([expect.objectContaining({ role: 'agent', content: 'Hi, I am Ava. How can I help?' })]);
  });

  it('answers hours and location from the stored profile', async () => {
    const hours = await owner.post(`${base()}/conversations/${conversationId}/messages`).send({ text: 'What are your opening hours?' }).expect(200);
    expect(hours.body.reply).toContain('9:00 AM - 5:00 PM');
    expect(hours.body.reply).toContain('Saturday: Closed');
    const where = await owner.post(`${base()}/conversations/${conversationId}/messages`).send({ text: 'Where are you located?' }).expect(200);
    expect(where.body.reply).toContain('1 NYC Street');
    expect(where.body.reply).not.toContain('9:00 AM');
  });

  it('keeps the emergency workflow across turns and creates a P0 action', async () => {
    const first = await owner
      .post(`${base()}/conversations/${conversationId}/messages`)
      .send({ text: 'There is a gas leak in my house' })
      .expect(200);
    expect(first.body).toMatchObject({ intent: 'emergency_escalation', priority: 'P0', actionsCreated: [] });

    const second = await owner.post(`${base()}/conversations/${conversationId}/messages`).send({ text: '212 555 0148' }).expect(200);
    expect(second.body.actionsCreated).toEqual([expect.objectContaining({ type: 'emergency', priority: 'P0' })]);
    expect(second.body.reply).toContain('2125550148');

    const detail = await owner.get(`${base()}/conversations/${conversationId}`).expect(200);
    expect(detail.body.priority).toBe('P0');
    expect(detail.body.workflow).toMatchObject({ type: 'emergency_escalation' });
    expect(detail.body.messages.filter((m: { role: string }) => m.role === 'customer')).toHaveLength(4);
    expect(detail.body.toolCalls.map((t: { tool: string }) => t.tool)).toContain('schedule_callback');
  });

  it('hides sandbox actions from the queue unless asked', async () => {
    const hidden = await owner.get(`${base()}/actions`).expect(200);
    expect(hidden.body.items).toHaveLength(0);
    const shown = await owner.get(`${base()}/actions?includeTests=true`).expect(200);
    expect(shown.body.items[0]).toMatchObject({ type: 'emergency', priority: 'P0', status: 'new', isTest: true });
  });

  it('records status changes, assignment and notes as events', async () => {
    const list = await owner.get(`${base()}/actions?includeTests=true`).expect(200);
    const id = list.body.items[0].id;
    const me = await owner.get('/api/v1/me').expect(200);
    const res = await owner
      .patch(`${base()}/actions/${id}`)
      .send({ status: 'in_progress', assigneeUserId: me.body.user.id, note: 'Calling now' })
      .expect(200);
    expect(res.body.status).toBe('in_progress');
    expect(res.body.acknowledgedAt).toBeTruthy();
    expect(res.body.events.map((e: { kind: string }) => e.kind).sort()).toEqual(['assigned', 'created', 'note', 'status_changed']);
    await owner.patch(`${base()}/actions/${id}`).send({ assigneeUserId: 'not-a-member' }).expect(400);
  });

  it('creates an appointment request, never a confirmed booking', async () => {
    const conv = await owner.post(`${base()}/agents/${agentId}/test-conversations`).expect(201);
    const url = `${base()}/conversations/${conv.body.id}/messages`;
    await owner.post(url).send({ text: 'I want to book an appointment tomorrow at 3pm' }).expect(200);
    const res = await owner.post(url).send({ text: 'Ali Khan' }).expect(200);
    expect(res.body.reply.toLowerCase()).not.toContain('has been booked');
    expect(res.body.actionsCreated).toEqual([expect.objectContaining({ type: 'booking_request' })]);
  });
});

describe('roles and permissions', () => {
  let operator: Client;
  let viewer: Client;

  beforeAll(async () => {
    const op = await signUp(env.app, 'operator@clinic.test');
    const vw = await signUp(env.app, 'viewer@clinic.test');
    for (const [who, role] of [
      [op, 'operator'],
      [vw, 'viewer'],
    ] as const) {
      const invite = await owner
        .post(`/api/v1/orgs/${orgId}/invitations`)
        .send({ email: who === op ? 'operator@clinic.test' : 'viewer@clinic.test', workspaceId, workspaceRole: role })
        .expect(201);
      await who.client.post(`/api/v1/invitations/${invite.body.token}/accept`).expect(200);
    }
    operator = op.client;
    viewer = vw.client;
  });

  it('lets members see the workspace with their role', async () => {
    const me = await operator.get('/api/v1/me').expect(200);
    expect(me.body.workspaces).toEqual([expect.objectContaining({ id: workspaceId, role: 'operator' })]);
  });

  it('stops an operator from editing agents or the profile', async () => {
    await operator.post(`${base()}/agents`).send({ name: 'Nope' }).expect(403);
    await operator.put(`${base()}/profile`).send(sampleProfile('LA')).expect(403);
  });

  it('lets an operator work the Action Queue but not a viewer', async () => {
    const list = await operator.get(`${base()}/actions?includeTests=true`).expect(200);
    const id = list.body.items[0].id;
    await operator.patch(`${base()}/actions/${id}`).send({ status: 'done' }).expect(200);
    await viewer.patch(`${base()}/actions/${id}`).send({ status: 'new' }).expect(403);
  });

  it('only lets admins manage members and read the audit log', async () => {
    await operator.get(`${base()}/audit`).expect(403);
    const audit = await owner.get(`${base()}/audit`).expect(200);
    expect(audit.body.map((a: { action: string }) => a.action)).toEqual(expect.arrayContaining(['agent.published', 'profile.replaced']));
  });

  it('does not let invitations be reused or accepted by someone else', async () => {
    const invite = await owner.post(`/api/v1/orgs/${orgId}/invitations`).send({ email: 'someone@else.test' }).expect(201);
    await operator.post(`/api/v1/invitations/${invite.body.token}/accept`).expect(403);
  });
});
