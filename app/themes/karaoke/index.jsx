import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useOneAlert } from '../../frontend/src/lib/oneAlert.js'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { api } from '../../frontend/src/lib/api.js'
import { orderedHouseholds, parseDuration, isLiveStream, formatDuration } from '../../frontend/src/lib/format.js'
import { tvSignalLine } from '../../frontend/src/lib/tvFormat.js'
import { useElapsed } from '../../frontend/src/lib/useElapsed.js'
import AboutSonora, { useAboutRequest } from '../../frontend/src/components/AboutSonora.jsx'
import UpdateNotice from '../../frontend/src/components/UpdateNotice.jsx'
import { useShellSelection } from '../../frontend/src/lib/shellSelection.js'
import { isTyping, isCommand, keyOf, shuffleToggled, useFullscreen } from '../../frontend/src/lib/keys.js'
import { useThemeLanding } from '../../frontend/src/lib/theme.jsx'
import * as G from './glyphs.jsx'
import * as L from './legends.jsx'
import { Menu, MenuItem, MenuSep, Ticker, TooltipLayer, Bar, Dial, cx, idle } from './kit.jsx'
import { useServices, useFavorites,
         useQueue, householdOf, zoneForHousehold, playItems, pauseEverything, togglePlay, canAct, canPress, offQueue, groupTitle,
         canNext, canPrevious, nextTransport, emptied, replays, isLoaded } from './house.js'
import { hms, playThrough } from './modes.js'
import { QueueProgram } from './Queue.jsx'
import { AddToPlaylistWindow } from './AddToPlaylist.jsx'
import RoomsProgram, { GroupWindow } from './Rooms.jsx'
import SetupProgram, { ShortcutsWindow } from './Setup.jsx'
import InfoWindow, { ProseWindow } from './Info.jsx'
import Stage, { useStageLyrics } from './Stage.jsx'
import Binder from './Binder.jsx'
import { SongbookProvider, useFavoriteNumbers, lookUp, pad, DIGITS, BOOK_FIRST } from './songbook.jsx'
import { useWords, Words, FadingWords } from './words.jsx'
import { RoomSelector, Cell, spell, useEnter } from './Selector.jsx'
import { useBezel } from './bezel.js'
import { keyClick, soundReady, plugIn, plugOut } from './sound.js'
import { useBend, useBentKeys, canBend, BendFilter, FILTER_ID, BEND_IDS, LINES_IDS, WORDS_IDS, WORDS_REGION } from './curve.jsx'
import { usePrefs } from './prefs.js'
import { useSync, syncText, SyncKnob } from './Sync.jsx'
// The alternate design's own parts: its hanging microphones, the drum the room is shown on, the
// lyric sync wheel, and its keys' click.
import Mics from './alt/Mics.jsx'
import { RoomSelector as DrumSelector } from './alt/Selector.jsx'
import { SyncWheel } from './alt/Sync.jsx'
import { keyClick as altKeyClick } from './alt/sound.js'
import { usePressed } from './press.js'
import { loadFaces } from './fonts.js'
import { IMAGE_VARS, ALT_IMAGE_VARS, preloadImages, loadBookImages } from './images.js'
import { useSize, ptX, ptY, setScreen, watchScreen, overlayRoot } from './layout.js'
import { tokens } from './tokens.js'
import './karaoke.css'
import thumbnail from './thumbnail.webp'
import lightThumbnail from './thumbnail-light.webp'
import strings from './strings.js'

// Karaoke Machine: an all-in-one singing machine of the 1990s. A cabinet with
// a picture tube set into it, a microphone hanging off either side, and a
// short row of keys under the glass. Nearly all of the window is the tube,
// and what the tube shows most of the time is the stage: the words of the
// song over a picture, changing color as they are sung.
//
// The rest of the machine is on the tube too. The Queue, Rooms, and Settings keys each put
// their page on the screen in place of the stage, and pressed again give it back, so the
// page itself never scrolls. The keys do only what a singer reaches for: the song before
// and after, start and stop, how loud, the queue, the rooms, settings, and the full screen.
//
// Every song the machine can be asked for has a number. Typing one on the
// machine's number keys, or on the keyboard, and pressing Start plays it.
// The numbers are looked up in the songbook, a ring binder that the Songbook key
// lays open across the machine: a song asked for from there waits its turn at the
// end of the queue.
//
// The keys are lettered in Korean with the reader's language under it, and in
// words alone, as a singing room's own machines and remotes letter them: only a
// key that moves along (previous, next) carries arrows. The screen speaks the
// reader's language alone.

const PROGRAM_LABELS = { stage: 'lyrics.show', queue: 'common.queue', rooms: 'km.prog.rooms', setup: 'common.settings' }
// A number keyed in by the machine: one key every so many milliseconds, each held down this long.
const KEYED_EVERY = 280
const KEYED_DOWN = 160
const HERALD_MS = 640     // the number window's two flashes before a song picked in the songbook is keyed in

const ENTRY_MS = 8000    // a number left half typed is forgotten
const MISS_MS = 4800     // how long the window flashes Err at a number nothing answers to: four blinks
const RESERVED_MS = 4000 // how long the window keeps the number of a song just reserved
const LEVEL_MS = 2000    // how long the screen shows a change of volume
const BAR_MS = 3200      // how long the full screen keeps its keys up
// How long a plug takes to go home in its jack, drawn afresh each time between these, and handed
// to the sheet's transition so the plug moves as long as the sound says it does.
const PLUG_IN_MS = [170, 340]
const ROOM_SLIDE_MS = 240 // how long a new room's name and song take to come in on the display
// The keys drawn on the screen that stand over the picture rather than on a page.
const BENT_KEYS = '.km-fullbar button, .km-keypad button, .km-stage-ask'
const PAGE_OUT_MS = 140  // how long a page put away takes to fade out, as long as it took to come

// The number window: five digits of seven lit bars each.
const BARS = {
  a: '4.5,2 19,2 17,5 6.5,5', b: '20.5,3 20.5,17 17.5,15 17.5,6', c: '20.5,19 20.5,33 17.5,30 17.5,21', d: '4.5,34 19,34 17,31 6.5,31',
  e: '3,19 3,33 6,30 6,21', f: '3,3 3,17 6,15 6,6', g: '4.5,18 6.5,16.5 17,16.5 19,18 17,19.5 6.5,19.5',
}
const LIT = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', E: 'adefg', r: 'eg', h: 'cefg' }
const ERR = ' Err '
function ledCell(ch, i) {
  // The queue counter's slash: the two diagonal segments of a 14-segment display (upper
  // right and lower left), measured from a maker's drawing of one, the italic taken out
  // and laid into this digit's cell. They stand where they would beside that display's
  // middle bars, so a gap runs between them.
  // A whole cell lit as one block, which the number window flashes to catch the eye.
  if (ch === '\u2588') return <svg key={i} viewBox="0 0 23.5 36" focusable="false"><polygon points="3,2 20.5,2 20.5,34 3,34" data-on="" /></svg>
  if (ch === '/') return <svg key={i} className="km-led-slash" viewBox="4.8 0 10.6 36" focusable="false"><polygon points="11.62,15.29 11.55,12.13 14.14,6.01 14.7,6.01 14.76,9.02 14.61,9.62 12.21,15.29" data-on="" /><polygon points="5.43,29.69 5.43,26.98 7.98,20.76 8.58,20.76 8.54,24.07 6.26,29.84 6.1,30.14 5.5,30.14" data-on="" /></svg>
  // A clock's colon: two dots in a narrow cell of their own, one at the middle of each half
  // of a digit.
  // A decimal point: one dot at the foot of a narrow cell of its own.
  // (U+2024 is the same point, dark.)
  if (ch === '.' || ch === '\u2024') return <svg key={i} className="km-led-colon" viewBox="0 0 8 36" focusable="false"><polygon points="2,30 6,30 6,34 2,34" data-on={ch === '.' ? '' : undefined} /></svg>
  // A percent sign in a narrow cell: two small squares and the stroke between them.
  if (ch === '%') return <svg key={i} viewBox="0 0 14 36" focusable="false"><polygon points="1,5 5.5,5 5.5,11 1,11" data-on="" /><polygon points="10.2,5 13,5 3.8,31 1,31" data-on="" /><polygon points="8.5,25 13,25 13,31 8.5,31" data-on="" /></svg>
  if (ch === ':') return <svg key={i} className="km-led-colon" viewBox="0 0 8 36" focusable="false"><polygon points="2,9 6,9 6,13 2,13" data-on="" /><polygon points="2,23 6,23 6,27 2,27" data-on="" /></svg>
  // The sync window's sign: the middle bar and the two uprights through it that a
  // fourteen-segment cell has, so plus lights all three, minus the bar alone, and at
  // nought (the plus-or-minus sign stands for it here) none.
  if (ch === '+' || ch === '\u2212' || ch === '\u00b1') {
    return (
      <svg key={i} viewBox="0 0 23.5 36" focusable="false">
        <polygon points="10.2,7.5 13.3,7.5 13.3,15.6 11.75,16.8 10.2,15.6" data-on={ch === '+' || undefined} />
        <polygon points={BARS.g} data-on={ch !== '\u00b1' || undefined} />
        <polygon points="10.2,28.5 13.3,28.5 13.3,20.4 11.75,19.2 10.2,20.4" data-on={ch === '+' || undefined} />
      </svg>
    )
  }
  return (
    <svg key={i} viewBox="0 0 23.5 36" focusable="false">
      {Object.entries(BARS).map(([name, points]) => <polygon key={name} points={points} data-on={(LIT[ch] || '').includes(name) || undefined} />)}
    </svg>
  )
}
function Led({ text }) {
  return <span className="km-led" aria-hidden="true">{Array.from(text).map(ledCell)}</span>
}

