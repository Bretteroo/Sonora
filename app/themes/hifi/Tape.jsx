import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import Art from '../../frontend/src/components/Art.jsx'
import { suggestedQueueName } from '../../frontend/src/lib/playlistName.js'
import * as G from './glyphs.jsx'
import { Unit, Display, Key, IconKey, Menu, MenuItem, MenuSep, Confirm, Empty, Loading } from './controls.jsx'
import markerFont from './permanent-marker.woff2?url'
import { isConnectSession } from '../../frontend/src/lib/transport.js'

// The queue deck: the room's queue as a cassette. The window shows the two
// reels, which turn while the room plays the queue; the counter says which
// track of how many; the index card beside it is the list itself, where a
// row drags to a new place, ticks for removing several at once, and its
// menu moves it one place up or down.

const ROW = 44

// The cassette's label is written in marker: Permanent Marker, by Font Diner
// (Apache-2.0, see THIRD-PARTY-NOTICES.md), its Latin letters only. It is
// added through the FontFace API rather than a stylesheet's @font-face, so
// the theme's stylesheet names no file; a name in another script falls back
// to the browser's own handwriting face.
let markerLoaded = false
function loadMarker() {
  if (markerLoaded || typeof FontFace === 'undefined' || !document.fonts) return
  markerLoaded = true
  const face = new FontFace('Hifi Marker', `url(${markerFont}) format("woff2")`)
  face.load().then((loaded) => document.fonts.add(loaded)).catch(() => { markerLoaded = false })
}

// The label's writing, as large as the strip allows: 22px, down to 14px for
// a long name, so "Mixtape" is never cut off unless the name is very long.
function CassetteLabel({ text }) {
  const ref = useRef(null)
  const [size, setSize] = useState(22)
  useEffect(loadMarker, [])
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const fit = () => {
      let next = 22
      el.style.fontSize = `${next}px`
      while (next > 14 && el.scrollWidth > el.clientWidth) { next -= 1; el.style.fontSize = `${next}px` }
      setSize(next)
    }
    fit()
    document.fonts?.ready?.then(fit)
    const watch = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null
    watch?.observe(el)
    return () => watch?.disconnect()
  }, [text])
  return <span ref={ref} className="hf-cassette-label" style={{ fontSize: `${size}px` }}>{text}</span>
}

function trimDuration(value) { return (value || '').replace(/^0:0?/, '') }

// `name` is what the room selector calls the zone: a group is "<room> + 1".
function Cassette({ zone, name, count, current, inUse }) {
  const { t } = useI18n()
  const tr = zone?.transport || {}
  const spinning = inUse && (tr.state === 'PLAYING' || tr.state === 'TRANSITIONING')
  // The tape winds from one reel onto the other as the queue goes by: the
  // left reel holds what is still to play.
  const done = count ? Math.max(0, Math.min(1, (current - 1) / count)) : 0
  return (
    <div className="hf-cassette" data-spin={spinning || undefined} aria-hidden="true">
      <div className="hf-cassette-shell">
        <CassetteLabel text={name ? t('hifi.mixtape', { name }) : ''} />
        <div className="hf-cassette-window">
          <span className="hf-reel" style={{ '--hf-wind': 1 - done }}><i /></span>
          <span className="hf-reel" style={{ '--hf-wind': done }}><i /></span>
        </div>
        <span className="hf-cassette-side">{inUse ? 'A' : '—'}</span>
      </div>
      <Display className="hf-counter">
        <span className="hf-vfd-caption">{t('hifi.track')}</span>
        <span className="hf-vfd-num hf-counter-num">{String(inUse ? current : 0).padStart(3, '0')}</span>
        <span className="hf-vfd-caption">/ {String(count).padStart(3, '0')}</span>
      </Display>
    </div>
  )
}

