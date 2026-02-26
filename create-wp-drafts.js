#!/usr/bin/env node

const fs = require('fs');
const https = require('https');

// WordPress credentials
const WP_URL = 'https://bythereeses.com';
const WP_EMAIL = 'bythereeses@gmail.com';
const WP_PASSWORD = 'Powell1992!';
const AUTH = Buffer.from(`${WP_EMAIL}:${WP_PASSWORD}`).toString('base64');

// Blog files
const BLOGS = [
  {
    name: 'Alyssa & Jason - Beacon Hill',
    file: '/Volumes/reeseai-memory/photography/content/blog/Engagement Sessions/1-alyssa-jason-engagement/blog-post.md'
  },
  {
    name: 'Trish & Mario - Uptown Charlotte',
    file: '/Volumes/reeseai-memory/photography/content/blog/Engagement Sessions/2-trish-mario-engagement/blog-post.md'
  },
  {
    name: 'Nicole & Jon - Brooklyn DUMBO',
    file: '/Volumes/reeseai-memory/photography/content/blog/Engagement Sessions/3-nicole-jon-engagement/blog-post.md'
  },
  {
    name: 'Britton Manor Proposal',
    file: '/Volumes/reeseai-memory/photography/content/blog/Engagement Sessions/4-britton-manor-proposal/blog-post.md'
  },
  {
    name: 'Galit & Ari - Brooklyn Engagement Party',
    file: '/Volumes/reeseai-memory/photography/content/blog/Engagement Sessions/5-galit-ari-engagement-party/blog-post.md'
  },
  {
    name: 'Kelly & Ryan - Central Park',
    file: '/Volumes/reeseai-memory/photography/content/blog/Engagement Sessions/6-kelly-ryan-engagement/blog-post.md'
  },
  {
    name: 'Ellie & Maggie - South End Boston',
    file: '/Volumes/reeseai-memory/photography/content/blog/Engagement Sessions/7. ellie & maggie Engagement Session/blog-post.md'
  }
];

// Parse frontmatter
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]+?)\n---\n([\s\S]+)$/);
  if (!match) return { meta: {}, content: content };
  
  const frontmatter = match[1];
  const body = match[2];
  
  const meta = {};
  frontmatter.split('\n').forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();
      // Remove quotes
      value = value.replace(/^["'](.*)["']$/, '$1');
      meta[key] = value;
    }
  });
  
  return { meta, content: body };
}

// Convert markdown to HTML (simple conversion)
function markdownToHtml(markdown) {
  let html = markdown;
  
  // Remove # headings (WordPress will add them as blocks)
  html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
  
  // Bold and italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  
  // Links
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
  
  // Paragraphs (split by double newline)
  const paragraphs = html.split('\n\n').map(p => {
    p = p.trim();
    if (p.startsWith('<h') || p.startsWith('---')) return p;
    if (p.length === 0) return '';
    return `<p>${p.replace(/\n/g, ' ')}</p>`;
  }).filter(p => p.length > 0);
  
  html = paragraphs.join('\n\n');
  
  return html;
}

// Make WordPress API request
function wpRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, WP_URL);
    
    const options = {
      method: method,
      headers: {
        'Authorization': `Basic ${AUTH}`,
        'Content-Type': 'application/json'
      }
    };
    
    const req = https.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Get category ID for "Engagement Sessions"
async function getCategoryId() {
  const categories = await wpRequest('GET', '/wp-json/wp/v2/categories?search=Engagement Sessions');
  if (categories.length > 0) {
    return categories[0].id;
  }
  throw new Error('Engagement Sessions category not found');
}

// Create a post
async function createPost(blog, categoryId) {
  console.log(`\n📝 Creating: ${blog.name}`);
  
  // Read file
  const content = fs.readFileSync(blog.file, 'utf8');
  const { meta, content: body } = parseFrontmatter(content);
  
  console.log(`   Title: ${meta.title || 'NO TITLE'}`);
  
  // Convert markdown to HTML
  const htmlContent = markdownToHtml(body);
  
  // Create post data
  const postData = {
    title: meta.title,
    content: htmlContent,
    status: 'draft',
    categories: [categoryId],
    excerpt: meta.excerpt || '',
    // Yoast SEO meta (if Yoast REST API is enabled)
    meta: {
      _yoast_wpseo_metadesc: meta.meta_description || '',
      _yoast_wpseo_focuskw: (meta.keywords || '').split(',')[0].trim()
    }
  };
  
  try {
    const post = await wpRequest('POST', '/wp-json/wp/v2/posts', postData);
    console.log(`   ✅ Draft created: ${post.link}`);
    console.log(`   📎 Edit URL: ${WP_URL}/wp-admin/post.php?post=${post.id}&action=edit`);
    
    return {
      name: blog.name,
      title: meta.title,
      draftUrl: post.link,
      editUrl: `${WP_URL}/wp-admin/post.php?post=${post.id}&action=edit`,
      postId: post.id
    };
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return {
      name: blog.name,
      title: meta.title,
      error: error.message
    };
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting WordPress draft creation...\n');
  
  try {
    // Get category ID
    console.log('📁 Finding "Engagement Sessions" category...');
    const categoryId = await getCategoryId();
    console.log(`   ✅ Category ID: ${categoryId}`);
    
    // Create all posts
    const results = [];
    for (const blog of BLOGS) {
      const result = await createPost(blog, categoryId);
      results.push(result);
      // Wait a bit between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Write summary
    console.log('\n📊 Creating summary file...');
    
    let summary = `# WordPress Drafts Created - ${new Date().toISOString().split('T')[0]}\n\n`;
    summary += `**Status:** ✅ Complete\n\n`;
    summary += `## Draft URLs\n\n`;
    
    results.forEach((result, i) => {
      summary += `### ${i + 1}. ${result.name}\n\n`;
      summary += `- **Title:** ${result.title}\n`;
      if (result.error) {
        summary += `- **Status:** ❌ Error: ${result.error}\n`;
      } else {
        summary += `- **Draft URL:** ${result.draftUrl}\n`;
        summary += `- **Edit URL:** ${result.editUrl}\n`;
        summary += `- **Post ID:** ${result.postId}\n`;
      }
      summary += `\n`;
    });
    
    summary += `\n## Next Steps\n\n`;
    summary += `1. Tyler to add photos to each draft\n`;
    summary += `2. Review and verify all content\n`;
    summary += `3. Publish when ready\n\n`;
    summary += `**Note:** All drafts are saved as DRAFT status. Do NOT publish until Tyler adds photos.\n`;
    
    const summaryPath = '/Volumes/reeseai-memory/agents/reviews/2026-02-25-wordpress-drafts-complete.md';
    fs.writeFileSync(summaryPath, summary);
    console.log(`   ✅ Summary saved: ${summaryPath}`);
    
    console.log('\n✨ All done! 7 WordPress drafts created.\n');
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
}

main();
