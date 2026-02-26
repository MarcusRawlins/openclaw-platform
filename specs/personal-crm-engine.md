# Personal CRM Engine
## Specification v1.0

**Author:** Marcus Rawlins (Opus)
**Date:** 2026-02-26
**Priority:** HIGH
**Location:** `/workspace/skills/crm-engine/`

---

## 1. Overview

Standalone, headless CRM engine. SQLite database, CLI interface, agent-queryable. Extracts contacts from email and calendar, scores relationships, generates nudges, supports natural language queries. Designed to be consumed by Mission Control (UI), AnselAI (photography CRM), R3 Studios, and Marcus via Telegram.

**Not a web app.** This is infrastructure. UIs plug into it.

## 2. Architecture

```
┌──────────────────────────────────────────────────────┐
│                    crm-engine/                         │
├──────────────────────────────────────────────────────┤
│  discovery.js        Contact extraction from email    │
│  contacts.js         CRUD + merge + dedup             │
│  interactions.js     Log meetings, emails, calls      │
│  follow-ups.js       Due dates, snoozing, reminders   │
│  scorer.js           Relationship scoring (0-100)     │
│  nudges.js           Attention-needed generator       │
│  profiler.js         Relationship type/style/topics   │
│  query.js            Natural language intent engine    │
│  drafts.js           Email draft generation           │
│  sync.js             Daily cron orchestrator          │
│  db.js               SQLite schema + migrations       │
│  config.json         Settings, skip patterns, flags   │
└──────────────────────────────────────────────────────┘
```

### Integration Points

```
Email Pipeline ──reads──▶ CRM Engine ◀──reads── AnselAI
                              │
Himalaya CLI ──feeds──▶ Discovery    Mission Control
                              │              │
Google Calendar ──feeds──▶ Discovery    R3 Studios
                              │
Marcus (Telegram) ◀──queries──▶ Query Engine
```

## 3. Database (`db.js`)

SQLite, WAL mode. Path: `/Volumes/reeseai-memory/data/crm-engine/crm.db`

```sql
PRAGMA journal_mode=WAL;

CREATE TABLE contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT,
  email TEXT UNIQUE,
  phone TEXT,
  company TEXT,
  role TEXT,
  source TEXT,                          -- email_scan, calendar, manual, email_pipeline
  source_id TEXT,                       -- reference to email_pipeline email_id if applicable
  priority TEXT DEFAULT 'normal',       -- low, normal, high, vip
  relationship_score INTEGER DEFAULT 0, -- 0-100
  relationship_type TEXT,               -- client, vendor, friend, colleague, lead, other
  communication_style TEXT,             -- formal, casual, mixed
  key_topics TEXT,                      -- JSON array of topics discussed
  auto_added BOOLEAN DEFAULT 0,        -- 1 if added by discovery, 0 if manual/approved
  approved BOOLEAN DEFAULT 1,          -- 0 if pending approval
  skip_pattern BOOLEAN DEFAULT 0,      -- 1 if user rejected this contact
  notes TEXT,
  metadata TEXT,                        -- JSON blob for extensibility
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER NOT NULL,
  type TEXT NOT NULL,                   -- email_sent, email_received, meeting, call, note
  subject TEXT,
  summary TEXT,
  source TEXT,                          -- himalaya, calendar, manual, email_pipeline
  source_id TEXT,                       -- message_id, event_id, etc.
  direction TEXT,                       -- inbound, outbound, bilateral
  occurred_at TEXT NOT NULL,
  logged_at TEXT DEFAULT (datetime('now')),
  metadata TEXT,                        -- JSON blob
  FOREIGN KEY (contact_id) REFERENCES contacts(id)
);

CREATE TABLE follow_ups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER NOT NULL,
  description TEXT NOT NULL,
  due_date TEXT NOT NULL,
  status TEXT DEFAULT 'pending',        -- pending, snoozed, done, cancelled
  snoozed_until TEXT,
  priority TEXT DEFAULT 'normal',       -- low, normal, high, urgent
  created_by TEXT DEFAULT 'system',     -- system, manual, nudge
  completed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (contact_id) REFERENCES contacts(id)
);

CREATE TABLE contact_context (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER NOT NULL,
  content TEXT NOT NULL,                -- raw text of the context entry
  context_type TEXT,                    -- email_excerpt, meeting_note, calendar_event, manual
  embedding BLOB,                       -- 768-dim float32 vector (3072 bytes)
  occurred_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (contact_id) REFERENCES contacts(id)
);

CREATE TABLE contact_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER NOT NULL UNIQUE,
  summary TEXT NOT NULL,                -- LLM-generated relationship summary
  key_facts TEXT,                       -- JSON array of key facts
  last_interaction TEXT,                -- date of most recent interaction
  interaction_count INTEGER DEFAULT 0,
  generated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (contact_id) REFERENCES contacts(id)
);

CREATE TABLE company_news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company TEXT NOT NULL,
  headline TEXT NOT NULL,
  url TEXT,
  summary TEXT,
  relevance_score FLOAT,               -- 0-1, how relevant to our relationship
  published_at TEXT,
  discovered_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE discovery_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  name TEXT,
  domain TEXT,
  decision TEXT NOT NULL,               -- approved, rejected, pending
  decided_at TEXT DEFAULT (datetime('now')),
  auto_decision BOOLEAN DEFAULT 0       -- 1 if auto-mode made the decision
);

CREATE TABLE skip_patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern TEXT NOT NULL UNIQUE,         -- domain, email prefix, or regex
  pattern_type TEXT NOT NULL,           -- domain, email, regex
  reason TEXT,
  learned_from INTEGER DEFAULT 0,       -- count of rejections that created this
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_company ON contacts(company);
CREATE INDEX idx_contacts_score ON contacts(relationship_score);
CREATE INDEX idx_contacts_priority ON contacts(priority);
CREATE INDEX idx_interactions_contact ON interactions(contact_id);
CREATE INDEX idx_interactions_date ON interactions(occurred_at);
CREATE INDEX idx_interactions_type ON interactions(type);
CREATE INDEX idx_follow_ups_contact ON follow_ups(contact_id);
CREATE INDEX idx_follow_ups_due ON follow_ups(due_date);
CREATE INDEX idx_follow_ups_status ON follow_ups(status);
CREATE INDEX idx_context_contact ON contact_context(contact_id);
CREATE INDEX idx_company_news_company ON company_news(company);
CREATE INDEX idx_discovery_email ON discovery_decisions(email);
CREATE INDEX idx_skip_pattern ON skip_patterns(pattern);
```

