# Oak Ridge PM — Session Handoff Document

**Last updated:** 2026-05-19
**Deployed at:** https://oak-ridge-pm.vercel.app
**GitHub repo:** https://github.com/oakridge1/oak-ridge-pm
**Owner:** Justin Marceau, Oak Ridge Electrical LLC
**Company address:** 209 W. River Rd, Hooksett, NH 03106
**Owner contact:** 603-660-4651 | Justin@oakridgeelectrical.com

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

- **This is Next.js 16.2.6** — not the well-known v13/14/15. APIs may differ from training data. Read `node_modules/next/dist/docs/` before writing any new Next.js code. Heed deprecation notices.
- **Prisma v7** — `PrismaClient` requires the `PrismaPg` adapter passed in the constructor. `new PrismaClient()` alone will fail. Decimal fields come back as Prisma Decimal objects — always call `.toNumber()` before arithmetic.
- **NextAuth v5 beta** — uses `AUTH_SECRET` (not `NEXTAUTH_SECRET`). Session strategy is `"database"`. `allowDangerousEmailAccountLinking: true` and `trustHost: true` are required. `auth()` is used in server components/actions; `signIn`/`signOut` come from `next-auth/react` on the client.
- **Middleware** — the auth middleware is `proxy.ts` in the project root (not `middleware.ts`). It exports a `proxy` function and a `config` matcher. To allow unauthenticated access to a route (cron, webhook), add its path prefix to the `publicPaths` array in `proxy.ts`.
- **React PDF** — any route calling `renderToBuffer` must include `export const runtime = "nodejs"` at the top of the file. Cast the `React.createElement(...)` call with `as any`.
- **serverExternalPackages** — `["docx", "sharp"]` in `next.config.ts` prevents Turbopack from incorrectly bundling these native packages.
- **Route params** — in Next.js 16, `params` is a `Promise`. Always `await params` before destructuring: `const { id } = await params`.
- **No tsx/ts-node** — the project has no tsx or ts-node installed. One-time scripts must be plain Node.js `.js` files using `require("pg")` with the DIRECT_URL connection string. The `pg` package (v8.20.0) is available.

---

## Environment Variables

All must be set in **Vercel → Settings → Environment Variables**.

### Required — app breaks without these

| Variable | Purpose | Notes |
|---|---|---|
| `DATABASE_URL` | Supabase PostgreSQL pooled connection (port 6543) | `postgresql://postgres.[ref]:[pass]@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `AUTH_SECRET` | NextAuth v5 session signing key | `openssl rand -base64 32` |
| `AUTH_URL` | Canonical app URL for NextAuth callbacks | `https://oak-ridge-pm.vercel.app` |
| `AUTH_GOOGLE_ID` | Google OAuth client ID | From Google Cloud Console |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret | From Google Cloud Console |

### Required — email features won't work without these

| Variable | Purpose | Notes |
|---|---|---|
| `EMAIL_FROM` | Gmail address used to send all emails | e.g. `oakridgeelectric@gmail.com` |
| `GMAIL_APP_PASSWORD` | Gmail app password (not account password) | myaccount.google.com → Security → App Passwords |

### Required for local dev / migrations only

| Variable | Purpose | Notes |
|---|---|---|
| `DIRECT_URL` | Direct PostgreSQL connection (port 5432, no pooler) | Required for `prisma db push` and plain Node.js scripts |

### Auto-injected by Vercel

| Variable | Purpose |
|---|---|
| `CRON_SECRET` | Auto-set by Vercel. Cron routes validate `Authorization: Bearer <CRON_SECRET>`. Test via Vercel dashboard Trigger button — manual curl returns 401 (correct). |
| `VERCEL_URL` | Fallback for `APP_URL` if `AUTH_URL` is not set |

### Optional — file uploads

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `UPLOADTHING_SECRET` | UploadThing API secret (alternative provider) |
| `UPLOADTHING_APP_ID` | UploadThing app ID |

---

## Sam Cosme — Permanent CC Rule (LOCKED)

**Sam Cosme (`sam@oakridgeelectrical.com`) is CC'd on every single outbound email without exception.**

This is implemented in two files and must never be removed:

- `lib/notifications.ts` — `const SAM_CC = "sam@oakridgeelectrical.com"`. In `send()`, Sam is added to `cc` unless she is already a primary recipient. Admin BCC logic explicitly excludes her email.
- `app/api/jobs/[id]/stock-orders/route.ts` — `const SAM_CC = "sam@oakridgeelectrical.com"`. Added to CC on every stock order and approval notification email.

**Do not modify this logic in either file.**

---

## Role System

| Role | Access |
|---|---|
| `ADMIN` | Full access to everything |
| `OFFICE` | All non-field tabs, full financial access on all jobs, can create jobs |
| `FOREMAN` | All non-financial tabs on all jobs; Summary tab on jobs where `foremanId === userId OR createdById === userId`; can create MILESTONE/CUSTOM calendar events directly; can manage tasks/COs on their jobs; can review teammate calendar requests on their jobs |
| `TEAMMATE` | Non-financial tabs only; can submit CO requests; must submit calendar event requests (approval flow required); can add stock requests in The Crib but cannot send orders without ordering permission |

The `FIELD` role was removed in Phase 7. All former FIELD users were migrated to FOREMAN via `scripts/migrate-roles.ts` (already run — do not re-run).

---

## Database Schema

**Prisma schema:** `prisma/schema.prisma`
**Generated client:** `app/generated/prisma/` — do not edit; run `npx prisma generate` after schema changes.

### Schema change workflow

```bash
# 1. Edit prisma/schema.prisma
# 2. Push to DB (pooled URL works):
npx prisma db push
# 3. Regenerate client:
npx prisma generate
# Note: removing an enum value requires a two-stage migration
# Stage 1: add new values, keep old → db push
# Stage 2: migrate data with $queryRaw → db push --accept-data-loss
```

### Enums

```
Role                  ADMIN | OFFICE | FOREMAN | TEAMMATE
JobStatus             ACTIVE | COMPLETED | ON_HOLD | CANCELLED
JobType               BID | TIME_AND_MATERIALS | ESTIMATE
ChangeOrderStatus     PENDING | APPROVED | REJECTED
TaskStatus            OPEN | IN_PROGRESS | COMPLETED
CalendarEventType     MILESTONE | TASK_DUE | COMPLETION | DAY_OFF | CUSTOM
CalendarRequestStatus PENDING | APPROVED | DENIED
InspectionType        UNDERGROUND | ROUGH_IN | SERVICE | FIRE_ALARM | SPECIAL | FINAL
InspectionResult      PASS | FAIL
RfiStatus             OPEN | ANSWERED
DocumentCategory      PLANS | SPECIFICATIONS | PERMITS | SUBMITTALS | SUBCONTRACTS |
                      INSPECTION_REPORTS | CLOSEOUT | MATERIAL_RECEIPTS | STOCK_ORDERS | OTHER
InvoiceType           STANDARD | AIA
InvoiceStatus         DRAFT | SENT | PARTIALLY_PAID | PAID
```

