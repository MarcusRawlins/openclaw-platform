#!/usr/bin/env node

const db = require('./db');
const costEstimator = require('./cost-estimator');

/**
 * Report generator with CLI interface
 */

/**
 * Parse CLI arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    today: args.includes('--today'),
    json: args.includes('--json'),
    from: null,
    to: null,
    agent: null,
    model: null,
    provider: null,
    task: null,
    last: null,
    breakdown: null,
    topAgents: args.includes('--top-agents'),
    topModels: args.includes('--top-models')
  };
  
  // Parse --from YYYY-MM-DD
  const fromIdx = args.indexOf('--from');
  if (fromIdx >= 0 && args[fromIdx + 1]) {
    options.from = args[fromIdx + 1];
  }
  
  // Parse --to YYYY-MM-DD
  const toIdx = args.indexOf('--to');
  if (toIdx >= 0 && args[toIdx + 1]) {
    options.to = args[toIdx + 1];
  }
  
  // Parse --agent <name>
  const agentIdx = args.indexOf('--agent');
  if (agentIdx >= 0 && args[agentIdx + 1]) {
    options.agent = args[agentIdx + 1];
  }
  
  // Parse --model <name>
  const modelIdx = args.indexOf('--model');
  if (modelIdx >= 0 && args[modelIdx + 1]) {
    options.model = args[modelIdx + 1];
  }
  
  // Parse --provider <name>
  const providerIdx = args.indexOf('--provider');
  if (providerIdx >= 0 && args[providerIdx + 1]) {
    options.provider = args[providerIdx + 1];
  }
  
  // Parse --task <type>
  const taskIdx = args.indexOf('--task');
  if (taskIdx >= 0 && args[taskIdx + 1]) {
    options.task = args[taskIdx + 1];
  }
  
  // Parse --last <period> (e.g., 7d, 30d)
  const lastIdx = args.indexOf('--last');
  if (lastIdx >= 0 && args[lastIdx + 1]) {
    options.last = args[lastIdx + 1];
  }
  
  // Parse --breakdown <dimension>
  const breakdownIdx = args.indexOf('--breakdown');
  if (breakdownIdx >= 0 && args[breakdownIdx + 1]) {
    options.breakdown = args[breakdownIdx + 1];
  }
  
  return options;
}

/**
 * Calculate date range from options
 */
function getDateRange(options) {
  let from, to;
  
  if (options.today) {
    const today = new Date().toISOString().split('T')[0];
    from = today;
    to = today;
  } else if (options.last) {
    // Parse "7d", "30d", etc.
    const match = options.last.match(/^(\d+)d$/);
    if (match) {
      const days = parseInt(match[1], 10);
      to = new Date().toISOString().split('T')[0];
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);
      from = fromDate.toISOString().split('T')[0];
    }
  } else {
    from = options.from;
    to = options.to;
  }
  
  return { from, to };
}

/**
 * Build WHERE clause from filters
 */
function buildWhereClause(options, dateRange) {
  const conditions = [];
  const params = {};
  
  if (dateRange.from) {
    conditions.push("date(timestamp) >= :from");
    params.from = dateRange.from;
  }
  
  if (dateRange.to) {
    conditions.push("date(timestamp) <= :to");
    params.to = dateRange.to;
  }
  
  if (options.agent) {
    conditions.push("agent = :agent");
    params.agent = options.agent;
  }
  
  if (options.model) {
    conditions.push("model LIKE :model");
    params.model = `%${options.model}%`;
  }
  
  if (options.provider) {
    conditions.push("provider = :provider");
    params.provider = options.provider;
  }
  
  if (options.task) {
    conditions.push("task_type = :task");
    params.task = options.task;
  }
  
  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  return { where, params };
}

/**
 * Get summary statistics
 */
function getSummary(options) {
  const database = db.getDB();
  const dateRange = getDateRange(options);
  const { where, params } = buildWhereClause(options, dateRange);
  
  const query = `
    SELECT
      COUNT(*) as total_calls,
      SUM(input_tokens) as total_input_tokens,
      SUM(output_tokens) as total_output_tokens,
      SUM(cache_read_tokens) as total_cache_read_tokens,
      SUM(estimated_cost_usd) as total_cost,
      AVG(estimated_cost_usd) as avg_cost_per_call,
      AVG(duration_ms) as avg_duration_ms,
      SUM(CASE WHEN status != 'success' THEN 1 ELSE 0 END) as error_count
    FROM llm_calls
    ${where}
  `;
  
  const stmt = database.prepare(query);
  const result = stmt.get(params);
  
  return {
    total_calls: result.total_calls || 0,
    total_input_tokens: result.total_input_tokens || 0,
    total_output_tokens: result.total_output_tokens || 0,
    total_cache_read_tokens: result.total_cache_read_tokens || 0,
    total_cost_usd: parseFloat((result.total_cost || 0).toFixed(4)),
    avg_cost_per_call: parseFloat((result.avg_cost_per_call || 0).toFixed(6)),
    avg_duration_ms: Math.round(result.avg_duration_ms || 0),
    error_count: result.error_count || 0,
    error_rate: result.total_calls > 0 ? (result.error_count / result.total_calls * 100).toFixed(2) + '%' : '0%'
  };
}

/**
 * Get breakdown by dimension
 */
function getBreakdown(options, dimension) {
  const database = db.getDB();
  const dateRange = getDateRange(options);
  const { where, params } = buildWhereClause(options, dateRange);
  
  const query = `
    SELECT
      ${dimension},
      COUNT(*) as call_count,
      SUM(input_tokens) as total_input_tokens,
      SUM(output_tokens) as total_output_tokens,
      SUM(estimated_cost_usd) as total_cost
    FROM llm_calls
    ${where}
    GROUP BY ${dimension}
    ORDER BY total_cost DESC
  `;
  
  const stmt = database.prepare(query);
  const rows = stmt.all(params);
  
  return rows.map(row => ({
    [dimension]: row[dimension],
    call_count: row.call_count,
    total_input_tokens: row.total_input_tokens || 0,
    total_output_tokens: row.total_output_tokens || 0,
    total_cost_usd: parseFloat((row.total_cost || 0).toFixed(4))
  }));
}

