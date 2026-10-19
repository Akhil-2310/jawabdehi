// Flat illustrations of what Jawabdehi is about: potholes, broken footpaths, damaged bridges,
// garbage. Drawn in SVG so they stay sharp, tiny and free of third-party assets.

const ASPHALT = "#3a3c40"
const ASPHALT_DARK = "#121314"
const RIM = "#5b5e63"
const PAVER = "#9d9a91"
const PAVER_LINE = "#7c796f"
const HAZARD = "#ffc41f"
const CONE = "#ff5a1f"
const WHITE = "#f3f1ea"
const BIN = "#2f7d4a"
const BAG = "#1a1a1a"

function Grain({ id, opacity = 0.14 }: { id: string; opacity?: number }) {
  return (
    <filter id={id} x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="7" />
      <feColorMatrix values={`0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 ${opacity} 0`} />
      <feComposite in2="SourceGraphic" operator="in" />
    </filter>
  )
}

function Kerb({ y, width, h = 12 }: { y: number; width: number; h?: number }) {
  const blocks = Math.ceil(width / 30)
  return (
    <g>
      {Array.from({ length: blocks }, (_, i) => (
        <rect key={i} x={i * 30} y={y} width={30} height={h} fill={i % 2 ? HAZARD : "#141414"} />
      ))}
    </g>
  )
}

function Cone({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="4" rx="34" ry="7" fill="#000" opacity=".35" />
      <rect x="-30" y="-6" width="60" height="10" rx="2" fill="#151515" />
      <path d="M-20 -6 L-6 -86 L6 -86 L20 -6 Z" fill={CONE} />
      <path d="M-15.5 -32 L15.5 -32 L13 -46 L-13 -46 Z" fill={WHITE} />
      <path d="M-10.5 -60 L10.5 -60 L8.5 -71 L-8.5 -71 Z" fill={WHITE} />
      <path d="M-6 -86 L6 -86 L5 -90 L-5 -90 Z" fill="#d9480f" />
    </g>
  )
}

function Pothole({ cx, cy, s = 1 }: { cx: number; cy: number; s?: number }) {
  return (
    <g transform={`translate(${cx} ${cy}) scale(${s})`}>
      {/* cracks radiating out */}
      <g stroke={ASPHALT_DARK} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M-92 -8 L-118 -20 L-140 -14 L-162 -30" />
        <path d="M-118 -20 L-126 -44" />
        <path d="M88 -18 L112 -34 L128 -30 L150 -52" />
        <path d="M96 14 L124 24 L138 46" />
        <path d="M-60 38 L-74 62 L-70 82" />
        <path d="M20 46 L28 70 L52 84" />
        <path d="M-20 -46 L-14 -70 L-26 -88" />
      </g>
      {/* broken rim */}
      <path
        d="M-98 -6 C-96 -34 -60 -52 -18 -50 C24 -56 70 -44 94 -22 C110 -6 102 24 72 40 C36 56 -24 58 -64 44 C-92 34 -100 16 -98 -6 Z"
        fill={RIM}
      />
      {/* the hole */}
      <path
        d="M-84 -4 C-82 -28 -50 -42 -14 -40 C22 -44 62 -34 80 -16 C92 -2 86 20 60 32 C30 44 -22 46 -56 34 C-78 26 -86 12 -84 -4 Z"
        fill={ASPHALT_DARK}
      />
      {/* rainwater */}
      <path d="M-60 6 C-48 -10 -6 -16 30 -10 C58 -6 70 6 56 18 C36 32 -22 34 -48 24 C-62 18 -66 12 -60 6 Z" fill="#4f6576" />
      <path d="M-34 2 C-14 -6 16 -6 36 -2" stroke="#8fa5b5" strokeWidth="2" strokeLinecap="round" opacity=".7" fill="none" />
      <path d="M-20 14 C-4 10 14 10 26 12" stroke="#8fa5b5" strokeWidth="1.5" strokeLinecap="round" opacity=".45" fill="none" />
      {/* loose chips */}
      <g fill="#6a6d72">
        <path d="M-108 22 l7 -3 l3 6 l-7 3 z" />
        <path d="M104 -40 l6 -2 l2 5 l-6 2 z" />
        <path d="M114 4 l8 0 l-2 6 l-7 -1 z" />
        <path d="M-40 60 l6 -2 l2 6 l-6 1 z" />
        <path d="M60 -58 l5 -1 l1 5 l-5 1 z" />
      </g>
    </g>
  )
}

