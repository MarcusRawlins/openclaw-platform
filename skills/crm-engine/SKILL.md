# CRM Engine Skill Guide

**For agents integrating with the CRM Engine**

## Overview

The CRM Engine is a headless contact management system. It tracks relationships, scores interactions, and generates follow-up suggestions. Use it to answer questions about contacts, log interactions, and manage follow-ups.

## When to Use

- User asks about a specific contact ("tell me about Jane")
- User asks who works at a company
- User wants to know who needs attention
- User wants CRM stats or overview
- User wants to create a follow-up reminder
- User wants to search contacts

## Integration

```javascript
const crm = require('/Users/marcusrawlins/.openclaw/workspace/skills/crm-engine/api');

// Natural language query (simplest)
const result = crm.query('who needs attention?');
console.log(result.message);

// Or use specific functions
const contact = crm.getContactByEmail('jane@example.com');
const stats = crm.getStats();
const nudges = crm.getNudges();
```

## Common Queries

### "Who needs attention?"

```javascript
const nudges = crm.getNudges();
// Returns array of contacts with nudge messages
```

### "Tell me about [name]"

```javascript
const result = crm.query('tell me about Jane Doe');
// Returns contact + profile + interaction summary
```

### "Who works at [company]?"

```javascript
const result = crm.query('who works at Acme?');
// Returns list of contacts at that company
```

### "Follow up with [name] in [timeframe]"

```javascript
const result = crm.query('follow up with Jane in 3 days');
// Creates follow-up reminder
```

### "CRM stats"

```javascript
const stats = crm.getStats();
// Returns total contacts, avg score, pending follow-ups, etc.
```

## Direct API Usage

### Get Contact

```javascript
const contact = crm.getContact(12);
const byEmail = crm.getContactByEmail('jane@example.com');
```

### Search Contacts

```javascript
const results = crm.searchContacts('photographer');
// Searches name, email, company, notes
```

### List Contacts

```javascript
const top20 = crm.listContacts({ sort: 'score', limit: 20 });
const recent = crm.listContacts({ sort: 'recent' });
```

### Get Contact Summary

```javascript
const summary = crm.getSummary(12);
// Returns: contact, profile, recent interactions, stats, follow-ups
```

### Log Interaction

```javascript
crm.logInteraction(12, {
  type: 'email_sent',
  subject: 'Re: Project update',
  summary: 'Sent project status update',
  direction: 'outbound',
  occurred_at: new Date().toISOString()
});
```

### Create Follow-up

```javascript
crm.createFollowUp(12, {
  description: 'Send proposal',
  due_date: '2026-03-15',
  priority: 'high'
});
```

### Get Nudges

```javascript
const nudges = crm.getNudges();
// Returns contacts needing attention

const byPriority = crm.getNudgesByPriority();
// Returns { urgent: [], high: [], normal: [] }
```

### Get Stats

```javascript
const stats = crm.getStats();
// {
//   total_contacts: 150,
//   average_score: 62,
//   recent_interactions: 45,
//   pending_follow_ups: 8,
//   overdue_follow_ups: 2,
//   by_priority: [...]
// }
```

## Natural Language Query Engine

The `query()` function handles intent detection automatically:

```javascript
const result = crm.query('who needs attention?');
const result = crm.query('tell me about Jane Doe');
const result = crm.query('who at The Knot?');
const result = crm.query('follow up with Tyler in 3 days');
const result = crm.query('stats');
```

Returns object with:
- `type`: Intent type
- `message`: Formatted response
- `...`: Intent-specific data

## Scoring System

Contacts are scored 0-100 based on:

- **Recency** (30%): Days since last interaction
- **Frequency** (25%): Interactions per month
- **Priority** (20%): Manual priority setting
- **Depth** (15%): Richness of interactions
- **Reciprocity** (10%): Balance of inbound/outbound

Scores are recalculated daily during sync.

## Nudge Rules

The engine generates nudges when:

1. **Dormant high-value**: VIP/high priority contact, score < 40
2. **Overdue follow-up**: Follow-up past due date
3. **Long silence**: 30+ days since last contact (configurable)
4. **New contact stale**: New contact, 7+ days, only 1 interaction

## Email Draft System

⚠️ **Disabled by default** - Set `drafts.enabled = true` in config.json

```javascript
const draft = await crm.generateDraft(12, { 
  purpose: 'Follow up on project' 
});
// Two-phase approval: writer + reviewer
```

## Daily Sync

Run daily at 7am ET:

```javascript
const results = await crm.dailySync(false);
// {
//   new_contacts: 5,
//   interactions_logged: 23,
//   scores_updated: 150,
//   nudges_generated: 8,
//   profiles_updated: 3
// }
```

## Discovery & Approval

When auto-add is disabled (default), new contacts are pending:

```javascript
const pending = crm.getPendingContacts();
crm.approveContact(12);
crm.rejectContact(13);
```

After ~50 decisions, the system learns which domains to auto-add.

## Error Handling

All API functions return `{ error: '...' }` on failure:

```javascript
const contact = crm.getContact(999);
if (contact.error) {
  console.error(contact.error);
}
```

## Logging

All operations log to the logger skill:

- `crm.contact_added`
- `crm.interaction_logged`
- `crm.contact_scored`
- `crm.nudges_generated`
- etc.

## Response Formatting

For Telegram/user-facing responses, use the `message` field from query results:

```javascript
const result = crm.query('who needs attention?');
// result.message is already formatted for display
```

## Tips

- Use `query()` for user-facing questions (simplest)
- Use direct API for programmatic access
- Always check for `error` field in responses
- Nudges are regenerated on every call (not cached)
- Scores are only recalculated during daily sync (unless manual)
- Profiles are updated weekly (or manually via `generateProfile()`)

## Example: Morning Briefing

```javascript
const stats = crm.getStats();
const nudges = crm.getNudgesByPriority();

console.log(`📊 CRM: ${stats.total_contacts} contacts, avg score ${stats.average_score}`);

if (nudges.urgent.length > 0) {
  console.log(`🚨 ${nudges.urgent.length} urgent follow-ups needed`);
  nudges.urgent.forEach(n => console.log(`   • ${n.message}`));
}

if (stats.overdue_follow_ups > 0) {
  console.log(`⏰ ${stats.overdue_follow_ups} overdue follow-ups`);
}
```

## Example: Contact Lookup

```javascript
const result = crm.query('tell me about Tyler Reese');

if (result.found) {
  console.log(result.message);
  // Formatted output with contact details, summary, recent interactions
} else {
  console.log('Contact not found');
}
```

## Example: Creating a Reminder

```javascript
const result = crm.query('follow up with Jane Doe in 3 days');

if (result.success) {
  console.log(result.message);
  // ✅ Follow-up created for Jane Doe on 2026-03-01
}
```

## Database Access

For custom queries:

```javascript
const db = crm.getDatabase();
const contacts = db.prepare(`
  SELECT * FROM contacts 
  WHERE company = ? 
  ORDER BY relationship_score DESC
`).all('Acme Inc');
```

## See Also

- `README.md` - Full documentation
- `api.js` - Complete API reference
- `/workspace/specs/personal-crm-engine.md` - Original spec
