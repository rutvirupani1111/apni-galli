// The visitor's own chit, order or booking, reached by its unguessable link.
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { withSystem } from "@/lib/db";
import { fmtInTz } from "@/lib/time";
import { orderCode, rupees, upiLink, UPI_RE } from "@/lib/money";
import type { LaneDoc } from "@/lib/doc";
import { triadVars } from "@/lib/palette";
import { dna } from "@/lib/dna";
import { revalidateLane } from "@/lib/lane";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Aapki chit", robots: { index: false } };

type Chit = {
  kind: "chit";
  id: string;
  ck: "enquiry" | "order";
  status: string;
  fields: Record<string, string | number>;
  lines: { name: string; qty: number; price_paise: number }[] | null;
  total_paise: number | null;
  pickup_day: string | null;
  read_at: string | null;
  paid_marked_at: string | null;
  decline_reason: string | null;
  created_at: string;
  handle: string;
  tz: string;
  doc: LaneDoc;
  is_demo: boolean;
  replies: { body: string; created_at: string }[];
};
type Booking = { kind: "booking"; id: string; status: string; slot_s: string; slot_e: string; service: string; visitor_name: string; created_at: string; handle: string; tz: string; doc: LaneDoc; is_demo: boolean };

async function load(token: string): Promise<Chit | Booking | null> {
  if (!/^[\w-]{16,40}$/.test(token)) return null;
  return withSystem(async (q) => {
    const c = await q.query<Omit<Chit, "kind" | "replies" | "ck"> & { ck: Chit["ck"] }>(
      `select c.id, c.kind as ck, c.status, c.fields, c.lines, c.total_paise, to_char(c.pickup_day,'YYYY-MM-DD') as pickup_day, c.read_at, c.paid_marked_at,
              c.decline_reason, c.created_at, l.handle, l.tz, v.doc, l.is_demo
         from chits c join lanes l on l.id = c.lane_id join lane_versions v on v.id = l.published_version_id where c.public_token = $1`,
      [token],
    );
    if (c[0]) {
      const replies = await q.query<{ body: string; created_at: string }>("select body, created_at from chit_replies where chit_id = $1 order by created_at", [c[0].id]);
      return { kind: "chit", ...c[0], replies };
    }
    const b = await q.query<Omit<Booking, "kind">>(
      `select b.id, b.status, lower(b.slot) as slot_s, upper(b.slot) as slot_e, s.name->>'en' as service, b.visitor_name, b.created_at, l.handle, l.tz, v.doc, l.is_demo
         from bookings b join services s on s.id = b.service_id join lanes l on l.id = b.lane_id join lane_versions v on v.id = l.published_version_id
        where b.public_token = $1`,
      [token],
    );
    return b[0] ? { kind: "booking", ...b[0] } : null;
  });
}

