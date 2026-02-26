// Friendly aliases → official model names
const MODEL_ALIASES = {
  // Anthropic
  'opus': 'anthropic/claude-opus-4-6',
  'opus-4': 'anthropic/claude-opus-4-6',
  'sonnet': 'anthropic/claude-sonnet-4-5',
  'sonnet-4': 'anthropic/claude-sonnet-4-5',
  'haiku': 'anthropic/claude-haiku-4-5',
  'haiku-4': 'anthropic/claude-haiku-4-5',
  // OpenAI
  'gpt4': 'openai/gpt-4-turbo',
  'gpt4-turbo': 'openai/gpt-4-turbo',
  '4o': 'openai/gpt-4o',
  '4o-mini': 'openai/gpt-4o-mini',
  // Google
  'gemini-pro': 'google/gemini-2.5-pro',
  'gemini-flash': 'google/gemini-2.0-flash',
  // Local (our team models)
  'devstral': 'lmstudio/mistralai/devstral-small-2-2512',
  'gemma': 'lmstudio/gemma-3-12b-it',
  'qwen': 'lmstudio/qwen/qwen3-4b-2507',
  'nomic': 'lmstudio/nomic-embed-text-v1.5'
};

function resolveAlias(modelString) {
  const lower = modelString.toLowerCase().trim();
  return MODEL_ALIASES[lower] || modelString;
}

// Provider detection from model string
const PROVIDER_PATTERNS = [
  { prefix: 'anthropic/', provider: 'anthropic' },
  { prefix: 'claude-', provider: 'anthropic' },
  { prefix: 'openai/', provider: 'openai' },
  { prefix: 'gpt-', provider: 'openai' },
  { prefix: 'o1-', provider: 'openai' },
  { prefix: 'google/', provider: 'google' },
  { prefix: 'gemini-', provider: 'google' },
  { prefix: 'lmstudio/', provider: 'lmstudio' },
  // Common local model names
  { prefix: 'qwen', provider: 'lmstudio' },
  { prefix: 'gemma', provider: 'lmstudio' },
  { prefix: 'llama', provider: 'lmstudio' },
  { prefix: 'mistral', provider: 'lmstudio' },
  { prefix: 'devstral', provider: 'lmstudio' },
  { prefix: 'nomic-', provider: 'lmstudio' },
  { prefix: 'phi-', provider: 'lmstudio' }
];

function detectProvider(modelString) {
  // Resolve aliases first
  modelString = resolveAlias(modelString);
  
  // Explicit provider prefix (e.g., "anthropic/claude-opus-4-6")
  const slashIndex = modelString.indexOf('/');
  if (slashIndex > 0) {
    const prefix = modelString.substring(0, slashIndex);
    const knownProviders = ['anthropic', 'openai', 'google', 'lmstudio'];
    if (knownProviders.includes(prefix)) {
      return {
        provider: prefix,
        modelName: modelString.substring(slashIndex + 1)
      };
    }
    // LM Studio nested paths (e.g., "lmstudio/mistralai/devstral-small-2-2512")
    if (prefix === 'lmstudio') {
      return {
        provider: 'lmstudio',
        modelName: modelString.substring(slashIndex + 1)
      };
    }
  }
  
  // Pattern matching
  for (const { prefix, provider } of PROVIDER_PATTERNS) {
    if (modelString.startsWith(prefix)) {
      return { provider, modelName: modelString };
    }
  }
  
  // Default: assume LM Studio (local)
  return { provider: 'lmstudio', modelName: modelString };
}

// Model tier classification
const MODEL_TIERS = {
  'claude-opus-4-6': { tier: 'premium', capability: 'reasoning', contextWindow: 200000 },
  'claude-sonnet-4-5': { tier: 'standard', capability: 'general', contextWindow: 200000 },
  'claude-haiku-4-5': { tier: 'fast', capability: 'general', contextWindow: 200000 },
  'gpt-4-turbo': { tier: 'premium', capability: 'general', contextWindow: 128000 },
  'gpt-4o': { tier: 'standard', capability: 'general', contextWindow: 128000 },
  'gpt-4o-mini': { tier: 'fast', capability: 'general', contextWindow: 128000 },
  'gemini-2.5-pro': { tier: 'premium', capability: 'reasoning', contextWindow: 1000000 },
  'gemini-2.0-flash': { tier: 'fast', capability: 'general', contextWindow: 1000000 }
};

function getModelTier(modelName) {
  // Strip provider prefix
  const name = modelName.includes('/') ? modelName.split('/').pop() : modelName;
  return MODEL_TIERS[name] || { tier: 'local', capability: 'general', contextWindow: 8192 };
}

// Normalize model names across providers
function normalizeModelName(modelString) {
  const { provider, modelName } = detectProvider(modelString);
  return `${provider}/${modelName}`;
}

// Check if model is local (zero cost)
function isLocalModel(modelString) {
  const { provider } = detectProvider(modelString);
  return provider === 'lmstudio';
}

module.exports = { detectProvider, getModelTier, normalizeModelName, isLocalModel, resolveAlias, MODEL_ALIASES, MODEL_TIERS };
