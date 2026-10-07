import React, { useEffect, useRef, useState } from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { formatDuration } from '../../frontend/src/lib/format.js'
import Art, { nowPlayingArt } from '../../frontend/src/components/Art.jsx'
import * as I from './icons.jsx'
import { IconButton, Slider, Menu, useDismiss } from './ui.jsx'
import { canSkip, canNext, canPrevious, isLoaded, nextTransport, togglePlay, nowSummary, groupTitle } from './house.js'
import { useElapsed } from '../../frontend/src/lib/useElapsed.js'
import { useSeekDrag } from '../../frontend/src/lib/useSeekDrag.js'

// The bar along the bottom: what the room in view plays, the transport, the
// position, the group's volume and the doors to the queue, the rooms and the
// stage. Its pieces are exported so the stage can lay the same controls out
// at a larger size.

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

// The position, counted locally between the speaker's reports (lib/useElapsed.js).
export { useElapsed }

export function TransportControls({ zone, size = 'md', showSeekSteps = false }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const tr = zone?.transport || {}
  const what = nextTransport(tr)
  const loaded = isLoaded(tr)
  const skip = canSkip(tr)
  const { duration, elapsed } = useElapsed(tr)
  const seekable = Boolean(duration) && tr.can_seek !== false && skip
  const seekBy = (delta) => actions.seek(zone.uuid, hms(Math.max(0, Math.min(duration, elapsed + delta))))
  const label = !zone ? '' : !loaded ? t('common.nothingQueued') : what === 'play' ? t('common.play') : what === 'stop' ? t('common.stop') : t('common.pause')
  return (
    <div className={`sf-transport sf-transport-${size}`}>
      {showSeekSteps && (
        <IconButton label={t('desk.transport.back30')} disabled={!seekable} onClick={() => seekBy(-30)} size="sm">
          <span className="sf-step">-30</span>
        </IconButton>
      )}
      <IconButton label={t('common.previous')} disabled={!canPrevious(tr)} onClick={() => actions.previous(zone.uuid)}><I.Prev /></IconButton>
      <button type="button" className="sf-play" title={label} aria-label={label} disabled={!zone || !loaded}
              onClick={() => togglePlay(actions, zone)}>
        {what === 'play' ? <I.Play /> : what === 'stop' ? <I.Stop /> : <I.Pause />}
      </button>
      <IconButton label={t('common.next')} disabled={!canNext(tr)} onClick={() => actions.next(zone.uuid)}><I.Next /></IconButton>
      {showSeekSteps && (
        <IconButton label={t('desk.transport.forward30')} disabled={!seekable} onClick={() => seekBy(30)} size="sm">
          <span className="sf-step">+30</span>
        </IconButton>
      )}
    </div>
  )
}

// The position bar. Inert when the track refuses Seek, as the speaker says in
// its transport actions; live streams show no length.
export function SeekBar({ zone, remaining = true }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const tr = zone?.transport || {}
  const { elapsed, duration, live } = useElapsed(tr)
  const seekable = Boolean(duration) && !live && tr.can_seek !== false && tr.state !== 'STOPPED'
  const { drag, inputProps } = useSeekDrag(zone?.uuid, (at) => actions.seek(zone.uuid, hms(at)))
  const shown = drag ?? elapsed
  const pct = duration ? Math.max(0, Math.min(100, (shown / duration) * 100)) : 0
  return (
    <div className="sf-seek" data-seekable={seekable || undefined} data-live={live || undefined}>
      <time className="sf-seek-time">{duration ? formatDuration(shown) : (live && isLoaded(tr) ? t('common.live') : '')}</time>
      <div className="sf-seek-track" style={{ '--sf-pct': `${pct}%` }}>
        <input type="range" min={0} max={duration || 1} value={Math.min(shown, duration || 1)} disabled={!seekable}
               aria-label={t('common.seek')}
               {...inputProps} />
      </div>
      <time className="sf-seek-time sf-seek-end">{duration ? (remaining ? `-${formatDuration(Math.max(0, duration - shown))}` : formatDuration(duration)) : ''}</time>
    </div>
  )
}

export function ModeToggles({ zone, size = 'sm' }) {
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
    <div className="sf-modes">
      <IconButton size={size} label={t('common.shuffle')} active={shuffled} disabled={!modes}
                  onClick={() => actions.setPlayMode(zone.uuid, shuffled ? withoutShuffle(mode) : withShuffle(mode))}><I.Shuffle /></IconButton>
      <IconButton size={size} active={repeat !== 'off'} disabled={!repeatOk} onClick={cycleRepeat}
                  label={repeat === 'one' ? t('desk.transport.repeatOne') : repeat === 'all' ? t('desk.transport.repeatAll') : t('desk.transport.repeatOff')}>
        {repeat === 'one' ? <I.RepeatOne /> : <I.Repeat />}
      </IconButton>
      <IconButton size={size} label={t('desk.transport.crossfade')} active={Boolean(tr.crossfade)} disabled={!crossfadeOk}
                  onClick={() => actions.setCrossfade(zone.uuid, !tr.crossfade)}><I.Crossfade /></IconButton>
    </div>
  )
}

