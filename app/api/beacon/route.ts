import { z } from "zod";
import { withSystem } from "@/lib/db";
import { take, clientIp } from "@/lib/ratelimit";
import { ipHash } from "@/lib/crypto";

const SCENES = ["gate", "window", "counter", "menu", "postbox", "notice", "loft", "rooftop", "map"] as const;
const B = z.object({
  lane: z.string().regex(/^[a-z0-9][a-z0-9-]{2,29}$/),
  scene: z.enum(SCENES),
  event: z.enum(["view", "cta_click", "chit_sent", "hold", "booked", "ordered", "subscribed", "note_click"]),
  from: z.enum(SCENES).optional(),
});

// Cookieless analytics: an upsert into daily aggregates. No cookies, no IPs, no per-visitor rows.
export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = JSON.parse(await req.text());
  } catch {
    return new Response(null, { status: 204 });
  }
  const p = B.safeParse(raw);
  if (!p.success) return new Response(null, { status: 204 });
  try {
    if (!(await take(`beacon:${await ipHash(clientIp(req))}`, 120, 600))) return new Response(null, { status: 204 });
    await withSystem(async (q) => {
      const l = await q.query<{ id: string; owner_id: string; tz: string }>("select id, owner_id, tz from lanes where handle = $1 and published_version_id is not null", [p.data.lane]);
      if (!l[0]) return;
      const day = new Intl.DateTimeFormat("en-CA", { timeZone: l[0].tz }).format(new Date());
      await q.query(
        `insert into daily_metrics (lane_id, owner_id, day, scene, event, n) values ($1,$2,$3,$4,$5,1)
         on conflict (lane_id, day, scene, event) do update set n = daily_metrics.n + 1`,
        [l[0].id, l[0].owner_id, day, p.data.scene, p.data.event],
      );
      if (p.data.event === "view" && p.data.from && p.data.from !== p.data.scene) {
        await q.query(
          `insert into scene_moves (lane_id, owner_id, day, from_scene, to_scene, n) values ($1,$2,$3,$4,$5,1)
           on conflict (lane_id, day, from_scene, to_scene) do update set n = scene_moves.n + 1`,
          [l[0].id, l[0].owner_id, day, p.data.from, p.data.scene],
        );
      }
    });
  } catch (e) {
    console.error("beacon", e);
  }
  return new Response(null, { status: 204 });
}
