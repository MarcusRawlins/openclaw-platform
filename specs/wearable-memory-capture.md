# Wearable Memory Capture System
## Specification v1.0

**Author:** Marcus Rawlins (Opus)
**Date:** 2026-02-26
**Priority:** MEDIUM
**Estimated Build:** 3-4 days (Brunel)
**Location:** `/workspace/skills/wearable-memory/`

---

## 1. Overview

Continuous transcription capture from a wearable device (recording pendant, smart glasses, or any device with a transcription API). Streams or polls transcriptions into structured daily markdown files, tags entries by type, provides natural language search, and enforces Confidential-tier privacy.

## 2. Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   wearable-memory/                         │
├──────────────────────────────────────────────────────────┤
│  stream.js           Live transcription stream handler    │
│  poll.js             Backup poll (every 10 min)           │
│  parser.js           Parse + tag transcriptions           │
│  writer.js           Write to daily markdown files        │
│  dedup.js            Deduplication engine                 │
│  search.js           Natural language memory search       │
│  connectors/                                              │
│  ├─ limitless.js     Limitless pendant API                │
│  ├─ otter.js         Otter.ai API                         │
│  ├─ generic-ws.js    Generic WebSocket stream             │
│  └─ file-watch.js    Watch a directory for new transcripts│
│  db.js               SQLite index for fast search         │
│  config.json         Device config, paths, privacy        │
│  SKILL.md            Integration guide                    │
└──────────────────────────────────────────────────────────┘

Flow:

  Wearable Device
       │
       ├──▶ [stream.js] ──▶ live transcription events
       │         │
       │         ▼
       │    [parser.js] ──▶ tag: conversation | fact | todo | voice-memo
       │         │
       │         ▼
       │    [dedup.js] ──▶ check against already-saved entries
       │         │
       │         ▼
       │    [writer.js] ──▶ memory/YYYY-MM-DD.md
       │         │
       │         ▼
       │    [db.js] ──▶ SQLite index (timestamps, tags, embeddings)
       │
       └──▶ [poll.js] ──▶ every 10 min, fetch missed transcriptions
                │               same pipeline as above
                ▼
           [dedup.js] ──▶ skip already-saved
```

## 3. Daily Markdown Format

```markdown
# 2026-02-26 — Wearable Memory

## 09:15 — Conversation
**Context:** Morning standup
> Tyler mentioned the AnselAI demo is moving to Thursday. Alex said she'd handle
> the shot list for the Wilson wedding this weekend. Need to coordinate gear check
> by Friday.

**Tags:** #meeting #anselai #wilson-wedding
**People:** Tyler, Alex

---

## 10:42 — Voice Memo
> Remember to follow up with the venue coordinator at Britton Manor about the
> October availability. They said they'd have the 2026 calendar by end of month.

**Tags:** #todo #britton-manor #venue
**Action:** Follow up with Britton Manor re: October 2026 availability

---

## 12:30 — Conversation
**Context:** Lunch with Jake
> Jake recommended that new Thai place on Elm Street, said the pad see ew is
> incredible. Also mentioned he's looking for a photographer for his sister's
> wedding in April. Sent him our inquiry link.

**Tags:** #personal #referral #restaurant
**People:** Jake
**Action:** Check if Jake's sister submitted an inquiry

---

## 14:05 — Fact
> Client budget range for destination weddings is typically $8k-$15k for
> photography alone. European destinations command premium.

**Tags:** #pricing #business #destination
```

## 4. Stream Handler (`stream.js`)

```javascript
const Parser = require('./parser');
const Dedup = require('./dedup');
const Writer = require('./writer');
const config = require('./config.json');

class StreamHandler {
  constructor() {
    this.parser = new Parser();
    this.dedup = new Dedup();
    this.writer = new Writer();
    this.connector = null;
    this.buffer = [];
    this.flushInterval = config.stream?.flush_interval_ms || 30000; // 30s
  }

  async start() {
    // Load the configured connector
    const connectorType = config.device?.connector || 'file-watch';
    const ConnectorClass = require(`./connectors/${connectorType}`);
    this.connector = new ConnectorClass(config.device);

    console.log(`Starting stream handler (connector: ${connectorType})...`);

    // Set up event handler
    this.connector.on('transcription', async (raw) => {
      try {
        // Parse and tag
        const entry = await this.parser.parse(raw);
        
        // Deduplicate
        if (this.dedup.isDuplicate(entry)) {
          return; // Skip
        }

        // Buffer for batch writing
        this.buffer.push(entry);
      } catch (err) {
        console.error(`Stream parse error: ${err.message}`);
      }
    });

    // Periodic flush
    this._flushTimer = setInterval(() => this.flush(), this.flushInterval);

    // Connect
    await this.connector.connect();
    console.log('Stream connected.');
  }

