#!/usr/bin/env node
const { execSync, exec } = require('child_process');
const path = require('path');
const { getDatabase, initDatabase } = require('./db');
const { processEmail } = require('./quarantine');
const { scoreEmail, saveScore, checkRubricDrift } = require('./scorer');
const { applyScoreLabel, initializeStageLabel } = require('./labeler');
const { generateDraft } = require('./drafter');
const { researchDomain } = require('./researcher');
const { escalate } = require('./escalator');
const { checkStageDrift } = require('./stage-tracker');
const CONFIG = require('./config.json');

// Resolve skills directory (env var or default)
const SKILLS_DIR = process.env.OPENCLAW_SKILLS_PATH || 
                   path.join(process.env.HOME, '.openclaw/workspace/skills');

let logger;
try {
  const Logger = require(path.join(SKILLS_DIR, 'logging/logger'));
  logger = Logger.getInstance();
} catch (e) {
  logger = { 
    info: (event, data) => console.log(`[${event}]`, data),
    error: (event, data) => console.error(`[${event}]`, data),
    warn: (event, data) => console.warn(`[${event}]`, data)
  };
}

// Parse himalaya email list output (JSON format)
function parseHimalayaList(output) {
  try {
    // Try JSON format first (robust)
    const parsed = JSON.parse(output);
    if (Array.isArray(parsed)) {
      return parsed.map(email => ({
        uid: email.id || email.uid,
        date: email.date,
        from: email.from,
        subject: email.subject || '(no subject)'
      }));
    }
  } catch (e) {
    // Fallback to regex parsing if JSON fails
    logger.warn('monitor.json_parse_failed', { error: e.message });
  }

  // Fallback: parse text output with robust regex
  const lines = output.trim().split('\n').slice(1); // Skip header
  const emails = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    // More robust regex that handles various formats
    // Matches: UID, date (1-2 tokens), sender (greedy), subject (rest)
    const match = line.match(/^(\d+)\s+(.+?)\s{2,}(.*)$/);
    
    if (match) {
      emails.push({
        uid: match[1],
        date: match[2].split(/\s+/).slice(0, 2).join(' '),
        from: match[2].split(/\s+/).slice(2).join(' '),
        subject: match[3].trim()
      });
    } else {
      logger.warn('monitor.unparsed_line', { line: line.substring(0, 100) });
    }
  }

  return emails;
}

// Fetch full email using himalaya
function fetchEmail(accountConfig, uid) {
  try {
    const cmd = `himalaya message read --account ${accountConfig.id} --preview ${uid}`;
    const output = execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });

    // himalaya v1.2.0 returns raw email text with headers
    // Parse headers and body from the raw output
    const lines = output.split('\n');
    const headers = {};
    let bodyStart = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '') {
        bodyStart = i + 1;
        break;
      }
      const headerMatch = line.match(/^([^:]+):\s*(.+)$/);
      if (headerMatch) {
        headers[headerMatch[1].toLowerCase()] = headerMatch[2].trim();
      }
    }
    
    const bodyText = lines.slice(bodyStart).join('\n').trim();
    
    // Parse From header: "Name <email>" or just "email"
    let fromEmail = 'unknown';
    let fromName = null;
    const fromHeader = headers['from'] || '';
    const fromMatch = fromHeader.match(/(?:"?([^"<]*)"?\s*)?<?([^>]+@[^>]+)>?/);
    if (fromMatch) {
      fromName = fromMatch[1]?.trim() || null;
      fromEmail = fromMatch[2]?.trim() || 'unknown';
    }
    
    // Parse To header
    let toEmail = accountConfig.email;
    const toHeader = headers['to'] || '';
    const toMatch = toHeader.match(/<?([^>]+@[^>]+)>?/);
    if (toMatch) toEmail = toMatch[1].trim();

    return {
      message_id: headers['message-id'] || `${accountConfig.id}-${uid}`,
      thread_id: headers['in-reply-to'] || null,
      from_email: fromEmail,
      from_name: fromName,
      from_domain: fromEmail.split('@')[1] || null,
      to_email: toEmail,
      subject: headers['subject'] || '(no subject)',
      body_html: '',
      body_text: bodyText,
      received_at: headers['date'] || new Date().toISOString(),
      is_reply: !!headers['in-reply-to'],
      in_reply_to: headers['in-reply-to'] || null,
      attachments: []
    };

  } catch (error) {
    logger.error('monitor.fetch_email_failed', { uid, error: error.message });
    return null;
  }
}

