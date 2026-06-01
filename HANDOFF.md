# Oak Ridge PM — Session Handoff Document

**Last updated:** 2026-06-01
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
JobType               BID | TIME_AND_MATERIALS | ESTIMATE | SYSTEM
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

**User** — NextAuth users. `id, name, email, emailVerified, image, role (default TEAMMATE), active (default false)`. New Google sign-ins get `active=false` until admin activates. Relations include: `foremanJobs`, `stockRequests`, `stockOrders`, `userPermissions`, `grantedPermissions`, `googleConnections`, `approvalRequests` (StockApprovalRequest requester), `reviewedApprovals` (StockApprovalRequest reviewer), `wage (EmployeeWage?)`, `receipts`, `ownerDraws`, `contractorPayments`, `payrollRecords`.

**Job** — Core entity. Key fields: `jobNumber (unique), jobName, address/city/state/zip, gcCompany/gcContactName/gcPhone/gcEmail, ownerName/ownerPhone/ownerEmail, foremanId (→ User), createdById (→ User), scopeOfWork, contractStartDate, completionDate, permitNumber, status (JobStatus), jobType (JobType, default BID), contractValue, laborBudgetHours, materialBudget, blendedLaborRate, subcontractorCost, equipmentCost, equipmentBillPct, otherCosts (Json — array of {id, description, amount, markupPct?}), laborMarkupPct, subMarkupPct, equipmentMarkupPct, materialMarkupPct, otherMarkupPct, archived, calendarColor, isSystemJob (Boolean default false), excludeFromPL (Boolean default false)`. Relations include all tabs plus: `stockRequests`, `stockOrders`, `userPermissions`, `stockApprovalRequests`, `receipts`.

**System Jobs** — Two special jobs are auto-created per year: `YY-000` (Office & Shop expenses) and `YY-999` (Shop Expenses / overhead bucket). `isSystemJob = true` on these records. They appear in a separate "System Jobs" section on the dashboard (reduced opacity). They're used to attach overhead receipts, material purchases, and shop expenses without polluting the P&L job list. Excluded from all P&L calculations. Year-end close route creates next year's jobs: `POST /api/admin/system-jobs/year-end-close`.

`excludeFromPL` — boolean on all jobs. When true, the job's labor, materials, and payments are excluded from the dashboard P&L summary widget and the /admin/pl calculations. Used to filter out training jobs, internal projects, and test jobs.

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

**Vehicle** — Company truck/van inventory. `id, tag (vehicle identifier e.g. "Truck 1"), year, make, model, plate, primaryDriver, notes, isActive (default true)`. Receipts can be linked to a vehicle. Managed via Admin → Vehicles API (`GET/POST/PUT/DELETE /api/admin/vehicles`, `GET/POST /api/admin/vehicles/[id]/costs`).

**Receipt** — Photo receipts uploaded from the field or office. `id, jobId (optional → Job), vehicleId (optional → Vehicle), uploadedById (→ User), type (default "job"), category, vendor, amount, receiptDate, description, imageUrl, fileUrl, notes, isFuel (Boolean), mileage, reviewedBy, reviewStatus, flagReason`. Receipts tab is on the job detail page (all roles can upload). Admin receipts page shows all receipts with filters by job/user/vehicle/status, move-to-job, split, and approve/flag actions. APIs: `GET/POST /api/receipts`, `GET/PUT/DELETE /api/receipts/[id]`, `POST /api/receipts/[id]/move`, `POST /api/receipts/split`, `GET /api/jobs/[id]/receipts`, `POST /api/admin/receipts/remind`.

**PayrollRecord** — Imported Gusto payroll data. `id, userId (→ User), payPeriodStart, payPeriodEnd, regularHours, otHours, grossPay`. Populated via `POST /api/admin/payroll/import` (CSV upload) and confirmed via `POST /api/admin/payroll/confirm`. Gusto CSV headers are auto-detected. Used to reconcile actual payroll vs. burdened labor cost estimates.