  async flush() {
    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    for (const entry of entries) {
      await this.writer.write(entry);
      this.dedup.markSaved(entry);
    }

    // Log to logging system
    try {
      const Logger = require('/workspace/skills/logging/logger');
      Logger.getInstance().info('wearable.flush', {
        entries: entries.length,
        types: entries.map(e => e.type)
      });
    } catch {}
  }

  async stop() {
    clearInterval(this._flushTimer);
    await this.flush(); // Final flush
    if (this.connector) await this.connector.disconnect();
    console.log('Stream handler stopped.');
  }
}

module.exports = StreamHandler;
```

## 5. Backup Poll (`poll.js`)

```javascript
const Parser = require('./parser');
const Dedup = require('./dedup');
const Writer = require('./writer');
const config = require('./config.json');

class BackupPoll {
  constructor() {
    this.parser = new Parser();
    this.dedup = new Dedup();
    this.writer = new Writer();
    this.pollInterval = config.poll?.interval_ms || 600000; // 10 min
  }

  async pollOnce() {
    const connectorType = config.device?.connector || 'file-watch';
    const ConnectorClass = require(`./connectors/${connectorType}`);
    const connector = new ConnectorClass(config.device);

    // Fetch recent transcriptions (last poll window + buffer)
    const since = new Date(Date.now() - this.pollInterval - 60000); // +1 min overlap
    const transcriptions = await connector.fetchRecent(since);

    let saved = 0;
    let skipped = 0;

    for (const raw of transcriptions) {
      try {
        const entry = await this.parser.parse(raw);

        if (this.dedup.isDuplicate(entry)) {
          skipped++;
          continue;
        }

        await this.writer.write(entry);
        this.dedup.markSaved(entry);
        saved++;
      } catch (err) {
        console.error(`Poll parse error: ${err.message}`);
      }
    }

    console.log(`Poll: ${saved} new, ${skipped} duplicates, ${transcriptions.length} total`);
    return { saved, skipped, total: transcriptions.length };
  }

  // Run as continuous poller
  async startPolling() {
    console.log(`Starting backup poll (every ${this.pollInterval / 1000}s)...`);

    // Initial poll
    await this.pollOnce();

    // Recurring
    this._timer = setInterval(async () => {
      try {
        await this.pollOnce();
      } catch (err) {
        console.error(`Poll error: ${err.message}`);
      }
    }, this.pollInterval);
  }

  stop() {
    if (this._timer) clearInterval(this._timer);
  }
}

module.exports = BackupPoll;
```

## 6. Parser & Tagger (`parser.js`)

```javascript
const crypto = require('crypto');

class TranscriptionParser {
  constructor() {
    this.todoPatterns = [
      /\bremind me\b/i,
      /\bneed to\b/i,
      /\bdon't forget\b/i,
      /\bfollow up\b/i,
      /\bmake sure\b/i,
      /\btodo\b/i,
      /\baction item\b/i,
      /\bschedule\b/i,
      /\bset up\b/i
    ];

    this.factPatterns = [
      /\bthe (?:price|cost|rate) (?:is|was)\b/i,
      /\baccording to\b/i,
      /\bapparently\b/i,
      /\bI learned\b/i,
      /\bdid you know\b/i,
      /\bthe answer is\b/i,
      /\bit turns out\b/i
    ];

    this.memoPatterns = [
      /\bnote to self\b/i,
      /\bremember\b/i,
      /\bfor the record\b/i,
      /\bjust thinking\b/i
    ];
  }

