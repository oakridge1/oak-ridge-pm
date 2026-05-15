-- ============================================================
-- Row Level Security — Oak Ridge PM
-- ============================================================
-- All database access goes through Next.js server routes using
-- the Supabase SERVICE ROLE key via Prisma.  The service role
-- bypasses RLS automatically in Supabase, so enabling RLS on
-- every table (with zero permissive policies) achieves the
-- correct result:
--
--   anon key  → blocked completely (no matching policy)
--   service role key (Prisma) → full access (RLS bypassed)
--
-- Run this entire file in the Supabase SQL Editor once.
-- ============================================================

-- ── NextAuth tables ──────────────────────────────────────────
ALTER TABLE "User"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Account"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VerificationToken" ENABLE ROW LEVEL SECURITY;

-- ── Core app tables ──────────────────────────────────────────
ALTER TABLE "Job"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LaborEntry"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Material"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Photo"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Note"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChangeOrder"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChangeOrderPhoto"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SavedTask"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Task"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaskEvent"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CalendarEvent"     ENABLE ROW LEVEL SECURITY;

-- ── Phase 5 tables ───────────────────────────────────────────
ALTER TABLE "Inspection"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Rfi"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Document"          ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- No permissive SELECT/INSERT/UPDATE/DELETE policies are added.
-- Having RLS enabled with zero matching policies means:
--   • anon role  → denied (no policy grants access)
--   • service_role → bypasses RLS entirely (Supabase default)
--
-- Verify in Supabase: Table Editor → any table →
-- "RLS enabled" badge should appear.  Advisor warnings will
-- clear once RLS is enabled on all tables.
-- ============================================================