**OverheadCost** — Company overhead expenses (rent, insurance, utilities, etc.). `id, category, description, amount, effectiveDate, endDate, isRecurring (Boolean), recurringDay (Int), recurringFreq (String), autoIncrease (Boolean), increaseRate, increaseMonth`. One-time costs have `isRecurring=false` and a specific `effectiveDate`. Recurring costs have `isRecurring=true` and `recurringFreq`. Managed at Admin → Overhead. APIs: `GET/POST /api/admin/overhead`, `PUT/DELETE /api/admin/overhead/[id]`, `GET /api/admin/overhead/summary` (returns monthly totals + per-category breakdown).

**OwnerDraw** — Owner ATM withdrawals, personal payments, draws. `id, userId (→ User), amount, drawDate, method (default "ATM"), notes, receiptUrl`. ADMIN only. Managed at `/admin/owner-draws`. APIs: `GET/POST /api/admin/owner-draws`, `PUT/DELETE /api/admin/owner-draws/[id]`. Used in P&L distributions section.

**ContractorPayment** — Payments to overseas/international contractors (e.g. Belize crew). `id, userId (→ User), amountUSD, amountLocal, localCurrency, exchangeRate, paymentDate, payPeriodStart, payPeriodEnd, method (default "Wire"), notes, receiptUrl`. Exchange rate captured at time of payment. Managed at `/admin/contractor-payments`. APIs: `GET/POST /api/admin/contractor-payments`, `PUT/DELETE /api/admin/contractor-payments/[id]`. Used in P&L distributions section.

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

Info → Labor → Purchase Orders → The Crib → Receipts → Photos → Notes & Tasks → Calendar → Inspections → RFI → Documents → Summary

**"Purchase Orders" tab** = the renamed Materials/Invoices tab (was "Materials" through Phase 8, "Invoices" through Phase 9). DB model and server actions still use the name `materials` — only the UI label changed.

**"The Crib" tab** = stock ordering system (Phase 9+). Added after Purchase Orders.

**"Receipts" tab** = photo receipt upload (Phase 12A+). Added after The Crib. All roles can upload receipts from mobile. Links receipts to the job.

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

## P&L Dashboard (`/admin/pl`)

**Route:** `app/(app)/admin/pl/page.tsx` + `pl-client.tsx`
**Access:** ADMIN and OFFICE only.

The P&L dashboard shows a full profit-and-loss view for a selectable period (current month by default). Period selector supports month, quarter, and year views. Data is server-rendered on the page component and re-fetched on period change via `GET /api/admin/pl?period=month&month=6&year=2026`.

### P&L sections

**Revenue** — Total invoiced (non-DRAFT invoices in period), total collected (payments in period), outstanding balance.

**Direct Costs** — Burdened labor cost (from LaborEntry × hourlyWage × (1 + burdenRate)), materials (from Material.amount), subcontractors (from Job.subcontractorCost), equipment, other costs. Excludes `isSystemJob` and `excludeFromPL` jobs.

**Gross Profit** — Revenue − Direct Costs. Shows margin %.

**Overhead** — Sum of OverheadCosts active in the period (one-time + recurring), grouped by category.

**Distributions** — Owner draws + contractor payments for the period, grouped by person. Shows type (draw vs contractor).

**Net Profit** — Gross Profit − Overhead − Distributions. Shows net margin %.

### Overhead allocation per job

On the job detail page, the Summary tab's Profitability card shows an **overhead allocation** line. This is: `(total one-time OverheadCosts for current month) / (count of active non-system jobs)`. Computed in `app/(app)/jobs/[id]/page.tsx` and passed as `overheadAllocation` prop to `SummaryTab`.

### Dashboard P&L summary widget

`PlSummaryWidget` (in `app/(app)/pl-summary-widget.tsx`) — server component rendered above the jobs list on the dashboard for ADMIN/OFFICE users. Shows month-to-date: revenue collected, burdened labor cost, materials spend. Excludes `isSystemJob` and `excludeFromPL` jobs.

### Shop Expense Button

