# Oak Ridge PM — Session Handoff Document

**Last updated:** 2026-05-16  
**Deployed at:** https://oak-ridge-pm.vercel.app  
**GitHub repo:** https://github.com/oakridge1/oak-ridge-pm  
**Owner:** Justin, Oak Ridge Electrical LLC

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js App Router | 16.2.6 |
| Language | TypeScript | ^5 |
| Styling | Tailwind CSS | ^4 |
| Database | PostgreSQL (Supabase) | — |
| ORM | Prisma v7 with PrismaPg adapter | 7.8.0 |
| Auth | NextAuth v5 beta | 5.0.0-beta.31 |
| Auth adapter | @auth/prisma-adapter | ^2.11.2 |
| File storage | Supabase Storage (via uploadthing) | — |
| PDF generation | @react-pdf/renderer | ^4.5.1 |
| Word doc generation | docx | ^9.6.1 |
| Email | Nodemailer + Gmail SMTP (port 587) | ^7.0.13 |
| Icons | Lucide React | ^1.14.0 |
| Deployment | Vercel | — |

### Critical framework notes

- **This is Next.js 16.2.6** — not the well-known v13/14/15. APIs may differ from training data. Read `node_modules/next/dist/docs/` before writing new Next.js code.
- **Prisma v7** — `PrismaClient` requires the `PrismaPg` adapter passed in the constructor. `new PrismaClient()` alone will fail. Decimal fields come back as Prisma Decimal objects — call `.toNumber()` before arithmetic.
- **NextAuth v5 beta** — uses `AUTH_SECRET` (not `NEXTAUTH_SECRET`). Session strategy is `"database"`. `allowDangerousEmailAccountLinking: true` and `trustHost: true` are required. The `auth()` function is used in server components/actions; `signIn`/`signOut` come from `next-auth/react` on the client.
- **Middleware** — the auth middleware is `proxy.ts` in the project root (not `middleware.ts`). It exports a `proxy` function and a `config` matcher. To allow unauthenticated access to a route, add its prefix to the `publicPaths` array in `proxy.ts`.
- **React PDF** — routes that call `renderToBuffer` must include `export const runtime = "nodejs"` at the top. Use `as any` cast on `React.createElement(...)` call.

---

## Environment Variables

All of these must be set in **Vercel → Settings → Environment Variables**.

### Required — App will break without these

| Variable | Purpose | Example / Notes |
|---|---|---|
| `DATABASE_URL` | Supabase PostgreSQL connection string (pooled, port 6543) | `postgresql://postgres.[ref]:[pass]@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `AUTH_SECRET` | NextAuth v5 session signing key | Generate with `openssl rand -base64 32` |
| `AUTH_URL` | Canonical app URL for NextAuth callbacks | `https://oak-ridge-pm.vercel.app` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | From Google Cloud Console |

### Required — Email features won't work without these

| Variable | Purpose | Notes |
|---|---|---|
| `EMAIL_FROM` | Gmail address used to send all emails | e.g. `oakridgeelectric@gmail.com` |
| `GMAIL_APP_PASSWORD` | Gmail app password (not account password) | Generate at myaccount.google.com → Security → App Passwords |

### Required for migrations/scripts only (not at runtime on Vercel)

| Variable | Purpose | Notes |
|---|---|---|
| `DIRECT_URL` | Direct PostgreSQL connection (port 5432, no pooler) | Required for `prisma db push`, `prisma migrate`, and scripts in `/scripts` |

### Auto-injected by Vercel (do not set manually)

| Variable | Purpose |
|---|---|
| `CRON_SECRET` | Vercel auto-sets this for cron routes. The daily-report route validates `Authorization: Bearer <CRON_SECRET>`. Manual curl testing returns 401 — this is correct. |
| `VERCEL_URL` | Used as fallback for `APP_URL` if `AUTH_URL` is not set |

### Optional / File uploads

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL — used by file upload route |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key — used by file upload route |
| `UPLOADTHING_SECRET` | UploadThing API secret (alternative file upload provider) |
| `UPLOADTHING_APP_ID` | UploadThing app ID |