/**
 * Get top consumers
 */
function getTopAgents(options, limit = 10) {
  return getBreakdown(options, 'agent').slice(0, limit);
}

function getTopModels(options, limit = 10) {
  return getBreakdown(options, 'model').slice(0, limit);
}

/**
 * Format report as text
 */
function formatReport(data) {
  const lines = [];
  
  lines.push('═══════════════════════════════════════════════════');
  lines.push('           LLM USAGE REPORT');
  lines.push('═══════════════════════════════════════════════════');
  lines.push('');
  
  // Summary
  lines.push('SUMMARY');
  lines.push('───────────────────────────────────────────────────');
  lines.push(`Total Calls:        ${data.summary.total_calls}`);
  lines.push(`Total Cost:         $${data.summary.total_cost_usd}`);
  lines.push(`Avg Cost/Call:      $${data.summary.avg_cost_per_call}`);
  lines.push(`Input Tokens:       ${data.summary.total_input_tokens.toLocaleString()}`);
  lines.push(`Output Tokens:      ${data.summary.total_output_tokens.toLocaleString()}`);
  lines.push(`Cache Read Tokens:  ${data.summary.total_cache_read_tokens.toLocaleString()}`);
  lines.push(`Avg Duration:       ${data.summary.avg_duration_ms}ms`);
  lines.push(`Errors:             ${data.summary.error_count} (${data.summary.error_rate})`);
  lines.push('');
  
  // Breakdown by agent
  if (data.byAgent && data.byAgent.length > 0) {
    lines.push('BY AGENT');
    lines.push('───────────────────────────────────────────────────');
    for (const row of data.byAgent) {
      lines.push(`${row.agent.padEnd(20)} ${row.call_count.toString().padStart(5)} calls    $${row.total_cost_usd}`);
    }
    lines.push('');
  }
  
  // Breakdown by provider
  if (data.byProvider && data.byProvider.length > 0) {
    lines.push('BY PROVIDER');
    lines.push('───────────────────────────────────────────────────');
    for (const row of data.byProvider) {
      lines.push(`${row.provider.padEnd(20)} ${row.call_count.toString().padStart(5)} calls    $${row.total_cost_usd}`);
    }
    lines.push('');
  }
  
  // Breakdown by model
  if (data.byModel && data.byModel.length > 0) {
    lines.push('BY MODEL');
    lines.push('───────────────────────────────────────────────────');
    for (const row of data.byModel.slice(0, 10)) {
      lines.push(`${row.model.padEnd(30)} ${row.call_count.toString().padStart(5)} calls    $${row.total_cost_usd}`);
    }
    lines.push('');
  }
  
  // Breakdown by task type
  if (data.byTask && data.byTask.length > 0) {
    lines.push('BY TASK TYPE');
    lines.push('───────────────────────────────────────────────────');
    for (const row of data.byTask) {
      const task = row.task_type || '(none)';
      lines.push(`${task.padEnd(20)} ${row.call_count.toString().padStart(5)} calls    $${row.total_cost_usd}`);
    }
    lines.push('');
  }
  
  lines.push('═══════════════════════════════════════════════════');
  
  return lines.join('\n');
}

/**
 * Generate report
 */
function generateReport(options) {
  const data = {
    summary: getSummary(options)
  };
  
  // Add breakdowns based on options
  if (options.breakdown === 'agent' || !options.breakdown) {
    data.byAgent = getBreakdown(options, 'agent');
  }
  
  if (options.breakdown === 'provider' || !options.breakdown) {
    data.byProvider = getBreakdown(options, 'provider');
  }
  
  if (options.breakdown === 'model' || !options.breakdown) {
    data.byModel = getBreakdown(options, 'model');
  }
  
  if (options.breakdown === 'task' || !options.breakdown) {
    data.byTask = getBreakdown(options, 'task_type');
  }
  
  if (options.topAgents) {
    data.topAgents = getTopAgents(options);
  }
  
  if (options.topModels) {
    data.topModels = getTopModels(options);
  }
  
  return data;
}

/**
 * CLI entry point
 */
function main() {
  const options = parseArgs();
  
  // Show help if no options
  if (process.argv.length === 2) {
    console.log('Usage: node report.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  --today              Report for today only');
    console.log('  --from YYYY-MM-DD    Start date');
    console.log('  --to YYYY-MM-DD      End date');
    console.log('  --last <period>      Last N days (e.g., 7d, 30d)');
    console.log('  --agent <name>       Filter by agent');
    console.log('  --model <name>       Filter by model');
    console.log('  --provider <name>    Filter by provider');
    console.log('  --task <type>        Filter by task type');
    console.log('  --breakdown <dim>    Breakdown by dimension (agent, provider, model, task)');
    console.log('  --top-agents         Show top agents by cost');
    console.log('  --top-models         Show top models by cost');
    console.log('  --json               Output JSON format');
    console.log('');
    console.log('Examples:');
    console.log('  node report.js --today');
    console.log('  node report.js --last 7d');
    console.log('  node report.js --agent marcus --last 30d');
    console.log('  node report.js --breakdown provider --last 7d');
    process.exit(0);
  }
  
  const data = generateReport(options);
  
  if (options.json) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(formatReport(data));
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  generateReport,
  getSummary,
  getBreakdown,
  getTopAgents,
  getTopModels
};
