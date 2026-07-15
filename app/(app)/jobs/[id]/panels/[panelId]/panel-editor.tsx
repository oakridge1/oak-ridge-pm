"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ── Types ───────────────────────────────────────────────────────────────────
interface Circuit {
  id: string;
  ckt: number;
  status: string;
  description: string | null;
  poles: number;
  amps: number | null;
  flags: string[];
  updatedByName: string | null;
}

interface LibraryEntry {
  id: string;
  label: string;
  defaultPoles: number;
  defaultAmps: number;
  defaultFlags: string[];
  defaultStatus: string;
  tags: string[];
  useCount: number;
}

interface PanelEditorProps {
  panel: {
    id: string;
    name: string;
    panelType: string;
    system: string;
    phases: number;
    busAmps: number;
    mainType: string;
    mainAmps: number | null;
    fedAmps: number | null;
    fedFrom: string | null;
    location: string | null;
    breakerType: string | null;
    catalogNumber: string | null;
    circuitCount: number;
    afc: string | null;
    aicRating: string | null;
    enclosure: string | null;
    integralTVSS: boolean;
    notes: string | null;
    circuits: Circuit[];
    job: {
      id: string;
      jobNumber: string;
      jobName: string;
      address: string | null;
      city: string | null;
      state: string | null;
      zip: string | null;
    };
  };
  libraryEntries: LibraryEntry[];
  role: string;
  canManage: boolean;
  currentUserName: string;
}

const STATUSES = [
  { value: "ASSIGNED", label: "Assigned" },
  { value: "SPARE", label: "Spare" },
  { value: "OPEN", label: "Open" },
  { value: "SPACE", label: "Space" },
  { value: "DEVICE", label: "Device" },
];
const AMP_QUICK = [15, 20, 30, 40, 50, 60];
const FLAG_OPTS = ["LO", "GFI", "E"];
const SYSTEMS = ["120/208V 3PH 4W", "277/480V 3PH 4W", "120/240V 1PH 3W", "120/208V 1PH 3W"];

function phaseLetter(ckt: number, phases: number): string {
  const seq = phases === 3 ? "ABC" : "AB";
  return seq[Math.floor((ckt - 1) / 2) % seq.length];
}

// Same-side continuation slots claimed by a multi-pole anchor.
function claimedSlots(anchorCkt: number, poles: number): number[] {
  const out: number[] = [];
  for (let k = 1; k < poles; k++) out.push(anchorCkt + 2 * k);
  return out;
}

