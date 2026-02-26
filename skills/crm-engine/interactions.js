#!/usr/bin/env node
const path = require('path');
const { getDatabase } = require('./db');
const { getContactByEmail } = require('./contacts');

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

// Log interaction
function logInteraction(contactId, data) {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    INSERT INTO interactions (
      contact_id, type, subject, summary, source, source_id, direction, occurred_at, metadata
    ) VALUES (
      @contact_id, @type, @subject, @summary, @source, @source_id, @direction, @occurred_at, @metadata
    )
  `);
  
  const result = stmt.run({
    contact_id: contactId,
    type: data.type, // email_sent, email_received, meeting, call, note
    subject: data.subject || null,
    summary: data.summary || null,
    source: data.source || 'manual',
    source_id: data.source_id || null,
    direction: data.direction || 'bilateral', // inbound, outbound, bilateral
    occurred_at: data.occurred_at || new Date().toISOString(),
    metadata: data.metadata ? JSON.stringify(data.metadata) : null
  });
  
  // Update contact's updated_at timestamp
  db.prepare("UPDATE contacts SET updated_at = datetime('now') WHERE id = ?").run(contactId);
  
  logger.info('crm.interaction_logged', {
    id: result.lastInsertRowid,
    contact_id: contactId,
    type: data.type
  });
  
  return { id: result.lastInsertRowid };
}

// Get interactions for a contact
function getInteractions(contactId, { limit = 50, since = null } = {}) {
  const db = getDatabase();
  
  let query = 'SELECT * FROM interactions WHERE contact_id = ?';
  const params = [contactId];
  
  if (since) {
    query += ' AND occurred_at >= ?';
    params.push(since);
  }
  
  query += ' ORDER BY occurred_at DESC LIMIT ?';
  params.push(limit);
  
  return db.prepare(query).all(...params);
}

// Log from emails (batch processing from email pipeline)
function logFromEmails(emails) {
  const db = getDatabase();
  const logged = [];
  
  for (const email of emails) {
    // Skip if already logged
    const existing = db.prepare('SELECT id FROM interactions WHERE source_id = ?').get(email.message_id);
    if (existing) continue;
    
    // Find or skip contact
    const contact = getContactByEmail(email.from_email);
    if (!contact) {
      // No contact for this email, skip
      continue;
    }
    
    // Determine direction
    const direction = email.direction || 'inbound'; // email pipeline should provide this
    
    logInteraction(contact.id, {
      type: direction === 'outbound' ? 'email_sent' : 'email_received',
      subject: email.subject,
      summary: email.body_text ? email.body_text.substring(0, 500) : null,
      source: 'email_pipeline',
      source_id: email.message_id,
      direction,
      occurred_at: email.received_at || email.sent_at
    });
    
    logged.push(contact.id);
  }
  
  logger.info('crm.interactions_from_emails', { count: logged.length });
  
  return logged;
}

// Get interaction stats for a contact
function getInteractionStats(contactId) {
  const db = getDatabase();
  
  const total = db.prepare('SELECT COUNT(*) as count FROM interactions WHERE contact_id = ?').get(contactId);
  
  const byType = db.prepare(`
    SELECT type, COUNT(*) as count 
    FROM interactions 
    WHERE contact_id = ? 
    GROUP BY type
  `).all(contactId);
  
  const lastInteraction = db.prepare(`
    SELECT occurred_at FROM interactions 
    WHERE contact_id = ? 
    ORDER BY occurred_at DESC 
    LIMIT 1
  `).get(contactId);
  
  return {
    total: total.count,
    by_type: byType,
    last_interaction: lastInteraction ? lastInteraction.occurred_at : null
  };
}

module.exports = {
  logInteraction,
  getInteractions,
  logFromEmails,
  getInteractionStats
};

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--log')) {
    const contactIdx = args.indexOf('--contact');
    const typeIdx = args.indexOf('--type');
    const subjectIdx = args.indexOf('--subject');
    
    if (contactIdx === -1 || typeIdx === -1) {
      console.error('❌ --contact and --type required');
      process.exit(1);
    }
    
    const contactId = parseInt(args[contactIdx + 1]);
    const type = args[typeIdx + 1];
    const subject = subjectIdx !== -1 ? args[subjectIdx + 1] : null;
    
    const result = logInteraction(contactId, { type, subject });
    console.log(`✅ Interaction logged with ID: ${result.id}`);
  } else if (args.includes('--list')) {
    const contactIdx = args.indexOf('--contact');
    if (contactIdx === -1) {
      console.error('❌ --contact required');
      process.exit(1);
    }
    
    const contactId = parseInt(args[contactIdx + 1]);
    const interactions = getInteractions(contactId);
    
    console.log(`\n📧 Interactions for contact ${contactId} (${interactions.length}):\n`);
    interactions.forEach(i => {
      console.log(`${i.id}. [${i.type}] ${i.subject || '(no subject)'}`);
      console.log(`   ${i.occurred_at} | ${i.direction || 'bilateral'}`);
    });
  } else if (args.includes('--stats')) {
    const contactIdx = args.indexOf('--contact');
    if (contactIdx === -1) {
      console.error('❌ --contact required');
      process.exit(1);
    }
    
    const contactId = parseInt(args[contactIdx + 1]);
    const stats = getInteractionStats(contactId);
    
    console.log(`\n📊 Interaction stats for contact ${contactId}:\n`);
    console.log(`Total: ${stats.total}`);
    console.log(`Last: ${stats.last_interaction || 'never'}`);
    console.log('\nBy type:');
    stats.by_type.forEach(t => {
      console.log(`  ${t.type}: ${t.count}`);
    });
  } else {
    console.log(`Usage:
  --log --contact <id> --type <type> [--subject "..."]
  --list --contact <id>
  --stats --contact <id>
    `);
  }
}
