"use client";
// Pehla Kadam: four steps on one screen, and the lane builds itself behind them as you answer.
import { useEffect, useMemo, useRef, useState } from "react";
import { Facade } from "@/components/art/facades";
import { KitDefs } from "@/components/art/kit";
import { dna, newSeed, type Pins } from "@/lib/dna";
import { triadVars } from "@/lib/palette";
import { TRADES, HOURS_PRESETS, type TradeKey } from "@/lib/trades";
import { WEEKDAYS_SHORT } from "@/lib/time";

type Rule = { weekday: number; opens: string; closes: string };
const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 30)
    .replace(/^-|-$/g, "");

const TZS = ["Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Europe/London", "America/New_York", "America/Los_Angeles", "Australia/Sydney"];

export function PehlaKadam({ loggedIn, remix }: { loggedIn: boolean; remix: { handle: string; name: string; seed: number; pins: Pins } | null }) {
  const [step, setStep] = useState(1);
  const [trade, setTrade] = useState<TradeKey | null>(null);
  const [name, setName] = useState("");
  const [nameHi, setNameHi] = useState("");
  const [handle, setHandle] = useState("");
  const [handleTouched, setHandleTouched] = useState(false);
  const [avail, setAvail] = useState<{ ok: boolean; why: string } | null>(null);
  const [whatsapp, setWhatsapp] = useState("");
  const [upi, setUpi] = useState("");
  const [city, setCity] = useState("");
  const [preset, setPreset] = useState<"day" | "evening" | "appointment">("day");
  const [rules, setRules] = useState<Rule[]>(HOURS_PRESETS.day.rules);
  const [tz, setTz] = useState("Asia/Kolkata");
  const [seeds, setSeeds] = useState<number[]>(() => (remix ? [remix.seed, remix.seed + 1, remix.seed + 2] : [1, 2, 3]));
  const [pick, setPick] = useState(0);
  const [lt, setLt] = useState("");
  const [links, setLinks] = useState<{ label: string; url: string }[]>([]);
  const [ltMsg, setLtMsg] = useState("");
  const [acct, setAcct] = useState({ email: "", password: "", mode: "signup" as "signup" | "login" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const t0 = useRef(Date.now());

  useEffect(() => {
    try {
      setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata");
    } catch {}
    if (!remix) setSeeds([newSeed(), newSeed(), newSeed()]);
  }, [remix]);

  useEffect(() => {
    if (!handleTouched) setHandle(slug(name));
  }, [name, handleTouched]);

  useEffect(() => {
    if (handle.length < 3) {
      setAvail(null);
      return;
    }
    const id = window.setTimeout(async () => {
      const r = await fetch(`/api/handle-available?h=${encodeURIComponent(handle)}`).catch(() => null);
      if (r?.ok) setAvail(await r.json());
    }, 300);
    return () => window.clearTimeout(id);
  }, [handle]);

  const pins = remix?.pins ?? {};
  const seed = seeds[pick];
  const d = useMemo(() => dna(seed, pins), [seed, pins]);
  const shownName = name || "Aapki dukaan";

  const next = () => {
    setErr("");
    if (step === 1 && !trade) return setErr("Ek signboard chuno");
    if (step === 2) {
      if (name.trim().length < 2) return setErr("Dukaan ka naam likho");
      if (!avail?.ok) return setErr(avail?.why || "Handle check ho raha hai");
      if (upi && !/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upi)) return setErr("UPI ID aisi dikhti hai: naam@okbank");
    }
    setStep((s) => Math.min(4, s + 1));
  };

  async function importLinks() {
    setLtMsg("Le rahe hain…");
    const r = await fetch("/api/studio/linktree", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: lt }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (r?.ok) {
      setLinks(j.links);
      setLtMsg(`${j.links.length} links mile, noticeboard pe lagenge`);
    } else setLtMsg(j.error ?? "Nahi hua");
  }

  async function finish() {
    setErr("");
    if (!loggedIn && (!acct.email || acct.password.length < 8)) return setErr("Email aur 8+ character ka password");
    setBusy(true);
    const r = await fetch("/api/studio/new", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        trade,
        name: name.trim(),
        nameHi: nameHi.trim() || undefined,
        handle,
        tz,
        hours: preset === "appointment" ? [] : rules,
        whatsapp,
        upi,
        city,
        seed,
        pins: remix?.pins,
        links,
        remix: remix?.handle ?? null,
        account: loggedIn ? undefined : acct,
      }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) return setErr(j.error ?? "Network nahi hai");
    try {
      sessionStorage.setItem("galli-onboard-ms", String(Date.now() - t0.current));
    } catch {}
    location.href = `/studio/${j.laneId}/edit?new=1`;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_420px]" style={triadVars(d.palette) as React.CSSProperties}>
      <KitDefs awning={d.awning} />
      <section className="order-2 lg:order-1">
        <ol className="mono flex gap-2 text-xs uppercase" aria-label="Steps">
          {["Kaam", "Naam", "Samay", "Galli"].map((s, i) => (
            <li key={s} className="flex items-center gap-1">
              <span className="grid size-7 place-items-center rounded-full border-2 border-[var(--soot)]" style={{ background: step > i ? "var(--soot)" : "transparent", color: step > i ? "var(--chalk)" : "var(--soot)" }}>
                {i + 1}
              </span>
              <span className="hidden sm:inline">{s}</span>
            </li>
          ))}
        </ol>
        {remix && <p className="mono mt-3 rounded bg-[var(--haldi)] px-2 py-1 text-xs text-[#1e1b18]">Remix: {remix.name} ka dhaancha (buildings, seed, pins). Unka text, photos, prices kuch nahi aata.</p>}

        <div key={step} className="mt-5" style={{ animation: "plane-land 330ms var(--spring-ui) both" }}>
          {step === 1 && (
            <fieldset>
              <legend className="mast t-mast">Aap kya karte ho?</legend>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(Object.values(TRADES) as (typeof TRADES)[TradeKey][]).map((tr, i) => (
                  <button
                    key={tr.key}
                    type="button"
                    aria-pressed={trade === tr.key}
                    onClick={() => setTrade(tr.key)}
                    className="relative min-h-24 rounded-[5px] border-2 border-[#1e1b18] p-3 text-left transition-transform active:scale-[.97]"
                    style={{ background: trade === tr.key ? "var(--lane-a)" : ["var(--lane-b)", "var(--lane-c)", "var(--tin)", "var(--paper)"][i % 4], color: trade === tr.key ? "var(--on-lane-a)" : i % 4 === 0 ? "var(--on-lane-b)" : "#1e1b18", transform: `rotate(${((i % 3) - 1) * 0.8}deg)`, boxShadow: "var(--shadow-paper-sm)" }}
                  >
                    {[0, 1].map((k) => (
                      <span key={k} className="absolute top-1.5 size-2 rounded-full border border-[#1e1b18] bg-[#cfc6b4]" style={{ [k ? "right" : "left"]: 6 }} aria-hidden="true" />
                    ))}
                    <span className="sign block text-2xl leading-none">{tr.hi}</span>
                    <span className="mt-1 block text-sm font-semibold leading-tight">{tr.label}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {step === 2 && (
            <div className="grid max-w-xl gap-3">
              <h2 className="mast t-mast">Naam aur pata</h2>
              <label className="mono text-xs uppercase" htmlFor="pk-name">
                Dukaan ka naam
              </label>
              <input id="pk-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus />
              <label className="mono text-xs uppercase" htmlFor="pk-hi">
                Hindi mein (optional)
              </label>
              <input id="pk-hi" className="input font-deva" value={nameHi} onChange={(e) => setNameHi(e.target.value)} maxLength={60} placeholder="जैसे: मीठी रसोई" />
              <label className="mono text-xs uppercase" htmlFor="pk-handle">
                Galli ka pata
              </label>
              <div className="flex items-center gap-1">
                <span className="mono text-sm text-[var(--muted)]">/w/</span>
                <input
                  id="pk-handle"
                  className="input"
                  value={handle}
                  onChange={(e) => {
                    setHandleTouched(true);
                    setHandle(slug(e.target.value));
                  }}
                  maxLength={30}
                  aria-describedby="pk-handle-msg"
                />
              </div>
              <p id="pk-handle-msg" className="text-sm" aria-live="polite" style={{ color: avail ? (avail.ok ? "var(--peacock)" : "var(--sindoor)") : "var(--muted)" }}>
                {handle.length < 3 ? "Kam se kam 3 akshar" : avail === null ? "Check ho raha hai…" : avail.ok ? "Khaali hai, aapka" : avail.why}
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-sm">
                  <span className="mono block text-xs uppercase">WhatsApp</span>
                  <input className="input" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} inputMode="tel" placeholder="+91 98…" />
                </label>
                <label className="text-sm">
                  <span className="mono block text-xs uppercase">UPI ID</span>
                  <input className="input" value={upi} onChange={(e) => setUpi(e.target.value.trim())} placeholder="naam@okbank" />
                </label>
                <label className="text-sm">
                  <span className="mono block text-xs uppercase">Shehar</span>
                  <input className="input" value={city} onChange={(e) => setCity(e.target.value)} maxLength={60} />
                </label>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="max-w-2xl">
              <h2 className="mast t-mast">Kab khule ho?</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["day", "evening", "appointment"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className="btn"
                    aria-pressed={preset === p}
                    onClick={() => {
                      setPreset(p);
                      setRules(HOURS_PRESETS[p].rules);
                    }}
                  >
                    {HOURS_PRESETS[p].label}
                  </button>
                ))}
              </div>
              {preset !== "appointment" && (
                <table className="mt-4 w-full max-w-md">
                  <tbody>
                    {[1, 2, 3, 4, 5, 6, 0].map((w) => {
                      const r = rules.find((x) => x.weekday === w);
                      return (
                        <tr key={w} className="border-b border-dashed border-[var(--line)]">
                          <td className="py-1">
                            <label className="flex min-h-11 items-center gap-2">
                              <input
                                type="checkbox"
                                className="size-5"
                                checked={!!r}
                                onChange={(e) => setRules(e.target.checked ? [...rules, { weekday: w, opens: "10:00", closes: "19:00" }] : rules.filter((x) => x.weekday !== w))}
                              />
                              <span className="mono">{WEEKDAYS_SHORT[w]}</span>
                            </label>
                          </td>
                          <td>{r && <input aria-label={`${WEEKDAYS_SHORT[w]} opens`} type="time" className="input" value={r.opens} onChange={(e) => setRules(rules.map((x) => (x.weekday === w ? { ...x, opens: e.target.value } : x)))} />}</td>
                          <td>{r && <input aria-label={`${WEEKDAYS_SHORT[w]} closes`} type="time" className="input" value={r.closes} onChange={(e) => setRules(rules.map((x) => (x.weekday === w ? { ...x, closes: e.target.value } : x)))} />}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              <label className="mt-4 block text-sm">
                <span className="mono block text-xs uppercase">Timezone</span>
                <select className="input max-w-xs" value={tz} onChange={(e) => setTz(e.target.value)}>
                  {[...new Set([tz, ...TZS])].map((z) => (
                    <option key={z}>{z}</option>
                  ))}
                </select>
              </label>
              <details className="mt-5 rounded-md border-2 border-dashed border-[var(--line)] p-3">
                <summary className="cursor-pointer font-semibold">Quick fill: Linktree se links lao (optional)</summary>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input className="input max-w-sm" placeholder="https://linktr.ee/…" value={lt} onChange={(e) => setLt(e.target.value)} />
                  <button type="button" className="btn" onClick={importLinks} disabled={!lt.startsWith("https://")}>
                    Links lao
                  </button>
                </div>
                {ltMsg && <p className="mt-1 text-sm">{ltMsg}</p>}
                <ul className="mt-1 text-sm">
                  {links.map((l) => (
                    <li key={l.url} className="truncate">
                      {l.label}
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="mast t-mast">Apni galli chuno</h2>
              <p className="text-[var(--muted)]">Teen galliyan, ek hi dukaan. Pasand nahi? Phir se phenko.</p>
              <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-4">
                {seeds.map((s, i) => {
                  const dd = dna(s, pins);
                  return (
                    <button key={s + "-" + i} type="button" aria-pressed={pick === i} onClick={() => setPick(i)} className="rounded-md border-2 border-[var(--soot)] p-1 transition-transform active:scale-[.97]" style={{ ...(triadVars(dd.palette) as React.CSSProperties), outline: pick === i ? "4px solid var(--marigold)" : undefined, outlineOffset: 2 }}>
                      <Facade scene="gate" ctx={{ dna: dd, name: shownName, hi: nameHi || undefined, seed: s }} />
                      <span className="mono mt-1 block text-xs">Galli {i + 1}</span>
                    </button>
                  );
                })}
              </div>
              <button type="button" className="btn mt-3" onClick={() => setSeeds([newSeed(), newSeed(), newSeed()])}>
                Dice: phir se (3 nayi)
              </button>
              {!loggedIn && (
                <div className="chit mt-6 max-w-md px-5 pb-5 pt-6 text-[#1e1b18]">
                  <p className="sign text-xl">Galli ko apne naam karo</p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" className="btn" aria-pressed={acct.mode === "signup"} onClick={() => setAcct({ ...acct, mode: "signup" })}>
                      Naya account
                    </button>
                    <button type="button" className="btn" aria-pressed={acct.mode === "login"} onClick={() => setAcct({ ...acct, mode: "login" })}>
                      Pehle se hai
                    </button>
                  </div>
                  <label className="lbl" htmlFor="pk-email">
                    Email
                  </label>
                  <input id="pk-email" type="email" className="field" value={acct.email} onChange={(e) => setAcct({ ...acct, email: e.target.value })} autoComplete="email" />
                  <label className="lbl" htmlFor="pk-pw">
                    Password (8+)
                  </label>
                  <input id="pk-pw" type="password" className="field" value={acct.password} onChange={(e) => setAcct({ ...acct, password: e.target.value })} autoComplete={acct.mode === "signup" ? "new-password" : "current-password"} />
                </div>
              )}
            </div>
          )}
        </div>
        {err && (
          <p className="err mt-3 text-base" role="alert">
            {err}
          </p>
        )}
        <div className="mt-6 flex gap-2">
          {step > 1 && (
            <button type="button" className="btn" onClick={() => setStep((s) => s - 1)}>
              ← Peeche
            </button>
          )}
          {step < 4 ? (
            <button type="button" className="cta" onClick={next}>
              Aage →
            </button>
          ) : (
            <button type="button" className="cta" onClick={finish} disabled={busy}>
              {busy ? "Galli ban rahi hai…" : "Banao"}
            </button>
          )}
        </div>
      </section>

      {/* the lane builds itself behind the steps */}
      <aside className="order-1 lg:order-2 lg:sticky lg:top-6 lg:self-start" aria-label="Live preview">
        <div className="mx-auto max-w-[280px] lg:max-w-none">
          <Facade scene="gate" ctx={{ dna: d, name: shownName, hi: nameHi || undefined, seed }} label={`Preview of ${shownName}`} />
          <p className="mono mt-2 text-center text-xs text-[var(--muted)]">
            {handle ? `apnigalli.vercel.app/w/${handle}` : "aapki galli yahan banegi"}
            {trade ? ` · ${TRADES[trade].scenes.length + 1} makaan` : ""}
          </p>
        </div>
      </aside>
    </div>
  );
}
