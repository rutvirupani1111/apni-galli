// Server pieces shared by every building of a lane.
import type { ReactNode } from "react";
import { dna, type AnyScene, type Dna } from "@/lib/dna";
import { SCENE_META } from "@/lib/doc";
import type { PublicLane } from "@/lib/lane";
import { Facade } from "@/components/art/facades";
import { BrassToken, Clothesline, CoverMotif, Kite, PillarBox, Signboard, Toran, WaterTank } from "@/components/art/kit";
import { computeStatus, hoursSummary } from "@/lib/status";
import { rupees } from "@/lib/money";

export function laneDna(lane: PublicLane): Dna {
  return dna(lane.doc.seed, lane.doc.pins, {}, ["gate", ...lane.doc.scenes]);
}

export function sceneOrder(lane: PublicLane): AnyScene[] {
  return ["gate", ...lane.doc.scenes];
}

export function FacadeFor({ lane, scene, className, label }: { lane: PublicLane; scene: AnyScene; className?: string; label?: string }) {
  const d = laneDna(lane);
  const st = computeStatus({ tz: lane.tz, hours: lane.hours, closures: lane.closures }, new Date());
  return <Facade scene={scene} className={className} label={label} ctx={{ dna: d, name: lane.doc.name, hi: lane.doc.nameHi, seed: lane.doc.seed, open: st.open }} />;
}

export function SignSvg({ lane, w = 520, h = 120 }: { lane: PublicLane; w?: number; h?: number }) {
  const d = laneDna(lane);
  return (
    <svg viewBox={`0 0 ${w + 6} ${h + 6}`} className="h-auto w-full" aria-hidden="true">
      <Signboard x={0} y={0} w={w} h={h} name={lane.doc.name} hi={lane.doc.nameHi} kit={d.sign} seed={lane.doc.seed} />
    </svg>
  );
}

export function ToranSvg({ lane }: { lane: PublicLane }) {
  const d = laneDna(lane);
  return (
    <svg viewBox="0 0 360 60" preserveAspectRatio="none" className="h-full w-full" aria-hidden="true">
      <Toran x={-4} y={-2} w={368} sag={30} count={d.garland + 6} seed={lane.doc.seed} />
    </svg>
  );
}

