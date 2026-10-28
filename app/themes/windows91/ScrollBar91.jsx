import { useEffect, useRef, useState } from 'react'

// The 2018 app's own scrollbar for the dark panes (its ScrollBarStyle): no
// track, a 9px rounded thumb and two small arrows, drawn translucent until
// the pointer is over the bar, when they all take the lit gradient. The
// browser's bar is hidden on the element (see classic.css) and this one is
// laid over its right edge; while the content overflows the element keeps
// a column clear for it, as the app's Auto visibility does.
//
// `target` is a ref to the scrolling element. The bar is placed beside it
// in the same parent, so a dialog's backdrop dims both alike.
const LINE = 16
const FIRST_REPEAT = 400
const REPEAT = 50
const MIN_THUMB = 50
// Offsets inside the bar, measured against the running app: the up arrow
// 5px from the top, the track from 18px down to 17px above the foot, the
// down arrow's foot 5px above the bar's.
const TRACK_TOP = 18
const TRACK_INSET = 35

export default function ScrollBar91({ target }) {
  const [geo, setGeo] = useState(null)
  const [hot, setHot] = useState(false)
  const drag = useRef(null)
  const timer = useRef(null)

  useEffect(() => {
    const el = target.current
    if (!el) return undefined
    let frame = 0
    const measure = () => {
      frame = 0
      const over = el.scrollHeight - el.clientHeight > 1
      if (over) el.setAttribute('data-w91-overflow', '')
      else el.removeAttribute('data-w91-overflow')
      setGeo(over ? {
        top: el.offsetTop, left: el.offsetLeft + el.offsetWidth, height: el.clientHeight,
        scroll: el.scrollTop, max: el.scrollHeight - el.clientHeight, view: el.clientHeight, full: el.scrollHeight,
      } : null)
    }
    const soon = () => { if (!frame) frame = requestAnimationFrame(measure) }
    const sizes = new ResizeObserver(soon)
    const watchChildren = () => {
      sizes.disconnect()
      sizes.observe(el)
      for (const child of el.children) sizes.observe(child)
      soon()
    }
    const children = new MutationObserver(watchChildren)
    children.observe(el, { childList: true })
    watchChildren()
    el.addEventListener('scroll', soon, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      sizes.disconnect()
      children.disconnect()
      el.removeEventListener('scroll', soon)
      el.removeAttribute('data-w91-overflow')
    }
  }, [target])

  useEffect(() => () => clearTimeout(timer.current), [])

  if (!geo) return null
  const track = Math.max(0, geo.height - TRACK_INSET)
  const thumb = Math.min(track, Math.max(MIN_THUMB, Math.round((track * geo.view) / geo.full)))
  const thumbTop = TRACK_TOP + (geo.max > 0 ? Math.round(((track - thumb) * geo.scroll) / geo.max) : 0)

  const stop = () => { clearTimeout(timer.current); timer.current = null }
  // A RepeatButton: one step at once, then again and again while held.
  const repeat = (event, step) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const el = target.current
    const go = (wait) => {
      if (step(el) === false) return stop()
      timer.current = setTimeout(() => go(REPEAT), wait)
    }
    go(FIRST_REPEAT)
  }
  const page = (event) => {
    const bar = event.currentTarget.getBoundingClientRect()
    const y = event.clientY - bar.top
    repeat(event, (el) => {
      const top = TRACK_TOP + (el.scrollHeight - el.clientHeight > 0
        ? ((track - thumb) * el.scrollTop) / (el.scrollHeight - el.clientHeight) : 0)
      if (y >= top && y < top + thumb) return false
      el.scrollTop += y < top ? -el.clientHeight : el.clientHeight
      return undefined
    })
  }
  const grab = (event) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    drag.current = { y: event.clientY, scroll: target.current.scrollTop }
  }
  const move = (event) => {
    if (!drag.current || track <= thumb) return
    const el = target.current
    el.scrollTop = drag.current.scroll + ((event.clientY - drag.current.y) * (el.scrollHeight - el.clientHeight)) / (track - thumb)
  }
  const release = () => { drag.current = null }

  return (
    <div className="w91-sb" aria-hidden="true" data-hot={hot ? 'true' : undefined}
         style={{ top: geo.top, left: geo.left, height: geo.height }}
         onPointerEnter={() => setHot(true)} onPointerLeave={() => { setHot(false); stop() }}
         onPointerDown={page} onPointerUp={stop} onPointerCancel={stop}>
      <span className="w91-sb-up" onPointerDown={(e) => { e.stopPropagation(); repeat(e, (el) => { el.scrollTop -= LINE }) }} />
      <span className="w91-sb-thumb" style={{ top: thumbTop, height: thumb }}
            onPointerDown={grab} onPointerMove={move} onPointerUp={release} onPointerCancel={release} />
      <span className="w91-sb-down" onPointerDown={(e) => { e.stopPropagation(); repeat(e, (el) => { el.scrollTop += LINE }) }} />
    </div>
  )
}
