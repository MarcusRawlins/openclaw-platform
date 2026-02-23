# Puppeteer + Google Search Automation - Research Findings

## Executive Summary
For Scout to reliably scrape Google search results for "[industry] greensboro nc" queries using Puppeteer, here are the key findings and actionable recommendations.

---

## 1. ESSENTIAL LIBRARIES & TOOLS

### Core Stack
- **puppeteer** (official): High-level API to control Chrome/Chromium
  - Install: `npm install puppeteer` (auto-downloads Chrome)
  - Alternative: `npm install puppeteer-core` (no Chrome download, use existing)

### Anti-Detection (CRITICAL for Google)
- **puppeteer-extra**: Plugin framework for extending Puppeteer
  - GitHub: https://github.com/berstend/puppeteer-extra
  - Install: `npm install puppeteer-extra`

- **puppeteer-extra-plugin-stealth**: ESSENTIAL for avoiding bot detection
  - Makes browser automation undetectable by:
    - Removing `navigator.webdriver` flag
    - Fixing Chrome/Headless-specific JS properties
    - Spoofing user agent correctly
    - Hiding automation traces in permissions, plugins, etc.
  - Install: `npm install puppeteer-extra-plugin-stealth`

### Basic Implementation Pattern
```javascript
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Apply stealth plugin BEFORE launching browser
puppeteer.use(StealthPlugin());

const browser = await puppeteer.launch({
  headless: 'new', // or true for old headless mode
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled'
  ]
});
```

---

## 2. GOOGLE-SPECIFIC CONFIGURATION

### Browser Launch Arguments (Anti-Detection)
```javascript
const browser = await puppeteer.launch({
  headless: 'new', // Use 'new' headless mode (less detectable)
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled', // CRITICAL
    '--disable-features=IsolateOrigins,site-per-process',
    '--disable-site-isolation-trials',
    '--disable-web-security',
    '--disable-dev-shm-usage', // For Docker/limited memory
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--window-size=1920,1080',
    '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  ],
  ignoreHTTPSErrors: true
});
```

### Page Configuration
```javascript
const page = await browser.newPage();

// Set realistic viewport
await page.setViewport({
  width: 1920,
  height: 1080,
  deviceScaleFactor: 1
});

// Set user agent (must match Chrome version)
await page.setUserAgent(
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
);

// Set extra HTTP headers
await page.setExtraHTTPHeaders({
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
});

// Block unnecessary resources to speed up (optional)
await page.setRequestInterception(true);
page.on('request', (req) => {
  if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
    req.abort();
  } else {
    req.continue();
  }
});
```

---

## 3. GOOGLE SEARCH SCRAPING PATTERN

### URL Construction
```javascript
function buildGoogleSearchUrl(query, location = '') {
  const params = new URLSearchParams({
    q: query,
    gl: 'us', // country
    hl: 'en', // language
    num: 100  // results per page (max)
  });
  
  if (location) {
    params.append('near', location);
  }
  
  return `https://www.google.com/search?${params.toString()}`;
}

// Example: "photographers greensboro nc"
const url = buildGoogleSearchUrl('photographers greensboro nc');
```

### Navigation & Waiting
```javascript
// Navigate to search results
await page.goto(url, {
  waitUntil: 'networkidle2', // Wait until network is mostly idle
  timeout: 30000
});

// Add random human-like delay
await page.waitForTimeout(1000 + Math.random() * 2000);

// Wait for search results to load
await page.waitForSelector('#search', { timeout: 10000 });
```

### Scraping Results
```javascript
// Extract organic search results
const results = await page.evaluate(() => {
  const items = [];
  
  // Google's organic result selector (may change!)
  const resultElements = document.querySelectorAll('#search .g');
  
  resultElements.forEach((el) => {
    const titleEl = el.querySelector('h3');
    const linkEl = el.querySelector('a');
    const snippetEl = el.querySelector('.VwiC3b'); // Description snippet
    
    if (titleEl && linkEl) {
      items.push({
        title: titleEl.textContent,
        link: linkEl.href,
        snippet: snippetEl ? snippetEl.textContent : '',
        position: items.length + 1
      });
    }
  });
  
  return items;
});

console.log(`Found ${results.length} results`);
```

---

## 4. RATE LIMITING & ANTI-BAN STRATEGIES

### Request Pacing
```javascript
// Add random delays between searches (CRITICAL)
function randomDelay(min = 2000, max = 5000) {
  return new Promise(resolve => 
    setTimeout(resolve, min + Math.random() * (max - min))
  );
}

// Between searches
for (const query of queries) {
  const results = await searchGoogle(query);
  await randomDelay(3000, 7000); // 3-7 second gaps
}
```

### Session Management
```javascript
// Rotate user agents
const userAgents = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36...',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36...'
];

