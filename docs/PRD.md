# PRD.md — Reese Operations Platform

> Product requirements for Tyler Reese's operations dashboard and agent system.
> Built on OpenClaw, adapted from jwtidwell/mission_control.
> This is our build spec. `REFERENCE-PRD.md` is inspiration.

---

## Vision

One local dashboard where Tyler sees everything that matters: agents, clients, finances, content, and operations. No cloud dependencies. No subscription fatigue. One screen, full picture.

---

## Business Domains

### 1. Wedding Photography (Alex & Tyler / The Reeses)
- **Brand:** bythereeses.com — high-end documentary wedding photography
- **Revenue target:** $250k (2026), $500k (2027)
- **Core workflow:** Lead → inquiry → consultation → booking → shoot → delivery → follow-up
- **Key metrics:** Bookings, revenue per wedding, inquiry conversion rate, client satisfaction

### 2. SaaS Platform
- **Product:** Service-based business platform (co-founder)
- **Revenue target:** $10k/mo by April 2026, $25k/mo by EOY 2026
- **Key metrics:** MRR, churn, signups, active users, feature adoption

### 3. AI Operations (This System)
- **Purpose:** Internal leverage and automation
- **Key metrics:** Agent uptime, token costs, cron reliability, system health

---

## Mission Control Dashboard

### Core Shell (from Jeff's codebase)

These exist and we keep them:

| Feature | Status | Notes |
|---------|--------|-------|
| Gateway WebSocket | ✅ Keep | Real-time agent status, events |
| Agent card grid | ✅ Keep | Visual agent management |
| Blueprint view | ✅ Keep | Spatial layout, reshape for our operation |
| Agent expressions | ✅ Keep | Visual status indicators |
| Agent templates | ✅ Keep | Reusable agent configs |
| Whiteboard | ✅ Keep | Shared context between agents/Tyler |
| Cron management | ✅ Keep | Schedule and monitor jobs from dashboard |
| Chat modal | ✅ Keep | Talk to agents from dashboard |
| Settings/auth | ✅ Keep | Gateway config, device identity |
| Usage tracking | ✅ Keep | Token costs per model |
| Demo data | 🗑️ Strip | Replace with real data |

### New Panels to Build

#### Photography Pipeline Panel
**Priority: HIGH**

Visual pipeline of the wedding photography workflow.

| Stage | What to Track |
|-------|--------------|
| Inquiries | New leads, source, date requested |
| Consultations | Scheduled calls/meetings |
| Proposals | Sent, amount, follow-up status |
| Booked | Confirmed weddings, deposit paid |
| Upcoming | Next 30/60/90 day shoots |
| Delivered | Galleries sent, completion status |
| Follow-up | Reviews requested, thank-yous, referral asks |

**Data source:** CRM database (to be built)
**Display:** Kanban-style or pipeline funnel with counts and revenue at each stage

#### Financial Overview Panel
**Priority: HIGH**

Revenue and expense tracking across both businesses.

| Metric | Source |
|--------|--------|
| Photography revenue (YTD, monthly) | Financials DB |
| SaaS MRR | Financials DB or API |
| Combined P&L | Generated from transactions |
| Outstanding invoices | Financials DB |
| Revenue vs target progress | Calculated |

**Data source:** SQLite financials database (CSV import from accounting system)
**Display:** Summary cards + trend chart

#### Client CRM Panel
**Priority: MEDIUM**

Contact and relationship management.

| Feature | Description |
|---------|------------|
| Contact list | Search, filter, sort |
| Relationship timeline | Interaction history per contact |
| Follow-up reminders | Due/overdue items |
| Wedding details | Date, venue, package, notes |
| Vendor relationships | Preferred vendors, referral tracking |

**Data source:** CRM database
**Display:** Searchable list with detail drawer/modal

#### Content & Social Panel
**Priority: MEDIUM**

Photography brand performance across platforms.

| Platform | Metrics |
|----------|---------|
| Instagram | Followers, engagement, top posts |
| Website | Traffic, inquiry sources (if analytics connected) |
| Google Business | Reviews, rating |

**Data source:** Social tracker databases
**Display:** Summary cards with sparkline trends

