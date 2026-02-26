// Circuit breaker state per provider
const circuitState = new Map();

const CIRCUIT_THRESHOLD = 5;       // failures before opening circuit
const CIRCUIT_RESET_MS = 60000;    // try again after 60s

async function withRetry(fn, options = {}) {
  const maxRetries = options.retries ?? 3;
  const baseDelay = options.delayMs ?? 1000;
  const timeoutMs = options.timeoutMs ?? 30000;
  const onRetry = options.onRetry || (() => {});
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Timeout wrapper
      const result = await Promise.race([
        fn(),
        new Promise((_, reject) => {
          setTimeout(() => {
            const err = new Error(`Request timed out after ${timeoutMs}ms`);
            err.code = 'TIMEOUT';
            reject(err);
          }, timeoutMs);
        })
      ]);
      
      return result;
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      // Don't retry on auth errors
      if (error.status === 401 || error.status === 403) throw error;
      
      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 500;
      
      onRetry(attempt + 1, error);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

module.exports = { withRetry };
