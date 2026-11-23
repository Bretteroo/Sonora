import React, { useEffect, useRef, useState } from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import Art from '../../frontend/src/components/Art.jsx'
import { suggestedQueueName } from '../../frontend/src/lib/playlistName.js'
import { isConnectSession } from '../../frontend/src/lib/transport.js'
import * as G from './glyphs.jsx'
import { rectOf, ptX, ptY } from './layout.js'
import { Btn, IconBtn, Menu, MenuItem, MenuSep, Confirm, Empty, Tick, Toggle, cx } from './kit.jsx'
import { useModes, withShuffle, withoutShuffle, playThrough } from './modes.js'
import { pad } from './songbook.jsx'
import { api } from '../../frontend/src/lib/api.js'

// The Queue program: the room's queue as a karaoke reservation list, every song on a line of
// a table under its number, the one being sung under a bar of yellow. Every row has a handle
// to drag it to a new place, a box to tick it with others, and a menu; Save and Clear act on
// the whole of it.


// Where a song in the queue comes from: its music service's own mark, read off the service
// number its address carries, a folder for a file in the music library, and nothing for a
// song whose address names neither.
function Source({ item }) {
  const [failed, setFailed] = useState(false)
  const uri = item.uri || ''
  const sid = Number((/[?&]sid=(\d+)/.exec(uri) || [])[1]) || Number(item.service_id) || Number(item.sid) || 0
  return (
    <span className="km-qrow-src" aria-hidden="true">
      {sid > 0 && !failed ? <img src={`/api/services/logo/sid/${sid}?size=48`} alt="" loading="lazy" onError={() => setFailed(true)} />
        : /^x-file-cifs:|^x-smb:/.test(uri) ? <G.Folder size={18} /> : null}
    </span>
  )
}

// What the queue is: its length, and whether the room is playing from it.
export function queueSummary(t, zone, queue) {
  const tr = zone?.transport || {}
  const inUse = (tr.source === 'queue' && !isConnectSession(tr)) || tr.source === 'external_session'
  const count = queue.total || queue.items.length
  return [t.plural('desk.queue.songs', count), zone && !inUse ? t('desk.queue.notInUse') : ''].filter(Boolean).join(' · ')
}

