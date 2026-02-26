/**
 * Logger wrapper for email pipeline
 * Provides simple API and fallback if logging skill unavailable
 */

let logger;

try {
  const Logger = require('../../skills/logging/logger');
  logger = Logger.getInstance();
} catch (error) {
  // Fallback to console logging if logging skill not available
  logger = {
    info: (event, message, data) => {
      console.log(`[${event}] ${message}`, data ? JSON.stringify(data) : '');
    },
    warn: (event, message, data) => {
      console.warn(`[${event}] ${message}`, data ? JSON.stringify(data) : '');
    },
    error: (event, message, data) => {
      console.error(`[${event}] ${message}`, data ? JSON.stringify(data) : '');
    },
    debug: (event, message, data) => {
      // Skip debug in fallback mode
    }
  };
}

module.exports = logger;
