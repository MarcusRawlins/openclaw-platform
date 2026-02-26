# Daily Briefing System

**Status:** Production Ready  
**Owner:** Marcus (cron automation)  
**Dependencies:** LM Studio (local), sqlite3, tasks.json, content indexes  
**Cost:** $0 (local LLM, no API calls)  

## Overview

Automated daily briefing generated at **6:00 AM EST** covering content performance, social growth, active ideas, today's tasks, and AI-generated insights with **ACTION ITEMS**.

Briefing is delivered to Tyler via Telegram and archived for historical reference.

## Architecture

```
6:00 AM EST Daily Cron
         ↓
   daily-briefing-cron.js
         ↓
   generateDailyBriefing()
         ↓
   ┌─────────────────────────┐
   │  Data Collection        │
   ├─────────────────────────┤
   │ • Content metrics       │
   │ • Top content (90d)     │
   │ • Active ideas          │
   │ • Tasks (today)         │
   │ • Task statistics       │
   │ • Content status        │
   └─────────────────────────┘
         ↓
   LLM Summary Generation
   (qwen3:4b via LM Studio)
         ↓
   Format Briefing (markdown)
         ↓
   Archive + Send Telegram
```

## Modules

### 1. collect-content-metrics.js

Gathers content performance data from AnselAI database and content indexes.

**Functions:**
- `getContentPerformance()` — Content stats for last 7/30 days
- `getTopContent(limit)` — Top performing content (90-day rolling)
- `getSocialGrowth()` — Platform follower/post counts
- `getContentByStatus()` — Aggregate content status (draft/approved/published)

**Data Sources:**
- `/Volumes/reeseai-memory/data/databases/anselai.db` (content_catalog table)
- `/Volumes/reeseai-memory/photography/content/content-index.json`
- `/Volumes/reeseai-memory/r3-studios/content/content-index.json`

### 2. collect-ideas.js

Fetches active content ideas from content pipeline database.

**Functions:**
- `getActiveIdeas()` — Ideas in proposed/accepted/in_progress status
- `getIdeasByStatus()` — Count of ideas per status
- `getRecentIdeas(days)` — Ideas suggested in last N days

**Data Source:**
- `/Volumes/reeseai-memory/data/content-pipeline/ideas.db`

### 3. collect-tasks.js

Aggregates task data from Mission Control.

**Functions:**
- `getTodaysTasks()` — Urgent/high priority/standing orders for today
- `getTasksNeedingReview()` — Tasks in needs_review status
- `getCompletedToday()` — Tasks completed today
- `getTaskStats()` — Overall pipeline metrics

**Data Source:**
- `/Users/marcusrawlins/.openclaw/workspace/mission_control/data/tasks.json`

### 4. generate-summary.js

Generates intelligent insights using local LLM.

**Functions:**
- `generateBriefingSummary(data)` — Main summary with action items
- `generateDetailedAnalysis(data)` — Strategic analysis

**LLM Configuration:**
- Model: `qwen3:4b` (running in LM Studio)
- Endpoint: `http://127.0.0.1:1234/v1/chat/completions`
- Temperature: 0.7
- Max tokens: 1000

### 5. format-briefing.js

Formats data and summary into readable briefing with emojis.

**Functions:**
- `formatBriefing(data, summary, stats, ...)` — Main formatter
- `saveBriefing(briefing)` — Archive to disk
- `formatDate(date)` — Human-readable date

**Output Format:**
```
📊 Daily Briefing — Monday, February 26, 2026

[Sections with data + action items]

📊 System Status
[Task/content/idea counts]
```

### 6. briefing-generator.js

Main orchestrator that coordinates all modules.

**Function:**
- `generateDailyBriefing()` — Collects, summarizes, formats, archives

**Returns:**
```javascript
{
  briefing: "📊 Daily Briefing...",
  savedPath: "/Volumes/reeseai-memory/briefings/2026-02-26-briefing.md",
  timestamp: "2026-02-26T06:00:00Z",
  stats: {
    content_items: 12,
    active_ideas: 5,
    tasks_today: 8
  }
}
```

## Usage

### Manual Trigger

```bash
# Generate and display briefing
node /Users/marcusrawlins/.openclaw/workspace/skills/daily-briefing/briefing-generator.js

# With logging
node /Users/marcusrawlins/.openclaw/workspace/skills/daily-briefing/briefing-generator.js 2>&1 | tee /tmp/briefing.log
```

### Cron Execution (6:00 AM EST)

```bash
# Dry run (see what would be sent)
node /Users/marcusrawlins/.openclaw/workspace/agents/main/daily-briefing-cron.js --dry-run

# Production (sends to Telegram)
node /Users/marcusrawlins/.openclaw/workspace/agents/main/daily-briefing-cron.js
```

### Cron Configuration

Add to launchd or cron:

```
0 6 * * * /usr/bin/env node /Users/marcusrawlins/.openclaw/workspace/agents/main/daily-briefing-cron.js >> /Volumes/reeseai-memory/briefings/logs/cron.log 2>&1
```

Or via OpenClaw gateway:

```json
{
  "schedule": { "kind": "cron", "expr": "0 6 * * *", "tz": "America/New_York" },
  "payload": { 
    "kind": "agentTurn", 
    "message": "Generate and send daily briefing"
  },
  "sessionTarget": "isolated"
}
```

## Data Sources

### AnselAI Database

**File:** `/Volumes/reeseai-memory/data/databases/anselai.db`

**Tables:**
- `content` — All content (not yet populated by analytics)
- `content_catalog` — Daily performance snapshots (empty until analytics sync)

