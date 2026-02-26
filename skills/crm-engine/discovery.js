#!/usr/bin/env node
const path = require('path');
const { execFileSync } = require('child_process');
const { getDatabase } = require('./db');
const { addContact, getContactByEmail } = require('./contacts');
const CONFIG = require('./config.json');

// Resolve skills directory
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

// Check if email should be skipped
function shouldSkip(email) {
  const db = getDatabase();
  
  // Check noreply patterns
  for (const pattern of CONFIG.discovery.noreply_patterns) {
    if (email.toLowerCase().includes(pattern)) {
      return { skip: true, reason: 'noreply_pattern' };
    }
  }
  
  // Check skip domains
  const domain = email.split('@')[1];
  if (CONFIG.discovery.skip_domains.includes(domain)) {
    return { skip: true, reason: 'skip_domain' };
  }
  
  // Check skip_patterns table
  const skipPattern = db.prepare(`
    SELECT * FROM skip_patterns 
    WHERE pattern = ? OR pattern = ?
  `).get(domain, email);
  
  if (skipPattern) {
    return { skip: true, reason: 'learned_skip_pattern' };
  }
  
  return { skip: false };
}

// Extract contacts from email pipeline database
function extractFromEmailPipeline(hoursBack = 24) {
  const db = getDatabase();
  const Database = require('better-sqlite3');
  
  const pipelineDbPath = path.resolve(__dirname, CONFIG.email_pipeline.database_path);
  
  let pipelineDb;
  try {
    pipelineDb = new Database(pipelineDbPath, { readonly: true });
  } catch (error) {
    logger.error('crm.pipeline_db_not_found', { path: pipelineDbPath });
    return { extracted: [], skipped: [] };
  }
  
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - hoursBack);
  
  const emails = pipelineDb.prepare(`
    SELECT * FROM emails 
    WHERE received_at >= ?
      AND classification IN ('lead', 'personal', 'vendor_outreach')
    ORDER BY received_at DESC
  `).all(cutoffTime.toISOString());
  
  pipelineDb.close();
  
  const extracted = [];
  const skipped = [];
  
  for (const email of emails) {
    // Check if already exists
    const existing = getContactByEmail(email.from_email);
    if (existing) {
      skipped.push({ email: email.from_email, reason: 'already_exists' });
      continue;
    }
    
    // Check skip rules
    const skipCheck = shouldSkip(email.from_email);
    if (skipCheck.skip) {
      skipped.push({ email: email.from_email, reason: skipCheck.reason });
      continue;
    }
    
    // Extract name
    let firstName = email.from_name || email.from_email.split('@')[0];
    let lastName = null;
    
    if (email.from_name && email.from_name.includes(' ')) {
      const parts = email.from_name.split(' ');
      firstName = parts[0];
      lastName = parts.slice(1).join(' ');
    }
    
    // Check if auto-add is enabled and if this domain qualifies
    const autoAdd = shouldAutoAdd(email.from_email);
    
    if (autoAdd.auto && CONFIG.discovery.auto_add_enabled) {
      // Auto-add
      const result = addContact({
        first_name: firstName,
        last_name: lastName,
        email: email.from_email,
        source: 'email_pipeline',
        source_id: email.message_id,
        auto_added: true,
        approved: true
      });
      
      if (!result.error) {
        extracted.push({ 
          email: email.from_email, 
          contact_id: result.id,
          auto_added: true 
        });
        
        // Record decision
        recordDecision(email.from_email, firstName + ' ' + (lastName || ''), 'approved', true);
      }
    } else {
      // Add as pending approval
      const result = addContact({
        first_name: firstName,
        last_name: lastName,
        email: email.from_email,
        source: 'email_pipeline',
        source_id: email.message_id,
        auto_added: false,
        approved: false
      });
      
      if (!result.error) {
        extracted.push({ 
          email: email.from_email, 
          contact_id: result.id,
          pending: true 
        });
      }
    }
  }
  
  logger.info('crm.discovery_from_pipeline', { 
    extracted: extracted.length, 
    skipped: skipped.length 
  });
  
  return { extracted, skipped };
}

