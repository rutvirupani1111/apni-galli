import { z } from "zod";
import { subscribe, HttpError } from "@/lib/visitor";
import { body, honeypot, json, route } from "@/lib/http";
import { clientIp, turnstileOk, visitorWriteAllowed } from "@/lib/ratelimit";
import { withSystem } from "@/lib/db";
import { demoSid } from "@/lib/demo";

const B = z.object({ email: z.string().trim().email().max(160), website: z.string().optional(), turnstile: z.string().optional() });

export const POST = route(async (req: Request, { params }: { params: Promise<{ handle: string }> }) => {
  const { handle } = await params;
  const b = await body(req, B);
  honeypot(b);
  const lane = (await withSystem((q) => q.query<{ id: string; is_demo: boolean }>("select id, is_demo from lanes where handle = $1", [handle])))[0];
  if (!lane) throw new HttpError(404, "no_lane", "Yeh galli nahi mili");
  if (!(await turnstileOk(b.turnstile, clientIp(req)))) throw new HttpError(403, "turnstile", "Bot check fail hua");
  if (!(await visitorWriteAllowed(req, lane.id, "subscribe"))) throw new HttpError(429, "rate", "Thodi der baad try karo");
  return json(await subscribe(handle, b.email, clientIp(req), lane.is_demo ? await demoSid(true) : null), 201);
});
