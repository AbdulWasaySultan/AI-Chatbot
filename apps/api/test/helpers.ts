// Test harness: a fresh in-memory Postgres per test file, the real Express app, and
// signed-in HTTP agents (real Better Auth sessions and cookies).
import request from 'supertest';
import type { Express } from 'express';
import { loadConfig } from '../src/config/env.ts';
import { createDatabase, type Database } from '../src/db/client.ts';
import { createLogger } from '../src/lib/logger.ts';
import { createApp, type Services } from '../src/app.ts';

export const ORIGIN = 'http://localhost:3000';

export interface TestEnv {
  app: Express;
  database: Database;
  services: Services;
  close(): Promise<void>;
}

export async function createTestEnv(): Promise<TestEnv> {
  const config = loadConfig({
    SKIP_DOTENV: '1',
    NODE_ENV: 'test',
    DATABASE_URL: 'pglite://memory',
    APP_URL: ORIGIN,
    LEGACY_DEMO_API: 'false',
    LOG_LEVEL: 'silent',
  });
  const database = await createDatabase(config.databaseUrl);
  await database.migrate();
  const { app, services } = createApp({ config, db: database.db, logger: createLogger('silent') });
  return { app, database, services, close: () => database.close() };
}

export type Client = ReturnType<typeof request.agent>;

/** Signs up a new user and returns an HTTP client carrying their session cookie. */
export async function signUp(app: Express, email: string, name = email.split('@')[0]!): Promise<{ client: Client; userId: string }> {
  const client = request.agent(app).set('origin', ORIGIN);
  const res = await client.post('/api/auth/sign-up/email').send({ email, password: 'Correct-Horse-9', name });
  if (res.status !== 200) throw new Error(`sign-up failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { client, userId: res.body.user.id as string };
}

export const anon = (app: Express) => ({
  get: (url: string) => request(app).get(url).set('origin', ORIGIN),
  post: (url: string) => request(app).post(url).set('origin', ORIGIN),
});

/** Creates an organization + workspace owned by the client's user. */
export async function createWorkspace(client: Client, name: string) {
  const org = await client.post('/api/v1/orgs').send({ name: `${name} Org`, kind: 'business' }).expect(201);
  const ws = await client
    .post(`/api/v1/orgs/${org.body.id}/workspaces`)
    .send({ name, timezone: 'America/New_York', industry: 'Healthcare' })
    .expect(201);
  return { orgId: org.body.id as string, workspaceId: ws.body.id as string };
}

export const sampleProfile = (city: string) => ({
  displayName: `${city} Clinic`,
  primaryPhone: '+1 (212) 555-0100',
  serviceAreas: [city],
  locations: [
    {
      name: 'Main Office',
      isPrimary: true,
      street: `1 ${city} Street`,
      city,
      region: 'NY',
      postalCode: '10001',
      country: 'USA',
      hoursConfigured: true,
      hours: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, opens: '09:00', closes: '17:00' })),
    },
  ],
  contacts: [
    { kind: 'primary', name: 'Dr. Smith', role: 'Director', phone: '+1 (212) 555-0100', email: 'smith@example.com' },
    { kind: 'emergency', name: 'On-call', role: 'On-call', phone: '+1 (212) 555-0199', available24x7: true },
  ],
  services: [{ name: 'Consultation', priceType: 'fixed', priceMin: 150, bookable: true }],
  policies: [{ topic: 'insurance', title: 'Insurance', body: 'We accept Aetna.' }],
});

export const readyAgentConfig = {
  persona: { displayName: 'Ava', role: 'Receptionist', greeting: 'Hi, I am Ava. How can I help?' },
  instructions: 'Help patients book appointments.',
};

/** Creates and publishes an agent; returns its id. */
export async function createPublishedAgent(client: Client, workspaceId: string, name = 'Front desk') {
  const agent = await client
    .post(`/api/v1/workspaces/${workspaceId}/agents`)
    .send({ name, config: readyAgentConfig })
    .expect(201);
  await client.post(`/api/v1/workspaces/${workspaceId}/agents/${agent.body.id}/publish`).send({}).expect(200);
  return agent.body.id as string;
}
