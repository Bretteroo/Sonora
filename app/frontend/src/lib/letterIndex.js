import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { api } from './api.js'

// The logic behind a theme's alphabet bar; each theme draws the bar itself.
//
// The bar is for long lists only, and only for lists that really are in
// alphabetical order: a jump means nothing in Recently Added. Where each
// letter starts comes from the service (SMAPI getScrollIndices; Plex answers
// for its artists and albums) or the speakers (their library), and failing
// both from the rows themselves, when the rows read so far are in order.
// Lists load a page at a time, so a jump past the rows in hand asks for the
// next pages until the letter is reached.

export const LETTERS = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']
// Fewer rows than this scroll well enough on their own.
export const LONG_LIST = 50

const ARTICLES = /^(the|a|an)\s+/i
const fold = (text) => (text || '').normalize('NFD').replace(/[̀-ͯ]/g, '')

// The letter a title files under, '#' for anything that is not A to Z.
export function letterOf(title, skipArticles = false) {
  let text = fold(title).trim()
  if (skipArticles) text = text.replace(ARTICLES, '')
  const c = text.charAt(0).toUpperCase()
  return c >= 'A' && c <= 'Z' ? c : '#'
}
const rank = (letter) => LETTERS.indexOf(letter)

// How a run of titles is filed: in letter order as written, in order once a
// leading "The" is dropped (Plex files The Clash under C), or not in order
// at all. A stray row or two out of place still counts as ordered.
export function filing(titles) {
  if (titles.length < 2) return null
  const ordered = (skip) => {
    let back = 0
    for (let i = 1; i < titles.length; i++) {
      if (rank(letterOf(titles[i], skip)) < rank(letterOf(titles[i - 1], skip))) back++
    }
    return back <= Math.max(1, Math.floor(titles.length * 0.02))
  }
  if (ordered(true)) return { skip: true }
  if (ordered(false)) return { skip: false }
  return null
}

