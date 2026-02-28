# Finance Hub — Task 14: Receipt & Document Attachments

> 🦞 Marcus Rawlins | Spec v1.0 | 2026-02-28
> Parent PRD: `/workspace/specs/finance-hub-prd.md` (Section 6.8)
> Phase 3 Overview: `/workspace/specs/fh-phase3-overview.md`
> Depends on: Phase 1 transaction management, Phase 2 invoice management
> Review: Walt must score 95%+. Marcus (Opus) must score 99%+.

---

## Objective

Upload receipts, bank statements, contracts, and other documents to transactions and invoices. Storage on local filesystem with thumbnails, gallery view, and drag-and-drop UI. Supports PDF, images (PNG, JPG, HEIC).

## Build Location

`/Users/marcusrawlins/.openclaw/workspace/finance-hub/`

## Context: What Already Exists

Read before writing ANY code:
- `prisma/schema.prisma` — Attachment model already defined (id, transactionId, invoiceId, filename, mimeType, filePath, fileSize, createdAt)
- `src/app/(dashboard)/[entity]/transactions/page.tsx` — Transaction list view
- `src/app/(dashboard)/[entity]/invoices/` — Invoice pages (Task 9, Phase 2)

**The Attachment model exists.** Build the upload/download infrastructure around it.

## Architecture

```
src/app/(dashboard)/[entity]/transactions/
├── [id]/
│   ├── page.tsx                     # NEW — Transaction detail with attachments
│   └── components/
│       ├── AttachmentUploader.tsx   # Drag-and-drop upload zone
│       ├── AttachmentGallery.tsx    # Grid of thumbnails
│       └── AttachmentPreview.tsx    # Lightbox modal for full view

src/app/(dashboard)/[entity]/invoices/[id]/
└── components/
    ├── AttachmentUploader.tsx        # Same component, reused
    └── AttachmentGallery.tsx         # Same component, reused

src/app/api/v1/attachments/
├── route.ts                          # POST — upload attachment
├── [id]/
│   ├── route.ts                      # GET — download, DELETE — delete attachment
│   └── thumbnail/route.ts            # GET — serve thumbnail

src/lib/attachments/
├── storage.ts                        # File system operations (save, delete, list)
├── thumbnail.ts                      # Generate thumbnails for images/PDFs
├── validation.ts                     # File type, size validation
└── types.ts                          # TypeScript interfaces

src/components/shared/
├── FileUpload.tsx                    # Reusable drag-and-drop component
└── ImageLightbox.tsx                 # Full-screen image viewer
```

## Detailed Requirements

### 1. Storage Path Structure

**Base path (from PRD):** `/Volumes/reeseai-memory/data/finance-hub/attachments/`

**Directory structure:**
```
/Volumes/reeseai-memory/data/finance-hub/attachments/
├── anselai/
│   ├── 2026/
│   │   ├── 01/
│   │   │   ├── {uuid}_{original_filename}.pdf
│   │   │   ├── {uuid}_{original_filename}.jpg
│   │   │   └── .thumbnails/
│   │   │       ├── {uuid}.jpg
│   │   │       └── {uuid}.jpg
│   │   ├── 02/
│   │   └── 03/
│   └── 2025/
├── r3studios/
│   └── 2026/
└── family/
    └── 2026/
```

**Filename pattern:** `{attachmentId}_{sanitized_original_name}.{ext}`

**Thumbnail storage:** `.thumbnails/` subdirectory in same month folder.

**Environment variable:** `ATTACHMENT_PATH=/Volumes/reeseai-memory/data/finance-hub/attachments` (already in PRD env vars)

### 2. File Validation (`validation.ts`)

```typescript
interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateFile(file: File): ValidationResult {
  // Max size: 10MB
  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return { valid: false, error: 'File size exceeds 10MB limit' };
  }

  // Allowed MIME types
  const ALLOWED_TYPES = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/heic',
    'image/heif',
  ];

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: `File type ${file.type} not supported` };
  }

  // Filename validation (no path traversal)
  if (file.name.includes('..') || file.name.includes('/')) {
    return { valid: false, error: 'Invalid filename' };
  }

  return { valid: true };
}
```

### 3. File Storage (`storage.ts`)

```typescript
interface SaveFileOptions {
  file: Buffer;
  originalName: string;
  mimeType: string;
  entityId: string;
  date: Date;  // Transaction or invoice date (determines year/month folder)
  attachmentId: string;  // UUID generated before saving
}

interface SaveFileResult {
  filePath: string;      // Relative path from ATTACHMENT_PATH
  fileSize: number;
  thumbnailPath?: string; // Generated for images/PDFs
}

export async function saveFile(options: SaveFileOptions): Promise<SaveFileResult>;

export async function deleteFile(filePath: string): Promise<void>;

export async function getFile(filePath: string): Promise<Buffer>;
```

