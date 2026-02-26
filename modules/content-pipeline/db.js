const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const config = require('./config.json');

const DB_PATH = config.database.path;

// Promise wrappers for sqlite3
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

class ContentPipelineDB {
  constructor() {
    // Ensure directory exists
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new sqlite3.Database(DB_PATH);
    this.db.configure('busyTimeout', 10000);
  }

  async initialize() {
    await this.initializeSchema();
    return this;
  }

  async initializeSchema() {
    // Enable foreign keys
    await runAsync(this.db, 'PRAGMA foreign_keys = ON');

    // Content ideas table
    await runAsync(
      this.db,
      `
      CREATE TABLE IF NOT EXISTS content_ideas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        suggested_by TEXT,
        suggested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        status TEXT DEFAULT 'proposed' CHECK(status IN ('proposed', 'accepted', 'rejected', 'in_progress', 'produced', 'duplicate')),
        accepted_at TIMESTAMP,
        rejected_at TIMESTAMP,
        produced_at TIMESTAMP,
        
        platform TEXT,
        content_type TEXT,
        target_audience TEXT,
        suggested_outline TEXT,
        
        embedding BLOB,
        duplicate_of INTEGER,
        similarity_score REAL,
        
        kb_sources TEXT,
        social_sources TEXT,
        
        task_id TEXT,
        content_id INTEGER,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (duplicate_of) REFERENCES content_ideas(id)
      )
    `
    );

    // Idea searches table
    await runAsync(
      this.db,
      `
      CREATE TABLE IF NOT EXISTS idea_searches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query TEXT NOT NULL,
        kb_results INTEGER DEFAULT 0,
        social_results INTEGER DEFAULT 0,
        duplicate_found BOOLEAN DEFAULT 0,
        duplicate_id INTEGER,
        searched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (duplicate_id) REFERENCES content_ideas(id)
      )
    `
    );

    // Indexes
    await runAsync(this.db, 'CREATE INDEX IF NOT EXISTS idx_ideas_status ON content_ideas(status)');
    await runAsync(this.db, 'CREATE INDEX IF NOT EXISTS idx_ideas_platform ON content_ideas(platform)');
    await runAsync(
      this.db,
      'CREATE INDEX IF NOT EXISTS idx_ideas_suggested_at ON content_ideas(suggested_at DESC)'
    );
    await runAsync(this.db, 'CREATE INDEX IF NOT EXISTS idx_searches_query ON idea_searches(query)');
    await runAsync(
      this.db,
      'CREATE INDEX IF NOT EXISTS idx_searches_date ON idea_searches(searched_at DESC)'
    );
  }

  // Idea operations
  async insertIdea(ideaData) {
    const result = await runAsync(
      this.db,
      `
      INSERT INTO content_ideas (
        title, description, suggested_by, platform, content_type, 
        target_audience, suggested_outline, embedding, 
        kb_sources, social_sources, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        ideaData.title,
        ideaData.description,
        ideaData.suggested_by || null,
        ideaData.platform || null,
        ideaData.content_type || null,
        ideaData.target_audience || null,
        ideaData.suggested_outline || null,
        ideaData.embedding || null,
        ideaData.kb_sources || null,
        ideaData.social_sources || null,
        'proposed'
      ]
    );
    return result.id;
  }

  async getIdea(ideaId) {
    return await getAsync(this.db, 'SELECT * FROM content_ideas WHERE id = ?', [ideaId]);
  }

  async getAllIdeas(status = null, limit = 50) {
    if (status) {
      return await allAsync(
        this.db,
        'SELECT * FROM content_ideas WHERE status = ? ORDER BY suggested_at DESC LIMIT ?',
        [status, limit]
      );
    }
    return await allAsync(this.db, 'SELECT * FROM content_ideas ORDER BY suggested_at DESC LIMIT ?', [limit]);
  }

  async updateIdea(ideaId, updates) {
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }

    values.push(new Date().toISOString()); // updated_at
    fields.push('updated_at = ?');

    await runAsync(
      this.db,
      `UPDATE content_ideas SET ${fields.join(', ')} WHERE id = ?`,
      [...values, ideaId]
    );
  }

  async markAsDuplicate(ideaId, duplicateOfId, similarityScore) {
    await this.updateIdea(ideaId, {
      status: 'duplicate',
      duplicate_of: duplicateOfId,
      similarity_score: similarityScore,
      rejected_at: new Date().toISOString()
    });
  }

  async acceptIdea(ideaId) {
    await this.updateIdea(ideaId, {
      status: 'accepted',
      accepted_at: new Date().toISOString()
    });
  }

  async rejectIdea(ideaId) {
    await this.updateIdea(ideaId, {
      status: 'rejected',
      rejected_at: new Date().toISOString()
    });
  }

  async markAsProduced(ideaId, contentId) {
    await this.updateIdea(ideaId, {
      status: 'produced',
      content_id: contentId,
      produced_at: new Date().toISOString()
    });
  }

  // Search operations
  async getIdeasByStatus(status) {
    return await allAsync(
      this.db,
      'SELECT * FROM content_ideas WHERE status = ? ORDER BY suggested_at DESC',
      [status]
    );
  }

  async findSimilarIdeas(limit = 20) {
    return await allAsync(
      this.db,
      'SELECT * FROM content_ideas WHERE status != "rejected" AND status != "duplicate" ORDER BY suggested_at DESC LIMIT ?',
      [limit]
    );
  }

  // Search log operations
  async logIdeaSearch(query, kbResults, socialResults, isDuplicate = false, duplicateId = null) {
    await runAsync(
      this.db,
      `
      INSERT INTO idea_searches (query, kb_results, social_results, duplicate_found, duplicate_id)
      VALUES (?, ?, ?, ?, ?)
    `,
      [query, kbResults, socialResults, isDuplicate ? 1 : 0, duplicateId || null]
    );
  }

  async getSearchHistory(limit = 50) {
    return await allAsync(
      this.db,
      'SELECT * FROM idea_searches ORDER BY searched_at DESC LIMIT ?',
      [limit]
    );
  }

  // Statistics
  async getStats() {
    const total = await getAsync(this.db, 'SELECT COUNT(*) as count FROM content_ideas');
    const byStatus = await allAsync(
      this.db,
      'SELECT status, COUNT(*) as count FROM content_ideas GROUP BY status'
    );
    const searches = await getAsync(this.db, 'SELECT COUNT(*) as count FROM idea_searches');
    const duplicates = await getAsync(
      this.db,
      'SELECT COUNT(*) as count FROM content_ideas WHERE status = "duplicate"'
    );

    const statusMap = {};
    for (const row of byStatus) {
      statusMap[row.status] = row.count;
    }

    return {
      total_ideas: total ? total.count : 0,
      by_status: statusMap,
      total_searches: searches ? searches.count : 0,
      duplicates_detected: duplicates ? duplicates.count : 0
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

module.exports = ContentPipelineDB;
