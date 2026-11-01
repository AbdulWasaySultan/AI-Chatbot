# 01 — Product Vision and Requirements

## 1. The product in one paragraph

A platform where a business, or an agency acting on behalf of many businesses, sets up AI agents that talk to customers on the business's behalf: answering questions from verified business information, qualifying leads, booking appointments, logging complaints, escalating emergencies and handing conversations to humans. The platform makes sure every agent stays inside its own business's data, never claims to have done something it has not done, and leaves a reliable record of every customer interaction and every action it took or requested.

The commercial value is not "a chatbot". It is **staff capacity that never sleeps and never drops a lead or an emergency**. Every design and engineering decision should be measured against that.

## 2. Who uses it

| Persona | What they need | Where they live in the product |
|---------|----------------|-------------------------------|
| **Business owner / manager** (dentist, realtor, HVAC owner) | Confidence the agent says the right things; see what customers asked; act on callbacks, bookings and complaints; know the value delivered | Inbox, Action Queue, Agent settings, Business Profile, weekly summary |
| **Front-desk / operator staff** | A to-do list of things the agent could not finish; take over live conversations | Action Queue, Inbox (takeover) |
| **Agency operator** (the current "FJ-Tech master agency" persona) | Onboard many client businesses quickly from templates, manage them from one login, white-label customer-facing surfaces, report value to clients | Agency console: Clients list, templates, cross-client health |
| **Agent builder** (often the agency or a tech-savvy owner) | Configure persona, capabilities, knowledge and channels; test before publishing; roll back mistakes | Agent Builder with live test pane, versions |
| **End customer** | Fast, correct answers; to be understood in urgent situations; to reach a human when needed; never be lied to | Web widget, hosted chat page, later SMS/WhatsApp/voice |
| **Platform admin** (us) | Operate the platform: tenants, usage, abuse, incidents | Internal admin (later phase) |
| **Developer** (us) | Add capabilities, integrations and channels without touching the core loop | Capability and integration modules |

## 3. Core object model

This is the vocabulary every plan uses.

```
Organization ─┬─ Members (users with roles)
              ├─ Billing / Plan / Usage limits
              └─ Workspaces (one per business)
                    ├─ Business Profile (verified facts: locations, hours, contacts, services, policies)
                    ├─ Knowledge Sources (documents, URLs, FAQs) → chunks + embeddings
                    ├─ Agents
                    │     ├─ Agent Versions (draft / published, immutable once published)
                    │     ├─ Capabilities enabled (booking, lead qualification, support, escalation, web research…)
                    │     └─ Channels deployed (web widget, hosted page, SMS, WhatsApp, voice)
                    ├─ Contacts (end customers, deduplicated by phone/email)
                    ├─ Conversations → Messages → Tool Calls
                    ├─ Actions (callback requests, handoffs, booking requests, tickets, leads) — the Action Queue
                    ├─ Integrations (calendar, CRM, notifications, webhooks) with encrypted credentials
                    └─ Usage records (tokens, searches, conversations)
```

### Why Organization above Workspace

The current code has a single global "master agency" (`backend/server.js:15`) with client "tenants" beneath it. The brief describes "businesses" as the tenant. Both are real go-to-market paths:

- **Direct business**: an Organization with one Workspace. The UI hides the agency layer entirely.
- **Agency / reseller**: an Organization with many Workspaces, one per client. The agency sees a Clients console. Client staff can be invited to only their own Workspace.

Modeling both from day one costs one extra table and avoids a painful migration later. **Tenant isolation is enforced at the Workspace level**; the Organization level only grants members access to sets of workspaces.

## 4. What the product must do (requirements)

### 4.1 Must have for first paying customer (MVP)

1. Sign-up, login, invite teammates, roles (Owner, Admin, Editor, Agent Operator, Viewer).
2. Create a Workspace from an **industry template** (pre-fills capabilities, intake questions, sample knowledge).
3. Edit the **Business Profile**: locations, hours (with timezone and holidays), contacts per department, emergency contact, service areas, services and prices, policies.
4. Add **knowledge**: upload PDF/DOCX/TXT, add web pages by URL, write FAQ entries. See indexing status.
5. Build an **agent**: persona, tone, greeting, enabled capabilities, guardrails, knowledge scope, web-search on/off. Test it in a side panel against the draft. Publish a version. Roll back.
6. Deploy to the **web chat widget** (copy-paste snippet, domain allowlist) and a **hosted chat link**.
7. **Inbox**: every conversation with transcript, detected intents, tool calls, citations, contact details; staff takeover of live conversations.
8. **Action Queue**: every callback request, handoff, booking request, complaint ticket and captured lead, with status (new → in progress → done), assignee and notes. Email notifications for P0/P1 items.
9. **Honest agent behavior**: emergency and complaint handling override sales; multi-turn workflows persist; address ≠ hours ≠ directions; no claim of completion without confirmation; web answers carry citations.
10. Basic analytics: conversations, resolution vs escalation, actions created and completed, top intents, unanswered questions.
11. Usage limits per plan (conversations, AI tokens, web searches) with clear UI when limits are near.