  async parse(raw) {
    // Normalize input (handles different connector formats)
    const normalized = this._normalize(raw);

    // Detect entry type
    const type = this._detectType(normalized.text);

    // Extract people mentioned
    const people = this._extractPeople(normalized.text);

    // Extract action items
    const actions = this._extractActions(normalized.text);

    // Generate tags
    const tags = this._generateTags(normalized.text, type);

    // Create hash for dedup
    const hash = crypto.createHash('sha256')
      .update(normalized.text.substring(0, 200) + normalized.timestamp)
      .digest('hex')
      .substring(0, 16);

    return {
      timestamp: normalized.timestamp,
      text: normalized.text,
      type,
      context: normalized.context || null,
      people,
      actions,
      tags,
      hash,
      source: normalized.source || 'wearable',
      duration_seconds: normalized.duration || null,
      confidence: normalized.confidence || null
    };
  }

  _normalize(raw) {
    // Handle different input formats
    if (typeof raw === 'string') {
      return {
        text: raw.trim(),
        timestamp: new Date().toISOString()
      };
    }

    return {
      text: (raw.text || raw.transcript || raw.content || '').trim(),
      timestamp: raw.timestamp || raw.created_at || raw.ts || new Date().toISOString(),
      context: raw.context || raw.title || null,
      source: raw.source || raw.device || 'wearable',
      duration: raw.duration || raw.duration_seconds || null,
      confidence: raw.confidence || raw.score || null
    };
  }

  _detectType(text) {
    // Check for voice memo patterns first (most intentional)
    if (this.memoPatterns.some(p => p.test(text))) return 'voice-memo';

    // Check for todos/action items
    if (this.todoPatterns.some(p => p.test(text))) return 'todo';

    // Check for facts/information
    if (this.factPatterns.some(p => p.test(text))) return 'fact';

    // Default: conversation
    return 'conversation';
  }

  _extractPeople(text) {
    // Simple proper noun extraction (names typically start sentences or follow "with")
    const people = new Set();
    
    // "with [Name]" pattern
    const withPattern = /\bwith\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g;
    let match;
    while ((match = withPattern.exec(text))) {
      people.add(match[1]);
    }

    // "[Name] said/mentioned/told" pattern
    const saidPattern = /\b([A-Z][a-z]+)\s+(?:said|mentioned|told|asked|suggested|recommended)\b/g;
    while ((match = saidPattern.exec(text))) {
      people.add(match[1]);
    }

    return [...people];
  }

  _extractActions(text) {
    const actions = [];
    const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);

    for (const sentence of sentences) {
      if (this.todoPatterns.some(p => p.test(sentence))) {
        actions.push(sentence);
      }
    }

    return actions;
  }

  _generateTags(text, type) {
    const tags = [`#${type}`];
    const lowerText = text.toLowerCase();

    // Domain-specific tags
    const tagPatterns = [
      { pattern: /wedding|bride|groom|ceremony|reception/i, tag: '#wedding' },
      { pattern: /client|inquiry|booking|lead/i, tag: '#business' },
      { pattern: /anselai|crm|saas|rehive/i, tag: '#tech' },
      { pattern: /edit|gallery|lightroom|photo/i, tag: '#photography' },
      { pattern: /price|cost|budget|revenue|invoice/i, tag: '#pricing' },
      { pattern: /meeting|call|standup|sync/i, tag: '#meeting' },
      { pattern: /restaurant|food|lunch|dinner|coffee/i, tag: '#personal' },
      { pattern: /venue|location|britton|manor/i, tag: '#venue' },
      { pattern: /idea|concept|strategy|plan/i, tag: '#strategy' }
    ];

    for (const { pattern, tag } of tagPatterns) {
      if (pattern.test(lowerText) && !tags.includes(tag)) {
        tags.push(tag);
      }
    }

    return tags;
  }
}

module.exports = TranscriptionParser;
```

## 7. Writer (`writer.js`)

```javascript
const fs = require('fs');
const path = require('path');
const config = require('./config.json');

class MemoryWriter {
  constructor() {
    this.memoryDir = config.memory_dir || '/Users/marcusrawlins/.openclaw/workspace/memory';
  }

