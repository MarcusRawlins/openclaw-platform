/**
 * Core Logging Library
 * Singleton, WriteStream-based, per-event JSONL files + unified all.jsonl
 * Never throws, auto-creates event files, flushes on SIGTERM/SIGINT
 */

const fs = require('fs');
const path = require('path');
const { redact } = require('./redact');
const config = require('./config.json');

class Logger {
  static _instance = null;
  
  static getInstance() {
    if (!Logger._instance) {
      Logger._instance = new Logger();
    }
    return Logger._instance;
  }

  constructor() {
    if (Logger._instance) {
      throw new Error('Logger is a singleton. Use Logger.getInstance()');
    }

    this.logDir = config.log_dir;
    this.minLevel = config.min_level || 'info';
    this._openStreams = new Map();  // event_name → WriteStream
    this._allStream = null;
    
    // Ensure log directory exists
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (err) {
      process.stderr.write(`[logging] Failed to create log directory: ${err.message}\n`);
    }
    
    // Open unified stream
    try {
      this._allStream = fs.createWriteStream(
        path.join(this.logDir, 'all.jsonl'),
        { flags: 'a', encoding: 'utf8' }
      );
    } catch (err) {
      process.stderr.write(`[logging] Failed to open all.jsonl: ${err.message}\n`);
    }
    
    // Periodic flush
    this._flushTimer = setInterval(() => this.flush(), config.flush_interval_ms || 3000);
    
    // Flush on exit
    const cleanup = () => {
      this.flush();
      this.close();
    };
    
    process.on('beforeExit', cleanup);
    process.on('SIGTERM', () => { cleanup(); process.exit(0); });
    process.on('SIGINT', () => { cleanup(); process.exit(0); });
  }

  _levelNum(level) {
    const levels = { debug: 0, info: 1, warn: 2, error: 3, fatal: 4 };
    return levels[level] || 1;
  }

  _shouldLog(level) {
    return this._levelNum(level) >= this._levelNum(this.minLevel);
  }

  _getEventStream(eventName) {
    if (!this._openStreams.has(eventName)) {
      const filename = `${eventName}.jsonl`;
      try {
        const stream = fs.createWriteStream(
          path.join(this.logDir, filename),
          { flags: 'a', encoding: 'utf8' }
        );
        this._openStreams.set(eventName, stream);
      } catch (err) {
        process.stderr.write(`[logging] Failed to create stream for ${eventName}: ${err.message}\n`);
        return null;
      }
    }
    return this._openStreams.get(eventName);
  }

  _write(level, event, data = {}, meta = {}) {
    if (!this._shouldLog(level)) return;

    const entry = {
      ts: new Date().toISOString(),
      event,
      level,
      ...meta,
      data: redact(data),
      error: data.error || null
    };

    const line = JSON.stringify(entry) + '\n';

    // Write to per-event file
    try {
      const eventStream = this._getEventStream(event);
      if (eventStream && eventStream.writable) {
        eventStream.write(line);
      }
    } catch (err) {
      // Logging should never crash the caller
      process.stderr.write(`[logging] Failed to write to ${event}.jsonl: ${err.message}\n`);
    }

    // Mirror to unified stream
    try {
      if (this._allStream && this._allStream.writable) {
        this._allStream.write(line);
      }
    } catch (err) {
      process.stderr.write(`[logging] Failed to write to all.jsonl: ${err.message}\n`);
    }

    // Fatal also goes to stderr
    if (level === 'fatal') {
      process.stderr.write(`[FATAL] ${event}: ${JSON.stringify(data)}\n`);
    }
  }

  debug(event, data = {}, meta = {}) { this._write('debug', event, data, meta); }
  info(event, data = {}, meta = {})  { this._write('info', event, data, meta); }
  warn(event, data = {}, meta = {})  { this._write('warn', event, data, meta); }
  error(event, data = {}, meta = {}) { this._write('error', event, data, meta); }
  fatal(event, data = {}, meta = {}) { this._write('fatal', event, data, meta); }

  flush() {
    // Flush all open streams
    const promises = [];
    
    for (const stream of this._openStreams.values()) {
      if (stream.writable) {
        promises.push(new Promise((resolve) => {
          if (stream.writableLength === 0) {
            resolve();
          } else {
            stream.once('drain', resolve);
            stream.write('', () => resolve());
          }
        }));
      }
    }
    
    if (this._allStream && this._allStream.writable) {
      promises.push(new Promise((resolve) => {
        if (this._allStream.writableLength === 0) {
          resolve();
        } else {
          this._allStream.once('drain', resolve);
          this._allStream.write('', () => resolve());
        }
      }));
    }
    
    // For synchronous callers, return immediately
    // Streams will flush in background
  }

  close() {
    if (this._flushTimer) {
      clearInterval(this._flushTimer);
      this._flushTimer = null;
    }
    
    for (const stream of this._openStreams.values()) {
      if (stream.writable) {
        stream.end();
      }
    }
    this._openStreams.clear();
    
    if (this._allStream && this._allStream.writable) {
      this._allStream.end();
    }
  }
}

module.exports = Logger;
