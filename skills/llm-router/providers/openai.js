function calculateCost(model, usage) {
  // Simplified cost calculation
  const costs = {
    'gpt-4o': { input: 0.005 / 1000, output: 0.015 / 1000 },
    'gpt-4o-mini': { input: 0.00015 / 1000, output: 0.0006 / 1000 },
    'gpt-4-turbo': { input: 0.01 / 1000, output: 0.03 / 1000 }
  };
  
  const pricing = costs[model] || { input: 0, output: 0 };
  const inputCost = (usage?.prompt_tokens || 0) * pricing.input;
  const outputCost = (usage?.completion_tokens || 0) * pricing.output;
  
  return inputCost + outputCost;
}

function tryParseJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function call({ model, messages, credentials, ...options }) {
  const url = `${credentials.baseUrl || 'https://api.openai.com'}/v1/chat/completions`;
  
  const body = {
    model,
    messages,
    max_tokens: options.maxTokens || 4096,
    ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    ...(options.json ? { response_format: { type: 'json_object' } } : {}),
    ...(options.seed !== undefined ? { seed: options.seed } : {})
  };
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${credentials.apiKey}`
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(options.timeoutMs || 60000)
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const err = new Error(error.error?.message || `OpenAI API error: ${response.status}`);
    err.status = response.status;
    if (response.status === 429) err.code = 'RATE_LIMITED';
    throw err;
  }
  
  const data = await response.json();
  
  return {
    text: data.choices?.[0]?.message?.content || '',
    json: options.json ? tryParseJSON(data.choices?.[0]?.message?.content) : undefined,
    inputTokens: data.usage?.prompt_tokens || 0,
    outputTokens: data.usage?.completion_tokens || 0,
    estimatedCost: calculateCost(model, data.usage)
  };
}

module.exports = { call };
