# System Prompt Governance & Data Classification

**Version:** 1.0  
**Status:** Production Ready  
**Built:** 2026-02-26  
**Author:** Brunel (subagent) for Marcus Rawlins

---

## Overview

Strict governance system for agent system prompts to:
1. **Prevent data leaks** - Personal info never escapes to group chats
2. **Maintain token efficiency** - Auto-loaded files stay lean
3. **Enforce file structure** - Single responsibility per file
4. **Classify data** - Clear tiers with automatic enforcement

---

## Quick Start

### Run Audit

```bash
node audit.js /Users/marcusrawlins/.openclaw/workspace
```

### Test Redaction

```bash
node outbound-redact.js
```

### Test Context Gate

```bash
node context-gate.js
```

---

## Architecture

```
prompt-governance/
├── audit.js              # Governance audit (CLI)
├── outbound-redact.js    # Outbound message redaction (module)
├── context-gate.js       # Context-aware file loading (module)
├── config.json           # Classification rules, file scopes
├── SKILL.md              # Integration guide for agents
└── README.md             # This file
```

---

## File Structure Rules

### Auto-Loaded (Every Request)
- **AGENTS.md** - Operational rules (~50 lines)
- **SOUL.md** - Personality only (~30 lines)
- **IDENTITY.md** - Name/emoji (~5 lines)
- **USER.md** - Work contact info (~15 lines)
- **TOOLS.md** - IDs/paths only (~20 lines)

### Conditionally Loaded
- **MEMORY.md** - Private/DM only (contains personal context)
- **HEARTBEAT.md** - Heartbeat polls only
- **memory/YYYY-MM-DD.md** - Private only

---

## Data Classification

### Tier 1: Confidential (Private Only)
Financial figures, personal emails/phone, CRM data, API keys

### Tier 2: Internal (Groups OK)
Strategic notes, work emails, system health, architecture

### Tier 3: Restricted (External with Approval)
Public content, general knowledge, shareable docs

**Default:** Everything is Internal unless classified otherwise.

---

## Integration

### Context Gate
Determines which files to load based on chat type:

```javascript
const gate = new ContextGate();
const files = gate.getLoadableFiles(context);
// MEMORY.md only in private/DM contexts
```

### Outbound Redaction
Strips sensitive data from messages before sending:

```javascript
const redactor = new OutboundRedactor(context);
const safeMsg = redactor.redact(message);
// Personal emails → [personal_email]
// Dollar amounts → [amount] (in public contexts)
```

### Audit Script
Checks workspace files for violations:

```bash
node audit.js
# Returns: duplication, scope violations, budget overages
```

---

## Testing Results

### Audit
✓ Detects duplication across files  
✓ Flags scope violations (personality in AGENTS.md)  
✓ Warns on token budget overages  
✓ Catches personal data in USER.md

### Redaction
✓ Catches personal emails (gmail, yahoo, etc.)  
✓ Passes work emails (bythereeses.com, getrehive.com)  
✓ Redacts dollar amounts in non-private contexts  
✓ Always redacts API keys/tokens

### Context Gate
✓ Loads MEMORY.md in private/DM  
✓ Blocks MEMORY.md in group chats  
✓ Loads HEARTBEAT.md only on heartbeat polls

---

## Configuration

Edit `config.json` to customize:
- Primary user ID
- File scope rules
- Data classification tiers
- Redaction patterns
- Token budgets

---

## Maintenance

**Weekly:** Run `audit.js` to detect drift  
**On file changes:** Run audit before committing  
**On new agents:** Apply same structure and audit  
**On leaks:** Check redaction rules, update patterns

---

## Exit Codes

- `0` - All checks passed
- `1` - Errors found (classification violations)

---

## Documentation

- **SKILL.md** - Integration guide for agents
- **config.json** - All configuration
- **specs/system-prompt-governance.md** - Full specification

---

## Support

Questions? Check the full spec or ask Marcus.

Built for OpenClaw agent deployment.