// Pick random UA per session
const ua = userAgents[Math.floor(Math.random() * userAgents.length)];
await page.setUserAgent(ua);

// Consider: Create new browser context every N searches
if (searchCount % 10 === 0) {
  await context.close();
  context = await browser.createIncognitoBrowserContext();
}
```

### IP Rotation (Advanced)
```javascript
// If using proxy service
const browser = await puppeteer.launch({
  args: [
    `--proxy-server=http://proxy-server:port`,
    // ... other args
  ]
});

// Or consider services like:
// - BrightData (formerly Luminati)
// - Oxylabs
// - ScraperAPI (handles proxies + anti-detection)
```

### Request Volume Guidelines
- **Conservative**: 5-10 searches per hour per IP
- **Moderate**: 20-30 searches per hour with delays
- **Aggressive**: 50+ per hour (high ban risk without proxies)

**For Scout's use case (research mode):**
- Batch searches by industry
- 5-10 second delays between searches
- Rotate user agents every session
- Limit to 20-30 searches per session
- Use new incognito context every 10 searches

---

## 5. COMMON PITFALLS & SOLUTIONS

### Pitfall #1: Google CAPTCHA
**Problem**: Google detects automation and shows CAPTCHA
**Solutions**:
- ✅ Use `puppeteer-extra-plugin-stealth`
- ✅ Add realistic delays (3-7 seconds between searches)
- ✅ Randomize mouse movements/scrolling
- ✅ Use residential proxies if needed
- ❌ DON'T: Run headless with default settings
- ❌ DON'T: Make rapid-fire requests

### Pitfall #2: Selector Changes
**Problem**: Google frequently changes HTML structure
**Solutions**:
- ✅ Use multiple fallback selectors
- ✅ Log when selectors fail for debugging
- ✅ Add error handling
```javascript
async function extractResults(page) {
  return await page.evaluate(() => {
    // Try multiple selectors
    const selectors = [
      '#search .g',
      '.g',
      '[data-sokoban-container]'
    ];
    
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        // Extract from elements...
        return extractFromElements(elements);
      }
    }
    
    return []; // Fallback
  });
}
```

### Pitfall #3: Memory Leaks
**Problem**: Long-running scraper consumes all memory
**Solutions**:
- ✅ Close pages after use: `await page.close()`
- ✅ Use browser contexts: `await context.close()`
- ✅ Restart browser every N iterations
```javascript
let browser;
for (let i = 0; i < queries.length; i++) {
  if (i % 50 === 0) {
    if (browser) await browser.close();
    browser = await puppeteer.launch({...config});
  }
  // ... search logic
}
```

### Pitfall #4: Timeout Errors
**Problem**: Page doesn't load in time
**Solutions**:
```javascript
try {
  await page.goto(url, {
    waitUntil: 'networkidle2',
    timeout: 30000
  });
} catch (error) {
  if (error.name === 'TimeoutError') {
    // Try with less strict wait condition
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });
  } else {
    throw error;
  }
}
```

### Pitfall #5: Detection via Browser Fingerprinting
**Problem**: Google detects headless Chrome fingerprint
**Solutions**:
- ✅ Use `puppeteer-extra-plugin-stealth` (handles most)
- ✅ Set realistic viewport sizes (1920x1080, 1366x768)
- ✅ Enable JavaScript (obviously)
- ✅ Set proper timezone
```javascript
await page.emulateTimezone('America/New_York');
```

---

## 6. COMPLETE WORKING EXAMPLE FOR SCOUT

```javascript
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function searchGoogleForLeads(industry, location = 'greensboro nc') {
  const query = `${industry} ${location}`;
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080'
    ]
  });
  
  try {
    const page = await browser.newPage();
    
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=50`;
    
    console.log(`Searching: ${query}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Human-like delay
    await page.waitForTimeout(2000 + Math.random() * 3000);
    
    // Extract results
    const results = await page.evaluate(() => {
      const items = [];
      const resultElements = document.querySelectorAll('#search .g');
      
      resultElements.forEach((el) => {
        const titleEl = el.querySelector('h3');
        const linkEl = el.querySelector('a');
        const snippetEl = el.querySelector('.VwiC3b');
        
        if (titleEl && linkEl) {
          items.push({
            title: titleEl.textContent.trim(),
            url: linkEl.href,
            snippet: snippetEl ? snippetEl.textContent.trim() : '',
            domain: new URL(linkEl.href).hostname
          });
        }
      });
      
      return items;
    });
    
    console.log(`Found ${results.length} results`);
    return results;
    
  } finally {
    await browser.close();
  }
}

