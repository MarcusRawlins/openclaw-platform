/**
 * State Tracker
 * Maintains heartbeat-state.json with last check timestamps
 * Includes corruption detection and recovery
 */

const fs = require('fs');
const path = require('path');

class StateTracker {
  constructor(agentId = 'main') {
    this.agentId = agentId;
    this.statePath = this.getStatePath(agentId);
    this.state = this.load();
  }

  /**
   * Get path to state file for agent
   */
  getStatePath(agentId) {
    if (agentId === 'main' || agentId === 'marcus') {
      return '/Users/marcusrawlins/.openclaw/workspace/memory/heartbeat-state.json';
    }
    return `/Users/marcusrawlins/.openclaw/agents/${agentId}/memory/heartbeat-state.json`;
  }

  /**
   * Load state from disk with corruption detection
   */
  load() {
    try {
      if (fs.existsSync(this.statePath)) {
        const content = fs.readFileSync(this.statePath, 'utf-8');
        const data = JSON.parse(content);
        return this.validate(data);
      }
    } catch (err) {
      console.warn(`⚠️  State file corrupted or invalid: ${err.message}`);
      this.state = this.getDefaultState();
      this.state.corruptionRecovery = true;
      this.save(); // Write clean state
      return this.state;
    }

    return this.getDefaultState();
  }

  /**
   * Validate state structure
   */
  validate(data) {
    // Check for minimum required structure
    if (!data || typeof data !== 'object' || !data.lastChecks) {
      console.warn('⚠️  Invalid state structure, resetting to defaults');
      return this.getDefaultState();
    }

    // Ensure all check fields exist
    const defaults = this.getDefaultState();
    const validated = {
      ...data,
      lastChecks: { ...defaults.lastChecks, ...data.lastChecks },
      version: data.version || 1
    };

    return validated;
  }

  /**
   * Get default state structure
   */
  getDefaultState() {
    return {
      lastChecks: {
        email: null,
        calendar: null,
        weather: null,
        error_log_scan: null,
        security_audit: null,
        daily_maintenance: null,
        // Custom checks per agent can be added
      },
      lastSynthesis: null,
      corruptionRecovery: false,
      version: 1,
      agentId: this.agentId
    };
  }

  /**
   * Save state to disk atomically
   */
  save() {
    try {
      const dir = path.dirname(this.statePath);
      fs.mkdirSync(dir, { recursive: true });

      // Write to temp file first (atomic)
      const tmpPath = this.statePath + '.tmp';
      fs.writeFileSync(tmpPath, JSON.stringify(this.state, null, 2), 'utf-8');

      // Atomic rename
      fs.renameSync(tmpPath, this.statePath);
    } catch (err) {
      console.error(`❌ Failed to save state: ${err.message}`);
    }
  }

  /**
   * Record a check completion
   */
  recordCheck(checkName) {
    if (!this.state.lastChecks.hasOwnProperty(checkName)) {
      this.state.lastChecks[checkName] = null; // Initialize if missing
    }
    this.state.lastChecks[checkName] = Date.now();
    this.save();
    return this.state.lastChecks[checkName];
  }

  /**
   * Get last check timestamp for a check type
   */
  getLastCheck(checkName) {
    return this.state.lastChecks[checkName] || null;
  }

  /**
   * Check if enough time has passed to run a check
   */
  shouldCheck(checkName, intervalMs) {
    const last = this.getLastCheck(checkName);
    if (!last) return true; // Never run, should run now
    return (Date.now() - last) > intervalMs;
  }

  /**
   * Get seconds since last check
   */
  secondsSinceCheck(checkName) {
    const last = this.getLastCheck(checkName);
    if (!last) return Infinity;
    return Math.floor((Date.now() - last) / 1000);
  }

  /**
   * Record synthesis completion
   */
  recordSynthesis() {
    this.state.lastSynthesis = Date.now();
    this.save();
  }

  /**
   * Get all check statuses
   */
  getCheckStatuses() {
    const checks = {};
    const now = Date.now();

    for (const [checkName, timestamp] of Object.entries(this.state.lastChecks)) {
      checks[checkName] = {
        timestamp,
        secondsAgo: timestamp ? Math.floor((now - timestamp) / 1000) : null,
        hoursAgo: timestamp ? Math.floor((now - timestamp) / (1000 * 60 * 60)) : null
      };
    }

    return checks;
  }

  /**
   * Get synthesis status
   */
  getSynthesisStatus() {
    if (!this.state.lastSynthesis) {
      return {
        lastRun: null,
        secondsAgo: null,
        daysAgo: null,
        isDueForSynthesis: true
      };
    }

    const now = Date.now();
    const secondsAgo = Math.floor((now - this.state.lastSynthesis) / 1000);
    const daysAgo = Math.floor(secondsAgo / (24 * 60 * 60));

    // Weekly = 7 days
    const isDueForSynthesis = daysAgo >= 7;

    return {
      lastRun: new Date(this.state.lastSynthesis),
      secondsAgo,
      daysAgo,
      isDueForSynthesis
    };
  }

  /**
   * Reset state (for testing/recovery)
   */
  reset() {
    this.state = this.getDefaultState();
    this.save();
    return this.state;
  }

  /**
   * Print status (for debugging)
   */
  printStatus() {
    console.log(`\n📊 State Status (${this.agentId}):`);
    console.log(`  Path: ${this.statePath}`);
    console.log(`  Version: ${this.state.version}`);
    console.log(`  Recovery mode: ${this.state.corruptionRecovery}`);

    const checks = this.getCheckStatuses();
    console.log(`\n  Last Checks:`);
    for (const [checkName, info] of Object.entries(checks)) {
      const status = info.secondsAgo === null ? 'never' : `${info.hoursAgo}h ago`;
      console.log(`    ${checkName}: ${status}`);
    }

    const synthesis = this.getSynthesisStatus();
    const syncStatus = synthesis.lastRun
      ? `${synthesis.daysAgo}d ago`
      : 'never';
    console.log(`\n  Last Synthesis: ${syncStatus}`);
  }
}

module.exports = StateTracker;

// CLI for testing
if (require.main === module) {
  const agentId = process.argv[2] || 'main';
  const action = process.argv[3] || 'status';

  const tracker = new StateTracker(agentId);

  if (action === 'record') {
    const checkName = process.argv[4] || 'test_check';
    tracker.recordCheck(checkName);
    console.log(`✓ Recorded check: ${checkName}`);
  } else if (action === 'check') {
    const checkName = process.argv[4] || 'email';
    const interval = parseInt(process.argv[5] || '3600000'); // 1 hour
    const shouldRun = tracker.shouldCheck(checkName, interval);
    console.log(`${checkName}: should run = ${shouldRun}`);
    const secondsAgo = tracker.secondsSinceCheck(checkName);
    console.log(`  (last run ${secondsAgo === Infinity ? 'never' : secondsAgo + 's ago'})`);
  } else if (action === 'reset') {
    tracker.reset();
    console.log('✓ State reset to defaults');
  } else {
    tracker.printStatus();
  }
}
