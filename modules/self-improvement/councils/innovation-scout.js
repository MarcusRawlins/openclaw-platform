const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class InnovationScout {
  async run() {
    const report = {
      timestamp: new Date().toISOString(),
      opportunities: [],
      proposals: []
    };

    // 1. Find manual patterns that could be automated
    report.opportunities.push(...await this.findManualPatterns());
    
    // 2. Find code duplication across skills
    report.opportunities.push(...await this.findDuplication());
    
    // 3. Check for outdated patterns
    report.opportunities.push(...await this.findOutdatedPatterns());
    
    // 4. Scan for TODO/FIXME/HACK comments
    report.opportunities.push(...await this.findTodos());

    // Generate proposals with accept/reject tracking
    for (const opp of report.opportunities) {
      const id = `INN-${Date.now().toString(36).toUpperCase().substring(0, 6)}`;
      report.proposals.push({
        id,
        title: opp.title,
        description: opp.description,
        impact: opp.impact || 'medium',
        effort: opp.effort || 'medium',
        status: 'proposed'
      });
    }

    // Save proposals to FEATURE_REQUESTS.md
    const FeatureLog = require('../learnings/feature-log');
    for (const proposal of report.proposals) {
      FeatureLog.add({
        title: proposal.title,
        description: proposal.description,
        source: 'innovation-scout',
        priority: proposal.impact
      });
    }

    return report;
  }

  async findManualPatterns() {
    const opportunities = [];
    const skillsDir = '/Users/marcusrawlins/.openclaw/workspace/skills';

    // Check for direct fetch calls that should use llm-router
    try {
      const directFetches = execSync(
        `grep -rl "fetch.*1234\\|fetch.*api\\.anthropic\\|fetch.*api\\.openai" "${skillsDir}" --include="*.js" 2>/dev/null`,
        { encoding: 'utf8', timeout: 10000 }
      ).trim();
      
      if (directFetches) {
        const files = directFetches.split('\n').filter(Boolean);
        opportunities.push({
          title: `${files.length} files make direct LLM calls (should use router)`,
          description: `Files: ${files.map(f => path.basename(f)).join(', ')}`,
          impact: 'high',
          effort: 'low'
        });
      }
    } catch { /* nothing found */ }

    // Check for console.log in production code (should use logger)
    try {
      const consoleLogs = execSync(
        `grep -c "console\\.log" "${skillsDir}"/*/*.js 2>/dev/null | grep -v ":0$"`,
        { encoding: 'utf8', timeout: 10000 }
      ).trim();
      
      if (consoleLogs) {
        const total = consoleLogs.split('\n').reduce((sum, line) => {
          const count = parseInt(line.split(':').pop() || '0');
          return sum + count;
        }, 0);
        
        if (total > 50) {
          opportunities.push({
            title: `${total} console.log calls should migrate to logging system`,
            description: 'Replace console.log with structured logging for queryability',
            impact: 'medium',
            effort: 'medium'
          });
        }
      }
    } catch { /* nothing found */ }

    return opportunities;
  }

  async findDuplication() {
    const opportunities = [];
    const skillsDir = '/Users/marcusrawlins/.openclaw/workspace/skills';

    // Check for duplicate redaction implementations
    try {
      const redactFiles = execSync(
        `find "${skillsDir}" -name "redact*.js" 2>/dev/null`,
        { encoding: 'utf8', timeout: 5000 }
      ).trim();
      
      if (redactFiles) {
        const files = redactFiles.split('\n').filter(Boolean);
        if (files.length > 1) {
          opportunities.push({
            title: `${files.length} separate redaction implementations`,
            description: 'Consolidate into shared logging/redact.js module',
            impact: 'medium',
            effort: 'low'
          });
        }
      }
    } catch { /* nothing found */ }

    // Check for duplicate config patterns
    try {
      const configs = execSync(
        `find "${skillsDir}" -name "config.json" 2>/dev/null`,
        { encoding: 'utf8', timeout: 5000 }
      ).trim();
      
      if (configs) {
        const files = configs.split('\n').filter(Boolean);
        if (files.length > 5) {
          opportunities.push({
            title: `${files.length} separate config.json files`,
            description: 'Consider shared config loader with per-skill overrides',
            impact: 'low',
            effort: 'medium'
          });
        }
      }
    } catch { /* nothing found */ }

    return opportunities;
  }

  async findOutdatedPatterns() {
    const opportunities = [];
    const skillsDir = '/Users/marcusrawlins/.openclaw/workspace/skills';

    // Check for callback-style code that should be async/await
    try {
      const callbacks = execSync(
        `grep -c "function.*callback\\|\\.then(" "${skillsDir}"/*/*.js 2>/dev/null | grep -v ":0$"`,
        { encoding: 'utf8', timeout: 10000 }
      ).trim();
      
      // Only flag if significant
      if (callbacks) {
        const total = callbacks.split('\n').reduce((sum, line) => {
          return sum + parseInt(line.split(':').pop() || '0');
        }, 0);
        
        if (total > 20) {
          opportunities.push({
            title: `${total} callback/.then patterns could be async/await`,
            description: 'Modernize to async/await for readability',
            impact: 'low',
            effort: 'medium'
          });
        }
      }
    } catch { /* nothing found */ }

    return opportunities;
  }

  async findTodos() {
    const opportunities = [];
    const skillsDir = '/Users/marcusrawlins/.openclaw/workspace/skills';

    try {
      const todos = execSync(
        `grep -rn "TODO\\|FIXME\\|HACK\\|XXX" "${skillsDir}" --include="*.js" 2>/dev/null | head -20`,
        { encoding: 'utf8', timeout: 10000 }
      ).trim();
      
      if (todos) {
        const lines = todos.split('\n').filter(Boolean);
        opportunities.push({
          title: `${lines.length}+ TODO/FIXME comments in codebase`,
          description: lines.slice(0, 5).map(l => l.substring(l.lastIndexOf('/') + 1)).join('\n'),
          impact: 'low',
          effort: 'varies'
        });
      }
    } catch { /* nothing found */ }

    return opportunities;
  }
}

module.exports = InnovationScout;
