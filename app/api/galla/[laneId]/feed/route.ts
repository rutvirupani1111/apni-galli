import { deskFor } from "@/lib/scope";
import { feed } from "@/lib/galla";
import { json, route } from "@/lib/http";

// Owner inbox delta with ETag. Polled every 15 s while the tab is visible; most replies are 304.
export const GET = route(async (req: Request, { params }: { params: Promise<{ laneId: string }> }) => {
  const { laneId } = await params;
  const desk = await deskFor(laneId);
  if (!desk) return json({ error: "Login karo" }, 401);
  const u = new URL(req.url).searchParams;
  const f = { type: u.get("type") ?? "", status: u.get("status") ?? "", q: (u.get("q") ?? "").slice(0, 80), scene: u.get("scene") ?? "", day: (u.get("day") ?? "") as "" | "today" | "week" };
  const out = await desk.run((q) => feed(q, desk.scope, f));
  if (req.headers.get("if-none-match") === out.etag) return new Response(null, { status: 304, headers: { ETag: out.etag, "Cache-Control": "private, no-cache" } });
  return json({ items: out.items, hisaab: out.hisaab, total: out.total, now: new Date().toISOString() }, 200, { ETag: out.etag, "Cache-Control": "private, no-cache" });
});
