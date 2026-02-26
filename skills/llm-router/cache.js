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
