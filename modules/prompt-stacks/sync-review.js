const fs = require('fs');
const path = require('path');

const PROMPTS_DIR = '/Users/marcusrawlins/.openclaw/workspace/prompts';
const CLAUDE_DIR = path.join(PROMPTS_DIR, 'claude');
const GPT_DIR = path.join(PROMPTS_DIR, 'gpt');
const FACTS_PATH = path.join(PROMPTS_DIR, 'shared', 'facts.json');

class SyncReviewer {
  constructor() {
    this.discrepancies = [];
    this.facts = JSON.parse(fs.readFileSync(FACTS_PATH, 'utf8'));
  }

  review() {
    this.checkFileCoverage();
    this.checkFactsPresence();
    this.checkFactsConsistency();
    return this.discrepancies;
  }

  // Every file in one stack should exist in the other
  checkFileCoverage() {
    const claudeFiles = fs.existsSync(CLAUDE_DIR) ? fs.readdirSync(CLAUDE_DIR) : [];
    const gptFiles = fs.existsSync(GPT_DIR) ? fs.readdirSync(GPT_DIR) : [];

    for (const file of claudeFiles) {
      if (!gptFiles.includes(file)) {
        this.discrepancies.push({
          type: 'missing_file',
          severity: 'error',
          message: `${file} exists in claude/ but not in gpt/`
        });
      }
    }

    for (const file of gptFiles) {
      if (!claudeFiles.includes(file)) {
        this.discrepancies.push({
          type: 'missing_file',
          severity: 'error',
          message: `${file} exists in gpt/ but not in claude/`
        });
      }
    }
  }

  // All facts from facts.json should appear in both stacks
  checkFactsPresence() {
    const factValues = this.extractFactValues(this.facts);
    
    for (const [factKey, factValue] of factValues) {
      for (const [stackName, stackDir] of [['claude', CLAUDE_DIR], ['gpt', GPT_DIR]]) {
        if (!fs.existsSync(stackDir)) continue;
        
        const allContent = this.readAllFiles(stackDir);
        
        if (!allContent.includes(String(factValue))) {
          this.discrepancies.push({
            type: 'missing_fact',
            severity: 'warn',
            message: `Fact "${factKey}" (${factValue}) not found in ${stackName}/ stack`
          });
        }
      }
    }
  }

  // Same facts should have same values in both stacks
  checkFactsConsistency() {
    const factValues = this.extractFactValues(this.facts);
    
    for (const [factKey, factValue] of factValues) {
      const claudeContent = fs.existsSync(CLAUDE_DIR) ? this.readAllFiles(CLAUDE_DIR) : '';
      const gptContent = fs.existsSync(GPT_DIR) ? this.readAllFiles(GPT_DIR) : '';
      
      const inClaude = claudeContent.includes(String(factValue));
      const inGpt = gptContent.includes(String(factValue));
      
      if (inClaude !== inGpt) {
        this.discrepancies.push({
          type: 'inconsistent_fact',
          severity: 'error',
          message: `Fact "${factKey}" (${factValue}) present in ${inClaude ? 'claude' : 'gpt'} but not ${inClaude ? 'gpt' : 'claude'}`
        });
      }
    }
  }

  extractFactValues(obj, prefix = '') {
    const values = [];
    // Skip metadata fields
    const skipFields = ['version', 'updated_at'];
    
    for (const [key, value] of Object.entries(obj)) {
      if (skipFields.includes(key) && !prefix) {
        continue; // Skip top-level metadata
      }
      
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        values.push(...this.extractFactValues(value, fullKey));
      } else if (typeof value === 'string' || typeof value === 'number') {
        values.push([fullKey, value]);
      }
    }
    return values;
  }

  readAllFiles(dir) {
    let content = '';
    for (const file of fs.readdirSync(dir)) {
      const filePath = path.join(dir, file);
      if (fs.statSync(filePath).isFile()) {
        content += fs.readFileSync(filePath, 'utf8') + '\n';
      }
    }
    return content;
  }
}

// CLI
if (require.main === module) {
  const reviewer = new SyncReviewer();
  const discrepancies = reviewer.review();

  if (discrepancies.length === 0) {
    console.log('✓ Both prompt stacks are in sync');
  } else {
    console.log(`Found ${discrepancies.length} discrepancies:\n`);
    for (const d of discrepancies) {
      const icon = { error: '✗', warn: '⚠', info: 'ℹ' }[d.severity];
      console.log(`  ${icon} [${d.type}] ${d.message}`);
    }
    process.exit(1);
  }
}

module.exports = SyncReviewer;
