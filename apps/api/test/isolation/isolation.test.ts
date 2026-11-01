// Tenant isolation suite (plans/12-testing-quality.md §4). A user of workspace A must not be able
// to read or change anything in workspace B, and must not even learn that B's resources exist.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createPublishedAgent,
  createTestEnv,
  createWorkspace,
  sampleProfile,
  signUp,
  type Client,
  type TestEnv,
} from '../helpers.ts';

let env: TestEnv;
let alice: Client; // owns workspace A
let bob: Client; // owns workspace B (different organization)
const A = { orgId: '', workspaceId: '', agentId: '', conversationId: '', actionId: '' };
const B = { orgId: '', workspaceId: '', agentId: '', conversationId: '', actionId: '', versionId: '', userId: '' };

async function seedTenant(client: Client, ids: typeof A, city: string) {
  Object.assign(ids, await createWorkspace(client, `${city} Clinic`));
  const base = `/api/v1/workspaces/${ids.workspaceId}`;
  await client.put(`${base}/profile`).send(sampleProfile(city)).expect(200);
  ids.agentId = await createPublishedAgent(client, ids.workspaceId);
  const conv = await client.post(`${base}/agents/${ids.agentId}/test-conversations`).expect(201);
  ids.conversationId = conv.body.id;
  await client.post(`${base}/conversations/${ids.conversationId}/messages`).send({ text: 'This is an emergency' }).expect(200);
  await client.post(`${base}/conversations/${ids.conversationId}/messages`).send({ text: '212 555 0123' }).expect(200);
  const actions = await client.get(`${base}/actions?includeTests=true`).expect(200);
  ids.actionId = actions.body.items[0].id;
}

beforeAll(async () => {
  env = await createTestEnv();
  ({ client: alice } = await signUp(env.app, 'alice@a.test'));
  const b = await signUp(env.app, 'bob@b.test');
  bob = b.client;
  B.userId = b.userId;
  await seedTenant(alice, A, 'Boston');
  await seedTenant(bob, B, 'Chicago');
  const versions = await bob.get(`/api/v1/workspaces/${B.workspaceId}/agents/${B.agentId}/versions`).expect(200);
  B.versionId = versions.body[0].id;
});
afterAll(() => env.close());

/** Every workspace-scoped route, aimed at workspace B. */
const routesIntoB = () => {
  const ws = `/api/v1/workspaces/${B.workspaceId}`;
  return [
    ['get', ws],
    ['patch', ws, { name: 'Pwned' }],
    ['delete', ws],
    ['get', `${ws}/members`],
    ['put', `${ws}/members/${B.userId}`, { role: 'viewer' }],
    ['delete', `${ws}/members/${B.userId}`],
    ['get', `${ws}/profile`],
    ['put', `${ws}/profile`, sampleProfile('Hacked')],
    ['get', `${ws}/agents`],
    ['post', `${ws}/agents`, { name: 'Intruder' }],
    ['get', `${ws}/agents/${B.agentId}`],
    ['patch', `${ws}/agents/${B.agentId}`, { name: 'Pwned' }],
    ['delete', `${ws}/agents/${B.agentId}`],
    ['get', `${ws}/agents/${B.agentId}/versions`],
    ['post', `${ws}/agents/${B.agentId}/publish`, {}],
    ['post', `${ws}/agents/${B.agentId}/rollback`, { versionId: B.versionId }],
    ['post', `${ws}/agents/${B.agentId}/test-conversations`],
    ['get', `${ws}/conversations`],
    ['get', `${ws}/conversations/${B.conversationId}`],
    ['post', `${ws}/conversations/${B.conversationId}/messages`, { text: 'hi' }],
    ['get', `${ws}/actions`],
    ['get', `${ws}/actions/${B.actionId}`],
    ['patch', `${ws}/actions/${B.actionId}`, { status: 'done' }],
    ['get', `${ws}/audit`],
  ] as const;
};

