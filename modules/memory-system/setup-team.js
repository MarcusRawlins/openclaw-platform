/**
 * Team Memory Setup Script
 * Initializes memory system for all agents
 * Creates directories, state files, and validates boot configuration
 */

const fs = require('fs');
const path = require('path');

const AGENTS = ['brunel', 'scout', 'ada', 'ed', 'dewey', 'walt'];
const AGENTS_DIR = '/Users/marcusrawlins/.openclaw/agents';
const WORKSPACE_DIR = '/Users/marcusrawlins/.openclaw/workspace';
const ARCHIVE_BASE = '/Volumes/reeseai-memory/agents';

class TeamMemorySetup {
  /**
   * Setup memory system for a single agent
   */
  setupAgent(agentId) {
    console.log(`\n🔧 Setting up ${agentId}...`);

    const agentDir = path.join(AGENTS_DIR, agentId);
    const memoryDir = path.join(agentDir, 'memory');
    const archiveDir = path.join(ARCHIVE_BASE, agentId, 'memory-archive');

    // Create memory directory
    fs.mkdirSync(memoryDir, { recursive: true });

    // Create state.json
    const statePath = path.join(memoryDir, 'state.json');
    if (!fs.existsSync(statePath)) {
      const defaultState = {
        lastChecks: {
          email: null,
          calendar: null,
          weather: null,
          error_log_scan: null,
          security_audit: null,
          daily_maintenance: null
        },
        lastSynthesis: null,
        corruptionRecovery: false,
        version: 1,
        agentId
      };
      fs.writeFileSync(statePath, JSON.stringify(defaultState, null, 2));
      console.log(`  ✓ Created ${agentId}/memory/state.json`);
    } else {
      console.log(`  ✓ ${agentId}/memory/state.json exists`);
    }

    // Create archive directory
    fs.mkdirSync(archiveDir, { recursive: true });

    // Verify AGENTS.md exists and is lean
    const agentsFile = path.join(agentDir, 'AGENTS.md');
    if (fs.existsSync(agentsFile)) {
      const lines = fs.readFileSync(agentsFile, 'utf-8').split('\n').length;
      if (lines > 60) {
        console.warn(`  ⚠️  AGENTS.md is ${lines} lines (target: ~50)`);
      } else {
        console.log(`  ✓ AGENTS.md is lean (${lines} lines)`);
      }
    } else {
      console.warn(`  ⚠️  AGENTS.md missing`);
    }

    // Verify lessons.md exists and is under 20 lessons
    const lessonsFile = path.join(agentDir, 'lessons.md');
    if (fs.existsSync(lessonsFile)) {
      const content = fs.readFileSync(lessonsFile, 'utf-8');
      const lessonCount = (content.match(/^## Lesson/gm) || []).length;
      if (lessonCount > 20) {
        console.warn(`  ⚠️  lessons.md has ${lessonCount} lessons (max: 20)`);
      } else {
        console.log(`  ✓ lessons.md lean (${lessonCount} lessons)`);
      }
    } else {
      console.warn(`  ⚠️  lessons.md missing`);
    }

    return {
      agentId,
      memoryDir,
      archiveDir,
      statePath
    };
  }

  /**
   * Setup Marcus (workspace) memory system
   */
  setupMarcus() {
    console.log(`\n🔧 Setting up Marcus (workspace)...`);

    const memoryDir = path.join(WORKSPACE_DIR, 'memory');
    const archiveDir = path.join(ARCHIVE_BASE, 'marcus', 'memory-archive');

    // Create memory directory
    fs.mkdirSync(memoryDir, { recursive: true });

    // Create heartbeat-state.json
    const statePath = path.join(memoryDir, 'heartbeat-state.json');
    if (!fs.existsSync(statePath)) {
      const defaultState = {
        lastChecks: {
          email: null,
          calendar: null,
          weather: null,
          error_log_scan: null,
          security_audit: null,
          daily_maintenance: null
        },
        lastSynthesis: null,
        corruptionRecovery: false,
        version: 1,
        agentId: 'main'
      };
      fs.writeFileSync(statePath, JSON.stringify(defaultState, null, 2));
      console.log(`  ✓ Created workspace/memory/heartbeat-state.json`);
    } else {
      console.log(`  ✓ workspace/memory/heartbeat-state.json exists`);
    }

    // Create archive directory
    fs.mkdirSync(archiveDir, { recursive: true });

    // Verify MEMORY.md exists
    const memoryFile = path.join(WORKSPACE_DIR, 'MEMORY.md');
    if (fs.existsSync(memoryFile)) {
      const lines = fs.readFileSync(memoryFile, 'utf-8').split('\n').length;
      console.log(`  ✓ MEMORY.md exists (${lines} lines)`);
    } else {
      // Create empty MEMORY.md
      fs.writeFileSync(memoryFile, '# MEMORY.md — Marcus\'s Long-Term Memory\n\n');
      console.log(`  ✓ Created MEMORY.md`);
    }

    // Verify boot files
    const bootFiles = ['SOUL.md', 'USER.md', 'AGENTS.md', 'TOOLS.md'];
    for (const file of bootFiles) {
      const filePath = path.join(WORKSPACE_DIR, file);
      if (fs.existsSync(filePath)) {
        const lines = fs.readFileSync(filePath, 'utf-8').split('\n').length;
        console.log(`  ✓ ${file} (${lines} lines)`);
      } else {
        console.warn(`  ⚠️  ${file} missing`);
      }
    }

    return { agentId: 'main', memoryDir, archiveDir, statePath };
  }

  /**
   * Verify directory structure
   */
  verifyStructure() {
    console.log(`\n📁 Verifying directory structure...`);

    const checks = [
      { path: AGENTS_DIR, name: 'AGENTS_DIR' },
      { path: WORKSPACE_DIR, name: 'WORKSPACE_DIR' },
      { path: ARCHIVE_BASE, name: 'ARCHIVE_BASE' }
    ];

    for (const check of checks) {
      if (fs.existsSync(check.path)) {
        console.log(`  ✓ ${check.name}: ${check.path}`);
      } else {
        console.error(`  ❌ ${check.path} does not exist`);
        return false;
      }
    }

    return true;
  }

  /**
   * Run complete setup
   */
  run() {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 TEAM MEMORY SYSTEM SETUP');
    console.log('='.repeat(60));

    // Verify structure first
    if (!this.verifyStructure()) {
      console.error('\n❌ Directory structure invalid');
      return false;
    }

    // Setup Marcus
    const marcusSetup = this.setupMarcus();

    // Setup all agents
    const agentSetups = [];
    for (const agent of AGENTS) {
      const setup = this.setupAgent(agent);
      agentSetups.push(setup);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ SETUP COMPLETE');
    console.log('='.repeat(60));

    console.log('\nMemory System Configured:');
    console.log(`  Marcus (workspace): ${marcusSetup.memoryDir}`);
    for (const setup of agentSetups) {
      console.log(`  ${setup.agentId}: ${setup.memoryDir}`);
    }

    console.log('\nArchive Locations:');
    console.log(`  Marcus: ${marcusSetup.archiveDir}`);
    for (const setup of agentSetups) {
      console.log(`  ${setup.agentId}: ${setup.archiveDir}`);
    }

    console.log('\nNext Steps:');
    console.log('  1. Run: node setup-team.js verify (to validate setup)');
    console.log('  2. Add to cron: Weekly synthesis on Sunday 3 AM');
    console.log('  3. Read SKILL.md for API integration examples');

    return true;
  }

  /**
   * Verify existing setup
   */
  verify() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 MEMORY SYSTEM VERIFICATION');
    console.log('='.repeat(60));

    let issuesFound = 0;

    // Check Marcus setup
    console.log('\n🔍 Marcus (workspace):');
    const memoryDir = path.join(WORKSPACE_DIR, 'memory');
    if (fs.existsSync(memoryDir)) {
      console.log(`  ✓ memory/ directory exists`);
      const notes = fs.readdirSync(memoryDir).filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.md$/));
      console.log(`    ${notes.length} daily note files`);
    } else {
      console.error(`  ❌ memory/ directory missing`);
      issuesFound++;
    }

    // Check agents
    for (const agentId of AGENTS) {
      console.log(`\n🔍 ${agentId}:`);

      const agentDir = path.join(AGENTS_DIR, agentId);
      if (!fs.existsSync(agentDir)) {
        console.error(`  ❌ Agent directory missing`);
        issuesFound++;
        continue;
      }

      const memoryDir = path.join(agentDir, 'memory');
      if (fs.existsSync(memoryDir)) {
        console.log(`  ✓ memory/ directory exists`);
        const notes = fs.readdirSync(memoryDir).filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.md$/));
        console.log(`    ${notes.length} daily note files`);
      } else {
        console.warn(`  ⚠️  memory/ directory missing`);
        issuesFound++;
      }

