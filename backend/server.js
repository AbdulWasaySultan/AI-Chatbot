const express = require('express');
const cors = require('cors');
const aiEngine = require('./engine');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ==========================================
// MULTI-TENANT DATA STORE (IN-MEMORY + SEED)
// ==========================================
let platformState = {
  masterAgency: {
    name: "FJ-Tech Solutions",
    tagline: "Enterprise White-Label AI Voice & Chatbot Infrastructure",
    mrr: 14850,
    activeCallsToday: 1284,
    messagesHandled: 48920
  },
  activeTenantId: "tenant-apex",
  tenants: [
    {
      id: "tenant-apex",
      brandName: "Apex Dental & Implant Studio",
      industry: "Healthcare / Dental",
      domain: "ai.apexdentalstudio.com",
      logoUrl: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=120&auto=format&fit=crop&q=80",
      primaryColor: "#6366f1",
      accentColor: "#06b6d4",
      monthlyRetainer: 1500,
      status: "Active",
      businessProfile: {
        address: { street: '1250 Ocean Drive, Suite 400', city: 'Miami', state: 'FL', zip: '33139', country: 'USA' },
        branches: [],
        hours: {
          timezone: 'America/New_York',
          monday: { open: '8:00 AM', close: '6:00 PM' },
          tuesday: { open: '8:00 AM', close: '6:00 PM' },
          wednesday: { open: '8:00 AM', close: '6:00 PM' },
          thursday: { open: '8:00 AM', close: '6:00 PM' },
          friday: { open: '8:00 AM', close: '6:00 PM' },
          saturday: { open: '9:00 AM', close: '3:00 PM' },
          sunday: { closed: true },
          holidays: ['Christmas Day', 'Thanksgiving', 'New Year\'s Day'],
        },
        contacts: {
          primary: { name: 'Dr. Sarah Chen', role: 'Lead Dentist', phone: '+1 (888) 412-9040', email: 'info@apexdentalstudio.com' },
          departments: [
            { name: 'Appointments', phone: '+1 (888) 412-9041', email: 'appointments@apexdentalstudio.com' },
            { name: 'Insurance & Billing', phone: '+1 (888) 412-9042', email: 'billing@apexdentalstudio.com' },
          ],
          escalation: { name: 'Office Manager', phone: '+1 (888) 412-9040', email: 'manager@apexdentalstudio.com', priority: 'high' },
          emergencyContact: { name: 'On-Call Dentist', phone: '+1 (888) 412-9099', available24x7: true },
          fallback: { name: 'Front Desk', phone: '+1 (888) 412-9040', email: 'info@apexdentalstudio.com' },
        },
        serviceAreas: ['Miami', 'Miami Beach', 'Coral Gables', 'South Florida'],
      },
      agents: [
        {
          id: "agent-101",
          name: "Sophia - 24/7 Patient Receptionist",
          type: "voice",
          voiceId: "ElevenLabs - Rachel (Warm & Professional)",
          phoneNumber: "+1 (888) 412-9040",
          greeting: "Thank you for calling Apex Dental Studio! This is Sophia, your AI care coordinator. How can I help you with your smile today?",
          systemPrompt: "You are Sophia, the senior AI voice receptionist at Apex Dental & Implant Studio. You book teeth cleanings, emergency root canals, and cosmetic implant consultations. Dental cleanings cost $125 without insurance. We accept Delta Dental, Cigna, and Aetna. Open Mon-Sat 8am to 6pm. Always ask for the patient's full name and preferred time slot.",
          status: "Deployed",
          interactions: 642,
          avgLatencyMs: 410,
          createdAt: "2026-10-12"
        },
        {
          id: "agent-102",
          name: "Apex Web Concierge & Insurance Verifier",
          type: "chatbot",
          voiceId: "N/A (Web Widget)",
          phoneNumber: "Embedded on apexdentalstudio.com",
          greeting: "Hi there! Welcome to Apex Dental Studio. Need an instant quote on veneers, Invisalign, or an emergency appointment?",
          systemPrompt: "You are the website AI chat assistant for Apex Dental Studio. Answer questions concisely about Invisalign ($3,900 all-inclusive), Zoom Whitening ($299), and same-day emergency appointments. Offer to schedule a free 15-minute smile consultation.",
          status: "Deployed",
          interactions: 1840,
          avgLatencyMs: 280,
          createdAt: "2026-10-15"
        }
      ]
    },
    {
      id: "tenant-vanguard",
      brandName: "Vanguard Luxury Realty Group",
      industry: "Real Estate",
      domain: "concierge.vanguardluxury.io",
      logoUrl: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=120&auto=format&fit=crop&q=80",
      primaryColor: "#10b981",
      accentColor: "#f59e0b",
      monthlyRetainer: 2200,
      status: "Active",
      businessProfile: {
        address: { street: '999 Brickell Avenue, Penthouse Suite', city: 'Miami', state: 'FL', zip: '33131', country: 'USA' },
        branches: [
          { name: 'Dubai Office', address: { street: 'Palm Jumeirah Tower, Level 42', city: 'Dubai', country: 'UAE' }, phone: '+971 4 555 8900' },
        ],
        hours: {
          timezone: 'America/New_York',
          monday: { open: '9:00 AM', close: '7:00 PM' },
          tuesday: { open: '9:00 AM', close: '7:00 PM' },
          wednesday: { open: '9:00 AM', close: '7:00 PM' },
          thursday: { open: '9:00 AM', close: '7:00 PM' },
          friday: { open: '9:00 AM', close: '7:00 PM' },
          saturday: { open: '10:00 AM', close: '5:00 PM' },
          sunday: { open: '11:00 AM', close: '4:00 PM' },
        },
        contacts: {
          primary: { name: 'James Whitfield', role: 'Senior Broker', phone: '+1 (305) 990-8122', email: 'james@vanguardluxury.io' },
          departments: [
            { name: 'Sales', phone: '+1 (305) 990-8123', email: 'sales@vanguardluxury.io' },
            { name: 'Rentals', phone: '+1 (305) 990-8124', email: 'rentals@vanguardluxury.io' },
          ],
          escalation: { name: 'James Whitfield', phone: '+1 (305) 990-8122', email: 'james@vanguardluxury.io', priority: 'high' },
          emergencyContact: { name: 'VIP Concierge', phone: '+1 (305) 990-8100', available24x7: true },
        },
        serviceAreas: ['Miami', 'Brickell', 'Star Island', 'Coral Gables', 'Dubai', 'Palm Jumeirah'],
      },
      agents: [
        {
          id: "agent-201",
          name: "Marcus - Inbound Lead Qualifier",
          type: "voice",
          voiceId: "Deepgram Aura - Orion (Executive Male)",
          phoneNumber: "+1 (305) 990-8122",
          greeting: "Hello, you've reached Vanguard Luxury Realty. I'm Marcus, our automated property specialist. Are you looking to buy, sell, or schedule a private penthouse viewing?",
          systemPrompt: "You are Marcus, an executive real estate AI voice agent for Vanguard Luxury Realty in Miami & Dubai. Qualify buyers by asking for their budget range ($1M-$25M+), preferred neighborhood (Brickell, Star Island, Palm Jumeirah), and timeline. Offer to book a VIP showing with a senior broker.",
          status: "Deployed",
          interactions: 389,
          avgLatencyMs: 390,
          createdAt: "2026-10-18"
        },
        {
          id: "agent-202",
          name: "24/7 MLS Property Finder Bot",
          type: "chatbot",
          voiceId: "N/A (Omnichannel Chat)",
          phoneNumber: "WhatsApp & Web Widget",
          greeting: "Welcome to Vanguard Luxury Realty! Tell me how many bedrooms and which waterfront area you're exploring, and I'll send you off-market listings.",
          systemPrompt: "You are Vanguard Luxury Realty's instant property concierge. Share featured listings like The Residences at Brickell ($3.4M, 4BD/4.5BA private elevator) and Coral Gables Waterfront Villa ($6.8M, private dock). Collect the prospect's email or WhatsApp number to send PDF brochures.",
          status: "Deployed",
          interactions: 2190,
          avgLatencyMs: 245,
          createdAt: "2026-10-20"
        }
      ]
    },
    {
      id: "tenant-solaris",
      brandName: "Solaris Home Energy & HVAC",
      industry: "Home Services & Solar",
      domain: "portal.solarishome.energy",
      logoUrl: "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=120&auto=format&fit=crop&q=80",
      primaryColor: "#f97316",
      accentColor: "#eab308",
      monthlyRetainer: 1850,
      status: "Active",
      businessProfile: {
        address: { street: '4500 Solar Parkway', city: 'Tampa', state: 'FL', zip: '33602', country: 'USA' },
        branches: [],
        hours: {
          timezone: 'America/New_York',
          monday: { open: '7:00 AM', close: '8:00 PM' },
          tuesday: { open: '7:00 AM', close: '8:00 PM' },
          wednesday: { open: '7:00 AM', close: '8:00 PM' },
          thursday: { open: '7:00 AM', close: '8:00 PM' },
          friday: { open: '7:00 AM', close: '8:00 PM' },
          saturday: { open: '8:00 AM', close: '5:00 PM' },
          sunday: { open: '9:00 AM', close: '3:00 PM' },
        },
        contacts: {
          primary: { name: 'Mike Rodriguez', role: 'Service Manager', phone: '+1 (800) 755-2390', email: 'service@solarishome.energy' },
          departments: [
            { name: 'Emergency HVAC', phone: '+1 (800) 755-2391', email: 'emergency@solarishome.energy' },
            { name: 'Solar Consultations', phone: '+1 (800) 755-2392', email: 'solar@solarishome.energy' },
          ],
          escalation: { name: 'Mike Rodriguez', phone: '+1 (800) 755-2390', email: 'service@solarishome.energy', priority: 'high' },
          emergencyContact: { name: '24/7 Emergency Dispatch', phone: '+1 (800) 755-2399', available24x7: true },
        },
        serviceAreas: ['Tampa', 'St. Petersburg', 'Clearwater', 'Central Florida'],
      },
      agents: [
        {
          id: "agent-301",
          name: "Elena - Solar Rebate & Dispatch Caller",
          type: "voice",
          voiceId: "OpenAI Realtime - Nova (Energetic)",
          phoneNumber: "+1 (800) 755-2390",
          greeting: "Hi! Thanks for calling Solaris Home Energy. I'm Elena! Are you calling about our 24/7 emergency HVAC repair or the 30% Federal Solar Tax Credit assessment?",
          systemPrompt: "You are Elena from Solaris Home Energy. You dispatch emergency AC/heating technicians within 2 hours ($89 diagnostic fee waived with repair) and qualify homeowners for $0-down solar panel installations. Ask for the homeowner's average monthly electric bill and roof age.",
          status: "Deployed",
          interactions: 915,
          avgLatencyMs: 425,
          createdAt: "2026-10-24"
        }
      ]
    }
  ]
};

