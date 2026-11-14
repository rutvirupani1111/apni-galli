// Facades: every building is 3 to 5 layered planes (sky, building, sign and awning, props, garland).
// Pure SVG, server-rendered. The client only tilts the planes.
import type { ReactNode } from "react";
import type { AnyScene, Dna } from "@/lib/dna";
import {
  Awning,
  BrassToken,
  ChaiGlass,
  Charpai,
  Clothesline,
  Cycle,
  Grain,
  Kettle,
  Kite,
  Lantern,
  Matka,
  PillarBox,
  Rangoli,
  Scale,
  Scissors,
  ShutterBody,
  Signboard,
  SteelJar,
  Stool,
  StringLights,
  Terrazzo,
  Toran,
  Tulsi,
  V,
  WaterTank,
  Wood,
  mix,
} from "./kit";

export const VB = { w: 360, h: 520 };
type Planes = [ReactNode, ReactNode, ReactNode, ReactNode, ReactNode];
type Ctx = { dna: Dna; name: string; hi?: string; seed: number; open?: boolean };

function Sky({ seed, variant = 0 }: { seed: number; variant?: number }) {
  return (
    <g>
      <rect width="360" height="520" fill="url(#k-sky)" />
      {variant === 0 && <circle cx={70 + (seed % 200)} cy="70" r="26" style={{ fill: V("haldi") }} opacity="0.85" />}
      {variant === 1 && (
        <g>
          <circle cx="292" cy="64" r="18" fill="#f7ebd6" opacity="0.9" />
          <circle cx="300" cy="58" r="16" style={{ fill: V("sky-1") }} />
        </g>
      )}
      {/* distant rooftops */}
      <path
        d="M0 150 h40 v-30 h30 v18 h26 v-40 l14 -14 l14 14 v40 h30 v-22 h40 v30 h22 v-50 h12 v-10 h10 v10 h12 v50 h28 v-26 h36 v20 h46 v220 H0Z"
        style={{ fill: mix(V("lane-b"), 30, V("sky-2")) }}
        opacity="0.55"
      />
    </g>
  );
}

function Signage(c: Ctx, x: number, y: number, w: number, h: number) {
  return <Signboard x={x} y={y} w={w} h={h} name={c.name} hi={c.hi} kit={c.dna.sign} seed={c.seed} />;
}

/* ---------------- Haveli Gate: carved arch / tin shopfront / blue-door chowk ---------------- */

function gateArch(c: Ctx): Planes {
  const arch = "M118 500 V300 q0 -22 14 -34 q-6 -16 8 -28 q8 -22 40 -30 q32 8 40 30 q14 12 8 28 q14 12 14 34 V500Z";
  return [
    <Sky key="0" seed={c.seed} />,
    <g key="1">
      <rect x="18" y="120" width="324" height="400" style={{ fill: V("plaster") }} />
      <rect x="18" y="120" width="324" height="18" style={{ fill: mix(V("lane-c"), 70, V("brick")) }} />
      {Array.from({ length: 18 }, (_, i) => (
        <path key={i} d={`M${18 + i * 18} 138 a9 9 0 0 0 18 0`} style={{ fill: mix(V("lane-c"), 70, V("brick")) }} />
      ))}
      {/* jharokhas */}
      {[38, 252].map((x) => (
        <g key={x}>
          <path d={`M${x} 196 h70 v52 h-70z`} style={{ fill: mix(V("lane-c"), 55, V("plaster")) }} stroke="#5a3a1a" />
          <path d={`M${x - 6} 196 h82 l-10 -14 h-62z`} style={{ fill: V("brick") }} />
          <path d={`M${x + 6} 182 q29 -38 58 0z`} style={{ fill: mix(V("lane-c"), 80, V("brick")) }} stroke="#5a3a1a" />
          {[0, 1, 2].map((k) => (
            <path key={k} d={`M${x + 8 + k * 20} 244 v-26 q7 -10 14 0 v26z`} style={{ fill: V("lane-b") }} stroke="#1e1b18" strokeWidth="0.8" />
          ))}
          <path d={`M${x - 2} 248 h74 l-6 10 h-62z`} style={{ fill: V("brick") }} />
        </g>
      ))}
      {/* doorway: the open arch with the warm room inside */}
      <path d={arch} fill="url(#k-glow)" />
      <path d={arch} fill="none" style={{ stroke: mix(V("lane-c"), 60, V("brick")) }} strokeWidth="9" />
      <path d={arch} fill="none" stroke="#fff4e0" strokeWidth="1.5" strokeDasharray="2 5" opacity="0.8" />
      <rect x="96" y="290" width="14" height="210" style={{ fill: mix(V("lane-c"), 50, V("plaster")) }} stroke="#5a3a1a" strokeWidth="0.8" />
      <rect x="250" y="290" width="14" height="210" style={{ fill: mix(V("lane-c"), 50, V("plaster")) }} stroke="#5a3a1a" strokeWidth="0.8" />
      <path d="M60 500 h240 v8 h-240z M48 508 h264 v12 h-264z" style={{ fill: mix(V("tin"), 70, V("brick")) }} />
    </g>,
    <g key="2">{Signage(c, 64, 150, 232, 52)}</g>,
    <g key="3">
      <Tulsi x={46} y={438} s={1.05} />
      <Cycle x={226} y={448} s={0.95} title="A cycle parked by the gate" />
      <ChaiGlass x={130} y={490} s={0.8} />
      <Lantern x={170} y={214} s={1} lit={c.open !== false} />
    </g>,
    <g key="4">
      <Toran x={96} y={246} w={168} sag={20} count={c.dna.garland - 4} seed={c.seed} />
      <Grain />
    </g>,
  ];
}

