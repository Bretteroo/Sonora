import React, { useEffect, useState } from 'react'
import { api } from '../../frontend/src/lib/api.js'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import * as Icon from '../../frontend/src/components/Icons.jsx'
import Art from './Art.jsx'
import { PlayRow } from './icons.jsx'
import { anchorOf, menuAt, useDismiss } from './menus.js'

// The household's music library, opened from Your Sources.
//
// The product (play.sonos.com, 2026-09-14) gives the root a grid of seven
// 141px tiles -- Artists, Albums, Composers, Songs, Genres, Imported
// Playlists, Folders, in that order and with no Contributing Artists -- under
// a 40px "Music Library" title, and every level beneath it a list of 56px
// rows on a 72px pitch: art or a glyph, the title 16px after it, a chevron on
// a folder. A track plays into the browse room.

const ROOT = [
  ['A:ALBUMARTIST', 'artists', Icon.Mic],
  ['A:ALBUM', 'albums', Icon.Disc],
  ['A:COMPOSER', 'composers', Icon.Clef],
  ['A:TRACKS', 'songs', Icon.Note],
  ['A:GENRE', 'genres', Icon.Stack],
  ['A:PLAYLISTS', 'importedPlaylists', Icon.Playlist],
  ['S:', 'foldersNode', Icon.Folder],
]

