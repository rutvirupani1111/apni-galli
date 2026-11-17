"use client";
// The in-place editor. Every change is a patch on an undo stack (50 deep); autosave runs 800 ms after the last
// change with If-Match on the draft version. R rerolls the unpinned DNA (flat-pack animation), P pins the focused
// attribute, Ctrl+K opens the command palette, S stamps the focused cover sold.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Facade } from "@/components/art/facades";
import { CoverMotif, KitDefs } from "@/components/art/kit";
import { dna, DNA_KEYS, DNA_LABELS, newSeed, SCENES, type DnaKey, type SceneSlug } from "@/lib/dna";
import { triadVars } from "@/lib/palette";
import { SCENE_META, livePlaceholders, type LaneDoc } from "@/lib/doc";

type Save = "saved" | "saving" | "offline" | "conflict";
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

function Editable({ value, onChange, ph, className, label, multiline, as = "span" }: { value: string; onChange: (v: string) => void; ph?: boolean; className?: string; label: string; multiline?: boolean; as?: "span" | "p" | "h1" }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current && ref.current.textContent !== value) ref.current.textContent = value;
  }, [value]);
  const Tag = as as "span";
  return (
    <Tag
      ref={ref as React.RefObject<HTMLSpanElement>}
      role="textbox"
      aria-label={label}
      aria-multiline={multiline}
      tabIndex={0}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      className={`${className ?? ""} ${ph ? "dashed-ph" : ""} cursor-text`}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          (e.currentTarget as HTMLElement).textContent = value;
          (e.currentTarget as HTMLElement).blur();
        }
        if (e.key === "Enter" && !multiline) {
          e.preventDefault();
          (e.currentTarget as HTMLElement).blur();
        }
      }}
      onBlur={(e) => {
        const v = (e.currentTarget.textContent ?? "").trim();
        if (v !== value) onChange(v);
      }}
    >
      {value}
    </Tag>
  );
}

