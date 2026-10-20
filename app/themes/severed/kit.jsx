import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { orderedHouseholds, systemChoiceMatters } from '../../frontend/src/lib/format.js'
import { useHeld } from '../../frontend/src/lib/useHeld.js'
import { keySound, driveSpin, driveSeek } from './sound.js'
import { useDiskBusy } from './disk.js'
import { rectOf, viewW, viewH } from './layout.js'
import * as G from './glyphs.jsx'

// Severed's kit, in two halves.
//
// The console's: keys with a cap that travels and a body under it, the
// bracketed labels that group them, lamps, the liquid-crystal display, the
// volume fader in its slot and the rotary system knob. A key sounds as it goes down
// and again as it comes up (sound.js).
//
// The screen's: what a text terminal would draw -- bracketed buttons, boxes
// that are ticked or not, block-character bars for anything with a level,
// pop-up menus and windows with an inverse title row, a line for messages.
// Nothing here knows about Sonos; the programs compose these.

export function cx(...parts) { return parts.filter(Boolean).join(' ') }

// Escape and a press outside close whatever `ref` wraps. The listeners stay put for as long as it
// is open and call whatever `onClose` is current: put back each time the caller drew a new one,
// they could be taken off in the middle of the very Escape that was to close it (the deck's cursor
// keys answer Escape first and redraw the console, and Chrome and Safari draw it before the next
// listener runs), and a listener put on mid-event never hears that event.
export function useDismiss(ref, onClose, enabled = true) {
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    if (!enabled) return undefined
    const down = (event) => { if (ref.current && !ref.current.contains(event.target)) close.current() }
    const key = (event) => { if (event.key === 'Escape') { event.stopPropagation(); close.current() } }
    const id = setTimeout(() => {
      document.addEventListener('pointerdown', down)
      document.addEventListener('keydown', key)
    }, 0)
    return () => {
      clearTimeout(id)
      document.removeEventListener('pointerdown', down)
      document.removeEventListener('keydown', key)
    }
  }, [ref, enabled])
}

// --- the console -------------------------------------------------------------------

const WEIGHTS = { xs: 0.7, s: 0.85, m: 1, l: 1.2, xl: 1.5, bar: 1.7 }

// A key. `tone` is its plastic (cream, navy, teal, sage, aqua, coral); `size`
// its width on the console. `lit` puts a lamp in its corner, on or off, for a
// key that is a switch; `lamp` a second one beside it, in its own color, for a
// key that also reports something (the Queue key's, amber, lit while the queue
// holds anything). It goes down under a press however the press comes,
// pointer or keyboard, and sounds both ways; `held` holds it down from outside,
// while its counterpart on the real keyboard is down.
// A key whose action is not available stays on the console, its plastic dimmed, its lamp
// out and its press dead, so the keys around it keep their places. It is marked unavailable
// rather than disabled: Firefox lays a disabled button's contents flat, and the cap would
// lose its height.
export function Key({ absent = false, disabled = false, lit = null, ...props }) {
  // The cap's shade is drawn only while it shows (severed.css, --k-shade-layer): while the key is
  // out of use, and for the fade back into use after.
  const [fading, setFading] = useState(false)
  const was = useRef(absent)
  useEffect(() => {
    const back = was.current && !absent
    was.current = absent
    if (!back) return undefined
    setFading(true)
    const id = setTimeout(() => setFading(false), KEY_FADE_MS + 100)
    return () => clearTimeout(id)
  }, [absent])
  return <LiveKey {...props} disabled={absent || disabled} lit={lit === null ? null : lit && !absent} data-dim={absent || undefined}
                  data-shade={absent || fading || undefined} />
}
// How long a key takes to fade into use or out of it (severed.css, .sv-key's transition).
const KEY_FADE_MS = 700

function LiveKey({ legend = '', sub = '', glyph = null, tone = 'cream', size = 'm', lit = null, lamp = null, label = '', onPress,
                   disabled = false, className = '', pressed = null, held: heldOutside = false, tip = false, ...rest }) {
  const [down, setDown] = useState(false)
  const held = useRef(false)
  const fired = useRef(false)
  const weight = WEIGHTS[size] || 1
  // The cap sinks under the pointer as it goes down, so a press near its edge can end with the
  // pointer off the key and the browser's click never coming. The key keeps the pointer for the
  // press and acts on the release itself, as long as the release is still about on the key; the
  // click, when it does come, is then let go by. A keyboard's Enter or Space comes only as a click.
  const press = (event) => {
    if (disabled || held.current) return
    held.current = true
    setDown(true)
    keySound('down', weight)
    if (event?.pointerId != null) event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  const release = () => {
    if (!held.current) return
    held.current = false
    setDown(false)
    keySound('up', weight)
  }
  const lift = (event) => {
    const was = held.current
    release()
    if (!was || event.button !== 0) return
    // The click that follows a pointer's release is the key's to ignore, wherever it was let go.
    fired.current = true
    setTimeout(() => { fired.current = false }, 80)
    if (disabled) return
    const r = event.currentTarget.getBoundingClientRect()
    if (event.clientX < r.left - 12 || event.clientX > r.right + 12 || event.clientY < r.top - 20 || event.clientY > r.bottom + 12) return
    onPress?.(event)
  }
  const click = (event) => {
    if (fired.current) return
    if (!disabled) onPress?.(event)
  }
  return (
    <button type="button" className={cx('sv-key', `sv-key-${tone}`, `sv-key-${size}`, className)} data-down={down || heldOutside || undefined}
            aria-label={label || undefined} data-tip={label && (tip || label !== legend) ? label : undefined}
            aria-pressed={pressed === null ? undefined : Boolean(pressed)} aria-disabled={disabled || undefined} tabIndex={disabled ? -1 : undefined}
            onPointerDown={(event) => { if (event.button === 0) press(event) }}
            onPointerUp={lift} onPointerLeave={release} onPointerCancel={release}
            onKeyDown={(event) => { if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) press() }}
            onKeyUp={(event) => { if (event.key === 'Enter' || event.key === ' ') release() }}
            onBlur={release}
            onClick={click} {...rest}>
      <span className="sv-key-cap"><span className="sv-key-walls" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /></span><span className="sv-key-top">
        {lit !== null && <span className="sv-led sv-key-led" data-on={lit || undefined} aria-hidden="true" />}
        {lamp && <span className="sv-led sv-key-led sv-key-lamp" data-on={lamp.on || undefined} data-tone={lamp.tone} aria-hidden="true" />}
        {glyph && <span className="sv-key-glyph" aria-hidden="true">{glyph}</span>}
        {legend && <span className="sv-key-legend">{legend}</span>}
        {sub && <span className="sv-key-sub">{sub}</span>}
      </span></span>
    </button>
  )
}

