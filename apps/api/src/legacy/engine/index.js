/**
 * AI Agent Engine — Main Entry Point
 * 
 * Orchestrates the complete AI agent pipeline:
 * Intent Detection → Priority Resolution → Workflow Management → 
 * Knowledge Retrieval → Tool Execution → Response Generation
 */

const { generateResponse } = require('./responseGenerator');
const { detectIntents, extractEntities } = require('./intentDetector');
const stateManager = require('./conversationState');
const kb = require('./knowledgeBase');
const { executeTool, getAvailableTools, TOOL_STATUS } = require('./toolExecutor');

/**
 * Process a user message through the full AI engine pipeline.
 * This is the single entry point that replaces the old generateIntelligentAgentResponse.
 * 
 * @param {Object} tenant - The tenant/client object (with businessProfile)
 * @param {Object} agent - The AI agent object
 * @param {string} userMessage - The user's raw message
 * @param {Array} callHistory - Message history from frontend
 * @param {string} sessionKey - Optional session key for multi-session support
 * @returns {Object} Complete response payload
 */
async function processMessage(tenant, agent, userMessage, callHistory, sessionKey) {
  try {
    // Ensure tenant has a business profile (bootstrap from legacy data)
    if (!tenant.businessProfile) {
      tenant.businessProfile = kb.buildDefaultProfile(tenant, agent);
    }

    const result = await generateResponse(tenant, agent, userMessage, callHistory, sessionKey);
    return result;
  } catch (error) {
    console.error('[ENGINE ERROR]', error);
    
    // Graceful fallback — never crash the conversation
    return {
      reply: `I apologize, but I encountered an issue processing your request. Could you please rephrase your question? If this continues, please contact ${tenant.brandName} directly.`,
      intent: 'system_error',
      confidence: 0.5,
      latencyMs: 100,
      entities: { brand: tenant.brandName, error: true },
      toolTriggered: 'none',
      suggestedActions: ['Try again', 'Contact us directly'],
      workflowState: null,
    };
  }
}

module.exports = {
  processMessage,
  // Re-export sub-modules for direct access
  detectIntents,
  extractEntities,
  stateManager,
  knowledgeBase: kb,
  executeTool,
  getAvailableTools,
  TOOL_STATUS,
};
