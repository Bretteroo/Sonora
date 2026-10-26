import React, { useEffect, useRef, useState } from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { MarqueeProvider, MarqueeText } from '../../frontend/src/lib/marquee.jsx'
import { describeNowPlaying, formatDuration } from '../../frontend/src/lib/format.js'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import * as Icon from '../../frontend/src/components/Icons.jsx'
import Art, { nowPlayingArt } from './Art.jsx'
import Slider from './Slider.jsx'
import { NpRepeat, NpRepeatOne, NpShuffle, NpVolume, NpVolumeMute, StationGlyph, VolumeCone, VolumeConeOff } from './icons.jsx'
import { broadcastLines, heldStation, heldStationLines, isStation, restingSecondary, useTransport } from './useTransport.js'
import { useProviderItem } from '../../frontend/src/lib/useProviderItem.js'
import { api } from '../../frontend/src/lib/api.js'
import { providerIdOf } from '../../frontend/src/lib/items.js'
import { ratingGlyph } from '../../frontend/src/lib/ratingGlyph.js'
import { cachedArt } from './Art.jsx'
import { anchorAbove } from './menus.js'
import PlayerMenu, { hasPlayerMenu } from './PlayerMenu.jsx'
import { useOptimisticRatings } from '../../frontend/src/lib/optimisticRatings.js'

// The bar along the bottom, driving whichever room is active. The transport
// state and the local elapsed clock live in useTransport, shared with the Now
// Playing view.

const MODE_ORDER = ['NORMAL', 'REPEAT_ALL', 'REPEAT_ONE']

// The glyphs the product draws for the ratings a service declares.
const RATING_GLYPHS = {
  STAR: (selected) => (selected ? Icon.Star : Icon.StarOutline),
  PROHIBITED: () => Icon.Prohibit,
  THUMBSUP: () => Icon.ThumbUp,
  THUMBSDOWN: () => Icon.ThumbDown,
  HEART: () => Icon.Heart,
}

