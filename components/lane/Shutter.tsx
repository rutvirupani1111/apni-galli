"use client";
// The shutter that tells the truth. Toranika's door mechanics, kept exactly: overflow is locked only while it
// is down, the button takes focus without scrolling, and a click, Enter/Space/ArrowDown/PageDown/End, a wheel
// (deltaY > 4) or an upward swipe (> 24 px) lifts it. Listeners are passive and go away on open.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { calmNow, saadaNow, useLane } from "./client";

const EASE = "cubic-bezier(.65,0,.35,1)";

export function Shutter({ sign, toran, initialLine, initialOpen, asof, chit, name }: { sign: ReactNode; toran: ReactNode; initialLine: string; initialOpen: boolean; asof: string; chit: ReactNode; name: string }) {
  const { handle, live } = useLane();
  const [state, setState] = useState<"closed" | "opening" | "open">("closed");
  const [slotOpen, setSlotOpen] = useState(false);
  const openedRef = useRef(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const ribsRef = useRef<HTMLDivElement>(null);
  const toranRef = useRef<HTMLDivElement>(null);
  const signRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const line = live?.status.line ?? initialLine;
  const isOpen = live ? live.status.open : initialOpen;

  // in-lane navigation back to the Gate does not replay; a new visit does
  useEffect(() => {
    try {
      if (sessionStorage.getItem(`galli-seen-${handle}`) === "1" && sessionStorage.getItem("galli-from")) {
        openedRef.current = true;
        setState("open");
      }
    } catch {}
  }, [handle]);

  const open = useCallback(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    setState("opening");
    try {
      sessionStorage.setItem(`galli-seen-${handle}`, "1");
    } catch {}
    const done = () => {
      setState("open");
      const h1 = document.querySelector<HTMLElement>("#scene-root h1");
      if (h1) {
        h1.setAttribute("tabindex", "-1");
        h1.focus({ preventScroll: true });
      }
    };
    const root = rootRef.current;
    if (!root) return done();
    if (calmNow() || saadaNow()) {
      root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" }).finished.then(done, done);
      return;
    }
    bodyRef.current?.animate([{ transform: "translateY(0)" }, { transform: "translateY(-100%)" }], { duration: 900, easing: EASE, fill: "forwards" });
    ribsRef.current?.animate([{ transform: "scaleY(1)" }, { transform: "scaleY(.35)" }], { duration: 900, easing: EASE, fill: "forwards" });
    toranRef.current?.animate([{ transform: "translateY(0)" }, { transform: "translateY(-110%)" }], { duration: 900, delay: 150, easing: EASE, fill: "forwards" });
    // the signboard rises into the sticky header (shared element, approximated with a FLIP to the header sign)
    const target = document.getElementById("header-sign")?.getBoundingClientRect();
    const from = signRef.current?.getBoundingClientRect();
    if (target && from && signRef.current) {
      const dx = target.left + target.width / 2 - (from.left + from.width / 2);
      const dy = target.top + target.height / 2 - (from.top + from.height / 2);
      const s = Math.max(0.2, target.width / from.width);
      signRef.current.animate(
        [
          { transform: "translate(0,0) scale(1)", opacity: 1 },
          { transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: 0.2 },
        ],
        { duration: 500, delay: 400, easing: EASE, fill: "forwards" },
      );
    }
    root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, delay: 900, fill: "forwards" }).finished.then(done, done);
  }, [handle]);

  useEffect(() => {
    const replay = () => {
      openedRef.current = false;
      window.scrollTo({ top: 0 });
      setSlotOpen(false);
      setState("closed");
    };
    window.addEventListener("galli-replay-shutter", replay);
    return () => window.removeEventListener("galli-replay-shutter", replay);
  }, []);

  useEffect(() => {
    if (state !== "closed" || slotOpen) return;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    btnRef.current?.focus({ preventScroll: true });
    let touchY = 0;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY > 4) open();
    };
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      if (["ArrowDown", "PageDown", " ", "Enter", "End"].includes(e.key)) {
        if (t.closest("button") && t !== btnRef.current && (e.key === "Enter" || e.key === " ")) return;
        e.preventDefault();
        open();
      }
    };
    const onTs = (e: TouchEvent) => (touchY = e.touches[0].clientY);
    const onTm = (e: TouchEvent) => {
      if (touchY - e.touches[0].clientY > 24) open();
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchstart", onTs, { passive: true });
    window.addEventListener("touchmove", onTm, { passive: true });
    return () => {
      html.style.overflow = prev;
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchstart", onTs);
      window.removeEventListener("touchmove", onTm);
    };
  }, [state, open, slotOpen]);

  useEffect(() => {
    if (!slotOpen) return;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = prev;
    };
  }, [slotOpen]);

  if (state === "open") return null;

  return (
    <div ref={rootRef} role="dialog" aria-modal="true" aria-label={`${name}: shutter`} className="fixed inset-0 z-[70] overflow-hidden" style={{ background: "var(--chalk)" }}>
      <div className="absolute inset-0" style={{ background: "linear-gradient(var(--sky-1), var(--sky-2))" }} />
      {/* the shutter box and the shutter itself */}
      <div className="absolute inset-x-0 top-[30vh] bottom-0">
        <div className="absolute inset-x-0 -top-5 h-6 border-y-2 border-[#1e1b18]" style={{ background: "color-mix(in srgb, var(--tin) 45%, #1e1b18)" }} />
        <div ref={bodyRef} className="absolute inset-0 will-change-transform">
          <div
            ref={ribsRef}
            className="absolute inset-0 origin-top"
            style={{
              backgroundColor: "color-mix(in srgb, var(--tin) 88%, #fff)",
              backgroundImage:
                "repeating-linear-gradient(to bottom, rgba(255,244,224,.35) 0 2px, transparent 2px 7px, color-mix(in srgb, var(--tin) 30%, #1e1b18) 7px 8.6px, transparent 8.6px 15px, color-mix(in srgb, var(--tin) 30%, #1e1b18) 15px 16.6px, transparent 16.6px 23px, color-mix(in srgb, var(--tin) 30%, #1e1b18) 23px 24px)",
            }}
          />
          <div className="relative flex h-full flex-col items-center px-5 pt-[6vh] text-center">
            <p className="mono rounded px-2 py-0.5 uppercase text-[#1e1b18]" style={{ background: "color-mix(in srgb, var(--chalk) 70%, transparent)" }} data-asof={asof}>
              {isOpen ? "Shutter neeche hai, dukaan khuli hai" : "Shutter neeche hai"}
            </p>
            <p className="sign mt-3 max-w-[18ch] text-[clamp(2rem,8.5vw,4.4rem)] leading-[1.02] text-[#1e1b18] [text-shadow:0_2px_0_rgba(255,244,224,.6)]" aria-live="polite">
              {line}
            </p>

            {/* the letterbox: its slot IS the enquiry chit */}
            <div className="relative mt-[4vh] w-full max-w-md">
              {!slotOpen ? (
                <button type="button" onClick={() => setSlotOpen(true)} className="group mx-auto flex min-h-11 w-56 flex-col items-center" aria-expanded="false">
                  <span className="block h-3 w-full rounded-full border-2 border-[#1e1b18] bg-[#1e1b18]" />
                  <span className="mono mt-2 rounded bg-[#1e1b18] px-2 py-1 text-[var(--haldi)] transition-transform group-active:scale-95">Chit daalo</span>
                </button>
              ) : (
                <div className="max-h-[52vh] overflow-y-auto text-left" style={{ animation: "plane-land 330ms var(--spring-ui) both" }} data-noswipe>
                  {chit}
                  <button type="button" className="btn mt-3" onClick={() => setSlotOpen(false)}>
                    Band karo
                  </button>
                </div>
              )}
            </div>

            {!slotOpen && (
              <div className="mt-auto mb-[7vh] flex flex-col items-center">
                <button ref={btnRef} type="button" onClick={open} className="cta" style={{ background: "#1e1b18", color: "var(--haldi)" }}>
                  Shutter uthao
                  <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true">
                    <path d="M10 16V4m0 0-5 5m5-5 5 5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                  </svg>
                </button>
                <p className="mono mt-2 text-[#1e1b18]/75">scroll, swipe up, or press Enter</p>
              </div>
            )}
          </div>
          {/* bottom rail with padlock hasp */}
          <div className="absolute inset-x-0 bottom-0 h-4 border-t-2 border-[#1e1b18]" style={{ background: "color-mix(in srgb, var(--tin) 45%, #1e1b18)" }} />
        </div>
      </div>
      <div ref={signRef} className="absolute inset-x-0 top-[12vh] mx-auto w-[min(92vw,560px)]" aria-hidden="true">
        {sign}
      </div>
      <div ref={toranRef} className="pointer-events-none absolute inset-x-0 top-0 h-[13vh] min-h-20">
        {toran}
      </div>
    </div>
  );
}

export function ReplayShutterButton({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event("galli-replay-shutter"))} aria-label="Shutter phir se dikhao">
      {children}
    </button>
  );
}
