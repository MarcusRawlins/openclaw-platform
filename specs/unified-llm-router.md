# Unified LLM Router
## Specification v1.0

**Author:** Marcus Rawlins (Opus)
**Date:** 2026-02-26
**Priority:** CRITICAL (foundation layer)
**Estimated Build:** 2-3 days (Brunel)
**Location:** `/workspace/skills/llm-router/`

---

## 1. Overview

Single unified interface for all LLM calls across the entire agent ecosystem. Every system, skill, and script calls `callLlm()` instead of managing its own provider connections. The router handles provider detection, credential resolution, retries, caching, logging, and smoke testing. A separate direct-call module exists for security-critical operations that must be isolated from the agent's conversation context.

## 2. Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     llm-router/                          │
├─────────────────────────────────────────────────────────┤
│  router.js           Unified callLlm() interface        │
│  providers/                                              │
│  ├─ anthropic.js     Anthropic Claude SDK                │
│  ├─ openai.js        OpenAI SDK                          │
│  ├─ google.js        Google Gemini SDK                   │
│  ├─ lmstudio.js      LM Studio (OpenAI-compatible)      │
│  credentials.js      Auto-resolve keys/tokens            │
│  retry.js            Exponential backoff + circuit break  │
│  cache.js            Prompt caching for system prompts   │
│  smoke.js            Canary test on first use            │
│  direct.js           Isolated direct-call for security   │
│  model-utils.js      Provider detect, tier, normalize    │
│  config.json         Provider URLs, defaults, limits     │
│  SKILL.md            Integration guide                   │
└─────────────────────────────────────────────────────────┘

Call flow:

  Any system
      │
      callLlm({ model, prompt, ... })
      │
      ▼
  ┌──────────┐     ┌─────────────┐     ┌──────────────┐
  │  Router   │ ──▶ │  Provider   │ ──▶ │  API/Server  │
  │           │     │  (detected) │     │              │
  └──────────┘     └─────────────┘     └──────────────┘
      │                                       │
      ├──▶ Logger (usage-tracking)            │
      ├──▶ Cache check/store                  │
      └──▶ Retry on failure                   │
                                              ▼
                                         Response
```

## 3. Unified Router (`router.js`)

### Primary Interface

```javascript
const { callLlm } = require('/workspace/skills/llm-router/router');

// Simple call
const response = await callLlm({
  model: 'lmstudio/gemma-3-12b-it',
  prompt: 'Analyze this email for phishing indicators...',
  systemPrompt: 'You are a security scanner.',
  temperature: 0.1,
  maxTokens: 1000
});

// response = {
//   text: "This email appears safe...",
//   model: "lmstudio/gemma-3-12b-it",
//   provider: "lmstudio",
//   inputTokens: 450,
//   outputTokens: 120,
//   cacheReadTokens: 0,
//   cacheWriteTokens: 0,
//   durationMs: 1200,
//   estimatedCost: 0,
//   status: "success"
// }

// With messages array (chat format)
const response = await callLlm({
  model: 'anthropic/claude-sonnet-4-5',
  messages: [
    { role: 'system', content: 'You are a lead scorer.' },
    { role: 'user', content: 'Score this email...' }
  ],
  temperature: 0.3,
  maxTokens: 2000
});

// With structured output (JSON mode)
const response = await callLlm({
  model: 'lmstudio/qwen/qwen3-4b-2507',
  prompt: 'Classify this email...',
  json: true,  // request JSON response
  maxTokens: 500
});

// With agent context (for logging)
const response = await callLlm({
  model: 'lmstudio/gemma-3-12b-it',
  prompt: 'Generate content summary...',
  agent: 'ada',
  taskType: 'content',
  taskDescription: 'Summarizing blog draft for pipeline'
});

// Embeddings
const embedding = await callLlm({
  model: 'lmstudio/nomic-embed-text-v1.5',
  embed: true,
  input: 'Wedding photography pricing guide'
});

