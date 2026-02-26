#!/usr/bin/env node
const path = require('path');
const { getDatabase } = require('./db');
const { searchContacts, getContact } = require('./contacts');
const { generate: generateNudges } = require('./nudges');
const { getProfile } = require('./profiler');
const { createFollowUp } = require('./follow-ups');

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

// Intent detection patterns
const INTENTS = [
  {
    pattern: /(?:tell me about|who is|what do (?:we|i) know about)\s+(.+)/i,
    type: 'contact_lookup',
    extract: (m) => ({ name: m[1] })
  },
  {
    pattern: /(?:who (?:works )?at|people at|contacts at)\s+(.+)/i,
    type: 'company_lookup',
    extract: (m) => ({ company: m[1] })
  },
  {
    pattern: /follow up with\s+(.+?)(?:\s+in\s+(.+))?$/i,
    type: 'create_follow_up',
    extract: (m) => ({ name: m[1], timeframe: m[2] })
  },
  {
    pattern: /who needs (?:attention|follow.?up|a nudge)/i,
    type: 'nudge_report'
  },
  {
    pattern: /(?:crm )?stats|dashboard|overview/i,
    type: 'stats'
  },
  {
    pattern: /(?:add|create) contact\s+(.+)/i,
    type: 'add_contact',
    extract: (m) => ({ raw: m[1] })
  },
  {
    pattern: /(?:search|find)\s+(.+)/i,
    type: 'search',
    extract: (m) => ({ query: m[1] })
  }
];

// Detect intent from query
function detectIntent(queryStr) {
  for (const intent of INTENTS) {
    const match = queryStr.match(intent.pattern);
    if (match) {
      const params = intent.extract ? intent.extract(match) : {};
      return { type: intent.type, params };
    }
  }
  
  return { type: 'search', params: { query: queryStr } };
}

// Parse timeframe (e.g., "3 days", "1 week", "next month")
function parseTimeframe(timeframe) {
  if (!timeframe) return null;
  
  const now = new Date();
  
  // "N days/weeks/months"
  const match = timeframe.match(/(\d+)\s+(day|week|month)s?/i);
  if (match) {
    const count = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    
    if (unit === 'day') {
      now.setDate(now.getDate() + count);
    } else if (unit === 'week') {
      now.setDate(now.getDate() + count * 7);
    } else if (unit === 'month') {
      now.setMonth(now.getMonth() + count);
    }
    
    return now.toISOString().split('T')[0];
  }
  
  return null;
}

// Handle contact_lookup intent
function handleContactLookup(params) {
  const results = searchContacts(params.name);
  
  if (results.length === 0) {
    return { 
      type: 'contact_lookup', 
      found: false, 
      message: `No contact found matching "${params.name}"` 
    };
  }
  
  const contact = results[0];
  const profile = getProfile(contact.id);
  
  return {
    type: 'contact_lookup',
    found: true,
    contact,
    profile,
    message: formatContactDetails(contact, profile)
  };
}

// Handle company_lookup intent
function handleCompanyLookup(params) {
  const db = getDatabase();
  
  const contacts = db.prepare(`
    SELECT * FROM contacts 
    WHERE company LIKE ? 
      AND skip_pattern = 0
    ORDER BY relationship_score DESC
  `).all(`%${params.company}%`);
  
  if (contacts.length === 0) {
    return {
      type: 'company_lookup',
      found: false,
      message: `No contacts found at "${params.company}"`
    };
  }
  
  return {
    type: 'company_lookup',
    found: true,
    company: params.company,
    contacts,
    count: contacts.length,
    message: formatCompanyContacts(params.company, contacts)
  };
}

// Handle create_follow_up intent
function handleCreateFollowUp(params) {
  const results = searchContacts(params.name);
  
  if (results.length === 0) {
    return {
      type: 'create_follow_up',
      success: false,
      message: `No contact found matching "${params.name}"`
    };
  }
  
  const contact = results[0];
  const dueDate = parseTimeframe(params.timeframe);
  
  if (!dueDate) {
    return {
      type: 'create_follow_up',
      success: false,
      message: 'Could not parse timeframe. Please specify a date or timeframe (e.g., "3 days", "next week")'
    };
  }
  
  const result = createFollowUp(contact.id, {
    description: `Follow up with ${contact.first_name} ${contact.last_name || ''}`,
    due_date: dueDate,
    created_by: 'query'
  });
  
  return {
    type: 'create_follow_up',
    success: true,
    contact,
    due_date: dueDate,
    follow_up_id: result.id,
    message: `✅ Follow-up created for ${contact.first_name} ${contact.last_name || ''} on ${dueDate}`
  };
}

// Handle nudge_report intent
function handleNudgeReport() {
  const nudges = generateNudges();
  
  return {
    type: 'nudge_report',
    count: nudges.length,
    nudges,
    message: formatNudges(nudges)
  };
}

// Handle stats intent
function handleStats() {
  const db = getDatabase();
  
  const total = db.prepare('SELECT COUNT(*) as count FROM contacts WHERE skip_pattern = 0').get();
  const byPriority = db.prepare(`
    SELECT priority, COUNT(*) as count 
    FROM contacts 
    WHERE skip_pattern = 0 
    GROUP BY priority
  `).all();
  
  const avgScore = db.prepare(`
    SELECT AVG(relationship_score) as avg 
    FROM contacts 
    WHERE skip_pattern = 0
  `).get();
  
  const recentInteractions = db.prepare(`
    SELECT COUNT(*) as count 
    FROM interactions 
    WHERE occurred_at >= datetime('now', '-7 days')
  `).get();
  
  const pendingFollowUps = db.prepare(`
    SELECT COUNT(*) as count 
    FROM follow_ups 
    WHERE status = 'pending'
  `).get();
  
  return {
    type: 'stats',
    total: total.count,
    by_priority: byPriority,
    avg_score: Math.round(avgScore.avg),
    recent_interactions: recentInteractions.count,
    pending_follow_ups: pendingFollowUps.count,
    message: formatStats({
      total: total.count,
      by_priority: byPriority,
      avg_score: Math.round(avgScore.avg),
      recent_interactions: recentInteractions.count,
      pending_follow_ups: pendingFollowUps.count
    })
  };
}

