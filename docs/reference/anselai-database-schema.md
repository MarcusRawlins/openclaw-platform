# AnselAI Database Schema

**Database:** `/Volumes/reeseai-memory/data/databases/anselai.db`

**Created:** 2026-02-23

**Phase:** 1 - Google Data Only

---

## Overview

The AnselAI database is designed to consolidate photography business data from multiple sources (Google Calendar, Gmail, Honeybook) into a unified client relationship management system. Phase 1 includes only Google data; Honeybook data will be merged in Phase 2.

## Design Philosophy

- **Source tracking:** Every record has a `source` field to track origin ('google' or 'honeybook')
- **Flexible linking:** Clients can have multiple projects; projects link to calendar events and emails
- **Revenue extraction:** Payments extracted from email notifications and calendar notes
- **Future-proof:** Schema designed to handle data deduplication when merging Honeybook

---

## Tables

### 1. `clients`

Primary customer records.

**Schema:**
```sql
CREATE TABLE clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT,
    last_name TEXT,
    partner_name TEXT,
    email TEXT,
    phone TEXT,
    source TEXT NOT NULL,           -- 'google' or 'honeybook'
    source_id TEXT,                  -- original ID from source system
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `idx_clients_email` on `email`
- `idx_clients_source` on `source`

**Notes:**
- `partner_name` stores the name of the client's partner (common in wedding photography)
- `source_id` preserves the original ID from calendar event or Honeybook for traceability
- Email is not unique (some couples share email addresses)

**Sample Data:**
- 83 clients imported from Google Calendar (2026-02-23)

---

### 2. `projects`

Photography projects/events (weddings, engagements, shoots).

**Schema:**
```sql
CREATE TABLE projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    event_date TEXT,
    event_type TEXT,                -- 'wedding', 'engagement', 'shoot', 'meeting', etc.
    status TEXT,                     -- 'lead', 'contacted', 'booked', 'completed', 'cancelled'
    venue TEXT,
    source TEXT NOT NULL,            -- 'google' or 'honeybook'
    source_id TEXT,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id)
);
```

**Indexes:**
- `idx_projects_client` on `client_id`
- `idx_projects_status` on `status`
- `idx_projects_event_date` on `event_date`

**Status Values:**
- `lead` - Initial inquiry or discovery call scheduled
- `contacted` - Active communication but not booked
- `booked` - Contract signed, date reserved
- `client` - Current working relationship (Google data uses this for booked clients)
- `completed` - Event finished, deliverables sent
- `cancelled` - Project cancelled

**Event Types:**
- `wedding` - Full wedding day coverage
- `engagement` - Engagement session/shoot
- `shoot` - Other photo sessions
- `meeting` - Consultation or planning calls

**Sample Data:**
- 83 projects (72 weddings, 11 engagements)
- 65 clients, 18 leads

---

### 3. `calendar_events`

Google Calendar events linked to clients/projects.

**Schema:**
```sql
CREATE TABLE calendar_events (
    id TEXT PRIMARY KEY,             -- Google Calendar event ID
    client_id INTEGER,
    project_id INTEGER,
    summary TEXT,
    start_date TEXT,
    end_date TEXT,
    location TEXT,
    description TEXT,
    event_type TEXT,
    source TEXT DEFAULT 'google',
    FOREIGN KEY (client_id) REFERENCES clients(id),
    FOREIGN KEY (project_id) REFERENCES projects(id)
);
```

**Indexes:**
- `idx_calendar_client` on `client_id`
- `idx_calendar_project` on `project_id`

**Notes:**
- Not all events link to clients (some are administrative or external)
- Used to track discovery calls, shoots, weddings, meetings
- `id` is the Google Calendar unique identifier

**Sample Data:**
- 594 calendar events imported
- 0 linked to clients (Phase 1 matching needs improvement)

---

### 4. `emails`

Gmail emails related to photography business.

**Schema:**
```sql
CREATE TABLE emails (
    id TEXT PRIMARY KEY,             -- Gmail message ID
    client_id INTEGER,
    from_email TEXT,
    from_name TEXT,
    to_emails TEXT,
    subject TEXT,
    date TEXT,
    snippet TEXT,                    -- First ~200 chars of email body
    has_attachment INTEGER DEFAULT 0,
    labels TEXT,                     -- Gmail labels (comma-separated)
    source TEXT DEFAULT 'google',
    FOREIGN KEY (client_id) REFERENCES clients(id)
);
```

**Indexes:**
- `idx_emails_client` on `client_id`

**Notes:**
- Only photography-related emails imported (filtered by keywords)
- `snippet` used for revenue extraction (payment mentions)
- `labels` preserves Gmail organization

**Sample Data:**
- 5,000 emails imported (limited to most relevant)
- 206 linked to clients
- Used to extract 223 revenue records

---

### 5. `revenue`

Payment records extracted from emails and calendar.

**Schema:**
```sql
CREATE TABLE revenue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    client_id INTEGER,
    amount REAL NOT NULL,
    date TEXT,
    source TEXT NOT NULL,            -- 'google-email', 'google-calendar', 'honeybook'
    payment_method TEXT,             -- 'credit_card', 'check', 'cash', 'venmo', etc.
    notes TEXT,
    source_reference TEXT,           -- email_id or calendar_event_id
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (client_id) REFERENCES clients(id)
);
```

**Indexes:**
- `idx_revenue_project` on `project_id`
- `idx_revenue_client` on `client_id`
- `idx_revenue_date` on `date`

**Notes:**
- Amounts extracted using regex from email subjects/snippets
- May include non-photography payments (Etsy fees, subscriptions, etc.)
- `source_reference` links back to originating email/event
- Multiple payments per project common (deposits, final payments)

**Extraction Logic:**
- Matches dollar patterns: `$1,234.56`
- Filters for photography-related emails
- Reasonable range: $10 - $100,000

**Sample Data:**
- 223 revenue records
- Total: $648,881.11
- Range: $10.00 - $100,000.00
- Average: $2,909.78

---

## Data Flow

### Phase 1: Google Data Import

```
1. structured-clients-2026-02-22.json (80 clients)
   ↓
   Load into clients table
   ↓
   Create projects for each client