### Local dev only

Create `.env.local` with all of the above. Use `DIRECT_URL` pointing to port 5432 for `prisma db push`.

---

## Database Schema Summary

**Prisma schema:** `prisma/schema.prisma`  
**Generated client:** `app/generated/prisma/` (do not edit — run `npx prisma generate` after schema changes)

### Enums

```
Role              ADMIN | OFFICE | FOREMAN | TEAMMATE
JobStatus         ACTIVE | COMPLETED | ON_HOLD | CANCELLED
JobType           BID | TIME_AND_MATERIALS | ESTIMATE
ChangeOrderStatus PENDING | APPROVED | REJECTED
TaskStatus        OPEN | IN_PROGRESS | COMPLETED
CalendarEventType MILESTONE | TASK_DUE | COMPLETION | DAY_OFF | CUSTOM
CalendarRequestStatus PENDING | APPROVED | DENIED
InspectionType    UNDERGROUND | ROUGH_IN | SERVICE | FIRE_ALARM | SPECIAL | FINAL
InspectionResult  PASS | FAIL
RfiStatus         OPEN | ANSWERED
DocumentCategory  PLANS | SPECIFICATIONS | PERMITS | SUBMITTALS | SUBCONTRACTS | INSPECTION_REPORTS | CLOSEOUT | OTHER
InvoiceType       STANDARD | AIA
InvoiceStatus     DRAFT | SENT | PARTIALLY_PAID | PAID
```

### Key models

**User** — NextAuth users. Fields: `id, name, email, emailVerified, image, role (default TEAMMATE), active (default false), createdAt, updatedAt`. New Google sign-ins get `active=false` until admin activates. Pre-seeded users (inserted directly) keep their existing `active`/`role` — Google account is linked on first sign-in via `allowDangerousEmailAccountLinking`.

**Job** — Core entity. Key fields: `jobNumber (unique), jobName, address/city/state/zip, gcCompany/gcContactName/gcPhone/gcEmail, ownerName/ownerPhone/ownerEmail, foremanId (→ User), createdById (→ User), scopeOfWork, contractStartDate, completionDate, permitNumber, status (JobStatus), jobType (JobType, default BID), contractValue, laborBudgetHours, materialBudget, blendedLaborRate, subcontractorCost, equipmentCost, equipmentBillPct, otherCosts (Json), laborMarkupPct, subMarkupPct, equipmentMarkupPct, archived, calendarColor`.

**Invoice** — Fields: `invoiceNumber (auto-incremented per job), type (STANDARD|AIA), invoiceKind (string: "PROGRESS_PAYMENT"|"FINAL_INVOICE", default "PROGRESS_PAYMENT"), date, periodTo, applicationNo, status, amount, retainagePct, retainageHeld, lineItems (Json), notes`. Unique constraint: `[jobId, invoiceNumber]`.

**CalendarRequest** — Teammate calendar event requests awaiting foreman/admin approval. Fields: `jobId, requestedById, date, timeOfDay, description, reason, status (CalendarRequestStatus), reviewedById, reviewNotes, reviewedAt`.

**Other models:** LaborEntry, Material, Photo, Note, ChangeOrder, ChangeOrderPhoto, SavedTask, Task, TaskEvent, CalendarEvent, Inspection, Rfi, Document, Payment, Session, Account, VerificationToken.

### Schema change workflow

```bash
# 1. Edit prisma/schema.prisma
# 2. Push to DB (pooled URL works for db push):
npx prisma db push
# 3. Regenerate client:
npx prisma generate
# 4. If removing an enum value that's in use, do it in two stages:
#    Stage 1: add new values, keep old → db push
#    Stage 2: migrate data with raw SQL → db push --accept-data-loss (removes old value)
```

---

## Features Built by Phase

