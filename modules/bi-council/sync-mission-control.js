#!/usr/bin/env node

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DATA_DIR = '/Volumes/reeseai-memory/data/bi-council';
const TASKS_DB = path.join(DATA_DIR, 'tasks.db');
const MC_TASKS_PATH = '/Users/marcusrawlins/.openclaw/workspace/mission_control/data/tasks.json';

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

class MissionControlSync {
  constructor() {
    this.db = new Database(TASKS_DB);
    this.initSchema();
  }

  initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT,
        description TEXT,
        assigned_to TEXT,
        status TEXT,
        priority TEXT,
        created_at TEXT,
        updated_at TEXT,
        completed_at TEXT,
        module TEXT,
        spec_path TEXT
      );

      CREATE TABLE IF NOT EXISTS task_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT REFERENCES tasks(id),
        status TEXT,
        changed_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
      CREATE INDEX IF NOT EXISTS idx_task_history_task ON task_history(task_id);
    `);
  }

  sync() {
    console.log('📋 Syncing Mission Control tasks...');

    if (!fs.existsSync(MC_TASKS_PATH)) {
      console.error(`  ✗ tasks.json not found at ${MC_TASKS_PATH}`);
      return 0;
    }

    const tasks = JSON.parse(fs.readFileSync(MC_TASKS_PATH, 'utf-8'));

    let synced = 0;
    let updated = 0;

    for (const task of tasks) {
      // Check if task exists
      const existing = this.db.prepare('SELECT status, updated_at FROM tasks WHERE id = ?').get(task.id);

      if (!existing) {
        // New task
        this.db.prepare(`
          INSERT INTO tasks (id, title, description, assigned_to, status, priority, created_at, updated_at, completed_at, module, spec_path)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          task.id,
          task.title,
          task.description || '',
          task.assignedTo || '',
          task.status,
          task.priority,
          task.createdAt,
          task.updatedAt,
          task.completedAt || null,
          task.module || null,
          task.specPath || null
        );
        synced++;
      } else if (existing.status !== task.status || existing.updated_at !== task.updatedAt) {
        // Status changed, record history
        if (existing.status !== task.status) {
          this.db.prepare(`
            INSERT INTO task_history (task_id, status, changed_at)
            VALUES (?, ?, ?)
          `).run(task.id, task.status, task.updatedAt);
        }

        // Update task
        this.db.prepare(`
          UPDATE tasks
          SET title = ?, description = ?, assigned_to = ?, status = ?, priority = ?, updated_at = ?, completed_at = ?, module = ?, spec_path = ?
          WHERE id = ?
        `).run(
          task.title,
          task.description || '',
          task.assignedTo || '',
          task.status,
          task.priority,
          task.updatedAt,
          task.completedAt || null,
          task.module || null,
          task.specPath || null,
          task.id
        );
        updated++;
      }
    }

    console.log(`  ✓ Synced ${synced} new tasks, updated ${updated} existing`);
    return synced + updated;
  }

  getTaskStats(days = 7) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    return {
      completed: this.db.prepare(`
        SELECT COUNT(*) as count
        FROM tasks
        WHERE completed_at IS NOT NULL AND completed_at >= ?
      `).get(since).count,

      active: this.db.prepare(`
        SELECT COUNT(*) as count
        FROM tasks
        WHERE status = 'active'
      `).get().count,

      queued: this.db.prepare(`
        SELECT COUNT(*) as count
        FROM tasks
        WHERE status = 'queued'
      `).get().count,

      totalTasks: this.db.prepare(`
        SELECT COUNT(*) as count
        FROM tasks
      `).get().count
    };
  }

  getRecentTasks(limit = 10) {
    return this.db.prepare(`
      SELECT * FROM tasks
      ORDER BY updated_at DESC
      LIMIT ?
    `).all(limit);
  }

  close() {
    this.db.close();
  }
}

// CLI entry point
if (require.main === module) {
  const sync = new MissionControlSync();
  sync.sync();
  sync.close();
}

module.exports = MissionControlSync;
