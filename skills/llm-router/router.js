const { detectProvider } = require('./model-utils');
const { resolveCredentials } = require('./credentials');
const { withRetry } = require('./retry');
const { checkCache, storeCache } = require('./cache');
const { smokeTest } = require('./smoke');

// Provider modules
const providers = {
  anthropic: require('./providers/anthropic'),
  openai: require('./providers/openai'),
  google: require('./providers/google'),
  lmstudio: require('./providers/lmstudio')
};

// Track which providers have passed smoke test
const smokeTestPassed = new Set();

function normalizeMessages(options) {
  if (options.messages) {
    return options.messages;
  }
  
  const messages = [];
  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  if (options.prompt) {
    messages.push({ role: 'user', content: options.prompt });
  }
  if (options.input && !options.embed) {
    // Input field for non-embedding requests
    messages.push({ role: 'user', content: options.input });
  }
  return messages;
}

function logToInteractionStore(callData) {
  // Log to usage-tracking (if available)
  try {
    const UsageLogger = require('/Users/marcusrawlins/.openclaw/workspace/skills/usage-tracking/logger');
    UsageLogger.getInstance().logLLM(callData);
  } catch (e) { 
    // usage-tracking not installed yet, skip
  }
  
  // Log to logging infrastructure (if available)
  try {
    const Logger = require('/Users/marcusrawlins/.openclaw/workspace/skills/logging/logger');
    Logger.getInstance().info('usage.llm', {
      provider: callData.provider,
      model: callData.model,
      agent: callData.agent,
      inputTokens: callData.inputTokens,
      outputTokens: callData.outputTokens,
      cost: callData.estimatedCost,
      status: callData.status,
      durationMs: callData.durationMs
    });
  } catch (e) { 
    // logging not installed yet, skip
  }
}

async function callLlm(options) {
  const startTime = Date.now();
  
  // 1. Detect provider
  const { provider, modelName } = detectProvider(options.model);
  
  if (!providers[provider]) {
    throw new Error(`Unknown provider: ${provider}. Known: ${Object.keys(providers).join(', ')}`);
  }
  
  // 2. Resolve credentials
  const creds = resolveCredentials(provider);
  
  // 3. Smoke test on first use
  if (!smokeTestPassed.has(provider) && !options._skipLog) {
    const passed = await smokeTest(provider, creds, providers[provider]);
    if (!passed) {
      throw new Error(`Smoke test failed for provider: ${provider}. Check credentials and connectivity.`);
    }
    smokeTestPassed.add(provider);
  }
  
  // 4. Check prompt cache
  if (options.cacheSystemPrompt && options.systemPrompt) {
    const cached = checkCache(options.systemPrompt, provider);
    if (cached) {
      options._cachedSystemPromptId = cached.id;
    }
  }
  
  // 5. Normalize input to messages format (unless embedding)
  let messages = [];
  if (!options.embed) {
    messages = normalizeMessages(options);
  }
  
  // 6. Call provider with retry
  let result;
  try {
    result = await withRetry(
      () => providers[provider].call({
        model: modelName,
        messages,
        credentials: creds,
        ...options
      }),
      {
        retries: options.retries,
        delayMs: options.retryDelayMs,
        timeoutMs: options.timeoutMs,
        onRetry: (attempt, error) => {
          // Log retry attempts
          if (!options._skipLog) {
            logToInteractionStore({
              agent: options.agent,
              provider,
              model: modelName,
              status: 'retry',
              error: error.message,
              attempt
            });
          }
        }
      }
    );
  } catch (error) {
    const durationMs = Date.now() - startTime;
    
    // Log failure
    if (!options._skipLog) {
      logToInteractionStore({
        agent: options.agent || 'unknown',
        provider,
        model: modelName,
        taskType: options.taskType,
        taskDescription: options.taskDescription,
        inputTokens: 0,
        outputTokens: 0,
        durationMs,
        status: error.code === 'TIMEOUT' ? 'timeout' : 'error',
        error: error.message,
        sessionKey: options.sessionKey
      });
    }
    
    throw error;
  }
  
  const durationMs = Date.now() - startTime;
  
  // 7. Store prompt cache if applicable
  if (options.cacheSystemPrompt && options.systemPrompt && result.cacheId) {
    storeCache(options.systemPrompt, provider, result.cacheId);
  }
  
  // 8. Log to interaction store
  if (!options._skipLog) {
    logToInteractionStore({
      agent: options.agent || 'unknown',
      provider,
      model: modelName,
      taskType: options.taskType,
      taskDescription: options.taskDescription,
      inputTokens: result.inputTokens || 0,
      outputTokens: result.outputTokens || 0,
      cacheReadTokens: result.cacheReadTokens || 0,
      cacheWriteTokens: result.cacheWriteTokens || 0,
      durationMs,
      status: 'success',
      sessionKey: options.sessionKey
    });
  }
  
  // 9. Return normalized response
  return {
    text: result.text,
    model: modelName,
    provider,
    inputTokens: result.inputTokens || 0,
    outputTokens: result.outputTokens || 0,
    cacheReadTokens: result.cacheReadTokens || 0,
    cacheWriteTokens: result.cacheWriteTokens || 0,
    durationMs,
    estimatedCost: result.estimatedCost || 0,
    status: 'success',
    ...(result.json ? { json: result.json } : {}),
    ...(result.vector ? { vector: result.vector, dimensions: result.dimensions } : {})
  };
}

module.exports = { callLlm };
