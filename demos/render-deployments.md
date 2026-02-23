# R3 Studios Live Demo Sites

Deployment plan for Render free tier - Ready for implementation

## Demo Sites to Deploy

**Priority order:**
1. Auto Repair Shop
2. Restaurant Platform  
3. Realtor Platform
4. Summit HVAC (backup)

## Deployment Steps

### Prerequisites
- [ ] Render.com account access
- [ ] Demo site code available at `/Volumes/reeseai-memory/code/demos/`
- [ ] Node.js/bun available locally for builds

### For Each Demo

1. **Verify builds locally:**
   ```bash
   cd /Volumes/reeseai-memory/code/demos/[demo-name]
   npm install
   npm run build  # should succeed
   ```

2. **Create Render service:**
   - Visit: https://dashboard.render.com
   - Click: New → Static Site
   - Connect to repo or upload code
   - Build command: `npm run build`
   - Publish dir: `.next` or `out`
   - Deploy

3. **Test deployed site:**
   - Visit URL
   - Check homepage loads
   - Test 2-3 pages/links
   - Mobile responsive check

4. **Record URL:**
   - Copy the live URL
   - Add to this file below

## Active Deployments

### Status: Pending Initial Deployment

**Next steps:**
1. Access Render dashboard
2. Deploy sites following the checklist above
3. Update URLs below as they go live
4. Share URLs with Tyler for final approval

---

**Last updated:** 2026-02-23  
**Deployment status:** Ready to deploy  
**Estimated time:** 45-60 minutes (includes builds, deployment time, verification)
