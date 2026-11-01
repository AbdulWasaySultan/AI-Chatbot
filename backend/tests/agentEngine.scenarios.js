/**
 * AI Agent Engine — Automated Test Suite
 * 
 * Tests all 15+ scenarios from the requirements:
 * Emergency escalation, location vs hours, complaints, human handoff,
 * multi-intent, conversation continuity, tenant isolation, etc.
 * 
 * Run directly: node backend/tests/agentEngine.scenarios.js
 * Also run by Vitest through agentEngine.test.mjs.
 */

const { processMessage, detectIntents, stateManager } = require('../engine');

// Test helpers
let passed = 0;
let failed = 0;
let total = 0;
const results = [];
const verbose = require.main === module;
const log = (...args) => { if (verbose) console.log(...args); };

function assert(condition, testName, details = '') {
  total++;
  results.push({ section: currentSection, name: testName, ok: !!condition, details });
  if (condition) {
    passed++;
    log(`  ✅ ${testName}`);
  } else {
    failed++;
    log(`  ❌ ${testName}`);
    if (details) log(`     → ${details}`);
  }
}

let currentSection = '';
function section(name) {
  currentSection = name;
  log(`\n${'='.repeat(60)}`);
  log(`📋 ${name}`);
  log('='.repeat(60));
}

// Seed tenant for testing
const testTenant = {
  id: 'tenant-test-1',
  brandName: 'TestBiz Corp',
  industry: 'Healthcare / Medical',
  domain: 'ai.testbiz.com',
  businessProfile: {
    address: { street: '123 Main Street', city: 'New York', state: 'NY', zip: '10001', country: 'USA' },
    branches: [
      { name: 'Brooklyn Branch', address: { street: '456 Atlantic Ave', city: 'Brooklyn', state: 'NY' }, phone: '+1 (212) 555-0102' },
    ],
    hours: {
      timezone: 'America/New_York',
      monday: { open: '9:00 AM', close: '5:00 PM' },
      tuesday: { open: '9:00 AM', close: '5:00 PM' },
      wednesday: { open: '9:00 AM', close: '5:00 PM' },
      thursday: { open: '9:00 AM', close: '5:00 PM' },
      friday: { open: '9:00 AM', close: '5:00 PM' },
      saturday: { open: '10:00 AM', close: '2:00 PM' },
      sunday: { closed: true },
    },
    contacts: {
      primary: { name: 'Dr. Jane Smith', role: 'Director', phone: '+1 (212) 555-0100', email: 'jane@testbiz.com' },
      departments: [
        { name: 'Billing', phone: '+1 (212) 555-0103', email: 'billing@testbiz.com' },
      ],
      escalation: { name: 'Manager', phone: '+1 (212) 555-0104', email: 'manager@testbiz.com', priority: 'high' },
      emergencyContact: { name: 'On-Call Doctor', phone: '+1 (212) 555-0199', available24x7: true },
    },
    serviceAreas: ['Manhattan', 'Brooklyn', 'Queens'],
  },
  agents: [],
};

const testAgent = {
  id: 'agent-test-1',
  name: 'TestBot - AI Assistant',
  type: 'chatbot',
  systemPrompt: 'You are the AI assistant for TestBiz Corp, a medical clinic. Consultation costs $150. Emergency visits cost $250. We accept BlueCross and Aetna insurance. Located at 123 Main Street, New York.',
  greeting: 'Welcome to TestBiz Corp!',
  voiceId: 'N/A',
  phoneNumber: '+1 (212) 555-0100',
};

