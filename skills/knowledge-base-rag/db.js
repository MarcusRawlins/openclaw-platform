const sqlite3 = require('sqlite3').verbose();
const sqliteVec = require('sqlite-vec');
const path = require('path');
const fs = require('fs');
const config = require('./config.json');

const DB_PATH = config.database.path;

// Promise wrapper for sqlite3
function runAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function getAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

class KnowledgeBaseDB {
  constructor() {
    // Ensure directory exists
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new sqlite3.Database(DB_PATH);
    this.db.configure('busyTimeout', 10000);
    
    // Load sqlite-vec extension
    try {
      sqliteVec.load(this.db);
    } catch (err) {
      console.warn('Warning: Could not load sqlite-vec extension:', err.message);
    }
  }

  async initialize() {
    await this.initializeSchema();
    return this;
  }

  async initializeSchema() {
    // Enable foreign keys
    await runAsync(this.db, 'PRAGMA foreign_keys = ON');

    // Sources table
    await runAsync(
      this.db,
      `
      CREATE TABLE IF NOT EXISTS sources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT,
        file_path TEXT,
        source_type TEXT NOT NULL CHECK(source_type IN ('article', 'youtube', 'pdf', 'tweet', 'local_pdf', 'local_video', 'local_markdown')),
        title TEXT,
        author TEXT,
        published_date TEXT,
        fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        tags TEXT,
        metadata TEXT,
        UNIQUE(url),
        UNIQUE(file_path)
      )
    `
    );

    // Chunks table
    await runAsync(
      this.db,
      `
      CREATE TABLE IF NOT EXISTS chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id INTEGER NOT NULL,
        chunk_index INTEGER NOT NULL,
        text TEXT NOT NULL,
        embedding BLOB NOT NULL,
        token_count INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
        UNIQUE(source_id, chunk_index)
      )
    `
    );

    // Ingestion log
    await runAsync(
      this.db,
      `
      CREATE TABLE IF NOT EXISTS ingestion_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id INTEGER,
        status TEXT CHECK(status IN ('success', 'failed', 'skipped')),
        error_message TEXT,
        chunks_created INTEGER DEFAULT 0,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
      )
    `
    );

    // Indexes
    await runAsync(this.db, 'CREATE INDEX IF NOT EXISTS idx_sources_type ON sources(source_type)');
    await runAsync(this.db, 'CREATE INDEX IF NOT EXISTS idx_sources_tags ON sources(tags)');
    await runAsync(this.db, 'CREATE INDEX IF NOT EXISTS idx_chunks_source ON chunks(source_id)');
    await runAsync(this.db, 'CREATE INDEX IF NOT EXISTS idx_ingestion_log_source ON ingestion_log(source_id)');
    await runAsync(this.db, 'CREATE INDEX IF NOT EXISTS idx_ingestion_log_status ON ingestion_log(status)');
  }

