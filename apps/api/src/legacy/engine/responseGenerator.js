/**
 * Response Generator — Core AI Agent Orchestrator
 * 
 * Processes detected intents, applies priority hierarchy, manages workflow
 * state transitions, executes tools, and composes context-aware responses.
 * This is the main engine that replaces generateIntelligentAgentResponse().
 */

const { detectIntents, extractEntities } = require('./intentDetector');
const stateManager = require('./conversationState');
const kb = require('./knowledgeBase');
const { executeTool, TOOL_STATUS } = require('./toolExecutor');

/**
 * Main response generation pipeline
 * 
 * @param {Object} tenant - The tenant/client object
 * @param {Object} agent - The AI agent object
 * @param {string} userMessage - The user's message
 * @param {Array} callHistory - Raw message history from frontend
 * @param {string} sessionKey - Optional session identifier
 * @returns {Object} Response payload
 */
async function generateResponse(tenant, agent, userMessage, callHistory, sessionKey) {
  const session = stateManager.getSession(tenant.id, agent.id, sessionKey);
  const prompt = agent.systemPrompt || '';
  const brandName = tenant.brandName;
  const industry = (tenant.industry || '').toLowerCase();

  // Add user message to session
  stateManager.addMessage(session, 'user', userMessage);

  // Detect intents with conversation context
  const detectedIntents = detectIntents(userMessage, session);
  const entities = extractEntities(userMessage);

  // Collect any entities found
  if (Object.keys(entities).length > 0) {
    stateManager.collectInfo(session, entities);
  }

  // Process response based on priority hierarchy
  let result;

  // Check if we have an active workflow that should take precedence
  if (session.activeWorkflow) {
    result = await handleActiveWorkflow(session, detectedIntents, entities, tenant, agent, userMessage);
  }

  // If no workflow handled it, or a higher-priority intent interrupted
  if (!result) {
    // Check for priority interrupts (emergency during sales, etc.)
    const highestIntent = detectedIntents[0];
    
    if (highestIntent.priority === 'P0') {
      result = await handleEmergency(session, detectedIntents, entities, tenant, agent, userMessage);
    } else if (highestIntent.priority === 'P1') {
      result = await handleUrgentEscalation(session, detectedIntents, entities, tenant, agent, userMessage);
    } else if (highestIntent.priority === 'P2') {
      result = await handleComplaintFeedback(session, detectedIntents, entities, tenant, agent, userMessage);
    } else {
      result = await handleStandardIntents(session, detectedIntents, entities, tenant, agent, userMessage);
    }
  }

  // Add agent response to session
  stateManager.addMessage(session, 'agent', result.reply, {
    intent: result.intent,
    toolTriggered: result.toolTriggered,
  });

  // Calculate latency simulation
  const latencyMs = agent.type === 'voice'
    ? Math.floor(340 + Math.random() * 140)
    : Math.floor(190 + Math.random() * 110);

  return {
    reply: result.reply,
    intent: result.intent,
    confidence: result.confidence || Number((0.94 + Math.random() * 0.05).toFixed(2)),
    latencyMs,
    entities: {
      brand: brandName,
      ...result.entities,
    },
    toolTriggered: result.toolTriggered || 'none',
    suggestedActions: result.suggestedActions || getDefaultSuggestions(industry),
    workflowState: session.activeWorkflow ? {
      type: session.activeWorkflow.type,
      state: session.activeWorkflow.state,
    } : null,
    sessionId: session.id,
  };
}

// ============================================================================
// WORKFLOW HANDLERS
// ============================================================================

/**
 * Handle active workflow continuations
 */
async function handleActiveWorkflow(session, intents, entities, tenant, agent, message) {
  const wf = session.activeWorkflow;
  const highestNewIntent = intents[0];

  // Check for priority interrupts — emergency during sales, etc.
  if (highestNewIntent.priority === 'P0' && wf.type !== 'emergency_escalation') {
    // Emergency interrupts any workflow
    stateManager.resolveWorkflow(session, 'interrupted_by_emergency');
    return null; // Let the emergency handler take over
  }
  if (highestNewIntent.priority === 'P1' && 
      wf.type !== 'emergency_escalation' && wf.type !== 'human_handoff') {
    stateManager.resolveWorkflow(session, 'interrupted_by_escalation');
    return null;
  }

  // Handle based on workflow type
  switch (wf.type) {
    case 'emergency_escalation':
      return await continueEmergencyWorkflow(session, intents, entities, tenant, agent, message);
    case 'human_handoff':
      return await continueHandoffWorkflow(session, intents, entities, tenant, agent, message);
    case 'appointment_scheduling':
      return await continueAppointmentWorkflow(session, intents, entities, tenant, agent, message);
    case 'complaint_handling':
      return await continueComplaintWorkflow(session, intents, entities, tenant, agent, message);
    case 'order_placement':
      return await continueOrderWorkflow(session, intents, entities, tenant, agent, message);
    default:
      return null;
  }
}

// ============================================================================
// EMERGENCY (P0)
// ============================================================================

async function handleEmergency(session, intents, entities, tenant, agent, message) {
  const brandName = tenant.brandName;
  
  // Start emergency workflow
  stateManager.setWorkflow(session, 'emergency_escalation', 'EMERGENCY_DETECTED', {
    reason: message,
    detectedAt: Date.now(),
  });

  // Check if we already have a phone number
  if (entities.phoneNumber || stateManager.hasInfo(session, 'phoneNumber')) {
    const phone = entities.phoneNumber || session.collectedInfo.phoneNumber;
    stateManager.updateWorkflowState(session, 'CALLBACK_NUMBER_RECEIVED', { callbackNumber: phone });
    
    // Execute escalation
    return await executeEscalation(session, tenant, agent, phone, message);
  }

  // Need to collect callback number
  stateManager.updateWorkflowState(session, 'AWAITING_CALLBACK_NUMBER');

  // Check for life-threatening situations
  const lifeThreateningKeywords = /fire|flood|gas leak|electrocution|injury|injured|accident|medical emergency|heart|choking|bleeding|unconscious/i;
  const isLifeThreatening = lifeThreateningKeywords.test(message);

  let reply = `I understand this is an emergency and I'm treating this with the highest priority. `;
  
  if (isLifeThreatening) {
    reply += `If you or anyone is in immediate danger, please call your local emergency services (911/999/112) right away. `;
  }
  
  reply += `I need your phone number so I can have someone from ${brandName} contact you immediately. What is the best number to reach you on?`;

  return {
    reply,
    intent: 'emergency_escalation',
    confidence: 0.99,
    entities: { priority: 'CRITICAL' },
    toolTriggered: 'emergency_workflow_initiated',
    suggestedActions: ['My number is...', 'Call me at...', 'This is life-threatening'],
  };
}

