#!/usr/bin/env node
const path = require('path');
const { getDatabase } = require('./db');

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

// Get contact by ID
function getContact(id) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM contacts WHERE id = ?').get(id);
}

// Get contact by email
function getContactByEmail(email) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM contacts WHERE email = ?').get(email.toLowerCase());
}

// Add new contact
function addContact(data) {
  const db = getDatabase();
  
  // Normalize email
  if (data.email) {
    data.email = data.email.toLowerCase();
    
    // Check for duplicate
    const existing = getContactByEmail(data.email);
    if (existing) {
      logger.warn('crm.contact_duplicate', { email: data.email, existing_id: existing.id });
      return { error: 'Contact with this email already exists', id: existing.id };
    }
  }
  
  const stmt = db.prepare(`
    INSERT INTO contacts (
      first_name, last_name, email, phone, company, role, source, source_id,
      priority, relationship_type, auto_added, approved, notes, metadata
    ) VALUES (
      @first_name, @last_name, @email, @phone, @company, @role, @source, @source_id,
      @priority, @relationship_type, @auto_added, @approved, @notes, @metadata
    )
  `);
  
  const result = stmt.run({
    first_name: data.first_name,
    last_name: data.last_name || null,
    email: data.email || null,
    phone: data.phone || null,
    company: data.company || null,
    role: data.role || null,
    source: data.source || 'manual',
    source_id: data.source_id || null,
    priority: data.priority || 'normal',
    relationship_type: data.relationship_type || null,
    auto_added: data.auto_added ? 1 : 0,
    approved: data.approved !== false ? 1 : 0,
    notes: data.notes || null,
    metadata: data.metadata ? JSON.stringify(data.metadata) : null
  });
  
  logger.info('crm.contact_added', { 
    id: result.lastInsertRowid, 
    email: data.email,
    source: data.source 
  });
  
  return { id: result.lastInsertRowid };
}

// Update contact
function updateContact(id, data) {
  const db = getDatabase();
  
  const fields = [];
  const values = { id };
  
  if (data.first_name !== undefined) { fields.push('first_name = @first_name'); values.first_name = data.first_name; }
  if (data.last_name !== undefined) { fields.push('last_name = @last_name'); values.last_name = data.last_name; }
  if (data.email !== undefined) { 
    fields.push('email = @email'); 
    values.email = data.email ? data.email.toLowerCase() : null; 
  }
  if (data.phone !== undefined) { fields.push('phone = @phone'); values.phone = data.phone; }
  if (data.company !== undefined) { fields.push('company = @company'); values.company = data.company; }
  if (data.role !== undefined) { fields.push('role = @role'); values.role = data.role; }
  if (data.priority !== undefined) { fields.push('priority = @priority'); values.priority = data.priority; }
  if (data.relationship_score !== undefined) { fields.push('relationship_score = @relationship_score'); values.relationship_score = data.relationship_score; }
  if (data.relationship_type !== undefined) { fields.push('relationship_type = @relationship_type'); values.relationship_type = data.relationship_type; }
  if (data.communication_style !== undefined) { fields.push('communication_style = @communication_style'); values.communication_style = data.communication_style; }
  if (data.key_topics !== undefined) { fields.push('key_topics = @key_topics'); values.key_topics = data.key_topics; }
  if (data.notes !== undefined) { fields.push('notes = @notes'); values.notes = data.notes; }
  if (data.metadata !== undefined) { 
    fields.push('metadata = @metadata'); 
    values.metadata = data.metadata ? JSON.stringify(data.metadata) : null; 
  }
  
  fields.push("updated_at = datetime('now')");
  
  if (fields.length === 1) {
    return { error: 'No fields to update' };
  }
  
  const stmt = db.prepare(`UPDATE contacts SET ${fields.join(', ')} WHERE id = @id`);
  stmt.run(values);
  
  logger.info('crm.contact_updated', { id, fields: Object.keys(values).filter(k => k !== 'id') });
  
  return { success: true };
}

// List contacts with filters
function listContacts({ sort = 'score', limit = 50, filter = {} } = {}) {
  const db = getDatabase();
  
  let query = 'SELECT * FROM contacts WHERE 1=1';
  const params = {};
  
  if (filter.priority) {
    query += ' AND priority = @priority';
    params.priority = filter.priority;
  }
  
  if (filter.company) {
    query += ' AND company LIKE @company';
    params.company = `%${filter.company}%`;
  }
  
  if (filter.approved !== undefined) {
    query += ' AND approved = @approved';
    params.approved = filter.approved ? 1 : 0;
  }
  
  // Sort
  const sortMap = {
    score: 'relationship_score DESC',
    name: 'first_name ASC, last_name ASC',
    company: 'company ASC',
    recent: 'updated_at DESC'
  };
  
  query += ` ORDER BY ${sortMap[sort] || sortMap.score}`;
  query += ' LIMIT @limit';
  params.limit = limit;
  
  return db.prepare(query).all(params);
}

