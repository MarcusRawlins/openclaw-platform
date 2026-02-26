const CANARY_PROMPT = 'Respond with exactly: CANARY_OK';
const CANARY_EXPECTED = 'CANARY_OK';

async function smokeTest(provider, credentials, providerModule) {
  try {
    const model = getCanaryModel(provider);
    
    if (!model) {
      console.warn(`[smoke] ${provider}: no canary model configured, skipping`);
      return true; // skip smoke test
    }
    
    const result = await providerModule.call({
      model,
      messages: [{ role: 'user', content: CANARY_PROMPT }],
      credentials,
      maxTokens: 10,
      temperature: 0,
      _skipLog: true
    });
    
    const passed = result.text.includes(CANARY_EXPECTED);
    
    if (!passed) {
      console.warn(`[smoke] ${provider}: unexpected response: "${result.text.substring(0, 50)}"`);
    }
    
    return passed;
  } catch (error) {
    console.error(`[smoke] ${provider} failed: ${error.message}`);
    return false;
  }
}

function getCanaryModel(provider) {
  const canaryModels = {
    anthropic: 'claude-haiku-4-5',             // cheapest
    openai: 'gpt-4o-mini',                      // cheapest
    google: 'gemini-2.0-flash',                  // cheapest
    lmstudio: 'gemma-3-12b-it'                   // reliable fallback
  };
  return canaryModels[provider] || null;
}

module.exports = { smokeTest };