export function QueueList({ zone, queue, onInfo, onEdited, onPlay }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const { items, reload } = queue
  const tr = zone?.transport || {}
  // A Spotify Connect session plays Spotify's own queue, which no controller can list: the
  // room's queue is not what plays.
  // A stopped room has no song of its queue in hand: none is marked.
  const inUse = ((tr.source === 'queue' && !isConnectSession(tr)) || tr.source === 'external_session') && tr.state !== 'STOPPED'
  const current = inUse ? (tr.track_number || 0) : 0
  const [checked, setChecked] = useState(() => new Set())
  const [menu, setMenu] = useState(null)
  const [drag, setDrag] = useState(null)
  const dragRef = useRef(null)
  const listRef = useRef(null)
  // A row and the gap under it, which is how far a row moves to make room for one being dragged.
  const ROW = 48

  // A song chosen from the list plays, and its words go up on the screen.
  const play = async (n) => { onPlay?.(); playThrough(actions, zone); if (await actions.seekTrack(zone.uuid, n) && tr.state !== 'PLAYING') actions.play(zone.uuid) }
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
    setDrag({ n, y: ptY(event.clientY), target: targetFor(ptY(event.clientY)) })
  }
  const onMove = (event) => {
    if (!dragRef.current) return
    setDrag({ n: dragRef.current.n, y: ptY(event.clientY), target: targetFor(ptY(event.clientY)) })
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
  if (items.length === 0) return <Empty icon={<G.Queue size={48} />} title={t('common.queueIsEmpty')} body={t('km.queueEmptyBody')} />
  return (
    <div className={cx('km-qlist', drag && 'km-qlist-dragging')} ref={listRef} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      {items.map((item, index) => {
        const n = index + 1
        const isCurrent = n === current
        const shift = drag && drag.target != null && drag.n !== n
          ? ((index >= drag.target && index < drag.n - 1) ? ROW : (index < drag.target && index > drag.n - 1) ? -ROW : 0) : 0
        return (
          <div key={`${item.id}-${index}`} className="km-qrow" role="button" tabIndex={0}
               aria-current={isCurrent || undefined} data-checked={checked.has(n) || undefined} data-dragging={drag?.n === n || undefined}
               data-playing={isCurrent && tr.state === 'PLAYING' ? '' : undefined}
               style={shift ? { transform: `translateY(${shift}px)` } : undefined}
               onClick={() => play(n)} onKeyDown={(event) => { if (event.key === 'Enter') play(n) }}
               onContextMenu={(event) => { event.preventDefault(); setMenu({ n, item, x: ptX(event.clientX), y: ptY(event.clientY) }) }}>
            <span className="km-qrow-ball" aria-hidden="true" />
            <span className="km-qrow-n">{pad(n)}</span>
            <span className="km-qrow-handle" title={t('km.dragToReorder')} onPointerDown={(event) => onHandleDown(event, n)} onClick={(event) => event.stopPropagation()}><G.Drag size={24} /></span>
            <span className="km-art km-art-row"><Art src={item.art} size={32} fallback="track" /></span>
            <span className="km-qrow-text">
              <span className="km-qrow-title">{item.title}</span>
              <span className="km-qrow-sub">{[item.artist, item.album].filter(Boolean).join(' · ')}</span>
            </span>
            <Source item={item} />
            <span className="km-qrow-tools" onClick={(event) => event.stopPropagation()}>
              <Tick checked={checked.has(n)} onChange={() => toggle(n)} label={t('desk.browse.select')} />
              <IconBtn size="s" label={t('desk.browse.actions')} onClick={(event) => setMenu({ n, item, anchor: event.currentTarget })}><G.More size={24} /></IconBtn>
            </span>
          </div>
        )
      })}
      {checked.size > 0 && (
        <div className="km-selectbar" role="toolbar" aria-label={t('km.selected', { count: checked.size })}>
          <Btn variant="solid" size="s" icon={<G.Trash size={12} />} onClick={() => remove([...checked][0])}>{t('km.removeSelected', { count: checked.size })}</Btn>
          <Btn size="s" onClick={() => setChecked(new Set())}>{t('desk.actions.unselectAll')}</Btn>
        </div>
      )}
      {menu && (
        <Menu x={menu.x} y={menu.y} anchor={menu.anchor || null} align="right" onClose={() => setMenu(null)} title={menu.item.title}>
          <MenuItem icon={<G.Play size={12} />} onSelect={() => { setMenu(null); play(menu.n) }}>{t(menu.item.kind === 'podcast' ? 'desk.queue.playEpisode' : 'desk.queue.playSong')}</MenuItem>
          {menu.n > 1 && <MenuItem icon={<G.Up size={12} />} onSelect={() => { setMenu(null); move(menu.n, menu.n - 1) }}>{t('km.moveUp')}</MenuItem>}
          {menu.n < items.length && <MenuItem icon={<G.Down size={12} />} onSelect={() => { setMenu(null); move(menu.n, menu.n + 2) }}>{t('km.moveDown')}</MenuItem>}
          <MenuSep />
          <MenuItem icon={<G.Trash size={12} />} danger onSelect={() => { setMenu(null); remove(menu.n) }}>
            {checked.has(menu.n) && checked.size > 1 ? t('km.removeSelected', { count: checked.size }) : t(menu.item.kind === 'podcast' ? 'desk.queue.removeEpisode' : 'desk.queue.removeSong')}
          </MenuItem>
          {onInfo && <MenuSep />}
          {onInfo && <MenuItem icon={<G.Info size={12} />} onSelect={() => { setMenu(null); onInfo(menu.item) }}>{t('desk.now.infoOptions')}</MenuItem>}
          {checked.size > 0 && <MenuItem icon={<G.Close size={12} />} onSelect={() => { setMenu(null); setChecked(new Set()) }}>{t('desk.actions.unselectAll')}</MenuItem>}
        </Menu>
      )}
      {drag && (
        <div className="km-qghost km-screenlike" style={{ top: drag.y - 20 }} aria-hidden="true">
          <span className="km-qrow-n">{pad(drag.n)}</span>
          <span>{items[drag.n - 1]?.title}</span>
        </div>
      )}
    </div>
  )
}

