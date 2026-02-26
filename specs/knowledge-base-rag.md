# Knowledge Base RAG System

**Priority:** High
**Estimated Time:** 3-4 days
**Dependencies:** None (fresh build from scratch)

## Goal

Build a Retrieval-Augmented Generation (RAG) system for ingesting, storing, and semantically searching content from URLs and existing files. No frameworks. Local embeddings. Security-first.

## Overview

**What it does:**
1. Ingest URLs (articles, YouTube videos, PDFs, tweets) with security validation
2. Migrate existing 269 knowledge base files (one-time)
3. Chunk text, generate embeddings (local model, no API costs)
4. Store in SQLite with vector search capability
5. Query engine with semantic search and filters
6. Management commands (list, delete, re-index)

**Why build from scratch:**
- Full control over security validation
- Lightweight (no 50+ dependency frameworks)
- Optimized for local embeddings + SQLite
- Easier to debug and maintain
- Fits our infrastructure-first philosophy

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Knowledge Base RAG System                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ URL Pipeline │  │ File Pipeline│  │Query Engine  │     │
│  │              │  │              │  │              │     │
│  │ • Fetch URL  │  │ • Scan files │  │ • Embed query│     │
│  │ • Validate   │  │ • Read text  │  │ • Vector search│   │
│  │ • Sanitize   │  │ • Chunk      │  │ • Rank results│    │
│  │ • Chunk      │  │ • Embed      │  │ • Filter      │    │
│  │ • Embed      │  │ • Store      │  │              │     │
│  │ • Store      │  │              │  │              │     │
│  └──────┬───────┘  └──────┬───────┘  └──────▲───────┘     │
│         │                 │                  │              │
│         └─────────────────┴──────────────────┘              │
│                           │                                 │
│                  ┌────────▼────────┐                        │
│                  │  Embedding Gen  │                        │
│                  │  (LM Studio)    │                        │
│                  │ nomic-embed-text│                        │
│                  └────────┬────────┘                        │
│                           │                                 │
│                  ┌────────▼────────┐                        │
│                  │  SQLite + Vec   │                        │
│                  │  Vector Storage │                        │
│                  │  (sqlite-vec)   │                        │
│                  └─────────────────┘                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

**Core:**
- Node.js (no framework)
- SQLite with `sqlite-vec` extension
- LM Studio with `nomic-embed-text` (local embeddings)

**Libraries:**
- `better-sqlite3` — SQLite driver
- `node-fetch` — HTTP requests
- `cheerio` — HTML parsing
- `pdf-parse` — PDF text extraction (backup if needed)
- `youtube-transcript` — YouTube transcript fetching
- Custom chunking algorithm (no library needed)

**No frameworks:** No LlamaIndex, LangChain, or other heavy abstractions

## Database Schema

**File:** `/Volumes/reeseai-memory/data/knowledge-base/kb-rag.db`

```sql
-- Sources table
CREATE TABLE sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT UNIQUE,                    -- Original URL (NULL for local files)
  file_path TEXT UNIQUE,              -- Local file path (NULL for URLs)
  source_type TEXT NOT NULL,          -- article, youtube, pdf, tweet, local_pdf, local_video
  title TEXT,
  author TEXT,
  published_date TEXT,
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  tags TEXT,                          -- JSON array: ["wedding", "pricing"]
  metadata TEXT                       -- JSON object for extra fields
);

-- Chunks table (text chunks with embeddings)
CREATE TABLE chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL,
  chunk_index INTEGER NOT NULL,      -- Position in source (0, 1, 2...)
  text TEXT NOT NULL,
  embedding BLOB NOT NULL,            -- Vector embedding (768 dimensions for nomic-embed-text)
  token_count INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

-- Vector index for similarity search
CREATE VIRTUAL TABLE vec_chunks USING vec0(
  chunk_id INTEGER PRIMARY KEY,
  embedding FLOAT[768]               -- 768 dimensions for nomic-embed-text
);

-- Ingestion log
CREATE TABLE ingestion_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER,
  status TEXT,                       -- success, failed, skipped
  error_message TEXT,
  chunks_created INTEGER DEFAULT 0,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  FOREIGN KEY (source_id) REFERENCES sources(id)
);

-- Indexes
CREATE INDEX idx_sources_type ON sources(source_type);
CREATE INDEX idx_sources_tags ON sources(tags);
CREATE INDEX idx_chunks_source ON chunks(source_id);
```

