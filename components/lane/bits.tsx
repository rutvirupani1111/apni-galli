"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { beacon, useLane, WalkLink, OpenDot, SPRING_UI, calmNow } from "./client";

/** Sticky header: the signboard the shutter's sign lands in. Tapping it on the Gate replays the shutter. */
export function LaneHeader({ name, hi, isDemo }: { name: string; hi?: string; isDemo: boolean }) {
  const { handle, live } = useLane();
  const path = usePathname();
  const onGate = path === `/w/${handle}` || path === `/w/${handle}/`;
  const sign = (
    <span id="header-sign" className="sign inline-flex min-h-11 items-center gap-2 rounded-[4px] border-2 border-[#1e1b18] px-3 text-lg leading-none" style={{ background: "var(--lane-a)", color: "var(--on-lane-a)", boxShadow: "var(--shadow-paper-sm)" }}>
      {name}
      {hi && <span className="hidden text-base opacity-80 sm:inline">{hi}</span>}
    </span>
  );
  return (
    <header className="sticky top-0 z-40 border-b-2 border-[var(--soot)]" style={{ background: "color-mix(in srgb, var(--chalk) 94%, transparent)" }}>
      {isDemo && (
        <p className="mono bg-[#1e1b18] px-4 py-1 text-center text-[0.72rem] uppercase text-[var(--haldi)]">
          Demo galli: yeh dukaan asli nahi hai. <a className="underline" href="/demo/galla">Apni chits yahan dekho</a>
        </p>
      )}
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
        {onGate ? (
          <button type="button" onClick={() => window.dispatchEvent(new Event("galli-replay-shutter"))} aria-label={`${name}: shutter phir se dikhao`}>
            {sign}
          </button>
        ) : (
          <WalkLink href={`/w/${handle}`} label={`${name}: gate pe jao`}>
            {sign}
          </WalkLink>
        )}
        <span className="mono ml-auto flex items-center gap-2 text-[0.78rem]">
          <OpenDot />
          <span className="max-w-[46vw] truncate">{live?.status.short ?? "…"}</span>
        </span>
      </div>
    </header>
  );
}

/** The tin street map plate fixed at the bottom: one icon per building, a brass marker for "you are here". */
export function StreetPlate({ items }: { items: { scene: string; label: string; icon: React.ReactNode }[] }) {
  const { handle } = useLane();
  const path = usePathname();
  const seg = path.split("/")[3] ?? "gate";
  const cur = Math.max(0, items.findIndex((i) => i.scene === seg));
  const [x, setX] = useState(cur);
  useEffect(() => setX(cur), [cur]);
  const href = (s: string) => (s === "gate" ? `/w/${handle}` : `/w/${handle}/${s}`);
  return (
    <nav aria-label="Galli ka naksha" className="tin fixed inset-x-0 bottom-0 z-40 h-14 border-x-0 border-b-0 border-t-2" style={{ borderColor: "#1e1b18" }}>
      <div className="relative mx-auto flex h-full max-w-xl items-stretch" onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          const n = items[cur + (e.key === "ArrowRight" ? 1 : -1)];
          if (n) {
            e.preventDefault();
            (document.querySelector(`[data-plate="${n.scene}"]`) as HTMLElement | null)?.click();
          }
        }
      }}>
        <span
          aria-hidden="true"
          className="absolute top-1 h-1.5 rounded-full"
          style={{ left: `calc(${(x + 0.5) * (100 / items.length)}% - 14px)`, width: 28, background: "#c9962e", border: "1px solid #7a5414", transition: calmNow() ? "none" : `left 330ms ${SPRING_UI}` }}
        />
        {items.map((it) => (
          <WalkLink key={it.scene} href={href(it.scene)} className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 pt-1.5 text-[#1e1b18]" label={it.label}>
            <span data-plate={it.scene} className="contents" />
            <span className="h-5 w-6" aria-hidden="true">
              {it.icon}
            </span>
            <span className="mono hidden max-w-full truncate text-[0.62rem] uppercase sm:block">{it.label}</span>
            <span className="sr-only sm:hidden">{it.label}</span>
            {it.scene === seg && <span className="sr-only">(you are here)</span>}
          </WalkLink>
        ))}
      </div>
    </nav>
  );
}

