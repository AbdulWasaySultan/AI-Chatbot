// Request/response schemas shared by the API (validation) and the web app (forms, types).
import { z } from 'zod';
import {
  ACTION_STATUSES,
  CONTACT_KINDS,
  MODEL_TIERS,
  ORG_KINDS,
  POLICY_TOPICS,
  PRICE_TYPES,
} from './enums.ts';
import { ORG_ROLES, WORKSPACE_ROLES } from './permissions.ts';

const trimmed = (max: number) => z.string().trim().max(max);
const name = (max = 120) => trimmed(max).min(1, 'Required');
const optionalText = (max: number) => trimmed(max).optional().default('');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour HH:MM');
const timezone = z.string().refine(
  (tz) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  },
  { message: 'Unknown timezone' }
);

// ---------- Organizations & members ----------

export const createOrganizationSchema = z.object({
  name: name(),
  kind: z.enum(ORG_KINDS).default('business'),
});

export const createInvitationSchema = z
  .object({
    email: z.email(),
    orgRole: z.enum(ORG_ROLES).default('member'),
    workspaceId: z.uuid().optional(),
    workspaceRole: z.enum(WORKSPACE_ROLES).optional(),
  })
  .refine((v) => v.orgRole !== 'owner', { message: 'Owners cannot be invited', path: ['orgRole'] })
  .refine((v) => !v.workspaceId === !v.workspaceRole, {
    message: 'workspaceId and workspaceRole go together',
    path: ['workspaceRole'],
  });

export const setWorkspaceMemberSchema = z.object({ role: z.enum(WORKSPACE_ROLES) });

// ---------- Workspaces ----------

export const createWorkspaceSchema = z.object({
  name: name(),
  industry: optionalText(80),
  timezone: timezone.default('UTC'),
  locale: z.string().default('en'),
});

// No defaults here: a PATCH must only change the fields it sends.
export const updateWorkspaceSchema = z
  .object({ name: name(), industry: trimmed(80), timezone, locale: z.string() })
  .partial();

// ---------- Business profile (verified facts) ----------

export const openingHoursSchema = z
  .object({ weekday: z.number().int().min(0).max(6), opens: time, closes: time })
  .refine((h) => h.opens < h.closes, { message: 'Opening must be before closing', path: ['closes'] });

export const locationSchema = z.object({
  name: name(),
  isPrimary: z.boolean().default(false),
  street: optionalText(200),
  city: optionalText(120),
  region: optionalText(120),
  postalCode: optionalText(20),
  country: optionalText(80),
  phone: optionalText(40),
  email: z.union([z.email(), z.literal('')]).default(''),
  mapsUrl: z.union([z.url(), z.literal('')]).default(''),
  notes: optionalText(1000),
  /** false = hours not set up yet; true = days without rows are closed. */
  hoursConfigured: z.boolean().default(false),
  hours: z.array(openingHoursSchema).default([]),
});

export const hoursExceptionSchema = z.object({
  locationIndex: z.number().int().min(0).optional(),
  date: z.iso.date(),
  closed: z.boolean(),
  opens: time.optional(),
  closes: time.optional(),
  label: optionalText(120),
});

export const directoryContactSchema = z
  .object({
    kind: z.enum(CONTACT_KINDS),
    name: optionalText(120),
    role: optionalText(120),
    phone: optionalText(40),
    email: z.union([z.email(), z.literal('')]).default(''),
    available24x7: z.boolean().default(false),
    notify: z.boolean().default(false),
    priority: z.number().int().min(0).max(100).default(0),
  })
  .refine((c) => c.phone || c.email, { message: 'Add a phone number or email', path: ['phone'] });

export const serviceSchema = z
  .object({
    name: name(),
    description: optionalText(2000),
    priceType: z.enum(PRICE_TYPES).default('quote'),
    priceMin: z.number().nonnegative().nullable().default(null),
    priceMax: z.number().nonnegative().nullable().default(null),
    currency: z.string().length(3).default('USD'),
    durationMinutes: z.number().int().positive().nullable().default(null),
    bookable: z.boolean().default(false),
    active: z.boolean().default(true),
  })
  .refine((s) => !['fixed', 'from', 'range'].includes(s.priceType) || s.priceMin !== null, {
    message: 'Price is required for this price type',
    path: ['priceMin'],
  })
  .refine((s) => s.priceType !== 'range' || (s.priceMax !== null && s.priceMax >= (s.priceMin ?? 0)), {
    message: 'Maximum price must be at least the minimum',
    path: ['priceMax'],
  });

export const policySchema = z.object({
  topic: z.enum(POLICY_TOPICS),
  title: name(),
  body: trimmed(5000).min(1, 'Required'),
});