// The hard drive's access lamp, on the left edge of the case: dark green at rest, lit while the
// drive works, and flickering all the while, as a drive's lamp does with each seek. Each time
// it lights the head is heard to tick, so the sound and the flicker keep time. While music
// plays in any room the drive streams it, and the lamp blips for that now and then, without a
// sound.
// `quiet` is a second lamp for the same drive, shown only where the first cannot be: it
// flickers but leaves the sound to the first.
export function DriveLamp({ label, quiet = false, playing = false }) {
  const busy = useDiskBusy()
  const [lit, setLit] = useState(false)
  useEffect(() => {
    if (!quiet) driveSpin(busy)
    if (!busy && !playing) { setLit(false); return undefined }
    let timer = 0
    let on = false
    const step = () => {
      on = !on
      setLit(on)
      if (on && busy && !quiet && Math.random() < 0.75) driveSeek()
      // Lit for a seek's few milliseconds to a short read; dark for a moment, now and then longer.
      // Streaming, a single blip every few seconds: each blink is a frame Firefox draws whole, and
      // a few a second kept it drawing all the time music played.
      const wait = busy
        ? (on ? 25 + Math.random() * 90 : (Math.random() < 0.15 ? 120 + Math.random() * 160 : 15 + Math.random() * 60))
        : (on ? 30 + Math.random() * 40 : 2500 + Math.random() * 3500)
      timer = setTimeout(step, wait)
    }
    step()
    return () => { clearTimeout(timer); if (!quiet) driveSpin(false) }
  }, [busy, playing, quiet])
  return (
    <span className="sv-drive" title={label} aria-hidden="true">
      <span className="sv-drive-lamp" data-on={lit || undefined} />
      <span className="sv-drive-label">HDD</span>
    </span>
  )
}

// The floppy drive's access lamp, dark but for a flicker as a program loads: each change of
// `activity` flickers it a few times, and a disk pushed back in is read for longer, the lamp
// flickering for a second or so after it seats. Worked out once for the drive, so the lamp on
// its face and the one on the screen's frame flicker together.
export function useFloppyRead(activity, disk) {
  const [lit, setLit] = useState(false)
  const flicker = useRef([])
  const readFor = (times) => {
    flicker.current.forEach(clearTimeout)
    flicker.current = []
    let at = 0
    for (let i = 0; i < times; i += 1) {
      flicker.current.push(setTimeout(() => setLit(true), at))
      at += 40 + Math.random() * 50
      flicker.current.push(setTimeout(() => setLit(false), at))
      at += 30 + Math.random() * 50
    }
  }
  useEffect(() => () => flicker.current.forEach(clearTimeout), [])
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    readFor(4)
  }, [activity]) // eslint-disable-line react-hooks/exhaustive-deps
  const lastDisk = useRef(disk)
  useEffect(() => {
    if (disk === 'in' && lastDisk.current === 'inserting') readFor(14)
    lastDisk.current = disk
  }, [disk]) // eslint-disable-line react-hooks/exhaustive-deps
  return lit
}

// The floppy drive, molded into the left panel itself, with no bezel of its own: the disk slot
// with its door, the finger recess under it, the eject button, and the access lamp (`lit`, from
// useFloppyRead), with the drive's name printed beside it as the hard drive's is. There are two,
// FDD0 over FDD1, and the second is empty.
// Drawn here from scratch on a 202 by 42 grid, a 3.5-inch drive's face drawn out wider.
// `disk` is where the system disk is: in, ejecting, out (its edge standing out of the slot), or
// inserting. The eject button and the disk's edge are each a button of their own.
export function FloppyFace({ label = '', empty = false, lit = false, disk = 'in', onEject = null, onInsert = null, ejectLabel = '', insertLabel = '' }) {
  const clip = `sv-floppy-mouth-${label || 'x'}`
  return (
    <span className="sv-floppy-wrap" data-empty={empty || undefined} data-disk={disk}>
    <svg className="sv-floppy" viewBox="0 0 202 42" aria-hidden="true" focusable="false">
      <defs><clipPath id={clip}><rect x="0" y="10" width="202" height="32" /></clipPath></defs>
      {/* The slot and the chamfered lip above it. With a disk in, the slot shows the disk's back
          edge, plastic either side of the label wrapped over it; empty, its flap is shut, flush
          and the color of the face. */}
      <path className="sv-floppy-lip" d="M8 8 H194 L192 10 H10 Z" />
      <rect className="sv-floppy-slot" x="10" y="10" width="182" height="9" rx="0.8" />
      {empty ? <>
        <rect className="sv-floppy-door" x="11.5" y="11.2" width="179" height="6.6" rx="0.5" />
        <path className="sv-floppy-doorhi" d="M11.5 11.4 H190.5" />
      </> : <>
        <rect className="sv-floppy-disk-edge" x="11" y="13.2" width="180" height="4.4" rx="0.5" />
        <rect className="sv-floppy-disk-labeledge" x="36" y="13.2" width="130" height="4.4" />
        <path className="sv-floppy-disk-hi" d="M11.5 13.5 H190.5" />
      </>}
      {/* The finger recess, a step down in the middle under the slot. */}
      <path className="sv-floppy-recess" d="M69 19 H133 L131 30 H71 Z" />
      <path className="sv-floppy-recesswall" d="M69 19 H72.5 L73.5 30 H71 Z" />
      <path className="sv-floppy-recesswall-lit" d="M133 19 H129.5 L128.5 30 H131 Z" />
      <path className="sv-floppy-recesstop" d="M69 19 H133 L132.4 22.5 H69.6 Z" />
      <path className="sv-floppy-recesslo" d="M71 30 H131" />
      {/* The access lamp, dark, and the eject button. */}
      <rect className="sv-floppy-lamp" x="25.5" y="35" width="9" height="4" rx="0.6" data-on={lit || undefined} />
      <rect className="sv-floppy-eject-rim" x="151.65" y="21.65" width="24.7" height="15.7" rx="3" />
      <rect className="sv-floppy-eject-well" x="152.5" y="22.5" width="23" height="14" rx="2.4" />
      {/* With a disk in, the button stands out of its well, its side showing under the face. */}
      <rect className="sv-floppy-eject-side" x="155" y="25" width="18" height="12.5" rx="1.8" />
      <rect className="sv-floppy-eject" x="155" y="24.5" width="18" height="9.5" rx="1.8" />
      <path className="sv-floppy-ejecthi" d="M156.5 25.3 H171.5" />
      {/* The system disk, coming out of the slot and going back in. Seen a little from above, as
          the panel is: its top face runs down from the slot's mouth, foreshortened, to its back
          edge, and the label wraps from the face over the edge, with plastic either side of it. Out, it lies over the eject button. */}
      {disk !== 'in' && (
        <g className="sv-floppy-disk" clipPath={`url(#${clip})`}>
          <g className="sv-floppy-disk-ride">
            <rect className="sv-floppy-disk-shadow" x="11" y="25" width="180" height="11" rx="1" />
            <rect className="sv-floppy-disk-face" x="11" y="8" width="180" height="19.5" rx="0.6" />
            <rect className="sv-floppy-disk-label" x="36" y="8" width="130" height="19.5" />
            <path className="sv-floppy-disk-rule" d="M39 14.5 H163 M39 18.5 H163 M39 22.5 H163" />
            {/* "SONORA OS" on the label, in the console's own lettering, and upside down to the
                reader: the disk went in label first, so the writing faces the drive. */}
            <text className="sv-floppy-disk-ink" x="101" y="17.75" textAnchor="middle" dominantBaseline="central" transform="rotate(180 101 17.75)">SONORA OS</text>
            <rect className="sv-floppy-disk-edge" x="11" y="27.5" width="180" height="4.2" rx="0.5" />
            <rect className="sv-floppy-disk-labeledge" x="36" y="27.5" width="130" height="4.2" />
            <path className="sv-floppy-disk-crease" d="M11 27.5 H191" />
          </g>
        </g>
      )}
    </svg>
    <span className="sv-drive-label sv-floppy-label" aria-hidden="true">{label}</span>
    {onEject && <button type="button" className="sv-floppy-eject-btn" aria-label={ejectLabel} title={ejectLabel} disabled={disk !== 'in'} onClick={onEject} />}
    {onInsert && disk !== 'in' && <button type="button" className="sv-floppy-disk-btn" aria-label={insertLabel} title={insertLabel} disabled={disk !== 'out'} onClick={onInsert} />}
    </span>
  )
}

