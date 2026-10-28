import React, { useEffect, useRef, useState } from 'react'

// The desktop controller's slider: a 2px track with a light fill and a round
// white thumb (the volume scrubber tile is 21x23). The volume follows the
// pointer as it moves, as the apps' does -- they send the change while you
// drag rather than waiting for the release -- throttled so a long drag does
// not queue hundreds of calls, with a final send when the drag ends.
const LIVE_MS = 90
// 9.1 draws the bar as a 12px end cap at each side with the fill stretched
// between them, and runs the knob's center along that same middle, so the
// lit part always ends under the knob's center. At zero the left cap goes
// dark too; at the top the right cap lights.
const END_CAP = 12

export default function Slider({ value, onCommit, label, max = 100, disabled = false, muted = false }) {
  const [local, setLocal] = useState(value)
  const [dragging, setDragging] = useState(false)
  const sent = useRef({ at: 0, value, timer: null })

  useEffect(() => {
    if (!dragging) setLocal(value)
  }, [value, dragging])

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
  const finish = (next) => { if (next !== sent.current.value) send(next) }

  const shown = dragging ? local : value
  const pct = Math.max(0, Math.min(100, (shown / max) * 100))

  return (
    <div className="dk-slider" data-muted={muted || undefined}>
      <div className="dk-slider-track" />
      <div className="dk-slider-fill" data-full={pct >= 100 || undefined}
           style={{ width: pct > 0 ? `calc(${END_CAP}px + (100% - ${2 * END_CAP}px) * ${pct / 100})` : 0 }} />
      <input
        type="range"
        data-wheel-step="2"
        min={0}
        max={max}
        value={shown}
        aria-label={label}
        disabled={disabled}
        onChange={(event) => {
          const next = Number(event.target.value)
          setDragging(true)
          setLocal(next)
          live(next)
        }}
        onPointerUp={() => { if (dragging) { setDragging(false); finish(local) } }}
        onKeyUp={() => { if (dragging) { setDragging(false); finish(local) } }}
        onBlur={() => { if (dragging) { setDragging(false); finish(local) } }}
      />
    </div>
  )
}
