import React, { useEffect, useRef, useState } from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { formatDuration } from '../../frontend/src/lib/format.js'
import { useElapsed } from '../../frontend/src/lib/useElapsed.js'
import { clockText, durationSeconds } from '../../frontend/src/lib/useSleepTimer.js'
import Art, { nowPlayingArt, cachedArt } from '../../frontend/src/components/Art.jsx'
import { ratingGlyph } from '../../frontend/src/lib/ratingGlyph.js'
import { useOptimisticRatings } from '../../frontend/src/lib/optimisticRatings.js'
import * as G from './glyphs.jsx'
import { Unit, Display, Key, IconKey, Knob, Fader, Menu, MenuItem, Led, Select, SlideSwitch } from './controls.jsx'
import { canSkip, canNext, canPrevious, isLoaded, nextTransport, togglePlay, nowSummary, groupTitle, useProviderMetadata } from './house.js'
import { useSeekDrag } from '../../frontend/src/lib/useSeekDrag.js'
import { isConnectSession } from '../../frontend/src/lib/transport.js'

// The control amplifier: the unit at the top of the rack that everything
// else hangs off. A turntable whose record label is the cover of what plays,
// the display, the transport keys, the volume knob and the
// function selector that decides which component sits in the bay below.

export const FUNCTIONS = ['zones', 'tuner', 'tape', 'timer', 'setup']
export const FUNCTION_GLYPHS = { zones: G.Zones, tuner: G.Tuner, tape: G.Tape, timer: G.Timer, setup: G.Setup }

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
export function modesOf(tr) {
  const mode = tr?.play_mode ?? 'NORMAL'
  const shuffled = mode.startsWith('SHUFFLE')
  const repeat = mode.includes('REPEAT_ONE') ? 'one' : mode.includes('REPEAT_ALL') || mode === 'SHUFFLE' ? 'all' : 'off'
  return { mode, shuffled, repeat }
}
// Shuffle, Repeat and Crossfade are each what the speaker says it
// will take for what it plays (can_crossfade); the list stands in for a room
// that has not said, as This browser never does.
export function modesAllowed(zone) {
  const tr = zone?.transport || {}
  return {
    modes: Boolean(zone) && (typeof tr.can_shuffle === 'boolean' ? tr.can_shuffle : tr.source === 'queue'),
    repeat: Boolean(zone) && (typeof tr.can_repeat === 'boolean' ? tr.can_repeat : tr.source === 'queue'),
    crossfade: Boolean(zone) && (typeof tr.can_crossfade === 'boolean' ? tr.can_crossfade
    : !['idle', 'tv', 'line_in', 'radio', 'service_stream', 'service_hls', 'grouped', 'unknown'].includes(tr.source)),
  }
}
export function toggleShuffle(actions, zone) {
  const { mode, shuffled } = modesOf(zone.transport)
  actions.setPlayMode(zone.uuid, shuffled ? withoutShuffle(mode) : withShuffle(mode))
}
export function cycleRepeat(actions, zone) {
  const { shuffled, repeat } = modesOf(zone.transport)
  const base = repeat === 'off' ? 'REPEAT_ALL' : repeat === 'all' ? 'REPEAT_ONE' : 'NORMAL'
  actions.setPlayMode(zone.uuid, shuffled ? withShuffle(base) : base)
}

// The record on the platter turns while the room plays and stops when it
// does not; the arm swings onto it and off again. Both follow the transport
// and nothing else.
export function Turntable({ zone, onOpen, size = 'md' }) {
  const { t } = useI18n()
  const tr = zone?.transport || {}
  const spinning = tr.state === 'PLAYING' || tr.state === 'TRANSITIONING'
  const art = zone && tr.source !== 'tv' ? nowPlayingArt(zone.host, tr) : ''
  return (
    <button type="button" className={`hf-deck hf-deck-${size}`} onClick={onOpen} disabled={!zone}
            title={t('desk.now.infoOptions')} aria-label={t('desk.now.infoOptions')} data-spin={spinning || undefined}>
      <span className="hf-platter" aria-hidden="true">
        <span className="hf-record">
          <span className="hf-grooves" />
          <span className="hf-label">
            {tr.source === 'tv' ? <G.Tv /> : <Art src={art} size={size === 'lg' ? 180 : 96} fallback="note" />}
          </span>
          <span className="hf-spindle" />
        </span>
      </span>
      <span className="hf-arm" aria-hidden="true"><span className="hf-arm-rod" /><span className="hf-arm-head" /></span>
    </button>
  )
}

