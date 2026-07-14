// prisma/seed-panel-library.ts
// Run with: npx tsx prisma/seed-panel-library.ts
// Seeds the CircuitLibrary with common panel-circuit presets.

import 'dotenv/config';
import { PrismaClient } from '../app/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma  = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

// NOTE: CircuitLibrary.defaultAmps is a non-null Int (@default(20)). The SPD entry
// conceptually has "no amps"; we store 20 as a placeholder and rely on
// defaultStatus "DEVICE" so the UI nulls PanelCircuit.amps for it.
const circuitLibrary: {
  label: string;
  defaultPoles: number;
  defaultAmps: number;
  defaultFlags: string[];
  defaultStatus?: string;
  tags: string[];
}[] = [
  { label: "FIRE ALARM PANEL",          defaultPoles: 1, defaultAmps: 20, defaultFlags: ["LO"],  tags: ["facp", "fire", "alarm"] },
  { label: "EXIT & EMERGENCY LIGHTING", defaultPoles: 1, defaultAmps: 20, defaultFlags: ["LO"],  tags: ["exit", "emergency", "egress", "lighting"] },
  { label: "SURGE PROTECTION DEVICE",   defaultPoles: 1, defaultAmps: 20, defaultFlags: [],       defaultStatus: "DEVICE", tags: ["spd", "surge", "tvss"] },
  { label: "SPARE",                     defaultPoles: 1, defaultAmps: 20, defaultFlags: [],       defaultStatus: "SPARE",  tags: ["spare"] },
  { label: "SPARE IN TROUGH",           defaultPoles: 1, defaultAmps: 20, defaultFlags: [],       defaultStatus: "SPARE",  tags: ["spare", "trough"] },
  { label: "WATER HEATER",              defaultPoles: 2, defaultAmps: 30, defaultFlags: [],       tags: ["water", "heater", "dhw"] },
  { label: "CONDENSER",                 defaultPoles: 2, defaultAmps: 20, defaultFlags: [],       tags: ["condenser", "hvac", "ac", "cooling"] },
  { label: "RTU",                       defaultPoles: 3, defaultAmps: 30, defaultFlags: [],       tags: ["rtu", "rooftop", "hvac"] },
  { label: "ERV",                       defaultPoles: 1, defaultAmps: 20, defaultFlags: [],       tags: ["erv", "ventilation", "hvac"] },
  { label: "MODINE HEATER",             defaultPoles: 1, defaultAmps: 20, defaultFlags: [],       tags: ["modine", "heater", "unit heater"] },
  { label: "PARKING LOT LIGHTS",        defaultPoles: 1, defaultAmps: 20, defaultFlags: [],       tags: ["parking", "site", "lighting", "exterior"] },
  { label: "HIGH BAY LIGHTING",         defaultPoles: 1, defaultAmps: 20, defaultFlags: [],       tags: ["high bay", "lighting", "warehouse"] },
  { label: "EXTERIOR BUILDING LIGHTS",  defaultPoles: 1, defaultAmps: 20, defaultFlags: [],       tags: ["exterior", "building", "lighting", "wallpack"] },
  { label: "RECEPTACLES",               defaultPoles: 1, defaultAmps: 20, defaultFlags: [],       tags: ["receptacle", "recept", "outlet"] },
  { label: "GFCI RECEPTACLES",          defaultPoles: 1, defaultAmps: 20, defaultFlags: ["GFI"],  tags: ["gfci", "gfi", "receptacle", "outlet"] },
  { label: "BATHROOM GFCI'S",           defaultPoles: 1, defaultAmps: 20, defaultFlags: ["GFI"],  tags: ["bathroom", "restroom", "gfci", "gfi"] },
  { label: "KITCHEN RECEPTACLES",       defaultPoles: 1, defaultAmps: 20, defaultFlags: ["GFI"],  tags: ["kitchen", "receptacle", "gfci", "gfi"] },
  { label: "SEPTIC PUMP",               defaultPoles: 2, defaultAmps: 20, defaultFlags: [],       tags: ["septic", "pump"] },
  { label: "SEPTIC CONTROLLER",         defaultPoles: 1, defaultAmps: 20, defaultFlags: [],       tags: ["septic", "controller", "control"] },
  { label: "WELL PUMP",                 defaultPoles: 2, defaultAmps: 20, defaultFlags: [],       tags: ["well", "pump"] },
  { label: "FURNACE",                   defaultPoles: 1, defaultAmps: 20, defaultFlags: [],       tags: ["furnace", "heat", "hvac"] },
  { label: "MINI SPLIT",                defaultPoles: 2, defaultAmps: 20, defaultFlags: [],       tags: ["mini split", "minisplit", "ductless", "hvac"] },
  { label: "SIGN CIRCUIT",              defaultPoles: 1, defaultAmps: 20, defaultFlags: ["LO"],   tags: ["sign", "signage", "exterior"] },
];

async function main() {
  let count = 0;
  for (const c of circuitLibrary) {
    const data = {
      label: c.label,
      defaultPoles: c.defaultPoles,
      defaultAmps: c.defaultAmps,
      defaultFlags: c.defaultFlags,
      defaultStatus: c.defaultStatus ?? "ASSIGNED",
      tags: c.tags,
      isSeeded: true,
    };
    // label is @unique, so upsert directly.
    await prisma.circuitLibrary.upsert({
      where: { label: c.label },
      update: {
        defaultPoles: data.defaultPoles,
        defaultAmps: data.defaultAmps,
        defaultFlags: data.defaultFlags,
        defaultStatus: data.defaultStatus,
        tags: data.tags,
        isSeeded: true,
      },
      create: data,
    });
    count++;
  }

  console.log(`Seeded ${count} circuit library entries`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
