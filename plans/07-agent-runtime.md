# 07 — Agent Runtime: Intelligence and Orchestration

This is the core of the product. It replaces `backend/engine/` while keeping its best ideas.

## 1. Current state

- **No language model.** `backend/engine/responseGenerator.js` routes regex-detected intents to template replies; `backend/providers/gemini.js` is never called (02 §4.1).
- **Good concepts worth keeping:** priority levels P0–P6 with interrupts (`responseGenerator.js:103-120`), workflow state machines for emergency, handoff, complaint and appointment flows, verified-data-only answers for address/hours/contacts, honest tool statuses, duplicate-action prevention.
- **Failures:** misclassification in both directions for emergencies (B1–B3), weak entity extraction (B4, B5, B8, B11), claims of completed bookings (B7), broken answers from empty profiles (B6), no external knowledge (B9), session state shared across visitors (T5), interrupted workflows discarded rather than resumed.

## 2. Design goals

1. Natural, context-aware conversation driven by an LLM.
2. Safety and truthfulness enforced **by code around the model**, not only by prompt wording.
3. Deterministic behavior for things that must be exact: priority preemption, workflow state, "open now" calculations, claims of completion.
4. One runtime for every industry and channel; behavior composed from capabilities.
5. Graceful degradation when the AI provider fails.

## 3. Turn pipeline

```
customer message
   │
   ▼
[1] Load        conversation (state, version), published agent version, profile digest, contact memory
   │
   ▼
[2] Triage      ┌ keyword backstop (deterministic, <1 ms)          ┐  run in parallel
                └ classifier (fast model, structured JSON output)   ┘
                → intents[], priority, sentiment, slots{phone,name,datetime,…}, answersPendingQuestion, needsExternalInfo
   │
   ▼
[3] Policy      deterministic state machine: continue / start / preempt (suspend) / resume workflow;
                decide allowed tools and prompt mode (normal | emergency | handoff | complaint)
   │
   ▼
[4] Context     system prompt layers + relevant profile facts + retrieved knowledge (if needed) + tool list
   │
   ▼
[5] Generate    LLM with function calling; up to 4 tool iterations; final text streamed
   │
   ▼
[6] Guard       claim guard + fact guard + PII guard → pass | regenerate once | safe fallback
   │
   ▼
[7] Commit      persist messages, tool calls, state (optimistic version check), actions, usage; emit events
```

Latency budget (chat, P50): triage ≤ 400 ms (parallel with load and retrieval), first streamed token ≤ 1.5 s, full reply ≤ 4 s without web search, ≤ 8 s with web search.

## 4. Triage: intents, priority and slots

### 4.1 Intent taxonomy (multi-label)

| Group | Intents | Default priority |
|-------|---------|-----------------|
| Safety | `emergency` | P0 |
| Escalation | `urgent_request`, `human_request` | P1 |
| Dissatisfaction | `complaint`, `negative_feedback`, `refund_request` | P2 |
| Transactions | `appointment_book`, `appointment_change`, `appointment_cancel`, `order_place`, `order_status`, `order_change`, `order_cancel`, `follow_up_status` | P3 |
| Information | `location`, `hours`, `directions`, `contact`, `services`, `pricing`, `policy_faq`, `general_inquiry`, `external_info` | P4 |
| Commercial | `sales_inquiry`, `lead_qualification` | P5 |
| Social | `greeting`, `positive_feedback`, `smalltalk`, `goodbye` | P6 |
| Other | `out_of_scope`, `unclear` | P4 |

The brief's required distinctions map directly: address = `location`, operating hours = `hours`, how to get there = `directions`; "follow-up questions" are handled by `answersPendingQuestion` plus conversation context rather than as a separate intent.

### 4.2 Classifier

- Fast-tier Gemini model, JSON schema output (`responseSchema`), temperature 0.
- Input: last 6 turns, current workflow and pending question, workspace industry, enabled capabilities.
- Output: `{ intents: [{name, confidence}], priority, sentiment, lifeThreatening: bool, slots: { phone_e164?, email?, name?, datetime_iso?, reference?, service? }, answersPendingQuestion: bool, needsExternalInfo: bool, language }`.
- Dates/times normalized to ISO in the workspace timezone. Phone numbers validated with `libphonenumber-js` against the workspace's country; invalid numbers are rejected, not guessed (fixes B4, B11).
- Names are only accepted when the classifier marks them and the agent had asked for a name, or the customer explicitly introduced themselves (fixes B5, B8).

