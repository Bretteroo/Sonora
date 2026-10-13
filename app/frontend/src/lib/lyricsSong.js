import { isLiveStream, parseDuration } from './format.js'

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
  if (!title || !artist) return null
  const duration = isLiveStream(tr.track_duration, tr.media_uri) ? 0 : parseDuration(tr.track_duration)
  return { title, artist, album: (tr.album || '').trim(), duration }
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
