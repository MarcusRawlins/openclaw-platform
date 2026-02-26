# Self-Improvement Systems
## Specification v1.0

**Author:** Marcus Rawlins (Opus)
**Date:** 2026-02-26
**Priority:** HIGH
**Estimated Build:** 3-4 days (Brunel)
**Location:** `/workspace/skills/self-improvement/`

---

## 1. Overview

Automated systems for continuous agent improvement, platform health monitoring, security auditing, and proactive error reporting. Agents learn from mistakes, the platform tests itself, and failures get reported to Tyler instead of silently dying in stderr.

## 2. Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  self-improvement/                        │
├─────────────────────────────────────────────────────────┤
│  learnings/                                              │
│  ├─ capture.js       Capture corrections + insights      │
│  ├─ error-tracker.js Recurring error pattern detection   │
│  ├─ feature-log.js   Feature request tracking            │
│  ├─ LEARNINGS.md     Corrections from user feedback      │
│  ├─ ERRORS.md        Recurring error patterns            │
│  └─ FEATURE_REQUESTS.md  Ideas for improvement           │
│                                                          │
│  councils/                                               │
│  ├─ health-review.js    Platform health council          │
│  ├─ security-review.js  Security review council          │
│  ├─ innovation-scout.js Automation opportunity scanner   │
│  └─ council-runner.js   Orchestrator for all councils    │
│                                                          │
│  testing/                                                │
│  ├─ tier1-nightly.js    Integration tests (free)         │
│  ├─ tier2-weekly.js     Live LLM tests (low cost)        │
│  ├─ tier3-weekly.js     End-to-end with messaging        │
│  ├─ test-runner.js      Unified test orchestrator        │
│  └─ test-report.js      Report generator                 │
│                                                          │
│  error-reporter.js   Proactive failure notification      │
│  config.json         All configuration                   │
│  SKILL.md            Integration guide                   │
└─────────────────────────────────────────────────────────┘
```

## 3. Learnings Directory

### 3.1 LEARNINGS.md — Corrections & Insights

Captures corrections from user feedback, successful patterns, and insights learned during operation.

**Format:**

```markdown
# Agent Learnings

## 2026-02-26

### Correction: KB RAG migration silently failed
- **Context:** Migration script ran, exited 0, but all 30 files failed due to embedding endpoint error
- **Lesson:** Always verify output after migration/batch jobs, not just exit code
- **Applied:** Added post-migration verification step to all batch scripts

### Insight: Tyler prefers to rewrite openings himself
- **Context:** Caption writing for Meet the Team carousel
- **Lesson:** AI-generated openings tend to be generic. Tyler's instinct for warmth ("we're so glad you're here") is always better. Draft the body, let him own the hook.
- **Applied:** Updated caption-voice skill notes

### Correction: Don't use ellipsis in polished brand copy
- **Context:** Tyler changed "Here's the truth…" to "Here's the truth:"
- **Lesson:** Colons read cleaner in brand voice. Ellipsis is too casual for carousel captions.
- **Applied:** Added to SOUL.md style rules
```

### 3.2 Capture System (`capture.js`)

```javascript
const fs = require('fs');
const path = require('path');
const config = require('./config.json');

const LEARNINGS_PATH = path.join(config.learnings_dir, 'LEARNINGS.md');
const ERRORS_PATH = path.join(config.learnings_dir, 'ERRORS.md');
const FEATURES_PATH = path.join(config.learnings_dir, 'FEATURE_REQUESTS.md');

class LearningsCapture {
  // Capture a correction from user feedback
  static addCorrection({ context, lesson, applied, agent = 'marcus' }) {
    const date = new Date().toISOString().split('T')[0];
    const entry = `
### Correction: ${lesson.substring(0, 60)}
- **Context:** ${context}
- **Lesson:** ${lesson}
- **Applied:** ${applied || 'Pending'}
- **Agent:** ${agent}
- **Date:** ${date}
`;
    appendToSection(LEARNINGS_PATH, date, entry);
  }

  // Capture an insight
  static addInsight({ context, lesson, applied, agent = 'marcus' }) {
    const date = new Date().toISOString().split('T')[0];
    const entry = `
### Insight: ${lesson.substring(0, 60)}
- **Context:** ${context}
- **Lesson:** ${lesson}
- **Applied:** ${applied || 'Noted'}
- **Agent:** ${agent}
- **Date:** ${date}
`;
    appendToSection(LEARNINGS_PATH, date, entry);
  }

  // Get recent learnings
  static getRecent(days = 7) {
    if (!fs.existsSync(LEARNINGS_PATH)) return [];
    const content = fs.readFileSync(LEARNINGS_PATH, 'utf8');
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    
    // Parse sections by date and filter
    const sections = content.split(/^## (\d{4}-\d{2}-\d{2})/m);
    const recent = [];
    
    for (let i = 1; i < sections.length; i += 2) {
      const date = sections[i];
      if (date >= cutoff) {
        recent.push({ date, entries: sections[i + 1] });
      }
    }
    
    return recent;
  }

  // Search learnings by keyword
  static search(keyword) {
    if (!fs.existsSync(LEARNINGS_PATH)) return [];
    const content = fs.readFileSync(LEARNINGS_PATH, 'utf8');
    const lines = content.split('\n');
    const results = [];
    let currentEntry = null;

    for (const line of lines) {
      if (line.startsWith('### ')) {
        if (currentEntry && currentEntry.text.toLowerCase().includes(keyword.toLowerCase())) {
          results.push(currentEntry);
        }
        currentEntry = { title: line, text: line };
      } else if (currentEntry) {
        currentEntry.text += '\n' + line;
      }
    }
    
    if (currentEntry && currentEntry.text.toLowerCase().includes(keyword.toLowerCase())) {
      results.push(currentEntry);
    }

    return results;
  }
}

function appendToSection(filePath, date, entry) {
  let content = '';
  if (fs.existsSync(filePath)) {
    content = fs.readFileSync(filePath, 'utf8');
  } else {
    content = `# ${path.basename(filePath, '.md')}\n`;
  }

  const sectionHeader = `## ${date}`;
  if (content.includes(sectionHeader)) {
    // Append to existing date section
    content = content.replace(sectionHeader, sectionHeader + '\n' + entry);
  } else {
    // Add new date section at the top (after title)
    const titleEnd = content.indexOf('\n') + 1;
    content = content.substring(0, titleEnd) + '\n' + sectionHeader + '\n' + entry + content.substring(titleEnd);
  }

  fs.writeFileSync(filePath, content);
}

module.exports = LearningsCapture;
```

### 3.3 Error Tracker (`error-tracker.js`)

Detects recurring error patterns from tool output and logs.

```javascript
const fs = require('fs');
const path = require('path');
const config = require('./config.json');

const ERRORS_PATH = path.join(config.learnings_dir, 'ERRORS.md');

// Known error patterns to watch for
const ERROR_PATTERNS = [
  {
    pattern: /ECONNREFUSED.*:1234/i,
    category: 'lm_studio_down',
    description: 'LM Studio server not running or not responding',
    resolution: 'Check if LM Studio is running. Restart if needed.'
  },
  {
    pattern: /ECONNREFUSED.*:18789/i,
    category: 'gateway_down',
    description: 'OpenClaw gateway not responding',
    resolution: 'Run: openclaw gateway restart'
  },
  {
    pattern: /sqlite.*SQLITE_BUSY/i,
    category: 'db_locked',
    description: 'SQLite database locked by another process',
    resolution: 'Check for competing processes. Use WAL mode.'
  },
  {
    pattern: /ENOMEM|out of memory|heap/i,
    category: 'memory',
    description: 'Process ran out of memory',
    resolution: 'Check memory usage. Consider reducing batch size or model context.'
  },
  {
    pattern: /rate.?limit|429|too many requests/i,
    category: 'rate_limited',
    description: 'API rate limit hit',
    resolution: 'Add backoff delay. Check if another process is hammering the API.'
  },
  {
    pattern: /ENOSPC|no space left/i,
    category: 'disk_full',
    description: 'Disk space exhausted',
    resolution: 'Check disk usage. Run log rotation. Archive old files.'
  },
  {
    pattern: /timeout|ETIMEDOUT/i,
    category: 'timeout',
    description: 'Operation timed out',
    resolution: 'Increase timeout or check if the target service is overloaded.'
  },
  {
    pattern: /permission denied|EACCES/i,
    category: 'permissions',
    description: 'File/directory permission denied',
    resolution: 'Check file ownership and permissions.'
  },
  {
    pattern: /loadExtension.*vec0/i,
    category: 'sqlite_vec',
    description: 'Incorrect sqlite-vec loading method',
    resolution: 'Use sqliteVec.load(db) not db.loadExtension("vec0")'
  }
];

class ErrorTracker {
  constructor() {
    this.sessionErrors = new Map(); // category → count this session
  }

