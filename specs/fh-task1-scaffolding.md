# Finance Hub — Task 1: Scaffolding + Database

> 🦞 Marcus Rawlins | Spec v1.1 | 2026-02-27
> Parent PRD: `/workspace/specs/finance-hub-prd.md`
> Review: Walt must score 95%+. Marcus (Opus) must score 99%+. Below threshold → back to Brunel.

---

## Objective

Stand up the Finance Hub application skeleton: Next.js 15 with Bun, PostgreSQL with schema-per-entity, Prisma 7 models, authentication, audit logging, and Tailscale-only access middleware. No feature UI yet. This is pure foundation.

## Build Location

`/Users/marcusrawlins/.openclaw/workspace/finance-hub/`

## Tech Stack

- **Runtime:** Bun
- **Framework:** Next.js 15 with App Router
- **ORM:** Prisma 7 with `@prisma/adapter-pg` for PostgreSQL
- **Database:** PostgreSQL — database name `finance_hub`
- **Auth:** NextAuth.js v5 with CredentialsProvider, JWT in httpOnly/Secure/SameSite=Strict cookie
- **Styling:** Tailwind CSS 4
- **Charts:** Recharts 2+ (install now, used in Task 3)

## Critical Architecture Decisions

These come from the PRD. Do not deviate.

1. **Money is stored as BIGINT in cents.** No floats. No Decimal columns for storage. Display formatting at UI layer only.
2. **Double-entry bookkeeping.** Every transaction has TransactionLines where SUM(debits) = SUM(credits). This invariant is enforced at the application layer.
3. **Soft deletes.** Transactions have `deletedAt` column. Never hard-delete financial data.
4. **Audit log is append-only.** No UPDATE or DELETE on audit_log. Ever.
5. **Schema isolation.** Each entity gets its own PostgreSQL schema. Prisma client factory switches schema based on entity context.
6. **4-hour session lifetime** with sliding window. NOT 24 hours.
7. **UUID primary keys** (`@default(uuid()) @db.Uuid`), not CUID.
8. **Column naming:** Use `@map("snake_case")` for all columns. Prisma fields are camelCase, DB columns are snake_case.

## File Structure

```
finance-hub/
├── prisma/
│   ├── schema.prisma           # Full Prisma schema (see PRD Section 14)
│   ├── seed.ts                 # Seed: entities, admin user, chart of accounts
│   └── migrations/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout, dark theme, font loading
│   │   ├── page.tsx            # Redirect to /dashboard
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx  # Login page (minimal, functional)
│   │   │   └── layout.tsx      # Auth layout (no sidebar)
│   │   ├── (dashboard)/
│   │   │   ├── page.tsx        # Placeholder: "Finance Hub — Dashboard coming in Task 3"
│   │   │   └── layout.tsx      # Dashboard layout with sidebar skeleton
│   │   └── api/
│   │       ├── auth/
│   │       │   └── [...nextauth]/route.ts  # NextAuth.js handler
│   │       └── health/route.ts
│   ├── lib/
│   │   ├── db.ts               # Prisma client factory (schema-switching pattern)
│   │   ├── auth.ts             # NextAuth config (credentials provider, JWT)
│   │   ├── encryption.ts       # AES-256-GCM helpers for account numbers
│   │   ├── audit.ts            # Audit log middleware (append-only writes)
│   │   └── network.ts          # Tailscale/local IP check middleware
│   ├── components/
│   │   └── ui/                 # Empty dir, ready for Task 3
│   ├── types/
│   │   └── index.ts            # Shared TypeScript types
│   └── middleware.ts           # Next.js middleware: IP check + auth guard
├── public/
├── tailwind.config.ts
├── next.config.ts
├── tsconfig.json
├── package.json
├── bun.lock
├── .env.local.example          # Template with all env vars documented
└── README.md
```

## Database Schema

Use the **exact Prisma schema from PRD Section 14.** Do not simplify, do not rename fields, do not change types. The schema in the PRD is the canonical source of truth.

### Key models per PRD:

**Shared schema:** Entity, User, ApiKey, AuditLog
**Entity schemas (anselai, r3studios, family):** Account, Category, Transaction, TransactionLine, Tag, TransactionTag, Invoice, InvoiceLine, RecurringRule, Budget, BudgetLine, Attachment, MonthlySummary, MerchantRule

**Enums:** EntityType, UserRole, AccountType, TransactionStatus, LineType, InvoiceDirection, InvoiceStatus, RecurringFrequency

