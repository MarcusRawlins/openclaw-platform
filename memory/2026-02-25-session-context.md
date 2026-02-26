# Session Context — Feb 25, 2026 (for restart recovery)

## What Happened Today (in order)

### 1. Local Vision Model Setup
- Tyler loaded **qwen3-vl-8b** in LM Studio (Mac mini M4 24GB)
- Best local vision model for his hardware
- Ada should use this for all image description tasks

### 2. Instagram Caption (Church Exits Carousel)
- 8 images, all church ceremony exits
- Tyler heavily edited Ada's draft — became the gold standard
- **Caption-voice skill updated** with 6 lessons from Tyler's feedback
- **BRAND-VOICE.md updated** — "what we're here for" → "what we love capturing"
- Text overlays finalized: "Documentary Wedding Photography" / "Beautiful Chaos" / "We let it unfold"

### 3. Blog Publishing Pipeline
- Ada fixed all 7 engagement session blogs (SEO, word count 500-600, structure)
- Walt reviewed: 3 passed, 4 needed minor fixes → Ada fixed → Walt re-reviewed → ALL 7 PASSED
- **Process rule**: When Walt passes, Marcus moves forward automatically. Don't ask Tyler.

### 4. WordPress Publishing Script (MAJOR BUILD)
- Location: `/Users/marcusrawlins/.openclaw/skills/wordpress-publish/publish.js`
- **Puppeteer browser automation** for WordPress Gutenberg
- ~10 iterations to get all 7 metadata fields working
- Key technical discoveries documented in memory/2026-02-25.md
- **All fields working**: Title, Content, Category, Focus Keyphrase, Meta Description, Excerpt, Slug
- Category configurable via frontmatter; unchecks default "Weddings"
- Script is production-ready, syntax-checked

### 5. Alt Text Automation (IN PROGRESS)
- Built `set-alt-text.js` (Media Library approach)
- Ada spawned to regenerate alt-text.json for Britton Manor with qwen3-vl-8b (69 images)
- **Problem**: Ada renamed files but alt-text.json still has OLD filenames — needs regeneration
- Tyler uploaded Britton Manor images to WordPress for testing
- **Status**: Waiting for Ada to finish vision model alt text, then test set-alt-text.js

### 6. AnselAI Integration Plan (NEEDS PRD)
- Tyler wants AnselAI CRM to pull real data from:
  - Instagram/Meta (Graph API): engagement, followers, audience, stories, ads
  - Google Analytics 4: website traffic, blog perf, conversions (creds in .env)
  - Google Ads: spend, clicks, conversions
  - Google Business Profile: reviews, search visibility
  - Meta Ads: spend, impressions, CTR, CPM, ROI
  - TikTok: content metrics, audience, ads
- Architecture: Cron sync → PostgreSQL → unified dashboard
- Build phases: 1) Foundation 2) Google (creds exist) 3) Meta/IG 4) TikTok 5) Dashboard
- **ACTION NEEDED**: Write formal PRD to docs/ANSELAI-INTEGRATION-PRD.md
- AnselAI not yet running, architecture at docs/ANSELAI-ARCHITECTURE.md

## Active Subagents
- ada-alt-text-vision-britton-manor: generating alt text with qwen3-vl-8b (may still be running)

## Test Draft Cleanup Needed
- WordPress posts 4547-4568 are all test drafts from script iterations
- Need to delete before final production run of all 7 blogs

## Key Files
- WordPress publish script: `/Users/marcusrawlins/.openclaw/skills/wordpress-publish/publish.js`
- Alt text script: `/Users/marcusrawlins/.openclaw/skills/wordpress-publish/set-alt-text.js`
- WordPress workflow: `/Users/marcusrawlins/.openclaw/agents/ada/WORDPRESS-PUBLISHING-WORKFLOW.md`
- Ada's lessons: `/Users/marcusrawlins/.openclaw/agents/ada/lessons.md` (29+ entries, needs archiving)
- Caption skill updates: `/Users/marcusrawlins/.openclaw/skills/caption-voice/SKILL.md`
- Daily notes: `/Users/marcusrawlins/.openclaw/workspace/memory/2026-02-25.md`
- AnselAI architecture: `/Users/marcusrawlins/.openclaw/workspace/docs/ANSELAI-ARCHITECTURE.md`
