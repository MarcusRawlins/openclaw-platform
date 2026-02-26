/**
 * Agent Boot Loader
 * Determines what memory files to load based on context
 * Keeps agents lean by loading only what's needed for the current context
 */

const fs = require('fs');
const path = require('path');

class AgentBootLoader {
  /**
   * Get boot files for an agent based on context
   * @param {string} agentId - Agent identifier
   * @param {object} context - Context info: { isDirect, isGroupChat, isMainSession }
   * @returns {object} Files to load with categories
   */
  getBootFiles(agentId, context = {}) {
    const agentDir = agentId === 'main'
      ? '/Users/marcusrawlins/.openclaw/workspace'
      : `/Users/marcusrawlins/.openclaw/agents/${agentId}`;

    const workspaceDir = '/Users/marcusrawlins/.openclaw/workspace';

    const files = {
      identity: [
        path.join(agentDir, 'AGENTS.md'),    // Identity (~50 lines)
        path.join(agentDir, 'lessons.md')     // Active lessons (~20 lines)
      ],
      mainSessionOnly: [
        path.join(workspaceDir, 'MEMORY.md'),
        path.join(workspaceDir, 'SOUL.md'),
        path.join(workspaceDir, 'USER.md'),
        path.join(workspaceDir, 'TOOLS.md')
      ],
      recentContext: this.getRecentDailyNotes(agentId)
    };

    // Group chats: ONLY load identity (no personal data)
    if (context.isGroupChat) {
      return {
        essential: files.identity,
        optional: [],
        reason: 'group chat context'
      };
    }

    // Main session with Marcus: load everything
    if (agentId === 'main' && context.isMainSession) {
      return {
        essential: files.identity,
        optional: [...files.mainSessionOnly, ...files.recentContext],
        reason: 'main session - full context'
      };
    }

    // Direct context (other agents): identity + recent memory
    if (context.isDirect) {
      return {
        essential: files.identity,
        optional: files.recentContext,
        reason: 'direct context'
      };
    }

    // Default: lean boot
    return {
      essential: files.identity,
      optional: [],
      reason: 'default lean boot'
    };
  }

  /**
   * Get paths to recent daily notes (today + yesterday)
   */
  getRecentDailyNotes(agentId) {
    const memoryDir = agentId === 'main'
      ? '/Users/marcusrawlins/.openclaw/workspace/memory'
      : `/Users/marcusrawlins/.openclaw/agents/${agentId}/memory`;

    const notes = [];
    const today = new Date();

    for (let i = 0; i < 2; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const notePath = path.join(memoryDir, `${dateStr}.md`);

      if (fs.existsSync(notePath)) {
        notes.push(notePath);
      }
    }

    return notes;
  }

  /**
   * Load boot files and return content
   */
  loadBootFiles(agentId, context = {}) {
    const bootConfig = this.getBootFiles(agentId, context);
    const loaded = {
      identity: [],
      optional: [],
      missing: []
    };

    // Load essential files
    for (const file of bootConfig.essential) {
      try {
        if (fs.existsSync(file)) {
          loaded.identity.push({
            path: file,
            name: path.basename(file),
            content: fs.readFileSync(file, 'utf-8')
          });
        } else {
          loaded.missing.push(file);
        }
      } catch (err) {
        loaded.missing.push(file);
      }
    }

    // Load optional files (ignore missing)
    for (const file of bootConfig.optional) {
      try {
        if (fs.existsSync(file)) {
          loaded.optional.push({
            path: file,
            name: path.basename(file),
            content: fs.readFileSync(file, 'utf-8')
          });
        }
      } catch (err) {
        // Optional files can fail silently
      }
    }

    return {
      ...loaded,
      reason: bootConfig.reason,
      tokenEstimate: this.estimateTokenCost(loaded)
    };
  }

  /**
   * Estimate token cost of loaded files
   */
  estimateTokenCost(loaded) {
    let totalChars = 0;

    for (const file of loaded.identity) {
      totalChars += (file.content || '').length;
    }

    for (const file of loaded.optional) {
      totalChars += (file.content || '').length;
    }

    // Rough estimate: ~4 chars per token
    return Math.ceil(totalChars / 4);
  }

  /**
   * Log boot sequence (for debugging)
   */
  logBootSequence(agentId, context, loaded) {
    console.log(`\n📥 Boot Loader: ${agentId}`);
    console.log(`Context: ${loaded.reason}`);
    console.log(`Essential files loaded: ${loaded.identity.length}`);
    console.log(`Optional files loaded: ${loaded.optional.length}`);
    console.log(`Missing files: ${loaded.missing.length}`);
    console.log(`Estimated tokens: ${loaded.tokenEstimate}`);

    if (loaded.missing.length > 0) {
      console.warn(`⚠️  Missing files:`);
      for (const file of loaded.missing) {
        console.warn(`  - ${file}`);
      }
    }
  }
}

module.exports = new AgentBootLoader();

// CLI for testing
if (require.main === module) {
  const loader = new AgentBootLoader();
  const agentId = process.argv[2] || 'main';
  const context = {
    isDirect: true,
    isGroupChat: false,
    isMainSession: agentId === 'main'
  };

  const loaded = loader.loadBootFiles(agentId, context);
  loader.logBootSequence(agentId, context, loaded);
  console.log('\n✓ Boot sequence complete');
}
