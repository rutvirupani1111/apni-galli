// The Galla: one merged inbox. The Hisaab counts and the list come from ONE statement, so they agree.
import { createHash } from "node:crypto";
import type { Q } from "./db";
import { queueMail, isEmail } from "./email";
import { baseUrl } from "./visitor";

export type Scope = { kind: "owner"; laneIds: string[]; ownerId: string; tz: string } | { kind: "demo"; laneIds: string[]; demoSid: string; tz: string };

export type FeedItem = {
  type: "chit" | "booking" | "subscriber";
  id: string;
  lane_id: string;
  status: string;
  at: string;
  updated_at: string;
  data: Record<string, unknown>;
};
export type Hisaab = { bookings_today: number; unanswered: number; to_prepare: number; paid_today: number };

export type FeedFilter = { type?: string; status?: string; q?: string; scene?: string; day?: "today" | "week" | "" };

export async function feed(q: Q, scope: Scope, f: FeedFilter = {}) {
  const demo = scope.kind === "demo" ? scope.demoSid : null;
  const rows = await q.query<FeedItem & { h_bookings_today: number; h_unanswered: number; h_to_prepare: number; h_paid_today: number; total: number }>(
    `with items as (
      select 'chit'::text as type, c.id, c.lane_id, c.status, c.created_at as at, c.updated_at,
        jsonb_build_object('kind', c.kind, 'scene', c.scene, 'fields', c.fields, 'lines', c.lines, 'total', c.total_paise,
          'pickup_day', c.pickup_day, 'token', c.public_token, 'paid_at', c.paid_marked_at, 'read_at', c.read_at,
          'decline', c.decline_reason, 'has_file', exists(select 1 from attachments a where a.chit_id = c.id),
          'replies', coalesce((select jsonb_agg(jsonb_build_object('body', r.body, 'at', r.created_at) order by r.created_at) from chit_replies r where r.chit_id = c.id), '[]'::jsonb)) as data,
        c.search_text as hay, c.search as tsv, c.scene as scene
      from chits c where c.lane_id = any($1::uuid[]) and ($2::text is null or c.demo_sid = $2)
      union all
      select 'booking', b.id, b.lane_id, case when b.archived then 'archived' else b.status end, b.created_at, b.updated_at,
        jsonb_build_object('service', s.name, 'start', lower(b.slot), 'end', upper(b.slot), 'seat', b.seat, 'name', b.visitor_name,
          'contact', b.visitor_contact, 'note', b.note, 'token', b.public_token, 'price', s.price_paise, 'prev', b.status),
        lower(coalesce(b.visitor_name,'') || ' ' || coalesce(b.visitor_contact,'') || ' ' || coalesce(b.note,'') || ' ' || (s.name->>'en')),
        to_tsvector('simple', coalesce(b.visitor_name,'') || ' ' || coalesce(b.note,'')), 'counter'
      from bookings b join services s on s.id = b.service_id
      where b.lane_id = any($1::uuid[]) and b.status <> 'hold' and ($2::text is null or b.demo_sid = $2)
      union all
      select 'subscriber', sb.id, sb.lane_id, case when sb.archived then 'archived' else sb.status end, sb.created_at, sb.updated_at,
        jsonb_build_object('email', sb.email, 'confirmed_at', sb.confirmed_at, 'prev', sb.status), lower(sb.email), to_tsvector('simple', sb.email), 'postbox'
      from subscribers sb where sb.lane_id = any($1::uuid[]) and ($2::text is null or sb.demo_sid = $2)
    ),
    counts as (
      select
        count(*) filter (where type = 'booking' and status in ('pending','confirmed')
          and ((data->>'start')::timestamptz at time zone $3)::date = (now() at time zone $3)::date)::int as h_bookings_today,
        count(*) filter (where type = 'chit' and data->>'kind' = 'enquiry' and status in ('new','read'))::int as h_unanswered,
        count(*) filter (where type = 'chit' and data->>'kind' = 'order' and status in ('new','read','confirmed','paid'))::int as h_to_prepare,
        count(*) filter (where type = 'chit' and data->>'paid_at' is not null
          and ((data->>'paid_at')::timestamptz at time zone $3)::date = (now() at time zone $3)::date)::int as h_paid_today
      from items
    ),
    filtered as (
      select * from items
      where ($4::text is null or type = $4)
        and ($5::text is null or ($5 = 'open' and status not in ('archived','done','declined','cancelled','unsubscribed')) or status = $5)
        and ($6::text is null or scene = $6)
        and ($7::text is null or tsv @@ plainto_tsquery('simple', $7) or hay like '%' || lower($7) || '%')
        and ($8::text is null
          or ($8 = 'today' and (coalesce((data->>'start')::timestamptz, at) at time zone $3)::date = (now() at time zone $3)::date)
          or ($8 = 'week' and at > now() - interval '7 days'))
    )
    select f.type, f.id, f.lane_id, f.status, f.at, f.updated_at, f.data, c.*, (select count(*)::int from filtered) as total
    from counts c left join lateral (select * from filtered order by at desc limit 300) f on true`,
    [scope.laneIds, demo, scope.tz, f.type || null, f.status || null, f.scene || null, f.q?.trim() || null, f.day || null],
  );
  const first = rows[0];
  const hisaab: Hisaab = {
    bookings_today: first?.h_bookings_today ?? 0,
    unanswered: first?.h_unanswered ?? 0,
    to_prepare: first?.h_to_prepare ?? 0,
    paid_today: first?.h_paid_today ?? 0,
  };
  const items: FeedItem[] = rows
    .filter((r) => r.id)
    .map((r) => ({ type: r.type, id: r.id, lane_id: r.lane_id, status: r.status, at: new Date(r.at).toISOString(), updated_at: new Date(r.updated_at).toISOString(), data: r.data }));
  const etag = '"' + createHash("sha1").update(JSON.stringify([hisaab, items.map((i) => [i.id, i.status, i.updated_at])])).digest("base64url").slice(0, 20) + '"';
  return { items, hisaab, total: first?.total ?? 0, etag };
}

