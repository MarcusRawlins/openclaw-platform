# Business Intelligence Council

**Priority:** High  
**Estimated Time:** 5-7 days  
**Dependencies:** AnselAI Phase 2+ (social analytics), Mission Control (task data)  
**Model Requirements:** Opus for expert analysis, Sonnet for synthesis

## Executive Summary

Build a multi-agent business intelligence system that analyzes all business data through independent expert personas, synthesizes findings, generates ranked recommendations, and delivers nightly strategic digests. Think of it as a board of advisors running parallel analysis every night.

## Philosophy

**Single-perspective analysis misses blind spots.** A growth strategist sees different signals than a CFO. A content strategist notices patterns an operations analyst won't. By running multiple expert perspectives in parallel, we get comprehensive strategic intelligence.

**Key principles:**
- **Domain isolation:** Each expert only sees their relevant data
- **Parallel execution:** Run all experts simultaneously for speed  
- **Synthesis over consensus:** Merge insights, don't average them
- **Actionable recommendations:** Every insight must have a "do this" attached
- **Feedback loop:** Accept/reject recommendations to tune future analysis

## Architecture

```
                    BUSINESS INTELLIGENCE COUNCIL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌─────────────────────────────────────────────────────────────┐
│                     DATA SYNC LAYER                          │
│  (Runs every 3-4 hours, stores in domain-specific SQLite)   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Telegram         Mission Control      AnselAI CRM          │
│  (3h sync)        (4h sync)            (4h sync)            │
│     ↓                 ↓                     ↓                │
│  team-chat.db     tasks.db            crm.db                │
│                                                              │
│  Social Analytics    Financial Data                         │
│  (daily sync)        (manual import)                        │
│     ↓                 ↓                                      │
│  social.db        finance.db                                │
└─────────────────────────────────────────────────────────────┘
                            ↓
        ┌───────────────────┴───────────────────┐
        │                                        │
        ↓                                        ↓
┌──────────────────────────────────────────────────────────────┐
│               EXPERT ANALYSIS LAYER (PARALLEL)                │
│                     (Runs nightly at 10 PM)                   │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Scout   │  │  Ada     │  │  Ed      │  │  Dewey   │   │
│  │          │  │          │  │          │  │          │   │
│  │ Market   │  │ Content  │  │ Revenue  │  │ Ops      │   │
│  │ Analyst  │  │Strategist│  │ Guardian │  │ Analyst  │   │
│  │          │  │          │  │          │  │          │   │
│  │ Reads:   │  │ Reads:   │  │ Reads:   │  │ Reads:   │   │
│  │ • social │  │ • social │  │ • crm    │  │ • tasks  │   │
│  │ • trends │  │ • content│  │ • leads  │  │ • chat   │   │
│  │          │  │ metrics  │  │ • pipe   │  │ • system │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │             │             │             │           │
│       └─────────────┴─────────────┴─────────────┘           │
│                          ↓                                   │
│  ┌──────────┐  ┌──────────┐                                │
│  │ Brunel   │  │  Walt    │                                │
│  │          │  │          │                                │
│  │ Growth   │  │ Financial│                                │
│  │Strategist│  │ Guardian │                                │
│  │          │  │          │                                │
│  │ Reads:   │  │ Reads:   │                                │
│  │ • social │  │ • finance│                                │
│  │ • content│  │ • revenue│                                │
│  │ • leads  │  │ • costs  │                                │
│  └────┬─────┘  └────┬─────┘                                │
│       │             │                                       │
│       └─────────────┘                                       │
│              ↓                                              │
│    Each expert produces:                                   │
│    • Domain analysis (trends, anomalies, insights)         │
│    • Risk assessment (red flags, warnings)                 │
│    • Opportunities (growth levers, optimizations)          │
│    • Recommendations (ranked, with rationale)              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  SYNTHESIS LAYER (Marcus)                    │
│                  (Merges expert findings)                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Collect all expert analyses                             │
│  2. Identify cross-domain patterns                          │
│  3. Rank recommendations by impact + urgency                │
│  4. Resolve conflicts between experts                       │
│  5. Generate executive summary                              │
│  6. Format nightly digest                                   │
│                                                              │
│  Output:                                                     │
│  • Executive summary (one paragraph)                        │
│  • Top 5 recommendations (ranked)                           │
│  • Key metrics snapshot                                     │
│  • Expert highlights (one insight per expert)               │
│  • Risk alerts (if any)                                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   DELIVERY & FEEDBACK                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  • Post nightly digest to Telegram (10 PM)                 │
│  • Store snapshot in council-history.db                     │
│  • CLI for deep dive: `council explore <rec-id>`            │
│  • Feedback: `council accept <rec-id>` or `reject`          │
│  • Tuning: Adjust expert weights based on accepted recs     │
└─────────────────────────────────────────────────────────────┘
```

## Expert Persona Mapping

