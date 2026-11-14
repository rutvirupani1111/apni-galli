// The paper-and-tin kit. Everything is drawn in code; the only bitmaps on a lane are owner photos.
// Colours come from CSS tokens so a lane's palette, and night, recolour the whole kit.
import { mulberry32 } from "@/lib/dna";
import type { ReactNode } from "react";

export const V = (name: string) => `var(--${name})`;
export const mix = (a: string, pct: number, b: string) => `color-mix(in srgb, ${a} ${pct}%, ${b})`;

/** Patterns and filters shared by every scene on a page. Rendered once, referenced by id. */
export function KitDefs({ awning = 18 }: { awning?: number }) {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <defs>
        <pattern id="k-ribs" width="8" height="24" patternUnits="userSpaceOnUse">
          <rect width="8" height="24" style={{ fill: mix(V("tin"), 88, "#fff") }} />
          {[7, 15, 23].map((y) => (
            <rect key={y} y={y} width="8" height="1.6" style={{ fill: mix(V("tin"), 30, "#1e1b18") }} />
          ))}
          <rect y="2" width="8" height="2" fill="#fff4e0" opacity="0.35" />
          <rect y="10" width="8" height="1" fill="#fff4e0" opacity="0.25" />
        </pattern>
        <pattern id="k-tinwall" width="12" height="40" patternUnits="userSpaceOnUse">
          <rect width="12" height="40" style={{ fill: mix(V("lane-b"), 72, V("tin")) }} />
          <rect x="0" width="2" height="40" fill="#000" opacity="0.16" />
          <rect x="6" width="1.5" height="40" fill="#fff" opacity="0.16" />
        </pattern>
        <pattern id="k-awn" width={awning * 2} height="10" patternUnits="userSpaceOnUse">
          <rect width={awning} height="10" style={{ fill: V("lane-b") }} />
          <rect x={awning} width={awning} height="10" fill="#fff4e0" />
        </pattern>
        <pattern id="k-brick" width="28" height="14" patternUnits="userSpaceOnUse">
          <rect width="28" height="14" style={{ fill: mix(V("brick"), 78, V("sindoor")) }} />
          <path d="M0 13.5H28M14 0V7M0 6.5H28M0 7V14M28 7V14" stroke="#e9d6b8" strokeWidth="1.2" opacity="0.55" />
        </pattern>
        <pattern id="k-cork" width="18" height="18" patternUnits="userSpaceOnUse">
          <rect width="18" height="18" fill="#c79a5b" />
          <circle cx="4" cy="5" r="1.2" fill="#8a5a2b" opacity="0.6" />
          <circle cx="13" cy="11" r="1" fill="#8a5a2b" opacity="0.5" />
          <circle cx="8" cy="15" r="0.8" fill="#f0d39a" opacity="0.7" />
          <circle cx="15" cy="3" r="0.7" fill="#f0d39a" opacity="0.6" />
        </pattern>
        <pattern id="k-tinsheet" width="30" height="30" patternUnits="userSpaceOnUse">
          <rect width="30" height="30" style={{ fill: V("tin") }} />
          <circle cx="3" cy="3" r="1.4" fill="#7c766b" />
          <path d="M0 29.5H30" stroke="#8d877b" />
        </pattern>
        <pattern id="k-chalkboard" width="40" height="40" patternUnits="userSpaceOnUse">
          <rect width="40" height="40" fill="#24302b" />
          <path d="M3 8l7 2M20 30l9-3M30 12l5 1" stroke="#fff" strokeWidth="0.6" opacity="0.08" />
        </pattern>
        <filter id="k-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 0.12  0 0 0 0 0.1  0 0 0 0 0.08  0 0 0 1.2 -0.25" />
        </filter>
        <filter id="k-wood" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.02 0.4" numOctaves="2" seed="3" />
          <feColorMatrix values="0 0 0 0 0.3  0 0 0 0 0.18  0 0 0 0 0.08  0 0 0 0.9 0" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
        <linearGradient id="k-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: V("sky-1") }} />
          <stop offset="1" style={{ stopColor: V("sky-2") }} />
        </linearGradient>
        <radialGradient id="k-glow" cx="0.5" cy="0.35" r="0.7">
          <stop offset="0" style={{ stopColor: V("haldi") }} stopOpacity="0.95" />
          <stop offset="0.55" style={{ stopColor: V("marigold") }} stopOpacity="0.75" />
          <stop offset="1" style={{ stopColor: V("brick") }} />
        </radialGradient>
      </defs>
    </svg>
  );
}

