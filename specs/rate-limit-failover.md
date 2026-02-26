# Rate Limit Failover & Monitoring
## Specification v1.0 (Patch to LLM Router)

**Author:** Marcus Rawlins (Opus)
**Date:** 2026-02-26
**Priority:** CRITICAL
**Type:** Patch to existing LLM Router + Usage Tracking
**Estimated Work:** 1 day (Brunel)

---

## 1. Problem

When an API provider returns a rate limit (HTTP 429), the entire system stalls. Tyler doesn't know which limit was hit, when it resets, or that it happened at all. Mission Control may become unresponsive if the gateway process hangs on retries.

## 2. Solution: Three Patches

### Patch 1: Fallback Chain in LLM Router

Add a configurable fallback chain per agent/task. When the primary model returns 429, automatically try the next model in the chain.

```javascript
// config.json addition
{
  "fallback_chains": {
    "default": [
      "anthropic/claude-sonnet-4-5",
      "openai/gpt-4o",
      "lmstudio/gemma-3-12b-it"
    ],
    "premium": [
      "anthropic/claude-opus-4-6",
      "anthropic/claude-sonnet-4-5",
      "openai/gpt-4-turbo",
      "lmstudio/gemma-3-12b-it"
    ],
    "local_first": [
      "lmstudio/gemma-3-12b-it",
      "lmstudio/qwen/qwen3-4b-2507"
    ],
    "embeddings": [
      "lmstudio/nomic-embed-text-v1.5"
    ]
  }
}
```

#### Router Changes (`router.js`)

```javascript
async function callLlm(options) {
  const chain = getFallbackChain(options.model, options.fallbackChain);
  
  for (let i = 0; i < chain.length; i++) {
    const model = chain[i];
    const { provider, modelName } = detectProvider(model);
    
    // Check circuit breaker before trying
    if (circuitBreaker.isOpen(provider)) {
      console.warn(`[router] ${provider} circuit open, skipping to next`);
      continue;
    }
    
    try {
      const result = await callProvider(provider, modelName, options);
      
      // Log if we fell back
      if (i > 0) {
        logFallback(options.model, model, chain[i-1], 'rate_limited');
      }
      
      return result;
    } catch (error) {
      if (error.status === 429) {
        // Rate limited: open circuit breaker for this provider
        const retryAfter = parseRetryAfter(error);
        circuitBreaker.open(provider, retryAfter);
        
        // Log the rate limit event
        logRateLimit({
          provider,
          model: modelName,
          retryAfterSeconds: retryAfter,
          timestamp: new Date().toISOString(),
          agent: options.agent,
          taskType: options.taskType
        });
        
        // Alert immediately
        await alertRateLimit(provider, modelName, retryAfter, options.agent);
        
        // Try next in chain
        continue;
      }
      
      // Non-429 errors: don't fallback, throw
      throw error;
    }
  }
  
  // All providers exhausted
  throw new Error(`All providers in fallback chain exhausted. Chain: ${chain.join(' → ')}`);
}

function getFallbackChain(primaryModel, chainName) {
  const chains = config.fallback_chains || {};
  
  if (chainName && chains[chainName]) {
    return chains[chainName];
  }
  
  // Build a chain: primary model + default chain (excluding duplicates)
  const defaultChain = chains.default || [];
  const chain = [primaryModel, ...defaultChain.filter(m => m !== primaryModel)];
  return chain;
}
```

### Patch 2: Circuit Breaker (Actually Implement It)

```javascript
// circuit-breaker.js (new file in llm-router/)

class CircuitBreaker {
  constructor() {
    // provider → { state: 'closed'|'open'|'half-open', openUntil: timestamp, failures: count }
    this.circuits = new Map();
  }

  isOpen(provider) {
    const circuit = this.circuits.get(provider);
    if (!circuit || circuit.state === 'closed') return false;
    
    if (circuit.state === 'open') {
      // Check if cooldown has passed
      if (Date.now() > circuit.openUntil) {
        circuit.state = 'half-open';
        return false; // Allow one test request
      }
      return true; // Still blocked
    }
    
    return false; // half-open allows requests
  }

  open(provider, retryAfterSeconds) {
    const cooldownMs = (retryAfterSeconds || 60) * 1000;
    
    this.circuits.set(provider, {
      state: 'open',
      openUntil: Date.now() + cooldownMs,
      openedAt: Date.now(),
      retryAfterSeconds,
      failures: (this.circuits.get(provider)?.failures || 0) + 1
    });
  }

  recordSuccess(provider) {
    const circuit = this.circuits.get(provider);
    if (circuit && circuit.state === 'half-open') {
      circuit.state = 'closed';
      circuit.failures = 0;
    }
  }

  recordFailure(provider) {
    const circuit = this.circuits.get(provider);
    if (circuit && circuit.state === 'half-open') {
      // Failed on test request, reopen
      this.open(provider, 120); // Back off longer
    }
  }

  getStatus() {
    const status = {};
    for (const [provider, circuit] of this.circuits) {
      status[provider] = {
        state: circuit.state,
        failures: circuit.failures,
        ...(circuit.state === 'open' ? {
          blockedUntil: new Date(circuit.openUntil).toISOString(),
          remainingSeconds: Math.max(0, Math.round((circuit.openUntil - Date.now()) / 1000))
        } : {})
      };
    }
    return status;
  }
}

module.exports = CircuitBreaker;
```

