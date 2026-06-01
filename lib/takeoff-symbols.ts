export type SymbolDrawFn = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  col: string
) => void;

export interface TakeoffSym {
  id: string;
  label: string;
  category: string;
  draw: SymbolDrawFn;
}

// ─── Electrical symbols ───────────────────────────────────────────────────────
export const ELEC_SYMS: TakeoffSym[] = [
  {
    id: "duplex_recept",
    label: "Duplex Receptacle",
    category: "Devices",
    draw: (ctx, x, y, s, col) => {
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, s * 0.45, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - s * 0.45, y);
      ctx.lineTo(x - s * 0.7, y);
      ctx.moveTo(x - s * 0.55, y - s * 0.15);
      ctx.lineTo(x - s * 0.55, y + s * 0.15);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y - s * 0.35);
      ctx.lineTo(x, y + s * 0.35);
      ctx.stroke();
      ctx.restore();
    },
  },
  {
    id: "single_recept",
    label: "Single Receptacle",
    category: "Devices",
    draw: (ctx, x, y, s, col) => {
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, s * 0.45, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - s * 0.45, y);
      ctx.lineTo(x - s * 0.7, y);
      ctx.moveTo(x - s * 0.55, y - s * 0.15);
      ctx.lineTo(x - s * 0.55, y + s * 0.15);
      ctx.stroke();
      ctx.restore();
    },
  },
  {
    id: "gfci_recept",
    label: "GFCI Receptacle",
    category: "Devices",
    draw: (ctx, x, y, s, col) => {
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, s * 0.45, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - s * 0.45, y);
      ctx.lineTo(x - s * 0.7, y);
      ctx.moveTo(x - s * 0.55, y - s * 0.15);
      ctx.lineTo(x - s * 0.55, y + s * 0.15);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y - s * 0.35);
      ctx.lineTo(x, y + s * 0.35);
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.font = `bold ${s * 0.35}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText("GF", x + s * 0.2, y + s * 0.55);
      ctx.restore();
    },
  },
  {
    id: "wp_recept",
    label: "WP Receptacle",
    category: "Devices",
    draw: (ctx, x, y, s, col) => {
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, s * 0.45, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - s * 0.45, y);
      ctx.lineTo(x - s * 0.7, y);
      ctx.moveTo(x - s * 0.55, y - s * 0.15);
      ctx.lineTo(x - s * 0.55, y + s * 0.15);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y - s * 0.35);
      ctx.lineTo(x, y + s * 0.35);
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.font = `bold ${s * 0.35}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText("WP", x + s * 0.22, y + s * 0.55);
      ctx.restore();
    },
  },
  {
    id: "fourplex",
    label: "Fourplex Receptacle",
    category: "Devices",
    draw: (ctx, x, y, s, col) => {
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, s * 0.45, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - s * 0.45, y);
      ctx.lineTo(x - s * 0.7, y);
      ctx.moveTo(x - s * 0.55, y - s * 0.15);
      ctx.lineTo(x - s * 0.55, y + s * 0.15);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y - s * 0.3);
      ctx.lineTo(x, y + s * 0.3);
      ctx.moveTo(x - s * 0.3, y);
      ctx.lineTo(x + s * 0.3, y);
      ctx.stroke();
      ctx.restore();
    },
  },
  {
    id: "240v_recept",
    label: "240V Receptacle",
    category: "Devices",
    draw: (ctx, x, y, s, col) => {
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, s * 0.45, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.22, y - s * 0.13);
      ctx.lineTo(x + s * 0.22, y - s * 0.13);
      ctx.moveTo(x - s * 0.22, y);
      ctx.lineTo(x + s * 0.22, y);
      ctx.moveTo(x - s * 0.22, y + s * 0.13);
      ctx.lineTo(x + s * 0.22, y + s * 0.13);
      ctx.stroke();
      ctx.restore();
    },
  },
  {
    id: "sp_switch",
    label: "Single Pole Switch",
    category: "Devices",
    draw: (ctx, x, y, s, col) => {
      ctx.save();
      ctx.fillStyle = col;
      ctx.font = `bold ${s * 0.7}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("S", x, y);
      ctx.restore();
    },
  },
  {
    id: "3way_switch",
    label: "3-Way Switch",
    category: "Devices",
    draw: (ctx, x, y, s, col) => {
      ctx.save();
      ctx.fillStyle = col;
      ctx.font = `bold ${s * 0.6}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("S", x - s * 0.1, y);
      ctx.font = `bold ${s * 0.4}px sans-serif`;
      ctx.fillText("3", x + s * 0.35, y + s * 0.3);
      ctx.restore();
    },
  },
  {
    id: "dimmer_sw",
    label: "Dimmer Switch",
    category: "Devices",
    draw: (ctx, x, y, s, col) => {
      ctx.save();
      ctx.fillStyle = col;
      ctx.font = `bold ${s * 0.6}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("S", x - s * 0.1, y);
      ctx.font = `bold ${s * 0.4}px sans-serif`;
      ctx.fillText("D", x + s * 0.35, y + s * 0.3);
      ctx.restore();
    },
  },
  {
    id: "wall_fixture",
    label: "Wall Fixture",
    category: "Fixtures",
    draw: (ctx, x, y, s, col) => {
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x - s * 0.1, y, s * 0.35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + s * 0.26, y);
      ctx.lineTo(x + s * 0.55, y);
      ctx.stroke();
      ctx.restore();
    },
  },
  {
    id: "ceil_fixture",
    label: "Ceiling Fixture",
    category: "Fixtures",
    draw: (ctx, x, y, s, col) => {
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, s * 0.42, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, s * 0.12, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.restore();
    },
  },
  {
    id: "recessed",
    label: "Recessed Light",
    category: "Fixtures",
    draw: (ctx, x, y, s, col) => {
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, s * 0.45, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.font = `bold ${s * 0.45}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("R", x, y);
      ctx.restore();
    },
  },
  {
    id: "fluor_fixture",
    label: "Fluorescent Fixture",
    category: "Fixtures",
    draw: (ctx, x, y, s, col) => {
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.strokeRect(x - s * 0.5, y - s * 0.2, s, s * 0.4);
      ctx.beginPath();
      ctx.arc(x - s * 0.2, y, s * 0.12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + s * 0.2, y, s * 0.12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    },
  },
  {
    id: "wp_fixture",
    label: "WP Fixture",
    category: "Fixtures",
    draw: (ctx, x, y, s, col) => {
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.strokeRect(x - s * 0.45, y - s * 0.2, s * 0.9, s * 0.4);
      ctx.fillStyle = col;
      ctx.font = `bold ${s * 0.28}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("WP", x, y);
      ctx.restore();
    },
  },
  {
    id: "high_bay",
    label: "High Bay",
    category: "Fixtures",
    draw: (ctx, x, y, s, col) => {
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, s * 0.44, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * s * 0.44, y + Math.sin(a) * s * 0.44);
        ctx.lineTo(x + Math.cos(a) * s * 0.62, y + Math.sin(a) * s * 0.62);
        ctx.stroke();
      }
      ctx.restore();
    },
  },
  {
    id: "ceil_fan",
    label: "Ceiling Fan",
    category: "Fixtures",
    draw: (ctx, x, y, s, col) => {
      ctx.save();
      ctx.strokeStyle = col;
      ctx.fillStyle = col;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, s * 0.1, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((i * Math.PI * 2) / 3);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(s * 0.2, -s * 0.2, s * 0.4, 0);
        ctx.quadraticCurveTo(s * 0.2, s * 0.05, 0, 0);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    },
  },
  {
    id: "smoke_det",
    label: "Smoke Detector",
    category: "Fire Alarm",
    draw: (ctx, x, y, s, col) => {
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, s * 0.45, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.font = `bold ${s * 0.3}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("SD", x, y);
      ctx.restore();
    },
  },
  {
    id: "exit_light",
    label: "Exit Light",
    category: "Fire Alarm",
    draw: (ctx, x, y, s, col) => {
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.strokeRect(x - s * 0.45, y - s * 0.22, s * 0.9, s * 0.44);
      ctx.fillStyle = col;
      ctx.font = `bold ${s * 0.22}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("EXIT", x, y);
      ctx.restore();
    },
  },
  {
    id: "panel_box",
    label: "Panel Box",
    category: "Panels",
    draw: (ctx, x, y, s, col) => {
      ctx.save();
      ctx.fillStyle = col;
      ctx.fillRect(x - s * 0.42, y - s * 0.22, s * 0.84, s * 0.44);
      ctx.restore();
    },
  },
  {
    id: "junction_box",
    label: "Junction Box",
    category: "Boxes & Rough",
    draw: (ctx, x, y, s, col) => {
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.strokeRect(x - s * 0.38, y - s * 0.38, s * 0.76, s * 0.76);
      ctx.restore();
    },
  },
  {
    id: "data_port",
    label: "Data Port",
    category: "Data",
    draw: (ctx, x, y, s, col) => {
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.strokeRect(x - s * 0.38, y - s * 0.38, s * 0.76, s * 0.76);
      ctx.fillStyle = col;
      ctx.font = `bold ${s * 0.4}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("D", x, y);
      ctx.restore();
    },
  },
  {
    id: "telephone",
    label: "Telephone",
    category: "Data",
    draw: (ctx, x, y, s, col) => {
      ctx.save();
      ctx.strokeStyle = col;
      ctx.fillStyle = col;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.4, y - s * 0.3);
      ctx.lineTo(x - s * 0.4, y + s * 0.3);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.2, y);
      ctx.lineTo(x + s * 0.3, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + s * 0.15, y - s * 0.18);
      ctx.lineTo(x + s * 0.3, y);
      ctx.lineTo(x + s * 0.15, y + s * 0.18);
      ctx.stroke();
      ctx.restore();
    },
  },
  {
    id: "motor",
    label: "Motor",
    category: "Low Voltage / Misc",
    draw: (ctx, x, y, s, col) => {
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, s * 0.45, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.font = `bold ${s * 0.5}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("M", x, y);
      ctx.restore();
    },
  },
  {
    id: "xfmr",
    label: "Transformer",
    category: "Low Voltage / Misc",
    draw: (ctx, x, y, s, col) => {
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x - s * 0.2, y, s * 0.28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + s * 0.2, y, s * 0.28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    },
  },
];

// ─── Basic / generic symbols ──────────────────────────────────────────────────
export const BASIC_SYMS: TakeoffSym[] = [
  {
    id: "dot",
    label: "Dot",
    category: "Custom",
    draw: (ctx, x, y, s, col) => {
      ctx.save();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x, y, s * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
  },
  {
    id: "circle",
    label: "Circle",
    category: "Custom",
    draw: (ctx, x, y, s, col) => {
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, s * 0.45, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    },
  },
  {
    id: "square",
    label: "Square",
    category: "Custom",
    draw: (ctx, x, y, s, col) => {
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.strokeRect(x - s * 0.4, y - s * 0.4, s * 0.8, s * 0.8);
      ctx.restore();
    },
  },
  {
    id: "triangle",
    label: "Triangle",
    category: "Custom",
    draw: (ctx, x, y, s, col) => {
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y - s * 0.45);
      ctx.lineTo(x + s * 0.4, y + s * 0.35);
      ctx.lineTo(x - s * 0.4, y + s * 0.35);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    },
  },
  {
    id: "star",
    label: "Star",
    category: "Custom",
    draw: (ctx, x, y, s, col) => {
      ctx.save();
      ctx.fillStyle = col;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
        const b = a + Math.PI / 5;
        if (i === 0) ctx.moveTo(x + Math.cos(a) * s * 0.45, y + Math.sin(a) * s * 0.45);
        else ctx.lineTo(x + Math.cos(a) * s * 0.45, y + Math.sin(a) * s * 0.45);
        ctx.lineTo(x + Math.cos(b) * s * 0.2, y + Math.sin(b) * s * 0.2);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    },
  },
  {
    id: "diamond",
    label: "Diamond",
    category: "Custom",
    draw: (ctx, x, y, s, col) => {
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y - s * 0.45);
      ctx.lineTo(x + s * 0.35, y);
      ctx.lineTo(x, y + s * 0.45);
      ctx.lineTo(x - s * 0.35, y);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    },
  },
  {
    id: "cross",
    label: "Cross",
    category: "Custom",
    draw: (ctx, x, y, s, col) => {
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.4, y);
      ctx.lineTo(x + s * 0.4, y);
      ctx.moveTo(x, y - s * 0.4);
      ctx.lineTo(x, y + s * 0.4);
      ctx.stroke();
      ctx.restore();
    },
  },
  {
    id: "x_mark",
    label: "X Mark",
    category: "Custom",
    draw: (ctx, x, y, s, col) => {
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.35, y - s * 0.35);
      ctx.lineTo(x + s * 0.35, y + s * 0.35);
      ctx.moveTo(x + s * 0.35, y - s * 0.35);
      ctx.lineTo(x - s * 0.35, y + s * 0.35);
      ctx.stroke();
      ctx.restore();
    },
  },
];

// ─── Combined lookup ──────────────────────────────────────────────────────────
export const ALL_SYMS: Record<string, TakeoffSym> = Object.fromEntries(
  [...ELEC_SYMS, ...BASIC_SYMS].map((s) => [s.id, s])
);

// ─── Backward-compatible flat draw-function map (used by takeoff-client) ──────
export const SYMBOLS: Record<string, SymbolDrawFn> = Object.fromEntries(
  [...ELEC_SYMS, ...BASIC_SYMS].map((s) => [s.id, s.draw])
);

// ─── Category constants ───────────────────────────────────────────────────────
export const CAT_ORDER: string[] = [
  "Devices",
  "Fixtures",
  "Data",
  "Conduit",
  "Panels",
  "Fire Alarm",
  "Boxes & Rough",
  "Low Voltage / Misc",
  "Custom",
];

/** Dark palette — use for active/selected state */
export const CAT_COLORS: Record<string, string> = {
  Devices: "#c0392b",
  Fixtures: "#2471a3",
  Data: "#1e8449",
  Conduit: "#b7950b",
  Panels: "#7d3c98",
  "Fire Alarm": "#e03a99",
  "Boxes & Rough": "#ca6f1e",
  "Low Voltage / Misc": "#148f77",
  Custom: "#555555",
};

/** Bright palette — use for default / unselected symbol color */
export const CAT_DEFAULT_COLORS: Record<string, string> = {
  Devices: "#e03a3a",
  Fixtures: "#3a8fe8",
  Data: "#2db562",
  Conduit: "#f0a500",
  Panels: "#b03ae0",
  "Fire Alarm": "#e03a99",
  "Boxes & Rough": "#e0773a",
  "Low Voltage / Misc": "#3adde0",
  Custom: "#9aa0ab",
};
