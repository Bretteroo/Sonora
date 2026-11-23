import React, { useCallback, useEffect, useRef, useState } from 'react'
import { positionNow } from '../../frontend/src/lib/format.js'
import { lyricsSong } from '../../frontend/src/lib/lyricsSong.js'

// The lyric sync wheel. Timed words are not always timed to the recording that
// plays: this moves them against the music, sooner (up, +) or later (down, -),
// a tenth of a second at a nudge. Every song starts at zero. A figure set for a song is kept
// once that song has played to its end, and is put back when the song next
// plays; a song left before its end keeps whatever it had before.
//
// Words that came with no timings roll by on a sheet instead, and there the
// same wheel sets how fast the sheet rolls: so many percent faster or slower
// than the pace that would end the sheet as the song ends, ten at a nudge. A song
// with no words at all leaves the wheel with nothing to do.

const STEP = 100         // milliseconds a nudge moves the words
const MOST = 9900        // as far as they go either way
const PACE_STEP = 100    // thousandths of its pace a nudge changes a rolling sheet by: ten percent
const SLOWEST = -700     // the sheet at three tenths of its pace
const FASTEST = 3000     // and at four times it
const SCROLL = 'scroll|' // what a song's rolling pace is kept under, beside its sync
const END_S = 12         // a song this near its end when it goes is taken to have finished (a crossfade starts the next one early)
const KEY = 'sonora.km.lyricSync'
const KEPT = 400         // songs remembered; the longest untouched go first

// What a song is known by here: what its lyrics are looked up by, so the same
// recording is the same song whichever room or service plays it. A station or
// a stream has no end to play to, so it has no name and nothing is kept for it.
function nameOf(transport) {
  const song = lyricsSong(transport)
  if (!song || !song.duration) return ''
  return [song.artist, song.title, song.album, Math.round(song.duration)].join('|').toLowerCase()
}
function lengthOf(name) {
  return Number(name.slice(name.lastIndexOf('|') + 1)) || 0
}

function readAll() {
  try {
    const map = JSON.parse(window.localStorage.getItem(KEY) || '{}')
    return map && typeof map === 'object' && !Array.isArray(map) ? map : {}
  } catch { return {} }
}
const stepOf = (name) => (name.startsWith(SCROLL) ? PACE_STEP : STEP)
function within(name, ms) {
  const rolls = name.startsWith(SCROLL)
  return Math.max(rolls ? SLOWEST : -MOST, Math.min(rolls ? FASTEST : MOST, ms))
}
function kept(name) {
  const ms = Number(readAll()[name]) || 0
  const step = stepOf(name)
  return within(name, Math.round(ms / step) * step)
}
function keep(name, ms) {
  const map = readAll()
  delete map[name]
  if (ms) map[name] = ms
  const names = Object.keys(map)
  for (const old of names.slice(0, Math.max(0, names.length - KEPT))) delete map[old]
  try { window.localStorage.setItem(KEY, JSON.stringify(map)) } catch { /* private mode */ }
}

/** The wheel's figure for what a room plays: { offset, nudge, ready }. `mode`
 * is 'sync' (timed words: `offset` is milliseconds, positive for words that
 * come sooner), 'scroll' (a rolling sheet: `offset` is thousandths added to
 * its pace) or 'off'. `zero` puts the figure back to nothing. */
