class ConfidentialityGuard {
  // Check if message contains dollar amounts
  containsDollarAmounts(text) {
    const patterns = [
      /\$[\d,]+\.?\d*/g,            // $1,234.56
      /\d+\.\d{2}\s*(dollars?)/gi,  // 1234.56 dollars
      /revenue.*\d+/gi,             // revenue 50000
      /expense.*\d+/gi,             // expense 1200
      /profit.*\d+/gi,              // profit 3000
      /income.*\d+/gi,              // income 42000
      /\d+\s*k\s*(revenue|profit|income)/gi  // 50k revenue
    ];

    return patterns.some(p => p.test(text));
  }

  // Redact dollar amounts from outbound messages
  redactMessage(text) {
    let redacted = text;

    // Replace $X,XXX.XX patterns
    redacted = redacted.replace(/\$[\d,]+\.?\d*/g, '[amount redacted]');

    // Replace "X dollars" patterns
    redacted = redacted.replace(/\d+\.?\d*\s*(dollars?)/gi, '[amount redacted]');

    // Replace standalone numbers near financial keywords
    redacted = redacted.replace(/revenue.*?(\d+[\d,]*\.?\d*)/gi, 'revenue [redacted]');
    redacted = redacted.replace(/expense.*?(\d+[\d,]*\.?\d*)/gi, 'expense [redacted]');
    redacted = redacted.replace(/profit.*?(\d+[\d,]*\.?\d*)/gi, 'profit [redacted]');
    redacted = redacted.replace(/income.*?(\d+[\d,]*\.?\d*)/gi, 'income [redacted]');

    return redacted;
  }

  // Convert specific amounts to directional language
  toDirectionalLanguage(currentValue, previousValue, metricName) {
    if (!previousValue || previousValue === 0) {
      return `${metricName}: baseline established`;
    }

    const change = ((currentValue - previousValue) / previousValue * 100).toFixed(1);
    const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
    const magnitude = Math.abs(parseFloat(change));

    let descriptor = '';
    if (magnitude < 5) descriptor = 'slightly';
    else if (magnitude < 15) descriptor = '';
    else if (magnitude < 30) descriptor = 'significantly';
    else descriptor = 'sharply';

    if (direction === 'flat') {
      return `${metricName} holding steady`;
    }

    return `${metricName} trending ${descriptor} ${direction} ${Math.abs(change)}%`.trim();
  }

  // Check context and enforce rules
  shouldAllow(context, containsFinancialData) {
    if (!containsFinancialData) {
      return { allowed: true };
    }

    // Always allow in private contexts
    if (context === 'private' || context === 'direct' || context === 'dm') {
      return { allowed: true };
    }

    // Dedicated financials channel is OK
    if (context === 'financials_channel' || context === 'financials') {
      return { allowed: true };
    }

    // Group chats: block specific amounts
    return {
      allowed: false,
      reason: 'Financial data cannot be shared in group chats',
      suggestion: 'Use directional language (e.g., "revenue trending up 12%") without specific amounts'
    };
  }

  // Create safe summary for group contexts
  createSafeSummary(data) {
    if (!data || typeof data !== 'object') return data;

    const safe = { ...data };

    // Replace any numeric values in financial fields
    for (const key of Object.keys(safe)) {
      if (typeof safe[key] === 'number' && (
        key.includes('amount') ||
        key.includes('revenue') ||
        key.includes('expense') ||
        key.includes('income') ||
        key.includes('profit') ||
        key.includes('total')
      )) {
        safe[key] = '[redacted]';
      }

      // Handle nested objects
      if (typeof safe[key] === 'object' && safe[key] !== null) {
        safe[key] = this.createSafeSummary(safe[key]);
      }
    }

    return safe;
  }

  // Validate that a message is safe for the given context
  validate(message, context) {
    const containsFinancials = this.containsDollarAmounts(message);
    const check = this.shouldAllow(context, containsFinancials);

    if (!check.allowed) {
      return {
        safe: false,
        reason: check.reason,
        suggestion: check.suggestion,
        redactedMessage: this.redactMessage(message)
      };
    }

    return { safe: true, message };
  }
}

module.exports = new ConfidentialityGuard();

// CLI test
if (require.main === module) {
  const guard = new ConfidentialityGuard();

  // Test cases
  const tests = [
    { text: 'Revenue was $50,000 last month', context: 'group' },
    { text: 'We spent 1200 dollars on marketing', context: 'group' },
    { text: 'Profit this quarter: 42000', context: 'private' },
    { text: 'Revenue trending up 15% compared to last quarter', context: 'group' },
    { text: 'Just a regular message about tasks', context: 'group' }
  ];

  console.log('=== Confidentiality Guard Tests ===\n');

  for (const test of tests) {
    console.log(`Context: ${test.context}`);
    console.log(`Original: "${test.text}"`);
    
    const result = guard.validate(test.text, test.context);
    
    if (result.safe) {
      console.log('✅ SAFE - Message can be sent');
    } else {
      console.log('❌ BLOCKED - ' + result.reason);
      console.log(`Suggestion: ${result.suggestion}`);
      console.log(`Redacted: "${result.redactedMessage}"`);
    }
    
    console.log('');
  }

  // Test directional language
  console.log('=== Directional Language Examples ===\n');
  console.log(guard.toDirectionalLanguage(50000, 45000, 'Revenue'));
  console.log(guard.toDirectionalLanguage(8000, 12000, 'Marketing expenses'));
  console.log(guard.toDirectionalLanguage(10000, 10050, 'Monthly costs'));
  console.log(guard.toDirectionalLanguage(75000, 50000, 'Client revenue'));
}