// A run of keys under a bracketed label, as the console groups them.
export function Cluster({ label, children, className = '', keysClassName = '', aside = null, ...rest }) {
  return (
    <div className={cx('sv-cluster', className)} role="group" aria-label={label} {...rest}>
      <span className="sv-cluster-label" aria-hidden="true"><span>{label}</span></span>
      <div className={cx('sv-cluster-keys', keysClassName)}>{children}</div>
      {aside}
    </div>
  )
}

export function Led({ on = false, tone = 'green', blink = false, className = '', title = '' }) {
  return <span className={cx('sv-led', className)} data-on={on || undefined} data-tone={tone} data-blink={blink || undefined} title={title || undefined} aria-hidden={title ? undefined : 'true'} />
}

// The liquid-crystal display: dark digits on a lit gray-green glass, or lit digits on black.
export function Lcd({ children, className = '', label = '' }) {
  return <div className={cx('sv-lcd', className)} role={label ? 'status' : undefined} aria-label={label || undefined}>{children}</div>
}

// A value that follows a drag, sending as it goes but no more than every
// ninety milliseconds, and the last one on release. What was let go of stays
// on screen until the room reports it (useHeld).
const LIVE_MS = 90
function useLive(value, onCommit) {
  const [local, setLocal] = useState(value)
  const [dragging, setDragging] = useState(false)
  const sent = useRef({ at: 0, value, timer: null })
  useEffect(() => { if (!dragging) setLocal(value) }, [value, dragging])
  useEffect(() => () => clearTimeout(sent.current.timer), [])
  const send = (next) => {
    clearTimeout(sent.current.timer)
    sent.current = { at: Date.now(), value: next, timer: null }
    onCommit(next)
  }
  const live = (next) => {
    const since = Date.now() - sent.current.at
    if (since >= LIVE_MS) { send(next); return }
    clearTimeout(sent.current.timer)
    sent.current.timer = setTimeout(() => send(next), LIVE_MS - since)
  }
  const [held, setHeld] = useHeld(value)
  const finish = () => { if (!dragging) return; setDragging(false); setHeld(local); if (local !== sent.current.value) send(local) }
  const change = (next) => { setDragging(true); setLocal(next); live(next) }
  return { shown: dragging ? local : (held ?? value), change, finish, dragging }
}

function percent(value, min, max) {
  return Math.max(0, Math.min(100, (((value ?? min) - min) / (max - min)) * 100))
}

// The volume fader: a cap riding in a slot, its scale printed beside it. Along the ridge of the
// cap's top runs a lamp, lit while the room plays.
export function Fader({ value, onCommit, label, min = 0, max = 100, disabled = false, wheelStep = 2, className = '', lamp = false }) {
  const { shown, change, finish, dragging } = useLive(value, onCommit)
  return (
    <div className={cx('sv-fader', className)} data-disabled={disabled || undefined} data-dragging={dragging || undefined}
         style={{ '--sv-pct': percent(shown, min, max) }}>
      <span className="sv-fader-scale" aria-hidden="true" />
      <span className="sv-fader-slot" aria-hidden="true"><span className="sv-fader-fill" /></span>
      <span className="sv-fader-cap" aria-hidden="true"><span className="sv-key-walls"><i /><i /><i /><i /><i /><i /><i /><i /></span><span className="sv-fader-top"><span className="sv-fader-lamp" data-on={lamp || undefined} /></span></span>
      <input type="range" min={min} max={max} step={1} value={shown ?? min} aria-label={label} disabled={disabled} data-wheel-step={wheelStep || undefined}
             onChange={(event) => change(Number(event.target.value))} onPointerUp={finish} onKeyUp={finish} onBlur={finish} />
    </div>
  )
}

// A rotary selector with a position for each choice, as the system selector is: a
// fluted knob on a skirt, in the navy keys' plastic, with a white cap whose pointer runs
// down its side.
// It is seen from the front and a little above, as the keys are, so the pointer
// swings across the front of the knob. A press on a mark turns it there, a press on
// the knob turns it one position on, and a drag sideways turns it by hand; let go,
// it settles on the nearest position.
const KNOB = { w: 120, cx: 60, tilt: 0.45, skirt: 21, skirtBase: 50, skirtTop: 43, body: 15.5, bodyTop: 13, top: 26, cap: 11, capTop: 22, marks: 42, strip: 2.3, flute: 24 }
// The broad knob, in the same box: wider across and tipped further toward the reader, so more of
// its face shows, its sides shorter to keep it no taller and straight, a narrow lip at its foot,
// and a black face with the white pointer running up to its edge.
const BROAD_KNOB = { ...KNOB, tilt: 0.6, skirt: 33, skirtBase: 38, skirtTop: 34.5, body: 30.5, bodyTop: 30.5, top: 23.5, cap: 27, capTop: 22, marks: 57, strip: 3.4, flute: 15, face: 'black' }
const RAD = Math.PI / 180

// A point on a circle of radius r at height y, the knob turned `deg` from facing the viewer.
function onKnob(g, deg, r, y) {
  return [g.cx + r * Math.sin(deg * RAD), y + g.tilt * r * Math.cos(deg * RAD)]
}

// The side of a (tapered) cylinder between two heights: the front halves of both rims.
function side(g, rBottom, yBottom, rTop, yTop) {
  const { cx, tilt } = g
  return `M${cx - rTop},${yTop} L${cx - rBottom},${yBottom} A${rBottom},${tilt * rBottom} 0 0 0 ${cx + rBottom},${yBottom} `
    + `L${cx + rTop},${yTop} A${rTop},${tilt * rTop} 0 0 1 ${cx - rTop},${yTop} Z`
}

function quad(points) {
  return 'M' + points.map((p) => p.map((v) => v.toFixed(2)).join(',')).join(' L') + ' Z'
}

