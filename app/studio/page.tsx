import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentOwner, destroySession } from "@/lib/auth";
import { withOwner } from "@/lib/db";
import type { LaneDoc } from "@/lib/doc";
import { dna } from "@/lib/dna";
import { triadVars } from "@/lib/palette";
import { Facade } from "@/components/art/facades";
import { KitDefs } from "@/components/art/kit";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Studio", robots: { index: false } };

async function logout() {
  "use server";
  await destroySession();
  redirect("/");
}

export default async function Studio() {
  const me = await currentOwner();
  if (!me) redirect("/login?next=/studio");
  const lanes = await withOwner(me.id, (q) =>
    q.query<{ id: string; handle: string; draft: LaneDoc; published_version_id: string | null; new_chits: number; pending: number }>(
      `select l.id, l.handle, l.draft, l.published_version_id,
              (select count(*)::int from chits c where c.lane_id = l.id and c.status = 'new') as new_chits,
              (select count(*)::int from bookings b where b.lane_id = l.id and b.status = 'pending') as pending
         from lanes l order by l.created_at`,
    ),
  );
  return (
    <main className="mx-auto min-h-dvh max-w-5xl px-4 py-6">
      <KitDefs />
      <header className="flex flex-wrap items-center justify-between gap-3">
        <a href="/" className="sign rounded border-2 border-[#1e1b18] bg-[var(--rani)] px-3 py-1 text-xl text-[#fff4e0]" style={{ boxShadow: "var(--shadow-paper-sm)" }}>
          Apni Galli
        </a>
        <div className="flex items-center gap-2">
          <span className="mono text-xs">{me.email}</span>
          <form action={logout}>
            <button className="btn">Bahar jao</button>
          </form>
        </div>
      </header>
      <h1 className="mast t-mast mt-8">Aapki galliyan</h1>
      <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {lanes.map((l) => {
          const d = dna(l.draft.seed, l.draft.pins);
          return (
            <li key={l.id} className="rounded-md border-2 border-[var(--soot)] bg-[var(--paper)] p-3" style={{ ...(triadVars(d.palette) as React.CSSProperties), boxShadow: "var(--shadow-paper)" }}>
              <div className="mx-auto w-40">
                <Facade scene="gate" ctx={{ dna: d, name: l.draft.name, hi: l.draft.nameHi, seed: l.draft.seed }} />
              </div>
              <p className="sign mt-2 text-2xl">{l.draft.name}</p>
              <p className="mono text-xs text-[var(--muted)]">/w/{l.handle} · {l.published_version_id ? "published" : "draft, not live yet"}</p>
              <p className="mono mt-1 text-xs">
                {l.new_chits} nayi chits · {l.pending} pending bookings
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a className="cta" href={`/studio/${l.id}/galla`}>
                  Galla
                </a>
                <a className="btn" href={`/studio/${l.id}/edit`}>
                  Edit
                </a>
                <a className="btn" href={`/studio/${l.id}/settings`}>
                  Settings
                </a>
                <a className="btn" href={`/studio/${l.id}/insights`}>
                  Insights
                </a>
                {l.published_version_id && (
                  <a className="btn" href={`/w/${l.handle}`}>
                    Live dekho
                  </a>
                )}
              </div>
            </li>
          );
        })}
        <li>
          <a href="/try" className="grid h-full min-h-60 place-items-center rounded-md border-2 border-dashed border-[var(--soot)] p-6 text-center">
            <span>
              <span className="sign block text-3xl">+ Nayi galli</span>
              <span className="text-sm text-[var(--muted)]">Pehla Kadam, 4 sawal</span>
            </span>
          </a>
        </li>
      </ul>
    </main>
  );
}
