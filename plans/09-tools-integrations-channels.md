# 09 — Tools, Integrations, Action Queue and Channels

## 1. Current state

- `backend/engine/toolExecutor.js` defines 11 tools. All side-effecting tools only `console.log` and return `PENDING` with an `integrationNote` such as "Connect Twilio/VoIP integration for automatic dialing" (`:55-72`). Nothing is persisted, nobody is notified.
- `getAvailableTools` returns every tool for every agent regardless of configuration (`:388`).
- The Integrations page shows six providers as "Connected"/"Active" with a "Test Connection" button that only shows a success toast (`Studios.jsx:2738-2775`).
- Channels: an agent is typed `voice` or `chatbot`. There is no embeddable widget, no hosted chat page, no phone number provisioning, no messaging channel.

## 2. Tool framework

```ts
interface ToolDefinition<I, O> {
  name: string;                       // 'create_booking'
  description: string;                // shown to the model
  input: ZodSchema<I>;                // validated; converted to JSON schema for the model
  sideEffect: 'none' | 'internal' | 'external';
  requiresConfirmation?: boolean;     // policy layer checks a confirmation slot first
  rateLimit?: { perConversation: number };
  idempotencyKey?(input: I, ctx): string;   // replaces today's 60-second duplicate check
  execute(input: I, ctx: ToolContext): Promise<ToolResult<O>>;
}
type ToolResult<O> = { status: 'SUCCESS'|'SUBMITTED'|'FAILED'|'INVALID_INPUT'|'INTEGRATION_NOT_CONFIGURED'|'DUPLICATE'; data?: O; userSafeMessage?: string; };
```

- `ToolContext` carries `WorkspaceContext`, conversation, contact, agent version, and the connected integrations. The model never supplies IDs for these.
- Every execution is stored in `tool_calls` with input, output, status and duration.
- Idempotency keys (e.g. `hash(conversationId, type, phone)`) prevent duplicate actions across retries and repeated customer messages, replacing the in-memory time-window check (`toolExecutor.js:43-53`).
- Tool availability per turn comes from capabilities and workflow state (07 §9).

## 3. The Action Queue

Every customer request that needs a human, or that an integration may fulfil, becomes an **Action** first (05 §3.6). This turns honest "we've recorded your request" replies into real commitments.

| Action type | Created by | Fulfilment without integration | With integration |
|-------------|-----------|-------------------------------|------------------|
| `emergency` | Emergency workflow | Immediate notification to emergency + escalation contacts; P0 in queue | SMS/voice alert (Twilio), Slack/Teams |
| `callback_request` | Handoff/urgent workflows | Queue + email | Click-to-call later |
| `human_handoff` | Handoff workflow | Queue + live takeover if operator online | Slack/Teams thread |
| `booking_request` | Booking workflow without calendar | Operator confirms manually; can mark confirmed, which can trigger a confirmation email to the customer | — |
| `booking` | Booking workflow with calendar | — | Created in Google Calendar / Cal.com; status `SUCCESS` |
| `support_ticket` | Complaint workflow | Queue | Zendesk/Freshdesk (later) |
| `lead` | Lead qualification | Queue | HubSpot / CRM sync |
| `order_request` | Orders without POS | Queue | POS/e-commerce (later) |

UI (11 §5.4): a prioritized list with filters, status changes, assignee, notes, link to the conversation, SLA timer for P0/P1, keyboard shortcuts for fast triage.

Notifications: P0 immediately to all contacts flagged `notify` plus workspace admins; P1 immediately to assignees/admins; others in a digest (configurable). Channels: email at launch; Slack, SMS and push later. Delivery tracked in `action_events`.

## 4. Integrations

### 4.1 Framework

- One module per provider under `apps/api/src/integrations/<provider>/` implementing `connect`, `disconnect`, `test`, and provider-specific capabilities (`calendar.listAvailability`, `calendar.createEvent`, `crm.upsertLead`, …).
- Credentials (OAuth tokens or API keys) encrypted at rest (06 §7); OAuth refresh handled centrally; failures set `integrations.status = 'error'` with a readable `last_error` and notify admins.
- "Test connection" performs a real, read-only API call.
- Integration catalogue page shows only integrations that exist, with honest states: *Not connected / Connected / Error (reason) / Coming soon*.

### 4.2 Priority order