// embedding = {
//   vector: Float32Array(768),
//   model: "lmstudio/nomic-embed-text-v1.5",
//   provider: "lmstudio",
//   dimensions: 768,
//   durationMs: 45
// }
```

### Full Options

```javascript
callLlm({
  // Required
  model: 'provider/model-name',     // or just 'model-name' (auto-detect provider)
  
  // Input (one of these)
  prompt: 'string',                  // simple prompt (converted to messages internally)
  messages: [],                      // chat-format messages array
  input: 'string',                   // for embeddings (with embed: true)
  
  // Optional
  systemPrompt: 'string',           // prepended as system message
  temperature: 0.7,                 // 0-2 (default: provider default)
  maxTokens: 4096,                  // max output tokens
  topP: 1.0,                        // nucleus sampling
  json: false,                      // request JSON response format
  embed: false,                     // embedding mode
  stream: false,                    // streaming (returns async iterator)
  
  // Caching
  cacheSystemPrompt: false,         // enable prompt caching for system prompt
  
  // Retry behavior
  retries: 3,                       // max retry attempts (default from config)
  retryDelayMs: 1000,               // base delay (exponential backoff)
  timeoutMs: 30000,                 // per-attempt timeout
  
  // Logging context
  agent: 'marcus',                  // which agent is making the call
  taskType: 'review',              // task classification
  taskDescription: 'Reviewing...',  // brief description
  sessionKey: 'abc-123',           // OpenClaw session key
  
  // Advanced
  stopSequences: [],                // stop generation at these strings
  presencePenalty: 0,               // -2 to 2
  frequencyPenalty: 0,              // -2 to 2
  seed: null,                       // for reproducible outputs
  
  // Skip logging (for meta-calls like smoke tests)
  _skipLog: false
});
```

### Router Implementation

```javascript
const { detectProvider } = require('./model-utils');
const { resolveCredentials } = require('./credentials');
const { withRetry } = require('./retry');
const { checkCache, storeCache } = require('./cache');
const { smokeTest } = require('./smoke');

// Provider modules
const providers = {
  anthropic: require('./providers/anthropic'),
  openai: require('./providers/openai'),
  google: require('./providers/google'),
  lmstudio: require('./providers/lmstudio')
};

// Track which providers have passed smoke test
const smokeTestPassed = new Set();

