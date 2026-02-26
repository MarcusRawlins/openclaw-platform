#!/usr/bin/env node
/**
 * CRM Engine Verification Tests
 * 
 * Tests all checklist items from the spec
 */

const fs = require('fs');
const path = require('path');
const { getDatabase, initDatabase } = require('./db');
const CONFIG = require('./config.json');

// Test database path (separate from production)
const TEST_DB_PATH = path.join(__dirname, 'test-crm.db');
CONFIG.database.path = TEST_DB_PATH;

// Track test results
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function test(name, fn) {
  try {
    fn();
    results.passed++;
    results.tests.push({ name, status: 'PASS' });
    console.log(`✅ ${name}`);
  } catch (error) {
    results.failed++;
    results.tests.push({ name, status: 'FAIL', error: error.message });
    console.error(`❌ ${name}`);
    console.error(`   ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

console.log('🧪 CRM Engine Verification Tests\n');
console.log('='.repeat(60));

// Cleanup test database before starting
if (fs.existsSync(TEST_DB_PATH)) {
  fs.unlinkSync(TEST_DB_PATH);
}

// Test 1: Database initialization
test('Database initializes with all tables and indexes', () => {
  const db = initDatabase();
  
  const tables = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
  `).all().map(t => t.name);
  
  const expectedTables = [
    'contacts',
    'interactions',
    'follow_ups',
    'contact_context',
    'contact_summaries',
    'company_news',
    'discovery_decisions',
    'skip_patterns'
  ];
  
  expectedTables.forEach(table => {
    assert(tables.includes(table), `Missing table: ${table}`);
  });
  
  // Check WAL mode
  const walMode = db.pragma('journal_mode', { simple: true });
  assert(walMode === 'wal', `Expected WAL mode, got ${walMode}`);
  
  db.close();
});

// Test 2: Contact CRUD operations
test('Contact CRUD operations work', () => {
  const { addContact, getContact, updateContact, deleteContact } = require('./contacts');
  
  // Create
  const result = addContact({
    first_name: 'Test',
    last_name: 'User',
    email: 'test@example.com',
    company: 'Test Inc',
    priority: 'high'
  });
  
  assert(result.id, 'Contact creation should return ID');
  
  // Read
  const contact = getContact(result.id);
  assert(contact.first_name === 'Test', 'Should retrieve correct contact');
  assert(contact.email === 'test@example.com', 'Email should match');
  
  // Update
  updateContact(result.id, { company: 'Updated Inc' });
  const updated = getContact(result.id);
  assert(updated.company === 'Updated Inc', 'Should update contact');
  
  // Delete (soft delete - marks skip_pattern)
  deleteContact(result.id);
  const deleted = getContact(result.id);
  assert(deleted.skip_pattern === 1, 'Should soft delete contact');
});

// Test 3: Deduplication
test('Deduplication detects exact email matches', () => {
  const { addContact, getContactByEmail } = require('./contacts');
  
  const result1 = addContact({
    first_name: 'Duplicate',
    last_name: 'Test',
    email: 'dup@example.com'
  });
  
  assert(result1.id, 'First contact should be created');
  
  const result2 = addContact({
    first_name: 'Another',
    last_name: 'Duplicate',
    email: 'dup@example.com'
  });
  
  assert(result2.error, 'Second contact with same email should fail');
  
  const contact = getContactByEmail('dup@example.com');
  assert(contact.first_name === 'Duplicate', 'Should keep first contact');
});

// Test 4: Discovery filters
test('Discovery filters out noreply/newsletter senders', () => {
  const { shouldSkip } = require('./discovery');
  
  const noreply = shouldSkip('noreply@github.com');
  assert(noreply.skip, 'Should skip noreply addresses');
  
  const donotreply = shouldSkip('donotreply@service.com');
  assert(donotreply.skip, 'Should skip donotreply addresses');
  
  const normal = shouldSkip('hello@example.com');
  assert(!normal.skip, 'Should not skip normal addresses');
});

// Test 5: Skip patterns
test('Skip patterns learned from rejections', () => {
  const { recordDecision, shouldSkip } = require('./discovery');
  const db = getDatabase();
  
  // Record multiple rejections for a domain
  for (let i = 0; i < 6; i++) {
    recordDecision(`test${i}@spam-domain.com`, 'Test User', 'rejected', false);
  }
  
  // Check if skip pattern was learned
  const skipCheck = shouldSkip('newuser@spam-domain.com');
  assert(skipCheck.skip, 'Should learn to skip domain after multiple rejections');
  assert(skipCheck.reason === 'learned_skip_pattern', 'Reason should be learned pattern');
});

