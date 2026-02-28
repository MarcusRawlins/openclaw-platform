# Finance Hub — Task 8: AI Auto-Categorization (Sonnet)

> 🦞 Marcus Rawlins | Spec v1.0 | 2026-02-27
> Parent PRD: `/workspace/specs/finance-hub-prd.md` (Sections 6.3, 9.1, 17)
> Phase 2 Overview: `/workspace/specs/fh-phase2-overview.md`
> Depends on: Task 6 (parsers), Task 7 (review queue)
> Review: Walt must score 95%+. Marcus (Opus) must score 99%+.

---

## Objective

When transactions are imported, automatically categorize them using a two-tier system: rule-based matching first (MerchantRules from Phase 1), then Sonnet AI for unknowns. The system learns from every Tyler correction, reducing AI calls over time.

## Build Location

`/Users/marcusrawlins/.openclaw/workspace/finance-hub/`

## Context: What Already Exists

Read before writing ANY code:
- `src/lib/categorization/` — Phase 1's MerchantRule matching system
- `src/app/api/v1/categorize/` — existing categorization endpoints
- `src/app/api/v1/merchant-rules/` — CRUD for merchant rules
- `src/app/(dashboard)/[entity]/categorize/page.tsx` — existing categorize UI
- `prisma/schema.prisma` — MerchantRule model (shared schema)

**Extend, don't rebuild.** Phase 1 has the merchant rule infrastructure. This task adds the AI layer on top and the learning feedback loop.

## Architecture

```
src/lib/categorization/
├── rules.ts              # EXISTS — rule-based matching
├── ai.ts                 # NEW — Sonnet API integration
├── pipeline.ts           # NEW — orchestrates rules → AI → confidence scoring
├── learning.ts           # NEW — feedback loop (corrections → new rules)
└── prompts.ts            # NEW — prompt templates for Sonnet
```

## Detailed Requirements

### 1. Categorization Pipeline (`pipeline.ts`)

When called with a batch of PENDING transactions:

```
Step 1: Rule Match
  For each transaction, normalize description → match against MerchantRules
  If match with confidence >= 0.9 → auto-categorize, mark as HIGH confidence
  If match with confidence 0.7-0.9 → suggest, mark as MEDIUM confidence

Step 2: AI Categorization (unknowns only)
  Batch remaining uncategorized transactions (up to 30 per API call)
  Send to Sonnet with context (categories list, recent similar transactions)
  Parse response → assign categories with confidence scores

Step 3: Apply Results
  HIGH confidence (>= 0.9 from rules OR >= 0.9 from AI with existing rule): auto-apply category
  MEDIUM confidence (0.7-0.9): set suggested category, keep PENDING for review
  LOW confidence (< 0.7): flag for manual categorization in review queue
```

### 2. Sonnet Integration (`ai.ts`)

**Model:** `claude-sonnet-4-20250514` via Anthropic API
**API Key:** From `ANTHROPIC_API_KEY` env var (already in Finance Hub .env)

```typescript
interface CategorizationRequest {
  transactions: {
    id: string;
    description: string;
    descriptionNormalized: string;
    amountCents: bigint;
    date: Date;
    accountName: string;
  }[];
  categories: { id: string; name: string; taxCategory?: string }[];
  recentPatterns: { description: string; categoryName: string }[]; // last 50 categorized
  entityName: string;
}

interface CategorizationResponse {
  results: {
    transactionId: string;
    suggestedCategoryId: string;
    confidence: number;       // 0.0 - 1.0
    reasoning: string;        // brief explanation
    alternativeCategoryId?: string;
  }[];
}
```

**Hard security boundary per PRD Section 9:** Financial data goes through Anthropic API ONLY. Never local LLM.

### 3. Prompt Template (`prompts.ts`)

```typescript
export function buildCategorizationPrompt(req: CategorizationRequest): string {
  return `You are a financial categorization assistant for "${req.entityName}".

Categorize each transaction into exactly one category. Return JSON only.

Available categories:
${req.categories.map(c => `- ${c.id}: ${c.name}${c.taxCategory ? ` (tax: ${c.taxCategory})` : ''}`).join('\n')}

Recent categorization patterns (for context):
${req.recentPatterns.slice(0, 30).map(p => `- "${p.description}" → ${p.categoryName}`).join('\n')}

Transactions to categorize:
${req.transactions.map(t => `- ID: ${t.transactionId} | "${t.description}" | $${(Number(t.amountCents) / 100).toFixed(2)} | ${t.date.toISOString().split('T')[0]} | Account: ${t.accountName}`).join('\n')}

For each transaction, respond with:
{
  "results": [
    {
      "transactionId": "...",
      "suggestedCategoryId": "...",
      "confidence": 0.0-1.0,
      "reasoning": "brief explanation",
      "alternativeCategoryId": "optional second choice"
    }
  ]
}

Rules:
- Confidence 0.95+ only for obvious matches (NETFLIX → Software, SHELL → Auto)
- Confidence 0.7-0.9 for reasonable guesses
- Confidence < 0.7 when ambiguous (AMAZON could be supplies, equipment, or personal)
- Consider the account context (business credit card vs personal checking)
- "Uncategorized Expense" is always a valid fallback at low confidence`;
}
```

