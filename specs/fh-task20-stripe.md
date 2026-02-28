# Finance Hub — Task 20: Stripe API Integration

> 🦞 Marcus Rawlins | Spec v1.0 | 2026-02-28
> Parent PRD: `/workspace/specs/finance-hub-prd.md` (Section 5)
> Phase 4 Overview: `/workspace/specs/fh-phase4-overview.md`
> Review: Walt must score 95%+. Marcus (Opus) must score 99%+.

---

## Objective

Auto-sync Stripe transactions into Finance Hub. Charges, payouts, refunds, and fees flow in automatically via incremental sync and real-time webhooks. Tyler never manually exports Stripe data again.

## Build Location

`/Users/marcusrawlins/.openclaw/workspace/finance-hub/`

## Architecture

```
src/lib/integrations/
├── stripe/
│   ├── client.ts          # Stripe SDK initialization
│   ├── sync.ts            # Incremental sync logic
│   ├── mapper.ts          # Map Stripe objects → Finance Hub transactions
│   ├── webhook.ts         # Webhook event handlers
│   └── types.ts           # Stripe-specific types

src/app/api/v1/integrations/
├── stripe/
│   ├── webhook/route.ts   # POST — Stripe webhook endpoint
│   ├── sync/route.ts      # POST — trigger manual sync
│   └── status/route.ts    # GET — connection status, last sync

src/app/(dashboard)/settings/
├── integrations/
│   └── page.tsx           # Integration settings (connect/disconnect, status)
```

## Detailed Requirements

### 1. Stripe SDK Setup (`client.ts`)

```typescript
import Stripe from 'stripe';

export function getStripeClient(entityId: string): Stripe {
  const key = getStripeKeyForEntity(entityId);
  return new Stripe(key, { apiVersion: '2024-12-18.acacia' });
}
```