// The progress window: how far into the song the room is, over how long the song runs,
// "2:36/3:16". Dashes stand for both where what plays has no length (a station, an empty room).
// A song of a hundred minutes or more is counted in hours and minutes, "1h40/2h05".
//
// The wheel turned over it moves through the song, up for onward: five seconds a notch (a
// minute, where the window counts minutes), the step every seek bar takes under the wheel. The
// window shows the place asked for at once, the room is sent there when the wheel comes to
// rest, and the window keeps that place until the room's clock has reached it. The arrow keys
// do the same for whoever reaches the window by keyboard. On the faceplate a thumbwheel stands
// at the window's end, the room selector's own: dragged up it goes onward and down back, a notch
// to every two ridges, and a press on its upper half is one notch back, on its lower one onward, as on the selector.
const PROGRESS_SETTLE_MS = 300
const PROGRESS_HOLD_MS = 3000
const WHEEL_PX_PER_NOTCH = 100   // a wheel that reports distance, not notches
const LONG_SONG_S = 6000
const DIAL_FRAMES = 6            // pictures of the wheel through one ridge's turn
const DIAL_RIDGE_PX = 3          // ridge to ridge across the front of the wheel, as drawn
const DIAL_PX_PER_NOTCH = 6
const DIAL_TAP_PX = 4
const DIAL_ROLL_MS = 170
// The window is as wide as its longest reading, "12:34/56:07". A shorter one has no
// blank cell before either time and sits in the middle, the dark cells left over shared between
// the two sides (the odd one at the right).
const PROGRESS_CELLS = 11
const centered = (text) => text.padStart(text.length + Math.floor((PROGRESS_CELLS - text.length) / 2), ' ').padEnd(PROGRESS_CELLS, ' ')
function clockCells(seconds, hours) {
  const s = Math.max(0, Math.floor(seconds))
  const two = (n) => String(n).padStart(2, '0')
  return hours ? `${Math.floor(s / 3600)}h${two(Math.floor((s % 3600) / 60))}` : `${Math.floor(s / 60)}:${two(s % 60)}`
}
function ProgressWindow({ zone, label, dial = false, seekRef = null, pop = false }) {
  const { actions } = useSystem()
  const tr = zone?.transport || {}
  const { elapsed, duration, live } = useElapsed(tr)
  const timed = Boolean(duration) && !live
  const seekable = timed && tr.can_seek !== false && tr.state !== 'STOPPED'
  const hours = duration >= LONG_SONG_S
  // { at, until }: the place asked for, and once the room has been sent there, how long to wait for it
  const [asked, setAsked] = useState(null)
  const askedNow = useRef(null)
  const put = (next) => { askedNow.current = next; setAsked(next) }
  const settle = useRef(0)
  const carry = useRef(0)
  const ref = useRef(null)
  const dialRef = useRef(null)
  const drag = useRef(null)
  const travel = useRef(0)
  const spin = (px) => {
    travel.current += px
    const frame = ((Math.round(travel.current / (DIAL_RIDGE_PX / DIAL_FRAMES)) % DIAL_FRAMES) + DIAL_FRAMES) % DIAL_FRAMES
    dialRef.current?.style.setProperty('--km-wheel-frame', String(frame))
  }
  // A notch from the mouse wheel, a key, or a press: the wheel is seen to turn a little over a
  // ridge, slowly enough that the ridges read as moving the right way.
  const owed = useRef(0)
  const raf = useRef(0)
  const rollDial = (notches) => {
    cancelAnimationFrame(raf.current)
    owed.current = Math.max(-1.8 * DIAL_RIDGE_PX, Math.min(1.8 * DIAL_RIDGE_PX, owed.current + notches * DIAL_RIDGE_PX * 1.2))
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { spin(owed.current); owed.current = 0; return }
    const from = owed.current
    const start = performance.now()
    const tick = (time) => {
      const t = Math.max(0, Math.min(1, (time - start) / DIAL_ROLL_MS))
      const next = from * (1 - t) ** 3
      spin(owed.current - next)
      owed.current = next
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }
  useEffect(() => () => cancelAnimationFrame(raf.current), [])
  const forget = () => { clearTimeout(settle.current); carry.current = 0; put(null) }

  const move = (notches, turned = false) => {
    if (!seekable || !notches) return
    if (!turned) rollDial(notches)
    const from = askedNow.current ? askedNow.current.at : elapsed
    const at = Math.max(0, Math.min(Math.max(0, duration - 1), from + notches * (hours ? 60 : 5)))
    const uuid = zone.uuid
    put({ at, until: 0 })
    clearTimeout(settle.current)
    settle.current = setTimeout(() => {
      put({ at, until: Date.now() + PROGRESS_HOLD_MS })
      actions.seek(uuid, hms(at))
    }, PROGRESS_SETTLE_MS)
  }
  const moveNow = useRef(move)
  moveNow.current = move
  // On a phone the window is a key: a press brings up a slider over the plate to set the place in
  // the song with, which goes there when it is let go. A press anywhere else puts it away.
  const [popped, setPopped] = useState(false)
  const popRef = useRef(null)
  const seekTo = (at) => {
    if (!seekable) return
    clearTimeout(settle.current)
    put({ at, until: Date.now() + PROGRESS_HOLD_MS })
    actions.seek(zone.uuid, hms(at))
  }
  useEffect(() => { if (!seekable) setPopped(false) }, [seekable])
  useEffect(() => {
    if (!popped) return undefined
    const away = (event) => {
      if (popRef.current?.contains(event.target) || ref.current?.contains(event.target)) return
      setPopped(false)
    }
    const esc = (event) => { if (event.key === 'Escape') setPopped(false) }
    document.addEventListener('pointerdown', away, true)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', away, true); document.removeEventListener('keydown', esc) }
  }, [popped])
  // Held Prev and Next search through the song a notch at a time, as the wheel does.
  if (seekRef) seekRef.current = (notches) => moveNow.current(notches)

  // Another room, another song, or a song that can no longer be moved through: nothing asked for stands.
  useEffect(() => forget, [zone?.uuid, tr.track_uri, seekable]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!asked?.until) return undefined
    if (Math.abs(elapsed - asked.at) <= 2) { put(null); return undefined }
    const timer = setTimeout(() => put(null), Math.max(0, asked.until - Date.now()))
    return () => clearTimeout(timer)
  }, [asked, elapsed])
  // The page's own listener, so the wheel can be kept from anything behind the window.
  useEffect(() => {
    const over = [ref.current, dialRef.current].filter(Boolean)
    const onWheel = (event) => {
      if (ref.current?.getAttribute('role') !== 'slider') return
      event.preventDefault()
      // Read before the deltas: Firefox reports a mouse wheel in lines, a notch an event, only
      // to a page that asks for the mode first.
      const mode = event.deltaMode
      // Mostly up and down: up goes onward. Mostly sideways: right does.
      const along = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? -event.deltaY : event.deltaX
      if (!along) return
      let notches = Math.sign(along)
      if (mode === 0) {
        carry.current += along
        notches = Math.trunc(carry.current / WHEEL_PX_PER_NOTCH)
        carry.current -= notches * WHEEL_PX_PER_NOTCH
      }
      moveNow.current(notches)
    }
    over.forEach((el) => el.addEventListener('wheel', onWheel, { passive: false }))
    return () => over.forEach((el) => el.removeEventListener('wheel', onWheel))
  }, [])
  const onKeyDown = (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    const notches = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[event.key]
    if (!notches || !seekable) return
    event.preventDefault()
    move(notches)
  }

  const shown = asked ? asked.at : elapsed
  // A stopped room has no song in hand, so the window shows no time, as the count shows no place.
  const inHand = timed && tr.state !== 'STOPPED'
  const text = inHand ? centered(`${clockCells(shown, hours)}/${clockCells(duration, hours)}`) : '--:--/--:--'
  const spoken = inHand ? `${formatDuration(shown)} / ${formatDuration(duration)}` : ''
  const onDialDown = (event) => {
    if (event.button !== 0 || !event.isPrimary || drag.current || !seekable) return
    const el = dialRef.current
    // The plate may be drawn smaller than it is laid out: the finger's travel is put back into the plate's own px.
    const scale = el.offsetHeight ? el.getBoundingClientRect().height / el.offsetHeight : 1
    drag.current = { id: event.pointerId, y: event.clientY, scale: scale || 1, last: 0, owed: 0, moved: false }
    try { el.setPointerCapture(event.pointerId) } catch { /* the pointer has already gone */ }
  }
  const onDialMove = (event) => {
    const d = drag.current
    if (!d || event.pointerId !== d.id) return
    const dy = (event.clientY - d.y) / d.scale
    if (!d.moved && Math.abs(dy) < DIAL_TAP_PX) return
    if (!d.moved) { d.moved = true; dialRef.current.setAttribute('data-turning', '') }
    const step = dy - d.last
    d.last = dy
    spin(-step)
    d.owed -= step
    const notches = Math.trunc(d.owed / DIAL_PX_PER_NOTCH)
    d.owed -= notches * DIAL_PX_PER_NOTCH
    move(notches, true)
  }
  const onDialUp = (event) => {
    const d = drag.current
    if (!d || event.pointerId !== d.id) return
    drag.current = null
    dialRef.current.removeAttribute('data-turning')
    if (d.moved || event.type !== 'pointerup') return
    const box = dialRef.current.getBoundingClientRect()
    move(event.clientY < box.top + box.height / 2 ? -1 : 1)
  }
  const window_ = seekable
    ? <span className="km-time-led" ref={ref} role="slider" tabIndex={0} aria-label={label} aria-orientation="horizontal"
            aria-valuemin={0} aria-valuemax={duration} aria-valuenow={shown} aria-valuetext={spoken}
            onKeyDown={onKeyDown} onPointerLeave={() => { carry.current = 0 }}><Led text={text} /></span>
    : <span className="km-time-led" ref={ref} role="img" aria-label={spoken ? `${label}: ${spoken}` : label}><Led text={text} /></span>
  if (pop) {
    return (
      <>
        <button type="button" className="km-time-led ld-time-key" ref={ref} aria-label={spoken ? `${label}: ${spoken}` : label}
                aria-expanded={seekable ? popped : undefined} {...idle(!seekable, () => setPopped((v) => !v))}><Led text={text} /></button>
        {popped && seekable && (
          <div className="ld-seekpop" ref={popRef} role="group" aria-label={label}>
            <Bar className="ld-seekbar" lit value={shown} min={0} max={Math.max(1, Math.floor(duration))} onRelease onCommit={seekTo}
                 label={label} format={(v) => formatDuration(v)} />
            <span className="ld-seekpop-end" aria-hidden="true">{formatDuration(duration)}</span>
          </div>
        )}
      </>
    )
  }
  if (!dial) return window_
  return (
    <>
      {window_}
      <span className="km-time-wheel" ref={dialRef} aria-hidden="true" data-off={!seekable || undefined}
            onPointerDown={onDialDown} onPointerMove={onDialMove} onPointerUp={onDialUp} onPointerCancel={onDialUp}
            onMouseDown={(event) => event.preventDefault()} onDragStart={(event) => event.preventDefault()}><i /></span>
    </>
  )
}

// The display's top line: what is playing, "Title - Artist", in the segments the room's name is lit
// in. Too long for the window, it moves along a character at a time to show the rest, waits five
// seconds at the end, comes back the same way, and waits five seconds at the start, for as long as it plays. A title in a
// script the segments cannot make is lit in type instead, and moves the same way. With motion
// turned down it stands still and is cut.
const LINE_STEP_MS = 260
const LINE_REST_MS = 5000     // at either end
const LINE_CELL_PX = 10.2      // a 13 px cell and the gap after it
function pingPong(last, show) {
  let timer = 0
  let index = 0
  let dir = 1
  const tick = () => {
    index += dir
    show(index)
    if (index === last || index === 0) { dir = -dir; timer = setTimeout(tick, LINE_REST_MS) } else timer = setTimeout(tick, LINE_STEP_MS)
  }
  timer = setTimeout(tick, LINE_REST_MS)
  return () => clearTimeout(timer)
}
const calmNow = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
function VfdLine({ text, enter = null, dir = 1 }) {
  const spelled = spell(text)
  return spelled == null ? <VfdTyped text={text} /> : <VfdSegments text={spelled} enter={enter} dir={dir} />
}
function VfdSegments({ text, enter, dir }) {
  const boxRef = useRef(null)
  const [cells, setCells] = useState(0)
  const [at, setAt] = useState(0)
  const chars = useMemo(() => Array.from(text), [text])
  const off = useEnter(enter, cells, true, dir, true)
  useLayoutEffect(() => {
    const box = boxRef.current
    if (!box || typeof ResizeObserver === 'undefined') return undefined
    const measure = () => setCells(Math.max(1, Math.floor((box.clientWidth + 1.5) / LINE_CELL_PX)))
    measure()
    const watch = new ResizeObserver(measure)
    watch.observe(box)
    return () => watch.disconnect()
  }, [])
  useEffect(() => {
    setAt(0)
    if (!cells || chars.length <= cells || calmNow()) return undefined
    return pingPong(chars.length - cells, setAt)
  }, [chars, cells])
  return (
    <span className="ld-vfd-line" ref={boxRef}>
      <span className="km-led">{Array.from({ length: cells }, (_, n) => <Cell key={n} ch={chars[at + n - off] ?? ' '} />)}</span>
    </span>
  )
}
function VfdTyped({ text }) {
  const boxRef = useRef(null)
  const rowRef = useRef(null)
  const [at, setAt] = useState(0)
  const chars = useMemo(() => Array.from(text), [text])
  useEffect(() => {
    setAt(0)
    const box = boxRef.current
    const row = rowRef.current
    if (!box || !row || !text || calmNow()) return undefined
    // Where each character starts, and the first one the line can stop at with its end in view.
    const lefts = [...row.children].map((el) => el.offsetLeft)
    const last = lefts.findIndex((left) => row.scrollWidth - left <= box.clientWidth)
    if (last <= 0) return undefined
    return pingPong(last, (index) => setAt(lefts[index]))
  }, [text])
  return (
    <span className="ld-vfd-line ld-vfd-typed" ref={boxRef}>
      <span className="ld-vfd-line-row" ref={rowRef} style={{ transform: `translateX(${-at}px)` }}>
        {chars.map((ch, i) => <span key={i}>{ch === ' ' ? '\u00a0' : ch}</span>)}
      </span>
    </span>
  )
}

// A key that does one thing pressed and another held: held, it calls onHold at once and then
// every so often for as long as it stays down, and the press it ends with is swallowed.
function useHold(onHold, delay = 450, every = 140) {
  const state = useRef({ timer: 0, held: false })
  const hold = useRef(onHold)
  hold.current = onHold
  const stop = () => clearTimeout(state.current.timer)
  useEffect(() => stop, [])
  return {
    props: {
      onPointerDown: (event) => {
        if (event.button !== 0) return
        stop()
        state.current.held = false
        state.current.timer = setTimeout(() => {
          state.current.held = true
          hold.current()
          state.current.timer = setInterval(() => hold.current(), every)
        }, delay)
      },
      onPointerUp: stop, onPointerLeave: stop, onPointerCancel: stop,
    },
    swallowed: () => { const held = state.current.held; state.current.held = false; return held },
  }
}

