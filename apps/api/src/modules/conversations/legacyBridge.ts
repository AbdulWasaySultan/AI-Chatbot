// Runs the Phase-0 rule engine (src/legacy/engine) against data stored in Postgres.
// Temporary: the LLM runtime replaces it in Phase 2 (plans/07-agent-runtime.md §13).
import { createRequire } from 'node:module';
import type { ActionType, AgentConfig, BusinessProfileInput, Priority } from '@fj/shared';
import type { NewAction } from '../actions/actions.service.ts';

const require = createRequire(import.meta.url);

interface LegacyResult {
  reply: string;
  intent: string;
  confidence: number;
  entities: Record<string, unknown>;
  toolTriggered: string;
  suggestedActions: string[];
  workflowState: { type: string; state: string } | null;
}
interface LegacyToolExecution {
  toolName: string;
  input: Record<string, unknown>;
  result: { status: string; data?: Record<string, unknown> | null; message?: string };
  timestamp: number;
}
export interface LegacySession {
  toolExecutions?: LegacyToolExecution[];
  activeWorkflow?: { type: string; state: string } | null;
  [key: string]: unknown;
}
interface LegacyEngine {
  processMessage(tenant: unknown, agent: unknown, message: string, history: unknown[], sessionKey: string): Promise<LegacyResult>;
  stateManager: {
    importSession(state: Record<string, unknown>): void;
    exportSession(tenantId: string, agentId: string, sessionKey: string): LegacySession | null;
  };
}

const engine = require('../../legacy/engine/index.js') as LegacyEngine;
const { INTENT_DEFINITIONS } = require('../../legacy/engine/intentDetector.js') as {
  INTENT_DEFINITIONS: Record<string, { priority: Priority }>;
};

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

