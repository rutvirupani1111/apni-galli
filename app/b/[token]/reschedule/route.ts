import { withSystem } from "@/lib/db";

// Signed booking link: opens the lane's counter in reschedule mode. The token itself is checked
// again when the new slot is booked, and the old booking is cancelled in that same transaction.
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[\w-]{16,40}$/.test(token)) return new Response("Not found", { status: 404 });
  const handle = await withSystem(async (q) => {
    const r = await q.query<{ handle: string }>(
      "select l.handle from bookings b join lanes l on l.id = b.lane_id where b.public_token = $1 and b.status in ('pending','confirmed') and lower(b.slot) > now()",
      [token],
    );
    return r[0]?.handle ?? null;
  });
  const to = handle ? `/w/${handle}/counter?reschedule=${token}` : `/c/${token}`;
  return Response.redirect(new URL(to, req.url), 302);
}
