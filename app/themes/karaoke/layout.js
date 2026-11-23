import { useEffect, useState } from 'react'

// How much of the machine a window has room for. Wide: the cabinet with a
// microphone hanging either side of it. Mid: the same cabinet, a little
// tighter. Compact: a phone held upright, where the screen sits above a
// two-row faceplate and the microphones hang beside the buttons. A phone
// held sideways is compact too: it has the width for a desktop's faceplate
// only at a size no finger could work.
export function sizeClass(width, height) {
  if (width < 760 || (height < 520 && width < 1000)) return 'compact'
  if (width < 1180 || height < 640) return 'mid'
  return 'wide'
}

// Everything the machine shows is drawn on its screen, windows, menus, and
// tooltips included, and the screen is a box of its own inside the page: a
// thing fixed in place there is fixed to the screen, not to the window. So
// whatever the theme measures (a control's box, where a pointer came down,
// how much room there is) is measured from the screen's corner and against
// the screen's size. These do that; the shell names the screen once it is
// drawn.
let screen = null
export function setScreen(el) {
  screen = el
  measure()
}

function box() {
  if (screen?.isConnected) return screen.getBoundingClientRect()
  return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }
}

export const ptX = (value) => (value == null ? value : value - box().left)
export const ptY = (value) => (value == null ? value : value - box().top)
export const viewW = () => box().width
export const viewH = () => box().height
export function rectOf(el) {
  if (!el) return undefined
  const r = el.getBoundingClientRect()
  const b = box()
  const left = r.left - b.left
  const top = r.top - b.top
  return { x: left, y: top, left, top, right: left + r.width, bottom: top + r.height, width: r.width, height: r.height }
}

// The sheet sizes windows and menus in hundredths of the screen (--km-vw,
// --km-vh), where another theme would use the window's.
function measure() {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const b = box()
  root.style.setProperty('--km-vw', `${b.width / 100}px`)
  root.style.setProperty('--km-vh', `${b.height / 100}px`)
}

export function useSize() {
  const read = () => (typeof window === 'undefined' ? 'wide' : sizeClass(window.innerWidth, window.innerHeight))
  const [size, setSize] = useState(read)
  useEffect(() => {
    const on = () => { measure(); setSize(read()) }
    on()
    window.addEventListener('resize', on)
    return () => {
      window.removeEventListener('resize', on)
      document.documentElement.style.removeProperty('--km-vw')
      document.documentElement.style.removeProperty('--km-vh')
    }
  }, [])
  return size
}

// Keeps the screen's measures current as it changes size without the window
// doing so (the full-screen button, a phone's address bar).
export function watchScreen(el) {
  if (!el || typeof ResizeObserver === 'undefined') return () => {}
  const observer = new ResizeObserver(measure)
  observer.observe(el)
  return () => observer.disconnect()
}

// Where windows, menus, and tooltips are drawn: a layer of the screen, so
// they bend with the glass and take its scan lines like everything else.
export const overlayRoot = () => document.getElementById('km-over') || document.body