## 4. Contact Discovery (`discovery.js`)

### Sources

1. **Email pipeline database** — Read scored emails from `/Volumes/reeseai-memory/data/email-pipeline/pipeline.db`. Extract contacts from leads and meaningful correspondence. Skip spam/newsletter/automated.

2. **Himalaya inbox scan** — Scan both configured accounts for contacts not yet in the email pipeline (older emails, non-lead correspondence).

3. **Google Calendar** (future) — Extract attendees from meetings. Requires Google Calendar API integration.

### Filter Rules

Skip automatically:
- `noreply@`, `no-reply@`, `donotreply@` addresses
- Newsletter senders (detected by email pipeline classification or by List-Unsubscribe header)
- Large meetings (>10 attendees)
- Domains in skip_patterns table
- Emails matching skip_patterns

### Learning System

```javascript
// Track approve/reject decisions in discovery_decisions table
// After 50+ decisions, calculate approval rate per domain
// If domain approval rate > 90%, suggest auto-add for that domain
// If domain rejection rate > 80%, add to skip_patterns automatically

function shouldAutoAdd(email) {
  const domain = email.split('@')[1];
  const decisions = db.prepare(`
    SELECT decision, COUNT(*) as count 
    FROM discovery_decisions 
    WHERE domain = ? 
    GROUP BY decision
  `).all(domain);
  
  const total = decisions.reduce((s, d) => s + d.count, 0);
  if (total < 5) return { auto: false, reason: 'insufficient_data' };
  
  const approved = decisions.find(d => d.decision === 'approved')?.count || 0;
  if (approved / total > 0.9) return { auto: true, reason: 'high_approval_domain' };
  
  return { auto: false, reason: 'mixed_history' };
}
```

### Auto-Add Mode

Disabled by default. Config flag: `discovery.auto_add_enabled`.
After ~50 total decisions, the system suggests enabling auto-add via Telegram.
When enabled, contacts from high-approval domains are added automatically.
New/unknown domains still require approval.

### Deduplication

On every new contact:
1. Exact email match → merge (update name/company if richer)
2. Fuzzy name + same company → flag for review
3. Same person, different email → suggest merge

## 5. Relationship Scoring (`scorer.js`)

Score 0-100 based on weighted factors:

