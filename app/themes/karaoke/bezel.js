import { useEffect } from 'react'

// Where the cabinet's plastic meets the glass. The glass of a picture tube is
// a dome, and the opening the plastic leaves for it bows outward along each
// side: its corners lie further in than the middles of its sides. The tube
// itself is a plain rounded box, so the plastic is carried in over it toward
// the corners, by nothing at the middle of each side and by BOW of the side's
// length at its ends.
//
// The opening is a recess in one molded piece: the cabinet's own plastic runs
// to the glass with no frame laid on it. Its inner wall is shaded as the light
// from the upper left finds it, the walls along the top and left in shade and
// those along the bottom and right catching the light, with a fine dark line
// where plastic meets glass and a little shadow on the glass under the walls
// in shade.
//
// All of it is drawn here, at the size it is shown, from exact shapes, so
// every edge is smooth. It is drawn again only when the screen changes size
// or the machine changes between its light and dark versions.
const BOW = 0.008
const WALL = 9      // how deep the wall is, in pixels of the page at full size
const DROP = 6      // how far the shadow of a wall in shade reaches over the glass
const LIGHT = [Math.SQRT1_2, Math.SQRT1_2]   // the way the light travels: down and to the right
const LAP = 1.5     // how far the plastic runs on past the glass's edge, fading, so no sliver of glass shows between them


const tones = new Map()   // the plastic's color, by picture
const asked = new Set()

function load(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })
}

// The cabinet's plastic, as the middle of its picture shows it.
function toneOf(image) {
  const canvas = document.createElement('canvas')
  canvas.width = 40
  canvas.height = 40
  const c = canvas.getContext('2d')
  c.drawImage(image, image.naturalWidth / 2 - 20, image.naturalHeight / 2 - 20, 40, 40, 0, 0, 40, 40)
  const d = c.getImageData(0, 0, 40, 40).data
  const sum = [0, 0, 0]
  for (let i = 0; i < d.length; i += 4) { sum[0] += d[i]; sum[1] += d[i + 1]; sum[2] += d[i + 2] }
  return sum.map((v) => v / 1600)
}

// How far a point lies outside a rounded box (negative inside).
function boxDistance(x, y, left, top, right, bottom, r) {
  const cx = (left + right) / 2
  const cy = (top + bottom) / 2
  const qx = Math.abs(x - cx) - ((right - left) / 2 - r)
  const qy = Math.abs(y - cy) - ((bottom - top) / 2 - r)
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
}