`ShopExpenseButton` — floating button on the dashboard for ADMIN users. Opens a quick-entry form to log an overhead cost directly to `OverheadCost` without navigating to Admin → Overhead. Pre-fills today's date and common overhead categories.

### Quarterly Tax Package PDF

`POST /api/admin/pl/tax-package` — generates a PDF tax summary for a quarter. Request body: `{ quarter: 1-4, year: 2026, notes: "..." }`. PDF includes:
- Revenue (invoiced, collected, outstanding) for the quarter
- Direct costs breakdown
- Overhead costs by category
- Owner draws and contractor payments
- Net income
- Notes section for CPA

PDF is returned as binary for download. Uses `TaxPackagePDF` React component in `app/api/admin/pl/tax-package/_template.tsx`.

### Generate Overhead Cron

`/api/cron/generate-overhead` — creates recurring overhead records on the 1st of each month (or configured recurringDay). Frequency options: monthly, quarterly, annually. Auto-increase applies the increaseRate each year on increaseMonth. Added to `vercel.json` schedule.

---

## Overhead Page (`/admin/overhead`)

**Route:** `app/(app)/admin/overhead/page.tsx` + `overhead-client.tsx`
**Access:** ADMIN and OFFICE only.

CRUD for OverheadCost records. Forms support:
- One-time expense: category, description, amount, effective date
- Recurring expense: same fields + recurring day, frequency (monthly/quarterly/annually), auto-increase toggle (rate % + month)

Month/year selector at top shows total overhead for that period. "Summary" view breaks down by category.

---

## Owner Draws Page (`/admin/owner-draws`)

**Route:** `app/(app)/admin/owner-draws/page.tsx` + `owner-draws-client.tsx`
**Access:** ADMIN only.

Log and view owner draws by year. Form: owner (from ADMIN users list), amount, date, method (ATM/Check/Transfer/Other), notes, receipt URL. All draws appear in the P&L distributions section.

---

## Contractor Payments Page (`/admin/contractor-payments`)

**Route:** `app/(app)/admin/contractor-payments/page.tsx` + `contractor-payments-client.tsx`
**Access:** ADMIN only.

Log payments to contractors (international/1099 workers). Form: employee, amount USD, local currency amount, currency code (BZD/CAD/MXN/etc.), exchange rate, payment date, pay period start/end, method (Wire/Check/Cash/Other), notes, receipt URL. Exchange rate is captured at payment time for accurate USD reporting. All contractor payments appear in the P&L distributions section.

---

## Admin Navigation

Admin pages use `AdminNav` component (`app/(app)/admin/admin-nav.tsx`) which renders a tab bar with **Users** and **Saved Tasks**. Other admin financial pages (Overhead, Owner Draws, Contractor Payments, P&L, Receipts) are reachable from the main admin section header or by direct URL — they are linked from the P&L dashboard and from the dashboard quick-access buttons.

Admin page structure:
```
/admin          → redirects to /admin/users
/admin/users           AdminNav shown — user management + wage section
/admin/saved-tasks     AdminNav shown — saved task library
/admin/settings        Settings (no AdminNav — full-page sections)
/admin/overhead        Overhead costs (ADMIN/OFFICE)
/admin/owner-draws     Owner draws (ADMIN only)
/admin/contractor-payments  Contractor payments (ADMIN only)
/admin/pl              P&L dashboard (ADMIN/OFFICE)
/admin/receipts        Receipt manager (ADMIN/OFFICE)
```

---

## Cron Jobs

All cron routes require `Authorization: Bearer <CRON_SECRET>` header (auto-set by Vercel). Add to `publicPaths` in `proxy.ts` to bypass auth middleware.

### `vercel.json` schedule

```json
{
  "crons": [
    { "path": "/api/cron/daily-report",       "schedule": "0 9 * * *"  },
    { "path": "/api/cron/billing-reminder",   "schedule": "0 9 * * *"  },
    { "path": "/api/cron/reset-stock-orders", "schedule": "0 5 * * *"  },
    { "path": "/api/cron/generate-overhead",  "schedule": "0 11 1 * *" }
  ]
}
```