// The group's volume with its mute, and every room's own when the group has
// more than one, in a popover from the caption.
export function VolumeControl({ zone, group, zones, compact = false }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const anchor = useRef(null)
  const grouped = Boolean(group && group.members.length > 1)
  useEffect(() => { setOpen(false) }, [group?.coordinator])
  if (!zone) return null
  const members = grouped ? group.members.map((u) => zones[u]).filter(Boolean) : []
  return (
    <div className={`sf-volume${compact ? ' sf-volume-compact' : ''}`}>
      <IconButton size="sm" label={zone.group_muted ? t('common.unmute') : t('common.mute')}
                  onClick={() => actions.setMute(zone.uuid, !zone.group_muted, true)}>
        {zone.group_muted ? <I.Muted /> : <I.Volume />}
      </IconButton>
      <Slider value={zone.group_volume ?? 0} label={grouped ? t('desk.transport.groupVolume') : zone.name}
              onCommit={(level) => actions.setGroupVolume(zone.uuid, level)} />
      {grouped && (
        <button type="button" className="sf-volume-rooms" ref={anchor} aria-expanded={open} title={t('desk.transport.groupVolume')}
                onClick={() => setOpen((v) => !v)}>
          <span>{members.length}</span><I.ChevronDown />
        </button>
      )}
      {open && grouped && (
        <Menu anchor={anchor.current} align="right" width={300} onClose={() => setOpen(false)} title={t('desk.transport.groupVolume')}>
          <div className="sf-volume-list">
            {members.map((m) => (
              <div key={m.uuid} className="sf-volume-row">
                <span className="sf-volume-name">{m.name}</span>
                <IconButton size="sm" label={m.muted ? t('common.unmute') : t('common.mute')}
                            onClick={() => actions.setMute(m.uuid, !m.muted)}>{m.muted ? <I.Muted /> : <I.Volume />}</IconButton>
                <Slider value={m.volume ?? 0} label={m.name} onCommit={(level) => actions.setVolume(m.uuid, level)} />
              </div>
            ))}
          </div>
        </Menu>
      )}
    </div>
  )
}

export default function NowBar({ zone, group, zones, onStage, onQueue, queueOpen, queueCount = 0, onRooms, onInfo, onSleep, sleepOn = false, onMini }) {
  const { t } = useI18n()
  const tr = zone?.transport || {}
  const summary = nowSummary(tr, t)
  const loaded = isLoaded(tr)
  const title = zone ? (summary.title || (loaded ? '' : t('desk.now.noMusic'))) : t('desk.browse.selectRoom')
  const art = zone && tr.source !== 'tv' ? nowPlayingArt(zone.host, tr) : ''
  const station = /^x-sonosapi-(radio|stream|hls):/.test(tr.media_uri || '')
  const showInfo = zone && loaded && (tr.source === 'queue' || station || tr.service_id)
  return (
    <footer className="sf-nowbar" aria-label={t('desk.now.title')}>
      <div className="sf-now-id">
        <button type="button" className="sf-now-art" onClick={onStage} title={t('sf.openStage')} disabled={!zone}>
          {tr.source === 'tv' ? <I.Tv /> : <Art src={art} size={56} fallback="note" />}
          <span className="sf-now-art-expand" aria-hidden="true"><I.Expand /></span>
        </button>
        <div className="sf-now-text">
          <p className="sf-now-title" title={title}>{title}</p>
          <p className="sf-now-sub" title={summary.sub}>
            {summary.sub || (tr.service_name ? tr.service_name : '')}
          </p>
        </div>
        {showInfo && (
          <IconButton size="sm" label={t('desk.now.infoOptions')} onClick={onInfo} className="sf-now-info"><I.Info /></IconButton>
        )}
      </div>
      <div className="sf-now-center">
        <div className="sf-now-controls">
          <ModeToggles zone={zone} />
          <TransportControls zone={zone} />
          <div className="sf-now-aux">
            <IconButton size="sm" label={t('desk.browse.sleepTimer')} active={sleepOn} onClick={onSleep} disabled={!zone}><I.Moon /></IconButton>
            <IconButton size="sm" label={t('win.menu.showMini')} onClick={onMini} disabled={!zone}><I.Collapse /></IconButton>
          </div>
        </div>
        <SeekBar zone={zone} />
      </div>
      <div className="sf-now-right">
        <button type="button" className="sf-room-chip" onClick={onRooms} title={t('desk.grouping.title')} disabled={!zone}>
          <I.Speaker />
          {/* Keyed on the room so a change remounts the label and replays its
              animation: nothing else in this bar moves when the bar is handed
              a different room. */}
          <span key={zone?.uuid || 'none'}>{zone ? groupTitle(group, zones, t) : t('desk.rooms.title')}</span>
        </button>
        <VolumeControl zone={zone} group={group} zones={zones} />
        <IconButton label={t('common.queue')} active={queueOpen} onClick={onQueue} badge={queueCount} disabled={!zone}><I.Queue /></IconButton>
      </div>
    </footer>
  )
}
