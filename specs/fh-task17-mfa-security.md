# Finance Hub — Task 17: TOTP MFA + Security Hardening

> 🦞 Marcus Rawlins | v1.0 | 2026-02-28
> Parent PRD: Section 4 (Security), Phase 3 deliverables
> Phase: 3 — Reporting & Tax
> Dependencies: Tasks 1-14 complete (needs auth infrastructure)

---

## Objective

Add TOTP-based multi-factor authentication (Google Authenticator / Authy compatible), backup codes, session management, and password change flow. MFA is required for login and sensitive operations (export, API key management, bulk delete).

## Build Location

`/Users/marcusrawlins/.openclaw/workspace/finance-hub/`

## Context: What Already Exists

Read ALL of these before writing any code:

- `prisma/schema.prisma` — User model (you'll extend it)
- `src/app/api/auth/[...nextauth]/route.ts` — NextAuth configuration
- `src/middleware.ts` — Existing auth middleware
- `src/app/(auth)/login/page.tsx` — Login page (you'll add MFA step)
- `src/lib/encryption.ts` — Existing encryption utilities (reuse for TOTP secret storage)
- `src/lib/db.ts` — Prisma client

## Architecture

### New Files

```
src/
├── app/
│   ├── (auth)/
│   │   ├── mfa-setup/
│   │   │   └── page.tsx             # MFA enrollment (QR code + verify)
│   │   ├── mfa-verify/
│   │   │   └── page.tsx             # MFA challenge during login
│   │   └── backup-codes/
│   │       └── page.tsx             # Display/regenerate backup codes
│   ├── (dashboard)/
│   │   └── settings/
│   │       ├── security/
│   │       │   └── page.tsx         # Security settings (MFA, password, sessions)
│   │       └── page.tsx             # Settings index (if not exists)
│   └── api/
│       └── v1/
│           └── auth/
│               ├── mfa/
│               │   ├── setup/
│               │   │   └── route.ts   # POST: generate TOTP secret + QR
│               │   ├── verify/
│               │   │   └── route.ts   # POST: verify TOTP code (enrollment + login)
│               │   ├── disable/
│               │   │   └── route.ts   # POST: disable MFA (requires current TOTP)
│               │   └── backup-codes/
│               │       └── route.ts   # POST: generate new backup codes
│               ├── password/
│               │   └── route.ts       # POST: change password
│               └── sessions/
│                   └── route.ts       # GET: list sessions, DELETE: revoke session
├── lib/
│   └── auth/
│       ├── totp.ts                  # TOTP generation, verification, QR code
│       ├── backup-codes.ts          # Backup code generation + validation
│       ├── session-manager.ts       # Session tracking + revocation
│       ├── mfa-middleware.ts        # Middleware for MFA-required operations
│       └── __tests__/
│           ├── totp.test.ts
│           ├── backup-codes.test.ts
│           └── mfa-middleware.test.ts
```

### Prisma Schema Changes

Extend the User model:

```prisma
// Add to User model:
  totpSecret      Bytes?     @map("totp_secret")       // AES-256-GCM encrypted
  totpEnabled     Boolean    @default(false) @map("totp_enabled")
  totpVerifiedAt  DateTime?  @map("totp_verified_at") @db.Timestamptz
  backupCodes     Json?      @map("backup_codes")       // Array of hashed codes
  backupCodesUsed Int        @default(0) @map("backup_codes_used")
```

Add a Session model for tracking:

```prisma
model Session {
  id          String   @id @default(uuid()) @db.Uuid
  userId      String   @map("user_id") @db.Uuid
  token       String   @unique @db.VarChar(255)       // Hashed JWT or session ID
  ipAddress   String?  @map("ip_address") @db.VarChar(45)
  userAgent   String?  @map("user_agent") @db.VarChar(500)
  lastActiveAt DateTime @default(now()) @map("last_active_at") @db.Timestamptz
  expiresAt   DateTime @map("expires_at") @db.Timestamptz
  revokedAt   DateTime? @map("revoked_at") @db.Timestamptz
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz

  user        User     @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([token])
  @@map("sessions")
}
```

Add `sessions Session[]` to the User model's relations.

## Detailed Requirements

### 1. TOTP Implementation (`totp.ts`)

Use the `otpauth` npm package (or equivalent) for TOTP:

```typescript
interface TOTPSetupResult {
  secret: string           // Base32-encoded secret (for storage)
  uri: string              // otpauth:// URI for QR code
  qrDataUrl: string        // Data URL of QR code image (use qrcode package)
}

function generateTOTPSetup(userEmail: string): TOTPSetupResult
function verifyTOTP(secret: string, token: string): boolean
```

Configuration:
- Issuer: `Finance Hub`
- Algorithm: SHA-1 (standard for Google Authenticator compatibility)
- Digits: 6
- Period: 30 seconds
- Window: 1 (accept codes from ±1 period for clock skew)

**Secret storage**: Encrypt the TOTP secret using AES-256-GCM (reuse `src/lib/encryption.ts`) before storing in the database. The secret must NEVER be stored in plaintext.

### 2. Backup Codes (`backup-codes.ts`)

```typescript
function generateBackupCodes(): { codes: string[], hashedCodes: string[] }
function verifyBackupCode(code: string, hashedCodes: string[]): { valid: boolean, remainingIndex: number }
```

- Generate 10 single-use backup codes
- Each code: 8 alphanumeric characters, formatted as `XXXX-XXXX` for readability
- Store bcrypt hashes of the codes in the database
- When a backup code is used: mark it as consumed (remove from the array)
- Display codes only once during generation (user must save them)
- Ability to regenerate (replaces all existing codes, requires current TOTP or password)

### 3. MFA Enrollment Flow

**POST /api/v1/auth/mfa/setup**
- Requires: authenticated session
- Returns: `{ secret, qrDataUrl, backupCodes }` (secret encrypted before storage)
- Does NOT enable MFA yet — user must verify first

**POST /api/v1/auth/mfa/verify** (enrollment)
- Body: `{ token: "123456" }` (6-digit TOTP code)
- Verifies the code against the stored secret
- If valid: sets `totpEnabled = true`, `totpVerifiedAt = now()`
- Returns: `{ success: true, backupCodes: ["XXXX-XXXX", ...] }` (one-time display)

**POST /api/v1/auth/mfa/disable**
- Body: `{ token: "123456" }` (current TOTP code required)
- Sets `totpEnabled = false`, clears `totpSecret` and `backupCodes`
- Audit logged

### 4. Login Flow with MFA

Modify the existing NextAuth flow:

1. User enters email + password → validated
2. If `totpEnabled`:
   - Return a partial session token (not fully authenticated)
   - Redirect to `/mfa-verify`
   - User enters 6-digit TOTP code OR a backup code
   - **POST /api/v1/auth/mfa/verify** (login context)
   - Body: `{ token: "123456", type: "totp" | "backup" }`
   - If valid: upgrade to full session, redirect to dashboard
   - If invalid: show error, allow retry (max 5 attempts, then lock for 15 minutes)
3. If NOT `totpEnabled`: normal login (no change)

### 5. MFA-Required Operations (`mfa-middleware.ts`)

Certain operations require re-verification even with an active session:

```typescript
const MFA_REQUIRED_OPERATIONS = [
  'report.export',
  'apikey.create',
  'apikey.revoke',
  'transaction.bulk_delete',
  'settings.mfa_disable',
  'settings.password_change',
]
```

Implementation:
- When a protected operation is attempted:
  - Check if user has verified MFA within the last 15 minutes (store `lastMfaVerifiedAt` in session)
  - If yes: proceed
  - If no: return 403 with `{ error: "MFA_REQUIRED", operation: "report.export" }`
  - Frontend shows a TOTP prompt modal, re-verifies, then retries the operation

### 6. Session Management

**GET /api/v1/auth/sessions**
- Returns: list of active sessions for the current user
- Each session: `{ id, ipAddress, userAgent, lastActiveAt, createdAt, isCurrent }`

**DELETE /api/v1/auth/sessions/:id**
- Revokes a specific session (sets `revokedAt`)
- Cannot revoke current session (use logout instead)
- Audit logged

**DELETE /api/v1/auth/sessions** (no ID)
- Revokes ALL sessions except current ("log out everywhere else")
- Audit logged

### 7. Password Change

**POST /api/v1/auth/password**

Body:
```typescript
interface PasswordChangeRequest {
  currentPassword: string
  newPassword: string        // Min 12 chars
  mfaToken?: string          // Required if MFA enabled
}
```

Validation:
- Current password must match
- New password: minimum 12 characters, at least 1 uppercase, 1 lowercase, 1 number
- MFA token required if MFA is enabled
- After password change: revoke all sessions except current
- Audit logged

### 8. Security Settings UI (`settings/security/page.tsx`)

Single page with three sections:

**MFA Section:**
- If not enrolled: "Enable Two-Factor Authentication" button → enrollment flow
- If enrolled: status badge (✓ Enabled), date enabled, "Disable MFA" button
- "Regenerate Backup Codes" button (shows remaining count)

**Password Section:**
- "Change Password" form: current password, new password, confirm new password
- Password strength indicator

**Active Sessions Section:**
- Table: device/browser (parsed from user agent), IP address, last active, status
- Current session highlighted
- "Revoke" button per session
- "Revoke All Other Sessions" button

### 9. Audit Logging

All MFA and security operations MUST be audit logged:
- MFA setup initiated
- MFA enabled (verification successful)
- MFA disabled
- MFA login verification (success + failure)
- Backup code used (include which code index)
- Password changed
- Session revoked
- Failed login attempts (with count)

Use the existing audit log infrastructure (`AuditLog` model).

## Testing Requirements

1. **TOTP generation**: Verify generated secrets produce valid TOTP codes
2. **TOTP verification**: Verify correct code passes, wrong code fails
3. **Window tolerance**: Verify codes from ±1 period are accepted
4. **Backup code generation**: Verify 10 codes generated, all unique
5. **Backup code consumption**: Verify used code cannot be reused
6. **Backup code format**: Verify XXXX-XXXX format
7. **Enrollment flow**: Setup → verify → enabled (mock the full flow)
8. **Login with MFA**: Password OK → MFA challenge → verify → session
9. **Login lockout**: 5 failed MFA attempts → 15 minute lockout
10. **MFA-required ops**: Protected operation without recent MFA → 403
11. **MFA-required ops**: Protected operation with recent MFA (<15min) → allowed
12. **Password validation**: Reject <12 chars, reject all-lowercase, accept valid
13. **Session revocation**: Revoke session → subsequent requests with that session fail
14. **Secret encryption**: Verify TOTP secret is stored encrypted, not plaintext

## Dependencies (npm packages)

- `otpauth` — TOTP generation and verification
- `qrcode` — QR code generation (data URL output)
- Both are small, well-maintained, no native deps.

## Constraints

- TOTP secrets stored AES-256-GCM encrypted using `FINANCE_ENCRYPTION_KEY` env var
- Backup codes stored as bcrypt hashes
- No SMS-based MFA (TOTP only)
- Google Authenticator / Authy compatible (standard RFC 6238)
- Login lockout: 5 failed attempts → 15 minute cooldown
- Session lifetime: 4 hours (unchanged from existing)
- MFA re-verification window: 15 minutes for sensitive operations
- `bun test` and `bun run build` must pass.
- Git commit: `🦫 Brunel: Task 17 — TOTP MFA + Security Hardening`

## Review

Walt must score 95%+. Marcus (Opus) must score 99%+.
