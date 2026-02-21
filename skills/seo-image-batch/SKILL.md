# SEO Image Batch Processing

**Purpose:** Automated workflow to optimize wedding photography images with SEO-friendly filenames and alt text.

**Time:** 10-15 minutes end-to-end (keyword research → file renaming → review)

## When to Use

- New wedding gallery folders need SEO optimization
- Batch of images needs keyword-optimized filenames and alt text
- Want to improve image discoverability for web publishing

## How It Works

This skill creates and chains 4 tasks:

1. **Scout** - Keyword research (verify/update keywords for the venue/location)
2. **Ada** - Generate CSV (new filenames + alt text based on Scout's keywords)
3. **Dewey** - Backup originals + execute file renaming
4. **Walt** - Review the completed work

Each task auto-triggers the next when complete.

## Usage

### Basic Invocation

```
Process SEO images for [folder names or locations]

Example:
"Process SEO images for the Asheville wedding folder"
"SEO optimize images in /Users/marcusrawlins/Downloads/NewWedding/"
```

### What You Provide

- **Folder path(s):** Location of the image files
- **Venue info:** Wedding venue name, location, style (for keyword research)
- **Approval:** Review Scout's sample before full batch runs

### What You Get

- **Keyword research:** Verified primary + secondary keywords
- **Renamed files:** SEO-optimized filenames (venue-name-wedding-##.jpg)
- **Alt text CSV:** All filenames mapped to optimized alt text (80-125 chars)
- **Backup:** Original files preserved at `/Volumes/reeseai-memory/photography/assets/wedding-images-backup/YYYY-MM-DD/`
- **Review:** Walt's quality check before delivery

## Workflow Details

### Step 1: Scout - Keyword Research (~3 min)
- Examines wedding folder to understand venue, location, style
- Researches current search volume and keyword difficulty
- Outputs: Primary keyword + 5-10 secondary keywords
- Saves to: `/Volumes/reeseai-memory/photography/content/seo/wedding-keywords-YYYY-MM-DD.md`

### Step 2: Ada - CSV Generation (~4-5 min)
- Reads Scout's keyword research
- Lists all images in the target folder(s)
- Generates SEO-optimized filename for each image
- Writes natural alt text incorporating keywords (80-125 chars)
- Outputs CSV: old_filename, new_filename, alt_text
- Saves to: `/Volumes/reeseai-memory/photography/content/seo/image-seo-YYYY-MM-DD.csv`

### Step 3: Dewey - File Renaming (~1.5 min)
- Backs up all originals to memory drive
- Reads Ada's CSV
- Renames files in place (original folders)
- Verifies all renames succeeded
- Outputs completion report

### Step 4: Walt - Review (~1-2 min)
- Checks keyword quality and relevance
- Verifies filename convention consistency
- Validates alt text length and naturalness
- Grades: PASS / PASS_WITH_NOTES / NEEDS_REVISION
- Saves review to: `/Volumes/reeseai-memory/agents/reviews/YYYY-MM-DD-[agent]-review.md`

## File Locations

**Input:**
- Image folders (typically in `/Users/marcusrawlins/Downloads/`)

**Output:**
- Keywords: `/Volumes/reeseai-memory/photography/content/seo/wedding-keywords-YYYY-MM-DD.md`
- CSV: `/Volumes/reeseai-memory/photography/content/seo/image-seo-YYYY-MM-DD.csv`
- Backups: `/Volumes/reeseai-memory/photography/assets/wedding-images-backup/YYYY-MM-DD/`
- Reviews: `/Volumes/reeseai-memory/agents/reviews/`

**Modified:**
- Original image folders (files renamed in place)

## Example Output

**Before:**
```
Sneak Peeks _ Lisa & Henry Cairnwood Estate Wedding _ The Reeses-1.jpg
```

**After:**
```
cairnwood-estate-wedding-01.jpg
```

**Alt Text:**
```
"Cairnwood Estate wedding ceremony in Pennsylvania with elegant outdoor garden setting"
```

## Notes

- Original files are always backed up before renaming
- Keyword research is fresh each run (catches market changes)
- CSV is preserved for reference and future uploads
- Walt's review ensures quality before delivery
- Total images processed in first run: 776 across 5 weddings

## Task Chain Configuration

When invoked, this skill creates tasks with proper dependencies:

```
Scout → Ada → Dewey → Walt
  ↓       ↓       ↓       ↓
queued  blocked blocked blocked
```

Each task activates when the previous one completes and passes review.