## Phase 1: Core Infrastructure (Day 1)

### 1.1 SQLite Setup

**File:** `skills/knowledge-base-rag/db.js`

```javascript
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = '/Volumes/reeseai-memory/data/knowledge-base/kb-rag.db';

class KnowledgeBaseDB {
  constructor() {
    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL');
    
    // Load sqlite-vec extension
    this.db.loadExtension('vec0');
  }

  initSchema() {
    // Create tables (schema above)
  }

  insertSource({ url, filePath, sourceType, title, author, tags, metadata }) {
    // Insert source, return ID
  }

  insertChunk({ sourceId, chunkIndex, text, embedding, tokenCount }) {
    // Insert chunk
  }

  insertVectorIndex({ chunkId, embedding }) {
    // Insert into vec_chunks for vector search
  }

  searchSimilar({ embedding, limit = 10, threshold = 0.7 }) {
    // Vector similarity search
    // Returns chunks ranked by cosine similarity
  }

  getSource(id) {
    // Retrieve source by ID
  }

  listSources({ type, tags, limit }) {
    // List sources with filters
  }

  deleteSource(id) {
    // Delete source and all chunks (CASCADE)
  }
}

module.exports = new KnowledgeBaseDB();
```

### 1.2 Embedding Generation

**File:** `skills/knowledge-base-rag/embeddings.js`

**Integration with LM Studio:**
- LM Studio running on http://127.0.0.1:1234
- Load `nomic-embed-text` model
- 768-dimension embeddings
- Batch processing (50 chunks at a time)

```javascript
const fetch = require('node-fetch');

const LM_STUDIO_URL = 'http://127.0.0.1:1234/v1/embeddings';

class EmbeddingGenerator {
  async generateEmbedding(text) {
    // Single text → embedding vector
    const response = await fetch(LM_STUDIO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'nomic-embed-text',
        input: text
      })
    });
    
    const data = await response.json();
    return data.data[0].embedding; // Array of 768 floats
  }

  async generateBatch(texts) {
    // Batch generate for efficiency
    // Max 50 at a time
  }
}

module.exports = new EmbeddingGenerator();
```

### 1.3 Text Chunking

**File:** `skills/knowledge-base-rag/chunker.js`

**Strategy:**
- Fixed token size: 512 tokens per chunk
- 50 token overlap between chunks (context continuity)
- Split on sentence boundaries when possible
- Track chunk index for source attribution

```javascript
class TextChunker {
  chunk(text, { chunkSize = 512, overlap = 50 } = {}) {
    // Split text into chunks
    // Return array of { text, index, tokenCount }
  }

  estimateTokens(text) {
    // Rough estimate: words * 1.3
    return Math.ceil(text.split(/\s+/).length * 1.3);
  }
}

module.exports = new TextChunker();
```

## Phase 2: File Migration (Day 1-2)

### 2.1 Scan Existing Knowledge Base

**File:** `skills/knowledge-base-rag/migrate.js`

**Process:**
1. Scan `/Volumes/reeseai-memory/data/knowledge-base/`
2. Find all PDFs and their `.extracted.md` files
3. Find all video transcript files
4. Create source records
5. Chunk text
6. Generate embeddings
7. Store in DB
8. Progress tracking (report every 10 files)

**Source Type Mapping:**
- PDF → `local_pdf` (use `.extracted.md` for text)
- Video transcript → `local_video` (use `.txt` or `.md` for text)

**Metadata extraction:**
- File name → title
- Directory → tags (e.g., `courses/six-figure-photography` → tag: `six-figure-photography`)
- File modified date → published_date

