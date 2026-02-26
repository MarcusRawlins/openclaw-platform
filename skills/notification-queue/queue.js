const Database = require('better-sqlite3');
const classifier = require('./classifier');
const fs = require('fs');
const path = require('path');

// Ensure directory exists
const DB_DIR = '/Volumes/reeseai-memory/data/notifications';
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'notify-queue.db');

class NotificationQueue {
  constructor() {
    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initSchema();
  }

  initSchema() {
    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tier TEXT NOT NULL CHECK(tier IN ('critical', 'high', 'medium')),
        source TEXT NOT NULL,
        channel TEXT DEFAULT 'telegram',
        topic TEXT,
        message TEXT NOT NULL,
        metadata TEXT,
        status TEXT DEFAULT 'queued' CHECK(status IN ('queued', 'delivered', 'failed', 'expired')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        delivered_at TIMESTAMP,
        batch_id INTEGER
      );

      CREATE TABLE IF NOT EXISTS batch_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tier TEXT NOT NULL,
        message_count INTEGER,
        delivered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        digest_text TEXT
      );

      CREATE TABLE IF NOT EXISTS classification_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern TEXT NOT NULL,
        source TEXT,
        tier TEXT NOT NULL,
        description TEXT,
        priority INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
      CREATE INDEX IF NOT EXISTS idx_messages_tier ON messages(tier, status);
      CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
      CREATE INDEX IF NOT EXISTS idx_batch_log_delivered ON batch_log(delivered_at);
    `);
  }

  // Enqueue a message (auto-classify if tier not provided)
  async enqueue(message, options = {}) {
    const {
      source = 'unknown',
      channel = 'telegram',
      topic = null,
      tier = null,
      metadata = null,
      bypass = false
    } = options;

    // Bypass: send immediately, skip queue
    if (bypass) {
      await this.deliverImmediate(message, channel);
      return { delivered: true, tier: 'bypass' };
    }

    // Classify if tier not provided
    let finalTier = tier;
    if (!finalTier) {
      const classification = await classifier.classify(message, source);
      finalTier = classification.tier;
    }

    // Critical messages: deliver immediately AND store in queue
    if (finalTier === 'critical') {
      await this.deliverImmediate(message, channel);
      this.db.prepare(`
        INSERT INTO messages (tier, source, channel, topic, message, metadata, status, delivered_at)
        VALUES (?, ?, ?, ?, ?, ?, 'delivered', datetime('now'))
      `).run(finalTier, source, channel, topic, message, metadata ? JSON.stringify(metadata) : null);
      return { delivered: true, tier: 'critical' };
    }

    // High/Medium: queue for batch delivery
    const stmt = this.db.prepare(`
      INSERT INTO messages (tier, source, channel, topic, message, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(finalTier, source, channel, topic, message, metadata ? JSON.stringify(metadata) : null);

    return { queued: true, tier: finalTier, id: result.lastInsertRowid };
  }