  async write(entry) {
    const date = entry.timestamp.substring(0, 10);
    const time = entry.timestamp.substring(11, 16);
    const filePath = path.join(this.memoryDir, `${date}.md`);

    // Create file with header if it doesn't exist
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, `# ${date} — Daily Notes\n\n`);
    }

    // Format the entry
    const formatted = this._format(entry, time);

    // Append
    fs.appendFileSync(filePath, formatted);

    // Also index in SQLite for search
    await this._index(entry, date);

    return filePath;
  }

  _format(entry, time) {
    let md = `## ${time} — ${this._typeLabel(entry.type)}\n`;

    if (entry.context) {
      md += `**Context:** ${entry.context}\n`;
    }

    md += `> ${entry.text.split('\n').join('\n> ')}\n\n`;

    if (entry.tags.length > 0) {
      md += `**Tags:** ${entry.tags.join(' ')}\n`;
    }

    if (entry.people.length > 0) {
      md += `**People:** ${entry.people.join(', ')}\n`;
    }

    if (entry.actions.length > 0) {
      for (const action of entry.actions) {
        md += `**Action:** ${action}\n`;
      }
    }

    md += '\n---\n\n';
    return md;
  }

  _typeLabel(type) {
    const labels = {
      'conversation': 'Conversation',
      'fact': 'Fact',
      'todo': 'Todo',
      'voice-memo': 'Voice Memo'
    };
    return labels[type] || type;
  }

  async _index(entry, date) {
    try {
      const MemoryDB = require('./db');
      const db = new MemoryDB();
      await db.indexEntry({
        date,
        timestamp: entry.timestamp,
        type: entry.type,
        text: entry.text,
        tags: entry.tags.join(','),
        people: entry.people.join(','),
        actions: entry.actions.join('; '),
        hash: entry.hash,
        source: entry.source
      });
    } catch (err) {
      // Don't fail write if indexing fails
      console.error(`Index error: ${err.message}`);
    }
  }
}

module.exports = MemoryWriter;
```

## 8. Deduplication (`dedup.js`)

```javascript
const fs = require('fs');
const path = require('path');
const config = require('./config.json');

class Deduplicator {
  constructor() {
    this.seenHashes = new Set();
    this.stateFile = path.join(
      config.data_dir || '/Volumes/reeseai-memory/data/wearable-memory',
      '.dedup-state.json'
    );
    this._loadState();
  }

  isDuplicate(entry) {
    if (!entry.hash) return false;

    // Check in-memory set
    if (this.seenHashes.has(entry.hash)) return true;

    // Check if similar text exists in today's file
    const date = entry.timestamp.substring(0, 10);
    const memoryFile = path.join(
      config.memory_dir || '/Users/marcusrawlins/.openclaw/workspace/memory',
      `${date}.md`
    );

    if (fs.existsSync(memoryFile)) {
      const content = fs.readFileSync(memoryFile, 'utf8');
      // Check for exact or near-exact text match (first 100 chars)
      const snippet = entry.text.substring(0, 100);
      if (content.includes(snippet)) return true;
    }

    return false;
  }

  markSaved(entry) {
    if (entry.hash) {
      this.seenHashes.add(entry.hash);
    }
    this._saveState();
  }

  // Reset at start of new day
  resetDaily() {
    this.seenHashes.clear();
    this._saveState();
  }

  _loadState() {
    try {
      if (fs.existsSync(this.stateFile)) {
        const data = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
        // Only load today's hashes
        const today = new Date().toISOString().substring(0, 10);
        if (data.date === today && data.hashes) {
          this.seenHashes = new Set(data.hashes);
        }
      }
    } catch {}
  }

  _saveState() {
    try {
      const dir = path.dirname(this.stateFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      fs.writeFileSync(this.stateFile, JSON.stringify({
        date: new Date().toISOString().substring(0, 10),
        hashes: [...this.seenHashes],
        count: this.seenHashes.size
      }));
    } catch {}
  }
}

module.exports = Deduplicator;
```

## 9. Search Interface (`search.js`)

```javascript
const fs = require('fs');
const path = require('path');
const config = require('./config.json');

class MemorySearch {
  constructor() {
    this.memoryDir = config.memory_dir || '/Users/marcusrawlins/.openclaw/workspace/memory';
  }

  // Natural language search using LLM
  async search(query, options = {}) {
    const days = options.days || 7;
    const maxResults = options.maxResults || 5;

    // Gather recent memory files
    const context = this._gatherContext(days);

    if (!context) {
      return { answer: 'No memory entries found for the requested time range.', sources: [] };
    }

    // Use LLM to search
    try {
      const { callLlm } = require('/workspace/skills/llm-router/router');

      const result = await callLlm({
        model: config.search?.model || 'lmstudio/gemma-3-12b-it',
        systemPrompt: `You are a memory search assistant. You have access to transcribed notes from a wearable device. Answer the user's question using ONLY information found in the provided memory entries. Include timestamps and context when relevant. If the information isn't in the memories, say so.`,
        prompt: `MEMORY ENTRIES:\n${context}\n\nQUESTION: ${query}`,
        maxTokens: 500,
        temperature: 0.2,
        agent: 'marcus',
        taskType: 'memory_search'
      });

      return {
        answer: result.text,
        sources: this._extractSources(context, result.text),
        tokensUsed: result.inputTokens + result.outputTokens
      };
    } catch (err) {
      // Fallback to simple text search
      return this.textSearch(query, days);
    }
  }

