import { notFound } from "next/navigation";
import { loadPublicLane } from "@/lib/lane";
import { KitDefs } from "@/components/art/kit";
import { triadVars } from "@/lib/palette";
import { DeviceToggles, LaneProvider } from "@/components/lane/client";
import { LaneHeader, StreetPlate } from "@/components/lane/bits";
import { laneDna, plateItems, sceneOrder } from "@/components/lane/server";

export const revalidate = 300;

export default async function LaneLayout({ children, params }: { children: React.ReactNode; params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const lane = await loadPublicLane(handle);
  if (!lane) notFound();
  if (lane.suspended) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <h1 className="mast t-mast">Yeh galli band hai</h1>
        <p className="mt-4">This lane has been suspended after a report. If you own it, write to the Apni Galli team from your account email.</p>
      </main>
    );
  }
  const d = laneDna(lane);
  return (
    <div style={triadVars(d.palette) as React.CSSProperties} className="min-h-dvh pb-16">
      <KitDefs awning={d.awning} />
      <LaneProvider handle={lane.handle} scenes={sceneOrder(lane)}>
        <LaneHeader name={lane.doc.name} hi={lane.doc.nameHi} isDemo={lane.isDemo} />
        {children}
        <footer className="mx-auto mt-16 max-w-6xl px-4 pb-10">
          <div className="tin flex flex-col gap-4 rounded-md p-4 sm:flex-row sm:items-center sm:justify-between" style={{ boxShadow: "var(--shadow-paper)" }}>
            <div>
              <p className="sign text-xl">Apni Galli banao</p>
              <p className="text-sm">Is galli ka dhaancha le lo, apna saaman daalo. Text, photos, prices kabhi copy nahi hote.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <a className="btn" href={`/try?remix=${lane.handle}`}>
                  Remix this lane
                </a>
                <a className="btn" href={`/w/${lane.handle}/map`}>
                  Cover wall
                </a>
                <a className="btn" href={`/w/${lane.handle}/plain`}>
                  Plain Lane
                </a>
              </div>
              {lane.remixes !== null && <p className="mono mt-2 text-xs">{lane.remixes} remixes</p>}
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <DeviceToggles />
              <p className="text-xs">
                <a className="underline" href={`/report?lane=${lane.handle}`}>
                  Report this lane
                </a>{" "}
                · <a className="underline" href="/privacy">Privacy</a> · <a className="underline" href="/">Apni Galli</a>
              </p>
            </div>
          </div>
        </footer>
        <StreetPlate items={plateItems(lane)} />
      </LaneProvider>
    </div>
  );
}
