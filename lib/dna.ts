// Lane DNA. A lane is a seed + pins + content; dna() derives every composition choice from them.
// Each attribute draws from its own sub-stream, so pinning one never shifts the others.

export const SCENES = ["window", "counter", "menu", "postbox", "notice", "loft", "rooftop"] as const;
export type SceneSlug = (typeof SCENES)[number];
export type AnyScene = "gate" | SceneSlug;

export const VARIANT_COUNT: Record<AnyScene, number> = {
  gate: 3,
  window: 3,
  counter: 3,
  menu: 3,
  postbox: 3,
  notice: 3,
  loft: 2,
  rooftop: 3,
};

export const DNA_KEYS = [
  "palette",
  "awning",
  "garland",
  "signBorder",
  "signMotif",
  "signLettering",
  "mastheadStart",
  "propShuffle",
  ...(["gate", ...SCENES] as AnyScene[]).map((s) => `v_${s}` as const),
] as const;
export type DnaKey = (typeof DNA_KEYS)[number];
export type Pins = Partial<Record<DnaKey, number>>;

export type Dna = {
  palette: number; // 0..7 triad
  awning: 14 | 18 | 24;
  garland: number; // marigold heads across the toran
  sign: { border: number; motif: number; lettering: number };
  variants: Record<AnyScene, number>;
  masthead: Record<AnyScene, number>; // cover template 0..5, no two adjacent equal
  props: number; // prop slot shuffle seed
  raw: Record<DnaKey, number>;
};

export function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function pick(seed: number, key: string, n: number) {
  return Math.floor(mulberry32((seed ^ hash(key)) >>> 0)() * n);
}

const RANGE: Record<DnaKey, number> = {
  palette: 8,
  awning: 3,
  garland: 3,
  signBorder: 4,
  signMotif: 4,
  signLettering: 3,
  mastheadStart: 6,
  propShuffle: 1000,
  ...Object.fromEntries((["gate", ...SCENES] as AnyScene[]).map((s) => [`v_${s}`, VARIANT_COUNT[s]])),
} as Record<DnaKey, number>;

export function dna(seed: number, pins: Pins = {}, overrides: Pins = {}, order: AnyScene[] = ["gate", ...SCENES]): Dna {
  const raw = {} as Record<DnaKey, number>;
  for (const k of DNA_KEYS) {
    const pinned = overrides[k] ?? pins[k];
    raw[k] = pinned !== undefined && pinned >= 0 && pinned < RANGE[k] ? pinned : pick(seed, k, RANGE[k]);
  }
  const variants = {} as Record<AnyScene, number>;
  for (const s of ["gate", ...SCENES] as AnyScene[]) variants[s] = raw[`v_${s}` as DnaKey];
  // masthead templates walk the cover wall in order; neighbours always differ
  const masthead = {} as Record<AnyScene, number>;
  const r = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  let prev = -1;
  order.forEach((s, i) => {
    let t = i === 0 ? raw.mastheadStart : Math.floor(r() * 6);
    if (t === prev) t = (t + 1 + Math.floor(r() * 5)) % 6;
    masthead[s] = t;
    prev = t;
  });
  return {
    palette: raw.palette,
    awning: ([14, 18, 24] as const)[raw.awning],
    garland: [12, 16, 22][raw.garland],
    sign: { border: raw.signBorder, motif: raw.signMotif, lettering: raw.signLettering },
    variants,
    masthead,
    props: raw.propShuffle,
    raw,
  };
}

export const DNA_LABELS: Partial<Record<DnaKey, string>> = {
  palette: "Rang (palette)",
  awning: "Awning stripes",
  garland: "Toran",
  signBorder: "Sign border",
  signMotif: "Sign motif",
  signLettering: "Lettering",
  v_gate: "Gate facade",
};

export function newSeed() {
  return (Math.random() * 2 ** 31) | 0;
}