// ==========================================
// API ENDPOINTS
// ==========================================

// 1. Get full platform state (Master agency + all client tenants + active tenant)
app.get('/api/state', (req, res) => {
  const activeTenant = platformState.tenants.find(t => t.id === platformState.activeTenantId) || platformState.tenants[0];
  res.json({
    masterAgency: platformState.masterAgency,
    activeTenantId: activeTenant.id,
    activeTenant,
    tenants: platformState.tenants
  });
});

// 2. Switch active client tenant workspace
app.post('/api/tenants/switch', (req, res) => {
  const { tenantId, tenantSnapshot } = req.body;
  let found = platformState.tenants.find(t => t.id === tenantId);
  if (!found && tenantSnapshot && tenantSnapshot.brandName) {
    found = {
      id: tenantId || `tenant-${Date.now()}`,
      brandName: tenantSnapshot.brandName,
      industry: tenantSnapshot.industry || 'Enterprise',
      domain: tenantSnapshot.domain || 'ai.portal.com',
      logoUrl: tenantSnapshot.logoUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80',
      primaryColor: tenantSnapshot.primaryColor || '#635BFF',
      accentColor: tenantSnapshot.accentColor || '#21C8D8',
      monthlyRetainer: Number(tenantSnapshot.monthlyRetainer) || 1500,
      status: 'Active',
      agents: Array.isArray(tenantSnapshot.agents) ? tenantSnapshot.agents : []
    };
    platformState.tenants.push(found);
  }
  if (!found) {
    found = platformState.tenants[0];
  }
  platformState.activeTenantId = found.id;
  res.json({
    message: `Switched workspace to ${found.brandName}`,
    activeTenant: found
  });
});

