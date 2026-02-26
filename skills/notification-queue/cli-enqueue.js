#!/usr/bin/env node

const queue = require('./queue');

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: cli-enqueue.js <message> [tier] [source] [channel] [topic] [bypass]');
  process.exit(1);
}

const message = args[0];
const tier = args[1] || null;
const source = args[2] || 'cli';
const channel = args[3] || 'telegram';
const topic = args[4] || null;
const bypass = args[5] === 'true';

(async () => {
  try {
    const result = await queue.enqueue(message, {
      tier,
      source,
      channel,
      topic,
      bypass
    });
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