### Scout → Market Analyst
**Focus:** Competitive intelligence, market trends, audience behavior  
**Data sources:** social.db (competitor activity, trending topics), team-chat.db (Tyler's market observations)  
**Questions:** 
- What's trending in wedding photography discourse?
- Are competitors doing anything novel?
- Where is audience attention shifting?
- What content formats are gaining traction?

**Output:** Market intelligence brief with opportunity assessment

### Ada → Content Strategist
**Focus:** Content performance, audience engagement, editorial strategy  
**Data sources:** social.db (content metrics), AnselAI content catalog  
**Questions:**
- Which content types are performing best?
- Are engagement rates trending up or down?
- What topics resonate most with our audience?
- Is content frequency optimal?

**Output:** Content performance analysis with editorial recommendations

### Ed → Revenue Guardian
**Focus:** Sales pipeline health, lead quality, conversion optimization  
**Data sources:** crm.db (inquiries, bookings), social.db (lead sources)  
**Questions:**
- Is lead volume trending up or down?
- What's the conversion rate (inquiry → booking)?
- Which lead sources convert best?
- Are we losing deals at any specific stage?

**Output:** Revenue health report with pipeline optimization recommendations

### Dewey → Operations Analyst
**Focus:** System health, workflow efficiency, team productivity  
**Data sources:** tasks.db (task completion rates), team-chat.db (operational discussions)  
**Questions:**
- Are tasks completing on time?
- Are there workflow bottlenecks?
- Is team velocity improving?
- Are there system issues impacting productivity?

**Output:** Operations report with process improvement recommendations

### Brunel → Growth Strategist
**Focus:** Cross-domain growth opportunities, strategic initiatives  
**Data sources:** social.db, crm.db, tasks.db (all domains)  
**Questions:**
- Where are the highest-leverage growth opportunities?
- What strategic initiatives should we prioritize?
- Are we making progress on key business goals?
- What's blocking growth?

**Output:** Strategic growth analysis with prioritized initiatives

### Walt → Financial Guardian
**Focus:** Financial health, cost management, ROI analysis  
**Data sources:** finance.db (expenses, revenue), social.db (ad spend), crm.db (bookings)  
**Questions:**
- Is revenue trending toward monthly/annual goals?
- Are costs under control?
- What's ROI on marketing spend?
- Are there financial risks on the horizon?

**Output:** Financial health report with cost optimization recommendations

## Database Schema

### Sync Databases (Domain-Specific SQLite)

**1. team-chat.db** (Telegram sync)
```sql
CREATE TABLE messages (
  id INTEGER PRIMARY KEY,
  telegram_id INTEGER UNIQUE,
  chat_id TEXT,
  from_user TEXT,
  text TEXT,
  date TIMESTAMP,
  replied_to INTEGER, -- message_id of parent
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE message_tags (
  message_id INTEGER REFERENCES messages(id),
  tag TEXT, -- decision, question, feedback, insight
  confidence DECIMAL(3,2)
);

CREATE INDEX idx_messages_date ON messages(date);
CREATE INDEX idx_messages_chat ON messages(chat_id);
```

**2. tasks.db** (Mission Control sync)
```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  assigned_to TEXT,
  status TEXT,
  priority TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  completed_at TIMESTAMP,
  module TEXT,
  spec_path TEXT
);

CREATE TABLE task_history (
  task_id TEXT REFERENCES tasks(id),
  status TEXT,
  changed_at TIMESTAMP
);

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to);
```

**3. crm.db** (AnselAI CRM sync)
```sql
CREATE TABLE inquiries (
  id INTEGER PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  event_date DATE,
  event_type TEXT,
  source TEXT,
  status TEXT,
  inquiry_date TIMESTAMP,
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bookings (
  id INTEGER PRIMARY KEY,
  inquiry_id INTEGER REFERENCES inquiries(id),
  event_date DATE,
  package_price DECIMAL(10,2),
  deposit_paid BOOLEAN,
  balance_due DECIMAL(10,2),
  booking_date DATE,
  status TEXT,
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_inquiries_status ON inquiries(status);
CREATE INDEX idx_bookings_date ON bookings(event_date);
```

**4. social.db** (AnselAI social analytics sync)
```sql
CREATE TABLE platform_metrics (
  platform TEXT,
  metric_type TEXT,
  metric_value DECIMAL(15,2),
  period_date DATE,
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (platform, metric_type, period_date)
);

CREATE TABLE content_performance (
  content_id INTEGER,
  platform TEXT,
  title TEXT,
  published_at DATE,
  views INTEGER,
  likes INTEGER,
  comments INTEGER,
  shares INTEGER,
  engagement_rate DECIMAL(8,4),
  snapshot_date DATE,
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (content_id, snapshot_date)
);

CREATE INDEX idx_content_platform ON content_performance(platform);
CREATE INDEX idx_content_date ON content_performance(published_at);
```

**5. finance.db** (Manual import from QuickBooks/exports)
```sql
CREATE TABLE revenue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date DATE,
  amount DECIMAL(10,2),
  category TEXT, -- wedding, engagement, portrait, etc.
  source TEXT, -- client name or booking ID
  notes TEXT,
  imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date DATE,
  amount DECIMAL(10,2),
  category TEXT, -- marketing, equipment, software, etc.
  vendor TEXT,
  description TEXT,
  imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE monthly_summary (
  month TEXT PRIMARY KEY, -- YYYY-MM
  total_revenue DECIMAL(10,2),
  total_expenses DECIMAL(10,2),
  net_income DECIMAL(10,2),
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_revenue_date ON revenue(date);
CREATE INDEX idx_expenses_date ON expenses(date);
```

### Council History Database

**council-history.db** (Tracks analysis snapshots & recommendations)
```sql
CREATE TABLE council_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_date DATE UNIQUE,
  run_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'completed', -- completed, failed
  error_message TEXT
);

CREATE TABLE expert_analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER REFERENCES council_sessions(id),
  expert_name TEXT,
  analysis_text TEXT,
  risk_level TEXT, -- none, low, medium, high, critical
  opportunity_count INTEGER,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE recommendations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER REFERENCES council_sessions(id),
  expert_name TEXT,
  recommendation_text TEXT,
  impact_score INTEGER, -- 1-10
  urgency_score INTEGER, -- 1-10
  combined_rank INTEGER, -- impact * urgency
  rationale TEXT,
  status TEXT DEFAULT 'pending', -- pending, accepted, rejected, implemented
  feedback_at TIMESTAMP,
  feedback_notes TEXT
);

CREATE TABLE synthesis (
  session_id INTEGER PRIMARY KEY REFERENCES council_sessions(id),
  executive_summary TEXT,
  key_metrics TEXT, -- JSON snapshot
  risk_alerts TEXT,
  synthesized_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_recommendations_status ON recommendations(status);
CREATE INDEX idx_recommendations_rank ON recommendations(combined_rank DESC);
```

## Phase 1: Data Sync Layer (Days 1-2)

### 1.1 Telegram Sync

**File:** `skills/bi-council/sync-telegram.js`

```javascript
const Database = require('better-sqlite3');
const fetch = require('node-fetch');

const CHAT_DB = '/Volumes/reeseai-memory/data/bi-council/team-chat.db';
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:18789';

class TelegramSync {
  constructor() {
    this.db = new Database(CHAT_DB);
    this.initSchema();
  }

  initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY,
        telegram_id INTEGER UNIQUE,
        chat_id TEXT,
        from_user TEXT,
        text TEXT,
        date TIMESTAMP,
        replied_to INTEGER,
        synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS message_tags (
        message_id INTEGER REFERENCES messages(id),
        tag TEXT,
        confidence DECIMAL(3,2)
      );

      CREATE INDEX IF NOT EXISTS idx_messages_date ON messages(date);
      CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id);
    `);
  }

  async sync() {
    console.log('Syncing Telegram messages...');

    // Get last synced message ID
    const lastSync = this.db.prepare('SELECT MAX(telegram_id) as last_id FROM messages').get();
    const lastId = lastSync?.last_id || 0;

    // Fetch recent messages from OpenClaw gateway
    // (Need to implement gateway API for message history)
    // For now, stub:
    const messages = await this.fetchRecentMessages(lastId);

    let synced = 0;
    for (const msg of messages) {
      try {
        this.db.prepare(`
          INSERT OR IGNORE INTO messages (telegram_id, chat_id, from_user, text, date, replied_to)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          msg.message_id,
          msg.chat.id,
          msg.from.first_name,
          msg.text || '',
          new Date(msg.date * 1000).toISOString(),
          msg.reply_to_message?.message_id || null
        );
        synced++;
      } catch (err) {
        console.error(`Error syncing message ${msg.message_id}:`, err.message);
      }
    }

    console.log(`✓ Synced ${synced} new messages`);
    return synced;
  }

  async fetchRecentMessages(sinceId) {
    // TODO: Implement gateway API call
    // For MVP: read from gateway logs or use Telegram API directly
    return [];
  }

  getRecentMessages(hours = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    return this.db.prepare(`
      SELECT * FROM messages
      WHERE date >= ?
      ORDER BY date DESC
    `).all(since);
  }
}

module.exports = new TelegramSync();
```

### 1.2 Mission Control Sync

**File:** `skills/bi-council/sync-mission-control.js`

```javascript
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const TASKS_DB = '/Volumes/reeseai-memory/data/bi-council/tasks.db';
const MC_TASKS_PATH = '/Users/marcusrawlins/.openclaw/workspace/mission_control/data/tasks.json';

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
        created_at TIMESTAMP,
        updated_at TIMESTAMP,
        completed_at TIMESTAMP,
        module TEXT,
        spec_path TEXT
      );

      CREATE TABLE IF NOT EXISTS task_history (
        task_id TEXT REFERENCES tasks(id),
        status TEXT,
        changed_at TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
    `);
  }

  sync() {
    console.log('Syncing Mission Control tasks...');

    const tasks = JSON.parse(fs.readFileSync(MC_TASKS_PATH, 'utf-8'));

    let synced = 0;
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
          task.description,
          task.assignedTo,
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
          SET status = ?, updated_at = ?, completed_at = ?
          WHERE id = ?
        `).run(task.status, task.updatedAt, task.completedAt || null, task.id);
        synced++;
      }
    }

    console.log(`✓ Synced ${synced} tasks`);
    return synced;
  }

  getTaskStats(days = 7) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    return {
      completed: this.db.prepare(`
        SELECT COUNT(*) as count
        FROM tasks
        WHERE completed_at >= ?
      `).get(since).count,

      active: this.db.prepare(`
        SELECT COUNT(*) as count
        FROM tasks
        WHERE status = 'active'
      `).get().count,

      overdue: this.db.prepare(`
        SELECT COUNT(*) as count
        FROM tasks
        WHERE status = 'queued' AND priority = 'urgent'
      `).get().count
    };
  }
}

module.exports = new MissionControlSync();
```

### 1.3 CRM Sync

**File:** `skills/bi-council/sync-crm.js`

```javascript
const Database = require('better-sqlite3');
const fetch = require('node-fetch');

const CRM_DB = '/Volumes/reeseai-memory/data/bi-council/crm.db';
const ANSELAI_URL = 'http://localhost:3200'; // AnselAI API

class CRMSync {
  constructor() {
    this.db = new Database(CRM_DB);
    this.initSchema();
  }

  initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS inquiries (
        id INTEGER PRIMARY KEY,
        first_name TEXT,
        last_name TEXT,
        email TEXT,
        phone TEXT,
        event_date DATE,
        event_type TEXT,
        source TEXT,
        status TEXT,
        inquiry_date TIMESTAMP,
        synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY,
        inquiry_id INTEGER REFERENCES inquiries(id),
        event_date DATE,
        package_price DECIMAL(10,2),
        deposit_paid BOOLEAN,
        balance_due DECIMAL(10,2),
        booking_date DATE,
        status TEXT,
        synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);
      CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(event_date);
    `);
  }

  async sync() {
    console.log('Syncing CRM data from AnselAI...');

    try {
      // Fetch inquiries from AnselAI API
      const inquiriesRes = await fetch(`${ANSELAI_URL}/api/inquiries`);
      const inquiries = await inquiriesRes.json();

      let synced = 0;
      for (const inq of inquiries) {
        this.db.prepare(`
          INSERT OR REPLACE INTO inquiries (
            id, first_name, last_name, email, phone, event_date, event_type, source, status, inquiry_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          inq.id,
          inq.firstName,
          inq.lastName,
          inq.email,
          inq.phone,
          inq.eventDate,
          inq.eventType,
          inq.source,
          inq.status,
          inq.inquiryDate
        );
        synced++;
      }

      // Fetch bookings
      const bookingsRes = await fetch(`${ANSELAI_URL}/api/bookings`);
      const bookings = await bookingsRes.json();

      for (const booking of bookings) {
        this.db.prepare(`
          INSERT OR REPLACE INTO bookings (
            id, inquiry_id, event_date, package_price, deposit_paid, balance_due, booking_date, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          booking.id,
          booking.inquiryId,
          booking.eventDate,
          booking.packagePrice,
          booking.depositPaid ? 1 : 0,
          booking.balanceDue,
          booking.bookingDate,
          booking.status
        );
        synced++;
      }

      console.log(`✓ Synced ${synced} CRM records`);
      return synced;
    } catch (err) {
      console.error('CRM sync failed:', err.message);
      return 0;
    }
  }

  getPipelineStats(days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    return {
      new_inquiries: this.db.prepare(`
        SELECT COUNT(*) as count
        FROM inquiries
        WHERE inquiry_date >= ?
      `).get(since).count,

      new_bookings: this.db.prepare(`
        SELECT COUNT(*) as count
        FROM bookings
        WHERE booking_date >= ?
      `).get(since).count,

      conversion_rate: this.calculateConversionRate(since)
    };
  }

  calculateConversionRate(since) {
    const inquiries = this.db.prepare(`SELECT COUNT(*) as count FROM inquiries WHERE inquiry_date >= ?`).get(since).count;
    const bookings = this.db.prepare(`SELECT COUNT(*) as count FROM bookings WHERE booking_date >= ?`).get(since).count;

    return inquiries > 0 ? ((bookings / inquiries) * 100).toFixed(2) : 0;
  }
}

module.exports = new CRMSync();
```

### 1.4 Social Analytics Sync

**File:** `skills/bi-council/sync-social.js`

```javascript
const Database = require('better-sqlite3');
const fetch = require('node-fetch');

const SOCIAL_DB = '/Volumes/reeseai-memory/data/bi-council/social.db';
const ANSELAI_URL = 'http://localhost:3200';

class SocialSync {
  constructor() {
    this.db = new Database(SOCIAL_DB);
    this.initSchema();
  }

  initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS platform_metrics (
        platform TEXT,
        metric_type TEXT,
        metric_value DECIMAL(15,2),
        period_date DATE,
        synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (platform, metric_type, period_date)
      );

      CREATE TABLE IF NOT EXISTS content_performance (
        content_id INTEGER,
        platform TEXT,
        title TEXT,
        published_at DATE,
        views INTEGER,
        likes INTEGER,
        comments INTEGER,
        shares INTEGER,
        engagement_rate DECIMAL(8,4),
        snapshot_date DATE,
        synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (content_id, snapshot_date)
      );

      CREATE INDEX IF NOT EXISTS idx_content_platform ON content_performance(platform);
      CREATE INDEX IF NOT EXISTS idx_content_date ON content_performance(published_at);
    `);
  }

  async sync() {
    console.log('Syncing social analytics from AnselAI...');

    try {
      // Sync platform metrics (followers, reach, impressions)
      const metricsRes = await fetch(`${ANSELAI_URL}/api/metrics/social`);
      const metrics = await metricsRes.json();

      let synced = 0;
      for (const metric of metrics) {
        this.db.prepare(`
          INSERT OR REPLACE INTO platform_metrics (platform, metric_type, metric_value, period_date)
          VALUES (?, ?, ?, ?)
        `).run(
          metric.platform,
          metric.metricType,
          metric.metricValue,
          metric.periodDate
        );
        synced++;
      }

      // Sync content performance
      const contentRes = await fetch(`${ANSELAI_URL}/api/content/performance`);
      const content = await contentRes.json();

      for (const item of content) {
        this.db.prepare(`
          INSERT OR REPLACE INTO content_performance (
            content_id, platform, title, published_at, views, likes, comments, shares, engagement_rate, snapshot_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          item.contentId,
          item.platform,
          item.title,
          item.publishedAt,
          item.views,
          item.likes,
          item.comments,
          item.shares,
          item.engagementRate,
          new Date().toISOString().split('T')[0]
        );
        synced++;
      }

      console.log(`✓ Synced ${synced} social metrics`);
      return synced;
    } catch (err) {
      console.error('Social sync failed:', err.message);
      return 0;
    }
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
}

