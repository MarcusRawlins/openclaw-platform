# Finance Hub — Task 18: REST API + API Key Management

> 🦞 Marcus Rawlins | Spec v1.0 | 2026-02-28
> Parent PRD: `/workspace/specs/finance-hub-prd.md` (Section 8)
> Phase 4 Overview: `/workspace/specs/fh-phase4-overview.md`
> Review: Walt must score 95%+. Marcus (Opus) must score 99%+.

---

## Objective

Formalize the REST API as a stable, authenticated, rate-limited external interface. Add API key management with entity-level scoping so AnselAI, R3 Studios, and Mission Control can each access only their permitted data.

## Build Location

`/Users/marcusrawlins/.openclaw/workspace/finance-hub/`

## Context: What Already Exists

Phase 1-3 built internal API routes at `/api/v1/`. This task:
1. Adds API key authentication layer (separate from session auth)
2. Enforces entity-level scoping per key
3. Adds rate limiting
4. Standardizes all responses
5. Adds API key management UI
6. Generates OpenAPI spec

**Do not break existing session-authenticated routes.** API key auth is an ADDITIONAL auth method. Routes should accept either session auth (browser) or API key auth (external).

## Architecture

```
src/lib/
├── api-auth.ts              # NEW — API key validation middleware
├── rate-limit.ts            # NEW — rate limiting (in-memory or Redis-backed)
└── api-response.ts          # NEW — standardized response helpers

src/app/api/v1/
├── keys/
│   ├── route.ts             # GET (list keys), POST (create key)
│   └── [id]/route.ts        # PATCH (update), DELETE (revoke)
└── (existing routes)        # Add api-auth middleware

src/app/(dashboard)/settings/
├── api-keys/
│   └── page.tsx             # API key management UI

src/app/api/
└── openapi/route.ts         # GET — returns OpenAPI JSON spec
```

## Detailed Requirements

### 1. API Key Model

Use the existing `ApiKey` model in Prisma (Phase 1 schema). Verify it has:

```prisma
model ApiKey {
  id            String   @id @default(uuid()) @db.Uuid
  name          String                           // "AnselAI CRM Key"
  keyHash       String   @unique @map("key_hash") // SHA-256 of the actual key
  keyPrefix     String   @map("key_prefix")      // first 8 chars for identification
  entityIds     String[] @map("entity_ids")      // which entities this key can access
  permissions   String[] @default(["read"])       // read, write, admin
  rateLimit     Int      @default(100) @map("rate_limit") // requests per minute
  lastUsedAt    DateTime? @map("last_used_at")
  expiresAt     DateTime? @map("expires_at")
  isActive      Boolean  @default(true) @map("is_active")
  createdAt     DateTime @default(now()) @map("created_at")
  createdBy     String   @map("created_by") @db.Uuid

  @@map("api_keys")
  @@schema("shared")
}
```

If the model doesn't have all these fields, add them via migration.

### 2. Key Generation

```typescript
// Key format: fhk_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX (fhk_ prefix + 32 random hex chars)
import { randomBytes, createHash } from 'crypto';

export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const raw = randomBytes(32).toString('hex');
  const key = `fhk_${raw}`;
  const hash = createHash('sha256').update(key).digest('hex');
  const prefix = key.substring(0, 12); // "fhk_XXXXXXXX"
  return { key, hash, prefix };
}
```

**The full key is shown ONCE on creation.** Only the hash is stored. The prefix is stored for identification in logs.

### 3. API Key Authentication Middleware (`api-auth.ts`)

```typescript
export async function authenticateApiRequest(req: Request): Promise<{
  authenticated: boolean;
  keyId?: string;
  entityIds?: string[];
  permissions?: string[];
  error?: string;
}> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer fhk_')) {
    return { authenticated: false, error: 'Missing or invalid API key' };
  }
  
  const key = authHeader.replace('Bearer ', '');
  const hash = createHash('sha256').update(key).digest('hex');
  
  // Look up key by hash
  const apiKey = await sharedClient.apiKey.findUnique({ where: { keyHash: hash } });
  
  if (!apiKey || !apiKey.isActive) {
    return { authenticated: false, error: 'Invalid or revoked API key' };
  }
  
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return { authenticated: false, error: 'API key expired' };
  }
  
  // Update lastUsedAt (fire and forget)
  sharedClient.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() }
  }).catch(() => {});
  
  return {
    authenticated: true,
    keyId: apiKey.id,
    entityIds: apiKey.entityIds,
    permissions: apiKey.permissions
  };
}
```

### 4. Entity Scope Enforcement

