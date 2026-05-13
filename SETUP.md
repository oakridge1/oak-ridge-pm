# Oak Ridge Electrical PM — Setup Guide

## Tech Stack
- **Next.js 16** (App Router, TypeScript)
- **Prisma 7** + **PostgreSQL** (Supabase recommended)
- **NextAuth v5** (Google OAuth only)
- **Tailwind CSS** + **Lucide React**
- **UploadThing** (Phase 2 — file uploads)
- Deploy to **Vercel** (free tier works)

---

## Step 1: Database — Supabase (free)

1. Go to [supabase.com](https://supabase.com) → New project
2. Project Settings → Database → **URI** connection string
3. Copy it into `.env` as `DATABASE_URL`

---

## Step 2: Google OAuth

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project → APIs & Services → Credentials → OAuth 2.0 Client ID
3. Application type: **Web application**
4. Authorized redirect URIs:
   - Local: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://your-vercel-url.vercel.app/api/auth/callback/google`
5. Copy Client ID and Client Secret into `.env`

---

## Step 3: Generate auth secret

```bash
openssl rand -base64 32
```

Paste the output into `.env` as `AUTH_SECRET`.

---

## Step 4: Run database migrations

```bash
npx prisma migrate dev --name init
```

---

## Step 5: Seed your admin account

After running migrations, sign in once with your Google account. Then run:

```bash
npx prisma studio
```

Find your user record, set `active = true` and `role = ADMIN`. Your wife's account: same process after she signs in.

---

## Step 6: Local development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Step 7: Deploy to Vercel

1. Push the project to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → Import → select your repo
3. Add environment variables in Vercel dashboard (same as `.env`):
   - `DATABASE_URL`
   - `AUTH_SECRET`
   - `AUTH_GOOGLE_ID`
   - `AUTH_GOOGLE_SECRET`
   - `NEXTAUTH_URL` = your Vercel production URL
4. Deploy

After deploy, update your Google OAuth Authorized redirect URI to include the Vercel URL.

---

## Project Structure

```
oak-ridge-pm/
├── app/
│   ├── (app)/              # Authenticated routes (layout wraps all with header)
│   │   ├── layout.tsx      # App shell: auth check + header
│   │   ├── page.tsx        # Dashboard (job list)
│   │   ├── admin/          # Admin user management
│   │   └── jobs/[id]/      # Job detail view + tabs
│   │       └── tabs/       # Each tab is its own component
│   ├── api/auth/           # NextAuth route handler
│   ├── generated/prisma/   # Auto-generated Prisma client (gitignored)
│   ├── login/              # Login page
│   └── pending/            # Awaiting activation page
├── auth.ts                 # NextAuth config (Google provider + Prisma adapter)
├── middleware.ts            # Route protection by role
├── lib/
│   ├── prisma.ts           # Prisma client singleton (pg adapter)
│   └── utils.ts            # cn() helper
├── components/
│   └── header.tsx          # Top nav (logo + user + admin link)
├── prisma/
│   └── schema.prisma       # Database schema
└── types/
    └── next-auth.d.ts      # Session type augmentation (adds role, active)
```

---

## Adding Phase 2 Tabs

Each tab lives in `app/(app)/jobs/[id]/tabs/`. To add Tab 2 (Labor):

1. Create `app/(app)/jobs/[id]/tabs/labor-tab.tsx`
2. Import and swap the `<PlaceholderTab>` in `job-tabs.tsx` for `<LaborTab>`
3. Add any server actions to `app/(app)/jobs/[id]/actions.ts`

No layout changes needed.

---

## Access Roles

| Feature | Admin | Office | Field |
|---------|-------|--------|-------|
| All tabs | ✓ | ✓ | Job Info, Labor, Materials, Photos, Notes only |
| Dollar amounts | ✓ | ✓ | Hidden |
| Summary tab | ✓ | ✓ | Hidden |
| Create jobs | ✓ | ✓ | — |
| Admin panel | ✓ | — | — |