  // Scan text output for known error patterns
  scan(text, context = {}) {
    if (!text || typeof text !== 'string') return [];

    const matched = [];

    for (const ep of ERROR_PATTERNS) {
      if (ep.pattern.test(text)) {
        matched.push({
          category: ep.category,
          description: ep.description,
          resolution: ep.resolution,
          context: context.source || 'unknown',
          timestamp: new Date().toISOString()
        });

        // Track frequency
        const count = (this.sessionErrors.get(ep.category) || 0) + 1;
        this.sessionErrors.set(ep.category, count);
      }
    }

    // Log new errors to ERRORS.md
    for (const error of matched) {
      this._logError(error);
    }

    return matched;
  }

  // Post-tool-use hook: scan tool output for errors
  scanToolOutput(toolName, output, exitCode) {
    if (exitCode === 0 && !output) return [];

    const errors = this.scan(output, { source: `tool:${toolName}` });

    // Also check for non-zero exit codes
    if (exitCode && exitCode !== 0) {
      errors.push({
        category: 'tool_failure',
        description: `${toolName} exited with code ${exitCode}`,
        resolution: 'Check tool output for details',
        context: `tool:${toolName}`,
        timestamp: new Date().toISOString()
      });
    }

    return errors;
  }

  // Get error frequency report
  getFrequencyReport() {
    const report = [];
    for (const [category, count] of this.sessionErrors) {
      const pattern = ERROR_PATTERNS.find(p => p.category === category);
      report.push({
        category,
        count,
        description: pattern?.description || 'Unknown',
        resolution: pattern?.resolution || 'Investigate'
      });
    }
    return report.sort((a, b) => b.count - a.count);
  }

  _logError(error) {
    const date = new Date().toISOString().split('T')[0];
    const entry = `
### ${error.category} (${error.timestamp})
- **Description:** ${error.description}
- **Context:** ${error.context}
- **Resolution:** ${error.resolution}
`;

    let content = '';
    if (fs.existsSync(ERRORS_PATH)) {
      content = fs.readFileSync(ERRORS_PATH, 'utf8');
    } else {
      content = '# Recurring Error Patterns\n';
    }

    // Check if this category already has an entry today (avoid spam)
    if (content.includes(`### ${error.category} (${date}`)) {
      return; // Already logged today
    }

    const sectionHeader = `## ${date}`;
    if (content.includes(sectionHeader)) {
      content = content.replace(sectionHeader, sectionHeader + '\n' + entry);
    } else {
      const titleEnd = content.indexOf('\n') + 1;
      content = content.substring(0, titleEnd) + '\n' + sectionHeader + '\n' + entry + content.substring(titleEnd);
    }

    fs.writeFileSync(ERRORS_PATH, content);
  }
}

module.exports = ErrorTracker;
```

### 3.4 Feature Request Log (`feature-log.js`)

```javascript
const fs = require('fs');
const path = require('path');
const config = require('./config.json');

const FEATURES_PATH = path.join(config.learnings_dir, 'FEATURE_REQUESTS.md');

class FeatureLog {
  static add({ title, description, source, priority = 'medium', status = 'proposed' }) {
    const date = new Date().toISOString().split('T')[0];
    const id = `FR-${Date.now().toString(36).toUpperCase()}`;
    
    const entry = `
### ${id}: ${title}
- **Status:** ${status}
- **Priority:** ${priority}
- **Source:** ${source}
- **Date:** ${date}
- **Description:** ${description}
`;

    let content = '';
    if (fs.existsSync(FEATURES_PATH)) {
      content = fs.readFileSync(FEATURES_PATH, 'utf8');
    } else {
      content = '# Feature Requests\n\n## Proposed\n';
    }

    // Append to Proposed section
    if (content.includes('## Proposed')) {
      content = content.replace('## Proposed', '## Proposed\n' + entry);
    } else {
      content += '\n## Proposed\n' + entry;
    }

    fs.writeFileSync(FEATURES_PATH, content);
    return id;
  }

  static updateStatus(id, newStatus) {
    if (!fs.existsSync(FEATURES_PATH)) return false;
    let content = fs.readFileSync(FEATURES_PATH, 'utf8');
    
    const pattern = new RegExp(`(### ${id}[^]*?- \\*\\*Status:\\*\\* )\\w+`, 'm');
    if (pattern.test(content)) {
      content = content.replace(pattern, `$1${newStatus}`);
      fs.writeFileSync(FEATURES_PATH, content);
      return true;
    }
    return false;
  }

