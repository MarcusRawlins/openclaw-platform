#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');
const COUNCIL_DB = path.join('/Volumes/reeseai-memory/data/bi-council', 'council-history.db');

const db = new Database(COUNCIL_DB);
const command = process.argv[2];
const arg1 = process.argv[3];
const arg2 = process.argv.slice(4).join(' ');

switch (command) {
  case 'explore':
    exploreSession(arg1);
    break;
  case 'accept':
    acceptRecommendation(arg1);
    break;
  case 'reject':
    rejectRecommendation(arg1, arg2);
    break;
  case 'history':
    showHistory(arg1 || 7);
    break;
  case 'status':
    showStatus();
    break;
  default:
    showHelp();
}

function exploreSession(sessionId) {
  if (!sessionId) {
    console.error('❌ Usage: council explore <session-id>');
    process.exit(1);
  }

  const session = db.prepare('SELECT * FROM council_sessions WHERE id = ?').get(sessionId);
  if (!session) {
    console.error(`❌ Session ${sessionId} not found`);
    process.exit(1);
  }

  console.log(`\n${'━'.repeat(60)}`);
  console.log(`  COUNCIL SESSION ${sessionId} — ${session.session_date}`);
  console.log(`${'━'.repeat(60)}\n`);

  // Synthesis
  const synthesis = db.prepare('SELECT * FROM synthesis WHERE session_id = ?').get(sessionId);
  if (synthesis) {
    console.log('📋 EXECUTIVE SUMMARY\n');
    console.log(synthesis.executive_summary);
    console.log();

    if (synthesis.key_metrics) {
      console.log('📊 KEY METRICS\n');
      const metrics = JSON.parse(synthesis.key_metrics);
      console.log(`  Overall Health: ${metrics.overallHealth}`);
      console.log(`  Primary Trend: ${metrics.primaryTrend}`);
      console.log(`  Urgent Issues: ${metrics.urgentIssues || 0}\n`);
    }

    if (synthesis.risk_alerts) {
      const alerts = JSON.parse(synthesis.risk_alerts);
      if (alerts.length > 0) {
        console.log('⚠️ RISK ALERTS\n');
        alerts.forEach(a => {
          console.log(`  [${a.severity.toUpperCase()}] ${a.source}`);
          console.log(`    ${a.issue}\n`);
        });
      }
    }

    if (synthesis.cross_domain_insights) {
      const insights = JSON.parse(synthesis.cross_domain_insights);
      if (insights.length > 0) {
        console.log('🔍 CROSS-DOMAIN INSIGHTS\n');
        insights.forEach(i => console.log(`  • ${i}`));
        console.log();
      }
    }
  }

  // Expert Analyses
  console.log('🤖 EXPERT ANALYSES\n');
  const analyses = db.prepare('SELECT * FROM expert_analyses WHERE session_id = ? ORDER BY expert_name').all(sessionId);
  for (const analysis of analyses) {
    console.log(`  ${analysis.expert_name}`);
    console.log(`    Risk Level: ${analysis.risk_level}`);
    console.log(`    Opportunities: ${analysis.opportunity_count}`);
    console.log(`    Recommendations: ${analysis.recommendation_count}`);

    const insights = JSON.parse(analysis.analysis_text);
    if (Array.isArray(insights) && insights.length > 0) {
      console.log(`    Insights:`);
      insights.forEach(i => console.log(`      • ${i}`));
    }
    console.log();
  }

  // All Recommendations
  console.log('💡 ALL RECOMMENDATIONS\n');
  const recs = db.prepare(`
    SELECT * FROM recommendations
    WHERE session_id = ?
    ORDER BY combined_rank DESC
  `).all(sessionId);

  for (const rec of recs) {
    const statusIcon = rec.status === 'accepted' ? '✓' : rec.status === 'rejected' ? '✗' : '○';
    console.log(`  [${rec.id}] ${statusIcon} ${rec.recommendation_text}`);
    console.log(`      Impact: ${rec.impact_score}/10 | Urgency: ${rec.urgency_score}/10 | Rank: ${rec.combined_rank}`);
    console.log(`      From: ${rec.expert_name}`);
    console.log(`      Rationale: ${rec.rationale}`);
    if (rec.status !== 'pending') {
      console.log(`      Status: ${rec.status}`);
      if (rec.feedback_notes) {
        console.log(`      Feedback: ${rec.feedback_notes}`);
      }
    }
    console.log();
  }

  console.log(`${'━'.repeat(60)}\n`);
  console.log(`Commands:`);
  console.log(`  council accept ${recs[0]?.id} — accept a recommendation`);
  console.log(`  council reject ${recs[0]?.id} "reason" — reject with reason\n`);
}

function acceptRecommendation(recId) {
  if (!recId) {
    console.error('❌ Usage: council accept <recommendation-id>');
    process.exit(1);
  }

  const rec = db.prepare('SELECT * FROM recommendations WHERE id = ?').get(recId);
  if (!rec) {
    console.error(`❌ Recommendation ${recId} not found`);
    process.exit(1);
  }

  db.prepare(`
    UPDATE recommendations
    SET status = 'accepted', feedback_at = datetime('now')
    WHERE id = ?
  `).run(recId);

  console.log(`\n✓ Recommendation ${recId} ACCEPTED\n`);
  console.log(`"${rec.recommendation_text}"\n`);
  console.log(`From: ${rec.expert_name}`);
  console.log(`Impact: ${rec.impact_score}/10 | Urgency: ${rec.urgency_score}/10\n`);
  console.log(`Next step: Schedule execution of this recommendation.\n`);
}

