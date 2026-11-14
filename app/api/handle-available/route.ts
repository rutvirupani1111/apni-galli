import { withSystem } from "@/lib/db";
import { handleAvailable } from "@/lib/lane";
import { json, route } from "@/lib/http";
import { take, clientIp } from "@/lib/ratelimit";
import { ipHash } from "@/lib/crypto";

export const GET = route(async (req: Request) => {
  const h = (new URL(req.url).searchParams.get("h") ?? "").toLowerCase().trim();
  if (!(await take(`ha:${await ipHash(clientIp(req))}`, 60, 60))) return json({ ok: false, why: "Thoda ruko" }, 429);
  return json(await withSystem((q) => handleAvailable(q, h)));
});
