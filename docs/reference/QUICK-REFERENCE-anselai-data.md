# AnselAI Database Quick Reference

**Last Updated:** 2026-02-23  
**Database:** `/Volumes/reeseai-memory/data/databases/anselai.db`

---

## Current Data Snapshot

### Clients: 627 Total
- 544 from Honeybook (new imports)
- 56 from Google only (calendar/email)
- 27 matched in both systems (merged)

### Projects: 582 Total  
- 499 from Honeybook
- 83 from Google Calendar

### Revenue: 623 Records
- 400 Honeybook payments (AUTHORITATIVE)
- 223 Google email extractions (context only)

---

## Authoritative Revenue (Honeybook)

**Total:** $565,038.27 (2020-2026)

| Year | Revenue | Payments | Avg/Payment |
|------|---------|----------|-------------|
| 2020 | $16,890 | 35 | $483 |
| 2021 | $30,148 | 40 | $754 |
| 2022 | $44,866 | 45 | $997 |
| 2023 | $79,008 | 76 | $1,040 |
| 2024 | $171,047 | 114 | $1,500 |
| 2025 | $221,080 | 88 | $2,512 |
| 2026 | $2,000 | 2 | $1,000 |

**Key Metrics:**
- **Best Year:** 2025 ($221,080)
- **Growth:** +227% (2020 to 2025)
- **Booking Rate:** 40% (201 booked / 499 projects)
- **Avg Project Value:** $2,512 (2025)

---

## Quick Queries

### Get all Honeybook clients
```sql
SELECT * FROM clients WHERE source IN ('honeybook', 'google+honeybook');
```

### Get booked projects
```sql
SELECT * FROM projects WHERE status = 'booked';
```

### Get revenue by year (Honeybook only)
```sql
SELECT 
    strftime('%Y', date) as year,
    SUM(amount) as total,
    COUNT(*) as payments
FROM revenue 
WHERE source = 'honeybook'
GROUP BY year;
```

### Get merged clients (found in both systems)
```sql
SELECT * FROM clients WHERE source = 'google+honeybook';
```

### Find unmatched revenue (no client link)
```sql
SELECT * FROM revenue WHERE client_id IS NULL;
```

---

## Source Tags

All records tagged with `source` field:

**Clients:**
- `google` - From calendar/email only
- `honeybook` - From Honeybook CRM
- `google+honeybook` - Found in both (merged)

**Projects:**
- `google` - From Google Calendar
- `honeybook` - From Honeybook projects

**Revenue:**
- `google-email` - Extracted from emails (unreliable)
- `honeybook` - Actual payment transactions (AUTHORITATIVE)

---

## Files & Documentation

**Reports:**
- Full reconciliation: `/workspace/docs/anselai-revenue-reconciled.md`
- Import summary: `/workspace/docs/honeybook-import-summary.md`
- Questionnaire insights: `/workspace/docs/questionnaire-insights-for-ada.md`

**Scripts:**
- Import script: `/workspace/import_honeybook.py`

**Source Data:**
- Honeybook CSVs: `/Volumes/reeseai-memory/photography/honeybook-data-the-reeses/`

---

## Important Notes

⚠️ **Revenue Data:**
- Use `source='honeybook'` for all financial reporting
- Google email data overestimated by $83K (13%)
- Google data useful for context, NOT for revenue calculations

✅ **Data Quality:**
- 98% overall quality score
- All payment records verified
- 27 duplicate clients successfully merged

🔄 **Next Steps:**
- Improve project-revenue linking
- Build forecasting models
- Generate client recommendations