/** Risograph grain, once per scene root, never per prop. */
export function Grain({ w = 360, h = 520 }: { w?: number; h?: number }) {
  return <rect className="grain-layer" width={w} height={h} filter="url(#k-grain)" opacity="0.06" style={{ mixBlendMode: "multiply" }} />;
}

/** Wood grain over a fill, grain running vertically. */
export function Wood({ x, y, w, h, fill, rx = 0 }: { x: number; y: number; w: number; h: number; fill: string; rx?: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={rx} style={{ fill }} />
      <rect className="fx" x={x} y={y} width={w} height={h} rx={rx} style={{ fill }} filter="url(#k-wood)" opacity="0.04" />
    </g>
  );
}

/** Marigold toran on a catenary. Marigold heads alternate with mango leaves. */
export function Toran({ x = 0, y = 0, w = 360, sag = 26, count = 16, seed = 1 }: { x?: number; y?: number; w?: number; sag?: number; count?: number; seed?: number }) {
  const r = mulberry32(seed);
  const at = (t: number) => {
    const px = x + t * w;
    const u = (t - 0.5) * 2;
    return [px, y + sag * (1 - u * u) + 4 * Math.cosh(u) - 4];
  };
  const pts = Array.from({ length: 41 }, (_, i) => at(i / 40));
  const d = "M" + pts.map((p) => p.map((n) => n.toFixed(1)).join(" ")).join(" L");
  const items: ReactNode[] = [];
  for (let i = 0; i <= count; i++) {
    const [px, py] = at(i / count);
    if (i % 2 === 0) {
      const ring = Array.from({ length: 9 }, (_, k) => {
        const a = (k / 9) * Math.PI * 2 + r();
        return <circle key={k} cx={px + Math.cos(a) * 6.5} cy={py + 9 + Math.sin(a) * 6.5} r="3" style={{ fill: mix(V("marigold"), 78, V("sindoor")) }} />;
      });
      items.push(
        <g key={i}>
          <line x1={px} y1={py} x2={px} y2={py + 4} stroke="#3b2a12" strokeWidth="1" />
          {ring}
          <circle cx={px} cy={py + 9} r="5.5" style={{ fill: V("marigold") }} />
          <circle cx={px - 1.5} cy={py + 7.5} r="1.6" fill="#fff4e0" opacity="0.5" />
        </g>,
      );
    } else {
      const len = 16 + r() * 6;
      items.push(
        <path
          key={i}
          d={`M${px} ${py} C${px - 7} ${py + len * 0.35} ${px - 4} ${py + len * 0.8} ${px} ${py + len} C${px + 4} ${py + len * 0.8} ${px + 7} ${py + len * 0.35} ${px} ${py}Z`}
          style={{ fill: mix(V("peacock"), 70, "#2f6b1f") }}
          stroke="#1f3a12"
          strokeWidth="0.6"
        />,
      );
    }
  }
  return (
    <g aria-hidden="true">
      <path d={d} fill="none" stroke="#3b2a12" strokeWidth="1.4" />
      {items}
    </g>
  );
}

/** String lights; they pulse only at night ("open at night") and never in Saada. */
export function StringLights({ x = 0, y = 0, w = 360, sag = 18, n = 14, on = true }: { x?: number; y?: number; w?: number; sag?: number; n?: number; on?: boolean }) {
  const at = (t: number) => [x + t * w, y + sag * (1 - ((t - 0.5) * 2) ** 2)];
  const pts = Array.from({ length: 21 }, (_, i) => at(i / 20));
  return (
    <g aria-hidden="true">
      <path d={"M" + pts.map((p) => p.join(" ")).join(" L")} fill="none" stroke="#2a2420" strokeWidth="1" />
      <g className={on ? "lights" : ""}>
        {Array.from({ length: n }, (_, i) => {
          const [px, py] = at((i + 0.5) / n);
          const c = ["haldi", "rani", "mint-enamel", "marigold"][i % 4];
          return <circle key={i} cx={px} cy={py + 4} r="3.2" style={{ fill: V(c) }} opacity={on ? 1 : 0.5} />;
        })}
      </g>
    </g>
  );
}

