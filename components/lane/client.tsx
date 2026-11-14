"use client";
// Small visitor islands. No animation library: WAAPI and CSS springs keep the visitor bundle small.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export type LiveState = {
  status: { open: boolean; line: string; short: string; reason: string };
  freeToday: number | null;
  stock: Record<string, number>;
  asof: string;
};

type Ctx = {
  handle: string;
  scenes: string[]; // gate first
  live: LiveState | null;
  refreshLive: () => void;
  walk: (href: string, from?: HTMLElement | null, dir?: "in" | "left" | "right") => void;
};
const LaneCtx = createContext<Ctx | null>(null);
export const useLane = () => useContext(LaneCtx)!;

export const SPRING_UI = "linear(0.001, 0.027, 0.078, 0.147, 0.239, 0.324, 0.408, 0.49, 0.568, 0.639, 0.714, 0.77, 0.819, 0.861, 0.896, 0.926, 0.95, 0.972, 0.987, 0.998, 1.007, 1.013, 1.017, 1.019, 1.02, 1.02, 1.019, 1.018, 1.017, 1.015, 1.013, 1.011, 1)";
export const SPRING_SOFT = "linear(0.001, 0.016, 0.047, 0.089, 0.14, 0.205, 0.264, 0.323, 0.383, 0.44, 0.495, 0.547, 0.596, 0.649, 0.69, 0.728, 0.762, 0.793, 0.821, 0.846, 0.868, 0.891, 0.907, 0.922, 0.935, 0.946, 0.956, 0.964, 0.971, 0.978, 0.983, 0.987, 1)";

export function calmNow() {
  if (typeof window === "undefined") return false;
  return document.documentElement.dataset.calm === "1" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
export function saadaNow() {
  return typeof document !== "undefined" && document.documentElement.dataset.saada === "1";
}

export function beacon(handle: string, scene: string, event: string, from?: string) {
  try {
    const body = JSON.stringify({ lane: handle, scene, event, from });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/beacon", new Blob([body], { type: "application/json" }));
    else fetch("/api/beacon", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } });
  } catch {
    /* analytics never breaks the lane */
  }
}

