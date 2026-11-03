import { useLayoutEffect, useRef, useState } from 'react'

// A list whose rows come and go with motion rather than popping: when the
// items change, the rows that are going away are marked "leave" and kept for
// a moment so a theme can fade them out; then they go, the rows that stay
// glide from where they were to where they are now, and the new ones are
// marked "enter" for the theme to bring in, each with its place among them
// (``order``) so they can follow one another in.
//
// The look is the theme's: a row carries ``data-motion`` ("enter", "stay" or
// "leave") and ``--motion-i`` (its order among the entering rows), and the
// theme's stylesheet animates those. A leave must finish within ``leaveMs``.
// With ``enterAfterMove``, the entering rows also get ``--motion-wait`` (the
// glide's length) whenever rows that stay had to move, so a theme can hold
// them back until the others have slid out of their way.
// With reduced motion asked for, rows change at once and nothing glides.

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

// The rows to show for ``items`` after ``prev``: every item, in order, as
// "enter" if it was not there before and "stay" if it was. Rows already
// leaving are not "there".
export function settle(prev, items, keyOf) {
  const had = new Set(prev.filter((r) => r.phase !== 'leave').map((r) => r.key))
  let order = 0
  return (items || []).map((item) => {
    const key = keyOf(item)
    return had.has(key) ? { item, key, phase: 'stay', order: 0 } : { item, key, phase: 'enter', order: order++ }
  })
}

// The rows to show while the ones ``items`` no longer has go: the old rows in
// their places, those that are gone marked "leave", the rest with their new
// content. Null when nothing is going.
export function leaving(prev, items, keyOf) {
  const next = new Map((items || []).map((item) => [keyOf(item), item]))
  const current = prev.filter((r) => r.phase !== 'leave')
  if (current.every((r) => next.has(r.key))) return null
  return current.map((r) => (next.has(r.key) ? { ...r, item: next.get(r.key), phase: 'stay', order: 0 } : { ...r, phase: 'leave' }))
}

export function useListMotion(items, keyOf, { leaveMs = 180, moveMs = 260, enterAfterMove = false } = {}) {
  const [rows, setRows] = useState(() => settle([], items, keyOf))
  const rowsRef = useRef(rows)
  rowsRef.current = rows
  const els = useRef(new Map())
  const before = useRef(null)
  const timer = useRef(0)

  // Where each row is now, for the glide after the change.
  const measure = () => {
    const at = new Map()
    for (const [key, el] of els.current) {
      if (!el?.isConnected) continue
      const box = el.getBoundingClientRect()
      at.set(key, [box.left, box.top])
    }
    return at
  }

  useLayoutEffect(() => {
    clearTimeout(timer.current)
    const prev = rowsRef.current
    const going = reduced() ? null : leaving(prev, items, keyOf)
    if (!going) {
      before.current = reduced() ? null : measure()
      setRows(settle(prev, items, keyOf))
      return undefined
    }
    setRows(going)
    timer.current = setTimeout(() => {
      before.current = measure()
      setRows(settle(going, items, keyOf))
    }, leaveMs)
    return () => clearTimeout(timer.current)
  }, [items])  // eslint-disable-line react-hooks/exhaustive-deps

  // The rows that stayed glide from where they were.
  useLayoutEffect(() => {
    const was = before.current
    before.current = null
    if (!was) return
    let moved = false
    for (const row of rows) {
      if (row.phase !== 'stay') continue
      const el = els.current.get(row.key)
      if (!el || !was.has(row.key) || typeof el.animate !== 'function') continue
      // Across as well as down: in a grid a row can move to the next column.
      const box = el.getBoundingClientRect()
      const [x, y] = was.get(row.key)
      const dx = x - box.left
      const dy = y - box.top
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue
      moved = true
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
                 { duration: moveMs, easing: 'cubic-bezier(0.2, 0, 0, 1)' })
    }
    if (!enterAfterMove) return
    for (const row of rows) {
      if (row.phase === 'enter') els.current.get(row.key)?.style.setProperty('--motion-wait', moved ? `${moveMs}ms` : '0ms')
    }
  }, [rows])  // eslint-disable-line react-hooks/exhaustive-deps

  // A row's attributes: its element, its phase, and its order among the
  // entering rows. ``style`` merges with a row's own.
  const bind = (row, style) => ({
    ref: (el) => { if (el) els.current.set(row.key, el); else els.current.delete(row.key) },
    'data-motion': row.phase,
    'aria-hidden': row.phase === 'leave' || undefined,
    style: { ...style, '--motion-i': row.order },
  })
  return { rows, bind }
}
