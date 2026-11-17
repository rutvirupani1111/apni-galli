// The tick: every job is idempotent and every sweep runs in chunks of 2,000 rows that commit between chunks.
// Vercel's daily cron calls it (GET with Bearer CRON_SECRET); a free external scheduler can call it every 10 min.
import { withSystem, type Q } from "@/lib/db";
import { queueMail, isEmail } from "@/lib/email";
import { fmtInTz, localDate, tzParts } from "@/lib/time";
import { baseUrl } from "@/lib/visitor";
import { signToken } from "@/lib/crypto";

export const maxDuration = 60;

async function chunked(sql: string, params: unknown[] = []) {
  let total = 0;
  for (let i = 0; i < 50; i++) {
    const r = await withSystem((q) => q.query<{ n: number }>(sql, params));
    const n = r[0]?.n ?? 0;
    total += n;
    if (n < 2000) break;
  }
  return total;
}

async function claim(q: Q, job: string, key: string) {
  const r = await q.query("insert into job_runs (job, run_key) values ($1,$2) on conflict do nothing returning job", [job, key]);
  return r.length > 0;
}

async function tick() {
  const out: Record<string, number> = {};
  out.expired_holds = await chunked(
    `with x as (select id from bookings where status = 'hold' and expires_at < now() order by id limit 2000 for update skip locked)
     , d as (delete from bookings b using x where b.id = x.id returning 1) select count(*)::int as n from d`,
  );
  out.demo_cleanup =
    (await chunked(`with x as (select id from chits where demo_sid is not null and created_at < now() - interval '24 hours' limit 2000 for update skip locked), d as (delete from chits c using x where c.id = x.id returning 1) select count(*)::int as n from d`)) +
    (await chunked(`with x as (select id from bookings where demo_sid is not null and created_at < now() - interval '24 hours' limit 2000 for update skip locked), d as (delete from bookings b using x where b.id = x.id returning 1) select count(*)::int as n from d`)) +
    (await chunked(`with x as (select id from subscribers where demo_sid is not null and created_at < now() - interval '24 hours' limit 2000 for update skip locked), d as (delete from subscribers s using x where s.id = x.id returning 1) select count(*)::int as n from d`));
  // demo stock resets with the demo orders
  await withSystem((q) => q.query("delete from item_day_stock s using menu_items m, lanes l where s.item_id = m.id and m.lane_id = l.id and l.is_demo and not exists (select 1 from chits c where c.lane_id = l.id and c.pickup_day = s.day)"));
  out.sessions = await chunked(`with x as (select id from sessions where expires_at < now() limit 2000), d as (delete from sessions s using x where s.id = x.id returning 1) select count(*)::int as n from d`);
  out.rate_buckets = await chunked(`with x as (select key from rate_buckets where refilled_at < now() - interval '1 day' limit 2000), d as (delete from rate_buckets r using x where r.key = x.key returning 1) select count(*)::int as n from d`);

  // reminders at about 24 h and about 2 h before the slot; each stamp makes it send once
  out.reminders = await withSystem(async (q) => {
    const due = await q.query<{ id: string; which: string; slot_s: string; visitor_contact: string; public_token: string; service: string; tz: string; lane_id: string; owner_id: string; name: string }>(
      `select b.id, case when lower(b.slot) < now() + interval '2 hours 10 minutes' then '2' else '24' end as which, lower(b.slot) as slot_s,
              b.visitor_contact, b.public_token, s.name->>'en' as service, l.tz, l.id as lane_id, l.owner_id, l.draft->>'name' as name
         from bookings b join services s on s.id = b.service_id join lanes l on l.id = b.lane_id
        where b.status = 'confirmed' and not l.is_demo and lower(b.slot) > now()
          and ((lower(b.slot) < now() + interval '24 hours 10 minutes' and b.reminder_24_sent_at is null)
            or (lower(b.slot) < now() + interval '2 hours 10 minutes' and b.reminder_2_sent_at is null))
        limit 500 for update of b skip locked`,
    );
    for (const b of due) {
      if (isEmail(b.visitor_contact ?? "")) {
        await queueMail(q, {
          laneId: b.lane_id,
          ownerId: b.owner_id,
          to: b.visitor_contact,
          kind: `reminder-${b.which}`,
          subject: `Yaad hai? ${b.service} with ${b.name}, in about ${b.which === "2" ? "2 hours" : "a day"}`,
          text: `${b.service}, ${fmtInTz(b.slot_s, b.tz, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} (${b.tz}).\nReschedule or cancel: ${baseUrl()}/c/${b.public_token}`,
        });
      }
      if (b.which === "2") await q.query("update bookings set reminder_2_sent_at = now(), reminder_24_sent_at = coalesce(reminder_24_sent_at, now()) where id = $1", [b.id]);
      else await q.query("update bookings set reminder_24_sent_at = now() where id = $1", [b.id]);
    }
    return due.length;
  });

  // the daily Hisaab digest at 08:00 owner time, once per lane per day
  out.digests = await withSystem(async (q) => {
    const lanes = await q.query<{ id: string; tz: string; email: string; name: string; owner_id: string }>(
      "select l.id, l.tz, o.email, l.draft->>'name' as name, l.owner_id from lanes l join owners o on o.id = l.owner_id where not l.is_demo and not o.is_demo and l.published_version_id is not null",
    );
    let n = 0;
    for (const l of lanes) {
      const p = tzParts(new Date(), l.tz);
      if (p.h < 8) continue;
      if (!(await claim(q, "digest", `${l.id}:${localDate(new Date(), l.tz)}`))) continue;
      const c = await q.query<{ bk: number; chits: number; orders: number }>(
        `select (select count(*)::int from bookings where lane_id = $1 and status in ('pending','confirmed') and (lower(slot) at time zone $2)::date = (now() at time zone $2)::date) as bk,
                (select count(*)::int from chits where lane_id = $1 and kind = 'enquiry' and status in ('new','read') and created_at < now() - interval '2 hours') as chits,
                (select count(*)::int from chits where lane_id = $1 and kind = 'order' and status in ('new','read','confirmed','paid')) as orders`,
        [l.id, l.tz],
      );
      await queueMail(q, { laneId: l.id, ownerId: l.owner_id, to: l.email, kind: "digest", subject: `Aaj ka hisaab: ${c[0].bk} bookings, ${c[0].chits} chits waiting, ${c[0].orders} orders`, text: `${l.name}\nBookings today: ${c[0].bk}\nChits waiting over 2 hours: ${c[0].chits}\nOrders to prepare: ${c[0].orders}\n\nGalla: ${baseUrl()}/studio/${l.id}/galla` });
      n++;
    }
    return n;
  });

  // postcards that hit the daily quota drip out the next day
  out.postcard_drip = await withSystem(async (q) => {
    const rows = await q.query<{ postcard_id: string; subscriber_id: string; owner_id: string; email: string; subject: string; body: string; lane_id: string }>(
      `select ps.postcard_id, ps.subscriber_id, ps.owner_id, s.email, p.subject, p.body, p.lane_id from postcard_sends ps
         join postcards p on p.id = ps.postcard_id join subscribers s on s.id = ps.subscriber_id
        where ps.sent_at is null and s.status = 'confirmed'
          and (select count(*) from postcard_sends z where z.owner_id = ps.owner_id and z.sent_at > now() - interval '1 day') < 100
        limit 100 for update of ps skip locked`,
    );
    for (const r of rows) {
      const unsub = `${baseUrl()}/n/unsub/${encodeURIComponent(await signToken({ s: r.subscriber_id, a: "unsub" }, 365))}`;
      await queueMail(q, { laneId: r.lane_id, ownerId: r.owner_id, to: r.email, kind: "postcard", subject: r.subject, text: `${r.body}\n\n---\nUnsubscribe in one click: ${unsub}`, unsubscribeUrl: unsub });
      await q.query("update postcard_sends set sent_at = now() where postcard_id = $1 and subscriber_id = $2", [r.postcard_id, r.subscriber_id]);
      await q.query("update postcards set sent_count = sent_count + 1, status = case when not exists (select 1 from postcard_sends where postcard_id = $1 and sent_at is null) then 'sent' else status end where id = $1", [r.postcard_id]);
    }
    return rows.length;
  });
  out.bad_hosts = await refreshBadHosts();
  return out;
}