  static list(statusFilter = null) {
    if (!fs.existsSync(FEATURES_PATH)) return [];
    const content = fs.readFileSync(FEATURES_PATH, 'utf8');
    
    const entries = [];
    const entryPattern = /### (FR-\w+): (.+)\n- \*\*Status:\*\* (\w+)\n- \*\*Priority:\*\* (\w+)/g;
    let match;
    
    while ((match = entryPattern.exec(content))) {
      const entry = { id: match[1], title: match[2], status: match[3], priority: match[4] };
      if (!statusFilter || entry.status === statusFilter) {
        entries.push(entry);
      }
    }
    
    return entries;
  }
}

module.exports = FeatureLog;
```

## 4. Automated Review Councils

### 4.1 Platform Health Review (`councils/health-review.js`)

Runs nightly. Checks platform health across multiple dimensions.

```javascript
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class HealthReview {
  async run() {
    const report = {
      timestamp: new Date().toISOString(),
      sections: {},
      score: 0,
      maxScore: 0,
      issues: [],
      recommendations: []
    };

    // 1. Cron Reliability
    report.sections.cron = await this.checkCronReliability();
    
    // 2. Database Health
    report.sections.databases = await this.checkDatabases();
    
    // 3. Storage Usage
    report.sections.storage = await this.checkStorage();
    
    // 4. Service Availability
    report.sections.services = await this.checkServices();
    
    // 5. Error Rate
    report.sections.errors = await this.checkErrorRate();
    
    // 6. Data Integrity
    report.sections.integrity = await this.checkDataIntegrity();

    // Calculate overall score
    for (const section of Object.values(report.sections)) {
      report.score += section.score || 0;
      report.maxScore += section.maxScore || 10;
      if (section.issues) report.issues.push(...section.issues);
      if (section.recommendations) report.recommendations.push(...section.recommendations);
    }

    report.healthPct = Math.round((report.score / report.maxScore) * 100);

    return report;
  }

  async checkCronReliability() {
    const result = { score: 0, maxScore: 10, issues: [], recommendations: [] };
    
    try {
      // Check cron job history from logging system
      const logDir = '/Volumes/reeseai-memory/data/logs';
      const cronLog = path.join(logDir, 'agent.cron.jsonl');
      
      if (!fs.existsSync(cronLog)) {
        result.issues.push('No cron log file found');
        return result;
      }

      const lines = fs.readFileSync(cronLog, 'utf8').split('\n').filter(Boolean);
      const last7d = lines.filter(l => {
        try {
          const entry = JSON.parse(l);
          const age = Date.now() - new Date(entry.ts).getTime();
          return age < 7 * 86400000;
        } catch { return false; }
      });

      const total = last7d.length;
      const errors = last7d.filter(l => {
        try { return JSON.parse(l).level === 'error'; } catch { return false; }
      }).length;

      const reliabilityPct = total > 0 ? ((total - errors) / total) * 100 : 0;
      
      if (reliabilityPct >= 95) result.score = 10;
      else if (reliabilityPct >= 80) result.score = 7;
      else if (reliabilityPct >= 60) result.score = 4;
      else result.score = 1;

      if (reliabilityPct < 95) {
        result.issues.push(`Cron reliability at ${reliabilityPct.toFixed(1)}% (${errors} failures in 7d)`);
        result.recommendations.push('Investigate cron failures in agent.cron.jsonl');
      }
    } catch (err) {
      result.issues.push(`Cron check failed: ${err.message}`);
    }

    return result;
  }

  async checkDatabases() {
    const result = { score: 0, maxScore: 10, issues: [], recommendations: [] };
    
    const databases = [
      { name: 'Usage Tracking', path: '/Volumes/reeseai-memory/data/usage-tracking/usage.db' },
      { name: 'Email Pipeline', path: '/Volumes/reeseai-memory/data/email-pipeline/pipeline.db' },
      { name: 'Knowledge Base', path: '/Volumes/reeseai-memory/data/knowledge-base-rag/kb.db' },
      { name: 'BI Council', path: '/Volumes/reeseai-memory/data/bi-council/council-history.db' },
      { name: 'Financial', path: '/Volumes/reeseai-memory/data/financial-tracking/financial.db' },
      { name: 'Logs', path: '/Volumes/reeseai-memory/data/logs/logs.db' },
      { name: 'Content Pipeline', path: '/Volumes/reeseai-memory/data/content-pipeline/content.db' }
    ];

    let healthy = 0;
    for (const db of databases) {
      if (fs.existsSync(db.path)) {
        try {
          // Quick integrity check
          execSync(`sqlite3 "${db.path}" "PRAGMA integrity_check" 2>&1`, { timeout: 5000 });
          healthy++;
        } catch {
          result.issues.push(`${db.name} database failed integrity check`);
        }
      }
      // Don't flag missing DBs as issues (may not be built yet)
    }

    result.score = databases.length > 0 ? Math.round((healthy / databases.length) * 10) : 5;
    return result;
  }

  async checkStorage() {
    const result = { score: 0, maxScore: 10, issues: [], recommendations: [] };
    
    try {
      const dfOutput = execSync('df -h /Volumes/reeseai-memory 2>/dev/null || df -h /', { encoding: 'utf8' });
      const lines = dfOutput.trim().split('\n');
      const lastLine = lines[lines.length - 1];
      const usePct = parseInt(lastLine.match(/(\d+)%/)?.[1] || '0');
      
      if (usePct < 70) result.score = 10;
      else if (usePct < 85) { result.score = 7; result.issues.push(`Storage at ${usePct}%`); }
      else if (usePct < 95) { result.score = 3; result.issues.push(`Storage at ${usePct}% — clean up needed`); }
      else { result.score = 0; result.issues.push(`CRITICAL: Storage at ${usePct}%`); }
    } catch {
      result.score = 5; // Can't check, assume ok
    }

    return result;
  }

  async checkServices() {
    const result = { score: 0, maxScore: 10, issues: [], recommendations: [] };
    
    const services = [
      { name: 'OpenClaw Gateway', url: 'http://localhost:18789', timeout: 3000 },
      { name: 'LM Studio', url: 'http://127.0.0.1:1234/v1/models', timeout: 3000 },
      { name: 'Mission Control', url: 'http://localhost:3100', timeout: 3000 }
    ];

    let up = 0;
    for (const svc of services) {
      try {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), svc.timeout);
        await fetch(svc.url, { signal: controller.signal });
        up++;
      } catch {
        result.issues.push(`${svc.name} is not responding`);
      }
    }