Env vars:
```
STRIPE_SECRET_KEY_R3=sk_live_xxx       # R3 Studios
STRIPE_SECRET_KEY_ANSELAI=sk_live_xxx  # AnselAI (if applicable)
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### 2. Incremental Sync (`sync.ts`)

Pull balance transactions since last sync:

```typescript
export async function syncStripeTransactions(entityId: string): Promise<SyncResult> {
  const stripe = getStripeClient(entityId);
  const lastSync = await getLastSyncTimestamp(entityId, 'stripe');
  
  const params: Stripe.BalanceTransactionListParams = {
    limit: 100,
    created: lastSync ? { gt: Math.floor(lastSync.getTime() / 1000) } : undefined,
  };
  
  let hasMore = true;
  let totalSynced = 0;
  let startingAfter: string | undefined;
  
  while (hasMore) {
    const txns = await stripe.balanceTransactions.list({
      ...params,
      starting_after: startingAfter,
    });
    
    for (const txn of txns.data) {
      await processStripeTransaction(entityId, txn);
      totalSynced++;
    }
    
    hasMore = txns.has_more;
    startingAfter = txns.data[txns.data.length - 1]?.id;
  }
  
  await updateLastSyncTimestamp(entityId, 'stripe');
  return { synced: totalSynced, errors: 0 };
}
```

### 3. Transaction Mapping (`mapper.ts`)

Map Stripe balance transaction types to Finance Hub:

| Stripe Type | FH Category | Account | Notes |
|-------------|-------------|---------|-------|
| `charge` | Service Revenue (4000) | Checking/Stripe | Gross amount |
| `payment` | Service Revenue (4000) | Checking/Stripe | Same as charge |
| `refund` | Service Revenue (4000) | Checking/Stripe | Negative amount |
| `stripe_fee` | Bank & Merchant Fees (5020) | Expense | Auto-categorize |
| `payout` | Transfer | Checking | Move from Stripe → bank |
| `adjustment` | Other Income (4300) | Checking/Stripe | Disputes, etc. |

```typescript
export function mapStripeTransaction(
  entityId: string,
  stripeTxn: Stripe.BalanceTransaction
): ImportedTransaction {
  return {
    date: new Date(stripeTxn.created * 1000),
    amountCents: BigInt(stripeTxn.amount), // Stripe already uses cents
    description: stripeTxn.description || `Stripe ${stripeTxn.type}`,
    descriptionNormalized: normalizeDescription(stripeTxn.description || ''),
    referenceNumber: stripeTxn.id,         // bal_xxx — unique, perfect for dedup
    type: stripeTxn.amount >= 0 ? 'credit' : 'debit',
    rawLine: JSON.stringify(stripeTxn),
    sourceFile: 'stripe-api',
    sourceFormat: 'stripe',
    accountHint: 'stripe',
  };
}
```

### 4. Webhook Handler (`webhook/route.ts`)

```typescript
export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;
  
  const event = stripe.webhooks.constructEvent(body, sig, WEBHOOK_SECRET);
  
  switch (event.type) {
    case 'balance.available':
    case 'charge.succeeded':
    case 'charge.refunded':
    case 'payout.paid':
      await processStripeWebhookEvent(event);
      break;
  }
  
  return Response.json({ received: true });
}
```

Webhook events trigger immediate transaction creation (deduped against sync).

### 5. Dedup Against Manual Imports

Stripe transactions use `referenceNumber = stripeTxn.id` (e.g., `bal_xxxxx`). This is globally unique, so exact dedup is reliable.

Also check: if Tyler manually imported a CSV that includes Stripe charges, dedup by amount + date ± 1 day to flag potential duplicates.

### 6. Stripe Account Model

Add to Prisma (shared schema):

```prisma
model IntegrationConnection {
  id            String   @id @default(uuid()) @db.Uuid
  entityId      String   @map("entity_id") @db.Uuid
  provider      String                        // 'stripe', 'square', 'paypal'
  status        String   @default("active")   // active, disconnected, error
  config        Json     @default("{}")       // provider-specific config
  lastSyncAt    DateTime? @map("last_sync_at")
  lastSyncCount Int?     @map("last_sync_count")
  lastError     String?  @map("last_error")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  entity        Entity   @relation(fields: [entityId], references: [id])

  @@unique([entityId, provider])
  @@map("integration_connections")
  @@schema("shared")
}
```

This model is shared across Tasks 20-21 (Stripe, Square, PayPal).

### 7. Integration Settings UI (`settings/integrations/page.tsx`)

Cards for each integration:

```
┌── Stripe ────────────────────────────────────┐
│  Status: ✅ Connected                         │
│  Entity: R3 Studios                           │
│  Last sync: Feb 28, 2026 3:15 PM (47 txns)  │
│                                               │
│  [Sync Now]  [Disconnect]                     │
└───────────────────────────────────────────────┘

┌── Square ────────────────────────────────────┐
│  Status: ⚪ Not connected                     │
│  [Connect Square →]                           │
└───────────────────────────────────────────────┘
```

### 8. Auto-Sync Cron

Daily sync at 6am ET (catches overnight transactions):

Add to the cron job system or as a Finance Hub internal cron:
```
0 6 * * * — Stripe sync for all connected entities
```

## Testing Requirements

1. **Sync:** Mock Stripe API, sync 50 transactions, verify all mapped correctly
2. **Dedup:** Sync same transactions twice, verify no duplicates
3. **Webhook:** Send mock webhook event, verify transaction created
4. **Webhook signature:** Invalid signature returns 400
5. **Fee categorization:** Stripe fees auto-categorized as Bank & Merchant Fees
6. **Payout mapping:** Payout creates transfer between Stripe account and checking
7. **Error handling:** Stripe API down, sync fails gracefully, error logged to IntegrationConnection

## Constraints

- **Money is BIGINT cents.** Stripe already uses cents, so no conversion needed.
- **Stripe SDK is the only Stripe dependency.** Don't write custom API calls.
- **Webhook endpoint must be publicly accessible** for Stripe to call. Tyler may need to set up a tunnel (ngrok, Tailscale funnel) or use Stripe CLI for local testing.
- **Never log full Stripe secret keys.** Mask in all output.
