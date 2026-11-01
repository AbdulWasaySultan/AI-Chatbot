// Database schema (plans/05-data-model.md). Tables marked TENANT carry workspace_id and are
// protected by row-level security (see drizzle/*_rls.sql).
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const inList = (column: string, values: readonly string[]) =>
  sql.raw(`${column} in (${values.map((v) => `'${v}'`).join(', ')})`);

// ============================================================ Identity (Better Auth)

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [index('session_user_idx').on(t.userId)]
);

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('account_user_idx').on(t.userId)]
);

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ============================================================ Tenancy

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    kind: text('kind').notNull().default('business'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  () => [check('organizations_kind_chk', inList(`"kind"`, ['business', 'agency']))]
);

export const memberships = pgTable(
  'memberships',
  {
    id: uuid('id').primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('memberships_org_user_uq').on(t.organizationId, t.userId),
    index('memberships_user_idx').on(t.userId),
    check('memberships_role_chk', inList(`"role"`, ['owner', 'admin', 'member'])),
  ]
);

export const workspaces = pgTable(
  'workspaces',
  {
    id: uuid('id').primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    industry: text('industry').notNull().default(''),
    timezone: text('timezone').notNull().default('UTC'),
    locale: text('locale').notNull().default('en'),
    status: text('status').notNull().default('active'),
    dataRetentionDays: integer('data_retention_days').notNull().default(365),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('workspaces_org_slug_uq').on(t.organizationId, t.slug),
    check('workspaces_status_chk', inList(`"status"`, ['active', 'suspended', 'archived'])),
  ]
);

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('workspace_members_ws_user_uq').on(t.workspaceId, t.userId),
    index('workspace_members_user_idx').on(t.userId),
    check('workspace_members_role_chk', inList(`"role"`, ['admin', 'editor', 'operator', 'viewer'])),
  ]
);