Every API route that accesses entity data must check:
```typescript
if (!authResult.entityIds.includes(entityId)) {
  return Response.json({
    error: 'ENTITY_ACCESS_DENIED',
    message: `API key does not have access to entity '${entityId}'`,
    status: 403
  }, { status: 403 });
}
```

### 5. Rate Limiting (`rate-limit.ts`)

In-memory sliding window (no Redis dependency for now):

```typescript
const windows: Map<string, { count: number; resetAt: number }> = new Map();

export function checkRateLimit(keyId: string, limit: number): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const windowMs = 60_000; // 1 minute
  const entry = windows.get(keyId);
  
  if (!entry || entry.resetAt < now) {
    windows.set(keyId, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }
  
  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }
  
  entry.count++;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}
```

Add rate limit headers to all API responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1709078400
```

Return 429 when exceeded:
```json
{
  "error": "RATE_LIMITED",
  "message": "Rate limit exceeded. Try again in 45 seconds.",
  "status": 429
}
```

### 6. Standardized Response Format (`api-response.ts`)

All API responses follow this shape:

**Success:**
```json
{
  "data": { ... },
  "meta": {
    "currency": "USD",
    "amounts_in": "cents",
    "confidential": true,
    "period": "2026-02",
    "generated_at": "2026-02-28T12:00:00Z"
  }
}
```

**List responses:**
```json
{
  "data": [ ... ],
  "meta": { ... },
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 234,
    "totalPages": 5
  }
}
```

**Error:**
```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable description",
  "status": 400
}
```

### 7. Dual Auth on Existing Routes

Modify the existing API routes to accept EITHER:
- Session auth (NextAuth session cookie) — for browser UI
- API key auth (Bearer token) — for external integrations

Create a unified auth wrapper:
```typescript
export async function authenticateRequest(req: Request): Promise<AuthResult> {
  // Try session auth first (for browser)
  const session = await getServerSession(authOptions);
  if (session) {
    return { authenticated: true, type: 'session', userId: session.user.id, entityIds: 'all' };
  }
  
  // Try API key auth
  return authenticateApiRequest(req);
}
```

### 8. API Key Management UI (`settings/api-keys/page.tsx`)

**List view:**
- Table: Name, Prefix (fhk_XXXX...), Entities, Permissions, Last Used, Created, Status, Actions
- Create button (opens form)
- Revoke button (with confirmation)

**Create form:**
- Name (text input)
- Entity permissions (multi-select checkboxes: AnselAI, R3 Studios, Family)
- Permission level (read-only, read-write, admin)
- Expiration (optional: 30 days, 90 days, 1 year, never)
- On create: show the full key ONCE in a modal with copy button and warning

**Key display modal:**
```
┌─────────────────────────────────────────────┐
│  🔑 API Key Created                         │
│                                              │
│  fhk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6     │
│                               [📋 Copy]     │
│                                              │
│  ⚠️ Save this key now. You won't be able    │
│  to see it again.                            │
│                                              │
│                          [Done]              │
└─────────────────────────────────────────────┘
```

### 9. OpenAPI Spec Generation

Create a static or dynamically generated OpenAPI 3.0 spec at `GET /api/openapi`:

Document all endpoints with:
- Path, method, description
- Request parameters and body schema
- Response schema with examples
- Authentication requirements
- Rate limit info

Use TypeScript types to generate the spec, or write it manually as JSON. Either approach is fine as long as it stays in sync with actual endpoints.

### 10. Audit Logging

All API key operations logged:
- Key created (who, what permissions)
- Key revoked (who, which key)
- Key used (endpoint, entity accessed) — logged to AuditLog, NOT per-request (sample: 1 in 100)
- Unauthorized attempts (wrong key, expired key, wrong entity scope)

## Sidebar Navigation

Add to global settings:
```
⚙️ Settings
├── 🔑 API Keys    ← This task
├── 👤 Profile
└── 🔒 Security
```

## Testing Requirements

1. **Key generation:** Create key, verify hash stored, prefix matches
2. **Authentication:** Valid key returns data, invalid key returns 401, expired key returns 401
3. **Entity scoping:** Key with AnselAI scope can access AnselAI, gets 403 on R3
4. **Rate limiting:** Send 101 requests in 1 minute, verify 429 on 101st
5. **Dual auth:** Same endpoint works with session cookie and API key
6. **Key revocation:** Revoke key, verify subsequent requests return 401
7. **Response format:** All endpoints return standardized shape

## Constraints

- **Money is BIGINT cents** in all API responses.
- **Keys are hashed.** Never store plaintext keys. Never log full keys.
- **No Redis required.** In-memory rate limiting is fine for our scale.
- **Confidential flag** on all financial responses. External consumers should respect this.
- **OWNER role only** can manage API keys.
