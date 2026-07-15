// Shared panel-schedule helpers (used by API routes and create/edit flows).
import { prisma } from "@/lib/prisma";

// Effective "can create/edit panels" check. ADMIN/OFFICE/FOREMAN keep built-in
// access (short-circuit before any DB hit); any other role is elevated only by a
// MANAGE_PANELS grant (GLOBAL, or JOB-scoped to this job). Mirrors the ORDERING
// precedent in stock-orders. Grants add access — they never remove built-in access.
export async function canManagePanels(
  user: { id?: string | null; role?: string | null } | null | undefined,
  jobId: string
): Promise<boolean> {
  const role = user?.role;
  if (role === "ADMIN" || role === "OFFICE" || role === "FOREMAN") return true;
  if (!user?.id) return false;
  const perm = await prisma.userPermission.findFirst({
    where: {
      userId: user.id,
      permission: "MANAGE_PANELS",
      OR: [{ scope: "GLOBAL" }, { scope: "JOB", jobId }],
    },
  });
  return perm !== null;
}

export const CIRCUIT_STATUSES = ["ASSIGNED", "SPARE", "OPEN", "SPACE", "DEVICE"] as const;
export const CIRCUIT_FLAGS = ["LO", "GFI", "E"] as const;

// Single source of truth for a circuit row's status-dependent defaults.
// Rule: amps is null for SPACE and DEVICE rows; otherwise defaults to 20.
export function circuitDefaults(status: string): { poles: number; amps: number | null } {
  const ampsNull = status === "SPACE" || status === "DEVICE";
  return { poles: 1, amps: ampsNull ? null : 20 };
}

// Build the full grid of OPEN circuit rows for a panel (ckt start..end inclusive).
export function buildOpenCircuitRows(panelScheduleId: string, start: number, end: number) {
  const rows = [];
  for (let ckt = start; ckt <= end; ckt++) {
    const { poles, amps } = circuitDefaults("OPEN");
    rows.push({ panelScheduleId, ckt, status: "OPEN", poles, amps, flags: [] as string[] });
  }
  return rows;
}

// Phases derive from the voltage system: "3PH" → 3, otherwise 1.
export function phasesFromSystem(system: string): number {
  return /3PH/i.test(system) ? 3 : 1;
}

// Normalize a circuit edit payload. Enforces the status-driven field rules in one place.
// Throws Error(message) on invalid poles/status/flags (callers translate to 400).
export function sanitizeCircuitInput(input: {
  status?: unknown;
  description?: unknown;
  poles?: unknown;
  amps?: unknown;
  flags?: unknown;
}): { status: string; description: string | null; poles: number; amps: number | null; flags: string[] } {
  const status = String(input.status ?? "OPEN");
  if (!CIRCUIT_STATUSES.includes(status as (typeof CIRCUIT_STATUSES)[number])) {
    throw new Error(`Invalid status "${status}"`);
  }

  const poles = Number(input.poles ?? 1);
  if (!Number.isInteger(poles) || poles < 1 || poles > 3) {
    throw new Error("Poles must be 1, 2, or 3");
  }

  const flagsIn = Array.isArray(input.flags) ? input.flags.map(String) : [];
  const flags = flagsIn.filter((f) => CIRCUIT_FLAGS.includes(f as (typeof CIRCUIT_FLAGS)[number]));

  // amps: null for SPACE/DEVICE, else numeric-or-null
  let amps: number | null;
  if (status === "SPACE" || status === "DEVICE") {
    amps = null;
  } else {
    amps = input.amps === null || input.amps === undefined || input.amps === "" ? null : Number(input.amps);
    if (amps !== null && !Number.isFinite(amps)) amps = null;
  }

  // description: null for OPEN/SPACE, else string-or-null
  let description: string | null;
  if (status === "OPEN" || status === "SPACE") {
    description = null;
  } else {
    const d = typeof input.description === "string" ? input.description.trim() : "";
    description = d || null;
  }

  return { status, description, poles, amps, flags };
}

// Validate the optional "fed @ X amps" note. Fed amps must be strictly below the
// panel's protective rating: main breaker rating for MB, bus rating for MLO.
// Returns an error message, or null if valid (or fedAmps not set).
export function validateFedAmps(p: {
  mainType: string;
  mainAmps: number | null;
  busAmps: number;
  fedAmps: number | null;
}): string | null {
  if (p.fedAmps == null) return null;
  if (p.mainType === "MB") {
    if (p.mainAmps != null && p.fedAmps >= p.mainAmps) {
      return "Fed amps must be less than the main breaker rating";
    }
  } else {
    if (p.fedAmps >= p.busAmps) {
      return "Fed amps must be less than the bus rating";
    }
  }
  return null;
}

// Given a multi-pole anchor circuit, compute which same-side circuits it claims.
// A poles=N breaker on circuit C claims C, C+2, ... C+2(N-1) (same parity/side).
// Returns the claimed continuation ckts (EXCLUDING the anchor) and whether the
// claim overruns the last circuit on that side.
export function computeClaim(
  anchorCkt: number,
  poles: number,
  circuitCount: number
): { continuations: number[]; overrun: boolean } {
  const isOdd = anchorCkt % 2 === 1;
  const sideMax = isOdd ? circuitCount - 1 : circuitCount; // odds: 1..count-1, evens: 2..count
  const continuations: number[] = [];
  let overrun = false;
  for (let k = 1; k < poles; k++) {
    const slot = anchorCkt + 2 * k;
    if (slot > sideMax) {
      overrun = true;
    } else {
      continuations.push(slot);
    }
  }
  return { continuations, overrun };
}
