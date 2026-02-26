const fs = require('fs');
const path = require('path');
const config = require('./config.json');
const db = require('./db');
const costEstimator = require('./cost-estimator');

/**
 * Sync usage data from OpenClaw gateway
 * Pulls session metadata and converts to our format
 */

/**
 * Get last sync timestamp
 * @returns {number} Unix timestamp (ms) of last sync, or 0 if never synced
 */
function getLastSyncTime() {
  try {
    if (fs.existsSync(config.gateway_sync.last_sync_file)) {
      const data = fs.readFileSync(config.gateway_sync.last_sync_file, 'utf8');
      return parseInt(data.trim(), 10) || 0;
    }
  } catch (err) {
    console.error('[GatewaySync] Error reading last sync file:', err.message);
  }
  return 0;
}

/**
 * Save last sync timestamp
 * @param {number} timestamp - Unix timestamp (ms)
 */
function saveLastSyncTime(timestamp) {
  try {
    const dir = path.dirname(config.gateway_sync.last_sync_file);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(config.gateway_sync.last_sync_file, timestamp.toString());
  } catch (err) {
    console.error('[GatewaySync] Error saving last sync file:', err.message);
  }
}

/**
 * Fetch sessions from gateway API
 * @returns {Promise<array>} Array of session objects
 */
async function fetchGatewaySessions() {
  try {
    const url = `${config.gateway_sync.url}/api/sessions`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Gateway API returned ${response.status}`);
    }
    
    const data = await response.json();
    return data.sessions || [];
  } catch (err) {
    console.error('[GatewaySync] Error fetching sessions:', err.message);
    return [];
  }
}

/**
 * Extract usage data from gateway session
 * @param {object} session - Gateway session object
 * @returns {object|null} Usage record or null if invalid
 */
function extractUsageFromSession(session) {
  try {
    // Expected gateway session structure (adapt to actual API):
    // {
    //   key: 'session-key',
    //   agent: 'marcus',
    //   model: 'anthropic/claude-opus-4-6',
    //   createdAt: '2026-02-26T10:30:00Z',
    //   tokensIn: 5000,
    //   tokensOut: 2000,
    //   cacheRead: 30000,
    //   cacheWrite: 0,
    //   duration: 3200,
    //   status: 'completed'
    // }
    
    if (!session.model || !session.tokensIn || !session.tokensOut) {
      return null; // Invalid session
    }
    
    // Parse model string (e.g., "anthropic/claude-opus-4-6")
    const modelParts = session.model.split('/');
    const provider = modelParts[0] || 'unknown';
    const model = modelParts.slice(1).join('/') || session.model;
    
    // Estimate cost
    const cost = costEstimator.estimateCost({
      provider,
      model,
      inputTokens: session.tokensIn || 0,
      outputTokens: session.tokensOut || 0,
      cacheReadTokens: session.cacheRead || 0,
      cacheWriteTokens: session.cacheWrite || 0
    });
    
    return {
      timestamp: session.createdAt || new Date().toISOString(),
      agent: session.agent || 'unknown',
      provider,
      model,
      taskType: session.taskType || 'gateway',
      taskDescription: session.description || 'Gateway session',
      promptHash: null,
      promptPreview: null,
      responsePreview: null,
      inputTokens: session.tokensIn || 0,
      outputTokens: session.tokensOut || 0,
      cacheReadTokens: session.cacheRead || 0,
      cacheWriteTokens: session.cacheWrite || 0,
      durationMs: session.duration || null,
      estimatedCostUsd: cost.cost_usd,
      status: session.status === 'completed' ? 'success' : 'error',
      errorMessage: session.error || null,
      sessionKey: session.key || null,
      metadata: JSON.stringify({ source: 'gateway_sync', ...session.metadata })
    };
  } catch (err) {
    console.error('[GatewaySync] Error extracting session data:', err.message);
    return null;
  }
}

/**
 * Check if session already exists in database
 * @param {string} sessionKey - Session key
 * @returns {boolean} True if exists
 */
function sessionExists(sessionKey) {
  if (!sessionKey) return false;
  
  const database = db.getDB();
  const stmt = database.prepare('SELECT id FROM llm_calls WHERE session_key = ? LIMIT 1');
  const result = stmt.get(sessionKey);
  return !!result;
}

/**
 * Sync gateway usage data
 * @returns {Promise<object>} Sync results { synced, skipped, errors }
 */
async function sync() {
  console.log('[GatewaySync] Starting sync...');
  
  const lastSync = getLastSyncTime();
  const now = Date.now();
  
  const sessions = await fetchGatewaySessions();
  
  let synced = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const session of sessions) {
    try {
      // Skip if already in database
      if (sessionExists(session.key)) {
        skipped++;
        continue;
      }
      
      // Skip if older than last sync
      const sessionTime = new Date(session.createdAt).getTime();
      if (sessionTime < lastSync) {
        skipped++;
        continue;
      }
      
      // Extract and insert
      const record = extractUsageFromSession(session);
      if (record) {
        db.insertLLMCall(record);
        synced++;
      } else {
        errors++;
      }
    } catch (err) {
      console.error('[GatewaySync] Error processing session:', err.message);
      errors++;
    }
  }
  
  // Update last sync time
  saveLastSyncTime(now);
  
  // Update daily aggregates
  const today = new Date().toISOString().split('T')[0];
  db.updateDailyAggregates(today);
  
  const result = { synced, skipped, errors, total: sessions.length };
  console.log('[GatewaySync] Complete:', result);
  
  return result;
}

/**
 * CLI entry point
 */
async function main() {
  try {
    const result = await sync();
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('[GatewaySync] Fatal error:', err);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  sync,
  getLastSyncTime,
  saveLastSyncTime
};
