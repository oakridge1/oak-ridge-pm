"use client";

import { useState } from "react";
import { LayoutGrid } from "lucide-react";

interface PanelSummary {
  id: string;
  name: string;
  panelType: string;
  system: string;
  busAmps: number;
  mainType: string;
  mainAmps: number | null;
  circuitCount: number;
  updatedAt: Date | string;
  _count: { circuits: number };
}

interface PanelsTabProps {
  job: {
    id: string;
    jobName: string;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
  };
  panels: PanelSummary[];
  role: string;
  canManage: boolean;
}

const PANEL_TYPES: { value: string; label: string }[] = [
  { value: "MDP", label: "MDP" },
  { value: "MB_PANELBOARD", label: "Main Breaker Panelboard" },
  { value: "MLO_PANELBOARD", label: "MLO Panelboard" },
  { value: "LOAD_CENTER", label: "Load Center" },
];

const SYSTEMS = ["120/208V 3PH 4W", "277/480V 3PH 4W", "120/240V 1PH 3W", "120/208V 1PH 3W"];

const BREAKER_SUGGESTIONS = ["Square D QO Bolt-On", "Square D NF Bolt-On", "Square D QO Plug-On"];

// Selecting a panel type pre-fills these starting points; all stay editable.
const PANEL_TYPE_DEFAULTS: Record<
  string,
  { system: string; circuitCount: number; mainType: string; breakerType: string; busAmps: number; mainAmps: number }
> = {
  LOAD_CENTER:    { system: "120/240V 1PH 3W", circuitCount: 30, mainType: "MB",  breakerType: "Square D QO Plug-On", busAmps: 200, mainAmps: 200 },
  MDP:            { system: "120/208V 3PH 4W", circuitCount: 42, mainType: "MLO", breakerType: "Square D QO Bolt-On", busAmps: 400, mainAmps: 400 },
  MB_PANELBOARD:  { system: "120/208V 3PH 4W", circuitCount: 42, mainType: "MB",  breakerType: "Square D NF Bolt-On", busAmps: 225, mainAmps: 225 },
  MLO_PANELBOARD: { system: "120/208V 3PH 4W", circuitCount: 42, mainType: "MLO", breakerType: "Square D NF Bolt-On", busAmps: 225, mainAmps: 225 },
};

const CKT_CHOICES = ["30", "42", "54", "60", "custom"];

function shortSystem(system: string): string {
  return system.replace("3PH 4W", "3Ø").replace("1PH 3W", "1Ø").replace("3PH", "3Ø").replace("1PH", "1Ø");
}

function relTime(d: Date | string): string {
  const diff = Date.now() - new Date(d).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(d).toLocaleDateString();
}

