import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadPublicLane } from "@/lib/lane";
import { computeStatus, hoursSummary } from "@/lib/status";
import { SCENE_META } from "@/lib/doc";
import { TRADES } from "@/lib/trades";
import { Shutter } from "@/components/lane/Shutter";
import { ChitForm } from "@/components/lane/ChitForm";
import { LiveText, SceneRoot, WalkLink } from "@/components/lane/client";
import { CtaBeacon } from "@/components/lane/bits";
import { Door, FacadeFor, SignSvg, ToranSvg, coverLine } from "@/components/lane/server";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const lane = await loadPublicLane(handle);
  if (!lane) return {};
  return {
    title: `${lane.doc.name}${lane.doc.city ? `, ${lane.doc.city}` : ""}`,
    description: lane.doc.tagline,
    alternates: { canonical: `/w/${handle}` },
    openGraph: { title: lane.doc.name, description: lane.doc.tagline, images: [`/w/${handle}/og`] },
  };
}

export default async function Gate({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const lane = await loadPublicLane(handle);
  if (!lane) notFound();
  const doc = lane.doc;
  const st = computeStatus({ tz: lane.tz, hours: lane.hours, closures: lane.closures }, new Date());
  const allowFile = ["mehendi", "designer", "photo"].includes(lane.trade);
  const booking = doc.scenes.includes("counter") && lane.services.length > 0 && doc.counterMode === "booking";
  const ordering = doc.scenes.includes("menu") && lane.menu.length > 0;
  const primary = booking
    ? { href: `/w/${handle}/counter`, label: "Slot pakka karo", scene: "counter" }
    : ordering
      ? { href: `/w/${handle}/menu`, label: doc.menuMode === "menu" ? "Order likho" : "Piece reserve karo", scene: "menu" }
      : doc.scenes.includes("counter")
        ? { href: `/w/${handle}/counter`, label: "Chit bhejo", scene: "counter" }
        : { href: "#chit", label: "Chit bhejo", scene: "gate" };
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: doc.name,
    description: doc.tagline,
    address: doc.contact.address,
    openingHours: hoursSummary(lane.hours),
    url: `/w/${handle}`,
  };

  return (
    <>
      <Shutter
        name={doc.name}
        sign={<SignSvg lane={lane} />}
        toran={<ToranSvg lane={lane} />}
        initialLine={st.line}
        initialOpen={st.open}
        asof={new Date().toISOString()}
        chit={<ChitForm handle={handle} scene="gate" fields={doc.chitFields} allowFile={allowFile} title="Chit likho" compact />}
      />
    <SceneRoot scene="gate">
      <noscript>
        <meta httpEquiv="refresh" content={`0;url=/w/${handle}/plain`} />
      </noscript>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="mx-auto grid max-w-6xl gap-6 px-4 pt-5 lg:grid-cols-[minmax(0,460px)_1fr] lg:gap-12 lg:pt-10">
        <div className="relative mx-auto w-full max-w-[460px] lg:sticky lg:top-20 lg:self-start">
          <FacadeFor lane={lane} scene="gate" label={`${doc.name}: the gate of the lane`} />
        </div>
        <div className="flex flex-col justify-center">
          <p className="mono uppercase text-[var(--muted)]">
            {doc.city ? `${doc.city} · ` : ""}
            {TRADES[lane.trade]?.label ?? lane.trade}
          </p>
          <h1 className="mast t-mast mt-2 outline-none">
            {doc.name}
            {doc.nameHi && <span className="sign mt-1 block text-[0.55em] text-[var(--lane-a)]">{doc.nameHi}</span>}
          </h1>
          <p className="mt-4 max-w-prose text-lg">{doc.tagline}</p>
          <p className="mt-5 inline-flex w-fit items-center gap-2 rounded-md border-2 border-[var(--soot)] px-3 py-2" style={{ background: st.open ? "color-mix(in srgb, var(--mint-enamel) 45%, var(--chalk))" : "color-mix(in srgb, var(--haldi) 30%, var(--chalk))" }}>
            <svg viewBox="0 0 20 30" className="h-6 w-4" aria-hidden="true">
              <path d="M3 6h14l-2 4H5z" fill="#2a2420" />
              <rect x="4" y="10" width="12" height="16" rx="3" style={{ fill: st.open ? "var(--haldi)" : "#7d776c" }} stroke="#2a2420" strokeWidth="1.4" />
            </svg>
            <LiveText kind="line" fallback={st.line} className="sign text-lg" />
          </p>
          <p className="mono mt-2 text-[var(--muted)]">{hoursSummary(lane.hours)}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            {primary.href.startsWith("#") ? (
              <a href={primary.href} className="cta">
                {primary.label} →
              </a>
            ) : (
              <CtaBeacon scene="gate" href={primary.href} className="cta">
                {primary.label} →
              </CtaBeacon>
            )}
            <WalkLink href={`/w/${handle}/map`} className="cta cta-ghost">
              Poori galli
            </WalkLink>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-14 max-w-6xl px-4" aria-labelledby="aage">
        <h2 id="aage" className="sign text-3xl">
          Galli mein aage
        </h2>
        <p className="text-[var(--muted)]">Har makaan ek kaam karta hai. Darwaze pe tap karo.</p>
        <ul className="no-scrollbar -mx-4 mt-4 flex snap-x gap-4 overflow-x-auto px-4 pb-4" data-noswipe>
          {doc.scenes.map((s, i) => (
            <li key={s} className="w-40 shrink-0 snap-start sm:w-48" style={{ marginTop: (i % 3) * 14 }}>
              <WalkLink href={`/w/${handle}/${s}`} className="group block rounded-md border-2 border-[var(--soot)] bg-[var(--paper)] p-2 transition-transform hover:-translate-y-1" label={`${SCENE_META[s].name}: ${SCENE_META[s].verb}`}>
                <div className="aspect-[3/4] overflow-hidden rounded-sm">
                  <Door scene={s} label={SCENE_META[s].hi} />
                </div>
                <p className="mt-2 font-semibold leading-tight">{SCENE_META[s].name}</p>
                <p className="mono text-[0.75rem] text-[var(--muted)]">
                  {s === "counter" && booking ? <LiveText kind="free" fallback={coverLine(lane, s)} /> : coverLine(lane, s)}
                </p>
              </WalkLink>
            </li>
          ))}
        </ul>
      </section>

      <section id="chit" className="mx-auto mt-10 grid max-w-6xl gap-6 px-4 md:grid-cols-[1fr_1.2fr] md:items-start">
        <div>
          <h2 className="sign text-3xl">Seedha chit bhejo</h2>
          <p className="mt-2 max-w-prose text-[var(--muted)]">
            Sawal, order, ya date poochni ho: chit likho. {doc.name} ke Galla mein seedha jaati hai, aur aapko ek link milta hai jahan jawab dikhega.
          </p>
        </div>
        <ChitForm handle={handle} scene="gate" fields={doc.chitFields} allowFile={allowFile} />
      </section>
    </SceneRoot>
    </>
  );
}
