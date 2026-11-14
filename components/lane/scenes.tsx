// Seven buildings. No two share a grid: each has its own rhythm.
import type { PublicLane } from "@/lib/lane";
import type { SceneSlug } from "@/lib/dna";
import { SCENE_META } from "@/lib/doc";
import { rupees } from "@/lib/money";
import { computeStatus } from "@/lib/status";
import { pickupDays } from "@/lib/visitor";
import { ChitForm } from "./ChitForm";
import { Counter } from "./Counter";
import { MenuBoard } from "./MenuBoard";
import { MapTap, PostboxForm } from "./bits";
import { SceneRoot, WalkLink } from "./client";
import { CoverMotif, FacadeFor, laneDna } from "./server";

const H1 = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => <h1 className={`mast t-mast outline-none ${className}`}>{children}</h1>;
const Kicker = ({ s }: { s: SceneSlug }) => (
  <p className="mono uppercase text-[var(--muted)]">
    {SCENE_META[s].name} · <span className="font-deva normal-case">{SCENE_META[s].hi}</span>
  </p>
);

const HEIGHTS = ["aspect-[3/4]", "aspect-[3/5]", "aspect-[4/5]", "aspect-[2/3]"];

export function WindowScene({ lane }: { lane: PublicLane }) {
  const items = lane.doc.window.items;
  return (
    <SceneRoot scene="window">
      <section className="mx-auto max-w-6xl px-4 pt-6">
        <div className="flex items-end justify-between gap-4 border-b-4 border-double border-[var(--soot)] pb-3">
          <div>
            <Kicker s="window" />
            <H1>{lane.doc.window.title || "Shopfront"}</H1>
          </div>
          <div className="w-24 shrink-0 sm:w-36">
            <FacadeFor lane={lane} scene="window" />
          </div>
        </div>
        {items.length === 0 ? (
          <p className="mt-8 text-[var(--muted)]">Khidki abhi khaali hai.</p>
        ) : (
          <ul className="mt-6 columns-2 gap-3 sm:gap-4 lg:columns-4">
            {items.map((it, i) => (
              <li key={it.id} className="mb-3 break-inside-avoid sm:mb-4">
                <WalkLink href={`/w/${lane.handle}/window/${it.id}`} className="group block" label={`${it.title}${it.stamp ? `, ${it.stamp}` : ""}`}>
                  <div className={`relative ${HEIGHTS[i % 4]} overflow-hidden border-2 border-[#1e1b18]`} style={{ background: i % 3 === 0 ? "var(--lane-c)" : i % 3 === 1 ? "var(--paper)" : "color-mix(in srgb, var(--lane-b) 25%, var(--chalk))", boxShadow: "var(--shadow-paper)" }}>
                    <svg viewBox="0 0 200 260" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full transition-transform duration-300 group-hover:scale-[1.04]" aria-hidden="true">
                      <CoverMotif motif={it.motif} seed={lane.doc.seed} />
                    </svg>
                    <div className="absolute inset-x-0 top-0 p-2">
                      <p className="mast text-[1.35rem] leading-[0.95] text-[#1e1b18] [text-wrap:balance]">{it.title}</p>
                    </div>
                    {it.price_paise ? (
                      <span className="mono absolute bottom-2 right-2 rotate-[-4deg] rounded-sm border-2 border-[#1e1b18] bg-[var(--haldi)] px-1.5 text-[#1e1b18]">{rupees(it.price_paise)}</span>
                    ) : null}
                    {it.tag && <span className="mono absolute bottom-2 left-2 bg-[#1e1b18] px-1 text-[0.65rem] uppercase text-[var(--haldi)]">{it.tag}</span>}
                    {it.stamp && (
                      <span className="stamp absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[color-mix(in_srgb,var(--chalk)_70%,transparent)] text-2xl">
                        {it.stamp === "sold" ? "SOLD" : "BOOKED OUT"}
                      </span>
                    )}
                  </div>
                </WalkLink>
              </li>
            ))}
          </ul>
        )}
        <p className="mono mt-2 text-[var(--muted)]">Cover pe tap karo, poora page khulega.</p>
      </section>
    </SceneRoot>
  );
}

