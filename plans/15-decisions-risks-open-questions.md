# 15 — Decisions, Risks and Open Questions

## 1. Decision log

| ID | Decision | Recommendation | Alternatives considered | Status |
|----|----------|---------------|------------------------|--------|
| D1 | Single API owner | Express only; delete Next `app/api` | Move all to Next route handlers | **Needs approval** |
| D2 | Language | TypeScript across web, API, shared | JS + JSDoc + zod | **Needs approval** |
| D3 | Database | PostgreSQL + pgvector | MongoDB; Postgres + separate vector DB | Recommended |
| D4 | ORM | Drizzle | Prisma | Recommended |
| D5 | Isolation | App-level scoping + Postgres RLS | App-level only | Recommended (non-negotiable in my view) |
| D6 | Auth | Better Auth in Express | Clerk (hosted); Auth.js | **Needs approval** |
| D7 | Jobs | pg-boss on Postgres; Redis later | BullMQ + Redis from day one | Recommended |
| D8 | AI provider | Gemini via `@google/genai`, tiered models, web search as a separate grounded tool call | Single combined call with search + tools | Recommended |
| D9 | Realtime | SSE | WebSockets | Recommended |
| D10 | Hosting | Web on Vercel; API + worker as containers | Everything on Vercel serverless | **Needs approval** (vendor choice) |
| D11 | Styling | Compiled Tailwind v4 + owned components on Radix | Third-party UI kit | Recommended |
| D12 | Data fetching | TanStack Query + SSE | SWR; Server Actions only | Recommended |
| D13 | Tenancy hierarchy | Organization → Workspace (supports direct businesses and agencies) | Flat tenants | **Needs approval** |
| D14 | Channel order | Web widget → hosted page → SMS/WhatsApp → voice | Voice first (current UI emphasis) | **Needs approval** |
| D15 | Action Queue as the backbone for agent actions | Yes | Integrations-only | Recommended |
| D16 | Dashboard branding | Platform identity; tenant branding only on customer-facing surfaces | Full dashboard white-label | **Needs approval** |
| D17 | Visual direction | "Operator console": ink, paper, brass; IBM Plex | Keep current indigo/cyan look | **Needs approval** |

## 2. Questions for you

1. **Business model.** Is the primary customer an agency reselling to many businesses (the current "FJ-Tech master agency" framing), businesses signing up directly, or both? This decides how prominent the agency console is in Phase 3 versus Phase 6.
2. **Pilot customers.** Are Apex Dental, Vanguard Realty and Solaris HVAC real prospects or demo fixtures? Real pilots change Phase 4 priorities (e.g. calendar integration earlier).
3. **Healthcare.** Do you intend to sell to US healthcare (dental, medical) soon? If yes, we need Vertex AI under a Google BAA and HIPAA-eligible vendors before onboarding them (06 §6). If not, the terms of service should prohibit PHI for now.
4. **Design direction.** Do you approve the operator-console identity (10 §2–4)? I can produce a clickable mockup of Home, Inbox and Agent Builder in the design track before any production UI code.
5. **Product name.** Keep "FJ-Tech Solutions" for the platform, or choose a product name distinct from the agency name?
6. **Voice.** Is voice required for your first paying customers? If yes, we should start a voice architecture spike during Phase 2 rather than waiting for Phase 8, and accept a later pilot date.
7. **Hosting and budget.** Any existing accounts or preferences (Vercel, Google Cloud, AWS, Render)? Since Gemini is already chosen, Google Cloud (Cloud Run + Cloud SQL + Vertex AI option) is a coherent single-vendor path.
8. **Team.** Who will implement: me with you reviewing, additional engineers, or both? Estimates in 14 assume two engineers.
9. **Gemini API key.** It currently lives in a local `.env`. Please confirm it is on a billing-enabled project (so data is not used for model training under free-tier terms) and plan to rotate it before production.
10. **Uncommitted changes.** `backend/server.js` and `next.config.mjs` have uncommitted edits (removing static serving; adding the `BACKEND_URL` rewrite). Phase 0 builds on them; please confirm they reflect your intent.

## 3. Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|-----------|
| R1 | LLM misses an emergency or invents a commitment | Medium | Severe (safety, liability) | Deterministic backstop, policy layer, claim/fact guards, 100% recall gate, production monitoring of guard violations, human P0 notifications |
| R2 | Cross-tenant data exposure | Low after Phase 1 | Severe | RLS + isolation suite + pentest |
| R3 | Gemini model deprecations change behavior | High (frequent model churn) | Medium | Tier config, model ID per message, eval gate before upgrades |
| R4 | Gemini grounding terms (display, caching) not followed | Medium | Medium (ToS breach) | Legal review in Phase 2; render search suggestions; no caching unless allowed |
| R5 | Provider outage or rate limits | Medium | High | Retries, circuit breaker, degraded mode, per-workspace concurrency caps |
| R6 | Public widget abused to burn AI spend | Medium | Medium | Rate limits, quotas, Turnstile, spend alerts |
| R7 | Healthcare customers share PHI before compliance is ready | Medium | Severe (regulatory) | Decision on Q3; ToS; Vertex AI + BAA path |
| R8 | Scope creep toward voice before chat is solid | Medium | High (delays revenue) | D14; separate voice project |
| R9 | Google OAuth verification delays calendar integration | Medium | Low–Medium | Start verification in Phase 3; Cal.com as alternative |
| R10 | SMS/WhatsApp registration lead times (A2P 10DLC, Meta verification) | High when started | Medium | Start registrations early in Phase 6 for Phase 7 |
| R11 | Rebuild takes longer than estimated | Medium | Medium | Phase gates, re-estimation per phase, keep demo running through Phase 1 |
| R12 | Better Auth library maturity | Low–Medium | Medium | Wrapped behind `auth` module interface; Clerk as fallback |
| R13 | Eval suite gives false confidence (passes but real traffic differs) | Medium | High | Grow cases from production "unanswered" and flagged conversations weekly; human review sample |

## 4. Known uncertainties (stated, not hidden)

- **Exact current Gemini model IDs and feature support** (e.g. whether a given model can combine search grounding with function calling in one request, URL context availability, context caching). The architecture avoids depending on these; IDs will be verified against official docs at Phase 2 start.
- **`@google/generative-ai` end-of-support date:** sources agree it is superseded by `@google/genai`; I did not find the official shutdown date. Migration is planned regardless.
- **Better Auth feature fit** for our exact org/workspace model will be validated in a 1–2 day spike at Phase 1 start; Clerk is the fallback.
- **Grounding pricing and quotas** must be confirmed when sizing plans.
- **Estimates** in 14 are ranges for planning, to be re-estimated per phase.

## 5. Confirmation regarding this phase

During this planning phase no application source code, configuration, dependency, lockfile, environment file or database schema was created, modified or deleted. The only changes are the new Markdown files in `plans/`. Non-destructive commands were run: reading files, `git log`/`git diff`/`git ls-files`, running the existing engine test suite, and running read-only probe scripts (kept in the session scratchpad, outside the repository) against the engine modules.