```javascript
function calculateScore(contact, interactions) {
  const weights = {
    recency: 0.30,     // how recently we interacted
    frequency: 0.25,   // how often we interact
    priority: 0.20,    // manual priority setting
    depth: 0.15,       // length/richness of interactions
    reciprocity: 0.10  // balance of inbound vs outbound
  };
  
  // Recency: days since last interaction, exponential decay
  // 0 days = 100, 7 days = 80, 30 days = 50, 90 days = 20, 180+ days = 5
  const daysSince = daysSinceLastInteraction(interactions);
  const recency = Math.max(5, 100 * Math.exp(-0.015 * daysSince));
  
  // Frequency: interactions per month over last 6 months
  const monthlyRate = interactionsPerMonth(interactions, 180);
  const frequency = Math.min(100, monthlyRate * 20); // 5+/month = 100
  
  // Priority: manual override
  const priorityMap = { vip: 100, high: 80, normal: 50, low: 20 };
  const priority = priorityMap[contact.priority] || 50;
  
  // Depth: average interaction length/richness
  const depth = averageInteractionDepth(interactions);
  
  // Reciprocity: ratio of outbound to total (50/50 = perfect)
  const reciprocity = reciprocityScore(interactions);
  
  return Math.round(
    recency * weights.recency +
    frequency * weights.frequency +
    priority * weights.priority +
    depth * weights.depth +
    reciprocity * weights.reciprocity
  );
}
```

Scores recalculated daily during the sync cron.

## 6. Nudge Generator (`nudges.js`)

Generates follow-up suggestions for contacts needing attention:

```javascript
const NUDGE_RULES = [
  {
    name: 'dormant_high_value',
    condition: (c) => c.relationship_score < 40 && c.priority === 'vip',
    message: 'VIP contact {name} hasn\'t heard from you in a while. Score dropped to {score}.',
    priority: 'high',
    suggest_action: 'Send a quick check-in email'
  },
  {
    name: 'overdue_follow_up',
    condition: (c, followUps) => followUps.some(f => f.status === 'pending' && isPast(f.due_date)),
    message: 'Overdue follow-up with {name}: {description}',
    priority: 'urgent'
  },
  {
    name: 'relationship_decay',
    condition: (c) => c.relationship_score < c.previous_score - 20,
    message: '{name} relationship score dropped {delta} points. Last contact: {last_interaction}.',
    priority: 'normal',
    suggest_action: 'Reach out to maintain the relationship'
  },
  {
    name: 'new_contact_stale',
    condition: (c, _, interactions) => interactions.length <= 1 && daysSince(c.created_at) > 7,
    message: 'New contact {name} added {days} days ago with only 1 interaction.',
    priority: 'normal',
    suggest_action: 'Follow up to build the relationship'
  }
];
```

## 7. Relationship Profiler (`profiler.js`)

LLM-generated profiles updated weekly or on significant new interactions:

```javascript
async function generateProfile(contact, interactions, contexts) {
  const prompt = `Analyze this contact's relationship history and generate a profile.

Contact: ${contact.first_name} ${contact.last_name} (${contact.company || 'no company'})
${interactions.length} interactions over ${daySpan} days.

Recent interactions:
${recentInteractions.map(i => `- ${i.occurred_at}: ${i.type} — ${i.summary}`).join('\n')}

Return JSON:
{
  "relationship_type": "client|vendor|friend|colleague|lead|other",
  "communication_style": "formal|casual|mixed",
  "key_topics": ["topic1", "topic2"],
  "summary": "2-3 sentence relationship summary",
  "key_facts": ["fact1", "fact2"],
  "suggested_approach": "How to best communicate with this person"
}`;

  return await callLlm({ model: config.profiler_model, prompt });
}
```

## 8. Natural Language Query Engine (`query.js`)

### Intent Detection

```javascript
const INTENTS = [
  {
    pattern: /(?:tell me about|who is|what do (?:we|i) know about)\s+(.+)/i,
    type: 'contact_lookup',
    extract: (m) => ({ name: m[1] })
  },
  {
    pattern: /(?:who (?:works )?at|people at|contacts at)\s+(.+)/i,
    type: 'company_lookup',
    extract: (m) => ({ company: m[1] })
  },
  {
    pattern: /follow up with\s+(.+?)(?:\s+in\s+(.+))?$/i,
    type: 'create_follow_up',
    extract: (m) => ({ name: m[1], timeframe: m[2] })
  },
  {
    pattern: /who needs (?:attention|follow.?up|a nudge)/i,
    type: 'nudge_report'
  },
  {
    pattern: /(?:crm )?stats|dashboard|overview/i,
    type: 'stats'
  },
  {
    pattern: /(?:add|create) contact\s+(.+)/i,
    type: 'add_contact',
    extract: (m) => ({ raw: m[1] })
  },
  {
    pattern: /(?:search|find)\s+(.+)/i,
    type: 'search',
    extract: (m) => ({ query: m[1] })
  }
];
```

