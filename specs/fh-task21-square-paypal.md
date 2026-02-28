# Finance Hub — Task 21: Square + PayPal API Integration

> 🦞 Marcus Rawlins | Spec v1.0 | 2026-02-28
> Parent PRD: `/workspace/specs/finance-hub-prd.md` (Section 5)
> Phase 4 Overview: `/workspace/specs/fh-phase4-overview.md`
> Depends on: Task 20 (uses IntegrationConnection model and settings UI pattern)
> Review: Walt must score 95%+. Marcus (Opus) must score 99%+.

---

## Objective

Same pattern as Stripe (Task 20): auto-sync Square and PayPal transactions into Finance Hub. AnselAI uses Square for POS. Both entities may use PayPal. Incremental sync, webhooks, auto-categorize, dedup.

## Build Location

`/Users/marcusrawlins/.openclaw/workspace/finance-hub/`

## Architecture

```
src/lib/integrations/
├── square/
│   ├── client.ts          # Square SDK initialization
│   ├── sync.ts            # Incremental sync (Payments API)
│   ├── mapper.ts          # Map Square payments → FH transactions
│   ├── oauth.ts           # OAuth 2.0 authorization flow
│   └── webhook.ts         # Webhook handlers
├── paypal/
│   ├── client.ts          # PayPal REST API client
│   ├── sync.ts            # Transaction Search API sync
│   ├── mapper.ts          # Map PayPal → FH transactions
│   └── webhook.ts         # Webhook/IPN handlers

src/app/api/v1/integrations/
├── square/
│   ├── oauth/
│   │   ├── authorize/route.ts  # Redirect to Square OAuth
│   │   └── callback/route.ts   # Handle OAuth callback
│   ├── webhook/route.ts
│   ├── sync/route.ts
│   └── status/route.ts
├── paypal/
│   ├── webhook/route.ts
│   ├── sync/route.ts
│   └── status/route.ts
```

## Part 1: Square Integration

### OAuth Flow (`oauth.ts`)

Square uses OAuth 2.0. Flow:
1. Tyler clicks "Connect Square" in settings
2. Redirect to Square authorization page with scopes: `PAYMENTS_READ`, `ORDERS_READ`, `ITEMS_READ`
3. Square redirects back with authorization code
4. Exchange code for access token + refresh token
5. Store tokens encrypted in IntegrationConnection.config

```typescript
// Env vars
SQUARE_APP_ID=sq0idp-xxx
SQUARE_APP_SECRET=sq0csp-xxx
SQUARE_ENVIRONMENT=production  // or sandbox for testing
```

### Sync (`sync.ts`)

Use Square Payments API:
```typescript
const { result } = await squareClient.paymentsApi.listPayments({
  beginTime: lastSync.toISOString(),
  sortOrder: 'ASC',
  limit: 100,
});
```

### Mapping (`mapper.ts`)

| Square Field | FH Field |
|-------------|----------|
| `payment.createdAt` | date |
| `payment.totalMoney.amount` | amountCents (Square uses cents) |
| `payment.note` or `payment.receiptUrl` | description |
| `payment.id` | referenceNumber |
| `payment.processingFee[].amountMoney.amount` | separate fee transaction |

Processing fees become separate transactions categorized as Bank & Merchant Fees (5020).

### Webhook (`webhook/route.ts`)

Square webhook events:
- `payment.completed` → create transaction
- `payment.updated` → update if exists
- `refund.created` → create negative transaction

Verify webhook signature using Square's webhook signature helper.

## Part 2: PayPal Integration

### Auth

PayPal uses OAuth 2.0 client credentials:
```
PAYPAL_CLIENT_ID=xxx
PAYPAL_CLIENT_SECRET=xxx
PAYPAL_ENVIRONMENT=live  // or sandbox
```

Get access token:
```typescript
const token = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
  method: 'POST',
  headers: {
    'Authorization': `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: 'grant_type=client_credentials',
});
```

### Sync (`sync.ts`)

Use PayPal Transaction Search API:
```typescript
const response = await fetch(
  `https://api-m.paypal.com/v1/reporting/transactions?` +
  `start_date=${lastSync.toISOString()}&end_date=${new Date().toISOString()}&` +
  `fields=all&page_size=100&page=${page}`,
  { headers: { 'Authorization': `Bearer ${accessToken}` } }
);
```

### Mapping (`mapper.ts`)

| PayPal Field | FH Field |
|-------------|----------|
| `transaction_info.transaction_initiation_date` | date |
| `transaction_info.transaction_amount.value` | amountCents (convert: PayPal uses decimal strings) |
| `transaction_info.transaction_subject` or `payer_info.payer_name` | description |
| `transaction_info.transaction_id` | referenceNumber |
| `transaction_info.fee_amount.value` | separate fee transaction |

**Important:** PayPal amounts are decimal strings ("42.50"), not cents. Convert: `BigInt(Math.round(parseFloat(amount) * 100))`.

### Webhook (`webhook/route.ts`)

PayPal webhook events:
- `PAYMENT.SALE.COMPLETED` → create transaction
- `PAYMENT.SALE.REFUNDED` → create negative transaction

Verify webhook using PayPal webhook verification API.

## Shared: Integration Settings UI Update

Extend the settings page from Task 20 to include Square and PayPal cards:

```
┌── Square ────────────────────────────────────┐
│  Status: ✅ Connected (AnselAI)              │
│  Last sync: Feb 28, 2026 (12 payments)       │
│  [Sync Now]  [Disconnect]                    │
└──────────────────────────────────────────────┘

┌── PayPal ────────────────────────────────────┐
│  Status: ✅ Connected (AnselAI + R3)         │
│  Last sync: Feb 28, 2026 (8 transactions)    │
│  [Sync Now]  [Disconnect]                    │
└──────────────────────────────────────────────┘
```

## Shared: Daily Sync Cron

Extend the Stripe daily sync cron (6am ET) to also sync Square and PayPal for all connected entities.

## Testing Requirements

1. **Square OAuth:** Mock OAuth flow, verify token exchange and storage
2. **Square sync:** Mock Payments API, verify mapping and dedup
3. **Square fees:** Processing fees create separate transactions
4. **PayPal sync:** Mock Transaction Search API, verify amount conversion (decimal → cents)
5. **PayPal dedup:** Same transaction synced twice, no duplicate
6. **Webhook verification:** Invalid signatures rejected
7. **Multi-entity:** PayPal connected to two entities, transactions route correctly
8. **Disconnection:** Disconnect integration, verify sync stops, data retained

## Constraints

- **Money is BIGINT cents.** Square uses cents natively. PayPal uses decimal strings — convert carefully.
- **OAuth tokens must be encrypted** in IntegrationConnection.config (use the encryption helpers from Phase 1).
- **Token refresh:** Square tokens expire. Implement automatic refresh on 401 responses.
- **Rate limits:** Square: 120 req/min. PayPal: 30 req/min for transaction search. Respect these.
- **No test credentials needed for spec.** Tyler will provide production API keys when ready.
