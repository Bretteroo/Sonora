import React, { useEffect, useRef, useState } from 'react'
import { isLoaded } from '../../frontend/src/lib/transport.js'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { isMiniWindow, openMiniWindow as openWindow, openMiniPip as openPip } from '../../frontend/src/lib/miniWindow.js'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { metadataLines } from '../../frontend/src/lib/format.js'
import { nowPlayingArt } from '../../frontend/src/components/Art.jsx'
import * as Icon from '../../frontend/src/components/Icons.jsx'
import Slider from './Slider.jsx'

// The Mac app's Mini Controller (Window > Mini Controller, Option-Command-2),
// laid out from SMNowPlayingMiniViewController: a 256pt square filled by the
// album art, a 103pt gradient up from the bottom, the track (17, 160) and the
// artist (17, 179) above a 62pt transport strip. In the strip, left to right:
// mute (10, 207, 34x34), back (59, 202, 34x44), play (106, 202, 44x44),
// forward (163, 202, 34x44) and info (211, 205, 36x36); the volume slider
// (57, 214, 189x21) is hidden until the pointer is over the mute button. The
// close (5, 5) and zoom (29, 5) buttons, 22pt, sit top left, each drawing a
// 20pt disc centered in its frame. Zoom doubles the square, as the app's
// performZoom: does.
//
// The window is got the way the Windows theme's is (lib/miniWindow.js): a
// Document Picture-in-Picture window where the browser has one, a popup where
// it does not, and a panel inside the page when both are refused.

const SIZE_KEY = 'sonora.mac.miniLarge'

function readLarge() {
  try { return window.localStorage.getItem(SIZE_KEY) === '1' } catch { return false }
}

export function openMiniWindow() {
  return openWindow({ name: 'sonora-mac-mini', side: readLarge() ? 512 : 256 })
}

export async function openMiniPip() {
  return openPip({ side: readLarge() ? 512 : 256, bodyClass: 'dk-root mac-root mac-mini-root' })
}

export { isMiniWindow }

// The real mini's zoom disc carries a plus (Tahoe, 2026-09-28).
const Zoom = (p) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"
       strokeLinecap="round" aria-hidden="true" {...p}>
    <path d="M8 3v10M3 8h10" />
  </svg>
)

