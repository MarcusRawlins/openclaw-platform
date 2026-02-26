const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DB_PATH = '/Volumes/reeseai-memory/data/databases/anselai.db';

// Execute SQLite query via CLI
function runQuery(query) {
  try {
    const result = execSync(`sqlite3 "${DB_PATH}" ".mode json" "${query.replace(/"/g, '\\"')}"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return result.trim() ? JSON.parse(result) : [];
  } catch (err) {
    console.error('Database error:', err.message);
    return [];
  }
}

function getContentPerformance() {
  // Last 7 days
  const last7Days = runQuery(`
    SELECT 
      platform,
      business,
      COUNT(*) as posts,
      SUM(views) as total_views,
      SUM(likes) as total_likes,
      SUM(comments) as total_comments,
      SUM(shares) as total_shares,
      AVG(engagement_rate) as avg_engagement
    FROM content_catalog
    WHERE snapshot_date >= date('now', '-7 days')
    GROUP BY platform, business
    ORDER BY business, total_views DESC
  `);
  
  // Last 30 days
  const last30Days = runQuery(`
    SELECT 
      platform,
      business,
      COUNT(*) as posts,
      SUM(views) as total_views,
      SUM(likes) as total_likes,
      SUM(comments) as total_comments,
      SUM(shares) as total_shares,
      AVG(engagement_rate) as avg_engagement
    FROM content_catalog
    WHERE snapshot_date >= date('now', '-30 days')
    GROUP BY platform, business
    ORDER BY business, total_views DESC
  `);
  
  return {
    last7Days: last7Days || [],
    last30Days: last30Days || []
  };
}

function getTopContent(limit = 10) {
  // Get top performing content from last 90 days
  const topContent = runQuery(`
    SELECT 
      c.id,
      c.title,
      c.platform,
      c.business,
      c.published_at,
      cat.views,
      cat.engagement_rate,
      cat.likes,
      cat.comments,
      cat.shares
    FROM content c
    JOIN content_catalog cat ON c.id = cat.content_id
    WHERE cat.snapshot_date >= date('now', '-90 days')
      AND cat.views > 0
    GROUP BY c.id
    ORDER BY cat.engagement_rate DESC, cat.views DESC
    LIMIT ${limit}
  `);
  
  return topContent || [];
}

async function getSocialGrowth() {
  // Parse content indexes to get platform growth data
  const anselaiPath = '/Volumes/reeseai-memory/photography/content/content-index.json';
  const r3Path = '/Volumes/reeseai-memory/r3-studios/content/content-index.json';
  
  const growth = {};
  
  try {
    if (fs.existsSync(anselaiPath)) {
      const anselaiContent = JSON.parse(fs.readFileSync(anselaiPath, 'utf8'));
      const platforms = new Set(anselaiContent.map(c => c.platform));
      
      platforms.forEach(p => {
        const count = anselaiContent.filter(c => c.platform === p).length;
        if (!growth[p]) growth[p] = { anselai: 0, r3studios: 0 };
        growth[p].anselai = count;
      });
    }
    
    if (fs.existsSync(r3Path)) {
      const r3Content = JSON.parse(fs.readFileSync(r3Path, 'utf8'));
      const platforms = new Set(r3Content.map(c => c.platform));
      
      platforms.forEach(p => {
        const count = r3Content.filter(c => c.platform === p).length;
        if (!growth[p]) growth[p] = { anselai: 0, r3studios: 0 };
        growth[p].r3studios = count;
      });
    }
  } catch (err) {
    console.error('Error parsing content indexes:', err.message);
  }
  
  return growth;
}

async function getContentByStatus() {
  // Aggregate content status from content indexes
  const anselaiPath = '/Volumes/reeseai-memory/photography/content/content-index.json';
  const r3Path = '/Volumes/reeseai-memory/r3-studios/content/content-index.json';
  
  const status = {
    draft: 0,
    pending_approval: 0,
    approved: 0,
    published: 0
  };
  
  try {
    if (fs.existsSync(anselaiPath)) {
      const content = JSON.parse(fs.readFileSync(anselaiPath, 'utf8'));
      content.forEach(c => {
        if (c.status === 'draft') status.draft++;
        else if (c.approvalStatus === 'pending' || c.status === 'needs-revision') status.pending_approval++;
        else if (c.approvalStatus === 'approved' && !c.publishedDate) status.approved++;
        else if (c.publishedDate) status.published++;
      });
    }
    
    if (fs.existsSync(r3Path)) {
      const content = JSON.parse(fs.readFileSync(r3Path, 'utf8'));
      content.forEach(c => {
        if (c.status === 'draft') status.draft++;
        else if (c.status === 'pending-approval') status.pending_approval++;
        else if (c.status === 'approved' && !c.publishedDate) status.approved++;
        else if (c.publishedDate) status.published++;
      });
    }
  } catch (err) {
    console.error('Error parsing content status:', err.message);
  }
  
  return status;
}

// CLI export
if (require.main === module) {
  (async () => {
    try {
      console.log('Collecting content performance...');
      const perf = await getContentPerformance();
      console.log('Performance:', JSON.stringify(perf, null, 2));
      
      console.log('\nTop content:');
      const top = await getTopContent(5);
      console.log(JSON.stringify(top, null, 2));
      
      console.log('\nSocial growth:');
      const social = await getSocialGrowth();
      console.log(JSON.stringify(social, null, 2));
      
      console.log('\nContent status:');
      const contentStatus = await getContentByStatus();
      console.log(JSON.stringify(contentStatus, null, 2));
    } catch (err) {
      console.error('Error:', err);
      process.exit(1);
    }
  })();
}

module.exports = {
  getContentPerformance,
  getTopContent,
  getSocialGrowth,
  getContentByStatus
};
