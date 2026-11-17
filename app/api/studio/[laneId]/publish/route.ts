import { z } from "zod";
import { body, json, route } from "@/lib/http";
import { ownLane } from "@/lib/auth";
import { withOwner, withSystem } from "@/lib/db";
import { diffSummary, livePlaceholders, type LaneDoc } from "@/lib/doc";
import { revalidateLane, safeUrl } from "@/lib/lane";
import { LaneDocSchema } from "@/lib/docschema";
import { HttpError } from "@/lib/visitor";

async function state(ownerId: string, laneId: string) {
  return withOwner(ownerId, async (q) => {
    const l = await q.query<{ handle: string; draft: LaneDoc; published_version_id: string | null }>("select handle, draft, published_version_id from lanes where id = $1", [laneId]);
    const prev = l[0].published_version_id ? (await q.query<{ doc: LaneDoc }>("select doc from lane_versions where id = $1", [l[0].published_version_id]))[0]?.doc : null;
    return { lane: l[0], prev };
  });
}

// GET: the plain-words diff the publish sheet shows. POST: publish the draft (or restore a version).
export const GET = route(async (_req: Request, { params }: { params: Promise<{ laneId: string }> }) => {
  const { laneId } = await params;
  const own = await ownLane(laneId);
  if (!own) return json({ error: "Login karo" }, 401);
  const { lane, prev } = await state(own.owner.id, laneId);
  const versions = await withOwner(own.owner.id, (q) => q.query("select id, diff_summary, published_at from lane_versions where lane_id = $1 order by published_at desc limit 20", [laneId]));
  return json({ summary: diffSummary(prev ?? null, lane.draft), placeholders: livePlaceholders(lane.draft), versions });
});

export const POST = route(async (req: Request, { params }: { params: Promise<{ laneId: string }> }) => {
  const { laneId } = await params;
  const own = await ownLane(laneId);
  if (!own) return json({ error: "Login karo" }, 401);
  const b = await body(req, z.object({ restore: z.string().uuid().optional() }));
  if (b.restore) {
    const doc = await withOwner(own.owner.id, async (q) => {
      const v = await q.query<{ doc: LaneDoc }>("select doc from lane_versions where id = $1 and lane_id = $2", [b.restore, laneId]);
      if (!v[0]) throw new HttpError(404, "no_version", "Version nahi mila");
      await q.query("update lanes set draft = $2, draft_version = draft_version + 1, updated_at = now() where id = $1", [laneId, JSON.stringify(v[0].doc)]);
      return v[0].doc;
    });
    return json({ restored: true, doc });
  }
  const { lane, prev } = await state(own.owner.id, laneId);
  const parsed = LaneDocSchema.safeParse(lane.draft);
  if (!parsed.success) throw new HttpError(400, "invalid", parsed.error.issues[0]?.message ?? "Draft mein gadbad");
  const left = livePlaceholders(lane.draft);
  if (left.length) throw new HttpError(400, "placeholders", `${left.length} jagah abhi bhi starter text hai (dashed outline). Pehle unhe badlo.`, { placeholders: left });
  // link check on publish: only https, http, mailto, tel, upi and wa.me
  const bad = await withOwner(own.owner.id, (q) => q.query<{ url: string }>("select url from notes where lane_id = $1", [laneId]));
  const badUrl = bad.find((n) => !safeUrl(n.url));
  if (badUrl) throw new HttpError(400, "bad_link", `Yeh link allowed nahi: ${badUrl.url}`);
  // and none may point at a known malware or phishing host (bad_hosts, refreshed daily by the tick)
  const hosts = bad.map((n) => { try { return new URL(n.url).hostname.toLowerCase(); } catch { return ""; } }).filter(Boolean);
  if (hosts.length) {
    const hit = await withSystem((q) => q.query<{ host: string }>("select host from bad_hosts where host = any($1::text[]) limit 1", [hosts]));
    if (hit[0]) throw new HttpError(400, "bad_link", `Yeh link khatarnak list par hai: ${hit[0].host}`);
  }
  const summary = diffSummary(prev ?? null, lane.draft);
  await withOwner(own.owner.id, async (q) => {
    const v = await q.query<{ id: string }>("insert into lane_versions (lane_id, owner_id, doc, diff_summary) values ($1,$2,$3,$4) returning id", [laneId, own.owner.id, JSON.stringify(lane.draft), summary]);
    await q.query("update lanes set published_version_id = $2, seed = (draft->>'seed')::int, pins = draft->'pins', show_remixes = coalesce((draft->>'showRemixes')::boolean, false), updated_at = now() where id = $1", [laneId, v[0].id]);
    // keep the last 20 versions restorable
    await q.query("delete from lane_versions where lane_id = $1 and id not in (select id from lane_versions where lane_id = $1 order by published_at desc limit 20)", [laneId]);
  });
  revalidateLane(lane.handle);
  return json({ summary, handle: lane.handle });
});
