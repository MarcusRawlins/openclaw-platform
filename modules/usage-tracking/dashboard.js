#!/usr/bin/env node

const fs = require('fs');
const db = require('./db');
const config = require('./config.json');
const costEstimator = require('./cost-estimator');

/**
 * Dashboard with CLI visualization
 */

/**
 * Get today's spending
 */
function getTodaySpending() {
  const database = db.getDB();
  const today = new Date().toISOString().split('T')[0];
  
  const stmt = database.prepare(`
    SELECT
      SUM(estimated_cost_usd) as total_cost,
      COUNT(*) as call_count
    FROM llm_calls
    WHERE date(timestamp) = ?
  `);
  
  const result = stmt.get(today);
  return {
    cost: parseFloat((result.total_cost || 0).toFixed(2)),
    calls: result.call_count || 0
  };
}

/**
 * Get month-to-date spending
 */
function getMTDSpending() {
  const database = db.getDB();
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const stmt = database.prepare(`
    SELECT
      SUM(estimated_cost_usd) as total_cost,
      COUNT(*) as call_count
    FROM llm_calls
    WHERE strftime('%Y-%m', timestamp) = ?
  `);
  
  const result = stmt.get(yearMonth);
  return {
    cost: parseFloat((result.total_cost || 0).toFixed(2)),
    calls: result.call_count || 0
  };
}

/**
 * Get today's calls by agent
 */
function getTodayCallsByAgent() {
  const database = db.getDB();
  const today = new Date().toISOString().split('T')[0];
  
  const stmt = database.prepare(`
    SELECT
      agent,
      model,
      COUNT(*) as call_count,
      SUM(estimated_cost_usd) as total_cost
    FROM llm_calls
    WHERE date(timestamp) = ?
    GROUP BY agent, model
    ORDER BY total_cost DESC
  `);
  
  const rows = stmt.all(today);
  
  // Group by agent (combine models)
  const byAgent = {};
  for (const row of rows) {
    if (!byAgent[row.agent]) {
      byAgent[row.agent] = { calls: 0, cost: 0, models: [] };
    }
    byAgent[row.agent].calls += row.call_count;
    byAgent[row.agent].cost += row.total_cost || 0;
    byAgent[row.agent].models.push({ model: row.model, calls: row.call_count });
  }
  
  return Object.entries(byAgent).map(([agent, data]) => ({
    agent,
    calls: data.calls,
    cost: parseFloat(data.cost.toFixed(2)),
    primaryModel: data.models[0]?.model || 'unknown'
  }));
}

/**
 * Get today's token usage
 */
function getTodayTokens() {
  const database = db.getDB();
  const today = new Date().toISOString().split('T')[0];
  
  const stmt = database.prepare(`
    SELECT
      SUM(input_tokens) as total_input,
      SUM(output_tokens) as total_output,
      SUM(cache_read_tokens) as total_cache_read
    FROM llm_calls
    WHERE date(timestamp) = ?
  `);
  
  const result = stmt.get(today);
  
  // Calculate cache savings
  const cacheReadTokens = result.total_cache_read || 0;
  let cacheSavings = 0;
  
  if (cacheReadTokens > 0) {
    // Estimate savings (assuming Anthropic Claude Opus pricing as baseline)
    const savings = costEstimator.calculateCacheSavings(cacheReadTokens, 'anthropic', 'claude-opus-4-6');
    cacheSavings = savings.saved_usd;
  }
  
  return {
    input: result.total_input || 0,
    output: result.total_output || 0,
    cacheRead: cacheReadTokens,
    cacheSavings: parseFloat(cacheSavings.toFixed(2))
  };
}

/**
 * Get today's API calls
 */
function getTodayAPICalls() {
  const database = db.getDB();
  const today = new Date().toISOString().split('T')[0];
  
  const stmt = database.prepare(`
    SELECT
      service,
      COUNT(*) as call_count,
      SUM(estimated_cost_usd) as total_cost
    FROM api_calls
    WHERE date(timestamp) = ?
    GROUP BY service
    ORDER BY call_count DESC
  `);
  
  const rows = stmt.all(today);
  return rows.map(row => ({
    service: row.service,
    calls: row.call_count,
    cost: parseFloat((row.total_cost || 0).toFixed(3))
  }));
}

/**
 * Get database sizes
 */