**Implementation details:**
- Use Node.js `fs` module with async methods
- Create directory structure if it doesn't exist (`fs.mkdir({ recursive: true })`)
- Sanitize filename: replace spaces with underscores, remove special chars except `.`, `_`, `-`
- Store original filename in database, sanitized name on disk

### 4. Thumbnail Generation (`thumbnail.ts`)

Use **sharp** library for image processing (already used in AnselAI).

```typescript
interface ThumbnailOptions {
  sourcePath: string;
  mimeType: string;
  attachmentId: string;
}

export async function generateThumbnail(options: ThumbnailOptions): Promise<string | null>;
```

**Thumbnail specs:**
- Dimensions: 200x200px (crop to square)
- Format: JPEG
- Quality: 80
- Filename: `{attachmentId}.jpg`
- Stored in `.thumbnails/` subdirectory

**Supported:**
- PNG, JPG, HEIC → Use sharp
- PDF → Extract first page, convert to image with `pdf-poppler` or `pdf-to-img` library
- Future: OCR for text extraction (Phase 4)

**Fallback:** If thumbnail generation fails (e.g., HEIC not supported on server), log error and return null. Show generic file icon in UI.

### 5. Upload Component (`AttachmentUploader.tsx`)

**UI:**
```
┌─────────────────────────────────────────┐
│  📎 Attachments                         │
├─────────────────────────────────────────┤
│  [Drag files here or click to browse]  │
│                                         │
│  Supported: PDF, PNG, JPG, HEIC        │
│  Max size: 10MB per file               │
└─────────────────────────────────────────┘
```

**Features:**
- Drag-and-drop zone (use `react-dropzone` or native HTML5 drag events)
- Click to open file picker
- Multi-file upload (up to 5 at once)
- Upload progress indicator per file
- Validation on client (size, type) before upload
- Graceful error handling (show toast on validation/upload failure)

**Props:**
```typescript
interface AttachmentUploaderProps {
  parentType: 'transaction' | 'invoice';
  parentId: string;
  entityId: string;
  onUploadComplete?: (attachments: Attachment[]) => void;
}
```

### 6. Gallery Component (`AttachmentGallery.tsx`)

**UI:**
Grid layout with thumbnails.

```
┌──────┬──────┬──────┬──────┐
│ 📷   │ 📷   │ 📄   │ 📷   │
│ IMG1 │ IMG2 │ PDF1 │ IMG3 │
└──────┴──────┴──────┴──────┘
```

**Thumbnail card:**
- 200x200px square
- Hover: Overlay with filename, file size, download/delete icons
- Click: Open in lightbox (images) or download (PDFs)
- Delete: Trash icon in corner, confirm modal

**Props:**
```typescript
interface AttachmentGalleryProps {
  attachments: Attachment[];
  onDelete?: (attachmentId: string) => void;
  readOnly?: boolean;  // For reconciled transactions
}
```

### 7. Lightbox Viewer (`ImageLightbox.tsx`)

**Features:**
- Full-screen overlay
- Image zoom (pinch on mobile, scroll wheel on desktop)
- Arrow navigation if multiple attachments
- ESC to close
- Download button
- Filename caption at bottom

Use **yet-another-react-lightbox** or similar library.

### 8. Transaction Detail Page (`transactions/[id]/page.tsx`)

**New page structure:**
```
┌─────────────────────────────────────────┐
│ Transaction Detail                      │
│ #7a3f2e4b                               │
├─────────────────────────────────────────┤
│ Date: Feb 15, 2026                      │
│ Description: AMAZON.COM AMZN.COM/BILL  │
│ Amount: -$47.32                         │
│ Category: Business Supplies             │
│ Status: CLEARED                         │
│ Account: Chase Checking                 │
├─────────────────────────────────────────┤
│ Notes:                                  │
│ [Wireless mouse and USB cables]         │
├─────────────────────────────────────────┤
│ 📎 Attachments (2):                     │
│  ┌──────┬──────┐                        │
│  │ 📷   │ 📄   │                        │
│  │ IMG  │ PDF  │                        │
│  └──────┴──────┘                        │
│  [+ Add Attachment]                     │
├─────────────────────────────────────────┤
│ [Edit] [Delete]                         │
└─────────────────────────────────────────┘
```

**Access from transaction list:** Clicking a transaction row opens detail page (new behavior, currently inline edit).

### 9. Invoice Detail Integration

Invoice detail page (from Task 9) already exists. Add AttachmentGallery component below invoice line items.

**Location:** `src/app/(dashboard)/[entity]/invoices/[id]/page.tsx`

**Integration point:** After invoice summary, before notes section.

### 10. API Endpoints

#### `POST /api/v1/attachments`

**Content-Type:** `multipart/form-data`

**Form fields:**
- `file`: File binary
- `parentType`: `transaction` | `invoice`
- `parentId`: UUID
- `entityId`: Entity ID (for storage path)

