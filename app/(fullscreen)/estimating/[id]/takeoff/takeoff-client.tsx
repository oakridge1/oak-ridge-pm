"use client";

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from "react";
import {
  Zap, X, ChevronLeft, ChevronRight, ChevronDown, Plus,
  ExternalLink, AlertTriangle, Check, Save,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type PlacedSymbol = {
  id: string;
  type: string;
  category: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
  color: string;
  label?: string;
  showLabel: boolean;
  assemblyId?: string;
};

export type DrawnRun = {
  id: string;
  points: Array<{ x: number; y: number }>;
  footage: number;
  category: "conduit" | "mc" | "wire";
  conduitType?: string;
  conduitSize?: string;
  conductorCount?: number;
  conductorSize?: string;
  wireType?: string;
  mcSize?: string;
  circuits?: number;
  difficulty: number;
  includeJBox: boolean;
  color: string;
  confirmed: boolean;
  transferred: boolean;
  label: string;
  fromEndpoint?: string;
  toEndpoint?: string;
};

export type TakeoffDrawingRow = {
  id: string;
  estimateId: string;
  name: string;
  pageCount: number;
  currentPage: number;
  pxPerFoot: number | null;
  scaleSet: boolean;
  markups: PlacedSymbol[];
  runTypes: DrawnRun[];
  createdAt: string;
  updatedAt: string;
};

type EstimateMin = {
  id: string;
  estimateNumber: string;
  name: string;
  laborRate: number;
  bulkMarkup: number;
  lightMarkup: number;
  permitMarkup: number;
  subMarkup: number;
  overhead: number;
  profit: number;
  nonProd: number;
  designFeePct: number;
  conditionMult: number;
  heightAdj: boolean;
};

interface Props {
  estimate: EstimateMin;
  initialDrawings: TakeoffDrawingRow[];
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG Symbol components (NFPA 70 / IEEE style)
// ─────────────────────────────────────────────────────────────────────────────

const SVG_PROPS = { viewBox: "0 0 40 40", fill: "none", xmlns: "http://www.w3.org/2000/svg" };
const S = ({ c = "white" }: { c?: string }) => ({ stroke: c, strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const });

function DuplexReceptacle({ color = "white" }: { color?: string }) {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="20" cy="20" r="12" stroke={color} strokeWidth="1.5" />
      <line x1="8" y1="17" x2="32" y2="17" stroke={color} strokeWidth="1.5" />
      <line x1="8" y1="23" x2="32" y2="23" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}
function GfciReceptacle({ color = "white" }: { color?: string }) {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="20" cy="20" r="12" stroke={color} strokeWidth="1.5" />
      <line x1="8" y1="17" x2="32" y2="17" stroke={color} strokeWidth="1.5" />
      <line x1="8" y1="23" x2="32" y2="23" stroke={color} strokeWidth="1.5" />
      <text x="20" y="35" textAnchor="middle" fontSize="7" fill={color} fontFamily="monospace">GFI</text>
    </svg>
  );
}
function SinglePoleSwitch({ color = "white" }: { color?: string }) {
  return (
    <svg {...SVG_PROPS}>
      <line x1="12" y1="28" x2="28" y2="12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="25" y1="10" x2="30" y2="15" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <text x="20" y="37" textAnchor="middle" fontSize="9" fill={color} fontFamily="monospace">S</text>
    </svg>
  );
}
function ThreeWaySwitch({ color = "white" }: { color?: string }) {
  return (
    <svg {...SVG_PROPS}>
      <line x1="12" y1="28" x2="28" y2="12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="25" y1="10" x2="30" y2="15" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <text x="20" y="37" textAnchor="middle" fontSize="8" fill={color} fontFamily="monospace">S3</text>
    </svg>
  );
}
function FourWaySwitch({ color = "white" }: { color?: string }) {
  return (
    <svg {...SVG_PROPS}>
      <line x1="12" y1="28" x2="28" y2="12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="25" y1="10" x2="30" y2="15" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <text x="20" y="37" textAnchor="middle" fontSize="8" fill={color} fontFamily="monospace">S4</text>
    </svg>
  );
}
function DimmerSwitch({ color = "white" }: { color?: string }) {
  return (
    <svg {...SVG_PROPS}>
      <line x1="12" y1="28" x2="28" y2="12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="25" y1="10" x2="30" y2="15" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <text x="20" y="37" textAnchor="middle" fontSize="8" fill={color} fontFamily="monospace">SD</text>
    </svg>
  );
}
function OccupancySensor({ color = "white" }: { color?: string }) {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="20" cy="20" r="12" stroke={color} strokeWidth="1.5" />
      <text x="20" y="24" textAnchor="middle" fontSize="9" fill={color} fontFamily="monospace">OS</text>
    </svg>
  );
}
function WeatherproofReceptacle({ color = "white" }: { color?: string }) {
  return (
    <svg {...SVG_PROPS}>
      <rect x="6" y="6" width="28" height="28" rx="4" stroke={color} strokeWidth="1.5" />
      <circle cx="20" cy="18" r="8" stroke={color} strokeWidth="1.2" />
      <line x1="10" y1="16" x2="30" y2="16" stroke={color} strokeWidth="1.2" />
      <line x1="10" y1="20" x2="30" y2="20" stroke={color} strokeWidth="1.2" />
      <text x="20" y="35" textAnchor="middle" fontSize="7" fill={color} fontFamily="monospace">WP</text>
    </svg>
  );
}
function WeatherproofSwitch({ color = "white" }: { color?: string }) {
  return (
    <svg {...SVG_PROPS}>
      <rect x="6" y="6" width="28" height="24" rx="3" stroke={color} strokeWidth="1.5" />
      <line x1="12" y1="24" x2="24" y2="12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="22" y1="11" x2="26" y2="15" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <text x="20" y="38" textAnchor="middle" fontSize="7" fill={color} fontFamily="monospace">WP</text>
    </svg>
  );
}
function CeilingFixture({ color = "white" }: { color?: string }) {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="20" cy="20" r="14" stroke={color} strokeWidth="1.5" />
      <line x1="9" y1="9" x2="31" y2="31" stroke={color} strokeWidth="1.5" />
      <line x1="31" y1="9" x2="9" y2="31" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}
function RecessedLight({ color = "white" }: { color?: string }) {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="20" cy="20" r="14" stroke={color} strokeWidth="1.5" />
      <circle cx="20" cy="20" r="8" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}