// `tube` is the glass's box within the drawing, in its pixels.
function draw(W, H, tube, scale, tone) {
  const { left, top, right, bottom, r } = tube
  const image = new ImageData(W, H)
  const data = image.data
  const bowX = BOW * (right - left)
  const bowY = BOW * (bottom - top)
  const cx = (left + right) / 2
  const cy = (top + bottom) / 2
  const hw = (right - left) / 2
  const hh = (bottom - top) / 2
  // How far a point lies outside the opening: the tube's box with each side drawn in toward its ends.
  const open = (x, y) => {
    const u = Math.max(-1, Math.min(1, (x - cx) / hw))
    const v = Math.max(-1, Math.min(1, (y - cy) / hh))
    const sx = Math.sign(x - cx) * bowY * v * v
    const sy = Math.sign(y - cy) * bowX * u * u
    return boxDistance(x + sx, y + sy, left, top, right, bottom, r)
  }
  const wall = WALL * scale
  const drop = DROP * scale
  const lap = LAP * scale
  const reach = wall + drop + Math.max(bowX, bowY) + 4
  // The opening's distance is worked out once for a pixel and kept for the three rows that use it.
  let above = new Float64Array(W + 2).fill(NaN)
  let here = new Float64Array(W + 2).fill(NaN)
  let below = new Float64Array(W + 2).fill(NaN)
  const at3 = (row, x, y) => {
    let v = row[x + 1]
    if (v !== v) { v = open(x + 0.5, y + 0.5); row[x + 1] = v }
    return v
  }
  // The opening lies no further than this from the glass's own edge, so a pixel well clear of
  // that edge is passed over on the cheaper measure alone.
  const slack = Math.hypot(bowX, bowY)
  for (let y = 0; y < H; y += 1) {
    if (y > 0) { const spare = above; above = here; here = below; below = spare; below.fill(NaN) }
    for (let x = 0; x < W; x += 1) {
      // Only the band round the opening is drawn; the rest is left clear.
      if (x > left + reach && x < right - reach && y > top + reach && y < bottom - reach) { x = Math.floor(right - reach); continue }
      // The plastic covers what of the glass lies outside the opening, however far out (the
      // corners are drawn in furthest); elsewhere the cabinet is already there.
      const onGlass = boxDistance(x + 0.5, y + 0.5, left, top, right, bottom, r)
      if (onGlass < -drop - 1 - slack || (onGlass > 0.5 + lap && onGlass > wall + 1 + slack)) continue
      const d = at3(here, x, y)
      if ((d > wall + 1 && onGlass > 0.5 + lap) || d < -drop - 1) continue
      const alpha = Math.min(1, Math.max(0, d + 0.5)) * Math.min(1, Math.max(0, 1 - (onGlass - 0.5) / lap))
      // Which way the wall faces: the opening's edge, from the change in distance.
      const gx = at3(here, x + 1, y) - at3(here, x - 1, y)
      const gy = at3(below, x, y + 1) - at3(above, x, y - 1)
      const g = Math.hypot(gx, gy) || 1
      const facing = (gx * LIGHT[0] + gy * LIGHT[1]) / g   // below 0 in shade, above 0 in the light
      // Each layer is weighed by how much of the pixel it covers, so its edges are smooth.
      const lo = d - 0.5
      const hi = d + 0.5
      let inkAlpha = 0
      let inkValue = 0
      // The shadow a wall in shade casts on the glass.
      if (facing < 0) {
        const a = 0.28 * Math.pow(Math.max(0, 1 + Math.min(0, d) / drop), 2) * -facing * Math.max(0, Math.min(hi, 0) - Math.max(lo, -drop))
        if (a > 0) inkAlpha = a
      }
      // The wall, in shade or in the light.
      const depth = Math.pow(Math.max(0, 1 - Math.max(0, d) / wall), 1.3) * Math.max(0, Math.min(hi, wall) - Math.max(lo, 0))
      const wallAlpha = (facing < 0 ? 0.42 * -facing : 0.45 * facing) * depth
      if (wallAlpha > 0) {
        const out = wallAlpha + inkAlpha * (1 - wallAlpha)
        inkValue = ((facing < 0 ? 0 : 255) * wallAlpha + inkValue * inkAlpha * (1 - wallAlpha)) / out
        inkAlpha = out
      }
      // The fine dark line where plastic meets glass: black at no less than 0.38, as much as covers the pixel.
      const line = Math.max(0, Math.min(hi, 1.2 * scale) - Math.max(lo, 0))
      if (line > 0) {
        inkAlpha += line * (Math.max(inkAlpha, 0.38) - inkAlpha)
        inkValue *= 1 - line
      }
      // The ink over the plastic, or over what lies beneath where there is no plastic.
      const outAlpha = inkAlpha + alpha * (1 - inkAlpha)
      if (outAlpha <= 0) continue
      const ink = inkValue * inkAlpha
      const under = alpha * (1 - inkAlpha)
      const at = (y * W + x) * 4
      data[at] = (ink + tone[0] * under) / outAlpha
      data[at + 1] = (ink + tone[1] * under) / outAlpha
      data[at + 2] = (ink + tone[2] * under) / outAlpha
      data[at + 3] = outAlpha * 255
    }
  }
  return image
}

