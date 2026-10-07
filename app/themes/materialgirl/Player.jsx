import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { formatDuration } from '../../frontend/src/lib/format.js'
import { useElapsed } from '../../frontend/src/lib/useElapsed.js'
import { nowPlayingArt, cachedArt } from '../../frontend/src/components/Art.jsx'
import { isLarge } from './layout.js'
import * as I from './icons.jsx'
import { IconButton, ButtonGroup, Slider, Chip, Segmented, ShapeArt, Menu, MenuItem, cx } from './m3.jsx'
import { SHAPES, KIND_SHAPES } from './shapes.js'
import { canSkip, canNext, canPrevious, isLoaded, nextTransport, togglePlay, nowSummary, nowLines, useProviderMetadata, groupTitle, readStored, writeStored } from './data.js'
import { QueueList, QueueActions, queueSummary } from './Queue.jsx'
import { useOptimisticRatings } from '../../frontend/src/lib/optimisticRatings.js'
import { useSeekDrag } from '../../frontend/src/lib/useSeekDrag.js'
import { isConnectSession } from '../../frontend/src/lib/transport.js'

// The music in the room in view, twice over: a floating toolbar at the foot
// of every page, and the full player it opens into. The player's surface is
// tinted from the cover (the scheme's hue follows it), the cover wears a
// scalloped cookie that softens into a squircle when the music stops, and the
// progress line waves while the music plays and lies flat when it does not.

function hms(seconds) {
  const total = Math.floor(seconds)
  const pad = (n) => String(n).padStart(2, '0')
  return `${Math.floor(total / 3600)}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`
}
function withShuffle(mode) {
  if (mode.includes('REPEAT_ONE')) return 'SHUFFLE_REPEAT_ONE'
  if (mode.includes('REPEAT_ALL')) return 'SHUFFLE'
  return 'SHUFFLE_NOREPEAT'
}
function withoutShuffle(mode) {
  if (mode === 'SHUFFLE_REPEAT_ONE') return 'REPEAT_ONE'
  if (mode === 'SHUFFLE') return 'REPEAT_ALL'
  return 'NORMAL'
}

