# Finance Hub — Task 4: Merchant Learning + Categorization

> 🦞 Marcus Rawlins | Spec v1.1 | 2026-02-27
> Parent PRD: `/workspace/specs/finance-hub-prd.md` (Sections 6.3, 9.1, 17)
> Depends on: Task 1, Task 2, Task 3
> Review: Walt must score 95%+. Marcus (Opus) must score 99%+. Below threshold → back to Brunel.

---

## Objective

Build the human-in-the-loop categorization system from PRD Section 17. Tyler categorizes once, the system remembers forever. This includes the review inbox, merchant rule learning, AI suggestions, and auto-categorization on future imports.

## PRD Section 17 — The Canonical Definition

This is the core loop (do not deviate):

1. New transactions imported → AI categorizes using merchant name + merchant rules
2. **High confidence (>90% match to existing rule):** Auto-categorized, reviewable but not flagged
3. **Low confidence or unknown merchant:** Status = needs categorization, appears in review inbox
4. Tyler categorizes in the UI
5. System saves a **merchant rule** in `shared.merchant_rules`
6. Next occurrence auto-categorizes using Tyler's rule
7. Tyler can override any auto-categorization (updates the rule)

## MerchantRule Schema (shared schema)

Per PRD Section 17. This model already exists from Task 1's Prisma schema:

```prisma
model MerchantRule {
  id                 String   @id @default(uuid()) @db.Uuid
  merchantPattern    String   @map("merchant_pattern")
  categoryId         String   @map("category_id") @db.Uuid
  entityId           String   @map("entity_id") @db.Uuid
  businessAllocation Int      @default(100)  // 0-100 percentage for mixed expenses
  confidence         Float    @default(1.0)  // 1.0 = human-set, <1.0 = AI-suggested
  createdBy          String   @map("created_by")  // "tyler" or "ai"
  usageCount         Int      @default(0) @map("usage_count")
  createdAt          DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt          DateTime @updatedAt @map("updated_at") @db.Timestamptz

  @@map("merchant_rules")
  @@schema("shared")
}
```

Key fields vs Task 1 original spec:
- `businessAllocation`: percentage for mixed personal/business expenses (e.g., 70% business, 30% personal)
- `usageCount`: tracks how many times the rule has been applied
- `createdBy`: "tyler" for human-created, "ai" for AI-suggested

## File Structure

```
finance-hub/src/
├── app/
│   ├── (dashboard)/
│   │   └── [entity]/
│   │       └── categorize/
│   │           └── page.tsx              # Categorization review inbox
│   └── api/
│       └── v1/
│           ├── categorize/
│           │   ├── route.ts              # GET queue, POST categorize single
│           │   └── bulk/route.ts         # POST bulk categorize
│           ├── merchant-rules/
│           │   ├── route.ts              # GET list, POST create
│           │   └── [id]/route.ts         # PUT update, DELETE
│           └── categories/
│               └── route.ts              # GET all categories for entity
├── components/
│   └── categorize/
│       ├── categorize-inbox.tsx          # Main inbox component
│       ├── transaction-review-card.tsx   # Individual transaction card
│       ├── category-picker.tsx           # Searchable dropdown
│       ├── business-allocation-slider.tsx # 0-100% slider for mixed expenses
│       ├── merchant-rule-panel.tsx       # View/edit existing rule for merchant
│       └── bulk-actions-bar.tsx          # Select multiple → batch categorize
├── lib/
│   └── categorization/
│       ├── engine.ts                     # Main categorization engine (runs on import)
│       ├── merchant-matcher.ts           # Match transaction → merchant rule
│       ├── ai-categorizer.ts             # Keyword heuristics for unknowns (Phase 1)
│       └── rule-learner.ts              # Create/update rules from user actions
```

## Categorization Engine (`engine.ts`)

