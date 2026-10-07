import React, { useRef, useState } from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import Art from '../../frontend/src/components/Art.jsx'
import { suggestedQueueName } from '../../frontend/src/lib/playlistName.js'
import * as I from './icons.jsx'
import { IconButton, Button, Menu, MenuItem, MenuSep, Confirm, Empty, SheetHeader } from './ui.jsx'
import { isConnectSession } from '../../frontend/src/lib/transport.js'

// The queue: the room's list with the playing row marked, drag or the row
// menu to reorder, ticks to remove several at once, Save and Clear. Shown as
// a panel beside the content on a wide screen and over it on a narrow one.

function trimDuration(value) { return (value || '').replace(/^0:0?/, '') }

export function QueueList({ zone, queue, onInfo, onEdited, compact = false }) {
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
  const ROW = compact ? 48 : 56

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
    if (event.button !== 0 || event.target.closest('button, input')) return
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
    <div className={`sf-queue-list${drag ? ' sf-queue-dragging' : ''}`} ref={listRef}
         onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      {items.length === 0 ? (
        <Empty icon={<I.Queue />} title={t('common.queueIsEmpty')} body={t('sf.queueEmptyBody')} />
      ) : items.map((item, index) => {
        const n = index + 1
        const isCurrent = n === current
        const shift = drag && drag.target != null && drag.n !== n
          ? ((index >= drag.target && index < drag.n - 1) ? ROW : (index < drag.target && index > drag.n - 1) ? -ROW : 0) : 0
        return (
          <div key={`${item.id}-${index}`} className="sf-qrow" role="button" tabIndex={0}
               aria-current={isCurrent || undefined} aria-checked={checked.has(n) || undefined}
               data-dragging={drag?.n === n || undefined}
               style={shift ? { transform: `translateY(${shift}px)` } : undefined}
               onPointerDown={(event) => onRowPointerDown(event, n)}
               onDoubleClick={() => play(n)}
               onKeyDown={(event) => { if (event.key === 'Enter') play(n) }}
               onContextMenu={(event) => { event.preventDefault(); setMenu({ n, item, x: event.clientX, y: event.clientY }) }}>
            <span className="sf-qrow-num" aria-hidden="true">
              {isCurrent ? <span className="sf-eq" data-on={tr.state === 'PLAYING' || undefined}><i /><i /><i /></span> : n}
            </span>
            <span className="sf-qrow-art"><Art src={item.art} size={40} fallback="track" /></span>
            <span className="sf-qrow-text">
              <span className="sf-qrow-title">{item.title}</span>
              <span className="sf-qrow-sub">{[item.artist, item.album].filter(Boolean).join(' · ')}</span>
            </span>
            {item.duration && <span className="sf-qrow-dur">{trimDuration(item.duration)}</span>}
            <span className="sf-qrow-tools">
              <IconButton size="sm" label={t('common.play')} onClick={() => play(n)}><I.Play /></IconButton>
              <IconButton size="sm" label={t('desk.browse.actions')} onClick={(event) => setMenu({ n, item, x: event.clientX, y: event.clientY })}><I.Ellipsis /></IconButton>
              <label className="sf-check" title={t('desk.browse.select')}>
                <input type="checkbox" checked={checked.has(n)} onChange={() => toggle(n)} />
                <span aria-hidden="true"><I.Check /></span>
              </label>
            </span>
          </div>
        )
      })}
      {menu && (
        <Menu x={menu.x} y={menu.y} onClose={() => setMenu(null)} title={menu.item.title}>
          <MenuItem icon={<I.Play />} onSelect={() => { setMenu(null); play(menu.n) }}>{t(menu.item.kind === 'podcast' ? 'desk.queue.playEpisode' : 'desk.queue.playSong')}</MenuItem>
          <MenuItem icon={<I.Chevron style={{ transform: 'rotate(-90deg)' }} />} disabled={menu.n === 1} onSelect={() => { setMenu(null); move(menu.n, menu.n - 1) }}>{t('sf.moveUp')}</MenuItem>
          <MenuItem icon={<I.Chevron style={{ transform: 'rotate(90deg)' }} />} disabled={menu.n === items.length} onSelect={() => { setMenu(null); move(menu.n, menu.n + 2) }}>{t('sf.moveDown')}</MenuItem>
          <MenuSep />
          <MenuItem icon={<I.Trash />} danger onSelect={() => { setMenu(null); remove(menu.n) }}>
            {checked.has(menu.n) && checked.size > 1 ? t('sf.removeSelected', { count: checked.size }) : t(menu.item.kind === 'podcast' ? 'desk.queue.removeEpisode' : 'desk.queue.removeSong')}
          </MenuItem>
          <MenuSep />
          <MenuItem icon={<I.Info />} disabled={!onInfo} onSelect={() => { setMenu(null); onInfo?.(menu.item) }}>{t('desk.now.infoOptions')}</MenuItem>
          {checked.size > 0 && <MenuItem onSelect={() => { setMenu(null); setChecked(new Set()) }}>{t('desk.actions.unselectAll')}</MenuItem>}
        </Menu>
      )}
      {drag && (
        <div className="sf-queue-ghost" style={{ top: drag.y - 20 }} aria-hidden="true">
          <Art src={items[drag.n - 1]?.art} size={40} fallback="track" />
          <span>{items[drag.n - 1]?.title}</span>
        </div>
      )}
    </div>
  )
}

export default function QueueDrawer({ zone, queue, onClose, onInfo, onMessage, onEdited, inline = false, open = true }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const [confirmClear, setConfirmClear] = useState(false)
  const [saving, setSaving] = useState(false)
  const tr = zone?.transport || {}
  const inUse = (tr.source === 'queue' && !isConnectSession(tr)) || tr.source === 'external_session'
  const count = queue.total || queue.items.length
  const sub = [t.plural('desk.queue.songs', count), zone && !inUse ? t('desk.queue.notInUse') : ''].filter(Boolean).join(' · ')
  return (
    <aside className={`sf-queue${inline ? ' sf-queue-inline' : ''}`} aria-label={t('desk.queue.title')} aria-hidden={!inline && !open ? 'true' : undefined}>
      <SheetHeader title={t('desk.queue.title')} sub={sub} onClose={inline ? null : onClose}>
        <div className="sf-queue-tools">
          <IconButton size="sm" label={t('desk.queue.save')} disabled={!zone || !queue.items.length} onClick={() => setSaving(true)}><I.Playlist /></IconButton>
          <IconButton size="sm" label={t('desk.queue.clear')} disabled={!zone || !queue.items.length} onClick={() => setConfirmClear(true)}><I.Trash /></IconButton>
        </div>
      </SheetHeader>
      <QueueList zone={zone} queue={queue} onInfo={onInfo} onEdited={onEdited} />
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
                   if (done) onMessage?.(t('sf.queueSaved', { title }))
                 }} />
      )}
    </aside>
  )
}
