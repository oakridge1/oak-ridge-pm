import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";

// ── Field-schedule palette (NOT the invoice navy) ─────────────────────────────
const BLUE = "#2B3990";
const ORANGE = "#F26522";
const ROW_ALT = "#F2F4FA";
const PH_FILL = "#DDE1F0";
const GRID = "#9AA3C0";
const SPARE = "#A6A6A6";
const LEGEND = "#555F70";
const SPEC_FILL = "#EEF1FA";

export interface PanelPdfCircuit {
  ckt: number;
  status: string;
  description: string | null;
  poles: number;
  amps: number | null;
  flags: string[];
}

export interface PanelPdfPanel {
  name: string;
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
}

export interface PanelPdfJob {
  jobName: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}

export type Sleeve = "6x9" | "7x7";

const SLEEVE_DIMS: Record<Sleeve, [number, number]> = {
  "6x9": [432, 648],
  "7x7": [504, 504],
};

// Column proportions (both sleeves): CKT | CB | DESC | PH | PH | DESC | CB | CKT
const COL_PROPS = [420, 540, 2560, 330, 330, 2560, 540, 496];
const COL_TOTAL = COL_PROPS.reduce((s, w) => s + w, 0);

const MARGIN = { left: 21.6, right: 21.6, top: 20, bottom: 15 };

function buildSpecSegments(p: PanelPdfPanel): string[] {
  const segs: string[] = [];
  segs.push(p.system);
  segs.push(`${p.busAmps}A Bus`);
  segs.push(p.mainType === "MB" ? `${p.mainAmps ?? ""}A MB${p.fedAmps ? ` (Fed @ ${p.fedAmps}A)` : ""}` : "MLO");
  if (p.breakerType || p.catalogNumber) {
    segs.push([p.breakerType, p.catalogNumber].filter(Boolean).join(" · "));
  }
  segs.push(`${p.circuitCount} CKT`);
  if (p.integralTVSS) segs.push("Integral TVSS");
  if (p.fedFrom) segs.push(`Fed from: ${p.fedFrom}`);
  if (p.location) segs.push(p.location);
  if (p.afc) segs.push(`AFC: ${p.afc}`);
  if (p.aicRating) segs.push(`AIC: ${p.aicRating}`);
  if (p.enclosure) segs.push(p.enclosure);
  return segs;
}

function phaseLetter(rowIndex: number, phases: number): string {
  const seq = phases === 3 ? ["A", "B", "C"] : ["A", "B"];
  return seq[rowIndex % seq.length];
}

// Description font steps down instead of wrapping.
function descFontSize(text: string): number {
  const n = text.length;
  if (n > 44) return 5;
  if (n > 32) return 5.5;
  if (n > 24) return 6;
  return 6.5;
}

interface CellRender {
  cb: string;
  desc: string;
  gray: boolean;
  blankDesc: boolean;
}

function renderCell(
  c: PanelPdfCircuit | undefined,
  contAnchor: PanelPdfCircuit | undefined
): CellRender {
  if (!c) return { cb: "", desc: "", gray: false, blankDesc: true };

  // Continuation of a multi-pole anchor above on the same side.
  if (contAnchor) {
    const anchorSpare = contAnchor.status === "SPARE";
    const base = contAnchor.description ?? (anchorSpare ? "SPARE" : "");
    const withFlags = contAnchor.flags.length ? `${base} (${contAnchor.flags.join(", ")})` : base;
    return { cb: "——", desc: withFlags.toUpperCase(), gray: anchorSpare, blankDesc: false };
  }

  const flags = c.flags.length ? ` (${c.flags.join(", ")})` : "";
  switch (c.status) {
    case "ASSIGNED":
      return { cb: `${c.poles}/${c.amps ?? ""}`, desc: `${c.description ?? ""}${flags}`.toUpperCase(), gray: false, blankDesc: false };
    case "SPARE":
      return { cb: `${c.poles}/${c.amps ?? ""}`, desc: `${c.description ?? "SPARE"}${flags}`.toUpperCase(), gray: true, blankDesc: false };
    case "DEVICE":
      return { cb: "", desc: `${c.description ?? ""}${flags}`.toUpperCase(), gray: false, blankDesc: false };
    case "OPEN":
      return { cb: `${c.poles}/${c.amps ?? ""}`, desc: "", gray: false, blankDesc: true };
    case "SPACE":
    default:
      return { cb: "", desc: "", gray: false, blankDesc: true };
  }
}

