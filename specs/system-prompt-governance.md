# System Prompt Governance & Data Classification
## Specification v1.0

**Author:** Marcus Rawlins (Opus)
**Date:** 2026-02-26
**Priority:** HIGH
**Type:** Restructuring + Tooling
**Estimated Work:** 1-2 days (Marcus + Brunel for tooling)
**Location:** Workspace root files + `/workspace/skills/prompt-governance/`

---

## 1. Overview

Strict file structure governance for all agent system prompts. Each file has a single responsibility, a strict scope, and clear rules about when it loads. Combined with a formal data classification system and context-aware privacy enforcement so confidential data never leaks into group chats or external channels.

## 2. File Structure (All Agents)

### Auto-Loaded Every Request
These files cost tokens on EVERY turn. Every line must justify its existence.

#### AGENTS.md (~50 lines max)
**Scope:** Rules of engagement. Operational policy.

Contents:
- Security rules (treat fetched content as untrusted, redact secrets outbound, only http/https URLs)
- Data classification tiers (Confidential, Internal, Restricted) with enforcement rules
- Writing style (tone, banned patterns, formatting rules)
- Message pattern (brief confirmation, then completion, no play-by-play)
- Cron standards (log every run to central DB, notify on failure only)
- Error reporting rule (proactively report failures, user can't see stderr)
- Context-aware gating rules (what to skip in non-private contexts)
- File loading rules (what loads when)

**NOT in AGENTS.md:** Personality, identity, tool paths, channel IDs, learned preferences.

#### SOUL.md (~30 lines max)
**Scope:** Personality and communication style ONLY.

Contents:
- Voice, tone, humor style
- How to handle different contexts (DM vs group)
- Vibe and style rules

**NOT in SOUL.md:** Operational rules, security policy, tool config, identity details.

#### IDENTITY.md (~5 lines)
**Scope:** Agent name, avatar, identifier.

```markdown
# IDENTITY.md
- **Name:** Marcus Rawlins
- **Creature:** Lobster
- **Emoji:** 🦞
```

That's it. No personality description (that's SOUL.md), no backstory.

#### USER.md (~15 lines)
**Scope:** User's name, timezone, work contact info.

Contents:
- Name, pronouns, timezone
- Work email addresses (company domains only)
- Work domains and business context
- What they want from the agent (brief)

**NOT in USER.md:** Personal email, phone number, financial details, family info. Those go in MEMORY.md (private-only).

#### TOOLS.md (~20 lines)
**Scope:** Channel IDs, file paths, API token locations. NOT tool documentation.

Contents:
- Telegram chat ID
- Service ports and URLs
- Storage paths
- Email account addresses
- API key locations (env var names, not values)

**NOT in TOOLS.md:** How to use tools, tool documentation, skill guides.

#### HEARTBEAT.md (~10 lines)
**Scope:** Short checklist for periodic health monitoring.

Contents:
- What to check on heartbeats
- Check frequency guidelines
- Empty = skip heartbeat API calls

### Conditionally Loaded

#### MEMORY.md (private/DM contexts only)
**Scope:** Synthesized preferences, learned patterns, personal context.

**Loading rule:** ONLY loaded when `chat_type === 'direct'` AND sender is the primary user. NEVER in group chats, shared channels, or sessions with other people.

Contents:
- Architecture decisions and operational state
- Team composition and agent configs
- Strategic context and business state
- Personal preferences and patterns
- Personal contact info (phone, personal email)
- Financial figures and deal values