### Key models

**User** — NextAuth users. `id, name, email, emailVerified, image, role (default TEAMMATE), active (default false)`. New Google sign-ins get `active=false` until admin activates. Relations include: `foremanJobs`, `stockRequests`, `stockOrders`, `userPermissions`, `grantedPermissions`, `googleConnections`, `approvalRequests` (StockApprovalRequest requester), `reviewedApprovals` (StockApprovalRequest reviewer), `wage (EmployeeWage?)`.

**Job** — Core entity. Key fields: `jobNumber (unique), jobName, address/city/state/zip, gcCompany/gcContactName/gcPhone/gcEmail, ownerName/ownerPhone/ownerEmail, foremanId (→ User), createdById (→ User), scopeOfWork, contractStartDate, completionDate, permitNumber, status (JobStatus), jobType (JobType, default BID), contractValue, laborBudgetHours, materialBudget, blendedLaborRate, subcontractorCost, equipmentCost, equipmentBillPct, otherCosts (Json — array of {id, description, amount, markupPct?}), laborMarkupPct, subMarkupPct, equipmentMarkupPct, materialMarkupPct, otherMarkupPct, archived, calendarColor`. Relations include all tabs plus: `stockRequests`, `stockOrders`, `userPermissions`, `stockApprovalRequests`.

**Invoice** — `invoiceNumber (auto-incremented per job), type (STANDARD|AIA), invoiceKind (string: "PROGRESS_PAYMENT"|"FINAL_INVOICE", default "PROGRESS_PAYMENT"), googleSheetId (String? — set after AIA Sheets export), date, periodTo, applicationNo, status, amount, retainagePct, retainageHeld, lineItems (Json), notes`. Unique: `[jobId, invoiceNumber]`.

**Payment** — `jobId, invoiceId (optional), date, amount, checkNumber, reference, includesRetainageRelease, note`.

**Material** — `jobId, userId, description, amount, fileUrl, fileName, fileSize, archivedToVault (Boolean @default(false))`. When a new material is added beyond the 5 most recent with fileUrls, older entries are auto-archived to the Document Vault (MATERIAL_RECEIPTS category).

**CalendarEvent** — `jobId?, userId, title, date, endDate, allDay, type, note, recurrence, recurrenceEndDate, googleEventId (String? — set after Google Calendar sync)`. Creates/updates/deletes mirror to Google Calendar automatically via `syncCalendarEventToGoogle()` / `deleteCalendarEventFromGoogle()` in `lib/google.ts`.

**GoogleConnection** — Singleton-style (one record per app, not per user). Fields: `id, email, refreshToken, accessToken, tokenExpiry, scopes, connectedById (→ User), connectedAt, updatedAt`. Stores the Google OAuth connection used for Drive, Sheets, and Calendar API calls. Access via `getValidAccessToken()` in `lib/google.ts` which auto-refreshes 60 seconds before expiry. Scopes granted: `email, profile, spreadsheets, calendar, drive`.

**CompanySettings** — Singleton (`id @default("singleton")`). Fields: `companyName, address, city, state, zip, phone, email, logoUrl`. Source of truth for PDF templates. Upsert via `/api/admin/company-settings`.

**CompanyRates** — Singleton (`id @default("singleton")`). Fields: `defaultBurden (Float, default 0.35), bidRates (Json — {"{Title}:{Year}": ratePerHour})`. Stores bid labor rates by trade level used in the Summary tab profitability calculation. Managed in Admin → Settings → Labor Rates card. Seeded via `scripts/seed-wages.js`. API: `GET/PUT /api/admin/company-rates`.

```
Bid rates stored format example:
{
  "Apprentice:1st": 45, "Apprentice:2nd": 48, "Apprentice:3rd": 52, "Apprentice:4th": 56,
  "Journeyman:1st": 65, "Journeyman:2nd": 68, "Journeyman:3rd": 72,
  "Master Electrician:": 85, "Foreman:": 90, "General Foreman:": 95
}
```

**EmployeeWage** — One record per field crew member (`userId @unique`). Fields: `title (String), year (String), hourlyWage (Float), burdenRate (Float, default 0.35), paySchedule (String, default "biweekly"), isFieldCrew (Boolean, default true), notes (String?), wageHistory (Json @default("[]") — array of {date, wage, title}), updatedAt, updatedBy`. Managed in Admin → Users → Wage section. API: `GET/PUT /api/admin/users/[userId]/wage`. Seeded via `scripts/seed-wages.js`.

Current crew wages (as seeded):
| Name | Title | Year | Wage | Burdened (35%) | Field |
|---|---|---|---|---|---|
| Tyler Staiti | Apprentice | 1st | $16/hr | $21.60/hr | ✓ |
| Michael Huggins | Apprentice | 1st | $17/hr | $22.95/hr | ✓ |
| Caleb Drouin | Journeyman | 1st | $35/hr | $47.25/hr | ✓ |
| Steven Haradon | Master Electrician | — | $41/hr | $55.35/hr | ✓ |
| Sam Cosme | Office | — | $0 | — | overhead |
| Beth Marceau | Office | — | $0 | — | overhead |
| Justin Marceau | Owner | — | $0 | — | overhead |

**Supplier** — `id, name, repName, email, phone, accountNumber, deliveryNotes, pickupOnly (Boolean), notes`. Managed in Admin → Settings → Suppliers card. `pickupOnly` routes items to the consumables/pickup list instead of the supplier email.

**StockItem** — `id, category, name, lingo, sku, unitOfMeasure (default "EA"), defaultSupplier, isConsumable (Boolean), variables (Json — array of VarConfig objects), notes, sortOrder`. Seeded with ~120+ items across 22+ categories. `variables` drives the dynamic form UI in The Crib.

**VarConfig** (Json structure on StockItem.variables):
```ts
{ key: string; label: string; type: "select" | "text"; options?: string[]; placeholder?: string; required?: boolean }
```

**StockRequest** — `id, jobId, userId, stockItemId (optional → StockItem), customItemName, customCategory, variables (Json — {key: value}), quantity, quantityUnit, note, deliveryMethod (default "PICKUP"), isConsumableOverride (Boolean @default(false)), status (PENDING | PENDING_APPROVAL | SENT | CANCELLED), conductorGroupId (String? — shared UUID for multi-conductor THHN sets), saveToMasterList (Boolean @default(false)), approvalRequestId (String? → StockApprovalRequest), orderDate, createdAt`. Resets to CANCELLED at midnight via cron.

**StockOrder** — Snapshot of a sent order. `jobId, supplierName, supplierEmail, deliveryMethod, poNumber, deliveryNotes, items (Json snapshot), sentAt, sentById`. Archived to Document Vault automatically on send.

**StockApprovalRequest** — `id, jobId, requestedById (→ User), status (PENDING | APPROVED | REJECTED), rejectionReason, reviewedById (→ User?), reviewedAt, createdAt`. Created when a TEAMMATE without ordering permission submits an order. Reviewed by FOREMAN or ADMIN in The Crib tab.

