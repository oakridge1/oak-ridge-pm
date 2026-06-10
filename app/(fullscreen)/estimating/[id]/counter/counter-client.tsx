"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type CounterAreaRow = {
  id: string;
  estimateId: string;
  name: string;
  counts: Record<string, number>;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type ItemType = "count" | "footage" | "custom";

type CounterItemDef = {
  key: string;
  label: string;
  type: ItemType;
  category: string;
};

interface Props {
  estimate: { id: string; estimateNumber: string; name: string };
  initialAreas: CounterAreaRow[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Item definitions
// ─────────────────────────────────────────────────────────────────────────────

const COUNTER_ITEMS: CounterItemDef[] = [
  // ── Devices ──
  { key: "recept_20a",    label: "20A Receptacle",          type: "count",   category: "Devices" },
  { key: "recept_15a_tr", label: "15A TR Receptacle",       type: "count",   category: "Devices" },
  { key: "gfci_20a",      label: "20A GFCI",                type: "count",   category: "Devices" },
  { key: "gfci_15a_tr",   label: "15A TR GFCI",             type: "count",   category: "Devices" },
  { key: "switch_sp",     label: "Single Pole Switch",      type: "count",   category: "Devices" },
  { key: "switch_3way",   label: "3-Way Switch",            type: "footage", category: "Devices" },
  { key: "dimmer",        label: "Dimmer",                  type: "count",   category: "Devices" },
  { key: "dimmer_010v",   label: "0-10V Dimmer",            type: "count",   category: "Devices" },
  { key: "occ_sensor",    label: "Occupancy Sensor",        type: "count",   category: "Devices" },
  { key: "wp_cover",      label: "WP In-Use Cover",         type: "count",   category: "Devices" },
  // ── Fixtures ──
  { key: "fixture_2x4",      label: "2×4 LED Lay-In T-Bar", type: "count",   category: "Fixtures" },
  { key: "fixture_2x2",      label: "2×2 LED Lay-In T-Bar", type: "count",   category: "Fixtures" },
  { key: "fixture_strip",    label: "4ft Strip Light",       type: "count",   category: "Fixtures" },
  { key: "fixture_wallpack", label: "Wall Pack",             type: "count",   category: "Fixtures" },
  { key: "fixture_exit_ebu", label: "Exit / Emergency EBU",  type: "count",   category: "Fixtures" },
  { key: "fixture_highbay",  label: "High Bay",              type: "count",   category: "Fixtures" },
  { key: "fixture_ceilfan",  label: "Ceiling Fan",           type: "count",   category: "Fixtures" },
  { key: "fixture_custom",   label: "Custom Fixture",        type: "custom",  category: "Fixtures" },
  // ── Data ──
  { key: "data_1port", label: "1-Port Data Location", type: "count", category: "Data" },
  { key: "data_2port", label: "2-Port Data Location", type: "count", category: "Data" },
  { key: "data_3port", label: "3-Port Data Location", type: "count", category: "Data" },
  { key: "data_4port", label: "4-Port Data Location", type: "count", category: "Data" },
  // ── Conduit ──
  { key: "conduit_emt_12",  label: "1/2\" EMT",          type: "footage", category: "Conduit" },
  { key: "conduit_emt_34",  label: "3/4\" EMT",          type: "footage", category: "Conduit" },
  { key: "conduit_emt_1",   label: "1\" EMT",            type: "footage", category: "Conduit" },
  { key: "conduit_emt_114", label: "1-1/4\" EMT",        type: "footage", category: "Conduit" },
  { key: "conduit_emt_112", label: "1-1/2\" EMT",        type: "footage", category: "Conduit" },
  { key: "conduit_emt_2",   label: "2\" EMT",            type: "footage", category: "Conduit" },
  { key: "conduit_pvc_12",  label: "1/2\" Sch40 PVC",   type: "footage", category: "Conduit" },
  { key: "conduit_pvc_34",  label: "3/4\" Sch40 PVC",   type: "footage", category: "Conduit" },
  { key: "conduit_pvc_1",   label: "1\" Sch40 PVC",     type: "footage", category: "Conduit" },
  { key: "conduit_pvc_2",   label: "2\" Sch40 PVC",     type: "footage", category: "Conduit" },
  { key: "conduit_pvc_3",   label: "3\" Sch40 PVC",     type: "footage", category: "Conduit" },
  { key: "conduit_pvc_4",   label: "4\" Sch40 PVC",     type: "footage", category: "Conduit" },
  { key: "conduit_rigid",   label: "Rigid (all sizes)",  type: "footage", category: "Conduit" },
  // ── Panels ──
  { key: "panel_comm_sm", label: "Comm Panel ≤225A",      type: "count", category: "Panels" },
  { key: "panel_comm_md", label: "Comm Panel 400–800A",   type: "count", category: "Panels" },
  { key: "panel_comm_lg", label: "Comm Panel 1000A+",     type: "count", category: "Panels" },
  { key: "xfmr_sm",       label: "Transformer 1–15 KVA",  type: "count", category: "Panels" },
  { key: "xfmr_md",       label: "Transformer 25–75 KVA", type: "count", category: "Panels" },
  { key: "xfmr_lg",       label: "Transformer 100–500 KVA", type: "count", category: "Panels" },
  { key: "lc_100a",       label: "Load Center 100A",      type: "count", category: "Panels" },
  { key: "lc_200a",       label: "Load Center 200A",      type: "count", category: "Panels" },
  // ── Fire Alarm ──
  { key: "fa_smoke",      label: "Smoke Detector",       type: "count", category: "Fire Alarm" },
  { key: "fa_heat",       label: "Heat Detector",        type: "count", category: "Fire Alarm" },
  { key: "fa_smoke_co",   label: "Smoke/CO Combo",       type: "count", category: "Fire Alarm" },
  { key: "fa_pull",       label: "Pull Station",         type: "count", category: "Fire Alarm" },
  { key: "fa_horn_strobe",label: "Horn/Strobe",          type: "count", category: "Fire Alarm" },
  { key: "fa_strobe",     label: "Strobe Only",          type: "count", category: "Fire Alarm" },
  { key: "fa_lf_sounder", label: "LF Sounder",           type: "count", category: "Fire Alarm" },
  { key: "fa_beacon",     label: "Beacon",               type: "count", category: "Fire Alarm" },
  { key: "fa_ctrl_mod",   label: "Control Module",       type: "count", category: "Fire Alarm" },
  { key: "fa_duct_smoke", label: "Duct Smoke",           type: "count", category: "Fire Alarm" },
  { key: "fa_panel_sm",   label: "FA Panel Small",       type: "count", category: "Fire Alarm" },
  { key: "fa_panel_md",   label: "FA Panel Medium",      type: "count", category: "Fire Alarm" },
  { key: "fa_panel_lg",   label: "FA Panel Large",       type: "count", category: "Fire Alarm" },
  { key: "fa_radio",      label: "Radio Box",            type: "count", category: "Fire Alarm" },
  { key: "fa_annun",      label: "Annunciator",          type: "count", category: "Fire Alarm" },
  // ── Boxes & Rough ──
  { key: "box_4sq_deep",  label: "4\" Square Deep Box", type: "count",   category: "Boxes & Rough" },
  { key: "can_sm",        label: "Pull Can Small",       type: "count",   category: "Boxes & Rough" },
  { key: "can_md",        label: "Pull Can Medium",      type: "count",   category: "Boxes & Rough" },
  { key: "can_lg",        label: "Pull Can Large",       type: "count",   category: "Boxes & Rough" },
  { key: "can_xl",        label: "Pull Can XL",          type: "count",   category: "Boxes & Rough" },
  { key: "mc_homerun_12", label: "MC Home Run #12",      type: "footage", category: "Boxes & Rough" },
  { key: "mc_homerun_10", label: "MC Home Run #10",      type: "footage", category: "Boxes & Rough" },
  { key: "mc_homerun_8",  label: "MC Home Run #8",       type: "footage", category: "Boxes & Rough" },
];

const CATEGORIES = ["Devices", "Fixtures", "Data", "Conduit", "Panels", "Fire Alarm", "Boxes & Rough"];

// ─────────────────────────────────────────────────────────────────────────────
// CSS-in-JS theme constants
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  bg:        "#0a0f1e",
  surface:   "#111620",
  surface2:  "#1a2030",
  border:    "#2a3448",
  accent:    "#FF5910",
  accentDim: "#cc470d",
  text:      "#e8eaed",
  muted:     "#8892a0",
  amber:     "#f59e0b",
  green:     "#22c55e",
};

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function CounterClient({ estimate, initialAreas }: Props) {
  const [areas, setAreas] = useState<CounterAreaRow[]>(initialAreas);
  const [activeAreaId, setActiveAreaId] = useState<string>(initialAreas[0]?.id ?? "");
  const [activeCategory, setActiveCategory] = useState("Devices");
  const [showAreaPanel, setShowAreaPanel] = useState(false);
  const [newAreaName, setNewAreaName] = useState("");
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "synced" | "error">("idle");
  const [syncCount, setSyncCount] = useState(0);
  const [customDescriptions, setCustomDescriptions] = useState<Record<string, string>>({});

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeArea = areas.find((a) => a.id === activeAreaId) ?? areas[0];

  // ── Live polling — sync area updates from other sessions every 10s
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/estimates/${estimate.id}/counter-areas`);
        if (res.ok) {
          const updated: CounterAreaRow[] = await res.json();
          // Only refresh areas that weren't modified locally in the last 5s
          setAreas((prev) =>
            updated.map((u) => {
              const local = prev.find((p) => p.id === u.id);
              if (!local) return u;
              // Keep local if it's newer (user is actively editing)
              return new Date(u.updatedAt) > new Date(local.updatedAt) ? u : local;
            })
          );
        }
      } catch { /* silent */ }
    }, 10000);
    return () => clearInterval(interval);
  }, [estimate.id]);

  // ── Auto-save area counts to DB (debounced 1.5s)
  const scheduleSave = useCallback(
    (areaId: string, counts: Record<string, number>) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          await fetch(`/api/estimates/${estimate.id}/counter-areas/${areaId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ counts }),
          });
        } catch { /* silent */ }
      }, 1500);
    },
    [estimate.id]
  );

  // ── Count helpers
  function getCounts(): Record<string, number> {
    return activeArea?.counts ?? {};
  }

  function getCount(key: string): number {
    return getCounts()[key] ?? 0;
  }

  function updateCount(key: string, val: number) {
    const newCounts = { ...getCounts(), [key]: Math.max(0, val) };
    setAreas((prev) =>
      prev.map((a) =>
        a.id === activeAreaId
          ? { ...a, counts: newCounts, updatedAt: new Date().toISOString() }
          : a
      )
    );
    scheduleSave(activeAreaId, newCounts);
  }

  function increment(key: string) {
    updateCount(key, getCount(key) + 1);
  }

  function decrement(key: string) {
    updateCount(key, getCount(key) - 1);
  }

  function resetKey(key: string) {
    if (!confirm(`Reset "${COUNTER_ITEMS.find(i => i.key === key)?.label}" to 0?`)) return;
    updateCount(key, 0);
  }

  function setFootage(key: string, val: string) {
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) updateCount(key, num);
    else if (val === "" || val === "0") updateCount(key, 0);
  }

  // ── Totals
  function areaTotalItems(area: CounterAreaRow): number {
    return Object.values(area.counts ?? {}).reduce((s, v) => s + (v > 0 ? 1 : 0), 0);
  }

  function activeTotalCount(): number {
    return Object.values(getCounts()).reduce((s, v) => s + (typeof v === "number" ? v : 0), 0);
  }

  // ── Area management
  async function handleAddArea() {
    const name = newAreaName.trim() || `Area ${areas.length + 1}`;
    const res = await fetch(`/api/estimates/${estimate.id}/counter-areas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return;
    const newArea: CounterAreaRow = await res.json();
    setAreas((prev) => [...prev, newArea]);
    setActiveAreaId(newArea.id);
    setNewAreaName("");
    setShowAreaPanel(false);
  }

  async function handleDeleteArea(areaId: string) {
    if (areas.length <= 1) return;
    if (!confirm("Delete this area and all its counts?")) return;
    const res = await fetch(`/api/estimates/${estimate.id}/counter-areas/${areaId}`, {
      method: "DELETE",
    });
    if (!res.ok) return;
    setAreas((prev) => prev.filter((a) => a.id !== areaId));
    if (activeAreaId === areaId) {
      setActiveAreaId(areas.find((a) => a.id !== areaId)?.id ?? "");
    }
  }

  async function handleRenameArea(areaId: string, name: string) {
    if (!name.trim()) return;
    await fetch(`/api/estimates/${estimate.id}/counter-areas/${areaId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    setAreas((prev) =>
      prev.map((a) => (a.id === areaId ? { ...a, name: name.trim() } : a))
    );
  }

  async function handleClearArea() {
    if (!activeArea) return;
    if (!confirm(`Clear all counts in "${activeArea.name}"?`)) return;
    const empty: Record<string, number> = {};
    setAreas((prev) =>
      prev.map((a) =>
        a.id === activeAreaId ? { ...a, counts: empty, updatedAt: new Date().toISOString() } : a
      )
    );
    await fetch(`/api/estimates/${estimate.id}/counter-areas/${activeAreaId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ counts: empty }),
    });
  }

  // ── Sync to estimate
  async function handleSync() {
    setSyncStatus("syncing");
    try {
      const res = await fetch(`/api/estimates/${estimate.id}/counter-areas/sync`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Sync failed");
      const data = await res.json();
      setSyncCount(data.itemsAdded);
      setSyncStatus("synced");
      setTimeout(() => setSyncStatus("idle"), 4000);
    } catch {
      setSyncStatus("error");
      setTimeout(() => setSyncStatus("idle"), 3000);
    }
  }

  // ── Render item card
  function renderItem(item: CounterItemDef) {
    const val = getCount(item.key);
    const hasValue = val > 0;

    if (item.type === "footage") {
      return (
        <div key={item.key} style={styles.card}>
          <div style={styles.cardLeft}>
            <div style={styles.cardLabel}>{item.label}</div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>footage (ft)</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              defaultValue={val || ""}
              placeholder="0"
              key={`${activeAreaId}-${item.key}`}
              onBlur={(e) => setFootage(item.key, e.target.value)}
              style={{
                width: 80, height: 44, background: T.surface2, border: `1px solid ${T.border}`,
                borderRadius: 8, color: hasValue ? T.amber : T.muted,
                fontSize: 18, fontFamily: "monospace", textAlign: "center",
                outline: "none", padding: "0 8px",
              }}
            />
            {hasValue && (
              <button
                onClick={() => resetKey(item.key)}
                style={styles.resetBtn}
                title="Reset"
              >✕</button>
            )}
          </div>
        </div>
      );
    }

    if (item.type === "custom") {
      return (
        <div key={item.key} style={{ ...styles.card, flexDirection: "column", alignItems: "stretch", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={styles.cardLabel}>{item.label}</div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>tap + to count, add description</div>
            </div>
            <div style={styles.countRow}>
              {hasValue && (
                <button onClick={() => resetKey(item.key)} style={styles.resetBtn} title="Reset">✕</button>
              )}
              <button onClick={() => decrement(item.key)} style={styles.minusBtn}>−</button>
              <span style={{ ...styles.countDisplay, color: hasValue ? T.amber : T.muted }}>{val}</span>
              <button onClick={() => increment(item.key)} style={styles.plusBtn}>+</button>
            </div>
          </div>
          <input
            type="text"
            placeholder="Description (optional)"
            value={customDescriptions[item.key] ?? ""}
            onChange={(e) => setCustomDescriptions((prev) => ({ ...prev, [item.key]: e.target.value }))}
            style={{
              width: "100%", background: T.surface2, border: `1px solid ${T.border}`,
              borderRadius: 6, color: T.text, fontSize: 13, padding: "8px 10px", outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
      );
    }

    // count type
    return (
      <div key={item.key} style={styles.card}>
        <div style={styles.cardLeft}>
          <div style={styles.cardLabel}>{item.label}</div>
        </div>
        <div style={styles.countRow}>
          {hasValue && (
            <button onClick={() => resetKey(item.key)} style={styles.resetBtn} title="Reset">✕</button>
          )}
          <button onClick={() => decrement(item.key)} style={styles.minusBtn}>−</button>
          <span style={{ ...styles.countDisplay, color: hasValue ? T.amber : T.muted }}>{val}</span>
          <button onClick={() => increment(item.key)} style={styles.plusBtn}>+</button>
        </div>
      </div>
    );
  }

  const itemsInCategory = COUNTER_ITEMS.filter((i) => i.category === activeCategory);

  return (
    <div style={{ minHeight: "100dvh", background: T.bg, color: T.text, fontFamily: "system-ui, sans-serif", display: "flex", flexDirection: "column" }}>

      {/* ── HEADER ── */}
      <div style={{
        background: T.surface, borderBottom: `1px solid ${T.border}`,
        padding: "10px 14px", display: "flex", alignItems: "center",
        gap: 10, flexShrink: 0, position: "sticky", top: 0, zIndex: 10,
      }}>
        {/* Logo / brand mark */}
        <div style={{ width: 28, height: 28, borderRadius: 6, background: "#1e3a8a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ color: "white", fontSize: 11, fontWeight: 800 }}>OR</span>
        </div>

        {/* Estimate + area name */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: T.muted, lineHeight: 1 }}>{estimate.estimateNumber} · {estimate.name}</div>
          <input
            style={{ background: "transparent", border: "none", color: T.text, fontSize: 15, fontWeight: 700, outline: "none", width: "100%", marginTop: 1 }}
            value={activeArea?.name ?? ""}
            onChange={(e) => setAreas((prev) => prev.map((a) => a.id === activeAreaId ? { ...a, name: e.target.value } : a))}
            onBlur={(e) => { if (activeAreaId) handleRenameArea(activeAreaId, e.target.value); }}
          />
        </div>

        {/* Areas button */}
        <button
          onClick={() => setShowAreaPanel(true)}
          style={{ ...styles.headerBtn, background: "#1e3a8a" }}
        >
          AREAS
        </button>

        {/* Sync button */}
        <button
          onClick={handleSync}
          disabled={syncStatus === "syncing"}
          style={{
            ...styles.headerBtn,
            background: syncStatus === "synced" ? T.green :
                        syncStatus === "error"  ? "#ef4444" :
                        syncStatus === "syncing" ? T.border : T.accent,
            minWidth: 64,
          }}
        >
          {syncStatus === "syncing" ? "…" :
           syncStatus === "synced"  ? `✓ ${syncCount}` :
           syncStatus === "error"   ? "Error" : "SYNC"}
        </button>
      </div>

      {/* ── CATEGORY TABS ── */}
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, overflowX: "auto", flexShrink: 0 }}>
        <div style={{ display: "flex", padding: "0 4px" }}>
          {CATEGORIES.map((cat) => {
            const catItems = COUNTER_ITEMS.filter((i) => i.category === cat);
            const catTotal = catItems.reduce((s, i) => s + getCount(i.key), 0);
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  padding: "10px 12px", whiteSpace: "nowrap", border: "none",
                  background: "transparent", cursor: "pointer", fontSize: 12,
                  fontWeight: activeCategory === cat ? 700 : 400,
                  color: activeCategory === cat ? T.accent : T.muted,
                  borderBottom: `2px solid ${activeCategory === cat ? T.accent : "transparent"}`,
                  position: "relative",
                }}
              >
                {cat}
                {catTotal > 0 && (
                  <span style={{
                    marginLeft: 4, fontSize: 10, background: T.accent, color: "white",
                    borderRadius: "999px", padding: "1px 5px", verticalAlign: "middle",
                  }}>
                    {catTotal}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── ITEM LIST ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px", paddingBottom: 90 }}>
        {itemsInCategory.map(renderItem)}
      </div>

      {/* ── BOTTOM BAR ── */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: T.surface, borderTop: `1px solid ${T.border}`,
        padding: "10px 14px", display: "flex", alignItems: "center", gap: 10,
        zIndex: 10,
      }}>
        <div style={{ flex: 1, fontSize: 12, color: T.muted }}>
          <span style={{ color: T.text, fontWeight: 700 }}>{activeTotalCount()}</span>
          {" "}total · {activeArea?.name}
        </div>
        <button
          onClick={() => { setNewAreaName(`Area ${areas.length + 1}`); setShowAreaPanel(true); }}
          style={{ ...styles.bottomBtn, background: "#1e3a8a" }}
        >
          + NEW AREA
        </button>
        <button
          onClick={handleSync}
          disabled={syncStatus === "syncing"}
          style={{ ...styles.bottomBtn, background: T.accent, fontWeight: 700 }}
        >
          {syncStatus === "syncing" ? "Syncing…" : "SYNC TO ESTIMATE"}
        </button>
      </div>

      {/* ── AREA MANAGER PANEL ── */}
      {showAreaPanel && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50, display: "flex", alignItems: "flex-end" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAreaPanel(false); }}
        >
          <div style={{ background: T.surface, borderRadius: "16px 16px 0 0", width: "100%", maxHeight: "80vh", overflowY: "auto", padding: "16px 14px 32px" }}>
            {/* Drag handle */}
            <div style={{ width: 40, height: 4, borderRadius: 2, background: T.border, margin: "0 auto 16px" }} />

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: T.text }}>Areas</h2>
              <button onClick={() => setShowAreaPanel(false)} style={{ background: "none", border: "none", color: T.muted, fontSize: 20, cursor: "pointer", padding: 4 }}>✕</button>
            </div>

            {/* Area list */}
            {areas.map((area) => {
              const itemCount = areaTotalItems(area);
              return (
                <div
                  key={area.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "12px 10px", borderRadius: 10,
                    background: area.id === activeAreaId ? "#1e2e1e" : T.surface2,
                    border: `1px solid ${area.id === activeAreaId ? T.green : T.border}`,
                    marginBottom: 8, cursor: "pointer",
                  }}
                  onClick={() => { setActiveAreaId(area.id); setShowAreaPanel(false); }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: area.id === activeAreaId ? T.green : T.text }}>{area.name}</div>
                    <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                      {itemCount} item{itemCount !== 1 ? "s" : ""} counted
                    </div>
                  </div>
                  {areas.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteArea(area.id); }}
                      style={{ background: "none", border: "none", color: "#ef4444", fontSize: 16, cursor: "pointer", padding: "4px 8px" }}
                    >
                      🗑
                    </button>
                  )}
                  {area.id === activeAreaId && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleClearArea(); }}
                      style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.muted, fontSize: 11, padding: "4px 8px", borderRadius: 6, cursor: "pointer" }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              );
            })}

            {/* New area input */}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input
                type="text"
                value={newAreaName}
                onChange={(e) => setNewAreaName(e.target.value)}
                placeholder={`Area ${areas.length + 1}`}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddArea(); }}
                style={{
                  flex: 1, background: T.surface2, border: `1px solid ${T.border}`,
                  borderRadius: 8, color: T.text, fontSize: 14, padding: "10px 12px", outline: "none",
                }}
              />
              <button
                onClick={handleAddArea}
                style={{ background: T.accent, color: "white", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Style objects
// ─────────────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  card: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 64,
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: 12,
    padding: "10px 12px",
    marginBottom: 8,
    gap: 10,
  },
  cardLeft: {
    flex: 1,
    minWidth: 0,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: T.text,
    lineHeight: 1.3,
  },
  countRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  countDisplay: {
    fontFamily: "ui-monospace, 'JetBrains Mono', monospace",
    fontSize: 24,
    fontWeight: 700,
    minWidth: 44,
    textAlign: "center",
  } as React.CSSProperties,
  plusBtn: {
    width: 52,
    height: 52,
    borderRadius: 12,
    background: T.accent,
    color: "white",
    border: "none",
    fontSize: 28,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    lineHeight: 1,
  } as React.CSSProperties,
  minusBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    background: T.surface2,
    color: T.text,
    border: `1px solid ${T.border}`,
    fontSize: 22,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    lineHeight: 1,
  } as React.CSSProperties,
  resetBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    background: "transparent",
    color: T.muted,
    border: `1px solid ${T.border}`,
    fontSize: 12,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  } as React.CSSProperties,
  headerBtn: {
    border: "none",
    borderRadius: 8,
    color: "white",
    fontSize: 11,
    fontWeight: 700,
    padding: "8px 12px",
    cursor: "pointer",
    flexShrink: 0,
  } as React.CSSProperties,
  bottomBtn: {
    border: "none",
    borderRadius: 10,
    color: "white",
    fontSize: 12,
    fontWeight: 600,
    padding: "10px 14px",
    cursor: "pointer",
    flexShrink: 0,
    whiteSpace: "nowrap",
  } as React.CSSProperties,
};
