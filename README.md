# FJ-Tech AI Agent Platform

Multi-tenant platform for businesses to run AI agents that talk to their customers.
The transformation plan lives in [`plans/`](plans/README.md); the phased roadmap is
[`plans/14-roadmap.md`](plans/14-roadmap.md).

## Layout

| Path | What it is |
|------|-----------|
| `app/`, `frontend/components/` | Next.js dashboard (UI only) |
| `backend/` | Express API — the only API. Agent engine in `backend/engine/` |
| `backend/tests/` | Vitest tests for the engine |
| `plans/` | Architecture and roadmap documents |

Next.js forwards every `/api/*` request to Express (see `next.config.mjs`).

## Running locally

Requires Node 20+ (`.nvmrc` pins 22).

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
Run them separately with `npm run dev:api` and `npm run dev:web`.

Data is held in memory for now and resets when the API restarts (a database arrives in Phase 1).

## Checks

```bash
npm run lint
```

```bash
npm test
```

```bash
npm run build
```

CI (`.github/workflows/ci.yml`) runs all three on every push to `main` and every pull request.

## Production

- `BACKEND_URL` must point at the deployed Express API; the Next.js build fails without it.
- The API reads `API_PORT`, falling back to `PORT`.
