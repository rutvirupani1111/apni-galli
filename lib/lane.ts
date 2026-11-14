import { revalidateTag, unstable_cache } from "next/cache";
import { withOwner, withSystem, type Q } from "./db";
import type { LaneDoc } from "./doc";
import type { Closure, HoursRule } from "./status";
import { HOURS_PRESETS, TRADES, starterDoc, type TradeKey } from "./trades";

export type LaneRow = {
  id: string;
  owner_id: string;
  handle: string;
  tz: string;
  trade: TradeKey;
  is_demo: boolean;
  listed: boolean;
  suspended_at: string | null;
  published_version_id: string | null;
  draft: LaneDoc;
  draft_version: number;
  seed: number;
  pins: Record<string, number>;
  show_remixes: boolean;
  remixed_from_lane_id: string | null;
  updated_at: string;
};

export type ServiceRow = {
  id: string;
  resource_id: string;
  name: { en: string; hi?: string };
  minutes: number;
  capacity: number;
  buffer_before: number;
  buffer_after: number;
  min_notice_min: number;
  max_days_ahead: number;
  auto_confirm: boolean;
  price_paise: number | null;
  deposit_paise: number | null;
  active: boolean;
  sort: number;
};
export type MenuRow = { id: string; name: { en: string; hi?: string }; blurb: string; price_paise: number; daily_cap: number | null; active: boolean; sort: number };
export type NoteRow = { id: string; label: string; url: string; show_from: string | null; show_until: string | null; clicks: number; sort: number };

export type PublicLane = {
  id: string;
  handle: string;
  tz: string;
  trade: TradeKey;
  isDemo: boolean;
  suspended: boolean;
  doc: LaneDoc;
  hours: HoursRule[];
  closures: Closure[];
  services: ServiceRow[];
  menu: MenuRow[];
  notes: NoteRow[];
  remixes: number | null;
  publishedAt: string | null;
};

export async function hoursOf(q: Q, laneId: string) {
  const hours = await q.query<HoursRule>(
    "select weekday, to_char(opens, 'HH24:MI') as opens, to_char(closes, 'HH24:MI') as closes from hours_rules where lane_id = $1 order by weekday, opens",
    [laneId],
  );
  const closures = await q.query<Closure>(
    "select to_char(lower(during), 'YYYY-MM-DD') as \"from\", to_char(upper(during) - 1, 'YYYY-MM-DD') as \"to\", note from closures where lane_id = $1 and upper(during) > current_date - 1 order by lower(during)",
    [laneId],
  );
  return { hours, closures };
}

async function readLane(handle: string, which: "published" | "draft"): Promise<PublicLane | null> {
  return withSystem(async (q) => {
    const l = await q.query<LaneRow>("select * from lanes where handle = $1", [handle]);
    const lane = l[0];
    if (!lane) return null;
    let doc: LaneDoc | null = null;
    let publishedAt: string | null = null;
    if (which === "published") {
      if (!lane.published_version_id) return null;
      const v = await q.query<{ doc: LaneDoc; published_at: string }>("select doc, published_at from lane_versions where id = $1", [lane.published_version_id]);
      doc = v[0]?.doc ?? null;
      publishedAt = v[0]?.published_at ?? null;
    } else doc = lane.draft;
    if (!doc) return null;
    const { hours, closures } = await hoursOf(q, lane.id);
    const services = await q.query<ServiceRow>("select * from services where lane_id = $1 and active order by sort, minutes", [lane.id]);
    const menu = await q.query<MenuRow>("select id, name, blurb, price_paise, daily_cap, active, sort from menu_items where lane_id = $1 and active order by sort", [lane.id]);
    const notes = await q.query<NoteRow>("select id, label, url, show_from, show_until, clicks, sort from notes where lane_id = $1 order by sort", [lane.id]);
    let remixes: number | null = null;
    if (lane.show_remixes) {
      const r = await q.query<{ n: number }>("select count(*)::int as n from lanes where remixed_from_lane_id = $1", [lane.id]);
      remixes = r[0].n;
    }
    return {
      id: lane.id,
      handle: lane.handle,
      tz: lane.tz,
      trade: lane.trade,
      isDemo: lane.is_demo,
      suspended: !!lane.suspended_at,
      doc,
      hours,
      closures,
      services,
      menu,
      notes,
      remixes,
      publishedAt,
    };
  });
}

/** Published lane document, cached and tagged lane:<handle>. Publish and settings changes revalidate the tag. */
export function loadPublicLane(handle: string): Promise<PublicLane | null> {
  if (!/^[a-z0-9][a-z0-9-]{2,29}$/.test(handle)) return Promise.resolve(null);
  return unstable_cache(() => readLane(handle, "published"), ["lane-pub", handle], { tags: [`lane:${handle}`], revalidate: 3600 })();
}

