import React, { useEffect, useRef, useState } from 'react'
import { isLoaded } from '../../frontend/src/lib/transport.js'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { MINI_QUERY, MINI_CHANNEL, isMiniWindow, openMiniWindow as openWindow,
         openMiniPip as openPip } from '../../frontend/src/lib/miniWindow.js'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { metadataLines } from '../../frontend/src/lib/format.js'
import { nowPlayingArt } from '../../frontend/src/components/Art.jsx'
import * as Icon from '../../frontend/src/components/Icons.jsx'
import Slider from './Slider.jsx'

// The app's Mini Controller (MiniWindow.xaml / MiniPanel.xaml): a borderless,
// always-on-top 256x256 square (512 when large) with 6px corners and a soft
// shadow, filled by the album art. Along the bottom a gradient carries the
// track and artist; the transport row under them stays tucked out of sight
// (translated 57px down) until the pointer enters the bottom band, then slides
// up over 0.4s while the gradient stretches to cover it. Hovering the mute
// button fades the transport buttons out and a volume slider in. Anywhere
// else on the square drags the window; a double-click toggles the size, as do
// the resize button and its neighbor close button, which appear top-right
// while the pointer is over the window. Size and position are remembered, as
// the app's are.
//
// It opens as a window of its own. Where the browser offers Document
// Picture-in-Picture (Chromium) that window is borderless, has no address or
// menu bar, stays above other windows and is dragged by its own hover
// handle; this component is rendered into it through a portal and resizes or
// closes it. Elsewhere a plain popup is opened (openMiniWindow) and this
// component fills its viewport, moving it by moveBy; browsers keep a
// read-only address strip on popups, which no page can remove. When even the
// popup is refused it falls back to a floating panel inside the page.
export { MINI_QUERY, MINI_CHANNEL }
const SIZE_KEY = 'sonora.win.miniLarge'
const POS_KEY = 'sonora.win.miniPos'
const MARGIN = 10 // room for the drop shadow, as the app's Grid margin

function readLarge() {
  try { return window.localStorage.getItem(SIZE_KEY) === '1' } catch { return false }
}
function readPos() {
  try {
    const raw = window.localStorage.getItem(POS_KEY)
    const pos = raw ? JSON.parse(raw) : null
    return pos && Number.isFinite(pos.x) && Number.isFinite(pos.y) ? pos : null
  } catch { return null }
}
function savePos(pos) {
  try { window.localStorage.setItem(POS_KEY, JSON.stringify(pos)) } catch { /* fine */ }
}

// Opens the Mini Controller as its own window at its remembered size and
// screen position. Returns the window, or null when the browser blocked it.
export function openMiniWindow() {
  return openWindow({ name: 'sonora-mini', side: readLarge() ? 512 : 256,
                      position: readPos() })
}

// Dressing the window is shared: lib/miniWindow.js, which also carries the
// theme's data-theme across -- this copy did not, so a theme keyed to the
// attribute rather than a class lost its styling here.
export async function openMiniPip() {
  return openPip({ side: readLarge() ? 512 : 256,
                   bodyClass: 'dk-root win-root win-mini-root' })
}

export { isMiniWindow }