async function continueEmergencyWorkflow(session, intents, entities, tenant, agent, message) {
  const wf = session.activeWorkflow;

  if (wf.state === 'AWAITING_CALLBACK_NUMBER') {
    // Check for phone number in the message
    const phone = entities.phoneNumber || extractPhoneFromMessage(message);
    
    if (phone) {
      stateManager.collectInfo(session, { phoneNumber: phone });
      stateManager.updateWorkflowState(session, 'CALLBACK_NUMBER_RECEIVED', { callbackNumber: phone });
      return await executeEscalation(session, tenant, agent, phone, wf.data.reason || message);
    }

    // Still no number — ask again gently
    return {
      reply: `I need a phone number to connect you with our team urgently. Could you please share the best number to reach you?`,
      intent: 'emergency_escalation',
      confidence: 0.98,
      entities: { priority: 'CRITICAL', workflowState: 'AWAITING_CALLBACK_NUMBER' },
      toolTriggered: 'awaiting_callback_number',
      suggestedActions: ['My number is...'],
    };
  }

  if (wf.state === 'ESCALATION_INITIATED' || wf.state === 'ESCALATION_PENDING') {
    return {
      reply: `Your emergency request has already been submitted and is being handled with the highest priority. A representative from ${tenant.brandName} will contact you as soon as possible. Is there anything else I need to know about the situation?`,
      intent: 'emergency_escalation',
      confidence: 0.99,
      entities: { priority: 'CRITICAL', workflowState: wf.state },
      toolTriggered: 'escalation_status_update',
      suggestedActions: ['What is the status?', 'I have additional information'],
    };
  }

  return null;
}

async function executeEscalation(session, tenant, agent, phone, reason) {
  // Execute the callback tool
  const toolResult = await executeTool('schedule_callback', {
    phoneNumber: phone,
    tenantId: tenant.id,
    agentId: agent.id,
    priority: 'emergency',
    reason: reason,
    customerName: session.collectedInfo.customerName || 'Customer',
  }, { session, tenant, agent });

  // Also try to transfer to human
  const transferResult = await executeTool('transfer_to_human', {
    tenantId: tenant.id,
    agentId: agent.id,
    priority: 'emergency',
    reason: reason,
    customerName: session.collectedInfo.customerName || 'Customer',
  }, { session, tenant, agent });

  // Also send notification
  await executeTool('send_notification', {
    tenantId: tenant.id,
    type: 'EMERGENCY',
    message: `Emergency escalation from customer. Phone: ${phone}. Reason: ${reason}`,
    priority: 'critical',
  }, { session, tenant, agent });

  if (toolResult.status === TOOL_STATUS.PENDING || toolResult.status === TOOL_STATUS.SUCCESS) {
    stateManager.updateWorkflowState(session, 'ESCALATION_INITIATED', {
      callbackRequestId: toolResult.data?.requestId,
      phone,
    });

    return {
      reply: `Thank you. Your urgent callback request has been submitted to ${tenant.brandName}'s team. ${toolResult.data?.requestId ? `Reference: ${toolResult.data.requestId}. ` : ''}A representative will contact you at ${phone} as soon as possible. Please keep your phone available.`,
      intent: 'emergency_escalation',
      confidence: 0.99,
      entities: { priority: 'CRITICAL', callbackNumber: phone, workflowState: 'ESCALATION_INITIATED' },
      toolTriggered: 'schedule_callback',
      suggestedActions: ['What is my reference number?', 'How long will it take?'],
    };
  }

  // If tool failed
  stateManager.updateWorkflowState(session, 'ESCALATION_FAILED', { error: toolResult.message });

  const contacts = kb.getContactInfo(tenant);
  let fallbackMsg = '';
  if (contacts.available && contacts.escalation) {
    fallbackMsg = ` You can also reach our team directly at ${contacts.escalation.phone || contacts.escalation.email || 'the contact details on our website'}.`;
  }

  return {
    reply: `I've attempted to arrange an urgent callback but encountered an issue. Your request has been logged and our team has been notified.${fallbackMsg} We apologize for the inconvenience.`,
    intent: 'emergency_escalation',
    confidence: 0.97,
    entities: { priority: 'CRITICAL', workflowState: 'ESCALATION_FAILED' },
    toolTriggered: 'escalation_fallback',
    suggestedActions: ['Try again', 'Give me direct contact details'],
  };
}

// ============================================================================
// URGENT ESCALATION / HUMAN HANDOFF (P1)
// ============================================================================

async function handleUrgentEscalation(session, intents, entities, tenant, agent, message) {
  const isHumanRequest = intents.some(i => i.intent === 'human_representative_request');
  const brandName = tenant.brandName;

  stateManager.setWorkflow(session, 'human_handoff', 'HANDOFF_REQUESTED', {
    reason: message,
  });

  // Check if we have contact info to proceed
  if (entities.phoneNumber || stateManager.hasInfo(session, 'phoneNumber')) {
    const phone = entities.phoneNumber || session.collectedInfo.phoneNumber;
    return await executeHandoff(session, tenant, agent, phone, message);
  }

  stateManager.updateWorkflowState(session, 'AWAITING_INFO');

  const contacts = kb.getContactInfo(tenant);
  let contactInfo = '';
  if (contacts.available && contacts.primary) {
    contactInfo = ` Our ${contacts.primary.role || 'team'} ${contacts.primary.name || ''} is available to assist you.`;
  }

  return {
    reply: `I understand you'd like to speak with someone from our team.${contactInfo} To connect you as quickly as possible, could you please share your phone number or preferred contact method?`,
    intent: isHumanRequest ? 'human_representative_request' : 'urgent_assistance',
    confidence: 0.97,
    entities: { priority: 'HIGH' },
    toolTriggered: 'human_handoff_initiated',
    suggestedActions: ['My number is...', 'I prefer email', 'Call me right now'],
  };
}

