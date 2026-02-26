const { resolveCredentials } = require('./credentials');
const { detectProvider } = require('./model-utils');

/**
 * Direct LLM call for security-critical operations.
 * - No caching (to prevent cache poisoning)
 * - No retry (fail-fast for security decisions)
 * - Independent credential resolution
 * - Minimal logging (only to security log, not interaction store)
 */
async function callDirect({ model, messages, maxTokens, temperature, timeoutMs }) {
  const { provider, modelName } = detectProvider(model);
  const creds = resolveCredentials(provider);  // independent resolution
  
  const providerModule = require(`./providers/${provider}`);
  
  const startTime = Date.now();
  
  try {
    const result = await Promise.race([
      providerModule.call({
        model: modelName,
        messages,
        credentials: creds,
        maxTokens: maxTokens || 1000,
        temperature: temperature ?? 0,
        _skipLog: true  // don't log to interaction store
      }),
      new Promise((_, reject) => {
        setTimeout(() => {
          const err = new Error('Security call timed out');
          err.code = 'TIMEOUT';
          reject(err);
        }, timeoutMs || 15000);
      })
    ]);
    
    return {
      text: result.text,
      status: 'success',
      durationMs: Date.now() - startTime
    };
  } catch (error) {
    return {
      text: null,
      status: 'error',
      error: error.message,
      durationMs: Date.now() - startTime
    };
  }
}

module.exports = { callDirect };