const MOTIFS = [
  // paisley
  (cx: number, cy: number, s: number) => <path d={`M${cx} ${cy + s} C${cx - s} ${cy + s} ${cx - s} ${cy - s * 0.2} ${cx} ${cy - s * 0.3} C${cx + s * 0.7} ${cy - s * 0.4} ${cx + s * 0.4} ${cy - s} ${cx + s * 0.9} ${cy - s} C${cx + s * 0.6} ${cy - s * 0.4} ${cx + s} ${cy + s} ${cx} ${cy + s}Z`} />,
  // sun
  (cx: number, cy: number, s: number) => (
    <g>
      <circle cx={cx} cy={cy} r={s * 0.45} />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return <rect key={i} x={cx - 1} y={cy - s} width="2" height={s * 0.35} transform={`rotate(${(a * 180) / Math.PI} ${cx} ${cy})`} />;
      })}
    </g>
  ),
  // lotus
  (cx: number, cy: number, s: number) => (
    <g>
      <path d={`M${cx} ${cy - s} C${cx + s * 0.4} ${cy - s * 0.3} ${cx + s * 0.3} ${cy + s * 0.4} ${cx} ${cy + s * 0.5} C${cx - s * 0.3} ${cy + s * 0.4} ${cx - s * 0.4} ${cy - s * 0.3} ${cx} ${cy - s}Z`} />
      <path d={`M${cx - s} ${cy} C${cx - s * 0.5} ${cy - s * 0.3} ${cx - s * 0.1} ${cy + s * 0.2} ${cx} ${cy + s * 0.5} C${cx - s * 0.5} ${cy + s * 0.5} ${cx - s * 0.9} ${cy + s * 0.3} ${cx - s} ${cy}Z`} />
      <path d={`M${cx + s} ${cy} C${cx + s * 0.5} ${cy - s * 0.3} ${cx + s * 0.1} ${cy + s * 0.2} ${cx} ${cy + s * 0.5} C${cx + s * 0.5} ${cy + s * 0.5} ${cx + s * 0.9} ${cy + s * 0.3} ${cx + s} ${cy}Z`} />
    </g>
  ),
  // kite
  (cx: number, cy: number, s: number) => (
    <g>
      <path d={`M${cx} ${cy - s} L${cx + s * 0.75} ${cy} L${cx} ${cy + s} L${cx - s * 0.75} ${cy}Z`} />
      <path d={`M${cx} ${cy + s} q4 5 -1 9 q-5 4 1 8`} fill="none" stroke="currentColor" strokeWidth="1.2" />
    </g>
  ),
];