export function KnobSwitch({ options, value, onChange, label = '', broad = false }) {
  const g = broad ? BROAD_KNOB : KNOB
  const n = options.length
  const spread = n > 1 ? Math.min(110, 55 * (n - 1)) : 0
  const angleOf = (i) => (n > 1 ? -spread / 2 + (i * spread) / (n - 1) : 0)
  const at = Math.max(0, options.findIndex((o) => o.id === value))
  const [shown, setShown] = useState(angleOf(at))
  const [drag, setDrag] = useState(null)
  const shownRef = useRef(shown)
  shownRef.current = shown

  // Turn to the chosen position in an eased sweep, quick to start and settling gently; a hand on
  // the knob turns it directly. The choice is passed on once the knob has come to rest there: what
  // it changes redraws much of the console, and done mid-turn that would make the turn stutter.
  const [pending, setPending] = useState(null)
  const target = pending ?? at
  const report = useRef(onChange)
  report.current = onChange
  const optionsRef = useRef(options)
  optionsRef.current = options
  useEffect(() => { if (pending !== null && pending === at) setPending(null) }, [at, pending])
  useEffect(() => {
    if (drag) return undefined
    const from = shownRef.current
    const to = angleOf(target)
    const settle = () => { if (pending !== null && pending !== at) report.current(optionsRef.current[pending]?.id) }
    if (Math.abs(from - to) < 0.01) { settle(); return undefined }
    let frame = 0
    const start = performance.now()
    const step = (now) => {
      const p = Math.min(1, (now - start) / (220 + Math.abs(to - from) * 1.2))
      setShown(from + (to - from) * (1 - (1 - p) ** 4))
      if (p < 1) frame = requestAnimationFrame(step)
      else settle()
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target, n, drag]) // eslint-disable-line react-hooks/exhaustive-deps

  // A knob turns without a key's sound.
  const choose = (i) => {
    if (options[i] && i !== target) setPending(i)
  }
  const nearest = (deg) => {
    let best = 0
    options.forEach((_, i) => { if (Math.abs(angleOf(i) - deg) < Math.abs(angleOf(best) - deg)) best = i })
    return best
  }
  const onKeyDown = (event) => {
    const by = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
    if (!by) return
    event.preventDefault()
    choose((target + by + n) % n)
  }
  // The wheel turns it a position a notch, up or right toward the last, and stops at either end.
  // A wheel in pixels (a trackpad) turns it once per hundred, the rest carried to the next event.
  const root = useRef(null)
  const turn = useRef(null)
  turn.current = (by) => choose(Math.max(0, Math.min(n - 1, target + by)))
  useEffect(() => {
    const el = root.current
    if (!el) return undefined
    let carry = 0
    const wheel = (event) => {
      event.preventDefault()
      const mode = event.deltaMode
      const along = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? -event.deltaY : event.deltaX
      if (!along) return
      if (mode !== 0) { turn.current(Math.sign(along)); return }
      carry += along
      const notches = Math.trunc(carry / 100)
      if (!notches) return
      carry -= notches * 100
      turn.current(Math.sign(notches))
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  }, [])
  // The hand is kept in a ref as well, so pointer events that land before a render still see it.
  const hand = useRef(null)
  const grip = (next) => { hand.current = next; setDrag(next) }
  const onPointerDown = (event) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const box = event.currentTarget.getBoundingClientRect()
    grip({ x: event.clientX, from: shownRef.current, moved: false, at: box.width ? ((event.clientX - box.left) / box.width) * g.w : g.cx })
  }
  // A tap with no turn in it chooses the position nearest where it landed, across the knob: its
  // left for the first, its middle, its right for the last.
  const tapped = (x) => {
    let best = 0
    options.forEach((_, i) => {
      const along = (j) => Math.abs(g.cx + g.marks * Math.sin(angleOf(j) * RAD) - x)
      if (along(i) < along(best)) best = i
    })
    return best
  }
  const onPointerMove = (event) => {
    const held = hand.current
    if (!held) return
    const dx = event.clientX - held.x
    if (!held.moved && Math.abs(dx) < 3) return
    const limit = spread / 2 + 12
    if (!held.moved) grip({ ...held, moved: true })
    const deg = Math.max(-limit, Math.min(limit, held.from + dx * 1.6))
    shownRef.current = deg
    setShown(deg)
  }
  const onPointerUp = () => {
    const held = hand.current
    if (!held) return
    grip(null)
    choose(held.moved ? nearest(shownRef.current) : tapped(held.at))
  }

  const { w, cx, tilt, skirt, skirtBase, skirtTop, body, bodyTop, top, cap, capTop, marks } = g
  // The flutes turn with the knob; only those on the near side show.
  const flutes = []
  for (let f = 0; f < 360; f += g.flute) {
    const deg = shown + f + g.flute / 2
    const c = Math.cos(deg * RAD)
    if (c < 0.05) continue
    const [x0, y0] = onKnob(g, deg, body, skirtTop)
    const [x1, y1] = onKnob(g, deg, bodyTop, top)
    const lit = Math.sin((deg + 40) * RAD) < 0
    // A rib turning round to the edge fades as it goes, rather than vanishing in a step.
    flutes.push(<line key={f} x1={x0} y1={y0} x2={x1} y2={y1} opacity={Math.min(1, (c - 0.05) / 0.3)} className={lit ? 'sv-knob-flute-lit' : 'sv-knob-flute'} />)
  }
  // The pointer: a white strip down the body, joined to the cap across the body's top.
  const facing = Math.cos(shown * RAD)
  const half = g.strip
  const wB = half / body / RAD
  const wT = half / bodyTop / RAD
  const strip = quad([onKnob(g, shown - wB, body + 0.4, skirtTop - 0.5), onKnob(g, shown + wB, body + 0.4, skirtTop - 0.5),
    onKnob(g, shown + wT, bodyTop + 0.4, top), onKnob(g, shown - wT, bodyTop + 0.4, top)])
  const tab = quad([onKnob(g, shown - half / cap / RAD, cap - 0.5, top), onKnob(g, shown + half / cap / RAD, cap - 0.5, top),
    onKnob(g, shown + wT, bodyTop + 0.4, top), onKnob(g, shown - wT, bodyTop + 0.4, top)])
  const shade = Math.max(0, Math.min(0.55, 0.45 * (1 - Math.cos((shown + 25) * RAD)) + 0.06))
  // On the black face the pointer is one band, so nothing shows a seam: up the body, across the
  // rounded top edge, up the face's own short side, and a little way in over the face.
  const inset = cap - 8.5
  const along = (r, y, sign) => onKnob(g, shown + sign * half / r / RAD, r, y)
  const pointer = quad([
    along(body + 0.4, skirtTop - 0.5, -1), along(bodyTop + 0.4, top, -1), along(cap + 0.2, top, -1), along(cap + 0.2, capTop, -1), along(inset, capTop, -1),
    along(inset, capTop, 1), along(cap + 0.2, capTop, 1), along(cap + 0.2, top, 1), along(bodyTop + 0.4, top, 1), along(body + 0.4, skirtTop - 0.5, 1),
  ])
  return (
    <div ref={root} className="sv-knobswitch" data-broad={broad || undefined} role="radiogroup" aria-label={label || undefined} data-dragging={drag?.moved || undefined}
         onKeyDown={onKeyDown}>
      <svg className="sv-knob" viewBox={`0 0 ${w} 76`} aria-hidden="true" focusable="false"
           onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => grip(null)}>
        <defs>
          <linearGradient id="sv-knob-black" x1="0" x2="1">
            <stop offset="0" className="sv-knob-c0" /><stop offset="0.28" className="sv-knob-c1" />
            <stop offset="0.42" className="sv-knob-c2" /><stop offset="0.8" className="sv-knob-c3" /><stop offset="1" className="sv-knob-c4" />
          </linearGradient>
          <linearGradient id="sv-knob-capside" x1="0" x2="1">
            <stop offset="0" stopColor="#b9b8b2" /><stop offset="0.3" stopColor="#f6f5f0" /><stop offset="1" stopColor="#a9a8a2" />
          </linearGradient>
          <radialGradient id="sv-knob-captop" cx="0.4" cy="0.35" r="0.75">
            <stop offset="0" stopColor="#ffffff" /><stop offset="0.7" stopColor="#efeee9" /><stop offset="1" stopColor="#d6d5cf" />
          </radialGradient>
          <linearGradient id="sv-knob-capside-black" x1="0" x2="1">
            <stop offset="0" stopColor="#0c0d0f" /><stop offset="0.3" stopColor="#34373d" /><stop offset="1" stopColor="#08090a" />
          </linearGradient>
          {/* The broad knob's top edge, rounded over: light along its crown, darker where it turns
              down into the side. */}
          <radialGradient id="sv-knob-roundrim">
            <stop offset="0.78" className="sv-knob-c3" /><stop offset="0.88" className="sv-knob-c1" />
            <stop offset="0.95" className="sv-knob-c2" /><stop offset="1" className="sv-knob-c4" />
          </radialGradient>
          <radialGradient id="sv-knob-shadow">
            <stop offset="0.55" stopColor="#000" stopOpacity="0.35" /><stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>
        </defs>
        {options.map((o, i) => {
          const [x0, y0] = onKnob(g, angleOf(i), skirt + 3, skirtBase)
          const [x1, y1] = onKnob(g, angleOf(i), skirt + 6, skirtBase)
          return <line key={o.id} x1={x0} y1={y0} x2={x1} y2={y1} className="sv-knob-tick" />
        })}
        <ellipse cx={cx + 1.5} cy={skirtBase + 2} rx={skirt + 4} ry={tilt * (skirt + 4)} fill="url(#sv-knob-shadow)" />
        <path d={side(g, skirt, skirtBase, skirt - 0.5, skirtTop)} fill="url(#sv-knob-black)" />
        <ellipse cx={cx} cy={skirtTop} rx={skirt - 0.5} ry={tilt * (skirt - 0.5)} className="sv-knob-ledge" />
        <path d={side(g, body, skirtTop, bodyTop, top)} fill="url(#sv-knob-black)" />
        {flutes}
        <ellipse cx={cx} cy={top} rx={bodyTop} ry={tilt * bodyTop} className={g.face === 'black' ? undefined : 'sv-knob-rim'} fill={g.face === 'black' ? 'url(#sv-knob-roundrim)' : undefined} />
        {g.face !== 'black' && facing > 0.05 && <path d={strip} className="sv-knob-white" />}
        {g.face !== 'black' && facing > 0.05 && <path d={strip} fill="#000" opacity={shade} />}
        {g.face !== 'black' && <path d={tab} className="sv-knob-white" />}
        <path d={side(g, cap, top, cap, capTop)} fill={g.face === 'black' ? 'url(#sv-knob-capside-black)' : 'url(#sv-knob-capside)'} />
        <ellipse cx={cx} cy={capTop} rx={cap} ry={tilt * cap} fill={g.face === 'black' ? '#1d1f23' : 'url(#sv-knob-captop)'} />
        {/* A fine ring turned into the black face, a few pixels in from its edge. */}
        {g.face === 'black' && <ellipse cx={cx} cy={capTop} rx={cap - 3} ry={tilt * (cap - 3)} fill="none" stroke="#bec4ce" strokeOpacity="0.22" strokeWidth="0.6" />}
        {g.face === 'black' && facing > 0.05 && <path d={pointer} className="sv-knob-white" />}
        {g.face === 'black' && facing > 0.05 && <path d={pointer} fill="#000" opacity={shade} />}
      </svg>
      {options.map((o, i) => {
        const [x, y] = onKnob(g, angleOf(i), marks, skirtBase)
        return (
          <button key={o.id} type="button" role="radio" aria-checked={i === at} tabIndex={i === at ? 0 : -1}
                  style={{ left: `${(x / w) * 100}%`, top: `${(y / 76) * 100}%` }} onClick={() => choose(i)}>{o.label}</button>
        )
      })}
    </div>
  )
}

