#!/usr/bin/env node

/**
 * Daily Briefing Cron Handler
 * 
 * Runs at 6:00 AM EST every day
 * Generates briefing and sends to Tyler via Telegram
 * 
 * Usage:
 *   node daily-briefing-cron.js [--dry-run]
 */

const { generateDailyBriefing } = require('../../skills/daily-briefing/briefing-generator');
const fs = require('fs');
const path = require('path');
const https = require('https');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || process.env.TYLER_TELEGRAM_CHAT_ID;

async function sendTelegramMessage(message, parseMode = 'Markdown') {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('❌ Missing Telegram credentials (TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID)');
    return false;
  }
  
  return new Promise((resolve) => {
    const data = JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: parseMode,
      disable_web_page_preview: true
    });
    
    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };
    
    const req = https.request(options, (res) => {
      let body = '';
      
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          if (result.ok) {
            console.log('✓ Message sent to Telegram');
            resolve(true);
          } else {
            console.error('❌ Telegram error:', result.description);
            resolve(false);
          }
        } catch (err) {
          console.error('❌ Failed to parse Telegram response:', err.message);
          resolve(false);
        }
      });
    });
    
    req.on('error', (err) => {
      console.error('❌ Telegram request error:', err.message);
      resolve(false);
    });
    
    req.write(data);
    req.end();
  });
}

function logExecution(result) {
  const logDir = '/Volumes/reeseai-memory/briefings/logs';
  
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  const date = new Date().toISOString().split('T')[0];
  const logFile = path.join(logDir, `${date}-execution.json`);
  
  const logEntry = {
    timestamp: new Date().toISOString(),
    success: !result.error,
    error: result.error || null,
    stats: result.stats || null,
    savedPath: result.savedPath || null
  };
  
  fs.writeFileSync(logFile, JSON.stringify(logEntry, null, 2));
  console.log(`✓ Execution logged: ${logFile}`);
}

async function runDailyBriefing(dryRun = false) {
  console.log('🌅 Daily Briefing Cron Starting');
  console.log(`   Time: ${new Date().toISOString()}`);
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'PRODUCTION'}\n`);
  
  // Generate briefing
  const result = await generateDailyBriefing();
  
  if (result.error) {
    console.error('❌ Briefing generation failed:', result.error);
    logExecution(result);
    process.exit(1);
  }
  
  console.log(`\n📊 Briefing Generated:`);
  console.log(`   Items: ${result.stats.content_items} content, ${result.stats.active_ideas} ideas, ${result.stats.tasks_today} tasks\n`);
  
  if (!dryRun) {
    // Send to Telegram
    console.log('📤 Sending to Telegram...');
    const sent = await sendTelegramMessage(result.briefing, 'Markdown');
    
    if (sent) {
      console.log('✅ Briefing delivered successfully\n');
    } else {
      console.error('❌ Failed to send to Telegram\n');
      logExecution({ ...result, error: 'Failed to send Telegram message' });
      process.exit(1);
    }
  } else {
    console.log('📋 [DRY RUN] Would send above briefing to Telegram\n');
  }
  
  // Log execution
  logExecution(result);
  
  console.log('✅ Daily Briefing Complete');
  process.exit(0);
}

// CLI
const dryRun = process.argv.includes('--dry-run');
runDailyBriefing(dryRun).catch(err => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