### Schema Replication Strategy

Prisma's multi-schema has limitations with identical models across schemas. The approach:
1. Define models in `schema.prisma` for the `anselai` schema as the canonical definition
2. Use raw SQL migrations to create identical table structures in `r3studios` and `family` schemas
3. The Prisma client factory switches schema at runtime:

```typescript
// src/lib/db.ts
import { PrismaClient } from '@prisma/client';

const clients: Record<string, PrismaClient> = {};

export function getEntityClient(entityId: string): PrismaClient {
  if (!clients[entityId]) {
    clients[entityId] = new PrismaClient({
      datasourceUrl: `${process.env.DATABASE_URL}?schema=${entityId}`,
    });
  }
  return clients[entityId];
}

export const sharedClient = new PrismaClient({
  datasourceUrl: `${process.env.DATABASE_URL}?schema=shared`,
});
```

### MerchantRule Location

Per PRD Section 17, MerchantRule lives in the **shared** schema (not per-entity), because rules reference `entityId` as a field. This is different from the other entity-specific models. Make sure this is in the shared schema.

## Seed Data (`prisma/seed.ts`)

The seed script must:

1. **Create schemas** via raw SQL: `CREATE SCHEMA IF NOT EXISTS shared/anselai/r3studios/family;`
2. **Create entities** in shared.entities:
   - `anselai` / "AnselAI (By The Reeses)" / BUSINESS
   - `r3studios` / "R3 Studios" / BUSINESS
   - `family` / "Reese Family" / PERSONAL
3. **Create admin user** in shared.users:
   - email: `admin@financehub.local`
   - password: `changeme` (bcrypt hashed)
   - role: OWNER
   - name: "Tyler Reese"
4. **Seed Chart of Accounts** for each entity schema with standard accounts:

   **ASSET accounts:**
   - 1000 Cash & Checking
   - 1010 Savings
   - 1100 Accounts Receivable
   - 1200 Prepaid Expenses
   - 1500 Equipment
   - 1510 Accumulated Depreciation

   **LIABILITY accounts:**
   - 2000 Accounts Payable
   - 2100 Credit Card - Amex Gold
   - 2101 Credit Card - Amex Delta Reserve
   - 2102 Credit Card - Amex Delta
   - 2103 Credit Card - Amex Bonvoy
   - 2104 Credit Card - Venture
   - 2500 Loans Payable

   **EQUITY accounts:**
   - 3000 Owner's Equity
   - 3100 Owner's Draw
   - 3200 Retained Earnings

   **REVENUE accounts:**
   - 4000 Service Revenue
   - 4100 Product Revenue
   - 4200 Interest Income
   - 4300 Other Income

   **EXPENSE accounts:**
   - 5000 Advertising & Marketing
   - 5010 Auto & Mileage
   - 5020 Bank & Merchant Fees
   - 5030 Contractors
   - 5040 Depreciation
   - 5050 Equipment
   - 5060 Insurance
   - 5070 Internet & Phone
   - 5080 Meals & Entertainment
   - 5090 Office Supplies
   - 5100 Professional Services (Legal, Accounting)
   - 5110 Rent
   - 5120 Software & Subscriptions
   - 5130 Supplies
   - 5140 Taxes & Licenses
   - 5150 Travel
   - 5160 Utilities
   - 5170 Education & Training
   - 5999 Uncategorized Expense

5. **Seed Categories** matching expense accounts, with `taxCategory` mappings:
   - Advertising → "advertising"
   - Auto & Mileage → "car_and_truck"
   - Contractors → "contract_labor"
   - Insurance → "insurance"
   - Meals → "meals" (set `isTaxDeductible: true`)
   - Office Supplies → "office_expense"
   - Professional Services → "legal_professional"
   - Software → "other_expense"
   - Travel → "travel"
   - etc.
   - Mark all business expense categories as `isTaxDeductible: true`
   - Mark categories as `isSystem: true` to prevent deletion

## Authentication (NextAuth.js v5)

Per PRD Section 4:

- **Provider:** CredentialsProvider (email + password → bcrypt verify)
- **Strategy:** JWT stored in httpOnly, Secure, SameSite=Strict cookie
- **Session lifetime:** 4 hours with sliding window
- **Password:** bcrypt, minimum 12 characters (validate on registration)
- **Sensitive operations re-auth:** Not needed in Task 1, but add a `requireReauth` utility stub

