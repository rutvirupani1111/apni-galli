import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadPublicLane, type PublicLane } from "@/lib/lane";
import type { AnyScene } from "@/lib/dna";
import { SCENE_META } from "@/lib/doc";
import { LiveText, SceneRoot, WalkLink } from "@/components/lane/client";
import { Door, SCENE_ICON, coverLine, laneDna, sceneOrder } from "@/components/lane/server";

export const revalidate = 300;
export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const lane = await loadPublicLane(handle);
  return lane ? { title: `Cover wall: ${lane.doc.name}`, description: `Every building of ${lane.doc.name} on one wall.` } : {};
}

function bigNumber(lane: PublicLane, s: AnyScene): { n: string; label: string } {
  switch (s) {
    case "menu":
      return { n: String(lane.menu.length), label: "cheezein board pe" };
    case "window":
      return { n: String(lane.doc.window.items.length), label: "covers khidki mein" };
    case "notice":
      return { n: String(lane.notes.length), label: "notes deewar pe" };
    case "counter":
      return { n: String(lane.services.length), label: "services" };
    default:
      return { n: String(sceneOrder(lane).indexOf(s) + 1).padStart(2, "0"), label: "makaan number" };
  }
}

function Cover({ lane, s, t, live }: { lane: PublicLane; s: AnyScene; t: number; live: React.ReactNode }) {
  const m = SCENE_META[s];
  const base = "relative flex aspect-[3/4] flex-col overflow-hidden border-2 border-[#1e1b18] text-[#1e1b18]";
  const shadow = { boxShadow: "var(--shadow-paper)" };
  switch (t) {
    case 0: // split masthead
      return (
        <div className={base} style={shadow}>
          <div className="flex-1 p-3" style={{ background: "var(--lane-a)", color: "var(--on-lane-a)" }}>
            <p className="mast text-[2.1rem] leading-[0.9]">{m.name.split(" ")[0]}</p>
            <p className="mast text-[2.1rem] leading-[0.9] opacity-80">{m.name.split(" ").slice(1).join(" ")}</p>
            <div className="ml-auto mt-2 h-[52%] w-[58%] rotate-2 border-2 border-[#1e1b18]" style={{ boxShadow: "3px 4px 0 rgba(0,0,0,.25)" }}>
              <Door scene={s} label={m.hi} />
            </div>
          </div>
          <div className="bg-[var(--paper)] p-3">
            <p className="mono text-xs uppercase">{lane.doc.name}</p>
            <p className="sign text-lg">{live}</p>
          </div>
        </div>
      );
    case 1: // vertical Devanagari spine
      return (
        <div className={`${base} flex-row`} style={{ ...shadow, background: "var(--paper)" }}>
          <div className="flex w-12 items-center justify-center" style={{ background: "var(--lane-b)", color: "var(--on-lane-b)" }}>
            <span className="sign text-3xl" style={{ writingMode: "vertical-rl" }}>
              {m.hi}
            </span>
          </div>
          <div className="flex flex-1 flex-col p-3">
            <div className="h-24 w-20 self-end">
              <Door scene={s} label={m.hi} />
            </div>
            <p className="mast mt-auto text-2xl leading-none">{m.name}</p>
            <p className="mono mt-1 text-xs">{live}</p>
          </div>
        </div>
      );
    case 2: // price-sticker cover
      return (
        <div className={base} style={{ ...shadow, background: "color-mix(in srgb, var(--lane-c) 35%, var(--chalk))" }}>
          <p className="mast p-3 text-3xl leading-none">{m.name}</p>
          <div className="mx-3 h-[48%] w-[62%] -rotate-2 border-2 border-[#1e1b18]">
            <Door scene={s} label={m.hi} />
          </div>
          <div className="absolute bottom-4 right-3 grid size-28 rotate-[-10deg] place-items-center rounded-full border-2 border-[#1e1b18] p-2 text-center" style={{ background: "var(--haldi)" }}>
            <span className="sign text-base leading-tight">{live}</span>
          </div>
          <span className="mono mt-auto p-3 text-xs uppercase">{lane.doc.name}</span>
        </div>
      );
    case 3: // zine cut-out
      return (
        <div className={base} style={{ ...shadow, background: "#fff4e0" }}>
          <div className="flex flex-wrap gap-1 p-3">
            {[...m.name.split(" ")[0]].map((ch, i) => (
              <span key={i} className="mast grid h-8 w-6 place-items-center text-xl sm:h-10 sm:w-8 sm:text-2xl" style={{ background: ["var(--lane-a)", "var(--haldi)", "#1e1b18", "var(--lane-b)"][i % 4], color: i % 4 === 2 ? "#fff4e0" : "#1e1b18", transform: `rotate(${(i % 3) * 4 - 4}deg)` }}>
                {ch}
              </span>
            ))}
          </div>
          <p className="px-3 text-sm">{m.verb}.</p>
          <div className="mx-auto mt-1 hidden h-[38%] w-[46%] rotate-3 sm:block border-2 border-dashed border-[#1e1b18] bg-[var(--chalk)] p-1">
            <Door scene={s} label={m.hi} />
          </div>
          <p className="mono mt-auto bg-[#1e1b18] p-2 text-xs text-[var(--haldi)]">{live}</p>
        </div>
      );
    case 4: {
      // big-number issue cover
      const b = bigNumber(lane, s);
      return (
        <div className={base} style={{ ...shadow, background: "var(--chalk)" }}>
          <p className="mono flex justify-between border-b-2 border-[#1e1b18] px-3 py-1 text-xs uppercase">
            <span>{m.name}</span>
            <span>issue {b.n}</span>
          </p>
          <p className="mast px-3 text-[4rem] leading-none sm:text-[5.5rem]" style={{ color: "var(--lane-a)" }}>
            {b.n}
          </p>
          <p className="px-3 text-sm">{b.label}</p>
          <div className="absolute bottom-10 right-3 hidden h-[40%] w-[38%] border-2 sm:block border-[#1e1b18]">
            <Door scene={s} label={m.hi} />
          </div>
          <p className="sign mt-auto px-3 pb-3 text-lg">{live}</p>
        </div>
      );
    }
    default: // stamp cover
      return (
        <div className="relative aspect-[3/4] p-2" style={{ background: "radial-gradient(circle at 6px 6px, transparent 4px, var(--paper) 4.5px) -6px -6px / 14px 14px" }}>
          <div className="flex h-full flex-col border-2 border-[#1e1b18] p-2 text-[#1e1b18]" style={{ background: "color-mix(in srgb, var(--lane-b) 30%, var(--chalk))" }}>
            <div className="mx-auto h-20 w-16">{SCENE_ICON[s]}</div>
            <p className="mast text-center text-xl leading-tight">{m.name}</p>
            <p className="mono mt-auto text-center text-xs">{live}</p>
            <p className="mono text-center text-[0.6rem] uppercase opacity-70">Galli daak · ₹{sceneOrder(lane).indexOf(s) + 1}</p>
          </div>
        </div>
      );
  }
}

