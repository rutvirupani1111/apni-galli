"use client";
// Brass token booking. Drag the token from the jar to a free hook, tap a hook, or use the keyboard
// (Left/Right move between free hooks, Up/Down change the day, Enter places). The database's exclusion
// constraint is the final guard: two phones on the same second cannot both win.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addDays, localDate, weekdayOf, WEEKDAYS_SHORT } from "@/lib/time";
import { SPRING_UI, beacon, calmNow } from "./client";

type Svc = { id: string; name: string; minutes: number; capacity: number; price: string | null; auto: boolean };
type SlotT = { start: string; end: string; seatsLeft: number };
type Hold = { holdToken: string; expiresAt: string; start: string; end: string };
type Booked = { publicToken: string; status: string; start: string; end: string; service: string; ics: string; tz: string };

const fmtT = (iso: string, tz?: string) => new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date(iso));
const fmtD = (iso: string, tz?: string) => new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: tz }).format(new Date(iso));

export function Counter({ handle, services, tz, laneName, replaces }: { handle: string; services: Svc[]; tz: string; laneName: string; replaces?: string | null }) {
  const [svc, setSvc] = useState(services[0]?.id ?? "");
  const today = useMemo(() => localDate(new Date(), tz), [tz]);
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(today, i)), [today]);
  const [day, setDay] = useState(today);
  const [slots, setSlots] = useState<SlotT[] | null>(null);
  const [cursor, setCursor] = useState(0);
  const [hold, setHold] = useState<Hold | null>(null);
  const [left, setLeft] = useState(600);
  const [msg, setMsg] = useState("");
  const [shake, setShake] = useState<string | null>(null);
  const [crack, setCrack] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", contact: "", note: "" });
  const [formErr, setFormErr] = useState("");
  const [booked, setBooked] = useState<Booked | null>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const jarRef = useRef<HTMLDivElement>(null);
  const visitorTz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : tz;

  const load = useCallback(async () => {
    if (!svc) return;
    setSlots(null);
    const r = await fetch(`/api/w/${handle}/slots?service=${svc}&date=${day}`, { cache: "no-store" });
    const j = await r.json().catch(() => ({ slots: [] }));
    setSlots(j.slots ?? []);
  }, [handle, svc, day]);
  useEffect(() => {
    load();
  }, [load]);

  const free = useMemo(() => (slots ?? []).map((s, i) => ({ ...s, i })).filter((s) => s.seatsLeft > 0), [slots]);

  useEffect(() => {
    if (!hold) return;
    const tick = () => {
      const s = Math.max(0, Math.round((new Date(hold.expiresAt).getTime() - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) {
        setHold(null);
        setMsg("Token ka time khatam. Dobara hook pe rakho.");
        load();
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [hold, load]);

  const refuse = (slot: SlotT) => {
    setShake(slot.start);
    window.setTimeout(() => setShake(null), 380);
    const next = free.find((f) => f.start > slot.start) ?? free[0];
    setMsg(`${fmtT(slot.start, tz)} pe koi aur hai${next ? `, ${fmtT(next.start, tz)} khali hai` : ", aaj aur khali nahi"}`);
  };

  const place = async (slot: SlotT, fromEl?: HTMLElement | null) => {
    if (busy || hold) return;
    if (slot.seatsLeft <= 0) return refuse(slot);
    setBusy(true);
    setMsg("");
    // the token flies from the jar to the hook
    const hook = railRef.current?.querySelector<HTMLElement>(`[data-slot="${slot.start}"]`);
    const src = (fromEl && fromEl !== hook ? fromEl : jarRef.current)?.getBoundingClientRect();
    const dst = hook?.getBoundingClientRect();
    if (src && dst && hook && !calmNow()) {
      const fly = document.createElement("div");
      Object.assign(fly.style, { position: "fixed", left: dst.left + dst.width / 2 - 11 + "px", top: dst.top + 36 + "px", width: "22px", height: "22px", borderRadius: "50%", background: "#c9962e", border: "2px solid #7a5414", zIndex: "50", pointerEvents: "none" });
      document.body.appendChild(fly);
      fly
        .animate([{ transform: `translate(${src.left + src.width / 2 - (dst.left + dst.width / 2)}px, ${src.top + 14 - (dst.top + 36)}px)` }, { transform: "translate(0,0)" }], { duration: 330, easing: SPRING_UI })
        .finished.then(() => fly.remove(), () => fly.remove());
    }
    try {
      const r = await fetch(`/api/w/${handle}/hold`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ service: svc, start: slot.start, website: "" }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 201) {
        setHold({ holdToken: j.holdToken, expiresAt: j.expiresAt, start: j.start, end: j.end });
        beacon(handle, "counter", "hold");
        setMsg(`${fmtT(slot.start, tz)} ka token aapka hai, 10 minute ke liye`);
      } else if (r.status === 409) {
        setCrack(true);
        window.setTimeout(() => setCrack(false), 450);
        setMsg(j.next ? `Kisi aur ne pehle le liya. ${fmtT(j.next, tz)} khali hai.` : "Kisi aur ne pehle le liya.");
        load();
      } else setMsg(j.error ?? "Token nahi lag paya, dobara try karo");
    } catch {
      setMsg("Network nahi hai. Token jar mein hi hai, dobara try karo.");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hold) return;
    if (form.name.trim().length < 2) return setFormErr("Naam likho");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.contact.trim()) && !/^\+?[\d\s-]{8,15}$/.test(form.contact.trim())) return setFormErr("Email ya WhatsApp number likho");
    setFormErr("");
    setBusy(true);
    try {
      const r = await fetch(`/api/w/${handle}/book`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ holdToken: hold.holdToken, ...form, replaces: replaces ?? null, website: "" }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 201) {
        setBooked(j);
        setHold(null);
        beacon(handle, "counter", "booked");
      } else {
        setFormErr(j.error ?? "Booking nahi hui");
        if (r.status === 410) {
          setHold(null);
          load();
        }
      }
    } catch {
      setFormErr("Network nahi hai, dobara try karo. Token abhi bhi aapka hai.");
    } finally {
      setBusy(false);
    }
  };

  const onRailKey = (e: React.KeyboardEvent) => {
    if (hold) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      if (!free.length) return;
      const pos = free.findIndex((f) => f.i === cursor);
      const nextPos = e.key === "ArrowRight" ? Math.min(free.length - 1, pos + 1) : Math.max(0, pos - 1);
      setCursor(free[pos < 0 ? 0 : nextPos].i);
      railRef.current?.querySelector<HTMLElement>(`[data-i="${free[pos < 0 ? 0 : nextPos].i}"]`)?.scrollIntoView({ inline: "center", block: "nearest" });
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const di = days.indexOf(day) + (e.key === "ArrowDown" ? 1 : -1);
      if (di >= 0 && di < days.length) setDay(days[di]);
    } else if (e.key === "Enter" && slots?.[cursor]) {
      e.preventDefault();
      place(slots[cursor]);
    }
  };

  // pointer drag of the jar token; touch-action none on the token only, so scroll is never blocked
  const onDown = (e: React.PointerEvent) => {
    if (hold || busy) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ x: e.clientX, y: e.clientY });
  };
  const onMove = (e: React.PointerEvent) => drag && setDrag({ x: e.clientX, y: e.clientY });
  const onUp = (e: React.PointerEvent) => {
    if (!drag) return;
    setDrag(null);
    const el = document.elementsFromPoint(e.clientX, e.clientY).find((n) => (n as HTMLElement).dataset?.slot) as HTMLElement | undefined;
    const s = slots?.find((x) => x.start === el?.dataset.slot);
    if (s) place(s, null);
  };

  if (!services.length) return <p className="text-[var(--muted)]">Abhi koi service nahi hai.</p>;

  if (booked) {
    const ownerDiff = booked.tz !== visitorTz;
    const ics = `data:text/calendar;charset=utf-8,${encodeURIComponent(booked.ics)}`;
    const link = `${location.origin}/c/${booked.publicToken}`;
    return (
      <div className="relative mx-auto max-w-md" role="status" aria-live="polite" style={{ animation: "plane-land 330ms var(--spring-soft) both" }}>
        <div className="relative bg-[var(--paper)] p-5 text-[#1e1b18] paper-shadow" style={{ clipPath: "polygon(0 0,100% 0,100% calc(100% - 14px),96% 100%,92% calc(100% - 14px),88% 100%,84% calc(100% - 14px),80% 100%,76% calc(100% - 14px),72% 100%,68% calc(100% - 14px),64% 100%,60% calc(100% - 14px),56% 100%,52% calc(100% - 14px),48% 100%,44% calc(100% - 14px),40% 100%,36% calc(100% - 14px),32% 100%,28% calc(100% - 14px),24% 100%,20% calc(100% - 14px),16% 100%,12% calc(100% - 14px),8% 100%,4% calc(100% - 14px),0 100%)" }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="mono uppercase text-[#4a4038]">{laneName}</p>
              <p className="sign mt-1 text-3xl">{booked.service}</p>
            </div>
            <span className={`stamp stamp-in text-xl ${booked.status === "confirmed" ? "" : "!text-[var(--enamel-blue)]"}`}>{booked.status === "confirmed" ? "PAKKA" : "PENDING"}</span>
          </div>
          <dl className="mono mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-[#4a4038]">DATE</dt>
            <dd>{fmtD(booked.start)}</dd>
            <dt className="text-[#4a4038]">TIME</dt>
            <dd>
              {fmtT(booked.start)} to {fmtT(booked.end)} <span className="text-[#4a4038]">(your time)</span>
            </dd>
            {ownerDiff && (
              <>
                <dt className="text-[#4a4038]">THEIRS</dt>
                <dd>
                  {fmtT(booked.start, booked.tz)} {booked.tz}
                </dd>
              </>
            )}
          </dl>
          <p className="mt-3 text-sm">{booked.status === "confirmed" ? "Slot pakka. Ek din pehle aur 2 ghante pehle yaad dilayenge (agar email diya hai)." : "Owner confirm karenge. Status neeche link pe dikhega."}</p>
          <div className="mt-4 flex flex-wrap gap-2 pb-3">
            <a className="btn" href={ics} download="booking.ics">
              .ics calendar
            </a>
            <a className="btn" href={`https://wa.me/?text=${encodeURIComponent(`${booked.service}, ${fmtD(booked.start)} ${fmtT(booked.start)}: ${link}`)}`} target="_blank" rel="noreferrer">
              WhatsApp share
            </a>
            <a className="btn" href={`/c/${booked.publicToken}`}>
              Status page
            </a>
          </div>
        </div>
      </div>
    );
  }

  const cur = services.find((s) => s.id === svc)!;

  return (
    <div className="space-y-4">
      {/* tin service tags */}
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Service">
        {services.map((s, i) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={svc === s.id}
            onClick={() => {
              setSvc(s.id);
              setHold(null);
            }}
            className="tin relative min-h-11 rounded-sm px-3 py-1.5 text-left transition-transform active:scale-[.97]"
            style={{ transform: `rotate(${(i % 2 ? 1 : -1) * 1.2}deg)`, outline: svc === s.id ? "3px solid var(--lane-a)" : undefined, outlineOffset: 2 }}
          >
            <span className="absolute -top-1.5 left-3 size-2.5 rounded-full border border-[#1e1b18] bg-[var(--chalk)]" aria-hidden="true" />
            <span className="block font-semibold leading-tight">{s.name}</span>
            <span className="mono text-xs">
              {s.minutes} min{s.capacity > 1 ? `, ${s.capacity} seats` : ""}
              {s.price ? `, ${s.price}` : ", free"}
            </span>
          </button>
        ))}
      </div>

      {/* 14-day strip, scrolls inside its own lane */}
      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1" data-noswipe role="tablist" aria-label="Din chuno">
        {days.map((d) => {
          const [, m, dd] = d.split("-").map(Number);
          const sel = d === day;
          return (
            <button
              key={d}
              role="tab"
              aria-selected={sel}
              type="button"
              onClick={() => {
                setDay(d);
                setHold(null);
              }}
              className="flex min-h-14 min-w-12 shrink-0 flex-col items-center justify-center rounded-md border-2 border-[var(--soot)] px-1"
              style={{ background: sel ? "var(--soot)" : "transparent", color: sel ? "var(--chalk)" : "var(--soot)" }}
            >
              <span className="mono text-[0.7rem] uppercase">{d === today ? "Aaj" : WEEKDAYS_SHORT[weekdayOf(d)]}</span>
              <span className="text-lg font-semibold leading-none">{dd}</span>
              <span className="sr-only">month {m}</span>
            </button>
          );
        })}
      </div>

      {/* the jar and the rail of hooks */}
      <div className="hook-board relative rounded-md border-2 border-[#1e1b18] p-3">
        <div className="mb-2 flex items-center gap-3 text-[#fff4e0]">
          <div ref={jarRef} className="relative grid size-14 shrink-0 place-items-center rounded-b-xl rounded-t-md border-2 border-[#77736b] bg-[#d9d6cf]" aria-label="Steel jar with your brass token">
            {!hold && (
              <div
                role="button"
                tabIndex={-1}
                aria-label="Brass token. Drag it to a free hook, or tap a hook."
                className="size-8 cursor-grab rounded-full border-2 border-[#7a5414] bg-[#c9962e] shadow-[inset_0_0_0_3px_#f3d27a] active:cursor-grabbing"
                style={{ touchAction: "none", transform: drag ? `translate(${drag.x - (jarRef.current?.getBoundingClientRect().left ?? 0) - 28}px, ${drag.y - (jarRef.current?.getBoundingClientRect().top ?? 0) - 28}px) scale(1.15)` : undefined, position: drag ? "relative" : undefined, zIndex: 20 }}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
              />
            )}
          </div>
          <p className="text-sm leading-snug">
            {hold ? (
              <>
                Token hook pe hai. Naam likh ke pakka karo, <span className="mono text-[var(--haldi)]">{String(Math.floor(left / 60)).padStart(2, "0")}:{String(left % 60).padStart(2, "0")}</span> mein.
              </>
            ) : (
              <>Token ko khaali hook pe le jao, ya hook pe tap karo. {cur.capacity > 1 ? `Har slot mein ${cur.capacity} seats.` : ""}</>
            )}
          </p>
        </div>
        <div
          ref={railRef}
          tabIndex={0}
          role="listbox"
          aria-label={`Slots on ${day}. Left and right move, up and down change the day, Enter places the token.`}
          aria-activedescendant={slots?.[cursor] ? `hook-${cursor}` : undefined}
          onKeyDown={onRailKey}
          className="no-scrollbar relative overflow-x-auto pb-2 pt-3"
          data-noswipe
        >
          <div className="hook-rod absolute left-0 right-0 top-3 h-3 rounded-full" style={{ minWidth: `${Math.max(1, slots?.length ?? 1) * 76}px` }} aria-hidden="true" />
          <div className="flex gap-2" style={{ minWidth: "max-content" }}>
            {slots === null &&
              Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="flex w-[68px] flex-col items-center pt-3">
                  <div className="skel h-12 w-9 rounded-full" />
                  <div className="skel mt-2 h-3 w-12" />
                </div>
              ))}
            {slots?.length === 0 && <p className="py-6 text-sm text-[#fff4e0]">Is din koi slot nahi. Agla din dekho.</p>}
            {slots?.map((s, i) => {
              const taken = s.seatsLeft <= 0;
              const mine = hold?.start === s.start;
              return (
                <button
                  key={s.start}
                  id={`hook-${i}`}
                  type="button"
                  role="option"
                  aria-selected={cursor === i}
                  aria-label={`${fmtT(s.start, tz)}, ${taken ? "taken" : mine ? "your token" : `${s.seatsLeft} free`}`}
                  data-slot={s.start}
                  data-i={i}
                  onClick={(e) => (taken ? refuse(s) : place(s, e.currentTarget))}
                  className={`hook relative flex w-[68px] shrink-0 flex-col items-center pt-3 ${taken ? "is-taken" : ""} ${shake === s.start ? "shake" : ""}`}
                  style={{ outline: cursor === i && !hold ? "2px dashed var(--haldi)" : undefined, outlineOffset: -2 }}
                >
                  <svg viewBox="0 0 40 52" className="h-12 w-9" aria-hidden="true">
                    <path d="M20 0 v12 q0 8 8 8" fill="none" stroke="#1e1b18" strokeWidth="5" strokeLinecap="round" />
                    <path d="M20 0 v12 q0 8 8 8" fill="none" stroke="#d9b45a" strokeWidth="3" strokeLinecap="round" />
                    {(taken || mine) && (
                      <g style={{ animation: mine && crack ? "shake 120ms 3" : undefined }}>
                        <circle cx="28" cy="34" r="11" fill={taken ? "#8a6a2a" : "#c9962e"} stroke="#7a5414" strokeWidth="1.5" />
                        <circle cx="28" cy="34" r="7" fill="none" stroke="#f3d27a" strokeWidth="1" />
                      </g>
                    )}
                    {!taken && !mine && <circle className="hook-ring" cx="28" cy="34" r="11" fill="none" stroke="#f3d27a" strokeWidth="1.5" strokeDasharray="3 3" />}
                  </svg>
                  <span className="mono mt-1 text-[0.72rem] text-[#fff4e0]">{fmtT(s.start, tz)}</span>
                  {cur.capacity > 1 && !taken && <span className="mono text-[0.62rem] text-[var(--haldi)]">{s.seatsLeft} seats</span>}
                  {taken && <span className="mono text-[0.62rem] uppercase tracking-wider text-[#e9c8a0]">bhara</span>}
                </button>
              );
            })}
          </div>
        </div>
        {crack && <p className="mono mt-1 text-[var(--haldi)]">Token toot gaya: slot chala gaya</p>}
      </div>
      <p className="min-h-6 text-sm" aria-live="polite">
        {msg}
      </p>

      {hold && (
        <form onSubmit={confirm} className="chit max-w-md px-4 pb-4 pt-5" style={{ animation: "plane-land 330ms var(--spring-ui) both" }}>
          <p className="sign text-xl">{fmtD(hold.start, tz)}, {fmtT(hold.start, tz)}</p>
          <label className="lbl" htmlFor="bk-name">
            Naam *
          </label>
          <input id="bk-name" className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" maxLength={80} />
          <label className="lbl" htmlFor="bk-contact">
            WhatsApp ya email *
          </label>
          <input id="bk-contact" className="field" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} autoComplete="email" maxLength={120} />
          <label className="lbl" htmlFor="bk-note">
            Kuch kehna hai? (optional)
          </label>
          <input id="bk-note" className="field" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={300} />
          {formErr && <p className="err mt-2">{formErr}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="cta" disabled={busy}>
              {busy ? "Ho raha hai…" : cur.auto ? "Slot pakka karo" : "Request bhejo"}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                fetch(`/api/w/${handle}/hold`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ holdToken: hold.holdToken }) }).finally(load);
                setHold(null);
                setMsg("Token jar mein wapas");
              }}
            >
              Token wapas
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