export function loadDraftLane(handle: string) {
  return readLane(handle, "draft");
}

export function revalidateLane(handle: string) {
  try {
    revalidateTag(`lane:${handle}`, { expire: 0 });
  } catch {
    /* outside a request scope (seed): nothing cached yet */
  }
}

/** Fresh lane row for a visitor write. */
export async function laneForWrite(q: Q, handle: string) {
  const r = await q.query<LaneRow>("select * from lanes where handle = $1 and published_version_id is not null and suspended_at is null", [handle]);
  return r[0] ?? null;
}

export const HANDLE_RE = /^[a-z0-9][a-z0-9-]{2,29}$/;

export async function handleAvailable(q: Q, h: string) {
  if (!HANDLE_RE.test(h) || h.endsWith("-") || h.includes("--")) return { ok: false, why: "3 to 30 letters, numbers or dashes" };
  const res = await q.query("select 1 from reserved_handles where handle = $1", [h]);
  if (res.length) return { ok: false, why: "Yeh naam rakha hua hai" };
  const used = await q.query("select 1 from lanes where handle = $1", [h]);
  if (used.length) return { ok: false, why: "Yeh galli kisi aur ki hai" };
  return { ok: true as const, why: "" };
}

export type NewLane = {
  trade: TradeKey;
  name: string;
  nameHi?: string;
  handle: string;
  tz: string;
  hours: { weekday: number; opens: string; closes: string }[] | "day" | "evening" | "appointment";
  whatsapp?: string;
  upi?: string;
  city?: string;
  seed: number;
  pins?: Record<string, number>;
  links?: { label: string; url: string }[];
  remixedFrom?: string | null;
  scenes?: LaneDoc["scenes"];
};

/** Creates a lane with its starter services, menu, hours and notes inside one owner transaction. */
export async function createLane(ownerId: string, n: NewLane) {
  const trade = TRADES[n.trade];
  const doc = starterDoc(trade, { name: n.name, nameHi: n.nameHi, seed: n.seed, whatsapp: n.whatsapp, upi: n.upi, city: n.city });
  if (n.pins) doc.pins = n.pins;
  if (n.scenes?.length) doc.scenes = n.scenes;
  const rules = typeof n.hours === "string" ? HOURS_PRESETS[n.hours].rules : n.hours;
  const avail = await withSystem((s) => handleAvailable(s, n.handle));
  if (!avail.ok) throw Object.assign(new Error(avail.why), { status: 409 });
  return withOwner(ownerId, async (q) => {
    const l = await q.query<{ id: string }>(
      `insert into lanes (owner_id, handle, tz, trade, draft, seed, pins, remixed_from_lane_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
      [ownerId, n.handle, n.tz, n.trade, JSON.stringify(doc), n.seed, JSON.stringify(doc.pins), n.remixedFrom ?? null],
    );
    const laneId = l[0].id;
    const r = await q.query<{ id: string }>("insert into resources (lane_id, owner_id, name) values ($1, $2, 'Main') returning id", [laneId, ownerId]);
    let i = 0;
    for (const s of trade.services) {
      await q.query(
        `insert into services (lane_id, owner_id, resource_id, name, minutes, capacity, buffer_after, price_paise, auto_confirm, sort)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [laneId, ownerId, r[0].id, JSON.stringify({ en: s.name }), s.minutes, s.capacity, s.buffer_after, s.price_paise, s.auto_confirm, i++],
      );
    }
    i = 0;
    for (const it of trade.items) {
      await q.query(
        "insert into menu_items (lane_id, owner_id, name, blurb, price_paise, daily_cap, sort) values ($1,$2,$3,$4,$5,$6,$7)",
        [laneId, ownerId, JSON.stringify({ en: it.name }), it.blurb, it.price_paise, it.daily_cap, i++],
      );
    }
    for (const h of rules) {
      await q.query("insert into hours_rules (lane_id, owner_id, weekday, opens, closes) values ($1,$2,$3,$4,$5)", [laneId, ownerId, h.weekday, h.opens, h.closes]);
    }
    i = 0;
    for (const ln of n.links ?? []) {
      await q.query("insert into notes (lane_id, owner_id, label, url, sort) values ($1,$2,$3,$4,$5)", [laneId, ownerId, ln.label.slice(0, 80), ln.url, i++]);
    }
    return laneId;
  });
}

/** Allowed link schemes on notes and contact links. */
export function safeUrl(u: string): string | null {
  const s = u.trim();
  if (/^(https?:|mailto:|tel:|upi:)/i.test(s)) {
    try {
      const url = new URL(s);
      if (url.protocol === "http:" || url.protocol === "https:") {
        if (!url.hostname.includes(".")) return null;
      }
      return url.toString();
    } catch {
      return null;
    }
  }
  if (/^wa\.me\//i.test(s)) return "https://" + s;
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(s)) return "https://" + s;
  return null;
}