export function PostboxForm({ handle }: { handle: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "pending" | "confirmed">("idle");
  const [err, setErr] = useState("");
  const [demoLink, setDemoLink] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setErr("Email sahi nahi lag raha");
        setErr("");
        setState("busy");
        try {
          const r = await fetch(`/api/w/${handle}/subscribe`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, website: "" }) });
          const j = await r.json().catch(() => ({}));
          if (!r.ok) {
            setErr(j.error ?? "Nahi hua, dobara try karo");
            setState("idle");
            return;
          }
          setState(j.status);
          setDemoLink(j.confirmUrl);
          beacon(handle, "postbox", "subscribed");
        } catch {
          setErr("Network nahi hai");
          setState("idle");
        }
      }}
    >
      {state === "pending" || state === "confirmed" ? (
        <div role="status" className="chit px-4 pb-4 pt-5 text-[#1e1b18]">
          {state === "confirmed" ? (
            <p className="sign text-xl">Aap pehle se list mein ho.</p>
          ) : (
            <>
              <p className="sign text-xl">Ek aur kadam: email kholo.</p>
              <p className="mt-1 text-sm">Confirm link bheja hai. Click karne ke baad hi postcards aayenge.</p>
              {demoLink && (
                <p className="mt-2 text-sm">
                  Demo galli hai, isliye email nahi gaya.{" "}
                  <a className="mono underline" href={demoLink}>
                    Yahan confirm karo
                  </a>
                </p>
              )}
            </>
          )}
        </div>
      ) : (
        <>
          <label htmlFor="pb-email" className="mono uppercase">
            Aapka email
          </label>
          <input id="pb-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required maxLength={160} />
          {err && <p className="err">{err}</p>}
          <button className="cta" disabled={state === "busy"}>
            {state === "busy" ? "Daal rahe hain…" : "Postcard mangao"}
          </button>
          <p className="text-xs text-[var(--muted)]">Double opt-in: confirm karne tak kuch nahi aayega. Har postcard mein ek click unsubscribe.</p>
        </>
      )}
    </form>
  );
}

/** OpenStreetMap only after a tap, so nothing loads before the visitor asks. */
export function MapTap({ query }: { query: string }) {
  const [state, setState] = useState<"idle" | "loading" | "shown" | "failed">("idle");
  const [src, setSrc] = useState("");
  if (!query) return null;
  const link = `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;
  const show = async () => {
    setState("loading");
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`, { headers: { Accept: "application/json" } });
      const j = (await r.json()) as { lat: string; lon: string }[];
      if (!j[0]) throw new Error("none");
      const lat = Number(j[0].lat);
      const lon = Number(j[0].lon);
      const d = 0.012;
      setSrc(`https://www.openstreetmap.org/export/embed.html?bbox=${lon - d},${lat - d * 0.7},${lon + d},${lat + d * 0.7}&layer=mapnik&marker=${lat},${lon}`);
      setState("shown");
    } catch {
      setState("failed");
    }
  };
  if (state === "shown")
    return (
      <div className="overflow-hidden rounded-md border-2 border-[var(--soot)]">
        <iframe title={`Map: ${query}`} className="h-64 w-full" loading="lazy" src={src} />
        <a className="mono block p-2 underline" href={link} target="_blank" rel="noreferrer">
          OpenStreetMap pe kholo
        </a>
      </div>
    );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="btn" onClick={show} disabled={state === "loading"}>
        {state === "loading" ? "Naksha aa raha hai…" : "Show map"}
      </button>
      {state === "failed" && (
        <a className="mono underline" href={link} target="_blank" rel="noreferrer">
          Naksha nahi mila, OpenStreetMap pe dekho
        </a>
      )}
    </div>
  );
}

export function CtaBeacon({ scene, children, href, className }: { scene: string; children: React.ReactNode; href: string; className?: string }) {
  const { handle } = useLane();
  return (
    <WalkLink href={href} className={className} onWalk={() => beacon(handle, scene, "cta_click")}>
      {children}
    </WalkLink>
  );
}