export default function TransportBar({ zone, label = '', members = [], queueOpen = false, onQueue, onNowPlaying, onViewOther, onSearch, onRoomSound }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const {
    transport, playing, next, loaded, fixedSource, canNext, canPrevious, barOrderable, connect, shuffled, repeat,
    elapsed, duration, seekable, cycleRepeat, toggleShuffle, togglePlay, seekTo, previewSeek,
  } = useTransport(zone)
  const now = describeNowPlaying(transport, t)
  const lines = broadcastLines(transport, t) || heldStationLines(transport)
  // The grouped-room volume: with a group active, resting on the bar's volume
  // controls opens a list above them with a slider per room, and the bar's
  // own slider moves the whole group (play.sonos.com, 2026-09-14). A single
  // room gets neither.
  const grouped = members.length > 1
  const [volOpen, setVolOpen] = useState(false)
  // The rooms' sliders open above the group's, and the pointer that heads for
  // them crosses the gap between, or cuts a corner, on the way. The panel
  // closes a moment after it is left, unless the pointer is back by then,
  // and a drag that wanders out closes it only once the button is let go.
  const volBox = useRef(null)
  const volClose = useRef(0)
  const closeVolSoon = () => {
    clearTimeout(volClose.current)
    volClose.current = setTimeout(() => { if (!volBox.current?.matches(':hover')) setVolOpen(false) }, 250)
  }
  useEffect(() => () => clearTimeout(volClose.current), [])
  // The bar's own "..." opens the same four lines the big player's does, in
  // the same place relative to its button (play.sonos.com, 2026-09-21).
  const [moreAt, setMoreAt] = useState(null)
  const more = useRef(null)
  useEffect(() => {
    if (!moreAt) return undefined
    const onDown = (event) => { if (!more.current?.contains(event.target)) setMoreAt(null) }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [moreAt])
  // The controls a service declares for what is playing, which the product
  // puts right after the track's name: AccuRadio's star and prohibition
  // sign, Pandora's thumbs (40px buttons on a 40px pitch, 20px glyph,
  // measured on play.sonos.com 2026-09-15). The Now Playing card has none of
  // them, only its own options disc.
  const { ratings, itemId, refresh: refreshRatings } = useProviderItem(zone, zone?.transport)
  const rate = async (button) => {
    // A lit button the service gives no way back from does nothing (see
    // rating_is_inert in backend/main.py: AccuRadio's loved star).
    if (button.inert) return
    if (!itemId) return
    const result = await actions.rateItemById(zone.uuid, zone.transport?.service_id, itemId, button.id)
    if (result?.ok) refreshRatings()
    return result?.ok
  }
  // A toggle is drawn pressed at the press (lib/optimisticRatings.js).
  const { ratings: shownRatings, press: pressRating } = useOptimisticRatings(ratings, `${zone?.uuid}|${zone?.transport?.track_uri || ''}`)

  // The words beside the art are a button of their own: the product's opens
  // the album of the track that is playing (its label is "View Other"; Kind
  // Of Blue (Legacy Edition) from So What), and does
  // nothing under a station, while the art alone opens Now Playing
  // (play.sonos.com, 2026-09-24). Sonora had made the two one button. On a
  // phone the art is not drawn, so there the words keep opening Now Playing.
  const viewOther = async () => {
    if (window.matchMedia?.('(max-width: 640px)').matches) {
      onNowPlaying?.()
      return
    }
    const uri = transport.track_uri || ''
    const sid = transport.service_id
    // A song from the music library has no service to ask for its album;
    // the product opens the library list it was queued from instead (Songs,
    // for a track played off the Songs page; play.sonos.com 2026-09-30).
    if (!sid && /^(A:|S:)/.test(transport.queue_container || '') && onViewOther) {
      onViewOther({ library: true, item: transport.queue_container, zone: zone.uuid })
      return
    }
    // A service song reopens the service's list the queue came from -- a
    // track played off a Spotify playlist reopens that playlist, not the
    // track's album (play.sonos.com, 2026-09-30) -- and its album otherwise.
    const account = uri.match(/[?&]sn=(\d+)/)?.[1] || ''
    if (transport.queue_container && transport.queue_container_sid && onViewOther) {
      const qsid = transport.queue_container_sid
      const list = await api.serviceItem(qsid, transport.queue_container, zone.uuid, account).catch(() => null)
      onViewOther(list?.uri && list.is_container
        ? { list: true, sid: qsid, item: list.id, name: list.title || transport.container_title || '',
            art: list.art || '', uri: list.uri, metadata: list.metadata || '', item_type: list.item_type || '',
            artist: list.artist || '', account_id: account, zone: zone.uuid,
            service: transport.service_name || '',
            // A playlist names its owner under its title ("Pigeon Pair").
            second_line: list.item_type === 'playlist' ? (list.artist || '') : '' }
        : { sid: qsid, item: transport.queue_container, name: transport.container_title || '',
            account_id: account, zone: zone.uuid })
      return
    }
    const id = providerIdOf(uri)
    if (!sid || !id || !onViewOther) return
    const found = await api.serviceItem(sid, id, zone.uuid, account).catch(() => null)
    if (found?.album_id) {
      onViewOther({ sid, item: found.album_id, name: found.album || '', account_id: account, zone: zone.uuid })
    }
  }

  if (!zone) return <section className="wb-transport" />
  const art = nowPlayingArt(zone.host, transport)

  return (
    <MarqueeProvider enabled style="sonora">
    <section className="wb-transport">
      <div className="wb-transport-left">
      <div className="wb-transport-now">
        {/* A station with no picture wears the card's radio waves, not the
            note: 20x13 of ink in rgb(34,36,38) on the tile darkened to
            rgb(54,57,58), a stopped Lovers Rock Reggae (2026-09-28). */}
        <button type="button" className="wb-transport-art" title={t('web.openNowPlaying')}
                data-station={(transport.source !== 'tv' && !art.length && isStation(transport)) || undefined}
                onClick={onNowPlaying}>
          {transport.source === 'tv'
            ? <Icon.Tv width={24} height={24} />
            : !art.length && isStation(transport)
              ? <StationGlyph className="wb-transport-station" />
              : <Art src={art} size={24} />}
        </button>
        <button type="button" className="wb-transport-text" title={t('desk.info.viewAllSongs')}
                onClick={viewOther}>
          {/* Keyed on the room so React remounts it when the bar is handed a
              different one, which replays the animation below. Every other
              part of this bar looks the same from room to room, so without it
              the switch is easy to miss. */}
          <p className="wb-transport-room" key={zone.uuid}>{label || zone.name}</p>
          <p className="wb-transport-title">
            <MarqueeText>{lines ? lines.title : (now.primary || heldStation(transport) || t('common.noMusicSelected'))}</MarqueeText>
          </p>
          <p className="wb-transport-sub">
            {/* The service's mark before the line, as on a room card and the
                product's own bar ("Take Ten" over a Pandora flag and Paul
                Desmond). A service with no badge answers 404 and it goes. */}
            {transport.service_id ? (
              <img className="wb-room-badge" src={`/api/services/badge/${transport.service_id}?size=40`}
                   alt="" aria-hidden="true"
                   onError={(event) => { event.currentTarget.style.display = 'none' }} />
            ) : null}
            {/* One thing, not two: the product prints the artist under the
                track and leaves the album out -- "Wes Montgomery", where
                Sonora wrote "Wes Montgomery -- Full House [Keepnews
                Collection] (Remas..." (both bars on the same track,
                2026-09-21). */}
            <MarqueeText>{lines ? lines.sub
              : transport.artist
              || restingSecondary(transport, now)
              || transport.service_name
              || (loaded ? '' : t('common.queueIsEmpty'))}</MarqueeText>
          </p>
        </button>
      </div>

      <div className="wb-transport-rate">
        {/* The button that skips the track goes last. Pandora's map lists
            Thumbs down before Thumbs up and AccuRadio's lists Love before
            Ban, and the product draws both with the approving one first
            (play.sonos.com, 2026-09-21 and 2026-09-28). The ids cannot say
            it: Pandora's up is 1 and down 2, AccuRadio's love is 1 and ban 0.
            What both maps do say is that the disapproving one skips
            (AutoSkip ALWAYS). */}
        {/* No rating buttons over a Spotify Connect session: the product's bar
            shows none there, only the options disc (2026-10-04). */}
        {[...(connect ? [] : shownRatings)].sort((a, b) => {
          const skips = (button) => (String(button.skip).toUpperCase() === 'ALWAYS' ? 1 : 0)
          return skips(a) - skips(b)
        }).map((button) => {
          const { family, selected } = ratingGlyph(button.icon)
          const Glyph = (RATING_GLYPHS[family] || (() => null))(selected)
          return (
            <button key={button.id} type="button" className="wb-icon-btn wb-rate-btn" aria-disabled={button.inert || undefined}
                    title={button.inert ? t('rating.cannotUndo', { service: zone?.transport?.service_name || '' }) : (button.label || '')} aria-pressed={selected}
                    onClick={() => pressRating(button, rate)}>
              {Glyph ? <Glyph width={20} height={20} />
                : <img src={cachedArt(button.icon)} alt="" width={20} height={20} />}
            </button>
          )
        })}
        {/* The options disc after them, which the product gives every source,
            rated or not, and an empty room as well (Sleep Timer alone,
            2026-09-24) -- unless the room has no line to offer, as the
            browser room playing a live stream does not. */}
        {hasPlayerMenu(zone, transport.artist || '', Boolean(onSearch)) && (
        <span className="wb-transport-more" ref={more}>
          <button type="button" className="wb-icon-btn wb-rate-btn" title={t('web.moreOptions')}
                  aria-expanded={Boolean(moreAt)}
                  onClick={(event) => {
                    const at = anchorAbove(event)
                    setMoreAt((open) => (open ? null : at))
                  }}>
            <Icon.Ellipsis width={20} height={20} />
          </button>
          <PlayerMenu zone={zone} artist={transport.artist || ''} anchor={moreAt}
                      onClose={() => setMoreAt(null)} onSearch={onSearch} onRoomSound={onRoomSound} />
        </span>
        )}
      </div>
      </div>

      <div className="wb-transport-center">
        <div className="wb-transport-buttons">
          <button
            type="button"
            className="wb-icon-btn"
            aria-pressed={shuffled}
            data-toggle="shuffle"
            title={t('common.shuffle')}
            onClick={toggleShuffle}
            disabled={!barOrderable}
          >
            <NpShuffle width={24} height={24} />
          </button>
          <button
            type="button"
            className="wb-icon-btn"
            title={t('common.previous')}
            onClick={() => actions.previous(zone.uuid)}
            disabled={!canPrevious}
          >
            <Icon.Prev width={24} height={24} />
          </button>
          <span className="wb-play-wrap">
          <button
            type="button"
            className="wb-play"
            title={!loaded ? t('common.nothingQueued') : next === 'stop' ? t('common.stop')
              : next === 'pause' ? t('common.pause') : t('common.play')}
            onClick={togglePlay}
            disabled={!loaded || fixedSource}
          >
            {fixedSource ? <Icon.Stop width={20} height={20} />
              : next === 'stop' ? <Icon.Stop width={20} height={20} />
              : next === 'pause' ? <Icon.Pause width={20} height={20} />
              : <Icon.Play width={20} height={20} />}
          </button>
          {duration > 0 && <ProgressRing progress={elapsed / duration} />}
          </span>
          <button
            type="button"
            className="wb-icon-btn"
            title={t('common.next')}
            onClick={() => actions.next(zone.uuid)}
            disabled={!canNext}
          >
            <Icon.Next width={24} height={24} />
          </button>
          <button
            type="button"
            className="wb-icon-btn"
            aria-pressed={repeat !== 'off'}
            data-toggle="repeat"
            title={t('common.repeat')}
            onClick={cycleRepeat}
            disabled={!barOrderable}
          >
            {repeat === 'one' ? <NpRepeatOne width={24} height={24} />
                              : <NpRepeat width={24} height={24} />}
          </button>
        </div>

        {/* The times either side of the rail, elapsed and what is left, on
            a queue and a station alike: 0:52 and -2:49 on AccuRadio, 3:00
            and -6:21 on a Spotify track (play.sonos.com, 2026-09-28). With
            no length to count down there are none, and the rail takes the
            whole width (a live broadcast, 2026-10-26). */}
        <div className="wb-progress-row">
          {duration > 0 && <span className="wb-bar-time">{formatDuration(elapsed)}</span>}
          <ProgressRail label={t('common.seek')} position={elapsed} duration={duration} seekable={seekable}
                        onPreview={previewSeek} onSeek={seekTo} />
          {duration > 0 && (
            <span className="wb-bar-time wb-bar-time-right">-{formatDuration(Math.max(0, duration - elapsed))}</span>
          )}
        </div>
      </div>

      <div className="wb-transport-right">
        <button
          type="button"
          className="wb-icon-btn wb-transport-queue"
          title={t('common.queue')}
          aria-pressed={queueOpen}
          data-open={queueOpen || undefined}
          onClick={onQueue}
          /* Only while the room plays its queue. On a stream or a radio
             station the product grays the button out -- (51,51,51) against
             the live gray -- even with tracks waiting in the queue, and
             queue_length there counts the station's one track, not the
             queue's (a Grafine radio, play.sonos.com
             2026-09-22). */
          // A Spotify Connect session keeps it live: the product's panel then
          // reads "Started from Spotify" (2026-10-04).
          disabled={fixedSource || (!connect && (transport.source !== 'queue' || !(transport.queue_length > 0)))}
        >
          <Icon.Queue width={20} height={20} />
        </button>
        {!fixedSource && (
          // The television state has no mute control here and a longer rail.
          <button
            type="button"
            className="wb-icon-btn wb-transport-mute"
            title={zone.muted ? t('common.unmute') : t('common.mute')}
            aria-pressed={zone.muted}
            onClick={() => actions.setMute(zone.uuid, !zone.muted)}
          >
            {/* The same wedge as the card and the big player: 12x10 of ink
                with the arc and 16x10 with the cross, 4px into the 24px box
                at x=1352 (play.sonos.com at 1600 wide, 2026-09-24). The
                12px cone stretched to 24 here had painted 18x20. */}
            {zone.muted ? <NpVolumeMute /> : <NpVolume />}
          </button>
        )}
        <div className="wb-transport-vol" data-compact={!fixedSource}
             data-muted={zone.muted || undefined}
             ref={volBox}
             onPointerEnter={() => { clearTimeout(volClose.current); if (grouped) setVolOpen(true) }}
             onPointerLeave={(event) => {
               if (event.buttons) window.addEventListener('pointerup', closeVolSoon, { once: true })
               else closeVolSoon()
             }}>
          <Slider
            value={grouped ? (zone.group_volume ?? zone.volume) : zone.volume}
            label={grouped ? t('desk.transport.groupVolume') : t('web.roomVolume', { room: zone.name })}
            onCommit={(level) => (grouped ? actions.setGroupVolume(zone.uuid, level)
                                          : actions.setVolume(zone.uuid, level))}
          />
          <output>{grouped ? (zone.group_volume ?? zone.volume) : zone.volume}</output>
          {grouped && volOpen && (
            <ul className="wb-gvol" aria-label={t('desk.transport.groupVolume')}>
              {members.map((member) => (
                <li key={member.uuid}>
                  <div className="wb-gvol-head">
                    <span>{member.topology_label || member.name}</span>
                    <span>{member.volume}</span>
                  </div>
                  <div className="wb-gvol-row">
                    <button type="button" className="wb-gvol-mute"
                            title={member.muted ? t('common.unmute') : t('common.mute')}
                            aria-pressed={member.muted}
                            onClick={() => actions.setMute(member.uuid, !member.muted)}>
                      {member.muted ? <VolumeConeOff width={14} height={14} /> : <VolumeCone width={14} height={14} />}
                    </button>
                    <Slider value={member.volume} label={t('web.roomVolume', { room: member.name })}
                            onCommit={(level) => actions.setVolume(member.uuid, level)} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
    </MarqueeProvider>
  )
}

export { MODE_ORDER }

// The ring around the play disc: how far the track has played, from twelve
// o'clock round, over a faint track the size of the disc. The product draws it
// whenever the item has a length -- a queue, or a station's own tracks -- and
// not at all on a live broadcast; it sits beside the button rather than in it,
// so the disc can dim under the pointer while the ring does not
// (play.sonos.com, 2026-10-26).
const RING_R = 19
const RING_C = 2 * Math.PI * RING_R
function ProgressRing({ progress }) {
  const p = Math.max(0, Math.min(1, progress || 0))
  return (
    <svg className="wb-play-ring" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r={RING_R} className="wb-play-ring-track" />
      <circle cx="20" cy="20" r={RING_R} className="wb-play-ring-arc"
              strokeDasharray={RING_C} strokeDashoffset={RING_C * (1 - p)} />
    </svg>
  )
}

// The position rail. A 2px line in a 16px row that takes the pointer 10px
// further above and below; a knob rides the end of the fill while the pointer
// is over it, and a press anywhere jumps there and can be dragged on. The seek
// goes when the button is let go, and the rail holds that place until the
// speaker catches up (useTransport). Keys move it five seconds at a time.
// The knob keeps the focus after a press, with its ring, as the product's does.
function ProgressRail({ label, position, duration, seekable, onPreview, onSeek }) {
  const rail = useRef(null)
  const knob = useRef(null)
  const dragging = useRef(false)
  const pct = duration ? Math.max(0, Math.min(100, (position / duration) * 100)) : 0
  const at = (event) => {
    const rect = rail.current.getBoundingClientRect()
    return Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * duration
  }
  const down = (event) => {
    if (!seekable || event.button !== 0) return
    event.preventDefault()
    dragging.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    onPreview(at(event))
    knob.current?.focus()
  }
  const move = (event) => { if (dragging.current) onPreview(at(event)) }
  const up = (event) => {
    if (!dragging.current) return
    dragging.current = false
    onSeek(at(event))
  }
  const cancel = () => { if (dragging.current) { dragging.current = false; onPreview(null) } }
  const key = (event) => {
    if (!seekable) return
    const step = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 5
      : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -5 : 0
    if (!step) return
    event.preventDefault()
    onSeek(position + step)
  }
  return (
    <div className="wb-progress" ref={rail} data-seekable={seekable} aria-disabled={!seekable || undefined}
         onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel}
         onLostPointerCapture={cancel}>
      <span className="wb-progress-track">
        <span className="wb-progress-fill" style={{ width: `${pct}%` }} />
      </span>
      {duration > 0 && (
        <span className="wb-progress-knob" ref={knob} style={{ left: `${pct}%` }}
              role="slider" tabIndex={seekable ? 0 : -1} aria-disabled={!seekable || undefined} aria-label={label}
              aria-valuemin={0} aria-valuemax={Math.round(duration)} aria-valuenow={Math.round(position)} onKeyDown={key} />
      )}
    </div>
  )
}