/** B's resource IDs requested through A's own workspace URL (classic IDOR). */
const bResourcesViaA = () => {
  const ws = `/api/v1/workspaces/${A.workspaceId}`;
  return [
    ['get', `${ws}/agents/${B.agentId}`],
    ['patch', `${ws}/agents/${B.agentId}`, { name: 'Pwned' }],
    ['delete', `${ws}/agents/${B.agentId}`],
    ['get', `${ws}/agents/${B.agentId}/versions`],
    ['post', `${ws}/agents/${B.agentId}/publish`, {}],
    ['post', `${ws}/agents/${A.agentId}/rollback`, { versionId: B.versionId }],
    ['post', `${ws}/agents/${B.agentId}/test-conversations`],
    ['get', `${ws}/conversations/${B.conversationId}`],
    ['post', `${ws}/conversations/${B.conversationId}/messages`, { text: 'hi' }],
    ['get', `${ws}/actions/${B.actionId}`],
    ['patch', `${ws}/actions/${B.actionId}`, { status: 'done' }],
  ] as const;
};

type Route = readonly [method: 'get' | 'post' | 'put' | 'patch' | 'delete', url: string, body?: object];

async function call(client: Client, [method, url, body]: Route) {
  const req = client[method](url);
  return body ? req.send(body) : req;
}

describe('tenant isolation', () => {
  it("returns 404 for every route aimed at another tenant's workspace", async () => {
    for (const route of routesIntoB()) {
      const res = await call(alice, route);
      expect(res.status, `${route[0].toUpperCase()} ${route[1]}`).toBe(404);
      expect(JSON.stringify(res.body)).not.toContain('Chicago');
    }
  });

  it("returns 404 when another tenant's resource IDs are used inside your own workspace", async () => {
    for (const route of bResourcesViaA()) {
      const res = await call(alice, route);
      expect(res.status, `${route[0].toUpperCase()} ${route[1]}`).toBe(404);
    }
  });

  it("never lists another tenant's records", async () => {
    const ws = `/api/v1/workspaces/${A.workspaceId}`;
    const [agents, convs, actions, me] = await Promise.all([
      alice.get(`${ws}/agents`),
      alice.get(`${ws}/conversations?includeTests=true`),
      alice.get(`${ws}/actions?includeTests=true`),
      alice.get('/api/v1/me'),
    ]);
    const all = JSON.stringify([agents.body, convs.body, actions.body, me.body]);
    for (const id of [B.workspaceId, B.agentId, B.conversationId, B.actionId, B.orgId]) expect(all).not.toContain(id);
    expect(all).not.toContain('Chicago');
  });

  it("does not let an organization's members or invitations be managed by outsiders", async () => {
    await alice.get(`/api/v1/orgs/${B.orgId}/members`).expect(404);
    await alice.post(`/api/v1/orgs/${B.orgId}/workspaces`).send({ name: 'Sneaky' }).expect(404);
    await alice.post(`/api/v1/orgs/${B.orgId}/invitations`).send({ email: 'alice@a.test' }).expect(404);
    const ws = await alice.get(`/api/v1/orgs/${B.orgId}/workspaces`).expect(200);
    expect(ws.body).toEqual([]);
  });

  it("keeps the agent engine inside its own tenant's data", async () => {
    const ws = `/api/v1/workspaces/${A.workspaceId}`;
    const conv = await alice.post(`${ws}/agents/${A.agentId}/test-conversations`).expect(201);
    const res = await alice.post(`${ws}/conversations/${conv.body.id}/messages`).send({ text: 'Where are you located?' }).expect(200);
    expect(res.body.reply).toContain('Boston');
    expect(res.body.reply).not.toContain('Chicago');
  });

  it("left tenant B's data untouched", async () => {
    const ws = `/api/v1/workspaces/${B.workspaceId}`;
    const [workspace, agent, action, profile] = await Promise.all([
      bob.get(ws),
      bob.get(`${ws}/agents/${B.agentId}`),
      bob.get(`${ws}/actions/${B.actionId}`),
      bob.get(`${ws}/profile`),
    ]);
    expect(workspace.body.name).toBe('Chicago Clinic');
    expect(agent.body.name).toBe('Front desk');
    expect(action.body.status).toBe('new');
    expect(profile.body.locations[0].city).toBe('Chicago');
  });
});