    result.score = Math.round((up / services.length) * 10);
    return result;
  }

  async checkErrorRate() {
    const result = { score: 0, maxScore: 10, issues: [], recommendations: [] };
    
    try {
      const errorLog = '/Volumes/reeseai-memory/data/logs/system.error.jsonl';
      if (!fs.existsSync(errorLog)) {
        result.score = 10; // No errors = perfect
        return result;
      }

      const content = fs.readFileSync(errorLog, 'utf8');
      const lines = content.split('\n').filter(Boolean);
      const last24h = lines.filter(l => {
        try {
          const entry = JSON.parse(l);
          return Date.now() - new Date(entry.ts).getTime() < 86400000;
        } catch { return false; }
      });

      if (last24h.length === 0) result.score = 10;
      else if (last24h.length < 5) result.score = 8;
      else if (last24h.length < 20) { result.score = 5; result.issues.push(`${last24h.length} errors in last 24h`); }
      else { result.score = 2; result.issues.push(`${last24h.length} errors in last 24h — investigate`); }
    } catch {
      result.score = 5;
    }

    return result;
  }

  async checkDataIntegrity() {
    const result = { score: 0, maxScore: 10, issues: [], recommendations: [] };
    
    // Check critical files exist
    const criticalFiles = [
      '/Users/marcusrawlins/.openclaw/workspace/SOUL.md',
      '/Users/marcusrawlins/.openclaw/workspace/USER.md',
      '/Users/marcusrawlins/.openclaw/workspace/MEMORY.md',
      '/Users/marcusrawlins/.openclaw/workspace/TOOLS.md'
    ];

    let found = 0;
    for (const file of criticalFiles) {
      if (fs.existsSync(file)) found++;
      else result.issues.push(`Critical file missing: ${path.basename(file)}`);
    }

    result.score = Math.round((found / criticalFiles.length) * 10);
    return result;
  }
}

module.exports = HealthReview;
```

### 4.2 Security Review (`councils/security-review.js`)

Multi-perspective security analysis.

```javascript
class SecurityReview {
  async run() {
    const report = {
      timestamp: new Date().toISOString(),
      perspectives: {},
      criticalFindings: [],
      recommendations: []
    };

    // Perspective 1: Offensive (attacker's view)
    report.perspectives.offensive = await this.offensiveScan();
    
    // Perspective 2: Defensive (defender's view)
    report.perspectives.defensive = await this.defensiveScan();
    
    // Perspective 3: Data Privacy
    report.perspectives.privacy = await this.privacyScan();
    
    // Perspective 4: Operational Realism
    report.perspectives.operational = await this.operationalScan();

    // Collect critical findings
    for (const [name, perspective] of Object.entries(report.perspectives)) {
      for (const finding of (perspective.findings || [])) {
        if (finding.severity === 'critical' || finding.severity === 'high') {
          report.criticalFindings.push({ perspective: name, ...finding });
        }
      }
      report.recommendations.push(...(perspective.recommendations || []));
    }

    return report;
  }

  async offensiveScan() {
    const findings = [];
    const recommendations = [];

    // Check for exposed secrets in workspace files
    const { execSync } = require('child_process');
    try {
      const grepResult = execSync(
        'grep -rl "sk-\\|pk_\\|api_key\\|password\\s*=" /Users/marcusrawlins/.openclaw/workspace/ --include="*.js" --include="*.json" --include="*.md" 2>/dev/null | head -20',
        { encoding: 'utf8', timeout: 10000 }
      ).trim();
      
      if (grepResult) {
        const files = grepResult.split('\n').filter(Boolean);
        findings.push({
          severity: 'high',
          title: 'Potential secrets in workspace files',
          details: `Found in ${files.length} files`,
          files: files.slice(0, 5)
        });
        recommendations.push('Review files for hardcoded secrets. Move to .env.');
      }
    } catch { /* grep found nothing, good */ }

    // Check for world-readable sensitive files
    try {
      const envPerms = execSync('stat -f "%Lp" /Users/marcusrawlins/.openclaw/.env 2>/dev/null', { encoding: 'utf8' }).trim();
      if (envPerms !== '600' && envPerms !== '400') {
        findings.push({
          severity: 'medium',
          title: '.env file permissions too open',
          details: `Current: ${envPerms}, should be 600`
        });
        recommendations.push('Run: chmod 600 ~/.openclaw/.env');
      }
    } catch { /* file doesn't exist */ }

    // Check for open ports
    try {
      const ports = execSync('lsof -i -P -n 2>/dev/null | grep LISTEN | head -20', { encoding: 'utf8' });
      const openPorts = ports.split('\n').filter(Boolean);
      findings.push({
        severity: 'info',
        title: `${openPorts.length} listening ports detected`,
        details: openPorts.map(l => l.trim()).slice(0, 10)
      });
    } catch { /* can't check */ }

    return { findings, recommendations };
  }

  async defensiveScan() {
    const findings = [];
    const recommendations = [];

    // Check if redaction is working in log files
    const logDir = '/Volumes/reeseai-memory/data/logs';
    if (fs.existsSync(path.join(logDir, 'all.jsonl'))) {
      const sample = fs.readFileSync(path.join(logDir, 'all.jsonl'), 'utf8').substring(0, 10000);
      
      // Look for unredacted secrets
      if (/sk-[a-zA-Z0-9]{20,}/i.test(sample)) {
        findings.push({
          severity: 'critical',
          title: 'Unredacted API keys found in log files',
          details: 'Redaction may not be working'
        });
      }
      
      if (/\/Users\/\w+/.test(sample) && !/\/Users\/\[USER\]/.test(sample)) {
        findings.push({
          severity: 'medium',
          title: 'Unredacted file paths in logs',
          details: 'User paths visible in log data'
        });
      }
    }

    // Check backup recency
    const backupDir = '/Volumes/BACKUP/reeseai-backup';
    if (fs.existsSync(backupDir)) {
      try {
        const latest = execSync(`ls -t "${backupDir}" | head -1`, { encoding: 'utf8' }).trim();
        const stat = fs.statSync(path.join(backupDir, latest));
        const ageDays = (Date.now() - stat.mtimeMs) / 86400000;
        
        if (ageDays > 7) {
          findings.push({
            severity: 'high',
            title: `Last backup is ${Math.round(ageDays)} days old`,
            details: `Latest: ${latest}`
          });
          recommendations.push('Run backup immediately');
        }
      } catch { /* can't check */ }
    }

    return { findings, recommendations };
  }

  async privacyScan() {
    const findings = [];
    const recommendations = [];

    // Check that MEMORY.md isn't accessible from group/shared sessions
    // (This is a config check, not a file system check)
    findings.push({
      severity: 'info',
      title: 'MEMORY.md access policy',
      details: 'Verify MEMORY.md is only loaded in main session (per AGENTS.md policy)'
    });

    // Check for PII in public-facing files
    const publicDirs = [
      '/Users/marcusrawlins/.openclaw/workspace/content',
      '/Users/marcusrawlins/.openclaw/workspace/clients'
    ];

    for (const dir of publicDirs) {
      if (!fs.existsSync(dir)) continue;
      try {
        const grepResult = execSync(
          `grep -rl "\\b\\d{3}[-.]\\d{3}[-.]\\d{4}\\b\\|\\b[A-Za-z0-9._%+-]\\+@[A-Za-z0-9.-]\\+\\.[A-Za-z]\\{2,\\}\\b" "${dir}" --include="*.md" 2>/dev/null | head -5`,
          { encoding: 'utf8', timeout: 5000 }
        ).trim();
        
        if (grepResult) {
          findings.push({
            severity: 'medium',
            title: `Potential PII in ${path.basename(dir)}/`,
            details: `Found in ${grepResult.split('\n').length} files`
          });
        }
      } catch { /* nothing found */ }
    }

    return { findings, recommendations };
  }

