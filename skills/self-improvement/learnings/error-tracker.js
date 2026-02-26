const fs = require('fs');
const path = require('path');
const config = require('../config.json');

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
