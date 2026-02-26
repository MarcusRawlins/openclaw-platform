# Phase 5: Content & Documents

**Parent spec:** `docs/MISSION-CONTROL-REBUILD.md`
**Branch:** `mc/phase-5-content`
**Estimated effort:** 3-4 hours
**Dependencies:** Phase 1 complete

---

## Goal

See all content the team is producing and access key documents without digging through file systems.

---

## 5A: Content View

### Blog Posts
- Source: `/Volumes/reeseai-memory/photography/content/blog/`
- List all blog posts with: title (from H1), date, status, word count
- Click → preview markdown rendered as HTML
- Status: draft / reviewed / published (track via simple JSON sidecar or frontmatter)

### Social Content
- Source: `/Volumes/reeseai-memory/photography/content/social/` and `/Users/marcusrawlins/.openclaw/workspace/content/social/`
- List social content files
- Click → preview

### Outreach Emails
- Source: `/Volumes/reeseai-memory/photography/outreach/cold-emails/`
- List by date folder, then by business
- Click → preview email content

### API
- `GET /api/content?type=blog` — list content files with metadata
- `GET /api/content/[path]` — read file content (rendered markdown)
- Content is read-only from MC. Editing happens through agents.

---

## 5B: Documents View

### Key Documents
Read from workspace `docs/` directory:
- BRAND-VOICE.md
- ARCHITECTURE.md
- MISSION-CONTROL-REBUILD.md
- PRD.md
- REFERENCE-PRD.md
- ANSELAI-ARCHITECTURE.md
- DIRECTORY-MAP.md

### SOPs
Read from `docs/sops/`:
- List all SOPs
- Click → read content

### Agent Lessons
- List all agent lessons files from `/agents/*/lessons.md`
- Plus shared lessons from `/agents/shared-lessons.md`
- Click → read content

### API
- `GET /api/documents?dir=docs` — list files in a directory
- `GET /api/documents/read?path=docs/BRAND-VOICE.md` — read file content
- Read-only. No editing from MC.

---

## 5C: System View

### Gateway Status
- Connected / disconnected indicator
- Uptime
- Current model in use
- Active sessions count

### Service Health
- MC: running (self-check, always true if you see this)
- Gateway: WebSocket connection status
- Ollama: check `http://localhost:11434/api/tags` for model list and status

### Disk Usage
- Memory drive (`/Volumes/reeseai-memory/`): total, used, available
- Use `df` or equivalent

### Recent Errors
- Read from gateway if error events are available
- Or read from MC server logs

### Cron Overview
- Summary: X jobs enabled, Y disabled, Z ran in last 24h
- Link to full cron management (Phase 3)

### API
- `GET /api/system/health` — aggregated health check
- `GET /api/system/disk` — disk usage
- `GET /api/gateway-stats` — gateway status (exists, verify it works)

---

## Review Criteria (Walt)

- [ ] Content view lists real blog posts from the drive
- [ ] Can click and preview blog content (rendered markdown)
- [ ] Social and outreach content listed correctly
- [ ] Documents view lists all docs and SOPs
- [ ] Can read any document from the UI
- [ ] Agent lessons are browsable
- [ ] System view shows real gateway status
- [ ] Ollama status displays correctly
- [ ] Disk usage shows real numbers
- [ ] All API routes work
- [ ] No mock data
- [ ] `bun run build` succeeds
- [ ] Mobile: content and docs are readable on phone
