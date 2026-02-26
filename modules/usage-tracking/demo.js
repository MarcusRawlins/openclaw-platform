#!/usr/bin/env node

const UsageLogger = require('./logger');

/**
 * Demo script - Log sample usage from different agents/models
 */

console.log('Logging sample usage from various agents...\n');

const logger = UsageLogger.getInstance();

// Marcus using Claude Opus for chat
logger.logLLM({
  agent: 'marcus',
  provider: 'anthropic',
  model: 'claude-opus-4-6',
  taskType: 'chat',
  taskDescription: 'Planning new feature development',
  prompt: 'What should I build next for OpenClaw? I want to improve the agent memory system.',
  response: 'Based on your requirements, I recommend building a semantic search layer for agent memories...',
  inputTokens: 5000,
  outputTokens: 2000,
  cacheReadTokens: 30000,
  cacheWriteTokens: 0,
  durationMs: 3200,
  sessionKey: 'session-marcus-001'
});

// Brunel using Devstral for build
logger.logLLM({
  agent: 'brunel',
  provider: 'lmstudio',
  model: 'devstral-small-2-2512',
  taskType: 'build',
  taskDescription: 'Building usage tracking system',
  prompt: 'Build the LLM Usage & Cost Tracking system from this spec...',
  response: 'I will build all the files according to the spec...',
  inputTokens: 15000,
  outputTokens: 8000,
  durationMs: 12000,
  sessionKey: 'session-brunel-001'
});

// Walt using GPT-4 Turbo for review
logger.logLLM({
  agent: 'walt',
  provider: 'openai',
  model: 'gpt-4-turbo',
  taskType: 'review',
  taskDescription: 'Weekly performance review',
  prompt: 'Review the weekly performance of all agents...',
  response: 'Agent Performance Review - Week of Feb 20-26...',
  inputTokens: 12000,
  outputTokens: 8000,
  durationMs: 15000,
  sessionKey: 'session-walt-001'
});

// Scout using local Gemma for research
logger.logLLM({
  agent: 'scout',
  provider: 'lmstudio',
  model: 'gemma-3-12b',
  taskType: 'synthesis',
  taskDescription: 'Researching AI market trends',
  prompt: 'What are the latest trends in the AI agent market?',
  response: 'Current trends include: Multi-agent collaboration, RAG systems, local LLMs...',
  inputTokens: 2000,
  outputTokens: 4000,
  durationMs: 3500,
  sessionKey: 'session-scout-001'
});

// Heartbeat using qwen3
logger.logLLM({
  agent: 'marcus',
  provider: 'lmstudio',
  model: 'qwen3:4b',
  taskType: 'heartbeat',
  taskDescription: 'Checking email and calendar',
  prompt: 'Check my email inbox and calendar for today...',
  response: 'Email: 3 unread. Calendar: 2 events today.',
  inputTokens: 800,
  outputTokens: 50,
  durationMs: 1200,
  sessionKey: 'heartbeat-001'
});

// API calls from Scout
logger.logAPI({
  agent: 'scout',
  service: 'serpapi',
  endpoint: '/search',
  method: 'GET',
  statusCode: 200,
  durationMs: 890,
  requestSizeBytes: 256,
  responseSizeBytes: 15000,
  estimatedCostUsd: 0.005
});

logger.logAPI({
  agent: 'scout',
  service: 'web_fetch',
  endpoint: 'https://example.com/article',
  method: 'GET',
  statusCode: 200,
  durationMs: 650,
  requestSizeBytes: 128,
  responseSizeBytes: 45000
});

// Error case
logger.logLLM({
  agent: 'ed',
  provider: 'openai',
  model: 'gpt-4o',
  taskType: 'chat',
  taskDescription: 'Drafting client email',
  prompt: 'Draft an outreach email for a new photography client...',
  response: '',
  inputTokens: 1500,
  outputTokens: 0,
  durationMs: 2000,
  status: 'error',
  errorMessage: 'Rate limit exceeded',
  sessionKey: 'session-ed-001'
});

console.log('Sample data logged. Flushing to database...\n');

// Flush immediately
logger.flush().then(() => {
  console.log('✅ Flush complete!\n');
  console.log('Try these commands:');
  console.log('  npm run dashboard');
  console.log('  npm run report -- --today');
  console.log('  npm run report -- --agent marcus');
  console.log('  npm run report -- --breakdown provider');
  console.log('');
  
  db.close();
  process.exit(0);
});

const db = require('./db');
