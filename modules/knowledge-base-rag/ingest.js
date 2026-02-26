const fs = require('fs');
const path = require('path');
const KnowledgeBaseDB = require('./db');
const EmbeddingsClient = require('./embeddings');
const TextChunker = require('./chunking');
const SecurityValidator = require('./security');
const ContentFetchers = require('./fetchers');
const config = require('./config.json');

class Ingester {
  constructor() {
    this.db = null;
    this.embeddings = new EmbeddingsClient();
    this.chunker = new TextChunker();
    this.security = new SecurityValidator();
    this.lock_file = config.ingestion.lock_file;
  }

  async initialize() {
    this.db = new KnowledgeBaseDB();
    await this.db.initialize();
    return this;
  }

  // Lock file for preventing concurrent ingestion
  acquireLock(timeoutMs = config.ingestion.lock_timeout_ms) {
    const startTime = Date.now();
    while (fs.existsSync(this.lock_file)) {
      if (Date.now() - startTime > timeoutMs) {
        throw new Error(
          `Could not acquire lock within ${timeoutMs}ms. Another ingestion may be in progress.`
        );
      }
      // Wait 100ms before checking again
      const dfd = new Promise(resolve => setTimeout(resolve, 100));
    }

    fs.writeFileSync(this.lock_file, JSON.stringify({ pid: process.pid, time: new Date() }));
  }

  releaseLock() {
    try {
      fs.unlinkSync(this.lock_file);
    } catch (error) {
      console.warn('Failed to release lock:', error.message);
    }
  }

  async ingestUrl(url, sourceType = 'article', options = {}) {
    this.acquireLock();

    try {
      console.log(`\n[${new Date().toISOString()}] Ingesting URL: ${url}`);

      // Validate URL
      const urlValidation = this.security.validateUrl(url);
      if (!urlValidation.valid) {
        throw new Error(urlValidation.error);
      }

      // Fetch content
      const fetchData = await ContentFetchers.fetch(url, sourceType);

      // Check for injection
      const injectionCheck = this.security.detectInjection(fetchData.content);
      if (injectionCheck.suspicious) {
        throw new Error(
          `Potential security issue: ${injectionCheck.patterns_found} suspicious patterns detected`
        );
      }

      // Sanitize content
      fetchData.content = this.security.sanitizeContent(fetchData.content);

      // Chunk the content
      const chunks = this.chunker.chunk(fetchData.content);
      if (chunks.length === 0) {
        throw new Error('No content extracted from URL');
      }

      // Validate chunks
      const chunkValidation = this.security.validateChunkCount(chunks);
      if (!chunkValidation.valid) {
        throw new Error(chunkValidation.error);
      }

      // Add source to database
      const sourceId = await this.db.addSource({
        url: url,
        source_type: sourceType,
        title: fetchData.title,
        author: fetchData.author,
        published_date: fetchData.published_date,
        tags: options.tags,
        metadata: fetchData.metadata
      });

      if (sourceId === null) {
        console.log('Source already exists in database');
        return { status: 'skipped', message: 'Source already exists' };
      }

      // Log ingestion start
      const logId = await this.db.logIngestionStart(sourceId);

      // Generate embeddings and store chunks
      const embeddingResults = await this.embeddings.embedBatch(chunks.map(c => c.text));

      if (embeddingResults.failed_count > 0) {
        console.warn(`Warning: Failed to embed ${embeddingResults.failed_count} chunks`);
      }

      // Prepare chunks with embeddings
      const chunksWithEmbeddings = chunks
        .map((chunk, index) => {
          const embedding = embeddingResults.embeddings[index];
          if (!embedding) return null;

          return {
            text: chunk.text,
            embedding: EmbeddingsClient.embeddingToBuffer(embedding),
            token_count: chunk.token_count
          };
        })
        .filter(c => c !== null);

      // Store chunks
      const storedCount = await this.db.addChunks(sourceId, chunksWithEmbeddings);

      // Log success
      await this.db.logIngestionSuccess(logId, storedCount);

      const result = {
        status: 'success',
        source_id: sourceId,
        chunks_created: storedCount,
        title: fetchData.title,
        message: `Successfully ingested ${storedCount} chunks`
      };

      console.log(`✓ ${result.message}`);
      return result;
    } catch (error) {
      console.error(`✗ Ingestion failed: ${error.message}`);
      return {
        status: 'failed',
        error: error.message
      };
    } finally {
      this.releaseLock();
    }
  }