### Patch 3: Rate Limit Alerting & Tracking

```javascript
// rate-limit-tracker.js (new file in llm-router/)

const fs = require('fs');
const path = require('path');

const RATE_LIMIT_LOG = '/Volumes/reeseai-memory/data/usage-tracking/rate-limits.jsonl';

class RateLimitTracker {
  static log(event) {
    const entry = {
      ts: new Date().toISOString(),
      provider: event.provider,
      model: event.model,
      retry_after_seconds: event.retryAfterSeconds,
      agent: event.agent,
      task_type: event.taskType,
      fallback_used: event.fallbackModel || null
    };
    
    const dir = path.dirname(RATE_LIMIT_LOG);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(RATE_LIMIT_LOG, JSON.stringify(entry) + '\n');
  }

  static getRecent(hours = 24) {
    if (!fs.existsSync(RATE_LIMIT_LOG)) return [];
    
    const cutoff = new Date(Date.now() - hours * 3600000).toISOString();
    return fs.readFileSync(RATE_LIMIT_LOG, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(e => e && e.ts >= cutoff);
  }

  static getSummary(hours = 24) {
    const events = this.getRecent(hours);
    const byProvider = {};
    
    for (const e of events) {
      if (!byProvider[e.provider]) byProvider[e.provider] = { count: 0, models: new Set(), lastHit: null };
      byProvider[e.provider].count++;
      byProvider[e.provider].models.add(e.model);
      byProvider[e.provider].lastHit = e.ts;
    }
    
    return {
      total: events.length,
      byProvider: Object.fromEntries(
        Object.entries(byProvider).map(([k, v]) => [k, { ...v, models: [...v.models] }])
      )
    };
  }
}

module.exports = RateLimitTracker;
```

### Alert Format (Telegram)

When a rate limit is hit, Tyler gets:

```
⚠️ Rate Limit Hit

Provider: Anthropic
Model: claude-sonnet-4-5
Agent: marcus (chat)
Retry After: 60 seconds
Fallback: → openai/gpt-4o (automatic)

Circuit breaker open for Anthropic until 12:25 PM.
```

## 3. Mission Control Dashboard Addition

Add a "Provider Status" panel to MC's System view:

```json
{
  "providers": {
    "anthropic": { "status": "rate_limited", "circuit": "open", "reopens": "12:25 PM", "hits_24h": 3 },
    "openai": { "status": "healthy", "circuit": "closed", "hits_24h": 0 },
    "lmstudio": { "status": "healthy", "circuit": "closed", "hits_24h": 0 },
    "google": { "status": "healthy", "circuit": "closed", "hits_24h": 0 }
  }
}
```

Endpoint: `GET /api/provider-status` reads from the circuit breaker state and rate limit log.

## 4. MC Independence

Mission Control should NEVER go down because of API limits. It's a static web dashboard with its own data.

If MC is going down when the gateway stalls, the fix is:
- MC must not depend on real-time gateway API calls for rendering
- MC reads from SQLite databases on disk (tasks.json, usage.db, etc.)
- Gateway health is ONE panel on MC, not a dependency

## 5. Files to Create/Modify

**New files:**
- `/workspace/skills/llm-router/circuit-breaker.js`
- `/workspace/skills/llm-router/rate-limit-tracker.js`

**Modified files:**
- `/workspace/skills/llm-router/router.js` — add fallback chain logic
- `/workspace/skills/llm-router/config.json` — add fallback_chains
- `/workspace/skills/llm-router/retry.js` — integrate circuit breaker

## 6. Testing Checklist

- [ ] 429 from Anthropic → falls back to OpenAI
- [ ] 429 from OpenAI → falls back to local
- [ ] All providers rate limited → clear error message listing the chain
- [ ] Circuit breaker opens on 429, closes after cooldown
- [ ] Half-open state allows one test request
- [ ] Rate limit events logged to JSONL
- [ ] Telegram alert sent on rate limit
- [ ] MC provider status endpoint returns circuit breaker state
- [ ] MC stays up when gateway is down
