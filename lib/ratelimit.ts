import { withSystem } from "./db";
import { ipHash } from "./crypto";

/** Postgres token bucket in one statement. Returns true when the request may proceed. */
export async function take(key: string, capacity: number, perSeconds: number): Promise<boolean> {
  const rate = capacity / perSeconds;
  const r = await withSystem((q) =>
    q.query<{ tokens: number }>(
      `insert into rate_buckets (key, tokens, refilled_at) values ($1, $2::real - 1, now())
       on conflict (key) do update set
         tokens = greatest(-1, least($2::real, rate_buckets.tokens + extract(epoch from (now() - rate_buckets.refilled_at)) * $3::real) - 1),
         refilled_at = now()
       returning tokens`,
      [key, capacity, rate],
    ),
  );
  return (r[0]?.tokens ?? -1) >= 0;
}

export function clientIp(req: Request) {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

/** Visitor write limits: 5 per IP hash per lane per 10 minutes, and 50 per lane per hour. */
export async function visitorWriteAllowed(req: Request, laneId: string, route: string) {
  const ih = await ipHash(clientIp(req));
  const a = await take(`v:${ih}:${laneId}:${route}`, 5, 600);
  if (!a) return false;
  return take(`lane:${laneId}:${route}`, 50, 3600);
}

export async function turnstileOk(token: string | undefined, ip: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // not configured: honeypot + rate limits still apply
  if (!token) return false;
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret, response: token, remoteip: ip }),
  }).catch(() => null);
  if (!r) return false;
  const j = (await r.json().catch(() => ({}))) as { success?: boolean };
  return !!j.success;
}