function gateTin(c: Ctx): Planes {
  return [
    <g key="0">
      <Sky seed={c.seed} variant={0} />
      <path d="M0 100 Q180 130 360 92" fill="none" stroke="#2a2420" strokeWidth="1" />
      <path d="M0 112 Q180 146 360 106" fill="none" stroke="#2a2420" strokeWidth="1" />
      <WaterTank x={270} y={52} s={0.8} />
    </g>,
    <g key="1">
      <rect x="14" y="128" width="332" height="392" fill="url(#k-tinwall)" />
      <rect x="8" y="122" width="344" height="10" fill="#2a2420" />
      {/* shop opening, shutter rolled up into its box */}
      <rect x="40" y="252" width="280" height="248" fill="url(#k-glow)" />
      <rect x="40" y="252" width="280" height="22" style={{ fill: mix(V("tin"), 40, "#1e1b18") }} />
      <rect x="40" y="274" width="280" height="8" fill="url(#k-ribs)" />
      {[312, 360, 408].map((y) => (
        <rect key={y} x="56" y={y} width="248" height="5" style={{ fill: V("brick") }} />
      ))}
      <rect x="34" y="252" width="6" height="248" fill="#2a2420" />
      <rect x="320" y="252" width="6" height="248" fill="#2a2420" />
      <rect x="40" y="440" width="280" height="60" style={{ fill: mix(V("lane-a"), 70, "#1e1b18") }} />
      <rect x="40" y="440" width="280" height="6" fill="#1e1b18" opacity="0.3" />
      <path d="M0 500 h360 v20 H0z" fill="#8d877b" />
    </g>,
    <g key="2">
      {Signage(c, 28, 146, 304, 62)}
      <Awning x={28} y={214} w={304} h={30} />
    </g>,
    <g key="3">
      {[70, 102, 134, 210, 242].map((x, i) => (
        <SteelJar key={x} x={x} y={i < 3 ? 272 : 320} s={0.85} fill={["haldi", "lane-c", "mint-enamel", "rani", "marigold"][i]} />
      ))}
      <Scale x={250} y={398} s={0.9} />
      <Stool x={20} y={470} s={1} />
      <Kettle x={22} y={440} s={0.9} />
      <Scissors x={290} y={312} s={1} />
    </g>,
    <g key="4">
      <StringLights x={28} y={250} w={304} sag={14} n={16} on={c.open !== false} />
      <Grain />
    </g>,
  ];
}

