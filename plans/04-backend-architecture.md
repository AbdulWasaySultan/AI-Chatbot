# 04 — Backend Architecture (Express)

## 1. Current state and problems

- One file, `backend/server.js`, holds seed data, nine routes and all business rules.
- No layers, validation library, auth, logging, error middleware or rate limiting.
- Engine and provider modules are well separated, but the provider is never used.
- Routes trust client-supplied tenant data (02 §3.4).

## 2. Module structure

Each domain module follows the same shape so new developers can find things:

```
modules/agents/
  agents.routes.ts       Express Router; only wiring + middleware
  agents.controller.ts   parse/validate input, call service, shape response
  agents.service.ts      business rules, transactions, audit, events
  agents.repository.ts   SQL via Drizzle; every function takes WorkspaceContext
  agents.schemas.ts      zod schemas (re-exported from packages/shared)
  agents.test.ts
```

Rules:
- Controllers never touch the database. Services never read `req`. Repositories never decide permissions.
- A repository function signature always starts with `(ctx: WorkspaceContext, …)`. Lint rule (custom ESLint check) flags any query on a tenant table built outside `withWorkspaceTx`.

### Modules

| Module | Responsibility |
|--------|---------------|
| `auth` | Better Auth mount, session lookup, API keys for server-to-server |
| `orgs` | Organizations, members, invitations, roles |
| `workspaces` | Workspace CRUD, business profile, branding (customer-facing), settings |
| `agents` | Agents, versions (draft/published), capabilities config, channels, publish/rollback |
| `knowledge` | Sources (file, URL, FAQ), indexing status, chunk search |
| `conversations` | Conversations, messages, takeover, outcomes; SSE streams |
| `contacts` | End-customer records, dedup by phone/email |
| `actions` | Action Queue: callback requests, handoffs, booking requests, tickets, leads |
| `integrations` | Connection records, encrypted credentials, OAuth callbacks, health checks |
| `usage` | Metering, quotas, plan limits |
| `analytics` | Aggregated metrics queries |
| `public` | Widget/hosted chat endpoints (publishable key auth) |
| `hooks` | Inbound provider webhooks (signature-verified) |
| `admin` | Platform-admin endpoints (later) |

## 3. Middleware chain

Order matters:

1. `helmet` — security headers.
2. `requestId` — accept `X-Request-Id` or generate; attach to `res`.
3. `httpLogger` (pino-http) — structured logs with `requestId`, `orgId`, `workspaceId`, `userId`, route, status, latency. PII redaction paths configured (phone, email, message text).
4. `cors` — admin routes: same-origin only (served through Next rewrite). Public routes: origin must be in the agent channel's allowlist.
5. `express.json({ limit: '256kb' })`; file uploads go through a separate `multer` route with size/type limits, streaming to object storage.
6. `session` — resolves user from cookie (admin routes) or publishable key + conversation token (public routes).
7. `workspaceContext` — for `/workspaces/:wid/*`: verifies membership, loads role, builds `WorkspaceContext { orgId, workspaceId, userId, role, permissions }`. Never reads workspace IDs from the body.
8. `rateLimit` — per user, per workspace, per IP, per conversation (13 §3).
9. Route handler.
10. `notFound` → `errorHandler` — maps typed errors to responses.

## 4. Error model

All errors are instances of `AppError { code, httpStatus, message, details?, expose }`.

| Code | HTTP | When |
|------|-----:|------|
| `VALIDATION_FAILED` | 400 | zod failure; `details` lists field errors |
| `UNAUTHENTICATED` | 401 | No/expired session |
| `FORBIDDEN` | 403 | Lacks permission |
| `NOT_FOUND` | 404 | Resource missing **or in another workspace** (never reveal existence) |
| `CONFLICT` | 409 | Version mismatch, duplicate |
| `QUOTA_EXCEEDED` | 429 | Plan limit; `details.limit`, `details.resetAt` |
| `RATE_LIMITED` | 429 | Too many requests; `Retry-After` header |
| `AI_PROVIDER_ERROR` | 502 | Upstream failure after retries; carries category from provider |
| `INTERNAL` | 500 | Anything else; message hidden, `requestId` returned |