export default function LibraryPage({ item = 'A:', name = '', uri = '', metadata = '', zone, playZone = '', nav }) {
  const { t } = useI18n()
  const { actions } = useSystem()
  const [state, setState] = useState({ loading: true, items: [] })
  const [menu, setMenu] = useState(null)
  useDismiss(Boolean(menu), () => setMenu(null))
  const root = item === 'A:'

  useEffect(() => {
    let canceled = false
    setState({ loading: true, items: [] })
    api.browse(item, { zone, count: 500 })
      .then((data) => !canceled && setState({ loading: false, items: data.items ?? [] }))
      .catch((exc) => !canceled && setState({ loading: false, items: [], error: exc.message }))
    return () => { canceled = true }
  }, [item, zone])

  // A list of songs -- Songs itself, an album, an imported playlist, an
  // artist's "All" -- opens as the product's list page, with Play, Shuffle
  // and More over a Title / Album table (play.sonos.com, 2026-09-30).
  const opensAsList = (row) => row.id === 'A:TRACKS'
    || ['album', 'playlist', 'artist_tracks'].includes(row.kind) || /^A:PLAYLISTS\//.test(row.id || '')
  const openList = (row, placeholder) => nav.push({
    kind: 'library-list', item: row.id, name: row.title, zone,
    art: row.art || '', uri: row.uri || '', metadata: row.metadata || '',
    placeholder: placeholder || (row.kind === 'album' ? 'disc' : /^A:PLAYLISTS/.test(row.id || '') ? 'playlist' : 'note'),
  })
  const open = (row) => {
    if (row.is_container && opensAsList(row)) {
      openList(row)
    } else if (row.is_container) {
      nav.push({ kind: 'library', item: row.id, name: row.title, zone, uri: row.uri || '', metadata: row.metadata || '' })
    } else if (row.uri) {
      actions.setSource(zone, { uri: row.uri, metadata: row.metadata || '' })
    }
  }

  // Each list wears its own kind's glyph where a row has no picture, as the
  // product draws them: a microphone in a circle for an artist, a clef for a
  // composer, the genre and folder glyphs, an album's for an album
  // (play.sonos.com, 2026-09-30). A cover Sonora can read still shows.
  const kindOf = (id) => (/^A:(ALBUM)?ARTIST/.test(id) ? 'artist' : /^A:ALBUM/.test(id) ? 'album'
    : /^A:COMPOSER/.test(id) ? 'composer' : /^A:GENRE/.test(id) ? 'genre' : /^S:/.test(id) ? 'folder' : '')
  const listKind = kindOf(item)
  const artistPage = listKind === 'artist' && /\//.test(item)
  const RowGlyph = artistPage ? Icon.Disc
    : { artist: Icon.Mic, album: Icon.Disc, composer: Icon.Clef, genre: Icon.Stack, folder: Icon.Folder }[listKind] || Icon.Note
  const roundRows = listKind === 'artist' && !artistPage
  const HeadGlyph = { artist: Icon.Mic, album: Icon.Disc, composer: Icon.Clef, genre: Icon.Stack, folder: Icon.Folder }[listKind] || Icon.Note
  const room = playZone || zone
  const title = root ? t('desk.browse.library') : name
  const present = new Set(state.items.map((row) => row.id))

  return (
    <div className="wb-service-page" data-library="true">
      <button type="button" className="wb-service-close" title={t('common.close')} onClick={nav.home}>
        <Icon.Close width={16} height={16} />
      </button>
      {/* Below a category -- an artist, a composer, a genre, a folder --
          the page is the thing itself, and the product heads it as it heads
          an album: its glyph large (the artist's in a circle), the name, and
          Play and Shuffle discs (play.sonos.com, 2026-09-30). */}
      {!root && uri && /\//.test(item) ? (
        <div className="wb-list-head" data-library-head="true">
          <div className="wb-item-art" data-round={listKind === 'artist' || undefined}>
            <HeadGlyph width={96} height={96} aria-hidden="true" />
          </div>
          <div className="wb-item-main">
            <h1>{title}</h1>
            <div className="wb-item-actions">
              <button type="button" className="wb-item-play" title={t('web.playTitle', { title })}
                      onClick={() => actions.setSource(room, { uri, metadata })}>
                <Icon.Play width={20} height={20} />
              </button>
              <button type="button" className="wb-item-dots" title={t('web.shuffleTitle', { title })}
                      onClick={async () => { await actions.setSource(room, { uri, metadata }); actions.setPlayMode(room, 'SHUFFLE_NOREPEAT') }}>
                <Icon.Shuffle width={20} height={20} />
              </button>
              <span className="wb-item-more">
                <button type="button" className="wb-item-dots" aria-expanded={Boolean(menu)} title={t('web.moreTitle')}
                        onClick={(event) => { const at = anchorOf(event); setMenu((open) => (open ? null : at)) }}>
                  <Icon.Ellipsis width={20} height={20} />
                </button>
                {menu && (
                  <div className="wb-item-menu" role="menu" style={menuAt(menu)}>
                    <button type="button" role="menuitem"
                            onClick={() => { actions.setSource(room, { uri, metadata }); setMenu(null) }}>
                      <PlayRow />
                      <span>{t('desk.actions.playNow')}</span>
                    </button>
                  </div>
                )}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <header className="wb-service-head">
          <h1>{title}</h1>
        </header>
      )}

      {state.error && <div className="wb-empty-card">{state.error}</div>}

      {root ? (
        <div className="wb-library-tiles">
          {ROOT.filter(([id]) => id === 'S:' || present.has(id) || state.loading).map(([id, label, Glyph]) => (
            <button key={id} type="button" className="wb-library-tile"
                    onClick={() => {
                      const row = state.items.find((r) => r.id === id)
                      if (id === 'A:TRACKS' && row) openList({ ...row, title: t(`desk.library.${label}`) }, 'note')
                      else nav.push({ kind: 'library', item: id, name: t(`desk.library.${label}`), zone })
                    }}>
              <span className="wb-library-tile-box"><Glyph width={64} height={64} /></span>
              <span className="wb-library-tile-label">{t(`desk.library.${label}`)}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="wb-rows">
          {state.items.map((row) => (
            <button key={row.id} type="button" className="wb-row"
                    title={row.is_container ? undefined : t('web.playTitle', { title: row.title })}
                    onClick={() => open(row)}>
              <span className="wb-row-art" data-round={roundRows || undefined}>
                {row.art ? <Art src={row.art} size={24} fallback={row.is_container ? 'container' : 'note'} />
                  : row.kind === 'artist_tracks' ? <Icon.Playlist width={24} height={24} aria-hidden="true" />
                  : <RowGlyph width={24} height={24} aria-hidden="true" />}
              </span>
              <span className="wb-row-text">
                <span className="wb-row-label">{row.title}</span>
                {!row.is_container && row.artist && <span className="wb-row-sub">{row.artist}</span>}
              </span>
              {row.is_container && <Icon.ChevronRight className="wb-row-chev" width={20} height={20} aria-hidden="true" />}
            </button>
          ))}
          {!state.loading && !state.error && state.items.length === 0 && (
            <div className="wb-empty-card">{t('web.library.empty')}</div>
          )}
        </div>
      )}
    </div>
  )
}
