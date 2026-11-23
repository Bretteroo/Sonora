// What "This browser" last played, kept across a reload.
//
// The page is the player, so a reload ends the playing. What survives is what
// was asked for: the request the room was given (the service URI and what
// came with it) and what it showed. The stream URL the backend resolved is
// left behind on purpose, since its session does not outlive the page; Play
// after a reload asks for a fresh one with the same request.

const KEY = 'sonora.browser.last'

// `listBody` is the request the room's list came from, where that is not
// what is playing: a station on beside an album's list is `body`, and the
// album is `listBody`. Null for a list with no source of its own.
// What is kept of a request is what plays it: never how it was added (to the end, next, from
// the end). Replayed after a reload, an "add" would add the song again each time it was played.
function plain(body) {
  if (!body || typeof body !== 'object') return body
  const { enqueue, next, at_end: atEnd, ...rest } = body  // eslint-disable-line no-unused-vars
  return rest
}

export function saveLast(body, shown, listBody = null) {
  body = plain(body)
  listBody = plain(listBody)
  try {
    const { title = '', sub = '', artist = '', album = '', art = '', service = '', mediaUri = '', station = '',
            queue = null, queueIndex = -1, inList = false, duration = 0 } = shown || {}
    // An album or playlist's list and the place in it come back too, so the
    // queue is there after a reload and Play resumes the track it was on
    // rather than the first.
    window.localStorage.setItem(KEY, JSON.stringify({ body, listBody, shown: {
      title, sub, artist, album, art, service, mediaUri, station,
      // A track's length, so a station's song or an album track that comes
      // back stopped shows its time rather than "Live".
      duration: Number(duration) || 0,
      queue: Array.isArray(queue) ? queue : null, queueIndex, inList: Boolean(inList) } }))
  } catch { /* private mode, or a list too long to keep: the room starts without it */ }
}

/** Clear Queue: nothing is left to come back. */
export function forgetLast() {
  try { window.localStorage.removeItem(KEY) } catch { /* nothing kept */ }
}

export function readLast() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) || 'null')
    // A save from before the adding flags were left out is cleaned on the way in.
    return saved && saved.body && saved.body.uri ? { ...saved, body: plain(saved.body), listBody: plain(saved.listBody) } : null
  } catch { return null }
}