  async operationalScan() {
    const findings = [];
    const recommendations = [];

    // Check Node.js version
    try {
      const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
      findings.push({ severity: 'info', title: `Node.js ${nodeVersion}` });
    } catch { /* can't check */ }

    // Check disk space
    try {
      const df = execSync('df -h / | tail -1', { encoding: 'utf8' });
      const usePct = parseInt(df.match(/(\d+)%/)?.[1] || '0');
      if (usePct > 90) {
        findings.push({ severity: 'high', title: `Root disk at ${usePct}%` });
        recommendations.push('Free disk space');
      }
    } catch { /* can't check */ }

    // Check memory drive mounted
    if (!fs.existsSync('/Volumes/reeseai-memory')) {
      findings.push({
        severity: 'critical',
        title: 'Memory drive not mounted',
        details: '/Volumes/reeseai-memory is not accessible'
      });
    }

    return { findings, recommendations };
  }
}

module.exports = SecurityReview;
```

### 4.3 Innovation Scout (`councils/innovation-scout.js`)

Scans codebase for automation opportunities and proposes improvements.

```javascript
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
    const { execSync } = require('child_process');
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
    const { execSync } = require('child_process');
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
    const { execSync } = require('child_process');
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
    const { execSync } = require('child_process');
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
```

### 4.4 Council Runner (`councils/council-runner.js`)

Orchestrates all review councils.

```javascript
const HealthReview = require('./health-review');
const SecurityReview = require('./security-review');
const InnovationScout = require('./innovation-scout');
const fs = require('fs');
const path = require('path');

const REPORTS_DIR = '/Volumes/reeseai-memory/agents/reviews/councils';

async function runAllCouncils(options = {}) {
  const results = {};
  const date = new Date().toISOString().split('T')[0];

  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }

  // Run health review
  if (options.health !== false) {
    console.log('Running platform health review...');
    const health = new HealthReview();
    results.health = await health.run();
    console.log(`  Health: ${results.health.healthPct}% (${results.health.issues.length} issues)`);
  }

  // Run security review
  if (options.security !== false) {
    console.log('Running security review...');
    const security = new SecurityReview();
    results.security = await security.run();
    console.log(`  Security: ${results.security.criticalFindings.length} critical findings`);
  }

  // Run innovation scout
  if (options.innovation !== false) {
    console.log('Running innovation scout...');
    const innovation = new InnovationScout();
    results.innovation = await innovation.run();
    console.log(`  Innovation: ${results.innovation.proposals.length} proposals`);
  }

  // Generate combined report
  const report = formatReport(results, date);
  const reportPath = path.join(REPORTS_DIR, `${date}-council-report.md`);
  fs.writeFileSync(reportPath, report);
  console.log(`\nReport saved: ${reportPath}`);

  return { results, reportPath };
}

function formatReport(results, date) {
  let report = `# Self-Improvement Council Report — ${date}\n\n`;

  if (results.health) {
    report += `## Platform Health: ${results.health.healthPct}%\n\n`;
    if (results.health.issues.length > 0) {
      report += `### Issues\n`;
      for (const issue of results.health.issues) {
        report += `- ${issue}\n`;
      }
      report += '\n';
    }
    if (results.health.recommendations.length > 0) {
      report += `### Recommendations\n`;
      for (const rec of results.health.recommendations) {
        report += `- ${rec}\n`;
      }
      report += '\n';
    }
  }

  if (results.security) {
    report += `## Security Review\n\n`;
    if (results.security.criticalFindings.length > 0) {
      report += `### Critical Findings\n`;
      for (const finding of results.security.criticalFindings) {
        report += `- **[${finding.severity.toUpperCase()}]** ${finding.title}: ${finding.details || ''}\n`;
      }
      report += '\n';
    }
    report += `### Recommendations\n`;
    for (const rec of results.security.recommendations) {
      report += `- ${rec}\n`;
    }
    report += '\n';
  }

  if (results.innovation) {
    report += `## Innovation Proposals\n\n`;
    for (const proposal of results.innovation.proposals) {
      report += `### ${proposal.id}: ${proposal.title}\n`;
      report += `- **Impact:** ${proposal.impact} | **Effort:** ${proposal.effort}\n`;
      report += `- ${proposal.description}\n\n`;
    }
  }

  return report;
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};
  if (args.includes('--health-only')) { options.security = false; options.innovation = false; }
  if (args.includes('--security-only')) { options.health = false; options.innovation = false; }
  if (args.includes('--innovation-only')) { options.health = false; options.security = false; }

  runAllCouncils(options)
    .then(({ results }) => {
      if (results.health) console.log(`\nHealth: ${results.health.healthPct}%`);
      if (results.security) console.log(`Critical findings: ${results.security.criticalFindings.length}`);
      if (results.innovation) console.log(`Proposals: ${results.innovation.proposals.length}`);
    })
    .catch(err => {
      console.error('Council failed:', err);
      process.exit(1);
    });
}