### 4.3 Deterministic emergency backstop

The current regex detector (`intentDetector.js:326-343`) is rewritten as a **curated phrase lexicon** used only for P0 recall:

- **Strong phrases** (force P0 regardless of classifier): e.g. "gas leak", "smell gas", "can't breathe", "chest pain", "unconscious", "bleeding heavily", "house is on fire", "carbon monoxide", "flooding", "sparks coming from", "no heat" + (infant|elderly|baby).
- **Weak terms** (`fire`, `electrical`, `help me`, `urgent`) never force P0 alone; they raise the classifier's prompt sensitivity and are logged for review.
- Industry templates add lexicon entries (dental: "knocked out tooth", "swelling" + "fever", "bleeding after extraction"; HVAC: "no AC" + heat advisory, "burning smell").
- Negation and context handling for common false positives ("fire alarm installation", "electrical panel quote", "help me choose").

**Decision rule:** P0 if classifier says P0 with confidence ≥ 0.5, or a strong phrase matches. Bias toward recall: a false emergency costs a clarifying question; a missed one can cost a life. If the classifier times out, the backstop alone decides and the turn continues.

## 5. Policy layer: workflows and preemption

### 5.1 Workflow definitions (declarative)

Each capability may define a workflow:

```ts
defineWorkflow({
  id: 'appointment_booking',
  priority: 'P3',
  slots: { service: optional, datetime: required, name: required, phone: requiredUnless('email'), confirmation: required },
  states: ['COLLECTING', 'CONFIRMING', 'SUBMITTED', 'CONFIRMED', 'FAILED'],
  tools: { COLLECTING: ['check_availability'], CONFIRMING: ['create_booking'], … },
  onComplete: 'resolve', onTimeout: 'abandon_after_24h',
})
```

The policy layer decides state transitions from triage output and tool results. The LLM writes the words; it does not decide whether a booking exists.

### 5.2 Preemption and resumption

- A higher-priority intent **suspends** the current workflow (pushes it on a stack in `conversations.state`) instead of discarding it (today `resolveWorkflow(session, 'interrupted_by_emergency')` discards).
- After the higher-priority workflow reaches a stable state, the agent may offer to resume the suspended one, **except** after an emergency: no sales or upsell in that conversation; only resume service workflows if the customer asks.
- Equal or lower-priority intents during an active workflow are answered briefly and the workflow continues ("We're open until 6 pm. Now, which day works for your cleaning?").

### 5.3 Emergency workflow (canonical example from the brief)

| State | Agent behavior | Allowed tools | Exit |
|-------|---------------|---------------|------|
| `TRIAGE` | If `lifeThreatening`: first sentence tells them to call local emergency services (number chosen by workspace country). Acknowledge, ask the single most important question (callback number). | `get_business_info(emergency_contact)` | Phone captured |
| `CONFIRM_CALLBACK` | Read back the number ("I have 305-555-0148, is that right?") — prevents wrong-number dispatch | — | Confirmed / corrected |
| `DISPATCHED` | Creates P0 action, notifies emergency contacts. Reply says the on-call team has been alerted and shows the business's 24/7 emergency number if configured. Never says "a technician is on the way" unless an integration confirms it. | `create_action(emergency)`, `notify` | Operator resolves, or customer says resolved |
| `FOLLOW_UP` | Further messages are appended to the action as notes and re-notify. Persona's sales goals disabled. | `append_action_note` | Conversation closes |

If the customer provides the callback number first and then more details, the workflow continues in `CONFIRM_CALLBACK`/`DISPATCHED`; it never falls back to the agent's generic sales instructions. This is enforced by the policy layer selecting **emergency prompt mode** and an emergency-only tool list for every turn until exit.

### 5.4 Other built-in workflows