// 3. Create a brand new client tenant workspace
app.post('/api/tenants', (req, res) => {
  const { brandName, industry, domain, logoUrl, primaryColor, accentColor, monthlyRetainer } = req.body;
  if (!brandName || !brandName.trim()) {
    return res.status(400).json({ error: 'Client brand name is required' });
  }

  const newTenant = {
    id: `tenant-${Date.now()}`,
    brandName: brandName.trim(),
    industry: industry || 'Commercial Enterprise',
    domain: domain || `ai.${brandName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
    logoUrl: logoUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80',
    primaryColor: primaryColor || '#635BFF',
    accentColor: accentColor || '#21C8D8',
    monthlyRetainer: Number(monthlyRetainer) || 1500,
    status: 'Active',
    businessProfile: aiEngine.knowledgeBase.createEmptyBusinessProfile(),
    agents: []
  };

  platformState.tenants.push(newTenant);
  platformState.activeTenantId = newTenant.id;
  platformState.masterAgency.mrr += newTenant.monthlyRetainer;

  res.status(201).json({
    message: 'New white-label client tenant created',
    activeTenant: newTenant,
    tenants: platformState.tenants,
    masterAgency: platformState.masterAgency
  });
});

// 4. Update white-label branding for a tenant (brand name, logo URL, primary/accent colors, domain)
app.put('/api/tenants/:tenantId/branding', (req, res) => {
  const { tenantId } = req.params;
  const { brandName, logoUrl, primaryColor, accentColor, domain, industry, monthlyRetainer } = req.body;

  let tenant = platformState.tenants.find(t => t.id === tenantId);
  if (!tenant) {
    tenant = {
      id: tenantId,
      brandName: (brandName && brandName.trim()) || 'Custom Client Workspace',
      industry: industry || 'Enterprise',
      domain: domain || 'ai.clientportal.com',
      logoUrl: logoUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80',
      primaryColor: primaryColor || '#635BFF',
      accentColor: accentColor || '#21C8D8',
      monthlyRetainer: Number(monthlyRetainer) || 1500,
      status: 'Active',
      agents: []
    };
    platformState.tenants.push(tenant);
  }

  if (brandName !== undefined && brandName.trim() !== '') tenant.brandName = brandName.trim();
  if (logoUrl !== undefined && logoUrl.trim() !== '') tenant.logoUrl = logoUrl.trim();
  if (primaryColor !== undefined) tenant.primaryColor = primaryColor;
  if (accentColor !== undefined) tenant.accentColor = accentColor;
  if (domain !== undefined) tenant.domain = domain.trim();
  if (industry !== undefined) tenant.industry = industry.trim();
  if (monthlyRetainer !== undefined && !isNaN(Number(monthlyRetainer))) {
    const diff = Number(monthlyRetainer) - tenant.monthlyRetainer;
    tenant.monthlyRetainer = Number(monthlyRetainer);
    platformState.masterAgency.mrr += diff;
  }

  // Update business profile if provided
  const { businessProfile } = req.body;
  if (businessProfile) {
    if (!tenant.businessProfile) {
      tenant.businessProfile = aiEngine.knowledgeBase.createEmptyBusinessProfile();
    }
    // Deep merge the business profile
    if (businessProfile.address) Object.assign(tenant.businessProfile.address, businessProfile.address);
    if (businessProfile.hours) Object.assign(tenant.businessProfile.hours, businessProfile.hours);
    if (businessProfile.contacts) {
      if (businessProfile.contacts.primary) Object.assign(tenant.businessProfile.contacts.primary, businessProfile.contacts.primary);
      if (businessProfile.contacts.escalation) Object.assign(tenant.businessProfile.contacts.escalation, businessProfile.contacts.escalation);
      if (businessProfile.contacts.emergencyContact) Object.assign(tenant.businessProfile.contacts.emergencyContact, businessProfile.contacts.emergencyContact);
      if (businessProfile.contacts.departments) tenant.businessProfile.contacts.departments = businessProfile.contacts.departments;
    }
    if (businessProfile.branches) tenant.businessProfile.branches = businessProfile.branches;
    if (businessProfile.serviceAreas) tenant.businessProfile.serviceAreas = businessProfile.serviceAreas;
  }

  res.json({
    message: 'White-label branding updated successfully',
    tenant,
    masterAgency: platformState.masterAgency
  });
});

// 5. Create & Deploy a new AI Voice Call Agent or Website Chatbot for a tenant
app.post('/api/tenants/:tenantId/agents', (req, res) => {
  const { tenantId } = req.params;
  const { name, type, voiceId, phoneNumber, greeting, systemPrompt, tenantSnapshot } = req.body;

  let tenant = platformState.tenants.find(t => t.id === tenantId);
  // If serverless instance cold-started after a custom tenant was created in the browser, auto-rehydrate it!
  if (!tenant && tenantSnapshot && tenantSnapshot.brandName) {
    tenant = {
      id: tenantId,
      brandName: tenantSnapshot.brandName,
      industry: tenantSnapshot.industry || 'Commercial Enterprise',
      domain: tenantSnapshot.domain || `ai.${tenantSnapshot.brandName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
      logoUrl: tenantSnapshot.logoUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80',
      primaryColor: tenantSnapshot.primaryColor || '#635BFF',
      accentColor: tenantSnapshot.accentColor || '#21C8D8',
      monthlyRetainer: Number(tenantSnapshot.monthlyRetainer) || 1500,
      status: 'Active',
      agents: Array.isArray(tenantSnapshot.agents) ? [...tenantSnapshot.agents] : []
    };
    platformState.tenants.push(tenant);
    platformState.activeTenantId = tenant.id;
  }
  if (!tenant) {
    tenant = platformState.tenants.find(t => t.id === platformState.activeTenantId) || platformState.tenants[0];
  }

  if (!name || !systemPrompt) {
    return res.status(400).json({ error: 'Agent name and system prompt are required' });
  }

  const normalizedType = type === 'chatbot' ? 'chatbot' : 'voice';

  const newAgent = {
    id: `agent-${Date.now()}`,
    name: name.trim(),
    type: normalizedType,
    voiceId: normalizedType === 'voice' ? (voiceId || 'ElevenLabs - Rachel (Warm & Professional)') : 'N/A (Web Chat Widget)',
    phoneNumber: phoneNumber ? phoneNumber.trim() : (normalizedType === 'voice' ? '+1 (888) 555-0199' : `Embedded on ${tenant.domain}`),
    greeting: greeting && greeting.trim()
      ? greeting.trim()
      : `Hello! Thank you for reaching out to ${tenant.brandName}. I am ${name.trim()}, how can I assist you today?`,
    systemPrompt: systemPrompt.trim(),
    status: 'Deployed',
    interactions: 1,
    avgLatencyMs: normalizedType === 'voice' ? 395 : 230,
    createdAt: new Date().toISOString().split('T')[0]
  };

  tenant.agents.unshift(newAgent);

  res.status(201).json({
    message: `${normalizedType === 'voice' ? 'AI Voice Call Agent' : 'AI Website Chatbot'} deployed successfully`,
    agent: newAgent,
    tenant
  });
});

