# 14 — Implementation Roadmap

## 1. Sequencing logic

1. **Remove the false foundation first.** Duplicate APIs and fabricated UI data make every later measurement wrong.
2. **Data, auth and tenancy before features.** Every feature touches workspace-scoped data; building features on the in-memory store means building them twice.
3. **Runtime before UI polish.** The agent's behavior is the product; the new UI must show real runtime data (intents, tool calls, actions).
4. **Design system in parallel with backend phases.** It has no backend dependency and is on the critical path for Phase 3.
5. **One real channel (web widget) to a pilot before integrations, billing and other channels.**
6. **Voice last**, as its own project.

Estimates assume 2 full-stack engineers plus part-time design. They are planning ranges, not commitments; they will be re-estimated at the start of each phase.

```
Week:        1   3   5   7   9   11  13  15  17  19  21  23  25
Phase 0      ██
Phase 1        ████████
Design sys     ██████████                       (parallel track)
Phase 2                ██████████
Phase 3                    ████████████
Phase 4                              ██████      → Pilot
Phase 5                                    ██████
Phase 6                                          ████████ → GA gate
Phase 7/8                                                  (later)
```

---

## Phase 0 — Stabilize and clean (≈ 1 week)

**Objective:** One source of truth for the API, a clean repository, and a demo that no longer misleads.

**Scope / required changes**
- Must: delete `app/api/**` and `lib/platformStore.js`; make Next.js proxy all `/api/*` to Express (local dev and deployed).
- Must: untrack `.next/`; delete the legacy `frontend/index.html`, `app.js`, `views.js`, `icons.js`, `styles.css` (after confirming nothing else uses them); remove root `server.js` and replace `Launch-Platform.bat` with npm scripts.
- Must: fix double-encoded strings in `CommandCenterApp.jsx` and `Studios.jsx`; remove the BOMs.
- Must: replace CDN Tailwind with compiled Tailwind (keeping the current look for now).
- Should (demo safety, small and throwaway): send a per-conversation `sessionKey` from every test surface; stop the "booked" claim (B7); remove `help me`/bare `fire`/`electrical` from P0 patterns (B1, B2); hide "Connected" badges and hardcoded KPIs behind a visible "Demo data" label.
- Must: add ESLint, Prettier, Vitest; make the existing engine test exit cleanly; add a CI workflow running lint + tests.

**Dependencies:** your approval of D1 (Express only).
**Expected outcome:** Every browser request is served by Express; no fabricated agent claims; repo builds in CI.
**Testing:** existing 58 assertions pass in Vitest; manual check of network tab; B1, B2, B7 regression tests added.
**Acceptance criteria:** `app/api` absent; `git ls-files .next` empty; CI green on `main`; no `â€`/`ðŸ` sequences in source; demo shows no hardcoded "Connected" integration.

---

## Phase 1 — Foundations: monorepo, database, auth, tenancy (≈ 3–4 weeks)

**Objective:** A secure, persistent, multi-tenant backend skeleton that every feature builds on.

**Scope**
- Monorepo layout (03 §3), TypeScript, shared zod schemas package.
- Express app restructure: middleware chain, error model, logging, env validation (04).
- PostgreSQL schema for identity, tenancy, business profile, agents/versions, channels, conversations/messages/tool calls, actions, audit (05). RLS policies and `withWorkspaceTx`.
- Better Auth: email/password, magic link, Google; organizations, workspaces, memberships, invitations, roles (06).
- Modules: `auth`, `orgs`, `workspaces` (incl. business profile CRUD), `agents` (CRUD + versions + publish/rollback, no runtime change yet), `actions` (CRUD).
- Seed: convert the three demo businesses into the new tables.
- Isolation test suite (12 §4) as a blocking CI job.
- Current rule engine wired to the new conversation tables temporarily (state persisted per conversation, not per process) so the demo keeps working.

**Dependencies:** Phase 0; decisions D2 (TypeScript), D3/D4 (Postgres/Drizzle), D6 (auth library), hosting choice for Postgres.
**Expected outcome:** Users can sign up, create organizations/workspaces, edit business profile and agents via API, with data persisted and isolated.
**Testing:** API integration tests per route; isolation suite; RLS-only build test; migration up from empty DB.
**Acceptance criteria:** 100% of routes covered by isolation tests; restart loses no data; T1–T6 defects cannot be reproduced; no route accepts a workspace ID from the body.

---

## Design system track (parallel with Phases 1–2, ≈ 4–5 weeks part-time)

**Objective:** The visual identity and component library in 10, ready before Phase 3.

**Scope:** tokens (light/dark), typography with `next/font`, core components, domain components (Transcript, ActionCard, HoursEditor…), Storybook with a11y checks, contrast CI check, key screen mockups (Home, Inbox, Actions, Agent Builder, onboarding) reviewed with 3–5 target users.
**Dependencies:** your approval of the design direction (15, Q4).
**Acceptance criteria:** all components in Storybook with light/dark and keyboard stories; contrast check passes; mockups approved.

---

## Phase 2 — Agent runtime v2, Gemini, knowledge, evals (≈ 4–5 weeks)

**Objective:** Agents that understand natural language, follow safe workflows, use knowledge and the web with citations, and never fabricate.

