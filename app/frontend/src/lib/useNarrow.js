import { useEffect, useState } from 'react'

// Whether the page is in its one-column layout right now, and reactive to a
// resize or a rotation rather than read once at mount. Each shell passes the
// width its own stylesheet reflows at: the desktop skins at 936px, the
// Sonofuture shell at 900px.
export const DESKTOP_NARROW = '(max-width: 936px)'
export const SF_NARROW = '(max-width: 900px)'

export function useNarrow(query = DESKTOP_NARROW) {
  const [narrow, setNarrow] = useState(() => {
    try { return window.matchMedia(query).matches } catch { return false }
  })
  useEffect(() => {
    let media
    try { media = window.matchMedia(query) } catch { return undefined }
    const read = () => setNarrow(media.matches)
    read()
    media.addEventListener('change', read)
    return () => media.removeEventListener('change', read)
  }, [query])
  return narrow
}
