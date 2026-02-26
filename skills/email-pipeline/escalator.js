const path = require('path');
const { getDatabase } = require('./db');
const CONFIG = require('./config.json');

// Resolve skills directory (env var or default)
const SKILLS_DIR = process.env.OPENCLAW_SKILLS_PATH || 
                   path.join(process.env.HOME, '.openclaw/workspace/skills');

let logger;
try {
  const Logger = require(path.join(SKILLS_DIR, 'logging/logger'));
  logger = Logger.getInstance();
} catch (e) {
  logger = { 
    info: (event, data) => console.log(`[${event}]`, data),
    error: (event, data) => console.error(`[${event}]`, data),
    warn: (event, data) => console.warn(`[${event}]`, data)
  };
}

// Escalation rules by score bucket
const ESCALATION_RULES = {
  'exceptional': {
    notify_telegram: true,
    push_to_crm: true,
    priority: 'high',
    message_template: '🔥 Hot lead from {from_name} ({from_domain}): {subject} — Score: {score}'
  },
  'high': {
    notify_telegram: true,
    push_to_crm: true,
    priority: 'medium',
    message_template: '📬 New lead from {from_name}: {subject} — Score: {score}'
  },
  'medium': {
    notify_telegram: false,
    push_to_crm: true,
    priority: 'low'
  },
  'low': {
    notify_telegram: false,
    push_to_crm: false,
    auto_archive: false
  },
  'spam': {
    notify_telegram: false,
    push_to_crm: false,
    auto_archive: true
  }
};

function formatMessage(template, email) {
  return template
    .replace(/{from_name}/g, email.from_name || email.from_email)
    .replace(/{from_domain}/g, email.from_domain || '')
    .replace(/{from_email}/g, email.from_email)
    .replace(/{subject}/g, email.subject || '(no subject)')
    .replace(/{score}/g, email.score || 'N/A')
    .replace(/{score_bucket}/g, email.score_bucket || 'unknown');
}

// Send Telegram notification
async function sendTelegramNotification(email) {
  const rule = ESCALATION_RULES[email.score_bucket];
  
  if (!rule || !rule.notify_telegram) {
    return { sent: false, reason: 'Not configured for Telegram' };
  }

  try {
    const message = formatMessage(rule.message_template, email);
    
    // Send actual Telegram notification using execSync
    const { execSync } = require('child_process');
    const escapedMessage = message.replace(/"/g, '\\"').replace(/'/g, "\\'");
    
    try {
      execSync(`openclaw message send --text "${escapedMessage}"`, { 
        encoding: 'utf-8',
        timeout: 5000
      });
      logger.info('escalator.telegram_sent', { message, email_id: email.id });
      return { sent: true, message };
    } catch (execError) {
      logger.error('escalator.telegram_send_failed', { 
        error: execError.message,
        email_id: email.id 
      });
      return { sent: false, error: execError.message };
    }

  } catch (error) {
    logger.error('escalator.telegram_error', { error: error.message, email_id: email.id });
    return { sent: false, error: error.message };
  }
}

// Push to CRM (Mission Control task creation)
async function pushToCRM(email) {
  const rule = ESCALATION_RULES[email.score_bucket];
  
  if (!rule || !rule.push_to_crm) {
    return { pushed: false, reason: 'Not configured for CRM' };
  }

  try {
    // When AnselAI is live, this would create a lead record
    // For now, create a Mission Control task
    
    const taskData = {
      title: `Lead: ${email.from_name || email.from_email}`,
      description: `New ${email.score_bucket} lead (score: ${email.score})
      
From: ${email.from_name || ''} <${email.from_email}>
Subject: ${email.subject}
Domain: ${email.from_domain}

${email.body_text?.substring(0, 300)}...`,
      priority: rule.priority,
      tags: ['lead', email.score_bucket, email.account_id],
      metadata: {
        email_id: email.id,
        score: email.score,
        score_bucket: email.score_bucket,
        from_domain: email.from_domain
      }
    };

    // POST to Mission Control API
    try {
      const response = await fetch('http://192.168.68.105:3100/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });

      if (!response.ok) {
        throw new Error(`Mission Control API returned ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      logger.info('escalator.crm_task_created', { 
        email_id: email.id, 
        task_id: result.id,
        title: taskData.title 
      });
      return { pushed: true, task: result };
    } catch (fetchError) {
      logger.error('escalator.crm_push_failed', { 
        error: fetchError.message,
        email_id: email.id 
      });
      return { pushed: false, error: fetchError.message };
    }

  } catch (error) {
    logger.error('escalator.crm_error', { error: error.message, email_id: email.id });
    return { pushed: false, error: error.message };
  }
}

// Main escalation function
async function escalate(emailId) {
  const db = getDatabase();
  const email = db.prepare('SELECT * FROM emails WHERE id = ?').get(emailId);

  if (!email) {
    throw new Error(`Email ${emailId} not found`);
  }

  if (email.escalated) {
    logger.info('escalator.already_escalated', { email_id: emailId });
    db.close();
    return { already_escalated: true };
  }

  const results = {
    email_id: emailId,
    score_bucket: email.score_bucket,
    telegram: null,
    crm: null
  };

  // Send Telegram notification
  results.telegram = await sendTelegramNotification(email);

  // Push to CRM
  results.crm = await pushToCRM(email);

  // Mark as escalated
  if (results.telegram?.sent || results.crm?.pushed) {
    db.prepare('UPDATE emails SET escalated = 1 WHERE id = ?').run(emailId);
    logger.info('escalator.escalation_complete', { 
      email_id: emailId,
      telegram_sent: !!results.telegram?.sent,
      crm_pushed: !!results.crm?.pushed
    });
  }

  db.close();

  return results;
}

module.exports = {
  escalate,
  sendTelegramNotification,
  pushToCRM,
  ESCALATION_RULES
};
