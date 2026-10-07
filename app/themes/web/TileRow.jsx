import React, { useEffect, useState } from 'react'

// One line of tiles, as many as the width takes.
//
// The product's tile sections are one row deep and no more: six at a browse
// column of 1044, four at 788, ten at 1730, and the rest behind View All
// (measured 2026-09-19 by zooming its own window). The grid's auto-fill does
// the counting; this reads the answer back so the extra items are never
// rendered rather than clipped.

export function useRowFit(node, min = 150, gap = 16) {
  const [fits, setFits] = useState(6)
  useEffect(() => {
    if (!node) return undefined
    const measure = () => {
      const width = node.getBoundingClientRect().width
      if (width > 0) setFits(Math.max(1, Math.floor((width + gap) / (min + gap))))
    }
    measure()
    const watcher = typeof ResizeObserver === 'function'
      ? new ResizeObserver(measure) : null
    watcher?.observe(node)
    return () => watcher?.disconnect()
  }, [node, min, gap])
  return fits
}

export default function TileRow({ items, render, className = 'wb-tiles' }) {
  const [node, setNode] = useState(null)
  const fits = useRowFit(node)
  return (
    <div className={className} ref={setNode}>
      {items.slice(0, fits).map(render)}
    </div>
  )
}
