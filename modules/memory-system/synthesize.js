/**
 * Weekly Synthesis Engine
 * Reads daily notes from past 7 days
 * Uses local LLM to identify patterns
 * Updates MEMORY.md with durable insights
 * Archives old daily notes
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const DailyNotesManager = require('./daily-notes');
const StateTracker = require('./state-tracker');

const MEMORY_PATH = '/Users/marcusrawlins/.openclaw/workspace/MEMORY.md';
const MAX_MEMORY_LINES = 100;
const LM_STUDIO_URL = 'http://127.0.0.1:1234/v1/chat/completions';

class MemorySynthesizer {
  /**
   * Run full synthesis for an agent
   */
  async synthesize(agentId = 'main') {
    console.log(`\n🧠 Synthesizing memory for ${agentId}...`);

    try {
      const notes = new DailyNotesManager(agentId);
      const recentNotes = notes.getRecentNotes(7);

      if (recentNotes.length === 0) {
        console.log('⚠️  No recent notes to synthesize');
        return { success: false, reason: 'no notes' };
      }

      console.log(`Found ${recentNotes.length} recent notes`);

      // Read current MEMORY.md
      const currentMemory = fs.existsSync(MEMORY_PATH)
        ? fs.readFileSync(MEMORY_PATH, 'utf-8')
        : '';

      // Generate synthesis using local LLM
      console.log('🤖 Running LLM synthesis...');
      const synthesis = await this.generateSynthesis(recentNotes, currentMemory, agentId);

      // Update MEMORY.md
      const memoryPath = await this.updateMemory(synthesis, currentMemory);
      console.log(`✓ MEMORY.md updated`);

      // Archive old notes (>30 days)
      const archived = notes.archiveOldNotes(30);
      if (archived.archived > 0) {
        console.log(`✓ Archived ${archived.archived} old daily notes`);
      }

      // Record synthesis time
      const tracker = new StateTracker(agentId);
      tracker.recordSynthesis();

      console.log('✓ Synthesis complete');
      return { success: true, synthesis, memoryPath };
    } catch (err) {
      console.error('❌ Synthesis failed:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Generate synthesis using local LLM
   */
  async generateSynthesis(recentNotes, currentMemory, agentId) {
    // Concatenate recent notes
    const notesText = recentNotes.map(n => {
      const lines = n.content.split('\n').slice(1, 50).join('\n'); // First 50 lines
      return `## ${n.date}\n${lines}`;
    }).join('\n\n');

    const prompt = this.buildSynthesisPrompt(notesText, currentMemory, agentId);

    try {
      const response = await fetch(LM_STUDIO_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'mistral', // or whatever local model is available
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 1000
        }),
        timeout: 30000
      });

      if (!response.ok) {
        throw new Error(`LLM returned ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      } else {
        console.warn('⚠️  No JSON found in LLM response');
        return { additions: [], removals: [], summary: 'Unable to parse LLM response' };
      }
    } catch (err) {
      console.error('⚠️  LLM call failed:', err.message);
      // Return empty synthesis on LLM failure - don't break the system
      return { additions: [], removals: [], summary: 'LLM unavailable (using local model fallback)' };
    }
  }

  /**
   * Build synthesis prompt for LLM
   */
  buildSynthesisPrompt(notesText, currentMemory, agentId) {
    return `You are reviewing daily notes from a work week for an AI agent.

AGENT: ${agentId}

CURRENT LONG-TERM MEMORY (stored in MEMORY.md):
${currentMemory.substring(0, 2000)}

---

DAILY NOTES FROM PAST WEEK (raw capture):
${notesText.substring(0, 4000)}

---

Your task:
1. Identify DURABLE patterns (appeared multiple times or key learning)
2. Note new preferences, decisions, or lessons learned
3. Flag outdated information that should be removed
4. Suggest specific additions to long-term memory
5. Suggest specific removals (outdated/incorrect info)

RULES:
- Only add patterns that repeated or were explicitly highlighted
- Never add secrets, API keys, or credentials
- Keep each addition to one concise line
- Total memory must stay under ${MAX_MEMORY_LINES} lines
- Format additions without prefixes (I'll add "- " automatically)

Return ONLY valid JSON (no markdown, no backticks):

{
  "additions": ["insight 1", "insight 2"],
  "removals": ["exact phrase to remove from memory"],
  "summary": "One sentence about what changed this week"
}`;
  }

  /**
   * Update MEMORY.md with synthesis results
   */
  async updateMemory(synthesis, currentMemory) {
    let lines = currentMemory
      .split('\n')
      .filter(l => l.trim()); // Remove empty lines

    // Remove outdated lines
    const additions = synthesis.additions || [];
    const removals = synthesis.removals || [];

    for (const removal of removals) {
      lines = lines.filter(line =>
        !line.toLowerCase().includes(removal.toLowerCase())
      );
    }

    // Add new insights (with "- " prefix if not present)
    for (const addition of additions) {
      const formatted = addition.startsWith('- ')
        ? addition
        : `- ${addition}`;

      if (!lines.includes(formatted)) {
        lines.push(formatted);
      }
    }

    // Enforce size limit
    if (lines.length > MAX_MEMORY_LINES) {
      console.log(`⚠️  MEMORY.md exceeds ${MAX_MEMORY_LINES} lines. Archiving overflow...`);
      const overflow = lines.splice(MAX_MEMORY_LINES);

      // Archive overflow
      const archivePath = `/Volumes/reeseai-memory/agents/marcus/memory-archive/${new Date().toISOString().split('T')[0]}-overflow.md`;
      fs.mkdirSync(path.dirname(archivePath), { recursive: true });
      fs.writeFileSync(archivePath, overflow.join('\n'));
    }

    // Write updated MEMORY.md
    fs.mkdirSync(path.dirname(MEMORY_PATH), { recursive: true });
    fs.writeFileSync(MEMORY_PATH, lines.join('\n') + '\n');

    console.log(`✓ MEMORY.md updated (${lines.length}/${MAX_MEMORY_LINES} lines)`);
    return MEMORY_PATH;
  }

  /**
   * Get synthesis status
   */
  getStatus(agentId = 'main') {
    const notes = new DailyNotesManager(agentId);
    const stats = notes.getStats();
    const tracker = new StateTracker(agentId);

    return {
      agentId,
      lastSynthesis: tracker.state.lastSynthesis
        ? new Date(tracker.state.lastSynthesis)
        : null,
      notesFiles: stats.totalFiles,
      newestNote: stats.newestDate,
      memoryExists: fs.existsSync(MEMORY_PATH),
      memoryLines: fs.existsSync(MEMORY_PATH)
        ? fs.readFileSync(MEMORY_PATH, 'utf-8').split('\n').length
        : 0
    };
  }
}

module.exports = new MemorySynthesizer();

// CLI
if (require.main === module) {
  const agentId = process.argv[2] || 'main';
  const action = process.argv[3] || 'synthesize';

  const synthesizer = new MemorySynthesizer();

  if (action === 'status') {
    const status = synthesizer.getStatus(agentId);
    console.log('\n📊 Synthesis Status:');
    console.log(`  Agent: ${status.agentId}`);
    console.log(`  Last synthesis: ${status.lastSynthesis || 'never'}`);
    console.log(`  Notes files: ${status.notesFiles}`);
    console.log(`  Memory lines: ${status.memoryLines}/${MAX_MEMORY_LINES}`);
  } else {
    synthesizer.synthesize(agentId).then(result => {
      if (result.success) {
        console.log('\n✓ Synthesis successful');
      } else {
        console.log(`\n❌ Synthesis failed: ${result.reason || result.error}`);
        process.exit(1);
      }
    });
  }
}