function to12h(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

function money(n: number | null, currency: string): string {
  if (n === null) return '';
  const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  return formatted;
}

/** Sentences the legacy engine can mine for prices (it reads them from the system prompt). */
export function serviceSentences(profile: BusinessProfileInput): string[] {
  return profile.services
    .filter((s) => s.active)
    .map((s) => {
      const min = money(s.priceMin, s.currency);
      const max = money(s.priceMax, s.currency);
      switch (s.priceType) {
        case 'fixed':
          return `${s.name} costs ${min}.`;
        case 'from':
          return `${s.name} starts from ${min}.`;
        case 'range':
          return `${s.name} costs ${min} - ${max}.`;
        case 'free':
          return `${s.name} is free.`;
        default:
          return `${s.name} is priced by quote.`;
      }
    });
}

export function toLegacyTenant(workspace: { id: string; name: string; industry: string; timezone: string }, profile: BusinessProfileInput) {
  const [primary, ...others] = [...profile.locations].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
  const address = (l: BusinessProfileInput['locations'][number]) => ({
    street: l.street,
    city: l.city,
    state: l.region,
    zip: l.postalCode,
    country: l.country,
  });

  let hours: Record<string, unknown> | null = null;
  if (primary?.hoursConfigured) {
    hours = { timezone: workspace.timezone, holidays: profile.hoursExceptions.filter((e) => e.closed).map((e) => e.label || e.date) };
    DAYS.forEach((day, weekday) => {
      const slots = primary.hours.filter((h) => h.weekday === weekday);
      if (slots.length === 0) {
        hours![day] = { closed: true };
      } else {
        const opens = slots.map((s) => s.opens).sort()[0]!;
        const closes = slots.map((s) => s.closes).sort().at(-1)!;
        hours![day] = { open: to12h(opens), close: to12h(closes) };
      }
    });
  }

  const byKind = (kind: string) => profile.contacts.filter((c) => c.kind === kind);
  const asContact = (c?: BusinessProfileInput['contacts'][number]) =>
    c ? { name: c.name, role: c.role, phone: c.phone, email: c.email, available24x7: c.available24x7 } : null;

  let domain = '';
  try {
    domain = profile.websiteUrl ? new URL(profile.websiteUrl).host : '';
  } catch {
    domain = '';
  }

  return {
    id: workspace.id,
    brandName: profile.displayName || workspace.name,
    industry: workspace.industry,
    domain,
    businessProfile: {
      address: primary ? address(primary) : null,
      branches: others.map((l) => ({ name: l.name, address: address(l), phone: l.phone })),
      hours,
      contacts: {
        primary: asContact(byKind('primary')[0]),
        departments: byKind('department').map((d) => ({ name: d.name || d.role, phone: d.phone, email: d.email })),
        escalation: asContact(byKind('escalation')[0]),
        emergencyContact: asContact(byKind('emergency')[0]),
        fallback: asContact(byKind('fallback')[0]),
      },
      serviceAreas: profile.serviceAreas,
    },
  };
}

export function toLegacyAgent(agentId: string, agentName: string, config: AgentConfig, profile: BusinessProfileInput) {
  const prompt = [
    config.instructions,
    profile.description,
    ...serviceSentences(profile),
    ...profile.policies.map((p) => `${p.title}: ${p.body}`),
  ]
    .filter(Boolean)
    .join(' ');
  return {
    id: agentId,
    name: config.persona.displayName || agentName,
    type: 'chatbot',
    greeting: config.persona.greeting,
    systemPrompt: prompt,
  };
}

export function priorityOf(result: LegacyResult): Priority {
  const wf = result.workflowState?.type;
  if (wf === 'emergency_escalation' || result.intent === 'emergency_escalation') return 'P0';
  if (wf === 'human_handoff') return 'P1';
  if (wf === 'complaint_handling') return 'P2';
  return INTENT_DEFINITIONS[result.intent]?.priority ?? 'P4';
}

/** Turns the engine's tool executions for one turn into Action Queue records. */
export function actionsFromTools(executions: LegacyToolExecution[], base: { workspaceId: string; conversationId: string; isTest: boolean }): NewAction[] {
  const out: NewAction[] = [];
  const make = (type: ActionType, priority: Priority, title: string, payload: Record<string, unknown>) =>
    out.push({ ...base, type, priority, title, payload });
  const isEmergency = executions.some((e) => e.input.priority === 'emergency');

  if (isEmergency) {
    const cb = executions.find((e) => e.toolName === 'schedule_callback');
    make('emergency', 'P0', `Emergency — call back ${String(cb?.input.phoneNumber ?? 'customer')}`, {
      callbackNumber: cb?.input.phoneNumber ?? null,
      reason: cb?.input.reason ?? executions[0]?.input.reason ?? null,
      customerName: cb?.input.customerName ?? null,
    });
  }

  for (const e of executions) {
    if (isEmergency && ['schedule_callback', 'transfer_to_human', 'send_notification'].includes(e.toolName)) continue;
    const input = e.input;
    switch (e.toolName) {
      case 'transfer_to_human': {
        const cb = executions.find((x) => x.toolName === 'schedule_callback');
        make('human_handoff', 'P1', `Customer asked for a person${cb ? ` — call ${String(cb.input.phoneNumber)}` : ''}`, {
          reason: input.reason ?? null,
          customerName: input.customerName ?? null,
          callbackNumber: cb?.input.phoneNumber ?? null,
        });
        break;
      }
      case 'schedule_callback':
        if (!executions.some((x) => x.toolName === 'transfer_to_human')) {
          make('callback_request', 'P1', `Call back ${String(input.phoneNumber)}`, { callbackNumber: input.phoneNumber, reason: input.reason ?? null });
        }
        break;
      case 'book_appointment':
        make('booking_request', 'P3', `Appointment request — ${String(input.customerName)}`, {
          customerName: input.customerName,
          requestedDate: input.date,
          requestedTime: input.time,
          phone: input.phone || null,
          email: input.email || null,
        });
        break;
      case 'create_support_ticket':
        make('support_ticket', 'P2', `Complaint — ${String(input.category).replace(/_/g, ' ')}`, {
          category: input.category,
          description: input.description,
          referenceNumber: input.referenceNumber || null,
          phone: input.phone || null,
        });
        break;
      case 'create_crm_lead':
        if (input.source !== 'appointment_booking') {
          make('lead', 'P5', `New lead${input.customerName && input.customerName !== 'Prospect' ? ` — ${String(input.customerName)}` : ''}`, {
            customerName: input.customerName ?? null,
            phone: input.phone || null,
            email: input.email || null,
            interests: input.interests ?? null,
          });
        }
        break;
      default:
        break;
    }
  }
  return out;
}

export interface TurnInput {
  tenant: ReturnType<typeof toLegacyTenant>;
  agent: ReturnType<typeof toLegacyAgent>;
  conversationId: string;
  state: LegacySession | null;
  text: string;
}

/** One customer turn through the legacy engine with state loaded from and returned to the DB. */
export async function runLegacyTurn({ tenant, agent, conversationId, state, text }: TurnInput) {
  const started = Date.now();
  if (state && Object.keys(state).length) {
    engine.stateManager.importSession({ ...state, tenantId: tenant.id, agentId: agent.id, sessionKey: conversationId });
  }
  let result: LegacyResult;
  let session: LegacySession | null;
  try {
    result = await engine.processMessage(tenant, agent, text, [], conversationId);
  } finally {
    session = engine.stateManager.exportSession(tenant.id, agent.id, conversationId);
  }
  const executions = (session?.toolExecutions ?? []).filter((e) => e.timestamp >= started);
  return { result, session: session ?? {}, executions, latencyMs: Date.now() - started };
}
