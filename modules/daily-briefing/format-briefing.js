const fs = require('fs');

function formatDate(date = new Date()) {
  return date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric'
  });
}

function formatBriefing(data, summary, taskStats, contentStatus, ideaStats) {
  const date = formatDate();
  
  // Parse summary sections if it's a string
  let summaryObj = {
    headline: summary,
    highlights: [],
    actionItems: [],
    areasToWatch: [],
    recommendations: []
  };
  
  if (typeof summary === 'string') {
    // Try to extract sections from generated summary
    const lines = summary.split('\n');
    let currentSection = null;
    
    lines.forEach(line => {
      if (line.includes('Headline')) currentSection = 'headline';
      else if (line.includes('Highlight') || line.includes('wins')) currentSection = 'highlights';
      else if (line.includes('Action Item')) currentSection = 'actionItems';
      else if (line.includes('Watch') || line.includes('attention')) currentSection = 'areasToWatch';
      else if (line.includes('Recommendation')) currentSection = 'recommendations';
      else if (line.trim() && currentSection) {
        if (currentSection === 'headline' && !summaryObj.headline.includes(line)) {
          summaryObj.headline = line.replace(/^[#*\-\s]+/, '').trim();
        } else if (line.startsWith('-') || line.startsWith('•')) {
          summaryObj[currentSection].push(line.replace(/^[-•\s]+/, '').trim());
        }
      }
    });
  }
  
  // Format content performance
  let contentPerf = '';
  if (data.contentPerformance && data.contentPerformance.last7Days.length > 0) {
    const perfData = data.contentPerformance.last7Days;
    contentPerf = perfData.map(row => {
      const business = row.business === 'anselai' ? '📷 Photography' : '💼 R3 Studios';
      return `**${business} - ${row.platform.toUpperCase()}:** ${row.posts} posts | ${row.total_views || 0} views | ${(row.avg_engagement || 0).toFixed(1)}% engagement`;
    }).join('\n');
  }
  
  // Format top content
  let topContent = '';
  if (data.topContent && data.topContent.length > 0) {
    topContent = data.topContent.slice(0, 2).map(post => {
      return `**"${post.title}"** (${post.platform.toUpperCase()})
📊 ${post.views} views | 👍 ${post.likes} likes | 💬 ${post.comments} comments | ${(post.engagement_rate || 0).toFixed(1)}% engagement`;
    }).join('\n\n');
  }
  
  // Format active ideas
  let ideas = '';
  if (data.activeIdeas && data.activeIdeas.length > 0) {
    ideas = data.activeIdeas.slice(0, 4).map(idea => {
      const business = idea.business === 'anselai' ? '[📷]' : '[💼]';
      return `• **${idea.title}** ${business} — ${idea.status.replace('_', ' ')} (${idea.platform})`;
    }).join('\n');
  }
  
  // Format tasks
  let tasksSection = '';
  if (data.todaysTasks) {
    const tasks = data.todaysTasks;
    if (tasks.urgent && tasks.urgent.length > 0) {
      tasksSection += '**🚨 URGENT:**\n' + 
        tasks.urgent.map(t => `• ${t.title}`).join('\n') + '\n\n';
    }
    
    if (tasks.highPriority && tasks.highPriority.length > 0) {
      tasksSection += '**⚡ HIGH PRIORITY:**\n' +
        tasks.highPriority.map(t => `• ${t.title}`).join('\n') + '\n\n';
    }
    
    if (tasks.standingOrders && tasks.standingOrders.length > 0) {
      tasksSection += '**📋 STANDING ORDERS:**\n' +
        tasks.standingOrders.map(t => `• ${t.title}`).join('\n');
    }
  }
  
  // Build briefing
  const briefing = `📊 **Daily Briefing — ${date}**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 📌 ${summaryObj.headline || 'Good Morning'}

${contentPerf ? `
## 📈 Last 7 Days Performance

${contentPerf}
` : ''}

${topContent ? `
## ⭐ Top Performers

${topContent}
` : ''}

${ideas ? `
## 💡 Content Ideas in Pipeline (${data.activeIdeas?.length || 0} active)

${ideas}

${data.activeIdeas?.length > 4 ? `_+ ${data.activeIdeas.length - 4} more in progress_` : ''}
` : ''}

${tasksSection ? `
## 📋 Today's Tasks

${tasksSection}
` : ''}

${summaryObj.actionItems && summaryObj.actionItems.length > 0 ? `
## ✅ ACTION ITEMS (Do These Today)

${summaryObj.actionItems.map(item => `• ${item}`).join('\n')}
` : ''}

${summaryObj.highlights && summaryObj.highlights.length > 0 ? `
## 🎯 Performance Highlights

${summaryObj.highlights.map(h => `• ${h}`).join('\n')}
` : ''}

${summaryObj.areasToWatch && summaryObj.areasToWatch.length > 0 ? `
## ⚠️ Areas to Watch

${summaryObj.areasToWatch.map(item => `• ${item}`).join('\n')}
` : ''}

${summaryObj.recommendations && summaryObj.recommendations.length > 0 ? `
## 💪 Strategic Recommendations

${summaryObj.recommendations.map(item => `• ${item}`).join('\n')}
` : ''}

## 📊 System Status

${taskStats ? `• Tasks: ${taskStats.queued} queued | ${taskStats.active} active | ${taskStats.done} done (${taskStats.pass_rate}% pass rate)` : ''}
${contentStatus ? `• Content: ${contentStatus.draft || 0} drafts | ${contentStatus.pending_approval || 0} pending approval | ${contentStatus.published || 0} published` : ''}
${ideaStats ? `• Ideas: ${ideaStats.proposed || 0} proposed | ${ideaStats.in_progress || 0} in progress | ${ideaStats.produced || 0} produced` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

_📊 View full metrics: Mission Control → AnselAI_
_🎯 Feedback: Reply with suggestions to improve briefing_`;

  return briefing;
}

// Archive briefing
function saveBriefing(briefing) {
  const archivePath = '/Volumes/reeseai-memory/briefings';
  
  if (!fs.existsSync(archivePath)) {
    fs.mkdirSync(archivePath, { recursive: true });
  }
  
  const date = new Date().toISOString().split('T')[0];
  const filename = `${date}-briefing.md`;
  const filePath = `${archivePath}/${filename}`;
  
  fs.writeFileSync(filePath, briefing);
  console.log(`✓ Briefing saved: ${filePath}`);
  
  return filePath;
}

// CLI export
if (require.main === module) {
  const mockData = {
    contentPerformance: {
      last7Days: [
        {
          platform: 'instagram',
          business: 'anselai',
          posts: 3,
          total_views: 2400,
          total_likes: 180,
          total_comments: 24,
          total_shares: 12,
          avg_engagement: 8.5
        }
      ]
    },
    topContent: [
      {
        title: 'Wedding Timeline Guide',
        platform: 'instagram',
        views: 1200,
        likes: 95,
        comments: 12,
        shares: 8,
        engagement_rate: 9.5
      }
    ],
    activeIdeas: [
      {
        title: 'Engagement Photo Tips',
        status: 'in_progress',
        platform: 'tiktok',
        business: 'anselai'
      }
    ],
    todaysTasks: {
      urgent: [],
      highPriority: [
        { title: 'Review pending content' }
      ],
      standingOrders: [
        { title: 'Daily stand up' }
      ]
    }
  };
  
  const briefing = formatBriefing(
    mockData,
    'Great engagement on Instagram this week. Focus on carousel posts.',
    { queued: 3, active: 1, done: 12, pass_rate: '95%' },
    { draft: 5, pending_approval: 2, published: 8 },
    { proposed: 2, in_progress: 3, produced: 12 }
  );
  
  console.log(briefing);
  saveBriefing(briefing);
}

module.exports = {
  formatBriefing,
  saveBriefing,
  formatDate
};
