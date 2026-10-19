import React, { useRef, useState } from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import Art from '../../frontend/src/components/Art.jsx'
import { suggestedQueueName } from '../../frontend/src/lib/playlistName.js'
import { isConnectSession } from '../../frontend/src/lib/transport.js'
import * as G from './glyphs.jsx'
import { rectOf, pt } from './layout.js'
import { Btn, IconBtn, Menu, MenuItem, MenuSep, Confirm, Empty, Tick, cx } from './kit.jsx'

// The Queue program: the room's queue as a numbered listing, the playing row
// in inverse video with a cursor beside it. Every row has a handle to drag it
// to a new place, a box to tick it with others, and a menu; Save and Clear act
// on the whole of it.

function trim(value) { return (value || '').replace(/^0:0?/, '') }

// What the queue is: its length, and whether the room is playing from it.
export function queueSummary(t, zone, queue) {
  const tr = zone?.transport || {}
  const inUse = (tr.source === 'queue' && !isConnectSession(tr)) || tr.source === 'external_session'
  const count = queue.total || queue.items.length
  return [t.plural('desk.queue.songs', count), zone && !inUse ? t('desk.queue.notInUse') : ''].filter(Boolean).join(' · ')
}

export function QueueList({ zone, queue, onInfo, onEdited }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const { items, reload } = queue
  const tr = zone?.transport || {}
  // A Spotify Connect session plays Spotify's own queue, which no controller can list: the
  // room's queue is not what plays.
  const inUse = (tr.source === 'queue' && !isConnectSession(tr)) || tr.source === 'external_session'
  const current = inUse ? (tr.track_number || 0) : 0
  const [checked, setChecked] = useState(() => new Set())
  const [menu, setMenu] = useState(null)
  const [drag, setDrag] = useState(null)
  const dragRef = useRef(null)
  const listRef = useRef(null)
  const ROW = 44

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

  // Reordering by the handle: the row follows the pointer and its neighbors part to show where
  // it will land.
  const targetFor = (clientY) => {
    const el = listRef.current
    if (!el) return null
    const rect = rectOf(el)
    return Math.max(0, Math.min(items.length, Math.round((clientY - rect.top) / ROW)))
  }
  const onHandleDown = (event, n) => {
    if (event.button !== 0) return
    event.preventDefault()
    dragRef.current = { n }
    listRef.current?.setPointerCapture?.(event.pointerId)
    setDrag({ n, y: pt(event.clientY), target: targetFor(pt(event.clientY)) })
  }
  const onMove = (event) => {
    if (!dragRef.current) return
    setDrag({ n: dragRef.current.n, y: pt(event.clientY), target: targetFor(pt(event.clientY)) })
  }
  const onUp = async () => {
    const d = dragRef.current
    dragRef.current = null
    const target = drag?.target
    setDrag(null)
    if (!d || target == null || target === d.n - 1 || target === d.n) return
    await move(d.n, target + 1)
  }

  if (!zone) return null
  if (items.length === 0) return <Empty icon={<G.Queue size={48} />} title={t('common.queueIsEmpty')} body={t('sv.queueEmptyBody')} />
  return (
    <div className={cx('sv-qlist', drag && 'sv-qlist-dragging')} ref={listRef} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      {items.map((item, index) => {
        const n = index + 1
        const isCurrent = n === current
        const shift = drag && drag.target != null && drag.n !== n
          ? ((index >= drag.target && index < drag.n - 1) ? ROW : (index < drag.target && index > drag.n - 1) ? -ROW : 0) : 0
        return (
          <div key={`${item.id}-${index}`} className="sv-qrow" role="button" tabIndex={0}
               aria-current={isCurrent || undefined} data-checked={checked.has(n) || undefined} data-dragging={drag?.n === n || undefined}
               data-playing={isCurrent && tr.state === 'PLAYING' ? '' : undefined}
               style={shift ? { transform: `translateY(${shift}px)` } : undefined}
               onClick={() => play(n)} onKeyDown={(event) => { if (event.key === 'Enter') play(n) }}
               onContextMenu={(event) => { event.preventDefault(); setMenu({ n, item, x: pt(event.clientX), y: pt(event.clientY) }) }}>
            <span className="sv-qrow-cursor" aria-hidden="true">{isCurrent ? '>' : ''}</span>
            <span className="sv-qrow-n">{String(n).padStart(3, '0')}</span>
            <span className="sv-qrow-handle" title={t('sv.dragToReorder')} onPointerDown={(event) => onHandleDown(event, n)} onClick={(event) => event.stopPropagation()}><G.Drag size={24} /></span>
            <span className="sv-art sv-art-row"><Art src={item.art} size={32} fallback="track" /></span>
            <span className="sv-qrow-text">
              <span className="sv-qrow-title">{item.title}</span>
              <span className="sv-qrow-sub">{[item.artist, item.album].filter(Boolean).join(' · ')}</span>
            </span>
            {item.duration && <span className="sv-qrow-dur">{trim(item.duration)}</span>}
            <span className="sv-qrow-tools" onClick={(event) => event.stopPropagation()}>
              <Tick checked={checked.has(n)} onChange={() => toggle(n)} label={t('desk.browse.select')} />
              <IconBtn size="s" label={t('desk.browse.actions')} onClick={(event) => setMenu({ n, item, anchor: event.currentTarget })}><G.More size={24} /></IconBtn>
            </span>
          </div>
        )
      })}
      {checked.size > 0 && (
        <div className="sv-selectbar" role="toolbar" aria-label={t('sv.selected', { count: checked.size })}>
          <span>{t('sv.selected', { count: checked.size })}</span>
          <Btn variant="solid" size="s" icon={<G.Trash size={12} />} onClick={() => remove([...checked][0])}>{t('sv.removeSelected', { count: checked.size })}</Btn>
          <Btn size="s" onClick={() => setChecked(new Set())}>{t('desk.actions.unselectAll')}</Btn>
        </div>
      )}
      {menu && (
        <Menu x={menu.x} y={menu.y} anchor={menu.anchor || null} align="right" onClose={() => setMenu(null)} title={menu.item.title}>
          <MenuItem icon={<G.Play size={12} />} onSelect={() => { setMenu(null); play(menu.n) }}>{t(menu.item.kind === 'podcast' ? 'desk.queue.playEpisode' : 'desk.queue.playSong')}</MenuItem>
          {menu.n > 1 && <MenuItem icon={<G.Up size={12} />} onSelect={() => { setMenu(null); move(menu.n, menu.n - 1) }}>{t('sv.moveUp')}</MenuItem>}
          {menu.n < items.length && <MenuItem icon={<G.Down size={12} />} onSelect={() => { setMenu(null); move(menu.n, menu.n + 2) }}>{t('sv.moveDown')}</MenuItem>}
          <MenuSep />
          <MenuItem icon={<G.Trash size={12} />} danger onSelect={() => { setMenu(null); remove(menu.n) }}>
            {checked.has(menu.n) && checked.size > 1 ? t('sv.removeSelected', { count: checked.size }) : t(menu.item.kind === 'podcast' ? 'desk.queue.removeEpisode' : 'desk.queue.removeSong')}
          </MenuItem>
          {onInfo && <MenuSep />}
          {onInfo && <MenuItem icon={<G.Info size={12} />} onSelect={() => { setMenu(null); onInfo(menu.item) }}>{t('desk.now.infoOptions')}</MenuItem>}
          {checked.size > 0 && <MenuItem icon={<G.Close size={12} />} onSelect={() => { setMenu(null); setChecked(new Set()) }}>{t('desk.actions.unselectAll')}</MenuItem>}
        </Menu>
      )}
      {drag && (
        <div className="sv-qghost sv-screenlike" style={{ top: drag.y - 20 }} aria-hidden="true">
          <span className="sv-qrow-n">{String(drag.n).padStart(3, '0')}</span>
          <span>{items[drag.n - 1]?.title}</span>
        </div>
      )}
    </div>
  )
}

