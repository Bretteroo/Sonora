import React, { useEffect, useRef, useState } from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { describeNowPlaying, formatDuration } from '../../frontend/src/lib/format.js'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import * as Icon from '../../frontend/src/components/Icons.jsx'
import Art, { nowPlayingArt } from './Art.jsx'
import { useTint } from './tint.js'
import Slider from './Slider.jsx'
import { broadcastLines, heldStation, heldStationLines, isStation, restingSecondary, useTransport } from './useTransport.js'
import { anchorAbove } from './menus.js'
import PlayerMenu, { hasPlayerMenu } from './PlayerMenu.jsx'
import { NpPause, NpPlay, NpRepeat, NpRepeatOne, NpShuffle, NpStop, NpVolume, NpVolumeMute, SpeakerOutline, StationGlyph } from './icons.jsx'

// Now Playing, as the product opens it from the artwork in the bottom-left:
// a card that takes the browse column's place while "Your System" stays put
// and the transport bar goes. Big art with the title beside it, the progress
// row under those, a row of large transport discs, the room's volume, and
// along the foot the queue, a pill naming the room (which opens the output
// selector) and, with a track loaded, its options. The X in the corner is the
// only way back; the header's arrows are not involved, since this view is not
// a step in the browse history. Measured on play.sonos.com at 1440x900 on
// 2026-09-14: card at 16,76 with 24px corners and padding, art 342px a further
// 24 in and 40 down, discs 64 (play 80) 52 apart, pill 56 tall.
export default function NowPlaying({ zone, label = '', grouping = false, onClose, onQueue, onRooms, onSearch, onRoomSound }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const {
    transport, playing, next, external, loaded, fixedSource, shuffled, repeat,
    canNext, canPrevious, orderable,
    elapsed, duration, seekable, cycleRepeat, toggleShuffle, togglePlay, seekAt,
  } = useTransport(zone)
  // Where the options panel hangs, rather than whether it is open: the product
  // floats it over the card and the column beside it, so it is placed from the
  // disc's own rectangle instead of inside the card, which clipped it.
  const [moreAt, setMoreAt] = useState(null)
  const more = useRef(null)
  // The controls a service declares for the playing item are not drawn here:
  // the product keeps them in the bar along the bottom, and this card's foot
  // holds the queue, the room and the options disc alone (2026-09-15).

  // The options popover closes on a click anywhere else, as the product's does.
  useEffect(() => {
    if (!moreAt) return undefined
    const onDown = (event) => {
      if (more.current?.contains(event.target)) return
      setMoreAt(null)
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [moreAt])

  if (!zone) return null
  const now = describeNowPlaying(transport, t)
  // Whoever made it, and not the album with it: the product prints "Chet
  // Baker" under Summertime where Sonora printed the artist, an em dash and
  // the whole album title (measured 2026-09-21).
  // describeNowPlaying joins the artist and the album with an em dash, which
  // is what the desktop replicas print; here the artist stands alone and the
  // joined line is only the fallback for a source with no artist at all.
  // A stopped station is its name alone here: the big player leaves the
  // service off (a stopped 80s80s Reggae, 2026-09-24).
  const held = heldStation(transport)
  const lines = broadcastLines(transport, t) || (held ? { title: held, sub: '' } : null)
  // An empty room says so under its title, as the product's big player does:
  // "No Music Selected" over "Queue is empty" (2026-09-24).
  const sub = lines ? lines.sub
    : transport.artist || restingSecondary(transport, now)
      || (loaded ? '' : t('common.queueIsEmpty'))
  // The options disc is there whatever the room holds, a stopped station with
  // no track and an empty room included: the product's foot under a stopped
  // Chill, a stopped 1010 WINS and an empty room carries it, the last
  // with Sleep Timer alone (2026-09-24). It had waited for a track. A room
  // with no line to offer (the browser room on a live stream) has none.
  // The product's "Search for ..." names the artist alone, not the artist and
  // album line under the title.
  const artist = transport.artist || ''
  const hasOptions = !fixedSource && hasPlayerMenu(zone, artist, Boolean(onSearch))
  // The queue disc belongs to a source that has a queue: the product's foot
  // under a Pandora station holds the room pill and the options disc alone,
  // since a station plays no queue (measured 2026-09-21). A speaker playing
  // its own queue says so in the URI it was given.
  // The big player's queue disc, like the bar's button, is there only while
  // the room plays its queue: on a stream its foot holds the room pill and
  // the "..." disc alone (play.sonos.com, 2026-09-22).
  const hasQueue = !fixedSource && !external && transport.source === 'queue'
  const remaining = duration ? Math.max(0, duration - elapsed) : 0
  // The panel wears the cover's color, the same one the room's card takes.
  const tint = useTint(nowPlayingArt(zone.host, transport)[0] || '')

  return (
    <section className="wb-np" aria-label={t('web.nowPlaying')}
             style={tint ? { background: tint.color, '--t-tint-fg2': tint.text,
                             '--t-tint-raise': tint.raise, '--t-tint-color': tint.color } : undefined}>
      <button type="button" className="wb-np-close" title={t('common.close')} onClick={onClose}>
        <Icon.Close width={16} height={16} />
      </button>
      <div className="wb-np-inner">
        {/* The art, the words, the discs and the volume are one block, set in
            the middle of the card with the foot along the bottom -- which is
            how the product places them in a tall window, where Sonora had the
            art at the top and the discs at the foot (measured 2026-09-21). */}
        <div className="wb-np-main">
        <div className="wb-np-top">
          <div className="wb-np-art"
               data-station={(transport.source !== 'tv' && !nowPlayingArt(zone.host, transport).length
                 && isStation(transport)) || undefined}>
            {transport.source === 'tv'
              ? <Icon.Tv width={140} height={140} />
              : !nowPlayingArt(zone.host, transport).length && isStation(transport)
                ? <StationGlyph className="wb-np-station" />
                : <Art src={nowPlayingArt(zone.host, transport)} size={342} />}
          </div>
          <div className="wb-np-text">
            <h1 className="wb-np-title">
              {lines ? lines.title : (now.primary || heldStation(transport) || t('common.noMusicSelected'))}
              {/* Bigger here than in a list: the product draws an 18px badge
                  7px after the title, in the card's own dim text rather than
                  a fixed gray (measured 2026-09-22 on a tinted card). */}
              {transport.explicit === true && (
                <Icon.Explicit className="wb-np-explicit" role="img"
                               aria-label={t('common.explicit')} />
              )}
            </h1>
            {sub && <h2 className="wb-np-sub">{sub}</h2>}
            {/* The service's wordmark under the artist, in its own type,
                which is what the product prints there ("pandora" beneath
                Paul Desmond). A service that publishes none shows its name
                instead, and the picture removes itself. */}
            {/* The slot stays when there is no mark to put in it: the product
                keeps an empty block 8 under the artist, so the progress row
                sits 28 below the second line either way (80s80s Reggae,
                2026-09-24), where Sonora's closed up by 8. */}
            <div className="wb-np-mark">
              {transport.service_id ? (
                <img className="wb-np-wordmark" alt={transport.service_name || ''}
                     src={`/api/services/wordmark/${transport.service_id}`}
                     onError={(event) => { event.currentTarget.style.display = 'none' }} />
              ) : null}
            </div>
            <div
              className="wb-np-progress"
              data-seekable={seekable}
              role={seekable ? 'slider' : undefined}
              aria-label={t('common.seek')}
              aria-valuenow={duration ? elapsed : undefined}
              onClick={seekAt}
            >
              {duration > 0 && <span className="wb-np-time">{formatDuration(elapsed)}</span>}
              <span className="wb-np-rail">
                <span className="wb-np-fill" style={{ width: duration ? `${Math.min(100, (elapsed / duration) * 100)}%` : '0%' }} />
              </span>
              {duration > 0 && <span className="wb-np-time wb-np-time-right">-{formatDuration(remaining)}</span>}
            </div>
          </div>
        </div>

        <div className="wb-np-controls">
          <button type="button" className="wb-np-disc wb-np-toggle" aria-pressed={shuffled} title={t('common.shuffle')}
                  onClick={toggleShuffle} disabled={!orderable}>
            <NpShuffle />
          </button>
          <button type="button" className="wb-np-disc wb-np-skip" title={t('common.previous')}
                  onClick={() => actions.previous(zone.uuid)} disabled={!canPrevious}>
            <Icon.Prev width={32} height={32} />
          </button>
          <button type="button" className="wb-np-disc wb-np-play"
                  title={!loaded ? t('common.nothingQueued') : next === 'stop' ? t('common.stop')
                    : next === 'pause' ? t('common.pause') : t('common.play')}
                  onClick={togglePlay} disabled={!loaded || fixedSource}>
            {fixedSource ? <Icon.Stop width={40} height={40} />
              : next === 'stop' ? <NpStop /> : next === 'pause' ? <NpPause /> : <NpPlay />}
          </button>
          <button type="button" className="wb-np-disc wb-np-skip" title={t('common.next')}
                  onClick={() => actions.next(zone.uuid)} disabled={!canNext}>
            <Icon.Next width={32} height={32} />
          </button>
          <button type="button" className="wb-np-disc wb-np-toggle" aria-pressed={repeat !== 'off'} title={t('common.repeat')}
                  onClick={cycleRepeat} disabled={!orderable}>
            {repeat === 'one' ? <NpRepeatOne /> : <NpRepeat />}
          </button>
        </div>

        <div className="wb-np-volume" data-muted={zone.muted || undefined}>
          <button type="button" className="wb-np-mute" title={zone.muted ? t('common.unmute') : t('common.mute')}
                  aria-pressed={zone.muted} onClick={() => actions.setMute(zone.uuid, !zone.muted)}>
            {zone.muted ? <NpVolumeMute /> : <NpVolume />}
          </button>
          <Slider value={zone.volume} label={t('web.roomVolume', { room: zone.name })}
                  onCommit={(level) => actions.setVolume(zone.uuid, level)} />
          <output className="wb-np-level">{zone.volume}</output>
        </div>
        </div>

        <div className="wb-np-foot">
          <span className="wb-np-foot-side">
            {hasQueue && (
              <button type="button" className="wb-np-disc wb-np-small" title={t('common.queue')} onClick={onQueue}>
                <Icon.Queue width={24} height={24} />
              </button>
            )}
          </span>
          {/* While the rooms are open beside it the pill is solid white with
              the card's own color for its words, which is how the product
              says which panel the button belongs to (2026-09-21). */}
          <button type="button" className="wb-np-pill" data-open={grouping || undefined}
                  title={t('web.outputSelector')} aria-expanded={grouping} onClick={onRooms}>
            {/* One speaker, for a group as for a room on its own: the
                product draws the same outline beside "<room> + 1"
                (seen 2026-09-30, a group of two). */}
            <SpeakerOutline />
            <span>{label || zone.name}</span>
          </button>
          <span className="wb-np-foot-side wb-np-foot-end">
            {hasOptions && (
              <span className="wb-np-more" ref={more}>
                <button type="button" className="wb-np-disc wb-np-small" title={t('web.moreOptions')}
                        aria-expanded={Boolean(moreAt)}
                        onClick={(event) => {
                          const at = anchorAbove(event)
                          setMoreAt((open) => (open ? null : at))
                        }}>
                  <Icon.Ellipsis width={24} height={24} />
                </button>
                <PlayerMenu zone={zone} artist={artist} anchor={moreAt}
                            onClose={() => setMoreAt(null)} onSearch={onSearch} onRoomSound={onRoomSound} />
              </span>
            )}
          </span>
        </div>
      </div>
    </section>
  )
}
