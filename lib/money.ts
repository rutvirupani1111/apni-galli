// UPI links, order totals and .ics files. The platform never touches money.

export const UPI_RE = /^[\w.\-]{2,}@[a-zA-Z]{2,}$/;

export function rupees(paise: number) {
  const r = paise / 100;
  return "₹" + (Number.isInteger(r) ? r.toLocaleString("en-IN") : r.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
}

export function upiLink(o: { vpa: string; name: string; paise: number; note: string }) {
  if (!UPI_RE.test(o.vpa)) throw new Error("bad vpa");
  // pa stays literal (UPI apps expect name@bank); the VPA regex above already rules out unsafe characters
  const enc = encodeURIComponent;
  return `upi://pay?pa=${o.vpa}&pn=${enc(o.name.slice(0, 40))}&am=${(o.paise / 100).toFixed(2)}&tn=${enc(o.note.slice(0, 40))}&cu=INR`;
}

export type Line = { item_id: string; name: string; qty: number; price_paise: number };
export function calcOrderTotal(lines: Line[]) {
  return lines.reduce((s, l) => s + l.qty * l.price_paise, 0);
}

/** Short human order code from a public token: AG-7F3K */
export function orderCode(token: string) {
  let h = 0;
  for (const c of token) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return "AG-" + h.toString(36).toUpperCase().slice(0, 4).padStart(4, "0");
}

function icsDate(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
function esc(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/[,;]/g, (m) => "\\" + m).replace(/\n/g, "\\n");
}
export function icsFile(o: { uid: string; start: Date; end: Date; title: string; where?: string; desc?: string; url?: string }) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Apni Galli//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${o.uid}@apnigalli`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(o.start)}`,
    `DTEND:${icsDate(o.end)}`,
    `SUMMARY:${esc(o.title)}`,
    o.where ? `LOCATION:${esc(o.where)}` : "",
    o.desc ? `DESCRIPTION:${esc(o.desc)}` : "",
    o.url ? `URL:${o.url}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}