async function callLlm(options) {
  const startTime = Date.now();
  
  // 1. Detect provider
  const { provider, modelName } = detectProvider(options.model);
  
  if (!providers[provider]) {
    throw new Error(`Unknown provider: ${provider}. Known: ${Object.keys(providers).join(', ')}`);
  }
  
  // 2. Resolve credentials
  const creds = resolveCredentials(provider);
  
  // 3. Smoke test on first use
  if (!smokeTestPassed.has(provider) && !options._skipLog) {
    const passed = await smokeTest(provider, creds, providers[provider]);
    if (!passed) {
      throw new Error(`Smoke test failed for provider: ${provider}. Check credentials and connectivity.`);
    }
    smokeTestPassed.add(provider);
  }
  
  // 4. Check prompt cache
  if (options.cacheSystemPrompt && options.systemPrompt) {
    const cached = checkCache(options.systemPrompt, provider);
    if (cached) {
      options._cachedSystemPromptId = cached.id;
    }
  }
  
  // 5. Normalize input to messages format
  const messages = normalizeMessages(options);
  
  // 6. Call provider with retry
  let result;
  try {
    result = await withRetry(
      () => providers[provider].call({
        model: modelName,
        messages,
        credentials: creds,
        ...options
      }),
      {
        retries: options.retries,
        delayMs: options.retryDelayMs,
        timeoutMs: options.timeoutMs,
        onRetry: (attempt, error) => {
          // Log retry attempts
          if (!options._skipLog) {
            logToInteractionStore({
              agent: options.agent,
              provider,
              model: modelName,
              status: 'retry',
              error: error.message,
              attempt
            });
          }
        }
      }
    );
  } catch (error) {
    const durationMs = Date.now() - startTime;
    
    // Log failure
    if (!options._skipLog) {
      logToInteractionStore({
        agent: options.agent || 'unknown',
        provider,
        model: modelName,
        taskType: options.taskType,
        taskDescription: options.taskDescription,
        inputTokens: 0,
        outputTokens: 0,
        durationMs,
        status: error.code === 'TIMEOUT' ? 'timeout' : 'error',
        error: error.message,
        sessionKey: options.sessionKey
      });
    }
    
    throw error;
  }
  
  const durationMs = Date.now() - startTime;
  
  // 7. Store prompt cache if applicable
  if (options.cacheSystemPrompt && options.systemPrompt && result.cacheId) {
    storeCache(options.systemPrompt, provider, result.cacheId);
  }
  
  // 8. Log to interaction store
  if (!options._skipLog) {
    logToInteractionStore({
      agent: options.agent || 'unknown',
      provider,
      model: modelName,
      taskType: options.taskType,
      taskDescription: options.taskDescription,
      inputTokens: result.inputTokens || 0,
      outputTokens: result.outputTokens || 0,
      cacheReadTokens: result.cacheReadTokens || 0,
      cacheWriteTokens: result.cacheWriteTokens || 0,
      durationMs,
      status: 'success',
      sessionKey: options.sessionKey
    });
  }
  
  // 9. Return normalized response
  return {
    text: result.text,
    model: modelName,
    provider,
    inputTokens: result.inputTokens || 0,
    outputTokens: result.outputTokens || 0,
    cacheReadTokens: result.cacheReadTokens || 0,
    cacheWriteTokens: result.cacheWriteTokens || 0,
    durationMs,
    estimatedCost: result.estimatedCost || 0,
    status: 'success',
    ...(result.json ? { json: result.json } : {}),
    ...(result.vector ? { vector: result.vector, dimensions: result.dimensions } : {})
  };
}

function normalizeMessages(options) {
  if (options.messages) {
    return options.messages;
  }
  
  const messages = [];
  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  if (options.prompt) {
    messages.push({ role: 'user', content: options.prompt });
  }
  return messages;
}

module.exports = { callLlm };
```

## 4. Provider Modules

### Anthropic (`providers/anthropic.js`)

```javascript
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
```

### OpenAI (`providers/openai.js`)

```javascript
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
```

### LM Studio (`providers/lmstudio.js`)

```javascript
async function call({ model, messages, credentials, ...options }) {
  // LM Studio uses OpenAI-compatible API
  const url = `${credentials.baseUrl}/v1/chat/completions`;
  
  // Handle embedding requests
  if (options.embed) {
    return await embed({ model, input: options.input, credentials });
  }
  
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

async function embed({ model, input, credentials }) {
  const url = `${credentials.baseUrl}/v1/embeddings`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input }),
    signal: AbortSignal.timeout(30000)
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
```

### Google Gemini (`providers/google.js`)

```javascript
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
```

## 5. Credential Resolution (`credentials.js`)

```javascript
const fs = require('fs');
const path = require('path');

const ENV_FILE = '/Users/marcusrawlins/.openclaw/.env';

