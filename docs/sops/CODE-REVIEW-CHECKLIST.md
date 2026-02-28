# Code Review Checklist — Where to Look for Implementation

**Purpose:** Prevent false "not implemented" findings by knowing where code actually lives in our projects.

**Last Updated:** 2026-02-28  
**Owner:** 🦅 Walt  

---

## Quick Reference: Common File Locations

### AnselAI Project

**Source Directory:** `/workspace/anselai/src/`

| Component | Location | Notes |
|-----------|----------|-------|
| API Routes | `src/app/api/` | Next.js 15 App Router API routes |
| Authentication | `src/lib/auth.ts` | NextAuth.js configuration |
| Auth Routes | `src/app/api/auth/[...nextauth]/route.ts` | OAuth providers, callbacks |
| Components | `src/components/` | React components |
| Database Schema | `prisma/schema.prisma` | Prisma models |
| Database Migrations | `prisma/migrations/` | Migration history |
| Utilities | `src/lib/` | Helper functions, formatters, validators |
| Middleware | `src/middleware.ts` | Auth checks, IP restrictions |
| Config | `.env`, `next.config.js`, `tsconfig.json` | Environment and build config |

**Common Hidden Locations:**
- OAuth logic: `src/lib/auth.ts` (not in `/app/api/auth/`)
- Platform integrations: `src/lib/integrations/` or `src/lib/platforms/`
- Database utilities: `src/lib/db.ts` or `src/lib/prisma.ts`
- API helpers: `src/lib/api/` or `src/app/api/helpers.ts`

---

### Mission Control Project

**Source Directory:** `/workspace/mission_control/`

| Component | Location | Notes |
|-----------|----------|-------|
| API Routes | `app/api/` | Next.js API routes |
| Components | `components/` | React components (UI, layout, charts) |
| Data Files | `data/tasks.json`, `data/agents.json` | JSON data stores |
| Utilities | `lib/` | Formatting, calculations, gateway client |
| Config | `.env`, `next.config.js` | Environment and build config |
| Scripts | `scripts/` | Import scripts, maintenance utilities |

**Common Hidden Locations:**
- Gateway integration: `lib/gateway-client.ts` or `lib/websocket.ts`
- Data stores: `lib/tasks-store.ts`, `lib/agents-store.ts`
- Chart data: `lib/metrics.ts` or `lib/chart-data.ts`

---

### Finance Hub Project

**Source Directory:** `/workspace/finance-hub/src/`

| Component | Location | Notes |
|-----------|----------|-------|
| API Routes | `src/app/api/v1/` | Versioned API (v1, v2, etc.) |
| Authentication | `src/lib/auth.ts` | Session management |
| Database Schema | `prisma/schema.prisma` | PostgreSQL schemas (per-entity) |
| Components | `src/components/` | UI components |
| Utilities | `src/lib/` | Formatters, validators, parsers |
| Middleware | `src/middleware.ts` | Tailscale IP check, auth |
| Import Scripts | `src/scripts/` | CSV parsers, import pipelines |
| Config | `.env`, `next.config.ts` | Environment and build config |

**Common Hidden Locations:**
- CSV parsers: `src/lib/importers/` or `src/scripts/parsers/`
- Financial calculations: `src/lib/finance.ts` or `src/lib/accounting.ts`
- Entity config: `src/lib/entities.ts`

---

## Review Process: Verify Before Marking "Not Implemented"

### Step 1: Read the Spec Carefully
- What feature is being requested?
- What files should be created?
- What API endpoints should exist?
- What components should be built?

### Step 2: Check Standard Locations First
1. **API Endpoints:** Check `app/api/` or `src/app/api/`
2. **Components:** Check `components/` or `src/components/`
3. **Utilities:** Check `lib/` or `src/lib/`
4. **Database:** Check `prisma/schema.prisma`
5. **Config:** Check `.env`, `next.config.js`

### Step 3: Check Hidden/Non-Standard Locations
- `lib/integrations/` or `lib/platforms/` — Third-party API integrations (OAuth, Meta, Google)
- `middleware.ts` — Auth, IP checks, CORS
- `scripts/` — Import utilities, CLI tools
- `utils/` — Sometimes used instead of `lib/`
- Root-level files — `auth.config.ts`, custom config files

### Step 4: Search by Keyword
If you can't find a feature, search the codebase:
```bash
cd /workspace/[project]
grep -r "keyword" src/
grep -r "function-name" src/
grep -r "API-endpoint" src/
```

Example: Looking for Meta OAuth implementation
```bash
cd /workspace/anselai
grep -r "Meta" src/lib/
grep -r "facebook" src/lib/
grep -r "instagram" src/lib/
```

### Step 5: Check Git History
Recent commits often reveal what was just built:
```bash
cd /workspace/[project]
git log --oneline -10
git show [commit-hash]
```

### Step 6: Run TypeScript Type Check
If code exists but has errors, TypeScript will catch it:
```bash
cd /workspace/[project]
bun run type-check  # or npm run type-check
```
- **No errors:** Code compiles, likely implemented
- **Errors:** Code exists but has issues

---

