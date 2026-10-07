import React, { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../frontend/src/lib/api.js'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import * as Icon from '../../frontend/src/components/Icons.jsx'
import Art from './Art.jsx'
import { kindLabel } from './kinds.js'
import { isPlayableLeaf } from '../../frontend/src/lib/items.js'
import useEdgeFade from './useEdgeFade.js'
import { addRecentSearch } from '../../frontend/src/lib/recentSearches.js'

// Search, as the product does it: every linked service at once.
//
// Measured on play.sonos.com 2026-09-19, searching "chicago" on a household
// of ten services. The panel becomes a filter bar -- a white "All" pill and
// one pill per service, each with its logo, and an orange (!) on a service
// whose search failed -- over one section per service. A section is headed by
// the service's 32px logo and its name with View More at the right, and its
// results are rows flowing three to a line: 56px art, the title, the kind
// beneath it, and a chevron. A row that plays on the spot (a song) carries a
// "..." instead of the chevron, which is the same rule the browse pages use.
//
// Nothing local appears: the household's own favorites and playlists are not
// searched here, which is why Sonora's old behavior (filtering the home's
// own sections and reporting "Nothing in your favorites...") read as a
// search that found nothing.

//: The kinds whose second line is whoever made them. Everything else --
//: stations, programs, playlists, artists -- says what it is instead.
const BY_ARTIST = new Set(['track', 'song', 'album'])

function subtitle(row) {
  return BY_ARTIST.has(row.item_type || '') ? (row.artist || '') : ''
}

//: What one service shows before View More: three rows of three.
//: The order the product puts a chosen service's sections in -- the same for
//: two different searches, and not the order the service lists its categories
//: in (measured on play.sonos.com 2026-09-22). Anything the service offers
//: that is not named here follows, in its own order.
const CATEGORY_ORDER = ['artists', 'tracks', 'albums', 'playlists', 'stations',
                        'genres', 'podcasts', 'shows', 'episodes', 'audiobooks',
                        'people', 'hosts']

const SHOWN = 9

//: A category a service names in its own words is filed under Sonos' own id
//: for what it holds. Mixcloud has no search map and calls its categories
//: Users, Shows and tags; the product heads them Artists, Songs and
//: Playlists, which is the itemType every row in each carries -- artist,
//: track, trackList (play.sonos.com, "the cure", 2026-09-22).
const BY_ITEM = {
  artist: 'artists', track: 'tracks', song: 'tracks', album: 'albums',
  playlist: 'playlists', trackList: 'playlists', albumList: 'albums',
  program: 'stations', stream: 'stations', genre: 'genres', show: 'podcasts',
  audiobook: 'audiobooks',
}
function sonosCategory(id, items) {
  if (CATEGORY_ORDER.includes(id)) return id
  const counts = {}
  for (const row of items) {
    const named = BY_ITEM[row.item_type || '']
    if (named) counts[named] = (counts[named] || 0) + 1
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  return best ? best[0] : id
}

//: One provider's answer, flattened the way the product flattens it.
//
// SMAPI answers a search per category (artists, stations, genres...), and the
// product takes one from each in turn rather than all of one then all of the
// next: AccuRadio's four results read Artist, Station, Other, Station, which
// is the round robin and not the concatenation.
function interleave(categories) {
  const lists = categories.map((category) => category.items ?? [])
  const out = []
  for (let i = 0; lists.some((list) => i < list.length); i += 1) {
    for (const list of lists) {
      if (i < list.length) out.push(list[i])
    }
  }
  return out
}

export default function SearchResults({ term, groups, nav, onPlay, onClose, onBusy, library = '' }) {
  const { t } = useI18n()
  const [answers, setAnswers] = useState([])
  const [only, setOnly] = useState('')

  // Every service of every household in view, each with the room whose
  // credentials resolve it. A household with no services contributes none.
  const targets = useMemo(() => groups.flatMap((group) => (group.items ?? [])
    .filter((service) => service.on_system !== false)
    .map((service) => ({
      key: `${group.household.id}|${service.service_id ?? service.id}|${service.account_id ?? ''}`,
      sid: service.service_id ?? service.id,
      name: service.name,
      icon: service.icon || '',
      initials: service.initials || '',
      account: service.account_id ?? '',
      zone: group.household.zone_uuids[0],
      gen: group.household.generation,
    }))), [groups])

  // Answers arrive as each provider replies, and a section appears with it:
  // the product fills its panel the same way rather than waiting for the
  // slowest service. The term is captured so a late answer to an older term
  // is dropped rather than shown under the new one.
  // Which services there are, as a key. The groups are rebuilt whenever any
  // speaker reports anything -- a volume, a track -- and keyed on the array
  // itself the search started over each time, so the page emptied and
  // refilled several times while "reggae" was still coming in.
  const targetsKey = targets.map((target) => `${target.key}@${target.zone}`).join(',')
  const targetsRef = useRef(targets)
  targetsRef.current = targets
  const asked = useRef('')
  useEffect(() => {
    const targets = targetsRef.current
    const wanted = term.trim()
    asked.current = wanted
    setAnswers([])
    setOnly('')
    if (!wanted) { onBusy?.(false); return undefined }
    let canceled = false
    // A letter at a time would put seventeen searches on the wire for every
    // keystroke. The product waits for the typing to settle and then goes
    // without being asked -- there is no Enter to press -- and says it is
    // working with a spinner in the pill.
    onBusy?.(true)
    let waiting = 0
    const timer = setTimeout(() => {
      waiting = targets.length
      if (!waiting) { onBusy?.(false); return }
      for (const target of targets) {
        const settle = () => {
          waiting -= 1
          if (waiting <= 0 && !canceled && asked.current === wanted) onBusy?.(false)
        }
        api.searchService(target.sid, { zone: target.zone, term: wanted,
                                        account: target.account, count: 20 })
          .then((data) => {
            if (canceled || asked.current !== wanted) return
            // Kept even when it found nothing: the product's filter bar
            // carries a pill for every service that answered, 90s90s Radio
            // and SomaFM Radio among them, and draws a section only for the
            // ones with something to show (measured 2026-09-20). A service
            // Sonora cannot search at all -- no token for it, as with
            // SoundCloud here -- is left off the page entirely rather than
            // marked; one whose search failed keeps its
            // orange (!), as the product draws it.
            if (data.error?.needs_auth) {
              // Counted as answered, so the page does not wait on it.
              setAnswers((prev) => [...prev, { ...target, items: [], hidden: true }])
              return
            }
            const items = interleave(data.categories ?? [])
            const available = (data.available ?? []).map((one) => one.id)
            setAnswers((prev) => [...prev, { ...target, items, available,
                                             failed: Boolean(data.error) }])
          })
          .catch(() => {
            if (canceled || asked.current !== wanted) return
            setAnswers((prev) => [...prev, { ...target, items: [], failed: true }])
          })
          .finally(settle)
      }
    }, 350)
    return () => { canceled = true; clearTimeout(timer) }
  }, [term, targetsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // The household's own music library comes last, as it does in the
  // product's results: its artists, albums, and songs whose names match,
  // searched the way the speakers search it (A:ARTIST:<term> and so on).
  const [libraryRows, setLibraryRows] = useState([])
  useEffect(() => {
    const wanted = term.trim()
    setLibraryRows([])
    if (!library || !wanted) return undefined
    let canceled = false
    const timer = setTimeout(() => {
      Promise.all(['A:ARTIST', 'A:ALBUM', 'A:TRACKS'].map((root) =>
        api.browse(`${root}:${wanted}`, { zone: library, count: 6 })
          .then((found) => found.items || []).catch(() => [])))
        .then((lists) => { if (!canceled) setLibraryRows(interleave(lists.map((items) => ({ items })))) })
    }, 350)
    return () => { canceled = true; clearTimeout(timer) }
  }, [term, library])
  const openLibrary = (row) => {
    addRecentSearch(term)
    if (row.is_container || !row.uri) nav.push({ kind: 'library', item: row.id, zone: library })
    else onPlay?.(row)
  }

  // A click opens what can be opened and plays what cannot, which is what the
  // chevron and the "..." on each row promise.
  const open = (service, row) => {
    // A search that led somewhere is one worth offering again.
    addRecentSearch(term)
    const shared = { sid: service.sid, name: row.title, item: row.id,
                     summary: row.summary || '',
                     zone: service.zone, account_id: service.account, gen: service.gen,
                     uri: row.uri || '', metadata: row.metadata || '',
                     art: row.art || '', item_type: row.item_type || '',
                     artist: row.artist || '',
                     producer: row.producer || '', semantic_type: row.semantic_type || '',
                     service: service.name,
                     icon: service.icon, initials: service.initials }
    if (row.is_container && row.can_play && row.uri) {
      nav.push({ ...shared, kind: 'service-list' })
    } else if (isPlayableLeaf(row) || (!row.is_container && row.uri)) {
      nav.push({ ...shared, kind: 'service-leaf' })
    } else if (row.is_container) {
      // Everything the row knew travels with it: the page the product draws
      // for an artist carries the portrait and says what the thing is, and
      // neither is knowable from an id (2026-09-22).
      nav.push({ ...shared, kind: 'service-item' })
    } else {
      onPlay?.(row)
    }
  }

  // A chosen service is shown the way the product shows one: not its results
  // in a line, but a section per category -- Artists, Songs, Albums,
  // Playlists -- each with View All at its right (measured on play.sonos.com
  // 2026-09-22 for two different searches, which put the sections in that
  // same order both times, and not the order the service lists them in).
  const [cats, setCats] = useState({})
  const [catIds, setCatIds] = useState({})
  const [wholeCat, setWholeCat] = useState('')
  useEffect(() => { setCats({}); setCatIds({}); setWholeCat('') }, [only, term])
  useEffect(() => {
    if (!only) return undefined
    const answer = answers.find((one) => one.key === only)
    if (!answer) return undefined
    const wanted = term.trim()
    const ids = (answer.available ?? []).filter((id) => id !== 'all')
    if (!ids.length) return undefined
    let canceled = false
    for (const id of ids) {
      api.searchService(answer.sid, { zone: answer.zone, term: wanted,
                                      account: answer.account, category: id, count: 24 })
        .then((data) => {
          if (canceled) return
          const items = interleave(data.categories ?? [])
          const key = sonosCategory(id, items)
          setCats((prev) => ({ ...prev, [key]: [...(prev[key] ?? []), ...items] }))
          setCatIds((prev) => ({ ...prev, [key]: [...(prev[key] ?? []), id] }))
        })
        .catch(() => { if (!canceled) setCats((prev) => ({ ...prev, [id]: [] })) })
    }
    return () => { canceled = true }
  }, [only, term, answers])

  // One result row, drawn the same whether it stands in a service's section
  // or in a category's.
  // A service can refuse one track while listing it: the product draws such a
  // row at a fifth of the brightness and it does nothing (Mixcloud's
  // subscriber-only shows, measured 2026-09-22).
  const refused = (row) => row.can_play === false && !row.is_container

  const resultRow = (answer, row) => (
    <button key={`${answer.key}|${row.id}`} type="button" className="wb-row"
            data-refused={refused(row) || undefined} disabled={refused(row)}
            onClick={() => open(answer, row)}>
      <span className="wb-row-art"><Art src={row.art} size={24} /></span>
      <span className="wb-row-text">
        <span className="wb-row-label">
          <span>{row.title}</span>
          {row.explicit === true && (
            <Icon.Explicit className="wb-explicit" role="img" aria-label={t('web.explicit')} />
          )}
        </span>
        {/* Whoever made it, under a song or an album; what it is under
            everything else (2026-09-20). */}
        <span className="wb-row-sub">{subtitle(row) || t(kindLabel(row))}</span>
      </span>
      {/* A song is the one result that has no page to open, so it wears the
          product's "..." where everything else wears a chevron. */}
      {row.item_type === 'track'
        ? <Icon.Ellipsis className="wb-row-chev" width={20} height={20} aria-hidden="true" />
        : <Icon.ChevronRight className="wb-row-chev" width={20} height={20} aria-hidden="true" />}
    </button>
  )

  const listed = answers.filter((a) => !a.hidden)
  const shown = only ? listed.filter((a) => a.key === only) : listed
  const pills = listed
  // The line of pills fades into the page where it carries on past an edge,
  // as the home's services row does.
  const [pillRow, pillEdges] = useEdgeFade([pills.length])

  return (
    <div className="wb-sr">
      {/* The panel keeps its close button while results are up, as every
          other panel of the product's does. */}
      {onClose && (
        <button type="button" className="wb-service-close" title={t('common.close')}
                onClick={onClose}>
          <Icon.Close width={16} height={16} />
        </button>
      )}
      <div className="wb-sr-filters" ref={pillRow}
           data-fade-left={pillEdges.left || undefined}
           data-fade-right={pillEdges.right || undefined}>
        <button type="button" className="wb-sr-pill" data-on={!only || undefined}
                onClick={() => setOnly('')}>{t('web.search.all')}</button>
        {pills.map((answer) => (
          <button key={answer.key} type="button" className="wb-sr-pill"
                  data-on={only === answer.key || undefined}
                  onClick={() => setOnly(only === answer.key ? '' : answer.key)}>
            <span className="wb-sr-pill-logo" aria-hidden="true">
              {answer.icon ? <img src={answer.icon} alt="" /> : <span>{answer.initials}</span>}
            </span>
            <span>{answer.name}</span>
            {/* The product marks a service whose search failed rather than
                dropping it: an orange exclamation on its pill. */}
            {answer.failed && <Icon.Caution className="wb-sr-warn" width={16} height={16} />}
          </button>
        ))}
      </div>

      {only && wholeCat && (
        <ViewAll answer={shown[0]} id={wholeCat} first={cats[wholeCat] ?? []}
                 ids={catIds[wholeCat] ?? []} term={term} t={t}
                 onOpen={(row) => open(shown[0], row)} />
      )}

      {only && !wholeCat && [...CATEGORY_ORDER, ...Object.keys(cats).filter((id) => !CATEGORY_ORDER.includes(id))]
        .filter((id) => (cats[id] ?? []).length).map((id) => {
        const answer = shown[0]
        const items = cats[id] ?? []
        const shape = id === 'artists' ? 'circles'
          : (id === 'tracks' || id === 'episodes' ? 'rows' : 'tiles')
        const whole = wholeCat === id
        const limit = whole ? items.length : (shape === 'rows' ? 9 : 6)
        return (
          <section className="wb-sr-cat" key={id} data-shape={shape}>
            <div className="wb-sr-head">
              <h2>{CATEGORY_ORDER.includes(id) ? t(`search.category.${id}`) : id}</h2>
              {!whole && items.length > limit && (
                <button type="button" className="wb-sr-more"
                        onClick={() => setWholeCat(id)}>{t('web.search.viewAll')}</button>
              )}
            </div>
            {shape === 'rows' ? (
              <div className="wb-sr-rows">
                {items.slice(0, limit).map((row) => resultRow(answer, row))}
              </div>
            ) : (
              <div className="wb-sr-tiles">
                {items.slice(0, limit).map((item) => (
                  <button key={`${answer.key}|${item.id}`} type="button" className="wb-sr-tile"
                          onClick={() => open(answer, item)}>
                    <span className="wb-sr-tile-art"><Art src={item.art} size={140} /></span>
                    <span className="wb-sr-tile-name">{item.title}</span>
                    {/* An artist is named and nothing more; everything else
                        says what it is under its name (2026-09-22). */}
                    {shape === 'tiles' && (
                      <span className="wb-sr-tile-kind">{t(kindLabel(item))}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </section>
        )
      })}

      {!only && shown.filter((answer) => answer.items.length).map((answer) => {
        const rows = answer.items.slice(0, only ? answer.items.length : SHOWN)
        return (
          <section className="wb-sr-group" key={answer.key}>
            <div className="wb-sr-head">
              <span className="wb-sr-logo" aria-hidden="true">
                {answer.icon ? <img src={answer.icon} alt="" /> : <span>{answer.initials}</span>}
              </span>
              <h2>{answer.name}</h2>
              {/* On every section, however few rows it has: the product
                  offers View More over AccuRadio's single result as it does
                  over Pandora's nine (measured 2026-09-20). */}
              {!only && (
                <button type="button" className="wb-sr-more"
                        onClick={() => setOnly(answer.key)}>{t('web.search.more')}</button>
              )}
            </div>
            <div className="wb-sr-rows">
              {rows.map((row) => (
                <button key={`${answer.key}|${row.id}`} type="button" className="wb-row"
                        data-refused={refused(row) || undefined} disabled={refused(row)}
                        onClick={() => open(answer, row)}>
                  <span className="wb-row-art"><Art src={row.art} size={24} /></span>
                  <span className="wb-row-text">
                    <span className="wb-row-label">
                      <span>{row.title}</span>
                      {row.explicit === true && (
                        <Icon.Explicit className="wb-explicit" role="img"
                                       aria-label={t('web.explicit')} />
                      )}
                    </span>
                    {/* Whoever made it, under a song or an album; what it is
                        under everything else. Spotify's album "Disintegration"
                        reads The Cure and its artist row reads Artist; Sonos
                        Radio's stations read Station, though each carries a
                        tagline in the same field an album's artist arrives in
                        ("Best of the Movement" under New Wave), which is why
                        this asks what the row is before using it (measured
                        2026-09-20). */}
                    <span className="wb-row-sub">{subtitle(row) || t(kindLabel(row))}</span>
                  </span>
                  {/* A song is the one result that has no page to open, so it
                      wears the product's "..." where everything else wears a
                      chevron -- stations included, which do open a page
                      (Community Radio Plus' songs against Sonos Radio's
                      stations, measured 2026-09-19). */}
                  {row.item_type === 'track'
                    ? <Icon.Ellipsis className="wb-row-chev" width={20} height={20} aria-hidden="true" />
                    : <Icon.ChevronRight className="wb-row-chev" width={20} height={20} aria-hidden="true" />}
                </button>
              ))}
            </div>
          </section>
        )
      })}

      {!only && libraryRows.length > 0 && (
        <section className="wb-sr-group" key="library">
          <div className="wb-sr-head">
            <span className="wb-sr-logo wb-sr-logo-library" aria-hidden="true"><Icon.Library width={20} height={20} /></span>
            <h2>{t('desk.browse.library')}</h2>
          </div>
          <div className="wb-sr-rows">
            {libraryRows.slice(0, SHOWN).map((row) => (
              <button key={`library|${row.id}`} type="button" className="wb-row" onClick={() => openLibrary(row)}>
                <span className="wb-row-art"><Art src={row.art} size={24} /></span>
                <span className="wb-row-text">
                  <span className="wb-row-label"><span>{row.title}</span></span>
                  <span className="wb-row-sub">{subtitle(row) || t(kindLabel(row))}</span>
                </span>
                {row.is_container || !row.uri
                  ? <Icon.ChevronRight className="wb-row-chev" width={20} height={20} aria-hidden="true" />
                  : <Icon.Ellipsis className="wb-row-chev" width={20} height={20} aria-hidden="true" />}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* What the page says when the rows above it are none. It reads the
          services on show rather than all of them, because a chosen service
          with nothing to say left the page blank -- no rows, no word, just
          the pills (found with a Spotify account whose search
          failed). A service that answered with an error says so; one that
          answered with nothing says there is nothing. */}
      {term.trim() && (() => {
        const waiting = !only && answers.length < targets.length
        if (waiting || shown.some((answer) => answer.items.length) || (!only && libraryRows.length)) return null
        if (only && !shown.length) return null
        const broke = shown.length > 0 && shown.every((answer) => answer.failed)
        return (
          <div className="wb-empty-card">
            {broke ? t('web.search.failed', { service: shown[0].name })
              : t('web.noResultsFor', { query: term.trim() })}
          </div>
        )
      })()}
    </div>
  )
}


// A category's View All, which the product opens as a page of its own rather
// than growing the section in place: the service's name over the category's,
// and under them either the whole list as a table -- Title, Artist, Album,
// Time; no "..." on a row, and a row the service refuses drawn like the rest
// -- or, for artists and anything shown as tiles, a grid of seven 128px
// pictures a row. The list goes on as it is scrolled, a page at a time, the
// way the product's does (Mixcloud's Songs for "the cure" ran past 150;
// play.sonos.com at 1536, 2026-09-22).
const PAGE = 24

function ViewAll({ answer, id, first, ids, term, t, onOpen }) {
  const [items, setItems] = useState(first)
  const [done, setDone] = useState(false)
  const loading = useRef(false)
  const end = useRef(null)
  // Where the service's own list has got to, which is not items.length: the
  // same show can come back on two pages, and it is shown once.
  const offset = useRef(first.length)
  useEffect(() => { setItems(first); offset.current = first.length; setDone(first.length < PAGE) }, [id])

  useEffect(() => {
    const node = end.current
    if (!node || done || !ids.length) return undefined
    const seen = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting) || loading.current) return
      loading.current = true
      Promise.all(ids.map((cat) => api.searchService(answer.sid, {
        zone: answer.zone, term: term.trim(), account: answer.account,
        category: cat, count: PAGE, index: offset.current,
      }).catch(() => ({ categories: [] }))))
        .then((pages) => {
          const more = pages.flatMap((page) => interleave(page.categories ?? []))
          offset.current += PAGE
          setItems((prev) => {
            const known = new Set(prev.map((row) => row.id))
            return [...prev, ...more.filter((row) => !known.has(row.id))]
          })
          if (pages.every((page) => (page.categories ?? []).every((c) => (c.items ?? []).length < PAGE))) setDone(true)
        })
        .finally(() => { loading.current = false })
    }, { rootMargin: '400px' })
    seen.observe(node)
    return () => seen.disconnect()
  }, [done, ids, items, answer, term])

  const rows = id === 'tracks' || id === 'episodes'
  const label = CATEGORY_ORDER.includes(id) ? t(`search.category.${id}`) : id
  return (
    <section className="wb-sr-all" data-shape={rows ? 'rows' : (id === 'artists' ? 'circles' : 'tiles')}>
      <p className="wb-sr-all-eyebrow">{answer.name}</p>
      <h1 className="wb-sr-all-title">{label}</h1>
      {rows ? (
        <table className="wb-sr-table">
          <thead>
            <tr>
              <th>{t('web.tracks.title')}</th>
              <th>{t('web.tracks.artist')}</th>
              <th>{t('web.tracks.album')}</th>
              <th className="wb-sr-table-time">{t('web.tracks.time')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className="wb-sr-table-row" onDoubleClick={() => onOpen(row)}>
                <td>
                  <span className="wb-sr-table-cell">
                    <span className="wb-row-art"><Art src={row.art} size={24} /></span>
                    <span className="wb-sr-table-title">{row.title}</span>
                  </span>
                </td>
                <td className="wb-sr-table-dim">{row.artist || ''}</td>
                <td className="wb-sr-table-dim">{row.album || ''}</td>
                <td className="wb-sr-table-dim wb-sr-table-time">{clockOf(row.duration)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="wb-sr-all-grid">
          {items.map((item) => (
            <button key={item.id} type="button" className="wb-sr-tile" onClick={() => onOpen(item)}>
              <span className="wb-sr-tile-art"><Art src={item.art} size={140} /></span>
              <span className="wb-sr-tile-name">{item.title}</span>
              {id !== 'artists' && <span className="wb-sr-tile-kind">{t(kindLabel(item))}</span>}
            </button>
          ))}
        </div>
      )}
      <div ref={end} aria-hidden="true" />
    </section>
  )
}

function clockOf(seconds) {
  const total = Math.round(seconds || 0)
  if (!total) return ''
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = String(total % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