module.exports = new SocialSync();
```

### 1.5 Financial Data Import

**File:** `skills/bi-council/import-financial.js`

```javascript
const Database = require('better-sqlite3');
const fs = require('fs');
const csv = require('csv-parser');

const FINANCE_DB = '/Volumes/reeseai-memory/data/bi-council/finance.db';

class FinancialImport {
  constructor() {
    this.db = new Database(FINANCE_DB);
    this.initSchema();
  }

  initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS revenue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date DATE,
        amount DECIMAL(10,2),
        category TEXT,
        source TEXT,
        notes TEXT,
        imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date DATE,
        amount DECIMAL(10,2),
        category TEXT,
        vendor TEXT,
        description TEXT,
        imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS monthly_summary (
        month TEXT PRIMARY KEY,
        total_revenue DECIMAL(10,2),
        total_expenses DECIMAL(10,2),
        net_income DECIMAL(10,2),
        calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_revenue_date ON revenue(date);
      CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    `);
  }

  async importRevenue(csvPath) {
    console.log(`Importing revenue from ${csvPath}...`);

    return new Promise((resolve, reject) => {
      let imported = 0;
      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => {
          this.db.prepare(`
            INSERT INTO revenue (date, amount, category, source, notes)
            VALUES (?, ?, ?, ?, ?)
          `).run(
            row.date,
            parseFloat(row.amount),
            row.category,
            row.source,
            row.notes || null
          );
          imported++;
        })
        .on('end', () => {
          console.log(`✓ Imported ${imported} revenue records`);
          this.recalculateSummaries();
          resolve(imported);
        })
        .on('error', reject);
    });
  }

  async importExpenses(csvPath) {
    console.log(`Importing expenses from ${csvPath}...`);

    return new Promise((resolve, reject) => {
      let imported = 0;
      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => {
          this.db.prepare(`
            INSERT INTO expenses (date, amount, category, vendor, description)
            VALUES (?, ?, ?, ?, ?)
          `).run(
            row.date,
            parseFloat(row.amount),
            row.category,
            row.vendor,
            row.description || null
          );
          imported++;
        })
        .on('end', () => {
          console.log(`✓ Imported ${imported} expense records`);
          this.recalculateSummaries();
          resolve(imported);
        })
        .on('error', reject);
    });
  }

  recalculateSummaries() {
    console.log('Recalculating monthly summaries...');

    // Get all months with data
    const months = this.db.prepare(`
      SELECT DISTINCT strftime('%Y-%m', date) as month
      FROM revenue
      UNION
      SELECT DISTINCT strftime('%Y-%m', date) as month
      FROM expenses
      ORDER BY month
    `).all();

    for (const { month } of months) {
      const revenue = this.db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM revenue
        WHERE strftime('%Y-%m', date) = ?
      `).get(month).total;