// Format contact details for output
function formatContactDetails(contact, profile) {
  let output = `📇 ${contact.first_name} ${contact.last_name || ''}\n`;
  
  if (contact.email) output += `   Email: ${contact.email}\n`;
  if (contact.company) output += `   Company: ${contact.company}\n`;
  if (contact.role) output += `   Role: ${contact.role}\n`;
  
  output += `   Score: ${contact.relationship_score} | Priority: ${contact.priority}\n`;
  
  if (profile.summary && profile.summary.summary) {
    output += `\n   Summary: ${profile.summary.summary}\n`;
    output += `   Last interaction: ${profile.summary.last_interaction}\n`;
    output += `   Total interactions: ${profile.summary.interaction_count}\n`;
  }
  
  if (profile.relationship_type) {
    output += `   Type: ${profile.relationship_type}\n`;
  }
  
  if (profile.communication_style) {
    output += `   Style: ${profile.communication_style}\n`;
  }
  
  return output;
}

// Format company contacts for output
function formatCompanyContacts(company, contacts) {
  let output = `🏢 Contacts at ${company} (${contacts.length}):\n\n`;
  
  contacts.forEach(c => {
    output += `  • ${c.first_name} ${c.last_name || ''}`;
    if (c.role) output += ` (${c.role})`;
    output += `\n    ${c.email || 'no email'} | Score: ${c.relationship_score}\n`;
  });
  
  return output;
}

// Format nudges for output
function formatNudges(nudges) {
  if (nudges.length === 0) {
    return '✅ No nudges needed. All relationships are healthy!';
  }
  
  let output = `🔔 ${nudges.length} contacts need attention:\n\n`;
  
  const urgent = nudges.filter(n => n.priority === 'urgent');
  const high = nudges.filter(n => n.priority === 'high');
  const normal = nudges.filter(n => n.priority === 'normal');
  
  if (urgent.length > 0) {
    output += '🚨 URGENT:\n';
    urgent.forEach(n => {
      output += `  • ${n.message}\n`;
      if (n.suggest_action) output += `    → ${n.suggest_action}\n`;
    });
    output += '\n';
  }
  
  if (high.length > 0) {
    output += '⚠️  HIGH PRIORITY:\n';
    high.forEach(n => {
      output += `  • ${n.message}\n`;
      if (n.suggest_action) output += `    → ${n.suggest_action}\n`;
    });
    output += '\n';
  }
  
  if (normal.length > 0) {
    output += 'ℹ️  NORMAL:\n';
    normal.slice(0, 5).forEach(n => {
      output += `  • ${n.message}\n`;
    });
    if (normal.length > 5) {
      output += `  ... and ${normal.length - 5} more\n`;
    }
  }
  
  return output;
}

// Format stats for output
function formatStats(stats) {
  let output = `📊 CRM Stats\n\n`;
  output += `Total contacts: ${stats.total}\n`;
  output += `Average score: ${stats.avg_score}\n`;
  output += `Recent interactions (7d): ${stats.recent_interactions}\n`;
  output += `Pending follow-ups: ${stats.pending_follow_ups}\n\n`;
  
  output += 'By Priority:\n';
  stats.by_priority.forEach(p => {
    output += `  ${p.priority}: ${p.count}\n`;
  });
  
  return output;
}

// Main query handler
function query(queryStr) {
  logger.info('crm.query', { query: queryStr });
  
  const intent = detectIntent(queryStr);
  
  let result;
  
  switch (intent.type) {
    case 'contact_lookup':
      result = handleContactLookup(intent.params);
      break;
    case 'company_lookup':
      result = handleCompanyLookup(intent.params);
      break;
    case 'create_follow_up':
      result = handleCreateFollowUp(intent.params);
      break;
    case 'nudge_report':
      result = handleNudgeReport();
      break;
    case 'stats':
      result = handleStats();
      break;
    case 'search':
      const searchResults = searchContacts(intent.params.query);
      result = {
        type: 'search',
        query: intent.params.query,
        results: searchResults,
        count: searchResults.length,
        message: searchResults.length > 0 
          ? `Found ${searchResults.length} contacts matching "${intent.params.query}":\n\n${searchResults.slice(0, 5).map(c => `  • ${c.first_name} ${c.last_name || ''} <${c.email}> (${c.company || 'no company'})`).join('\n')}`
          : `No contacts found matching "${intent.params.query}"`
      };
      break;
    default:
      result = { 
        type: 'unknown', 
        message: 'Sorry, I didn\'t understand that query.' 
      };
  }
  
  logger.info('crm.query_result', { intent: intent.type, success: result.found !== false });
  
  return result;
}

module.exports = {
  query,
  detectIntent
};

// CLI interface
if (require.main === module) {
  const queryStr = process.argv.slice(2).join(' ');
  
  if (!queryStr) {
    console.log(`Usage: node query.js <natural language query>

Examples:
  node query.js "tell me about Tyler Reese"
  node query.js "who at The Knot?"
  node query.js "who needs attention?"
  node query.js "stats"
  node query.js "follow up with Tyler in 3 days"
    `);
    process.exit(0);
  }
  
  const result = query(queryStr);
  console.log(`\n${result.message}\n`);
}
