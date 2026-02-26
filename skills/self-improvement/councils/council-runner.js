const HealthReview = require('./health-review');
const SecurityReview = require('./security-review');
const InnovationScout = require('./innovation-scout');
const fs = require('fs');
const path = require('path');

const config = require('../config.json');
const REPORTS_DIR = config.reports_dir;

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