**Scope**
- Provider layer on `@google/genai` with model tiers, retries, timeouts, circuit breaker, usage events (08 §2, §8). Verify current model IDs against Google's deprecations page.
- Runtime pipeline: triage (classifier + rewritten keyword backstop), policy layer with declarative workflows and preemption/resumption, context assembly, generation with function calling, streaming, guards, commit (07).
- Capabilities: universal four + `appointment_booking` (request mode), `lead_qualification`, `support_ticketing`, `web_research`. Industry templates for the three seed industries + generic.
- Tools including `create_action` writing to the Action Queue; email notifications for P0/P1 (needs email provider).
- Knowledge ingestion (files, URLs, FAQs), chunking, embeddings, hybrid retrieval, citations (08 §7).
- Web search tool with grounding citations, quotas, domain filters, search-suggestion display data (08 §4).
- Degraded mode (07 §11).
- Eval harness and initial ~300 cases (12 §3); shadow comparison against old engine; then remove `backend/engine/`.
- SSE streaming endpoints for test conversations.

**Dependencies:** Phase 1 (conversations, actions, agents tables; auth); Gemini API key on a billing-enabled project; email provider account.
**Expected outcome:** Through the API, a test conversation against a draft agent behaves per 07, with persisted messages, tool calls, actions and citations.
**Testing:** eval thresholds (12 §3.3); provider contract tests; injection tests; unit tests per workflow.
**Acceptance criteria:** all §3.3 thresholds met on the full eval set; B1–B11 fixed; P0 action triggers a real email in staging; web answers carry real citations; provider outage triggers degraded mode in a chaos test.

---

## Phase 3 — Product UI rebuild (≈ 5–6 weeks, overlaps Phase 2)

**Objective:** The operator experience in 11, on the new design system, wired to real APIs.

**Scope (in order):** auth screens and onboarding; app shell with workspace in URL, command palette and real notifications; Agent Builder with test pane, versions and publish; Business profile editors; Knowledge (incl. unanswered questions); Inbox with transcript details and takeover; Actions queue; Home; Settings (members, channels, branding, usage, data, audit); Integrations catalogue with honest states. Delete `Studios.jsx` and `CommandCenterApp.jsx` as replacements land.
**Dependencies:** Phase 1 APIs (profile, agents, actions); Phase 2 for test pane, Inbox details, knowledge; design system track.
**Expected outcome:** A new user can go from sign-up to a tested, published agent without touching code; operators can run the Inbox and Action Queue.
**Testing:** component tests, E2E flows 1, 4, 5, 6 (12 §5), usability test with 5 users.
**Acceptance criteria:** no hardcoded metrics or fake states anywhere (lint check); Lighthouse a11y ≥ 95; onboarding median < 15 min in usability testing; all four UI states (11 §7) implemented on every data view.

---

## Phase 4 — Web widget, hosted page, pilot launch (≈ 3 weeks)

**Objective:** First real channel in customers' hands.

**Scope:** `apps/widget` loader + iframe app; public API (channel config, conversations, messages, SSE) with origin allowlist, conversation tokens and rate limits; hosted chat page; deploy step in builder; customer-facing branding with contrast checks; operator takeover reflected in widget; security review checklist (06 Verification); staging and production environments with monitoring and backups (13).
**Dependencies:** Phases 2 and 3; production hosting decisions (D10).
**Expected outcome:** 3–5 pilot businesses live on their websites.
**Testing:** E2E flows 2 and 3; load test (12 §6); ZAP baseline; manual cross-browser and mobile widget testing.
**Acceptance criteria:** widget works on allowed origins only; budgets met (loader < 15 KB gz); P0 flow from widget to email to acknowledgment works end-to-end in production; runbooks written; backup restore drill done.

---

## Phase 5 — Integrations (≈ 3–4 weeks)

**Objective:** Turn requests into completed actions where customers want automation.

**Scope (priority order):** Google Calendar + Cal.com availability and booking (booking capability switches from request to real booking when connected); outbound webhooks with signed payloads and delivery log; Slack notifications; HubSpot lead sync; Twilio SMS notifications to staff.
**Dependencies:** Phase 4 pilot feedback; OAuth app registrations (Google verification can take weeks — start in Phase 3).
**Acceptance criteria:** each integration has a real `test` call; bookings appear in the connected calendar; agent says "booked" only after `SUCCESS`; failures surface in Integrations and notify admins.

---

## Phase 6 — Analytics, usage limits, billing, agency console → GA gate (≈ 4 weeks)

**Scope:** analytics screens on rollup tables (12 §7 definitions); plan limits enforced with UI warnings; Stripe subscriptions and customer portal; agency console (clients, templates, cross-client health); audit log UI; data export and deletion; status page; external penetration test; legal (ToS, privacy policy, DPA; PHI policy per 06 §6).
**GA acceptance criteria:** all Phase gates green; pentest findings of high severity fixed; eval thresholds stable for 2 weeks in production monitoring; P0 acknowledgment metrics visible to customers.

---

## Phase 7 — Messaging channels (later)

SMS (Twilio, A2P 10DLC registration) and WhatsApp (Meta Cloud API). Same runtime; channel-specific formatting; opt-out handling. Separate short design doc before starting.

## Phase 8 — Voice (later, separate project)

Telephony numbers, streaming speech, latency engineering, recording consent, warm transfer. Requires its own architecture document and cost model. The runtime's policy, tools and guards are reused through function calling.

---

## What can be postponed safely

- Multiple LLM providers (keep the interface; implement only Gemini).
- Redis (until 13 §4 growth thresholds).
- Custom domains for hosted pages.
- No-code workflow builder.
- Multi-language agents (design data model with `locale` now; ship English first).

## What must not be postponed

- RLS and isolation tests (Phase 1).
- Claim guard and emergency evals (Phase 2).
- Action Queue with notifications (Phase 2–3) — without it, honest agent replies are empty promises.
- Removing fake UI states (Phase 0 labels, Phase 3 removal).