### Phase 1 — Foundation
- Next.js 16 App Router project setup with Tailwind, TypeScript, Prisma
- Supabase PostgreSQL database
- Google OAuth via NextAuth v5 with database sessions
- Edge middleware (`proxy.ts`) for auth gating
- User model with `active`/`role` fields
- `/login` page, `/pending` page (inactive users)
- Admin user management: activate/deactivate, change roles, create pre-seeded users

### Phase 2 — Job Core (9 routes)
- Dashboard (`/`) listing jobs by status, with job cards
- Job creation modal (admin/office only)
- Job detail page (`/jobs/[id]`) with tab layout
- **Info tab** — all job fields, GC/owner contact, foreman assignment, scope of work, calendar color, archive/unarchive
- **Labor tab** — log hours for crew members, group by date, admin can edit/delete entries
- **Materials tab** — log material expenses with file attachments, admin can edit/delete
- **Photos tab** — photo upload with captions, upload via UploadThing
- **Notes & Tasks tab** — freeform notes, task management (create/assign/due date/complete/reopen), saved task templates (admin), change order requests and management
- **Calendar tab** — job-specific calendar with MILESTONE/TASK_DUE/COMPLETION/DAY_OFF/CUSTOM events, recurrence support, master calendar at `/calendar`
- **Inspections tab** — schedule/log inspections (PASS/FAIL), PDF export per inspection
- **RFI tab** — request for information tracking with PDF export
- **Documents tab** — document vault organized by category
- **Summary tab** — financial tracking: direct costs, markups, contract vs. billing, invoices, payments
- Full job report PDF (`/jobs/[id]/report`)
- Billing summary report PDF (`/jobs/[id]/summary-report`)
- Archived jobs section (admin only, collapsible)

### Phase 3 — PDF Templates
- Full job report PDF (labor, materials, notes, tasks, payments)
- Billing summary report PDF (cost breakdown, contract summary, payment history)
- Change order PDF
- Inspection record PDF
- RFI PDF
- Standard Invoice PDF
- AIA G702/G703 PDF (two-page: application + continuation sheet)

### Phase 4 — Email Notifications (Nodemailer / Gmail SMTP)
- New note posted → notify relevant parties
- New change order submitted → notify admins + office
- Change order approved/rejected → notify submitter
- New task assigned → notify assignee
- New RFI submitted → notify relevant parties
- Admin BCC on all outbound emails (`getAdminEmails()` in `lib/notifications.ts`)

### Phase 5 — AIA Invoices
- AIA G702/G703 invoice type in invoice creation form
- Auto-populated line items from stored scope/schedule of values
- AIA-specific PDF route: `/api/jobs/[id]/pdf/aia/[invoiceId]`

### Phase 6 — Bug Fixes
- AIA PDF 500 error fixed (lineItems format mismatch)
- Email notifications fixed (silent `.catch()` removed, env var validation added)
- Login fix: `AUTH_SECRET`/`NEXTAUTH_URL` environment variables documented and set in Vercel
- `allowDangerousEmailAccountLinking: true` added to prevent OAuthAccountNotLinked loop for pre-seeded users
- `trustHost: true` added so OAuth callbacks work correctly behind Vercel's reverse proxy

### Phase 7 — Role System Overhaul
**Role changes:** `FIELD` removed → replaced with `FOREMAN` and `TEAMMATE`. 3 existing FIELD users migrated to FOREMAN via raw SQL migration script (`scripts/migrate-roles.ts`).

**Permission matrix:**
- `ADMIN` — full access to everything
- `OFFICE` — all non-field tabs, full financial access on all jobs, can create jobs
- `FOREMAN` — all non-financial tabs on all jobs; Summary tab visible only on jobs where `foremanId === userId OR createdById === userId`; can create events (MILESTONE/CUSTOM) directly; can manage tasks/COs on their jobs; can review teammate calendar requests on their jobs
- `TEAMMATE` — non-financial tabs only; can submit CO requests; must submit calendar event requests (approval required)

**Foreman dropdown** on Job Info tab filters to show only FOREMAN + ADMIN users.

