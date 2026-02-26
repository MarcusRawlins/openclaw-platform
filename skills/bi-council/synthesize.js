#!/usr/bin/env node

const Database = require('better-sqlite3');
const fetch = global.fetch || require('node-fetch');
const path = require('path');

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:18789';
const COUNCIL_DB = path.join('/Volumes/reeseai-memory/data/bi-council', 'council-history.db');

class Synthesizer {
  constructor() {
    this.db = new Database(COUNCIL_DB);
  }

  async synthesize(sessionId) {
    console.log('\n' + '━'.repeat(50));
    console.log('  🧠 SYNTHESIS LAYER (Marcus)');
    console.log('━'.repeat(50) + '\n');

    // Get all expert analyses
    const analyses = this.db.prepare(`
      SELECT * FROM expert_analyses WHERE session_id = ? ORDER BY expert_name
    `).all(sessionId);

    // Get all recommendations (ranked)
    const recommendations = this.db.prepare(`
      SELECT * FROM recommendations 
      WHERE session_id = ?
      ORDER BY combined_rank DESC
      LIMIT 15
    `).all(sessionId);

    console.log(`  Merging ${analyses.length} expert perspectives...`);
    console.log(`  Ranking ${recommendations.length} recommendations...\n`);

    // Generate synthesis
    const synthesis = await this.generateSynthesis(analyses, recommendations);

    // Store synthesis
    try {
      this.db.prepare(`
        INSERT INTO synthesis (session_id, executive_summary, key_metrics, risk_alerts, cross_domain_insights)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        sessionId,
        synthesis.executiveSummary,
        JSON.stringify(synthesis.keyMetrics),
        JSON.stringify(synthesis.riskAlerts),
        JSON.stringify(synthesis.crossDomainInsights)
      );
    } catch (err) {
      console.error(`  ✗ Failed to store synthesis: ${err.message}`);
    }

    console.log('  ✓ Synthesis complete\n');

    return {
      sessionId,
      ...synthesis,
      topRecommendations: recommendations.slice(0, 5)
    };
  }

  async generateSynthesis(analyses, recommendations) {
    const prompt = this._buildSynthesisPrompt(analyses, recommendations);

    try {
      const response = await this._callSonnet(prompt);
      return this._parseSynthesis(response);
    } catch (err) {
      console.error(`  ✗ Synthesis failed: ${err.message}`);
      return {
        executiveSummary: 'Synthesis generation failed',
        keyMetrics: { health: 'unknown' },
        riskAlerts: [],
        crossDomainInsights: []
      };
    }
  }

  _buildSynthesisPrompt(analyses, recommendations) {
    const analysisText = analyses.map(a => `
**${a.expert_name}:**
- Risk Level: ${a.risk_level}
- Insights: ${a.analysis_text}
`).join('\n');

    const recommendationText = recommendations.slice(0, 10).map((r, i) => `
${i + 1}. [${r.expert_name}] ${r.recommendation_text}
   Impact: ${r.impact_score}/10 | Urgency: ${r.urgency_score}/10
   Rationale: ${r.rationale}
`).join('\n');

    return `You are Marcus, synthesizing findings from the Business Intelligence Council.

**Expert Analyses:**
${analysisText}

**Top Recommendations (pre-ranked by impact × urgency):**
${recommendationText}

**Your Task:** Create a strategic synthesis that merges the council's findings.

RESPOND WITH ONLY THIS JSON (no markdown, no explanation):
{
  "executiveSummary": "One paragraph capturing overall business state and primary strategic direction",
  "keyMetrics": {
    "overallHealth": "excellent|good|fair|concerning|critical",
    "primaryTrend": "growth|stability|decline|uncertain",
    "urgentIssues": 0
  },
  "riskAlerts": [
    {"source": "expert name", "issue": "brief issue description", "severity": "high|medium|low"}
  ],
  "crossDomainInsights": [
    "Pattern or insight visible across multiple expert perspectives"
  ]
}`;
  }

  async _callSonnet(prompt) {
    try {
      const response = await fetch(`${GATEWAY_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'anthropic/claude-sonnet-4-5',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 1500
        })
      });

      if (!response.ok) {
        throw new Error(`Gateway returned ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (err) {
      console.error(`  ⚠ Gateway failed: ${err.message}`);
      // Return minimal synthesis on failure
      throw err;
    }
  }

  _parseSynthesis(response) {
    try {
      let json = response;

      const codeBlockMatch = response.match(/```(?:json)?\n([\s\S]*?)\n```/);
      if (codeBlockMatch) {
        json = codeBlockMatch[1];
      } else {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          json = jsonMatch[0];
        }
      }

      const parsed = JSON.parse(json);

      return {
        executiveSummary: parsed.executiveSummary || 'No summary available',
        keyMetrics: parsed.keyMetrics || { health: 'unknown' },
        riskAlerts: parsed.riskAlerts || [],
        crossDomainInsights: parsed.crossDomainInsights || []
      };
    } catch (err) {
      console.error(`  ✗ Failed to parse synthesis: ${err.message}`);
      return {
        executiveSummary: 'Synthesis parsing failed',
        keyMetrics: { health: 'unknown' },
        riskAlerts: [],
        crossDomainInsights: []
      };
    }
  }

  close() {
    this.db.close();
  }
}

// CLI entry point
if (require.main === module) {
  const sessionId = process.argv[2];
  if (!sessionId) {
    console.error('Usage: synthesize <session-id>');
    process.exit(1);
  }

  const synthesizer = new Synthesizer();
  synthesizer.synthesize(parseInt(sessionId))
    .then(() => {
      synthesizer.close();
      process.exit(0);
    })
    .catch(err => {
      console.error('Synthesis failed:', err);
      synthesizer.close();
      process.exit(1);
    });
}

module.exports = { Synthesizer };