export function PanelEditor({ panel, libraryEntries, role, canManage }: PanelEditorProps) {
  const apiBase = `/api/jobs/${panel.job.id}/panel-schedules/${panel.id}`;

  const [circuits, setCircuits] = useState<Circuit[]>(panel.circuits);
  const [library, setLibrary] = useState<LibraryEntry[]>(libraryEntries);
  const [lastSyncMs, setLastSyncMs] = useState<number>(Date.now());
  const [nowMs, setNowMs] = useState<number>(Date.now());

  // Edit sheet state
  const [editCkt, setEditCkt] = useState<number | null>(null);
  const [eStatus, setEStatus] = useState("OPEN");
  const [eDesc, setEDesc] = useState("");
  const [ePoles, setEPoles] = useState(1);
  const [eAmps, setEAmps] = useState<string>("20");
  const [eFlags, setEFlags] = useState<string[]>([]);
  const [libSearch, setLibSearch] = useState("");
  const [libEntryId, setLibEntryId] = useState<string | null>(null);
  const [savedToLib, setSavedToLib] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const sheetOpenRef = useRef(false);
  sheetOpenRef.current = editCkt !== null;

  const [specOpen, setSpecOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [customW, setCustomW] = useState("6");
  const [customH, setCustomH] = useState("9");

  const canManageLib = role === "ADMIN" || role === "OFFICE";

  useEffect(() => {
    try {
      const saved = localStorage.getItem("panel_custom_sleeve");
      if (saved) {
        const { w, h } = JSON.parse(saved);
        if (w) setCustomW(String(w));
        if (h) setCustomH(String(h));
      }
    } catch {
      /* ignore */
    }
  }, []);

  function openPdf(sleeve: "6x9" | "7x7") {
    window.open(`${apiBase}/pdf?sleeve=${sleeve}`, "_blank", "noopener,noreferrer");
    setPrintOpen(false);
  }

  function openCustomPdf() {
    const w = parseFloat(customW);
    const h = parseFloat(customH);
    if (!(w >= 4 && w <= 12 && h >= 4 && h <= 12)) {
      alert("Width and height must be between 4 and 12 inches.");
      return;
    }
    try {
      localStorage.setItem("panel_custom_sleeve", JSON.stringify({ w: customW, h: customH }));
    } catch {
      /* ignore */
    }
    window.open(`${apiBase}/pdf?w=${w}&h=${h}`, "_blank", "noopener,noreferrer");
    setPrintOpen(false);
    setCustomMode(false);
  }

  async function deleteLibraryEntry(entry: LibraryEntry) {
    if (!confirm(`Delete '${entry.label}' from the library for everyone?`)) return;
    const res = await fetch(`/api/circuit-library/${entry.id}`, { method: "DELETE" });
    if (res.ok) setLibrary((prev) => prev.filter((e) => e.id !== entry.id));
  }

  const refetch = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/circuits`);
      if (!res.ok) return;
      const data = (await res.json()) as Circuit[];
      setCircuits(data);
      setLastSyncMs(Date.now());
    } catch {
      /* offline — keep local */
    }
  }, [apiBase]);

  // Poll every 10s, but never while an edit sheet is open.
  useEffect(() => {
    const interval = setInterval(() => {
      if (!sheetOpenRef.current) refetch();
    }, 10000);
    return () => clearInterval(interval);
  }, [refetch]);

  // Tick for the "updated Xs ago" label.
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  const byCkt = new Map(circuits.map((c) => [c.ckt, c]));
  const contMap = new Map<number, Circuit>(); // continuation ckt -> anchor
  for (const c of circuits) {
    if (c.poles > 1) for (const slot of claimedSlots(c.ckt, c.poles)) contMap.set(slot, c);
  }

  const left = circuits.filter((c) => c.ckt % 2 === 1).sort((a, b) => a.ckt - b.ckt);
  const right = circuits.filter((c) => c.ckt % 2 === 0).sort((a, b) => a.ckt - b.ckt);

  function openEditor(ckt: number) {
    // Continuation rows edit their anchor.
    const anchor = contMap.get(ckt);
    const target = anchor ?? byCkt.get(ckt);
    if (!target) return;
    setEditCkt(target.ckt);
    setEStatus(target.status);
    setEDesc(target.description ?? "");
    setEPoles(target.poles);
    setEAmps(target.amps != null ? String(target.amps) : "");
    setEFlags(target.flags ?? []);
    setLibSearch("");
    setLibEntryId(null);
    setSavedToLib(false);
    setSheetError(null);
  }

  function closeSheet() {
    setEditCkt(null);
    refetch();
  }

  function applyLibrary(entry: LibraryEntry) {
    setEStatus(entry.defaultStatus);
    setEDesc(entry.label);
    setEPoles(entry.defaultPoles);
    setEAmps(entry.defaultAmps != null ? String(entry.defaultAmps) : "");
    setEFlags(entry.defaultFlags ?? []);
    setLibEntryId(entry.id);
    setLibSearch("");
  }

  function toggleFlag(f: string) {
    setEFlags((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  }

  async function saveCircuit() {
    if (editCkt == null) return;
    const target = byCkt.get(editCkt);
    if (!target) return;
    setSaving(true);
    setSheetError(null);
    try {
      const res = await fetch(`${apiBase}/circuits/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: eStatus,
          description: eDesc,
          poles: ePoles,
          amps: eAmps === "" ? null : Number(eAmps),
          flags: eFlags,
          libraryEntryId: libEntryId,
        }),
      });
      if (!res.ok) {
        let msg = "Failed to save circuit.";
        try {
          const d = await res.json();
          if (d?.error) msg = d.error;
        } catch {
          const t = await res.text().catch(() => "");
          if (t) msg = t;
        }
        setSheetError(msg);
        setSaving(false);
        return;
      }
      setSaving(false);
      closeSheet();
    } catch {
      setSheetError("Failed to save circuit.");
      setSaving(false);
    }
  }

  async function saveToLibrary() {
    const label = eDesc.trim().toUpperCase();
    if (!label) return;
    try {
      const res = await fetch(`/api/circuit-library`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          defaultPoles: ePoles,
          defaultAmps: eAmps === "" ? 20 : Number(eAmps),
          defaultFlags: eFlags,
          defaultStatus: eStatus,
        }),
      });
      if (res.ok) {
        const { entry } = await res.json();
        setLibrary((prev) => [...prev, entry]);
      }
      // 409 (already exists) is fine — treat as success.
      setSavedToLib(true);
      setTimeout(() => setSavedToLib(false), 2000);
    } catch {
      /* silent */
    }
  }

  // Library list for the sheet: filter by label+tags, or top 8 by useCount when empty.
  const libFiltered = (() => {
    const q = libSearch.trim().toLowerCase();
    if (!q) return library.slice(0, 8);
    return library.filter(
      (e) => e.label.toLowerCase().includes(q) || e.tags.some((t) => t.toLowerCase().includes(q))
    );
  })();

  const secondsAgo = Math.max(0, Math.floor((nowMs - lastSyncMs) / 1000));
  const updatedLabel = secondsAgo < 5 ? "just now" : secondsAgo < 60 ? `${secondsAgo}s ago` : `${Math.floor(secondsAgo / 60)}m ago`;

  const specSummary = `${panel.system} · ${panel.busAmps}A Bus · ${panel.mainType === "MB" ? (panel.mainAmps ? `${panel.mainAmps}A MB` : "MB") : "MLO"}`;
  const jobAddress = [panel.job.address, panel.job.city, panel.job.state, panel.job.zip].filter(Boolean).join(", ");

  // Multi-pole claim hint for the sheet.
  const claimHint =
    ePoles > 1 && editCkt != null ? claimedSlots(editCkt, ePoles).filter((s) => s <= panel.circuitCount) : [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <a href={`/jobs/${panel.job.id}?tab=panels`} className="text-xs text-gray-400 hover:text-gray-600">
                ← {panel.job.jobName}
              </a>
              <h1 className="text-2xl font-bold text-[#1e3a8a] leading-tight">{panel.name}</h1>
              <p className="text-xs text-gray-600 mt-0.5">{specSummary}</p>
              {jobAddress && <p className="text-[11px] text-gray-400">{jobAddress}</p>}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    onClick={() => setPrintOpen((v) => !v)}
                    className="px-3 py-1.5 text-xs font-semibold bg-[#1e3a8a] text-white rounded-lg hover:bg-blue-800"
                  >
                    ↓ PDF
                  </button>
                  {printOpen && (
                    <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden min-w-[160px]">
                      <button onClick={() => openPdf("6x9")} className="block w-full text-left px-4 py-2 text-xs hover:bg-gray-50 whitespace-nowrap">6×9 sleeve</button>
                      <button onClick={() => openPdf("7x7")} className="block w-full text-left px-4 py-2 text-xs hover:bg-gray-50 whitespace-nowrap border-t border-gray-100">7×7 sleeve</button>
                      <button onClick={() => setCustomMode((v) => !v)} className="block w-full text-left px-4 py-2 text-xs hover:bg-gray-50 whitespace-nowrap border-t border-gray-100">Custom…</button>
                      {customMode && (
                        <div className="px-3 py-2 border-t border-gray-100 space-y-2">
                          <div className="flex items-center gap-1">
                            <input type="number" step="0.5" value={customW} onChange={(e) => setCustomW(e.target.value)}
                              className="w-14 border border-gray-300 rounded px-1.5 py-1 text-xs" />
                            <span className="text-xs text-gray-400">in ×</span>
                            <input type="number" step="0.5" value={customH} onChange={(e) => setCustomH(e.target.value)}
                              className="w-14 border border-gray-300 rounded px-1.5 py-1 text-xs" />
                            <span className="text-xs text-gray-400">in</span>
                          </div>
                          <button onClick={openCustomPdf} className="w-full bg-[#1e3a8a] text-white rounded px-2 py-1 text-xs font-semibold hover:bg-blue-800">Generate</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {canManage && (
                  <button
                    onClick={() => setSpecOpen(true)}
                    className="px-3 py-1.5 text-xs font-semibold border border-[#1e3a8a] text-[#1e3a8a] rounded-lg hover:bg-blue-50"
                  >
                    Edit specs
                  </button>
                )}
              </div>
              <span className="text-[11px] text-gray-400">Updated {updatedLabel}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Circuit grid — two columns matching the physical panel */}
      <div className="max-w-3xl mx-auto px-2 sm:px-4 py-4">
        <div className="grid grid-cols-2 gap-2">
          <CircuitColumn side="ODD" rows={left} phases={panel.phases} contMap={contMap} onTap={openEditor} />
          <CircuitColumn side="EVEN" rows={right} phases={panel.phases} contMap={contMap} onTap={openEditor} />
        </div>
      </div>

      {/* Edit sheet */}
      {editCkt != null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-5 py-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">
                Circuit {editCkt} <span className="text-xs font-normal text-gray-400">· Phase {phaseLetter(editCkt, panel.phases)}</span>
              </h2>
              <button onClick={() => setEditCkt(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            <div className="p-5 space-y-4">
              {sheetError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">{sheetError}</p>}

              {/* Library search */}
              <div>
                <input
                  value={libSearch}
                  onChange={(e) => setLibSearch(e.target.value)}
                  placeholder="Search library…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
                />
                {libFiltered.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {libFiltered.map((e) => (
                      <span
                        key={e.id}
                        className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 overflow-hidden"
                      >
                        <button
                          onClick={() => applyLibrary(e)}
                          className="text-xs pl-2 pr-1.5 py-1 hover:bg-blue-50 text-gray-700"
                        >
                          {e.label}
                        </button>
                        {canManageLib && (
                          <button
                            onClick={() => deleteLibraryEntry(e)}
                            title="Delete from library"
                            className="pr-2 pl-0.5 py-1 text-gray-300 hover:text-red-500 text-xs"
                          >
                            🗑
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Status segmented */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Status</label>
                <div className="flex flex-wrap gap-1">
                  {STATUSES.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => {
                        setEStatus(s.value);
                        if (s.value === "DEVICE" && !eDesc.trim()) setEDesc("SURGE PROTECTION DEVICE");
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                        eStatus === s.value ? "bg-[#1e3a8a] text-white border-[#1e3a8a]" : "border-gray-300 text-gray-600"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description (hidden for OPEN/SPACE) */}
              {eStatus !== "OPEN" && eStatus !== "SPACE" && (
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Description</label>
                  <div className="flex gap-2">
                    <input
                      value={eDesc}
                      onChange={(e) => { setEDesc(e.target.value); setLibEntryId(null); }}
                      placeholder="e.g. OFFICE RECEPTACLES"
                      autoFocus={eStatus === "ASSIGNED"}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
                    />
                    {eDesc.trim() && (
                      <button
                        onClick={saveToLibrary}
                        title="Save to library"
                        className={`px-2 rounded-lg border text-sm ${savedToLib ? "border-green-400 text-green-600 bg-green-50" : "border-gray-300 text-gray-500 hover:border-[#1e3a8a] hover:text-[#1e3a8a]"}`}
                      >
                        {savedToLib ? "✓" : "🔖"}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Poles + amps */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Poles</label>
                  <div className="flex gap-1">
                    {[1, 2, 3].map((p) => (
                      <button
                        key={p}
                        onClick={() => setEPoles(p)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border ${ePoles === p ? "bg-[#1e3a8a] text-white border-[#1e3a8a]" : "border-gray-300 text-gray-600"}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                {eStatus !== "SPACE" && eStatus !== "DEVICE" && (
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Amps</label>
                    <input
                      type="number"
                      value={eAmps}
                      onChange={(e) => setEAmps(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
                    />
                  </div>
                )}
              </div>

              {eStatus !== "SPACE" && eStatus !== "DEVICE" && (
                <div className="flex flex-wrap gap-1">
                  {AMP_QUICK.map((a) => (
                    <button
                      key={a}
                      onClick={() => setEAmps(String(a))}
                      className={`px-2.5 py-1 rounded-lg text-xs border ${eAmps === String(a) ? "bg-[#1e3a8a] text-white border-[#1e3a8a]" : "border-gray-300 text-gray-600"}`}
                    >
                      {a}A
                    </button>
                  ))}
                </div>
              )}

              {claimHint.length > 0 && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                  Will claim circuit{claimHint.length > 1 ? "s" : ""} {claimHint.join(", ")}
                </p>
              )}

              {/* Flags */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Flags</label>
                <div className="flex gap-1.5">
                  {FLAG_OPTS.map((f) => (
                    <button
                      key={f}
                      onClick={() => toggleFlag(f)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${eFlags.includes(f) ? "bg-[#FF5910] text-white border-[#FF5910]" : "border-gray-300 text-gray-600"}`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t px-5 py-3 flex gap-3">
              <button onClick={() => setEditCkt(null)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={saveCircuit} disabled={saving} className="flex-1 px-4 py-2 bg-[#1e3a8a] text-white rounded-lg text-sm font-semibold hover:bg-blue-800 disabled:opacity-50">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Spec edit sheet */}
      {specOpen && <SpecEditor panel={panel} apiBase={apiBase} onClose={() => setSpecOpen(false)} />}
    </div>
  );
}

// ── Circuit column ────────────────────────────────────────────────────────────
function CircuitColumn({
  side,
  rows,
  phases,
  contMap,
  onTap,
}: {
  side: "ODD" | "EVEN";
  rows: Circuit[];
  phases: number;
  contMap: Map<number, Circuit>;
  onTap: (ckt: number) => void;
}) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      <div className="bg-[#1e3a8a] text-white text-[10px] font-bold uppercase tracking-wide px-2 py-1 text-center">
        {side === "ODD" ? "Odd (Left)" : "Even (Right)"}
      </div>
      {rows.map((c) => {
        const anchor = contMap.get(c.ckt);
        const isCont = !!anchor;
        const phase = phaseLetter(c.ckt, phases);
        return (
          <button
            key={c.id}
            onClick={() => onTap(c.ckt)}
            className={`w-full flex items-center gap-1.5 px-2 py-1.5 border-b last:border-b-0 border-gray-100 text-left ${isCont ? "bg-gray-50" : "hover:bg-blue-50"}`}
          >
            <span className="text-xs font-bold text-gray-900 w-5 shrink-0 tabular-nums">{c.ckt}</span>
            <span className="text-[10px] text-gray-400 w-8 shrink-0 tabular-nums">
              {isCont ? "—" : c.poles > 1 ? `${c.poles}P·${c.amps ?? ""}` : c.amps != null ? `${c.amps}A` : ""}
            </span>
            <span className="flex-1 min-w-0 text-[11px] truncate">
              {isCont ? (
                <span className="text-gray-400 italic truncate">{anchor?.description ?? ""}</span>
              ) : c.status === "SPARE" ? (
                <span className="text-gray-400 italic">SPARE</span>
              ) : c.status === "SPACE" ? (
                <span className="text-gray-300">SPACE</span>
              ) : c.status === "OPEN" ? (
                <span className="text-gray-300">—</span>
              ) : (
                <span className="text-gray-900 uppercase truncate">{c.description}</span>
              )}
            </span>
            {c.flags.map((f) => (
              <span key={f} className="text-[8px] font-bold text-[#FF5910] bg-orange-50 rounded px-1 shrink-0">{f}</span>
            ))}
            <span className="text-[9px] text-gray-300 w-2 shrink-0">{phase}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Spec editor sheet ─────────────────────────────────────────────────────────
function SpecEditor({
  panel,
  apiBase,
  onClose,
}: {
  panel: PanelEditorProps["panel"];
  apiBase: string;
  onClose: () => void;
}) {
  const [name, setName] = useState(panel.name);
  const [system, setSystem] = useState(panel.system);
  const [busAmps, setBusAmps] = useState(String(panel.busAmps));
  const [mainType, setMainType] = useState(panel.mainType);
  const [mainAmps, setMainAmps] = useState(panel.mainAmps != null ? String(panel.mainAmps) : "");
  const [fedAmps, setFedAmps] = useState(panel.fedAmps != null ? String(panel.fedAmps) : "");
  const [circuitCount, setCircuitCount] = useState(String(panel.circuitCount));
  const [breakerType, setBreakerType] = useState(panel.breakerType ?? "");
  const [catalogNumber, setCatalogNumber] = useState(panel.catalogNumber ?? "");
  const [fedFrom, setFedFrom] = useState(panel.fedFrom ?? "");
  const [location, setLocation] = useState(panel.location ?? "");
  const [afc, setAfc] = useState(panel.afc ?? "");
  const [aicRating, setAicRating] = useState(panel.aicRating ?? "");
  const [enclosure, setEnclosure] = useState(panel.enclosure ?? "");
  const [integralTVSS, setIntegralTVSS] = useState(panel.integralTVSS);
  const [notes, setNotes] = useState(panel.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    // Fed-amps must be below the protective rating.
    const fa = fedAmps === "" ? null : Number(fedAmps);
    if (fa != null) {
      if (mainType === "MB") {
        const ma = mainAmps === "" ? null : Number(mainAmps);
        if (ma != null && fa >= ma) { setError("Fed amps must be less than the main breaker rating"); return; }
      } else if (fa >= Number(busAmps)) {
        setError("Fed amps must be less than the bus rating");
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(apiBase, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, system, busAmps: Number(busAmps), mainType,
          mainAmps: mainType === "MB" ? (mainAmps === "" ? null : Number(mainAmps)) : null,
          fedAmps: fedAmps === "" ? null : Number(fedAmps),
          circuitCount: Number(circuitCount),
          breakerType, catalogNumber, fedFrom, location, afc, aicRating, enclosure, integralTVSS, notes,
        }),
      });
      if (!res.ok) {
        let msg = "Failed to save specs.";
        try { const d = await res.json(); if (d?.error) msg = d.error; }
        catch { const t = await res.text().catch(() => ""); if (t) msg = t; }
        setError(msg);
        setSaving(false);
        return;
      }
      window.location.reload();
    } catch {
      setError("Failed to save specs.");
      setSaving(false);
    }
  }

  const input = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]";
  const lbl = "text-xs font-medium text-gray-600 block mb-1";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-5 py-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">Edit Panel Specs</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-3">
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">{error}</p>}
          <div><label className={lbl}>Name</label><input value={name} onChange={(e) => setName(e.target.value)} className={input} /></div>
          <div><label className={lbl}>Voltage System</label>
            <select value={system} onChange={(e) => setSystem(e.target.value)} className={input}>
              {SYSTEMS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Bus Amps</label><input type="number" value={busAmps} onChange={(e) => setBusAmps(e.target.value)} className={input} /></div>
            <div><label className={lbl}>Main</label>
              <div className="flex gap-1">
                {["MLO", "MB"].map((mt) => (
                  <button key={mt} type="button" onClick={() => { setMainType(mt); if (mt === "MLO") setMainAmps(""); }}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border ${mainType === mt ? "bg-[#1e3a8a] text-white border-[#1e3a8a]" : "border-gray-300 text-gray-600"}`}>{mt}</button>
                ))}
              </div>
            </div>
          </div>
          {mainType === "MB" && (
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Main Amps</label><input type="number" value={mainAmps} onChange={(e) => setMainAmps(e.target.value)} className={input} /></div>
              <div><label className={lbl}>Fed @ Amps</label><input type="number" value={fedAmps} onChange={(e) => setFedAmps(e.target.value)} className={input} /></div>
            </div>
          )}
          <div><label className={lbl}>Circuit Count <span className="text-gray-400">(even, 12–84)</span></label><input type="number" value={circuitCount} onChange={(e) => setCircuitCount(e.target.value)} className={input} /></div>
          <div><label className={lbl}>Breaker Type</label><input value={breakerType} onChange={(e) => setBreakerType(e.target.value)} className={input} /></div>
          <div><label className={lbl}>Catalog #</label><input value={catalogNumber} onChange={(e) => setCatalogNumber(e.target.value)} className={input} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Fed From</label><input value={fedFrom} onChange={(e) => setFedFrom(e.target.value)} className={input} /></div>
            <div><label className={lbl}>Location</label><input value={location} onChange={(e) => setLocation(e.target.value)} className={input} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>AFC</label><input value={afc} onChange={(e) => setAfc(e.target.value)} className={input} /></div>
            <div><label className={lbl}>AIC Rating</label><input value={aicRating} onChange={(e) => setAicRating(e.target.value)} className={input} /></div>
          </div>
          <div><label className={lbl}>Enclosure</label>
            <select value={enclosure} onChange={(e) => setEnclosure(e.target.value)} className={input}>
              <option value="">None</option><option value="NEMA 1">NEMA 1</option><option value="NEMA 3R">NEMA 3R</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={integralTVSS} onChange={(e) => setIntegralTVSS(e.target.checked)} className="w-4 h-4 accent-[#1e3a8a]" />
            Integral TVSS
          </label>
          <div><label className={lbl}>Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${input} resize-none`} /></div>
        </div>
        <div className="sticky bottom-0 bg-white border-t px-5 py-3 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 px-4 py-2 bg-[#1e3a8a] text-white rounded-lg text-sm font-semibold hover:bg-blue-800 disabled:opacity-50">
            {saving ? "Saving…" : "Save Specs"}
          </button>
        </div>
      </div>
    </div>
  );
}
