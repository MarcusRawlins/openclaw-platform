#!/usr/bin/env node
const path = require('path');
const { getDatabase } = require('./db');
const { getFollowUps } = require('./follow-ups');
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

// Helper: check if date is in the past
function isPast(dateStr) {
  return new Date(dateStr) < new Date();
}

// Helper: days since date
function daysSince(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  return Math.floor((now - date) / (1000 * 60 * 60 * 24));
}

// Nudge rules
const NUDGE_RULES = [
  {
    name: 'dormant_high_value',
    condition: (c) => c.relationship_score < 40 && (c.priority === 'vip' || c.priority === 'high'),
    message: (c) => `VIP contact ${c.first_name} ${c.last_name || ''} hasn't heard from you in a while. Score dropped to ${c.relationship_score}.`,
    priority: 'high',
    suggest_action: 'Send a quick check-in email'
  },
  {
    name: 'overdue_follow_up',
    condition: (c, followUps) => followUps.some(f => f.status === 'pending' && isPast(f.due_date)),
    message: (c, followUps) => {
      const overdue = followUps.filter(f => f.status === 'pending' && isPast(f.due_date));
      const first = overdue[0];
      return `Overdue follow-up with ${c.first_name} ${c.last_name || ''}: ${first.description}`;
    },
    priority: 'urgent'
  },
  {
    name: 'relationship_decay',
    condition: (c) => {
      // Need previous score stored somewhere - for now, skip this rule
      // TODO: Store previous_score in contacts table
      return false;
    },
    message: (c) => `${c.first_name} ${c.last_name || ''} relationship score dropped significantly.`,
    priority: 'normal',
    suggest_action: 'Reach out to maintain the relationship'
  },
  {
    name: 'new_contact_stale',
    condition: (c, followUps, interactions) => {
      const daysSinceCreated = daysSince(c.created_at);
      return interactions.length <= 1 && daysSinceCreated > 7;
    },
    message: (c) => {
      const days = daysSince(c.created_at);
      return `New contact ${c.first_name} ${c.last_name || ''} added ${days} days ago with only 1 interaction.`;
    },
    priority: 'normal',
    suggest_action: 'Follow up to build the relationship'
  },
  {
    name: 'long_silence',
    condition: (c, followUps, interactions) => {
      if (interactions.length === 0) return false;
      const latest = interactions[0];
      const days = daysSince(latest.occurred_at);
      return days > CONFIG.nudges.dormant_threshold_days && c.priority !== 'low';
    },
    message: (c, followUps, interactions) => {
      const latest = interactions[0];
      const days = daysSince(latest.occurred_at);
      return `${days} days since last contact with ${c.first_name} ${c.last_name || ''}.`;
    },
    priority: 'normal',
    suggest_action: 'Consider reaching out'
  }
];

// Generate nudges for all contacts
function generate() {
  const db = getDatabase();
  
  const contacts = db.prepare(`
    SELECT * FROM contacts 
    WHERE skip_pattern = 0 
      AND approved = 1
    ORDER BY relationship_score ASC
  `).all();
  
  const nudges = [];
  
  for (const contact of contacts) {
    // Get follow-ups for this contact
    const followUps = getFollowUps({ contactId: contact.id });
    
    // Get interactions
    const interactions = db.prepare(`
      SELECT * FROM interactions 
      WHERE contact_id = ? 
      ORDER BY occurred_at DESC 
      LIMIT 100
    `).all(contact.id);
    
    // Check each rule
    for (const rule of NUDGE_RULES) {
      if (rule.condition(contact, followUps, interactions)) {
        nudges.push({
          contact_id: contact.id,
          contact_name: `${contact.first_name} ${contact.last_name || ''}`,
          contact_email: contact.email,
          contact_company: contact.company,
          rule: rule.name,
          message: rule.message(contact, followUps, interactions),
          priority: rule.priority,
          suggest_action: rule.suggest_action || null
        });
        
        // Only one nudge per contact
        break;
      }
    }
  }
  
  logger.info('crm.nudges_generated', { count: nudges.length });
  
  return nudges;
}

// Get nudges by priority
function getNudgesByPriority() {
  const allNudges = generate();
  
  return {
    urgent: allNudges.filter(n => n.priority === 'urgent'),
    high: allNudges.filter(n => n.priority === 'high'),
    normal: allNudges.filter(n => n.priority === 'normal')
  };
}

module.exports = {
  generate,
  getNudgesByPriority
};

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--generate') || args.length === 0) {
    console.log('🔔 Generating nudges...\n');
    const nudges = generate();
    
    if (nudges.length === 0) {
      console.log('✅ No nudges needed. All relationships are healthy!');
      process.exit(0);
    }
    
    console.log(`Found ${nudges.length} contacts needing attention:\n`);
    
    // Group by priority
    const byPriority = getNudgesByPriority();
    
    if (byPriority.urgent.length > 0) {
      console.log('🚨 URGENT:\n');
      byPriority.urgent.forEach(n => {
        console.log(`  • ${n.contact_name} (${n.contact_company || 'no company'})`);
        console.log(`    ${n.message}`);
        if (n.suggest_action) console.log(`    → ${n.suggest_action}`);
        console.log();
      });
    }
    
    if (byPriority.high.length > 0) {
      console.log('⚠️  HIGH PRIORITY:\n');
      byPriority.high.forEach(n => {
        console.log(`  • ${n.contact_name} (${n.contact_company || 'no company'})`);
        console.log(`    ${n.message}`);
        if (n.suggest_action) console.log(`    → ${n.suggest_action}`);
        console.log();
      });
    }
    
    if (byPriority.normal.length > 0) {
      console.log('ℹ️  NORMAL PRIORITY:\n');
      byPriority.normal.forEach(n => {
        console.log(`  • ${n.contact_name} (${n.contact_company || 'no company'})`);
        console.log(`    ${n.message}`);
        if (n.suggest_action) console.log(`    → ${n.suggest_action}`);
        console.log();
      });
    }
  } else {
    console.log(`Usage:
  --generate    Generate nudges for all contacts (default)
    `);
  }
}