// A bar of lit segments across the display, and under it the range input
// that seeks. Inert where the track refuses to seek; a broadcast has no
// length, and says LIVE.
function PositionBar({ zone }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const tr = zone?.transport || {}
  const { elapsed, duration, live } = useElapsed(tr)
  const seekable = Boolean(duration) && !live && tr.can_seek !== false && tr.state !== 'STOPPED'
  const { drag, inputProps } = useSeekDrag(zone?.uuid, (at) => actions.seek(zone.uuid, hms(at)))
  const shown = drag ?? elapsed
  const frac = duration ? Math.max(0, Math.min(1, shown / duration)) : 0
  const SEGMENTS = 48
  const lit = Math.round(frac * SEGMENTS)
  return (
    <div className="hf-posbar" data-seekable={seekable || undefined}>
      <time className="hf-vfd-num">{duration ? formatDuration(shown) : (live && isLoaded(tr) ? t('common.live') : '--:--')}</time>
      <div className="hf-segments">
        <span className="hf-segments-row" aria-hidden="true">
          {Array.from({ length: SEGMENTS }, (_, i) => <i key={i} data-on={i < lit || undefined} />)}
        </span>
        <input type="range" min={0} max={duration || 1} value={Math.min(shown, duration || 1)} disabled={!seekable}
               aria-label={t('common.seek')} aria-valuetext={duration ? `${formatDuration(shown)} / ${formatDuration(duration)}` : ''}
               {...inputProps} />
      </div>
      <time className="hf-vfd-num">{duration ? `-${formatDuration(Math.max(0, duration - shown))}` : ''}</time>
    </div>
  )
}

// The line of annunciators under the text: each word lights when its mode is
// on, as the printed legends behind a display's glass do.
function Annunciators({ zone, sleepRemaining }) {
  const { t } = useI18n()
  const tr = zone?.transport || {}
  const { shuffled, repeat } = modesOf(tr)
  const state = tr.state === 'PLAYING' ? 'play' : tr.state === 'PAUSED_PLAYBACK' ? 'pause' : tr.state === 'TRANSITIONING' ? 'play' : 'stop'
  const words = [
    [state === 'play' ? <G.Play key="s" /> : state === 'pause' ? <G.Pause key="s" /> : <G.Stop key="s" />, Boolean(zone && isLoaded(tr)), 'state'],
    [t('hifi.ann.shuffle'), shuffled, 'shuffle'],
    [repeat === 'one' ? t('hifi.ann.repeatOne') : t('hifi.ann.repeat'), repeat !== 'off', 'repeat'],
    [t('hifi.ann.crossfade'), Boolean(tr.crossfade), 'crossfade'],
    [t('hifi.ann.sleep'), Boolean(sleepRemaining), 'sleep'],
  ]
  return (
    <p className="hf-annunciators">
      {words.map(([word, on, key]) => <span key={key} className="hf-ann" data-on={on || undefined}>{word}</span>)}
    </p>
  )
}

