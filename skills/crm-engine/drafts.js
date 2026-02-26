#!/usr/bin/env node
const path = require('path');
const { execFileSync } = require('child_process');
const { getDatabase } = require('./db');
const { getContact } = require('./contacts');
const { getInteractions } = require('./interactions');
const { getProfile } = require('./profiler');
const CONFIG = require('./config.json');

// Resolve skills directory
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
  if (require.main === module) {
    process.exit(1);
  }
}

// Safety gate: drafts disabled by default
function checkEnabled() {
  if (!CONFIG.drafts.enabled) {
    throw new Error('Draft creation is disabled. Set drafts.enabled=true in config.json');
  }
}

// Get email thread context from himalaya
function getThreadContext(contactEmail) {
  try {
    // Get recent emails with this contact
    const output = execFileSync('himalaya', [
      'envelope', 'list',
      '--account', 'marcus-work',
      '--folder', 'INBOX',
      '-o', 'json'
    ], { encoding: 'utf8' });
    
    const envelopes = JSON.parse(output);
    
    // Filter to this contact
    const relevant = envelopes.filter(e => 
      e.from.toLowerCase().includes(contactEmail.toLowerCase()) ||
      e.to?.toLowerCase().includes(contactEmail.toLowerCase())
    );
    
    return relevant.slice(0, 5); // Last 5 emails
  } catch (error) {
    logger.error('crm.drafts_thread_fetch_failed', { error: error.message });
    return [];
  }
}

// Generate draft email
async function generateDraft(contactId, context = {}) {
  checkEnabled();
  
  const db = getDatabase();
  const contact = getContact(contactId);
  
  if (!contact) {
    return { error: 'Contact not found' };
  }
  
  const profile = getProfile(contactId);
  const interactions = getInteractions(contactId, { limit: 10 });
  const emailThread = contact.email ? getThreadContext(contact.email) : [];
  
  const prompt = `Generate a professional follow-up email draft.

Recipient: ${contact.first_name} ${contact.last_name || ''}
Email: ${contact.email}
Company: ${contact.company || 'Unknown'}
Relationship: ${profile.relationship_type || 'unknown'}
Communication Style: ${profile.communication_style || 'professional'}

Recent interactions:
${interactions.slice(0, 3).map(i => `- ${i.occurred_at}: ${i.type} — ${i.subject || '(no subject)'}`).join('\n')}

${profile.summary ? `\nRelationship summary: ${profile.summary.summary}` : ''}

${context.purpose ? `\nPurpose: ${context.purpose}` : ''}

Write a warm, professional follow-up email. Keep it brief (2-3 paragraphs). Match the recipient's communication style.

Return ONLY valid JSON:
{
  "subject": "Email subject line",
  "body": "Email body text (plain text, no HTML)",
  "tone": "casual|professional|formal",
  "reasoning": "Why this approach is appropriate"
}`;

  try {
    const writerResponse = await llmRouter({
      model: CONFIG.drafts.writer_model,
      prompt,
      maxTokens: 1000,
      temperature: 0.7
    });
    
    const draft = JSON.parse(writerResponse.text);
    
    // Review with second model
    const reviewPrompt = `Review this email draft for appropriateness and safety.

To: ${contact.first_name} ${contact.last_name || ''} <${contact.email}>
Subject: ${draft.subject}

${draft.body}

Check for:
1. No personal info leaks (phone numbers, addresses, sensitive data)
2. No inappropriate content
3. Professional tone maintained
4. Clear and respectful

Return ONLY valid JSON:
{
  "approved": true/false,
  "issues": ["issue1", "issue2"] or [],
  "reasoning": "Brief explanation"
}`;

    const reviewResponse = await llmRouter({
      model: CONFIG.drafts.reviewer_model,
      prompt: reviewPrompt,
      maxTokens: 500,
      temperature: 0.1
    });
    
    const review = JSON.parse(reviewResponse.text);
    
    if (!review.approved) {
      logger.warn('crm.draft_rejected_by_reviewer', { 
        contact_id: contactId, 
        issues: review.issues 
      });
      return {
        error: 'Draft rejected by reviewer',
        issues: review.issues,
        reasoning: review.reasoning
      };
    }
    
    // Store draft as proposed
    const stmt = db.prepare(`
      INSERT INTO drafts (contact_id, subject, body, tone, status, metadata)
      VALUES (?, ?, ?, ?, 'proposed', ?)
    `);
    
    // Check if drafts table exists (create if not)
    db.exec(`
      CREATE TABLE IF NOT EXISTS drafts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contact_id INTEGER NOT NULL,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        tone TEXT,
        status TEXT DEFAULT 'proposed',
        metadata TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        approved_at TEXT,
        sent_at TEXT,
        FOREIGN KEY (contact_id) REFERENCES contacts(id)
      )
    `);
    
    const result = stmt.run(
      contactId,
      draft.subject,
      draft.body,
      draft.tone,
      JSON.stringify({ reasoning: draft.reasoning, review })
    );
    
    logger.info('crm.draft_generated', { 
      id: result.lastInsertRowid, 
      contact_id: contactId 
    });
    
    return {
      id: result.lastInsertRowid,
      subject: draft.subject,
      body: draft.body,
      tone: draft.tone,
      status: 'proposed',
      contact
    };
  } catch (error) {
    logger.error('crm.draft_generation_failed', { 
      contact_id: contactId, 
      error: error.message 
    });
    return { error: error.message };
  }
}

