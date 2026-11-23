import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../i18n/index.jsx'
import { useTheme, fadeThemeChange, appearancesOf } from '../lib/theme.jsx'
import { isCommand, keyOf } from '../lib/keys.js'
import AboutSonora, { requestAbout } from './AboutSonora.jsx'
import icon from '../assets/sonora.png'

// The fast theme switch: a black pill that flies in from the right, near the
// top of the page, on Ctrl+Y (Command+Y on a Mac). Sonora's icon opens About
// Sonora, the list beside it puts a theme on as soon as one is picked (on that
// theme's main page), the sun, the screen, and the moon pick its light look, the
// one the system asks for, or its dark look,
// and the x sends the pill back off the page. The pill can be dragged anywhere
// on the page by its black. Nothing in any theme leads to it; the shortcut is
// the only way in.
//
// It belongs to no theme and looks the same in all of them, so it is drawn in a
// shadow root, where no theme's stylesheet reaches, and it is mounted beside
// the themes rather than inside one, so it stays put while they change.

const KEY = 'y'
// Long enough for the pill to clear the page before it is taken away.
const SLIDE_MS = 260

const CSS = `
:host { all: initial; position: fixed; top: 14px; right: 14px; z-index: 2147483647; max-width: calc(100vw - 28px); }
.pill {
  display: flex; align-items: center; gap: 8px; box-sizing: border-box; max-width: 100%;
  padding: 6px 8px 6px 6px; border-radius: 999px;
  background: #000; color: #fff; border: 1px solid rgb(255 255 255 / 0.16);
  box-shadow: 0 8px 28px rgb(0 0 0 / 0.45), 0 1px 3px rgb(0 0 0 / 0.5);
  font: 500 14px/1.2 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none;
  transform: translateX(calc(100% + 40px + var(--away, 0px)));
  transition: transform ${SLIDE_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.pill[data-in] { transform: none; }
.pill[data-held] { cursor: grabbing; }
@media (prefers-reduced-motion: reduce) { .pill { transition: none; } }
button { all: unset; box-sizing: border-box; flex: none; display: grid; place-items: center; border-radius: 50%; cursor: pointer; }
.about { width: 36px; height: 36px; }
.about img { display: block; width: 36px; height: 36px; border-radius: 50%; }
.close { width: 30px; height: 30px; color: rgb(255 255 255 / 0.75); }
.close:hover { color: #fff; background: rgb(255 255 255 / 0.14); }
.mode {
  position: relative; flex: none; display: flex; align-items: center; height: 30px; padding: 2px; box-sizing: border-box; gap: 2px;
  border-radius: 999px; background: #1c1c1e; border: 1px solid rgb(255 255 255 / 0.22);
}
/* The lit circle behind the look chosen: yellow for light, gray for the system's, blue for dark. */
.mode::before {
  content: ''; position: absolute; top: 2px; left: 2px; width: 24px; height: 24px; border-radius: 50%;
  background: #f5c542; transform: translateX(calc(var(--at, 0) * 26px)); transition: transform 160ms ease, background-color 160ms ease;
}
.mode[data-at='system']::before { --at: 1; background: #c9ccd3; }
.mode[data-at='dark']::before { --at: 2; background: #6f8cff; }
.mode button { position: relative; width: 24px; height: 24px; color: rgb(255 255 255 / 0.55); }
.mode button:hover { color: #fff; }
.mode button[aria-checked='true'] { color: #000; }
.mode button svg { display: block; }
.mode[data-off] { opacity: 0.35; }
.mode[data-off] button { cursor: default; }
.mode[data-off]::before { display: none; }
.mode[data-off] button[aria-checked='true'] { color: inherit; }
@media (prefers-reduced-motion: reduce) { .mode::before { transition: none; } }
.about:hover img { filter: brightness(1.12); }
select {
  appearance: none; -moz-appearance: none; -webkit-appearance: none;
  box-sizing: border-box; flex: 0 1 auto; min-width: 0; max-width: 100%; height: 34px; margin: 0;
  padding: 0 32px 0 14px; border-radius: 999px; border: 1px solid rgb(255 255 255 / 0.22);
  background: #1c1c1e url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1.5 1.5 6 6l4.5-4.5' fill='none' stroke='%23fff' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") no-repeat right 12px center;
  color: #fff; font: inherit; text-overflow: ellipsis; cursor: pointer;
}
select:hover { background-color: #2a2a2d; }
option { background: #1c1c1e; color: #fff; }
:is(button, select):focus-visible { outline: 2px solid #6ab0ff; outline-offset: 2px; }
`

