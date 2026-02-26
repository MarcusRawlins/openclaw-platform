function tryParseJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function call({ model, messages, credentials, ...options }) {
  // Handle embedding requests
  if (options.embed) {
    return await embed({ model, input: options.input, credentials, timeoutMs: options.timeoutMs });
  }
  
  // LM Studio uses OpenAI-compatible API
  const url = `${credentials.baseUrl}/v1/chat/completions`;
  
  const body = {
    model,
    messages,
    max_tokens: options.maxTokens || 4096,
    ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    ...(options.json ? { response_format: { type: 'json_object' } } : {}),
    stream: false
  };
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(options.timeoutMs || 120000)
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LM Studio error (${response.status}): ${error.substring(0, 200)}`);
  }
  
  const data = await response.json();
  
  return {
    text: data.choices?.[0]?.message?.content || '',
    json: options.json ? tryParseJSON(data.choices?.[0]?.message?.content) : undefined,
    inputTokens: data.usage?.prompt_tokens || 0,
    outputTokens: data.usage?.completion_tokens || 0,
    estimatedCost: 0  // local, always free
  };
}

async function embed({ model, input, credentials, timeoutMs }) {
  const url = `${credentials.baseUrl}/v1/embeddings`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input }),
    signal: AbortSignal.timeout(timeoutMs || 30000)
  });
  
  if (!response.ok) {
    throw new Error(`LM Studio embedding error: ${response.status}`);
  }
  
  const data = await response.json();
  const embedding = data.data?.[0]?.embedding;
  
  return {
    vector: new Float32Array(embedding),
    dimensions: embedding.length,
    inputTokens: data.usage?.prompt_tokens || 0,
    outputTokens: 0,
    estimatedCost: 0
  };
}

module.exports = { call };
