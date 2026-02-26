# Knowledge Base RAG System

Local RAG system for ingesting, storing, and semantically searching content using SQLite + local embeddings (LM Studio).

## Installation

```bash
cd /Users/marcusrawlins/.openclaw/workspace/skills/knowledge-base-rag
npm install
```

## Usage

### URL Ingestion

```bash
node ingest.js --url "https://example.com/article" --type article
node ingest.js --url "https://youtube.com/watch?v=..." --type youtube
node ingest.js --url "https://example.pdf" --type pdf
```

### Batch Ingestion

```bash
node migrate.js --source files  # Migrate existing KB files
node migrate.js --source urls   # Ingest URLs from list
```

### Query

```bash
node query.js "semantic search query" --limit 10 --type article
```

### Management

```bash
node manage.js list                    # List all sources
node manage.js delete <source_id>      # Delete source
node manage.js reindex                 # Rebuild all embeddings
node manage.js health-check            # Verify DB integrity
```

## Architecture

- **Database:** SQLite with sqlite-vec extension at `/Volumes/reeseai-memory/data/knowledge-base/kb-rag.db`
- **Embeddings:** LM Studio (nomic-embed-text, 768 dimensions) at `http://127.0.0.1:1234/v1`
- **Chunking:** 512 tokens per chunk, 50-token overlap
- **Security:** URL whitelist, content sanitization, injection detection

## Files

- `db.js` — Database initialization and schema
- `embeddings.js` — LM Studio embeddings client
- `chunking.js` — Text chunking (512 tokens, 50 overlap)
- `ingest.js` — URL ingestion with security validation
- `migrate.js` — Migration script for 269 existing KB files
- `query.js` — Semantic search engine
- `manage.js` — Management commands
- `security.js` — URL validation and content sanitization

## Configuration

All settings in `config.json`:
- LM_STUDIO_URL: http://127.0.0.1:1234/v1
- CHUNK_SIZE: 512 tokens
- CHUNK_OVERLAP: 50 tokens
- MAX_CHUNK_SIZE: 1000 tokens
- EMBEDDING_DIMENSION: 768

## Lock File

Ingestion uses `/tmp/kb-rag.lock` to prevent concurrent operations.
