import QRCode from "qrcode";
import { loadPublicLane } from "@/lib/lane";
import { dna } from "@/lib/dna";
import { KIT, TRIADS, onColor } from "@/lib/palette";
import { hoursSummary } from "@/lib/status";
import { baseUrl } from "@/lib/visitor";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

// A printable A5 poster (148 x 210 mm) with the lane's QR code, for counters and stalls.
export async function GET(_req: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const lane = await loadPublicLane(handle);
  if (!lane) return new Response("Not found", { status: 404 });
  const url = `${baseUrl()}/w/${handle}`;
  const qr = await QRCode.toString(url, { type: "svg", margin: 0, color: { dark: "#1E1B18", light: "#FFF4E0" } });
  const inner = qr.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  const vb = /viewBox="([^"]+)"/.exec(qr)?.[1] ?? "0 0 33 33";
  const d = dna(lane.doc.seed, lane.doc.pins);
  const [a, b] = TRIADS[d.palette];
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="148mm" height="210mm" viewBox="0 0 148 210">
  <rect width="148" height="210" fill="#FFF4E0"/>
  <rect x="6" y="6" width="136" height="198" fill="none" stroke="#1E1B18" stroke-width="0.8"/>
  <rect x="14" y="16" width="120" height="34" rx="2" fill="${KIT[a]}" stroke="#1E1B18" stroke-width="0.8"/>
  <rect x="17" y="19" width="114" height="28" rx="1" fill="none" stroke="#FFF4E0" stroke-width="0.8"/>
  <text x="74" y="${lane.doc.nameHi ? 33 : 37}" text-anchor="middle" font-family="Georgia, serif" font-size="11" font-weight="700" fill="${onColor(a)}">${esc(lane.doc.name)}</text>
  ${lane.doc.nameHi ? `<text x="74" y="44" text-anchor="middle" font-family="sans-serif" font-size="6.5" fill="${onColor(a)}">${esc(lane.doc.nameHi)}</text>` : ""}
  <text x="74" y="62" text-anchor="middle" font-family="sans-serif" font-size="5" fill="#1E1B18">${esc(lane.doc.tagline.slice(0, 70))}</text>
  <rect x="34" y="70" width="80" height="80" fill="#FFF4E0" stroke="${KIT[b]}" stroke-width="3"/>
  <svg x="39" y="75" width="70" height="70" viewBox="${vb}">${inner}</svg>
  <text x="74" y="162" text-anchor="middle" font-family="monospace" font-size="5" fill="#1E1B18">SCAN: BOOK, ORDER, OR LEAVE A CHIT</text>
  <text x="74" y="172" text-anchor="middle" font-family="monospace" font-size="4.2" fill="#1E1B18">${esc(url.replace(/^https?:\/\//, ""))}</text>
  <text x="74" y="186" text-anchor="middle" font-family="sans-serif" font-size="4.5" fill="#1E1B18">${esc(hoursSummary(lane.hours))}</text>
  <text x="74" y="198" text-anchor="middle" font-family="sans-serif" font-size="3.5" fill="#7A3B1E">Apni Galli</text>
</svg>`;
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Content-Disposition": `inline; filename="${handle}-poster.svg"`, "Cache-Control": "public, s-maxage=3600" } });
}
