import { z } from "zod";
import { deskFor } from "@/lib/scope";
import { applyOps } from "@/lib/galla";
import { body, json, route } from "@/lib/http";
import { withSystem } from "@/lib/db";
import { revalidateLane } from "@/lib/lane";

const Op = z.object({
  op_id: z.string().regex(/^[\w-]{8,64}$/),
  kind: z.enum(["read", "reply", "confirm", "decline", "paid", "done", "archive", "restore", "block"]),
  type: z.enum(["chit", "booking", "subscriber"]),
  id: z.string().uuid(),
  payload: z.object({ body: z.string().max(4000).optional(), reason: z.string().max(200).optional(), status: z.string().max(20).optional() }).optional(),
});
const B = z.object({ ops: z.array(Op).min(1).max(50) });

// Batched owner actions. Each op_id is applied once; a replay returns ok without applying again.
export const POST = route(async (req: Request, { params }: { params: Promise<{ laneId: string }> }) => {
  const { laneId } = await params;
  const desk = await deskFor(laneId);
  if (!desk) return json({ error: "Login karo" }, 401);
  const b = await body(req, B);
  const results = await desk.run((q) => applyOps(q, desk.scope, b.ops));
  // a decline or restore can change stock or free slots on the public lane
  if (b.ops.some((o) => ["decline", "restore", "confirm"].includes(o.kind))) {
    const h = await withSystem((q) => q.query<{ handle: string }>("select handle from lanes where id = any($1::uuid[])", [desk.scope.laneIds]));
    h.forEach((x) => revalidateLane(x.handle));
  }
  return json({ results });
});