// For one list: whether to show a bar, the letters on it and which of them
// the list holds, a `jump` that brings a letter's first row into view, and
// `pending` while a letter asked for is still being read.
// `rows` are the rows in hand (in the order drawn) and `offset` the place of
// the first of them in the whole list, `total` the list's length as the
// service gave it, `more` asks for the next page, `done` says there is none,
// and `jumpTo(i)` starts the list again at row i. `source` names where an
// index might come from: { sid, item, account, zone } for a service,
// { library: objectId, zone } for the speakers' own lists. `scrollTo(i)` is
// the theme's: it brings row i of the rows in hand into view, and `rowsOf()`
// gives those rows as drawn, so the letter pressed can be unmarked once the
// reader scrolls out of its rows.
//
// A letter the service has placed past the rows in hand is reached with one
// request: the list starts again at that letter's row. A letter worked out
// from the rows can only be found by reading on, a page at a time.
export function useLetterIndex({ rows, offset = 0, total = 0, more, done, jumpTo, source, scrollTo, rowsOf }) {
  const [given, setGiven] = useState(null)
  const sourceKey = source ? JSON.stringify(source) : ''
  const long = Math.max(total || 0, offset + rows.length) > LONG_LIST

  useEffect(() => {
    setGiven(null)
    if (!source || !long) return undefined
    let canceled = false
    const ask = source.library
      ? api.libraryLetters(source.library, { zone: source.zone })
      : source.sid ? api.serviceLetters(source.sid, { zone: source.zone, item: source.item, account: source.account || '' }) : null
    if (!ask) return undefined
    ask.then((r) => { if (!canceled) setGiven(r?.letters?.length ? r.letters : []) })
      .catch(() => { if (!canceled) setGiven([]) })
    return () => { canceled = true }
  }, [sourceKey, long]) // eslint-disable-line react-hooks/exhaustive-deps

  const placed = Boolean(given?.length)
  const titles = useMemo(() => rows.map((row) => row.title || ''), [rows])
  const filed = useMemo(() => (placed ? null : filing(titles)), [placed, titles])

  // letter -> its first row in the whole list, for the letters known so far.
  const starts = useMemo(() => {
    const at = new Map()
    if (placed) {
      for (const { letter, index } of given) {
        const key = LETTERS.includes(letter.toUpperCase()) ? letter.toUpperCase() : '#'
        if (!at.has(key)) at.set(key, index)
      }
    } else if (filed) {
      titles.forEach((title, i) => {
        const key = letterOf(title, filed.skip)
        if (!at.has(key)) at.set(key, offset + i)
      })
    }
    return at
  }, [placed, given, filed, titles, offset])

  // Whether the whole list is known: the service said, or every row is in.
  const complete = placed || (done && offset === 0 && rows.length >= (total || 0))
  const show = long && given !== null && (placed || Boolean(filed))

  // Only the latest letter asked for is chased, so a drag down the bar asks
  // for no more than the letter it ends on.
  const wanted = useRef(null)
  const jumping = useRef(null)
  const [active, setActive] = useState('')
  // A letter asked for and not reached yet: the bar shows it is on its way.
  const [pending, setPending] = useState(false)
  const settle = useCallback(() => {
    const letter = wanted.current
    if (!letter) return
    const later = () => LETTERS.slice(rank(letter) + 1).map((l) => starts.get(l)).find((i) => i != null)
    let target = starts.get(letter)
    // Not in the list: its place is where the next letter that is starts
    // (else the end), once the list is known; working from the rows, a
    // later letter already in hand says the same.
    if (target == null && (complete || !placed)) target = later()
    if (target == null && complete) target = Math.max(0, (total || offset + rows.length) - 1)
    if (target != null && target >= offset && target < offset + rows.length) {
      wanted.current = null
      jumping.current = null
      setPending(false)
      scrollTo(target - offset)
      return
    }
    if (target != null && placed && jumpTo) {
      // Rows read before come back at once, and the next pass scrolls to them;
      // anything else is on its way, and the bar says so.
      if (jumping.current !== target) {
        jumping.current = target
        if (jumpTo(target)) return
      }
      setPending(true)
      return
    }
    if (!done) { more?.(); setPending(true) } else {
      wanted.current = null
      setPending(false)
      if (rows.length) scrollTo(rows.length - 1)
    }
  }, [starts, complete, placed, total, offset, rows.length, done, more, jumpTo, scrollTo])
  useEffect(() => { settle() }, [settle])

  // The letter pressed stays marked while the rows at the top of the list
  // are its own, and the mark goes once the reader scrolls out of them.
  // `rowsOf()` gives the rows as drawn, in list order.
  const sectionAt = useCallback((i) => {
    if (placed) {
      let at = ''
      for (const [letter, start] of [...starts.entries()].sort((a, b) => a[1] - b[1])) { if (start <= i) at = letter; else break }
      return at
    }
    return filed ? letterOf(titles[i - offset] || '', filed.skip) : ''
  }, [placed, starts, filed, titles, offset])
  useEffect(() => {
    if (!active || pending || !rowsOf) return undefined
    const first = rowsOf()?.[0]
    if (!first) return undefined
    const pane = scrollPaneOf(first.parentElement)
    const page = pane === document.scrollingElement || pane === document.documentElement
    let frame = 0
    const check = () => {
      frame = 0
      const top = page ? 0 : pane.getBoundingClientRect().top
      const list = rowsOf() || []
      let i = 0
      while (i < list.length && list[i].getBoundingClientRect().bottom <= top + 1) i++
      if (i < list.length && sectionAt(offset + i) !== active) setActive('')
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(check) }
    const target = page ? window : pane
    target.addEventListener('scroll', onScroll, { passive: true })
    return () => { target.removeEventListener('scroll', onScroll); if (frame) cancelAnimationFrame(frame) }
  }, [active, pending, rowsOf, sectionAt, offset])

  const jump = useCallback((letter) => {
    wanted.current = letter
    jumping.current = null
    setActive(letter)
    settle()
  }, [settle])

  const letters = LETTERS.map((letter) => ({
    letter,
    // Dimmed only when the list is known not to hold it.
    present: !complete || starts.has(letter),
  }))
  return { show, letters, jump, active, pending }
}

