#!/usr/bin/env node

// Node 18+ has built-in fetch, fallback for older versions
const fetch = global.fetch || require('node-fetch');

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:18789';
const LM_STUDIO_URL = process.env.LM_STUDIO_URL || 'http://127.0.0.1:1234/v1/chat/completions';

class ExpertAnalyzer {
  constructor(expertConfig) {
    this.name = expertConfig.name;
    this.role = expertConfig.role;
    this.focus = expertConfig.focus;
    this.questions = expertConfig.questions;
    this.getDataSource = expertConfig.dataSource;
  }

  async analyze(crossDomainBrief) {
    console.log(`    🤖 ${this.name} (${this.role})...`);

    try {
      // Get this expert's data
      const data = await this.getDataSource();

      const prompt = this.buildPrompt(data, crossDomainBrief);

      // Call Opus for expert analysis (via OpenClaw)
      const response = await this.callOpus(prompt);

      const analysis = this.parseAnalysis(response);

      console.log(`      ✓ ${analysis.recommendations.length} recommendations`);

      return {
        expert: this.name,
        role: this.role,
        insights: analysis.insights || [],
        riskLevel: analysis.riskLevel || 'none',
        opportunities: analysis.opportunities || [],
        recommendations: analysis.recommendations || [],
        generatedAt: new Date().toISOString()
      };
    } catch (err) {
      console.error(`      ✗ Analysis failed: ${err.message}`);
      return {
        expert: this.name,
        role: this.role,
        insights: ['Analysis failed'],
        riskLevel: 'none',
        opportunities: [],
        recommendations: [],
        error: err.message
      };
    }
  }

  buildPrompt(data, crossDomainBrief) {
    return `You are ${this.name}, a ${this.role} for a wedding photography business.

**Your Focus:** ${this.focus}

**Your Key Questions:**
${this.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

**Data Available to You:**
${typeof data === 'string' ? data : JSON.stringify(data, null, 2)}

**Cross-Domain Context (provided for reference):**
${crossDomainBrief}

**Your Task:**
Analyze the data from your expert perspective. You MUST respond with ONLY a valid JSON object (no markdown, no explanation outside the JSON).

Provide exactly this JSON structure:
{
  "insights": ["key insight 1", "key insight 2", "key insight 3"],
  "riskLevel": "none",
  "riskReasoning": "explanation of risk assessment",
  "opportunities": [
    {"title": "opportunity title", "description": "brief description"}
  ],
  "recommendations": [
    {
      "action": "specific action to take",
      "rationale": "why this matters and evidence",
      "impact": 7,
      "urgency": 6
    }
  ]
}

Rules:
- Be specific and data-driven
- Cite metrics when relevant
- Impact and urgency: 1-10 scale
- Recommendations should be actionable
- Keep insights to 3 max
- Keep opportunities to 3 max
- Keep recommendations to 5 max`;
  }

  async callOpus(prompt) {
    try {
      // Call Claude Opus via OpenClaw gateway
      const response = await fetch(`${GATEWAY_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'anthropic/claude-opus-4-6',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        throw new Error(`Gateway returned ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response from gateway');
      }

      return data.choices[0].message.content;
    } catch (err) {
      // Fallback to local LM Studio if gateway fails
      console.warn(`    ⚠ Gateway failed, trying LM Studio...`);
      return this.callLocalModel(prompt);
    }
  }

  async callLocalModel(prompt) {
    try {
      const response = await fetch(LM_STUDIO_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'qwen2.5:7b',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        throw new Error(`LM Studio returned ${response.status}`);
      }

      const data = await response.json();

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response from LM Studio');
      }

      return data.choices[0].message.content;
    } catch (err) {
      console.error(`    ✗ Local model also failed: ${err.message}`);
      throw err;
    }
  }

  parseAnalysis(response) {
    try {
      // Try to extract JSON from response
      let json = response;

      // Check if wrapped in markdown code block
      const codeBlockMatch = response.match(/```(?:json)?\n([\s\S]*?)\n```/);
      if (codeBlockMatch) {
        json = codeBlockMatch[1];
      } else {
        // Try to find JSON object in response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          json = jsonMatch[0];
        }
      }

      const parsed = JSON.parse(json);

      // Validate structure
      if (!parsed.insights) parsed.insights = [];
      if (!parsed.riskLevel) parsed.riskLevel = 'none';
      if (!parsed.opportunities) parsed.opportunities = [];
      if (!parsed.recommendations) parsed.recommendations = [];

      return parsed;
    } catch (err) {
      console.error(`    ✗ Failed to parse analysis JSON: ${err.message}`);
      console.log(`    Raw response: ${response.substring(0, 200)}...`);

      return {
        insights: ['Analysis parsing failed - invalid JSON response'],
        riskLevel: 'none',
        opportunities: [],
        recommendations: []
      };
    }
  }
}

module.exports = ExpertAnalyzer;
