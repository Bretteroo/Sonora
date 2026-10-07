import { SaveQueueDialog } from './Dialogs.jsx'
import React, { useEffect, useRef, useState } from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { useQueue } from '../../frontend/src/lib/useQueue.js'
import { api } from '../../frontend/src/lib/api.js'
import { streamText, describeNowPlaying } from '../../frontend/src/lib/format.js'
import { useProviderItem } from '../../frontend/src/lib/useProviderItem.js'
import * as Icon from '../../frontend/src/components/Icons.jsx'
import { MarqueeProvider, MarqueeText } from '../../frontend/src/lib/marquee.jsx'
import Art, { nowPlayingArt, cachedArt } from '../../frontend/src/components/Art.jsx'
import { useOptimisticRatings } from '../../frontend/src/lib/optimisticRatings.js'

// The center column: Now Playing above (273px: a 32px header over a 241px
// body with 139px art at (16,20) and text lines from x=182), the Queue below
// (32px header, 42px rows, 32px footer of Clear Queue | Save Queue).

// The app prints a release date as a plain calendar date: Pocket Casts
// returns 2026-09-07T00:00:00.000Z and the app shows 9/7/2026. Reading it as
// an instant would shift it a day west of UTC, so the date part is taken as
// written and never converted.
function releaseDate(value) {
  const parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '')
  if (!parts) return value || ''
  const when = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))
  return Number.isNaN(when.getTime()) ? value : when.toLocaleDateString()
}

