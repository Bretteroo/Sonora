// Material Girl's shape library.
//
// M3 Expressive gives artwork, buttons and progress their own silhouettes:
// scalloped cookies, a soft-pointed sunny, a four-leaf clover, a pill, a
// squircle. Each one here is written as a radius around a center, r(theta),
// and sampled at the same number of points, so any two are polygons of equal
// length and CSS can morph one into the other by transitioning clip-path.
// The formulas are this theme's own; nothing is traced from anyone's assets.

// 360: at the big player's 420px a cookie's scallop gets thirty points
// rather than six, so its curve no longer shows straight facets.
const POINTS = 360

function polygon(radius) {
  const pts = []
  let peak = 0
  const raw = []
  for (let i = 0; i < POINTS; i += 1) {
    const theta = (i / POINTS) * Math.PI * 2 - Math.PI / 2
    const r = radius(theta)
    raw.push([Math.cos(theta) * r, Math.sin(theta) * r])
    peak = Math.max(peak, Math.abs(Math.cos(theta) * r), Math.abs(Math.sin(theta) * r))
  }
  // Every shape is scaled to touch its box, so a cookie and a circle drawn
  // in the same square look the same size.
  for (const [x, y] of raw) pts.push(`${(50 + (x / peak) * 50).toFixed(2)}% ${(50 + (y / peak) * 50).toFixed(2)}%`)
  return `polygon(${pts.join(', ')})`
}

const superellipse = (n) => (theta) => (Math.abs(Math.cos(theta)) ** n + Math.abs(Math.sin(theta)) ** n) ** (-1 / n)

export const SHAPES = {
  circle: polygon(() => 1),
  squircle: polygon(superellipse(4.2)),
  softSquare: polygon(superellipse(6)),
  cookie4: polygon((t) => 0.86 + 0.14 * Math.cos(4 * t)),
  cookie6: polygon((t) => 0.9 + 0.1 * Math.cos(6 * t)),
  cookie9: polygon((t) => 0.92 + 0.08 * Math.cos(9 * t)),
  cookie12: polygon((t) => 0.94 + 0.06 * Math.cos(12 * t)),
  sunny: polygon((t) => 0.84 + 0.16 * Math.cos(8 * t) ** 3),
  clover: polygon((t) => 0.62 + 0.38 * Math.abs(Math.cos(2 * t)) ** 0.8),
  flower: polygon((t) => 0.78 + 0.22 * Math.abs(Math.cos(3 * t)) ** 0.6),
  pentagon: polygon((t) => {
    const k = Math.PI / 5
    const a = ((t + Math.PI / 2) % (2 * k) + 2 * k) % (2 * k) - k
    return (Math.cos(k) / Math.cos(a)) * 0.9 + 0.1
  }),
  gem: polygon((t) => {
    const k = Math.PI / 6
    const a = ((t % (2 * k)) + 2 * k) % (2 * k) - k
    return (Math.cos(k) / Math.cos(a)) * 0.85 + 0.15
  }),
  pill: polygon(superellipse(2.6)),
  burst: polygon((t) => 0.8 + 0.2 * Math.cos(12 * t)),
  softBurst: polygon((t) => 0.88 + 0.12 * Math.cos(10 * t)),
  oval: polygon((t) => 1 / Math.sqrt(Math.cos(t) ** 2 + (Math.sin(t) / 0.78) ** 2)),
}

// One shape per kind of thing, so a row of rooms or of playlists reads as a set.
// Each name used to hash to one of ten shapes, which
// put unrelated silhouettes side by side and looked random. A room's art still
// changes shape while it plays; that is a state, and M3 morphs shape to show
// one.
export const KIND_SHAPES = {
  room: SHAPES.squircle,
  playlist: SHAPES.cookie12,
  service: SHAPES.circle,
}

// The loading indicator's sequence, Compose's IndeterminateIndicatorPolygons: one shape into the
// next while the whole thing turns.
export const LOADING_SEQUENCE = ['softBurst', 'cookie9', 'pentagon', 'pill', 'sunny', 'cookie4', 'oval']