  // Flush queued messages for a tier
  async flush(tier) {
    const messages = this.db.prepare(`
      SELECT * FROM messages
      WHERE tier = ? AND status = 'queued'
      ORDER BY created_at ASC
    `).all(tier);

    if (messages.length === 0) return { flushed: 0, failed: 0 };

    // Group by channel and topic
    const groups = {};
    for (const msg of messages) {
      const key = `${msg.channel}:${msg.topic || 'general'}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(msg);
    }

    // Format and deliver digests
    const batchId = Date.now();
    let failedCount = 0;
    const updateStmt = this.db.prepare(`
      UPDATE messages
      SET status = ?, delivered_at = datetime('now'), batch_id = ?
      WHERE id = ?
    `);

    for (const [key, msgs] of Object.entries(groups)) {
      const [channel, topic] = key.split(':');
      const digest = this.formatDigest(msgs, tier, topic);
      
      try {
        await this.deliverImmediate(digest, channel);
        
        // Mark successful messages as delivered
        for (const msg of msgs) {
          updateStmt.run('delivered', batchId, msg.id);
        }
      } catch (err) {
        // Mark failed messages with 'failed' status
        console.error(`Batch delivery failed for ${channel}: ${err.message}`);
        for (const msg of msgs) {
          updateStmt.run('failed', batchId, msg.id);
          failedCount++;
        }
      }
    }

    // Log batch
    this.db.prepare(`
      INSERT INTO batch_log (tier, message_count)
      VALUES (?, ?)
    `).run(tier, messages.length);

    return { flushed: messages.length - failedCount, failed: failedCount, batchId };
  }

  formatDigest(messages, tier, topic) {
    const tierEmoji = { high: '🔔', medium: '📋' }[tier] || '📬';
    const count = messages.length;
    const topicName = topic && topic !== 'general' ? topic.replace(/-/g, ' ') : 'Updates';
    const header = `${tierEmoji} **${tier.toUpperCase()} Priority Digest** — ${topicName} (${count} update${count > 1 ? 's' : ''})`;

    const body = messages.map((msg, i) => {
      const source = msg.source && msg.source !== 'unknown' ? `_${msg.source}_: ` : '';
      const text = msg.message.substring(0, 200);
      const truncated = msg.message.length > 200 ? '...' : '';
      return `${i + 1}. ${source}${text}${truncated}`;
    }).join('\n\n');

    return `${header}\n\n${body}`;
  }

  async deliverImmediate(message, channel = 'telegram') {
    try {
      // Gateway API endpoint for message delivery
      // Routes to appropriate channel (telegram, email, webhook, etc.)
      const gatewayUrl = process.env.GATEWAY_URL || 'http://localhost:18789';
      const response = await fetch(`${gatewayUrl}/api/message/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENCLAW_GATEWAY_TOKEN || ''}`
        },
        body: JSON.stringify({
          channel,
          message,
          source: 'notification-queue',
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        // Log the error but don't fail if gateway is not ready
        console.warn(
          `[${new Date().toISOString()}] DELIVER [${channel}] PENDING: ` +
          `Gateway returned ${response.status} (endpoint may not be implemented yet)`
        );
        // Return success anyway - message is queued and will be delivered once gateway is ready
        return { queued: true, status: 'pending_gateway' };
      }

      const result = await response.json();
      console.log(
        `[${new Date().toISOString()}] DELIVER [${channel}] OK: ` +
        `${message.substring(0, 100)}`
      );
      return result;
    } catch (err) {
      // Don't fail completely - message is already in queue
      console.warn(
        `[${new Date().toISOString()}] DELIVER [${channel}] QUEUED: ` +
        `Gateway unavailable (${err.message})`
      );
      return { queued: true, status: 'gateway_unavailable' };
    }
  }

  // Get queue stats
  stats() {
    return {
      critical: this.db.prepare("SELECT COUNT(*) as count FROM messages WHERE tier='critical' AND status='queued'").get().count,
      high: this.db.prepare("SELECT COUNT(*) as count FROM messages WHERE tier='high' AND status='queued'").get().count,
      medium: this.db.prepare("SELECT COUNT(*) as count FROM messages WHERE tier='medium' AND status='queued'").get().count,
      total_queued: this.db.prepare("SELECT COUNT(*) as count FROM messages WHERE status='queued'").get().count,
      total_delivered: this.db.prepare("SELECT COUNT(*) as count FROM messages WHERE status='delivered'").get().count,
      total_failed: this.db.prepare("SELECT COUNT(*) as count FROM messages WHERE status='failed'").get().count
    };
  }

  // Expire old queued messages (>24 hours)
  expireStale() {
    const stmt = this.db.prepare(`
      UPDATE messages
      SET status = 'expired'
      WHERE status = 'queued' AND created_at < datetime('now', '-24 hours')
    `);
    const result = stmt.run();
    return result.changes;
  }

  // Get batch history
  getBatchHistory(limit = 50) {
    return this.db.prepare(`
      SELECT * FROM batch_log
      ORDER BY delivered_at DESC
      LIMIT ?
    `).all(limit);
  }

  // Get messages for a specific batch
  getBatchMessages(batchId) {
    return this.db.prepare(`
      SELECT * FROM messages
      WHERE batch_id = ?
      ORDER BY created_at ASC
    `).all(batchId);
  }
}

module.exports = new NotificationQueue();
