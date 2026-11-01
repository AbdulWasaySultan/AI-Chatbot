# Transformation Plans — Index

These documents are the blueprint for turning the current FJ-Tech "AI Command Center" prototype into a commercial, multi-tenant AI agent platform. They were written after reading every source file in the repository (45 tracked files, ~13.6k lines), running the existing engine test suite, and probing the engine with realistic customer messages.

**Status:** Planning only. No application code, configuration, or dependency has been changed. Every recommendation below is waiting for review and explicit approval before implementation begins.

---

## How to read this set

Read in this order if you have one hour:

1. [01-product-vision.md](01-product-vision.md) — what we are building, for whom, and where I recommend changing the original vision.
2. [02-current-state-audit.md](02-current-state-audit.md) — what exists today, what works, what is broken, with file and line references.
3. [03-target-architecture.md](03-target-architecture.md) — the recommended system shape and the key decisions behind it.
4. [14-roadmap.md](14-roadmap.md) — the phased implementation order, with acceptance criteria.
5. [15-decisions-risks-open-questions.md](15-decisions-risks-open-questions.md) — the decisions I need from you.

The rest are deep-dives used during implementation.

| # | Document | What it covers |
|---|----------|----------------|
| 01 | [Product vision](01-product-vision.md) | Personas, object model, tenancy hierarchy, scope, challenges to the original brief |
| 02 | [Current-state audit](02-current-state-audit.md) | File-by-file audit, feature reality matrix, bug list with evidence |
| 03 | [Target architecture](03-target-architecture.md) | System diagram, repo layout, Next.js vs Express responsibilities, ADR-style decisions |
| 04 | [Backend architecture](04-backend-architecture.md) | Express module layout, middleware chain, API catalogue, errors, logging, jobs |
| 05 | [Data model](05-data-model.md) | PostgreSQL schema, tenancy columns, row-level security, migrations, seed data |
| 06 | [Tenancy, auth and security](06-tenancy-auth-security.md) | Auth, roles and permissions, isolation guarantees, secrets, threat model, compliance |
| 07 | [Agent runtime](07-agent-runtime.md) | Orchestration pipeline, safety layer, intent taxonomy, workflows, capability modules, industry templates |
| 08 | [Gemini, web search and knowledge](08-gemini-search-knowledge.md) | SDK migration, model tiers, search grounding, citations, URL retrieval, RAG, untrusted content |
| 09 | [Tools, integrations and channels](09-tools-integrations-channels.md) | Tool framework, Action Queue, calendar/CRM/notification integrations, web widget, SMS/WhatsApp, voice |
| 10 | [Design system and visual identity](10-design-system.md) | Concept, color, type, spacing, components, motion, accessibility, white-label boundaries |
| 11 | [Frontend architecture and UX](11-frontend-architecture-ux.md) | Next.js app structure, information architecture, key screens and workflows, data fetching, UI states |
| 12 | [Testing and quality](12-testing-quality.md) | Test pyramid, conversation eval harness, isolation tests, E2E, CI gates |
| 13 | [Performance, scalability and operations](13-performance-scalability-ops.md) | Deployment topology, scaling path, observability, backups, cost controls |
| 14 | [Roadmap](14-roadmap.md) | Phases 0–8 with objectives, scope, dependencies, tests, acceptance criteria |
| 15 | [Decisions, risks and open questions](15-decisions-risks-open-questions.md) | Decision log, risk register, questions for you |

---

## The short version

**What exists:** A visually rich single-page dashboard (Next.js 16 / React 19) and an Express API holding all data in memory. The "AI engine" is a hand-written rule system (regex intent scoring plus reply templates). It never calls Gemini, even though a complete Gemini provider module exists. Integrations, analytics, notifications and most KPIs are hardcoded. There is no authentication, no database, and no tenant isolation.

**What is worth keeping:** The conversation-safety thinking in `backend/engine/` (priority hierarchy P0–P6, workflow state machine, "verified business data only" knowledge rules, honest tool statuses), the Gemini provider's citation and retry handling, the 58-scenario behavioral test suite, and the general product breadth.

**What must change first:**
1. One API, not two. Next.js `app/api/*` duplicates Express with an older engine that invents claims such as "I have checked the live calendar and confirmed availability". Those routes override Express in production.
2. Real persistence and authentication with enforced tenant isolation. Today one visitor's phone number can be reused for another visitor's emergency escalation, and deleting an agent with an unknown tenant ID deletes from a different tenant.
3. An LLM-driven agent runtime with a deterministic safety layer. The current classifier sends "Can you help me choose a plan?" into the emergency workflow and misses "my son is bleeding a lot".
4. A durable **Action Queue**, so every callback request, handoff, booking request and complaint lands somewhere a human will see it. Today they only go to `console.log`.

**Recommended direction:** Next.js (UI only) + Express (the only API) + PostgreSQL with pgvector (one database for data, tenancy and knowledge retrieval) + Gemini through the `@google/genai` SDK, with Google Search grounding exposed to agents as a controlled tool. The web chat widget is the first real channel; voice comes last.

**Design direction:** "Operator console" — ink on warm paper, with a single brass accent and status colors that are reserved for meaning. No purple/blue gradients, no glass. Tenant branding applies to customer-facing surfaces (widget, hosted chat), not to the operator dashboard.

---

## Conventions used in these documents

- File references are relative to the repository root, e.g. `backend/engine/intentDetector.js:326`.
- "Tenant" in the current code means one client business. In the target model it is called a **Workspace** (see 01 and 05).
- **Must / Should / Could** mark priority within a phase.
- Each plan ends with **Verification**: how we will know the work is done.