// Pointer handling for a bar, with the Dock's magnification: the letters
// near the pointer grow and push the others closer together, the bar's
// length unchanged, and settle back when the pointer leaves. Each letter's
// element gets --mag (1 at rest, up to MAGNIFY under the pointer) as its
// flex-grow, and the theme sizes its letter by it. A press on a letter jumps
// there, and a drag along the bar jumps to each letter it passes, as a
// phone's index does. The letter is the one drawn under the pointer, as the
// reader sees the bar, and the growth is centred on it, so it stays under
// the pointer as it grows. A letter's own click handler should act only on a
// keyboard's click (event.detail 0): the press has already been taken here.
// Spread the result on the bar's element; each letter's element carries
// data-letter.
const MAGNIFY = 1.9
const REACH = 2.6 // letters either side that grow
function magnify(bar, clientX, clientY) {
  const keys = [...bar.querySelectorAll('[data-letter]')]
  if (!keys.length) return null
  // The letter drawn under the pointer, or failing that (a gap between two)
  // the nearest one.
  const box = bar.getBoundingClientRect()
  let key = document.elementFromPoint(box.left + box.width / 2, clientY)?.closest?.('[data-letter]')
  if (!key || !bar.contains(key)) {
    let best = Infinity
    for (const k of keys) {
      const r = k.getBoundingClientRect()
      const d = Math.abs((r.top + r.bottom) / 2 - clientY)
      if (d < best) { best = d; key = k }
    }
  }
  const i = keys.indexOf(key)
  const r = key.getBoundingClientRect()
  const at = i + Math.min(1, Math.max(0, (clientY - r.top) / Math.max(1, r.height)))
  keys.forEach((k, j) => {
    const d = Math.abs(j + 0.5 - at) / REACH
    const m = d >= 1 ? 1 : 1 + ((MAGNIFY - 1) * (Math.cos(d * Math.PI) + 1)) / 2
    k.style.setProperty('--mag', m.toFixed(3))
    k.style.flexGrow = m.toFixed(3)
  })
  return key
}
function rest(bar) {
  for (const key of bar.querySelectorAll('[data-letter]')) { key.style.removeProperty('--mag'); key.style.flexGrow = '' }
}
const still = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches

export function useLetterDrag(jump) {
  const dragging = useRef(false)
  const last = useRef('')
  const go = (event) => {
    const key = magnify(event.currentTarget, event.clientX, event.clientY)
    const letter = key?.dataset?.letter
    if (dragging.current && letter && !key.disabled && letter !== last.current) { last.current = letter; jump(letter) }
  }
  return {
    onPointerDown: (event) => {
      dragging.current = true
      last.current = ''
      event.currentTarget.setPointerCapture?.(event.pointerId)
      go(event)
      event.preventDefault()
    },
    onPointerMove: go,
    onPointerUp: (event) => { dragging.current = false; if (still || event.pointerType !== 'mouse') rest(event.currentTarget) },
    onPointerCancel: (event) => { dragging.current = false; rest(event.currentTarget) },
    onPointerLeave: (event) => { if (!dragging.current) rest(event.currentTarget) },
  }
}

// Where a bar sits beside a list's scroller: the scroller's top, height and
// inner right edge (clear of its scrollbar) within their positioned parent,
// kept current as the page above changes height or the window resizes. A
// bar or header the scroller holds at its top (`below`, a selector) is left
// uncovered.
export function useAlongside(ref, { below = '' } = {}) {
  const [box, setBox] = useState(null)
  const read = useCallback(() => {
    const el = ref.current
    const parent = el?.offsetParent
    if (!el || !parent) return
    const head = below ? el.querySelector(below) : null
    const skip = head ? head.offsetHeight : 0
    const next = {
      top: el.offsetTop + el.clientTop + skip,
      height: el.clientHeight - skip,
      right: parent.clientWidth - (el.offsetLeft + el.clientLeft + el.clientWidth),
    }
    setBox((prev) => (prev && prev.top === next.top && prev.height === next.height && prev.right === next.right ? prev : next))
  }, [ref, below])
  useLayoutEffect(read)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const watch = new ResizeObserver(read)
    watch.observe(el)
    return () => watch.disconnect()
  }, [ref, read])
  return box
}

