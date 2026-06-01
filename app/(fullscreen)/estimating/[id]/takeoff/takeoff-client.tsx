"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from "react";
import { useRouter } from "next/navigation";
import { STD_ITEMS, CAT_COLORS, CATEGORY_TABS } from "@/lib/takeoff-items";
import { SYMBOLS as DRAW_SYMBOLS, CAT_ORDER } from "@/lib/takeoff-symbols";

// ── Constants ─────────────────────────────────────────────────────────────────
const BASE_SCALE = 1.5;
const SCREEN_DPI = 96;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4.0;
const AUTOSAVE_DELAY = 1500;
const MARKER_SIZE = 22;

// ── Scale presets ─────────────────────────────────────────────────────────────
const SCALE_PRESETS: { label: string; feetPerInch: number }[] = [
  { label: '1"=4\'',   feetPerInch: 4  },
  { label: '1"=8\'',   feetPerInch: 8  },
  { label: '1"=10\'',  feetPerInch: 10 },
  { label: '1"=20\'',  feetPerInch: 20 },
  { label: '1"=40\'',  feetPerInch: 40 },
  { label: '1/8"=1\'', feetPerInch: 8  },
  { label: '1/4"=1\'', feetPerInch: 4  },
  { label: '1/2"=1\'', feetPerInch: 2  },
  { label: '1"=24\'',  feetPerInch: 24 },
  { label: '1"=48\'',  feetPerInch: 48 },
];

function pxPerFootFromPreset(feetPerInch: number): number {
  return (SCREEN_DPI * BASE_SCALE) / feetPerInch;
}

// ── Types ─────────────────────────────────────────────────────────────────────
type Mode = "count" | "run" | "pan" | "fixtures";
type SaveStatus = "saved" | "saving" | "unsaved";

interface Pt { x: number; y: number }

interface Markup {
  id: string;
  type: "symbol" | "run" | "endpoint";
  page: number;
  symId?: string;
  x?: number;
  y?: number;
  size?: number;
  color?: string;
  rotation?: number;
  itemKey?: string;
  label?: string;
  points?: Pt[];
  footage?: number;
  runTypeId?: string;
  transferred?: boolean;
  name?: string;
  footageOverride?: number;
  isFixture?: boolean;
  fixtureId?: string;
  tag?: string;
}

interface RunType {
  id: string;
  category: "EMT" | "PVC" | "Rigid" | "MC" | "NM" | "Custom";
  size: string;
  conductors: { count: number; size: string; type: string; isGround: boolean }[];
  material: "Cu" | "Al";
  support: string;
  makeup: number;
  difficulty: number;
  color: string;
  label: string;
}