// Keeps the opening's edge fitted to the monitor. The drawing goes on a canvas laid over the
// tube's edge, painted in place: a picture handed over by address can leave the edge bare for a
// frame while the browser reads it in.
export function useBezel(monitorRef) {
  useEffect(() => {
    const monitor = monitorRef.current
    if (!monitor || typeof ResizeObserver === 'undefined') return undefined
    const canvas = document.createElement('canvas')
    canvas.className = 'km-bezel'
    canvas.setAttribute('aria-hidden', 'true')
    canvas.hidden = true
    monitor.appendChild(canvas)
    let last = ''
    let gone = false
    const clear = () => { canvas.hidden = true; last = '' }
    const fit = (moving) => {
      const box = getComputedStyle(monitor, '::after')
      const tubeEl = monitor.querySelector('.km-tube')
      const src = (getComputedStyle(monitor).getPropertyValue('--km-i-shell').match(/url\("?([^")]+)"?\)/) || [])[1]
      if (box.display === 'none' || !tubeEl || !src) { clear(); return }
      const m = monitor.getBoundingClientRect()
      const t = tubeEl.getBoundingClientRect()
      const inset = ['left', 'top', 'right', 'bottom'].map((side) => parseFloat(box[side]) || 0)
      const ox = m.left + inset[0]
      const oy = m.top + inset[1]
      const width = m.width - inset[0] - inset[2]
      const height = m.height - inset[1] - inset[3]
      const radius = parseFloat(getComputedStyle(tubeEl).borderTopLeftRadius) || 0
      if (width < 40 || height < 40 || !radius) { clear(); return }
      const scale = moving === true ? 1 : Math.min(2, window.devicePixelRatio || 1)
      const W = Math.round(width * scale)
      const H = Math.round(height * scale)
      const tube = { left: (t.left - ox) * scale, top: (t.top - oy) * scale, right: (t.right - ox) * scale, bottom: (t.bottom - oy) * scale, r: radius * scale }
      const key = `${src}|${W}x${H}|${Object.values(tube).map((v) => v.toFixed(1)).join(',')}`
      if (key === last) return
      last = key
      const tone = tones.get(src)
      if (!tone) {
        // The plastic's color is read once for each picture; the edge is drawn when it is known.
        last = ''
        if (!asked.has(src)) {
          asked.add(src)
          load(src).then((picture) => { tones.set(src, toneOf(picture)); if (!gone) fit() }, () => {})
        }
        return
      }
      const image = draw(W, H, tube, scale, tone)
      // Sized and painted in one go, so no frame shows the canvas empty.
      if (canvas.width !== W) canvas.width = W
      if (canvas.height !== H) canvas.height = H
      canvas.getContext('2d').putImageData(image, 0, 0)
      canvas.style.left = `${inset[0]}px`
      canvas.style.top = `${inset[1]}px`
      canvas.style.width = `calc(100% - ${inset[0] + inset[2]}px)`
      canvas.style.height = `calc(100% - ${inset[1] + inset[3]}px)`
      canvas.hidden = false
    }
    // Drawn in the same turn as the change of size is reported, which is before the browser
    // paints it: the edge never shows at a size it was not drawn for.
    // While the size is still changing on a dense screen the edge is drawn at one dot to the
    // pixel, which is quick enough to keep up, and at full sharpness once the size rests.
    let rest = 0
    const moved = () => {
      const dense = (window.devicePixelRatio || 1) > 1
      fit(dense)
      clearTimeout(rest)
      if (dense) rest = setTimeout(() => { if (!gone) fit() }, 140)
    }
    const ask = () => { fit() }
    fit()
    const observer = new ResizeObserver(moved)
    observer.observe(monitor)
    // The light and dark versions are told apart on the page's root.
    const look = new MutationObserver(ask)
    look.observe(document.documentElement, { attributes: true, attributeFilter: ['data-variant', 'class'] })
    return () => { gone = true; clearTimeout(rest); observer.disconnect(); look.disconnect(); canvas.remove() }
  }, [monitorRef])
}