function gateBlue(c: Ctx): Planes {
  return [
    <g key="0">
      <Sky seed={c.seed} variant={1} />
      <g style={{ fill: mix(V("peacock"), 55, "#14301f") }}>
        <circle cx="20" cy="110" r="60" />
        <circle cx="80" cy="80" r="44" />
        <circle cx="30" cy="40" r="40" />
      </g>
    </g>,
    <g key="1">
      <rect x="10" y="140" width="340" height="380" style={{ fill: mix(V("enamel-blue"), 62, "#e8f0ff") }} />
      <rect x="10" y="140" width="340" height="12" fill="#fff4e0" opacity="0.85" />
      {[30, 284].map((x) => (
        <g key={x}>
          <rect x={x} y="190" width="46" height="70" fill="#1e3550" stroke="#fff4e0" strokeWidth="5" />
          <path d={`M${x} 225 h46 M${x + 23} 190 v70`} stroke="#fff4e0" strokeWidth="2" />
          <rect x={x - 6} y="186" width="12" height="78" style={{ fill: V("enamel-blue") }} transform={`skewY(-8)`} opacity="0" />
        </g>
      ))}
      {/* door frame and open leaves */}
      <Wood x={100} y={238} w={160} h={262} fill={mix(V("brick"), 85, "#000")} />
      <rect x="114" y="252" width="132" height="248" fill="url(#k-glow)" />
      <Terrazzo x={114} y={440} w={132} h={60} seed={c.seed} />
      <path d="M114 252 l-22 14 v222 l22 12z" style={{ fill: mix(V("lane-b"), 70, "#1e1b18") }} />
      <path d="M246 252 l22 14 v222 l-22 12z" style={{ fill: mix(V("lane-b"), 70, "#1e1b18") }} />
      {[300, 340, 380, 420, 460].map((y) => (
        <g key={y}>
          <circle cx="102" cy={y} r="2.4" fill="#c9962e" />
          <circle cx="258" cy={y} r="2.4" fill="#c9962e" />
        </g>
      ))}
      <path d="M92 230 h176 v12 h-176z" style={{ fill: V("brick") }} />
      <path d="M0 500 h360 v20 H0z" fill="#d8ccb6" />
      <path d="M80 500 h200 v-6 h-200z" fill="#bfb29a" />
    </g>,
    <g key="2">
      <path d="M118 150 v20 M242 150 v20" stroke="#2a2420" strokeWidth="1.4" strokeDasharray="3 2" />
      {Signage(c, 84, 168, 192, 52)}
    </g>,
    <g key="3">
      <Rangoli cx={180} cy={508} r={34} seed={c.seed} />
      <Tulsi x={30} y={440} s={1} />
      <Matka x={300} y={444} s={1.1} />
      <Cycle x={-30} y={452} s={0.82} />
      <Kite x={318} y={110} s={1} fill="lane-a" />
    </g>,
    <g key="4">
      <Toran x={100} y={236} w={160} sag={16} count={c.dna.garland - 2} seed={c.seed + 1} />
      <Grain />
    </g>,
  ];
}

/* ---------------- the other buildings: each is a compact facade with its own centrepiece ---------------- */

function wall(variant: number) {
  if (variant === 1) return <rect x="0" y="110" width="360" height="410" fill="url(#k-brick)" />;
  if (variant === 2) return <rect x="0" y="110" width="360" height="410" fill="url(#k-tinwall)" />;
  return <rect x="0" y="110" width="360" height="410" style={{ fill: V("plaster") }} />;
}

function windowArt(c: Ctx, v: number): Planes {
  const glass = v === 0;
  return [
    <Sky key="0" seed={c.seed} variant={v === 2 ? 1 : 0} />,
    <g key="1">
      {wall(v)}
      {v === 2 ? (
        <Charpai x={60} y={410} s={2} />
      ) : (
        <g>
          <Wood x={36} y={200} w={288} h={260} fill={mix(V("brick"), 80, "#000")} />
          <rect x="48" y="212" width="264" height="236" style={{ fill: glass ? mix(V("mint-enamel"), 35, V("chalk")) : mix(V("lane-c"), 30, V("plaster")) }} />
          {glass && <path d="M60 220 l60 0 l-40 220 l-40 0z M200 220 l24 0 l-40 220 l-24 0z" fill="#fff" opacity="0.28" />}
          {!glass && [262, 330, 398].map((y) => <rect key={y} x="48" y={y} width="264" height="6" style={{ fill: V("brick") }} />)}
        </g>
      )}
      {[64, 128, 196, 252].map((x, i) => (
        <rect key={x} x={x} y={v === 2 ? 382 - (i % 2) * 14 : 236 + (i % 2) * 18} width="46" height={60 + (i % 3) * 8} rx="2" style={{ fill: V(["lane-a", "lane-b", "lane-c", "haldi"][i]) }} stroke="#1e1b18" strokeWidth="1" />
      ))}
    </g>,
    <g key="2">
      {Signage(c, 60, 130, 240, 48)}
      {v !== 2 && <Awning x={30} y={180} w={300} h={22} />}
    </g>,
    <g key="3">
      <Tulsi x={14} y={452} s={0.9} />
      <Lantern x={300} y={196} />
    </g>,
    <g key="4">
      <Grain />
    </g>,
  ];
}

