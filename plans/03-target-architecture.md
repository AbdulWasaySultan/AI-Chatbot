# 03 — Target Architecture

## 1. System overview

```
                         ┌──────────────────────────────┐
  Operators (browser) ──▶│  apps/web  (Next.js 16)      │
                         │  Dashboard, Agent Builder,   │
                         │  Inbox, Action Queue         │
                         │  /api/* → rewrite to API     │
                         └──────────────┬───────────────┘
                                        │ same-origin, httpOnly session cookie
  End customers                          ▼
  ┌──────────────┐        ┌──────────────────────────────────────────────────┐
  │ Web widget   │──────▶ │  apps/api  (Express)  — the only API             │
  │ (vanilla JS, │  CORS  │  /v1/admin/*   operator API (session auth)       │
  │ iframe)      │ allow- │  /v1/public/*  widget/hosted chat (publishable   │
  │ Hosted page  │ list   │                 key + conversation token)         │
  └──────────────┘        │  /v1/hooks/*   inbound provider webhooks (signed) │
  SMS/WhatsApp/voice ────▶│                                                  │
  (later phases)          │  Modules: auth · orgs · workspaces · agents ·    │
                          │  knowledge · conversations · actions ·           │
                          │  integrations · usage · analytics                │
                          │  Agent Runtime (orchestrator, safety, tools)     │
                          └───────┬───────────────┬──────────────┬───────────┘
                                  │               │              │
                       ┌──────────▼───┐   ┌───────▼──────┐  ┌────▼─────────────┐
                       │ PostgreSQL   │   │ Job worker   │  │ External services │
                       │ + pgvector   │◀──│ (same code,  │  │ Gemini API        │
                       │ RLS per      │   │ pg-boss)     │  │ Email (Postmark/  │
                       │ workspace    │   │ indexing,    │  │  Resend)          │
                       └──────────────┘   │ notifications│  │ Calendar, CRM     │
                                          │ webhooks     │  │ Object storage    │
                                          └──────────────┘  └───────────────────┘
```

## 2. Responsibilities (single source of truth per concern)

| Concern | Owner | Not owned by |
|---------|-------|--------------|
| Pages, layout, UI state, client-side validation for UX | `apps/web` | — |
| Every HTTP API, business rule, authorization check | `apps/api` | Next.js route handlers (none, except auth cookie passthrough if the auth library needs one) |
| Data, tenancy enforcement (row-level security) | PostgreSQL | Application memory |
| Conversation state (workflow, collected info) | `conversations.state` column in Postgres | In-memory Maps |
| AI calls | `apps/api/src/ai/providers` | UI, routes |
| Background work (document indexing, notifications, outbound webhooks, retries) | Job worker running the API codebase in worker mode | Request handlers |
| Request/response schemas | `packages/shared` (zod) used by both apps | Duplicated hand-written shapes |
| Embeddable widget | `apps/widget` (small vanilla TS bundle) | Next.js |

Next.js Server Components may fetch from the API server-to-server (forwarding the session cookie) for first paint. They do not contain business logic or talk to the database.

## 3. Repository layout

```
/
├─ apps/
│  ├─ web/                 Next.js app (moved from app/ + frontend/components)
│  ├─ api/                 Express app (moved from backend/)
│  │  └─ src/
│  │     ├─ app.ts          Express app factory (no listen; testable)
│  │     ├─ server.ts       listen()
│  │     ├─ worker.ts       job worker entry
│  │     ├─ config/         env schema (zod), typed config
│  │     ├─ middleware/     requestId, logger, auth, workspaceContext, rateLimit, errors
│  │     ├─ modules/        <domain>/{routes,controller,service,repository,schemas}.ts
│  │     ├─ runtime/        agent runtime (see 07)
│  │     ├─ ai/             providers, model registry, usage metering
│  │     ├─ integrations/   calendar, crm, email, webhooks
│  │     ├─ jobs/           job definitions
│  │     └─ db/             drizzle schema, migrations, tx helper with RLS
│  └─ widget/              embeddable chat widget
├─ packages/
│  ├─ shared/              zod schemas, enums, API types
│  └─ evals/               conversation eval cases and runner
├─ plans/                  these documents
└─ package.json            npm workspaces root
```

