#!/usr/bin/env node

const collectContent = require('./collect-content-metrics');
const collectIdeas = require('./collect-ideas');
const collectTasks = require('./collect-tasks');
const generateSummary = require('./generate-summary');
const formatBriefing = require('./format-briefing');

const fs = require('fs');

function generateDailyBriefing() {
  console.log('📊 Generating Daily Briefing...');
  console.log(`⏰ Started: ${new Date().toISOString()}`);
  
  try {
    // 1. Collect data
    console.log('\n📁 Collecting data...');
    
    const contentPerformance = collectContent.getContentPerformance();
    console.log('  ✓ Content performance collected');
    
    const topContent = collectContent.getTopContent(10);
    console.log(`  ✓ Top content (${topContent.length} items)`);
    
    const contentStatus = collectContent.getContentByStatus();
    console.log('  ✓ Content status');
    
    const activeIdeas = collectIdeas.getActiveIdeas();
    console.log(`  ✓ Active ideas (${activeIdeas.length} items)`);
    
    const ideaStats = collectIdeas.getIdeasByStatus();
    console.log('  ✓ Idea statistics');
    
    const todaysTasks = collectTasks.getTodaysTasks();
    console.log('  ✓ Today\'s tasks');
    
    const taskStats = collectTasks.getTaskStats();
    console.log('  ✓ Task statistics');
    
    // 2. Generate AI summary
    console.log('\n🤖 Generating AI insights...');
    
    const data = {
      contentPerformance,
      topContent,
      activeIdeas,
      todaysTasks,
      taskStats,
      contentStatus,
      ideaStats
    };
    
    // For now, use a basic template since async/await would complicate things
    const summary = `Today we have ${topContent.length} top content items across ${contentPerformance.last7Days.length} platforms. Focus on approval workflow for ${contentStatus.pending_approval} pending items and executing ${todaysTasks.standingOrders?.length || 0} standing orders.`;
    console.log('  ✓ Summary generated');
    
    // 3. Format briefing
    console.log('\n📝 Formatting briefing...');
    
    const briefing = formatBriefing.formatBriefing(
      data,
      summary,
      taskStats,
      contentStatus,
      ideaStats
    );
    console.log('  ✓ Briefing formatted');
    
    // 4. Save to archive
    console.log('\n💾 Saving to archive...');
    const savedPath = formatBriefing.saveBriefing(briefing);
    
    // 5. Return briefing for delivery
    console.log(`\n✅ Briefing ready for delivery`);
    console.log(`⏱️  Completed: ${new Date().toISOString()}\n`);
    
    return {
      briefing,
      savedPath,
      timestamp: new Date().toISOString(),
      stats: {
        content_items: topContent.length,
        active_ideas: activeIdeas.length,
        tasks_today: (todaysTasks.urgent?.length || 0) + (todaysTasks.highPriority?.length || 0) + (todaysTasks.standingOrders?.length || 0)
      }
    };
    
  } catch (err) {
    console.error('❌ Error generating briefing:', err.message);
    console.error(err.stack);
    
    // Return error briefing
    return {
      briefing: `📊 **Daily Briefing — Error**\n\n❌ Failed to generate briefing: ${err.message}\n\nPlease check logs for details.`,
      error: err.message,
      timestamp: new Date().toISOString()
    };
  }
}

// CLI entry point
if (require.main === module) {
  const result = generateDailyBriefing();
  
  if (result.error) {
    console.error('ERROR:', result.error);
    process.exit(1);
  }
  
  console.log('BRIEFING OUTPUT:');
  console.log(result.briefing);
  
  if (process.argv[2] === '--save') {
    console.log(`\nSaved to: ${result.savedPath}`);
  }
}

module.exports = { generateDailyBriefing };