2. reese-catalog.db (calendar_events)
   ↓
   Filter photography-related events
   ↓
   Link to clients (by email in description)
   ↓
   Insert into calendar_events table

3. reese-catalog.db (emails)
   ↓
   Filter photography-related emails
   ↓
   Link to clients (by from_email or to_emails)
   ↓
   Insert into emails table
   ↓
   Extract payment amounts from subject/snippet
   ↓
   Insert into revenue table
```

### Phase 2: Honeybook Integration (Future)

```
1. Honeybook export
   ↓
   Deduplicate against existing clients (by email/name)
   ↓
   Insert new clients with source='honeybook'
   ↓
   Insert projects with source='honeybook'
   ↓
   Insert revenue with source='honeybook'
   ↓
   Reconcile duplicate payments
```

---

## Current Statistics

*(As of 2026-02-23)*

- **Clients:** 83 (1 with revenue, 82 without linked payments yet)
- **Projects:** 83 (65 clients, 18 leads)
- **Calendar Events:** 594 (0 linked - needs improvement)
- **Emails:** 5,000 (206 linked to clients)
- **Revenue:** 223 records, $648,881.11 total

**Revenue by Year:**
- 2026: $414,610.96 (66 payments)
- 2025: $234,270.15 (157 payments)

---

## Known Issues & Improvements Needed

### Phase 1 Limitations

1. **Calendar Linking:** 0 events linked to clients
   - Matching logic needs improvement
   - Many events lack email addresses in description
   - Need fuzzy name matching

2. **Revenue Accuracy:** High total amount suggests false positives
   - $648K seems inflated
   - Likely includes non-photography payments (Etsy, Ubersuggest, etc.)
   - Need better filtering of payment emails

3. **Client Deduplication:** Multiple entries for same person
   - "Elena" appears twice (different last names)
   - Need better matching when importing

4. **Missing Data:**
   - Only 1 client has linked revenue
   - Most clients have no linked emails
   - Calendar events not connected to projects

### Recommended Next Steps

1. **Improve Email Filtering:**
   - Exclude payment platforms (Etsy, Stripe for non-photography)
   - Focus on Honeybook payment notifications
   - Add sender whitelist/blacklist

2. **Better Client Matching:**
   - Use fuzzy name matching for calendar/email linking
   - Extract names from email bodies
   - Check partner names in calendar events

3. **Honeybook Integration:**
   - Import Honeybook clients as authoritative source
   - Use Honeybook revenue data (more accurate)
   - Reconcile Google data against Honeybook

4. **Data Validation:**
   - Manual review of top revenue entries
   - Flag suspicious amounts
   - Verify client linkages

---

## Queries

### Common Queries

**Find client by email:**
```sql
SELECT * FROM clients WHERE email = 'tmoy18@gmail.com';
```

**Get all projects for a client:**
```sql
SELECT * FROM projects WHERE client_id = 1;
```

**Total revenue by client:**
```sql
SELECT 
    c.first_name || ' ' || c.last_name as name,
    c.email,
    SUM(r.amount) as total_revenue
FROM clients c
JOIN revenue r ON c.id = r.client_id
GROUP BY c.id
ORDER BY total_revenue DESC;
```

**Upcoming weddings:**
```sql
SELECT 
    c.first_name || ' ' || c.last_name as client,
    p.event_date,
    p.venue,
    p.status
FROM projects p
JOIN clients c ON p.client_id = c.id
WHERE p.event_type = 'wedding'
  AND p.event_date >= date('now')
ORDER BY p.event_date;
```

**Revenue by year:**
```sql
SELECT 
    strftime('%Y', date) as year,
    COUNT(*) as payments,
    SUM(amount) as total
FROM revenue
GROUP BY year
ORDER BY year DESC;
```

---

## Files

- **Database:** `/Volumes/reeseai-memory/data/databases/anselai.db`
- **Source JSON:** `/Volumes/reeseai-memory/photography/data/structured-clients-2026-02-22.json`
- **Source Catalog:** `/Volumes/reeseai-memory/data/databases/reese-catalog.db`
- **Import Script:** `/tmp/import_google_data.py`
- **Schema SQL:** `/tmp/create_anselai_schema.sql`

---

*Schema documentation for Phase 1 (Google Data Only). Will be updated when Honeybook data is integrated.*
