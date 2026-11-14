import { z } from "zod";
import { deskFor } from "@/lib/scope";
import { body, json, route } from "@/lib/http";

const B = z.object({ name: z.string().trim().min(1).max(40), filter: z.object({ type: z.string().max(20), status: z.string().max(20), q: z.string().max(80), day: z.string().max(10) }) });

export const POST = route(async (req: Request, { params }: { params: Promise<{ laneId: string }> }) => {
  const { laneId } = await params;
  const desk = await deskFor(laneId);
  if (!desk || desk.scope.kind !== "owner") return json({ error: "Login karo" }, 401);
  const b = await body(req, B);
  const ownerId = desk.scope.ownerId;
  const r = await desk.run((q) => q.query<{ id: string; name: string; filter: Record<string, string> }>("insert into saved_views (owner_id, lane_id, name, filter) values ($1,$2,$3,$4) returning id, name, filter", [ownerId, laneId, b.name, JSON.stringify(b.filter)]));
  return json({ view: r[0] }, 201);
});
