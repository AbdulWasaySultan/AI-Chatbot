# 11 — Frontend Architecture and User Experience (Next.js)

## 1. Current state

- One route (`/`). Views switch via an `activeView` string in `CommandCenterApp.jsx`; URLs never change, back button and deep links do not work.
- All views in `frontend/components/Studios.jsx` (2,806 lines). All global state in one component.
- Navigation (`CommandCenterApp.jsx:11-38`): Overview, AI Voice Agents, AI Chatbots, AI Playground, Client Workspaces, Conversations, Analytics, Branding Studio, Integrations, Settings. Four of these are placeholders (02 §2.3).
- Agent creation is split into a 5-step voice wizard and a separate chatbot form with different fields; there is no edit.
- Testing exists in three places (Voice Studio tester, Chatbot Studio playground, AI Playground) that all call the same endpoint.
- No business profile editor, no knowledge management, no onboarding, no auth screens.
- Data via raw `fetch`; failures mostly silent; no loading skeletons; no empty states except implicit.

## 2. Application structure

```
apps/web/
  app/
    (auth)/sign-in, sign-up, invite/[token], reset-password
    (onboarding)/onboarding/[step]
    (app)/
      layout.tsx                         # shell: nav rail, workspace switcher, command palette, toasts
      [workspace]/
        page.tsx                         # Home
        inbox/ [conversationId]/
        actions/ [actionId]/
        agents/ new/ [agentId]/(builder sections)/
        knowledge/ [sourceId]/
        business/ (profile, locations, hours, contacts, services, policies)
        contacts/ [contactId]/
        analytics/
        integrations/ [provider]/
        settings/ (general, members, channels, branding, usage, data, audit)
      agency/ clients/, templates/, members/   # only for agency organizations
      account/
  components/ ui/ (design system)  domain/ (Transcript, ActionCard, …)
  lib/ api-client.ts (typed fetch from packages/shared), query-keys.ts, permissions.ts, sse.ts
```

- Workspace is in the URL (`/[workspace]/…`), so links are shareable and tabs can show different workspaces. No server-side "active tenant".
- Server Components render shells and first data; interactive regions are Client Components with TanStack Query.
- Forms: React Hook Form + zod resolvers using schemas from `packages/shared`.
- Live updates: one SSE connection per workspace (`/workspaces/:wid/stream`) feeding the Query cache (new messages, new actions, status changes).
- Feature flags for phased rollout (simple config table or env-based to start).

## 3. Information architecture

Navigation rail (workspace scope), grouped by job-to-be-done:

| Group | Item | Purpose |
|-------|------|---------|
| — | **Home** | What needs attention today; health of agents; this week's outcomes |
| Work | **Inbox** | All conversations; live takeover |
| Work | **Actions** | The Action Queue (badge = open P0/P1 count) |
| Build | **Agents** | List, builder, test, deploy |
| Build | **Knowledge** | Documents, URLs, FAQs, unanswered questions |
| Build | **Business** | Verified profile: locations, hours, contacts, services, policies |
| Insight | **Contacts** | People who talked to agents |
| Insight | **Analytics** | Outcomes, intents, quality |
| Settings | **Integrations**, **Settings** | Connections, channels, members, branding, usage, data |

Top bar: workspace switcher (searchable; agency users see client list), global search / command palette (`⌘K`: jump to agent, conversation by contact, action, setting; run commands like "New agent"), notifications (real: P0/P1 actions, integration errors, quota warnings), help, profile.

Agency console (`/agency`): client list with health (open P0s, agents live, conversations this week, quota usage), create client from template, shared templates, agency members.

Removed concepts: separate "Voice Agents" and "Chatbots" sections (one Agents section; channels per agent), "Playground" (testing lives inside the builder and is available from any agent), "Branding Studio" as a top-level item (moves to Settings → Branding, scoped to customer-facing surfaces), MRR/retainer KPIs.

## 4. First-run experience

Goal: published, tested widget in under 15 minutes.

1. **Sign up** (email/Google) → create organization ("I'm a business" / "I'm an agency managing clients").
2. **Business basics:** name, website URL, industry (template picker with clear descriptions).
3. **Auto-draft profile:** if a website URL is given, fetch it and propose address, hours, phone, services; user confirms or edits each field (nothing is "verified" until confirmed).
4. **Agent from template:** persona and greeting drafted; capabilities pre-selected with requirement checklist.
5. **Test:** split view with suggested test questions from the template, including an emergency and a complaint scenario, so the user sees safety behavior immediately.
6. **Deploy:** copy snippet or share hosted link; add website domain.
7. **Home** shows a setup checklist until complete (add knowledge, invite teammate, connect calendar, set notification contacts).

## 5. Key screens

### 5.1 Home
- "Needs attention" list: open P0/P1 actions, failed integrations, agents with rising "unanswered" rate, quota warnings.
- Outcomes this week: conversations, resolved by AI, actions created/completed, leads captured, median first-response time of staff to P0/P1 actions.
- Agents strip: status, last conversation, channel health.
- Every number links to a filtered list. Real data only; empty states guide setup.

### 5.2 Inbox (three-pane)
- Left: filters (status, agent, channel, priority, intent, outcome, tag, date) + saved views ("Open emergencies", "Unresolved this week").
- Middle: conversation list with contact, last message preview, priority indicator, outcome, time.
- Right: transcript with: role-labeled messages, citations, collapsible "what the agent did" (intents, workflow state, tool calls with status), contact panel, related actions, takeover button. During takeover the composer sends as operator and the agent pauses; release returns control.
- Keyboard: `j/k` move, `enter` open, `t` take over, `e` close, `/` search.

