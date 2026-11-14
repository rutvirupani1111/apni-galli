"use client";
// The chit that folds and flies. Validation is inline on blur, never on the first keypress.
// Success is shown only after the server says 201; on a network failure the chit waits on the phone
// (localStorage) and retries with backoff and the same idempotency key.
import { useEffect, useRef, useState } from "react";
import type { ChitField } from "@/lib/doc";
import { beacon, idemKey } from "./client";

type Pending = { handle: string; scene: string; fields: Record<string, string | number>; idem: string; at: number };
const KEY = "galli-pending-chits";

function readPending(): Pending[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}
function writePending(p: Pending[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
}

async function send(p: Pending, file?: File | null) {
  const fd = new FormData();
  fd.set("scene", p.scene);
  fd.set("idem", p.idem);
  fd.set("fields", JSON.stringify(p.fields));
  if (file) fd.set("file", file);
  return fetch(`/api/w/${p.handle}/enquiry`, { method: "POST", body: fd });
}

const BOAT = [
  "M20 10 L180 10 L180 130 L100 130 L20 130 L20 70 Z",
  "M40 70 L160 70 L172 112 L100 112 L28 112 L100 18 Z",
  "M8 78 L192 78 L154 124 L100 124 L46 124 L100 12 Z",
];

export function ChitForm({ handle, scene, fields, prefill, allowFile, title, compact, about }: { handle: string; scene: string; fields: ChitField[]; prefill?: Record<string, string>; allowFile?: boolean; title?: string; compact?: boolean; about?: string }) {
  const [vals, setVals] = useState<Record<string, string | number>>(() => ({ ...(prefill ?? {}) }));
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [serverErr, setServerErr] = useState<{ field?: string; msg: string } | null>(null);
  const [phase, setPhase] = useState<"form" | "sending" | "folding" | "sent" | "waiting">("form");
  const [token, setToken] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const idem = useRef(idemKey());
  const hp = useRef<HTMLInputElement>(null);

  // retry anything left on the phone from an earlier failed send
  useEffect(() => {
    let delay = 2000;
    let timer: number | undefined;
    const flush = async () => {
      const list = readPending().filter((p) => p.handle === handle);
      if (!list.length) return;
      for (const p of list) {
        try {
          const r = await send(p);
          if (r.status === 201 || r.status === 200) {
            const j = await r.json();
            writePending(readPending().filter((x) => x.idem !== p.idem));
            if (p.idem === idem.current) {
              setToken(j.token);
              setPhase("folding");
            }
          } else if (r.status >= 400 && r.status < 500 && r.status !== 429) {
            writePending(readPending().filter((x) => x.idem !== p.idem));
          }
        } catch {
          delay = Math.min(60000, delay * 2);
          timer = window.setTimeout(flush, delay);
          return;
        }
      }
    };
    flush();
    const on = () => flush();
    window.addEventListener("online", on);
    return () => {
      window.removeEventListener("online", on);
      if (timer) window.clearTimeout(timer);
    };
  }, [handle]);

  useEffect(() => {
    if (phase !== "folding") return;
    const reduce = document.documentElement.dataset.calm === "1" || matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = window.setTimeout(() => setPhase("sent"), reduce ? 200 : 950);
    return () => window.clearTimeout(t);
  }, [phase]);

  const errOf = (f: ChitField): string | null => {
    const v = vals[f.key];
    const s = v === undefined ? "" : String(v).trim();
    if (f.required && !s) return "Yeh zaroori hai";
    if (s && f.key === "contact" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) && !/^\+?[\d\s-]{8,15}$/.test(s)) return "Email ya 10 digit number likho";
    if (s && f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) return "Email sahi nahi lag raha";
    if (s && f.type === "phone" && !/^\+?[\d\s-]{8,15}$/.test(s)) return "Number sahi nahi lag raha";
    if (serverErr?.field === f.key) return serverErr.msg;
    return null;
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const all: Record<string, boolean> = {};
    fields.forEach((f) => (all[f.key] = true));
    setTouched(all);
    if (fields.some((f) => errOf(f))) return;
    if (hp.current?.value) return; // honeypot: a bot filled the hidden field
    setServerErr(null);
    setPhase("sending");
    const p: Pending = { handle, scene, fields: about ? { ...vals, about } : vals, idem: idem.current, at: Date.now() };
    try {
      const r = await send(p, file);
      const j = await r.json().catch(() => ({}));
      if (r.status === 201 || r.status === 200) {
        setToken(j.token);
        setPhase("folding");
        beacon(handle, scene, "chit_sent");
        return;
      }
      setPhase("form");
      setServerErr({ field: j.field, msg: j.error ?? "Chit nahi gayi, dobara try karo" });
    } catch {
      writePending([...readPending().filter((x) => x.idem !== p.idem), p]);
      setPhase("waiting");
    }
  }

  if (phase === "folding" || phase === "sent") {
    return (
      <div className="relative overflow-hidden rounded-md p-4" style={{ background: "color-mix(in srgb, var(--paper) 60%, transparent)" }} role="status" aria-live="polite">
        <svg viewBox="0 0 320 150" className="h-32 w-full" aria-hidden="true">
          <g style={{ animation: phase === "folding" ? "boat-sail 300ms 650ms cubic-bezier(.65,0,.35,1) forwards" : undefined, transform: phase === "sent" ? "translateX(170px) scale(.4)" : undefined, transformOrigin: "100px 70px", opacity: phase === "sent" ? 0 : 1 }}>
            <path d={phase === "sent" ? BOAT[2] : BOAT[0]} fill="var(--paper)" stroke="#1e1b18" strokeWidth="2">
              {phase === "folding" && <animate attributeName="d" values={BOAT.join(";")} keyTimes="0;0.5;1" dur="0.6s" fill="freeze" calcMode="spline" keySplines=".65 0 .35 1;.65 0 .35 1" />}
            </path>
          </g>
          <g transform="translate(262 22) scale(.82)">
            <path d="M0 30 a27 27 0 0 1 54 0 v92 h-54z" fill="var(--sindoor)" stroke="#1e1b18" strokeWidth="1.4" />
            <rect x="10" y="44" width="34" height="6" rx="3" fill="#1e1b18" />
          </g>
        </svg>
        <style>{`@keyframes boat-sail{to{transform:translateX(170px) scale(.4);opacity:0}}`}</style>
        {phase === "sent" && (
          <div className="mt-2" style={{ animation: "plane-land 330ms var(--spring-ui) both" }}>
            <p className="sign text-2xl">Chit bhej di.</p>
            <p className="mt-1">
              Status yahan dekho:{" "}
              <a className="mono underline decoration-2 underline-offset-4" href={`/c/${token}`}>
                apni chit kholo
              </a>
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">Owner ke padhte hi &quot;Padha&quot; lag jayega. Link sambhal ke rakho.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className={`chit hand-wrap px-4 pb-4 pt-5 sm:px-5 ${compact ? "" : "max-w-lg"}`} aria-label={title ?? "Enquiry chit"}>
      {title && <p className="sign text-xl text-[#1e1b18]">{title}</p>}
      {about && <p className="mono text-[#4a4038]">ABOUT: {about}</p>}
      {fields.map((f) => {
        const err = touched[f.key] ? errOf(f) : null;
        const id = `chit-${scene}-${f.key}`;
        return (
          <div key={f.key}>
            <label htmlFor={id} className="lbl">
              {f.label}
              {f.required ? " *" : ""}
            </label>
            {f.type === "long" ? (
              <textarea id={id} rows={3} className="field resize-y" value={String(vals[f.key] ?? "")} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })} onBlur={() => setTouched({ ...touched, [f.key]: true })} aria-invalid={!!err} maxLength={2000} />
            ) : f.type === "count" ? (
              <div className="mt-1 flex items-center gap-2">
                <button type="button" className="btn" aria-label={`${f.label} kam karo`} onClick={() => setVals({ ...vals, [f.key]: Math.max(0, Number(vals[f.key] ?? 0) - 1) })}>
                  −
                </button>
                <input id={id} inputMode="numeric" className="field w-20 text-center mono" value={String(vals[f.key] ?? 0)} onChange={(e) => setVals({ ...vals, [f.key]: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
                <button type="button" className="btn" aria-label={`${f.label} badhao`} onClick={() => setVals({ ...vals, [f.key]: Math.min(999, Number(vals[f.key] ?? 0) + 1) })}>
                  +
                </button>
              </div>
            ) : f.type === "chips" ? (
              <div className="mt-1 flex flex-wrap gap-2" role="radiogroup" aria-labelledby={id}>
                <span id={id} className="sr-only">
                  {f.label}
                </span>
                {f.options?.map((o) => (
                  <button key={o} type="button" role="radio" aria-checked={vals[f.key] === o} className="btn" style={vals[f.key] === o ? { background: "var(--lane-a)", color: "var(--on-lane-a)" } : { background: "transparent", color: "#1e1b18", borderColor: "#1e1b18" }} onClick={() => setVals({ ...vals, [f.key]: o })}>
                    {o}
                  </button>
                ))}
              </div>
            ) : (
              <input
                id={id}
                type={f.type === "date" ? "date" : f.type === "email" ? "email" : f.type === "phone" ? "tel" : "text"}
                className="field"
                value={String(vals[f.key] ?? "")}
                onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })}
                onBlur={() => setTouched({ ...touched, [f.key]: true })}
                aria-invalid={!!err}
                autoComplete={f.key === "name" ? "name" : f.key === "contact" ? "email" : "off"}
                maxLength={200}
              />
            )}
            {err && <p className="err mt-1">{err}</p>}
          </div>
        );
      })}
      {allowFile && (
        <div>
          <label className="lbl" htmlFor={`chit-${scene}-file`}>
            Photo ya PDF (1 MB tak, optional)
          </label>
          <input id={`chit-${scene}-file`} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="mt-1 block min-h-11 w-full text-sm text-[#1e1b18]" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {file && file.size > 1048576 && <p className="err">File 1 MB se badi hai</p>}
        </div>
      )}
      <input ref={hp} type="text" name="website" tabIndex={-1} autoComplete="off" className="absolute -left-[9999px] h-px w-px opacity-0" aria-hidden="true" />
      {serverErr && !serverErr.field && <p className="err mt-2">{serverErr.msg}</p>}
      {phase === "waiting" && (
        <p className="mt-3 flex items-center gap-2 text-sm text-[#1e1b18]" role="status">
          <span className="inline-block size-3 rounded-full bg-[var(--haldi)] ring-2 ring-[#1e1b18]" aria-hidden="true" />
          Phone pe rakhi hai, network aate hi bhejenge
        </p>
      )}
      <button type="submit" className="cta mt-4 w-full sm:w-auto" disabled={phase === "sending" || phase === "waiting" || (!!file && file.size > 1048576)}>
        {phase === "sending" ? "Bhej rahe hain…" : "Chit bhejo"}
      </button>
    </form>
  );
}
