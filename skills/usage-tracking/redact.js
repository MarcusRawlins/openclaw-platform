const crypto = require('crypto');
const path = require('path');
const config = require('./config.json');

/**
 * Secret and PII redaction for LLM prompts and responses
 */

const REDACTION_PATTERNS = [
  // API keys and tokens (high priority - check first)
  { pattern: /(?:sk|pk|api|key|token|secret|password|bearer)[-_]?[\w]{20,}/gi, replace: '[REDACTED_KEY]' },
  
  // Common secret env var patterns
  { pattern: /(?:STRIPE|OPENAI|ANTHROPIC|SERPAPI|TAVILY|GOOGLE|BRAVE|ELEVENLABS|TELEGRAM)_[\w]*(?:KEY|SECRET|TOKEN|PASSWORD)\s*[=:]\s*\S+/gi, replace: '[REDACTED_ENV]' },
  
  // Email addresses
  { pattern: /[\w.-]+@[\w.-]+\.\w{2,}/g, replace: '[REDACTED_EMAIL]' },
  
  // File paths with usernames
  { pattern: /\/Users\/[^\/\s]+/g, replace: '/Users/[REDACTED]' },
  
  // IP addresses (private ranges)
  { pattern: /\b(?:192\.168|10\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\b/g, replace: '[PRIVATE_IP]' },
  
  // Dollar amounts (financial confidentiality)
  { pattern: /\$[\d,]+(?:\.\d{2})?/g, replace: '[REDACTED_AMOUNT]' },
  
  // Port numbers on localhost
  { pattern: /localhost:\d+/g, replace: 'localhost:[PORT]' },
  { pattern: /127\.0\.0\.1:\d+/g, replace: '127.0.0.1:[PORT]' }
];

/**
 * Redact sensitive information from text
 * @param {string} text - Text to redact
 * @returns {string} Redacted text
 */
function redact(text) {
  if (!text) return '';
  
  let redacted = text;
  
  // Apply standard patterns
  for (const { pattern, replace } of REDACTION_PATTERNS) {
    redacted = redacted.replace(pattern, replace);
  }
  
  // Apply custom patterns from config
  if (config.redaction.custom_patterns && Array.isArray(config.redaction.custom_patterns)) {
    for (const customPattern of config.redaction.custom_patterns) {
      try {
        const regex = new RegExp(customPattern.pattern, customPattern.flags || 'g');
        redacted = redacted.replace(regex, customPattern.replace || '[REDACTED]');
      } catch (err) {
        // Skip invalid regex patterns
        console.error(`Invalid custom redaction pattern: ${customPattern.pattern}`);
      }
    }
  }
  
  return redacted;
}

/**
 * Create SHA-256 hash of text (for deduplication)
 * @param {string} text - Text to hash
 * @returns {string} Hex hash
 */
function hash(text) {
  if (!text) return null;
  return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 * Redact and create preview (first N chars)
 * @param {string} text - Text to preview
 * @param {number} length - Preview length (default from config)
 * @returns {string} Preview text
 */
function preview(text, length = null) {
  if (!text) return '';
  const previewLength = length || config.logging.preview_length || 200;
  const redacted = redact(text);
  return redacted.substring(0, previewLength);
}

/**
 * Process text for storage: redact and generate hash
 * @param {string} text - Original text
 * @returns {object} { redacted, hash, preview }
 */
function process(text) {
  if (!text) return { redacted: '', hash: null, preview: '' };
  
  const redacted = redact(text);
  const textHash = hash(redacted);
  const textPreview = preview(redacted);
  
  return {
    redacted,
    hash: textHash,
    preview: textPreview
  };
}

module.exports = {
  redact,
  hash,
  preview,
  process
};