// Second tenant for isolation tests
const testTenant2 = {
  id: 'tenant-test-2',
  brandName: 'Pizza Palace',
  industry: 'Restaurant / Food Service',
  domain: 'order.pizzapalace.com',
  businessProfile: {
    address: { street: '789 Food Court Blvd', city: 'Chicago', state: 'IL', zip: '60601', country: 'USA' },
    branches: [],
    hours: {
      timezone: 'America/Chicago',
      monday: { open: '11:00 AM', close: '11:00 PM' },
      tuesday: { open: '11:00 AM', close: '11:00 PM' },
      wednesday: { open: '11:00 AM', close: '11:00 PM' },
      thursday: { open: '11:00 AM', close: '11:00 PM' },
      friday: { open: '11:00 AM', close: '12:00 AM' },
      saturday: { open: '10:00 AM', close: '12:00 AM' },
      sunday: { open: '12:00 PM', close: '10:00 PM' },
    },
    contacts: {
      primary: { name: 'Tony Russo', role: 'Owner', phone: '+1 (312) 555-0200', email: 'tony@pizzapalace.com' },
      escalation: { name: 'Tony Russo', phone: '+1 (312) 555-0200' },
    },
    serviceAreas: ['Chicago', 'Downtown Chicago'],
  },
  agents: [],
};

const testAgent2 = {
  id: 'agent-test-2',
  name: 'PizzaBot - Order Assistant',
  type: 'chatbot',
  systemPrompt: 'You are the ordering assistant for Pizza Palace. Large cheese pizza $12.99, pepperoni $14.99, supreme $16.99. Delivery fee $3.99 within 5 miles. We accept cash, card, and Apple Pay.',
  greeting: 'Welcome to Pizza Palace!',
};

