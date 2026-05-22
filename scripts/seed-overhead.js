/**
 * seed-overhead.js — Pre-populates fixed overhead costs for Oak Ridge Electrical
 * Safe to re-run — checks for existing records by description before inserting.
 * Run: DIRECT_URL="..." node scripts/seed-overhead.js
 */
const { Pool } = require("pg");
const pool = new Pool({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  // Find an admin user to use as createdById
  const userResult = await pool.query(`SELECT id FROM "User" WHERE role = 'ADMIN' LIMIT 1`);
  if (userResult.rows.length === 0) {
    console.error("No admin user found. Create an admin user first.");
    process.exit(1);
  }
  const createdById = userResult.rows[0].id;

  const costs = [
    {
      category: "Rent & Facilities",
      description: "Shop Rent — 209 W. River Rd",
      amount: 1900,
      effectiveDate: "2026-01-01",
      isRecurring: true,
      recurringFreq: "monthly",
      recurringDay: 1,
      autoIncrease: true,
      increaseRate: 0.035,
      increaseMonth: 11,
      notes: null,
    },
    {
      category: "Professional Services",
      description: "Sam Cosme — Contractor Payment",
      amount: 560,
      effectiveDate: "2026-01-01",
      isRecurring: true,
      recurringFreq: "biweekly",
      recurringDay: null,
      autoIncrease: false,
      increaseRate: null,
      increaseMonth: null,
      notes: "Paid in PHP at current exchange rate",
    },
  ];

  for (const cost of costs) {
    const existing = await pool.query(
      `SELECT id FROM "OverheadCost" WHERE description = $1 AND "isRecurring" = true`,
      [cost.description]
    );
    if (existing.rows.length > 0) {
      console.log(`✓ Already exists: ${cost.description}`);
      continue;
    }
    await pool.query(
      `INSERT INTO "OverheadCost" (id, category, description, amount, "effectiveDate", "isRecurring", "recurringFreq", "recurringDay", "autoIncrease", "increaseRate", "increaseMonth", notes, "createdById", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
      [cost.category, cost.description, cost.amount, cost.effectiveDate, cost.isRecurring, cost.recurringFreq, cost.recurringDay, cost.autoIncrease, cost.increaseRate, cost.increaseMonth, cost.notes, createdById]
    );
    console.log(`✓ Created: ${cost.description}`);
  }

  console.log("\nDone!");
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
