#!/usr/bin/env node

function formatDigest(synthesis) {
  const {
    executiveSummary,
    keyMetrics,
    riskAlerts,
    crossDomainInsights,
    topRecommendations,
    sessionId
  } = synthesis;

  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const healthEmoji = {
    excellent: '🟢',
    good: '🟢',
    fair: '🟡',
    concerning: '🟠',
    critical: '🔴'
  }[keyMetrics?.overallHealth] || '❓';

  const trendEmoji = {
    growth: '📈',
    stability: '➡️',
    decline: '📉',
    uncertain: '❓'
  }[keyMetrics?.primaryTrend] || '❓';

  let digest = `🏛 **Business Intelligence Council — ${date}**

${healthEmoji} **Business Health:** ${(keyMetrics?.overallHealth || 'unknown').toUpperCase()} ${trendEmoji} ${keyMetrics?.primaryTrend ? keyMetrics.primaryTrend : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 📋 Executive Summary

${executiveSummary}

`;

  if (riskAlerts && riskAlerts.length > 0) {
    digest += `## ⚠️ Risk Alerts

${riskAlerts.map(r => `• **[${r.severity.toUpperCase()}]** ${r.source}: ${r.issue}`).join('\n')}

`;
  }

  if (crossDomainInsights && crossDomainInsights.length > 0) {
    digest += `## 🔍 Cross-Domain Insights

${crossDomainInsights.map(i => `• ${i}`).join('\n')}

`;
  }

  if (topRecommendations && topRecommendations.length > 0) {
    digest += `## 💡 Top Recommendations

`;
    topRecommendations.forEach((r, i) => {
      const impactBar = '█'.repeat(Math.ceil(r.impact_score / 2)) + '░'.repeat(5 - Math.ceil(r.impact_score / 2));
      const urgencyBar = '█'.repeat(Math.ceil(r.urgency_score / 2)) + '░'.repeat(5 - Math.ceil(r.urgency_score / 2));

      digest += `
**${i + 1}. ${r.recommendation_text}**
   📊 Impact: [${impactBar}] ${r.impact_score}/10 | ⏱ Urgency: [${urgencyBar}] ${r.urgency_score}/10
   🎯 ${r.rationale}
   _— ${r.expert_name}_
`;
    });
  }

  digest += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Deep Dive:** Use \`council explore ${sessionId}\` for full analysis details.
**Feedback:** Accept with \`council accept <rec-id>\`, reject with \`council reject <rec-id> <reason>\`

_Session: ${sessionId}_`;

  return digest;
}

module.exports = { formatDigest };