export function useSync(transport, mode) {
  const latest = useRef(transport)
  latest.current = transport
  const way = useRef(mode)
  way.current = mode
  const held = useRef({ song: '', offset: 0, pos: 0 })
  const [offset, setOffset] = useState(0)
  const named = (tr) => {
    const name = way.current === 'off' ? '' : nameOf(tr)
    return name && way.current === 'scroll' ? SCROLL + name : name
  }
  const song = named(transport)

  const look = useCallback(() => {
    const tr = latest.current
    const now = named(tr)
    const h = held.current
    const pos = now ? positionNow(tr, { exact: true }) : 0
    const ended = Boolean(h.song) && h.pos >= lengthOf(h.song) - END_S
    if (now !== h.song) {
      if (ended) keep(h.song, h.offset)
      const next = now ? kept(now) : 0
      held.current = { song: now, offset: next, pos }
      setOffset(next)
      return
    }
    // The same song come round again, or the room stopped at the end of its queue.
    if (ended && pos < END_S) keep(h.song, h.offset)
    h.pos = pos
  }, [])
  useEffect(() => { look() }, [look, song])
  useEffect(() => {
    const timer = setInterval(look, 500)
    return () => clearInterval(timer)
  }, [look])

  const nudge = useCallback((dir) => {
    const h = held.current
    if (!h.song) return
    const next = within(h.song, h.offset + dir * stepOf(h.song))
    h.offset = next
    setOffset(next)
  }, [])
  // Back to where every song starts: the words as they were timed, or the sheet at its own pace.
  const zero = useCallback(() => {
    const h = held.current
    if (!h.song) return
    h.offset = 0
    setOffset(0)
  }, [])
  return { offset, nudge, zero, ready: Boolean(song) }
}

const signOf = (offset) => (offset > 0 ? '+' : offset < 0 ? '\u2212' : '\u00b1')
/** The figure as its window shows it: seconds behind a sign cell ("+0.05") for
 * sync, a signed percentage ("+ 10%") for a rolling sheet's pace, and with
 * nothing to turn, the same cells all dark. */
export function syncText(offset, mode) {
  if (mode === 'scroll') return signOf(offset) + String(Math.abs(offset) / 10).padStart(3, ' ') + '%'
  if (mode !== 'sync') return '\u00b1 \u2024  '
  return signOf(offset) + (Math.abs(offset) / 1000).toFixed(2)
}

const DEAD = 0.2         // how far off its middle the wheel is before it counts
const FIRST_MS = 400     // held: the wait before it starts repeating