**Teammate calendar request workflow:**
1. Teammate submits request form → creates `CalendarRequest` (PENDING)
2. Email sent to assigned foreman + all admins
3. Foreman/admin sees "Pending Calendar Requests" panel in Calendar tab
4. On Approve → `CalendarEvent` auto-created + email sent to requester
5. On Deny → email sent to requester with reason

**Daily admin report cron:**
- Schedule: `0 9 * * *` (9 AM UTC = 4 AM EST), configured in `vercel.json`
- Route: `/api/cron/daily-report` (added to `publicPaths` in `proxy.ts`)
- Validates `Authorization: Bearer <CRON_SECRET>` (Vercel auto-sets this)
- Sends branded HTML email to all active ADMIN users

### Phase 8A — Job Types, Invoice Rebuild, Duplicate Failsafes, Cron Fixes

**Logo:** `public/logo.jpg.jpg` → converted to `public/logo.png`. Header updated. Logo embedded in Standard Invoice PDF using base64 data URI.

**Job Type field:**
- `JobType` enum: `BID | TIME_AND_MATERIALS | ESTIMATE`
- Default: `BID`
- Job creation form includes type selector
- Dashboard shows Estimate jobs in a separate purple-badged "Estimates" section

**Summary tab behavior by job type:**
- `BID` — full financial view (default behavior)
- `TIME_AND_MATERIALS` — shows running costs only; hides contract value, labor/material budget rows, budget progress bars, percent complete; shows amber T&M banner
- `ESTIMATE` — admin-only; OFFICE/FOREMAN/TEAMMATE see a locked gate; Summary tab hidden from navigation for non-admins on Estimate jobs

**Standard Invoice rebuilt** (PDF + Word doc):
- Centered logo at top
- `OAK RIDGE ELECTRICAL LLC` company header (full name, address, email)
- Large `INVOICE` title
- `PROGRESS PAYMENT` or `FINAL INVOICE` label in orange
- Two-column project info table (FROM / TO + PROJECT)
- Scope of work auto-populated as numbered items (no per-item amounts)
- Financial summary: Contract Total → Approved COs in orange italic → Revised Contract Total → **INVOICE TOTAL** → retainage deduction → CURRENT PAYMENT DUE
- Payment terms paragraph
- Warranty paragraph
- Footer

**Progress Payment / Final Invoice toggle:**
- Stored as `invoiceKind` String field on Invoice model (default `"PROGRESS_PAYMENT"`)
- Orange toggle in invoice creation form (Standard invoices only)
- Shown on PDF as the type label

**Word doc download:**
- Route: `GET /api/jobs/[id]/pdf/invoice/[invoiceId]/docx`
- Generates fully editable `.docx` using the `docx` npm package
- Same format as PDF (logo text, headers, scope items, financials, terms, warranty)
- "Download Word" button appears next to "Download PDF" in the invoice log

**Duplicate labor failsafe:**
- Before submitting labor, server checks for existing entries with same employee/date/job
- Returns `{ duplicates: [...] }` instead of creating
- UI shows modal: **Add Hours** (keep both) / **Replace Existing** / **Cancel**
- `addLaborEntries` accepts `mode: "check" | "add" | "replace"` parameter

**Duplicate invoice failsafe:**
- `createInvoice` checks if an invoice already exists for the same calendar month
- Returns `{ duplicate: { invoiceNumber, date } }` instead of creating
- UI shows amber warning with **Create Anyway** / **Cancel**
- Accepts `force: true` to bypass the check

**Daily admin report fixes:**
- Activity data (failed inspections, hours logged, materials, notes) now uses **yesterday's** date range
- Today/future data (tasks due, calendar events, pending COs, RFIs, budget alerts) unchanged
- Three new sections added: "Hours Logged (Yesterday)", "Materials Entered (Yesterday)", "Notes Posted (Yesterday)"

**Per-foreman per-job daily email (Step 10):**
- Sent from the same cron, after the admin report
- For each active FOREMAN with active/on-hold assigned jobs, one email per job
- Content: job header + % complete, yesterday's hours with crew names, tasks due in 7 days, upcoming calendar events in 7 days, open RFIs with days open count, upcoming scheduled inspections

