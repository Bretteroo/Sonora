import React from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import * as Icon from '../../frontend/src/components/Icons.jsx'
import Art, { nowPlayingArt } from './Art.jsx'
import Slider from './Slider.jsx'
import { VolumeCone, VolumeConeOff } from './icons.jsx'
import { useTint } from './tint.js'
import { heldStation } from './useTransport.js'

// Grouping, where the product puts it: in place of the room list.
//
// Measured on play.sonos.com 2026-09-19. It is not a dialog and there is no
// backdrop -- the right-hand column becomes a panel tinted with the color of
// whatever the group is playing (a maroon rgb(98,29,42) under an album cover
// of the same), headed by that track, and listing every room of the household
// with a circle at the right: filled and ticked for a room in the group, empty
// for one out of it. A room in the group carries its own mute and volume; a
// room outside it shows its model instead, since it has no part in the
// playback yet.
//
// Sonora's own was a centered modal with a paragraph of explanation and an Add
// button per room, which is a reasonable thing and not this one.

export default function GroupPanel({ zone, onClose }) {
  const { actions, zones, groups, households } = useSystem()
  const { t } = useI18n()
  if (!zone) return null

  const household = households.find((h) => h.zone_uuids.includes(zone.uuid))
  const group = groups.find((g) => g.members.includes(zone.uuid))
  const members = new Set(group?.members ?? [zone.uuid])
  // The room the pane was opened from leads, then the rest of its group in
  // the order it was built, then the rooms outside it: the product lists
  // the rest in an order that is neither the
  // household's order nor an alphabet (measured 2026-09-21).
  const rank = (uuid) => {
    if (uuid === zone.uuid) return -1
    const place = (group?.members ?? []).indexOf(uuid)
    return place === -1 ? 1e6 : place
  }
  const rooms = (household?.zone_uuids ?? [])
    .map((uuid) => zones[uuid])
    .filter((room) => room && !room.invisible)
    .map((room, index) => ({ room, index }))
    .sort((a, b) => (rank(a.room.uuid) - rank(b.room.uuid)) || (a.index - b.index))
    .map((entry) => entry.room)
  const transport = zone.transport || {}
  const art = nowPlayingArt(zone.host, transport)[0] || ''
  const tint = useTint(art)

  // "DJ THEORY • Trending" in the product: the artist, then what it came out
  // of. A station whose container carries the station's own name would say it
  // twice, so a line that only repeats the title is left off.
  const title = heldStation(transport) || transport.title
  // The artist and the album it came from, which is what the product prints
  // here -- "Ben Webster & Oscar Peterson • Ben Webster Meets Oscar
  // Peterson" -- rather than the station the track arrived on (2026-09-21).
  const second = [transport.artist, transport.album || transport.container_title]
    .filter(Boolean).filter((part) => part !== title).join(' • ')

  return (
    <section className="wb-group-panel"
             style={tint ? { background: tint.color, '--t-tint-fg2': tint.text, '--t-tint-raise': tint.raise, '--t-tint-color': tint.color } : undefined}
             aria-label={t('web.group.title', { room: zone.name })}>
      <header className="wb-group-head">
        <span className="wb-group-art"><Art src={art} size={24} /></span>
        <span className="wb-group-now">
          <span className="wb-group-title">{title || t('common.noMusicSelected')}</span>
          {second && (
            <span className="wb-group-sub">
              {/* The service's mark before the words, as the room's card and
                  the player's meta line carry it (2026-09-21). */}
              {transport.service_id ? (
                <img className="wb-room-badge" src={`/api/services/badge/${transport.service_id}?size=40`}
                     alt="" aria-hidden="true"
                     onError={(event) => { event.currentTarget.style.display = 'none' }} />
              ) : null}
              <span>{second}</span>
            </span>
          )}
        </span>
        <button type="button" className="wb-group-close" title={t('common.close')} onClick={onClose}>
          <Icon.Close width={16} height={16} />
        </button>
      </header>

      <div className="wb-group-rooms">
        {rooms.map((room) => {
          const inGroup = members.has(room.uuid)
          const leads = room.uuid === zone.uuid
          return (
            <div className="wb-group-room" key={room.uuid} data-in={inGroup || undefined}
                 data-muted={(inGroup && room.muted) || undefined}>
              <span className="wb-group-speaker" aria-hidden="true">
                <Icon.Speaker width={20} height={20} />
              </span>
              <span className="wb-group-text">
                <span className="wb-group-line">
                  {/* The same four bars the room's card carries, ahead of the
                      name of a room that is playing (2026-09-21). */}
                  {(room.transport?.state === 'PLAYING'
                    || room.transport?.state === 'TRANSITIONING') && (
                    <span className="wb-room-bars wb-group-bars" role="img"
                          aria-label={t('web.queue.playing')}><i /><i /><i /><i /></span>
                  )}
                  <span className="wb-group-name">{room.topology_label || room.name}</span>
                  {inGroup && <span className="wb-group-level">{room.volume ?? 0}</span>}
                </span>
                {inGroup ? (
                  <span className="wb-group-vol">
                    <button type="button" className="wb-icon-btn"
                            title={room.muted ? t('common.unmute') : t('common.mute')}
                            onClick={() => actions.setMute(room.uuid, !room.muted)}>
                      {room.muted ? <VolumeConeOff /> : <VolumeCone />}
                    </button>
                    <Slider value={room.volume ?? 0}
                            label={`${room.name} volume`}
                            onCommit={(value) => actions.setVolume(room.uuid, value)} />
                  </span>
                ) : (
                  /* The model without the brand the product leaves off:
                     "Arc Ultra", not "Sonos Arc Ultra" (2026-09-21). */
                  <span className="wb-group-model">
                    {(room.model || '').replace(/^Sonos\s+/, '')}
                  </span>
                )}
              </span>
              {/* The product leaves the room the panel was opened from ticked
                  and unclickable: it is the group, and a group without it is
                  a different group. */}
              <button type="button" className="wb-group-check" role="checkbox"
                      aria-checked={inGroup} disabled={leads}
                      aria-label={room.topology_label || room.name}
                      onClick={() => (inGroup ? actions.leave(room.uuid)
                        : actions.join(room.uuid, zone.uuid))}>
                {inGroup ? <Icon.Check width={16} height={16} /> : null}
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}