### Semantic Search

For queries that don't match intent patterns, fall back to semantic search over `contact_context` embeddings using cosine similarity.

```javascript
async function semanticSearch(query, limit = 5) {
  const queryEmbedding = await getEmbedding(query);
  
  // SQLite doesn't have native vector ops, so load and compare in JS
  // For our scale (<10k contacts), this is fine
  const contexts = db.prepare(`
    SELECT cc.*, c.first_name, c.last_name, c.company
    FROM contact_context cc
    JOIN contacts c ON cc.contact_id = c.id
    WHERE cc.embedding IS NOT NULL
  `).all();
  
  const results = contexts.map(ctx => ({
    ...ctx,
    similarity: cosineSimilarity(queryEmbedding, new Float32Array(ctx.embedding))
  }));
  
  return results
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}
```

Embedding model: use LM Studio local embedding endpoint, or fall back to a small local model.

## 9. Email Draft System (`drafts.js`)

### Thread Lookup

```javascript
async function getThreadContext(contactEmail) {
  // Pull recent email thread from himalaya
  const emails = execFileSync('himalaya', [
    'envelope', 'list', '--account', 'marcus-work',
    '--folder', 'INBOX', '-o', 'json'
  ]);
  
  // Filter to this contact's threads
  // Also check CRM for interaction history and meeting context
  
  return { emailThread, crmContext, meetingNotes };
}
```

### Draft Generation

Two-phase approval:
1. **Proposed** — LLM generates draft, stored with status `proposed`
2. **Approved** — User reviews via Telegram/MC, approves or edits
3. **Created** — Draft pushed to email client via himalaya

```javascript
// Safety gate: must be explicitly enabled
if (!config.drafts.enabled) {
  throw new Error('Draft creation is disabled. Set drafts.enabled=true in config.json');
}
```

Uses the same two-layer safety pipeline as the email pipeline (writer + reviewer + content gate).

## 10. Daily Sync Cron (`sync.js`)

