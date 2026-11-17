import { redirect } from "next/navigation";
import { currentOwner } from "@/lib/auth";
import { withOwner } from "@/lib/db";
import { Galla } from "@/components/galla/Galla";

export const metadata = { title: "Galla", robots: { index: false } };

export default async function GallaPage({ params }: { params: Promise<{ laneId: string }> }) {
  const { laneId } = await params;
  const me = await currentOwner();
  if (!me) redirect("/login");
  const views = await withOwner(me.id, (q) => q.query<{ id: string; name: string; filter: Record<string, string> }>("select id, name, filter from saved_views where lane_id = $1 order by name", [laneId]));
  const lane = await withOwner(me.id, (q) => q.query<{ handle: string }>("select handle from lanes where id = $1", [laneId]));
  return (
    <>
      <h1 className="mast text-4xl">Galla</h1>
      <p className="mb-4 text-[var(--muted)]">Chits, bookings, orders aur subscribers: ek hi desk. Dabao ? shortcuts ke liye.</p>
      <Galla desk={laneId} name="" handle={lane[0]?.handle ?? null} savedViews={views} />
    </>
  );
}
