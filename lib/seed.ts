// Three demo lanes. Every name here is made up. Each carries the "Demo galli" plate, and visitor
// actions on them land in the visitor's own demo Galla (scoped by a demo cookie). No email is sent.
import type { Q, SystemRunner } from "./db";
import type { LaneDoc } from "./doc";
import { randomBytes } from "node:crypto";

type Demo = {
  handle: string;
  trade: string;
  tz: string;
  seed: number;
  doc: LaneDoc;
  hours: [number, string, string][];
  services: { name: string; hi?: string; minutes: number; capacity: number; buffer_after: number; price_paise: number | null; auto_confirm: boolean; min_notice_min?: number }[];
  menu: { name: string; hi?: string; blurb: string; price_paise: number; daily_cap: number | null }[];
  notes: { label: string; url: string }[];
};

const DEMOS: Demo[] = [
  {
    handle: "meethi-rasoi",
    trade: "baker",
    tz: "Asia/Kolkata",
    seed: 20261101,
    hours: [2, 3, 4, 5, 6, 0].map((w) => [w, "09:00", "20:00"] as [number, string, string]),
    services: [],
    menu: [
      { name: "Kaju katli box", hi: "काजू कतली", blurb: "250 g, silver varq, made the morning you pick up", price_paise: 48000, daily_cap: 12 },
      { name: "Gulab jamun tin", hi: "गुलाब जामुन", blurb: "12 pieces in light saffron syrup", price_paise: 26000, daily_cap: 8 },
      { name: "Eggless chocolate cake", blurb: "500 g, dark ganache, no fondant", price_paise: 65000, daily_cap: 4 },
      { name: "Methi thepla pack", hi: "मेथी थेपला", blurb: "10 theplas with chunda on the side", price_paise: 14000, daily_cap: 20 },
      { name: "Mohanthal slab", hi: "मोहनथाल", blurb: "Besan, ghee, cardamom, cut in diamonds", price_paise: 42000, daily_cap: 6 },
    ],
    notes: [
      { label: "Diwali hamper list (PDF)", url: "https://example.com/meethi-rasoi/hampers" },
      { label: "Order on WhatsApp", url: "https://wa.me/910000000001" },
    ],
    doc: {
      name: "Meethi Rasoi",
      nameHi: "मीठी रसोई",
      tagline: "Home kitchen mithai from a Paldi kitchen, made to order, never kept overnight",
      city: "Ahmedabad",
      scenes: ["menu", "window", "postbox", "rooftop"],
      seed: 20261101,
      pins: { palette: 0, v_gate: 0, v_menu: 1, v_window: 0, v_postbox: 0, v_rooftop: 0, awning: 1, garland: 2, signBorder: 0, signMotif: 1, signLettering: 0 },
      counterMode: "enquiry",
      menuMode: "menu",
      chitFields: [
        { key: "name", label: "Aapka naam", type: "text", required: true },
        { key: "contact", label: "WhatsApp ya email", type: "text", required: true },
        { key: "date", label: "Kab chahiye", type: "date", required: true },
        { key: "count", label: "Kitne log", type: "count" },
        { key: "msg", label: "Kya banana hai", type: "long", required: true },
      ],
      contact: { whatsapp: "910000000001", email: "hello@example.com", address: "Paldi, Ahmedabad (pickup only, exact gali shared on WhatsApp)", mapQuery: "Paldi, Ahmedabad" },
      upi: { vpa: "meethirasoi.demo@okdemo", name: "Meethi Rasoi" },
      loft: {
        story: "Started with one tin of mohanthal for a neighbour's engagement. Now it is four burners, two ovens and a waiting list every Diwali. Everything is made the morning you pick it up.",
        steps: ["Ghee is clarified at home every Monday", "Orders close at 8 pm the night before", "Boxes are packed at 7 am and labelled with your name"],
        tools: ["Brass kadhai from Manek Chowk", "A very old oven called Bhola"],
      },
      window: {
        title: "Aaj ki rasoi",
        items: [
          { id: "w1", title: "Kaju katli, silver varq", blurb: "The box that sells out first", price_paise: 48000, stamp: null, motif: 0, tag: "Bestseller" },
          { id: "w2", title: "Gulab jamun tin", blurb: "Soft, not syrupy-sweet", price_paise: 26000, stamp: null, motif: 3 },
          { id: "w3", title: "Diwali hamper", blurb: "Six sweets, one brass diya", price_paise: 180000, stamp: "booked", motif: 5, tag: "Festive" },
          { id: "w4", title: "Thepla for the train", blurb: "Lasts three days without a fridge", price_paise: 14000, stamp: null, motif: 6 },
        ],
      },
      postbox: { pitch: "One postcard a week: what is on the stove, and which day the hampers open." },
      rooftop: { note: "Pickup from Paldi, 9 am to 8 pm. Delivery inside the city on orders above Rs 1,000." },
      counter: { pitch: "" },
      menu: { pitch: "Fresh every morning. Each box has a daily limit, so order a day ahead.", pickupNote: "Pickup from Paldi. Choose a day below." },
      notice: { pitch: "" },
      placeholders: [],
    },
  },
  {
    handle: "taal-studio",
    trade: "tutor",
    tz: "Asia/Kolkata",
    seed: 20261102,
    hours: [
      [1, "16:00", "20:30"],
      [2, "16:00", "20:30"],
      [3, "16:00", "20:30"],
      [4, "16:00", "20:30"],
      [5, "16:00", "20:30"],
      [6, "16:00", "20:30"],
      [0, "08:00", "11:00"],
    ],
    services: [
      { name: "Trial class", hi: "पहली क्लास", minutes: 45, capacity: 1, buffer_after: 15, price_paise: null, auto_confirm: true, min_notice_min: 60 },
      { name: "Group class (ages 8+)", hi: "बैच", minutes: 60, capacity: 6, buffer_after: 0, price_paise: 40000, auto_confirm: true, min_notice_min: 60 },
      { name: "Private riyaz", hi: "रियाज़", minutes: 60, capacity: 1, buffer_after: 15, price_paise: 120000, auto_confirm: false, min_notice_min: 180 },
    ],
    menu: [],
    notes: [
      { label: "Tatkar practice, 10 minutes a day", url: "https://example.com/taal-studio/tatkar" },
      { label: "Annual baithak, March", url: "https://example.com/taal-studio/baithak" },
      { label: "Ghungroo: where to buy, what to pay", url: "https://example.com/taal-studio/ghungroo" },
      { label: "Write to the studio", url: "mailto:hello@example.com" },
    ],
    doc: {
      name: "Taal Studio",
      nameHi: "ताल स्टूडियो",
      tagline: "Kathak in a Kothrud verandah. Trial classes for anyone who has ever tapped a foot to a tabla.",
      city: "Pune",
      scenes: ["counter", "loft", "notice", "rooftop"],
      seed: 20261102,
      pins: { palette: 3, v_gate: 2, v_counter: 1, v_loft: 1, v_notice: 0, v_rooftop: 1, awning: 2, garland: 0, signBorder: 2, signMotif: 3, signLettering: 1 },
      counterMode: "booking",
      menuMode: "catalogue",
      chitFields: [
        { key: "name", label: "Aapka naam", type: "text", required: true },
        { key: "contact", label: "WhatsApp ya email", type: "text", required: true },
        { key: "level", label: "Kis class mein", type: "chips", options: ["Beginner", "Thoda aata hai", "Advanced"] },
        { key: "msg", label: "Kya seekhna hai", type: "long" },
      ],
      contact: { whatsapp: "910000000002", phone: "+910000000002", address: "Kothrud, Pune, first floor verandah", mapQuery: "Kothrud, Pune" },
      upi: {},
      loft: {
        story: "Twelve years of Lucknow gharana training, eight students in a verandah, one tabla player on Sundays. The floor is wood because ghungroos deserve it.",
        steps: ["Tatkar until the feet stop thinking", "Hastak: the hands tell the story", "Thaat and amad, then the first tukda"],
        tools: ["Ghungroo, 100 bells each foot", "A tanpura app on an old phone", "Teen taal on the wall clock"],
      },
      window: { title: "", items: [] },
      postbox: { pitch: "" },
      rooftop: { note: "Kothrud, near the old water tank. Ring the bell twice, the verandah is upstairs." },
      counter: { pitch: "Pick a class, drop the brass token on a free hook. It holds for 10 minutes while you write your name." },
      menu: { pitch: "", pickupNote: "" },
      notice: { pitch: "Practice notes, baithak dates and where to buy ghungroos." },
      placeholders: [],
    },
  },
  {
    handle: "rangrez-mehendi",
    trade: "mehendi",
    tz: "Asia/Kolkata",
    seed: 20261103,
    hours: [0, 1, 2, 4, 5, 6].map((w) => [w, "11:00", "19:00"] as [number, string, string]),
    services: [{ name: "Design trial", hi: "डिज़ाइन ट्रायल", minutes: 30, capacity: 1, buffer_after: 15, price_paise: 30000, auto_confirm: false, min_notice_min: 240 }],
    menu: [],
    notes: [],
    doc: {
      name: "Rangrez Mehendi",
      nameHi: "रंगरेज़ मेहंदी",
      tagline: "Bridal and festive mehendi from Johari Bazaar. Organic cones, dark stain, no chemical black.",
      city: "Jaipur",
      scenes: ["window", "counter", "postbox", "rooftop"],
      seed: 20261103,
      pins: { palette: 5, v_gate: 1, v_window: 2, v_counter: 2, v_postbox: 2, v_rooftop: 2, awning: 0, garland: 1, signBorder: 3, signMotif: 0, signLettering: 2 },
      counterMode: "enquiry",
      menuMode: "catalogue",
      chitFields: [
        { key: "name", label: "Aapka naam", type: "text", required: true },
        { key: "contact", label: "WhatsApp ya email", type: "text", required: true },
        { key: "event_date", label: "Function ki date", type: "date", required: true },
        { key: "venue", label: "Venue ya area", type: "text", required: true },
        { key: "hands", label: "Kitne haath", type: "count" },
        { key: "style", label: "Style", type: "chips", options: ["Bridal", "Arabic", "Minimal", "Kids"] },
      ],
      contact: { whatsapp: "910000000003", address: "Johari Bazaar, Jaipur. Home visits across the city.", mapQuery: "Johari Bazaar, Jaipur" },
      upi: { vpa: "rangrez.demo@okdemo", name: "Rangrez Mehendi" },
      loft: { story: "", steps: [], tools: [] },
      window: {
        title: "Design plates",
        items: [
          { id: "w1", title: "Doli bridal", blurb: "Full arms, doli and baraat panels, 6 hours", price_paise: 1100000, stamp: null, motif: 0, tag: "Bridal" },
          { id: "w2", title: "Jharokha back hand", blurb: "Palace windows climbing to the wrist", price_paise: 250000, stamp: null, motif: 1 },
          { id: "w3", title: "Arabic vine", blurb: "Bold trail, quick to dry", price_paise: 80000, stamp: null, motif: 2 },
          { id: "w4", title: "Mandala palm", blurb: "One circle, eight rings", price_paise: 60000, stamp: null, motif: 3 },
          { id: "w5", title: "Teej peacock", blurb: "Two peacocks facing at the knuckles", price_paise: 150000, stamp: "booked", motif: 4, tag: "Festive" },
          { id: "w6", title: "Minimal finger caps", blurb: "For office the next day", price_paise: 30000, stamp: null, motif: 5 },
          { id: "w7", title: "Kids' little sun", blurb: "Ten minutes, no tears", price_paise: 15000, stamp: null, motif: 6 },
          { id: "w8", title: "Groom's initials", blurb: "Hidden in the bride's palm", price_paise: 50000, stamp: "sold", motif: 7 },
        ],
      },
      postbox: { pitch: "Wedding season dates open in batches. Get the postcard the day they open." },
      rooftop: { note: "Studio in Johari Bazaar, home visits anywhere in Jaipur. Travel outside the city on request." },
      counter: { pitch: "Send the date, the venue and how many hands. I reply with a quote, then a deposit over UPI holds the date." },
      menu: { pitch: "", pickupNote: "" },
      notice: { pitch: "" },
      placeholders: [],
    },
  },
];

