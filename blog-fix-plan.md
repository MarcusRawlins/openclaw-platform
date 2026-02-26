# Blog Fix Plan - All 7 Engagement Session Blogs

## CRITICAL ISSUES FOUND

### Issue 1: Image Files NOT Renamed (ALL BLOGS)
- CSV/JSON files exist with rename mappings
- **Actual image files still have original names**
- Must execute `mv` commands to rename all files
- This is CRITICAL per Lesson 29

### Issue 2: H1 Titles Include Couple Names (ALL BLOGS)
- Current: "Beacon Hill Engagement Photos | Alyssa & Jason"
- Required: "Beacon Hill Engagement Photos"
- Couple names should appear in H2, not H1 (Lesson 2)

### Issue 3: No H2 with Couple Names (ALL BLOGS)
- Need to add H2 after H1 with couple names
- Example: "Alyssa & Jason's Beacon Hill Session"

### Issue 4: Word Count Exceeds Target (ALL BLOGS)
- Current range: 722-1277 words
- Target: 500-600 words
- Need to trim 120-670+ words per blog

### Issue 5: SEO Keyword Placement Inconsistent
- Some blogs lack keyword in first paragraph
- Some blogs lack keyword in any H2
- Need 2-4 mentions throughout post

### Issue 6: Britton Manor Missing Links (BLOG 4 ONLY)
- Need to add: brittonmanornc@gmail.com (mailto link)
- Need to add: brittonmanor.com/proposals (standard link)

---

## BLOG-BY-BLOG FIX SUMMARY

### Blog 1: Alyssa & Jason - Beacon Hill
**Directory:** 1-alyssa-jason-engagement/
**Word count:** 722 → Target: 550-600
**Trim needed:** ~120-170 words

**Fixes:**
1. ✅ Change H1 from "Beacon Hill Engagement Photos | Alyssa & Jason" → "Beacon Hill Engagement Photos"
2. ✅ Add H2 after H1: "Alyssa & Jason's Beacon Hill Session"
3. ✅ Add primary keyword to first paragraph
4. ✅ Trim content to 550-600 words
5. ✅ Rename 58 image files per image-renames.csv
6. ✅ Verify alt-text.json

### Blog 2: Trish & Mario - Uptown Charlotte Gandhi Park
**Directory:** 2-trish-mario-engagement/
**Word count:** 742 → Target: 550-600
**Trim needed:** ~140-190 words

**Fixes:**
1. ✅ Change H1 from "Uptown Charlotte Engagement Photos | Gandhi Park" → "Uptown Charlotte Engagement Photos"
2. ✅ Add H2: "Trish & Mario's Gandhi Park Session"
3. ✅ Add primary keyword to first paragraph
4. ✅ Trim content
5. ✅ Rename 61 image files per image-renames.csv
6. ✅ Verify alt-text.json

### Blog 3: Nicole & Jon - Brooklyn DUMBO
**Directory:** 3-nicole-jon-engagement/
**Word count:** 876 → Target: 550-600
**Trim needed:** ~270-320 words

**Fixes:**
1. ✅ Change H1 from "Brooklyn Engagement Photos | DUMBO Bridge Views" → "Brooklyn Engagement Photos"
2. ✅ Add H2: "Nicole & Jon's DUMBO Session"
3. ✅ Add primary keyword to first paragraph
4. ✅ Trim content significantly
5. ✅ Rename 45 image files per image-renames.csv
6. ✅ Verify alt-text.json

### Blog 4: Britton Manor Proposal
**Directory:** 4-britton-manor-proposal/
**Word count:** 1220 → Target: 550-600
**Trim needed:** ~620-670 words (MOST AGGRESSIVE)

**Fixes:**
1. ✅ Change H1 from "Britton Manor Proposal Photos | How to Plan It" → "Britton Manor Proposal Photos"
2. ✅ Add H2: "How to Plan Your Britton Manor Proposal" (this is a guide, not couple-specific)
3. ✅ Add mailto:brittonmanornc@gmail.com link
4. ✅ Add brittonmanor.com/proposals link
5. ✅ Trim content drastically (keep: intro, key logistics, packages, CTA)
6. ✅ Rename 76 image files per image-renames.csv
7. ✅ Verify alt-text.json

### Blog 5: Galit & Ari - Brooklyn Williamsburg
**Directory:** 5-galit-ari-engagement-party/
**Word count:** 1081 → Target: 550-600
**Trim needed:** ~480-530 words

**Fixes:**
1. ✅ Change H1 from "Brooklyn Engagement Party Photos | Galit & Ari" → "Brooklyn Engagement Party Photos"
2. ✅ Add H2: "Galit & Ari's Williamsburg Celebration"
3. ✅ Add primary keyword to first paragraph
4. ✅ Trim content significantly
5. ✅ Rename files per image-seo-data.csv
6. ✅ Verify alt-text.json

### Blog 6: Kelly & Ryan - Central Park Bethesda Terrace
**Directory:** 6-kelly-ryan-engagement/
**Word count:** 1165 → Target: 550-600
**Trim needed:** ~560-610 words

**Fixes:**
1. ✅ Change H1 from "Bethesda Terrace Engagement Photos | Central Park" → "Bethesda Terrace Engagement Photos"
2. ✅ Add H2: "Kelly & Ryan's Central Park Session"
3. ✅ Add primary keyword to first paragraph
4. ✅ Trim content significantly
5. ✅ Rename files per image-seo-data.csv
6. ✅ Verify alt-text.json

### Blog 7: Ellie & Maggie - South End Boston
**Directory:** 7. ellie & maggie Engagement Session/
**Word count:** 1277 → Target: 550-600
**Trim needed:** ~670-720 words (SECOND MOST AGGRESSIVE)

**Fixes:**
1. ✅ Change H1 from "South End Boston Engagement Photos | Ellie & Maggie" → "South End Boston Engagement Photos"
2. ✅ Add H2: "Ellie & Maggie's South End Session"
3. ✅ Add primary keyword to first paragraph
4. ✅ Trim content drastically
5. ✅ Rename files per image-seo-data.csv
6. ✅ Verify alt-text.json

---

## EXECUTION ORDER

1. **First:** Rename all image files (critical, time-consuming)
2. **Second:** Fix blog content (H1, H2, keyword placement, word count)
3. **Third:** Add Britton Manor links (Blog 4 only)
4. **Fourth:** Verify all fixes and document changes
5. **Fifth:** Generate summary for Walt review

---

## TRIMMING STRATEGY (Per Lesson 16)

**Keep:**
- Opening (couple + location intro)
- Key moments (2-3 specific location descriptions)
- Practical advice (timing, logistics, what to wear)
- CTA (soft invitation to reach out)

**Cut:**
- Repetitive location descriptions
- Overly detailed explanations
- Redundant practical tips
- Extra "lesson" sections
- Long explanations of what the gallery contains
- Multiple package breakdowns (Blog 4)

---

## IMAGE RENAMING COUNTS

- Blog 1: 58 files
- Blog 2: 61 files
- Blog 3: 45 files
- Blog 4: 76 files
- Blog 5: ? files (need to count)
- Blog 6: ? files (need to count)
- Blog 7: ? files (need to count)

**Total: 400-500+ files to rename**

---

## NEXT STEPS

1. Start with Blog 1 (smallest fixes)
2. Execute image renaming for Blog 1
3. Fix blog content for Blog 1
4. Verify Blog 1 complete
5. Repeat for Blogs 2-7
6. Document all changes
7. Generate review summary for Walt