/** Enamel signboard from the truck-art kit: border style x motif x lettering. Flat fills, no gradients. */
export function Signboard({
  x,
  y,
  w,
  h,
  name,
  hi,
  kit,
  seed = 7,
  fill = "lane-a",
  ink = "on-lane-a",
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  name: string;
  hi?: string;
  kit: { border: number; motif: number; lettering: number };
  seed?: number;
  fill?: string;
  ink?: string;
}) {
  const r = mulberry32(seed);
  const pad = 10;
  const inner = { x: x + 8, y: y + 8, w: w - 16, h: h - 16 };
  const devaFirst = kit.lettering === 2 && !!hi;
  const main = devaFirst ? hi! : name;
  const sub = devaFirst ? name : hi;
  const motifW = h * 0.42;
  const room = w - 2 * pad - 2 * motifW - 8;
  const len = Math.max(4, [...main].length);
  const fs = Math.min(h * (sub ? 0.42 : 0.52), room / (len * (devaFirst ? 0.62 : 0.54)));
  const sfs = Math.min(h * 0.2, (room * 1.15) / Math.max(4, [...(sub ?? "")].length * 0.55));
  const family = kit.lettering === 1 ? "var(--f-mast), var(--f-body-deva), serif" : "var(--f-sign), var(--f-body-deva), serif";
  const chip = [
    [x + w, y],
    [x + w - 10 - r() * 8, y],
    [x + w - 6 - r() * 4, y + 5 + r() * 3],
    [x + w - 2, y + 4 + r() * 4],
    [x + w, y + 12 + r() * 6],
  ];
  const Motif = MOTIFS[kit.motif % 4];
  const cy = y + h / 2;
  return (
    <g>
      <rect x={x + 3} y={y + 4} width={w} height={h} rx="5" style={{ fill: mix(V("brick"), 40, "transparent") }} />
      <rect x={x} y={y} width={w} height={h} rx="5" style={{ fill: V(fill) }} />
      {kit.border === 0 && <rect x={inner.x} y={inner.y} width={inner.w} height={inner.h} rx="3" fill="none" stroke="#fff4e0" strokeWidth="3" />}
      {kit.border === 1 && (
        <g fill="none" stroke="#fff4e0">
          <rect x={inner.x} y={inner.y} width={inner.w} height={inner.h} rx="2" strokeWidth="2" />
          <rect x={inner.x + 5} y={inner.y + 5} width={inner.w - 10} height={inner.h - 10} rx="1" strokeWidth="1" />
        </g>
      )}
      {kit.border === 2 && <rect x={inner.x} y={inner.y} width={inner.w} height={inner.h} rx="3" fill="none" stroke="#fff4e0" strokeWidth="3" strokeDasharray="10 5" />}
      {kit.border === 3 && (
        <g fill="none" stroke="#fff4e0" strokeWidth="2.5">
          <path d={`M${inner.x + 12} ${inner.y} H${inner.x + inner.w - 12} A12 12 0 0 0 ${inner.x + inner.w} ${inner.y + 12} V${inner.y + inner.h - 12} A12 12 0 0 0 ${inner.x + inner.w - 12} ${inner.y + inner.h} H${inner.x + 12} A12 12 0 0 0 ${inner.x} ${inner.y + inner.h - 12} V${inner.y + 12} A12 12 0 0 0 ${inner.x + 12} ${inner.y}Z`} />
        </g>
      )}
      {[
        [x + 6, y + 6],
        [x + w - 6, y + 6],
        [x + 6, y + h - 6],
        [x + w - 6, y + h - 6],
      ].map(([cx, cyy], i) => (
        <g key={i}>
          <circle cx={cx} cy={cyy} r="3" fill="#cfc6b4" stroke="#6f675a" strokeWidth="0.8" />
          <circle cx={cx - 0.8} cy={cyy - 0.8} r="0.9" fill="#fff" />
        </g>
      ))}
      <polygon points={chip.map((p) => p.join(",")).join(" ")} fill="#1e1b18" />
      <g style={{ fill: V(ink), color: V(ink) }} opacity="0.92">
        {Motif(x + pad + motifW / 2 + 2, cy, motifW / 2)}
        {Motif(x + w - pad - motifW / 2 - 2, cy, motifW / 2)}
      </g>
      <text
        x={x + w / 2}
        y={sub ? cy + fs * 0.05 : cy + fs * 0.34}
        textAnchor="middle"
        style={{ fill: V(ink), fontFamily: family, fontSize: fs }}
      >
        {main}
      </text>
      {sub && (
        <text x={x + w / 2} y={cy + fs * 0.05 + sfs * 1.25} textAnchor="middle" style={{ fill: V(ink), fontFamily: "var(--f-mono), monospace", fontSize: sfs, letterSpacing: "0.12em" }}>
          {sub.toUpperCase()}
        </text>
      )}
    </g>
  );
}

/** Striped awning with a scalloped edge (semicircles r 9). */
export function Awning({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const n = Math.max(2, Math.round(w / 18));
  const r = w / n / 2;
  let d = `M${x} ${y} H${x + w} V${y + h}`;
  for (let i = n; i > 0; i--) {
    const cx = x + (i - 0.5) * 2 * r;
    d += ` A${r} ${r} 0 0 1 ${cx - r} ${y + h}`;
    void cx;
  }
  d += ` V${y}Z`;
  return (
    <g className="awning">
      <path d={`M${x} ${y + h} H${x + w} V${y + h + 8} H${x}Z`} fill="#000" opacity="0.12" />
      <path d={d} fill="url(#k-awn)" stroke="#1e1b18" strokeWidth="1.2" />
      <rect x={x} y={y} width={w} height="5" fill="#1e1b18" opacity="0.25" />
    </g>
  );
}

/** The corrugated rolling shutter body. */
export function ShutterBody({ x, y, w, h, slot = true }: { x: number; y: number; w: number; h: number; slot?: boolean }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="url(#k-ribs)" />
      <rect x={x} y={y + h - 14} width={w} height="14" style={{ fill: mix(V("tin"), 45, "#1e1b18") }} />
      <rect x={x + w / 2 - 9} y={y + h - 22} width="18" height="16" rx="2" fill="#5a544b" />
      <path d={`M${x + w / 2 - 5} ${y + h - 22} v-6 a5 5 0 0 1 10 0 v6`} fill="none" stroke="#3a352f" strokeWidth="2.4" />
      {slot && <rect x={x + w / 2 - 34} y={y + h * 0.58} width="68" height="7" rx="3" fill="#1e1b18" />}
    </g>
  );
}

