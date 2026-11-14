import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadPublicLane } from "@/lib/lane";
import { rupees } from "@/lib/money";
import { SceneRoot, WalkLink } from "@/components/lane/client";
import { ChitForm } from "@/components/lane/ChitForm";
import { CoverMotif } from "@/components/lane/server";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ handle: string; item: string }> }): Promise<Metadata> {
  const { handle, item } = await params;
  const lane = await loadPublicLane(handle);
  const it = lane?.doc.window.items.find((i) => i.id === item);
  if (!lane || !it) return {};
  return { title: `${it.title}: ${lane.doc.name}`, description: it.blurb };
}

export default async function ItemPage({ params }: { params: Promise<{ handle: string; item: string }> }) {
  const { handle, item } = await params;
  const lane = await loadPublicLane(handle);
  const it = lane?.doc.window.items.find((i) => i.id === item);
  if (!lane || !it) notFound();
  const jsonLd = { "@context": "https://schema.org", "@type": it.price_paise ? "Product" : "CreativeWork", name: it.title, description: it.blurb, ...(it.price_paise ? { offers: { "@type": "Offer", price: (it.price_paise / 100).toFixed(2), priceCurrency: "INR" } } : {}) };
  const verb = lane.doc.menuMode === "catalogue" && it.price_paise ? "Reserve this piece" : "Ask about this";
  return (
    <SceneRoot scene="window">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className="mx-auto grid max-w-5xl gap-8 px-4 pt-6 md:grid-cols-[1fr_1fr]">
        <div className="relative aspect-[3/4] border-2 border-[#1e1b18]" style={{ background: "var(--lane-c)", boxShadow: "var(--shadow-paper)" }}>
          <svg viewBox="0 0 200 260" className="absolute inset-0 h-full w-full" aria-hidden="true">
            <CoverMotif motif={it.motif} seed={lane.doc.seed} />
          </svg>
          {it.stamp && <span className="stamp stamp-in absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-4xl">{it.stamp === "sold" ? "SOLD" : "BOOKED OUT"}</span>}
        </div>
        <div>
          <WalkLink href={`/w/${handle}/window`} className="mono underline">
            ← Khidki pe wapas
          </WalkLink>
          <h1 className="mast t-mast mt-3 outline-none">{it.title}</h1>
          {it.tag && <p className="mono mt-1 uppercase text-[var(--lane-a)]">{it.tag}</p>}
          <p className="mt-3 text-lg">{it.blurb}</p>
          {it.price_paise ? <p className="mono mt-3 inline-block rotate-[-2deg] border-2 border-[#1e1b18] bg-[var(--haldi)] px-2 text-xl text-[#1e1b18]">{rupees(it.price_paise)}</p> : null}
          <div className="mt-6">
            {it.stamp === "sold" ? (
              <p className="text-[var(--muted)]">Yeh bik gaya. Kuch aisa hi chahiye? Gate pe chit chhodo.</p>
            ) : (
              <ChitForm handle={handle} scene="window" fields={lane.doc.chitFields} prefill={{ msg: `${verb}: ${it.title}`, piece: it.title }} about={it.title} title={verb} />
            )}
          </div>
        </div>
      </article>
    </SceneRoot>
  );
}
