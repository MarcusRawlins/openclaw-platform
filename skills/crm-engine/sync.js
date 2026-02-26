#!/usr/bin/env node
const path = require('path');
const { getDatabase } = require('./db');
const { extractFromEmailPipeline } = require('./discovery');
const { logFromEmails } = require('./interactions');
const { recalculateAll } = require('./scorer');
const { generate: generateNudges } = require('./nudges');
const { updateStale } = require('./profiler');
const { processSnoozes } = require('./follow-ups');

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

async function dailySync(dryRun = false) {
  const startTime = Date.now();
  const results = {
    new_contacts: 0,
    interactions_logged: 0,
    scores_updated: 0,
    nudges_generated: 0,
    profiles_updated: 0,
    snoozes_processed: 0,
    errors: []
  };
  
  logger.info('crm.sync_started', { dry_run: dryRun });
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }
  
  try {
    // Step 1: Extract new contacts from email pipeline (last 24h)
    console.log('📥 Step 1: Scanning email pipeline for new contacts...');
    if (!dryRun) {
      const discovery = extractFromEmailPipeline(24);
      results.new_contacts = discovery.extracted.length;
      console.log(`   ✅ Found ${discovery.extracted.length} new contacts (${discovery.skipped.length} skipped)`);
    } else {
      console.log('   [SKIPPED - dry run]');
    }
    
    // Step 2: Log interactions from email pipeline
    console.log('\n📧 Step 2: Logging interactions from recent emails...');
    if (!dryRun) {
      const Database = require('better-sqlite3');
      const CONFIG = require('./config.json');
      const pipelineDbPath = path.resolve(__dirname, CONFIG.email_pipeline.database_path);
      
      try {
        const pipelineDb = new Database(pipelineDbPath, { readonly: true });
        const cutoffTime = new Date();
        cutoffTime.setHours(cutoffTime.getHours() - 24);
        
        const recentEmails = pipelineDb.prepare(`
          SELECT * FROM emails 
          WHERE received_at >= ?
          ORDER BY received_at DESC
        `).all(cutoffTime.toISOString());
        
        pipelineDb.close();
        
        const logged = logFromEmails(recentEmails);
        results.interactions_logged = logged.length;
        console.log(`   ✅ Logged ${logged.length} interactions`);
      } catch (error) {
        console.log(`   ⚠️  Email pipeline database not accessible: ${error.message}`);
        results.errors.push(`interactions: ${error.message}`);
      }
    } else {
      console.log('   [SKIPPED - dry run]');
    }
    
    // Step 3: Process snoozed follow-ups
    console.log('\n⏰ Step 3: Processing snoozed follow-ups...');
    if (!dryRun) {
      const unsnoozed = processSnoozes();
      results.snoozes_processed = unsnoozed;
      console.log(`   ✅ Unsnoozed ${unsnoozed} follow-ups`);
    } else {
      console.log('   [SKIPPED - dry run]');
    }
    
    // Step 4: Recalculate relationship scores
    console.log('\n📊 Step 4: Recalculating relationship scores...');
    if (!dryRun) {
      const scoreResults = recalculateAll();
      results.scores_updated = scoreResults.length;
      const declined = scoreResults.filter(s => s.score < s.previous);
      console.log(`   ✅ Updated ${scoreResults.length} scores (${declined.length} declined)`);
    } else {
      console.log('   [SKIPPED - dry run]');
    }
    
    // Step 5: Generate nudges
    console.log('\n🔔 Step 5: Generating nudges...');
    const nudges = generateNudges();
    results.nudges_generated = nudges.length;
    console.log(`   ✅ Generated ${nudges.length} nudges`);
    
    if (nudges.length > 0) {
      const urgent = nudges.filter(n => n.priority === 'urgent');
      const high = nudges.filter(n => n.priority === 'high');
      console.log(`      ${urgent.length} urgent, ${high.length} high priority`);
    }
    
    // Step 6: Update stale relationship profiles
    console.log('\n🔍 Step 6: Updating stale relationship profiles...');
    if (!dryRun) {
      const profileResults = await updateStale();
      results.profiles_updated = profileResults.filter(r => r.success).length;
      const failed = profileResults.filter(r => !r.success).length;
      console.log(`   ✅ Updated ${results.profiles_updated} profiles${failed > 0 ? ` (${failed} failed)` : ''}`);
    } else {
      console.log('   [SKIPPED - dry run]');
    }
    
  } catch (error) {
    logger.error('crm.sync_failed', { error: error.message, stack: error.stack });
    results.errors.push(error.message);
    console.error(`\n❌ Sync failed: ${error.message}`);
  }
  
  const duration = Date.now() - startTime;
  
  logger.info('crm.sync_completed', { ...results, duration_ms: duration });
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Daily Sync Summary');
  console.log('='.repeat(50));
  console.log(`New contacts:         ${results.new_contacts}`);
  console.log(`Interactions logged:  ${results.interactions_logged}`);
  console.log(`Scores updated:       ${results.scores_updated}`);
  console.log(`Nudges generated:     ${results.nudges_generated}`);
  console.log(`Profiles updated:     ${results.profiles_updated}`);
  console.log(`Snoozes processed:    ${results.snoozes_processed}`);
  console.log(`Duration:             ${Math.round(duration / 1000)}s`);
  
  if (results.errors.length > 0) {
    console.log(`\n⚠️  Errors: ${results.errors.length}`);
    results.errors.forEach(e => console.log(`   • ${e}`));
  }
  
  console.log('='.repeat(50) + '\n');
  
  return results;
}

module.exports = {
  dailySync
};

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--run')) {
    (async () => {
      console.log('🔄 Starting daily CRM sync...\n');
      await dailySync(false);
    })();
  } else if (args.includes('--dry-run')) {
    (async () => {
      await dailySync(true);
    })();
  } else {
    console.log(`Usage:
  --run       Run full daily sync
  --dry-run   Preview what would happen without making changes
    `);
  }
}