      const expenses = this.db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM expenses
        WHERE strftime('%Y-%m', date) = ?
      `).get(month).total;

      const netIncome = revenue - expenses;

      this.db.prepare(`
        INSERT OR REPLACE INTO monthly_summary (month, total_revenue, total_expenses, net_income)
        VALUES (?, ?, ?, ?)
      `).run(month, revenue, expenses, netIncome);
    }

    console.log(`✓ Recalculated ${months.length} month summaries`);
  }

  getMonthlySummary(month) {
    return this.db.prepare(`
      SELECT * FROM monthly_summary WHERE month = ?
    `).get(month);
  }

  getRecentSummaries(months = 3) {
    return this.db.prepare(`
      SELECT * FROM monthly_summary
      ORDER BY month DESC
      LIMIT ?
    `).all(months);
  }
}

module.exports = new FinancialImport();
```

### 1.6 Sync Orchestrator & Cron

**File:** `skills/bi-council/sync-all.js`

```javascript
const telegramSync = require('./sync-telegram');
const mcSync = require('./sync-mission-control');
const crmSync = require('./sync-crm');
const socialSync = require('./sync-social');

async function syncAll() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('BUSINESS INTELLIGENCE COUNCIL: DATA SYNC');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const results = {};

  try {
    results.telegram = await telegramSync.sync();
  } catch (err) {
    console.error('Telegram sync failed:', err.message);
    results.telegram = 0;
  }

  try {
    results.missionControl = mcSync.sync();
  } catch (err) {
    console.error('Mission Control sync failed:', err.message);
    results.missionControl = 0;
  }

  try {
    results.crm = await crmSync.sync();
  } catch (err) {
    console.error('CRM sync failed:', err.message);
    results.crm = 0;
  }

  try {
    results.social = await socialSync.sync();
  } catch (err) {
    console.error('Social sync failed:', err.message);
    results.social = 0;
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SYNC COMPLETE');
  console.log(`Telegram: ${results.telegram} messages`);
  console.log(`Mission Control: ${results.missionControl} tasks`);
  console.log(`CRM: ${results.crm} records`);
  console.log(`Social: ${results.social} metrics`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  return results;
}

// CLI entry point
if (require.main === module) {
  syncAll().then(() => process.exit(0));
}

module.exports = { syncAll };
```

**Cron Jobs** (configured in OpenClaw gateway):

```json
[
  {
    "name": "BI Council: Telegram + MC Sync (3h)",
    "schedule": { "kind": "every", "everyMs": 10800000 },
    "payload": { 
      "kind": "systemEvent", 
      "text": "exec node /workspace/skills/bi-council/sync-telegram.js && exec node /workspace/skills/bi-council/sync-mission-control.js"
    },
    "sessionTarget": "main",
    "enabled": true
  },
  {
    "name": "BI Council: CRM + Social Sync (4h)",
    "schedule": { "kind": "every", "everyMs": 14400000 },
    "payload": { 
      "kind": "systemEvent", 
      "text": "exec node /workspace/skills/bi-council/sync-crm.js && exec node /workspace/skills/bi-council/sync-social.js"
    },
    "sessionTarget": "main",
    "enabled": true
  }
]
```

## Phase 2: Expert Analysis Layer (Days 3-4)

### 2.1 Expert Analysis Framework

**File:** `skills/bi-council/expert-framework.js`

```javascript
const fetch = require('node-fetch');

const LM_STUDIO_URL = 'http://127.0.0.1:1234/v1/chat/completions';
const OPUS_MODEL = 'anthropic/claude-opus-4-6'; // via OpenClaw

class ExpertAnalyzer {
  constructor(expertConfig) {
    this.name = expertConfig.name;
    this.role = expertConfig.role;
    this.focus = expertConfig.focus;
    this.dataSource = expertConfig.dataSource;
    this.questions = expertConfig.questions;
  }

  async analyze(data, crossDomainBrief) {
    console.log(`${this.name} analyzing ${this.focus}...`);

    const prompt = this.buildPrompt(data, crossDomainBrief);

    // Use Opus for expert analysis
    const response = await this.callOpus(prompt);

    const analysis = this.parseAnalysis(response);

    console.log(`✓ ${this.name} analysis complete`);

    return {
      expert: this.name,
      role: this.role,
      analysis: analysis.insights,
      riskLevel: analysis.riskLevel,
      opportunities: analysis.opportunities,
      recommendations: analysis.recommendations,
      generatedAt: new Date().toISOString()
    };
  }

  buildPrompt(data, crossDomainBrief) {
    return `You are ${this.name}, a ${this.role} for a wedding photography business.

**Your Focus:** ${this.focus}

**Your Questions:**
${this.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

**Data Available:**
${this.formatData(data)}

**Cross-Domain Context:**
${crossDomainBrief}

**Your Task:**
Analyze the data through your expert lens. Provide:

1. **Key Insights** (2-3 most important observations)
2. **Risk Assessment** (none, low, medium, high, critical) with reasoning
3. **Opportunities** (2-3 growth levers or optimizations)
4. **Recommendations** (3-5 ranked actions with impact + urgency scores 1-10)

Format as JSON:
{
  "insights": ["insight 1", "insight 2", ...],
  "riskLevel": "none|low|medium|high|critical",
  "riskReasoning": "...",
  "opportunities": [
    { "title": "...", "description": "..." }
  ],
  "recommendations": [
    {
      "action": "...",
      "rationale": "...",
      "impact": 8,
      "urgency": 6
    }
  ]
}

Be specific, data-driven, and actionable. Cite metrics when relevant.`;
  }

  formatData(data) {
    // Format data source for expert
    return JSON.stringify(data, null, 2);
  }

  async callOpus(prompt) {
    // Call via OpenClaw exec (has Opus access)
    const escapedPrompt = prompt.replace(/"/g, '\\"').replace(/\n/g, '\\n');
    
    const result = await fetch('http://localhost:18789/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OPUS_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
      })
    });

    const data = await result.json();
    return data.choices[0].message.content;
  }

  parseAnalysis(response) {
    try {
      // Extract JSON from response (may be wrapped in markdown)
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || response.match(/\{[\s\S]*\}/);
      const json = jsonMatch ? jsonMatch[1] || jsonMatch[0] : response;
      return JSON.parse(json);
    } catch (err) {
      console.error('Failed to parse expert analysis:', err.message);
      return {
        insights: ['Analysis parsing failed'],
        riskLevel: 'none',
        opportunities: [],
        recommendations: []
      };
    }
  }
}

module.exports = ExpertAnalyzer;
```

### 2.2 Expert Configurations

**File:** `skills/bi-council/experts.js`

```javascript
const ExpertAnalyzer = require('./expert-framework');
const telegramSync = require('./sync-telegram');
const mcSync = require('./sync-mission-control');
const crmSync = require('./sync-crm');
const socialSync = require('./sync-social');
const financeImport = require('./import-financial');

// Scout → Market Analyst
const marketAnalyst = new ExpertAnalyzer({
  name: 'Scout',
  role: 'Market Analyst',
  focus: 'Competitive intelligence, market trends, audience behavior',
  dataSource: async () => ({
    socialTrends: socialSync.getGrowthTrends('instagram', 7),
    recentMessages: telegramSync.getRecentMessages(24),
    // TODO: Add competitor tracking when available
  }),
  questions: [
    "What's trending in wedding photography discourse?",
    "Are competitors doing anything novel?",
    "Where is audience attention shifting?",
    "What content formats are gaining traction?"
  ]
});

// Ada → Content Strategist
const contentStrategist = new ExpertAnalyzer({
  name: 'Ada',
  role: 'Content Strategist',
  focus: 'Content performance, audience engagement, editorial strategy',
  dataSource: async () => {
    const db = socialSync.db;
    return {
      topContent: db.prepare(`
        SELECT * FROM content_performance
        WHERE snapshot_date >= date('now', '-7 days')
        ORDER BY engagement_rate DESC
        LIMIT 10
      `).all(),
      platformPerformance: db.prepare(`
        SELECT 
          platform,
          AVG(engagement_rate) as avg_engagement,
          SUM(views) as total_views
        FROM content_performance
        WHERE snapshot_date >= date('now', '-30 days')
        GROUP BY platform
      `).all()
    };
  },
  questions: [
    "Which content types are performing best?",
    "Are engagement rates trending up or down?",
    "What topics resonate most with our audience?",
    "Is content frequency optimal?"
  ]
});

// Ed → Revenue Guardian
const revenueGuardian = new ExpertAnalyzer({
  name: 'Ed',
  role: 'Revenue Guardian',
  focus: 'Sales pipeline health, lead quality, conversion optimization',
  dataSource: async () => ({
    pipelineStats: crmSync.getPipelineStats(30),
    recentInquiries: crmSync.db.prepare(`
      SELECT * FROM inquiries
      WHERE inquiry_date >= date('now', '-7 days')
      ORDER BY inquiry_date DESC
    `).all(),
    recentBookings: crmSync.db.prepare(`
      SELECT * FROM bookings
      WHERE booking_date >= date('now', '-7 days')
      ORDER BY booking_date DESC
    `).all()
  }),
  questions: [
    "Is lead volume trending up or down?",
    "What's the conversion rate (inquiry → booking)?",
    "Which lead sources convert best?",
    "Are we losing deals at any specific stage?"
  ]
});

// Dewey → Operations Analyst
const operationsAnalyst = new ExpertAnalyzer({
  name: 'Dewey',
  role: 'Operations Analyst',
  focus: 'System health, workflow efficiency, team productivity',
  dataSource: async () => ({
    taskStats: mcSync.getTaskStats(7),
    recentActivity: telegramSync.getRecentMessages(48),
    systemHealth: {
      // TODO: Add system health metrics (disk space, backup status, etc.)
    }
  }),
  questions: [
    "Are tasks completing on time?",
    "Are there workflow bottlenecks?",
    "Is team velocity improving?",
    "Are there system issues impacting productivity?"
  ]
});

// Brunel → Growth Strategist
const growthStrategist = new ExpertAnalyzer({
  name: 'Brunel',
  role: 'Growth Strategist',
  focus: 'Cross-domain growth opportunities, strategic initiatives',
  dataSource: async () => ({
    social: socialSync.getGrowthTrends('instagram', 30),
    pipeline: crmSync.getPipelineStats(30),
    tasks: mcSync.getTaskStats(7),
    // Cross-domain view
  }),
  questions: [
    "Where are the highest-leverage growth opportunities?",
    "What strategic initiatives should we prioritize?",
    "Are we making progress on key business goals?",
    "What's blocking growth?"
  ]
});

// Walt → Financial Guardian
const financialGuardian = new ExpertAnalyzer({
  name: 'Walt',
  role: 'Financial Guardian',
  focus: 'Financial health, cost management, ROI analysis',
  dataSource: async () => ({
    monthlySummaries: financeImport.getRecentSummaries(3),
    adSpend: socialSync.db.prepare(`
      SELECT SUM(metric_value) as total_spend
      FROM platform_metrics
      WHERE metric_type = 'ad_spend' AND period_date >= date('now', '-30 days')
    `).get(),
    bookingRevenue: crmSync.db.prepare(`
      SELECT SUM(package_price) as total_revenue
      FROM bookings
      WHERE booking_date >= date('now', '-30 days')
    `).get()
  }),
  questions: [
    "Is revenue trending toward monthly/annual goals?",
    "Are costs under control?",
    "What's ROI on marketing spend?",
    "Are there financial risks on the horizon?"
  ]
});

module.exports = {
  marketAnalyst,
  contentStrategist,
  revenueGuardian,
  operationsAnalyst,
  growthStrategist,
  financialGuardian
};
```

### 2.3 Parallel Execution

**File:** `skills/bi-council/run-experts.js`

```javascript
const experts = require('./experts');
const Database = require('better-sqlite3');

const COUNCIL_DB = '/Volumes/reeseai-memory/data/bi-council/council-history.db';

async function runExperts() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('BUSINESS INTELLIGENCE COUNCIL: EXPERT ANALYSIS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const db = new Database(COUNCIL_DB);
  
  // Create session
  const sessionId = db.prepare(`
    INSERT INTO council_sessions (session_date)
    VALUES (date('now'))
  `).run().lastInsertRowid;

  // Generate cross-domain brief (summary of all data sources)
  const crossDomainBrief = await generateCrossDomainBrief();

  // Run all experts in parallel
  const expertList = [
    experts.marketAnalyst,
    experts.contentStrategist,
    experts.revenueGuardian,
    experts.operationsAnalyst,
    experts.growthStrategist,
    experts.financialGuardian
  ];

  const analyses = await Promise.all(
    expertList.map(async (expert) => {
      try {
        const data = await expert.dataSource();
        return await expert.analyze(data, crossDomainBrief);
      } catch (err) {
        console.error(`${expert.name} analysis failed:`, err.message);
        return null;
      }
    })
  );

  // Store analyses
  for (const analysis of analyses.filter(a => a)) {
    db.prepare(`
      INSERT INTO expert_analyses (session_id, expert_name, analysis_text, risk_level, opportunity_count)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      sessionId,
      analysis.expert,
      JSON.stringify(analysis.analysis),
      analysis.riskLevel,
      analysis.opportunities.length
    );

