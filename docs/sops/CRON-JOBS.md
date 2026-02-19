# SOP: Cron Jobs

> Standards for scheduled tasks in the Reese Operations platform.

## When to Use Cron vs Heartbeat

**Use cron when:**
- Exact timing matters ("9:00 AM every Monday")
- Task needs isolation from main session
- You want a different model or thinking level
- One-shot reminders
- Output should deliver directly to a channel

**Use heartbeat when:**
- Multiple checks can batch together
- Timing can drift (every ~2h is fine)
- You need conversational context

## Creating a Cron Job

Use the `cron` tool with `action: add`. Required fields:

```json
{
  "name": "Human-readable name",
  "schedule": { "kind": "cron", "expr": "0 7 * * 1-5", "tz": "America/New_York" },
  "payload": { "kind": "agentTurn", "message": "Task description" },
  "sessionTarget": "isolated",
  "enabled": true
}
```

## Schedule Types

| Type | Use Case | Example |
|------|----------|---------|
| `cron` | Recurring schedule | `"expr": "0 7 * * 1-5"` (7am weekdays) |
| `every` | Fixed interval | `"everyMs": 3600000` (hourly) |
| `at` | One-shot | `"at": "2026-03-01T09:00:00-05:00"` |

## Standards

1. **Name clearly.** "Daily CRM Sync" not "job-47"
2. **Use isolated sessions** for anything that does real work (keeps main session clean)
3. **Use systemEvent + main session** only for reminders/alerts to Tyler
4. **Time zone:** Always `America/New_York`
5. **Respect quiet hours:** 11pm-7am ET, no non-urgent notifications
6. **Log results:** Jobs should write outcomes to memory or dedicated log files
7. **Clean up:** Use `deleteAfterRun: true` for one-shot jobs

## Anti-Patterns

- ❌ Cron jobs that poll sub-agents in loops
- ❌ Using Opus for cron jobs (use Haiku or local models)
- ❌ Duplicate cron jobs doing the same thing
- ❌ Cron jobs that send messages outside quiet hours without urgency