All times are UTC. `0 9 * * *` = 4:00 AM EST / 5:00 AM EDT. `0 11 1 * *` = 7:00 AM EDT on the 1st of each month.

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

### `/api/cron/generate-overhead`

Fires on the 1st of each month at 11:00 AM UTC (7:00 AM EDT). Creates OverheadCost records for any recurring costs due this month (monthly frequency), this quarter (quarterly frequency), or this month if it matches the annual increaseMonth (yearly). Applies `increaseRate` compounded from the base amount if `autoIncrease` is set. Requires `CRON_SECRET` bearer auth.

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
│   │   │   ├── overhead/
│   │   │   │   ├── page.tsx         # Overhead costs (ADMIN/OFFICE)
│   │   │   │   └── overhead-client.tsx  # CRUD for one-time + recurring overhead costs
│   │   │   ├── owner-draws/
│   │   │   │   ├── page.tsx         # Owner draws log (ADMIN only)
│   │   │   │   └── owner-draws-client.tsx
│   │   │   ├── contractor-payments/
│   │   │   │   ├── page.tsx         # Contractor payments (ADMIN only)
│   │   │   │   └── contractor-payments-client.tsx  # USD + local currency, exchange rate
│   │   │   ├── pl/
│   │   │   │   ├── page.tsx         # P&L dashboard (ADMIN/OFFICE) — revenue, direct costs,
│   │   │   │   │                    # gross profit, overhead, distributions, net profit
│   │   │   │   └── pl-client.tsx    # Period selector (month/quarter/year), chart-style display
│   │   │   ├── receipts/
│   │   │   │   ├── page.tsx         # All-receipts manager (ADMIN/OFFICE)
│   │   │   │   └── receipt-manager-client.tsx  # Filter by job/user/vehicle, move, split, flag
│   │   │   └── settings/
│   │   │       ├── page.tsx         # Settings server component (fetches GoogleConnection, CompanySettings)
│   │   │       └── settings-client.tsx  # All settings cards including Labor Rates + BOM Pricing
│   │   ├── pl-summary-widget.tsx    # Dashboard MTD stats widget (ADMIN/OFFICE only)
│   │   ├── shop-expense-button.tsx  # Quick overhead entry button on dashboard (ADMIN only)
│   │   └── jobs/[id]/
│   │       ├── page.tsx             # Job detail — fetches laborEntries with user.wage included,
│   │       │                        # fetches CompanyRates singleton, computes overheadAllocation
│   │       │                        # (monthly overhead / active job count), passes both to JobTabs
│   │       ├── job-tabs.tsx         # Tab bar + routing. Accepts companyRates + overheadAllocation props.
│   │       │                        # Tab order: Info→Labor→Purchase Orders→Crib→Receipts→
│   │       │                        # Photos→Notes&Tasks→Calendar→Inspections→RFI→Documents→Summary
│   │       └── tabs/
│   │           ├── job-info-tab.tsx
│   │           ├── labor-tab.tsx              # Duplicate failsafe modal
│   │           ├── labor-tab-actions.ts       # addLaborEntries(mode: check|add|replace)
│   │           ├── materials-tab.tsx          # UI label "Purchase Orders"; auto-archives to Document Vault
│   │           ├── materials-tab-actions.ts   # addMaterial — archives beyond 5 with fileUrls
│   │           ├── crib-tab.tsx               # The Crib — full stock ordering UI (~1200 lines)
│   │           │                              # ThhnWireForm, McRomexWireForm, ItemExpandForm,
│   │           │                              # CustomItemForm, CategoryCustomAdder,
│   │           │                              # ConductorGroupCard, SendOrderModal (2-step)
│   │           ├── receipts-tab.tsx           # Photo receipt upload for field crew. Calls
│   │           │                              # GET/POST /api/jobs/[id]/receipts. Shows thumbnails,
│   │           │                              # vendor, amount, date. Vehicle link for fuel receipts.
│   │           ├── summary-tab.tsx            # Financial view. DirectCostsCard (inline markup per row).
│   │           │                              # ProfitabilityCard (Admin/Office, collapsible) includes
│   │           │                              # overhead allocation line.
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
│       │   ├── overhead/
│       │   │   ├── route.ts                   # GET all / POST new OverheadCost
│       │   │   ├── [id]/route.ts              # PUT / DELETE overhead cost
│       │   │   └── summary/route.ts           # GET monthly overhead totals + per-category breakdown
│       │   ├── owner-draws/
│       │   │   ├── route.ts                   # GET / POST owner draws
│       │   │   └── [id]/route.ts              # PUT / DELETE
│       │   ├── contractor-payments/
│       │   │   ├── route.ts                   # GET / POST contractor payments
│       │   │   └── [id]/route.ts              # PUT / DELETE
│       │   ├── payroll/
│       │   │   ├── import/route.ts            # POST — parse Gusto CSV, return preview rows
│       │   │   └── confirm/route.ts           # POST — confirmed rows → PayrollRecords
│       │   ├── pl/
│       │   │   ├── route.ts                   # GET P&L data (period=month|quarter|year params)
│       │   │   ├── dashboard-summary/route.ts # GET MTD stats for PlSummaryWidget
│       │   │   ├── jobs/route.ts              # GET per-job P&L breakdown
│       │   │   ├── overhead-allocation/route.ts # GET overhead per active job for current month
│       │   │   └── tax-package/route.ts       # POST → quarterly tax package PDF
│       │   ├── receipts/
│       │   │   └── remind/route.ts            # POST — missing receipt reminder emails
│       │   ├── system-jobs/
│       │   │   ├── route.ts                   # GET active system jobs
│       │   │   └── year-end-close/route.ts    # POST — creates next-year YY-000 and YY-999 jobs
│       │   ├── vehicles/
│       │   │   ├── route.ts                   # GET all / POST new vehicle
│       │   │   └── [id]/
│       │   │       ├── route.ts               # PUT / DELETE vehicle
│       │   │       └── costs/route.ts         # GET / POST vehicle cost entries
│       │   └── users/
│       │       └── [userId]/
│       │           ├── permissions/route.ts          # GET/POST/DELETE ordering permissions
│       │           ├── estimating-permission/route.ts # GET/POST/DELETE estimating permission
│       │           └── wage/route.ts                 # GET/PUT employee wage record
│       ├── receipts/
│       │   ├── route.ts                       # GET all receipts / POST new receipt
│       │   ├── split/route.ts                 # POST — split receipt across multiple jobs
│       │   └── [id]/
│       │       ├── route.ts                   # GET / PUT / DELETE receipt
│       │       └── move/route.ts              # POST — reassign receipt to different job
│       ├── cron/
│       │   ├── daily-report/route.ts          # Admin + foreman daily emails
│       │   ├── billing-reminder/route.ts      # Monthly billing reminder (15th-23rd only)
│       │   ├── reset-stock-orders/route.ts    # Midnight PENDING → CANCELLED
│       │   └── generate-overhead/route.ts     # 1st of month — create recurring overhead records
│       └── jobs/[id]/
│           ├── deposit-request/route.ts       # POST — generates branded Deposit Request PDF
│           ├── receipts/route.ts              # GET receipts for this job / POST new receipt
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