```javascript
const fs = require('fs');
const path = require('path');

async function migrateKnowledgeBase() {
  const basePath = '/Volumes/reeseai-memory/data/knowledge-base/';
  
  // Scan for files
  const files = findAllFiles(basePath);
  
  // Filter: PDFs with .extracted.md, video transcripts
  const toProcess = files.filter(f => 
    f.endsWith('.extracted.md') || 
    (f.includes('transcript') && (f.endsWith('.txt') || f.endsWith('.md')))
  );
  
  console.log(`Found ${toProcess.length} files to migrate`);
  
  for (const filePath of toProcess) {
    await processFile(filePath);
  }
}

async function processFile(filePath) {
  // 1. Read file
  const text = fs.readFileSync(filePath, 'utf-8');
  
  // 2. Extract metadata
  const title = extractTitle(filePath);
  const sourceType = determineType(filePath);
  const tags = extractTags(filePath);
  
  // 3. Insert source
  const sourceId = db.insertSource({
    filePath,
    sourceType,
    title,
    tags
  });
  
  // 4. Chunk text
  const chunks = chunker.chunk(text);
  
  // 5. Generate embeddings
  for (const chunk of chunks) {
    const embedding = await embeddings.generateEmbedding(chunk.text);
    db.insertChunk({
      sourceId,
      chunkIndex: chunk.index,
      text: chunk.text,
      embedding,
      tokenCount: chunk.tokenCount
    });
  }
  
  console.log(`✓ Processed: ${title} (${chunks.length} chunks)`);
}
```

### 2.2 Migration Progress

**Output:**
```
Migrating Knowledge Base...
Found 269 files to migrate

✓ Processed: Six Figure Photography - Module 1 (12 chunks)
✓ Processed: Matt Berman - Marketing Strategy (8 chunks)
✓ Processed: Email Sequences Deep Dive (15 chunks)
...
[Progress: 50/269 files]
...
Migration complete: 269 files → 3,847 chunks
```

## Phase 3: URL Ingestion Pipeline (Day 2)

### 3.1 URL Validation & Sanitization

**File:** `skills/knowledge-base-rag/security.js`

**Validation:**
1. URL scheme whitelist: `http://`, `https://` ONLY
2. Reject: `file://`, `ftp://`, `data:`, `javascript:`, etc.
3. Domain blacklist (optional): block malicious domains
4. Content-Type check: only text/html, application/pdf, etc.

**Sanitization (deterministic pass):**
- Regex patterns for injection attempts
- Strip tracking params (utm_*, fbclid, gclid)
- Remove metadata tags
- Normalize whitespace

**Sanitization (optional model-based pass):**
- Use a local model to scan for semantic attacks
- Flag suspicious patterns
- Human review if flagged

```javascript
class SecurityValidator {
  validateURL(url) {
    const parsed = new URL(url);
    
    // Scheme check
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error(`Invalid scheme: ${parsed.protocol}`);
    }
    
    // Optional: domain blacklist check
    // ...
    
    return true;
  }

  sanitizeContent(content, sourceType) {
    // Remove injection patterns
    content = this.stripInjectionPatterns(content);
    
    // Strip tracking params
    content = this.stripTracking(content);
    
    // Optional: model-based scan
    // if (this.detectSemanticAttack(content)) {
    //   throw new Error('Suspicious content detected');
    // }
    
    return content;
  }

  stripInjectionPatterns(text) {
    // Regex for common injection patterns
    // <script>, eval(), etc.
  }

  stripTracking(text) {
    // Remove UTM params, fbclid, etc.
  }
}

module.exports = new SecurityValidator();
```

### 3.2 Content Fetchers

**File:** `skills/knowledge-base-rag/fetchers.js`

**Supported sources:**
- Articles (HTML)
- YouTube videos (transcript)
- PDFs (download + extract)
- Twitter threads (via API or scraping)

```javascript
class ContentFetcher {
  async fetch(url) {
    const sourceType = this.detectType(url);
    
    switch (sourceType) {
      case 'article':
        return this.fetchArticle(url);
      case 'youtube':
        return this.fetchYouTube(url);
      case 'pdf':
        return this.fetchPDF(url);
      case 'tweet':
        return this.fetchTweet(url);
      default:
        throw new Error(`Unsupported source type: ${sourceType}`);
    }
  }

  detectType(url) {
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('twitter.com') || url.includes('x.com')) return 'tweet';
    if (url.endsWith('.pdf')) return 'pdf';
    return 'article';
  }

  async fetchArticle(url) {
    // Fetch HTML, parse with cheerio
    // Extract: title, author, published date, main content
  }

  async fetchYouTube(url) {
    // Use youtube-transcript library
    // Extract: title, channel, transcript
  }

  async fetchPDF(url) {
    // Download PDF, extract text
    // Use pdf-parse or existing Mistral OCR skill
  }

  async fetchTweet(url) {
    // Scrape tweet content (no API key needed)
    // Extract: author, date, text, thread if applicable
  }
}

module.exports = new ContentFetcher();
```