#### System Health Panel
**Priority: LOW (but free with existing code)**

Already partially in Jeff's codebase.

| Metric | Source |
|--------|--------|
| Agent status | Gateway WebSocket |
| Cron job health | Gateway cron API |
| Token usage/cost | Usage tracker |
| Disk space | System check |
| Backup status | Backup logs |

---

## CRM System

### Phase 1: Core CRM
- SQLite database with contacts, interactions, follow-ups
- Natural language queries via Marcus ("who's getting married in June?")
- Manual entry + future email/calendar scanning

### Phase 2: Photography Pipeline
- Wedding-specific fields (date, venue, package, shot list, timeline)
- Inquiry → booking conversion tracking
- Automated follow-up reminders

### Phase 3: Intelligence
- Relationship health scoring
- Vendor relationship tracking
- Referral network mapping
- Client satisfaction signals

---

## Integrations Roadmap

### Near-term
| Integration | Purpose | Priority |
|-------------|---------|----------|
| Google Calendar | Wedding dates, consultations, availability | HIGH |
| Gmail | Client communication, inquiry detection | HIGH |
| Instagram API | Brand performance tracking | MEDIUM |

### Mid-term
| Integration | Purpose | Priority |
|-------------|---------|----------|
| Accounting system (CSV) | Financial data import | MEDIUM |
| Google Drive | Contract storage, gallery delivery tracking | LOW |
| HubSpot or simple CRM | If SaaS needs a sales pipeline | LOW |

### Future
| Integration | Purpose | Priority |
|-------------|---------|----------|
| Fathom/meeting recording | Client consultation summaries | LOW |
| Newsletter platform | If Tyler starts one | LOW |
| Todoist/task manager | Action item tracking | LOW |

---

## Cron Jobs (Planned)

| Job | Schedule | Purpose |
|-----|----------|---------|
| Daily Brief | 7am ET weekdays | Calendar, upcoming weddings, action items |
| CRM Follow-up Check | 8am ET daily | Flag overdue follow-ups |
| Financial Sync | Weekly | Import new transactions if available |
| Social Analytics | Daily 2am ET | Collect Instagram metrics |
| System Health | Every 30 min | Cron health, backup status |
| Database Backup | Hourly | SQLite backup to external drive |
| Git Auto-Sync | Hourly | Commit and push workspace changes |

---

## Design Principles

1. **Local-first.** Everything runs on the Mac mini. No cloud required for core functionality.
2. **SQLite everywhere.** One database technology. WAL mode. Simple.
3. **Lean agents.** Agents know where to look, not what to memorize.
4. **Cost-conscious.** Opus = Marcus only. Everything else on cheap/local models.
5. **Build from what exists.** Jeff's codebase is the shell. Matt's PRD is the inspiration. We build what Tyler actually needs.
6. **Progressive complexity.** Start with the panels Tyler uses daily. Add intelligence later.
7. **One source of truth.** Every piece of data lives in one place. Dashboards read it, they don't duplicate it.

---

## Build Phases

### Phase 1: Clean Foundation
- [ ] Strip demo data from Mission Control
- [ ] Verify all kept features work with clean data
- [ ] Deploy locally, confirm Tyler can access at localhost:3100

### Phase 2: Photography + Finance Panels
- [ ] Photography pipeline panel (Kanban view)
- [ ] Financial overview panel (revenue, P&L, targets)
- [ ] Basic CRM data model (contacts, weddings, interactions)

### Phase 3: CRM + Calendar
- [ ] Full CRM panel with search and detail views
- [ ] Google Calendar integration
- [ ] Gmail integration for inquiry detection
- [ ] Follow-up reminder system

### Phase 4: Content + Intelligence
- [ ] Instagram analytics panel
- [ ] Daily briefing cron job
- [ ] Relationship health scoring
- [ ] Business advisory analysis (lightweight version)

### Phase 5: Polish + Scale
- [ ] Mobile-responsive dashboard
- [ ] Notification preferences
- [ ] Performance optimization
- [ ] Documentation for Tyler's self-service use

---

*This is a living document. Update as priorities shift and features ship.*
