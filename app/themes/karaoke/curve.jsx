import React, { useEffect, useState } from 'react'

// The glass of a picture tube bulges, and so does everything drawn on it:
// lyrics, video, menus, and windows alike. The screen is drawn flat and then
// pushed through a displacement filter whose map says, for each point of the
// glass, how far off to look for what shows there. The middle is magnified a
// little, the mid-points of the four edges stay where they are, and the
// corners would look past the picture's edge, where there is nothing to show.
// Those looks are held at the edge, so whatever lies along it carries on into
// the corners and the glass is full everywhere.
//
// The scan lines that come with the curved screen are a layer of their own over the
// screen, bent by a filter of their own. Held at the edge they would stop
// short of the corners, so their layer is drawn larger than the glass by
// SPILL on every side, and its corners find lines where they look.
//
// A displacement map carries offsets as colors (red across, green down, gray
// for none) scaled by the filter's own `scale`, so the map is rebuilt whenever
// the screen changes size. It is small (the bulge is smooth, and the filter
// stretches the map over the screen), so a rebuild costs next to nothing.
//
// The filter moves whole pixels: it does not blend between them. Where an
// offset crosses from one pixel to the next, a straight line steps by a
// pixel. On a screen with two or more device pixels to each pixel of the page
// the steps are too fine to see; on one with a single device pixel they show
// as jagged lines and broken lettering. There the screen is bent SAMPLES
// times, SPREAD of a pixel apart, and the results are averaged, so a step
// gets a pixel of the shade between. Averaging softens every edge it crosses
// as well, so the spread is kept small: some steps remain, and the lettering
// stays nearly as crisp as without it.
export const FILTER_ID = 'km-bulge'
const MAP_ID = 'km-bulge-map'
const DISP_ID = 'km-bulge-disp'
export const LINES_FILTER_ID = 'km-bulge-lines'
const LINES_MAP_ID = 'km-bulge-lines-map'
const LINES_DISP_ID = 'km-bulge-lines-disp'
// The style sheet sizes the scan-line layer by this, set on the tube.
const SPILL = '--km-spill'
const SIZE = 256
const SAMPLES = 2
const SPREAD = 1 / 3
// At this many device pixels to a page pixel and more, one sample is enough.
const FINE = 1.5
// How far the corners are pulled, as a share of the half-diagonal. More than
// this and straight lines of text start to look bent, which a tube's do not.
export const BULGE = 0.03

// The scan lines repeat every LINES pixels (`.km-scan` in the style sheet), and
// the layer spills by a whole number of them, so the lines on the glass
// lie where they would without the spill.
const LINES = 3

// How far past the glass the corners look, and a little over.
const spillFor = (width, height) => LINES * Math.ceil(((Math.max(width, height) / 2) * (BULGE / (1 + BULGE)) + 2) / LINES)

// The maps for a layer that covers the glass (`width` by `height`) and `spill`
// more on every side: one for each sample, the samples spread evenly across
// SPREAD of a pixel apart around no shift at all.
function build(width, height, spill = 0, samples = 1) {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const context = canvas.getContext('2d')
  if (!context) return null
  const image = context.createImageData(SIZE, SIZE)
  const dx = new Float32Array(SIZE * SIZE)
  const dy = new Float32Array(SIZE * SIZE)
  let max = 0
  const wide = width + 2 * spill
  const tall = height + 2 * spill
  // How near the layer's edge it may be looked at. The filter stretches the
  // map, and past the middle of the map's outermost cells it repeats their
  // value, so the limit sits half a cell in (and a little more, for the
  // rounding of an offset into a color).
  const inX = wide / (2 * SIZE) + 0.75
  const inY = tall / (2 * SIZE) + 0.75
  for (let j = 0; j < SIZE; j += 1) {
    for (let i = 0; i < SIZE; i += 1) {
      // Places are measured from the layer's corner; the bulge from the
      // middle of the glass, in half-widths and half-heights of the glass.
      const x = ((i + 0.5) / SIZE) * wide
      const y = ((j + 0.5) / SIZE) * tall
      const u = ((x - spill) / width) * 2 - 1
      const v = ((y - spill) / height) * 2 - 1
      const shift = (1 + BULGE * (u * u + v * v)) / (1 + BULGE) - 1
      const at = j * SIZE + i
      dx[at] = Math.min(Math.max(x + (u * shift * width) / 2, inX), wide - inX) - x
      dy[at] = Math.min(Math.max(y + (v * shift * height) / 2, inY), tall - inY) - y
      max = Math.max(max, Math.abs(dx[at]), Math.abs(dy[at]))
    }
  }
  const scale = 2 * (max + 0.5) || 1
  const hrefs = []
  for (let k = 0; k < samples; k += 1) {
    const nudge = (k - (samples - 1) / 2) * SPREAD
    for (let at = 0; at < SIZE * SIZE; at += 1) {
      image.data[at * 4] = Math.round(255 * (0.5 + (dx[at] + nudge) / scale))
      image.data[at * 4 + 1] = Math.round(255 * (0.5 + (dy[at] + nudge) / scale))
      image.data[at * 4 + 2] = 128
      image.data[at * 4 + 3] = 255
    }
    context.putImageData(image, 0, 0)
    hrefs.push(canvas.toDataURL())
  }
  return { hrefs, scale }
}

