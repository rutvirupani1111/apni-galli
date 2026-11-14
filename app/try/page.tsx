import type { Metadata } from "next";
import { currentOwner } from "@/lib/auth";
import { withSystem } from "@/lib/db";
import type { LaneDoc } from "@/lib/doc";
import { PehlaKadam } from "@/components/studio/PehlaKadam";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pehla Kadam: apni galli banao", robots: { index: false } };

export default async function Try({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const me = await currentOwner();
  let remix: { handle: string; name: string; seed: number; pins: Record<string, number> } | null = null;
  if (sp.remix && /^[a-z0-9][a-z0-9-]{2,29}$/.test(sp.remix)) {
    const r = await withSystem((q) => q.query<{ doc: LaneDoc }>("select v.doc from lanes l join lane_versions v on v.id = l.published_version_id where l.handle = $1", [sp.remix]));
    if (r[0]) remix = { handle: sp.remix, name: r[0].doc.name, seed: r[0].doc.seed, pins: r[0].doc.pins as Record<string, number> };
  }
  return (
    <main className="min-h-dvh px-4 py-6 sm:px-8">
      <header className="mb-6 flex items-center justify-between">
        <a href="/" className="sign rounded border-2 border-[#1e1b18] bg-[var(--rani)] px-3 py-1 text-xl text-[#fff4e0]" style={{ boxShadow: "var(--shadow-paper-sm)" }}>
          Apni Galli
        </a>
        <span className="mono text-xs text-[var(--muted)]">{me ? me.email : <a href="/login?next=/try" className="underline">Login</a>}</span>
      </header>
      <PehlaKadam loggedIn={!!me} remix={remix} />
    </main>
  );
}