### Phase 12A — System Jobs, Receipts, Vehicles, Payroll Import

**System Jobs** — `JobType.SYSTEM` enum value added. Two system jobs auto-exist per calendar year: `YY-000` (Office & Shop expenses) and `YY-999` (Shop expenses overflow). `isSystemJob Boolean @default(false)` and `excludeFromPL Boolean @default(false)` added to Job model. System jobs displayed in their own section on the dashboard (reduced opacity). Year-end close route (`POST /api/admin/system-jobs/year-end-close`) creates the next year's pair. `ShopExpenseButton` on dashboard for quick overhead entry (ADMIN only). Jobs with `excludeFromPL=true` are excluded from P&L calculations — used for training/internal jobs.

**Receipts system** — New `Receipt` model. `ReceiptsTab` added to job detail page (all roles can upload). Admin receipts page at `/admin/receipts` for office review: filter by job/user/vehicle/status, move receipt to different job, split across multiple jobs, approve/flag. APIs: `GET/POST /api/receipts`, `GET/PUT/DELETE /api/receipts/[id]`, `POST /api/receipts/[id]/move`, `POST /api/receipts/split`, `GET/POST /api/jobs/[id]/receipts`, `POST /api/admin/receipts/remind`.

**Vehicles** — New `Vehicle` model: tag, year, make, model, plate, primaryDriver, isActive. Receipts can be linked to vehicles (e.g. fuel receipts). Admin CRUD via `/api/admin/vehicles` and `/api/admin/vehicles/[id]`. Vehicle cost logging via `/api/admin/vehicles/[id]/costs`.