export function CounterScene({ lane, replaces }: { lane: PublicLane; replaces?: string | null }) {
  const doc = lane.doc;
  const enquiry = doc.counterMode === "enquiry";
  const svcs = lane.services.map((s) => ({ id: s.id, name: s.name.en, minutes: s.minutes, capacity: s.capacity, price: s.price_paise ? rupees(s.price_paise) : null, auto: s.auto_confirm }));
  return (
    <SceneRoot scene="counter">
      {/* the counter seen from above: a wooden band with the stall leaning in from the left */}
      <section className="relative mt-4 border-y-4 border-[#3b2a12]" style={{ background: "color-mix(in srgb, var(--brick) 25%, var(--chalk))" }}>
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-[180px_1fr]">
          <div className="hidden md:block">
            <FacadeFor lane={lane} scene="counter" />
          </div>
          <div>
            <Kicker s="counter" />
            <H1>{enquiry ? "Date poochho" : "Slot pakka karo"}</H1>
            <p className="mt-2 max-w-prose">{doc.counter.pitch}</p>
          </div>
        </div>
      </section>
      <section className="mx-auto mt-6 grid max-w-6xl gap-10 px-4 lg:grid-cols-[1.3fr_1fr]">
        {enquiry ? (
          <>
            <div>
              <h2 className="sign text-2xl">Chit likho</h2>
              <ChitForm handle={lane.handle} scene="counter" fields={doc.chitFields} allowFile={["mehendi", "designer", "photo"].includes(lane.trade)} />
            </div>
            {svcs.length > 0 && (
              <div>
                <h2 className="sign text-2xl">Ya pehle milne ka slot</h2>
                <Counter handle={lane.handle} services={svcs} tz={lane.tz} laneName={doc.name} replaces={replaces} />
              </div>
            )}
          </>
        ) : (
          <>
            <div>
              <Counter handle={lane.handle} services={svcs} tz={lane.tz} laneName={doc.name} replaces={replaces} />
            </div>
            <aside>
              <h2 className="sign text-2xl">Kuch aur poochna hai?</h2>
              <ChitForm handle={lane.handle} scene="counter" fields={doc.chitFields} />
            </aside>
          </>
        )}
      </section>
    </SceneRoot>
  );
}

export function MenuScene({ lane }: { lane: PublicLane }) {
  const doc = lane.doc;
  const days = pickupDays({ tz: lane.tz, hours: lane.hours, closures: lane.closures });
  return (
    <SceneRoot scene="menu">
      <section className="mx-auto max-w-6xl px-4 pt-6">
        <div className="grid grid-cols-[1fr_88px] items-end gap-4 sm:grid-cols-[1fr_140px]">
          <div>
            <Kicker s="menu" />
            <H1>{doc.menuMode === "menu" ? "Menu Board" : "Hanger rail"}</H1>
            <p className="mt-2 max-w-prose">{doc.menu.pitch}</p>
          </div>
          <FacadeFor lane={lane} scene="menu" />
        </div>
        <div className="mt-6">
          {lane.menu.length ? (
            <MenuBoard
              handle={lane.handle}
              items={lane.menu.map((m) => ({ id: m.id, name: m.name.en, hi: m.name.hi, blurb: m.blurb, price_paise: m.price_paise, cap: m.daily_cap }))}
              days={days}
              pickupNote={doc.menu.pickupNote}
              mode={doc.menuMode}
              laneName={doc.name}
              upiName={doc.upi.vpa ? (doc.upi.name ?? doc.name) : null}
            />
          ) : (
            <p className="text-[var(--muted)]">Board abhi khaali hai.</p>
          )}
        </div>
      </section>
    </SceneRoot>
  );
}

export function PostboxScene({ lane }: { lane: PublicLane }) {
  return (
    <SceneRoot scene="postbox">
      <section className="mx-auto grid max-w-5xl grid-cols-[minmax(0,140px)_auto_1fr] gap-4 px-4 pt-6 sm:grid-cols-[220px_auto_1fr] sm:gap-8">
        <div className="self-end">
          <FacadeFor lane={lane} scene="postbox" />
        </div>
        <p className="sign self-center text-4xl leading-none text-[var(--lane-a)] sm:text-6xl" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }} aria-hidden="true">
          चिट्ठी आई है
        </p>
        <div className="col-span-3 self-center sm:col-span-1">
          <Kicker s="postbox" />
          <H1>Postcard mangao</H1>
          <p className="mt-3 max-w-prose text-lg">{lane.doc.postbox.pitch}</p>
          <div className="mt-6 max-w-sm">
            <PostboxForm handle={lane.handle} />
          </div>
        </div>
      </section>
    </SceneRoot>
  );
}

