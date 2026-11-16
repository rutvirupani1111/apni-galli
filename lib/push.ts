// Web Push without a paid realtime service and without a library. The push carries no payload, so
// nothing needs encrypting: it only wakes the owner's service worker, which says "Galla mein kuch
// naya hai" and opens the Galla. The Galla then reads the real rows through its normal feed.
import { createPrivateKey, sign } from "node:crypto";
import type { Q } from "./db";

const b64u = (b: Buffer) => b.toString("base64url");

export const pushPublicKey = () => process.env.VAPID_PUBLIC_KEY || null;

function vapidJwt(audience: string): string | null {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return null;
  const raw = Buffer.from(pub, "base64url");
  if (raw.length !== 65) return null;
  const key = createPrivateKey({
    key: { kty: "EC", crv: "P-256", d: priv, x: b64u(raw.subarray(1, 33)), y: b64u(raw.subarray(33)) },
    format: "jwk",
  });
  const head = b64u(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64u(
    Buffer.from(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: process.env.VAPID_SUBJECT || "mailto:hello@apnigalli.invalid" })),
  );
  const sig = sign("sha256", Buffer.from(`${head}.${body}`), { key, dsaEncoding: "ieee-p1363" });
  return `${head}.${body}.${b64u(sig)}`;
}

/** Wakes every device the lane's owner turned the ghanti on for. Dead subscriptions are removed. */
export async function pushLane(q: Q, laneId: string) {
  if (!pushPublicKey()) return 0;
  const subs = await q.query<{ id: string; endpoint: string }>("select id, endpoint from push_subscriptions where lane_id = $1", [laneId]);
  let sent = 0;
  for (const s of subs) {
    let aud: string;
    try {
      aud = new URL(s.endpoint).origin;
    } catch {
      continue;
    }
    const jwt = vapidJwt(aud);
    if (!jwt) return sent;
    const r = await fetch(s.endpoint, {
      method: "POST",
      headers: { TTL: "3600", Urgency: "high", "Content-Length": "0", Authorization: `vapid t=${jwt}, k=${pushPublicKey()}` },
      signal: AbortSignal.timeout(4000),
    }).catch(() => null);
    if (r && (r.status === 404 || r.status === 410)) await q.query("delete from push_subscriptions where id = $1", [s.id]);
    else if (r?.ok) sent++;
  }
  return sent;
}