// mode: 'panel' (inside the page), 'popup' or 'pip'. `win` is the window a
// popup or PiP panel lives in.
export default function Mini({ zone, mode = 'panel', win = window, onClose, onInfo }) {
  const popup = mode !== 'panel'
  const { t } = useI18n()
  const { actions } = useSystem()
  const [large, setLarge] = useState(readLarge)
  const side = large ? 512 : 256
  const drag = useRef(null)
  const [pos, setPos] = useState(null)

  useEffect(() => { try { window.localStorage.setItem(SIZE_KEY, large ? '1' : '0') } catch { /* fine */ } }, [large])
  useEffect(() => {
    if (!popup) return
    const chromeW = Math.max(0, win.outerWidth - win.innerWidth)
    const chromeH = Math.max(0, win.outerHeight - win.innerHeight)
    try { win.resizeTo(side + chromeW, side + chromeH) } catch { /* the browser decides */ }
  }, [popup, win, side])
  useEffect(() => {
    if (popup) return
    setPos((p) => p || { x: Math.round((window.innerWidth - side) / 2), y: Math.round((window.innerHeight - side) / 2) })
  }, [popup, side])

  const transport = zone?.transport ?? {}
  const lines = metadataLines(transport, t)
  const title = (zone && lines.line1) || t('win.mini.noMusic')
  const artist = (zone && lines.line2) || ''
  const [badArt, setBadArt] = useState(() => new Set())
  const artList = zone && transport.source !== 'tv' ? nowPlayingArt(zone.host, transport) : []
  const art = artList.find((url) => !badArt.has(url)) || ''
  const playing = transport.state === 'PLAYING'
  const loaded = isLoaded(transport)
  const fixed = ['tv', 'line_in'].includes(transport.source)
  const skippable = Boolean(zone) && loaded && !fixed && !transport.is_external_session
    && transport.state !== 'STOPPED'
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
  const level = zone?.group_volume ?? 0
  const muted = Boolean(zone?.group_muted)

  // The in-page panel moves by any press outside a control.
  const onPointerDown = (event) => {
    if (popup || event.button !== 0 || event.target.closest('button, input, .dk-slider')) return
    drag.current = { x: event.clientX, y: event.clientY, px: pos?.x ?? 0, py: pos?.y ?? 0 }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    event.preventDefault()
  }
  const onPointerMove = (event) => {
    const d = drag.current
    if (!d) return
    setPos({ x: Math.min(Math.max(0, d.px + event.clientX - d.x), Math.max(0, window.innerWidth - side)),
             y: Math.min(Math.max(0, d.py + event.clientY - d.y), Math.max(0, window.innerHeight - side)) })
  }
  const onPointerUp = () => { drag.current = null }
  const close = () => {
    if (popup) win.close()
    onClose?.()
  }

  const PlayGlyph = nextState === 'play' ? Icon.Play : nextState === 'stop' ? Icon.Stop : Icon.Pause
  const style = popup
    ? { left: 0, top: 0, width: '100vw', height: '100vh' }
    : { left: pos?.x ?? 0, top: pos?.y ?? 0, width: side, height: side, visibility: pos ? 'visible' : 'hidden' }
  return (
    <div className="mac-mini" data-large={large ? 'true' : 'false'} data-popup={popup ? 'true' : 'false'}
         style={style} role="dialog" aria-label={t('desk.menu.miniController')}
         onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      {art && <img className="mac-mini-art" src={art} alt="" draggable="false" referrerPolicy="no-referrer"
                   onError={() => setBadArt((prev) => new Set(prev).add(art))} />}
      <div className="mac-mini-gradient" />
      <div className="mac-mini-meta">
        <p className="mac-mini-track" title={title}>{title}</p>
        <p className="mac-mini-artist" title={artist || undefined}>{artist}</p>
      </div>
      <div className="mac-mini-hud">
        <div className="mac-mini-volume">
          <button type="button" className="mac-mini-btn mac-mini-mute" disabled={!zone}
                  title={muted ? t('common.unmute') : t('common.mute')}
                  onClick={() => actions.setMute(zone.uuid, !muted, true)}>
            {muted ? <Icon.VolumeOff /> : <Icon.VolumeOn />}
          </button>
          <div className="mac-mini-slider">
            <Slider value={level} disabled={!zone} label={t('win.mini.volume')}
                    onCommit={(value) => actions.setGroupVolume(zone.uuid, value)} />
          </div>
        </div>
        <div className="mac-mini-transport">
          <button type="button" className="mac-mini-btn mac-mini-back" disabled={!skippable || (transport.can_seek === false && transport.can_previous === false)}
                  title={t('common.previous')} onClick={() => actions.previous(zone.uuid)}><Icon.Prev /></button>
          <button type="button" className="mac-mini-btn mac-mini-play" disabled={!zone || !loaded}
                  title={t('desk.shortcuts.playPause')} onClick={toggle}><PlayGlyph /></button>
          <button type="button" className="mac-mini-btn mac-mini-forward" disabled={!skippable || (transport.can_seek === false && transport.can_next === false)}
                  title={t('common.next')} onClick={() => actions.next(zone.uuid)}><Icon.Next /></button>
          <button type="button" className="mac-mini-btn mac-mini-info" disabled={!zone}
                  title={t('desk.now.infoOptions')} onClick={onInfo}><Icon.Info /></button>
        </div>
      </div>
      <button type="button" className="mac-mini-chrome mac-mini-close" title={t('common.close')} onClick={close}>
        <Icon.Close />
      </button>
      <button type="button" className="mac-mini-chrome mac-mini-zoom" title={large ? t('win.mini.smaller') : t('win.mini.larger')}
              onClick={() => setLarge((v) => !v)}><Zoom /></button>
    </div>
  )
}