---

## Key Files Reference

```
/
├── auth.ts                    # NextAuth config (Google provider, session callback, role assignment)
├── auth.edge.ts               # Edge-compatible session cookie check (used by proxy.ts)
├── proxy.ts                   # Auth middleware — exports proxy() + config matcher
├── vercel.json                # Cron schedule (0 9 * * * daily report)
├── prisma/
│   └── schema.prisma          # Database schema
├── app/
│   ├── generated/prisma/      # Prisma generated client (don't edit)
│   ├── (app)/
│   │   ├── page.tsx           # Dashboard — job listing by status + Estimate section
│   │   ├── actions.ts         # createJob server action
│   │   ├── create-job-button.tsx  # New job modal with type selector
│   │   ├── job-card.tsx       # Job card component
│   │   ├── layout.tsx         # App layout with Header
│   │   ├── calendar/page.tsx  # Master calendar
│   │   ├── admin/users/page.tsx   # User management
│   │   └── jobs/[id]/
│   │       ├── page.tsx       # Job detail — computes canViewSummary, passes to tabs
│   │       ├── job-tabs.tsx   # Tab bar + routing — filters tabs by role/jobType
│   │       └── tabs/
│   │           ├── job-info-tab.tsx
│   │           ├── labor-tab.tsx          # Duplicate failsafe modal
│   │           ├── labor-tab-actions.ts   # addLaborEntries(mode: check|add|replace)
│   │           ├── materials-tab.tsx
│   │           ├── summary-tab.tsx        # T&M/Estimate branching, invoice form, Word download
│   │           ├── summary-tab-actions.ts # createInvoice(force), requireAdminOrForemanOnJob
│   │           ├── calendar-tab.tsx       # CalendarRequest UI
│   │           ├── calendar-tab-actions.ts
│   │           ├── calendar-request-actions.ts  # submitCalendarRequest, reviewCalendarRequest
│   │           ├── notes-tasks-tab.tsx
│   │           ├── notes-tasks-tab-actions.ts
│   │           ├── inspections-tab.tsx
│   │           ├── rfi-tab.tsx
│   │           └── documents-tab.tsx
│   └── api/
│       ├── auth/[...nextauth]/route.ts    # NextAuth handler
│       ├── upload/route.ts                # Supabase file upload
│       ├── cron/daily-report/route.ts     # Admin + foreman daily emails
│       └── jobs/[id]/pdf/
│           ├── _templates.tsx             # All PDF React components
│           ├── route.ts                   # Full job report PDF
│           ├── aia/[invoiceId]/route.ts   # AIA G702/G703 PDF
│           ├── invoice/[invoiceId]/
│           │   ├── route.ts              # Standard Invoice PDF (new Oak Ridge format)
│           │   └── docx/route.ts         # Standard Invoice Word doc
│           ├── co/[coId]/route.ts
│           ├── inspection/[inspectionId]/route.ts
│           └── rfi/[rfiId]/route.ts
├── components/
│   └── header.tsx             # App header with logo (now /logo.png)
├── lib/
│   ├── prisma.ts              # PrismaClient singleton with PrismaPg adapter
│   ├── notifications.ts       # Email functions (send, BCC admins, event-specific helpers)
│   ├── app-url.ts             # APP_URL resolution (AUTH_URL → NEXTAUTH_URL → VERCEL_URL)
│   └── email.ts               # Low-level email transport
├── public/
│   ├── logo.png               # Company logo (converted from logo.jpg.jpg)
│   └── logo.jpg.jpg           # Original (keep for reference)
└── scripts/
    └── migrate-roles.ts       # One-time FIELD→FOREMAN migration script (already run)
```

---

## Known Issues / Gotchas

### Architecture
1. **No `middleware.ts`** — The auth middleware is `proxy.ts`. If a new unauthenticated API route needs to be callable without a session (e.g. a new cron or webhook), add its path prefix to `publicPaths` in `proxy.ts`.