function counterArt(c: Ctx, v: number): Planes {
  return [
    <Sky key="0" seed={c.seed} variant={v === 1 ? 1 : 0} />,
    <g key="1">
      {wall(v === 1 ? 0 : v)}
      {v === 1 && <rect x="0" y="110" width="360" height="40" style={{ fill: V("lane-b") }} opacity="0.6" />}
      <rect x="0" y="380" width="360" height="140" style={{ fill: mix(V("brick"), 70, "#3b2a12") }} />
      <Wood x={20} y={360} w={320} h={26} fill={mix(V("lane-c"), 40, V("brick"))} rx={3} />
      {/* the rail of hooks */}
      <rect x="40" y="300" width="280" height="10" rx="4" style={{ fill: V("brick") }} />
      {Array.from({ length: 8 }, (_, i) => (
        <g key={i}>
          <path d={`M${58 + i * 34} 310 v10 q0 6 6 6`} fill="none" stroke="#6f675a" strokeWidth="2" />
          {i % 3 === 1 && <BrassToken x={64 + i * 34} y={334} r={8} />}
        </g>
      ))}
      {v === 2 && (
        <g>
          <rect x="140" y="200" width="80" height="90" rx="40" style={{ fill: V("lane-a") }} stroke="#1e1b18" />
          <rect x="150" y="280" width="60" height="70" style={{ fill: V("lane-a") }} stroke="#1e1b18" />
        </g>
      )}
    </g>,
    <g key="2">
      {Signage(c, 50, 130, 260, 50)}
      {v === 0 && <Awning x={20} y={182} w={320} h={26} />}
    </g>,
    <g key="3">
      {v === 0 && (
        <>
          <Kettle x={60} y={330} s={1} />
          <ChaiGlass x={110} y={344} s={0.9} />
          <ChaiGlass x={128} y={344} s={0.9} />
        </>
      )}
      {v === 1 && (
        <g>
          <rect x="230" y="320" width="60" height="40" fill="#fff4e0" stroke="#1e1b18" />
          <path d="M238 332 h44 M238 342 h30" stroke="#1e1b18" />
          <Lantern x={60} y={200} />
        </g>
      )}
      {v === 2 && <Scissors x={250} y={340} s={1.6} />}
      <SteelJar x={290} y={322} s={0.9} />
    </g>,
    <g key="4">
      <StringLights x={20} y={210} w={320} n={12} on={c.open !== false} />
      <Grain />
    </g>,
  ];
}

function menuArt(c: Ctx, v: number): Planes {
  return [
    <Sky key="0" seed={c.seed} />,
    <g key="1">
      {wall(v === 0 ? 1 : 0)}
      {v === 1 ? (
        <g>
          <rect x="40" y="330" width="280" height="150" rx="6" style={{ fill: mix(V("mint-enamel"), 40, V("chalk")) }} stroke="#1e1b18" strokeWidth="2" />
          <path d="M40 400 h280" stroke="#1e1b18" />
          {[60, 120, 180, 240].map((x, i) => (
            <circle key={x} cx={x + 20} cy={380 - (i % 2) * 4} r="16" style={{ fill: V(["haldi", "lane-c", "marigold", "rani"][i]) }} stroke="#1e1b18" />
          ))}
        </g>
      ) : v === 2 ? (
        <g>
          <path d="M40 220 h280" stroke="#2a2420" strokeWidth="4" />
          {[60, 120, 180, 240].map((x, i) => (
            <g key={x}>
              <path d={`M${x + 20} 222 v8`} stroke="#2a2420" />
              <path d={`M${x} 236 l20 -6 l20 6 v80 h-40z`} style={{ fill: V(["lane-a", "lane-b", "lane-c", "haldi"][i]) }} stroke="#1e1b18" />
            </g>
          ))}
        </g>
      ) : (
        <g>
          <Wood x={70} y={180} w={220} h={290} fill={mix(V("brick"), 80, "#000")} />
          <rect x="82" y="192" width="196" height="266" fill="url(#k-chalkboard)" />
          {[230, 270, 310, 350, 390].map((y, i) => (
            <path key={y} d={`M98 ${y} h${90 + (i % 2) * 40} M${240} ${y} h22`} stroke="#fff4e0" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
          ))}
        </g>
      )}
    </g>,
    <g key="2">{Signage(c, 50, 124, 260, 48)}</g>,
    <g key="3">
      <Stool x={24} y={480} s={1} />
      <SteelJar x={300} y={460} s={1} fill="marigold" />
    </g>,
    <g key="4">
      <Toran x={40} y={172} w={280} sag={14} count={c.dna.garland} seed={c.seed + 4} />
      <Grain />
    </g>,
  ];
}