## Common Review Mistakes to Avoid

### ❌ Mistake 1: Looking Only at API Routes
**Example:** Meta OAuth implementation was in `src/lib/auth.ts`, not `/app/api/meta-oauth/`.

**Fix:** Check `lib/` for business logic before marking "not implemented."

### ❌ Mistake 2: Expecting Exact File Names from Spec
**Example:** Spec says "create endpoint `/api/v1/entities/:entityId/summary`"  
You look for: `/app/api/entities/summary/route.ts`  
Actual location: `/app/api/v1/entities/[entityId]/summary/route.ts`

**Fix:** Understand Next.js dynamic routes (`[param]`) and versioned APIs (`v1/`, `v2/`).

### ❌ Mistake 3: Missing Placeholder/TODO Comments
**Example:** Code exists with `// TODO: Implement real API call` and returns placeholder data.

**Fix:** Search for `TODO`, `FIXME`, `placeholder` in the codebase. If found, mark as "incomplete" not "implemented."

### ❌ Mistake 4: Not Checking Database Migrations
**Example:** Spec requires new database table, but you only check `schema.prisma`.

**Fix:** Check `prisma/migrations/` to verify schema changes were applied.

### ❌ Mistake 5: Forgetting to Test the Feature
**Example:** Code exists, compiles, but doesn't actually work when tested.

**Fix:** If possible, run the dev server and test the feature manually or via curl.

---

## Quick Verification Commands

### Check if API Endpoint Exists
```bash
# Find all route.ts files under /api/
find src/app/api -name "route.ts" | grep [search-term]

# Example: Find entity summary endpoint
find src/app/api -name "route.ts" | grep summary
```

### Check if Component Exists
```bash
# Find component by name
find src/components -name "[ComponentName].tsx"

# Example: Find skeleton component
find src/components -name "skeleton.tsx"
```

### Search for Function/Class Implementation
```bash
# Search for function or class definition
grep -r "function functionName" src/
grep -r "class ClassName" src/

# Example: Find entity summary calculation
grep -r "getEntitySummary" src/
```

### Check Database Schema
```bash
# Show all models in schema
cat prisma/schema.prisma | grep "^model "

# Example: Check if Contact model exists
cat prisma/schema.prisma | grep "^model Contact"
```

---

## Project-Specific Notes

### AnselAI
- **OAuth Providers:** Defined in `src/lib/auth.ts`, not individual route files
- **Platform Integrations:** Check `src/lib/integrations/` before marking "not implemented"
- **Database:** Uses PostgreSQL with Prisma (multi-entity schema)

### Mission Control
- **Task System:** `data/tasks.json` is the source of truth, not a database
- **WebSocket:** Gateway integration is in `lib/gateway-client.ts`
- **Charts:** Recharts components in `components/charts/`

### Finance Hub
- **Multi-Schema Database:** Each entity (anselai, r3studios, family) has its own schema
- **Versioned API:** All endpoints under `/api/v1/`, not `/api/`
- **BigInt Handling:** All amounts stored as BigInt (cents), converted to number for API responses
- **Import Scripts:** CSV parsers in `src/scripts/`, not API routes

---

## Review Score Calibration

### 95%+ Threshold = Production-Ready
To pass, implementation must have:
1. ✅ All spec requirements met (features, endpoints, components)
2. ✅ TypeScript compiles with no errors
3. ✅ No placeholder/TODO code in critical paths
4. ✅ Proper error handling
5. ✅ Security considerations (auth, validation, confidentiality)
6. ✅ Code quality (clean, readable, follows project patterns)

### Common Deductions
- Missing API endpoint: **-15%**
- TypeScript compilation error: **-8%**
- Missing UI component (e.g., skeleton): **-5%**
- Placeholder data instead of real implementation: **-10% to -20%**
- Security issue (missing auth, no validation): **-10% to -15%**

---

## Continuous Improvement

### After Each Review
1. **Did I miss any implemented code?** → Update this checklist with new hiding spots
2. **Did I give a false "needs_revision"?** → Document the mistake in `lessons.md`
3. **Did I spend >30 minutes searching?** → Add search commands to this guide

### Monthly Audit
- Review all NEEDS_REVISION grades from last month
- Identify patterns in false positives
- Update checklist with new lessons learned

---

## Summary: Before Marking "Not Implemented"

1. ✅ Check standard locations (`app/api/`, `components/`, `lib/`)
2. ✅ Check hidden locations (`lib/integrations/`, `middleware.ts`, `scripts/`)
3. ✅ Search by keyword (`grep -r "feature-name" src/`)
4. ✅ Check git history (`git log --oneline -10`)
5. ✅ Run type check (`bun run type-check`)
6. ✅ Look for TODO/placeholder comments
7. ✅ Verify database migrations (`prisma/migrations/`)
8. ✅ Test the feature if possible

**Golden Rule:** If in doubt, search the entire src/ directory before marking "not implemented."

---

**Maintained by:** 🦅 Walt  
**Next Review:** Monthly (1st of each month)  
**Changelog:**
- 2026-02-28: Initial version (post Meta OAuth false negative)
