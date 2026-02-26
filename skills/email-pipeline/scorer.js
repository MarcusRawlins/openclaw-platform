#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getDatabase } = require('./db');
const CONFIG = require('./config.json');

// Resolve skills directory (env var or default)
const SKILLS_DIR = process.env.OPENCLAW_SKILLS_PATH || 
                   path.join(process.env.HOME, '.openclaw/workspace/skills');

let logger, llmRouter;
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

try {
  const routerModule = require(path.join(SKILLS_DIR, 'llm-router/router'));
  llmRouter = routerModule.callLlm;
} catch (e) {
  console.error('LLM router not available:', e.message);
  process.exit(1);
}

function getRubricVersion() {
  const rubricPath = CONFIG.scoring.rubric_path;
  const rubricText = fs.readFileSync(rubricPath, 'utf-8');
  return crypto.createHash('sha256').update(rubricText).digest('hex').substring(0, 16);
}

function getRubricText() {
  const rubricPath = CONFIG.scoring.rubric_path;
  return fs.readFileSync(rubricPath, 'utf-8');
}

// Check for rubric version drift
function checkRubricDrift(db) {
  const currentVersion = getRubricVersion();
  
  const oldScores = db.prepare(`
    SELECT COUNT(*) as count 
    FROM scoring_log 
    WHERE rubric_version != ?
  `).get(currentVersion);
  
  if (oldScores.count > 0) {
    logger.warn('scorer.rubric_drift_detected', {
      current_version: currentVersion,
      old_score_count: oldScores.count
    });
    
    console.warn(`\n⚠️  Rubric version mismatch detected!`);
    console.warn(`   ${oldScores.count} emails were scored with an old rubric version.`);
    console.warn(`   Current version: ${currentVersion}`);
    console.warn(`   Run: node scorer.js --rescore to update scores.\n`);
    
    return { drift: true, count: oldScores.count, current_version: currentVersion };
  }
  
  return { drift: false, count: 0, current_version: currentVersion };
}

function emailToText(email) {
  return `From: ${email.from_name || ''} <${email.from_email}>
Subject: ${email.subject || '(no subject)'}
Body: ${email.body_text || ''}`;
}

async function scoreEmail(email) {
  const rubricText = getRubricText();
  const rubricVersion = getRubricVersion();

  const prompt = `${rubricText}

---

Score the following email. Return ONLY valid JSON:
{
  "is_lead": true/false,
  "classification": "lead" | "vendor_outreach" | "newsletter" | "personal" | "automated" | "spam" | "other",
  "classification_label": "descriptive label if non-lead",
  "dimensions": {
    "fit": { "score": 0-100, "reasoning": "..." },
    "clarity": { "score": 0-100, "reasoning": "..." },
    "budget": { "score": 0-100, "reasoning": "..." },
    "trust": { "score": 0-100, "reasoning": "..." },
    "timeline": { "score": 0-100, "reasoning": "..." }
  },
  "weighted_total": 0-100,
  "bucket": "exceptional|high|medium|low|spam",
  "flags": ["flag1", "flag2"]
}

Email:
${emailToText(email)}`;

  try {
    const result = await llmRouter({
      model: CONFIG.scoring.model,
      prompt: prompt,
      temperature: 0.2,
      agent: 'email-pipeline:scorer',
      taskType: 'lead_scoring'
    });

    const responseText = result.text || '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('LLM did not produce valid JSON');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate structure
    if (parsed.is_lead === undefined || !parsed.classification) {
      throw new Error('Missing required fields in score response');
    }

    if (parsed.is_lead && (!parsed.dimensions || !parsed.weighted_total)) {
      throw new Error('Lead email missing dimensions or weighted_total');
    }

    return {
      score: parsed.is_lead ? Math.round(parsed.weighted_total) : null,
      score_bucket: parsed.is_lead ? parsed.bucket : null,
      classification: parsed.classification,
      classification_label: parsed.classification_label || null,
      dimensions: parsed.dimensions || null,
      flags: parsed.flags || [],
      rubric_version: rubricVersion,
      raw_response: responseText
    };

  } catch (error) {
    logger.error('scorer.scoring_error', { error: error.message, stack: error.stack });
    throw error;
  }
}

function saveScore(db, emailId, scoreData) {
  const updateStmt = db.prepare(`
    UPDATE emails 
    SET score = ?, 
        score_bucket = ?, 
        classification = ?, 
        classification_label = ?
    WHERE id = ?
  `);

  updateStmt.run(
    scoreData.score,
    scoreData.score_bucket,
    scoreData.classification,
    scoreData.classification_label,
    emailId
  );

  if (scoreData.dimensions) {
    const logStmt = db.prepare(`
      INSERT INTO scoring_log (email_id, rubric_version, dimension_scores, flags, raw_llm_response)
      VALUES (?, ?, ?, ?, ?)
    `);

    logStmt.run(
      emailId,
      scoreData.rubric_version,
      JSON.stringify(scoreData.dimensions),
      JSON.stringify(scoreData.flags),
      scoreData.raw_response
    );
  }
}

async function rescoreAll(db, since = null) {
  let query = 'SELECT id, from_email, from_name, subject, body_text FROM emails WHERE quarantine_status = "clean"';
  const params = [];

  if (since) {
    query += ' AND received_at >= ?';
    params.push(since);
  }

  const stmt = db.prepare(query);
  const emails = stmt.all(...params);

  logger.info('scorer.rescore_start', { count: emails.length });

  let success = 0;
  let failed = 0;

  for (const email of emails) {
    try {
      const scoreData = await scoreEmail(email);
      saveScore(db, email.id, scoreData);
      success++;
      logger.info('scorer.email_rescored', { 
        email_id: email.id, 
        classification: scoreData.classification, 
        score: scoreData.score 
      });
    } catch (error) {
      failed++;
      logger.error('scorer.rescore_failed', { email_id: email.id, error: error.message });
    }
  }

  logger.info('scorer.rescore_complete', { success, failed });
}

// CLI: node scorer.js --rescore [--since YYYY-MM-DD]
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--rescore')) {
    const db = getDatabase();
    const sinceIndex = args.indexOf('--since');
    const since = sinceIndex !== -1 ? args[sinceIndex + 1] : null;

    rescoreAll(db, since).then(() => {
      db.close();
      process.exit(0);
    }).catch(error => {
      logger.error('scorer.rescore_fatal', { error: error.message, stack: error.stack });
      db.close();
      process.exit(1);
    });
  } else {
    console.log('Usage: node scorer.js --rescore [--since YYYY-MM-DD]');
  }
}

module.exports = {
  scoreEmail,
  saveScore,
  rescoreAll,
  getRubricVersion,
  checkRubricDrift
};
