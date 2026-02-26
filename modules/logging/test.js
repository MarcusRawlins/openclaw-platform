#!/usr/bin/env node
/**
 * Logging Infrastructure Test Suite
 * Verifies all components work as specified
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const Logger = require('./logger');
const { redact } = require('./redact');
const LogDB = require('./db');
const LogIngestor = require('./ingest');
const LogRotator = require('./rotate');
const config = require('./config.json');

const TEST_LOG_DIR = '/tmp/openclaw-logging-test';
const TEST_DB_PATH = '/tmp/openclaw-logging-test/test.db';

// Test configuration
const testConfig = {
  ...config,
  log_dir: TEST_LOG_DIR,
  db_path: TEST_DB_PATH
};

// Override config module properties (needed for logger)
config.log_dir = TEST_LOG_DIR;
config.db_path = TEST_DB_PATH;

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    testsPassed++;
  } else {
    console.error(`  ❌ ${message}`);
    testsFailed++;
  }
}

function cleanup() {
  if (fs.existsSync(TEST_LOG_DIR)) {
    fs.rmSync(TEST_LOG_DIR, { recursive: true, force: true });
  }
}

function setup() {
  cleanup();
  fs.mkdirSync(TEST_LOG_DIR, { recursive: true });
}

async function testLogger() {
  console.log('\n🧪 Testing Logger...');
  
  setup();
  const log = Logger.getInstance();
  
  // Test basic logging
  log.info('test.event', { key: 'value' });
  log.warn('test.warning', { message: 'warning message' });
  log.error('test.error', { error: 'error message' });
  
  log.flush();
  
  // Give writes time to complete
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Check per-event file
  const eventFile = path.join(TEST_LOG_DIR, 'test.event.jsonl');
  assert(fs.existsSync(eventFile), 'Per-event file created');
  
  const eventContent = fs.readFileSync(eventFile, 'utf8');
  const eventLines = eventContent.split('\n').filter(Boolean);
  assert(eventLines.length === 1, 'Event file has correct number of entries');
  
  const eventEntry = JSON.parse(eventLines[0]);
  assert(eventEntry.event === 'test.event', 'Event name correct');
  assert(eventEntry.level === 'info', 'Event level correct');
  assert(eventEntry.data.key === 'value', 'Event data correct');
  
  // Check unified stream
  const allFile = path.join(TEST_LOG_DIR, 'all.jsonl');
  assert(fs.existsSync(allFile), 'Unified all.jsonl created');
  
  const allContent = fs.readFileSync(allFile, 'utf8');
  const allLines = allContent.split('\n').filter(Boolean);
  assert(allLines.length === 3, 'All events in unified stream');
  
  // Test auto-create on new event
  log.info('new.event', { test: true });
  log.flush();
  
  // Give writes time to complete
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const newEventFile = path.join(TEST_LOG_DIR, 'new.event.jsonl');
  assert(fs.existsSync(newEventFile), 'Auto-created new event file');
  
  log.close();
  cleanup();
}

async function testRedaction() {
  console.log('\n🧪 Testing Redaction...');
  
  // Test API key redaction
  const apiKeyData = { api_key: 'sk_test_EXAMPLE_KEY_FOR_REDACTION_TESTING' };
  const redactedKey = redact(apiKeyData);
  assert(redactedKey.api_key === '[REDACTED_KEY]', 'API key redacted');
  
  // Test email redaction
  const emailData = { from: 'test@example.com' };
  const redactedEmail = redact(emailData);
  assert(redactedEmail.from === '[REDACTED_EMAIL]', 'Email redacted');
  
  // Test file path redaction
  const pathData = { path: '/Users/marcus/secrets.txt' };
  const redactedPath = redact(pathData);
  assert(redactedPath.path === '/Users/[USER]/secrets.txt', 'File path redacted');
  
  // Test IP redaction
  const ipData = { ip: '192.168.1.100' };
  const redactedIP = redact(ipData);
  assert(redactedIP.ip === '[PRIVATE_IP]', 'Private IP redacted');
  
  // Test dollar amount redaction
  const dollarData = { price: '$1,234.56' };
  const redactedDollar = redact(dollarData);
  assert(redactedDollar.price === '[AMOUNT]', 'Dollar amount redacted');
  
  // Test nested object redaction
  const nestedData = {
    user: { email: 'user@example.com' },
    config: { api_key: 'secret123456789012345678901234567890' }
  };
  const redactedNested = redact(nestedData);
  assert(redactedNested.user.email === '[REDACTED_EMAIL]', 'Nested email redacted');
  assert(redactedNested.config.api_key === '[REDACTED_KEY]', 'Nested API key redacted');
  
  // Test array redaction
  const arrayData = { emails: ['test1@example.com', 'test2@example.com'] };
  const redactedArray = redact(arrayData);
  assert(redactedArray.emails[0] === '[REDACTED_EMAIL]', 'Array item redacted');
}

async function testDatabase() {
  console.log('\n🧪 Testing Database...');
  
  setup();
  const db = new LogDB(TEST_DB_PATH);
  
  // Test schema creation
  const tables = db.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  const tableNames = tables.map(t => t.name);
  assert(tableNames.includes('structured_logs'), 'structured_logs table created');
  assert(tableNames.includes('raw_logs'), 'raw_logs table created');
  assert(tableNames.includes('ingest_state'), 'ingest_state table created');
  
  // Test insert
  db.insertLog({
    ts: '2026-02-26T15:30:00.000Z',
    event: 'test.event',
    level: 'info',
    agent: 'test',
    data: { key: 'value' }
  }, 'test.jsonl');
  
  // Test query
  const logs = db.query({ event: 'test.event' });
  assert(logs.length === 1, 'Query returns correct count');
  assert(logs[0].event === 'test.event', 'Query returns correct event');
  
  // Test count
  const count = db.count({ event: 'test.event' });
  assert(count === 1, 'Count returns correct value');
  
  // Test ingest state
  db.updateIngestState('/test/file.jsonl', 1024);
  const state = db.getIngestState('/test/file.jsonl');
  assert(state.last_byte_offset === 1024, 'Ingest state tracked correctly');
  
  db.close();
  cleanup();
}

async function testIngest() {
  console.log('\n🧪 Testing Ingest...');
  
  setup();
  
  // Create test JSONL file
  const testFile = path.join(TEST_LOG_DIR, 'test.event.jsonl');
  const entries = [
    { ts: '2026-02-26T15:30:00.000Z', event: 'test.event', level: 'info', agent: 'test', data: { id: 1 } },
    { ts: '2026-02-26T15:31:00.000Z', event: 'test.event', level: 'info', agent: 'test', data: { id: 2 } },
    { ts: '2026-02-26T15:32:00.000Z', event: 'test.event', level: 'warn', agent: 'test', data: { id: 3 } }
  ];
  
  fs.writeFileSync(testFile, entries.map(e => JSON.stringify(e)).join('\n') + '\n');
  
  // Run ingest
  const ingestor = new LogIngestor();
  const inserted = await ingestor.ingestJSONL();
  ingestor.close();
  
  assert(inserted === 3, 'Ingest inserted correct count');
  
  // Verify database
  const db = new LogDB(TEST_DB_PATH);
  const logs = db.query({ event: 'test.event' });
  assert(logs.length === 3, 'Database has correct count');
  
  // Test deduplication (re-run ingest)
  const ingestor2 = new LogIngestor();
  const inserted2 = await ingestor2.ingestJSONL();
  ingestor2.close();
  
  assert(inserted2 === 0, 'Deduplication works (no duplicates inserted)');
  
  db.close();
  cleanup();
}

async function testRotation() {
  console.log('\n🧪 Testing Rotation...');
  
  setup();
  
  // Create test file over threshold
  const testFile = path.join(TEST_LOG_DIR, 'test.event.jsonl');
  const largeContent = Array(2000).fill().map((_, i) => 
    JSON.stringify({ ts: new Date().toISOString(), event: 'test.event', level: 'info', data: { id: i } })
  ).join('\n') + '\n';
  
  fs.writeFileSync(testFile, largeContent);
  
  const statBefore = fs.statSync(testFile);
  
  // Run rotation with small threshold
  const originalThreshold = config.rotation.max_size_mb;
  config.rotation.max_size_mb = 0.01; // 10KB threshold
  
  const rotator = new LogRotator();
  await rotator.rotateJSONL();
  
  config.rotation.max_size_mb = originalThreshold;
  
  // Check archive created
  const archiveDir = path.join(TEST_LOG_DIR, 'archive');
  assert(fs.existsSync(archiveDir), 'Archive directory created');
  
  // Check file was truncated
  const statAfter = fs.statSync(testFile);
  assert(statAfter.size < statBefore.size, 'File was truncated');
  
  // Check kept last 1000 lines
  const truncatedContent = fs.readFileSync(testFile, 'utf8');
  const truncatedLines = truncatedContent.split('\n').filter(Boolean);
  assert(truncatedLines.length === 1000, 'Kept last 1000 lines');
  
  cleanup();
}

async function testShellHelper() {
  console.log('\n🧪 Testing Shell Helper...');
  
  setup();
  
  // Create test-specific logger.sh with test directory
  const testLoggerSh = fs.readFileSync(path.join(__dirname, 'logger.sh'), 'utf8')
    .replace('/Volumes/reeseai-memory/data/logs', TEST_LOG_DIR);
  const testLoggerShPath = path.join(TEST_LOG_DIR, 'logger-test.sh');
  fs.writeFileSync(testLoggerShPath, testLoggerSh);
  
  // Run shell script that uses logger.sh
  const testScript = `
#!/usr/bin/env bash
source ${testLoggerShPath}
log_info "shell.test" "Test message from shell" "test"
  `;
  
  const scriptPath = path.join(TEST_LOG_DIR, 'test.sh');
  fs.writeFileSync(scriptPath, testScript);
  fs.chmodSync(scriptPath, '755');
  
  try {
    execSync(scriptPath, { stdio: 'ignore' });
  } catch (err) {
    // Ignore execution errors
  }
  
  // Check log file created
  const logFile = path.join(TEST_LOG_DIR, 'shell.test.jsonl');
  assert(fs.existsSync(logFile), 'Shell helper created log file');
  
  if (fs.existsSync(logFile)) {
    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    if (lines.length > 0) {
      const entry = JSON.parse(lines[0]);
      assert(entry.event === 'shell.test', 'Shell helper logged correct event');
      assert(entry.data.message === 'Test message from shell', 'Shell helper logged correct message');
    }
  }
  
  cleanup();
}

async function runTests() {
  console.log('🚀 Running Logging Infrastructure Tests\n');
  console.log('=' .repeat(50));
  
  try {
    await testLogger();
    await testRedaction();
    await testDatabase();
    await testIngest();
    await testRotation();
    await testShellHelper();
  } catch (err) {
    console.error('\n❌ Test suite failed with error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`\n📊 Test Results: ${testsPassed} passed, ${testsFailed} failed\n`);
  
  if (testsFailed === 0) {
    console.log('✅ All tests passed!\n');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed\n');
    process.exit(1);
  }
}

runTests();
