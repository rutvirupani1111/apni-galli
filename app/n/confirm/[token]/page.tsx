import { headers } from "next/headers";
import { withSystem } from "@/lib/db";
import { ipHash, verifyToken } from "@/lib/crypto";

export const dynamic = "force-dynamic";
export const metadata = { title: "Postcard pakka", robots: { index: false } };

// Double opt-in: only this click turns a pending address into a confirmed subscriber, with a consent record.
export default async function Confirm({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const p = await verifyToken<{ s: string; a: string }>(decodeURIComponent(token));
  let out: { name: string; handle: string } | null = null;
  if (p && p.a === "confirm" && /^[0-9a-f-]{36}$/.test(p.s)) {
    const h = await headers();
    const ih = await ipHash((h.get("x-forwarded-for") ?? "local").split(",")[0]);
    out = await withSystem(async (q) => {
      const r = await q.query<{ id: string; owner_id: string; handle: string; name: string }>(
        `update subscribers s set status = 'confirmed', confirmed_at = coalesce(confirmed_at, now()), updated_at = now()
           from lanes l where s.id = $1 and l.id = s.lane_id and s.status <> 'unsubscribed'
         returning s.id, s.owner_id, l.handle, l.draft->>'name' as name`,
        [p.s],
      );
      if (!r[0]) return null;
      await q.query("insert into consents (subscriber_id, owner_id, action, ip_hash, form_version) values ($1,$2,'confirmed',$3,'postbox-v1')", [r[0].id, r[0].owner_id, ih]);
      return { name: r[0].name, handle: r[0].handle };
    });
  }
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      {out ? (
        <>
          <h1 className="mast t-mast">Postcard pakka</h1>
          <p className="mt-3">Ab {out.name} ke postcards aapke paas aayenge. Har postcard mein ek click unsubscribe hai.</p>
          <a className="cta mt-6" href={`/w/${out.handle}`}>
            Galli pe wapas
          </a>
        </>
      ) : (
        <>
          <h1 className="mast t-mast">Link purana hai</h1>
          <p className="mt-3">Yeh confirm link expire ho gaya ya galat hai. Postbox pe dobara email daalo.</p>
        </>
      )}
    </main>
  );
}
