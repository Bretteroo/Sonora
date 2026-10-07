import '../components/shared.css'
import React, { createContext, forwardRef, useContext, useEffect, useImperativeHandle, useRef } from 'react'

// The Windows app's Now Playing marquee (nowplaying/metadatacontrol.xaml,
// MetadataControl.cs, Utilities/MarqueeManager.cs), once reported
// missing here. A line too long for the pane rests cut with an ellipsis. In
// turn, one line at a time with two seconds between, the full text slides
// left at 50 px/s until its end sits 25px inside the right edge, then carries
// on out while the cut copy slides in from the right behind it and settles
// where it rests. Lines that fit are skipped; nothing moves while the window
// is not the active one.

//
// The Mac app's is its own (SAMarqueeManager, SAMarqueeView, read out of the
// S1 Mac binary on 2026-09-23 and watched in the app): the same four lines,
// three seconds before the first scroll and between scrolls, the ellipsis
// dropped 0.3s before the move, then one linear pass at 40 points a second.
// The whole text runs out to the left and the cut copy follows a gap of 0.4
// of the line's width behind it, arriving where it rests. It keeps going
// while the window is in the background -- it stops only when the window is
// minimized or closed (NSWindowWillMiniaturize / WillClose) -- and a click
// on a line scrolls it at once.

const STYLES = {
  windows: { speed: 50, first: 2000, pause: 2000, endGap: 25, restGap: 5, background: false, click: false },
  mac: { speed: 40, first: 3000, pause: 3000, endGap: 0, restGap: 0, background: true, click: true, prepare: 300, gap: 0.4 },
}

const MarqueeContext = createContext(null)