// 6. Delete an agent from a tenant
app.delete('/api/tenants/:tenantId/agents/:agentId', (req, res) => {
  const { tenantId, agentId } = req.params;
  const tenant = platformState.tenants.find(t => t.id === tenantId) || platformState.tenants[0];

  tenant.agents = tenant.agents.filter(a => a.id !== agentId);
  res.json({
    message: 'Agent removed',
    tenant
  });
});

// 7. Live Interactive Webhook Simulator (handles both Voice Call turns & Website Chat messages)
app.post('/api/simulate/webhook', (req, res) => {
  const { tenantId, agentId, userMessage, mode, callHistory, tenantSnapshot, agentSnapshot } = req.body;

  let tenant = platformState.tenants.find(t => t.id === tenantId);
  if (!tenant && tenantSnapshot && tenantSnapshot.brandName) {
    tenant = {
      id: tenantId || `tenant-${Date.now()}`,
      brandName: tenantSnapshot.brandName,
      industry: tenantSnapshot.industry || 'Enterprise',
      domain: tenantSnapshot.domain || 'ai.portal.com',
      logoUrl: tenantSnapshot.logoUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80',
      primaryColor: tenantSnapshot.primaryColor || '#635BFF',
      accentColor: tenantSnapshot.accentColor || '#21C8D8',
      monthlyRetainer: Number(tenantSnapshot.monthlyRetainer) || 1500,
      status: 'Active',
      agents: Array.isArray(tenantSnapshot.agents) ? [...tenantSnapshot.agents] : []
    };
    platformState.tenants.push(tenant);
  }
  if (!tenant) {
    return res.status(404).json({ error: 'Client workspace not found. Please switch to a valid client first.' });
  }

  let agent = tenant.agents.find(a => a.id === agentId);
  if (!agent && agentSnapshot && agentSnapshot.name) {
    agent = {
      id: agentId || `agent-${Date.now()}`,
      name: agentSnapshot.name,
      type: agentSnapshot.type || (mode === 'voice' ? 'voice' : 'chatbot'),
      voiceId: agentSnapshot.voiceId || 'ElevenLabs - Rachel (Warm & Professional)',
      phoneNumber: agentSnapshot.phoneNumber || '+1 (888) 555-0199',
      greeting: agentSnapshot.greeting || `Welcome to ${tenant.brandName}!`,
      systemPrompt: agentSnapshot.systemPrompt || '',
      status: 'Deployed',
      interactions: Number(agentSnapshot.interactions) || 1,
      avgLatencyMs: Number(agentSnapshot.avgLatencyMs) || 320
    };
    tenant.agents.unshift(agent);
  }
  if (!agent) {
    return res.status(404).json({ error: `No AI agent found for ${tenant.brandName}. Please deploy an agent first.` });
  }

  // Update live telemetry counters
  agent.interactions = (agent.interactions || 0) + 1;
  if (agent.type === 'voice' || mode === 'voice') {
    platformState.masterAgency.activeCallsToday += 1;
  } else {
    platformState.masterAgency.messagesHandled += 1;
  }

  // Use the new AI Engine (async)
  const sessionKey = req.body.sessionKey || 'default';
  aiEngine.processMessage(tenant, agent, userMessage || '', callHistory || [], sessionKey)
    .then(responsePayload => {
      res.json({
        webhookEventId: `evt_${Date.now()}`,
        timestamp: new Date().toISOString(),
        tenantBrand: tenant.brandName,
        agentId: agent.id,
        agentName: agent.name,
        agentType: agent.type,
        voiceId: agent.voiceId,
        phoneNumber: agent.phoneNumber,
        reply: responsePayload.reply,
        intentDetected: responsePayload.intent,
        confidence: responsePayload.confidence,
        latencyMs: responsePayload.latencyMs,
        suggestedActions: responsePayload.suggestedActions,
        workflowState: responsePayload.workflowState || null,
        webhookPayloadInspector: {
          provider: agent.type === 'voice' ? 'FJ-Tech Voice Engine (Twilio + ElevenLabs + LLM)' : 'FJ-Tech Omnichannel Chat Webhook',
          tenant_id: tenant.id,
          agent_id: agent.id,
          model: 'fj-tech-realtime-4o',
          intent: responsePayload.intent,
          extracted_entities: responsePayload.entities,
          tool_triggered: responsePayload.toolTriggered
        },
        updatedStats: {
          agentInteractions: agent.interactions,
          activeCallsToday: platformState.masterAgency.activeCallsToday,
          messagesHandled: platformState.masterAgency.messagesHandled
        }
      });
    })
    .catch(err => {
      console.error('[Webhook Simulation Error]', err);
      res.status(500).json({ error: 'AI engine error', details: err.message });
    });
});

// 8. Get active conversation sessions (debugging)
app.get('/api/sessions', (req, res) => {
  res.json({ sessions: aiEngine.stateManager.getActiveSessions() });
});

// 9. Reset a conversation session
app.post('/api/sessions/reset', (req, res) => {
  const { tenantId, agentId, sessionKey } = req.body;
  aiEngine.stateManager.resetSession(tenantId, agentId, sessionKey || 'default');
  res.json({ message: 'Session reset successfully' });
});


if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n==================================================================`);
    console.log(`🚀 FJ-Tech Solutions White-Label AI Platform is LIVE!`);
    console.log(`📂 Backend API Directory : ${__dirname}`);
    console.log(`🌐 Local Dashboard URL   : http://localhost:${PORT}`);
    console.log(`==================================================================\n`);
  });
}

module.exports = app;


