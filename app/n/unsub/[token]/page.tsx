import { headers } from "next/headers";
import { withSystem } from "@/lib/db";
import { ipHash, verifyToken } from "@/lib/crypto";

export const dynamic = "force-dynamic";
export const metadata = { title: "Unsubscribed", robots: { index: false } };

async function unsub(sid: string) {
  const h = await headers();
  const ih = await ipHash((h.get("x-forwarded-for") ?? "local").split(",")[0]);
  return withSystem(async (q) => {
    const r = await q.query<{ id: string; owner_id: string; name: string }>(
      `update subscribers s set status = 'unsubscribed', updated_at = now() from lanes l
        where s.id = $1 and l.id = s.lane_id returning s.id, s.owner_id, l.draft->>'name' as name`,
      [sid],
    );
    if (!r[0]) return null;
    await q.query("insert into consents (subscriber_id, owner_id, action, ip_hash, form_version) values ($1,$2,'unsubscribed',$3,'postbox-v1')", [r[0].id, r[0].owner_id, ih]);
    return r[0].name;
  });
}

// One click, no login, no "are you sure". (List-Unsubscribe-Post also lands on this path.)
export default async function Unsub({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const p = await verifyToken<{ s: string; a: string }>(decodeURIComponent(token));
  const name = p && p.a === "unsub" && /^[0-9a-f-]{36}$/.test(p.s) ? await unsub(p.s) : null;
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="mast t-mast">{name ? "Ho gaya" : "Link galat hai"}</h1>
      <p className="mt-3">{name ? `${name} ke postcards ab nahi aayenge.` : "Yeh unsubscribe link sahi nahi hai."}</p>
    </main>
  );
}
