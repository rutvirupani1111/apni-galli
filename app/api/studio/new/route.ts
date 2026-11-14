import { z } from "zod";
import { body, json, route } from "@/lib/http";
import { currentOwner, createSession } from "@/lib/auth";
import { withSystem } from "@/lib/db";
import { checkPassword, hashPassword, ipHash } from "@/lib/crypto";
import { createLane, HANDLE_RE, safeUrl } from "@/lib/lane";
import { take, clientIp } from "@/lib/ratelimit";
import { HttpError } from "@/lib/visitor";
import { validTz } from "@/lib/time";
import { UPI_RE } from "@/lib/money";
import { SCENES } from "@/lib/dna";

const Hours = z.array(z.object({ weekday: z.number().int().min(0).max(6), opens: z.string().regex(/^\d{2}:\d{2}$/), closes: z.string().regex(/^\d{2}:\d{2}$/) })).max(28);
const B = z.object({
  trade: z.enum(["baker", "tutor", "mehendi", "photo", "designer", "boutique", "writer", "other"]),
  name: z.string().trim().min(2).max(60),
  nameHi: z.string().trim().max(60).optional(),
  handle: z.string().trim().toLowerCase().regex(HANDLE_RE),
  tz: z.string().max(60).refine(validTz, "Unknown timezone"),
  hours: z.union([z.enum(["day", "evening", "appointment"]), Hours]),
  whatsapp: z.string().trim().regex(/^\+?[\d\s-]{8,16}$/).optional().or(z.literal("")),
  upi: z.string().trim().regex(UPI_RE).optional().or(z.literal("")),
  city: z.string().trim().max(60).optional(),
  seed: z.number().int(),
  pins: z.record(z.string(), z.number().int()).optional(),
  links: z.array(z.object({ label: z.string().max(80), url: z.string().max(500) })).max(20).optional(),
  remix: z.string().regex(HANDLE_RE).optional().nullable(),
  account: z.object({ email: z.string().trim().toLowerCase().email().max(160), password: z.string().min(8).max(200), mode: z.enum(["signup", "login"]) }).optional(),
});

// Pehla Kadam finishes here: one call creates (or signs into) the account and builds the lane.
export const POST = route(async (req: Request) => {
  const b = await body(req, B);
  let owner = await currentOwner();
  if (!owner) {
    if (!b.account) throw new HttpError(401, "account", "Email aur password chahiye");
    if (!(await take(`signup:${await ipHash(clientIp(req))}`, 8, 3600))) throw new HttpError(429, "rate", "Bahut koshish. Baad mein try karo.");
    const a = b.account;
    if (a.mode === "signup") {
      const hash = await hashPassword(a.password);
      const r = await withSystem((q) => q.query<{ id: string; email: string }>("insert into owners (email, password_hash) values ($1,$2) on conflict do nothing returning id, email", [a.email, hash]));
      if (!r[0]) throw new HttpError(409, "exists", "Is email se account hai. Login chuno.");
      owner = { id: r[0].id, email: r[0].email, display_name: null };
    } else {
      const r = await withSystem((q) => q.query<{ id: string; email: string; password_hash: string; is_demo: boolean }>("select id, email, password_hash, is_demo from owners where lower(email) = $1", [a.email]));
      if (!r[0] || r[0].is_demo || !(await checkPassword(a.password, r[0].password_hash))) throw new HttpError(401, "login", "Email ya password galat");
      owner = { id: r[0].id, email: r[0].email, display_name: null };
    }
    await createSession(owner.id);
  }
  const mine = await withSystem((q) => q.query<{ n: number }>("select count(*)::int as n from lanes where owner_id = $1", [owner!.id]));
  if (mine[0].n >= 5) throw new HttpError(400, "limit", "Ek account mein 5 galliyan tak");
  let remixedFrom: string | null = null;
  let scenes: (typeof SCENES)[number][] | undefined;
  if (b.remix) {
    // remix copies structure only: scene list, seed, pins. Never text, photos, prices, contacts, hours or UPI.
    const src = await withSystem((q) => q.query<{ id: string; scenes: string[] }>("select l.id, v.doc->'scenes' as scenes from lanes l join lane_versions v on v.id = l.published_version_id where l.handle = $1", [b.remix]));
    if (src[0]) {
      remixedFrom = src[0].id;
      scenes = src[0].scenes.filter((s): s is (typeof SCENES)[number] => (SCENES as readonly string[]).includes(s));
    }
  }
  const links = (b.links ?? []).map((l) => ({ label: l.label || l.url, url: safeUrl(l.url) })).filter((l): l is { label: string; url: string } => !!l.url);
  const laneId = await createLane(owner.id, {
    trade: b.trade,
    name: b.name,
    nameHi: b.nameHi,
    handle: b.handle,
    tz: b.tz,
    hours: b.hours,
    whatsapp: b.whatsapp || undefined,
    upi: b.upi || undefined,
    city: b.city,
    seed: b.seed,
    pins: b.pins,
    links,
    remixedFrom,
    scenes,
  });
  if (links.length && !(scenes ?? []).includes("notice")) {
    // imported links need a noticeboard
    const { withOwner } = await import("@/lib/db");
    await withOwner(owner.id, (q) => q.query("update lanes set draft = jsonb_set(draft, '{scenes}', (draft->'scenes') || '\"notice\"'::jsonb) where id = $1 and not (draft->'scenes' ? 'notice')", [laneId]));
  }
  return json({ laneId }, 201);
});