// Save, Load, and Clear for a queue, with their confirmations. Load lists the household's
// saved queues (its Sonos playlists, as Save Queue makes them), and the one picked replaces the
// queue and plays, as the apps' Replace Queue does.
export function QueueActions({ zone, queue, onMessage, onEdited, onLoad, listZone }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const [confirmClear, setConfirmClear] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(null)
  // A saved queue picked while the queue holds songs: replace them, or add it to the end?
  const [asking, setAsking] = useState(null)
  const choose = (item) => {
    setLoading(null)
    if (queue.items.length > 0) { setAsking(item); return }
    onLoad(item, 'replace')
    onEdited?.()
  }
  const load = (item, how) => { setAsking(null); onLoad(item, how); onEdited?.() }
  const openSaved = async (event) => {
    const anchor = event.currentTarget
    setLoading({ anchor, items: null })
    let items = []
    try { items = (await api.playlists(listZone || zone?.uuid)).items || [] } catch { items = [] }
    setLoading((now) => (now && now.anchor === anchor ? { anchor, items } : now))
  }
  return (
    <>
      {zone && onLoad && <Btn size="s" icon={<G.Playlist size={12} />} onClick={openSaved}><span className="km-say-long">{t('km.loadQueue')}</span><span className="km-say-short">{t('km.loadShort')}</span></Btn>}
      {loading && (
        <Menu anchor={loading.anchor} align="left" onClose={() => setLoading(null)} title={t('km.loadQueue')}>
          {loading.items === null && <MenuItem disabled>{t('desk.browse.loading')}</MenuItem>}
          {loading.items?.length === 0 && <MenuItem disabled>{t('km.noSavedQueues')}</MenuItem>}
          {(loading.items || []).map((item) => (
            <MenuItem key={item.id || item.uri} icon={<G.Playlist size={12} />} onSelect={() => choose(item)}>{item.title}</MenuItem>
          ))}
        </Menu>
      )}
      {zone && queue.items.length > 0 && <Btn size="s" icon={<G.Playlist size={12} />} onClick={() => setSaving(true)}><span className="km-say-long">{t('desk.queue.save')}</span><span className="km-say-short">{t('common.save')}</span></Btn>}
      {zone && queue.items.length > 0 && <Btn size="s" icon={<G.Trash size={12} />} onClick={() => setConfirmClear(true)}><span className="km-say-long">{t('desk.queue.clear')}</span><span className="km-say-short">{t('win.queue.clearAction')}</span></Btn>}
      {asking && (
        <Confirm title={t('km.loadQueue')} body={t('km.loadQueueAsk', { title: asking.title })} icon={<G.Playlist size={48} />}
                 action={t('desk.actions.replaceQueue')} onConfirm={() => load(asking, 'replace')} onClose={() => setAsking(null)}
                 alt={{ label: t('desk.actions.addToQueue'), onSelect: () => load(asking, 'add') }} />
      )}
      {confirmClear && (
        <Confirm title={t('desk.queue.clear')} body={t('win.queue.confirmClear')} action={t('win.queue.clearAction')} danger icon={<G.Trash size={48} />}
                 onClose={() => setConfirmClear(false)}
                 onConfirm={async () => {
                   setConfirmClear(false)
                   // Whatever was playing stops with the queue, a station or a song beside it too:
                   // a speaker would play those on after its queue was emptied.
                   if (['PLAYING', 'TRANSITIONING'].includes(zone.transport?.state)) await actions.stop(zone.uuid)
                   await actions.clearQueue(zone.uuid)
                   queue.reload(); onEdited?.()
                 }} />
      )}
      {saving && (
        <Confirm title={t('desk.queue.saveTitle')} body={t('desk.queue.saveBody')} action={t('desk.queue.save')} icon={<G.Playlist size={48} />}
                 input={{ initial: suggestedQueueName(t, zone), placeholder: t('desk.queue.saveHint'), allowSame: true, label: t('desk.queue.saveHint') }}
                 onClose={() => setSaving(false)}
                 onConfirm={async (title) => {
                   setSaving(false)
                   const done = await actions.saveQueue(zone.uuid, title)
                   if (done) onMessage?.(t('km.queueSaved', { title }))
                 }} />
      )}
    </>
  )
}

