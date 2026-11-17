"use client";
// The Galla, the owner's front desk. One merged inbox; every action applies on screen at once, goes into an
// IndexedDB outbox with an op id, shows a 5-second undo, and flushes to the server in a batch when the undo
// window closes. The server applies each op id once. The Hisaab counts come from the same query as the list.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Item = { type: "chit" | "booking" | "subscriber"; id: string; lane_id: string; status: string; at: string; updated_at: string; data: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
type Hisaab = { bookings_today: number; unanswered: number; to_prepare: number; paid_today: number };
type Op = { op_id: string; kind: string; type: Item["type"]; id: string; payload?: Record<string, string>; prev: string; at: number; label: string };

const rs = (p: number) => "₹" + (p / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const when = (iso: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
const newId = () => (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now()).replace(/-/g, "");

/* --- tiny IndexedDB outbox (falls back to memory) --- */
const DB = "galli-galla";
function idb(): Promise<IDBDatabase | null> {
  return new Promise((res) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore("outbox", { keyPath: "op_id" });
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
    } catch {
      res(null);
    }
  });
}
async function obPut(op: Op & { desk: string }) {
  const d = await idb();
  d?.transaction("outbox", "readwrite").objectStore("outbox").put(op);
}
async function obDel(id: string) {
  const d = await idb();
  d?.transaction("outbox", "readwrite").objectStore("outbox").delete(id);
}
async function obAll(desk: string): Promise<Op[]> {
  const d = await idb();
  if (!d) return [];
  return new Promise((res) => {
    const r = d.transaction("outbox").objectStore("outbox").getAll();
    r.onsuccess = () => res((r.result as (Op & { desk: string })[]).filter((o) => o.desk === desk));
    r.onerror = () => res([]);
  });
}

function nextStatus(it: Item, kind: string, payload?: Record<string, string>): string {
  if (kind === "read") return it.status === "new" ? "read" : it.status;
  if (kind === "reply") return ["new", "read"].includes(it.status) ? "replied" : it.status;
  if (kind === "confirm") return "confirmed";
  if (kind === "decline") return "declined";
  if (kind === "paid") return "paid";
  if (kind === "done") return "done";
  if (kind === "archive" || kind === "block") return "archived";
  if (kind === "restore") return payload?.status ?? it.status;
  return it.status;
}

const TYPE_LABEL = { chit: "Chit", booking: "Booking", subscriber: "Subscriber" };
// chit field keys from the kit schemas, in the words the owner reads them
const FIELD_NAMES: Record<string, string> = {
  name: "Naam", contact: "WhatsApp ya email", event_date: "Date", hands: "Kitne haath", venue: "Venue", style: "Style",
  budget: "Budget", deadline: "Deadline", count: "Kitne log", date: "Kab chahiye", kind: "Kaisa shoot", level: "Class",
  msg: "Message", piece: "Piece",
};
const PRESETS = ["Us din full hai", "Yeh hum nahi banate", "Address bahar hai"];

function title(it: Item) {
  const d = it.data;
  if (it.type === "chit") return String(d.fields?.name ?? "Visitor");
  if (it.type === "booking") return String(d.name ?? "Visitor");
  return String(d.email);
}
function subline(it: Item) {
  const d = it.data;
  if (it.type === "chit" && d.kind === "order") return `${(d.lines ?? []).map((l: { qty: number; name: string }) => `${l.qty}× ${l.name}`).join(", ")} · ${rs(d.total ?? 0)} · pickup ${d.pickup_day}`;
  if (it.type === "chit") return String(d.fields?.msg ?? d.fields?.about ?? Object.values(d.fields ?? {}).slice(2).join(" · "));
  if (it.type === "booking") return `${d.service?.en} · ${when(d.start)}`;
  return d.confirmed_at ? "Confirmed subscriber" : "Waiting for confirm click";
}
const statusTone: Record<string, string> = {
  new: "var(--rani)",
  read: "var(--marigold)",
  replied: "var(--peacock)",
  pending: "var(--marigold)",
  confirmed: "var(--peacock)",
  paid: "var(--enamel-blue)",
  done: "var(--tin)",
  declined: "var(--sindoor)",
  archived: "var(--tin)",
  cancelled: "var(--tin)",
  unsubscribed: "var(--tin)",
};