// The same choice as a slide switch, for a phone's header, where the knob stands too tall: a
// slot with a navy thumb that slides between the printed positions. A tap on a position moves
// it there, a drag carries the thumb and drops it on the nearest, and the arrow keys step it.
export function SlideSwitch({ options, value, onChange, label = '' }) {
  const n = options.length
  const at = Math.max(0, options.findIndex((o) => o.id === value))
  const root = useRef(null)
  const hand = useRef(null)
  const [drag, setDrag] = useState(null)
  const choose = (i) => {
    const next = options[i]
    if (next && i !== at) { keySound('down', 0.6); onChange(next.id) }
  }
  const onKeyDown = (event) => {
    const by = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
    if (!by) return
    event.preventDefault()
    choose(Math.max(0, Math.min(n - 1, at + by)))
  }
  const onPointerDown = (event) => {
    if (event.button !== 0) return
    hand.current = { id: event.pointerId, x: event.clientX, moved: false }
  }
  const onPointerMove = (event) => {
    const held = hand.current
    if (!held) return
    const dx = event.clientX - held.x
    if (!held.moved) {
      if (Math.abs(dx) < 4) return
      held.moved = true
      root.current.setPointerCapture(held.id)
    }
    const step = root.current.clientWidth / n
    const shift = Math.max(-at * step, Math.min((n - 1 - at) * step, dx))
    setDrag(shift)
  }
  const onPointerUp = () => {
    const held = hand.current
    hand.current = null
    if (!held?.moved) return
    const step = root.current.clientWidth / n
    const shift = drag ?? 0
    setDrag(null)
    choose(Math.max(0, Math.min(n - 1, at + Math.round(shift / step))))
  }
  return (
    <div ref={root} className="sv-slide" role="radiogroup" aria-label={label || undefined} onKeyDown={onKeyDown}
         data-dragging={drag != null || undefined} style={{ '--sv-slide-n': n, '--sv-slide-at': at, '--sv-slide-drag': `${drag ?? 0}px` }}
         onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
         onPointerCancel={() => { hand.current = null; setDrag(null) }}>
      <span className="sv-slide-thumb" aria-hidden="true" />
      {options.map((o, i) => (
        <button key={o.id} type="button" role="radio" aria-checked={i === at} tabIndex={i === at ? 0 : -1}
                onClick={() => choose(i)}>{o.label}</button>
      ))}
    </div>
  )
}

// --- the screen ----------------------------------------------------------------------

// A music service's logo on the screen. Unless art is shown in its own colors, it is drawn in
// the phosphor: lit where the logo is light, dark where it is dark or clear, as the tube would.
// The picture stays in the page, hidden, to size the box and to show when color is on.
export function SvcImg({ src, className = '' }) {
  return (
    <span className="sv-svcimg" style={{ '--sv-src': `url("${String(src).replace(/["\\\n]/g, encodeURIComponent)}")` }}>
      <img src={src} alt="" className={className || undefined} />
    </span>
  )
}


// A bracketed button. `line` is drawn in outline, `solid` in inverse video, `text` bare.
export function Btn({ children, variant = 'line', size = 'm', icon = null, trailing = null, className = '', type = 'button', selected = null, ...rest }) {
  return (
    <button type={type} className={cx('sv-btn', `sv-btn-${variant}`, `sv-btn-${size}`, className)}
            aria-pressed={selected === null ? undefined : Boolean(selected)} {...rest}>
      {icon && <span className="sv-btn-icon" aria-hidden="true">{icon}</span>}
      {children != null && children !== '' && <span className="sv-btn-label">{children}</span>}
      {trailing && <span className="sv-btn-icon" aria-hidden="true">{trailing}</span>}
    </button>
  )
}