**UserPermission** — `id, userId, permission ("ORDERING"), scope ("GLOBAL" | "JOB"), jobId?, grantedById`. Grants TEAMMATEs/FOREMANs ordering permission in The Crib. Managed in Admin → Users table (toggle per user).

**CalendarRequest** — Teammate-submitted calendar event requests. `jobId, requestedById, date, timeOfDay, description, reason, status (CalendarRequestStatus), reviewedById, reviewNotes, reviewedAt`.

**BomPricing** — `id (bomId), mat (Float), lhr (Float), updatedAt, updatedBy`. Override table for BOM item material costs and labor hours. Managed in Admin → Settings → BOM Pricing Overrides card. API: `GET/PATCH /api/admin/bom-pricing`.

**Other models:** LaborEntry, Photo, Note, ChangeOrder, ChangeOrderPhoto, SavedTask, Task, TaskEvent, Inspection, Rfi, Document, Session, Account, VerificationToken, NotificationPreference.

---

## Gross Billing Calculation (Summary Tab Logic)

Used consistently across Summary tab, AIA PDF route, and billing reminder cron. **Always use this exact formula:**

```ts
// Per-category markup is now inline on each cost line (separate % per category)
const laborCost = blendedRate > 0 ? totalHours * blendedRate : 0;
const laborMarkup = laborCost * ((laborMarkupPct ?? 0) / 100);
const materialMarkup = materialsCost * ((materialMarkupPct ?? 0) / 100);
const subMarkup = subCost * ((subMarkupPct ?? 0) / 100);
const equipBilled = equipCost * ((equipBillPct ?? 100) / 100);
const equipMarkup = equipBilled * ((equipmentMarkupPct ?? 0) / 100);
// Other costs: each item has its own markupPct; fall back to job.otherMarkupPct
const otherMarkedUp = otherCosts.reduce((s, oc) => {
  const pct = oc.markupPct ?? job.otherMarkupPct ?? 0;
  return s + oc.amount * (1 + pct / 100);
}, 0);
const grossBilling = (laborCost + laborMarkup) + (materialsCost + materialMarkup)
                   + (subCost + subMarkup) + (equipBilled + equipMarkup) + otherMarkedUp;
```

Decimal fields from Prisma need `.toNumber()`: `(job.contractValue as any)?.toNumber?.() ?? Number(job.contractValue ?? 0)`.

---

## Summary Tab — Direct Costs Card

Each cost category (Labor, Materials, Subcontractors, Equipment, Other Costs) has an **inline markup % input** directly beside the cost amount. The separate "Markups" card was removed. All costs + markup %s save together via `updateDirectCostsWithMarkups()` in one round-trip.

- **Labor** — blended rate $/hr input + markup %; shows burdened total with markup applied
- **Materials** — read-only (from Purchase Orders tab) + markup %
- **Subcontractors** — cost input + markup %
- **Equipment Rental** — total cost input + bill % (what fraction to bill this period) + markup %
- **Other Costs** — JSON array on Job; each item has its own description, amount, and `markupPct` (per-item); default other markup % applies to new items
- **Total Direct Costs** = sum of all marked-up line totals

The "Gross Billing Amount" in the Contract & Billing card = this total.

---

## Summary Tab — Profitability Card

Visible to **ADMIN and OFFICE** roles only. Collapsible (click to expand). Shows:

- **Gross Profit / Loss** = Gross Billing − Total Actual Cost, with margin %
- **Actual labor cost** = sum of (each worker's hours × their `hourlyWage × (1 + burdenRate)`) — computed from `LaborEntry.user.wage`
- **Actual cost breakdown** — labor (burdened), materials (actual purchase cost), subs, equipment billed, other
- **Labor budget vs actual** — hours over/under if `laborBudgetHours` is set
- **Bid rate vs actual labor** — compares `CompanyRates.bidRates[title:year]` × hours against burdened wages
- **Per-employee labor detail** — hours, wage, burdened cost per person

If wage data is not set for a crew member, their labor shows as "—" with a prompt to set wages in Admin → Users.

---

## Summary Tab — Deposit Request Card

Visible to **ADMIN** only. Generates a branded "DEPOSIT REQUEST" PDF for sending to the GC. Fields: deposit amount (fixed $ or % of contract value), due date, description, notes. Two buttons:

- **Email to GC** — opens `mailto:` link with pre-filled subject and body (attaches PDF manually)
- **Download PDF** — calls `POST /api/jobs/[id]/deposit-request`, returns branded PDF

PDF style matches Standard Invoice: Oak Ridge logo, navy/orange branding, GC "To" block from job's GC contact fields.

---

## Tab Order (Job Detail Page)

Info → Labor → Invoices → The Crib → Photos → Notes & Tasks → Calendar → Inspections → RFI → Documents → Summary

**"Invoices" tab** = the renamed Materials tab (was "Materials" through Phase 8). DB model and server actions still use the name `materials` — only the UI label changed.

**"The Crib" tab** = stock ordering system (Phase 9+). Added after the Invoices tab.

Tab visibility rules are enforced in `job-tabs.tsx` by role and jobType.

---

## The Crib — Stock Ordering System

**Location:** `app/(app)/jobs/[id]/tabs/crib-tab.tsx` (~1200 lines, client component)

### How it works

1. User browses the stock list organized by category in a 2-column grid.
2. Tapping an item **expands it inline** (accordion — no page jumping) revealing a smart variable form directly below the item card. Tapping again collapses.
3. User fills in variables (size, color, footage, etc.), qty, optional note, and taps "Add to Order."
4. Items accumulate in "Today's Order" list at the top.
5. **Send Order** button (ADMIN/FOREMAN only, or TEAMMATE with ordering permission) opens the Send Order modal.
6. **Send Order modal** — Step 1: required delivery selection (Pickup / Delivery to Site / Delivery to Shop). Step 2: supplier selection, PO/Job number, delivery notes, send.
7. On send: generates branded PDF, emails supplier (or pickup list to Michael/Justin/Sam/Foreman for consumables), archives PDF + Word doc to Document Vault, marks requests SENT.
8. **Midnight cron** resets stale PENDING requests from prior days.

### Wire & Cable ordering rules

**THHN / XHHW / THWN / SIMpull:**
- Size #6 AWG and smaller (`["14","12","10","8","6"]`) → copper only (no CU/AL toggle), footage input only (no reel select)
- Size #4 AWG and larger (`["4","3","2","1","1/0","2/0","3/0","4/0","250MCM","350MCM","500MCM"]`) → CU/AL toggle (default CU), reel size select (500ft/1000ft/2500ft) + custom footage option

**MC Cable / NM-B Romex / UF-B:**
- 14 AWG / 12 AWG sizes (`"14/2","14/3","12/2","12/3"`) → roll sizes 250ft and 400ft only — no custom footage
- 10 AWG / 8 AWG sizes (`"10/2","10/3","8/3"`) → 250ft, 400ft, or custom footage
- 6 AWG and larger (`"6/3"`) → footage entry only (order by the foot, no roll sizes)

**Multi-conductor THHN mode:** Toggle in THHN expand form. Select conductor count + color per conductor → generates N separate StockRequests sharing a `conductorGroupId`. Displayed as a collapsible group in Today's Order. Prints as individual line items on the PDF.

### Consumables routing

Consumable items (`isConsumable: true` on StockItem, or `isConsumableOverride: true` on StockRequest for custom items) **always** route to the pickup list regardless of the delivery selection. The pickup list email goes to: Michael, the job's assigned Foreman, Justin, and Sam (CC). Pickup list is a branded PDF titled "PICKUP LIST."

### Category-level custom adders

Every category has an inline "＋ Add Custom [Category]" button at the bottom of its item grid. Tapping it opens a compact form with the category pre-filled and locked. Includes Save to Master List toggle.

### Save to Master List

Custom items submitted with `saveToMasterList: true` are automatically added to the StockItem table (by name, preventing duplicates) after the order is sent. Admin receives a notification email.

### Ordering permission (TEAMMATE)

TEAMMATEs without an `ORDERING` UserPermission who tap Send Order get a "submit for approval" flow instead. Creates a `StockApprovalRequest`, sets all their PENDING requests to `PENDING_APPROVAL`, notifies Foreman + Admins + Sam. FOREMAN/ADMIN see a yellow badge on The Crib tab and a Pending Approval panel with Approve/Reject buttons. Approving triggers the full send flow immediately.

### Stock categories (22+)

Wire & Cable, Low Voltage, EMT Conduit, EMT Fittings, PVC Conduit Fittings, Rigid / IMC Fittings, Flex Conduit Fittings, Liquid Tight Fittings, Conduit — Other Types, MC / AC Cable Fittings, Boxes, Mud / Plaster Rings, Wire Connectors, Grounding, Staples & Fasteners, Panels & Breakers, Devices & Receptacles, Lighting, Tape & Sealants, Misc Hardware & Specialty, Strut & Hangers, Consumables & Safety

---

## Google Integration

**Settings page:** Admin → Settings → Google Integration card. One Google account per app (not per user). Stores credentials in `GoogleConnection` table.

**OAuth flow:** `GET /api/google/callback` handles the code exchange. Scopes: `email, profile, spreadsheets, calendar, drive`. User must Disconnect and Reconnect after adding the Drive scope (required for AIA Sheets template copy).

**Token management:** `getValidAccessToken()` in `lib/google.ts` checks expiry, auto-refreshes 60 seconds before expiry via `POST https://oauth2.googleapis.com/token`.

### Google Calendar sync

- `syncCalendarEventToGoogle(params)` — creates or updates a Google Calendar event. Title format: `{jobNumber} — {title}`. Description includes job name, number, note, and a direct link to the job in the app. RRULE recurrence is generated from the app's recurrence field.
- `deleteCalendarEventFromGoogle(googleEventId)` — deletes the event.
- Both called automatically from `addCalendarEvent` and `deleteCalendarEvent` in `calendar-tab-actions.ts`. `googleEventId` is stored on `CalendarEvent`.

### AIA → Google Sheets

Route: `GET /api/google/sheets/[invoiceId]`

Copies Beth's template file (`1R4r9hrg6DhahiNzE4apUGfxD3uqGVk-k`) via the Drive API (`POST /drive/v3/files/{fileId}/copy`). Writes computed AIA values to the copy using the Sheets API batchUpdate. Writes to sheet named "AIA{applicationNo}" (e.g. "AIA1", "AIA2"), falls back to "Sheet1" if not found. Returns `{ url: "https://docs.google.com/spreadsheets/d/{id}/edit" }`. Stores the spreadsheet ID on `Invoice.googleSheetId`.

Returns a 403 with a reconnect instruction if the Drive scope hasn't been granted yet.

---

## PDF Templates (`app/api/jobs/[id]/pdf/_templates.tsx`)

All PDF components use `@react-pdf/renderer`. Constants: `NAVY = "#002D72"`, `ORANGE = "#FF5910"`. Helvetica fonts. `export const runtime = "nodejs"` required on every route that calls `renderToBuffer`.

| Component | Used by |
|---|---|
| `StandardInvoiceDoc` | `/api/jobs/[id]/pdf/invoice/[invoiceId]` |
| `AiaDoc` | `/api/jobs/[id]/pdf/aia/[invoiceId]` |
| `JobReportDoc` | `/api/jobs/[id]/pdf` |
| `SummaryReportDoc` | `/api/jobs/[id]/pdf/summary` |
| `ChangeOrderDoc` | `/api/jobs/[id]/pdf/co/[coId]` |
| `InspectionDoc` | `/api/jobs/[id]/pdf/inspection/[inspectionId]` |
| `RfiDoc` | `/api/jobs/[id]/pdf/rfi/[rfiId]` |
| `StockOrderPdf` | `/api/jobs/[id]/stock-orders` — accepts `title?: string` prop (defaults "MATERIAL ORDER", pass "PICKUP LIST" for consumables) |
| Deposit Request PDF | `/api/jobs/[id]/deposit-request` (POST) — inline, not in `_templates.tsx` |

### Standard Invoice format (Oak Ridge branded)

- Centered logo (`public/logo.png` as base64 data URI)
- "OAK RIDGE ELECTRICAL LLC" header with address: 209 W. River Rd, Hooksett, NH 03106
- FROM section: Justin Marceau, Owner, 603-660-4651, Justin@oakridgeelectrical.com
- PROGRESS PAYMENT / FINAL INVOICE label (from `invoiceKind`)
- Two-column project info (FROM / TO + PROJECT)
- Scope of work as numbered line items (no per-item amounts)
- Financial summary: Contract → COs → Revised → Invoice Total → Retainage → Payment Due
- Payment terms paragraph (NH law 1.5%/month finance charge language)
- One-year workmanship warranty paragraph
- Footer: "Thank you for your business! Oak Ridge Electrical LLC — Justin Marceau, Owner — 603-660-4651 | Justin@oakridgeelectrical.com"

### Stock Order PDF format

- "OAK RIDGE ELECTRICAL LLC" in NAVY bold, contact info
- "MATERIAL ORDER" (or "PICKUP LIST") in ORANGE bold centered
- Info block: To (supplier + rep), Date, PO/Job Number, Delivery (stated once — never per-item)
- Item table with NAVY header row: # | Item | Description | Qty | Unit
- Item notes as indented italic sub-line if present
- Total item count
- Same footer as Standard Invoice

---

## Cron Jobs

All cron routes require `Authorization: Bearer <CRON_SECRET>` header (auto-set by Vercel). Add to `publicPaths` in `proxy.ts` to bypass auth middleware.

### `vercel.json` schedule

```json
{
  "crons": [
    { "path": "/api/cron/daily-report",      "schedule": "0 9 * * *" },
    { "path": "/api/cron/billing-reminder",  "schedule": "0 9 * * *" },
    { "path": "/api/cron/reset-stock-orders","schedule": "0 5 * * *" }
  ]
}
```

All times are UTC. `0 9 * * *` = 4:00 AM EST / 5:00 AM EDT.

### `/api/cron/daily-report`

Fires every day. Sends a branded HTML report email to all active ADMIN users. Sections:
- Hours logged yesterday (grouped by job)
- Materials entered yesterday
- Notes posted yesterday
- Tasks due today
- Overdue tasks
- Pending change orders
- Inspections today and failed inspections yesterday
- Calendar events today
- Open RFIs older than 7 days
- Labor and material budget alerts (≥80% used)

Also sends a per-job email to each active FOREMAN for each of their assigned active jobs (yesterday's hours, tasks due in 7 days, upcoming calendar events, open RFIs, upcoming inspections).

### `/api/cron/billing-reminder`

Fires every day but **exits silently** if `dayOfMonth < 15 || dayOfMonth > 23`. On days 15–23, sends a billing reminder email.

**Recipients:** Justin (`justin@oakridgeelectrical.com`) and Beth (`beth@oakridgeelectrical.com`) as primary; Sam (`sam@oakridgeelectrical.com`) as CC.

**Subject:** `Monthly Billing Reminder — {Month Year} — {N} Jobs Ready to Bill`

**Content:**
- Warning banner: "Invoice by the 20th — billing period ends the 30th"
- Table of all active/on-hold jobs with outstanding balances, sorted by balance remaining descending (biggest first). Columns: Job # | Job Name + Foreman | % Done | Gross Billing | Last Invoice Date | Last Payment Date | Balance Remaining
- Jobs with no invoices show "Not yet invoiced" in red
- Four summary stat tiles: Active Jobs / Total Gross Billing / Total Balance / Not Yet Invoiced count
- Footer: "Billing period projects to the 30th. Invoice date is the 20th. Review each job and generate invoices from the Summary tab."
- Direct link to app dashboard

Gross billing computed using the standard Summary tab formula. Fully paid jobs (balance ≤ 0) are excluded.

### `/api/cron/reset-stock-orders`

Fires daily at 5:00 AM UTC. Cancels all StockRequests with status `PENDING` or `PENDING_APPROVAL` from prior days (`orderDate < today`). Requires `CRON_SECRET` bearer auth.

---

## Admin Settings Page (`/admin/settings`)

**Route:** `app/(app)/admin/settings/page.tsx` (server component, fetches data, passes to `SettingsClient`)
**Client:** `app/(app)/admin/settings/settings-client.tsx`

### Cards on the settings page

**Company Info** — Edit company name, address, city, state, zip, phone, email, logo URL. Saves to `CompanySettings` singleton via `PUT /api/admin/company-settings`. Used as source of truth for PDF templates (with DB field fallbacks to hardcoded defaults).

**Notifications** — Read-only display: email active status (based on env vars), delivery time (4:00 AM EST), Sam CC always on, Admin BCC always on. Includes "Send Test Email" button (`POST /api/admin/test-email`) that fires to all admins + Sam.

**Notification Preferences** — Per-event toggle list. Each key maps to a notification type (stock_order_sent, co_submitted, task_assigned, etc.). Saved to `NotificationPreference` model via `/api/admin/notification-preferences`.

**Labor Rates** — Default burden rate (editable, stored as decimal e.g. 0.35 = 35%) and bid rates table by trade level (editable inline per row). Reads/writes `CompanyRates` singleton via `GET/PUT /api/admin/company-rates`. Rates are keyed as `"Title:Year"` in the bidRates JSON field.

**BOM Pricing Overrides** — Override default material costs and labor hours per BOM item. Filtered by category, searchable. Items with overrides highlighted in amber. API: `GET/PATCH /api/admin/bom-pricing`. Fix: `updatedBy` field uses `session.user.id ?? null` to avoid TypeScript type error.

**Google Integration** — Shows connected Google account or Connect button. Disconnect button. Connect initiates OAuth flow via `getGoogleOAuthUrl()`.

**Google Calendar Sync** — Shown only when Google is connected. Informational — sync is automatic on create/delete, no manual button needed.

**AIA → Sheets** — Shown only when Google is connected. Displays Beth's template file ID. Note that users must reconnect Google if Drive scope wasn't granted on initial connection.

**Suppliers** — Full CRUD for supplier records. Fields: name, rep name, email, phone, account number, delivery notes, pickup only toggle. "Reset Supplier List" button replaces all suppliers with 10 pre-configured electrical suppliers (Granite City Electric, CED, Rexel, Northeast Electric, State Electric, Green Mountain Electric, CES, Home Depot, Amazon, Lowes).

**Stock List** — Collapsible. Items organized by category. Inline edit/delete per item. Add Item form at bottom. Items saved here appear in The Crib for all jobs.

---

## Admin Users Page (`/admin/users`)

**Route:** `app/(app)/admin/users/page.tsx` + `user-table.tsx`

Each user row supports:
- Role selector (ADMIN/OFFICE/FOREMAN/TEAMMATE)
- Active/Pending toggle
- **Ordering permission toggle** (TEAMMATE/FOREMAN) — `GET/POST/DELETE /api/admin/users/[userId]/permissions`
- **Estimating permission toggle** (non-ADMIN) — `GET/POST/DELETE /api/admin/users/[userId]/estimating-permission`
- **Wage section** (collapsible, click `$` / "Wage" button) — inline edit form for title, year, hourly wage, burden rate, field crew flag, notes. Saves via `PUT /api/admin/users/[userId]/wage`. Previous wage recorded in `wageHistory` on change.

Wage titles available: Apprentice (1st–4th year), Journeyman (1st–3rd year), Master Electrician, Foreman, General Foreman, Office, Owner.

The users page query now includes `wage` relation so wage data renders server-side without a separate fetch for the initial display.

---

## Key Files Reference

```
/
├── auth.ts                          # NextAuth config (Google provider, session callback, role)
├── auth.edge.ts                     # Edge-compatible session check (used by proxy.ts)
├── proxy.ts                         # Auth middleware — exports proxy() + config matcher
│                                    # Add new unauthenticated routes to publicPaths here
├── vercel.json                      # Cron schedules (3 jobs)
├── next.config.ts                   # serverExternalPackages: ["docx", "sharp"]
├── prisma/
│   └── schema.prisma                # Full database schema
├── app/
│   ├── generated/prisma/            # Prisma generated client (don't edit)
│   ├── (app)/
│   │   ├── page.tsx                 # Dashboard — jobs by status + Estimates section
│   │   ├── actions.ts               # createJob server action
│   │   ├── create-job-button.tsx    # New job modal with type selector
│   │   ├── job-card.tsx             # Job card component
│   │   ├── layout.tsx               # App layout with Header
│   │   ├── calendar/page.tsx        # Master calendar
│   │   ├── admin/
│   │   │   ├── users/
│   │   │   │   ├── page.tsx         # User management — fetches users with wage relation included
│   │   │   │   └── user-table.tsx   # OrderingPermissionToggle, EstimatingPermissionToggle,
│   │   │   │                        # WageSection (collapsible inline edit) per user
│   │   │   └── settings/
│   │   │       ├── page.tsx         # Settings server component (fetches GoogleConnection, CompanySettings)
│   │   │       └── settings-client.tsx  # All settings cards including Labor Rates + BOM Pricing
│   │   └── jobs/[id]/
│   │       ├── page.tsx             # Job detail — fetches laborEntries with user.wage included,
│   │       │                        # fetches CompanyRates singleton, passes both to JobTabs
│   │       ├── job-tabs.tsx         # Tab bar + routing. Accepts companyRates prop, passes to SummaryTab.
│   │       │                        # Tab order: Info→Labor→Invoices→Crib→
│   │       │                        # Photos→Notes&Tasks→Calendar→Inspections→RFI→Documents→Summary
│   │       └── tabs/
│   │           ├── job-info-tab.tsx
│   │           ├── labor-tab.tsx              # Duplicate failsafe modal
│   │           ├── labor-tab-actions.ts       # addLaborEntries(mode: check|add|replace)
│   │           ├── materials-tab.tsx          # UI label "Invoices"; auto-archives to Document Vault
│   │           ├── materials-tab-actions.ts   # addMaterial — archives beyond 5 with fileUrls
│   │           ├── crib-tab.tsx               # The Crib — full stock ordering UI (~1200 lines)
│   │           │                              # ThhnWireForm, McRomexWireForm, ItemExpandForm,
│   │           │                              # CustomItemForm, CategoryCustomAdder,
│   │           │                              # ConductorGroupCard, SendOrderModal (2-step)
│   │           ├── summary-tab.tsx            # Financial view. DirectCostsCard (inline markup per row).
│   │           │                              # ProfitabilityCard (Admin/Office, collapsible).
│   │           │                              # DepositRequestCard (Admin only).
│   │           │                              # ContractBillingCard. InvoiceLogCard. PaymentLogCard.
│   │           ├── summary-tab-actions.ts     # updateDirectCostsWithMarkups, createInvoice(force),
│   │           │                              # addOtherCost(markupPct?), requireAdminOrForemanOnJob
│   │           ├── documents-tab.tsx
│   │           ├── documents-tab-actions.ts
│   │           ├── calendar-tab.tsx           # CalendarRequest UI, pending requests panel
│   │           ├── calendar-tab-actions.ts    # addCalendarEvent (syncs to Google), deleteCalendarEvent
│   │           ├── calendar-request-actions.ts # submitCalendarRequest, reviewCalendarRequest
│   │           ├── notes-tasks-tab.tsx
│   │           ├── notes-tasks-tab-actions.ts
│   │           ├── inspections-tab.tsx
│   │           └── rfi-tab.tsx
│   └── api/
│       ├── auth/[...nextauth]/route.ts        # NextAuth handler
│       ├── upload/route.ts                    # Supabase file upload
│       ├── google/
│       │   ├── callback/route.ts              # OAuth code exchange → stores GoogleConnection
│       │   └── sheets/[invoiceId]/route.ts    # Copies Beth's AIA template, writes values, returns URL
│       ├── admin/
│       │   ├── company-settings/route.ts      # GET/PUT CompanySettings singleton
│       │   ├── company-rates/route.ts         # GET/PUT CompanyRates singleton (burden + bid rates)
│       │   ├── test-email/route.ts            # POST — sends test email to admins + Sam
│       │   ├── bom-pricing/route.ts           # GET/PATCH BomPricing overrides
│       │   ├── seed-wages/route.ts            # POST (ADMIN only) — one-time crew wage seeder via API
│       │   ├── suppliers/
│       │   │   ├── route.ts                   # GET all, POST new supplier
│       │   │   ├── [id]/route.ts              # PUT/DELETE supplier
│       │   │   └── reset/route.ts             # POST — replaces all with 10 defaults
│       │   ├── stock-items/
│       │   │   ├── route.ts                   # GET (seeds on first call), POST
│       │   │   └── [id]/route.ts              # PUT/DELETE
│       │   └── users/
│       │       └── [userId]/
│       │           ├── permissions/route.ts          # GET/POST/DELETE ordering permissions
│       │           ├── estimating-permission/route.ts # GET/POST/DELETE estimating permission
│       │           └── wage/route.ts                 # GET/PUT employee wage record
│       ├── cron/
│       │   ├── daily-report/route.ts          # Admin + foreman daily emails
│       │   ├── billing-reminder/route.ts      # Monthly billing reminder (15th-23rd only)
│       │   └── reset-stock-orders/route.ts    # Midnight PENDING → CANCELLED
│       └── jobs/[id]/
│           ├── deposit-request/route.ts       # POST — generates branded Deposit Request PDF
│           ├── stock-requests/
│           │   ├── route.ts                   # GET today's requests, POST new request
│           │   ├── [requestId]/route.ts       # DELETE request
│           │   └── pending-approval/route.ts  # GET PENDING_APPROVAL requests grouped by approval
│           ├── stock-orders/route.ts          # POST — generates PDF, emails, archives, marks SENT
│           │                                  # SAM_CC locked here — do not remove
│           ├── stock-approval/
│           │   └── [approvalId]/
│           │       ├── approve/route.ts       # POST — triggers send flow for approved orders
│           │       └── reject/route.ts        # POST { reason } — notifies requester
│           └── pdf/
│               ├── _templates.tsx             # All PDF React components (StockOrderPdf, AiaDoc, etc.)
│               ├── route.ts                   # Full job report PDF
│               ├── aia/[invoiceId]/route.ts   # AIA G702/G703 PDF (retainage default 10%)
│               ├── invoice/[invoiceId]/
│               │   ├── route.ts               # Standard Invoice PDF
│               │   └── docx/route.ts          # Standard Invoice Word doc
│               ├── co/[coId]/route.ts
│               ├── inspection/[inspectionId]/route.ts
│               └── rfi/[rfiId]/route.ts
├── components/
│   └── header.tsx                   # App header with logo (/logo.png)
├── lib/
│   ├── prisma.ts                    # PrismaClient singleton with PrismaPg adapter
│   ├── notifications.ts             # LOCKED — SAM_CC rule lives here. send(), BCC admins,
│   │                                # event-specific helpers (note, CO, task, RFI, calendar request)
│   ├── email.ts                     # LOCKED — SAM_CC rule lives here. sendWelcomeEmail()
│   ├── google.ts                    # getValidAccessToken(), googleFetch(), getGoogleOAuthUrl(),
│   │                                # syncCalendarEventToGoogle(), deleteCalendarEventFromGoogle(),
│   │                                # DRIVE_SCOPES, CALENDAR_SCOPES, SHEETS_SCOPES, ALL_GOOGLE_SCOPES
│   └── app-url.ts                   # APP_URL resolution (AUTH_URL → NEXTAUTH_URL → VERCEL_URL)
├── public/
│   ├── logo.png                     # Company logo (used in PDF templates as base64)
│   └── logo.jpg.jpg                 # Original (double extension — legacy, can be deleted)
└── scripts/
    ├── migrate-roles.ts             # One-time FIELD→FOREMAN migration (already run, do not re-run)
    └── seed-wages.js                # One-time crew wage + CompanyRates seed (plain Node.js, safe to re-run)
                                     # Run: node scripts/seed-wages.js (uses DIRECT_URL connection)
```

---

## Known Issues / Gotchas

### Architecture

1. **No `middleware.ts`** — Auth middleware is `proxy.ts`. Every new unauthenticated route (cron, webhook, OAuth callback) needs its path prefix added to `publicPaths` in `proxy.ts` or it will return 401 before the handler runs.

2. **Prisma adapter required** — Every file instantiating `PrismaClient` must use the `PrismaPg` adapter pattern from `lib/prisma.ts`. Never call `new PrismaClient()` without the adapter.

3. **Two-stage enum migration** — PostgreSQL cannot drop an enum value that's in use. Stage 1: add new values, keep old → `db push`. Stage 2: migrate data with `$queryRaw` → `db push --accept-data-loss`.

4. **Decimal fields** — Always call `.toNumber()` or use `(val as any)?.toNumber?.() ?? Number(val ?? 0)` before arithmetic. Never pass Decimal objects directly to PDF templates or JSON responses without converting.

5. **TypeScript narrowing in JSX** — Inside `{isTeammate ? A : B}`, TypeScript narrows `role` inside B to exclude `"TEAMMATE"`. Comparisons like `role === "TEAMMATE"` inside B trigger TS2367. Hoist the check to a boolean variable before the ternary.

6. **No tsx/ts-node** — One-time database scripts must be plain `.js` files using `require("pg")` directly. TypeScript scripts cannot be run locally without installing tsx. Use `DIRECT_URL` (port 5432, no pgbouncer) for scripts.

7. **EPERM build error** — If `.next` is locked by a running dev server and you try to build, you'll get EPERM unlink errors. Stop the dev server first or clear with: `Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue`

### Email

8. **SAM_CC is LOCKED** — `sam@oakridgeelectrical.com` must remain CC'd on all outbound email. This constant exists in `lib/notifications.ts` AND `app/api/jobs/[id]/stock-orders/route.ts`. Do not remove it from either.

9. **Stock order email diagnostics** — The stock-orders route has detailed `console.log` statements at each step. If emails aren't arriving, check Vercel function logs for `[stock-order]` entries. The most common failure is `supplierEmail` being null — in that case the fallback sends to Justin with `[NO SUPPLIER EMAIL]` in the subject.

10. **Document Vault saves use data URIs** — Stock order PDFs are stored in `Document.fileUrl` as `data:application/pdf;base64,...` strings. This works for the in-app document viewer but the files are not stored in Supabase Storage. This is intentional for stock orders.

### Google Integration

11. **Drive scope requires reconnect** — If a user connected Google before the Drive scope was added, they must Disconnect and Reconnect in Settings to grant the new scope. The AIA Sheets route returns a 403 with a clear reconnect message if Drive isn't granted.

12. **Beth's AIA template ID** — `1R4r9hrg6DhahiNzE4apUGfxD3uqGVk-k`. The template is copied (not modified) on each AIA Sheets export. The copy is stored in the connected Google account's Drive. Beth's cell positions in the template determine what gets written where — if the template layout changes, the Sheets batchUpdate values need to be recalibrated.

### The Crib

13. **Stock items seed** — Items are seeded on the first GET to `/api/admin/stock-items` when the DB count is 0. New items added in code use `seedNewItems()` which upserts by name. If an item name changes in code, the old DB record stays and a new one is created — clean up via Admin → Settings → Stock List.

14. **Consumables routing** — Relies on `StockItem.isConsumable` (for catalog items) and `StockRequest.isConsumableOverride` (for custom items where user checked "Is Consumable"). The `SendOrderModal` filters using both. If a stock item that should be consumable isn't routing to the pickup list, check the `isConsumable` flag on the StockItem in the DB.

15. **Word doc in Document Vault** — Stock orders generate both a PDF and a Word doc, both saved to Document Vault. The Word doc uses a text-based header (no embedded logo image). The email only attaches the PDF.

### Cron

16. **Billing reminder window** — The cron fires daily but checks `dayOfMonth` and exits silently outside days 15–23. This is by design — Vercel doesn't support per-day-of-month cron expressions in the free tier schedule format.

17. **`createdById` on Job is nullable** — Jobs created before Phase 7 have `createdById = null`. The foreman financial access check handles this correctly since `null !== userId`.

### Wages & Profitability

18. **Profitability only as accurate as wage data** — The Profitability card computes actual labor cost from `LaborEntry.user.wage`. If a crew member has no `EmployeeWage` record, their hours show as "—" with a warning. Re-run `node scripts/seed-wages.js` or set wages manually in Admin → Users to fix. The seed script matches users by name substring (case-insensitive) so "Tyler" matches "Tyler Staiti".

19. **Bid rate key format** — `CompanyRates.bidRates` keys are `"{Title}:{Year}"` e.g. `"Apprentice:1st"`, `"Master Electrician:"` (empty year for single-level titles). The colon is always present. The profitability card looks up `bidRates[`${title}:${year}`]` first, then falls back to `bidRates[`${title}:`]`.

20. **BOM Pricing `updatedBy`** — `session.user.id` is typed as `string | undefined` in NextAuth v5. The API route uses `session.user.id ?? null` to safely write to `BomPricing.updatedBy (String?)`. Never pass `undefined` directly to Prisma string fields.

---

## Development Workflow

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Type check only
npx tsc --noEmit

# Push schema changes to DB (use DIRECT_URL for local)
npx prisma db push

# Regenerate Prisma client after schema changes
npx prisma generate

# Production build — always run before committing
npm run build

# One-time crew wage seed (plain Node.js, safe to re-run)
node scripts/seed-wages.js
```

### Deploy

Push to `main` → Vercel auto-deploys. Vercel reads `vercel.json` for cron config. Schema changes must be pushed to the DB separately — Prisma migrations are not run automatically on Vercel.

---

## Phase History

### Phase 1 — Foundation
Next.js 16 project setup, Supabase PostgreSQL, Google OAuth via NextAuth v5, edge middleware (`proxy.ts`), User model with `active`/`role`, `/login`, `/pending`, admin user management.

### Phase 2 — Job Core (9 routes)
Dashboard, job creation modal, job detail page with full tab layout: Info, Labor, Materials, Photos, Notes & Tasks, Calendar (with master calendar at `/calendar`), Inspections, RFI, Documents, Summary. Full job report PDF, billing summary PDF.

### Phase 3 — PDF Templates
Job report, billing summary, change order, inspection record, RFI, Standard Invoice, AIA G702/G703 (two-page) PDFs.

### Phase 4 — Email Notifications
New note, change order submitted/approved/rejected, task assigned, RFI submitted. Admin BCC on all outbound emails.

### Phase 5 — AIA Invoices
AIA G702/G703 invoice type, auto-populated line items, AIA PDF route.

### Phase 6 — Bug Fixes
AIA PDF 500 error, silent email failures, login loop (`allowDangerousEmailAccountLinking`, `trustHost`), AUTH_SECRET/AUTH_URL documented.

### Phase 7 — Role System Overhaul
FIELD role removed → FOREMAN + TEAMMATE. Permission matrix implemented. Foreman dropdown on Job Info. Teammate calendar request workflow (submit → Foreman/Admin review → approve creates event / deny notifies requester). Daily admin report cron + per-foreman per-job emails.

### Phase 8A — Job Types, Invoice Rebuild, Failsafes, Cron Fixes
Logo added. `JobType` enum (BID/T&M/ESTIMATE). Summary tab behavior by job type. Standard Invoice rebuilt (Oak Ridge branded with new address). Progress Payment / Final Invoice toggle (`invoiceKind`). Word doc for Standard Invoice. Duplicate labor failsafe (check/add/replace modal). Duplicate invoice failsafe (same-month warning). Daily report fixed to use yesterday's date for activity data. Three new activity sections in admin report.

### Phase 8B — Google Integration, AIA Sheets, Materials Auto-Archive, Suppliers
Google OAuth integration (Drive + Sheets + Calendar scopes). `GoogleConnection` model. AIA → Google Sheets: copies Beth's template (`1R4r9hrg6DhahiNzE4apUGfxD3uqGVk-k`), writes AIA values. Google Calendar real-time sync on create/delete. Materials tab auto-archive (5 most recent visible, older with files → Document Vault as MATERIAL_RECEIPTS). Supplier management (Settings card with CRUD + reset). AIA PDF fixes (retainage default 10%, G703 previouslyBilled proportional, equipBilled formula). Standard Invoice address updated to 209 W. River Rd, Hooksett NH 03106. Company Info settings card. Notifications settings card. Sam CC permanent rule implemented in both `lib/notifications.ts` and `lib/email.ts`.

### Phase 9 — The Crib Stock Ordering System
"Materials" tab renamed to "Invoices" (UI only). New "The Crib" tab added after Invoices. Database: StockItem, StockRequest, StockOrder, UserPermission models. ~55 stock items seeded across 14 categories with JSON variable configs. Full CribTab component (search, category grid, smart variable forms, Send Order modal). Send Order: groups electrical vs consumables, emails per group, archives to Document Vault. Midnight cron resets stale PENDING requests. Settings: Stock List card, Supplier reset (10 new suppliers with rep/account fields). Admin users: OrderingPermissionToggle per TEAMMATE/FOREMAN.

### Phase 9B — The Crib Enhancements (Round 1)
Wire/cable smart ordering rules by gauge (THHN footage vs reel, MC roll sizes by AWG). **Inline expand UX**: every item in every category expands accordion-style directly below the tapped card — no page jumping. Delivery method removed from per-item forms, moved to Send Order modal. Order email redesigned as branded PDF attachment (`StockOrderPdf`). `StockApprovalRequest` model added. Teammate approval flow: unauthorized submit → PENDING_APPROVAL → Foreman/Admin review → approve sends, reject notifies. THHN multi-conductor mode: toggle, conductor count + colors, generates N StockRequests with shared `conductorGroupId`, displayed as collapsible group. Custom item form upgraded: SKU, UOM, supplier, consumable toggle, Save to Master List. ~50 new stock items: Low Voltage (new category), Strut & Hangers (new category), conduit bodies/straps, junction/pull boxes, USB/EV/range outlets, grounding wire/lugs, safety gear. New API routes: pending-approval GET, approve POST, reject POST.

### Phase 9B Follow-up Fixes
Category-level custom adders at bottom of every category. PVC Conduit Fittings (7 items), Rigid / IMC Fittings (6 items), Flex Conduit Fittings (2 items), Liquid Tight Fittings (3 items) — 4 new categories seeded. Send Order modal redesigned as 2-step flow (Step 1: delivery selection required; Step 2: supplier/PO/send). Consumables always route to pickup regardless of delivery selection. `isConsumableOverride` field on StockRequest for custom consumable items — routing fix (was incorrectly filtering by `stockItemId === null`). Consumables now get branded "PICKUP LIST" PDF. Document names use `YYYY-MM-DD — Supplier — Stock Order` format. Word doc (.docx) auto-saved to Document Vault alongside PDF (not emailed). Detailed console logging in stock-orders route for email diagnostics. Fallback email to Justin if no supplier email set.

### Phase 10 — Billing Reminder Cron + Summary Tab Overhaul
`/api/cron/billing-reminder` — fires daily at 9:00 UTC, exits silently outside days 15–23. Billing reminder to Justin + Beth (CC Sam). Shows all active jobs with outstanding balances sorted by balance remaining descending. Four summary stat tiles. "Not yet invoiced" flagged in red.

Summary tab Direct Costs card rebuilt: **inline markup % per cost category** (Labor, Materials, Subs, Equipment, each Other Cost item). Separate "Markups" card removed. Schema: added `materialMarkupPct Float?` and `otherMarkupPct Float?` to Job. `otherCosts` JSON extended from `{id, description, amount}` to `{id, description, amount, markupPct?}` for per-item markup. `updateDirectCostsWithMarkups()` saves all costs + markups in one round-trip.

**Deposit Request card** added to Summary tab (Admin only). Generates branded "DEPOSIT REQUEST" PDF via `POST /api/jobs/[id]/deposit-request`. Supports fixed amount or % of contract value, due date, description, notes. Includes "Email to GC" mailto link.

**BOM Pricing save fix** — `updatedBy: session.user.id ?? null` prevents TypeScript error on optional string field. Error feedback added to the BOM pricing UI in settings.

### Phase 11 — Employee Wage Tracking + Job Profitability
New schema models: `EmployeeWage` (per-user wages, burden, title/year, field crew flag, wage history) and `CompanyRates` singleton (default burden rate + bid rates by trade level). `User.wage` relation added.

New API routes: `GET/PUT /api/admin/users/[userId]/wage`, `GET/PUT /api/admin/company-rates`, `POST /api/admin/seed-wages` (API seeder), `scripts/seed-wages.js` (plain Node.js seeder — preferred).

**Admin Users**: expandable Wage section per user. Inline edit: title, year, hourly wage, burden rate %, field crew checkbox, notes. Previous wage auto-appended to `wageHistory` on change.

**Admin Settings → Labor Rates card**: default burden rate + bid rates table by trade level. Both editable inline. Reads/writes `CompanyRates` singleton.

**Summary tab → Profitability card** (Admin/Office only, collapsible): gross profit/loss, margin %, actual cost breakdown (burdened labor + materials + subs + equipment + other), labor budget variance, bid rate vs actual labor comparison, per-employee hours + burdened cost detail.

Crew wages seeded: Tyler ($16/hr), Michael ($17/hr), Caleb ($35/hr), Steven ($41/hr). All at 35% burden. Sam/Beth/Justin marked overhead. Bid rates: Apprentice $45–$56, Journeyman $65–$72, Master Electrician $85, Foreman $90, General Foreman $95.