export const SCENE_ICON: Record<AnyScene, ReactNode> = {
  gate: (
    <svg viewBox="0 0 24 20" className="h-full w-full">
      <path d="M4 20V9q8-9 16 0v11" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M9 20v-7h6v7" fill="currentColor" opacity=".35" />
    </svg>
  ),
  window: (
    <svg viewBox="0 0 24 20" className="h-full w-full">
      <rect x="2" y="3" width="20" height="15" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M6 15V8h4v7M13 15V6h5v9" fill="currentColor" opacity=".45" />
    </svg>
  ),
  counter: (
    <svg viewBox="0 0 24 20" className="h-full w-full">
      <path d="M2 6h20" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="8" cy="12" r="3.5" fill="#c9962e" stroke="currentColor" />
      <path d="M16 6v4q0 2 2 2" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  menu: (
    <svg viewBox="0 0 24 20" className="h-full w-full">
      <rect x="4" y="1" width="16" height="18" rx="1" fill="#24302b" stroke="currentColor" />
      <path d="M7 6h10M7 10h7M7 14h9" stroke="#fff4e0" strokeWidth="1.4" />
    </svg>
  ),
  postbox: (
    <svg viewBox="0 0 24 20" className="h-full w-full">
      <path d="M6 20V7a6 6 0 0 1 12 0v13z" fill="var(--sindoor)" stroke="currentColor" />
      <rect x="9" y="8" width="6" height="1.6" fill="currentColor" />
    </svg>
  ),
  notice: (
    <svg viewBox="0 0 24 20" className="h-full w-full">
      <rect x="2" y="2" width="20" height="16" fill="#c79a5b" stroke="currentColor" />
      <rect x="5" y="5" width="6" height="5" fill="#fff4e0" transform="rotate(-6 8 7)" />
      <rect x="13" y="8" width="6" height="6" fill="var(--haldi)" transform="rotate(5 16 11)" />
    </svg>
  ),
  loft: (
    <svg viewBox="0 0 24 20" className="h-full w-full">
      <path d="M2 8 12 1l10 7v12H2z" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M2 13h20" stroke="currentColor" />
    </svg>
  ),
  rooftop: (
    <svg viewBox="0 0 24 20" className="h-full w-full">
      <path d="M12 2 17 7 12 12 7 7z" fill="var(--lane-a)" stroke="currentColor" />
      <path d="M2 18h20M4 18v-4h6v4" stroke="currentColor" strokeWidth="1.6" fill="none" />
    </svg>
  ),
};

export function plateItems(lane: PublicLane) {
  return sceneOrder(lane).map((s) => ({ scene: s, label: SCENE_META[s].name.split(" ").slice(-1)[0], icon: SCENE_ICON[s] }));
}

/** Cover-line text for a building, as of render; the island replaces it with live numbers. */
export function coverLine(lane: PublicLane, s: AnyScene): string {
  const st = computeStatus({ tz: lane.tz, hours: lane.hours, closures: lane.closures }, new Date());
  switch (s) {
    case "gate":
      return st.short;
    case "counter":
      return lane.services.length ? `${lane.services.length} service${lane.services.length > 1 ? "s" : ""}` : "Chit bhejo";
    case "menu":
      return lane.menu[0] ? `${lane.menu[0].name.en}: ${rupees(lane.menu[0].price_paise)}` : "Menu";
    case "window":
      return `${lane.doc.window.items.length} cover${lane.doc.window.items.length === 1 ? "" : "s"}`;
    case "postbox":
      return "Postcard mangao";
    case "notice":
      return `${lane.notes.length} note${lane.notes.length === 1 ? "" : "s"}`;
    case "loft":
      return "Kahani";
    case "rooftop":
      return lane.doc.city || "Pata";
  }
}

export function HoursLine({ lane }: { lane: PublicLane }) {
  return <span>{hoursSummary(lane.hours)}</span>;
}

/** Small door art for the street: each building's door is drawn from what it does. */
export function Door({ scene, label }: { scene: AnyScene; label: string }) {
  const ink = "#1e1b18";
  const covers: [number, number, number, number, string][] = [
    [20, 72, 16, 38, "var(--lane-a)"],
    [40, 62, 18, 48, "var(--lane-c)"],
    [62, 78, 16, 32, "var(--lane-b)"],
    [82, 68, 18, 42, "var(--sindoor)"],
  ];
  const notes: [number, number, number, number, string, number][] = [
    [20, 52, 34, 28, "#fff4e0", -6],
    [62, 50, 36, 24, "var(--haldi)", 5],
    [24, 92, 30, 36, "var(--mint-enamel)", 4],
    [62, 84, 38, 30, "#fff4e0", -3],
  ];
  const body: Record<AnyScene, ReactNode> = {
    gate: (
      <g>
        <path d="M18 150V66q42-56 84 0v84z" fill="#3a2a17" />
        <path d="M24 150V68q36-46 72 0v82z" style={{ fill: "var(--lane-b)" }} stroke={ink} strokeWidth="1.2" />
        <path d="M60 36v114" stroke={ink} strokeWidth="1.6" />
        {[38, 46, 74, 82].map((x) => (
          <path key={x} d={`M${x} 64v84`} stroke={ink} strokeWidth=".6" opacity=".35" />
        ))}
        <circle cx="54" cy="104" r="2.6" fill="#c9962e" stroke={ink} strokeWidth=".6" />
        <circle cx="66" cy="104" r="2.6" fill="#c9962e" stroke={ink} strokeWidth=".6" />
        <path d="M24 52q36 16 72 0" fill="none" stroke="#2a2420" strokeWidth=".7" />
        {Array.from({ length: 7 }, (_, i) => {
          const t = (i + 0.5) / 7;
          return <circle key={i} cx={24 + t * 72} cy={52 + 16 * 2 * t * (1 - t)} r="3.8" style={{ fill: i % 2 ? "#1f7a4c" : "var(--marigold)" }} stroke={ink} strokeWidth=".5" />;
        })}
      </g>
    ),
    window: (
      <g>
        <rect x="10" y="50" width="100" height="100" fill="#2a2420" />
        <rect x="14" y="54" width="92" height="92" style={{ fill: "color-mix(in srgb, var(--mint-enamel) 55%, var(--chalk))" }} />
        <path d="M14 110h92" stroke="#6b4a1c" strokeWidth="3" />
        {covers.map(([x, y, w, h, c], i) => (
          <g key={i} transform={`rotate(${i % 2 ? 3 : -2} ${x + w / 2} 110)`}>
            <rect x={x} y={y} width={w} height={h} style={{ fill: c }} stroke={ink} strokeWidth=".8" />
            <path d={`M${x + 3} ${y + 6}h${w - 6}`} stroke="#fff4e0" strokeWidth="2" />
          </g>
        ))}
        <path d="M20 128h30M62 124h36M24 136h22" stroke={ink} strokeWidth="1.2" opacity=".5" />
        <rect x="10" y="38" width="100" height="14" fill="url(#k-awn)" stroke={ink} strokeWidth="1" />
        <path d="M10 52q5 6 10 0q5 6 10 0q5 6 10 0q5 6 10 0q5 6 10 0q5 6 10 0q5 6 10 0q5 6 10 0q5 6 10 0q5 6 10 0z" style={{ fill: "var(--lane-b)" }} stroke={ink} strokeWidth=".8" />
      </g>
    ),
    counter: (
      <g>
        <rect x="8" y="104" width="104" height="46" style={{ fill: "color-mix(in srgb, var(--brick) 85%, #3b2a12)" }} />
        <path d="M8 104h104" stroke={ink} strokeWidth="2" />
        {[116, 128, 140].map((y) => (
          <path key={y} d={`M8 ${y}h104`} stroke="#000" strokeWidth=".6" opacity=".25" />
        ))}
        <rect x="12" y="58" width="96" height="6" rx="2" fill="#6b4a1c" stroke={ink} strokeWidth=".8" />
        {[20, 38, 56, 74].map((x, i) => (
          <g key={x}>
            <path d={`M${x} 64v8q0 5 5 5`} fill="none" stroke={ink} strokeWidth="1.4" />
            <BrassToken x={x + 4} y={84} r={6} filled={i % 2 === 0} />
          </g>
        ))}
        <path d="M86 104l3-14h10l3 14z" fill="#e8f4f0" opacity=".85" stroke={ink} strokeWidth=".8" />
        <path d="M88 97h12" stroke="#b8701f" strokeWidth="5" opacity=".75" />
      </g>
    ),
    menu: (
      <g>
        <path d="M30 150l8-26M90 150l-8-26" stroke="#6b4a1c" strokeWidth="4" />
        <rect x="18" y="38" width="84" height="92" rx="2" fill="#6b4a1c" />
        <rect x="23" y="43" width="74" height="82" fill="#24302b" />
        <text x="60" y="58" textAnchor="middle" style={{ fontFamily: "var(--f-mono)", fontSize: 8 }} fill="#fff4e0">
          AAJ KA MENU
        </text>
        {[72, 86, 100, 114].map((y, i) => (
          <g key={y}>
            <path d={`M30 ${y}h${28 - (i % 2) * 8}`} stroke="#fff4e0" strokeWidth="1.6" strokeLinecap="round" opacity=".85" />
            <path d={`M62 ${y}h10`} stroke="#fff4e0" strokeWidth=".8" strokeDasharray="1 2" opacity=".6" />
            <circle cx="84" cy={y} r="2.4" style={{ fill: "var(--haldi)" }} />
          </g>
        ))}
      </g>
    ),
    postbox: (
      <g>
        {[60, 78, 96, 114, 132].map((y, i) => (
          <path key={y} d={`M0 ${y}h120`} stroke="#000" strokeWidth=".5" opacity=".14" strokeDasharray={i % 2 ? "28 2" : "16 2"} />
        ))}
        <PillarBox x={40} y={50} s={0.78} />
        <g transform="rotate(-8 24 67)">
          <path d="M12 60h24v15H12z" fill="#fff4e0" stroke={ink} strokeWidth=".7" />
          <path d="M12 60l12 8 12-8" fill="none" stroke={ink} strokeWidth=".6" />
        </g>
      </g>
    ),
    notice: (
      <g>
        <rect x="10" y="40" width="100" height="104" fill="#6b4a1c" />
        <rect x="14" y="44" width="92" height="96" fill="#c79a5b" />
        {Array.from({ length: 30 }, (_, i) => (
          <circle key={i} cx={18 + ((i * 37) % 86)} cy={48 + ((i * 53) % 88)} r=".9" fill="#7a5a2c" />
        ))}
        {notes.map(([x, y, w, h, c, r], i) => (
          <g key={i} transform={`rotate(${r} ${x + w / 2} ${y + h / 2})`}>
            <rect x={x} y={y} width={w} height={h} style={{ fill: c }} stroke={ink} strokeWidth=".6" />
            <path d={`M${x + 4} ${y + 9}h${w - 10}M${x + 4} ${y + 15}h${w - 14}`} stroke={ink} strokeWidth=".8" opacity=".55" />
            <circle cx={x + w / 2} cy={y + 2} r="2.2" style={{ fill: "var(--sindoor)" }} stroke={ink} strokeWidth=".5" />
          </g>
        ))}
      </g>
    ),
    loft: (
      <g>
        <path d="M8 74L60 34l52 40v76H8z" style={{ fill: "color-mix(in srgb, var(--lane-c) 35%, var(--chalk))" }} stroke={ink} strokeWidth="1.4" />
        <path d="M2 78L60 30l58 48" fill="none" stroke="#6b4a1c" strokeWidth="5" strokeLinecap="round" />
        <path d="M8 100h104M8 126h104" stroke={ink} strokeWidth="1.4" />
        <circle cx="60" cy="62" r="7" fill="#2a2420" />
        <path d="M53 62h14M60 55v14" style={{ stroke: "var(--haldi)" }} strokeWidth="1" />
        <path d="M20 112h18M20 118h12M70 108l8 12 8-12" stroke={ink} strokeWidth="1.2" fill="none" />
        <rect x="76" y="132" width="20" height="18" fill="#6b4a1c" />
        <path d="M18 138h40M18 144h30" stroke={ink} strokeWidth="1.2" opacity=".6" />
      </g>
    ),
    rooftop: (
      <g>
        <rect x="0" y="30" width="120" height="120" fill="#ffb27d" />
        <circle cx="28" cy="72" r="13" style={{ fill: "var(--haldi)" }} opacity=".9" />
        <rect x="0" y="122" width="120" height="28" fill="#b8a98f" />
        <path d="M0 122h120" stroke={ink} strokeWidth="1.4" />
        <WaterTank x={74} y={80} s={0.6} />
        <path d="M44 62q8 34 38 60" fill="none" stroke={ink} strokeWidth=".5" />
        <Kite x={44} y={52} s={0.6} rot={14} />
        <Clothesline x={4} y={98} w={62} colors={["lane-a", "haldi", "lane-b"]} />
      </g>
    ),
  };
  return (
    <svg viewBox="0 0 120 160" className="h-full w-full" aria-hidden="true">
      <rect width="120" height="160" style={{ fill: "var(--plaster)" }} />
      {body[scene]}
      <rect y="150" width="120" height="10" fill="#8d877b" />
      <path d="M0 150h120" stroke={ink} strokeWidth="1" />
      <rect x="18" y="8" width="84" height="22" rx="3" style={{ fill: "var(--lane-a)" }} stroke={ink} />
      <rect x="21" y="11" width="78" height="16" rx="2" fill="none" style={{ stroke: "var(--on-lane-a)" }} strokeWidth=".8" opacity=".7" />
      <text x="60" y="24" textAnchor="middle" style={{ fill: "var(--on-lane-a)", fontFamily: "var(--f-sign)", fontSize: 12 }}>
        {label}
      </text>
    </svg>
  );
}

export { CoverMotif };
