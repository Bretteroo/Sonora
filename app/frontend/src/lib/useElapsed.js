import { useEffect, useRef, useState } from 'react'
import { isLiveStream, parseDuration, positionNow } from './format.js'

// The position, counted locally between the speaker's reports.
//
// Speakers report a position only when something changes, so a progress bar
// fed purely by events sits still while a track plays. The reported position
// is the anchor, advanced once a second, and reset whenever the speaker
// reports again or the track changes.
//
// A live broadcast has no position to draw, whatever the speaker reports for
// one. Community Radio Plus hands the player a rolling HLS window and both
// the length and the position inside it slide, so the bar crawled forward and
// then jumped back every few seconds (and still did
// after isLiveStream learned to read the URI: that stopped the local clock,
// but the fill and the times were still drawn from the reported pair). The
// apps' progress row is empty for a station -- no times, no fill, no thumb --
// so the length is taken as nothing here and every reader of it follows.
//
// This once lived in three copies, one per shell, identical line
// for line; a fix to any of them reached only that shell.
export function useElapsed(transport) {
  const tr = transport || {}
  // Buffering (TRANSITIONING) counts as playing, as the desktop apps have it.
  const playing = tr.state === 'PLAYING' || tr.state === 'TRANSITIONING'
  const live = isLiveStream(tr.track_duration, tr.media_uri)
  const duration = live ? 0 : parseDuration(tr.track_duration)
  // The clock is the reading plus its age, recomputed four times a second
  // against real time: counting whole seconds from whenever the page last
  // heard left it up to a second out, and more after each pause, against the
  // Windows app (Pandora, 2026-09-23).
  const latest = useRef(tr)
  latest.current = tr
  const now = () => {
    const at = live ? 0 : Math.floor(positionNow(latest.current, { exact: true }))
    return duration ? Math.min(at, duration) : at
  }
  const [elapsed, setElapsed] = useState(now)

  useEffect(() => { setElapsed(now()) }, [tr.rel_time, tr.received_at, tr.track_uri, playing, live, duration]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!playing || live) return undefined
    const timer = setInterval(() => setElapsed(now()), 250)
    return () => clearInterval(timer)
  }, [playing, live, duration]) // eslint-disable-line react-hooks/exhaustive-deps
  return { elapsed, duration, live, playing }
}