/* ---------- tin cut-out props. Each is sized to its meaning: the cycle is big and the token is small. ---------- */

function Thick({ children, dx = 1.4 }: { children: ReactNode; dx?: number }) {
  return (
    <>
      <g transform={`translate(${dx} ${dx})`} style={{ color: mix("currentColor", 55, "#1e1b18") }} opacity="0.9">
        {children}
      </g>
      {children}
    </>
  );
}

export function Cycle({ x, y, s = 1, title }: { x: number; y: number; s?: number; title?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} style={{ color: "#2b2723" }} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <Thick>
        <g fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round">
          <circle cx="22" cy="46" r="20" />
          <circle cx="98" cy="46" r="20" />
          <path d="M22 46 L48 46 L76 18 L40 18 Z M48 46 L36 10 M76 18 L98 46 M76 18 L72 6 L84 6" />
          <path d="M30 10 h14" strokeWidth="5" />
        </g>
      </Thick>
      <circle cx="48" cy="46" r="4" style={{ fill: V("marigold") }} />
    </g>
  );
}

export function Tulsi({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} aria-hidden="true">
      <path d="M4 40 h36 l-5 26 h-26z" style={{ fill: V("brick") }} stroke="#3b1d0e" strokeWidth="1" />
      <rect x="2" y="36" width="40" height="7" rx="2" style={{ fill: mix(V("brick"), 80, "#fff") }} />
      <path d="M8 52 h28" stroke="#fff4e0" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />
      {[
        [22, 30, 7],
        [14, 26, 6],
        [30, 24, 6],
        [18, 16, 5],
        [27, 12, 5],
        [22, 4, 4],
      ].map(([cx, cy, r], i) => (
        <circle key={i} cx={cx} cy={cy} r={r} style={{ fill: mix(V("peacock"), 60, "#3f7d1e") }} stroke="#1f3a12" strokeWidth="0.7" />
      ))}
    </g>
  );
}

export function ChaiGlass({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} aria-hidden="true">
      <path d="M0 0 h14 l-2 18 h-10z" fill="#fff" opacity="0.55" stroke="#6b5a49" strokeWidth="0.8" />
      <path d="M1 5 h12 l-1.5 13 h-9z" style={{ fill: mix(V("marigold"), 50, V("brick")) }} />
      <path d="M4 -4 q2 -3 0 -6 M9 -4 q2 -3 0 -6" stroke="#9b8b7a" strokeWidth="0.8" fill="none" opacity="0.7" />
    </g>
  );
}

export function Kettle({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} style={{ color: V("tin") }} aria-hidden="true">
      <Thick>
        <path d="M6 10 h22 l3 18 h-28z" fill="currentColor" />
        <path d="M28 14 q12 -2 12 -12" stroke="currentColor" strokeWidth="3" fill="none" />
        <path d="M10 10 q7 -10 14 0" stroke="currentColor" strokeWidth="2.5" fill="none" />
      </Thick>
    </g>
  );
}

export function Stool({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} aria-hidden="true">
      <rect x="0" y="0" width="40" height="6" rx="2" style={{ fill: V("lane-c") }} stroke="#1e1b18" />
      <path d="M5 6 l-3 26 M35 6 l3 26 M12 6 l-1 26 M28 6 l1 26" stroke="#3b2a12" strokeWidth="2.5" />
    </g>
  );
}

export function SteelJar({ x, y, s = 1, fill = "haldi" }: { x: number; y: number; s?: number; fill?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} aria-hidden="true">
      <rect x="0" y="6" width="26" height="34" rx="4" fill="#d9d6cf" stroke="#77736b" />
      <rect x="3" y="14" width="20" height="22" rx="2" style={{ fill: V(fill) }} opacity="0.85" />
      <rect x="2" y="0" width="22" height="8" rx="2" fill="#bdb9b0" stroke="#77736b" />
      <rect x="5" y="9" width="3" height="28" fill="#fff" opacity="0.6" />
    </g>
  );
}

export function Scale({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} style={{ color: "#a8823a" }} aria-hidden="true">
      <Thick>
        <g stroke="currentColor" strokeWidth="2" fill="none">
          <path d="M25 4 V40 M5 10 H45 M5 10 l-5 14 h10z M45 10 l-5 14 h10z" />
          <path d="M0 24 q5 6 10 0 M40 24 q5 6 10 0" fill="currentColor" />
          <path d="M15 40 h20" strokeWidth="4" />
        </g>
      </Thick>
    </g>
  );
}