export default function ThemeSwitch() {
  const { t } = useI18n()
  const { theme, themes, themeId, selectTheme, appearance, setAppearance } = useTheme()
  // A theme with one look has nothing to switch between.
  const twoLooks = appearancesOf(theme).length === 2
  // 'out' is not drawn at all; 'entering' and 'leaving' are drawn off the page.
  const [stage, setStage] = useState('out')
  const [about, setAbout] = useState(false)
  const [root, setRoot] = useState(null)
  const list = useRef(null)
  const hostRef = useRef(null)
  // How far the pill has been dragged from its corner, and the drag under way.
  const moved = useRef({ x: 0, y: 0 })
  const drag = useRef(null)
  const [held, setHeld] = useState(false)

  // Put the pill where it was dragged to, never past an edge of the page. The
  // way out is still off the right side, however far left the pill sits.
  const place = (x, y) => {
    const host = hostRef.current
    if (!host) return
    const box = host.getBoundingClientRect()
    const left = box.left - moved.current.x
    const top = box.top - moved.current.y
    const nx = Math.min(window.innerWidth - box.width - left, Math.max(-left, x))
    const ny = Math.min(window.innerHeight - box.height - top, Math.max(-top, y))
    moved.current = { x: Math.min(nx, 0), y: Math.max(ny, 0) }
    host.style.translate = `${moved.current.x}px ${moved.current.y}px`
    host.style.setProperty('--away', `${-moved.current.x}px`)
  }
  const onDown = (event) => {
    if (event.button !== 0 || event.target.closest('button, select')) return
    drag.current = { id: event.pointerId, x: event.clientX - moved.current.x, y: event.clientY - moved.current.y }
    event.currentTarget.setPointerCapture(event.pointerId)
    setHeld(true)
    event.preventDefault()
  }
  const onUp = (event) => {
    if (drag.current?.id !== event.pointerId) return
    drag.current = null
    setHeld(false)
  }
  const onMove = (event) => {
    if (drag.current?.id !== event.pointerId) return
    // A button let go where the page could not see it ends the drag here.
    if (!event.buttons) { onUp(event); return }
    place(event.clientX - drag.current.x, event.clientY - drag.current.y)
  }
  // A page made smaller keeps the pill on it.
  useEffect(() => {
    const fit = () => place(moved.current.x, moved.current.y)
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  // One host for the life of the page, with the pill's own styles inside it.
  useEffect(() => {
    const host = document.createElement('div')
    host.dataset.sonoraSwitch = ''
    const shadow = host.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = CSS
    shadow.append(style)
    // Beside the body rather than in it, and undoing whatever zoom the page's root carries: a theme
    // that zooms the page to fit (Hi-Fi, Severed) or scales the body instead (where text has a
    // floor) would otherwise draw the pill at its size, and the pill is the same in every theme.
    document.documentElement.append(host)
    const unzoom = () => {
      const z = parseFloat(document.documentElement.style.zoom) || 1
      host.style.zoom = z === 1 ? '' : String(1 / z)
    }
    unzoom()
    const watch = new MutationObserver(unzoom)
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
    hostRef.current = host
    setRoot(shadow)
    return () => { watch.disconnect(); hostRef.current = null; host.remove() }
  }, [])

  useEffect(() => {
    const onKey = (event) => {
      if (!isCommand(event) || event.altKey || event.shiftKey || keyOf(event) !== KEY) return
      // Ctrl+Y is redo where text is being typed, and stays so.
      const typing = event.target?.isContentEditable || ['INPUT', 'TEXTAREA'].includes(event.target?.tagName)
      if (typing) return
      event.preventDefault()
      event.stopPropagation()
      setStage((now) => (now === 'in' || now === 'entering' ? 'leaving' : 'entering'))
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  // Drawn off the page first, so there is somewhere to slide in from; the list
  // takes the keyboard, and the arrow keys then step through the themes.
  useEffect(() => {
    if (stage === 'entering') {
      const frame = requestAnimationFrame(() => requestAnimationFrame(() => {
        setStage('in')
        list.current?.focus({ preventScroll: true })
      }))
      return () => cancelAnimationFrame(frame)
    }
    if (stage === 'leaving') {
      const timer = setTimeout(() => setStage('out'), SLIDE_MS)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [stage])

  const close = () => { list.current?.blur(); setStage('leaving') }

  return (
    <>
      {root && stage !== 'out' && createPortal(
        <div className="pill" role="toolbar" aria-label={t('common.theme')} data-in={stage === 'in' || undefined}
             data-held={held || undefined} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <button type="button" className="about" aria-label={t('about.menu')} title={t('about.menu')} onClick={() => { if (!requestAbout()) setAbout(true) }}>
            <img src={icon} alt="" draggable="false" />
          </button>
          <select ref={list} aria-label={t('common.theme')} value={themeId}
                  onChange={(event) => { const id = event.target.value; fadeThemeChange(() => selectTheme(id, { home: true })) }}>
            {themes.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
          </select>
          <div className="mode" role="radiogroup" aria-label={t('common.appearance')} data-at={appearance} data-off={!twoLooks || undefined}>
            {[
              ['light', 'common.appearanceLight', <svg key="i" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="2.6" fill="currentColor" /><path d="M7 .8v1.8M7 11.4v1.8M.8 7h1.8M11.4 7h1.8M2.6 2.6l1.3 1.3M10.1 10.1l1.3 1.3M2.6 11.4l1.3-1.3M10.1 3.9l1.3-1.3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>],
              ['system', 'common.appearanceSystem', <svg key="i" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="1.2" y="2" width="11.6" height="7.8" rx="1.3" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M5 12.4h4M7 9.8v2.6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>],
              ['dark', 'common.appearanceDark', <svg key="i" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M11.9 8.6A5.3 5.3 0 0 1 5.4 2.1a5.3 5.3 0 1 0 6.5 6.5z" fill="currentColor" /></svg>],
            ].map(([value, label, glyph]) => (
              <button key={value} type="button" role="radio" aria-checked={appearance === value} disabled={!twoLooks}
                      aria-label={t(label)} title={t(label)}
                      onClick={() => { if (appearance !== value) fadeThemeChange(() => setAppearance(value)) }}>{glyph}</button>
            ))}
          </div>
          <button type="button" className="close" aria-label={t('common.close')} title={t('common.close')} onClick={close}>
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M1.5 1.5l9 9m0-9l-9 9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
        </div>, root)}
      {about && <AboutSonora onClose={() => setAbout(false)} />}
    </>
  )
}
