# Unified LLM Router

Single unified interface for all LLM calls across the OpenClaw agent ecosystem.

## Overview

The LLM Router provides a unified `callLlm()` function that:
- Auto-detects provider from model name (Anthropic, OpenAI, Google, LM Studio)
- Manages credentials from ~/.openclaw/.env
- Implements exponential backoff retry with circuit breaker
- Caches system prompts to reduce costs
- Runs smoke tests on first provider use
- Logs all usage to interaction store
- Provides isolated direct-call path for security-critical operations

## Quick Start

```javascript
const { callLlm } = require('/workspace/skills/llm-router/router');

// Simple call
const response = await callLlm({
  model: 'lmstudio/gemma-3-12b-it',
  prompt: 'Analyze this email for sentiment...',
  systemPrompt: 'You are an email analyst.',
  temperature: 0.3
});

console.log(response.text);
// response = {
//   text: "The email has a positive sentiment...",
//   model: "gemma-3-12b-it",
//   provider: "lmstudio",
//   inputTokens: 150,
//   outputTokens: 80,
//   durationMs: 1200,
//   estimatedCost: 0,
//   status: "success"
// }
```

## Supported Providers

- **Anthropic**: Claude models (Opus, Sonnet, Haiku)
- **OpenAI**: GPT-4, GPT-4o, GPT-4o-mini
- **Google**: Gemini 2.5 Pro, Gemini 2.0 Flash
- **LM Studio**: Local models (Qwen, Gemma, Llama, Mistral, etc.)

## Provider Detection

The router auto-detects provider from model name:

```javascript
// Explicit provider prefix
callLlm({ model: 'anthropic/claude-sonnet-4-5', ... })
callLlm({ model: 'openai/gpt-4o-mini', ... })
callLlm({ model: 'lmstudio/qwen/qwen3-4b-2507', ... })

// Auto-detect from name
callLlm({ model: 'claude-haiku-4-5', ... })      // → anthropic
callLlm({ model: 'gpt-4o', ... })                 // → openai
callLlm({ model: 'gemini-2.0-flash', ... })       // → google
callLlm({ model: 'qwen3-4b-2507', ... })          // → lmstudio
```

## Embeddings

```javascript
const embedding = await callLlm({
  model: 'lmstudio/nomic-embed-text-v1.5',
  embed: true,
  input: 'Wedding photography pricing guide'
});

console.log(embedding.vector);        // Float32Array(768)
console.log(embedding.dimensions);    // 768
```

## Direct Calls (Security-Critical)

For security-critical operations (email quarantine scanner, content gates), use the direct path:

```javascript
const { callDirect } = require('/workspace/skills/llm-router/direct');

const result = await callDirect({
  model: 'lmstudio/qwen3-4b-2507',
  messages: [
    { role: 'system', content: 'You are a security scanner...' },
    { role: 'user', content: email.body }
  ],
  temperature: 0,
  timeoutMs: 10000
});

if (result.status === 'error') {
  // Fail-closed: reject suspicious content
  return { safe: false };
}
```

Direct calls:
- **No caching** (prevents cache poisoning)
- **No retry** (fail-fast for security decisions)
- **Independent credential resolution**
- **Not logged to interaction store** (security log only)

## Credentials

Set credentials in `~/.openclaw/.env`:

```bash
# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# OpenAI
OPENAI_API_KEY=sk-...

# Google AI
GOOGLE_AI_API_KEY=...

# LM Studio (optional, defaults to http://127.0.0.1:1234)
LM_STUDIO_URL=http://127.0.0.1:1234
```

Process environment variables override `.env` file.

## Options

```javascript
callLlm({
  // Required
  model: 'provider/model-name',
  
  // Input (one required)
  prompt: 'string',           // simple prompt
  messages: [],               // chat-format messages
  input: 'string',            // for embeddings
  
  // Optional
  systemPrompt: 'string',
  temperature: 0.7,           // 0-2
  maxTokens: 4096,
  topP: 1.0,
  json: false,                // request JSON response
  embed: false,               // embedding mode
  
  // Caching
  cacheSystemPrompt: false,
  
  // Retry
  retries: 3,
  retryDelayMs: 1000,
  timeoutMs: 30000,
  
  // Logging
  agent: 'marcus',
  taskType: 'review',
  taskDescription: 'Reviewing email...',
  sessionKey: 'abc-123'
});
```

## Architecture

```
Any System
    │
    callLlm({ model, prompt, ... })
    │
    ▼
┌──────────┐     ┌─────────────┐     ┌──────────────┐
│  Router   │ ──▶ │  Provider   │ ──▶ │  API/Server  │
│           │     │  (detected) │     │              │
└──────────┘     └─────────────┘     └──────────────┘
    │
    ├──▶ Logger (usage-tracking)
    ├──▶ Cache check/store
    └──▶ Retry on failure
```

## Files

- `router.js` - Main interface
- `direct.js` - Security-critical direct calls
- `providers/` - Provider implementations
- `credentials.js` - Credential resolution
- `retry.js` - Retry logic with circuit breaker
- `cache.js` - Prompt caching
- `smoke.js` - First-use smoke tests
- `model-utils.js` - Provider detection utilities
- `config.json` - Provider configuration

## Integration

The router is a **foundation layer** - it has no dependencies on other workspace systems. Other systems import and use it:

```javascript
// In any system
const { callLlm } = require('/workspace/skills/llm-router/router');

const result = await callLlm({
  model: 'lmstudio/gemma-3-12b-it',
  prompt: 'Your prompt here',
  agent: 'scout',
  taskType: 'research'
});
```

The router gracefully integrates with:
- **usage-tracking** - logs all calls (try/catch, skip if not available)
- **logging** - logs events (try/catch, skip if not available)

If these systems aren't built yet, the router still works.

## License

MIT
