# Trading Agent System Architecture

## Status: DESIGN PHASE (Not Started)

## Overview
AI-powered trading agent using OpenClaw's multi-agent architecture. Paper trading first, real trading only after proven track record.

## Architecture

### Agents
1. **Scout (Market Research):** Scans markets, news, social sentiment. Runs on local LLM.
2. **Analyst (new agent):** Technical analysis, pattern recognition. Runs on local LLM with reasoning (DeepSeek R1).
3. **Executor (new agent):** Places trades via broker API. Runs on local LLM. Requires strict guardrails.
4. **Auditor (Walt):** Reviews trade decisions, tracks performance. Existing agent.

### Data Pipeline
- Market data: Alpha Vantage or Yahoo Finance API (free tier)
- News: Brave Search API (already configured)
- Storage: SQLite on /Volumes/reeseai-memory/data/databases/trading.db

### Risk Management
- Paper trading only until 90-day track record
- Max position size: configurable
- Stop loss: mandatory on every trade
- Daily loss limit: hard stop
- No margin trading

### Cron Schedule
- Market scan: Every 15 min during market hours (9:30am-4pm EST)
- Analysis: After each scan
- Execution: Only during market hours
- Daily report: 4:30pm EST
- Weekly review: Sunday 6pm

## Phase 1 (Paper Trading)
1. Set up paper trading account (Alpaca or similar, free API)
2. Build market data ingestion
3. Build basic technical analysis (RSI, MACD, moving averages)
4. Paper trade for 90 days
5. Track performance

## Phase 2 (Live Trading) - Only if Phase 1 profitable
- Real broker integration
- Real money, small positions
- Tyler approves every architectural change

## Dependencies
- Broker API key (Alpaca recommended, free paper trading)
- Market data API
- Tyler's approval before any real money touches this

## Assignment
Marcus designs. Brunel builds Phase 1. Walt audits.
