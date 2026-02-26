/**
 * Context Gate Module
 * 
 * Determines which files to load based on chat context.
 * Prevents confidential data from leaking into group chats.
 */

const fs = require('fs');
const path = require('path');

class ContextGate {
  constructor(config) {
    this.config = config || this.loadConfig();
  }

  loadConfig() {
    try {
      const configPath = path.join(__dirname, 'config.json');
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (err) {
      console.error('Failed to load config.json:', err.message);
      return this.getDefaultConfig();
    }
  }

  getDefaultConfig() {
    return {
      primary_user_id: 'marcus',
      file_scopes: {
        'AGENTS.md': 'always',
        'SOUL.md': 'always',
        'IDENTITY.md': 'always',
        'USER.md': 'always',
        'TOOLS.md': 'always',
        'MEMORY.md': 'private_only',
        'HEARTBEAT.md': 'heartbeat_only',
        'memory/': 'private_only'
      }
    };
  }

  /**
   * Get list of files that should be loaded for given context
   * 
   * @param {Object} context - Chat context
   * @param {string} context.chat_type - 'direct', 'group', 'channel'
   * @param {string} context.sender_id - User ID of message sender
   * @param {boolean} context.is_heartbeat - Whether this is a heartbeat poll
   * @param {boolean} context.is_private - Explicit private flag
   * @returns {Array<string>} List of file paths to load
   */
  getLoadableFiles(context) {
    const files = [];
    
    const isPrivate = this.isPrivateContext(context);
    const isPrimaryUser = context.sender_id === this.config.primary_user_id;
    const isHeartbeat = context.is_heartbeat === true;

    for (const [file, scope] of Object.entries(this.config.file_scopes)) {
      if (scope === 'always') {
        files.push(file);
      } else if (scope === 'private_only' && isPrivate && isPrimaryUser) {
        files.push(file);
      } else if (scope === 'heartbeat_only' && isHeartbeat) {
        files.push(file);
      }
    }

    return files;
  }

  /**
   * Determine if context is private
   */
  isPrivateContext(context) {
    // Explicit private flag
    if (context.is_private === true) return true;
    
    // Direct message / DM with primary user
    if (context.chat_type === 'direct' || context.chat_type === 'dm') {
      return context.sender_id === this.config.primary_user_id;
    }
    
    return false;
  }

  /**
   * Check if a specific file should be loaded in given context
   */
  shouldLoadFile(filename, context) {
    const loadable = this.getLoadableFiles(context);
    
    // Check exact match
    if (loadable.includes(filename)) return true;
    
    // Check directory prefixes (e.g., memory/2026-02-26.md)
    for (const path of loadable) {
      if (path.endsWith('/') && filename.startsWith(path)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Get files that are blocked in current context (for logging/debugging)
   */
  getBlockedFiles(context) {
    const all = Object.keys(this.config.file_scopes);
    const loadable = this.getLoadableFiles(context);
    return all.filter(f => !loadable.includes(f));
  }

  /**
   * Generate context report
   */
  getContextReport(context) {
    const isPrivate = this.isPrivateContext(context);
    const isPrimaryUser = context.sender_id === this.config.primary_user_id;
    const loadable = this.getLoadableFiles(context);
    const blocked = this.getBlockedFiles(context);

    return {
      context_type: context.chat_type,
      is_private: isPrivate,
      is_primary_user: isPrimaryUser,
      is_heartbeat: context.is_heartbeat || false,
      files_loaded: loadable,
      files_blocked: blocked
    };
  }
}

module.exports = ContextGate;

// CLI / Testing
if (require.main === module) {
  console.log('🚪 Context Gate Test Suite\n');

  const gate = new ContextGate();

  // Test 1: Private context with primary user
  console.log('Test 1: Private DM with primary user');
  const privateContext = {
    chat_type: 'direct',
    sender_id: 'marcus',
    is_heartbeat: false
  };
  const report1 = gate.getContextReport(privateContext);
  console.log(JSON.stringify(report1, null, 2));
  console.log();

  // Test 2: Group chat
  console.log('Test 2: Group chat');
  const groupContext = {
    chat_type: 'group',
    sender_id: 'marcus',
    is_heartbeat: false
  };
  const report2 = gate.getContextReport(groupContext);
  console.log(JSON.stringify(report2, null, 2));
  console.log();

  // Test 3: Heartbeat poll
  console.log('Test 3: Heartbeat poll');
  const heartbeatContext = {
    chat_type: 'direct',
    sender_id: 'marcus',
    is_heartbeat: true
  };
  const report3 = gate.getContextReport(heartbeatContext);
  console.log(JSON.stringify(report3, null, 2));
  console.log();

  // Test 4: Check specific file
  console.log('Test 4: Should load MEMORY.md?');
  console.log('Private context:', gate.shouldLoadFile('MEMORY.md', privateContext));
  console.log('Group context:', gate.shouldLoadFile('MEMORY.md', groupContext));
  console.log();

  // Test 5: Daily memory files
  console.log('Test 5: Should load memory/2026-02-26.md?');
  console.log('Private context:', gate.shouldLoadFile('memory/2026-02-26.md', privateContext));
  console.log('Group context:', gate.shouldLoadFile('memory/2026-02-26.md', groupContext));
}
