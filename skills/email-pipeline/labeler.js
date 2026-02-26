const { getDatabase } = require('./db');

let logger;
try {
  logger = require('/Users/marcusrawlins/.openclaw/workspace/skills/logging/logger');
} catch (e) {
  logger = { log: console.log, error: console.error };
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
    logger.log(`Email ${emailId} already has score label: ${email.score_label}`);
    return email.score_label;
  }

  const scoreLabel = generateScoreLabel(email);
  
  db.prepare('UPDATE emails SET score_label = ? WHERE id = ?').run(scoreLabel, emailId);
  
  logger.log(`Applied score label to email ${emailId}: ${scoreLabel}`);
  
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
  
  logger.log(`Updated stage label for email ${emailId}: ${oldStageLabel} → ${stageLabel}`);
  
  return stageLabel;
}

// Initialize stage label for new lead
function initializeStageLabel(db, emailId) {
  const email = db.prepare('SELECT * FROM emails WHERE id = ?').get(emailId);
  
  if (!email) {
    throw new Error(`Email ${emailId} not found`);
  }

  if (email.classification !== 'lead') {
    logger.log(`Email ${emailId} is not a lead, skipping stage initialization`);
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