2. **Prisma adapter required** — Every script, migration, or custom route that instantiates `PrismaClient` must use the `PrismaPg` adapter. Pattern:
   ```ts
   import { PrismaPg } from "@prisma/adapter-pg";
   const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
   const prisma = new PrismaClient({ adapter } as any);
   ```

3. **Two-stage enum migration** — PostgreSQL cannot drop an enum value that's in use. If you need to remove an enum value: (1) add new values while keeping old → `db push`, (2) migrate data with `$queryRaw`, (3) remove old value → `db push --accept-data-loss`.

4. **TypeScript narrowing in JSX** — Inside `{isTeammate ? A : B}`, TypeScript narrows the `role` type inside branch B to exclude `"TEAMMATE"`. Comparisons like `role === "TEAMMATE"` inside B will trigger TS2367. Hoist the check out of the ternary or use a pre-computed boolean.

5. **Decimal fields** — Prisma v7 returns `Decimal` objects for `@db.Decimal` fields. Always call `.toNumber()` before arithmetic or passing to PDFs.

### Email
6. **Silent failures** — Email functions use `try/catch` and log errors but don't throw. If emails aren't arriving, check Vercel function logs for `[notifications]` entries.

7. **Gmail sending limits** — App password auth on Gmail has a daily sending limit (~500 emails/day for free accounts). Fine for current scale.

### Cron
8. **CRON_SECRET** — Vercel auto-generates and injects this. You cannot see or copy it from the dashboard in the same way as other env vars. To test the cron manually, use Vercel's "Trigger" button in the Crons dashboard, not curl.

9. **Cron timezone** — Schedule `0 9 * * *` = 9 AM UTC = 4 AM EST (5 AM EDT). The "yesterday" date logic in the cron uses `new Date()` server time (UTC), so the daily boundaries are UTC midnight, not EST midnight.

### UI
10. **`logo.jpg.jpg` naming** — The original file in `public/` has a double extension due to how it was uploaded. The new `logo.png` is what's used everywhere. The old file can be deleted after confirming the logo displays correctly in production.

11. **Job card doesn't show job type badge** — `JobCard` currently shows status, foreman, address, and completion date. It doesn't show the job type. Estimates are visually distinguished only by appearing in the separate Estimates section, not on the card itself.

12. **Word doc logo** — The `.docx` export uses text-based header (no embedded image) because inserting a binary image into `docx` requires additional image-to-buffer handling. The PDF version embeds the logo as base64.

### Data
13. **`createdById` on Job is nullable** — Jobs created before Phase 7 have `createdById = null`. The foreman financial access check (`job.foremanId === userId || job.createdById === userId`) handles null correctly since `null !== userId`.

14. **CalendarRequest notifications** — Notifications go to the assigned foreman (by `job.foremanId`) plus all admins. If a job has no foreman assigned, only admins are notified.

---

## Phase 8B — What to Build Next

The following items were scoped but not yet built, plus natural next steps:

### High priority

1. **Job Info tab — save `jobType` field**
   - The `jobType` is set at creation time (via `createJob` action) but the Job Info tab edit form doesn't expose it yet. Add a "Job Type" dropdown to the editable info tab so it can be changed after creation.
   - File: `app/(app)/jobs/[id]/tabs/job-info-tab.tsx` and its actions file.

2. **Invoice PDF — "Invoice Type" on AIA**
   - The `invoiceKind` field (Progress Payment / Final Invoice) is only applied to Standard Invoices. The AIA route and `AiaData` type don't include it. Add `invoiceKind` to the AIA route and render it as a label on the G702 PDF.

3. **Word doc — embed logo**
   - The `.docx` export currently uses a text-only header. To embed the logo, read `public/logo.png` as a buffer in the route and pass it to `docx` using `ImageRun`. Example:
     ```ts
     import { ImageRun } from "docx";
     const logoBuffer = fs.readFileSync(path.join(process.cwd(), "public", "logo.png"));
     // then use ImageRun({ data: logoBuffer, transformation: { width: 80, height: 80 } })
     ```

