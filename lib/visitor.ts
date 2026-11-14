// Visitor writes: holds, bookings, orders, enquiry chits and newsletter sign-ups.
// Every function here runs under withSystem, after the route handler has validated input with zod,
// checked the honeypot, Turnstile (when configured) and the token-bucket rate limit.
import { withSystem, pgCode, type Q } from "./db";
import { laneForWrite, hoursOf, type LaneRow, type ServiceRow } from "./lane";
import { generateSlots, blockedRange, type Taken } from "./slots";
import { addDays, localDate, zonedToUtc, fmtInTz } from "./time";
import { intervalsFor } from "./status";
import { rand, senderHash, signToken, ipHash } from "./crypto";
import { queueMail, isEmail } from "./email";
import { icsFile, rupees, orderCode, type Line } from "./money";
import type { LaneDoc } from "./doc";

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    msg: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(msg);
  }
}

export const baseUrl = () => process.env.PUBLIC_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3690");

async function publishedDoc(q: Q, lane: LaneRow): Promise<LaneDoc> {
  const v = await q.query<{ doc: LaneDoc }>("select doc from lane_versions where id = $1", [lane.published_version_id]);
  return v[0].doc;
}
async function ownerEmail(q: Q, ownerId: string) {
  const r = await q.query<{ email: string; is_demo: boolean }>("select email, is_demo from owners where id = $1", [ownerId]);
  return r[0];
}
async function assertNotBlocked(q: Q, laneId: string, sh: string) {
  const b = await q.query("select 1 from blocked_senders where lane_id = $1 and sender_hash = $2", [laneId, sh]);
  if (b.length) throw new HttpError(403, "blocked", "Is galli ne aapki chit band ki hai");
}
async function requireLane(q: Q, handle: string) {
  const lane = await laneForWrite(q, handle);
  if (!lane) throw new HttpError(404, "no_lane", "Yeh galli nahi mili");
  return lane;
}

async function takenFor(q: Q, resourceId: string, from: Date, to: Date): Promise<Taken[]> {
  const rows = await q.query<{ seat: number; s: Date; e: Date }>(
    `select seat, lower(blocked) as s, upper(blocked) as e from bookings
      where resource_id = $1 and status in ('hold','pending','confirmed')
        and (status <> 'hold' or expires_at > now())
        and blocked && tstzrange($2, $3)`,
    [resourceId, from.toISOString(), to.toISOString()],
  );
  return rows.map((r) => ({ seat: r.seat, start: new Date(r.s).getTime(), end: new Date(r.e).getTime() }));
}

export async function slotsFor(handle: string, serviceId: string, date: string) {
  return withSystem(async (q) => {
    const lane = await requireLane(q, handle);
    const svc = (await q.query<ServiceRow>("select * from services where id = $1 and lane_id = $2 and active", [serviceId, lane.id]))[0];
    if (!svc) throw new HttpError(404, "no_service", "Service nahi mili");
    const h = { tz: lane.tz, ...(await hoursOf(q, lane.id)) };
    const dayStart = zonedToUtc(date, 0, lane.tz);
    const dayEnd = zonedToUtc(addDays(date, 1), 0, lane.tz);
    const taken = await takenFor(q, svc.resource_id, new Date(dayStart.getTime() - 6 * 3600000), new Date(dayEnd.getTime() + 6 * 3600000));
    const slots = generateSlots(h, svc, date, new Date(), taken);
    // every hook on the rail, including taken ones, so the rail can show filled brass tokens
    const all = generateSlots(h, { ...svc, capacity: 1_000_000 }, date, new Date(), []).map((s) => {
      const free = slots.find((f) => f.start === s.start);
      return { start: s.start, end: s.end, seatsLeft: free?.seatsLeft ?? 0 };
    });
    return { tz: lane.tz, capacity: svc.capacity, slots: all };
  });
}

