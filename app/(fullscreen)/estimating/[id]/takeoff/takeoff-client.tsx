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
import { SYMBOLS as DRAW_SYMBOLS } from "@/lib/takeoff-symbols";

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
type Mode = "count" | "run" | "pan";
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

function drawMarker(
  ctx: CanvasRenderingContext2D,
  symId: string, x: number, y: number, size: number, color: string, alpha = 1
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.beginPath(); ctx.arc(x, y, size * 0.7, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, size * 0.7, 0, Math.PI * 2); ctx.stroke();
  ctx.shadowColor = color; ctx.shadowBlur = 8;
  const fn = DRAW_SYMBOLS[symId] ?? DRAW_SYMBOLS["dot"];
  fn(ctx, x, y, size, color);
  ctx.shadowBlur = 0;
  ctx.restore();
}

const DEFAULT_RUN_TYPE: RunType = {
  id: "rt_default",
  category: "EMT",
  size: "3/4",
  conductors: [
    { count: 2, size: "#12", type: "THHN", isGround: false },
    { count: 1, size: "#12", type: "GND",  isGround: true  },
  ],
  material: "Cu", support: "1-Hole Strap", makeup: 2, difficulty: 1.0,
  color: "#f0a500", label: '3/4" EMT | 2×#12 THHN',
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
  const currentPageRef = useRef(currentPage);
  const modeRef = useRef(mode);
  const runInProgressRef = useRef(runInProgress);
  const orthoSnapRef = useRef(orthoSnap);
  const measuringActiveRef = useRef(measuringActive);
  const measurePt1Ref = useRef(measurePt1);

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { pageScalesRef.current = pageScales; }, [pageScales]);
  useEffect(() => { markupsRef.current = markups; }, [markups]);
  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { runInProgressRef.current = runInProgress; }, [runInProgress]);
  useEffect(() => { orthoSnapRef.current = orthoSnap; }, [orthoSnap]);
  useEffect(() => { measuringActiveRef.current = measuringActive; }, [measuringActive]);
  useEffect(() => { measurePt1Ref.current = measurePt1; }, [measurePt1]);

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

  function tryAutoLoad() {
    const drawing = initialDrawings.find(d => d.id === activeDrawingId);
    if (drawing?.pdfData) loadPDFFromBase64(drawing.pdfData);
  }

  // ── PDF rendering ─────────────────────────────────────────────────────────
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
      const pxpf = pageScalesRef.current["1"];
      setScaleBannerVisible(!pxpf);
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
          drawMarker(ctx, m.symId ?? "dot", m.x * z, m.y * z, (m.size ?? MARKER_SIZE) * z, m.color ?? "#e03a3a");
        } else if (m.type === "run" && m.points && m.points.length >= 2) {
          const pts = m.points.map(p => ({ x: p.x * z, y: p.y * z }));
          drawRun(ctx, pts, m.color ?? "#f0a500", m.footage ?? 0, m.transferred ?? false);
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
      setScaleBannerVisible(!pageScalesRef.current[String(next)]);
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
  }

  function handleDblClick(e: React.MouseEvent) {
    if (modeRef.current === "run" && runInProgressRef.current.length >= 2) {
      finishRun(); e.preventDefault();
    }
  }

  function handleRightClick(e: React.MouseEvent) {
    e.preventDefault();
    if (modeRef.current === "run") {
      const rip = runInProgressRef.current;
      const next = rip.length > 1 ? rip.slice(0, -1) : [];
      setRunInProgress(next); runInProgressRef.current = next;
      redrawAll(currentPageRef.current, zoomRef.current, null);
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
      setScaleBannerVisible(false);
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
      setScaleBannerVisible(false);
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

  // ── File upload ───────────────────────────────────────────────────────────
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activeDrawingId) return;
    e.target.value = "";
    const ab = await file.arrayBuffer();
    const bytes = new Uint8Array(ab);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const b64 = btoa(bin);
    loadPDFFromBase64(b64);
    setSaveStatus("saving");
    const pc = pdfDocRef.current?.numPages ?? 1;
    await fetch(`/api/takeoff-drawings/${activeDrawingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pdfData: b64, pageCount: pc }),
    });
    setSaveStatus("saved");
  }

  // ── Load a different drawing ───────────────────────────────────────────────
  function switchDrawing(id: string) {
    const d = drawings.find(x => x.id === id);
    if (!d) return;
    setActiveDrawingId(id);
    const mups = Array.isArray(d.markups) ? (d.markups as Markup[]) : [];
    const rts = Array.isArray(d.runTypes) && d.runTypes.length > 0
      ? (d.runTypes as RunType[]) : [DEFAULT_RUN_TYPE];
    setMarkups(mups); markupsRef.current = mups;
    setRunTypes(rts); setActiveRunTypeId(rts[0].id);
    setPageScales(d.pageScales ?? {}); pageScalesRef.current = d.pageScales ?? {};
    setCurrentPage(1); currentPageRef.current = 1;
    setTotalPages(d.pageCount ?? 1);
    setRunInProgress([]); runInProgressRef.current = [];
    setPdfLoaded(false);
    redrawAll(1, zoomRef.current, null);
    if (d.pdfData) loadPDFFromBase64(d.pdfData);
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
      assemblies: [], pageScales: {},
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
    if (!activeDrawingId) return;
    const m = markupsRef.current.find(x => x.id === markupId);
    if (!m || m.type !== "run") return;
    const rt = runTypes.find(r => r.id === m.runTypeId) ?? runTypes[0];
    const phaseCount = rt.conductors.filter(c => !c.isGround).reduce((s, c) => s + c.count, 0);
    const phaseSize = rt.conductors.find(c => !c.isGround)?.size?.replace("#", "") ?? "12";
    await fetch(`/api/takeoff-drawings/${activeDrawingId}/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "conduitRun",
        data: {
          conduitType: rt.category, conduitSize: rt.size,
          conductorCount: phaseCount, conductorSize: phaseSize,
          footage: m.footage ?? 0, difficulty: rt.difficulty,
          label: `${rt.label} — ${m.footage ?? 0}ft`,
        },
      }),
    });
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

  // ── Computed audit data ────────────────────────────────────────────────────
  const symbolCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const m of markups)
      if (m.type === "symbol" && m.itemKey) c[m.itemKey] = (c[m.itemKey] ?? 0) + 1;
    return c;
  }, [markups]);

  const runGrouped = useMemo(() => {
    const g: Record<string, { rt: RunType; runs: Markup[] }> = {};
    for (const m of markups) {
      if (m.type !== "run") continue;
      const rt = runTypes.find(r => r.id === m.runTypeId) ?? runTypes[0];
      if (!g[rt.id]) g[rt.id] = { rt, runs: [] };
      g[rt.id].runs.push(m);
    }
    return g;
  }, [markups, runTypes]);

  const currentPxPerFoot = pageScales[String(currentPage)];
  const scaleLabel = currentPxPerFoot
    ? `1"=${Math.round(((SCREEN_DPI * BASE_SCALE) / currentPxPerFoot) * 10) / 10}'`
    : "No scale";

  // ── Add run type ───────────────────────────────────────────────────────────
  function addRunType() {
    const name = prompt("Run type label:", '3/4" EMT | 3×#12 THHN');
    if (!name) return;
    const color = "#3adde0";
    const rt: RunType = {
      id: genId(), category: "EMT", size: "3/4",
      conductors: [
        { count: 3, size: "#12", type: "THHN", isGround: false },
        { count: 1, size: "#12", type: "GND",  isGround: true  },
      ],
      material: "Cu", support: "1-Hole Strap", makeup: 2, difficulty: 1.0,
      color, label: name,
    };
    setRunTypes(prev => {
      const next = [...prev, rt];
      scheduleAutosave({ runTypes: next });
      return next;
    });
    setActiveRunTypeId(rt.id);
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
        {(["count", "run", "pan"] as Mode[]).map(m => (
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
          <input type="file" accept=".pdf" style={{ display: "none" }} onChange={handleFileUpload} />
        </label>

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
              {currentPxPerFoot ? `✓ ${scaleLabel}` : "Not set"}
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
                  return (
                    <button key={item.key} onClick={() => { setSelectedItemKey(item.key); setSelectedColor(color); }}
                      style={{ display: "flex", alignItems: "center", gap: 6, background: active ? "rgba(255,89,16,0.12)" : "#22252b", border: `1px solid ${active ? "#FF5910" : "#2e3138"}`, borderRadius: 5, padding: "5px 7px", cursor: "pointer", textAlign: "left" }}>
                      <SymPreview symId={item.symId} color={color} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: active ? "#e8eaed" : "#9aa0ab", flex: 1, lineHeight: 1.2 }}>{item.label}</span>
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

          {/* Run types (RUN mode) */}
          {mode === "run" && (
            <Section label="Run Type">
              {runTypes.map(rt => (
                <button key={rt.id} onClick={() => setActiveRunTypeId(rt.id)}
                  style={{ display: "flex", alignItems: "center", gap: 6, background: activeRunTypeId === rt.id ? "rgba(255,89,16,0.12)" : "#22252b", border: `1px solid ${activeRunTypeId === rt.id ? "#FF5910" : "#2e3138"}`, borderRadius: 5, padding: "5px 7px", cursor: "pointer", width: "100%", marginBottom: 3, textAlign: "left" }}>
                  <div style={{ width: 10, height: 3, background: rt.color, borderRadius: 1, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#9aa0ab", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rt.label}</span>
                </button>
              ))}
              <button onClick={addRunType} style={{ ...S.panelBtn, marginTop: 4, borderStyle: "dashed" }}>+ Run Type</button>
              <div style={{ marginTop: 8, fontSize: 10, color: "#5a6070" }}>
                Ortho: <button onClick={() => { const v = !orthoSnap; setOrthoSnap(v); orthoSnapRef.current = v; }}
                  style={{ background: "none", border: "none", color: orthoSnap ? "#2db562" : "#9aa0ab", cursor: "pointer", fontFamily: "inherit", fontSize: 10 }}>
                  {orthoSnap ? "ON" : "OFF"}
                </button>
              </div>
              <div style={{ marginTop: 2, fontSize: 10, color: "#5a6070" }}>Enter = finish · Esc = cancel</div>
            </Section>
          )}
        </aside>

        {/* CANVAS */}
        <div ref={canvasWrapRef} style={{ ...S.canvasWrap, cursor: (mode === "pan" || spaceHeld.current) ? "grab" : "crosshair" }}>
          <div style={{ position: "relative", display: "inline-block", minWidth: "100%", minHeight: "100%" }}>
            {!pdfLoaded && (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, pointerEvents: "none" }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#2e3138", textTransform: "uppercase", letterSpacing: "0.1em" }}>No Drawing Loaded</div>
                <div style={{ fontSize: 14, color: "#2e3138", textAlign: "center", maxWidth: 280 }}>Upload a PDF to begin</div>
                <label style={{ pointerEvents: "all", background: "#FF5910", border: "none", borderRadius: 8, color: "#111", fontFamily: "inherit", fontSize: 15, fontWeight: 900, letterSpacing: "0.08em", padding: "12px 24px", cursor: "pointer", textTransform: "uppercase" }}>
                  📄 Load PDF
                  <input type="file" accept=".pdf" style={{ display: "none" }} onChange={handleFileUpload} />
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
          <div style={{ position: "absolute", bottom: 16, right: auditOpen ? 292 : 16, display: "flex", flexDirection: "column", gap: 4, zIndex: 40 }}>
            <ZBtn onClick={() => applyZoom(0.10)}>+</ZBtn>
            <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "#5a6070", textAlign: "center" }}>{Math.round(zoom * 100)}%</div>
            <ZBtn onClick={() => applyZoom(-0.10)}>−</ZBtn>
            <ZBtn onClick={zoomFit}>⊡</ZBtn>
          </div>
        </div>

        {/* RIGHT AUDIT PANEL */}
        {auditOpen ? (
          <aside style={S.auditPanel}>
            <div style={{ padding: "10px 12px", borderBottom: "1px solid #2e3138", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.15em", color: "#5a6070", textTransform: "uppercase" }}>Audit</span>
              <button onClick={() => setAuditOpen(false)} style={{ background: "none", border: "none", color: "#5a6070", cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ overflow: "auto", flex: 1, padding: "8px 0" }}>
              {/* Symbol counts */}
              <div style={{ padding: "0 12px 8px" }}>
                <div style={S.auditSectionLabel}>Assembly Counts</div>
                {Object.entries(symbolCounts).length === 0 && <div style={S.auditEmpty}>No symbols placed</div>}
                {Object.entries(symbolCounts).map(([key, count]) => {
                  const item = STD_ITEMS.find(i => i.key === key);
                  if (!item) return null;
                  const color = CAT_COLORS[item.category] ?? "#9aa0ab";
                  return (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <SymPreview symId={item.symId} color={color} />
                      <div style={{ flex: 1, fontSize: 11, color: "#9aa0ab" }}>{item.label}</div>
                      <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 13, color: "#e8eaed", fontWeight: 700 }}>{count}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ height: 1, background: "#2e3138", margin: "4px 0" }} />
              {/* Runs */}
              <div style={{ padding: "8px 12px" }}>
                <div style={S.auditSectionLabel}>Conduit / Wire Runs</div>
                {Object.keys(runGrouped).length === 0 && <div style={S.auditEmpty}>No runs placed</div>}
                {Object.values(runGrouped).map(({ rt, runs }) => {
                  const total = runs.reduce((s, r) => s + (r.footage ?? 0), 0);
                  const avg = runs.length > 0 ? Math.round(total / runs.length) : 0;
                  const done = runs.filter(r => r.transferred).length;
                  return (
                    <div key={rt.id} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <div style={{ width: 10, height: 3, background: rt.color, borderRadius: 1 }} />
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#e8eaed" }}>{rt.label}</div>
                      </div>
                      <div style={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace", color: "#9aa0ab", paddingLeft: 16 }}>
                        {Math.round(total)}ft / {runs.length} runs ~{avg}ft avg
                      </div>
                      <div style={{ paddingLeft: 16, marginTop: 2 }}>
                        {rt.conductors.map((c, i) => (
                          <div key={i} style={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", color: c.isGround ? "#2db562" : "#5a6070" }}>
                            {c.count}×{c.size} {c.type}: {Math.round(total * c.count)}ft
                          </div>
                        ))}
                      </div>
                      <div style={{ paddingLeft: 16, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 10, color: "#5a6070" }}>{done}/{runs.length} xferred</span>
                        <button onClick={() => { runs.filter(r => !r.transferred).forEach(r => transferRun(r.id)); }}
                          style={{ fontSize: 10, background: "#22252b", border: "1px solid #2e3138", color: "#9aa0ab", borderRadius: 4, padding: "2px 6px", cursor: "pointer", fontFamily: "inherit" }}>
                          Add to Estimate →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ padding: 12, borderTop: "1px solid #2e3138" }}>
              <button onClick={transferAllRuns}
                style={{ width: "100%", background: "#2db562", border: "none", borderRadius: 6, color: "#fff", fontFamily: "inherit", fontSize: 13, fontWeight: 700, padding: 9, cursor: "pointer", letterSpacing: "0.05em" }}>
                Transfer All Untransferred →
              </button>
            </div>
          </aside>
        ) : (
          <button onClick={() => setAuditOpen(true)} style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", background: "#1a1c20", border: "1px solid #2e3138", borderRight: "none", borderRadius: "6px 0 0 6px", color: "#5a6070", cursor: "pointer", fontSize: 11, padding: "8px 5px", zIndex: 45, writingMode: "vertical-rl" }}>
            AUDIT
          </button>
        )}
      </div>

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
  modeBtnActive: { background: "#FF5910", borderColor: "#FF5910", color: "#111" },
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
    display: "flex", flexDirection: "column" as const, flexShrink: 0, overflowY: "auto" as const,
  },
  canvasWrap: {
    flex: 1, overflow: "auto", background: "#0a0b0c", position: "relative" as const,
  },
  auditPanel: {
    width: 280, background: "#1a1c20", borderLeft: "1px solid #2e3138",
    display: "flex", flexDirection: "column" as const, flexShrink: 0, overflow: "hidden",
  },
  auditSectionLabel: { fontSize: 10, fontWeight: 900, letterSpacing: "0.12em", color: "#5a6070", textTransform: "uppercase" as const, marginBottom: 6 },
  auditEmpty: { fontSize: 11, color: "#5a6070" },
  panelSelect: { width: "100%", background: "#22252b", border: "1px solid #2e3138", borderRadius: 6, color: "#e8eaed", fontFamily: "Barlow Condensed, sans-serif", fontSize: 13, fontWeight: 600, padding: "6px 8px", outline: "none" },
  panelBtn: { width: "100%", background: "none", border: "1px solid #2e3138", borderRadius: 6, color: "#9aa0ab", fontFamily: "Barlow Condensed, sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", padding: 7, cursor: "pointer", textTransform: "uppercase" as const },
  modalOverlay: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" },
  modalBox: { background: "#1a1c20", border: "1px solid #2e3138", borderTop: "3px solid #FF5910", borderRadius: 12, padding: 20, width: 320, maxWidth: "95vw", fontFamily: "'Barlow Condensed', sans-serif" },
  modalLabel: { fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#5a6070", textTransform: "uppercase" as const, display: "block", marginBottom: 4, marginTop: 10 },
  modalInput: { width: "100%", background: "#22252b", border: "1px solid #2e3138", borderRadius: 6, color: "#e8eaed", fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, fontWeight: 600, padding: "9px 10px", outline: "none" },
  btnCancel: { flex: 1, borderRadius: 8, fontFamily: "Barlow Condensed, sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: "0.06em", padding: 11, cursor: "pointer", textTransform: "uppercase" as const, border: "1px solid #2e3138", background: "#22252b", color: "#9aa0ab" },
  btnConfirm: { flex: 1, borderRadius: 8, fontFamily: "Barlow Condensed, sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: "0.06em", padding: 11, cursor: "pointer", textTransform: "uppercase" as const, background: "#FF5910", borderColor: "#FF5910", border: "1px solid #FF5910", color: "#111" },
};
