import { useEffect, useState } from 'react'

// How much of the console a window has room for. Wide: the screen with a
// wing of keys either side and the keyboard deck under it. Mid: the wings
// fold away and their keys join the deck. Compact: a phone, held upright,
// becomes a handheld terminal -- the screen above, a short deck below.
export function sizeClass(width, height) {
  if (width < 760) return 'compact'
  if (width < 1180 || height < 640) return 'mid'
  return 'wide'
}

// A laptop's screen is often too short for the whole console: at a screen of 1440 by 900 the
// window is about 780 tall, and the grille, the drive bay, the reaction keys, and the screen's
// queue and mixer give way one by one. On a short screen driven by a mouse or trackpad, the
// wide console is drawn whole at TALL pixels high and scaled down to the window with CSS zoom,
// which lays the text out again at the smaller size rather than shrinking a picture of it (or,
// where the browser will not zoom text that small, with a transform: see setScale). A
// screen at least SHORT_SCREEN tall, a touch screen, or a window too narrow for the wide console
// even scaled down keeps the console at its own size.
const TALL = 1140
const SHORT_SCREEN = 1000
const LEAST = 0.6
// The window heights at which pieces of the wide console give way (severed.css, data-sv-short).
const STEPS = [1135, 1030, 975, 945, 885]

let current = 1
// Under CSS zoom or the body's transform, the browser measures (getBoundingClientRect, a pointer's clientX and clientY,
// innerWidth and innerHeight) in the window's own pixels, but the console's styles are in its
// zoomed ones. Whatever Severed measures goes through these, so it works in the console's.
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

function scaleFor(width, height) {
  if (typeof window === 'undefined') return 1
  if (height >= TALL) return 1
  const fine = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches
  if (!fine || (window.screen?.height || 0) >= SHORT_SCREEN) return 1
  // The wide console needs its width in its own pixels, so scaled down it holds on in a window
  // narrower than it could at its own size.
  const z = Math.max(LEAST, height / TALL)
  return sizeClass(width / z, height / z) === 'wide' ? z : 1
}

// Safari will not draw text zoomed below 9 pixels: a 9px label at 0.68 stays 9 pixels on the
// screen and outgrows the panel it was set in. There the console is scaled with a transform on
// the body instead, which keeps the same sizes in the same proportion. Asked of the browser, not
// guessed from its name: a 10px line zoomed by half comes out at 5 pixels, or at that floor.
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

function setScale(root, z) {
  const body = document.body
  const scaled = z !== 1 && textHasFloor()
  root.style.zoom = z === 1 || scaled ? '' : String(z)
  if (scaled) {
    Object.assign(body.style, { width: `${viewW()}px`, height: `${viewH()}px`, transform: `scale(${z})`, transformOrigin: '0 0', overflow: 'hidden' })
  } else {
    for (const name of ['width', 'height', 'transform', 'transformOrigin', 'overflow']) body.style[name] = ''
  }
}

// Sets the zoom on the page, the zoomed window's size, the steps it is short of, and tells
// whoever keeps a measure in device pixels (sonora:svzoom).
function apply() {
  const root = document.documentElement
  const z = scaleFor(window.innerWidth, window.innerHeight)
  const changed = z !== current
  current = z
  setScale(root, z)
  // Viewport units shrink with the zoom too; the sheet's stand-ins for them are the zoomed window's.
  if (z === 1) { root.style.removeProperty('--sv-vw'); root.style.removeProperty('--sv-vh') }
  else { root.style.setProperty('--sv-vw', `${viewW() / 100}px`); root.style.setProperty('--sv-vh', `${viewH() / 100}px`) }
  const h = window.innerHeight / z
  const short = STEPS.filter((step) => h <= step).join(' ')
  if (short) root.dataset.svShort = short
  else delete root.dataset.svShort
  if (changed) window.dispatchEvent(new Event('sonora:svzoom'))
}

export function useSize() {
  const read = () => (typeof window === 'undefined' ? 'wide' : sizeClass(viewW(), viewH()))
  const [size, setSize] = useState(() => { if (typeof window !== 'undefined') apply(); return read() })
  useEffect(() => {
    const on = () => { apply(); setSize(read()) }
    on()
    window.addEventListener('resize', on)
    return () => {
      window.removeEventListener('resize', on)
      current = 1
      setScale(document.documentElement, 1)
      document.documentElement.style.removeProperty('--sv-vw')
      document.documentElement.style.removeProperty('--sv-vh')
      delete document.documentElement.dataset.svShort
    }
  }, [])
  return size
}