function postboxArt(c: Ctx, v: number): Planes {
  const color = v === 2 ? "enamel-blue" : "sindoor";
  return [
    <Sky key="0" seed={c.seed} variant={v === 1 ? 1 : 0} />,
    <g key="1">
      <rect x="100" y="60" width="160" height="460" style={{ fill: v === 1 ? undefined : V("plaster") }} fill={v === 1 ? "url(#k-brick)" : undefined} />
      <rect x="100" y="60" width="160" height="10" fill="#1e1b18" opacity="0.4" />
      <path d="M0 500 h360 v20 H0z" fill="#bdb09a" />
    </g>,
    <g key="2">
      <g transform="translate(116 90) rotate(90)">
        <Signboard x={0} y={0} w={200} h={40} name={c.name} kit={c.dna.sign} seed={c.seed} />
      </g>
    </g>,
    <g key="3">
      {v === 1 ? (
        <g transform="translate(150 280)">
          <rect x="0" y="0" width="60" height="80" rx="4" style={{ fill: V(color) }} stroke="#1e1b18" />
          <rect x="12" y="20" width="36" height="6" rx="3" fill="#1e1b18" />
        </g>
      ) : (
        <PillarBox x={152} y={360} s={1.1} color={color} title="The lane's postbox" />
      )}
      <Kite x={300} y={90} s={0.9} fill="lane-c" />
    </g>,
    <g key="4">
      <Grain />
    </g>,
  ];
}

function noticeArt(c: Ctx, v: number): Planes {
  const fill = v === 0 ? "url(#k-cork)" : v === 1 ? "url(#k-brick)" : "url(#k-tinsheet)";
  return [
    <Sky key="0" seed={c.seed} />,
    <g key="1">
      <rect x="0" y="110" width="360" height="410" style={{ fill: V("plaster") }} />
      <rect x="30" y="170" width="300" height="300" fill={fill} stroke="#5a3a1a" strokeWidth="8" />
      {Array.from({ length: 7 }, (_, i) => {
        const x = 46 + (i % 3) * 92 + ((c.seed >> i) % 12);
        const y = 190 + Math.floor(i / 3) * 90;
        return (
          <g key={i} transform={`rotate(${((c.seed >> (i * 2)) % 9) - 4} ${x + 35} ${y + 35})`}>
            <rect x={x} y={y} width="70" height="62" style={{ fill: V(["paper", "haldi", "mint-enamel", "chalk"][i % 4]) }} stroke="#1e1b18" strokeWidth="0.7" />
            <circle cx={x + 35} cy={y + 6} r="4" style={{ fill: V(["sindoor", "lane-b", "lane-a"][i % 3]) }} />
            <path d={`M${x + 10} ${y + 24} h46 M${x + 10} ${y + 34} h36 M${x + 10} ${y + 44} h42`} stroke="#1e1b18" strokeWidth="1.4" opacity="0.6" />
          </g>
        );
      })}
    </g>,
    <g key="2">{Signage(c, 70, 118, 220, 44)}</g>,
    <g key="3">
      <Cycle x={232} y={456} s={0.8} />
    </g>,
    <g key="4">
      <Grain />
    </g>,
  ];
}

