import { useEffect, useRef, useState } from 'react'

// Which edges a sideways row carries on past.
//
// The product dims a row into the page wherever there is more of it beyond
// an edge: the service half off the right dims away, and the left one does
// the same once the row has been scrolled (play.sonos.com, 2026-09-19). The
// services row on the home and the filter pills over search results are both
// drawn that way.
export default function useEdgeFade(watch = []) {
  const ref = useRef(null)
  const [edges, setEdges] = useState({ left: false, right: false })
  useEffect(() => {
    const node = ref.current
    if (!node) return undefined
    const measure = () => {
      const over = node.scrollWidth - node.clientWidth
      const at = node.scrollLeft
      setEdges({ left: at > 1, right: over > 1 && at < over - 1 })
    }
    measure()
    node.addEventListener('scroll', measure, { passive: true })
    // A narrower window, or a pill added or dropped, changes whether there
    // is anything past the edge.
    const watcher = typeof ResizeObserver === 'function'
      ? new ResizeObserver(measure) : null
    watcher?.observe(node)
    return () => {
      node.removeEventListener('scroll', measure)
      watcher?.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, watch)
  return [ref, edges]
}