export const businessProfileSchema = z.object({
  displayName: name(),
  legalName: optionalText(200),
  description: optionalText(4000),
  websiteUrl: z.union([z.url(), z.literal('')]).default(''),
  primaryPhone: optionalText(40),
  primaryEmail: z.union([z.email(), z.literal('')]).default(''),
  serviceAreas: z.array(name(120)).max(100).default([]),
  locations: z.array(locationSchema).max(50).default([]),
  hoursExceptions: z.array(hoursExceptionSchema).max(366).default([]),
  contacts: z.array(directoryContactSchema).max(100).default([]),
  services: z.array(serviceSchema).max(500).default([]),
  policies: z.array(policySchema).max(100).default([]),
});
export type BusinessProfileInput = z.infer<typeof businessProfileSchema>;

// ---------- Agents ----------

export const personaSchema = z.object({
  displayName: optionalText(80),
  role: optionalText(120),
  tone: optionalText(200),
  language: z.string().default('en'),
  greeting: optionalText(1000),
});

export const agentConfigSchema = z.object({
  persona: personaSchema,
  instructions: trimmed(20000).default(''),
  capabilities: z.record(z.string(), z.record(z.string(), z.unknown())).default({}),
  guardrails: z
    .object({
      forbiddenTopics: z.array(trimmed(200)).default([]),
      disclaimers: z.array(trimmed(500)).default([]),
      maxReplyLength: z.number().int().positive().max(4000).optional(),
    })
    .default({ forbiddenTopics: [], disclaimers: [] }),
  knowledgeScope: z
    .object({ sourceIds: z.union([z.literal('all'), z.array(z.uuid())]).default('all') })
    .default({ sourceIds: 'all' }),
  webResearch: z
    .object({
      enabled: z.boolean().default(false),
      allowedDomains: z.array(trimmed(200)).default([]),
      blockedDomains: z.array(trimmed(200)).default([]),
      dailyLimit: z.number().int().min(0).max(10000).optional(),
    })
    .default({ enabled: false, allowedDomains: [], blockedDomains: [] }),
  modelTier: z.enum(MODEL_TIERS).default('standard'),
});
export type AgentConfig = z.infer<typeof agentConfigSchema>;

/**
 * Partial agent configuration for create/update. Deliberately has no defaults, so updating one
 * field (e.g. the greeting) never resets the others. The service merges it onto the draft.
 */
export const agentConfigPatchSchema = z
  .object({
    persona: z
      .object({ displayName: trimmed(80), role: trimmed(120), tone: trimmed(200), language: z.string(), greeting: trimmed(1000) })
      .partial(),
    instructions: trimmed(20000),
    capabilities: z.record(z.string(), z.record(z.string(), z.unknown())),
    guardrails: z
      .object({
        forbiddenTopics: z.array(trimmed(200)),
        disclaimers: z.array(trimmed(500)),
        maxReplyLength: z.number().int().positive().max(4000),
      })
      .partial(),
    knowledgeScope: z.object({ sourceIds: z.union([z.literal('all'), z.array(z.uuid())]) }).partial(),
    webResearch: z
      .object({
        enabled: z.boolean(),
        allowedDomains: z.array(trimmed(200)),
        blockedDomains: z.array(trimmed(200)),
        dailyLimit: z.number().int().min(0).max(10000),
      })
      .partial(),
    modelTier: z.enum(MODEL_TIERS),
  })
  .partial();
export type AgentConfigPatch = z.infer<typeof agentConfigPatchSchema>;

export const createAgentSchema = z.object({
  name: name(),
  config: agentConfigPatchSchema.optional(),
});

export const updateAgentSchema = z.object({
  name: name().optional(),
  config: agentConfigPatchSchema.optional(),
});

export const publishAgentSchema = z.object({ notes: optionalText(500) });
export const rollbackAgentSchema = z.object({ versionId: z.uuid() });

// ---------- Conversations & actions ----------

export const sendMessageSchema = z.object({ text: trimmed(4000).min(1, 'Message is empty') });

export const updateActionSchema = z
  .object({
    status: z.enum(ACTION_STATUSES).optional(),
    assigneeUserId: z.string().min(1).nullable().optional(),
    note: trimmed(4000).optional(),
  })
  .refine((v) => v.status !== undefined || v.assigneeUserId !== undefined || v.note, {
    message: 'Nothing to update',
  });

export const listActionsQuerySchema = z.object({
  status: z.enum(ACTION_STATUSES).optional(),
  type: z.string().optional(),
  priority: z.string().regex(/^P[0-6]$/).optional(),
  /** Actions created by sandbox (test) conversations are hidden unless asked for. */
  includeTests: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const listConversationsQuerySchema = z.object({
  agentId: z.uuid().optional(),
  includeTests: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
