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

// Create follow-up
function createFollowUp(contactId, data) {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    INSERT INTO follow_ups (
      contact_id, description, due_date, priority, created_by
    ) VALUES (
      @contact_id, @description, @due_date, @priority, @created_by
    )
  `);
  
  const result = stmt.run({
    contact_id: contactId,
    description: data.description,
    due_date: data.due_date,
    priority: data.priority || 'normal',
    created_by: data.created_by || 'manual'
  });
  
  logger.info('crm.follow_up_created', {
    id: result.lastInsertRowid,
    contact_id: contactId,
    due_date: data.due_date
  });
  
  return { id: result.lastInsertRowid };
}

// Get follow-ups
function getFollowUps({ status = null, contactId = null, overdue = false } = {}) {
  const db = getDatabase();
  
  let query = `
    SELECT f.*, c.first_name, c.last_name, c.email, c.company
    FROM follow_ups f
    JOIN contacts c ON f.contact_id = c.id
    WHERE 1=1
  `;
  const params = {};
  
  if (status) {
    query += ' AND f.status = @status';
    params.status = status;
  }
  
  if (contactId) {
    query += ' AND f.contact_id = @contactId';
    params.contactId = contactId;
  }
  
  if (overdue) {
    query += ' AND f.status = "pending" AND f.due_date < datetime("now")';
  }
  
  query += ' ORDER BY f.due_date ASC';
  
  return db.prepare(query).all(params);
}

// Update follow-up
function updateFollowUp(id, data) {
  const db = getDatabase();
  
  const fields = [];
  const values = { id };
  
  if (data.description !== undefined) { fields.push('description = @description'); values.description = data.description; }
  if (data.due_date !== undefined) { fields.push('due_date = @due_date'); values.due_date = data.due_date; }
  if (data.status !== undefined) { fields.push('status = @status'); values.status = data.status; }
  if (data.priority !== undefined) { fields.push('priority = @priority'); values.priority = data.priority; }
  if (data.snoozed_until !== undefined) { fields.push('snoozed_until = @snoozed_until'); values.snoozed_until = data.snoozed_until; }
  
  if (data.status === 'done') {
    fields.push('completed_at = datetime("now")');
  }
  
  if (fields.length === 0) {
    return { error: 'No fields to update' };
  }
  
  const stmt = db.prepare(`UPDATE follow_ups SET ${fields.join(', ')} WHERE id = @id`);
  stmt.run(values);
  
  logger.info('crm.follow_up_updated', { id, fields: Object.keys(values).filter(k => k !== 'id') });
  
  return { success: true };
}

// Snooze follow-up
function snoozeFollowUp(id, until) {
  return updateFollowUp(id, {
    status: 'snoozed',
    snoozed_until: until
  });
}

// Mark follow-up as done
function completeFollowUp(id) {
  return updateFollowUp(id, { status: 'done' });
}

// Cancel follow-up
function cancelFollowUp(id) {
  return updateFollowUp(id, { status: 'cancelled' });
}

// Check for unsnoozed items
function processSnoozes() {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    UPDATE follow_ups 
    SET status = 'pending', snoozed_until = NULL
    WHERE status = 'snoozed' 
      AND snoozed_until < datetime('now')
  `);
  
  const result = stmt.run();
  
  if (result.changes > 0) {
    logger.info('crm.follow_ups_unsnoozed', { count: result.changes });
  }
  
  return result.changes;
}

module.exports = {
  createFollowUp,
  getFollowUps,
  updateFollowUp,
  snoozeFollowUp,
  completeFollowUp,
  cancelFollowUp,
  processSnoozes
};

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--add')) {
    const contactIdx = args.indexOf('--contact');
    const descIdx = args.indexOf('--description');
    const dueIdx = args.indexOf('--due');
    
    if (contactIdx === -1 || descIdx === -1 || dueIdx === -1) {
      console.error('❌ --contact, --description, and --due required');
      process.exit(1);
    }
    
    const result = createFollowUp(parseInt(args[contactIdx + 1]), {
      description: args[descIdx + 1],
      due_date: args[dueIdx + 1]
    });
    
    console.log(`✅ Follow-up created with ID: ${result.id}`);
  } else if (args.includes('--list')) {
    const overdue = args.includes('--overdue');
    const followUps = getFollowUps({ overdue });
    
    console.log(`\n⏰ Follow-ups${overdue ? ' (overdue)' : ''} (${followUps.length}):\n`);
    followUps.forEach(f => {
      const contact = `${f.first_name} ${f.last_name || ''} (${f.company || 'no company'})`;
      console.log(`${f.id}. ${f.description}`);
      console.log(`   ${contact} | Due: ${f.due_date} | ${f.status} | ${f.priority}`);
    });
  } else if (args.includes('--snooze')) {
    const idIdx = args.indexOf('--snooze');
    const untilIdx = args.indexOf('--until');
    
    if (untilIdx === -1) {
      console.error('❌ --until required');
      process.exit(1);
    }
    
    const result = snoozeFollowUp(parseInt(args[idIdx + 1]), args[untilIdx + 1]);
    
    if (result.error) {
      console.error(`❌ ${result.error}`);
    } else {
      console.log(`✅ Follow-up snoozed until ${args[untilIdx + 1]}`);
    }
  } else if (args.includes('--done')) {
    const idIdx = args.indexOf('--done');
    const result = completeFollowUp(parseInt(args[idIdx + 1]));
    
    if (result.error) {
      console.error(`❌ ${result.error}`);
    } else {
      console.log(`✅ Follow-up marked as done`);
    }
  } else {
    console.log(`Usage:
  --add --contact <id> --description "..." --due YYYY-MM-DD
  --list [--overdue]
  --snooze <id> --until YYYY-MM-DD
  --done <id>
    `);
  }
}