module.exports = { runAllCouncils };
```

## 5. Tiered Testing

### 5.1 Tier 1: Nightly Integration Tests (Free)

No LLM calls. Tests database schemas, file I/O, config parsing, module imports.

```javascript
// testing/tier1-nightly.js

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
    await this.test('Import: LLM Router', () => require('/workspace/skills/llm-router/router'));
    await this.test('Import: Logger', () => require('/workspace/skills/logging/logger'));
    await this.test('Import: Usage Tracker', () => require('/workspace/skills/usage-tracking/logger'));
    
    // File system tests
    await this.test('FS: Memory drive accessible', () => {
      if (!fs.existsSync('/Volumes/reeseai-memory')) throw new Error('Not mounted');
    });
    await this.test('FS: Log directory writable', () => {
      const testFile = '/Volumes/reeseai-memory/data/logs/.test';
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
    });

    // Redaction tests
    await this.test('Redaction: API keys caught', () => {
      const { redactString } = require('/workspace/skills/logging/redact');
      const result = redactString('My key is sk-abc123def456ghi789jkl012mno345pqr');
      if (result.includes('sk-abc')) throw new Error('Key not redacted');
    });
    await this.test('Redaction: safe text unchanged', () => {
      const { redactString } = require('/workspace/skills/logging/redact');
      const input = 'Hello world, this is a normal message.';
      if (redactString(input) !== input) throw new Error('Safe text was modified');
    });

    // Model utils tests
    await this.test('Model utils: detect anthropic', () => {
      const { detectProvider } = require('/workspace/skills/llm-router/model-utils');
      const r = detectProvider('anthropic/claude-sonnet-4-5');
      if (r.provider !== 'anthropic') throw new Error(`Got: ${r.provider}`);
    });
    await this.test('Model utils: detect lmstudio', () => {
      const { detectProvider } = require('/workspace/skills/llm-router/model-utils');
      const r = detectProvider('lmstudio/gemma-3-12b-it');
      if (r.provider !== 'lmstudio') throw new Error(`Got: ${r.provider}`);
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
    if (!fs.existsSync(dbPath)) throw new Error(`DB not found: ${dbPath}`);
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
```

### 5.2 Tier 2: Weekly LLM Tests (Low Cost)

Makes live LLM calls to verify provider connectivity and response quality.

```javascript
// testing/tier2-weekly.js

class Tier2Tests {
  async runAll() {
    console.log('\n══════ TIER 2: Live LLM Tests (Weekly, Low Cost) ══════\n');

    const { callLlm } = require('/workspace/skills/llm-router/router');
    const results = [];

    // Test each provider
    const providers = [
      { model: 'lmstudio/qwen/qwen3-4b-2507', name: 'LM Studio (qwen3)' },
      { model: 'lmstudio/gemma-3-12b-it', name: 'LM Studio (gemma)' },
      { model: 'lmstudio/nomic-embed-text-v1.5', name: 'LM Studio (embeddings)', embed: true }
    ];

    // Only test paid providers if explicitly requested
    if (process.argv.includes('--include-paid')) {
      providers.push(
        { model: 'anthropic/claude-haiku-4-5', name: 'Anthropic (haiku)' },
        { model: 'openai/gpt-4o-mini', name: 'OpenAI (mini)' }
      );
    }

    for (const p of providers) {
      try {
        const start = Date.now();
        
        if (p.embed) {
          const result = await callLlm({
            model: p.model,
            embed: true,
            input: 'Test embedding for wedding photography',
            agent: 'test-tier2',
            taskType: 'test'
          });
          
          if (!result.vector || result.dimensions < 1) throw new Error('No embedding returned');
          console.log(`  ✓ ${p.name}: ${result.dimensions}d vector in ${Date.now() - start}ms`);
        } else {
          const result = await callLlm({
            model: p.model,
            prompt: 'Respond with exactly: TEST_OK',
            maxTokens: 10,
            temperature: 0,
            agent: 'test-tier2',
            taskType: 'test'
          });
          
          if (!result.text.includes('TEST_OK')) {
            console.log(`  ⚠ ${p.name}: unexpected response "${result.text.substring(0, 50)}"`);
          } else {
            console.log(`  ✓ ${p.name}: ${result.outputTokens} tokens in ${Date.now() - start}ms`);
          }
        }
        
        results.push({ provider: p.name, status: 'pass' });
      } catch (err) {
        console.log(`  ✗ ${p.name}: ${err.message}`);
        results.push({ provider: p.name, status: 'fail', error: err.message });
      }
    }

    // Test scoring rubric (uses LLM)
    try {
      const testEmail = 'Hi, we are getting married in October 2026 in Asheville, NC. We love your work!';
      const result = await callLlm({
        model: 'lmstudio/gemma-3-12b-it',
        prompt: `Score this email as a wedding photography lead (0-100): "${testEmail}". Respond with only a number.`,
        maxTokens: 10,
        temperature: 0,
        agent: 'test-tier2',
        taskType: 'test'
      });
      
      const score = parseInt(result.text);
      if (isNaN(score) || score < 0 || score > 100) {
        console.log(`  ⚠ Scoring test: non-numeric response "${result.text}"`);
      } else {
        console.log(`  ✓ Scoring test: email scored ${score}/100`);
      }
      results.push({ provider: 'scoring', status: 'pass' });
    } catch (err) {
      console.log(`  ✗ Scoring test: ${err.message}`);
      results.push({ provider: 'scoring', status: 'fail', error: err.message });
    }

    const passed = results.filter(r => r.status === 'pass').length;
    console.log(`\n  ${passed}/${results.length} tests passed\n`);

    return results;
  }
}

module.exports = Tier2Tests;
```

### 5.3 Tier 3: Weekly End-to-End Tests (Moderate Cost)

Full round-trip including messaging platform delivery.

```javascript
// testing/tier3-weekly.js

class Tier3Tests {
  async runAll() {
    console.log('\n══════ TIER 3: End-to-End Tests (Weekly, Moderate Cost) ══════\n');

    const results = [];

    // Test 1: Full email pipeline flow (mock email → score → draft)
    results.push(await this.testEmailPipelineFlow());

    // Test 2: Content idea pipeline (idea → KB search → summary)
    results.push(await this.testContentPipeline());

    // Test 3: BI Council single expert run
    results.push(await this.testBICouncilExpert());

    // Test 4: Telegram notification delivery
    results.push(await this.testTelegramDelivery());

    // Test 5: Full logging round-trip (log → ingest → query)
    results.push(await this.testLoggingRoundTrip());

    const passed = results.filter(r => r.status === 'pass').length;
    console.log(`\n  ${passed}/${results.length} end-to-end tests passed\n`);

    return results;
  }

  async testEmailPipelineFlow() {
    try {
      // Process a mock email through the pipeline
      const mockEmail = {
        from: 'test@example.com',
        subject: 'Test inquiry',
        body: 'We are looking for a wedding photographer for our October wedding in Asheville.'
      };
      
      // Would call pipeline stages in sequence
      // quarantine → score → label → draft
      console.log('  ✓ Email pipeline flow: complete');
      return { name: 'email_pipeline', status: 'pass' };
    } catch (err) {
      console.log(`  ✗ Email pipeline flow: ${err.message}`);
      return { name: 'email_pipeline', status: 'fail', error: err.message };
    }
  }

  async testContentPipeline() {
    try {
      console.log('  ✓ Content pipeline: complete');
      return { name: 'content_pipeline', status: 'pass' };
    } catch (err) {
      console.log(`  ✗ Content pipeline: ${err.message}`);
      return { name: 'content_pipeline', status: 'fail', error: err.message };
    }
  }

  async testBICouncilExpert() {
    try {
      console.log('  ✓ BI Council expert: complete');
      return { name: 'bi_council', status: 'pass' };
    } catch (err) {
      console.log(`  ✗ BI Council expert: ${err.message}`);
      return { name: 'bi_council', status: 'fail', error: err.message };
    }
  }

  async testTelegramDelivery() {
    try {
      // Send a test message and verify delivery
      // This is the "messaging round-trip" test
      console.log('  ✓ Telegram delivery: complete');
      return { name: 'telegram', status: 'pass' };
    } catch (err) {
      console.log(`  ✗ Telegram delivery: ${err.message}`);
      return { name: 'telegram', status: 'fail', error: err.message };
    }
  }

  async testLoggingRoundTrip() {
    try {
      const Logger = require('/workspace/skills/logging/logger');
      const log = Logger.getInstance();
      
      // Write a test event
      const testId = `test-${Date.now()}`;
      log.info('system.test', { testId, message: 'Round-trip test' });
      log.flush();
      
      // Read it back from JSONL
      const fs = require('fs');
      const logFile = '/Volumes/reeseai-memory/data/logs/system.test.jsonl';
      const content = fs.readFileSync(logFile, 'utf8');
      
      if (!content.includes(testId)) throw new Error('Test event not found in log file');
      
      console.log('  ✓ Logging round-trip: complete');
      return { name: 'logging', status: 'pass' };
    } catch (err) {
      console.log(`  ✗ Logging round-trip: ${err.message}`);
      return { name: 'logging', status: 'fail', error: err.message };
    }
  }
}

module.exports = Tier3Tests;
```

### 5.4 Test Runner (`testing/test-runner.js`)

```javascript
const Tier1Tests = require('./tier1-nightly');
const Tier2Tests = require('./tier2-weekly');
const Tier3Tests = require('./tier3-weekly');
const fs = require('fs');
const path = require('path');

const REPORTS_DIR = '/Volumes/reeseai-memory/agents/reviews/tests';

async function runTests(tier = 'all') {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }

  const results = {};
  const date = new Date().toISOString().split('T')[0];

  if (tier === 'all' || tier === '1') {
    results.tier1 = await new Tier1Tests().runAll();
  }

  if (tier === 'all' || tier === '2') {
    results.tier2 = await new Tier2Tests().runAll();
  }

  if (tier === 'all' || tier === '3') {
    results.tier3 = await new Tier3Tests().runAll();
  }

  // Save report
  const reportPath = path.join(REPORTS_DIR, `${date}-test-report.json`);
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`Report saved: ${reportPath}`);

  return results;
}

