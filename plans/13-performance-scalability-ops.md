# 13 — Performance, Scalability and Operations

## 1. Current state

- All state in process memory; each serverless instance would have its own data, which is why "rehydration from client snapshot" code exists (`backend/server.js:226, 350, 419, 439`).
- A previous commit configured Vercel to run Express as a function (`0105d9f` added `vercel.json`, later deleted in `87e8626`). The uncommitted `next.config.mjs` rewrite to `BACKEND_URL` suggests a separate backend host is being considered.
- `setInterval` cleanup at module load (`conversationState.js:218`) does not work reliably on serverless.
- No monitoring, logging pipeline, backups (nothing to back up), or runbooks.
- `.next/` build output is tracked in git.
- `Launch-Platform.bat` hardcodes a Windows Node path.

## 2. Deployment topology (recommended)

| Component | Host | Notes |
|-----------|------|------|
| `apps/web` | Vercel (or any Node host) | Next.js native; preview deployments per PR |
| `apps/api` | Container on Render / Railway / Fly.io / Cloud Run (min 2 instances in production) | Long-lived for SSE streaming; later websockets for voice |
| Worker | Same image as API, `node worker.js`, 1+ instances | pg-boss jobs |
| PostgreSQL + pgvector | Managed (Neon, Supabase, RDS, Cloud SQL) | PITR backups, read replica later |
| Object storage | S3-compatible (S3, R2, GCS) | Knowledge uploads, logos |
| Widget assets | CDN (Vercel/Cloudflare) on a dedicated origin | Long-cache, versioned |
| Email | Postmark or Resend | Transactional only |
| Errors | Sentry | Web, API, worker |
| Logs/metrics/traces | OpenTelemetry → Grafana Cloud, Datadog, or Axiom | Choose by budget |

Environments: `local` (Docker Compose: Postgres + MinIO + mailpit), `preview` (per PR, shared staging DB with isolated schema or branch DB if using Neon), `staging`, `production`. Infrastructure as code (Terraform or the host's config files) once we have more than one environment.

Releases: migrations run first (backward compatible), then API/worker rolling deploy, then web. Feature flags gate risky features. Rollback = redeploy previous image; migrations designed expand/contract so rollback is safe.

## 3. Rate limiting and quotas

- Implemented behind a `RateLimiter` interface. Start with a Postgres-backed token bucket (single small table with `ON CONFLICT` updates) or in-memory per instance for coarse IP limits; move to Redis when request volume or instance count makes Postgres round-trips noticeable.
- Limits (initial, tunable): auth endpoints 10/min/IP; admin API 600/min/user; public conversation creation 10/hour/IP per channel; public messages 20/min/conversation and 300/hour/IP; AI spend circuit breaker per workspace (hard stop at plan limit, alert at 80%).
- Quotas enforced from `usage_periods` + in-process cache (08 §8).

## 4. Scaling path

The simplest architecture that can grow:

| Scale (approx.) | What changes |
|-----------------|-------------|
| Pilot: ≤ 50 workspaces, ≤ 20k conversations/month | 2 API instances, 1 worker, single Postgres. No Redis. |
| Growth: ≤ 1,000 workspaces, ≤ 1M conversations/month | Add Redis for rate limits and SSE fan-out across instances (pub/sub); Postgres read replica for analytics; partition `messages` and `usage_events` by month; materialized views or rollup tables for analytics |
| Large: beyond | Dedicated analytics store (ClickHouse/BigQuery) fed by CDC; separate voice media service; per-region deployments for data residency |

The dominant cost and latency is the LLM, not our infrastructure. Concurrency of AI calls is limited per workspace (e.g. 20 in-flight) to protect shared provider quota; global queueing with backpressure if provider rate limits are hit.

SSE across multiple API instances: at pilot scale, sticky sessions or per-instance subscriptions via Postgres `LISTEN/NOTIFY`; at growth scale, Redis pub/sub.

## 5. Cost controls

- Per-message cost tracked (tokens × model price) in usage events; dashboard for platform admin by workspace.
- Classifier on the cheapest tier; generation on `standard`; `reasoning` opt-in per plan.
- Context budget: rolling summaries instead of full history; top-5 chunks; web search only when needed.
- Prompt caching (Gemini context caching) for the stable system-prompt prefix per agent version, if available for the chosen model — evaluate at implementation.
- Plans priced so the 95th-percentile workspace is profitable at plan limits.

## 6. Observability

- **Golden signals** per service: request rate, error rate, p50/p95 latency, saturation (DB pool, event loop lag).
- **AI signals:** calls by tier/model, latency, error categories, tokens, cost, circuit-breaker state, guard violations (claim/fact/PII), degraded-mode activations.
- **Product signals:** conversations, actions by type/priority, P0 acknowledgement time, unanswered rate, widget load errors.
- **Alerts:** API error rate > 2% for 5 min; p95 latency over budget; job queue age > 5 min; P0 notification delivery failure (page immediately); AI provider failure rate > 10%; DB connections > 80%; any RLS policy violation error.
- Status page for customers once in GA.

## 7. Data protection and recovery

- Daily backups + point-in-time recovery (≥ 7 days; 30 days in production).
- Quarterly restore drill to staging with checksum comparison.
- Object storage versioning for uploads.
- RPO ≤ 15 minutes, RTO ≤ 4 hours for the pilot; tighten later.

## 8. Runbooks (written before launch)

Provider outage (degraded mode, customer comms), database failover, quota abuse on a public widget, leaked secret rotation (Gemini key, encryption key re-wrap), cross-tenant incident response, P0 notification failure.

## 9. Repository and developer experience

- npm workspaces monorepo (03 §3); one `npm run dev` that starts web, API, worker and local services.
- Replace `Launch-Platform.bat` with documented cross-platform scripts and a `README.md` for developers.
- Untrack `.next/` and add `.turbo`, coverage and build output to `.gitignore`.
- Node LTS pinned via `.nvmrc` / `engines`.

## Verification

- Staging load test (12 §6) meets budgets.
- Kill one API instance during a load test: no data loss, SSE clients reconnect, error rate spike < 1 minute.
- Restore drill completes within RTO.
- Every alert in §6 has fired at least once in staging (synthetic) and reached the on-call channel.
