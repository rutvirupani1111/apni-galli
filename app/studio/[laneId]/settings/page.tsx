// Settings: hours, closures, services, menu, notes, contact and UPI, postcards, outbox, export, delete.
// Every form is a server action (works without JavaScript), runs as the owner under RLS, and revalidates
// the public lane so visitors see the change.
import { redirect } from "next/navigation";
import { ownLane } from "@/lib/auth";
import { withOwner, type Q } from "@/lib/db";
import type { LaneDoc } from "@/lib/doc";
import { revalidateLane, safeUrl, type MenuRow, type NoteRow, type ServiceRow } from "@/lib/lane";
import { rupees, UPI_RE } from "@/lib/money";
import { WEEKDAYS } from "@/lib/time";
import { queueMail } from "@/lib/email";
import { signToken } from "@/lib/crypto";
import { baseUrl } from "@/lib/visitor";

export const metadata = { title: "Settings", robots: { index: false } };

const S = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const N = (f: FormData, k: string, d = 0) => (Number.isFinite(Number(S(f, k))) && S(f, k) !== "" ? Math.round(Number(S(f, k))) : d);
const HM = /^\d{2}:\d{2}$/;

async function guard(laneId: string) {
  const own = await ownLane(laneId);
  if (!own) redirect("/login");
  return own;
}
async function run(laneId: string, fn: (q: Q, ownerId: string) => Promise<string | void>, anchor: string) {
  const own = await guard(laneId);
  let msg = "Saved";
  try {
    const handle = await withOwner(own.owner.id, async (q) => {
      const m = await fn(q, own.owner.id);
      if (m) msg = m;
      return (await q.query<{ handle: string }>("select handle from lanes where id = $1", [laneId]))[0].handle;
    });
    revalidateLane(handle);
  } catch (e) {
    msg = (e as Error).message.slice(0, 140);
  }
  redirect(`/studio/${laneId}/settings?msg=${encodeURIComponent(msg)}#${anchor}`);
}

