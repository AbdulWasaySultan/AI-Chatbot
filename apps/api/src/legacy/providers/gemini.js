/**
 * Google Gemini Provider Service
 * 
 * Centralized wrapper for all Gemini API interactions:
 * - Standard text generation
 * - Google Search grounding (live internet access)
 * - Tool/function calling
 * - Citation extraction from grounding metadata
 * - Token usage tracking
 * - Error handling with retry logic
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { config } = require('../config');

let genAI = null;

/**
 * Initialize the Gemini client (lazy singleton)
 */
function getClient() {
  if (!genAI && config.gemini.apiKey) {
    genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    console.log('[GEMINI] Client initialized with model:', config.gemini.model);
  }
  return genAI;
}

/**
 * Check if Gemini is available and configured
 */
function isAvailable() {
  return !!(config.gemini.apiKey && config.gemini.apiKey.length > 5);
}

/**
 * Standard text generation (no search, no tools)
 * Used for: AI Help button, prompt improvement, simple completions
 * 
 * @param {string} prompt - The full prompt to send
 * @param {Object} options - Override options
 * @returns {Object} { text, tokensUsed, latencyMs }
 */
async function generateText(prompt, options = {}) {
  const client = getClient();
  if (!client) throw new Error('Gemini API key not configured');

  const startTime = Date.now();
  const modelName = options.model || config.gemini.model;

  const model = client.getGenerativeModel({
    model: modelName,
    generationConfig: {
      maxOutputTokens: options.maxOutputTokens || config.gemini.maxOutputTokens,
      temperature: options.temperature ?? config.gemini.temperature,
      topP: options.topP ?? config.gemini.topP,
    },
  });

  const result = await retryWithBackoff(async () => {
    return await model.generateContent(prompt);
  });

  const response = result.response;
  const text = response.text();
  const usage = extractUsageMetrics(response);

  return {
    text,
    tokensUsed: usage,
    latencyMs: Date.now() - startTime,
    model: modelName,
    provider: 'gemini',
  };
}

/**
 * Generation with Google Search grounding enabled
 * The model can access live internet information and returns source citations.
 * 
 * @param {string} prompt - The full prompt including conversation context
 * @param {Object} options - Override options
 * @returns {Object} { text, citations, tokensUsed, searchUsed, latencyMs }
 */
async function generateWithSearch(prompt, options = {}) {
  const client = getClient();
  if (!client) throw new Error('Gemini API key not configured');

  const startTime = Date.now();
  const modelName = options.model || config.gemini.searchModel;

  const model = client.getGenerativeModel({
    model: modelName,
    tools: [{ googleSearch: {} }],
    generationConfig: {
      maxOutputTokens: options.maxOutputTokens || config.gemini.maxOutputTokens,
      temperature: options.temperature ?? 0.5,
      topP: options.topP ?? config.gemini.topP,
    },
  });

  const result = await retryWithBackoff(async () => {
    return await model.generateContent(prompt);
  });

  const response = result.response;
  const text = response.text();
  const citations = extractCitations(response);
  const usage = extractUsageMetrics(response);

  return {
    text,
    citations,
    searchUsed: citations.length > 0,
    tokensUsed: usage,
    latencyMs: Date.now() - startTime,
    model: modelName,
    provider: 'gemini',
  };
}

/**
 * Multi-turn chat generation with optional search grounding
 * Maintains conversation context through chat history.
 * 
 * @param {Array} history - Array of { role: 'user'|'model', parts: [{ text }] }
 * @param {string} userMessage - Current user message
 * @param {Object} options - { enableSearch, systemInstruction, ... }
 * @returns {Object} { text, citations, tokensUsed, latencyMs }
 */
async function generateChat(history, userMessage, options = {}) {
  const client = getClient();
  if (!client) throw new Error('Gemini API key not configured');

  const startTime = Date.now();
  const modelName = options.model || config.gemini.model;

  const modelConfig = {
    model: modelName,
    generationConfig: {
      maxOutputTokens: options.maxOutputTokens || config.gemini.maxOutputTokens,
      temperature: options.temperature ?? config.gemini.temperature,
      topP: options.topP ?? config.gemini.topP,
    },
  };

  // Add system instruction if provided
  if (options.systemInstruction) {
    modelConfig.systemInstruction = options.systemInstruction;
  }

  // Enable Google Search grounding if requested
  if (options.enableSearch) {
    modelConfig.tools = [{ googleSearch: {} }];
  }

  const model = client.getGenerativeModel(modelConfig);

  const chat = model.startChat({
    history: history || [],
  });

  const result = await retryWithBackoff(async () => {
    return await chat.sendMessage(userMessage);
  });

  const response = result.response;
  const text = response.text();
  const citations = options.enableSearch ? extractCitations(response) : [];
  const usage = extractUsageMetrics(response);

  return {
    text,
    citations,
    searchUsed: citations.length > 0,
    tokensUsed: usage,
    latencyMs: Date.now() - startTime,
    model: modelName,
    provider: 'gemini',
  };
}