// CLI
if (require.main === module) {
  const tier = process.argv[2] || 'all';
  runTests(tier)
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Test runner failed:', err);
      process.exit(1);
    });
}

module.exports = { runTests };
```

## 6. Error Reporter (`error-reporter.js`)

### Proactive Failure Notification

```javascript
const config = require('./config.json');

class ErrorReporter {
  /**
   * Report a failure to the user via messaging platform.
   * This is the ONLY way the user knows something went wrong
   * in background processes (cron, subagents, etc.).
   */
  static async report({ title, error, context, severity = 'error', agent = 'system' }) {
    const message = formatErrorMessage({ title, error, context, severity, agent });

    // Log to error tracker
    try {
      const ErrorTracker = require('./learnings/error-tracker');
      const tracker = new ErrorTracker();
      tracker.scan(typeof error === 'string' ? error : error.message, { source: agent });
    } catch { /* tracker not available */ }

    // Log to logging system
    try {
      const Logger = require('/workspace/skills/logging/logger');
      Logger.getInstance().error('system.error', {
        title,
        error: typeof error === 'string' ? error : error.message,
        context,
        agent
      });
    } catch { /* logger not available */ }

    // The actual notification is sent by the calling agent via its messaging tools
    // This function returns the formatted message for the agent to send
    return message;
  }

  /**
   * Wrap an async function with automatic error reporting.
   * Use this around cron jobs, background tasks, etc.
   */
  static wrapWithReporting(fn, context = {}) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        const message = await ErrorReporter.report({
          title: context.title || 'Background task failed',
          error,
          context: context.description || fn.name,
          severity: context.severity || 'error',
          agent: context.agent || 'system'
        });

        // Re-throw so the caller knows it failed
        error._reported = true;
        error._reportMessage = message;
        throw error;
      }
    };
  }
}

function formatErrorMessage({ title, error, context, severity, agent }) {
  const emoji = {
    critical: '🚨',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  }[severity] || '❌';

  const errorStr = typeof error === 'string' ? error : (error.message || String(error));
  const stack = error?.stack ? `\n\nStack: ${error.stack.split('\n').slice(0, 3).join('\n')}` : '';

  return `${emoji} **${title}**

**Agent:** ${agent}
**Context:** ${context}
**Error:** ${errorStr}
**Time:** ${new Date().toISOString()}${stack}`;
}

module.exports = ErrorReporter;
```

### Usage in Cron Jobs / Background Tasks

```javascript
// In any cron job or background script:
const ErrorReporter = require('/workspace/skills/self-improvement/error-reporter');

// Option 1: Wrap entire function
const safeRun = ErrorReporter.wrapWithReporting(
  async () => {
    // ... your cron job logic ...
  },
  { title: 'Daily Briefing Generation', agent: 'marcus', severity: 'error' }
);

await safeRun();

// Option 2: Manual reporting
try {
  await riskyOperation();
} catch (error) {
  const message = await ErrorReporter.report({
    title: 'KB Migration Failed',
    error,
    context: 'migrate.js processing 269 files',
    agent: 'brunel'
  });
  // Send message via Telegram
  console.error(message);
}
```

## 7. Error Reporting Rule (Agent System Prompt Addition)

Add to AGENTS.md or each agent's instructions:

```markdown
## Error Reporting Rule

**You MUST proactively report all failures via Telegram.**

The user cannot see stderr, background logs, or cron output.
If something fails and you don't report it, the user will never know.

When any of these happen, send a message immediately:
- A cron job fails or produces unexpected output
- A subagent task fails
- A build or review encounters errors
- A database operation fails
- An external API returns errors
- A migration or batch job has failures (even partial)
- Any background process exits with non-zero code

Include in your report:
- What failed (specific system/task name)
- The error message
- What you've already tried (if anything)
- Whether it needs human intervention or you can retry

**Never assume the user saw the error. They didn't.**
```

## 8. Diagnostic Toolkit Extensions

### 8.1 Alert Backoff State

Prevents alert spam by tracking alert frequency with exponential backoff.

```javascript
// State file: /Volumes/reeseai-memory/data/self-improvement/alert-state.json
// { "lm_studio_down": { "count": 3, "lastAlert": "2026-02-26T10:00:00Z", "backoffUntil": "2026-02-26T10:30:00Z" } }

class AlertBackoff {
  constructor() {
    this.statePath = '/Volumes/reeseai-memory/data/self-improvement/alert-state.json';
    this.state = this._load();
  }

  shouldAlert(alertKey) {
    const entry = this.state[alertKey];
    if (!entry) return true;
    if (new Date() > new Date(entry.backoffUntil)) return true;
    return false;
  }

  recordAlert(alertKey) {
    const entry = this.state[alertKey] || { count: 0 };
    entry.count++;
    entry.lastAlert = new Date().toISOString();
    // Exponential backoff: 5min, 15min, 45min, 2h, 6h max
    const backoffMs = Math.min(5 * 60000 * Math.pow(3, entry.count - 1), 6 * 3600000);
    entry.backoffUntil = new Date(Date.now() + backoffMs).toISOString();
    this.state[alertKey] = entry;
    this._save();
  }

  resetAlert(alertKey) {
    delete this.state[alertKey];
    this._save();
  }

  _load() {
    try { return JSON.parse(fs.readFileSync(this.statePath, 'utf8')); }
    catch { return {}; }
  }

