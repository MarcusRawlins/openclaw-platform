# HEARTBEAT.md

Heartbeats run on local LLM (zero API cost). Keep checks lightweight.

## Every Heartbeat

- **Git backup:** `cd /workspace && git add -A && git commit -m "auto: heartbeat backup" && git push` — if non-zero, log warning and continue. Alert user only for real breakages (merge conflicts, persistent push failures).
- **Update** `memory/heartbeat-state.json` timestamps for checks performed.

## Once Daily

- **Disk space:** Check `/Volumes/reeseai-memory` usage. Alert if over 80%.
- **Cron failure check:** Review recent cron runs. Alert on any new failures since last check.
- **Repo size:** Alert if workspace git repo exceeds 500MB.

## Weekly

- **Gateway security:** Verify gateway is bound to loopback only and auth token is non-empty.

## Reporting

Heartbeat turns should end with NO_REPLY unless something needs attention. Only send a direct message when the user needs to intervene.

If `memory/heartbeat-state.json` is corrupted, replace it with:
```json
{"lastChecks": {"diskSpace": null, "cronFailures": null, "repoSize": null, "gatewaySecurity": null, "lastDailyChecks": null}}
```
Then alert the user.
