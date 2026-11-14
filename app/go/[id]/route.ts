import { withSystem } from "@/lib/db";
import { safeUrl } from "@/lib/lane";

// Noticeboard links: count the click, then send the visitor on. Only allowed schemes ever redirect.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const r = await withSystem(async (q) => {
    const n = await q.query<{ url: string; lane_id: string; owner_id: string; tz: string }>(
      "update notes n set clicks = clicks + 1 from lanes l where n.id = $1 and l.id = n.lane_id returning n.url, n.lane_id, n.owner_id, l.tz",
      [id],
    );
    if (!n[0]) return null;
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: n[0].tz }).format(new Date());
    await q.query(
      `insert into daily_metrics (lane_id, owner_id, day, scene, event, n) values ($1,$2,$3,'notice','note_click',1)
       on conflict (lane_id, day, scene, event) do update set n = daily_metrics.n + 1`,
      [n[0].lane_id, n[0].owner_id, day],
    );
    return n[0].url;
  });
  const url = r ? safeUrl(r) : null;
  if (!url) return new Response("Not found", { status: 404 });
  return Response.redirect(url, 302);
}
