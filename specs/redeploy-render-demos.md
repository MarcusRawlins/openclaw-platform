# Redeploy Demo Sites to Render - Implementation Spec

**Assigned to:** Brunel  
**Priority:** HIGH  
**Estimated time:** 30-45 minutes

---

## Objective

Redeploy 4-5 best demo sites to Render free tier with working live URLs.

---

## Demo Sites to Deploy

**Priority order (pick top 4):**

1. **Auto Repair Shop** - `/Volumes/reeseai-memory/code/demos/auto-repair-demo/`
2. **Wedding CRM** - `/Volumes/reeseai-memory/code/demos/wedding-crm/` (if exists)
3. **Restaurant Platform** - `/Volumes/reeseai-memory/code/demos/restaurant-demo/`
4. **Realtor Platform** - `/Volumes/reeseai-memory/code/demos/realtor-demo/`

**Backup options:**
5. Summit HVAC - `/Volumes/reeseai-memory/code/demos/summit-hvac-demo/`
6. Plumbing - `/Volumes/reeseai-memory/code/demos/apex-plumbing-demo-v2/`

---

## Requirements

### For Each Demo:

1. **Verify it builds locally:**
   ```bash
   cd /Volumes/reeseai-memory/code/demos/[demo-name]
   npm install  # or bun install
   npm run build  # verify no errors
   ```

2. **Create Render service:**
   - Name format: `r3-[industry]-demo` (e.g., `r3-auto-repair-demo`)
   - Type: Static Site
   - Build command: `npm run build` or `bun run build`
   - Publish directory: `out` or `.next` (depends on Next.js config)
   - Free tier: Yes

3. **Deploy and verify:**
   - Wait for deployment to complete
   - Visit the URL and verify it loads
   - Check that all pages work (no 404s)
   - Screenshot the homepage

4. **Record the URL:**
   - Add to a markdown file: `/workspace/demos/render-deployments.md`
   - Format: `- [Demo Name](https://url.onrender.com) - Description`

---

## Deliverables

Create `/workspace/demos/render-deployments.md` with:

```markdown
# R3 Studios Live Demo Sites

Deployed on Render (free tier) - 2026-02-22

## Active Demos

1. **Auto Repair Shop**
   - URL: https://r3-auto-repair-demo.onrender.com
   - Description: Complete web solution for auto repair businesses
   - Tech: Next.js, React, TypeScript, PostgreSQL
   - Status: ✅ Live

2. **Wedding CRM**
   - URL: https://r3-wedding-crm-demo.onrender.com
   - Description: CRM for wedding photographers and planners
   - Tech: Next.js, React, Prisma, PostgreSQL
   - Status: ✅ Live

[... etc for each deployed demo]

## Deployment Notes

- Free tier: Sites spin down after 15 min inactivity
- First load after inactivity: ~30 seconds
- All sites use responsive design
- Mobile-friendly
```

---

## Render Account

- Login at: https://render.com
- Use Tyler's account (credentials in `.env` or ask Tyler)
- Dashboard: https://dashboard.render.com

---

## Testing Checklist

For each deployed site:
- [ ] URL loads without errors
- [ ] Homepage renders correctly
- [ ] Navigation works
- [ ] Mobile responsive (test on phone)
- [ ] No console errors
- [ ] Images load (if any)

---

## Acceptance Criteria

1. 4 demo sites successfully deployed to Render
2. All URLs return 200 OK (working sites)
3. Each site loads in <5 seconds (first load after spin-up)
4. Markdown file with all live URLs created
5. Tyler can click any URL and see a working demo

---

## Notes

- Render free tier auto-sleeps after inactivity (expected)
- First load wakes it up (~30s)
- If a demo won't build, skip it and move to backup
- Document any issues encountered per site

---

## Failure Cases

**If a demo won't deploy:**
1. Note the error in the markdown file
2. Try the backup option instead
3. Document why it failed
4. Move on to next demo

**Don't spend >15 min debugging one demo.** Goal is 4 working deployments, not perfect deployments.