// Usage
(async () => {
  const industries = ['photographers', 'real estate agents', 'dentists'];
  
  for (const industry of industries) {
    const leads = await searchGoogleForLeads(industry);
    console.log(`${industry}:`, leads.slice(0, 5)); // Show first 5
    
    // CRITICAL: Wait between searches
    await new Promise(r => setTimeout(r, 5000 + Math.random() * 5000));
  }
})();
```

---

## 7. RECOMMENDED APPROACH FOR SCOUT

### Architecture
1. **Input**: List of industries to research
2. **Process**:
   - Launch browser with stealth plugin
   - For each industry:
     - Search "[industry] greensboro nc"
     - Extract business names, URLs, snippets
     - Wait 5-10 seconds
   - Close browser every 10-15 searches
3. **Output**: Structured lead data (name, URL, snippet, domain)

### File Structure
```
scout/
├── src/
│   ├── scrapers/
│   │   ├── google-search.js      # Core scraping logic
│   │   └── config.js              # Browser config
│   ├── utils/
│   │   ├── delays.js              # Random delay helpers
│   │   └── selectors.js           # Fallback selector patterns
│   └── index.js                   # Main entry point
├── package.json
└── .env                           # Config (proxy, etc.)
```

### Error Handling Strategy
```javascript
async function safeSearch(query, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await searchGoogle(query);
    } catch (error) {
      console.error(`Attempt ${i + 1} failed:`, error.message);
      
      if (error.message.includes('captcha')) {
        console.log('CAPTCHA detected - stopping batch');
        throw error;
      }
      
      if (i < retries - 1) {
        // Exponential backoff
        await new Promise(r => setTimeout(r, Math.pow(2, i) * 5000));
      }
    }
  }
  throw new Error(`Failed after ${retries} attempts`);
}
```

---

## 8. MONITORING & DEBUGGING

### Check for Detection
```javascript
// Add detection check before scraping
async function checkIfBlocked(page) {
  const content = await page.content();
  
  const blockedPhrases = [
    'unusual traffic',
    'automated requests',
    'captcha',
    'verify you\'re not a robot'
  ];
  
  for (const phrase of blockedPhrases) {
    if (content.toLowerCase().includes(phrase)) {
      console.warn(`⚠️ Possible block detected: ${phrase}`);
      return true;
    }
  }
  
  return false;
}

// Before scraping
if (await checkIfBlocked(page)) {
  throw new Error('Google blocking detected');
}
```

### Screenshot on Error
```javascript
try {
  await page.goto(url, { waitUntil: 'networkidle2' });
} catch (error) {
  await page.screenshot({ path: `error-${Date.now()}.png` });
  throw error;
}
```

---

## 9. ALTERNATIVES TO CONSIDER

### If Bot Detection Becomes Unmanageable:
1. **SerpAPI** - Paid API for Google scraping ($50-150/mo)
   - Handles all anti-bot for you
   - Structured JSON output
   - Rate limits built-in

2. **ScraperAPI** - Proxy + anti-detection service
   - Handles browser fingerprinting
   - Auto-rotates proxies
   - Pay per successful request

3. **Apify** - Pre-built Google Search actors
   - Managed scraping infrastructure
   - Cloud execution
   - Cost: ~$0.10 per 1000 searches

**Recommendation**: Start with puppeteer-extra-plugin-stealth. If blocked repeatedly, consider SerpAPI for production.

---

## 10. KEY TAKEAWAYS FOR SCOUT

✅ **DO**:
- Use `puppeteer-extra` with `stealth` plugin
- Add 5-10 second delays between searches
- Rotate user agents periodically
- Close browser/contexts regularly
- Monitor for CAPTCHA/blocking
- Start with small batches (10-20 searches)

❌ **DON'T**:
- Use vanilla Puppeteer without stealth plugin
- Make rapid requests (instant ban)
- Ignore timeout errors (means detection)
- Run 24/7 without rate limiting
- Use same browser session for 100+ searches

📊 **Performance Expectations**:
- Scraping speed: ~5-10 searches per minute (safe)
- Success rate: 90%+ with proper config
- Detection risk: Low if delays observed

🚨 **Red Flags**:
- CAPTCHA appearing = slow down immediately
- Empty results repeatedly = possible soft ban
- Timeout errors = change user agent / restart browser

---

## CONCLUSION

Puppeteer + stealth plugin is viable for Scout's "[industry] greensboro nc" research, PROVIDED:
1. Reasonable request pacing (5-10 sec delays)
2. Proper anti-detection configuration
3. Monitoring for blocks
4. Graceful fallback strategy

Start conservative, monitor results, scale slowly.
