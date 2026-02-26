const fetch = require('node-fetch');
const config = require('./config.json');

class IdeaSummarizer {
  constructor() {
    this.lmStudioUrl = config.embeddings.url;
    this.model = config.summarization.model;
    this.temperature = config.summarization.temperature;
    this.timeout = config.summarization.timeout_ms;
  }

  // Generate a summary of the content idea using LM Studio
  async generateSummary(ideaText, kbSources = [], socialSources = {}) {
    try {
      // Build context from sources
      const kbContext = this._formatKBContext(kbSources);
      const socialContext = this._formatSocialContext(socialSources);

      const prompt = `You are a content strategist. Generate a structured content idea summary.

**Idea Topic:** ${ideaText}

**Knowledge Base Context:**
${kbContext}

**Social Discourse:**
${socialContext}

Generate a JSON response with these exact fields:
{
  "title": "Catchy, clear title for the content",
  "description": "2-3 sentence description of the content idea",
  "targetAudience": "Who should see this content",
  "suggestedOutline": "5-7 bullet point outline",
  "platform": "instagram|tiktok|youtube|blog - recommended platform",
  "contentType": "reel|carousel|video|article - specific format"
}

Be specific and actionable. Return ONLY the JSON object.`;

      const response = await this._callLLM(prompt);
      const summary = this._parseJSON(response);

      if (!summary) {
        throw new Error('Failed to parse LLM response');
      }

      return {
        success: true,
        summary,
        model: this.model
      };
    } catch (error) {
      console.error('Summary generation failed:', error.message);
      return {
        success: false,
        error: error.message,
        summary: this._generateFallbackSummary(ideaText)
      };
    }
  }

  // Call LM Studio API
  async _callLLM(prompt) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.lmStudioUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: this.temperature,
          max_tokens: 500
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`LM Studio HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid LM Studio response format');
      }

      return data.choices[0].message.content;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`LLM request timeout (${this.timeout}ms)`);
      }
      throw error;
    }
  }

  // Parse JSON from LLM response
  _parseJSON(text) {
    // Try to extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    try {
      const json = JSON.parse(jsonMatch[0]);

      // Validate required fields
      const required = ['title', 'description', 'targetAudience', 'suggestedOutline', 'platform', 'contentType'];
      for (const field of required) {
        if (!json[field]) {
          json[field] = '';
        }
      }

      return {
        title: String(json.title).substring(0, 200),
        description: String(json.description).substring(0, 500),
        targetAudience: String(json.targetAudience).substring(0, 200),
        suggestedOutline: String(json.suggestedOutline).substring(0, 1000),
        platform: String(json.platform).toLowerCase(),
        contentType: String(json.contentType).toLowerCase()
      };
    } catch (error) {
      return null;
    }
  }

  // Format KB sources for prompt
  _formatKBContext(sources) {
    if (!sources || sources.length === 0) {
      return '(No relevant knowledge base sources found)';
    }

    return sources
      .slice(0, 5)
      .map(s => {
        const preview = s.chunks[0]?.preview || s.chunks[0]?.text || '';
        return `- "${s.title}" (${s.type}): ${preview.substring(0, 100)}...`;
      })
      .join('\n');
  }

  // Format social sources for prompt
  _formatSocialContext(sources) {
    const context = [];

    if (sources.youtube && sources.youtube.length > 0) {
      context.push(`- YouTube: ${sources.youtube.length} recent videos on topic`);
    }

    if (sources.instagram && sources.instagram.length > 0) {
      context.push(`- Instagram: ${sources.instagram.length} trending posts`);
    }

    if (sources.twitter && sources.twitter.length > 0) {
      context.push(`- Twitter: ${sources.twitter.length} recent discussions`);
    }

    return context.length > 0 ? context.join('\n') : '(No social platform data available)';
  }

  // Fallback summary when LLM fails
  _generateFallbackSummary(ideaText) {
    const titleParts = ideaText.split(' ').slice(0, 4).join(' ');

    return {
      title: `Content: ${titleParts}`,
      description: `Create content about: ${ideaText}`,
      targetAudience: 'General audience',
      suggestedOutline: `
- Introduction to topic
- Key points and insights
- Examples and case studies
- Call to action
- Conclusion`,
      platform: 'instagram',
      contentType: 'post'
    };
  }
}

module.exports = IdeaSummarizer;
