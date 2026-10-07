import { useEffect } from 'react'

// Where a More menu opens.
//
// The product draws these over everything -- open the More on a track and the
// menu lies across Your System, outside the browse column that would clip it
// -- so the menu is fixed and the page anchors it to the button: its left
// edge a few pixels left of the button's, its top just under it (measured on
// play.sonos.com 2026-09-20).

const WIDTH = 280
const HEIGHT = 76

export function anchorOf(event) {
  const box = event.currentTarget.getBoundingClientRect()
  return { left: Math.round(box.left - 4), top: Math.round(box.bottom + 6) }
}

export function menuAt(anchor) {
  if (!anchor) return undefined
  const room = typeof window === 'undefined' ? null : window
  const left = room ? Math.min(anchor.left, room.innerWidth - WIDTH) : anchor.left
  const top = room ? Math.min(anchor.top, room.innerHeight - HEIGHT) : anchor.top
  return { left: `${Math.max(8, left)}px`, top: `${Math.max(8, top)}px` }
}

// A menu that opens upward from its button, which is how the player's options
// open: the product's panel sits with its bottom 8px above the disc and its
// left edge at the disc's (measured 2026-09-21).
export function anchorAbove(event) {
  const box = event.currentTarget.getBoundingClientRect()
  return { left: Math.round(box.left), bottom: Math.round(box.top) }
}

export function menuAbove(anchor, width = 350) {
  if (!anchor) return undefined
  const room = typeof window === 'undefined' ? null : window
  const left = room ? Math.min(anchor.left, room.innerWidth - width - 8) : anchor.left
  const bottom = room ? Math.max(8, room.innerHeight - anchor.bottom + 8) : 8
  return { left: `${Math.max(8, left)}px`, bottom: `${bottom}px`, top: 'auto' }
}

// A panel that opens beside the row that asked for it, which is where the
// player's sleep durations go: its top on the row's top and its left 19px
// inside the parent panel's right edge (measured 2026-09-21). It climbs
// rather than run off the foot of the window.
export function menuBeside(anchor, height, width = 264) {
  if (!anchor) return undefined
  const room = typeof window === 'undefined' ? null : window
  let left = Math.round(anchor.right) - 19
  let top = Math.round(anchor.top)
  if (room) {
    if (left + width > room.innerWidth - 8) left = room.innerWidth - width - 8
    if (top + height > room.innerHeight - 8) top = room.innerHeight - height - 8
  }
  return { left: `${Math.max(8, left)}px`, top: `${Math.max(8, top)}px`, bottom: 'auto' }
}

// A More menu closes the way the product's do: Escape, or a press anywhere
// outside it and outside the button that opened it (measured 2026-09-28;
// Sonora's stayed open until the button was pressed again).

export function useDismiss(open, close) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => { if (event.key === 'Escape') close() }
    const onDown = (event) => {
      if (!event.target.closest?.('.wb-item-menu, .wb-item-more, .wb-queue-menu')) close()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open, close])
}
