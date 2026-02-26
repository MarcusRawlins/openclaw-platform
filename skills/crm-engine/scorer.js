#!/usr/bin/env node
const path = require('path');
const { getDatabase } = require('./db');
const { getInteractions } = require('./interactions');
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

const WEIGHTS = CONFIG.scoring.weights;

// Calculate days since a date
function daysSince(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  return Math.floor((now - date) / (1000 * 60 * 60 * 24));
}

// Recency score (0-100)
function calculateRecency(interactions) {
  if (interactions.length === 0) return 5;
  
  const latest = interactions[0]; // Assumes sorted DESC
  const days = daysSince(latest.occurred_at);
  
  // Exponential decay: 0 days = 100, 7 days = 80, 30 days = 50, 90 days = 20, 180+ = 5
  return Math.max(5, Math.min(100, 100 * Math.exp(-0.015 * days)));
}

// Frequency score (0-100)
function calculateFrequency(interactions) {
  if (interactions.length === 0) return 0;
  
  // Count interactions in last 180 days
  const now = new Date();
  const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
  
  const recentInteractions = interactions.filter(i => 
    new Date(i.occurred_at) >= sixMonthsAgo
  );
  
  const monthlyRate = recentInteractions.length / 6;
  
  // 5+ per month = 100
  return Math.min(100, monthlyRate * 20);
}

// Priority score (0-100)
function calculatePriority(contact) {
  const priorityMap = {
    vip: 100,
    high: 80,
    normal: 50,
    low: 20
  };
  
  return priorityMap[contact.priority] || 50;
}

// Depth score (0-100)
function calculateDepth(interactions) {
  if (interactions.length === 0) return 0;
  
  // Average summary length as proxy for depth
  const avgLength = interactions.reduce((sum, i) => {
    const len = i.summary ? i.summary.length : 0;
    return sum + len;
  }, 0) / interactions.length;
  
  // 200+ chars = rich interaction
  return Math.min(100, (avgLength / 200) * 100);
}

// Reciprocity score (0-100)
function calculateReciprocity(interactions) {
  if (interactions.length === 0) return 50;
  
  const outbound = interactions.filter(i => i.direction === 'outbound').length;
  const inbound = interactions.filter(i => i.direction === 'inbound').length;
  const total = interactions.length;
  
  if (total === 0) return 50;
  
  const outboundRatio = outbound / total;
  
  // Perfect balance (50/50) = 100
  // All outbound or all inbound = lower score
  const balance = 1 - Math.abs(outboundRatio - 0.5) * 2;
  
  return Math.round(balance * 100);
}

// Calculate overall relationship score
function calculateScore(contact, interactions) {
  const recency = calculateRecency(interactions);
  const frequency = calculateFrequency(interactions);
  const priority = calculatePriority(contact);
  const depth = calculateDepth(interactions);
  const reciprocity = calculateReciprocity(interactions);
  
  const score = Math.round(
    recency * WEIGHTS.recency +
    frequency * WEIGHTS.frequency +
    priority * WEIGHTS.priority +
    depth * WEIGHTS.depth +
    reciprocity * WEIGHTS.reciprocity
  );
  
  return {
    score,
    breakdown: { recency, frequency, priority, depth, reciprocity }
  };
}

// Score a single contact
function scoreContact(contactId) {
  const db = getDatabase();
  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(contactId);
  
  if (!contact) {
    return { error: 'Contact not found' };
  }
  
  const interactions = getInteractions(contactId, { limit: 1000 });
  const result = calculateScore(contact, interactions);
  
  // Store previous score for decay detection
  const previousScore = contact.relationship_score;
  
  // Update contact
  db.prepare("UPDATE contacts SET relationship_score = ?, updated_at = datetime('now') WHERE id = ?")
    .run(result.score, contactId);
  
  logger.info('crm.contact_scored', {
    id: contactId,
    score: result.score,
    previous: previousScore,
    delta: result.score - previousScore
  });
  
  return {
    contact_id: contactId,
    score: result.score,
    previous: previousScore,
    breakdown: result.breakdown
  };
}

