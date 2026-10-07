import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../frontend/src/lib/api.js'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import * as Icon from '../../frontend/src/components/Icons.jsx'
import Art from './Art.jsx'
import { PlayRow } from './icons.jsx'
import { anchorOf, menuAt, useDismiss } from './menus.js'
import { kindLabel } from './kinds.js'
import { useOnAir } from './onAir.js'

// A list you can play: what a service's playable container opens as.
//
// Measured on play.sonos.com 2026-09-19, on Mixcloud's Trending: 256px art,
// the name at 40px, then three 40px discs -- play, shuffle, and a More holding
// Play Now alone -- over a line reading
// "Mixcloud · Playlist · 26 hours 15 min". Under that a table with a Title and
// Time header, and a row per track: 48px art, the name over its artist, the
// running time, and a More of its own holding Play Now.
//
// The rows do nothing on a single click. A double click plays the track, which
// is the only thing a click on the row itself does in the product.

function runtime(seconds, t) {
  const total = Math.round(seconds || 0)
  if (!total) return ''
  const hours = Math.floor(total / 3600)
  // Whole minutes, not the nearest: the product calls a chapter of 1:17:30
  // "1 hour 17 min", and one hour is an hour rather than "1 hours"
  // (measured 2026-09-20).
  const minutes = Math.floor((total % 3600) / 60)
  if (hours && minutes) {
    return `${t.plural('web.runtime.hours', hours)} ${t.plural('web.runtime.minutes', minutes)}`
  }
  if (hours) return t.plural('web.runtime.hours', hours)
  return t.plural('web.runtime.minutes', Math.max(1, minutes))
}

//: Kinds with no shuffle disc: what is meant to be heard in order (a book,
//: a podcast) and what is not a list at all (a station, which the product
//: heads with play and More alone). A book's parts are given in words too --
//: the product's chapter list for Libby's audiobook reads "1 hour 17 min"
//: where Mixcloud's track list reads "1:34:57" (measured 2026-09-20).
const IN_ORDER = new Set(['audiobook', 'book', 'show', 'program', 'stream', 'station'])

//: What is one thing rather than a list of them: a station's page holds no
//: table and says nothing where a list would say it is empty.
const ONE_THING = new Set(['program', 'stream', 'station'])

//: An album is the one list the product numbers. Its tracks are one record in
//: one order by one artist, so it prints 01, 02 down the left, gives the
//: artist a column of its own, and leaves the runtime off the line under the
//: title -- where a playlist shows a cover per row, the artist under each
//: title, and "2 hours 43 min" in that line (play.sonos.com, 2026-09-22).
const NUMBERED = new Set(['album'])