// Record approval/rejection decision
function recordDecision(email, name, decision, autoDecision = false) {
  const db = getDatabase();
  const domain = email.split('@')[1];
  
  db.prepare(`
    INSERT INTO discovery_decisions (email, name, domain, decision, auto_decision)
    VALUES (?, ?, ?, ?, ?)
  `).run(email, name, domain, decision, autoDecision ? 1 : 0);
  
  logger.info('crm.discovery_decision', { email, decision, auto: autoDecision });
  
  // If rejected, check if we should learn a skip pattern
  if (decision === 'rejected') {
    learnSkipPattern(email, domain);
  }
}

// Learn skip patterns from rejections
function learnSkipPattern(email, domain) {
  const db = getDatabase();
  
  // Count rejections for this domain
  const domainRejections = db.prepare(`
    SELECT COUNT(*) as count FROM discovery_decisions
    WHERE domain = ? AND decision = 'rejected'
  `).get(domain);
  
  const totalDomainDecisions = db.prepare(`
    SELECT COUNT(*) as count FROM discovery_decisions
    WHERE domain = ?
  `).get(domain);
  
  // If > 80% rejection rate and 5+ decisions, add to skip patterns
  if (totalDomainDecisions.count >= 5 && 
      domainRejections.count / totalDomainDecisions.count > 0.8) {
    
    try {
      db.prepare(`
        INSERT INTO skip_patterns (pattern, pattern_type, reason, learned_from)
        VALUES (?, 'domain', 'High rejection rate', ?)
      `).run(domain, domainRejections.count);
      
      logger.info('crm.skip_pattern_learned', { 
        domain, 
        rejections: domainRejections.count,
        total: totalDomainDecisions.count 
      });
    } catch (e) {
      // Already exists, update count
      db.prepare(`
        UPDATE skip_patterns 
        SET learned_from = ?
        WHERE pattern = ?
      `).run(domainRejections.count, domain);
    }
  }
}

// Check if email should be auto-added
function shouldAutoAdd(email) {
  const db = getDatabase();
  const domain = email.split('@')[1];
  
  const decisions = db.prepare(`
    SELECT decision, COUNT(*) as count 
    FROM discovery_decisions 
    WHERE domain = ? 
    GROUP BY decision
  `).all(domain);
  
  const total = decisions.reduce((s, d) => s + d.count, 0);
  if (total < 5) return { auto: false, reason: 'insufficient_data' };
  
  const approved = decisions.find(d => d.decision === 'approved')?.count || 0;
  if (approved / total > 0.9) return { auto: true, reason: 'high_approval_domain' };
  
  return { auto: false, reason: 'mixed_history' };
}

// Get pending contacts (awaiting approval)
function getPending() {
  const db = getDatabase();
  
  return db.prepare(`
    SELECT * FROM contacts 
    WHERE approved = 0 
    ORDER BY created_at DESC
  `).all();
}

// Approve pending contact
function approve(contactId) {
  const db = getDatabase();
  
  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(contactId);
  if (!contact) {
    return { error: 'Contact not found' };
  }
  
  db.prepare("UPDATE contacts SET approved = 1, updated_at = datetime('now') WHERE id = ?")
    .run(contactId);
  
  recordDecision(contact.email, `${contact.first_name} ${contact.last_name || ''}`, 'approved', false);
  
  logger.info('crm.contact_approved', { id: contactId, email: contact.email });
  
  return { success: true };
}

