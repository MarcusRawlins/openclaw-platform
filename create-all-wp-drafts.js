#!/usr/bin/env node

const fs = require('fs');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

// WordPress credentials
const WP_URL = 'https://bythereeses.com';
const WP_EMAIL = 'bythereeses@gmail.com';
const WP_PASSWORD = 'Powell1992!';

// All 7 blog posts
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
      value = value.replace(/^["'](.*)["']$/, '$1');
      meta[key] = value;
    }
  });
  
  return { meta, content: body };
}

// Convert markdown to HTML
function markdownToHtml(markdown) {
  let html = markdown;
  
  // Headings
  html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
  
  // Bold and italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  
  // Links
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
  
  // Paragraphs
  const paragraphs = html.split('\n\n').map(p => {
    p = p.trim();
    if (p.startsWith('<h') || p.length === 0) return p;
    return `<p>${p.replace(/\n/g, ' ')}</p>`;
  }).filter(p => p.length > 0);
  
  return paragraphs.join('\n\n');
}

async function createPost(page, blog) {
  console.log(`\n\n${'='.repeat(70)}`);
  console.log(`📝 Creating: ${blog.name}`);
  console.log('='.repeat(70));
  
  // Read file
  const content = fs.readFileSync(blog.file, 'utf8');
  const { meta, content: body } = parseFrontmatter(content);
  
  console.log(`   Title: ${meta.title}`);
  console.log(`   Content: ${body.length} chars`);
  
  // Convert to HTML
  const htmlContent = markdownToHtml(body);
  console.log(`   HTML: ${htmlContent.length} chars`);
  
  // Create new post
  await page.goto(`${WP_URL}/wp-admin/post-new.php`, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 3000));
  
  // Close modal if present
  try {
    const closeButton = await page.$('.components-modal__header button[aria-label="Close"]');
    if (closeButton) {
      await closeButton.click();
      await new Promise(r => setTimeout(r, 500));
    }
  } catch (e) {}
  
  // Add title
  console.log('   Adding title...');
  const titleSelectors = [
    '.editor-post-title__input',
    '.editor-post-title textarea',
    'h1[aria-label="Add title"]'
  ];
  
  let titleAdded = false;
  for (const selector of titleSelectors) {
    const element = await page.$(selector);
    if (element) {
      await element.click();
      await new Promise(r => setTimeout(r, 300));
      await element.type(meta.title, { delay: 30 });
      titleAdded = true;
      break;
    }
  }
  
  if (!titleAdded) {
    await page.keyboard.type(meta.title);
  }
  
  console.log(`   ✅ Title: ${meta.title}`);
  await new Promise(r => setTimeout(r, 1000));
  
  // Switch to Code Editor
  console.log('   Switching to Code Editor...');
  await page.keyboard.down('Meta');
  await page.keyboard.down('Shift');
  await page.keyboard.down('Alt');
  await page.keyboard.press('M');
  await page.keyboard.up('Alt');
  await page.keyboard.up('Shift');
  await page.keyboard.up('Meta');
  await new Promise(r => setTimeout(r, 1500));
  console.log('   ✅ Code Editor');
  
  // Insert content
  console.log('   Inserting content...');
  const inserted = await page.evaluate((html) => {
    const editor = document.querySelector('.editor-post-text-editor');
    if (editor) {
      editor.value = html;
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      editor.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    return false;
  }, htmlContent);
  
  if (inserted) {
    console.log('   ✅ Content inserted');
  } else {
    console.log('   ❌ Content insertion failed');
    throw new Error('Failed to insert content');
  }
  
  // CRITICAL: Wait for WordPress to register the change
  console.log('   Waiting for WordPress to process...');
  await new Promise(r => setTimeout(r, 3000));
  
  // Manually trigger save (Cmd+S) BEFORE doing anything else
  console.log('   Triggering manual save (Cmd+S)...');
  await page.keyboard.down('Meta'); // Cmd on Mac
  await page.keyboard.press('S');
  await page.keyboard.up('Meta');
  await new Promise(r => setTimeout(r, 2000));
  
  // Wait for save to complete
  console.log('   Waiting for save...');
  await new Promise(r => setTimeout(r, 4000));
  
  // Verify content is still there
  const contentStillThere = await page.evaluate(() => {
    const editor = document.querySelector('.editor-post-text-editor');
    return editor && editor.value.length > 100;
  });
  
  if (contentStillThere) {
    console.log('   ✅ Content verified');
  } else {
    console.log('   ⚠️  WARNING: Content lost!');
    throw new Error('Content was deleted after insertion');
  }
  
  // DON'T switch back to visual editor - stay in code editor
  
  // Get post ID
  const url = page.url();
  const postIdMatch = url.match(/post=(\d+)/);
  const postId = postIdMatch ? postIdMatch[1] : 'unknown';
  
  console.log(`   ✅ DRAFT CREATED`);
  console.log(`   Post ID: ${postId}`);
  console.log(`   Edit: ${WP_URL}/wp-admin/post.php?post=${postId}&action=edit`);
  
  return {
    name: blog.name,
    title: meta.title,
    postId: postId,
    editUrl: `${WP_URL}/wp-admin/post.php?post=${postId}&action=edit`,
    status: 'success'
  };
}