// The play button: a filled shape that is a slowly turning cookie while the
// music plays and a squircle while it waits, morphing between the two.
// A service's rating glyph sits small in the middle of a larger image (AccuRadio's star is 16px
// of a 40x32 PNG), which at button size left it a few pixels across. Where the glyph's ink lies
// is read once per image, and the stencil is scaled so that ink fills the glyph's box. The
// image's own opacity is kept: a service may tell selected from not by it alone.
const GLYPH_BOXES = new Map()
function useGlyphBox(url) {
  const [box, setBox] = useState(() => GLYPH_BOXES.get(url) || null)
  useEffect(() => {
    if (!url || GLYPH_BOXES.has(url)) { setBox(GLYPH_BOXES.get(url) || null); return undefined }
    let live = true
    const img = new Image()
    img.onload = () => {
      try {
        const c = document.createElement('canvas')
        c.width = img.naturalWidth; c.height = img.naturalHeight
        const g = c.getContext('2d'); g.drawImage(img, 0, 0)
        const { data } = g.getImageData(0, 0, c.width, c.height)
        let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1
        for (let y = 0; y < c.height; y += 1) {
          for (let x = 0; x < c.width; x += 1) {
            if (data[(y * c.width + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y) }
          }
        }
        const found = x1 < 0 ? null : { w: c.width, h: c.height, x0, y0, iw: x1 - x0 + 1, ih: y1 - y0 + 1 }
        GLYPH_BOXES.set(url, found)
        if (live) setBox(found)
      } catch { GLYPH_BOXES.set(url, null) }
    }
    img.src = url
    return () => { live = false }
  }, [url])
  return box
}

function RatingGlyph({ icon, size = 22 }) {
  const url = cachedArt(icon)
  const box = useGlyphBox(url)
  const style = { '--mg-rating-icon': `url("${url}")` }
  if (box) {
    const k = size / Math.max(box.iw, box.ih)
    style['--mg-rating-size'] = `${box.w * k}px ${box.h * k}px`
    style['--mg-rating-pos'] = `${size / 2 - (box.x0 + box.iw / 2) * k}px ${size / 2 - (box.y0 + box.ih / 2) * k}px`
  }
  return <span className="mg-rating-img" aria-hidden="true" style={style} />
}

export function PlayButton({ zone, size = 'm', className = '' }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const tr = zone?.transport || {}
  const what = nextTransport(tr)
  const loaded = isLoaded(tr)
  const playing = tr.state === 'PLAYING' || tr.state === 'TRANSITIONING'
  const label = !zone ? '' : !loaded ? t('common.nothingQueued') : what === 'play' ? t('common.play') : what === 'stop' ? t('common.stop') : t('common.pause')
  return (
    <button type="button" className={cx('mg-play', `mg-play-${size}`, className)} data-playing={playing || undefined}
            title={label} aria-label={label} disabled={!zone || !loaded} onClick={() => togglePlay(actions, zone)}>
      <span className="mg-play-shape" aria-hidden="true" />
      <span className="mg-play-icon"><I.PlayMorph what={what} /></span>
    </button>
  )
}

export function Transport({ zone, size = 'm', steps = false }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const tr = zone?.transport || {}
  const skip = canSkip(tr)
  const { duration, elapsed } = useElapsed(tr)
  const seekable = Boolean(duration) && tr.can_seek !== false && skip
  const seekBy = (delta) => actions.seek(zone.uuid, hms(Math.max(0, Math.min(duration, elapsed + delta))))
  const icon = size === 'l' ? 'm' : 's'
  return (
    <ButtonGroup className={cx('mg-transport', `mg-transport-${size}`)} label={t('desk.now.title')}>
      {steps && <IconButton size={icon} variant="tonal" width="narrow" label={t('desk.transport.back30')} disabled={!seekable} onClick={() => seekBy(-30)}><span className="mg-step">−30</span></IconButton>}
      <IconButton size={icon} variant="tonal" width="wide" label={t('common.previous')} disabled={!canPrevious(tr)} onClick={() => actions.previous(zone.uuid)}><I.Prev /></IconButton>
      <PlayButton zone={zone} size={size} />
      <IconButton size={icon} variant="tonal" width="wide" label={t('common.next')} disabled={!canNext(tr)} onClick={() => actions.next(zone.uuid)}><I.Next /></IconButton>
      {steps && <IconButton size={icon} variant="tonal" width="narrow" label={t('desk.transport.forward30')} disabled={!seekable} onClick={() => seekBy(30)}><span className="mg-step">+30</span></IconButton>}
    </ButtonGroup>
  )
}

// Shuffle, repeat and crossfade as a connected group of toggles.
export function Modes({ zone, size = 's' }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const tr = zone?.transport || {}
  const mode = tr.play_mode ?? 'NORMAL'
  const shuffled = mode.startsWith('SHUFFLE')
  const repeat = mode.includes('REPEAT_ONE') ? 'one' : mode.includes('REPEAT_ALL') || mode === 'SHUFFLE' ? 'all' : 'off'
  // Shuffle and Repeat go where the speaker says it takes them;
  // before it has said, a queue.
  const modes = Boolean(zone) && (typeof tr.can_shuffle === 'boolean' ? tr.can_shuffle : tr.source === 'queue')
  const repeatOk = Boolean(zone) && (typeof tr.can_shuffle === 'boolean' ? tr.can_repeat : tr.source === 'queue')
  const crossfadeOk = Boolean(zone) && (typeof tr.can_crossfade === 'boolean' ? tr.can_crossfade
    : !['idle', 'tv', 'line_in', 'radio', 'service_stream', 'service_hls', 'grouped', 'unknown'].includes(tr.source))
  const cycleRepeat = () => {
    const base = repeat === 'off' ? 'REPEAT_ALL' : repeat === 'all' ? 'REPEAT_ONE' : 'NORMAL'
    actions.setPlayMode(zone.uuid, shuffled ? withShuffle(base) : base)
  }
  return (
    <ButtonGroup connected className="mg-modes" label={t('mg.playModes')}>
      <IconButton size={size} variant="toggle" label={t('common.shuffle')} selected={shuffled} disabled={!modes}
                  onClick={() => actions.setPlayMode(zone.uuid, shuffled ? withoutShuffle(mode) : withShuffle(mode))}><I.Shuffle /></IconButton>
      <IconButton size={size} variant="toggle" selected={repeat !== 'off'} disabled={!repeatOk} onClick={cycleRepeat}
                  label={repeat === 'one' ? t('desk.transport.repeatOne') : repeat === 'all' ? t('desk.transport.repeatAll') : t('desk.transport.repeatOff')}>
        {repeat === 'one' ? <I.RepeatOne /> : <I.Repeat />}
      </IconButton>
      <IconButton size={size} variant="toggle" label={t('desk.transport.crossfade')} selected={Boolean(tr.crossfade)} disabled={!crossfadeOk}
                  onClick={() => actions.setCrossfade(zone.uuid, !tr.crossfade)}><I.Crossfade /></IconButton>
    </ButtonGroup>
  )
}

// The wavy progress indicator, which also seeks. Inert where the track
// refuses Seek; a live stream shows no length and a still line.
// The played part of the seek bar is one long wave, drawn once per size and clipped to however far
// the track has got. Flat, it is the same path with every curve's control point on the center line,
// so the browser can tween one into the other: the wave grows and flattens the way Android's media
// seek bar does (mg.css). It used to be squashed to a thousandth of its height with a stroke that
// would not scale, which left the played part of a paused track invisible on a phone.
const WAVES = {}
function wavePath(thin, flat) {
  const key = `${thin ? 'thin' : 'full'}${flat ? '-flat' : ''}`
  if (!WAVES[key]) {
    const length = thin ? 26 : 40, cy = thin ? 4 : 6, peak = flat ? 0 : thin ? 2.4 : 4.8
    let d = `M${-length} ${cy}`
    for (let x = -length; x < 4000; x += length) {
      d += ` Q${x + length / 4} ${cy - peak} ${x + length / 2} ${cy} Q${x + (3 * length) / 4} ${cy + peak} ${x + length} ${cy}`
    }
    WAVES[key] = `path("${d}")`
  }
  return WAVES[key]
}

export function WavySeek({ zone, remaining = false, thin = false }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const tr = zone?.transport || {}
  const { elapsed, duration, live } = useElapsed(tr)
  const seekable = Boolean(duration) && !live && tr.can_seek !== false && tr.state !== 'STOPPED'
  const { drag, inputProps } = useSeekDrag(zone?.uuid, (at) => actions.seek(zone.uuid, hms(at)))
  const shown = drag ?? elapsed
  const pct = duration ? Math.max(0, Math.min(100, (shown / duration) * 100)) : (live && tr.state === 'PLAYING' ? 100 : 0)
  const playing = tr.state === 'PLAYING'
  return (
    <div className={cx('mg-wavy', thin && 'mg-wavy-thin')} data-playing={playing || undefined} data-seekable={seekable || undefined} data-dragging={drag != null || undefined}
         style={{ '--mg-pct': pct }}>
      {!thin && <time className="mg-wavy-time">{duration ? formatDuration(shown) : (live && isLoaded(tr) ? t('common.live') : '')}</time>}
      <div className="mg-wavy-track">
        <span className="mg-wavy-done" aria-hidden="true">
          <svg className="mg-wavy-svg"><g className="mg-wavy-phase"><path style={{ d: wavePath(thin, !playing || drag != null) }} /></g></svg>
        </span>
        <span className="mg-wavy-rest" aria-hidden="true" />
        {seekable && <span className="mg-wavy-handle" aria-hidden="true" />}
        <input type="range" min={0} max={duration || 1} value={Math.min(shown, duration || 1)} disabled={!seekable} aria-label={t('common.seek')}
               {...inputProps} />
      </div>
      {!thin && <time className="mg-wavy-time mg-wavy-end">{duration ? (remaining ? `-${formatDuration(Math.max(0, duration - shown))}` : formatDuration(duration)) : ''}</time>}
    </div>
  )
}

// Every room of the group with its own slider, and the group's above them.
export function Volumes({ zone, group, zones, size = 'm' }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  if (!zone) return null
  const members = (group?.members || [zone.uuid]).map((u) => zones[u]).filter(Boolean)
  const volIcon = (level, muted) => (muted ? <I.Muted /> : level < 40 ? <I.VolumeLow /> : <I.Volume />)
  return (
    <div className="mg-volumes">
      {members.length > 1 && (
        <div className="mg-vol mg-vol-group">
          <span className="mg-vol-name">{t('desk.transport.groupVolume')}</span>
          <div className="mg-vol-row">
            <IconButton variant="toggle" selected={zone.group_muted} label={zone.group_muted ? t('common.unmute') : t('common.mute')}
                        onClick={() => actions.setMute(zone.uuid, !zone.group_muted, true)}>{volIcon(zone.group_volume ?? 0, zone.group_muted)}</IconButton>
            <Slider wheelStep={2} size={size} value={zone.group_volume ?? 0} label={t('desk.transport.groupVolume')} onCommit={(level) => actions.setGroupVolume(zone.uuid, level)} />
          </div>
        </div>
      )}
      {members.map((m) => (
        <div key={m.uuid} className="mg-vol" data-offline={m.online === false || undefined}>
          <span className="mg-vol-name">{m.name}</span>
          <div className="mg-vol-row">
            <IconButton variant="toggle" selected={m.muted} label={m.muted ? t('common.unmute') : t('common.mute')}
                        onClick={() => actions.setMute(m.uuid, !m.muted)}>{volIcon(m.volume ?? 0, m.muted)}</IconButton>
            <Slider wheelStep={2} size={members.length > 1 ? 'xs' : size} value={m.volume ?? 0} label={m.name} onCommit={(level) => actions.setVolume(m.uuid, level)} />
          </div>
        </div>
      ))}
    </div>
  )
}

// One volume for whatever is playing, under the transport on a phone: the group's when rooms are
// grouped, the room's own otherwise. The per-room sliders stay in the Rooms tab below. Without it
// the only volume on a phone was inside that tab, and on a short screen the tab had no room to
// show it.
function MainVolume({ zone, group, zones }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const row = useRef(null)
  const members = zone ? (group?.members || [zone.uuid]).map((u) => zones[u]).filter(Boolean) : []
  const grouped = members.length > 1
  useEffect(() => {
    if (!open) return undefined
    // A press on the volume row itself keeps the popover, as the Windows app's does.
    const close = (event) => { if (row.current && !row.current.contains(event.target)) setOpen(false) }
    const key = (event) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', key) }
  }, [open])
  useEffect(() => { if (!grouped) setOpen(false) }, [grouped])
  if (!zone) return null
  const level = (grouped ? zone.group_volume : zone.volume) ?? 0
  const muted = grouped ? zone.group_muted : zone.muted
  const label = grouped ? t('desk.transport.groupVolume') : zone.name
  const volIcon = (v, m) => (m ? <I.Muted /> : v < 40 ? <I.VolumeLow /> : <I.Volume />)
  return (
    <div className="mg-vol-row mg-player-volume" ref={row}>
      {/* Grouped, the first touch on the slider opens each room's volume above it, as the Windows
          app's group volume does, and the drag carries on moving the whole group while each room's
          level follows in the popover. */}
      {open && grouped && (
        <div className="mg-volume-pop" role="dialog" aria-label={t('desk.transport.groupVolume')}>
          {members.map((m) => (
            <div key={m.uuid} className="mg-vol" data-offline={m.online === false || undefined}>
              <span className="mg-vol-name">{m.name}</span>
              <div className="mg-vol-row">
                <IconButton variant="toggle" selected={m.muted} label={m.muted ? t('common.unmute') : t('common.mute')}
                            onClick={() => actions.setMute(m.uuid, !m.muted)}>{volIcon(m.volume ?? 0, m.muted)}</IconButton>
                <Slider wheelStep={2} size="xs" value={m.volume ?? 0} label={m.name} onCommit={(v) => actions.setVolume(m.uuid, v)} />
              </div>
            </div>
          ))}
        </div>
      )}
      <IconButton variant="toggle" selected={muted} label={muted ? t('common.unmute') : t('common.mute')}
                  onClick={() => actions.setMute(zone.uuid, !muted, grouped)}>
        {volIcon(level, muted)}
      </IconButton>
      <span className="mg-player-volume-slider" onPointerDownCapture={() => { if (grouped) setOpen(true) }}>
        <Slider wheelStep={2} size="s" value={level} label={label}
                onCommit={(next) => (grouped ? actions.setGroupVolume(zone.uuid, next) : actions.setVolume(zone.uuid, next))} />
      </span>
    </div>
  )
}

// --- the floating toolbar -------------------------------------------------------------

export function NowToolbar({ zone, group, zones, compact, onOpen, onQueue, queueOpen, queueCount = 0, onGroup, onInfo }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const tr = zone?.transport || {}
  const summary = nowSummary(tr, t)
  const loaded = isLoaded(tr)
  const title = zone ? (summary.title || (loaded ? '' : t('desk.now.noMusic'))) : t('desk.browse.selectRoom')
  const art = zone && tr.source !== 'tv' ? nowPlayingArt(zone.host, tr) : ''
  const station = /^x-sonosapi-(radio|stream|hls):/.test(tr.media_uri || '')
  const showInfo = zone && loaded && (tr.source === 'queue' || station || tr.service_id)
  const playing = tr.state === 'PLAYING'
  const [volOpen, setVolOpen] = useState(null)
  const grouped = Boolean(group && group.members.length > 1)
  return (
    <section className="mg-toolbar" aria-label={t('desk.now.title')} data-playing={playing || undefined}>
      <button type="button" className="mg-toolbar-id" onClick={(event) => { rememberOrigin(event.currentTarget.closest('.mg-toolbar')); onOpen() }} disabled={!zone} title={t('mg.openPlayer')}>
        {/* The big player's shape (cookie12) at this size: the two players are one thing, so they
            share a silhouette. Each keeps the motion its size can carry: a slow turn here, where
            the big player's breath would move a pixel, and a breath there, where a turn is busy. */}
        <ShapeArt src={art} shape={playing ? SHAPES.cookie12 : SHAPES.squircle} size={compact ? 44 : 48} fallback="note" className="mg-toolbar-art" spin={playing} />
        <span className="mg-toolbar-text">
          <span className="mg-toolbar-title">{title}</span>
          <span className="mg-toolbar-sub">{zone ? [groupTitle(group, zones, t), summary.sub].filter(Boolean).join(' · ') : ''}</span>
        </span>
      </button>
      {compact ? (
        <div className="mg-toolbar-actions">
          <PlayButton zone={zone} size="s" />
          <IconButton label={t('common.next')} disabled={!canNext(tr)} onClick={() => actions.next(zone.uuid)}><I.Next /></IconButton>
        </div>
      ) : (
        <>
          <div className="mg-toolbar-transport">
            <IconButton label={t('common.previous')} disabled={!canPrevious(tr)} onClick={() => actions.previous(zone.uuid)}><I.Prev /></IconButton>
            <PlayButton zone={zone} size="s" />
            <IconButton label={t('common.next')} disabled={!canNext(tr)} onClick={() => actions.next(zone.uuid)}><I.Next /></IconButton>
          </div>
          <div className="mg-toolbar-seek"><WavySeek zone={zone} thin /></div>
          <div className="mg-toolbar-actions">
            {showInfo && <IconButton label={t('desk.now.infoOptions')} onClick={onInfo}><I.Info /></IconButton>}
            {/* "Group Volume" only for a group; a room on its own has a volume. */}
            <IconButton label={grouped ? t('desk.transport.groupVolume') : t('win.mini.volume')} disabled={!zone} onClick={(event) => setVolOpen(volOpen ? null : event.currentTarget)}
                        selected={Boolean(volOpen)}>{zone?.group_muted ? <I.Muted /> : <I.Volume />}</IconButton>
            <IconButton label={t('desk.grouping.title')} disabled={!zone || group?.local} onClick={onGroup} badge={grouped ? group.members.length : null}><I.Group /></IconButton>
            <IconButton label={t('common.queue')} variant="toggle" selected={queueOpen} disabled={!zone} onClick={onQueue} badge={queueCount}><I.Queue /></IconButton>
            <IconButton label={t('mg.openPlayer')} variant="tonal" disabled={!zone} onClick={onOpen}><I.ChevronUp /></IconButton>
          </div>
        </>
      )}
      {volOpen && zone && (
        <Menu anchor={volOpen} align="right" width={320} onClose={() => setVolOpen(null)} title={groupTitle(group, zones, t)}>
          <div className="mg-menu-pad"><Volumes zone={zone} group={group} zones={zones} size="s" /></div>
        </Menu>
      )}
    </section>
  )
}

// --- the full player ---------------------------------------------------------------------

// Where the player was opened from: the mini player's box, taken as it is pressed (it is gone by
// the time the player mounts), as insets from the window for the container transform.
let origin = null
function rememberOrigin(el) {
  if (!el) { origin = null; return }
  const r = el.getBoundingClientRect()
  origin = { '--ct-t': `${Math.round(r.top)}px`, '--ct-r': `${Math.round(window.innerWidth - r.right)}px`,
             '--ct-b': `${Math.round(window.innerHeight - r.bottom)}px`, '--ct-l': `${Math.round(r.left)}px` }
}
function takeOrigin() { const o = origin; origin = null; return o }

export function PlayerView({ zone, group, zones, groups = [], onSelect, queue, compact, size, onClose, onInfo, onMessage, onGroup, onSleep, sleepOn, onQueueEdited, onQueueItemInfo }) {
  // A container transform: the player grows out of the mini player at the foot of the window, the
  // persistent container between the two, and shrinks back into it when closed (motion:
  // transitions, Container transform). `from` is the mini player's box as insets from the window.
  const [from] = useState(() => takeOrigin())
  const [closing, setClosing] = useState(false)
  const close = () => {
    if (closing) return
    if (!from) { onClose(); return }
    setClosing(true)
    setTimeout(onClose, 280)
  }
  const { actions } = useSystem()
  const { t } = useI18n()
  const tr = zone?.transport || {}
  const { provider, refresh } = useProviderMetadata(zone)
  const lines = nowLines(tr, provider, t)
  const loaded = isLoaded(tr)
  const playing = tr.state === 'PLAYING' || tr.state === 'TRANSITIONING'
  const art = zone && tr.source !== 'tv' ? nowPlayingArt(zone.host, tr) : ''
  const artUrl = Array.isArray(art) ? art[0] : art
  // A Spotify Connect session plays Spotify's own queue, which no controller
  // can list: the room's queue is not what plays, and the coming track is the
  // one the speaker reports. Every theme answers it this way.
  const nextTrack = isConnectSession(tr) ? (tr.next_title ? { title: tr.next_title, artist: tr.next_artist } : null)
    : tr.source === 'queue' ? queue.items[(tr.track_number || 0)] : null
  const wide = size === 'expanded' || isLarge(size)
  const [tab, setTab] = useState('queue')
  // The Up next / Rooms column can be put away for the cover alone, and stays as it was left.
  // A phone keeps its own button for the queue.
  const [sideShown, setSideShown] = useState(() => readStored('sonora.mg.playerSide', '1') !== '0')
  const toggleSide = () => setSideShown((v) => { writeStored('sonora.mg.playerSide', v ? '0' : '1'); return !v })
  // On a phone the two lists open upward from buttons at the foot, over the player, so the player
  // itself fits the screen and never scrolls. null is both closed.
  const [drawer, setDrawer] = useState(null)
  const [roomMenu, setRoomMenu] = useState(null)

  // Ratings: the service's own buttons from its presentation map.
  const serviceRatings = (provider?.ratings || []).filter((b) => b.icon)
  const ratedItem = tr.item_id || (() => {
    const m = /^x-sonos-http:([^?]+?)(?:\.[a-z0-9]+)?\?/i.exec(tr.track_uri || '')
    try { return m ? decodeURIComponent(m[1]) : '' } catch { return '' }
  })()
  const rateById = async (button) => {
    // A lit button the service gives no way back from does nothing (see
    // rating_is_inert in backend/main.py: AccuRadio's loved star).
    if (button.inert) return
    const item = provider?.item_id || ratedItem
    if (!item) return
    const result = await actions.rateItemById(zone.uuid, tr.service_id, item, button.id)
    if (result?.ok) { onMessage?.(result.message || button.message || ''); refresh() }
    return result?.ok
  }
  // A toggle is drawn pressed at the press (lib/optimisticRatings.js).
  const { ratings: shownRatings, press: pressRating } = useOptimisticRatings(serviceRatings, `${zone?.uuid}|${tr.track_uri || ''}`)
  // A room can hold a source and still have nothing to say about it: one kept a Spotify Connect
  // address with no title, artist or album once the session ended, and the player read the first
  // line of none. It then reads as a room with no music.
  const shown = loaded && lines.length > 0
  const [title, ...rest] = shown ? lines : [[t('desk.now.noMusic'), t('desk.now.noMusic')]]
  const artShape = playing ? SHAPES.cookie12 : KIND_SHAPES.room
  const panelFor = (which) => (which === 'queue' ? (
    <>
      {/* The queue's length, and Save and Clear for the whole of it, as the queue sheet has. */}
      <div className="mg-player-queue-head">
        <span>{queueSummary(t, zone, queue)}</span>
        <QueueActions zone={zone} queue={queue} onMessage={onMessage} onEdited={onQueueEdited} />
      </div>
      <div className="mg-player-queue">
        <QueueList zone={zone} queue={queue} onInfo={onQueueItemInfo} onEdited={onQueueEdited} dense />
      </div>
    </>
  ) : (
    <div className="mg-player-rooms">
      <Volumes zone={zone} group={group} zones={zones} size="m" />
      {!group?.local && <Chip kind="assist" icon={<I.Group />} onClick={onGroup}>{t('desk.grouping.title')}</Chip>}
    </div>
  ))
  const panels = [{ id: 'queue', label: t('mg.upNext'), icon: <I.Queue /> }, { id: 'rooms', label: t('desk.rooms.title'), icon: <I.Rooms /> }]
  const [lateral, setLateral] = useState('')
  const changeTab = (next) => {
    const at = (id) => panels.findIndex((option) => option.id === id)
    setLateral(at(next) > at(tab) ? 'next' : 'prev')
    setTab(next)
  }
  // Wide, the column stays in the page while it is put away, so it can leave and come back as a
  // supporting pane does in M3's adaptive layouts: it opens from the trailing edge, its contents
  // sliding in, while the cover's pane takes or gives back the room (mg.css). Inert while away.
  const side = wide ? (
    <section className="mg-player-side" aria-label={t('mg.upNextAndRooms')} data-away={!sideShown || undefined} inert={!sideShown}>
      <div className="mg-player-side-inner">
        <Segmented options={panels} value={tab} onChange={changeTab} label={t('mg.upNextAndRooms')} />
        {/* Up next and Rooms are peers: the new one slides in from its side, no fade (motion:
            transitions, Lateral). */}
        <div className="mg-player-panel" key={tab} data-lateral={lateral || undefined}>{panelFor(tab)}</div>
      </div>
    </section>
  ) : (
    <section className="mg-player-drawer" aria-label={t('mg.upNextAndRooms')}>
      {drawer && <div className="mg-player-drawer-scrim" aria-hidden="true" onClick={() => setDrawer(null)} />}
      {drawer && <div className="mg-player-drawer-panel" id="mg-player-drawer-panel">{panelFor(drawer)}</div>}
      <div className="mg-seg mg-player-drawer-keys" role="group" aria-label={t('mg.upNextAndRooms')}>
        {panels.filter((option) => option.id === 'queue').map((option) => (
          <button key={option.id} type="button" aria-expanded={drawer === option.id} aria-controls="mg-player-drawer-panel"
                  aria-checked={drawer === option.id} onClick={() => setDrawer(drawer === option.id ? null : option.id)}>
            <span className="mg-state" aria-hidden="true" />
            {drawer === option.id ? <I.ChevronDown /> : option.icon}
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    </section>
  )
  return createPortal(
    <div className={cx('mg-player', wide && 'mg-player-wide')} role="dialog" aria-modal="true" aria-label={t('desk.now.title')}
         style={from || undefined} data-transform={from ? (closing ? 'out' : 'in') : undefined}
         data-playing={playing || undefined}
         onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); close() } }}>
      <div className="mg-player-glow" style={artUrl ? { backgroundImage: `url("${artUrl}")` } : undefined} aria-hidden="true" />
      <header className="mg-player-bar">
        <IconButton label={t('mg.closePlayer')} onClick={close} data-autofocus autoFocus><I.ChevronDown /></IconButton>
        {/* The room in view, and a menu of the others to switch to. Grouping is
            the Rooms pane's job, so the pill no longer opens it. */}
        <button type="button" className="mg-room-pill" aria-haspopup="menu" aria-expanded={Boolean(roomMenu)}
                onClick={(event) => setRoomMenu(roomMenu ? null : event.currentTarget)}>
          <span className="mg-state" aria-hidden="true" /><I.Speaker /><span>{groupTitle(group, zones, t)}</span><I.ChevronDown />
        </button>
        {roomMenu && (
          <Menu anchor={roomMenu} onClose={() => setRoomMenu(null)} title={t('desk.rooms.title')}>
            {groups.map((g) => (
              <MenuItem key={g.id} icon={<I.Speaker />} checked={g.coordinator === group?.coordinator}
                        note={nowSummary(zones[g.coordinator]?.transport, t).title || ''}
                        onSelect={() => { setRoomMenu(null); onSelect?.(g.coordinator) }}>
                {groupTitle(g, zones, t)}
              </MenuItem>
            ))}
          </Menu>
        )}
        <span className="mg-player-source">{tr.service_name || (tr.source ? t(`source.${tr.source}`) : '')}</span>
        <IconButton label={t('desk.browse.sleepTimer')} variant="toggle" selected={sleepOn} onClick={onSleep}><I.Moon /></IconButton>
        {wide && <IconButton label={t('mg.upNextAndRooms')} variant="toggle" selected={sideShown} onClick={toggleSide}><I.Queue /></IconButton>}
        {loaded && (tr.source === 'queue' || tr.service_id) && <IconButton label={t('desk.now.infoOptions')} onClick={onInfo}><I.Info /></IconButton>}
      </header>
      <div className="mg-player-body">
        <section className="mg-player-main">
          <div className="mg-player-art">
            {tr.source === 'tv'
              ? <span className="mg-player-tv" style={{ clipPath: SHAPES.squircle }}><I.Tv /></span>
              : <ShapeArt src={art} shape={artShape} size={compact ? 300 : 420} fallback="note" className="mg-player-cover" />}
          </div>
          <div className="mg-player-lines">
            {shown && <p className="mg-player-over">{title[0]}</p>}
            <h1 className="mg-player-title">
              {title[1]}
              {loaded && tr.explicit === true && <I.Explicit className="mg-explicit" role="img" aria-label={t('common.explicit')} />}
            </h1>
            {rest.map(([caption, value]) => (
              <p key={caption} className="mg-player-line"><span>{caption}</span>{value}</p>
            ))}
            {nextTrack && (
              <p className="mg-player-line mg-player-next"><span>{t('desk.now.next')}</span>{[nextTrack.title, nextTrack.artist].filter(Boolean).join(' · ')}</p>
            )}
            {loaded && serviceRatings.length > 0 && (
              <div className="mg-player-ratings">
                {shownRatings.map((button) => (
                  <IconButton key={button.id} variant="tonal" aria-disabled={button.inert || undefined} onClick={() => pressRating(button, rateById)}
                              label={button.inert ? t('rating.cannotUndo', { service: tr.service_name || '' }) : (button.label || '')}>
                    <RatingGlyph icon={button.icon} />
                  </IconButton>
                ))}
              </div>
            )}
          </div>
          <div className="mg-player-controls">
            <WavySeek zone={zone} />
            <div className="mg-player-buttons">
              <Modes zone={zone} size={compact ? 's' : 'm'} />
              <Transport zone={zone} size="l" steps={!compact} />
            </div>
            {/* The volume has a line of its own under the transport, wide or not. */}
            <MainVolume zone={zone} group={group} zones={zones} />
          </div>
          {!wide && side}
        </section>
        {wide && side}
      </div>
    </div>,
    document.body,
  )
}