## 4. Key decisions

Each decision lists alternatives and why the recommendation wins. Decisions marked **(confirm)** are also listed in 15 for your sign-off.

### D1. Express is the only API; delete Next.js route handlers
- **Problem:** Two APIs with diverging data and engines; Next routes shadow Express (02 §3.1).
- **Decision:** Remove `app/api/**` and `lib/platformStore.js`. Next.js proxies `/api/*` to Express with a `beforeFiles` rewrite (or simply has no conflicting routes).
- **Why not move everything into Next.js?** The brief requires Express, the engine lives there, and long-lived work (streaming conversations, jobs, inbound provider webhooks, future voice websockets) fits a long-running Node server better than serverless route handlers.

### D2. TypeScript for all new and migrated code **(confirm)**
- **Why:** Multi-tenant correctness depends on never forgetting a `workspaceId`; types make tenant-scoped repository signatures enforceable. Shared zod schemas give one definition for validation and types across web and API.
- **Cost:** Migration effort. Mitigation: the backend is being restructured anyway; the frontend is being rebuilt component-by-component.
- **Alternative:** JavaScript with JSDoc + zod. Acceptable but weaker; not recommended for a commercial product.

### D3. PostgreSQL + pgvector as the single datastore
- **Why:** Relational integrity for tenants, agents, conversations and actions; row-level security for defense in depth; pgvector keeps knowledge embeddings beside the data they belong to, so tenant filtering is a SQL `WHERE` plus RLS, not a separate vector service with its own isolation story.
- **Alternatives:** MongoDB (weaker integrity and no RLS); separate vector DB such as Pinecone (extra service, second isolation boundary, not needed below tens of millions of chunks).
- **Hosting:** Any managed Postgres with pgvector (Neon, Supabase, RDS, Cloud SQL). Decision deferred to Phase 1 kickoff; no code depends on the vendor.

### D4. Drizzle ORM with SQL migrations
- **Why:** Thin, SQL-first, works naturally with `SET LOCAL` session variables needed for RLS inside transactions, generates readable migrations, good TypeScript inference.
- **Alternative:** Prisma. Excellent DX but RLS needs workarounds (client extensions wrapping every query in a transaction), and the query engine adds weight. Reasonable second choice.

### D5. Tenant isolation in two layers
1. **Application:** every repository function takes a `WorkspaceContext` and filters by `workspace_id`. Route middleware resolves the context from the authenticated membership, never from the request body.
2. **Database:** RLS policies on every tenant table compare `workspace_id` to `current_setting('app.workspace_id')`, set per transaction. A missed filter in code returns zero rows instead of another tenant's data.
Details in 06.

### D6. Authentication with Better Auth inside Express **(confirm)**
- **Why:** Self-hosted, open source, supports email/password, magic links, OAuth (Google/Microsoft), organizations and invitations, and runs inside Express with httpOnly cookie sessions stored in our Postgres. No per-user vendor fees, data stays with us.
- **Alternatives:** Clerk (fastest to ship, polished UI, but per-MAU cost and user data outside our DB); Auth.js (Next-centric, awkward when Express owns the API); hand-rolled (not recommended).
- **Risk:** Library maturity. Mitigation: wrap it behind an `auth` module interface so it can be swapped.

### D7. Background jobs on Postgres (pg-boss), no Redis initially
- **Why:** Document indexing, notifications, webhooks and retries need durable jobs. pg-boss uses the existing database, so there is one less service to operate.
- **When to add Redis:** when we run multiple API instances and need shared rate-limit counters at high request rates, or pub/sub for live Inbox updates across instances. The rate limiter and event bus are written behind interfaces so Redis can be introduced without touching callers (13 §3).

