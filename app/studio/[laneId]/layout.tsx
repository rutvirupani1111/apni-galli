import { notFound, redirect } from "next/navigation";
import { currentOwner } from "@/lib/auth";
import { withOwner } from "@/lib/db";
import type { LaneDoc } from "@/lib/doc";
import { dna } from "@/lib/dna";
import { triadVars } from "@/lib/palette";
import { StudioTabs } from "@/components/studio/Tabs";

export const dynamic = "force-dynamic";

export default async function StudioLane({ children, params }: { children: React.ReactNode; params: Promise<{ laneId: string }> }) {
  const { laneId } = await params;
  const me = await currentOwner();
  if (!me) redirect(`/login?next=/studio/${laneId}/galla`);
  if (!/^[0-9a-f-]{36}$/.test(laneId)) notFound();
  const l = await withOwner(me.id, (q) => q.query<{ handle: string; draft: LaneDoc; published_version_id: string | null }>("select handle, draft, published_version_id from lanes where id = $1", [laneId]));
  if (!l[0]) notFound();
  const d = dna(l[0].draft.seed, l[0].draft.pins);
  return (
    <div className="min-h-dvh" style={triadVars(d.palette) as React.CSSProperties}>
      <header className="sticky top-0 z-40 border-b-2 border-[var(--soot)] bg-[var(--chalk)]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2">
          <a href="/studio" className="mono text-xs underline">
            Studio
          </a>
          <span className="sign rounded-[4px] border-2 border-[#1e1b18] px-2 text-lg" style={{ background: "var(--lane-a)", color: "var(--on-lane-a)" }}>
            {l[0].draft.name}
          </span>
          <StudioTabs laneId={laneId} handle={l[0].handle} live={!!l[0].published_version_id} />
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-5">{children}</div>
    </div>
  );
}
