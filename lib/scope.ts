import { currentOwner } from "./auth";
import { withOwner, withSystem, type Q } from "./db";
import { demoSid } from "./demo";
import type { Scope } from "./galla";

export type Desk = { scope: Scope; run: <T>(fn: (q: Q) => Promise<T>) => Promise<T>; label: string };

/** The owner's own desk for a lane, or the visitor's demo desk ("demo"). Null when not allowed. */
export async function deskFor(laneId: string): Promise<Desk | null> {
  if (laneId === "demo") {
    const sid = await demoSid(false);
    if (!sid) return null;
    const lanes = await withSystem((q) => q.query<{ id: string }>("select id from lanes where is_demo"));
    return {
      scope: { kind: "demo", laneIds: lanes.map((l) => l.id), demoSid: sid, tz: "Asia/Kolkata" },
      run: (fn) => withSystem(fn),
      label: "Demo Galla",
    };
  }
  if (!/^[0-9a-f-]{36}$/.test(laneId)) return null;
  const owner = await currentOwner();
  if (!owner) return null;
  const lane = await withOwner(owner.id, (q) => q.query<{ id: string; tz: string; name: string }>("select id, tz, draft->>'name' as name from lanes where id = $1", [laneId]));
  if (!lane[0]) return null;
  return {
    scope: { kind: "owner", laneIds: [laneId], ownerId: owner.id, tz: lane[0].tz },
    run: (fn) => withOwner(owner.id, fn),
    label: lane[0].name,
  };
}
