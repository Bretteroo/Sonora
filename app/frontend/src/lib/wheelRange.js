// Sliders by mouse wheel, for every theme.
//
// Any range input moves while the wheel turns over it, a step per notch, up
// or right to raise. The step is the input's `data-wheel-step` when a theme
// sets one (volume uses 2, the Sonos desktop app's SmallChange per notch for
// its volume sliders), else the input's own step. A fine-grained slider (EQ
// rows step by 0.05 to snap to their middle) moves by 1, and a long one, a
// seek bar over a track's seconds, by 5, so a notch always does something
// visible.
//
// The input is driven the way a hand would drive it, so each theme's own
// slider code needs nothing new: the value is set and an `input` event fired,
// which React reports as onChange (the live update every slider makes while
// dragged), and once the wheel stops a `pointerup`, which every slider treats
// as the end of a drag and the moment to send.

const SETTLE_MS = 300
// A wheel in pixel mode (trackpads, and Chromium's mouse wheel, 100px a
// notch) reports distance, not notches: one notch per this many pixels, the
// remainder kept.
const PX_PER_NOTCH = 100

const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
let carry = 0
let carryFor = null
const settling = new Map()

function onWheel(event) {
  const input = event.target instanceof Element && event.target.closest('input[type="range"]')
  if (!input || input.disabled) return
  event.preventDefault()
  // Read before the deltas: Firefox reports a mouse wheel in lines, one event
  // a notch, only to a page that asks for deltaMode first; otherwise it
  // converts to pixels and a notch's size depends on the system.
  const mode = event.deltaMode
  // Mostly vertical: up raises. Mostly sideways: right raises.
  const along = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? -event.deltaY : event.deltaX
  if (!along) return
  let notches
  if (mode === 0) {
    if (carryFor !== input) { carry = 0; carryFor = input }
    carry += along
    notches = Math.trunc(carry / PX_PER_NOTCH)
    carry -= notches * PX_PER_NOTCH
  } else {
    notches = Math.sign(along)
  }
  if (!notches) return
  const min = input.min === '' ? 0 : Number(input.min)
  const max = input.max === '' ? 100 : Number(input.max)
  const step = wheelStep(input, max - min)
  const now = Number(input.value)
  const next = Math.max(min, Math.min(max, Math.round((now + notches * step) / step) * step))
  if (next !== now) {
    valueSetter.call(input, String(next))
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }
  clearTimeout(settling.get(input))
  settling.set(input, setTimeout(() => {
    settling.delete(input)
    input.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
  }, SETTLE_MS))
}

function wheelStep(input, span) {
  const given = Number(input.dataset.wheelStep)
  if (given > 0) return given
  if (span > 200) return 5
  const own = Number(input.step)
  return own >= 1 ? own : 1
}

// Firefox follows the release of a dragged range with one more `input` and a `change` event
// carrying the value it already had, and React reports both as onChange. Every slider here takes
// that as the start of a drag, so the echo
// put it back into one just after it had ended: it went on showing its own value, ignored the
// room's, and let go only when it lost focus, which read as a jump back and forth. The echo is
// dropped before the page sees it: same value, on the same input, just after its pointerup.
const ECHO_MS = 120
function onPointerUp(event) {
  const input = event.target
  if (input instanceof HTMLInputElement && input.type === 'range') {
    input.__releasedAt = performance.now()
    input.__releasedValue = input.value
  }
}
function onInputEcho(event) {
  const input = event.target
  if (!(input instanceof HTMLInputElement) || input.type !== 'range' || !input.__releasedAt) return
  if (performance.now() - input.__releasedAt < ECHO_MS && input.value === input.__releasedValue) {
    event.stopImmediatePropagation()
    return
  }
  input.__releasedAt = 0
}

let installed = false
export function installWheelRange() {
  if (installed || typeof document === 'undefined') return
  installed = true
  // Not passive: the page must not scroll under the slider being turned.
  document.addEventListener('wheel', onWheel, { passive: false, capture: true })
  // On the document, capturing, so they run before React's own listeners on its root.
  document.addEventListener('pointerup', onPointerUp, true)
  document.addEventListener('input', onInputEcho, true)
  document.addEventListener('change', onInputEcho, true)
}
