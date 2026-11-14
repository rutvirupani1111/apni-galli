import { ownLane } from "@/lib/auth";
import { withOwner } from "@/lib/db";

// Everything this owner has for the lane, as one JSON file (DPDP / GDPR export).
export async function GET(_req: Request, { params }: { params: Promise<{ laneId: string }> }) {
  const { laneId } = await params;
  const own = await ownLane(laneId);
  if (!own) return new Response("Login karo", { status: 401 });
  const out = await withOwner(own.owner.id, async (q) => {
    const one = (sql: string) => q.query(sql, [laneId]);
    return {
      exported_at: new Date().toISOString(),
      lane: (await one("select id, handle, tz, trade, draft, listed, created_at from lanes where id = $1"))[0],
      versions: await one("select id, diff_summary, published_at, doc from lane_versions where lane_id = $1 order by published_at"),
      hours: await one("select weekday, opens, closes from hours_rules where lane_id = $1"),
      closures: await one("select during::text, note from closures where lane_id = $1"),
      services: await one("select * from services where lane_id = $1"),
      bookings: await one("select id, service_id, seat, slot::text, status, visitor_name, visitor_contact, note, created_at from bookings where lane_id = $1 and status <> 'hold'"),
      menu: await one("select * from menu_items where lane_id = $1"),
      chits: await one("select id, kind, scene, fields, lines, total_paise, pickup_day, status, paid_marked_at, created_at from chits where lane_id = $1"),
      replies: await one("select r.chit_id, r.body, r.created_at from chit_replies r join chits c on c.id = r.chit_id where c.lane_id = $1"),
      subscribers: await one("select email, status, confirmed_at, created_at from subscribers where lane_id = $1"),
      consents: await one("select k.subscriber_id, k.action, k.at, k.form_version from consents k join subscribers s on s.id = k.subscriber_id where s.lane_id = $1"),
      postcards: await one("select subject, body, status, sent_count, created_at from postcards where lane_id = $1"),
      notes: await one("select label, url, clicks from notes where lane_id = $1"),
      metrics: await one("select day, scene, event, n from daily_metrics where lane_id = $1 order by day"),
    };
  });
  return new Response(JSON.stringify(out, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="apni-galli-${out.lane ? (out.lane as { handle: string }).handle : "lane"}.json"`, "Cache-Control": "no-store" },
  });
}