export function NoticeScene({ lane }: { lane: PublicLane }) {
  const now = Date.now();
  const notes = lane.notes.filter((n) => (!n.show_from || new Date(n.show_from).getTime() <= now) && (!n.show_until || new Date(n.show_until).getTime() > now));
  const d = laneDna(lane);
  const wall = d.variants.notice === 0 ? "url(#k-cork)" : d.variants.notice === 1 ? "url(#k-brick)" : "url(#k-tinsheet)";
  return (
    <SceneRoot scene="notice">
      <section className="mx-auto max-w-6xl px-4 pt-6">
        <Kicker s="notice" />
        <H1>Noticeboard</H1>
        <p className="mt-2 max-w-prose">{lane.doc.notice.pitch}</p>
        <div className="relative mt-6 overflow-hidden rounded-md border-[10px] border-[#5a3a1a] p-4 sm:p-6" style={{ boxShadow: "var(--shadow-paper)" }}>
          <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
            <rect width="100%" height="100%" fill={wall} />
          </svg>
          {notes.length === 0 ? (
            <p className="relative rounded bg-[var(--paper)] p-4 text-[#1e1b18]">Abhi koi note nahi lagi.</p>
          ) : (
            <ul className="relative columns-1 gap-4 sm:columns-2 lg:columns-3">
              {notes.map((n, i) => {
                const rot = (((lane.doc.seed >> (i % 16)) % 9) - 4) * 1;
                const bg = ["var(--paper)", "color-mix(in srgb, var(--haldi) 70%, #fff)", "var(--mint-enamel)", "#fff4e0"][i % 4];
                return (
                  <li key={n.id} className="mb-4 break-inside-avoid" style={{ transform: `rotate(${rot}deg)` }}>
                    <a href={`/go/${n.id}`} className="relative block px-4 pb-4 pt-6 text-[#1e1b18] transition-transform hover:-translate-y-1 hover:rotate-0" style={{ background: bg, boxShadow: "3px 4px 0 rgba(0,0,0,.25)", minHeight: 80 + (i % 3) * 22 }} rel="noopener">
                      <span className="absolute left-1/2 top-1.5 size-3.5 -translate-x-1/2 rounded-full border border-[#1e1b18]" style={{ background: ["var(--sindoor)", "var(--lane-b)", "var(--lane-a)"][i % 3] }} aria-hidden="true" />
                      <span className="text-lg font-semibold leading-snug">{n.label}</span>
                      <span className="mono mt-2 block truncate text-xs opacity-70">{n.url.replace(/^https?:\/\//, "")}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </SceneRoot>
  );
}

export function LoftScene({ lane }: { lane: PublicLane }) {
  const l = lane.doc.loft;
  return (
    <SceneRoot scene="loft">
      <article className="mx-auto max-w-3xl px-4 pt-6">
        <div className="mx-auto w-40">
          <FacadeFor lane={lane} scene="loft" />
        </div>
        <div className="border-x-4 border-t-4 border-[#3b2a12]" style={{ clipPath: "polygon(50% 0, 100% 18%, 100% 100%, 0 100%, 0 18%)", background: "var(--plaster)" }}>
          <div className="px-6 pb-6 pt-16 text-center">
            <Kicker s="loft" />
            <H1>Kaise banta hai</H1>
          </div>
        </div>
        <section className="border-x-4 border-t-4 border-[#3b2a12] bg-[var(--paper)] p-6 text-[#1e1b18]">
          <h2 className="sign text-2xl">Kahani</h2>
          <p className="mt-2 text-lg leading-relaxed">{l.story}</p>
        </section>
        <section className="border-x-4 border-t-4 border-[#3b2a12] p-6" style={{ background: "color-mix(in srgb, var(--lane-c) 25%, var(--chalk))" }}>
          <h2 className="sign text-2xl">Process</h2>
          <ol className="mt-3 space-y-3">
            {l.steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="mono grid size-8 shrink-0 place-items-center rounded-full border-2 border-[var(--soot)]">{i + 1}</span>
                <span className="pt-1">{s}</span>
              </li>
            ))}
          </ol>
        </section>
        <section className="border-4 border-[#3b2a12] p-6" style={{ background: "color-mix(in srgb, var(--brick) 15%, var(--chalk))" }}>
          <h2 className="sign text-2xl">Auzaar</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {l.tools.map((t) => (
              <li key={t} className="tin rounded-sm px-2 py-1">
                {t}
              </li>
            ))}
          </ul>
        </section>
      </article>
    </SceneRoot>
  );
}

export function RooftopScene({ lane }: { lane: PublicLane }) {
  const c = lane.doc.contact;
  const st = computeStatus({ tz: lane.tz, hours: lane.hours, closures: lane.closures }, new Date());
  const wa = c.whatsapp?.replace(/\D/g, "");
  return (
    <SceneRoot scene="rooftop">
      <div className="relative mx-auto max-h-[46vh] max-w-6xl overflow-hidden">
        <FacadeFor lane={lane} scene="rooftop" className="w-full" />
      </div>
      <section className="mx-auto -mt-10 max-w-4xl px-4">
        <div className="relative bg-[var(--chalk)] p-5 sm:p-8" style={{ boxShadow: "var(--shadow-paper)", border: "2px solid var(--soot)" }}>
          <Kicker s="rooftop" />
          <H1>Milne aao</H1>
          <p className="mt-2 max-w-prose">{lane.doc.rooftop.note}</p>
          <ul className="mt-5 divide-y-2 divide-dashed divide-[var(--line)]">
            {wa && (
              <li className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span>WhatsApp</span>
                <a className="cta" href={`https://wa.me/${wa}?text=${encodeURIComponent(`Namaste ${lane.doc.name}, aapki galli dekhi`)}`} target="_blank" rel="noreferrer">
                  WhatsApp pe likho
                </a>
              </li>
            )}
            {c.phone && (
              <li className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span>Phone</span>
                <a className="btn" href={`tel:${c.phone}`}>
                  {c.phone}
                </a>
              </li>
            )}
            {c.email && (
              <li className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span>Email chit</span>
                <a className="btn" href={`mailto:${c.email}`}>
                  {c.email}
                </a>
              </li>
            )}
            {c.address && (
              <li className="py-3">
                <p>{c.address}</p>
                <div className="mt-2">
                  <MapTap query={c.mapQuery || c.address} />
                </div>
              </li>
            )}
            <li className="mono py-3 text-[var(--muted)]">{st.line}</li>
          </ul>
        </div>
      </section>
    </SceneRoot>
  );
}
