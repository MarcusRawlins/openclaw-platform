# Content Idea Pipeline & Deduplication System

Automated pipeline for capturing, validating, and managing content ideas triggered from Telegram. Includes KB search, social platform research, duplicate detection, and MC task creation.

## Installation

```bash
cd /Users/marcusrawlins/.openclaw/workspace/skills/content-pipeline
npm install
```

## Usage

### Trigger Detection (Marcus Integration)

Marcus watches for keyword triggers in Telegram:
- `"content idea:"`
- `"idea:"`

When detected, automatically:
1. Search knowledge base
2. Search social platforms
3. Check for duplicates
4. Generate summary
5. Create MC task
6. Reply in thread

### Manual Trigger

```bash
node process-idea.js "your idea text here"
```

### Manage Ideas

```bash
# List all ideas
node manage-ideas.js list

# Accept an idea
node manage-ideas.js accept <idea_id>

# Reject an idea
node manage-ideas.js reject <idea_id>

# Get idea details
node manage-ideas.js detail <idea_id>

# Statistics
node manage-ideas.js stats
```

## Configuration

Edit `config.json`:
- Similarity threshold for duplicate detection (default: 40%)
- LM Studio endpoint for summarization
- KB search limit
- Social platform API credentials

## Architecture

**Components:**
- `db.js` — SQLite ideas database
- `kb-search.js` — Knowledge base semantic search
- `social-search.js` — YouTube, Instagram, Twitter search
- `deduplication.js` — Duplicate detection with vector similarity
- `summarize.js` — LLM-based idea summarization
- `create-task.js` — Mission Control task creation
- `process-idea.js` — Main pipeline orchestrator
- `manage-ideas.js` — Idea lifecycle management

**Database:**
- `content_ideas` — Idea storage with embeddings
- `idea_searches` — Search history and analytics

**Integrations:**
- Knowledge Base RAG (vector search)
- LM Studio (nomic-embed-text, qwen model)
- Mission Control (task creation)
- Telegram (message triggers)
- YouTube Data API (if available)
- Instagram Graph API (if available)
- Twitter API v2 (if available)

## Deduplication

Duplicate detection uses cosine similarity on embeddings:
- 0-40%: Unique ideas (proceed)
- 40-100%: Duplicate (reject)

Prevents duplicate content creation and channels similar ideas.

## Idea Lifecycle

1. **proposed** — New idea captured
2. **accepted** — Tyler approved via Telegram
3. **rejected** — Manually rejected
4. **in_progress** — Ada is creating content
5. **produced** — Content published
6. **duplicate** — Marked as duplicate of another idea

## Key Files

- `config.json` — Configuration and thresholds
- `schema.sql` — SQLite schema
- `process-idea.js` — Main entry point
- `manage-ideas.js` — Lifecycle management
- `README.md` — Full documentation