export function QueueList({ zone, queue, onInfo, onEdited, jumpTo = 0 }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const { items, reload } = queue
  const tr = zone?.transport || {}
  // A Spotify Connect session plays Spotify's own queue, which no controller
  // can list: the room's queue is not what plays, and the coming track is the
  // one the speaker reports. Every theme answers it this way.
  const inUse = (tr.source === 'queue' && !isConnectSession(tr)) || tr.source === 'external_session'
  const current = inUse ? (tr.track_number || 0) : 0
  const [checked, setChecked] = useState(() => new Set())
  const [menu, setMenu] = useState(null)
  const [drag, setDrag] = useState(null)
  const dragRef = useRef(null)
  const listRef = useRef(null)
  // The counter's key scrolls to the playing track.
  useEffect(() => {
    if (!jumpTo || !current || !listRef.current) return
    listRef.current.scrollTop = Math.max(0, (current - 3) * ROW)
  }, [jumpTo]) // eslint-disable-line react-hooks/exhaustive-deps

  const play = async (n) => { await actions.seekTrack(zone.uuid, n); if (tr.state !== 'PLAYING') actions.play(zone.uuid) }
  const remove = async (n) => {
    const targets = checked.has(n) ? [...checked].sort((a, b) => b - a) : [n]
    for (const index of targets) await actions.removeFromQueue(zone.uuid, index)
    setChecked(new Set()); reload(); onEdited?.()
  }
  const move = async (from, insertBefore) => {
    const done = await actions.reorderQueue(zone.uuid, from, insertBefore)
    if (done) { reload(); onEdited?.() }
  }
  const toggle = (n) => setChecked((prev) => { const next = new Set(prev); if (next.has(n)) next.delete(n); else next.add(n); return next })

  const targetFor = (clientY) => {
    const el = listRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const y = clientY - rect.top + el.scrollTop
    return Math.max(0, Math.min(items.length, Math.round(y / ROW)))
  }
  const onRowPointerDown = (event, n) => {
    if (event.button !== 0 || event.target.closest('button, input, label')) return
    dragRef.current = { n, x0: event.clientX, y0: event.clientY, active: false }
  }
  const onMove = (event) => {
    const d = dragRef.current
    if (!d) return
    if (!d.active) {
      if (Math.abs(event.clientY - d.y0) < 6 && Math.abs(event.clientX - d.x0) < 6) return
      d.active = true
      listRef.current?.setPointerCapture?.(event.pointerId)
    }
    setDrag({ n: d.n, y: event.clientY, target: targetFor(event.clientY) })
  }
  const onUp = async () => {
    const d = dragRef.current
    dragRef.current = null
    if (!d || !d.active) { setDrag(null); return }
    const target = drag?.target
    setDrag(null)
    if (target == null || target === d.n - 1 || target === d.n) return
    await move(d.n, target + 1)
  }

  if (!zone) return null
  return (
    <div className={`hf-jcard${drag ? ' hf-jcard-dragging' : ''}`} ref={listRef}
         onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} role="list" aria-label={t('desk.queue.title')}>
      {queue.loading && !items.length ? <Loading>{t('desk.browse.loading')}</Loading>
        : items.length === 0 ? (
          <Empty icon={<G.Tape />} title={t('common.queueIsEmpty')} body={t('hifi.queueEmptyBody')} />
        ) : items.map((item, index) => {
          const n = index + 1
          const isCurrent = n === current
          const shift = drag && drag.target != null && drag.n !== n
            ? ((index >= drag.target && index < drag.n - 1) ? ROW : (index < drag.target && index > drag.n - 1) ? -ROW : 0) : 0
          return (
            <div key={`${item.id}-${index}`} className="hf-qrow" role="listitem" tabIndex={0}
                 aria-current={isCurrent || undefined} aria-checked={checked.has(n) || undefined}
                 data-dragging={drag?.n === n || undefined}
                 style={shift ? { transform: `translateY(${shift}px)` } : undefined}
                 onPointerDown={(event) => onRowPointerDown(event, n)}
                 onDoubleClick={() => play(n)}
                 onKeyDown={(event) => {
                   if (event.key === 'Enter') play(n)
                   else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); remove(n) }
                 }}
                 onContextMenu={(event) => { event.preventDefault(); setMenu({ n, item, x: event.clientX, y: event.clientY }) }}>
              <span className="hf-qrow-num" aria-hidden="true">
                {isCurrent ? <span className="hf-playing-mark" data-on={tr.state === 'PLAYING' || undefined}><G.Play /></span> : String(n).padStart(2, '0')}
              </span>
              <span className="hf-qrow-art"><Art src={item.art} size={36} fallback="track" /></span>
              <span className="hf-qrow-text">
                <span className="hf-qrow-title">{item.title}</span>
                <span className="hf-qrow-sub">{[item.artist, item.album].filter(Boolean).join(' · ')}</span>
              </span>
              {item.duration && <span className="hf-qrow-dur">{trimDuration(item.duration)}</span>}
              <span className="hf-qrow-tools">
                <IconKey label={t('common.play')} onClick={() => play(n)}><G.Play /></IconKey>
                <IconKey label={t('desk.browse.actions')} onClick={(event) => setMenu({ n, item, x: event.clientX, y: event.clientY })}><G.Ellipsis /></IconKey>
                <label className="hf-tick" title={t('desk.browse.select')}>
                  <input type="checkbox" checked={checked.has(n)} onChange={() => toggle(n)} aria-label={t('desk.browse.select')} />
                  <span aria-hidden="true"><G.Check /></span>
                </label>
              </span>
            </div>
          )
        })}
      {queue.total > items.length && items.length > 0 && (
        <p className="hf-muted hf-jcard-more">{t('hifi.moreTracks', { count: queue.total - items.length })}</p>
      )}
      {menu && (
        <Menu x={menu.x} y={menu.y} onClose={() => setMenu(null)} title={menu.item.title}>
          <MenuItem icon={<G.Play />} onSelect={() => { setMenu(null); play(menu.n) }}>{t(menu.item.kind === 'podcast' ? 'desk.queue.playEpisode' : 'desk.queue.playSong')}</MenuItem>
          <MenuItem icon={<G.ChevronUp />} disabled={menu.n === 1} onSelect={() => { setMenu(null); move(menu.n, menu.n - 1) }}>{t('hifi.moveUp')}</MenuItem>
          <MenuItem icon={<G.ChevronDown />} disabled={menu.n === items.length} onSelect={() => { setMenu(null); move(menu.n, menu.n + 2) }}>{t('hifi.moveDown')}</MenuItem>
          <MenuSep />
          <MenuItem icon={<G.Trash />} danger onSelect={() => { setMenu(null); remove(menu.n) }}>
            {checked.has(menu.n) && checked.size > 1 ? t('hifi.removeSelected', { count: checked.size }) : t(menu.item.kind === 'podcast' ? 'desk.queue.removeEpisode' : 'desk.queue.removeSong')}
          </MenuItem>
          <MenuSep />
          <MenuItem icon={<G.Info />} disabled={!onInfo} onSelect={() => { setMenu(null); onInfo?.(menu.item) }}>{t('desk.now.infoOptions')}</MenuItem>
          {checked.size > 0 && <MenuItem icon={<G.Close />} onSelect={() => { setMenu(null); setChecked(new Set()) }}>{t('desk.actions.unselectAll')}</MenuItem>}
        </Menu>
      )}
      {drag && (
        <div className="hf-queue-ghost" style={{ top: drag.y - 18 }} aria-hidden="true">
          <Art src={items[drag.n - 1]?.art} size={32} fallback="track" />
          <span>{items[drag.n - 1]?.title}</span>
        </div>
      )}
      {checked.size > 0 && (
        <div className="hf-selection" role="toolbar" aria-label={t('hifi.selected', { count: checked.size })}>
          <span>{t('hifi.selected', { count: checked.size })}</span>
          <Key label={t('hifi.removeSelected', { count: checked.size })} icon={<G.Trash />} tone="danger" size="xs" onClick={() => remove([...checked][0])} />
          <Key label={t('desk.actions.unselectAll')} icon={<G.Close />} size="xs" onClick={() => setChecked(new Set())} />
        </div>
      )}
    </div>
  )
}

