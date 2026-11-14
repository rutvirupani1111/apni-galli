// Timezone maths with Intl only. Times are stored in UTC and generated in the owner's IANA zone.

export type Parts = { y: number; m: number; d: number; h: number; mi: number; wd: number };

const fmts = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string) {
  let f = fmts.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
    });
    fmts.set(tz, f);
  }
  return f;
}
const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function tzParts(date: Date, tz: string): Parts {
  const p: Record<string, string> = {};
  for (const x of fmt(tz).formatToParts(date)) p[x.type] = x.value;
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, wd: WD[p.weekday] ?? 0 };
}

export function validTz(tz: string): boolean {
  try {
    fmt(tz).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/** Minutes east of UTC for this instant in tz. */
export function tzOffsetMin(date: Date, tz: string): number {
  const p = tzParts(date, tz);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi);
  const floored = Math.floor(date.getTime() / 60000) * 60000;
  return Math.round((asUtc - floored) / 60000);
}

/** Wall time in tz to a UTC instant. Gaps (spring forward) resolve forward; overlaps take the first. */
export function zonedToUtc(dateStr: string, minutes: number, tz: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60);
  const off1 = tzOffsetMin(new Date(guess), tz);
  let t = guess - off1 * 60000;
  const off2 = tzOffsetMin(new Date(t), tz);
  if (off2 !== off1) {
    const t2 = guess - off2 * 60000;
    // only accept the second guess if it round-trips; otherwise we are in a gap
    t = tzOffsetMin(new Date(t2), tz) === off2 ? t2 : Math.max(t, t2);
  }
  return new Date(t);
}

export const pad = (n: number) => String(n).padStart(2, "0");
export const dateStr = (p: { y: number; m: number; d: number }) => `${p.y}-${pad(p.m)}-${pad(p.d)}`;
export function localDate(date: Date, tz: string) {
  return dateStr(tzParts(date, tz));
}
export function addDays(ds: string, n: number): string {
  const [y, m, d] = ds.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
export function weekdayOf(ds: string): number {
  const [y, m, d] = ds.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
export function hm(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}
export function hmStr(min: number): string {
  return `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`;
}

/** "7 baje", "7:30 baje" for Hinglish signage. */
export function baje(min: number): string {
  const h24 = Math.floor(min / 60) % 24;
  const mm = min % 60;
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return mm ? `${h}:${pad(mm)} baje` : `${h} baje`;
}
/** "4 pm", "10:30 am". */
export function ampm(min: number): string {
  const h24 = Math.floor(min / 60) % 24;
  const mm = min % 60;
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}${mm ? ":" + pad(mm) : ""} ${h24 < 12 ? "am" : "pm"}`;
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const WEEKDAYS_HI = ["Itvaar", "Somvaar", "Mangalvaar", "Budhvaar", "Guruvaar", "Shukravaar", "Shanivaar"];

export function fmtInTz(iso: string | Date, tz: string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: tz, ...opts }).format(typeof iso === "string" ? new Date(iso) : iso);
}
