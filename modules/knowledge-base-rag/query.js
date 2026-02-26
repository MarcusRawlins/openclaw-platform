const KnowledgeBaseDB = require('./db');
const EmbeddingsClient = require('./embeddings');
const config = require('./config.json');

class QueryEngine {
  constructor() {
    this.db = new KnowledgeBaseDB();
    this.embeddings = new EmbeddingsClient();
  }

  // Vector similarity search (cosine similarity)
  async searchVectors(queryText, options = {}) {
    const limit = options.limit || 10;
    const sourceType = options.source_type;
    const tags = options.tags;

    // Generate embedding for query
    const queryEmbedding = await this.embeddings.embed(queryText);

    // Get all chunks
    const chunks = this.db.db
      .prepare(`
        SELECT c.id, c.text, c.token_count, s.title, s.source_type, s.url, s.file_path, s.tags
        FROM chunks c
        JOIN sources s ON c.source_id = s.id
        ${sourceType ? 'WHERE s.source_type = ?' : ''}
      `)
      .all(...(sourceType ? [sourceType] : []));

    // Calculate similarity scores
    const scores = chunks.map(chunk => {
      const chunkEmbedding = EmbeddingsClient.bufferToEmbedding(chunk.embedding);
      const similarity = EmbeddingsClient.cosineSimilarity(queryEmbedding, chunkEmbedding);

      return {
        ...chunk,
        similarity_score: similarity
      };
    });

    // Filter by tags if specified
    let filtered = scores;
    if (tags && tags.length > 0) {
      filtered = scores.filter(chunk => {
        if (!chunk.tags) return false;
        const chunkTags = JSON.parse(chunk.tags);
        return tags.some(tag => chunkTags.includes(tag));
      });
    }

    // Sort by similarity and return top results
    return filtered
      .sort((a, b) => b.similarity_score - a.similarity_score)
      .slice(0, limit)
      .map(result => ({
        id: result.id,
        text: result.text.substring(0, 500),
        full_text: result.text,
        similarity: result.similarity_score.toFixed(4),
        source: {
          title: result.title,
          type: result.source_type,
          url: result.url,
          file_path: result.file_path
        },
        tokens: result.token_count
      }));
  }

  // Simple keyword search
  searchKeywords(query, options = {}) {
    const limit = options.limit || 10;
    const sourceType = options.source_type;

    let sql = `
      SELECT c.id, c.text, s.title, s.source_type, s.url, s.file_path
      FROM chunks c
      JOIN sources s ON c.source_id = s.id
      WHERE c.text LIKE ? OR s.title LIKE ?
    `;

    const params = [`%${query}%`, `%${query}%`];

    if (sourceType) {
      sql += ' AND s.source_type = ?';
      params.push(sourceType);
    }

    sql += ` LIMIT ${limit}`;

    const results = this.db.db.prepare(sql).all(...params);

    return results.map(result => ({
      id: result.id,
      text: result.text.substring(0, 500),
      source: {
        title: result.title,
        type: result.source_type,
        url: result.url,
        file_path: result.file_path
      }
    }));
  }

  // Hybrid search (vector + keyword)
  async searchHybrid(query, options = {}) {
    const vectorResults = await this.searchVectors(query, options);
    const keywordResults = this.searchKeywords(query, options);

    // Combine and deduplicate, preferring vector results
    const seen = new Set();
    const combined = [];

    vectorResults.forEach(result => {
      seen.add(result.id);
      combined.push({ ...result, search_type: 'vector' });
    });

    keywordResults.forEach(result => {
      if (!seen.has(result.id)) {
        combined.push({ ...result, search_type: 'keyword' });
      }
    });

    return combined.slice(0, options.limit || 10);
  }

  // Search by source type
  searchByType(sourceType, options = {}) {
    const limit = options.limit || 20;

    const sources = this.db.db
      .prepare(`
        SELECT DISTINCT s.*, COUNT(c.id) as chunk_count
        FROM sources s
        LEFT JOIN chunks c ON s.id = c.source_id
        WHERE s.source_type = ?
        GROUP BY s.id
        ORDER BY s.fetched_at DESC
        LIMIT ?
      `)
      .all(sourceType, limit);

    return sources.map(source => ({
      id: source.id,
      title: source.title,
      type: source.source_type,
      url: source.url,
      file_path: source.file_path,
      chunks: source.chunk_count,
      fetched_at: source.fetched_at,
      tags: source.tags ? JSON.parse(source.tags) : []
    }));
  }

