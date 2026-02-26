#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const config = require('./config.json');
const db = require('./db');
const redact = require('./redact');
const costEstimator = require('./cost-estimator');
const UsageLogger = require('./logger');
const { generateReport } = require('./report');
const { generateDashboard } = require('./dashboard');

/**
 * Health check and integration test
 */

console.log('═══════════════════════════════════════════════════');
console.log('    USAGE TRACKING SYSTEM - HEALTH CHECK');
console.log('═══════════════════════════════════════════════════');
console.log('');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    const result = fn();
    if (result === false) {
      console.log(`❌ ${name}`);
      failed++;
    } else {
      console.log(`✅ ${name}`);
      passed++;
    }
  } catch (err) {
    console.log(`❌ ${name}: ${err.message}`);
    failed++;
  }
}

// Test 1: Database initialization
test('Database initialization', () => {
  const database = db.init();
  return database !== null;
});

// Test 2: Redaction
test('Redaction - API keys', () => {
  const text = 'My key is sk-1234567890abcdef1234567890abcdef';
  const redacted = redact.redact(text);
  return !redacted.includes('sk-1234567890abcdef1234567890abcdef');
});

test('Redaction - Emails', () => {
  const text = 'Contact me at test@example.com';
  const redacted = redact.redact(text);
  return !redacted.includes('test@example.com');
});

test('Redaction - File paths', () => {
  const text = 'Located at /Users/marcus/secret.txt';
  const redacted = redact.redact(text);
  return !redacted.includes('/Users/marcus');
});

// Test 3: Cost estimation
test('Cost estimation - Anthropic Claude Opus', () => {
  const cost = costEstimator.estimateCost({
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    inputTokens: 5000,
    outputTokens: 2000,
    cacheReadTokens: 0,
    cacheWriteTokens: 0
  });
  const expected = (5000 / 1000000) * 15 + (2000 / 1000000) * 75;
  return Math.abs(cost.cost_usd - expected) < 0.0001;
});

test('Cost estimation - Local model (zero cost)', () => {
  const cost = costEstimator.estimateCost({
    provider: 'lmstudio',
    model: 'devstral-small-2-2512',
    inputTokens: 5000,
    outputTokens: 2000
  });
  return cost.cost_usd === 0;
});

test('Cost estimation - Cache savings', () => {
  const savings = costEstimator.calculateCacheSavings(30000, 'anthropic', 'claude-opus-4-6');
  return savings.saved_usd > 0;
});

// Test 4: Logger
test('Logger - Initialize singleton', () => {
  const logger = UsageLogger.getInstance();
  return logger !== null;
});

test('Logger - Log LLM call', () => {
  const logger = UsageLogger.getInstance();
  logger.logLLM({
    agent: 'test',
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    taskType: 'test',
    taskDescription: 'Health check test call',
    prompt: 'This is a test prompt with a secret: sk-test123456789',
    response: 'This is a test response',
    inputTokens: 100,
    outputTokens: 50,
    durationMs: 1000
  });
  return true;
});

test('Logger - Log API call', () => {
  const logger = UsageLogger.getInstance();
  logger.logAPI({
    agent: 'test',
    service: 'test-api',
    endpoint: '/test',
    statusCode: 200,
    durationMs: 500
  });
  return true;
});

// Test 5: Manual flush and verify
test('Logger - Flush to database', async () => {
  const logger = UsageLogger.getInstance();
  await logger.flush();
  
  // Check that records were written
  const database = db.getDB();
  const stmt = database.prepare('SELECT COUNT(*) as count FROM llm_calls WHERE agent = ?');
  const result = stmt.get('test');
  return result.count > 0;
});

// Test 6: JSONL log creation
test('JSONL log file created', () => {
  const today = new Date().toISOString().split('T')[0];
  const logFile = path.join(config.logging.jsonl_dir, `${today}.jsonl`);
  return fs.existsSync(logFile);
});

// Test 7: Report generation
test('Report generation', () => {
  const report = generateReport({ today: true });
  return report.summary && report.summary.total_calls >= 0;
});

// Test 8: Dashboard generation
test('Dashboard generation', () => {
  const dashboard = generateDashboard();
  return dashboard.today && dashboard.mtd && dashboard.callsByAgent;
});

// Test 9: Database integrity
test('Database schema - llm_calls table', () => {
  const database = db.getDB();
  const stmt = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='llm_calls'");
  const result = stmt.get();
  return result !== undefined;
});

test('Database schema - api_calls table', () => {
  const database = db.getDB();
  const stmt = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='api_calls'");
  const result = stmt.get();
  return result !== undefined;
});

test('Database schema - daily_aggregates table', () => {
  const database = db.getDB();
  const stmt = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='daily_aggregates'");
  const result = stmt.get();
  return result !== undefined;
});

// Test 10: Config validation
test('Config - Database path', () => {
  return config.database && config.database.path;
});

test('Config - Pricing data', () => {
  return config.pricing && config.pricing.anthropic && config.pricing.openai;
});

test('Config - Budgets', () => {
  return config.budgets && config.budgets.daily_usd && config.budgets.monthly_usd;
});

console.log('');
console.log('═══════════════════════════════════════════════════');
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════════════════════');
console.log('');

if (failed === 0) {
  console.log('✅ All tests passed! System is healthy.');
  console.log('');
  console.log('Next steps:');
  console.log('1. View the dashboard: npm run dashboard');
  console.log('2. Generate a report: npm run report -- --today');
  console.log('3. Integrate with agent scripts (see SKILL.md)');
  console.log('');
  process.exit(0);
} else {
  console.log('❌ Some tests failed. Check errors above.');
  console.log('');
  process.exit(1);
}
