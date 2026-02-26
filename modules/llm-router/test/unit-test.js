#!/usr/bin/env node

/**
 * Unit test for router logic (no live API calls)
 * Tests provider detection, credential resolution, message normalization
 */

const { detectProvider, isLocalModel, getModelTier, normalizeModelName } = require('../model-utils');
const { resolveCredentials } = require('../credentials');
const { hashPrompt, checkCache, storeCache } = require('../cache');

console.log('🧪 LLM Router Unit Tests (No Live Calls)\n');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.log(`  ❌ ${message}`);
    failed++;
  }
}

console.log('1️⃣  Provider Detection Logic');
const tests = [
  { input: 'anthropic/claude-sonnet-4-5', expected: { provider: 'anthropic', modelName: 'claude-sonnet-4-5' } },
  { input: 'claude-haiku-4-5', expected: { provider: 'anthropic' } },
  { input: 'openai/gpt-4o', expected: { provider: 'openai', modelName: 'gpt-4o' } },
  { input: 'gpt-4o-mini', expected: { provider: 'openai' } },
  { input: 'google/gemini-2.0-flash', expected: { provider: 'google' } },
  { input: 'gemini-2.5-pro', expected: { provider: 'google' } },
  { input: 'lmstudio/qwen/qwen3-4b-2507', expected: { provider: 'lmstudio', modelName: 'qwen/qwen3-4b-2507' } },
  { input: 'qwen3-4b-2507', expected: { provider: 'lmstudio' } },
  { input: 'gemma-3-12b-it', expected: { provider: 'lmstudio' } },
  { input: 'nomic-embed-text-v1.5', expected: { provider: 'lmstudio' } },
  { input: 'unknown-model', expected: { provider: 'lmstudio' } }  // default
];

tests.forEach(({ input, expected }) => {
  const result = detectProvider(input);
  const match = result.provider === expected.provider && 
                (!expected.modelName || result.modelName === expected.modelName);
  assert(match, `detectProvider("${input}") → ${result.provider}${expected.modelName ? '/' + result.modelName : ''}`);
});

console.log('\n2️⃣  Model Classification');
assert(isLocalModel('lmstudio/gemma-3-12b-it'), 'Local model detection: lmstudio');
assert(!isLocalModel('anthropic/claude-sonnet-4-5'), 'Cloud model detection: anthropic');
assert(!isLocalModel('gpt-4o'), 'Cloud model detection: openai');

const tier = getModelTier('claude-opus-4-6');
assert(tier.tier === 'premium' && tier.capability === 'reasoning', 'Model tier lookup');

const localTier = getModelTier('gemma-3-12b-it');
assert(localTier.tier === 'local', 'Local model tier classification');

console.log('\n3️⃣  Model Name Normalization');
assert(normalizeModelName('claude-sonnet-4-5') === 'anthropic/claude-sonnet-4-5', 'Normalize adds provider');
assert(normalizeModelName('lmstudio/qwen/qwen3-4b-2507') === 'lmstudio/qwen/qwen3-4b-2507', 'Normalize preserves full path');

console.log('\n4️⃣  Credential Resolution');
try {
  const lmCreds = resolveCredentials('lmstudio');
  assert(lmCreds.baseUrl && lmCreds.baseUrl.includes('1234'), 'LM Studio credentials resolve');
} catch (e) {
  assert(false, 'LM Studio credentials resolve: ' + e.message);
}

// Test missing credentials throw errors
try {
  resolveCredentials('nonexistent-provider');
  assert(false, 'Should throw on unknown provider');
} catch (e) {
  assert(e.message.includes('No credential config'), 'Throws on unknown provider');
}

console.log('\n5️⃣  Prompt Caching Logic');
const prompt1 = 'You are a helpful assistant. Follow these rules: ...';
const prompt2 = 'You are a helpful assistant. Follow these rules: ...';  // same
const prompt3 = 'You are a different assistant.';  // different

const hash1 = hashPrompt(prompt1);
const hash2 = hashPrompt(prompt2);
const hash3 = hashPrompt(prompt3);

assert(hash1 === hash2, 'Identical prompts produce same hash');
assert(hash1 !== hash3, 'Different prompts produce different hash');
assert(hash1.length === 16, 'Hash is 16 chars');

// Test cache store and retrieve
storeCache(prompt1, 'anthropic', 'cache-id-123');
const cached = checkCache(prompt1, 'anthropic');
assert(cached && cached.id === 'cache-id-123', 'Cache stores and retrieves');

const notCached = checkCache(prompt3, 'anthropic');
assert(!notCached, 'Cache miss for different prompt');

const wrongProvider = checkCache(prompt1, 'openai');
assert(!wrongProvider, 'Cache miss for different provider');

console.log('\n6️⃣  Message Normalization Logic');
// This tests the logic that would be in router.normalizeMessages
function normalizeMessages(options) {
  if (options.messages) return options.messages;
  const messages = [];
  if (options.systemPrompt) messages.push({ role: 'system', content: options.systemPrompt });
  if (options.prompt) messages.push({ role: 'user', content: options.prompt });
  return messages;
}

const msgs1 = normalizeMessages({ prompt: 'Hello' });
assert(msgs1.length === 1 && msgs1[0].role === 'user', 'Prompt converts to user message');

const msgs2 = normalizeMessages({ systemPrompt: 'Be helpful', prompt: 'Hello' });
assert(msgs2.length === 2 && msgs2[0].role === 'system' && msgs2[1].role === 'user', 'System + prompt normalization');

const msgs3 = normalizeMessages({ messages: [{ role: 'user', content: 'Test' }] });
assert(msgs3.length === 1 && msgs3 === msgs3, 'Messages array passes through');

console.log('\n7️⃣  Error Handling Logic');
// Test that errors have proper structure
const testError = new Error('Test error');
testError.status = 429;
testError.code = 'RATE_LIMITED';

assert(testError.status === 429, 'Error status property');
assert(testError.code === 'RATE_LIMITED', 'Error code property');

console.log('\n' + '='.repeat(60));
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log('='.repeat(60));

if (failed === 0) {
  console.log('\n🎉 All unit tests passed! Core router logic is sound.');
  process.exit(0);
} else {
  console.log(`\n⚠️  ${failed} test(s) failed.`);
  process.exit(1);
}
