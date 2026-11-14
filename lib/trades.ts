// What a new owner gets from "Aap kya karte ho?". Starter text is a placeholder (dashed outline in the editor)
// and the lane cannot publish while any placeholder is left.
import type { ChitField, LaneDoc } from "./doc";
import type { SceneSlug } from "./dna";

export type TradeKey = "baker" | "tutor" | "mehendi" | "photo" | "designer" | "boutique" | "writer" | "other";

export type StarterService = { name: string; minutes: number; capacity: number; buffer_after: number; price_paise: number | null; auto_confirm: boolean };
export type StarterItem = { name: string; blurb: string; price_paise: number; daily_cap: number | null };

export type Trade = {
  key: TradeKey;
  label: string;
  hi: string;
  scenes: SceneSlug[];
  counterMode: "booking" | "enquiry";
  menuMode: "menu" | "catalogue";
  chitFields: ChitField[];
  services: StarterService[];
  items: StarterItem[];
  window: { title: string; items: { title: string; blurb: string; price_paise?: number }[] };
  hours: "day" | "evening" | "appointment";
};

const CONTACT: ChitField[] = [
  { key: "name", label: "Aapka naam", type: "text", required: true },
  { key: "contact", label: "WhatsApp ya email", type: "text", required: true },
];

export const TRADES: Record<TradeKey, Trade> = {
  baker: {
    key: "baker",
    label: "Home baker or tiffin cook",
    hi: "घर की रसोई",
    scenes: ["menu", "window", "postbox", "rooftop"],
    counterMode: "enquiry",
    menuMode: "menu",
    chitFields: [...CONTACT, { key: "date", label: "Kab chahiye", type: "date", required: true }, { key: "count", label: "Kitne log", type: "count" }, { key: "msg", label: "Kya banana hai", type: "long", required: true }],
    services: [],
    items: [
      { name: "Signature box", blurb: "Your best seller, written your way", price_paise: 45000, daily_cap: 12 },
      { name: "Tiffin for one", blurb: "Dal, sabzi, 4 rotis, rice", price_paise: 12000, daily_cap: 20 },
    ],
    window: { title: "Aaj ki rasoi", items: [{ title: "Your first dish", blurb: "Tell people what makes it yours" }] },
    hours: "day",
  },
  tutor: {
    key: "tutor",
    label: "Tutor or teacher",
    hi: "गुरुजी",
    scenes: ["counter", "loft", "notice", "rooftop"],
    counterMode: "booking",
    menuMode: "catalogue",
    chitFields: [...CONTACT, { key: "level", label: "Kis class mein", type: "chips", options: ["Beginner", "Thoda aata hai", "Advanced"] }, { key: "msg", label: "Kya seekhna hai", type: "long" }],
    services: [
      { name: "Trial class", minutes: 45, capacity: 1, buffer_after: 15, price_paise: null, auto_confirm: true },
      { name: "Group batch", minutes: 60, capacity: 6, buffer_after: 0, price_paise: 50000, auto_confirm: false },
    ],
    items: [],
    window: { title: "Student work", items: [] },
    hours: "evening",
  },
  mehendi: {
    key: "mehendi",
    label: "Mehendi or makeup artist",
    hi: "मेहंदी",
    scenes: ["window", "counter", "postbox", "rooftop"],
    counterMode: "enquiry",
    menuMode: "catalogue",
    chitFields: [
      ...CONTACT,
      { key: "event_date", label: "Function ki date", type: "date", required: true },
      { key: "venue", label: "Venue ya area", type: "text", required: true },
      { key: "hands", label: "Kitne haath", type: "count" },
      { key: "style", label: "Style", type: "chips", options: ["Bridal", "Arabic", "Minimal", "Kids"] },
    ],
    services: [{ name: "Trial and design chat", minutes: 30, capacity: 1, buffer_after: 15, price_paise: null, auto_confirm: false }],
    items: [],
    window: { title: "Designs", items: [{ title: "Your first design", blurb: "Name it the way your clients do" }] },
    hours: "day",
  },
  photo: {
    key: "photo",
    label: "Photographer",
    hi: "फ़ोटोग्राफ़र",
    scenes: ["window", "counter", "rooftop"],
    counterMode: "enquiry",
    menuMode: "catalogue",
    chitFields: [...CONTACT, { key: "event_date", label: "Shoot ki date", type: "date", required: true }, { key: "kind", label: "Kaisa shoot", type: "chips", options: ["Wedding", "Portrait", "Product", "Event"] }, { key: "msg", label: "Aur kuch", type: "long" }],
    services: [{ name: "Call to plan the shoot", minutes: 20, capacity: 1, buffer_after: 10, price_paise: null, auto_confirm: true }],
    items: [],
    window: { title: "Recent frames", items: [{ title: "Your best shoot", blurb: "One line about it" }] },
    hours: "appointment",
  },
  designer: {
    key: "designer",
    label: "Designer or developer",
    hi: "डिज़ाइनर",
    scenes: ["window", "loft", "postbox", "rooftop"],
    counterMode: "enquiry",
    menuMode: "catalogue",
    chitFields: [...CONTACT, { key: "budget", label: "Budget", type: "chips", options: ["Under 25k", "25k to 1L", "1L+", "Not sure"] }, { key: "deadline", label: "Deadline", type: "date" }, { key: "msg", label: "Project ke baare mein", type: "long", required: true }],
    services: [],
    items: [],
    window: { title: "Selected work", items: [{ title: "Your best project", blurb: "What changed because of it" }] },
    hours: "day",
  },
  boutique: {
    key: "boutique",
    label: "Boutique or craft seller",
    hi: "बुटीक",
    scenes: ["window", "menu", "notice", "rooftop"],
    counterMode: "enquiry",
    menuMode: "catalogue",
    chitFields: [...CONTACT, { key: "piece", label: "Kaunsa piece", type: "text", required: true }, { key: "msg", label: "Size, colour, sawal", type: "long" }],
    services: [],
    items: [{ name: "Your first piece", blurb: "Fabric, size, story", price_paise: 120000, daily_cap: 1 }],
    window: { title: "Naya maal", items: [{ title: "Your first piece", blurb: "Fabric, size, story", price_paise: 120000 }] },
    hours: "day",
  },
  writer: {
    key: "writer",
    label: "Writer or musician",
    hi: "कलाकार",
    scenes: ["postbox", "notice", "window", "loft"],
    counterMode: "enquiry",
    menuMode: "catalogue",
    chitFields: [...CONTACT, { key: "msg", label: "Kya kehna hai", type: "long", required: true }],
    services: [],
    items: [],
    window: { title: "Latest work", items: [{ title: "Your latest piece", blurb: "Where people can find it" }] },
    hours: "appointment",
  },
  other: {
    key: "other",
    label: "Kuch aur",
    hi: "कुछ और",
    scenes: ["window", "counter", "notice", "rooftop"],
    counterMode: "enquiry",
    menuMode: "catalogue",
    chitFields: [...CONTACT, { key: "msg", label: "Kya chahiye", type: "long", required: true }],
    services: [],
    items: [],
    window: { title: "What I make", items: [{ title: "Your first thing", blurb: "One line about it" }] },
    hours: "day",
  },
};