  // Simple keyword search (no LLM)
  textSearch(query, days = 7) {
    const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const results = [];
    const files = this._getRecentFiles(days);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const sections = content.split(/^## /m).filter(Boolean);

      for (const section of sections) {
        const lowerSection = section.toLowerCase();
        const matches = keywords.filter(k => lowerSection.includes(k));

        if (matches.length > 0) {
          results.push({
            date: path.basename(file, '.md'),
            text: section.substring(0, 300),
            relevance: matches.length / keywords.length,
            matchedKeywords: matches
          });
        }
      }
    }

    return {
      results: results.sort((a, b) => b.relevance - a.relevance).slice(0, 10),
      query,
      method: 'keyword'
    };
  }

  // Search by tag
  tagSearch(tag, days = 30) {
    const results = [];
    const files = this._getRecentFiles(days);
    const searchTag = tag.startsWith('#') ? tag : `#${tag}`;

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const sections = content.split(/^## /m).filter(Boolean);

      for (const section of sections) {
        if (section.includes(searchTag)) {
          results.push({
            date: path.basename(file, '.md'),
            text: section.substring(0, 300)
          });
        }
      }
    }

    return results;
  }

  // Search by person
  personSearch(name, days = 30) {
    const results = [];
    const files = this._getRecentFiles(days);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const sections = content.split(/^## /m).filter(Boolean);

      for (const section of sections) {
        if (section.includes(name)) {
          results.push({
            date: path.basename(file, '.md'),
            text: section.substring(0, 300)
          });
        }
      }
    }

    return results;
  }

  // Get all action items
  getActions(days = 7) {
    const actions = [];
    const files = this._getRecentFiles(days);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const actionPattern = /\*\*Action:\*\*\s*(.+)/g;
      let match;

      while ((match = actionPattern.exec(content))) {
        actions.push({
          date: path.basename(file, '.md'),
          action: match[1].trim()
        });
      }
    }

    return actions;
  }

  _gatherContext(days) {
    const files = this._getRecentFiles(days);
    if (files.length === 0) return null;

    let context = '';
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      // Truncate if too long (keep under 8000 chars for LLM context)
      const remaining = 8000 - context.length;
      if (remaining <= 0) break;
      context += content.substring(0, remaining) + '\n\n';
    }

    return context;
  }

  _getRecentFiles(days) {
    if (!fs.existsSync(this.memoryDir)) return [];

    const files = fs.readdirSync(this.memoryDir)
      .filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.md$/))
      .sort()
      .reverse();

    const cutoff = new Date(Date.now() - days * 86400000).toISOString().substring(0, 10);
    return files
      .filter(f => f.substring(0, 10) >= cutoff)
      .map(f => path.join(this.memoryDir, f));
  }

  _extractSources(context, answer) {
    // Extract dates and timestamps mentioned in the answer
    const dates = answer.match(/\d{4}-\d{2}-\d{2}/g) || [];
    const times = answer.match(/\d{2}:\d{2}/g) || [];
    return { dates: [...new Set(dates)], times: [...new Set(times)] };
  }
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  const search = new MemorySearch();

  if (args[0] === '--tag') {
    const results = search.tagSearch(args[1]);
    console.log(JSON.stringify(results, null, 2));
  } else if (args[0] === '--person') {
    const results = search.personSearch(args[1]);
    console.log(JSON.stringify(results, null, 2));
  } else if (args[0] === '--actions') {
    const actions = search.getActions(parseInt(args[1]) || 7);
    for (const a of actions) console.log(`[${a.date}] ${a.action}`);
  } else if (args.length > 0) {
    search.search(args.join(' ')).then(result => {
      console.log(result.answer);
    });
  } else {
    console.log(`Usage:
  node search.js <natural language query>
  node search.js --tag #wedding
  node search.js --person Jake
  node search.js --actions [days]`);
  }
}

