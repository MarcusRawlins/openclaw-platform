#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
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

// Template selection based on account and score bucket
const TEMPLATES = {
  'photography': {
    'exceptional': 'photo-exceptional.md',
    'high': 'photo-high.md',
    'medium': 'photo-medium.md',
    'low': 'photo-low.md'
  },
  'rehive': {
    'exceptional': 'rehive-exceptional.md',
    'high': 'rehive-high.md',
    'medium': 'rehive-medium.md',
    'low': 'rehive-low.md'
  }
};

function getTemplate(accountId, scoreBucket) {
  const templateMap = TEMPLATES[accountId];
  if (!templateMap) {
    throw new Error(`No templates defined for account: ${accountId}`);
  }

  const templateFile = templateMap[scoreBucket];
  if (!templateFile) {
    throw new Error(`No template for bucket: ${scoreBucket}`);
  }

  // Use __dirname to resolve relative to script location (not cwd)
  const templatePath = path.join(__dirname, 'templates', templateFile);
  
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template file not found: ${templatePath}`);
  }

  return fs.readFileSync(templatePath, 'utf-8');
}

// Layer 1: Writer LLM (personalize template)
async function writePersonalizedDraft(template, emailContext) {
  const prompt = `You are personalizing a reply template for a business email.

TEMPLATE:
${template}

CONTEXT:
From: ${emailContext.from_name || 'Unknown'} (${emailContext.from_email})
Subject: ${emailContext.subject || '(no subject)'}
Their message: ${emailContext.body_preview}
Score: ${emailContext.score} (${emailContext.score_bucket})

RULES:
- Keep the template's structure and intent
- Personalize greeting and any references to their specific situation
- Do NOT answer specific questions with specifics (dates, prices, availability)
- Do NOT add commitments or promises not in the template
- Do NOT include any internal information, file paths, or system details
- Keep tone warm and professional

Return ONLY the personalized email text.`;

  try {
    const result = await llmRouter({
      model: CONFIG.drafting.writer_model,
      prompt: prompt,
      temperature: 0.7,
      agent: 'email-pipeline:drafter-writer',
      taskType: 'draft_generation'
    });

    const draft = result.text || '';
    return { success: true, draft };

  } catch (error) {
    logger.error('drafter.writer_error', { error: error.message });
    return { success: false, error: error.message };
  }
}

// Layer 2: Reviewer LLM (independent validation)
async function reviewDraft(draft, originalTemplate, emailContext) {
  const prompt = `You are a safety reviewer for outbound business emails.

ORIGINAL TEMPLATE:
${originalTemplate}

DRAFT TO REVIEW:
${draft}

INBOUND CONTEXT:
${emailContext.body_preview}

CHECK FOR THESE FAILURES (any one = BLOCK):
1. Draft answers questions with specific information (dates, prices, availability)
2. Draft adds commitments or promises not present in the template
3. Draft contains artifacts (system text, file paths, prompt fragments, markdown)
4. Draft significantly departs from the template's intent or structure
5. Draft contains information that wasn't in the template or the sender's email
6. Draft tone is inappropriate (too casual, too aggressive, too formal)

Respond with ONLY JSON:
{ "approved": true/false, "failures": ["description of each failure"] }`;

  try {
    const result = await llmRouter({
      model: CONFIG.drafting.reviewer_model,
      prompt: prompt,
      temperature: 0.1,
      agent: 'email-pipeline:drafter-reviewer',
      taskType: 'draft_review'
    });

    const responseText = result.text || '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('Reviewer did not produce valid JSON');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return { success: true, approved: parsed.approved, failures: parsed.failures || [] };

  } catch (error) {
    logger.error('drafter.reviewer_error', { error: error.message });
    return { success: false, error: error.message };
  }
}

// Layer 3: Deterministic Content Gate
function contentGate(draft) {
  const blocks = [];

  // Check for secrets/internal paths
  if (/\/Users\/|\/Volumes\/|\/workspace\//i.test(draft)) {
    blocks.push('internal_path');
  }
  if (/(?:sk|pk|api|key|token)[-_][\w]{20,}/i.test(draft)) {
    blocks.push('api_key');
  }

  // Check for dollar amounts (financial confidentiality)
  if (/\$[\d,]+(?:\.\d{2})?/.test(draft)) {
    blocks.push('dollar_amount');
  }

  // Check for prompt injection artifacts
  if (/\[INST\]|\[\/INST\]|<\|im_start\|>|<\|system\|>/i.test(draft)) {
    blocks.push('prompt_artifact');
  }

  // Check for markdown formatting that shouldn't be in an email
  if (/^#{1,3}\s|```|^\|.*\|$/m.test(draft)) {
    blocks.push('markdown_artifact');
  }

  // Check for system/debug text
  if (/TODO|FIXME|DEBUG|console\.log|function\s+\w+\(/i.test(draft)) {
    blocks.push('debug_text');
  }

  return {
    passed: blocks.length === 0,
    blocked_reasons: blocks
  };
}