**Process:**
1. Validate file (type, size)
2. Generate UUID for attachment
3. Save file to filesystem
4. Generate thumbnail (async, don't block response)
5. Create Attachment record in DB
6. Return attachment metadata

**Response:**
```json
{
  "id": "uuid",
  "filename": "receipt.jpg",
  "mimeType": "image/jpeg",
  "fileSize": 234567,
  "thumbnailPath": "/api/v1/attachments/{id}/thumbnail",
  "downloadPath": "/api/v1/attachments/{id}",
  "createdAt": "2026-02-28T14:32:15Z"
}
```

#### `GET /api/v1/attachments/[id]`

**Returns:** File binary with appropriate Content-Type and Content-Disposition headers.

**Example:**
```http
Content-Type: image/jpeg
Content-Disposition: attachment; filename="receipt.jpg"
```

**Security:** Verify user has access to the parent entity before serving file.

#### `GET /api/v1/attachments/[id]/thumbnail`

**Returns:** Thumbnail image (JPEG) or 404 if not generated.

**Content-Type:** `image/jpeg`

**Caching:** Set `Cache-Control: public, max-age=31536000` (thumbnails don't change).

#### `DELETE /api/v1/attachments/[id]`

**Action:**
1. Delete file from filesystem
2. Delete thumbnail if exists
3. Soft delete Attachment record (set `deletedAt`)
4. Audit log

**Returns:** 204 No Content

**Security:** Cannot delete attachments on reconciled transactions without unlocking period.

### 11. Transaction List Enhancement

Add attachment indicator to transaction list:

| Date | Description | Amount | Category | Attachments |
|------|-------------|--------|----------|-------------|
| 02/15 | AMAZON.COM | -$47.32 | Supplies | 📎 2 |
| 02/10 | SHELL OIL | -$52.18 | Auto | — |

**📎 icon + count** if attachments exist, clickable to open transaction detail.

### 12. Mobile Optimization

**Camera upload:** On mobile devices, file picker should offer "Take Photo" option (native device camera).

**Touch gestures:**
- Pinch-to-zoom in lightbox
- Swipe to navigate between attachments
- Long-press on thumbnail for context menu (download, delete)

### 13. Batch Operations (Future Enhancement, Architecture Only)

**Phase 3 Minimum:** Upload one at a time per transaction/invoice.

**Phase 4:** Bulk upload multiple receipts, then match to transactions via AI (OCR amount, date, vendor).

**For this task:** Architecture should support batch upload (API accepts array), but UI only single/multi-file to one parent.

## New Prisma Models

No new models. The **Attachment** model already exists in the schema (verified in PRD Section 3):

```prisma
model Attachment {
  id            String       @id @default(uuid()) @db.Uuid
  transactionId String?      @map("transaction_id") @db.Uuid
  invoiceId     String?      @map("invoice_id") @db.Uuid
  filename      String       @db.VarChar(255)
  mimeType      String       @map("mime_type") @db.VarChar(100)
  filePath      String       @map("file_path") @db.VarChar(500)
  fileSize      Int          @map("file_size")
  createdAt     DateTime     @default(now()) @map("created_at") @db.Timestamptz

  transaction   Transaction? @relation(fields: [transactionId], references: [id])
  invoice       Invoice?     @relation(fields: [invoiceId], references: [id])

  @@map("attachments")
  @@schema("anselai")  // Replicate in r3studios, family
}
```

**Verify this exists in existing schema. Do not recreate.**

## Testing Requirements

1. **File upload:** Upload PNG receipt to transaction, verify saved to correct path
2. **Thumbnail generation:** Upload JPG, verify thumbnail created in `.thumbnails/` folder
3. **PDF upload:** Upload PDF statement to invoice, verify stored correctly
4. **Multi-file upload:** Upload 3 images at once, verify all saved
5. **File validation:** Attempt to upload 15MB file, verify rejected with error
6. **Unsupported type:** Upload .docx, verify rejected
7. **Download:** Upload file, then download via API, verify content matches
8. **Delete:** Delete attachment, verify file removed from filesystem and DB soft-deleted
9. **Gallery view:** Transaction with 4 attachments, verify all displayed in grid
10. **Lightbox:** Click image thumbnail, verify opens in full-screen lightbox
11. **Access control:** User from entity A cannot download attachment from entity B's transaction
12. **Reconciled lock:** Attempt to delete attachment on reconciled transaction, verify blocked

## Constraints

- **Max file size: 10MB.** Enforced on client and server.
- **Supported formats:** PDF, PNG, JPG, HEIC only. No Word docs, spreadsheets, etc.
- **Local filesystem storage only.** No S3, no cloud. Path from env var.
- **Soft delete.** Never hard-delete attachment records. Set `deletedAt` timestamp.
- **Security:** Verify user has access to parent entity before serving files. Never serve cross-entity.
- **Thumbnail generation is async.** Don't block upload response. Generate in background.
- **HEIC support:** If sharp doesn't support HEIC on server, log warning and skip thumbnail. Show file icon instead.
- **Path traversal protection:** Sanitize all filenames. Never trust user input for file paths.

---

🦞 **Marcus Rawlins**
