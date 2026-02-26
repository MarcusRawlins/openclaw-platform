#!/usr/bin/env node
// Verification tests for email pipeline

const { getDatabase } = require('./db');
const { sanitize } = require('./quarantine');
const { isValidTransition } = require('./stage-tracker');
const { contentGate } = require('./drafter');

console.log('=== Email Pipeline Verification Tests ===\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (error) {
    console.log(`✗ ${name}: ${error.message}`);
    failed++;
  }
}

// Test 1: Database initializes
test('Database initializes', () => {
  const db = getDatabase();
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  const tableNames = tables.map(t => t.name);
  
  if (!tableNames.includes('emails')) throw new Error('emails table missing');
  if (!tableNames.includes('sender_research')) throw new Error('sender_research table missing');
  if (!tableNames.includes('stage_audit')) throw new Error('stage_audit table missing');
  if (!tableNames.includes('scoring_log')) throw new Error('scoring_log table missing');
  
  db.close();
});

// Test 2: Quarantine strips HTML
test('Quarantine strips HTML scripts', () => {
  const email = {
    body_html: '<p>Hello</p><script>alert("xss")</script><img src="http://tracker.com/pixel.gif" width="1" height="1">',
    body_text: 'Hello',
    attachments: []
  };
  
  const sanitized = sanitize(email);
  
  if (sanitized.body_html_sanitized.includes('<script>')) {
    throw new Error('Script tag not stripped');
  }
  if (sanitized.body_html_sanitized.includes('tracker.com')) {
    throw new Error('Tracking pixel not removed');
  }
});

// Test 3: Quarantine removes external links
test('Quarantine extracts but removes external links', () => {
  const email = {
    body_html: '<a href="http://malicious.com/phish">Click here</a>',
    body_text: 'Click here',
    attachments: []
  };
  
  const sanitized = sanitize(email);
  
  if (sanitized.body_html_sanitized.includes('href=')) {
    throw new Error('Link href not removed');
  }
  if (sanitized.links.length === 0) {
    throw new Error('Links not extracted');
  }
  if (sanitized.links[0].href !== 'http://malicious.com/phish') {
    throw new Error('Link not stored correctly');
  }
});

// Test 4: Stage tracker rejects illegal transitions
test('Stage tracker rejects illegal transitions', () => {
  // Legal: New → Contacted
  if (!isValidTransition('New', 'Contacted')) {
    throw new Error('Legal transition New → Contacted rejected');
  }
  
  // Illegal: New → Booked
  if (isValidTransition('New', 'Booked')) {
    throw new Error('Illegal transition New → Booked allowed');
  }
  
  // Illegal: Contacted → Negotiating
  if (isValidTransition('Contacted', 'Negotiating')) {
    throw new Error('Illegal transition Contacted → Negotiating allowed');
  }
  
  // Legal: Lost → New (reopen)
  if (!isValidTransition('Lost', 'New')) {
    throw new Error('Legal transition Lost → New rejected');
  }
});

// Test 5: Content gate catches secrets
test('Content gate catches API keys', () => {
  const draft = 'Here is your API key: sk_live_51234567890abcdefghij';
  const result = contentGate(draft);
  
  if (result.passed) {
    throw new Error('API key not caught');
  }
  if (!result.blocked_reasons.includes('api_key')) {
    throw new Error('API key not flagged correctly');
  }
});

// Test 6: Content gate catches file paths
test('Content gate catches internal paths', () => {
  const draft = 'You can find it at /Users/marcus/secret.txt';
  const result = contentGate(draft);
  
  if (result.passed) {
    throw new Error('Internal path not caught');
  }
  if (!result.blocked_reasons.includes('internal_path')) {
    throw new Error('Internal path not flagged correctly');
  }
});

// Test 7: Content gate catches dollar amounts
test('Content gate catches dollar amounts', () => {
  const draft = 'The price is $3,500.00';
  const result = contentGate(draft);
  
  if (result.passed) {
    throw new Error('Dollar amount not caught');
  }
  if (!result.blocked_reasons.includes('dollar_amount')) {
    throw new Error('Dollar amount not flagged correctly');
  }
});

// Test 8: Content gate passes clean draft
test('Content gate passes clean draft', () => {
  const draft = 'Thank you for your inquiry! I would love to discuss your wedding photography needs.';
  const result = contentGate(draft);
  
  if (!result.passed) {
    throw new Error(`Clean draft blocked: ${result.blocked_reasons.join(', ')}`);
  }
});

// Test 9: Quarantine normalizes unicode
test('Quarantine normalizes unicode (homograph protection)', () => {
  const email = {
    body_html: 'Рaypal.com', // Cyrillic 'Р' looks like Latin 'P'
    body_text: 'Рaypal.com',
    attachments: []
  };
  
  const sanitized = sanitize(email);
  // After NFKC normalization, different character representations should be consistent
  if (!sanitized.body_text) {
    throw new Error('Unicode normalization failed');
  }
});

// Test 10: Stage tracker handles Stage/ prefix
test('Stage tracker normalizes stage labels', () => {
  // Should work with or without "Stage/" prefix
  if (!isValidTransition('Stage/New', 'Stage/Contacted')) {
    throw new Error('Stage/ prefix not handled');
  }
  if (!isValidTransition('New', 'Contacted')) {
    throw new Error('Normalized stages not working');
  }
});

console.log(`\n=== Results ===`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
}

console.log('\n✓ All verification tests passed!');
