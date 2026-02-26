#!/usr/bin/env node

const { callLlm } = require('../router');
const { callDirect } = require('../direct');
const { detectProvider, isLocalModel, getModelTier } = require('../model-utils');
const { resolveCredentials } = require('../credentials');

console.log('🧪 LLM Router Verification Tests\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  process.stdout.write(`  ${name}... `);
  try {
    const result = fn();
    if (result === true || result === undefined) {
      console.log('✅');
      passed++;
    } else {
      console.log(`❌ (returned ${result})`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ ${error.message}`);
    failed++;
  }
}

async function asyncTest(name, fn) {
  process.stdout.write(`  ${name}... `);
  try {
    const result = await fn();
    if (result === true || result === undefined) {
      console.log('✅');
      passed++;
      return true;
    } else {
      console.log(`❌ (returned ${result})`);
      failed++;
      return false;
    }
  } catch (error) {
    console.log(`❌ ${error.message}`);
    failed++;
    return false;
  }
}

console.log('1️⃣  Model Utils - Provider Detection');
test('Anthropic explicit prefix', () => {
  const { provider, modelName } = detectProvider('anthropic/claude-sonnet-4-5');
  return provider === 'anthropic' && modelName === 'claude-sonnet-4-5';
});
test('Anthropic auto-detect', () => {
  const { provider } = detectProvider('claude-haiku-4-5');
  return provider === 'anthropic';
});
test('OpenAI explicit prefix', () => {
  const { provider, modelName } = detectProvider('openai/gpt-4o');
  return provider === 'openai' && modelName === 'gpt-4o';
});
test('OpenAI auto-detect GPT', () => {
  const { provider } = detectProvider('gpt-4o-mini');
  return provider === 'openai';
});
test('OpenAI auto-detect O1', () => {
  const { provider } = detectProvider('o1-preview');
  return provider === 'openai';
});
test('Google explicit prefix', () => {
  const { provider } = detectProvider('google/gemini-2.0-flash');
  return provider === 'google';
});
test('Google auto-detect', () => {
  const { provider } = detectProvider('gemini-2.5-pro');
  return provider === 'google';
});
test('LM Studio explicit prefix', () => {
  const { provider, modelName } = detectProvider('lmstudio/gemma-3-12b-it');
  return provider === 'lmstudio' && modelName === 'gemma-3-12b-it';
});
test('LM Studio nested path', () => {
  const { provider, modelName } = detectProvider('lmstudio/qwen/qwen3-4b-2507');
  return provider === 'lmstudio' && modelName === 'qwen/qwen3-4b-2507';
});
test('LM Studio auto-detect qwen', () => {
  const { provider } = detectProvider('qwen3-4b-2507');
  return provider === 'lmstudio';
});
test('LM Studio auto-detect gemma', () => {
  const { provider } = detectProvider('gemma-3-12b-it');
  return provider === 'lmstudio';
});
test('LM Studio auto-detect mistral', () => {
  const { provider } = detectProvider('mistralai/devstral-small-2-2512');
  return provider === 'lmstudio';
});
test('LM Studio auto-detect nomic', () => {
  const { provider } = detectProvider('nomic-embed-text-v1.5');
  return provider === 'lmstudio';
});
test('Default to LM Studio', () => {
  const { provider } = detectProvider('unknown-model-xyz');
  return provider === 'lmstudio';
});
test('isLocalModel detects lmstudio', () => {
  return isLocalModel('lmstudio/gemma-3-12b-it') === true;
});
test('isLocalModel rejects anthropic', () => {
  return isLocalModel('anthropic/claude-sonnet-4-5') === false;
});
test('getModelTier returns tier', () => {
  const tier = getModelTier('claude-opus-4-6');
  return tier.tier === 'premium' && tier.capability === 'reasoning';
});

console.log('\n2️⃣  Credential Resolution');
test('LM Studio credentials', () => {
  const creds = resolveCredentials('lmstudio');
  return creds.baseUrl && creds.baseUrl.includes('1234');
});

// Test other providers only if credentials exist
try {
  const anthropicCreds = resolveCredentials('anthropic');
  if (anthropicCreds.apiKey) {
    test('Anthropic credentials exist', () => true);
  }
} catch (e) {
  console.log('  Anthropic credentials... ⚠️  (not configured, skipping)');
}

try {
  const openaiCreds = resolveCredentials('openai');
  if (openaiCreds.apiKey) {
    test('OpenAI credentials exist', () => true);
  }
} catch (e) {
  console.log('  OpenAI credentials... ⚠️  (not configured, skipping)');
}

try {
  const googleCreds = resolveCredentials('google');
  if (googleCreds.apiKey) {
    test('Google credentials exist', () => true);
  }
} catch (e) {
  console.log('  Google credentials... ⚠️  (not configured, skipping)');
}

(async () => {
  console.log('\n3️⃣  Live LM Studio Call (Chat Completion)');
  const success1 = await asyncTest('Simple chat completion', async () => {
    const result = await callLlm({
      model: 'lmstudio/qwen/qwen3-4b-2507',
      prompt: 'Say "TEST_OK" and nothing else.',
      temperature: 0,
      maxTokens: 10,
      agent: 'test',
      _skipLog: true
    });
    return result.text && result.text.includes('TEST_OK') && result.provider === 'lmstudio';
  });

  if (success1) {
    await asyncTest('Verify usage tokens returned', async () => {
      const result = await callLlm({
        model: 'lmstudio/qwen/qwen3-4b-2507',
        prompt: 'Count to 5',
        maxTokens: 50,
        agent: 'test',
        _skipLog: true
      });
      return result.inputTokens > 0 && result.outputTokens > 0;
    });
    
    await asyncTest('Verify cost is zero for local', async () => {
      const result = await callLlm({
        model: 'lmstudio/qwen/qwen3-4b-2507',
        prompt: 'Hi',
        agent: 'test',
        _skipLog: true
      });
      return result.estimatedCost === 0;
    });
  }

  console.log('\n4️⃣  Live LM Studio Embedding Call');
  await asyncTest('Generate embedding', async () => {
    const result = await callLlm({
      model: 'lmstudio/nomic-embed-text-v1.5',
      embed: true,
      input: 'Test embedding generation',
      agent: 'test',
      _skipLog: true
    });
    return result.vector instanceof Float32Array && result.dimensions > 0;
  });

  console.log('\n5️⃣  Direct Call Path (Security-Critical)');
  await asyncTest('Direct call isolated from router', async () => {
    const result = await callDirect({
      model: 'lmstudio/qwen/qwen3-4b-2507',
      messages: [
        { role: 'system', content: 'You are a test assistant.' },
        { role: 'user', content: 'Reply with: DIRECT_OK' }
      ],
      temperature: 0,
      maxTokens: 10,
      timeoutMs: 15000
    });
    return result.status === 'success' && result.text && result.text.includes('DIRECT_OK');
  });

  await asyncTest('Direct call returns on timeout', async () => {
    const result = await callDirect({
      model: 'lmstudio/qwen/qwen3-4b-2507',
      messages: [{ role: 'user', content: 'test' }],
      timeoutMs: 1  // force timeout
    });
    return result.status === 'error' && result.error.includes('timeout');
  });

  console.log('\n6️⃣  Additional Features');
  await asyncTest('JSON mode request', async () => {
    const result = await callLlm({
      model: 'lmstudio/qwen/qwen3-4b-2507',
      prompt: 'Return JSON: {"test": true}',
      json: true,
      temperature: 0,
      agent: 'test',
      _skipLog: true
    });
    return result.json !== undefined;
  });

  await asyncTest('System prompt handling', async () => {
    const result = await callLlm({
      model: 'lmstudio/qwen/qwen3-4b-2507',
      systemPrompt: 'You always say SYSTEM_OK',
      prompt: 'Reply',
      temperature: 0,
      maxTokens: 10,
      agent: 'test',
      _skipLog: true
    });
    return result.text && result.status === 'success';
  });

  await asyncTest('Messages array format', async () => {
    const result = await callLlm({
      model: 'lmstudio/qwen/qwen3-4b-2507',
      messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Say OK' }
      ],
      temperature: 0,
      maxTokens: 5,
      agent: 'test',
      _skipLog: true
    });
    return result.text && result.status === 'success';
  });

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('='.repeat(50));

  if (failed === 0) {
    console.log('\n🎉 All tests passed! Router is ready to use.');
    process.exit(0);
  } else {
    console.log(`\n⚠️  ${failed} test(s) failed. Review errors above.`);
    process.exit(1);
  }
})();
