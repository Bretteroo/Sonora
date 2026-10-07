import React, { useEffect, useRef, useState } from 'react'

// Volume slider matching the real client's proportions: a 2px rail with a 12px
// thumb. The volume follows the thumb while it is dragged, as the product's
// does, rather than waiting for the release: paced to one call every 90ms so a
// long drag does not queue a request per pixel at a speaker that cannot keep
// up, with a last send when the drag ends. It had committed on release only;
// the desktop replicas' slider already worked this way.
const LIVE_MS = 90

export default function Slider({ value, onCommit, label, max = 100 }) {
  const [dragging, setDragging] = useState(null)
  // `latest` is the thumb's own last value, read on release: the state can
  // be a render behind when the release lands in the same frame as the move.
  const sent = useRef({ at: 0, value, timer: null, latest: null })
  const shown = dragging ?? value

  useEffect(() => () => clearTimeout(sent.current.timer), [])

  const send = (next) => {
    clearTimeout(sent.current.timer)
    sent.current.timer = null
    sent.current.at = Date.now()
    sent.current.value = next
    onCommit(next)
  }
  const live = (next) => {
    const since = Date.now() - sent.current.at
    if (since >= LIVE_MS) { send(next); return }
    clearTimeout(sent.current.timer)
    sent.current.timer = setTimeout(() => send(next), LIVE_MS - since)
  }
  const finish = () => {
    const last = sent.current.latest
    if (last === null) return
    sent.current.latest = null
    if (last !== sent.current.value || sent.current.timer) send(last)
    setDragging(null)
  }

  return (
    <div className="wb-slider">
      <div className="wb-slider-rail" />
      <div className="wb-slider-fill" style={{ width: `${(shown / max) * 100}%` }} />
      <input
        type="range"
        data-wheel-step="2"
        min="0"
        max={max}
        value={shown}
        aria-label={label}
        onChange={(event) => {
          const next = Number(event.target.value)
          sent.current.latest = next
          setDragging(next)
          live(next)
        }}
        onPointerUp={finish}
        onKeyUp={finish}
        onBlur={finish}
      />
    </div>
  )
}