    // Store recommendations
    for (const rec of analysis.recommendations) {
      db.prepare(`
        INSERT INTO recommendations (session_id, expert_name, recommendation_text, impact_score, urgency_score, combined_rank, rationale)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        sessionId,
        analysis.expert,
        rec.action,
        rec.impact,
        rec.urgency,
        rec.impact * rec.urgency,
        rec.rationale
      );
    }
  }

  console.log('\n✓ All expert analyses complete\n');

  return { sessionId, analyses: analyses.filter(a => a) };
}

async function generateCrossDomainBrief() {
  // TODO: Generate a high-level summary of all data sources
  return "Cross-domain brief: Wedding photography business, active social presence, growing pipeline.";
}

// CLI entry point
if (require.main === module) {
  runExperts().then(() => process.exit(0));
}

module.exports = { runExperts };
```

## Phase 3: Synthesis Layer (Day 5)

### 3.1 Synthesis Engine

**File:** `skills/bi-council/synthesize.js`

```javascript
const Database = require('better-sqlite3');
const fetch = require('node-fetch');

const COUNCIL_DB = '/Volumes/reeseai-memory/data/bi-council/council-history.db';

class Synthesizer {
  constructor() {
    this.db = new Database(COUNCIL_DB);
  }

  async synthesize(sessionId) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('BUSINESS INTELLIGENCE COUNCIL: SYNTHESIS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Get all expert analyses
    const analyses = this.db.prepare(`
      SELECT * FROM expert_analyses WHERE session_id = ?
    `).all(sessionId);

    // Get all recommendations (ranked)
    const recommendations = this.db.prepare(`
      SELECT * FROM recommendations 
      WHERE session_id = ?
      ORDER BY combined_rank DESC
      LIMIT 10
    `).all(sessionId);

    // Generate synthesis
    const synthesis = await this.generateSynthesis(analyses, recommendations);

    // Store synthesis
    this.db.prepare(`
      INSERT INTO synthesis (session_id, executive_summary, key_metrics, risk_alerts)
      VALUES (?, ?, ?, ?)
    `).run(
      sessionId,
      synthesis.executiveSummary,
      JSON.stringify(synthesis.keyMetrics),
      JSON.stringify(synthesis.riskAlerts)
    );

    console.log('✓ Synthesis complete\n');

    return {
      sessionId,
      ...synthesis,
      topRecommendations: recommendations.slice(0, 5)
    };
  }

  async generateSynthesis(analyses, recommendations) {
    const prompt = `You are Marcus, Chief of Staff synthesizing expert analyses from a business intelligence council.

**Expert Analyses:**
${analyses.map(a => `
**${a.expert_name}:**
Risk Level: ${a.risk_level}
Insights: ${a.analysis_text}
`).join('\n')}

**Top Recommendations (pre-ranked by impact × urgency):**
${recommendations.slice(0, 10).map((r, i) => `
${i + 1}. ${r.recommendation_text} (from ${r.expert_name})
   Impact: ${r.impact_score}/10 | Urgency: ${r.urgency_score}/10
   Rationale: ${r.rationale}
`).join('\n')}

**Your Task:**
Synthesize the council's findings into an executive summary.

Format as JSON:
{
  "executiveSummary": "One paragraph capturing the strategic state of the business",
  "keyMetrics": {
    "overallHealth": "excellent|good|fair|concerning|critical",
    "primaryTrend": "growth|stability|decline",
    "urgentIssues": 0-3
  },
  "riskAlerts": [
    { "source": "expert name", "issue": "brief description", "severity": "high|medium|low" }
  ],
  "crossDomainInsights": [
    "Pattern or insight that emerges across multiple expert perspectives"
  ]
}

Be strategic, concise, and actionable.`;

    const response = await this.callSonnet(prompt);

    return this.parseSynthesis(response);
  }

  async callSonnet(prompt) {
    const result = await fetch('http://localhost:18789/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4-5',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
      })
    });

    const data = await result.json();
    return data.choices[0].message.content;
  }

  parseSynthesis(response) {
    try {
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || response.match(/\{[\s\S]*\}/);
      const json = jsonMatch ? jsonMatch[1] || jsonMatch[0] : response;
      return JSON.parse(json);
    } catch (err) {
      console.error('Failed to parse synthesis:', err.message);
      return {
        executiveSummary: 'Synthesis parsing failed',
        keyMetrics: { overallHealth: 'unknown', primaryTrend: 'unknown', urgentIssues: 0 },
        riskAlerts: [],
        crossDomainInsights: []
      };
    }
  }
}

module.exports = new Synthesizer();
```

## Phase 4: Delivery & Feedback (Days 6-7)

### 4.1 Nightly Digest Formatter

**File:** `skills/bi-council/format-digest.js`

```javascript
function formatDigest(synthesis) {
  const { executiveSummary, keyMetrics, riskAlerts, crossDomainInsights, topRecommendations, sessionId } = synthesis;

  const date = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const healthEmoji = {
    excellent: '🟢',
    good: '🟡',
    fair: '🟠',
    concerning: '🔴',
    critical: '🚨'
  }[keyMetrics.overallHealth] || '❓';

  return `🏛 **Business Intelligence Council — ${date}**

${healthEmoji} **Business Health:** ${keyMetrics.overallHealth.toUpperCase()} ${keyMetrics.primaryTrend ? `(${keyMetrics.primaryTrend})` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 📋 Executive Summary

${executiveSummary}

${riskAlerts.length > 0 ? `
## ⚠️ Risk Alerts

${riskAlerts.map(r => `• **${r.source}**: ${r.issue} (${r.severity})`).join('\n')}
` : ''}

${crossDomainInsights.length > 0 ? `
## 🔍 Cross-Domain Insights

${crossDomainInsights.map(i => `• ${i}`).join('\n')}
` : ''}

## 💡 Top 5 Recommendations

${topRecommendations.map((r, i) => `
**${i + 1}. ${r.recommendation_text}**
   📊 Impact: ${r.impact_score}/10 | ⏱ Urgency: ${r.urgency_score}/10
   🎯 ${r.rationale}
   _— ${r.expert_name}_
`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Feedback:**
• Accept: \`council accept <rec-id>\` (e.g., \`council accept ${topRecommendations[0]?.id}\`)
• Reject: \`council reject <rec-id> <reason>\`
• Explore: \`council explore ${sessionId}\` (deep dive via CLI)

_Session ID: ${sessionId}_`;
}

module.exports = { formatDigest };
```

### 4.2 Main Council Runner

**File:** `skills/bi-council/run-council.js`

```javascript
const { syncAll } = require('./sync-all');
const { runExperts } = require('./run-experts');
const synthesizer = require('./synthesize');
const { formatDigest } = require('./format-digest');
const fetch = require('node-fetch');

async function runCouncil() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('   BUSINESS INTELLIGENCE COUNCIL — NIGHTLY RUN');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Step 1: Sync all data
    console.log('Step 1/4: Syncing data sources...\n');
    await syncAll();

    // Step 2: Run expert analyses (parallel)
    console.log('\nStep 2/4: Running expert analyses...\n');
    const { sessionId, analyses } = await runExperts();

    // Step 3: Synthesize findings
    console.log('\nStep 3/4: Synthesizing findings...\n');
    const synthesis = await synthesizer.synthesize(sessionId);

    // Step 4: Format and deliver digest
    console.log('\nStep 4/4: Delivering nightly digest...\n');
    const digest = formatDigest(synthesis);

    // Post to Telegram
    await postToTelegram(digest);

    // Save to file (archive)
    const date = new Date().toISOString().split('T')[0];
    const fs = require('fs');
    fs.writeFileSync(
      `/Volumes/reeseai-memory/bi-council/digests/${date}-council-digest.md`,
      digest
    );

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   ✓ BUSINESS INTELLIGENCE COUNCIL COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return { sessionId, digest };

  } catch (err) {
    console.error('\n✗ COUNCIL RUN FAILED:', err.message);
    throw err;
  }
}

async function postToTelegram(digest) {
  // Post via OpenClaw message tool
  await fetch('http://localhost:18789/api/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'send',
      channel: 'telegram',
      message: digest
    })
  });

