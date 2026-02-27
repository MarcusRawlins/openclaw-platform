# R3 Studios Demo Sites - Render Deployment

**Deployed on:** Friday, February 27, 2026  
**Deployed by:** 🦫 Brunel (Subagent)  
**Platform:** Render.com  
**Status:** ✅ All sites live and accessible

---

## Deployed Sites

### 1. Auto Repair Demo
- **Service Name:** r3-auto-repair-demo
- **GitHub Repo:** https://github.com/MarcusRawlins/auto-repair-demo
- **Live URL:** https://r3-auto-repair-demo.onrender.com
- **Status:** ✅ Live (HTTP 200)
- **Service ID:** srv-d6dtdtfgi27c738mm5vg
- **Dashboard:** https://dashboard.render.com/static/srv-d6dtdtfgi27c738mm5vg

### 2. Restaurant Demo
- **Service Name:** r3-restaurant-demo
- **GitHub Repo:** https://github.com/MarcusRawlins/restaurant-demo
- **Live URL:** https://r3-restaurant-demo.onrender.com
- **Status:** ✅ Live (HTTP 200)
- **Service ID:** srv-d6dte195pdvs73fm0mmg
- **Dashboard:** https://dashboard.render.com/static/srv-d6dte195pdvs73fm0mmg

### 3. Realtor Demo
- **Service Name:** r3-realtor-demo
- **GitHub Repo:** https://github.com/MarcusRawlins/realtor-demo
- **Live URL:** https://r3-realtor-demo.onrender.com
- **Status:** ✅ Live (HTTP 200)
- **Service ID:** srv-d6dte0vgi27c738mm7fg
- **Dashboard:** https://dashboard.render.com/static/srv-d6dte0vgi27c738mm7fg

### 4. Summit HVAC Demo
- **Service Name:** r3-summit-hvac-demo
- **GitHub Repo:** https://github.com/MarcusRawlins/summit-hvac-demo
- **Live URL:** https://r3-summit-hvac-demo.onrender.com
- **Status:** ✅ Live (HTTP 200)
- **Service ID:** srv-d6dte1vgi27c738mm8k0
- **Dashboard:** https://dashboard.render.com/static/srv-d6dte1vgi27c738mm8k0

---

## Configuration

All services are configured as static sites with the following settings:

- **Environment:** Node 20
- **Build Command:** `npm install && npm run build`
- **Publish Path:** `./out` (Next.js static export)
- **Plan:** Free (Starter)
- **Auto Deploy:** Enabled (triggers on main branch commits)
- **Branch:** main

---

## Deployment Process

1. Services were already created on Render (created Feb 23, 2026)
2. Updated service configurations with correct build commands and publish paths
3. Triggered manual deploys for all services
4. Verified all deployments completed successfully
5. Confirmed all sites are accessible via HTTP 200 responses

---

## Notes

- All repositories contain `render.yaml` blueprint files
- Sites auto-deploy on push to main branch
- Free tier includes 750 hours/month per service
- Sites may spin down after inactivity and take ~30 seconds to wake up

---

**Verification:** All 4 R3 Studios demo sites are successfully deployed and accessible on Render.
