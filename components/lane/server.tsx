// Server pieces shared by every building of a lane.
import type { ReactNode } from "react";
import { dna, type AnyScene, type Dna } from "@/lib/dna";
import { SCENE_META } from "@/lib/doc";
import type { PublicLane } from "@/lib/lane";
import { Facade } from "@/components/art/facades";
import { CoverMotif, Signboard, Toran } from "@/components/art/kit";
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

/** Small door art for the street: each building's door is shaped by what it does. */
export function Door({ scene, label }: { scene: AnyScene; label: string }) {
  const body = {
    gate: <path d="M14 150V60q46-62 92 0v90z" style={{ fill: "var(--lane-b)" }} />,
    window: <rect x="12" y="40" width="96" height="110" style={{ fill: "color-mix(in srgb, var(--mint-enamel) 60%, var(--chalk))" }} />,
    counter: <rect x="10" y="60" width="100" height="90" style={{ fill: "color-mix(in srgb, var(--brick) 80%, #3b2a12)" }} />,
    menu: <rect x="20" y="30" width="80" height="120" fill="#24302b" />,
    postbox: <path d="M34 150V70a26 26 0 0 1 52 0v80z" style={{ fill: "var(--sindoor)" }} />,
    notice: <rect x="12" y="40" width="96" height="110" fill="#c79a5b" />,
    loft: <path d="M10 70 60 30l50 40v80H10z" style={{ fill: "var(--plaster)" }} />,
    rooftop: <rect x="0" y="40" width="120" height="110" fill="#ff9e6d" />,
  }[scene];
  return (
    <svg viewBox="0 0 120 160" className="h-full w-full" aria-hidden="true">
      <rect width="120" height="160" style={{ fill: "var(--plaster)" }} />
      <rect y="150" width="120" height="10" fill="#8d877b" />
      {body}
      <rect x="18" y="8" width="84" height="22" rx="3" style={{ fill: "var(--lane-a)" }} stroke="#1e1b18" />
      <text x="60" y="24" textAnchor="middle" style={{ fill: "var(--on-lane-a)", fontFamily: "var(--f-sign)", fontSize: 12 }}>
        {label}
      </text>
    </svg>
  );
}

export { CoverMotif };