export function PanelsTab({ job, panels, canManage }: PanelsTabProps) {
  const canCreate = canManage;
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);

  // Core fields
  const [panelType, setPanelType] = useState("");
  const [name, setName] = useState("");
  const [system, setSystem] = useState(SYSTEMS[0]);
  const [busAmps, setBusAmps] = useState("225");
  const [mainType, setMainType] = useState("MLO");
  const [mainAmps, setMainAmps] = useState("");
  const [fedAmps, setFedAmps] = useState("");
  const [cktChoice, setCktChoice] = useState("42");
  const [customCkt, setCustomCkt] = useState("42");
  const [breakerType, setBreakerType] = useState("");
  const [catalogNumber, setCatalogNumber] = useState("");
  // More options
  const [fedFrom, setFedFrom] = useState("");
  const [location, setLocation] = useState("");
  const [afc, setAfc] = useState("");
  const [aicRating, setAicRating] = useState("");
  const [enclosure, setEnclosure] = useState("");
  const [integralTVSS, setIntegralTVSS] = useState(false);
  const [notes, setNotes] = useState("");

  const jobAddress = [job.address, job.city, job.state, job.zip].filter(Boolean).join(", ");

  function applyTypeDefaults(type: string) {
    setPanelType(type);
    const d = PANEL_TYPE_DEFAULTS[type];
    if (!d) return;
    setSystem(d.system);
    setBusAmps(String(d.busAmps));
    setMainType(d.mainType);
    setMainAmps(d.mainType === "MB" ? String(d.mainAmps) : "");
    setBreakerType(d.breakerType);
    const choice = CKT_CHOICES.includes(String(d.circuitCount)) ? String(d.circuitCount) : "custom";
    setCktChoice(choice);
    setCustomCkt(String(d.circuitCount));
  }

  const effectiveCkt = cktChoice === "custom" ? Number(customCkt) : Number(cktChoice);

  function resetForm() {
    setPanelType("");
    setName("");
    setSystem(SYSTEMS[0]);
    setBusAmps("225");
    setMainType("MLO");
    setMainAmps("");
    setFedAmps("");
    setCktChoice("42");
    setCustomCkt("42");
    setBreakerType("");
    setCatalogNumber("");
    setFedFrom("");
    setLocation("");
    setAfc("");
    setAicRating("");
    setEnclosure("");
    setIntegralTVSS(false);
    setNotes("");
    setShowMore(false);
    setError(null);
  }

  async function handleCreate() {
    setError(null);
    if (!panelType) { setError("Pick a panel type."); return; }
    if (!name.trim()) { setError("Panel name is required."); return; }
    if (!Number.isInteger(effectiveCkt) || effectiveCkt % 2 !== 0 || effectiveCkt < 12 || effectiveCkt > 84) {
      setError("Circuit count must be an even number between 12 and 84.");
      return;
    }
    const fa = fedAmps ? Number(fedAmps) : null;
    if (fa != null) {
      if (mainType === "MB") {
        const ma = mainAmps ? Number(mainAmps) : null;
        if (ma != null && fa >= ma) { setError("Fed amps must be less than the main breaker rating."); return; }
      } else if (fa >= Number(busAmps)) {
        setError("Fed amps must be less than the bus rating.");
        return;
      }
    }
    setCreating(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}/panel-schedules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          panelType,
          system,
          busAmps: Number(busAmps),
          mainType,
          mainAmps: mainType === "MB" ? Number(mainAmps) || null : null,
          fedAmps: fedAmps ? Number(fedAmps) : null,
          circuitCount: effectiveCkt,
          breakerType,
          catalogNumber,
          fedFrom,
          location,
          afc,
          aicRating,
          enclosure,
          integralTVSS,
          notes,
        }),
      });
      if (!res.ok) {
        let msg = "Failed to create panel.";
        try {
          const data = await res.json();
          if (data?.error) msg = data.error;
        } catch {
          const text = await res.text().catch(() => "");
          if (text) msg = text;
        }
        setError(msg);
        setCreating(false);
        return;
      }
      const { panelId } = await res.json();
      window.location.href = `/jobs/${job.id}/panels/${panelId}`;
    } catch {
      setError("Failed to create panel.");
      setCreating(false);
    }
  }

  return (
    <div className="p-4 sm:p-5 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-gray-900">Panels</h2>
          <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 font-medium">{panels.length}</span>
        </div>
        {canCreate && (
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="px-3 py-1.5 text-sm font-semibold bg-[#1e3a8a] text-white rounded-lg hover:bg-blue-800 transition-colors"
          >
            + New Panel
          </button>
        )}
      </div>

      {/* Empty / grid */}
      {panels.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center border border-dashed border-gray-200 rounded-xl py-12 px-6">
          <LayoutGrid className="w-8 h-8 text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-900">No panels yet</p>
          <p className="text-xs text-gray-500 mt-1 max-w-xs">
            Build panel schedules with a full circuit directory, editable in the field.
          </p>
          {canCreate && (
            <button
              onClick={() => { resetForm(); setShowModal(true); }}
              className="mt-4 px-3 py-1.5 text-sm font-semibold bg-[#1e3a8a] text-white rounded-lg hover:bg-blue-800 transition-colors"
            >
              + New Panel
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {panels.map((p) => (
            <a
              key={p.id}
              href={`/jobs/${job.id}/panels/${p.id}`}
              className="block border border-gray-200 rounded-xl p-4 hover:shadow-md hover:border-[#1e3a8a]/30 transition-all bg-white"
            >
              <div className="flex items-start justify-between mb-1">
                <span className="text-2xl font-bold text-[#1e3a8a] leading-none">{p.name}</span>
                <span className="text-xs text-gray-400">{relTime(p.updatedAt)}</span>
              </div>
              <p className="text-xs text-gray-600 mt-1.5">
                {shortSystem(p.system)} · {p.busAmps}A {p.mainType === "MB" ? (p.mainAmps ? `${p.mainAmps}A MB` : "MB") : "MLO"}
              </p>
              <p className="text-xs text-gray-400 mt-1">{p.circuitCount} circuits</p>
            </a>
          ))}
        </div>
      )}

      {/* Create modal — bottom sheet on mobile, centered on desktop */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-5 py-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">New Panel</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            <div className="p-5 space-y-4">
              {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">{error}</p>}

              {/* 1. Panel type first */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Panel Type <span className="text-red-500">*</span></label>
                <select
                  value={panelType}
                  onChange={(e) => applyTypeDefaults(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
                >
                  <option value="">Select a panel type…</option>
                  {PANEL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <p className="text-[11px] text-gray-400 mt-1">Sets sensible defaults below — all still editable.</p>
              </div>

              {/* Name */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Panel Name <span className="text-red-500">*</span></label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. PP1, LP1, MDP"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
                  autoFocus
                />
              </div>

              {/* Voltage system */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Voltage System</label>
                <select
                  value={system}
                  onChange={(e) => setSystem(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
                >
                  {SYSTEMS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Bus + main */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Bus Amps</label>
                  <input type="number" value={busAmps} onChange={(e) => setBusAmps(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Main</label>
                  <div className="flex gap-1">
                    {["MLO", "MB"].map((mt) => (
                      <button
                        key={mt}
                        type="button"
                        onClick={() => { setMainType(mt); if (mt === "MLO") setMainAmps(""); }}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border ${mainType === mt ? "bg-[#1e3a8a] text-white border-[#1e3a8a]" : "border-gray-300 text-gray-600"}`}
                      >
                        {mt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {mainType === "MB" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Main Amps</label>
                    <input type="number" value={mainAmps} onChange={(e) => setMainAmps(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Fed @ Amps <span className="text-gray-400">(optional)</span></label>
                    <input type="number" value={fedAmps} onChange={(e) => setFedAmps(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]" />
                  </div>
                </div>
              )}

              {/* Circuit count */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Circuit Count</label>
                <div className="flex gap-1 flex-wrap">
                  {CKT_CHOICES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCktChoice(c)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${cktChoice === c ? "bg-[#1e3a8a] text-white border-[#1e3a8a]" : "border-gray-300 text-gray-600"}`}
                    >
                      {c === "custom" ? "Custom" : c}
                    </button>
                  ))}
                </div>
                {cktChoice === "custom" && (
                  <input type="number" value={customCkt} onChange={(e) => setCustomCkt(e.target.value)}
                    placeholder="Even, 12–84"
                    className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]" />
                )}
              </div>

              {/* Breaker type + catalog */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Breaker Type</label>
                <input
                  value={breakerType}
                  onChange={(e) => setBreakerType(e.target.value)}
                  list="breaker-suggestions"
                  placeholder="e.g. Square D QO Bolt-On"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
                />
                <datalist id="breaker-suggestions">
                  {BREAKER_SUGGESTIONS.map((b) => <option key={b} value={b} />)}
                </datalist>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Catalog #</label>
                <input value={catalogNumber} onChange={(e) => setCatalogNumber(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]" />
              </div>

              {/* Job address (read-only, comes along for PDF) */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Job Address</label>
                <input value={jobAddress || "—"} readOnly
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500" />
              </div>

              {/* More options */}
              <button
                type="button"
                onClick={() => setShowMore((v) => !v)}
                className="text-xs font-medium text-[#1e3a8a] hover:underline"
              >
                {showMore ? "− Hide options" : "+ More options"}
              </button>

              {showMore && (
                <div className="space-y-3 border-t pt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Fed From</label>
                      <input value={fedFrom} onChange={(e) => setFedFrom(e.target.value)} placeholder="e.g. MDP-1"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Location</label>
                      <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Electric Room 101"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">AFC</label>
                      <input value={afc} onChange={(e) => setAfc(e.target.value)} placeholder="e.g. 22,410A"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">AIC Rating</label>
                      <input value={aicRating} onChange={(e) => setAicRating(e.target.value)} placeholder="e.g. 22kA"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Enclosure</label>
                    <select value={enclosure} onChange={(e) => setEnclosure(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]">
                      <option value="">None</option>
                      <option value="NEMA 1">NEMA 1</option>
                      <option value="NEMA 3R">NEMA 3R</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={integralTVSS} onChange={(e) => setIntegralTVSS(e.target.checked)}
                      className="w-4 h-4 accent-[#1e3a8a]" />
                    Integral TVSS
                  </label>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Notes</label>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]" />
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-white border-t px-5 py-3 flex gap-3">
              <button onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={handleCreate} disabled={creating}
                className="flex-1 px-4 py-2 bg-[#1e3a8a] text-white rounded-lg text-sm font-semibold hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed">
                {creating ? "Creating…" : "Create Panel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
