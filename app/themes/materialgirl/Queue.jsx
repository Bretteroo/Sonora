import React, { useRef, useState } from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import Art from '../../frontend/src/components/Art.jsx'
import { suggestedQueueName } from '../../frontend/src/lib/playlistName.js'
import * as I from './icons.jsx'
import { IconButton, Menu, MenuItem, MenuSep, Confirm, Empty, Sheet, SheetBar, Button, cx } from './m3.jsx'
import { isConnectSession } from '../../frontend/src/lib/transport.js'

// The queue: the room's list with the playing row lifted onto a tertiary
// container and its bars dancing, a drag handle on every row to reorder it,
// a checkbox to take several out at once, and Save and Clear. It docks as a
// standard side sheet on a large window and comes up as a modal sheet on
// anything smaller.

function trim(value) { return (value || '').replace(/^0:0?/, '') }

export function QueueList({ zone, queue, onInfo, onEdited, dense = false }) {
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
  const ROW = dense ? 56 : 64

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

  // Reordering by the handle: the row follows the pointer and its neighbors
  // part to show where it will land.
  const targetFor = (clientY) => {
    const el = listRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const y = clientY - rect.top + el.scrollTop
    return Math.max(0, Math.min(items.length, Math.round(y / ROW)))
  }
  const onHandleDown = (event, n) => {
    if (event.button !== 0) return
    event.preventDefault()
    dragRef.current = { n, active: true }
    listRef.current?.setPointerCapture?.(event.pointerId)
    setDrag({ n, y: event.clientY, target: targetFor(event.clientY) })
  }
  const onMove = (event) => {
    if (!dragRef.current) return
    setDrag({ n: dragRef.current.n, y: event.clientY, target: targetFor(event.clientY) })
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
  if (items.length === 0) return <Empty icon={<I.Queue />} title={t('common.queueIsEmpty')} body={t('mg.queueEmptyBody')} />
  return (
    <div className={cx('mg-qlist', drag && 'mg-qlist-dragging', dense && 'mg-qlist-dense')} ref={listRef}
         onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      {items.map((item, index) => {
        const n = index + 1
        const isCurrent = n === current
        const shift = drag && drag.target != null && drag.n !== n
          ? ((index >= drag.target && index < drag.n - 1) ? ROW : (index < drag.target && index > drag.n - 1) ? -ROW : 0) : 0
        return (
          <div key={`${item.id}-${index}`} className="mg-qrow" role="button" tabIndex={0}
               aria-current={isCurrent || undefined} data-checked={checked.has(n) || undefined} data-dragging={drag?.n === n || undefined}
               style={shift ? { transform: `translateY(${shift}px)` } : undefined}
               onClick={() => play(n)} onKeyDown={(event) => { if (event.key === 'Enter') play(n) }}
               onContextMenu={(event) => { event.preventDefault(); setMenu({ n, item, x: event.clientX, y: event.clientY }) }}>
            <span className="mg-state" aria-hidden="true" />
            <span className="mg-qrow-handle" title={t('mg.dragToReorder')} onPointerDown={(event) => onHandleDown(event, n)} onClick={(event) => event.stopPropagation()}><I.Drag /></span>
            <span className="mg-qrow-art">
              <Art src={item.art} size={40} fallback="track" />
              {isCurrent && <span className="mg-bars" data-on={tr.state === 'PLAYING' || undefined} aria-hidden="true"><i /><i /><i /><i /></span>}
            </span>
            <span className="mg-qrow-text">
              <span className="mg-qrow-title">{item.title}</span>
              <span className="mg-qrow-sub">{[item.artist, item.album].filter(Boolean).join(' · ')}</span>
            </span>
            {item.duration && <span className="mg-qrow-dur">{trim(item.duration)}</span>}
            <span className="mg-qrow-tools" onClick={(event) => event.stopPropagation()}>
              <label className="mg-check" title={t('desk.browse.select')}>
                <input type="checkbox" checked={checked.has(n)} onChange={() => toggle(n)} aria-label={t('desk.browse.select')} />
                <span aria-hidden="true"><I.Check /></span>
              </label>
              <IconButton size="xs" label={t('desk.browse.actions')} onClick={(event) => setMenu({ n, item, anchor: event.currentTarget })}><I.More /></IconButton>
            </span>
          </div>
        )
      })}
      {checked.size > 0 && (
        <div className="mg-qlist-bar" role="toolbar" aria-label={t('mg.selected', { count: checked.size })}>
          <span>{t('mg.selected', { count: checked.size })}</span>
          <Button variant="tonal" size="xs" icon={<I.Trash />} onClick={() => remove([...checked][0])}>{t('mg.removeSelected', { count: checked.size })}</Button>
          <IconButton size="xs" label={t('desk.actions.unselectAll')} onClick={() => setChecked(new Set())}><I.Close /></IconButton>
        </div>
      )}
      {menu && (
        <Menu x={menu.x} y={menu.y} anchor={menu.anchor || null} align="right" onClose={() => setMenu(null)} title={menu.item.title}>
          <MenuItem icon={<I.Play />} onSelect={() => { setMenu(null); play(menu.n) }}>{t(menu.item.kind === 'podcast' ? 'desk.queue.playEpisode' : 'desk.queue.playSong')}</MenuItem>
          <MenuItem icon={<I.Up />} disabled={menu.n === 1} onSelect={() => { setMenu(null); move(menu.n, menu.n - 1) }}>{t('mg.moveUp')}</MenuItem>
          <MenuItem icon={<I.Down />} disabled={menu.n === items.length} onSelect={() => { setMenu(null); move(menu.n, menu.n + 2) }}>{t('mg.moveDown')}</MenuItem>
          <MenuSep />
          <MenuItem icon={<I.Trash />} danger onSelect={() => { setMenu(null); remove(menu.n) }}>
            {checked.has(menu.n) && checked.size > 1 ? t('mg.removeSelected', { count: checked.size }) : t(menu.item.kind === 'podcast' ? 'desk.queue.removeEpisode' : 'desk.queue.removeSong')}
          </MenuItem>
          <MenuSep />
          <MenuItem icon={<I.Info />} disabled={!onInfo} onSelect={() => { setMenu(null); onInfo?.(menu.item) }}>{t('desk.now.infoOptions')}</MenuItem>
          {checked.size > 0 && <MenuItem icon={<I.Close />} onSelect={() => { setMenu(null); setChecked(new Set()) }}>{t('desk.actions.unselectAll')}</MenuItem>}
        </Menu>
      )}
      {drag && (
        <div className="mg-qghost" style={{ top: drag.y - 24 }} aria-hidden="true">
          <Art src={items[drag.n - 1]?.art} size={40} fallback="track" />
          <span>{items[drag.n - 1]?.title}</span>
        </div>
      )}
    </div>
  )
}

// Save and Clear for a queue, with their confirmations: in the queue sheet's bar and above the
// big player's Up next list (which had only per-row removal).
export function QueueActions({ zone, queue, onMessage, onEdited }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const [confirmClear, setConfirmClear] = useState(false)
  const [saving, setSaving] = useState(false)
  return (
    <>
      <IconButton label={t('desk.queue.save')} disabled={!zone || !queue.items.length} onClick={() => setSaving(true)}><I.Playlist /></IconButton>
      <IconButton label={t('desk.queue.clear')} disabled={!zone || !queue.items.length} onClick={() => setConfirmClear(true)}><I.Trash /></IconButton>
      {confirmClear && (
        <Confirm title={t('desk.queue.clear')} body={t('win.queue.confirmClear')} action={t('win.queue.clearAction')} danger icon={<I.Trash />}
                 onClose={() => setConfirmClear(false)}
                 onConfirm={async () => { setConfirmClear(false); await actions.clearQueue(zone.uuid); queue.reload(); onEdited?.() }} />
      )}
      {saving && (
        <Confirm title={t('desk.queue.saveTitle')} body={t('desk.queue.saveBody')} action={t('desk.queue.save')} icon={<I.Playlist />}
                 input={{ initial: suggestedQueueName(t, zone), placeholder: t('desk.queue.saveHint'), allowSame: true, label: t('desk.queue.saveHint') }}
                 onClose={() => setSaving(false)}
                 onConfirm={async (title) => {
                   setSaving(false)
                   const done = await actions.saveQueue(zone.uuid, title)
                   if (done) onMessage?.(t('mg.queueSaved', { title }))
                 }} />
      )}
    </>
  )
}

// What the queue is: its length, and whether the room is playing from it.
export function queueSummary(t, zone, queue) {
  const tr = zone?.transport || {}
  const inUse = (tr.source === 'queue' && !isConnectSession(tr)) || tr.source === 'external_session'
  const count = queue.total || queue.items.length
  return [t.plural('desk.queue.songs', count), zone && !inUse ? t('desk.queue.notInUse') : ''].filter(Boolean).join(' · ')
}

function QueueHead({ zone, queue, onClose, onMessage, onEdited }) {
  const { t } = useI18n()
  return (
    <SheetBar title={t('desk.queue.title')} sub={queueSummary(t, zone, queue)} onClose={onClose}>
      <QueueActions zone={zone} queue={queue} onMessage={onMessage} onEdited={onEdited} />
    </SheetBar>
  )
}

export function QueueSheet({ zone, queue, onClose, onInfo, onMessage, onEdited }) {
  const { t } = useI18n()
  return (
    <Sheet kind="side" title={t('desk.queue.title')} onClose={onClose} className="mg-queue-sheet">
      <QueueHead zone={zone} queue={queue} onClose={onClose} onMessage={onMessage} onEdited={onEdited} />
      <div className="mg-sheet-body mg-sheet-body-flush"><QueueList zone={zone} queue={queue} onInfo={onInfo} onEdited={onEdited} /></div>
    </Sheet>
  )
}

export function QueuePane({ zone, queue, onClose, onInfo, onMessage, onEdited }) {
  const { t } = useI18n()
  return (
    <aside className="mg-queue-pane" aria-label={t('desk.queue.title')}>
      <QueueHead zone={zone} queue={queue} onClose={onClose} onMessage={onMessage} onEdited={onEdited} />
      <div className="mg-queue-pane-body"><QueueList zone={zone} queue={queue} onInfo={onInfo} onEdited={onEdited} /></div>
    </aside>
  )
}
