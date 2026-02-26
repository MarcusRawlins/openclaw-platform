const path = require('path');
const { getDatabase } = require('./db');

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

// Generate score label (set once, immutable)
function generateScoreLabel(email) {
  if (email.classification === 'lead' && email.score !== null) {
    return `Lead/${email.score_bucket.charAt(0).toUpperCase() + email.score_bucket.slice(1)} ${email.score}`;
  }
  
  // Non-lead classifications
  return email.classification_label || `${email.classification}`;
}

// Apply score label (one-time, at scoring)
function applyScoreLabel(db, emailId) {
  const email = db.prepare('SELECT * FROM emails WHERE id = ?').get(emailId);
  
  if (!email) {
    throw new Error(`Email ${emailId} not found`);
  }

  if (email.score_label) {
    logger.info('labeler.score_label_exists', { email_id: emailId, score_label: email.score_label });
    return email.score_label;
  }

  const scoreLabel = generateScoreLabel(email);
  
  db.prepare('UPDATE emails SET score_label = ? WHERE id = ?').run(scoreLabel, emailId);
  
  logger.info('labeler.score_label_applied', { email_id: emailId, score_label: scoreLabel });
  
  return scoreLabel;
}

// Apply stage label (mutable, can be updated)
function applyStageLabel(db, emailId, stageLabel) {
  const email = db.prepare('SELECT * FROM emails WHERE id = ?').get(emailId);
  
  if (!email) {
    throw new Error(`Email ${emailId} not found`);
  }

  const oldStageLabel = email.stage_label;
  
  db.prepare('UPDATE emails SET stage_label = ? WHERE id = ?').run(stageLabel, emailId);
  
  logger.info('labeler.stage_label_updated', { 
    email_id: emailId, 
    old_stage_label: oldStageLabel, 
    new_stage_label: stageLabel 
  });
  
  return stageLabel;
}

// Initialize stage label for new lead
function initializeStageLabel(db, emailId) {
  const email = db.prepare('SELECT * FROM emails WHERE id = ?').get(emailId);
  
  if (!email) {
    throw new Error(`Email ${emailId} not found`);
  }

  if (email.classification !== 'lead') {
    logger.info('labeler.stage_init_skipped', { 
      email_id: emailId, 
      reason: 'not a lead', 
      classification: email.classification 
    });
    return null;
  }

  const stageLabel = 'Stage/New';
  applyStageLabel(db, emailId, stageLabel);
  
  return stageLabel;
}

// Get current labels for an email
function getLabels(db, emailId) {
  const email = db.prepare('SELECT score_label, stage_label FROM emails WHERE id = ?').get(emailId);
  
  if (!email) {
    throw new Error(`Email ${emailId} not found`);
  }

  return {
    score_label: email.score_label,
    stage_label: email.stage_label
  };
}

module.exports = {
  generateScoreLabel,
  applyScoreLabel,
  applyStageLabel,
  initializeStageLabel,
  getLabels
};