Response shape: `{ error: { code, message, details?, requestId } }`. The frontend maps codes to user-facing copy (11 §7).

## 5. API catalogue (v1)

All admin routes are prefixed `/v1/admin` and require a session. `:wid` = workspace ID.

### Auth and organizations
| Method | Path | Permission |
|--------|------|-----------|
| * | `/v1/auth/*` | Better Auth handlers (sign up, sign in, sign out, magic link, OAuth) |
| GET | `/v1/admin/me` | session — user, orgs, memberships |
| GET/PATCH | `/v1/admin/orgs/:oid` | org:read / org:update |
| GET/POST | `/v1/admin/orgs/:oid/members` | members:read / members:invite |
| PATCH/DELETE | `/v1/admin/orgs/:oid/members/:mid` | members:manage |
| GET/POST | `/v1/admin/orgs/:oid/workspaces` | workspace:list / workspace:create |

### Workspace
| Method | Path | Permission |
|--------|------|-----------|
| GET/PATCH/DELETE | `/workspaces/:wid` | workspace:read / update / delete (soft delete) |
| GET/PUT | `/workspaces/:wid/profile` | profile:read / profile:update — full replace with validation |
| GET/PUT | `/workspaces/:wid/branding` | branding:update — customer-facing only |
| GET | `/workspaces/:wid/templates` | — list industry templates |

### Agents
| Method | Path | Notes |
|--------|------|-------|
| GET/POST | `/workspaces/:wid/agents` | Create from template or blank; creates draft v1 |
| GET/PATCH/DELETE | `/workspaces/:wid/agents/:aid` | PATCH edits draft; DELETE archives |
| GET | `/workspaces/:wid/agents/:aid/versions` | Version history |
| POST | `/workspaces/:wid/agents/:aid/publish` | Validates config; freezes draft as new published version |
| POST | `/workspaces/:wid/agents/:aid/rollback` | `{ versionId }` |
| POST | `/workspaces/:wid/agents/:aid/test-conversations` | Starts a sandbox conversation against the **draft** (marked `is_test`, excluded from analytics) |
| GET/POST/PATCH/DELETE | `/workspaces/:wid/agents/:aid/channels[/:chid]` | Widget, hosted page, later SMS/WhatsApp/voice |
| POST | `/workspaces/:wid/agents/:aid/assist` | AI help: draft persona, improve greeting, suggest capabilities (uses `standard` model) |

### Knowledge
| Method | Path | Notes |
|--------|------|-------|
| GET/POST | `/workspaces/:wid/knowledge/sources` | Upload file (multipart), add URL, add FAQ |
| GET/PATCH/DELETE | `/workspaces/:wid/knowledge/sources/:sid` | Re-index, enable/disable |
| POST | `/workspaces/:wid/knowledge/search` | Debug: returns chunks and scores for a query |

### Conversations, contacts, actions
| Method | Path | Notes |
|--------|------|-------|
| GET | `/workspaces/:wid/conversations` | Filters: agent, channel, status, intent, priority, date, contact, text search; cursor pagination |
| GET | `/workspaces/:wid/conversations/:cid` | Messages, tool calls, citations, actions |
| POST | `/workspaces/:wid/conversations/:cid/takeover` / `release` | Human takeover |
| POST | `/workspaces/:wid/conversations/:cid/messages` | Operator message during takeover |
| PATCH | `/workspaces/:wid/conversations/:cid` | Outcome, tags, close |
| GET | `/workspaces/:wid/stream` | SSE: new conversations, messages, actions |
| GET/PATCH | `/workspaces/:wid/contacts[/:id]` | |
| GET | `/workspaces/:wid/actions` | Action Queue with filters (type, status, priority, assignee) |
| PATCH | `/workspaces/:wid/actions/:id` | Status, assignee, notes, outcome |

### Integrations, usage, analytics
| Method | Path | Notes |
|--------|------|-------|
| GET | `/workspaces/:wid/integrations` | Catalogue + connection status (real) |
| POST | `/workspaces/:wid/integrations/:provider/connect` | Starts OAuth or stores API key (encrypted) |
| POST | `/workspaces/:wid/integrations/:id/test` | Real health check |
| DELETE | `/workspaces/:wid/integrations/:id` | Revoke and delete credentials |
| GET | `/workspaces/:wid/usage` | Current period usage vs limits |
| GET | `/workspaces/:wid/analytics/summary` | Range-bound metrics (12 §6 defines each) |

