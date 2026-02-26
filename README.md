# OpenClaw Platform

AI-powered business operations platform built on [OpenClaw](https://github.com/openclaw/openclaw). A multi-agent system for automating business intelligence, lead management, content operations, health tracking, and infrastructure monitoring.

## Architecture

Built as modular skills that plug into the OpenClaw agent framework. Each module is self-contained with its own database, configuration, CLI interface, and tests.

```
                    ┌─────────────────┐
                    │   OpenClaw       │
                    │   Gateway        │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
         ┌────┴────┐   ┌────┴────┐   ┌────┴────┐
         │ Agents  │   │  Cron   │   │  Chat   │
         │ Marcus  │   │  Jobs   │   │ Telegram│
         │ Brunel  │   │         │   │ Discord │
         │ Walt    │   │         │   │         │
         └────┬────┘   └────┬────┘   └─────────┘
              │              │
    ┌─────────┴──────────────┴─────────┐
    │         Module Layer              │
    ├───────────────────────────────────┤
    │ llm-router      │ logging        │
    │ usage-tracking   │ self-improvement│
    │ email-pipeline   │ health-pipeline │
    │ bi-council       │ daily-briefing  │
    │ knowledge-base   │ content-pipeline│
    │ financial-tracking│ notification-q │
    │ cron-automation  │ memory-system   │
    │ prompt-governance│ prompt-stacks   │
    └───────────────────────────────────┘
```

## Modules

### Foundation Layer
| Module | Description | Status |
|--------|-------------|--------|
| [llm-router](modules/llm-router/) | Unified LLM interface with auto-retry, caching, multi-provider support | ✅ Built |
| [logging](modules/logging/) | Structured event logging, JSONL + SQLite, viewer, rotation | ✅ Built |
| [usage-tracking](modules/usage-tracking/) | LLM cost tracking, dashboards, JSONL logs, 90-day archive | ✅ Built |

### Intelligence Layer
| Module | Description | Status |
|--------|-------------|--------|
| [bi-council](modules/bi-council/) | Nightly business intelligence with 6 expert personas | ✅ Built |
| [daily-briefing](modules/daily-briefing/) | 6 AM tactical briefing with 10 sections + action items | ✅ Built |
| [knowledge-base-rag](modules/knowledge-base-rag/) | Local RAG with sqlite-vec embeddings, hybrid search | ✅ Built |
| [content-pipeline](modules/content-pipeline/) | Content idea capture, dedup, KB search, social search | ✅ Built |

### Operations Layer
| Module | Description | Status |
|--------|-------------|--------|
| [email-pipeline](modules/email-pipeline/) | Inbound lead scoring, quarantine, draft generation | 📋 Specced |
| [financial-tracking](modules/financial-tracking/) | Business P&L, invoice tracking, confidentiality controls | ✅ Built |
| [notification-queue](modules/notification-queue/) | Priority-based notification routing | ✅ Built |
| [cron-automation](modules/cron-automation/) | Cron job management with LaunchD integration | ✅ Built |
| [memory-system](modules/memory-system/) | File-based agent memory with synthesis | ✅ Built |

### Quality & Security Layer
| Module | Description | Status |
|--------|-------------|--------|
| [self-improvement](modules/self-improvement/) | Review councils, tiered testing, error reporting | 🔨 Building |
| [prompt-governance](modules/prompt-governance/) | Data classification, outbound redaction, file governance | 📋 Specced |
| [prompt-stacks](modules/prompt-stacks/) | Dual Claude/GPT prompt stacks with sync review | 📋 Specced |

### Health & Wellness
| Module | Description | Status |
|--------|-------------|--------|
| [health-pipeline](modules/health-pipeline/) | Oura, Apple Health, Withings connectors + trend analysis | 📋 Specced |

## Tech Stack

- **Runtime:** Node.js 25
- **Database:** SQLite (better-sqlite3) + sqlite-vec for embeddings
- **LLM Providers:** Anthropic Claude, OpenAI GPT, Google Gemini, LM Studio (local)
- **Embeddings:** nomic-embed-text-v1.5 (local via LM Studio)
- **Framework:** [OpenClaw](https://github.com/openclaw/openclaw)
- **Messaging:** Telegram (primary), extensible to Discord/Slack

## Getting Started

### Prerequisites
- Node.js 25+
- [OpenClaw](https://github.com/openclaw/openclaw) installed and configured
- LM Studio (optional, for local models)
- better-sqlite3: `npm install better-sqlite3`

### Installation

```bash
git clone https://github.com/MarcusRawlins/openclaw-platform.git
cd openclaw-platform

# Install dependencies for all modules
for dir in modules/*/; do
  if [ -f "$dir/package.json" ]; then
    (cd "$dir" && npm install)
  fi
done
```

### Configuration

Each module has a `config.json` with sensible defaults. Key paths to configure:
- Data directory (default: `/Volumes/reeseai-memory/data/`)
- LM Studio URL (default: `http://127.0.0.1:1234`)
- API keys in `~/.openclaw/.env`

## Specs

Full specifications for all modules are in the [specs/](specs/) directory. Each spec includes architecture, database schemas, API interfaces, configuration, and testing checklists.

## License

MIT

## Built With

Built by Tyler Reese and Marcus Rawlins (AI Chief of Staff) using [OpenClaw](https://github.com/openclaw/openclaw).
