import type { Metadata } from "next";
import { withSystem } from "@/lib/db";
import type { LaneDoc } from "@/lib/doc";
import { SCENE_META } from "@/lib/doc";
import { dna, SCENES } from "@/lib/dna";
import { triadVars } from "@/lib/palette";
import { Facade } from "@/components/art/facades";
import { KitDefs, ShutterBody, Signboard, Toran } from "@/components/art/kit";
import { SCENE_ICON } from "@/components/lane/server";
import { TRADES } from "@/lib/trades";

export const revalidate = 600;
export const metadata: Metadata = {
  title: { absolute: "Apni Galli: your own little street" },
  description: "Pick what you do, name your lane, set your hours. In three minutes you have a small illustrated street that takes bookings, orders, enquiries and newsletter sign-ups.",
};

const DEMOS = [
  { handle: "meethi-rasoi", line: "Order 2 kaju katli boxes for Saturday, watch the stock drop, see the UPI QR." },
  { handle: "taal-studio", line: "Drop a brass token on a Kathak trial class. Try the same hook in a second tab." },
  { handle: "rangrez-mehendi", line: "Send a bridal chit with date, venue and hands. Watch it fold into a boat." },
];

const JOBS: Record<string, string> = {
  window: "Your work as a rack of magazine covers. Each one has its own page.",
  counter: "Bookings that cannot clash: buffers, seats, a 10-minute hold, reminders.",
  menu: "Orders with a daily stock limit per item, a pickup day and a UPI link.",
  postbox: "A newsletter with real double opt-in and one-click unsubscribe.",
  notice: "Your links, pinned on cork, with click counts. Paste a Linktree to start.",
  loft: "The story, the process, the tools. The page search engines read best.",
  rooftop: "WhatsApp, call, address, and a map that loads only when tapped.",
};