export type Op = {
  op_id: string;
  kind: "read" | "reply" | "confirm" | "decline" | "paid" | "done" | "archive" | "restore" | "block";
  type: "chit" | "booking" | "subscriber";
  id: string;
  payload?: { body?: string; reason?: string; status?: string; prev?: string };
};

const CHIT_STATUSES = ["new", "read", "replied", "confirmed", "declined", "paid", "done", "archived"];
const BOOKING_STATUSES = ["pending", "confirmed", "declined", "cancelled", "done"];

/** Applies owner ops idempotently. q is already scoped by RLS (owner) or by demo_sid (demo). */
export async function applyOps(q: Q, scope: Scope, ops: Op[]) {
  const results: { op_id: string; ok: boolean; error?: string; replay?: boolean }[] = [];
  const ownerId = scope.kind === "owner" ? scope.ownerId : null;
  const demo = scope.kind === "demo" ? scope.demoSid : null;
  for (const op of ops) {
    await q.query("savepoint op");
    try {
      // the op id is claimed first; a replay finds it taken and returns the stored result
      const lane = await laneOf(q, op, scope.laneIds, demo);
      if (!lane) throw new Error("Yeh entry nahi mili");
      const claim = await q.query("insert into galla_ops (op_id, owner_id) values ($1, $2) on conflict (op_id) do nothing returning op_id", [op.op_id, lane.owner_id]);
      if (!claim.length) {
        await q.query("release savepoint op");
        results.push({ op_id: op.op_id, ok: true, replay: true });
        continue;
      }
      await applyOne(q, op, lane, ownerId);
      await q.query("update galla_ops set result = $2 where op_id = $1", [op.op_id, JSON.stringify({ ok: true })]);
      await q.query("release savepoint op");
      results.push({ op_id: op.op_id, ok: true });
    } catch (e) {
      await q.query("rollback to savepoint op");
      results.push({ op_id: op.op_id, ok: false, error: (e as Error).message.slice(0, 140) });
    }
  }
  return results;
}

type LaneLite = { id: string; owner_id: string; is_demo: boolean; handle: string; owner_email: string; draft_name: string };

async function laneOf(q: Q, op: Op, laneIds: string[], demo: string | null): Promise<LaneLite | null> {
  const table = op.type === "chit" ? "chits" : op.type === "booking" ? "bookings" : "subscribers";
  const r = await q.query<LaneLite>(
    `select l.id, l.owner_id, l.is_demo, l.handle, o.email as owner_email, l.draft->>'name' as draft_name
       from ${table} t join lanes l on l.id = t.lane_id join owners o on o.id = l.owner_id
      where t.id = $1 and t.lane_id = any($2::uuid[]) and ($3::text is null or t.demo_sid = $3)`,
    [op.id, laneIds, demo],
  );
  return r[0] ?? null;
}

