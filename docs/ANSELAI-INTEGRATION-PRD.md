# AnselAI — Data Integration PRD
**Product Requirements Document**
**Date:** February 25, 2026
**Author:** Marcus Rawlins (Chief of Staff)
**Status:** Draft — Pending Tyler Review

---

## Overview

AnselAI is the photography CRM for By The Reeses. This PRD covers integrating real data from social media platforms, Google services, and advertising platforms to create a comprehensive business intelligence dashboard.

**Goal:** One place to see everything — content performance, ad spend, website traffic, lead sources, and ROI across all platforms.

---

## Current State

- **AnselAI:** Next.js + PostgreSQL + Prisma. Port 3200. Architecture defined, backend not yet built.
- **Existing Credentials:**
  - Google: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_ANALYTICS_PROPERTY_ID (in .env)
  - Instagram: INSTAGRAM_EMAIL, INSTAGRAM_PASSWORD (in .env)
  - TikTok: TIKTOK_EMAIL, TIKTOK_PASSWORD (in .env)
  - Twitter/X: TWITTER_EMAIL, TWITTER_PASSWORD (in .env)
- **Missing:** Facebook Developer App, Meta Business Suite access, TikTok Developer Account, Google Ads API credentials

---

## Platform Integrations

### 1. Instagram (via Meta Graph API)

**Auth:** Facebook Developer App → Instagram Business Account OAuth
**Endpoints:**
- `GET /me/media` — list posts
- `GET /{media-id}/insights` — post-level metrics
- `GET /me/insights` — account-level metrics
- `GET /me` — profile info, follower count

**Metrics to sync:**
| Metric | Level | Frequency |
|--------|-------|-----------|
| Followers count | Account | Daily |
| Follower growth | Account | Daily |
| Reach | Account/Post | Daily |
| Impressions | Account/Post | Daily |
| Profile visits | Account | Daily |
| Website clicks | Account | Daily |
| Likes | Post | Hourly |
| Comments | Post | Hourly |
| Saves | Post | Hourly |
| Shares | Post | Hourly |
| Story views | Story | Daily |
| Story exits | Story | Daily |
| Audience demographics | Account | Weekly |

**Setup Required:**
1. Create Facebook Developer App
2. Add Instagram Graph API product
3. Connect Instagram Business Account
4. Generate long-lived access token (60-day, auto-refresh)
5. Request permissions: instagram_basic, instagram_manage_insights, pages_show_list

---

### 2. Meta Ads (via Marketing API)

**Auth:** Same Facebook Developer App + Marketing API access
**Endpoints:**
- `GET /act_{ad-account-id}/campaigns` — campaign list
- `GET /act_{ad-account-id}/insights` — account-level performance
- `GET /{campaign-id}/insights` — campaign-level performance
- `GET /{adset-id}/insights` — ad set performance

**Metrics to sync:**
| Metric | Level | Frequency |
|--------|-------|-----------|
| Spend | Campaign/Account | Daily |
| Impressions | Campaign/Ad | Daily |
| Clicks | Campaign/Ad | Daily |
| CTR (click-through rate) | Campaign/Ad | Daily |
| CPC (cost per click) | Campaign/Ad | Daily |
| CPM (cost per 1000) | Campaign/Ad | Daily |
| Conversions | Campaign/Ad | Daily |
| ROAS | Campaign/Ad | Daily |
| Frequency | Campaign/Ad | Daily |
| Audience breakdown | Ad Set | Weekly |

**Setup Required:**
1. Meta Business Suite access
2. Ad Account ID
3. Marketing API permissions on Developer App
4. Business verification (may be required)

---

### 3. Google Analytics 4 (GA4 Data API)

**Auth:** OAuth 2.0 (credentials already exist in .env)
**Endpoints:**
- `POST /v1beta/{property}/runReport` — custom reports
- `POST /v1beta/{property}/runRealtimeReport` — real-time data

