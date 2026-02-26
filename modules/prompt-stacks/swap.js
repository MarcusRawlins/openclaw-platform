const { detectProvider } = require('../llm-router/model-utils');
const fs = require('fs');
const path = require('path');

async function swapModel(agentId, newModel) {
  const { provider } = detectProvider(newModel);
  
  // Determine which prompt stack to use
  const stackMap = {
    anthropic: 'claude',
    openai: 'gpt',
    google: 'gpt',      // Gemini works well with GPT-style prompts
    lmstudio: 'claude'   // Local models work fine with natural language
  };
  
  const stack = stackMap[provider] || 'claude';
  const stackDir = path.join('/Users/marcusrawlins/.openclaw/workspace/prompts', stack);
  const targetDir = path.join('/Users/marcusrawlins/.openclaw/agents', agentId);
  
  console.log(`Swapping ${agentId} to ${newModel} (using ${stack} prompt stack)`);
  
  // Copy prompt files to agent directory
  const files = ['AGENTS.md'];  // Only AGENTS.md is per-agent; others are shared
  for (const file of files) {
    const src = path.join(stackDir, file);
    const dst = path.join(targetDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dst);
      console.log(`  ✓ Copied ${file}`);
    } else {
      console.log(`  ✗ Warning: ${file} not found in ${stack}/ stack`);
    }
  }
  
  // Update gateway config (model assignment)
  console.log(`\n  Next steps:`);
  console.log(`  1. Update gateway config: set ${agentId} model to ${newModel}`);
  console.log(`  2. Run: openclaw gateway restart`);
  console.log(`  3. Test: node /Users/marcusrawlins/.openclaw/workspace/skills/prompt-stacks/canary.js --agent ${agentId}`);
  
  return { stack, model: newModel };
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  const modelIndex = args.indexOf('--model');
  const agentIndex = args.indexOf('--agent');
  
  if (modelIndex === -1 || agentIndex === -1) {
    console.log('Usage: node swap.js --model <model-name> --agent <agent-id>');
    console.log('Example: node swap.js --model openai/gpt-4-turbo --agent marcus');
    process.exit(1);
  }
  
  const newModel = args[modelIndex + 1];
  const agentId = args[agentIndex + 1];
  
  swapModel(agentId, newModel).then(result => {
    console.log(`\n✓ Swap complete: ${result.stack} stack → ${agentId}`);
  }).catch(err => {
    console.error('✗ Swap failed:', err.message);
    process.exit(1);
  });
}

module.exports = { swapModel };