export async function createHold(handle: string, serviceId: string, startIso: string, demoSid: string | null) {
  return withSystem(async (q) => {
    const lane = await requireLane(q, handle);
    const svc = (await q.query<ServiceRow>("select * from services where id = $1 and lane_id = $2 and active", [serviceId, lane.id]))[0];
    if (!svc) throw new HttpError(404, "no_service", "Service nahi mili");
    const start = new Date(startIso);
    if (isNaN(start.getTime())) throw new HttpError(400, "bad_time", "Time samajh nahi aaya");
    // expired holds go first: expiry needs no cron
    await q.query("delete from bookings where resource_id = $1 and status = 'hold' and expires_at < now()", [svc.resource_id]);
    const h = { tz: lane.tz, ...(await hoursOf(q, lane.id)) };
    const date = localDate(start, lane.tz);
    const valid = generateSlots(h, { ...svc, capacity: 1_000_000 }, date, new Date(), []).some((s) => s.start === start.toISOString());
    if (!valid) throw new HttpError(400, "not_a_slot", "Yeh slot list mein nahi hai");
    const { s, e } = blockedRange(start.getTime(), svc);
    const end = new Date(start.getTime() + svc.minutes * 60000);
    const token = rand(18);
    for (let seat = 1; seat <= svc.capacity; seat++) {
      await q.query("savepoint seat_try");
      try {
        const r = await q.query<{ id: string; expires_at: string }>(
          `insert into bookings (lane_id, owner_id, service_id, resource_id, seat, slot, blocked, status, expires_at, hold_token, demo_sid)
           values ($1,$2,$3,$4,$5,tstzrange($6,$7),tstzrange($8,$9),'hold', now() + interval '10 minutes', $10, $11)
           returning id, expires_at`,
          [lane.id, lane.owner_id, svc.id, svc.resource_id, seat, start.toISOString(), end.toISOString(), s.toISOString(), e.toISOString(), token, lane.is_demo ? demoSid : null],
        );
        await q.query("release savepoint seat_try");
        return { holdToken: token, expiresAt: r[0].expires_at, seat, start: start.toISOString(), end: end.toISOString() };
      } catch (err) {
        await q.query("rollback to savepoint seat_try");
        if (pgCode(err) !== "23P01") throw err;
      }
    }
    // name the next free hook so the refusal can say where to go
    const later = generateSlots(h, svc, date, new Date(), await takenFor(q, svc.resource_id, zonedToUtc(date, 0, lane.tz), zonedToUtc(addDays(date, 1), 0, lane.tz))).find(
      (x) => x.start > start.toISOString(),
    );
    throw new HttpError(409, "slot_full", "Yeh slot abhi kisi aur ne le liya", { next: later?.start ?? null });
  });
}

