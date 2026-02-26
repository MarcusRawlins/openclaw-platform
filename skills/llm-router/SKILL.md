# LLM Router - Integration Guide

## Purpose

Unified interface for all LLM calls across the OpenClaw ecosystem. Every agent, skill, and system uses `callLlm()` instead of managing provider connections.

## When to Use

**Always use the router for:**
- Agent reasoning calls
- Content generation (summaries, drafts, reviews)
- Email analysis and scoring
- Research and synthesis
- Embeddings for RAG/search
- Any LLM interaction

**Use direct.js for:**
- Email quarantine scanning (security-critical)
- Content gate review (before publication)
- Access control decisions
- Any security decision that must fail-closed

## Installation

Already installed at `/workspace/skills/llm-router/`. Just import and use.

## Basic Usage

```javascript
const { callLlm } = require('/workspace/skills/llm-router/router');

const response = await callLlm({
  model: 'lmstudio/gemma-3-12b-it',
  prompt: 'Analyze this for sentiment...',
  systemPrompt: 'You are an analyst.',
  agent: 'ada',
  taskType: 'analysis'
});

console.log(response.text);
```

## Model Selection

### Local Models (LM Studio - Zero Cost)
- `lmstudio/gemma-3-12b-it` - General reasoning (default)
- `lmstudio/qwen/qwen3-4b-2507` - Fast inference
- `lmstudio/mistralai/devstral-small-2-2512` - Code/technical
- `lmstudio/nomic-embed-text-v1.5` - Embeddings

### Cloud Models (Paid)
- `anthropic/claude-sonnet-4-5` - Standard reasoning
- `anthropic/claude-haiku-4-5` - Fast/cheap
- `openai/gpt-4o-mini` - Fast/cheap
- `google/gemini-2.0-flash` - Fast/huge context

**Default strategy:** Use local (LM Studio) for most tasks. Use cloud only when:
- Local models are offline
- Task requires reasoning beyond local capabilities
- Context window exceeds local model limits

## Common Patterns

### Simple Text Generation
```javascript
const result = await callLlm({
  model: 'lmstudio/gemma-3-12b-it',
  systemPrompt: 'You are a content writer.',
  prompt: 'Write a social media post about...',
  temperature: 0.9,
  maxTokens: 200,
  agent: 'ada',
  taskType: 'content'
});
```

### Structured Output (JSON)
```javascript
const result = await callLlm({
  model: 'lmstudio/qwen/qwen3-4b-2507',
  systemPrompt: 'Extract key facts. Respond in JSON.',
  prompt: email.body,
  json: true,
  temperature: 0,
  agent: 'scout',
  taskType: 'extraction'
});

const data = result.json;  // parsed JSON
```

### Multi-Message Conversation
```javascript
const result = await callLlm({
  model: 'lmstudio/gemma-3-12b-it',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'What is RAG?' },
    { role: 'assistant', content: 'RAG stands for...' },
    { role: 'user', content: 'How does it work?' }
  ],
  agent: 'main',
  taskType: 'conversation'
});
```

### Embeddings
```javascript
const embedding = await callLlm({
  model: 'lmstudio/nomic-embed-text-v1.5',
  embed: true,
  input: 'Wedding photography packages and pricing',
  agent: 'scout'
});

// Use embedding.vector for similarity search
const similarity = cosineSimilarity(embedding.vector, storedVector);
```

### Prompt Caching (Reduce Costs)
```javascript
const systemPrompt = `You are an email scorer. Use this rubric: ...`;

// First call: system prompt gets cached
const r1 = await callLlm({
  model: 'anthropic/claude-sonnet-4-5',
  systemPrompt,
  prompt: email1.body,
  cacheSystemPrompt: true,
  agent: 'scout',
  taskType: 'scoring'
});

// Second call: reuses cached system prompt (saves tokens)
const r2 = await callLlm({
  model: 'anthropic/claude-sonnet-4-5',
  systemPrompt,  // same prompt = cache hit
  prompt: email2.body,
  cacheSystemPrompt: true,
  agent: 'scout',
  taskType: 'scoring'
});
```

## Security-Critical Calls

