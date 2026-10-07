import React, { useEffect, useRef, useState } from 'react'
import { api } from '../../frontend/src/lib/api.js'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import Art from './Art.jsx'
import { isPlayableLeaf } from '../../frontend/src/lib/items.js'
import { CautionBadge } from '../../frontend/src/components/CautionBadge.jsx'
import * as Icon from '../../frontend/src/components/Icons.jsx'
import { tiled, round, second, declaredSecond, shelfShape } from './presentation.js'
import TileRow from './TileRow.jsx'
import { PlayRow } from './icons.jsx'
import { anchorOf, menuAt } from './menus.js'
import { kindLabel } from './kinds.js'

// A music service's own page.
//
// The product routes to /browse/services/<id> and renders the service name over
// a vertical list of its browse containers. A folder opens; a track plays into
// the service's room. The contents come from the provider over SMAPI.
//
// A service the Sonos app has an account for but Sonora does not cannot be
// browsed: that token lives on the speakers and is never handed back. Rather
// than a dead end, that screen offers to link it in Sonora, and also to remove
// it from Sonos with an are-you-sure. At a browsable service's root there are
// two removal choices: from Sonora, from Sonos, or both.

// The line under a row. An album, or a list of an artist's tracks, carries
// its artist there as it does under a tile -- "Snoop Dogg" under Missionary
// on Spotify's Dr. Dre, "10,000 Maniacs" under Plex's Popular tracks -- and
// the service's own display type still decides first, so Dr. Dre Radio
// (artistRadio, no lines) reads its name alone and AccuRadio's channels
// their blurb. Anything else keeps the summary it carries (2026-09-22).
const ARTIST_ROWS = new Set(['album', 'trackList', 'albumList'])
function rowSub(row, displayTypes) {
  if (row.display_type && displayTypes[row.display_type]) return second(row, displayTypes)
  if (ARTIST_ROWS.has(row.item_type || '')) return row.artist || row.summary || ''
  return row.summary || ''
}

