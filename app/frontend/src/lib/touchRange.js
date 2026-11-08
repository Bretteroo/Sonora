// Volume sliders by touch, for every theme.
//
// A finger landing beside a slider's thumb does not send the level there, as
// it would by mouse: a tap steps it one unit toward the side tapped, and a
// drag, begun anywhere on the slider, moves it by the finger's travel from
// where it stood. The Sonos phone apps do the same (S1's SonosSeekBar steps
// by one on a tap away from the thumb; S2's volume slider steps toward a tap
// and drags by delta), so a stray tap on a phone cannot turn a room up to the
// far end of the track.
//
// It covers the sliders a wheel steps (`data-wheel-step`, see wheelRange.js):
// volume and tone, not seek bars. Where the finger is on the track is left to
// the browser: the value it jumps to says which side of the thumb the tap
// fell on and, while dragging, how far the finger has gone, whatever the
// slider's direction or the transforms over it. That jump is kept from the
// page, and the value the page sees is set here and reported the way a hand
// would report it: an `input` event (React's onChange) and the slider's own
// pointerup, so no theme's slider code changes.

const SLOP_PX = 8
// A tap this close to the thumb, as a share of the track, is on the thumb.
const ON_THUMB = 0.04
// After the release, the browser's own last word on the value is dropped.
const TAIL_MS = 150

const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
let touch = null

function bounds(input) {
  const min = input.min === '' ? 0 : Number(input.min)
  const max = input.max === '' ? 100 : Number(input.max)
  return { min, max }
}

function snap(input, value) {
  const { min, max } = bounds(input)
  const own = Number(input.step)
  const step = own > 0 ? own : 1
  return Math.max(min, Math.min(max, min + Math.round((value - min) / step) * step))
}

function show(input, value) {
  valueSetter.call(input, String(value))
}

function report(input, value) {
  show(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function onPointerDown(event) {
  if (event.pointerType !== 'touch' || !event.isPrimary) return
  const input = event.target instanceof HTMLInputElement && event.target.type === 'range' && event.target
  if (!input || input.disabled || !input.hasAttribute('data-wheel-step')) return
  touch = { input, id: event.pointerId, x: event.clientX, y: event.clientY, start: Number(input.value),
            landed: null, value: Number(input.value), dragging: false, ended: 0 }
}

function onPointerMove(event) {
  const t = touch
  if (!t || t.ended || event.pointerId !== t.id || t.dragging) return
  if (Math.hypot(event.clientX - t.x, event.clientY - t.y) > SLOP_PX) t.dragging = true
}

// The browser moves the thumb to the finger; the page is shown the value the
// gesture means instead.
function onInput(event) {
  const t = touch
  if (!t || event.target !== t.input || !event.isTrusted) return
  if (t.ended) {
    if (performance.now() - t.ended > TAIL_MS) { touch = null; return }
    show(t.input, t.value)
    event.stopImmediatePropagation()
    return
  }
  const at = Number(t.input.value)
  if (t.landed === null) t.landed = at
  // The thumb following the finger is a drag too, should the browser keep
  // its pointer moves to itself while it does.
  else if (at !== t.landed) t.dragging = true
  if (!t.dragging) {
    show(t.input, t.start)
    event.stopImmediatePropagation()
    return
  }
  const next = snap(t.input, t.start + (at - t.landed))
  t.value = next
  show(t.input, next)
  if (event.type === 'change') event.stopImmediatePropagation()
}

function onPointerUp(event) {
  const t = touch
  if (!t || t.ended || event.pointerId !== t.id) return
  t.ended = performance.now()
  if (t.dragging || t.landed === null) return
  const { min, max } = bounds(t.input)
  const off = t.landed - t.start
  if (Math.abs(off) <= (max - min) * ON_THUMB) return
  const next = snap(t.input, t.start + Math.sign(off))
  t.value = next
  if (next !== t.start) report(t.input, next)
}

// The browser took the touch for a scroll: the thumb goes back unless it was
// being dragged, and a drag ends as a release would end it.
function onPointerCancel(event) {
  const t = touch
  if (!t || t.ended || event.pointerId !== t.id) return
  t.ended = performance.now()
  if (t.dragging) t.input.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
  else show(t.input, t.start)
}

let installed = false
export function installTouchRange() {
  if (installed || typeof document === 'undefined') return
  installed = true
  // On the document, capturing, so they run before React's own listeners on its root.
  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('pointermove', onPointerMove, true)
  document.addEventListener('pointerup', onPointerUp, true)
  document.addEventListener('pointercancel', onPointerCancel, true)
  document.addEventListener('input', onInput, true)
  document.addEventListener('change', onInput, true)
}
