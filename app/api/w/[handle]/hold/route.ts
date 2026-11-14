import { z } from "zod";
import { createHold, HttpError } from "@/lib/visitor";
import { body, honeypot, json, route } from "@/lib/http";
import { clientIp, turnstileOk, visitorWriteAllowed } from "@/lib/ratelimit";
import { withSystem } from "@/lib/db";
import { demoSid } from "@/lib/demo";

const B = z.object({ service: z.string().uuid(), start: z.string().datetime(), website: z.string().optional(), turnstile: z.string().optional() });

async function laneOf(handle: string) {
  const r = await withSystem((q) => q.query<{ id: string; is_demo: boolean }>("select id, is_demo from lanes where handle = $1", [handle]));
  if (!r[0]) throw new HttpError(404, "no_lane", "Yeh galli nahi mili");
  return r[0];
}

export const POST = route(async (req: Request, { params }: { params: Promise<{ handle: string }> }) => {
  const { handle } = await params;
  const b = await body(req, B);
  honeypot(b);
  const lane = await laneOf(handle);
  if (!(await turnstileOk(b.turnstile, clientIp(req)))) throw new HttpError(403, "turnstile", "Bot check fail hua");
  if (!(await visitorWriteAllowed(req, lane.id, "hold"))) throw new HttpError(429, "rate", "Bahut zyada koshish. Thodi der baad try karo.");
  const sid = lane.is_demo ? await demoSid(true) : null;
  return json(await createHold(handle, b.service, b.start, sid), 201);
});

// "Token wapas": the visitor releases their own hold early.
export const DELETE = route(async (req: Request, { params }: { params: Promise<{ handle: string }> }) => {
  const { handle } = await params;
  const b = await body(req, z.object({ holdToken: z.string().min(10).max(60) }));
  await withSystem((q) => q.query("delete from bookings where hold_token = $1 and status = 'hold' and lane_id = (select id from lanes where handle = $2)", [b.holdToken, handle]));
  return json({ ok: true });
});
