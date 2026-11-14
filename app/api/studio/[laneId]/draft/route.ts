import { z } from "zod";
import { body, json, route } from "@/lib/http";
import { ownLane } from "@/lib/auth";
import { withOwner } from "@/lib/db";
import { LaneDocSchema } from "@/lib/docschema";

// Autosave. If-Match carries the draft version; a stale version (another tab saved first) gets 412 and the
// current draft, so the editor can offer "use theirs" or "keep mine".
export const POST = route(async (req: Request, { params }: { params: Promise<{ laneId: string }> }) => {
  const { laneId } = await params;
  const own = await ownLane(laneId);
  if (!own) return json({ error: "Login karo" }, 401);
  const ifMatch = Number(req.headers.get("if-match"));
  const b = await body(req, z.object({ doc: LaneDocSchema, force: z.boolean().optional() }));
  const r = await withOwner(own.owner.id, async (q) => {
    const up = await q.query<{ draft_version: number }>(
      `update lanes set draft = $2, seed = $3, pins = $4, draft_version = draft_version + 1, updated_at = now()
        where id = $1 and ($5 or draft_version = $6) returning draft_version`,
      [laneId, JSON.stringify(b.doc), b.doc.seed, JSON.stringify(b.doc.pins), !!b.force, Number.isFinite(ifMatch) ? ifMatch : -1],
    );
    if (up[0]) return { ok: true as const, version: up[0].draft_version };
    const cur = await q.query<{ draft: unknown; draft_version: number }>("select draft, draft_version from lanes where id = $1", [laneId]);
    return { ok: false as const, version: cur[0].draft_version, doc: cur[0].draft };
  });
  if (!r.ok) return json({ error: "Doosre tab mein badla hai", version: r.version, doc: r.doc }, 412);
  return json({ version: r.version }, 200, { ETag: String(r.version) });
});