export const HOURS_PRESETS: Record<"day" | "evening" | "appointment", { label: string; rules: { weekday: number; opens: string; closes: string }[] }> = {
  day: { label: "10 to 7, Sunday off", rules: [1, 2, 3, 4, 5, 6].map((w) => ({ weekday: w, opens: "10:00", closes: "19:00" })) },
  evening: { label: "Evenings 5 to 9", rules: [1, 2, 3, 4, 5, 6].map((w) => ({ weekday: w, opens: "17:00", closes: "21:00" })) },
  appointment: { label: "By appointment", rules: [] },
};

export function starterDoc(trade: Trade, o: { name: string; nameHi?: string; seed: number; whatsapp?: string; upi?: string; city?: string }): LaneDoc {
  const items = trade.window.items.map((it, i) => ({
    id: `w${i + 1}`,
    title: it.title,
    blurb: it.blurb,
    price_paise: it.price_paise ?? null,
    stamp: null,
    motif: i % 8,
  }));
  return {
    name: o.name,
    nameHi: o.nameHi || undefined,
    tagline: "One line about what you make and for whom",
    city: o.city ?? "",
    scenes: trade.scenes,
    seed: o.seed,
    pins: {},
    counterMode: trade.counterMode,
    menuMode: trade.menuMode,
    chitFields: trade.chitFields,
    contact: { whatsapp: o.whatsapp || undefined },
    upi: { vpa: o.upi || undefined, name: o.name },
    loft: { story: "How you started, in three or four lines", steps: ["First step of your process", "Second step", "Third step"], tools: ["A tool you love"] },
    window: { title: trade.window.title, items },
    postbox: { pitch: "What people get if they sign up, and how often" },
    rooftop: { note: "How to find you, or where you deliver" },
    counter: { pitch: trade.counterMode === "booking" ? "Pick a slot. The token on the hook is yours for 10 minutes." : "Tell me the date and the place, I will reply with a quote." },
    menu: { pitch: "Fresh every day, limited boxes", pickupNote: "Pickup from home, or ask for delivery" },
    notice: { pitch: "Everything else I am up to" },
    placeholders: ["tagline", "loft.story", "loft.steps", "postbox.pitch", "rooftop.note", ...items.map((i) => `window.items.${i.id}`)],
  };
}