// The sleep timer's time left, counting down a second at a time between the
// reads of the speaker (every thirty seconds, or when a controller changes it).
function useCountdown(remaining) {
  const [left, setLeft] = useState(() => durationSeconds(remaining))
  useEffect(() => {
    const until = Date.now() + durationSeconds(remaining) * 1000
    const tick = () => setLeft(Math.max(0, Math.round((until - Date.now()) / 1000)))
    tick()
    if (!remaining) return undefined
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [remaining])
  return remaining ? left : 0
}

// The service's own reaction buttons for what is playing (Pandora's thumbs,
// Spotify's heart, AccuRadio's star and ban): keys on the face above the
// display, their row ending at the display's right edge.
// Each wears the glyph of the family Sonos names its icon after
// (a family Hi-Fi has no glyph for shows the service's picture), and a
// rating that is given or not, as a toggle, has its amber lamp lit while it
// is given. The service says what a press did, and that is the message.
const REACTIONS = { THUMBSUP: G.ThumbsUp, THUMBSDOWN: G.ThumbsDown, STAR: G.Star, HEART: G.Heart, PROHIBITED: G.Prohibit }

function Reactions({ zone, onMessage }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const { provider, refresh } = useProviderMetadata(zone)
  const tr = zone?.transport || {}
  // A toggle's lamp lights at the press (lib/optimisticRatings.js).
  const { ratings: buttons, press } = useOptimisticRatings((provider?.ratings || []).filter((b) => b.icon), `${zone?.uuid}|${tr.track_uri || ''}`)
  if (!zone || zone.local || !buttons.length || !isLoaded(tr)) return null
  // The item a rating is for: the service's own id when the metadata gave
  // one, else the one in the track's URI.
  const fromUri = (() => {
    const m = /^x-sonos-http:([^?]+?)(?:\.[a-z0-9]+)?\?/i.exec(tr.track_uri || '')
    try { return m ? decodeURIComponent(m[1]) : '' } catch { return '' }
  })()
  const rate = async (button) => {
    if (button.inert) return
    const item = provider?.item_id || tr.item_id || fromUri
    if (!item) return
    const result = await actions.rateItemById(zone.uuid, tr.service_id, item, button.id)
    if (result?.ok) { onMessage?.(result.message || button.message || ''); refresh() }
    return result?.ok
  }
  return (
    <div className="hf-reactions" role="group" aria-label={tr.service_name || undefined}>
      {buttons.map((button) => {
        const { family, selected } = ratingGlyph(button.icon)
        const Glyph = REACTIONS[family]
        // A toggle names its state in its icon (THUMBSUP_SELECTED and the
        // like). A button the service marks to always skip is an action, not
        // a toggle, whatever its icon: Pandora's thumbs-down moves straight to
        // the next song (AutoSkip ALWAYS in its presentation map), so it has
        // no state to light a lamp for.
        const toggle = /SELECTED/i.test(String(button.icon).split('/').pop()) && String(button.skip || '').toUpperCase() !== 'ALWAYS'
        return (
          <Key key={button.id} size="sm" className="hf-reaction" aria-disabled={button.inert || undefined}
               label={button.inert ? t('rating.cannotUndo', { service: tr.service_name || '' }) : (button.label || family.toLowerCase())}
               led={toggle ? selected : null} pressed={toggle ? selected : null} onClick={() => press(button, rate)}
               icon={Glyph ? <Glyph /> : <img src={cachedArt(button.icon)} alt="" className="hf-reaction-img" />} />
        )
      })}
    </div>
  )
}

export function MainDisplay({ zone, group, zones, groups, onSelect, sleepRemaining, compact = false }) {
  const { t } = useI18n()
  const tr = zone?.transport || {}
  const summary = nowSummary(tr, t)
  const loaded = isLoaded(tr)
  const [zoneMenu, setZoneMenu] = useState(null)
  const index = groups.findIndex((g) => g.coordinator === group?.coordinator)
  const step = (by) => {
    if (!groups.length) return
    const next = groups[(Math.max(0, index) + by + groups.length) % groups.length]
    if (next) onSelect(next.coordinator)
  }
  const sleepLeft = useCountdown(sleepRemaining)
  const STATIONS = ['service_track', 'service_radio', 'service_stream', 'service_hls', 'radio', 'http_stream']
  const book = tr.track_kind === 'audiobook' || tr.book || tr.narrator
  // A broadcast that says what is on (SomaFM's "Ms. John Soda - Number One")
  // reads as a station's song does: what is on is the display's title and
  // the station goes on the station line, rather than the station's name
  // standing as the title with the song beneath it. A broadcast that says
  // nothing, or one held stopped, keeps the station as its title.
  const onAir = zone && /^x-sonosapi-stream:/.test(tr.media_uri || '') && tr.track_uri && summary.sub && summary.sub !== tr.service_name
  if (onAir) { summary.station = summary.title; summary.title = summary.sub; summary.sub = '' }
  const station = onAir ? summary.station
    // A Spotify Connect session's container is the listener's own playlist or
    // mix, not a station, and neither Sonos app names it (2026-10-04).
    : (zone && STATIONS.includes(tr.source) && !book && !isConnectSession(tr) && tr.container_title && tr.container_title !== summary.title ? tr.container_title : '')
  const title = zone ? (summary.title || (loaded ? '' : t('common.noMusicSelected'))) : t('hifi.noZone')
  // The source names what is loaded; an idle room names none.
  const source = zone && (loaded || tr.service_name) ? (tr.service_name || (tr.source && tr.source !== 'idle' ? t(`source.${tr.source}`) : '')) : ''
  // The cover, printed on the display's left as the screen's own picture,
  // with everything else beside it. The remote's small display has no room.
  const art = zone && tr.source !== 'tv' ? nowPlayingArt(zone.host, tr) : ''
  const body = (
    <>
      <div className="hf-display-top">
        <IconKey label={t('desk.shortcuts.prevZone')} onClick={() => step(-1)} disabled={groups.length < 2} className="hf-zone-step"><G.ChevronDown style={{ transform: 'rotate(90deg)' }} /></IconKey>
        <button type="button" className="hf-zone-name" aria-haspopup="menu" aria-expanded={Boolean(zoneMenu)}
                onClick={(event) => setZoneMenu(event.currentTarget)} title={t('hifi.chooseZone')}>
          <span className="hf-vfd-caption">{t('hifi.zone')}</span>
          <span className="hf-vfd-zone">{zone ? groupTitle(group, zones, t) : '— — —'}</span>
        </button>
        <IconKey label={t('desk.shortcuts.nextZone')} onClick={() => step(1)} disabled={groups.length < 2} className="hf-zone-step"><G.Chevron /></IconKey>
        <span className="hf-vfd-source" title={source}>{source}</span>
        {sleepLeft > 0 && (
          <span className="hf-vfd-sleep" title={t('desk.browse.sleepTimer')}>
            <G.Moon /><span className="hf-vfd-num">{clockText(sleepLeft)}</span>
          </span>
        )}
      </div>
      <p className="hf-vfd-title" title={title}>{title}</p>
      <p className="hf-vfd-sub" title={summary.sub}>{zone ? (summary.sub || '') : t('desk.browse.selectRoom')}</p>
      <Annunciators zone={zone} sleepRemaining={sleepRemaining} />
      {/* The station this plays from, where it is one and the lines above do
          not already name it (a Pandora or AccuRadio station hands back a
          song at a time; a broadcast's title is the station itself). */}
      {!compact && station && (
        <p className="hf-vfd-next hf-vfd-station" title={station}>
          <span className="hf-vfd-caption">{t('desk.info.station')}</span>
          <span className="hf-vfd-next-text">{station}</span>
        </p>
      )}
      {/* What the speaker reports as up next, dim, in the display's own
          lettering; nothing for a station, which has no next. */}
      {!compact && tr.next_title && (
        <p className="hf-vfd-next" title={[tr.next_title, tr.next_artist].filter(Boolean).join(' · ')}>
          <span className="hf-vfd-caption">{t('common.next')}</span>
          <span className="hf-vfd-next-text">{[tr.next_title, tr.next_artist].filter(Boolean).join(' · ')}</span>
        </p>
      )}
      <PositionBar zone={zone} />
    </>
  )
  return (
    <Display className={`hf-main-display${compact ? ' hf-main-display-compact' : ''}`}>
      {compact ? body : (
        <div className="hf-vfd-split">
          <span className="hf-vfd-art" aria-hidden="true">
            {tr.source === 'tv' ? <G.Tv /> : <Art src={art} size={400} fallback="note" brokenFallback="note" />}
          </span>
          <div className="hf-vfd-body">{body}</div>
        </div>
      )}
      {zoneMenu && (
        <Menu anchor={zoneMenu} onClose={() => setZoneMenu(null)} width={280} title={t('hifi.chooseZone')}>
          {groups.map((g) => (
            <MenuItem key={g.coordinator} checked={g.coordinator === group?.coordinator}
                      onSelect={() => { setZoneMenu(null); onSelect(g.coordinator) }}>
              {groupTitle(g, zones, t)}
            </MenuItem>
          ))}
        </Menu>
      )}
    </Display>
  )
}

export function TransportKeys({ zone, onSleep, sleepOn, onInfo, onLink, full = true }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const tr = zone?.transport || {}
  const what = nextTransport(tr)
  const loaded = isLoaded(tr)
  const skip = canSkip(tr)
  const { duration, elapsed } = useElapsed(tr)
  const seekable = Boolean(duration) && tr.can_seek !== false && skip
  const seekBy = (delta) => actions.seek(zone.uuid, hms(Math.max(0, Math.min(duration, elapsed + delta))))
  const { shuffled, repeat } = modesOf(tr)
  const allowed = modesAllowed(zone)
  const playLabel = !zone ? t('common.play') : !loaded ? t('common.nothingQueued') : what === 'play' ? t('common.play') : what === 'stop' ? t('common.stop') : t('common.pause')
  // Two rows on the amplifier: the five playback keys, and under them the
  // modes followed by sleep, info and link.
  return (
    <div className="hf-transport" role="group" aria-label={t('desk.now.title')}>
      <div className="hf-transport-main">
        {full && <Key label={t('desk.transport.back30')} icon={<G.Rewind />} disabled={!seekable} onClick={() => seekBy(-30)} shape="transport" legend="-30" />}
        <Key label={t('common.previous')} icon={<G.Prev />} disabled={!canPrevious(tr)} onClick={() => actions.previous(zone.uuid)} shape="transport" />
        <Key label={playLabel} icon={what === 'play' ? <G.Play /> : what === 'stop' ? <G.Stop /> : <G.Pause />}
             disabled={!zone || !loaded} onClick={() => togglePlay(actions, zone)} shape="transport" size="lg" tone="play"
             led={tr.state === 'PLAYING' || tr.state === 'TRANSITIONING'} />
        <Key label={t('common.next')} icon={<G.Next />} disabled={!canNext(tr)} onClick={() => actions.next(zone.uuid)} shape="transport" />
        {full && <Key label={t('desk.transport.forward30')} icon={<G.Forward />} disabled={!seekable} onClick={() => seekBy(30)} shape="transport" legend="+30" />}
      </div>
      {full && (
        <div className="hf-transport-second">
        <div className="hf-transport-modes">
          <Key legend={t('hifi.ann.shuffle')} label={t('common.shuffle')} icon={<G.Shuffle />} led={shuffled} disabled={!allowed.modes}
               onClick={() => toggleShuffle(actions, zone)} size="sm" />
          <Key legend={repeat === 'one' ? t('hifi.ann.repeatOne') : t('hifi.ann.repeat')}
               label={repeat === 'one' ? t('desk.transport.repeatOne') : repeat === 'all' ? t('desk.transport.repeatAll') : t('desk.transport.repeatOff')}
               icon={repeat === 'one' ? <G.RepeatOne /> : <G.Repeat />} led={repeat !== 'off'} disabled={!allowed.repeat}
               onClick={() => cycleRepeat(actions, zone)} size="sm" />
          <Key legend={t('hifi.ann.crossfade')} label={t('desk.transport.crossfade')} icon={<G.Crossfade />} led={Boolean(tr.crossfade)} disabled={!allowed.crossfade}
               onClick={() => actions.setCrossfade(zone.uuid, !tr.crossfade)} size="sm" />
        </div>
        <div className="hf-transport-aux">
          <Key legend={t('hifi.ann.sleep')} label={t('desk.browse.sleepTimer')} icon={<G.Moon />} led={sleepOn} disabled={!zone} onClick={onSleep} size="sm" />
          <Key legend={t('hifi.info')} label={t('desk.now.infoOptions')} icon={<G.Info />} disabled={!zone || !loaded} onClick={onInfo} size="sm" />
          <Key legend={t('hifi.link')} label={t('desk.grouping.title')} icon={<G.Link />} disabled={!zone || zone.local} onClick={onLink} size="sm" />
        </div>
        </div>
      )}
    </div>
  )
}

// The volume: one big knob for the room or group in view, the mute key with
// its red lamp, and, for a group, a trim panel holding each room's own. The
// knob carries no number: its pointer and lit arc say where it is.
// `mute` false leaves the mute key to the row below (the phone's remote).
export function VolumeSection({ zone, group, zones, size = 'lg', mute = true }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const [trim, setTrim] = useState(null)
  const grouped = Boolean(group && group.members.length > 1)
  useEffect(() => { setTrim(null) }, [group?.coordinator])
  const members = grouped ? group.members.map((u) => zones[u]).filter(Boolean) : []
  const muted = Boolean(zone?.group_muted)
  return (
    <div className="hf-volume">
      <Knob value={zone?.group_volume ?? 0} onCommit={(level) => actions.setGroupVolume(zone.uuid, level)}
            label={grouped ? t('desk.transport.groupVolume') : t('win.alarm.volume')} size={size} disabled={!zone} ticks={11} />
      <span className="hf-legend hf-legend-knob">{t('win.alarm.volume')}</span>
      <div className="hf-volume-keys">
        {mute && (
          <Key legend={t('common.mute')} label={muted ? t('common.unmute') : t('common.mute')} icon={muted ? <G.Muted /> : <G.Volume />}
               led={muted} tone="danger" disabled={!zone} onClick={() => actions.setMute(zone.uuid, !muted, true)} size="sm" />
        )}
        {grouped && (
          <Key legend={t('hifi.trim')} label={t('desk.transport.groupVolume')} icon={<G.Sliders />} size="sm"
               aria-haspopup="dialog" aria-expanded={Boolean(trim)} onClick={(event) => setTrim(trim ? null : event.currentTarget)} />
        )}
      </div>
      {trim && grouped && (
        <Menu anchor={trim} align="right" width={320} onClose={() => setTrim(null)} title={t('desk.transport.groupVolume')}>
          <div className="hf-trim">
            {members.map((m) => (
              <div key={m.uuid} className="hf-trim-row">
                <span className="hf-trim-name">{m.name}</span>
                <IconKey label={m.muted ? t('common.unmute') : t('common.mute')} active={m.muted}
                         onClick={() => actions.setMute(m.uuid, !m.muted)}>{m.muted ? <G.Muted /> : <G.Volume />}</IconKey>
                <Fader wheelStep={2} value={m.volume ?? 0} label={m.name} onCommit={(level) => actions.setVolume(m.uuid, level)} />
                <output className="hf-trim-level">{m.volume ?? 0}</output>
              </div>
            ))}
          </div>
        </Menu>
      )}
    </div>
  )
}

// A rotary switch whose stops are printed round it, each with its lamp:
// the function selector, and the system switch. Pressing a legend turns the
// switch there; the knob can be dragged, and on it the wheel and the arrow
// keys step it. The stops are 35 degrees apart, or 50 when there are fewer
// than five, spread either side of straight up.
export function RotarySwitch({ stops, value, onChange, label, title, className = '' }) {
  const index = Math.max(0, stops.findIndex((s) => s.id === value))
  const step = stops.length >= 5 ? 35 : 50
  const angles = stops.map((_, i) => (i - (stops.length - 1) / 2) * step)
  const last = stops.length - 1
  const turn = (by) => onChange(stops[Math.max(0, Math.min(last, index + by))].id)
  // Dragging the knob turns it as the volume knob turns: up or right is
  // clockwise, a stop for every 36 pixels, and it stops at either end
  // rather than wrapping round.
  const drag = useRef(null)
  const onPointerDown = (event) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.focus()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    drag.current = { x: event.clientX, y: event.clientY, start: index, at: index }
  }
  const onPointerMove = (event) => {
    const d = drag.current
    if (!d) return
    const moved = (event.clientX - d.x) - (event.clientY - d.y)
    const next = Math.max(0, Math.min(last, d.start + Math.round(moved / 36)))
    if (next !== d.at) { d.at = next; onChange(stops[next].id) }
  }
  const onPointerUp = () => { drag.current = null }
  // The wheel turns it too, a stop per notch as the volume knob steps: up is
  // clockwise. It is bound by hand because React's wheel listener is passive
  // and could not keep the page from scrolling under the knob. A trackpad
  // sends a flood of small events, so a stop is taken at most every 180ms.
  const knob = useRef(null)
  const latest = useRef({ index, onChange, stops })
  latest.current = { index, onChange, stops }
  useEffect(() => {
    const el = knob.current
    if (!el) return undefined
    let stamp = 0
    const wheel = (event) => {
      event.preventDefault()
      const now = performance.now()
      if (now - stamp < 180 || !event.deltaY) return
      stamp = now
      const { index: at, onChange: change, stops: all } = latest.current
      const next = Math.max(0, Math.min(all.length - 1, at + (event.deltaY < 0 ? 1 : -1)))
      if (next !== at) change(all[next].id)
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  }, [])
  return (
    <div className={`hf-selector ${className}`.trim()} role="radiogroup" aria-label={label}>
      <div className="hf-selector-dial">
        {stops.map((stop, i) => (
          <button key={stop.id} type="button" role="radio" aria-checked={value === stop.id} className="hf-selector-stop"
                  style={{ '--hf-angle': `${angles[i]}deg` }} onClick={() => onChange(stop.id)} title={stop.title || undefined}>
            <Led on={value === stop.id} />
            <span>{stop.label}</span>
          </button>
        ))}
        <span ref={knob} className="hf-selector-knob" tabIndex={0} role="presentation" style={{ '--hf-angle': `${angles[index]}deg` }}
              onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight' || event.key === 'ArrowUp') { event.preventDefault(); turn(1) }
                else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') { event.preventDefault(); turn(-1) }
              }}>
          <span className="hf-selector-pointer" />
        </span>
      </div>
      {/* Named under the knob, as the volume knob is. */}
      <span className="hf-legend hf-legend-knob hf-selector-title" aria-hidden="true">{title}</span>
    </div>
  )
}

