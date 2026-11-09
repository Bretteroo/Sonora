import { useEffect, useLayoutEffect, useRef } from 'react'

// Where each page was scrolled to, kept for going back to it. A page opened
// starts at its top; a page gone back to opens where it was left, as the S1
// Windows app does (measured 2026-11-08). Going back used to start every
// list at its top again.
//
// `page` is the object the theme holds for the page on its path (a node, a
// view), so a page opened afresh, even one with the same id, starts at the
// top, and only the one returned to is put back. `scrollerOf` returns the
// element the page scrolls in, asked each time, since a theme may scroll in a
// different box at another width.
const kept = new WeakMap()

// The rows of a page gone back to come from what was kept and draw at once;
// a page that has to be read again grows as it arrives, so the place is put
// back once the list is tall enough, for up to about a second.
const PATIENCE = 60

// The box that scrolls: the one given, or the nearest one around it that
// does, since a theme's list often sits in a page that its shell scrolls.
function scrolling(el) {
  for (let box = el; box && box !== document.body; box = box.parentElement) {
    if (/auto|scroll/.test(getComputedStyle(box).overflowY)) return box
  }
  return el
}

export function useKeptScroll(scrollerOf, page) {
  const current = useRef(page)
  const restoring = useRef(false)
  const of = useRef(scrollerOf)
  of.current = () => scrolling(scrollerOf())

  // Note the place as it is scrolled. While a place is being put back the
  // list may not yet reach it, and the clamped position is not the reader's.
  useEffect(() => {
    const el = of.current?.()
    if (!el) return undefined
    const note = () => {
      const p = current.current
      if (!restoring.current && p && typeof p === 'object') kept.set(p, el.scrollTop)
    }
    el.addEventListener('scroll', note, { passive: true })
    return () => el.removeEventListener('scroll', note)
  })

  useLayoutEffect(() => {
    current.current = page
    const el = of.current?.()
    if (!el) return undefined
    const want = page && typeof page === 'object' ? kept.get(page) : undefined
    if (!want) { restoring.current = false; el.scrollTop = 0; return undefined }
    restoring.current = true
    let frames = 0
    let raf = 0
    const step = () => {
      const box = of.current?.()
      if (!box) { restoring.current = false; return }
      const reach = box.scrollHeight - box.clientHeight
      box.scrollTop = Math.min(want, Math.max(0, reach))
      // Held for a couple of frames even when reached: the first may still
      // show the page just left, before the kept rows draw in its place.
      if ((reach >= want && frames >= 2) || frames >= PATIENCE) { restoring.current = false; return }
      frames += 1
      raf = requestAnimationFrame(step)
    }
    step()
    return () => { cancelAnimationFrame(raf); restoring.current = false }
  }, [page])
}
