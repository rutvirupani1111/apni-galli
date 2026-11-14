import type { Metadata } from "next";
import { withSystem } from "@/lib/db";
import type { LaneDoc } from "@/lib/doc";
import { dna } from "@/lib/dna";
import { triadVars } from "@/lib/palette";
import { TRADES } from "@/lib/trades";
import { Facade } from "@/components/art/facades";
import { KitDefs } from "@/components/art/kit";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Galli wall", description: "Published lanes whose owners chose to be listed." };

export default async function GalliWall({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const trade = sp.trade && sp.trade in TRADES ? sp.trade : null;
  const city = sp.city?.slice(0, 40) || null;
  const q = sp.q?.slice(0, 60) || null;
  const rows = await withSystem((x) =>
    x.query<{ handle: string; doc: LaneDoc; trade: string; is_demo: boolean }>(
      `select l.handle, v.doc, l.trade, l.is_demo from lanes l join lane_versions v on v.id = l.published_version_id
        where l.listed and l.suspended_at is null
          and ($1::text is null or l.trade = $1)
          and ($2::text is null or lower(v.doc->>'city') = lower($2))
          and ($3::text is null or (v.doc->>'name') ilike '%' || $3 || '%' or (v.doc->>'tagline') ilike '%' || $3 || '%')
        order by l.is_demo, l.updated_at desc limit 60`,
      [trade, city, q],
    ),
  );
  const cities = [...new Set(rows.map((r) => r.doc.city).filter(Boolean))];
  return (
    <main className="mx-auto min-h-dvh max-w-6xl px-4 py-8">
      <KitDefs />
      <a href="/" className="sign rounded border-2 border-[#1e1b18] bg-[var(--rani)] px-3 py-1 text-xl text-[#fff4e0]" style={{ boxShadow: "var(--shadow-paper-sm)" }}>
        Apni Galli
      </a>
      <h1 className="mast t-mast mt-6">Galli wall</h1>
      <p className="text-[var(--muted)]">{rows.length} galliyan. Only lanes whose owners opted in are listed.</p>
      <form className="mt-4 flex flex-wrap items-end gap-2" method="get">
        <label className="text-sm">
          <span className="sr-only">Search</span>
          <input name="q" defaultValue={q ?? ""} className="input" placeholder="Search name or line" />
        </label>
        <select name="trade" defaultValue={trade ?? ""} className="input w-auto" aria-label="Trade">
          <option value="">Every trade</option>
          {Object.values(TRADES).map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
        <select name="city" defaultValue={city ?? ""} className="input w-auto" aria-label="City">
          <option value="">Every city</option>
          {cities.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button className="btn">Dhoondo</button>
      </form>
      <ul className="mt-8 grid grid-cols-2 gap-5 md:grid-cols-4">
        {rows.length === 0 && <li className="col-span-full text-[var(--muted)]">Is filter mein koi galli nahi.</li>}
        {rows.map((r, i) => {
          const d = dna(r.doc.seed, r.doc.pins);
          return (
            <li key={r.handle} style={{ ...(triadVars(d.palette) as React.CSSProperties), marginTop: i % 2 ? 24 : 0 }}>
              <a href={`/w/${r.handle}`} className="block border-2 border-[#1e1b18] bg-[var(--paper)] p-2 text-[#1e1b18]" style={{ boxShadow: "var(--shadow-paper)" }}>
                <Facade scene="gate" ctx={{ dna: d, name: r.doc.name, hi: r.doc.nameHi, seed: r.doc.seed }} />
                <p className="sign mt-2 text-xl leading-tight">{r.doc.name}</p>
                <p className="mono text-xs">
                  {r.doc.city || "Online"} · {TRADES[r.trade as keyof typeof TRADES]?.label}
                  {r.is_demo ? " · demo" : ""}
                </p>
              </a>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