function getDatabaseSizes() {
  const sizes = [];
  
  const databases = [
    { name: 'usage.db', path: config.database.path },
    { name: 'council.db', path: '/Volumes/reeseai-memory/data/bi-council/council-history.db' },
    { name: 'reese-catalog.db', path: '/Volumes/reeseai-memory/data/databases/reese-catalog.db' },
    { name: 'reeseai.db', path: '/Volumes/reeseai-memory/data/databases/reeseai.db' }
  ];
  
  for (const dbInfo of databases) {
    try {
      if (fs.existsSync(dbInfo.path)) {
        const stats = fs.statSync(dbInfo.path);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(1);
        sizes.push({ name: dbInfo.name, size: `${sizeMB} MB` });
      }
    } catch (err) {
      // Skip if file doesn't exist or can't be read
    }
  }
  
  return sizes;
}

/**
 * Format dashboard as text
 */
function formatDashboard(data) {
  const lines = [];
  
  const date = new Date().toISOString().split('T')[0];
  
  lines.push('╔══════════════════════════════════════════════════════╗');
  lines.push(`║           USAGE DASHBOARD — ${date}              ║`);
  lines.push('╠══════════════════════════════════════════════════════╣');
  lines.push('║                                                      ║');
  
  // Today's spend
  const todayPct = (data.today.cost / config.budgets.daily_usd * 100).toFixed(0);
  lines.push(`║  TODAY'S SPEND          $${data.today.cost.toFixed(2)} / $${config.budgets.daily_usd.toFixed(0)} daily budget (${todayPct}%)   ║`);
  
  // MTD spend
  const mtdPct = (data.mtd.cost / config.budgets.monthly_usd * 100).toFixed(0);
  lines.push(`║  MTD SPEND              $${data.mtd.cost.toFixed(2)} / $${config.budgets.monthly_usd.toFixed(0)} monthly budget (${mtdPct}%)  ║`);
  lines.push('║                                                      ║');
  
  // Calls today
  lines.push('║  CALLS TODAY                                         ║');
  for (const agent of data.callsByAgent.slice(0, 5)) {
    const modelShort = agent.primaryModel.split('/').pop().substring(0, 12);
    const agentName = agent.agent.substring(0, 10).padEnd(10);
    const calls = agent.calls.toString().padStart(2);
    const cost = agent.cost.toFixed(2).padStart(5);
    lines.push(`║  ├─ ${agentName} (${modelShort.padEnd(12)}) ${calls} calls  $${cost}    ║`);
  }
  lines.push('║                                                      ║');
  
  // Token usage
  lines.push('║  TOKEN USAGE                                         ║');
  lines.push(`║  ├─ Input:    ${data.tokens.input.toLocaleString().padStart(9)} tokens                         ║`);
  lines.push(`║  ├─ Output:   ${data.tokens.output.toLocaleString().padStart(9)} tokens                         ║`);
  if (data.tokens.cacheRead > 0) {
    lines.push(`║  └─ Cached:   ${data.tokens.cacheRead.toLocaleString().padStart(9)} tokens (saved $${data.tokens.cacheSavings})      ║`);
  }
  lines.push('║                                                      ║');
  
  // API calls
  if (data.apiCalls.length > 0) {
    lines.push('║  API CALLS                                           ║');
    for (const api of data.apiCalls.slice(0, 3)) {
      const service = api.service.substring(0, 12).padEnd(12);
      const calls = api.calls.toString().padStart(2);
      const costStr = api.cost > 0 ? `$${api.cost.toFixed(3)}` : 'free';
      lines.push(`║  ├─ ${service}: ${calls} calls    ${costStr.padStart(6)}                ║`);
    }
    lines.push('║                                                      ║');
  }
  
  // Database sizes
  if (data.dbSizes.length > 0) {
    lines.push('║  DATABASE SIZES                                      ║');
    for (const dbInfo of data.dbSizes.slice(0, 4)) {
      const name = dbInfo.name.padEnd(20);
      const size = dbInfo.size.padStart(8);
      lines.push(`║  ├─ ${name} ${size}                      ║`);
    }
    lines.push('║                                                      ║');
  }
  
  lines.push('╚══════════════════════════════════════════════════════╝');
  
  return lines.join('\n');
}

/**
 * Generate dashboard data
 */
function generateDashboard() {
  return {
    today: getTodaySpending(),
    mtd: getMTDSpending(),
    callsByAgent: getTodayCallsByAgent(),
    tokens: getTodayTokens(),
    apiCalls: getTodayAPICalls(),
    dbSizes: getDatabaseSizes()
  };
}

/**
 * CLI entry point
 */
function main() {
  const args = process.argv.slice(2);
  const jsonMode = args.includes('--json');
  
  const data = generateDashboard();
  
  if (jsonMode) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(formatDashboard(data));
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  generateDashboard,
  getTodaySpending,
  getMTDSpending,
  getTodayCallsByAgent,
  getTodayTokens,
  getTodayAPICalls,
  getDatabaseSizes
};