### 4.2 Should have shortly after MVP

- Calendar integration (Google Calendar, Cal.com) for real availability and real bookings.
- Outbound webhooks and Slack/Teams notifications.
- CRM sync (HubSpot first).
- Agency console: client list with health, cross-client templates, white-label widget and hosted page.
- Billing (Stripe) with plan enforcement.
- "Unanswered questions" → one-click add to knowledge base.

### 4.3 Could have later

- SMS and WhatsApp channels (Twilio / Meta Cloud API).
- Voice phone agents (telephony + streaming speech). This is a large, separate engineering effort; see 09.
- Outbound follow-up campaigns.
- Custom capability builder (no-code workflows).
- Multi-language agents.

### 4.4 Explicitly out of scope for now

- Building our own LLM or speech models.
- A marketplace of third-party capabilities.
- On-premise deployment.

## 5. Where I recommend changing the original vision

1. **Lead with chat, not voice.** The current UI positions voice call agents first ("AI Voice Agents" is the second nav item; seeded agents are mostly voice). None of the voice stack exists: phone numbers are randomly generated strings (`frontend/components/Studios.jsx:560`), voices are labels, and the "call" is browser text-to-speech. Real telephony brings carrier compliance, latency engineering and per-minute costs. Shipping a reliable chat agent with a real Action Queue first proves the core value (correct answers, no dropped leads) and generates revenue. Voice reuses the same runtime later as another channel.

2. **The Action Queue is the product's backbone, not an add-on.** The brief rightly says agents must not claim actions they did not complete. Without connected integrations, the honest alternative is "your request has been recorded and a person will follow up", which is only true if the request lands somewhere durable and visible. Today these requests are only logged to the server console (`backend/engine/toolExecutor.js:59`). Every agent action becomes an Action record first; integrations then automate fulfilment.

3. **Tenant branding belongs on customer-facing surfaces.** The current dashboard recolors itself with each client's colors (`frontend/components/CommandCenterApp.jsx:281-292`). That erodes the product's own identity and can produce unreadable UI. Client colors and logos should apply to the widget, hosted chat page and notification emails. Agencies can later add their own logo to the dashboard.

4. **"Monthly retainer" and "MRR" are agency bookkeeping, not platform data.** The current KPIs are dominated by agency revenue fields typed into the branding form. The platform should report what agents did (conversations handled, leads captured, emergencies escalated, time saved). Agency billing of their clients can be a simple optional field later, not a headline metric.

5. **Industry flexibility comes from composition, not per-industry code.** Instead of industry-specific engines, agents are composed of reusable **capabilities** plus an industry **template** that preselects capabilities, intake fields and starter knowledge (see 07 §8).

## 6. Product principles

1. **Truthful by construction.** The runtime, not the prompt, prevents claims of completed actions. Facts about the business come from the verified Business Profile or cited knowledge, never from the model's imagination.
2. **Safety outranks sales.** Emergencies, complaints and human requests always win over the agent's commercial goals, and stay in control across turns.
3. **Nothing falls on the floor.** Every customer request that needs a human produces a visible, assignable, notifiable record.
4. **Every screen is real.** No hardcoded KPIs, fake "Connected" badges or simulated latency. If a feature depends on an unconnected integration, the UI says so and explains how to connect it.
5. **Fast to first value.** A new business should have a tested, embedded agent within 15 minutes, starting from a template.
6. **Isolation is non-negotiable.** Cross-tenant access must be prevented in code and in the database.

## 7. Success metrics

| Metric | Target for MVP pilot |
|--------|---------------------|
| Time from sign-up to published widget | Under 15 minutes (median) |
| Conversations resolved without human | Above 60%, measured from Inbox outcomes |
| Emergency recall on eval set | 100% of P0 scenarios escalated |
| Emergency false-positive rate on eval set | Below 2% |
| Fabricated-claim rate (claims of completed action without SUCCESS tool status) | 0 on eval set; spot-checked weekly in production |
| Action Queue items acknowledged within SLA | Shown per workspace; target set by customer |
| Cross-tenant data access incidents | 0, enforced by automated isolation tests |

## Verification

This vision is accepted when you confirm or amend: the Organization → Workspace model (§3), the MVP scope (§4.1), and the five changes to the original vision (§5). Open questions about these are listed in [15](15-decisions-risks-open-questions.md).
