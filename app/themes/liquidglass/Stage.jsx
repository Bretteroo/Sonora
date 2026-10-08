import React, { useEffect, useState } from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import Art, { nowPlayingArt, cachedArt } from '../../frontend/src/components/Art.jsx'
import * as I from './icons.jsx'
import { Sheet, IconButton, Slider } from './ui.jsx'
import { TransportControls, SeekBar, ModeToggles } from './NowBar.jsx'
import { QueueList } from './QueueDrawer.jsx'
import { nowLines, isLoaded, useProviderMetadata, groupTitle } from './house.js'
import { useOptimisticRatings } from '../../frontend/src/lib/optimisticRatings.js'
import { isConnectSession } from '../../frontend/src/lib/transport.js'

// The stage: the room in view filling the window. The artwork, blurred,
// lights the whole surface; the lines are captioned the way the source calls
// for; the service's own rating buttons sit under them; every room of the
// group has its own volume; the queue runs down the side, shown or hidden
// with the same Queue button as the bar's drawer. When the queue is empty or
// is not what plays (a station, a TV, a Connect session) the column starts
// hidden, and the button opens it for this visit only.

export default function Stage({ zone, group, zones, queue, queueOpen, onQueue, onClose, onInfo, onMessage, onRooms, onQueueEdited }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const tr = zone?.transport || {}
  const { provider, refresh } = useProviderMetadata(zone)
  const lines = nowLines(tr, provider, t)
  const loaded = isLoaded(tr)
  const art = zone && tr.source !== 'tv' ? nowPlayingArt(zone.host, tr) : []
  const artUrl = Array.isArray(art) ? art[0] : art
  const members = (group?.members || []).map((u) => zones[u]).filter(Boolean)
  // A Spotify Connect session plays Spotify's own queue, which no controller
  // can list: the room's queue is not what plays, and the coming track is the
  // one the speaker reports. Every theme answers it this way.
  const nextTrack = isConnectSession(tr) ? (tr.next_title ? { title: tr.next_title, artist: tr.next_artist } : null)
    : tr.source === 'queue' ? queue.items[(tr.track_number || 0)] : null

  const queueCount = queue.total || queue.items.length
  const queuePlays = tr.source === 'queue' && !isConnectSession(tr) && queueCount > 0
  const [peek, setPeek] = useState(false)
  useEffect(() => { setPeek(false) }, [queuePlays])
  const showQueue = queuePlays ? queueOpen : peek

  // Ratings: a service's own buttons from its presentation map, or Pandora's
  // thumbs. A press flips the icon and is confirmed by the service's message.
  const serviceRatings = (provider?.ratings || []).filter((b) => b.icon)
  const ratedItem = tr.item_id || (() => {
    const m = /^x-sonos-http:([^?]+?)(?:\.[a-z0-9]+)?\?/i.exec(tr.track_uri || '')
    try { return m ? decodeURIComponent(m[1]) : '' } catch { return '' }
  })()
  const [ratedFor, setRatedFor] = useState({ item: '', state: 0 })
  const rated = ratedFor.item && ratedFor.item === ratedItem ? ratedFor.state : (tr.rating || 0)
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

  return (
    <Sheet kind="full" title={t('desk.now.title')} onClose={onClose} className="sf-stage">
      <div className="sf-stage-bg" style={artUrl ? { backgroundImage: `url("${artUrl}")` } : undefined} aria-hidden="true" />
      <header className="sf-stage-head">
        <IconButton label={t('common.close')} onClick={onClose}><I.ChevronDown /></IconButton>
        <button type="button" className="sf-room-chip" onClick={onRooms}>
          <I.Speaker /><span>{groupTitle(group, zones, t)}</span>
        </button>
        <span className="sf-stage-source">{tr.service_name || (tr.source ? t(`source.${tr.source}`) : '')}</span>
        <IconButton label={t('common.queue')} active={showQueue} onClick={queuePlays ? onQueue : () => setPeek((v) => !v)} badge={queueCount}><I.Queue /></IconButton>
      </header>
      <div className="sf-stage-body" data-queue={showQueue || undefined}>
        <section className="sf-stage-main">
          <div className="sf-stage-art">
            {tr.source === 'tv' ? <I.Tv /> : <Art src={art} size={420} fallback="note" />}
          </div>
          <div className="sf-stage-lines">
            {loaded ? lines.map(([caption, value], index) => (
              <p key={caption} className={index === 0 ? 'sf-stage-title' : 'sf-stage-line'}>
                <span className="sf-caption">{caption}</span>
                <span className="sf-value">{value}</span>
                {/* The service's own explicit flag, on the title line. */}
                {index === 0 && value && tr.explicit === true && (
                  <I.Explicit className="sf-explicit" role="img" aria-label={t('common.explicit')} />
                )}
              </p>
            )) : <p className="sf-stage-title"><span className="sf-value">{t('desk.now.noMusic')}</span></p>}
            {nextTrack && (
              <p className="sf-stage-line sf-stage-next">
                <span className="sf-caption">{t('desk.now.next')}</span>
                <span className="sf-value">{[nextTrack.title, nextTrack.artist].filter(Boolean).join(' · ')}</span>
              </p>
            )}
            {loaded && serviceRatings.length > 0 && (
              <div className="sf-ratings">
                {shownRatings.map((button) => (
                  <button key={button.id} type="button" className="sf-rating" aria-disabled={button.inert || undefined}
                          title={button.inert ? t('rating.cannotUndo', { service: tr.service_name || '' }) : (button.label || '')} onClick={() => pressRating(button, rateById)}>
                    {/* Through Sonora, like every other picture the page draws. */}
                    <img src={cachedArt(button.icon)} alt={button.label || ''} />
                  </button>
                ))}
              </div>
            )}
            {loaded && (tr.source === 'queue' || tr.service_id) && (
              <button type="button" className="sf-link" onClick={onInfo}><I.Info />{t('desk.now.infoOptions')}</button>
            )}
          </div>
          <div className="sf-stage-controls">
            <SeekBar zone={zone} remaining={false} />
            <div className="sf-stage-transport">
              <ModeToggles zone={zone} size="md" />
              <TransportControls zone={zone} size="lg" showSeekSteps />
              <span className="sf-stage-spacer" />
            </div>
          </div>
          <div className="sf-stage-volumes">
            {members.length > 1 && (
              <div className="sf-vol-row sf-vol-group">
                <span className="sf-vol-name">{t('desk.transport.groupVolume')}</span>
                <IconButton size="sm" label={zone.group_muted ? t('common.unmute') : t('common.mute')} onClick={() => actions.setMute(zone.uuid, !zone.group_muted, true)}>
                  {zone.group_muted ? <I.Muted /> : <I.Volume />}
                </IconButton>
                <Slider value={zone.group_volume ?? 0} label={t('desk.transport.groupVolume')} onCommit={(level) => actions.setGroupVolume(zone.uuid, level)} />
              </div>
            )}
            {(members.length ? members : [zone]).filter(Boolean).map((m) => (
              <div key={m.uuid} className="sf-vol-row">
                <span className="sf-vol-name">{m.name}</span>
                <IconButton size="sm" label={m.muted ? t('common.unmute') : t('common.mute')} onClick={() => actions.setMute(m.uuid, !m.muted)}>
                  {m.muted ? <I.Muted /> : <I.Volume />}
                </IconButton>
                <Slider value={m.volume ?? 0} label={m.name} onCommit={(level) => actions.setVolume(m.uuid, level)} />
              </div>
            ))}
          </div>
        </section>
        {showQueue && (
          <aside className="sf-stage-queue" aria-label={t('desk.queue.title')}>
            <h3>{t('desk.queue.title')} <small>{t.plural('desk.queue.songs', queueCount)}</small></h3>
            <QueueList zone={zone} queue={queue} onInfo={onInfo} onEdited={onQueueEdited} compact />
          </aside>
        )}
      </div>
    </Sheet>
  )
}