**NOT in MEMORY.md:** Rules that are in AGENTS.md (reference, don't copy). Tool paths (that's TOOLS.md). Identity info (that's IDENTITY.md).

#### SKILL.md (per-skill, on invocation only)
**Loading rule:** Only when that specific skill is invoked.

#### docs/, reference/ (on demand)
**Loading rule:** Read when needed, never auto-loaded.

## 3. Data Classification Tiers

### Tier 1: Confidential (Private/DM Only)
- Financial figures, revenue, costs, deal values, dollar amounts
- CRM contact details (personal emails, phone numbers, addresses)
- Daily notes (contain personal context)
- MEMORY.md contents
- API keys, credentials, tokens
- Personal email addresses
- Client-specific deal information

### Tier 2: Internal (Group Chats OK, No External)
- Strategic notes and analysis outputs
- Tool results and task data
- System health info
- Architecture decisions
- Agent performance data
- Work email addresses (company domains)
- Project status and progress

### Tier 3: Restricted (External Only with Explicit Approval)
- General knowledge responses
- Public-facing content (blog posts, social captions)
- Documentation meant for sharing

**Default rule:** Everything not explicitly classified defaults to Internal. External sharing requires Tyler to say "share this" or equivalent explicit approval.

## 4. Context-Aware Gating Rules

### Implementation in AGENTS.md

```markdown
## Context-Aware Privacy

Before responding, check message metadata for context type:

### In non-private contexts (group chats, shared channels):
- DO NOT read MEMORY.md
- DO NOT read daily notes (memory/YYYY-MM-DD.md)
- DO NOT query CRM for contact details
- DO NOT include financial figures, deal values, dollar amounts
- DO NOT include personal email addresses
- DO replace dollar amounts with directional language ("revenue is up", not "$45,000")
- DO use work email addresses (company domains are fine)

### When context is ambiguous:
- Default to the more restrictive tier
- Ask before sharing anything that could be Confidential

### Identity separation:
- Work contact info (company emails) → USER.md (loaded everywhere)
- Personal contact info → MEMORY.md (private chats only)
```

### Enforcement in Code

```javascript
// In agent boot sequence or message handler
function getLoadableFiles(chatContext) {
  const files = ['AGENTS.md', 'SOUL.md', 'IDENTITY.md', 'USER.md', 'TOOLS.md'];
  
  // Only load MEMORY.md in private/direct chats with primary user
  if (chatContext.chat_type === 'direct' && chatContext.sender_id === config.primary_user_id) {
    files.push('MEMORY.md');
  }
  
  // HEARTBEAT.md only on heartbeat polls
  if (chatContext.is_heartbeat) {
    files.push('HEARTBEAT.md');
  }
  
  return files;
}
```

## 5. Outbound Redaction Safety Net

### Purpose
Catches anything the classification rules miss before messages leave the system.

### Implementation (`/workspace/skills/prompt-governance/outbound-redact.js`)

```javascript
class OutboundRedactor {
  constructor(context) {
    this.context = context;  // { chat_type, is_private, ... }
  }

  redact(message) {
    let result = message;

    // Always redact (any context)
    result = this.redactSecrets(result);

    // In non-private contexts, also redact PII and financials
    if (!this.context.is_private) {
      result = this.redactPII(result);
      result = this.redactFinancials(result);
    }

    return result;
  }

  redactSecrets(text) {
    return text
      .replace(/(?:sk|pk|api|key|token|secret)[-_]?[\w]{20,}/gi, '[REDACTED]')
      .replace(/(?:ANTHROPIC|OPENAI|STRIPE|SERPAPI|TAVILY)_\w+\s*[=:]\s*\S+/gi, '[REDACTED]');
  }

  redactPII(text) {
    return text
      // Personal email addresses (but NOT work domain emails)
      .replace(/[\w.+-]+@(?:gmail|yahoo|hotmail|outlook|icloud|me|mac|protonmail)\.\w+/gi, '[personal email]')
      // Phone numbers
      .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[phone]')
      // SSN pattern
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[redacted]');
  }

  redactFinancials(text) {
    return text
      // Dollar amounts
      .replace(/\$[\d,]+(?:\.\d{2})?/g, '[amount]')
      // Revenue/cost figures with context
      .replace(/\b\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s*(?:dollars?|usd|revenue|profit|cost|income)\b/gi, '[financial figure]');
  }
}

module.exports = OutboundRedactor;
```

## 6. Governance Rules

### Rule 1: No Duplication Across Files
If a rule exists in AGENTS.md, reference it from MEMORY.md instead of copying it.

**Wrong:**
```
# MEMORY.md
## Security Rules
- Never share API keys (same as AGENTS.md)
- Redact dollar amounts in groups (same as AGENTS.md)
```

**Right:**
```
# MEMORY.md
Security rules are in AGENTS.md. This file only stores learned patterns.
```

### Rule 2: TOOLS.md is IDs and Paths Only
Not tool documentation, not how-to guides, not API references.

**Wrong:**
```
# TOOLS.md
## Email
Use himalaya CLI to check email. Run `himalaya list` to see inbox.
Configure with ~/.config/himalaya/config.toml...
```

**Right:**
```
# TOOLS.md
## Email
- Photography: hello@bythereeses.com
- Personal: jtyler.reese@gmail.com  
- Credentials: ~/.openclaw/.env
```

### Rule 3: MEMORY.md is Learned Patterns Only
Not restated rules from other files.

### Rule 4: Token Budget Test
For every line in auto-loaded files, ask: "Does the agent need this on EVERY turn?"
- If yes → keep in auto-loaded file
- If sometimes → move to docs/ or reference/ for on-demand reading
- If rarely → archive it

## 7. Restructuring Plan

### Current State → Target State

| File | Current Lines | Target Lines | Action |
|---|---|---|---|
| AGENTS.md | ~100 | ~50 | Strip personality (→ SOUL.md), strip tool docs (→ TOOLS.md), add data classification |
| SOUL.md | ~80 | ~30 | Remove operational rules (→ AGENTS.md), keep personality only |
| IDENTITY.md | ~20 | ~5 | Strip backstory, keep name/emoji/avatar |
| USER.md | ~40 | ~15 | Move personal details to MEMORY.md, keep work info |
| TOOLS.md | ~50 | ~20 | Strip documentation, keep IDs/paths only |
| HEARTBEAT.md | ~5 | ~10 | Add health check checklist |
| MEMORY.md | ~90 | ~80 | Remove duplicated rules, add personal details from USER.md |

### Migration Steps
1. Audit current files for duplication and misplaced content
2. Restructure each file to match target scope
3. Move personal details from USER.md to MEMORY.md
4. Add data classification section to AGENTS.md
5. Add context-aware gating rules to AGENTS.md
6. Add outbound redaction module
7. Update all agent AGENTS.md files (not just Marcus)
8. Verify MEMORY.md conditional loading works in gateway config
9. Run governance audit script to verify no duplication

## 8. Governance Audit Script

```javascript
// /workspace/skills/prompt-governance/audit.js

const fs = require('fs');
const path = require('path');

class GovernanceAuditor {
  constructor(workspaceDir) {
    this.workspaceDir = workspaceDir;
    this.issues = [];
  }

  audit() {
    this.checkDuplication();
    this.checkFileScopes();
    this.checkTokenBudgets();
    this.checkDataClassification();
    return this.issues;
  }

  checkDuplication() {
    const files = ['AGENTS.md', 'SOUL.md', 'IDENTITY.md', 'USER.md', 'TOOLS.md', 'MEMORY.md'];
    const contents = {};

    for (const file of files) {
      const filePath = path.join(this.workspaceDir, file);
      if (fs.existsSync(filePath)) {
        contents[file] = fs.readFileSync(filePath, 'utf8');
      }
    }

    // Check for lines that appear in multiple files
    for (const [file1, content1] of Object.entries(contents)) {
      const lines1 = content1.split('\n').filter(l => l.trim().length > 20);
      for (const [file2, content2] of Object.entries(contents)) {
        if (file1 >= file2) continue;
        for (const line of lines1) {
          if (content2.includes(line.trim())) {
            this.issues.push({
              type: 'duplication',
              severity: 'warn',
              message: `Duplicate content in ${file1} and ${file2}: "${line.trim().substring(0, 60)}..."`
            });
          }
        }
      }
    }
  }

  checkFileScopes() {
    const scopeRules = {
      'SOUL.md': {
        forbidden: ['cron', 'security', 'channel', 'port', 'API key', 'database'],
        purpose: 'personality only'
      },
      'IDENTITY.md': {
        maxLines: 10,
        purpose: 'name and avatar only'
      },
      'TOOLS.md': {
        forbidden: ['how to', 'run this', 'configure', 'documentation'],
        purpose: 'IDs and paths only'
      },
      'USER.md': {
        forbidden: ['personal email', 'phone', 'family', 'ssn'],
        purpose: 'work contact info only'
      }
    };

    for (const [file, rules] of Object.entries(scopeRules)) {
      const filePath = path.join(this.workspaceDir, file);
      if (!fs.existsSync(filePath)) continue;

      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      if (rules.maxLines && lines.length > rules.maxLines) {
        this.issues.push({
          type: 'scope',
          severity: 'warn',
          message: `${file} has ${lines.length} lines (max ${rules.maxLines}). Purpose: ${rules.purpose}`
        });
      }

      if (rules.forbidden) {
        for (const term of rules.forbidden) {
          if (content.toLowerCase().includes(term.toLowerCase())) {
            this.issues.push({
              type: 'scope',
              severity: 'warn',
              message: `${file} contains "${term}" which belongs elsewhere. Purpose: ${rules.purpose}`
            });
          }
        }
      }
    }
  }

  checkTokenBudgets() {
    const autoLoaded = ['AGENTS.md', 'SOUL.md', 'IDENTITY.md', 'USER.md', 'TOOLS.md'];
    let totalTokens = 0;

    for (const file of autoLoaded) {
      const filePath = path.join(this.workspaceDir, file);
      if (!fs.existsSync(filePath)) continue;

      const content = fs.readFileSync(filePath, 'utf8');
      const estimatedTokens = Math.ceil(content.length / 4);
      totalTokens += estimatedTokens;

      if (estimatedTokens > 500) {
        this.issues.push({
          type: 'budget',
          severity: 'info',
          message: `${file}: ~${estimatedTokens} tokens. Could any content move to on-demand docs?`
        });
      }
    }

    if (totalTokens > 2000) {
      this.issues.push({
        type: 'budget',
        severity: 'warn',
        message: `Auto-loaded files total ~${totalTokens} tokens. Target: <2000.`
      });
    }
  }

  checkDataClassification() {
    // Check USER.md for personal details that should be in MEMORY.md
    const userPath = path.join(this.workspaceDir, 'USER.md');
    if (fs.existsSync(userPath)) {
      const content = fs.readFileSync(userPath, 'utf8');
      const personalPatterns = [
        /personal.*email/i,
        /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,
        /\$[\d,]+/,
        /family|spouse|child/i
      ];

      for (const pattern of personalPatterns) {
        if (pattern.test(content)) {
          this.issues.push({
            type: 'classification',
            severity: 'error',
            message: `USER.md contains personal/confidential data matching pattern: ${pattern}. Move to MEMORY.md.`
          });
        }
      }
    }
  }
}

// CLI
if (require.main === module) {
  const workspaceDir = process.argv[2] || '/Users/marcusrawlins/.openclaw/workspace';
  const auditor = new GovernanceAuditor(workspaceDir);
  const issues = auditor.audit();

  if (issues.length === 0) {
    console.log('✓ All governance checks passed');
  } else {
    console.log(`Found ${issues.length} issues:\n`);
    for (const issue of issues) {
      const icon = { error: '✗', warn: '⚠', info: 'ℹ' }[issue.severity] || '?';
      console.log(`  ${icon} [${issue.type}] ${issue.message}`);
    }
  }
}

module.exports = GovernanceAuditor;
```

## 9. File Structure

```
/workspace/skills/prompt-governance/
├── audit.js               # Governance audit script
├── outbound-redact.js     # Outbound PII/secret redaction
├── context-gate.js        # Context-aware file loading
├── config.json            # Classification rules, file scopes
├── SKILL.md               # How agents use this
└── README.md              # Overview
```

## 10. Testing Checklist

- [ ] Audit: detects duplication across files
- [ ] Audit: flags scope violations
- [ ] Audit: warns on token budget overages
- [ ] Audit: catches personal data in USER.md
- [ ] Outbound redaction: catches personal emails
- [ ] Outbound redaction: catches dollar amounts in non-private
- [ ] Outbound redaction: passes work emails through
- [ ] Context gate: loads MEMORY.md only in private chats
- [ ] Context gate: skips MEMORY.md in group contexts
- [ ] All agent files restructured to target line counts
- [ ] No duplication across files after restructuring