// Get pending drafts
function getPendingDrafts() {
  const db = getDatabase();
  
  // Check if table exists
  const tableExists = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='drafts'
  `).get();
  
  if (!tableExists) {
    return [];
  }
  
  return db.prepare(`
    SELECT d.*, c.first_name, c.last_name, c.email, c.company
    FROM drafts d
    JOIN contacts c ON d.contact_id = c.id
    WHERE d.status = 'proposed'
    ORDER BY d.created_at DESC
  `).all();
}

// Approve draft
function approveDraft(draftId) {
  checkEnabled();
  
  const db = getDatabase();
  
  const draft = db.prepare('SELECT * FROM drafts WHERE id = ?').get(draftId);
  if (!draft) {
    return { error: 'Draft not found' };
  }
  
  db.prepare(`
    UPDATE drafts 
    SET status = 'approved', approved_at = datetime('now') 
    WHERE id = ?
  `).run(draftId);
  
  logger.info('crm.draft_approved', { id: draftId });
  
  // TODO: Push to email client via himalaya
  // This would require creating a draft in the email client
  // For now, just mark as approved
  
  return { 
    success: true,
    message: 'Draft approved. TODO: Push to email client via himalaya'
  };
}

module.exports = {
  generateDraft,
  getPendingDrafts,
  approveDraft
};

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--for')) {
    const idIdx = args.indexOf('--for');
    const contactId = parseInt(args[idIdx + 1]);
    
    const purposeIdx = args.indexOf('--purpose');
    const context = purposeIdx !== -1 ? { purpose: args[purposeIdx + 1] } : {};
    
    (async () => {
      console.log(`✍️  Generating draft for contact ${contactId}...\n`);
      const draft = await generateDraft(contactId, context);
      
      if (draft.error) {
        console.error(`❌ ${draft.error}`);
        if (draft.issues) {
          console.error('\nIssues:');
          draft.issues.forEach(i => console.error(`  • ${i}`));
        }
        process.exit(1);
      }
      
      console.log(`✅ Draft generated (ID: ${draft.id})\n`);
      console.log(`To: ${draft.contact.first_name} ${draft.contact.last_name || ''} <${draft.contact.email}>`);
      console.log(`Subject: ${draft.subject}\n`);
      console.log(draft.body);
      console.log(`\nTone: ${draft.tone}`);
      console.log(`\nApprove with: node drafts.js --approve ${draft.id}`);
    })();
  } else if (args.includes('--pending')) {
    const pending = getPendingDrafts();
    
    if (pending.length === 0) {
      console.log('✅ No pending drafts.');
      process.exit(0);
    }
    
    console.log(`\n📝 Pending drafts (${pending.length}):\n`);
    pending.forEach(d => {
      console.log(`${d.id}. To: ${d.first_name} ${d.last_name || ''} <${d.email}>`);
      console.log(`   Subject: ${d.subject}`);
      console.log(`   Created: ${d.created_at}\n`);
    });
  } else if (args.includes('--approve')) {
    const idIdx = args.indexOf('--approve');
    const draftId = parseInt(args[idIdx + 1]);
    
    const result = approveDraft(draftId);
    
    if (result.error) {
      console.error(`❌ ${result.error}`);
      process.exit(1);
    }
    
    console.log(`✅ ${result.message}`);
  } else {
    console.log(`Usage:
  --for <contact_id> [--purpose "..."]    Generate draft
  --pending                                List pending drafts
  --approve <draft_id>                     Approve draft
    `);
  }
}
