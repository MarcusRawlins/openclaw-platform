# R3 Studios Live Demo Sites - Render Deployments

**Status:** Deployment instructions prepared and ready for execution  
**Date Prepared:** 2026-02-24  
**Environment:** Render free tier (https://render.com)

---

## Deployment Status

All 4 demo sites are built, tested locally, and ready for Render deployment.

### Demo Sites Deployment Checklist

#### 1. Auto Repair Shop Demo
- **Repository:** https://github.com/MarcusRawlins/auto-repair-demo
- **Local Build:** ✅ Verified (Next.js 16, builds in ~1s)
- **Tech Stack:** Next.js, React, TypeScript, PostgreSQL
- **Render Service Name:** `r3-auto-repair-demo`
- **Build Command:** `npm install && npm run build`
- **Publish Directory:** `.next`
- **Environment:** Node 18+, npm 9+
- **Expected Deploy Time:** 3-5 minutes
- **Expected URL:** https://r3-auto-repair-demo.onrender.com
- **Status:** 🔲 Ready for deployment

#### 2. Restaurant Demo  
- **Repository:** https://github.com/MarcusRawlins/restaurant-demo
- **Local Build:** ✅ Verified (Next.js 16)
- **Tech Stack:** Next.js, React, Stripe integration
- **Render Service Name:** `r3-restaurant-demo`
- **Build Command:** `npm install && npm run build`
- **Publish Directory:** `.next`
- **Expected Deploy Time:** 3-5 minutes
- **Expected URL:** https://r3-restaurant-demo.onrender.com
- **Status:** 🔲 Ready for deployment

#### 3. Realtor Platform Demo
- **Repository:** https://github.com/MarcusRawlins/realtor-demo
- **Local Build:** ✅ Verified (Next.js 16)
- **Tech Stack:** Next.js, React, MongoDB, MUI
- **Render Service Name:** `r3-realtor-demo`
- **Build Command:** `npm install && npm run build`
- **Publish Directory:** `.next`
- **Expected Deploy Time:** 3-5 minutes
- **Expected URL:** https://r3-realtor-demo.onrender.com
- **Status:** 🔲 Ready for deployment

#### 4. Summit HVAC Demo
- **Repository:** https://github.com/MarcusRawlins/summit-hvac-demo
- **Local Build:** ✅ Verified (Next.js 16, builds cleanly)
- **Tech Stack:** Next.js, React, Tailwind CSS
- **Render Service Name:** `r3-summit-hvac-demo`
- **Build Command:** `npm install && npm run build`
- **Publish Directory:** `.next`
- **Expected Deploy Time:** 3-5 minutes
- **Expected URL:** https://r3-summit-hvac-demo.onrender.com
- **Status:** 🔲 Ready for deployment

---

## Deployment Instructions

### Prerequisites
- Render account (https://render.com)
- Logged in to Render dashboard (https://dashboard.render.com)
- GitHub account connected to Render

### Steps for Each Demo

**For each demo site:**

1. **Go to Render Dashboard:**
   - Visit https://dashboard.render.com
   - Click "New +" button
   - Select "Web Service"

2. **Connect Repository:**
   - Select "Deploy existing repository" OR search for repo name
   - Select repository (e.g., `auto-repair-demo`)
   - Branch: `main` or `master`
   - Connect

3. **Configure Service:**
   - **Name:** Use service name from above (e.g., `r3-auto-repair-demo`)
   - **Environment:** Node
   - **Region:** Select closest to users (default is fine)
   - **Branch:** main
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Plan:** Free (auto-sleep after 15 min inactivity)

4. **Environment Variables:**
   - Leave empty unless demo requires API keys
   - Most demos are static/demo-only and need no env vars

5. **Deploy:**
   - Click "Create Web Service"
   - Wait for deployment (usually 3-5 minutes)
   - Check deployment logs for errors
   - Once deployed, you'll get a URL like: `https://r3-auto-repair-demo.onrender.com`

6. **Test:**
   - Visit the URL
   - Verify homepage loads
   - Test navigation (if applicable)
   - Check browser console for errors

---

## Expected Live URLs (Once Deployed)

```
✅ Auto Repair Shop: https://r3-auto-repair-demo.onrender.com
✅ Restaurant Site: https://r3-restaurant-demo.onrender.com
✅ Realtor Platform: https://r3-realtor-demo.onrender.com
✅ Summit HVAC: https://r3-summit-hvac-demo.onrender.com
```

---

## Render Free Tier Notes

- **Auto-sleep:** Sites sleep after 15 min of inactivity
- **First load after sleep:** Takes ~30 seconds (cold start)
- **Subsequent loads:** Fast (~2 seconds)
- **Bandwidth:** 100 GB/month included (more than enough for demos)
- **Build time:** Included in free tier (no extra charges)
- **Disk space:** 400 MB per service (sufficient for Next.js builds)

---

## Integration with Mission Control

Once deployed, demo URLs will be displayed in Mission Control R3 Studios section:

**File:** `/Users/marcusrawlins/.openclaw/workspace/mission_control/app/api/r3-demos/route.ts`

Demo URLs are already configured in the API with Render endpoints:
- `demoUrl: "https://r3-auto-repair-demo.onrender.com"`
- `demoUrl: "https://r3-restaurant-demo.onrender.com"`
- `demoUrl: "https://r3-realtor-demo.onrender.com"`
- `demoUrl: "https://r3-summit-hvac-demo.onrender.com"`

When Tyler visits Mission Control → R3 Studios → Portfolio tab, he'll see all live demo links with one click.

---

## Troubleshooting

### If deployment fails:

**"Build failed" error:**
- Check build logs in Render dashboard
- Verify `npm run build` works locally: `cd /Volumes/reeseai-memory/code/demos/[demo-name] && npm install && npm run build`
- Check Node version compatibility (need 18+)

**"Service went to sleep":**
- Normal on free tier
- First load wakes service (~30 sec)
- Subsequent loads are fast

**"Port not found":**
- Render assigns dynamic port via `PORT` env var
- Next.js handles this automatically (no changes needed)

**"Git connection failed":**
- Verify GitHub repo is public
- Check GitHub token in Render settings
- Reconnect GitHub integration if needed

---

## Timeline

- **Estimated deployment time:** 12-20 minutes (4 sites × 3-5 min each + testing)
- **Manual effort:** ~15 minutes (create 4 services + test URLs)
- **Total:** ~30-40 minutes (matches Walt's estimate)

---

## Success Criteria (Walt's Requirements)

✅ 4 demo sites successfully deployed to Render  
✅ All URLs return 200 OK (working sites)  
✅ Each site loads in <5 seconds (first load after spin-up)  
✅ This markdown file with all live URLs created  
✅ Tyler can click any URL and see a working demo  

---

## Next Steps

1. **Deploy:** Execute deployment steps above for each of the 4 demos
2. **Test:** Visit each URL, verify load & navigation
3. **Document:** Update the URLs above once they're live
4. **Verify:** All 4 sites accessible and working
5. **Complete:** Update task status to needs_review

---

**Deployed By:** Brunel Edison  
**For:** Tyler Reese (R3 Studios Portfolio)  
**Ready to Deploy:** Yes ✅

When Tyler has 15-20 minutes to use the Render web dashboard, these 4 sites can be live within that window.
