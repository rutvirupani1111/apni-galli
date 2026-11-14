// The lane document: everything the editor changes as text and composition.
// Relational things that need guarantees (hours, services, bookings, menu stock, notes and their clicks)
// live in their own tables.
import type { Pins, SceneSlug } from "./dna";

export type FieldType = "text" | "long" | "date" | "count" | "chips" | "phone" | "email";
export type ChitField = { key: string; label: string; type: FieldType; options?: string[]; required?: boolean };

export type WindowItem = {
  id: string;
  title: string;
  blurb: string;
  price_paise?: number | null;
  stamp?: "sold" | "booked" | null;
  motif: number; // code-drawn cover art, 0..7
  tag?: string;
};

export type LaneDoc = {
  name: string;
  nameHi?: string;
  tagline: string;
  city: string;
  scenes: SceneSlug[];
  seed: number;
  pins: Pins;
  counterMode: "booking" | "enquiry";
  menuMode: "menu" | "catalogue";
  chitFields: ChitField[];
  contact: { whatsapp?: string; phone?: string; email?: string; address?: string; mapQuery?: string; instagram?: string };
  upi: { vpa?: string; name?: string };
  loft: { story: string; steps: string[]; tools: string[] };
  window: { title: string; items: WindowItem[] };
  postbox: { pitch: string };
  rooftop: { note: string };
  counter: { pitch: string };
  menu: { pitch: string; pickupNote: string };
  notice: { pitch: string };
  placeholders: string[]; // doc paths still holding starter text; publish waits until empty
  showRemixes?: boolean;
};

export const DENY_LABEL = /(pass(word)?|otp|one.?time|card\s*(no|number)|cvv|cvc|aadhaa?r|\bpan\b|pin\s*code\s*of\s*card|atm\s*pin|upi\s*pin|bank\s*account)/i;

export function validateChitFields(fields: ChitField[]): string | null {
  if (fields.length > 10) return "Too many fields";
  const keys = new Set<string>();
  for (const f of fields) {
    if (DENY_LABEL.test(f.label)) return `"${f.label}" asks for something Apni Galli never collects`;
    if (!/^[a-z][a-z0-9_]{0,23}$/.test(f.key) || keys.has(f.key)) return "Bad field key";
    keys.add(f.key);
  }
  return null;
}

/** Plain-words diff between two docs, for the publish sheet. */
export function diffSummary(a: LaneDoc | null, b: LaneDoc): string {
  if (!a) return "First publish";
  const parts: string[] = [];
  const text = (x: LaneDoc) => ({
    Gate: [x.name, x.nameHi ?? "", x.tagline, x.city].join("|"),
    Loft: [x.loft.story, ...x.loft.steps, ...x.loft.tools].join("|"),
    Postbox: x.postbox.pitch,
    Rooftop: [x.rooftop.note, JSON.stringify(x.contact)].join("|"),
    Counter: x.counter.pitch,
    "Menu Board": [x.menu.pitch, x.menu.pickupNote].join("|"),
    Noticeboard: x.notice.pitch,
  });
  const ta = text(a);
  const tb = text(b);
  for (const k of Object.keys(tb) as (keyof typeof tb)[]) if (ta[k] !== tb[k]) parts.push(`text changed on ${k}`);
  const ia = new Map(a.window.items.map((i) => [i.id, i]));
  const added = b.window.items.filter((i) => !ia.has(i.id)).length;
  const removed = a.window.items.filter((i) => !b.window.items.some((j) => j.id === i.id)).length;
  const edited = b.window.items.filter((i) => ia.has(i.id) && JSON.stringify(ia.get(i.id)) !== JSON.stringify(i)).length;
  if (added) parts.push(`${added} new item${added > 1 ? "s" : ""}`);
  if (removed) parts.push(`${removed} item${removed > 1 ? "s" : ""} removed`);
  if (edited) parts.push(`${edited} item${edited > 1 ? "s" : ""} edited`);
  if (a.seed !== b.seed) parts.push("lane rerolled");
  if (JSON.stringify(a.pins) !== JSON.stringify(b.pins)) parts.push("pins changed");
  if (a.scenes.join() !== b.scenes.join()) parts.push("buildings changed");
  if (JSON.stringify(a.upi) !== JSON.stringify(b.upi)) parts.push("UPI changed");
  return parts.length ? parts.join(", ") : "No visible changes";
}

export const SCENE_META: Record<"gate" | SceneSlug, { name: string; hi: string; verb: string }> = {
  gate: { name: "Haveli Gate", hi: "दरवाज़ा", verb: "Andar aao" },
  window: { name: "Shopfront Window", hi: "खिड़की", verb: "Kaam dekho" },
  counter: { name: "Chai Counter", hi: "काउंटर", verb: "Slot pakka karo" },
  menu: { name: "Menu Board", hi: "मेन्यू", verb: "Order likho" },
  postbox: { name: "Postbox Corner", hi: "डाकपेटी", verb: "Chitthi mangao" },
  notice: { name: "Noticeboard", hi: "सूचना", verb: "Links dekho" },
  loft: { name: "Workshop Loft", hi: "कारखाना", verb: "Kahani padho" },
  rooftop: { name: "Rooftop", hi: "छत", verb: "Milne aao" },
};
