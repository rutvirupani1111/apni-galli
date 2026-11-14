import type { MetadataRoute } from "next";
import { withSystem } from "@/lib/db";
import { baseUrl } from "@/lib/visitor";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = baseUrl();
  const lanes = await withSystem((q) =>
    q.query<{ handle: string; scenes: string[]; updated_at: string }>("select l.handle, v.doc->'scenes' as scenes, l.updated_at from lanes l join lane_versions v on v.id = l.published_version_id where l.suspended_at is null"),
  ).catch(() => []);
  return [
    { url: base, changeFrequency: "weekly" },
    { url: `${base}/galli` },
    ...lanes.flatMap((l) => [{ url: `${base}/w/${l.handle}`, lastModified: new Date(l.updated_at) }, ...l.scenes.map((s) => ({ url: `${base}/w/${l.handle}/${s}`, lastModified: new Date(l.updated_at) }))]),
  ];
}
