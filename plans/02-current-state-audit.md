# 02 — Current-State Audit

Audit date: 2026-11-01. Branch `main` at `87e8626`, plus two uncommitted changes (`backend/server.js` no longer serves the legacy frontend; `next.config.mjs` adds an `/api/*` rewrite to `BACKEND_URL`).

Method: every tracked source file was read. The engine test suite was run (`node backend/tests/agentEngine.test.js`: 58/58 pass). The intent detector and full engine were probed with realistic messages that the suite does not cover; results are quoted below as **Evidence**.

---

## 1. Repository map

| Path | Lines | What it is | Status |
|------|------:|-----------|--------|
| `app/layout.js`, `app/page.js` | 33 | Next.js App Router shell; renders `CommandCenterApp` | Active |
| `app/globals.css` | 182 | Design tokens and utility classes; byte-identical copy of `frontend/styles.css` | Active (duplicate) |
| `app/api/**/route.js` (7 files) | 399 | Next.js route handlers duplicating the Express API, with an older rule engine | **Active and shadowing Express** |
| `lib/platformStore.js` | 141 | In-memory seed state for the Next routes (`globalThis.__FJ_PLATFORM_STATE__`) | Active (duplicate) |
| `frontend/components/CommandCenterApp.jsx` | 790 | App shell: sidebar, header, view switching, global state | Active |
| `frontend/components/Studios.jsx` | 2,806 | All feature views in one file (121 KB) | Active |
| `frontend/components/Icons.jsx` | 233 | Inline SVG icon set and Sparkline | Active |
| `frontend/index.html`, `app.js`, `views.js`, `icons.js`, `styles.css` | 4,470 | Legacy pre-Next SPA (React 18 UMD + Babel in the browser) | **Dead code** since the uncommitted change |
| `backend/server.js` | 532 | Express API with in-memory seed data | Active, but mostly unreachable from the UI (see §3.1) |
| `backend/engine/*.js` (5 files) | 2,858 | Rule-based conversation engine | Active in Express only |
| `backend/providers/*.js` | 518 | Gemini provider + provider abstraction with usage tracking | **Never called** |
| `backend/config.js` | 64 | Env loading and config | Active |
| `backend/tests/agentEngine.test.js` | 469 | 58 assertions over engine behavior | Passes; process never exits (open `setInterval`) |
| `server.js` | 4 | Re-exports Express app (left over from Vercel config) | Vestigial |
| `Launch-Platform.bat` | 10 | Windows launcher with a hardcoded Node path | Developer convenience |
| `.next/` (7 files tracked) | — | Build artifacts committed to git despite `.gitignore` | Should be untracked |

Dependencies (root `package.json`): `next@^16.4.3`, `react@^19.3.1`, `express`, `cors`, `dotenv`, `@google/generative-ai@^0.24.1`. `backend/package.json` duplicates the backend deps. There is no TypeScript, linter, formatter, test runner, or CI.

`.env` exists locally and is correctly git-ignored; it has never been committed (`git log --all -- .env` is empty).

---

## 2. What works, what partially works, what is broken

### 2.1 Works

- **Dashboard renders and navigates** across nine views with dark mode, responsive sidebar and toasts.
- **Create workspace, update branding, create agent, delete agent** round-trip to an API and update the UI (in memory only).
- **Engine safety concepts** in `backend/engine/` are well thought out: priority hierarchy P0–P6 (`intentDetector.js:423`), workflow state machine (`conversationState.js`), separation of verified business data from prompt text (`knowledgeBase.js`), honest tool statuses including `INTEGRATION_NOT_CONFIGURED` (`toolExecutor.js:11`), duplicate-action prevention (`toolExecutor.js:43`).
- **Gemini provider** (`backend/providers/gemini.js`) has sensible retry with backoff, error categorization, citation extraction from grounding metadata, and token usage extraction.
- **Engine test suite** covers the brief's key scenarios (emergency continuity, location vs hours, mixed feedback, tenant isolation of business data).
- **Browser voice demo**: speech-to-text and text-to-speech via Web Speech API work in Chrome for demos.

### 2.2 Partially works