// Full draft generation pipeline
async function generateDraft(emailId) {
  const db = getDatabase();
  const email = db.prepare('SELECT * FROM emails WHERE id = ?').get(emailId);

  if (!email) {
    throw new Error(`Email ${emailId} not found`);
  }

  if (email.classification !== 'lead') {
    logger.info('drafter.skip_non_lead', { email_id: emailId });
    db.close();
    return { success: false, reason: 'Not a lead' };
  }

  try {
    // Load template
    const template = getTemplate(email.account_id, email.score_bucket);

    const emailContext = {
      from_name: email.from_name,
      from_email: email.from_email,
      subject: email.subject,
      body_preview: email.body_text?.substring(0, 500),
      score: email.score,
      score_bucket: email.score_bucket
    };

    logger.info('drafter.generation_start', { email_id: emailId, bucket: email.score_bucket });

    // Layer 1: Writer LLM
    const writerResult = await writePersonalizedDraft(template, emailContext);
    if (!writerResult.success) {
      logger.warn('drafter.writer_failed_fallback', { email_id: emailId });
      db.prepare('UPDATE emails SET draft_status = ?, draft_text = ? WHERE id = ?')
        .run('generated', template, emailId);
      db.close();
      return { success: true, draft: template, fallback: true, reason: 'writer_error' };
    }

    // Layer 2: Reviewer LLM
    const reviewResult = await reviewDraft(writerResult.draft, template, emailContext);
    if (!reviewResult.success || !reviewResult.approved) {
      const reason = reviewResult.failures?.join('; ') || 'reviewer_error';
      logger.warn('drafter.reviewer_blocked', { email_id: emailId, reason });
      db.prepare('UPDATE emails SET draft_status = ?, draft_text = ? WHERE id = ?')
        .run('generated', template, emailId);
      db.close();
      return { success: true, draft: template, fallback: true, reason };
    }

    // Layer 3: Content Gate
    const gateResult = contentGate(writerResult.draft);
    if (!gateResult.passed) {
      const reason = gateResult.blocked_reasons.join('; ');
      logger.warn('drafter.content_gate_blocked', { email_id: emailId, reason });
      db.prepare('UPDATE emails SET draft_status = ?, draft_text = ? WHERE id = ?')
        .run('generated', template, emailId);
      db.close();
      return { success: true, draft: template, fallback: true, reason };
    }

    // All checks passed
    logger.info('drafter.draft_approved', { email_id: emailId });
    db.prepare('UPDATE emails SET draft_status = ?, draft_text = ? WHERE id = ?')
      .run('generated', writerResult.draft, emailId);
    db.close();

    return { success: true, draft: writerResult.draft, fallback: false };

  } catch (error) {
    logger.error('drafter.generation_failed', { email_id: emailId, error: error.message });
    
    // Fail-safe: use template
    try {
      const template = getTemplate(email.account_id, email.score_bucket);
      db.prepare('UPDATE emails SET draft_status = ?, draft_text = ? WHERE id = ?')
        .run('generated', template, emailId);
      db.close();
      return { success: true, draft: template, fallback: true, reason: error.message };
    } catch (e) {
      db.close();
      throw error;
    }
  }
}

// CLI: node drafter.js --email 42
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--email')) {
    const emailId = parseInt(args[args.indexOf('--email') + 1]);
    
    generateDraft(emailId).then(result => {
      console.log('\nDraft generation result:');
      console.log(`Fallback: ${result.fallback ? 'YES' : 'NO'}`);
      if (result.reason) console.log(`Reason: ${result.reason}`);
      console.log(`\nDraft:\n${result.draft}`);
    }).catch(error => {
      console.error('Draft generation failed:', error.message);
      process.exit(1);
    });
  } else {
    console.log('Usage: node drafter.js --email <id>');
  }
}

module.exports = {
  generateDraft,
  getTemplate,
  contentGate
};