// Recalculate scores for all active contacts
function recalculateAll() {
  const db = getDatabase();
  const contacts = db.prepare('SELECT id FROM contacts WHERE skip_pattern = 0').all();
  
  const results = [];
  
  for (const contact of contacts) {
    const result = scoreContact(contact.id);
    if (!result.error) {
      results.push(result);
    }
  }
  
  logger.info('crm.scores_recalculated', { count: results.length });
  
  return results;
}

// Generate scoring report
function generateReport() {
  const db = getDatabase();
  
  const top20 = db.prepare(`
    SELECT id, first_name, last_name, email, company, relationship_score, priority
    FROM contacts
    WHERE skip_pattern = 0
    ORDER BY relationship_score DESC
    LIMIT 20
  `).all();
  
  const bottom20 = db.prepare(`
    SELECT id, first_name, last_name, email, company, relationship_score, priority
    FROM contacts
    WHERE skip_pattern = 0
    ORDER BY relationship_score ASC
    LIMIT 20
  `).all();
  
  const avgScore = db.prepare(`
    SELECT AVG(relationship_score) as avg
    FROM contacts
    WHERE skip_pattern = 0
  `).get();
  
  return {
    top: top20,
    bottom: bottom20,
    average: Math.round(avgScore.avg)
  };
}

module.exports = {
  calculateScore,
  scoreContact,
  recalculateAll,
  generateReport,
  calculateRecency,
  calculateFrequency,
  calculateDepth,
  calculateReciprocity
};

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--recalculate')) {
    console.log('📊 Recalculating relationship scores...\n');
    const results = recalculateAll();
    
    const improved = results.filter(r => r.score > r.previous);
    const declined = results.filter(r => r.score < r.previous);
    
    console.log(`✅ Scored ${results.length} contacts`);
    console.log(`   ${improved.length} improved, ${declined.length} declined\n`);
    
    if (declined.length > 0) {
      console.log('⚠️  Declining relationships:');
      declined
        .sort((a, b) => (a.previous - a.score) - (b.previous - b.score))
        .slice(0, 5)
        .forEach(r => {
          console.log(`   Contact ${r.contact_id}: ${r.previous} → ${r.score} (${r.score - r.previous})`);
        });
    }
  } else if (args.includes('--report')) {
    const report = generateReport();
    
    console.log(`\n📊 Relationship Scoring Report\n`);
    console.log(`Average score: ${report.average}\n`);
    
    console.log('🏆 Top 20 Relationships:\n');
    report.top.forEach((c, idx) => {
      console.log(`${idx + 1}. ${c.first_name} ${c.last_name || ''} (${c.company || 'no company'})`);
      console.log(`   Score: ${c.relationship_score} | ${c.priority}`);
    });
    
    console.log('\n⚠️  Bottom 20 Relationships:\n');
    report.bottom.forEach((c, idx) => {
      console.log(`${idx + 1}. ${c.first_name} ${c.last_name || ''} (${c.company || 'no company'})`);
      console.log(`   Score: ${c.relationship_score} | ${c.priority}`);
    });
  } else if (args.includes('--score')) {
    const idIdx = args.indexOf('--score');
    const contactId = parseInt(args[idIdx + 1]);
    
    const result = scoreContact(contactId);
    
    if (result.error) {
      console.error(`❌ ${result.error}`);
      process.exit(1);
    }
    
    console.log(`\n📊 Relationship Score for Contact ${contactId}:\n`);
    console.log(`Overall: ${result.score} (previous: ${result.previous})`);
    console.log('\nBreakdown:');
    console.log(`  Recency:     ${Math.round(result.breakdown.recency)} (weight: ${WEIGHTS.recency})`);
    console.log(`  Frequency:   ${Math.round(result.breakdown.frequency)} (weight: ${WEIGHTS.frequency})`);
    console.log(`  Priority:    ${Math.round(result.breakdown.priority)} (weight: ${WEIGHTS.priority})`);
    console.log(`  Depth:       ${Math.round(result.breakdown.depth)} (weight: ${WEIGHTS.depth})`);
    console.log(`  Reciprocity: ${Math.round(result.breakdown.reciprocity)} (weight: ${WEIGHTS.reciprocity})`);
  } else {
    console.log(`Usage:
  --recalculate          Recalculate all contact scores
  --report               Show top/bottom 20 contacts
  --score <contact_id>   Show detailed score breakdown
    `);
  }
}