export function NowPlaying({ zone, onInfo, onMessage, groupLabel = '', onArt, nextTrack, marquee = false }) {
  const { t } = useI18n()
  const { actions } = useSystem()
  const transport = zone?.transport ?? {}
  // What "Next" names. A shell that lists the queue passes the entry after
  // the playing one (null when there is none); one that passes nothing gets
  // the track the speaker itself reports as next, which is also how the Mac
  // app names it under a Spotify Connect session, whose cloud queue no
  // controller can list ("Boys Don't Cry - Single Version - The Cure" under
  // Inside Out, 2026-09-29).
  const coming = nextTrack !== undefined ? nextTrack
    : transport.next_title ? { title: transport.next_title, artist: transport.next_artist } : null
  const now = describeNowPlaying(transport, t)
  // A room stopped with nothing loaded reads "[No music selected]" in the
  // Song slot even when the speaker still reports the station's name as its
  // title: the station belongs under the art instead (Windows app, seen
  // 2026-09-06 on a stopped Pandora room).
  const loaded = Boolean(transport.track_uri) || (transport.queue_length ?? 0) > 0
  const title = (loaded && (transport.title || now.primary)) || t('desk.now.noMusic')
  // The Mac app fills an empty line with the field's name; a theme that
  // captions each line instead (Windows) hides that placeholder. With
  // nothing loaded at all the Mac app shows "[No music selected]" alone
  // (2026-09-23), which the lines' data-idle lets it say.
  const artistText = transport.artist || now.secondary || ''
  const albumText = transport.album || now.detail || ''
  const artist = artistText || t('desk.now.artist')
  const album = albumText || t('desk.now.album')
  const number = transport.track_number || 0
  const total = transport.queue_length || 0
  // A service broadcast (x-sonosapi-stream) has no track of its own: the
  // speaker reports the stream URL as the title and announces what is on
  // through r:streamContent. The app labels those three slots Station / On
  // Now / Information instead of Song / Artist / Album, and prints nothing
  // under the art, because the Station line already names the station
  // (measured 2026-09-06 on 80s80s Sould Ballads).
  const broadcast = /^x-sonosapi-stream:/.test(transport.media_uri || '')
  // The built-in TuneIn, sid 254. S2's "TuneIn (New)" is a different service
  // (333) and the app's own badge is bound to the old one.
  const tuneIn = transport.service_id === 254
    || /^tunein$/i.test(transport.service_name || transport.service || '')
  // What the provider says the playing item is. The apps take their three
  // labels from here, not from the DIDL: Pocket Casts answers
  // getMediaMetadata with semanticType "episode.podcast" plus the show and a
  // release date, and the app prints Episode / Podcast / Release Date, while
  // the queue entry itself carries an empty artist and album (2026-09-06).
  // A starting stream has no track text, only a placeholder, and the app
  // shows it briefly and then drops the whole Information line. Measured on
  // 2026-09-06 with one station sampled three times: at 4s "Information
  // Starting...", at 15s and 40s no Information line at all, while the
  // speaker went on reporting ZPSTR_BUFFERING throughout. So the placeholder
  // is shown only while it is fresh, counted from the media changing.
  // Measured against the app on 2026-09-12, starting BBC Radio 1 on a room and
  // sampling both once a second: the app printed "Information Connecting..."
  // from 4.8s to 6.3s after the click and then dropped it, while the speaker
  // went on reporting ZPSTR_CONNECTING for at least another seven seconds. So
  // the app shows a placeholder for a moment and then gives up on it rather
  // than mirroring the speaker. Ten seconds was far too generous. The app's
  // window was visible across three samples 0.94s apart and gone by the next,
  // so the real figure is between about 1.2 and 1.9 seconds.
  const PLACEHOLDER_MS = 1500
  const [, setTick] = useState(0)
  const startedAt = useRef({ media: '', at: 0 })
  if (startedAt.current.media !== (transport.media_uri || '')) {
    startedAt.current = { media: transport.media_uri || '', at: Date.now() }
  }
  const raw = transport.stream_content || ''
  const placeholder = /^ZPSTR_/.test(raw.trim())
  const fresh = Date.now() - startedAt.current.at < PLACEHOLDER_MS
  useEffect(() => {
    if (!placeholder || !fresh) return undefined
    const timer = setTimeout(() => setTick((v) => v + 1), PLACEHOLDER_MS)
    return () => clearTimeout(timer)
  }, [startedAt.current.media, placeholder, fresh])
  // Nothing on air means nothing to print. A speaker goes on reporting the
  // last stream text after it stops, and Sonora used to show it: a station
  // sitting stopped listed the track it had been playing, which the app never
  // does.
  // A placeholder lives by its own clock: a starting stream flaps through
  // STOPPED and TRANSITIONING on the way up, and gating it on the state made
  // it flicker or vanish. Real stream text is gated the other way -- a speaker
  // keeps reporting the last track after it stops, and the app prints nothing.
  const onAir = transport.state === 'PLAYING' || transport.state === 'TRANSITIONING'
  const information = (placeholder ? fresh : onAir) ? streamText(raw, t) : ''

  // What the service says this item is, and the rating buttons it declares.
  // Shared with the web theme (lib/useProviderItem.js): both read the same
  // capability, neither knows anything about a particular service.
  const { provider, ratings: serviceRatings, itemId: providerItem,
          refresh: refreshProvider } = useProviderItem(zone, transport)
  const episode = provider && /^episode\./.test(provider.semantic_type || '')
  // An audiobook chapter: the service's metadata names an author and a
  // narrator instead of an artist and album (Libby by OverDrive), or the
  // speaker reports the audioBook class. The app then labels the lines
  // Chapter / Author / Narrator and prints "Book" under the art over the
  // book's title (Windows app, 2026-09-07).
  // Only while the chapter plays straight from the service: queued, the app
  // labels it as any queue track, "Song [4/21] / Artist" with "Next" below
  // (measured 2026-09-07 with the same book in the queue).
  const audiobook = transport.source !== 'queue' && Boolean(provider?.author || provider?.narrator
    || transport.narrator || transport.track_kind === 'audiobook')
  // A Spotify Connect session on an S2 room (x-sonos-vli:). The S2 Windows
  // app gives its three lines no captions and puts the coming track under
  // the art with no "Next" over it: the native library returns empty labels
  // for this source, and its fourth line is the next track (2026-10-04;
  // nowplayingpanel.xaml metadata4). On S1 a Connect session is
  // a queue (#vli) and keeps "Song [1/1]" and "Next".
  const connectS2 = /^x-sonos-vli:/.test(transport.media_uri || '')
  const lines = audiobook
    ? [
        [t('desk.now.chapter'), provider?.title || transport.title || '', true],
        [t('desk.now.author'), provider?.author || transport.artist || '', true],
        [t('desk.now.narrator'), provider?.narrator || transport.narrator || '',
          Boolean(provider?.narrator || transport.narrator)],
      ]
    : episode
    ? [
        [t('desk.now.episode'), provider.title || transport.title || '', true],
        [t('desk.now.podcast'), provider.podcast || provider.artist || '', true],
        [t('desk.now.releaseDate'), releaseDate(provider.release_date), true],
      ]
    : transport.source === 'tv'
    ? [
        // A soundbar on its television input: TV, the input when the cloud
        // names it, and the format the speaker says it is receiving
        // (HTAudioIn, see lib/tvFormat.js), under captions of their own
        // rather than Artist and Album (2026-10-04).
        [t('desk.info.source'), now.primary, true],
        [t('desk.now.tvInput'), now.secondary, Boolean(now.secondary)],
        [t('desk.now.tvFormat'), now.detail, Boolean(now.detail)],
      ]
    : broadcast
    ? [
        [t('desk.now.station'), transport.container_title || '', true],
        [t('desk.now.onNow'), transport.stream_show || '', true],
        [t('desk.now.information'), information, Boolean(information)],
      ]
    : [
        // A room on its queue counts even when the queue is empty: the
        // Windows app reads "Song [0/0]" over "[No music selected]" there,
        // with no Artist line under it (2026-09-29).
        [transport.source === 'queue'
          ? t('desk.now.song', { n: number, total })
          : t('desk.now.songLabel'), title, true],
        [t('desk.now.artist'), artist, Boolean(artistText) || loaded],
        [t('desk.now.album'), album, Boolean(albumText)],
      ].map(([caption, value, shown]) => [connectS2 ? '\u00a0' : caption, value, shown])
  // The Info & Options glyph follows the source's own info view. Measured
  // against the app on 2026-09-06, room by room: the queue has one (a Plex
  // album), and so does a service station or stream
  // (Pandora on x-sonosapi-radio, 80s80s on x-sonosapi-stream). A service
  // TRACK played straight out of a browse list does not -- a room on a
  // Plex track, whose media URI is the track itself, shows no glyph in the
  // app even though it carries a service id. Nor do raw HTTP streams, the
  // television, or a room holding nothing.
  const station = /^x-sonosapi-(radio|stream|hls):/.test(transport.media_uri || '')
  // The S2 app shows it for a Spotify Connect session too, and opens the
  // song's options there (2026-10-04).
  const showInfo = loaded && (transport.source === 'queue' || station || connectS2)
  // The SMAPI id of what is playing, carried in the track URI as
  // x-sonos-http:<encoded id>.<ext>?sid=..., which is what a rating names.
  // Which thumb was pressed for the current item; cleared when it changes.
  // 0 none, 1 thumbs up, 2 thumbs down; a second press on the lit thumb
  // removes the rating, as the provider's map defines.
  const [ratedFor, setRatedFor] = useState({ item: '', state: 0 })
  const ratedItem = transport.item_id || (() => {
    const m = /^x-sonos-http:([^?]+?)(?:\.[a-z0-9]+)?\?/i.exec(transport.track_uri || '')
    try { return m ? decodeURIComponent(m[1]) : '' } catch { return '' }
  })()
  // The speakers report the rating with the track; a rating made in any
  // controller shows, and a press here is kept only until that report moves.
  useEffect(() => { setRatedFor({ item: '', state: 0 }) }, [transport.rating, ratedItem])
  const status = zone ? t('desk.now.song', { n: number, total }) : ''
  const rated = ratedFor.item && ratedFor.item === ratedItem ? ratedFor.state : (transport.rating || 0)
  // A press sends the rating the button names. The button stays where it is
  // and flips to the other state's icon, as the app's does.
  const rateById = async (button) => {
    // A lit button the service gives no way back from does nothing (see
    // rating_is_inert in backend/main.py: AccuRadio's loved star).
    if (button.inert) return
    const item = providerItem || ratedItem
    if (!item) return
    const result = await actions.rateItemById(zone.uuid, transport.service_id, item, button.id)
    if (result?.ok) {
      onMessage?.(result.message || button.message || '')
      refreshProvider()
    }
    return result?.ok
  }
  // A toggle is drawn pressed at the press (lib/optimisticRatings.js).
  const { ratings: shownRatings, press: pressRating } = useOptimisticRatings(serviceRatings, `${zone?.uuid}|${transport.track_uri || ''}`)

  return (
    <section className="dk-pane" aria-label={t('desk.now.title')}>
      <div className="dk-header">
        <h2 className="dk-header-title">
          {t('desk.now.title')}
          {zone && <span className="dk-header-sub dk-header-room">({groupLabel || zone.name})</span>}
        </h2>
        {/* The Windows app keeps Info & Options as an (i) in the header, and
            takes it away when the room holds nothing to describe (seen
            2026-09-06 on a stopped room). */}
        {showInfo && (
          <button type="button" className="dk-header-btn dk-now-info-header" disabled={!zone}
                  title={t('desk.now.infoOptions')} onClick={onInfo}>
            <Icon.Info />
          </button>
        )}
      </div>
      {/* `marquee`: true for the Windows app's, 'mac' for the Mac app's. */}
      <MarqueeProvider enabled={Boolean(marquee)} style={marquee === 'mac' ? 'mac' : 'windows'}>
      <div className="dk-now">
        {/* In the Windows app the art toggles the Mini Controller. */}
        <div className={`dk-now-art${onArt ? ' dk-now-art-button' : ''}`} onClick={onArt}
             role={onArt ? 'button' : undefined} tabIndex={onArt ? 0 : undefined}
             onKeyDown={onArt ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onArt() } } : undefined}>
          {transport.source === 'tv'
            ? <Icon.Tv />
            : <Art src={zone ? nowPlayingArt(zone.host, transport) : ''} size={56} />}
        </div>
        <div className="dk-now-lines" data-idle={loaded ? undefined : 'true'}>
          {lines.map(([caption, value, shown], index) => shown && (
            <p key={index}
               className={`dk-now-line ${index === 0 ? 'dk-now-title' : 'dk-now-muted'}${value ? '' : ' dk-now-placeholder'}`}
               title={value || undefined} data-caption={caption}>
              <MarqueeText className={index === 0 && value && transport.explicit === true ? 'dk-marquee-badged' : ''}>{value}</MarqueeText>
              {/* The app's explicit mark, and only here: an 11px badge 5px
                  after the title when the service calls the track explicit
                  (nowplaying/metadatacontrol.xaml, Width="11"
                  Margin="5,0,5,1"). A browse row carries the word in its
                  accessible name and no picture, which is why there is none
                  there. */}
              {index === 0 && value && transport.explicit === true && (
                <Icon.ExplicitWin className="dk-now-explicit" role="img"
                                  aria-label={t('common.explicit')} />
              )}
            </p>
          ))}
        </div>
        {/* Under the art the app prints the service and what it plays for a
            station, and "Next" with the coming track when the queue plays
            (observed 2026-09-05). */}
        {/* While a TuneIn station plays the app prints TuneIn's wordmark under
            the art, and nothing else: nowplayingpanel.xaml:137 draws
            np_TuneIn_radio_55x24 at its native size, bottom left of the art's
            row, and binds it to RadiotimeVisibility -- Radiotime being
            TuneIn's older name, so it is that service alone, not a badge
            every service gets. That wordmark is TuneIn's artwork, so Sonora
            prints the name in its place. */}
        {broadcast && tuneIn ? (
          <p className="dk-now-badge">TuneIn</p>
        ) : broadcast ? null : audiobook ? (
          // The app names the book under a chapter's art wherever it plays
          // from (Windows app, 2026-09-07), ahead of the queue's "Next".
          <p className="dk-now-source">
            <strong>{t('desk.now.book')}</strong>
            <MarqueeText>{provider?.book || transport.book || transport.container_title || ''}</MarqueeText>
          </p>
        ) : connectS2 ? (transport.next_title && (
          <p className="dk-now-source">
            <MarqueeText>{[transport.next_title, transport.next_artist].filter(Boolean).join(' - ')}</MarqueeText>
          </p>
        )) : transport.source === 'queue' && coming ? (
          <p className="dk-now-source">
            <strong>{t('desk.now.next')}</strong>
            <MarqueeText>{[coming.title, coming.artist].filter(Boolean).join(' - ')}</MarqueeText>
          </p>
        ) : transport.source === 'tv' ? null : (transport.service_name || transport.container_title) && (
          // Not for a soundbar on TV: its container title is the speaker's
          // own id (RINCON_...), and the lines above already say TV.
          // data-generic: no service to name, only Sonora's word for the
          // source ("Network stream"); the Mac app shows no line then.
          <p className="dk-now-source" data-generic={transport.service_name ? undefined : 'true'}>
            <strong>{transport.service_name || t(`source.${transport.source || 'unknown'}`)}</strong>
            <MarqueeText>{transport.container_title}</MarqueeText>
          </p>
        )}
        {/* The buttons a service declares for what it is playing: its
            NowPlayingRatings map matches a property of the item and names the
            icon, the rating to send and the message after it. Amazon Music's
            heart is this (2026-09-07). */}
        {loaded && serviceRatings.length > 0 && (
          <div className="dk-now-rating">
            {shownRatings.map((button) => (
              <button key={button.id} type="button" aria-disabled={button.inert || undefined}
                      title={button.inert ? t('rating.cannotUndo', { service: transport.service_name || '' }) : (button.label || '')}
                      onClick={() => pressRating(button, rateById)}>
                {/* The service's own picture, for a rating family
                    Sonora draws no glyph for. Through the art proxy like
                    everything else: the page fetches from Sonora and
                    nowhere else, and this one is cached as a bonus. */}
                <img src={cachedArt(button.icon)} alt="" />
              </button>
            ))}
          </div>
        )}
        <p className="dk-now-status">{status}</p>
        <button type="button" className="dk-now-info" disabled={!zone} onClick={onInfo}>
          <Icon.Info />
          {t('desk.now.infoOptions')}
        </button>
      </div>
      </MarqueeProvider>
    </section>
  )
}