function clock(seconds) {
  const total = Math.round(seconds || 0)
  if (!total) return ''
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const rest = total % 60
  const pad = (n) => String(n).padStart(2, '0')
  return hours ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`
}

export default function ServiceListPage({
  sid, zone, item, title, art = '', uri = '', metadata = '', serviceName = '',
  logo = null, itemType = '', summary = '', secondLine = '', artist = '', accountId = '',
  producer = '', semanticType = '',
  playZone = '', onPlay, nav,
  // A list from the household's music library rather than a service: read
  // off the speaker, drawn as the product draws Songs and an album there
  // (play.sonos.com, 2026-09-30) -- Title and Album columns, no service line.
  // `placeholder` names the picture the header wears when the list has none.
  library = false, placeholder = 'note',
}) {
  const { actions, zones } = useSystem()
  const { t } = useI18n()
  const [state, setState] = useState({ items: [], loading: true, error: null })
  const [menu, setMenu] = useState(null) // { id: 'page' | row id, left, top }
  useDismiss(Boolean(menu), () => setMenu(null))
  const station = ONE_THING.has(itemType)
  const [wholeSummary, setWholeSummary] = useState(false)
  // More is offered only where there is more: the product shows none under a
  // line that fits (measured 2026-09-20).
  const summaryBox = useRef(null)
  const [clamped, setClamped] = useState(false)
  useLayoutEffect(() => {
    const node = summaryBox.current
    setClamped(Boolean(node) && node.scrollHeight > node.clientHeight + 1)
  }, [summary])

  // Services hand a list over a page at a time -- Mixcloud gives twenty --
  // and the product keeps asking as the reader scrolls. This asks until it
  // has the list or has asked five times, so a long one arrives whole and a
  // very long one still stops.
  useEffect(() => {
    let canceled = false
    // A station is one thing, not a list: the product's page for AccuRadio's
    // Lovers Rock Reggae or Amazon's 1960s Reggae Classics ends under its
    // discs, with no table and no running time (2026-09-28).
    if (station) { setState({ items: [], loading: false, error: null }); return undefined }
    setState({ items: [], loading: true, error: null })
    if (library) {
      api.browse(item, { zone, count: 500 })
        .then((data) => !canceled && setState({ items: data.items ?? [], loading: false, error: null }))
        .catch((exc) => !canceled && setState({ items: [], loading: false, error: exc.message }))
      return () => { canceled = true }
    }
    const gather = async () => {
      const got = []
      for (let page = 0; page < 5; page += 1) {
        const data = await api.browseService(
          sid, { zone, item, account: accountId, count: 100, index: got.length, art: 290 })
        const rows = data.items ?? []
        got.push(...rows)
        if (canceled) return
        setState({ items: [...got], loading: false, error: null })
        if (!rows.length || got.length >= (data.total ?? got.length)) return
      }
    }
    gather().catch((exc) => !canceled && setState({ items: [], loading: false, error: exc.message }))
    return () => { canceled = true }
  }, [sid, zone, item, accountId, station, library])

  // What the service says of the item itself, for a station whose row came
  // without its summary (Amazon's arrive bare from search), and the actions
  // it declares: Amazon puts "Add to my Amazon Music Library" and "Upgrade
  // to Amazon Music Unlimited" in the page's More, after Play Now and a rule.
  const [ownSummary, setOwnSummary] = useState('')
  const [links, setLinks] = useState([])
  useEffect(() => {
    let canceled = false
    setOwnSummary(''); setLinks([])
    if (!sid || !item) return undefined
    if (!summary) {
      api.serviceItem(sid, item, zone, accountId)
        .then((r) => { if (!canceled) setOwnSummary(r?.summary || '') }).catch(() => {})
    }
    api.serviceExtended(sid, item, zone, accountId)
      .then((r) => { if (!canceled) setLinks((r?.links || []).filter((l) => l.label && ['simpleHttpRequest', 'openUrl'].includes(l.type))) })
      .catch(() => {})
    return () => { canceled = true }
  }, [sid, item, zone, accountId, summary])
  const [notice, setNotice] = useState('')
  const runLink = async (link) => {
    setMenu(null)
    if (link.type === 'openUrl') { window.open(link.url, '_blank', 'noopener'); return }
    const done = await actions.serviceAction(zone, sid, link)
    setNotice(done ? (link.success || '') : (link.failure || ''))
  }

  const numbered = NUMBERED.has(itemType)
  // A podcast's show, however its service types it (Amazon Music calls its
  // shows "show"). The product heads 99% Invisible with its producer twice --
  // "Roman Mars" in white under the title and again in the description's
  // gray where the show has no description of its own -- plays and shuffles
  // it, and gives no total running time (play.sonos.com, 2026-09-22).
  const podcast = semanticType === 'podcast' || semanticType.startsWith('podcast.')
  const headLine = secondLine || (numbered && artist) || (podcast && producer) || ''
  const blurb = summary || ownSummary || (podcast ? producer : '')
  const total = useMemo(
    () => state.items.reduce((sum, row) => sum + (row.duration || 0), 0), [state.items])

  // What the room is playing, so the row that is on marks itself. The room
  // the reader chose, not the player the browsing went through.
  const room = playZone || zone
  const playing = (zones[room]?.transport?.title || '').trim()

  // The page's own item on the room now turns the disc into a pause (onAir.js).
  const onAir = useOnAir(room, uri)
  const next = onAir.next

  const play = (body) => { onPlay(body); setMenu(null) }
  const playList = () => {
    if (onAir.press()) return
    if (uri) play({ uri, metadata, title })
  }
  // The product's second disc. Sonora plays the list and puts the room in
  // shuffle, which is the same two steps the transport bar's toggle takes.
  const shuffleList = () => {
    if (!uri) return
    play({ uri, metadata, title })
    actions.setPlayMode(room, 'SHUFFLE_NOREPEAT')
  }
  const playTrack = (row) => row.uri && play({ uri: row.uri, metadata: row.metadata || '', title: row.title })

  // One entry, which is all the product offers anywhere: the More on
  // Mixcloud's Trending, on a track in it, and on a Spotify track in the
  // search results each open a menu holding Play Now and nothing else
  // (measured 2026-09-20). Queue actions live on the queue.
  const pageMenu = [
    ['playNow', PlayRow, () => uri && play({ uri, metadata, title })],
  ]

  return (
    <div className="wb-list-page">
      <button type="button" className="wb-service-close" title={t('common.close')} onClick={() => nav.back()}>
        <Icon.Close width={16} height={16} />
      </button>

      <div className="wb-list-head" data-station={station || undefined}>
        <div className="wb-item-art">
          <Art src={art} size={64} fallback={library ? placeholder : 'note'} />
        </div>
        <div className="wb-item-main">
          <h1>{title}</h1>
          {/* What the thing is about, in the product's narrow column under
              the title: two lines of 12px with More at the end of the second,
              which opens the rest in place (Libby's audiobook on
              play.sonos.com, 2026-09-20). */}
          {/* The line the item's own display type names, where it names one:
              Pandora prints the date a station was made under its title, in
              the page's own white rather than the description's gray
              (measured 2026-09-20). */}
          {/* An album names its artist under the title where a playlist
              names its owner: "2001" over "Dr. Dre" against "Today's Top
              Hits" over "Spotify" (play.sonos.com, 2026-09-22). */}
          {headLine && <p className="wb-item-line">{headLine}</p>}
          {(!headLine || podcast) && blurb && (
            <p className="wb-item-summary" data-whole={wholeSummary || undefined} data-station={station || undefined}>
              <span ref={summaryBox}>{blurb}</span>
              {clamped && !wholeSummary && (
                <button type="button" onClick={() => setWholeSummary(true)}>
                  {t('web.more')}
                </button>
              )}
            </p>
          )}
          <div className="wb-item-actions">
            <button type="button" className="wb-item-play" disabled={!uri}
                    title={next === 'play' ? t('web.playTitle', { title }) : next === 'stop' ? t('common.stop') : t('common.pause')}
                    onClick={() => playList()}>
              {next === 'pause' ? <Icon.Pause width={20} height={20} />
                : next === 'stop' ? <Icon.Stop width={20} height={20} />
                : <Icon.Play width={20} height={20} />}
            </button>
            {/* Not on a book: the product offers play and More over Libby's
                audiobook and puts the shuffle disc between them only where
                the order does not matter -- Mixcloud's Trending has all
                three (measured 2026-09-20). */}
            {(!IN_ORDER.has(itemType) || podcast) && (
              <button type="button" className="wb-item-dots" disabled={!uri}
                      title={t('web.shuffleTitle', { title })} onClick={shuffleList}>
                <Icon.Shuffle width={20} height={20} />
              </button>
            )}
            <span className="wb-item-more">
              <button type="button" className="wb-item-dots" aria-expanded={menu?.id === 'page'}
                      title={t('web.moreTitle')}
                      onClick={(event) => {
                        // The anchor is read here and not inside the updater:
                        // React clears currentTarget once the handler returns.
                        const at = anchorOf(event)
                        setMenu((open) => (open?.id === 'page' ? null : { id: 'page', ...at }))
                      }}>
                <Icon.Ellipsis width={20} height={20} />
              </button>
              {menu?.id === 'page' && (
                <div className="wb-item-menu" role="menu" style={menuAt(menu)}>
                  {pageMenu.map(([key, Glyph, run]) => {
                    return (
                      <button key={key} type="button" role="menuitem" disabled={!uri}
                              onClick={() => { run(); setMenu(null) }}>
                        <Glyph />
                        <span>{t(`desk.actions.${key}`)}</span>
                      </button>
                    )
                  })}
                  {links.length > 0 && <div className="wb-item-menu-rule" role="separator" />}
                  {links.map((link) => (
                    <button key={link.id || link.url} type="button" role="menuitem" className="wb-item-menu-text"
                            onClick={() => runLink(link)}>
                      <span>{link.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </span>
          </div>
          {!library && <p className="wb-item-meta" data-nobadge={!sid || undefined}>
            {/* The service's attribution badge, not its logo: the product
                puts Spotify's green mark before its name here and nothing
                before Mixcloud's, which publishes no badge (measured
                2026-09-20). A 404 removes the picture. */}
            {sid ? (
              <img className="wb-room-badge" src={`/api/services/badge/${sid}?size=40`}
                   alt="" aria-hidden="true"
                   onError={(event) => {
                     event.currentTarget.style.display = 'none'
                     event.currentTarget.parentElement.dataset.nobadge = ''
                   }} />
            ) : null}
            <span>{serviceName}</span>
            <span className="wb-item-dot">•</span>
            <span>{t(kindLabel({ item_type: itemType, uri, semantic_type: semanticType }))}</span>
            {total > 0 && !numbered && !podcast && !station && <><span className="wb-item-dot">•</span><span>{runtime(total, t)}</span></>}
          </p>}
        </div>
      </div>

      {notice && <p className="wb-notice" role="status"><Icon.Info width={16} height={16} aria-hidden="true" /><span>{notice}</span></p>}
      {state.error && <div className="wb-empty-card">{state.error}</div>}

      {/* The product ghosts the table while the service answers, the same way
          it ghosts a container's tiles (measured 2026-09-20). The heading
          above is real here: the row that opened the page named it. */}
      {state.loading && !state.error && state.items.length === 0 && (
        <div className="wb-waiting" aria-busy="true">
          {Array.from({ length: 8 }, (unused, n) => (
            <div className="wb-track-ghost" key={n} aria-hidden="true">
              <div className="wb-tile-art" />
              <div>
                <div className="wb-ghost wb-ghost-line" />
                <div className="wb-ghost wb-ghost-line wb-ghost-short" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Nothing in the list: the product replaces the table with one bar
          reading "No items available", which is what Mixcloud's Listen
          Later shows (measured 2026-09-20). A station is not a list and
          says nothing -- its page ends at the line under the discs. */}
      {!state.error && !state.loading && state.items.length === 0 && !ONE_THING.has(itemType) && (
        <p className="wb-notice">
          <Icon.Info width={16} height={16} aria-hidden="true" />
          <span>{t('web.noItems')}</span>
        </p>
      )}

      {!state.error && !station && state.items.length > 0 && (
        <table className="wb-tracks" data-numbered={numbered || undefined}>
          <thead>
            <tr>
              <th className="wb-tracks-title">{t('web.tracks.title')}</th>
              {numbered && <th className="wb-tracks-artist">{t('web.tracks.artist')}</th>}
              <th className="wb-tracks-time">{t(library ? 'web.tracks.album' : 'web.tracks.time')}</th>
              <th className="wb-track-more" />
            </tr>
          </thead>
          <tbody>
            {state.items.map((row, n) => (
              <tr key={row.id} className="wb-track"
                  data-playing={(row.title || '').trim() === playing && !!playing || undefined}
                  /* A track the service itself refuses is drawn at a fifth of
                     the brightness and plays for nobody (2026-09-22). */
                  data-refused={row.can_play === false || undefined}
                  onDoubleClick={() => { if (row.can_play !== false) playTrack(row) }}>
                <td>
                  <span className="wb-track-cell">
                    {/* An album counts its tracks where a playlist pictures
                        them: the product prints 01, 02 down the left of an
                        album and a 48px cover down the left of a playlist,
                        because an album's tracks share one cover and a
                        playlist's do not (measured 2026-09-22). */}
                    {numbered ? (
                      <span className="wb-track-num">{String(n + 1).padStart(2, '0')}</span>
                    ) : (
                      <span className="wb-row-art"><Art src={row.art} size={20} /></span>
                    )}
                    <span className="wb-row-text">
                      <span className="wb-row-label">
                        {(row.title || '').trim() === playing && !!playing && (
                          <Icon.Equalizer width={14} height={14} className="wb-track-bars" aria-hidden="true" />
                        )}
                        <span>{row.title}</span>
                        {row.explicit === true && (
                          <Icon.Explicit className="wb-explicit" role="img"
                                         aria-label={t('web.explicit')} />
                        )}
                      </span>
                      {/* An episode is its title alone: the product prints no
                          line under "The Rocky Statue", though Amazon sends a
                          paragraph of summary with it (2026-09-22). */}
                      {!numbered && !/^episode\./.test(row.semantic_type || '') && (row.artist || row.summary) && (
                        <span className="wb-row-sub">{row.artist || row.summary}</span>
                      )}
                    </span>
                  </span>
                </td>
                {numbered && (
                  <td className="wb-tracks-artist">{row.artist || ''}</td>
                )}
                <td className="wb-tracks-time" data-album={library || undefined}>
                  {library ? (row.album || '') : IN_ORDER.has(itemType) ? runtime(row.duration, t) : clock(row.duration)}
                </td>
                <td className="wb-track-more">
                  <span className="wb-item-more">
                    <button type="button" className="wb-track-dots" title={t('web.moreTitle')}
                            disabled={itemType === 'audiobook'}
                            aria-expanded={menu?.id === row.id}
                            onClick={(event) => {
                              const at = anchorOf(event)
                              setMenu((open) => (open?.id === row.id ? null : { id: row.id, ...at }))
                            }}>
                      <Icon.Ellipsis width={20} height={20} />
                    </button>
                    {menu?.id === row.id && (
                      <div className="wb-item-menu" role="menu" style={menuAt(menu)}>
                        <button type="button" role="menuitem" disabled={!row.uri}
                                onClick={() => playTrack(row)}>
                          <PlayRow />
                          <span>{t('desk.actions.playNow')}</span>
                        </button>
                      </div>
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
