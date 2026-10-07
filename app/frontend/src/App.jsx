import React, { useEffect, useState } from 'react'
import { useTheme } from './lib/theme.jsx'
import { useSystem } from './lib/store.jsx'
import Splash from './components/Splash.jsx'
import LayoutShell from './parts/LayoutShell.jsx'

// How long the first load may take before "Looking for speakers" is shown.
// The snapshot normally arrives well inside a second, and flashing that
// screen on every page load read as a fault; a system
// that really is still being discovered gets the screen after this pause.
const LOOKING_GRACE_MS = 1500

export default function App() {
  const { theme } = useTheme()
  const { loading, error, zoneList } = useSystem()
  const [pastGrace, setPastGrace] = useState(false)
  useEffect(() => {
    if (!loading) return undefined
    const timer = setTimeout(() => setPastGrace(true), LOOKING_GRACE_MS)
    return () => clearTimeout(timer)
  }, [loading])

  // Every theme renders the same failure and empty states, because a person
  // whose speakers have not appeared needs the same explanation regardless of
  // which skin they picked.
  if (error && zoneList.length === 0) {
    return <Splash kind="error" detail={error} />
  }
  if (loading) {
    // The theme's own background and nothing else until the grace period
    // is over; the interface then appears without a screen in between.
    return pastGrace ? <Splash kind="loading" /> : <div style={{ minHeight: '100%', background: 'var(--t-bg, #f6f6f7)' }} />
  }
  if (zoneList.length === 0) return <Splash kind="empty" />

  // A theme installed from a file always carries its own layout, since a
  // package cannot bring code; LayoutShell draws it and supplies the overlays a
  // package cannot. Resolved here rather than in lib/theme.jsx, which would
  // have to import it and close an import cycle back onto itself.
  if (theme.layout) return <LayoutShell layout={theme.layout} theme={theme} />
  const Shell = theme.Shell
  return <Shell />
}
