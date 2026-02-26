const fs = require('fs');
const path = require('path');

class NotificationClassifier {
  constructor() {
    const rulesPath = path.join(__dirname, 'rules.json');
    this.rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
  }

  classify(message, source = 'unknown') {
    // Check rules in priority order (highest first)
    const sorted = [...this.rules.rules].sort((a, b) => (b.priority || 0) - (a.priority || 0));

    for (const rule of sorted) {
      // Check source filter if specified
      if (rule.source && rule.source !== source) continue;

      for (const pattern of rule.patterns) {
        try {
          if (new RegExp(pattern, 'i').test(message)) {
            return {
              tier: rule.tier,
              reason: rule.description,
              pattern
            };
          }
        } catch (err) {
          // Invalid regex, skip
          console.error(`Invalid regex pattern: ${pattern}`, err);
        }
      }
    }

    // LLM fallback for ambiguous messages
    if (this.rules.defaults.llm_fallback) {
      return this.llmClassify(message, source);
    }

    return { tier: this.rules.defaults.tier, reason: 'default' };
  }

  async llmClassify(message, source) {
    // Call local LLM for classification
    const prompt = `Classify this notification into exactly one tier:
- critical: requires immediate human attention (errors, security, interactive prompts, crashes)
- high: important but can wait up to 1 hour (task failures, review results, job failures)
- medium: routine update, can wait 3 hours (completions, status updates, routine work)

Source: ${source}
Message: ${message}

Reply with ONLY the tier name: critical, high, or medium`;

    try {
      // Use native fetch (Node 18+)
      const response = await fetch('http://127.0.0.1:1234/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.rules.defaults.llm_model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 10,
          timeout: 5000
        })
      });

      if (!response.ok) {
        throw new Error(`LLM API error: ${response.status}`);
      }

      const data = await response.json();
      const tier = data.choices[0].message.content.trim().toLowerCase();

      if (['critical', 'high', 'medium'].includes(tier)) {
        return { tier, reason: 'llm_classified' };
      }
    } catch (err) {
      // LLM unavailable or error, use default
      console.error('LLM classification failed:', err.message);
    }

    return { tier: this.rules.defaults.tier, reason: 'default_fallback' };
  }
}

module.exports = new NotificationClassifier();
