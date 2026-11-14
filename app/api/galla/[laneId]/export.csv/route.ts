import { deskFor } from "@/lib/scope";
import { feed } from "@/lib/galla";

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  // neutralise spreadsheet formulas
  const safe = /^[=+\-@]/.test(s) ? "'" + s : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

// CSV of the current view (same filters as the feed).
export async function GET(req: Request, { params }: { params: Promise<{ laneId: string }> }) {
  const { laneId } = await params;
  const desk = await deskFor(laneId);
  if (!desk) return new Response("Login karo", { status: 401 });
  const u = new URL(req.url).searchParams;
  const out = await desk.run((q) => feed(q, desk.scope, { type: u.get("type") ?? "", status: u.get("status") ?? "", q: u.get("q") ?? "", day: (u.get("day") ?? "") as "" }));
  const rows = [["type", "status", "created_at", "name", "contact", "detail", "total_rupees", "when"].join(",")];
  for (const i of out.items) {
    const d = i.data as Record<string, unknown> & { fields?: Record<string, unknown>; service?: { en?: string } };
    const name = d.fields?.name ?? d.name ?? d.email ?? "";
    const contact = d.fields?.contact ?? d.contact ?? d.email ?? "";
    const detail = i.type === "chit" ? (d.lines ? (d.lines as { qty: number; name: string }[]).map((l) => `${l.qty} x ${l.name}`).join("; ") : JSON.stringify(d.fields)) : i.type === "booking" ? d.service?.en : "subscriber";
    const total = typeof d.total === "number" ? (d.total / 100).toFixed(2) : "";
    rows.push([i.type, i.status, i.at, name, contact, detail, total, d.start ?? d.pickup_day ?? ""].map(cell).join(","));
  }
  return new Response(rows.join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="galla-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" },
  });
}