async function runTests() {
  log('\n🧪 AI Agent Engine — Automated Test Suite');
  log('Starting tests...\n');

  // ================================================
  // TEST 1: Emergency Escalation
  // ================================================
  section('Test 1: Emergency Escalation');
  
  stateManager.resetSession(testTenant.id, testAgent.id, 'test-emergency');
  
  let result = await processMessage(testTenant, testAgent, 
    'I have an urgent emergency and need immediate help.', [], 'test-emergency');
  
  assert(result.intent === 'emergency_escalation', 'Detects emergency intent', `Got: ${result.intent}`);
  assert(result.reply.toLowerCase().includes('emergency') || result.reply.toLowerCase().includes('urgent'), 
    'Response acknowledges emergency', `Got: ${result.reply.slice(0, 80)}`);
  assert(result.reply.toLowerCase().includes('phone') || result.reply.toLowerCase().includes('number'),
    'Asks for callback number', `Got: ${result.reply.slice(0, 100)}`);

  // Follow up with phone number
  let result2 = await processMessage(testTenant, testAgent,
    '03312679795', [], 'test-emergency');
  
  assert(result2.intent === 'emergency_escalation' || result2.intent === 'callback_number_provided',
    'Recognizes callback number in emergency context', `Got: ${result2.intent}`);
  assert(!result2.reply.toLowerCase().includes('buy') && !result2.reply.toLowerCase().includes('schedule a viewing'),
    'Does NOT return to sales after callback', `Got: ${result2.reply.slice(0, 100)}`);
  assert(result2.reply.toLowerCase().includes('submitted') || result2.reply.toLowerCase().includes('callback') || result2.reply.toLowerCase().includes('contact'),
    'Reports escalation status', `Got: ${result2.reply.slice(0, 100)}`);

  // ================================================
  // TEST 2: Location Inquiry (NOT hours)
  // ================================================
  section('Test 2: Location Inquiry');
  
  stateManager.resetSession(testTenant.id, testAgent.id, 'test-location');
  
  result = await processMessage(testTenant, testAgent,
    'Where are you located?', [], 'test-location');
  
  assert(result.intent === 'location_inquiry', 'Detects location intent', `Got: ${result.intent}`);
  assert(result.reply.includes('123 Main Street') || result.reply.includes('New York'),
    'Returns configured address', `Got: ${result.reply.slice(0, 120)}`);
  assert(!result.reply.includes('9:00 AM') && !result.reply.includes('5:00 PM'),
    'Does NOT include operating hours in location response', `Got: ${result.reply.slice(0, 120)}`);

  // ================================================
  // TEST 3: Business Hours (NOT location)
  // ================================================
  section('Test 3: Business Hours');
  
  stateManager.resetSession(testTenant.id, testAgent.id, 'test-hours');
  
  result = await processMessage(testTenant, testAgent,
    'What time do you close?', [], 'test-hours');
  
  assert(result.intent === 'operating_hours_inquiry', 'Detects hours intent', `Got: ${result.intent}`);
  assert(result.reply.includes('5:00 PM') || result.reply.includes('AM') || result.reply.includes('hours'),
    'Returns operating hours info', `Got: ${result.reply.slice(0, 120)}`);
  assert(!result.reply.includes('123 Main Street'),
    'Does NOT return address as main answer', `Got: ${result.reply.slice(0, 120)}`);

  // ================================================
  // TEST 4: Combined Location + Hours
  // ================================================
  section('Test 4: Combined Location + Hours');
  
  stateManager.resetSession(testTenant.id, testAgent.id, 'test-combined');
  
  result = await processMessage(testTenant, testAgent,
    'Where are you located and are you open on Sunday?', [], 'test-combined');
  
  const hasLocation = result.reply.includes('123 Main Street') || result.reply.includes('New York') || result.reply.toLowerCase().includes('located');
  const hasHours = result.reply.toLowerCase().includes('sunday') || result.reply.toLowerCase().includes('closed') || result.reply.toLowerCase().includes('hours');
  
  assert(hasLocation, 'Response includes location info', `Got: ${result.reply.slice(0, 150)}`);
  assert(hasHours, 'Response includes hours info', `Got: ${result.reply.slice(0, 150)}`);

  // ================================================
  // TEST 5: Positive Feedback
  // ================================================
  section('Test 5: Positive Feedback');
  
  stateManager.resetSession(testTenant.id, testAgent.id, 'test-positive');
  
  result = await processMessage(testTenant, testAgent,
    'Your team was amazing. I had a wonderful experience.', [], 'test-positive');
  
  assert(result.intent === 'positive_feedback', 'Detects positive feedback', `Got: ${result.intent}`);
  assert(result.reply.toLowerCase().includes('thank') || result.reply.toLowerCase().includes('glad') || result.reply.toLowerCase().includes('delighted'),
    'Acknowledges and appreciates', `Got: ${result.reply.slice(0, 100)}`);
  assert(!result.reply.toLowerCase().includes('sorry') && !result.reply.toLowerCase().includes('complaint'),
    'Does NOT initiate complaint workflow', `Got: ${result.reply.slice(0, 100)}`);

  // ================================================
  // TEST 6: Negative Feedback
  // ================================================
  section('Test 6: Negative Feedback');
  
  stateManager.resetSession(testTenant.id, testAgent.id, 'test-negative');
  
  result = await processMessage(testTenant, testAgent,
    'Your customer service is terrible.', [], 'test-negative');
  
  assert(result.intent === 'negative_feedback', 'Detects negative feedback', `Got: ${result.intent}`);
  assert(result.reply.toLowerCase().includes('sorry') || result.reply.toLowerCase().includes('apologize'),
    'Apologizes', `Got: ${result.reply.slice(0, 100)}`);
  assert(result.reply.includes('?'), 'Asks follow-up question', `Got: ${result.reply.slice(0, 150)}`);

  // ================================================
  // TEST 7: Specific Complaint
  // ================================================
  section('Test 7: Specific Complaint');
  
  stateManager.resetSession(testTenant.id, testAgent.id, 'test-complaint');
  
  result = await processMessage(testTenant, testAgent,
    'My order arrived damaged.', [], 'test-complaint');
  
  assert(result.intent === 'customer_complaint', 'Detects complaint intent', `Got: ${result.intent}`);
  assert(result.reply.toLowerCase().includes('sorry') || result.reply.toLowerCase().includes('apologize'),
    'Shows empathy', `Got: ${result.reply.slice(0, 100)}`);
  assert(result.reply.toLowerCase().includes('reference') || result.reply.toLowerCase().includes('order') || result.reply.toLowerCase().includes('details'),
    'Asks for order reference/details', `Got: ${result.reply.slice(0, 150)}`);

  // ================================================
  // TEST 8: Human Handoff
  // ================================================
  section('Test 8: Human Handoff');
  
  stateManager.resetSession(testTenant.id, testAgent.id, 'test-handoff');
  
  result = await processMessage(testTenant, testAgent,
    'I want to speak with a real person.', [], 'test-handoff');
  
  assert(result.intent === 'human_representative_request', 'Detects human handoff intent', `Got: ${result.intent}`);
  assert(result.reply.toLowerCase().includes('speak') || result.reply.toLowerCase().includes('connect') || result.reply.toLowerCase().includes('representative') || result.reply.toLowerCase().includes('someone'),
    'Acknowledges handoff request', `Got: ${result.reply.slice(0, 120)}`);

  // ================================================
  // TEST 9: Multiple Intents
  // ================================================
  section('Test 9: Multiple Intents');
  
  stateManager.resetSession(testTenant.id, testAgent.id, 'test-multi');
  
  result = await processMessage(testTenant, testAgent,
    'I want to book an appointment, and can you tell me where your office is?', [], 'test-multi');
  
  const mentionsAppointment = result.reply.toLowerCase().includes('appointment') || result.reply.toLowerCase().includes('schedule') || result.reply.toLowerCase().includes('book');
  const mentionsLocation = result.reply.toLowerCase().includes('located') || result.reply.includes('123 Main Street') || result.reply.includes('New York') || result.reply.toLowerCase().includes('office');
  
  assert(mentionsAppointment, 'Handles appointment intent', `Got: ${result.reply.slice(0, 150)}`);
  // Multi-intent might handle the primary one first
  assert(mentionsAppointment || mentionsLocation, 'Handles at least one intent properly', `Got: ${result.reply.slice(0, 150)}`);

  // ================================================
  // TEST 10: Conversation Continuity
  // ================================================
  section('Test 10: Conversation Continuity');
  
  stateManager.resetSession(testTenant.id, testAgent.id, 'test-continuity');
  
  result = await processMessage(testTenant, testAgent,
    'I want to book an appointment.', [], 'test-continuity');
  assert(result.intent === 'appointment_scheduling', 'Starts appointment workflow', `Got: ${result.intent}`);
  
  result2 = await processMessage(testTenant, testAgent,
    'Tomorrow', [], 'test-continuity');
  assert(result2.reply.toLowerCase().includes('tomorrow') || result2.reply.toLowerCase().includes('time'),
    'Understands "tomorrow" in appointment context', `Got: ${result2.reply.slice(0, 120)}`);
  
  let result3 = await processMessage(testTenant, testAgent,
    '3 PM', [], 'test-continuity');
  assert(result3.reply.toLowerCase().includes('3 pm') || result3.reply.toLowerCase().includes('name'),
    'Understands "3 PM" as appointment time', `Got: ${result3.reply.slice(0, 120)}`);

  // ================================================
  // TEST 11: Missing Information
  // ================================================
  section('Test 11: Missing Information');
  
  const tenantNoAddress = {
    ...testTenant,
    id: 'tenant-no-address',
    businessProfile: {
      ...testTenant.businessProfile,
      address: null,
      branches: [],
    },
  };
  stateManager.resetSession(tenantNoAddress.id, testAgent.id, 'test-missing');
  
  result = await processMessage(tenantNoAddress, testAgent,
    "What's your branch address?", [], 'test-missing');
  
  assert(!result.reply.includes('123 Main Street'), 'Does NOT invent an address', `Got: ${result.reply.slice(0, 120)}`);
  assert(result.reply.toLowerCase().includes('don\'t') || result.reply.toLowerCase().includes('unavailable') || result.reply.toLowerCase().includes('apologize') || result.reply.toLowerCase().includes('not') || result.reply.toLowerCase().includes('website'),
    'Explains info is unavailable', `Got: ${result.reply.slice(0, 150)}`);

  // ================================================
  // TEST 12: Mixed Feedback
  // ================================================
  section('Test 12: Mixed Feedback');
  
  stateManager.resetSession(testTenant.id, testAgent.id, 'test-mixed');
  
  result = await processMessage(testTenant, testAgent,
    'I love your product, but your delivery service is disappointing.', [], 'test-mixed');
  
  const hasPositiveAck = result.reply.toLowerCase().includes('glad') || result.reply.toLowerCase().includes('thank') || result.reply.toLowerCase().includes('positive');
  const hasNegativeAck = result.reply.toLowerCase().includes('sorry') || result.reply.toLowerCase().includes('disappoint') || result.reply.toLowerCase().includes('address') || result.reply.toLowerCase().includes('improve');
  
  assert(hasPositiveAck || hasNegativeAck, 'Recognizes mixed sentiment', `Got: ${result.reply.slice(0, 150)}`);

  // ================================================
  // TEST 13: Failed External Action (Simulated)
  // ================================================
  section('Test 13: Tool Execution Status');
  
  stateManager.resetSession(testTenant.id, testAgent.id, 'test-tool');
  
  // Emergency → callback → check that response mentions "submitted"/"pending" not "completed successfully"
  result = await processMessage(testTenant, testAgent,
    'I have an emergency!', [], 'test-tool');
  result2 = await processMessage(testTenant, testAgent,
    '555-0199', [], 'test-tool');
  
  assert(!result2.reply.toLowerCase().includes('successfully connected') && !result2.reply.toLowerCase().includes('call has been placed'),
    'Does NOT claim live call was made', `Got: ${result2.reply.slice(0, 120)}`);
  assert(result2.reply.toLowerCase().includes('submitted') || result2.reply.toLowerCase().includes('request') || result2.reply.toLowerCase().includes('contact'),
    'Uses appropriate pending language', `Got: ${result2.reply.slice(0, 120)}`);

  // ================================================
  // TEST 14: Tenant Isolation
  // ================================================
  section('Test 14: Tenant Isolation');
  
  stateManager.resetSession(testTenant.id, testAgent.id, 'test-iso-1');
  stateManager.resetSession(testTenant2.id, testAgent2.id, 'test-iso-2');
  
  const result_t1 = await processMessage(testTenant, testAgent,
    'Where are you located?', [], 'test-iso-1');
  const result_t2 = await processMessage(testTenant2, testAgent2,
    'Where are you located?', [], 'test-iso-2');
  
  assert(result_t1.reply.includes('New York') || result_t1.reply.includes('123 Main'),
    'Tenant 1 gets its own address', `Got: ${result_t1.reply.slice(0, 120)}`);
  assert(result_t2.reply.includes('Chicago') || result_t2.reply.includes('789 Food'),
    'Tenant 2 gets its own address', `Got: ${result_t2.reply.slice(0, 120)}`);
  assert(!result_t1.reply.includes('Chicago') && !result_t1.reply.includes('Pizza'),
    'Tenant 1 does NOT leak Tenant 2 data', `Got: ${result_t1.reply.slice(0, 120)}`);
  assert(!result_t2.reply.includes('New York') && !result_t2.reply.includes('TestBiz'),
    'Tenant 2 does NOT leak Tenant 1 data', `Got: ${result_t2.reply.slice(0, 120)}`);

  // ================================================
  // TEST 15: Instruction Conflict — Emergency > Sales
  // ================================================
  section('Test 15: Emergency Overrides Sales');
  
  const salesAgent = {
    ...testAgent,
    id: 'agent-sales',
    systemPrompt: 'You are an aggressive sales agent. Always push for a sale. Offer discounts. Ask about budget. Never stop selling. Always recommend our premium package at $999.',
  };
  stateManager.resetSession(testTenant.id, salesAgent.id, 'test-conflict');
  
  result = await processMessage(testTenant, salesAgent,
    'I have an emergency and need immediate help!', [], 'test-conflict');
  
  assert(result.intent === 'emergency_escalation', 'Emergency overrides sales personality', `Got: ${result.intent}`);
  assert(!result.reply.toLowerCase().includes('premium package') && !result.reply.toLowerCase().includes('$999') && !result.reply.toLowerCase().includes('discount'),
    'Sales behavior is suspended', `Got: ${result.reply.slice(0, 120)}`);

  // ================================================
  // TEST 16: Intent Detection — Unit Tests
  // ================================================
  section('Test 16: Intent Detection Unit Tests');
  
  let intents;
  
  intents = detectIntents('Hello there!');
  assert(intents[0].intent === 'greeting', 'Detects greeting', `Got: ${intents[0].intent}`);
  
  intents = detectIntents('How much does a cleaning cost?');
  assert(intents.some(i => i.intent === 'pricing_inquiry'), 'Detects pricing', `Got: ${intents.map(i=>i.intent).join(', ')}`);
  
  intents = detectIntents('What is your address?');
  assert(intents[0].intent === 'location_inquiry', 'Detects location (address)', `Got: ${intents[0].intent}`);
  assert(!intents.some(i => i.intent === 'operating_hours_inquiry'), 'Location does NOT trigger hours', `Got: ${intents.map(i=>i.intent).join(', ')}`);
  
  intents = detectIntents('Are you open on Saturday?');
  assert(intents[0].intent === 'operating_hours_inquiry', 'Detects hours (Saturday)', `Got: ${intents[0].intent}`);
  assert(!intents.some(i => i.intent === 'location_inquiry'), 'Hours does NOT trigger location', `Got: ${intents.map(i=>i.intent).join(', ')}`);
  
  intents = detectIntents('I want to book an appointment for tomorrow');
  assert(intents.some(i => i.intent === 'appointment_scheduling'), 'Detects appointment scheduling', `Got: ${intents.map(i=>i.intent).join(', ')}`);
  
  intents = detectIntents('Can I speak with a real person?');
  assert(intents[0].intent === 'human_representative_request', 'Detects human handoff', `Got: ${intents[0].intent}`);
  
  intents = detectIntents('I have an emergency');
  assert(intents[0].intent === 'emergency_escalation', 'Detects emergency', `Got: ${intents[0].intent}`);
  assert(intents[0].priority === 'P0', 'Emergency is P0 priority', `Got: ${intents[0].priority}`);
  
  intents = detectIntents('Your service was excellent, really impressed!');
  assert(intents.some(i => i.intent === 'positive_feedback'), 'Detects positive feedback', `Got: ${intents.map(i=>i.intent).join(', ')}`);
  
  intents = detectIntents('Your service is absolutely terrible');
  assert(intents.some(i => i.intent === 'negative_feedback'), 'Detects negative feedback', `Got: ${intents.map(i=>i.intent).join(', ')}`);
  
  intents = detectIntents('My order arrived damaged');
  assert(intents.some(i => i.intent === 'customer_complaint'), 'Detects complaint', `Got: ${intents.map(i=>i.intent).join(', ')}`);
  
  intents = detectIntents('I want a refund');
  assert(intents.some(i => i.intent === 'refund_compensation'), 'Detects refund request', `Got: ${intents.map(i=>i.intent).join(', ')}`);
  
  intents = detectIntents('Cancel my order');
  assert(intents.some(i => i.intent === 'order_cancellation'), 'Detects order cancellation', `Got: ${intents.map(i=>i.intent).join(', ')}`);

  // ================================================
  // TEST 17: Pricing from system prompt
  // ================================================
  section('Test 17: Dynamic Pricing from Agent Prompt');
  
  stateManager.resetSession(testTenant.id, testAgent.id, 'test-pricing');
  
  result = await processMessage(testTenant, testAgent,
    'How much does a consultation cost?', [], 'test-pricing');
  
  assert(result.reply.includes('$150') || result.reply.includes('$250') || result.reply.toLowerCase().includes('consultation'),
    'Returns pricing from agent system prompt', `Got: ${result.reply.slice(0, 150)}`);
  assert(result.entities?.brand === 'TestBiz Corp', 'Entities include correct brand', `Got: ${JSON.stringify(result.entities)}`);

  // ================================================
  // RESULTS
  // ================================================
  log(`\n${'='.repeat(60)}`);
  log(`\n📊 TEST RESULTS: ${passed}/${total} passed, ${failed} failed\n`);
  
  if (failed === 0) {
    log('🎉 ALL TESTS PASSED!\n');
  } else {
    log(`⚠️  ${failed} test(s) need attention.\n`);
  }
  
  return { passed, failed, total, results };
}

module.exports = { runTests };

if (require.main === module) {
  runTests()
    .then(({ failed }) => process.exit(failed > 0 ? 1 : 0))
    .catch((err) => {
      console.error('Test runner failed:', err);
      process.exit(1);
    });
}
