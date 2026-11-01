# 05 — Data Model (PostgreSQL + pgvector)

## 1. Current state

No database. The shapes in use today (from `backend/server.js` seed data and `backend/engine/knowledgeBase.js`):

- **Tenant:** `id, brandName, industry, domain, logoUrl, primaryColor, accentColor, monthlyRetainer, status, businessProfile, agents[]`
- **BusinessProfile:** `address{street,city,state,zip,country}, branches[{name,address,phone}], hours{timezone, monday..sunday{open,close,closed}, holidays[], temporaryClosures[]}, contacts{primary, departments[], escalation, emergencyContact, fallback}, serviceAreas[]`
- **Agent:** `id, name, type ('voice'|'chatbot'), voiceId, phoneNumber, greeting, systemPrompt, status, interactions, avgLatencyMs, createdAt`
- **Session (memory):** workflow, collectedInfo, recentMessages (20), toolExecutions (10)

The business profile structure is a good start and is kept, with fixes: times are free text ("8:00 AM"), there is no structured services/pricing list (prices are regex-mined from prompts), and empty values are indistinguishable from configured ones (bug B6).

## 2. Conventions

- Primary keys: `uuid` v7 (time-ordered), generated in the app. Public-facing IDs (widget keys) are separate random tokens.
- Every tenant-owned table has `workspace_id uuid not null` and an index starting with `workspace_id`.
- `created_at`, `updated_at` (`timestamptz`) on all tables; `deleted_at` where soft delete is needed.
- Enums as Postgres `text` with `CHECK` constraints (easier to evolve than native enums).
- JSONB only for genuinely flexible config (agent capability config, integration settings). Anything we filter or join on is a column.

## 3. Tables

### 3.1 Identity and tenancy

```
users                 (managed by Better Auth: id, email, name, image, email_verified, …)
sessions, accounts, verifications   (Better Auth)

organizations
  id, name, slug unique, kind ('business'|'agency'), plan_id, created_at

memberships
  id, organization_id → organizations, user_id → users,
  role ('owner'|'admin'|'member'), created_at
  unique (organization_id, user_id)

workspaces
  id, organization_id → organizations, name, slug, industry_template_id,
  timezone, locale, status ('active'|'suspended'|'archived'),
  data_retention_days int default 365, created_at, deleted_at

workspace_members              -- per-workspace role; agency staff may get access to many
  id, workspace_id, user_id, role ('admin'|'editor'|'operator'|'viewer'), created_at
  unique (workspace_id, user_id)

invitations
  id, organization_id, workspace_id null, email, role, token_hash, expires_at, accepted_at
```

Org owners/admins implicitly have `admin` on every workspace in the org. Others need a `workspace_members` row. See 06 for the permission matrix.

### 3.2 Business profile (verified facts)

Split into rows so each fact can be edited, validated and cited individually.

```
business_profiles
  workspace_id PK, legal_name, display_name, description, website_url,
  primary_phone, primary_email, service_areas text[], updated_at, updated_by

locations
  id, workspace_id, name, is_primary bool,
  street, city, region, postal_code, country, lat, lng, maps_url,
  phone, email, notes

opening_hours
  id, workspace_id, location_id null (null = all locations),
  weekday smallint 0-6, opens time, closes time        -- multiple rows per day allowed (split shifts)
  -- absence of rows for a weekday = closed only if location.hours_configured = true

hours_exceptions
  id, workspace_id, location_id null, date, closed bool, opens time null, closes time null, label

contacts_directory
  id, workspace_id, kind ('primary'|'department'|'escalation'|'emergency'|'fallback'),
  name, role, phone, email, available_24x7 bool, notify bool, priority smallint

services
  id, workspace_id, name, description, price_type ('fixed'|'from'|'range'|'quote'|'free'),
  price_min numeric null, price_max numeric null, currency, duration_minutes null,
  bookable bool, active bool

policies
  id, workspace_id, topic ('payment'|'cancellation'|'insurance'|'parking'|'accessibility'|'custom'),
  title, body
```

