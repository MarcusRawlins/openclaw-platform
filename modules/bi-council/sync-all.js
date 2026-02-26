#!/usr/bin/env node

const MissionControlSync = require('./sync-mission-control');
const CRMSync = require('./sync-crm');
const SocialSync = require('./sync-social');
const FinancialImport = require('./import-financial');

async function syncAll() {
  console.log('\n' + '━'.repeat(50));
  console.log('  🏛 BUSINESS INTELLIGENCE COUNCIL: DATA SYNC');
  console.log('━'.repeat(50) + '\n');

  const results = {};
  const startTime = Date.now();

  try {
    // Sync Mission Control
    const mcSync = new MissionControlSync();
    results.missionControl = mcSync.sync();
    mcSync.close();
  } catch (err) {
    console.error('  ✗ Mission Control sync failed:', err.message);
    results.missionControl = 0;
  }

  try {
    // Sync CRM
    const crmSync = new CRMSync();
    results.crm = crmSync.sync();
    crmSync.close();
  } catch (err) {
    console.error('  ✗ CRM sync failed:', err.message);
    results.crm = 0;
  }

  try {
    // Sync Social
    const socialSync = new SocialSync();
    results.social = socialSync.sync();
    socialSync.close();
  } catch (err) {
    console.error('  ✗ Social sync failed:', err.message);
    results.social = 0;
  }

  try {
    // Import Financial
    const finance = new FinancialImport();
    results.financial = finance.importFromFinancialTrackingSkill();
    finance.close();
  } catch (err) {
    console.error('  ✗ Financial import failed:', err.message);
    results.financial = 0;
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n' + '━'.repeat(50));
  console.log('  ✓ SYNC COMPLETE');
  console.log('━'.repeat(50));
  console.log(`  Mission Control: ${results.missionControl} tasks`);
  console.log(`  CRM: ${results.crm} records`);
  console.log(`  Social: ${results.social} metrics`);
  console.log(`  Financial: ${results.financial} records`);
  console.log(`  Time: ${elapsed}s`);
  console.log('━'.repeat(50) + '\n');

  return results;
}

// CLI entry point
if (require.main === module) {
  syncAll()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\nSync failed:', err);
      process.exit(1);
    });
}

module.exports = { syncAll };