// The panel at the left stays put while the list scrolls under it. On a screen shorter than
// the panel it rides up with the list until its last key shows and holds there, so every key
// is a short scroll away and not at the far end of a long list.
const SIDE_GAP = 4
const SIDE_FOOT = 12
function useSideRest(present) {
  const ref = useRef(null)
  useEffect(() => {
    const side = ref.current
    const scroller = side?.closest('.km-crt-scroll')
    if (!side || !scroller || typeof ResizeObserver === 'undefined') return undefined
    const place = () => side.style.setProperty('--km-queue-side-top', `${Math.min(SIDE_GAP, scroller.clientHeight - side.offsetHeight - SIDE_FOOT)}px`)
    const watch = new ResizeObserver(place)
    watch.observe(side)
    watch.observe(scroller)
    place()
    return () => watch.disconnect()
  }, [present])
  return ref
}

// The page is the reservation list: the song being sung and what can be done with the whole
// list stand in a panel at the left, and the list itself is a table under its column heads.
// Shuffle is a switch there with the list's keys, on or off, and it is the list's: while a
// station plays beside the queue the room takes no mode, so the switch shows the mode the
// queue waits with and sets the one it will next play in. It is dimmed only where there is
// no list to order.
export function QueueProgram({ zone, room = '', queue, onInfo, onMessage, onEdited, onPlay, onLoad, listZone }) {
  const { t } = useI18n()
  const modes = useModes(zone)
  const { actions } = useSystem()
  const side = useSideRest(Boolean(zone))
  if (!zone) return <Empty icon={<G.Speaker size={48} />} title={t('desk.browse.selectRoom')} />
  const tr = zone.transport || {}
  const inUse = ((tr.source === 'queue' && !isConnectSession(tr)) || tr.source === 'external_session') && tr.state !== 'STOPPED'
  const n = inUse ? (tr.track_number || 0) : 0
  const now = n ? queue.items[n - 1] : null
  // The mode a queue waits with while something else is the room's source.
  const held = !modes.canShuffle && queue.items.length > 0 ? (tr.queue_play_mode || '') : ''
  const heldShuffled = held.startsWith('SHUFFLE')
  return (
    <div className="km-queue">
      <aside className="km-queue-side km-pane" ref={side}>
        <h2 className="km-pane-title">{t('desk.now.title')}</h2>
        <div className="km-pane-body">
          <div className="km-queue-now">
            <span className="km-art km-queue-art">
              {now ? <Art src={now.art} size={200} fallback="track" /> : <G.Queue size={64} />}
              {now && <span className="km-songno">{pad(n)}</span>}
            </span>
            <p className="km-queue-title">{now ? now.title : t('desk.now.noMusic')}</p>
            {now?.artist && <p className="km-queue-artist">{now.artist}</p>}
          </div>
          <p className="km-queue-count">{queueSummary(t, zone, queue)}</p>
          <div className="km-queue-keys">
            <QueueActions zone={zone} queue={queue} onMessage={onMessage} onEdited={onEdited} onLoad={onLoad} listZone={listZone} />
          </div>
        </div>
      </aside>
      <section className="km-queue-book" aria-label={t('desk.queue.title')}>
        <div className="km-queue-order">
          <h2 className="km-queue-room">{room}</h2>
          <Toggle label={<><span className="km-say-long">{t('km.randomOrder')}</span><span className="km-say-short">{t('km.randomShort')}</span></>} checked={held ? heldShuffled : modes.shuffled} disabled={!modes.canShuffle && !held}
                  onChange={held ? () => actions.setPlayMode(zone.uuid, heldShuffled ? withoutShuffle(held) : withShuffle(held), { held: true })
                    : modes.toggleShuffle} />
        </div>
        {queue.items.length > 0 && (
          <div className="km-qhead" aria-hidden="true">
            <span className="km-qhead-n">{t('km.songNumber')}</span>
            <span className="km-qhead-song">{t('desk.now.songLabel')}</span>
            <span className="km-qhead-artist">{t('desk.now.artist')}</span>
          </div>
        )}
        <QueueList zone={zone} queue={queue} onInfo={onInfo} onEdited={onEdited} onPlay={onPlay} />
      </section>
    </div>
  )
}
