# Ada's Next Task - After Alt Text Completes

## Task: Fix All 7 Engagement Session Blogs

**Trigger:** After ada-alt-text-local subagent completes

**What needs fixing:**

### 1. SEO Keyword Placement (All 7 Blogs)
Check every blog for:
- Primary keyword in **title (H1)**
- Primary keyword in **first paragraph**
- Primary keyword or synonym in at least **one H2**
- Primary keyword appears **2-4 times throughout** (natural placement)

### 2. Word Count Reduction (All 7 Blogs)
- Current: 900-1,100 words
- Target: **500-600 words**
- Keep: opening, key moments, practical advice, CTA
- Cut: excess description, repetition, flowery language

### 3. Britton Manor Links (Blog 4 Only)
Add clickable links in practical advice section:
- Email: brittonmanornc@gmail.com (mailto: link)
- Website: brittonmanor.com/proposals (standard link)
- Natural context: "If you're considering Britton Manor for your proposal or engagement session, reach out to them at [email] or visit [website]."

### 4. Image File Renaming (All 7 Blogs)
**CRITICAL:** Don't just create image-renames.csv files
- Generate CSV with old_filename,new_filename
- **ACTUALLY RENAME THE FILES** using mv command
- Verify files were renamed successfully
- CSV is documentation, renamed files are the deliverable

## Spawn Command Template:
```
agentId: ada
label: ada-blog-fixes-seo-wordcount
task: Fix all 7 engagement session blogs per new standards:
1. SEO keyword placement (title, first paragraph, H2, 2-4 times throughout)
2. Reduce word count from 900-1100 to 500-600 words
3. Add Britton Manor links to blog 4 (brittonmanornc@gmail.com / brittonmanor.com/proposals)
4. ACTUALLY rename image files (don't just create CSVs)

After Walt approves, you'll create WordPress drafts for each blog using browser automation.

Read your lessons first. All 7 blogs need these fixes. Report when complete.
```

**Next Steps After Walt Approval:**
1. Ada creates WordPress draft for each approved blog (browser automation)
2. Tyler adds photos manually in WordPress
3. Tyler notifies Marcus → Ada adds alt text via browser
4. Tyler schedules/publishes

**Status:** QUEUED (waiting for alt text completion)