export function PanelSchedulePdf({
  panel,
  circuits,
  job,
  logoSrc,
  sleeve,
}: {
  panel: PanelPdfPanel;
  circuits: PanelPdfCircuit[];
  job: PanelPdfJob;
  logoSrc?: string;
  sleeve: Sleeve;
}) {
  const [pageW, pageH] = SLEEVE_DIMS[sleeve];
  const contentW = pageW - MARGIN.left - MARGIN.right;
  const contentH = pageH - MARGIN.top - MARGIN.bottom;

  const byCkt = new Map(circuits.map((c) => [c.ckt, c]));
  const contMap = new Map<number, PanelPdfCircuit>();
  for (const c of circuits) {
    if (c.poles > 1) for (let k = 1; k < c.poles; k++) contMap.set(c.ckt + 2 * k, c);
  }

  const numRows = Math.ceil(panel.circuitCount / 2);
  const segs = buildSpecSegments(panel);

  // Vertical budget (points).
  const HEADER = 44;
  const SPECS = segs.length > 5 ? 26 : 15;
  const TABLE_HEADER = 12;
  const LEGEND_BLOCK = 16;
  const GAPS = 18;
  const rowsAvail = contentH - HEADER - SPECS - TABLE_HEADER - LEGEND_BLOCK - GAPS;
  const rowHeight = Math.max(7, rowsAvail / numRows);

  const jobAddr = [job.address, job.city, job.state, job.zip].filter(Boolean).join(", ");
  const specLine = segs.join("  |  ");

  const colW = COL_PROPS.map((p) => (p / COL_TOTAL) * contentW);

  const S = StyleSheet.create({
    page: {
      paddingTop: MARGIN.top,
      paddingBottom: MARGIN.bottom,
      paddingLeft: MARGIN.left,
      paddingRight: MARGIN.right,
      fontFamily: "Helvetica",
    },
    header: { flexDirection: "row", alignItems: "stretch", height: HEADER, marginBottom: 6 },
    logoWrap: { justifyContent: "center", paddingRight: 8 },
    logo: { height: 39.6, width: 90, objectFit: "contain" },
    headerRight: { flex: 1, backgroundColor: BLUE, justifyContent: "center", paddingHorizontal: 10 },
    panelName: { color: "#fff", fontSize: 16, fontFamily: "Helvetica-Bold" },
    jobAddr: { color: "#DDE1F0", fontSize: 6.5, marginTop: 2 },
    specsBar: {
      borderWidth: 1.5,
      borderColor: BLUE,
      backgroundColor: SPEC_FILL,
      paddingVertical: 3,
      paddingHorizontal: 6,
      marginBottom: 6,
    },
    specsText: { fontSize: 6, color: BLUE, fontFamily: "Helvetica-Bold" },
    table: { borderWidth: 1.5, borderColor: BLUE },
    theadRow: { flexDirection: "row", backgroundColor: BLUE, height: TABLE_HEADER, alignItems: "center" },
    th: { color: "#fff", fontSize: 6.5, fontFamily: "Helvetica-Bold", textAlign: "center" },
    row: { flexDirection: "row", alignItems: "center" },
    cellBase: { height: "100%", justifyContent: "center", borderRightWidth: 0.5, borderRightColor: GRID },
    legendWrap: { marginTop: 5 },
    legendText: { fontSize: 5.5, color: LEGEND, textAlign: "center" },
    genText: { fontSize: 4.5, color: LEGEND, textAlign: "right", marginTop: 2 },
  });

  const rows = [];
  for (let r = 0; r < numRows; r++) {
    const lc = byCkt.get(2 * r + 1);
    const rc = byCkt.get(2 * r + 2);
    const lCell = renderCell(lc, contMap.get(2 * r + 1));
    const rCell = renderCell(rc, contMap.get(2 * r + 2));
    const ph = phaseLetter(r, panel.phases);
    const bg = r % 2 === 1 ? ROW_ALT : "#fff";

    rows.push(
      <View key={r} style={[S.row, { height: rowHeight, backgroundColor: bg, borderTopWidth: r === 0 ? 0 : 0.5, borderTopColor: GRID }]} wrap={false}>
        {/* Left CKT */}
        <View style={[S.cellBase, { width: colW[0] }]}>
          <Text style={{ fontSize: 6.5, fontFamily: "Helvetica-Bold", color: BLUE, textAlign: "center" }}>{2 * r + 1}</Text>
        </View>
        {/* Left CB */}
        <View style={[S.cellBase, { width: colW[1] }]}>
          <Text style={{ fontSize: 6, textAlign: "center", color: lCell.gray ? SPARE : "#111" }}>{lCell.cb}</Text>
        </View>
        {/* Left DESC */}
        <View style={[S.cellBase, { width: colW[2], paddingHorizontal: 3 }]}>
          <Text style={{ fontSize: descFontSize(lCell.desc), textAlign: "left", color: lCell.gray ? SPARE : "#111", fontStyle: lCell.gray ? "italic" : "normal" }}>{lCell.desc}</Text>
        </View>
        {/* PH left */}
        <View style={[S.cellBase, { width: colW[3], backgroundColor: PH_FILL }]}>
          <Text style={{ fontSize: 6, textAlign: "center", color: BLUE }}>{ph}</Text>
        </View>
        {/* PH right */}
        <View style={[S.cellBase, { width: colW[4], backgroundColor: PH_FILL }]}>
          <Text style={{ fontSize: 6, textAlign: "center", color: BLUE }}>{ph}</Text>
        </View>
        {/* Right DESC */}
        <View style={[S.cellBase, { width: colW[5], paddingHorizontal: 3 }]}>
          <Text style={{ fontSize: descFontSize(rCell.desc), textAlign: "left", color: rCell.gray ? SPARE : "#111", fontStyle: rCell.gray ? "italic" : "normal" }}>{rCell.desc}</Text>
        </View>
        {/* Right CB */}
        <View style={[S.cellBase, { width: colW[6] }]}>
          <Text style={{ fontSize: 6, textAlign: "center", color: rCell.gray ? SPARE : "#111" }}>{rCell.cb}</Text>
        </View>
        {/* Right CKT */}
        <View style={[S.cellBase, { width: colW[7], borderRightWidth: 0 }]}>
          <Text style={{ fontSize: 6.5, fontFamily: "Helvetica-Bold", color: BLUE, textAlign: "center" }}>{2 * r + 2}</Text>
        </View>
      </View>
    );
  }

  const HEADERS = ["CKT", "CB", "LOAD DESCRIPTION", "PH", "PH", "LOAD DESCRIPTION", "CB", "CKT"];
  const genDate = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <Document>
      <Page size={SLEEVE_DIMS[sleeve]} style={S.page}>
        {/* Header */}
        <View style={S.header}>
          {logoSrc ? (
            <View style={S.logoWrap}>
              <Image src={logoSrc} style={S.logo} />
            </View>
          ) : null}
          <View style={S.headerRight}>
            <Text style={S.panelName}>PANEL {panel.name}</Text>
            {jobAddr ? <Text style={S.jobAddr}>{job.jobName} · {jobAddr}</Text> : <Text style={S.jobAddr}>{job.jobName}</Text>}
          </View>
        </View>

        {/* Specs bar */}
        <View style={S.specsBar}>
          <Text style={S.specsText}>{specLine}</Text>
        </View>

        {/* Table */}
        <View style={S.table}>
          <View style={S.theadRow}>
            {HEADERS.map((h, i) => (
              <View key={i} style={{ width: colW[i], borderRightWidth: i === 7 ? 0 : 0.5, borderRightColor: "#4A55A8" }}>
                <Text style={S.th}>{h}</Text>
              </View>
            ))}
          </View>
          {rows}
        </View>

        {/* Legend */}
        <View style={S.legendWrap}>
          <Text style={S.legendText}>LO = Lock-on device | GFI = GFCI breaker | Gray = spare, write over when used</Text>
          <Text style={S.genText}>Generated {genDate} · Ridgeline</Text>
        </View>
      </Page>
    </Document>
  );
}
