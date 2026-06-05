// prisma/seed-bom.ts
// Run with: npx tsx prisma/seed-bom.ts
// Upserts all static BOM items into the BomItem table.

import 'dotenv/config';
import { PrismaClient } from '../app/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { BOM } from '../lib/estimator/bom';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma  = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

async function main() {
  let count = 0;
  for (const item of BOM) {
    await prisma.bomItem.upsert({
      where: { id: item.id },
      update: {
        cat:  item.cat,
        name: item.name,
        unit: item.unit,
        mat:  item.mat,
        lhr:  item.lhr,
        mk:   item.mk,
        gc:   item.gc ?? false,
      },
      create: {
        id:   item.id,
        cat:  item.cat,
        name: item.name,
        unit: item.unit,
        mat:  item.mat,
        lhr:  item.lhr,
        mk:   item.mk,
        gc:   item.gc ?? false,
      },
    });
    count++;
  }
  console.log(`✓ Seeded ${count} BOM items`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