export const invitations = pgTable(
  'invitations',
  {
    id: uuid('id').primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    orgRole: text('org_role').notNull().default('member'),
    workspaceRole: text('workspace_role'),
    tokenHash: text('token_hash').notNull().unique(),
    invitedBy: text('invited_by').references(() => user.id, { onDelete: 'set null' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('invitations_org_idx').on(t.organizationId)]
);

// ============================================================ Business profile (TENANT)

const workspaceRef = () =>
  uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' });

export const businessProfiles = pgTable('business_profiles', {
  workspaceId: uuid('workspace_id')
    .primaryKey()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  displayName: text('display_name').notNull(),
  legalName: text('legal_name').notNull().default(''),
  description: text('description').notNull().default(''),
  websiteUrl: text('website_url').notNull().default(''),
  primaryPhone: text('primary_phone').notNull().default(''),
  primaryEmail: text('primary_email').notNull().default(''),
  serviceAreas: text('service_areas').array().notNull().default(sql`'{}'::text[]`),
  updatedAt: updatedAt(),
  updatedBy: text('updated_by'),
});

export const locations = pgTable(
  'locations',
  {
    id: uuid('id').primaryKey(),
    workspaceId: workspaceRef(),
    name: text('name').notNull(),
    isPrimary: boolean('is_primary').notNull().default(false),
    street: text('street').notNull().default(''),
    city: text('city').notNull().default(''),
    region: text('region').notNull().default(''),
    postalCode: text('postal_code').notNull().default(''),
    country: text('country').notNull().default(''),
    phone: text('phone').notNull().default(''),
    email: text('email').notNull().default(''),
    mapsUrl: text('maps_url').notNull().default(''),
    notes: text('notes').notNull().default(''),
    hoursConfigured: boolean('hours_configured').notNull().default(false),
    position: smallint('position').notNull().default(0),
  },
  (t) => [index('locations_ws_idx').on(t.workspaceId)]
);

export const openingHours = pgTable(
  'opening_hours',
  {
    id: uuid('id').primaryKey(),
    workspaceId: workspaceRef(),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id, { onDelete: 'cascade' }),
    weekday: smallint('weekday').notNull(),
    opens: time('opens').notNull(),
    closes: time('closes').notNull(),
  },
  (t) => [
    index('opening_hours_ws_loc_idx').on(t.workspaceId, t.locationId),
    check('opening_hours_weekday_chk', sql`${t.weekday} between 0 and 6`),
  ]
);

export const hoursExceptions = pgTable(
  'hours_exceptions',
  {
    id: uuid('id').primaryKey(),
    workspaceId: workspaceRef(),
    locationId: uuid('location_id').references(() => locations.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    closed: boolean('closed').notNull(),
    opens: time('opens'),
    closes: time('closes'),
    label: text('label').notNull().default(''),
  },
  (t) => [index('hours_exceptions_ws_idx').on(t.workspaceId, t.date)]
);

export const contactsDirectory = pgTable(
  'contacts_directory',
  {
    id: uuid('id').primaryKey(),
    workspaceId: workspaceRef(),
    kind: text('kind').notNull(),
    name: text('name').notNull().default(''),
    role: text('role').notNull().default(''),
    phone: text('phone').notNull().default(''),
    email: text('email').notNull().default(''),
    available24x7: boolean('available_24x7').notNull().default(false),
    notify: boolean('notify').notNull().default(false),
    priority: smallint('priority').notNull().default(0),
  },
  (t) => [
    index('contacts_directory_ws_idx').on(t.workspaceId),
    check(
      'contacts_directory_kind_chk',
      inList(`"kind"`, ['primary', 'department', 'escalation', 'emergency', 'fallback'])
    ),
  ]
);

export const services = pgTable(
  'services',
  {
    id: uuid('id').primaryKey(),
    workspaceId: workspaceRef(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    priceType: text('price_type').notNull().default('quote'),
    priceMin: numeric('price_min', { precision: 12, scale: 2, mode: 'number' }),
    priceMax: numeric('price_max', { precision: 12, scale: 2, mode: 'number' }),
    currency: text('currency').notNull().default('USD'),
    durationMinutes: integer('duration_minutes'),
    bookable: boolean('bookable').notNull().default(false),
    active: boolean('active').notNull().default(true),
    position: smallint('position').notNull().default(0),
  },
  (t) => [
    index('services_ws_idx').on(t.workspaceId),
    check('services_price_type_chk', inList(`"price_type"`, ['fixed', 'from', 'range', 'quote', 'free'])),
  ]
);

export const policies = pgTable(
  'policies',
  {
    id: uuid('id').primaryKey(),
    workspaceId: workspaceRef(),
    topic: text('topic').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
  },
  (t) => [index('policies_ws_idx').on(t.workspaceId)]
);

// ============================================================ Agents (TENANT)

export const agents = pgTable(
  'agents',
  {
    id: uuid('id').primaryKey(),
    workspaceId: workspaceRef(),
    name: text('name').notNull(),
    status: text('status').notNull().default('draft'),
    draftVersionId: uuid('draft_version_id'),
    publishedVersionId: uuid('published_version_id'),
    createdBy: text('created_by'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('agents_ws_idx').on(t.workspaceId),
    check('agents_status_chk', inList(`"status"`, ['draft', 'live', 'paused', 'archived'])),
  ]
);

export const agentVersions = pgTable(
  'agent_versions',
  {
    id: uuid('id').primaryKey(),
    workspaceId: workspaceRef(),
    agentId: uuid('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    state: text('state').notNull().default('draft'),
    /** Full agent configuration (packages/shared agentConfigSchema). Immutable once published. */
    config: jsonb('config').notNull(),
    notes: text('notes').notNull().default(''),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    publishedBy: text('published_by'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('agent_versions_agent_version_uq').on(t.agentId, t.version),
    index('agent_versions_ws_idx').on(t.workspaceId),
    check('agent_versions_state_chk', inList(`"state"`, ['draft', 'published', 'superseded'])),
  ]
);

export const channels = pgTable(
  'channels',
  {
    id: uuid('id').primaryKey(),
    workspaceId: workspaceRef(),
    agentId: uuid('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    publicKey: text('public_key').notNull().unique(),
    allowedOrigins: text('allowed_origins').array().notNull().default(sql`'{}'::text[]`),
    config: jsonb('config').notNull().default({}),
    status: text('status').notNull().default('active'),
    createdAt: createdAt(),
  },
  (t) => [index('channels_ws_idx').on(t.workspaceId)]
);

// ============================================================ Conversations (TENANT)

export const contacts = pgTable(
  'contacts',
  {
    id: uuid('id').primaryKey(),
    workspaceId: workspaceRef(),
    name: text('name').notNull().default(''),
    phoneE164: text('phone_e164'),
    email: text('email'),
    firstSeenAt: createdAt(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('contacts_ws_phone_uq').on(t.workspaceId, t.phoneE164).where(sql`phone_e164 is not null`),
    uniqueIndex('contacts_ws_email_uq').on(t.workspaceId, t.email).where(sql`email is not null`),
  ]
);

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey(),
    workspaceId: workspaceRef(),
    agentId: uuid('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),
    agentVersionId: uuid('agent_version_id')
      .notNull()
      .references(() => agentVersions.id),
    channelId: uuid('channel_id').references(() => channels.id, { onDelete: 'set null' }),
    contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
    isTest: boolean('is_test').notNull().default(false),
    status: text('status').notNull().default('open'),
    handledBy: text('handled_by').notNull().default('ai'),
    priority: text('priority').notNull().default('P6'),
    /** Runtime state: active workflow, collected details. Replaces the in-memory session. */
    state: jsonb('state').notNull().default({}),
    stateVersion: integer('state_version').notNull().default(0),
    outcome: text('outcome'),
    primaryIntent: text('primary_intent'),
    startedBy: text('started_by'),
    startedAt: createdAt(),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (t) => [
    index('conversations_ws_last_idx').on(t.workspaceId, t.lastMessageAt),
    index('conversations_ws_status_idx').on(t.workspaceId, t.status),
    check('conversations_status_chk', inList(`"status"`, ['open', 'handed_off', 'closed'])),
    check('conversations_priority_chk', sql`${t.priority} ~ '^P[0-6]$'`),
  ]
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey(),
    workspaceId: workspaceRef(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    content: text('content').notNull(),
    intents: jsonb('intents'),
    citations: jsonb('citations'),
    model: text('model'),
    tokensIn: integer('tokens_in'),
    tokensOut: integer('tokens_out'),
    latencyMs: integer('latency_ms'),
    createdAt: createdAt(),
  },
  (t) => [
    index('messages_conv_idx').on(t.conversationId, t.createdAt),
    check('messages_role_chk', inList(`"role"`, ['customer', 'agent', 'operator', 'system'])),
  ]
);

export const toolCalls = pgTable(
  'tool_calls',
  {
    id: uuid('id').primaryKey(),
    workspaceId: workspaceRef(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    messageId: uuid('message_id').references(() => messages.id, { onDelete: 'set null' }),
    tool: text('tool').notNull(),
    input: jsonb('input').notNull(),
    status: text('status').notNull(),
    output: jsonb('output'),
    createdAt: createdAt(),
  },
  (t) => [index('tool_calls_conv_idx').on(t.conversationId)]
);

// ============================================================ Action Queue (TENANT)

export const actions = pgTable(
  'actions',
  {
    id: uuid('id').primaryKey(),
    workspaceId: workspaceRef(),
    conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'set null' }),
    contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
    type: text('type').notNull(),
    priority: text('priority').notNull(),
    status: text('status').notNull().default('new'),
    title: text('title').notNull(),
    payload: jsonb('payload').notNull().default({}),
    assigneeUserId: text('assignee_user_id').references(() => user.id, { onDelete: 'set null' }),
    fulfilment: text('fulfilment').notNull().default('manual'),
    isTest: boolean('is_test').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [
    index('actions_ws_status_idx').on(t.workspaceId, t.status, t.priority, t.createdAt),
    check(
      'actions_type_chk',
      inList(`"type"`, [
        'emergency',
        'callback_request',
        'human_handoff',
        'booking_request',
        'booking',
        'support_ticket',
        'lead',
        'order_request',
        'custom',
      ])
    ),
    check('actions_status_chk', inList(`"status"`, ['new', 'in_progress', 'done', 'cancelled', 'failed'])),
    check('actions_priority_chk', sql`${t.priority} ~ '^P[0-6]$'`),
  ]
);

export const actionEvents = pgTable(
  'action_events',
  {
    id: uuid('id').primaryKey(),
    workspaceId: workspaceRef(),
    actionId: uuid('action_id')
      .notNull()
      .references(() => actions.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    actorUserId: text('actor_user_id'),
    data: jsonb('data').notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index('action_events_action_idx').on(t.actionId, t.createdAt)]
);

// ============================================================ Audit (system scope)

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
    actorUserId: text('actor_user_id'),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id'),
    data: jsonb('data').notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [
    index('audit_logs_ws_idx').on(t.workspaceId, t.createdAt),
    index('audit_logs_org_idx').on(t.organizationId, t.createdAt),
  ]
);

/** Tables isolated per workspace with row-level security. Keep in sync with the RLS migration. */
export const TENANT_TABLES = [
  'business_profiles',
  'locations',
  'opening_hours',
  'hours_exceptions',
  'contacts_directory',
  'services',
  'policies',
  'agents',
  'agent_versions',
  'channels',
  'contacts',
  'conversations',
  'messages',
  'tool_calls',
  'actions',
  'action_events',
] as const;