4. **Labor tab — date normalization bug risk**
   - The duplicate check in `addLaborEntries` uses `setUTCHours(0,0,0,0)` for day boundaries. The date picker sends a local date string (e.g. `"2026-05-16"`). `new Date("2026-05-16")` is parsed as UTC midnight, which is correct. But if the user is in a timezone west of UTC, `new Date("2026-05-16")` parsed as local time could produce the previous day. Verify this is not an issue for EST users and add a note if it's fine.

5. **Duplicate invoice failsafe — month boundary**
   - The current check looks for any invoice in the same calendar month as the new invoice date. This means invoices can only be created once per month per job. Consider whether the correct check should be by `applicationNo` (for AIA) or billing period date instead.

### Medium priority

6. **Job card — show job type badge**
   - Add a small pill badge on `JobCard` showing "T&M" for TIME_AND_MATERIALS jobs and "Estimate" for ESTIMATE jobs (BID shows nothing). Useful for at-a-glance identification within status groups.

7. **T&M jobs — disable invoice creation form contract fields**
   - For T&M jobs, the invoice creation form still shows "Amount" pre-filled with `grossBilling` (which is based on cost + markup). This is correct, but the copy should say "Running Total" not "Gross Billing Amount" for T&M. Minor UX fix.

8. **Summary tab — "canEdit" for FOREMAN**
   - Currently, only ADMIN can edit the blended labor rate, subcontractor costs, markups, and contract budget in the Summary tab. The `DirectCostsCard` and `MarkupsCard` check `role === "ADMIN"`. Consider whether FOREMANs on their jobs should be allowed to edit the blended labor rate or not.

9. **Foreman per-job email — "no jobs" case**
   - If a foreman has no active assigned jobs, no emails are sent (correct). But there's no notification or log entry. Add a `console.log` for visibility.

10. **Master calendar — show job type color coding**
    - Estimate jobs currently use the same calendar color scheme as regular jobs. Consider using a different default color or adding an "Estimate" label on calendar events from Estimate jobs.

11. **Admin saved tasks page**
    - Exists at `/admin/saved-tasks` but verify the full edit/delete/reorder flow works correctly post-Phase 7 role changes.

### Lower priority / Nice to have

12. **Payment terms customization**
    - The Standard Invoice PDF and Word doc both hard-code "30 days" and the address. Add a settings screen or per-job override for payment terms.

13. **Warranty text customization**
    - Same as above — warranty language is hard-coded in both PDF and Word doc templates.

14. **Job completion checklist**
    - When a job's status is changed to COMPLETED, trigger a checklist: final inspection logged? final invoice created? outstanding balance zero?

15. **Photo gallery improvements**
    - Photos tab shows a grid. Add lightbox view, download all as ZIP, and optional date grouping.

16. **Push notifications**
    - Currently, all notifications are email-only. Adding web push notifications (via Vercel Edge + VAPID) would improve mobile response time for foremen.

17. **Offline support / PWA**
    - Small crew is mobile-first. A service worker + PWA manifest would allow offline viewing of job info and queued labor entry submission.

18. **Automated test suite**
    - No tests currently exist. Recommend adding integration tests for: `createJob`, `addLaborEntries` (duplicate logic), `createInvoice` (duplicate logic), `requireAdminOrForemanOnJob` auth check, and the session callback in `auth.ts`.

---

## Development Workflow

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Type check only
npx tsc --noEmit

# Push schema changes to DB
npx prisma db push

# Regenerate Prisma client after schema changes
npx prisma generate

# Production build (always run before committing)
npm run build
```

### Deploy
Push to `main` → Vercel auto-deploys. Vercel reads `vercel.json` for cron config. Schema changes must be pushed to DB separately before or alongside the code deploy (Prisma migrations are not run automatically on Vercel).

---

## Company Info (used in PDFs and emails)

```
Oak Ridge Electrical LLC
76 Oak Ridge Road
Weare, NH 03281
oakridgeelectric@gmail.com
```
