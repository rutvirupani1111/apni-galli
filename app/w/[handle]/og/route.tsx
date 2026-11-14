import { ImageResponse } from "next/og";
import { loadPublicLane } from "@/lib/lane";
import { dna } from "@/lib/dna";
import { KIT, TRIADS, onColor } from "@/lib/palette";
import { hoursSummary } from "@/lib/status";
import { SCENE_META } from "@/lib/doc";

// Share image: the facade as flat shapes, the signboard, and the hours as of render. ?format=story is 1080x1920.
export async function GET(req: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const lane = await loadPublicLane(handle);
  if (!lane) return new Response("Not found", { status: 404 });
  const u = new URL(req.url);
  const story = u.searchParams.get("format") === "story";
  const scene = u.searchParams.get("scene") as keyof typeof SCENE_META | null;
  const d = dna(lane.doc.seed, lane.doc.pins);
  const [a, b, c] = TRIADS[d.palette];
  const W = story ? 1080 : 1200;
  const H = story ? 1920 : 630;
  const sub = scene && SCENE_META[scene] ? SCENE_META[scene].name : lane.doc.city || "Apni Galli";
  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", flexDirection: "column", background: "#FFD9A8", position: "relative" }}>
        <div style={{ position: "absolute", left: story ? 340 : 820, top: story ? 140 : 60, width: story ? 160 : 110, height: story ? 160 : 110, borderRadius: 999, background: KIT.haldi }} />
        <div style={{ display: "flex", position: "absolute", left: 0, right: 0, bottom: 0, height: story ? 1180 : 420, background: KIT[c] === KIT.haldi ? "#F5E2BE" : "#F3DDB4", borderTop: "8px solid #7A3B1E" }} />
        <div style={{ display: "flex", position: "absolute", left: story ? 340 : 760, bottom: 0, width: story ? 400 : 300, height: story ? 760 : 330, background: KIT[b], borderTopLeftRadius: 200, borderTopRightRadius: 200, border: "8px solid #1E1B18" }} />
        <div style={{ display: "flex", position: "absolute", left: story ? 80 : 60, top: story ? 420 : 120, width: story ? 920 : 640, padding: "28px 36px", flexDirection: "column", background: KIT[a], border: "6px solid #1E1B18", borderRadius: 10, boxShadow: "10px 12px 0 rgba(122,59,30,.35)" }}>
          <div style={{ fontSize: story ? 104 : 76, color: onColor(a), fontWeight: 800, lineHeight: 1 }}>{lane.doc.name}</div>
          <div style={{ fontSize: story ? 40 : 30, color: onColor(a), marginTop: 12, letterSpacing: 4 }}>{sub.toUpperCase()}</div>
        </div>
        <div style={{ display: "flex", position: "absolute", left: story ? 80 : 60, top: story ? 740 : 330, maxWidth: story ? 920 : 640, fontSize: story ? 44 : 30, color: "#1E1B18" }}>{lane.doc.tagline.slice(0, 110)}</div>
        <div style={{ display: "flex", position: "absolute", left: story ? 80 : 60, bottom: story ? 120 : 50, padding: "10px 18px", background: "#1E1B18", color: KIT.haldi, fontSize: story ? 38 : 26, borderRadius: 8 }}>
          {hoursSummary(lane.hours)} · apnigalli.vercel.app/w/{handle}
        </div>
      </div>
    ),
    { width: W, height: H, headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