// Save and Clear for a queue, with their confirmations.
export function QueueActions({ zone, queue, onMessage, onEdited }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const [confirmClear, setConfirmClear] = useState(false)
  const [saving, setSaving] = useState(false)
  return (
    <>
      {zone && queue.items.length > 0 && <Btn size="s" icon={<G.Playlist size={12} />} onClick={() => setSaving(true)}>{t('desk.queue.save')}</Btn>}
      {zone && queue.items.length > 0 && <Btn size="s" icon={<G.Trash size={12} />} onClick={() => setConfirmClear(true)}>{t('desk.queue.clear')}</Btn>}
      {confirmClear && (
        <Confirm title={t('desk.queue.clear')} body={t('win.queue.confirmClear')} action={t('win.queue.clearAction')} danger icon={<G.Trash size={48} />}
                 onClose={() => setConfirmClear(false)}
                 onConfirm={async () => { setConfirmClear(false); await actions.clearQueue(zone.uuid); queue.reload(); onEdited?.() }} />
      )}
      {saving && (
        <Confirm title={t('desk.queue.saveTitle')} body={t('desk.queue.saveBody')} action={t('desk.queue.save')} icon={<G.Playlist size={48} />}
                 input={{ initial: suggestedQueueName(t, zone), placeholder: t('desk.queue.saveHint'), allowSame: true, label: t('desk.queue.saveHint') }}
                 onClose={() => setSaving(false)}
                 onConfirm={async (title) => {
                   setSaving(false)
                   const done = await actions.saveQueue(zone.uuid, title)
                   if (done) onMessage?.(t('sv.queueSaved', { title }))
                 }} />
      )}
    </>
  )
}

export function QueueProgram({ zone, queue, onInfo, onMessage, onEdited }) {
  const { t } = useI18n()
  if (!zone) return <Empty icon={<G.Speaker size={48} />} title={t('desk.browse.selectRoom')} />
  return (
    <div className="sv-queue">
      <header className="sv-programhead">
        <div>
          <h1 className="sv-title">{t('desk.queue.title')}</h1>
          <p className="sv-dim">{queueSummary(t, zone, queue)}</p>
        </div>
        <div className="sv-programhead-tools"><QueueActions zone={zone} queue={queue} onMessage={onMessage} onEdited={onEdited} /></div>
      </header>
      <QueueList zone={zone} queue={queue} onInfo={onInfo} onEdited={onEdited} />
    </div>
  )
}