// Backfill historical emails from a domain
async function backfillDomain(accountConfig, domain) {
  logger.info('monitor.backfill_start', { account: accountConfig.id, domain });
  
  try {
    const since = new Date();
    since.setDate(since.getDate() - CONFIG.polling.backfill_days);
    const sinceStr = since.toISOString().split('T')[0];
    
    // Search for emails from this domain in the last 90 days
    const searchCmd = `himalaya envelope list --account ${accountConfig.id} --folder INBOX`;
    
    try {
      const output = execSync(searchCmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
      const emailList = parseHimalayaList(output);
      
      logger.info('monitor.backfill_found', { 
        account: accountConfig.id, 
        domain, 
        count: emailList.length 
      });
      
      return emailList;
    } catch (searchError) {
      logger.warn('monitor.backfill_search_failed', { 
        account: accountConfig.id, 
        domain, 
        error: searchError.message 
      });
      return [];
    }
  } catch (error) {
    logger.error('monitor.backfill_error', { 
      account: accountConfig.id, 
      domain, 
      error: error.message 
    });
    return [];
  }
}

// Poll a single account
async function pollAccount(accountConfig) {
  const db = getDatabase();
  
  logger.info('monitor.poll_start', { account: accountConfig.id, email: accountConfig.email });

  try {
    // Get last seen UID
    const pollState = db.prepare('SELECT last_seen_uid FROM poll_state WHERE account_id = ?')
      .get(accountConfig.id);
    
    const lastSeenUid = pollState?.last_seen_uid || '0';

    // List new emails using himalaya (try JSON format first)
    let cmd = `himalaya envelope list --account ${accountConfig.id} --folder INBOX -o json`;
    let output;
    
    try {
      output = execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
    } catch (jsonError) {
      // Fallback to text format if JSON not supported
      logger.warn('monitor.json_format_unsupported', { account: accountConfig.id });
      cmd = `himalaya envelope list --account ${accountConfig.id} --folder INBOX`;
      output = execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
    }
    
    const emailList = parseHimalayaList(output);

    // Filter new emails
    const newEmails = emailList.filter(e => parseInt(e.uid) > parseInt(lastSeenUid));

    if (newEmails.length === 0) {
      logger.info('monitor.no_new_emails', { account: accountConfig.id });
      
      // Update poll timestamp
      db.prepare(`
        INSERT OR REPLACE INTO poll_state (account_id, folder, last_seen_uid, last_poll_at)
        VALUES (?, ?, ?, datetime('now'))
      `).run(accountConfig.id, 'INBOX', lastSeenUid);
      
      db.close();
      return { account: accountConfig.id, new_count: 0 };
    }

    logger.info('monitor.new_emails_found', { account: accountConfig.id, count: newEmails.length });

    let processed = 0;
    let maxUid = lastSeenUid;

    for (const emailMeta of newEmails.slice(0, CONFIG.polling.max_emails_per_poll)) {
      try {
        // Fetch full email
        const email = fetchEmail(accountConfig, emailMeta.uid);
        if (!email) continue;

        // Check if already exists
        const existing = db.prepare('SELECT id FROM emails WHERE message_id = ?')
          .get(email.message_id);
        
        if (existing) {
          logger.info('monitor.email_already_processed', { message_id: email.message_id });
          continue;
        }

        // Process through pipeline
        await processEmailPipeline(db, accountConfig, email);
        
        processed++;
        maxUid = emailMeta.uid;

      } catch (error) {
        logger.error('monitor.process_email_failed', { uid: emailMeta.uid, error: error.message });
      }
    }

    // Check for new domains and trigger backfill
    const newDomains = new Set();
    for (const emailMeta of newEmails.slice(0, processed)) {
      try {
        const email = fetchEmail(accountConfig, emailMeta.uid);
        if (email && email.from_domain) {
          const existingDomain = db.prepare(
            'SELECT COUNT(*) as count FROM emails WHERE from_domain = ? AND account_id = ?'
          ).get(email.from_domain, accountConfig.id);
          
          if (existingDomain.count === 0) {
            newDomains.add(email.from_domain);
          }
        }
      } catch (e) {
        // Skip if we can't fetch the email for domain check
      }
    }

    // Backfill for new domains
    for (const domain of newDomains) {
      logger.info('monitor.new_domain_detected', { account: accountConfig.id, domain });
      const backfillEmails = await backfillDomain(accountConfig, domain);
      
      // Process backfilled emails (but don't count them in the processed count)
      for (const backfillMeta of backfillEmails) {
        try {
          const email = fetchEmail(accountConfig, backfillMeta.uid);
          if (!email) continue;
          
          // Check if already exists
          const existing = db.prepare('SELECT id FROM emails WHERE message_id = ?')
            .get(email.message_id);
          
          if (!existing) {
            await processEmailPipeline(db, accountConfig, email);
          }
        } catch (e) {
          logger.error('monitor.backfill_process_failed', { 
            uid: backfillMeta.uid, 
            error: e.message 
          });
        }
      }
    }

    // Update poll state
    db.prepare(`
      INSERT OR REPLACE INTO poll_state (account_id, folder, last_seen_uid, last_poll_at)
      VALUES (?, ?, ?, datetime('now'))
    `).run(accountConfig.id, 'INBOX', maxUid);

    db.close();

    logger.info('monitor.poll_complete', { account: accountConfig.id, processed });

    return { account: accountConfig.id, new_count: processed };

  } catch (error) {
    logger.error('monitor.poll_failed', { account: accountConfig.id, error: error.message });
    db.close();
    throw error;
  }
}

// Process single email through full pipeline
async function processEmailPipeline(db, accountConfig, email) {
  logger.info('monitor.processing_email', { subject: email.subject, from: email.from_email });

  // Step 1: Quarantine
  const quarantined = await processEmail(email);

  if (quarantined.quarantine_status === 'blocked') {
    logger.warn('monitor.email_blocked', { 
      message_id: email.message_id, 
      reason: quarantined.quarantine_reason 
    });
    
    // Save blocked email
    db.prepare(`
      INSERT INTO emails (
        account_id, message_id, thread_id, from_email, from_name, from_domain,
        to_email, subject, body_text, body_html_sanitized, received_at,
        is_reply, in_reply_to, quarantine_status, quarantine_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      accountConfig.id, email.message_id, email.thread_id, email.from_email,
      email.from_name, email.from_domain, email.to_email, email.subject,
      quarantined.body_text, quarantined.body_html_sanitized, email.received_at,
      email.is_reply, email.in_reply_to, quarantined.quarantine_status,
      quarantined.quarantine_reason
    );
    
    return;
  }

  // Step 2: Save clean email
  const insertResult = db.prepare(`
    INSERT INTO emails (
      account_id, message_id, thread_id, from_email, from_name, from_domain,
      to_email, subject, body_text, body_html_sanitized, received_at,
      is_reply, in_reply_to, quarantine_status, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    accountConfig.id, email.message_id, email.thread_id, email.from_email,
    email.from_name, email.from_domain, email.to_email, email.subject,
    quarantined.body_text, quarantined.body_html_sanitized, email.received_at,
    email.is_reply, email.in_reply_to, 'clean',
    JSON.stringify({ links: quarantined.links, images: quarantined.images })
  );

  const emailId = insertResult.lastInsertRowid;

  // Step 3: Score (if enabled)
  if (accountConfig.features.scoring) {
    try {
      const scoreData = await scoreEmail({
        from_email: email.from_email,
        from_name: email.from_name,
        subject: email.subject,
        body_text: quarantined.body_text
      });

      saveScore(db, emailId, scoreData);
      logger.info('monitor.email_scored', { 
        email_id: emailId, 
        classification: scoreData.classification, 
        score: scoreData.score 
      });

      // Step 4: Apply labels (if enabled)
      if (accountConfig.features.labels) {
        applyScoreLabel(db, emailId);
        
        if (scoreData.classification === 'lead') {
          initializeStageLabel(db, emailId);
          
          // Check for stage drift (if stage tracking enabled)
          if (accountConfig.features.stage_tracking) {
            try {
              const driftResult = await checkStageDrift(db, emailId);
              if (driftResult && driftResult.drift) {
                logger.warn('monitor.stage_drift', {
                  email_id: emailId,
                  local: driftResult.local,
                  crm: driftResult.crm
                });
              }
            } catch (e) {
              logger.error('monitor.drift_check_failed', { 
                email_id: emailId, 
                error: e.message 
              });
            }
          }
        }
      }

      // Step 5: Research domain (for leads)
      if (scoreData.classification === 'lead' && email.from_domain) {
        try {
          await researchDomain(email.from_domain);
        } catch (e) {
          logger.error('monitor.research_failed', { domain: email.from_domain, error: e.message });
        }
      }

      // Step 6: Generate draft (if enabled and is a lead)
      if (accountConfig.features.draft_generation && scoreData.classification === 'lead') {
        try {
          await generateDraft(emailId);
        } catch (e) {
          logger.error('monitor.draft_failed', { email_id: emailId, error: e.message });
        }
      }

      // Step 7: Escalate (if enabled)
      if (accountConfig.features.escalation && scoreData.classification === 'lead') {
        try {
          await escalate(emailId);
        } catch (e) {
          logger.error('monitor.escalation_failed', { email_id: emailId, error: e.message });
        }
      }

    } catch (error) {
      logger.error('monitor.scoring_failed', { email_id: emailId, error: error.message });
    }
  }
}

// Track consecutive failures for alerting
const consecutiveFailures = new Map();

// Poll with retry logic
async function pollAccountWithRetry(accountConfig, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const result = await pollAccount(accountConfig);
      
      // Success - reset failure counter
      consecutiveFailures.set(accountConfig.id, 0);
      
      return result;
    } catch (error) {
      const isLastAttempt = attempt === retries - 1;
      
      if (isLastAttempt) {
        // Track consecutive failures
        const failures = (consecutiveFailures.get(accountConfig.id) || 0) + 1;
        consecutiveFailures.set(accountConfig.id, failures);
        
        // Alert after 3 consecutive failures
        if (failures >= 3) {
          logger.error('monitor.consecutive_failures_alert', {
            account: accountConfig.id,
            failures,
            error: error.message
          });
          
          // Send alert via Telegram
          try {
            const { execSync } = require('child_process');
            const message = `⚠️ Email pipeline: ${failures} consecutive failures for ${accountConfig.id}. Last error: ${error.message}`;
            execSync(`openclaw message send --text "${message.replace(/"/g, '\\"')}"`, { 
              encoding: 'utf-8',
              timeout: 5000
            });
          } catch (alertError) {
            logger.error('monitor.alert_send_failed', { error: alertError.message });
          }
        }
        
        throw error;
      }
      
      // Calculate backoff delay
      const backoffMs = Math.pow(2, attempt) * 1000;
      logger.warn('monitor.poll_retry', { 
        account: accountConfig.id, 
        attempt: attempt + 1, 
        backoff_ms: backoffMs,
        error: error.message 
      });
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }
}

// Poll all accounts
async function pollAll() {
  logger.info('monitor.poll_all_start', {});

  const results = [];

  for (const account of CONFIG.accounts) {
    try {
      const result = await pollAccountWithRetry(account);
      results.push(result);
    } catch (error) {
      logger.error('monitor.account_poll_failed', { account: account.id, error: error.message });
      results.push({ account: account.id, error: error.message });
    }
  }

  logger.info('monitor.poll_all_complete', { account_count: results.length });
  return results;
}

// Get pipeline stats
function getStats() {
  const db = getDatabase();

  const stats = {
    total_emails: db.prepare('SELECT COUNT(*) as count FROM emails').get().count,
    by_status: {},
    by_classification: {},
    by_score_bucket: {},
    by_account: {},
    rubric_drift: null
  };

  // By quarantine status
  const statusRows = db.prepare('SELECT quarantine_status, COUNT(*) as count FROM emails GROUP BY quarantine_status').all();
  statusRows.forEach(row => {
    stats.by_status[row.quarantine_status] = row.count;
  });

  // By classification
  const classRows = db.prepare('SELECT classification, COUNT(*) as count FROM emails WHERE classification IS NOT NULL GROUP BY classification').all();
  classRows.forEach(row => {
    stats.by_classification[row.classification] = row.count;
  });

  // By score bucket
  const bucketRows = db.prepare('SELECT score_bucket, COUNT(*) as count FROM emails WHERE score_bucket IS NOT NULL GROUP BY score_bucket').all();
  bucketRows.forEach(row => {
    stats.by_score_bucket[row.score_bucket] = row.count;
  });

  // By account
  const accountRows = db.prepare('SELECT account_id, COUNT(*) as count FROM emails GROUP BY account_id').all();
  accountRows.forEach(row => {
    stats.by_account[row.account_id] = row.count;
  });

  // Check for rubric version drift
  try {
    stats.rubric_drift = checkRubricDrift(db);
  } catch (e) {
    logger.error('monitor.rubric_drift_check_failed', { error: e.message });
  }

  db.close();

  return stats;
}

// List recent emails
function listEmails(hours = 24, leadsOnly = false) {
  const db = getDatabase();

  let query = `
    SELECT id, account_id, from_email, from_name, subject, score, score_bucket, 
           classification, stage_label, received_at
    FROM emails
    WHERE received_at >= datetime('now', '-${hours} hours')
  `;

  if (leadsOnly) {
    query += ` AND classification = 'lead'`;
  }

  query += ` ORDER BY received_at DESC LIMIT 50`;

  const emails = db.prepare(query).all();
  db.close();

  return emails;
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--poll')) {
    const accountArg = args.indexOf('--account');
    if (accountArg !== -1) {
      const accountId = args[accountArg + 1];
      const account = CONFIG.accounts.find(a => a.id === accountId);
      if (!account) {
        console.error(`Account not found: ${accountId}`);
        process.exit(1);
      }
      pollAccount(account).then(result => {
        console.log(JSON.stringify(result, null, 2));
      });
    } else {
      pollAll().then(results => {
        console.log(JSON.stringify(results, null, 2));
      });
    }

  } else if (args.includes('--stats')) {
    const stats = getStats();
    console.log(JSON.stringify(stats, null, 2));

  } else if (args.includes('--list')) {
    const hoursArg = args.indexOf('--last');
    const hours = hoursArg !== -1 ? parseInt(args[hoursArg + 1].replace(/[hd]/, '')) : 24;
    const leadsOnly = args.includes('--leads');

    const emails = listEmails(hours, leadsOnly);
    console.log(JSON.stringify(emails, null, 2));

  } else {
    console.log('Email Pipeline Monitor');
    console.log('');
    console.log('Usage:');
    console.log('  node monitor.js --poll [--account <id>]');
    console.log('  node monitor.js --stats');
    console.log('  node monitor.js --list [--last 24h] [--leads]');
  }
}

module.exports = {
  pollAll,
  pollAccount,
  getStats,
  listEmails
};