| Priority | Integration | Why |
|----------|-------------|-----|
| 1 | **Email delivery** (Postmark or Resend) | Required for Action Queue notifications, invitations, password reset |
| 2 | **Google Calendar** and **Cal.com** | Turns booking from request into real booking; most-requested capability for the seeded industries |
| 3 | **Outbound webhooks** | Lets customers connect anything (Zapier/Make/n8n) without us building each integration |
| 4 | **Slack** (and Teams later) | Faster human response to P0/P1 |
| 5 | **HubSpot** | Lead sync for sales-oriented customers |
| 6 | **Twilio SMS** | SMS notifications to staff; then SMS as a customer channel |
| Later | Zendesk/Freshdesk, Salesforce, Square/Shopify, Calendly | Driven by customer demand |

Outbound webhooks: signed with HMAC-SHA256 (`X-Signature`, timestamp), events `conversation.closed`, `action.created`, `action.updated`, `lead.qualified`; retries with backoff; delivery log visible in the UI.

## 5. Channels

### 5.1 Web chat widget (Phase 4, first real channel)

- `apps/widget`: small vanilla TypeScript loader (`<script src=".../w.js" data-key="pk_…" async>`) that injects a button and an **iframe** served from a dedicated widget origin. The iframe isolates styles and cookies from the host site and keeps our code away from the host page's scripts.
- Loader target size < 15 KB gzipped; iframe app < 80 KB gzipped.
- Features: greeting, suggested prompts, streaming replies (SSE), markdown rendering (safe subset), citations, typing state, operator takeover messages, file upload (later), persistence of the conversation per visitor in `localStorage` (visitor ID + conversation token), accessibility (focus trap, keyboard, screen reader labels), mobile full-screen mode.
- Branding from the workspace's customer-facing branding: logo, colors (contrast-checked; if a brand color fails WCAG AA against white text, the widget auto-adjusts text color), position, launcher label.
- Security: `allowed_origins` checked on every public request; conversation tokens; rate limits (06 §7).
- The Agent Builder's "Deploy" step shows the snippet, a domain list editor, and a live preview.

### 5.2 Hosted chat page

`https://chat.<platform-domain>/<workspace-slug>/<agent-slug>`: full-page version of the widget for businesses without a website, for QR codes and for links in email/social bios. Custom domains (CNAME) later for agencies.

### 5.3 SMS and WhatsApp (Phase 7)

- Twilio Messaging for SMS (requires A2P 10DLC registration in the US — paperwork and lead time per business); Meta WhatsApp Cloud API (business verification, template messages outside the 24-hour window).
- Inbound webhook → channel lookup → same runtime → outbound reply. Message length adaptation per channel (shorter replies, no markdown).
- Opt-out handling (STOP/UNSUBSCRIBE) mandatory.

### 5.4 Voice (Phase 7+, separate project)

What the current UI implies (provisioned numbers, ElevenLabs/Deepgram voices, sub-400 ms turn-taking) is a large system:
- Telephony: Twilio Voice numbers per agent, Media Streams over WebSocket.
- Speech: streaming STT, streaming TTS, barge-in, end-of-turn detection; or a speech-to-speech model (e.g. Gemini Live API) which simplifies the pipeline but must still route through our safety/policy/guard layers via function calling.
- Real-time latency engineering, call recording consent (varies by US state and country), warm transfer to a human number, voicemail.
- Per-minute cost model in plans.

**Recommendation:** build voice only after chat is in production with paying customers, as its own phase with its own design doc. Until then, the Agent Builder offers a clearly labeled **voice preview** using the browser's speech APIs (the current demo), and phone-number fields are removed from the UI.

## 6. Contact capture and consent

- Contacts are created/merged when a customer provides a phone or email (validated, normalized).
- Consent flags recorded per channel (e.g. SMS follow-up consent asked explicitly before any outbound SMS).
- Contact view shows all conversations and actions for that person within the workspace.

## Verification

- With no integrations connected: every workflow that previously only logged to console creates a visible Action, sends the configured notification email, and the agent's reply contains no completion claim. Verified by e2e test.
- With Google Calendar connected in staging: availability returns real free slots; booking creates a real event; reply says "booked" only then.
- Widget: embedded on a test page on an allowed domain works; on a non-allowed domain the API refuses; Lighthouse accessibility score ≥ 95 for the widget iframe; loader size budget enforced in CI.
- Integration page shows no "Connected" state that is not backed by a successful `test` call within the last 24 hours.