### 3.3 Lock File Mechanism

**File:** `skills/knowledge-base-rag/lock.js`

**Purpose:** Prevent concurrent ingestions (race conditions)

```javascript
const fs = require('fs');
const path = require('path');

const LOCK_FILE = '/Volumes/reeseai-memory/data/knowledge-base/.kb-ingest.lock';

class LockManager {
  acquire() {
    // Check if lock exists
    if (fs.existsSync(LOCK_FILE)) {
      const lockData = JSON.parse(fs.readFileSync(LOCK_FILE));
      
      // Check if owning PID is still alive
      if (this.isPIDAlive(lockData.pid)) {
        throw new Error('Ingestion already in progress');
      } else {
        // Stale lock, remove it
        fs.unlinkSync(LOCK_FILE);
      }
    }
    
    // Create lock
    fs.writeFileSync(LOCK_FILE, JSON.stringify({
      pid: process.pid,
      started: new Date().toISOString()
    }));
  }

  release() {
    if (fs.existsSync(LOCK_FILE)) {
      fs.unlinkSync(LOCK_FILE);
    }
  }

  isPIDAlive(pid) {
    try {
      process.kill(pid, 0); // Signal 0 = check if alive
      return true;
    } catch (e) {
      return false;
    }
  }
}

module.exports = new LockManager();
```

### 3.4 Ingest Command

**File:** `skills/knowledge-base-rag/ingest.js`

```javascript
const security = require('./security');
const fetcher = require('./fetchers');
const chunker = require('./chunker');
const embeddings = require('./embeddings');
const db = require('./db');
const lock = require('./lock');

async function ingestURL(url, { tags = [], metadata = {} } = {}) {
  // Acquire lock
  lock.acquire();
  
  try {
    // 1. Validate URL
    security.validateURL(url);
    
    // 2. Fetch content
    const content = await fetcher.fetch(url);
    
    // 3. Sanitize
    const clean = security.sanitizeContent(content.text, content.type);
    
    // 4. Insert source
    const sourceId = db.insertSource({
      url,
      sourceType: content.type,
      title: content.title,
      author: content.author,
      publishedDate: content.date,
      tags: JSON.stringify(tags),
      metadata: JSON.stringify(metadata)
    });
    
    // 5. Chunk
    const chunks = chunker.chunk(clean);
    
    // 6. Embed + store
    for (const chunk of chunks) {
      const embedding = await embeddings.generateEmbedding(chunk.text);
      db.insertChunk({
        sourceId,
        chunkIndex: chunk.index,
        text: chunk.text,
        embedding,
        tokenCount: chunk.tokenCount
      });
    }
    
    console.log(`✓ Ingested: ${content.title} (${chunks.length} chunks)`);
    
    return { sourceId, chunks: chunks.length };
    
  } finally {
    lock.release();
  }
}

module.exports = { ingestURL };
```

### 3.5 Bulk Ingest

**File:** `skills/knowledge-base-rag/bulk-ingest.js`

**Usage:** `node bulk-ingest.js urls.txt`

```javascript
async function bulkIngest(filePath) {
  const urls = fs.readFileSync(filePath, 'utf-8')
    .split('\n')
    .filter(line => line.trim() && !line.startsWith('#'));
  
  for (const url of urls) {
    try {
      await ingestURL(url);
    } catch (err) {
      console.error(`✗ Failed: ${url} — ${err.message}`);
    }
  }
}
```

### 3.6 Cross-Post Summary (Optional)

**File:** `skills/knowledge-base-rag/cross-post.js`

After ingesting, optionally post a summary to Telegram:

```javascript
async function crossPostSummary(sourceId) {
  const source = db.getSource(sourceId);
  
  const summary = `📚 New knowledge added to KB:
**${source.title}**
Source: ${source.url || source.file_path}
Type: ${source.source_type}
Tags: ${JSON.parse(source.tags).join(', ')}
Chunks: ${db.getChunkCount(sourceId)}`;
  
  // Send to Telegram via OpenClaw message tool
  await message({ 
    action: 'send',
    channel: 'telegram',
    message: summary
  });
}
```

## Phase 4: Query Engine (Day 3)

### 4.1 Semantic Search

**File:** `skills/knowledge-base-rag/query.js`

```javascript
async function search(query, options = {}) {
  const {
    limit = 10,
    threshold = 0.7,
    sourceType = null,
    tags = null,
    dateRange = null
  } = options;
  
  // 1. Generate query embedding
  const queryEmbedding = await embeddings.generateEmbedding(query);
  
  // 2. Vector similarity search
  const results = db.searchSimilar({
    embedding: queryEmbedding,
    limit: limit * 2, // Over-fetch for filtering
    threshold
  });
  
  // 3. Apply filters
  let filtered = results;
  
  if (sourceType) {
    filtered = filtered.filter(r => r.source_type === sourceType);
  }
  
  if (tags) {
    filtered = filtered.filter(r => {
      const sourceTags = JSON.parse(r.tags || '[]');
      return tags.some(tag => sourceTags.includes(tag));
    });
  }
  
  if (dateRange) {
    // Filter by published_date or fetched_at
  }
  
  // 4. Rank and limit
  return filtered.slice(0, limit).map(r => ({
    chunkId: r.chunk_id,
    text: r.text,
    similarity: r.similarity,
    source: {
      id: r.source_id,
      title: r.title,
      url: r.url || r.file_path,
      type: r.source_type,
      tags: JSON.parse(r.tags || '[]')
    }
  }));
}

module.exports = { search };
```

### 4.2 CLI Query Interface

**File:** `skills/knowledge-base-rag/cli-query.js`

**Usage:**
```bash
node cli-query.js "wedding photography pricing strategies"
node cli-query.js "email sequences" --type=local_video --limit=5
node cli-query.js "marketing" --tags=matt-berman,photography
```

```javascript
const { search } = require('./query');

async function main() {
  const args = process.argv.slice(2);
  const query = args[0];
  
  // Parse options from flags
  const options = parseFlags(args.slice(1));
  
  const results = await search(query, options);
  
  console.log(`\nFound ${results.length} results for: "${query}"\n`);
  
  results.forEach((r, i) => {
    console.log(`${i + 1}. [${r.similarity.toFixed(3)}] ${r.source.title}`);
    console.log(`   ${r.source.type} | ${r.source.url}`);
    console.log(`   ${r.text.substring(0, 150)}...`);
    console.log();
  });
}
```

## Phase 5: Management Commands (Day 3)

### 5.1 List Sources

**Usage:** `node manage.js list --type=youtube --tags=photography`

```javascript
function listSources(options = {}) {
  const sources = db.listSources(options);
  
  console.log(`\nKnowledge Base Sources (${sources.length})\n`);
  
  sources.forEach(s => {
    console.log(`ID: ${s.id}`);
    console.log(`Title: ${s.title}`);
    console.log(`Type: ${s.source_type}`);
    console.log(`URL: ${s.url || s.file_path}`);
    console.log(`Tags: ${JSON.parse(s.tags || '[]').join(', ')}`);
    console.log(`Chunks: ${db.getChunkCount(s.id)}`);
    console.log();
  });
}
```

### 5.2 Delete Source

**Usage:** `node manage.js delete <id>`

```javascript
function deleteSource(id) {
  const source = db.getSource(id);
  
  if (!source) {
    console.error(`Source ${id} not found`);
    return;
  }
  
  console.log(`Deleting: ${source.title}`);
  db.deleteSource(id); // CASCADE deletes chunks too
  console.log('✓ Deleted');
}
```

### 5.3 Health Check

**Usage:** `node manage.js health`

