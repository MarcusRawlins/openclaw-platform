# AnselAI — Photography CRM Architecture & Build Plan

> Named after Ansel Adams. A CRM built for how wedding photographers actually work.

## Overview

AnselAI is a standalone photography CRM that manages Tyler's entire client lifecycle: inquiry → consultation → booking → shoot → editing → delivery → follow-up. It runs as its own app, accessible via a tab in Mission Control, and integrates with Google Calendar, Gmail, and Marcus (AI agent layer).

## What Exists

A previous build lives at `/Volumes/reeseai-memory/code/wedding-crm/`:
- 66 source files (Next.js 16, Tailwind CSS)
- Complete UI pages: dashboard, projects pipeline, contacts, tasks, calendar, forms, settings, auth
- All running on mock data (no backend connected)
- Design system docs: luxury light theme (Cormorant Garamond + Plus Jakarta Sans, ivory/copper palette)
- Database schema designed for Appwrite (7 collections)
- Design audit identified visual inconsistencies (three competing style systems)

**What we're keeping:** Component logic, page structure, data models, routing.
**What we're changing:** Backend (Appwrite → PostgreSQL + Prisma), design system (align with Mission Control's dark aesthetic), deployment approach.

## Architecture Decisions

### 1. Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | Next.js 16 (App Router) | Matches ZipGolf, team knows it |
| Runtime | Bun | Matches ZipGolf |
| Database | PostgreSQL + Prisma 7 | Matches ZipGolf, real database, scales |
| Styling | Tailwind CSS 4 | Matches both existing apps |
| Auth | NextAuth.js (Google OAuth) | Enables Gmail/Calendar integration via same OAuth token |
| Email | Gmail API (via OAuth) | Direct integration, no third-party |
| Calendar | Google Calendar API (via OAuth) | Bi-directional sync |
| Payments | Stripe Connect | Invoicing, payment tracking (future) |
| AI Layer | Marcus via OpenClaw gateway | Natural language queries, automation |

### 2. Design System — Dark Mode, Mission Control Lineage

Align with Mission Control's visual language, not the previous luxury light theme. Tyler prefers this direction.

```css
:root {
  /* Backgrounds */
  --bg-primary: #0a0b0f;
  --bg-secondary: #12141c;
  --bg-card: #181a24;
  --bg-card-hover: #1e2130;
  
  /* Text */
  --text-primary: #e8eaed;
  --text-secondary: #8b8fa3;
  --text-muted: #5a5e72;
  
  /* Borders */
  --border: #2a2d3a;
  --border-glow: #3a3d4a;
  
  /* Accents */
  --accent-blue: #4a9eff;
  --accent-green: #34d399;
  --accent-amber: #fbbf24;
  --accent-red: #f87171;
  --accent-purple: #a78bfa;
  
  /* CRM-specific */
  --stage-inquiry: #4a9eff;
  --stage-booked: #34d399;
  --stage-shooting: #fbbf24;
  --stage-editing: #a78bfa;
  --stage-delivered: #34d399;
  --stage-completed: #8b8fa3;
}
```

**Typography:** Inter (matches Mission Control). Save the serif fonts for client-facing materials, not the internal CRM.

