# Knowledge Base RAG System

Local Retrieval-Augmented Generation (RAG) system for semantic search and knowledge management. Built from scratch with no frameworks - SQLite + local embeddings (LM Studio) + vector search.

## Quick Start

### 1. Install Dependencies

```bash
cd /Users/marcusrawlins/.openclaw/workspace/skills/knowledge-base-rag
npm install
```

### 2. Verify LM Studio is Running

```bash
curl http://127.0.0.1:1234/v1/models
```

Should return a list of available models including `nomic-embed-text`.

### 3. Run Health Check

```bash
node manage.js health-check
```

### 4. Start Ingestion

**Single URL:**
```bash
node ingest.js --url "https://example.com/article" --type article
```

**Local File:**
```bash
node ingest.js --file "/path/to/document.md"
```

**Migrate 269 KB Files (one-time):**
```bash
node migrate.js
```

To resume a failed migration:
```bash
node migrate.js --resume
```

### 5. Query the Knowledge Base

**Semantic search:**
```bash
node query.js "what is wedding photography" --method vector --limit 10
```

**Keyword search:**
```bash
node query.js "pricing" --method keyword
```

**Hybrid (vector + keyword):**
```bash
node query.js "engagement session tips" --method hybrid
```

**Filter by type:**
```bash
node query.js "wedding" --type article --limit 5
```

### 6. Management

**List all sources:**
```bash
node manage.js list
```

**Get source details:**
```bash
node query.js --source 1
```

**Delete a source:**
```bash
node manage.js delete <source_id> --confirm
```

**Reindex (rebuild embeddings):**
```bash
node manage.js reindex
```

**Statistics:**
```bash
node manage.js stats
```

**Cleanup orphaned entries:**
```bash
node manage.js cleanup
```

## Architecture

### Core Components

1. **db.js** — SQLite database with tables for sources, chunks, and ingestion logs
2. **embeddings.js** — LM Studio client (nomic-embed-text, 768 dimensions)
3. **chunking.js** — Text chunking (512 tokens, 50-token overlap)
4. **security.js** — URL validation, injection detection, content sanitization
5. **fetchers.js** — Content fetchers (articles, YouTube, PDFs, tweets, local files)
6. **ingest.js** — Ingestion pipeline with locking mechanism
7. **migrate.js** — Migration script for 269 existing KB files
8. **query.js** — Query engine with vector and keyword search
9. **manage.js** — Management commands (list, delete, reindex, health check)

### Database Schema

**File:** `/Volumes/reeseai-memory/data/knowledge-base/kb-rag.db`

```sql
-- Sources: Original content (URLs or file paths)
CREATE TABLE sources (
  id INTEGER PRIMARY KEY,
  url TEXT UNIQUE,
  file_path TEXT UNIQUE,
  source_type TEXT,              -- article, youtube, pdf, tweet, local_*
  title TEXT,
  author TEXT,
  published_date TEXT,
  fetched_at TIMESTAMP,
  tags TEXT,                      -- JSON array
  metadata TEXT                   -- JSON object
);

-- Chunks: Text segments with embeddings
CREATE TABLE chunks (
  id INTEGER PRIMARY KEY,
  source_id INTEGER,
  chunk_index INTEGER,
  text TEXT,
  embedding BLOB,                 -- Float32 vector (768 dims)
  token_count INTEGER,
  created_at TIMESTAMP
);

-- Ingestion Log: Track ingestion attempts
CREATE TABLE ingestion_log (
  id INTEGER PRIMARY KEY,
  source_id INTEGER,
  status TEXT,                    -- success, failed, skipped
  error_message TEXT,
  chunks_created INTEGER,
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);
```

### Lock File

`/tmp/kb-rag.lock` prevents concurrent ingestion operations. Auto-expires after 5 minutes.

## Configuration

Edit `config.json` to customize:

```json
{
  "embeddings": {
    "url": "http://127.0.0.1:1234/v1",  // LM Studio endpoint
    "model": "nomic-embed-text",
    "dimension": 768
  },
  "chunking": {
    "chunk_size": 512,              // tokens per chunk
    "chunk_overlap": 50,            // token overlap between chunks
    "max_chunk_size": 1000          // safety limit
  },
  "security": {
    "allowed_schemes": ["http", "https"],
    "url_timeout_ms": 30000,
    "max_content_size_mb": 50
  }
}
```

## How It Works

### Ingestion Flow

1. **Fetch** — Retrieve content from URL or file
2. **Validate** — Check URL, detect injection, check size
3. **Sanitize** — Remove dangerous HTML/patterns
4. **Chunk** — Split into 512-token segments with 50-token overlap
5. **Embed** — Generate vector embeddings (LM Studio)
6. **Store** — Save source and chunks to SQLite
7. **Log** — Record ingestion result

### Query Flow

1. **Generate Embedding** — Convert query to 768-dim vector
2. **Vector Search** — Calculate cosine similarity to all chunks
3. **Rank** — Sort by similarity score
4. **Return** — Top N results with source info

### Vector Search

Uses cosine similarity between query embedding and chunk embeddings:

```
similarity = dot(query, chunk) / (norm(query) * norm(chunk))
```

Score range: -1 (opposite) to 1 (identical)

## Performance Notes

- **Embeddings:** ~500ms per chunk (LM Studio, local)
- **Vector search:** ~50ms for 10,000 chunks
- **Keyword search:** ~10ms for full-text match
- **Chunk size:** 512 tokens = ~300-400 words

## Security

✓ URL scheme validation (http/https only)
✓ No private network access (127.0.0.1, 192.168.*, etc.)
✓ Content size limits (50MB max)
✓ Injection detection (script tags, event handlers)
✓ HTML sanitization
✓ Lock file prevents concurrent access

## Migration Status

Track migration progress in `.migration-status.json`:

```json
{
  "processed": ["/path/to/file1.md", ...],
  "failed": [{"path": "...", "error": "..."}],
  "total": 269
}
```

## Troubleshooting

**LM Studio connection error:**
```bash
curl http://127.0.0.1:1234/v1/models
# If error, restart LM Studio and ensure nomic-embed-text is loaded
```

**Database locked:**
```bash
rm /tmp/kb-rag.lock
# Lock file indicates concurrent access; remove if stale
```

**Out of memory:**
- Reduce batch embedding concurrency (in embeddings.js)
- Process files in smaller batches (in migrate.js)

**Slow queries:**
- Run `node manage.js cleanup` to remove orphaned entries
- Reindex with `node manage.js reindex` for stale embeddings

## API Examples

### JavaScript

```javascript
const Ingester = require('./ingest');
const QueryEngine = require('./query');

// Ingest
const ingester = new Ingester();
const result = await ingester.ingestUrl('https://example.com');

// Query
const engine = new QueryEngine();
const results = await engine.searchVectors('my search query');
```

### Shell

```bash
# Ingest article
node ingest.js --url "https://blog.example.com/post" --type article --tags "wedding,tips"

# Search
node query.js "wedding photography tips" --limit 20 --method hybrid

# Get statistics
node manage.js stats
```

## Future Enhancements

- [ ] sqlite-vec extension for faster vector search
- [ ] YouTube transcript API integration
- [ ] PDF text extraction (pdf-parse)
- [ ] Web interface for browsing
- [ ] Reranking with LLM
- [ ] Batch filtering and exports
- [ ] Vector search filtering by metadata
- [ ] Incremental embeddings (avoid re-embedding)

## License

MIT