  // Get source details with chunks
  getSourceDetails(sourceId) {
    const source = this.db.getSource(sourceId);
    if (!source) return null;

    const chunks = this.db.getChunksBySource(sourceId);
    const history = this.db.getIngestionHistory(sourceId);

    return {
      id: source.id,
      title: source.title,
      type: source.source_type,
      url: source.url,
      file_path: source.file_path,
      author: source.author,
      published_date: source.published_date,
      fetched_at: source.fetched_at,
      tags: source.tags ? JSON.parse(source.tags) : [],
      metadata: source.metadata ? JSON.parse(source.metadata) : {},
      chunk_count: chunks.length,
      chunks: chunks.map(c => ({
        id: c.id,
        index: c.chunk_index,
        text: c.text.substring(0, 200) + '...',
        full_text: c.text,
        tokens: c.token_count
      })),
      ingestion_history: history
    };
  }

  // Browse by tags
  searchByTags(tags, options = {}) {
    const limit = options.limit || 20;

    // Since tags is stored as JSON, this is a bit tricky
    // We'll do a LIKE search on the JSON string
    const tagPatterns = tags.map(tag => `"%${tag}%"`).join(' OR tags LIKE ');
    const query = `tags LIKE ${tags.map(() => '?').join(' OR tags LIKE ')}`;

    const sources = this.db.db
      .prepare(`
        SELECT DISTINCT s.*, COUNT(c.id) as chunk_count
        FROM sources s
        LEFT JOIN chunks c ON s.id = c.source_id
        WHERE ${query}
        GROUP BY s.id
        ORDER BY s.fetched_at DESC
        LIMIT ?
      `)
      .all(...tags, limit);

    return sources.map(source => ({
      id: source.id,
      title: source.title,
      type: source.source_type,
      chunks: source.chunk_count,
      tags: source.tags ? JSON.parse(source.tags) : []
    }));
  }

  // Get statistics
  getStats() {
    return this.db.getStats();
  }

  close() {
    this.db.close();
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Usage:
  node query.js "search query" [--type <type>] [--limit <n>] [--method vector|keyword|hybrid]
  node query.js --list-types
  node query.js --stats
  node query.js --source <id>
  
Options:
  --type <type>      Filter by source type (article, youtube, pdf, etc)
  --limit <n>        Number of results (default 10)
  --method <method>  Search method: vector, keyword, or hybrid (default hybrid)
  --tags <tags>      Filter by comma-separated tags
    `);
    process.exit(1);
  }

  const engine = new QueryEngine();

  (async () => {
    try {
      let method = 'hybrid';
      let limit = 10;
      let sourceType;
      let tags;
      let sourceId;
      let query = '';

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--method' && i + 1 < args.length) method = args[++i];
        if (args[i] === '--limit' && i + 1 < args.length) limit = parseInt(args[++i]);
        if (args[i] === '--type' && i + 1 < args.length) sourceType = args[++i];
        if (args[i] === '--tags' && i + 1 < args.length)
          tags = args[++i].split(',').map(t => t.trim());
        if (args[i] === '--source' && i + 1 < args.length) sourceId = parseInt(args[++i]);
        if (args[i] === '--stats') {
          console.log(JSON.stringify(engine.getStats(), null, 2));
          process.exit(0);
        }
        if (args[i] === '--list-types') {
          const stats = engine.getStats();
          console.log('Available source types:');
          ['article', 'youtube', 'pdf', 'tweet', 'local_pdf', 'local_video', 'local_markdown'].forEach(
            type => {
              console.log(`  - ${type}`);
            }
          );
          process.exit(0);
        }
        if (!args[i].startsWith('--')) {
          query = args[i];
        }
      }

      if (sourceId) {
        const details = engine.getSourceDetails(sourceId);
        console.log(JSON.stringify(details, null, 2));
      } else if (query) {
        let results;
        if (method === 'vector') {
          results = await engine.searchVectors(query, { limit, source_type: sourceType, tags });
        } else if (method === 'keyword') {
          results = engine.searchKeywords(query, { limit, source_type: sourceType });
        } else {
          results = await engine.searchHybrid(query, { limit, source_type: sourceType, tags });
        }

        console.log(`\n${results.length} results found:\n`);
        results.forEach((result, index) => {
          console.log(`${index + 1}. ${result.source?.title || 'Untitled'}`);
          if (result.similarity) console.log(`   Similarity: ${result.similarity}`);
          console.log(`   Type: ${result.source?.type}`);
          console.log(`   ${result.text}`);
          console.log();
        });
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    } finally {
      engine.close();
    }
  })();
}

module.exports = QueryEngine;