export function LaneProvider({ handle, scenes, children }: { handle: string; scenes: string[]; children: ReactNode }) {
  const router = useRouter();
  const [live, setLive] = useState<LiveState | null>(null);
  const walking = useRef<{ href: string } | null>(null);

  const refreshLive = useCallback(() => {
    fetch(`/api/w/${handle}/live`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setLive(j))
      .catch(() => {});
  }, [handle]);

  useEffect(() => {
    // the live island loads after first paint; the page itself is never re-rendered for it
    const id = window.requestIdleCallback ? window.requestIdleCallback(refreshLive, { timeout: 1200 }) : window.setTimeout(refreshLive, 300);
    const prefetch = () => scenes.forEach((s) => router.prefetch(s === "gate" ? `/w/${handle}` : `/w/${handle}/${s}`));
    const pid = window.requestIdleCallback ? window.requestIdleCallback(prefetch) : window.setTimeout(prefetch, 1500);
    return () => {
      if (window.cancelIdleCallback) {
        window.cancelIdleCallback(id as number);
        window.cancelIdleCallback(pid as number);
      }
    };
  }, [refreshLive, router, scenes, handle]);

  const walk = useCallback(
    (href: string, from?: HTMLElement | null, dir: "in" | "left" | "right" = "in") => {
      if (walking.current) {
        // a second tap during the walk jumps to the end state
        router.push(walking.current.href, { scroll: false });
        return;
      }
      const root = document.getElementById("scene-root");
      try {
        sessionStorage.setItem("galli-from", location.pathname.split("/")[3] ?? "gate");
        sessionStorage.setItem("galli-walk", dir);
      } catch {}
      if (!root) {
        router.push(href);
        return;
      }
      walking.current = { href };
      const go = () => {
        router.push(href, { scroll: false });
        window.scrollTo({ top: 0 });
        window.setTimeout(() => (walking.current = null), 400);
      };
      if (calmNow() || saadaNow()) {
        const slide = saadaNow() && !calmNow() ? [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateX(-24px)" }] : [{ opacity: 1 }, { opacity: 0 }];
        root.animate(slide, { duration: 200, easing: "ease-out", fill: "forwards" }).finished.then(go, go);
        return;
      }
      if (dir === "left" || dir === "right") {
        const x = dir === "left" ? "-100%" : "100%";
        root.animate([{ transform: "none" }, { transform: `translateX(${x})` }], { duration: 330, easing: SPRING_UI, fill: "forwards" });
        root.querySelectorAll<HTMLElement>(".plane").forEach((p, i) => p.animate([{ translate: "0 0" }, { translate: `${dir === "left" ? -12 : 12}px 0` }], { duration: 300, delay: (i % 5) * 30, fill: "forwards" }));
        window.setTimeout(go, 300);
        return;
      }
      // Galli Walk: press the door, dolly the camera into it while the two leaves swing open
      const r = (from ?? root).getBoundingClientRect();
      const rr = root.getBoundingClientRect();
      const ox = ((r.left + r.width / 2 - rr.left) / rr.width) * 100;
      const oy = ((r.top + r.height / 2 - rr.top) / rr.height) * 100;
      root.style.transformOrigin = `${ox}% ${oy}%`;
      from?.animate([{ transform: "scale(1)" }, { transform: "scale(.97)" }], { duration: 120, fill: "forwards" });
      const doors = document.createElement("div");
      doors.setAttribute("aria-hidden", "true");
      Object.assign(doors.style, { position: "fixed", left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px", perspective: "1600px", zIndex: "60", pointerEvents: "none" });
      const leaf = (side: "l" | "r") => {
        const d = document.createElement("div");
        Object.assign(d.style, {
          position: "absolute",
          top: "0",
          bottom: "0",
          width: "50%",
          [side === "l" ? "left" : "right"]: "0",
          transformOrigin: side === "l" ? "left center" : "right center",
          background: "var(--lane-b)",
          border: "2px solid #1e1b18",
          backgroundImage: "repeating-linear-gradient(90deg, transparent 0 9px, rgba(0,0,0,.12) 9px 10px)",
        });
        doors.appendChild(d);
        return d;
      };
      const L = leaf("l");
      const R = leaf("r");
      document.body.appendChild(doors);
      const ease = "cubic-bezier(.65,0,.35,1)";
      L.animate([{ transform: "rotateY(0)" }, { transform: "rotateY(-104deg)" }], { duration: 600, delay: 120, easing: ease, fill: "forwards" });
      R.animate([{ transform: "rotateY(0)" }, { transform: "rotateY(104deg)" }], { duration: 600, delay: 120, easing: ease, fill: "forwards" });
      root.querySelectorAll<HTMLElement>(".plane-4").forEach((p) => p.animate([{ translate: "0 0" }, { translate: "0 -30px" }], { duration: 600, delay: 120, easing: ease, fill: "forwards" }));
      root.animate([{ transform: "scale(1)", opacity: 1 }, { transform: "scale(1.9)", opacity: 0.15 }], { duration: 600, delay: 120, easing: ease, fill: "forwards" });
      window.setTimeout(() => {
        go();
        doors.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: "forwards" }).finished.then(() => doors.remove());
      }, 560);
    },
    [router],
  );

  return <LaneCtx.Provider value={{ handle, scenes, live, refreshLive, walk }}>{children}</LaneCtx.Provider>;
}

/** A real <a href> that walks instead of jumping. Modifier clicks behave like normal links. */
export function WalkLink({ href, children, className, dir, style, label, onWalk }: { href: string; children: ReactNode; className?: string; dir?: "in" | "left" | "right"; style?: React.CSSProperties; label?: string; onWalk?: () => void }) {
  const { walk } = useLane();
  return (
    <a
      href={href}
      className={className}
      style={style}
      aria-label={label}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        onWalk?.();
        walk(href, e.currentTarget, dir);
      }}
    >
      {children}
    </a>
  );
}

/** Scene root: lands the planes, moves focus to the h1, tilts the planes under the pointer, and listens for swipes. */
export function SceneRoot({ scene, children, className }: { scene: string; children: ReactNode; className?: string }) {
  const { handle, scenes, walk } = useLane();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let from: string | undefined;
    let walked = false;
    try {
      from = sessionStorage.getItem("galli-from") ?? undefined;
      walked = !!sessionStorage.getItem("galli-walk");
      sessionStorage.removeItem("galli-walk");
    } catch {}
    beacon(handle, scene, "view", from && from !== scene ? from : undefined);
    try {
      sessionStorage.setItem("galli-from", scene);
    } catch {}
    if (walked) {
      const h1 = ref.current?.querySelector("h1");
      if (h1) {
        h1.setAttribute("tabindex", "-1");
        h1.focus({ preventScroll: true });
      }
    }
  }, [handle, scene]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const idx = scenes.indexOf(scene);
    const hrefOf = (s: string) => (s === "gate" ? `/w/${handle}` : `/w/${handle}/${s}`);
    let sx = 0;
    let sy = 0;
    let t0 = 0;
    const ts = (e: TouchEvent) => {
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
      t0 = Date.now();
    };
    const te = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      if (Date.now() - t0 > 800) return;
      const target = e.target as HTMLElement;
      if (target.closest("[data-noswipe]")) return;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        const next = dx < 0 ? scenes[idx + 1] : scenes[idx - 1];
        if (next) walk(hrefOf(next), null, dx < 0 ? "left" : "right");
      }
    };
    el.addEventListener("touchstart", ts, { passive: true });
    el.addEventListener("touchend", te, { passive: true });
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || saadaNow() || calmNow()) return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.querySelectorAll<HTMLElement>(".planes").forEach((p) => {
        p.style.setProperty("--ry", `${(px * 6).toFixed(2)}deg`);
        p.style.setProperty("--rx", `${(-py * 4).toFixed(2)}deg`);
      });
    };
    const leave = () => el.querySelectorAll<HTMLElement>(".planes").forEach((p) => (p.style.cssText = p.style.cssText.replace(/--r[xy]:[^;]+;?/g, "")));
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("touchstart", ts);
      el.removeEventListener("touchend", te);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [scenes, scene, handle, walk]);

  return (
    <div id="scene-root" ref={ref} className={`scene-root scene-enter land ${className ?? ""}`} data-scene={scene}>
      {children}
    </div>
  );
}