// mode: 'panel' (floating inside the page), 'popup' (a window.open window)
// or 'pip' (a Document Picture-in-Picture window). `win` is the window the
// panel lives in for the two window modes.
export default function Mini({ zone, mode = 'panel', win = window, onClose, onInfo }) {
  const popup = mode !== 'panel'
  const { t } = useI18n()
  const { actions } = useSystem()
  const [large, setLarge] = useState(readLarge)
  const [pos, setPos] = useState(popup ? { x: 0, y: 0 } : readPos)
  const ref = useRef(null)
  const drag = useRef(null)
  const side = large ? 512 : 256
  const margin = popup ? 0 : MARGIN
  const box = side + margin * 2

  useEffect(() => { try { window.localStorage.setItem(SIZE_KEY, large ? '1' : '0') } catch { /* fine */ } }, [large])

  // Own window: size it to the square, and remember where it is left.
  useEffect(() => {
    if (!popup) return undefined
    const chromeW = Math.max(0, win.outerWidth - win.innerWidth)
    const chromeH = Math.max(0, win.outerHeight - win.innerHeight)
    try { win.resizeTo(side + chromeW, side + chromeH) } catch { /* the browser decides */ }
    if (mode !== 'popup') return undefined
    const remember = () => savePos({ x: win.screenX, y: win.screenY })
    win.addEventListener('pagehide', remember)
    return () => win.removeEventListener('pagehide', remember)
  }, [popup, mode, win, side])

  // In-page panel: keep the square on screen when it opens, resizes or the
  // page shrinks.
  useEffect(() => {
    if (popup) return undefined
    const clamp = () => setPos((p) => {
      const maxX = Math.max(0, window.innerWidth - box)
      const maxY = Math.max(0, window.innerHeight - box)
      const base = p || { x: Math.round((window.innerWidth - box) / 2), y: Math.round((window.innerHeight - box) / 2) }
      const next = { x: Math.min(Math.max(0, base.x), maxX), y: Math.min(Math.max(0, base.y), maxY) }
      return p && next.x === p.x && next.y === p.y ? p : next
    })
    clamp()
    window.addEventListener('resize', clamp)
    return () => window.removeEventListener('resize', clamp)
  }, [box, popup])
  useEffect(() => { if (!popup && pos) savePos(pos) }, [pos, popup])

  const transport = zone?.transport ?? {}
  const lines = metadataLines(transport, t)
  const title = (zone && lines.line1) || t('win.mini.noMusic')
  const artist = (zone && lines.line2) || ''
  // The speaker's copy first, the provider's after it; a source that fails
  // to load is skipped for as long as this window is open.
  const [badArt, setBadArt] = useState(() => new Set())
  const artList = zone && transport.source !== 'tv' ? nowPlayingArt(zone.host, transport) : []
  const art = artList.find((url) => !badArt.has(url)) || ''
  const playing = transport.state === 'PLAYING'
  const loaded = isLoaded(transport)
  const fixed = ['tv', 'line_in'].includes(transport.source)
  const skippable = Boolean(zone) && loaded && !fixed && !transport.is_external_session
  // The app's PlayButton shows what the next press does: pause, or stop for
  // sources that cannot pause, or play. The speaker names which in its
  // transport actions; the source list stands in for a room with no speaker
  // behind it.
  const noPause = transport.can_pause === false
    || (transport.can_pause === undefined
        && ['radio', 'http_stream', 'service_stream', 'service_radio', 'service_hls'].includes(transport.source))
  const nextState = !playing ? 'play' : (fixed || noPause ? 'stop' : 'pause')
  const toggle = () => {
    if (!zone) return
    if (nextState === 'play') actions.play(zone.uuid)
    else if (nextState === 'stop') actions.stop(zone.uuid)
    else actions.pause(zone.uuid)
  }

  // Volume is the group's, as the app's MiniMuteVolume binds GroupVolume.
  const level = zone?.group_volume ?? 0
  const muted = Boolean(zone?.group_muted)

  // Dragging: any press on the square outside a control moves the window
  // (the app's DragMove). In a window of its own that is the window itself,
  // followed through screen coordinates.
  const onPointerDown = (event) => {
    if (event.button !== 0 || event.target.closest('button, input, .dk-slider')) return
    if (mode === 'pip') return // the PiP window carries its own drag handle
    drag.current = popup
      ? { x: event.screenX, y: event.screenY }
      : { x: event.clientX, y: event.clientY, px: pos?.x ?? 0, py: pos?.y ?? 0 }
    ref.current?.setPointerCapture?.(event.pointerId)
    event.preventDefault()
  }
  const onPointerMove = (event) => {
    const d = drag.current
    if (!d) return
    if (popup) {
      const dx = event.screenX - d.x
      const dy = event.screenY - d.y
      if (dx || dy) {
        try { win.moveBy(dx, dy) } catch { /* the browser decides */ }
        drag.current = { x: event.screenX, y: event.screenY }
      }
      return
    }
    const maxX = Math.max(0, window.innerWidth - box)
    const maxY = Math.max(0, window.innerHeight - box)
    setPos({ x: Math.min(Math.max(0, d.px + event.clientX - d.x), maxX),
             y: Math.min(Math.max(0, d.py + event.clientY - d.y), maxY) })
  }
  const onPointerUp = () => { drag.current = null }
  const onDoubleClick = (event) => {
    if (event.target.closest('button, input, .dk-slider')) return
    setLarge((v) => !v)
  }
  const close = () => {
    if (mode === 'popup') savePos({ x: win.screenX, y: win.screenY })
    if (popup) win.close()
    onClose?.()
  }

  const PlayGlyph = nextState === 'play' ? Icon.WinMiniPlay : nextState === 'stop' ? Icon.WinMiniStop : Icon.WinMiniPause
  const style = popup
    ? { left: 0, top: 0, width: '100vw', height: '100vh' }
    : { left: pos?.x ?? 0, top: pos?.y ?? 0, width: box, height: box, visibility: pos ? 'visible' : 'hidden' }
  return (
    <div className="win-mini" ref={ref} data-large={large ? 'true' : 'false'} data-popup={popup ? 'true' : 'false'}
         style={style}
         onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
         onPointerCancel={onPointerUp} onDoubleClick={onDoubleClick}
         role="dialog" aria-label={t('win.menu.showMini')}>
      <div className="win-mini-panel" style={popup ? undefined : { width: side, height: side }}>
        {art && <img className="win-mini-art" src={art} alt="" draggable="false" referrerPolicy="no-referrer"
                     onError={() => setBadArt((prev) => new Set(prev).add(art))} />}
        <div className="win-mini-shade" />
        <div className="win-mini-bottom">
          <p className="win-mini-track" title={title}>{title}</p>
          {artist && <p className="win-mini-artist" title={artist}>{artist}</p>}
          <div className="win-mini-row">
            <div className="win-mini-volume">
              <button type="button" className="win-mini-btn win-mini-mute" disabled={!zone}
                      title={muted ? t('common.unmute') : t('common.mute')}
                      onClick={() => actions.setMute(zone.uuid, !muted, true)}>
                {muted ? <Icon.WinMiniVolumeOff /> : <Icon.WinMiniVolumeOn />}
              </button>
              <div className="win-mini-slider">
                <Slider value={level} disabled={!zone} label={t('win.mini.volume')}
                        onCommit={(value) => actions.setGroupVolume(zone.uuid, value)} />
              </div>
            </div>
            <div className="win-mini-transport">
              <button type="button" className="win-mini-btn win-mini-prev" disabled={!skippable || (transport.can_seek === false && transport.can_previous === false) || zone?.transport?.state === 'STOPPED'}
                      title={t('common.previous')} onClick={() => actions.previous(zone.uuid)}>
                <Icon.WinMiniPrev />
              </button>
              <button type="button" className="win-mini-btn win-mini-play" disabled={!zone || !loaded}
                      title={t('desk.shortcuts.playPause')} onClick={toggle}>
                <PlayGlyph />
              </button>
              <button type="button" className="win-mini-btn win-mini-next" disabled={!skippable || (transport.can_seek === false && transport.can_next === false) || zone?.transport?.state === 'STOPPED'}
                      title={t('common.next')} onClick={() => actions.next(zone.uuid)}>
                <Icon.WinMiniNext />
              </button>
              <button type="button" className="win-mini-btn win-mini-info" disabled={!zone}
                      title={t('desk.now.infoOptions')} onClick={onInfo}>
                <Icon.WinMiniInfo />
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="win-mini-chrome">
        <button type="button" className="win-mini-chrome-btn" title={large ? t('win.mini.smaller') : t('win.mini.larger')}
                onClick={() => setLarge((v) => !v)}><Icon.WinMiniResize /></button>
        <button type="button" className="win-mini-chrome-btn" title={t('common.close')} onClick={close}><Icon.WinMiniClose /></button>
      </div>
    </div>
  )
}