// What the mouse wheel does over a figure in the display: a nudge for each turn of it.
function WheelNudge({ onNudge, className, children }) {
  const ref = useRef(null)
  const nudge = useRef(onNudge)
  nudge.current = onNudge
  useEffect(() => {
    const el = ref.current
    let last = 0
    const onWheel = (event) => {
      if (!nudge.current) return
      event.preventDefault()
      if (!event.deltaY || event.timeStamp - last < 40) return
      last = event.timeStamp
      nudge.current(event.deltaY < 0 ? 1 : -1)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])
  return <span className={className} ref={ref} aria-hidden="true">{children}</span>
}

// Half a key: two of them stand one over the other in one key's place. There is no room
// for a legend over two lines of lettering, so the legend sits beside one of the two lines
// (the style sheet says which).
function HalfCap({ name, legend = null, onPress, active, glow = false, className = '', disabled = false, ...rest }) {
  const word = useWords()(name)
  return (
    <button type="button" className={cx('km-cap km-cap-half', glow && 'km-cap-glow', className)} aria-label={word.label} data-active={active || undefined} {...rest} {...idle(disabled, onPress)}>
      <span className="km-cap-line" aria-hidden="true">
        {legend && <span className="km-cap-legend">{legend}</span>}
        <span className="km-ko" lang="ko">{word.ko}</span>
      </span>
      <span className="km-second" aria-hidden="true">{word.second}</span>
      {active !== undefined && !glow && <i className="km-cap-lamp" data-on={active || undefined} aria-hidden="true" />}
    </button>
  )
}

// A key on the machine's face: a legend, and its name in two languages. A
// number key carries its digit alone. A key that turns something on has a
// lamp in its corner, lit while that is on; a key that changes the page has
// none, and is lit through its whole cap instead. Play/Pause has a strip of
// light under a shorter cap in place of the lamp: green while the room plays,
// amber while it is paused, and dark when it is stopped.
function Cap({ name = '', label = '', legend = null, digit = null, onPress, active, glow = false, strip = false, held = false, className = '', capRef = null, disabled = false, ...rest }) {
  const word = useWords()
  // A strip going dark keeps the color it had, so it does not change on its way out.
  const amber = useRef(false)
  if (active || held) amber.current = held && !active
  return (
    <button type="button" ref={capRef} className={cx('km-cap', glow && 'km-cap-glow', className)} aria-label={name ? word(name).label : label} data-km-key={name || undefined} data-active={active || undefined} {...rest} {...idle(disabled, onPress)}>
      {legend && <span className="km-cap-legend">{legend}</span>}
      {digit !== null && <span className="km-cap-digit" aria-hidden="true">{digit}</span>}
      {name && <Words name={name} />}
      {active !== undefined && !glow && <i className={strip ? 'km-cap-strip' : 'km-cap-lamp'} data-on={active || (strip && held) || undefined} data-amber={(strip && amber.current) || undefined} aria-hidden="true" />}
    </button>
  )
}

export function Shell() {
  const { zones, groups, households, connected, actions, notices, dismiss, servicesEpoch, favoritesEpoch: savedEpoch } = useSystem()
  const { t, language } = useI18n()
  const word = useWords()
  const size = useSize()
  const compact = size === 'compact'
  const [plateOpen, setPlateOpen] = useState(() => { try { return window.localStorage.getItem('sonora.km.plateOpen') === '1' } catch { return false } })
  useEffect(() => { try { window.localStorage.setItem('sonora.km.plateOpen', plateOpen ? '1' : '0') } catch { /* fine */ } }, [plateOpen])
  const prefs = usePrefs()
  const prefsRef = useRef(prefs)
  prefsRef.current = prefs
  // The alternate design (Settings): the same machine in another cabinet with other keys. The page
  // carries it as an attribute, which the sheet keys each design's casing and keys to.
  const alt = prefs.altDesign
  useLayoutEffect(() => {
    document.documentElement.toggleAttribute('data-km-alt', alt)
    return () => document.documentElement.removeAttribute('data-km-alt')
  }, [alt])
  // Every key of the machine sounds as it goes down (unless the sound is turned off).
  useEffect(() => {
    const down = (event) => {
      if (!prefsRef.current.keySound || event.button > 0 || !event.isPrimary) return
      const key = event.target instanceof Element && event.target.closest('.km-face .km-cap, .km-led-key')
      if (key && !key.disabled) (prefsRef.current.altDesign ? altKeyClick : keyClick)(key.classList.contains('km-cap-half') || key.classList.contains('km-cap-num') ? 0.8 : 1)
    }
    // A browser lets a page sound only once it has been touched. Any touch gets the sound
    // ready, so that a key the machine presses by itself later (a number keyed in from the
    // songbook) is heard, though no key was pressed by hand before it.
    const ready = () => { if (prefsRef.current.keySound) soundReady() }
    document.addEventListener('pointerdown', down, true)
    document.addEventListener('pointerup', ready, true)
    document.addEventListener('keydown', ready, true)
    return () => {
      document.removeEventListener('pointerdown', down, true)
      document.removeEventListener('pointerup', ready, true)
      document.removeEventListener('keydown', ready, true)
    }
  }, [])
  // The machine starts on the lyrics, and they are what the screen shows whenever no key
  // has a page up: a page put away by its own key, or by Escape, gives the screen back to them.
  const [program, setProgramState] = useState('stage')
  const [opened, setOpened] = useState(0)
  const at = useRef(program)
  const setProgram = useCallback((id) => {
    if (id !== 'stage' && at.current === 'stage') setOpened((n) => n + 1)
    at.current = id
    setProgramState(id)
  }, [])
  // The page drawn under the title: none while the lyrics have the screen.
  const held = program === 'stage' ? null : program
  // A page put away goes as it came, fading out, so it stays drawn a moment after the lyrics have
  // the screen again. Set before the screen is drawn, so the page is never seen to go and come back.
  const [gone, setGone] = useState(null)
  const lastHeld = useRef(held)
  useLayoutEffect(() => {
    const was = lastHeld.current
    lastHeld.current = held
    if (held || !was) { setGone(null); return undefined }
    setGone(was)
    // Taken away when its fade has run (onAnimationEnd below); this is in case it never runs.
    const timer = setTimeout(() => setGone(null), PAGE_OUT_MS + 900)
    return () => clearTimeout(timer)
  }, [held])
  const drawn = held || gone
  const leaving = !held && Boolean(gone)
  const { activeGroup, activeZone, visibleGroups: shownGroups, systemFilter, chooseSystem, select } =
    useShellSelection({ byMember: true, preferAllWhenMany: true })
  // Every list of rooms puts the groups of two or more before the rooms playing alone.
  const visibleGroups = useMemo(() => [
    ...shownGroups.filter((g) => (g.members?.length || 0) > 1),
    ...shownGroups.filter((g) => (g.members?.length || 0) <= 1),
  ], [shownGroups])
  const [setupPage, setSetupPage] = useState('')
  // Chosen just now from the theme chooser: open the settings at the pane with the themes.
  useThemeLanding(() => { setProgram('setup'); setSetupPage('appearance') })
  const [groupWindow, setGroupWindow] = useState(null)
  const [info, setInfo] = useState(null)
  const [prose, setProse] = useState(null)
  const [addTo, setAddTo] = useState(null)
  const [about, setAbout] = useState(false)
  // About Sonora asked for from outside the theme opens here, as the theme's own.
  useAboutRequest(() => setAbout(true))
  const [shortcuts, setShortcuts] = useState(false)
  const [roomMenu, setRoomMenu] = useState(null)
  const [keypad, setKeypad] = useState(false)
  const [entry, setEntry] = useState('')
  const [herald, setHerald] = useState(0)
  const [book, setBook] = useState(false)
  const [missed, setMissed] = useState(0)
  const [reserved, setReserved] = useState(0)
  const [bookMatch, setBookMatch] = useState(null)
  const bookRef = useRef(null)
  const bookOpen = useRef(false)
  bookOpen.current = book
  const picking = useRef(null)
  const numberTimers = useRef({ miss: 0, misses: 0, reserved: 0, keys: [] })
  const [levelShown, setLevelShown] = useState(false)
  const [full, setFull] = useState(false)
  const [bar, setBar] = useState(false)
  const [messages, setMessages] = useState([])
  // One line on the screen at a time, whether Sonora's notice or the machine's own word.
  const alerts = useOneAlert([
    ...notices.map((notice) => ({ id: `n-${notice.id}`, noticeId: notice.id, dismissible: true, title: t(notice.titleKey),
                                  text: notice.detail || (notice.detailKey ? t(notice.detailKey, notice.detailParams) : '') })),
    ...messages.map((message) => ({ ...message, dismissible: true })),
  ])
  // Bumped when this theme saves or removes a favorite; savedEpoch is the store's, bumped when
  // the speakers announce a change made anywhere (another app included).
  const [favoritesEpoch, setFavoritesEpoch] = useState(0)
  const tubeRef = useRef(null)
  const screenRef = useRef(null)
  useEffect(() => { loadFaces(); preloadImages() }, [])
  // The binder's pictures are fetched once the machine is up, ahead of the press that wants them.
  useEffect(() => {
    const timer = setTimeout(loadBookImages, 2500)
    return () => clearTimeout(timer)
  }, [])
  // A new program starts at the top of the screen. The Rooms page places itself, on the room in view.
  useEffect(() => {
    if (program === 'stage' || program === 'rooms') return
    screenRef.current?.scrollTo?.({ top: 0 })
  }, [program, setupPage])

  // The tube is where everything is measured from, and what the glass bends.
  const bent = prefs.bend && canBend()
  // The keys on the bent screen answer where they are seen (curve.jsx, useBentKeys).
  const bentLayer = useRef(null)
  useBentKeys(tubeRef, bentLayer, bent, BENT_KEYS)
  const samples = useBend(tubeRef, bent)
  // A window or a menu open over the screen.
  const [overBusy, setOverBusy] = useState(false)
  useEffect(() => {
    const over = document.getElementById('km-over')
    if (!over || typeof MutationObserver === 'undefined') return undefined
    const look = () => setOverBusy(over.childElementCount > 0)
    look()
    const observer = new MutationObserver(look)
    observer.observe(over, { childList: true })
    return () => observer.disconnect()
  }, [])
  const monitorRef = useRef(null)
  useBezel(monitorRef)
  usePressed()
  useEffect(() => {
    setScreen(tubeRef.current)
    const stop = watchScreen(tubeRef.current)
    return () => { stop(); setScreen(null) }
  }, [])

  // --- the data every program shares -----------------------------------------
  const services = useServices(servicesEpoch)
  const activeHousehold = activeZone ? householdOf(households, activeZone.uuid) : null
  const hzone = activeZone?.uuid || ''
  // "This browser" belongs to no system, so its favorites are those of the system the switch
  // has chosen, or of the first when it shows all, read through one of that system's rooms.
  const readZone = activeZone?.local
    ? (zoneForHousehold(households, zones, null,
        (households.find((h) => h.id === systemFilter) || orderedHouseholds(households)[0])?.id)?.uuid || '')
    : hzone
  const readFavorites = useFavorites(readZone, favoritesEpoch + savedEpoch)
  const favorites = useMemo(() => (activeZone?.local
    ? { ...readFavorites, items: readFavorites.items.map((item) => ({ ...item, hzone: item.hzone || readZone })) }
    : readFavorites), [readFavorites, activeZone?.local, readZone])
  const favoriteNumbers = useFavoriteNumbers(favorites.items, readZone)
  const queue = useQueue(activeZone)
  // How many the queue holds. The speaker's own count is 1 whenever it plays something from
  // outside its queue, so it stands in only while the queue is being read and the room is
  // playing from it; the last list read is used while it is being read again in the same room.
  const counted = useRef({ uuid: null, total: 0 })
  // A room just turned to still shows the last room's list until its own read begins.
  const reading = useRef(null)
  if (queue.loading) reading.current = activeZone?.uuid || null
  else if (reading.current === (activeZone?.uuid || null)) counted.current = { uuid: reading.current, total: queue.total }
  const fromQueue = ['queue', 'external_session'].includes(activeZone?.transport?.source)
  const queueTotal = counted.current.uuid === (activeZone?.uuid || null) ? counted.current.total
    : fromQueue ? activeZone?.transport?.queue_length || 0 : 0
  const reloadQueue = queue.reload

  const say = useCallback((text) => {
    if (!text) return
    const id = Date.now() + Math.random()
    setMessages((prev) => [...prev.slice(-1), { id, text }])
    setTimeout(() => setMessages((prev) => prev.filter((x) => x.id !== id)), 4500)
  }, [])

  // --- playing from the index --------------------------------
  // A press on a cover answers only once the source has started, and a stream can take
  // a moment to resolve; a second press on the same cover in that time is the same
  // request, not another.
  const starting = useRef(new Set())
  const playItem = useCallback(async (item, sourceId, how = 'now', { play = true } = {}) => {
    if (!activeZone) return
    const key = `${activeZone.uuid}|${how}|${item.uri || item.id || item.title}`
    if (starting.current.has(key)) return
    starting.current.add(key)
    playThrough(actions, activeZone)
    try {
      const done = await playItems(actions, [item], how, { hzone: activeZone.uuid, from: activeZone.local ? (item.hzone || '') : '', play, room: activeZone })
      if (done) say(t(how === 'now' ? 'km.playingNow' : how === 'next' ? 'km.queuedNext' : how === 'replace' ? 'km.replacedQueue' : 'km.addedToQueue', { title: item.title }))
      // The queue is read again here and not left to the speaker's word of the change: a
      // push that never arrives would leave the list as it was before the song went in.
      if (done) reloadQueue()
    } finally {
      starting.current.delete(key)
    }
  }, [activeZone, actions, say, t, reloadQueue])
  const serviceNameOf = useCallback((uri, sidFallback = null) => {
    const sid = Number((/[?&]sid=(\d+)/.exec(uri || '') || [])[1]) || sidFallback
    if (!sid || !activeHousehold) return ''
    return (services.byHousehold[activeHousehold.id] || []).find((s) => s.id === sid)?.name || ''
  }, [services.byHousehold, activeHousehold])

  // --- info, and the paths out of it -------------------------------------------
  const openInfoForItem = (item, ctx = {}) => setInfo({ item, hzone: ctx.hzone || activeZone?.uuid, serviceName: ctx.serviceName || serviceNameOf(item.uri, item.service_id), source: ctx.source || '' })
  const infoOpen = (node) => {
    if (node.prose) { setProse({ ...node, hzone: info?.hzone || activeZone?.uuid }); return }
    // Album Info and its kind open the item's own Info & Options, as the desktop apps' do.
    if (node.info) { setProse(null); setInfo({ item: node.item, hzone: info?.hzone || activeZone?.uuid, serviceName: node.serviceName || '' }); return }
  }

  // Party mode: every room of the household in view joins the room in view.
  const partyMode = async () => {
    if (!activeZone || !activeHousehold) return
    for (const uuid of activeHousehold.zone_uuids) {
      if (!zones[uuid] || uuid === activeZone.uuid) continue
      const g = groups.find((gr) => gr.members.includes(uuid))
      if (g && g.coordinator === activeZone.uuid) continue
      await actions.join(uuid, activeZone.uuid)
    }
  }
  const anyPlaying = groups.some((g) => zones[g.coordinator]?.transport?.state === 'PLAYING')
  const stepRoom = (forward) => {
    if (!visibleGroups.length) return
    stepDir.current = forward ? 1 : -1
    const index = visibleGroups.findIndex((g) => g.coordinator === activeGroup?.coordinator)
    const next = visibleGroups[(index + (forward ? 1 : visibleGroups.length - 1)) % visibleGroups.length]
    if (next) select(next.coordinator)
  }
  // Another room taken: the display's lines take the new room's words from the right (useEnter, in
  // the cells themselves). A line in another script is set in type, not cells, and slides in instead.
  // The first room shown when the page opens is simply there.
  const shownRoom = useRef(null)
  useEffect(() => {
    const id = activeZone?.uuid || null
    const was = shownRoom.current
    shownRoom.current = id
    if (!was || !id || was === id || calmNow()) return
    for (const el of document.querySelectorAll('.km-face .ld-vfd-typed > *, .km-face .km-roomsel-lit > .km-roomsel-typed')) {
      el.animate([{ transform: 'translateX(100%)' }, { transform: 'translateX(0)' }], { duration: ROOM_SLIDE_MS, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' })
    }
  }, [activeZone?.uuid])
  // The two microphone jacks: a press pushes a plug home, with the thump and hum an amplifier makes,
  // and a second pulls it out. Only for the look and the sound: nothing is listened to. The jacks
  // start empty whenever the page opens.
  const [mics, setMics] = useState({})
  const [plugMs, setPlugMs] = useState({})
  const plugTimer = useRef(0)
  const plugMic = (n) => {
    const going = !mics[n]
    // How long this one takes to go home, and how much of that the tip drags over the contacts.
    const travel = Math.round(PLUG_IN_MS[0] + Math.random() * (PLUG_IN_MS[1] - PLUG_IN_MS[0]))
    const drag = Math.min(travel - 40, 60 + Math.random() * 160)
    if (going) setPlugMs((was) => ({ ...was, [n]: travel }))
    setMics((was) => ({ ...was, [n]: going }))
    if (!prefsRef.current.keySound) return
    clearTimeout(plugTimer.current)
    if (going) plugTimer.current = setTimeout(() => plugIn(drag / 1000), travel - drag)
    else plugOut()
  }
  useEffect(() => () => clearTimeout(plugTimer.current), [])
  // Held, Prev and Next search back and on through the song; pressed, they go to the song before or after.
  const seekRef = useRef(null)
  const holdPrev = useHold(() => seekRef.current?.(-1))
  const holdNext = useHold(() => seekRef.current?.(1))
  const prevKey = () => { if (!holdPrev.swallowed()) step(-1) }
  const nextKey = () => { if (!holdNext.swallowed()) step(1) }
  // The two keys that step through the rooms, either side of the room's window on a phone and beside
  // Prev and Next on the desktop plate.
  const roomKeys = (className = '') => [
    <Cap key="back" label={`${word('room').label}: ${t('common.previous')}`} className={cx('ld-room', className)} legend={<L.Left size={9} />} disabled={visibleGroups.length < 2} onPress={() => stepRoom(false)} />,
    <Cap key="on" label={`${word('room').label}: ${t('common.next')}`} className={cx('ld-room', className)} legend={<L.Right size={9} />} disabled={visibleGroups.length < 2} onPress={() => stepRoom(true)} />,
  ]

  // Which way the display's words come in when the room changes: from the right for the room after,
  // from the left for the room before. The room keys say which they meant (they go round from the
  // last room to the first); any other change is told by where the rooms stand in the list.
  const stepDir = useRef(0)
  const lastRoom = useRef({ id: activeGroup?.coordinator ?? null, dir: 1 })
  if ((activeGroup?.coordinator ?? null) !== lastRoom.current.id) {
    const ids = visibleGroups.map((g) => g.coordinator)
    const was = ids.indexOf(lastRoom.current.id)
    const now = ids.indexOf(activeGroup?.coordinator)
    lastRoom.current = { id: activeGroup?.coordinator ?? null, dir: stepDir.current || (was >= 0 && now >= 0 && now < was ? -1 : 1) }
    stepDir.current = 0
  }
  const roomDir = lastRoom.current.dir

  // The names on the room selector's drum, in the order the rooms are listed everywhere else.
  // On the desktop plate's display a group is every room in it, the room leading first ("KITCHEN + OFFICE
  // + PATIO"), run past the window where it is too long; a phone's small window keeps the short form.
  const everyRoom = (g) => {
    const names = [g.coordinator, ...(g.members || []).filter((m) => m !== g.coordinator)].map((m) => zones[m]?.name).filter(Boolean)
    return names.length > 1 ? names.join(' + ') : groupTitle(g, zones, t)
  }
  const roomNames = visibleGroups.map((g) => (compact || alt ? groupTitle(g, zones, t) : everyRoom(g))).join('\n')
  const roomChoices = useMemo(() => {
    const names = roomNames.split('\n')
    return visibleGroups.map((g, i) => ({ id: g.coordinator, name: names[i] }))
  }, [visibleGroups, roomNames])
  const grouped = (activeGroup?.members?.length || 1) > 1
  const tr = activeZone?.transport || {}
  // Timed words are moved against the music by the sync wheel; a sheet of untimed ones has
  // its pace set by it; with no words there is nothing for it to turn.
  const stageWords = useStageLyrics(activeZone?.transport || null)
  const wheelMode = stageWords.lyrics.state === 'timed' ? 'sync' : stageWords.lyrics.state === 'plain' ? 'scroll' : 'off'
  const sync = useSync(activeZone?.transport || null, wheelMode)
  const what = nextTransport(tr)
  const playing = tr.state === 'PLAYING' || tr.state === 'TRANSITIONING'
  const level = activeZone ? ((grouped ? activeZone.group_volume : activeZone.volume) ?? 0) : 0
  const heardMuted = activeZone ? Boolean(grouped ? activeZone.group_muted : activeZone.muted) : false
  // The Mute key lights as it is pressed, not when the speaker answers: lit a moment after the
  // finger lifts, its cap rose and sank again and one press looked like two. A speaker that
  // never agrees gets the key back as it was.
  const [muteAsked, setMuteAsked] = useState(null)
  const muteZone = activeZone?.uuid
  useEffect(() => { setMuteAsked(null) }, [muteZone, grouped])
  useEffect(() => {
    if (muteAsked == null) return undefined
    if (muteAsked === heardMuted) { setMuteAsked(null); return undefined }
    const id = setTimeout(() => setMuteAsked(null), 2500)
    return () => clearTimeout(id)
  }, [muteAsked, heardMuted])
  const muted = muteAsked ?? heardMuted
  const setLevel = (next) => { if (!activeZone) return; if (grouped) actions.setGroupVolume(activeZone.uuid, next); else actions.setVolume(activeZone.uuid, next) }
  const common = { households, zones, activeZone, activeGroup, systemFilter, onSystem: chooseSystem, onMessage: say, compact }

  // --- songs by number ----------------------------------------------------------------
  // The number in the window: the one being typed, or the place in the queue of the song
  // that is playing.
  const queueNumber = tr.source === 'queue' && tr.track_number > 0 && tr.state !== 'STOPPED' ? pad(tr.track_number) : ''
  const entryMatch = entry ? lookUp(Number(entry), { queueItems: queue.items, queueTotal: queue.total, favorites: favorites.items, numbers: favoriteNumbers }) : null
  const typeDigit = (digit) => setEntry((prev) => (prev.length >= DIGITS ? digit : prev + digit))
  useEffect(() => {
    if (!entry) return undefined
    const timer = setTimeout(() => setEntry(''), ENTRY_MS)
    return () => clearTimeout(timer)
  }, [entry])
  // A song's number out of the songbook. The song goes to the end of the queue, as in a
  // singing room, and starts at once only when the queue was empty.
  const closeBook = () => bookRef.current?.close()
  const reserve = (song) => {
    // Into a queue that holds songs it goes at the end and the queue stays where it is, playing
    // or not; only into an empty one does it start at once.
    const holding = queueTotal > 0
    const starts = !playing && !holding
    // A song that only joins the queue leaves the open binder where it is for the next one. A
    // song that starts at once puts the binder away, and so does a number keyed in with it
    // shut: the picture goes to the lyrics.
    if (starts) closeBook()
    if (starts || !bookOpen.current) setProgram('stage')
    setReserved(song.number)
    clearTimeout(numberTimers.current.reserved)
    numberTimers.current.reserved = setTimeout(() => setReserved(0), RESERVED_MS)
    playItem({ ...song, hzone: readZone }, '', starts ? 'end' : 'add')
  }
  // A number nothing answers to: the window flashes Err three times, and the screen says
  // so in words. An open binder stays where it is for another try.
  const miss = () => {
    say(t('km.noSuchNumber'))
    numberTimers.current.misses += 1
    setMissed(numberTimers.current.misses)
    clearTimeout(numberTimers.current.miss)
    numberTimers.current.miss = setTimeout(() => setMissed(0), MISS_MS)
  }
  const confirmEntry = async (text = entry) => {
    const number = Number(text)
    const tapped = picking.current
    picking.current = null
    setEntry('')
    setKeypad(false)
    if (!activeZone) return
    if (!number) { if (text) miss(); return }
    if (number >= BOOK_FIRST) {
      let song = tapped?.number === number ? tapped : null
      if (!song) { try { song = await api.songbookNumber(number, readZone) } catch { song = null } }
      if (song?.uri) reserve(song)
      else miss()
      return
    }
    const match = lookUp(number, { queueItems: queue.items, queueTotal: queue.total, favorites: favorites.items, numbers: favoriteNumbers })
    if (!match) { miss(); return }
    closeBook()
    setProgram('stage')
    if (match.kind === 'queue') {
      playThrough(actions, activeZone)
      if (!await actions.seekTrack(activeZone.uuid, match.number)) return
      if (activeZone.transport?.state !== 'PLAYING') actions.play(activeZone.uuid)
    } else playItem(match.item, 'FV:2', 'now')
  }
  // A song tapped in the binder is keyed in for the reader, a digit at a time.
  // A key of the machine pressed by the machine itself, as the songbook keys a number in:
  // it goes down where it can be seen, and sounds.
  const pressKey = (digit) => {
    if (prefsRef.current.keySound) (prefsRef.current.altDesign ? altKeyClick : keyClick)(0.9)
    const keys = [...document.querySelectorAll('.km-face-pad .km-cap-num, .km-keypad-key:not(.km-keypad-word)')].filter((el) => el.textContent.trim().startsWith(digit))
    keys.forEach((key) => {
      key.setAttribute('data-km-press', '')
      setTimeout(() => key.removeAttribute('data-km-press'), KEYED_DOWN)
    })
  }
  const keyIn = (song) => {
    const digits = pad(song.number)
    numberTimers.current.keys.forEach(clearTimeout)
    // A song still being keyed in when another is tapped is reserved at once, not dropped.
    const before = picking.current
    if (before && before !== song) { picking.current = null; reserve(before) }
    picking.current = song
    setEntry('')
    // The number window flashes twice to say a song has been taken, then the digits go in.
    setHerald((n) => n + 1)
    numberTimers.current.keys = [
      setTimeout(() => setHerald(0), HERALD_MS),
      ...Array.from(digits, (_, i) => setTimeout(() => { pressKey(digits[i]); setEntry(digits.slice(0, i + 1)) }, HERALD_MS + KEYED_EVERY * (i + 1))),
    ]
  }
  // A number is complete at its fifth digit, and needs no Start. With the binder shut it is
  // held a little longer, so the title it answers to can be read on the screen, or a wrong
  // digit taken back.
  useEffect(() => {
    if (entry.length < DIGITS) return undefined
    const timer = setTimeout(() => confirmEntry(entry), book ? 350 : 900)
    return () => clearTimeout(timer)
  }, [book, entry]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => {
    const held = numberTimers.current
    clearTimeout(held.miss)
    clearTimeout(held.reserved)
    held.keys.forEach(clearTimeout)
  }, [])
  // The title beside a whole songbook number typed with the binder shut, asked of the songbook.
  const bookNumber = entry.length === DIGITS && Number(entry) >= BOOK_FIRST ? Number(entry) : 0
  useEffect(() => {
    setBookMatch(null)
    if (!bookNumber || book) return undefined
    let mine = true
    api.songbookNumber(bookNumber, readZone).then(
      (song) => { if (mine) setBookMatch({ number: bookNumber, title: song?.title || '' }) },
      () => { if (mine) setBookMatch({ number: bookNumber, title: null }) })
    return () => { mine = false }
  }, [bookNumber, book, readZone])
  const entryTitle = bookNumber
    ? (picking.current?.number === bookNumber ? picking.current.title || ''
      : bookMatch?.number === bookNumber ? (bookMatch.title ?? t('km.noSuchNumber')) : '')
    : entryMatch ? entryMatch.title : t('km.noSuchNumber')

  // --- a new song puts its words on the screen ------------------------------------------
  // The moment the room starts another song or another source, the picture goes to the
  // lyrics. A window that is open, or a field being typed in, keeps its place. A song chosen
  // while the room is paused waits for the room to play.
  const songKey = [tr.media_uri, tr.track_uri, tr.title, tr.source].map((part) => part || '').join('|')
  const lastSong = useRef(null)
  const songWaiting = useRef(false)
  // A saved queue loaded on the Queue page keeps the reader there: the song it starts is not
  // taken as a reason to go to the lyrics. The hold lasts for that one change, and not long.
  const stayOnPage = useRef(0)
  useEffect(() => {
    const uuid = activeZone?.uuid || ''
    const was = lastSong.current
    lastSong.current = { uuid, key: songKey }
    if (!was || was.uuid !== uuid) { songWaiting.current = false; return }
    if (was.key !== songKey) {
      if (stayOnPage.current && performance.now() - stayOnPage.current < 20000) { stayOnPage.current = 0; songWaiting.current = false; return }
      songWaiting.current = true
    }
    if (!songWaiting.current || !playing || !songKey.replace(/\|/g, '')) return
    songWaiting.current = false
    const typing = document.activeElement?.matches?.('input, textarea, select, [contenteditable]')
    if (typing || (overlayRoot().querySelector('.km-layer') || document.querySelector('.about-backdrop'))) return
    setKeypad(false)
    setProgram('stage')
  }, [activeZone?.uuid, songKey, playing, setProgram])

  // --- pressing play puts the words on the screen ---------------------------------------
  // A press that starts the music shows the lyrics at once, without waiting for the room to
  // answer. A press that pauses or stops leaves the page where it is. Play pressed for another
  // room brings that room into view first, so the words shown are its own.
  const toLyrics = () => { setKeypad(false); setProgram('stage') }
  const shown = (zone) => {
    if (zone.uuid !== activeGroup?.coordinator) select(zone.uuid)
    toLyrics()
  }
  // The machine's own key. Stopped, the screen shows no song and asks for one, so the key
  // starts the queue and nothing else: with the queue empty it does nothing, and a station the
  // room was left on is not started in the queue's place.
  const pressing = useRef(new Set())
  const playPause = async (zone) => {
    if (!zone) return
    const ztr = zone.transport || {}
    if (!canPress(ztr, zone.uuid === activeZone?.uuid ? queueTotal : undefined) && !replays(zone)) return
    // One press at a time for a room: a second that lands before the first is answered would
    // ask for the same thing again.
    if (pressing.current.has(zone.uuid)) return
    pressing.current.add(zone.uuid)
    try {
      const what = nextTransport(ztr)
      const starts = what === 'play'
      if (starts) playThrough(actions, zone)
      if (starts && offQueue(ztr) && !replays(zone)) {
        shown(zone)
        // A jump the speaker refused leaves nothing to start.
        if (await actions.seekTrack(zone.uuid, 1)) await actions.play(zone.uuid)
        return
      }
      if (starts) shown(zone)
      await (starts ? actions.play : what === 'stop' ? actions.stop : actions.pause)(zone.uuid)
    } finally { pressing.current.delete(zone.uuid) }
  }
  // A room's line names what the room holds, stopped or not, and the key on it starts that.
  // The picture goes to the words only when the room is the one already in view: another room
  // started from the list leaves the list up, and the room in view as it was.
  const playRoom = (zone) => {
    if (!zone) return
    const starts = canAct(zone.transport) && nextTransport(zone.transport || {}) === 'play'
    if (starts) playThrough(actions, zone)
    togglePlay(actions, zone)
    if (starts && zone.uuid === activeGroup?.coordinator) toLyrics()
  }

  // The song over again from its first bar. One held on pause is set going with it, and the
  // picture goes to its words, as it does when Play is pressed. A station has no first bar
  // to go back to, and neither has a room that has stopped.
  const canRestart = Boolean(activeZone) && parseDuration(tr.track_duration) > 0 && !isLiveStream(tr.track_duration, tr.media_uri)
    && tr.can_seek !== false && tr.state !== 'STOPPED' && !emptied(tr, queueTotal)
  const restart = async () => {
    if (!canRestart) return
    const zone = activeZone
    if (!await actions.seek(zone.uuid, '0:00:00')) return
    if (playing) toLyrics()
    else playPause(zone)
  }

  // --- the volume, shown on the screen for a moment after it changes --------------------
  const heard = useRef(null)
  useEffect(() => {
    const was = heard.current
    const now = { uuid: activeZone?.uuid || '', level, muted }
    heard.current = now
    if (!was || was.uuid !== now.uuid) { setLevelShown(false); return undefined }
    if (was.level === level && was.muted === muted) return undefined
    setLevelShown(true)
    const timer = setTimeout(() => setLevelShown(false), LEVEL_MS)
    return () => clearTimeout(timer)
  }, [activeZone?.uuid, level, muted])

  // --- the full screen ----------------------------------------------------------------
  // The tube fills the window, and the browser is asked to fill the display with it. A
  // browser that will not (a phone's, some of them) still gets the tube filling its window.
  const fs = useFullscreen()
  const wasFull = useRef(false)
  useEffect(() => {
    if (wasFull.current && !fs.isFull) setFull(false)
    wasFull.current = fs.isFull
  }, [fs.isFull])
  const toggleFull = () => {
    if (full) {
      setFull(false)
      if (document.fullscreenElement) fs.toggle()
    } else {
      setFull(true)
      setProgram('stage')
      if (!document.fullscreenElement) fs.toggle()
    }
  }
  // With the keys gone, a short row of them comes up on the screen whenever the pointer
  // moves or a key is pressed, and goes again.
  const barTimer = useRef(0)
  useEffect(() => {
    if (!full) { setBar(false); return undefined }
    const wake = () => {
      setBar(true)
      clearTimeout(barTimer.current)
      barTimer.current = setTimeout(() => setBar(false), BAR_MS)
    }
    wake()
    const events = ['pointermove', 'pointerdown', 'keydown']
    events.forEach((name) => window.addEventListener(name, wake, { passive: true }))
    return () => {
      events.forEach((name) => window.removeEventListener(name, wake))
      clearTimeout(barTimer.current)
    }
  }, [full])

  // The faceplate's arrangement. A desktop has one, with the ten number keys always on it. A
  // phone has its own four rows; its number keys come out with the songbook and take their place.
  const faceRef = useRef(null)
  const [fit, setFit] = useState('keys')
  // On a desktop the faceplate stays one row high. Where its row will not go in, everything on
  // it is drawn smaller, evenly, until it does.
  // How the plate is drawn smaller where even that will not go in: laid out at its full width and
  // shrunk as one picture (a transform; zoom drew the keys' frames wrongly), the height it gives
  // up taken from the margin under it.
  const [faceNeed, setFaceNeed] = useState(null)
  // Two numbers, measured at full size whatever the plate is drawn at, so the scale worked out
  // from them never changes what is measured and cannot go round in a loop.
  const needNow = useRef(null)
  const keepNeed = (next) => {
    const prev = needNow.current
    if (!next && !prev) return
    if (next && prev && Math.abs(prev.wanted - next.wanted) < 1.5 && Math.abs(prev.avail - next.avail) < 1.5 && prev.height === next.height) return
    needNow.current = next
    setFaceNeed(next)
  }
  useLayoutEffect(() => {
    const face = faceRef.current
    if (!face || typeof ResizeObserver === 'undefined') return undefined
    const measure = () => {
      // Sizes are read off the plate as drawn, so they are undone by the scale drawn on it now,
      // which may not yet be the one last asked for.
      const drawn = Number((face.style.transform.match(/scale\(([\d.]+)\)/) || [])[1]) || 1
      const drawnScale = drawn
      const style = getComputedStyle(face)
      const padX = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0)
      if (size === 'compact') {
        // A phone's plate has one arrangement, set in the style sheet.
        setFit('keys')
        keepNeed(null)
        return
      }
      // The width the plate has, from what holds it (its own width may be set while it is shrunk).
      // The desktop plate has one arrangement, the number keys always on it: what it needs is
      // its groups at full size, side by side.
      const holder = face.parentElement
      const holderStyle = getComputedStyle(holder)
      const avail = holder.clientWidth - (parseFloat(holderStyle.paddingLeft) || 0) - (parseFloat(holderStyle.paddingRight) || 0)
        // its set side margins, not the right margin it has while shrunk (that one hands width back)
        - 2 * (parseFloat(style.getPropertyValue('--km-face-mx')) || parseFloat(style.marginLeft) || 0)
      const room = avail - padX
      const gap = parseFloat(style.columnGap) || 0
      // The plate's own groups: the brushing laid under them takes no room.
      const groups = [...face.children].filter((el) => getComputedStyle(el).display !== 'none' && getComputedStyle(el).position !== 'absolute')
      // A group that takes up the slack is counted at the least it will go in.
      // A gap between each group, and one more after the last: the plate keeps as much past the
      // volume dial as before it (the sheet's spacer at the plate's end).
      // The alternate design's stacked panels count at the least they will go in, with a gap only
      // between groups.
      const needs = prefsRef.current.altDesign
        ? groups.reduce((sum, el) => sum + (el.classList.contains('km-desk-stack') ? parseFloat(getComputedStyle(el).minWidth) || 0 : el.getBoundingClientRect().width / drawnScale), 0) + gap * Math.max(0, groups.length - 1)
        : groups.reduce((sum, el) => sum + el.getBoundingClientRect().width / drawnScale, 0) + gap * groups.length
      setFit('keys')
      if (needs <= room + 0.5) { keepNeed(null); return }
      keepNeed({ wanted: Math.round(needs), avail: Math.round(avail), padX, height: face.offsetHeight })
    }
    measure()
    // Later measures wait for the next frame, and come one at a time.
    let frame = 0
    const soon = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; measure() }) }
    const watch = new ResizeObserver(soon)
    watch.observe(face)
    watch.observe(face.parentElement)
    for (const part of face.children) watch.observe(part)
    return () => { watch.disconnect(); if (frame) cancelAnimationFrame(frame) }
  }, [size, book, language, alt])
  // The plate drawn smaller where its row will not go in: laid out at full width, shrunk as one
  // picture, the width it gives up handed back by its margin (so what holds it does not grow)
  // and the height by the margin under it.
  const faceScale = faceNeed ? (() => {
    // The whole plate is the picture, its own padding with it, so its full width is what has to
    // go in the room: any less and the plate stops short of the right-hand side.
    const width = Math.ceil(faceNeed.wanted + faceNeed.padX)
    const sc = Math.min(1, Math.floor((faceNeed.avail / width) * 10000) / 10000)
    return { s: sc, width, give: Math.max(0, width - faceNeed.avail), lose: Math.round(faceNeed.height * (1 - sc)) }
  })() : null
  // A shrunken plate leaves the strip under Play / Pause between two rows of screen pixels, where
  // its round ends smear. It is nudged, by less than a pixel, until its foot lies on a row: the
  // row the rims of the keys beside it end on, which is why it leans toward the row above.
  useLayoutEffect(() => {
    const face = faceRef.current
    if (!face) return undefined
    const snap = () => {
      for (const strip of face.querySelectorAll('.km-cap-strip')) {
        strip.style.removeProperty('--km-snap')
        const box = strip.getBoundingClientRect()
        if (!box.height) continue
        const off = Math.floor(box.bottom + 0.3) - box.bottom
        if (Math.abs(off) > 0.01) strip.style.setProperty('--km-snap', `${(off / (faceScale?.s || 1)).toFixed(3)}px`)
      }
    }
    snap()
    window.addEventListener('resize', snap)
    return () => window.removeEventListener('resize', snap)
  }, [faceScale?.s, faceScale?.width, faceScale?.lose, size, plateOpen])
  // A phone has no room on its screen for a keypad, so its number keys come out on the plate.
  const platePad = keypad && size === 'compact' && !full
  const folded = compact && !plateOpen
  // More and Less, and the number keys taking a phone's plate over while the binder is open: the
  // plate grows or shrinks to its new height, where it would have jumped.
  const plateHeight = useRef(null)
  const plateMove = useRef(null)
  const platePadded = !!(book || platePad) && compact
  // Less also puts the song back on the screen, so no page key is left lit on the folded plate.
  const foldPlate = (open) => {
    if (!open && program !== 'stage') setProgram('stage')
    setPlateOpen(open)
  }
  useLayoutEffect(() => {
    const el = faceRef.current
    if (!el) return
    // A change while the plate is still moving starts from where it has got to.
    const moving = plateMove.current?.playState === 'running'
    const from = moving ? el.getBoundingClientRect().height : plateHeight.current
    plateMove.current?.cancel()
    const to = el.getBoundingClientRect().height
    plateHeight.current = to
    if (from == null || !el.animate || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    if (Math.abs(to - from) < 1) return
    const style = getComputedStyle(el)
    const less = style.boxSizing === 'border-box' ? 0
      : parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth)
    plateMove.current = el.animate([{ height: `${from - less}px`, overflow: 'hidden' }, { height: `${to - less}px`, overflow: 'hidden' }],
                                   { duration: 260, easing: 'cubic-bezier(0.3, 0.9, 0.3, 1)' })
  }, [plateOpen, platePadded])
  // The height is noted after every other update too, but not while the plate is moving, when what
  // it measures is a height on the way.
  useLayoutEffect(() => {
    if (plateMove.current?.playState === 'running') return
    plateHeight.current = faceRef.current?.getBoundingClientRect().height ?? null
  })
  const padShown = book || platePad || (size !== 'compact' && fit === 'keys')

  // The window over the queue key: the place in the queue of the song playing or paused, and
  // how many the queue holds, "07/43". Dashes stand for a place when the room is not playing
  // from its queue, and for both when the queue is empty.
  const inQueue = (tr.source === 'queue' || tr.source === 'external_session') && tr.track_number > 0 && queueTotal > 0
  const countWidth = Math.max(2, String(queueTotal).length)
  const countPad = (n) => String(n).padStart(countWidth, '0')
  // A stopped room shows no place: no song is in hand, though Prev and Next still go by the
  // one the speaker keeps.
  const placed = inQueue && tr.state !== 'STOPPED'
  const countText = `${placed ? countPad(tr.track_number) : '-'.repeat(countWidth)}/${queueTotal ? countPad(queueTotal) : '-'.repeat(countWidth)}`
  const countLabel = placed ? t('km.queuePlace', { n: tr.track_number, total: queueTotal }) : t('km.queueSize', { total: queueTotal })

  const songbookKey = () => {
    if (book) { closeBook(); return }
    setKeypad(false)
    setBook(true)
  }

  // Previous and next. In the queue they go to the song before or after, as a jump to it in
  // the queue would: a song playing goes on playing there, and a queue at rest stays at rest
  // on its new song. A shuffled queue with a song in hand has no before or after to count
  // to, so there the keys are the room's own Previous and Next, which keep to the shuffled
  // order; Next goes dark on the order's last turn. Anything else (a station, say) has the
  // speaker's own previous and next.
  const shuffled = inQueue && tr.source === 'queue' && tr.state !== 'STOPPED' && (tr.play_mode || '').startsWith('SHUFFLE')
  const stepOk = (by) => Boolean(activeZone) && (shuffled
    ? (by > 0 ? canNext(tr) : tr.can_seek !== false || tr.can_previous !== false)
    : inQueue ? tr.track_number + by >= 1 && tr.track_number + by <= queueTotal
      : by < 0 ? canPrevious(tr) : canNext(tr))
  const step = async (by) => {
    if (!stepOk(by)) return
    if (inQueue) {
      const resting = tr.state !== 'PLAYING' && tr.state !== 'TRANSITIONING'
      if (!shuffled) await actions.seekTrack(activeZone.uuid, tr.track_number + by)
      else if (by < 0) await actions.previous(activeZone.uuid)
      else await actions.next(activeZone.uuid)
      // The page's own room starts what it jumps to; at rest it is stopped again there.
      if (resting && activeZone.local) actions.pause(activeZone.uuid)
    } else if (by < 0) actions.previous(activeZone.uuid)
    else actions.next(activeZone.uuid)
  }

  // The song the Next key goes to, named beside it on the full screen: the speaker's own word
  // for what follows (which keeps to a shuffled order), or the queue's next row. Nothing is
  // named where Next has nowhere to go, or goes to something that has no name yet.
  const following = tr.next_title ? { title: tr.next_title, artist: tr.next_artist }
    : inQueue && !shuffled ? queue.items[tr.track_number] : null
  const upNext = stepOk(1) && following?.title ? following : null

  // The queue key: the queue on the screen, and pressed again, the lyrics.
  const queueKey = () => {
    if (book) closeBook()
    setProgram(program === 'queue' ? 'stage' : 'queue')
  }
  // The Rooms key, and a press on the room selector's window: the rooms on the screen, and
  // pressed again, the lyrics.
  const roomsKey = () => {
    if (book) closeBook()
    setProgram(program === 'rooms' ? 'stage' : 'rooms')
  }

  // The Settings key: the settings on the screen, and pressed again, the lyrics.
  const settingsKey = () => {
    if (book) closeBook()
    setKeypad(false)
    setProgram(program === 'setup' ? 'stage' : 'setup')
  }

  // --- keys -------------------------------------------------------------------------
  const anyLayer = groupWindow || info || prose || addTo || about || shortcuts
  useEffect(() => {
    const onKey = (event) => {
      const typing = isTyping(event)
      const cmd = isCommand(event)
      const key = keyOf(event)
      // With the songbook open the keys are the binder's: digits are a song's number,
      // letters and arrows turn its pages, and Escape steps back out of it.
      if (book && !typing && !anyLayer) {
        if (cmd) return
        if (event.key === 'Escape') {
          event.preventDefault()
          if (entry) setEntry('')
          else bookRef.current?.key(event)
        } else if (!event.altKey && /^[0-9]$/.test(event.key)) { event.preventDefault(); pressKey(event.key); typeDigit(event.key) }
        else if (entry && event.key === 'Backspace') { event.preventDefault(); setEntry((prev) => prev.slice(0, -1)) }
        else if (entry && event.key === 'Enter') { event.preventDefault(); confirmEntry() }
        else if (bookRef.current?.key(event)) event.preventDefault()
        return
      }
      if (cmd && key === 'g') { event.preventDefault(); setProgram('queue'); return }
      if (cmd && event.shiftKey && key === 'x') { event.preventDefault(); if (activeZone) actions.setCrossfade(activeZone.uuid, !activeZone.transport?.crossfade); return }
      if (typing || anyLayer) return
      if (event.key === '?') { event.preventDefault(); setShortcuts(true); return }
      // Escape undoes the nearest thing: a number half typed, the number keys, and last the
      // program itself, which gives way to the stage.
      if (event.key === 'Escape') {
        if (document.querySelector('.km-menu')) return
        if (entry) setEntry('')
        else if (keypad) setKeypad(false)
        else if (full && !document.fullscreenElement) setFull(false)
        else if (program !== 'stage') setProgram('stage')
        else return
        event.preventDefault()
        return
      }
      // A digit is a song's number.
      if (!cmd && !event.altKey && /^[0-9]$/.test(event.key)) {
        event.preventDefault()
        // The machine's own key goes down with it, and sounds as it does under a finger.
        pressKey(event.key)
        typeDigit(event.key)
        return
      }
      if (entry && event.key === 'Backspace') { event.preventDefault(); setEntry((prev) => prev.slice(0, -1)); return }
      if (entry && event.key === 'Enter') { event.preventDefault(); confirmEntry(); return }
      if (!activeZone) return
      const mode = activeZone.transport?.play_mode || 'NORMAL'
      // Space plays and pauses unless a key or button has the focus, which Space presses instead.
      const onControl = event.target?.closest?.('button, [role="button"], [role="option"], label')
      if ((event.key === ' ' && !onControl) || (cmd && key === 'p')) { event.preventDefault(); playPause(activeZone) }
      else if (cmd && key === 'e') { event.preventDefault(); actions.setPlayMode(activeZone.uuid, shuffleToggled(mode)) }
      else if (cmd && event.shiftKey && key === 'm') { event.preventDefault(); groups.forEach((g) => actions.setMute(g.coordinator, true, true)) }
      else if (cmd && key === 'm') { event.preventDefault(); actions.setMute(activeZone.uuid, !activeZone.group_muted, true) }
      else if (cmd && (event.key === 'ArrowUp' || event.key === '+' || event.key === '=')) { event.preventDefault(); actions.setGroupVolume(activeZone.uuid, Math.min(100, (activeZone.group_volume ?? 0) + 2)) }
      else if (cmd && (event.key === 'ArrowDown' || event.key === '-')) { event.preventDefault(); actions.setGroupVolume(activeZone.uuid, Math.max(0, (activeZone.group_volume ?? 0) - 2)) }
      else if (cmd && event.key === 'ArrowRight') { event.preventDefault(); actions.next(activeZone.uuid) }
      else if (cmd && event.key === 'ArrowLeft') { event.preventDefault(); actions.previous(activeZone.uuid) }
      else if (cmd && (event.key === '.' || event.key === ',' || event.key === ']' || event.key === '[')) {
        event.preventDefault()
        stepRoom(event.key === '.' || event.key === ']')
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }) // bound again each render: it reads the room in view, the groups, and what is open


  // --- the program on the screen ------------------------------------------------------
  const page = !drawn ? null : drawn === 'queue' ? (
    <QueueProgram zone={activeZone} room={activeGroup ? groupTitle(activeGroup, zones, t) : ''} queue={queue} onMessage={say} onPlay={toLyrics}
                  onLoad={(item, how) => { stayOnPage.current = performance.now(); playItem({ ...item, hzone: readZone }, 'SQ:', how, { play: playing }) }} listZone={readZone}
                  onInfo={(item) => openInfoForItem(item, { hzone: activeZone?.uuid })} />
  ) : drawn === 'rooms' ? (
    // A room picked on the Rooms page is taken, and the page put away for the lyrics.
    <RoomsProgram {...common} groups={visibleGroups} activeId={activeGroup?.coordinator} onSelect={(id) => { select(id); setProgram('stage') }} onPlay={playRoom}
                  onGroup={setGroupWindow}
                  onPauseAll={() => pauseEverything(actions, groups, zones)} pauseDisabled={!anyPlaying}
                  onParty={partyMode} partyDisabled={!activeZone || activeZone.local || (activeHousehold?.zone_uuids?.length || 0) < 2} />
  ) : (
    <SetupProgram page={setupPage} compact={compact}
                  onAbout={() => setAbout(true)} onShortcuts={() => setShortcuts(true)} />
  )

  // The display's song line: "Title - Artist"; a soundbar on its television input reads "TV" and what
  // the input is receiving ("TV - Dolby Digital 5.1", "TV - No Signal") where the speaker says.
  const tvLine = tr.source === 'tv' ? tvSignalLine(tr, t) : ''
  // A live station stopped reads as the station and its service, "Station (Service)", not the last
  // song it aired: Play joins the broadcast where it is now, and that song is gone.
  const liveStopped = tr.state === 'STOPPED' && isLiveStream(tr.track_duration, tr.media_uri)
  const station = tr.container_title ? (tr.service_name ? `${tr.container_title} (${tr.service_name})` : tr.container_title) : ''
  const songLine = tr.source === 'tv' ? (tvLine ? `${t('source.tv')} - ${tvLine}` : t('source.tv'))
    : liveStopped && station ? station
      : tr.title ? (tr.artist ? `${tr.title} - ${tr.artist}` : tr.title) : ''
  const DIGIT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']
  // The number window shows the digits as they are typed, from the right. With nothing keyed
  // in it shows dashes: the song's place in the queue is the smaller window's to show.
  const erring = Boolean(missed) && !entry
  const ledText = herald ? '\u2588'.repeat(DIGITS) : entry ? entry.padStart(DIGITS, ' ') : erring ? ERR : reserved ? pad(reserved) : '-----'
  const led = <Led key={erring ? `e${missed}` : herald ? `h${herald}` : 0} text={ledText} />
  const canPlay = Boolean(activeZone) && (canPress(tr, queueTotal) || replays(activeZone))
  const press = () => { if (entry) confirmEntry(); else if (activeZone) playPause(activeZone) }
  const pausedNow = tr.state === 'PAUSED_PLAYBACK'
  // Stop hands a soundbar back to its television, so it stays live on a soundbar that is on
  // anything else, stopped or not: that is the way back to the TV from here.
  const toTv = Boolean(activeZone) && tr.source !== 'tv' && /arc|beam|ray|playbar|playbase|amp/i.test(activeZone.model || '')
  const stopOff = !activeZone || (!toTv && ((!playing && !pausedNow) || tr.can_stop === false))
  const openRoomMenu = (event) => {
    if (!activeGroup) return
    event.preventDefault()
    setRoomMenu({ group: activeGroup, x: ptX(event.clientX), y: ptY(event.clientY) })
  }
  // The room's window: the display's segmented line on the lead design, the drum on the alternate.
  const roomSelector = alt ? (
    <DrumSelector rooms={roomChoices} value={activeGroup?.coordinator} onChoose={select} onOpen={roomsKey} onMenu={openRoomMenu}
                  label={word('room').label} empty={t('desk.browse.selectRoom')} print={compact ? <Words name="room" className="km-print" /> : null} led />
  ) : (
    <RoomSelector rooms={roomChoices} value={activeGroup?.coordinator} onChoose={select} onOpen={roomsKey} onMenu={openRoomMenu}
                  label={word('room').label} empty={t('desk.browse.selectRoom')} print={compact ? <Words name="room" className="km-print" /> : null} led enter={activeZone?.uuid} dir={roomDir} left={!compact} />
  )

  // The words are bent in a layer of their own, over the screen's, while nothing on the screen
  // has to stand over them.
  const wordsLifted = bent && !entry && !levelShown && !keypad && !(full && bar) && !overBusy && connected && (book || alerts.length === 0)

  // The number keys on the screen. Over an open binder in full screen they stand above its layer.
  const numberKeys = keypad && !platePad && (
    <div className="km-keypad km-screenlike" role="group" aria-label={t('km.songNumber')}>
      {full && !book && <button type="button" className="km-keypad-key km-keypad-word km-keypad-book" onClick={songbookKey}>{t('km.book.sonora')}</button>}
      {DIGIT_KEYS.slice(0, 9).map((digit) => <button type="button" key={digit} className="km-keypad-key" onClick={() => typeDigit(digit)}>{digit}</button>)}
      <button type="button" className="km-keypad-key km-keypad-word" onClick={() => (entry ? setEntry('') : setKeypad(false))}>{t('common.cancel')}</button>
      <button type="button" className="km-keypad-key" onClick={() => typeDigit('0')}>0</button>
      <button type="button" className="km-keypad-key km-keypad-word" data-primary="" {...idle(!entry, () => confirmEntry())}>{t('common.play')}</button>
    </div>
  )
  return (
    <SongbookProvider numbers={favoriteNumbers}>
    <div className={cx('km-root', `km-size-${size}`)} data-program={program} data-km-full={full || undefined} data-playing={playing || undefined}
         data-km-book={book || undefined} data-km-pad={(book || platePad) || undefined} data-km-lines={prefs.bend || undefined} data-km-bent={bent || undefined} style={alt ? ALT_IMAGE_VARS : IMAGE_VARS}>
      <svg className="km-defs" width="0" height="0" aria-hidden="true" focusable="false">
        <BendFilter ids={BEND_IDS} samples={samples} />
        <BendFilter ids={LINES_IDS} samples={samples} />
        <BendFilter ids={WORDS_IDS} samples={samples} region={WORDS_REGION} />
      </svg>
      <span className="km-cabinet-shadow" aria-hidden="true" />
      {alt && <Mics />}
      <div className="km-cabinet">
        <header className="km-top">
          <span className="km-grille" aria-hidden="true" />
          <button type="button" className="km-plate" aria-label={t('about.menu')} onClick={() => setAbout(true)}>
            <span className="km-plate-name" aria-hidden="true">SONORA</span>
            <span className="km-plate-model" aria-hidden="true"><span lang="ko">노래반주기</span><span>KARAOKE MACHINE</span></span>
          </button>
          <span className="km-power" data-on={connected || undefined} aria-hidden="true" />
          <span className="km-grille" aria-hidden="true" />
        </header>

        <section className="km-monitor" ref={monitorRef}>
          <div className="km-tube">
            {/* The reader's own videos play here, under the screen. The layer is not bent with the glass:
                a filter over another site's player leaves it blank in Firefox. */}
            <div id="km-video" className="km-video" data-away={program !== 'stage' || undefined} data-zoom={prefs.zoomVideo || undefined} aria-hidden="true" />
            <div className="km-screen km-crt" ref={tubeRef} style={bent ? { filter: `url(#${FILTER_ID})` } : undefined}>
              <header className="km-topline" data-stage={program === 'stage' || undefined}>
                {drawn && <h1 className="km-topline-title" data-leaving={leaving || undefined}>{t(PROGRAM_LABELS[drawn])}</h1>}
              </header>
              <Stage away={program !== 'stage'} zone={activeZone} songNumber={queueNumber} words={stageWords} sync={wheelMode === 'sync' ? sync.offset : 0} rate={wheelMode === 'scroll' ? 1 + sync.offset / 1000 : 1} lift={wordsLifted && program === 'stage'} />
              {drawn && (
                <div className="km-crt-scroll" ref={screenRef}>
                  <main className="km-program" key={`${drawn}:${opened}`} data-leaving={leaving || undefined}
                        onAnimationEnd={(event) => { if (leaving && event.animationName === 'km-program-out') setGone(null) }}>{page}</main>
                </div>
              )}
              <Ticker onDismiss={(item) => (item.noticeId ? dismiss(item.noticeId) : setMessages((prev) => prev.filter((x) => x.id !== item.id)))} items={[
                ...(!connected ? [{ id: 'offline', kind: 'warn', text: t('common.reconnecting') }] : []),
                ...(book ? [] : alerts),
              ]} />
              {entry && (
                <div className="km-osd km-osd-entry" role="status">
                  <span className="km-osd-label">{t('km.songNumber')}</span>
                  <strong className="km-osd-number">{entry.padStart(DIGITS, '-')}</strong>
                  <span className="km-osd-title">{entryTitle}</span>
                </div>
              )}
              {levelShown && (
                <div className="km-osd km-osd-level" aria-hidden="true">
                  <span className="km-osd-label">{muted ? t('km.muted') : t('km.volume')}</span>
                  <span className="km-osd-blocks">
                    {Array.from({ length: 20 }, (_, i) => <i key={i} data-on={(!muted && i < Math.round(level / 5)) || undefined} />)}
                  </span>
                  <strong className="km-osd-number">{level}</strong>
                </div>
              )}
              {!(book && full) && numberKeys}
              {full && (
                <div className="km-fullbar km-screenlike" data-shown={bar || keypad || Boolean(entry) || undefined}>
                  <button type="button" className="km-osd-key" aria-label={t('common.previous')} title={t('common.previous')}
                          {...idle(!stepOk(-1), () => step(-1))}><L.Prev size={20} /></button>
                  <button type="button" className="km-osd-key" aria-label={t(what === 'play' ? 'common.play' : what === 'stop' ? 'common.stop' : 'common.pause')}
                          title={t(what === 'play' ? 'common.play' : what === 'stop' ? 'common.stop' : 'common.pause')} 
                          {...idle(!entry && !canPlay, press)}><L.PlayWhat what={entry ? 'play' : what} size={20} /></button>
                  <button type="button" className="km-osd-key" aria-label={t('common.next')} title={t('common.next')}
                          {...idle(!stepOk(1), () => step(1))}><L.Next size={20} /></button>
                  {upNext && <span className="km-fullbar-next">{t(upNext.artist ? 'km.nextSong' : 'km.nextSongOnly', { title: upNext.title, artist: upNext.artist })}</span>}
                  <span className="km-fullbar-gap" aria-hidden="true" />
                  <button type="button" className="km-osd-key km-osd-pad" aria-label={t('km.book')} title={t('km.book')} aria-expanded={keypad}
                          onClick={() => (book ? closeBook() : setKeypad((v) => !v))}><L.Book size={20} /></button>
                  <button type="button" className="km-osd-key" aria-label={t('km.exitFullScreen')} title={t('km.exitFullScreen')} onClick={toggleFull}><L.Window size={20} /></button>
                </div>
              )}
              <div id="km-over" />
            </div>
            <div id="km-lift" className="km-lift" />
            {/* Stand-ins for the keys on the bent screen, laid over the places the bend draws them. */}
            <div className="km-bent-keys" ref={bentLayer} aria-hidden="true" />
            <div className="km-scan" aria-hidden="true" style={bent ? { filter: `url(#${LINES_IDS.filter})` } : undefined} />
            <div className="km-glass" aria-hidden="true" />
          </div>
        </section>

        <footer className="km-face" ref={faceRef} data-fit={compact ? undefined : fit}
                style={faceScale ? { '--km-face-s': faceScale.s, width: faceScale.width, marginRight: `calc(var(--km-face-mx) - ${faceScale.give}px)`, transform: `scale(${faceScale.s})`, transformOrigin: '0 0', marginBottom: `calc(var(--km-face-mb) - ${faceScale.lose}px)` } : undefined} data-pad={padShown || undefined}>
          {!alt && <i className="ld-brush" aria-hidden="true" />}
          {compact ? (<>
            {/* A phone's plate is folded until its More key is pressed: the windows under their
                names, over one row of the keys a singer wants most. Unfolded it is four rows on the
                same five columns: the windows, the keys that run the song, the keys that change the
                page, and the volume beside the key that folds it again. The first window is
                the one the page in hand wants: the song number on the queue, the room elsewhere.
                With the songbook out, the number keys take the whole plate, and Cancel clears the
                number typed or, with none, closes the book. */}
            {padShown && (<>
              <div className="km-face-number" data-miss={erring ? '' : undefined} data-herald={herald || undefined}>{led}</div>
              <div className="km-face-pad" role="group" aria-label={word('number').label}>
                {DIGIT_KEYS.map((digit) => <Cap key={digit} digit={digit} label={digit} className="km-cap-num" onPress={() => typeDigit(digit)} />)}
                <Cap name="cancel" className="km-cap-cancel" disabled={!entry && !platePad && !book} onPress={() => (entry ? setEntry('') : book ? closeBook() : setKeypad(false))} />
              </div>
            </>)}
            <div className="km-face-display">
              <Words name={program === 'queue' && !padShown ? 'number' : 'room'} className="km-face-print" />
              <Words name="queue" className="km-face-print" />
              <Words name="progress" className="km-face-print" />
              {program === 'queue' && !padShown
                ? (
                  <div className="km-face-number" data-miss={erring ? '' : undefined} data-herald={herald || undefined}>
                    <button type="button" className="km-led-key" aria-label={word('number').label} aria-expanded={keypad} onClick={() => setKeypad((v) => !v)}>{led}</button>
                  </div>
                )
                : alt ? roomSelector : <div className="ld-roomwin">{roomKeys()[0]}{roomSelector}{roomKeys()[1]}</div>}
              <span className="km-count" role="img" aria-label={countLabel}><Led text={countText} /></span>
              <ProgressWindow zone={activeZone} label={word('progress').label} seekRef={seekRef} pop={compact && !alt} />
            </div>
            {folded ? (
              <div className="km-face-fold">
                <Cap name="songbook" glow className="km-cap-songbook" active={book} onPress={songbookKey} />
                <Cap name="queue" glow active={program === 'queue'} onPress={queueKey} />
                <Cap name="playPause" className="km-cap-main" strip active={playing} held={pausedNow}
                     disabled={!entry && !(canPlay || playing || (pausedNow && !emptied(tr, queueTotal)))} onPress={press} />
                <Cap name="next" legend={<L.Next size={12} />} disabled={!stepOk(1)} onPress={nextKey} {...holdNext.props} />
                <Cap name="more" className="km-cap-more" legend={<L.Up size={12} />} aria-expanded="false" onPress={() => foldPlate(true)} />
              </div>
            ) : (<>
              <div className="km-face-transport">
                <Cap name="prev" aria-label={t('common.previous')} legend={<L.Prev size={12} />} disabled={!stepOk(-1)} onPress={prevKey} {...holdPrev.props} />
                <Cap name="restart" disabled={!canRestart} onPress={restart} />
                <Cap name="playPause" className="km-cap-main" strip active={playing} held={pausedNow}
                     disabled={!entry && !(canPlay || playing || (pausedNow && !emptied(tr, queueTotal)))} onPress={press} />
                <Cap name="stop" disabled={stopOff} onPress={() => actions.stop(activeZone.uuid, { tv: true })} />
                <Cap name="next" legend={<L.Next size={12} />} disabled={!stepOk(1)} onPress={nextKey} {...holdNext.props} />
              </div>
              <div className="km-face-pages">
                <Cap name="songbook" glow className="km-cap-songbook" active={book} onPress={songbookKey} />
                <Cap name="queue" glow active={program === 'queue'} onPress={queueKey} />
                <Cap name="rooms" glow active={program === 'rooms'} onPress={roomsKey} />
                <Cap name="settings" glow active={program === 'setup'} onPress={settingsKey} />
                <Cap name="full" className="km-cap-full" onPress={toggleFull} />
              </div>
              <div className="km-face-level">
                <Cap label={word(muted ? 'unmute' : 'mute').label} className="km-cap-mute" glow legend={<L.Muted size={15} />} active={muted} disabled={!activeZone}
                     onPress={() => { setMuteAsked(!muted); actions.setMute(activeZone.uuid, !muted, grouped) }} />
                <Bar className="km-fader" lit={playing && !muted} wheelStep={2} value={level} onCommit={setLevel} label={word('volume').label} disabled={!activeZone} showValue={false} />
                <Cap name="less" className="km-cap-more" legend={<L.Down size={12} />} aria-expanded="true" onPress={() => foldPlate(false)} />
              </div>
            </>)}
          </>) : alt ? (<>
            {/* The desktop plate: four framed panels, each under its own name. Choosing a song
                (its window and Songbook over the ten number keys; Queue, the queue's counter,
                and Cancel beside them); playing (Prev and Next either side of Play/Pause,
                Restart and Stop under them); the song's progress over the volume; the room,
                with Rooms, Settings, and Full screen under it; the lyric sync wheel over its figure. */}
            <div className="km-panel km-panel-song" role="group" aria-label={word('songPanel').label}>
              <Words name="songPanel" className="km-panel-title" />
              <div className="km-panel-body">
                <div className="km-desk-song-main">
                  <div className="km-desk-song-top">
                    <div className="km-face-number" data-miss={erring ? '' : undefined} role="img" aria-label={word('number').label}>{led}</div>
                    <Cap name="songbook" glow className="km-cap-book" active={book} onPress={songbookKey} />
                  </div>
                  <div className="km-face-pad" role="group" aria-label={word('number').label}>
                    {DIGIT_KEYS.map((digit) => <Cap key={digit} digit={digit} label={digit} className="km-cap-num" onPress={() => typeDigit(digit)} />)}
                  </div>
                </div>
                <div className="km-desk-song-keys">
                  <HalfCap name="queue" glow active={program === 'queue'} onPress={queueKey} />
                  <span className="km-count" role="img" aria-label={countLabel}><Led text={countText} /></span>
                  <HalfCap name="cancel" className="km-cap-cancel" disabled={!entry} onPress={() => setEntry('')} />
                </div>
              </div>
            </div>
            <div className="km-panel km-panel-play" role="group" aria-label={word('playPanel').label}>
              <Words name="playPanel" className="km-panel-title" />
              <div className="km-panel-body">
                <div className="km-desk-play">
                  <Cap name="prev" className="km-cap-tall" aria-label={t('common.previous')} legend={<L.Prev size={16} />} disabled={!stepOk(-1)} onPress={() => step(-1)} />
                  <Cap name="playPause" className="km-cap-main" strip active={playing} held={pausedNow}
                       disabled={!entry && !(canPlay || playing || (pausedNow && !emptied(tr, queueTotal)))} onPress={press} />
                  <Cap name="next" className="km-cap-tall" legend={<L.Next size={16} />} disabled={!stepOk(1)} onPress={() => step(1)} />
                </div>
                <div className="km-desk-play-pair">
                  <HalfCap name="restart" disabled={!canRestart} onPress={restart} />
                  <HalfCap name="stop" disabled={stopOff} onPress={() => actions.stop(activeZone.uuid, { tv: true })} />
                </div>
              </div>
            </div>
            <div className="km-desk-stack">
              <div className="km-panel km-panel-progress" role="group" aria-label={word('progress').label}>
                <Words name="progress" className="km-panel-title" />
                <div className="km-panel-body">
                  <ProgressWindow zone={activeZone} label={word('progress').label} dial />
                </div>
              </div>
              <div className="km-panel km-panel-volume" role="group" aria-label={word('volume').label}>
                <Words name="volume" className="km-panel-title" />
                <div className="km-panel-body">
                  <Cap label={word(muted ? 'unmute' : 'mute').label} className="km-cap-mute" glow legend={<L.Muted size={15} />} active={muted} disabled={!activeZone}
                       onPress={() => { setMuteAsked(!muted); actions.setMute(activeZone.uuid, !muted, grouped) }} />
                  <Bar className="km-fader" lit={playing && !muted} wheelStep={2} value={level} onCommit={setLevel} label={word('volume').label} disabled={!activeZone} showValue={false} />
                </div>
              </div>
            </div>
            <div className="km-panel km-panel-room" role="group" aria-label={word('room').label}>
              <Words name="room" className="km-panel-title" />
              <div className="km-panel-body">
                {roomSelector}
                <Cap name="rooms" glow active={program === 'rooms'} onPress={roomsKey} />
                <Cap name="settings" glow active={program === 'setup'} onPress={settingsKey} />
                <HalfCap name="full" className="km-cap-full" onPress={toggleFull} />
              </div>
            </div>
            <div className="km-panel km-panel-sync" role="group" aria-label={word(wheelMode === 'scroll' ? 'scroll' : 'lyricSync').label}>
              <FadingWords name={wheelMode === 'scroll' ? 'scroll' : 'sync'} className="km-panel-title" />
              <div className="km-panel-body">
                <SyncWheel offset={sync.offset} mode={wheelMode} onNudge={sync.nudge} disabled={!sync.ready} label={word(wheelMode === 'scroll' ? 'scroll' : 'lyricSync').label}
                           zeroKey={<Cap label={word('syncZero').label} className="km-cap-num km-cap-zero" digit="0" disabled={!sync.ready || !sync.offset} onPress={sync.zero} />}>
                  <Led text={syncText(sync.offset, wheelMode)} />
                </SyncWheel>
              </div>
            </div>
          </>) : (<>
            {/* The desktop plate, laid out as the front of a laser disc player of the 1990s.
                At the left, where the player has its power key, the wide Songbook key with a
                lamp across it, Queue in silver under it, and under them the lyric sync knob. In the sunken middle: Rooms,
                Settings, and Full screen stacked by the display; the display, where the room,
                the song number, the queue's count, the sync, and the song's progress are lit;
                and the key field, the room's two keys and Prev and Next over the number keys, with Cancel and Mute at the ends of their rows. Then the tall keys that
                run the song, a wide Play/Pause over Restart and Stop, and the volume dial at the
                right of them. Every key is named on the panel over it. */}
            {/* An empty piece at the plate's start, as the sheet keeps one at its end: the spare width is
                shared out evenly between the edges and every group, so each has as much room on its left as on its right. */}
            <span className="ld-edge" aria-hidden="true" />
            <div className="ld-left">
              <Cap name="songbook" className="ld-bar" strip active={book} onPress={songbookKey} />
              <Cap name="queue" glow className="ld-silver ld-queue" active={program === 'queue'} onPress={queueKey} />
              <div className="ld-sync" role="group" aria-label={word(wheelMode === 'scroll' ? 'scroll' : 'lyricSync').label}>
                <FadingWords name={wheelMode === 'scroll' ? 'scroll' : 'sync'} className="km-print" />
                <span className="ld-sync-mark ld-sync-less" aria-hidden="true">{'\u2212'}</span>
                <SyncKnob offset={sync.offset} mode={wheelMode} onNudge={sync.nudge} disabled={!sync.ready} label={word(wheelMode === 'scroll' ? 'scroll' : 'lyricSync').label} />
                <span className="ld-sync-mark ld-sync-more" aria-hidden="true">+</span>
                <Cap label={word('syncZero').label} className="km-cap-num km-cap-zero" digit="0" disabled={!sync.ready || !sync.offset} onPress={sync.zero} />
              </div>
            </div>
            <div className="ld-sub">
              <div className="ld-stack">
                <Cap name="rooms" glow active={program === 'rooms'} onPress={roomsKey} />
                <Cap name="settings" glow active={program === 'setup'} onPress={settingsKey} />
                <Cap name="full" className="km-cap-full" onPress={toggleFull} />
              </div>
              <div className="ld-vfd">
                <span className="ld-vfd-glass" aria-hidden="true" />
                <div className="ld-vfd-flags" aria-hidden="true">
                  <span className="ld-vfd-cap ld-vfd-cap-song">SONG</span>
                  <span className="ld-vfd-state">
                    <i data-on={playing || undefined}><L.Play size={9} /></i>
                    <i data-on={pausedNow || undefined}><L.Pause size={9} /></i>
                    <i data-on={(Boolean(activeZone) && tr.state === 'STOPPED') || undefined}><L.Stop size={8} /></i>
                  </span>
                  <span className="ld-vfd-flag" data-on={book || undefined}>BOOK</span>
                  <span className="ld-vfd-flag" data-on={muted || undefined}>MUTE</span>
                  <span className="ld-vfd-flag" data-on={(isLoaded(tr) && tr.explicit === true) || undefined}>EXPLICIT</span>
                </div>
                <div className="ld-vfd-top" aria-hidden="true">
                  <VfdLine text={songLine} enter={activeZone?.uuid} dir={roomDir} />
                </div>
                <span className="ld-vfd-cap ld-vfd-cap-room" aria-hidden="true">ROOM</span>
                {roomSelector}
                <span className="ld-vfd-cap ld-vfd-cap-number" aria-hidden="true">SONG ENTRY</span>
                <span className="ld-vfd-cap ld-vfd-cap-count" aria-hidden="true">QUEUE</span>
                <span className="ld-vfd-cap ld-vfd-cap-sync" data-off={!sync.ready || undefined} aria-hidden="true">{wheelMode === 'scroll' ? 'SPEED' : 'SYNC'}</span>
                <span className="ld-vfd-cap ld-vfd-cap-time" aria-hidden="true">PROGRESS</span>
                <div className="km-face-number" data-miss={erring ? '' : undefined} data-herald={herald || undefined} role="img" aria-label={word('number').label}>{led}</div>
                <span className="km-count" role="img" aria-label={countLabel}><Led text={countText} /></span>
                <WheelNudge className="km-sync-led" onNudge={sync.ready ? sync.nudge : null}><Led text={syncText(sync.offset, wheelMode)} /></WheelNudge>
                <ProgressWindow zone={activeZone} label={word('progress').label} seekRef={seekRef} />
              </div>
              <div className="ld-field km-face-pad" role="group" aria-label={word('number').label}>
                <Cap name="prev" className="ld-skip" aria-label={t('common.previous')} legend={<L.Prev size={9} />} disabled={!stepOk(-1)} onPress={prevKey} {...holdPrev.props} />
                <Cap name="next" className="ld-skip" legend={<L.Next size={9} />} disabled={!stepOk(1)} onPress={nextKey} {...holdNext.props} />
                <div className="ld-field-name"><Words name="songEntry" className="km-print" /></div>
                {DIGIT_KEYS.map((digit) => <Cap key={digit} digit={digit} label={digit} className="km-cap-num" onPress={() => typeDigit(digit)} />)}
                <Cap name="cancel" className="km-cap-cancel" disabled={!entry} onPress={() => setEntry('')} />
                <Cap name="mute" className="km-cap-mute" aria-label={word(muted ? 'unmute' : 'mute').label} active={muted} disabled={!activeZone}
                     onPress={() => { setMuteAsked(!muted); actions.setMute(activeZone.uuid, !muted, grouped) }} />
                <div className="ld-field-room"><Words name="room" className="km-print" /></div>
                {roomKeys()}
              </div>
            </div>
            <div className="ld-transport" role="group" aria-label={word('playPanel').label}>
              <Cap name="playPause" className="ld-tall ld-wide km-cap-main" legend={<span className="ld-playpause"><L.Play size={16} /><L.Pause size={15} /></span>} strip active={playing} held={pausedNow}
                   disabled={!entry && !(canPlay || playing || (pausedNow && !emptied(tr, queueTotal)))} onPress={press} />
              <Cap name="restart" className="ld-tall" legend={<L.Restart size={17} />} disabled={!canRestart} onPress={restart} />
              <Cap name="stop" className="ld-tall" legend={<L.Stop size={14} />} disabled={stopOff} onPress={() => actions.stop(activeZone.uuid, { tv: true })} />
            </div>
            <div className="ld-volume" role="group" aria-label={word('volume').label}>
              <Words name="volume" className="km-print ld-volume-name" />
              {/* Under the dial, at either side, the two quarter-inch jacks for microphones. */}
              <div className="ld-volume-foot">
                {[1, 2].map((n) => (
                  <button key={n} type="button" className="ld-jack" aria-label={`MIC ${n}`} aria-pressed={Boolean(mics[n])} onClick={() => plugMic(n)}>
                    <span className="ld-jack-name" aria-hidden="true">MIC {n}</span>
                    <i aria-hidden="true"><span className="ld-plug" data-on={mics[n] || undefined} style={plugMs[n] ? { '--ld-plug-ms': `${plugMs[n]}ms` } : undefined} /></i>
                  </button>
                ))}
              </div>
              <Words name="volMin" className="ld-volume-end ld-volume-min" />
              <Dial value={level} onCommit={setLevel} label={word('volume').label} disabled={!activeZone} lit={muted ? 'mute' : playing ? 'full' : 'end'} />
              <Words name="volMax" className="ld-volume-end ld-volume-max" />
            </div>
          </>)}
        </footer>
      </div>

      {/* Full screen has no faceplate, so the number window stands under the open binder by
          itself. A press on it brings out the number keys, as the faceplate's window does. */}
      {book && full && (
        <div className="km-face-number km-full-number" data-miss={erring ? '' : undefined} data-herald={herald || undefined} data-pad={keypad || undefined}>
          <button type="button" className="km-led-key" aria-label={word('number').label} aria-expanded={keypad} onClick={() => setKeypad((v) => !v)}>{led}</button>
        </div>
      )}
      {book && full && numberKeys}
      {book && <Binder ref={bookRef} zone={readZone} size={size} full={full} onPick={keyIn} onClosed={() => setBook(false)} alert={alerts[0] || null} />}


      {roomMenu && (() => {
        const { group } = roomMenu
        const zone = zones[group.coordinator]
        if (!zone) return null
        const next = nextTransport(zone.transport || {})
        const name = group.members.length > 1 ? t('desk.rooms.menu.group') : zone.name
        return (
          <Menu x={roomMenu.x} y={roomMenu.y} onClose={() => setRoomMenu(null)} title={groupTitle(group, zones, t)}>
            {canPress(zone.transport) && (
              <MenuItem icon={<G.PlayWhat what={next} size={12} />} onSelect={() => { setRoomMenu(null); playPause(zone) }}>
                {t(next === 'play' ? 'desk.rooms.menu.play' : next === 'stop' ? 'desk.rooms.menu.stop' : 'desk.rooms.menu.pause', { name })}
              </MenuItem>
            )}
            <MenuItem icon={zone.group_muted ? <G.Volume size={12} /> : <G.Muted size={12} />} onSelect={() => { setRoomMenu(null); actions.setMute(zone.uuid, !zone.group_muted, true) }}>
              {t(zone.group_muted ? 'desk.rooms.menu.unmute' : 'desk.rooms.menu.mute', { name })}
            </MenuItem>
            {!group.local && <MenuSep />}
            {!group.local && <MenuItem icon={<G.Group size={12} />} onSelect={() => { setRoomMenu(null); setGroupWindow(group) }}>{t('desk.grouping.title')}</MenuItem>}
          </Menu>
        )
      })()}
      {groupWindow && <GroupWindow group={groups.find((g) => g.id === groupWindow.id) || groupWindow} zones={zones} households={households} onClose={() => setGroupWindow(null)} />}
      {info && !prose && (
        <InfoWindow zone={null} item={info.item} hzone={info.hzone} serviceName={info.serviceName}
                    onClose={() => setInfo(null)} onMessage={say} onOpen={infoOpen} onFavoritesChanged={() => setFavoritesEpoch((v) => v + 1)}
                    onAddToPlaylist={(pick, source) => setAddTo({ picks: [pick], source: source || info.source || '', hzone: info.hzone })}
                    services={Object.values(services.byHousehold || {}).flat()} />
      )}
      {prose && <ProseWindow node={prose} onClose={() => { setProse(null); setInfo(null) }} onBack={() => setProse(null)} />}
      {addTo && <AddToPlaylistWindow picks={addTo.picks} source={addTo.source} hzone={addTo.hzone} onClose={() => setAddTo(null)} onMessage={say} />}
      {/* About opens over the whole page, in front of the cabinet, as it does in every theme. */}
      {about && createPortal(<AboutSonora onClose={() => setAbout(false)} />, document.querySelector('.km-root') || document.body)}
      <UpdateNotice />
      {shortcuts && <ShortcutsWindow onClose={() => setShortcuts(false)} />}
      <TooltipLayer />
    </div>
    </SongbookProvider>
  )
}

export default {
  id: 'karaoke',
  name: 'Karaoke Machine',
  thumbnail,
  description: 'The karaoke aesthetic as foretold by 1990s LaserDisc players. A three-ring binder full of songs. Huge, chunky lyrics. Non sequitur video backgrounds.',
  colorScheme: 'dark',
  // The same machine in a dark room and in a daylit one. Every color is in the stylesheet, keyed
  // to the variant, so neither carries tokens of its own.
  variants: {
    light: { tokens: {}, colorScheme: 'light', thumbnail: lightThumbnail },
    dark: { tokens: {}, colorScheme: 'dark', thumbnail },
  },
  strings,
  tokens,
  Shell,
}