// The function selector: five stops, one for each unit the rack can show.
export function FunctionSelector({ value, onChange }) {
  const { t } = useI18n()
  const stops = FUNCTIONS.map((id, i) => ({ id, label: t(`hifi.fn.${id}`), title: `${t(`hifi.fn.${id}`)} (Ctrl ${i + 1})` }))
  return <RotarySwitch stops={stops} value={value} onChange={onChange} label={t('hifi.function')} title={t('hifi.function')} />
}

// The brand plate along the amplifier's top left, over the turntable: the
// name, the model number (the system in view, S1 or S2, when there is one to
// name) and the unit's designation, then the power lamp that says whether
// Sonora can hear the speakers.
export function BrandPlate({ connected, onAbout, rooms, generation = '' }) {
  const { t } = useI18n()
  return (
    <div className="hf-brand">
      <button type="button" className="hf-brand-name" onClick={onAbout} title={t('about.menu')}>Sonora</button>
      <span className="hf-brand-model">
        {generation && <span className="hf-brand-gen">{generation} </span>}
        <span className="hf-brand-unit">{t('hifi.unit.preamp')}</span>
      </span>
      <span className="hf-power" title={connected ? t('net.live') : t('common.reconnecting')}>
        <Led on={connected} tone={connected ? 'green' : 'red'} />
        <span>{connected ? t.plural('common.rooms', rooms) : t('common.reconnecting')}</span>
      </span>
    </div>
  )
}