| Feature | What works | What does not |
|---------|-----------|---------------|
| Workspaces | Create, switch, rebrand | "Active tenant" is one global server variable shared by every user (`backend/server.js:22`, `lib/platformStore.js:15`). Lost on restart. |
| Agents | Create, delete | No edit. No versions. Voice wizard fields "Agent Role Description" and "Speaking Style" (`Studios.jsx:531-533`) are never sent to the API. Status is always "Deployed" with nothing deployed. |
| Conversations / testing | Playground, Chatbot Studio and Voice Studio send messages and show replies | Replies come from the older Next.js rule engine (§3.1). No conversation is stored. "Reset Transcript" (`Studios.jsx:2088`) clears the UI but not the server session. |
| Business profile | Seeded profiles drive correct address/hours answers in the Express engine | No UI to edit it. New workspaces get an empty profile that produces broken answers (see §4, bug B6). |
| Knowledge | Sentences of the system prompt are keyword-matched | No documents, URLs, FAQs, embeddings or retrieval. The "RAG" label in responses (`toolTriggered: 'knowledge_base_rag'`) is a keyword filter over the prompt. |
| Gemini / web search | Provider code is complete for text, search-grounded and chat generation | Nothing imports `backend/providers`. Agents cannot search the web. SDK is the legacy package (see 08). |
| Usage tracking | `providers/index.js` tracks tokens and daily searches per tenant | In memory, unused, and not surfaced anywhere. |

### 2.3 Broken or misleading

| UI element | File | What it claims | Reality |
|------------|------|----------------|---------|
| Overview KPIs | `Studios.jsx:98-160` | MRR, calls, messages with trends "+18.4%", "98.4% automated resolution", "99.98% SLA" | Hardcoded numbers and trends; fallbacks like `masterAgency?.mrr \|\| 14850` |
| Overview chart | `Studios.jsx:162-173` | Daily voice/chat volume for 7d/30d/90d | Fixed array multiplied by 4.2 or 11.5 |
| Integrations page | `Studios.jsx:2738-2775` | Twilio, ElevenLabs, OpenAI Realtime, Deepgram "Connected"; CRM "Active" | Nothing is integrated. "Test Connection" shows a toast saying "verified and active" |
| Conversations page | `Studios.jsx:2657` | "Omnichannel Audit Log" | Shows the in-browser `recentEvents` list, three of which are hardcoded seed events |
| Notifications bell | `CommandCenterApp.jsx:637` | Red unread dot, "Live Telemetry Alerts" | Same in-browser event list; dot is always shown |
| Global search | `CommandCenterApp.jsx:539` | "Search agents, clients…" | Pressing Enter navigates to Playground; nothing is searched |
| Settings | `Studios.jsx:2780` | "API Backend Status: ONLINE (Express Multi-Tenant Engine)" | Static text; the UI actually talks to Next.js routes |
| Phone numbers | `Studios.jsx:558-564` | "Generate Toll-Free #" | Random digits; no number is provisioned |
| Voice providers | `Studios.jsx:10-46` | ElevenLabs, OpenAI Realtime, Deepgram, Cartesia voices | Labels only; browser TTS is used |
| Latency / confidence | `responseGenerator.js:73-80`, `app/api/simulate/webhook/route.js:8` | Per-turn latency in ms and confidence % | `Math.random()` |
| Webhook inspector | `server.js:485-493` | `model: 'fj-tech-realtime-4o'`, provider "Twilio + ElevenLabs + LLM" | Fictional values |
| Text encoding | `CommandCenterApp.jsx`, `Studios.jsx` | Bullets, emoji, arrows | 34 lines contain double-encoded text (e.g. `â€¢`, `ðŸš€`, `â†º`) and render as garbage |

---

## 3. Architectural findings

### 3.1 Two competing APIs; the worse one wins

The UI calls relative URLs such as `/api/simulate/webhook`. Two implementations exist:

- **Next.js route handlers** in `app/api/**` backed by `lib/platformStore.js`. The webhook route contains its own 180-line rule engine (`app/api/simulate/webhook/route.js:4`) that fabricates outcomes:
  - `"I have checked the live calendar for ${brand} and confirmed availability… I've reserved that slot for you."` (line 65)
  - `"I have logged your details directly into ${brand}'s CRM and dispatched an instant SMS & email confirmation"` (line 83)