**Metrics to sync:**
| Metric | Dimension | Frequency |
|--------|-----------|-----------|
| Sessions | Source/Medium | Daily |
| Users (new vs returning) | Date | Daily |
| Pageviews | Page path | Daily |
| Bounce rate | Page/Source | Daily |
| Avg session duration | Source | Daily |
| Conversion events | Event name | Daily |
| Traffic sources | Source/Medium/Campaign | Daily |
| Top pages | Page path | Daily |
| Blog post performance | Page path (filtered) | Daily |
| Device breakdown | Device category | Weekly |
| Geographic breakdown | Country/City | Weekly |

**Setup Required:**
1. Enable GA4 Data API in Google Cloud Console
2. Create Service Account (or use existing OAuth credentials)
3. Grant Service Account access to GA4 property
4. Property ID already in .env: GOOGLE_ANALYTICS_PROPERTY_ID

**Note:** This is the easiest integration — credentials already exist.

---

### 4. Google Ads API

**Auth:** OAuth 2.0 + Developer Token
**Endpoints:**
- Campaign performance reports
- Keyword performance
- Search terms report
- Conversion tracking

**Metrics to sync:**
| Metric | Level | Frequency |
|--------|-------|-----------|
| Cost (spend) | Campaign/Keyword | Daily |
| Impressions | Campaign/Keyword | Daily |
| Clicks | Campaign/Keyword | Daily |
| Conversions | Campaign | Daily |
| CPC | Campaign/Keyword | Daily |
| CTR | Campaign/Keyword | Daily |
| Quality Score | Keyword | Weekly |
| Search terms | Query | Weekly |

**Setup Required:**
1. Google Ads Developer Token (apply via Ads account)
2. OAuth client (same as GA4)
3. Manager Account or direct account access
4. Customer ID

---

### 5. Google Business Profile API

**Auth:** OAuth 2.0
**Endpoints:**
- `GET /accounts/{account}/locations` — location info
- `GET /accounts/{account}/locations/{location}/reviews` — reviews
- Performance metrics via Business Profile Performance API

**Metrics to sync:**
| Metric | Frequency |
|--------|-----------|
| Total reviews | Daily |
| Average rating | Daily |
| New reviews | Daily |
| Search appearances | Weekly |
| Direction requests | Weekly |
| Phone calls | Weekly |
| Website clicks | Weekly |
| Photo views | Weekly |

**Setup Required:**
1. Enable Business Profile API in Google Cloud Console
2. Link Google Business Profile account
3. OAuth consent (same project as GA4)

---

### 6. Pinterest (Pinterest API v5)

**Auth:** OAuth 2.0
**Endpoints:**
- `GET /user_account` — account info, follower count
- `GET /boards` — board list
- `GET /pins` — pin list
- `GET /user_account/analytics` — account metrics
- `GET /pins/{pin_id}/analytics` — pin metrics

**Metrics to sync:**
| Metric | Level | Frequency |
|--------|-------|-----------|
| Pin impressions | Pin | Daily |
| Pin saves | Pin | Daily |
| Pin clicks | Pin | Daily |
| Outbound clicks | Pin | Daily |
| Follower count | Account | Daily |
| Follower growth | Account | Daily |
| Audience demographics | Account | Weekly |
| Board views | Board | Weekly |
| Top pins (performance) | Account | Weekly |

**Setup Required:**
1. Create Pinterest Developer Account
2. Create app in Pinterest App Portal
3. OAuth flow for account access
4. Request scopes: user_accounts:read, pins:read, boards:read

**Why Pinterest:** High wedding/photography search intent, strong visual discovery platform, ideal for portfolio showcase.

---

### 7. TikTok (Content + Marketing API)

**Auth:** TikTok Developer Account + OAuth
**Endpoints:**
- Content API: video list, video insights
- Marketing API: campaign performance, audience insights

**Metrics to sync:**
| Metric | Level | Frequency |
|--------|-------|-----------|
| Video views | Post | Daily |
| Likes | Post | Daily |
| Comments | Post | Daily |
| Shares | Post | Daily |
| Follower count | Account | Daily |
| Follower growth | Account | Daily |
| Audience demographics | Account | Weekly |
| Ad spend (if running) | Campaign | Daily |
| Ad impressions | Campaign | Daily |

**Setup Required:**
1. Create TikTok Developer Account
2. Register app
3. OAuth flow for content access
4. Marketing API access (separate application)

---

## Database Schema (PostgreSQL)