// A glyph alone in a box.
export function IconBtn({ label, children, selected = null, badge = null, className = '', size = 'm', ...rest }) {
  return (
    <button type="button" className={cx('sv-ibtn', `sv-ibtn-${size}`, className)} aria-label={label} data-tip={label || undefined}
            aria-pressed={selected === null ? undefined : Boolean(selected)} {...rest}>
      {children}
      {badge != null && badge !== 0 && <span className="sv-badge">{badge > 999 ? '999+' : badge}</span>}
    </button>
  )
}

// A switch, drawn as a box that is filled or empty.
export function Toggle({ checked, onChange, label = '', ariaLabel = '', disabled = false }) {
  return (
    <label className="sv-toggle" data-disabled={disabled || undefined}>
      <input type="checkbox" role="switch" checked={Boolean(checked)} disabled={disabled} aria-label={label ? undefined : (ariaLabel || undefined)}
             onChange={(event) => onChange(event.target.checked)} />
      <span className="sv-toggle-box" aria-hidden="true" />
      {label && <span className="sv-toggle-label">{label}</span>}
    </label>
  )
}

// A box to tick a row with.
export function Tick({ checked, onChange, label }) {
  return (
    <label className="sv-tick" title={label}>
      <input type="checkbox" checked={Boolean(checked)} onChange={onChange} aria-label={label} />
      <span aria-hidden="true" />
    </label>
  )
}

// One choice of a few, in a row; one tab stop, the arrow keys moving the choice.
export function Seg({ options, value, onChange, label = '', className = '' }) {
  const chosen = options.some((o) => o.id === value) ? value : options[0]?.id
  const onKeyDown = (event) => {
    // A row of choices answers to left and right; up and down are left to move the cursor away.
    const by = { ArrowRight: 1, ArrowLeft: -1 }[event.key]
    if (!by) return
    event.preventDefault()
    const at = options.findIndex((o) => o.id === chosen)
    const next = options[(at + by + options.length) % options.length]
    if (!next) return
    onChange(next.id)
    event.currentTarget.querySelectorAll('button')[options.indexOf(next)]?.focus()
  }
  return (
    <div className={cx('sv-seg', className)} role="radiogroup" aria-label={label || undefined} onKeyDown={onKeyDown}>
      {options.map((option) => (
        <button key={option.id} type="button" role="radio" aria-checked={chosen === option.id} title={option.title || undefined}
                tabIndex={option.id === chosen ? 0 : -1} onClick={() => onChange(option.id)}>
          {option.icon}
          {option.label && <span>{option.label}</span>}
        </button>
      ))}
    </div>
  )
}

// Which system a program shows, only when there is an S1 and an S2 to choose between.
export function SystemPicker({ households, value, onChange, all = true, label = '' }) {
  const { t } = useI18n()
  if (!systemChoiceMatters(households)) return null
  const ordered = orderedHouseholds(households)
  const options = [...ordered.map((h) => ({ id: h.id, label: h.generation })), ...(all ? [{ id: 'all', label: t('sv.all') }] : [])]
  return <Seg options={options} value={value || (all ? 'all' : ordered[0]?.id)} onChange={onChange} label={label || t('desk.showSystem')} />
}

// A level drawn in block characters: lit cells for what is set, dim ones for the rest. A
// fine-stepped bar (the EQ glides in twentieths) still moves a whole step per key.
export function Bar({ value, onCommit, label, min = 0, max = 100, step = 1, disabled = false, format = null, wheelStep = null, showValue = true, className = '', center = false }) {
  const { shown, change, finish, dragging } = useLive(value, onCommit)
  const pct = percent(shown, min, max)
  const text = format ? format(shown) : Math.round(shown ?? min)
  return (
    <div className={cx('sv-bar', className)} data-disabled={disabled || undefined} data-dragging={dragging || undefined} data-center={center || undefined}
         style={{ '--sv-pct': pct }}>
      <span className="sv-bar-track" aria-hidden="true"><span className="sv-bar-fill" /><span className="sv-bar-head" /></span>
      {showValue && <output className="sv-bar-value" aria-hidden="true">{text}</output>}
      <input type="range" min={min} max={max} step={step} value={shown ?? min} aria-label={label} disabled={disabled} data-wheel-step={wheelStep || undefined}
             aria-valuetext={String(text)}
             onChange={(event) => change(Number(event.target.value))}
             onKeyDown={(event) => {
               if (step >= 1) return
               const by = { ArrowRight: 1, ArrowUp: 1, PageUp: 1, ArrowLeft: -1, ArrowDown: -1, PageDown: -1 }[event.key]
               if (by === undefined) return
               event.preventDefault()
               change(Math.max(min, Math.min(max, Math.round(shown ?? min) + by)))
             }}
             onPointerUp={finish} onKeyUp={finish} onBlur={finish} />
    </div>
  )
}

// A text field: its label above, the entry under it.
export function Field({ label, value, onChange, onEnter = null, type = 'text', placeholder = '', autoFocus = false, autoComplete = 'off', className = '', leading = null, trailing = null, disabled = false, name = '' }) {
  return (
    <label className={cx('sv-field', className)} data-disabled={disabled || undefined}>
      {label && <span className="sv-field-label">{label}</span>}
      <span className="sv-field-box">
        {leading && <span className="sv-field-lead" aria-hidden="true">{leading}</span>}
        <input type={type} value={value} placeholder={placeholder} autoFocus={autoFocus} data-autofocus={autoFocus || undefined}
               autoComplete={autoComplete} disabled={disabled} name={name || undefined}
               onFocus={(event) => { if (autoFocus) event.target.select?.() }}
               onChange={(event) => onChange(event.target.value)}
               onKeyDown={(event) => { if (event.key === 'Enter' && onEnter) onEnter() }} />
        {trailing && <span className="sv-field-trail">{trailing}</span>}
      </span>
    </label>
  )
}

// The command line: a prompt, the entry, and whatever the program puts beside it.
export const Prompt = React.forwardRef(function Prompt({ value, onChange, placeholder, prompt = '>', leading = null, trailing = null, onKeyDown, label }, ref) {
  return (
    <div className="sv-prompt" role="search">
      {leading}
      <span className="sv-prompt-sign" aria-hidden="true">{prompt}</span>
      <input ref={ref} type="search" value={value} placeholder={placeholder} aria-label={label || placeholder} spellCheck={false}
             onChange={(event) => onChange(event.target.value)} onKeyDown={onKeyDown} />
      {trailing}
    </div>
  )
})

// --- menus -------------------------------------------------------------------------