### 4. Batch Processing

- Group transactions into batches of **max 30** per Sonnet call
- Include the full category list and last 50 categorized transactions as context
- Rate limit: max 5 concurrent Sonnet calls (configurable)
- Cost tracking: log token usage per batch to AuditLog
- Retry with exponential backoff on 429/500 errors (max 3 retries)

### 5. Learning Loop (`learning.ts`)

When Tyler approves or changes a category in the review queue (Task 7):

```
1. If transaction had AI suggestion AND Tyler changed it:
   → Create/update MerchantRule with Tyler's category
   → Set rule confidence = 1.0, createdBy = 'tyler'
   → Log correction to AuditLog

2. If transaction had AI suggestion AND Tyler approved as-is:
   → Create MerchantRule if none exists
   → Set confidence = 0.95, createdBy = 'ai_confirmed'
   → Increment usageCount on existing rule

3. If transaction had no suggestion (manual categorization):
   → Create MerchantRule
   → Set confidence = 1.0, createdBy = 'tyler'
```

**Pattern extraction:** When creating a MerchantRule from a correction, extract the merchant pattern from the normalized description. Strip trailing numbers, location info, and transaction IDs:
- `"amazon.com amzn.com/bill wa"` → pattern: `"amazon"`
- `"netflix.com 800-123-4567"` → pattern: `"netflix"`
- `"shell oil 12345 greensboro nc"` → pattern: `"shell oil"`

### 6. Auto-Categorization Trigger

The pipeline runs automatically:
1. **On import:** After Task 6 parses and saves PENDING transactions, trigger categorization pipeline
2. **On demand:** API endpoint to re-run categorization on uncategorized transactions
3. **Batch cron:** Part of the monthly import flow (11th of month, after auto-import)

### 7. API Endpoints

#### `POST /api/v1/categorize/batch`
Triggers AI categorization on all uncategorized PENDING transactions for an entity.
Body: `{ entityId: string, limit?: number }`
Returns: `{ processed: number, autoApplied: number, suggested: number, failed: number, tokenUsage: number }`

#### `POST /api/v1/categorize/learn`
Called by the review queue when Tyler makes a categorization decision.
Body: `{ transactionId: string, categoryId: string, wasAiSuggestion: boolean, originalCategoryId?: string }`
Returns: `{ ruleCreated: boolean, ruleId?: string }`

#### Modify existing `POST /api/v1/categorize` (from Phase 1)
Add AI fallback: if rule-based match returns no result, call Sonnet.

### 8. UI Integration with Review Queue

The review queue (Task 7) shows AI suggestions:
- **Blue badge** next to category: "🤖 Suggested" with confidence percentage
- **Tooltip:** Shows AI reasoning
- If alternative category exists, show as secondary option
- One-click accept or change

Add to the categorize page (`[entity]/categorize/page.tsx`):
- "Run AI Categorization" button — triggers batch categorization
- Progress indicator during batch processing
- Stats: "38 auto-categorized, 9 need review, $0.03 API cost"

### 9. Cost Tracking

Every Sonnet API call logs:
- Input tokens, output tokens
- Estimated cost (Sonnet pricing: $3/M input, $15/M output)
- Running total per entity per month
- Display in dashboard settings or admin area

Store in a new table or in AuditLog metadata.

## New Prisma Model (if needed)

```prisma
model CategorizationJob {
  id              String   @id @default(uuid()) @db.Uuid
  entityId        String   @map("entity_id") @db.Uuid
  transactionsProcessed Int @map("transactions_processed")
  autoApplied     Int      @map("auto_applied")
  suggested       Int
  failed          Int      @default(0)
  inputTokens     Int      @map("input_tokens")
  outputTokens    Int      @map("output_tokens")
  costCents       Int      @map("cost_cents")  // estimated cost in cents
  createdAt       DateTime @default(now()) @map("created_at")

  entity          Entity   @relation(fields: [entityId], references: [id])

  @@map("categorization_jobs")
  @@schema("shared")
}
```

## Testing Requirements

1. **Rule matching:** Transaction with existing MerchantRule gets categorized without AI call
2. **AI fallback:** Unknown merchant triggers Sonnet call, returns valid category
3. **Batch processing:** 100 transactions batched into 4 calls of 25
4. **Learning loop:** Categorize a transaction, verify MerchantRule created. Import same merchant again, verify rule-based match (no AI call)
5. **Confidence thresholds:** >0.9 auto-applies, 0.7-0.9 suggests, <0.7 flags
6. **Cost tracking:** Verify token usage logged correctly
7. **Error handling:** Sonnet API failure doesn't crash import, transactions stay uncategorized

Mock the Anthropic API in tests. Do not make real API calls in test suite.

## Constraints

- **Money is BIGINT cents.** Display only in prompts/UI.
- **Anthropic API only** for financial data. Hard security boundary.
- **Never send account numbers** to AI. Only descriptions, amounts, dates, account names.
- **Prompt must not include PII.** Strip any names, emails, phone numbers from descriptions before sending to AI.
