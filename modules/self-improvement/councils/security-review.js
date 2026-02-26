const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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
        if (latest) {
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