- **Express** in `backend/server.js` with the much better engine in `backend/engine/`.

The new uncommitted rewrite in `next.config.mjs` forwards `/api/:path*` to `BACKEND_URL`. However, rewrites returned as a plain array run **after** Next.js's own filesystem routes, so the seven `app/api` routes keep handling those paths. Only paths Next.js lacks (`/api/sessions`, `/api/sessions/reset`) would reach Express. **Result: the product as deployed uses the fabricating engine.** The built route manifest (`.next/app-path-routes-manifest.json`) confirms the seven Next routes are compiled.

The two seed datasets have also drifted: `lib/platformStore.js` has no `businessProfile` at all and different colors for the Apex tenant.

### 3.2 No persistence

All data lives in process memory: `platformState` (`server.js:14`), conversation sessions (`conversationState.js:12`), usage (`providers/index.js:15`). Restarting loses everything. On serverless hosting each instance has its own copy, which is why the code contains "rehydration" hacks that recreate tenants and agents from client-supplied snapshots (`server.js:226`, `350`, `419`, `439`).

### 3.3 No authentication or authorization

There is no user model, login, session or API key. Anyone who can reach the API can list every tenant with every system prompt and contact (`GET /api/state`), create tenants, rebrand any tenant, delete any agent, and read all conversation sessions (`GET /api/sessions`). `cors()` is configured with no origin restriction (`server.js:8`).

### 3.4 Tenant isolation defects

| ID | Defect | Location | Impact |
|----|--------|----------|--------|
| T1 | Unknown `tenantId` on DELETE falls back to the first tenant | `server.js:405` | A request with a typo deletes an agent from a different business |
| T2 | Unknown `tenantId` on agent create falls back to the active tenant | `server.js:367-369` | Agent created in the wrong business |
| T3 | Client-supplied `tenantSnapshot` / `agentSnapshot` creates tenants and agents | `server.js:226, 351, 419, 439` | Any caller can inject arbitrary tenants and agents, including `id`s that collide with real ones |
| T4 | Global `activeTenantId` | `server.js:22` | One user switching workspace switches it for everyone |
| T5 | Sessions keyed `tenant::agent::default`; the frontend never sends `sessionKey` | `conversationState.js:17`, all `fetch('/api/simulate/webhook')` calls | All visitors to the same agent share one conversation state, including name and phone number |
| T6 | `GET /api/sessions` lists every tenant's sessions | `server.js:508` | Cross-tenant metadata exposure |

**Evidence for T5** (Express engine, two visitors on the same agent, both using the default session):

> Visitor A: "my number is 555 123 4567, I want info"
> Visitor B: "This is an emergency"
> Agent to B: "Your urgent callback request has been submitted… A representative will contact you at 5551234567"

Visitor B's emergency was dispatched to visitor A's phone number. This is both a privacy breach and a safety failure.

### 3.5 Frontend structure

- **Tailwind is loaded from the CDN at runtime** (`app/layout.js:19`): a `<script src="https://cdn.tailwindcss.com">` inside a Next.js app. It is not meant for production, adds a large runtime script, generates styles after load (flash of unstyled content), and prevents build-time purging. The legacy `tailwind.config` with the `fj` palette (`frontend/index.html:17`) is not applied in the Next app at all.
- **One 2,806-line file** holds all views; one 790-line file holds the shell and all global state in `useState`. No routing: views are switched by a `activeView` string, so URLs never change, the back button does not work and nothing is linkable.
- **No data layer**: raw `fetch` scattered across components, errors swallowed with `console.error`, no loading or error UI on most actions (e.g. failed agent creation does nothing visible, `Studios.jsx:607`).
- **Accessibility**: one `aria-` attribute in the whole UI; icon-only buttons lack labels; `window.confirm` for destructive actions; color-only status cues; many 10–11 px text sizes.
- **Hardcoded brand colors** (`#635BFF`) appear inline hundreds of times instead of tokens.

