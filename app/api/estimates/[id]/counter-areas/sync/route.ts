export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { TakeoffItem, Assembly } from "@/lib/estimating";

function canEstimate(u: any) {
  return u?.role === "ADMIN" || u?.estimatingPermission === true;
}

function newId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ─── Counter key → BOM item ID mapping ───────────────────────────────────────
// Values are BOM item IDs from lib/bom.ts (HTML BOM IDs)
const COUNT_TO_BOM: Record<string, string> = {
  // Devices
  recept_20a:    "d1",    // 20A Spec Grade Duplex Recept
  recept_15a_tr: "d2",    // 15A TR Duplex Receptacle
  gfci_20a:      "d3",    // 20A GFCI Receptacle
  gfci_15a_tr:   "d4",    // 15A TR GFCI Receptacle
  switch_sp:     "d5",    // Single Pole Switch (spec)
  dimmer:        "d9",    // Dimmer AYCL-153P
  dimmer_010v:   "d14",   // Lutron 0-10V Dimmer
  occ_sensor:    "d15",   // Occupancy Sensor Ceiling
  wp_cover:      "dp5",   // Low Profile WP In-Use Cover
  // Fixtures
  fixture_2x4:      "lc1",  // 2x4 LED Lay-In T-Bar
  fixture_2x2:      "lc2",  // 2x2 LED Lay-In T-Bar
  fixture_strip:    "lc5",  // 4ft LED Strip Surface
  fixture_wallpack: "lc10", // LED Wall Pack (RAB Brisk)
  fixture_exit_ebu: "lc12", // Exit/EBU Combo (CCR)
  fixture_highbay:  "lc8",  // High Bay LED 2x4
  fixture_ceilfan:  "lc14", // Ceiling Fan up to 36"
  // Data (map to closest functional equivalent)
  data_1port: "b1",  // 4" Square Deep Box (rough-in placeholder)
  data_2port: "b1",
  data_3port: "b1",
  data_4port: "b1",
  // Panels / load centers
  panel_comm_sm: "pg1",  // 30/60 100A Load Center
  panel_comm_md: "pg2",  // 40/80 200A Load Center
  panel_comm_lg: "pg2",
  lc_100a:       "pg1",
  lc_200a:       "pg2",
  // Fire alarm devices
  fa_smoke:      "fad2",  // FL Smoke Detector
  fa_heat:       "fad3",  // FL Heat Detector
  fa_smoke_co:   "fad4",  // FL Smoke/CO Combo
  fa_pull:       "fad1",  // FL Pull Station
  fa_horn_strobe:"fad5",  // FL Horn/Strobe
  fa_strobe:     "fad6",  // FL Strobe
  fa_lf_sounder: "fad7",  // FL LF Sounder
  fa_beacon:     "fad8",  // FL Beacon
  fa_ctrl_mod:   "fad9",  // FL Control/Monitor Module
  fa_duct_smoke: "fad10", // FL Duct Smoke Detector
  fa_panel_sm:   "fad12", // FL Control Panel Small
  fa_panel_md:   "fad13", // FL Control Panel Medium
  fa_panel_lg:   "fad14", // FL Control Panel Large
  fa_radio:      "fad15", // FL Radio Box
  fa_annun:      "fad11", // FL Annunciator
  // Boxes & rough
  box_4sq_deep: "b1",  // 4" Square Deep Box
  can_sm:       "b1",  // placeholder — actual can is per-quote
  can_md:       "b1",
  can_lg:       "b1",
  can_xl:       "b1",
};

// Conduit footage → BOM ID + whether the BOM unit is per-10ft-stick (isStick=true)
// or per-foot (isStick=false)
const CONDUIT_TO_BOM: Record<string, { bomId: string; isStick: boolean }> = {
  // EMT (sold as 10ft sticks: divide footage by 10, round up)
  conduit_emt_12:  { bomId: "e1", isStick: true  },  // 1/2" EMT
  conduit_emt_34:  { bomId: "e2", isStick: true  },  // 3/4" EMT
  conduit_emt_1:   { bomId: "e3", isStick: true  },  // 1" EMT
  conduit_emt_114: { bomId: "e4", isStick: true  },  // 1-1/4" EMT
  conduit_emt_112: { bomId: "e5", isStick: true  },  // 1-1/2" EMT
  conduit_emt_2:   { bomId: "e6", isStick: true  },  // 2" EMT
  // PVC Sch40 (sold per foot)
  conduit_pvc_12:  { bomId: "pvc1", isStick: false }, // 1/2" PVC
  conduit_pvc_34:  { bomId: "pvc2", isStick: false }, // 3/4" PVC
  conduit_pvc_1:   { bomId: "pvc3", isStick: false }, // 1" PVC
  conduit_pvc_2:   { bomId: "pvc5", isStick: false }, // 2" PVC
  conduit_pvc_3:   { bomId: "pvc6", isStick: false }, // 3" PVC
  conduit_pvc_4:   { bomId: "pvc7", isStick: false }, // 4" PVC
  // Rigid (sold as 10ft sticks)
  conduit_rigid:   { bomId: "rg6", isStick: true  },  // 2" Rigid (proxy)
};

