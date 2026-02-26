# Content Idea Pipeline & Deduplication System

Automated pipeline for capturing, validating, and managing content ideas triggered from Telegram. Includes KB search, social platform research, duplicate detection using vector embeddings, and automatic Mission Control task creation.

## Quick Start

### Installation

```bash
cd /Users/marcusrawlins/.openclaw/workspace/skills/content-pipeline
npm install
```

### Process an Idea

```bash
node process-idea.js "wedding photography pricing guide"
```

### Manage Ideas

```bash
# List all ideas
node manage-ideas.js list

# List only proposed ideas
node manage-ideas.js list proposed

# Get details of idea #5
node manage-ideas.js detail 5

# Accept idea #5 (creates active MC task)
node manage-ideas.js accept 5

# Reject idea #5 (deletes MC task)
node manage-ideas.js reject 5

# Show statistics
node manage-ideas.js stats

# Show search history
node manage-ideas.js history
```

## Architecture

### Components

1. **db.js** — SQLite database for ideas and search history
2. **deduplication.js** — Duplicate detection using vector similarity (cosine similarity on embeddings)
3. **kb-search.js** — Knowledge base semantic search via RAG system
4. **summarize.js** — LLM-based idea summarization (LM Studio)
5. **create-task.js** — Mission Control task creation
6. **process-idea.js** — Main pipeline orchestrator
7. **manage-ideas.js** — Idea lifecycle management (accept/reject/list)

### Data Flow

```
User Message: "content idea: wedding photography pricing"
        ↓
[1] Deduplication Check (vector similarity)
        ↓
If duplicate → Reject with reference
If unique → Continue
        ↓
[2] KB Search (semantic search via RAG)
        ↓
[3] Social Search (YouTube, Instagram, Twitter)
        ↓
[4] Summary Generation (LM Studio)
        ↓
[5] Embedding Generation
        ↓
[6] Store in Database
        ↓
[7] Create MC Task
        ↓
[8] Reply in Telegram Thread
```

## Database Schema

**File:** `/Volumes/reeseai-memory/data/content-pipeline/ideas.db`

### content_ideas Table

- `id` — Primary key
- `title` — Idea title
- `description` — Full description
- `suggested_by` — Who suggested the idea (Tyler, Marcus, etc.)
- `suggested_at` — When the idea was captured
- `status` — proposed | accepted | rejected | in_progress | produced | duplicate
- `platform` — instagram | tiktok | youtube | blog
- `content_type` — reel | carousel | video | article
- `target_audience` — Who should see this content
- `suggested_outline` — Content outline
- `embedding` — Vector embedding (768 dims, stored as BLOB)
- `duplicate_of` — ID of idea it's a duplicate of
- `similarity_score` — Similarity to duplicate (0-1)
- `kb_sources` — JSON array of KB source references
- `social_sources` — JSON array of social media URLs
- `task_id` — Mission Control task ID
- `content_id` — ID of final produced content
- `created_at` — Timestamp

### idea_searches Table

- `id` — Primary key
- `query` — Search query text
- `kb_results` — Number of KB sources found
- `social_results` — Number of social posts found
- `duplicate_found` — Whether duplicate was detected
- `duplicate_id` — ID of duplicate found
- `searched_at` — When the search occurred

## Deduplication

Uses cosine similarity on 768-dimensional embeddings (via LM Studio's nomic-embed-text):

- **Similarity Score:** 0 (completely different) to 1 (identical)
- **Threshold:** 40% (0.40)
  - Score < 40%: Unique idea (proceed)
  - Score ≥ 40%: Duplicate (reject with reference to original)

## Configuration

Edit `config.json` to customize:

```json
{
  "deduplication": {
    "similarity_threshold": 0.40,    // 40% similarity = duplicate
    "enabled": true
  },
  "knowledge_base": {
    "search_limit": 10,              // Max KB sources to return
    "similarity_threshold": 0.6      // KB search minimum relevance
  },
  "summarization": {
    "model": "qwen3:4b",             // LM Studio model for summarization
    "temperature": 0.7,              // LLM creativity (0-1)
    "timeout_ms": 30000              // Request timeout
  },
  "mission_control": {
    "assign_to": "ada",              // Default assignee
    "task_priority": "medium"        // Task priority
  }
}
```

## Idea Lifecycle

1. **proposed** — Idea just captured, awaiting Tyler review
2. **accepted** — Tyler approved via "accept idea [id]" command
3. **rejected** — Manually rejected via "reject idea [id]"
4. **in_progress** — Ada is creating the content
5. **produced** — Content published, linked to content_id
6. **duplicate** — Marked as duplicate of another idea

## Integration Points

### Knowledge Base RAG

Uses `/workspace/skills/knowledge-base-rag/query.js` for semantic search:
- Searches 269 existing KB files
- Returns relevant sources with similarity scores
- Hybrid search (vector + keyword)

### LM Studio

Uses local LLM for summarization:
- Model: qwen3:4b
- Endpoint: http://127.0.0.1:1234/v1
- Generates idea summaries with title, outline, platform recommendations

### Mission Control

Automatically creates tasks in `/workspace/mission_control/data/tasks.json`:
- Assigns to Ada for content creation
- Links idea metadata (platform, format, target audience)
- Sets as "queued" status initially

### Telegram (Future)

Marcus watches for trigger phrases:
- `"content idea:"` or `"idea:"` in messages
- Automatically processes and replies in thread
- Handles "accept idea [id]" and "reject idea [id]" commands

## Performance

- **Deduplication check:** ~500ms per idea (embeddings)
- **KB search:** ~50ms (semantic search)
- **Summarization:** ~3-5 seconds (LLM)
- **Total pipeline:** ~5-10 seconds per idea

## Testing

### Test Deduplication

```bash
# First idea - should succeed
node process-idea.js "wedding photography pricing tips"

# Similar idea - should be rejected as duplicate
node process-idea.js "wedding photo price guide"

# Verify
node manage-ideas.js list duplicate
```

### Test with Different Platforms

```bash
# Instagram Reel
node process-idea.js "quick wedding photography tips for reels"

# Blog Post
node process-idea.js "comprehensive guide to wedding photography styles"

# YouTube Video
node process-idea.js "behind the scenes of a wedding photo shoot"
```

## Future Enhancements

- [ ] Real social platform search (YouTube API, Instagram Graph API, Twitter API v2)
- [ ] Tyler's Telegram integration for automatic idea detection
- [ ] Idea versioning and history tracking
- [ ] Collaborative editing (multiple people suggest variations)
- [ ] Performance metrics (CTR, engagement per idea)
- [ ] Idea clustering (group similar ideas)
- [ ] Scheduled idea reminders
- [ ] Idea templates by platform/industry

## Troubleshooting

### "LM Studio connection failed"

```bash
# Verify LM Studio is running
curl http://127.0.0.1:1234/v1/models

# Restart if needed
# Ensure qwen3:4b is loaded
```

### "Knowledge base not found"

Ensure KB RAG system is initialized:
```bash
cd /workspace/skills/knowledge-base-rag
npm install
node manage.js health-check
```

### "Task creation failed"

Verify Mission Control tasks.json exists and is writable:
```bash
ls -la /workspace/mission_control/data/tasks.json
```

### Duplicate detection too strict/loose

Adjust `similarity_threshold` in `config.json`:
- Lower (0.20-0.35): Only reject very similar ideas
- Higher (0.50-0.70): Reject more loosely related ideas

## License

MIT
