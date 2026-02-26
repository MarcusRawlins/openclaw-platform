# SOP: Agent Learning Process

## How Lessons Flow

1. **Agent does work** → submits for review
2. **Walt reviews** → grades work, writes detailed review to `/Volumes/reeseai-memory/agents/reviews/`
3. **Marcus (1am cron)** → reads Walt's reviews, updates agent lessons.md files, updates shared-lessons.md
4. **Next session** → agent reads lessons.md + shared-lessons.md on boot, applies them

## Files

- **Per-agent lessons:** `/Users/marcusrawlins/.openclaw/agents/[id]/lessons.md` (max 20)
- **Shared lessons:** `/Users/marcusrawlins/.openclaw/agents/shared-lessons.md` (max 20, apply to all)
- **Review archive:** `/Volumes/reeseai-memory/agents/reviews/`
- **Lesson archive:** `/Volumes/reeseai-memory/agents/[id]/lesson-archive/`

## Rules

- One line per lesson. No paragraphs.
- Max 20 lessons per file. When full, archive oldest (never delete).
- Date-stamp every lesson: `[YYYY-MM-DD] Lesson text`
- Shared lessons = patterns that affect 2+ agents
- Agent-specific lessons = patterns unique to that agent's domain

## Cross-Agent Learning

When Walt identifies a pattern in one agent's work that applies to others:
- It goes in `shared-lessons.md`, not duplicated across individual files
- Example: "Test before submitting" applies to everyone → shared
- Example: "Use CSS variables for colors" applies to Brunel only → Brunel's lessons.md

## Proactive Learning

Agents should also self-report lessons:
- After completing work, update your own lessons.md
- What went wrong? What would you do differently?
- Don't wait for Walt. Learn in real-time.
