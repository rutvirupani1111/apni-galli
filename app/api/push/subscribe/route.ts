import { z } from "zod";
import { deskFor } from "@/lib/scope";
import { body, json, route } from "@/lib/http";
import { pushPublicKey } from "@/lib/push";

const Sub = z.object({
  laneId: z.string().uuid(),
  endpoint: z.string().url().max(800).startsWith("https://"),
  keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
});
const Del = z.object({ laneId: z.string().uuid(), endpoint: z.string().url().max(800) });

export const GET = route(async () => json({ key: pushPublicKey() }));

export const POST = route(async (req: Request) => {
  if (!pushPublicKey()) return json({ error: "Push is not set up on this server" }, 503);
  const b = await body(req, Sub);
  const desk = await deskFor(b.laneId);
  if (!desk || desk.scope.kind !== "owner") return json({ error: "Login karo" }, 401);
  const ownerId = desk.scope.ownerId;
  await desk.run((q) =>
    q.query(
      `insert into push_subscriptions (owner_id, lane_id, endpoint, keys) values ($1,$2,$3,$4)
       on conflict (endpoint) do update set lane_id = excluded.lane_id, keys = excluded.keys
       where push_subscriptions.owner_id = excluded.owner_id`,
      [ownerId, b.laneId, b.endpoint, JSON.stringify(b.keys)],
    ),
  );
  return json({ ok: true }, 201);
});

export const DELETE = route(async (req: Request) => {
  const b = await body(req, Del);
  const desk = await deskFor(b.laneId);
  if (!desk || desk.scope.kind !== "owner") return json({ error: "Login karo" }, 401);
  await desk.run((q) => q.query("delete from push_subscriptions where endpoint = $1 and lane_id = $2", [b.endpoint, b.laneId]));
  return json({ ok: true });
});