- **Human handoff:** if operators are online (presence from the dashboard), offer live takeover and create a `human_handoff` action with conversation link; if offline, state truthfully when the team will respond (computed from hours) and collect contact details.
- **Complaint:** acknowledge, collect specifics (what, when, reference), create `support_ticket` action, give the ticket reference, offer human contact. No sales content.
- **Booking:** as in §5.1. Without a calendar integration, the final state is `SUBMITTED` and the reply says "request sent; the team will confirm by phone/email", never "booked" (fixes B7).
- **Lead qualification:** slot-filling over fields configured by the template (e.g. real estate: budget, area, bedrooms, timeline, financing). When qualification criteria are met, create a `lead` action with a score and summary.
- **Order status / cancellation:** requires an integration; without one, collect the reference and create an action.

## 6. Context assembly

### 6.1 System prompt layers (in order of authority)

1. **Platform policy** (fixed): honesty rules, safety rules, data-block handling, no medical/legal advice beyond general info, citation rules.
2. **Mode block** (from policy layer): normal / emergency / handoff / complaint, with mode-specific rules.
3. **Workspace guardrails:** forbidden topics, required disclaimers, competitor policy.
4. **Agent persona and instructions:** name, role, tone, greeting, operator's free-text instructions.
5. **Capability fragments:** short instructions for each enabled capability.
6. **Business facts digest:** name, what they do, primary location, today's hours and "open now" (computed), services list (names only; prices via tool).
7. **Retrieved data blocks** (knowledge, tool results, web results) clearly delimited as untrusted data.
8. **Conversation:** rolling summary + recent turns within a token budget.

### 6.2 Information source priority

The model is instructed, and tools are shaped, so that information is taken from:

1. **Verified business profile** (`get_business_info`) — always for address, hours, contacts, prices, policies.
2. **Connected integrations** (availability, order status) — when the question is about live state.
3. **Knowledge base** (`search_knowledge`) — for service details, FAQs, procedures.
4. **Web search** (`web_search`) — only for public, external or current information (news, regulations, third-party companies, general trends), only if enabled for the agent, never for facts about this business that should come from 1–3.
5. **General model knowledge** — for general explanations (e.g. "what is a crown?"), never for this business's specifics.

If a business-specific fact is missing from 1–3, the agent says it does not have that information, offers to have someone follow up, and logs an **unanswered question** that operators can turn into a knowledge entry in one click.

### 6.3 Deterministic helpers instead of model arithmetic

- `isOpenNow`, `nextOpening`, holiday handling — computed in code from `opening_hours` and `hours_exceptions` in the workspace timezone.
- `directions` — returns the formatted address plus a Google Maps directions URL; asks for the customer's starting point only if they want step-by-step guidance.
- Price formatting from `services` rows.

## 7. Guards

### 7.1 Claim guard (truthfulness)

Runs on every reply before it is sent:

- Detects completion claims (booked, confirmed, scheduled, reserved, sent, emailed, texted, notified, cancelled, refunded, dispatched, on the way, transferred).
- Each claim must be backed by a tool call **in this conversation** with status `SUCCESS` for the matching action type. `PENDING` / `SUBMITTED` permits only "request recorded / sent to the team" phrasing.
- On violation: regenerate once with a correction note; if it fails again, send a safe templated reply built from the tool results.
- Every violation is logged and counted in quality metrics.

### 7.2 Fact guard

Phone numbers, emails, addresses and prices in the reply must appear in the profile, retrieved knowledge, tool output, web citations or the customer's own messages. Otherwise: regenerate once, then strip and say the detail is unavailable.

### 7.3 PII guard

Blocks replies that contain contact details belonging to other customers (only possible through bugs or injected content).

## 8. Capabilities and industry templates

### 8.1 Capability interface

```ts
interface Capability {
  id: string;                        // 'appointment_booking'
  name: string; description: string;
  configSchema: ZodSchema;           // UI form is generated from this
  requires: ProfileRequirement[];    // e.g. at least one bookable service, hours configured
  intents: IntentName[];
  tools: ToolDefinition[];
  workflow?: WorkflowDefinition;
  promptFragment(config, ctx): string;
  integrations?: { optional: Provider[]; enhances: string };
}
```

