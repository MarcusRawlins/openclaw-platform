# Implementation Roadmap
**Author:** Marcus Rawlins
**Date:** 2026-02-24
**Status:** Active. This is the master build plan.

---

## Overview

81 tasks across 6 workstreams. This document defines the architecture, dependencies, and execution order for everything queued.

---

## Workstream 1: Infrastructure Foundation
**Why first:** Everything else depends on these.

### 1A: Telegram Group Topics
**Owner:** Marcus | **Effort:** 1 hour | **Dependencies:** None

**Architecture:**
- Create a Telegram supergroup: "Reese Operations"
- Topics:
  - **General** — Direct chat with Tyler (default)
  - **CRM / Pipeline** — Lead updates, client comms, pipeline changes
  - **Knowledge Base** — Saved articles, research, extracted insights
  - **Cron Updates** — All scheduled job outputs
  - **Daily Briefing** — Morning news recap (wedding, tech, investing)
  - **Content Ideas** — Blog, video, social content pipeline
  - **System / Errors** — Build logs, error reports, health checks
  - **Financial** — Revenue tracking, cost reports, budget alerts
- Update gateway config: route agent outputs to appropriate topics
- Each topic maintains its own context window → better memory per domain

### 1B: Enable Search APIs
**Owner:** Marcus | **Effort:** 30 min | **Dependencies:** None

**Architecture:**
- Enable Brave Search in gateway config (key already exists)
- Verify Tavily API key works: `curl -X POST https://api.tavily.com/search`
- Verify SerpAPI key works: `curl "https://serpapi.com/search?api_key=$KEY&q=test"`
- Document rate limits and free tier caps in TOOLS.md
- These power: lead-scout, trend-watch, morning briefing

### 1C: Local Embeddings + Vector Search
**Owner:** Brunel | **Effort:** 4-6 hours | **Dependencies:** None

**Architecture:**
```
/Volumes/reeseai-memory/data/knowledge-base/
├── inventory.json              (file catalog)
├── knowledge-synthesis-report.md (Scout's analysis)
├── embeddings/
│   ├── knowledge.db            (SQLite + vector columns)
│   └── nomic-embed/            (local model cache)
└── scripts/
    ├── embed.py                (batch embed all extracted content)
    ├── search.py               (semantic search CLI)
    └── index.py                (rebuild index on demand)
```

**Technical spec:**
- Use Nomic Embed Text v1.5 (already in LM Studio: `text-embedding-nomic-embed-text-v1.5`)
- SQLite database with vector columns (use sqlite-vss or roll custom with numpy)
- Embed all 194 `.extracted.md` files + all `.transcript.md` files
- Chunk strategy: 500 tokens per chunk, 50 token overlap
- Store: chunk text, source file path, category, embedding vector
- Search CLI: `python3 search.py "Instagram SEO strategies"` → returns top 5 matches with source files
- Agent integration: any agent can shell out to search.py to query the knowledge base

**Why this matters:** Without this, 269 files of extracted knowledge are unsearchable. With it, any agent can ask a question and get instant, relevant answers.

### 1D: Comprehensive Logging
**Owner:** Brunel | **Effort:** 3-4 hours | **Dependencies:** None

**Architecture:**
```
/Users/marcusrawlins/.openclaw/logs/
├── events.jsonl        (append-only event log)
├── errors.jsonl        (filtered error log)
├── llm-usage.jsonl     (every LLM call: model, tokens, cost, latency)
└── events.db           (SQLite mirror for querying)
```

**Event schema:**
```json
{
  "ts": "ISO-8601",
  "type": "error|llm_call|api_call|cron_run|agent_spawn|task_update",
  "agent": "marcus|brunel|scout|...",
  "model": "anthropic/claude-sonnet-4-5",
  "tokens_in": 1000,
  "tokens_out": 500,
  "cost_usd": 0.003,
  "latency_ms": 2500,
  "details": "free-form context",
  "error": "stack trace if applicable"
}
```

**Log rotation:** Keep 7 days in JSONL, archive older to monthly files
**Morning routine:** Cron at 7:30 AM scans last 24h of errors, reports issues

---

## Workstream 2: Skills Development
**Why second:** Skills are the tools agents use. Better skills = better output.

### 2A: Enhance Existing Voice Skills with Extracted Knowledge
**Owner:** Marcus | **Effort:** 4-6 hours | **Dependencies:** Knowledge base complete

**What gets updated:**

**blog-voice:**
- Add SEO fundamentals from Marketing Lab (keyword research, on-page optimization)
- Add topic-first blogging strategy (blog for search intent, not diary entries)
- Add content repurposing pyramid (1 blog post → 25+ social assets)
- Reference: `/Volumes/reeseai-memory/photography/resources/courses/the-marketing-lab/`