// Reject pending contact
function reject(contactId) {
  const db = getDatabase();
  
  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(contactId);
  if (!contact) {
    return { error: 'Contact not found' };
  }
  
  // Mark as skip pattern and delete
  db.prepare('DELETE FROM contacts WHERE id = ?').run(contactId);
  
  recordDecision(contact.email, `${contact.first_name} ${contact.last_name || ''}`, 'rejected', false);
  
  logger.info('crm.contact_rejected', { id: contactId, email: contact.email });
  
  return { success: true };
}

// Get learned skip patterns
function getSkipPatterns() {
  const db = getDatabase();
  
  return db.prepare('SELECT * FROM skip_patterns ORDER BY learned_from DESC').all();
}

module.exports = {
  extractFromEmailPipeline,
  shouldSkip,
  shouldAutoAdd,
  getPending,
  approve,
  reject,
  recordDecision,
  getSkipPatterns
};

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--scan')) {
    const lastIdx = args.indexOf('--last');
    const hours = lastIdx !== -1 ? parseInt(args[lastIdx + 1]) : 24;
    
    console.log(`🔍 Scanning email pipeline for contacts (last ${hours}h)...\n`);
    const result = extractFromEmailPipeline(hours);
    
    console.log(`✅ Extracted ${result.extracted.length} contacts`);
    console.log(`⏭️  Skipped ${result.skipped.length} contacts\n`);
    
    const autoAdded = result.extracted.filter(e => e.auto_added);
    const pending = result.extracted.filter(e => e.pending);
    
    if (autoAdded.length > 0) {
      console.log(`Auto-added (${autoAdded.length}):`);
      autoAdded.forEach(e => console.log(`  • ${e.email}`));
    }
    
    if (pending.length > 0) {
      console.log(`\nPending approval (${pending.length}):`);
      pending.forEach(e => console.log(`  • ${e.email} (ID: ${e.contact_id})`));
    }
  } else if (args.includes('--pending')) {
    const pending = getPending();
    
    if (pending.length === 0) {
      console.log('✅ No contacts pending approval.');
      process.exit(0);
    }
    
    console.log(`\n📋 Contacts pending approval (${pending.length}):\n`);
    pending.forEach(c => {
      console.log(`${c.id}. ${c.first_name} ${c.last_name || ''} <${c.email}>`);
      console.log(`   Source: ${c.source} | Created: ${c.created_at}`);
    });
    
    console.log('\nApprove with: node discovery.js --approve <id>');
    console.log('Reject with: node discovery.js --reject <id>');
  } else if (args.includes('--approve')) {
    const idIdx = args.indexOf('--approve');
    const contactId = parseInt(args[idIdx + 1]);
    
    const result = approve(contactId);
    
    if (result.error) {
      console.error(`❌ ${result.error}`);
      process.exit(1);
    }
    
    console.log(`✅ Contact ${contactId} approved`);
  } else if (args.includes('--reject')) {
    const idIdx = args.indexOf('--reject');
    const contactId = parseInt(args[idIdx + 1]);
    
    const result = reject(contactId);
    
    if (result.error) {
      console.error(`❌ ${result.error}`);
      process.exit(1);
    }
    
    console.log(`✅ Contact ${contactId} rejected`);
  } else if (args.includes('--patterns')) {
    const patterns = getSkipPatterns();
    
    if (patterns.length === 0) {
      console.log('No skip patterns learned yet.');
      process.exit(0);
    }
    
    console.log(`\n🚫 Learned skip patterns (${patterns.length}):\n`);
    patterns.forEach(p => {
      console.log(`${p.id}. ${p.pattern} (${p.pattern_type})`);
      console.log(`   Learned from ${p.learned_from} rejections`);
      console.log(`   Reason: ${p.reason || 'none'}`);
    });
  } else {
    console.log(`Usage:
  --scan [--last <hours>]     Scan email pipeline (default: 24h)
  --pending                   Show contacts awaiting approval
  --approve <contact_id>      Approve pending contact
  --reject <contact_id>       Reject pending contact
  --patterns                  Show learned skip patterns
    `);
  }
}