function loftArt(c: Ctx, v: number): Planes {
  return [
    <Sky key="0" seed={c.seed} variant={1} />,
    <g key="1">
      <path d="M30 150 L180 60 L330 150 V500 H30Z" style={{ fill: v === 0 ? V("plaster") : mix(V("lane-b"), 30, V("plaster")) }} stroke="#3b2a12" strokeWidth="3" />
      {[250, 360].map((y) => (
        <Wood key={y} x={30} y={y} w={300} h={12} fill={V("brick")} />
      ))}
      <path d="M90 150 h180" stroke="#3b2a12" strokeWidth="3" />
      {/* three floors, each a story block */}
      <circle cx="180" cy="118" r="18" fill="url(#k-glow)" stroke="#3b2a12" strokeWidth="2" />
      <rect x="60" y="180" width="60" height="50" fill="url(#k-glow)" stroke="#3b2a12" />
      <rect x="240" y="180" width="60" height="50" fill="url(#k-glow)" stroke="#3b2a12" />
      <rect x="140" y="290" width="80" height="56" style={{ fill: V("lane-c") }} stroke="#3b2a12" />
      <rect x="140" y="400" width="80" height="100" fill="url(#k-glow)" stroke="#3b2a12" />
    </g>,
    <g key="2">{Signage(c, 90, 150, 180, 40)}</g>,
    <g key="3">
      <Scissors x={70} y={320} s={1.4} />
      {v === 1 ? <Clothesline x={40} y={268} w={90} colors={["lane-a", "haldi"]} /> : <Kettle x={250} y={318} />}
      <Tulsi x={40} y={436} s={0.9} />
    </g>,
    <g key="4">
      <Grain />
    </g>,
  ];
}

function rooftopArt(c: Ctx, v: number): Planes {
  const sky = v === 1 ? ["#1d1838", "#3a2a4a"] : v === 2 ? ["#7c8b93", "#b8c4c4"] : ["#ff9e6d", "#ffd9a8"];
  return [
    <g key="0">
      <rect width="360" height="520" fill={sky[1]} />
      <rect width="360" height="260" fill={sky[0]} opacity="0.85" />
      {v === 0 && <circle cx="250" cy="250" r="44" style={{ fill: V("haldi") }} opacity="0.9" />}
      {v === 1 && Array.from({ length: 22 }, (_, i) => <circle key={i} cx={(i * 73) % 360} cy={(i * 41) % 220} r="1.2" fill="#fff" opacity="0.8" />)}
      {v === 2 && Array.from({ length: 40 }, (_, i) => <path key={i} d={`M${(i * 37) % 360} ${(i * 53) % 400} l-4 12`} stroke="#e8f0f2" strokeWidth="1" opacity="0.7" />)}
      <path d="M0 300 h30 v-30 h40 v40 h30 v-60 h50 v50 h30 v-20 h60 v40 h40 v-30 h80 v240 H0Z" style={{ fill: mix(V("lane-b"), 40, "#2a2420") }} opacity="0.7" />
    </g>,
    <g key="1">
      <rect x="0" y="380" width="360" height="140" style={{ fill: mix(V("tin"), 70, V("brick")) }} />
      <rect x="0" y="372" width="360" height="12" style={{ fill: V("plaster") }} />
    </g>,
    <g key="2">
      <WaterTank x={250} y={300} s={1.2} />
    </g>,
    <g key="3">
      <Clothesline x={20} y={330} w={220} colors={["lane-a", "haldi", "lane-b", "mint-enamel"]} />
      <Kite x={110} y={130} s={1.3} fill="lane-a" />
      <Kite x={210} y={90} s={0.9} rot={14} fill="lane-c" />
      <Matka x={30} y={400} s={0.9} />
    </g>,
    <g key="4">
      {v === 1 && <StringLights x={0} y={300} w={360} n={18} on />}
      <Grain />
    </g>,
  ];
}

export function facadePlanes(scene: AnyScene, c: Ctx): Planes {
  const v = c.dna.variants[scene];
  switch (scene) {
    case "gate":
      return v === 0 ? gateArch(c) : v === 1 ? gateTin(c) : gateBlue(c);
    case "window":
      return windowArt(c, v);
    case "counter":
      return counterArt(c, v);
    case "menu":
      return menuArt(c, v);
    case "postbox":
      return postboxArt(c, v);
    case "notice":
      return noticeArt(c, v);
    case "loft":
      return loftArt(c, v);
    case "rooftop":
      return rooftopArt(c, v);
  }
}

/** Static composition of the planes (server). SceneTilt wraps it on the client for parallax. */
export function Facade({ scene, ctx, className, label }: { scene: AnyScene; ctx: Ctx; className?: string; label?: string }) {
  const planes = facadePlanes(scene, ctx);
  return (
    <div className={`stage ${className ?? ""}`}>
      <div className="planes" style={{ aspectRatio: `${VB.w} / ${VB.h}` }} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
        {planes.map((p, i) => (
          <svg key={i} className={`plane plane-${i}`} viewBox={`0 0 ${VB.w} ${VB.h}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
            {p}
          </svg>
        ))}
      </div>
    </div>
  );
}
