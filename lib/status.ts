// computeStatus: a pure function shared by the server render and the live island.
import { addDays, ampm, baje, hm, localDate, tzParts, weekdayOf, WEEKDAYS_HI } from "./time";

export type HoursRule = { weekday: number; opens: string; closes: string };
export type Closure = { from: string; to: string; note?: string | null }; // inclusive local dates
export type Hours = { tz: string; hours: HoursRule[]; closures: Closure[] };

export type Status = {
  open: boolean;
  until?: number; // minutes after local midnight (may exceed 1440 for overnight)
  nextOpen?: { date: string; min: number; dayOffset: number };
  reason: "open" | "later-today" | "closed-today" | "closed-days" | "holiday" | "no-hours";
  line: string; // the shutter text
  short: string; // cover-line text
};

function closedOn(date: string, closures: Closure[]) {
  return closures.find((c) => c.from <= date && date <= c.to);
}

/** Open intervals that touch `date`, in minutes from that date's midnight. */
export function intervalsFor(date: string, h: Hours): [number, number][] {
  const out: [number, number][] = [];
  if (!closedOn(date, h.closures)) {
    for (const r of h.hours) {
      if (r.weekday !== weekdayOf(date)) continue;
      const o = hm(r.opens);
      const c = hm(r.closes);
      if (c > o) out.push([o, c]);
      else if (c < o) out.push([o, 1440 + c]); // overnight, runs past midnight
    }
  }
  const prev = addDays(date, -1);
  if (!closedOn(prev, h.closures)) {
    for (const r of h.hours) {
      if (r.weekday !== weekdayOf(prev)) continue;
      const o = hm(r.opens);
      const c = hm(r.closes);
      if (c < o && c > 0) out.push([0, c]); // tail of yesterday's overnight hours
    }
  }
  return out.sort((a, b) => a[0] - b[0]);
}

export function computeStatus(h: Hours, now: Date): Status {
  if (!h.hours.length) {
    return { open: false, reason: "no-hours", line: "By appointment, leave a chit", short: "Milne ka time poocho" };
  }
  const p = tzParts(now, h.tz);
  const today = localDate(now, h.tz);
  const min = p.h * 60 + p.mi;
  const todays = intervalsFor(today, h);
  const cur = todays.find(([a, b]) => a <= min && min < b);
  if (cur) {
    let until = cur[1];
    // merge with an interval that starts exactly when this one ends (e.g. 18:00-24:00 then 00:00-02:00)
    if (until >= 1440) {
      const tomorrow = intervalsFor(addDays(today, 1), h).find(([a]) => a === 0);
      if (tomorrow && until === 1440) until = 1440 + tomorrow[1];
    }
    const left = until - min;
    const line = left <= 45 ? `Khula hai, bas ${left} minute aur` : `Khula hai, ${baje(until % 1440)} tak`;
    return { open: true, until, reason: "open", line, short: "Khula hai" };
  }
  const later = todays.find(([a]) => a > min);
  if (later) {
    return {
      open: false,
      reason: "later-today",
      nextOpen: { date: today, min: later[0], dayOffset: 0 },
      line: `Back at ${ampm(later[0])}, leave a chit`,
      short: `${ampm(later[0])} se khulega`,
    };
  }
  const holiday = closedOn(today, h.closures);
  for (let i = 1; i <= 14; i++) {
    const d = addDays(today, i);
    const iv = intervalsFor(d, h);
    const first = iv.find(([a]) => a > 0) ?? iv[0];
    if (first) {
      const when = i === 1 ? `kal ${baje(first[0])}` : `${WEEKDAYS_HI[weekdayOf(d)]} ${baje(first[0])}`;
      const reason = holiday ? "holiday" : i === 1 ? "closed-today" : "closed-days";
      const lead = holiday ? (holiday.note ? `${holiday.note}: band` : "Chhutti hai") : "Aaj band";
      return {
        open: false,
        reason,
        nextOpen: { date: d, min: first[0], dayOffset: i },
        line: `${lead}, ${when}`,
        short: i === 1 ? `Kal ${baje(first[0])}` : `${WEEKDAYS_HI[weekdayOf(d)]} ko`,
      };
    }
  }
  return { open: false, reason: "closed-days", line: "Abhi band hai, chit chhod do", short: "Band hai" };
}

/** "Mon to Sat 10 to 7" style summary for share images and Plain Lane. */
export function hoursSummary(h: HoursRule[]): string {
  if (!h.length) return "By appointment";
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const byKey = new Map<string, number[]>();
  for (const r of h) {
    const k = `${r.opens.slice(0, 5)}-${r.closes.slice(0, 5)}`;
    byKey.set(k, [...(byKey.get(k) ?? []), r.weekday]);
  }
  const short = (t: string) => {
    const m = hm(t);
    const hh = Math.floor(m / 60) % 12 || 12;
    return m % 60 ? `${hh}:${String(m % 60).padStart(2, "0")}` : String(hh);
  };
  return [...byKey.entries()]
    .map(([k, wds]) => {
      const s = [...new Set(wds)].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
      const [o, c] = k.split("-");
      const contiguous = s.every((d, i) => i === 0 || (s[i - 1] + 1) % 7 === d);
      const dayTxt = s.length > 2 && contiguous ? `${days[s[0]]} to ${days[s[s.length - 1]]}` : s.map((d) => days[d]).join(", ");
      return `${dayTxt} ${short(o)} to ${short(c)}`;
    })
    .join("; ");
}