// The system switch: a stop for each system and one for all of them. A dial
// on the amplifier; on a phone, where it sits in the zone amplifier's
// toolbar, a slide switch, which is shorter and
// easier to work with a thumb.
export function SystemSwitch({ households, value, onChange, small = false }) {
  const { t } = useI18n()
  const stops = [...households.map((h) => ({ id: h.id, label: h.generation })), { id: 'all', label: t('desk.rooms.allSystems') }]
  if (small) {
    return <SlideSwitch options={stops} value={value || 'all'} onChange={onChange} label={t('desk.showSystem')} className="hf-system-switch" />
  }
  return <RotarySwitch stops={stops} value={value || 'all'} onChange={onChange} label={t('desk.showSystem')}
                       title={t('hifi.system')} className="hf-system-switch" />
}

export default function Preamp({ zone, group, zones, groups, onSelect, fn, onFunction, sleepRemaining, onSleep, onInfo, onLink,
                                 connected, rooms, onAbout, systemSwitch = null, generation = '', onMessage = null }) {
  return (
    <Unit className="hf-preamp" aria-label="Sonora" as="header">
      <BrandPlate connected={connected} onAbout={onAbout} rooms={rooms} generation={generation} />
      <Reactions zone={zone} onMessage={onMessage} />
      <div className="hf-preamp-left">
        <RoomSelect groups={groups} zones={zones} active={group?.coordinator} onSelect={onSelect} />
        <Turntable zone={zone} onOpen={onInfo} />
      </div>
      <div className="hf-preamp-center">
        <MainDisplay zone={zone} group={group} zones={zones} groups={groups} onSelect={onSelect} sleepRemaining={sleepRemaining} />
        <TransportKeys zone={zone} onSleep={onSleep} sleepOn={Boolean(sleepRemaining)} onInfo={onInfo} onLink={onLink} />
      </div>
      {/* The system switch under the record player. */}
      <div className="hf-preamp-system">{systemSwitch}</div>
      {/* One column down the right: the volume knob, mute and trim under it
          on either side of its name, and the function selector at the foot. */}
      <div className="hf-preamp-side">
        <VolumeSection zone={zone} group={group} zones={zones} />
        <FunctionSelector value={fn} onChange={onFunction} />
      </div>
    </Unit>
  )
}

