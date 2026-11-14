import { withSystem } from "@/lib/db";
import { hoursOf, type ServiceRow } from "@/lib/lane";
import { computeStatus } from "@/lib/status";
import { generateSlots } from "@/lib/slots";
import { addDays, localDate, zonedToUtc } from "@/lib/time";
import { json, route } from "@/lib/http";

// The live island: open or closed, free slots today, stock left. Small, and cached 30 s at the edge.
export const GET = route(async (req: Request, { params }: { params: Promise<{ handle: string }> }) => {
  const { handle } = await params;
  const dayParam = new URL(req.url).searchParams.get("day");
  const out = await withSystem(async (q) => {
    const l = await q.query<{ id: string; tz: string }>("select id, tz from lanes where handle = $1 and published_version_id is not null", [handle]);
    if (!l[0]) return null;
    const lane = l[0];
    const h = { tz: lane.tz, ...(await hoursOf(q, lane.id)) };
    const now = new Date();
    const st = computeStatus(h, now);
    const today = localDate(now, lane.tz);
    const day = dayParam && /^\d{4}-\d{2}-\d{2}$/.test(dayParam) ? dayParam : today;
    let freeToday: number | null = null;
    const svc = (await q.query<ServiceRow>("select * from services where lane_id = $1 and active order by sort, minutes limit 1", [lane.id]))[0];
    if (svc) {
      const from = zonedToUtc(today, 0, lane.tz);
      const to = zonedToUtc(addDays(today, 1), 0, lane.tz);
      const taken = await q.query<{ seat: number; s: Date; e: Date }>(
        `select seat, lower(blocked) as s, upper(blocked) as e from bookings where resource_id = $1
          and status in ('hold','pending','confirmed') and (status <> 'hold' or expires_at > now()) and blocked && tstzrange($2,$3)`,
        [svc.resource_id, from.toISOString(), to.toISOString()],
      );
      freeToday = generateSlots(h, svc, today, now, taken.map((t) => ({ seat: t.seat, start: new Date(t.s).getTime(), end: new Date(t.e).getTime() }))).length;
    }
    const stock: Record<string, number> = {};
    const items = await q.query<{ id: string; daily_cap: number | null; sold: number | null }>(
      `select m.id, m.daily_cap, s.sold from menu_items m left join item_day_stock s on s.item_id = m.id and s.day = $2
        where m.lane_id = $1 and m.active and m.daily_cap is not null`,
      [lane.id, day],
    );
    for (const it of items) stock[it.id] = (it.daily_cap ?? 0) - (it.sold ?? 0);
    return { status: { open: st.open, line: st.line, short: st.short, reason: st.reason }, freeToday, stock, day, asof: now.toISOString() };
  });
  if (!out) return json({ error: "no lane" }, 404);
  return json(out, 200, { "Cache-Control": dayParam ? "public, s-maxage=10, stale-while-revalidate=20" : "public, s-maxage=30, stale-while-revalidate=60" });
});
