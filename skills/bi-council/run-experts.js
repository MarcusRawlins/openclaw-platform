#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');
const { initCouncilDB } = require('./init-council-db');
const experts = require('./experts');

const COUNCIL_DB = path.join('/Volumes/reeseai-memory/data/bi-council', 'council-history.db');

async function runExperts() {
  console.log('\n' + '━'.repeat(50));
  console.log('  🏛 EXPERT ANALYSIS LAYER (PARALLEL)');
  console.log('━'.repeat(50) + '\n');

  // Ensure council DB exists
  try {
    initCouncilDB();
  } catch (err) {
    // DB already exists, that's fine
  }

  const db = new Database(COUNCIL_DB);
  const sessionId = db.prepare(`
    INSERT INTO council_sessions (session_date, status)
    VALUES (date('now'), 'running')
  `).run().lastInsertRowid;

  console.log(`  Session ID: ${sessionId}`);
  console.log(`  Starting ${Object.keys(experts).length} experts in parallel...\n`);

  // Generate cross-domain brief
  const crossDomainBrief = await generateCrossDomainBrief();

  // Run all experts in parallel
  const expertList = [
    experts.marketAnalyst,
    experts.contentStrategist,
    experts.revenueGuardian,
    experts.operationsAnalyst,
    experts.growthStrategist,
    experts.financialGuardian
  ];

  const startTime = Date.now();

  const analyses = await Promise.all(
    expertList.map(expert =>
      expert.analyze(crossDomainBrief).catch(err => ({
        expert: expert.name,
        error: err.message
      }))
    )
  );

  const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n  ✓ All analyses complete (${elapsedTime}s)\n`);

  // Store analyses and recommendations
  let totalRecommendations = 0;

  for (const analysis of analyses) {
    if (analysis.error) {
      console.log(`  ⚠ ${analysis.expert}: ${analysis.error}`);
      continue;
    }

    try {
      // Store expert analysis
      db.prepare(`
        INSERT INTO expert_analyses (
          session_id, expert_name, analysis_text, risk_level, 
          opportunity_count, recommendation_count
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        sessionId,
        analysis.expert,
        JSON.stringify(analysis.insights),
        analysis.riskLevel,
        analysis.opportunities.length,
        analysis.recommendations.length
      );

      // Store recommendations
      for (const rec of analysis.recommendations) {
        db.prepare(`
          INSERT INTO recommendations (
            session_id, expert_name, recommendation_text, 
            impact_score, urgency_score, combined_rank, rationale, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
        `).run(
          sessionId,
          analysis.expert,
          rec.action,
          rec.impact || 5,
          rec.urgency || 5,
          (rec.impact || 5) * (rec.urgency || 5),
          rec.rationale
        );
        totalRecommendations++;
      }
    } catch (err) {
      console.error(`  ✗ Failed to store ${analysis.expert} analysis: ${err.message}`);
    }
  }

  // Update session status
  db.prepare(`
    UPDATE council_sessions
    SET status = 'complete', duration_seconds = ?
    WHERE id = ?
  `).run(Math.floor(elapsedTime), sessionId);

  console.log('  Summary:');
  const analysisCount = analyses.filter(a => !a.error).length;
  console.log(`    ✓ ${analysisCount} experts completed`);
  console.log(`    ✓ ${totalRecommendations} recommendations generated`);

  db.close();

  return { sessionId, analysisCount, totalRecommendations };
}

async function generateCrossDomainBrief() {
  // Generate a concise summary of business state from all data sources
  const MissionControlSync = require('./sync-mission-control');
  const CRMSync = require('./sync-crm');

  const mcSync = new MissionControlSync();
  const crmSync = new CRMSync();

  const tasks = mcSync.getTaskStats(7);
  const pipeline = crmSync.getPipelineStats(30);

  mcSync.close();
  crmSync.close();

  return `
Wedding Photography Business State:
- Tasks completed this week: ${tasks.completed}
- Tasks in progress: ${tasks.active}
- Total active tasks: ${tasks.totalTasks}
- New inquiries (30d): ${pipeline.new_inquiries}
- New bookings (30d): ${pipeline.new_bookings}
- Conversion rate: ${pipeline.conversion_rate}%

Strategic Context: The business is actively managing client relationships and content delivery. Focus is on improving pipeline conversion and team productivity.
  `;
}

// CLI entry point
if (require.main === module) {
  runExperts()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('\n✗ Expert analysis failed:', err);
      process.exit(1);
    });
}

module.exports = { runExperts };