/** Live cover lines and status: static text from the render, replaced only if the island says otherwise. */
export function LiveText({ kind, item, fallback, className }: { kind: "line" | "short" | "free" | "stock"; item?: string; fallback: string; className?: string }) {
  const { live } = useLane();
  let text = fallback;
  if (live) {
    if (kind === "line") text = live.status.line;
    if (kind === "short") text = live.status.short;
    if (kind === "free" && live.freeToday !== null) text = live.freeToday === 0 ? "Aaj sab bhar gaya" : `${live.freeToday} slot${live.freeToday > 1 ? "s" : ""} aaj`;
    if (kind === "stock" && item && live.stock[item] !== undefined) text = live.stock[item] <= 0 ? "Aaj khatam" : `${live.stock[item]} bache`;
  }
  return (
    <span className={className} style={{ transition: "opacity 150ms" }} key={text}>
      {text}
    </span>
  );
}

export function OpenDot() {
  const { live } = useLane();
  const open = live?.status.open;
  return (
    <span
      aria-hidden="true"
      className="inline-block size-2.5 rounded-full border border-[#1e1b18]"
      style={{ background: open === undefined ? "var(--tin)" : open ? "var(--mint-enamel)" : "var(--sindoor)", boxShadow: open ? "0 0 0 3px color-mix(in srgb, var(--mint-enamel) 40%, transparent)" : undefined }}
    />
  );
}

/** Footer toggles: Calm (reduced motion) and Saada (low power), stored per device. */
export function DeviceToggles() {
  const [calm, setCalm] = useState(false);
  const [saada, setSaada] = useState(false);
  useEffect(() => {
    setCalm(document.documentElement.dataset.calm === "1");
    setSaada(document.documentElement.dataset.saada === "1");
    // a long animation frame in the first 3 s turns Saada on for this device
    if (typeof PerformanceObserver !== "undefined" && PerformanceObserver.supportedEntryTypes?.includes("long-animation-frame")) {
      const t0 = performance.now();
      const po = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (e.duration > 100 && performance.now() - t0 < 3000) {
            let pref: string | null = null;
            try {
              pref = localStorage.getItem("galli-saada");
            } catch {}
            if (pref === null) {
              document.documentElement.dataset.saada = "1";
              setSaada(true);
            }
            po.disconnect();
          }
        }
      });
      po.observe({ type: "long-animation-frame", buffered: true });
      const id = window.setTimeout(() => po.disconnect(), 3000);
      return () => {
        po.disconnect();
        window.clearTimeout(id);
      };
    }
  }, []);
  const set = (k: "calm" | "saada", v: boolean) => {
    const d = document.documentElement.dataset;
    if (v) d[k] = "1";
    else delete d[k];
    try {
      localStorage.setItem(`galli-${k}`, v ? "1" : "0");
    } catch {}
    if (k === "calm") setCalm(v);
    else setSaada(v);
  };
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn" aria-pressed={calm} onClick={() => set("calm", !calm)}>
        Calm {calm ? "on" : "off"}
      </button>
      <button type="button" className="btn" aria-pressed={saada} onClick={() => set("saada", !saada)} title="Saada: low-power mode, no filters or tilt">
        Saada {saada ? "on" : "off"}
      </button>
    </div>
  );
}

export function Beacon({ handle, scene, event }: { handle: string; scene: string; event: string }) {
  useEffect(() => beacon(handle, scene, event), [handle, scene, event]);
  return null;
}

/** Stable per-browser key for idempotent visitor writes. */
export function idemKey() {
  return (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/-/g, "");
}
