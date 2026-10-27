import React, { useEffect, useRef } from 'react'

// The foot of a paged list. When it scrolls into view (or is in view when
// another page lands, as a short page on a tall window leaves it) it asks
// for the next page. It takes no room and shows nothing; the list grows.
export default function MoreRows({ onMore, count }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !onMore || typeof IntersectionObserver === 'undefined') return undefined
    const watch = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) onMore()
    })
    watch.observe(el)
    return () => watch.disconnect()
  }, [onMore, count])
  return <div ref={ref} data-more-rows="" aria-hidden="true" style={{ height: 1, width: '100%', gridColumn: '1 / -1', flexShrink: 0 }} />
}
