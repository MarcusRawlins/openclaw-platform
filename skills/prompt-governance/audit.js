#!/usr/bin/env node
/**
 * Governance Audit Script
 * 
 * Checks workspace files for:
 * - Duplication across files
 * - File scope violations
 * - Token budget overages
 * - Data classification issues
 */

const fs = require('fs');
const path = require('path');

class GovernanceAuditor {
  constructor(workspaceDir) {
    this.workspaceDir = workspaceDir;
    this.issues = [];
  }

  audit() {
    console.log(`🔍 Auditing workspace: ${this.workspaceDir}\n`);
    this.checkDuplication();
    this.checkFileScopes();
    this.checkTokenBudgets();
    this.checkDataClassification();
    return this.issues;
  }

  checkDuplication() {
    const files = ['AGENTS.md', 'SOUL.md', 'IDENTITY.md', 'USER.md', 'TOOLS.md', 'MEMORY.md'];
    const contents = {};

    // Load all files
    for (const file of files) {
      const filePath = path.join(this.workspaceDir, file);
      if (fs.existsSync(filePath)) {
        contents[file] = fs.readFileSync(filePath, 'utf8');
      }
    }

    // Check for lines that appear in multiple files
    for (const [file1, content1] of Object.entries(contents)) {
      const lines1 = content1.split('\n')
        .filter(l => l.trim().length > 20)  // Only check substantial lines
        .map(l => l.trim());
      
      for (const [file2, content2] of Object.entries(contents)) {
        if (file1 >= file2) continue;  // Skip same file and already compared pairs
        
        for (const line of lines1) {
          // Skip common markdown elements
          if (line.startsWith('#') || line.startsWith('-') || line.startsWith('*')) {
            continue;
          }
          
          if (content2.includes(line)) {
            this.issues.push({
              type: 'duplication',
              severity: 'warn',
              file: `${file1} / ${file2}`,
              message: `Duplicate content: "${line.substring(0, 60)}${line.length > 60 ? '...' : ''}"`
            });
          }
        }
      }
    }
  }

  checkFileScopes() {
    const scopeRules = {
      'SOUL.md': {
        forbidden: ['cron', 'security', 'channel', 'port', 'API key', 'database', 'token'],
        purpose: 'personality only'
      },
      'IDENTITY.md': {
        maxLines: 10,
        purpose: 'name and avatar only'
      },
      'TOOLS.md': {
        forbidden: ['how to', 'run this', 'configure', 'documentation', 'use this'],
        purpose: 'IDs and paths only'
      },
      'USER.md': {
        forbidden: ['personal email', 'phone', 'family', 'ssn', '@gmail', '@yahoo', '@hotmail'],
        purpose: 'work contact info only'
      }
    };

    for (const [file, rules] of Object.entries(scopeRules)) {
      const filePath = path.join(this.workspaceDir, file);
      if (!fs.existsSync(filePath)) continue;

      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').filter(l => l.trim());

      // Check line count
      if (rules.maxLines && lines.length > rules.maxLines) {
        this.issues.push({
          type: 'scope',
          severity: 'warn',
          file: file,
          message: `Has ${lines.length} lines (max ${rules.maxLines}). Purpose: ${rules.purpose}`
        });
      }

      // Check for forbidden terms
      if (rules.forbidden) {
        for (const term of rules.forbidden) {
          if (content.toLowerCase().includes(term.toLowerCase())) {
            this.issues.push({
              type: 'scope',
              severity: 'warn',
              file: file,
              message: `Contains "${term}" which belongs elsewhere. Purpose: ${rules.purpose}`
            });
          }
        }
      }
    }
  }

