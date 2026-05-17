export type SymbolDrawFn = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  col: string
) => void;

export const SYMBOLS: Record<string, SymbolDrawFn> = {
  duplex_recept: (ctx, x, y, s, col) => {
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

  single_recept: (ctx, x, y, s, col) => {
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

  gfci_recept: (ctx, x, y, s, col) => {
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

  wp_recept: (ctx, x, y, s, col) => {
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

  fourplex: (ctx, x, y, s, col) => {
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

  "240v_recept": (ctx, x, y, s, col) => {
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, s * 0.45, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.font = `bold ${s * 0.32}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("240", x, y);
    ctx.restore();
  },

  sp_switch: (ctx, x, y, s, col) => {
    ctx.save();
    ctx.fillStyle = col;
    ctx.font = `bold ${s * 0.9}px Barlow Condensed, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("S", x, y);
    ctx.restore();
  },

  "3way_switch": (ctx, x, y, s, col) => {
    ctx.save();
    ctx.fillStyle = col;
    ctx.font = `bold ${s * 0.9}px Barlow Condensed, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("S", x - s * 0.1, y);
    ctx.font = `bold ${s * 0.4}px sans-serif`;
    ctx.fillText("3", x + s * 0.35, y + s * 0.3);
    ctx.restore();
  },

  dimmer_sw: (ctx, x, y, s, col) => {
    ctx.save();
    ctx.fillStyle = col;
    ctx.font = `bold ${s * 0.9}px Barlow Condensed, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("S", x - s * 0.1, y);
    ctx.font = `bold ${s * 0.4}px sans-serif`;
    ctx.fillText("D", x + s * 0.35, y + s * 0.3);
    ctx.restore();
  },

  motor: (ctx, x, y, s, col) => {
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

  wall_fixture: (ctx, x, y, s, col) => {
    ctx.save();
    ctx.fillStyle = col;
    ctx.fillRect(x - s * 0.5, y - s * 0.2, s, s * 0.4);
    ctx.restore();
  },

  ceil_fixture: (ctx, x, y, s, col) => {
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, s * 0.45, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, s * 0.1, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.restore();
  },

  recessed: (ctx, x, y, s, col) => {
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, s * 0.45, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - s * 0.3, y - s * 0.3);
    ctx.lineTo(x + s * 0.3, y + s * 0.3);
    ctx.moveTo(x + s * 0.3, y - s * 0.3);
    ctx.lineTo(x - s * 0.3, y + s * 0.3);
    ctx.stroke();
    ctx.restore();
  },

  fluor_fixture: (ctx, x, y, s, col) => {
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

  wp_fixture: (ctx, x, y, s, col) => {
    ctx.save();
    ctx.fillStyle = col;
    ctx.fillRect(x - s * 0.5, y - s * 0.2, s, s * 0.4);
    ctx.font = `bold ${s * 0.28}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = "#111";
    ctx.fillText("WP", x, y + s * 0.18);
    ctx.restore();
  },

  high_bay: (ctx, x, y, s, col) => {
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, s * 0.3, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * s * 0.35, y + Math.sin(a) * s * 0.35);
      ctx.lineTo(x + Math.cos(a) * s * 0.5, y + Math.sin(a) * s * 0.5);
      ctx.stroke();
    }
    ctx.restore();
  },

  ceil_fan: (ctx, x, y, s, col) => {
    ctx.save();
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, s * 0.15, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((i * Math.PI * 2) / 3);
      ctx.beginPath();
      ctx.ellipse(s * 0.3, 0, s * 0.2, s * 0.09, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  },

  smoke_det: (ctx, x, y, s, col) => {
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

  exit_light: (ctx, x, y, s, col) => {
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

  panel_box: (ctx, x, y, s, col) => {
    ctx.save();
    ctx.fillStyle = col;
    ctx.fillRect(x - s * 0.42, y - s * 0.22, s * 0.84, s * 0.44);
    ctx.restore();
  },

  junction_box: (ctx, x, y, s, col) => {
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.strokeRect(x - s * 0.4, y - s * 0.4, s * 0.8, s * 0.8);
    ctx.beginPath();
    ctx.moveTo(x - s * 0.4, y - s * 0.4);
    ctx.lineTo(x + s * 0.4, y + s * 0.4);
    ctx.moveTo(x + s * 0.4, y - s * 0.4);
    ctx.lineTo(x - s * 0.4, y + s * 0.4);
    ctx.stroke();
    ctx.restore();
  },

  xfmr: (ctx, x, y, s, col) => {
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

  data_port: (ctx, x, y, s, col) => {
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

  telephone: (ctx, x, y, s, col) => {
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.strokeRect(x - s * 0.38, y - s * 0.38, s * 0.76, s * 0.76);
    ctx.fillStyle = col;
    ctx.font = `bold ${s * 0.4}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("T", x, y);
    ctx.restore();
  },

  dot: (ctx, x, y, s, col) => {
    ctx.save();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, y, s * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  circle: (ctx, x, y, s, col) => {
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, s * 0.45, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  },

  square: (ctx, x, y, s, col) => {
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.strokeRect(x - s * 0.4, y - s * 0.4, s * 0.8, s * 0.8);
    ctx.restore();
  },

  triangle: (ctx, x, y, s, col) => {
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

  star: (ctx, x, y, s, col) => {
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

  diamond: (ctx, x, y, s, col) => {
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

  cross: (ctx, x, y, s, col) => {
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

  x_mark: (ctx, x, y, s, col) => {
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
};