Runs daily at 7am ET (before Tyler's typical wake time):

```javascript
async function dailySync() {
  // 1. Scan last 24h of email activity
  const newEmails = await scanRecentEmails(24);
  
  // 2. Extract new contacts from emails
  const newContacts = await discovery.extractContacts(newEmails);
  
  // 3. Log interactions for existing contacts
  await interactions.logFromEmails(newEmails);
  
  // 4. Update relationship scores for all active contacts
  await scorer.recalculateAll();
  
  // 5. Generate nudges
  const nudges = await nudges.generate();
  
  // 6. Update relationship summaries (for contacts with new interactions)
  await profiler.updateStale();
  
  // 7. Report results
  return {
    new_contacts: newContacts.length,
    interactions_logged: interactionCount,
    nudges_generated: nudges.length,
    scores_updated: scoreCount
  };
}
```

## 11. Configuration (`config.json`)

```json
{
  "database": {
    "path": "/Volumes/reeseai-memory/data/crm-engine/crm.db"
  },
  "discovery": {
    "auto_add_enabled": false,
    "auto_add_threshold": 50,
    "scan_accounts": ["marcus-work", "marcus-personal"],
    "skip_domains": ["noreply.github.com", "notifications.google.com"],
    "max_meeting_attendees": 10
  },
  "scoring": {
    "model": "lmstudio/gemma-3-12b-it",
    "recalculate_interval_hours": 24
  },
  "profiler": {
    "model": "lmstudio/gemma-3-12b-it",
    "update_interval_days": 7
  },
  "nudges": {
    "dormant_threshold_days": 30,
    "score_decay_alert": 20
  },
  "drafts": {
    "enabled": false,
    "writer_model": "lmstudio/gemma-3-12b-it",
    "reviewer_model": "lmstudio/qwen/qwen3-4b-2507"
  },
  "embeddings": {
    "model": "lmstudio/nomic-embed-text-v1.5",
    "dimensions": 768
  },
  "escalation": {
    "telegram_chat_id": "8172900205"
  },
  "email_pipeline": {
    "database_path": "/Volumes/reeseai-memory/data/email-pipeline/pipeline.db"
  }
}
```

## 12. CLI Interface

```bash
# Query
node query.js "tell me about Tyler Reese"
node query.js "who at The Knot?"
node query.js "who needs attention?"
node query.js "stats"

# Contacts
node contacts.js --add --name "Jane Smith" --email "jane@example.com" --company "Acme"
node contacts.js --list --sort score --limit 20
node contacts.js --search "photographer"
node contacts.js --merge 12 15

# Follow-ups
node follow-ups.js --list --overdue
node follow-ups.js --add --contact 12 --description "Send proposal" --due 2026-03-15
node follow-ups.js --snooze 5 --until 2026-03-01
node follow-ups.js --done 5

# Discovery
node discovery.js --scan --last 24h
node discovery.js --pending          # show contacts awaiting approval
node discovery.js --approve 12
node discovery.js --reject 12
node discovery.js --patterns         # show learned skip patterns

# Scoring
node scorer.js --recalculate
node scorer.js --report              # top 20 + bottom 20

# Sync
node sync.js --run                   # full daily sync
node sync.js --dry-run               # preview what would happen

# Drafts
node drafts.js --for 12              # generate draft for contact 12
node drafts.js --pending             # list drafts awaiting approval
node drafts.js --approve 3           # approve draft, push to email client
```

## 13. Integration API

For Mission Control, AnselAI, and R3 Studios to consume:

```javascript
// crm-engine/api.js — importable module, not HTTP
module.exports = {
  // Contacts
  getContact(id),
  getContactByEmail(email),
  searchContacts(query),
  listContacts({ sort, limit, filter }),
  addContact(data),
  updateContact(id, data),
  mergeContacts(id1, id2),
  
  // Interactions
  getInteractions(contactId, { limit, since }),
  logInteraction(contactId, data),
  
  // Follow-ups
  getFollowUps({ status, contactId }),
  createFollowUp(contactId, data),
  updateFollowUp(id, data),
  
  // Scoring & Intelligence
  getScore(contactId),
  getNudges(),
  getProfile(contactId),
  getSummary(contactId),
  
  // Discovery
  getPendingContacts(),
  approveContact(discoveryId),
  rejectContact(discoveryId),
  
  // Query
  query(naturalLanguageString),
  semanticSearch(query, limit),
  
  // Stats
  getStats(),
  
  // Drafts
  generateDraft(contactId),
  getPendingDrafts(),
  approveDraft(draftId),
};
```

## 14. File Structure

```
/workspace/skills/crm-engine/
├── db.js               # Database schema + migrations
├── api.js              # Importable module API
├── discovery.js        # Contact extraction + learning system
├── contacts.js         # CRUD + merge + dedup
├── interactions.js     # Interaction logging
├── follow-ups.js       # Due dates, snoozing
├── scorer.js           # Relationship scoring
├── nudges.js           # Attention-needed generator
├── profiler.js         # LLM relationship profiles
├── query.js            # Natural language intent engine
├── drafts.js           # Email draft generation
├── sync.js             # Daily cron orchestrator
├── config.json         # All configuration
├── SKILL.md            # Agent integration guide
├── README.md           # Overview and usage
├── package.json        # Dependencies
└── verify.js           # Automated tests
```

## 15. Dependencies

- `better-sqlite3` (database)
- `himalaya` CLI (email backend)
- LM Studio (local models for scoring, profiling, drafting, embeddings)
- LLM Router skill (for model calls)
- Logger skill (for structured logging)
- Email Pipeline skill (reads its database for lead data)

## 16. Security

- No PII in logs (names OK, emails OK, phone numbers redacted)
- Draft content gate (same as email pipeline)
- Skip patterns never expose why a contact was rejected
- Embedding vectors are not reversible to source text
- Database on encrypted volume (reeseai-memory)

## 17. Testing Checklist

- [ ] Database initializes with all tables and indexes
- [ ] Contact CRUD operations work
- [ ] Deduplication detects exact email matches
- [ ] Discovery filters out noreply/newsletter senders
- [ ] Skip patterns learned from rejections
- [ ] Relationship scorer produces 0-100 for various scenarios
- [ ] Nudge rules trigger correctly
- [ ] Intent detection matches all query types
- [ ] Follow-up snoozing works
- [ ] Draft generation respects safety gate (disabled by default)
- [ ] Content gate catches secrets/paths/amounts in drafts
- [ ] Sync cron orchestrates all steps without errors
- [ ] API module exports all documented functions
