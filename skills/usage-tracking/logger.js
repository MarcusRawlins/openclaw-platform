const fs = require('fs');
const path = require('path');
const config = require('./config.json');
const db = require('./db');
const redact = require('./redact');
const costEstimator = require('./cost-estimator');

/**
 * Fire-and-forget usage logger
 * Singleton pattern with buffered writes
 */

class UsageLogger {
  constructor() {
    this.llmBuffer = [];
    this.apiBuffer = [];
    this.flushTimer = null;
    this.flushing = false;
    
    // Start periodic flush
    this.startFlushTimer();
    
    // Ensure JSONL directory exists
    if (!fs.existsSync(config.logging.jsonl_dir)) {
      fs.mkdirSync(config.logging.jsonl_dir, { recursive: true });
    }
  }
  
  /**
   * Get singleton instance
   */
  static getInstance() {
    if (!UsageLogger._instance) {
      UsageLogger._instance = new UsageLogger();
    }
    return UsageLogger._instance;
  }
  
  /**
   * Start periodic flush timer
   */
  startFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    this.flushTimer = setInterval(() => {
      this.flush().catch(err => {
        console.error('[UsageLogger] Flush error:', err.message);
      });
    }, config.logging.flush_interval_ms);
  }
  
  /**
   * Log an LLM call
   * @param {object} params - Call parameters
   */
  logLLM(params) {
    try {
      const {
        agent,
        provider,
        model,
        taskType = null,
        taskDescription = null,
        prompt = '',
        response = '',
        inputTokens = 0,
        outputTokens = 0,
        cacheReadTokens = 0,
        cacheWriteTokens = 0,
        durationMs = null,
        sessionKey = null,
        status = 'success',
        errorMessage = null,
        metadata = null
      } = params;
      
      // Process prompt and response (redact + hash + preview)
      const promptData = redact.process(prompt);
      const responseData = redact.process(response);
      
      // Estimate cost
      const cost = costEstimator.estimateCost({
        provider,
        model,
        inputTokens,
        outputTokens,
        cacheReadTokens,
        cacheWriteTokens
      });
      
      // Build record
      const record = {
        timestamp: new Date().toISOString(),
        agent,
        provider,
        model,
        taskType,
        taskDescription,
        promptHash: promptData.hash,
        promptPreview: config.logging.store_prompt_preview ? promptData.preview : null,
        responsePreview: config.logging.store_prompt_preview ? responseData.preview : null,
        inputTokens,
        outputTokens,
        cacheReadTokens,
        cacheWriteTokens,
        durationMs,
        estimatedCostUsd: cost.cost_usd,
        status,
        errorMessage,
        sessionKey,
        metadata
      };
      
      // Add to buffer
      this.llmBuffer.push(record);
      
      // Write to JSONL
      this.writeJSONL('llm', {
        ts: record.timestamp,
        agent,
        provider,
        model,
        type: 'llm',
        task: taskType,
        in: inputTokens,
        out: outputTokens,
        cache_r: cacheReadTokens,
        cache_w: cacheWriteTokens,
        cost: cost.cost_usd,
        ms: durationMs,
        status: status === 'success' ? 'ok' : status
      });
      
      // Check if buffer needs immediate flush
      if (this.llmBuffer.length >= config.logging.buffer_size) {
        this.flush().catch(err => {
          console.error('[UsageLogger] Immediate flush error:', err.message);
        });
      }
    } catch (err) {
      // Fail silent - log to stderr only
      console.error('[UsageLogger] logLLM error:', err.message);
    }
  }
  
  /**
   * Log an API call (non-LLM)
   * @param {object} params - Call parameters
   */
  logAPI(params) {
    try {
      const {
        agent = null,
        service,
        endpoint = null,
        method = 'GET',
        statusCode = null,
        durationMs = null,
        requestSizeBytes = null,
        responseSizeBytes = null,
        estimatedCostUsd = null,
        errorMessage = null
      } = params;
      
      // Build record
      const record = {
        timestamp: new Date().toISOString(),
        agent,
        service,
        endpoint,
        method,
        statusCode,
        durationMs,
        requestSizeBytes,
        responseSizeBytes,
        estimatedCostUsd,
        errorMessage
      };
      
      // Add to buffer
      this.apiBuffer.push(record);
      
      // Write to JSONL
      this.writeJSONL('api', {
        ts: record.timestamp,
        agent,
        service,
        type: 'api',
        status: statusCode,
        ms: durationMs
      });
      
      // Check if buffer needs immediate flush
      if (this.apiBuffer.length >= config.logging.buffer_size) {
        this.flush().catch(err => {
          console.error('[UsageLogger] Immediate flush error:', err.message);
        });
      }
    } catch (err) {
      // Fail silent
      console.error('[UsageLogger] logAPI error:', err.message);
    }
  }
  
  /**
   * Write to JSONL log file
   * @param {string} type - 'llm' or 'api'
   * @param {object} data - Log data
   */
  writeJSONL(type, data) {
    try {
      const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const logFile = path.join(config.logging.jsonl_dir, `${date}.jsonl`);
      
      const line = JSON.stringify(data) + '\n';
      fs.appendFileSync(logFile, line);
    } catch (err) {
      // Fail silent
      console.error('[UsageLogger] JSONL write error:', err.message);
    }
  }
  
  /**
   * Flush buffered records to database
   */
  async flush() {
    // Prevent concurrent flushes
    if (this.flushing) return;
    
    // Nothing to flush
    if (this.llmBuffer.length === 0 && this.apiBuffer.length === 0) {
      return;
    }
    
    this.flushing = true;
    
    try {
      // Swap buffers (allow new logs while we flush)
      const llmToFlush = [...this.llmBuffer];
      const apiToFlush = [...this.apiBuffer];
      this.llmBuffer = [];
      this.apiBuffer = [];
      
      // Batch insert to database
      db.batchInsert(llmToFlush, apiToFlush);
      
      // Update daily aggregates for today
      const today = new Date().toISOString().split('T')[0];
      db.updateDailyAggregates(today);
      
    } catch (err) {
      console.error('[UsageLogger] Flush to database failed:', err.message);
      // Don't throw - fail silent
    } finally {
      this.flushing = false;
    }
  }
  
  /**
   * Shutdown logger (call on process exit)
   */
  async shutdown() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    
    // Final flush
    await this.flush();
    
    // Close database
    db.close();
  }
}

// Export singleton instance getter
module.exports = UsageLogger;