export default async function Home() {
  const lanes = await withSystem((q) =>
    q.query<{ handle: string; doc: LaneDoc; trade: string }>("select l.handle, v.doc, l.trade from lanes l join lane_versions v on v.id = l.published_version_id where l.is_demo and l.handle = any($1)", [DEMOS.map((d) => d.handle)]),
  ).catch(() => []);
  const me = dna(20261114, { palette: 0, signBorder: 1, signMotif: 3, signLettering: 0, garland: 2 });
  return (
    <main style={triadVars(me.palette) as React.CSSProperties} className="overflow-x-clip">
      <KitDefs awning={18} />
      <header className="relative" style={{ background: "linear-gradient(var(--sky-1), var(--sky-2))" }}>
        <svg viewBox="0 0 1200 80" preserveAspectRatio="none" className="absolute inset-x-0 top-0 h-16 w-full" aria-hidden="true">
          <Toran x={-10} y={-4} w={1220} sag={40} count={44} seed={11} />
        </svg>
        <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-end gap-2 px-4 pt-16">
          <a className="btn" href="/galli">
            Galli wall
          </a>
          <a className="btn" href="/login">
            Login
          </a>
        </nav>
        <div className="mx-auto grid max-w-6xl gap-8 px-4 pb-12 pt-6 lg:grid-cols-[1.1fr_1fr] lg:items-end">
          <div>
            <svg viewBox="0 0 520 126" className="w-full max-w-[520px]" role="img" aria-label="Apni Galli, अपनी गली">
              <Signboard x={0} y={0} w={514} h={120} name="Apni Galli" hi="अपनी गली" kit={me.sign} seed={4} />
            </svg>
            <h1 className="mast mt-6 text-[clamp(2.2rem,6vw,3.6rem)]">Your own little street, where every building does a real job.</h1>
            <p className="mt-4 max-w-prose text-lg">
              For home bakers, tutors, mehendi artists, designers, boutiques and writers. Tell us what you do, name your lane, set your hours. The shutter on the gate tells visitors the truth about whether you are open. Everything they send lands at your front desk, the Galla.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a className="cta" href="/try">
                Banao: apni galli →
              </a>
              <a className="cta cta-ghost" href="/w/meethi-rasoi">
                Ek demo galli mein jao
              </a>
            </div>
            <p className="mono mt-3 text-xs text-[var(--muted)]">Free. UPI goes straight to you; Apni Galli never touches money.</p>
          </div>
          {/* the "Banao" shutter: a shop that is waiting for you */}
          <a href="/try" className="group relative mx-auto block w-full max-w-sm" aria-label="Banao: start your own lane">
            <svg viewBox="0 0 360 300" className="w-full" aria-hidden="true">
              <rect x="20" y="40" width="320" height="260" fill="url(#k-tinwall)" />
              <rect x="14" y="34" width="332" height="10" fill="#2a2420" />
              <rect x="50" y="110" width="260" height="190" fill="url(#k-glow)" />
              <g className="transition-transform duration-500 group-hover:-translate-y-16" style={{ transitionTimingFunction: "var(--ease-toran)" }}>
                <ShutterBody x={50} y={110} w={260} h={190} slot={false} />
                <text x="180" y="210" textAnchor="middle" style={{ fontFamily: "var(--f-sign)", fontSize: 40, fill: "#1e1b18" }}>
                  Banao
                </text>
                <text x="180" y="236" textAnchor="middle" style={{ fontFamily: "var(--f-mono)", fontSize: 12, fill: "#1e1b18" }}>
                  YAHAN AAPKI DUKAAN
                </text>
              </g>
              <Signboard x={40} y={56} w={280} h={46} name="Khaali dukaan" kit={{ border: 2, motif: 1, lettering: 0 }} seed={8} fill="tin" ink="soot" />
            </svg>
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-14" aria-labelledby="demos">
        <h2 id="demos" className="sign text-4xl">
          Teen demo galliyan
        </h2>
        <p className="max-w-prose text-[var(--muted)]">Made-up shops, clearly labelled. Everything works end to end, and whatever you send shows up in your own demo Galla, where you can answer it as the owner.</p>
        <ul className="mt-8 grid gap-10 md:grid-cols-3">
          {DEMOS.map((dm, i) => {
            const l = lanes.find((x) => x.handle === dm.handle);
            if (!l) return null;
            const d = dna(l.doc.seed, l.doc.pins);
            return (
              <li key={dm.handle} style={{ ...(triadVars(d.palette) as React.CSSProperties), marginTop: i === 1 ? 40 : 0 }}>
                <a href={`/w/${dm.handle}`} className="group block">
                  <div className="transition-transform duration-300 group-hover:-translate-y-1">
                    <Facade scene="gate" ctx={{ dna: d, name: l.doc.name, hi: l.doc.nameHi, seed: l.doc.seed }} />
                  </div>
                  <p className="mono mt-3 text-xs uppercase text-[var(--muted)]">
                    {l.doc.city} · {TRADES[l.trade as keyof typeof TRADES]?.label}
                  </p>
                  <p className="sign text-2xl">{l.doc.name}</p>
                  <p className="text-sm">{dm.line}</p>
                </a>
              </li>
            );
          })}
        </ul>
        <a className="cta mt-8" href="/demo/galla">
          Demo Galla kholo
        </a>
      </section>

      <section className="border-y-4 border-double border-[var(--soot)] bg-[var(--paper)] py-12 text-[#1e1b18]" aria-labelledby="street">
        <div className="mx-auto max-w-6xl px-4">
          <h2 id="street" className="mast text-4xl">
            Seven buildings, pick four or more
          </h2>
          <ol className="no-scrollbar mt-6 flex snap-x gap-0 overflow-x-auto pb-2" data-noswipe>
            {SCENES.map((s, i) => (
              <li key={s} className="w-64 shrink-0 snap-start border-l-2 border-dashed border-[#1e1b18]/40 px-4 first:border-l-0">
                <span className="mono text-xs">{String(i + 1).padStart(2, "0")}</span>
                <div className="my-2 h-8 w-10">{SCENE_ICON[s]}</div>
                <p className="sign text-xl">
                  {SCENE_META[s].name} <span className="font-deva text-base">{SCENE_META[s].hi}</span>
                </p>
                <p className="mt-1 text-sm">{JOBS[s]}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:grid-cols-[1fr_1.4fr]">
        <div>
          <h2 className="sign text-3xl">The Galla</h2>
          <p className="mt-2">One front desk for every chit, booking, order and subscriber. J and K to move, R to reply, B to confirm, P for &quot;Paisa mila&quot;, U to undo. On a phone, swipe a chit right to confirm or left to archive.</p>
          <p className="mt-3 text-sm text-[var(--muted)]">A payment is marked paid only when you say the money arrived. The visitor&apos;s chit then gets its चुकता stamp.</p>
        </div>
        <div className="chit px-5 pb-5 pt-6">
          <p className="mono text-xs text-[#4a4038]">ORDER AG-7F3K · PICKUP SAT</p>
          <p className="sign text-2xl text-[#1e1b18]">2 × Kaju katli box</p>
          <p className="mono text-[#1e1b18]">₹960 · Payment ki pushti baaki</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {["J / K", "R reply", "B pakka", "P paisa mila", "U undo"].map((k) => (
              <span key={k} className="mono rounded border border-[#1e1b18] px-2 py-1 text-xs text-[#1e1b18]">
                {k}
              </span>
            ))}
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-4 pb-12">
        <div className="tin flex flex-wrap items-center justify-between gap-3 rounded-md p-4">
          <p className="sign text-xl">Apni Galli banao</p>
          <p className="text-sm">
            <a className="underline" href="/how-fast">
              How fast
            </a>{" "}
            · <a className="underline" href="/privacy">Privacy</a> · <a className="underline" href="/galli">Galli wall</a>
          </p>
        </div>
      </footer>
    </main>
  );
}