### 5.3 Actions
- Grouped by priority, then age; P0 pinned with SLA timer.
- Row: type icon + label, title, contact, created, assignee, status.
- Detail drawer: payload (e.g. callback number, preferred time), conversation excerpt, notes timeline, status buttons, "Call" link (`tel:`), "Email" link.
- Bulk: assign, mark done.

### 5.4 Agent Builder
Single page with a left section list and a persistent right **test pane** running against the draft.

Sections:
1. **Identity** — name, role, persona tone (presets + custom), greeting, language; "Draft with AI" helper.
2. **Instructions** — free-text guidance with a structured helper (do/don't lists), and a preview of the assembled system prompt (read-only, for transparency).
3. **Capabilities** — toggles with requirement checklists and per-capability settings forms generated from the capability config schema; universal capabilities shown as always-on with their settings (e.g. emergency contacts).
4. **Knowledge** — which sources this agent may use; "test retrieval" box.
5. **Web research** — on/off, allowed/blocked domains, daily limit, preview of how citations will look.
6. **Guardrails** — forbidden topics, required disclaimers, reply length, competitor mentions.
7. **Channels & deploy** — widget snippet, domains, hosted link, branding preview.
8. **Versions** — history with diff, publish notes, rollback.

Header: draft/published status, "Unpublished changes" indicator, **Publish** (runs config validation + quick eval smoke set; shows results before confirming).

Test pane: chat with the draft; each agent message expandable to show intents, priority, workflow state, tool calls, sources; "Reset conversation" truly starts a new conversation; scenario chips from the template; voice preview toggle (browser speech, labeled as preview).

### 5.5 Knowledge
- Sources table: title, type, status (with failure reason and retry), chunks, last indexed, used-by agents.
- Add: upload (drag-and-drop, progress), URL (with crawl depth later), FAQ editor.
- **Unanswered questions** tab: questions the agents could not answer, grouped by similarity, with "Answer and add to FAQ" in one step.

### 5.6 Business
Forms for each part of the profile with explicit "configured / not configured" state. Hours editor with per-day rows, split shifts, holidays and temporary closures, timezone. Locations with map preview. Services with pricing types. Policies. A completeness meter showing which agent capabilities are blocked by missing data.

### 5.7 Analytics
Outcome funnel (conversations → resolved by AI / escalated / action created), intents distribution, priority mix, unanswered rate, citation usage, response latency, actions SLA, per-agent and per-channel breakdowns, date range with comparison. Export CSV.

### 5.8 Integrations and Settings
Integration tiles with real state (09 §4.1). Settings: general (name, timezone, locale), members and roles, channels, customer-facing branding (with widget preview and contrast warnings), notifications, usage and plan, data (retention, export, delete), audit log.

## 6. State management and data fetching

- Server state: TanStack Query; query keys include workspace ID; mutations use optimistic updates for low-risk changes (action status, assignee) and pessimistic for publish/delete.
- SSE events update caches directly (e.g. append message to a transcript query).
- Client-only UI state (panel sizes, density, theme): small Zustand store persisted to `localStorage`.
- No global "active tenant" state; it is the URL.

## 7. Loading, empty, success and error states

Every data view defines all four:

| State | Pattern |
|-------|---------|
| Loading | Skeletons shaped like the content; no spinners for full pages; buttons show inline progress and disable |
| Empty | What this is, why it's empty, the one action to fill it (e.g. Inbox empty → "Test your agent" / "Install the widget") |
| Success | Toast for background confirmations; inline confirmation for forms ("Saved · 2 seconds ago"); no celebratory emoji toasts |
| Error | Inline error near the cause with a retry; API error codes mapped to plain-language messages (04 §4); `requestId` available under "Details" for support; forms keep user input on failure |

Also: offline banner, session-expired redirect that returns to the same page, permission-denied states that explain who can grant access.

## 8. Responsiveness

- Desktop-first for Builder and Analytics; fully usable on tablet.
- **Mobile is a first-class target for Inbox and Actions**: business owners will respond to emergencies from their phones. Single-pane navigation on small screens, large tap targets, notification deep links open the action directly.
- Consider a PWA with web push for P0 notifications in a later phase.

## 9. Performance

- Remove CDN Tailwind; compiled CSS only.
- Route-level code splitting; charts and the builder's heavier editors loaded lazily.
- Budgets: initial JS for `/[workspace]` < 200 KB gzipped; LCP < 2.0 s on mid-range laptop over 4G; Inbox interaction (open conversation) < 150 ms with cached data.
- Images through `next/image`; tenant logos uploaded to our storage, not hotlinked from arbitrary URLs.

## 10. Migration from the current frontend

1. Phase 0: fix encoding, delete legacy `frontend/*.js|html|css`, remove CDN Tailwind in favor of compiled Tailwind with the existing look (so nothing breaks while the backend changes).
2. Phase 3: build the design system and new shell; port screens in this order: auth/onboarding → Agents (builder + test pane) → Business → Knowledge → Inbox → Actions → Home → Analytics → Settings/Integrations. Old `Studios.jsx` views are deleted as each replacement lands.
3. Keep the browser voice demo code, refactored into the builder's voice preview.

## Verification

- Every nav item leads to a screen backed by real API data; a scripted crawl of the app finds no hardcoded metric values (search for numeric literals in view components as a lint check).
- E2E flows (12 §5) pass on desktop and mobile viewports.
- Usability test with 5 target users (2 business owners, 2 front-desk staff, 1 agency operator): each completes onboarding to a published agent without help, and finds and resolves a P0 action in under 60 seconds.
- Lighthouse: Performance ≥ 90, Accessibility ≥ 95 on Home, Inbox and Builder.