export async function confirmHold(
  handle: string,
  o: { holdToken: string; name: string; contact: string; note?: string; replaces?: string | null },
) {
  return withSystem(async (q) => {
    const lane = await requireLane(q, handle);
    const sh = await senderHash(o.contact);
    await assertNotBlocked(q, lane.id, sh);
    const svcRow = await q.query<ServiceRow & { b_id: string }>(
      `select s.*, b.id as b_id from bookings b join services s on s.id = b.service_id
        where b.hold_token = $1 and b.lane_id = $2 and b.status = 'hold' and b.expires_at > now()`,
      [o.holdToken, lane.id],
    );
    const svc = svcRow[0];
    if (!svc) throw new HttpError(410, "hold_expired", "Token ka time khatam ho gaya, dobara slot chuno");
    const publicToken = rand(18);
    const status = svc.auto_confirm ? "confirmed" : "pending";
    const r = await q.query<{ slot_s: string; slot_e: string; demo_sid: string | null }>(
      `update bookings set status = $1, expires_at = null, hold_token = null, visitor_name = $2, visitor_contact = $3,
         note = $4, public_token = $5, sender_hash = $6, updated_at = now()
       where id = $7 returning lower(slot) as slot_s, upper(slot) as slot_e, demo_sid`,
      [status, o.name, o.contact, o.note ?? null, publicToken, sh, svc.b_id],
    );
    if (o.replaces) {
      // reschedule: the old booking is cancelled in the same transaction as the new one is made
      await q.query(
        "update bookings set status = 'cancelled', updated_at = now() where public_token = $1 and lane_id = $2 and status in ('pending','confirmed')",
        [o.replaces, lane.id],
      );
    }
    const doc = await publishedDoc(q, lane);
    const start = new Date(r[0].slot_s);
    const end = new Date(r[0].slot_e);
    const url = `${baseUrl()}/c/${publicToken}`;
    const ics = icsFile({ uid: publicToken, start, end, title: `${svc.name.en}, ${doc.name}`, where: doc.contact.address, url });
    if (!lane.is_demo) {
      const when = fmtInTz(start, lane.tz, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
      if (isEmail(o.contact)) {
        await queueMail(q, {
          laneId: lane.id,
          ownerId: lane.owner_id,
          to: o.contact.trim(),
          kind: "booking",
          subject: `${status === "confirmed" ? "Slot pakka" : "Slot request sent"}: ${svc.name.en}, ${when}`,
          text: `${doc.name}\n${svc.name.en}\n${when} (${lane.tz})\nStatus: ${status === "confirmed" ? "Pakka (confirmed)" : "Pending, the owner will confirm"}\n\nSee, reschedule or cancel: ${url}`,
          ics,
        });
      }
      const oe = await ownerEmail(q, lane.owner_id);
      if (oe && !oe.is_demo) {
        await queueMail(q, {
          laneId: lane.id,
          ownerId: lane.owner_id,
          to: oe.email,
          kind: "owner-booking",
          subject: `New booking: ${o.name}, ${svc.name.en}, ${when}`,
          text: `${o.name} booked ${svc.name.en} for ${when}.\nStatus: ${status}.\nOpen the Galla: ${baseUrl()}/studio/${lane.id}/galla`,
        });
      }
    }
    return { publicToken, status, start: start.toISOString(), end: end.toISOString(), service: svc.name.en, ics, tz: lane.tz, demo: lane.is_demo };
  });
}

/** Pickup days the menu offers: the next 7 days the lane is open (today only while still open). */
export function pickupDays(h: { tz: string; hours: { weekday: number; opens: string; closes: string }[]; closures: { from: string; to: string }[] }, now = new Date()) {
  const today = localDate(now, h.tz);
  const out: string[] = [];
  for (let i = 0; i < 14 && out.length < 7; i++) {
    const d = addDays(today, i);
    const iv = intervalsFor(d, h);
    if (!iv.length && h.hours.length) continue;
    if (i === 0 && h.hours.length) {
      const endToday = zonedToUtc(d, Math.min(1440, Math.max(...iv.map((x) => x[1]))), h.tz);
      if (endToday.getTime() - now.getTime() < 60 * 60000) continue;
    }
    out.push(d);
  }
  return out;
}

export async function createOrder(
  handle: string,
  o: { lines: { item_id: string; qty: number }[]; pickupDay: string; name: string; contact: string; note?: string; idem: string; demoSid: string | null },
) {
  return withSystem(async (q) => {
    const prior = await q.query<{ public_token: string; total_paise: number }>("select public_token, total_paise from chits where idempotency_key = $1", [o.idem]);
    if (prior.length) return { publicToken: prior[0].public_token, total: prior[0].total_paise, replay: true };
    const lane = await requireLane(q, handle);
    const sh = await senderHash(o.contact);
    await assertNotBlocked(q, lane.id, sh);
    const h = { tz: lane.tz, ...(await hoursOf(q, lane.id)) };
    if (!pickupDays(h).includes(o.pickupDay)) throw new HttpError(400, "bad_day", "Us din pickup nahi hai");
    const ids = o.lines.map((l) => l.item_id);
    const items = await q.query<{ id: string; name: { en: string }; price_paise: number; daily_cap: number | null }>(
      "select id, name, price_paise, daily_cap from menu_items where lane_id = $1 and active and id = any($2::uuid[])",
      [lane.id, ids],
    );
    if (items.length !== new Set(ids).size) throw new HttpError(400, "bad_item", "Menu badal gaya, page refresh karo");
    const lines: Line[] = [];
    for (const l of o.lines) {
      const it = items.find((i) => i.id === l.item_id)!;
      if (it.daily_cap !== null) {
        await q.query("insert into item_day_stock (item_id, day, owner_id, sold, cap) values ($1,$2,$3,0,$4) on conflict do nothing", [it.id, o.pickupDay, lane.owner_id, it.daily_cap]);
        const up = await q.query<{ sold: number }>(
          "update item_day_stock set sold = sold + $3 where item_id = $1 and day = $2 and sold + $3 <= cap returning sold",
          [it.id, o.pickupDay, l.qty],
        );
        if (!up.length) {
          const left = await q.query<{ left: number }>("select cap - sold as left from item_day_stock where item_id = $1 and day = $2", [it.id, o.pickupDay]);
          throw new HttpError(409, "stock", `${it.name.en}: sirf ${left[0]?.left ?? 0} bache`, { item: it.id, left: left[0]?.left ?? 0 });
        }
      }
      lines.push({ item_id: it.id, name: it.name.en, qty: l.qty, price_paise: it.price_paise });
    }
    const total = lines.reduce((s, l) => s + l.qty * l.price_paise, 0);
    const publicToken = rand(18);
    const fields = { name: o.name, contact: o.contact, note: o.note ?? "" };
    const hay = [o.name, o.contact, o.note ?? "", ...lines.map((l) => l.name)].join(" ");
    await q.query(
      `insert into chits (lane_id, owner_id, kind, scene, fields, lines, total_paise, pickup_day, public_token, sender_hash, idempotency_key, demo_sid, search, search_text)
       values ($1,$2,'order','menu',$3,$4,$5,$6,$7,$8,$9,$10, to_tsvector('simple', $11), lower($11))`,
      [lane.id, lane.owner_id, JSON.stringify(fields), JSON.stringify(lines), total, o.pickupDay, publicToken, sh, o.idem, lane.is_demo ? o.demoSid : null, hay],
    );
    if (!lane.is_demo) {
      const doc = await publishedDoc(q, lane);
      const url = `${baseUrl()}/c/${publicToken}`;
      if (isEmail(o.contact))
        await queueMail(q, {
          laneId: lane.id,
          ownerId: lane.owner_id,
          to: o.contact.trim(),
          kind: "order",
          subject: `Order ${orderCode(publicToken)} sent to ${doc.name}`,
          text: `${lines.map((l) => `${l.qty} x ${l.name}`).join("\n")}\nTotal ${rupees(total)}\nPickup ${o.pickupDay}\n\nPayment is confirmed only when ${doc.name} marks it received.\nStatus: ${url}`,
        });
      const oe = await ownerEmail(q, lane.owner_id);
      if (oe && !oe.is_demo)
        await queueMail(q, {
          laneId: lane.id,
          ownerId: lane.owner_id,
          to: oe.email,
          kind: "owner-order",
          subject: `New order ${orderCode(publicToken)}: ${rupees(total)} from ${o.name}`,
          text: `${lines.map((l) => `${l.qty} x ${l.name}`).join("\n")}\nPickup ${o.pickupDay}\nGalla: ${baseUrl()}/studio/${lane.id}/galla`,
        });
    }
    return { publicToken, total, replay: false };
  });
}

export async function createEnquiry(
  handle: string,
  o: { scene: string; fields: Record<string, string | number>; idem: string; demoSid: string | null; file?: { data: Buffer; mime: string } | null },
) {
  return withSystem(async (q) => {
    const prior = await q.query<{ public_token: string }>("select public_token from chits where idempotency_key = $1", [o.idem]);
    if (prior.length) return { publicToken: prior[0].public_token, replay: true };
    const lane = await requireLane(q, handle);
    const doc = await publishedDoc(q, lane);
    const clean: Record<string, string | number> = {};
    for (const f of doc.chitFields) {
      const v = o.fields[f.key];
      const empty = v === undefined || v === null || String(v).trim() === "";
      if (empty) {
        if (f.required) throw new HttpError(400, "missing", `${f.label} likhna zaroori hai`, { field: f.key });
        continue;
      }
      if (f.type === "count") {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 0 || n > 999) throw new HttpError(400, "bad", `${f.label}: number likho`, { field: f.key });
        clean[f.key] = n;
      } else if (f.type === "chips") {
        if (!f.options?.includes(String(v))) throw new HttpError(400, "bad", `${f.label}: list se chuno`, { field: f.key });
        clean[f.key] = String(v);
      } else if (f.type === "date") {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v))) throw new HttpError(400, "bad", `${f.label}: date chuno`, { field: f.key });
        clean[f.key] = String(v);
      } else {
        const s = String(v).trim();
        if (s.length > (f.type === "long" ? 2000 : 200)) throw new HttpError(400, "bad", `${f.label} bahut lamba hai`, { field: f.key });
        clean[f.key] = s;
      }
    }
    if (typeof o.fields.about === "string" && o.fields.about.trim()) clean.about = o.fields.about.trim().slice(0, 160);
    const contact = String(clean.contact ?? "");
    if (!contact) throw new HttpError(400, "missing", "WhatsApp ya email zaroori hai", { field: "contact" });
    const sh = await senderHash(contact);
    await assertNotBlocked(q, lane.id, sh);
    const publicToken = rand(18);
    const hay = Object.values(clean).join(" ");
    const c = await q.query<{ id: string }>(
      `insert into chits (lane_id, owner_id, kind, scene, fields, public_token, sender_hash, idempotency_key, demo_sid, search, search_text)
       values ($1,$2,'enquiry',$3,$4,$5,$6,$7,$8, to_tsvector('simple', $9), lower($9)) returning id`,
      [lane.id, lane.owner_id, o.scene, JSON.stringify(clean), publicToken, sh, o.idem, lane.is_demo ? o.demoSid : null, hay],
    );
    if (o.file) {
      await q.query("insert into attachments (chit_id, owner_id, data, bytes, mime) values ($1,$2,$3,$4,$5)", [c[0].id, lane.owner_id, o.file.data, o.file.data.length, o.file.mime]);
    }
    if (!lane.is_demo) {
      const oe = await ownerEmail(q, lane.owner_id);
      if (oe && !oe.is_demo)
        await queueMail(q, {
          laneId: lane.id,
          ownerId: lane.owner_id,
          to: oe.email,
          kind: "owner-chit",
          subject: `New chit from ${clean.name ?? "a visitor"}`,
          text: `${Object.entries(clean)
            .map(([k, v]) => `${k}: ${v}`)
            .join("\n")}\n\nReply from the Galla: ${baseUrl()}/studio/${lane.id}/galla`,
        });
    }
    return { publicToken, replay: false };
  });
}