The NextAuth route handler goes at `/api/auth/[...nextauth]/route.ts`.

## Network Security Middleware

Next.js middleware (`src/middleware.ts`) runs on every request:

1. **IP check first** (before auth):
   - Allow Tailscale CGNAT: `100.64.0.0/10`
   - Allow local network: `192.168.68.0/24`
   - Allow localhost: `127.0.0.1`, `::1`
   - All other IPs → 403 Forbidden
2. **CORS headers:**
   - Allow origins: `http://192.168.68.105:3100` (MC), `http://192.168.68.105:3200` (AnselAI), `http://192.168.68.105:3300` (self)
3. **Auth check** (except public routes: `/api/health`, `/api/auth/*`, `/login`)

## Audit Log Middleware (`src/lib/audit.ts`)

A utility function that writes to `shared.audit_log`:

```typescript
async function auditLog(params: {
  userId?: string;
  apiKeyId?: string;
  entityId?: string;
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'LOGIN';
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void>
```

Log every API call and mutation. Task 1 must log: login attempts (success + failure), health checks.

## Encryption Helpers (`src/lib/encryption.ts`)

AES-256-GCM encrypt/decrypt functions using `FINANCE_ENCRYPTION_KEY` env var:

```typescript
function encrypt(plaintext: string): Buffer  // Returns IV + ciphertext + auth tag
function decrypt(encrypted: Buffer): string
```

Used for account numbers. Not used for amounts (they need to be queryable).

## Health Endpoint

**GET /api/health** — No auth required. Returns:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 12345.67,
  "database": "connected"
}
```

Include a DB ping to verify connection.

## Environment Variables

Create `.env.local.example` with all required vars documented:

```env
# Database
DATABASE_URL=postgresql://finance:password@localhost:5432/finance_hub

# Auth (NextAuth.js)
NEXTAUTH_SECRET=<generate-random-64-char>
NEXTAUTH_URL=http://192.168.68.105:3300

# Encryption
FINANCE_ENCRYPTION_KEY=<generate-random-32-byte-hex>
FINANCE_PII_KEY=<generate-random-32-byte-hex>

# Anthropic (for AI features - Phase 1 Task 4+)
ANTHROPIC_API_KEY=<from-env>

# File storage
ATTACHMENT_PATH=/Volumes/reeseai-memory/data/finance-hub/attachments

# App
PORT=3300
```

Also create actual `.env.local` with working values for local development. Generate real random secrets for NEXTAUTH_SECRET and encryption keys.

## Design (Minimal for Task 1)

- Dark theme: bg `#0D0D0F`, cards `#16161A`, text `#F5F5F7`
- Login page: centered card on dark background, email + password fields, submit button
- Dashboard placeholder: sidebar skeleton (nav items listed but grayed out except Dashboard) + "Coming Soon" centered content
- No Robinhood styling yet (that's Task 3). Just dark, clean, functional.

## Acceptance Criteria

1. `bun install` succeeds with no errors
2. PostgreSQL database `finance_hub` created with all four schemas
3. `bunx prisma migrate dev` (or equivalent) creates all tables in all schemas
4. `bunx prisma db seed` populates entities, admin user, chart of accounts for all 3 entities, and categories
5. `bun run dev` starts on port 3300
6. Accessing from non-allowed IP returns 403
7. Login with `admin@financehub.local` / `changeme` works, sets JWT cookie
8. Session expires after 4 hours
9. `/api/health` returns status with DB ping, no auth required
10. `/dashboard` shows placeholder when logged in, redirects to login when not
11. Audit log captures login attempts
12. Encryption helpers work (encrypt → decrypt roundtrip)
13. All TypeScript types match PRD schema exactly (UUIDs, BigInt cents, snake_case DB columns)
14. No TypeScript errors, no console errors
15. `.env.local.example` documents all required environment variables
16. MerchantRule model exists in shared schema per PRD Section 17

## What NOT To Build

- No CSV import logic (Task 2)
- No transaction UI (Task 3)
- No categorization engine (Task 4)
- No reports (Task 5)
- No Mission Control integration
- No API key management UI
- No invoice UI
- No budget UI
- No recurring rules UI

## References

Brunel MUST read these sections of the PRD before starting:
- Section 3: Data Model (money handling, column types)
- Section 4: Security (auth, encryption, network)
- Section 11: Tech Stack (exact versions and packages)
- Section 14: Prisma Schema Draft (the canonical schema)
- Section 17: MerchantRule in shared schema