async function continueHandoffWorkflow(session, intents, entities, tenant, agent, message) {
  const wf = session.activeWorkflow;

  if (wf.state === 'AWAITING_INFO') {
    const phone = entities.phoneNumber || extractPhoneFromMessage(message);
    const email = entities.email;

    if (phone || email) {
      if (phone) stateManager.collectInfo(session, { phoneNumber: phone });
      if (email) stateManager.collectInfo(session, { email });
      return await executeHandoff(session, tenant, agent, phone || email, wf.data.reason || message);
    }

    return {
      reply: `To connect you with the right person, I'll need a phone number or email address. Could you please share that?`,
      intent: 'human_representative_request',
      confidence: 0.95,
      entities: { workflowState: 'AWAITING_INFO' },
      toolTriggered: 'awaiting_contact_info',
      suggestedActions: ['My number is...', 'My email is...'],
    };
  }

  if (wf.state === 'HANDOFF_INITIATED') {
    return {
      reply: `Your request to speak with a representative has already been submitted. Someone from ${tenant.brandName} will be in touch shortly. Is there anything specific you'd like me to note for them?`,
      intent: 'human_representative_request',
      confidence: 0.97,
      entities: { workflowState: 'HANDOFF_INITIATED' },
      toolTriggered: 'handoff_status',
      suggestedActions: ['Check status', 'Add a note'],
    };
  }

  return null;
}

async function executeHandoff(session, tenant, agent, contactInfo, reason) {
  const isPhone = /[\d\+]/.test(contactInfo);
  
  const toolResult = await executeTool('transfer_to_human', {
    tenantId: tenant.id,
    agentId: agent.id,
    reason,
    customerName: session.collectedInfo.customerName || 'Customer',
  }, { session, tenant, agent });

  if (isPhone) {
    await executeTool('schedule_callback', {
      phoneNumber: contactInfo,
      tenantId: tenant.id,
      agentId: agent.id,
      priority: 'high',
      reason,
      customerName: session.collectedInfo.customerName || 'Customer',
    }, { session, tenant, agent });
  }

  stateManager.updateWorkflowState(session, 'HANDOFF_INITIATED', { contactInfo });

  const contactMethod = isPhone ? `call you at ${contactInfo}` : `reach out to you at ${contactInfo}`;

  return {
    reply: `Thank you! I've submitted your request. A representative from ${tenant.brandName} will ${contactMethod} as soon as possible.${toolResult.data?.requestId ? ` Reference: ${toolResult.data.requestId}.` : ''} Is there anything else you'd like me to note for them?`,
    intent: 'human_representative_request',
    confidence: 0.98,
    entities: { contactInfo, workflowState: 'HANDOFF_INITIATED' },
    toolTriggered: 'transfer_to_human',
    suggestedActions: ['No, that is all', 'Yes, please note that...'],
  };
}

// ============================================================================
// COMPLAINTS & FEEDBACK (P2)
// ============================================================================

async function handleComplaintFeedback(session, intents, entities, tenant, agent, message) {
  const brandName = tenant.brandName;
  
  // Check for mixed sentiment
  const hasPositive = intents.some(i => i.intent === 'positive_feedback');
  const hasNegative = intents.some(i => i.intent === 'negative_feedback');
  const hasComplaint = intents.some(i => i.intent === 'customer_complaint');
  const hasRefund = intents.some(i => i.intent === 'refund_compensation');

  // Mixed sentiment: positive + negative
  if (hasPositive && (hasNegative || hasComplaint)) {
    return handleMixedFeedback(session, intents, entities, tenant, agent, message);
  }

  // Pure positive feedback
  if (hasPositive && !hasNegative && !hasComplaint) {
    return handlePositiveFeedback(session, tenant, agent, message);
  }

  // Specific complaint
  if (hasComplaint) {
    return startComplaintWorkflow(session, intents, entities, tenant, agent, message);
  }

  // Refund request
  if (hasRefund) {
    return handleRefundRequest(session, intents, entities, tenant, agent, message);
  }

  // General negative feedback
  if (hasNegative) {
    stateManager.setWorkflow(session, 'complaint_handling', 'COMPLAINT_DETECTED', {
      originalMessage: message,
    });
    
    return {
      reply: `I'm really sorry to hear that your experience hasn't met your expectations. We take customer feedback very seriously at ${brandName}, and I'd like to understand what went wrong so we can help resolve this. Could you tell me a little more about what happened?`,
      intent: 'negative_feedback',
      confidence: 0.96,
      entities: { sentiment: 'negative' },
      toolTriggered: 'complaint_workflow_started',
      suggestedActions: ['It was about my order', 'Customer service issue', 'I want to speak with a manager'],
    };
  }

  return null;
}

function handlePositiveFeedback(session, tenant, agent, message) {
  return {
    reply: `Thank you so much for the kind words! We're truly delighted to hear you had such a great experience with ${tenant.brandName}. Your feedback means a lot to our team and motivates us to keep delivering our best!`,
    intent: 'positive_feedback',
    confidence: 0.97,
    entities: { sentiment: 'positive' },
    toolTriggered: 'feedback_acknowledged',
    suggestedActions: ['Is there anything else I can help with?', 'I have another question'],
  };
}

function handleMixedFeedback(session, intents, entities, tenant, agent, message) {
  stateManager.setWorkflow(session, 'complaint_handling', 'GATHERING_DETAILS', {
    originalMessage: message,
    hasMixedSentiment: true,
  });

  return {
    reply: `Thank you for sharing your thoughts! We're glad to hear about the positive aspects of your experience with ${tenant.brandName}. At the same time, I'm sorry about the disappointing parts. We want to address that properly. Could you share a few more details about the issue so we can work on improving it?`,
    intent: 'mixed_feedback',
    confidence: 0.96,
    entities: { sentiment: 'mixed' },
    toolTriggered: 'mixed_feedback_handler',
    suggestedActions: ['More details about the issue', 'I want a resolution', 'Speak with someone'],
  };
}

