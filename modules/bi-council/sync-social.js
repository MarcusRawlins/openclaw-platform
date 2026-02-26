#!/usr/bin/env node

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DATA_DIR = '/Volumes/reeseai-memory/data/bi-council';
const SOCIAL_DB = path.join(DATA_DIR, 'social.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

class SocialSync {
  constructor() {
    this.db = new Database(SOCIAL_DB);
    this.initSchema();
  }

  initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS platform_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        platform TEXT,
        metric_type TEXT,
        metric_value REAL,
        period_date TEXT,
        synced_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(platform, metric_type, period_date)
      );

      CREATE TABLE IF NOT EXISTS content_performance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content_id TEXT,
        platform TEXT,
        title TEXT,
        published_at TEXT,
        views INTEGER,
        likes INTEGER,
        comments INTEGER,
        shares INTEGER,
        engagement_rate REAL,
        snapshot_date TEXT,
        synced_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_content_platform ON content_performance(platform);
      CREATE INDEX IF NOT EXISTS idx_content_date ON content_performance(published_at);
      CREATE INDEX IF NOT EXISTS idx_platform_metrics ON platform_metrics(platform, period_date);
    `);
  }

  // Simulate social analytics sync (in production, would fetch from Meta/TikTok APIs)
  sync() {
    console.log('📊 Syncing social analytics (placeholder)...');

    // For now, this is a stub. In production:
    // 1. Fetch platform metrics from Meta Graph API (Instagram/Facebook)
    // 2. Fetch TikTok metrics from TikTok API
    // 3. Fetch content performance from analytics platforms
    // 4. Upsert into database

    console.log('  ℹ Social sync: Waiting for API integrations (Meta, TikTok, YouTube)');
    return 0;
  }

  getGrowthTrends(platform, days = 7) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    return this.db.prepare(`
      SELECT 
        metric_type,
        MIN(metric_value) as start_value,
        MAX(metric_value) as end_value,
        (MAX(metric_value) - MIN(metric_value)) as growth
      FROM platform_metrics
      WHERE platform = ? AND period_date >= ?
      GROUP BY metric_type
    `).all(platform, since);
  }

  getTopContent(platform, days = 30, limit = 10) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    return this.db.prepare(`
      SELECT * FROM content_performance
      WHERE platform = ? AND published_at >= ?
      ORDER BY engagement_rate DESC
      LIMIT ?
    `).all(platform, since, limit);
  }

  getPlatformMetrics(platform, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    return this.db.prepare(`
      SELECT 
        metric_type,
        AVG(metric_value) as avg_value,
        MAX(metric_value) as max_value,
        MIN(metric_value) as min_value
      FROM platform_metrics
      WHERE platform = ? AND period_date >= ?
      GROUP BY metric_type
    `).all(platform, since);
  }

  close() {
    this.db.close();
  }
}

// CLI entry point
if (require.main === module) {
  const sync = new SocialSync();
  sync.sync();
  sync.close();
}

module.exports = SocialSync;