```sql
-- Platform connections
CREATE TABLE platform_connections (
  id SERIAL PRIMARY KEY,
  platform VARCHAR(50) NOT NULL, -- instagram, google_analytics, meta_ads, tiktok, google_ads, google_business
  account_id VARCHAR(255),
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  status VARCHAR(20) DEFAULT 'active', -- active, expired, error
  last_sync_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Unified metrics (normalized across platforms)
CREATE TABLE metrics (
  id SERIAL PRIMARY KEY,
  platform VARCHAR(50) NOT NULL,
  metric_type VARCHAR(50) NOT NULL, -- impressions, clicks, followers, spend, etc.
  metric_value DECIMAL(15,2) NOT NULL,
  dimension VARCHAR(255), -- e.g., post ID, campaign ID, page path
  dimension_label VARCHAR(500), -- human-readable label
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  synced_at TIMESTAMP DEFAULT NOW()
);

-- Post/content tracking (cross-platform)
CREATE TABLE content (
  id SERIAL PRIMARY KEY,
  platform VARCHAR(50) NOT NULL,
  platform_id VARCHAR(255) NOT NULL, -- platform-specific post/video ID
  content_type VARCHAR(50), -- post, story, reel, video, blog
  title VARCHAR(500),
  caption TEXT,
  url VARCHAR(1000),
  thumbnail_url VARCHAR(1000),
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Content metrics (per-post performance)
CREATE TABLE content_metrics (
  id SERIAL PRIMARY KEY,
  content_id INTEGER REFERENCES content(id),
  metric_type VARCHAR(50) NOT NULL, -- likes, comments, saves, shares, views, reach
  metric_value DECIMAL(15,2) NOT NULL,
  recorded_at DATE NOT NULL,
  synced_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(content_id, metric_type, recorded_at)
);

-- Ad campaigns
CREATE TABLE ad_campaigns (
  id SERIAL PRIMARY KEY,
  platform VARCHAR(50) NOT NULL, -- meta_ads, google_ads, tiktok_ads
  platform_campaign_id VARCHAR(255),
  campaign_name VARCHAR(500),
  status VARCHAR(50),
  objective VARCHAR(100),
  budget_daily DECIMAL(10,2),
  budget_lifetime DECIMAL(10,2),
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Ad performance metrics
CREATE TABLE ad_metrics (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER REFERENCES ad_campaigns(id),
  spend DECIMAL(10,2),
  impressions INTEGER,
  clicks INTEGER,
  conversions INTEGER,
  ctr DECIMAL(8,4),
  cpc DECIMAL(10,4),
  cpm DECIMAL(10,4),
  roas DECIMAL(10,4),
  period_date DATE NOT NULL,
  synced_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(campaign_id, period_date)
);

-- Sync log (tracking what was synced when)
CREATE TABLE sync_log (
  id SERIAL PRIMARY KEY,
  platform VARCHAR(50) NOT NULL,
  sync_type VARCHAR(50), -- full, incremental
  status VARCHAR(20), -- success, error, partial
  records_synced INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Reviews (Google Business Profile)
CREATE TABLE reviews (
  id SERIAL PRIMARY KEY,
  platform VARCHAR(50) DEFAULT 'google',
  platform_review_id VARCHAR(255),
  reviewer_name VARCHAR(255),
  rating INTEGER,
  review_text TEXT,
  reply_text TEXT,
  published_at TIMESTAMP,
  replied_at TIMESTAMP,
  synced_at TIMESTAMP DEFAULT NOW()
);

-- Inquiries (lead tracking)
CREATE TABLE inquiries (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  partner_name VARCHAR(255),
  event_date DATE,
  event_type VARCHAR(100), -- wedding, engagement, family, etc.
  source VARCHAR(100), -- instagram, google, referral, etc.
  source_detail VARCHAR(255), -- specific campaign, post, ad
  message TEXT,
  status VARCHAR(50) DEFAULT 'new', -- new, contacted, qualified, quoted, booked, lost
  inquiry_date TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Bookings (confirmed clients)
CREATE TABLE bookings (
  id SERIAL PRIMARY KEY,
  inquiry_id INTEGER REFERENCES inquiries(id),
  contact_id INTEGER REFERENCES contacts(id), -- links to AnselAI contacts
  event_date DATE NOT NULL,
  event_type VARCHAR(100),
  package_name VARCHAR(255),
  package_price DECIMAL(10,2),
  deposit_amount DECIMAL(10,2),
  deposit_paid_at TIMESTAMP,
  balance_due DECIMAL(10,2),
  balance_paid_at TIMESTAMP,
  booking_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'confirmed', -- confirmed, completed, cancelled
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Attribution (links inquiries back to specific content/ads)
CREATE TABLE attribution (
  id SERIAL PRIMARY KEY,
  inquiry_id INTEGER REFERENCES inquiries(id),
  platform VARCHAR(50), -- instagram, google, pinterest, etc.
  source_type VARCHAR(50), -- organic_post, ad_campaign, blog_post, review
  source_id VARCHAR(255), -- content_id, campaign_id, post_id
  source_url VARCHAR(1000),
  utm_source VARCHAR(255),
  utm_medium VARCHAR(255),
  utm_campaign VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│                 AnselAI Dashboard                  │
│  ┌────────────┬────────────┬───────────────────┐ │
│  │  Overview   │  Content   │   Ad Campaigns    │ │
│  │  (KPIs)     │Performance │   (ROI Tracker)   │ │
│  ├────────────┼────────────┼───────────────────┤ │
│  │  Website    │  Social    │   Reviews &       │ │
│  │  Analytics  │  Growth    │   Reputation      │ │
│  └────────────┴────────────┴───────────────────┘ │
│                    Next.js Frontend               │
└──────────────────────┬───────────────────────────┘
                       │ API Routes
┌──────────────────────┴───────────────────────────┐
│               AnselAI Backend (Next.js)           │
│  ┌──────────────────────────────────────────────┐│
│  │          Integration Services Layer           ││
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌─────┐ ┌─────┐││
│  │  │ Meta │ │  GA4 │ │Google│ │TikTk│ │GBiz │││
│  │  │ API  │ │  API │ │ Ads  │ │ API │ │Prof │││
│  │  └──┬───┘ └──┬───┘ └──┬───┘ └──┬──┘ └──┬──┘││
│  │     └────────┴────────┴────────┴────────┘   ││
│  │              Sync Scheduler (Cron)           ││
│  └──────────────────────────────────────────────┘│
│  ┌──────────────────────────────────────────────┐│
│  │        PostgreSQL + Prisma ORM               ││
│  │  (Unified schema: metrics, content, ads)     ││
│  └──────────────────────────────────────────────┘│
└──────────────────────────────────────────────────┘
```

