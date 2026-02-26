function calculateCost(model, usage) {
  // Simplified cost calculation
  const costs = {
    'gemini-2.5-pro': { input: 0.00125 / 1000, output: 0.005 / 1000 },
    'gemini-2.0-flash': { input: 0.000075 / 1000, output: 0.0003 / 1000 }
  };
  
  const pricing = costs[model] || { input: 0, output: 0 };
  const inputCost = (usage?.promptTokenCount || 0) * pricing.input;
  const outputCost = (usage?.candidatesTokenCount || 0) * pricing.output;
  
  return inputCost + outputCost;
}

async function call({ model, messages, credentials, ...options }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${credentials.apiKey}`;
  
  // Convert messages to Gemini format
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));
  
  const systemInstruction = messages.find(m => m.role === 'system');
  
  const body = {
    contents,
    ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction.content }] } } : {}),
    generationConfig: {
      maxOutputTokens: options.maxTokens || 4096,
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      ...(options.json ? { responseMimeType: 'application/json' } : {})
    }
  };
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(options.timeoutMs || 60000)
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Gemini API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  return {
    text: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
    inputTokens: data.usageMetadata?.promptTokenCount || 0,
    outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
    estimatedCost: calculateCost(model, data.usageMetadata)
  };
}

module.exports = { call };