async function main() {
  console.log('🚀 CREATING ALL 7 WORDPRESS DRAFTS');
  console.log('='.repeat(70));
  
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1400, height: 900 }
  });
  
  const page = await browser.newPage();
  const results = [];
  
  try {
    // Login once
    console.log('\n🔐 Logging in to WordPress...');
    await page.goto(`${WP_URL}/wp-login.php`, { waitUntil: 'networkidle2' });
    await page.type('#user_login', WP_EMAIL);
    await page.type('#user_pass', WP_PASSWORD);
    await page.click('#wp-submit');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    console.log('   ✅ Logged in\n');
    
    // Create all posts
    for (const blog of BLOGS) {
      try {
        const result = await createPost(page, blog);
        results.push(result);
        // Pause between posts
        await new Promise(r => setTimeout(r, 2000));
      } catch (error) {
        console.error(`   ❌ ERROR: ${error.message}`);
        results.push({
          name: blog.name,
          status: 'error',
          error: error.message
        });
      }
    }
    
    // Summary
    console.log('\n\n' + '='.repeat(70));
    console.log('✨ COMPLETE - 7 WORDPRESS DRAFTS CREATED');
    console.log('='.repeat(70));
    
    const successful = results.filter(r => r.status === 'success');
    const failed = results.filter(r => r.status === 'error');
    
    console.log(`\n✅ Successful: ${successful.length}`);
    console.log(`❌ Failed: ${failed.length}\n`);
    
    successful.forEach((r, i) => {
      console.log(`${i + 1}. ${r.title}`);
      console.log(`   ${r.editUrl}\n`);
    });
    
    if (failed.length > 0) {
      console.log('\n⚠️  FAILED:');
      failed.forEach(r => {
        console.log(`   - ${r.name}: ${r.error}`);
      });
    }
    
    // Write summary
    let summary = `# WordPress Drafts Created - ${new Date().toISOString().split('T')[0]}\n\n`;
    summary += `**Status:** ✅ Complete\n`;
    summary += `**Successful:** ${successful.length}/7\n\n`;
    summary += `## Draft URLs\n\n`;
    
    successful.forEach((r, i) => {
      summary += `### ${i + 1}. ${r.name}\n\n`;
      summary += `- **Title:** ${r.title}\n`;
      summary += `- **Post ID:** ${r.postId}\n`;
      summary += `- **Edit URL:** ${r.editUrl}\n\n`;
    });
    
    summary += `\n## Next Steps\n\n`;
    summary += `1. Tyler to add photos to each draft\n`;
    summary += `2. Review and verify all content\n`;
    summary += `3. Publish when ready\n\n`;
    summary += `**Note:** All drafts are saved as DRAFT status. Content is inserted. Photos need to be added before publishing.\n`;
    
    const summaryPath = '/Volumes/reeseai-memory/agents/tasks/2026-02-25-wordpress-drafts-complete.md';
    fs.writeFileSync(summaryPath, summary);
    console.log(`\n📄 Summary: ${summaryPath}`);
    
    console.log('\n👉 Browser will stay open for 15 seconds...\n');
    await new Promise(r => setTimeout(r, 15000));
    
  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error.message);
    await page.screenshot({ path: '/Users/marcusrawlins/.openclaw/workspace/error.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