`locations.hours_configured bool` distinguishes "closed on Sunday" from "not configured", fixing B6. The runtime only states facts from rows that exist.

### 3.3 Agents

```
agents
  id, workspace_id, name, slug, status ('draft'|'live'|'paused'|'archived'),
  current_draft_version_id, published_version_id null, created_by, created_at

agent_versions                 -- immutable once published
  id, workspace_id, agent_id, version int, state ('draft'|'published'|'superseded'),
  persona jsonb        -- { displayName, role, tone, language, greeting, signoff }
  instructions text    -- operator's free-text guidance
  capabilities jsonb   -- { appointment_booking: { enabled, serviceIds, requireEmail }, … }
  guardrails jsonb     -- { forbiddenTopics[], disclaimers[], maxReplyLength, competitorMentions }
  knowledge_scope jsonb -- { sourceIds | 'all', minScore }
  web_research jsonb   -- { enabled, allowedDomains[], blockedDomains[], dailyLimit }
  model_tier text default 'standard',
  published_at, published_by, created_at
  unique (agent_id, version)

channels
  id, workspace_id, agent_id, kind ('web_widget'|'hosted_page'|'sms'|'whatsapp'|'voice'),
  public_key unique, allowed_origins text[], config jsonb, status ('active'|'disabled'), created_at
```

The old `type: 'voice' | 'chatbot'` becomes channels; one agent can serve many channels.

### 3.4 Knowledge

```
knowledge_sources
  id, workspace_id, kind ('file'|'url'|'faq'|'text'), title,
  uri, storage_key, mime_type, bytes, checksum,
  status ('pending'|'indexing'|'ready'|'failed'|'disabled'), error, last_indexed_at,
  recrawl_interval_hours null, created_by

knowledge_chunks
  id, workspace_id, source_id, ordinal, content text, token_count,
  embedding vector(N), metadata jsonb (page, heading, url), tsv tsvector
  index: hnsw (embedding vector_cosine_ops); gin (tsv); btree (workspace_id, source_id)

faq_entries
  id, workspace_id, question, answer, source_id (the FAQ pseudo-source), active
```

Hybrid search: vector similarity + full-text rank, filtered by `workspace_id` and agent knowledge scope (08 §6). `N` is fixed by the embedding model chosen at implementation time (stored in config; changing models means a re-embed job).

### 3.5 Conversations

```
contacts
  id, workspace_id, name, phone_e164, email, external_ids jsonb, first_seen_at, last_seen_at,
  consent jsonb
  unique (workspace_id, phone_e164) where phone_e164 is not null
  unique (workspace_id, email) where email is not null

conversations
  id, workspace_id, agent_id, agent_version_id, channel_id, contact_id null,
  is_test bool, status ('open'|'handed_off'|'closed'), handled_by ('ai'|'human'),
  priority ('P0'..'P6') -- highest seen
  state jsonb          -- runtime state: active workflow, collected slots, pending intents
  state_version int    -- optimistic concurrency for state updates
  outcome ('resolved'|'escalated'|'action_created'|'abandoned'|null),
  summary text, primary_intent, started_at, last_message_at, closed_at,
  visitor_fingerprint (hashed), locale

messages
  id, workspace_id, conversation_id, role ('customer'|'agent'|'operator'|'system'),
  content text, citations jsonb, intents jsonb, created_at, model, tokens_in, tokens_out, latency_ms

tool_calls
  id, workspace_id, conversation_id, message_id, tool, input jsonb, status, output jsonb,
  error, started_at, finished_at
```

`state` replaces the in-memory session. Each turn reads and writes it with `state_version` checks so two concurrent messages cannot corrupt a workflow.

### 3.6 Action Queue