// Can this browser bend the screen at all? WebKit draws an feImage that is
// handed a data URL only some of the time, and a filter that fails there
// leaves the screen blank, so it gets the flat picture.
export function canBend() {
  if (typeof navigator === 'undefined' || typeof document === 'undefined') return false
  const agent = navigator.userAgent || ''
  const webkit = /AppleWebKit/.test(agent) && !/Chrome|Chromium|Edg\//.test(agent)
  return !webkit
}

const fit = (mapId, dispId, built, width, height) => {
  if (!built) return false
  for (let k = 0; k < built.hrefs.length; k += 1) {
    const map = document.getElementById(`${mapId}-${k}`)
    const disp = document.getElementById(`${dispId}-${k}`)
    if (!map || !disp) return false
    map.setAttribute('href', built.hrefs[k])
    map.setAttribute('width', width)
    map.setAttribute('height', height)
    disp.setAttribute('scale', built.scale)
  }
  return true
}

const WHOLE = { x: '0', y: '0', width: '100%', height: '100%' }

// A filter is worked out again over its whole area whenever anything under it
// changes, however small the change, and a bend is slow work. So what changes
// many times a second (the words being sung, the tape head's line) is kept out
// of the screen's own layer and bent as a band of its own: a small box with a
// filter that reads the same map, moved so the part of the map over the box is
// the part the box sits under. The map is the larger one, with the spill, so
// a band at the edge of the glass looks past it as the scan lines do.
const bands = new Set()
let fitted = null

const fitBand = (band) => {
  const el = band.ref.current
  if (!fitted || !el) return
  const { screen, built, width, height, spill } = fitted
  const glass = screen.getBoundingClientRect()
  const box = el.getBoundingClientRect()
  if (!glass.width || !box.width) return
  // The page may be drawn at another scale than it is laid out at.
  const unit = width / glass.width
  const x = -(spill + (box.left - glass.left) * unit)
  const y = -(spill + (box.top - glass.top) * unit)
  for (let k = 0; k < built.hrefs.length; k += 1) {
    const map = document.getElementById(`${band.ids.map}-${k}`)
    const disp = document.getElementById(`${band.ids.disp}-${k}`)
    if (!map || !disp) return
    if (map.getAttribute('href') !== built.hrefs[k]) map.setAttribute('href', built.hrefs[k])
    map.setAttribute('x', x)
    map.setAttribute('y', y)
    map.setAttribute('width', width + 2 * spill)
    map.setAttribute('height', height + 2 * spill)
    disp.setAttribute('scale', built.scale)
  }
}

// Keeps a band's filter over the right part of the map: when the band changes
// size (words set at the foot of the picture move up as they grow), and when
// the screen does.
export function useBand(ref, ids, on) {
  useEffect(() => {
    const el = ref.current
    if (!on || !el) return undefined
    const band = { ref, ids }
    bands.add(band)
    fitBand(band)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => fitBand(band))
    observer?.observe(el)
    return () => { observer?.disconnect(); bands.delete(band) }
  }, [ref, ids, on])
}

const samplesHere = () => ((typeof window !== 'undefined' && window.devicePixelRatio >= FINE) ? 1 : SAMPLES)

