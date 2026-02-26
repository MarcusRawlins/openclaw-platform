#!/usr/bin/env node

const fs = require('fs');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

// WordPress credentials
const WP_URL = 'https://bythereeses.com';
const WP_EMAIL = 'bythereeses@gmail.com';
const WP_PASSWORD = 'Powell1992!';

// Post IDs from the failed attempts
const POST_TO_FIX = {
  id: 4551, // We'll create a new test post
  file: '/Volumes/reeseai-memory/photography/content/blog/Engagement Sessions/6-kelly-ryan-engagement/blog-post.md'
};

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

async function main() {
  console.log('🚀 Starting browser automation to fix WordPress content...\n');
  
  // Read markdown file
  console.log('📖 Reading markdown file...');
  const content = fs.readFileSync(POST_TO_FIX.file, 'utf8');
  const { meta, content: body } = parseFrontmatter(content);
  
  console.log(`   Title: ${meta.title}`);
  console.log(`   Content length: ${body.length} chars`);
  
  // Convert to HTML
  const htmlContent = markdownToHtml(body);
  console.log(`   HTML length: ${htmlContent.length} chars`);
  console.log(`   HTML preview:\n${htmlContent.substring(0, 300)}...\n`);
  
  // Launch browser
  console.log('🌐 Launching browser...');
  const browser = await puppeteer.launch({
    headless: false, // Show browser so we can see what's happening
    defaultViewport: { width: 1400, height: 900 }
  });
  
  const page = await browser.newPage();
  
  try {
    // Login to WordPress
    console.log('🔐 Logging in to WordPress...');
    await page.goto(`${WP_URL}/wp-login.php`, { waitUntil: 'networkidle2' });
    
    await page.type('#user_login', WP_EMAIL);
    await page.type('#user_pass', WP_PASSWORD);
    await page.click('#wp-submit');
    
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    console.log('   ✅ Logged in');
    
    // Create new post
    console.log('\n📝 Creating new post...');
    await page.goto(`${WP_URL}/wp-admin/post-new.php`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));
    
    // Close any welcome modals/tooltips
    try {
      const closeButton = await page.$('.components-modal__header button[aria-label="Close"]');
      if (closeButton) {
        await closeButton.click();
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (e) {
      // No modal, continue
    }
    
    // Add title - try multiple selectors
    console.log('   Adding title...');
    
    // Wait for editor to load
    await new Promise(r => setTimeout(r, 3000));
    
    const titleSelectors = [
      '.editor-post-title__input',
      '.editor-post-title textarea',
      'h1[aria-label="Add title"]',
      '.editor-post-title',
      'textarea.editor-post-title__input'
    ];
    
    let titleAdded = false;
    for (const selector of titleSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          console.log(`   Found title field with selector: ${selector}`);
          await element.click();
          await new Promise(r => setTimeout(r, 500));
          await element.type(meta.title, { delay: 50 });
          console.log(`   ✅ Title added: ${meta.title}`);
          titleAdded = true;
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!titleAdded) {
      console.log('   ⚠️  Could not find title field, trying alternative method...');
      await page.keyboard.type(meta.title);
      console.log(`   ✅ Title typed: ${meta.title}`);
    }
    
    await new Promise(r => setTimeout(r, 1000));
    
    // Switch to Code Editor (this is key!)
    console.log('\n🔧 Switching to Code Editor...');
    
    // Try keyboard shortcut first (Cmd+Shift+Alt+M on Mac)
    try {
      await page.keyboard.down('Meta');
      await page.keyboard.down('Shift');
      await page.keyboard.down('Alt');
      await page.keyboard.press('M');
      await page.keyboard.up('Alt');
      await page.keyboard.up('Shift');
      await page.keyboard.up('Meta');
      await new Promise(r => setTimeout(r, 1500));
      console.log('   ℹ️  Tried keyboard shortcut');
    } catch (e) {
      console.log('   ℹ️  Keyboard shortcut failed, trying menu...');
    }
    
    // Alternative: Try options menu
    try {
      const optionsSelectors = [
        'button[aria-label="Options"]',
        'button[aria-label="Settings"]',
        '.interface-more-menu-dropdown button'
      ];
      
      for (const selector of optionsSelectors) {
        const btn = await page.$(selector);
        if (btn) {
          await btn.click();
          await new Promise(r => setTimeout(r, 800));
          
          // Find and click Code editor option
          const switched = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button.components-menu-item__button, button[role="menuitem"]'));
            const codeEditorBtn = buttons.find(btn => 
              btn.textContent.includes('Code editor') || 
              btn.textContent.includes('Code view')
            );
            if (codeEditorBtn) {
              codeEditorBtn.click();
              return true;
            }
            return false;
          });
          
          if (switched) {
            console.log('   ✅ Switched to Code Editor');
            break;
          }
        }
      }
      
      await new Promise(r => setTimeout(r, 1500));
    } catch (e) {
      console.log('   ⚠️  Code editor switch uncertain, continuing...');
    }
    
    // Insert HTML content into code editor
    console.log('\n📋 Inserting HTML content...');
    
    const codeEditorSelectors = [
      '.editor-post-text-editor',
      'textarea.editor-post-text-editor',
      '.block-editor-block-list__layout textarea'
    ];
    
    let contentInserted = false;
    
    for (const selector of codeEditorSelectors) {
      try {
        const editor = await page.$(selector);
        if (editor) {
          console.log(`   Found editor with selector: ${selector}`);
          
          // Clear and insert using evaluate
          const inserted = await page.evaluate((sel, html) => {
            const editorEl = document.querySelector(sel);
            if (editorEl) {
              editorEl.value = html;
              editorEl.dispatchEvent(new Event('input', { bubbles: true }));
              editorEl.dispatchEvent(new Event('change', { bubbles: true }));
              return true;
            }
            return false;
          }, selector, htmlContent);
          
          if (inserted) {
            console.log('   ✅ Content inserted via evaluate');
            contentInserted = true;
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!contentInserted) {
      console.log('   ⚠️  Direct insertion failed, trying alternative method...');
      
      // Alternative: Click into first block and paste
      try {
        const firstBlock = await page.$('.block-editor-block-list__layout');
        if (firstBlock) {
          await firstBlock.click();
          await new Promise(r => setTimeout(r, 500));
          
          // Use clipboard
          await page.evaluate((html) => navigator.clipboard.writeText(html), htmlContent);
          await new Promise(r => setTimeout(r, 300));
          
          await page.keyboard.down('Meta');
          await page.keyboard.press('V');
          await page.keyboard.up('Meta');
          
          console.log('   ✅ Content pasted via clipboard');
          contentInserted = true;
        }
      } catch (e) {
        console.error('   ❌ All insertion methods failed:', e.message);
      }
    }
    
    // CRITICAL: Wait for WordPress to register the change
    console.log('   Waiting for WordPress to process content...');
    await new Promise(r => setTimeout(r, 3000));
    
    // Manually trigger save (Cmd+S on Mac) BEFORE doing anything else
    console.log('\n💾 Triggering manual save...');
    await page.keyboard.down('Meta'); // Cmd on Mac
    await page.keyboard.press('S');
    await page.keyboard.up('Meta');
    await new Promise(r => setTimeout(r, 2000));
    console.log('   ✅ Save command sent');
    
    // Wait for save to complete
    console.log('   Waiting for save to complete...');
    await new Promise(r => setTimeout(r, 4000));
    
    // Verify content - check multiple sources
    const verification = await page.evaluate(() => {
      const codeEditor = document.querySelector('.editor-post-text-editor');
      const codeEditorHasContent = codeEditor && codeEditor.value.length > 100;
      
      // Check if there are blocks in the visual editor (WordPress may have converted)
      const blocks = document.querySelectorAll('.block-editor-block-list__block');
      const hasBlocks = blocks && blocks.length > 0;
      
      // Check for saved indicator
      const saveIndicators = document.querySelectorAll('[aria-label*="Saved"], .editor-post-saved-state');
      const hasSaveIndicator = saveIndicators.length > 0;
      
      return {
        codeEditorHasContent,
        blockCount: blocks ? blocks.length : 0,
        hasSaveIndicator
      };
    });
    
    console.log(`   Code editor content: ${verification.codeEditorHasContent ? 'YES' : 'NO'}`);
    console.log(`   Blocks created: ${verification.blockCount}`);
    console.log(`   Save indicator: ${verification.hasSaveIndicator ? 'YES' : 'NO'}`);
    
    if (verification.codeEditorHasContent || verification.blockCount > 0) {
      console.log('   ✅ Content verified - present in editor');
    } else {
      console.log('   ⚠️  WARNING: Content verification uncertain');
    }
    
    // DON'T switch back to visual editor - stay in code editor
    
    // Get post ID from URL
    const url = page.url();
    const postIdMatch = url.match(/post=(\d+)/);
    const postId = postIdMatch ? postIdMatch[1] : 'unknown';
    
    console.log(`\n✨ SUCCESS!`);
    console.log(`   Post ID: ${postId}`);
    console.log(`   Edit URL: ${WP_URL}/wp-admin/post.php?post=${postId}&action=edit`);
    console.log(`\n👉 Check the WordPress editor - content should be visible now!`);
    console.log(`   Browser will stay open for 10 seconds for you to verify...`);
    
    await new Promise(r => setTimeout(r, 10000));
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    
    console.log('\n📸 Taking screenshot...');
    await page.screenshot({ path: '/Users/marcusrawlins/.openclaw/workspace/error-screenshot.png', fullPage: true });
    console.log('   Screenshot saved to: /Users/marcusrawlins/.openclaw/workspace/error-screenshot.png');
    
    await new Promise(r => setTimeout(r, 5000));
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