export default function ServicePage({ sid, name, summary = '', zone, item, accountId = '',
                                      preset = null,
                                      sonoraLinked = true, onSystem = true, gen, logo, accounts,
                                      auth = '', nickname = '', site = '',
                                      nav, onLink, onRemoved, refresh = 0, art = '', itemType = '',}) {
  const { t } = useI18n()
  const [pageMenu, setPageMenu] = useState(null)
  const { actions } = useSystem()
  const [state, setState] = useState({ loading: true })
  const [armSonos, setArmSonos] = useState(false) // needs-link: remove-from-Sonos confirm
  const [sonosBusy, setSonosBusy] = useState(false)
  const [sonosErr, setSonosErr] = useState('')

  // A refresh (the household changed) refetches behind what is already shown;
  // only a different place starts from the loading state. Blanking on every
  // refresh made the page flash while speakers and cloud settled after an add.
  const place = `${sid}|${zone}|${item || 'root'}|${accountId || ''}`
  const lastPlace = useRef(null)
  useEffect(() => {
    let canceled = false
    // A shelf opened from a service's home already has its rows: they came
    // inline with the home document, and several of them are ids the service
    // will not resolve a second time -- five of TuneIn's shelves answer a
    // browse of their own id with nothing at all, though the document listed
    // their stations. So the rows in hand are the page (measured 2026-09-20).
    if (preset) { setState({ loading: false, items: preset }); return undefined }
    if (lastPlace.current !== place) { lastPlace.current = place; setState({ loading: true }) }
    // 290: the size the product asks a service for on a browse page, where
    // a tile is 156px (play.sonos.com, 2026-09-19).
    api.browseService(sid, { zone, item: item || 'root', count: 100, account: accountId || '', art: 290 })
      .then((data) => !canceled && setState({ loading: false, ...data }))
      .catch((exc) => !canceled
        && setState({ loading: false, error: { message: exc.message } }))
    return () => { canceled = true }
  }, [sid, zone, item, accountId, refresh, preset])

  const atRoot = !item
  // The service's name heads its root; a collection's page is headed by the
  // collection, as the product's pages are.
  const serviceName = state.service?.name || ''
  const title = atRoot ? (serviceName || name) : name

  // Pinning is not offered here. The product's pins are made in the Sonos app
  // and read from the household, and no page of the web app carries a pin
  // control -- a container's page holds the dimmed "..." and the close and
  // nothing else (measured 2026-09-20). Sonora's own pins are still kept and
  // still drawn on the home; nothing in this theme adds one.


  // A click opens, it does not play. The product takes a station's row to a
  // page of its own with a play disc on it, which is what the chevron on
  // every row promises (measured 2026-09-19); playing from the row itself
  // meant a mis-aimed click started music in a room.
  const open = (row) => {
    // A container that plays is a list with a page of its own -- art, the
    // discs that play it, and its tracks in a table; one that only browses is
    // another page of rows. The product decides on exactly these two fields.
    // A podcast opens as a page of its episodes, not as a track table: the
    // product draws Amazon Music's "Consider This from NPR" as its name over
    // a paragraph of description and a grid of episode tiles, where a
    // playlist or a book opens on art, discs and a list (measured
    // 2026-09-20).
    if (row.item_type === 'show') {
      nav.push({ kind: 'service-item', sid, name: row.title, summary: row.summary || '',
                 item: row.id, zone,
                 account_id: accountId, gen, sonora_linked: sonoraLinked,
                 on_system: onSystem, accounts })
    } else if (row.is_container && row.can_play && row.uri) {
      nav.push({ kind: 'service-list', sid, name: row.title, item: row.id, zone,
                 account_id: accountId, gen, uri: row.uri, metadata: row.metadata || '',
                 art: row.art || '', item_type: row.item_type || '',
                 service: serviceName || title,
                 summary: row.summary || '',
                 // An album prints its artist under its title, so the row's
                 // own artist travels with it.
                 artist: row.artist || '',
                 producer: row.producer || '', semantic_type: row.semantic_type || '',
                 // The line the service's own display type names for this
                 // row -- Pandora's stations name the date they were made --
                 // which the page prints under its title.
                 second_line: declaredSecond(row, state.display_types || {}),
                 icon: logo?.icon || '', initials: logo?.initials || '' })
    } else if (isPlayableLeaf(row) || (!row.is_container && row.uri)) {
      nav.push({ kind: 'service-leaf', sid, name: row.title, item: row.id, zone,
                 account_id: accountId, gen, uri: row.uri || '', metadata: row.metadata || '',
                 art: row.art || '', item_type: row.item_type || '',
                 service: serviceName || title,
                 summary: row.summary || '',
                 second_line: declaredSecond(row, state.display_types || {}),
                 icon: logo?.icon || '', initials: logo?.initials || '' })
    } else if (row.id) {
      // Anything else with an id opens as a page of its own. It is the last
      // branch on purpose: a row that names nothing playable and nothing to
      // browse would otherwise be a tile that does nothing at all, which is
      // what Spotify's and Sonos Radio's shelves were.
      nav.push({ kind: 'service-item', sid, name: row.title, summary: row.summary || '',
                 item: row.id, zone,
                 account_id: accountId, gen, sonora_linked: sonoraLinked, on_system: onSystem, accounts })
    }
  }

  // A shelf's own page: its rows travel with it rather than being asked for
  // again, since the service may not answer for the shelf's id.
  const openShelf = (shelf) => {
    nav.push({ kind: 'service-item', sid, name: shelf.title, summary: shelf.summary || '',
               item: shelf.id, zone, account_id: accountId, gen,
               sonora_linked: sonoraLinked, on_system: onSystem, accounts,
               preset: shelf.children })
  }

  const removeFromSonos = async () => {
    setSonosBusy(true); setSonosErr('')
    try {
      await api.removeService(sid, { zone, account_id: accountId || '',
                                     from_sonora: false, from_system: true })
      onRemoved?.()
      nav.back()
    } catch (exc) {
      setSonosErr(t('services.removeFailed', { service: title, error: exc.message }))
      setSonosBusy(false)
    }
  }

  // Rows or tiles, as the items themselves say (see presentation.js): a page
  // of albums, artists or stations is a grid, a page of folders and streams
  // is a list.
  const items = state.items ?? []
  // An artist's own page is rows, whatever it holds: the product draws
  // Spotify's Dr. Dre (albums, a radio, Top Tracks) and Plex's 10,000 Maniacs
  // (albums, Popular tracks) as three columns of rows under the portrait,
  // though a page of the same albums anywhere else is tiles (2026-09-22).
  const asTiles = itemType !== 'artist' && tiled(items, { root: atRoot, displayTypes: state.display_types || {} })
  const asRound = asTiles && round(items)
  // A service whose home comes from its browse endpoint arrives as shelves,
  // each carrying its own first rows: Spotify's "New releases for you" with
  // ten albums inside it, TuneIn's "Recents" with fifteen stations. The
  // product draws each shelf as a line of tiles under its name with View All
  // at the right -- the home page's own shape -- rather than as a row you
  // must open to see anything (measured 2026-09-19). A service with no such
  // document (Pandora, Plex, anything plain SMAPI) has no children and keeps
  // its rows.
  const shelves = items.filter((row) => (row.children || []).length > 0
    || shelfShape(row) === 'text')

  // The page as the product lays it out (play.sonos.com, 2026-09-14): a panel
  // in the column's place with the service's 64px icon and 40px name at the
  // top, an X to leave, a pill linking to the provider's site at the root when
  // one is known, then 72px rows with 56px art and a chevron on every row.
  return (
    <div className="wb-service-page">
      {/* Inside a service the product draws a "..." beside the close, dimmed
          and doing nothing when clicked -- checked twice on AccuRadio's
          Browse Genres (2026-09-20). It is drawn here for the same reason it
          is drawn there: the page is the same page with or without it. */}
      {!atRoot && (
        <button type="button" className="wb-service-more" disabled
                aria-hidden="true" tabIndex={-1}>
          <Icon.Ellipsis width={20} height={20} />
        </button>
      )}
      <button type="button" className="wb-service-close" title={t('common.close')} onClick={nav.home}>
        <Icon.Close width={16} height={16} />
      </button>
      {/* The root is headed by the service -- its mark beside its name; a
          page inside it is headed by the page, with the service's name as a
          small eyebrow above it and no mark at all (play.sonos.com,
          2026-09-19: "Pandora" over a 40px "My Stations"). */}
      <header className="wb-service-head" data-inside={!atRoot || undefined}
              data-pictured={(!atRoot && art) ? (itemType === 'artist' ? 'round' : 'square') : undefined}>
        {/* A container that carries its own picture is headed by it: the
            product's artist page is a 256px circle with the name beside it,
            a "..." under the name and "AccuRadio - Artist" under that, where
            a container with no artwork of its own -- Pandora's My Stations --
            is headed by the service's name over the title and nothing else
            (measured 2026-09-22). */}
        {!atRoot && art && (
          <div className="wb-service-portrait"><Art src={art} size={256} /></div>
        )}
        {atRoot ? (
          <span className="wb-service-logo" aria-hidden="true">
            {logo?.icon ? <img src={logo.icon} alt="" /> : <span>{logo?.initials || title.slice(0, 2)}</span>}
          </span>
        ) : (serviceName && (
          <p className="wb-service-eyebrow">
            {/* The service's attribution mark before its name, where it
                publishes one: the product draws Amazon Music's smile over
                "Consider This from NPR" and nothing over Mixcloud's pages,
                since Mixcloud publishes no badge (measured 2026-09-20). */}
            {sid ? (
              <img className="wb-room-badge" src={`/api/services/badge/${sid}?size=40`}
                   alt="" aria-hidden="true"
                   onError={(event) => { event.currentTarget.style.display = 'none' }} />
            ) : null}
            <span>{serviceName}</span>
          </p>
        ))}
        <h1>{title}</h1>
        {!atRoot && art && (
          <>
            <div className="wb-item-actions">
              <span className="wb-item-more">
                <button type="button" className="wb-item-dots" aria-expanded={pageMenu}
                        title={t('web.moreOptions')}
                        onClick={(event) => {
                          const at = anchorOf(event)
                          setPageMenu((open) => (open ? null : at))
                        }}>
                  <Icon.Ellipsis width={20} height={20} />
                </button>
                {pageMenu && (
                  <div className="wb-item-menu" role="menu" style={menuAt(pageMenu)}>
                    <button type="button" role="menuitem" disabled>
                      <PlayRow />
                      <span>{t('desk.actions.playNow')}</span>
                    </button>
                  </div>
                )}
              </span>
            </div>
            <p className="wb-item-meta">
              {sid ? (
                <img className="wb-room-badge" src={`/api/services/badge/${sid}?size=40`}
                     alt="" aria-hidden="true"
                     onError={(event) => { event.currentTarget.style.display = 'none' }} />
              ) : null}
              <span>{serviceName}</span>
              <span className="wb-item-dot">•</span>
              <span>{t(kindLabel({ item_type: itemType }))}</span>
            </p>
          </>
        )}
      </header>

      {atRoot && site && (
        <a className="wb-service-site" href={site} target="_blank" rel="noopener noreferrer">
          <Icon.ExternalLink width={16} height={16} />
          <span>{name}</span>
        </a>
      )}

      {/* What the product shows while a container is on its way: the eyebrow
          and title as gray pills over a row of tile ghosts, rather than an
          empty panel (measured on play.sonos.com 2026-09-19, opening
          Pandora's My Stations). */}
      {state.loading && !state.error && (
        <div className="wb-waiting" aria-busy="true">
          {/* The product ghosts its heading too, having opened the page
              before it knows the name; Sonora is handed the name by the row
              that opened it, so the real one stands and only the contents
              are waiting. */}
          <div className="wb-tiles wb-service-tiles">
            {Array.from({ length: 12 }, (unused, n) => (
              <div className="wb-tile" key={n} aria-hidden="true">
                <div className="wb-tile-art" />
                <div className="wb-ghost wb-ghost-line" />
                <div className="wb-ghost wb-ghost-line wb-ghost-short" />
              </div>
            ))}
          </div>
        </div>
      )}

      {state.error && (state.error.needs_auth && onLink ? (
        <div className="wb-empty-card wb-needs-link">
          <div className="wb-caution-row">
            <CautionBadge kind="sonos" size="large" logo={logo} title={t('services.caution.sonos', { gen: gen ?? 'S1' })} />
            <p><strong>{t('services.needsSonora.title')}</strong><br />
              {t('desk.browse.needsLink.body', { service: title, gen: gen ?? 'S1' })
              .split('\n').map((line, i) => (
                <React.Fragment key={i}>{i > 0 && <br />}{line}</React.Fragment>
              ))}</p>
          </div>
          <div className="wb-needs-link-actions">
            <button type="button" className="wb-btn"
                    onClick={() => onLink({ sid, name: title, zone, account_id: accountId || '' })}>
              {t('desk.browse.needsLink.action', { service: title })}
            </button>
            {armSonos ? (
              <span className="wb-inline-confirm">
                <span className="wb-service-tools-note">{t('services.removeSonosBody', { service: title })}</span>
                <button type="button" className="wb-btn" disabled={sonosBusy} onClick={removeFromSonos}>
                  {sonosBusy ? t('services.removing', { service: title }) : t('services.confirmRemove')}
                </button>
                <button type="button" className="wb-btn" data-variant="ghost" onClick={() => setArmSonos(false)}>
                  {t('common.cancel')}
                </button>
              </span>
            ) : (
              <button type="button" className="wb-btn" data-variant="ghost" onClick={() => setArmSonos(true)}>
                {t('services.removeFromSonos')}
              </button>
            )}
          </div>
          {sonosErr && <p className="wb-add-error">{sonosErr}</p>}
        </div>
      ) : (
        <div className="wb-empty-card">
          {state.error.needs_auth
            ? t('services.needsAccount', { service: title })
            : state.error.message}
        </div>
      ))}

      {atRoot && !onSystem && !state.loading && !state.error && (
        <div className="wb-empty-card wb-needs-link">
          <div className="wb-caution-row">
            <CautionBadge kind="sonora" size="large" logo={logo} title={t('services.caution.sonora', { gen: gen ?? 'S1' })} />
            <p><strong>{t('services.needsSonos.title', { gen: gen ?? 'S1' })}</strong><br />
              {t('services.sonoraOnly.body', { service: title, gen: gen ?? 'S1' })
              .split('\n').map((line, i) => (
                <React.Fragment key={i}>{i > 0 && <br />}{line}</React.Fragment>
              ))}</p>
          </div>
        </div>
      )}

      {/* What the row that opened this page said about itself sits directly
          over the content, 6px above it -- "local" over Community Radio
          Plus' stations, and 51px below the title rather than under it
          (measured 2026-09-20). */}
      {!atRoot && summary && !state.loading && !state.error
        && <p className="wb-service-summary">{summary}</p>}

      {shelves.length > 0 ? (
        shelves.map((shelf) => {
          // The shelf's own word for how it wants drawing, which the product
          // obeys: Amazon Music's Collections is four rows, its Followed
          // Playlists a line of tiles, and its upsell a sentence. View All
          // hangs on the shelves whose policies say they can be opened and
          // on no others (measured 2026-09-20).
          const shape = shelfShape(shelf)
          return (
          <section className="wb-section" key={shelf.id}>
            <div className="wb-section-head">
              <div><h2>{shelf.title}</h2></div>
              {shelf.can_open && (
                <button type="button" className="wb-viewall" onClick={() => openShelf(shelf)}>
                  {t('common.viewAll')}
                </button>
              )}
            </div>
            {shape === 'text' ? (
              /* The service's own sentence. It arrives wrapped in HTML --
                 Amazon Music sends a paragraph around a link, and the
                 product prints the tags on the page -- and is shown here
                 as the words it is. */
              <p className="wb-shelf-text">{shelf.summary}</p>
            ) : shape === 'rows' ? (
              <div className="wb-rows">
                {(shelf.children || []).map((child) => (
                  <button key={child.id} type="button" className="wb-row"
                          data-refused={(child.can_play === false && !child.is_container) || undefined}
                          disabled={child.can_play === false && !child.is_container}
                          onClick={() => open(child)}>
                    <span className="wb-row-art"><Art src={child.art} kind={child.item_type} size={24} /></span>
                    <span className="wb-row-text">
                      <span className="wb-row-label">{child.title}</span>
                      {child.summary && <span className="wb-row-sub">{child.summary}</span>}
                    </span>
                    <Icon.ChevronRight className="wb-row-chev" width={20} height={20} aria-hidden="true" />
                  </button>
                ))}
              </div>
            ) : (
              <TileRow
                items={shelf.children}
                render={(child) => {
                  const sub = second(child, state.display_types || {})
                  return (
                    <button key={child.id} type="button" className="wb-tile"
                            data-round={child.item_type === 'artist' || undefined}
                            onClick={() => open(child)}>
                      <span className="wb-tile-art"><Art src={child.art} kind={child.item_type} size={156} /></span>
                      <span className="wb-tile-label">{child.title}</span>
                      {sub && <span className="wb-tile-sub">{sub}</span>}
                    </button>
                  )
                }}
              />
            )}
          </section>
          )
        })
      ) : asTiles ? (
        <div className="wb-tiles wb-service-tiles">
          {items.map((row) => {
            const sub = asRound ? '' : second(row, state.display_types || {})
            return (
              <button key={row.id} type="button" className="wb-tile"
                      data-round={asRound || undefined} onClick={() => open(row)}>
                <span className="wb-tile-art"><Art src={row.art} kind={row.item_type} size={156} /></span>
                <span className="wb-tile-label">{row.title}</span>
                {sub && <span className="wb-tile-sub">{sub}</span>}
              </button>
            )
          })}
        </div>
      ) : (
        <div className="wb-rows" data-columns={itemType === 'artist' || undefined}>
          {items.map((row) => (
            <button
              key={row.id}
              type="button"
              className="wb-row"
              /* A track the service refuses is drawn at a fifth of the
                 brightness and does nothing (2026-09-22). */
              data-refused={(row.can_play === false && !row.is_container) || undefined}
              disabled={row.can_play === false && !row.is_container}
              onClick={() => open(row)}
            >
              <span className="wb-row-art"><Art src={row.art} kind={row.item_type} size={24} /></span>
              <span className="wb-row-text">
                <span className="wb-row-label"><span>{row.title}</span></span>
                {rowSub(row, state.display_types || {}) && (
                  <span className="wb-row-sub">{rowSub(row, state.display_types || {})}</span>
                )}
              </span>
              {/* Every row carries one, a playable station included: measured
                  on the product 2026-09-19, where 80er-Radio harmony's sixteen
                  streams each have a 20px chevron 8px from the right edge. */}
              <Icon.ChevronRight className="wb-row-chev" width={20} height={20} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}

    </div>
  )
}
