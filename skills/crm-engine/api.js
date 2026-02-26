#!/usr/bin/env node
/**
 * CRM Engine Integration API
 * 
 * Importable module for Mission Control, AnselAI, R3 Studios, and agent queries.
 * NOT an HTTP API - use require('./api') in other Node.js modules.
 */

const { getContact, getContactByEmail, addContact, updateContact, listContacts, searchContacts, mergeContacts, deleteContact } = require('./contacts');
const { logInteraction, getInteractions, getInteractionStats } = require('./interactions');
const { createFollowUp, getFollowUps, updateFollowUp, snoozeFollowUp, completeFollowUp, cancelFollowUp } = require('./follow-ups');
const { scoreContact, recalculateAll: recalculateScores, generateReport: generateScoreReport } = require('./scorer');
const { generate: generateNudges, getNudgesByPriority } = require('./nudges');
const { generateProfile, getProfile, updateStale: updateStaleProfiles } = require('./profiler');
const { extractFromEmailPipeline, getPending: getPendingContacts, approve: approveContact, reject: rejectContact, getSkipPatterns } = require('./discovery');
const { query } = require('./query');
const { generateDraft, getPendingDrafts, approveDraft } = require('./drafts');
const { dailySync } = require('./sync');
const { getDatabase } = require('./db');

// Get overall CRM stats
function getStats() {
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
  
  const overdueFollowUps = db.prepare(`
    SELECT COUNT(*) as count 
    FROM follow_ups 
    WHERE status = 'pending' AND due_date < datetime('now')
  `).get();
  
  return {
    total_contacts: total.count,
    by_priority: byPriority,
    average_score: Math.round(avgScore.avg || 0),
    recent_interactions: recentInteractions.count,
    pending_follow_ups: pendingFollowUps.count,
    overdue_follow_ups: overdueFollowUps.count
  };
}

// Get contact summary (combines contact, profile, recent interactions)
function getSummary(contactId) {
  const contact = getContact(contactId);
  if (!contact) {
    return { error: 'Contact not found' };
  }
  
  const profile = getProfile(contactId);
  const interactions = getInteractions(contactId, { limit: 10 });
  const stats = getInteractionStats(contactId);
  const followUps = getFollowUps({ contactId });
  
  return {
    contact,
    profile,
    recent_interactions: interactions,
    stats,
    follow_ups: followUps
  };
}

module.exports = {
  // Contacts
  getContact,
  getContactByEmail,
  addContact,
  updateContact,
  listContacts,
  searchContacts,
  mergeContacts,
  deleteContact,
  
  // Interactions
  logInteraction,
  getInteractions,
  getInteractionStats,
  
  // Follow-ups
  createFollowUp,
  getFollowUps,
  updateFollowUp,
  snoozeFollowUp,
  completeFollowUp,
  cancelFollowUp,
  
  // Scoring & Intelligence
  scoreContact,
  recalculateScores,
  generateScoreReport,
  getNudges: generateNudges,
  getNudgesByPriority,
  getProfile,
  generateProfile,
  updateStaleProfiles,
  getSummary,
  
  // Discovery
  extractFromEmailPipeline,
  getPendingContacts,
  approveContact,
  rejectContact,
  getSkipPatterns,
  
  // Query
  query,
  
  // Drafts
  generateDraft,
  getPendingDrafts,
  approveDraft,
  
  // Sync
  dailySync,
  
  // Stats
  getStats,
  
  // Database
  getDatabase
};

// CLI: Show API documentation
if (require.main === module) {
  console.log(`
CRM Engine Integration API
===========================

This is an importable Node.js module, not an HTTP API.

Usage:
  const crm = require('./api');
  
  // Get contact
  const contact = crm.getContact(12);
  
  // Search contacts
  const results = crm.searchContacts('photographer');
  
  // Natural language query
  const result = crm.query('who needs attention?');
  
  // Get stats
  const stats = crm.getStats();

Available functions:

Contacts:
  getContact(id)
  getContactByEmail(email)
  addContact(data)
  updateContact(id, data)
  listContacts({ sort, limit, filter })
  searchContacts(query)
  mergeContacts(keepId, mergeId)
  deleteContact(id)

Interactions:
  logInteraction(contactId, data)
  getInteractions(contactId, { limit, since })
  getInteractionStats(contactId)

Follow-ups:
  createFollowUp(contactId, data)
  getFollowUps({ status, contactId })
  updateFollowUp(id, data)
  snoozeFollowUp(id, until)
  completeFollowUp(id)
  cancelFollowUp(id)

Intelligence:
  scoreContact(contactId)
  recalculateScores()
  generateScoreReport()
  getNudges()
  getNudgesByPriority()
  getProfile(contactId)
  generateProfile(contactId)
  updateStaleProfiles()
  getSummary(contactId)

Discovery:
  extractFromEmailPipeline(hoursBack)
  getPendingContacts()
  approveContact(discoveryId)
  rejectContact(discoveryId)
  getSkipPatterns()

Query:
  query(naturalLanguageString)

Drafts:
  generateDraft(contactId, context)
  getPendingDrafts()
  approveDraft(draftId)

System:
  dailySync(dryRun)
  getStats()
  getDatabase()

For detailed usage, see README.md or SKILL.md
  `);
}
