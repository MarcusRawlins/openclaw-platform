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
        result.score = 5; // Not a failure, just no data yet
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

      const reliabilityPct = total > 0 ? ((total - errors) / total) * 100 : 100;
      
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
      result.score = 5;
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