**caption-voice:**
- Add Instagram SEO formula from the 32K word transcript
- Profile optimization: name field as keyword, bio as value prop
- Caption structure: hook → story → CTA → hashtag strategy
- Reference: `/Volumes/reeseai-memory/photography/resources/courses/the-marketing-lab/phase2_instagram/`

**email-voice:**
- Add the 19 email templates documented in Scout's report
- Add follow-up sequence timing (day 1, 3, 7, 14, 30)
- Add scoring rubric concepts for inbound email classification
- Reference: `/Volumes/reeseai-memory/photography/resources/templates/email-templates/`

**web-copy-voice:**
- Add CRO landing page strategies from Marketing Lab
- High-converting page structure: hero → social proof → features → testimonials → CTA
- Reference: `/Volumes/reeseai-memory/photography/resources/courses/the-marketing-lab/phase4_cro/`

**New: client-workflow skill:**
- 6 CRM workflows from Scout's synthesis:
  1. Lead response (< 5 min auto-reply, qualification questions, follow-up sequence)
  2. Consultation booking (calendar link, prep questionnaire, reminder sequence)
  3. Booking to contract (proposal generation, contract signing, deposit collection)
  4. Pre-wedding coordination (timeline creation, vendor coordination, shot list)
  5. Post-wedding delivery (sneak peeks, gallery delivery, album design)
  6. Review collection (timing, platform targeting, follow-up nudges)

### 2B: Build lead-scout Skill
**Owner:** Brunel | **Effort:** 4-6 hours | **Dependencies:** Search APIs enabled (1B)

**Architecture:**
```
skills/lead-scout/
├── SKILL.md              (skill definition)
├── scripts/
│   ├── search.py         (multi-source business search)
│   ├── score.py          (lead quality scoring)
│   └── report.py         (formatted lead reports)
└── templates/
    └── lead-card.md      (structured lead output)
```

**How it works:**
1. Takes: industry, location, radius, and business type
2. Searches: Tavily + SerpAPI + Brave (rotate to stay in free tiers)
3. For each business found:
   - Check if they have a website (score: no site = hot lead for R3)
   - Check website quality (mobile responsive? modern? SSL?)
   - Check Google reviews (count + rating)
   - Check social presence (Instagram, Facebook)
4. Scores each lead 0-100 on: need (no/bad website), size (review count), accessibility (public contact info), location
5. Outputs structured lead cards with all data

**Two modes:**
- **R3 Studios mode:** Find businesses needing websites/SaaS
- **Photography mode:** Find venues, planners, vendors for partnerships

### 2C: Build trend-watch Skill
**Owner:** Brunel | **Effort:** 4-6 hours | **Dependencies:** Search APIs enabled (1B)

**Architecture:**
```
skills/trend-watch/
├── SKILL.md
├── scripts/
│   ├── sources.py        (RSS + API source manager)
│   ├── fetch.py          (content fetcher)
│   ├── digest.py         (compile daily digest)
│   └── sources.json      (configured news sources)
└── templates/
    └── daily-brief.md    (morning briefing template)
```

**Sources by domain:**

**Wedding Industry:**
- PetaPixel RSS feed
- Rangefinder Magazine RSS
- The Knot blog
- WeddingWire blog
- r/WeddingPhotography (Reddit via web_fetch)
- Google Alerts: "wedding photography trends 2026"

**Tech World:**
- Hacker News top stories (API, free)
- TechCrunch RSS
- The Verge RSS
- Ars Technica RSS
- r/artificial, r/LocalLLaMA (Reddit)
- YouTube trending: AI, programming (YouTube Data API free tier)

**Investing:**
- Yahoo Finance RSS
- Seeking Alpha RSS
- r/investing, r/stocks (Reddit)
- Google Finance API (free)

**How it works:**
1. Cron runs at 6:00 AM EST
2. Fetches last 24h from all sources
3. Deduplicates and filters noise
4. Ranks by relevance to Tyler's interests (photography, AI/tech, SaaS, investing)
5. Compiles morning digest with: top 3 stories per domain, trend signals, action items
6. Delivers to Telegram Daily Briefing topic

### 2D: Build social-monitor Skill
**Owner:** Brunel | **Effort:** 4-6 hours | **Dependencies:** Search APIs enabled (1B)

**Architecture:**
```
skills/social-monitor/
├── SKILL.md
├── scripts/
│   ├── twitter.py        (X/Twitter monitoring via web_fetch)
│   ├── instagram.py      (Instagram monitoring via web_fetch)
│   ├── youtube.py        (YouTube via Data API)
│   ├── tiktok.py         (TikTok via web_fetch)
│   └── report.py         (compile social report)
└── data/
    └── tracking.json     (what to monitor)
```