export function Scissors({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} aria-hidden="true" fill="none" stroke="#56514a" strokeWidth="1.8">
      <circle cx="4" cy="4" r="3.5" />
      <circle cx="4" cy="14" r="3.5" />
      <path d="M7 6 L24 12 M7 12 L24 6" />
    </g>
  );
}

export function BrassToken({ x, y, r = 9, filled = true }: { x: number; y: number; r?: number; filled?: boolean }) {
  return (
    <g aria-hidden="true">
      <circle cx={x + 1} cy={y + 1.4} r={r} fill="#5a3b10" opacity="0.5" />
      <circle cx={x} cy={y} r={r} fill={filled ? "#c9962e" : "none"} stroke="#7a5414" strokeWidth="1.4" strokeDasharray={filled ? undefined : "3 2"} />
      {filled && <circle cx={x} cy={y} r={r * 0.62} fill="none" stroke="#f3d27a" strokeWidth="1" />}
      {filled && <circle cx={x - r * 0.35} cy={y - r * 0.35} r={r * 0.18} fill="#fff1c2" />}
    </g>
  );
}

export function Lantern({ x, y, s = 1, lit = true }: { x: number; y: number; s?: number; lit?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} aria-hidden="true">
      <path d="M10 0 v6" stroke="#2a2420" />
      <path d="M3 6 h14 l-2 4 h-10z" fill="#2a2420" />
      <rect x="4" y="10" width="12" height="16" rx="3" style={{ fill: lit ? V("haldi") : "#7d776c" }} stroke="#2a2420" strokeWidth="1.4" />
      {lit && <circle cx="10" cy="18" r="9" style={{ fill: V("haldi") }} opacity="0.22" />}
      <path d="M3 26 h14" stroke="#2a2420" strokeWidth="2.4" />
    </g>
  );
}