// Test 6: Relationship scorer
test('Relationship scorer produces 0-100 for various scenarios', () => {
  const { calculateScore } = require('./scorer');
  const { addContact } = require('./contacts');
  const { logInteraction } = require('./interactions');
  
  // Create contact
  const result = addContact({
    first_name: 'Score',
    last_name: 'Test',
    email: 'score@example.com',
    priority: 'vip'
  });
  
  // No interactions - should have low score
  const score1 = calculateScore(
    { id: result.id, priority: 'normal', relationship_score: 0 },
    []
  );
  assert(score1.score >= 0 && score1.score <= 100, 'Score should be 0-100');
  assert(score1.score < 50, 'No interactions should yield low score');
  
  // With recent interactions - should be higher
  const interactions = [
    { occurred_at: new Date().toISOString(), direction: 'inbound', summary: 'Test message here' },
    { occurred_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), direction: 'outbound', summary: 'Another test' }
  ];
  
  const score2 = calculateScore(
    { id: result.id, priority: 'vip', relationship_score: 0 },
    interactions
  );
  assert(score2.score >= 0 && score2.score <= 100, 'Score should be 0-100');
  assert(score2.score > score1.score, 'Recent interactions should increase score');
});

// Test 7: Nudge rules
test('Nudge rules trigger correctly', () => {
  const { addContact } = require('./contacts');
  const { generate } = require('./nudges');
  
  // Create a VIP with low score (should trigger dormant_high_value nudge)
  const result = addContact({
    first_name: 'Nudge',
    last_name: 'Test',
    email: 'nudge@example.com',
    priority: 'vip'
  });
  
  const db = getDatabase();
  db.prepare('UPDATE contacts SET relationship_score = 30 WHERE id = ?').run(result.id);
  
  const nudges = generate();
  const hasNudge = nudges.some(n => n.contact_id === result.id);
  
  assert(hasNudge, 'Should generate nudge for low-score VIP');
});

// Test 8: Intent detection
test('Intent detection matches all query types', () => {
  const { detectIntent } = require('./query');
  
  const tests = [
    { query: 'tell me about Jane Doe', expected: 'contact_lookup' },
    { query: 'who works at Acme?', expected: 'company_lookup' },
    { query: 'who needs attention?', expected: 'nudge_report' },
    { query: 'stats', expected: 'stats' },
    { query: 'search photographer', expected: 'search' }
  ];
  
  tests.forEach(t => {
    const intent = detectIntent(t.query);
    assert(intent.type === t.expected, `Query "${t.query}" should detect ${t.expected}, got ${intent.type}`);
  });
});

// Test 9: Follow-up operations
test('Follow-up snoozing works', () => {
  const { addContact } = require('./contacts');
  const { createFollowUp, snoozeFollowUp, getFollowUps } = require('./follow-ups');
  
  const contact = addContact({
    first_name: 'Followup',
    last_name: 'Test',
    email: 'followup@example.com'
  });
  
  const followUp = createFollowUp(contact.id, {
    description: 'Test follow-up',
    due_date: '2026-03-01'
  });
  
  snoozeFollowUp(followUp.id, '2026-03-15');
  
  const followUps = getFollowUps({ contactId: contact.id });
  const snoozed = followUps.find(f => f.id === followUp.id);
  
  assert(snoozed.status === 'snoozed', 'Follow-up should be snoozed');
  assert(snoozed.snoozed_until === '2026-03-15', 'Snooze date should match');
});

// Test 10: Draft safety gate
test('Draft generation respects safety gate (disabled by default)', () => {
  const { generateDraft } = require('./drafts');
  
  let errorThrown = false;
  try {
    // This should throw because drafts are disabled by default
    // Note: generateDraft is async but checkEnabled() throws synchronously
    const result = generateDraft(1);
    // If we get here without error, it means checkEnabled didn't throw
    if (result && result.then) {
      // It's a promise, which means checkEnabled didn't throw
      assert(false, 'Should throw error synchronously when drafts are disabled');
    }
  } catch (error) {
    errorThrown = true;
    assert(error.message.includes('disabled'), 'Error should mention drafts are disabled');
  }
  
  assert(errorThrown, 'Should throw error when drafts are disabled');
});

// Test 11: Interaction logging
test('Interaction logging works', () => {
  const { addContact } = require('./contacts');
  const { logInteraction, getInteractions } = require('./interactions');
  
  const contact = addContact({
    first_name: 'Interaction',
    last_name: 'Test',
    email: 'interaction@example.com'
  });
  
  const result = logInteraction(contact.id, {
    type: 'email_sent',
    subject: 'Test email',
    summary: 'This is a test',
    direction: 'outbound'
  });
  
  assert(result.id, 'Should return interaction ID');
  
  const interactions = getInteractions(contact.id);
  assert(interactions.length > 0, 'Should retrieve interactions');
  assert(interactions[0].type === 'email_sent', 'Should match interaction type');
});

