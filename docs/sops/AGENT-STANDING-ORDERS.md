# Agent Standing Orders

## Overview
Each agent has recurring work that runs on cron schedules. Walt Deming is the quality gate: all finished work goes to him for review before it reaches Marcus or Tyler.

## Pipeline Flow
```
Agent finishes work → Walt reviews
  → PASS → Marcus notified → Tyler approves
  → PASS WITH NOTES → Marcus notified (with notes) → Tyler approves
  → NEEDS REVISION → Back to agent with specific feedback → Agent fixes → Walt re-reviews

Scout (research) → Walt (review) → Ed (outreach drafts) → Walt (review) → Marcus → Tyler
Ada (content) → Walt (review) → Marcus → Tyler (approve/publish)
Dewey (data maintenance) → Walt (spot-checks) → escalates issues to Marcus
Brunel (builds) → Walt (code review) → Marcus → Tyler (approve/deploy)
```

## Quality Gate: Walt Deming
- **Model:** Claude Sonnet 4.5
- **Role:** Reviews ALL agent output before it moves forward
- **Reviews saved to:** `/Users/marcusrawlins/.openclaw/workspace/reviews/`
- **Grades:** PASS, PASS WITH NOTES, NEEDS REVISION
- **Escalates to Marcus:** Architecture questions, judgment calls, repeated failures
- **Marcus reviews Walt:** Periodically to ensure standards aren't drifting

## Scout Pinkerton — Research & Intelligence
**Schedule:** Monday, Wednesday, Friday at 9:00 AM ET
**Standing brief:**
1. Find 5 local service businesses (HVAC, plumbing, auto repair, restaurants, landscaping, dental, etc.) that have bad/outdated websites or no web presence. Focus on NC/VA/DC metro area.
2. For each lead: business name, owner if findable, website (or lack thereof), Google rating, what's wrong with their current site, and a one-line value prop for R3 Studios.
3. Save findings to `/Volumes/reeseai-memory/photography/leads/daily/YYYY-MM-DD.json`
4. Also check: any new golf courses or golf-related businesses that could use ZipGolf.

**Schedule:** Sunday at 10:00 AM ET
**Standing brief:**
1. Wedding photography competitor analysis: check top 5 competitors' recent blog posts, social media, pricing changes.
2. Save weekly intel to `/Users/marcusrawlins/.openclaw/workspace/memory/scout-intel-YYYY-MM-DD.md`

## Ed Adler — Outreach & Messaging
**Schedule:** Tuesday, Thursday at 10:00 AM ET
**Standing brief:**
1. Check Scout's latest lead files in `/Volumes/reeseai-memory/photography/leads/daily/`
2. For each new qualified lead, draft a personalized cold email (150 words max) + 2 follow-ups
3. Save drafts to `/Volumes/reeseai-memory/photography/outreach/cold-emails/YYYY-MM-DD/`
4. Report summary to Marcus for review

## Ada Hypatia — Content & Resources
**Schedule:** Monday at 9:00 AM ET
**Standing brief (blog):**
1. Draft one SEO-optimized blog post for By The Reeses (800-1200 words)
2. Topics rotate: wedding planning tips, behind-the-scenes, vendor spotlights, seasonal guides
3. Save to `/Users/marcusrawlins/.openclaw/workspace/content/blog/drafts/YYYY-MM-DD.md`

**Schedule:** Wednesday at 9:00 AM ET
**Standing brief (social):**
1. Create a week's worth of social media captions (5 posts: 3 Instagram, 2 stories concepts)
2. Save to `/Users/marcusrawlins/.openclaw/workspace/content/social/YYYY-MM-DD.md`

**Schedule:** 1st of each month at 9:00 AM ET
**Standing brief (resource):**
1. Create or update one downloadable resource (wedding timeline template, vendor checklist, planning guide, etc.)
2. Save to `/Users/marcusrawlins/.openclaw/workspace/content/resources/`

## Dewey Paul — Data & Organization
**Schedule:** Daily at 6:00 AM ET
**Standing brief:**
1. Check for new files in common ingest locations
2. Update reese-catalog.db with any new entries
3. Flag duplicates or files needing attention
4. Log work to `/Users/marcusrawlins/.openclaw/workspace/memory/dewey-log-YYYY-MM-DD.md`

## Brunel Edison — Builder
**Schedule:** No recurring cron. Works from backlog on assignment.
**Backlog location:** `/Users/marcusrawlins/.openclaw/workspace/docs/BUILD-BACKLOG.md`
**Current priorities:**
1. AnselAI (Photography CRM) — primary project
2. ZipGolf feature development
3. R3 Studios demo sites for qualified prospects
4. Mission Control improvements
5. Internal tooling

## Walt Deming — Quality Reviewer
**Schedule:** Daily at 5:00 PM ET (code review) + Tuesday/Friday at 4:00 PM ET (team output review)
**Reviews saved to:** `/Users/marcusrawlins/.openclaw/workspace/reviews/`

**Daily (5pm):** Review Brunel's latest AnselAI code against the architecture spec. Check build, design consistency, bugs, security.

**Tue/Fri (4pm):** Review all other agent output: Scout's leads, Ed's outreach, Ada's content, Dewey's logs. Grade each.

**Ad-hoc:** When Marcus routes finished work to Walt directly (via spawn), review immediately and report back.

**Grading:**
- PASS → Work moves forward to Marcus/Tyler
- PASS WITH NOTES → Moves forward with suggestions for next time
- NEEDS REVISION → Specific feedback sent back to the agent, agent fixes and resubmits
