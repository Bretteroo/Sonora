import { useEffect } from 'react'

// A press has to be seen. A mouse click holds a key down for a tenth of a second and a tap for
// less, and a browser on a phone waits before it calls a touched thing pressed at all, so a tap
// came and went with nothing drawn. The machine marks the pressed thing itself: the mark goes on
// when the pointer comes down and stays for at least HOLD, however soon the pointer lifts. The
// sheet draws every pressed look from this mark.
const MARK = 'data-km-press'
const HOLD = 170
// A finger that comes down on a list may be about to scroll it. The mark waits this long there,
// and a scroll that starts first never makes it; a tap that ends first is marked as it ends.
const TOUCH_WAIT = 70
const PRESSABLE = [
  'button', 'a[href]', 'label', 'summary',
  '[role="button"]', '[role="tab"]', '[role="option"]', '[role="switch"]', '[role="radio"]',
  '[role="menuitem"]', '[role="menuitemradio"]', '[role="menuitemcheckbox"]',
].join(', ')

function pressable(target) {
  const el = target instanceof Element ? target.closest(PRESSABLE) : null
  if (!el || !el.closest('.km-root')) return null
  // A key with nothing to do still goes down when pressed: it is only the press that does nothing.
  if (el.disabled || el.closest('[inert]')) return null
  // A label stands for its control.
  if (el.tagName === 'LABEL' && el.querySelector('input:disabled')) return null
  return el
}

// Whether a finger on this could be the start of a scroll: it sits in a box on the picture that has
// more in it than it shows.
function mayScroll(el) {
  const screen = el.closest('.km-crt')
  for (let box = el.parentElement; screen && box && box !== screen.parentElement; box = box.parentElement) {
    if (box.scrollHeight <= box.clientHeight + 1 && box.scrollWidth <= box.clientWidth + 1) continue
    const style = getComputedStyle(box)
    if (/auto|scroll/.test(style.overflowY + style.overflowX)) return true
  }
  return false
}

export function usePressed() {
  useEffect(() => {
    let held = null
    let since = 0
    let waiting = 0
    let fading = 0
    let pointer = null
    let pending = null
    const lift = () => { clearTimeout(fading); held?.removeAttribute(MARK); held = null }
    const mark = (el) => { lift(); held = el; since = performance.now(); el.setAttribute(MARK, '') }
    const release = () => {
      clearTimeout(fading)
      if (!held) return
      const left = HOLD - (performance.now() - since)
      if (left > 0) fading = setTimeout(lift, left)
      else lift()
    }
    const down = (event) => {
      if (event.button > 0 || !event.isPrimary) return
      const el = pressable(event.target)
      clearTimeout(waiting); waiting = 0; pending = null
      if (!el) return
      pointer = event.pointerId
      if (event.pointerType === 'touch' && mayScroll(el)) {
        lift()
        pending = el
        waiting = setTimeout(() => { waiting = 0; mark(el) }, TOUCH_WAIT)
      } else {
        mark(el)
      }
    }
    const up = (event) => {
      if (event.pointerId !== pointer) return
      pointer = null
      if (pending && waiting) { clearTimeout(waiting); waiting = 0; mark(pending) }
      pending = null
      release()
    }
    const cancel = (event) => {
      if (event.pointerId !== pointer) return
      pointer = null
      clearTimeout(waiting); waiting = 0; pending = null
      lift()
    }
    // Enter and the space bar press whatever has the focus.
    const key = (event) => {
      if (event.repeat || (event.key !== 'Enter' && event.key !== ' ')) return
      if (!(event.target instanceof Element) || !event.target.matches(PRESSABLE)) return
      const el = pressable(event.target)
      if (!el) return
      mark(el)
      release()
    }
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('pointerup', up, true)
    window.addEventListener('pointercancel', cancel, true)
    window.addEventListener('keydown', key, true)
    return () => {
      window.removeEventListener('pointerdown', down, true)
      window.removeEventListener('pointerup', up, true)
      window.removeEventListener('pointercancel', cancel, true)
      window.removeEventListener('keydown', key, true)
      clearTimeout(waiting)
      lift()
    }
  }, [])
}
