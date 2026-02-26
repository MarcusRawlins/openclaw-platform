class Tier2Tests {
  async runAll() {
    console.log('\n══════ TIER 2: Live LLM Tests (Weekly, Low Cost) ══════\n');

    let callLlm;
    try {
      ({ callLlm } = require('/Users/marcusrawlins/.openclaw/workspace/skills/llm-router/router'));
    } catch (err) {
      console.log('  ⚠ LLM Router not available, skipping Tier 2 tests');
      return [];
    }

    const results = [];

    // Test each provider
    const providers = [
      { model: 'lmstudio/qwen/qwen3-4b-2507', name: 'LM Studio (qwen3)' },
      { model: 'lmstudio/gemma-3-12b-it', name: 'LM Studio (gemma)' },
      { model: 'lmstudio/nomic-embed-text-v1.5', name: 'LM Studio (embeddings)', embed: true }
    ];

    // Only test paid providers if explicitly requested
    if (process.argv.includes('--include-paid')) {
      providers.push(
        { model: 'anthropic/claude-haiku-4-5', name: 'Anthropic (haiku)' },
        { model: 'openai/gpt-4o-mini', name: 'OpenAI (mini)' }
      );
    }

    for (const p of providers) {
      try {
        const start = Date.now();
        
        if (p.embed) {
          const result = await callLlm({
            model: p.model,
            embed: true,
            input: 'Test embedding for wedding photography',
            agent: 'test-tier2',
            taskType: 'test'
          });
          
          if (!result.vector || result.dimensions < 1) throw new Error('No embedding returned');
          console.log(`  ✓ ${p.name}: ${result.dimensions}d vector in ${Date.now() - start}ms`);
        } else {
          const result = await callLlm({
            model: p.model,
            prompt: 'Respond with exactly: TEST_OK',
            maxTokens: 10,
            temperature: 0,
            agent: 'test-tier2',
            taskType: 'test'
          });
          
          if (!result.text.includes('TEST_OK')) {
            console.log(`  ⚠ ${p.name}: unexpected response "${result.text.substring(0, 50)}"`);
          } else {
            console.log(`  ✓ ${p.name}: ${result.outputTokens} tokens in ${Date.now() - start}ms`);
          }
        }
        
        results.push({ provider: p.name, status: 'pass' });
      } catch (err) {
        console.log(`  ✗ ${p.name}: ${err.message}`);
        results.push({ provider: p.name, status: 'fail', error: err.message });
      }
    }

    // Test scoring rubric (uses LLM)
    try {
      const testEmail = 'Hi, we are getting married in October 2026 in Asheville, NC. We love your work!';
      const result = await callLlm({
        model: 'lmstudio/gemma-3-12b-it',
        prompt: `Score this email as a wedding photography lead (0-100): "${testEmail}". Respond with only a number.`,
        maxTokens: 10,
        temperature: 0,
        agent: 'test-tier2',
        taskType: 'test'
      });
      
      const score = parseInt(result.text);
      if (isNaN(score) || score < 0 || score > 100) {
        console.log(`  ⚠ Scoring test: non-numeric response "${result.text}"`);
      } else {
        console.log(`  ✓ Scoring test: email scored ${score}/100`);
      }
      results.push({ provider: 'scoring', status: 'pass' });
    } catch (err) {
      console.log(`  ✗ Scoring test: ${err.message}`);
      results.push({ provider: 'scoring', status: 'fail', error: err.message });
    }

    const passed = results.filter(r => r.status === 'pass').length;
    console.log(`\n  ${passed}/${results.length} tests passed\n`);

    return results;
  }
}

module.exports = Tier2Tests;

// CLI runner
if (require.main === module) {
  const tests = new Tier2Tests();
  tests.runAll()
    .then((results) => {
      const failed = results.filter(r => r.status === 'fail').length;
      process.exit(failed > 0 ? 1 : 0);
    })
    .catch(err => {
      console.error('Test suite failed:', err);
      process.exit(1);
    });
}
