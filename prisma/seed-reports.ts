// prisma/seed-reports.ts
// Run with: npx tsx prisma/seed-reports.ts
// Seeds the IssueCode and LibraryFinding libraries with common entries.

import 'dotenv/config';
import { PrismaClient } from '../app/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma  = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

const issueCodes = [
  // Battery issues
  { code: 'BB', description: 'Bad Battery', correctiveCode: 'RB', correctiveDescription: 'Replace Battery', category: 'battery' },
  { code: 'BC', description: 'Battery Not Charging', correctiveCode: 'RC', correctiveDescription: 'Replace Charger/Charging Circuit', category: 'battery' },
  { code: 'NB', description: 'No Battery Backup', correctiveCode: 'IB', correctiveDescription: 'Install Battery Pack', category: 'battery' },
  { code: 'BL', description: 'Battery Low — Weak Output', correctiveCode: 'RB', correctiveDescription: 'Replace Battery', category: 'battery' },
  // Lamp/lens issues
  { code: 'LO', description: 'Lamp Out', correctiveCode: 'RL', correctiveDescription: 'Replace Lamp/LED', category: 'lamp' },
  { code: 'LD', description: 'Lamp Dim — Insufficient Output', correctiveCode: 'RL', correctiveDescription: 'Replace Lamp/LED', category: 'lamp' },
  { code: 'LC', description: 'Lens Cracked or Damaged', correctiveCode: 'RX', correctiveDescription: 'Replace Lens', category: 'physical' },
  // Physical/mounting
  { code: 'FH', description: 'Fixture Head Loose or Misaimed', correctiveCode: 'TH', correctiveDescription: 'Tighten and Aim Fixture Head', category: 'physical' },
  { code: 'WD', description: 'Water Damage or Corrosion', correctiveCode: 'EV', correctiveDescription: 'Evaluate — Repair or Replace Unit', category: 'physical' },
  { code: 'PD', description: 'Physical Damage to Housing', correctiveCode: 'RU', correctiveDescription: 'Replace Unit', category: 'physical' },
  // Electrical
  { code: 'NC', description: 'Not Connected — No Power', correctiveCode: 'CW', correctiveDescription: 'Check and Restore Wiring', category: 'electrical' },
  { code: 'CI', description: 'Charging Indicator Not Functioning', correctiveCode: 'EV', correctiveDescription: 'Evaluate Charging Circuit', category: 'electrical' },
  { code: 'TS', description: 'Transfer Switch Malfunction', correctiveCode: 'RT', correctiveDescription: 'Repair or Replace Transfer Switch', category: 'electrical' },
  // Test failures
  { code: 'F3', description: 'Failed 30-Second Functional Test', correctiveCode: 'EV', correctiveDescription: 'Evaluate Battery and Charging System', category: 'test' },
  { code: 'F9', description: 'Failed 90-Minute Duration Test', correctiveCode: 'RB', correctiveDescription: 'Replace Battery — Insufficient Capacity', category: 'test' },
  { code: 'NT', description: 'Not Tested — Access Issue', correctiveCode: 'RS', correctiveDescription: 'Reschedule Test', category: 'test' },
];