async function applyOne(q: Q, op: Op, lane: LaneLite, ownerId: string | null) {
  const p = op.payload ?? {};
  if (op.type === "chit") {
    const c = (await q.query<{ status: string; kind: string; fields: Record<string, string>; lines: { item_id: string; qty: number }[] | null; pickup_day: string | null; public_token: string; sender_hash: string }>(
      "select status, kind, fields, lines, to_char(pickup_day, 'YYYY-MM-DD') as pickup_day, public_token, sender_hash from chits where id = $1 for update",
      [op.id],
    ))[0];
    const set = (sql: string, params: unknown[] = []) => q.query(`update chits set ${sql}, updated_at = now() where id = $1`, [op.id, ...params]);
    switch (op.kind) {
      case "read":
        if (c.status === "new") await set("status = 'read', read_at = coalesce(read_at, now())");
        return;
      case "reply": {
        const body = (p.body ?? "").trim();
        if (!body || body.length > 4000) throw new Error("Jawab khaali hai");
        await q.query("insert into chit_replies (chit_id, owner_id, body) values ($1,$2,$3)", [op.id, lane.owner_id, body]);
        await set("status = case when status in ('new','read') then 'replied' else status end, read_at = coalesce(read_at, now())");
        const to = String(c.fields.contact ?? "");
        if (!lane.is_demo && isEmail(to)) {
          await queueMail(q, {
            laneId: lane.id,
            ownerId: lane.owner_id,
            to,
            kind: "reply",
            subject: `Reply from ${lane.draft_name}`,
            text: `${body}\n\nSee the whole chit: ${baseUrl()}/c/${c.public_token}`,
            replyTo: lane.owner_email,
          });
        }
        return;
      }
      case "confirm":
        await set("status = 'confirmed'");
        return;
      case "decline":
        if (c.kind === "order" && c.lines && c.pickup_day && !["declined", "archived"].includes(c.status)) {
          for (const l of c.lines) {
            await q.query("update item_day_stock set sold = greatest(0, sold - $3) where item_id = $1 and day = $2", [l.item_id, c.pickup_day, l.qty]);
          }
        }
        await set("status = 'declined', decline_reason = $2", [(p.reason ?? "").slice(0, 200) || null]);
        return;
      case "paid":
        await set("status = 'paid', paid_marked_at = now()");
        return;
      case "done":
        await set("status = 'done'");
        return;
      case "archive":
        await set("status = 'archived'");
        return;
      case "restore": {
        const st = p.status ?? "read";
        if (!CHIT_STATUSES.includes(st)) throw new Error("bad status");
        if (st !== "paid") await set("status = $2, paid_marked_at = case when $2 = 'paid' then paid_marked_at else null end", [st]);
        else await set("status = 'paid'");
        if (c.status === "declined" && st !== "declined" && c.kind === "order" && c.lines && c.pickup_day) {
          for (const l of c.lines) {
            const up = await q.query("update item_day_stock set sold = sold + $3 where item_id = $1 and day = $2 and sold + $3 <= cap returning sold", [l.item_id, c.pickup_day, l.qty]);
            if (!up.length) throw new Error("Stock khatam, wapas nahi ho sakta");
          }
        }
        return;
      }
      case "block":
        await q.query("insert into blocked_senders (lane_id, owner_id, sender_hash) values ($1,$2,$3) on conflict do nothing", [lane.id, lane.owner_id, c.sender_hash]);
        await set("status = 'archived'");
        return;
    }
  }
  if (op.type === "booking") {
    const b = (await q.query<{ status: string; archived: boolean; visitor_contact: string | null; public_token: string; slot_s: string }>(
      "select status, archived, visitor_contact, public_token, lower(slot) as slot_s from bookings where id = $1 for update",
      [op.id],
    ))[0];
    const set = (sql: string, params: unknown[] = []) => q.query(`update bookings set ${sql}, updated_at = now() where id = $1`, [op.id, ...params]);
    switch (op.kind) {
      case "confirm":
        if (b.status !== "pending") throw new Error(`Booking already ${b.status}`);
        await set("status = 'confirmed'");
        if (!lane.is_demo && b.visitor_contact && isEmail(b.visitor_contact))
          await queueMail(q, {
            laneId: lane.id,
            ownerId: lane.owner_id,
            to: b.visitor_contact,
            kind: "booking-confirmed",
            subject: `Slot pakka with ${lane.draft_name}`,
            text: `Your booking is confirmed.\n${baseUrl()}/c/${b.public_token}`,
            replyTo: lane.owner_email,
          });
        return;
      case "decline":
        if (!["pending", "confirmed"].includes(b.status)) throw new Error(`Booking already ${b.status}`);
        await set("status = 'declined', note = coalesce(note,'') || $2", [p.reason ? `\n[declined: ${p.reason.slice(0, 120)}]` : ""]);
        return;
      case "done":
        await set("status = 'done'");
        return;
      case "archive":
        await set("archived = true");
        return;
      case "restore": {
        const st = p.status;
        if (st === "archived" || !st) {
          await set("archived = false");
          return;
        }
        if (!BOOKING_STATUSES.includes(st)) throw new Error("bad status");
        // restoring a declined booking re-enters the exclusion constraint and can fail if the slot was taken
        await set("status = $2, archived = false", [st]);
        return;
      }
      default:
        throw new Error("Not for bookings");
    }
  }
  if (op.type === "subscriber") {
    switch (op.kind) {
      case "archive":
        await q.query("update subscribers set archived = true, updated_at = now() where id = $1", [op.id]);
        return;
      case "restore":
      case "read":
        await q.query("update subscribers set archived = false, updated_at = now() where id = $1", [op.id]);
        return;
      default:
        throw new Error("Not for subscribers");
    }
  }
  void ownerId;
}
