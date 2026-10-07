import React from 'react'

// Silhouettes of the Sonos products, drawn rather than borrowed, so Sonora
// still ships no third-party artwork. Each one fills a 48-unit square and
// paints in currentColor, so a theme tints them by inheritance.
//
// They are recognizable by proportion rather than detail: the Play:1 and One
// are tall and narrow, the Five is wide, a soundbar is a bar as long as its
// model is, the Sub is a slab with a hole through it, and a Connect or Port is
// a low box with a status light. Anything unrecognized falls back to a plain
// speaker, which is honest about not knowing.

const box = {
  width: 48, height: 48, viewBox: '0 0 48 48', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.8,
  strokeLinecap: 'round', strokeLinejoin: 'round',
  'aria-hidden': true,
}
const face = 'color-mix(in srgb, currentColor 14%, transparent)'

// A column of grille dots, for the products whose fronts are perforated.
function Dots({ x, from, to, step = 4 }) {
  const rows = []
  for (let y = from; y <= to; y += step) rows.push(y)
  return rows.map((y) => <circle key={y} cx={x} cy={y} r="0.9" fill="currentColor" stroke="none" opacity="0.55" />)
}

export const Play1 = (p) => (
  <svg {...box} {...p}>
    <rect x="15" y="7" width="18" height="34" rx="4" fill={face} />
    <Dots x={24} from={13} to={35} />
    <path d="M19 41h10" opacity="0.5" />
  </svg>
)
export const Play3 = (p) => (
  <svg {...box} {...p}>
    <rect x="6" y="16" width="36" height="17" rx="4" fill={face} />
    <Dots x={16} from={21} to={29} step={4} />
    <circle cx="27" cy="24.5" r="4.4" opacity="0.55" />
  </svg>
)
export const Five = (p) => (
  <svg {...box} {...p}>
    <rect x="4" y="13" width="40" height="22" rx="4" fill={face} />
    <path d="M12 18v12M17 18v12M22 18v12" opacity="0.45" />
    <circle cx="34" cy="24" r="5" opacity="0.55" />
  </svg>
)
export const One = (p) => (
  <svg {...box} {...p}>
    <rect x="16" y="8" width="16" height="33" rx="5" fill={face} />
    <path d="M16 14h16" opacity="0.45" />
    <Dots x={24} from={20} to={36} />
  </svg>
)
export const Era300 = (p) => (
  <svg {...box} {...p}>
    <path d="M14 9h20l-5 13 5 17H14l5-17z" fill={face} />
    <path d="M19 22h10" opacity="0.45" />
  </svg>
)
export const Symfonisk = (p) => (
  <svg {...box} {...p}>
    <rect x="8" y="15" width="32" height="19" rx="2.5" fill={face} />
    <path d="M12 19l24 11M12 24l24 11M12 29l16 7" opacity="0.35" />
  </svg>
)
export const Connect = (p) => (
  <svg {...box} {...p}>
    <rect x="8" y="19" width="32" height="12" rx="2.5" fill={face} />
    <circle cx="13.5" cy="25" r="1.2" fill="currentColor" stroke="none" opacity="0.7" />
    <path d="M22 25h12" opacity="0.4" />
  </svg>
)
export const Amp = (p) => (
  <svg {...box} {...p}>
    <rect x="5" y="17" width="38" height="15" rx="2.5" fill={face} />
    <path d="M11 21v7M15 21v7M19 21v7" opacity="0.4" />
    <circle cx="35" cy="24.5" r="3.4" opacity="0.55" />
  </svg>
)
export const Beam = (p) => (
  <svg {...box} {...p}>
    <rect x="4" y="19" width="40" height="12" rx="6" fill={face} />
    <Dots x={24} from={23} to={27} step={4} />
    <path d="M12 25h6M30 25h6" opacity="0.4" />
  </svg>
)
export const Arc = (p) => (
  <svg {...box} {...p}>
    <rect x="2" y="20" width="44" height="10" rx="5" fill={face} />
    <path d="M9 25h8M31 25h8" opacity="0.4" />
    <circle cx="24" cy="25" r="1.6" opacity="0.6" />
  </svg>
)
export const Ray = (p) => (
  <svg {...box} {...p}>
    <rect x="7" y="20" width="34" height="11" rx="2.5" fill={face} />
    <path d="M13 25.5h10M28 25.5h6" opacity="0.4" />
  </svg>
)
export const Playbase = (p) => (
  <svg {...box} {...p}>
    <rect x="3" y="24" width="42" height="9" rx="3" fill={face} />
    <path d="M18 24v-6h12v6" opacity="0.5" />
    <path d="M10 28.5h9M29 28.5h9" opacity="0.35" />
  </svg>
)
export const Sub = (p) => (
  <svg {...box} {...p}>
    <rect x="11" y="7" width="26" height="34" rx="5" fill={face} />
    <circle cx="24" cy="24" r="7.5" />
    <path d="M11 15h26M11 33h26" opacity="0.3" />
  </svg>
)
export const Move = (p) => (
  <svg {...box} {...p}>
    <rect x="15" y="12" width="18" height="29" rx="5" fill={face} />
    <path d="M18 12c0-3 2.6-5 6-5s6 2 6 5" opacity="0.6" />
    <Dots x={24} from={20} to={34} />
  </svg>
)
export const Roam = (p) => (
  <svg {...box} {...p}>
    <rect x="18" y="12" width="12" height="26" rx="4" fill={face} />
    <path d="M18 18h12" opacity="0.45" />
    <Dots x={24} from={24} to={32} />
  </svg>
)
export const Boost = (p) => (
  <svg {...box} {...p}>
    <rect x="13" y="22" width="22" height="10" rx="2.5" fill={face} />
    <path d="M17 22v-5M31 22v-5" opacity="0.55" />
    <circle cx="17" cy="15.5" r="1.2" fill="currentColor" stroke="none" opacity="0.7" />
    <circle cx="31" cy="15.5" r="1.2" fill="currentColor" stroke="none" opacity="0.7" />
  </svg>
)
export const GenericSpeaker = (p) => (
  <svg {...box} {...p}>
    <rect x="14" y="9" width="20" height="30" rx="3.5" fill={face} />
    <circle cx="24" cy="21" r="5.5" opacity="0.55" />
    <circle cx="24" cy="32" r="2.4" opacity="0.45" />
  </svg>
)

// Longest names first, so "Arc Ultra" is not read as "Arc" and "One SL" is
// not read as "One". Matched on the model the device reports about itself.
const TABLE = [
  [/arc\s*ultra|\barc\b|playbar/, Arc],
  [/beam/, Beam],
  [/\bray\b/, Ray],
  [/playbase/, Playbase],
  [/\bsub\b|sub\s*mini/, Sub],
  [/era\s*300/, Era300],
  [/era\s*100|one\s*sl|\bone\b/, One],
  [/play:5|\bfive\b/, Five],
  [/play:3/, Play3],
  [/play:1/, Play1],
  [/symfonisk/, Symfonisk],
  [/connect:amp|\bamp\b/, Amp],
  [/connect|\bport\b|zoneplayer\s*9|zp90|zp80/, Connect],
  [/zoneplayer\s*1|zp100|zp120/, Amp],
  [/\bmove\b/, Move],
  [/roam/, Roam],
  [/boost|bridge/, Boost],
]

export function deviceGlyph(model) {
  const name = String(model || '').toLowerCase()
  for (const [pattern, Glyph] of TABLE) if (pattern.test(name)) return Glyph
  return GenericSpeaker
}

export default deviceGlyph