export function Editor({ laneId, handle, initial, version: v0, published }: { laneId: string; handle: string; initial: LaneDoc; version: number; published: boolean }) {
  const [doc, setDoc] = useState<LaneDoc>(initial);
  const [past, setPast] = useState<LaneDoc[]>([]);
  const [future, setFuture] = useState<LaneDoc[]>([]);
  const [rolls, setRolls] = useState<number[]>([initial.seed]);
  const [save, setSave] = useState<Save>("saved");
  const [conflict, setConflict] = useState<{ doc: LaneDoc; version: number } | null>(null);
  const [phone, setPhone] = useState(false);
  const [palette, setPalette] = useState(false);
  const [pq, setPq] = useState("");
  const [sheet, setSheet] = useState<{ summary: string; placeholders: string[]; versions: { id: string; diff_summary: string; published_at: string }[] } | null>(null);
  const [pubMsg, setPubMsg] = useState("");
  const [focusKey, setFocusKey] = useState<DnaKey | null>(null);
  const [flat, setFlat] = useState(0);
  const [focusItem, setFocusItem] = useState<string | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const version = useRef(v0);
  const timer = useRef<number | undefined>(undefined);
  const docRef = useRef(doc);
  docRef.current = doc;

  const d = useMemo(() => dna(doc.seed, doc.pins, {}, ["gate", ...doc.scenes]), [doc.seed, doc.pins, doc.scenes]);

  const persist = useCallback(
    async (force = false) => {
      setSave("saving");
      try {
        const r = await fetch(`/api/studio/${laneId}/draft`, { method: "POST", headers: { "content-type": "application/json", "If-Match": String(version.current) }, body: JSON.stringify({ doc: docRef.current, force }) });
        const j = await r.json().catch(() => ({}));
        if (r.status === 412) {
          setConflict({ doc: j.doc, version: j.version });
          setSave("conflict");
          return;
        }
        if (!r.ok) {
          setSave("offline");
          setPubMsg(j.error ?? "Save nahi hua");
          return;
        }
        version.current = j.version;
        setSave("saved");
      } catch {
        setSave("offline");
        timer.current = window.setTimeout(() => persist(), 4000);
      }
    },
    [laneId],
  );

  const change = useCallback(
    (fn: (x: LaneDoc) => void) => {
      setPast((p) => [...p.slice(-49), docRef.current]);
      setFuture([]);
      const nx = clone(docRef.current);
      fn(nx);
      docRef.current = nx;
      setDoc(nx);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => persist(), 800);
    },
    [persist],
  );
  const unph = (x: LaneDoc, path: string) => (x.placeholders = x.placeholders.filter((p) => p !== path));

  const undo = useCallback(() => {
    setPast((p) => {
      if (!p.length) return p;
      const prev = p[p.length - 1];
      setFuture((f) => [docRef.current, ...f]);
      docRef.current = prev;
      setDoc(prev);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => persist(), 800);
      return p.slice(0, -1);
    });
  }, [persist]);
  const redo = useCallback(() => {
    setFuture((f) => {
      if (!f.length) return f;
      setPast((p) => [...p, docRef.current]);
      docRef.current = f[0];
      setDoc(f[0]);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => persist(), 800);
      return f.slice(1);
    });
  }, [persist]);

  const reroll = useCallback(() => {
    const s = newSeed();
    setFlat((n) => n + 1);
    window.setTimeout(() => {
      change((x) => {
        x.seed = s;
      });
      setRolls((r) => [s, ...r.filter((y) => y !== s)].slice(0, 8));
    }, 150);
  }, [change]);

  const togglePin = useCallback(
    (k: DnaKey) =>
      change((x) => {
        if (x.pins[k] !== undefined) delete x.pins[k];
        else x.pins[k] = d.raw[k];
      }),
    [change, d],
  );

  const openPublish = useCallback(async () => {
    window.clearTimeout(timer.current);
    await persist();
    const r = await fetch(`/api/studio/${laneId}/publish`);
    if (r.ok) setSheet(await r.json());
  }, [laneId, persist]);

  const doPublish = async () => {
    setPubMsg("");
    const r = await fetch(`/api/studio/${laneId}/publish`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setPubMsg(j.error ?? "Publish nahi hua");
    setPubMsg(`Live: ${j.summary}`);
    setSheet(null);
  };

  const restore = async (id: string) => {
    const r = await fetch(`/api/studio/${laneId}/publish`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ restore: id }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      change((x) => Object.assign(x, j.doc));
      setSheet(null);
      setPubMsg("Purana version draft mein wapas aaya. Publish karo to live hoga.");
    }
  };

  const commands = useMemo(
    () => [
      { k: "add item", run: () => change((x) => x.window.items.push({ id: "w" + Date.now().toString(36), title: "Naya item", blurb: "Ek line", motif: x.window.items.length % 8, stamp: null })) },
      { k: "reroll lane", run: reroll },
      { k: "undo", run: undo },
      { k: "redo", run: redo },
      { k: "preview phone", run: () => setPhone(true) },
      { k: "preview desktop", run: () => setPhone(false) },
      { k: "publish", run: openPublish },
      { k: "add service (settings)", run: () => (location.href = `/studio/${laneId}/settings#services`) },
      { k: "edit hours (settings)", run: () => (location.href = `/studio/${laneId}/settings#hours`) },
      { k: "open galla", run: () => (location.href = `/studio/${laneId}/galla`) },
      ...SCENES.map((s) => ({ k: `${doc.scenes.includes(s) ? "remove" : "add"} ${SCENE_META[s].name}`, run: () => change((x) => (x.scenes = x.scenes.includes(s) ? x.scenes.filter((y) => y !== s) : [...x.scenes, s])) })),
    ],
    [change, reroll, undo, redo, openPublish, laneId, doc.scenes],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.closest("input, textarea, select, [contenteditable]");
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
        setPq("");
        return;
      }
      if (mod && e.key.toLowerCase() === "z" && !typing) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y" && !typing) {
        e.preventDefault();
        redo();
        return;
      }
      if (typing || mod || e.altKey) return;
      if (e.key === "r" || e.key === "R") reroll();
      if (e.key === "u") undo();
      if (e.key === "p" && focusKey) togglePin(focusKey);
      if (e.key === "s" && focusItem) change((x) => x.window.items.forEach((i) => i.id === focusItem && (i.stamp = i.stamp === "sold" ? null : "sold")));
      if (e.key === "Escape") setPalette(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, reroll, togglePin, focusKey, focusItem, change]);

  // optional: shake the phone to roll the dice
  useEffect(() => {
    let last = 0;
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a) return;
      const m = Math.abs(a.x ?? 0) + Math.abs(a.y ?? 0) + Math.abs(a.z ?? 0);
      if (m > 38 && Date.now() - last > 1500) {
        last = Date.now();
        reroll();
      }
    };
    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
  }, [reroll]);

  const ph = (p: string) => doc.placeholders.includes(p);
  const lantern = { saved: "Saved", saving: "Saving…", offline: "Offline, will save", conflict: "Doosre tab mein badla hai" }[save];

  const preview = (
    <div className="space-y-8">
      <div className="grid gap-6 md:grid-cols-[minmax(0,320px)_1fr]" style={{ gridTemplateColumns: phone ? "1fr" : undefined }}>
        <div key={flat} style={{ animation: flat ? "flatpack 350ms var(--spring-ui)" : undefined, transformOrigin: "50% 100%" }}>
          <Facade scene="gate" ctx={{ dna: d, name: doc.name, hi: doc.nameHi, seed: doc.seed }} />
        </div>
        <div>
          <Editable as="h1" className="mast t-mast block" value={doc.name} label="Shop name" onChange={(v) => change((x) => (x.name = v || x.name))} />
          <Editable as="p" className="sign mt-1 block text-2xl text-[var(--lane-a)]" value={doc.nameHi ?? ""} label="Hindi name" onChange={(v) => change((x) => (x.nameHi = v || undefined))} />
          {!doc.nameHi && <p className="mono text-xs text-[var(--muted)]">↑ Hindi naam ke liye upar tap karo</p>}
          <Editable as="p" multiline className="mt-3 block text-lg" value={doc.tagline} ph={ph("tagline")} label="Tagline" onChange={(v) => change((x) => ((x.tagline = v), unph(x, "tagline")))} />
          <p className="mono mt-2 text-sm text-[var(--muted)]">
            Shehar: <Editable value={doc.city || "…"} label="City" onChange={(v) => change((x) => (x.city = v === "…" ? "" : v))} />
          </p>
        </div>
      </div>

      <section>
        <h2 className="sign text-2xl">Makaan (buildings)</h2>
        <p className="text-sm text-[var(--muted)]">Tap to add or remove. Order = street order.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {SCENES.map((s) => {
            const on = doc.scenes.includes(s);
            return (
              <button key={s} type="button" className="btn" aria-pressed={on} onClick={() => change((x) => (x.scenes = on ? x.scenes.filter((y) => y !== s) : [...x.scenes, s]))}>
                {SCENE_META[s].name}
              </button>
            );
          })}
        </div>
      </section>

      {doc.scenes.includes("window") && (
        <section>
          <div className="flex items-end justify-between gap-2">
            <h2 className="sign text-2xl">
              Window: <Editable value={doc.window.title} label="Window title" onChange={(v) => change((x) => (x.window.title = v))} />
            </h2>
            <button type="button" className="btn" onClick={commands[0].run}>
              + Item
            </button>
          </div>
          <ul className={`mt-3 grid gap-3 ${phone ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4"}`}>
            {doc.window.items.map((it, i) => (
              <li
                key={it.id}
                draggable
                onDragStart={() => setDrag(it.id)}
                onDragEnd={() => setDrag(null)}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!drag || drag === it.id) return;
                  const from = doc.window.items.findIndex((x) => x.id === drag);
                  if (from < 0 || from === i) return;
                  const nx = clone(doc);
                  const [m] = nx.window.items.splice(from, 1);
                  nx.window.items.splice(i, 0, m);
                  setDoc(nx);
                  docRef.current = nx;
                }}
                onDrop={() => change(() => {})}
                onFocus={() => setFocusItem(it.id)}
                tabIndex={-1}
                className={`relative border-2 border-[#1e1b18] bg-[var(--paper)] p-2 text-[#1e1b18] ${ph(`window.items.${it.id}`) ? "dashed-ph" : ""}`}
                style={{ boxShadow: "var(--shadow-paper-sm)", opacity: drag === it.id ? 0.5 : 1, transition: "transform 330ms var(--spring-ui)" }}
              >
                <div className="relative aspect-[3/4] cursor-grab" style={{ background: "var(--lane-c)" }} title="Drag to reorder">
                  <svg viewBox="0 0 200 260" className="absolute inset-0 h-full w-full" aria-hidden="true">
                    <CoverMotif motif={it.motif} seed={doc.seed} />
                  </svg>
                  {it.stamp && <span className="stamp stamp-in absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--chalk)]/70 text-lg">{it.stamp === "sold" ? "SOLD" : "BOOKED"}</span>}
                </div>
                <Editable as="p" className="mt-1 block font-semibold" value={it.title} label="Item title" onChange={(v) => change((x) => (x.window.items.forEach((y) => y.id === it.id && (y.title = v || y.title)), unph(x, `window.items.${it.id}`)))} />
                <Editable as="p" multiline className="block text-sm" value={it.blurb} label="Item blurb" onChange={(v) => change((x) => (x.window.items.forEach((y) => y.id === it.id && (y.blurb = v)), unph(x, `window.items.${it.id}`)))} />
                <p className="mono text-sm">
                  ₹
                  <Editable
                    value={it.price_paise ? String(it.price_paise / 100) : "0"}
                    label="Item price in rupees"
                    onChange={(v) => change((x) => x.window.items.forEach((y) => y.id === it.id && (y.price_paise = Math.round(Number(v.replace(/[^\d.]/g, "")) * 100) || null)))}
                  />
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <button type="button" className="btn !min-h-11 !px-2 text-xs" onClick={() => change((x) => x.window.items.forEach((y) => y.id === it.id && (y.stamp = y.stamp === "sold" ? null : "sold")))} title="S">
                    Sold
                  </button>
                  <button type="button" className="btn !min-h-11 !px-2 text-xs" onClick={() => change((x) => x.window.items.forEach((y) => y.id === it.id && (y.motif = (y.motif + 1) % 8)))}>
                    Art
                  </button>
                  <button type="button" className="btn !min-h-11 !px-2 text-xs" aria-label="Move earlier" disabled={i === 0} onClick={() => change((x) => x.window.items.splice(i - 1, 0, x.window.items.splice(i, 1)[0]))}>
                    ←
                  </button>
                  <button type="button" className="btn !min-h-11 !px-2 text-xs" aria-label="Remove item" onClick={() => change((x) => ((x.window.items = x.window.items.filter((y) => y.id !== it.id)), unph(x, `window.items.${it.id}`)))}>
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {doc.scenes.includes("loft") && (
        <section>
          <h2 className="sign text-2xl">Loft: kahani</h2>
          <Editable as="p" multiline className="mt-1 block" value={doc.loft.story} ph={ph("loft.story")} label="Story" onChange={(v) => change((x) => ((x.loft.story = v), unph(x, "loft.story")))} />
          <ol className={`mt-2 list-decimal pl-6 ${ph("loft.steps") ? "dashed-ph" : ""}`}>
            {doc.loft.steps.map((s, i) => (
              <li key={i}>
                <Editable value={s} label={`Step ${i + 1}`} onChange={(v) => change((x) => ((x.loft.steps[i] = v), unph(x, "loft.steps"), (x.loft.steps = x.loft.steps.filter(Boolean))))} />
              </li>
            ))}
          </ol>
          <button type="button" className="btn mt-1" onClick={() => change((x) => x.loft.steps.push("Agla kadam"))}>
            + Step
          </button>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        {doc.scenes.includes("postbox") && (
          <div>
            <h3 className="sign text-xl">Postbox pitch</h3>
            <Editable as="p" multiline className="block" value={doc.postbox.pitch} ph={ph("postbox.pitch")} label="Postbox pitch" onChange={(v) => change((x) => ((x.postbox.pitch = v), unph(x, "postbox.pitch")))} />
          </div>
        )}
        {doc.scenes.includes("counter") && (
          <div>
            <h3 className="sign text-xl">Counter pitch</h3>
            <Editable as="p" multiline className="block" value={doc.counter.pitch} label="Counter pitch" onChange={(v) => change((x) => (x.counter.pitch = v))} />
            <div className="mt-1 flex gap-1">
              {(["booking", "enquiry"] as const).map((m) => (
                <button key={m} type="button" className="btn" aria-pressed={doc.counterMode === m} onClick={() => change((x) => (x.counterMode = m))}>
                  {m === "booking" ? "Booking mode" : "Enquiry mode"}
                </button>
              ))}
            </div>
          </div>
        )}
        {doc.scenes.includes("menu") && (
          <div>
            <h3 className="sign text-xl">Menu board</h3>
            <Editable as="p" multiline className="block" value={doc.menu.pitch} label="Menu pitch" onChange={(v) => change((x) => (x.menu.pitch = v))} />
            <Editable as="p" className="mono block text-sm" value={doc.menu.pickupNote} label="Pickup note" onChange={(v) => change((x) => (x.menu.pickupNote = v))} />
          </div>
        )}
        {doc.scenes.includes("rooftop") && (
          <div>
            <h3 className="sign text-xl">Rooftop</h3>
            <Editable as="p" multiline className="block" value={doc.rooftop.note} ph={ph("rooftop.note")} label="Rooftop note" onChange={(v) => change((x) => ((x.rooftop.note = v), unph(x, "rooftop.note")))} />
            <p className="mono text-sm">
              Address: <Editable value={doc.contact.address || "…"} label="Address" onChange={(v) => change((x) => (x.contact.address = v === "…" ? undefined : v))} />
            </p>
          </div>
        )}
        {doc.scenes.includes("notice") && (
          <div>
            <h3 className="sign text-xl">Noticeboard</h3>
            <Editable as="p" multiline className="block" value={doc.notice.pitch} label="Noticeboard pitch" onChange={(v) => change((x) => (x.notice.pitch = v))} />
            <a className="mono text-sm underline" href={`/studio/${laneId}/settings#notes`}>
              Links settings mein
            </a>
          </div>
        )}
      </section>
    </div>
  );

  return (
    <div style={triadVars(d.palette) as React.CSSProperties}>
      <KitDefs awning={d.awning} />
      <style>{`@keyframes flatpack{0%{transform:none}43%{transform:rotateX(80deg) scaleY(.2)}100%{transform:none}}`}</style>
      {/* toolbar */}
      <div className="sticky top-[58px] z-30 -mx-4 mb-4 flex flex-wrap items-center gap-2 border-b-2 border-[var(--soot)] bg-[var(--chalk)] px-4 py-2">
        <button type="button" className="btn" onClick={reroll} title="R">
          <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true">
            <rect x="2" y="2" width="16" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="7" cy="7" r="1.5" fill="currentColor" />
            <circle cx="13" cy="13" r="1.5" fill="currentColor" />
            <circle cx="13" cy="7" r="1.5" fill="currentColor" />
            <circle cx="7" cy="13" r="1.5" fill="currentColor" />
          </svg>
          Reroll (R)
        </button>
        <button type="button" className="btn" onClick={undo} disabled={!past.length} title="Ctrl+Z, U">
          ↶ Undo
        </button>
        <button type="button" className="btn" onClick={redo} disabled={!future.length} title="Ctrl+Shift+Z">
          ↷ Redo
        </button>
        <button type="button" className="btn" aria-pressed={phone} onClick={() => setPhone(!phone)}>
          {phone ? "Phone 360" : "Desktop"}
        </button>
        <button type="button" className="btn" onClick={() => setPalette(true)}>
          Ctrl+K
        </button>
        <span className="mono ml-auto flex items-center gap-2 text-xs" role="status">
          <span className="inline-block size-3 rounded-full ring-2 ring-[#1e1b18]" style={{ background: save === "saved" ? "var(--mint-enamel)" : save === "saving" ? "var(--haldi)" : "var(--sindoor)" }} aria-hidden="true" />
          {lantern}
        </span>
        <button type="button" className="cta" onClick={openPublish}>
          Publish
        </button>
      </div>

      {conflict && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border-2 border-[var(--sindoor)] p-3" role="alert">
          <span>Doosre tab mein badla hai.</span>
          <button
            className="btn"
            onClick={() => {
              setDoc(conflict.doc);
              docRef.current = conflict.doc;
              version.current = conflict.version;
              setConflict(null);
              setSave("saved");
            }}
          >
            Unka rakho (use theirs)
          </button>
          <button
            className="btn"
            onClick={() => {
              version.current = conflict.version;
              setConflict(null);
              persist(true);
            }}
          >
            Mera rakho (keep mine)
          </button>
        </div>
      )}
      {pubMsg && (
        <p className="mb-4 rounded-md border-2 border-[var(--soot)] bg-[var(--paper)] p-3 text-[#1e1b18]" role="status">
          {pubMsg}{" "}
          {pubMsg.startsWith("Live") && (
            <a className="underline" href={`/w/${handle}`} target="_blank" rel="noreferrer">
              /w/{handle} kholo
            </a>
          )}
        </p>
      )}
      {livePlaceholders(doc).length > 0 && <p className="mono mb-3 text-xs text-[var(--sindoor)]">{livePlaceholders(doc).length} starter text baaki (dashed outline). Publish se pehle badlo.</p>}
      {!published && <p className="mono mb-3 text-xs">Abhi draft hai. Publish karte hi /w/{handle} live hoga.</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <div className={phone ? "mx-auto w-[360px] max-w-full overflow-hidden rounded-[28px] border-[10px] border-[#1e1b18] p-3" : ""}>{preview}</div>

        {/* DNA panel with brass pins */}
        <aside className="lg:sticky lg:top-32 lg:self-start">
          <h2 className="sign text-xl">Lane DNA</h2>
          <p className="text-xs text-[var(--muted)]">Pin a choice so reroll keeps it. Focus a row and press P.</p>
          <ul className="mt-2 space-y-1">
            {(DNA_KEYS.filter((k) => DNA_LABELS[k] || k.startsWith("v_")) as DnaKey[])
              .filter((k) => !k.startsWith("v_") || k === "v_gate" || doc.scenes.includes(k.slice(2) as SceneSlug))
              .map((k) => {
                const pinned = doc.pins[k] !== undefined;
                return (
                  <li key={k}>
                    <button type="button" className="flex min-h-11 w-full items-center justify-between gap-2 rounded border border-[var(--line)] px-2 text-left text-sm" onFocus={() => setFocusKey(k)} onMouseEnter={() => setFocusKey(k)} onClick={() => togglePin(k)} aria-pressed={pinned}>
                      <span>{DNA_LABELS[k] ?? `${SCENE_META[k.slice(2) as SceneSlug]?.name ?? k} facade`}</span>
                      <span className="mono flex items-center gap-1 text-xs">
                        {d.raw[k] + 1}
                        <span className="inline-block size-3.5 rounded-full border border-[#7a5414]" style={{ background: pinned ? "#c9962e" : "transparent" }} aria-label={pinned ? "pinned" : "not pinned"} />
                      </span>
                    </button>
                  </li>
                );
              })}
          </ul>
          <h3 className="sign mt-4 text-lg">Filmstrip</h3>
          <div className="no-scrollbar mt-1 flex gap-2 overflow-x-auto pb-1" data-noswipe>
            {rolls.map((s) => (
              <button key={s} type="button" className="w-[66px] shrink-0 rounded border-2 p-0.5" style={{ ...(triadVars(dna(s, doc.pins).palette) as React.CSSProperties), borderColor: s === doc.seed ? "var(--marigold)" : "var(--line)" }} onClick={() => change((x) => (x.seed = s))} aria-label="Jump to this roll">
                <Facade scene="gate" ctx={{ dna: dna(s, doc.pins), name: doc.name, seed: s }} />
              </button>
            ))}
          </div>
        </aside>
      </div>

      {palette && (
        <div className="fixed inset-0 z-50 grid place-items-start justify-center bg-black/40 p-4 pt-[15vh]" role="dialog" aria-modal="true" aria-label="Command palette" onClick={() => setPalette(false)}>
          <div className="chit w-full max-w-md px-4 pb-4 pt-5 text-[#1e1b18]" onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus
              className="field"
              placeholder="add item, publish, preview phone…"
              value={pq}
              onChange={(e) => setPq(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const c = commands.find((c) => c.k.includes(pq.toLowerCase()));
                  if (c) {
                    c.run();
                    setPalette(false);
                  }
                }
              }}
            />
            <ul className="mt-2 max-h-72 overflow-y-auto">
              {commands
                .filter((c) => c.k.includes(pq.toLowerCase()))
                .map((c) => (
                  <li key={c.k}>
                    <button
                      className="mono min-h-11 w-full px-2 text-left hover:bg-[#1e1b18]/10"
                      onClick={() => {
                        c.run();
                        setPalette(false);
                      }}
                    >
                      {c.k}
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      )}

      {sheet && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Publish">
          <div className="chit w-full max-w-md px-5 pb-5 pt-6 text-[#1e1b18]">
            <p className="sign text-2xl">Publish karein?</p>
            <p className="mt-2">{sheet.summary}</p>
            {sheet.placeholders.length > 0 && <p className="err mt-2">{sheet.placeholders.length} starter text abhi baaki hai: {sheet.placeholders.join(", ")}</p>}
            <div className="mt-4 flex gap-2">
              <button className="cta" onClick={doPublish} disabled={sheet.placeholders.length > 0}>
                Haan, live karo
              </button>
              <button className="btn" onClick={() => setSheet(null)}>
                Abhi nahi
              </button>
            </div>
            {sheet.versions.length > 0 && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-semibold">Purane versions ({sheet.versions.length})</summary>
                <ul className="mt-2 space-y-1 text-sm">
                  {sheet.versions.map((v) => (
                    <li key={v.id} className="flex items-center justify-between gap-2">
                      <span className="truncate">
                        {new Date(v.published_at).toLocaleString("en-IN")}: {v.diff_summary}
                      </span>
                      <button className="btn !min-h-11 shrink-0 text-xs" onClick={() => restore(v.id)}>
                        Restore
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {pubMsg && <p className="err mt-2">{pubMsg}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
