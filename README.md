# FJ-Tech AI Agent Platform

Multi-tenant platform for businesses to run AI agents that talk to their customers.
The transformation plan lives in [`plans/`](plans/README.md); the phased roadmap is
[`plans/14-roadmap.md`](plans/14-roadmap.md).

## Layout (npm workspaces)

| Path | What it is |
|------|-----------|
| `apps/web` | Next.js dashboard (UI only). Forwards every `/api/*` request to the API. |
| `apps/api` | Express API — the only API. TypeScript, Postgres via Drizzle, Better Auth. |
| `apps/api/src/modules` | Domain modules: tenancy, profile, agents, conversations, actions |
| `apps/api/src/db` | Schema, migrations runner, seed data. SQL migrations in `apps/api/drizzle/` |
| `apps/api/src/legacy` | The original rule-based agent engine (replaced in Phase 2) |
| `packages/shared` | Zod schemas, roles/permissions and enums shared by API and web |
| `plans/` | Architecture and roadmap documents |

## Running locally

Requires Node 22.12+ (`.nvmrc`).

```bash
npm install
```

```bash
cp .env.example .env
```

```bash
npm run dev
```

This starts the API on http://localhost:4000 and the dashboard on http://localhost:3000.

No database server is needed for development: by default the API uses PGlite, an embedded
Postgres stored in `.data/dev-db`. On first start it applies migrations and seeds three demo
businesses. Demo login: `demo@fj-tech.local` / `DemoPassword!2026` (development only).

To use a real Postgres server instead, set `DATABASE_URL=postgres://…` and run:

```bash
npm run db:migrate
```

```bash
npm run db:seed
```

## API overview

- `POST /api/auth/sign-up/email`, `POST /api/auth/sign-in/email`, … — Better Auth
- `GET /api/v1/me` — the signed-in user, their organizations and workspaces
- `/api/v1/orgs/:orgId/…` — workspaces, members, invitations
- `/api/v1/workspaces/:workspaceId/…` — profile, agents (+ versions, publish, rollback),
  test conversations, the Action Queue, members, audit log

Every workspace route checks the caller's role (`packages/shared/src/permissions.ts`), and
every tenant table is protected by Postgres row-level security (`apps/api/drizzle/0001_rls.sql`).

The current dashboard still uses the old in-memory demo endpoints (`/api/state`, …). They are
unauthenticated, enabled only in development, and go away when the dashboard is rebuilt (Phase 3).

## Checks

```bash
npm run lint
```

```bash
npm run typecheck
```

```bash
npm test
```

```bash
npm run build
```

`npm test` runs unit tests, API tests, row-level security tests and the tenant isolation suite,
each against a fresh in-memory Postgres. CI (`.github/workflows/ci.yml`) also checks that the SQL
migrations match the schema.

## Changing the database schema

Edit `apps/api/src/db/schema.ts`, then generate a migration:

```bash
npm run db:generate
```

New tenant tables must have a `workspace_id` column and be added to `TENANT_TABLES` and to a
row-level security migration (the RLS test fails otherwise).

## Production

- `DATABASE_URL` must be a real Postgres server; run `npm run db:migrate` as a release step.
- `AUTH_SECRET` (32+ characters) and `APP_URL` are required.
- `BACKEND_URL` must point at the deployed API; the Next.js build fails without it.
- The API reads `API_PORT`, falling back to `PORT`.