export function Kite({ x, y, s = 1, rot = -12, fill = "lane-a" }: { x: number; y: number; s?: number; rot?: number; fill?: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`} aria-hidden="true">
      <path d="M0 -18 L14 0 L0 18 L-14 0Z" style={{ fill: V(fill) }} stroke="#1e1b18" strokeWidth="1" />
      <path d="M0 -18 V18 M-14 0 H14" stroke="#1e1b18" strokeWidth="0.8" opacity="0.6" />
      <path d="M0 18 q6 8 -2 14 q-8 6 2 14" fill="none" stroke="#1e1b18" strokeWidth="0.8" />
    </g>
  );
}

export function WaterTank({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} aria-hidden="true">
      <path d="M4 10 h52 v40 h-52z" fill="#26231f" />
      <ellipse cx="30" cy="10" rx="26" ry="6" fill="#3b3731" />
      {[20, 30, 40].map((yy) => (
        <path key={yy} d={`M4 ${yy} h52`} stroke="#4a453e" strokeWidth="1.4" />
      ))}
      <path d="M10 50 v14 M50 50 v14" stroke="#26231f" strokeWidth="3" />
    </g>
  );
}

export function Clothesline({ x, y, w, colors }: { x: number; y: number; w: number; colors: string[] }) {
  const sag = 10;
  return (
    <g aria-hidden="true">
      <path d={`M${x} ${y} Q${x + w / 2} ${y + sag * 2} ${x + w} ${y}`} fill="none" stroke="#2a2420" strokeWidth="1" />
      {colors.map((c, i) => {
        const t = (i + 1) / (colors.length + 1);
        const px = x + t * w;
        const py = y + sag * 2 * 2 * t * (1 - t);
        const cw = 18 + (i % 2) * 8;
        return <path key={i} d={`M${px - cw / 2} ${py} h${cw} l-2 ${22 + (i % 3) * 6} h-${cw - 4}z`} style={{ fill: V(c) }} stroke="#1e1b18" strokeWidth="0.7" />;
      })}
    </g>
  );
}

export function PillarBox({ x, y, s = 1, color = "sindoor", title }: { x: number; y: number; s?: number; color?: string; title?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {title && <title>{title}</title>}
      <rect x="3" y="6" width="54" height="120" rx="6" fill="#000" opacity="0.18" />
      <path d="M0 30 a27 27 0 0 1 54 0 v92 h-54z" style={{ fill: V(color) }} stroke="#1e1b18" strokeWidth="1.4" />
      <rect x="-3" y="26" width="60" height="7" rx="2" fill="#1e1b18" opacity="0.8" />
      <rect x="10" y="44" width="34" height="6" rx="3" fill="#1e1b18" />
      <rect x="14" y="62" width="26" height="22" rx="2" fill="#fff4e0" opacity="0.9" />
      <text x="27" y="77" textAnchor="middle" style={{ fontFamily: "var(--f-mono)", fontSize: 7 }} fill="#1e1b18">
        DAAK
      </text>
      <rect x="-4" y="118" width="62" height="10" rx="2" fill="#2a2420" />
    </g>
  );
}

export function Charpai({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} aria-hidden="true">
      <path d="M0 8 h120 l-6 10 h-108z" fill="#d9b77a" stroke="#6b4a1c" />
      {Array.from({ length: 12 }, (_, i) => (
        <path key={i} d={`M${10 + i * 9} 8 l4 10`} stroke="#a0773a" strokeWidth="1" />
      ))}
      <path d="M4 8 v26 M116 8 v26 M10 18 v16 M110 18 v16" stroke="#6b4a1c" strokeWidth="4" />
    </g>
  );
}

export function Matka({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} aria-hidden="true">
      <path d="M8 0 h16 v4 q14 6 12 22 q-2 14 -20 14 q-18 0 -20 -14 q-2 -16 12 -22z" style={{ fill: mix(V("brick"), 85, V("sindoor")) }} stroke="#3b1d0e" />
      <path d="M2 20 q14 6 28 0" stroke="#fff4e0" strokeWidth="1.2" fill="none" opacity="0.6" />
      <path d="M2 40 l-4 14 h40 l-4 -14" fill="none" stroke="#3b2a12" strokeWidth="2.5" />
    </g>
  );
}

export function Rangoli({ cx, cy, r = 30, seed = 3 }: { cx: number; cy: number; r?: number; seed?: number }) {
  const rr = mulberry32(seed);
  const petals = 8 + Math.floor(rr() * 3) * 2;
  return (
    <g aria-hidden="true" transform={`translate(${cx} ${cy}) scale(1 0.42)`}>
      <circle r={r} style={{ fill: V("lane-c") }} />
      {Array.from({ length: petals }, (_, i) => (
        <ellipse key={i} rx={r * 0.18} ry={r * 0.42} cy={-r * 0.52} transform={`rotate(${(i * 360) / petals})`} style={{ fill: V("lane-a") }} />
      ))}
      <circle r={r * 0.36} style={{ fill: V("haldi") }} />
      <circle r={r * 0.16} style={{ fill: V("lane-b") }} />
      <circle r={r} fill="none" stroke="#fff4e0" strokeWidth="2" strokeDasharray="2 4" />
    </g>
  );
}

/** Seeded terrazzo floor, generated on the server so the client does no work. */
export function Terrazzo({ x, y, w, h, seed = 9 }: { x: number; y: number; w: number; h: number; seed?: number }) {
  const r = mulberry32(seed);
  const n = 40 + Math.floor(r() * 20);
  const cols = ["lane-a", "lane-b", "lane-c", "tin"];
  return (
    <g aria-hidden="true">
      <rect x={x} y={y} width={w} height={h} fill="#e8dcc6" />
      {Array.from({ length: n }, (_, i) => {
        const cx = x + r() * w;
        const cy = y + r() * h;
        const s = 1.5 + r() * 3.5;
        const pts = Array.from({ length: 4 }, (_, k) => {
          const a = (k / 4) * Math.PI * 2 + r();
          return `${(cx + Math.cos(a) * s).toFixed(1)},${(cy + Math.sin(a) * s * 0.6).toFixed(1)}`;
        });
        return <polygon key={i} points={pts.join(" ")} style={{ fill: V(cols[i % 4]) }} opacity="0.8" />;
      })}
    </g>
  );
}

/** Code-drawn cover plates for Window items (mehendi patterns, sweets, prints). */
export function CoverMotif({ motif, w = 200, h = 260, seed = 1 }: { motif: number; w?: number; h?: number; seed?: number }) {
  const r = mulberry32(seed + motif * 97);
  const cx = w / 2;
  const cy = h / 2;
  const ink = mix(V("brick"), 80, "#3b1d0e");
  switch (motif % 8) {
    case 0: // mandala of petals
      return (
        <g>
          {[0.42, 0.32, 0.22].map((k, j) => (
            <g key={j}>
              {Array.from({ length: 12 + j * 4 }, (_, i) => (
                <ellipse key={i} cx={cx} cy={cy - w * k * 0.75} rx={w * 0.035} ry={w * 0.09} transform={`rotate(${(i * 360) / (12 + j * 4)} ${cx} ${cy})`} fill="none" stroke={ink} strokeWidth="1.6" />
              ))}
            </g>
          ))}
          <circle cx={cx} cy={cy} r={w * 0.08} fill={ink} />
        </g>
      );
    case 1: // jharokha arches
      return (
        <g fill="none" stroke={ink} strokeWidth="1.8">
          {[0, 1, 2].map((i) => (
            <path key={i} d={`M${w * 0.2 + i * w * 0.2} ${h * 0.8} V${h * 0.45} q${w * 0.1} -${h * 0.18} ${w * 0.2} 0 V${h * 0.8}`} />
          ))}
          <path d={`M${w * 0.12} ${h * 0.82} H${w * 0.88} M${w * 0.15} ${h * 0.3} H${w * 0.85}`} />
          {Array.from({ length: 9 }, (_, i) => (
            <circle key={i} cx={w * 0.15 + i * w * 0.0875} cy={h * 0.26} r="2.5" fill={ink} />
          ))}
        </g>
      );
    case 2: // vine
      return (
        <g fill="none" stroke={ink} strokeWidth="2">
          <path d={`M${w * 0.15} ${h * 0.9} C${w * 0.6} ${h * 0.7} ${w * 0.2} ${h * 0.4} ${w * 0.8} ${h * 0.1}`} />
          {Array.from({ length: 7 }, (_, i) => {
            const t = (i + 1) / 8;
            const px = w * (0.15 + 0.65 * t) + (r() - 0.5) * 20;
            const py = h * (0.9 - 0.8 * t);
            return <path key={i} d={`M${px} ${py} q${i % 2 ? 18 : -18} -6 ${i % 2 ? 22 : -22} -20 q${i % 2 ? -14 : 14} 2 ${i % 2 ? -22 : 22} 20z`} fill={ink} opacity="0.85" />;
          })}
        </g>
      );
    case 3: // concentric rings
      return (
        <g fill="none" stroke={ink}>
          {Array.from({ length: 8 }, (_, i) => (
            <circle key={i} cx={cx} cy={cy} r={w * (0.06 + i * 0.05)} strokeWidth={i % 2 ? 1 : 2.4} strokeDasharray={i % 3 === 0 ? "3 3" : undefined} />
          ))}
        </g>
      );
    case 4: // two peacocks
      return (
        <g fill={ink}>
          {[-1, 1].map((d) => (
            <g key={d} transform={`translate(${cx + d * w * 0.18} ${cy}) scale(${d} 1)`}>
              <path d={`M0 30 C-10 0 0 -30 10 -40 C14 -46 20 -44 18 -38 C10 -30 8 -10 12 30Z`} />
              {Array.from({ length: 5 }, (_, i) => (
                <circle key={i} cx={-18 - i * 6} cy={30 - i * 14} r="5" fill="none" stroke={ink} strokeWidth="1.6" />
              ))}
            </g>
          ))}
        </g>
      );
    case 5: // minimal caps
      return (
        <g fill="none" stroke={ink} strokeWidth="2">
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <path d={`M${w * 0.22 + i * w * 0.18} ${h * 0.3} v${h * 0.3} a${w * 0.06} ${w * 0.06} 0 0 0 ${w * 0.12} 0 v-${h * 0.3}`} />
              <path d={`M${w * 0.22 + i * w * 0.18} ${h * 0.36} h${w * 0.12}`} strokeDasharray="2 3" />
            </g>
          ))}
        </g>
      );
    case 6: // sun
      return (
        <g fill={ink}>
          <circle cx={cx} cy={cy} r={w * 0.12} />
          {Array.from({ length: 14 }, (_, i) => (
            <path key={i} d={`M${cx - 4} ${cy - w * 0.17} L${cx} ${cy - w * 0.3} L${cx + 4} ${cy - w * 0.17}Z`} transform={`rotate(${(i * 360) / 14} ${cx} ${cy})`} />
          ))}
        </g>
      );
    default: // initials in a hidden circle
      return (
        <g>
          <circle cx={cx} cy={cy} r={w * 0.28} fill="none" stroke={ink} strokeWidth="1.5" strokeDasharray="1 4" />
          <text x={cx} y={cy + w * 0.1} textAnchor="middle" style={{ fontFamily: "var(--f-mast)", fontSize: w * 0.3 }} fill={ink}>
            अ+र
          </text>
        </g>
      );
  }
}