export default function TapeUnit({ zone, name = '', queue, onInfo, onMessage, onEdited }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const [confirmClear, setConfirmClear] = useState(false)
  const [saving, setSaving] = useState(false)
  const [jump, setJump] = useState(0)
  const tr = zone?.transport || {}
  const inUse = (tr.source === 'queue' && !isConnectSession(tr)) || tr.source === 'external_session'
  const count = queue.total || queue.items.length
  const current = inUse ? (tr.track_number || 0) : 0
  return (
    <Unit className="hf-tape-unit" name={t('hifi.unit.tape')} model={[t.plural('desk.queue.songs', count), zone && !inUse ? t('desk.queue.notInUse') : ''].filter(Boolean).join(' ')}>
      {!zone ? <Empty icon={<G.Tape />} title={t('desk.browse.selectRoom')} /> : (
        <div className="hf-tape-body">
          <div className="hf-tape-deck">
            <Cassette zone={zone} name={name || zone?.name || ''} count={count} current={current} inUse={inUse} />
            <div className="hf-tape-keys">
              <Key legend={t('hifi.rec')} label={t('desk.queue.save')} icon={<G.Record />} tone="danger" disabled={!queue.items.length} onClick={() => setSaving(true)} />
              <Key legend={t('hifi.eject')} label={t('desk.queue.clear')} icon={<G.Eject />} disabled={!queue.items.length} onClick={() => setConfirmClear(true)} />
              <Key legend={t('hifi.cue')} label={t('win.shortcuts.scrollCurrent')} icon={<G.Chevron style={{ transform: 'rotate(90deg)' }} />} disabled={!current} onClick={() => setJump((v) => v + 1)} />
            </div>
          </div>
          <QueueList zone={zone} queue={queue} onInfo={onInfo} onEdited={onEdited} jumpTo={jump} />
        </div>
      )}
      {confirmClear && (
        <Confirm title={t('desk.queue.clear')} body={t('win.queue.confirmClear')} action={t('win.queue.clearAction')} danger
                 onClose={() => setConfirmClear(false)}
                 onConfirm={async () => { setConfirmClear(false); await actions.clearQueue(zone.uuid); queue.reload(); onEdited?.() }} />
      )}
      {saving && (
        <Confirm title={t('desk.queue.saveTitle')} body={t('desk.queue.saveBody')} action={t('desk.queue.save')}
                 input={{ initial: suggestedQueueName(t, zone), placeholder: t('desk.queue.saveHint'), allowSame: true }}
                 onClose={() => setSaving(false)}
                 onConfirm={async (title) => {
                   setSaving(false)
                   const done = await actions.saveQueue(zone.uuid, title)
                   if (done) onMessage?.(t('hifi.queueSaved', { title }))
                 }} />
      )}
    </Unit>
  )
}