export default async function CoverWall({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const lane = await loadPublicLane(handle);
  if (!lane) notFound();
  const d = laneDna(lane);
  const order = sceneOrder(lane);
  return (
    <SceneRoot scene="map">
      <section className="mx-auto max-w-6xl px-4 pt-6">
        <p className="mono uppercase text-[var(--muted)]">Cover wall · {order.length} makaan</p>
        <h1 className="mast t-mast outline-none">Poori galli, ek deewar pe</h1>
        {/* the street map plate */}
        <ol className="tin mt-5 flex items-center gap-1 overflow-x-auto rounded-md p-2" aria-label="Street order">
          {order.map((s, i) => (
            <li key={s} className="flex items-center gap-1">
              <WalkLink href={s === "gate" ? `/w/${handle}` : `/w/${handle}/${s}`} className="mono flex min-h-11 items-center gap-1.5 rounded px-2 text-xs uppercase hover:bg-[#1e1b18]/10" label={SCENE_META[s].name}>
                <span className="h-5 w-6">{SCENE_ICON[s]}</span>
                <span className="hidden sm:inline">{SCENE_META[s].name}</span>
              </WalkLink>
              {i < order.length - 1 && <span aria-hidden="true">→</span>}
            </li>
          ))}
        </ol>
        <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {order.map((s, i) => {
            const fallback = coverLine(lane, s);
            const live = s === "gate" ? <LiveText kind="short" fallback={fallback} /> : s === "counter" && lane.services.length && lane.doc.counterMode === "booking" ? <LiveText kind="free" fallback={fallback} /> : s === "menu" && lane.menu[0] ? <LiveText kind="stock" item={lane.menu[0].id} fallback={fallback} /> : fallback;
            return (
              <li key={s} style={{ marginTop: i % 2 ? 18 : 0 }}>
                <WalkLink href={s === "gate" ? `/w/${handle}` : `/w/${handle}/${s}`} className="block transition-transform hover:-translate-y-1" label={`${SCENE_META[s].name}: ${fallback}`}>
                  <Cover lane={lane} s={s} t={d.masthead[s]} live={live} />
                </WalkLink>
              </li>
            );
          })}
        </ul>
      </section>
    </SceneRoot>
  );
}
