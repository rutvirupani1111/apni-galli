import { deskFor } from "@/lib/scope";

// The attachment on a chit, for the owner only (RLS limits the read to their rows).
export async function GET(_req: Request, { params }: { params: Promise<{ laneId: string; chitId: string }> }) {
  const { laneId, chitId } = await params;
  const desk = await deskFor(laneId);
  if (!desk || !/^[0-9a-f-]{36}$/.test(chitId)) return new Response("Not found", { status: 404 });
  const r = await desk.run((q) =>
    q.query<{ data: Uint8Array; mime: string }>(
      "select a.data, a.mime from attachments a join chits c on c.id = a.chit_id where a.chit_id = $1 and c.lane_id = any($2::uuid[]) and ($3::text is null or c.demo_sid = $3)",
      [chitId, desk.scope.laneIds, desk.scope.kind === "demo" ? desk.scope.demoSid : null],
    ),
  );
  if (!r[0]) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(r[0].data), { headers: { "Content-Type": r[0].mime, "Cache-Control": "private, no-store", "Content-Disposition": "inline", "X-Content-Type-Options": "nosniff" } });
}
