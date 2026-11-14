import { z } from "zod";
import { withSystem } from "@/lib/db";
import { body, json, route } from "@/lib/http";
import { take, clientIp } from "@/lib/ratelimit";
import { ipHash } from "@/lib/crypto";
import { HttpError } from "@/lib/visitor";

const B = z.object({ lane: z.string().regex(/^[a-z0-9][a-z0-9-]{2,29}$/), reason: z.enum(["impersonation", "scam", "abuse", "other"]), detail: z.string().max(1000).optional(), website: z.string().optional() });

export const POST = route(async (req: Request) => {
  const b = await body(req, B);
  if (b.website) return json({ ok: true });
  if (!(await take(`report:${await ipHash(clientIp(req))}`, 5, 3600))) throw new HttpError(429, "rate", "Bahut reports. Baad mein try karo.");
  const r = await withSystem((q) => q.query("insert into reports (lane_id, reason, detail) select id, $2, $3 from lanes where handle = $1 returning id", [b.lane, b.reason, b.detail ?? null]));
  if (!r.length) throw new HttpError(404, "no_lane", "Galli nahi mili");
  return json({ ok: true }, 201);
});
