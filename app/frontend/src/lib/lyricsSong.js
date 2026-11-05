import { isKeyedStream, isLiveStream, parseDuration } from './format.js'

// The parts of the big players' lyrics that need no React and no network:
// what to look up for what a room plays, and which line is being sung. Kept
// apart from lyrics.js so lyrics.check.mjs can run them under plain Node.

/** The song to look up for what a room plays, or null when there is none:
 * a TV or a line-in has no song, and neither has a station between tracks. */
export function lyricsSong(transport) {
  const tr = transport || {}
  if (tr.source === 'tv' || tr.source === 'line_in') return null
  const title = (tr.title || '').trim()
  const artist = (tr.artist || '').trim()
  if (!title || !artist) return streamSong(tr)
  const duration = isLiveStream(tr.track_duration, tr.media_uri) ? 0 : parseDuration(tr.track_duration)
  return { title, artist, album: (tr.album || '').trim(), duration }
}

// What most stations put on the Information line: "Simply Red - Holding Back
// the Years". Split at the first dash between spaces.
const DASHED = /^(.+?)\s+[-\u2013\u2014]\s+(.+)$/

/** The song in a station's own text, or null. Most stations name the artist
 * first; some name the song first, so the other reading goes with it as
 * `turned`, for a lookup that finds nothing the first way. A live stream
 * gives no length, so these are only ever plain lyrics. */
function streamSong(tr) {
  const text = (tr.stream_content || '').trim()
  if (!text || isKeyedStream(text) || /^ZPSTR_/.test(text)) return null
  const parts = DASHED.exec(text)
  if (!parts) return null
  const first = parts[1].trim()
  const second = parts[2].trim()
  return { title: second, artist: first, album: '', duration: 0, turned: { title: first, artist: second } }
}

/** The index of the line sung at `seconds`, or -1 before the first. */
export function lineAt(lines, seconds) {
  let lo = 0
  let hi = (lines?.length || 0) - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (lines[mid][0] <= seconds) { found = mid; lo = mid + 1 } else hi = mid - 1
  }
  return found
}
