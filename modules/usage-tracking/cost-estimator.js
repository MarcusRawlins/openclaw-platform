const config = require('./config.json');

/**
 * Cost estimation for LLM API calls
 */

/**
 * Estimate cost for a completed LLM call
 * @param {object} params - Call parameters
 * @param {string} params.provider - Provider name (anthropic, openai, lmstudio, google)
 * @param {string} params.model - Model name
 * @param {number} params.inputTokens - Input token count
 * @param {number} params.outputTokens - Output token count
 * @param {number} params.cacheReadTokens - Cache read tokens (optional)
 * @param {number} params.cacheWriteTokens - Cache write tokens (optional)
 * @returns {object} { cost_usd, breakdown }
 */
function estimateCost(params) {
  const {
    provider,
    model,
    inputTokens = 0,
    outputTokens = 0,
    cacheReadTokens = 0,
    cacheWriteTokens = 0
  } = params;
  
  // Check if local model (zero cost)
  if (isLocalModel(provider, model)) {
    return {
      cost_usd: 0,
      breakdown: {
        input: 0,
        output: 0,
        cache_read: 0,
        cache_write: 0,
        electricity: 0
      },
      note: 'Local model - zero API cost'
    };
  }
  
  // Get pricing for model
  const pricing = getPricing(provider, model);
  if (!pricing) {
    console.warn(`No pricing data for ${provider}/${model}, assuming zero cost`);
    return {
      cost_usd: 0,
      breakdown: { input: 0, output: 0, cache_read: 0, cache_write: 0 },
      note: 'Unknown model - cost estimation unavailable'
    };
  }
  
  // Calculate costs
  const breakdown = {
    input: (inputTokens / 1000000) * (pricing.input_per_1m || 0),
    output: (outputTokens / 1000000) * (pricing.output_per_1m || 0),
    cache_read: (cacheReadTokens / 1000000) * (pricing.cache_read_per_1m || 0),
    cache_write: (cacheWriteTokens / 1000000) * (pricing.cache_write_per_1m || 0)
  };
  
  const total = breakdown.input + breakdown.output + breakdown.cache_read + breakdown.cache_write;
  
  return {
    cost_usd: parseFloat(total.toFixed(6)),
    breakdown
  };
}

/**
 * Get pricing data for a specific model
 * @param {string} provider - Provider name
 * @param {string} model - Model name
 * @returns {object|null} Pricing object or null if not found
 */
function getPricing(provider, model) {
  const providerPricing = config.pricing[provider.toLowerCase()];
  if (!providerPricing) return null;
  
  // Check for exact model match
  if (providerPricing[model]) {
    return providerPricing[model];
  }
  
  // Check for default pricing
  if (providerPricing._default) {
    return providerPricing._default;
  }
  
  // Try partial match (e.g., "claude-opus-4" matches "claude-opus-4-6")
  for (const [key, value] of Object.entries(providerPricing)) {
    if (key.startsWith('_')) continue; // Skip meta keys
    if (model.includes(key) || key.includes(model)) {
      return value;
    }
  }
  
  return null;
}

/**
 * Check if model is local (zero API cost)
 * @param {string} provider - Provider name
 * @param {string} model - Model name
 * @returns {boolean}
 */
function isLocalModel(provider, model) {
  const localProviders = ['lmstudio', 'ollama', 'local'];
  return localProviders.includes(provider.toLowerCase());
}

/**
 * Estimate token count from text (rough approximation)
 * @param {string} text - Text to estimate
 * @returns {number} Estimated token count
 */
function estimateTokens(text) {
  if (!text) return 0;
  // Rule of thumb: ~4 characters per token for English text
  return Math.ceil(text.length / 4);
}

/**
 * Estimate cost from text before making API call
 * @param {string} text - Input text
 * @param {string} provider - Provider name
 * @param {string} model - Model name
 * @param {number} expectedOutputRatio - Expected output/input ratio (default 0.5)
 * @returns {object} { estimated_tokens, estimated_cost_usd }
 */
function estimateFromText(text, provider, model, expectedOutputRatio = 0.5) {
  const inputTokens = estimateTokens(text);
  const outputTokens = Math.ceil(inputTokens * expectedOutputRatio);
  
  const cost = estimateCost({
    provider,
    model,
    inputTokens,
    outputTokens
  });
  
  return {
    estimated_input_tokens: inputTokens,
    estimated_output_tokens: outputTokens,
    estimated_cost_usd: cost.cost_usd
  };
}

/**
 * Calculate cache savings
 * @param {number} cacheReadTokens - Tokens read from cache
 * @param {string} provider - Provider name
 * @param {string} model - Model name
 * @returns {object} { saved_usd, would_have_cost }
 */
function calculateCacheSavings(cacheReadTokens, provider, model) {
  const pricing = getPricing(provider, model);
  if (!pricing || !pricing.cache_read_per_1m || !pricing.input_per_1m) {
    return { saved_usd: 0, would_have_cost: 0 };
  }
  
  const cacheReadCost = (cacheReadTokens / 1000000) * pricing.cache_read_per_1m;
  const wouldHaveCost = (cacheReadTokens / 1000000) * pricing.input_per_1m;
  const saved = wouldHaveCost - cacheReadCost;
  
  return {
    saved_usd: parseFloat(saved.toFixed(6)),
    would_have_cost: parseFloat(wouldHaveCost.toFixed(6)),
    actual_cost: parseFloat(cacheReadCost.toFixed(6))
  };
}

/**
 * Get all available providers
 * @returns {array} List of provider names
 */
function getProviders() {
  return Object.keys(config.pricing);
}

/**
 * Get all models for a provider
 * @param {string} provider - Provider name
 * @returns {array} List of model names
 */
function getModels(provider) {
  const providerPricing = config.pricing[provider.toLowerCase()];
  if (!providerPricing) return [];
  
  return Object.keys(providerPricing).filter(key => !key.startsWith('_'));
}

module.exports = {
  estimateCost,
  getPricing,
  isLocalModel,
  estimateTokens,
  estimateFromText,
  calculateCacheSavings,
  getProviders,
  getModels
};