// Search contacts
function searchContacts(queryStr) {
  const db = getDatabase();
  
  const searchPattern = `%${queryStr}%`;
  
  return db.prepare(`
    SELECT * FROM contacts 
    WHERE first_name LIKE ? 
       OR last_name LIKE ? 
       OR email LIKE ? 
       OR company LIKE ?
       OR notes LIKE ?
    ORDER BY relationship_score DESC
    LIMIT 20
  `).all(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
}

// Merge two contacts
function mergeContacts(keepId, mergeId) {
  const db = getDatabase();
  
  const keep = getContact(keepId);
  const merge = getContact(mergeId);
  
  if (!keep || !merge) {
    return { error: 'One or both contacts not found' };
  }
  
  logger.info('crm.contact_merge_start', { keepId, mergeId });
  
  // Transaction: merge data
  const transaction = db.transaction(() => {
    // Update interactions to point to keep contact
    db.prepare('UPDATE interactions SET contact_id = ? WHERE contact_id = ?').run(keepId, mergeId);
    
    // Update follow-ups
    db.prepare('UPDATE follow_ups SET contact_id = ? WHERE contact_id = ?').run(keepId, mergeId);
    
    // Update context
    db.prepare('UPDATE contact_context SET contact_id = ? WHERE contact_id = ?').run(keepId, mergeId);
    
    // Merge notes
    if (merge.notes && merge.notes !== keep.notes) {
      const combinedNotes = [keep.notes, `\n--- Merged from contact ${mergeId} ---`, merge.notes].filter(Boolean).join('\n');
      db.prepare("UPDATE contacts SET notes = ?, updated_at = datetime('now') WHERE id = ?").run(combinedNotes, keepId);
    }
    
    // Delete merged contact
    db.prepare('DELETE FROM contacts WHERE id = ?').run(mergeId);
  });
  
  transaction();
  
  logger.info('crm.contact_merge_complete', { keepId, mergeId });
  
  return { success: true, kept: keepId, merged: mergeId };
}

// Delete contact (soft delete by marking skip_pattern)
function deleteContact(id) {
  const db = getDatabase();
  
  const contact = getContact(id);
  if (!contact) {
    return { error: 'Contact not found' };
  }
  
  // Mark as skip pattern instead of hard delete
  db.prepare("UPDATE contacts SET skip_pattern = 1, updated_at = datetime('now') WHERE id = ?").run(id);
  
  logger.info('crm.contact_deleted', { id, email: contact.email });
  
  return { success: true };
}

module.exports = {
  getContact,
  getContactByEmail,
  addContact,
  updateContact,
  listContacts,
  searchContacts,
  mergeContacts,
  deleteContact
};

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--add')) {
    const nameIdx = args.indexOf('--name');
    const emailIdx = args.indexOf('--email');
    const companyIdx = args.indexOf('--company');
    
    if (nameIdx === -1) {
      console.error('❌ --name required');
      process.exit(1);
    }
    
    const fullName = args[nameIdx + 1].split(' ');
    const result = addContact({
      first_name: fullName[0],
      last_name: fullName.slice(1).join(' '),
      email: emailIdx !== -1 ? args[emailIdx + 1] : null,
      company: companyIdx !== -1 ? args[companyIdx + 1] : null
    });
    
    if (result.error) {
      console.error(`❌ ${result.error}`);
    } else {
      console.log(`✅ Contact added with ID: ${result.id}`);
    }
  } else if (args.includes('--list')) {
    const sortIdx = args.indexOf('--sort');
    const limitIdx = args.indexOf('--limit');
    
    const contacts = listContacts({
      sort: sortIdx !== -1 ? args[sortIdx + 1] : 'score',
      limit: limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : 20
    });
    
    console.log(`\n📋 Contacts (${contacts.length}):\n`);
    contacts.forEach(c => {
      console.log(`${c.id}. ${c.first_name} ${c.last_name || ''} ${c.email ? `<${c.email}>` : ''}`);
      console.log(`   ${c.company || 'No company'} | Score: ${c.relationship_score} | ${c.priority}`);
    });
  } else if (args.includes('--search')) {
    const searchIdx = args.indexOf('--search');
    const query = args[searchIdx + 1];
    
    const results = searchContacts(query);
    console.log(`\n🔍 Search results for "${query}" (${results.length}):\n`);
    results.forEach(c => {
      console.log(`${c.id}. ${c.first_name} ${c.last_name || ''} <${c.email}>`);
      console.log(`   ${c.company || 'No company'}`);
    });
  } else if (args.includes('--merge')) {
    const mergeIdx = args.indexOf('--merge');
    const keepId = parseInt(args[mergeIdx + 1]);
    const mergeId = parseInt(args[mergeIdx + 2]);
    
    const result = mergeContacts(keepId, mergeId);
    
    if (result.error) {
      console.error(`❌ ${result.error}`);
    } else {
      console.log(`✅ Merged contact ${mergeId} into ${keepId}`);
    }
  } else {
    console.log(`Usage:
  --add --name "Jane Doe" --email jane@example.com --company "Acme"
  --list [--sort score|name|company|recent] [--limit N]
  --search "query"
  --merge <keep_id> <merge_id>
    `);
  }
}