module.exports = MemorySearch;
```

## 10. Connectors

### 10.1 Limitless Pendant (`connectors/limitless.js`)

```javascript
const EventEmitter = require('events');

class LimitlessConnector extends EventEmitter {
  constructor(config) {
    super();
    this.apiUrl = config.api_url || 'https://api.limitless.ai/v1';
    this.apiKey = process.env.LIMITLESS_API_KEY || config.api_key;
    this.lastFetchedId = null;
  }

  async connect() {
    // Limitless uses REST API with polling (no WebSocket currently)
    // The stream handler will use poll.js instead
    console.log('Limitless connector ready (poll-based)');
  }

  async fetchRecent(since) {
    if (!this.apiKey) throw new Error('LIMITLESS_API_KEY not set');

    const sinceTs = since instanceof Date ? since.toISOString() : since;

    const response = await fetch(`${this.apiUrl}/transcriptions?since=${sinceTs}`, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error(`Limitless API error: ${response.status}`);
    }

    const data = await response.json();
    return (data.transcriptions || []).map(t => ({
      text: t.text,
      timestamp: t.created_at,
      context: t.title || null,
      source: 'limitless',
      duration: t.duration_seconds,
      confidence: t.confidence
    }));
  }

  async disconnect() {}
}

module.exports = LimitlessConnector;
```

### 10.2 Generic WebSocket (`connectors/generic-ws.js`)

```javascript
const EventEmitter = require('events');

class GenericWebSocketConnector extends EventEmitter {
  constructor(config) {
    super();
    this.wsUrl = config.ws_url;
    this.ws = null;
    this.reconnectDelay = 5000;
  }

  async connect() {
    const WebSocket = require('ws');
    
    this.ws = new WebSocket(this.wsUrl);

    this.ws.on('message', (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        this.emit('transcription', parsed);
      } catch {
        // Raw text
        this.emit('transcription', { text: data.toString(), timestamp: new Date().toISOString() });
      }
    });

    this.ws.on('close', () => {
      console.log('WebSocket closed. Reconnecting...');
      setTimeout(() => this.connect(), this.reconnectDelay);
    });

    this.ws.on('error', (err) => {
      console.error(`WebSocket error: ${err.message}`);
    });

    return new Promise((resolve) => {
      this.ws.on('open', () => {
        console.log('WebSocket connected');
        resolve();
      });
    });
  }

  async fetchRecent(since) {
    // WebSocket is real-time only, no historical fetch
    return [];
  }

  async disconnect() {
    if (this.ws) this.ws.close();
  }
}

module.exports = GenericWebSocketConnector;
```

### 10.3 File Watcher (`connectors/file-watch.js`)

```javascript
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

class FileWatchConnector extends EventEmitter {
  constructor(config) {
    super();
    this.watchDir = config.watch_dir;
    this.processedFiles = new Set();
    this.watcher = null;
  }

  async connect() {
    if (!this.watchDir || !fs.existsSync(this.watchDir)) {
      throw new Error(`Watch directory not found: ${this.watchDir}`);
    }

    // Process existing files
    await this._processExisting();

    // Watch for new files
    this.watcher = fs.watch(this.watchDir, async (eventType, filename) => {
      if (eventType === 'rename' && filename && !this.processedFiles.has(filename)) {
        const filePath = path.join(this.watchDir, filename);
        if (fs.existsSync(filePath)) {
          await this._processFile(filePath, filename);
        }
      }
    });

    console.log(`Watching: ${this.watchDir}`);
  }

  async fetchRecent(since) {
    if (!this.watchDir || !fs.existsSync(this.watchDir)) return [];

    const results = [];
    const sinceMs = since instanceof Date ? since.getTime() : new Date(since).getTime();

    const files = fs.readdirSync(this.watchDir).filter(f => f.endsWith('.txt') || f.endsWith('.md') || f.endsWith('.json'));

    for (const file of files) {
      const filePath = path.join(this.watchDir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.mtimeMs >= sinceMs) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        if (file.endsWith('.json')) {
          try {
            const data = JSON.parse(content);
            results.push(Array.isArray(data) ? data : [data]);
          } catch {}
        } else {
          results.push({
            text: content,
            timestamp: stat.mtime.toISOString(),
            source: 'file',
            context: file
          });
        }
      }
    }