// One bend filter: a map and a displacement for each sample, and the samples
// averaged in turn (each mix weighs the running average by how many samples
// it holds).
export function BendFilter({ ids, samples, region = WHOLE }) {
  const parts = []
  for (let k = 0; k < samples; k += 1) {
    parts.push(<feImage key={`m${k}`} id={`${ids.map}-${k}`} result={`map${k}`} x="0" y="0" preserveAspectRatio="none" />)
    parts.push(<feDisplacementMap key={`d${k}`} id={`${ids.disp}-${k}`} in="SourceGraphic" in2={`map${k}`} result={`bent${k}`} xChannelSelector="R" yChannelSelector="G" />)
  }
  for (let k = 1; k < samples; k += 1) {
    parts.push(<feComposite key={`a${k}`} in={k === 1 ? 'bent0' : `mix${k - 1}`} in2={`bent${k}`} result={`mix${k}`} operator="arithmetic" k2={k / (k + 1)} k3={1 / (k + 1)} />)
  }
  return (
    <filter id={ids.filter} x={region.x} y={region.y} width={region.width} height={region.height} colorInterpolationFilters="sRGB" primitiveUnits="userSpaceOnUse">
      {parts}
    </filter>
  )
}

// Keeps both filters' maps fitted to the screen while the bend is on, and
// says how many samples the filters take on this screen. A window moved to
// a screen of another density is asked again.
export function useBend(screenRef, on) {
  const [samples, setSamples] = useState(samplesHere)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    let query = null
    const watch = () => {
      setSamples(samplesHere())
      query?.removeEventListener('change', watch)
      query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
      query.addEventListener('change', watch)
    }
    watch()
    return () => query?.removeEventListener('change', watch)
  }, [])
  useEffect(() => {
    const screen = screenRef.current
    if (!on || !screen) return undefined
    let frame = 0
    let last = ''
    const tube = screen.parentElement
    const refit = () => {
      frame = 0
      const width = screen.clientWidth
      const height = screen.clientHeight
      if (!width || !height) return
      const key = `${width}x${height}`
      if (key === last) return
      if (!fit(MAP_ID, DISP_ID, build(width, height, 0, samples), width, height)) return
      const spill = spillFor(width, height)
      const lines = build(width, height, spill, samples)
      fit(LINES_MAP_ID, LINES_DISP_ID, lines, width + 2 * spill, height + 2 * spill)
      tube?.style.setProperty(SPILL, `${spill}px`)
      fitted = lines && { screen, built: lines, width, height, spill }
      bands.forEach(fitBand)
      last = key
    }
    refit()
    const ask = () => { if (!frame) frame = requestAnimationFrame(refit) }
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(ask)
    observer?.observe(screen)
    window.addEventListener('resize', ask)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener('resize', ask)
      tube?.style.removeProperty(SPILL)
      fitted = null
    }
  }, [screenRef, on, samples])
  return samples
}

export const BEND_IDS = { filter: FILTER_ID, map: MAP_ID, disp: DISP_ID }
// The words being sung.
export const WORDS_IDS = { filter: 'km-bulge-words', map: 'km-bulge-words-map', disp: 'km-bulge-words-disp' }
// The words' box is only as large as the lines set in it; the count-in lamps
// stand over it, and the bend moves all of it a little.
export const WORDS_REGION = { x: '-3%', y: '-40%', width: '106%', height: '155%' }
export const LINES_IDS = { filter: LINES_FILTER_ID, map: LINES_MAP_ID, disp: LINES_DISP_ID }

// Keys drawn on the bent screen are drawn where the bend puts them, but a press lands where the
// page laid them out, which near the edges is several pixels away: a key would answer for its
// neighbor. So each such key gets a stand-in laid over the glass, outside the bend, over the place
// the bend draws it, which takes its presses, its pointer's coming and going, and its name, and
// hands them to the key. The key itself is left to be seen, and to be reached from the keyboard.

// Where a point of the page (x, y, measured on the glass) is drawn once the glass is bent: the
// point the bend shows it at. The bend shows at each point the page a little out from it, so this
// is found by going back from the point itself, a few times over.
function bentAt(x, y, width, height) {
  let px = x
  let py = y
  for (let k = 0; k < 6; k += 1) {
    const u = (px / width) * 2 - 1
    const v = (py / height) * 2 - 1
    const shift = (1 + BULGE * (u * u + v * v)) / (1 + BULGE) - 1
    px = x - (u * shift * width) / 2
    py = y - (v * shift * height) / 2
  }
  return [px, py]
}

