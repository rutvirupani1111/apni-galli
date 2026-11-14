import { redirect } from "next/navigation";
import { currentOwner } from "@/lib/auth";
import { withOwner } from "@/lib/db";
import { SCENE_META, type LaneDoc } from "@/lib/doc";
import type { AnyScene } from "@/lib/dna";
import { SCENE_ICON } from "@/components/lane/server";

export const metadata = { title: "Insights", robots: { index: false } };

const ACTIONS = ["cta_click", "chit_sent", "hold", "booked", "ordered", "subscribed", "note_click"];

// "Which building is doing the work?" Every number is a real aggregate from the cookieless beacon.
export default async function Insights({ params, searchParams }: { params: Promise<{ laneId: string }>; searchParams: Promise<{ days?: string }> }) {
  const { laneId } = await params;
  const days = (await searchParams).days === "30" ? 30 : 7;
  const me = await currentOwner();
  if (!me) redirect("/login");
  const data = await withOwner(me.id, async (q) => {
    const lane = (await q.query<{ draft: LaneDoc }>("select draft from lanes where id = $1", [laneId]))[0];
    const m = await q.query<{ scene: string; event: string; n: number }>(
      "select scene, event, sum(n)::int as n from daily_metrics where lane_id = $1 and day > current_date - $2::int group by scene, event",
      [laneId, days],
    );
    const moves = await q.query<{ from_scene: string; to_scene: string; n: number }>(
      "select from_scene, to_scene, sum(n)::int as n from scene_moves where lane_id = $1 and day > current_date - $2::int group by 1, 2 order by 3 desc",
      [laneId, days],
    );
    return { lane, m, moves };
  });
  const order: AnyScene[] = ["gate", ...data.lane.draft.scenes];
  const views = (s: string) => data.m.filter((x) => x.scene === s && x.event === "view").reduce((a, b) => a + b.n, 0);
  const acts = (s: string) => data.m.filter((x) => x.scene === s && ACTIONS.includes(x.event)).reduce((a, b) => a + b.n, 0);
  const total = order.reduce((a, s) => a + views(s), 0);
  const maxMove = Math.max(1, ...data.moves.map((m) => m.n));
  const W = 120;
  return (
    <div>
      <h1 className="mast text-4xl">Insights</h1>
      <div className="mt-2 flex gap-2">
        <a className="btn" aria-pressed={days === 7} href="?days=7">
          7 din
        </a>
        <a className="btn" aria-pressed={days === 30} href="?days=30">
          30 din
        </a>
      </div>
      {total === 0 ? (
        <p className="mt-8 rounded-md border-2 border-dashed border-[var(--line)] p-8 text-center text-[var(--muted)]">Abhi koi nahi aaya. Galli ka link share karo, yahan har makaan ka hisaab dikhega.</p>
      ) : (
        <>
          <h2 className="sign mt-6 text-2xl">Street strip</h2>
          <p className="text-sm text-[var(--muted)]">Buildings in street order. Arrows are real walks between them, thicker means more people.</p>
          <div className="no-scrollbar mt-3 overflow-x-auto rounded-md border-2 border-[var(--soot)] bg-[var(--paper)] p-3" data-noswipe>
            <svg viewBox={`0 0 ${order.length * W} 190`} className="h-48" style={{ minWidth: order.length * 100 }} role="img" aria-label="Walks between buildings">
              {data.moves.map((mv, i) => {
                const a = order.indexOf(mv.from_scene as AnyScene);
                const b = order.indexOf(mv.to_scene as AnyScene);
                if (a < 0 || b < 0) return null;
                const x1 = a * W + W / 2;
                const x2 = b * W + W / 2;
                const up = x2 > x1;
                const h = 20 + Math.abs(b - a) * 14;
                const y = up ? 60 : 150;
                return (
                  <g key={i}>
                    <path d={`M${x1} ${y} Q${(x1 + x2) / 2} ${up ? y - h : y + h} ${x2} ${y}`} fill="none" stroke={up ? "var(--lane-a)" : "var(--lane-b)"} strokeWidth={1 + (mv.n / maxMove) * 7} opacity="0.8" markerEnd="url(#arrow)" />
                    <title>{`${mv.from_scene} to ${mv.to_scene}: ${mv.n}`}</title>
                  </g>
                );
              })}
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                  <path d="M0 0L10 5L0 10z" fill="#1e1b18" />
                </marker>
              </defs>
              {order.map((s, i) => (
                <g key={s} transform={`translate(${i * W + 20} 72)`}>
                  <rect width={W - 40} height="66" rx="4" fill="var(--chalk)" stroke="#1e1b18" strokeWidth="2" />
                  <g transform="translate(28 6) scale(1)">
                    <foreignObject width="24" height="20">
                      <div style={{ width: 24, height: 20 }}>{SCENE_ICON[s]}</div>
                    </foreignObject>
                  </g>
                  <text x={(W - 40) / 2} y="44" textAnchor="middle" style={{ fontFamily: "var(--f-mono)", fontSize: 13, fill: "#1e1b18" }}>
                    {views(s)}
                  </text>
                  <text x={(W - 40) / 2} y="59" textAnchor="middle" style={{ fontFamily: "var(--f-mono)", fontSize: 9, fill: "#4a4038" }}>
                    views
                  </text>
                </g>
              ))}
            </svg>
          </div>
          <table className="mt-6 w-full max-w-2xl text-left">
            <thead className="mono text-xs uppercase">
              <tr>
                <th className="py-2">Building</th>
                <th>Views</th>
                <th>Actions</th>
                <th>Action rate</th>
              </tr>
            </thead>
            <tbody>
              {order.map((s) => {
                const v = views(s);
                const a = acts(s);
                return (
                  <tr key={s} className="border-t border-dashed border-[var(--line)]">
                    <td className="py-2">{SCENE_META[s].name}</td>
                    <td className="mono">{v}</td>
                    <td className="mono">{a}</td>
                    <td className="mono">
                      <span className="inline-block h-2 rounded-sm align-middle" style={{ width: `${v ? Math.min(100, (a / v) * 100) : 0}px`, background: "var(--lane-a)" }} /> {v ? `${Math.round((a / v) * 100)}%` : "0%"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