    return results.flat();
  }

  async _processExisting() {
    const files = fs.readdirSync(this.watchDir).filter(f => f.endsWith('.txt') || f.endsWith('.md'));
    for (const file of files) {
      // Only process today's files on startup
      const stat = fs.statSync(path.join(this.watchDir, file));
      const fileDate = stat.mtime.toISOString().substring(0, 10);
      const today = new Date().toISOString().substring(0, 10);
      
      if (fileDate === today && !this.processedFiles.has(file)) {
        await this._processFile(path.join(this.watchDir, file), file);
      }
    }
  }

  async _processFile(filePath, filename) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      this.emit('transcription', {
        text: content,
        timestamp: new Date().toISOString(),
        source: 'file',
        context: filename
      });
      this.processedFiles.add(filename);
    } catch (err) {
      console.error(`Error processing ${filename}: ${err.message}`);
    }
  }

  async disconnect() {
    if (this.watcher) this.watcher.close();
  }
}

module.exports = FileWatchConnector;
```

## 11. Database Index (`db.js`)

```javascript
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('./config.json');

const DB_PATH = path.join(
  config.data_dir || '/Volumes/reeseai-memory/data/wearable-memory',
  'memory-index.db'
);

class MemoryDB {
  constructor() {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');
    this._initSchema();
  }

  _initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        type TEXT NOT NULL,
        text TEXT NOT NULL,
        tags TEXT,
        people TEXT,
        actions TEXT,
        hash TEXT UNIQUE,
        source TEXT DEFAULT 'wearable',
        indexed_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_entries_date ON memory_entries(date);
      CREATE INDEX IF NOT EXISTS idx_entries_type ON memory_entries(type);
      CREATE INDEX IF NOT EXISTS idx_entries_tags ON memory_entries(tags);
      CREATE INDEX IF NOT EXISTS idx_entries_hash ON memory_entries(hash);

      CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
        text, tags, people, actions,
        content=memory_entries,
        content_rowid=id
      );

      -- Trigger to keep FTS in sync
      CREATE TRIGGER IF NOT EXISTS memory_ai AFTER INSERT ON memory_entries BEGIN
        INSERT INTO memory_fts(rowid, text, tags, people, actions)
        VALUES (new.id, new.text, new.tags, new.people, new.actions);
      END;
    `);
  }

  indexEntry(entry) {
    try {
      this.db.prepare(`
        INSERT OR IGNORE INTO memory_entries (date, timestamp, type, text, tags, people, actions, hash, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        entry.date, entry.timestamp, entry.type, entry.text,
        entry.tags, entry.people, entry.actions, entry.hash, entry.source
      );
    } catch (err) {
      if (!err.message.includes('UNIQUE')) throw err;
    }
  }

  // Full-text search
  search(query, limit = 10) {
    return this.db.prepare(`
      SELECT e.*, rank
      FROM memory_fts f
      JOIN memory_entries e ON e.id = f.rowid
      WHERE memory_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(query, limit);
  }

  // Get entries by date
  getByDate(date) {
    return this.db.prepare('SELECT * FROM memory_entries WHERE date = ? ORDER BY timestamp').all(date);
  }

  // Get entries by type
  getByType(type, days = 7) {
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().substring(0, 10);
    return this.db.prepare('SELECT * FROM memory_entries WHERE type = ? AND date >= ? ORDER BY timestamp DESC').all(type, cutoff);
  }

  // Get stats
  getStats() {
    return {
      total: this.db.prepare('SELECT COUNT(*) as count FROM memory_entries').get().count,
      byType: this.db.prepare('SELECT type, COUNT(*) as count FROM memory_entries GROUP BY type').all(),
      byDate: this.db.prepare('SELECT date, COUNT(*) as count FROM memory_entries GROUP BY date ORDER BY date DESC LIMIT 7').all(),
      latestEntry: this.db.prepare('SELECT timestamp FROM memory_entries ORDER BY timestamp DESC LIMIT 1').get()
    };
  }

  close() {
    this.db.close();
  }
}

module.exports = MemoryDB;
```

## 12. Configuration (`config.json`)

```json
{
  "device": {
    "connector": "file-watch",
    "watch_dir": "/Users/marcusrawlins/.openclaw/workspace/wearable-inbox",
    "api_url": null,
    "api_key_env": null,
    "ws_url": null
  },
  "memory_dir": "/Users/marcusrawlins/.openclaw/workspace/memory",
  "data_dir": "/Volumes/reeseai-memory/data/wearable-memory",
  "stream": {
    "flush_interval_ms": 30000
  },
  "poll": {
    "interval_ms": 600000,
    "enabled": true
  },
  "search": {
    "model": "lmstudio/gemma-3-12b-it",
    "max_context_chars": 8000,
    "default_days": 7
  },
  "privacy": {
    "tier": "confidential",
    "local_only": true,
    "no_cloud_sync": true,
    "only_private_chats": true
  }
}
```

## 13. Privacy Rules

Health data pipeline is biometric (Tier 1 Confidential). Wearable memory is even more sensitive: it's raw transcriptions of conversations.

**Strict privacy enforcement:**
- Classified as **Confidential (Tier 1)**: private/DM chats only
- NEVER loaded in group chat contexts
- NEVER included in external communications
- Local-only storage (no cloud sync by default)
- Daily notes in `memory/` directory already governed by context-gate.js
- Search results only returned in private conversations
- LLM search uses local model (zero API cost, data stays on device)
- No audio files stored (transcription text only)

## 14. Cron Integration

```json
[
  {
    "name": "wearable-poll",
    "schedule": { "kind": "every", "everyMs": 600000 },
    "payload": { "kind": "agentTurn", "message": "Run wearable memory poll: node /workspace/skills/wearable-memory/poll.js --once" },
    "sessionTarget": "isolated"
  }
]
```

## 15. Telegram Integration

Marcus can handle search queries from Tyler in DMs:

```
Tyler: "What was I talking about at lunch?"
Marcus: [searches wearable memory] → "At 12:30, you had lunch with Jake. He recommended 
        the Thai place on Elm Street and mentioned his sister needs a wedding photographer 
        for April. You sent him the inquiry link."

Tyler: "Did anyone mention a deadline?"
Marcus: [searches wearable memory] → "At 09:15 during standup, Tyler mentioned the AnselAI 
        demo is moving to Thursday. Alex said she'd handle the Wilson shot list and gear 
        check needs to happen by Friday."
```

## 16. CLI Interface

```bash
# Start stream handler
node wearable-memory/stream.js

# Run single poll
node wearable-memory/poll.js --once

# Search
node wearable-memory/search.js "what restaurant was recommended"
node wearable-memory/search.js --tag #wedding
node wearable-memory/search.js --person Jake
node wearable-memory/search.js --actions 7

# Stats
node wearable-memory/db.js --stats
```

## 17. File Structure

```
/workspace/skills/wearable-memory/
├── stream.js              # Live transcription stream handler
├── poll.js                # Backup poll (every 10 min)
├── parser.js              # Parse + tag transcriptions
├── writer.js              # Write to daily markdown files
├── dedup.js               # Deduplication engine
├── search.js              # Natural language memory search
├── connectors/
│   ├── limitless.js       # Limitless pendant API
│   ├── otter.js           # Otter.ai API
│   ├── generic-ws.js      # Generic WebSocket stream
│   └── file-watch.js      # Watch directory for transcripts
├── db.js                  # SQLite index (FTS5)
├── config.json            # Device config, privacy
├── SKILL.md               # Integration guide
├── README.md              # Overview
└── package.json           # Dependencies
```

## 18. Dependencies

- `better-sqlite3` (FTS5 search index)
- `ws` (optional, for WebSocket connector)
- Node.js built-ins: `fs`, `path`, `crypto`, `events`
- LLM Router (for natural language search)
- Logging infrastructure (for event logging)

## 19. Testing Checklist

- [ ] Parser: detects conversation, fact, todo, voice-memo types
- [ ] Parser: extracts people from "[Name] said" patterns
- [ ] Parser: extracts action items
- [ ] Parser: generates relevant tags
- [ ] Dedup: catches exact duplicate text
- [ ] Dedup: catches same-hash entries
- [ ] Dedup: resets daily
- [ ] Writer: creates daily markdown with correct format
- [ ] Writer: appends to existing files
- [ ] Writer: indexes in SQLite
- [ ] Search: natural language query returns relevant results
- [ ] Search: tag search works
- [ ] Search: person search works
- [ ] Search: action item extraction works
- [ ] File watch connector: processes new files
- [ ] Poll: fetches and deduplicates
- [ ] DB: FTS5 search returns ranked results
- [ ] Privacy: only accessible in private chats
