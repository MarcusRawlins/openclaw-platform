# Business Intelligence Council — Integration Guide

## What's Built (Phase 1 ✓)

**Data Sync Layer:**
- ✓ 5 SQLite databases (team-chat, tasks, crm, social, finance)
- ✓ sync-mission-control.js — Reads from MC tasks.json (working, 69 tasks synced)
- ✓ sync-crm.js — Stub ready for AnselAI integration
- ✓ sync-social.js — Stub ready for social API integration
- ✓ import-financial.js — Ready to pull from financial-tracking skill
- ✓ sync-all.js orchestrator

**Expert Analysis:**
- ✓ ExpertAnalyzer framework (uses Opus via gateway, falls back to local LLM)
- ✓ 6 expert configurations (Scout, Ada, Ed, Dewey, Brunel, Walt)
- ✓ Parallel execution engine
- ✓ Council history database (tracks all sessions/analyses/recommendations)

**Synthesis & Delivery:**
- ✓ Synthesis layer (Marcus/Sonnet)
- ✓ Digest formatter (markdown)
- ✓ Full CLI (explore, accept/reject, history, status)
- ✓ Feedback loop infrastructure

## Next Tasks (Phase 2 & Beyond)

### 1. AnselAI Integration (Medium Priority)

**Task:** Complete sync-crm.js with AnselAI API calls

File: `sync-crm.js` lines 44-55 (currently stubbed)

```javascript
async sync() {
  // TODO: Implement these calls:
  const inquiries = await fetch(`${ANSELAI_URL}/api/inquiries`);
  const bookings = await fetch(`${ANSELAI_URL}/api/bookings`);
  
  // Then upsert into database
}
```

**Prerequisites:**
- AnselAI running on port 3200
- API endpoints documented
- Authentication method (if any)

**Data to Sync:**
- Inquiries: first_name, last_name, email, phone, event_date, event_type, source, status
- Bookings: inquiry_id, event_date, package_price, deposit_paid, balance_due, status

### 2. Social Analytics Integration (Medium Priority)

**Task:** Complete sync-social.js with Meta/TikTok/YouTube APIs

File: `sync-social.js` lines 44-60 (currently stubbed)

**Platforms to Support:**

**Meta (Instagram/Facebook):**
- Endpoint: Graph API v19.0
- Scope: `instagram_business_account`, `pages_read_engagement`, `instagram_manage_insights`
- Data: follower count, engagement rate, post metrics, reach, impressions

**TikTok:**
- Endpoint: TikTok API v1
- Scope: `user.info.basic`, `video.list`, `video.query`
- Data: follower count, video performance, engagement

**YouTube:**
- Endpoint: YouTube Data API v3
- Scope: `youtube.readonly`, `yt-analytics.readonly`
- Data: subscriber count, video metrics, engagement

**Implementation:**
```javascript
// For each platform, fetch metrics and upsert to social.db
const metricsRes = await fetch(`${META_API}/me/insights?metric=impressions,reach`);
const metrics = await metricsRes.json();

// Store in platform_metrics table
db.prepare(`INSERT INTO platform_metrics (...) VALUES (...)`).run(...);
```

### 3. Financial Data Integration (Low Priority)

**Task:** Connect import-financial.js to actual financial APIs or QuickBooks

File: `import-financial.js` already reads from financial-tracking skill if it exists.

**Options:**
1. Manual CSV import (`importRevenue()` method already implemented)
2. QuickBooks API integration
3. Stripe/payment processor integration

**Current State:**
- ✓ Database schema ready
- ✓ Monthly summary calculations ready
- ✓ YTD revenue calculation ready

### 4. Telegram Delivery Integration (Low Priority)

**Task:** In run-council.js, add Telegram posting after digest generation

File: `run-council.js` line 62 (comment: "// Post to Telegram")

```javascript
// After digest is formatted:
await postToTelegram(digest);

async function postToTelegram(digest) {
  // Use OpenClaw message API or Telegram bot API
  await fetch('http://localhost:18789/api/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'send',
      channel: 'telegram',
      text: digest,
      threadTarget: 'marcus:main'  // or specific chat ID
    })
  });
}
```

### 5. Cron Integration (Low Priority)

**Task:** Register cron jobs in OpenClaw gateway

Current: Documented in README, ready to configure

Jobs needed:
- `0 22 * * * run-council.js` — Nightly at 10 PM EST
- `0 */3 * * * sync-all.js` — Every 3 hours (data sync)

### 6. Expert Tuning (Lowest Priority)

