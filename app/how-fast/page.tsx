import type { Metadata } from "next";

export const metadata: Metadata = { title: "How fast", description: "Real performance numbers for Apni Galli lanes, once they exist." };

// Numbers here are read from CI and field data only. Until those runs exist, the page says so.
export default function HowFast() {
  const rows = [
    ["LCP on the Gate (Moto G Power, Slow 4G)", "target 2.0 s, hard fail 2.5 s"],
    ["CLS", "target 0, hard fail 0.05"],
    ["INP", "target 150 ms"],
    ["Visitor first-load JS", "budget 90 KB gz"],
    ["Fonts on the Gate", "budget 90 KB"],
    ["Onboarding median (Pehla Kadam)", "target under 3 minutes, shown after 20 real sessions"],
  ];
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <a href="/" className="mono underline">
        Apni Galli
      </a>
      <h1 className="mast t-mast mt-4">How fast</h1>
      <p className="mt-3">Every number on this page will come from the last main-branch Lighthouse CI run and from field data. None of those runs exist yet, so nothing is claimed.</p>
      <table className="mt-6 w-full text-left">
        <thead className="mono text-xs uppercase">
          <tr>
            <th className="py-2">Measure</th>
            <th>Budget</th>
            <th>Measured</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([m, b]) => (
            <tr key={m} className="border-t border-dashed border-[var(--line)]">
              <td className="py-2 pr-2">{m}</td>
              <td className="pr-2 text-sm">{b}</td>
              <td className="mono text-sm text-[var(--muted)]">not measured yet</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