**Universal (always on, configurable but not removable):** `business_info`, `safety_escalation`, `human_handoff`, `feedback_handling`.

**Optional:** `appointment_booking`, `lead_qualification`, `support_ticketing`, `order_management`, `service_dispatch`, `web_research`, `follow_up_status`.

The Agent Builder shows, for each capability, what it needs and whether those needs are met ("Booking needs at least one bookable service and opening hours — 1 of 2 done").

### 8.2 Industry templates

A template is data, not code: selected capabilities with config, profile questions to ask during onboarding, emergency lexicon additions, starter FAQs, suggested persona and greeting.

Initial set (driven by the existing seed businesses plus common SMB verticals): Dental/medical clinic, Real estate, Home services (HVAC/plumbing/electrical/solar), Restaurant, Law firm, Salon/spa, E-commerce store, Generic business. Adding an industry means adding a template row, not runtime code.

## 9. Tools exposed to the model

| Tool | Purpose | Side effect | Notes |
|------|---------|-------------|-------|
| `get_business_info(topic, locationId?)` | location, hours, directions, contact, services, pricing, policies, emergency_contact | none | Returns `configured: false` when missing |
| `search_knowledge(query)` | Hybrid retrieval in agent's scope | none | Returns chunks with source IDs for citation |
| `web_search(query)` | Grounded web answer with citations | usage | 08 §4 |
| `fetch_url(url)` | Read a specific public page | usage | SSRF-protected, allowlist optional |
| `check_availability(serviceId, range)` | Calendar integration | none | `INTEGRATION_NOT_CONFIGURED` otherwise |
| `create_booking(...)` | Booking | yes | Requires confirmation slot |
| `create_action(type, payload)` | Callback, handoff, ticket, lead, order request | yes | Always available; this is the honest fallback |
| `append_action_note(actionId, note)` | Follow-up info | yes | |
| `lookup_order(reference)` | Order integration | none | |

The runtime filters this list per turn based on capabilities and workflow state. Tool results always include a `status` from the existing `TOOL_STATUS` set, extended with `SUBMITTED`.

## 10. Memory and continuity

- **Within a conversation:** recent turns up to a token budget plus a rolling summary updated every ~10 turns (fast model).
- **Across conversations:** when the contact is identified with reasonable confidence (same widget visitor ID, or phone/email the customer provides), the runtime loads a short contact memory: last conversation summaries, open actions ("You asked us to call you back yesterday — that request is still open"). Contact memory is per workspace only.
- **Never** carry state between different visitors (fixes T5): conversation state is keyed by conversation ID, created per visitor.

## 11. Degraded mode

If the AI provider fails after retries or the workspace exceeds its AI quota:
- A minimal deterministic responder (a slimmed, rewritten successor of today's engine) still: detects emergencies with the backstop and collects a callback number, answers address/hours/contact from the profile, and offers to take a message.
- Creates an action for anything else ("Our assistant is having trouble right now. Leave your number and we'll call you back.").
- Operators see a banner and the event is logged and alerted.

## 12. Agent Builder assistance

`POST /agents/:aid/assist` uses the standard model to: draft persona and greeting from the business profile, suggest capabilities from the industry, turn messy instructions into clear rules, and generate test questions. Output is a suggestion the user accepts or edits; it is never auto-published.

## 13. Migration from the current engine

1. Convert the 58 test assertions in `backend/tests/agentEngine.test.js` and the B1–B11 probes into eval cases (12 §3).
2. Build triage + policy + guards with the deterministic parts first; run evals in "shadow" mode against the current engine to compare.
3. Switch generation to the LLM; keep the rewritten deterministic responder as degraded mode.
4. Remove `backend/engine/` once the eval pass rate meets the thresholds in 12 §3.

## Verification

- Eval suite thresholds (12 §3): 100% emergency recall, < 2% emergency false positives, 0 unbacked completion claims, ≥ 95% correct location/hours/directions separation, ≥ 90% workflow continuity across multi-turn scenarios, 100% of web answers with citations.
- Each capability has unit tests for its workflow transitions and an eval scenario.
- Load test: 50 concurrent conversations on one API instance within the latency budget (13).
