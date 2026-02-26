# Mission Control: Content Viewer Popup with Approval Workflow

**Priority:** High
**Estimated Time:** 2-3 hours
**Module:** mc-content

## Problem

In Mission Control's AnselAI section, content cards are visible but clicking them does nothing. Tyler needs to review content (title, body, images, metadata) and either approve it or send it back for revisions with notes.

## Current State

**File:** `mission_control/components/anselai/ContentHub.tsx`
- Displays content cards from `/Volumes/reeseai-memory/photography/content/content-index.json`
- Cards show: title, platform, status, date
- Click does nothing

## Requirements

### 1. Content Viewer Popup

**Trigger:** Click any content card

**Popup should display:**
- Full content title
- Platform badge (Instagram, TikTok, Facebook, Blog)
- Status badge (draft, pending-approval, approved, published)
- Created date
- Full content body (markdown rendered as HTML)
- All metadata from frontmatter:
  - Tags
  - Approval status
  - Performance metrics (if any)
- If images mentioned in content, show them
- If this is a blog post, show meta description + focus keyphrase

**Layout:**
- Modal overlay (dark background)
- White content card centered
- Scroll if content is long
- Close button (X) top-right
- Max width: 800px

### 2. Approval Workflow

**For content with `status: "pending-approval"`:**

Show two sections at bottom of popup:

**Option A: Approve**
- Green "Approve" button
- On click:
  - Update content file frontmatter: `approvalStatus: approved`
  - Update content-index.json entry
  - Show success toast: "Content approved"
  - Close popup
  - Refresh content list

**Option B: Send for Revision**
- Textarea: "Notes for Ada" (placeholder: "What needs to change?")
- Red "Send for Revision" button
- On click:
  - Create revision file: `/Volumes/reeseai-memory/photography/content/revisions/YYYY-MM-DD-[content-id]-revision.md`
  - Revision file contains:
    - Original content path
    - Tyler's notes
    - Timestamp
  - Update content status: `status: needs-revision`
  - Update content-index.json
  - Show success toast: "Revision notes sent to Ada"
  - Close popup
  - Refresh content list

### 3. API Endpoint

**File:** `mission_control/app/api/anselai/content/[id]/route.ts`

**GET /api/anselai/content/[id]**
- Read content file from disk
- Parse frontmatter + body
- Return full content JSON

**PUT /api/anselai/content/[id]/approve**
- Update content file frontmatter
- Update content-index.json
- Return success

**PUT /api/anselai/content/[id]/revise**
- Body: `{ notes: string }`
- Create revision file
- Update content file + index
- Return success

### 4. Content Statuses

**Color coding in UI:**
- `draft` — Gray
- `pending-approval` — Yellow (needs Tyler's attention)
- `approved` — Green (ready for Ada to post)
- `needs-revision` — Red (sent back to Ada)
- `published` — Blue (live on platform)

### 5. Markdown Rendering

Use a markdown library to render content body:
- `react-markdown` or `marked`
- Support: headings, bold, italics, lists, links
- Style it nicely (not raw markdown)

### 6. Error Handling

- If content file not found: show "Content file missing"
- If API error: show toast "Error loading content"
- If approve/revise fails: show error toast

### 7. Mobile Responsive

- Popup should work on phone
- Stack buttons vertically on small screens
- Full-width on mobile

## Example Content File Structure

**File:** `2026-02-25-instagram-wedding-tips.md`

```markdown
---
title: "5 Questions Every Couple Should Ask Their Photographer"
platform: instagram
status: pending-approval
approvalStatus: pending
createdDate: 2026-02-25
tags: [wedding, photography, tips]
performance:
  views: 0
  likes: 0
---

Planning your wedding? Here are 5 questions you need to ask before booking your photographer...

[rest of content]
```

## Example Revision File

**File:** `revisions/2026-02-25-instagram-wedding-tips-revision.md`

```markdown
---
originalContent: /Volumes/reeseai-memory/photography/content/2026-02-25-instagram-wedding-tips.md
requestedBy: Tyler Reese
requestedAt: 2026-02-25T22:15:00.000Z
---

# Revision Notes

The opening is too generic. Make it more personal — tell a quick story about a couple who didn't ask these questions and regretted it.

Also, question #3 feels redundant with question #5. Combine them or replace one.
```

## Deliverables

- [ ] Content viewer popup component
- [ ] Click handler on content cards
- [ ] Markdown rendering working
- [ ] Approve workflow functional
- [ ] Revision workflow functional
- [ ] API endpoints working
- [ ] File updates persisting correctly
- [ ] Status badges update in real-time
- [ ] Toast notifications on success/error
- [ ] Mobile responsive
- [ ] Git commit: "feat: content viewer popup with approval workflow"

## Testing

1. Click a `pending-approval` content item
2. Popup opens showing full content
3. Click "Approve" → file updates, status changes to `approved`
4. Click another `pending-approval` item
5. Add revision notes, click "Send for Revision"
6. Revision file created, status changes to `needs-revision`
7. Verify content-index.json updated both times
8. Check mobile view (responsive)

## Notes

- Don't modify Ada's content creation workflow
- Revision files are separate (Ada reads them on next task)
- Tyler can approve multiple pieces in one sitting
- This same pattern will work for R3 Studios content later
