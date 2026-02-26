const fs = require('fs');

// LM Studio local API endpoint
const LM_STUDIO_URL = 'http://127.0.0.1:1234/v1/chat/completions';
const MODEL = 'qwen3:4b';

async function callLLM(prompt) {
  try {
    const response = await fetch(LM_STUDIO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1000
      })
    });
    
    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }
    
    const result = await response.json();
    return result.choices?.[0]?.message?.content || '';
  } catch (err) {
    console.error('LLM error:', err.message);
    return '';
  }
}

function formatContentPerformance(contentData) {
  if (!contentData || !contentData.last7Days || contentData.last7Days.length === 0) {
    return 'No content performance data available yet.';
  }
  
  let output = '';
  
  contentData.last7Days.forEach(row => {
    output += `\n**${row.platform.toUpperCase()} (${row.business === 'anselai' ? 'Photography' : 'R3 Studios'}):**
- Posts: ${row.posts}
- Views: ${row.total_views || 0}
- Engagement Rate: ${(row.avg_engagement || 0).toFixed(1)}%
- Likes: ${row.total_likes || 0}, Comments: ${row.total_comments || 0}`;
  });
  
  return output;
}

function formatTopContent(topContent) {
  if (!topContent || topContent.length === 0) {
    return 'No top content data available.';
  }
  
  return topContent.slice(0, 3).map(post => {
    return `"${post.title}" (${post.platform.toUpperCase()}) - ${post.views} views, ${(post.engagement_rate || 0).toFixed(1)}% engagement`;
  }).join('\n');
}

function formatActiveIdeas(ideas) {
  if (!ideas || ideas.length === 0) {
    return 'No active ideas in pipeline.';
  }
  
  return ideas.slice(0, 5).map(idea => {
    return `**${idea.title}** (${idea.status}) - ${idea.platform} ${idea.business === 'anselai' ? '[Photography]' : '[R3]'}`;
  }).join('\n');
}

function formatTodaysTasks(taskData) {
  if (!taskData) {
    return 'No task data available.';
  }
  
  let output = '';
  
  if (taskData.urgent && taskData.urgent.length > 0) {
    output += 'URGENT:\n';
    taskData.urgent.forEach(t => {
      output += `- ${t.title} (${t.priority})\n`;
    });
  }
  
  if (taskData.highPriority && taskData.highPriority.length > 0) {
    output += '\nHIGH PRIORITY:\n';
    taskData.highPriority.forEach(t => {
      output += `- ${t.title}\n`;
    });
  }
  
  if (taskData.standingOrders && taskData.standingOrders.length > 0) {
    output += '\nSTANDING ORDERS:\n';
    taskData.standingOrders.forEach(t => {
      output += `- ${t.title}\n`;
    });
  }
  
  return output || 'No tasks today.';
}

async function generateBriefingSummary(data) {
  const contentPerfText = formatContentPerformance(data.contentPerformance);
  const topContentText = formatTopContent(data.topContent);
  const ideasText = formatActiveIdeas(data.activeIdeas);
  const tasksText = formatTodaysTasks(data.todaysTasks);
  
  const prompt = `You are a business analyst. Generate a concise daily briefing (under 200 words) for The Reeses photography business and R3 Studios SaaS company.

**Content Performance (Last 7 Days):**
${contentPerfText}

**Top Performing Content:**
${topContentText}

**Active Ideas in Pipeline:**
${ideasText}

**Today's Tasks:**
${tasksText}

Create a brief summary with:
1. **Headline Insight** - One sentence capturing the key takeaway
2. **Performance Highlights** - 2-3 notable wins or trends
3. **Action Items** - 2-3 specific, actionable things to do today
4. **Areas to Watch** - 1-2 things that need attention
5. **Recommendations** - 1 strategic suggestion

Keep it concise, data-driven, and actionable. Focus on what matters TODAY.`;

  return await callLLM(prompt);
}

async function generateDetailedAnalysis(data) {
  const tasksStats = data.taskStats || {};
  const ideasStats = data.ideasStats || {};
  
  const prompt = `Provide a 2-3 paragraph strategic analysis for a photography + SaaS business:

Task Pipeline: ${tasksStats.queued || 0} queued, ${tasksStats.active || 0} active, ${tasksStats.pass_rate || 0}% pass rate
Content Ideas: ${ideasStats.proposed || 0} proposed, ${ideasStats.in_progress || 0} in progress
Content Status: ${ideasStats.draft || 0} drafts, ${ideasStats.pending_approval || 0} pending approval, ${ideasStats.published || 0} published

What's working well? What needs fixing? Where should we focus next?`;

  return await callLLM(prompt);
}

// CLI export
if (require.main === module) {
  (async () => {
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
          { title: 'Review pending content', priority: 'high' }
        ],
        standingOrders: [
          { title: 'Daily stand up', priority: 'medium' }
        ]
      }
    };
    
    console.log('Generating summary...');
    const summary = await generateBriefingSummary(mockData);
    console.log('Summary:');
    console.log(summary);
  })();
}

module.exports = {
  generateBriefingSummary,
  generateDetailedAnalysis,
  formatContentPerformance,
  formatTopContent,
  formatActiveIdeas,
  formatTodaysTasks
};