export function MarqueeProvider({ enabled, style = 'windows', children }) {
  const lines = useRef(new Set())
  const current = useRef(null)
  const wake = useRef(null)
  const look = STYLES[style === true ? 'windows' : style] || STYLES.windows
  useEffect(() => {
    if (!enabled) return undefined
    let stopped = false
    let timer = null
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced) return undefined
    // The Windows app scrolls only in the active window; the Mac app until
    // its window is minimized or closed, which a page sees as hidden.
    const active = () => document.visibilityState === 'visible' && (look.background || document.hasFocus())
    const sleep = (ms) => new Promise((resolve) => { timer = setTimeout(resolve, ms); wake.current = resolve })
    // In the order the lines are drawn, as the apps enumerate them.
    const ordered = () => [...lines.current].filter((line) => line.node())
      .sort((a, b) => (a.node().compareDocumentPosition(b.node()) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
    const loop = async () => {
      let index = 0
      let wait = look.first
      while (!stopped) {
        await sleep(wait)
        wait = look.pause
        if (stopped) return
        if (!active()) continue
        const scrolling = ordered().filter((line) => line.willScroll())
        if (!scrolling.length) continue
        const line = current.current || scrolling[index % scrolling.length]
        index += 1
        current.current = line
        await line.run(look)
        current.current = null
      }
    }
    loop()
    const halt = () => { if (!active()) current.current?.reset() }
    window.addEventListener('blur', halt)
    document.addEventListener('visibilitychange', halt)
    return () => {
      stopped = true
      clearTimeout(timer)
      current.current?.reset()
      window.removeEventListener('blur', halt)
      document.removeEventListener('visibilitychange', halt)
    }
  }, [enabled, look])
  const value = useRef(null)
  if (!value.current) {
    value.current = {
      add: (line) => lines.current.add(line),
      remove: (line) => lines.current.delete(line),
      // A click on a Mac line scrolls it now: it goes next, and the wait
      // before it is cut short.
      poke: (line) => { if (current.current) return; current.current = line; wake.current?.() },
    }
  }
  value.current.style = look
  value.current.name = STYLES[style] ? style : 'windows'
  return <MarqueeContext.Provider value={enabled ? value.current : null}>{children}</MarqueeContext.Provider>
}

// One line of text that takes its turn. Outside a provider, or with the
// provider off, it is the plain cut text it always was.
export const MarqueeText = forwardRef(function MarqueeText({ children, className = '' }, outer) {
  const manager = useContext(MarqueeContext)
  const box = useRef(null)
  const rest = useRef(null)
  const full = useRef(null)
  const running = useRef([])
  const handle = useRef(null)
  useImperativeHandle(outer, () => box.current)

  const reset = () => {
    for (const animation of running.current) animation.cancel()
    running.current = []
    if (full.current) full.current.style.visibility = 'hidden'
    if (rest.current) rest.current.style.visibility = ''
  }

  useEffect(() => {
    if (!manager) return undefined
    const line = {
      node: () => box.current,
      willScroll: () => Boolean(full.current && rest.current
        && full.current.scrollWidth - manager.style.endGap > rest.current.clientWidth + 0.5),
      reset,
      run: (look) => new Promise((resolve) => {
        const width = box.current?.clientWidth || 0
        const text = full.current.scrollWidth - look.endGap
        full.current.style.visibility = 'visible'
        rest.current.style.visibility = 'hidden'
        if (look.gap != null) {
          // The Mac's single pass: the whole text from where it starts, the
          // cut copy a gap of 0.4 of the width after its end, both moving
          // left together until the copy is home.
          const distance = text + Math.round(look.gap * width)
          const seconds = distance / look.speed
          const go = () => {
            const out = full.current.animate(
              [{ transform: 'translateX(0)' }, { transform: `translateX(${-distance}px)` }],
              { duration: seconds * 1000, easing: 'linear', fill: 'forwards' })
            const home = rest.current.animate(
              [{ transform: `translateX(${distance}px)` }, { transform: 'translateX(0)' }],
              { duration: seconds * 1000, easing: 'linear' })
            rest.current.style.visibility = 'visible'
            running.current = [out, home]
            out.onfinish = () => { reset(); resolve() }
            out.oncancel = () => resolve()
          }
          const wait = setTimeout(go, look.prepare || 0)
          running.current = [{ cancel: () => { clearTimeout(wait); resolve() } }]
          return
        }
        const first = Math.max(0, text + look.endGap - width)
        const out = full.current.animate(
          [{ transform: 'translateX(0)' }, { transform: `translateX(${-first}px)` }],
          { duration: (first / look.speed) * 1000, easing: 'linear', fill: 'forwards' })
        running.current = [out]
        out.onfinish = () => {
          rest.current.style.visibility = 'visible'
          const leave = full.current.animate(
            [{ transform: `translateX(${-first}px)` }, { transform: `translateX(${-first - width}px)` }],
            { duration: (width / look.speed) * 1000, easing: 'linear', fill: 'forwards' })
          const arrive = rest.current.animate(
            [{ transform: `translateX(${width - look.restGap}px)` }, { transform: 'translateX(0)' }],
            { duration: ((width - look.restGap) / look.speed) * 1000, easing: 'linear' })
          running.current = [leave, arrive]
          leave.onfinish = () => { reset(); resolve() }
          leave.oncancel = () => resolve()
        }
        out.oncancel = () => resolve()
      }),
    }
    handle.current = line
    manager.add(line)
    return () => { manager.remove(line); reset() }
  }, [manager]) // eslint-disable-line react-hooks/exhaustive-deps

  // New text starts from rest.
  useEffect(() => { reset() }, [children]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!manager) return <span className={className}>{children}</span>
  const click = manager.style.click ? () => { if (handle.current?.willScroll()) manager.poke(handle.current) } : undefined
  return (
    <span className={`dk-marquee ${className}`} ref={box} data-marquee={manager.name} onClick={click}>
      <span className="dk-marquee-rest" ref={rest}>{children}</span>
      <span className="dk-marquee-full" ref={full} aria-hidden="true">{children}</span>
    </span>
  )
})
