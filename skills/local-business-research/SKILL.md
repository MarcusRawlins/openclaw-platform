# Local Business Research Skill

**Purpose:** Research local businesses for R3 Studios lead generation using FREE methods only.

**When to use:** Finding small service businesses that need websites (auto repair, HVAC, restaurants, etc.)

## Free Methods

### Method 1: Web Search + Manual Extraction (FREE, works now)

Scout uses web_search tool (if configured) OR manual Google searches to find businesses, then extracts:
- Business name
- Website URL (if exists)
- Phone number
- Location
- Google rating/reviews

### Method 2: Public Directory Pages (FREE, no API)

Scrape public business directories:
- Yellow Pages: https://www.yellowpages.com/search?search_terms=[industry]&geo_location_terms=[location]
- Yelp public pages: https://www.yelp.com/search?find_desc=[industry]&find_loc=[location]
- Google Maps public listings

### Method 3: Manual Research (FREE, slower)

Scout manually:
1. Google: "[industry] [city]"
2. Click through results
3. Extract business info
4. Add to CSV

Slow but requires zero APIs or paid services.

## For Scout: How to Research 400 Leads

**Daily target:** 50 leads (8 hours × 6-7 leads/hour manual pace)

**Per industry (8 industries × 50 leads):**
1. Google search: "auto repair greensboro nc"
2. Visit first 3 pages of results
3. For each business:
   - Name
   - Website (if exists)
   - Phone
   - Rate website quality (1-10)
   - Note pain points (no mobile, outdated, slow)
   - Estimated business size/revenue

**CSV format:**
```csv
business_name,website,phone,location,website_score,pain_points,industry,priority
Joe's Auto Repair,joes-auto.com,336-555-1234,"Greensboro, NC",3,"Outdated design no mobile",auto-repair,high
```

## Tools Scout Has

1. **web_search tool** - if Brave API configured (currently not)
2. **web_fetch tool** - grab website content, check if mobile-friendly
3. **exec tool** - can run curl/wget to fetch pages
4. **browser tool** - if working, can navigate and extract data

## Fallback: Manual Grind

If no tools work, Scout manually researches 10-15 leads/hour:
- 8 hour day = 80-120 leads
- 4-5 days = 400 leads
- Completely free, just slower

## Cost: $0

No APIs needed. Scout can deliver using free public data and manual research.
