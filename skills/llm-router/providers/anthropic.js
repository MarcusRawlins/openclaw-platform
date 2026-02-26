function calculateCost(model, usage) {
  // Simplified cost calculation - expand as needed
  const costs = {
    'claude-opus-4-6': { input: 0.015 / 1000, output: 0.075 / 1000 },
    'claude-sonnet-4-5': { input: 0.003 / 1000, output: 0.015 / 1000 },
    'claude-haiku-4-5': { input: 0.0008 / 1000, output: 0.004 / 1000 }
  };
  
  const pricing = costs[model] || { input: 0, output: 0 };
  const inputCost = (usage?.input_tokens || 0) * pricing.input;
  const outputCost = (usage?.output_tokens || 0) * pricing.output;
  
  return inputCost + outputCost;
}

async function call({ model, messages, credentials, ...options }) {
  const url = 'https://api.anthropic.com/v1/messages';
  
  // Convert messages format: separate system from user/assistant
  const systemMsg = messages.find(m => m.role === 'system');
  const chatMsgs = messages.filter(m => m.role !== 'system');
  
  const body = {
    model,
    messages: chatMsgs,
    max_tokens: options.maxTokens || 4096,
    ...(systemMsg ? { system: systemMsg.content } : {}),
    ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    ...(options.topP !== undefined ? { top_p: options.topP } : {}),
    ...(options.stopSequences?.length ? { stop_sequences: options.stopSequences } : {})
  };
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': credentials.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(options.timeoutMs || 60000)
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
    const err = new Error(error.error?.message || `Anthropic API error: ${response.status}`);
    err.status = response.status;
    if (response.status === 429) err.code = 'RATE_LIMITED';
    throw err;
  }
  
  const data = await response.json();
  
  return {
    text: data.content?.[0]?.text || '',
    inputTokens: data.usage?.input_tokens || 0,
    outputTokens: data.usage?.output_tokens || 0,
    cacheReadTokens: data.usage?.cache_read_input_tokens || 0,
    cacheWriteTokens: data.usage?.cache_creation_input_tokens || 0,
    estimatedCost: calculateCost(model, data.usage)
  };
}

module.exports = { call };