async function startComplaintWorkflow(session, intents, entities, tenant, agent, message) {
  stateManager.setWorkflow(session, 'complaint_handling', 'GATHERING_DETAILS', {
    originalMessage: message,
    category: detectComplaintCategory(message),
  });

  const category = detectComplaintCategory(message);
  let followUp = 'Could you provide your order or reference number so I can look into this further?';
  
  if (category === 'staff_conduct') {
    followUp = 'Could you provide more details about what happened and when, so we can address this with our team?';
  } else if (category === 'billing') {
    followUp = 'Could you share the transaction reference or date of the charge so I can look into this?';
  } else if (category === 'no_response') {
    followUp = 'Could you tell me when you originally reached out and through which channel?';
  }

  return {
    reply: `I'm sorry to hear about this experience. This is not the standard we strive for at ${tenant.brandName}. I want to help resolve this for you. ${followUp}`,
    intent: 'customer_complaint',
    confidence: 0.97,
    entities: { sentiment: 'negative', complaintCategory: category },
    toolTriggered: 'complaint_workflow_started',
    suggestedActions: ['Here is my reference number', 'I want a refund', 'Connect me with a manager'],
  };
}

async function continueComplaintWorkflow(session, intents, entities, tenant, agent, message) {
  const wf = session.activeWorkflow;

  // Check if customer wants to escalate
  if (intents.some(i => i.intent === 'human_representative_request')) {
    stateManager.resolveWorkflow(session, 'escalated_to_human');
    return null; // Let the human handoff handler take over
  }

  if (wf.state === 'COMPLAINT_DETECTED' || wf.state === 'GATHERING_DETAILS') {
    // Collect any reference number or additional details
    if (entities.referenceNumber) {
      stateManager.collectInfo(session, { referenceNumber: entities.referenceNumber });
    }

    // Create support ticket
    const ticketResult = await executeTool('create_support_ticket', {
      tenantId: tenant.id,
      category: wf.data.category || 'general_complaint',
      description: `Original: ${wf.data.originalMessage || ''}\nFollow-up: ${message}`,
      priority: 'high',
      customerName: session.collectedInfo.customerName || 'Customer',
      phone: session.collectedInfo.phoneNumber || '',
      referenceNumber: session.collectedInfo.referenceNumber || entities.referenceNumber || '',
    }, { session, tenant, agent });

    stateManager.updateWorkflowState(session, 'COMPLAINT_RECORDED', {
      ticketId: ticketResult.data?.ticketId,
    });

    return {
      reply: `Thank you for providing those details. I've recorded your complaint${ticketResult.data?.ticketId ? ` (Reference: ${ticketResult.data.ticketId})` : ''} and it has been flagged for priority handling by our team at ${tenant.brandName}. We'll work to resolve this as quickly as possible. Would you like us to follow up with you, or is there anything else I can help with?`,
      intent: 'customer_complaint',
      confidence: 0.96,
      entities: { complaintRecorded: true, ticketId: ticketResult.data?.ticketId },
      toolTriggered: 'create_support_ticket',
      suggestedActions: ['Follow up with me', 'That is all for now', 'Speak with a manager'],
    };
  }

  if (wf.state === 'COMPLAINT_RECORDED') {
    return {
      reply: `Your complaint has been recorded and our team is reviewing it. ${wf.data.ticketId ? `Your reference is ${wf.data.ticketId}. ` : ''}Is there anything else I can assist you with?`,
      intent: 'customer_complaint',
      confidence: 0.95,
      entities: { workflowState: 'COMPLAINT_RECORDED' },
      toolTriggered: 'complaint_status',
      suggestedActions: ['Check status', 'I have another issue', 'No, thank you'],
    };
  }

  return null;
}

async function handleRefundRequest(session, intents, entities, tenant, agent, message) {
  stateManager.setWorkflow(session, 'complaint_handling', 'GATHERING_DETAILS', {
    originalMessage: message,
    category: 'refund_request',
  });

  return {
    reply: `I understand you'd like to request a refund. To process this, I'll need your order or reference number. Could you please share that?`,
    intent: 'refund_compensation',
    confidence: 0.96,
    entities: { complaintCategory: 'refund_request' },
    toolTriggered: 'refund_workflow_started',
    suggestedActions: ['My order number is...', 'I don\'t have the reference', 'Speak with billing'],
  };
}

// ============================================================================
// STANDARD INTENTS (P3-P6)
// ============================================================================

async function handleStandardIntents(session, intents, entities, tenant, agent, message) {
  const brandName = tenant.brandName;
  const prompt = agent.systemPrompt || '';
  const responses = [];
  let primaryIntent = intents[0]?.intent || 'unsupported_request';
  let allToolsTriggered = [];
  let allSuggestions = [];
  let allEntities = {};

  // Handle multi-intent — process each detected intent
  for (const intentData of intents) {
    const result = await processSingleIntent(intentData, session, entities, tenant, agent, message);
    if (result) {
      responses.push(result.reply);
      if (result.toolTriggered) allToolsTriggered.push(result.toolTriggered);
      if (result.suggestedActions) allSuggestions = result.suggestedActions;
      Object.assign(allEntities, result.entities || {});
    }
  }

  if (responses.length === 0) {
    // Fallback to knowledge base search
    return generateKnowledgeBasedResponse(session, tenant, agent, message);
  }

  // Combine multi-intent responses
  const combinedReply = responses.length > 1
    ? responses.join('\n\n')
    : responses[0];

  return {
    reply: combinedReply,
    intent: primaryIntent,
    confidence: intents[0]?.confidence || 0.85,
    entities: allEntities,
    toolTriggered: allToolsTriggered[0] || 'knowledge_base_rag',
    suggestedActions: allSuggestions.length > 0 ? allSuggestions : getDefaultSuggestions(tenant.industry),
  };
}

