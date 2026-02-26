/**
 * Secret and PII Redaction Engine
 * Recursively redacts sensitive data from objects before logging
 */

const PATTERNS = [
  // API keys and tokens (20+ char alphanumeric after key-like prefix)
  { re: /(?:sk|pk|api|key|token|secret|password|bearer)[-_]?[\w]{20,}/gi, sub: '[REDACTED_KEY]' },
  // Standalone long hex/base64 strings (likely tokens)
  { re: /\b[A-Za-z0-9+/]{40,}={0,2}\b/g, sub: '[REDACTED_TOKEN]' },
  // Email addresses
  { re: /[\w.+-]+@[\w.-]+\.\w{2,}/g, sub: '[REDACTED_EMAIL]' },
  // File paths with usernames
  { re: /\/Users\/\w+/g, sub: '/Users/[USER]' },
  // Private IPs
  { re: /\b(?:192\.168|10\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\b/g, sub: '[PRIVATE_IP]' },
  // Dollar amounts
  { re: /\$[\d,]+(?:\.\d{2})?/g, sub: '[AMOUNT]' },
  // Localhost with ports
  { re: /localhost:\d+/g, sub: 'localhost:[PORT]' },
  // Env var assignments with secrets
  { re: /(?:STRIPE|OPENAI|ANTHROPIC|SERPAPI|TAVILY|GOOGLE)_[\w]*(?:KEY|SECRET|TOKEN)\s*[=:]\s*\S+/gi, sub: '[REDACTED_ENV]' }
];

/**
 * Recursively redact sensitive data from any type
 * @param {*} data - Data to redact
 * @returns {*} Redacted copy of data
 */
function redact(data) {
  if (data === null || data === undefined) return data;
  if (typeof data === 'string') return redactString(data);
  if (typeof data === 'number' || typeof data === 'boolean') return data;
  if (Array.isArray(data)) return data.map(redact);
  if (typeof data === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(data)) {
      out[k] = redact(v);
    }
    return out;
  }
  return data;
}

/**
 * Apply all redaction patterns to a string
 * @param {string} str - String to redact
 * @returns {string} Redacted string
 */
function redactString(str) {
  let result = str;
  for (const { re, sub } of PATTERNS) {
    result = result.replace(re, sub);
  }
  return result;
}

module.exports = { redact, redactString, PATTERNS };
