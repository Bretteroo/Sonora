import React, { useEffect, useRef, useState } from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { MINI_QUERY, isMiniWindow, openMiniWindow as openWindow,
         openMiniPip as openPip } from '../../frontend/src/lib/miniWindow.js'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { nowPlayingArt } from '../../frontend/src/components/Art.jsx'
import * as I from './icons.jsx'
import { Slider } from './ui.jsx'
import { nowSummary, nextTransport, togglePlay, isLoaded, canSkip, canNext, canPrevious } from './house.js'

// The compact controller: a square of artwork with the transport and the
// group's volume along its foot, in a window of its own where the browser
// allows one (Document Picture-in-Picture, else a popup), or floating over
// the page when it does not.

export { MINI_QUERY }
const SIZE_KEY = 'sonora.sf.miniLarge'
const POS_KEY = 'sonora.sf.miniPos'

function readLarge() { try { return window.localStorage.getItem(SIZE_KEY) === '1' } catch { return false } }
function readPos() {
  try { const pos = JSON.parse(window.localStorage.getItem(POS_KEY) || 'null'); return pos && Number.isFinite(pos.x) && Number.isFinite(pos.y) ? pos : null } catch { return null }
}
function savePos(pos) { try { window.localStorage.setItem(POS_KEY, JSON.stringify(pos)) } catch { /* fine */ } }

export { isMiniWindow }
export function openMiniWindow() {
  return openWindow({ name: 'sonora-sf-mini', side: readLarge() ? 480 : 300,
                      resizable: true, position: readPos() })
}
export async function openMiniPip() {
  return openPip({ side: readLarge() ? 480 : 300, bodyClass: 'sf-root sf-mini-root' })
}

export default function Mini({ zone, mode = 'panel', win = window, onClose, onOpenMain }) {
  const popup = mode !== 'panel'
  const { t } = useI18n()
  const { actions } = useSystem()
  const [large, setLarge] = useState(readLarge)
  const [pos, setPos] = useState(popup ? { x: 0, y: 0 } : readPos)
  const ref = useRef(null)
  const drag = useRef(null)
  const side = large ? 480 : 300
  useEffect(() => { try { window.localStorage.setItem(SIZE_KEY, large ? '1' : '0') } catch { /* fine */ } }, [large])
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
  useEffect(() => {
    if (popup) return undefined
    const clamp = () => setPos((p) => {
      const maxX = Math.max(0, window.innerWidth - side)
      const maxY = Math.max(0, window.innerHeight - side)
      const base = p || { x: Math.round(window.innerWidth - side - 24), y: Math.round(window.innerHeight - side - 100) }
      const next = { x: Math.min(Math.max(0, base.x), maxX), y: Math.min(Math.max(0, base.y), maxY) }
      return p && next.x === p.x && next.y === p.y ? p : next
    })
    clamp()
    window.addEventListener('resize', clamp)
    return () => window.removeEventListener('resize', clamp)
  }, [side, popup])
  useEffect(() => { if (!popup && pos) savePos(pos) }, [pos, popup])

  const tr = zone?.transport ?? {}
  const summary = nowSummary(tr, t)
  const title = zone ? (summary.title || t('win.mini.noMusic')) : t('win.mini.noMusic')
  const [badArt, setBadArt] = useState(() => new Set())
  const artList = zone && tr.source !== 'tv' ? nowPlayingArt(zone.host, tr) : []
  const art = artList.find((url) => !badArt.has(url)) || ''
  const what = nextTransport(tr)
  const loaded = isLoaded(tr)
  const skip = canSkip(tr)

  const onPointerDown = (event) => {
    if (event.button !== 0 || event.target.closest('button, input')) return
    if (mode === 'pip') return
    drag.current = popup ? { x: event.screenX, y: event.screenY } : { x: event.clientX, y: event.clientY, px: pos?.x ?? 0, py: pos?.y ?? 0 }
    ref.current?.setPointerCapture?.(event.pointerId)
    event.preventDefault()
  }
  const onPointerMove = (event) => {
    const d = drag.current
    if (!d) return
    if (popup) {
      const dx = event.screenX - d.x, dy = event.screenY - d.y
      if (dx || dy) { try { win.moveBy(dx, dy) } catch { /* fine */ } drag.current = { x: event.screenX, y: event.screenY } }
      return
    }
    setPos({ x: Math.min(Math.max(0, d.px + event.clientX - d.x), Math.max(0, window.innerWidth - side)),
             y: Math.min(Math.max(0, d.py + event.clientY - d.y), Math.max(0, window.innerHeight - side)) })
  }
  const onPointerUp = () => { drag.current = null }
  const close = () => { if (mode === 'popup') savePos({ x: win.screenX, y: win.screenY }); if (popup) win.close(); onClose?.() }

  const style = popup ? { left: 0, top: 0, width: '100vw', height: '100vh' } : { left: pos?.x ?? 0, top: pos?.y ?? 0, width: side, height: side, visibility: pos ? 'visible' : 'hidden' }
  return (
    <div className="sf-mini" ref={ref} data-popup={popup || undefined} style={style} role="dialog" aria-label={t('win.menu.showMini')}
         onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
         onDoubleClick={(event) => { if (!event.target.closest('button, input')) setLarge((v) => !v) }}>
      {art && <img className="sf-mini-art" src={art} alt="" draggable="false" referrerPolicy="no-referrer" onError={() => setBadArt((prev) => new Set(prev).add(art))} />}
      <div className="sf-mini-shade" />
      <div className="sf-mini-chrome">
        <span className="sf-mini-room">{zone?.name || ''}</span>
        <button type="button" className="sf-mini-btn" title={large ? t('win.mini.smaller') : t('win.mini.larger')} onClick={() => setLarge((v) => !v)}>{large ? <I.Collapse /> : <I.Expand />}</button>
        {onOpenMain && <button type="button" className="sf-mini-btn" title={t('desk.now.infoOptions')} onClick={onOpenMain}><I.Info /></button>}
        <button type="button" className="sf-mini-btn" title={t('common.close')} onClick={close}><I.Close /></button>
      </div>
      <div className="sf-mini-foot">
        <p className="sf-mini-title" title={title}>{title}</p>
        {summary.sub && <p className="sf-mini-sub" title={summary.sub}>{summary.sub}</p>}
        <div className="sf-mini-row">
          <button type="button" className="sf-mini-btn" disabled={!zone} title={zone?.group_muted ? t('common.unmute') : t('common.mute')} onClick={() => actions.setMute(zone.uuid, !zone.group_muted, true)}>
            {zone?.group_muted ? <I.Muted /> : <I.Volume />}
          </button>
          <Slider value={zone?.group_volume ?? 0} disabled={!zone} label={t('win.mini.volume')} onCommit={(v) => actions.setGroupVolume(zone.uuid, v)} />
          <button type="button" className="sf-mini-btn" disabled={!canPrevious(tr)} title={t('common.previous')} onClick={() => actions.previous(zone.uuid)}><I.Prev /></button>
          <button type="button" className="sf-mini-btn sf-mini-play" disabled={!zone || !loaded} title={t('desk.shortcuts.playPause')} onClick={() => togglePlay(actions, zone)}>
            {what === 'play' ? <I.Play /> : what === 'stop' ? <I.Stop /> : <I.Pause />}
          </button>
          <button type="button" className="sf-mini-btn" disabled={!canNext(tr)} title={t('common.next')} onClick={() => actions.next(zone.uuid)}><I.Next /></button>
        </div>
      </div>
    </div>
  )
}
