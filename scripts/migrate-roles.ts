/**
 * One-time migration: convert legacy FIELD role → FOREMAN
 * Run with: DATABASE_URL="<direct-url>" npx tsx scripts/migrate-roles.ts
 */
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  // Use raw SQL to avoid Prisma enum type restrictions during transition
  const result = await prisma.$executeRaw`
    UPDATE "User" SET role = 'FOREMAN' WHERE role = 'FIELD'
  `;
  console.log(`✓ Migrated ${result} user(s) from FIELD → FOREMAN`);

  // Verify
  const remaining = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM "User" WHERE role = 'FIELD'
  `;
  console.log(`✓ Remaining FIELD users: ${remaining[0].count}`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