// The room selector over the record player: a dropdown of the rooms and
// groups in the system in view, the one in the display chosen; picking one
// brings it into the display. Linked zones first, then rooms alone, then
// This browser, as the Zones view orders them.
function RoomSelect({ groups, zones, active, onSelect }) {
  const { t } = useI18n()
  const ordered = [...groups.filter((g) => g.members.length > 1 && !g.local),
                   ...groups.filter((g) => g.members.length <= 1 && !g.local),
                   ...groups.filter((g) => g.local)]
  return (
    <Select className="hf-roomselect" value={active || ''} onChange={(event) => onSelect(event.target.value)}
            aria-label={t('hifi.chooseZone')} disabled={!ordered.length}>
      {ordered.map((g) => <option key={g.coordinator} value={g.coordinator}>{groupTitle(g, zones, t)}</option>)}
    </Select>
  )
}

// On a phone the amplifier becomes a remote control's head: the display and
// a small record, the transport, and the volume knob with its mute.
// The remote's head folded to one line while the bay is scrolled: the room,
// what it plays, and the play key. A tap on the line opens the head again.
function RemoteMini({ zone, group, zones, onExpand }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const tr = zone?.transport || {}
  const what = nextTransport(tr)
  const loaded = isLoaded(tr)
  const summary = nowSummary(tr, t)
  const playLabel = !zone ? t('common.play') : !loaded ? t('common.nothingQueued') : what === 'play' ? t('common.play') : what === 'stop' ? t('common.stop') : t('common.pause')
  return (
    <div className="hf-remote-mini">
      <button type="button" className="hf-remote-mini-text" onClick={onExpand} title={t('hifi.showControls')}>
        <span className="hf-vfd-caption">{zone ? groupTitle(group, zones, t) : t('hifi.noZone')}</span>
        <span className="hf-remote-mini-title">{summary.title || (loaded ? '' : t('common.noMusicSelected'))}</span>
      </button>
      <Key label={playLabel} icon={what === 'play' ? <G.Play /> : what === 'stop' ? <G.Stop /> : <G.Pause />}
           disabled={!zone || !loaded} onClick={() => togglePlay(actions, zone)} size="sm" tone="play"
           led={tr.state === 'PLAYING' || tr.state === 'TRANSITIONING'} />
    </div>
  )
}

