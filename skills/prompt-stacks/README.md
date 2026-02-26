# Dual Prompt Stacks

**Maintain Claude and GPT-optimized prompt stacks with synchronized operational facts.**

## Quick Start

### Run Sync Review

```bash
node sync-review.js
```

Checks for discrepancies between claude/ and gpt/ prompt stacks.

### Swap Agent to Different Model

```bash
node swap.js --model openai/gpt-4-turbo --agent marcus
```

Automatically selects the correct prompt stack based on provider.

### Test with Canary

```bash
node canary.js --agent marcus
```

Verifies the correct provider is responding (catches silent auth failures).

### Generate Facts Sections

```bash
node generate.js
```

Shows what operational facts sections look like in both Claude and GPT styles.

## What's This For?

Different LLM families work better with different prompt styles:

- **Claude:** Natural language, conversational, minimal structure
- **GPT/Gemini:** XML tags, ALL-CAPS emphasis, explicit formatting

This skill maintains parallel stacks optimized for each style while ensuring operational facts (channel IDs, paths, model assignments) stay in sync.

## File Structure

```
/workspace/prompts/
├── claude/AGENTS.md          # Claude-optimized
├── gpt/AGENTS.md             # GPT-optimized  
└── shared/facts.json         # Single source of truth

/workspace/skills/prompt-stacks/
├── sync-review.js            # Nightly sync check
├── swap.js                   # Model swap procedure
├── canary.js                 # Provider verification test
├── generate.js               # Template generator
├── config.json               # Configuration
├── SKILL.md                  # Full documentation
└── README.md                 # This file
```

## Key Principle

**Operational facts must be identical across both stacks.**

Style differences are intentional (natural language vs XML), but facts like channel IDs, service URLs, and model assignments must match exactly.

## Integration

Add this to cron for nightly sync checks:

```json
{
  "name": "prompt-stack-sync-review",
  "schedule": { "kind": "cron", "expr": "0 2 * * *", "tz": "America/New_York" },
  "payload": { 
    "kind": "agentTurn", 
    "message": "node /workspace/skills/prompt-stacks/sync-review.js" 
  }
}
```

## Examples

### Successful Sync

```bash
$ node sync-review.js
✓ Both prompt stacks are in sync
```

### Discrepancies Found

```bash
$ node sync-review.js
Found 2 discrepancies:

  ✗ [missing_file] USER.md exists in claude/ but not in gpt/
  ⚠ [missing_fact] Fact "channels.telegram_chat_id" (8172900205) not found in gpt/ stack
```

### Successful Canary

```bash
$ node canary.js --agent marcus

🐤 Running canary test for agent: marcus...
   Model: anthropic/claude-sonnet-4-5
   Expected provider: anthropic

Response: {"provider":"anthropic","model":"claude-sonnet-4-5","status":"ok"}
Provider: anthropic
Model: anthropic/claude-sonnet-4-5
Cost: $0.000015
Duration: 847ms

✓ Canary test passed
```

### Provider Mismatch (Fallback Detected)

```bash
$ node canary.js --agent walt

🐤 Running canary test for agent: walt...
   Model: openai/gpt-4-turbo
   Expected provider: openai

Response: {"provider":"lmstudio","model":"qwen-2.5","status":"ok"}
Provider: lmstudio
Model: lmstudio/qwen-2.5
Cost: $0.000000
Duration: 234ms

✗ MISMATCH: Expected openai, got lmstudio
  This likely means auth failed and fallback kicked in.
```

## See Also

- `SKILL.md` - Full documentation
- `/workspace/prompts/shared/facts.json` - Operational facts database
- `/workspace/skills/llm-router/` - LLM routing and provider detection

---

**Version:** 1.0.0  
**Created:** 2026-02-26  
**Author:** Marcus Rawlins (Opus)