```
actions
  id, workspace_id, conversation_id null, contact_id null,
  type ('callback_request'|'human_handoff'|'emergency'|'booking_request'|'booking'|
        'support_ticket'|'lead'|'order_request'|'custom'),
  priority ('P0'..'P6'), status ('new'|'in_progress'|'done'|'cancelled'|'failed'),
  title, payload jsonb, assignee_user_id null, due_at null,
  fulfilment ('manual'|'integration'), integration_id null, external_ref null,
  created_at, acknowledged_at, completed_at
action_events
  id, workspace_id, action_id, kind ('created'|'assigned'|'status_changed'|'note'|'notified'|'integration_result'),
  actor_user_id null, data jsonb, created_at
```

### 3.7 Integrations, usage, billing, audit

```
integrations
  id, workspace_id, provider ('google_calendar'|'calcom'|'hubspot'|'slack'|'webhook'|'twilio'|…),
  status ('connected'|'error'|'revoked'), settings jsonb, credentials_ciphertext bytea,
  credentials_key_version int, last_checked_at, last_error

webhook_endpoints   id, workspace_id, url, secret_ciphertext, events text[], active
webhook_deliveries  id, workspace_id, endpoint_id, event, payload, status, attempts, last_status_code

usage_events
  id, workspace_id, kind ('ai_tokens_in'|'ai_tokens_out'|'web_search'|'conversation'|'embedding_tokens'|'sms'),
  quantity bigint, model, agent_id, conversation_id, created_at
usage_periods       workspace_id, period_start, totals jsonb   -- rollup

plans               id, name, limits jsonb (conversations, ai_tokens, web_searches, agents, seats, knowledge_mb)
subscriptions       organization_id, plan_id, status, provider_customer_id, current_period_end

audit_logs          id, organization_id, workspace_id null, actor_user_id, action, target_type, target_id, diff jsonb, ip, created_at

industry_templates  id, slug, name, description, capabilities jsonb, profile_prompts jsonb, starter_faq jsonb, version
```

`industry_templates` is global (not tenant-owned) and read-only to tenants.

## 4. Row-level security

For every table with `workspace_id`:

```sql
alter table messages enable row level security;
alter table messages force row level security;
create policy ws_isolation on messages
  using (workspace_id = current_setting('app.workspace_id')::uuid)
  with check (workspace_id = current_setting('app.workspace_id')::uuid);
```

- The application connects with a role that **does not** have `BYPASSRLS`.
- `withWorkspaceTx(ctx, fn)` opens a transaction and runs `select set_config('app.workspace_id', $1, true)`; the `true` makes it transaction-local, so pooled connections cannot leak context.
- Cross-workspace queries (org-level analytics, agency client list, platform admin, job scheduler) use a separate, audited `withOrgScope` / `withSystemScope` that sets `app.organization_id` or uses a privileged role, and live only in designated modules.

## 5. Migrations and seed

- Drizzle Kit generates SQL migrations committed to the repo; RLS policies are hand-written SQL migrations.
- Migrations run as a release step before the new API version starts; they must be backward compatible with the previous release (expand → migrate → contract).
- `db/seed.ts` creates a demo organization with the three existing businesses (Apex Dental, Vanguard Realty, Solaris HVAC), converting their current `businessProfile` objects into the new tables and their system prompts into agent instructions plus `services` rows (e.g. "Dental cleanings cost $125" → service row). This preserves the demo content while proving the new model.

## 6. Indexes and growth notes

- Conversations list: `(workspace_id, last_message_at desc)`, plus `(workspace_id, status)`, `(workspace_id, priority)`.
- Messages: `(conversation_id, created_at)`.
- Actions: `(workspace_id, status, priority, created_at)`.
- Usage: `(workspace_id, created_at)`; partition `usage_events` and `messages` by month once they exceed tens of millions of rows (13 §4).

## Verification

- Migration from empty database succeeds; seed creates three demo workspaces whose agents answer address/hours/contact questions correctly from the new tables.
- RLS test: with `app.workspace_id` set to workspace A, `select count(*) from messages where workspace_id = B` returns 0; inserting a row for B fails.
- Schema review checklist: every tenant table has `workspace_id`, an index leading with it, RLS enabled and forced, and a policy.