**Key design principles:**
- Dense information display (photographer's time is limited)
- Pipeline-first thinking (Kanban board is the home view)
- Quick actions everywhere (one-click stage changes, inline editing)
- Mobile-responsive (photographers check this on their phone between shots)

### 3. Deployment

- Standalone Next.js app on port **3200**
- Mission Control gets an "AnselAI" tab that iframes or links to `http://localhost:3200`
- LAN accessible at `http://192.168.68.147:3200`
- Future: deploy to a VPS for access anywhere

### 4. Marcus Integration

Marcus can query AnselAI's database directly via Prisma. No separate API needed for agent access.

Examples:
- "Who's getting married in June?" → Marcus queries projects table
- "Any overdue follow-ups?" → Marcus queries tasks with past due dates
- "Send Clare her timeline" → Marcus reads project data, generates content, emails via Gmail

Add a cron job for Marcus to check overdue follow-ups daily.

---

## Database Schema

Moving from Appwrite collections to PostgreSQL + Prisma:

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Core Models ───

model Contact {
  id             String    @id @default(cuid())
  type           ContactType @default(LEAD)
  firstName      String
  lastName       String
  email          String    @unique
  phone          String?
  partnerName    String?   // Partner/spouse name
  partnerEmail   String?
  source         String?   // How they found us
  instagram      String?
  notes          String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  
  projects       Project[]
  interactions   Interaction[]
  tasks          Task[]
}

model Project {
  id             String       @id @default(cuid())
  name           String       // "Clare & Ryan Mayobre"
  type           ProjectType  @default(WEDDING)
  stage          ProjectStage @default(INQUIRY)
  
  // Client
  contactId      String
  contact        Contact      @relation(fields: [contactId], references: [id])
  
  // Event details
  eventDate      DateTime?
  venue          String?
  venueAddress   String?
  city           String?
  state          String?
  guestCount     Int?
  
  // Financial
  packageName    String?
  totalValue     Decimal?     @db.Decimal(10, 2)
  paidAmount     Decimal?     @db.Decimal(10, 2) @default(0)
  
  // Photography
  coverageHours  Int?
  secondShooter  String?      // Name of second shooter
  shotListUrl    String?
  timelineUrl    String?
  galleryUrl     String?
  
  // Links
  pinterestUrl   String?
  questionnaireUrl String?
  contractUrl    String?
  
  // Metadata
  notes          String?
  coverImage     String?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  
  tasks          Task[]
  events         Event[]
  interactions   Interaction[]
  vendors        ProjectVendor[]
  weddingParty   WeddingPartyMember[]
  familyFormals  FamilyFormal[]
  timeline       TimelineBlock[]
}

model Task {
  id             String       @id @default(cuid())
  title          String
  description    String?
  status         TaskStatus   @default(TODO)
  priority       TaskPriority @default(MEDIUM)
  dueDate        DateTime?
  completedAt    DateTime?
  
  projectId      String?
  project        Project?     @relation(fields: [projectId], references: [id])
  contactId      String?
  contact        Contact?     @relation(fields: [contactId], references: [id])
  
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
}

model Event {
  id             String       @id @default(cuid())
  title          String
  type           EventType    @default(OTHER)
  startTime      DateTime
  endTime        DateTime
  allDay         Boolean      @default(false)
  location       String?
  
  projectId      String?
  project        Project?     @relation(fields: [projectId], references: [id])
  
  // Google Calendar sync
  googleEventId  String?      @unique
  googleCalendarId String?
  syncedAt       DateTime?
  
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
}

model Interaction {
  id             String           @id @default(cuid())
  type           InteractionType
  direction      Direction        @default(OUTBOUND)
  subject        String?
  body           String?
  
  contactId      String
  contact        Contact          @relation(fields: [contactId], references: [id])
  projectId      String?
  project        Project?         @relation(fields: [projectId], references: [id])
  
  // Gmail sync
  gmailThreadId  String?
  gmailMessageId String?
  
  createdAt      DateTime         @default(now())
}

// ─── Wedding-Specific Models ───

model ProjectVendor {
  id             String    @id @default(cuid())
  role           String    // "Planner", "Florist", "DJ", etc.
  name           String
  contactName    String?
  email          String?
  phone          String?
  instagram      String?
  website        String?
  notes          String?
  
  projectId      String
  project        Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
}

model WeddingPartyMember {
  id             String    @id @default(cuid())
  role           String    // "Maid of Honor", "Best Man", "Bridesmaid", etc.
  name           String
  phone          String?
  notes          String?
  
  projectId      String
  project        Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
}

model FamilyFormal {
  id             String    @id @default(cuid())
  order          Int       // Shot order
  description    String    // "Clare & Ryan with Daryn, Tracy & Manny"
  people         String    // Comma-separated names
  notes          String?   // Sensitivity notes
  
  projectId      String
  project        Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
}

model TimelineBlock {
  id             String    @id @default(cuid())
  order          Int
  startTime      String    // "9:00 AM"
  endTime        String?   // "11:30 AM"
  title          String    // "Getting Ready"
  location       String?
  notes          String?
  photographerNotes String? // Internal notes for shooting
  
  projectId      String
  project        Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
}

// ─── Enums ───

enum ContactType {
  LEAD
  CLIENT
  VENDOR
  OTHER
}

enum ProjectType {
  WEDDING
  ENGAGEMENT
  FAMILY
  HEADSHOT
  BRANDING
  OTHER
}

enum ProjectStage {
  INQUIRY
  CONSULTATION
  PROPOSAL_SENT
  RETAINER_PAID
  PLANNING
  SHOOTING
  EDITING
  GALLERY_DELIVERED
  FEEDBACK
  COMPLETED
  LOST
}

enum TaskStatus {
  TODO
  IN_PROGRESS
  DONE
}

enum TaskPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum EventType {
  WEDDING
  ENGAGEMENT
  CONSULTATION
  TIMELINE_CALL
  DEADLINE
  PERSONAL
  OTHER
}

enum InteractionType {
  EMAIL
  PHONE
  TEXT
  MEETING
  NOTE
}

enum Direction {
  INBOUND
  OUTBOUND
}
```

**Key additions over the old schema:**
- `ProjectVendor` — stores vendor contacts per wedding (planner, florist, DJ, etc.)
- `WeddingPartyMember` — bridal party with phone numbers for day-of coordination
- `FamilyFormal` — ordered shot list with sensitivity notes
- `TimelineBlock` — photography timeline per wedding
- `Interaction` — email/call/note log with Gmail thread linking
- Google Calendar and Gmail sync fields on Event and Interaction models

---

## Google Integration

### OAuth Setup
One Google OAuth consent screen → grants access to both Gmail and Calendar. Use NextAuth.js with Google provider, requesting these scopes:
- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/gmail.compose`
- `https://www.googleapis.com/auth/calendar`
- `https://www.googleapis.com/auth/calendar.events`

### Gmail Integration
- **Inbox scanning:** Periodically check for emails from known contacts, auto-log as Interactions
- **Send/draft:** Compose emails from within AnselAI (opens Gmail draft or sends directly)
- **Thread linking:** Each Interaction stores `gmailThreadId` for quick "view in Gmail"
- **Inquiry detection:** Flag emails from unknown senders with wedding-related keywords → auto-create Lead

### Google Calendar Integration
- **Bi-directional sync:** Events created in AnselAI push to Google Calendar and vice versa
- **Wedding dates:** Auto-create all-day events for booked weddings
- **Consultations:** Schedule directly from the CRM
- **Availability:** Check calendar before suggesting consultation times

---

## Pages & Views

Reuse existing page structure, restyle to dark theme:

| Page | Status | Notes |
|------|--------|-------|
| **Dashboard** | Restyle | Stats, upcoming events, overdue tasks, pipeline snapshot, recent activity |
| **Pipeline** | Restyle | Kanban board (primary view), list view, calendar view |
| **Project Detail** | Restyle + Extend | Add vendor list, wedding party, family formals, timeline, interaction log |
| **Contacts** | Restyle | List with filters, detail drawer |
| **Calendar** | Restyle + Extend | Month/week/day views, Google Calendar sync |
| **Tasks** | Restyle | Task list with project association |
| **Inbox** | **NEW** | Gmail integration view: recent emails, quick reply, log interactions |
| **Settings** | Restyle | Profile, pipeline stages, email templates, Google account connection |
| **Auth** | Restyle | Google OAuth login |

### Removed from MVP
- Forms / lead capture builder (Phase 2)
- Client portal (Phase 3)
- Financial/invoicing (Phase 3)
- Document signing (Phase 3)

---

## Build Phases

Each module is a standalone deliverable. Test and approve before moving to the next.

---

### Module 1A: Scaffolding
**Goal:** App boots, database exists, dark theme renders.

- Init project at `/Users/marcusrawlins/.openclaw/workspace/anselai/`
- Next.js 16 + Bun + Tailwind 4 + Prisma 7
- PostgreSQL database `anselai` created
- Prisma schema with ONLY `Contact` and enums (no other models yet)
- Run migration
- `globals.css` with Mission Control dark palette
- One page: `/` shows "AnselAI" with the dark theme applied
- Runs on port 3200

**Test:** `bun run dev` → page loads at localhost:3200 with dark theme. `prisma studio` shows Contact table.

---

### Module 1B: Layout Shell
**Goal:** App has sidebar navigation and header.

- Sidebar component (dark, matches Mission Control style)
- Header with page title
- App layout wrapping all `(app)/` routes
- Navigation links: Dashboard, Pipeline, Contacts, Calendar, Tasks, Settings
- All links go to placeholder pages ("Coming soon")
- Mobile-responsive sidebar (collapsible)

**Test:** Click through all nav links. Sidebar highlights active page. Resize to mobile width.

---

### Module 1C: Contacts CRUD
**Goal:** Create, view, edit, delete contacts.

- Contacts list page with search and type filter (Lead/Client/Vendor)
- Contact detail drawer (click a row to open)
- New contact modal
- Edit contact
- Delete contact with confirmation
- API routes: `GET/POST /api/contacts`, `GET/PUT/DELETE /api/contacts/[id]`

**Test:** Create a contact. Search for it. Edit it. Delete it. Refresh — data persists.

---

### Module 1D: Projects + Pipeline Board
**Goal:** Kanban pipeline is the main view.

- Add `Project` model to schema (+ relation to Contact). Migrate.
- Pipeline page: Kanban board with columns per `ProjectStage`
- Drag-and-drop to change stage
- Project card shows: client name, event date, venue, package value
- New project modal (select existing contact or create new)
- Project list view (table with sortable columns)
- API routes: `GET/POST /api/projects`, `GET/PUT/DELETE /api/projects/[id]`, `PATCH /api/projects/[id]/stage`

**Test:** Create 3 projects in different stages. Drag one to a new stage. Refresh — stage persists. Switch between Kanban and list view.

---

### Module 1E: Project Detail Page
**Goal:** Click into a project and see everything about it.

- Project detail page at `/projects/[id]`
- Sections: Overview (dates, venue, package), Contact info, Notes
- Edit project inline or via modal
- Stage change from detail page
- Back to pipeline link

**Test:** Create a project, click into it, edit fields, change stage. All persists.

---

### Module 2A: Tasks
**Goal:** Task management tied to projects.

- Add `Task` model to schema. Migrate.
- Tasks page: list with filters (status, priority, project)
- New task modal (optionally linked to a project)
- Mark complete (one-click)
- Due date with overdue highlighting
- Tasks also appear on project detail page
- API routes for Tasks CRUD

**Test:** Create tasks, some linked to projects, some standalone. Filter by status. Mark one complete. Check it shows on the project detail page.

---

### Module 2B: Calendar
**Goal:** See events on a calendar.

- Add `Event` model to schema. Migrate.
- Calendar page: month view (port from old codebase, restyle dark)
- Week view, day view
- New event modal (optionally linked to a project)
- Events also appear on project detail page
- Wedding dates auto-show from project `eventDate`
- API routes for Events CRUD

**Test:** Create events. View in month/week/day. Link an event to a project. Check project detail shows it.

---

### Module 2C: Dashboard
**Goal:** At-a-glance overview of the business.

- Dashboard page at `/dashboard`
- Stats row: total leads, booked weddings, upcoming shoots, revenue
- Pipeline snapshot (mini Kanban or bar chart)
- Upcoming events (next 7 days)
- Overdue tasks
- Recent activity feed (last 10 actions: created project, changed stage, etc.)
- Make this the default route

**Test:** With data in the system, dashboard shows accurate counts. Overdue tasks actually show overdue items.

---

### Module 3A: Wedding Party & Vendors
**Goal:** Store the people involved in each wedding.

- Add `ProjectVendor` and `WeddingPartyMember` models. Migrate.
- Project detail page: new "Vendors" tab
  - Add/edit/remove vendors (role, name, phone, email, instagram)
- Project detail page: new "Wedding Party" tab
  - Add/edit/remove party members (role, name, phone)
- Day-of quick view: one screen with all vendor contacts + wedding party phones

**Test:** Add vendors and wedding party to a project. View the day-of contact sheet.

---

### Module 3B: Family Formals & Timeline
**Goal:** Shot list and photography timeline per wedding.

- Add `FamilyFormal` and `TimelineBlock` models. Migrate.
- Project detail page: new "Family Formals" tab
  - Ordered list, drag to reorder
  - Sensitivity notes field
  - Print-friendly view
- Project detail page: new "Timeline" tab
  - Time blocks with start/end, location, notes, photographer notes
  - Drag to reorder
  - Print-friendly view

**Test:** Add Clare & Ryan's family formals and timeline from the questionnaire. Reorder. Print preview.

---

### Module 3C: Interaction Log
**Goal:** Track all communication with a client.

- Add `Interaction` model. Migrate.
- Project detail page: new "Activity" tab
  - Log a note, phone call, meeting, or email manually
  - Chronological feed
- Contact detail: also shows interaction history
- Quick-add note from project detail

**Test:** Log a few interactions on a project. View them on both project and contact detail.

---

### Module 4A: Google OAuth
**Goal:** Sign in with Google, get OAuth tokens stored.

- NextAuth.js setup with Google provider
- Login page with "Sign in with Google"
- Request Calendar + Gmail scopes
- Store refresh token securely
- Protect all `(app)/` routes behind auth
- Settings page shows connected Google account

**Test:** Sign in with Tyler's Google account. Token persists across sessions. Unauthenticated access redirects to login.

---

### Module 4B: Google Calendar Sync
**Goal:** Events sync both directions.

- Push: creating/editing an Event in AnselAI creates/updates it in Google Calendar
- Pull: periodic sync pulls new Google Calendar events into AnselAI
- Wedding dates auto-create all-day Google Calendar events when a project is booked
- `googleEventId` links AnselAI events to Google events
- Settings: choose which Google Calendar to sync with

**Test:** Create an event in AnselAI → appears in Google Calendar. Create one in Google Calendar → appears in AnselAI on next sync.

---

### Module 4C: Gmail Integration
**Goal:** See and log emails from within AnselAI.

- Inbox page: shows recent emails from known contacts
- Click an email → view thread
- Auto-log: emails from/to known contacts create Interaction records
- Compose: draft an email to a contact (opens Gmail or sends via API)
- Thread linking: Interactions show "View in Gmail" link

**Test:** Open inbox, see real emails from contacts. Click one, view thread. Compose a draft.

---

### Module 5A: Marcus Database Access
**Goal:** Marcus can query AnselAI data naturally.

- Marcus reads AnselAI's Prisma schema
- Marcus can run Prisma queries against the `anselai` database
- Document common queries in a reference file for Marcus
- Test queries: "upcoming weddings", "overdue tasks", "contact lookup"

**Test:** Ask Marcus "who's getting married in March?" and get a real answer from the database.

---

### Module 5B: Marcus Automations
**Goal:** Proactive CRM assistance.

- Cron job: daily check for overdue follow-ups, alert Tyler
- Cron job: weekly pipeline summary (how many in each stage, any stale leads)
- Auto-generate timeline from questionnaire data
- Smart suggestions: "Clare's wedding is in 5 weeks, timeline call hasn't been scheduled"

**Test:** Overdue task exists → Marcus alerts Tyler. Stale lead exists → weekly summary flags it.

---

### Module 5C: Mission Control Tab
**Goal:** Access AnselAI from Mission Control.

- Add "AnselAI" nav item in Mission Control
- Opens AnselAI at localhost:3200 (iframe or new tab, test both)
- CRM stats widget on Mission Control dashboard (pipeline counts, next wedding, revenue)

**Test:** Click AnselAI in Mission Control → CRM loads. Dashboard widget shows live data.

---

### Module 6A: Client Auth & Portal Shell
**Goal:** Clients can log in and see their own project.

- Separate route group: `(client)/` with its own layout
- Client login: magic link via email (no password to manage)
- Each project gets a unique `clientAccessToken` (stored on Project model)
- Client layout: clean, minimal, branded (By The Reeses logo, lighter theme variant)
- After login: client sees ONLY their project
- No access to other clients, admin pages, or internal data

**Schema addition:**
```prisma
// Add to Project model:
clientAccessToken  String?   @unique @default(cuid())
clientPortalEnabled Boolean  @default(false)
```

**Test:** Generate a client link for a project. Open in incognito. Client sees their project only. Try accessing another project URL → blocked.

---

### Module 6B: Client Project View
**Goal:** Clients see their wedding details at a glance.

- Wedding date countdown
- Venue info, photographer team
- Coverage details (hours, what's included)
- Current project stage (visual progress bar: Inquiry → Booked → Planning → Shoot → Editing → Gallery)
- Timeline (read-only view of TimelineBlocks)
- Vendor list (read-only, so clients can reference their own vendors)

**Test:** Client logs in, sees countdown to wedding day, their timeline, their vendors. All read-only.

---

### Module 6C: Client Questionnaire
**Goal:** Clients fill out their wedding questionnaire directly in the portal.

- Questionnaire form built from a template (the same fields from Clare & Ryan's questionnaire)
- Sections: Couple info, venues, timeline, wedding party, family formals, detail shots, vendors, preferences
- Auto-saves as they go (draft state)
- Submit → data populates the project's wedding party, vendors, family formals, and timeline
- Tyler gets notified when a questionnaire is submitted
- Client can edit until a cutoff date

**Test:** Client fills out questionnaire in portal. Submit. Check admin side → data appears on project detail in the right tabs.

---

### Module 6D: Client Gallery & Documents
**Goal:** Clients can access their gallery and important documents.

- Gallery link (points to external gallery hosting, e.g., Pic-Time or similar)
- Sneak peek images section (upload 5-10 preview images directly)
- Document list: contract (view/download), invoice (view status), timeline (view)
- Payment status: show what's been paid and what's outstanding (read-only)

**Test:** Upload sneak peek images to a project. Client logs in and sees them. Add a document link. Client can view/download.

---

### Module 6E: Client Communication
**Goal:** Clients can message their photographer from the portal.

- Simple message thread (like a chat, not email)
- Client sends a message → creates an Interaction on the project
- Tyler sees it in the project's Activity tab + gets notified
- Tyler can reply from the admin side → client sees it in their portal
- Keeps all communication in one place instead of scattered across email/text/DMs

**Test:** Client sends a message. Tyler sees it on the project. Tyler replies. Client sees the reply.

---

## File Structure

```
anselai/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts              # Seed with Tyler's real client data
│   └── migrations/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx          # Redirect to /dashboard
│   │   ├── globals.css
│   │   ├── (auth)/
│   │   │   └── login/page.tsx
│   │   ├── (app)/
│   │   │   ├── layout.tsx    # Sidebar + header
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── pipeline/page.tsx
│   │   │   ├── projects/[id]/page.tsx
│   │   │   ├── contacts/page.tsx
│   │   │   ├── calendar/page.tsx
│   │   │   ├── tasks/page.tsx
│   │   │   ├── inbox/page.tsx
│   │   │   └── settings/page.tsx
│   │   └── api/
│   │       ├── contacts/
│   │       ├── projects/
│   │       ├── tasks/
│   │       ├── events/
│   │       ├── interactions/
│   │       ├── google/
│   │       │   ├── calendar/
│   │       │   └── gmail/
│   │       └── auth/[...nextauth]/
│   ├── components/
│   │   ├── ui/               # Button, Card, Badge, Input, Modal, etc.
│   │   ├── layout/           # Sidebar, Header
│   │   ├── pipeline/         # Kanban board, columns, cards
│   │   ├── projects/         # Project detail, vendor list, timeline
│   │   ├── contacts/         # Contact list, detail drawer
│   │   ├── calendar/         # Month/week/day views
│   │   ├── tasks/            # Task list, modals
│   │   └── inbox/            # Email list, compose
│   ├── lib/
│   │   ├── prisma.ts         # Prisma client
│   │   ├── google.ts         # Google API wrappers
│   │   ├── utils.ts
│   │   └── hooks/            # Custom React hooks
│   └── types/
│       └── index.ts
├── .env.example
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

---

## Environment Variables

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/anselai"

# NextAuth
NEXTAUTH_SECRET="generate-a-secret"
NEXTAUTH_URL="http://localhost:3200"

# Google OAuth
GOOGLE_CLIENT_ID="from-google-cloud-console"
GOOGLE_CLIENT_SECRET="from-google-cloud-console"

# OpenClaw (for Marcus integration)
OPENCLAW_GATEWAY_URL="http://localhost:4444"
```

---

## Brunel's Instructions

Brunel should:
1. Read this doc first
2. Reference the old codebase at `/Volumes/reeseai-memory/code/wedding-crm/` for component logic and page structure
3. Reference Mission Control's `globals.css` for the dark theme palette
4. Start with Phase 1 only
5. Report back after each phase for review before proceeding
6. Run `prisma studio` on port 5555 so Tyler can inspect data

**Do NOT:**
- Use Appwrite (we're on PostgreSQL + Prisma now)
- Use the old luxury light theme (dark mode, Mission Control style)
- Build client portal, forms builder, or invoicing in Phase 1
- Skip the schema — use the Prisma schema from this doc exactly

---

## Success Metrics

- Tyler can manage his entire client pipeline without leaving AnselAI
- One-click from inquiry email to new project in pipeline
- Wedding day: pull up project → see timeline, shot list, family formals, vendor contacts all in one place
- Marcus can answer "who's getting married next month?" without Tyler opening the app
- Google Calendar shows all wedding dates and consultations automatically
