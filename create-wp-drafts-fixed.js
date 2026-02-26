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
    name: 'Kelly & Ryan - Central Park',
    file: '/Volumes/reeseai-memory/photography/content/blog/Engagement Sessions/6-kelly-ryan-engagement/blog-post.md'
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

// Convert markdown to Gutenberg HTML blocks
function markdownToGutenberg(markdown) {
  let html = '';
  
  // Split into paragraphs
  const sections = markdown.split('\n\n');
  
  sections.forEach(section => {
    const trimmed = section.trim();
    if (!trimmed) return;
    
    // Handle headings
    if (trimmed.startsWith('# ')) {
      const text = trimmed.replace(/^# /, '');
      html += `<!-- wp:heading {"level":2} -->\n<h2 class="wp-block-heading">${text}</h2>\n<!-- /wp:heading -->\n\n`;
    } else if (trimmed.startsWith('## ')) {
      const text = trimmed.replace(/^## /, '');
      html += `<!-- wp:heading {"level":3} -->\n<h3 class="wp-block-heading">${text}</h3>\n<!-- /wp:heading -->\n\n`;
    } else if (trimmed.startsWith('### ')) {
      const text = trimmed.replace(/^### /, '');
      html += `<!-- wp:heading {"level":4} -->\n<h4 class="wp-block-heading">${text}</h4>\n<!-- /wp:heading -->\n\n`;
    } else {
      // Regular paragraph - process inline markdown
      let text = trimmed.replace(/\n/g, ' ');
      
      // Bold and italic
      text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
      
      // Links
      text = text.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
      
      html += `<!-- wp:paragraph -->\n<p>${text}</p>\n<!-- /wp:paragraph -->\n\n`;
    }
  });
  
  return html.trim();
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
        console.log(`   Status Code: ${res.statusCode}`);
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            console.error('   Failed to parse response:', body);
            reject(e);
          }
        } else {
          console.error('   Error Response:', body);
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      const payload = JSON.stringify(data);
      console.log(`   Payload size: ${payload.length} bytes`);
      console.log(`   Payload preview:`, payload.substring(0, 200));
      req.write(payload);
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
  console.log(`   Original content length: ${body.length} chars`);
  
  // Convert markdown to Gutenberg blocks
  const gutenbergContent = markdownToGutenberg(body);
  
  console.log(`   Gutenberg content length: ${gutenbergContent.length} chars`);
  console.log(`   First 300 chars of content:`);
  console.log(`   ${gutenbergContent.substring(0, 300)}`);
  
  // Create post data
  const postData = {
    title: meta.title,
    content: gutenbergContent,
    status: 'draft',
    categories: [categoryId],
    excerpt: meta.excerpt || '',
    meta: {
      _yoast_wpseo_metadesc: meta.meta_description || '',
      _yoast_wpseo_focuskw: (meta.keywords || '').split(',')[0].trim()
    }
  };
  
  try {
    const post = await wpRequest('POST', '/wp-json/wp/v2/posts', postData);
    console.log(`   ✅ Draft created: ${post.link}`);
    console.log(`   📎 Edit URL: ${WP_URL}/wp-admin/post.php?post=${post.id}&action=edit`);
    console.log(`   📊 Post ID: ${post.id}`);
    console.log(`   📝 Content preview from response: ${post.content.rendered ? 'YES' : 'NO'}`);
    
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
  console.log('🚀 Testing WordPress draft creation with Gutenberg blocks...\n');
  
  try {
    // Get category ID
    console.log('📁 Finding "Engagement Sessions" category...');
    const categoryId = await getCategoryId();
    console.log(`   ✅ Category ID: ${categoryId}`);
    
    // Create test post
    const result = await createPost(BLOGS[0], categoryId);
    
    console.log('\n✨ Test complete!');
    console.log('\n📋 TEST RESULT:');
    console.log(`   Name: ${result.name}`);
    console.log(`   Title: ${result.title}`);
    if (result.error) {
      console.log(`   Status: ❌ Error - ${result.error}`);
    } else {
      console.log(`   Status: ✅ Created`);
      console.log(`   Edit URL: ${result.editUrl}`);
      console.log(`   Post ID: ${result.postId}`);
      console.log('\n👉 Open this URL and check if content appears in the editor:');
      console.log(`   ${result.editUrl}`);
    }
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
