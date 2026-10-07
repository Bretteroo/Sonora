import { useSystem } from '../../frontend/src/lib/store.jsx'
import { nextTransport } from '../../frontend/src/lib/transport.js'

// Whether a page's own item is what the chosen room has on now, and what its
// play disc should therefore do. The product turns a station page's play disc
// into a pause while that station plays in the room, and the press pauses it
// (AccuRadio's Lovers Rock Reggae, reported 2026-09-28). An item is the same
// when its id is, whatever the ?sid= after it says.

function bare(uri) {
  const head = (uri || '').split('?')[0]
  try { return decodeURIComponent(head).toLowerCase() } catch { return head.toLowerCase() }
}

export function useOnAir(room, uri) {
  const { zones, actions } = useSystem()
  const transport = zones[room]?.transport
  const here = Boolean(uri) && Boolean(transport?.media_uri) && bare(transport.media_uri) === bare(uri)
  // 'play', 'pause' or 'stop': the disc's next press.
  const next = here ? nextTransport(transport) : 'play'
  // Resumes, pauses or stops the room when the page's item is on it; says
  // false otherwise, so the caller starts the item.
  const press = () => {
    if (!here) return false
    if (next === 'pause') actions.pause(room)
    else if (next === 'stop') actions.stop(room)
    else actions.play(room)
    return true
  }
  return { here, next, press }
}
