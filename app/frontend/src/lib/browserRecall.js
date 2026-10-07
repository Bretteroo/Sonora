// What "This browser" last played, kept across a reload.
//
// The page is the player, so a reload ends the playing. What survives is what
// was asked for: the request the room was given (the service URI and what
// came with it) and what it showed. The stream URL the backend resolved is
// left behind on purpose, since its session does not outlive the page; Play
// after a reload asks for a fresh one with the same request.

const KEY = 'sonora.browser.last'

export function saveLast(body, shown) {
  try {
    const { title = '', sub = '', artist = '', album = '', art = '', service = '', mediaUri = '', station = '',
            queue = null, queueIndex = -1, duration = 0 } = shown || {}
    // An album or playlist's list and the place in it come back too, so the
    // queue is there after a reload and Play resumes the track it was on
    // rather than the first.
    window.localStorage.setItem(KEY, JSON.stringify({ body, shown: {
      title, sub, artist, album, art, service, mediaUri, station,
      // A track's length, so a station's song or an album track that comes
      // back stopped shows its time rather than "Live".
      duration: Number(duration) || 0,
      queue: Array.isArray(queue) ? queue : null, queueIndex } }))
  } catch { /* private mode, or a list too long to keep: the room starts without it */ }
}

/** Clear Queue: nothing is left to come back. */
export function forgetLast() {
  try { window.localStorage.removeItem(KEY) } catch { /* nothing kept */ }
}

export function readLast() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) || 'null')
    return saved && saved.body && saved.body.uri ? saved : null
  } catch { return null }
}