/**
 * Extract citations from Gemini's grounding metadata
 * Google Search grounding returns structured source data.
 * 
 * @param {Object} response - Gemini API response
 * @returns {Array} Array of { title, url, snippet }
 */
function extractCitations(response) {
  const citations = [];

  try {
    // Access grounding metadata from the response
    const candidate = response.candidates?.[0];
    if (!candidate) return citations;

    // Check groundingMetadata
    const groundingMeta = candidate.groundingMetadata;
    if (!groundingMeta) return citations;

    // Extract from groundingChunks (primary source of citations)
    if (groundingMeta.groundingChunks) {
      for (const chunk of groundingMeta.groundingChunks) {
        if (chunk.web) {
          citations.push({
            title: chunk.web.title || 'Web Source',
            url: chunk.web.uri || '',
            snippet: '',
          });
        }
      }
    }

    // Extract from webSearchQueries for debugging
    if (groundingMeta.webSearchQueries) {
      // Store for debugging/logging but don't add as citations
      citations._searchQueries = groundingMeta.webSearchQueries;
    }

    // Extract from groundingSupports for inline citation mapping
    if (groundingMeta.groundingSupports) {
      for (const support of groundingMeta.groundingSupports) {
        if (support.segment && support.groundingChunkIndices) {
          // Map text segments to their source chunks
          // This can be used for inline citations in the future
        }
      }
    }

    // Extract from searchEntryPoint for the search widget
    if (groundingMeta.searchEntryPoint?.renderedContent) {
      citations._searchWidget = groundingMeta.searchEntryPoint.renderedContent;
    }

  } catch (err) {
    console.warn('[GEMINI] Citation extraction warning:', err.message);
  }

  // Deduplicate by URL
  const seen = new Set();
  return citations.filter(c => {
    if (!c.url || seen.has(c.url)) return false;
    seen.add(c.url);
    return true;
  });
}

/**
 * Extract token usage metrics from response
 */
function extractUsageMetrics(response) {
  try {
    const usage = response.usageMetadata;
    if (usage) {
      return {
        inputTokens: usage.promptTokenCount || 0,
        outputTokens: usage.candidatesTokenCount || 0,
        totalTokens: usage.totalTokenCount || 0,
      };
    }
  } catch (err) {
    // Usage metrics may not always be available
  }
  return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
}

/**
 * Retry logic with exponential backoff
 * Handles 429 (rate limit), 503 (overloaded), and transient errors
 */
async function retryWithBackoff(fn, maxRetries = config.gemini.maxRetries) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const statusCode = err.status || err.httpStatusCode || 0;
      const isRetryable = [429, 500, 503].includes(statusCode) ||
        err.message?.includes('RESOURCE_EXHAUSTED') ||
        err.message?.includes('UNAVAILABLE') ||
        err.message?.includes('overloaded');

      if (!isRetryable || attempt === maxRetries) {
        throw categorizeError(err);
      }

      const delay = config.gemini.retryDelayMs * Math.pow(2, attempt);
      console.warn(`[GEMINI] Retry ${attempt + 1}/${maxRetries} after ${delay}ms: ${err.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

/**
 * Categorize errors into actionable types
 */
function categorizeError(err) {
  const msg = err.message || '';
  const status = err.status || err.httpStatusCode || 0;

  if (status === 400 || msg.includes('API_KEY_INVALID') || msg.includes('invalid')) {
    err.category = 'INVALID_API_KEY';
    err.userMessage = 'AI service configuration error. Please check the API key.';
  } else if (status === 429 || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
    err.category = 'QUOTA_EXHAUSTED';
    err.userMessage = 'AI service quota reached. Please try again later.';
  } else if (status === 503 || msg.includes('UNAVAILABLE') || msg.includes('overloaded')) {
    err.category = 'SERVICE_UNAVAILABLE';
    err.userMessage = 'AI service is temporarily unavailable. Please try again in a moment.';
  } else if (msg.includes('timeout') || msg.includes('DEADLINE_EXCEEDED')) {
    err.category = 'TIMEOUT';
    err.userMessage = 'AI request timed out. Please try a shorter question.';
  } else if (msg.includes('SAFETY') || msg.includes('blocked')) {
    err.category = 'SAFETY_BLOCKED';
    err.userMessage = 'The request was blocked by safety filters. Please rephrase your question.';
  } else {
    err.category = 'UNKNOWN';
    err.userMessage = 'An unexpected error occurred with the AI service.';
  }

  return err;
}

module.exports = {
  isAvailable,
  generateText,
  generateWithSearch,
  generateChat,
  extractCitations,
  extractUsageMetrics,
  categorizeError,
};
