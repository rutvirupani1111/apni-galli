// generateSlots: free slots for one local day, in the owner's zone, returned as UTC ISO.
import { addDays, localDate, zonedToUtc } from "./time";
import { intervalsFor, type Hours } from "./status";

export type ServiceRule = {
  minutes: number;
  capacity: number;
  buffer_before: number;
  buffer_after: number;
  min_notice_min: number;
  max_days_ahead: number;
};
export type Taken = { start: number; end: number; seat: number }; // blocked range, epoch ms, [start, end)
export type Slot = { start: string; end: string; seatsLeft: number };

export function stepFor(minutes: number) {
  return minutes <= 90 ? 30 : 60;
}

export function generateSlots(h: Hours, svc: ServiceRule, date: string, now: Date, taken: Taken[]): Slot[] {
  const today = localDate(now, h.tz);
  if (date < today || date > addDays(today, svc.max_days_ahead)) return [];
  const earliest = now.getTime() + svc.min_notice_min * 60000;
  const step = stepFor(svc.minutes);
  const out: Slot[] = [];
  const seen = new Set<string>();
  for (const [a, b] of intervalsFor(date, h)) {
    const endCap = Math.min(b, 1440); // a slot never crosses midnight of this date
    for (let s = a; s + svc.minutes <= endCap; s += step) {
      const start = zonedToUtc(date, s, h.tz);
      const end = new Date(start.getTime() + svc.minutes * 60000);
      if (start.getTime() < earliest) continue;
      const bs = start.getTime() - svc.buffer_before * 60000;
      const be = end.getTime() + svc.buffer_after * 60000;
      const seats = new Set<number>();
      for (const t of taken) if (t.start < be && bs < t.end) seats.add(t.seat);
      const seatsLeft = svc.capacity - seats.size;
      if (seatsLeft <= 0) continue;
      const iso = start.toISOString();
      if (seen.has(iso)) continue;
      seen.add(iso);
      out.push({ start: iso, end: end.toISOString(), seatsLeft });
    }
  }
  return out.sort((x, y) => x.start.localeCompare(y.start));
}

/** The blocked range for a booking: the slot widened by the service buffers. */
export function blockedRange(startMs: number, svc: Pick<ServiceRule, "minutes" | "buffer_before" | "buffer_after">) {
  const s = startMs - svc.buffer_before * 60000;
  const e = startMs + (svc.minutes + svc.buffer_after) * 60000;
  return { s: new Date(s), e: new Date(e) };
}
