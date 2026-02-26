const { callLlm } = require('../llm-router/router');
const { detectProvider } = require('../llm-router/model-utils');
const fs = require('fs');
const path = require('path');

const FACTS_PATH = path.join('/Users/marcusrawlins/.openclaw/workspace/prompts/shared/facts.json');

function getAgentModel(agentId) {
  try {
    const facts = JSON.parse(fs.readFileSync(FACTS_PATH, 'utf8'));
    
    // Check for agent-specific model
    if (facts.models && facts.models[agentId]) {
      return facts.models[agentId];
    }
    
    // Check for agent_default pattern (e.g., marcus_default)
    const defaultKey = `${agentId}_default`;
    if (facts.models && facts.models[defaultKey]) {
      return facts.models[defaultKey];
    }
    
    throw new Error(`No model configured for agent: ${agentId}`);
  } catch (err) {
    throw new Error(`Failed to load agent model: ${err.message}`);
  }
}

function getExpectedProvider(agentId) {
  const model = getAgentModel(agentId);
  const { provider } = detectProvider(model);
  return provider;
}

async function canaryTest(agentId) {
  console.log(`\n🐤 Running canary test for agent: ${agentId}...`);
  
  try {
    const model = getAgentModel(agentId);
    const expectedProvider = getExpectedProvider(agentId);
    
    console.log(`   Model: ${model}`);
    console.log(`   Expected provider: ${expectedProvider}\n`);
    
    const result = await callLlm({
      model,
      prompt: 'Respond with a JSON object: {"provider": "<your_provider>", "model": "<your_model>", "status": "ok"}',
      json: true,
      maxTokens: 50,
      temperature: 0,
      agent: agentId,
      taskType: 'canary'
    });
    
    console.log(`Response: ${result.text}`);
    console.log(`Provider: ${result.provider}`);
    console.log(`Model: ${result.model}`);
    console.log(`Cost: $${result.estimatedCost.toFixed(6)}`);
    console.log(`Duration: ${result.durationMs}ms\n`);
    
    // Verify provider matches expected
    if (result.provider !== expectedProvider) {
      console.error(`✗ MISMATCH: Expected ${expectedProvider}, got ${result.provider}`);
      console.error('  This likely means auth failed and fallback kicked in.\n');
      return false;
    }
    
    console.log('✓ Canary test passed\n');
    return true;
  } catch (err) {
    console.error(`✗ Canary test failed: ${err.message}\n`);
    return false;
  }
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  const agentIndex = args.indexOf('--agent');
  
  if (agentIndex === -1) {
    console.log('Usage: node canary.js --agent <agent-id>');
    console.log('Example: node canary.js --agent marcus');
    process.exit(1);
  }
  
  const agentId = args[agentIndex + 1];
  
  canaryTest(agentId).then(passed => {
    process.exit(passed ? 0 : 1);
  });
}

module.exports = { canaryTest };
