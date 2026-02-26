#!/usr/bin/env node
const path = require('path');
const { getDatabase } = require('./db');
const { getInteractions } = require('./interactions');
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

// Helper: days since date
function daysSince(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  return Math.floor((now - date) / (1000 * 60 * 60 * 24));
}

// Helper: day span between first and last interaction
function daySpan(interactions) {
  if (interactions.length === 0) return 0;
  const first = new Date(interactions[interactions.length - 1].occurred_at);
  const last = new Date(interactions[0].occurred_at);
  return Math.floor((last - first) / (1000 * 60 * 60 * 24));
}

// Generate relationship profile using LLM
async function generateProfile(contactId) {
  const db = getDatabase();
  
  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(contactId);
  if (!contact) {
    return { error: 'Contact not found' };
  }
  
  const interactions = getInteractions(contactId, { limit: 50 });
  
  if (interactions.length === 0) {
    logger.warn('crm.profile_no_interactions', { contact_id: contactId });
    return { error: 'No interactions to profile' };
  }
  
  const recentInteractions = interactions.slice(0, 10);
  const span = daySpan(interactions);
  
  const prompt = `Analyze this contact's relationship history and generate a profile.

Contact: ${contact.first_name} ${contact.last_name || ''} ${contact.email ? `<${contact.email}>` : ''}
Company: ${contact.company || 'Unknown'}
${interactions.length} interactions over ${span} days.

Recent interactions (most recent first):
${recentInteractions.map(i => `- ${i.occurred_at}: ${i.type} — ${i.subject || '(no subject)'}\n  ${i.summary ? i.summary.substring(0, 200) : ''}`).join('\n')}

Return ONLY valid JSON:
{
  "relationship_type": "client|vendor|friend|colleague|lead|other",
  "communication_style": "formal|casual|mixed",
  "key_topics": ["topic1", "topic2", "topic3"],
  "summary": "2-3 sentence relationship summary",
  "key_facts": ["fact1", "fact2", "fact3"],
  "suggested_approach": "How to best communicate with this person"
}`;

  try {
    const response = await llmRouter({
      model: CONFIG.profiler.model,
      prompt,
      maxTokens: 1000,
      temperature: 0.3
    });
    
    const profile = JSON.parse(response.text);
    
    // Store in database
    db.prepare(`
      INSERT INTO contact_summaries (contact_id, summary, key_facts, last_interaction, interaction_count)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(contact_id) DO UPDATE SET
        summary = excluded.summary,
        key_facts = excluded.key_facts,
        last_interaction = excluded.last_interaction,
        interaction_count = excluded.interaction_count,
        generated_at = datetime('now')
    `).run(
      contactId,
      profile.summary,
      JSON.stringify(profile.key_facts),
      interactions[0].occurred_at,
      interactions.length
    );
    
    // Update contact record
    db.prepare(`
      UPDATE contacts SET
        relationship_type = ?,
        communication_style = ?,
        key_topics = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      profile.relationship_type,
      profile.communication_style,
      JSON.stringify(profile.key_topics),
      contactId
    );
    
    logger.info('crm.profile_generated', { contact_id: contactId });
    
    return profile;
  } catch (error) {
    logger.error('crm.profile_generation_failed', { contact_id: contactId, error: error.message });
    return { error: error.message };
  }
}

// Update stale profiles (not updated in N days)
async function updateStale() {
  const db = getDatabase();
  
  const staleThreshold = CONFIG.profiler.update_interval_days;
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - staleThreshold);
  
  const staleContacts = db.prepare(`
    SELECT c.id, cs.generated_at
    FROM contacts c
    LEFT JOIN contact_summaries cs ON c.id = cs.contact_id
    WHERE c.skip_pattern = 0
      AND c.approved = 1
      AND (cs.generated_at IS NULL OR cs.generated_at < ?)
    LIMIT 10
  `).all(thresholdDate.toISOString());
  
  logger.info('crm.stale_profiles_found', { count: staleContacts.length });
  
  const results = [];
  
  for (const contact of staleContacts) {
    const profile = await generateProfile(contact.id);
    if (!profile.error) {
      results.push({ contact_id: contact.id, success: true });
    } else {
      results.push({ contact_id: contact.id, success: false, error: profile.error });
    }
  }
  
  return results;
}

// Get profile for a contact
function getProfile(contactId) {
  const db = getDatabase();
  
  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(contactId);
  if (!contact) {
    return { error: 'Contact not found' };
  }
  
  const summary = db.prepare('SELECT * FROM contact_summaries WHERE contact_id = ?').get(contactId);
  
  return {
    contact,
    summary: summary || null,
    key_topics: contact.key_topics ? JSON.parse(contact.key_topics) : [],
    relationship_type: contact.relationship_type,
    communication_style: contact.communication_style
  };
}

module.exports = {
  generateProfile,
  updateStale,
  getProfile
};

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--generate')) {
    const idIdx = args.indexOf('--generate');
    const contactId = parseInt(args[idIdx + 1]);
    
    (async () => {
      console.log(`🔍 Generating profile for contact ${contactId}...\n`);
      const profile = await generateProfile(contactId);
      
      if (profile.error) {
        console.error(`❌ ${profile.error}`);
        process.exit(1);
      }
      
      console.log(`✅ Profile generated:\n`);
      console.log(`Type: ${profile.relationship_type}`);
      console.log(`Style: ${profile.communication_style}`);
      console.log(`Topics: ${profile.key_topics.join(', ')}`);
      console.log(`\nSummary: ${profile.summary}`);
      console.log(`\nKey Facts:`);
      profile.key_facts.forEach(f => console.log(`  • ${f}`));
      console.log(`\nSuggested Approach: ${profile.suggested_approach}`);
    })();
  } else if (args.includes('--update-stale')) {
    (async () => {
      console.log('🔄 Updating stale profiles...\n');
      const results = await updateStale();
      
      const succeeded = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      
      console.log(`✅ Updated ${succeeded.length} profiles`);
      if (failed.length > 0) {
        console.log(`❌ Failed to update ${failed.length} profiles`);
      }
    })();
  } else if (args.includes('--show')) {
    const idIdx = args.indexOf('--show');
    const contactId = parseInt(args[idIdx + 1]);
    
    const profile = getProfile(contactId);
    
    if (profile.error) {
      console.error(`❌ ${profile.error}`);
      process.exit(1);
    }
    
    console.log(`\n📝 Profile for ${profile.contact.first_name} ${profile.contact.last_name || ''}:\n`);
    console.log(`Email: ${profile.contact.email || 'none'}`);
    console.log(`Company: ${profile.contact.company || 'none'}`);
    console.log(`Type: ${profile.relationship_type || 'unknown'}`);
    console.log(`Style: ${profile.communication_style || 'unknown'}`);
    console.log(`Topics: ${profile.key_topics.join(', ') || 'none'}`);
    
    if (profile.summary) {
      console.log(`\nSummary: ${profile.summary.summary}`);
      console.log(`Last interaction: ${profile.summary.last_interaction}`);
      console.log(`Interaction count: ${profile.summary.interaction_count}`);
    } else {
      console.log('\nNo profile summary generated yet.');
    }
  } else {
    console.log(`Usage:
  --generate <contact_id>    Generate profile for a contact
  --update-stale             Update profiles older than ${CONFIG.profiler.update_interval_days} days
  --show <contact_id>        Show existing profile
    `);
  }
}