// Load .env file once
let envCache = null;
function loadEnv() {
  if (envCache) return envCache;
  envCache = {};
  
  if (fs.existsSync(ENV_FILE)) {
    const content = fs.readFileSync(ENV_FILE, 'utf8');
    for (const line of content.split('\n')) {
      const match = line.match(/^([A-Z_]+)\s*=\s*(.+)$/);
      if (match) {
        envCache[match[1]] = match[2].replace(/^["']|["']$/g, '');
      }
    }
  }
  
  // Also check process.env (overrides file)
  return envCache;
}

const PROVIDER_CREDENTIALS = {
  anthropic: {
    resolve: () => ({
      apiKey: process.env.ANTHROPIC_API_KEY || loadEnv().ANTHROPIC_API_KEY
    }),
    required: ['apiKey'],
    envVars: ['ANTHROPIC_API_KEY']
  },
  openai: {
    resolve: () => ({
      apiKey: process.env.OPENAI_API_KEY || loadEnv().OPENAI_API_KEY,
      baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com'
    }),
    required: ['apiKey'],
    envVars: ['OPENAI_API_KEY']
  },
  google: {
    resolve: () => ({
      apiKey: process.env.GOOGLE_AI_API_KEY || loadEnv().GOOGLE_AI_API_KEY
    }),
    required: ['apiKey'],
    envVars: ['GOOGLE_AI_API_KEY']
  },
  lmstudio: {
    resolve: () => ({
      baseUrl: process.env.LM_STUDIO_URL || loadEnv().LM_STUDIO_URL || 'http://127.0.0.1:1234'
    }),
    required: ['baseUrl'],
    envVars: ['LM_STUDIO_URL']
  }
};

function resolveCredentials(provider) {
  const config = PROVIDER_CREDENTIALS[provider];
  if (!config) {
    throw new Error(`No credential config for provider: ${provider}`);
  }
  
  const creds = config.resolve();
  
  // Validate required fields
  for (const field of config.required) {
    if (!creds[field]) {
      throw new Error(
        `Missing credential '${field}' for ${provider}. Set one of: ${config.envVars.join(', ')}`
      );
    }
  }
  
  return creds;
}

module.exports = { resolveCredentials, PROVIDER_CREDENTIALS };
```

## 6. Retry with Circuit Breaker (`retry.js`)

```javascript
// Circuit breaker state per provider
const circuitState = new Map();

const CIRCUIT_THRESHOLD = 5;       // failures before opening circuit
const CIRCUIT_RESET_MS = 60000;    // try again after 60s

async function withRetry(fn, options = {}) {
  const maxRetries = options.retries ?? 3;
  const baseDelay = options.delayMs ?? 1000;
  const timeoutMs = options.timeoutMs ?? 30000;
  const onRetry = options.onRetry || (() => {});
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Timeout wrapper
      const result = await Promise.race([
        fn(),
        new Promise((_, reject) => {
          setTimeout(() => {
            const err = new Error(`Request timed out after ${timeoutMs}ms`);
            err.code = 'TIMEOUT';
            reject(err);
          }, timeoutMs);
        })
      ]);
      
      return result;
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      // Don't retry on auth errors
      if (error.status === 401 || error.status === 403) throw error;
      
      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 500;
      
      onRetry(attempt + 1, error);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

module.exports = { withRetry };
```

## 7. Prompt Cache (`cache.js`)

### Purpose
Cache system prompt identifiers across calls to reduce token costs. When the same system prompt is sent repeatedly (e.g., the scoring rubric for every email), Anthropic and others can cache it server-side. We track which prompts have been cached to send the right cache hints.

```javascript
const crypto = require('crypto');

// In-memory cache: hash → { provider, cacheId, createdAt, hitCount }
const promptCache = new Map();

function hashPrompt(text) {
  return crypto.createHash('sha256').update(text).digest('hex').substring(0, 16);
}

function checkCache(systemPrompt, provider) {
  const hash = hashPrompt(systemPrompt);
  const key = `${provider}:${hash}`;
  const entry = promptCache.get(key);
  
  if (entry) {
    entry.hitCount++;
    return entry;
  }
  return null;
}

function storeCache(systemPrompt, provider, cacheId) {
  const hash = hashPrompt(systemPrompt);
  const key = `${provider}:${hash}`;
  
  promptCache.set(key, {
    id: cacheId,
    provider,
    hash,
    createdAt: Date.now(),
    hitCount: 0
  });
}

function getCacheStats() {
  const stats = { entries: promptCache.size, totalHits: 0 };
  for (const entry of promptCache.values()) {
    stats.totalHits += entry.hitCount;
  }
  return stats;
}

module.exports = { checkCache, storeCache, getCacheStats, hashPrompt };
```

## 8. Smoke Test (`smoke.js`)

```javascript
const CANARY_PROMPT = 'Respond with exactly: CANARY_OK';
const CANARY_EXPECTED = 'CANARY_OK';

async function smokeTest(provider, credentials, providerModule) {
  try {
    const model = getCanaryModel(provider);
    
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
    lmstudio: 'qwen/qwen3-4b-2507'              // already loaded
  };
  return canaryModels[provider] || null;
}

module.exports = { smokeTest };
```

## 9. Direct Provider Path (`direct.js`)

### Purpose
Security-critical operations (email quarantine scanner, content gate reviewer) must be isolated from the agent's conversation context. This module calls provider APIs directly without going through the router's retry/cache/logging pipeline.

```javascript
const { resolveCredentials } = require('./credentials');
const { detectProvider } = require('./model-utils');

/**
 * Direct LLM call for security-critical operations.
 * - No caching (to prevent cache poisoning)
 * - No retry (fail-fast for security decisions)
 * - Independent credential resolution
 * - Minimal logging (only to security log, not interaction store)
 */
async function callDirect({ model, messages, maxTokens, temperature, timeoutMs }) {
  const { provider, modelName } = detectProvider(model);
  const creds = resolveCredentials(provider);  // independent resolution
  
  const providerModule = require(`./providers/${provider}`);
  
  const startTime = Date.now();
  
  try {
    const result = await Promise.race([
      providerModule.call({
        model: modelName,
        messages,
        credentials: creds,
        maxTokens: maxTokens || 1000,
        temperature: temperature ?? 0,
        _skipLog: true  // don't log to interaction store
      }),
      new Promise((_, reject) => {
        setTimeout(() => {
          const err = new Error('Security call timed out');
          err.code = 'TIMEOUT';
          reject(err);
        }, timeoutMs || 15000);
      })
    ]);
    
    return {
      text: result.text,
      status: 'success',
      durationMs: Date.now() - startTime
    };
  } catch (error) {
    return {
      text: null,
      status: 'error',
      error: error.message,
      durationMs: Date.now() - startTime
    };
  }
}

module.exports = { callDirect };
```

### Usage in Security Contexts

```javascript
// In email-pipeline/quarantine.js
const { callDirect } = require('/workspace/skills/llm-router/direct');

async function scanEmail(email) {
  const result = await callDirect({
    model: 'lmstudio/qwen/qwen3-4b-2507',
    messages: [
      { role: 'system', content: 'You are a security scanner...' },
      { role: 'user', content: email.body }
    ],
    temperature: 0,
    timeoutMs: 10000
  });
  
  if (result.status === 'error') {
    return { safe: false, reason: 'Scanner failed (fail-closed)' };
  }
  
  return JSON.parse(result.text);
}
```

## 10. Model Utilities (`model-utils.js`)

```javascript
// Provider detection from model string
const PROVIDER_PATTERNS = [
  { prefix: 'anthropic/', provider: 'anthropic' },
  { prefix: 'claude-', provider: 'anthropic' },
  { prefix: 'openai/', provider: 'openai' },
  { prefix: 'gpt-', provider: 'openai' },
  { prefix: 'o1-', provider: 'openai' },
  { prefix: 'google/', provider: 'google' },
  { prefix: 'gemini-', provider: 'google' },
  { prefix: 'lmstudio/', provider: 'lmstudio' },
  // Common local model names
  { prefix: 'qwen', provider: 'lmstudio' },
  { prefix: 'gemma', provider: 'lmstudio' },
  { prefix: 'llama', provider: 'lmstudio' },
  { prefix: 'mistral', provider: 'lmstudio' },
  { prefix: 'devstral', provider: 'lmstudio' },
  { prefix: 'nomic-', provider: 'lmstudio' },
  { prefix: 'phi-', provider: 'lmstudio' }
];

function detectProvider(modelString) {
  // Explicit provider prefix (e.g., "anthropic/claude-opus-4-6")
  const slashIndex = modelString.indexOf('/');
  if (slashIndex > 0) {
    const prefix = modelString.substring(0, slashIndex);
    const knownProviders = ['anthropic', 'openai', 'google', 'lmstudio'];
    if (knownProviders.includes(prefix)) {
      return {
        provider: prefix,
        modelName: modelString.substring(slashIndex + 1)
      };
    }
    // LM Studio nested paths (e.g., "lmstudio/mistralai/devstral-small-2-2512")
    if (prefix === 'lmstudio') {
      return {
        provider: 'lmstudio',
        modelName: modelString.substring(slashIndex + 1)
      };
    }
  }
  
  // Pattern matching
  for (const { prefix, provider } of PROVIDER_PATTERNS) {
    if (modelString.startsWith(prefix)) {
      return { provider, modelName: modelString };
    }
  }
  
  // Default: assume LM Studio (local)
  return { provider: 'lmstudio', modelName: modelString };
}

// Model tier classification
const MODEL_TIERS = {
  'claude-opus-4-6': { tier: 'premium', capability: 'reasoning', contextWindow: 200000 },
  'claude-sonnet-4-5': { tier: 'standard', capability: 'general', contextWindow: 200000 },
  'claude-haiku-4-5': { tier: 'fast', capability: 'general', contextWindow: 200000 },
  'gpt-4-turbo': { tier: 'premium', capability: 'general', contextWindow: 128000 },
  'gpt-4o': { tier: 'standard', capability: 'general', contextWindow: 128000 },
  'gpt-4o-mini': { tier: 'fast', capability: 'general', contextWindow: 128000 },
  'gemini-2.5-pro': { tier: 'premium', capability: 'reasoning', contextWindow: 1000000 },
  'gemini-2.0-flash': { tier: 'fast', capability: 'general', contextWindow: 1000000 }
};

function getModelTier(modelName) {
  // Strip provider prefix
  const name = modelName.includes('/') ? modelName.split('/').pop() : modelName;
  return MODEL_TIERS[name] || { tier: 'local', capability: 'general', contextWindow: 8192 };
}

// Normalize model names across providers
function normalizeModelName(modelString) {
  const { provider, modelName } = detectProvider(modelString);
  return `${provider}/${modelName}`;
}

// Check if model is local (zero cost)
function isLocalModel(modelString) {
  const { provider } = detectProvider(modelString);
  return provider === 'lmstudio';
}

module.exports = { detectProvider, getModelTier, normalizeModelName, isLocalModel, MODEL_TIERS };
```

## 11. Integration with Logging System

The router automatically logs every call through the logging infrastructure:

```javascript
// In router.js
function logToInteractionStore(callData) {
  // Log to usage-tracking (if available)
  try {
    const UsageLogger = require('/workspace/skills/usage-tracking/logger');
    UsageLogger.getInstance().logLLM(callData);
  } catch (e) { /* usage-tracking not installed yet, skip */ }
  
  // Log to logging infrastructure (if available)
  try {
    const Logger = require('/workspace/skills/logging/logger');
    Logger.getInstance().info('usage.llm', {
      provider: callData.provider,
      model: callData.model,
      agent: callData.agent,
      inputTokens: callData.inputTokens,
      outputTokens: callData.outputTokens,
      cost: callData.estimatedCost,
      status: callData.status,
      durationMs: callData.durationMs
    });
  } catch (e) { /* logging not installed yet, skip */ }
}
```

Both integrations are graceful: if the downstream system isn't built yet, the router still works.

## 12. Configuration (`config.json`)

```json
{
  "providers": {
    "anthropic": {
      "baseUrl": "https://api.anthropic.com",
      "defaultModel": "claude-sonnet-4-5",
      "maxRetries": 3,
      "timeoutMs": 60000
    },
    "openai": {
      "baseUrl": "https://api.openai.com",
      "defaultModel": "gpt-4o-mini",
      "maxRetries": 3,
      "timeoutMs": 60000
    },
    "google": {
      "defaultModel": "gemini-2.0-flash",
      "maxRetries": 3,
      "timeoutMs": 60000
    },
    "lmstudio": {
      "baseUrl": "http://127.0.0.1:1234",
      "defaultModel": "gemma-3-12b-it",
      "maxRetries": 1,
      "timeoutMs": 120000
    }
  },
  "defaults": {
    "temperature": 0.7,
    "maxTokens": 4096,
    "retries": 3,
    "retryDelayMs": 1000
  },
  "smokeTest": {
    "enabled": true,
    "canaryPrompt": "Respond with exactly: CANARY_OK"
  }
}
```

## 13. File Structure

```
/workspace/skills/llm-router/
├── router.js              # Unified callLlm() interface
├── providers/
│   ├── anthropic.js       # Anthropic Claude SDK
│   ├── openai.js          # OpenAI SDK
│   ├── google.js          # Google Gemini
│   └── lmstudio.js        # LM Studio (OpenAI-compatible)
├── credentials.js         # Auto-resolve API keys/tokens
├── retry.js               # Exponential backoff + circuit breaker
├── cache.js               # Prompt caching for system prompts
├── smoke.js               # Canary test on first provider use
├── direct.js              # Isolated direct-call for security
├── model-utils.js         # Provider detect, tier, normalize
├── config.json            # Provider configs and defaults
├── SKILL.md               # Integration guide
├── README.md              # Overview and usage
└── package.json           # Dependencies
```

## 14. Dependencies

- `node-fetch` (or Node.js built-in fetch for v18+)
- No SDKs required (all providers called via HTTP for consistency and minimal deps)
- Optional: `@anthropic-ai/sdk`, `openai` (if preferred over raw HTTP)

## 15. Dependency Graph

```
llm-router (FOUNDATION)
    │
    ├──▶ logging (uses router for nothing, router logs TO it)
    │
    ├──▶ usage-tracking (router logs calls to it)
    │
    └──▶ email-pipeline, bi-council, content-pipeline, kb-rag, daily-briefing
         (all import callLlm from router)
```

The router has NO dependencies on other workspace systems. It's the bottom of the stack.

## 16. Migration Path

Existing systems that make direct LLM calls should be migrated to use the router:

| System | Current Approach | Migration |
|---|---|---|
| BI Council experts | Direct fetch to LM Studio | `callLlm({ model: 'lmstudio/gemma-3-12b-it', ... })` |
| KB RAG embeddings | Direct fetch to LM Studio /v1/embeddings | `callLlm({ model: 'lmstudio/nomic-embed-text-v1.5', embed: true, ... })` |
| Content Pipeline summarizer | Direct fetch to LM Studio | `callLlm({ model: 'lmstudio/gemma-3-12b-it', ... })` |
| Daily Briefing | Direct fetch to LM Studio | `callLlm({ model: 'lmstudio/qwen/qwen3-4b-2507', ... })` |
| Email Pipeline (future) | Would have been direct | Built on router from the start |

This migration can be done incrementally. Each system switches one import at a time.

## 17. Testing Checklist

- [ ] Router: detects all providers correctly from model strings
- [ ] Router: resolves credentials for all providers
- [ ] Router: smoke test passes for LM Studio
- [ ] Router: smoke test passes for Anthropic (if key available)
- [ ] Router: auto-retry on 5xx errors
- [ ] Router: no retry on 401/403
- [ ] Router: timeout kills hung requests
- [ ] Router: logs all calls to usage-tracking
- [ ] Router: logs all calls to logging infrastructure
- [ ] Router: handles embedding requests
- [ ] Router: handles JSON mode
- [ ] Direct: isolated from router state
- [ ] Direct: fails fast (no retry)
- [ ] Direct: resolves credentials independently
- [ ] Cache: stores and retrieves prompt cache IDs
- [ ] Model utils: detects provider from all known patterns
- [ ] Model utils: normalizes model names consistently
- [ ] Model utils: identifies local models as zero-cost
- [ ] Credentials: reads from .env file
- [ ] Credentials: process.env overrides file
- [ ] Credentials: clear error on missing credentials