```javascript
function healthCheck() {
  console.log('Knowledge Base Health Check\n');
  
  // Check DB exists
  const dbExists = fs.existsSync(DB_PATH);
  console.log(`✓ Database: ${dbExists ? 'OK' : 'MISSING'}`);
  
  // Check vector extension loaded
  try {
    db.db.prepare('SELECT vec_version()').get();
    console.log('✓ Vector extension: OK');
  } catch (err) {
    console.log('✗ Vector extension: FAILED');
  }
  
  // Check LM Studio embedding endpoint
  try {
    await fetch('http://127.0.0.1:1234/v1/models');
    console.log('✓ LM Studio: OK');
  } catch (err) {
    console.log('✗ LM Studio: OFFLINE');
  }
  
  // Stats
  const stats = db.getStats();
  console.log(`\nSources: ${stats.sources}`);
  console.log(`Chunks: ${stats.chunks}`);
  console.log(`Avg chunks per source: ${(stats.chunks / stats.sources).toFixed(1)}`);
  
  // Check for stale locks
  if (fs.existsSync(LOCK_FILE)) {
    const lock = JSON.parse(fs.readFileSync(LOCK_FILE));
    if (!lock.isPIDAlive(lock.pid)) {
      console.log('⚠ Stale lock file detected (cleaning up)');
      fs.unlinkSync(LOCK_FILE);
    }
  }
}
```

## Skill Interface

**File:** `skills/knowledge-base-rag/SKILL.md`

```markdown
# Knowledge Base RAG

Semantic search over ingested content (URLs + local files).

## Commands

### Ingest URL
node ingest.js <url> [--tags=tag1,tag2]

### Bulk Ingest
node bulk-ingest.js urls.txt

### Query
node cli-query.js "your query" [--type=youtube] [--tags=photography] [--limit=10]

### Migrate Existing Files (one-time)
node migrate.js

### Management
node manage.js list [--type=pdf] [--tags=marketing]
node manage.js delete <source-id>
node manage.js health

## Agent Usage

Use `exec` to run commands:
exec({ command: 'node /path/to/knowledge-base-rag/cli-query.js "wedding pricing"' })

Results come back as JSON or formatted text.
```

## Deliverables

- [ ] SQLite database with vector extension
- [ ] Embedding generation via LM Studio (nomic-embed-text)
- [ ] Text chunking algorithm
- [ ] URL ingestion pipeline with security validation
- [ ] File migration script (269 existing files → DB)
- [ ] Query engine with semantic search
- [ ] Filters: source type, tags, date range
- [ ] Management commands: list, delete, health check
- [ ] Lock file mechanism
- [ ] Cross-post summaries (optional)
- [ ] CLI interfaces for all operations
- [ ] SKILL.md documentation
- [ ] Git commit: "feat: knowledge-base-rag system"

## Testing

1. **Migration test:**
   - Run `node migrate.js`
   - Verify 269 sources ingested
   - Check chunk count (~3,000-5,000 expected)

2. **URL ingest test:**
   - Ingest a YouTube video
   - Ingest a blog article
   - Ingest a PDF
   - Verify chunks created

3. **Query test:**
   - Search "wedding photography pricing"
   - Verify results come from multiple sources
   - Test filters (type, tags)

4. **Security test:**
   - Try `file://` URL (should reject)
   - Try URL with injection patterns (should sanitize)

5. **Concurrent test:**
   - Run two ingest commands simultaneously
   - Verify lock prevents race condition

## Notes

- **One-time migration:** 269 files will take ~30-60 minutes to embed (depends on LM Studio speed)
- **Embedding dimensions:** 768 for nomic-embed-text (not configurable, hardcoded in model)
- **Chunking strategy:** 512 tokens with 50 token overlap is a good starting point, can be tuned
- **Vector search:** SQLite-vec uses cosine similarity by default (good for text embeddings)
- **Stale locks:** Health check automatically cleans up if owning PID is dead
- **Cross-posting:** Optional feature, disable if Tyler doesn't want summaries in Telegram

## Cost Consciousness

- **Zero API costs:** All embeddings generated locally via LM Studio
- **Efficient storage:** SQLite single-file DB, easy to backup
- **Batch embeddings:** Process 50 chunks at a time to reduce overhead
- **No redundant re-embedding:** Check if source already exists before ingesting
- **Lock file prevents wasted work:** No duplicate ingestions

## Future Enhancements

After initial build:
- Web UI for browsing/searching (integrate into Mission Control)
- Auto-tagging via local LLM
- Scheduled re-indexing for updated content
- Export search results to markdown
- Integration with agent workflows (auto-query KB during research tasks)
