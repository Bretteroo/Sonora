import React, { useMemo } from 'react'

// A scene's picture: a grid of flat geometric figures in one of a set of
// palettes, drawn from the scene's id. A scene can play several kinds of
// music at once, so no one cover stands for it; this is its own. The id never
// changes, so neither does the picture: the same after a reload, a restart, a
// rename or an edit, with nothing stored for it.

// Four colors each, the first the ground. Chosen to read on the dark home and
// apart from one another in a row of tiles.
const PALETTES = [
  ['#1f3a5f', '#f2a541', '#f4f1de', '#e07a5f'],
  ['#2b2d42', '#ef233c', '#edf2f4', '#8d99ae'],
  ['#264653', '#2a9d8f', '#e9c46a', '#f4a261'],
  ['#3d1a3b', '#ff6f59', '#ffd166', '#06d6a0'],
  ['#0b3954', '#bfd7ea', '#ff5a5f', '#c81d25'],
  ['#14213d', '#fca311', '#e5e5e5', '#5c7aea'],
  ['#2d3142', '#ef8354', '#bfc0c0', '#4f5d75'],
  ['#004643', '#f9bc60', '#abd1c6', '#e16162'],
  ['#232946', '#eebbc3', '#b8c1ec', '#fffffe'],
  ['#3a0ca3', '#f72585', '#4cc9f0', '#f8f9fa'],
  ['#283618', '#dda15e', '#fefae0', '#bc6c25'],
  ['#1b1b3a', '#f2c14e', '#f78154', '#5fad56'],
]

// A string to a 32-bit seed (FNV-1a), and the seed to a run of numbers in
// [0, 1) (mulberry32): the same id gives the same run everywhere.
function seedOf(text) {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function numbers(seed) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// One cell's figure, in a cell `s` wide at x, y, turned by a quarter `turn`
// times about its center.
function figure(kind, x, y, s, turn, fill, ground, key) {
  const c = s / 2
  const rot = `rotate(${turn * 90} ${x + c} ${y + c})`
  switch (kind) {
    case 'circle':
      return <circle key={key} cx={x + c} cy={y + c} r={c * 0.86} fill={fill} />
    case 'ring':
      return (
        <g key={key}>
          <circle cx={x + c} cy={y + c} r={c * 0.86} fill={fill} />
          <circle cx={x + c} cy={y + c} r={c * 0.42} fill={ground} />
        </g>
      )
    case 'quarter':
      return <path key={key} transform={rot} d={`M${x} ${y}h${s}A${s} ${s} 0 0 1 ${x} ${y + s}z`} fill={fill} />
    case 'half':
      return <path key={key} transform={rot} d={`M${x} ${y + c}A${c} ${c} 0 0 1 ${x + s} ${y + c}z`} fill={fill} />
    case 'triangle':
      return <path key={key} transform={rot} d={`M${x} ${y}h${s}L${x} ${y + s}z`} fill={fill} />
    case 'square':
      return <rect key={key} x={x} y={y} width={s} height={s} fill={fill} />
    case 'stripes':
      return (
        <g key={key} transform={rot}>
          {[0, 1, 2].map((n) => <rect key={n} x={x} y={y + (n * 2 * s) / 5} width={s} height={s / 5} fill={fill} />)}
        </g>
      )
    default:
      return null
  }
}

const KINDS = ['circle', 'ring', 'quarter', 'half', 'triangle', 'square', 'stripes', 'quarter', 'half', 'triangle', 'empty']

// The figures for one id: a palette, a grid of two to four cells a side, and
// in each cell a figure, a turn, and a color other than the ground.
function compose(id) {
  const next = numbers(seedOf(id || 'scene'))
  const pick = (list) => list[Math.floor(next() * list.length)]
  const [ground, ...inks] = pick(PALETTES)
  const side = 2 + Math.floor(next() * 3)
  const s = 100 / side
  const cells = []
  for (let row = 0; row < side; row++) {
    for (let col = 0; col < side; col++) {
      // Half the cells first lay a square of another ink under their figure,
      // so the figures do not all float on the one ground.
      const under = next() < 0.5 ? pick(inks) : ground
      let ink = pick(inks)
      if (ink === under) ink = inks[(inks.indexOf(ink) + 1) % inks.length]
      cells.push({ x: col * s, y: row * s, s, under, ink, kind: pick(KINDS), turn: Math.floor(next() * 4) })
    }
  }
  return { ground, cells }
}

// The ground of a scene's picture, which tints its row while the scene is on.
export function sceneGround(id) {
  return compose(id).ground
}

export default function SceneArt({ id, className = '' }) {
  const { ground, cells } = useMemo(() => compose(id), [id])
  return (
    <svg className={`wb-scene-art ${className}`.trim()} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="100" height="100" fill={ground} />
      {cells.map((cell, n) => (
        <g key={n}>
          {cell.under !== ground && <rect x={cell.x} y={cell.y} width={cell.s} height={cell.s} fill={cell.under} />}
          {figure(cell.kind, cell.x, cell.y, cell.s, cell.turn, cell.ink, cell.under, 'f')}
        </g>
      ))}
    </svg>
  )
}