async function processSingleIntent(intentData, session, entities, tenant, agent, message) {
  const { intent } = intentData;
  const brandName = tenant.brandName;
  const prompt = agent.systemPrompt || '';

  switch (intent) {
    case 'greeting':
      return handleGreeting(session, tenant, agent, message);

    case 'location_inquiry':
      return await handleLocationInquiry(session, tenant, agent);

    case 'operating_hours_inquiry':
      return await handleHoursInquiry(session, tenant, agent);

    case 'contact_inquiry':
      return handleContactInquiry(session, tenant, agent);

    case 'directions_inquiry':
      return handleDirectionsInquiry(session, tenant, agent);

    case 'pricing_inquiry':
      return handlePricingInquiry(session, tenant, agent, message);

    case 'appointment_scheduling':
      return await startAppointmentWorkflow(session, entities, tenant, agent, message);

    case 'product_service_inquiry':
      return handleProductServiceInquiry(session, tenant, agent, message);

    case 'order_placement':
      return handleOrderPlacement(session, entities, tenant, agent, message);

    case 'order_cancellation':
      return handleOrderCancellation(session, entities, tenant, agent, message);

    case 'order_modification':
      return handleOrderModification(session, entities, tenant, agent, message);

    case 'delivery_availability_inquiry':
      return handleDeliveryInquiry(session, tenant, agent, message);

    case 'follow_up_request':
      return handleFollowUp(session, tenant, agent, message);

    case 'sales_lead_qualification':
      return handleSalesInquiry(session, entities, tenant, agent, message);

    case 'faq':
      return handleFAQ(session, tenant, agent, message);

    case 'general_business_inquiry':
      return handleBusinessInquiry(session, tenant, agent, message);

    case 'positive_feedback':
      return handlePositiveFeedback(session, tenant, agent, message);

    case 'callback_number_provided':
    case 'customer_info_provided':
    case 'appointment_info_provided':
      // These are handled by active workflow
      return null;

    case 'contextual_response':
      return generateKnowledgeBasedResponse(session, tenant, agent, message);

    default:
      return null;
  }
}

// ============================================================================
// INDIVIDUAL INTENT HANDLERS
// ============================================================================

function handleGreeting(session, tenant, agent, message) {
  // Don't repeat the full greeting if we're deep in conversation
  if (session.messageCount > 2) {
    return {
      reply: `How can I help you?`,
      intent: 'greeting',
    };
  }

  const agentFirstName = (agent.name || '').split(/[-–]/)[0].trim();
  
  return {
    reply: `Hello! Welcome to ${tenant.brandName}. I'm ${agentFirstName}, and I'm here to help. What can I assist you with today?`,
    intent: 'greeting',
    suggestedActions: getDefaultSuggestions(tenant.industry),
  };
}

async function handleLocationInquiry(session, tenant, agent) {
  // Use structured business profile first
  const locationData = kb.getBusinessLocation(tenant);
  
  if (locationData.available) {
    const addresses = locationData.addresses.map(a => {
      const label = a.label ? `**${a.label}**: ` : '';
      return `${label}${a.formatted}${a.phone ? ` (Phone: ${a.phone})` : ''}`;
    });

    let reply = '';
    if (addresses.length === 1) {
      reply = `${tenant.brandName} is located at ${addresses[0]}.`;
    } else if (addresses.length > 1) {
      reply = `${tenant.brandName} has the following locations:\n${addresses.map((a, i) => `${i + 1}. ${a}`).join('\n')}`;
    }

    if (locationData.serviceAreas.length > 0) {
      reply += ` We serve the following areas: ${locationData.serviceAreas.join(', ')}.`;
    }

    reply += ' Would you like directions or want to schedule a visit?';

    return {
      reply,
      intent: 'location_inquiry',
      toolTriggered: 'retrieve_business_location',
      entities: { locationProvided: true },
      suggestedActions: ['Get directions', 'Book a visit', 'What are your hours?'],
    };
  }

  // If business profile exists but address isn't configured, use the reason
  // Don't fall back to system prompt — that could surface unverified data
  if (locationData.reason) {
    return {
      reply: `I apologize, but I don't currently have the verified address for ${tenant.brandName}. ${locationData.reason} For accurate location details, please visit our website at ${tenant.domain || 'our website'} or contact us directly.`,
      intent: 'location_inquiry',
      toolTriggered: 'retrieve_business_location',
      entities: { locationAvailable: false },
      suggestedActions: ['Contact us', 'What are your hours?'],
    };
  }

  return {
    reply: `I apologize, but I don't currently have the verified address for ${tenant.brandName} in my records. For accurate location details, please visit our website at ${tenant.domain || 'our website'} or contact us directly.`,
    intent: 'location_inquiry',
    toolTriggered: 'retrieve_business_location',
    entities: { locationAvailable: false },
    suggestedActions: ['Contact us', 'What are your hours?'],
  };
}

