const Tier1Tests = require('./tier1-nightly');
const Tier2Tests = require('./tier2-weekly');
const Tier3Tests = require('./tier3-weekly');
const fs = require('fs');
const path = require('path');
const config = require('../config.json');

const REPORTS_DIR = config.test_reports_dir;

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