  // Source operations
  async addSource(sourceData) {
    try {
      const result = await runAsync(
        this.db,
        `
        INSERT INTO sources (url, file_path, source_type, title, author, published_date, tags, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          sourceData.url || null,
          sourceData.file_path || null,
          sourceData.source_type,
          sourceData.title || null,
          sourceData.author || null,
          sourceData.published_date || null,
          sourceData.tags ? JSON.stringify(sourceData.tags) : null,
          sourceData.metadata ? JSON.stringify(sourceData.metadata) : null
        ]
      );
      return result.id;
    } catch (error) {
      if (error.message.includes('UNIQUE')) {
        return null; // Source already exists
      }
      throw error;
    }
  }

  async getSource(sourceId) {
    return await getAsync(this.db, 'SELECT * FROM sources WHERE id = ?', [sourceId]);
  }

  async getAllSources() {
    return await allAsync(this.db, 'SELECT * FROM sources ORDER BY fetched_at DESC');
  }

  async deleteSource(sourceId) {
    const result = await runAsync(this.db, 'DELETE FROM sources WHERE id = ?', [sourceId]);
    return result.changes > 0;
  }

  // Chunk operations
  async addChunks(sourceId, chunks) {
    let count = 0;
    for (let i = 0; i < chunks.length; i++) {
      try {
        await runAsync(
          this.db,
          `
          INSERT INTO chunks (source_id, chunk_index, text, embedding, token_count)
          VALUES (?, ?, ?, ?, ?)
        `,
          [sourceId, i, chunks[i].text, chunks[i].embedding, chunks[i].token_count]
        );
        count++;
      } catch (error) {
        console.error(`Failed to insert chunk ${i}:`, error.message);
      }
    }
    return count;
  }

  async getChunksBySource(sourceId) {
    return await allAsync(
      this.db,
      `
      SELECT * FROM chunks WHERE source_id = ? ORDER BY chunk_index
    `,
      [sourceId]
    );
  }

  async getChunkCount(sourceId) {
    const result = await getAsync(this.db, 'SELECT COUNT(*) as count FROM chunks WHERE source_id = ?', [
      sourceId
    ]);
    return result ? result.count : 0;
  }

  // Search
  async searchByContent(query, limit = 10) {
    const searchTerm = `%${query}%`;
    return await allAsync(
      this.db,
      `
      SELECT c.*, s.title, s.source_type, s.url, s.file_path
      FROM chunks c
      JOIN sources s ON c.source_id = s.id
      WHERE c.text LIKE ? OR s.title LIKE ?
      ORDER BY c.created_at DESC
      LIMIT ?
    `,
      [searchTerm, searchTerm, limit]
    );
  }

  // Vector similarity search using sqlite-vec
  async searchByVector(queryEmbedding, limit = 10) {
    try {
      // Use vec_distance_cosine for cosine similarity
      // Lower distance = higher similarity
      return await allAsync(
        this.db,
        `
        SELECT c.*, s.title, s.source_type, s.url, s.file_path,
               vec_distance_cosine(c.embedding, vec(?)) as distance,
               (1 - vec_distance_cosine(c.embedding, vec(?))) as similarity
        FROM chunks c
        JOIN sources s ON c.source_id = s.id
        ORDER BY distance ASC
        LIMIT ?
      `,
        [queryEmbedding, queryEmbedding, limit]
      );
    } catch (err) {
      console.error('Vector search failed:', err.message);
      // Fallback to text search
      return await this.searchByContent('', limit);
    }
  }

  // Hybrid search (vector + keyword)
  async searchHybrid(queryEmbedding, queryText, limit = 10) {
    try {
      // Combine vector similarity with text relevance
      const searchTerm = `%${queryText}%`;
      return await allAsync(
        this.db,
        `
        SELECT c.*, s.title, s.source_type, s.url, s.file_path,
               vec_distance_cosine(c.embedding, vec(?)) as vector_distance,
               (1 - vec_distance_cosine(c.embedding, vec(?))) as vector_similarity,
               CASE WHEN c.text LIKE ? OR s.title LIKE ? THEN 0.2 ELSE 0 END as text_match
        FROM chunks c
        JOIN sources s ON c.source_id = s.id
        ORDER BY (vector_distance * 0.7 - text_match) ASC
        LIMIT ?
      `,
        [queryEmbedding, queryEmbedding, searchTerm, searchTerm, limit]
      );
    } catch (err) {
      console.error('Hybrid search failed:', err.message);
      // Fallback to vector search only
      return await this.searchByVector(queryEmbedding, limit);
    }
  }

  // Ingestion log operations
  async logIngestionStart(sourceId) {
    const result = await runAsync(
      this.db,
      `
      INSERT INTO ingestion_log (source_id, started_at)
      VALUES (?, CURRENT_TIMESTAMP)
    `,
      [sourceId]
    );
    return result.id;
  }

  async logIngestionSuccess(logId, chunkCount) {
    await runAsync(
      this.db,
      `
      UPDATE ingestion_log
      SET status = 'success', chunks_created = ?, completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
      [chunkCount, logId]
    );
  }

  async logIngestionError(logId, errorMessage) {
    await runAsync(
      this.db,
      `
      UPDATE ingestion_log
      SET status = 'failed', error_message = ?, completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
      [errorMessage, logId]
    );
  }

  async getIngestionHistory(sourceId) {
    return await allAsync(
      this.db,
      `
      SELECT * FROM ingestion_log WHERE source_id = ? ORDER BY started_at DESC
    `,
      [sourceId]
    );
  }

  // Statistics
  async getStats() {
    const sources = await getAsync(this.db, 'SELECT COUNT(*) as count FROM sources');
    const chunks = await getAsync(this.db, 'SELECT COUNT(*) as count FROM chunks');
    const succeeded = await getAsync(this.db, 'SELECT COUNT(*) as count FROM ingestion_log WHERE status = "success"');
    const failed = await getAsync(this.db, 'SELECT COUNT(*) as count FROM ingestion_log WHERE status = "failed"');

    return {
      total_sources: sources ? sources.count : 0,
      total_chunks: chunks ? chunks.count : 0,
      ingestions_succeeded: succeeded ? succeeded.count : 0,
      ingestions_failed: failed ? failed.count : 0
    };
  }

  // Utility
  async close() {
    return new Promise((resolve, reject) => {
      this.db.close(err => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

module.exports = KnowledgeBaseDB;
