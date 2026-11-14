"use client";
// Menu Board: a tall chalk board, and the order chit that slides in beside it (stacked on phones).
// Stock is per day and enforced in one UPDATE ... WHERE sold + n <= cap; the board shows what is left.
import { useEffect, useMemo, useState } from "react";
import { WEEKDAYS_SHORT, weekdayOf } from "@/lib/time";
import { beacon, idemKey } from "./client";

type Item = { id: string; name: string; hi?: string; blurb: string; price_paise: number; cap: number | null };
const rs = (p: number) => "₹" + (p / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export function MenuBoard({ handle, items, days, pickupNote, mode, laneName, upiName }: { handle: string; items: Item[]; days: string[]; pickupNote: string; mode: "menu" | "catalogue"; laneName: string; upiName: string | null }) {
  const [day, setDay] = useState(days[0] ?? "");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [stock, setStock] = useState<Record<string, number> | null>(null);
  const [form, setForm] = useState({ name: "", contact: "", note: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ token: string; total: number; code: string; upi: string | null } | null>(null);
  const [qr, setQr] = useState<string>("");
  const [idem, setIdem] = useState("");
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => setIdem(idemKey()), []);
  useEffect(() => {
    if (!day) return;
    setStock(null);
    fetch(`/api/w/${handle}/live?day=${day}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setStock(j.stock ?? {}))
      .catch(() => setStock({}));
  }, [handle, day]);

  const lines = useMemo(() => items.filter((i) => (qty[i.id] ?? 0) > 0).map((i) => ({ ...i, qty: qty[i.id] })), [items, qty]);
  const total = lines.reduce((s, l) => s + l.qty * l.price_paise, 0);
  const leftOf = (i: Item) => (i.cap === null ? null : (stock?.[i.id] ?? i.cap));

  useEffect(() => {
    if (!done?.upi) return;
    if (/Android|iPhone|iPad/i.test(navigator.userAgent)) return;
    import("qrcode").then((Q) => Q.toString(done.upi!, { type: "svg", margin: 1, color: { dark: "#1e1b18", light: "#fff4e0" } }).then(setQr));
  }, [done]);

  const bump = (i: Item, d: number) => {
    const left = leftOf(i);
    const next = Math.max(0, (qty[i.id] ?? 0) + d);
    if (left !== null && next > left) {
      setFlash(i.id);
      window.setTimeout(() => setFlash(null), 380);
      setErr(`${i.name}: sirf ${left} bache`);
      return;
    }
    setErr("");
    setQty({ ...qty, [i.id]: Math.min(50, next) });
  };

  async function order(e: React.FormEvent) {
    e.preventDefault();
    if (!lines.length) return setErr("Pehle board se kuch chuno");
    if (form.name.trim().length < 2) return setErr("Naam likho");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.contact.trim()) && !/^\+?[\d\s-]{8,15}$/.test(form.contact.trim())) return setErr("Email ya WhatsApp number likho");
    setBusy(true);
    setErr("");
    try {
      const r = await fetch(`/api/w/${handle}/order`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lines: lines.map((l) => ({ item_id: l.id, qty: l.qty })), pickupDay: day, ...form, idem, website: "" }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 201 || r.status === 200) {
        setDone({ token: j.token, total: j.total, code: j.code, upi: j.upi });
        beacon(handle, "menu", "ordered");
      } else if (r.status === 409 && j.item) {
        setStock((s) => ({ ...(s ?? {}), [j.item]: j.left }));
        setQty((q) => ({ ...q, [j.item]: Math.min(q[j.item] ?? 0, j.left) }));
        setErr(j.error);
        setIdem(idemKey());
      } else setErr(j.error ?? "Order nahi gaya");
    } catch {
      setErr("Network nahi hai. Order nahi gaya, dobara bhejo.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="chit mx-auto max-w-md px-5 pb-5 pt-6" role="status" style={{ animation: "plane-land 330ms var(--spring-soft) both" }}>
        <p className="mono text-[#4a4038]">ORDER {done.code}</p>
        <p className="sign mt-1 text-3xl text-[#1e1b18]">Order chala gaya.</p>
        <ul className="mono mt-3 space-y-1 text-[#1e1b18]">
          {lines.map((l) => (
            <li key={l.id} className="flex justify-between gap-3">
              <span>
                {l.qty} × {l.name}
              </span>
              <span>{rs(l.qty * l.price_paise)}</span>
            </li>
          ))}
          <li className="flex justify-between border-t-2 border-dashed border-[#1e1b18] pt-1 font-medium">
            <span>TOTAL</span>
            <span>{rs(done.total)}</span>
          </li>
        </ul>
        {done.upi ? (
          <div className="mt-4">
            <a href={done.upi} className="cta w-full">
              UPI se {rs(done.total)} bhejo
            </a>
            {qr && <div className="mx-auto mt-3 w-44 border-2 border-[#1e1b18] p-1" aria-label="UPI QR code" dangerouslySetInnerHTML={{ __html: qr }} />}
            <p className="mt-2 text-sm text-[#1e1b18]">UPI app khulega. Paise seedhe {upiName ?? laneName} ko jaate hain.</p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-[#1e1b18]">{laneName} payment ka tareeka WhatsApp pe batayenge.</p>
        )}
        <p className="mt-3 text-sm text-[#1e1b18]">
          <span className="font-semibold">Payment ki pushti baaki.</span> Jab {laneName} &quot;Paisa mila&quot; dabayenge, aapki chit pe चुकता lag jayega.
        </p>
        <a className="btn mt-3" href={`/c/${done.token}`}>
          Order ka status
        </a>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr] lg:items-start">
      <div className="relative rounded-md border-[10px] border-[#3b2a12] p-5 text-[#fff4e0] shadow-[var(--shadow-paper)]" style={{ background: "#24302b", backgroundImage: "radial-gradient(rgba(255,255,255,.05) 1px, transparent 1px)", backgroundSize: "7px 7px" }}>
        <p className="sign text-3xl text-[var(--haldi)]">{mode === "menu" ? "Aaj ka menu" : "Naya maal"}</p>
        <p className="mono mt-1 text-[#fff4e0]/75">{pickupNote}</p>
        <ul className="mt-4 divide-y divide-dashed divide-[#fff4e0]/25">
          {items.map((i) => {
            const left = leftOf(i);
            const out = left !== null && left <= 0;
            return (
              <li key={i.id} className={`flex items-center gap-3 py-3 ${flash === i.id ? "shake" : ""}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-semibold leading-tight" style={{ fontFamily: "var(--f-sign)" }}>
                    {i.name} {i.hi && <span className="font-deva text-base font-normal text-[#fff4e0]/70">{i.hi}</span>}
                  </p>
                  <p className="text-sm text-[#fff4e0]/70">{i.blurb}</p>
                  <p className="mono mt-0.5 text-[var(--haldi)]">
                    {rs(i.price_paise)}
                    {left !== null && <span className={`ml-2 ${out ? "text-[var(--rani)]" : left <= 3 ? "text-[var(--marigold)]" : "text-[#fff4e0]/60"}`}>{stock === null ? "…" : out ? "aaj khatam" : `${left} bache`}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" className="grid size-11 place-items-center rounded border-2 border-[#fff4e0]/60 text-xl" aria-label={`${i.name} kam karo`} onClick={() => bump(i, -1)} disabled={!qty[i.id]}>
                    −
                  </button>
                  <span className="mono w-7 text-center text-lg" aria-live="polite">
                    {qty[i.id] ?? 0}
                  </span>
                  <button type="button" className="grid size-11 place-items-center rounded border-2 border-[#fff4e0]/60 text-xl disabled:opacity-40" aria-label={`${i.name} badhao`} onClick={() => bump(i, 1)} disabled={out}>
                    +
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <form onSubmit={order} className="chit px-4 pb-5 pt-6 lg:sticky lg:top-20" style={{ animation: "chit-in 450ms var(--spring-soft) both" }}>
        <style>{`@keyframes chit-in{from{transform:translateX(40px) rotate(2deg);opacity:0}to{transform:none;opacity:1}}`}</style>
        <p className="sign text-xl text-[#1e1b18]">Order chit</p>
        {lines.length ? (
          <ul className="mono mt-2 space-y-0.5 text-[#1e1b18]">
            {lines.map((l) => (
              <li key={l.id} className="flex justify-between">
                <span>
                  {l.qty} × {l.name}
                </span>
                <span>{rs(l.qty * l.price_paise)}</span>
              </li>
            ))}
            <li className="flex justify-between border-t-2 border-dashed border-[#1e1b18] pt-1 font-medium">
              <span>TOTAL</span>
              <span>{rs(total)}</span>
            </li>
          </ul>
        ) : (
          <p className="mt-2 text-sm text-[#4a4038]">Board pe + dabao, chit yahan bharegi.</p>
        )}
        <p className="lbl">Pickup ka din</p>
        <div className="no-scrollbar mt-1 flex gap-1.5 overflow-x-auto" data-noswipe>
          {days.map((d) => (
            <button key={d} type="button" className="btn shrink-0" aria-pressed={d === day} onClick={() => setDay(d)}>
              {WEEKDAYS_SHORT[weekdayOf(d)]} {Number(d.slice(8))}
            </button>
          ))}
        </div>
        <label className="lbl" htmlFor="o-name">
          Naam *
        </label>
        <input id="o-name" className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" maxLength={80} />
        <label className="lbl" htmlFor="o-contact">
          WhatsApp ya email *
        </label>
        <input id="o-contact" className="field" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} maxLength={120} />
        <label className="lbl" htmlFor="o-note">
          Note (optional)
        </label>
        <input id="o-note" className="field" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={300} />
        {err && (
          <p className="err mt-2" role="alert">
            {err}
          </p>
        )}
        <button className="cta mt-4 w-full" disabled={busy || !lines.length}>
          {busy ? "Bhej rahe hain…" : lines.length ? `Order bhejo, ${rs(total)}` : "Order bhejo"}
        </button>
      </form>
    </div>
  );
}