**Gusto payroll import** — New `PayrollRecord` model. Two-step flow: `POST /api/admin/payroll/import` parses a Gusto CSV export (handles quoted fields, auto-detects headers) and returns preview rows. `POST /api/admin/payroll/confirm` saves confirmed rows as PayrollRecords. Used to reconcile actual payroll spend against burdened labor cost estimates. Located in Admin settings (accessible from Admin nav area).

### Phase 12B — Overhead Costs, Recurring Expenses, Vehicle Costs

**OverheadCost model** — `category, description, amount, effectiveDate, endDate, isRecurring, recurringDay, recurringFreq (monthly/quarterly/annually), autoIncrease, increaseRate, increaseMonth`. One-time costs use `effectiveDate` + `isRecurring=false`. Recurring costs have `recurringFreq` and optional annual auto-increase (e.g. rent going up 3% each January).

**Admin Overhead page** (`/admin/overhead`) — CRUD for overhead costs. Month/year period selector shows total for that month. Summary view groups by category. Client component (`overhead-client.tsx`) handles inline add/edit forms.

**Overhead API** — `GET/POST /api/admin/overhead`, `PUT/DELETE /api/admin/overhead/[id]`, `GET /api/admin/overhead/summary` (returns monthly totals + per-category breakdown with period params).

**Generate-overhead cron** — `POST /api/cron/generate-overhead` fires 1st of each month. Creates OverheadCost records for due recurring costs. Applies compound auto-increase when applicable. Added to `vercel.json`.

**Vehicle cost logging** — `GET/POST /api/admin/vehicles/[id]/costs` tracks per-vehicle expense entries (fuel, maintenance, registration, etc.).

### Phase 12C — Owner Draws, Contractor Payments, Exchange Rate Tracking

**OwnerDraw model** — Tracks owner ATM withdrawals, check payments, personal draws. `userId, amount, drawDate, method (ATM/Check/Transfer/Other), notes, receiptUrl`. ADMIN only. Admin page at `/admin/owner-draws`. Filter by year. APIs: `GET/POST /api/admin/owner-draws`, `PUT/DELETE /api/admin/owner-draws/[id]`.

**ContractorPayment model** — Tracks payments to international/1099 contractors. `userId, amountUSD, amountLocal, localCurrency, exchangeRate, paymentDate, payPeriodStart, payPeriodEnd, method (Wire/Check/Cash/Other), notes, receiptUrl`. Exchange rate captured at time of payment for accurate USD reporting. Admin page at `/admin/contractor-payments`. Filter by year. APIs: `GET/POST /api/admin/contractor-payments`, `PUT/DELETE /api/admin/contractor-payments/[id]`.

Both owner draws and contractor payments feed into the **Distributions** section of the P&L dashboard. Exchange rate field supports international workers being paid in local currency (e.g. BZD for Belize).

### Phase 12D — P&L Dashboard, Overhead Allocation, Quarterly Tax Package

