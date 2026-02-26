# Phase 4: Business Views

**Parent spec:** `docs/MISSION-CONTROL-REBUILD.md`
**Branch:** `mc/phase-4-business`
**Estimated effort:** 4-6 hours
**Dependencies:** Phase 2 complete

---

## Goal

Connect real business data so Tyler can see pipeline, financials, and client status from MC.

---

## 4A: Pipeline View

### Data Sources
- Scout's leads: `/Volumes/reeseai-memory/photography/leads/daily/*.json`
- Ed's outreach: `/Volumes/reeseai-memory/photography/outreach/cold-emails/`
- Manual entries via UI

### Pipeline Stages
Columns (Kanban-style, like task board):
1. **Lead** — Identified by Scout, not yet contacted
2. **Contacted** — Ed sent outreach
3. **Responded** — Prospect replied
4. **Meeting** — Meeting scheduled or completed
5. **Proposal** — Proposal sent
6. **Booked** — Deal closed
7. **Completed** — Work delivered

### Lead Card
- Business name
- Contact name (if known)
- Type: Photography / R3 Studios / ZipGolf
- Source: Scout / Manual / Referral
- Last touched date
- Stage age (how long in current stage)
- Click → detail panel with full info and notes

### Pipeline API
- `GET /api/pipeline` — list all leads with filters
- `POST /api/pipeline` — create lead manually
- `PATCH /api/pipeline/[id]` — update lead (stage, notes, contact info)
- Auto-import: API route that reads Scout's daily JSON files and creates leads that don't already exist

### Two Pipelines
- Toggle between: **Photography (By The Reeses)** and **SaaS (R3 Studios)**
- Filter by type

---

## 4B: Financial View

### Revenue Tracking
- Manual entry for now: amount, date, client, type (photography/SaaS)
- Monthly summary table
- Year-to-date total
- Target tracking: bar or progress toward $250k photography, $10k/mo R3

### Cost Tracking
- API costs: read from gateway usage data if available
- Manual cost entry: hosting, subscriptions, etc.
- Monthly cost summary
- Profit = revenue - costs

### API
- `GET /api/financials` — list all entries
- `POST /api/financials` — add entry (type: revenue/cost, amount, date, category, description)
- `GET /api/financials/summary` — monthly/yearly aggregates

### Display
- Monthly cards showing revenue, costs, profit
- Simple bar chart for monthly trend (last 6 months)
- Target progress indicators
- No complex dashboards — clean and scannable

---

## 4C: Client/CRM View

### For Now (Pre-AnselAI)
- Simple contact list
- Fields: name, email, phone, type (photography client / R3 prospect / vendor), status, notes
- Import from existing `data/crm.json` if valid data exists
- Manual add/edit

### Later (Post-AnselAI)
- Connects to AnselAI database
- Wedding details, timeline, questionnaire responses
- This phase just builds the basic structure

### API
- `GET /api/crm` — list contacts
- `POST /api/crm` — add contact
- `PATCH /api/crm/[id]` — update contact
- Filter by type, status

---

## Review Criteria (Walt)

- [ ] Pipeline view shows real leads from Scout's JSON files
- [ ] Can create a lead manually
- [ ] Can drag leads between pipeline stages
- [ ] Lead detail panel shows full info
- [ ] Two pipeline toggle works (Photography / R3)
- [ ] Financial view shows real entries (or clean empty state)
- [ ] Can add revenue and cost entries
- [ ] Monthly summary calculates correctly
- [ ] Target progress displays accurately
- [ ] CRM shows contacts (real or clean empty state)
- [ ] All API routes work (test with curl)
- [ ] No mock data
- [ ] `bun run build` succeeds
- [ ] Mobile: pipeline and financials usable on phone
