#!/usr/bin/env node

const queue = require('./queue');

const tier = process.argv[2];

if (!tier || !['high', 'medium', 'all'].includes(tier)) {
  console.error('Usage: node flush.js <high|medium|all>');
  console.error('Flushes queued messages for the specified tier(s)');
  process.exit(1);
}

(async () => {
  try {
    const results = {};
    
    if (tier === 'all') {
      const high = await queue.flush('high');
      const medium = await queue.flush('medium');
      results.high = high.flushed;
      results.medium = medium.flushed;
      console.log(`✓ Flushed: ${high.flushed} high-priority, ${medium.flushed} medium-priority messages`);
    } else {
      const result = await queue.flush(tier);
      results[tier] = result.flushed;
      console.log(`✓ Flushed ${result.flushed} ${tier}-priority messages`);
    }

    // Also expire stale messages
    const expired = queue.expireStale();
    if (expired > 0) {
      console.log(`✓ Expired ${expired} stale messages (>24 hours old)`);
    }

    // Show current queue stats
    const stats = queue.stats();
    console.log(`\nQueue stats after flush:`);
    console.log(`  Critical (queued): ${stats.critical}`);
    console.log(`  High (queued): ${stats.high}`);
    console.log(`  Medium (queued): ${stats.medium}`);
    console.log(`  Total queued: ${stats.total_queued}`);
    console.log(`  Total delivered: ${stats.total_delivered}`);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