function GarbageBin({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="40" cy="80" rx="62" ry="8" fill="#000" opacity=".25" />
      {/* overflowing bags */}
      <path d="M8 6 C2 -16 22 -30 38 -22 C46 -38 72 -34 74 -14 C84 -12 86 4 76 10 Z" fill={BAG} />
      <path d="M26 -22 C30 -30 36 -32 40 -28" stroke="#3a3a3a" strokeWidth="2" fill="none" />
      <path d="M50 -24 l4 -10 l5 9" fill="#2a2a2a" />
      {/* bin */}
      <path d="M0 6 H80 L74 78 H6 Z" fill={BIN} />
      <rect x="-4" y="2" width="88" height="8" rx="2" fill="#245f39" />
      <path d="M14 22 V66 M28 22 V66 M42 22 V66 M56 22 V66" stroke="#256a3d" strokeWidth="3" />
      {/* spilled rubbish */}
      <path d="M86 70 C92 56 116 54 120 70 C122 80 90 82 86 70 Z" fill={BAG} />
      <rect x="-26" y="66" width="20" height="8" rx="4" fill="#4a90c8" transform="rotate(-18 -16 70)" />
      <path d="M100 56 l12 -6 l6 8 l-10 6 z" fill="#e8e3d6" />
      <path d="M-14 48 l10 -2 l2 9 l-11 2 z" fill="#d8b98a" />
      <circle cx="126" cy="76" r="4" fill="#c0392b" />
    </g>
  )
}

/** The hero: a stretch of Mumbai road from above — broken footpath, painted kerb, garbage, pothole, cone. */
export function HeroScene() {
  return (
    <svg viewBox="0 0 600 470" role="img" aria-label="A pothole full of rainwater on a road, a traffic cone, a broken footpath and an overflowing garbage bin" style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <pattern id="pavers" width="44" height="24" patternUnits="userSpaceOnUse">
          <rect width="44" height="24" fill={PAVER} />
          <path d="M0 0H44M0 12H44M22 0V12M0 12V24M44 12V24" stroke={PAVER_LINE} strokeWidth="2" />
        </pattern>
        <Grain id="g-hero" />
      </defs>

      {/* footpath */}
      <rect width="600" height="118" fill="url(#pavers)" />
      <path d="M66 24 h44 v24 h-22 v24 h-44 v-24 h22 z" fill="#5f4f3c" />
      <path d="M70 30 l12 6 l-6 10 l10 8" stroke="#3e3328" strokeWidth="2" fill="none" />
      <path d="M154 72 h22 v12 h22 v12 h-44 z" fill="#6e6a61" />
      <path d="M240 36 l30 30 M262 30 l-8 40" stroke={PAVER_LINE} strokeWidth="2.5" />
      <rect width="600" height="118" fill="#000" filter="url(#g-hero)" opacity=".7" />

      <GarbageBin x={430} y={18} s={0.95} />

      {/* kerb, painted black and yellow */}
      <Kerb y={118} width={600} h={14} />

      {/* road */}
      <rect y="132" width="600" height="338" fill={ASPHALT} />
      <rect y="132" width="600" height="338" fill="#fff" filter="url(#g-hero)" />
      <path d="M0 150 H600" stroke={WHITE} strokeWidth="4" opacity=".85" />
      <g stroke={HAZARD} strokeWidth="7">
        {Array.from({ length: 8 }, (_, i) => (
          <path key={i} d={`M${i * 84 - 20} 420 h50`} />
        ))}
      </g>
      {/* patch from an old repair that didn't hold */}
      <path d="M40 190 h120 v58 h-120 z" fill="#46484d" />
      <path d="M40 190 h120 v58 h-120 z" fill="none" stroke="#2a2b2e" strokeWidth="2" />

      <Pothole cx={410} cy={282} s={1.08} />
      <Cone x={548} y={452} s={0.8} />
    </svg>
  )
}

export function PotholeArt() {
  return (
    <svg viewBox="0 0 240 150" aria-hidden style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <Grain id="g-p" />
      </defs>
      <rect width="240" height="150" fill={ASPHALT} />
      <rect width="240" height="150" fill="#fff" filter="url(#g-p)" />
      <g stroke={HAZARD} strokeWidth="5">
        <path d="M-10 134 h40 M60 134 h40 M130 134 h40 M200 134 h40" />
      </g>
      <Pothole cx={124} cy={70} s={0.62} />
    </svg>
  )
}