export function Queue({ zone, expanded = false, onExpand, SaveDialog = SaveQueueDialog, ClearDialog = null, onItems, onInfo, onEdited, emptyKey = 'desk.queue.empty', scrollSignal = 0, cloudQueueInUse = true }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  // The fetch and its refresh rule are shared: lib/useQueue.js.
  const { items, total, reload: reloadQueue } = useQueue(zone, { onItems })
  // Observed in the app (2026-09-05): a click selects a row, a double-click
  // plays it; hovering shows a caret and a checkbox; the caret or a right
  // click opens Play Song | Remove Song | Info & Options | Unselect All,
  // a rule between each. Ticked rows are removed together.
  const [selected, setSelected] = useState(null)
  const [checked, setChecked] = useState(() => new Set())
  const [menu, setMenu] = useState(null)
  // Drag to reorder, as the app does it (observed 2026-09-05): a small copy
  // of the row's art follows the pointer, an empty slot opens where the row
  // will land, and on release the row moves there, selected and ticked.
  const [drag, setDrag] = useState(null) // { n, x, y, target }
  const dragRef = useRef(null)
  const listRef = useRef(null)
  // "Scroll to Current Track in Queue": bring the playing row into view, as
  // the app's own shortcut does.
  useEffect(() => {
    if (!scrollSignal) return
    listRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [scrollSignal])
  const toggleCheck = (n) => setChecked((prev) => { const next = new Set(prev); if (next.has(n)) next.delete(n); else next.add(n); return next })
  const act = async (n, how) => {
    setMenu(null)
    if (how === 'play') { await actions.seekTrack(zone.uuid, n); if (transport.state !== 'PLAYING') actions.play(zone.uuid) }
    else if (how === 'remove') {
      const targets = checked.has(n) ? [...checked].sort((a, b) => b - a) : [n]
      for (const index of targets) await actions.removeFromQueue(zone.uuid, index)
      setChecked(new Set()); reloadQueue(); onEdited?.()
    } else if (how === 'info') onInfo?.(items[n - 1])
    else if (how === 'unselect') setChecked(new Set())
  }
  const [confirming, setConfirming] = useState(false)
  // Read the queue back rather than waiting for an event to say it changed.
  // The speakers report a stopped room's queue_length as the current media's
  // track count, not the saved queue's, so clearing a room that is playing a
  // stream changes nothing the reload key watches and the list kept its rows
  // (2026-09-06).
  const clearNow = async () => {
    setConfirming(false)
    await actions.clearQueue(zone.uuid)
    setChecked(new Set()); setSelected(null)
    reloadQueue(); onEdited?.()
  }
  const [saving, setSaving] = useState(false)
  const [dropAt, setDropAt] = useState(null)
  const transport = zone?.transport ?? {}
  // "(Not in Use)" whenever the room is not playing from its queue. Measured
  // against the app on 2026-09-05: stations (including Pandora's, which arrive
  // as service tracks), streams and an idle room all show it; an external
  // session (AirPlay, Spotify Connect) does not, the app treats that as the
  // queue.
  // The Mac app says it of a Spotify Connect session's cloud queue as well
  // (x-rincon-queue:...#vli, "Queue (Not in Use)" over 0 songs,
  // 2026-09-29); a shell measured against it passes
  // cloudQueueInUse={false}.
  const cloudQueue = /#vli$/.test(transport.media_uri || '')
  const inUse = (transport.source === 'queue' && (cloudQueueInUse || !cloudQueue))
    || transport.source === 'external_session'
  const uuid = zone?.uuid

  useEffect(() => { setChecked(new Set()); setSelected(null); setMenu(null) }, [uuid])

  const ROW = 46
  const targetFor = (clientY) => {
    const el = listRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const y = clientY - rect.top + el.scrollTop
    return Math.max(0, Math.min(items.length, Math.round(y / ROW)))
  }
  const onRowPointerDown = (event, n) => {
    if (event.button !== 0 || event.target.closest('button')) return
    dragRef.current = { n, x0: event.clientX, y0: event.clientY, active: false }
  }
  const onListPointerMove = (event) => {
    const d = dragRef.current
    if (!d) return
    if (!d.active) {
      if (Math.abs(event.clientY - d.y0) < 6 && Math.abs(event.clientX - d.x0) < 6) return
      d.active = true
      listRef.current?.setPointerCapture?.(event.pointerId)
    }
    setDrag({ n: d.n, x: event.clientX, y: event.clientY, target: targetFor(event.clientY) })
  }
  const onListPointerUp = async () => {
    const d = dragRef.current
    dragRef.current = null
    if (!d || !d.active) { setDrag(null); return }
    const target = drag?.target
    setDrag(null)
    if (target == null) return
    const from = d.n
    // Slot index t means "before the row that is now at position t+1".
    if (target === from - 1 || target === from) { setSelected(from); return }
    const insertBefore = target + 1
    const done = await actions.reorderQueue(zone.uuid, from, insertBefore)
    if (done) {
      const landed = target < from - 1 ? target + 1 : target
      setSelected(landed); setChecked(new Set([landed]))
      reloadQueue(); onEdited?.()
    }
  }

  const current = transport.track_number || 0

  return (
    <section className="dk-pane" aria-label={t('desk.queue.title')}>
      <div className="dk-header">
        <h2 className="dk-header-title">
          {t('desk.queue.title')}
          {expanded && zone && <span className="dk-header-sub dk-header-room">({zone.name})</span>}
          {zone && !inUse && !expanded && <span className="dk-header-sub">{t('desk.queue.notInUse')}</span>}
        </h2>
        {zone && <span className="dk-header-sub dk-header-count">{t.plural('desk.queue.songs', total)}</span>}
        {onExpand && (
          <button type="button" className="dk-header-btn dk-queue-collapse" aria-expanded={expanded}
                  title={expanded ? t('desk.queue.collapse') : t('desk.queue.expand')} onClick={onExpand}>
            {expanded ? <Icon.ChevronDown /> : <Icon.ChevronUp />}
          </button>
        )}
      </div>
      {/* A row dragged in from the music pane lands where it is dropped. Only
          items the service says are, or hold, tracks can be dragged at all
          (see canEnqueue), so anything arriving here is something the queue
          will take. */}
      <div className={`dk-scroll dk-queue-list${drag ? ' dk-queue-dragging' : ''}${dropAt != null ? ' dk-queue-dropping' : ''}`} ref={listRef}
           onPointerMove={onListPointerMove} onPointerUp={onListPointerUp} onPointerCancel={onListPointerUp}
           onDragOver={(event) => {
             if (!event.dataTransfer.types.includes('application/x-sonora-item')) return
             event.preventDefault()
             event.dataTransfer.dropEffect = 'copy'
             setDropAt(targetFor(event.clientY))
           }}
           onDragLeave={() => setDropAt(null)}
           onDrop={async (event) => {
             const raw = event.dataTransfer.getData('application/x-sonora-item')
             setDropAt(null)
             if (!raw || !uuid) return
             event.preventDefault()
             let dropped = null
             try { dropped = JSON.parse(raw) } catch { return }
             const at = targetFor(event.clientY)
             await actions.enqueue(uuid, dropped, at == null ? 0 : at + 1)
           }}>
        {items.length === 0 ? (
          <div className="dk-empty">
            <Icon.Note />
            <p>{t(emptyKey)}</p>
          </div>
        ) : items.map((item, index) => {
          const n = index + 1
          const isCurrent = inUse && n === current
          return (
            <div
              key={`${item.id}-${index}`}
              role="button"
              tabIndex={0}
              className="dk-row"
              aria-current={isCurrent}
              aria-selected={selected === n || menu?.n === n || undefined}
              aria-checked={checked.has(n) || undefined}
              data-menu={menu?.n === n ? (menu.context ? 'context' : 'open') : undefined}
              title={t('desk.queue.playTrack', { n })}
              onClick={() => setSelected(n)}
              onPointerDown={(event) => onRowPointerDown(event, n)}
              data-dragging={drag?.n === n || undefined}
              style={drag && drag.target != null && drag.n !== n ? {
                transform: (index >= drag.target && index < drag.n - 1) ? `translateY(${ROW}px)`
                  : (index < drag.target && index > drag.n - 1) ? `translateY(-${ROW}px)` : undefined } : undefined}
              onDoubleClick={() => act(n, 'play')}
              onKeyDown={(event) => { if (event.key === 'Enter') act(n, 'play') }}
              onContextMenu={(event) => { event.preventDefault(); setMenu({ n, item, x: event.clientX, y: event.clientY, context: true }) }}
            >
              <span className="dk-row-art"><Art src={item.art} size={40} /></span>
              <span className="dk-row-num">
                {isCurrent
                  ? (transport.state === 'PLAYING' ? <Icon.Play /> : <Icon.Pause />)
                  : n}
              </span>
              <span className="dk-row-text">
                <p className="dk-row-title">{item.title}</p>
                <p className="dk-row-sub">
                  <span className="dk-row-artist">{item.artist}</span>
                  {item.album && <span className="dk-row-album">{item.artist ? ' – ' : ''}{item.album}</span>}
                </p>
              </span>
              {item.duration && <span className="dk-row-dur">{trimDuration(item.duration)}</span>}
              <button type="button" className="dk-browse-actions" title={t('desk.browse.actions')}
                      onClick={(event) => { event.stopPropagation(); setMenu({ n, item, x: event.clientX, y: event.clientY }) }}>
                <Icon.CaretDown />
              </button>
              <button type="button" className="dk-browse-check" role="checkbox" aria-checked={checked.has(n)}
                      title={t('desk.browse.select')} onClick={(event) => { event.stopPropagation(); toggleCheck(n) }}>
                <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="1.5" width="13" height="13" rx="1" fill="none" stroke="currentColor" strokeWidth="1" />{checked.has(n) && <path d="M4 8.2l2.6 2.6L12 5.4" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}</svg>
              </button>
            </div>
          )
        })}
      </div>
      {drag && (
        <div className="dk-queue-ghost" style={{ left: drag.x - 25, top: drag.y - 25 }} aria-hidden="true">
          <Art src={items[drag.n - 1]?.art} size={50} />
        </div>
      )}
      {menu && (
        <QueueMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)} canInfo={Boolean(onInfo)}
                   episode={menu.item?.kind === 'podcast'}
                   canUnselect={checked.size > 0} onAct={(how) => act(menu.n, how)} />
      )}
      {saving && (
        <SaveDialog zone={zone} onClose={() => setSaving(false)}
                    onSave={(title, objectId = '') => { setSaving(false); actions.saveQueue(zone.uuid, title, objectId) }} />
      )}
      {/* The Windows app asks in a dialog rather than swapping the footer's
          own buttons for a confirmation, so a theme can hand one in. */}
      {ClearDialog && confirming && (
        <ClearDialog onClose={() => setConfirming(false)} onConfirm={clearNow} />
      )}
      <div className="dk-footer">
        {confirming && !ClearDialog ? (
          <>
            <button type="button" onClick={() => setConfirming(false)}>{t('common.back')}</button>
            <button type="button" onClick={clearNow}>
              {t('desk.queue.confirmClear')}
            </button>
          </>
        ) : (
          <>
            <button type="button" disabled={!zone || items.length === 0}
                    onClick={() => setConfirming(true)}>
              {t('desk.queue.clear')}
            </button>
            <button type="button" disabled={!zone || items.length === 0} onClick={() => setSaving(true)}>
              {t('desk.queue.save')}
            </button>
          </>
        )}
      </div>
    </section>
  )
}