### 3.6 Backend structure

- `server.js` mixes seed data (190 lines), routing, validation and business rules in one file. No controllers, services or middleware layers.
- No input validation beyond "required" checks; `domain.trim()` on a non-string body value throws an unhandled 500.
- No request logging, request IDs or structured logs. Tools log customer phone numbers to stdout (`toolExecutor.js:59`).
- No rate limiting on any route, including the one that will spend AI tokens.
- `conversationState.js:218` starts a `setInterval` at import time; this keeps test processes alive and does not work on serverless.

---

## 4. AI engine audit

### 4.1 How it actually works

`processMessage` → `generateResponse` (`responseGenerator.js:24`):
1. `detectIntents` scores 24 intents by regex phrases and keywords, sorted by priority then score.
2. If a workflow is active, `handleActiveWorkflow` continues it unless a P0/P1 intent interrupts.
3. Otherwise the top intent's priority routes to emergency, escalation, complaint or "standard" handlers.
4. Each handler returns a **template string** filled from the business profile or from sentences of the system prompt that contain matching keywords.

There is no language model in the loop. The agent cannot paraphrase, answer anything outside its templates, understand context beyond regex, or use the system prompt as instructions (it is only mined for sentences).

### 4.2 Behavioral bugs found by probing

The test suite passes because it uses phrasings the regexes were written for. Realistic messages expose the following:

| ID | Message | Result | Problem |
|----|---------|--------|---------|
| B1 | "Can you help me choose a plan?" | `emergency_escalation (P0)` | `help me` alone scores 16 against threshold 10 (`intentDetector.js:330`). A sales question enters the emergency workflow and asks for a callback number. |
| B2 | "Do you install fire alarms?" / "How much is an electrical panel upgrade?" | `emergency_escalation (P0)` | Bare words `fire`, `electrical` trigger P0. An HVAC or electrical business would escalate routine sales questions. |
| B3 | "my son is bleeding a lot from his mouth after the extraction" | `unsupported_request` | A real dental emergency is missed entirely. |
| B4 | "My order 12345 never arrived" | `unsupported_request`; entities `phoneNumber: "12345"` | Complaint missed; order number parsed as a phone number. |
| B5 | In an emergency awaiting a callback number: "the water is up to my knees" | `customer_info_provided`, `customerName: "the water"` | The name regex runs with the `i` flag, so any two words count as a name (`intentDetector.js:457`). |
| B6 | New workspace: "What are your opening hours?" | "Monday: ? - ? \| Tuesday: ? - ? …" | `createEmptyBusinessProfile` creates empty day objects that `getBusinessHours` treats as configured (`knowledgeBase.js:253`, `:90-99`). Contact inquiry similarly answers "Main Contact: " with nothing. |
| B7 | Booking flow completes | "Your appointment has been booked!" | The tool only returned `PENDING` and logged to console (`toolExecutor.js:184-200`). Violates "never claim completion" (`responseGenerator.js:1029`). |
| B8 | "I am interested in a 3 bedroom in Brickell" | `customerName: "interested in"` | Name extraction treats "I am X Y" as a name. |
| B9 | "Who won the election yesterday?" / "What are the latest solar tax credit rules for 2026?" | `unsupported_request` | No external knowledge path. |
| B10 | "Is parking available?" | `delivery_availability_inquiry` | Misrouted; the FAQ intent exists but scores lower. |
| B11 | Phone regex `[\+]?[\d\s\-\(\)]{7,15}` | Matches dates, order numbers, runs of spaces and digits | Wrong callback numbers can be dispatched. |

### 4.3 Other engine issues

- `callHistory` is accepted but ignored; context comes only from the shared in-memory session.
- Session TTL 30 minutes, then all workflow state silently resets.
- "Directions" answer says "I cannot generate a direct maps link", which is easy to provide.
- Citation helper stores `_searchQueries` and `_searchWidget` as properties on an array that is then replaced by `.filter()`, so both are lost (`gemini.js:218-246`). Google's terms for Search grounding require displaying the search suggestions widget; this data is needed.
- `config.urlRetrieval` is defined but no URL retrieval exists.
- `.env.example` defaults to `gemini-2.0-flash`, which Google has deprecated (see 08).