**Sync Frequencies:**
- Hourly: Post engagement (likes, comments, saves)
- Daily: Account metrics, ad performance, website analytics
- Weekly: Demographics, audience insights, search terms

**Data Retention:**
- Daily granularity for 2 years
- Monthly aggregates indefinitely
- Raw API responses stored for 30 days (debugging)

---

## Build Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Set up AnselAI backend (Next.js API routes)
- [ ] Prisma schema migration (tables above)
- [ ] Platform connections CRUD (add/remove/test connections)
- [ ] Sync scheduler framework (cron-based)
- [ ] Basic dashboard layout (empty states)

### Phase 2: Google Integration (Week 2-3)
*Easiest — credentials already exist*
- [ ] GA4 Data API integration
  - [ ] OAuth flow using existing credentials
  - [ ] Website traffic sync (sessions, users, pageviews)
  - [ ] Traffic sources breakdown
  - [ ] Blog post performance (which posts drive traffic)
  - [ ] Conversion events
- [ ] Google Business Profile
  - [ ] Reviews sync
  - [ ] Search visibility metrics
- [ ] Dashboard: Website Analytics view
- [ ] Dashboard: Reviews view

### Phase 3: Meta Integration (Week 3-5)
- [ ] Facebook Developer App setup
- [ ] Instagram Graph API integration
  - [ ] OAuth flow (Instagram Business Account)
  - [ ] Post metrics sync
  - [ ] Account metrics sync
  - [ ] Story metrics sync
  - [ ] Audience demographics