  console.log('✓ Digest posted to Telegram');
}

// CLI entry point
if (require.main === module) {
  runCouncil()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { runCouncil };
```

### 4.3 CLI for Deep Dive

**File:** `skills/bi-council/council-cli.js`

```javascript
#!/usr/bin/env node

const Database = require('better-sqlite3');
const COUNCIL_DB = '/Volumes/reeseai-memory/data/bi-council/council-history.db';

const db = new Database(COUNCIL_DB);

const command = process.argv[2];
const arg1 = process.argv[3];
const arg2 = process.argv[4];

switch (command) {
  case 'explore':
    exploreSession(arg1);
    break;
  case 'accept':
    acceptRecommendation(arg1);
    break;
  case 'reject':
    rejectRecommendation(arg1, arg2);
    break;
  case 'history':
    showHistory(arg1 || 7);
    break;
  default:
    showHelp();
}

function exploreSession(sessionId) {
  if (!sessionId) {
    console.error('Usage: council explore <session-id>');
    process.exit(1);
  }

  const session = db.prepare('SELECT * FROM council_sessions WHERE id = ?').get(sessionId);
  if (!session) {
    console.error(`Session ${sessionId} not found`);
    process.exit(1);
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`COUNCIL SESSION ${sessionId} — ${session.session_date}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // Expert analyses
  console.log('## EXPERT ANALYSES\n');
  const analyses = db.prepare('SELECT * FROM expert_analyses WHERE session_id = ?').all(sessionId);
  for (const analysis of analyses) {
    console.log(`**${analysis.expert_name}** (Risk: ${analysis.risk_level})`);
    console.log(analysis.analysis_text);
    console.log();
  }

  // All recommendations
  console.log('\n## ALL RECOMMENDATIONS\n');
  const recs = db.prepare(`
    SELECT * FROM recommendations
    WHERE session_id = ?
    ORDER BY combined_rank DESC
  `).all(sessionId);

  for (const rec of recs) {
    console.log(`[${rec.id}] ${rec.recommendation_text}`);
    console.log(`    Impact: ${rec.impact_score}/10 | Urgency: ${rec.urgency_score}/10 | Status: ${rec.status}`);
    console.log(`    From: ${rec.expert_name}`);
    console.log(`    Rationale: ${rec.rationale}\n`);
  }

  // Synthesis
  console.log('\n## SYNTHESIS\n');
  const synthesis = db.prepare('SELECT * FROM synthesis WHERE session_id = ?').get(sessionId);
  if (synthesis) {
    console.log(synthesis.executive_summary);
    console.log(`\nKey Metrics: ${synthesis.key_metrics}`);
    console.log(`Risk Alerts: ${synthesis.risk_alerts}`);
  }
}

function acceptRecommendation(recId) {
  if (!recId) {
    console.error('Usage: council accept <recommendation-id>');
    process.exit(1);
  }

  const rec = db.prepare('SELECT * FROM recommendations WHERE id = ?').get(recId);
  if (!rec) {
    console.error(`Recommendation ${recId} not found`);
    process.exit(1);
  }

  db.prepare(`
    UPDATE recommendations
    SET status = 'accepted', feedback_at = datetime('now')
    WHERE id = ?
  `).run(recId);

  console.log(`✓ Recommendation ${recId} accepted`);
  console.log(`  "${rec.recommendation_text}"`);
  console.log(`\nNext: Implement this recommendation and mark as 'implemented' when done.`);
}

function rejectRecommendation(recId, reason) {
  if (!recId) {
    console.error('Usage: council reject <recommendation-id> <reason>');
    process.exit(1);
  }

  const rec = db.prepare('SELECT * FROM recommendations WHERE id = ?').get(recId);
  if (!rec) {
    console.error(`Recommendation ${recId} not found`);
    process.exit(1);
  }

  db.prepare(`
    UPDATE recommendations
    SET status = 'rejected', feedback_at = datetime('now'), feedback_notes = ?
    WHERE id = ?
  `).run(reason || 'No reason provided', recId);

  console.log(`✗ Recommendation ${recId} rejected`);
  console.log(`  "${rec.recommendation_text}"`);
  if (reason) {
    console.log(`  Reason: ${reason}`);
  }
}

function showHistory(days) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const sessions = db.prepare(`
    SELECT * FROM council_sessions
    WHERE session_date >= ?
    ORDER BY session_date DESC
  `).all(since);

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`COUNCIL HISTORY (Last ${days} days)`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  for (const session of sessions) {
    const recCount = db.prepare('SELECT COUNT(*) as count FROM recommendations WHERE session_id = ?').get(session.id).count;
    const acceptedCount = db.prepare('SELECT COUNT(*) as count FROM recommendations WHERE session_id = ? AND status = "accepted"').get(session.id).count;

    console.log(`[${session.id}] ${session.session_date}`);
    console.log(`    Recommendations: ${recCount} (${acceptedCount} accepted)`);
    console.log(`    Status: ${session.status}`);
    console.log();
  }

  console.log(`\nUse 'council explore <session-id>' for details`);
}

function showHelp() {
  console.log(`
Business Intelligence Council CLI

Usage:
  council explore <session-id>             Deep dive into a council session
  council accept <recommendation-id>       Accept a recommendation
  council reject <recommendation-id> <reason>  Reject a recommendation
  council history [days]                   Show recent council sessions (default: 7 days)

Examples:
  council explore 42
  council accept 128
  council reject 129 "Not a priority right now"
  council history 14
  `);
}
```

### 4.4 Cron Integration

**Cron Job** (OpenClaw gateway):

```json
{
  "name": "BI Council: Nightly Run (10 PM)",
  "schedule": { "kind": "cron", "expr": "0 22 * * *", "tz": "America/New_York" },
  "payload": { 
    "kind": "systemEvent", 
    "text": "exec node /workspace/skills/bi-council/run-council.js"
  },
  "sessionTarget": "main",
  "enabled": true
}
```

## Deliverables

- [ ] Data sync layer (5 databases: team-chat, tasks, crm, social, finance)
- [ ] Sync scripts for each data source (Telegram, MC, CRM, social)
- [ ] Financial import tool (CSV → SQLite)
- [ ] Sync orchestrator with cron jobs (3h/4h intervals)
- [ ] Expert analysis framework (6 experts with Opus)
- [ ] Expert configurations (Scout, Ada, Ed, Dewey, Brunel, Walt)
- [ ] Parallel execution engine
- [ ] Synthesis layer (Marcus on Sonnet)
- [ ] Nightly digest formatter
- [ ] Main council runner script
- [ ] Council history database
- [ ] CLI for deep dive & feedback
- [ ] Feedback loop (accept/reject recommendations)
- [ ] Cron job for nightly run (10 PM)
- [ ] Documentation in SKILL.md
- [ ] Git commit: "feat: business intelligence council system"

## Testing

1. **Data sync test:**
   - Run `node sync-all.js`
   - Verify all 5 databases populated

2. **Expert analysis test:**
   - Run `node run-experts.js`
   - Verify 6 expert analyses generated
   - Check recommendations stored

3. **Synthesis test:**
   - Run full council
   - Verify synthesis merges insights
   - Check digest formatting

4. **Delivery test:**
   - Verify Telegram post works
   - Check digest saved to archive

5. **CLI test:**
   - `council explore <session-id>`
   - `council accept <rec-id>`
   - `council reject <rec-id> "reason"`
   - Verify feedback stored

6. **Cron test:**
   - Set cron to run in 5 minutes
   - Verify full pipeline executes

## Notes

- **Model costs:** Opus for 6 expert analyses (~20K tokens each) = ~120K tokens/night. At $15/1M tokens = ~$1.80/night or ~$54/month. Acceptable for comprehensive strategic intelligence.
- **Synthesis uses Sonnet** to keep costs reasonable (fewer tokens, less critical than expert analysis)
- **Parallel execution** cuts total runtime from ~30 min sequential to ~5-7 min parallel
- **Feedback loop** tunes future analysis by tracking accepted vs rejected recommendations
- **Cross-domain brief** provides experts with context outside their domain (prevents siloed thinking)
- **Council history** enables trend analysis (are recommendations improving? are we acting on them?)
- **Morning briefing + nightly council** serve different decision-making modes (tactical vs strategic)

## Future Enhancements

- **Auto-tuning:** Adjust expert weights based on accepted recommendation rates
- **Predictive alerts:** Detect trends before they become problems
- **Scenario modeling:** "What if we doubled ad spend?" simulations
- **Competitor benchmarking:** Automated competitive intelligence
- **Integration with Mission Control:** Create tasks from accepted recommendations
- **Weekly/monthly council variants:** Different cadences for different analysis depths