export default async function ChitStatus({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { token } = await params;
  const sp = await searchParams;
  if (sp.deleted) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <h1 className="mast t-mast">Chit mita di</h1>
        <p className="mt-3">Aapki chit aur uske jawab database se hata diye gaye.</p>
      </main>
    );
  }
  const x = await load(token);
  if (!x) notFound();
  const d = dna(x.doc.seed, x.doc.pins);

  async function del() {
    "use server";
    // a visitor can delete their own chit (DPDP / GDPR); stock goes back if it was an open order
    await withSystem(async (q) => {
      const c = await q.query<{ id: string; kind: string; lines: { item_id: string; qty: number }[] | null; pickup_day: string | null; status: string }>(
        "select id, kind, lines, to_char(pickup_day,'YYYY-MM-DD') as pickup_day, status from chits where public_token = $1",
        [token],
      );
      if (!c[0]) return;
      if (c[0].kind === "order" && c[0].lines && c[0].pickup_day && !["declined", "done"].includes(c[0].status)) {
        for (const l of c[0].lines) await q.query("update item_day_stock set sold = greatest(0, sold - $3) where item_id = $1 and day = $2", [l.item_id, c[0].pickup_day, l.qty]);
      }
      await q.query("delete from chits where id = $1", [c[0].id]);
    });
    redirect(`/c/${token}?deleted=1`);
  }
  async function cancel() {
    "use server";
    const h = await withSystem(async (q) => {
      const r = await q.query<{ handle: string }>(
        "update bookings b set status = 'cancelled', updated_at = now() from lanes l where b.public_token = $1 and l.id = b.lane_id and b.status in ('pending','confirmed') and lower(b.slot) > now() returning l.handle",
        [token],
      );
      return r[0]?.handle;
    });
    if (h) revalidateLane(h);
    redirect(`/c/${token}`);
  }

  const shell = (children: React.ReactNode) => (
    <main className="min-h-dvh px-4 py-8" style={{ ...(triadVars(d.palette) as React.CSSProperties), background: "linear-gradient(var(--sky-1), var(--chalk) 45%)" }}>
      <div className="mx-auto max-w-lg">
        <a href={`/w/${x.handle}`} className="sign inline-block rounded border-2 border-[#1e1b18] px-3 py-1 text-xl" style={{ background: "var(--lane-a)", color: "var(--on-lane-a)", boxShadow: "var(--shadow-paper-sm)" }}>
          {x.doc.name}
        </a>
        {x.is_demo && <p className="mono mt-2 text-xs">Demo galli. Owner ki taraf se jawab dene ke liye <a className="underline" href="/demo/galla">demo Galla</a> kholo.</p>}
        {children}
      </div>
    </main>
  );

  if (x.kind === "booking") {
    const live = ["pending", "confirmed"].includes(x.status) && new Date(x.slot_s) > new Date();
    return shell(
      <div className="chit mt-6 px-5 pb-6 pt-7 text-[#1e1b18]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="mono text-[#4a4038]">BOOKING</p>
            <h1 className="sign mt-1 text-3xl">{x.service}</h1>
          </div>
          <span className={`stamp text-xl ${x.status === "confirmed" ? "" : "!text-[var(--enamel-blue)]"}`}>{{ confirmed: "PAKKA", pending: "PENDING", cancelled: "CANCELLED", declined: "DECLINED", done: "HO GAYA" }[x.status] ?? x.status}</span>
        </div>
        <p className="mono mt-4">
          {fmtInTz(x.slot_s, x.tz, { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" })} ({x.tz})
        </p>
        <p className="mt-1">Naam: {x.visitor_name}</p>
        {live && (
          <div className="mt-5 flex flex-wrap gap-2">
            <a className="btn" href={`/w/${x.handle}/counter?reschedule=${token}`}>
              Reschedule
            </a>
            <form action={cancel}>
              <button className="btn">Cancel booking</button>
            </form>
          </div>
        )}
      </div>,
    );
  }

  const paid = !!x.paid_marked_at;
  const steps = [
    { k: "Bheji", on: true, at: x.created_at },
    { k: "Padha", on: !!x.read_at || x.status !== "new", at: x.read_at },
    { k: x.ck === "order" ? "Pakka" : "Jawab aaya", on: x.ck === "order" ? ["confirmed", "paid", "done"].includes(x.status) || x.replies.length > 0 : x.replies.length > 0, at: x.replies[0]?.created_at ?? null },
    ...(x.ck === "order" || x.doc.upi.vpa ? [{ k: "Chukta", on: paid, at: x.paid_marked_at }] : []),
  ];
  const code = orderCode(token);
  const vpa = x.doc.upi.vpa;
  const upi = x.ck === "order" && vpa && UPI_RE.test(vpa) && x.total_paise ? upiLink({ vpa, name: x.doc.upi.name || x.doc.name, paise: x.total_paise, note: `Order ${code}` }) : null;

  return shell(
    <>
      <h1 className="mast t-mast mt-6">{x.ck === "order" ? `Order ${code}` : "Aapki chit"}</h1>
      <ol className="mt-5 grid gap-2" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0,1fr))` }} aria-label="Status">
        {steps.map((s, i) => (
          <li key={s.k} className="text-center">
            <span className="mx-auto grid size-11 place-items-center rounded-full border-2 border-[var(--soot)] font-semibold" style={{ background: s.on ? "var(--lane-a)" : "transparent", color: s.on ? "var(--on-lane-a)" : "var(--muted)", animation: s.on ? `plane-land 330ms ${i * 90}ms var(--spring-ui) both` : undefined }}>
              {i + 1}
            </span>
            <span className="mono mt-1 block text-xs">{s.k}</span>
            <span className="sr-only">{s.on ? "done" : "not yet"}</span>
          </li>
        ))}
      </ol>
      {x.status === "declined" && <p className="mt-4 rounded border-2 border-[var(--sindoor)] p-2">Owner ne mana kiya{x.decline_reason ? `: ${x.decline_reason}` : "."}</p>}

      <div className="chit relative mt-6 px-5 pb-6 pt-7 text-[#1e1b18]">
        {x.ck === "order" && (
          <>
            <ul className="mono space-y-0.5">
              {x.lines?.map((l, i) => (
                <li key={i} className="flex justify-between">
                  <span>
                    {l.qty} × {l.name}
                  </span>
                  <span>{rupees(l.qty * l.price_paise)}</span>
                </li>
              ))}
              <li className="flex justify-between border-t-2 border-dashed border-[#1e1b18] pt-1 font-medium">
                <span>TOTAL</span>
                <span>{rupees(x.total_paise ?? 0)}</span>
              </li>
            </ul>
            <p className="mono mt-2">PICKUP {x.pickup_day}</p>
          </>
        )}
        <dl className="mt-3 space-y-1">
          {Object.entries(x.fields)
            .filter(([k]) => k !== "contact")
            .map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="mono shrink-0 text-[#4a4038]">{(x.doc.chitFields.find((f) => f.key === k)?.label ?? k).toUpperCase()}</dt>
                <dd className="hand">{String(v)}</dd>
              </div>
            ))}
        </dl>
        {paid ? (
          <span className="stamp stamp-in absolute right-4 top-4 text-3xl">चुकता / PAID</span>
        ) : x.ck === "order" ? (
          <p className="mt-4 text-sm font-semibold">Payment ki pushti baaki.</p>
        ) : null}
        {upi && !paid && (
          <a className="cta mt-3" href={upi}>
            UPI se {rupees(x.total_paise ?? 0)} bhejo
          </a>
        )}
      </div>

      <section className="mt-6">
        <h2 className="sign text-2xl">Jawab</h2>
        {x.replies.length === 0 ? (
          <p className="text-[var(--muted)]">Abhi jawab nahi aaya. Yeh page wapas kholo, ya email diya hai to wahan aayega.</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {x.replies.map((r, i) => (
              <li key={i} className="rounded-md border-2 border-[var(--soot)] bg-[var(--chalk)] p-3" style={{ boxShadow: "var(--shadow-paper-sm)" }}>
                <p className="whitespace-pre-wrap">{r.body}</p>
                <p className="mono mt-1 text-xs text-[var(--muted)]">{fmtInTz(r.created_at, x.tz, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <form action={del} className="mt-10 border-t-2 border-dashed border-[var(--line)] pt-4">
        <p className="text-sm text-[var(--muted)]">Apni chit aur uske jawab hamesha ke liye mitana chahte ho?</p>
        <button className="btn mt-2">Meri chit mitao</button>
      </form>
    </>,
  );
}