### D8. Gemini via `@google/genai`, behind a provider interface
- Port the existing provider to the current SDK. Model IDs come from config, mapped to tiers (`fast`, `standard`, `reasoning`, `embedding`), never hardcoded.
- Google Search grounding is exposed to agents as a `web_search` **tool** executed in a separate grounded call. This works regardless of whether a given model allows search grounding and function calling together, keeps per-tenant quota and logging in our hands, and keeps web content out of the main prompt except as clearly delimited tool output. See 08.

### D9. Real-time updates via Server-Sent Events
- Agent replies stream to the widget and test pane over SSE. Inbox and Action Queue receive live updates over SSE from the API. WebSockets only when voice requires them.

### D10. Deployment: web on Vercel (or any Node host), API + worker as long-running containers **(confirm)**
- The API keeps SSE connections open, runs jobs and will later accept telephony websockets; serverless functions are a poor fit. Render, Railway, Fly.io or Cloud Run all work. Details in 13.

### D11. Tailwind CSS v4 compiled at build time, plus a small component library we own
- Remove the CDN script. Use Tailwind with design tokens as CSS variables (10). Build accessible primitives on Radix UI primitives (dialog, popover, dropdown, tabs, tooltip, toast) with our own styling. No full third-party UI kit, so the product keeps its own identity.

### D12. Data fetching with TanStack Query
- Caching, background refresh, optimistic updates and consistent loading/error states, replacing ad hoc `fetch` + `useState`. Server Components used for shells and first paint where it helps.

## 5. Request lifecycles

### 5.1 Operator updates an agent
1. Browser → `PATCH /api/v1/admin/workspaces/:wid/agents/:aid` (Next rewrite → Express).
2. `requestId` → `logger` → `session` (Better Auth) → `workspaceContext` (checks membership for `:wid`, loads role) → `authorize('agent:update')` → zod validation.
3. Service updates the **draft** version inside `withWorkspaceTx(ctx, tx => …)`, which sets `app.workspace_id` for RLS.
4. Audit log entry written in the same transaction.
5. 200 with the updated draft; TanStack Query updates caches.

### 5.2 End customer sends a widget message
1. Widget → `POST /v1/public/conversations/:cid/messages` with publishable key + conversation token. Origin checked against the agent's domain allowlist; per-IP and per-conversation rate limits.
2. Runtime loads conversation state, published agent version and workspace profile within the workspace transaction.
3. Safety pre-check → orchestrator loop (LLM with tools) → claim guard → reply streamed over SSE.
4. Messages, tool calls, citations, actions and usage are persisted. P0/P1 actions enqueue notification jobs.

## 6. What happens to existing code

| Existing | Destination |
|----------|-------------|
| `backend/server.js` routes | Split into `modules/workspaces`, `modules/agents`, `modules/conversations`; seed data moves to `db/seed.ts` |
| `backend/engine/*` | Concepts move to `runtime/` (07). Regex detector becomes `runtime/safety/keywordBackstop.ts` |
| `backend/providers/*` | `ai/providers/gemini.ts` on the new SDK; usage moves to `ai/usage.ts` (persisted) |
| `backend/tests/agentEngine.test.js` | `packages/evals/cases/*.yaml` |
| `frontend/components/*` | Rebuilt as routed pages and components in `apps/web` (11) |
| `app/globals.css` | Replaced by token-based CSS (10) |

## Verification

The architecture is in place when: (1) `app/api` does not exist and every `/api/*` request in the browser network tab is served by Express; (2) restarting the API loses no data; (3) the isolation test suite (12 §4) passes with RLS enabled and also passes when application-level filters are deliberately removed in a test build (proving RLS alone blocks cross-tenant reads); (4) the API and worker run as separate processes from one codebase.