// The drum as it is seen through its slot: the front of a wheel far larger than
// the slot, so its ribs close up toward the top and bottom, where it turns away.
// Everything is placed by angle round the wheel. The light stands above the
// reader and does not turn with it.
const RAD = Math.PI / 180
const BOX = { w: 36, h: 120 }
const ARC = 62                   // degrees of the wheel seen each side of its middle
const RADIUS = (BOX.h / 2) / Math.sin(ARC * RAD)
const RIB = 6                    // degrees between ribs
const DIP = 9                    // the finger dip reaches this far each side of its middle
const TURN = 24                  // degrees the wheel turns when pushed all the way
const LIGHT = 38                 // degrees above the reader's eye
const across = (deg) => BOX.h / 2 - RADIUS * Math.sin(deg * RAD)
// How bright the plastic is at each angle: its matte face, and the soft glint of the light on it.
const SHADE = Array.from({ length: 32 }, (_, i) => {
  const deg = ARC - (i / 31) * 2 * ARC
  const matte = Math.max(0, Math.cos((deg - LIGHT) * RAD)) ** 1.6
  const glint = Math.exp(-(((deg - LIGHT / 2) / 8) ** 2))
  const v = Math.round(46 + 84 * matte + 58 * glint)
  return { at: ((across(deg) / BOX.h) * 100).toFixed(2) + '%', color: `rgb(${v} ${v} ${v + 3})` }
})
function Drum({ tilt }) {
  const turn = tilt * TURN
  const ribs = []
  for (let k = -22; k <= 22; k++) {
    const deg = k * RIB + turn
    if (Math.abs(deg) > ARC + 2 || Math.abs(k) < 2) continue
    const facing = Math.cos(deg * RAD)
    const y = across(deg)
    const cut = 0.35 + 1.15 * facing
    ribs.push(<rect key={`a${k}`} x="0" width={BOX.w} y={(y - cut / 2).toFixed(2)} height={cut.toFixed(2)} fill="#000" opacity="0.5" />)
    ribs.push(<rect key={`b${k}`} x="0" width={BOX.w} y={(y + cut / 2).toFixed(2)} height={(0.25 + 0.5 * facing).toFixed(2)} fill="#fff" opacity={(0.2 * Math.max(0, Math.cos((deg - LIGHT) * RAD))).toFixed(3)} />)
  }
  const top = across(turn + DIP)
  const foot = across(turn - DIP)
  return (
    <svg className="km-sync-drum" viewBox={`0 0 ${BOX.w} ${BOX.h}`} preserveAspectRatio="none" focusable="false" aria-hidden="true">
      <defs>
        <linearGradient id="km-sync-round" x1="0" y1="0" x2="0" y2="1">{SHADE.map((stop) => <stop key={stop.at} offset={stop.at} stopColor={stop.color} />)}</linearGradient>
        <linearGradient id="km-sync-dip" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.9" /><stop offset="0.35" stopColor="#000" stopOpacity="0.55" />
          <stop offset="0.7" stopColor="#000" stopOpacity="0.12" /><stop offset="1" stopColor="#fff" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id="km-sync-sides" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0.75" /><stop offset="0.05" stopColor="#fff" stopOpacity="0.16" /><stop offset="0.14" stopColor="#000" stopOpacity="0" />
          <stop offset="0.86" stopColor="#000" stopOpacity="0" /><stop offset="0.96" stopColor="#000" stopOpacity="0.5" /><stop offset="1" stopColor="#000" stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id="km-sync-slot" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.95" /><stop offset="0.1" stopColor="#000" stopOpacity="0.3" /><stop offset="0.18" stopColor="#000" stopOpacity="0" />
          <stop offset="0.9" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.7" />
        </linearGradient>
      </defs>
      <rect width={BOX.w} height={BOX.h} fill="url(#km-sync-round)" />
      {ribs}
      <rect x="0" width={BOX.w} y={top.toFixed(2)} height={(foot - top).toFixed(2)} fill="url(#km-sync-dip)" />
      <rect x="0" width={BOX.w} y={(top - 0.5).toFixed(2)} height="0.9" fill="#000" opacity="0.8" />
      <rect x="0" width={BOX.w} y={foot.toFixed(2)} height="0.8" fill="#fff" opacity="0.3" />
      <rect width={BOX.w} height={BOX.h} fill="url(#km-sync-sides)" />
      <rect width={BOX.w} height={BOX.h} fill="url(#km-sync-slot)" />
    </svg>
  )
}

