/**
 * Outbound Redaction Module
 * 
 * Context-aware redaction for messages leaving the system.
 * - Secrets: Always redacted
 * - PII: Redacted in non-private contexts
 * - Financials: Redacted in non-private contexts
 */

class OutboundRedactor {
  constructor(context) {
    this.context = context || {};  // { chat_type, is_private, sender_id, ... }
  }

  /**
   * Main redaction entry point
   */
  redact(message) {
    let result = message;

    // Always redact secrets (any context)
    result = this.redactSecrets(result);

    // In non-private contexts, also redact PII and financials
    if (!this.isPrivateContext()) {
      result = this.redactPII(result);
      result = this.redactFinancials(result);
    }

    return result;
  }

  /**
   * Check if current context is private
   */
  isPrivateContext() {
    return this.context.is_private === true || 
           this.context.chat_type === 'direct' ||
           this.context.chat_type === 'dm';
  }

  /**
   * Redact API keys, tokens, secrets
   * Always applied, regardless of context
   */
  redactSecrets(text) {
    return text
      // Generic secret patterns
      .replace(/(?:sk|pk|api|key|token|secret)[-_]?[\w]{20,}/gi, '[REDACTED_SECRET]')
      
      // Service-specific API keys
      .replace(/(?:ANTHROPIC|OPENAI|STRIPE|SERPAPI|TAVILY|GOOGLE|AWS|AZURE)_[\w]+\s*[=:]\s*\S+/gi, '[REDACTED_SECRET]')
      
      // JWT tokens
      .replace(/eyJ[A-Za-z0-9_-]{2,}\.eyJ[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]{2,}/g, '[REDACTED_TOKEN]')
      
      // Password fields
      .replace(/password\s*[:=]\s*\S+/gi, 'password: [REDACTED]')
      
      // OAuth tokens
      .replace(/(?:access_token|refresh_token|bearer)\s*[:=]\s*\S+/gi, '[REDACTED_TOKEN]');
  }

  /**
   * Redact personally identifiable information
   * Applied in non-private contexts only
   */
  redactPII(text) {
    return text
      // Personal email addresses (not work domains)
      .replace(/[\w.+-]+@(?:gmail|yahoo|hotmail|outlook|icloud|me|mac|protonmail|aol)\.(?:com|net|org)/gi, '[personal_email]')
      
      // Phone numbers (US format)
      .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[phone]')
      
      // Phone with country code
      .replace(/\+1\s*\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[phone]')
      
      // SSN pattern
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
      
      // Credit card numbers
      .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[card_number]')
      
      // Physical addresses (simplified pattern)
      .replace(/\b\d+\s+[A-Z][a-z]+\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct)\b/gi, '[address]');
  }

  /**
   * Redact financial information
   * Applied in non-private contexts only
   */
  redactFinancials(text) {
    return text
      // Dollar amounts with currency symbol
      .replace(/\$[\d,]+(?:\.\d{2})?(?:\s*(?:USD|CAD|AUD))?/g, '[amount]')
      
      // Dollar amounts written out
      .replace(/\b\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s*dollars?\b/gi, '[amount]')
      
      // Revenue/cost figures with context
      .replace(/(?:revenue|profit|cost|income|salary|wage|price|worth|value)[:=\s]+\$?[\d,]+(?:\.\d{2})?/gi, (match) => {
        const prefix = match.match(/^[^:\d]+/)?.[0] || '';
        return `${prefix}[financial_figure]`;
      })
      
      // EUR/GBP amounts
      .replace(/[€£][\d,]+(?:\.\d{2})?/g, '[amount]')
      
      // Numeric ranges that look financial
      .replace(/\$[\d,]+-\$?[\d,]+/g, '[amount_range]');
  }

  /**
   * Check if text contains work email (allowed in all contexts)
   */
  isWorkEmail(email) {
    const workDomains = [
      'bythereeses.com',
      'getrehive.com',
      'anselai.com'
    ];
    
    const domain = email.split('@')[1]?.toLowerCase();
    return workDomains.includes(domain);
  }

  /**
   * Generate redaction report (for testing/debugging)
   */
  getRedactionReport(original, redacted) {
    const differences = [];
    
    if (original !== redacted) {
      const secretCount = (redacted.match(/\[REDACTED_SECRET\]/g) || []).length;
      const tokenCount = (redacted.match(/\[REDACTED_TOKEN\]/g) || []).length;
      const piiCount = (redacted.match(/\[(personal_email|phone|SSN|card_number|address)\]/g) || []).length;
      const financialCount = (redacted.match(/\[(amount|financial_figure|amount_range)\]/g) || []).length;
      
      return {
        redacted: true,
        context: this.isPrivateContext() ? 'private' : 'public',
        secrets: secretCount,
        pii: piiCount,
        financials: financialCount,
        tokens: tokenCount
      };
    }
    
    return { redacted: false };
  }
}

module.exports = OutboundRedactor;

// Example usage
if (require.main === module) {
  console.log('🔒 Outbound Redaction Test Suite\n');

  // Test 1: Private context (nothing redacted except secrets)
  console.log('Test 1: Private context');
  const privateRedactor = new OutboundRedactor({ is_private: true });
  const privateMsg = 'My email is jtyler.reese@gmail.com and I made $50,000 last month. API key: sk-abc123def456ghi789';
  const privateResult = privateRedactor.redact(privateMsg);
  console.log('Original:', privateMsg);
  console.log('Redacted:', privateResult);
  console.log('Report:', privateRedactor.getRedactionReport(privateMsg, privateResult));
  console.log();

  // Test 2: Public context (PII and financials redacted)
  console.log('Test 2: Public context');
  const publicRedactor = new OutboundRedactor({ is_private: false });
  const publicMsg = 'Contact me at jtyler.reese@gmail.com or hello@bythereeses.com. Revenue is $45,000.';
  const publicResult = publicRedactor.redact(publicMsg);
  console.log('Original:', publicMsg);
  console.log('Redacted:', publicResult);
  console.log('Report:', publicRedactor.getRedactionReport(publicMsg, publicResult));
  console.log();

  // Test 3: Work email should pass through
  console.log('Test 3: Work email handling');
  const workMsg = 'Reach out to hello@bythereeses.com for inquiries.';
  const workResult = publicRedactor.redact(workMsg);
  console.log('Original:', workMsg);
  console.log('Redacted:', workResult);
  console.log('Passed:', workMsg === workResult ? '✓' : '✗');
}