export async function subscribe(handle: string, email: string, ip: string, demoSid: string | null) {
  return withSystem(async (q) => {
    const lane = await requireLane(q, handle);
    const r = await q.query<{ id: string; status: string }>(
      `insert into subscribers (lane_id, owner_id, email, status, demo_sid) values ($1,$2,$3,'pending',$4)
       on conflict (lane_id, lower(email)) do update set
         status = case when subscribers.status = 'unsubscribed' then 'pending' else subscribers.status end,
         updated_at = now()
       returning id, status`,
      [lane.id, lane.owner_id, email.trim(), lane.is_demo ? demoSid : null],
    );
    const sub = r[0];
    await q.query("insert into consents (subscriber_id, owner_id, action, ip_hash, form_version) values ($1,$2,'requested',$3,'postbox-v1')", [sub.id, lane.owner_id, await ipHash(ip)]);
    if (sub.status === "confirmed") return { status: "confirmed" as const, confirmUrl: null };
    const tok = await signToken({ s: sub.id, a: "confirm" }, 7);
    const confirmUrl = `${baseUrl()}/n/confirm/${tok}`;
    const doc = await publishedDoc(q, lane);
    if (!lane.is_demo) {
      await queueMail(q, {
        laneId: lane.id,
        ownerId: lane.owner_id,
        to: email.trim(),
        kind: "optin",
        subject: `Confirm: postcards from ${doc.name}`,
        text: `Someone (hopefully you) asked for postcards from ${doc.name}.\nConfirm here: ${confirmUrl}\n\nIf it was not you, ignore this email and nothing happens.`,
      });
    }
    return { status: "pending" as const, confirmUrl: lane.is_demo ? confirmUrl : null };
  });
}