function rejectRecommendation(recId, reason) {
  if (!recId) {
    console.error('❌ Usage: council reject <recommendation-id> <reason>');
    process.exit(1);
  }

  const rec = db.prepare('SELECT * FROM recommendations WHERE id = ?').get(recId);
  if (!rec) {
    console.error(`❌ Recommendation ${recId} not found`);
    process.exit(1);
  }

  const feedback = reason || 'No reason provided';

  db.prepare(`
    UPDATE recommendations
    SET status = 'rejected', feedback_at = datetime('now'), feedback_notes = ?
    WHERE id = ?
  `).run(feedback, recId);

  console.log(`\n✗ Recommendation ${recId} REJECTED\n`);
  console.log(`"${rec.recommendation_text}"\n`);
  console.log(`From: ${rec.expert_name}`);
  console.log(`Reason: ${feedback}\n`);
}

function showHistory(days) {
  const dayCount = parseInt(days) || 7;
  const since = new Date(Date.now() - dayCount * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const sessions = db.prepare(`
    SELECT * FROM council_sessions
    WHERE session_date >= ?
    ORDER BY session_date DESC
  `).all(since);

  console.log(`\n${'━'.repeat(60)}`);
  console.log(`  COUNCIL HISTORY (Last ${dayCount} days)`);
  console.log(`${'━'.repeat(60)}\n`);

  for (const session of sessions) {
    const recCount = db.prepare('SELECT COUNT(*) as count FROM recommendations WHERE session_id = ?').get(session.id).count;
    const acceptedCount = db.prepare('SELECT COUNT(*) as count FROM recommendations WHERE session_id = ? AND status = "accepted"').get(session.id).count;
    const rejectedCount = db.prepare('SELECT COUNT(*) as count FROM recommendations WHERE session_id = ? AND status = "rejected"').get(session.id).count;

    console.log(`  [${session.id}] ${session.session_date}`);
    console.log(`    Status: ${session.status}`);
    console.log(`    Recommendations: ${recCount} (${acceptedCount} accepted, ${rejectedCount} rejected)`);
    if (session.duration_seconds) {
      console.log(`    Duration: ${session.duration_seconds}s`);
    }
    console.log();
  }

  console.log(`${'━'.repeat(60)}`);
  console.log(`\nExplore details: council explore <session-id>\n`);
}

function showStatus() {
  console.log(`\n${'━'.repeat(60)}`);
  console.log('  BUSINESS INTELLIGENCE COUNCIL STATUS');
  console.log(`${'━'.repeat(60)}\n`);

  const lastSession = db.prepare(`
    SELECT * FROM council_sessions
    ORDER BY session_date DESC
    LIMIT 1
  `).get();

  if (!lastSession) {
    console.log('  No council sessions yet.\n');
    console.log(`  First run: run-council.js\n`);
    return;
  }

  console.log(`  Last Session: ${lastSession.session_date}`);
  console.log(`  Status: ${lastSession.status}`);
  if (lastSession.duration_seconds) {
    console.log(`  Duration: ${lastSession.duration_seconds}s`);
  }

  const recCount = db.prepare('SELECT COUNT(*) as count FROM recommendations WHERE session_id = ?').get(lastSession.id).count;
  const acceptedCount = db.prepare('SELECT COUNT(*) as count FROM recommendations WHERE session_id = ? AND status = "accepted"').get(lastSession.id).count;
  const rejectedCount = db.prepare('SELECT COUNT(*) as count FROM recommendations WHERE session_id = ? AND status = "rejected"').get(lastSession.id).count;
  const pendingCount = db.prepare('SELECT COUNT(*) as count FROM recommendations WHERE session_id = ? AND status = "pending"').get(lastSession.id).count;

  console.log(`\n  Recommendations: ${recCount}`);
  console.log(`    ✓ Accepted: ${acceptedCount}`);
  console.log(`    ✗ Rejected: ${rejectedCount}`);
  console.log(`    ○ Pending: ${pendingCount}`);

  // Show acceptance rate trend
  const allSessions = db.prepare(`
    SELECT COUNT(*) as total_recommended,
           SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as total_accepted
    FROM recommendations
  `).get();

  if (allSessions.total_recommended > 0) {
    const acceptanceRate = ((allSessions.total_accepted / allSessions.total_recommended) * 100).toFixed(1);
    console.log(`\n  Overall Acceptance Rate: ${acceptanceRate}% (${allSessions.total_accepted}/${allSessions.total_recommended})`);
  }

  console.log(`\n${'━'.repeat(60)}`);
  console.log(`\nUsage:`);
  console.log(`  council explore ${lastSession.id}       — view full session details`);
  console.log(`  council history 7                   — show last 7 days`);
  console.log(`  council accept <rec-id>              — accept a recommendation`);
  console.log(`  council reject <rec-id> <reason>    — reject with reason\n`);
}

function showHelp() {
  console.log(`
🏛 Business Intelligence Council CLI

Usage:
  council explore <session-id>                 Deep dive into a session
  council accept <recommendation-id>           Accept a recommendation
  council reject <recommendation-id> <reason>  Reject with reason
  council history [days]                       Show session history (default: 7)
  council status                               Show current status

Examples:
  council explore 42
  council accept 128
  council reject 129 "Not a priority right now"
  council history 14
  council status

Main commands:
  node run-council.js                          Run full council (sync → analyze → synthesize)
  node sync-all.js                             Sync data sources only
  node run-experts.js                          Run expert analysis only
  `);
}

db.close();