export function Menu({ x, y, anchor = null, align = 'left', onClose, children, title = '', width = 0 }) {
  const ref = useRef(null)
  const [pos, setPos] = useState({ left: x || 0, top: y || 0, ready: false })
  useDismiss(ref, onClose)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = rectOf(el)
    let left = x ?? 0
    let top = y ?? 0
    if (anchor) {
      const a = rectOf(anchor)
      left = align === 'right' ? a.right - rect.width : a.left
      top = a.bottom + 2
      if (top + rect.height > viewH() - 8) top = Math.max(8, a.top - rect.height - 2)
    }
    left = Math.max(8, Math.min(left, viewW() - rect.width - 8))
    top = Math.max(8, Math.min(top, viewH() - rect.height - 8))
    setPos({ left, top, ready: true })
  }, [x, y, anchor, align])
  // The menu takes focus when it opens, on its checked item or its first; the arrow keys walk
  // its items and Escape hands focus back to what opened it.
  const items = () => [...(ref.current?.querySelectorAll('[role^="menuitem"]:not(:disabled)') || [])]
  useEffect(() => {
    if (!pos.ready) return
    const list = items()
    ;(list.find((el) => el.getAttribute('aria-checked') === 'true') || list[0])?.focus({ preventScroll: false })
  }, [pos.ready]) // eslint-disable-line react-hooks/exhaustive-deps
  const onKeyDown = (event) => {
    const list = items()
    const at = list.indexOf(document.activeElement)
    const go = (i) => { event.preventDefault(); list[(i + list.length) % list.length]?.focus() }
    if (event.key === 'ArrowDown') go(at + 1)
    else if (event.key === 'ArrowUp') go(at < 0 ? list.length - 1 : at - 1)
    else if (event.key === 'Home') go(0)
    else if (event.key === 'End') go(list.length - 1)
    else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose?.(); anchor?.focus?.() }
    else if (event.key === 'Tab') { onClose?.() }
  }
  return createPortal(
    <div className="sv-menu sv-screenlike" ref={ref} role="menu" data-ready={pos.ready || undefined} onKeyDown={onKeyDown}
         style={{ left: pos.left, top: pos.top, minWidth: width || undefined }} onContextMenu={(event) => event.preventDefault()}>
      {title && <p className="sv-menu-title">{title}</p>}
      {children}
    </div>,
    document.body,
  )
}

export function MenuItem({ children, onSelect, disabled = false, icon = null, checked = null, danger = false, note = '', trailing = null }) {
  return (
    <button type="button" role={checked === null ? 'menuitem' : 'menuitemradio'} className="sv-menu-item"
            aria-checked={checked === null ? undefined : checked} disabled={disabled} data-danger={danger || undefined} title={note || undefined}
            onClick={(event) => { event.stopPropagation(); onSelect?.() }}>
      <span className="sv-menu-mark" aria-hidden="true">{checked ? <G.Check size={12} /> : icon}</span>
      <span className="sv-menu-label">{children}</span>
      {trailing && <span className="sv-menu-trail">{trailing}</span>}
    </button>
  )
}
export function MenuSep() { return <span className="sv-menu-sep" role="separator" /> }

// A dropdown: the chosen value in brackets, the choices in a menu. It takes <option>
// children and calls onChange with an event-like { target: { value } }, so it drops in where
// a <select> was.
export function Select({ value, onChange, disabled = false, children, label = '', className = '', ...rest }) {
  const [open, setOpen] = useState(null)
  const options = React.Children.toArray(children).flatMap((child) => (child?.type === 'optgroup' ? React.Children.toArray(child.props.children) : [child]))
    .filter((child) => child && child.type === 'option')
    .map((child) => ({ value: String(child.props.value ?? ''), label: child.props.children, disabled: Boolean(child.props.disabled) }))
  const current = options.find((o) => o.value === String(value ?? '')) || options[0]
  const pick = (next) => { setOpen(null); if (next !== String(value ?? '')) onChange?.({ target: { value: next } }) }
  return (
    <>
      <button type="button" className={cx('sv-select', className)} disabled={disabled} data-open={open ? '' : undefined}
              aria-haspopup="menu" aria-expanded={Boolean(open)} aria-label={label || undefined} {...rest}
              onClick={(event) => setOpen(open ? null : event.currentTarget)}
              onKeyDown={(event) => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(event.currentTarget) } }}>
        <span className="sv-select-value">
          {options.map((o) => <span key={o.value} className="sv-select-sizer" aria-hidden="true">{o.label}</span>)}
          <span className="sv-select-current">{current?.label}</span>
        </span>
        <G.Down size={12} className="sv-select-chev" />
      </button>
      {open && (
        <Menu anchor={open} width={rectOf(open).width} onClose={() => setOpen(null)}>
          <div className="sv-menu-scroll">
            {options.map((o) => (
              <MenuItem key={o.value} checked={o.value === current?.value} disabled={o.disabled} onSelect={() => pick(o.value)}>{o.label}</MenuItem>
            ))}
          </div>
        </Menu>
      )}
    </>
  )
}

// --- windows -------------------------------------------------------------------------

// A window over the console's screen. `dialog` asks one thing; `panel` holds a page of its
// own (a room's sound, Info & Options); `full` takes the whole screen (the alarm editor,
// adding a service). On a phone every kind takes the whole screen. It switches on the way a
// tube does, a line opening into the picture, and off the same way; Escape and the dim area
// around it close it, and focus goes in and comes back.
const WindowExit = React.createContext(null)
export function Window({ kind = 'dialog', title = '', onClose, children, className = '' }) {
  const ref = useRef(null)
  const [exiting, setExiting] = useState(false)
  const leaving = useRef(false)
  const exit = useCallback((then) => {
    if (leaving.current) return
    leaving.current = true
    setExiting(true)
    setTimeout(() => (then || onClose)?.(), 80)
  }, [onClose])
  const exitRef = useRef(exit)
  exitRef.current = exit
  useEffect(() => {
    const key = (event) => { if (event.key === 'Escape') { event.stopPropagation(); exitRef.current() } }
    document.addEventListener('keydown', key)
    const previous = document.activeElement
    const first = ref.current?.querySelector('[data-autofocus]')
    if (first) first.focus?.()
    else ref.current?.focus?.()
    return () => { document.removeEventListener('keydown', key); previous?.focus?.() }
  }, [])
  return createPortal(
    <div className={cx('sv-layer', `sv-layer-${kind}`)} role="presentation" data-exiting={exiting || undefined}
         onPointerDown={(event) => { if (event.target === event.currentTarget) exit() }}>
      <div className={cx('sv-window', 'sv-screenlike', `sv-window-${kind}`, className)} role="dialog" aria-modal="true" aria-label={title || undefined} ref={ref} tabIndex={-1}>
        <WindowExit.Provider value={exit}>{children}</WindowExit.Provider>
      </div>
    </div>,
    document.body,
  )
}

// A window's title row, in inverse video: the way back, the title, its actions, and close.
export function WindowBar({ title, sub = '', onClose = null, back = null, children }) {
  const { t } = useI18n()
  const exit = React.useContext(WindowExit)
  return (
    <header className="sv-window-bar">
      {back && <IconBtn label={t('common.back')} onClick={back} className="sv-window-back"><G.Back size={12} /></IconBtn>}
      <div className="sv-window-titles">
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {children}
      {onClose && <IconBtn label={t('common.close')} onClick={() => (exit ? exit(onClose) : onClose())} className="sv-window-close"><G.Close size={12} /></IconBtn>}
    </header>
  )
}

function ExitBtn({ onClose, children }) {
  const exit = React.useContext(WindowExit)
  return <Btn variant="line" onClick={() => (exit ? exit(onClose) : onClose?.())}>{children}</Btn>
}