  checkTokenBudgets() {
    const autoLoaded = ['AGENTS.md', 'SOUL.md', 'IDENTITY.md', 'USER.md', 'TOOLS.md'];
    const targetBudgets = {
      'AGENTS.md': 50,
      'SOUL.md': 30,
      'IDENTITY.md': 5,
      'USER.md': 15,
      'TOOLS.md': 20
    };
    
    let totalLines = 0;
    let totalTokens = 0;

    for (const file of autoLoaded) {
      const filePath = path.join(this.workspaceDir, file);
      if (!fs.existsSync(filePath)) continue;

      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').filter(l => l.trim()).length;
      const estimatedTokens = Math.ceil(content.length / 4);
      
      totalLines += lines;
      totalTokens += estimatedTokens;

      const targetLines = targetBudgets[file];
      if (lines > targetLines * 1.2) {  // Allow 20% buffer
        this.issues.push({
          type: 'budget',
          severity: 'info',
          file: file,
          message: `Has ${lines} lines (target: ${targetLines}). ~${estimatedTokens} tokens. Could content move to on-demand docs?`
        });
      }
    }

    if (totalTokens > 2000) {
      this.issues.push({
        type: 'budget',
        severity: 'warn',
        file: 'ALL',
        message: `Auto-loaded files total ~${totalTokens} tokens (${totalLines} lines). Target: <2000 tokens.`
      });
    }
  }

  checkDataClassification() {
    // Check USER.md for personal details that should be in MEMORY.md
    const userPath = path.join(this.workspaceDir, 'USER.md');
    if (fs.existsSync(userPath)) {
      const content = fs.readFileSync(userPath, 'utf8');
      const confidentialPatterns = [
        { pattern: /@(?:gmail|yahoo|hotmail|outlook|icloud|me\.com|mac\.com|protonmail)/i, name: 'personal email' },
        { pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, name: 'phone number' },
        { pattern: /\$[\d,]+/, name: 'dollar amount' },
        { pattern: /\b\d{3}-\d{2}-\d{4}\b/, name: 'SSN' },
        { pattern: /family|spouse|child|wife|husband|daughter|son/i, name: 'family reference' }
      ];

      for (const { pattern, name } of confidentialPatterns) {
        if (pattern.test(content)) {
          this.issues.push({
            type: 'classification',
            severity: 'error',
            file: 'USER.md',
            message: `Contains ${name}. This is Confidential data and should be in MEMORY.md (private-only).`
          });
        }
      }
    }

    // Check TOOLS.md for API keys/secrets
    const toolsPath = path.join(this.workspaceDir, 'TOOLS.md');
    if (fs.existsSync(toolsPath)) {
      const content = fs.readFileSync(toolsPath, 'utf8');
      const secretPatterns = [
        { pattern: /(?:sk|pk|api|key|token|secret)[-_]?[\w]{20,}/i, name: 'API key value' },
        { pattern: /password\s*[:=]\s*\S+/i, name: 'password value' }
      ];

      for (const { pattern, name } of secretPatterns) {
        if (pattern.test(content)) {
          this.issues.push({
            type: 'classification',
            severity: 'error',
            file: 'TOOLS.md',
            message: `Contains ${name}. Store in ~/.openclaw/.env, reference env var name only.`
          });
        }
      }
    }
  }

  report() {
    const grouped = {};
    for (const issue of this.issues) {
      const key = `${issue.severity}:${issue.type}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(issue);
    }

    const icons = { error: '✗', warn: '⚠', info: 'ℹ' };
    const severityOrder = ['error', 'warn', 'info'];

    for (const severity of severityOrder) {
      for (const type of ['classification', 'duplication', 'scope', 'budget']) {
        const key = `${severity}:${type}`;
        if (grouped[key]) {
          console.log(`\n${icons[severity]} ${severity.toUpperCase()}: ${type}`);
          for (const issue of grouped[key]) {
            console.log(`  [${issue.file}] ${issue.message}`);
          }
        }
      }
    }
  }
}

// CLI
if (require.main === module) {
  const workspaceDir = process.argv[2] || '/Users/marcusrawlins/.openclaw/workspace';
  
  if (!fs.existsSync(workspaceDir)) {
    console.error(`❌ Workspace not found: ${workspaceDir}`);
    process.exit(1);
  }

  const auditor = new GovernanceAuditor(workspaceDir);
  const issues = auditor.audit();

  if (issues.length === 0) {
    console.log('✓ All governance checks passed');
    process.exit(0);
  } else {
    auditor.report();
    console.log(`\n📊 Total: ${issues.length} issue(s) found`);
    
    const errorCount = issues.filter(i => i.severity === 'error').length;
    process.exit(errorCount > 0 ? 1 : 0);
  }
}

module.exports = GovernanceAuditor;