export function FootpathArt() {
  return (
    <svg viewBox="0 0 240 150" aria-hidden style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <pattern id="pv2" width="40" height="22" patternUnits="userSpaceOnUse">
          <rect width="40" height="22" fill={PAVER} />
          <path d="M0 0H40M0 11H40M20 0V11M0 11V22M40 11V22" stroke={PAVER_LINE} strokeWidth="2" />
        </pattern>
        <Grain id="g-f" />
      </defs>
      <rect width="240" height="120" fill="url(#pv2)" />
      <path d="M60 22 h40 v22 h20 v22 h-60 v-22 h-20 v-11 h20 z" fill="#5f4f3c" />
      <path d="M70 34 l14 8 l-8 12 l12 8" stroke="#3e3328" strokeWidth="2" fill="none" />
      <path d="M150 66 l18 -6 l10 14 l-16 10 z" fill="#8a867c" stroke={PAVER_LINE} strokeWidth="2" />
      <path d="M176 22 l26 30 M196 18 l-6 36" stroke={PAVER_LINE} strokeWidth="2.5" />
      <rect width="240" height="120" fill="#000" filter="url(#g-f)" opacity=".6" />
      <Kerb y={120} width={240} h={12} />
      <rect y="132" width="240" height="18" fill={ASPHALT} />
    </svg>
  )
}

export function BridgeArt() {
  return (
    <svg viewBox="0 0 240 150" aria-hidden style={{ width: "100%", height: "auto", display: "block" }}>
      <rect width="240" height="150" fill="#2b3036" />
      <rect y="112" width="240" height="38" fill="#1c1f23" />
      <g stroke="#59616b" strokeWidth="3">
        <path d="M0 126 H240 M0 140 H240" />
      </g>
      {/* deck and piers */}
      <rect x="0" y="54" width="240" height="18" fill="#8b8f93" />
      <rect x="34" y="72" width="16" height="40" fill="#6f7377" />
      <rect x="190" y="72" width="16" height="40" fill="#6f7377" />
      {/* railing with a gap */}
      <g stroke="#c9ccd0" strokeWidth="3">
        <path d="M0 30 H96 M140 30 H240" />
        {[8, 28, 48, 68, 88, 148, 168, 188, 208, 228].map((x) => (
          <path key={x} d={`M${x} 30 V54`} />
        ))}
        <path d="M96 30 L104 38" />
        <path d="M140 30 L134 40" />
      </g>
      {/* exposed, rusted steel and a crack */}
      <path d="M100 72 l4 12 l-6 10 l8 12" stroke="#b5562a" strokeWidth="3" fill="none" />
      <path d="M118 72 l2 9 l-4 8" stroke="#b5562a" strokeWidth="3" fill="none" />
      <path d="M60 54 l8 8 l-4 6 l10 4" stroke="#2a2d31" strokeWidth="2.5" fill="none" />
      <path d="M98 54 L104 72 L124 72 L130 54 Z" fill="#4d5156" />
      {/* warning sign */}
      <g transform="translate(206 8)">
        <rect x="-14" y="-2" width="28" height="28" rx="3" transform="rotate(45 0 12)" fill={HAZARD} stroke="#111" strokeWidth="2" />
        <path d="M0 4 V15" stroke="#111" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="0" cy="20.5" r="2" fill="#111" />
      </g>
    </svg>
  )
}

export function GarbageArt() {
  return (
    <svg viewBox="0 0 240 150" aria-hidden style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <pattern id="pv3" width="40" height="22" patternUnits="userSpaceOnUse">
          <rect width="40" height="22" fill="#8f8c84" />
          <path d="M0 0H40M0 11H40M20 0V11M0 11V22M40 11V22" stroke="#76736a" strokeWidth="2" />
        </pattern>
      </defs>
      <rect width="240" height="150" fill="url(#pv3)" />
      <GarbageBin x={74} y={44} s={0.9} />
      <path d="M20 118 C24 104 48 102 52 116 C54 126 22 128 20 118 Z" fill={BAG} />
      <path d="M190 120 l14 -6 l6 9 l-12 7 z" fill="#e8e3d6" />
      <rect x="196" y="98" width="20" height="8" rx="4" fill="#4a90c8" transform="rotate(24 206 102)" />
    </svg>
  )
}

/** A small yellow diamond warning sign, used for numbered steps. */
export function SignNumber({ n }: { n: number | string }) {
  return (
    <svg width="46" height="46" viewBox="0 0 46 46" aria-hidden>
      <rect x="8" y="8" width="30" height="30" rx="3" transform="rotate(45 23 23)" fill={HAZARD} stroke="#111" strokeWidth="2.5" />
      <text x="23" y="29.5" textAnchor="middle" fontFamily="var(--sans)" fontWeight="900" fontSize="17" fill="#111">
        {n}
      </text>
    </svg>
  )
}

export function ConeIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="-36 -94 72 102" aria-hidden>
      <Cone x={0} y={0} />
    </svg>
  )
}