async function handleHoursInquiry(session, tenant, agent) {
  const hoursData = kb.getBusinessHours(tenant);

  if (hoursData.available) {
    let reply = `Here are ${tenant.brandName}'s operating hours: ${hoursData.formatted}.`;
    if (hoursData.timezone) {
      reply += ` (${hoursData.timezone} timezone)`;
    }
    if (hoursData.holidays && hoursData.holidays.length > 0) {
      reply += ` Please note we may have modified hours on: ${hoursData.holidays.join(', ')}.`;
    }
    reply += ' Would you like to schedule an appointment?';

    return {
      reply,
      intent: 'operating_hours_inquiry',
      toolTriggered: 'retrieve_business_hours',
      entities: { hoursProvided: true },
      suggestedActions: ['Book an appointment', 'What is your address?', 'Ask about pricing'],
    };
  }

  // Fall back to system prompt
  const promptHints = kb.queryKnowledgeBase(agent.systemPrompt, ['open', 'close', 'hour', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun', 'am', 'pm', '24/7', 'available']);
  if (promptHints.length > 0) {
    return {
      reply: `Based on our records: ${promptHints.join(' ')} For the most current schedule, please check our website.`,
      intent: 'operating_hours_inquiry',
      toolTriggered: 'knowledge_base_rag',
      suggestedActions: ['Book an appointment', 'Where are you located?'],
    };
  }

  return {
    reply: `I'm sorry, I don't currently have the confirmed operating hours for ${tenant.brandName} in my records. I'd recommend checking our website at ${tenant.domain || 'our website'} for the most up-to-date schedule.`,
    intent: 'operating_hours_inquiry',
    entities: { hoursAvailable: false },
    suggestedActions: ['Where are you located?', 'Contact us'],
  };
}

function handleContactInquiry(session, tenant, agent) {
  const contacts = kb.getContactInfo(tenant);

  if (contacts.available) {
    const parts = [];
    if (contacts.primary) {
      const p = contacts.primary;
      parts.push(`${p.role || 'Main Contact'}: ${p.name || ''}${p.phone ? ` — ${p.phone}` : ''}${p.email ? ` — ${p.email}` : ''}`);
    }
    if (contacts.departments && contacts.departments.length > 0) {
      for (const dept of contacts.departments) {
        parts.push(`${dept.name}: ${dept.phone || dept.email || 'Available on request'}`);
      }
    }

    return {
      reply: `Here's how you can reach ${tenant.brandName}:\n${parts.join('\n')}\n\nWould you like me to connect you with someone directly?`,
      intent: 'contact_inquiry',
      entities: { contactProvided: true },
      suggestedActions: ['Connect me with someone', 'Book an appointment'],
    };
  }

  return {
    reply: `For the most up-to-date contact information for ${tenant.brandName}, please visit ${tenant.domain || 'our website'}. Would you like me to have someone reach out to you instead?`,
    intent: 'contact_inquiry',
    entities: { contactAvailable: false },
    suggestedActions: ['Have someone call me', 'Visit website'],
  };
}

function handleDirectionsInquiry(session, tenant, agent) {
  const location = kb.getBusinessLocation(tenant);

  if (location.available && location.addresses.length > 0) {
    const addr = location.addresses[0];
    return {
      reply: `${tenant.brandName} is located at ${addr.formatted}. For navigation directions, I'd recommend using your preferred maps application with this address. Unfortunately, I cannot generate a direct maps link. Is there anything else I can help with?`,
      intent: 'directions_inquiry',
      entities: { locationProvided: true },
      suggestedActions: ['What are your hours?', 'Book an appointment'],
    };
  }

  return {
    reply: `I don't currently have the verified address to provide directions to ${tenant.brandName}. Please check our website at ${tenant.domain || 'our website'} for location details and directions.`,
    intent: 'directions_inquiry',
    entities: { directionsAvailable: false },
    suggestedActions: ['Where are you located?', 'Contact us'],
  };
}

function handlePricingInquiry(session, tenant, agent, message) {
  const pricing = kb.extractPricingFromPrompt(agent.systemPrompt);
  
  if (pricing.available && pricing.pricingSentences.length > 0) {
    return {
      reply: `Here are our pricing details at ${tenant.brandName}: ${pricing.pricingSentences.join(' ')} Would you like to discuss specific options or get a personalized quote?`,
      intent: 'pricing_inquiry',
      toolTriggered: 'pricing_lookup',
      suggestedActions: ['Get a custom quote', 'Book a consultation', 'What payment methods do you accept?'],
    };
  }

  // Try general knowledge base
  const kbResults = kb.queryKnowledgeBase(agent.systemPrompt, ['price', 'cost', 'fee', '$', 'rate', 'charge', 'package', 'plan', 'tier']);
  if (kbResults.length > 0) {
    return {
      reply: `Here's what I can share about pricing at ${tenant.brandName}: ${kbResults.join(' ')} For a detailed or custom quote, I'd be happy to connect you with our team.`,
      intent: 'pricing_inquiry',
      toolTriggered: 'knowledge_base_rag',
      suggestedActions: ['Get a custom quote', 'Book a consultation'],
    };
  }

  return {
    reply: `I'd be happy to help with pricing information. Our offerings at ${tenant.brandName} are tailored to individual needs. Could you tell me which specific service or product you're interested in, so I can provide the most accurate pricing?`,
    intent: 'pricing_inquiry',
    suggestedActions: ['What services do you offer?', 'Get a custom quote', 'Speak with someone'],
  };
}

async function startAppointmentWorkflow(session, entities, tenant, agent, message) {
  stateManager.setWorkflow(session, 'appointment_scheduling', 'AWAITING_DATE', {
    requestedService: null,
  });

  // Check if date/time was already mentioned
  if (entities.dateReference && entities.timeReference) {
    stateManager.updateWorkflowState(session, 'AWAITING_NAME', {
      date: entities.dateReference,
      time: entities.timeReference,
    });
    session.appointmentData = { date: entities.dateReference, time: entities.timeReference };

    return {
      reply: `I'd be happy to schedule that for ${entities.dateReference} at ${entities.timeReference} with ${tenant.brandName}. Could you please share your full name to complete the booking?`,
      intent: 'appointment_scheduling',
      toolTriggered: 'appointment_workflow_started',
      entities: { date: entities.dateReference, time: entities.timeReference },
      suggestedActions: ['My name is...'],
    };
  }

  if (entities.dateReference) {
    stateManager.updateWorkflowState(session, 'AWAITING_TIME', {
      date: entities.dateReference,
    });
    session.appointmentData = { date: entities.dateReference };

    return {
      reply: `${entities.dateReference.charAt(0).toUpperCase() + entities.dateReference.slice(1)} works well! What time would you prefer for your appointment with ${tenant.brandName}?`,
      intent: 'appointment_scheduling',
      toolTriggered: 'appointment_workflow_started',
      entities: { date: entities.dateReference },
      suggestedActions: ['Morning (10 AM)', 'Afternoon (2 PM)', 'Evening (5 PM)'],
    };
  }

  return {
    reply: `I'd love to help you schedule an appointment with ${tenant.brandName}! What day works best for you?`,
    intent: 'appointment_scheduling',
    toolTriggered: 'appointment_workflow_started',
    suggestedActions: ['Tomorrow', 'This week', 'Next Monday'],
  };
}

async function continueAppointmentWorkflow(session, intents, entities, tenant, agent, message) {
  const wf = session.activeWorkflow;
  const aptData = session.appointmentData || {};

  // Check for escalation/cancellation
  if (intents.some(i => i.intent === 'order_cancellation')) {
    stateManager.resolveWorkflow(session, 'cancelled_by_customer');
    session.appointmentData = null;
    return {
      reply: `No problem! The appointment booking has been cancelled. Is there anything else I can help you with?`,
      intent: 'order_cancellation',
      suggestedActions: getDefaultSuggestions(tenant.industry),
    };
  }

  if (wf.state === 'AWAITING_DATE') {
    const extractedData = intents[0]?.extractedData || {};
    const date = extractedData.date || entities.dateReference || message.trim();
    aptData.date = date;
    session.appointmentData = aptData;
    
    if (extractedData.time || entities.timeReference) {
      aptData.time = extractedData.time || entities.timeReference;
      stateManager.updateWorkflowState(session, 'AWAITING_NAME', { date: aptData.date, time: aptData.time });
      return {
        reply: `${aptData.date} at ${aptData.time} — that works! Could you please share your full name so I can finalize the booking?`,
        intent: 'appointment_scheduling',
        entities: { date: aptData.date, time: aptData.time },
        suggestedActions: ['My name is...'],
      };
    }

    stateManager.updateWorkflowState(session, 'AWAITING_TIME', { date: aptData.date });
    return {
      reply: `${date.charAt(0).toUpperCase() + date.slice(1)} works! What time would you prefer?`,
      intent: 'appointment_scheduling',
      entities: { date: aptData.date },
      suggestedActions: ['10:00 AM', '2:00 PM', '5:00 PM'],
    };
  }

  if (wf.state === 'AWAITING_TIME') {
    const extractedData = intents[0]?.extractedData || {};
    const time = extractedData.time || entities.timeReference || message.trim();
    aptData.time = time;
    session.appointmentData = aptData;
    stateManager.updateWorkflowState(session, 'AWAITING_NAME', { time: aptData.time });

    if (stateManager.hasInfo(session, 'customerName')) {
      // We already have the name, proceed to book
      aptData.customerName = session.collectedInfo.customerName;
      return await finalizeAppointment(session, aptData, tenant, agent);
    }

    return {
      reply: `${aptData.date} at ${aptData.time} — perfect! Could you please share your full name to complete the booking?`,
      intent: 'appointment_scheduling',
      entities: { date: aptData.date, time: aptData.time },
      suggestedActions: ['My name is...'],
    };
  }

  if (wf.state === 'AWAITING_NAME') {
    const extractedData = intents[0]?.extractedData || {};
    const name = extractedData.customerName || entities.customerName || message.trim();
    aptData.customerName = name;
    stateManager.collectInfo(session, { customerName: name });
    session.appointmentData = aptData;

    return await finalizeAppointment(session, aptData, tenant, agent);
  }

  return null;
}

async function finalizeAppointment(session, aptData, tenant, agent) {
  const toolResult = await executeTool('book_appointment', {
    tenantId: tenant.id,
    agentId: agent.id,
    customerName: aptData.customerName,
    date: aptData.date || 'To be confirmed',
    time: aptData.time || 'To be confirmed',
    phone: session.collectedInfo.phoneNumber || '',
    email: session.collectedInfo.email || '',
  }, { session, tenant, agent });

  stateManager.updateWorkflowState(session, 'BOOKING_SUBMITTED', {
    bookingId: toolResult.data?.bookingId,
  });

  // Also create a CRM lead
  await executeTool('create_crm_lead', {
    tenantId: tenant.id,
    customerName: aptData.customerName,
    phone: session.collectedInfo.phoneNumber || '',
    email: session.collectedInfo.email || '',
    source: 'appointment_booking',
    notes: `Appointment: ${aptData.date || 'TBD'} at ${aptData.time || 'TBD'}`,
  }, { session, tenant, agent });

  stateManager.resolveWorkflow(session, 'appointment_booked');

  return {
    // No calendar is connected, so the tool only records a request. Never say "booked".
    reply: `Thanks, ${aptData.customerName}. I've sent your appointment request to the ${tenant.brandName} team — it isn't confirmed yet.\n\n📅 **Requested date:** ${aptData.date || 'To be confirmed'}\n⏰ **Requested time:** ${aptData.time || 'To be confirmed'}\n${toolResult.data?.bookingId ? `📋 **Request reference:** ${toolResult.data.bookingId}\n` : ''}\nThe team will contact you to confirm the time. Is there anything else I can help with?`,
    intent: 'appointment_scheduling',
    toolTriggered: 'book_appointment',
    entities: { appointmentRequested: true, appointmentConfirmed: false, bookingId: toolResult.data?.bookingId },
    suggestedActions: ['What should I bring?', 'Where is your office?', 'That is all, thank you'],
  };
}

function handleProductServiceInquiry(session, tenant, agent, message) {
  const kbResults = kb.queryKnowledgeBase(agent.systemPrompt, []);
  
  if (kbResults.length > 0) {
    const relevant = kbResults.slice(0, 3).join(' ');
    return {
      reply: `Here's what ${tenant.brandName} offers: ${relevant} Would you like more details on any of these, or shall I help you get started?`,
      intent: 'product_service_inquiry',
      toolTriggered: 'knowledge_base_rag',
      suggestedActions: ['Tell me more', 'What are the prices?', 'Book an appointment'],
    };
  }

  return {
    reply: `I'd be happy to tell you about what ${tenant.brandName} offers! Could you let me know which specific service or product you're interested in? That way I can provide the most relevant details.`,
    intent: 'product_service_inquiry',
    suggestedActions: ['What are your services?', 'Pricing information', 'Book a consultation'],
  };
}

function handleOrderPlacement(session, entities, tenant, agent, message) {
  return {
    reply: `I'd be happy to help you place an order with ${tenant.brandName}! Could you tell me what you'd like to order?`,
    intent: 'order_placement',
    suggestedActions: ['View menu/products', 'I want to order...', 'What are your prices?'],
  };
}

function handleOrderCancellation(session, entities, tenant, agent, message) {
  return {
    reply: `I can help you with that cancellation. Could you please provide your order or reference number so I can look it up?`,
    intent: 'order_cancellation',
    suggestedActions: ['My order number is...', 'I don\'t have the number', 'Speak with someone'],
  };
}

function handleOrderModification(session, entities, tenant, agent, message) {
  return {
    reply: `I can help modify your order. Could you please share your order or reference number, and let me know what changes you'd like to make?`,
    intent: 'order_modification',
    suggestedActions: ['My order number is...', 'Change delivery address', 'Update items'],
  };
}

function handleDeliveryInquiry(session, tenant, agent, message) {
  const kbResults = kb.queryKnowledgeBase(agent.systemPrompt, ['delivery', 'deliver', 'shipping', 'ship', 'pickup', 'pick up', 'available', 'stock']);
  
  if (kbResults.length > 0) {
    return {
      reply: `${kbResults.join(' ')} Is there anything specific about delivery you'd like to know?`,
      intent: 'delivery_availability_inquiry',
      toolTriggered: 'knowledge_base_rag',
      suggestedActions: ['Check item availability', 'Delivery fees', 'Place an order'],
    };
  }

  return {
    reply: `For delivery and availability information at ${tenant.brandName}, could you tell me which specific item or service you're asking about?`,
    intent: 'delivery_availability_inquiry',
    suggestedActions: ['View products', 'Check availability', 'Place an order'],
  };
}

function handleFollowUp(session, tenant, agent, message) {
  return {
    reply: `I'd be happy to help with your follow-up. Could you provide your reference number or describe what you're following up on so I can check the status?`,
    intent: 'follow_up_request',
    suggestedActions: ['My reference is...', 'I had an appointment', 'I placed an order'],
  };
}

function handleSalesInquiry(session, entities, tenant, agent, message) {
  const kbResults = kb.queryKnowledgeBase(agent.systemPrompt, []);
  const summary = kbResults.slice(0, 2).join(' ');

  // Create CRM lead
  executeTool('create_crm_lead', {
    tenantId: tenant.id,
    customerName: session.collectedInfo.customerName || 'Prospect',
    phone: session.collectedInfo.phoneNumber || '',
    email: session.collectedInfo.email || '',
    source: 'chat_inquiry',
    interests: message,
  }, { session, tenant, agent }).catch(() => {});

  return {
    reply: `Great to hear you're interested! ${summary ? summary + ' ' : ''}I'd love to help you find the right option at ${tenant.brandName}. Could you tell me more about what you're looking for?`,
    intent: 'sales_lead_qualification',
    toolTriggered: 'create_crm_lead',
    suggestedActions: ['Tell me about your services', 'What are your prices?', 'Schedule a consultation'],
  };
}

function handleFAQ(session, tenant, agent, message) {
  const kbResults = kb.queryKnowledgeBase(agent.systemPrompt, message.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  
  if (kbResults.length > 0) {
    return {
      reply: `${kbResults.join(' ')} Is there anything else you'd like to know?`,
      intent: 'faq',
      toolTriggered: 'knowledge_base_rag',
      suggestedActions: ['Another question', 'Book an appointment', 'That helps, thanks!'],
    };
  }

  return {
    reply: `That's a great question! I'll do my best to help. Could you provide a bit more detail so I can give you the most accurate answer?`,
    intent: 'faq',
    suggestedActions: ['Ask another way', 'Speak with someone'],
  };
}

function handleBusinessInquiry(session, tenant, agent, message) {
  const kbResults = kb.queryKnowledgeBase(agent.systemPrompt, []);
  const summary = kbResults.slice(0, 3).join(' ');

  return {
    reply: summary 
      ? `${tenant.brandName} — ${summary} How can I help you get started?`
      : `${tenant.brandName} is here to help! What specific information are you looking for?`,
    intent: 'general_business_inquiry',
    toolTriggered: 'knowledge_base_rag',
    suggestedActions: ['Services offered', 'Pricing', 'Location & hours', 'Book appointment'],
  };
}

// ============================================================================
// FALLBACK & UTILITIES
// ============================================================================

function generateKnowledgeBasedResponse(session, tenant, agent, message) {
  const prompt = agent.systemPrompt || '';
  const words = message.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !['what', 'have', 'that', 'this', 'with', 'from', 'your', 'about', 'tell', 'more', 'does', 'please', 'could', 'would'].includes(w));
  
  const matched = kb.queryKnowledgeBase(prompt, words);

  if (matched.length > 0) {
    return {
      reply: `Based on ${tenant.brandName}'s information: ${matched.slice(0, 2).join(' ')} Is there anything else I can help with?`,
      intent: 'knowledge_matched_response',
      toolTriggered: 'knowledge_base_rag',
      suggestedActions: getDefaultSuggestions(tenant.industry),
    };
  }

  const agentFirstName = (agent.name || '').split(/[-–]/)[0].trim();
  return {
    reply: `Thank you for reaching out to ${tenant.brandName}! I want to make sure I help you correctly. Could you rephrase or let me know specifically what you're looking for? I can help with appointments, pricing, location details, and much more.`,
    intent: 'unsupported_request',
    confidence: 0.4,
    suggestedActions: getDefaultSuggestions(tenant.industry),
  };
}

function detectComplaintCategory(message) {
  const msg = message.toLowerCase();
  if (/late|delay|slow|wait|didn'?t arrive|not received|hasn'?t arrived/i.test(msg)) return 'late_delivery';
  if (/damaged|broken|defective|crack|tear|dent|scratch/i.test(msg)) return 'damaged_product';
  if (/wrong|incorrect|different|not what i ordered/i.test(msg)) return 'wrong_item';
  if (/charged twice|double charge|overcharged|billing|payment/i.test(msg)) return 'billing';
  if (/rude|unprofessional|disrespectful|behavior|attitude/i.test(msg)) return 'staff_conduct';
  if (/no response|no reply|didn'?t call|didn'?t respond|ignored/i.test(msg)) return 'no_response';
  if (/missing|not included|forgot|incomplete/i.test(msg)) return 'missing_item';
  return 'general_complaint';
}

function extractPhoneFromMessage(message) {
  const match = message.match(/[\+]?[\d\s\-\(\)]{7,15}/);
  return match ? match[0].replace(/[\s\-\(\)]/g, '') : null;
}

function getDefaultSuggestions(industry) {
  const ind = (industry || '').toLowerCase();
  
  if (/restaurant|food|pizza|diner|cafe|bakery/i.test(ind)) {
    return ['View the menu', 'Place an order', 'Delivery options'];
  }
  if (/real estate|property|realty/i.test(ind)) {
    return ['View properties', 'Schedule a viewing', 'Talk to an agent'];
  }
  if (/health|medical|dental|clinic|hospital|doctor/i.test(ind)) {
    return ['Book an appointment', 'Ask about services', 'Location & hours'];
  }
  if (/law|legal|attorney|lawyer/i.test(ind)) {
    return ['Schedule a consultation', 'Legal services', 'Office location'];
  }
  if (/ecommerce|e-commerce|retail|shop|store/i.test(ind)) {
    return ['Browse products', 'Track my order', 'Return policy'];
  }
  if (/home|hvac|solar|plumbing|repair|construction/i.test(ind)) {
    return ['Request a quote', 'Schedule service', 'Emergency repair'];
  }
  
  return ['Book an appointment', 'Ask about pricing', 'Location & hours'];
}

module.exports = { generateResponse };