export function RemoteHead({ zone, group, zones, groups, onSelect, sleepRemaining, onSleep, onInfo, onLink, connected, onAbout, rooms, systemSwitch, generation = '', onMessage = null, collapsed = false, onExpand = null }) {
  return (
    <Unit className="hf-remote-head" as="header" aria-label="Sonora" data-collapsed={collapsed || undefined}>
      {collapsed && <RemoteMini zone={zone} group={group} zones={zones} onExpand={onExpand} />}
      <div className="hf-remote-top">
        <BrandPlate connected={connected} onAbout={onAbout} rooms={rooms} generation={generation} />
        <Reactions zone={zone} onMessage={onMessage} />
      </div>
      {/* No system dial here: on a phone it is in the zone amplifier's
          toolbar, where the rooms it chooses between are, and the head
          keeps its height for the display and the keys. */}
      <div className="hf-remote-display">
        <Turntable zone={zone} onOpen={onInfo} size="sm" />
        <MainDisplay zone={zone} group={group} zones={zones} groups={groups} onSelect={onSelect} sleepRemaining={sleepRemaining} compact />
      </div>
      {/* The volume knob at the far left, the transport keys to its right;
          mute leads the row of keys below. */}
      <div className="hf-remote-controls">
        <VolumeSection zone={zone} group={group} zones={zones} size="md" mute={false} />
        <TransportKeys zone={zone} onSleep={onSleep} sleepOn={Boolean(sleepRemaining)} onInfo={onInfo} onLink={onLink} full={false} />
      </div>
      <RemoteModes zone={zone} onSleep={onSleep} sleepOn={Boolean(sleepRemaining)} onInfo={onInfo} onLink={onLink} />
    </Unit>
  )
}