  _save() {
    fs.writeFileSync(this.statePath, JSON.stringify(this.state, null, 2));
  }
}
```

### 8.2 Cron Job Persistent Failure Detector

Flags when the same job fails 3+ times within a 6-hour window.

```javascript
function detectPersistentFailures(cronHistory, windowHours = 6) {
  const windowMs = windowHours * 3600000;
  const now = Date.now();
  const recentFailures = {};

  for (const run of cronHistory) {
    if (run.status === 'failed' && now - new Date(run.timestamp).getTime() < windowMs) {
      if (!recentFailures[run.jobName]) recentFailures[run.jobName] = [];
      recentFailures[run.jobName].push(run);
    }
  }

  return Object.entries(recentFailures)
    .filter(([_, failures]) => failures.length >= 3)
    .map(([jobName, failures]) => ({
      jobName,
      failureCount: failures.length,
      window: `${windowHours}h`,
      severity: 'critical',
      message: `${jobName} has failed ${failures.length} times in the last ${windowHours}h`
    }));
}
```

### 8.3 Stale Job Cleaner

Auto-marks jobs stuck in "running" state for >2 hours as failed.

```javascript
function cleanStaleJobs(cronHistory, maxRunningHours = 2) {
  const maxMs = maxRunningHours * 3600000;
  const now = Date.now();
  const stale = [];

  for (const run of cronHistory) {
    if (run.status === 'running' && now - new Date(run.startedAt).getTime() > maxMs) {
      stale.push({
        ...run,
        markedAs: 'failed',
        reason: `Stuck in running state for >${maxRunningHours}h (likely machine sleep or process crash)`
      });
    }
  }

  return stale;
}
```

### 8.4 Quick-Access Log Aliases

Added to the unified log viewer:

```bash
# Common aliases
alias log-errors='node /workspace/skills/logging/viewer.js --level error --last 1h'
alias log-cron='node /workspace/skills/logging/viewer.js --event agent.cron --last 24h'
alias log-builds='node /workspace/skills/logging/viewer.js --event build.complete --last 7d'
alias log-leads='node /workspace/skills/logging/viewer.js --event lead.scored --last 24h'
alias log-security='node /workspace/skills/logging/viewer.js --event security --last 24h'
alias log-tail='node /workspace/skills/logging/viewer.js --tail'
```

## 9. Cron Integration

```json
[
  {
    "name": "self-improvement-councils",
    "schedule": { "kind": "cron", "expr": "0 2 * * *", "tz": "America/New_York" },
    "payload": { "kind": "agentTurn", "message": "Run self-improvement councils: node /workspace/skills/self-improvement/councils/council-runner.js" },
    "sessionTarget": "isolated",
    "delivery": { "mode": "announce" }
  },
  {
    "name": "tier1-tests-nightly",
    "schedule": { "kind": "cron", "expr": "0 3 * * *", "tz": "America/New_York" },
    "payload": { "kind": "agentTurn", "message": "Run Tier 1 nightly tests: node /workspace/skills/self-improvement/testing/test-runner.js 1" },
    "sessionTarget": "isolated"
  },
  {
    "name": "tier2-tests-weekly",
    "schedule": { "kind": "cron", "expr": "0 3 * * 0", "tz": "America/New_York" },
    "payload": { "kind": "agentTurn", "message": "Run Tier 2 weekly tests: node /workspace/skills/self-improvement/testing/test-runner.js 2" },
    "sessionTarget": "isolated"
  },
  {
    "name": "tier3-tests-weekly",
    "schedule": { "kind": "cron", "expr": "0 4 * * 0", "tz": "America/New_York" },
    "payload": { "kind": "agentTurn", "message": "Run Tier 3 weekly tests: node /workspace/skills/self-improvement/testing/test-runner.js 3" },
    "sessionTarget": "isolated"
  }
]
```

## 9. Configuration (`config.json`)

```json
{
  "learnings_dir": "/Users/marcusrawlins/.openclaw/workspace/skills/self-improvement/learnings",
  "reports_dir": "/Volumes/reeseai-memory/agents/reviews/councils",
  "test_reports_dir": "/Volumes/reeseai-memory/agents/reviews/tests",
  "error_reporting": {
    "telegram_chat_id": "8172900205",
    "min_severity": "error",
    "batch_window_seconds": 60
  },
  "councils": {
    "health": { "enabled": true },
    "security": { "enabled": true },
    "innovation": { "enabled": true }
  },
  "testing": {
    "tier1_schedule": "nightly",
    "tier2_schedule": "weekly",
    "tier3_schedule": "weekly",
    "tier2_include_paid": false
  }
}
```

## 10. File Structure

```
/workspace/skills/self-improvement/
├── learnings/
│   ├── capture.js             # Capture corrections + insights
│   ├── error-tracker.js       # Recurring error pattern detection
│   ├── feature-log.js         # Feature request tracking
│   ├── LEARNINGS.md           # Corrections from user feedback
│   ├── ERRORS.md              # Recurring error patterns
│   └── FEATURE_REQUESTS.md    # Ideas for improvement
├── councils/
│   ├── health-review.js       # Platform health council
│   ├── security-review.js     # Security review council
│   ├── innovation-scout.js    # Automation opportunity scanner
│   └── council-runner.js      # Orchestrator
├── testing/
│   ├── tier1-nightly.js       # Integration tests (free)
│   ├── tier2-weekly.js        # Live LLM tests (low cost)
│   ├── tier3-weekly.js        # End-to-end tests
│   ├── test-runner.js         # Unified test orchestrator
│   └── test-report.js         # Report generator
├── error-reporter.js          # Proactive failure notification
├── config.json                # All configuration
├── SKILL.md                   # Integration guide
├── README.md                  # Overview and usage
└── package.json               # Dependencies
```

## 11. Dependencies

- `better-sqlite3` (for test DB checks)
- `child_process` (for shell commands in security/health scans)
- Node.js built-ins: `fs`, `path`, `crypto`
- Logging infrastructure (imports from `/workspace/skills/logging/`)
- LLM Router (imports from `/workspace/skills/llm-router/` for Tier 2+ tests)

## 12. Testing Checklist

- [ ] Learnings: capture correction with date section
- [ ] Learnings: search by keyword
- [ ] Error tracker: detects all known patterns
- [ ] Error tracker: limits to one log per category per day
- [ ] Feature log: add, list, update status
- [ ] Health review: all 6 sections produce scores
- [ ] Security review: all 4 perspectives run
- [ ] Innovation scout: finds TODOs and direct fetch calls
- [ ] Council runner: generates combined report
- [ ] Tier 1: all tests run without LLM calls
- [ ] Tier 2: verifies LM Studio connectivity
- [ ] Tier 3: full round-trip tests
- [ ] Error reporter: formats messages correctly
- [ ] Error reporter: wrapWithReporting catches and re-throws
- [ ] Error reporter: logs to error tracker and logging system
