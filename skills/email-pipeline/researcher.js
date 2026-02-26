#!/usr/bin/env node
const dns = require('dns').promises;
const path = require('path');
const { getDatabase } = require('./db');
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

// SSRF Protection: Block private IP ranges
const BLOCKED_RANGES = [
  /^127\./,           // localhost
  /^10\./,            // private class A
  /^192\.168\./,      // private class C
  /^172\.(1[6-9]|2\d|3[01])\./, // private class B
  /^0\./,             // invalid
  /^169\.254\./,      // link-local
  /^::1$/,            // IPv6 localhost
  /^fc00:/i,          // IPv6 private
  /^fe80:/i           // IPv6 link-local
];

function isPrivateIP(ip) {
  return BLOCKED_RANGES.some(r => r.test(ip));
}

// Safe fetch with SSRF protection
async function safeFetch(domain, timeout = CONFIG.research.fetch_timeout_ms) {
  try {
    // Step 1: Resolve domain to IPs
    const ips = await dns.resolve4(domain);
    
    // Step 2: Check if any IP is private
    const blockedIps = ips.filter(isPrivateIP);
    if (blockedIps.length > 0) {
      throw new Error(`SSRF blocked: ${domain} resolves to private IP(s): ${blockedIps.join(', ')}`);
    }

    // Step 3: Fetch (only root domain, no redirects followed)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(`https://${domain}`, {
      signal: controller.signal,
      redirect: 'manual', // Don't follow redirects
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ReeseAI-Research/1.0)'
      }
    });

    clearTimeout(timeoutId);

    // Limit response size
    const maxSize = CONFIG.research.max_page_size_kb * 1024;
    const reader = response.body.getReader();
    const chunks = [];
    let totalSize = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      totalSize += value.length;
      if (totalSize > maxSize) {
        throw new Error(`Response exceeded max size (${CONFIG.research.max_page_size_kb}KB)`);
      }
      
      chunks.push(value);
    }

    const buffer = Buffer.concat(chunks);
    const html = buffer.toString('utf-8');

    return { success: true, html, status: response.status };

  } catch (error) {
    logger.error('researcher.fetch_failed', { domain, error: error.message });
    return { success: false, error: error.message };
  }
}

// Extract credibility markers from HTML
function parseCredibilityMarkers(html, domain) {
  const markers = [];

  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : null;

  // Extract meta description
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  const description = descMatch ? descMatch[1].trim() : null;

  // Social links
  const socialLinks = {};
  const socialPatterns = {
    linkedin: /linkedin\.com\/(?:company|in)\/([^"'\s<>]+)/i,
    instagram: /instagram\.com\/([^"'\s<>]+)/i,
    facebook: /facebook\.com\/([^"'\s<>]+)/i,
    twitter: /(?:twitter|x)\.com\/([^"'\s<>]+)/i
  };

  for (const [platform, pattern] of Object.entries(socialPatterns)) {
    const match = html.match(pattern);
    if (match) {
      socialLinks[platform] = match[0];
      markers.push(`${platform}_present`);
    }
  }

  // Contact info
  if (/tel:|phone:/i.test(html)) markers.push('phone_listed');
  if (/address:|location:/i.test(html)) markers.push('address_listed');

  // Professional indicators
  if (/about\s+us|our\s+team|contact\s+us/i.test(html)) markers.push('professional_structure');

  return {
    title,
    description,
    credibility_markers: markers,
    social_links: socialLinks
  };
}

// Research a sender domain
async function researchDomain(domain) {
  const db = getDatabase();

  try {
    // Check cache
    const cached = db.prepare('SELECT * FROM sender_research WHERE domain = ?').get(domain);
    
    if (cached) {
      const ageMs = Date.now() - new Date(cached.researched_at).getTime();
      const cacheDays = CONFIG.research.cache_days;
      const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
      
      if (ageMs < cacheDays * 24 * 60 * 60 * 1000) {
        logger.info('researcher.cache_hit', { domain, age_days: ageDays });
        return JSON.parse(cached.raw_data);
      }
    }

    // Fresh research
    logger.info('researcher.research_start', { domain });

    // DNS resolution
    let domainResolves = false;
    try {
      await dns.resolve4(domain);
      domainResolves = true;
    } catch (e) {
      logger.info('researcher.domain_no_resolve', { domain });
    }

    let result = {
      domain,
      domain_resolves: domainResolves,
      website_title: null,
      website_description: null,
      credibility_markers: [],
      social_links: {},
      industry: null,
      company_size_estimate: null,
      researched_at: new Date().toISOString()
    };

    if (domainResolves) {
      const fetchResult = await safeFetch(domain);
      
      if (fetchResult.success) {
        const parsed = parseCredibilityMarkers(fetchResult.html, domain);
        result = { ...result, ...parsed };
      }
    }

    // Save to cache
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO sender_research 
      (domain, domain_resolves, website_title, website_description, credibility_markers, social_links, raw_data)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      domain,
      result.domain_resolves ? 1 : 0,
      result.website_title,
      result.website_description,
      JSON.stringify(result.credibility_markers),
      JSON.stringify(result.social_links),
      JSON.stringify(result)
    );

    db.close();

    logger.info('researcher.research_complete', { 
      domain, 
      markers_count: result.credibility_markers.length,
      resolves: result.domain_resolves
    });

    return result;

  } catch (error) {
    logger.error('researcher.research_failed', { domain, error: error.message });
    db.close();
    throw error;
  }
}

// CLI: node researcher.js --domain example.com
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--domain')) {
    const domain = args[args.indexOf('--domain') + 1];
    researchDomain(domain).then(result => {
      console.log(JSON.stringify(result, null, 2));
    }).catch(error => {
      console.error('Research failed:', error.message);
      process.exit(1);
    });
  } else {
    console.log('Usage: node researcher.js --domain <domain>');
  }
}

module.exports = {
  researchDomain,
  safeFetch,
  isPrivateIP
};