function Fluorescent2x4({ color = "white" }: { color?: string }) {
  return (
    <svg {...SVG_PROPS}>
      <rect x="4" y="14" width="32" height="12" stroke={color} strokeWidth="1.5" />
      <line x1="4" y1="18" x2="36" y2="18" stroke={color} strokeWidth="1" />
      <line x1="4" y1="20" x2="36" y2="20" stroke={color} strokeWidth="1" />
      <line x1="4" y1="22" x2="36" y2="22" stroke={color} strokeWidth="1" />
    </svg>
  );
}
function Fluorescent2x2({ color = "white" }: { color?: string }) {
  return (
    <svg {...SVG_PROPS}>
      <rect x="8" y="8" width="24" height="24" stroke={color} strokeWidth="1.5" />
      <line x1="8" y1="17" x2="32" y2="17" stroke={color} strokeWidth="1" />
      <line x1="8" y1="23" x2="32" y2="23" stroke={color} strokeWidth="1" />
    </svg>
  );
}
function StripLight({ color = "white" }: { color?: string }) {
  return (
    <svg {...SVG_PROPS}>
      <rect x="2" y="17" width="36" height="6" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}
function WallPack({ color = "white" }: { color?: string }) {
  return (
    <svg {...SVG_PROPS}>
      <path d="M8 28 A12 12 0 0 1 32 28 Z" stroke={color} strokeWidth="1.5" fill="none" />
      <line x1="4" y1="28" x2="36" y2="28" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}
function ExitSign({ color = "white" }: { color?: string }) {
  return (
    <svg {...SVG_PROPS}>
      <rect x="5" y="12" width="30" height="16" stroke={color} strokeWidth="1.5" />
      <text x="20" y="24" textAnchor="middle" fontSize="8" fill={color} fontFamily="monospace" fontWeight="bold">EXIT</text>
    </svg>
  );
}
function HighBay({ color = "white" }: { color?: string }) {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="20" cy="20" r="12" stroke={color} strokeWidth="1.5" />
      <polygon points="20,28 14,16 26,16" stroke={color} strokeWidth="1" fill="none" />
    </svg>
  );
}
function CeilingFan({ color = "white" }: { color?: string }) {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="20" cy="20" r="8" stroke={color} strokeWidth="1.5" />
      <path d="M20 12 Q24 8 28 12 Q24 16 20 12" stroke={color} strokeWidth="1" fill="none" />
      <path d="M28 20 Q32 24 28 28 Q24 24 28 20" stroke={color} strokeWidth="1" fill="none" />
      <path d="M20 28 Q16 32 12 28 Q16 24 20 28" stroke={color} strokeWidth="1" fill="none" />
      <path d="M12 20 Q8 16 12 12 Q16 16 12 20" stroke={color} strokeWidth="1" fill="none" />
    </svg>
  );
}
function SmokeDetector({ color = "white" }: { color?: string }) {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="20" cy="20" r="12" stroke={color} strokeWidth="1.5" />
      <line x1="8" y1="14" x2="32" y2="14" stroke={color} strokeWidth="1.5" />
      <text x="20" y="24" textAnchor="middle" fontSize="10" fill={color} fontFamily="monospace">S</text>
    </svg>
  );
}
function HeatDetector({ color = "white" }: { color?: string }) {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="20" cy="20" r="12" stroke={color} strokeWidth="1.5" />
      <text x="20" y="25" textAnchor="middle" fontSize="10" fill={color} fontFamily="monospace">H</text>
    </svg>
  );
}
function PullStation({ color = "white" }: { color?: string }) {
  return (
    <svg {...SVG_PROPS}>
      <rect x="10" y="10" width="20" height="20" stroke={color} strokeWidth="1.5" fill="none" />
      <line x1="10" y1="10" x2="30" y2="30" stroke={color} strokeWidth="1" />
      <line x1="30" y1="10" x2="10" y2="30" stroke={color} strokeWidth="1" />
    </svg>
  );
}
function HornStrobe({ color = "white" }: { color?: string }) {
  return (
    <svg {...SVG_PROPS}>
      <polygon points="8,8 32,20 8,32" stroke={color} strokeWidth="1.5" fill="none" />
    </svg>
  );
}
function Strobe({ color = "white" }: { color?: string }) {
  return (
    <svg {...SVG_PROPS}>
      <polyline points="20,4 14,20 20,20 14,36" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}
function DataPort({ color = "white" }: { color?: string }) {
  return (
    <svg {...SVG_PROPS}>
      <rect x="10" y="10" width="20" height="20" stroke={color} strokeWidth="1.5" />
      <text x="20" y="24" textAnchor="middle" fontSize="10" fill={color} fontFamily="monospace">D</text>
      <line x1="30" y1="20" x2="38" y2="20" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}
function TelephonePort({ color = "white" }: { color?: string }) {
  return (
    <svg {...SVG_PROPS}>
      <rect x="10" y="10" width="20" height="20" stroke={color} strokeWidth="1.5" />
      <text x="20" y="24" textAnchor="middle" fontSize="10" fill={color} fontFamily="monospace">T</text>
    </svg>
  );
}
function PanelBoard({ color = "white" }: { color?: string }) {
  return (
    <svg {...SVG_PROPS}>
      <rect x="12" y="6" width="16" height="28" stroke={color} strokeWidth="1.5" />
      <line x1="12" y1="12" x2="28" y2="12" stroke={color} strokeWidth="1" />
      <line x1="12" y1="17" x2="28" y2="17" stroke={color} strokeWidth="1" />
      <line x1="12" y1="22" x2="28" y2="22" stroke={color} strokeWidth="1" />
      <line x1="12" y1="27" x2="28" y2="27" stroke={color} strokeWidth="1" />
    </svg>
  );
}
function Transformer({ color = "white" }: { color?: string }) {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="16" cy="20" r="10" stroke={color} strokeWidth="1.5" />
      <circle cx="24" cy="20" r="10" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}
function Disconnect({ color = "white" }: { color?: string }) {
  return (
    <svg {...SVG_PROPS}>
      <rect x="10" y="8" width="20" height="24" stroke={color} strokeWidth="1.5" />
      <line x1="10" y1="8" x2="30" y2="32" stroke={color} strokeWidth="1.5" />
      <line x1="30" y1="8" x2="10" y2="32" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}
function JunctionBox({ color = "white" }: { color?: string }) {
  return (
    <svg {...SVG_PROPS}>
      <rect x="8" y="8" width="24" height="24" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}
function PullBox({ color = "white" }: { color?: string }) {
  return (
    <svg {...SVG_PROPS}>
      <rect x="6" y="6" width="28" height="28" stroke={color} strokeWidth="1.5" />
      <text x="20" y="24" textAnchor="middle" fontSize="8" fill={color} fontFamily="monospace">PB</text>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Symbol registry
// ─────────────────────────────────────────────────────────────────────────────

type SymbolDef = { name: string; category: string; Component: React.FC<{ color?: string }> };

const SYMBOLS: SymbolDef[] = [
  // Devices
  { name: "DuplexReceptacle", category: "Devices", Component: DuplexReceptacle },
  { name: "GfciReceptacle", category: "Devices", Component: GfciReceptacle },
  { name: "SinglePoleSwitch", category: "Devices", Component: SinglePoleSwitch },
  { name: "ThreeWaySwitch", category: "Devices", Component: ThreeWaySwitch },
  { name: "FourWaySwitch", category: "Devices", Component: FourWaySwitch },
  { name: "DimmerSwitch", category: "Devices", Component: DimmerSwitch },
  { name: "OccupancySensor", category: "Devices", Component: OccupancySensor },
  { name: "WeatherproofReceptacle", category: "Devices", Component: WeatherproofReceptacle },
  { name: "WeatherproofSwitch", category: "Devices", Component: WeatherproofSwitch },
  // Fixtures
  { name: "CeilingFixture", category: "Fixtures", Component: CeilingFixture },
  { name: "RecessedLight", category: "Fixtures", Component: RecessedLight },
  { name: "Fluorescent2x4", category: "Fixtures", Component: Fluorescent2x4 },
  { name: "Fluorescent2x2", category: "Fixtures", Component: Fluorescent2x2 },
  { name: "StripLight", category: "Fixtures", Component: StripLight },
  { name: "WallPack", category: "Fixtures", Component: WallPack },
  { name: "ExitSign", category: "Fixtures", Component: ExitSign },
  { name: "HighBay", category: "Fixtures", Component: HighBay },
  { name: "CeilingFan", category: "Fixtures", Component: CeilingFan },
  // Fire
  { name: "SmokeDetector", category: "Fire", Component: SmokeDetector },
  { name: "HeatDetector", category: "Fire", Component: HeatDetector },
  { name: "PullStation", category: "Fire", Component: PullStation },
  { name: "HornStrobe", category: "Fire", Component: HornStrobe },
  { name: "Strobe", category: "Fire", Component: Strobe },
  // Data
  { name: "DataPort", category: "Data", Component: DataPort },
  { name: "TelephonePort", category: "Data", Component: TelephonePort },
  // Panels
  { name: "PanelBoard", category: "Panels", Component: PanelBoard },
  { name: "Transformer", category: "Panels", Component: Transformer },
  { name: "Disconnect", category: "Panels", Component: Disconnect },
  // Boxes
  { name: "JunctionBox", category: "Boxes", Component: JunctionBox },
  { name: "PullBox", category: "Boxes", Component: PullBox },
];

const SYMBOL_CATEGORIES = ["Devices", "Fixtures", "Fire", "Data", "Panels", "Boxes"];

const SYMBOL_LABELS: Record<string, string> = {
  DuplexReceptacle: "Duplex Recept.",
  GfciReceptacle: "GFCI Recept.",
  SinglePoleSwitch: "SP Switch",
  ThreeWaySwitch: "3-Way Switch",
  FourWaySwitch: "4-Way Switch",
  DimmerSwitch: "Dimmer",
  OccupancySensor: "Occ. Sensor",
  WeatherproofReceptacle: "WP Recept.",
  WeatherproofSwitch: "WP Switch",
  CeilingFixture: "Ceiling Fix.",
  RecessedLight: "Recessed",
  Fluorescent2x4: "2x4 Fluor.",
  Fluorescent2x2: "2x2 Fluor.",
  StripLight: "Strip Light",
  WallPack: "Wall Pack",
  ExitSign: "Exit Sign",
  HighBay: "High Bay",
  CeilingFan: "Ceiling Fan",
  SmokeDetector: "Smoke Det.",
  HeatDetector: "Heat Det.",
  PullStation: "Pull Station",
  HornStrobe: "Horn/Strobe",
  Strobe: "Strobe",
  DataPort: "Data Port",
  TelephonePort: "Telephone",
  PanelBoard: "Panel Board",
  Transformer: "Transformer",
  Disconnect: "Disconnect",
  JunctionBox: "J-Box",
  PullBox: "Pull Box",
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function newId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const PRESET_COLORS = [
  "#ffffff", "#FF5910", "#002D72", "#22c55e", "#eab308",
  "#ef4444", "#8b5cf6", "#06b6d4",
];

const SCALE_PRESETS: Array<{ label: string; pxPerFoot: number }> = [
  { label: '1/8"=1\'', pxPerFoot: 96 },
  { label: '1/4"=1\'', pxPerFoot: 192 },
  { label: '3/8"=1\'', pxPerFoot: 288 },
  { label: '1/2"=1\'', pxPerFoot: 384 },
  { label: '1"=1\'', pxPerFoot: 768 },
  { label: '1"=10\'', pxPerFoot: 76.8 },
  { label: '1"=20\'', pxPerFoot: 38.4 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function TakeoffClient({ estimate, initialDrawings }: Props) {
  // ── Drawing list state
  const [drawings, setDrawings] = useState<TakeoffDrawingRow[]>(initialDrawings);
  const [activeDrawingId, setActiveDrawingId] = useState<string | null>(
    initialDrawings.length > 0 ? initialDrawings[0].id : null
  );

  const activeDrawing = useMemo(
    () => drawings.find((d) => d.id === activeDrawingId) ?? null,
    [drawings, activeDrawingId]
  );

  // ── Annotation state for active drawing
  const [markups, setMarkups] = useState<PlacedSymbol[]>(activeDrawing?.markups ?? []);
  const [runTypes, setRunTypes] = useState<DrawnRun[]>(activeDrawing?.runTypes ?? []);
  const [pxPerFoot, setPxPerFoot] = useState<number | null>(activeDrawing?.pxPerFoot ?? null);
  const [scaleSet, setScaleSet] = useState<boolean>(activeDrawing?.scaleSet ?? false);
  const [currentPage, setCurrentPage] = useState<number>(activeDrawing?.currentPage ?? 1);
  const [pageCount, setPageCount] = useState<number>(activeDrawing?.pageCount ?? 1);

  // ── Tool state
  const [mode, setMode] = useState<"count" | "run">("count");
  const [activeSymbol, setActiveSymbol] = useState<string | null>(null);
  const [symbolCategory, setSymbolCategory] = useState("Devices");
  const [symbolColor, setSymbolColor] = useState("#ffffff");
  const [selectedSymbolId, setSelectedSymbolId] = useState<string | null>(null);

  // ── Run state
  const [runCategory, setRunCategory] = useState<"conduit" | "mc" | "wire">("conduit");
  const [conduitType, setConduitType] = useState("EMT");
  const [conduitSize, setConduitSize] = useState("3/4");
  const [conductorCount, setConductorCount] = useState(2);
  const [conductorSize, setConductorSize] = useState("12");
  const [wireType, setWireType] = useState("THHN");
  const [mcSize, setMcSize] = useState("12/2");
  const [circuits, setCircuits] = useState(1);
  const [runDifficulty, setRunDifficulty] = useState(1.0);
  const [runColor, setRunColor] = useState("#FF5910");
  const [isDrawingRun, setIsDrawingRun] = useState(false);
  const [runPoints, setRunPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [pendingRun, setPendingRun] = useState<DrawnRun | null>(null);
  const [includeJBox, setIncludeJBox] = useState(false);

  // ── Scale state
  const [scaleMode, setScaleMode] = useState(false);
  const [scalePoints, setScalePoints] = useState<Array<{ x: number; y: number }>>([]);
  const [showScaleDialog, setShowScaleDialog] = useState(false);
  const [scaleDist, setScaleDist] = useState(0);
  const [scaleInputFt, setScaleInputFt] = useState("10");
  const [scaleUnit, setScaleUnit] = useState<"ft" | "in">("ft");

  // ── Canvas / PDF state
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);
  const spaceDown = useRef(false);

  // ── Save state
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Audit panel
  const [auditOpen, setAuditOpen] = useState(true);
  const [leftOpen, setLeftOpen] = useState(true);

  // ── Drawing name dialog
  const [showNewDrawingDialog, setShowNewDrawingDialog] = useState(false);
  const [newDrawingName, setNewDrawingName] = useState("");
  const [showDrawingDropdown, setShowDrawingDropdown] = useState(false);

  // ── Confirm run dialog
  const [showRunConfirm, setShowRunConfirm] = useState(false);

  // ── Context menu
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; symbolId: string } | null>(null);

  // Refs
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfJsLoadedRef = useRef(false);

  // ─────────────────────────────────────────────────────────────────────────
  // Switch drawing — save current, load new
  // ─────────────────────────────────────────────────────────────────────────

  async function switchDrawing(id: string) {
    if (id === activeDrawingId) return;
    // Save current drawing first
    if (activeDrawingId) {
      await saveDrawing(activeDrawingId, markups, runTypes, pxPerFoot, scaleSet, currentPage, pageCount);
    }
    const target = drawings.find((d) => d.id === id);
    if (!target) return;
    setActiveDrawingId(id);
    setMarkups(target.markups ?? []);
    setRunTypes(target.runTypes ?? []);
    setPxPerFoot(target.pxPerFoot ?? null);
    setScaleSet(target.scaleSet ?? false);
    setCurrentPage(target.currentPage ?? 1);
    setPageCount(target.pageCount ?? 1);
    setPdfLoaded(false);
    setPdfDoc(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedSymbolId(null);
    setIsDrawingRun(false);
    setRunPoints([]);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Save to DB
  // ─────────────────────────────────────────────────────────────────────────

  async function saveDrawing(
    id: string,
    m: PlacedSymbol[],
    r: DrawnRun[],
    ppf: number | null,
    ss: boolean,
    cp: number,
    pc: number
  ) {
    setSaveStatus("saving");
    try {
      await fetch(`/api/takeoff-drawings/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markups: m, runTypes: r, pxPerFoot: ppf, scaleSet: ss, currentPage: cp, pageCount: pc }),
      });
      setSaveStatus("saved");
      setDrawings((prev) =>
        prev.map((d) =>
          d.id === id ? { ...d, markups: m, runTypes: r, pxPerFoot: ppf, scaleSet: ss, currentPage: cp, pageCount: pc } : d
        )
      );
    } catch {
      setSaveStatus("unsaved");
    }
  }

  const scheduleSave = useCallback(() => {
    setSaveStatus("unsaved");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (activeDrawingId) {
        saveDrawing(activeDrawingId, markups, runTypes, pxPerFoot, scaleSet, currentPage, pageCount);
      }
    }, 1500);
  }, [activeDrawingId, markups, runTypes, pxPerFoot, scaleSet, currentPage, pageCount]);

  // Trigger save on annotation changes
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (!activeDrawingId) return;
    scheduleSave();
  }, [markups, runTypes, pxPerFoot, scaleSet]);

  // ─────────────────────────────────────────────────────────────────────────
  // Load pdf.js from CDN
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (pdfJsLoadedRef.current) return;
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload = () => {
      (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      pdfJsLoadedRef.current = true;
    };
    document.head.appendChild(script);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Render PDF page to canvas
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!pdfDoc || !pdfCanvasRef.current) return;
    (async () => {
      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale: zoom });
      const canvas = pdfCanvasRef.current!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport }).promise;
      // Sync overlay canvas size
      if (overlayCanvasRef.current) {
        overlayCanvasRef.current.width = viewport.width;
        overlayCanvasRef.current.height = viewport.height;
      }
      drawOverlay();
    })();
  }, [pdfDoc, currentPage, zoom]);

  // ─────────────────────────────────────────────────────────────────────────
  // Draw overlay canvas (symbols + runs + scale handles)
  // ─────────────────────────────────────────────────────────────────────────

  function toCanvas(docX: number, docY: number) {
    return { cx: docX, cy: docY };
  }

  const drawOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw placed symbols
    for (const sym of markups) {
      const { cx, cy } = toCanvas(sym.x, sym.y);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((sym.rotation * Math.PI) / 180);
      // Draw symbol as simple shapes via canvas directly
      drawSymbolToCanvas(ctx, sym.type, sym.size, sym.color);
      if (sym.showLabel) {
        ctx.fillStyle = sym.color;
        ctx.font = `${Math.max(10, sym.size * 0.25)}px monospace`;
        ctx.textAlign = "center";
        ctx.fillText(sym.label ?? SYMBOL_LABELS[sym.type] ?? sym.type, 0, sym.size / 2 + 12);
      }
      // Selection handles
      if (sym.id === selectedSymbolId) {
        ctx.strokeStyle = "#FF5910";
        ctx.lineWidth = 2;
        ctx.strokeRect(-sym.size / 2 - 2, -sym.size / 2 - 2, sym.size + 4, sym.size + 4);
      }
      ctx.restore();
    }

    // Draw confirmed runs
    for (const run of runTypes) {
      if (run.points.length < 2) continue;
      ctx.save();
      ctx.strokeStyle = run.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(run.points[0].x, run.points[0].y);
      for (let i = 1; i < run.points.length; i++) {
        ctx.lineTo(run.points[i].x, run.points[i].y);
      }
      ctx.stroke();
      // Midpoint label
      const mid = run.points[Math.floor(run.points.length / 2)];
      ctx.fillStyle = run.color;
      ctx.font = "11px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${run.footage.toFixed(1)} ft`, mid.x, mid.y - 6);
      ctx.restore();
    }

    // Draw in-progress run
    if (isDrawingRun && runPoints.length > 0) {
      ctx.save();
      ctx.strokeStyle = runColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(runPoints[0].x, runPoints[0].y);
      for (let i = 1; i < runPoints.length; i++) {
        ctx.lineTo(runPoints[i].x, runPoints[i].y);
      }
      if (mousePos) {
        const last = runPoints[runPoints.length - 1];
        const snapped = snapPoint(last, mousePos);
        ctx.lineTo(snapped.x, snapped.y);
      }
      ctx.stroke();
      // Draw waypoint dots
      for (const pt of runPoints) {
        ctx.fillStyle = runColor;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Draw scale points
    if (scaleMode && scalePoints.length > 0) {
      ctx.save();
      for (const pt of scalePoints) {
        ctx.fillStyle = "#FF5910";
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      if (scalePoints.length === 2) {
        ctx.strokeStyle = "#FF5910";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(scalePoints[0].x, scalePoints[0].y);
        ctx.lineTo(scalePoints[1].x, scalePoints[1].y);
        ctx.stroke();
      }
      ctx.restore();
    }
  }, [markups, runTypes, isDrawingRun, runPoints, mousePos, runColor, selectedSymbolId, scaleMode, scalePoints]);

  // Redraw overlay whenever state changes
  useEffect(() => {
    drawOverlay();
  }, [drawOverlay]);

  // ─────────────────────────────────────────────────────────────────────────
  // Canvas symbol rendering (simplified)
  // ─────────────────────────────────────────────────────────────────────────

  function drawSymbolToCanvas(ctx: CanvasRenderingContext2D, type: string, size: number, color: string) {
    const half = size / 2;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    switch (type) {
      case "DuplexReceptacle":
      case "GfciReceptacle":
      case "WeatherproofReceptacle":
        ctx.beginPath();
        ctx.arc(0, 0, half * 0.85, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-half * 0.85, -half * 0.25);
        ctx.lineTo(half * 0.85, -half * 0.25);
        ctx.moveTo(-half * 0.85, half * 0.25);
        ctx.lineTo(half * 0.85, half * 0.25);
        ctx.stroke();
        break;
      case "SinglePoleSwitch":
      case "ThreeWaySwitch":
      case "FourWaySwitch":
      case "DimmerSwitch":
      case "WeatherproofSwitch":
        ctx.beginPath();
        ctx.moveTo(-half * 0.6, half * 0.6);
        ctx.lineTo(half * 0.6, -half * 0.6);
        ctx.moveTo(half * 0.3, -half * 0.8);
        ctx.lineTo(half * 0.8, -half * 0.3);
        ctx.stroke();
        break;
      case "CeilingFixture":
        ctx.beginPath();
        ctx.arc(0, 0, half * 0.9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-half * 0.7, -half * 0.7);
        ctx.lineTo(half * 0.7, half * 0.7);
        ctx.moveTo(half * 0.7, -half * 0.7);
        ctx.lineTo(-half * 0.7, half * 0.7);
        ctx.stroke();
        break;
      case "RecessedLight":
        ctx.beginPath();
        ctx.arc(0, 0, half * 0.9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, half * 0.5, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case "PanelBoard":
        ctx.strokeRect(-half * 0.5, -half, half, size);
        for (let i = 1; i <= 4; i++) {
          ctx.beginPath();
          ctx.moveTo(-half * 0.5, -half + i * (size / 5));
          ctx.lineTo(half * 0.5, -half + i * (size / 5));
          ctx.stroke();
        }
        break;
      case "JunctionBox":
        ctx.strokeRect(-half * 0.7, -half * 0.7, size * 0.7, size * 0.7);
        break;
      case "PullBox":
        ctx.strokeRect(-half * 0.85, -half * 0.85, size * 0.85, size * 0.85);
        break;
      default:
        // Fallback: circle
        ctx.beginPath();
        ctx.arc(0, 0, half * 0.7, 0, Math.PI * 2);
        ctx.stroke();
        break;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Snap point logic (orthogonal)
  // ─────────────────────────────────────────────────────────────────────────

  function snapPoint(last: { x: number; y: number }, cur: { x: number; y: number }, shiftHeld = false) {
    if (shiftHeld) return cur;
    const dx = Math.abs(cur.x - last.x);
    const dy = Math.abs(cur.y - last.y);
    if (dx > dy) return { x: cur.x, y: last.y };
    return { x: last.x, y: cur.y };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Overlay canvas mouse events
  // ─────────────────────────────────────────────────────────────────────────

  function getCanvasPos(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = overlayCanvasRef.current!.getBoundingClientRect();
    const scaleX = overlayCanvasRef.current!.width / rect.width;
    const scaleY = overlayCanvasRef.current!.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function hitTestSymbol(x: number, y: number): PlacedSymbol | null {
    for (let i = markups.length - 1; i >= 0; i--) {
      const s = markups[i];
      const half = s.size / 2;
      if (x >= s.x - half && x <= s.x + half && y >= s.y - half && y <= s.y + half) {
        return s;
      }
    }
    return null;
  }

  const isDraggingSymbol = useRef(false);
  const dragSymbolId = useRef<string | null>(null);
  const dragOffset = useRef({ dx: 0, dy: 0 });

  function handleOverlayMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    // Middle mouse = pan
    if (e.button === 1 || (e.button === 0 && spaceDown.current)) {
      setIsPanning(true);
      panStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
      return;
    }
    if (e.button === 2) return; // handled by context menu

    const pos = getCanvasPos(e);

    // Scale mode
    if (scaleMode) {
      const newPts = [...scalePoints, pos];
      setScalePoints(newPts);
      if (newPts.length === 2) {
        const dx = newPts[1].x - newPts[0].x;
        const dy = newPts[1].y - newPts[0].y;
        setScaleDist(Math.sqrt(dx * dx + dy * dy));
        setShowScaleDialog(true);
        setScaleMode(false);
      }
      return;
    }

    if (mode === "count") {
      const hit = hitTestSymbol(pos.x, pos.y);
      if (hit) {
        setSelectedSymbolId(hit.id);
        isDraggingSymbol.current = true;
        dragSymbolId.current = hit.id;
        dragOffset.current = { dx: pos.x - hit.x, dy: pos.y - hit.y };
      } else {
        setSelectedSymbolId(null);
        if (activeSymbol) {
          const sym: PlacedSymbol = {
            id: newId(),
            type: activeSymbol,
            category: SYMBOLS.find((s) => s.name === activeSymbol)?.category ?? "Devices",
            x: pos.x,
            y: pos.y,
            size: 40,
            rotation: 0,
            color: symbolColor,
            showLabel: true,
          };
          setMarkups((prev) => [...prev, sym]);
        }
      }
    }

    if (mode === "run" && isDrawingRun) {
      const last = runPoints.length > 0 ? runPoints[runPoints.length - 1] : null;
      const snapped = last ? snapPoint(last, pos, e.shiftKey) : pos;
      setRunPoints((prev) => [...prev, snapped]);
    }
  }

  function handleOverlayMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const pos = getCanvasPos(e);
    setMousePos(pos);

    if (isPanning && panStart.current) {
      setPan({
        x: panStart.current.px + (e.clientX - panStart.current.mx),
        y: panStart.current.py + (e.clientY - panStart.current.my),
      });
      return;
    }

    if (isDraggingSymbol.current && dragSymbolId.current) {
      setMarkups((prev) =>
        prev.map((s) =>
          s.id === dragSymbolId.current
            ? { ...s, x: pos.x - dragOffset.current.dx, y: pos.y - dragOffset.current.dy }
            : s
        )
      );
    }
  }

  function handleOverlayMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    setIsPanning(false);
    panStart.current = null;
    if (isDraggingSymbol.current) {
      isDraggingSymbol.current = false;
      dragSymbolId.current = null;
    }
  }

  function handleOverlayDoubleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (mode === "run" && isDrawingRun && runPoints.length >= 2) {
      finishRun();
    }
  }

  function handleOverlayContextMenu(e: React.MouseEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const pos = getCanvasPos(e);
    const hit = hitTestSymbol(pos.x, pos.y);
    if (hit) {
      setCtxMenu({ x: e.clientX, y: e.clientY, symbolId: hit.id });
    }
  }

  function handleOverlayWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom((z) => Math.min(4, Math.max(0.25, z * factor)));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Keyboard
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === "Space") spaceDown.current = true;
      if (e.code === "Escape") {
        if (isDrawingRun) {
          setIsDrawingRun(false);
          setRunPoints([]);
        }
        if (scaleMode) setScaleMode(false);
        setSelectedSymbolId(null);
        setCtxMenu(null);
      }
      if ((e.code === "Delete" || e.code === "Backspace") && selectedSymbolId) {
        setMarkups((prev) => prev.filter((s) => s.id !== selectedSymbolId));
        setSelectedSymbolId(null);
      }
      if (e.code === "Enter" && isDrawingRun && runPoints.length >= 2) {
        finishRun();
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === "Space") spaceDown.current = false;
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); };
  }, [isDrawingRun, runPoints, selectedSymbolId, scaleMode]);

  // ─────────────────────────────────────────────────────────────────────────
  // Run finish
  // ─────────────────────────────────────────────────────────────────────────

  function finishRun() {
    if (runPoints.length < 2) return;
    let totalPx = 0;
    for (let i = 1; i < runPoints.length; i++) {
      const dx = runPoints[i].x - runPoints[i - 1].x;
      const dy = runPoints[i].y - runPoints[i - 1].y;
      totalPx += Math.sqrt(dx * dx + dy * dy);
    }
    const footage = pxPerFoot ? totalPx / pxPerFoot : totalPx / 96;
    const run: DrawnRun = {
      id: newId(),
      points: runPoints,
      footage,
      category: runCategory,
      conduitType: runCategory === "conduit" ? conduitType : undefined,
      conduitSize: runCategory === "conduit" ? conduitSize : undefined,
      conductorCount: runCategory === "conduit" ? conductorCount : undefined,
      conductorSize: runCategory === "conduit" ? conductorSize : undefined,
      wireType: runCategory === "conduit" ? wireType : undefined,
      mcSize: runCategory === "mc" ? mcSize : undefined,
      circuits: runCategory === "mc" ? circuits : undefined,
      difficulty: runDifficulty,
      includeJBox,
      color: runColor,
      confirmed: false,
      transferred: false,
      label: buildRunLabel(runCategory, conduitSize, conduitType, conductorCount, conductorSize, mcSize, circuits, footage),
    };
    setPendingRun(run);
    setShowRunConfirm(true);
    setIsDrawingRun(false);
    setRunPoints([]);
  }

  function buildRunLabel(
    cat: string, cs: string, ct: string, cc: number, cond: string, mc: string, circ: number, ft: number
  ) {
    if (cat === "conduit") return `${cs}" ${ct} — ${cc}×#${cond} THHN — ${ft.toFixed(1)} ft`;
    if (cat === "mc") return `MC ${mc} — ${ft.toFixed(1)} ft × ${circ} ckt`;
    return `Wire — ${ft.toFixed(1)} ft`;
  }

  function confirmRun() {
    if (!pendingRun) return;
    const confirmed = { ...pendingRun, confirmed: true };
    setRunTypes((prev) => [...prev, confirmed]);
    setPendingRun(null);
    setShowRunConfirm(false);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Scale confirm
  // ─────────────────────────────────────────────────────────────────────────

  function confirmScale() {
    let ft = parseFloat(scaleInputFt);
    if (isNaN(ft) || ft <= 0) return;
    if (scaleUnit === "in") ft = ft / 12;
    const ppf = scaleDist / ft;
    setPxPerFoot(ppf);
    setScaleSet(true);
    setShowScaleDialog(false);
    setScalePoints([]);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PDF upload
  // ─────────────────────────────────────────────────────────────────────────

  function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !pdfJsLoadedRef.current) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const data = new Uint8Array(ev.target?.result as ArrayBuffer);
      const pdfjsLib = (window as any).pdfjsLib;
      const doc = await pdfjsLib.getDocument({ data }).promise;
      setPdfDoc(doc);
      setPdfLoaded(true);
      const pc = doc.numPages;
      setPageCount(pc);
      await saveDrawing(activeDrawingId!, markups, runTypes, pxPerFoot, scaleSet, currentPage, pc);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  }

  // ─────────────────────────────────────────────────────────────────────────
  // New drawing
  // ─────────────────────────────────────────────────────────────────────────

  async function createDrawing() {
    if (!newDrawingName.trim()) return;
    const res = await fetch("/api/takeoff-drawings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estimateId: estimate.id, name: newDrawingName.trim() }),
    });
    if (!res.ok) return;
    const newD = await res.json();
    const d: TakeoffDrawingRow = {
      ...newD,
      createdAt: newD.createdAt,
      updatedAt: newD.updatedAt,
      markups: [],
      runTypes: [],
    };
    setDrawings((prev) => [...prev, d]);
    setShowNewDrawingDialog(false);
    setNewDrawingName("");
    switchDrawing(d.id);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Transfer to estimate
  // ─────────────────────────────────────────────────────────────────────────

  async function transferRun(run: DrawnRun) {
    if (!activeDrawingId) return;
    const type = run.category === "mc" ? "mcHomeRun" : "conduitRun";
    await fetch(`/api/takeoff-drawings/${activeDrawingId}/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, data: { ...run } }),
    });
    setRunTypes((prev) => prev.map((r) => r.id === run.id ? { ...r, transferred: true } : r));
  }

  async function transferCounts(type: string, count: number) {
    if (!activeDrawingId) return;
    // Map symbol type to a BOM ID — use a simple fallback approach
    await fetch(`/api/takeoff-drawings/${activeDrawingId}/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "counts",
        data: [{ bomId: "recep-dup", qty: count, note: `${type} — from takeoff drawing` }],
      }),
    });
  }

  async function transferAll() {
    if (!activeDrawingId) return;
    for (const run of runTypes.filter((r) => !r.transferred && r.confirmed)) {
      await transferRun(run);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Computed counts for audit panel
  // ─────────────────────────────────────────────────────────────────────────

  const symbolCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of markups) {
      counts[s.type] = (counts[s.type] ?? 0) + 1;
    }
    return counts;
  }, [markups]);

  const confirmedRuns = useMemo(() => runTypes.filter((r) => r.confirmed), [runTypes]);
  const transferredCount = useMemo(() => runTypes.filter((r) => r.transferred).length, [runTypes]);

  // ─────────────────────────────────────────────────────────────────────────
  // Canvas size / pan transform
  // ─────────────────────────────────────────────────────────────────────────

  const canvasWrapperStyle: React.CSSProperties = {
    transform: `translate(${pan.x}px, ${pan.y}px)`,
    cursor: scaleMode
      ? "crosshair"
      : isPanning || spaceDown.current
      ? "grab"
      : mode === "count" && activeSymbol
      ? "copy"
      : mode === "run" && isDrawingRun
      ? "crosshair"
      : "default",
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        :root {
          --bg: #0a0c0f;
          --surface: #111620;
          --surface2: #1a2030;
          --border: #2a3545;
          --accent: #002D72;
          --highlight: #FF5910;
          --text: #e8eaed;
          --text-muted: #9aa0b0;
        }
        * { box-sizing: border-box; }
        body { margin: 0; background: var(--bg); color: var(--text); overflow: hidden; }
        .takeoff-root { display: flex; flex-direction: column; height: 100vh; width: 100vw; background: var(--bg); color: var(--text); font-family: system-ui, sans-serif; overflow: hidden; }
        .takeoff-header { height: 40px; min-height: 40px; background: var(--surface); border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 8px; padding: 0 10px; flex-shrink: 0; overflow: hidden; }
        .takeoff-body { display: flex; flex: 1; overflow: hidden; }
        .left-panel { width: 200px; min-width: 200px; background: var(--surface); border-right: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; flex-shrink: 0; }
        .canvas-area { flex: 1; background: #0d1117; position: relative; overflow: hidden; }
        .right-panel { width: 280px; min-width: 280px; background: var(--surface); border-left: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; flex-shrink: 0; }
        .panel-section { padding: 8px; border-bottom: 1px solid var(--border); }
        .panel-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
        .btn { padding: 4px 10px; border-radius: 4px; border: 1px solid var(--border); cursor: pointer; font-size: 12px; background: var(--surface2); color: var(--text); transition: background 0.15s; }
        .btn:hover { background: var(--border); }
        .btn-primary { background: var(--accent); border-color: var(--accent); color: white; }
        .btn-primary:hover { background: #003a8c; }
        .btn-orange { background: var(--highlight); border-color: var(--highlight); color: white; }
        .btn-orange:hover { background: #e04d0a; }
        .btn-sm { padding: 2px 7px; font-size: 11px; }
        .symbol-tab { padding: 4px 6px; font-size: 11px; border: none; background: none; color: var(--text-muted); cursor: pointer; border-bottom: 2px solid transparent; }
        .symbol-tab.active { color: var(--highlight); border-color: var(--highlight); }
        .symbol-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px; overflow-y: auto; flex: 1; }
        .symbol-card { background: var(--surface2); border: 1px solid var(--border); border-radius: 4px; padding: 6px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 2px; }
        .symbol-card:hover { border-color: var(--text-muted); }
        .symbol-card.active { border-color: var(--highlight); }
        .symbol-card-label { font-size: 9px; color: var(--text-muted); text-align: center; line-height: 1.2; }
        .scale-banner { background: #3a2a00; border-bottom: 1px solid #6b4d00; padding: 6px 10px; font-size: 12px; display: flex; align-items: center; gap: 8px; color: #fbbf24; flex-shrink: 0; }
        select, input[type="number"], input[type="text"] { background: var(--surface2); border: 1px solid var(--border); color: var(--text); border-radius: 3px; padding: 3px 6px; font-size: 12px; }
        .audit-row { padding: 6px 8px; border-bottom: 1px solid var(--border); font-size: 12px; display: flex; align-items: center; justify-content: space-between; gap: 4px; }
        .transferred-badge { font-size: 10px; color: #22c55e; display: flex; align-items: center; gap: 2px; }
        .dialog-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 100; display: flex; align-items: center; justify-content: center; }
        .dialog { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 20px; min-width: 320px; max-width: 480px; }
        .dialog h3 { margin: 0 0 12px; font-size: 15px; }
        .dialog-footer { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
        .ctx-menu { position: fixed; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; z-index: 200; min-width: 140px; }
        .ctx-item { padding: 8px 14px; font-size: 13px; cursor: pointer; }
        .ctx-item:hover { background: var(--surface2); }
        @media (max-width: 768px) {
          .left-panel { display: none; }
          .right-panel { display: none; }
        }
      `}</style>

      <div className="takeoff-root" onClick={() => { setCtxMenu(null); setShowDrawingDropdown(false); }}>

        {/* ── HEADER BAR ── */}
        <div className="takeoff-header">
          <Zap size={16} color="#FF5910" />
          <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
            {estimate.estimateNumber}
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {estimate.name}
          </span>
          <span style={{ color: "var(--highlight)", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em" }}>TAKEOFF</span>

          <div style={{ width: 1, height: 20, background: "var(--border)", marginLeft: 4, marginRight: 4 }} />

          {/* Drawing selector */}
          <div style={{ position: "relative" }}>
            <button
              className="btn btn-sm"
              style={{ display: "flex", alignItems: "center", gap: 4, maxWidth: 140, overflow: "hidden" }}
              onClick={(e) => { e.stopPropagation(); setShowDrawingDropdown((v) => !v); }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 100 }}>
                {activeDrawing?.name ?? "No drawing"}
              </span>
              <ChevronDown size={10} />
            </button>
            {showDrawingDropdown && (
              <div style={{ position: "absolute", top: "calc(100% + 2px)", left: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, zIndex: 50, minWidth: 180 }}
                onClick={(e) => e.stopPropagation()}>
                {drawings.map((d) => (
                  <div key={d.id}
                    style={{ padding: "6px 12px", cursor: "pointer", fontSize: 12, background: d.id === activeDrawingId ? "var(--surface2)" : "none" }}
                    onClick={() => { switchDrawing(d.id); setShowDrawingDropdown(false); }}
                  >{d.name}</div>
                ))}
                <div style={{ borderTop: "1px solid var(--border)", padding: "6px 12px", cursor: "pointer", fontSize: 12, color: "var(--highlight)", display: "flex", alignItems: "center", gap: 4 }}
                  onClick={() => { setShowNewDrawingDialog(true); setShowDrawingDropdown(false); }}>
                  <Plus size={12} /> New Drawing
                </div>
              </div>
            )}
          </div>

          {/* Page nav */}
          {pageCount > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
              <button className="btn btn-sm" disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
                <ChevronLeft size={12} />
              </button>
              <span>{currentPage} / {pageCount}</span>
              <button className="btn btn-sm" disabled={currentPage >= pageCount}
                onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}>
                <ChevronRight size={12} />
              </button>
            </div>
          )}

          <div style={{ flex: 1 }} />

          {/* Mode toggle */}
          <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: 4, overflow: "hidden" }}>
            <button
              style={{ padding: "2px 10px", fontSize: 12, background: mode === "count" ? "var(--highlight)" : "var(--surface2)", color: "white", border: "none", cursor: "pointer" }}
              onClick={() => setMode("count")}>COUNT</button>
            <button
              style={{ padding: "2px 10px", fontSize: 12, background: mode === "run" ? "var(--highlight)" : "var(--surface2)", color: "white", border: "none", cursor: "pointer" }}
              onClick={() => setMode("run")}>RUN</button>
          </div>

          {/* Save indicator */}
          <span style={{ fontSize: 11, color: saveStatus === "saved" ? "#22c55e" : saveStatus === "saving" ? "#fbbf24" : "var(--highlight)" }}>
            {saveStatus === "saved" ? "✓ Saved" : saveStatus === "saving" ? "Saving…" : "● Unsaved"}
          </span>

          <button className="btn btn-sm" style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 4 }}
            onClick={() => window.close()}>
            <X size={12} /> Close
          </button>
        </div>

        {/* ── BODY ── */}
        <div className="takeoff-body">

          {/* ── LEFT PANEL ── */}
          <div className="left-panel">
            {/* Category tabs */}
            <div style={{ display: "flex", flexWrap: "wrap", borderBottom: "1px solid var(--border)", padding: "2px 4px" }}>
              {SYMBOL_CATEGORIES.map((cat) => (
                <button key={cat} className={`symbol-tab${symbolCategory === cat ? " active" : ""}`}
                  onClick={() => setSymbolCategory(cat)}>{cat}</button>
              ))}
            </div>

            {/* Symbol grid */}
            <div className="symbol-grid">
              {SYMBOLS.filter((s) => s.category === symbolCategory).map((sym) => (
                <div
                  key={sym.name}
                  className={`symbol-card${activeSymbol === sym.name ? " active" : ""}`}
                  onClick={() => { setActiveSymbol(sym.name); setMode("count"); }}
                >
                  <div style={{ width: 36, height: 36 }}>
                    <sym.Component color={activeSymbol === sym.name ? "#FF5910" : "white"} />
                  </div>
                  <div className="symbol-card-label">{SYMBOL_LABELS[sym.name]}</div>
                </div>
              ))}
            </div>

            {/* Color picker */}
            <div className="panel-section">
              <div className="panel-label">Symbol Color</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 4 }}>
                {PRESET_COLORS.map((c) => (
                  <button key={c}
                    style={{ width: 18, height: 18, borderRadius: 3, background: c, border: symbolColor === c ? "2px solid var(--highlight)" : "1px solid var(--border)", cursor: "pointer", padding: 0 }}
                    onClick={() => setSymbolColor(c)} />
                ))}
              </div>
              <input type="color" value={symbolColor} onChange={(e) => setSymbolColor(e.target.value)}
                style={{ width: "100%", height: 24, cursor: "pointer", border: "1px solid var(--border)", borderRadius: 3, background: "none" }} />
            </div>
          </div>

          {/* ── CANVAS AREA ── */}
          <div className="canvas-area" ref={containerRef}>
            {/* Scale banner */}
            {!scaleSet && activeDrawingId && (
              <div className="scale-banner">
                <AlertTriangle size={14} />
                <span>Scale not set — measurements will be inaccurate.</span>
                <button className="btn btn-sm" onClick={() => { setScaleMode(true); setScalePoints([]); }}>Set Scale</button>
                <div style={{ marginLeft: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {SCALE_PRESETS.map((p) => (
                    <button key={p.label} className="btn btn-sm"
                      onClick={() => { setPxPerFoot(p.pxPerFoot); setScaleSet(true); }}
                      style={{ fontSize: 10 }}>{p.label}</button>
                  ))}
                </div>
              </div>
            )}
            {scaleSet && pxPerFoot && (
              <div style={{ background: "#0a2a0a", borderBottom: "1px solid #1a4a1a", padding: "3px 10px", fontSize: 11, color: "#22c55e", display: "flex", alignItems: "center", gap: 8 }}>
                <Check size={12} /> Scale: 1 ft = {pxPerFoot.toFixed(1)}px
                <button className="btn btn-sm" style={{ fontSize: 10 }}
                  onClick={() => { if (confirm("Recalibrate scale? This will not affect placed symbols or runs.")) { setScaleSet(false); setScaleMode(true); setScalePoints([]); } }}>
                  Recalibrate
                </button>
              </div>
            )}

            {/* Drop zone / canvas */}
            {!pdfLoaded ? (
              <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", cursor: "pointer", color: "var(--text-muted)", gap: 8, fontSize: 14 }}>
                <div style={{ border: "2px dashed var(--border)", borderRadius: 12, padding: "40px 60px", textAlign: "center" }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>📄</div>
                  <div>Drop PDF here or click to upload</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>(Scale must be set before measuring)</div>
                </div>
                <input type="file" accept="application/pdf" style={{ display: "none" }} onChange={handlePdfUpload} />
              </label>
            ) : (
              <div style={{ position: "relative", display: "inline-block", ...canvasWrapperStyle }}>
                <canvas ref={pdfCanvasRef} style={{ display: "block" }} />
                <canvas
                  ref={overlayCanvasRef}
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
                  onMouseDown={handleOverlayMouseDown}
                  onMouseMove={handleOverlayMouseMove}
                  onMouseUp={handleOverlayMouseUp}
                  onDoubleClick={handleOverlayDoubleClick}
                  onContextMenu={handleOverlayContextMenu}
                  onWheel={handleOverlayWheel}
                />
              </div>
            )}

            {/* No-drawing overlay */}
            {!activeDrawingId && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 14, flexDirection: "column", gap: 8 }}>
                <p>No drawing selected.</p>
                <button className="btn btn-orange" onClick={() => setShowNewDrawingDialog(true)}>
                  <Plus size={14} style={{ display: "inline", marginRight: 4 }} />Create Drawing
                </button>
              </div>
            )}
          </div>

          {/* ── RIGHT PANEL ── */}
          <div className="right-panel">
            {mode === "run" ? (
              // Run config panel
              <div style={{ padding: 8, overflowY: "auto", flex: 1 }}>
                <div className="panel-label">Run Configuration</div>

                <div style={{ marginBottom: 8 }}>
                  <label className="panel-label">Category</label>
                  <div style={{ display: "flex", gap: 4 }}>
                    {(["conduit", "mc", "wire"] as const).map((cat) => (
                      <button key={cat} className={`btn btn-sm${runCategory === cat ? " btn-orange" : ""}`}
                        onClick={() => setRunCategory(cat)} style={{ textTransform: "capitalize" }}>{cat}</button>
                    ))}
                  </div>
                </div>

                {runCategory === "conduit" && (
                  <>
                    <div style={{ marginBottom: 6 }}>
                      <label className="panel-label">Type</label>
                      <select value={conduitType} onChange={(e) => setConduitType(e.target.value)} style={{ width: "100%" }}>
                        {["EMT", "PVC", "Rigid", "Flex", "LT"].map((t) => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div style={{ marginBottom: 6 }}>
                      <label className="panel-label">Size</label>
                      <select value={conduitSize} onChange={(e) => setConduitSize(e.target.value)} style={{ width: "100%" }}>
                        {["1/2", "3/4", "1", "1-1/4", "1-1/2", "2", "2-1/2", "3", "4"].map((s) => <option key={s} value={s}>{s}"</option>)}
                      </select>
                    </div>
                    <div style={{ marginBottom: 6, display: "flex", gap: 4, alignItems: "center" }}>
                      <div style={{ flex: 1 }}>
                        <label className="panel-label">Conductors</label>
                        <input type="number" value={conductorCount} min={1} max={12}
                          onChange={(e) => setConductorCount(parseInt(e.target.value) || 1)} style={{ width: "100%" }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label className="panel-label">Size</label>
                        <select value={conductorSize} onChange={(e) => setConductorSize(e.target.value)} style={{ width: "100%" }}>
                          {["14", "12", "10", "8", "6", "4", "2", "1/0"].map((s) => <option key={s}>#{s}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ marginBottom: 6 }}>
                      <label className="panel-label">Wire Type</label>
                      <select value={wireType} onChange={(e) => setWireType(e.target.value)} style={{ width: "100%" }}>
                        {["THHN", "THWN", "XHHW"].map((t) => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                  </>
                )}

                {runCategory === "mc" && (
                  <>
                    <div style={{ marginBottom: 6 }}>
                      <label className="panel-label">MC Size</label>
                      <select value={mcSize} onChange={(e) => setMcSize(e.target.value)} style={{ width: "100%" }}>
                        {["12/2", "12/3", "10/2", "10/3", "8/3", "6/3"].map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div style={{ marginBottom: 6 }}>
                      <label className="panel-label">Circuits</label>
                      <input type="number" value={circuits} min={1} max={20}
                        onChange={(e) => setCircuits(parseInt(e.target.value) || 1)} style={{ width: "100%" }} />
                    </div>
                  </>
                )}

                <div style={{ marginBottom: 6 }}>
                  <label className="panel-label">Difficulty</label>
                  <select value={runDifficulty} onChange={(e) => setRunDifficulty(parseFloat(e.target.value))} style={{ width: "100%" }}>
                    <option value={0.8}>Easy 0.8x</option>
                    <option value={1.0}>Normal 1.0x</option>
                    <option value={1.2}>Hard 1.2x</option>
                    <option value={1.5}>Very Hard 1.5x</option>
                  </select>
                </div>

                <div style={{ marginBottom: 8 }}>
                  <label className="panel-label">Run Color</label>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 4 }}>
                    {PRESET_COLORS.map((c) => (
                      <button key={c}
                        style={{ width: 18, height: 18, borderRadius: 3, background: c, border: runColor === c ? "2px solid white" : "1px solid var(--border)", cursor: "pointer", padding: 0 }}
                        onClick={() => setRunColor(c)} />
                    ))}
                  </div>
                  <input type="color" value={runColor} onChange={(e) => setRunColor(e.target.value)}
                    style={{ width: "100%", height: 24, cursor: "pointer", border: "1px solid var(--border)", borderRadius: 3, background: "none" }} />
                </div>

                <button
                  className={`btn btn-sm${isDrawingRun ? " btn-orange" : " btn-primary"}`}
                  style={{ width: "100%", marginBottom: 4 }}
                  onClick={() => { setIsDrawingRun((v) => !v); setRunPoints([]); }}>
                  {isDrawingRun ? "Cancel Draw" : "Start Drawing Run"}
                </button>
                {isDrawingRun && (
                  <p style={{ fontSize: 10, color: "var(--text-muted)", margin: "4px 0 0" }}>
                    Click to add points. Double-click or Enter to finish. Esc to cancel. Hold Shift for free angle.
                  </p>
                )}
              </div>
            ) : (
              // Count mode right panel — just info
              <div style={{ padding: 8, color: "var(--text-muted)", fontSize: 12 }}>
                <div className="panel-label">Count Mode</div>
                <p>Select a symbol from the left panel, then click on the canvas to place it.</p>
                <p>Click a placed symbol to select it. Press Delete to remove.</p>
                <p>Right-click for options.</p>
              </div>
            )}

            {/* ── Audit Panel ── */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto", borderTop: "1px solid var(--border)" }}>
              <div style={{ padding: "6px 8px", background: "var(--surface2)", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                onClick={() => setAuditOpen((v) => !v)}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Audit Panel</span>
                <ChevronDown size={14} style={{ transform: auditOpen ? "rotate(180deg)" : "none" }} />
              </div>

              {auditOpen && (
                <div style={{ overflowY: "auto", flex: 1 }}>
                  {/* Symbol counts */}
                  <div className="panel-section">
                    <div className="panel-label">Assembly Counts</div>
                    {Object.entries(symbolCounts).length === 0 && (
                      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>No symbols placed.</p>
                    )}
                    {Object.entries(symbolCounts).map(([type, count]) => (
                      <div key={type} className="audit-row">
                        <div>
                          <div style={{ fontSize: 12 }}>{SYMBOL_LABELS[type] ?? type}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{count}</div>
                        </div>
                        <button className="btn btn-sm" onClick={() => transferCounts(type, count)}>
                          Add →
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Runs */}
                  <div className="panel-section">
                    <div className="panel-label">Conduit / Wire Runs</div>
                    {confirmedRuns.length === 0 && (
                      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>No confirmed runs.</p>
                    )}
                    {confirmedRuns.map((run) => (
                      <div key={run.id} className="audit-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                        <div style={{ fontSize: 11 }}>{run.label}</div>
                        {run.fromEndpoint && <div style={{ fontSize: 10, color: "var(--text-muted)" }}>From: {run.fromEndpoint} → {run.toEndpoint}</div>}
                        {run.transferred ? (
                          <span className="transferred-badge"><Check size={10} />Taken Off</span>
                        ) : (
                          <button className="btn btn-sm" onClick={() => transferRun(run)}>Add to Estimate →</button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Transfer all */}
                  {confirmedRuns.length > 0 && (
                    <div style={{ padding: 8, borderTop: "1px solid var(--border)" }}>
                      <button className="btn btn-sm btn-primary" style={{ width: "100%" }} onClick={transferAll}>
                        Transfer All Untransferred
                      </button>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4, textAlign: "center" }}>
                        {transferredCount} of {confirmedRuns.length} runs transferred
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── DIALOGS ── */}

        {/* Scale dialog */}
        {showScaleDialog && (
          <div className="dialog-overlay" onClick={() => setShowScaleDialog(false)}>
            <div className="dialog" onClick={(e) => e.stopPropagation()}>
              <h3>Set Scale</h3>
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 12px" }}>
                Pixel distance measured: {scaleDist.toFixed(1)}px
              </p>
              <label className="panel-label">Distance between these points:</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
                <input type="number" value={scaleInputFt} onChange={(e) => setScaleInputFt(e.target.value)} style={{ flex: 1 }} />
                <select value={scaleUnit} onChange={(e) => setScaleUnit(e.target.value as "ft" | "in")}>
                  <option value="ft">ft</option>
                  <option value="in">in</option>
                </select>
              </div>
              <div className="panel-label" style={{ marginBottom: 4 }}>Quick Presets:</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
                {SCALE_PRESETS.map((p) => (
                  <button key={p.label} className="btn btn-sm"
                    onClick={() => { setPxPerFoot(p.pxPerFoot); setScaleSet(true); setShowScaleDialog(false); setScalePoints([]); }}>
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="dialog-footer">
                <button className="btn" onClick={() => setShowScaleDialog(false)}>Cancel</button>
                <button className="btn btn-orange" onClick={confirmScale}>Confirm</button>
              </div>
            </div>
          </div>
        )}

        {/* New drawing dialog */}
        {showNewDrawingDialog && (
          <div className="dialog-overlay" onClick={() => setShowNewDrawingDialog(false)}>
            <div className="dialog" onClick={(e) => e.stopPropagation()}>
              <h3>New Drawing</h3>
              <label className="panel-label">Drawing Name</label>
              <input type="text" value={newDrawingName} onChange={(e) => setNewDrawingName(e.target.value)}
                placeholder="e.g. First Floor Plan" style={{ width: "100%", marginTop: 4 }}
                onKeyDown={(e) => { if (e.key === "Enter") createDrawing(); }} autoFocus />
              <div className="dialog-footer">
                <button className="btn" onClick={() => setShowNewDrawingDialog(false)}>Cancel</button>
                <button className="btn btn-orange" onClick={createDrawing}>Create</button>
              </div>
            </div>
          </div>
        )}

        {/* Run confirm dialog */}
        {showRunConfirm && pendingRun && (
          <div className="dialog-overlay">
            <div className="dialog" onClick={(e) => e.stopPropagation()}>
              <h3>Confirm Run</h3>
              <div style={{ fontSize: 13, marginBottom: 12 }}>
                <div><strong>Type:</strong> {pendingRun.label}</div>
                <div><strong>Measured length:</strong> {pendingRun.footage.toFixed(1)} ft</div>
                <div><strong>Difficulty:</strong> {pendingRun.difficulty}x</div>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, marginBottom: 12 }}>
                <input type="checkbox" checked={includeJBox} onChange={(e) => setIncludeJBox(e.target.checked)} />
                Include junction box at destination
              </label>
              <div style={{ marginBottom: 8 }}>
                <label className="panel-label">From</label>
                <input type="text"
                  value={pendingRun.fromEndpoint ?? "Start"}
                  onChange={(e) => setPendingRun((r) => r ? { ...r, fromEndpoint: e.target.value } : r)}
                  style={{ width: "100%", marginTop: 2 }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label className="panel-label">To</label>
                <input type="text"
                  value={pendingRun.toEndpoint ?? "End"}
                  onChange={(e) => setPendingRun((r) => r ? { ...r, toEndpoint: e.target.value } : r)}
                  style={{ width: "100%", marginTop: 2 }} />
              </div>
              <div className="dialog-footer">
                <button className="btn" onClick={() => { setShowRunConfirm(false); setPendingRun(null); }}>Cancel</button>
                <button className="btn btn-orange" onClick={confirmRun}>Confirm &amp; Add</button>
              </div>
            </div>
          </div>
        )}

        {/* Context menu */}
        {ctxMenu && (
          <div className="ctx-menu" style={{ top: ctxMenu.y, left: ctxMenu.x }}
            onClick={(e) => e.stopPropagation()}>
            <div className="ctx-item" onClick={() => {
              setMarkups((prev) => prev.filter((s) => s.id !== ctxMenu.symbolId));
              setCtxMenu(null);
            }}>Delete</div>
            <div className="ctx-item" onClick={() => {
              const newColor = prompt("Enter hex color (e.g. #ff5910):") ?? "";
              if (newColor) {
                setMarkups((prev) => prev.map((s) => s.id === ctxMenu.symbolId ? { ...s, color: newColor } : s));
              }
              setCtxMenu(null);
            }}>Change Color</div>
            <div className="ctx-item" onClick={() => {
              const newLabel = prompt("Enter label:") ?? "";
              setMarkups((prev) => prev.map((s) => s.id === ctxMenu.symbolId ? { ...s, label: newLabel || undefined } : s));
              setCtxMenu(null);
            }}>Change Label</div>
            <div className="ctx-item" onClick={() => { setSelectedSymbolId(null); setCtxMenu(null); }}>Deselect</div>
          </div>
        )}
      </div>
    </>
  );
}