// Malware and phishing hosts for the noticeboard link check. URLhaus retired its anonymous downloads
// (HTTP 410 since 2026), so the free OpenPhish community feed is used: one URL per line, hosts kept.
// Refreshed once a day, capped at 4 MB, written in chunks of 2,000.
async function refreshBadHosts() {
  const today = new Date().toISOString().slice(0, 10);
  const go = await withSystem((q) => claim(q, "bad_hosts", today));
  if (!go) return 0;
  try {
    const res = await fetch("https://openphish.com/feed.txt", { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return 0;
    const text = (await res.text()).slice(0, 4_000_000);
    const hostOf = (line: string) => {
      const t = line.trim();
      if (!t || t.startsWith("#")) return "";
      try {
        return new URL(t.includes("://") ? t : `http://${t.split(/\s+/).pop()}`).hostname.toLowerCase();
      } catch {
        return "";
      }
    };
    const hosts = [...new Set(text.split(/\r?\n/).map(hostOf).filter((h) => h.includes(".") && h.length < 254))];
    for (let i = 0; i < hosts.length; i += 2000) {
      const part = hosts.slice(i, i + 2000);
      await withSystem((q) => q.query("insert into bad_hosts (host, source) select unnest($1::text[]), 'openphish' on conflict (host) do update set seen_at = now()", [part]));
    }
    await chunked(`with x as (select host from bad_hosts where seen_at < now() - interval '7 days' limit 2000), d as (delete from bad_hosts b using x where b.host = x.host returning 1) select count(*)::int as n from d`);
    return hosts.length;
  } catch {
    return 0;
  }
}

async function handler(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const out = await tick();
  return Response.json({ ok: true, ...out, at: new Date().toISOString() });
}
export const GET = handler;
export const POST = handler;
