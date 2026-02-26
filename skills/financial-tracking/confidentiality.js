/**
 * Confidentiality Guard
 * Enforces strict financial data security rules
 * - Blocks dollar amounts in group chats
 * - Redacts sensitive numbers automatically
 * - Uses directional language for safe group messaging
 * - Tracks all access
 */

class ConfidentialityGuard {
  /**
   * Check if text contains explicit dollar amounts
   */
  containsDollarAmounts(text) {
    const patterns = [
      /\$[\d,]+\.?\d*/g,                    // $1,234.56
      /\d+\.\d{2}\s+(dollars?|usd)/gi,     // 1234.56 dollars
      /\b(revenue|income|profit|expense)\s*[:=]?\s*\d+[,\d]*/gi  // revenue: 50000
    ];

    return patterns.some(p => p.test(text));
  }

  /**
   * Redact dollar amounts from message
   */
  redactMessage(text) {
    let redacted = text;

    // Replace $X,XXX.XX patterns
    redacted = redacted.replace(/\$[\d,]+\.?\d*/g, '[amount redacted]');

    // Replace "X dollars/usd" patterns
    redacted = redacted.replace(/\d+\.?\d*\s*(dollars?|usd|euro|£)/gi, '[amount redacted]');

    // Replace "revenue: X" type patterns
    redacted = redacted.replace(/(revenue|income|profit|expense|cost)\s*[:=]?\s*\d+[,\d]*/gi, '$1: [amount redacted]');

    return redacted;
  }

  /**
   * Convert specific financial metric to directional language
   * Example: revenue 50000 → "revenue trending up 15%"
   */
  toDirectionalLanguage(currentValue, previousValue, metricName) {
    if (!previousValue || previousValue === 0) {
      return `${metricName}: data available (initial period)`;
    }

    const change = ((currentValue - previousValue) / previousValue) * 100;
    const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
    const magnitude = Math.abs(change).toFixed(1);

    return `${metricName} trending ${direction} ${magnitude}%`;
  }

  /**
   * Determine if context allows financial data sharing
   */
  shouldAllow(context, containsFinancialData) {
    if (!containsFinancialData) {
      return { allowed: true };
    }

    // ALLOWED contexts
    const allowedContexts = ['private', 'direct', 'financials_channel', 'walt_analysis'];

    if (allowedContexts.includes(context)) {
      return { allowed: true };
    }

    // GROUP CHATS: Block
    if (context.includes('group') || context.includes('team') || context.includes('public')) {
      return {
        allowed: false,
        reason: 'Financial data cannot be shared in group chats',
        suggestion: 'Use directional language (e.g., "revenue trending up 12%") without specific amounts',
        action: 'redact'
      };
    }

    // Unknown context: default to blocking
    return {
      allowed: false,
      reason: 'Unknown context - defaulting to secure (financial data protected)',
      suggestion: 'Use directional language or post in private/financials channel',
      action: 'redact'
    };
  }

  /**
   * Generate safe, directional summary for group chat
   * Input: Financial report with exact numbers
   * Output: Message with no dollar amounts, only trends
   */
  generateGroupSafeSummary(report, metricType = 'financial') {
    if (metricType === 'pnl') {
      // P&L report: show trends, not amounts
      const revenueChange = report.revenue.total > 0 ? '+' : '';
      const direction = report.netIncome > 0 ? 'positive' : 'negative';

      return `📊 Financial summary: period ended with ${direction} net result. ` +
             `Multiple revenue streams and expense categories tracked. ` +
             `Detailed report available in private channel.`;
    }

    if (metricType === 'invoices') {
      return `📄 Invoice status: ${report.total} invoices tracked. ` +
             `Some require attention. ` +
             `Detailed breakdown available to authorized users only.`;
    }

    if (metricType === 'trends') {
      return `📈 Financial trends: tracking performance over multiple periods. ` +
             `Month-over-month analysis available in financials channel.`;
    }

    return 'Financial data summary available in authorized context only.';
  }

  /**
   * Classify message context
   */
  classifyContext(channelInfo) {
    if (channelInfo.isPrivate || channelInfo.isDirect) {
      return 'private';
    }

    if (channelInfo.name && channelInfo.name.includes('finance')) {
      return 'financials_channel';
    }

    if (channelInfo.isGroup || channelInfo.members > 5) {
      return 'group';
    }

    if (channelInfo.isPublic) {
      return 'public';
    }

    return 'unknown';
  }

  /**
   * Audit trail: was this message redacted?
   */
  createAuditRecord(agent, originalText, redactedText, context, reason) {
    return {
      timestamp: new Date().toISOString(),
      agent,
      context,
      originalLength: originalText.length,
      redactedLength: redactedText ? redactedText.length : 0,
      wasRedacted: originalText !== redactedText,
      reason
    };
  }

  /**
   * Policy check: validate message before sending to group
   */
  validateGroupMessage(text) {
    const hasDollars = this.containsDollarAmounts(text);

    if (hasDollars) {
      return {
        valid: false,
        error: 'Message contains dollar amounts',
        suggestion: this.redactMessage(text),
        severity: 'block'
      };
    }

    // Check for other financial keywords with numbers
    const financialKeywords = ['revenue', 'expense', 'profit', 'cost', 'invoice', 'amount'];
    const hasFinancialData = financialKeywords.some(kw => text.toLowerCase().includes(kw));

    if (hasFinancialData && /\d{4,}/.test(text)) {
      // Has financial keyword + large numbers
      return {
        valid: false,
        error: 'Message contains potential financial data',
        suggestion: 'Remove specific numbers and use directional language',
        severity: 'warn'
      };
    }

    return {
      valid: true,
      error: null
    };
  }
}

module.exports = new ConfidentialityGuard();
