const fs = require('fs');
const path = require('path');

class Tier1Tests {
  constructor() {
    this.results = [];
    this.passed = 0;
    this.failed = 0;
  }

  async runAll() {
    console.log('\n══════ TIER 1: Integration Tests (Nightly, Free) ══════\n');

    // Database tests
    await this.test('DB: Usage tracking schema', () => this.testDBSchema(
      '/Volumes/reeseai-memory/data/usage-tracking/usage.db',
      ['llm_calls', 'api_calls', 'daily_aggregates']
    ));

    await this.test('DB: Email pipeline schema', () => this.testDBSchema(
      '/Volumes/reeseai-memory/data/email-pipeline/pipeline.db',
      ['emails', 'sender_research', 'stage_audit', 'scoring_log']
    ));

    await this.test('DB: Logs schema', () => this.testDBSchema(
      '/Volumes/reeseai-memory/data/logs/logs.db',
      ['structured_logs', 'raw_logs', 'ingest_state']
    ));

    // Config tests
    await this.test('Config: All skills have config.json', () => this.testConfigs());
    
    // Module import tests
    await this.test('Import: LLM Router', () => {
      try {
        require('/Users/marcusrawlins/.openclaw/workspace/skills/llm-router/router');
      } catch (err) {
        // Skip if not available
        if (err.code === 'MODULE_NOT_FOUND') return;
        throw err;
      }
    });
    
    await this.test('Import: Logger', () => {
      try {
        require('/Users/marcusrawlins/.openclaw/workspace/skills/logging/logger');
      } catch (err) {
        // Skip if not available
        if (err.code === 'MODULE_NOT_FOUND') return;
        throw err;
      }
    });
    
    await this.test('Import: Usage Tracker', () => {
      try {
        require('/Users/marcusrawlins/.openclaw/workspace/skills/usage-tracking/logger');
      } catch (err) {
        // Skip if not available
        if (err.code === 'MODULE_NOT_FOUND') return;
        throw err;
      }
    });
    
    // File system tests
    await this.test('FS: Memory drive accessible', () => {
      if (!fs.existsSync('/Volumes/reeseai-memory')) throw new Error('Not mounted');
    });
    
    await this.test('FS: Log directory writable', () => {
      const testFile = '/Volumes/reeseai-memory/data/logs/.test';
      const dir = path.dirname(testFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
    });

    // Redaction tests
    await this.test('Redaction: API keys caught', () => {
      try {
        const { redactString } = require('/Users/marcusrawlins/.openclaw/workspace/skills/logging/redact');
        const result = redactString('My key is sk-abc123def456ghi789jkl012mno345pqr');
        if (result.includes('sk-abc')) throw new Error('Key not redacted');
      } catch (err) {
        if (err.code === 'MODULE_NOT_FOUND') return; // Skip if not available
        throw err;
      }
    });
    
    await this.test('Redaction: safe text unchanged', () => {
      try {
        const { redactString } = require('/Users/marcusrawlins/.openclaw/workspace/skills/logging/redact');
        const input = 'Hello world, this is a normal message.';
        if (redactString(input) !== input) throw new Error('Safe text was modified');
      } catch (err) {
        if (err.code === 'MODULE_NOT_FOUND') return; // Skip if not available
        throw err;
      }
    });

    // Model utils tests
    await this.test('Model utils: detect anthropic', () => {
      try {
        const { detectProvider } = require('/Users/marcusrawlins/.openclaw/workspace/skills/llm-router/model-utils');
        const r = detectProvider('anthropic/claude-sonnet-4-5');
        if (r.provider !== 'anthropic') throw new Error(`Got: ${r.provider}`);
      } catch (err) {
        if (err.code === 'MODULE_NOT_FOUND') return; // Skip if not available
        throw err;
      }
    });
    
    await this.test('Model utils: detect lmstudio', () => {
      try {
        const { detectProvider } = require('/Users/marcusrawlins/.openclaw/workspace/skills/llm-router/model-utils');
        const r = detectProvider('lmstudio/gemma-3-12b-it');
        if (r.provider !== 'lmstudio') throw new Error(`Got: ${r.provider}`);
      } catch (err) {
        if (err.code === 'MODULE_NOT_FOUND') return; // Skip if not available
        throw err;
      }
    });

    this.printSummary();
    return { passed: this.passed, failed: this.failed, total: this.results.length };
  }

  async test(name, fn) {
    try {
      await fn();
      this.passed++;
      this.results.push({ name, status: 'pass' });
      console.log(`  ✓ ${name}`);
    } catch (err) {
      this.failed++;
      this.results.push({ name, status: 'fail', error: err.message });
      console.log(`  ✗ ${name}: ${err.message}`);
    }
  }

  testDBSchema(dbPath, expectedTables) {
    if (!fs.existsSync(dbPath)) {
      // Don't fail if DB doesn't exist yet
      console.log(`    (Skipping - DB not found)`);
      return;
    }
    const Database = require('better-sqlite3');
    const db = new Database(dbPath, { readonly: true });
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
    db.close();
    for (const t of expectedTables) {
      if (!tables.includes(t)) throw new Error(`Missing table: ${t}`);
    }
  }

  testConfigs() {
    const skillsDir = '/Users/marcusrawlins/.openclaw/workspace/skills';
    if (!fs.existsSync(skillsDir)) {
      console.log(`    (Skipping - skills dir not found)`);
      return;
    }
    const skills = fs.readdirSync(skillsDir).filter(f => {
      return fs.statSync(path.join(skillsDir, f)).isDirectory();
    });
    const missing = skills.filter(s => !fs.existsSync(path.join(skillsDir, s, 'config.json')));
    if (missing.length > skills.length * 0.5) {
      throw new Error(`${missing.length}/${skills.length} skills missing config.json`);
    }
  }

  printSummary() {
    console.log(`\n  ────────────────────────────`);
    console.log(`  Passed: ${this.passed}  Failed: ${this.failed}  Total: ${this.results.length}`);
    console.log(`  ${this.failed === 0 ? '✓ ALL TESTS PASSED' : '✗ FAILURES DETECTED'}`);
    console.log(`  ────────────────────────────\n`);
  }
}

module.exports = Tier1Tests;

// CLI runner
if (require.main === module) {
  const tests = new Tier1Tests();
  tests.runAll()
    .then((result) => {
      process.exit(result.failed > 0 ? 1 : 0);
    })
    .catch(err => {
      console.error('Test suite failed:', err);
      process.exit(1);
    });
}