export function Galla({ desk, name, demo, savedViews: initialViews }: { desk: string; name: string; demo?: boolean; savedViews?: { id: string; name: string; filter: Record<string, string> }[] }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [hisaab, setHisaab] = useState<Hisaab | null>(null);
  const [filter, setFilter] = useState<{ type: string; status: string; q: string; day: string }>({ type: "", status: "open", q: "", day: "" });
  const [cur, setCur] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Op[]>([]);
  const [toast, setToast] = useState<{ text: string; op?: Op; error?: boolean } | null>(null);
  const [shakeId, setShakeId] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [declineFor, setDeclineFor] = useState<Item | null>(null);
  const [coin, setCoin] = useState(0);
  const [reply, setReply] = useState("");
  const [views, setViews] = useState(initialViews ?? []);
  const [offline, setOffline] = useState(false);
  const etag = useRef<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const replyRef = useRef<HTMLTextAreaElement>(null);
  const gPressed = useRef(0);
  const flushTimer = useRef<number | undefined>(undefined);
  const pendingRef = useRef<Op[]>([]);
  pendingRef.current = pending;

  const qs = useMemo(() => new URLSearchParams(Object.entries(filter).filter(([, v]) => v) as [string, string][]).toString(), [filter]);

  const load = useCallback(
    async (force = false) => {
      try {
        const r = await fetch(`/api/galla/${desk}/feed?${qs}`, { headers: !force && etag.current ? { "If-None-Match": etag.current } : {}, cache: "no-store" });
        setOffline(false);
        if (r.status === 304) return;
        if (!r.ok) return;
        etag.current = r.headers.get("ETag");
        const j = await r.json();
        // pending local ops stay applied over the server copy until they flush
        const local: Item[] = j.items.map((it: Item) => {
          const ops = pendingRef.current.filter((o) => o.id === it.id);
          return ops.reduce((acc, o) => ({ ...acc, status: nextStatus(acc, o.kind, o.payload) }), it);
        });
        setItems(local);
        setHisaab(j.hisaab);
      } catch {
        setOffline(true);
      }
    },
    [desk, qs],
  );

  useEffect(() => {
    etag.current = null;
    setItems(null);
    load(true);
  }, [load]);

  // poll every 15 s while visible
  useEffect(() => {
    const id = window.setInterval(() => document.visibilityState === "visible" && load(), 15000);
    const vis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", vis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [load]);

  const flush = useCallback(async () => {
    const ops = pendingRef.current;
    if (!ops.length) return;
    try {
      const r = await fetch(`/api/galla/${desk}/ops`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ops: ops.map(({ op_id, kind, type, id, payload }) => ({ op_id, kind, type, id, payload })) }),
      });
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as { results: { op_id: string; ok: boolean; error?: string }[] };
      for (const res of j.results) {
        await obDel(res.op_id);
        if (!res.ok) {
          const op = ops.find((o) => o.op_id === res.op_id);
          if (op) {
            // the server said no: roll the row back, shake it, say why
            setItems((xs) => xs?.map((x) => (x.id === op.id ? { ...x, status: op.prev } : x)) ?? null);
            setShakeId(op.id);
            window.setTimeout(() => setShakeId(null), 400);
            setToast({ text: res.error ?? "Nahi hua", error: true });
          }
        }
      }
      setPending((p) => p.filter((o) => !j.results.some((x) => x.op_id === o.op_id)));
      setOffline(false);
      etag.current = null;
      load(true);
    } catch {
      setOffline(true);
      flushTimer.current = window.setTimeout(flush, 4000);
    }
  }, [desk, load]);

  // ops left in IndexedDB from a closed tab or a dropped network go out now
  useEffect(() => {
    obAll(desk).then((ops) => {
      if (ops.length) {
        setPending(ops);
        window.setTimeout(flush, 400);
      }
    });
  }, [desk, flush]);

  const scheduleFlush = useCallback(
    (delay: number) => {
      window.clearTimeout(flushTimer.current);
      flushTimer.current = window.setTimeout(flush, delay);
    },
    [flush],
  );

  const act = useCallback(
    (it: Item, kind: string, payload?: Record<string, string>, opts: { immediate?: boolean; quiet?: boolean } = {}) => {
      const op: Op = { op_id: newId(), kind, type: it.type, id: it.id, payload, prev: it.status, at: Date.now(), label: `${kind} · ${title(it)}` };
      setItems((xs) => xs?.map((x) => (x.id === it.id ? { ...x, status: nextStatus(x, kind, payload), data: kind === "reply" ? { ...x.data, replies: [...(x.data.replies ?? []), { body: payload?.body, at: new Date().toISOString() }] } : kind === "paid" ? { ...x.data, paid_at: new Date().toISOString() } : x.data } : x)) ?? null);
      setPending((p) => [...p, op]);
      obPut({ ...op, desk });
      if ((kind === "confirm" && it.type === "booking") || kind === "paid") {
        if (!(document.documentElement.dataset.calm === "1" || matchMedia("(prefers-reduced-motion: reduce)").matches)) setCoin((c) => c + 1);
      }
      if (!opts.quiet) setToast({ text: { read: "Padha", reply: "Jawab gaya", confirm: "Pakka", decline: "Mana kiya", paid: "Paisa mila", done: "Ho gaya", archive: "Archive", block: "Sender block", restore: "Wapas" }[kind] ?? kind, op });
      scheduleFlush(opts.immediate ? 50 : 5000);
    },
    [desk, scheduleFlush],
  );

  const undo = useCallback(
    (op?: Op) => {
      const target = op ?? pendingRef.current[pendingRef.current.length - 1];
      if (!target) {
        // already flushed: send the inverse op
        if (toast?.op) {
          const it = items?.find((x) => x.id === toast.op!.id);
          if (it) act(it, "restore", { status: toast.op.prev }, { immediate: true, quiet: true });
          setToast({ text: "Wapas kar diya" });
        }
        return;
      }
      if (pendingRef.current.some((o) => o.op_id === target.op_id)) {
        setPending((p) => p.filter((o) => o.op_id !== target.op_id));
        obDel(target.op_id);
        setItems((xs) => xs?.map((x) => (x.id === target.id ? { ...x, status: target.prev } : x)) ?? null);
      } else {
        const it = items?.find((x) => x.id === target.id);
        if (it) act(it, "restore", { status: target.prev }, { immediate: true, quiet: true });
      }
      setToast({ text: "Wapas kar diya" });
    },
    [act, items, toast],
  );

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const list = items ?? [];
  const current = list[cur];
  const opened = list.find((x) => x.id === openId) ?? null;

  const open = useCallback(
    (it: Item) => {
      setOpenId(it.id);
      setReply("");
      if (it.type === "chit" && it.status === "new") act(it, "read", undefined, { quiet: true, immediate: true });
    },
    [act],
  );

  const primary = (it: Item) => {
    if (it.type === "booking" && it.status === "pending") return act(it, "confirm");
    if (it.type === "chit" && it.data.kind === "order" && ["new", "read"].includes(it.status)) return act(it, "confirm");
    if (it.type === "chit" && it.status === "new") return act(it, "read");
  };

  // keyboard: single keys work when focus is not in a text field
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.closest("input, textarea, select, [contenteditable]");
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !typing) {
        e.preventDefault();
        return undo();
      }
      if (typing) {
        if (e.key === "Escape") (t as HTMLElement).blur();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key;
      const it = list[cur];
      if (k === "g") {
        gPressed.current = Date.now();
        return;
      }
      if ((k === "t" || k === "T") && Date.now() - gPressed.current < 900) {
        setFilter((f) => ({ ...f, day: "today", status: "" }));
        return;
      }
      switch (k) {
        case "j":
          e.preventDefault();
          setCur((c) => Math.min(list.length - 1, c + 1));
          return;
        case "k":
          e.preventDefault();
          setCur((c) => Math.max(0, c - 1));
          return;
        case "Enter":
          if (it) open(it);
          return;
        case "r":
          if (it?.type === "chit") {
            e.preventDefault();
            open(it);
            window.setTimeout(() => replyRef.current?.focus(), 30);
          }
          return;
        case "b":
          if (it && (it.type === "booking" || it.data.kind === "order")) act(it, "confirm");
          return;
        case "d":
          if (it && it.type !== "subscriber") setDeclineFor(it);
          return;
        case "p":
          if (it?.type === "chit") act(it, "paid");
          return;
        case "a":
          if (it) act(it, "archive");
          return;
        case "A":
          selected.forEach((id) => {
            const x = list.find((y) => y.id === id);
            if (x) act(x, "archive", undefined, { quiet: true });
          });
          if (selected.size) setToast({ text: `${selected.size} archive kiye` });
          setSelected(new Set());
          return;
        case "u":
          return undo();
        case "x":
          if (it)
            setSelected((s) => {
              const n = new Set(s);
              if (n.has(it.id)) n.delete(it.id);
              else n.add(it.id);
              return n;
            });
          return;
        case "/":
          e.preventDefault();
          searchRef.current?.focus();
          return;
        case "?":
          setHelp((h) => !h);
          return;
        case "Escape":
          setHelp(false);
          setDeclineFor(null);
          setOpenId(null);
          return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [list, cur, act, open, undo, selected]);

  useEffect(() => {
    document.querySelector(`[data-row="${cur}"]`)?.scrollIntoView({ block: "nearest" });
  }, [cur]);

  const saveView = async () => {
    const nm = window.prompt("View ka naam");
    if (!nm) return;
    const r = await fetch(`/api/galla/${desk}/views`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: nm, filter }) });
    if (r.ok) {
      const j = await r.json();
      setViews((v) => [...v, j.view]);
    }
  };

  return (
    <div className="relative">
      {demo && (
        <p className="mono mb-3 rounded bg-[#1e1b18] px-3 py-2 text-xs text-[var(--haldi)]">
          Demo Galla: sirf woh chits, bookings aur orders jo aapne demo galliyon pe bheje. Yahan se jawab do, phir apni chit ka link kholo.
        </p>
      )}
      {/* Hisaab strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(4,1fr)_auto]" aria-label="Hisaab, aaj ke numbers">
        {[
          ["Aaj ki bookings", hisaab?.bookings_today, "today-bk"],
          ["Bina jawab chits", hisaab?.unanswered, "unans"],
          ["Orders banane hain", hisaab?.to_prepare, "prep"],
          ["UPI mila (aaj)", hisaab?.paid_today, "paid"],
        ].map(([label, n, k]) => (
          <div key={k as string} className="tin rounded-md px-3 py-2" style={{ boxShadow: "var(--shadow-paper-sm)" }}>
            <p className="mono text-[0.7rem] uppercase">{label}</p>
            <p className="mast text-3xl leading-none">{n ?? <span className="skel inline-block h-7 w-8 align-middle" />}</p>
          </div>
        ))}
        <div className="relative col-span-2 flex items-end justify-center sm:col-span-1" aria-hidden="true">
          <svg viewBox="0 0 70 56" className="h-14 w-16">
            <rect x="4" y="22" width="62" height="32" rx="3" fill="#7a3b1e" stroke="#1e1b18" strokeWidth="2" />
            <rect x="24" y="22" width="22" height="4" fill="#1e1b18" />
            <text x="35" y="44" textAnchor="middle" style={{ fontFamily: "var(--f-sign)", fontSize: 12, fill: "#fff4e0" }}>
              गल्ला
            </text>
          </svg>
          {coin > 0 && (
            <span key={coin} className="absolute left-1/2 top-0 size-5 -translate-x-1/2 rounded-full border-2 border-[#7a5414] bg-[#c9962e]" style={{ animation: "coin-drop 620ms var(--spring-stamp) forwards" }} />
          )}
          <style>{`@keyframes coin-drop{0%{transform:translate(-50%,-30px);opacity:1}70%{transform:translate(-50%,14px);opacity:1}100%{transform:translate(-50%,20px);opacity:0}}`}</style>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* filter rail */}
        <aside className="flex flex-col gap-3" aria-label="Filters">
          <label className="mono text-xs uppercase" htmlFor="g-search">
            Search ( / )
          </label>
          <input id="g-search" ref={searchRef} className="input" placeholder="naam, phone, chit, item" value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} />
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto lg:flex-wrap" data-noswipe>
            {[
              ["", "Sab"],
              ["chit", "Chits"],
              ["booking", "Bookings"],
              ["subscriber", "Subscribers"],
            ].map(([v, l]) => (
              <button key={v} type="button" className="btn shrink-0" aria-pressed={filter.type === v} onClick={() => setFilter({ ...filter, type: v })}>
                {l}
              </button>
            ))}
          </div>
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto lg:flex-wrap" data-noswipe>
            {[
              ["open", "Khule"],
              ["", "Sab status"],
              ["new", "Naye"],
              ["pending", "Pending"],
              ["paid", "Paid"],
              ["archived", "Archive"],
            ].map(([v, l]) => (
              <button key={v + l} type="button" className="btn shrink-0" aria-pressed={filter.status === v} onClick={() => setFilter({ ...filter, status: v })}>
                {l}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            <button type="button" className="btn" aria-pressed={filter.day === "today"} onClick={() => setFilter({ ...filter, day: filter.day === "today" ? "" : "today" })}>
              Aaj (G T)
            </button>
            <button type="button" className="btn" aria-pressed={filter.day === "week"} onClick={() => setFilter({ ...filter, day: filter.day === "week" ? "" : "week" })}>
              7 din
            </button>
          </div>
          {!demo && (
            <div className="flex flex-col gap-1.5">
              <p className="mono text-xs uppercase">Saved views</p>
              {views.map((v) => (
                <button key={v.id} type="button" className="btn justify-start" onClick={() => setFilter({ type: v.filter.type ?? "", status: v.filter.status ?? "", q: v.filter.q ?? "", day: v.filter.day ?? "" })}>
                  {v.name}
                </button>
              ))}
              <button type="button" className="btn justify-start" onClick={saveView}>
                + Is view ko save karo
              </button>
            </div>
          )}
          <a className="btn justify-start" href={`/api/galla/${desk}/export.csv?${qs}`}>
            CSV export
          </a>
          <button type="button" className="btn justify-start" onClick={() => setHelp(true)}>
            Shortcuts ( ? )
          </button>
          {!demo && <PushToggle laneId={desk} />}
          {(offline || pending.length > 0) && (
            <p className="flex items-center gap-2 text-xs" role="status">
              <span className="inline-block size-3 rounded-full bg-[var(--haldi)] ring-2 ring-[#1e1b18]" aria-hidden="true" />
              {offline ? "Saved on phone, will sync" : `${pending.length} kaam bhejne baaki (undo ka mauka)`}
            </p>
          )}
        </aside>

        {/* list */}
        <section aria-label="Inbox" className="min-w-0">
          <ul className="flex flex-col gap-2" role="listbox" aria-label="Galla entries. J and K move, Enter opens.">
            {items === null &&
              Array.from({ length: 5 }, (_, i) => (
                <li key={i} className="chit h-[92px] px-4 pt-4">
                  <div className="skel h-4 w-1/3" />
                  <div className="skel mt-2 h-3 w-2/3" />
                  <div className="skel mt-2 h-3 w-1/4" />
                </li>
              ))}
            {items?.length === 0 && <li className="rounded-md border-2 border-dashed border-[var(--line)] p-6 text-center text-[var(--muted)]">Abhi koi nahi aaya. Is filter mein kuch nahi.</li>}
            {list.map((it, i) => (
              <Row
                key={it.id}
                it={it}
                i={i}
                active={i === cur}
                selected={selected.has(it.id)}
                shake={shakeId === it.id}
                onClick={() => {
                  setCur(i);
                  open(it);
                }}
                onPrimary={() => primary(it)}
                onArchive={() => act(it, "archive")}
              />
            ))}
          </ul>
        </section>

        {/* detail */}
        <section aria-label="Detail" className="min-w-0 lg:sticky lg:top-20 lg:self-start">
          {opened ? (
            <Detail
              it={opened}
              desk={desk}
              reply={reply}
              setReply={setReply}
              replyRef={replyRef}
              onAct={(k, p) => (k === "decline" ? setDeclineFor(opened) : act(opened, k, p, { immediate: k === "reply" }))}
              sendReply={() => {
                if (reply.trim()) {
                  act(opened, "reply", { body: reply.trim() }, { immediate: true });
                  setReply("");
                }
              }}
            />
          ) : (
            <div className="hidden rounded-md border-2 border-dashed border-[var(--line)] p-8 text-center text-[var(--muted)] lg:block">Koi chit kholo. J, K se chalo, Enter se kholo.</div>
          )}
        </section>
      </div>

      {declineFor && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Mana karne ki wajah">
          <div className="chit w-full max-w-sm px-5 pb-5 pt-6 text-[#1e1b18]">
            <p className="sign text-xl">Mana kyun?</p>
            <div className="mt-3 flex flex-col gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  className="btn justify-start"
                  autoFocus={p === PRESETS[0]}
                  onClick={() => {
                    act(declineFor, "decline", { reason: p });
                    setDeclineFor(null);
                  }}
                >
                  {p}
                </button>
              ))}
              <button
                className="btn justify-start"
                onClick={() => {
                  act(declineFor, "decline", { reason: "" });
                  setDeclineFor(null);
                }}
              >
                Bina wajah
              </button>
              <button className="btn" onClick={() => setDeclineFor(null)}>
                Ruko (Esc)
              </button>
            </div>
          </div>
        </div>
      )}

      {help && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Shortcuts" onClick={() => setHelp(false)}>
          <div className="chit w-full max-w-md px-5 pb-5 pt-6 text-[#1e1b18]" onClick={(e) => e.stopPropagation()}>
            <p className="sign text-xl">Galla shortcuts</p>
            <dl className="mono mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              {[
                ["J / K", "neeche / upar"],
                ["Enter", "kholo"],
                ["R", "jawab (Ctrl+Enter bhejo)"],
                ["B", "booking ya order pakka"],
                ["D", "mana karo"],
                ["P", "Paisa mila"],
                ["A", "archive"],
                ["U, Ctrl+Z", "undo"],
                ["X", "select"],
                ["Shift+A", "selected archive"],
                ["/", "search"],
                ["G then T", "aaj"],
                ["?", "yeh card"],
              ].map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="font-medium">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <button className="btn mt-4" onClick={() => setHelp(false)}>
              Band (Esc)
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-md border-2 border-[#1e1b18] px-4 py-2" role="status" style={{ background: toast.error ? "var(--sindoor)" : "#1e1b18", color: "#fff4e0", animation: "plane-land 250ms var(--spring-ui) both" }}>
          <span>{toast.text}</span>
          {toast.op && !toast.error && (
            <button className="mono min-h-11 px-2 text-[var(--haldi)] underline" onClick={() => undo(toast.op)}>
              Undo (U)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ it, i, active, selected, shake, onClick, onPrimary, onArchive }: { it: Item; i: number; active: boolean; selected: boolean; shake: boolean; onClick: () => void; onPrimary: () => void; onArchive: () => void }) {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const canPrimary = (it.type === "booking" && it.status === "pending") || (it.type === "chit" && (it.status === "new" || (it.data.kind === "order" && it.status === "read")));
  return (
    <li
      data-row={i}
      role="option"
      aria-selected={active}
      className={`relative overflow-hidden ${shake ? "shake" : ""}`}
      onTouchStart={(e) => (start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
      onTouchMove={(e) => {
        if (!start.current) return;
        const x = e.touches[0].clientX - start.current.x;
        const y = e.touches[0].clientY - start.current.y;
        if (Math.abs(x) > Math.abs(y)) setDx(Math.max(-140, Math.min(140, x)));
      }}
      onTouchEnd={() => {
        if (dx > 80 && canPrimary) onPrimary();
        else if (dx < -80) onArchive();
        setDx(0);
        start.current = null;
      }}
    >
      {dx !== 0 && (
        <div className="mono absolute inset-0 flex items-center justify-between px-4 text-sm uppercase" style={{ background: dx > 0 ? "var(--mint-enamel)" : "var(--tin)" }} aria-hidden="true">
          <span>{dx > 0 ? (it.type === "booking" ? "Pakka" : it.data.kind === "order" ? "Pakka" : "Padha") : ""}</span>
          <span>{dx < 0 ? "Archive" : ""}</span>
        </div>
      )}
      <div
        onClick={onClick}
        className="chit relative flex cursor-pointer gap-3 px-4 pb-3 pt-4"
        style={{ transform: `translateX(${dx}px)`, transition: dx === 0 ? "transform 330ms var(--spring-ui)" : "none", outline: active ? "3px solid var(--lane-a)" : undefined, outlineOffset: -3, opacity: it.status === "archived" ? 0.6 : 1 }}
      >
        {selected && <span className="absolute left-1 top-2 size-2.5 rounded-full bg-[var(--rani)]" aria-label="selected" />}
        <div className="min-w-0 flex-1 text-[#1e1b18]">
          <p className="flex items-center gap-2">
            <span className="mono rounded-sm border border-[#1e1b18] px-1 text-[0.65rem] uppercase">{it.type === "chit" && it.data.kind === "order" ? "Order" : TYPE_LABEL[it.type]}</span>
            <span className="truncate font-semibold">{title(it)}</span>
          </p>
          <p className="mt-0.5 truncate text-sm">{subline(it)}</p>
          <p className="mono mt-1 text-[0.7rem] text-[#4a4038]">{when(it.at)}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="mono rounded-sm px-1.5 text-[0.68rem] uppercase text-[#1e1b18]" style={{ background: statusTone[it.status] ?? "var(--tin)" }}>
            {it.status}
          </span>
          <div className="flex gap-1">
            {canPrimary && (
              <button
                type="button"
                className="btn !min-h-11 !px-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onPrimary();
                }}
              >
                {it.type === "chit" && it.data.kind !== "order" ? "Padha" : "Pakka"}
              </button>
            )}
            {it.status !== "archived" && (
              <button
                type="button"
                className="btn !min-h-11 !px-2"
                aria-label="Archive"
                onClick={(e) => {
                  e.stopPropagation();
                  onArchive();
                }}
              >
                A
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function Detail({ it, desk, reply, setReply, replyRef, onAct, sendReply }: { it: Item; desk: string; reply: string; setReply: (s: string) => void; replyRef: React.RefObject<HTMLTextAreaElement | null>; onAct: (k: string, p?: Record<string, string>) => void; sendReply: () => void }) {
  const d = it.data;
  return (
    <article className="chit px-5 pb-5 pt-6 text-[#1e1b18]" style={{ animation: "plane-land 250ms var(--spring-ui) both" }} aria-live="polite">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="mono text-xs uppercase text-[#4a4038]">
            {it.type === "chit" ? (d.kind === "order" ? "Order chit" : `Chit from ${d.scene}`) : TYPE_LABEL[it.type]} · {when(it.at)}
          </p>
          <h2 className="sign text-2xl">{title(it)}</h2>
        </div>
        {d.paid_at && <span className="stamp stamp-in text-lg">चुकता</span>}
      </div>
      {it.type === "chit" && (
        <>
          {d.kind === "order" && (
            <ul className="mono mt-3 space-y-0.5">
              {(d.lines ?? []).map((l: { qty: number; name: string; price_paise: number }, i: number) => (
                <li key={i} className="flex justify-between">
                  <span>
                    {l.qty} × {l.name}
                  </span>
                  <span>{rs(l.qty * l.price_paise)}</span>
                </li>
              ))}
              <li className="flex justify-between border-t-2 border-dashed border-[#1e1b18] pt-1">
                <span>TOTAL · pickup {d.pickup_day}</span>
                <span>{rs(d.total ?? 0)}</span>
              </li>
            </ul>
          )}
          <dl className="mt-3 space-y-1">
            {Object.entries(d.fields ?? {}).map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="mono shrink-0 text-xs uppercase text-[#4a4038]">{FIELD_NAMES[k] ?? k.replace(/_/g, " ")}</dt>
                <dd className="hand break-words">{String(v)}</dd>
              </div>
            ))}
          </dl>
          {d.has_file && (
            <a className="btn mt-2" href={`/api/galla/${desk}/file/${it.id}`} target="_blank" rel="noreferrer">
              Attachment kholo
            </a>
          )}
          {(d.replies ?? []).length > 0 && (
            <ul className="mt-3 space-y-2 border-t-2 border-dashed border-[#1e1b18]/30 pt-3">
              {d.replies.map((r: { body: string; at: string }, i: number) => (
                <li key={i} className="rounded bg-[#1e1b18]/5 p-2 text-sm">
                  <p className="whitespace-pre-wrap">{r.body}</p>
                </li>
              ))}
            </ul>
          )}
          <label className="lbl" htmlFor="g-reply">
            Jawab (R, Ctrl+Enter bhejo)
          </label>
          <textarea
            id="g-reply"
            ref={replyRef}
            rows={3}
            className="field"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                sendReply();
              }
            }}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="cta" onClick={sendReply} disabled={!reply.trim()}>
              Jawab bhejo
            </button>
            {d.kind === "order" && it.status !== "confirmed" && <button className="btn" onClick={() => onAct("confirm")}>Pakka (B)</button>}
            <button className="btn" onClick={() => onAct("paid")} disabled={!!d.paid_at}>
              Paisa mila (P)
            </button>
            <button className="btn" onClick={() => onAct("done")}>
              Ho gaya
            </button>
            <button className="btn" onClick={() => onAct("decline")}>
              Mana (D)
            </button>
            <button className="btn" onClick={() => onAct("archive")}>
              Archive (A)
            </button>
            <button className="btn" onClick={() => onAct("block")}>
              Sender block
            </button>
          </div>
          <p className="mono mt-3 text-xs">
            Visitor ka link:{" "}
            <a className="underline" href={`/c/${d.token}`} target="_blank" rel="noreferrer">
              /c/{String(d.token).slice(0, 8)}…
            </a>
          </p>
        </>
      )}
      {it.type === "booking" && (
        <>
          <p className="mono mt-3">
            {d.service?.en} · {when(d.start)} · seat {d.seat}
          </p>
          <p className="mt-1">{d.contact}</p>
          {d.note && <p className="hand mt-1">{d.note}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {it.status === "pending" && (
              <button className="cta" onClick={() => onAct("confirm")}>
                Pakka karo (B)
              </button>
            )}
            {["pending", "confirmed"].includes(it.status) && (
              <button className="btn" onClick={() => onAct("decline")}>
                Mana (D)
              </button>
            )}
            {it.status === "confirmed" && (
              <button className="btn" onClick={() => onAct("done")}>
                Ho gaya
              </button>
            )}
            <button className="btn" onClick={() => onAct("archive")}>
              Archive (A)
            </button>
          </div>
          <p className="mono mt-3 text-xs">
            <a className="underline" href={`/c/${d.token}`} target="_blank" rel="noreferrer">
              Visitor ka ticket
            </a>
          </p>
        </>
      )}
      {it.type === "subscriber" && (
        <>
          <p className="mt-3">{d.email}</p>
          <p className="mono text-xs">{d.confirmed_at ? `Confirmed ${when(d.confirmed_at)}` : "Confirm click ka intezaar"}</p>
          <button className="btn mt-3" onClick={() => onAct("archive")}>
            Archive (A)
          </button>
        </>
      )}
    </article>
  );
}

/** The ghanti: Web Push wakes this Galla on this device when a chit, booking or order lands. */
function PushToggle({ laneId }: { laneId: string }) {
  const [state, setState] = useState<"unknown" | "off" | "on" | "busy" | "blocked" | "unsupported" | "unset">("unknown");
  const [key, setKey] = useState<string | null>(null);
  const scope = `/studio/${laneId}/galla/`;
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState("unsupported");
      return;
    }
    fetch("/api/push/subscribe")
      .then((r) => r.json())
      .then(async (j: { key: string | null }) => {
        if (!j.key) return setState("unset");
        setKey(j.key);
        if (Notification.permission === "denied") return setState("blocked");
        const reg = await navigator.serviceWorker.getRegistration(scope);
        const sub = await reg?.pushManager.getSubscription();
        setState(sub ? "on" : "off");
      })
      .catch(() => setState("unset"));
  }, [scope]);
  if (state === "unknown" || state === "unset") return null;
  const toKey = (k: string) => {
    const b = atob(k.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - (k.length % 4)) % 4));
    return Uint8Array.from(b, (c) => c.charCodeAt(0));
  };
  async function toggle() {
    if (!key) return;
    setState("busy");
    try {
      const reg = await navigator.serviceWorker.register("/galla-sw.js", { scope });
      await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        await fetch("/api/push/subscribe", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ laneId, endpoint: existing.endpoint }) });
        await existing.unsubscribe();
        setState("off");
        return;
      }
      if ((await Notification.requestPermission()) !== "granted") return setState("blocked");
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(key) });
      const j = sub.toJSON();
      const r = await fetch("/api/push/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ laneId, endpoint: j.endpoint, keys: j.keys }) });
      setState(r.ok ? "on" : "off");
    } catch {
      setState("off");
    }
  }
  if (state === "unsupported") return <p className="text-xs text-[var(--muted)]">Is browser mein phone ghanti nahi chalti. Galla har 15 second mein khud dekhta hai.</p>;
  if (state === "blocked") return <p className="text-xs text-[var(--muted)]">Notifications band hain. Browser settings mein is site ko allow karo.</p>;
  return (
    <button type="button" className="btn justify-start" aria-pressed={state === "on"} disabled={state === "busy"} onClick={toggle}>
      {state === "on" ? "Ghanti on: is phone pe" : state === "busy" ? "Ruko..." : "Is phone pe ghanti bajao"}
    </button>
  );
}
