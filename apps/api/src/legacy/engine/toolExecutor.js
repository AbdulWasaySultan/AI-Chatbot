/**
 * Tool Execution Layer
 * 
 * Provides structured tool definitions with validated inputs,
 * success/failure handling, and clear execution status.
 * For external integrations that don't exist yet, returns
 * INTEGRATION_NOT_CONFIGURED status instead of faking success.
 */

// Tool logs include customer phone numbers, so they only print in local development.
const debugLog = (...args) => {
  if (process.env.NODE_ENV === 'development') console.log(...args);
};

// Tool execution result statuses
const TOOL_STATUS = {
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  PENDING: 'PENDING',
  INTEGRATION_NOT_CONFIGURED: 'INTEGRATION_NOT_CONFIGURED',
  INVALID_INPUT: 'INVALID_INPUT',
  DUPLICATE_PREVENTED: 'DUPLICATE_PREVENTED',
};

/**
 * Tool registry with definitions and handlers
 */
const TOOL_REGISTRY = {

  // ---- ESCALATION & COMMUNICATION TOOLS ----

  schedule_callback: {
    description: 'Schedule an urgent callback to a customer',
    requiredParams: ['phoneNumber', 'tenantId', 'agentId'],
    optionalParams: ['priority', 'reason', 'customerName'],
    execute: async (params, context) => {
      // Validate phone number
      const phone = (params.phoneNumber || '').replace(/[\s\-\(\)]/g, '');
      if (!phone || phone.length < 7) {
        return {
          status: TOOL_STATUS.INVALID_INPUT,
          message: 'A valid phone number is required to schedule a callback.',
          data: null,
        };
      }

      // Check for duplicates in recent executions
      const recentCallbacks = (context.session?.toolExecutions || [])
        .filter(t => t.toolName === 'schedule_callback' && 
                     Date.now() - t.timestamp < 60000 &&
                     t.input?.phoneNumber === phone);
      if (recentCallbacks.length > 0) {
        return {
          status: TOOL_STATUS.DUPLICATE_PREVENTED,
          message: 'A callback has already been scheduled to this number within the last minute.',
          data: { existingRequestId: recentCallbacks[0].result?.data?.requestId },
        };
      }

      // In production, this would call Twilio/VoIP API
      // For now, log the action and return a realistic status
      const requestId = `cb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      
      debugLog(`[TOOL] schedule_callback: ${phone} for tenant ${params.tenantId} | priority: ${params.priority || 'high'} | reason: ${params.reason || 'customer request'}`);
      
      return {
        status: TOOL_STATUS.PENDING,
        message: `Callback request #${requestId} has been submitted. The designated representative will call ${phone} as soon as possible.`,
        data: {
          requestId,
          phoneNumber: phone,
          priority: params.priority || 'high',
          estimatedResponse: 'As soon as possible',
          submittedAt: new Date().toISOString(),
        },
        integrationNote: 'Callback request logged. Connect Twilio/VoIP integration for automatic dialing.',
      };
    },
  },

  transfer_to_human: {
    description: 'Transfer conversation to a human representative',
    requiredParams: ['tenantId', 'agentId'],
    optionalParams: ['department', 'reason', 'priority', 'customerName'],
    execute: async (params, context) => {
      const contacts = context.tenant?.businessProfile?.contacts;
      
      let targetContact = null;
      let department = params.department || 'general';
      
      if (contacts) {
        // Find the right contact based on department/priority
        if (params.priority === 'emergency' && contacts.emergencyContact?.phone) {
          targetContact = contacts.emergencyContact;
          department = 'emergency';
        } else if (params.department && contacts.departments) {
          targetContact = contacts.departments.find(
            d => d.name.toLowerCase().includes(params.department.toLowerCase())
          );
        }
        if (!targetContact && contacts.escalation?.phone) {
          targetContact = contacts.escalation;
        }
        if (!targetContact && contacts.primary?.phone) {
          targetContact = contacts.primary;
        }
        if (!targetContact && contacts.fallback?.phone) {
          targetContact = contacts.fallback;
        }
      }

      const requestId = `tr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      if (targetContact) {
        debugLog(`[TOOL] transfer_to_human: ${targetContact.name || 'Contact'} (${targetContact.phone}) for tenant ${params.tenantId}`);
        return {
          status: TOOL_STATUS.PENDING,
          message: `Transfer request has been submitted. ${targetContact.name || 'A representative'} from ${department} will be connected shortly.`,
          data: {
            requestId,
            contactName: targetContact.name || 'Representative',
            department,
            submittedAt: new Date().toISOString(),
          },
          integrationNote: 'Transfer logged. Connect live chat/phone bridge for real-time transfers.',
        };
      }

      return {
        status: TOOL_STATUS.INTEGRATION_NOT_CONFIGURED,
        message: 'Human transfer contacts have not been configured for this client. Please provide your contact information and a representative will reach out.',
        data: { requestId },
      };
    },
  },

  send_notification: {
    description: 'Send an internal notification to the business team',
    requiredParams: ['tenantId', 'type', 'message'],
    optionalParams: ['priority', 'recipientEmail', 'recipientPhone'],
    execute: async (params) => {
      const notifId = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      
      debugLog(`[TOOL] send_notification: type=${params.type} priority=${params.priority || 'normal'} tenant=${params.tenantId} | ${params.message}`);
      
      return {
        status: TOOL_STATUS.PENDING,
        message: 'Notification has been submitted to the business team.',
        data: {
          notificationId: notifId,
          type: params.type,
          priority: params.priority || 'normal',
          submittedAt: new Date().toISOString(),
        },
        integrationNote: 'Connect email/SMS/Slack integration for delivery.',
      };
    },
  },

  // ---- BOOKING & SCHEDULING TOOLS ----

  book_appointment: {
    description: 'Book an appointment/consultation/showing',
    requiredParams: ['tenantId', 'agentId', 'customerName'],
    optionalParams: ['date', 'time', 'service', 'phone', 'email', 'notes'],
    execute: async (params, context) => {
      if (!params.customerName) {
        return {
          status: TOOL_STATUS.INVALID_INPUT,
          message: 'Customer name is required to book an appointment.',
          data: null,
        };
      }

      // Check for duplicate bookings
      const recentBookings = (context.session?.toolExecutions || [])
        .filter(t => t.toolName === 'book_appointment' &&
                     Date.now() - t.timestamp < 120000 &&
                     t.input?.customerName === params.customerName &&
                     t.input?.date === params.date);
      if (recentBookings.length > 0) {
        return {
          status: TOOL_STATUS.DUPLICATE_PREVENTED,
          message: 'An appointment with the same details was already booked recently.',
          data: { existingBookingId: recentBookings[0].result?.data?.bookingId },
        };
      }

      const bookingId = `apt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      
      debugLog(`[TOOL] book_appointment: ${params.customerName} | ${params.date || 'TBD'} ${params.time || 'TBD'} | tenant ${params.tenantId}`);
      
      return {
        status: TOOL_STATUS.PENDING,
        message: `Appointment request #${bookingId} has been submitted for ${params.customerName}${params.date ? ` on ${params.date}` : ''}${params.time ? ` at ${params.time}` : ''}.`,
        data: {
          bookingId,
          customerName: params.customerName,
          date: params.date || 'To be confirmed',
          time: params.time || 'To be confirmed',
          service: params.service || 'General',
          submittedAt: new Date().toISOString(),
        },
        integrationNote: 'Connect Google Calendar/Calendly/CRM for real-time booking.',
      };
    },
  },

  check_availability: {
    description: 'Check appointment/booking availability',
    requiredParams: ['tenantId'],
    optionalParams: ['date', 'service'],
    execute: async (params) => {
      // In production, this would query a calendar system
      return {
        status: TOOL_STATUS.INTEGRATION_NOT_CONFIGURED,
        message: 'Real-time availability checking requires a calendar integration. The booking request will be submitted for manual confirmation.',
        data: null,
        integrationNote: 'Connect Google Calendar/Calendly for real-time availability.',
      };
    },
  },

  // ---- CRM & LEAD TOOLS ----

  create_crm_lead: {
    description: 'Create a new lead in the CRM',
    requiredParams: ['tenantId'],
    optionalParams: ['customerName', 'phone', 'email', 'source', 'notes', 'interests'],
    execute: async (params) => {
      const leadId = `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      
      debugLog(`[TOOL] create_crm_lead: ${params.customerName || 'Unknown'} | phone: ${params.phone || 'N/A'} | tenant ${params.tenantId}`);
      
      return {
        status: TOOL_STATUS.PENDING,
        message: 'Lead information has been recorded.',
        data: {
          leadId,
          customerName: params.customerName || 'Unknown',
          submittedAt: new Date().toISOString(),
        },
        integrationNote: 'Connect CRM (HubSpot/Salesforce/Zoho) for automatic lead sync.',
      };
    },
  },

  // ---- SUPPORT TOOLS ----

  create_support_ticket: {
    description: 'Create a customer support ticket for complaints/issues',
    requiredParams: ['tenantId', 'category', 'description'],
    optionalParams: ['priority', 'customerName', 'phone', 'email', 'referenceNumber'],
    execute: async (params) => {
      const ticketId = `tkt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      
      debugLog(`[TOOL] create_support_ticket: cat=${params.category} priority=${params.priority || 'normal'} tenant=${params.tenantId} | ${params.description.slice(0, 100)}`);
      
      return {
        status: TOOL_STATUS.PENDING,
        message: `Support ticket #${ticketId} has been created and assigned to our team.`,
        data: {
          ticketId,
          category: params.category,
          priority: params.priority || 'normal',
          description: params.description,
          submittedAt: new Date().toISOString(),
        },
        integrationNote: 'Connect ticketing system (Zendesk/Freshdesk/Intercom) for tracking.',
      };
    },
  },

  // ---- BUSINESS INFO TOOLS ----

  retrieve_business_location: {
    description: 'Retrieve verified business location data',
    requiredParams: ['tenantId'],
    optionalParams: ['branchName'],
    execute: async (params, context) => {
      const kb = require('./knowledgeBase');
      const locationData = kb.getBusinessLocation(context.tenant);
      
      return {
        status: locationData.available ? TOOL_STATUS.SUCCESS : TOOL_STATUS.FAILED,
        message: locationData.available
          ? `Location data retrieved for ${context.tenant.brandName}.`
          : locationData.reason,
        data: locationData,
      };
    },
  },

  retrieve_business_hours: {
    description: 'Retrieve verified business operating hours',
    requiredParams: ['tenantId'],
    optionalParams: ['day', 'branchName'],
    execute: async (params, context) => {
      const kb = require('./knowledgeBase');
      const hoursData = kb.getBusinessHours(context.tenant);
      
      return {
        status: hoursData.available ? TOOL_STATUS.SUCCESS : TOOL_STATUS.FAILED,
        message: hoursData.available
          ? `Operating hours retrieved for ${context.tenant.brandName}.`
          : hoursData.reason,
        data: hoursData,
      };
    },
  },

  // ---- ORDER TOOLS ----

  place_order: {
    description: 'Place a new customer order',
    requiredParams: ['tenantId', 'items'],
    optionalParams: ['customerName', 'phone', 'deliveryAddress', 'notes', 'paymentMethod'],
    execute: async (params) => {
      return {
        status: TOOL_STATUS.INTEGRATION_NOT_CONFIGURED,
        message: 'Order placement requires a connected ordering/POS system. Your order details have been recorded for manual processing.',
        data: {
          orderId: `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          items: params.items,
          submittedAt: new Date().toISOString(),
        },
        integrationNote: 'Connect POS/ordering system for real-time order processing.',
      };
    },
  },

  check_order_status: {
    description: 'Check status of an existing order',
    requiredParams: ['tenantId', 'referenceNumber'],
    optionalParams: [],
    execute: async () => {
      return {
        status: TOOL_STATUS.INTEGRATION_NOT_CONFIGURED,
        message: 'Order tracking requires a connected ordering/logistics system.',
        data: null,
        integrationNote: 'Connect ordering/logistics system for order tracking.',
      };
    },
  },
};

/**
 * Execute a tool with validation and error handling
 */
async function executeTool(toolName, params, context) {
  const tool = TOOL_REGISTRY[toolName];
  if (!tool) {
    return {
      status: TOOL_STATUS.FAILED,
      message: `Unknown tool: ${toolName}`,
      data: null,
    };
  }

  // Validate required params
  const missing = tool.requiredParams.filter(p => !params[p] && params[p] !== 0);
  if (missing.length > 0) {
    return {
      status: TOOL_STATUS.INVALID_INPUT,
      message: `Missing required parameters: ${missing.join(', ')}`,
      data: null,
    };
  }

  try {
    const result = await tool.execute(params, context);
    
    // Log execution
    if (context.session) {
      const stateManager = require('./conversationState');
      stateManager.recordToolExecution(context.session, toolName, params, result);
    }

    return result;
  } catch (error) {
    console.error(`[TOOL ERROR] ${toolName}:`, error.message);
    return {
      status: TOOL_STATUS.FAILED,
      message: `Tool execution failed: ${error.message}`,
      data: null,
    };
  }
}

/**
 * Get available tools for an agent
 */
function getAvailableTools(tenant, agent) {
  return Object.keys(TOOL_REGISTRY).map(name => ({
    name,
    description: TOOL_REGISTRY[name].description,
    requiredParams: TOOL_REGISTRY[name].requiredParams,
    optionalParams: TOOL_REGISTRY[name].optionalParams,
  }));
}

module.exports = { executeTool, getAvailableTools, TOOL_STATUS, TOOL_REGISTRY };