const libraryFindings = [
  // Field Investigation findings
  {
    title: 'Junction Box Deficiencies — Missing/Damaged Fittings',
    body: 'Conduits and cables enter junction enclosures through broken or missing connectors and locknuts. The overall wiring arrangement within these enclosures is disorganized and does not reflect the standard of care expected of a licensed electrical installation.',
    necReferences: 'NEC 110.12 (Neat and Workmanlike Manner); NEC 300.15 (Boxes Required); NEC 314.17 (Conductors Entering Boxes)',
    hazardNote: 'Unprotected cable entries allow insulation damage at the enclosure edge, a common cause of ground faults and insulation failure over time.',
    tags: ['junction box', 'fittings', '110.12', '300.15', '314.17'],
    reportType: 'field_investigation',
  },
  {
    title: 'Overfilled Junction Box',
    body: 'The junction enclosure is overfilled and conductors are arranged haphazardly within. When conductors are disturbed during servicing, connections may pull free and expose energized conductors. This condition presents an imminent shock hazard to personnel performing maintenance.',
    necReferences: 'NEC 110.12 (Neat and Workmanlike Manner); NEC 314.16 (Box Fill Calculations); NEC 110.3(B) (Listed Equipment)',
    hazardNote: 'An overfilled enclosure makes it impossible to work conductors without disturbing existing connections, compounding the hazard.',
    tags: ['junction box', 'overfill', '314.16', '110.12'],
    reportType: 'field_investigation',
  },
  {
    title: 'Shared Neutral — Separate Panelboards',
    body: 'Branch circuits originating from separate panelboards share a common neutral conductor. This arrangement creates a condition where de-energizing one panel does not de-energize all conductors associated with a given circuit. When connected to GFCI devices, both devices trip immediately and cannot be reset — correct behavior given the wiring configuration.',
    necReferences: 'NEC 110.12; NEC 200.4(B) (Neutral Conductors — One Circuit Only); NEC 210.4(B) (Multiwire Branch Circuits — Simultaneous Disconnect)',
    hazardNote: 'A technician who de-energizes one panelboard cannot rely on lockout/tagout to render all associated conductors safe. Voltage may remain present on the shared neutral from the second panelboard.',
    tags: ['shared neutral', 'panelboard', 'GFCI', '200.4', '210.4'],
    reportType: 'field_investigation',
  },
  {
    title: 'Cross-Panel Neutral Conductors',
    body: 'Branch circuits are routed such that the ungrounded conductor originates from one panelboard while the associated neutral conductor is terminated in a separate panelboard. This arrangement is not consistent with a neat and workmanlike installation.',
    necReferences: 'NEC 110.12; NEC 200.4(B); NEC 408.41 (Panelboard Loads)',
    hazardNote: 'A technician may de-energize the panel they are working in while voltage remains present on conductors they believe to be safe.',
    tags: ['cross-panel', 'neutral', 'panelboard', '408.41'],
    reportType: 'field_investigation',
  },
  {
    title: 'Missing GFCI Protection — Commercial Equipment',
    body: 'Receptacles serving commercial kitchen equipment, outdoor locations, or other locations requiring GFCI protection are not protected by a listed GFCI device. This condition represents a code violation and a shock hazard to personnel using the affected outlets.',
    necReferences: 'NEC 210.8(B) (GFCI Protection — Other Than Dwelling Units)',
    hazardNote: 'Absence of GFCI protection in required locations creates a shock hazard, particularly in wet or damp environments.',
    tags: ['GFCI', '210.8', 'receptacle', 'protection'],
    reportType: 'field_investigation',
  },
  {
    title: 'Conductor Insulation Damage',
    body: 'Visible damage to conductor insulation was observed, including cuts, abrasion, or heat damage. Damaged insulation reduces the dielectric protection of the conductor and may result in ground faults, arcing, or insulation failure under load.',
    necReferences: 'NEC 110.12; NEC 310.10 (Uses Permitted)',
    hazardNote: 'Damaged insulation can lead to arcing faults, ground faults, and potential ignition of combustible materials in the vicinity.',
    tags: ['insulation', 'conductor', 'damage', '310.10'],
    reportType: 'field_investigation',
  },
  {
    title: 'Improper Wiring Method — Location',
    body: 'The wiring method installed is not approved for the location conditions. The existing installation does not account for the environmental conditions present, including exposure to moisture, physical damage, or chemical exposure.',
    necReferences: 'NEC 110.12; NEC 300.6 (Protection Against Corrosion); NEC 358.10 (Uses Permitted — EMT)',
    hazardNote: 'An improper wiring method may degrade prematurely, leading to insulation failure, short circuits, or ground faults.',
    tags: ['wiring method', 'location', '300.6', 'EMT'],
    reportType: 'field_investigation',
  },
  {
    title: 'Open Junction Box — Missing Cover',
    body: 'One or more junction boxes are missing their covers, leaving conductors, splices, and terminations exposed. All junction boxes must be equipped with a cover that can be removed without tools for access.',
    necReferences: 'NEC 314.28(C) (Covers); NEC 110.12',
    hazardNote: 'Exposed splices and terminations present a direct contact shock hazard and are a potential ignition source.',
    tags: ['junction box', 'cover', '314.28', 'open'],
    reportType: 'field_investigation',
  },
  // Emergency lighting findings
  {
    title: 'Emergency Lighting Unit — Failed 90-Minute Test',
    body: 'The unit failed to maintain adequate illumination for the required 90-minute duration test. Battery output was insufficient to sustain the lamp(s) at the required light level for the full test period.',
    necReferences: 'NFPA 101 Section 7.9.3 (Emergency Lighting — Duration)',
    hazardNote: 'A unit that fails the 90-minute test cannot provide required egress illumination during a sustained power outage.',
    tags: ['emergency lighting', '90-minute', 'battery', 'NFPA 101'],
    reportType: 'emergency_lighting',
  },
  {
    title: 'Exit Sign — Lamp Not Illuminated',
    body: 'The exit sign lamp is not illuminated under normal operating conditions. Exit signs must be continuously illuminated to indicate the direction of egress.',
    necReferences: 'NFPA 101 Section 7.10 (Means of Egress Illumination); NEC 700.16',
    hazardNote: 'A non-illuminated exit sign may cause confusion during an emergency evacuation.',
    tags: ['exit sign', 'lamp', 'NFPA 101', '700.16'],
    reportType: 'emergency_lighting',
  },
  {
    title: 'Emergency Lighting — Improper Coverage',
    body: 'The emergency lighting unit is aimed or positioned such that it does not provide adequate illumination along the required egress path. Light heads must be aimed to provide a minimum of 1 foot-candle at floor level along the path of egress.',
    necReferences: 'NFPA 101 Section 7.8.1.3 (Illumination of Means of Egress)',
    hazardNote: 'Inadequate egress illumination may impede safe evacuation.',
    tags: ['emergency lighting', 'coverage', 'egress', 'NFPA 101'],
    reportType: 'emergency_lighting',
  },
];

async function main() {
  // Issue codes — `code` is unique, so upsert directly.
  let codes = 0;
  for (const ic of issueCodes) {
    await prisma.issueCode.upsert({
      where: { code: ic.code },
      update: {
        description: ic.description,
        correctiveCode: ic.correctiveCode,
        correctiveDescription: ic.correctiveDescription,
        category: ic.category,
        isSeeded: true,
      },
      create: { ...ic, isSeeded: true },
    });
    codes++;
  }

  // Library findings — no unique (title, reportType) constraint, so find-then-write.
  let findings = 0;
  for (const f of libraryFindings) {
    const existing = await prisma.libraryFinding.findFirst({
      where: { title: f.title, reportType: f.reportType },
      select: { id: true },
    });
    if (existing) {
      await prisma.libraryFinding.update({
        where: { id: existing.id },
        data: {
          body: f.body,
          necReferences: f.necReferences,
          hazardNote: f.hazardNote,
          tags: f.tags,
          isSeeded: true,
        },
      });
    } else {
      await prisma.libraryFinding.create({
        data: { ...f, isSeeded: true },
      });
    }
    findings++;
  }

  console.log(`Seeded ${codes} issue codes`);
  console.log(`Seeded ${findings} findings`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
