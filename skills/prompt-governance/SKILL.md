# System Prompt Governance & Data Classification

**Purpose:** Enforce strict file structure, prevent data leaks, and maintain token efficiency across agent system prompts.

**Version:** 1.0  
**Author:** Marcus Rawlins (Opus) + Brunel

---

## What This Skill Does

1. **Governance Auditing** - Checks workspace files for duplication, scope violations, and token bloat
2. **Context-Aware File Loading** - Prevents MEMORY.md from loading in group chats
3. **Outbound Redaction** - Strips PII/financials from non-private contexts automatically
4. **Data Classification** - Formal tiers (Confidential, Internal, Restricted) with enforcement

---

## File Structure Rules

### Auto-Loaded Files (Cost tokens on EVERY turn)
- **AGENTS.md** (~50 lines) - Rules of engagement, operational policy
- **SOUL.md** (~30 lines) - Personality and communication style ONLY
- **IDENTITY.md** (~5 lines) - Name, emoji, avatar
- **USER.md** (~15 lines) - Work contact info ONLY (no personal details)
- **TOOLS.md** (~20 lines) - Channel IDs, paths, env var names (not documentation)

### Conditionally Loaded
- **MEMORY.md** - ONLY in private/DM with primary user. Contains personal context, architecture decisions, learned patterns.
- **HEARTBEAT.md** - ONLY on heartbeat polls. Health check checklist.
- **memory/YYYY-MM-DD.md** - ONLY in private contexts.

---

## Using the Tools

### 1. Run Governance Audit

```bash
node /Users/marcusrawlins/.openclaw/workspace/skills/prompt-governance/audit.js [workspace_path]
```

**Checks:**
- Duplication across files
- File scope violations (e.g., personality in AGENTS.md)
- Token budget overages
- Data classification issues (personal info in USER.md)

**Exit codes:**
- `0` = All checks passed
- `1` = Errors found (classification violations)

---

### 2. Context Gate (Programmatic)

```javascript
const ContextGate = require('./context-gate.js');

const gate = new ContextGate();

// Get files to load for this context
const context = {
  chat_type: 'group',  // or 'direct', 'channel'
  sender_id: 'marcus',
  is_heartbeat: false
};

const filesToLoad = gate.getLoadableFiles(context);
// Returns: ['AGENTS.md', 'SOUL.md', 'IDENTITY.md', 'USER.md', 'TOOLS.md']
// MEMORY.md NOT included in group contexts!

// Check specific file
const shouldLoad = gate.shouldLoadFile('MEMORY.md', context);
// Returns: false (group context)
```

---

### 3. Outbound Redaction (Programmatic)

```javascript
const OutboundRedactor = require('./outbound-redact.js');

const context = { is_private: false };  // Group chat
const redactor = new OutboundRedactor(context);

const message = 'Contact me at jtyler.reese@gmail.com. Revenue is $50,000.';
const safe = redactor.redact(message);
// Returns: 'Contact me at [personal_email]. Revenue is [amount].'

// Work emails pass through
const workMsg = 'Email hello@bythereeses.com for inquiries.';
const safework = redactor.redact(workMsg);
// Returns: 'Email hello@bythereeses.com for inquiries.' (unchanged)
```

---

## Data Classification Tiers

### Tier 1: Confidential (Private/DM Only)
- Financial figures, revenue, costs, deal values, dollar amounts
- Personal email addresses (gmail, yahoo, hotmail, etc.)
- Phone numbers, SSN, personal addresses
- CRM contact details
- MEMORY.md contents
- API keys, credentials

**Enforcement:** Never load in group chats. Redact in outbound if context is public.

### Tier 2: Internal (Group Chats OK)
- Strategic notes and analysis
- System health and performance data
- Work email addresses (company domains)
- Project status
- Architecture decisions

**Enforcement:** OK in agent group chats. No external sharing without approval.

### Tier 3: Restricted (External with Approval)
- Public-facing content (blog posts, social captions)
- General knowledge responses
- Documentation meant for sharing

**Enforcement:** External sharing requires user to say "share this" or equivalent.

---

## Integration with OpenClaw Gateway

### Boot Sequence Integration

```javascript
// In agent message handler or boot sequence
const ContextGate = require('./skills/prompt-governance/context-gate.js');
const gate = new ContextGate();

function loadSystemPrompt(chatContext) {
  const filesToLoad = gate.getLoadableFiles(chatContext);
  
  let prompt = '';
  for (const file of filesToLoad) {
    const filePath = path.join(workspaceDir, file);
    if (fs.existsSync(filePath)) {
      prompt += fs.readFileSync(filePath, 'utf8') + '\n\n';
    }
  }
  
  return prompt;
}
```

### Outbound Message Filter

```javascript
// Before sending message to user
const OutboundRedactor = require('./skills/prompt-governance/outbound-redact.js');

function sendMessage(message, chatContext) {
  const redactor = new OutboundRedactor(chatContext);
  const safeMessage = redactor.redact(message);
  
  // Send safeMessage instead of raw message
  telegram.sendMessage(chatContext.chat_id, safeMessage);
}
```

---

## Governance Checklist

Before deploying changes to agent system prompts:

- [ ] Run `audit.js` to check for duplication and scope violations
- [ ] Verify MEMORY.md contains no operational rules (those go in AGENTS.md)
- [ ] Verify USER.md contains no personal contact info (move to MEMORY.md)
- [ ] Verify TOOLS.md contains no tool documentation (only IDs/paths)
- [ ] Check total token budget for auto-loaded files (<2000 tokens target)
- [ ] Test context gate: MEMORY.md loads in DM, not in groups
- [ ] Test redaction: personal emails redacted in public, work emails pass
- [ ] Update AGENTS.md with any new data classification rules

---

## Maintenance

**Weekly:** Run audit on workspace files to detect drift.

**When adding new files:** Update `config.json` with file scope rules.

**When onboarding new agents:** Apply same file structure and run audit.

**When user reports data leak:** Check if outbound redaction rules need tuning.

---

## Configuration

All rules are defined in `config.json`:
- Primary user ID
- File scope rules (always / private_only / heartbeat_only)
- Data classification tiers
- Redaction patterns
- Token budgets

Edit this file to customize for your deployment.

---

## Testing

Each module has built-in test mode:

```bash
# Test audit
node audit.js /path/to/workspace

# Test context gate
node context-gate.js

# Test outbound redaction
node outbound-redact.js
```

---

## Questions?

See full specification: `/workspace/specs/system-prompt-governance.md`

Built by Brunel (subagent) for Marcus's OpenClaw deployment.