// MC home run footage → wire size
const MC_WIRE_SIZE: Record<string, "12" | "10" | "8"> = {
  mc_homerun_12: "12",
  mc_homerun_10: "10",
  mc_homerun_8:  "8",
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.active || !canEstimate(session.user)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const { id } = await params;

  const estimate = await prisma.estimate.findUnique({
    where: { id },
    select: {
      id: true,
      takeoffItems: true,
      assemblies: true,
      counterAreas: true,
    },
  });
  if (!estimate) return new NextResponse("Not found", { status: 404 });

  const areas = await prisma.counterArea.findMany({ where: { estimateId: id } });

  // Aggregate all counts across all areas
  const totals: Record<string, number> = {};
  for (const area of areas) {
    const counts = (area.counts ?? {}) as Record<string, number>;
    for (const [key, val] of Object.entries(counts)) {
      if (typeof val === "number" && val > 0) {
        totals[key] = (totals[key] ?? 0) + val;
      }
    }
  }

  const existingTakeoffItems = Array.isArray(estimate.takeoffItems)
    ? (estimate.takeoffItems as TakeoffItem[])
    : [];
  const existingAssemblies = Array.isArray(estimate.assemblies)
    ? (estimate.assemblies as Assembly[])
    : [];

  const newTakeoffItems: TakeoffItem[] = [];
  const newAssemblies: Assembly[] = [];
  let itemsAdded = 0;

  // Process 3-way switch (footage type → Assembly)
  if (totals["switch_3way"] && totals["switch_3way"] > 0) {
    const travelerFt = totals["switch_3way"];
    newAssemblies.push({
      id: newId(),
      type: "THREE_WAY",
      label: `3-Way Circuit — ${travelerFt} ft traveler (from counter)`,
      params: { feedFt: 10, travelerFt, switchLegFt: 10, wireSize: "12" },
    });
    itemsAdded++;
  }

  // Process MC home runs (footage type → Assembly)
  for (const [key, wireSize] of Object.entries(MC_WIRE_SIZE)) {
    const footage = totals[key];
    if (footage && footage > 0) {
      newAssemblies.push({
        id: newId(),
        type: "MC_HOME_RUN",
        label: `MC #${wireSize} Home Run — ${footage} ft (from counter)`,
        params: { wireSize, footage, circuits: 1, hasBox: false },
      });
      itemsAdded++;
    }
  }

  // Process conduit footage items → TakeoffItem
  for (const [key, { bomId, isStick }] of Object.entries(CONDUIT_TO_BOM)) {
    const footage = totals[key];
    if (footage && footage > 0) {
      // EMT/Rigid: convert footage to sticks (ceil to nearest 10ft)
      const qty = isStick ? Math.ceil(footage / 10) : footage;
      // Merge with existing counter item for same bomId in this batch
      const existing = newTakeoffItems.find(t => t.bomId === bomId && t.note?.includes("counter"));
      if (existing) {
        existing.qty += qty;
      } else {
        newTakeoffItems.push({
          id: newId(),
          bomId,
          qty,
          note: `${key.replace(/_/g, " ")} — from counter`,
        });
        itemsAdded++;
      }
    }
  }

  // Process count items → TakeoffItem
  for (const [key, bomId] of Object.entries(COUNT_TO_BOM)) {
    const count = totals[key];
    if (count && count > 0) {
      newTakeoffItems.push({
        id: newId(),
        bomId,
        qty: count,
        note: `from counter`,
      });
      itemsAdded++;
    }
  }

  // Append to existing (don't overwrite manual entries)
  const updatedTakeoffItems = [...existingTakeoffItems, ...newTakeoffItems];
  const updatedAssemblies = [...existingAssemblies, ...newAssemblies];

  await prisma.estimate.update({
    where: { id },
    data: { takeoffItems: updatedTakeoffItems as any, assemblies: updatedAssemblies as any },
  });

  return NextResponse.json({ ok: true, itemsAdded });
}