Runs after each import (update Task 2's import pipeline to call this):

```typescript
async function categorizeTransactions(transactions: Transaction[], entityId: string): Promise<{
  autoCategorized: number;
  needsReview: number;
  suggestions: Map<string, CategorySuggestion>;
}>
```

For each transaction:
1. Extract merchant name from description
2. Run `merchantMatcher.match(merchantName, entityId)`
3. If match confidence >= 0.9:
   - Auto-apply category
   - Update TransactionLines (remap from Uncategorized Expense to correct expense account)
   - Set transaction status remains PENDING (user can still override)
   - Increment rule's `usageCount`
4. If match confidence < 0.9 or no match:
   - Run `aiCategorizer.suggest(merchantName, description)`
   - Store suggestion as metadata (don't apply)
   - Keep as needs-categorization

## Merchant Matcher (`merchant-matcher.ts`)

```typescript
async function match(merchantName: string, entityId: string): Promise<{
  ruleId: string;
  categoryId: string;
  businessAllocation: number;
  confidence: number;
  createdBy: string;
} | null>
```

Match priority:
1. **Exact match** on `merchantPattern` (case-insensitive trim) → return rule confidence
2. **Contains match** (merchantPattern is a substring of merchantName or vice versa) → confidence * 0.9
3. **Fuzzy match** (Levenshtein distance ≤ 3) → confidence * 0.8 per distance unit

Only return matches with effective confidence > 0.5.

## AI Categorizer (`ai-categorizer.ts`)

**Phase 1: Keyword heuristics only. No external AI API calls.**

```typescript
const KEYWORD_RULES: Record<string, string[]> = {
  'Advertising & Marketing': ['facebook ads', 'google ads', 'meta ads', 'canva', 'mailchimp', 'squarespace'],
  'Auto & Mileage': ['shell', 'exxon', 'bp ', 'chevron', 'gas', 'fuel', 'autozone', 'jiffy lube', 'car wash'],
  'Bank & Merchant Fees': ['annual fee', 'late fee', 'interest charge', 'finance charge'],
  'Contractors': ['fiverr', 'upwork', '99designs'],
  'Education & Training': ['udemy', 'coursera', 'skillshare', 'workshop', 'seminar', 'conference'],
  'Equipment': ['b&h photo', 'adorama', 'best buy', 'apple store', 'camera', 'lens'],
  'Groceries': ['whole foods', 'trader joe', 'harris teeter', 'food lion', 'aldi', 'publix', 'kroger', 'walmart supercenter', 'costco', 'target'],
  'Insurance': ['state farm', 'geico', 'allstate', 'progressive', 'insurance'],
  'Meals & Entertainment': ['restaurant', 'cafe', 'coffee', 'starbucks', 'chick-fil-a', 'mcdonald', 'grubhub', 'doordash', 'uber eats', 'chipotle'],
  'Office Supplies': ['office depot', 'staples', 'amazon'],
  'Professional Services': ['accountant', 'attorney', 'legal', 'cpa'],
  'Rent': ['rent', 'lease payment'],
  'Software & Subscriptions': ['adobe', 'google', 'apple.com', 'microsoft', 'github', 'vercel', 'render', 'aws', 'digital ocean', 'netflix', 'spotify', 'hulu', 'disney+', 'youtube premium', 'openai', 'anthropic'],
  'Travel': ['airline', 'delta air', 'marriott', 'hilton', 'airbnb', 'hotel', 'expedia', 'southwest', 'united air', 'booking.com'],
  'Utilities': ['duke energy', 'spectrum', 'at&t', 'verizon', 't-mobile', 'water', 'electric', 'power'],
};
```

Returns confidence 0.7 for keyword matches. Future iteration replaces this with Anthropic Sonnet calls.

## Rule Learner (`rule-learner.ts`)

When a user categorizes a transaction:

```typescript
async function learnFromCategorization(params: {
  merchantName: string;
  categoryId: string;
  entityId: string;
  businessAllocation: number;  // 0-100, default 100
}): Promise<MerchantRule>
```

1. Check if a rule exists for this merchant + entity
2. If exists: update categoryId, businessAllocation, set confidence = 1.0, createdBy = "tyler"
3. If not: create new rule with exact merchant name as pattern, confidence 1.0, createdBy = "tyler"
4. **Auto-apply:** Find all PENDING uncategorized transactions from same merchant in same entity → apply category + update TransactionLines
5. Return the created/updated rule

## Review Inbox UI (`/[entity]/categorize`)

Per PRD Section 17 "Review Inbox UI":

### Header
- "**23 transactions need categorization**" with count badge
- Filter bar: All uncategorized | By date range | By source

### Transaction Review Cards

Each card shows:
- Date, description, merchant name, amount (formatted from cents)
- Source badge (which card)
- AI suggestion with confidence badge (if available): "Suggested: Software & Subscriptions (70%)"
- **Category picker:** searchable dropdown of all categories for this entity
- **Entity selector:** which entity does this belong to (default: current, but allow reassignment)
- **Business allocation slider:** 0-100%. Default 100% for business entities, 0% for family
- **"Apply to all from [merchant]" checkbox** (checked by default)
- Approve button (green) / Skip button (gray)

### Bulk Actions

- Checkbox on each card for multi-select
- When items selected, show floating bar: "X selected → Categorize all as [dropdown] → Apply"
- "Select all WALMART" quick-select by merchant

### Split Expense Support

Per PRD Section 6.2: "Split transactions — One bank charge → multiple category allocations"

When business allocation is not 100% or 0%, this is a mixed expense. The system should:
- Record businessAllocation on the MerchantRule
- In future reporting (Task 5), use this percentage to calculate deductible portion

For Phase 1, store the allocation. Full split-transaction accounting (creating two TransactionLines from one) is Phase 2.

## Sidebar Navigation Update

Add to sidebar:
```
Dashboard
Transactions
Categorize    (23)  ← badge with uncategorized count
Reports ▸          ← grayed out, "Coming in Task 5"
Settings           ← placeholder
```

## Updated Import Flow

After Task 2's bulk insert completes, call the categorization engine:

```typescript
// In import/index.ts, after bulk insert:
const result = await categorizeTransactions(newTransactions, entityId);
console.log(`Auto-categorized: ${result.autoCategorized}, Needs review: ${result.needsReview}`);
```

## API Endpoints

### GET /api/v1/categorize?entity=anselai&page=1&limit=20

Returns PENDING transactions with no category, ordered by date desc.

```json
{
  "queue": [{
    "id": "uuid",
    "date": "2026-01-15",
    "description": "WHOLE FOODS MARKET #123",
    "merchantName": "Whole Foods Market",
    "amountCents": 8742,
    "lineType": "DEBIT",
    "importSource": "csv:amex_gold",
    "suggestion": {
      "categoryId": "uuid",
      "categoryName": "Groceries",
      "confidence": 0.70,
      "source": "ai"
    }
  }],
  "total": 156,
  "page": 1,
  "amounts_in": "cents",
  "confidential": true
}
```

### POST /api/v1/categorize

```json
{
  "transactionId": "uuid",
  "categoryId": "uuid",
  "businessAllocation": 100,
  "applyToMerchant": true
}
```

This endpoint:
1. Updates transaction's categoryId
2. Remaps TransactionLines from Uncategorized Expense to correct expense account
3. If `applyToMerchant: true` → calls rule-learner
4. If `applyToMerchant: true` → auto-categorizes all matching uncategorized transactions
5. Audit logs the action
6. Returns { categorized: N, ruleCreated: boolean }

### POST /api/v1/categorize/bulk

```json
{
  "transactionIds": ["uuid1", "uuid2"],
  "categoryId": "uuid",
  "businessAllocation": 100,
  "applyToMerchant": true
}
```

### GET /api/v1/merchant-rules?entity=anselai

List all rules: pattern, category name, confidence, createdBy, usageCount.

### POST/PUT/DELETE /api/v1/merchant-rules[/:id]

CRUD for merchant rules. Audit logged.

### GET /api/v1/categories?entity=anselai

All categories with transaction counts and tax mappings.

## Acceptance Criteria

1. Categorization inbox shows all uncategorized PENDING transactions
2. Categorizing a transaction creates/updates a MerchantRule in shared schema
3. "Apply to all from this merchant" auto-categorizes matching transactions
4. Subsequent imports auto-categorize known merchants (>0.9 confidence)
5. Bulk categorization works for multi-select
6. AI keyword suggestions appear for unknown merchants with 0.7 confidence
7. Category picker is searchable with all entity categories
8. Business allocation slider works (0-100%)
9. Sidebar shows badge count of uncategorized transactions
10. Merchant rules CRUD (view, create, edit, delete) works
11. TransactionLines update when category changes (correct expense account)
12. Import pipeline now calls categorization engine after insert
13. All mutations audit logged
14. `X-Confidentiality: RESTRICTED` on all financial endpoints
15. No TypeScript errors

## What NOT To Build

- No Anthropic API calls for categorization (keyword heuristics only for Phase 1)
- No split-transaction accounting (store businessAllocation, but don't create multiple TransactionLines for splits yet)
- No reports (Task 5)
- No reconciliation workflow