- [ ] Meta Ads API integration
  - [ ] Campaign list sync
  - [ ] Performance metrics sync
  - [ ] Spend tracking
- [ ] Dashboard: Social Media view
- [ ] Dashboard: Ad Campaigns view

### Phase 4: Pinterest Integration (Week 5-6)
- [ ] Pinterest Developer Account setup
- [ ] Pinterest API v5 integration
  - [ ] OAuth flow
  - [ ] Pin metrics sync
  - [ ] Board metrics sync
  - [ ] Account analytics
  - [ ] Audience demographics
- [ ] Dashboard: Pinterest view

### Phase 5: TikTok Integration (Week 6-7)
- [ ] TikTok Developer Account setup
- [ ] TikTok Content API integration
- [ ] TikTok Marketing API (if running ads)
- [ ] Dashboard: TikTok view

### Phase 6: Unified Dashboard + Intelligence (Week 7-9)
- [ ] Cross-platform comparison views
- [ ] ROI calculator (ad spend vs. inquiries/bookings)
- [ ] Content performance ranking (which posts work best across platforms)
- [ ] Monthly/weekly trend reports (auto-generated)
- [ ] Marcus integration: daily/weekly briefings via OpenClaw
- [ ] Alert system: anomaly detection (sudden drops, viral posts)

---

## Dashboard Views

### 1. Overview (KPIs)
- Total followers across platforms
- Total engagement this week/month
- Website sessions trend
- Ad spend vs. inquiries
- Top performing content
- Next upcoming booking/event

### 2. Content Performance
- Cross-platform post comparison
- Engagement rate by content type (reels vs. posts vs. stories)
- Best posting times
- Caption analysis (which topics perform)

### 3. Ad Campaigns
- Active campaigns across Meta + Google + TikTok
- Spend pacing (daily/weekly/monthly)
- Cost per inquiry
- ROAS by campaign
- Audience targeting performance

### 4. Website Analytics
- Traffic trends
- Top pages / blog posts
- Traffic sources
- Conversion funnel (visit → inquiry → booking)

### 5. Reviews & Reputation
- Google review trend
- Average rating
- Recent reviews (with reply status)
- Sentiment analysis

### 6. Growth Trends
- Follower growth by platform
- Engagement rate trends
- Website traffic trends
- Revenue trends (if integrated)

---

## API Rate Limits (Important)

| Platform | Rate Limit | Strategy |
|----------|-----------|----------|
| Meta Graph API | 200 calls/user/hour | Batch requests, cache aggressively |
| GA4 Data API | 10,000 requests/day | Daily sync, aggregate queries |
| Google Ads API | 15,000 requests/day | Daily sync |
| TikTok Content API | 100 requests/minute | Respectful polling |
| Google Business Profile | 1,000 requests/day | Daily sync |

---

## Security

- All tokens encrypted at rest in PostgreSQL
- Token refresh automated (before expiry)
- No credentials in frontend code
- API calls server-side only
- Sync errors logged, alerted via Marcus/OpenClaw

---

## Success Metrics

1. **All platforms syncing** with <1% error rate
2. **Dashboard loads <2 seconds** for any view
3. **Data freshness:** post engagement <1 hour old, everything else <24 hours
4. **Tyler checks AnselAI daily** instead of logging into 5+ platforms
5. **Marcus can generate weekly reports** from AnselAI data via API

---

## Tyler's Decisions (2026-02-25)

1. **Google Ads:** Not using Google Ads — Meta Ads only
2. **Pinterest:** YES — include Pinterest integration
3. **Booking/CRM data:** YES — track full funnel (traffic → inquiry → booking)
4. **Budget:** YES — be cost-conscious (batch requests, smart caching, respect rate limits)
5. **Priority:** Start with easiest (Google GA4 + Google Business Profile)

---

## Updated Platform List

**Phase 2:** Google (GA4 + Business Profile) — EASIEST, credentials exist
**Phase 3:** Meta (Instagram + Ads) — most critical for photography business
**Phase 4:** Pinterest — visual platform, high wedding audience
**Phase 5:** TikTok — video content performance

**Skipped:** Google Ads (not running campaigns)

---

*Phase 1 (foundation) + Phase 2 (Google) can start immediately.*