// Test 12: Search functionality
test('Contact search works', () => {
  const { addContact, searchContacts } = require('./contacts');
  
  addContact({
    first_name: 'Searchable',
    last_name: 'Contact',
    email: 'search@test.com',
    company: 'SearchCo'
  });
  
  const results = searchContacts('Searchable');
  assert(results.length > 0, 'Should find contact by name');
  
  const results2 = searchContacts('SearchCo');
  assert(results2.length > 0, 'Should find contact by company');
});

// Test 13: Stats generation
test('Stats generation works', () => {
  const { getStats } = require('./api');
  
  const stats = getStats();
  
  assert(typeof stats.total_contacts === 'number', 'Should return total contacts');
  assert(typeof stats.average_score === 'number', 'Should return average score');
  assert(Array.isArray(stats.by_priority), 'Should return priority breakdown');
});

// Test 14: API exports
test('API module exports all documented functions', () => {
  const api = require('./api');
  
  const requiredFunctions = [
    'getContact',
    'getContactByEmail',
    'addContact',
    'updateContact',
    'listContacts',
    'searchContacts',
    'mergeContacts',
    'deleteContact',
    'logInteraction',
    'getInteractions',
    'createFollowUp',
    'getFollowUps',
    'scoreContact',
    'getNudges',
    'getProfile',
    'query',
    'getStats'
  ];
  
  requiredFunctions.forEach(fn => {
    assert(typeof api[fn] === 'function', `API should export ${fn}`);
  });
});

// Test 15: Database integrity
test('Database enforces foreign keys', () => {
  const db = getDatabase();
  
  let errorThrown = false;
  try {
    // Try to insert interaction for non-existent contact
    db.prepare(`
      INSERT INTO interactions (contact_id, type, occurred_at)
      VALUES (99999, 'email_sent', datetime('now'))
    `).run();
  } catch (error) {
    errorThrown = true;
  }
  
  assert(errorThrown, 'Should enforce foreign key constraints');
});

// Test 16: Merge contacts
test('Contact merge works correctly', () => {
  const { addContact, mergeContacts, getContact } = require('./contacts');
  const { logInteraction, getInteractions } = require('./interactions');
  
  const contact1 = addContact({
    first_name: 'Merge1',
    email: 'merge1@test.com'
  });
  
  const contact2 = addContact({
    first_name: 'Merge2',
    email: 'merge2@test.com'
  });
  
  // Add interaction to contact2
  logInteraction(contact2.id, {
    type: 'email_received',
    subject: 'Test'
  });
  
  // Merge contact2 into contact1
  mergeContacts(contact1.id, contact2.id);
  
  // Check that contact2 is deleted
  const deleted = getContact(contact2.id);
  assert(!deleted, 'Merged contact should be deleted');
  
  // Check that interactions moved
  const interactions = getInteractions(contact1.id);
  assert(interactions.length > 0, 'Interactions should move to kept contact');
});

// Test 17: Auto-add logic
test('Auto-add logic calculates approval rate', () => {
  const { shouldAutoAdd, recordDecision } = require('./discovery');
  
  const testDomain = 'auto-test.com';
  
  // Record 10 approvals
  for (let i = 0; i < 10; i++) {
    recordDecision(`user${i}@${testDomain}`, 'Test User', 'approved', false);
  }
  
  const decision = shouldAutoAdd(`newuser@${testDomain}`);
  assert(decision.auto === true, 'Should auto-add after high approval rate');
  assert(decision.reason === 'high_approval_domain', 'Reason should be high approval domain');
});

// Test 18: Query natural language handling
test('Query handles natural language correctly', () => {
  const { query } = require('./query');
  
  const result = query('stats');
  
  assert(result.type === 'stats', 'Should detect stats intent');
  assert(result.message, 'Should return formatted message');
  assert(typeof result.total === 'number', 'Should return total contacts');
});

// Cleanup
console.log('\n' + '='.repeat(60));
console.log(`\n📊 Test Results: ${results.passed} passed, ${results.failed} failed\n`);

if (results.failed === 0) {
  console.log('✅ All tests passed!\n');
  
  // Cleanup test database
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
    const walFile = TEST_DB_PATH + '-wal';
    const shmFile = TEST_DB_PATH + '-shm';
    if (fs.existsSync(walFile)) fs.unlinkSync(walFile);
    if (fs.existsSync(shmFile)) fs.unlinkSync(shmFile);
  }
  
  process.exit(0);
} else {
  console.log('❌ Some tests failed. Review errors above.\n');
  process.exit(1);
}