**What it monitors:**
- Own accounts: follower growth, engagement rates, post performance
- Competitors: top wedding photographers in NC/SE region
- Industry hashtags: #weddingphotography, #ncwedding, #documentarywedding
- Trending audio/formats on Reels/TikTok (content opportunities)
- Mentions of "By The Reeses" or "R3 Studios" anywhere

**How it works:**
- Browser automation for platforms without APIs (Instagram, TikTok)
- YouTube Data API for YouTube monitoring
- web_fetch for Twitter/X public pages
- Daily report compiled and sent to Content Ideas topic

### 2E: Email Scoring Pipeline for Ed
**Owner:** Brunel | **Effort:** 4-6 hours | **Dependencies:** None

**Architecture:**
```
skills/email-scorer/
├── SKILL.md
├── scripts/
│   ├── score.py          (rubric-based scoring)
│   ├── research.py       (sender/company research)
│   └── draft.py          (context-aware reply drafting)
├── rubric.json           (editable scoring rubric)
└── templates/
    ├── qualify.md         (qualification questions template)
    ├── decline.md         (polite decline template)
    └── escalate.md        (escalation notification template)
```

**Scoring rubric (5 dimensions, 100 points total):**
- **Fit** (25pts): Does this person/company align with our services?
- **Clarity** (20pts): Clear ask, timeline, deliverables stated?
- **Budget Signal** (20pts): Budget mentioned? Realistic range?
- **Seriousness** (20pts): Specific dates? Venue booked? Referral source?
- **Trust** (15pts): Real person? Verifiable company? Not spam?

**Score tiers:**
- 80-100 Exceptional → Escalate to Tyler immediately
- 60-79 High → Queue for Tyler, not urgent
- 40-59 Medium → Auto-send qualification questions
- 20-39 Low → Polite decline with referral suggestions
- 0-19 Spam → Ignore, log for pattern detection

**Ed's workflow:**
1. Scan inbox every 10 min (cron)
2. New email → quarantine → security scan
3. Score with rubric
4. Research sender (Google the person/company)
5. Draft context-aware response
6. Route based on score tier
7. Low confidence? → Ping Tyler in Telegram for review

---

## Workstream 3: Automation & Cron Jobs
**Why third:** Automations need skills and infrastructure in place first.

### 3A: Daily Morning Briefing
**Owner:** Marcus | **Effort:** 1 hour | **Dependencies:** trend-watch skill (2C)

**Cron spec:**
- Schedule: 7:00 AM EST daily
- Model: lmstudio/gemma-3-12b-it (zero cost)
- Delivery: Telegram → Daily Briefing topic
- Content: trend-watch output formatted as morning brief

**Template:**
```
☀️ Morning Brief — [Date]

🎯 WEDDING WORLD
• [Top 3 stories/trends]

💻 TECH WORLD
• [Top 3 stories/trends]

📈 INVESTING
• [Top 3 stories/trends]

🔥 ACTION ITEMS
• [Anything Tyler should look at today]

💡 TREND SIGNALS
• [Emerging patterns worth watching]
```

### 3B: Nightly Councils
**Owner:** Marcus | **Effort:** 2-3 hours | **Dependencies:** Logging system (1D)

**Three crons, staggered:**

**1:00 AM — Security Council**
- Scan file permissions on sensitive dirs
- Check gateway config for exposed secrets
- Verify API keys still valid
- Check for unauthorized access attempts in logs
- Report: clean pass or alert with specifics

**2:00 AM — Platform Council**
- Check all cron job health (last run, failures)
- Scan for prompt drift across agent files
- Check MC is running and responsive
- Check LM Studio is running
- Check disk usage on reeseai-memory
- Report: system health scorecard

**3:00 AM — Innovation Scout**
- Search web for "OpenClaw" + recent use cases
- Check Matt Berman's channel for new videos
- Check r/LocalLLaMA for relevant model releases
- Compare findings to our current setup
- Report: ideas worth implementing (if any)

### 3C: Notification Batching
**Owner:** Brunel | **Effort:** 3-4 hours | **Dependencies:** Telegram topics (1A)