**Task:** Track acceptance rates and adjust expert weights over time

This is optional. As recommendation feedback accumulates:
- Calculate which experts are most often accepted
- Rank their recommendations higher in future syntheses
- Drop low-acceptance-rate experts from analysis

Implementation: Use `acceptance_rate` in expert configs, adjust in synthesis prompt.

## Testing Checklist

### Phase 1 (Completed)
- [x] Sync layer reads MC tasks (69 synced ✓)
- [x] Expert analysis framework works (with fallback)
- [x] Council DB initializes
- [x] CLI commands functional
- [x] Digest formatter generates output

### Phase 2 (When APIs Connected)
- [ ] sync-crm.js fetches from AnselAI
- [ ] sync-social.js fetches from Meta/TikTok/YouTube
- [ ] Financial data imports correctly
- [ ] Full council run: sync → experts → synthesis → digest
- [ ] Digest posts to Telegram
- [ ] CLI explore shows real data

### Phase 3 (When Production-Ready)
- [ ] Cron jobs run automatically
- [ ] No manual intervention needed
- [ ] Tyler receives nightly digests in Telegram
- [ ] Feedback loop working (accept/reject)
- [ ] Council history trending correctly

## Quick Reference

### Adding a New Expert

Edit `experts.js`:

```javascript
const newExpert = new ExpertAnalyzer({
  name: 'ExpertName',
  role: 'Role Title',
  focus: 'What they focus on',
  dataSource: async () => {
    // Get relevant data from databases
    const db = new SomeSync();
    const data = db.getMetrics();
    db.close();
    return data;
  },
  questions: [
    'Question 1?',
    'Question 2?'
  ]
});

module.exports = {
  // ... existing experts
  newExpert
};
```

Then add to expert list in `run-experts.js`.

### Adding a New Data Source

Create `sync-something.js`:

```javascript
class SomethingSync {
  constructor() {
    this.db = new Database(SOMETHING_DB);
    this.initSchema();
  }

  initSchema() {
    this.db.exec(`CREATE TABLE IF NOT EXISTS ...`);
  }

  sync() {
    // Fetch data, upsert to DB
    console.log('✓ Synced X records');
    return count;
  }

  close() {
    this.db.close();
  }
}

module.exports = SomethingSync;
```

Then add to `sync-all.js` orchestrator.

## File Organization

```
/Users/marcusrawlins/.openclaw/workspace/skills/bi-council/
├── Data Sync Layer
│   ├── sync-all.js (orchestrator)
│   ├── sync-mission-control.js ✓
│   ├── sync-crm.js (needs API)
│   ├── sync-social.js (needs APIs)
│   ├── import-financial.js (ready)
│   └── init-council-db.js
│
├── Expert Analysis
│   ├── expert-framework.js ✓
│   ├── experts.js ✓
│   └── run-experts.js ✓
│
├── Synthesis & Delivery
│   ├── synthesize.js ✓
│   ├── format-digest.js ✓
│   └── run-council.js (main orchestrator) ✓
│
├── CLI & Feedback
│   ├── council-cli.js ✓
│   └── (npm alias: council)
│
└── Documentation
    ├── SKILL.md ✓
    ├── README.md ✓
    ├── INTEGRATION-GUIDE.md (this file)
    └── package.json
```

## Dependencies

All required packages already in `package.json`:
- `better-sqlite3` — Database
- `node-fetch` — Fallback for older Node versions

Nothing additional needed for Phase 1.

For Phase 2+ integrations:
- Meta/TikTok/YouTube APIs — Use built-in `fetch`
- QuickBooks SDK — Optional, if using QB integration

## Support

Questions? Check:
1. **Spec:** `/workspace/specs/business-intelligence-council.md`
2. **Files:** Read docstrings in relevant `.js` file
3. **Logs:** `run-council.js` output shows detailed progress
4. **Database:** `sqlite3 /Volumes/reeseai-memory/data/bi-council/*.db .tables` to inspect

## Success Criteria

Phase 1 Complete (Today): ✓
- Data sync working (MC tasks synced)
- Expert analysis framework operational
- Council DB initialized & tested
- CLI functional

Phase 2 Target: When AnselAI + social APIs connected
- Full data syncing from all sources
- Expert analyses with real data
- Nightly digests with actionable recommendations
- Telegram delivery working

Production Ready: When all integrations complete + cron jobs configured
- Automated nightly runs at 10 PM EST
- Tyler receives digests without manual intervention
- Feedback loop active (accept/reject tracking)
