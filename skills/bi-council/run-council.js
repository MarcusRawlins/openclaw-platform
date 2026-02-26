#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { syncAll } = require('./sync-all');
const { runExperts } = require('./run-experts');
const { Synthesizer } = require('./synthesize');
const { formatDigest } = require('./format-digest');

const DIGESTS_DIR = '/Volumes/reeseai-memory/bi-council/digests';

async function runCouncil() {
  console.log('\n' + '━'.repeat(60));
  console.log('   🏛 BUSINESS INTELLIGENCE COUNCIL — NIGHTLY RUN');
  console.log('━'.repeat(60));

  const startTime = Date.now();

  try {
    // Step 1: Sync all data
    console.log('\n📌 Step 1/4: SYNCING DATA SOURCES\n');
    await syncAll();

    // Step 2: Run expert analyses (parallel)
    console.log('\n📌 Step 2/4: RUNNING EXPERT ANALYSES\n');
    const { sessionId, analysisCount, totalRecommendations } = await runExperts();

    // Step 3: Synthesize findings
    console.log('\n📌 Step 3/4: SYNTHESIZING FINDINGS\n');
    const synthesizer = new Synthesizer();
    const synthesis = await synthesizer.synthesize(sessionId);
    synthesizer.close();

    // Step 4: Format and save digest
    console.log('\n📌 Step 4/4: FORMATTING & SAVING DIGEST\n');
    const digest = formatDigest(synthesis);

    // Ensure digest directory exists
    if (!fs.existsSync(DIGESTS_DIR)) {
      fs.mkdirSync(DIGESTS_DIR, { recursive: true });
    }

    // Save digest to file
    const date = new Date().toISOString().split('T')[0];
    const digestPath = path.join(DIGESTS_DIR, `${date}-council-digest.md`);
    fs.writeFileSync(digestPath, digest);

    console.log(`  ✓ Digest saved to ${digestPath}\n`);
    console.log('━'.repeat(60));
    console.log('  ✓ COUNCIL COMPLETE');
    console.log('━'.repeat(60));

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`
  Session ID: ${sessionId}
  Duration: ${elapsed}s
  Experts: ${analysisCount}
  Recommendations: ${totalRecommendations}

  Next steps:
  • Review the digest
  • Accept/reject recommendations: council accept <id> | council reject <id> <reason>
  • Deep dive: council explore ${sessionId}
  • View history: council history 7
  `);

    console.log('\n🏛 Council digest:\n');
    console.log(digest);
    console.log('\n' + '━'.repeat(60) + '\n');

    return { sessionId, digest };
  } catch (err) {
    console.error('\n✗ COUNCIL RUN FAILED');
    console.error(err.message);
    if (err.stack) {
      console.error(err.stack);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\nFailed after ${elapsed}s`);

    process.exit(1);
  }
}

// CLI entry point
if (require.main === module) {
  runCouncil().then(() => process.exit(0));
}

module.exports = { runCouncil };