  async ingestLocalFile(filePath, options = {}) {
    this.acquireLock();

    try {
      console.log(`\n[${new Date().toISOString()}] Ingesting file: ${filePath}`);

      // Fetch file content
      const fetchData = await ContentFetchers.fetchLocalFile(filePath);

      // Chunk the content
      const chunks = this.chunker.chunkByStructure(fetchData.content);
      if (chunks.length === 0) {
        throw new Error('No content extracted from file');
      }

      // Add source to database
      const sourceId = await this.db.addSource({
        file_path: filePath,
        source_type: fetchData.source_type,
        title: fetchData.title,
        tags: options.tags,
        metadata: fetchData.metadata
      });

      if (sourceId === null) {
        console.log('Source already exists in database');
        return { status: 'skipped', message: 'Source already exists' };
      }

      // Log ingestion start
      const logId = await this.db.logIngestionStart(sourceId);

      // Generate embeddings
      const embeddingResults = await this.embeddings.embedBatch(chunks.map(c => c.text));

      if (embeddingResults.failed_count > 0) {
        console.warn(`Warning: Failed to embed ${embeddingResults.failed_count} chunks`);
      }

      // Prepare chunks with embeddings
      const chunksWithEmbeddings = chunks
        .map((chunk, index) => {
          const embedding = embeddingResults.embeddings[index];
          if (!embedding) return null;

          return {
            text: chunk.text,
            embedding: EmbeddingsClient.embeddingToBuffer(embedding),
            token_count: chunk.token_count
          };
        })
        .filter(c => c !== null);

      // Store chunks
      const storedCount = await this.db.addChunks(sourceId, chunksWithEmbeddings);

      // Log success
      await this.db.logIngestionSuccess(logId, storedCount);

      const result = {
        status: 'success',
        source_id: sourceId,
        chunks_created: storedCount,
        title: fetchData.title,
        message: `Successfully ingested ${storedCount} chunks`
      };

      console.log(`✓ ${result.message}`);
      return result;
    } catch (error) {
      console.error(`✗ Ingestion failed: ${error.message}`);
      return {
        status: 'failed',
        error: error.message
      };
    } finally {
      this.releaseLock();
    }
  }

  async ingestBatch(items, options = {}) {
    const results = {
      total: items.length,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      details: []
    };

    for (const item of items) {
      let result;

      if (item.url) {
        result = await this.ingestUrl(item.url, item.type || 'article', options);
      } else if (item.file_path) {
        result = await this.ingestLocalFile(item.file_path, options);
      } else {
        result = { status: 'failed', error: 'Missing url or file_path' };
      }

      results.details.push(result);

      if (result.status === 'success') results.succeeded++;
      else if (result.status === 'failed') results.failed++;
      else if (result.status === 'skipped') results.skipped++;
    }

    return results;
  }

  async close() {
    if (this.db) await this.db.close();
  }
}

// CLI Usage
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Usage:
  node ingest.js --url <url> [--type <type>]
  node ingest.js --file <path> [--type <type>]
  
Options:
  --url <url>        URL to ingest
  --file <path>      Local file path
  --type <type>      Source type (article, youtube, pdf, tweet, local_markdown)
  --tags <tags>      Comma-separated tags
    `);
    process.exit(1);
  }

  (async () => {
    const ingester = await new Ingester().initialize();
    try {
      let url, file, type, tags;

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--url' && i + 1 < args.length) url = args[++i];
        if (args[i] === '--file' && i + 1 < args.length) file = args[++i];
        if (args[i] === '--type' && i + 1 < args.length) type = args[++i];
        if (args[i] === '--tags' && i + 1 < args.length)
          tags = args[++i].split(',').map(t => t.trim());
      }

      const options = { tags };

      if (url) {
        const result = await ingester.ingestUrl(url, type || 'article', options);
        console.log(JSON.stringify(result, null, 2));
      } else if (file) {
        const result = await ingester.ingestLocalFile(file, options);
        console.log(JSON.stringify(result, null, 2));
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    } finally {
      await ingester.close();
    }
  })();
}

module.exports = Ingester;