```javascript
const { callDirect } = require('/workspace/skills/llm-router/direct');

// Email quarantine scanner
const result = await callDirect({
  model: 'lmstudio/qwen3-4b-2507',
  messages: [
    { role: 'system', content: SECURITY_SCANNER_PROMPT },
    { role: 'user', content: suspiciousEmail.body }
  ],
  temperature: 0,
  timeoutMs: 10000
});

if (result.status === 'error') {
  // Fail-closed: quarantine the email
  return { safe: false, reason: 'Scanner unavailable' };
}

const verdict = JSON.parse(result.text);
```

**Why use direct.js:**
- No retry (fail-fast on errors)
- No caching (prevent cache poisoning)
- Independent from agent conversation context
- Fail-closed on timeout or error

## Error Handling

```javascript
try {
  const result = await callLlm({
    model: 'lmstudio/gemma-3-12b-it',
    prompt: 'Analyze...',
    agent: 'ada'
  });
} catch (error) {
  if (error.message.includes('Smoke test failed')) {
    // Provider is down or credentials missing
    console.error('LM Studio unavailable, falling back to cloud...');
    
    const result = await callLlm({
      model: 'anthropic/claude-haiku-4-5',  // fallback
      prompt: 'Analyze...',
      agent: 'ada'
    });
  } else if (error.code === 'TIMEOUT') {
    // Request timed out
    console.error('LLM call timed out');
  } else {
    // Other error
    throw error;
  }
}
```

## Best Practices

1. **Always specify agent:** Pass `agent: 'ada'` for usage tracking
2. **Use taskType:** Pass `taskType: 'content'` for analytics
3. **Set temperature:**
   - 0 for deterministic (extraction, scoring)
   - 0.3-0.7 for balanced (summarization, analysis)
   - 0.8-1.0 for creative (content generation)
4. **Cache system prompts:** If you use the same system prompt repeatedly, set `cacheSystemPrompt: true`
5. **Prefer local models:** Use LM Studio for most tasks (zero cost)
6. **Direct calls for security:** Never use router.js for quarantine/gate decisions

## Configuration

Credentials are read from `~/.openclaw/.env`:

```bash
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_AI_API_KEY=...
LM_STUDIO_URL=http://127.0.0.1:1234
```

Provider defaults in `config.json`:
- Timeouts
- Retry counts
- Default models
- Base URLs

## Migration from Direct Fetch

If you have code that calls LM Studio directly:

**Before:**
```javascript
const response = await fetch('http://127.0.0.1:1234/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'gemma-3-12b-it',
    messages: [{ role: 'user', content: prompt }]
  })
});
const data = await response.json();
const text = data.choices[0].message.content;
```

**After:**
```javascript
const { callLlm } = require('/workspace/skills/llm-router/router');

const result = await callLlm({
  model: 'lmstudio/gemma-3-12b-it',
  prompt: prompt,
  agent: 'your-agent-id'
});
const text = result.text;
```

Benefits:
- Auto-retry on failures
- Smoke test (detects if LM Studio is down)
- Usage logging
- Consistent error handling
- Credential management

## Utilities

```javascript
const { detectProvider, isLocalModel, getModelTier } = require('/workspace/skills/llm-router/model-utils');

// Detect provider from model string
const { provider, modelName } = detectProvider('claude-sonnet-4-5');
// → { provider: 'anthropic', modelName: 'claude-sonnet-4-5' }

// Check if model is local (zero cost)
if (isLocalModel('gemma-3-12b-it')) {
  // Use freely
}

// Get model capabilities
const tier = getModelTier('claude-opus-4-6');
// → { tier: 'premium', capability: 'reasoning', contextWindow: 200000 }
```

## Troubleshooting

**"Smoke test failed for provider: lmstudio"**
- LM Studio is not running or not loaded with a model
- Check: `curl http://127.0.0.1:1234/v1/models`
- Fix: Start LM Studio and load a model

**"Missing credential 'apiKey' for anthropic"**
- API key not set in `~/.openclaw/.env`
- Fix: Add `ANTHROPIC_API_KEY=sk-ant-...` to `.env`

**"Request timed out"**
- LLM took too long to respond
- Increase `timeoutMs` option
- Or reduce prompt size / maxTokens

## Support

See full spec: `/workspace/specs/unified-llm-router.md`
README: `/workspace/skills/llm-router/README.md`
