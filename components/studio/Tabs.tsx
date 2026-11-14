"use client";
import { usePathname } from "next/navigation";

export function StudioTabs({ laneId, handle, live }: { laneId: string; handle: string; live: boolean }) {
  const path = usePathname();
  const tabs = [
    ["galla", "Galla"],
    ["edit", "Edit"],
    ["settings", "Settings"],
    ["insights", "Insights"],
  ];
  return (
    <nav className="no-scrollbar flex flex-1 gap-1 overflow-x-auto" aria-label="Studio">
      {tabs.map(([k, l]) => (
        <a key={k} href={`/studio/${laneId}/${k}`} className="btn shrink-0" aria-current={path.endsWith(`/${k}`) ? "page" : undefined} aria-pressed={path.endsWith(`/${k}`)}>
          {l}
        </a>
      ))}
      {live && (
        <a href={`/w/${handle}`} className="btn ml-auto shrink-0" target="_blank" rel="noreferrer">
          Live /w/{handle}
        </a>
      )}
    </nav>
  );
}