// Where the drum is drawn: at the push while it is held, and sprung back to its
// middle once it is let go, where it bounces a little past and back before it rests.
function useSprung(target, held) {
  const [at, setAt] = useState(target)
  const now = useRef({ x: target, v: 0 })
  useEffect(() => {
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (held || still) { now.current = { x: target, v: 0 }; setAt(target); return undefined }
    let frame = 0
    let last = performance.now()
    const step = (time) => {
      const dt = Math.min(0.032, (time - last) / 1000)
      last = time
      const s = now.current
      s.v += (-500 * (s.x - target) - 20 * s.v) * dt
      s.x += s.v * dt
      if (Math.abs(s.x - target) < 0.003 && Math.abs(s.v) < 0.05) { s.x = target; s.v = 0; setAt(target); return }
      setAt(s.x)
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target, held])
  return at
}

// The wheel itself, sprung to its middle like a keyboard's pitch wheel: pushed
// up or down it nudges once, and held there it goes on nudging, faster the
// further it is pushed. Let go, it comes back. The mouse wheel turned over it
// and the arrow keys nudge too. `children` is the figure's window under it.
export function SyncWheel({ offset, mode, onNudge, disabled, label, zeroKey = null, children }) {
  const ref = useRef(null)
  const [tilt, setTilt] = useState(0)
  const [heldDown, setHeldDown] = useState(false)
  const push = useRef({ id: null, tilt: 0, timer: 0 })
  const nudge = useRef(onNudge)
  nudge.current = onNudge

  const lean = (event) => {
    const box = ref.current.getBoundingClientRect()
    const to = Math.max(-1, Math.min(1, (box.top + box.height / 2 - event.clientY) / (box.height / 2)))
    push.current.tilt = to
    setTilt(to)
  }
  const letGo = () => {
    clearTimeout(push.current.timer)
    push.current = { id: null, tilt: 0, timer: 0 }
    setTilt(0)
    setHeldDown(false)
  }
  const onDown = (event) => {
    if (disabled || event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    clearTimeout(push.current.timer)
    push.current.id = event.pointerId
    setHeldDown(true)
    lean(event)
    let fresh = true
    const tick = () => {
      const far = Math.abs(push.current.tilt)
      let wait = 60
      if (far >= DEAD) {
        nudge.current(Math.sign(push.current.tilt))
        wait = fresh ? FIRST_MS : 300 - 200 * far
        fresh = false
      } else fresh = true
      push.current.timer = setTimeout(tick, wait)
    }
    tick()
  }
  const onMove = (event) => { if (push.current.id === event.pointerId) lean(event) }
  const onUp = (event) => { if (push.current.id === event.pointerId) letGo() }
  useEffect(() => () => clearTimeout(push.current.timer), [])
  useEffect(() => { if (disabled) letGo() }, [disabled])

  // A flick of the wheel for a nudge that came from the mouse wheel or a key.
  const flick = useRef(0)
  const tap = (dir) => {
    if (disabled) return
    nudge.current(dir)
    if (push.current.id != null) return
    setTilt(dir * 0.6)
    clearTimeout(flick.current)
    flick.current = setTimeout(() => setTilt(0), 110)
  }
  const tapNow = useRef(tap)
  tapNow.current = tap
  useEffect(() => {
    const el = ref.current
    let last = 0
    const onWheel = (event) => {
      event.preventDefault()
      if (!event.deltaY || event.timeStamp - last < 40) return
      last = event.timeStamp
      tapNow.current(event.deltaY < 0 ? 1 : -1)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => { el.removeEventListener('wheel', onWheel); clearTimeout(flick.current) }
  }, [])
  const onKeyDown = (event) => {
    const dir = event.key === 'ArrowUp' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowDown' || event.key === 'ArrowLeft' ? -1 : 0
    if (!dir) return
    event.preventDefault()
    tap(dir)
  }

  const rolls = mode === 'scroll'
  const spoken = rolls ? `${offset > 0 ? '+' : offset < 0 ? '\u2212' : ''}${Math.abs(offset) / 10}%` : `${offset > 0 ? '+' : offset < 0 ? '\u2212' : ''}${(Math.abs(offset) / 1000).toFixed(2)} s`
  const drawn = useSprung(tilt, heldDown)
  return (
    <div className="km-sync" data-disabled={disabled ? '' : undefined}>
      <div className="km-sync-well">
        <span className="km-sync-mark" aria-hidden="true">+</span>
        <div className="km-sync-wheel" ref={ref} role="slider" tabIndex={disabled ? -1 : 0} aria-orientation="vertical"
             aria-label={label} aria-disabled={disabled || undefined} aria-valuemin={rolls ? SLOWEST : -MOST} aria-valuemax={rolls ? FASTEST : MOST} aria-valuenow={offset} aria-valuetext={spoken}
             onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onLostPointerCapture={onUp} onKeyDown={onKeyDown}>
          <Drum tilt={drawn} />
        </div>
        <span className="km-sync-mark" aria-hidden="true">{'\u2212'}</span>
        {zeroKey}
      </div>
      <span className="km-sync-led" aria-hidden="true">{children}</span>
    </div>
  )
}

// The same nudges from a small knob with stops, as a level knob has: straight up at nothing,
// round to seven o'clock at the least the figure goes to and to five o'clock at the most. Taken
// hold of and turned, it nudges as often as its line passes a notch's worth of its travel; the
// mouse wheel over it and the arrow keys nudge once a turn or a press. Its ridges are pictures a
// quarter of a ridge apart, so they are seen to go round; its line is drawn over them.
const KNOB_STOP = 135
const KNOB_RIDGES = 40
const KNOB_FRAMES = 4
export function SyncKnob({ offset, mode, onNudge, disabled, label }) {
  const ref = useRef(null)
  const grip = useRef(null)
  const nudge = useRef(onNudge)
  nudge.current = onNudge
  const offsetNow = useRef(offset)
  offsetNow.current = offset
  const range = mode === 'scroll' ? { lo: SLOWEST, hi: FASTEST, step: PACE_STEP } : { lo: -MOST, hi: MOST, step: STEP }
  const go = (dir) => {
    if (disabled || !dir) return
    nudge.current(dir)
  }
  const goNow = useRef(go)
  goNow.current = go
  const angleOf = (event) => {
    const box = ref.current.getBoundingClientRect()
    return Math.atan2(event.clientY - (box.top + box.height / 2), event.clientX - (box.left + box.width / 2)) * 180 / Math.PI
  }
  const onDown = (event) => {
    if (disabled || event.button !== 0) return
    event.preventDefault()
    ref.current.focus({ preventScroll: true })
    event.currentTarget.setPointerCapture(event.pointerId)
    grip.current = { id: event.pointerId, angle: angleOf(event), owed: 0, at: offsetNow.current }
  }
  const onMove = (event) => {
    const g = grip.current
    if (!g || g.id !== event.pointerId) return
    const angle = angleOf(event)
    let by = angle - g.angle
    if (by > 180) by -= 360
    if (by < -180) by += 360
    g.angle = angle
    g.owed += by
    // A notch's worth of the knob's travel on the side of nothing it is turning through.
    for (;;) {
      const dir = Math.sign(g.owed)
      if (!dir) break
      const span = dir > 0 ? (g.at >= 0 ? range.hi : -range.lo) : (g.at > 0 ? range.hi : -range.lo)
      const notch = (KNOB_STOP * range.step) / span
      if (Math.abs(g.owed) < notch) break
      const next = Math.max(range.lo, Math.min(range.hi, g.at + dir * range.step))
      if (next === g.at) { g.owed = 0; break }
      g.owed -= dir * notch
      g.at = next
      go(dir)
    }
  }
  const onUp = (event) => { if (grip.current?.id === event.pointerId) grip.current = null }
  useEffect(() => {
    const el = ref.current
    let last = 0
    const onWheel = (event) => {
      event.preventDefault()
      if (!event.deltaY || event.timeStamp - last < 40) return
      last = event.timeStamp
      goNow.current(event.deltaY < 0 ? 1 : -1)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])
  const onKeyDown = (event) => {
    const dir = event.key === 'ArrowUp' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowDown' || event.key === 'ArrowLeft' ? -1 : 0
    if (!dir) return
    event.preventDefault()
    go(dir)
  }
  const rolls = mode === 'scroll'
  const spoken = rolls ? `${offset > 0 ? '+' : offset < 0 ? '\u2212' : ''}${Math.abs(offset) / 10}%` : `${offset > 0 ? '+' : offset < 0 ? '\u2212' : ''}${(Math.abs(offset) / 1000).toFixed(2)} s`
  // The knob stands where the figure is, so putting the figure back to nothing turns it back to the top.
  const turn = offset >= 0 ? (offset / range.hi) * KNOB_STOP : (offset / -range.lo) * KNOB_STOP
  const period = 360 / KNOB_RIDGES
  const frame = Math.round(((((-turn) % period) + period) % period) / period * KNOB_FRAMES) % KNOB_FRAMES
  return (
    <div className="ld-knob" ref={ref} role="slider" tabIndex={disabled ? -1 : 0} aria-label={label} aria-disabled={disabled || undefined}
         aria-valuemin={rolls ? SLOWEST : -MOST} aria-valuemax={rolls ? FASTEST : MOST} aria-valuenow={offset} aria-valuetext={spoken}
         data-disabled={disabled || undefined} style={{ '--ld-turn': `${turn}deg`, '--ld-frame': frame }}
         onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onLostPointerCapture={onUp} onKeyDown={onKeyDown}>
      <i className="ld-knob-body" aria-hidden="true" />
      <i className="ld-knob-line" aria-hidden="true" />
    </div>
  )
}
