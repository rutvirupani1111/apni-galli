// An empty Galla that teaches by doing: the counter is drawn bare, and each door below is one real thing to try.
// No hooks, so the demo page can render it on the server before a session exists.

type Door = { href: string; name: string; deva: string; verb: string; then: string; tone: string; arch: "carved" | "blue" | "tin" };

const DEMO_DOORS: Door[] = [
  { href: "/w/meethi-rasoi/menu", name: "Meethi Rasoi", deva: "मीठी रसोई", verb: "2 dabba kaju katli order karo", then: "Yahan order aayega. P dabao, visitor ki chit pe चुकता lagega.", tone: "var(--rani)", arch: "carved" },
  { href: "/w/taal-studio/counter", name: "Taal Studio", deva: "ताल स्टूडियो", verb: "Brass token hook pe rakho", then: "Booking yahan pending aayegi. B dabao, ticket Pakka ho jayega.", tone: "var(--enamel-blue)", arch: "blue" },
  { href: "/w/rangrez-mehendi/counter", name: "Rangrez Mehendi", deva: "रंगरेज़ मेहंदी", verb: "Shaadi ki chit bhejo", then: "Chit yahan aayegi. R dabao, jawab likho, visitor ke page pe dikhega.", tone: "var(--sindoor)", arch: "tin" },
];

function DoorArt({ tone, arch }: { tone: string; arch: Door["arch"] }) {
  return (
    <svg viewBox="0 0 120 120" className="h-full w-full" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <rect x="0" y="0" width="120" height="120" fill="color-mix(in srgb, var(--marigold) 22%, var(--chalk))" />
      <rect x="14" y="26" width="92" height="94" stroke="#1e1b18" strokeWidth="2" style={{ fill: `color-mix(in srgb, ${tone} 18%, #f5e6c8)` }} />
      {arch === "carved" && <path d="M38 120 V66 Q60 34 82 66 V120 Z" fill="#7a3b1e" stroke="#1e1b18" strokeWidth="2" />}
      {arch === "blue" && <rect x="40" y="58" width="40" height="62" rx="2" fill="#1f5fad" stroke="#1e1b18" strokeWidth="2" />}
      {arch === "tin" && (
        <g>
          <rect x="34" y="56" width="52" height="64" fill="#c9c2b4" stroke="#1e1b18" strokeWidth="2" />
          {[64, 72, 80, 88, 96, 104, 112].map((y) => (
            <line key={y} x1="35" x2="85" y1={y} y2={y} stroke="#1e1b18" strokeOpacity=".35" />
          ))}
        </g>
      )}
      <rect x="22" y="32" width="76" height="18" fill={tone} stroke="#1e1b18" strokeWidth="2" />
      <rect x="26" y="35" width="68" height="12" fill="none" stroke="#fff4e0" strokeWidth="1.5" />
      <path d="M14 26 q7 7 14 0 q7 7 14 0 q7 7 14 0 q7 7 14 0 q7 7 14 0 q7 7 14 0 q7 7 14 0" fill="none" stroke="#1e1b18" strokeWidth="2" />
    </svg>
  );
}

export function EmptyDesk({ demo, handle }: { demo?: boolean; handle?: string | null }) {
  const doors: Door[] = demo
    ? DEMO_DOORS
    : handle
      ? [{ href: `/w/${handle}`, name: "Apni galli", deva: "अपनी गली", verb: "Naye tab mein apni galli kholo, khud ek chit bhejo", then: "15 second mein yahan aayegi. Wahi chit visitor bhi bhejenge.", tone: "var(--lane-a)", arch: "carved" }]
      : [];
  return (
    <div className="desk-empty">
      <div className="grid items-end gap-6 md:grid-cols-[minmax(0,320px)_1fr]">
        <svg viewBox="0 0 320 170" className="w-full max-w-[320px]" role="img" aria-labelledby="desk-empty-t">
          <title id="desk-empty-t">Khaali galla: counter pe abhi koi chit nahi</title>
          {/* chit spike, empty */}
          <rect x="40" y="96" width="34" height="8" rx="2" fill="#7a3b1e" stroke="#1e1b18" strokeWidth="2" />
          <line x1="57" y1="96" x2="57" y2="38" stroke="#1e1b18" strokeWidth="3" strokeLinecap="round" />
          {/* bell */}
          <g className="desk-bell">
            <path d="M228 96 q0 -26 22 -26 q22 0 22 26 Z" fill="#c9962e" stroke="#1e1b18" strokeWidth="2" />
            <circle cx="250" cy="66" r="4" fill="#c9962e" stroke="#1e1b18" strokeWidth="2" />
            <rect x="222" y="96" width="56" height="7" rx="2" fill="#7a5414" stroke="#1e1b18" strokeWidth="2" />
          </g>
          {/* galla box, lid open */}
          <rect x="112" y="70" width="92" height="34" rx="3" fill="#7a3b1e" stroke="#1e1b18" strokeWidth="2" />
          <path d="M112 70 L124 48 H216 L204 70 Z" fill="#9a5230" stroke="#1e1b18" strokeWidth="2" />
          <text x="158" y="93" textAnchor="middle" style={{ fontFamily: "var(--font-sign)", fontSize: 15, fill: "#fff4e0" }}>
            गल्ला
          </text>
          {/* counter top */}
          <rect x="6" y="104" width="308" height="14" fill="#a8683e" stroke="#1e1b18" strokeWidth="2" />
          <rect x="18" y="118" width="284" height="48" fill="#7a3b1e" stroke="#1e1b18" strokeWidth="2" />
          {[40, 80, 120, 160, 200, 240, 280].map((x) => (
            <line key={x} x1={x} x2={x} y1="120" y2="164" stroke="#1e1b18" strokeOpacity=".25" />
          ))}
        </svg>
        <div>
          <p className="mono text-xs uppercase tracking-wider text-[var(--muted)]">Galla khaali hai</p>
          <p className="sign mt-1 text-3xl leading-tight">Abhi koi nahi aaya. Ek kaam karke dekho.</p>
          <p className="mt-2 max-w-prose">
            {demo
              ? "Neeche ek darwaza kholo, visitor ban ke kuch bhejo, phir is tab pe wapas aao. Galla har 15 second mein khud dekhta hai."
              : "Jo bhi visitor bhejega, chit, booking, order ya subscriber, sab isi ek desk pe aayega. Pehla khud bhej ke dekho."}
          </p>
        </div>
      </div>
      {doors.length > 0 && (
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {doors.map((d, i) => (
            <li key={d.href}>
              <a href={d.href} target={demo ? undefined : "_blank"} rel="noreferrer" className="door-card group">
                <span className="door-art">
                  <DoorArt tone={d.tone} arch={d.arch} />
                </span>
                <span className="flex min-w-0 flex-col gap-1 p-3">
                  <span className="mono text-[0.7rem] uppercase text-[var(--muted)]">Kadam {i + 1}</span>
                  <span className="sign text-xl leading-tight">
                    {d.name} <span className="text-base" lang="hi">{d.deva}</span>
                  </span>
                  <span className="font-semibold">{d.verb}</span>
                  <span className="text-sm text-[var(--muted)]">{d.then}</span>
                  <span className="mono mt-1 text-xs uppercase underline decoration-2 underline-offset-4 group-hover:decoration-[var(--rani)]">Darwaza kholo</span>
                </span>
              </a>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