// How much an element is drawn larger or smaller than its CSS size, by a
// zoom or a transform on it or above it (Severed scales its whole screen).
// Sizes read off the screen are divided by this before being set as CSS.
export function scaleOf(el) {
  if (!el?.offsetWidth) return 1
  return el.getBoundingClientRect().width / el.offsetWidth || 1
}

// The pane that scrolls an element: the element itself when it scrolls,
// else its nearest ancestor that does, else the page.
export function scrollPaneOf(el) {
  for (let pane = el; pane && pane !== document.body; pane = pane.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(pane).overflowY)) return pane
  }
  return document.scrollingElement || document.documentElement
}

// Keeps the reader's place when rows arrive above the ones showing (a jump's
// list growing back up): the pane that scrolls the list moves down by what
// was added, so the row in view stays put. The browser's own scroll
// anchoring does this only sometimes (not over Liquid Glass's tiles), so it
// is turned off there and done by hand, which also keeps the two from both
// moving it. `ref` is the list or anything inside the pane.
export function useKeepPlace(ref, offset) {
  const last = useRef({ offset, height: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const pane = scrollPaneOf(el)
    pane.style.overflowAnchor = 'none'
    const prev = last.current
    if (offset < prev.offset && prev.height) pane.scrollTop += pane.scrollHeight - prev.height
    last.current = { offset, height: pane.scrollHeight }
  })
}

// How tall a bar held in view with position: sticky may be: from where the
// bar starts (or the top of the pane that scrolls it, once it has stuck
// there) to the foot of that pane, less `reserve` for what sits over the
// foot, at most `max`. Read on every render, as the pane scrolls and when
// the window is resized.
export function useRailHeight(ref, { reserve = 0, max = 640, min = 160 } = {}) {
  const [height, setHeight] = useState(0)
  const measure = useCallback(() => {
    const el = ref.current
    if (!el) return
    const pane = scrollPaneOf(el.parentElement)
    const page = pane === document.scrollingElement || pane === document.documentElement
    const box = page ? { top: 0, bottom: window.innerHeight } : pane.getBoundingClientRect()
    const top = Math.max(box.top, el.getBoundingClientRect().top)
    // The span is read on the screen and set in CSS pixels: under a zoom the
    // two differ, and an unscaled height came out short (Severed).
    const scale = scaleOf(el.parentElement)
    const next = Math.round(Math.max(min, Math.min(max, (box.bottom - top) / scale - reserve)))
    setHeight((prev) => (prev === next ? prev : next))
  }, [ref, reserve, max, min])
  useLayoutEffect(measure)
  useEffect(() => {
    const el = ref.current
    const pane = el ? scrollPaneOf(el.parentElement) : null
    const target = !pane || pane === document.scrollingElement || pane === document.documentElement ? window : pane
    target.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    return () => { target.removeEventListener('scroll', measure); window.removeEventListener('resize', measure) }
  }, [ref, measure])
  return height
}

// The letters a bar of `slots` places shows: all of them when they fit, else
// letters spread evenly from # to Z with a dot in each gap, as a phone's index
// shortens itself. A dot stands for the letters it hides, and a press or a
// drag over it goes to the middle one (its `letter`).
export function fitLetters(letters, slots) {
  if (!slots || letters.length <= slots) return letters
  const keep = Math.max(2, Math.floor((slots + 1) / 2))
  const at = Array.from({ length: keep }, (_, k) => Math.round((k * (letters.length - 1)) / (keep - 1)))
  const out = []
  at.forEach((i, k) => {
    if (k) {
      const prev = at[k - 1]
      if (i - prev > 1) {
        const hidden = letters.slice(prev + 1, i)
        const mid = hidden[Math.floor(hidden.length / 2)]
        out.push({ ...mid, dot: true, present: hidden.some((l) => l.present) })
      }
    }
    out.push(letters[i])
  })
  return out
}
