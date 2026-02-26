#!/usr/bin/env node

const https = require('https');

const WP_URL = 'https://bythereeses.com';
const WP_EMAIL = 'bythereeses@gmail.com';
const WP_PASSWORD = 'Powell1992!';
const AUTH = Buffer.from(`${WP_EMAIL}:${WP_PASSWORD}`).toString('base64');

const POST_ID = process.argv[2] || '4554';

function wpRequest(method, path) {
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
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve(body);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

async function checkPost(postId) {
  try {
    console.log(`🔍 Checking WordPress post ${postId}...\n`);
    
    const post = await wpRequest('GET', `/wp-json/wp/v2/posts/${postId}?context=edit`);
    
    console.log(`Title: ${post.title.raw}`);
    console.log(`Status: ${post.status}`);
    console.log(`Modified: ${post.modified}`);
    console.log(`\nContent length: ${post.content.raw.length} chars`);
    
    if (post.content.raw.length > 100) {
      console.log('\n✅ CONTENT EXISTS!\n');
      console.log('First 500 chars:');
      console.log(post.content.raw.substring(0, 500));
      console.log('\n...\n');
    } else {
      console.log('\n❌ NO CONTENT - Post is empty!\n');
    }
    
    console.log(`\nEdit URL: ${WP_URL}/wp-admin/post.php?post=${postId}&action=edit`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkPost(POST_ID);
