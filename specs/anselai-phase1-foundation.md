# AnselAI Phase 1: Backend Foundation

**Priority:** High
**Estimated Time:** 2-3 days
**Dependencies:** None (fresh build)

## Goal

Set up the AnselAI backend infrastructure: Next.js API routes, PostgreSQL database with Prisma, and basic platform connection management.

## Requirements

### 1. Project Setup

**Location:** `/workspace/anselai/`

**Already exists:**
- Next.js 16 structure
- Prisma configured
- Port 3200 configured

**Update needed:**
- Install additional dependencies
- Configure environment variables
- Set up database connection

### 2. Database Schema Migration

**File:** `prisma/schema.prisma`

**Add all tables from PRD:**
- platform_connections
- metrics
- content
- content_metrics
- ad_campaigns
- ad_metrics
- sync_log
- reviews
- inquiries
- bookings
- attribution

**Run migration:**
```bash
cd /workspace/anselai
npx prisma migrate dev --name init-integrations
npx prisma generate
```

### 3. API Routes Structure

Create the following API endpoints:

**Platform Connections:**
- `POST /api/connections` — add new platform connection
- `GET /api/connections` — list all connections
- `GET /api/connections/[platform]` — get specific connection
- `PUT /api/connections/[platform]` — update connection (refresh token)
- `DELETE /api/connections/[platform]` — remove connection
- `POST /api/connections/[platform]/test` — test connection

**Sync Management:**
- `POST /api/sync/[platform]` — trigger manual sync
- `GET /api/sync/status` — check sync status across platforms
- `GET /api/sync/log` — fetch sync history

**Metrics (basic endpoints):**
- `GET /api/metrics/overview` — high-level KPIs (stub for now)
- `GET /api/metrics/[platform]` — platform-specific metrics (stub)

### 4. Platform Connection Model

**File:** `src/lib/integrations/connection-manager.ts`

```typescript
export interface PlatformConnection {
  platform: string;
  accountId?: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  status: 'active' | 'expired' | 'error';
  lastSyncAt?: Date;
}

export class ConnectionManager {
  // Save connection
  static async saveConnection(connection: PlatformConnection): Promise<void>
  
  // Get connection
  static async getConnection(platform: string): Promise<PlatformConnection | null>
  
  // Test connection (make simple API call)
  static async testConnection(platform: string): Promise<boolean>
  
  // Refresh token (if expired)
  static async refreshToken(platform: string): Promise<void>
  
  // Remove connection
  static async removeConnection(platform: string): Promise<void>
}
```

### 5. Sync Scheduler Framework

**File:** `src/lib/integrations/sync-scheduler.ts`

Cron-based sync system:
- Hourly: Post engagement metrics
- Daily: Account metrics, ad performance
- Weekly: Demographics, audience insights

**Implementation:**
- Use node-cron or Next.js API route with setInterval
- Log all sync attempts to sync_log table
- Handle errors gracefully
- Support manual triggers via API

**Basic structure:**
```typescript
export class SyncScheduler {
  // Schedule a sync job
  static async scheduleSync(platform: string, frequency: 'hourly' | 'daily' | 'weekly'): Promise<void>
  
  // Run sync now (manual trigger)
  static async runSyncNow(platform: string): Promise<void>
  
  // Get next scheduled sync
  static async getNextSync(platform: string): Promise<Date | null>
}
```

### 6. Environment Variables

**Add to `.env`:**
```
# Database (already exists)
DATABASE_URL="postgresql://..."

# Google (already exists)
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_ANALYTICS_PROPERTY_ID="..."

# Meta (will be added later)
META_APP_ID=""
META_APP_SECRET=""

# Pinterest (will be added later)
PINTEREST_CLIENT_ID=""
PINTEREST_CLIENT_SECRET=""

# TikTok (already exists)
TIKTOK_EMAIL="..."
TIKTOK_PASSWORD="..."

# Encryption key (for token storage)
ENCRYPTION_KEY="generate-random-32-char-string"
```

### 7. Security: Token Encryption

**File:** `src/lib/security/encrypt.ts`

Encrypt tokens before storing in database:
```typescript
export function encryptToken(token: string): string
export function decryptToken(encryptedToken: string): string
```

Use `crypto` module with AES-256-GCM.

### 8. Basic Dashboard Layout

**File:** `src/app/page.tsx`

Create empty state dashboard:
- Header: "AnselAI — Photography Business Intelligence"
- Platform connection cards (empty states)
- "Connect Platform" buttons for each platform
- Status indicators (connected/disconnected)

**Pages to create:**
- `/` — Overview (empty state)
- `/connections` — Platform connections management
- `/sync` — Sync status and logs

### 9. Error Handling

All API routes should:
- Return consistent error format:
  ```json
  {
    "success": false,
    "error": "Error message",
    "code": "ERROR_CODE"
  }
  ```
- Log errors to console
- Save API errors to sync_log table

### 10. Testing

Create test script: `src/scripts/test-foundation.ts`

Test:
- Database connection
- Prisma queries work
- API routes respond
- Connection manager saves/retrieves
- Token encryption/decryption

## Deliverables

- [ ] Prisma schema with all tables migrated
- [ ] API routes structure created (stubs ok for now)
- [ ] ConnectionManager class working
- [ ] SyncScheduler framework in place
- [ ] Token encryption working
- [ ] Basic dashboard showing empty states
- [ ] Test script passing
- [ ] Git commit: "feat: AnselAI Phase 1 foundation"

## Notes

- Phase 2 (Google integration) will build on this foundation
- Don't implement actual platform sync logic yet — just the framework
- Focus on clean architecture, we'll fill in platform-specific code later
- All tokens encrypted before storage
- Database migrations tested and working

## Cost Consciousness

- No API calls in Phase 1 (just setup)
- Use environment variables for all credentials
- Token refresh logic prevents unnecessary re-auth
- Sync logs track API usage for monitoring