// "0:03:45" as the speakers report it reads better as "3:45".
function trimDuration(value) {
  return value.replace(/^0:0?/, '')
}

// The queue row menu as the app draws it (observed 2026-09-05): Play Song,
// Remove Song, Info & Options, Unselect All, a rule between each.
// A podcast episode (upnp:class audioItem.podcast) reads Play Episode /
// Remove Episode instead, as the app's menu does (Amazon episode, 2026-09-07).
function QueueMenu({ x, y, onClose, onAct, canInfo, canUnselect, episode = false }) {
  const { t } = useI18n()
  const ref = useRef(null)
  useEffect(() => {
    const close = (event) => { if (ref.current && !ref.current.contains(event.target)) onClose() }
    const key = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', key) }
  }, [onClose])
  const style = { left: Math.min(x, window.innerWidth - 200), top: Math.min(y, window.innerHeight - 170) }
  return (
    <div className="dk-popover dk-action-menu" ref={ref} role="menu" style={style}>
      <button type="button" role="menuitem" onClick={() => onAct('play')}>{t(episode ? 'desk.queue.playEpisode' : 'desk.queue.playSong')}</button>
      <hr className="dk-popover-sep" />
      <button type="button" role="menuitem" onClick={() => onAct('remove')}>{t(episode ? 'desk.queue.removeEpisode' : 'desk.queue.removeSong')}</button>
      <hr className="dk-popover-sep" />
      <button type="button" role="menuitem" disabled={!canInfo} title={canInfo ? undefined : t('desk.menu.disabledNote')}
              onClick={() => onAct('info')}>{t('desk.now.infoOptions')}</button>
      <hr className="dk-popover-sep" />
      <button type="button" role="menuitem" disabled={!canUnselect} onClick={() => onAct('unselect')}>{t('desk.actions.unselectAll')}</button>
    </div>
  )
}
