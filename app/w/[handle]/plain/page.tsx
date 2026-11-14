// Plain Lane: the same content and actions as semantic HTML, no art. Every form works with JavaScript off
// (server actions with progressive forms). It is where no-JS visitors land.
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { loadPublicLane } from "@/lib/lane";
import { computeStatus, hoursSummary } from "@/lib/status";
import { SCENE_META } from "@/lib/doc";
import { rupees } from "@/lib/money";
import { addDays, localDate, fmtInTz } from "@/lib/time";
import { confirmHold, createEnquiry, createHold, createOrder, pickupDays, slotsFor, subscribe, HttpError } from "@/lib/visitor";
import { demoSid } from "@/lib/demo";
import { visitorWriteAllowed } from "@/lib/ratelimit";
import { rand } from "@/lib/crypto";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const lane = await loadPublicLane(handle);
  return lane ? { title: `${lane.doc.name} (plain)`, description: lane.doc.tagline } : {};
}

async function guard(handle: string, laneId: string, route: string) {
  const h = await headers();
  const req = new Request("http://x", { headers: { "x-forwarded-for": h.get("x-forwarded-for") ?? "" } });
  if (!(await visitorWriteAllowed(req, laneId, route))) redirect(`/w/${handle}/plain?err=${encodeURIComponent("Bahut zyada koshish. 10 minute baad try karo.")}`);
}
const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export default async function Plain({ params, searchParams }: { params: Promise<{ handle: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { handle } = await params;
  const sp = await searchParams;
  const lane = await loadPublicLane(handle);
  if (!lane) notFound();
  const doc = lane.doc;
  const st = computeStatus({ tz: lane.tz, hours: lane.hours, closures: lane.closures }, new Date());
  const today = localDate(new Date(), lane.tz);
  const svcId = sp.service ?? lane.services[0]?.id;
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const slots = svcId && doc.scenes.includes("counter") && lane.services.length ? await slotsFor(handle, svcId, date).catch(() => null) : null;
  const days = pickupDays({ tz: lane.tz, hours: lane.hours, closures: lane.closures });

  async function sendChit(f: FormData) {
    "use server";
    if (s(f, "website")) redirect(`/w/${handle}/plain`);
    const l = await loadPublicLane(handle);
    if (!l) notFound();
    await guard(handle, l.id, "enquiry");
    const fields: Record<string, string> = {};
    for (const fl of l.doc.chitFields) fields[fl.key] = s(f, `f_${fl.key}`);
    let token = "";
    try {
      token = (await createEnquiry(handle, { scene: "plain", fields, idem: s(f, "idem") || rand(12), demoSid: l.isDemo ? await demoSid(true) : null })).publicToken;
    } catch (e) {
      redirect(`/w/${handle}/plain?err=${encodeURIComponent(e instanceof HttpError ? e.message : "Chit nahi gayi")}#chit`);
    }
    redirect(`/c/${token}`);
  }

  async function placeOrder(f: FormData) {
    "use server";
    if (s(f, "website")) redirect(`/w/${handle}/plain`);
    const l = await loadPublicLane(handle);
    if (!l) notFound();
    await guard(handle, l.id, "order");
    const lines = l.menu.map((m) => ({ item_id: m.id, qty: Math.max(0, Math.min(50, Number(s(f, `q_${m.id}`)) || 0)) })).filter((x) => x.qty > 0);
    let token = "";
    try {
      if (!lines.length) throw new HttpError(400, "empty", "Kuch to chuno");
      token = (await createOrder(handle, { lines, pickupDay: s(f, "day"), name: s(f, "name"), contact: s(f, "contact"), note: s(f, "note"), idem: s(f, "idem") || rand(12), demoSid: l.isDemo ? await demoSid(true) : null })).publicToken;
    } catch (e) {
      redirect(`/w/${handle}/plain?err=${encodeURIComponent(e instanceof HttpError ? e.message : "Order nahi gaya")}#menu`);
    }
    redirect(`/c/${token}`);
  }

  async function book(f: FormData) {
    "use server";
    if (s(f, "website")) redirect(`/w/${handle}/plain`);
    const l = await loadPublicLane(handle);
    if (!l) notFound();
    await guard(handle, l.id, "hold");
    let token = "";
    try {
      const name = s(f, "name");
      const contact = s(f, "contact");
      if (name.length < 2 || contact.length < 5) throw new HttpError(400, "missing", "Naam aur contact likho");
      const h = await createHold(handle, s(f, "service"), s(f, "start"), l.isDemo ? await demoSid(true) : null);
      token = (await confirmHold(handle, { holdToken: h.holdToken, name, contact, note: s(f, "note") })).publicToken;
    } catch (e) {
      redirect(`/w/${handle}/plain?service=${s(f, "service")}&date=${s(f, "date")}&err=${encodeURIComponent(e instanceof HttpError ? e.message : "Booking nahi hui")}#counter`);
    }
    redirect(`/c/${token}`);
  }

  async function join(f: FormData) {
    "use server";
    const l = await loadPublicLane(handle);
    if (!l) notFound();
    await guard(handle, l.id, "subscribe");
    const email = s(f, "email");
    let url: string | null = null;
    try {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new HttpError(400, "bad", "Email sahi nahi");
      const h = await headers();
      url = (await subscribe(handle, email, h.get("x-forwarded-for") ?? "local", l.isDemo ? await demoSid(true) : null)).confirmUrl;
    } catch (e) {
      redirect(`/w/${handle}/plain?err=${encodeURIComponent(e instanceof HttpError ? e.message : "Nahi hua")}#postbox`);
    }
    redirect(`/w/${handle}/plain?subscribed=1${url ? `&confirm=${encodeURIComponent(url)}` : ""}#postbox`);
  }

  const idem = rand(12);
  return (
    <main className="mx-auto max-w-2xl px-4 py-8 leading-relaxed">
      <p>
        <a href={`/w/${handle}`}>Full lane with pictures</a>
      </p>
      {lane.isDemo && <p>Demo lane: this shop is not real. Your actions go to your own demo front desk.</p>}
      <h1 className="mt-4 text-3xl font-bold">{doc.name}</h1>
      {doc.nameHi && <p className="font-deva text-xl">{doc.nameHi}</p>}
      <p>{doc.tagline}</p>
      <p>
        <strong>{st.line}.</strong> Hours: {hoursSummary(lane.hours)} ({lane.tz})
      </p>
      {sp.err && (
        <p role="alert" className="mt-3 border-2 border-[var(--sindoor)] p-2">
          {sp.err}
        </p>
      )}
      <nav aria-label="Buildings" className="mt-4">
        <ul className="list-disc pl-6">
          {doc.scenes.map((sc) => (
            <li key={sc}>
              <a href={`#${sc}`}>{SCENE_META[sc].name}</a>
            </li>
          ))}
          <li>
            <a href="#chit">Send a chit</a>
          </li>
        </ul>
      </nav>

      {doc.scenes.includes("window") && (
        <section id="window" className="mt-8">
          <h2 className="text-2xl font-bold">{doc.window.title || "Work"}</h2>
          <ul className="list-disc pl-6">
            {doc.window.items.map((i) => (
              <li key={i.id}>
                <a href={`/w/${handle}/window/${i.id}`}>{i.title}</a>: {i.blurb}
                {i.price_paise ? `, ${rupees(i.price_paise)}` : ""}
                {i.stamp ? ` (${i.stamp})` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      {doc.scenes.includes("counter") && lane.services.length > 0 && (
        <section id="counter" className="mt-8">
          <h2 className="text-2xl font-bold">Book a slot</h2>
          <form method="get" action={`/w/${handle}/plain#counter`} className="mt-2 flex flex-wrap items-end gap-2">
            <label>
              Service{" "}
              <select name="service" defaultValue={svcId} className="input">
                {lane.services.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name.en} ({x.minutes} min{x.price_paise ? `, ${rupees(x.price_paise)}` : ""})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Date <input type="date" name="date" defaultValue={date} min={today} max={addDays(today, 30)} className="input" />
            </label>
            <button className="btn">Show slots</button>
          </form>
          {slots && (
            <form action={book} className="mt-3">
              <input type="hidden" name="service" value={svcId} />
              <input type="hidden" name="date" value={date} />
              <fieldset>
                <legend>Free slots on {date}</legend>
                {slots.slots.filter((x) => x.seatsLeft > 0).length === 0 && <p>No free slots that day.</p>}
                {slots.slots
                  .filter((x) => x.seatsLeft > 0)
                  .map((x, i) => (
                    <label key={x.start} className="mr-3 inline-flex min-h-11 items-center gap-1">
                      <input type="radio" name="start" value={x.start} required defaultChecked={i === 0} /> {fmtInTz(x.start, lane.tz, { hour: "numeric", minute: "2-digit" })}
                    </label>
                  ))}
              </fieldset>
              <label className="mt-2 block">
                Name <input name="name" required className="input" autoComplete="name" />
              </label>
              <label className="mt-2 block">
                WhatsApp or email <input name="contact" required className="input" />
              </label>
              <label className="mt-2 block">
                Note <input name="note" className="input" />
              </label>
              <input type="text" name="website" tabIndex={-1} autoComplete="off" className="absolute -left-[9999px]" aria-hidden="true" />
              <button className="cta mt-3">Book this slot</button>
            </form>
          )}
        </section>
      )}

      {doc.scenes.includes("menu") && lane.menu.length > 0 && (
        <section id="menu" className="mt-8">
          <h2 className="text-2xl font-bold">Order</h2>
          <form action={placeOrder}>
            <input type="hidden" name="idem" value={idem} />
            <table className="w-full">
              <tbody>
                {lane.menu.map((m) => (
                  <tr key={m.id}>
                    <td className="py-1">
                      {m.name.en} <small>({m.blurb})</small>
                    </td>
                    <td>{rupees(m.price_paise)}</td>
                    <td>
                      <label>
                        <span className="sr-only">Quantity of {m.name.en}</span>
                        <input type="number" name={`q_${m.id}`} min={0} max={50} defaultValue={0} className="input w-20" />
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <label className="mt-2 block">
              Pickup day{" "}
              <select name="day" className="input">
                {days.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-2 block">
              Name <input name="name" required className="input" />
            </label>
            <label className="mt-2 block">
              WhatsApp or email <input name="contact" required className="input" />
            </label>
            <label className="mt-2 block">
              Note <input name="note" className="input" />
            </label>
            <input type="text" name="website" tabIndex={-1} autoComplete="off" className="absolute -left-[9999px]" aria-hidden="true" />
            <button className="cta mt-3">Send order</button>
          </form>
        </section>
      )}

      {doc.scenes.includes("postbox") && (
        <section id="postbox" className="mt-8">
          <h2 className="text-2xl font-bold">Newsletter</h2>
          <p>{doc.postbox.pitch}</p>
          {sp.subscribed ? (
            <p role="status">
              Almost done: open the confirmation email.{" "}
              {sp.confirm && (
                <>
                  Demo lane, so no email was sent: <a href={sp.confirm}>confirm here</a>.
                </>
              )}
            </p>
          ) : (
            <form action={join} className="flex flex-wrap items-end gap-2">
              <label>
                Email <input type="email" name="email" required className="input" />
              </label>
              <button className="btn">Subscribe</button>
            </form>
          )}
        </section>
      )}

      {doc.scenes.includes("notice") && (
        <section id="notice" className="mt-8">
          <h2 className="text-2xl font-bold">Links</h2>
          <ul className="list-disc pl-6">
            {lane.notes.map((n) => (
              <li key={n.id}>
                <a href={`/go/${n.id}`}>{n.label}</a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {doc.scenes.includes("loft") && (
        <section id="loft" className="mt-8">
          <h2 className="text-2xl font-bold">About</h2>
          <p>{doc.loft.story}</p>
          <ol className="list-decimal pl-6">
            {doc.loft.steps.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ol>
        </section>
      )}

      {doc.scenes.includes("rooftop") && (
        <section id="rooftop" className="mt-8">
          <h2 className="text-2xl font-bold">Contact</h2>
          <p>{doc.rooftop.note}</p>
          <ul className="list-disc pl-6">
            {doc.contact.whatsapp && (
              <li>
                <a href={`https://wa.me/${doc.contact.whatsapp.replace(/\D/g, "")}`}>WhatsApp</a>
              </li>
            )}
            {doc.contact.phone && (
              <li>
                <a href={`tel:${doc.contact.phone}`}>{doc.contact.phone}</a>
              </li>
            )}
            {doc.contact.email && (
              <li>
                <a href={`mailto:${doc.contact.email}`}>{doc.contact.email}</a>
              </li>
            )}
            {doc.contact.address && <li>{doc.contact.address}</li>}
          </ul>
        </section>
      )}

      <section id="chit" className="mt-8">
        <h2 className="text-2xl font-bold">Send a chit</h2>
        <form action={sendChit}>
          <input type="hidden" name="idem" value={idem + "c"} />
          {doc.chitFields.map((f) => (
            <label key={f.key} className="mt-2 block">
              {f.label}
              {f.required ? " *" : ""}{" "}
              {f.type === "long" ? (
                <textarea name={`f_${f.key}`} required={f.required} className="input" rows={3} />
              ) : f.type === "chips" ? (
                <select name={`f_${f.key}`} className="input" required={f.required}>
                  <option value="">Choose</option>
                  {f.options?.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input name={`f_${f.key}`} type={f.type === "date" ? "date" : f.type === "count" ? "number" : "text"} required={f.required} className="input" />
              )}
            </label>
          ))}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" className="absolute -left-[9999px]" aria-hidden="true" />
          <button className="cta mt-3">Send chit</button>
        </form>
      </section>
      <p className="mt-10 text-sm">
        <a href="/privacy">Privacy</a> · <a href={`/report?lane=${handle}`}>Report this lane</a>
      </p>
    </main>
  );
}
