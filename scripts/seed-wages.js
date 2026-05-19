// One-time crew wage seed script
// Run with: node scripts/seed-wages.js
//
// Uses direct PG connection (no pgbouncer) so DDL-free upserts work fine.

const { Client } = require("pg");

const CONNECTION = "postgresql://postgres.ycoyinccwljhzlzzvzrv:BaneLayla2325@aws-1-us-east-1.pooler.supabase.com:5432/postgres";

// Map of name substring → wage data
const CREW = [
  { nameMatch: "Tyler",   title: "Apprentice",         year: "1st", hourlyWage: 16, isFieldCrew: true,  notes: null },
  { nameMatch: "Michael", title: "Apprentice",         year: "1st", hourlyWage: 17, isFieldCrew: true,  notes: null },
  { nameMatch: "Caleb",   title: "Journeyman",         year: "1st", hourlyWage: 35, isFieldCrew: true,  notes: null },
  { nameMatch: "Steven",  title: "Master Electrician", year: "",    hourlyWage: 41, isFieldCrew: true,  notes: null },
  { nameMatch: "Sam",     title: "Office",             year: "",    hourlyWage: 0,  isFieldCrew: false, notes: "Overhead — not a field cost" },
  { nameMatch: "Beth",    title: "Office",             year: "",    hourlyWage: 0,  isFieldCrew: false, notes: "Unpaid" },
  { nameMatch: "Justin",  title: "Owner",              year: "",    hourlyWage: 0,  isFieldCrew: false, notes: "Owner — not included in field labor cost" },
];

const BID_RATES = {
  "Apprentice:1st": 45,
  "Apprentice:2nd": 48,
  "Apprentice:3rd": 52,
  "Apprentice:4th": 56,
  "Journeyman:1st": 65,
  "Journeyman:2nd": 68,
  "Journeyman:3rd": 72,
  "Master Electrician:": 85,
  "Foreman:": 90,
  "General Foreman:": 95,
};

async function main() {
  const client = new Client({ connectionString: CONNECTION });
  await client.connect();
  console.log("Connected to database.");

  // 1. List all users
  const { rows: users } = await client.query(
    'SELECT id, name, email FROM "User" ORDER BY name'
  );
  console.log(`\nFound ${users.length} users:`);
  users.forEach(u => console.log(`  ${u.name ?? "(unnamed)"} — ${u.email}`));

  // 2. Upsert EmployeeWage per crew member
  console.log("\nSeeding EmployeeWage records...");
  const burdenRate = 0.35;
  const now = new Date().toISOString();

  for (const crew of CREW) {
    // Find user by name (case-insensitive partial match)
    const user = users.find(u =>
      u.name && u.name.toLowerCase().includes(crew.nameMatch.toLowerCase())
    );

    if (!user) {
      console.log(`  ⚠  No user found matching "${crew.nameMatch}" — skipped`);
      continue;
    }

    await client.query(
      `INSERT INTO "EmployeeWage"
         ("id", "userId", "title", "year", "hourlyWage", "burdenRate", "paySchedule",
          "isFieldCrew", "notes", "wageHistory", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'biweekly', $6, $7, '[]'::jsonb, NOW())
       ON CONFLICT ("userId") DO UPDATE SET
         "title"       = EXCLUDED."title",
         "year"        = EXCLUDED."year",
         "hourlyWage"  = EXCLUDED."hourlyWage",
         "burdenRate"  = EXCLUDED."burdenRate",
         "isFieldCrew" = EXCLUDED."isFieldCrew",
         "notes"       = EXCLUDED."notes",
         "updatedAt"   = NOW()`,
      [user.id, crew.title, crew.year, crew.hourlyWage, burdenRate, crew.isFieldCrew, crew.notes]
    );

    const burdened = crew.hourlyWage * (1 + burdenRate);
    console.log(
      `  ✓  ${user.name} (${user.email}) — ${crew.title}${crew.year ? " " + crew.year : ""} · ` +
      `$${crew.hourlyWage}/hr · $${burdened.toFixed(2)}/hr burdened · ` +
      (crew.isFieldCrew ? "field crew" : "overhead")
    );
  }

  // 3. Upsert CompanyRates singleton
  console.log("\nSeeding CompanyRates...");
  await client.query(
    `INSERT INTO "CompanyRates" ("id", "defaultBurden", "bidRates", "updatedAt")
     VALUES ('singleton', 0.35, $1::jsonb, NOW())
     ON CONFLICT ("id") DO UPDATE SET
       "defaultBurden" = EXCLUDED."defaultBurden",
       "bidRates"      = EXCLUDED."bidRates",
       "updatedAt"     = NOW()`,
    [JSON.stringify(BID_RATES)]
  );

  console.log("  ✓  CompanyRates seeded with bid rates:");
  for (const [key, rate] of Object.entries(BID_RATES)) {
    const [title, year] = key.split(":");
    console.log(`       ${title}${year ? " " + year : ""}: $${rate}/hr`);
  }

  // 4. Verify final state
  const { rows: wages } = await client.query(
    `SELECT ew.*, u.name, u.email
     FROM "EmployeeWage" ew
     JOIN "User" u ON u.id = ew."userId"
     ORDER BY u.name`
  );
  console.log(`\nFinal EmployeeWage records (${wages.length}):`);
  wages.forEach(w => {
    const burdened = w.hourlyWage * (1 + w.burdenRate);
    console.log(
      `  ${w.name} — ${w.title}${w.year ? " " + w.year : ""} · ` +
      `$${Number(w.hourlyWage).toFixed(2)}/hr · $${burdened.toFixed(2)}/hr burdened · ` +
      (w.isFieldCrew ? "field" : "overhead")
    );
  });

  const { rows: rates } = await client.query('SELECT * FROM "CompanyRates" WHERE id = $1', ["singleton"]);
  console.log(`\nCompanyRates defaultBurden: ${(rates[0]?.defaultBurden * 100).toFixed(0)}%`);

  await client.end();
  console.log("\nSeed complete.");
}

main().catch(err => { console.error("Seed failed:", err.message); process.exit(1); });
