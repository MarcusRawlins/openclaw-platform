const { execSync } = require('child_process');

const DB_PATH = '/Volumes/reeseai-memory/data/content-pipeline/ideas.db';

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

function getActiveIdeas() {
  const ideas = runQuery(`
    SELECT 
      id,
      title,
      status,
      platform,
      content_type,
      suggested_outline,
      kb_sources,
      suggested_at
    FROM content_ideas
    WHERE status IN ('proposed', 'accepted', 'in_progress')
    ORDER BY suggested_at DESC
    LIMIT 15
  `);
  
  return (ideas || []).map(idea => ({
    ...idea,
    business: 'r3studios' // Default to R3 Studios, can be enhanced with platform detection
  }));
}

function getIdeasByStatus() {
  const stats = runQuery(`
    SELECT 
      status,
      COUNT(*) as count
    FROM content_ideas
    GROUP BY status
  `);
  
  const result = {
    proposed: 0,
    accepted: 0,
    in_progress: 0,
    produced: 0,
    duplicate: 0
  };
  
  (stats || []).forEach(row => {
    if (result.hasOwnProperty(row.status)) {
      result[row.status] = row.count;
    }
  });
  
  return result;
}

function getRecentIdeas(days = 7) {
  const ideas = runQuery(`
    SELECT 
      id,
      title,
      status,
      platform,
      suggested_at
    FROM content_ideas
    WHERE suggested_at >= datetime('now', '-${days} days')
    ORDER BY suggested_at DESC
  `);
  
  return (ideas || []).map(idea => ({
    ...idea,
    business: 'r3studios'
  }));
}

// CLI export
if (require.main === module) {
  console.log('Active ideas:');
  console.log(JSON.stringify(getActiveIdeas(), null, 2));
  
  console.log('\nIdeas by status:');
  console.log(JSON.stringify(getIdeasByStatus(), null, 2));
  
  console.log('\nRecent ideas (7 days):');
  console.log(JSON.stringify(getRecentIdeas(), null, 2));
}

module.exports = {
  getActiveIdeas,
  getIdeasByStatus,
  getRecentIdeas
};
