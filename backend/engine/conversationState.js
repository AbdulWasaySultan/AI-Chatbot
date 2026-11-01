/**
 * Conversation State Manager
 * 
 * Maintains per-session conversation state including active workflows,
 * collected customer information, and message history context.
 * Uses in-memory storage with session expiration.
 */

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

// In-memory session store: sessionId -> sessionState
const sessions = new Map();

/**
 * Generate a deterministic session ID from tenant + agent + optional session key
 */
function getSessionId(tenantId, agentId, sessionKey) {
  return `${tenantId}::${agentId}::${sessionKey || 'default'}`;
}

/**
 * Create a fresh session state
 */
function createSession(tenantId, agentId, sessionKey) {
  return {
    id: getSessionId(tenantId, agentId, sessionKey),
    tenantId,
    agentId,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    messageCount: 0,
    
    // Active workflow state machine
    activeWorkflow: null,
    // { type: 'emergency_escalation', state: 'AWAITING_CALLBACK_NUMBER', data: {...}, startedAt: timestamp }
    
    // All collected customer information across the conversation
    collectedInfo: {
      customerName: null,
      phoneNumber: null,
      email: null,
      referenceNumber: null,
      // Dynamic fields added during conversation
    },
    
    // Currently pending intents that haven't been fully resolved
    pendingIntents: [],
    
    // History of resolved intents for context
    resolvedIntents: [],
    
    // History of tool executions
    toolExecutions: [],
    
    // Simplified message history for context (last N messages)
    recentMessages: [],
    
    // Workflow-specific collected data
    appointmentData: null,
    orderData: null,
    complaintData: null,
    escalationData: null,
  };
}

/**
 * Get or create a session
 */
function getSession(tenantId, agentId, sessionKey) {
  const id = getSessionId(tenantId, agentId, sessionKey);
  let session = sessions.get(id);
  
  if (!session || (Date.now() - session.lastActivity > SESSION_TTL_MS)) {
    session = createSession(tenantId, agentId, sessionKey);
    sessions.set(id, session);
  }
  
  session.lastActivity = Date.now();
  return session;
}

/**
 * Update session after processing a message
 */
function updateSession(session, updates) {
  Object.assign(session, updates);
  session.lastActivity = Date.now();
  sessions.set(session.id, session);
  return session;
}

/**
 * Add a message to session history (keep last 20)
 */
function addMessage(session, role, text, metadata = {}) {
  session.recentMessages.push({
    role,
    text,
    timestamp: Date.now(),
    ...metadata,
  });
  if (session.recentMessages.length > 20) {
    session.recentMessages = session.recentMessages.slice(-20);
  }
  session.messageCount++;
  session.lastActivity = Date.now();
}

/**
 * Set active workflow
 */
function setWorkflow(session, type, state, data = {}) {
  session.activeWorkflow = {
    type,
    state,
    data,
    startedAt: Date.now(),
    updatedAt: Date.now(),
  };
  return session;
}

/**
 * Update workflow state
 */
function updateWorkflowState(session, newState, additionalData = {}) {
  if (session.activeWorkflow) {
    session.activeWorkflow.state = newState;
    session.activeWorkflow.updatedAt = Date.now();
    Object.assign(session.activeWorkflow.data, additionalData);
  }
  return session;
}

/**
 * Clear active workflow (resolve it)
 */
function resolveWorkflow(session, resolution = 'completed') {
  if (session.activeWorkflow) {
    session.resolvedIntents.push({
      ...session.activeWorkflow,
      resolution,
      resolvedAt: Date.now(),
    });
    session.activeWorkflow = null;
  }
  return session;
}

/**
 * Record a tool execution
 */
function recordToolExecution(session, toolName, input, result) {
  session.toolExecutions.push({
    toolName,
    input,
    result,
    timestamp: Date.now(),
  });
  // Keep last 10
  if (session.toolExecutions.length > 10) {
    session.toolExecutions = session.toolExecutions.slice(-10);
  }
  return session;
}

/**
 * Collect customer info (merges into existing)
 */
function collectInfo(session, info) {
  for (const [key, value] of Object.entries(info)) {
    if (value !== null && value !== undefined && value !== '') {
      session.collectedInfo[key] = value;
    }
  }
  return session;
}

/**
 * Check if info has already been collected
 */
function hasInfo(session, key) {
  return session.collectedInfo[key] !== null && 
         session.collectedInfo[key] !== undefined &&
         session.collectedInfo[key] !== '';
}

/**
 * Get a summary of conversation context for response generation
 */
function getContextSummary(session) {
  return {
    messageCount: session.messageCount,
    hasActiveWorkflow: !!session.activeWorkflow,
    workflowType: session.activeWorkflow?.type || null,
    workflowState: session.activeWorkflow?.state || null,
    collectedInfo: { ...session.collectedInfo },
    pendingIntents: [...session.pendingIntents],
    lastToolExecution: session.toolExecutions[session.toolExecutions.length - 1] || null,
    isFirstMessage: session.messageCount <= 1,
    recentMessageCount: session.recentMessages.length,
  };
}

/**
 * Clean up expired sessions periodically
 */
function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.lastActivity > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}

// Run cleanup every 5 minutes
// unref() so this timer never keeps a process (tests, scripts) alive on its own.
setInterval(cleanupExpiredSessions, 5 * 60 * 1000).unref();

/**
 * Reset a session (for testing)
 */
function resetSession(tenantId, agentId, sessionKey) {
  const id = getSessionId(tenantId, agentId, sessionKey);
  sessions.delete(id);
}

/**
 * Get all active sessions (for debugging)
 */
function getActiveSessions() {
  return Array.from(sessions.entries()).map(([id, s]) => ({
    id,
    tenantId: s.tenantId,
    agentId: s.agentId,
    messageCount: s.messageCount,
    hasWorkflow: !!s.activeWorkflow,
    workflowType: s.activeWorkflow?.type,
    lastActivity: new Date(s.lastActivity).toISOString(),
  }));
}

module.exports = {
  getSession,
  updateSession,
  addMessage,
  setWorkflow,
  updateWorkflowState,
  resolveWorkflow,
  recordToolExecution,
  collectInfo,
  hasInfo,
  getContextSummary,
  resetSession,
  getActiveSessions,
};