export default async function Settings({ params, searchParams }: { params: Promise<{ laneId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { laneId } = await params;
  const sp = await searchParams;
  const own = await guard(laneId);
  const data = await withOwner(own.owner.id, async (q) => {
    const lane = (await q.query<{ handle: string; draft: LaneDoc; tz: string; listed: boolean; resource_id: string }>("select l.handle, l.draft, l.tz, l.listed, (select id from resources r where r.lane_id = l.id limit 1) as resource_id from lanes l where l.id = $1", [laneId]))[0];
    const hours = await q.query<{ weekday: number; opens: string; closes: string }>("select weekday, to_char(opens,'HH24:MI') as opens, to_char(closes,'HH24:MI') as closes from hours_rules where lane_id = $1 order by weekday, opens", [laneId]);
    const closures = await q.query<{ id: string; f: string; t: string; note: string | null }>("select id, to_char(lower(during),'YYYY-MM-DD') as f, to_char(upper(during)-1,'YYYY-MM-DD') as t, note from closures where lane_id = $1 order by lower(during)", [laneId]);
    const services = await q.query<ServiceRow>("select * from services where lane_id = $1 order by sort, minutes", [laneId]);
    const menu = await q.query<MenuRow>("select id, name, blurb, price_paise, daily_cap, active, sort from menu_items where lane_id = $1 order by sort", [laneId]);
    const notes = await q.query<NoteRow>("select id, label, url, show_from, show_until, clicks, sort from notes where lane_id = $1 order by sort", [laneId]);
    const subs = await q.query<{ n: number }>("select count(*)::int as n from subscribers where lane_id = $1 and status = 'confirmed'", [laneId]);
    const postcards = await q.query<{ id: string; subject: string; status: string; sent_count: number; created_at: string }>("select id, subject, status, sent_count, created_at from postcards where lane_id = $1 order by created_at desc limit 10", [laneId]);
    const outbox = await q.query<{ to_addr: string; kind: string; subject: string; delivered: string; created_at: string }>("select to_addr, kind, subject, delivered, created_at from outbox_emails where lane_id = $1 order by created_at desc limit 30", [laneId]);
    return { lane, hours, closures, services, menu, notes, subs: subs[0].n, postcards, outbox };
  });
  const { lane } = data;

  async function saveHours(f: FormData) {
    "use server";
    await run(
      laneId,
      async (q, ownerId) => {
        const rows: [number, string, string][] = [];
        for (let w = 0; w < 7; w++) {
          if (f.get(`on_${w}`) && HM.test(S(f, `o_${w}`)) && HM.test(S(f, `c_${w}`)) && S(f, `o_${w}`) !== S(f, `c_${w}`)) rows.push([w, S(f, `o_${w}`), S(f, `c_${w}`)]);
        }
        await q.query("delete from hours_rules where lane_id = $1", [laneId]);
        for (const [w, o, c] of rows) await q.query("insert into hours_rules (lane_id, owner_id, weekday, opens, closes) values ($1,$2,$3,$4,$5)", [laneId, ownerId, w, o, c]);
        return `Hours saved (${rows.length} din)`;
      },
      "hours",
    );
  }
  async function addClosure(f: FormData) {
    "use server";
    await run(
      laneId,
      async (q, ownerId) => {
        const a = S(f, "from");
        const b = S(f, "to") || a;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b) || b < a) throw new Error("Dates sahi nahi");
        await q.query("insert into closures (lane_id, owner_id, during, note) values ($1,$2, daterange($3::date, $4::date, '[]'), $5)", [laneId, ownerId, a, b, S(f, "note").slice(0, 80) || null]);
        return "Chhutti lag gayi";
      },
      "hours",
    );
  }
  async function delClosure(f: FormData) {
    "use server";
    await run(laneId, async (q) => void (await q.query("delete from closures where id = $1 and lane_id = $2", [S(f, "id"), laneId])), "hours");
  }
  async function saveService(f: FormData) {
    "use server";
    await run(
      laneId,
      async (q, ownerId) => {
        const id = S(f, "id");
        const vals = [
          JSON.stringify({ en: S(f, "name").slice(0, 60) || "Service", hi: S(f, "hi").slice(0, 60) || undefined }),
          Math.min(600, Math.max(10, N(f, "minutes", 30))),
          Math.min(50, Math.max(1, N(f, "capacity", 1))),
          Math.min(240, Math.max(0, N(f, "buffer_before"))),
          Math.min(240, Math.max(0, N(f, "buffer_after"))),
          Math.max(0, N(f, "min_notice_min", 120)),
          Math.min(90, Math.max(1, N(f, "max_days_ahead", 30))),
          !!f.get("auto_confirm"),
          S(f, "price") ? Math.round(Number(S(f, "price")) * 100) : null,
          !!f.get("active"),
        ];
        if (id) await q.query("update services set name=$2, minutes=$3, capacity=$4, buffer_before=$5, buffer_after=$6, min_notice_min=$7, max_days_ahead=$8, auto_confirm=$9, price_paise=$10, active=$11 where id=$1 and lane_id=$12", [id, ...vals, laneId]);
        else await q.query("insert into services (lane_id, owner_id, resource_id, name, minutes, capacity, buffer_before, buffer_after, min_notice_min, max_days_ahead, auto_confirm, price_paise, active, sort) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true,99)", [laneId, ownerId, lane.resource_id, ...vals.slice(0, 9)]);
        return "Service saved";
      },
      "services",
    );
  }
  async function saveItem(f: FormData) {
    "use server";
    await run(
      laneId,
      async (q, ownerId) => {
        const id = S(f, "id");
        const price = Math.round(Number(S(f, "price")) * 100);
        if (!Number.isFinite(price) || price < 0) throw new Error("Price sahi nahi");
        const cap = S(f, "cap") === "" ? null : Math.min(10000, Math.max(0, N(f, "cap")));
        const name = JSON.stringify({ en: S(f, "name").slice(0, 60) || "Item", hi: S(f, "hi").slice(0, 60) || undefined });
        if (id) await q.query("update menu_items set name=$2, blurb=$3, price_paise=$4, daily_cap=$5, active=$6 where id=$1 and lane_id=$7", [id, name, S(f, "blurb").slice(0, 160), price, cap, !!f.get("active"), laneId]);
        else await q.query("insert into menu_items (lane_id, owner_id, name, blurb, price_paise, daily_cap, sort) values ($1,$2,$3,$4,$5,$6,99)", [laneId, ownerId, name, S(f, "blurb").slice(0, 160), price, cap]);
        // today's and future stock rows follow the new cap
        if (id && cap !== null) await q.query("update item_day_stock set cap = greatest($2, sold) where item_id = $1 and day >= current_date", [id, cap]);
        return "Menu saved";
      },
      "menu",
    );
  }
  async function saveNote(f: FormData) {
    "use server";
    await run(
      laneId,
      async (q, ownerId) => {
        const url = safeUrl(S(f, "url"));
        if (!url) throw new Error("Sirf https, http, mailto, tel, upi ya wa.me links");
        await q.query("insert into notes (lane_id, owner_id, label, url, show_from, show_until, sort) values ($1,$2,$3,$4,$5,$6,(select coalesce(max(sort),0)+1 from notes where lane_id = $1))", [
          laneId,
          ownerId,
          S(f, "label").slice(0, 80) || url,
          url,
          S(f, "from") || null,
          S(f, "until") || null,
        ]);
        return "Note lag gayi";
      },
      "notes",
    );
  }
  async function delNote(f: FormData) {
    "use server";
    await run(laneId, async (q) => void (await q.query("delete from notes where id = $1 and lane_id = $2", [S(f, "id"), laneId])), "notes");
  }
  async function saveContact(f: FormData) {
    "use server";
    await run(
      laneId,
      async (q) => {
        const vpa = S(f, "vpa");
        if (vpa && !UPI_RE.test(vpa)) throw new Error("UPI ID aisi: naam@okbank");
        const patch = { whatsapp: S(f, "whatsapp").slice(0, 20) || undefined, phone: S(f, "phone").slice(0, 20) || undefined, email: S(f, "email").slice(0, 160) || undefined, address: S(f, "address").slice(0, 200) || undefined, mapQuery: S(f, "map").slice(0, 120) || undefined };
        await q.query(
          `update lanes set draft = jsonb_set(jsonb_set(jsonb_set(draft, '{contact}', $2::jsonb), '{upi}', $3::jsonb), '{showRemixes}', to_jsonb($5::boolean)), listed = $4, draft_version = draft_version + 1 where id = $1`,
          [laneId, JSON.stringify(patch), JSON.stringify({ vpa: vpa || undefined, name: S(f, "upi_name").slice(0, 60) || undefined }), !!f.get("listed"), !!f.get("remixes")],
        );
        return "Saved in draft. Edit tab se Publish karo to live hoga (listing turant).";
      },
      "contact",
    );
  }
  async function sendPostcard(f: FormData) {
    "use server";
    await run(
      laneId,
      async (q, ownerId) => {
        const subject = S(f, "subject").slice(0, 120);
        const body = S(f, "body").slice(0, 5000);
        if (!subject || !body) throw new Error("Subject aur body likho");
        const sentToday = (await q.query<{ n: number }>("select count(*)::int as n from postcard_sends where owner_id = $1 and sent_at > now() - interval '1 day'", [ownerId]))[0].n;
        const quota = Math.max(0, 100 - sentToday);
        const subs = await q.query<{ id: string; email: string }>("select id, email from subscribers where lane_id = $1 and status = 'confirmed' order by created_at", [laneId]);
        const pc = await q.query<{ id: string }>("insert into postcards (lane_id, owner_id, subject, body, status) values ($1,$2,$3,$4,'sending') returning id", [laneId, ownerId, subject, body]);
        let sent = 0;
        for (const s of subs) {
          const fresh = sent < quota;
          await q.query("insert into postcard_sends (postcard_id, subscriber_id, owner_id, sent_at) values ($1,$2,$3,$4)", [pc[0].id, s.id, ownerId, fresh ? new Date().toISOString() : null]);
          if (!fresh) continue;
          const unsub = `${baseUrl()}/n/unsub/${encodeURIComponent(await signToken({ s: s.id, a: "unsub" }, 365))}`;
          await queueMail(q, { laneId, ownerId, to: s.email, kind: "postcard", subject, text: `${body}\n\n---\n${lane.draft.name} · /w/${lane.handle}\nUnsubscribe in one click: ${unsub}`, unsubscribeUrl: unsub, replyTo: own.owner.email });
          sent++;
        }
        await q.query("update postcards set status = $2, sent_count = $3 where id = $1", [pc[0].id, sent === subs.length ? "sent" : "queued", sent]);
        return sent === subs.length ? `Postcard ${sent} logon ko gaya` : `${sent} ko gaya. Baaki ${subs.length - sent}: kal subah tak sab ko jayega (daily quota 100).`;
      },
      "postbox",
    );
  }
  async function deleteLane(f: FormData) {
    "use server";
    const o = await guard(laneId);
    if (S(f, "confirm") !== lane.handle) redirect(`/studio/${laneId}/settings?msg=${encodeURIComponent("Handle type karo delete ke liye")}#danger`);
    const h = await withOwner(o.owner.id, async (q) => (await q.query<{ handle: string }>("delete from lanes where id = $1 returning handle", [laneId]))[0]?.handle);
    if (h) revalidateLane(h);
    redirect("/studio");
  }

  const card = "rounded-md border-2 border-[var(--soot)] bg-[var(--chalk)] p-4";
  return (
    <div className="space-y-8">
      <h1 className="mast text-4xl">Settings</h1>
      {sp.msg && (
        <p role="status" className="rounded-md border-2 border-[var(--soot)] bg-[var(--haldi)] px-3 py-2 text-[#1e1b18]">
          {sp.msg}
        </p>
      )}

      <section id="hours" className={card}>
        <h2 className="sign text-2xl">Hours ({lane.tz})</h2>
        <form action={saveHours} className="mt-2">
          <table className="w-full max-w-lg">
            <tbody>
              {[1, 2, 3, 4, 5, 6, 0].map((w) => {
                const r = data.hours.find((h) => h.weekday === w);
                return (
                  <tr key={w} className="border-b border-dashed border-[var(--line)]">
                    <td>
                      <label className="flex min-h-11 items-center gap-2">
                        <input type="checkbox" name={`on_${w}`} defaultChecked={!!r} className="size-5" /> {WEEKDAYS[w]}
                      </label>
                    </td>
                    <td>
                      <input type="time" name={`o_${w}`} defaultValue={r?.opens ?? "10:00"} className="input" aria-label={`${WEEKDAYS[w]} opens`} />
                    </td>
                    <td>
                      <input type="time" name={`c_${w}`} defaultValue={r?.closes ?? "19:00"} className="input" aria-label={`${WEEKDAYS[w]} closes`} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-1 text-xs text-[var(--muted)]">Closing before opening means overnight (e.g. 18:00 to 02:00). No days ticked = by appointment.</p>
          <button className="cta mt-3">Hours save karo</button>
        </form>
        <h3 className="sign mt-5 text-xl">Chhutti (closures)</h3>
        <ul className="mt-1 space-y-1">
          {data.closures.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <span className="mono">
                {c.f} to {c.t}
              </span>
              {c.note && <span>{c.note}</span>}
              <form action={delClosure}>
                <input type="hidden" name="id" value={c.id} />
                <button className="btn">Hatao</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addClosure} className="mt-2 flex flex-wrap items-end gap-2">
          <label className="text-sm">
            From <input type="date" name="from" required className="input" />
          </label>
          <label className="text-sm">
            To <input type="date" name="to" className="input" />
          </label>
          <label className="text-sm">
            Note <input name="note" className="input" placeholder="Diwali" maxLength={80} />
          </label>
          <button className="btn">Chhutti lagao</button>
        </form>
      </section>

      <section id="services" className={card}>
        <h2 className="sign text-2xl">Services (Chai Counter)</h2>
        <p className="text-sm text-[var(--muted)]">Bookings can never clash: the database refuses two bookings on one seat at the same time.</p>
        <div className="mt-3 space-y-3">
          {[...data.services, null].map((s, i) => (
            <form key={s?.id ?? "new"} action={saveService} className="grid gap-2 rounded border border-dashed border-[var(--line)] p-3 sm:grid-cols-4">
              <input type="hidden" name="id" value={s?.id ?? ""} />
              <label className="text-sm sm:col-span-2">
                Name <input name="name" defaultValue={s?.name.en ?? ""} required={!s} className="input" placeholder={s ? "" : "New service"} />
              </label>
              <label className="text-sm">
                Minutes <input name="minutes" type="number" min={10} max={600} defaultValue={s?.minutes ?? 45} className="input" />
              </label>
              <label className="text-sm">
                Seats <input name="capacity" type="number" min={1} max={50} defaultValue={s?.capacity ?? 1} className="input" />
              </label>
              <label className="text-sm">
                Buffer before <input name="buffer_before" type="number" min={0} max={240} defaultValue={s?.buffer_before ?? 0} className="input" />
              </label>
              <label className="text-sm">
                Buffer after <input name="buffer_after" type="number" min={0} max={240} defaultValue={s?.buffer_after ?? 0} className="input" />
              </label>
              <label className="text-sm">
                Min notice (min) <input name="min_notice_min" type="number" min={0} defaultValue={s?.min_notice_min ?? 120} className="input" />
              </label>
              <label className="text-sm">
                Days ahead <input name="max_days_ahead" type="number" min={1} max={90} defaultValue={s?.max_days_ahead ?? 30} className="input" />
              </label>
              <label className="text-sm">
                Price ₹ <input name="price" type="number" min={0} step="0.01" defaultValue={s?.price_paise ? s.price_paise / 100 : ""} className="input" />
              </label>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" name="auto_confirm" defaultChecked={s?.auto_confirm ?? false} className="size-5" /> Auto-confirm
              </label>
              {s && (
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" name="active" defaultChecked={s.active} className="size-5" /> Active
                </label>
              )}
              <button className={i === data.services.length ? "cta" : "btn"}>{s ? "Save" : "+ Add service"}</button>
            </form>
          ))}
        </div>
      </section>

      <section id="menu" className={card}>
        <h2 className="sign text-2xl">Menu Board</h2>
        <p className="text-sm text-[var(--muted)]">Daily cap is per pickup day. Empty cap means no limit.</p>
        <div className="mt-3 space-y-3">
          {[...data.menu, null].map((m, i) => (
            <form key={m?.id ?? "new"} action={saveItem} className="grid gap-2 rounded border border-dashed border-[var(--line)] p-3 sm:grid-cols-6">
              <input type="hidden" name="id" value={m?.id ?? ""} />
              <label className="text-sm sm:col-span-2">
                Name <input name="name" defaultValue={m?.name.en ?? ""} required={!m} className="input" />
              </label>
              <label className="text-sm">
                Hindi <input name="hi" defaultValue={m?.name.hi ?? ""} className="input font-deva" />
              </label>
              <label className="text-sm">
                Price ₹ <input name="price" type="number" min={0} step="0.01" required defaultValue={m ? m.price_paise / 100 : ""} className="input" />
              </label>
              <label className="text-sm">
                Daily cap <input name="cap" type="number" min={0} defaultValue={m?.daily_cap ?? ""} className="input" />
              </label>
              {m && (
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" name="active" defaultChecked={m.active} className="size-5" /> Active
                </label>
              )}
              <label className="text-sm sm:col-span-5">
                Blurb <input name="blurb" defaultValue={m?.blurb ?? ""} className="input" maxLength={160} />
              </label>
              <button className={i === data.menu.length ? "cta" : "btn"}>{m ? "Save" : "+ Add item"}</button>
              {m && <span className="mono self-center text-xs sm:col-span-6">{rupees(m.price_paise)}</span>}
            </form>
          ))}
        </div>
      </section>

      <section id="notes" className={card}>
        <h2 className="sign text-2xl">Noticeboard links</h2>
        <ul className="mt-2 space-y-1">
          {data.notes.map((n) => (
            <li key={n.id} className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{n.label}</span>
              <span className="mono truncate text-xs">{n.url}</span>
              <span className="mono text-xs">{n.clicks} clicks</span>
              <form action={delNote}>
                <input type="hidden" name="id" value={n.id} />
                <button className="btn">Hatao</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={saveNote} className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-sm">
            Label <input name="label" className="input" maxLength={80} />
          </label>
          <label className="text-sm">
            URL <input name="url" required className="input" placeholder="https://…" />
          </label>
          <label className="text-sm">
            Show from <input type="datetime-local" name="from" className="input" />
          </label>
          <label className="text-sm">
            Until <input type="datetime-local" name="until" className="input" />
          </label>
          <button className="btn">+ Note</button>
        </form>
      </section>

      <section id="contact" className={card}>
        <h2 className="sign text-2xl">Contact, UPI, listing</h2>
        <form action={saveContact} className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="text-sm">
            WhatsApp <input name="whatsapp" defaultValue={lane.draft.contact.whatsapp ?? ""} className="input" />
          </label>
          <label className="text-sm">
            Phone <input name="phone" defaultValue={lane.draft.contact.phone ?? ""} className="input" />
          </label>
          <label className="text-sm">
            Email (shown on Rooftop) <input name="email" type="email" defaultValue={lane.draft.contact.email ?? ""} className="input" />
          </label>
          <label className="text-sm">
            Address <input name="address" defaultValue={lane.draft.contact.address ?? ""} className="input" />
          </label>
          <label className="text-sm">
            Map search text <input name="map" defaultValue={lane.draft.contact.mapQuery ?? ""} className="input" placeholder="Paldi, Ahmedabad" />
          </label>
          <label className="text-sm">
            UPI ID <input name="vpa" defaultValue={lane.draft.upi.vpa ?? ""} className="input" placeholder="naam@okbank" />
          </label>
          <label className="text-sm">
            UPI name <input name="upi_name" defaultValue={lane.draft.upi.name ?? ""} className="input" />
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="listed" defaultChecked={lane.listed} className="size-5" /> List on the /galli cover wall
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="remixes" defaultChecked={!!lane.draft.showRemixes} className="size-5" /> Show the real remix count
          </label>
          <div className="sm:col-span-2">
            <button className="cta">Save</button>
          </div>
        </form>
      </section>

      <section id="postbox" className={card}>
        <h2 className="sign text-2xl">Postcard bhejo</h2>
        <p className="text-sm">{data.subs} confirmed subscribers. Daily quota 100 per owner. Each email carries a one-click unsubscribe link and header.</p>
        <form action={sendPostcard} className="mt-2 grid max-w-xl gap-2">
          <input name="subject" className="input" placeholder="Subject" maxLength={120} required />
          <textarea name="body" className="input" rows={5} placeholder="Is hafte stove pe kya hai…" required maxLength={5000} />
          <button className="cta w-fit" disabled={data.subs === 0}>
            {data.subs === 0 ? "Abhi koi subscriber nahi" : `${data.subs} logon ko bhejo`}
          </button>
        </form>
        <ul className="mt-3 text-sm">
          {data.postcards.map((p) => (
            <li key={p.id}>
              {p.subject}: {p.status}, {p.sent_count} sent
            </li>
          ))}
        </ul>
      </section>

      <section id="daak" className={card}>
        <h2 className="sign text-2xl">Daak (email outbox)</h2>
        <p className="text-sm text-[var(--muted)]">
          {process.env.RESEND_API_KEY ? "Emails go out through Resend." : "Email delivery is not switched on yet (no RESEND_API_KEY). Every email this lane would send is kept here, and nothing claims it was delivered."}
        </p>
        <ul className="mt-2 divide-y divide-dashed divide-[var(--line)] text-sm">
          {data.outbox.length === 0 && <li className="py-2 text-[var(--muted)]">Koi email nahi.</li>}
          {data.outbox.map((o, i) => (
            <li key={i} className="flex flex-wrap gap-2 py-1.5">
              <span className="mono text-xs">{new Date(o.created_at).toLocaleString("en-IN")}</span>
              <span className="mono text-xs uppercase">{o.kind}</span>
              <span>{o.to_addr}</span>
              <span className="text-[var(--muted)]">{o.subject}</span>
              <span className="mono text-xs">[{o.delivered}]</span>
            </li>
          ))}
        </ul>
      </section>

      <section id="danger" className={`${card} border-[var(--sindoor)]`}>
        <h2 className="sign text-2xl">Data</h2>
        <a className="btn" href={`/api/studio/${laneId}/export`}>
          Export everything (JSON)
        </a>
        <form action={deleteLane} className="mt-4 flex flex-wrap items-end gap-2">
          <label className="text-sm">
            Delete this lane and all its visitor records. Type <span className="mono">{lane.handle}</span>
            <input name="confirm" className="input" autoComplete="off" />
          </label>
          <button className="btn !border-[var(--sindoor)] !text-[var(--sindoor)]">Delete lane</button>
        </form>
      </section>
    </div>
  );
}
