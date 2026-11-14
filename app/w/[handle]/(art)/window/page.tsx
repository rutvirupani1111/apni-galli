import { notFound } from "next/navigation";
import { loadPublicLane } from "@/lib/lane";
import { WindowScene } from "@/components/lane/scenes";

export const revalidate = 300;
export const metadata = { title: "Shopfront Window" };

export default async function WindowPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const lane = await loadPublicLane(handle);
  if (!lane || !lane.doc.scenes.includes("window")) notFound();
  return <WindowScene lane={lane} />;
}