**P&L Dashboard** (`/admin/pl`) — Full profit-and-loss view with period selector (month/quarter/year). Sections: Revenue (invoiced, collected, outstanding), Direct Costs (burdened labor + materials + subs + equipment + other), Gross Profit with margin %, Overhead (by category), Distributions (owner draws + contractor payments), Net Profit with margin %. All calculations exclude `isSystemJob` and `excludeFromPL` jobs. Server-rendered page re-fetches data on period change via `GET /api/admin/pl`.

**Dashboard P&L widget** — `PlSummaryWidget` server component above the jobs list. Shows month-to-date: revenue collected, burdened labor cost, materials spend. Visible to ADMIN and OFFICE.

**Overhead allocation per job** — `Summary tab → Profitability card` now includes an overhead allocation line: `(total one-time overhead costs for current month) ÷ (count of active non-system jobs)`. Computed in `jobs/[id]/page.tsx` via two parallel queries and passed as `overheadAllocation` prop.

**Quarterly tax package PDF** — `POST /api/admin/pl/tax-package` generates a branded PDF with Q1/Q2/Q3/Q4 financials: revenue, costs, overhead, draws, net income, notes section. Accepts `{quarter, year, notes}` in request body. React PDF component in `app/api/admin/pl/tax-package/_template.tsx`.

**`excludeFromPL` toggle** — Added to job detail Info tab (ADMIN/OFFICE only). Filters jobs from all P&L widgets and calculations when training, internal, or test jobs should not affect the books. Commit e5b974d.

### Phase 13 — REVERTED (GPS, Push Notifications, Field Crew, Schedule)

**What was attempted:** GPS check-in/check-out for field crew, VAPID web push notifications, a "Command Center" admin page, daily photo system for field crew, and a schedule management section.

**Why it was reverted:** The deployment broke the existing app in multiple ways:
1. `PushSetup` component was added to the app layout and ran on every page load — it called `/api/push/vapid-public-key` but VAPID keys were never added to Vercel env, causing errors on every page
2. A field crew redirect (`if role is not ADMIN/OFFICE, redirect to /field`) prevented FOREMANs and TEAMMATEs from seeing their jobs
3. The generated Prisma client was regenerated from the Phase 13 schema, making the Phase 12 source code type-incompatible
4. Multiple new routes and components were broken or incomplete

**How it was fixed:**
1. The local repo had no git remote configured — added: `git remote add origin https://github.com/oakridge1/oak-ridge-pm.git`
2. Fetched the real GitHub history: `git fetch origin`
3. Hard-reset to last working commit: `git reset --hard e5b974d`
4. Regenerated Prisma client from the e5b974d schema (the gitignored `app/generated/prisma/` was stale): `npx prisma generate`
5. Fixed 4 API route files with wrong Prisma 7 include key casing (documents: `User`→`uploadedBy`, inspections: `User`→`createdBy`, rfis: `User`→`submittedBy`, crib: `StockItem`/`User`→`stockItem`/`user`/`sentBy`)
6. Installed missing packages (`npm install`), committed fixes, force-pushed to GitHub, redeployed to Vercel

**Important lesson:** The `app/generated/prisma/` directory is in `.gitignore`. After any `git reset --hard`, always run `npx prisma generate` to regenerate the client from the current schema — the reset does NOT restore the generated files.

**Phase 13 features are deferred.** GPS, push notifications, command center, daily photos, and schedule management may be revisited after Belize trip. Do NOT re-introduce them without a dedicated branch and thorough testing before merging.

---

## Current State & Pending Work

**As of 2026-06-01** — App is live at https://oak-ridge-pm.vercel.app at commit `3bf65ff` (e5b974d + route fixes). Build is clean, TypeScript passes.

### What's working

- All Phase 1–12D features are live and functional
- Jobs dashboard, all job tabs (Info, Labor, Purchase Orders, The Crib, Receipts, Photos, Notes & Tasks, Calendar, Inspections, RFI, Documents, Summary)
- Estimating tool (`/estimating`) — list + detail with assemblies tab, BOM takeoff, bid calculation
- Admin section: Users (with wages), Saved Tasks, Settings, Overhead, Owner Draws, Contractor Payments, P&L Dashboard, Receipts
- PDFs: invoices, AIA G703, job report, summary, change orders, inspections, RFIs, stock orders, deposit requests, tax package
- Email: daily report cron, billing reminder, stock orders (SAM_CC locked)
- Google integration: Calendar sync, AIA → Sheets

