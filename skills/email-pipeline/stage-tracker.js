#!/usr/bin/env node
const path = require('path');
const { getDatabase } = require('./db');
const { applyStageLabel } = require('./labeler');

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

// Legal state transitions
const TRANSITIONS = {
  'New':           ['Contacted', 'Lost', 'Archived'],
  'Contacted':     ['Qualified', 'Lost', 'Archived'],
  'Qualified':     ['Proposal Sent', 'Lost', 'Archived'],
  'Proposal Sent': ['Negotiating', 'Booked', 'Lost', 'Archived'],
  'Negotiating':   ['Booked', 'Lost', 'Archived'],
  'Booked':        ['Archived'],
  'Lost':          ['New'],     // can reopen
  'Archived':      ['New']      // can reopen
};

// Normalize stage label (remove "Stage/" prefix if present)
function normalizeStage(stage) {
  if (!stage) return null;
  return stage.replace(/^Stage\//i, '');
}

// Validate transition
function isValidTransition(fromStage, toStage) {
  const from = normalizeStage(fromStage);
  const to = normalizeStage(toStage);
  
  if (!from) {
    // First transition, can only go to "New"
    return to === 'New';
  }
  
  const allowedTransitions = TRANSITIONS[from];
  if (!allowedTransitions) {
    return false;
  }
  
  return allowedTransitions.includes(to);
}

// Change stage with validation and audit trail
function changeStage(db, emailId, toStage, changedBy = 'system', reason = null) {
  const email = db.prepare('SELECT * FROM emails WHERE id = ?').get(emailId);
  
  if (!email) {
    throw new Error(`Email ${emailId} not found`);
  }

  const fromStage = normalizeStage(email.stage_label);
  const normalizedToStage = normalizeStage(toStage);

  // Validate transition
  if (!isValidTransition(fromStage, normalizedToStage)) {
    const allowed = fromStage ? TRANSITIONS[fromStage]?.join(', ') : 'New';
    throw new Error(
      `Illegal stage transition for email ${emailId}: ${fromStage || '(none)'} → ${normalizedToStage}. ` +
      `Allowed from ${fromStage || '(none)'}: ${allowed}`
    );
  }

  // Record audit entry
  const auditStmt = db.prepare(`
    INSERT INTO stage_audit (email_id, thread_id, from_stage, to_stage, changed_by, reason)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  auditStmt.run(
    emailId,
    email.thread_id,
    fromStage,
    normalizedToStage,
    changedBy,
    reason
  );

  // Update stage label
  const stageLabel = `Stage/${normalizedToStage}`;
  applyStageLabel(db, emailId, stageLabel);

  logger.info('stage_tracker.stage_changed', {
    email_id: emailId,
    from_stage: fromStage,
    to_stage: normalizedToStage,
    changed_by: changedBy,
    reason
  });

  return stageLabel;
}

// Get audit trail for an email
function getAuditTrail(db, emailId) {
  const stmt = db.prepare(`
    SELECT from_stage, to_stage, changed_at, changed_by, reason
    FROM stage_audit
    WHERE email_id = ?
    ORDER BY changed_at ASC
  `);
  
  return stmt.all(emailId);
}

// Get audit trail for a thread
function getThreadAuditTrail(db, threadId) {
  const stmt = db.prepare(`
    SELECT email_id, from_stage, to_stage, changed_at, changed_by, reason
    FROM stage_audit
    WHERE thread_id = ?
    ORDER BY changed_at ASC
  `);
  
  return stmt.all(threadId);
}

// Check for drift between local and CRM stage
async function checkStageDrift(db, emailId) {
  const email = db.prepare('SELECT * FROM emails WHERE id = ?').get(emailId);
  
  if (!email || !email.stage_label) {
    return null; // No stage to check
  }

  const localStage = normalizeStage(email.stage_label);

  // Get CRM stage (when CRM integration is available)
  // For now, this is a placeholder
  try {
    const crmStage = await getCRMStage(emailId);
    
    if (crmStage && crmStage !== localStage) {
      logger.warn('stage_tracker.drift_detected', {
        email_id: emailId,
        local_stage: localStage,
        crm_stage: crmStage
      });

      // Record drift in metadata
      const driftLog = {
        detected_at: new Date().toISOString(),
        local_stage: localStage,
        crm_stage: crmStage
      };

      // Update email metadata to track drift
      const metadata = email.metadata ? JSON.parse(email.metadata) : {};
      if (!metadata.drift_log) {
        metadata.drift_log = [];
      }
      metadata.drift_log.push(driftLog);

      db.prepare('UPDATE emails SET metadata = ? WHERE id = ?')
        .run(JSON.stringify(metadata), emailId);

      return { drift: true, local: localStage, crm: crmStage };
    }

    return { drift: false, local: localStage, crm: crmStage };
  } catch (error) {
    // CRM not available yet
    return null;
  }
}

// Get CRM stage (placeholder for future CRM integration)
async function getCRMStage(emailId) {
  // When AnselAI is live, fetch stage from CRM
  // For now, return null to indicate CRM not available
  return null;
}

// CLI: node stage-tracker.js --email 42 --stage "Qualified" --reason "Phone call went well"
// CLI: node stage-tracker.js --audit --email 42
if (require.main === module) {
  const args = process.argv.slice(2);
  const db = getDatabase();

  try {
    if (args.includes('--audit')) {
      const emailIdIndex = args.indexOf('--email');
      if (emailIdIndex === -1) {
        console.log('Usage: node stage-tracker.js --audit --email <id>');
        process.exit(1);
      }
      
      const emailId = parseInt(args[emailIdIndex + 1]);
      const trail = getAuditTrail(db, emailId);
      
      console.log(`\nAudit trail for email ${emailId}:\n`);
      trail.forEach(entry => {
        console.log(
          `${entry.changed_at} | ${entry.from_stage || '(none)'} → ${entry.to_stage} | ` +
          `by ${entry.changed_by}${entry.reason ? ` | ${entry.reason}` : ''}`
        );
      });
      
    } else if (args.includes('--email') && args.includes('--stage')) {
      const emailId = parseInt(args[args.indexOf('--email') + 1]);
      const stage = args[args.indexOf('--stage') + 1];
      const reasonIndex = args.indexOf('--reason');
      const reason = reasonIndex !== -1 ? args[reasonIndex + 1] : null;
      
      changeStage(db, emailId, stage, 'manual', reason);
      console.log(`Stage updated for email ${emailId}`);
      
    } else {
      console.log('Usage:');
      console.log('  node stage-tracker.js --email <id> --stage <stage> [--reason <reason>]');
      console.log('  node stage-tracker.js --audit --email <id>');
    }
  } finally {
    db.close();
  }
}

module.exports = {
  TRANSITIONS,
  isValidTransition,
  changeStage,
  getAuditTrail,
  getThreadAuditTrail,
  checkStageDrift
};
