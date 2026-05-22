/**
 * seed-system-jobs.js — Creates system jobs (Office/Overhead + Shop/Equipment)
 * and pre-populates Vehicle ORE1.
 * Safe to re-run — uses upsert by jobNumber / vehicle tag.
 *
 * Run: node scripts/seed-system-jobs.js
 */

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const year = new Date().getFullYear().toString().slice(-2); // "26"

  const systemJobs = [
    {
      jobNumber: `${year}-000`,
      jobName: "Office & Overhead",
      jobType: "SYSTEM",
      isSystemJob: true,
      status: "ACTIVE",
    },
    {
      jobNumber: `${year}-999`,
      jobName: "Shop & Equipment",
      jobType: "SYSTEM",
      isSystemJob: true,
      status: "ACTIVE",
    },
  ];

  for (const job of systemJobs) {
    const existing = await pool.query('SELECT id FROM "Job" WHERE "jobNumber" = $1', [job.jobNumber]);
    if (existing.rows.length > 0) {
      // Update to ensure SYSTEM type and isSystemJob flag
      await pool.query(
        `UPDATE "Job" SET "jobType" = $1, "isSystemJob" = $2, status = $3, "updatedAt" = NOW()
         WHERE "jobNumber" = $4`,
        [job.jobType, job.isSystemJob, job.status, job.jobNumber]
      );
      console.log(`✓ Updated existing system job: ${job.jobNumber} — ${job.jobName}`);
    } else {
      await pool.query(
        `INSERT INTO "Job" ("id", "jobNumber", "jobName", "jobType", "isSystemJob", "status", "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, NOW(), NOW())`,
        [job.jobNumber, job.jobName, job.jobType, job.isSystemJob, job.status]
      );
      console.log(`✓ Created system job: ${job.jobNumber} — ${job.jobName}`);
    }
  }

  // Seed Vehicle ORE1
  const existingVehicle = await pool.query('SELECT id FROM "Vehicle" WHERE tag = $1', ["ORE1"]);
  if (existingVehicle.rows.length > 0) {
    console.log("✓ Vehicle ORE1 already exists");
  } else {
    await pool.query(
      `INSERT INTO "Vehicle" ("id", "tag", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, true, NOW(), NOW())`,
      ["ORE1"]
    );
    console.log("✓ Created vehicle: ORE1");
  }

  console.log("\nDone! System jobs and ORE1 vehicle are ready.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
