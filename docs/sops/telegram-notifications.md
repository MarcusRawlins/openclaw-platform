# Direct Telegram Notification Policy

## When to Notify Tyler Directly

### Immediate (via message tool)
- Task completion that Tyler is waiting on
- Agent failures that need human intervention
- Security alerts (unauthorized access, leaked credentials)
- System down (gateway, LM Studio, disk full)

### Batched (via cron announce)
- Walt review results (delivered when subagent completes)
- Brunel task completions (delivered when subagent completes)
- Scout lead research results (delivered when cron completes)
- Content drafts from Ada (delivered when cron completes)

### Silent (NO_REPLY)
- Heartbeat checks (unless something needs attention)
- Routine health checks passing
- Queue processor runs with no tasks
- Cron jobs completing normally

## Implementation

All subagent spawns use `delivery: "announce"` which auto-delivers results to Tyler's chat when complete. Cron jobs that need user notification also use `delivery: { mode: "announce" }`.

System-level alerts (disk, gateway, security) are handled by the health check cron and escalated via the announce delivery when issues are found.

No additional notification infrastructure needed. The existing subagent announce + cron delivery system handles all cases.
