// Shared enumerations (plans/05-data-model.md, plans/07-agent-runtime.md §4).

export const PRIORITIES = ['P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6'] as const;
export type Priority = (typeof PRIORITIES)[number];

/** Lower index = more urgent. */
export const priorityRank = (p: Priority): number => PRIORITIES.indexOf(p);
export const mostUrgent = (a: Priority, b: Priority): Priority =>
  priorityRank(a) <= priorityRank(b) ? a : b;

export const ORG_KINDS = ['business', 'agency'] as const;
export type OrgKind = (typeof ORG_KINDS)[number];

export const WORKSPACE_STATUSES = ['active', 'suspended', 'archived'] as const;

export const AGENT_STATUSES = ['draft', 'live', 'paused', 'archived'] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

export const VERSION_STATES = ['draft', 'published', 'superseded'] as const;

export const MODEL_TIERS = ['fast', 'standard', 'reasoning'] as const;
export type ModelTier = (typeof MODEL_TIERS)[number];

export const CHANNEL_KINDS = ['web_widget', 'hosted_page', 'sms', 'whatsapp', 'voice'] as const;

export const CONVERSATION_STATUSES = ['open', 'handed_off', 'closed'] as const;
export const MESSAGE_ROLES = ['customer', 'agent', 'operator', 'system'] as const;

export const ACTION_TYPES = [
  'emergency',
  'callback_request',
  'human_handoff',
  'booking_request',
  'booking',
  'support_ticket',
  'lead',
  'order_request',
  'custom',
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export const ACTION_STATUSES = ['new', 'in_progress', 'done', 'cancelled', 'failed'] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export const CONTACT_KINDS = ['primary', 'department', 'escalation', 'emergency', 'fallback'] as const;
export const PRICE_TYPES = ['fixed', 'from', 'range', 'quote', 'free'] as const;
export const POLICY_TOPICS = [
  'payment',
  'cancellation',
  'insurance',
  'parking',
  'accessibility',
  'custom',
] as const;
