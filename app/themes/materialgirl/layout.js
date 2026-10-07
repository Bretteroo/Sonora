import { useEffect, useState } from 'react'

// M3's window size classes, which decide the navigation and how many panes a
// page shows: compact under 600dp (a phone held upright), medium to 840
// (a tablet, a folded phone opened), expanded to 1200, large to 1600 and
// extra-large beyond (Material's five classes; xlarge lays out as large).
export const BREAKS = { medium: 600, expanded: 840, large: 1200, xlarge: 1600 }

// Large and extra-large lay a window out alike.
export const isLarge = (size) => size === 'large' || size === 'xlarge'

export function windowClass(width) {
  if (width >= BREAKS.xlarge) return 'xlarge'
  if (width >= BREAKS.large) return 'large'
  if (width >= BREAKS.expanded) return 'expanded'
  if (width >= BREAKS.medium) return 'medium'
  return 'compact'
}

export function useWindowClass() {
  const [size, setSize] = useState(() => windowClass(typeof window === 'undefined' ? 1280 : window.innerWidth))
  useEffect(() => {
    const on = () => setSize(windowClass(window.innerWidth))
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return size
}
