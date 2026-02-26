# Daily Briefing System

Automated daily briefing generation for The Reeses and R3 Studios businesses.

**Status:** ✅ Production Ready  
**Schedule:** Daily at 6:00 AM EST  
**Delivery:** Telegram to Tyler  
**Cost:** $0 (all local processing)  

## Quick Start

### Manual Generation
```bash
node /Users/marcusrawlins/.openclaw/workspace/skills/daily-briefing/briefing-generator.js
```

### Cron Test (Dry Run)
```bash
node /Users/marcusrawlins/.openclaw/workspace/agents/main/daily-briefing-cron.js --dry-run
```

### View Latest Briefing
```bash
cat /Volumes/reeseai-memory/briefings/2026-02-26-briefing.md
```

## System Components

| Component | Purpose | Status |
|-----------|---------|--------|
| collect-content-metrics.js | Content performance data | ✅ Complete |
| collect-ideas.js | Active content ideas | ✅ Complete |
| collect-tasks.js | Today's task list | ✅ Complete |
| generate-summary.js | AI insights via LM Studio | ✅ Complete |
| format-briefing.js | Markdown formatting | ✅ Complete |
| briefing-generator.js | Orchestrator | ✅ Complete |
| daily-briefing-cron.js | Telegram delivery | ✅ Complete |

## Briefing Sections

1. **Headline Insight** - Key takeaway for the day
2. **Performance Data** - Content metrics from past 7 days
3. **Top Performers** - Best content (90-day rolling)
4. **Active Ideas** - Ideas in the pipeline
5. **Today's Tasks** - Urgent, high-priority, standing orders
6. **ACTION ITEMS** - Specific things to do (KEY FEATURE)
7. **Performance Highlights** - Key wins
8. **Areas to Watch** - Things needing attention
9. **Strategic Recommendations** - Forward-looking suggestions
10. **System Status** - Pipeline metrics

## Data Flow

```
6:00 AM EST (Cron)
    ↓
  briefing-generator.js
    ↓
  collect-* modules
    ├── /Volumes/.../anselai.db (content metrics)
    ├── /Volumes/.../ideas.db (content ideas)
    └── /workspace/.../tasks.json (tasks)
    ↓
  generate-summary.js (LM Studio)
    ↓
  format-briefing.js
    ↓
  Archive + Telegram Delivery
```

## Key Features

✅ **Action-Focused** - Includes specific tasks to do today  
✅ **Multi-Business** - Covers photography and R3 Studios  
✅ **Zero Cost** - Uses local LLM  
✅ **Archived** - All briefings saved for reference  
✅ **Graceful Degradation** - Works with missing data  
✅ **Automated** - Runs every day at 6:00 AM EST  

## Cron Status

Check if cron job is loaded:
```bash
launchctl list | grep dailybriefing
```

Output:
```
-	78	com.reese.dailybriefing
```

Plist file: `~/Library/LaunchAgents/com.reese.dailybriefing.plist`

## Files

**Main:**
- `briefing-generator.js` - Orchestrator
- `daily-briefing-cron.js` - Cron handler

**Collectors:**
- `collect-content-metrics.js` - Content performance
- `collect-ideas.js` - Content ideas
- `collect-tasks.js` - Task data

**Processors:**
- `generate-summary.js` - AI insights
- `format-briefing.js` - Markdown output

**Documentation:**
- `SKILL.md` - Complete technical reference
- `README.md` - This file

## Configuration

**LM Studio:**
- Endpoint: `http://127.0.0.1:1234/v1/chat/completions`
- Model: `qwen3:4b`

**Schedule:**
- Time: 6:00 AM EST (0 6 * * * in cron format)
- Timezone: America/New_York

**Credentials:**
- `TELEGRAM_BOT_TOKEN` - from ~/.openclaw/.env
- `TELEGRAM_CHAT_ID` - from ~/.openclaw/.env

## Troubleshooting

### Briefing not sent?
1. Check LM Studio running: `curl http://127.0.0.1:1234/v1/models`
2. Check Telegram credentials: `echo $TELEGRAM_BOT_TOKEN`
3. Check cron loaded: `launchctl list | grep dailybriefing`
4. Check logs: `tail -50 /Volumes/reeseai-memory/briefings/logs/stderr.log`

### No data in briefing?
1. Check databases exist: `sqlite3 /Volumes/reeseai-memory/data/databases/anselai.db ".tables"`
2. Check content index: `cat /Volumes/reeseai-memory/photography/content/content-index.json`
3. Check tasks.json: `wc -l /workspace/mission_control/data/tasks.json`

### Test manually:
```bash
node briefing-generator.js
node daily-briefing-cron.js --dry-run
```

## Next Steps

- [ ] Integrate with analytics APIs (Instagram, TikTok, YouTube) for real performance data
- [ ] Add weekly/monthly variants
- [ ] Anomaly detection (sudden engagement drops)
- [ ] Machine learning for smart recommendations
- [ ] Team performance comparisons

## Archives

- **Briefings:** `/Volumes/reeseai-memory/briefings/YYYY-MM-DD-briefing.md`
- **Logs:** `/Volumes/reeseai-memory/briefings/logs/`

## See Also

- [Daily Briefing System Spec](/workspace/specs/daily-briefing-system.md)
- [Cron Automation System](/workspace/specs/cron-automation-system.md)
- [Content Idea Pipeline](/workspace/specs/content-idea-pipeline.md)
