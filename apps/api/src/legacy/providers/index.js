/**
 * AI Provider Abstraction Layer
 * 
 * Provider-agnostic interface so the platform can switch between
 * Gemini, OpenAI, or other providers without touching agent orchestration.
 * 
 * Current provider: Google Gemini
 * Extensible to: OpenAI, Anthropic, etc.
 */

const gemini = require('./gemini');
const { config } = require('../config');

// In-memory per-tenant usage tracking
const usageStore = {};

/**
 * Get the active provider for a tenant
 * @param {Object} tenantConfig - Tenant's AI configuration (optional)
 * @returns {Object} Provider module
 */
function getProvider(tenantConfig = {}) {
  const providerName = tenantConfig.provider || 'gemini';

  switch (providerName) {
    case 'gemini':
      return gemini;
    // Future providers:
    // case 'openai':
    //   return require('./openai');
    default:
      console.warn(`[PROVIDERS] Unknown provider "${providerName}", falling back to gemini`);
      return gemini;
  }
}

/**
 * Check if any AI provider is available
 */
function isAIAvailable(tenantConfig = {}) {
  const provider = getProvider(tenantConfig);
  return provider.isAvailable();
}

/**
 * Generate text using the tenant's configured provider
 * 
 * @param {string} prompt - The prompt to generate from
 * @param {Object} options - { tenantId, model, temperature, ... }
 * @returns {Object} { text, tokensUsed, latencyMs, provider }
 */
async function generate(prompt, options = {}) {
  const provider = getProvider(options.tenantConfig || {});
  const result = await provider.generateText(prompt, options);

  // Track usage
  if (options.tenantId) {
    trackUsage(options.tenantId, result.tokensUsed, 'text_generation');
  }

  return result;
}

/**
 * Generate with search grounding using the tenant's configured provider
 * 
 * @param {string} prompt - The prompt with context
 * @param {Object} options - { tenantId, model, ... }
 * @returns {Object} { text, citations, searchUsed, tokensUsed, latencyMs }
 */
async function generateWithSearch(prompt, options = {}) {
  const provider = getProvider(options.tenantConfig || {});

  // Check tenant search limits
  if (options.tenantId) {
    const usage = getUsage(options.tenantId);
    const maxSearches = options.tenantConfig?.maxSearchesPerDay || config.search.defaultMaxSearchesPerDay;
    if (usage.searchesToday >= maxSearches) {
      throw Object.assign(new Error('Daily search limit reached'), {
        category: 'QUOTA_EXHAUSTED',
        userMessage: 'Daily search limit reached. Answers will use existing knowledge only.',
      });
    }
  }

  const result = await provider.generateWithSearch(prompt, options);

  // Track usage
  if (options.tenantId) {
    trackUsage(options.tenantId, result.tokensUsed, 'search_generation');
    if (result.searchUsed) {
      incrementSearchCount(options.tenantId);
    }
  }

  return result;
}

/**
 * Multi-turn chat generation
 */
async function chat(history, userMessage, options = {}) {
  const provider = getProvider(options.tenantConfig || {});
  const result = await provider.generateChat(history, userMessage, options);

  if (options.tenantId) {
    trackUsage(options.tenantId, result.tokensUsed, options.enableSearch ? 'search_chat' : 'chat');
  }

  return result;
}

/**
 * Track token usage for a tenant
 */
function trackUsage(tenantId, tokensUsed, operation) {
  if (!usageStore[tenantId]) {
    usageStore[tenantId] = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalRequests: 0,
      searchesToday: 0,
      lastResetDate: new Date().toDateString(),
      operations: {},
    };
  }

  const store = usageStore[tenantId];

  // Reset daily counters if it's a new day
  if (store.lastResetDate !== new Date().toDateString()) {
    store.searchesToday = 0;
    store.lastResetDate = new Date().toDateString();
  }

  store.totalInputTokens += tokensUsed.inputTokens || 0;
  store.totalOutputTokens += tokensUsed.outputTokens || 0;
  store.totalRequests += 1;
  store.operations[operation] = (store.operations[operation] || 0) + 1;
}

/**
 * Increment daily search count for a tenant
 */
function incrementSearchCount(tenantId) {
  if (usageStore[tenantId]) {
    usageStore[tenantId].searchesToday += 1;
  }
}

/**
 * Get usage stats for a tenant
 */
function getUsage(tenantId) {
  if (!usageStore[tenantId]) {
    return { totalInputTokens: 0, totalOutputTokens: 0, totalRequests: 0, searchesToday: 0 };
  }
  const store = usageStore[tenantId];
  // Reset daily counters if new day
  if (store.lastResetDate !== new Date().toDateString()) {
    store.searchesToday = 0;
    store.lastResetDate = new Date().toDateString();
  }
  return { ...store };
}

/**
 * Get usage for all tenants (admin view)
 */
function getAllUsage() {
  return { ...usageStore };
}

module.exports = {
  getProvider,
  isAIAvailable,
  generate,
  generateWithSearch,
  chat,
  trackUsage,
  getUsage,
  getAllUsage,
};
