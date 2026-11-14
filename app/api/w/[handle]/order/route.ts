import { z } from "zod";
import { createOrder, HttpError } from "@/lib/visitor";
import { body, honeypot, json, route } from "@/lib/http";
import { clientIp, turnstileOk, visitorWriteAllowed } from "@/lib/ratelimit";
import { withSystem } from "@/lib/db";
import { demoSid } from "@/lib/demo";
import { orderCode, upiLink, UPI_RE } from "@/lib/money";
import type { LaneDoc } from "@/lib/doc";

const B = z.object({
  lines: z.array(z.object({ item_id: z.string().uuid(), qty: z.number().int().min(1).max(50) })).min(1).max(20),
  pickupDay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().trim().min(2).max(80),
  contact: z.string().trim().min(5).max(120),
  note: z.string().trim().max(300).optional(),
  idem: z.string().min(8).max(64),
  website: z.string().optional(),
  turnstile: z.string().optional(),
});

export const POST = route(async (req: Request, { params }: { params: Promise<{ handle: string }> }) => {
  const { handle } = await params;
  const b = await body(req, B);
  honeypot(b);
  const lane = (await withSystem((q) => q.query<{ id: string; is_demo: boolean; doc: LaneDoc }>("select l.id, l.is_demo, v.doc from lanes l join lane_versions v on v.id = l.published_version_id where l.handle = $1", [handle])))[0];
  if (!lane) throw new HttpError(404, "no_lane", "Yeh galli nahi mili");
  if (!(await turnstileOk(b.turnstile, clientIp(req)))) throw new HttpError(403, "turnstile", "Bot check fail hua");
  if (!(await visitorWriteAllowed(req, lane.id, "order"))) throw new HttpError(429, "rate", "Bahut zyada orders. Thodi der baad try karo.");
  const merged = new Map<string, number>();
  for (const l of b.lines) merged.set(l.item_id, (merged.get(l.item_id) ?? 0) + l.qty);
  const r = await createOrder(handle, { ...b, lines: [...merged].map(([item_id, qty]) => ({ item_id, qty })), demoSid: lane.is_demo ? await demoSid(true) : null });
  const code = orderCode(r.publicToken);
  const vpa = lane.doc.upi.vpa;
  const upi = vpa && UPI_RE.test(vpa) && r.total > 0 ? upiLink({ vpa, name: lane.doc.upi.name || lane.doc.name, paise: r.total, note: `Order ${code}` }) : null;
  return json({ token: r.publicToken, total: r.total, code, upi }, r.replay ? 200 : 201);
});