**Architecture:**
- Intercept all outbound Telegram messages
- Classify by priority: Critical / High / Medium / Low
- Critical → send immediately (errors, security alerts, Tyler's direct requests)
- High → batch hourly (CRM updates, task completions, cron failures)
- Medium → batch every 3 hours (routine updates, non-urgent notifications)
- Low → batch daily (stats, summaries, background work)
- Store all notifications in SQLite for querying

---

## Workstream 4: Data Completion
**Parallel work, lower priority.**

### 4A: Transcribe 3 Remaining Videos
**Owner:** Dewey | **Effort:** 2-3 hours | **Dependencies:** None

- Blogging automation workflow (381MB)
- Instagram content generation full process (702MB)
- Conversion rate optimization complete (256MB)
- Use Whisper locally, extract audio first with ffmpeg

### 4B: OCR 12 Image-Heavy PDFs
**Owner:** Dewey | **Effort:** 2-3 hours | **Dependencies:** None

- 9 email templates (high priority — unlock client communication improvements)
- Ideal client persona worksheet
- Instagram featuring accounts guide
- Senior Portrait Posing Guide (39MB)
- Use Gemma 3 12B vision or mistral-ocr skill

### 4C: Fix Scout's Synthesis Report
**Owner:** Scout | **Effort:** 1-2 hours | **Dependencies:** Walt's review

- Correct inflated word counts (re-measure with wc -w)
- Verify all file paths
- Standardize OCR count (resolve 9 vs 12 discrepancy)
- Add source citations for key claims
- Add missed opportunities from Walt's review

---

## Workstream 5: AnselAI CRM
**Depends on Workstreams 1-2.**

### 5A: Build Foundation (Phase 1 from existing architecture)
**Owner:** Brunel | **Effort:** 8-12 hours | **Dependencies:** Knowledge base searchable (1C)

- Next.js + PostgreSQL + Prisma, port 3200
- Architecture already documented: `docs/ANSELAI-ARCHITECTURE.md`
- Implement the 6 client workflows from Scout's synthesis
- Connect to knowledge base for template/workflow suggestions
- Integrate email scoring pipeline

---

## Workstream 6: Content & Marketing
**Depends on skills being enhanced.**

### 6A: Instagram SEO Optimization
**Owner:** Tyler (with Marcus support) | **Effort:** 30 min

- Implement findings from extracted Instagram transcript
- Profile name → keyword-rich
- Bio → value proposition with CTA
- Caption formula from caption-voice skill

### 6B: Google Business Profile
**Owner:** Tyler (with Marcus support) | **Effort:** 2-3 hours

- Claim/optimize GBP
- Upload portfolio images
- Request first reviews
- Implement local SEO from Marketing Lab

### 6C: Email Marketing Setup
**Owner:** Tyler (with Ed support) | **Effort:** 4-6 hours

- Flodesk account setup
- Lead magnet creation (from extracted course materials)
- Opt-in form on website
- Welcome sequence (from email-voice templates)

---

## Execution Order

**Phase A (This Week):** Infrastructure + Quick Wins
1. ✅ Telegram Group Topics (1A) — 1 hour
2. ✅ Enable Search APIs (1B) — 30 min
3. ✅ Fix Scout's Report (4C) — 1-2 hours
4. 🔨 Local Embeddings (1C) — Brunel, 4-6 hours
5. 🔨 Enhance Voice Skills (2A) — Marcus, 4-6 hours

**Phase B (Next Week):** Skills + Automation
6. 🔨 Build trend-watch (2C) — Brunel, 4-6 hours
7. 🔨 Build lead-scout (2B) — Brunel, 4-6 hours
8. 🔨 Build social-monitor (2D) — Brunel, 4-6 hours
9. 🔨 Email Scoring Pipeline (2E) — Brunel, 4-6 hours
10. ✅ Morning Briefing Cron (3A) — Marcus, 1 hour
11. 🔨 Logging System (1D) — Brunel, 3-4 hours

**Phase C (Week After):** Automation + CRM
12. ✅ Nightly Councils (3B) — Marcus, 2-3 hours
13. 🔨 Notification Batching (3C) — Brunel, 3-4 hours
14. 🔨 Content Idea Pipeline — Brunel, 4-6 hours
15. 🔨 AnselAI Foundation (5A) — Brunel, 8-12 hours

**Phase D (Ongoing):** Data Completion + Marketing Execution
16. 🔨 Transcribe remaining videos (4A) — Dewey
17. 🔨 OCR remaining PDFs (4B) — Dewey
18. 👤 Instagram SEO optimization (6A) — Tyler
19. 👤 Google Business Profile (6B) — Tyler
20. 👤 Email marketing setup (6C) — Tyler + Ed

---

## Success Criteria

This roadmap is "done" when Tyler can:
1. Wake up to a morning briefing with wedding, tech, and investing news
2. Ask any agent "what do we know about [topic]?" and get instant answers from the knowledge base
3. See new leads auto-discovered and scored in the pipeline
4. Have inbound emails auto-classified and draft responses waiting
5. Create content using skills enhanced with real course knowledge
6. Monitor social media performance without manual checking
7. Track all agent work, errors, and costs in one place
8. Do all of this from his phone via Telegram topics

That's the finish line.