      const statePath = path.join(memoryDir, 'state.json');
      if (fs.existsSync(statePath)) {
        console.log(`  ✓ state.json exists`);
      } else {
        console.warn(`  ⚠️  state.json missing`);
        issuesFound++;
      }

      const agentsFile = path.join(agentDir, 'AGENTS.md');
      if (fs.existsSync(agentsFile)) {
        const lines = fs.readFileSync(agentsFile, 'utf-8').split('\n').length;
        const ok = lines <= 60 ? '✓' : '⚠️ ';
        console.log(`  ${ok} AGENTS.md (${lines} lines)`);
        if (lines > 60) issuesFound++;
      }

      const lessonsFile = path.join(agentDir, 'lessons.md');
      if (fs.existsSync(lessonsFile)) {
        const lessons = (fs.readFileSync(lessonsFile, 'utf-8').match(/^## Lesson/gm) || []).length;
        const ok = lessons <= 20 ? '✓' : '⚠️ ';
        console.log(`  ${ok} lessons.md (${lessons} lessons)`);
        if (lessons > 20) issuesFound++;
      }
    }

    console.log('\n' + '='.repeat(60));
    if (issuesFound === 0) {
      console.log('✅ All systems nominal');
    } else {
      console.log(`⚠️  ${issuesFound} issues found`);
    }
    console.log('='.repeat(60));

    return issuesFound === 0;
  }
}

// CLI
if (require.main === module) {
  const action = process.argv[2] || 'setup';

  const setup = new TeamMemorySetup();

  if (action === 'verify') {
    setup.verify();
  } else {
    const success = setup.run();
    if (!success) {
      process.exit(1);
    }
  }
}

module.exports = TeamMemorySetup;