### Public (widget / hosted page)
| Method | Path | Auth |
|--------|------|------|
| GET | `/v1/public/channels/:publicKey/config` | Publishable key; returns greeting, branding, suggested prompts |
| POST | `/v1/public/channels/:publicKey/conversations` | Creates conversation; returns signed conversation token |
| POST | `/v1/public/conversations/:cid/messages` | Conversation token; streams reply (SSE) |
| GET | `/v1/public/conversations/:cid/events` | SSE for operator takeover messages |

### Hooks
| Method | Path | Auth |
|--------|------|------|
| POST | `/v1/hooks/:provider` | Provider signature verification (Twilio, Meta, calendar push) |
| GET | `/v1/integrations/oauth/callback` | OAuth state parameter bound to session + workspace |

Removed from today's API: `GET /api/state` (leaked everything), `POST /api/tenants/switch` (server-side active tenant), `POST /api/simulate/webhook` (replaced by test conversations and public endpoints), `GET /api/sessions`, `POST /api/sessions/reset`.

## 6. Configuration

`config/env.ts` validates environment at boot with zod and fails fast:

```
NODE_ENV, PORT, APP_URL, API_URL
DATABASE_URL, DATABASE_POOL_MAX
SESSION_SECRET, ENCRYPTION_KEY (32 bytes, base64; for integration credentials)
GEMINI_API_KEY
AI_MODEL_FAST, AI_MODEL_STANDARD, AI_MODEL_REASONING, AI_MODEL_EMBEDDING
EMAIL_PROVIDER, EMAIL_API_KEY, EMAIL_FROM
STORAGE_BUCKET, STORAGE_* credentials
LOG_LEVEL
```

`.env.example` documents each with a comment. Secrets never appear in logs (pino redaction) or API responses.

## 7. Logging, audit and observability

- **Application logs:** pino JSON, one line per request plus domain events (`agent.published`, `action.created`, `ai.call` with model, tokens, latency, outcome). Message text and contact details are not logged; IDs are.
- **Audit log table:** who changed what, for agent publishes, profile changes, member changes, integration connects, data exports and deletions. Visible to workspace admins.
- **Tracing:** OpenTelemetry SDK with HTTP, pg and outgoing fetch instrumentation; exporter configurable (13).
- **Error tracking:** Sentry (or equivalent) for API, worker and web.

## 8. Jobs (pg-boss)

| Job | Trigger | Retry |
|-----|---------|-------|
| `knowledge.index` | Source added/changed | 3× exponential; marks source `failed` with reason |
| `knowledge.recrawl` | Scheduled per URL source (opt-in) | 1× |
| `notify.action` | P0/P1 action created; digest for others | 5× |
| `webhook.deliver` | Domain events for workspaces with outbound webhooks | 8× with backoff, signed payloads, dead-letter |
| `integration.sync` | e.g. CRM lead push | 5× |
| `usage.rollup` | Hourly | — |
| `conversation.autoclose` | Inactivity timeout | — |
| `retention.purge` | Daily; per-workspace retention settings | — |

Jobs carry `workspaceId` and run inside `withWorkspaceTx`.

## 9. Migration from current backend

1. Create `apps/api` with the module skeleton, env validation, error handling, logging. Port engine code untouched into `legacy/` so the current demo keeps working during the transition.
2. Introduce the database and move seed tenants into `db/seed.ts` as demo workspaces (with business profiles filled in properly).
3. Re-implement routes module by module against the database; delete `legacy/` routes as each is replaced.
4. Replace the engine with the runtime (07) behind the same conversation endpoints.

## Verification

- Every route in §5 has an integration test covering: success, validation failure, unauthenticated, wrong-workspace (expects 404), insufficient role (expects 403).
- Booting with a missing required env var exits with a clear message.
- A forced exception returns `{ error: { code: 'INTERNAL', requestId } }` and a log line with the same `requestId` and stack.
