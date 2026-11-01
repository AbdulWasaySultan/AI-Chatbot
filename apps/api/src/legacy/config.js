/**
 * Centralized Configuration Module
 * 
 * Loads environment variables and provides typed configuration
 * for all AI providers, search, and platform settings.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '..', '..', '.env') });

const config = {
  // Server
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Google Gemini
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    searchModel: process.env.GEMINI_SEARCH_MODEL || 'gemini-2.0-flash',
    maxOutputTokens: 1024,
    temperature: 0.7,
    topP: 0.95,
    timeout: 30000,       // 30s timeout
    maxRetries: 2,
    retryDelayMs: 1000,
  },

  // Search defaults
  search: {
    cacheTtlMs: 5 * 60 * 1000,  // 5 minutes
    maxResultsPerQuery: 10,
    defaultMaxSearchesPerDay: 200,
  },

  // URL retrieval
  urlRetrieval: {
    timeout: 10000,       // 10s timeout per URL
    maxContentBytes: 100000,  // ~100KB max per page
    userAgent: 'FJ-Tech-AI-Agent/2.0 (Compatible; Research Bot)',
  },

  // Usage tracking
  usage: {
    trackTokens: true,
    trackSearches: true,
    logLevel: process.env.NODE_ENV === 'production' ? 'error' : 'debug',
  },
};

/**
 * Validate that essential config is present
 */
function validateConfig() {
  const warnings = [];
  if (!config.gemini.apiKey) {
    warnings.push('GEMINI_API_KEY is not set. AI features will use fallback responses.');
  }
  if (warnings.length > 0) {
    warnings.forEach(w => console.warn(`[CONFIG WARNING] ${w}`));
  }
  return warnings.length === 0;
}

module.exports = { config, validateConfig };
