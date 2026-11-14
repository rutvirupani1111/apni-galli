import { z } from "zod";
import { SCENES } from "./dna";
import { DENY_LABEL } from "./doc";
import { UPI_RE } from "./money";

const t = (n: number) => z.string().max(n);
const Field = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{0,23}$/),
  label: z.string().min(1).max(60).refine((s) => !DENY_LABEL.test(s), "Apni Galli never asks for passwords, OTPs, card numbers, Aadhaar or PAN"),
  type: z.enum(["text", "long", "date", "count", "chips", "phone", "email"]),
  options: z.array(t(30)).max(8).optional(),
  required: z.boolean().optional(),
});

export const LaneDocSchema = z.object({
  name: z.string().trim().min(1).max(60),
  nameHi: t(60).optional(),
  tagline: t(200),
  city: t(60),
  scenes: z.array(z.enum(SCENES)).min(1).max(7).refine((a) => new Set(a).size === a.length, "Duplicate building"),
  seed: z.number().int(),
  pins: z.record(z.string(), z.number().int().min(0).max(999)),
  counterMode: z.enum(["booking", "enquiry"]),
  menuMode: z.enum(["menu", "catalogue"]),
  chitFields: z.array(Field).min(1).max(10),
  contact: z.object({ whatsapp: t(20).optional(), phone: t(20).optional(), email: t(160).optional(), address: t(200).optional(), mapQuery: t(120).optional(), instagram: t(80).optional() }),
  upi: z.object({ vpa: z.string().regex(UPI_RE).optional().or(z.literal("")), name: t(60).optional() }),
  loft: z.object({ story: t(1500), steps: z.array(t(160)).max(8), tools: z.array(t(60)).max(12) }),
  window: z.object({
    title: t(60),
    items: z
      .array(
        z.object({
          id: z.string().regex(/^[\w-]{1,24}$/),
          title: z.string().min(1).max(80),
          blurb: t(240),
          price_paise: z.number().int().min(0).max(100_000_000).nullable().optional(),
          stamp: z.enum(["sold", "booked"]).nullable().optional(),
          motif: z.number().int().min(0).max(7),
          tag: t(20).optional(),
        }),
      )
      .max(40),
  }),
  postbox: z.object({ pitch: t(300) }),
  rooftop: z.object({ note: t(300) }),
  counter: z.object({ pitch: t(300) }),
  menu: z.object({ pitch: t(300), pickupNote: t(160) }),
  notice: z.object({ pitch: t(300) }),
  placeholders: z.array(t(60)).max(60),
  showRemixes: z.boolean().optional(),
});