export const DEMO_HANDLES = DEMOS.map((d) => d.handle);

async function insertDemo(q: Q, ownerId: string, d: Demo) {
  const l = await q.query<{ id: string }>(
    `insert into lanes (owner_id, handle, tz, trade, draft, seed, pins, is_demo, listed)
     values ($1,$2,$3,$4,$5,$6,$7,true,true) returning id`,
    [ownerId, d.handle, d.tz, d.trade, JSON.stringify(d.doc), d.seed, JSON.stringify(d.doc.pins)],
  );
  const laneId = l[0].id;
  const r = await q.query<{ id: string }>("insert into resources (lane_id, owner_id, name) values ($1,$2,'Main') returning id", [laneId, ownerId]);
  let i = 0;
  for (const s of d.services) {
    await q.query(
      `insert into services (lane_id, owner_id, resource_id, name, minutes, capacity, buffer_after, price_paise, auto_confirm, min_notice_min, sort)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [laneId, ownerId, r[0].id, JSON.stringify({ en: s.name, hi: s.hi }), s.minutes, s.capacity, s.buffer_after, s.price_paise, s.auto_confirm, s.min_notice_min ?? 120, i++],
    );
  }
  i = 0;
  for (const m of d.menu) {
    await q.query("insert into menu_items (lane_id, owner_id, name, blurb, price_paise, daily_cap, sort) values ($1,$2,$3,$4,$5,$6,$7)", [
      laneId,
      ownerId,
      JSON.stringify({ en: m.name, hi: m.hi }),
      m.blurb,
      m.price_paise,
      m.daily_cap,
      i++,
    ]);
  }
  for (const [w, o, c] of d.hours) {
    await q.query("insert into hours_rules (lane_id, owner_id, weekday, opens, closes) values ($1,$2,$3,$4,$5)", [laneId, ownerId, w, o, c]);
  }
  i = 0;
  for (const n of d.notes) {
    await q.query("insert into notes (lane_id, owner_id, label, url, sort) values ($1,$2,$3,$4,$5)", [laneId, ownerId, n.label, n.url, i++]);
  }
  const v = await q.query<{ id: string }>("insert into lane_versions (lane_id, owner_id, doc, diff_summary) values ($1,$2,$3,'First publish') returning id", [
    laneId,
    ownerId,
    JSON.stringify(d.doc),
  ]);
  await q.query("update lanes set published_version_id = $1 where id = $2", [v[0].id, laneId]);
}

export async function ensureDemos(run: SystemRunner) {
  await run(async (q) => {
    await q.query("select pg_advisory_xact_lock(515151)");
    const existing = await q.query<{ handle: string }>("select handle from lanes where is_demo");
    const have = new Set(existing.map((e) => e.handle));
    if (DEMOS.every((d) => have.has(d.handle))) return;
    let owner = await q.query<{ id: string }>("select id from owners where is_demo limit 1");
    if (!owner.length) {
      owner = await q.query<{ id: string }>(
        "insert into owners (email, password_hash, display_name, is_demo) values ('demo@apnigalli.invalid', $1, 'Demo galli', true) returning id",
        ["disabled$" + randomBytes(24).toString("hex")],
      );
    }
    for (const d of DEMOS) if (!have.has(d.handle)) await insertDemo(q, owner[0].id, d);
  });
}
