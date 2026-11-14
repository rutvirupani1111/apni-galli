import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadPublicLane, type PublicLane } from "@/lib/lane";
import { SCENES, type SceneSlug } from "@/lib/dna";
import { SCENE_META } from "@/lib/doc";
import { CounterScene, LoftScene, MenuScene, NoticeScene, PostboxScene, RooftopScene, WindowScene } from "@/components/lane/scenes";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ handle: string; scene: string }> }): Promise<Metadata> {
  const { handle, scene } = await params;
  const lane = await loadPublicLane(handle);
  if (!lane || !SCENES.includes(scene as SceneSlug)) return {};
  const m = SCENE_META[scene as SceneSlug];
  return { title: `${m.name}: ${lane.doc.name}`, description: `${m.verb}. ${lane.doc.tagline}`, openGraph: { images: [`/w/${handle}/og?scene=${scene}`] } };
}

function SceneSwitch({ lane, scene }: { lane: PublicLane; scene: SceneSlug }) {
  switch (scene) {
    case "window":
      return <WindowScene lane={lane} />;
    case "counter":
      return <CounterScene lane={lane} />;
    case "menu":
      return <MenuScene lane={lane} />;
    case "postbox":
      return <PostboxScene lane={lane} />;
    case "notice":
      return <NoticeScene lane={lane} />;
    case "loft":
      return <LoftScene lane={lane} />;
    case "rooftop":
      return <RooftopScene lane={lane} />;
  }
}

export default async function ScenePage({ params }: { params: Promise<{ handle: string; scene: string }> }) {
  const { handle, scene } = await params;
  const lane = await loadPublicLane(handle);
  if (!lane || !SCENES.includes(scene as SceneSlug) || !lane.doc.scenes.includes(scene as SceneSlug)) notFound();
  return <SceneSwitch lane={lane} scene={scene as SceneSlug} />;
}