**Schema:**
```sql
CREATE TABLE content_catalog (
  id INTEGER PRIMARY KEY,
  content_id INTEGER REFERENCES content(id),
  platform VARCHAR(50),
  title VARCHAR(500),
  business VARCHAR(50),
  published_at DATE,
  snapshot_date DATE,
  views INTEGER,
  likes INTEGER,
  comments INTEGER,
  shares INTEGER,
  engagement_rate DECIMAL
);
```

### Content Indexes

**Photography:** `/Volumes/reeseai-memory/photography/content/content-index.json`

**R3 Studios:** `/Volumes/reeseai-memory/r3-studios/content/content-index.json`

**Format:**
```json
{
  "id": "2026-02-26-instagram-title",
  "title": "Post Title",
  "platform": "instagram|tiktok|facebook|twitter|blog",
  "business": "anselai|r3studios",
  "status": "draft|approved|published",
  "createdDate": "2026-02-26",
  "publishedDate": null,
  "performance": {
    "views": 0,
    "likes": 0,
    "comments": 0,
    "shares": 0
  }
}
```

### Content Ideas Database

**File:** `/Volumes/reeseai-memory/data/content-pipeline/ideas.db`

**Table:**
```sql
CREATE TABLE content_ideas (
  id TEXT PRIMARY KEY,
  title TEXT,
  status TEXT,
  platform TEXT,
  business TEXT,
  outline TEXT,
  proposed_at TEXT
);
```

### Tasks

**File:** `/Users/marcusrawlins/.openclaw/workspace/mission_control/data/tasks.json`

Used for: Urgent tasks, standing orders, task stats, today's focus.

## Briefing Sections

### 1. Headline Insight
One-sentence key takeaway from the day ahead.

### 2. Last 7 Days Performance
Platform-by-platform breakdown:
- Posts published
- Total views
- Engagement rate
- Likes, comments, shares

### 3. Top Performers
2-3 best performing content pieces (90-day rolling window).

### 4. Active Ideas in Pipeline
Current content ideas in proposed/accepted/in_progress status.

### 5. Today's Tasks
Urgent → High Priority → Standing Orders.

### 6. ✅ ACTION ITEMS (NEW - KEY CHANGE)
**Specific, actionable things to do TODAY.** Generated by LLM from data.

### 7. Performance Highlights
Key wins or positive trends.

### 8. Areas to Watch
Things that need attention or are declining.

### 9. Strategic Recommendations
Forward-looking suggestions.

### 10. System Status
Pipeline metrics:
- Tasks queued/active/done (with pass rate)
- Content drafts/pending/published
- Ideas proposed/in_progress/produced

## Key Features

✅ **Automated** — Runs daily at 6:00 AM EST  
✅ **Action-Focused** — Includes specific next steps  
✅ **Multi-Business** — Covers both photography and R3 Studios  
✅ **Zero Cost** — Uses local LLM (no API bills)  
✅ **Archived** — All briefings saved to disk  
✅ **Telegram Delivery** — Direct to Tyler  
✅ **Graceful Degradation** — Works even if some data missing  

## Troubleshooting

### "Can't reach LM Studio"
- Verify LM Studio running: `curl http://127.0.0.1:1234/v1/models`
- Check model loaded: `qwen3:4b` should be listed
- Restart LM Studio if needed

### "No data collected"
- Verify database files exist: `ls /Volumes/reeseai-memory/data/databases/`
- Check content indexes populated: `cat /Volumes/reeseai-memory/photography/content/content-index.json`
- Verify tasks.json not corrupted: `node -e "console.log(require('/workspace/mission_control/data/tasks.json').length)"`

### "Telegram message not sent"
- Check TELEGRAM_BOT_TOKEN set: `echo $TELEGRAM_BOT_TOKEN`
- Check TELEGRAM_CHAT_ID set: `echo $TELEGRAM_CHAT_ID`
- Test with curl:
  ```bash
  curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -d chat_id="${TELEGRAM_CHAT_ID}" \
    -d text="Test"
  ```

### "Briefing quality poor"
- Check LLM response quality: `node skills/daily-briefing/generate-summary.js --test`
- Verify data being collected: `node skills/daily-briefing/collect-content-metrics.js`
- May need more/better training data in indexes

## Future Enhancements

- [ ] Integration with analytics APIs (Instagram, TikTok, YouTube)
- [ ] Weekly/monthly summary variants
- [ ] Anomaly detection (sudden drops in engagement)
- [ ] Competitor analysis
- [ ] Revenue/financial metrics
- [ ] Content calendar sync
- [ ] Smart recommendations based on patterns
- [ ] Team performance comparisons

## Logs & Archives

**Briefings:** `/Volumes/reeseai-memory/briefings/YYYY-MM-DD-briefing.md`  
**Execution logs:** `/Volumes/reeseai-memory/briefings/logs/YYYY-MM-DD-execution.json`  
**Cron logs:** `/Volumes/reeseai-memory/briefings/logs/cron.log`  

## Config

**LM Studio:**
- Endpoint: `http://127.0.0.1:1234/v1/chat/completions`
- Model: `qwen3:4b`
- Temperature: 0.7

**Telegram:**
- Token: `$TELEGRAM_BOT_TOKEN` (from ~/.openclaw/.env)
- Chat: `$TELEGRAM_CHAT_ID` (from ~/.openclaw/.env)

**Schedule:**
- Time: 6:00 AM EST (0 6 * * *)
- Timezone: America/New_York