export interface SerializedDrawing {
  id: string;
  estimateId: string;
  name: string;
  pageCount: number;
  pdfData: string | null;
  markups: any[];
  runTypes: any[];
  assemblies: any[];
  pageScales: Record<string, number>;
  fixtures?: any[];
  createdAt: string;
  updatedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function midpoint(pts: Pt[]): Pt {
  const mid = Math.floor(pts.length / 2);
  if (pts.length === 1) return pts[0];
  return { x: (pts[mid - 1].x + pts[mid].x) / 2, y: (pts[mid - 1].y + pts[mid].y) / 2 };
}

function calcRunPixelDist(pts: Pt[]): number {
  let d = 0;
  for (let i = 1; i < pts.length; i++)
    d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return d;
}

function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

function drawMarker(
  ctx: CanvasRenderingContext2D,
  symId: string, x: number, y: number, size: number, color: string, alpha = 1, rotation = 0
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  if (rotation) ctx.rotate(rotation * Math.PI / 180);
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.beginPath(); ctx.arc(0, 0, size * 0.7, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, size * 0.7, 0, Math.PI * 2); ctx.stroke();
  ctx.shadowColor = color; ctx.shadowBlur = 8;
  const fn = DRAW_SYMBOLS[symId] ?? DRAW_SYMBOLS["dot"];
  fn(ctx, 0, 0, size, color);
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawFixtureMarker(
  ctx: CanvasRenderingContext2D, tag: string,
  x: number, y: number, size: number, color: string
) {
  ctx.save();
  ctx.translate(x, y);
  const r = size * 0.65;
  ctx.strokeStyle = color; ctx.lineWidth = 2.5;
  ctx.shadowColor = color; ctx.shadowBlur = 6;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = color;
  ctx.font = `bold ${Math.round(size * 0.5)}px "JetBrains Mono", monospace`;
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  ctx.fillText(tag, 0, r + 2);
  ctx.restore();
}

// ── Fixture schedule ──────────────────────────────────────────────────────────
interface FixtureItem {
  id: string;
  tag: string;
  description: string;
  manufacturer: string;
  baseType: string;
  color: string;
  notes: string;
}

const FIXTURE_BASE_TYPES = [
  "LED Troffer 2×4", "LED Troffer 2×2", "LED Strip", "LED High Bay",
  "LED Recessed Can", "LED Pendant", "LED Vapor Tight", "LED Wall Pack",
  "Exit Sign", "Emergency Light", "Ceiling Fan", "Track Light",
  "Surface Mount", "Undercabinet", "Custom",
];

const DEFAULT_RUN_TYPE: RunType = {
  id: "rt_default",
  category: "EMT",
  size: "3/4",
  conductors: [
    { count: 2, size: "#12", type: "THHN", isGround: false },
    { count: 1, size: "#12", type: "THHN", isGround: true  },
  ],
  material: "Cu", support: "1-Hole Strap", makeup: 2, difficulty: 1.0,
  color: "#f0a500", label: '3/4" EMT | 2×#12 + 1×#12 GND',
};

// ── Wire sizing constants ─────────────────────────────────────────────────────
const WIRE_SIZES = [
  "#14", "#12", "#10", "#8", "#6", "#4", "#3", "#2", "#1",
  "1/0", "2/0", "3/0", "4/0", "250", "300", "350", "400", "500",
];

/** NEC Table 250.122 — minimum equipment grounding conductor sizes */
const NEC_GROUND_TABLE: Record<string, string> = {
  "#14": "#14", "#12": "#12", "#10": "#10",
  "#8":  "#10", "#6":  "#10", "#4":  "#10",
  "#3":  "#10", "#2":  "#10", "#1":  "#8",
  "1/0": "#8",  "2/0": "#6",  "3/0": "#4",
  "4/0": "#3",  "250": "#2",  "300": "#1",
  "350": "#1",  "400": "1/0", "500": "1/0",
};

// ── Main Component ────────────────────────────────────────────────────────────
export function TakeoffClient({
  estimate,
  initialDrawings,
}: {
  estimate: {
    id: string; estimateNumber: string; name: string;
    laborRate: number; bulkMarkup: number; lightMarkup: number;
    permitMarkup: number; subMarkup: number; overhead: number; profit: number;
    nonProd: number; designFeePct: number; conditionMult: number; heightAdj: boolean;
  };
  initialDrawings: SerializedDrawing[];
}) {
  const router = useRouter();
  const estimateId = estimate.id;

  // Drawings
  const [drawings, setDrawings] = useState<SerializedDrawing[]>(initialDrawings);
  const [activeDrawingId, setActiveDrawingId] = useState<string | null>(
    initialDrawings[0]?.id ?? null
  );

  // PDF
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(
    initialDrawings[0]?.pageCount ?? 1
  );
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Mode & UI
  const [mode, setMode] = useState<Mode>("count");
  const [zoom, setZoomState] = useState(1.0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [scaleBannerVisible, setScaleBannerVisible] = useState(false);
  const [auditOpen, setAuditOpen] = useState(true);
  const [leftPanelTab, setLeftPanelTab] = useState("devices");

  // COUNT
  const [selectedItemKey, setSelectedItemKey] = useState("recept_20a");
  const [selectedColor, setSelectedColor] = useState("#e03a3a");

  // RUN
  const [runTypes, setRunTypes] = useState<RunType[]>(() => {
    const rt = initialDrawings[0]?.runTypes ?? [];
    return rt.length > 0 ? (rt as RunType[]) : [DEFAULT_RUN_TYPE];
  });
  const [activeRunTypeId, setActiveRunTypeId] = useState<string>(() => {
    const rt = initialDrawings[0]?.runTypes ?? [];
    return rt.length > 0 ? (rt[0] as RunType).id : DEFAULT_RUN_TYPE.id;
  });
  const [runInProgress, setRunInProgress] = useState<Pt[]>([]);
  const [orthoSnap, setOrthoSnap] = useState(true);

  // Run type form modal
  const [showRunTypeForm, setShowRunTypeForm] = useState(false);
  const [rtfLabel, setRtfLabel] = useState("");
  const [rtfCategory, setRtfCategory] = useState<RunType["category"]>("EMT");
  const [rtfSize, setRtfSize] = useState("3/4");
  const [rtfPhaseCount, setRtfPhaseCount] = useState(2);
  const [rtfPhaseSize, setRtfPhaseSize] = useState("#12");
  const [rtfHasGround, setRtfHasGround] = useState(true);
  const [rtfGroundCount, setRtfGroundCount] = useState(1);
  const [rtfGroundSize, setRtfGroundSize] = useState("#12");
  const [rtfColor, setRtfColor] = useState("#f0a500");
  const [rtfDifficulty, setRtfDifficulty] = useState(1.0);

  // Fixtures
  const [fixtures, setFixtures] = useState<FixtureItem[]>(() =>
    Array.isArray(initialDrawings[0]?.fixtures) ? (initialDrawings[0].fixtures as FixtureItem[]) : []
  );
  const [selectedFixtureId, setSelectedFixtureId] = useState<string | null>(null);
  const [showFixtureForm, setShowFixtureForm] = useState(false);
  const [fixTag, setFixTag] = useState("");
  const [fixDescription, setFixDescription] = useState("");
  const [fixManufacturer, setFixManufacturer] = useState("");
  const [fixBaseType, setFixBaseType] = useState(FIXTURE_BASE_TYPES[0]);
  const [fixColor, setFixColor] = useState("#3a8fe8");
  const [fixNotes, setFixNotes] = useState("");

  // Context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; markup: Markup } | null>(null);
  const [editTagModal, setEditTagModal] = useState(false);
  const [editTagValue, setEditTagValue] = useState("");
  const [editTagMarkupId, setEditTagMarkupId] = useState("");
  const [editFootageModal, setEditFootageModal] = useState(false);
  const [editFootageValue, setEditFootageValue] = useState("");
  const [editFootageMarkupId, setEditFootageMarkupId] = useState("");
  const [changeRTModal, setChangeRTModal] = useState(false);
  const [changeRTId, setChangeRTId] = useState("");
  const [changeRTMarkupId, setChangeRTMarkupId] = useState("");
  const [propsModal, setPropsModal] = useState(false);
  const [propsMarkup, setPropsMarkup] = useState<Markup | null>(null);

  // Markups
  const [markups, setMarkups] = useState<Markup[]>(() =>
    (initialDrawings[0]?.markups ?? []) as Markup[]
  );

  // Scale
  const [pageScales, setPageScales] = useState<Record<string, number>>(
    initialDrawings[0]?.pageScales ?? {}
  );
  const [measuringActive, setMeasuringActive] = useState(false);
  const [measurePt1, setMeasurePt1] = useState<Pt | null>(null);
  const [measurePixelDist, setMeasurePixelDist] = useState(0);
  const [showMeasureModal, setShowMeasureModal] = useState(false);
  const [measureDistInput, setMeasureDistInput] = useState("");

  // Refs
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const markupCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);
  const pdfjsRef = useRef<any>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panRef = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);
  const spaceHeld = useRef(false);

  // Stable refs (avoid stale closures in event listeners)
  const zoomRef = useRef(zoom);
  const pageScalesRef = useRef(pageScales);
  const markupsRef = useRef(markups);
  const runTypesRef = useRef(runTypes);
  const activeDrawingIdRef = useRef(activeDrawingId);
  const currentPageRef = useRef(currentPage);
  const modeRef = useRef(mode);
  const runInProgressRef = useRef(runInProgress);
  const orthoSnapRef = useRef(orthoSnap);
  const measuringActiveRef = useRef(measuringActive);
  const measurePt1Ref = useRef(measurePt1);

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { pageScalesRef.current = pageScales; }, [pageScales]);
  useEffect(() => { markupsRef.current = markups; }, [markups]);
  useEffect(() => { runTypesRef.current = runTypes; }, [runTypes]);
  useEffect(() => { activeDrawingIdRef.current = activeDrawingId; }, [activeDrawingId]);
  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { runInProgressRef.current = runInProgress; }, [runInProgress]);
  useEffect(() => { orthoSnapRef.current = orthoSnap; }, [orthoSnap]);
  useEffect(() => { measuringActiveRef.current = measuringActive; }, [measuringActive]);
  useEffect(() => { measurePt1Ref.current = measurePt1; }, [measurePt1]);

  const fixturesRef = useRef(fixtures);
  useEffect(() => { fixturesRef.current = fixtures; }, [fixtures]);

  // Fix 3: drive scaleBannerVisible from state, not from inside a setState updater
  useEffect(() => {
    setScaleBannerVisible(!pageScales[String(currentPage)]);
  }, [currentPage, pageScales]);

  // ── Load PDF.js ───────────────────────────────────────────────────────────
  useEffect(() => {
    if ((window as any).pdfjsLib) {
      pdfjsRef.current = (window as any).pdfjsLib;
      tryAutoLoad();
      return;
    }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = () => {
      const lib = (window as any).pdfjsLib;
      lib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      pdfjsRef.current = lib;
      tryAutoLoad();
    };
    document.head.appendChild(s);
    return () => { if (document.head.contains(s)) document.head.removeChild(s); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function tryAutoLoad(overrideId?: string) {
    const targetId = overrideId ?? activeDrawingId;
    const drawing = drawings.find(d => d.id === targetId) ?? initialDrawings.find(d => d.id === targetId);
    if (!drawing?.pdfData) return;

    // Legacy base64 support (pdfData is a very long string, not a storage path)
    if (!drawing.pdfData.startsWith("takeoff-pdfs/") && drawing.pdfData.length > 200) {
      setPdfError(null);
      loadPDFFromBase64(drawing.pdfData);
      return;
    }

    // New: storage path like "takeoff-pdfs/xxx.pdf"
    if (!drawing.pdfData.startsWith("takeoff-pdfs/")) return;

    setPdfLoading(true);
    setPdfError(null);
    try {
      const res = await fetch(`/api/takeoff-drawings/${targetId}/upload-pdf`);
      if (!res.ok) {
        const msg = await res.text().catch(() => `HTTP ${res.status}`);
        setPdfError(`Failed to load PDF: ${msg}`);
        setPdfLoading(false);
        return;
      }
      const ab = await res.arrayBuffer();
      await loadPDFFromBytes(new Uint8Array(ab));
    } catch (err) {
      setPdfError(`PDF load error: ${err instanceof Error ? err.message : String(err)}`);
      console.error("Auto-load error:", err);
    } finally {
      setPdfLoading(false);
    }
  }

  // ── PDF rendering ─────────────────────────────────────────────────────────
  async function loadPDFFromBytes(bytes: Uint8Array) {
    const lib = pdfjsRef.current;
    if (!lib) { setTimeout(() => loadPDFFromBytes(bytes), 300); return; }
    try {
      const doc = await lib.getDocument({ data: bytes }).promise;
      pdfDocRef.current = doc;
      setTotalPages(doc.numPages);
      setPdfLoaded(true);
      setPdfError(null);
      await renderPage(1, zoomRef.current);
    } catch (err) {
      console.error("PDF load error", err);
      setPdfError(`PDF render error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function loadPDFFromBase64(b64: string) {
    const lib = pdfjsRef.current;
    if (!lib) { setTimeout(() => loadPDFFromBase64(b64), 300); return; }
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    try {
      const doc = await lib.getDocument({ data: bytes }).promise;
      pdfDocRef.current = doc;
      setTotalPages(doc.numPages);
      setPdfLoaded(true);
      await renderPage(1, zoomRef.current);
      // scaleBannerVisible is driven by useEffect watching currentPage + pageScales
    } catch (err) { console.error("PDF load error", err); }
  }

  const renderPage = useCallback(async (pageNum: number, z: number) => {
    const doc = pdfDocRef.current;
    if (!doc) return;
    if (renderTaskRef.current) { try { renderTaskRef.current.cancel(); } catch {} }
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: BASE_SCALE * z });
    const pdfC = pdfCanvasRef.current;
    const mkC = markupCanvasRef.current;
    if (!pdfC || !mkC) return;
    pdfC.width = viewport.width; pdfC.height = viewport.height;
    mkC.width = viewport.width;  mkC.height = viewport.height;
    const ctx = pdfC.getContext("2d")!;
    const task = page.render({ canvasContext: ctx, viewport });
    renderTaskRef.current = task;
    try { await task.promise; redrawAll(pageNum, z, null); } catch {}
  }, []); // eslint-disable-line

  // ── Redraw markup canvas ──────────────────────────────────────────────────
  const redrawAll = useCallback(
    (page: number, z: number, cursor: Pt | null) => {
      const canvas = markupCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const m of markupsRef.current) {
        if (m.page !== page) continue;
        if (m.type === "symbol" && m.x != null && m.y != null) {
          if (m.isFixture) {
            drawFixtureMarker(ctx, m.tag ?? "?", m.x * z, m.y * z, (m.size ?? MARKER_SIZE) * z, m.color ?? "#3a8fe8");
          } else {
            drawMarker(ctx, m.symId ?? "dot", m.x * z, m.y * z, (m.size ?? MARKER_SIZE) * z, m.color ?? "#e03a3a", 1, m.rotation ?? 0);
          }
        } else if (m.type === "run" && m.points && m.points.length >= 2) {
          const pts = m.points.map(p => ({ x: p.x * z, y: p.y * z }));
          drawRun(ctx, pts, m.color ?? "#f0a500", m.footageOverride ?? m.footage ?? 0, m.transferred ?? false);
        } else if (m.type === "endpoint" && m.x != null && m.y != null) {
          drawEndpoint(ctx, m.x * z, m.y * z, m.name ?? "EP");
        }
      }

      // In-progress run
      const rip = runInProgressRef.current;
      if (rip.length > 0) {
        const pts = rip.map(p => ({ x: p.x * z, y: p.y * z }));
        ctx.save();
        ctx.strokeStyle = "#FF5910"; ctx.lineWidth = 2.5; ctx.setLineDash([6, 3]);
        ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        if (cursor) ctx.lineTo(cursor.x * z, cursor.y * z);
        ctx.stroke(); ctx.setLineDash([]);
        for (const p of pts) {
          ctx.fillStyle = "#FF5910"; ctx.beginPath();
          ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }

      // Measure line
      const mp1 = measurePt1Ref.current;
      if (mp1 && measuringActiveRef.current) {
        ctx.save();
        ctx.strokeStyle = "#f0a500"; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(mp1.x * z, mp1.y * z);
        if (cursor) ctx.lineTo(cursor.x * z, cursor.y * z);
        ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = "#f0a500"; ctx.beginPath();
        ctx.arc(mp1.x * z, mp1.y * z, 5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    },
    [] // eslint-disable-line
  );

  function drawRun(ctx: CanvasRenderingContext2D, pts: Pt[], color: string, footage: number, transferred: boolean) {
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = 3;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.shadowColor = color; ctx.shadowBlur = 4;
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke(); ctx.shadowBlur = 0;
    for (const p of [pts[0], pts[pts.length - 1]]) {
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.stroke();
    }
    if (footage > 0) {
      const mp = midpoint(pts);
      const lw = transferred ? 58 : 48;
      ctx.fillStyle = "rgba(0,0,0,0.75)"; ctx.fillRect(mp.x - lw / 2, mp.y - 10, lw, 20);
      ctx.fillStyle = transferred ? "#2db562" : color;
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(footage + "ft" + (transferred ? " ✓" : ""), mp.x, mp.y);
    }
    ctx.restore();
  }

  function drawEndpoint(ctx: CanvasRenderingContext2D, x: number, y: number, name: string) {
    ctx.save();
    const w = Math.max(32, name.length * 8 + 12);
    ctx.fillStyle = "#002D72"; ctx.strokeStyle = "#3a8fe8"; ctx.lineWidth = 2;
    ctx.fillRect(x - w / 2, y - 12, w, 24); ctx.strokeRect(x - w / 2, y - 12, w, 24);
    ctx.fillStyle = "#e8eaed";
    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(name, x, y);
    ctx.restore();
  }

  // ── Zoom ──────────────────────────────────────────────────────────────────
  function applyZoom(delta: number) {
    setZoomState(prev => {
      const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, prev + delta));
      zoomRef.current = next;
      if (pdfDocRef.current) renderPage(currentPageRef.current, next);
      return next;
    });
  }

  function zoomFit() {
    const wrap = canvasWrapRef.current;
    const pdfC = pdfCanvasRef.current;
    if (!wrap || !pdfC || !pdfC.width) return;
    const nW = pdfC.width / zoomRef.current;
    const nH = pdfC.height / zoomRef.current;
    const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX,
      Math.min((wrap.clientWidth / nW) * 0.95, (wrap.clientHeight / nH) * 0.95)
    ));
    zoomRef.current = next; setZoomState(next);
    if (pdfDocRef.current) renderPage(currentPageRef.current, next);
  }

  // ── Page nav ──────────────────────────────────────────────────────────────
  function goPage(delta: number) {
    setCurrentPage(prev => {
      const next = Math.max(1, Math.min(totalPages, prev + delta));
      currentPageRef.current = next;
      if (pdfDocRef.current) renderPage(next, zoomRef.current);
      // scaleBannerVisible is driven by useEffect watching currentPage + pageScales
      return next;
    });
  }

  // ── Canvas position helpers ───────────────────────────────────────────────
  function getCanvasPos(e: React.MouseEvent): Pt {
    const rect = markupCanvasRef.current!.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / zoomRef.current, y: (e.clientY - rect.top) / zoomRef.current };
  }

  function orthoConstrain(from: Pt, to: Pt): Pt {
    const dx = Math.abs(to.x - from.x), dy = Math.abs(to.y - from.y);
    return dx >= dy ? { x: to.x, y: from.y } : { x: from.x, y: to.y };
  }

  // ── Canvas events ─────────────────────────────────────────────────────────
  function handleClick(e: React.MouseEvent) {
    if (e.button !== 0) return;
    const pos = getCanvasPos(e);
    if (measuringActiveRef.current) { handleMeasureClick(pos); return; }
    if (modeRef.current === "pan" || spaceHeld.current) return;
    if (modeRef.current === "count") handleCountClick(pos);
    else if (modeRef.current === "run") handleRunClick(pos, e.shiftKey);
    else if (modeRef.current === "fixtures") handleFixtureClick(pos);
  }

  function handleDblClick(e: React.MouseEvent) {
    if (modeRef.current === "run" && runInProgressRef.current.length >= 2) {
      finishRun(); e.preventDefault();
    }
  }

  function handleRightClick(e: React.MouseEvent) {
    e.preventDefault();
    // If a run is in progress, pop the last point
    if (modeRef.current === "run" && runInProgressRef.current.length > 0) {
      const rip = runInProgressRef.current;
      const next = rip.length > 1 ? rip.slice(0, -1) : [];
      setRunInProgress(next); runInProgressRef.current = next;
      redrawAll(currentPageRef.current, zoomRef.current, null);
      return;
    }
    // Otherwise hit-detect and show context menu
    const pos = getCanvasPos(e);
    const found = getMarkupAtPoint(pos.x, pos.y);
    if (found) {
      setContextMenu({ x: e.clientX, y: e.clientY, markup: found });
    }
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (panRef.current) {
      const w = canvasWrapRef.current!;
      w.scrollLeft = panRef.current.sl - (e.clientX - panRef.current.x);
      w.scrollTop  = panRef.current.st - (e.clientY - panRef.current.y);
      return;
    }
    const pos = getCanvasPos(e);
    let sp = pos;
    if (modeRef.current === "run" && orthoSnapRef.current) {
      const rip = runInProgressRef.current;
      if (rip.length > 0) sp = orthoConstrain(rip[rip.length - 1], pos);
    }
    requestAnimationFrame(() => redrawAll(currentPageRef.current, zoomRef.current, sp));
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button === 1 || modeRef.current === "pan" || spaceHeld.current) {
      e.preventDefault();
      const w = canvasWrapRef.current!;
      panRef.current = { x: e.clientX, y: e.clientY, sl: w.scrollLeft, st: w.scrollTop };
    }
  }
  function handleMouseUp() { panRef.current = null; }

  // ── COUNT mode ────────────────────────────────────────────────────────────
  function handleCountClick(pos: Pt) {
    const item = STD_ITEMS.find(i => i.key === selectedItemKey);
    if (!item) return;
    const m: Markup = {
      id: genId(), type: "symbol", page: currentPageRef.current,
      symId: item.symId, x: pos.x, y: pos.y, size: MARKER_SIZE,
      color: selectedColor, rotation: 0, itemKey: item.key,
    };
    setMarkups(prev => {
      const next = [...prev, m]; markupsRef.current = next;
      scheduleAutosave({ markups: next }); return next;
    });
    requestAnimationFrame(() => redrawAll(currentPageRef.current, zoomRef.current, null));
  }

  // ── RUN mode ──────────────────────────────────────────────────────────────
  function handleRunClick(pos: Pt, shift: boolean) {
    const snap = orthoSnapRef.current && !shift;
    let sp = pos;
    const rip = runInProgressRef.current;
    if (snap && rip.length > 0) sp = orthoConstrain(rip[rip.length - 1], pos);
    const next = [...rip, sp];
    setRunInProgress(next); runInProgressRef.current = next;
    redrawAll(currentPageRef.current, zoomRef.current, sp);
  }

  function finishRun() {
    const rip = runInProgressRef.current;
    if (rip.length < 2) { setRunInProgress([]); runInProgressRef.current = []; return; }
    const rt = runTypes.find(r => r.id === activeRunTypeId) ?? runTypes[0];
    const pxpf = pageScalesRef.current[String(currentPageRef.current)];
    const pixDist = calcRunPixelDist(rip);
    const footage = pxpf ? Math.round((pixDist / pxpf) * 10) / 10 : 0;
    const m: Markup = {
      id: genId(), type: "run", page: currentPageRef.current,
      points: [...rip], footage, runTypeId: rt.id,
      color: rt.color, transferred: false,
    };
    setMarkups(prev => {
      const next = [...prev, m]; markupsRef.current = next;
      scheduleAutosave({ markups: next }); return next;
    });
    setRunInProgress([]); runInProgressRef.current = [];
    redrawAll(currentPageRef.current, zoomRef.current, null);
  }

  // ── Measuring ─────────────────────────────────────────────────────────────
  function handleMeasureClick(pos: Pt) {
    if (!measurePt1Ref.current) {
      setMeasurePt1(pos); measurePt1Ref.current = pos;
    } else {
      const pt1 = measurePt1Ref.current;
      const dist = Math.hypot(
        (pos.x - pt1.x) * zoomRef.current,
        (pos.y - pt1.y) * zoomRef.current
      );
      setMeasurePixelDist(dist);
      setMeasuringActive(false); measuringActiveRef.current = false;
      setShowMeasureModal(true);
    }
  }

  function confirmMeasure() {
    const realFeet = parseFloat(measureDistInput);
    if (!realFeet || realFeet <= 0) return;
    const pxpf = measurePixelDist / (realFeet * zoomRef.current);
    setPageScales(prev => {
      const next = { ...prev, [String(currentPageRef.current)]: pxpf };
      pageScalesRef.current = next;
      scheduleAutosave({ pageScales: next });
      return next;
    });
    setShowMeasureModal(false);
    setMeasurePt1(null); measurePt1Ref.current = null;
    setMeasureDistInput("");
  }

  function applyScalePreset(feetPerInch: number) {
    const pxpf = pxPerFootFromPreset(feetPerInch);
    setPageScales(prev => {
      const next = { ...prev, [String(currentPageRef.current)]: pxpf };
      pageScalesRef.current = next;
      scheduleAutosave({ pageScales: next });
      return next;
    });
  }

  // ── Wheel zoom ────────────────────────────────────────────────────────────
  useEffect(() => {
    const w = canvasWrapRef.current;
    if (!w) return;
    const fn = (e: WheelEvent) => { e.preventDefault(); applyZoom(e.deltaY < 0 ? 0.02 : -0.02); };
    w.addEventListener("wheel", fn, { passive: false });
    return () => w.removeEventListener("wheel", fn);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    function kd(e: KeyboardEvent) {
      const t = (e.target as HTMLElement)?.tagName;
      if (t === "INPUT" || t === "SELECT" || t === "TEXTAREA") return;
      if (e.key === " ") { e.preventDefault(); spaceHeld.current = true; }
      if (e.key === "c" || e.key === "C") { setMode("count"); modeRef.current = "count"; }
      if (e.key === "r" || e.key === "R") { setMode("run"); modeRef.current = "run"; }
      if (e.key === "p" || e.key === "P") { setMode("pan"); modeRef.current = "pan"; }
      if (e.key === "f" || e.key === "F") { setMode("fixtures"); modeRef.current = "fixtures"; }
      if (e.key === "Escape") {
        setRunInProgress([]); runInProgressRef.current = [];
        setMeasuringActive(false); measuringActiveRef.current = false;
        setMeasurePt1(null); measurePt1Ref.current = null;
        redrawAll(currentPageRef.current, zoomRef.current, null);
      }
      if (e.key === "Enter" && modeRef.current === "run" && runInProgressRef.current.length >= 2) finishRun();
      if (e.key === "+" || e.key === "=") applyZoom(0.10);
      if (e.key === "-") applyZoom(-0.10);
    }
    function ku(e: KeyboardEvent) { if (e.key === " ") spaceHeld.current = false; }
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── File upload (browser → Supabase Storage direct, bypasses Vercel limit) ──
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const drawingId = activeDrawingIdRef.current;
    if (!drawingId) return;

    // 1. Load into PDF.js immediately for instant local preview
    const ab = await file.arrayBuffer();
    setPdfError(null);
    loadPDFFromBytes(new Uint8Array(ab));

    setSaveStatus("saving");
    try {
      // 2. Get a signed upload URL from the server (tiny request — just metadata)
      const urlRes = await fetch(`/api/takeoff-drawings/${drawingId}/upload-url`);
      if (!urlRes.ok) {
        const msg = await urlRes.text();
        setPdfError(`Failed to get upload URL: ${msg}`);
        setSaveStatus("unsaved");
        return;
      }
      const { signedUrl, storagePath } = await urlRes.json() as {
        signedUrl: string;
        storagePath: string;
      };

      // 3. PUT the raw file directly to Supabase Storage from the browser.
      //    This never touches Vercel — no 4.5 MB payload limit.
      const putRes = await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/pdf" },
        body: file,
      });
      if (!putRes.ok) {
        const putMsg = await putRes.text().catch(() => putRes.statusText);
        setPdfError(`Storage upload failed (${putRes.status}): ${putMsg}`);
        setSaveStatus("unsaved");
        return;
      }

      // 4. Save storage path + page count to the drawing record
      const pc = pdfDocRef.current?.numPages ?? 1;
      const patchRes = await fetch(`/api/takeoff-drawings/${drawingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfData: storagePath, pageCount: pc }),
      });
      if (!patchRes.ok) {
        const patchMsg = await patchRes.text().catch(() => `HTTP ${patchRes.status}`);
        setPdfError(`PDF uploaded but failed to save path to DB: ${patchMsg}. The PDF will be gone on reload.`);
        setSaveStatus("unsaved");
        return;
      }

      // 5. Update local state so switching drawings / reloading auto-loads correctly
      setDrawings(prev => prev.map(d =>
        d.id === drawingId ? { ...d, pdfData: storagePath, pageCount: pc } : d
      ));

      setSaveStatus("saved");
    } catch (err) {
      setPdfError(`Upload error: ${err instanceof Error ? err.message : String(err)}`);
      setSaveStatus("unsaved");
    }
  }

  // ── Load a different drawing ───────────────────────────────────────────────
  function switchDrawing(drawingId: string) {
    const d = drawings.find(x => x.id === drawingId);
    if (!d) return;
    setActiveDrawingId(drawingId);
    const mups = Array.isArray(d.markups) ? (d.markups as Markup[]) : [];
    const rts = Array.isArray(d.runTypes) && d.runTypes.length > 0
      ? (d.runTypes as RunType[]) : [DEFAULT_RUN_TYPE];
    const fxs = Array.isArray(d.fixtures) ? (d.fixtures as FixtureItem[]) : [];
    setMarkups(mups); markupsRef.current = mups;
    setRunTypes(rts); setActiveRunTypeId(rts[0].id);
    setFixtures(fxs); fixturesRef.current = fxs;
    setPageScales(d.pageScales ?? {}); pageScalesRef.current = d.pageScales ?? {};
    setCurrentPage(1); currentPageRef.current = 1;
    setTotalPages(d.pageCount ?? 1);
    setRunInProgress([]); runInProgressRef.current = [];
    setPdfLoaded(false);
    pdfDocRef.current = null;
    redrawAll(1, zoomRef.current, null);

    setPdfError(null);
    if (d.pdfData) {
      if (!d.pdfData.startsWith("takeoff-pdfs/") && d.pdfData.length > 200) {
        // Legacy base64
        loadPDFFromBase64(d.pdfData);
      } else if (d.pdfData.startsWith("takeoff-pdfs/")) {
        // Storage path — fetch from server
        setPdfLoading(true);
        fetch(`/api/takeoff-drawings/${drawingId}/upload-pdf`)
          .then(async res => {
            if (!res.ok) {
              const msg = await res.text().catch(() => `HTTP ${res.status}`);
              throw new Error(msg);
            }
            return res.arrayBuffer();
          })
          .then(ab => loadPDFFromBytes(new Uint8Array(ab)))
          .catch(err => {
            console.error("switchDrawing PDF load error:", err);
            setPdfError(`Failed to load PDF: ${err instanceof Error ? err.message : String(err)}`);
          })
          .finally(() => setPdfLoading(false));
      }
    }
  }

  // ── Create drawing ─────────────────────────────────────────────────────────
  async function createDrawing() {
    const name = prompt("Drawing name:", "Sheet A1");
    if (!name) return;
    const resp = await fetch("/api/takeoff-drawings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estimateId, name }),
    });
    const d: SerializedDrawing = {
      ...(await resp.json()),
      pdfData: null, markups: [], runTypes: [DEFAULT_RUN_TYPE],
      assemblies: [], pageScales: {}, fixtures: [],
    };
    setDrawings(prev => [...prev, d]);
    switchDrawing(d.id);
  }

  // ── Autosave ───────────────────────────────────────────────────────────────
  function scheduleAutosave(patch: Record<string, unknown>) {
    setSaveStatus("unsaved");
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(async () => {
      if (!activeDrawingId) return;
      setSaveStatus("saving");
      try {
        await fetch(`/api/takeoff-drawings/${activeDrawingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        setSaveStatus("saved");
      } catch { setSaveStatus("unsaved"); }
    }, AUTOSAVE_DELAY);
  }

  // ── Transfer to estimator ──────────────────────────────────────────────────
  async function transferRun(markupId: string) {
    const drawingId = activeDrawingIdRef.current;
    if (!drawingId) return;
    const m = markupsRef.current.find(x => x.id === markupId);
    if (!m || m.type !== "run") return;
    // Use runTypesRef to avoid stale closure
    const rt = runTypesRef.current.find(r => r.id === m.runTypeId) ?? runTypesRef.current[0];
    if (!rt) return;

    const footage = m.footage ?? 0;
    let body: Record<string, unknown>;

    if (rt.category === "MC" || rt.category === "NM") {
      // MC/NM home run — wire size is stored in rt.size
      const wireSize = rt.size.replace("#", "");
      body = {
        type: "mcHomeRun",
        data: {
          mcSize: wireSize,
          footage,
          circuits: 1,
          label: `${rt.label} — ${footage}ft`,
        },
      };
    } else {
      // Conduit run — map UI category to COND_MAP key
      const condTypeMap: Record<string, string> = {
        "EMT":    "EMT",
        "PVC":    "Sch40 PVC",
        "Rigid":  "Rigid",
        "Custom": "EMT",   // fallback
      };
      const condType = condTypeMap[rt.category] ?? "EMT";
      const phaseCount = rt.conductors.filter(c => !c.isGround).reduce((s, c) => s + c.count, 0);
      const phaseSize = rt.conductors.find(c => !c.isGround)?.size?.replace("#", "") ?? "12";
      body = {
        type: "conduitRun",
        data: {
          conduitType: condType,
          conduitSize: rt.size,
          conductorCount: phaseCount,
          conductorSize: phaseSize,
          footage,
          difficulty: rt.difficulty ?? 1.0,
          label: `${rt.label} — ${footage}ft`,
        },
      };
    }

    try {
      const res = await fetch(`/api/takeoff-drawings/${drawingId}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        alert(`Transfer failed (${res.status}): ${msg}`);
        return;
      }
    } catch (err) {
      alert(`Transfer error: ${err}`);
      return;
    }

    setMarkups(prev => {
      const next = prev.map(x => x.id === markupId ? { ...x, transferred: true } : x);
      markupsRef.current = next;
      scheduleAutosave({ markups: next });
      redrawAll(currentPageRef.current, zoomRef.current, null);
      return next;
    });
  }

  async function transferAllRuns() {
    const pending = markupsRef.current.filter(m => m.type === "run" && !m.transferred);
    for (const m of pending) await transferRun(m.id);
  }

  // ── Sync to counter tool ───────────────────────────────────────────────────
  function syncToCounter() {
    const JOBS_KEY = "ore_jobs_v1";
    let jobs: Record<string, any> = {};
    try { jobs = JSON.parse(localStorage.getItem(JOBS_KEY) ?? "{}") || {}; } catch {}
    const jobKeys = Object.keys(jobs);
    if (!jobKeys.length) {
      alert("No counter job found. Open the counter tool first, then sync.");
      return;
    }
    const jobKey = jobKeys[jobKeys.length - 1];
    const job = jobs[jobKey];
    if (!job?.areas?.length) { alert("Counter job has no areas."); return; }
    const area = job.areas[job.currentAreaIdx ?? 0] ?? job.areas[0];
    if (!area.counts) area.counts = {};

    // Push symbol counts
    for (const m of markupsRef.current) {
      if (m.type !== "symbol" || !m.itemKey) continue;
      area.counts[m.itemKey] = (area.counts[m.itemKey] ?? 0) + 1;
    }
    // Push conduit/run footage
    for (const m of markupsRef.current) {
      if (m.type !== "run") continue;
      const rt = runTypesRef.current.find(r => r.id === m.runTypeId) ?? runTypesRef.current[0];
      if (!rt) continue;
      const ft = Math.round(m.footage ?? 0);
      if (!ft) continue;
      let key = "";
      if (rt.category === "EMT")    key = `conduit_emt_${rt.size.replace(/[^0-9a-z]/gi, "_").toLowerCase()}`;
      if (rt.category === "PVC")    key = `conduit_pvc_${rt.size.replace(/[^0-9a-z]/gi, "_").toLowerCase()}`;
      if (rt.category === "Rigid")  key = "conduit_rigid";
      if (rt.category === "MC" || rt.category === "NM")
                                    key = `mc_${rt.size.replace(/[^a-z0-9]/gi, "_").toLowerCase()}`;
      if (rt.category === "Custom") key = `run_custom_${rt.id}`;
      if (key) area.counts[key] = (area.counts[key] ?? 0) + ft;
    }

    jobs[jobKey] = job;
    localStorage.setItem(JOBS_KEY, JSON.stringify(jobs));
    alert(`Synced to counter: ${job.name ?? jobKey}`);
  }

  // ── Context menu & hit detection ──────────────────────────────────────────
  function getMarkupAtPoint(px: number, py: number): Markup | null {
    const z = zoomRef.current;
    const page = currentPageRef.current;
    // Symbols first (18px screen radius)
    for (let i = markupsRef.current.length - 1; i >= 0; i--) {
      const m = markupsRef.current[i];
      if (m.page !== page) continue;
      if (m.type === "symbol" && m.x != null && m.y != null) {
        if (Math.hypot(px - m.x, py - m.y) <= 18 / z) return m;
      }
    }
    // Runs (8px screen distance from any segment)
    for (let i = markupsRef.current.length - 1; i >= 0; i--) {
      const m = markupsRef.current[i];
      if (m.page !== page) continue;
      if (m.type === "run" && m.points && m.points.length >= 2) {
        for (let j = 1; j < m.points.length; j++) {
          if (distToSegment({ x: px, y: py }, m.points[j - 1], m.points[j]) <= 8 / z) return m;
        }
      }
    }
    return null;
  }

  function ctxDelete() {
    if (!contextMenu) return;
    const id = contextMenu.markup.id;
    setContextMenu(null);
    setMarkups(prev => {
      const next = prev.filter(m => m.id !== id);
      markupsRef.current = next;
      scheduleAutosave({ markups: next });
      return next;
    });
    requestAnimationFrame(() => redrawAll(currentPageRef.current, zoomRef.current, null));
  }

  function ctxRotate() {
    if (!contextMenu) return;
    const id = contextMenu.markup.id;
    setContextMenu(null);
    setMarkups(prev => {
      const next = prev.map(m => m.id === id ? { ...m, rotation: ((m.rotation ?? 0) + 90) % 360 } : m);
      markupsRef.current = next;
      scheduleAutosave({ markups: next });
      return next;
    });
    requestAnimationFrame(() => redrawAll(currentPageRef.current, zoomRef.current, null));
  }

  function ctxSaveTag() {
    setMarkups(prev => {
      const next = prev.map(m => m.id === editTagMarkupId ? { ...m, tag: editTagValue } : m);
      markupsRef.current = next;
      scheduleAutosave({ markups: next });
      return next;
    });
    setEditTagModal(false);
    requestAnimationFrame(() => redrawAll(currentPageRef.current, zoomRef.current, null));
  }

  function ctxSaveFootage() {
    const val = parseFloat(editFootageValue);
    if (isNaN(val) || val < 0) return;
    setMarkups(prev => {
      const next = prev.map(m => m.id === editFootageMarkupId ? { ...m, footageOverride: val } : m);
      markupsRef.current = next;
      scheduleAutosave({ markups: next });
      return next;
    });
    setEditFootageModal(false);
    requestAnimationFrame(() => redrawAll(currentPageRef.current, zoomRef.current, null));
  }

  function ctxChangeRunType() {
    const rt = runTypes.find(r => r.id === changeRTId);
    if (!rt) return;
    setMarkups(prev => {
      const next = prev.map(m => m.id === changeRTMarkupId ? { ...m, runTypeId: changeRTId, color: rt.color } : m);
      markupsRef.current = next;
      scheduleAutosave({ markups: next });
      return next;
    });
    setChangeRTModal(false);
    requestAnimationFrame(() => redrawAll(currentPageRef.current, zoomRef.current, null));
  }

  // ── Fixture functions ─────────────────────────────────────────────────────
  function handleFixtureClick(pos: Pt) {
    const fixture = fixturesRef.current.find(f => f.id === selectedFixtureId);
    if (!fixture) return;
    const m: Markup = {
      id: genId(), type: "symbol", page: currentPageRef.current,
      symId: "dot", x: pos.x, y: pos.y, size: MARKER_SIZE,
      color: fixture.color, rotation: 0,
      isFixture: true, fixtureId: fixture.id, tag: fixture.tag,
    };
    setMarkups(prev => {
      const next = [...prev, m]; markupsRef.current = next;
      scheduleAutosave({ markups: next }); return next;
    });
    requestAnimationFrame(() => redrawAll(currentPageRef.current, zoomRef.current, null));
  }

  function saveNewFixture() {
    if (!fixTag.trim()) return;
    const f: FixtureItem = {
      id: genId(),
      tag: fixTag.trim().toUpperCase(),
      description: fixDescription.trim(),
      manufacturer: fixManufacturer.trim(),
      baseType: fixBaseType,
      color: fixColor,
      notes: fixNotes.trim(),
    };
    setFixtures(prev => {
      const next = [...prev, f];
      fixturesRef.current = next;
      scheduleAutosave({ fixtures: next });
      return next;
    });
    setSelectedFixtureId(f.id);
    setShowFixtureForm(false);
    setFixTag(""); setFixDescription(""); setFixManufacturer(""); setFixNotes("");
    setFixBaseType(FIXTURE_BASE_TYPES[0]); setFixColor("#3a8fe8");
  }

  function exportFixtureSchedule() {
    const schedule = fixturesRef.current.map(f => ({
      ...f,
      count: markupsRef.current.filter(m => m.isFixture && m.fixtureId === f.id).length,
    }));
    const blob = new Blob([JSON.stringify(schedule, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `fixture-schedule-${Date.now()}.json`;
    a.click(); URL.revokeObjectURL(url);
  }

  // ── Computed audit data ────────────────────────────────────────────────────
  const symbolCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const m of markups)
      if (m.type === "symbol" && m.itemKey) c[m.itemKey] = (c[m.itemKey] ?? 0) + 1;
    return c;
  }, [markups]);

  const auditData = useMemo(() => {
    // Symbol counts grouped by category
    const byCat: Record<string, Array<{ label: string; count: number }>> = {};
    for (const m of markups) {
      if (m.type !== "symbol" || !m.itemKey) continue;
      const item = STD_ITEMS.find(i => i.key === m.itemKey);
      if (!item) continue;
      const cat = item.category;
      if (!byCat[cat]) byCat[cat] = [];
      const ex = byCat[cat].find(e => e.label === item.label);
      if (ex) ex.count++;
      else byCat[cat].push({ label: item.label, count: 1 });
    }
    // Run totals by run type
    const rtTotals: Record<string, { rt: RunType; ft: number; segs: number }> = {};
    for (const m of markups) {
      if (m.type !== "run") continue;
      const rt = runTypes.find(r => r.id === m.runTypeId) ?? runTypes[0];
      if (!rt) continue;
      if (!rtTotals[rt.id]) rtTotals[rt.id] = { rt, ft: 0, segs: 0 };
      rtTotals[rt.id].ft += m.footage ?? 0;
      rtTotals[rt.id].segs++;
    }
    // Wire totals (conductor count × conduit footage)
    const wire: Record<string, number> = {};
    for (const { rt, ft } of Object.values(rtTotals)) {
      for (const c of rt.conductors) {
        const lbl = `${c.count}×${c.size} ${c.type}${c.isGround ? " (GND)" : ""}`;
        wire[lbl] = (wire[lbl] ?? 0) + Math.round(ft) * c.count;
      }
    }
    // Fixture counts
    const fixtureCounts: Array<{ tag: string; description: string; color: string; count: number }> = [];
    for (const f of fixtures) {
      const count = markups.filter(m => m.isFixture && m.fixtureId === f.id).length;
      if (count > 0) fixtureCounts.push({ tag: f.tag, description: f.description, color: f.color, count });
    }
    return { byCat, rtTotals, wire, fixtureCounts };
  }, [markups, runTypes, fixtures]);

  const currentPxPerFoot = pageScales[String(currentPage)];
  const scaleLabel = currentPxPerFoot
    ? `1"=${Math.round(((SCREEN_DPI * BASE_SCALE) / currentPxPerFoot) * 10) / 10}'`
    : "No scale";

  // ── Add run type ───────────────────────────────────────────────────────────
  function openRunTypeForm() {
    setRtfLabel("");
    setRtfCategory("EMT");
    setRtfSize("3/4");
    setRtfPhaseCount(2);
    setRtfPhaseSize("#12");
    setRtfHasGround(true);
    setRtfGroundCount(1);
    setRtfGroundSize("#12"); // NEC 250.122 default for #12 phase
    setRtfColor("#f0a500");
    setRtfDifficulty(1.0);
    setShowRunTypeForm(true);
  }

  function saveNewRunType() {
    const conductors: RunType["conductors"] = [
      { count: rtfPhaseCount, size: rtfPhaseSize, type: "THHN", isGround: false },
    ];
    if (rtfHasGround) {
      conductors.push({ count: rtfGroundCount, size: rtfGroundSize, type: "THHN", isGround: true });
    }

    const isMC = rtfCategory === "MC" || rtfCategory === "NM";
    const gndPart = rtfHasGround ? ` + ${rtfGroundCount}×${rtfGroundSize} GND` : "";
    const autoLabel = rtfLabel.trim() ||
      (isMC
        ? `${rtfCategory} ${rtfPhaseSize}/2 — ${rtfPhaseCount} ckt`
        : `${rtfSize}" ${rtfCategory} | ${rtfPhaseCount}×${rtfPhaseSize}${gndPart}`);

    const rt: RunType = {
      id: genId(),
      category: rtfCategory,
      size: rtfSize,
      conductors,
      material: "Cu",
      support: "1-Hole Strap",
      makeup: 2,
      difficulty: rtfDifficulty,
      color: rtfColor,
      label: autoLabel,
    };
    setRunTypes(prev => {
      const next = [...prev, rt];
      runTypesRef.current = next;
      scheduleAutosave({ runTypes: next });
      return next;
    });
    setActiveRunTypeId(rt.id);
    setShowRunTypeForm(false);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const S = styles;

  return (
    <div style={S.root}>
      {/* HEADER */}
      <header style={S.header}>
        <span style={S.logo}>OAK RIDGE <span style={S.logoSub}>/ TAKEOFF</span></span>
        <div style={S.sep} />
        <span style={S.estName}>{estimate.estimateNumber} — {estimate.name}</span>

        {/* Drawing selector */}
        <select
          value={activeDrawingId ?? ""}
          onChange={e => switchDrawing(e.target.value)}
          style={S.hdrSelect}
        >
          {drawings.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <HBtn onClick={createDrawing}>+ Sheet</HBtn>

        <div style={{ flex: 1 }} />

        {/* Page nav */}
        <PageNav current={currentPage} total={totalPages} pdfLoaded={pdfLoaded} onGo={goPage} />
        <div style={S.sep} />

        {/* Mode buttons */}
        {(["count", "run", "pan", "fixtures"] as Mode[]).map(m => (
          <button key={m} onClick={() => {
            setMode(m); modeRef.current = m;
            if (m !== "run") { setRunInProgress([]); runInProgressRef.current = []; redrawAll(currentPageRef.current, zoomRef.current, null); }
          }} style={{ ...S.modeBtn, ...(mode === m ? S.modeBtnActive : {}) }}>
            {m.toUpperCase()[0]}
          </button>
        ))}

        {/* Zoom */}
        <div style={S.zoomRow}>
          <button onClick={() => applyZoom(-0.10)} style={S.hdrBtn}>−</button>
          <span style={S.zoomLabel}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => applyZoom(0.10)} style={S.hdrBtn}>+</button>
          <button onClick={zoomFit} style={S.hdrBtn}>⊡</button>
        </div>

        {/* Scale */}
        <span style={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace", color: currentPxPerFoot ? "#2db562" : "#e03a3a", whiteSpace: "nowrap" }}>
          {scaleLabel}
        </span>

        {/* PDF upload */}
        <label style={{ ...S.hdrBtn, cursor: "pointer" }}>
          📄 PDF
          <input type="file" accept=".pdf,.PDF,application/pdf" style={{ display: "none" }} onChange={handleFileUpload} />
        </label>

        {/* Sync to counter */}
        <HBtn onClick={syncToCounter}>⇅ Sync</HBtn>
        {/* Export fixture schedule (fixtures mode only) */}
        {mode === "fixtures" && fixtures.length > 0 && (
          <HBtn onClick={exportFixtureSchedule}>↓ Schedule</HBtn>
        )}

        {/* Save status */}
        <span style={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace", color: saveStatus === "saved" ? "#2db562" : saveStatus === "saving" ? "#f0a500" : "#e03a3a" }}>
          {saveStatus === "saved" ? "Saved ✓" : saveStatus === "saving" ? "Saving…" : "Unsaved"}
        </span>

        <button onClick={() => router.push(`/estimating/${estimateId}`)} style={{ ...S.hdrBtn, padding: "5px 10px" }}>✕</button>
      </header>

      {/* Scale banner */}
      {scaleBannerVisible && (
        <div style={S.scaleBanner}>
          ⚠ No scale set for page {currentPage} — distances will show 0ft
          <select defaultValue="" onChange={e => { if (e.target.value) applyScalePreset(parseFloat(e.target.value)); }}
            style={{ background: "#111", border: "none", color: "#f0a500", borderRadius: 4, padding: "2px 6px", fontFamily: "inherit", fontSize: 12, marginLeft: 8 }}>
            <option value="">Quick set…</option>
            {SCALE_PRESETS.map(p => <option key={p.label} value={p.feetPerInch}>{p.label}</option>)}
          </select>
          <button onClick={() => { setMeasuringActive(true); measuringActiveRef.current = true; setMeasurePt1(null); measurePt1Ref.current = null; }}
            style={{ marginLeft: 8, background: "none", border: "1px solid #111", borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
            Measure distance
          </button>
          <button onClick={() => setScaleBannerVisible(false)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#111" }}>✕</button>
        </div>
      )}

      {/* BODY */}
      <div style={S.body}>
        {/* LEFT PANEL */}
        <aside style={S.leftPanel}>
          {/* Scrollable top content */}
          <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
            {/* Scale */}
            <Section label="Scale">
              <select defaultValue="" onChange={e => { if (e.target.value) applyScalePreset(parseFloat(e.target.value)); }} style={S.panelSelect}>
                <option value="">— preset —</option>
                {SCALE_PRESETS.map(p => <option key={p.label} value={p.feetPerInch}>{p.label}</option>)}
              </select>
              <button
                onClick={() => { setMeasuringActive(v => !v); if (!measuringActiveRef.current) { setMeasurePt1(null); measurePt1Ref.current = null; } measuringActiveRef.current = !measuringActiveRef.current; }}
                style={{ ...S.panelBtn, marginTop: 4, borderColor: measuringActive ? "#FF5910" : "#2e3138", color: measuringActive ? "#FF5910" : "#9aa0ab" }}>
                {measuringActive ? "Click first point…" : "Measure distance"}
              </button>
              <div style={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace", color: currentPxPerFoot ? "#2db562" : "#5a6070", marginTop: 4 }}>
                {currentPxPerFoot ? `✓ ${scaleLabel}` : "No scale set"}
              </div>
            </Section>

            {/* Symbols (COUNT mode) */}
            {mode === "count" && (
              <Section label="Symbol">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 2, marginBottom: 6 }}>
                  {CATEGORY_TABS.map(tab => (
                    <button key={tab.id} onClick={() => setLeftPanelTab(tab.id)}
                      style={{ background: leftPanelTab === tab.id ? "#FF5910" : "#22252b", border: `1px solid ${leftPanelTab === tab.id ? "#FF5910" : "#2e3138"}`, color: leftPanelTab === tab.id ? "#111" : "#9aa0ab", borderRadius: 4, fontFamily: "inherit", fontSize: 10, fontWeight: 700, padding: "3px 5px", cursor: "pointer", textTransform: "uppercase" }}>
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {STD_ITEMS.filter(item => CATEGORY_TABS.find(t => t.id === leftPanelTab)?.categories.includes(item.category)).map(item => {
                    const color = CAT_COLORS[item.category] ?? "#9aa0ab";
                    const active = selectedItemKey === item.key;
                    const cnt = symbolCounts[item.key] ?? 0;
                    return (
                      <button key={item.key} onClick={() => { setSelectedItemKey(item.key); setSelectedColor(color); }}
                        style={{ display: "flex", alignItems: "center", gap: 6, background: active ? "rgba(240,165,0,0.08)" : cnt > 0 ? "#1a1e12" : "#22252b", border: `1px solid ${active ? "#f0a500" : cnt > 0 ? "#3a3f20" : "#2e3138"}`, borderRadius: 5, padding: "5px 7px", cursor: "pointer", textAlign: "left", width: "100%" }}>
                        <SymPreview symId={item.symId} color={color} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: active ? "#e8eaed" : "#9aa0ab", flex: 1, lineHeight: 1.2 }}>{item.label}</span>
                        <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: cnt > 0 ? "#f0a500" : "#5a6070", fontWeight: 700, flexShrink: 0 }}>
                          {cnt}<span style={{ fontSize: 9, color: "#5a6070" }}> e</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.1em", color: "#5a6070", textTransform: "uppercase", marginBottom: 4 }}>Color</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {Object.values(CAT_COLORS).map(c => (
                      <div key={c} onClick={() => setSelectedColor(c)}
                        style={{ width: 18, height: 18, borderRadius: 3, background: c, cursor: "pointer", border: `2px solid ${selectedColor === c ? "#fff" : "transparent"}`, transition: "transform 0.1s", transform: selectedColor === c ? "scale(1.15)" : "scale(1)" }} />
                    ))}
                  </div>
                </div>
              </Section>
            )}

            {/* Fixture types (FIXTURES mode) */}
            {mode === "fixtures" && (
              <Section label="Fixtures">
                {fixtures.length === 0 && (
                  <div style={{ fontSize: 11, color: "#5a6070", marginBottom: 8 }}>No fixture types yet</div>
                )}
                {fixtures.map(f => {
                  const cnt = markups.filter(m => m.isFixture && m.fixtureId === f.id).length;
                  const active = selectedFixtureId === f.id;
                  return (
                    <button key={f.id} onClick={() => setSelectedFixtureId(f.id)}
                      style={{ display: "flex", alignItems: "center", gap: 6, background: active ? "rgba(58,143,232,0.08)" : "#22252b", border: `1px solid ${active ? "#3a8fe8" : "#2e3138"}`, borderRadius: 5, padding: "5px 7px", cursor: "pointer", width: "100%", marginBottom: 3, textAlign: "left" }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: f.color, border: "1.5px solid rgba(255,255,255,0.2)", flexShrink: 0 }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: active ? "#e8eaed" : "#9aa0ab", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.tag}</span>
                      <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: cnt > 0 ? "#f0a500" : "#5a6070", fontWeight: 700, flexShrink: 0 }}>
                        {cnt}<span style={{ fontSize: 9, color: "#5a6070" }}> e</span>
                      </span>
                    </button>
                  );
                })}
                <button onClick={() => setShowFixtureForm(true)} style={{ ...S.panelBtn, marginTop: 4, borderStyle: "dashed" }}>+ Fixture Type</button>
                <div style={{ marginTop: 6, fontSize: 10, color: "#5a6070" }}>Select type · click to place</div>
              </Section>
            )}

            {/* Run types (RUN mode) */}
            {mode === "run" && (
              <Section label="Run Type">
                {runTypes.map(rt => (
                  <button key={rt.id} onClick={() => setActiveRunTypeId(rt.id)}
                    style={{ display: "flex", alignItems: "center", gap: 6, background: activeRunTypeId === rt.id ? "rgba(240,165,0,0.08)" : "#22252b", border: `1px solid ${activeRunTypeId === rt.id ? "#f0a500" : "#2e3138"}`, borderRadius: 5, padding: "5px 7px", cursor: "pointer", width: "100%", marginBottom: 3, textAlign: "left" }}>
                    <div style={{ width: 10, height: 3, background: rt.color, borderRadius: 1, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#9aa0ab", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rt.label}</span>
                  </button>
                ))}
                <button onClick={openRunTypeForm} style={{ ...S.panelBtn, marginTop: 4, borderStyle: "dashed" }}>+ Run Type</button>
                <div style={{ marginTop: 8, fontSize: 10, color: "#5a6070" }}>
                  Ortho: <button onClick={() => { const v = !orthoSnap; setOrthoSnap(v); orthoSnapRef.current = v; }}
                    style={{ background: "none", border: "none", color: orthoSnap ? "#2db562" : "#9aa0ab", cursor: "pointer", fontFamily: "inherit", fontSize: 10 }}>
                    {orthoSnap ? "ON" : "OFF"}
                  </button>
                </div>
                <div style={{ marginTop: 2, fontSize: 10, color: "#5a6070" }}>Enter = finish · Esc = cancel</div>
              </Section>
            )}
          </div>

          {/* AUDIT TRAIL — collapsible, pinned to bottom of left sidebar */}
          <div style={{ borderTop: "1px solid #2e3138", flexShrink: 0 }}>
            <button
              onClick={() => setAuditOpen(v => !v)}
              style={{ width: "100%", background: "none", border: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 12px", cursor: "pointer" }}
            >
              <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.15em", color: "#5a6070", textTransform: "uppercase" }}>Audit Trail</span>
              <span style={{ fontSize: 10, color: "#5a6070" }}>{auditOpen ? "▲" : "▼"}</span>
            </button>
            {auditOpen && (
              <div style={{ maxHeight: 300, overflowY: "auto", paddingBottom: 8 }}>
                {/* Symbol counts by category */}
                {CAT_ORDER.map(cat => {
                  const items = auditData.byCat[cat];
                  if (!items || items.length === 0) return null;
                  const subtotal = items.reduce((s, i) => s + i.count, 0);
                  return (
                    <div key={cat}>
                      <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.12em", color: "#5a6070", textTransform: "uppercase", padding: "5px 12px 2px" }}>
                        {cat} ({subtotal})
                      </div>
                      {items.map(item => (
                        <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1px 12px 1px 18px" }}>
                          <span style={{ fontSize: 11, color: "#9aa0ab", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
                          <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "#f0a500", fontWeight: 700, flexShrink: 0, marginLeft: 6 }}>
                            {item.count}<span style={{ fontSize: 9, color: "#5a6070" }}> ea</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })}
                {/* Conduit runs */}
                {Object.keys(auditData.rtTotals).length > 0 && (
                  <>
                    <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.12em", color: "#5a6070", textTransform: "uppercase", padding: "5px 12px 2px" }}>Conduit</div>
                    {Object.values(auditData.rtTotals).map(({ rt, ft, segs }) => {
                      const totalFt = Math.round(ft);
                      const avg = segs > 0 ? Math.round(ft / segs) : 0;
                      return (
                        <div key={rt.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "1px 12px 1px 18px" }}>
                          <span style={{ fontSize: 11, color: "#9aa0ab", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rt.label}</span>
                          <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "#f0a500", flexShrink: 0, marginLeft: 6, whiteSpace: "nowrap" }}>
                            {totalFt.toLocaleString()}' /{segs}r ~{avg}'
                          </span>
                        </div>
                      );
                    })}
                  </>
                )}
                {/* Wire (calculated from conduit footage × conductors) */}
                {Object.keys(auditData.wire).length > 0 && (
                  <>
                    <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.12em", color: "#5a6070", textTransform: "uppercase", padding: "5px 12px 2px" }}>Wire (Calculated)</div>
                    {Object.entries(auditData.wire).map(([lbl, footage]) => (
                      <div key={lbl} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1px 12px 1px 18px" }}>
                        <span style={{ fontSize: 11, color: "#9aa0ab", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lbl}</span>
                        <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "#f0a500", fontWeight: 700, flexShrink: 0, marginLeft: 6 }}>
                          {footage.toLocaleString()}<span style={{ fontSize: 9, color: "#5a6070" }}> ft</span>
                        </span>
                      </div>
                    ))}
                  </>
                )}
                {/* Fixture schedule counts */}
                {auditData.fixtureCounts.length > 0 && (
                  <>
                    <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.12em", color: "#5a6070", textTransform: "uppercase", padding: "5px 12px 2px" }}>
                      Fixtures ({auditData.fixtureCounts.reduce((s, f) => s + f.count, 0)})
                    </div>
                    {auditData.fixtureCounts.map(f => (
                      <div key={f.tag} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1px 12px 1px 18px" }}>
                        <span style={{ fontSize: 11, color: "#9aa0ab", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>[{f.tag}] {f.description || f.tag}</span>
                        <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "#f0a500", fontWeight: 700, flexShrink: 0, marginLeft: 6 }}>
                          {f.count}<span style={{ fontSize: 9, color: "#5a6070" }}> ea</span>
                        </span>
                      </div>
                    ))}
                  </>
                )}
                {Object.keys(auditData.byCat).length === 0 && Object.keys(auditData.rtTotals).length === 0 && auditData.fixtureCounts.length === 0 && (
                  <div style={{ fontSize: 11, color: "#5a6070", padding: "4px 12px" }}>No items placed yet</div>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* CANVAS */}
        <div ref={canvasWrapRef} style={{ ...S.canvasWrap, cursor: (mode === "pan" || spaceHeld.current) ? "grab" : "crosshair" }}>
          <div style={{ position: "relative", display: "inline-block", minWidth: "100%", minHeight: "100%" }}>
            {pdfLoading && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(17,18,20,0.85)", zIndex: 10 }}>
                <div style={{ fontSize: 15, color: "#FF5910", fontWeight: 700, letterSpacing: "0.1em" }}>Loading PDF…</div>
              </div>
            )}
            {pdfError && pdfLoaded && (
              <div style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", background: "#1e1010", border: "1px solid #e03a3a", borderRadius: 8, padding: "8px 14px", zIndex: 20, display: "flex", alignItems: "center", gap: 10, maxWidth: 420 }}>
                <span style={{ fontSize: 12, color: "#e03a3a" }}>⚠ {pdfError}</span>
                <button onClick={() => setPdfError(null)} style={{ background: "none", border: "none", color: "#9aa0ab", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0, flexShrink: 0 }}>✕</button>
              </div>
            )}
            {!pdfLoaded && !pdfLoading && (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, pointerEvents: "none" }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#2e3138", textTransform: "uppercase", letterSpacing: "0.1em" }}>No Drawing Loaded</div>
                {pdfError ? (
                  <div style={{ fontSize: 13, color: "#e03a3a", textAlign: "center", maxWidth: 360, background: "rgba(224,58,58,0.1)", border: "1px solid #e03a3a", borderRadius: 8, padding: "10px 16px", pointerEvents: "all", lineHeight: 1.5 }}>
                    ⚠ {pdfError}
                    <button onClick={() => setPdfError(null)} style={{ display: "block", marginTop: 8, background: "none", border: "none", color: "#9aa0ab", cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>Dismiss</button>
                  </div>
                ) : (
                  <div style={{ fontSize: 14, color: "#2e3138", textAlign: "center", maxWidth: 280 }}>Upload a PDF to begin</div>
                )}
                <label style={{ pointerEvents: "all", background: "#FF5910", border: "none", borderRadius: 8, color: "#111", fontFamily: "inherit", fontSize: 15, fontWeight: 900, letterSpacing: "0.08em", padding: "12px 24px", cursor: "pointer", textTransform: "uppercase" }}>
                  📄 Load PDF
                  <input type="file" accept=".pdf,.PDF,application/pdf" style={{ display: "none" }} onChange={handleFileUpload} />
                </label>
              </div>
            )}
            <canvas ref={pdfCanvasRef} style={{ display: "block" }} />
            <canvas ref={markupCanvasRef}
              style={{ position: "absolute", top: 0, left: 0 }}
              onClick={handleClick}
              onDoubleClick={handleDblClick}
              onContextMenu={handleRightClick}
              onMouseMove={handleMouseMove}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
            />
          </div>
          {/* Float zoom controls */}
          <div style={{ position: "absolute", bottom: 16, right: 16, display: "flex", flexDirection: "column", gap: 4, zIndex: 40 }}>
            <ZBtn onClick={() => applyZoom(0.10)}>+</ZBtn>
            <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "#5a6070", textAlign: "center" }}>{Math.round(zoom * 100)}%</div>
            <ZBtn onClick={() => applyZoom(-0.10)}>−</ZBtn>
            <ZBtn onClick={zoomFit}>⊡</ZBtn>
          </div>
        </div>

      </div>

      {/* RUN TYPE FORM MODAL */}
      {showRunTypeForm && (
        <div style={S.modalOverlay}>
          <div style={{ ...S.modalBox, width: 360 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", color: "#FF5910" }}>New Run Type</h3>
              <button onClick={() => setShowRunTypeForm(false)} style={{ background: "none", border: "none", color: "#5a6070", cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>

            {/* Category */}
            <label style={S.modalLabel}>Category</label>
            <select value={rtfCategory} onChange={e => {
              const cat = e.target.value as RunType["category"];
              setRtfCategory(cat);
              setRtfSize(cat === "MC" || cat === "NM" ? "#12" : "3/4");
            }} style={S.modalInput}>
              <option value="EMT">EMT</option>
              <option value="PVC">PVC (Sch40)</option>
              <option value="Rigid">Rigid</option>
              <option value="MC">MC Cable</option>
              <option value="NM">NM-B</option>
              <option value="Custom">Custom</option>
            </select>

            {/* Size */}
            <label style={S.modalLabel}>{rtfCategory === "MC" || rtfCategory === "NM" ? "Wire Size" : "Conduit Size"}</label>
            {rtfCategory === "MC" || rtfCategory === "NM" ? (
              <select value={rtfSize} onChange={e => setRtfSize(e.target.value)} style={S.modalInput}>
                {["#14", "#12", "#10", "#8", "#6"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            ) : (
              <select value={rtfSize} onChange={e => setRtfSize(e.target.value)} style={S.modalInput}>
                {["1/2", "3/4", "1", "1-1/4", "1-1/2", "2", "3", "4"].map(s => <option key={s} value={s}>{s}"</option>)}
              </select>
            )}

            {/* Conductors — conduit runs only */}
            {rtfCategory !== "MC" && rtfCategory !== "NM" && (
              <>
                {/* Phase conductors */}
                <label style={S.modalLabel}>Phase Conductors</label>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="number" min={1} max={20} value={rtfPhaseCount}
                    onChange={e => setRtfPhaseCount(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{ ...S.modalInput, width: 52 }} />
                  <span style={{ color: "#5a6070", fontSize: 13, flexShrink: 0 }}>×</span>
                  <select value={rtfPhaseSize} onChange={e => {
                    const sz = e.target.value;
                    setRtfPhaseSize(sz);
                    // Auto-suggest NEC 250.122 minimum ground size
                    setRtfGroundSize(NEC_GROUND_TABLE[sz] ?? sz);
                  }} style={{ ...S.modalInput, flex: 1 }}>
                    {WIRE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <span style={{ color: "#5a6070", fontSize: 12, flexShrink: 0 }}>THHN</span>
                </div>

                {/* Ground conductor — independent size */}
                <label style={S.modalLabel}>Ground Conductor</label>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "nowrap" }}>
                  <input type="checkbox" checked={rtfHasGround}
                    onChange={e => setRtfHasGround(e.target.checked)}
                    style={{ accentColor: "#f0a500", width: 14, height: 14, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: "#9aa0ab", flexShrink: 0 }}>Include</span>
                  {rtfHasGround && (
                    <>
                      <input type="number" min={1} max={4} value={rtfGroundCount}
                        onChange={e => setRtfGroundCount(Math.max(1, parseInt(e.target.value) || 1))}
                        style={{ ...S.modalInput, width: 44 }} />
                      <span style={{ color: "#5a6070", fontSize: 13, flexShrink: 0 }}>×</span>
                      <select value={rtfGroundSize} onChange={e => setRtfGroundSize(e.target.value)}
                        style={{ ...S.modalInput, flex: 1 }}>
                        {WIRE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#2db562", flexShrink: 0 }}>GND</span>
                    </>
                  )}
                </div>
                {rtfHasGround && rtfGroundSize !== rtfPhaseSize && (
                  <div style={{ fontSize: 10, color: "#5a6070", marginTop: 2, paddingLeft: 1 }}>
                    NEC 250.122 — auto-sized from phase
                  </div>
                )}
              </>
            )}

            {/* Difficulty */}
            <label style={S.modalLabel}>Difficulty — {rtfDifficulty.toFixed(2)}×</label>
            <input type="range" min="0.75" max="2.0" step="0.05" value={rtfDifficulty}
              onChange={e => setRtfDifficulty(parseFloat(e.target.value))}
              style={{ width: "100%", accentColor: "#FF5910" }} />

            {/* Color */}
            <label style={S.modalLabel}>Line Color</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 2 }}>
              {["#f0a500", "#e03a3a", "#3a8fe8", "#2db562", "#b03ae0", "#e03a99", "#3adde0", "#e0773a", "#9aa0ab", "#FF5910"].map(c => (
                <div key={c} onClick={() => setRtfColor(c)}
                  style={{ width: 22, height: 22, borderRadius: 4, background: c, cursor: "pointer",
                    border: `2px solid ${rtfColor === c ? "#fff" : "transparent"}`,
                    transform: rtfColor === c ? "scale(1.15)" : "scale(1)", transition: "transform 0.1s" }} />
              ))}
            </div>

            {/* Label override */}
            <label style={S.modalLabel}>Label (auto-generated if blank)</label>
            <input type="text" value={rtfLabel} onChange={e => setRtfLabel(e.target.value)}
              placeholder={
                rtfCategory === "MC" || rtfCategory === "NM"
                  ? `${rtfCategory} ${rtfSize}/2 — ${rtfPhaseCount} ckt`
                  : `${rtfSize}" ${rtfCategory} | ${rtfPhaseCount}×${rtfPhaseSize}${rtfHasGround ? ` + ${rtfGroundCount}×${rtfGroundSize} GND` : ""}`
              }
              style={S.modalInput} />

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={() => setShowRunTypeForm(false)} style={S.btnCancel}>Cancel</button>
              <button onClick={saveNewRunType} style={S.btnConfirm}>Add Run Type</button>
            </div>
          </div>
        </div>
      )}

      {/* MEASURE MODAL */}
      {showMeasureModal && (
        <div style={S.modalOverlay}>
          <div style={S.modalBox}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", color: "#FF5910" }}>Set Scale</h3>
              <button onClick={() => { setShowMeasureModal(false); setMeasurePt1(null); measurePt1Ref.current = null; }} style={{ background: "none", border: "none", color: "#5a6070", cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: "#9aa0ab", marginBottom: 12 }}>Enter the real-world distance between the two points you marked.</p>
            <label style={S.modalLabel}>Real Distance (feet)</label>
            <input type="number" autoFocus value={measureDistInput}
              onChange={e => setMeasureDistInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") confirmMeasure(); }}
              placeholder="e.g. 20" min="0.1" step="0.5" style={S.modalInput} />
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={() => { setShowMeasureModal(false); setMeasurePt1(null); measurePt1Ref.current = null; }} style={S.btnCancel}>Cancel</button>
              <button onClick={confirmMeasure} style={S.btnConfirm}>Set Scale</button>
            </div>
          </div>
        </div>
      )}

      {/* CONTEXT MENU */}
      {contextMenu && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 299 }} onClick={() => setContextMenu(null)} />
          <div style={{ position: "fixed", top: contextMenu.y, left: contextMenu.x, background: "#1a1c20", border: "1px solid #2e3138", borderTop: "2px solid #FF5910", borderRadius: 8, boxShadow: "0 4px 24px rgba(0,0,0,0.7)", zIndex: 300, minWidth: 170, padding: "4px 0", fontFamily: "'Barlow Condensed', sans-serif" }}>
            {contextMenu.markup.type === "symbol" ? (<>
              <CtxItem onClick={ctxDelete}>🗑 Delete</CtxItem>
              {!contextMenu.markup.isFixture && <CtxItem onClick={ctxRotate}>↻ Rotate 90°</CtxItem>}
              <CtxItem onClick={() => { setEditTagValue(contextMenu.markup.tag ?? contextMenu.markup.label ?? ""); setEditTagMarkupId(contextMenu.markup.id); setEditTagModal(true); setContextMenu(null); }}>🏷 Rename Tag</CtxItem>
              <CtxItem onClick={() => { setPropsMarkup(contextMenu.markup); setPropsModal(true); setContextMenu(null); }}>ℹ Properties</CtxItem>
            </>) : (<>
              <CtxItem onClick={ctxDelete}>🗑 Delete Run</CtxItem>
              <CtxItem onClick={() => { setChangeRTId(contextMenu.markup.runTypeId ?? runTypes[0]?.id ?? ""); setChangeRTMarkupId(contextMenu.markup.id); setChangeRTModal(true); setContextMenu(null); }}>⇄ Change Run Type</CtxItem>
              <CtxItem onClick={() => { setEditFootageValue(String(contextMenu.markup.footageOverride ?? contextMenu.markup.footage ?? 0)); setEditFootageMarkupId(contextMenu.markup.id); setEditFootageModal(true); setContextMenu(null); }}>📏 Edit Footage</CtxItem>
              <CtxItem onClick={() => { setPropsMarkup(contextMenu.markup); setPropsModal(true); setContextMenu(null); }}>ℹ Properties</CtxItem>
            </>)}
          </div>
        </>
      )}

      {/* EDIT TAG MODAL */}
      {editTagModal && (
        <div style={S.modalOverlay}>
          <div style={S.modalBox}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", color: "#FF5910" }}>Rename Tag</h3>
              <button onClick={() => setEditTagModal(false)} style={{ background: "none", border: "none", color: "#5a6070", cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>
            <label style={S.modalLabel}>Tag Label</label>
            <input autoFocus type="text" value={editTagValue}
              onChange={e => setEditTagValue(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") ctxSaveTag(); if (e.key === "Escape") setEditTagModal(false); }}
              style={S.modalInput} />
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={() => setEditTagModal(false)} style={S.btnCancel}>Cancel</button>
              <button onClick={ctxSaveTag} style={S.btnConfirm}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT FOOTAGE MODAL */}
      {editFootageModal && (
        <div style={S.modalOverlay}>
          <div style={S.modalBox}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", color: "#FF5910" }}>Edit Footage</h3>
              <button onClick={() => setEditFootageModal(false)} style={{ background: "none", border: "none", color: "#5a6070", cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>
            <label style={S.modalLabel}>Footage (feet)</label>
            <input autoFocus type="number" min="0" step="0.5" value={editFootageValue}
              onChange={e => setEditFootageValue(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") ctxSaveFootage(); if (e.key === "Escape") setEditFootageModal(false); }}
              style={S.modalInput} />
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={() => setEditFootageModal(false)} style={S.btnCancel}>Cancel</button>
              <button onClick={ctxSaveFootage} style={S.btnConfirm}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* CHANGE RUN TYPE MODAL */}
      {changeRTModal && (
        <div style={S.modalOverlay}>
          <div style={S.modalBox}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", color: "#FF5910" }}>Change Run Type</h3>
              <button onClick={() => setChangeRTModal(false)} style={{ background: "none", border: "none", color: "#5a6070", cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>
            <label style={S.modalLabel}>Run Type</label>
            <select value={changeRTId} onChange={e => setChangeRTId(e.target.value)} style={S.modalInput}>
              {runTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.label}</option>)}
            </select>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={() => setChangeRTModal(false)} style={S.btnCancel}>Cancel</button>
              <button onClick={ctxChangeRunType} style={S.btnConfirm}>Apply</button>
            </div>
          </div>
        </div>
      )}

      {/* PROPERTIES MODAL */}
      {propsModal && propsMarkup && (
        <div style={S.modalOverlay}>
          <div style={S.modalBox}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", color: "#FF5910" }}>Properties</h3>
              <button onClick={() => setPropsModal(false)} style={{ background: "none", border: "none", color: "#5a6070", cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>
            <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12, color: "#9aa0ab", lineHeight: 1.9 }}>
              <div><span style={{ color: "#5a6070" }}>Type: </span>{propsMarkup.type}</div>
              {propsMarkup.type === "symbol" && <>
                {propsMarkup.isFixture
                  ? <div><span style={{ color: "#5a6070" }}>Tag: </span>{propsMarkup.tag}</div>
                  : <div><span style={{ color: "#5a6070" }}>Symbol: </span>{propsMarkup.symId}</div>}
                <div><span style={{ color: "#5a6070" }}>Pos: </span>{Math.round(propsMarkup.x ?? 0)}, {Math.round(propsMarkup.y ?? 0)}</div>
                {!propsMarkup.isFixture && <div><span style={{ color: "#5a6070" }}>Rotation: </span>{propsMarkup.rotation ?? 0}°</div>}
                <div><span style={{ color: "#5a6070" }}>Page: </span>{propsMarkup.page}</div>
              </>}
              {propsMarkup.type === "run" && <>
                <div><span style={{ color: "#5a6070" }}>Run Type: </span>{runTypes.find(r => r.id === propsMarkup.runTypeId)?.label ?? "—"}</div>
                <div><span style={{ color: "#5a6070" }}>Footage: </span>{propsMarkup.footageOverride ?? propsMarkup.footage ?? 0} ft{propsMarkup.footageOverride != null ? " (manual)" : ""}</div>
                <div><span style={{ color: "#5a6070" }}>Segments: </span>{(propsMarkup.points?.length ?? 1) - 1}</div>
                <div><span style={{ color: "#5a6070" }}>Page: </span>{propsMarkup.page}</div>
              </>}
            </div>
            <div style={{ marginTop: 16 }}>
              <button onClick={() => setPropsModal(false)} style={{ ...S.btnConfirm, width: "100%" }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* FIXTURE FORM MODAL */}
      {showFixtureForm && (
        <div style={S.modalOverlay}>
          <div style={{ ...S.modalBox, width: 360 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", color: "#FF5910" }}>New Fixture Type</h3>
              <button onClick={() => setShowFixtureForm(false)} style={{ background: "none", border: "none", color: "#5a6070", cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>
            <label style={S.modalLabel}>Tag (e.g. "A", "LP-1")</label>
            <input autoFocus type="text" value={fixTag} onChange={e => setFixTag(e.target.value)} placeholder="A" style={S.modalInput} />
            <label style={S.modalLabel}>Base Type</label>
            <select value={fixBaseType} onChange={e => setFixBaseType(e.target.value)} style={S.modalInput}>
              {FIXTURE_BASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <label style={S.modalLabel}>Description</label>
            <input type="text" value={fixDescription} onChange={e => setFixDescription(e.target.value)} placeholder="e.g. 2×4 LED Troffer 50W" style={S.modalInput} />
            <label style={S.modalLabel}>Manufacturer</label>
            <input type="text" value={fixManufacturer} onChange={e => setFixManufacturer(e.target.value)} placeholder="Lithonia, etc." style={S.modalInput} />
            <label style={S.modalLabel}>Marker Color</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 2 }}>
              {["#3a8fe8", "#e03a3a", "#2db562", "#f0a500", "#b03ae0", "#e03a99", "#3adde0", "#e0773a", "#9aa0ab", "#FF5910"].map(c => (
                <div key={c} onClick={() => setFixColor(c)}
                  style={{ width: 22, height: 22, borderRadius: 4, background: c, cursor: "pointer",
                    border: `2px solid ${fixColor === c ? "#fff" : "transparent"}`,
                    transform: fixColor === c ? "scale(1.15)" : "scale(1)", transition: "transform 0.1s" }} />
              ))}
            </div>
            <label style={S.modalLabel}>Notes</label>
            <input type="text" value={fixNotes} onChange={e => setFixNotes(e.target.value)} placeholder="Optional" style={S.modalInput} />
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={() => setShowFixtureForm(false)} style={S.btnCancel}>Cancel</button>
              <button onClick={saveNewFixture} style={S.btnConfirm}>Add Fixture</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ borderBottom: "1px solid #2e3138", padding: "10px 12px" }}>
      <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", color: "#5a6070", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  );
}

function HBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} style={styles.hdrBtn}>{children}</button>;
}

function ZBtn({ onClick, children, title }: { onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button onClick={onClick} title={title}
      style={{ background: "#1a1c20", border: "1px solid #2e3138", borderRadius: 8, color: "#9aa0ab", fontSize: 16, width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>
      {children}
    </button>
  );
}

function PageNav({ current, total, pdfLoaded, onGo }: { current: number; total: number; pdfLoaded: boolean; onGo: (d: number) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "#9aa0ab" }}>
      <button onClick={() => onGo(-1)} disabled={current <= 1} style={styles.navBtn}>‹</button>
      <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12, minWidth: 50, textAlign: "center" }}>
        {pdfLoaded ? `${current} / ${total}` : "— / —"}
      </span>
      <button onClick={() => onGo(1)} disabled={current >= total} style={styles.navBtn}>›</button>
    </div>
  );
}

function SymPreview({ symId, color }: { symId: string; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, 20, 20);
    const fn = DRAW_SYMBOLS[symId] ?? DRAW_SYMBOLS["dot"];
    fn(ctx, 10, 10, 14, color);
  }, [symId, color]);
  return <canvas ref={ref} width={20} height={20} style={{ flexShrink: 0 }} />;
}

function CtxItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{ display: "block", width: "100%", background: "none", border: "none", color: "#e8eaed", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: "0.05em", textAlign: "left", padding: "7px 14px", cursor: "pointer" }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#2e3138"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
    >
      {children}
    </button>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = {
  root: {
    display: "flex", flexDirection: "column" as const, height: "100dvh",
    background: "#111214", color: "#e8eaed",
    fontFamily: "'Barlow Condensed', sans-serif", overflow: "hidden",
  },
  header: {
    height: 52, background: "#1a1c20", borderBottom: "2px solid #FF5910",
    display: "flex", alignItems: "center", gap: 8, padding: "0 12px",
    flexShrink: 0, zIndex: 50,
  },
  logo: { fontSize: 13, fontWeight: 900, letterSpacing: "0.12em", color: "#FF5910", whiteSpace: "nowrap" as const },
  logoSub: { color: "#5a6070", fontWeight: 400 } as React.CSSProperties,
  sep: { width: 1, height: 24, background: "#2e3138", flexShrink: 0 },
  estName: { fontSize: 13, color: "#9aa0ab", fontWeight: 600, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis", maxWidth: 180 },
  hdrSelect: { background: "#22252b", border: "1px solid #2e3138", color: "#e8eaed", borderRadius: 6, padding: "4px 8px", fontSize: 13, fontFamily: "inherit" },
  hdrBtn: {
    background: "#22252b", border: "1px solid #2e3138", borderRadius: 6,
    color: "#9aa0ab", fontFamily: "Barlow Condensed, sans-serif" as const, fontSize: 12,
    fontWeight: 700, letterSpacing: "0.06em", padding: "5px 9px", cursor: "pointer",
    textTransform: "uppercase" as const,
  },
  modeBtn: {
    background: "#22252b", border: "1px solid #2e3138", borderRadius: 6,
    color: "#9aa0ab", fontFamily: "Barlow Condensed, sans-serif" as const, fontSize: 12,
    fontWeight: 700, padding: "5px 9px", cursor: "pointer",
  },
  modeBtnActive: { background: "#f0a500", borderColor: "#f0a500", color: "#111", letterSpacing: "0.05em" },
  zoomRow: { display: "flex", alignItems: "center", gap: 4 },
  zoomLabel: { fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "#9aa0ab", minWidth: 36, textAlign: "center" as const },
  navBtn: {
    background: "#22252b", border: "1px solid #2e3138", borderRadius: 4,
    color: "#9aa0ab", fontFamily: "JetBrains Mono, monospace", fontSize: 14,
    width: 28, height: 28, cursor: "pointer", display: "flex",
    alignItems: "center", justifyContent: "center",
  },
  scaleBanner: {
    background: "#f0a500", color: "#111", padding: "6px 16px",
    fontSize: 13, fontWeight: 700, letterSpacing: "0.05em",
    display: "flex", alignItems: "center", gap: 4, flexShrink: 0,
  },
  body: { display: "flex", flex: 1, overflow: "hidden", position: "relative" as const },
  leftPanel: {
    width: 200, background: "#1a1c20", borderRight: "1px solid #2e3138",
    display: "flex", flexDirection: "column" as const, flexShrink: 0, overflow: "hidden" as const,
  },
  canvasWrap: {
    flex: 1, overflow: "auto", background: "#0a0b0c", position: "relative" as const,
  },
  panelSelect: { width: "100%", background: "#22252b", border: "1px solid #2e3138", borderRadius: 6, color: "#e8eaed", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, fontWeight: 600, padding: "6px 8px", outline: "none" },
  panelBtn: { width: "100%", background: "none", border: "1px solid #2e3138", borderRadius: 6, color: "#9aa0ab", fontFamily: "Barlow Condensed, sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", padding: 7, cursor: "pointer", textTransform: "uppercase" as const },
  modalOverlay: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" },
  modalBox: { background: "#1a1c20", border: "1px solid #2e3138", borderTop: "3px solid #FF5910", borderRadius: 12, padding: 20, width: 320, maxWidth: "95vw", fontFamily: "'Barlow Condensed', sans-serif" },
  modalLabel: { fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#5a6070", textTransform: "uppercase" as const, display: "block", marginBottom: 4, marginTop: 10 },
  modalInput: { width: "100%", background: "#22252b", border: "1px solid #2e3138", borderRadius: 6, color: "#e8eaed", fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, fontWeight: 600, padding: "9px 10px", outline: "none" },
  btnCancel: { flex: 1, borderRadius: 8, fontFamily: "Barlow Condensed, sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: "0.06em", padding: 11, cursor: "pointer", textTransform: "uppercase" as const, border: "1px solid #2e3138", background: "#22252b", color: "#9aa0ab" },
  btnConfirm: { flex: 1, borderRadius: 8, fontFamily: "Barlow Condensed, sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: "0.06em", padding: 11, cursor: "pointer", textTransform: "uppercase" as const, background: "#FF5910", borderColor: "#FF5910", border: "1px solid #FF5910", color: "#111" },
};