// The keys inside `selectors` on the bent screen `screenRef`, each with a stand-in in the layer
// `layerRef` (laid over the glass, outside the bend) while `on`.
export function useBentKeys(screenRef, layerRef, on, selectors) {
  useEffect(() => {
    const screen = screenRef.current
    const layer = layerRef.current
    if (!on || !screen || !layer) return undefined
    const stands = new Map()
    let frame = 0
    const place = () => {
      frame = 0
      const glass = screen.getBoundingClientRect()
      const width = screen.clientWidth
      const height = screen.clientHeight
      if (!width || !height) return
      // Measured in the screen's own pixels: the page may be drawn zoomed.
      const sx = glass.width / width
      const sy = glass.height / height
      const keys = [...screen.querySelectorAll(selectors)].filter((key) => {
        const look = getComputedStyle(key)
        if (look.visibility === 'hidden' || look.display === 'none') return false
        // A key in a row that is not up (the full screen's keys between moves) takes nothing.
        const row = key.closest('.km-fullbar')
        return !row || row.hasAttribute('data-shown') || row.matches(':focus-within')
      })
      for (const [key, stand] of stands) if (!keys.includes(key)) { stand.remove(); stands.delete(key) }
      for (const key of keys) {
        let stand = stands.get(key)
        if (!stand) {
          stand = document.createElement('button')
          stand.type = 'button'
          stand.className = 'km-bent-key'
          stand.tabIndex = -1
          stand.setAttribute('aria-hidden', 'true')
          stand.addEventListener('click', (event) => { event.preventDefault(); key.click() })
          stand.addEventListener('pointerenter', () => key.setAttribute('data-hover', ''))
          stand.addEventListener('pointerleave', () => { key.removeAttribute('data-hover'); key.removeAttribute('data-km-press') })
          stand.addEventListener('pointerdown', () => { if (key.getAttribute('aria-disabled') !== 'true') key.setAttribute('data-km-press', '') })
          stand.addEventListener('pointerup', () => key.removeAttribute('data-km-press'))
          stand.addEventListener('pointercancel', () => key.removeAttribute('data-km-press'))
          layer.append(stand)
          stands.set(key, stand)
        }
        const box = key.getBoundingClientRect()
        const left = (box.left - glass.left) / sx
        const top = (box.top - glass.top) / sy
        const right = left + box.width / sx
        const bottom = top + box.height / sy
        const xs = []
        const ys = []
        for (const [x, y] of [[left, top], [right, top], [left, bottom], [right, bottom], [(left + right) / 2, top], [(left + right) / 2, bottom], [left, (top + bottom) / 2], [right, (top + bottom) / 2]]) {
          const [bx, by] = bentAt(x, y, width, height)
          xs.push(bx)
          ys.push(by)
        }
        const l = Math.min(...xs)
        const t = Math.min(...ys)
        stand.style.cssText = `left:${l}px;top:${t}px;width:${Math.max(...xs) - l}px;height:${Math.max(...ys) - t}px`
        const name = key.getAttribute('title') || key.getAttribute('aria-label') || key.textContent.trim()
        if (name) stand.title = name
        else stand.removeAttribute('title')
        stand.style.cursor = getComputedStyle(key).cursor
      }
    }
    const ask = () => { if (!frame) frame = requestAnimationFrame(place) }
    place()
    const sizes = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(ask)
    sizes?.observe(screen)
    const changes = new MutationObserver(ask)
    changes.observe(screen, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-shown', 'class', 'style', 'aria-expanded', 'title', 'aria-label', 'hidden'] })
    window.addEventListener('resize', ask)
    // The full screen's keys slide and fade: placed again as they settle.
    const settle = setInterval(ask, 500)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      sizes?.disconnect()
      changes.disconnect()
      window.removeEventListener('resize', ask)
      clearInterval(settle)
      for (const [key, stand] of stands) { key.removeAttribute('data-hover'); stand.remove() }
      stands.clear()
    }
  }, [screenRef, layerRef, on, selectors])
}
