// How much the rack is zoomed, and measuring through it.
//
// The rack is zoomed in two cases (index.jsx, useDesktopMode): a phone's
// browser asking for the desktop site, and a window too short for the rack,
// where the control amplifier takes most of the height and the bay under it
// shrinks to a strip. There, driven by a mouse or trackpad, the rack is drawn
// at TALL pixels high and scaled down to the window, so the amplifier takes
// the share of it that it does in a window TALL high. Only in a window wider
// than WIDE: below it hifi.css's width steps restack the amplifier, and they
// read the window's own width, so they would take the zoomed rack for a
// narrow one. Between WIDE and the widest step they repeat the full layout.

// Under CSS zoom, or the body's transform where it is used instead, the
// browser measures (getBoundingClientRect, a pointer's clientX and clientY,
// innerWidth and innerHeight) in the window's own pixels while the rack's
// styles are in its zoomed ones. Whatever Hi-Fi measures to place something
// goes through these.

const TALL = 830
const WIDE = 1200
const LEAST = 0.6

let current = 1
export const zoom = () => current
export const pt = (value) => (value == null ? value : value / current)
export const viewW = () => window.innerWidth / current
export const viewH = () => window.innerHeight / current
export function rectOf(el) {
  if (!el) return undefined
  const r = el.getBoundingClientRect()
  const z = current
  if (z === 1) return r
  return { x: r.x / z, y: r.y / z, left: r.left / z, top: r.top / z, right: r.right / z, bottom: r.bottom / z, width: r.width / z, height: r.height / z }
}

// The short-window case: how far the window is scaled, or 0.
export function shortScreenZoom() {
  if (typeof window === 'undefined') return 0
  const height = window.innerHeight
  if (height >= TALL || window.innerWidth <= WIDE) return 0
  if (!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return 0
  return Math.max(LEAST, height / TALL)
}

// Safari will not draw text zoomed below 9 pixels: a 9px label at 0.7 stays 9
// pixels on the screen and outgrows its box. There the rack is scaled with a
// transform on the body instead, the same sizes in the same proportion. Asked
// of the browser rather than guessed from its name.
let floored = null
function textHasFloor() {
  if (floored === null) {
    const probe = document.createElement('div')
    probe.style.cssText = 'position:absolute;visibility:hidden;zoom:0.5;font-size:10px'
    document.body.appendChild(probe)
    floored = parseFloat(getComputedStyle(probe).fontSize) > 10.5
    probe.remove()
  }
  return floored
}

// Puts the zoom on the page (1 takes it off), with the zoomed window's size
// for the sheet's stand-ins for viewport units (--hf-vw, --hf-vh).
export function applyZoom(z) {
  const root = document.documentElement
  const body = document.body
  current = z || 1
  const scaled = current !== 1 && textHasFloor()
  root.style.zoom = current === 1 || scaled ? '' : String(current)
  if (scaled) {
    Object.assign(body.style, { width: `${viewW()}px`, height: `${viewH()}px`, transform: `scale(${current})`, transformOrigin: '0 0', overflow: 'hidden' })
  } else {
    for (const name of ['width', 'height', 'transform', 'transformOrigin', 'overflow']) body.style[name] = ''
  }
  if (current === 1) { root.style.removeProperty('--hf-vw'); root.style.removeProperty('--hf-vh') }
  else { root.style.setProperty('--hf-vw', `${viewW() / 100}px`); root.style.setProperty('--hf-vh', `${viewH() / 100}px`) }
}
