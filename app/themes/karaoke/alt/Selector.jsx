import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { cx } from '../kit.jsx'

// The room selector on the faceplate: a ridged thumbwheel beside a window, and behind the window
// a drum with the rooms' names printed around it. Turning the wheel turns the drum, a name to a
// click. The wheel and the window are renders; the names are type, laid over the drum.
const SETTLE_MS = 350         // names rolled past choose nothing: the room is the one the drum rests on
const GIVE_UP_MS = 1500       // a room asked for that never becomes the room: the drum goes back
const ROLL_MS = 170
const TAP_PX = 4
const FRAMES = 6              // pictures of the wheel through one ridge's turn
const RIDGE_PX = 3            // ridge to ridge across the front of the wheel, as drawn
const WHEEL_PX_PER_NOTCH = 100
const SQUEEZE = 0.72          // how narrow a long name is set before it is cut short

// The window as lit segments: sixteen to a cell, enough for capitals and figures.
const SEGMENTS = {
  a1: '4.5,2 11.5,2 11.5,5 6.5,5', a2: '12.5,2 19.5,2 17.5,5 12.5,5', b: '21,3 21,17 18,15 18,6', c: '21,19 21,33 18,30 18,21',
  d1: '4.5,34 11.5,34 11.5,31 6.5,31', d2: '12.5,34 19.5,34 17.5,31 12.5,31', e: '3,19 3,33 6,30 6,21', f: '3,3 3,17 6,15 6,6',
  g1: '4.5,18 6.5,16.5 11.3,16.5 11.3,19.5 6.5,19.5', g2: '12.7,16.5 17.5,16.5 19.5,18 17.5,19.5 12.7,19.5',
  h: '6.8,6 8.3,6 10.2,12.6 10.2,15.6 9.4,15.6 6.8,8.6', i: '10.8,6 13.2,6 13.2,15.4 12,16.6 10.8,15.4', j: '17.2,6 15.7,6 13.8,12.6 13.8,15.6 14.6,15.6 17.2,8.6',
  k: '6.8,30 8.3,30 10.2,23.4 10.2,20.4 9.4,20.4 6.8,27.4', l: '10.8,20.6 12,19.4 13.2,20.6 13.2,30 10.8,30', m: '17.2,30 15.7,30 13.8,23.4 13.8,20.4 14.6,20.4 17.2,27.4',
}
const GLYPHS = {
  A: 'a1 a2 b c e f g1 g2', B: 'a1 a2 b c d1 d2 i l g2', C: 'a1 a2 f e d1 d2', D: 'a1 a2 b c d1 d2 i l', E: 'a1 a2 f e d1 d2 g1', F: 'a1 a2 f e g1',
  G: 'a1 a2 f e d1 d2 c g2', H: 'f e b c g1 g2', I: 'a1 a2 d1 d2 i l', J: 'b c d1 d2 e', K: 'f e g1 j m', L: 'f e d1 d2', M: 'f e b c h j', N: 'f e b c h m',
  O: 'a1 a2 b c d1 d2 e f', P: 'a1 a2 b f e g1 g2', Q: 'a1 a2 b c d1 d2 e f m', R: 'a1 a2 b f e g1 g2 m', S: 'a1 a2 f g1 g2 c d1 d2', T: 'a1 a2 i l',
  U: 'f e d1 d2 c b', V: 'f e k j', W: 'f e b c k m', X: 'h j k m', Y: 'h j l', Z: 'a1 a2 j k d1 d2',
  0: 'a1 a2 b c d1 d2 e f j k', 1: 'b c j', 2: 'a1 a2 b g1 g2 e d1 d2', 3: 'a1 a2 b c d1 d2 g2', 4: 'f g1 g2 b c', 5: 'a1 a2 f g1 m d1 d2',
  6: 'a1 a2 f e d1 d2 c g1 g2', 7: 'a1 a2 b c', 8: 'a1 a2 b c d1 d2 e f g1 g2', 9: 'a1 a2 f b c g1 g2 d1 d2',
  '-': 'g1 g2', '+': 'g1 g2 i l', '/': 'j k', '_': 'd1 d2', '*': 'h i j k l m g1 g2', "'": 'i', '&': 'a1 h i g1 e d1 d2 m',
}
const CELL_PX = 13.5          // a cell and the gap after it, as the window is drawn
const WINDOW_PAD = 12
const CRAWL_MS = 420          // a name too long for the window goes past a letter at a time
const CRAWL_REST = 4          // letters' time the name stands still before it sets off
// A name as the window can spell it: capitals, the accents off. A name with a letter the
// segments cannot make (another script) is not spelled at all, and is set in type instead.
function spell(name) {
  const plain = name.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase()
  return [...plain].some((ch) => /\p{L}/u.test(ch) && !GLYPHS[ch]) ? null : plain
}
function Cell({ ch }) {
  const lit = (GLYPHS[ch] || '').split(' ')
  return <svg viewBox="0 0 24 36" focusable="false">{Object.entries(SEGMENTS).map(([id, points]) => <polygon key={id} points={points} data-on={lit.includes(id) || undefined} />)}</svg>
}
// The cells' worth of a name: centered where it fits, and crawling past where it does not.
function Segments({ name, cells }) {
  const text = spell(name)
  const long = text != null && [...text].length > cells
  const [tick, setTick] = useState(0)
  const calm = useMemo(() => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, [])
  useEffect(() => {
    setTick(0)
    if (!long || calm) return undefined
    const timer = setInterval(() => setTick((n) => n + 1), CRAWL_MS)
    return () => clearInterval(timer)
  }, [text, long, calm])
  if (text == null) return <span className="km-led km-roomsel-typed">{name}</span>
  const chars = [...text]
  let shown
  if (!long) {
    const lead = Math.floor((cells - chars.length) / 2)
    shown = [...Array(lead).fill(' '), ...chars, ...Array(cells - chars.length - lead).fill(' ')]
  } else {
    const loop = [...chars, ' ', ' ', ' ']
    const at = Math.max(0, tick - CRAWL_REST) % loop.length
    shown = Array.from({ length: cells }, (_, n) => loop[(at + n) % loop.length])
  }
  return <span className="km-led">{shown.map((ch, n) => <Cell key={n} ch={ch} />)}</span>
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// rooms: [{ id, name }], in the order the drum carries them. value: the id of the room chosen.
// print: the plate's lettering for it, set over the window.
export function RoomSelector({ rooms, value, onChoose, onOpen, onMenu, label, empty = '', print = null, className = '', led = false }) {
  const [held, setHeld] = useState(null)   // the name under the window while it is not yet the room
  const rootRef = useRef(null)
  const drumRef = useRef(null)
  const stripRef = useRef(null)
  const wheelRef = useRef(null)
  const shift = useRef(0)      // how far the drum stands off its click, in px: below it when positive
  const travel = useRef(0)     // how far the wheel's face has gone up, in all
  const drag = useRef(null)
  const raf = useRef(0)
  const timer = useRef(0)
  const carry = useRef(0)
  const heldNow = useRef(null)
  const now = useRef({})
  now.current = { rooms, value, onChoose, onOpen }
  const calm = useMemo(() => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, [])

  const n = rooms.length
  const at = rooms.findIndex((room) => room.id === (held ?? value))
  const nameAt = (offset) => (n > 1 && at !== -1 ? rooms[(at + offset + n) % n].name : '')
  const current = at === -1 ? '' : rooms[at].name

  const row = () => drumRef.current?.clientHeight || 24
  const draw = () => {
    if (stripRef.current) stripRef.current.style.transform = `translateY(${shift.current.toFixed(2)}px)`
    const frame = ((Math.round(travel.current / (RIDGE_PX / FRAMES)) % FRAMES) + FRAMES) % FRAMES
    wheelRef.current?.style.setProperty('--km-wheel-frame', String(frame))
  }
  // The drum comes to rest on its click from wherever it stands. Behind the lit window there is
  // no drum to keep pace with, and a row's worth of turn in so short a time would pass the ridges
  // faster than they can be seen to move: there the wheel turns a little over a ridge to a click.
  const gear = led ? (RIDGE_PX * 1.2) / 30 : 1
  const roll = () => {
    cancelAnimationFrame(raf.current)
    const from = shift.current
    if (!from) return
    if (calm) { travel.current += from * gear; shift.current = 0; draw(); return }
    const start = performance.now()
    const tick = (time) => {
      const t = clamp((time - start) / ROLL_MS, 0, 1)
      const next = from * (1 - t) ** 3
      travel.current += (shift.current - next) * gear
      shift.current = next
      draw()
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }

  const show = (id) => { heldNow.current = id; flushSync(() => setHeld(id)) }
  const idAt = (dir) => {
    const list = now.current.rooms
    const index = list.findIndex((room) => room.id === (heldNow.current ?? now.current.value))
    if (index === -1) return list[dir > 0 ? 0 : list.length - 1].id
    return list[(index + dir + list.length) % list.length].id
  }
  const settle = (atOnce = false) => {
    clearTimeout(timer.current)
    const choose = () => {
      const id = heldNow.current
      if (id == null) return
      if (id !== now.current.value) now.current.onChoose(id)
      timer.current = setTimeout(() => { heldNow.current = null; setHeld(null) }, GIVE_UP_MS)
    }
    if (atOnce) choose()
    else timer.current = setTimeout(choose, SETTLE_MS)
  }
  // One click of the wheel: onward (the next name comes up from below) or back.
  const turn = (dir) => {
    const list = now.current.rooms
    if (!list.length) return
    const height = row()
    const alone = list.length < 2 && list.some((room) => room.id === now.current.value)
    if (alone) {
      // One room: the wheel gives a little and springs back.
      if (!calm) { shift.current = -dir * height * 0.3; travel.current += dir * height * 0.3 * gear; draw(); roll() }
      return
    }
    cancelAnimationFrame(raf.current)
    show(idAt(dir))
    shift.current = clamp(shift.current + dir * height, -1.5 * height, 1.5 * height)
    draw()
    roll()
    settle()
  }
  const turnNow = useRef(turn)
  turnNow.current = turn

  // The room became the one the drum shows: nothing is held any longer.
  useEffect(() => {
    if (held == null || held !== value || drag.current) return
    clearTimeout(timer.current)
    heldNow.current = null
    setHeld(null)
  }, [held, value])
  // A held room that has gone from the house is let go of.
  useEffect(() => {
    if (held != null && !rooms.some((room) => room.id === held)) { clearTimeout(timer.current); heldNow.current = null; setHeld(null) }
  }, [held, rooms])
  // The room changed from somewhere else (a list, a shortcut): the drum turns to it, the short way round.
  const last = useRef(value)
  useLayoutEffect(() => {
    const before = last.current
    last.current = value
    if (before === value || before == null || heldNow.current != null || drag.current || calm) return
    const from = rooms.findIndex((room) => room.id === before)
    const to = rooms.findIndex((room) => room.id === value)
    if (from === -1 || to === -1) return
    const ahead = (to - from + n) % n
    shift.current = (ahead <= n / 2 ? 1 : -1) * row()
    draw()
    roll()
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { cancelAnimationFrame(raf.current); clearTimeout(timer.current) }, [])

  // A name too long for the window is set narrower, and one still too long is cut short.
  const [width, setWidth] = useState(0)
  const [cell, setCell] = useState(CELL_PX)
  const [cut, setCut] = useState(false)
  const [faces, setFaces] = useState(0)
  useEffect(() => {
    let live = true
    document.fonts?.ready?.then(() => { if (live) setFaces(1) })
    return () => { live = false }
  }, [])
  const shown = `${nameAt(-1)}\n${current}\n${nameAt(1)}`
  useLayoutEffect(() => {
    const drum = drumRef.current
    if (!drum || typeof ResizeObserver === 'undefined') return undefined
    const watch = new ResizeObserver(() => {
      setWidth(drum.clientWidth)
      // The cells are drawn smaller on a phone, so more of them go in the window.
      const drawn = drum.querySelector('.km-led svg')
      const wide = drawn ? parseFloat(getComputedStyle(drawn).width) : 0
      setCell(wide > 0 ? wide + 1.5 : CELL_PX)
    })
    watch.observe(drum)
    return () => watch.disconnect()
  }, [])
  useLayoutEffect(() => {
    const strip = stripRef.current
    if (!strip) return
    let short = false
    ;[...strip.children].forEach((line, index) => {
      const name = line.firstElementChild
      name.style.width = 'max-content'
      name.style.transform = ''
      const room = line.clientWidth
      const wanted = name.offsetWidth
      if (!room || wanted <= room) { name.style.width = ''; return }
      const scale = Math.max(SQUEEZE, room / wanted)
      name.style.width = `${room / scale}px`
      name.style.transform = `scaleX(${scale.toFixed(3)})`
      if (index === 1 && wanted * SQUEEZE > room + 0.5) short = true
    })
    setCut(short)
  }, [shown, width, faces])
  const cells = Math.max(4, Math.floor((width - WINDOW_PAD) / cell))
  const spelled = led ? spell(current) : null
  const over = led && spelled != null && [...spelled].length > cells

  // The page's own listener, so the wheel can be kept from anything behind the selector.
  useEffect(() => {
    const el = rootRef.current
    if (!el) return undefined
    const onWheel = (event) => {
      event.preventDefault()
      // Read before the deltas: Firefox reports a mouse wheel in lines, a notch an event, only
      // to a page that asks for the mode first.
      const mode = event.deltaMode
      const along = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX
      if (!along) return
      let notches = Math.sign(along)
      if (mode === 0) {
        carry.current += along
        notches = Math.trunc(carry.current / WHEEL_PX_PER_NOTCH)
        carry.current -= notches * WHEEL_PX_PER_NOTCH
      }
      for (let i = 0; i < Math.min(3, Math.abs(notches)); i += 1) turnNow.current(Math.sign(notches))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const onPointerDown = (event) => {
    if (event.button !== 0 || !event.isPrimary || drag.current) return
    const el = rootRef.current
    cancelAnimationFrame(raf.current)
    // The plate may be drawn smaller than it is laid out: the finger's travel is put back into the plate's own px.
    const scale = el.offsetHeight ? el.getBoundingClientRect().height / el.offsetHeight : 1
    drag.current = { id: event.pointerId, y: event.clientY, scale: scale || 1, last: 0, pull: 0, moved: false, wheel: Boolean(event.target.closest?.('.km-roomsel-wheel')) }
    try { el.setPointerCapture(event.pointerId) } catch { /* the pointer has already gone */ }
  }
  // A press here never begins a selection of the page's words or a drag of them: WebKit starts
  // one as the pointer passes over the plate's lettering, and the turn then never hears its end.
  // The press still takes the keyboard's attention, which holding the press back would have lost,
  // and without the ring a key would draw (Firefox draws one for a script unless told not to).
  // Told so, a browser keeps the ring off until the keys go elsewhere and come back, and WebKit
  // keeps a ring it has drawn through a later press. So the selector says which hand it was last
  // worked with, and the ring follows that for as long as the keys stay here.
  const onMouseDown = (event) => {
    if (event.button !== 0) return
    event.preventDefault()
    rootRef.current?.setAttribute('data-ring', 'off')
    rootRef.current?.focus({ preventScroll: true, focusVisible: false })
  }
  const onPointerMove = (event) => {
    const d = drag.current
    if (!d || event.pointerId !== d.id) return
    const dy = (event.clientY - d.y) / d.scale
    if (!d.moved && Math.abs(dy) < TAP_PX) return
    if (!d.moved) { d.moved = true; rootRef.current.setAttribute('data-turning', '') }
    const step = dy - d.last
    d.last = dy
    const height = row()
    const list = now.current.rooms
    if (list.length < 2) {
      // Nothing to turn to: the wheel gives a little under the finger.
      d.pull += step
      const next = clamp(d.pull * 0.35, -height * 0.35, height * 0.35)
      travel.current -= next - shift.current
      shift.current = next
      draw()
      return
    }
    shift.current += step
    travel.current -= step
    while (shift.current <= -height / 2) { show(idAt(1)); shift.current += height }
    while (shift.current > height / 2) { show(idAt(-1)); shift.current -= height }
    draw()
    settle()
  }
  const onPointerUp = (event) => {
    const d = drag.current
    if (!d || event.pointerId !== d.id) return
    drag.current = null
    const el = rootRef.current
    el.removeAttribute('data-turning')
    if (!d.moved) {
      if (event.type !== 'pointerup') return
      if (d.wheel) {
        // A press on the wheel's upper half turns back a name, on its lower half onward.
        const box = wheelRef.current.getBoundingClientRect()
        turn(event.clientY < box.top + box.height / 2 ? -1 : 1)
      } else now.current.onOpen?.()
      return
    }
    roll()
    if (heldNow.current != null) settle(true)
  }
  const onKeyDown = (event) => {
    if (!['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) rootRef.current?.setAttribute('data-ring', 'on')
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    const dir = { ArrowDown: 1, ArrowRight: 1, PageDown: 1, ArrowUp: -1, ArrowLeft: -1, PageUp: -1 }[event.key]
    if (dir) { event.preventDefault(); event.stopPropagation(); turn(dir); return }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      event.stopPropagation()
      if (n < 2) return
      const target = rooms[event.key === 'Home' ? 0 : n - 1].id
      if (target === (heldNow.current ?? value)) return
      const dir2 = event.key === 'Home' ? -1 : 1
      cancelAnimationFrame(raf.current)
      show(target)
      shift.current = dir2 * row()
      draw()
      roll()
      settle()
      return
    }
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onOpen?.() }
  }

  return (
    <div className={cx('km-roomsel', className)} ref={rootRef} role="slider" tabIndex={0} aria-orientation="vertical"
         aria-label={label} aria-valuemin={1} aria-valuemax={Math.max(1, n)} aria-valuenow={Math.max(1, at + 1)} aria-valuetext={current || empty}
         data-tip={cut || over ? current : undefined} data-empty={at === -1 || undefined}
         onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
         onMouseDown={onMouseDown} onDragStart={(event) => event.preventDefault()}
         onKeyDown={onKeyDown} onBlur={(event) => event.currentTarget.removeAttribute('data-ring')} onContextMenu={onMenu}>
      {print}
      {led && (
        <span className="km-roomsel-drum km-roomsel-lit" ref={drumRef} aria-hidden="true">
          <Segments name={current || '---'} cells={cells} />
        </span>
      )}
      {!led && <span className="km-roomsel-drum" ref={drumRef}>
        <span className="km-roomsel-view" aria-hidden="true">
          <span className="km-roomsel-strip" ref={stripRef}>
            <span className="km-roomsel-line"><span className="km-roomsel-name">{nameAt(-1)}</span></span>
            <span className="km-roomsel-line"><span className="km-roomsel-name">{current || '- - -'}</span></span>
            <span className="km-roomsel-line"><span className="km-roomsel-name">{nameAt(1)}</span></span>
          </span>
        </span>
      </span>}
      <span className="km-roomsel-wheel" ref={wheelRef} aria-hidden="true"><i /></span>
    </div>
  )
}