---

## 5. Feature reality matrix

For each important interaction: what the user expects, what code handles it, and what really happens.

| Interaction | Component | Endpoint actually hit | Real outcome | Error handling |
|-------------|-----------|----------------------|--------------|----------------|
| Load dashboard | `CommandCenterApp.jsx:268` | Next `GET /api/state` | Seed data from `lib/platformStore.js` | `console.error`; blank UI on failure |
| Switch workspace | `CommandCenterApp.jsx:301` | Next `POST /api/tenants/switch` | Changes global active tenant for all users | Silent |
| Create workspace | `NewClientWorkspaceModal` | Next `POST /api/tenants` | In-memory tenant without business profile | Silent on failure; modal stays open |
| Save branding | `BrandingStudioView` | Next `PUT /api/tenants/:id/branding` | Updates memory; recolors whole dashboard | Silent |
| Create voice agent | `VoiceStudioView` 5-step wizard | Next `POST /api/tenants/:id/agents` | Agent saved without description/style; "Deployed" | Silent |
| Create chatbot | `ChatbotStudioView` | Same | Same; no embed snippet produced | Silent |
| Delete agent | `CommandCenterApp.jsx:319` | Next `DELETE …/agents/:id` | Removed from memory | Silent |
| Test conversation | Playground / studios | Next `POST /api/simulate/webhook` | Older fabricating rule engine; no storage | Typing indicator stops; no message |
| Edit business profile | — | — | **No UI exists** | — |
| Add knowledge | — | — | **No UI or API exists** | — |
| View conversations | `SecondaryViews` | none | Shows in-browser events only | — |
| Integrations | `SecondaryViews` | none | Fake "Connected" list | — |
| Analytics | `SecondaryViews` | none | Retainer and interaction counters | — |
| Search | Header input | none | Navigates to Playground | — |
| Notifications | Header bell | none | In-browser event list | — |

---

## 6. Keep, redesign, consolidate, remove

| Item | Decision | Reason |
|------|----------|--------|
| Express as API host | **Keep** | Matches required direction; engine already lives there |
| Next.js App Router for UI | **Keep** | Matches required direction; React 19 / Next 16 are current |
| `app/api/**`, `lib/platformStore.js` | **Remove** (Phase 0) | Duplicate API with fabricating engine; shadows Express |
| `frontend/index.html`, `app.js`, `views.js`, `icons.js`, `styles.css` | **Remove** (Phase 0, after you confirm) | Dead legacy SPA |
| `server.js` (root), `Launch-Platform.bat` | **Remove or replace** with documented `npm` scripts | Vestigial |
| Tracked `.next/` files | **Untrack** | Build output in git |
| `backend/engine/` priority model, workflow states, KB verification rules, tool statuses | **Keep the concepts; re-implement** inside the new runtime (07) | Good design; implementation is regex-bound and in-memory |
| `backend/engine/intentDetector.js` regex scoring | **Demote** to a deterministic safety backstop for P0 keywords only (rewritten, tested) | Too brittle as the primary classifier (B1–B5, B10) |
| `backend/engine/responseGenerator.js` templates | **Replace** with LLM generation plus guardrails | Cannot handle open conversation |
| `backend/providers/gemini.js` | **Port** to `@google/genai`; keep retry/error/citation logic | Legacy SDK; logic is sound |
| `backend/providers/index.js` usage tracking | **Replace** with persisted usage records and quota checks | In memory |
| `backend/tests/agentEngine.test.js` scenarios | **Keep as eval cases**; add the B1–B11 cases | Valuable behavioral spec |
| Dashboard views and styling | **Redesign** (10, 11) | Generic look, fake data, monolithic files |
| Browser Web Speech voice demo | **Keep as a "voice preview" in the Agent Builder** only, clearly labeled | Useful for demos; not a channel |

## Verification

This audit is accurate if a reviewer can reproduce each **Evidence** row by running the engine against the quoted messages, and can confirm §3.1 by setting `BACKEND_URL` and observing that `/api/simulate/webhook` still returns the Next.js engine's phrasing.