### Pending work

#### 1. Takeoff tool — symbol set update (HIGH PRIORITY)

The estimating tool has a takeoff/counter feature at `/estimating/[id]/counter` (counter areas tab in estimate detail). The **takeoff symbols** (icons representing different electrical items on the plan) need to be updated to reflect the current BOM item set.

The original HTML-based estimator (`OakRidge_Estimator_33.html`) had a symbol set that was ported to the app. The current symbols in the app's counter tool may not match the BOM categories or may be missing new items added since the port.

**What needs to happen:**
- Review the current symbol set in `app/(app)/estimating/[id]/tabs/assemblies-tab.tsx` and the counter area components
- Cross-reference against `lib/bom.ts` to ensure every BOM category has appropriate symbols
- Update or add symbols as needed to match the current BOM item list

#### 2. Estimating tool — restore HTML logic from OakRidge_Estimator_33.html (HIGH PRIORITY)

The estimating tool (`/estimating/[id]/estimate-client.tsx`) was ported from a standalone HTML estimator file (`OakRidge_Estimator_33.html`). The HTML version may have bid calculation logic, assembly definitions, or panel-board/permit/sub features that weren't fully ported.

**What needs to happen:**
- Justin to provide the `OakRidge_Estimator_33.html` file (not currently in the repo)
- Review the HTML estimator's full feature set against the current `estimate-client.tsx`
- Port any missing logic: bid formula edge cases, assembly types, panel schedules, permit fee calculations, sub quote handling
- The `lib/estimating.ts` and `lib/bom.ts` files contain the core calculation engine — changes should go there first, then surface in the UI

**Key files for the estimating tool:**
```
lib/bom.ts                                          # BOM item catalog + NECA labor hours
lib/estimating.ts                                   # calcBid(), calcLine(), assembly calculators
app/(app)/estimating/
  page.tsx + estimating-client.tsx                  # Estimates list
  [id]/
    page.tsx + estimate-client.tsx                  # Main estimate editor (tabs: takeoff, assemblies,
    │                                               # panels, permits, subs, financials, settings)
    tabs/assemblies-tab.tsx                         # Assembly calculator tab
app/api/estimates/
  route.ts                                          # GET all / POST new estimate
  [id]/route.ts                                     # GET / PUT / DELETE estimate
  [id]/counter-areas/route.ts                       # GET / POST counter areas
  [id]/counter-areas/[areaId]/route.ts              # PUT / DELETE counter area
  [id]/counter-areas/sync/route.ts                  # POST — sync counter area counts to takeoff items
  [id]/export/route.ts                              # POST — export estimate to spreadsheet
  [id]/pdf/route.ts                                 # POST — generate estimate PDF
  [id]/deposit-request/route.ts                     # POST — deposit request PDF for estimate
  [id]/create-job/route.ts                          # POST — convert awarded estimate to a Job
```

#### 3. Admin nav — financial pages not in nav (MINOR)

The `AdminNav` component shows only Users and Saved Tasks tabs. The financial admin pages (Overhead, Owner Draws, Contractor Payments, P&L, Receipts) are reachable but not in the nav. Consider adding a "Financials" dropdown or a second nav row if these pages need to be more discoverable.

#### 4. Phase 13 deferred features (POST-BELIZE)

When ready to resume Phase 13:
- GPS check-in/check-out for field crew time tracking
- Web push notifications (VAPID — need to add VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to Vercel env)
- Command Center admin view (real-time crew status)
- Daily photo workflow (field crew uploads end-of-day progress photos)
- Schedule management (foreman assigns crew to jobs by day)

**Always work on a separate branch. Test the layout first before touching job tabs, admin layout, or proxy.ts.**
