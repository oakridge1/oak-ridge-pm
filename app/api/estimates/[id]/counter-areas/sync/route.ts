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

// ─── Counter key → BOM item ID mapping ────────────────────────────────────────
// Values are BOM item IDs from lib/bom.ts
const COUNT_TO_BOM: Record<string, string> = {
  // Devices
  recept_20a:    "r20",
  recept_15a_tr: "r15",
  gfci_20a:      "gfci20",
  gfci_15a_tr:   "gfci15",
  switch_sp:     "sw20",
  dimmer:        "dim",
  dimmer_010v:   "dim",
  occ_sensor:    "occ",
  wp_cover:      "wpdev",
  // Fixtures
  fixture_2x4:   "tb24",
  fixture_2x2:   "tb22",
  fixture_strip: "s24",
  fixture_wallpack: "wpfix",
  fixture_exit_ebu: "ex",
  fixture_highbay: "hb",
  fixture_ceilfan: "ch48",  // closest — chain mount
  // Data (closest BOM matches — these are device count items)
  data_1port:    "sg",      // single-gang box placeholder
  data_2port:    "dg",
  data_3port:    "dg",
  data_4port:    "dg",
  // Panels
  panel_comm_sm: "bb48",
  panel_comm_md: "bb96",
  panel_comm_lg: "bb96",
  lc_100a:       "bb48",
  lc_200a:       "bb96",
  // Fire alarm — mapped to closest box/device equivalents
  fa_smoke:      "sg",
  fa_heat:       "sg",
  fa_smoke_co:   "sg",
  fa_pull:       "sg",
  fa_horn_strobe: "sg",
  fa_strobe:     "sg",
  fa_lf_sounder: "sg",
  fa_beacon:     "sg",
  fa_ctrl_mod:   "4sq",
  fa_duct_smoke: "4sq",
  fa_panel_sm:   "bb48",
  fa_panel_md:   "bb48",
  fa_panel_lg:   "bb96",
  fa_radio:      "4sq",
  fa_annun:      "4sq",
  // Boxes & rough
  box_4sq_deep:  "4sq",
  can_sm:        "jbox",
  can_md:        "jbox",
  can_lg:        "jbox",
  can_xl:        "jbox",
};

// Conduit footage items → BOM ID
const CONDUIT_TO_BOM: Record<string, string> = {
  conduit_emt_12:  "emt34",  // 1/2" maps to 3/4" (closest available)
  conduit_emt_34:  "emt34",
  conduit_emt_1:   "emt1",
  conduit_emt_114: "emt1",   // 1-1/4" maps to 1"
  conduit_emt_112: "emt112",
  conduit_emt_2:   "emt2",
  conduit_pvc_12:  "emt34",  // PVC maps to EMT equivalents
  conduit_pvc_34:  "emt34",
  conduit_pvc_1:   "emt1",
  conduit_pvc_2:   "emt2",
  conduit_pvc_3:   "emt3",
  conduit_pvc_4:   "emt4",
  conduit_rigid:   "emt2",   // Rigid maps to 2" EMT as proxy
};

// MC home run footage items
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

  // Process 3-way switch (footage type)
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
  for (const [key, bomId] of Object.entries(CONDUIT_TO_BOM)) {
    const footage = totals[key];
    if (footage && footage > 0) {
      // Check if there's an existing item for this bomId already added in this sync
      const existing = newTakeoffItems.find(t => t.bomId === bomId && t.note?.includes("counter"));
      if (existing) {
        existing.qty += footage;
      } else {
        newTakeoffItems.push({
          id: newId(),
          bomId,
          qty: footage,
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
