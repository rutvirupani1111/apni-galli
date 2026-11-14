import { redirect } from "next/navigation";
import { currentOwner } from "@/lib/auth";
import { withOwner } from "@/lib/db";
import type { LaneDoc } from "@/lib/doc";
import { Editor } from "@/components/studio/Editor";

export const metadata = { title: "Edit lane", robots: { index: false } };

export default async function Edit({ params }: { params: Promise<{ laneId: string }> }) {
  const { laneId } = await params;
  const me = await currentOwner();
  if (!me) redirect("/login");
  const l = await withOwner(me.id, (q) => q.query<{ handle: string; draft: LaneDoc; draft_version: number; published_version_id: string | null }>("select handle, draft, draft_version, published_version_id from lanes where id = $1", [laneId]));
  return <Editor laneId={laneId} handle={l[0].handle} initial={l[0].draft} version={l[0].draft_version} published={!!l[0].published_version_id} />;
}
