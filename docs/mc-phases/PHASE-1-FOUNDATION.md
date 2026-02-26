# Phase 1: Foundation Fix

**Parent spec:** `docs/MISSION-CONTROL-REBUILD.md`
**Branch:** `mc/phase-1-foundation`
**Estimated effort:** 2-3 hours
**Dependencies:** None

---

## Goal

Fix broken paths and gateway connections so MC can talk to the gateway and display real agent state. Nothing else works until this is done.

---

## 1A: Fix Gateway Paths

**Files to update:**

### `lib/gateway-sync.ts`
- `AGENTS_WORKSPACE_ROOT`: Change from `~/clawd/agents` → `/Users/marcusrawlins/.openclaw/agents`
- `WHITEBOARD_PATH`: Remove whiteboard references entirely (we use task board, not whiteboard)
- `workspace` default: `/Users/marcusrawlins/.openclaw/workspace`
- Any reference to `/Users/admin/` → `/Users/marcusrawlins/`
- System prompt references to `~/clawd/` → `~/.openclaw/workspace/`

### `lib/system-prompt.ts`
- Update all file paths from `clawd/` to `.openclaw/workspace/`
- Remove references to `SECURITY.md`, `WHITEBOARD.md`, `humanizer` skill (these are from the original fork)

### `lib/agents-config.ts`
- Verify `AGENTS` array: Tyler (human) and Marcus (gateway: main) are correct
- Marcus model should say "Claude Sonnet 4.5" not an outdated model name
- Verify `gatewayAgentId` mappings match our gateway config: main, brunel, scout, dewey, ed, ada, walt

### Global search
Run `grep -r "clawd" --include="*.ts" --include="*.tsx"` and fix every hit. Zero tolerance.

---

## 1B: Fix Gateway Chat

**The problem:** Chat modal connects via WebSocket but messages don't flow correctly.

**Files:**

### `lib/gateway-client.ts`
- Verify the WebSocket connect handshake works with our gateway's auth
- The `sendConnectFrame()` method must authenticate with the gateway token
- Test: instantiate client, connect to `ws://localhost:18789`, verify `connected` state

### `components/ChatModal.tsx`
- Session key resolution: Marcus → `agent:main:main`, other agents → `agent:{id}:main`
- Message send must use the gateway's `sessions.send` or `sessions.message` method
- Streaming response must display incrementally
- Error handling: if gateway is down, show clear error, don't hang

### `components/InlineChatPanel.tsx`
- Same session key and message flow fixes as ChatModal
- This is the sidebar chat, should work identically

**Test procedure:**
1. Open MC in browser
2. Click Marcus avatar → chat modal opens
3. Type "hello" → message sends via WebSocket
4. Response streams back and displays
5. Repeat with another agent (e.g., Brunel)

---

## 1C: Fix Agent Status Display

**Files:**

### `lib/use-gateway.ts`
- On WebSocket connect, request session list from gateway
- Map active sessions to agent status: has running session = "working", no session = "idle"
- Subscribe to session events for real-time updates

### `components/MissionControl.tsx`
- Agent cards should show real status from gateway, not hardcoded
- Status indicators: 🟢 working, 🟡 idle, 🔴 error/offline
- Current task should show from task board data (agent's active task)

### `components/BlueprintView.tsx`
- Agent positions and rooms should come from `data/agents.json` (which has positions)
- Status badges must reflect real gateway state
- Remove any mock data or placeholder statuses
- Click agent → should open detail or chat

---

## Review Criteria (Walt)

- [ ] `grep -r "clawd" --include="*.ts" --include="*.tsx"` returns zero results
- [ ] `bun run build` succeeds with no errors
- [ ] No TypeScript errors
- [ ] Open MC → agents show real status from gateway
- [ ] Click Marcus → chat modal → send message → get response
- [ ] Click another agent → chat works for them too
- [ ] Blueprint view shows real agent state, no mock data
- [ ] Gateway disconnect → agents show offline state
- [ ] Gateway reconnect → agents recover to correct state