// A dialog asking one thing, or asking for a name when `input` is set.
export function Confirm({ title, body, action, cancelLabel, onConfirm, onClose, danger = false, input = null, disabled = false, icon = null, children }) {
  const { t } = useI18n()
  const [value, setValue] = useState(input?.initial || '')
  const ok = input ? value.trim() && (input.allowSame || value.trim() !== (input.initial || '')) : true
  const submit = () => { if (ok && !disabled) onConfirm(input ? value.trim() : undefined) }
  return (
    <Window kind="dialog" title={title} onClose={onClose} className="sv-confirm">
      <WindowBar title={title} onClose={onClose} />
      <div className="sv-window-body">
        {icon && <span className="sv-confirm-icon" aria-hidden="true">{icon}</span>}
        {body && <p>{body}</p>}
        {input && <Field label={input.label || title} value={value} autoFocus placeholder={input.placeholder || ''} onChange={setValue} onEnter={submit} />}
        {children}
      </div>
      <footer className="sv-window-actions">
        <ExitBtn onClose={onClose}>{cancelLabel || t('common.cancel')}</ExitBtn>
        <Btn variant="solid" data-danger={danger || undefined} disabled={!ok || disabled} onClick={submit}>{action}</Btn>
      </footer>
    </Window>
  )
}

// --- lists and states ------------------------------------------------------------------

export function Row({ lead = null, title, sub = '', over = '', trail = null, onClick, selected = false, disabled = false, className = '', ...rest }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag type={onClick ? 'button' : undefined} className={cx('sv-li', onClick && 'sv-li-action', className)} onClick={onClick}
         data-selected={selected || undefined} disabled={onClick ? disabled : undefined} aria-disabled={!onClick && disabled ? true : undefined} {...rest}>
      {lead && <span className="sv-li-lead">{lead}</span>}
      <span className="sv-li-text">
        {over && <span className="sv-li-over">{over}</span>}
        <span className="sv-li-title">{title}</span>
        {sub && <span className="sv-li-sub">{sub}</span>}
      </span>
      {trail && <span className="sv-li-trail">{trail}</span>}
    </Tag>
  )
}

export function Empty({ icon = null, title, body = '', children }) {
  return (
    <div className="sv-empty">
      {icon && <span className="sv-empty-icon" aria-hidden="true">{icon}</span>}
      <p className="sv-empty-title">{title}</p>
      {body && <p className="sv-empty-body">{body}</p>}
      {children}
    </div>
  )
}

// Something under way: its words, and a run of blocks filling and emptying.
export function Busy({ label = '', inline = false }) {
  return (
    <div className={cx('sv-busy', inline && 'sv-busy-inline')} role="status" aria-label={label || undefined}>
      <span className="sv-busy-blocks" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /></span>
      {label && <span className="sv-busy-label">{label}</span>}
    </div>
  )
}

export function Kbd({ children, onPress = null, label = '' }) {
  // A key cap that is also the thing it names (the Esc on a window that Esc closes) can be pressed.
  if (onPress) return <button type="button" className="sv-kbd sv-kbd-press" onClick={onPress} aria-label={label || undefined} data-tip={label || undefined}>{children}</button>
  return <kbd className="sv-kbd">{children}</kbd>
}

// The message line: what just happened, and the notices the system raised, newest last. A line
// that can be dismissed goes at a press anywhere on it, or on its button.
export function Ticker({ items, onDismiss }) {
  const { t } = useI18n()
  return (
    <div className="sv-ticker" aria-live="polite">
      {items.map((item) => (
        <div key={item.id} className="sv-ticker-line" data-kind={item.kind || undefined} role="status" data-dismissible={item.dismissible || undefined}
             data-leaving={item.leaving || undefined} aria-hidden={item.leaving || undefined}
             title={item.dismissible ? t('common.dismiss') : undefined} onClick={item.dismissible ? () => onDismiss(item) : undefined}>
          <span className="sv-ticker-sign" aria-hidden="true">*</span>
          <span className="sv-ticker-text">
            {item.title && <strong>{item.title}</strong>}
            <span>{item.text}</span>
          </span>
          {item.dismissible && <IconBtn size="s" label={t('common.dismiss')} onClick={(event) => { event.stopPropagation(); onDismiss(item) }}><G.Close size={14} /></IconBtn>}
        </div>
      ))}
    </div>
  )
}

// A tooltip in the screen's own type, in place of the browser's: shown after half a second
// over a control that names itself, or at once when the keyboard reaches it.
export function TooltipLayer() {
  const [tip, setTip] = useState(null)
  const ref = useRef(null)
  useEffect(() => {
    let timer = null
    let current = null
    // A control's name can change or go while the pointer rests on it (Mute's "Unmute" goes when
    // the room is unmuted): the tip follows it, and with no name left there is no tip, never an
    // empty one.
    let shown = false
    const watch = new MutationObserver(() => { if (current && shown) show(current) })
    const hide = () => { clearTimeout(timer); watch.disconnect(); current = null; shown = false; setTip(null) }
    const show = (el) => {
      const text = el.isConnected ? el.getAttribute('data-tip') : ''
      shown = Boolean(text)
      if (!text) { setTip(null); return }
      const r = rectOf(el)
      setTip({ text, x: r.left + r.width / 2, top: r.top, bottom: r.bottom })
    }
    const follow = (el) => { watch.disconnect(); watch.observe(el, { attributes: true, attributeFilter: ['data-tip'] }) }
    const over = (event) => {
      if (event.pointerType === 'touch') return
      const el = event.target.closest?.('[data-tip]')
      if (el === current) return
      hide()
      if (!el || el.disabled) return
      current = el
      follow(el)
      timer = setTimeout(() => show(el), 500)
    }
    const out = (event) => { if (current && !current.contains(event.relatedTarget)) hide() }
    const focus = (event) => {
      const el = event.target.closest?.('[data-tip]')
      hide()
      if (el && el.matches(':focus-visible')) { current = el; follow(el); show(el) }
    }
    const key = (event) => { if (event.key === 'Escape') hide() }
    document.addEventListener('pointerover', over)
    document.addEventListener('pointerout', out)
    document.addEventListener('focusin', focus)
    document.addEventListener('focusout', hide)
    document.addEventListener('pointerdown', hide, true)
    document.addEventListener('scroll', hide, true)
    document.addEventListener('keydown', key)
    return () => {
      clearTimeout(timer)
      watch.disconnect()
      document.removeEventListener('pointerover', over)
      document.removeEventListener('pointerout', out)
      document.removeEventListener('focusin', focus)
      document.removeEventListener('focusout', hide)
      document.removeEventListener('pointerdown', hide, true)
      document.removeEventListener('scroll', hide, true)
      document.removeEventListener('keydown', key)
    }
  }, [])
  const [pos, setPos] = useState(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!tip || !el) { setPos(null); return }
    const w = el.offsetWidth
    const h = el.offsetHeight
    const below = tip.top - h - 4 < 8
    setPos({ left: Math.max(8, Math.min(tip.x - w / 2, viewW() - w - 8)), top: below ? tip.bottom + 4 : tip.top - h - 4 })
  }, [tip])
  if (!tip) return null
  return createPortal(
    <div className="sv-tooltip sv-screenlike" role="tooltip" ref={ref} style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: -9999 }}>{tip.text}</div>,
    document.body,
  )
}
