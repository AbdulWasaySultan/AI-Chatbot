// Regression tests for bugs found in the audit (plans/02-current-state-audit.md §4.2, §3.4).
import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);
const engine = require('../../src/legacy/engine');
const { detectIntents, processMessage, knowledgeBase } = engine;

const topIntent = (msg) => detectIntents(msg)[0];

describe('emergency detection (B1, B2, B3)', () => {
  it.each([
    'Can you help me choose a plan?',
    'Do you install fire alarms?',
    'How much is an electrical panel upgrade?',
    'Could you help me find the right package?',
  ])('does not treat a routine question as an emergency: %s', (msg) => {
    expect(topIntent(msg).priority).not.toBe('P0');
  });

  it.each([
    'my son is bleeding a lot from his mouth after the extraction',
    'I smell gas in the kitchen',
    'water is pouring through my ceiling',
    'my dad has chest pain',
    'there is a fire in my garage',
    'I have an emergency',
  ])('detects a real emergency: %s', (msg) => {
    expect(topIntent(msg).intent).toBe('emergency_escalation');
    expect(topIntent(msg).priority).toBe('P0');
  });
});

describe('empty business profile (B6)', () => {
  const tenant = {
    id: 'tenant-empty',
    brandName: 'New Biz',
    industry: 'General',
    businessProfile: knowledgeBase.createEmptyBusinessProfile(),
  };
  const agent = { id: 'agent-empty', name: 'Ava', type: 'chatbot', systemPrompt: 'You are Ava.' };

  it('reports hours as not configured instead of "? - ?"', () => {
    expect(knowledgeBase.getBusinessHours(tenant).available).toBe(false);
  });

  it('reports contacts as not configured when every field is blank', () => {
    expect(knowledgeBase.getContactInfo(tenant).available).toBe(false);
  });

  it('never tells a customer placeholder hours', async () => {
    const res = await processMessage(tenant, agent, 'What are your opening hours?', [], 'b6-hours');
    expect(res.reply).not.toContain('?  -');
    expect(res.reply).not.toMatch(/\? - \?/);
  });
});

describe('no completion claims without confirmation (B7)', () => {
  const tenant = {
    id: 'tenant-b7',
    brandName: 'Clinic',
    industry: 'Healthcare',
    businessProfile: knowledgeBase.createEmptyBusinessProfile(),
  };
  const agent = { id: 'agent-b7', name: 'Ava', type: 'chatbot', systemPrompt: 'You are Ava.' };

  it('says the appointment is requested, not booked', async () => {
    await processMessage(tenant, agent, 'I want to book an appointment tomorrow at 3pm', [], 'b7');
    const res = await processMessage(tenant, agent, 'Ali Khan', [], 'b7');
    expect(res.reply.toLowerCase()).not.toContain('has been booked');
    expect(res.reply.toLowerCase()).toContain('request');
    expect(res.entities.appointmentConfirmed).toBe(false);
  });
});

describe('separate conversations do not share state (T5)', () => {
  const tenant = {
    id: 'tenant-t5',
    brandName: 'Shop',
    industry: 'Retail',
    businessProfile: knowledgeBase.createEmptyBusinessProfile(),
  };
  const agent = { id: 'agent-t5', name: 'Ava', type: 'chatbot', systemPrompt: 'You are Ava.' };

  it("never escalates an emergency to another visitor's phone number", async () => {
    await processMessage(tenant, agent, 'my number is 555 123 4567, I want info', [], 'visitor-a');
    const res = await processMessage(tenant, agent, 'This is an emergency', [], 'visitor-b');
    expect(res.reply).not.toContain('5551234567');
    expect(res.reply.toLowerCase()).toMatch(/phone|number/);
  });
});