// The remote's second row of keys: the modes, sleep, info and link.
function RemoteModes({ zone, onSleep, sleepOn, onInfo, onLink }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const tr = zone?.transport || {}
  const { shuffled, repeat } = modesOf(tr)
  const allowed = modesAllowed(zone)
  const loaded = isLoaded(tr)
  const muted = Boolean(zone?.group_muted)
  return (
    <div className="hf-remote-modes">
      <IconKey label={muted ? t('common.unmute') : t('common.mute')} led={muted} tone="danger" disabled={!zone} className="hf-ikey-mute"
               onClick={() => actions.setMute(zone.uuid, !muted, true)}>{muted ? <G.Muted /> : <G.Volume />}</IconKey>
      <IconKey label={t('common.shuffle')} led={shuffled} disabled={!allowed.modes} onClick={() => toggleShuffle(actions, zone)}><G.Shuffle /></IconKey>
      <IconKey label={repeat === 'one' ? t('desk.transport.repeatOne') : repeat === 'all' ? t('desk.transport.repeatAll') : t('desk.transport.repeatOff')}
               led={repeat !== 'off'} disabled={!allowed.repeat} onClick={() => cycleRepeat(actions, zone)}>{repeat === 'one' ? <G.RepeatOne /> : <G.Repeat />}</IconKey>
      <IconKey label={t('desk.transport.crossfade')} led={Boolean(tr.crossfade)} disabled={!allowed.crossfade} onClick={() => actions.setCrossfade(zone.uuid, !tr.crossfade)}><G.Crossfade /></IconKey>
      <IconKey label={t('desk.browse.sleepTimer')} led={sleepOn} disabled={!zone} onClick={onSleep}><G.Moon /></IconKey>
      <IconKey label={t('desk.now.infoOptions')} disabled={!zone || !loaded} onClick={onInfo}><G.Info /></IconKey>
      <IconKey label={t('desk.grouping.title')} disabled={!zone || zone.local} onClick={onLink}><G.Link /></IconKey>
    </div>
  )
}

// The remote's foot: the function keys, one per component.
export function FunctionKeys({ value, onChange }) {
  const { t } = useI18n()
  return (
    <nav className="hf-fnkeys" aria-label={t('hifi.function')}>
      {FUNCTIONS.map((id) => {
        const Glyph = FUNCTION_GLYPHS[id]
        return (
          <button key={id} type="button" className="hf-fnkey" aria-current={value === id ? 'page' : undefined} onClick={() => onChange(id)}>
            <Led on={value === id} />
            <Glyph />
            <span>{t(`hifi.fn.${id}`)}</span>
          </button>
        )
      })}
    </nav>
  )
}

export function useRackClock() {
  const [now, setNow] = useState(() => new Date())
  const timer = useRef(null)
  useEffect(() => {
    timer.current = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer.current)
  }, [])
  return now
}
