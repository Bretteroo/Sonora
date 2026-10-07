import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import * as Icon from '../../frontend/src/components/Icons.jsx'
import Art, { nowPlayingArt } from './Art.jsx'
import { Bin, Handle } from './icons.jsx'
import { useTint } from './tint.js'
import { useQueue } from '../../frontend/src/lib/useQueue.js'
import { useTransport } from './useTransport.js'

// The queue, where the product keeps it: in the column "Your System" was in.
//
// Measured on play.sonos.com 2026-09-19 against a 50-track album queued on
// one room. It is not a dialog over the page: the right-hand column
// becomes the queue, headed by the word Queue over the track count, with
// shuffle, repeat, a bin to empty it and the X to leave along the top. Each
// row is 40px of art, the title, and the kind beneath it -- "Song" -- with a
// "..." and a drag handle at the right. The row playing now is lit, carries
// a small equaliser in front of its title, and has no "..." of its own.
//
// Sonora's was a centered modal listing "title . artist" with a play disc on
// every row, which is a reasonable thing and not this one.

export default function QueuePanel({ zone, onClose }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  // Depends on what actually changes rather than on the whole zone object,
  // which the store replaces on every tick.
  const state = useQueue(zone, { count: 200 })
  const { shuffled, repeat, cycleRepeat, toggleShuffle, connect } = useTransport(zone)
  const transport = zone?.transport || {}

  const current = zone?.transport?.track_number ?? 0
  const tint = useTint(zone ? (nowPlayingArt(zone.host, zone.transport || {})[0] || '') : '')
  // The queue opens on the track playing, not on the first: with 47 queued
  // and the 25th up, the product's panel shows "Lolo - Intro" at the top of
  // its list (play.sonos.com, 2026-09-22). Once, when the rows first arrive;
  // after that the reader's scrolling is left alone.
  const rows = useRef(null)
  const placed = useRef(false)
  // A row's "..." opens one item, Remove from Queue, in a panel whose right
  // edge meets the button's and whose top stands 12px under it
  // (play.sonos.com, 2026-09-22). It had skipped to the track.
  const [menu, setMenu] = useState(null)
  useEffect(() => {
    if (!menu) return undefined
    const close = () => setMenu(null)
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', close)
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', close) }
  }, [menu])
  useLayoutEffect(() => {
    if (placed.current || !rows.current || !state.items.length) return
    // Not until the row is there: the queue can arrive a page at a time,
    // and giving up on the first page left the panel on track one.
    const row = rows.current.querySelector('[data-playing]')
    if (!row) return
    rows.current.scrollTop = row.offsetTop - rows.current.offsetTop
    placed.current = true
  }, [state.items.length, current])

  if (!zone) return null

  return (
    /* The queue is the room's own panel, so it takes the room's color the
       way its card and its grouping pane do: the product's reads rgb(29,24,22)
       under a cover that paints the card the same (measured 2026-09-22),
       where Sonora's stayed the ordinary surface. */
    <section className="wb-queue" aria-label={t('common.queue')}
             style={tint ? { background: tint.color, '--t-tint-fg2': tint.text,
                             '--t-tint-raise': tint.raise, '--t-tint-color': tint.color } : undefined}>
      <header className="wb-queue-head">
        <div className="wb-queue-title">
          <h2>{t('common.queue')}</h2>
          <p>
            {connect ? t('web.queue.startedFrom', { service: transport.service_name || 'Spotify' })
              : state.loading ? t('web.queue.reading')
              : state.total === 0 ? t('common.queueIsEmpty')
              : t.plural('web.queue.tracks', state.total)}
          </p>
        </div>
        <button type="button" className="wb-icon-btn" aria-pressed={shuffled}
                data-toggle="shuffle" title={t('common.shuffle')} onClick={toggleShuffle}>
          <Icon.Shuffle width={20} height={20} />
        </button>
        <button type="button" className="wb-icon-btn" aria-pressed={repeat !== 'off'}
                data-toggle="repeat" title={t('common.repeat')} onClick={cycleRepeat}>
          {repeat === 'one' ? <Icon.RepeatOne width={20} height={20} />
            : <Icon.Repeat width={20} height={20} />}
        </button>
        <button type="button" className="wb-icon-btn" title={t('web.queue.clear')}
                disabled={connect || !state.total}
                onClick={() => { actions.clearQueue(zone.uuid); onClose() }}>
          <Bin />
        </button>
        <button type="button" className="wb-icon-btn wb-queue-close"
                title={t('common.close')} onClick={onClose}>
          <Icon.Close width={16} height={16} />
        </button>
      </header>

      {menu && (
        <div className="wb-item-menu wb-queue-menu" role="menu"
             style={{ right: `${menu.right}px`, top: `${menu.top}px` }}
             onPointerDown={(event) => event.stopPropagation()}>
          <button type="button" role="menuitem"
                  onClick={() => { actions.removeFromQueue(zone.uuid, menu.index); setMenu(null) }}>
            <Bin />
            <span>{t('web.queue.remove')}</span>
          </button>
        </div>
      )}

      {/* A Spotify Connect session plays a queue that lives in Spotify's cloud,
          where no controller can list it. The product heads the panel
          "Started from Spotify" and shows the playing track in a card under
          the service's wordmark, then placeholder rows that never fill in
          (2026-10-04). Sonora shows what the speaker does know in
          their place: the track that comes next. */}
      {connect ? (
        <div className="wb-queue-rows">
          <div className="wb-queue-connect">
            <div className="wb-np-mark">
              {transport.service_id ? (
                <img className="wb-np-wordmark" alt={transport.service_name || ''}
                     src={`/api/services/wordmark/${transport.service_id}`}
                     onError={(event) => { event.currentTarget.replaceWith(document.createTextNode(transport.service_name || '')) }} />
              ) : (transport.service_name || '')}
            </div>
            <div className="wb-queue-row" data-playing>
              <span className="wb-queue-art"><Art src={nowPlayingArt(zone.host, transport)} size={20} fallback="track" /></span>
              <span className="wb-queue-text">
                <span className="wb-queue-name">
                  {transport.state === 'PLAYING' && (
                    <Icon.Signal className="wb-queue-bars" width={14} height={14} aria-label={t('web.queue.playing')} />
                  )}
                  <span>{transport.title}</span>
                </span>
                <span className="wb-queue-kind">{transport.artist || t('web.kind.track')}</span>
              </span>
            </div>
          </div>
          {transport.next_title && (
            <div className="wb-queue-row">
              <span className="wb-queue-art"><Art src="" size={20} fallback="track" /></span>
              <span className="wb-queue-text">
                <span className="wb-queue-name"><span>{transport.next_title}</span></span>
                <span className="wb-queue-kind">{transport.next_artist || t('web.kind.track')}</span>
              </span>
            </div>
          )}
        </div>
      ) : (
      <div className="wb-queue-rows" ref={rows}>
        {state.items.map((item, index) => {
          const playing = index + 1 === current
          return (
            <div className="wb-queue-row" key={`${item.id}-${index}`} data-playing={playing || undefined}>
              <span className="wb-queue-art"><Art src={item.art} size={20} fallback="track" /></span>
              <span className="wb-queue-text">
                <span className="wb-queue-name">
                  {/* The product marks the track playing with an equaliser in
                      front of its title rather than a word beside it. */}
                  {/* Only while it plays: stopped on "Lolo - Intro", the
                      product's row carries the title and its badge alone
                      (2026-09-22). */}
                  {playing && zone.transport?.state === 'PLAYING' && (
                    <Icon.Signal className="wb-queue-bars" width={14} height={14} aria-label={t('web.queue.playing')} />
                  )}
                  <span>{item.title}</span>
                  {item.explicit === true && (
                    <Icon.Explicit className="wb-explicit" role="img" aria-label={t('web.explicit')} />
                  )}
                </span>
                {/* Whoever made it, which is what the product prints under
                    a queued track's title -- "Miles Davis", not "Song"
                    (measured 2026-09-22). A track with no artist keeps the
                    word for what it is. */}
                <span className="wb-queue-kind">{item.artist || t('web.kind.track')}</span>
              </span>
              {!playing && (
                <button type="button" className="wb-icon-btn" title={t('web.moreTitle')}
                        aria-expanded={menu?.index === index + 1}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          const box = event.currentTarget.getBoundingClientRect()
                          setMenu((open) => (open?.index === index + 1 ? null
                            : { index: index + 1, right: Math.round(window.innerWidth - box.right), top: Math.round(box.bottom + 12) }))
                        }}>
                  <Icon.Ellipsis width={20} height={20} />
                </button>
              )}
              {/* The product's handle drags a track up and down the queue.
                  Sonora has no reorder yet, so it is drawn and disabled
                  rather than pretended at. */}
              <span className="wb-queue-grip" aria-hidden="true">
                <Handle />
              </span>
            </div>
          )
        })}
      </div>
      )}
    </section>
  )
}
