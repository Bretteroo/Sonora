import React from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { describeNowPlaying, sourceKey } from '../../frontend/src/lib/format.js'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import * as Icon from '../../frontend/src/components/Icons.jsx'
import Battery, { batteryShown } from '../../frontend/src/components/Battery.jsx'
import Art, { nowPlayingArt } from './Art.jsx'
import { NpVolume, NpVolumeMute, SpeakerOutline, StationGlyph } from './icons.jsx'
import Slider from './Slider.jsx'
import { broadcastLines, heldStation, heldStationLines, holdsStation, isStation, restingSecondary } from './useTransport.js'
import { nextTransport } from '../../frontend/src/lib/transport.js'
import { useTint } from './tint.js'
// Shared with Sonofuture, which used to build this string by hand.
import { groupLabelFor as groupLabel } from '../../frontend/src/lib/groups.js'

// A room in the "Your System" sidebar.
//
// Selecting the card makes the room active, which is what the transport bar
// then drives. The real client implements this as a full-bleed button behind
// the card labeled "Set <room> as active"; the same idea is used here, except
// as a real button element wrapping the content so the controls inside stay
// individually reachable by keyboard.

export default function RoomCard({ zone, members, active, onSelect, onGroup }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const transport = zone.transport ?? {}
  const now = describeNowPlaying(transport, t)
  const playing = transport.state === 'PLAYING'
  // What the disc does and shows: a stream the speaker cannot pause wears a
  // stop square while it plays and stops when pressed. This card sent Pause
  // there, which such a stream refuses (2026-09-24).
  const next = nextTransport(transport)
  const lines = broadcastLines(transport, t) || heldStationLines(transport)
  const external = transport.is_external_session
  const grouped = members.length > 1
  // The product grays a room's play control when nothing is queued and no
  // source is loaded, rather than offering a control the speaker will refuse.
  // A stopped station is loaded: play resumes it.
  const playable = Boolean(transport.track_uri)
    || (transport.queue_length ?? 0) > 0
    || holdsStation(transport)
  const station = heldStation(transport)
  const art = nowPlayingArt(zone.host, transport)
  // A television or line-in source cannot be paused: the product shows Stop.
  const fixedSource = ['tv', 'line_in'].includes(transport.source)

  const title = lines ? lines.title : (now.primary || station || t('common.noMusicSelected'))
  // The product's second line is one thing, not two: the artist where there
  // is one and the service's name where there is not (a station), with the
  // service's own mark before it -- "104.3 The Score" over an Audacy badge
  // and the word Audacy, "Take Ten" over a Pandora badge and Paul Desmond
  // (play.sonos.com, 2026-09-19). Sonora printed "artist - album" and no
  // mark at all.
  const sid = transport.service_id
  const sub = lines ? lines.sub
    : transport.source === 'tv' ? restingSecondary(transport, now)
    : transport.title || station
      ? (transport.artist || transport.service_name
         || now.secondary || '')
      : (transport.queue_length ? '' : t('common.queueIsEmpty'))
  // The product names a group "<coordinator> + N" wherever one line has to do
  // (the card's label, the bottom bar, the Now Playing pill) and lists every
  // room on its own line at the head of the card (a group of two,
  // play.sonos.com, 2026-09-14).
  const label = groupLabel(zone, members, t)
  // The active room's card carries the color of what it is playing; every
  // other card keeps the surface (play.sonos.com, 2026-09-19).
  const tint = useTint(active ? (nowPlayingArt(zone.host, transport)[0] || '') : '')
  const rooms = grouped ? [zone, ...members.filter((m) => m.uuid !== zone.uuid)] : [zone]
  const names = rooms.map((m) => m.topology_label || m.name)

  return (
    <div
      className="wb-room"
      data-active={active}
      role="button"
      tabIndex={0}
      aria-label={t('common.setActive', { room: label })}
      aria-pressed={active}
      /* The bars ride on the middle of the names, so the card says how many
         it has: one name puts their ink 24px below the card's top, two puts
         it 38 -- half a 28px line further down (play.sonos.com, 2026-09-22). */
      style={{ '--wb-names': names.length,
               ...(tint ? { background: tint.color, borderColor: tint.color,
                            '--t-tint-fg2': tint.text, '--t-tint-raise': tint.raise } : {}) }}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
    >
      <div className="wb-room-names">
        {/* A portable room's battery follows its name, small and grey, as
            the product draws "Roam 2 [battery] 99%" (play.sonos.com, 2026-10-05). */}
        {rooms.map((m, i) => (
          <h3 key={names[i]} className="wb-room-name">
            {names[i]}
            {batteryShown(m) && <Battery battery={m.battery} className="wb-room-battery" />}
          </h3>
        ))}
      </div>
      {/* Four bars rising and falling beside the room's name while it plays,
          which is how the product says so: 14px wide, 13 tall, 29px in from
          the card's right edge, and centered on the block of names -- 24px
          down from the card's top over one name, 38 over two (measured on
          play.sonos.com 2026-09-19 and 2026-09-22). */}
      {playing && (
        <span className="wb-room-bars" role="img" aria-label={t('web.queue.playing')}>
          <i /><i /><i /><i />
        </span>
      )}

      <div className="wb-room-now">
        <span className="wb-room-art" data-station={(!art.length && isStation(transport)) || undefined}>
          {transport.source === 'tv'
            ? <Icon.Tv width={16} height={16} aria-hidden="true" />
            : !art.length && isStation(transport)
              ? <StationGlyph className="wb-room-station" />
              : <Art src={art} size={16} />}
        </span>
        <span className="wb-room-text">
          <p className="wb-room-title">{title}</p>
          <p className="wb-room-sub">
            {/* Only a service that publishes an attribution badge gets a
                mark here; the rest answer 404 and the image removes itself,
                which is what the product draws for them. */}
            {sid ? (
              <img className="wb-room-badge" src={`/api/services/badge/${sid}?size=40`}
                   alt="" aria-hidden="true"
                   onError={(event) => { event.currentTarget.style.display = 'none' }} />
            ) : null}
            {sub}
          </p>
        </span>
        <span className="wb-room-actions">
          {/* The browser room cannot be grouped, so it is not offered. */}
          {!zone.local && (
            <button
              type="button"
              className="wb-icon-btn"
              aria-label={t('web.outputSelector')}
              title={t('web.chooseRooms', { room: label })}
              onClick={(event) => { event.stopPropagation(); onGroup() }}
            >
              <SpeakerOutline className="wb-room-speaker" />
            </button>
          )}
          <button
            type="button"
            className="wb-icon-btn wb-room-play"
            aria-label={fixedSource || next === 'stop' ? t('common.stop')
              : next === 'pause' ? t('common.pause') : t('common.play')}
            title={!playable ? t('common.nothingQueued')
              : external ? t('web.externalSession')
              : fixedSource || next === 'stop' ? t('common.stop')
              : next === 'pause' ? t('common.pause') : t('common.play')}
            disabled={!playable || (fixedSource && !playing)}
            onClick={(event) => {
              event.stopPropagation()
              if (fixedSource || next === 'stop') actions.stop(zone.uuid)
              else if (next === 'pause') actions.pause(zone.uuid)
              else actions.play(zone.uuid)
            }}
          >
            {fixedSource || next === 'stop' ? <Icon.Stop className="wb-stop" width={20} height={20} />
              : next === 'pause' ? <Icon.Pause /> : <Icon.Play />}
          </button>
        </span>
      </div>

      <div
        className="wb-room-vol"
        data-muted={zone.muted || undefined}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="wb-icon-btn"
          title={zone.muted ? t('common.unmute') : t('common.mute')}
          onClick={() => actions.setMute(zone.uuid, !zone.muted)}
        >
          {/* The product's filled wedge, the same glyph its big player
              draws: 12x10 of ink with the arc and 16x10 with the cross,
              4px into a 24px box (2026-09-24). The 12px cone this used was
              stretched to 24 by the row's rule and painted 18x20. */}
          {zone.muted ? <NpVolumeMute /> : <NpVolume />}
        </button>
        {/* A group's card carries one slider for the whole group, as the
            product's does; it never opens the per-room list, which belongs
            to the bar along the bottom. */}
        <Slider
          value={grouped ? (zone.group_volume ?? zone.volume) : zone.volume}
          label={grouped ? t('desk.transport.groupVolume') : t('web.roomVolume', { room: zone.name })}
          onCommit={(level) => (grouped ? actions.setGroupVolume(zone.uuid, level)
                                        : actions.setVolume(zone.uuid, level))}
        />
        <output>{grouped ? (zone.group_volume ?? zone.volume) : zone.volume}</output>
      </div>
    </div>
  )
}

// "<coordinator> + N" for a group, the room's own name otherwise.
export { groupLabel }
