// The kit palette and the 8 pre-checked lane triads. Lane DNA picks one triad; it never mixes colours.

export const KIT = {
  chalk: "#FFF4E0",
  soot: "#1E1B18",
  sindoor: "#D7263D",
  marigold: "#F6A91B",
  rani: "#E5317A",
  peacock: "#0E7C7B",
  "enamel-blue": "#1F5FAD",
  "mint-enamel": "#9ED9C4",
  brick: "#7A3B1E",
  haldi: "#FFD23F",
  tin: "#C9C2B4",
} as const;
export type KitColor = keyof typeof KIT;

export const NIGHT = { chalk: "#17131C", soot: "#F7EBD6" };

export const TRIADS: [KitColor, KitColor, KitColor][] = [
  ["rani", "peacock", "marigold"],
  ["sindoor", "enamel-blue", "haldi"],
  ["peacock", "rani", "haldi"],
  ["enamel-blue", "marigold", "mint-enamel"],
  ["brick", "mint-enamel", "marigold"],
  ["sindoor", "peacock", "haldi"],
  ["rani", "enamel-blue", "mint-enamel"],
  ["peacock", "sindoor", "marigold"],
];

function lum(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
export function contrast(a: string, b: string) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** The text colour that reads best on a lane colour: day chalk or day soot. Enamel signs keep day colours at night. */
export function onColor(c: KitColor): string {
  const bg = KIT[c];
  return contrast(bg, KIT.chalk) >= contrast(bg, KIT.soot) ? KIT.chalk : KIT.soot;
}

export function triadVars(i: number): Record<string, string> {
  const [a, b, c] = TRIADS[((i % 8) + 8) % 8];
  return {
    "--lane-a": KIT[a],
    "--lane-b": KIT[b],
    "--lane-c": KIT[c],
    "--on-lane-a": onColor(a),
    "--on-lane-b": onColor(b),
    "--on-lane-c": onColor(c),
  };
}
