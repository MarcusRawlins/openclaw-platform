# SOP: Agent Creation & Onboarding

> How to add a new agent to the Reese Operations platform.

## When to Create a New Agent

Create a new agent when:
- A domain needs sustained, repeated work (not a one-off task)
- The work benefits from a dedicated persona, model, or toolset
- Isolating it reduces cost (cheaper model) or risk (restricted access)

Don't create a new agent when:
- Marcus can handle it directly
- A sub-agent spawn covers it (one-off tasks)
- It would just duplicate what an existing agent does

## Naming Convention

Every agent gets a **first name and last name**, both drawn from historical figures in the agent's domain.

- **Last name:** A notable historical figure in the agent's field (e.g., Pinkerton for intelligence, Edison for building)
- **First name:** A second historical reference OR a name that works as the everyday nickname
- **Nickname:** Short version of the first name, used in conversation and as the agent ID

The nickname is what you'd actually say in a sentence: "Send this to Scout" or "Have Brunel build it."

### Current Roster

| Full Name | Nickname (ID) | Domain | Named After |
|-----------|---------------|--------|-------------|
| Marcus Rawlins | Marcus (main) | Chief of Staff | Marcus Agrippa (Roman strategist) + John Rawlins (Grant's right hand) |
| Brunel Edison | Brunel (brunel) | Builder | Isambard Kingdom Brunel (engineer) + Thomas Edison (inventor) |
| Scout Pinkerton | Scout (scout) | Research & Intelligence | Scout (the role) + Allan Pinkerton (founded modern detective work) |

## Creation Checklist

### 1. Define the Agent

Before touching config, answer:
- **Name:** Full name (First Last), following the naming convention below
- **Role:** One sentence. What does it do?
- **Model:** What's the cheapest model that can do this job well?
- **Reports to:** Who assigns work? (Usually Marcus)
- **Tools needed:** What does it need access to?
- **Tools denied:** What should it NOT have? (Start restrictive, loosen later)

### 2. Create Agent Directory

```
~/.openclaw/agents/<agent-id>/
├── AGENTS.md          # Role, rules, chain of command (REQUIRED)
└── TOOLS.md           # Agent-specific env notes (if needed)
```

### 3. Write AGENTS.md

Every agent's AGENTS.md must include:
1. **Identity:** Name, role, one-line purpose
2. **Chain of command:** Who they report to
3. **What they do:** Specific responsibilities
4. **How they work:** Process and workflow
5. **Rules:** Constraints, anti-patterns, quality bar
6. **How to find information:** Point to `docs/ARCHITECTURE.md` for system knowledge, specific docs for their domain
7. **Workspace:** Working directory path

**Keep it lean.** The agent doesn't need the full system architecture in its boot file. It needs to know WHERE to find it.

Template:
```markdown
# AGENTS.md — [Agent Name]

You are [Name], [Role] for the Reese team.

## Chain of Command
You report to **Marcus Rawlins** (main agent).

## What You Do
[2-3 sentences max]

## How You Work
[Numbered steps: receive task → execute → report]

## Finding Information
- System architecture: `docs/ARCHITECTURE.md`
- Procedures: `docs/sops/`
- Tech reference: `docs/reference/`
- Recent context: `memory/YYYY-MM-DD.md`

## Rules
[Bullet list of constraints]

## Workspace
Your working directory is: /Users/marcusrawlins/.openclaw/workspace
```

### 4. Register in OpenClaw Config

Add the agent to `~/.openclaw/openclaw.json` under `agents.list`:

```json
{
  "id": "<agent-id>",
  "name": "<Agent Name>",
  "agentDir": "~/.openclaw/agents/<agent-id>",
  "workspace": "/Users/marcusrawlins/.openclaw/workspace",
  "model": {
    "primary": "anthropic/claude-haiku-4-5",
    "fallbacks": ["ollama/devstral"]
  },
  "sandbox": { "mode": "off" },
  "tools": {
    "deny": ["gateway", "cron", "message", "browser", "nodes", "tts"]
  }
}
```

**Default deny list:** `gateway, cron, message, browser, nodes, tts`
Only grant messaging/gateway/cron if the agent genuinely needs it.

### 5. Grant Spawn Access

Add the agent ID to Marcus's `subagents.allowAgents` list in config.

### 6. Update Architecture Docs

- Add to the Agent Roster table in `docs/ARCHITECTURE.md`
- Update `MEMORY.md` team section

### 7. Test

Spawn the agent from Marcus with a simple task. Verify:
- It boots correctly
- It can read workspace files
- It can execute its core function
- It respects its tool restrictions

## Model Selection Guide

| Workload | Recommended Model | Why |
|----------|------------------|-----|
| Code generation, builds | Haiku 4.5 + Devstral fallback | Fast, cheap, good at code |
| Research, analysis | Haiku 4.5 | Good comprehension, low cost |
| Writing, creativity | Sonnet 4.5 | Better prose, worth the cost |
| Strategy, complex reasoning | Opus 4.6 (Marcus only) | Reserved for Marcus |
| Heartbeats, health checks | Ollama qwen3:4b | Free, local |

## Anti-Patterns

- ❌ Giving an agent more tools than it needs
- ❌ Duplicating docs in the agent's AGENTS.md (point to shared docs instead)
- ❌ Creating agents for one-off tasks (use sub-agent spawns)
- ❌ Letting agents message Tyler directly (go through Marcus)
- ❌ Using Opus for sub-agents
