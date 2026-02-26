const config = require('./config.json');

class ErrorReporter {
  /**
   * Report a failure to the user via messaging platform.
   * This is the ONLY way the user knows something went wrong
   * in background processes (cron, subagents, etc.).
   */
  static async report({ title, error, context, severity = 'error', agent = 'system' }) {
    const message = formatErrorMessage({ title, error, context, severity, agent });

    // Log to error tracker
    try {
      const ErrorTracker = require('./learnings/error-tracker');
      const tracker = new ErrorTracker();
      tracker.scan(typeof error === 'string' ? error : error.message, { source: agent });
    } catch { /* tracker not available */ }

    // Log to logging system
    try {
      const Logger = require('/Users/marcusrawlins/.openclaw/workspace/skills/logging/logger');
      Logger.getInstance().error('system.error', {
        title,
        error: typeof error === 'string' ? error : error.message,
        context,
        agent
      });
    } catch { /* logger not available */ }

    // The actual notification is sent by the calling agent via its messaging tools
    // This function returns the formatted message for the agent to send
    return message;
  }

  /**
   * Wrap an async function with automatic error reporting.
   * Use this around cron jobs, background tasks, etc.
   */
  static wrapWithReporting(fn, context = {}) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        const message = await ErrorReporter.report({
          title: context.title || 'Background task failed',
          error,
          context: context.description || fn.name,
          severity: context.severity || 'error',
          agent: context.agent || 'system'
        });

        // Re-throw so the caller knows it failed
        error._reported = true;
        error._reportMessage = message;
        throw error;
      }
    };
  }
}

function formatErrorMessage({ title, error, context, severity, agent }) {
  const emoji = {
    critical: '🚨',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  }[severity] || '❌';

  const errorStr = typeof error === 'string' ? error : (error.message || String(error));
  const stack = error?.stack ? `\n\nStack: ${error.stack.split('\n').slice(0, 3).join('\n')}` : '';

  return `${emoji} **${title}**

**Agent:** ${agent}
**Context:** ${context}
**Error:** ${errorStr}
**Time:** ${new Date().toISOString()}${stack}`;
}

module.exports = ErrorReporter;
