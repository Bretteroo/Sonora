import React, { useEffect, useState } from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { api } from '../../frontend/src/lib/api.js'
import { useMyRadioStations } from '../../frontend/src/lib/myRadio.js'
import { providerIdOf } from '../../frontend/src/lib/items.js'
import { itemAccount } from '../../frontend/src/lib/itemAccount.js'
import Art, { nowPlayingArt, cachedArt } from '../../frontend/src/components/Art.jsx'
import * as I from './icons.jsx'
import { Sheet, SheetBar, Busy, Confirm, ListItem, ShapeArt, Skeleton } from './m3.jsx'
import { SHAPES } from './shapes.js'
import { favoriteKey, sidOf } from './data.js'

// Info and options for a piece of music, the playing one or a browsed row,
// as a side sheet: the cover and its lines on a tonal card, then a list. The
// service's own rows come first in its own wording (Start Radio, Related
// shows, About this Book), then Sonos' own: the album and artist, the
// household's favorite, the playlist. The rows are drawn once the service
// has answered, so they arrive together.

export default function InfoSheet({ zone, item = null, hzone = null, serviceName = '', onClose, onMessage, onOpen, onAddToPlaylist, onFavoritesChanged, services = [] }) {
  const { t } = useI18n()
  const { actions } = useSystem()
  const transport = item
    ? { title: item.title, artist: item.artist, album: item.album, album_art_uri: item.art,
        source: /^x-sonosapi-(radio|stream|hls):/.test(item.uri || '') || item.item_type === 'program' || item.item_type === 'stream' ? 'service_radio' : 'queue' }
    : (zone?.transport || {})
  const [favorites, setFavorites] = useState([])
  const [favoritesVersion, setFavoritesVersion] = useState(0)
  const favUri = item ? (item.uri || '') : (transport.media_uri || transport.track_uri || '')
  const favZone = (item ? hzone : zone?.uuid) || ''
  const myRadio = useMyRadioStations(favZone)
  useEffect(() => {
    let canceled = false
    if (!favZone) { setFavorites([]); return undefined }
    api.favorites(favZone).then((r) => { if (!canceled) setFavorites(r?.items || []) }).catch(() => {})
    return () => { canceled = true }
  }, [favZone, favoritesVersion])
  const bumpFavorites = () => { setFavoritesVersion((v) => v + 1); onFavoritesChanged?.() }

  const [extended, setExtended] = useState({})
  const [meta, setMeta] = useState({})
  const [settled, setSettled] = useState(false)
  const extSid = sidOf(transport, item)
  const providerId = item ? (providerIdOf(item.uri) || item.id) : providerIdOf(transport.track_uri || '')
  // Which of the service's accounts the item belongs to: its URI's sn=, so a
  // household with two Spotify accounts is answered for the right one.
  const extAccount = itemAccount(((item ? item.uri : (transport.track_uri || transport.media_uri)) || '').match(/[?&]sn=(\d+)/)?.[1] || '', services, extSid)
  useEffect(() => {
    setExtended({}); setMeta({})
    setSettled(!extSid || !(providerId || (!item && zone?.uuid)))
    let canceled = false
    const asks = []
    if (providerId && extSid) {
      asks.push(api.serviceExtended(extSid, providerId, favZone, extAccount).then((r) => { if (!canceled) setExtended((prev) => ({ ...prev, ...(r || {}) })) }).catch(() => {}))
      asks.push(api.serviceItem(extSid, providerId, favZone, extAccount).then((r) => { if (!canceled) setMeta(r || {}) }).catch(() => {}))
    }
    if (!item && zone?.uuid) {
      asks.push(api.itemMetadata(zone.uuid).then(async (r) => {
        if (canceled) return
        setExtended((prev) => ({ ...prev, ...(r || {}) }))
        const late = r?.item_id
        if (!late || providerId || !extSid) return
        const [more, self] = await Promise.all([
          api.serviceExtended(extSid, late, favZone, extAccount).catch(() => null),
          api.serviceItem(extSid, late, favZone, extAccount).catch(() => null),
        ])
        if (canceled) return
        if (more) setExtended((prev) => ({ ...prev, ...more, item_id: late }))
        if (self) setMeta(self)
      }).catch(() => {}))
    }
    if (asks.length) Promise.all(asks).then(() => { if (!canceled) setSettled(true) })
    return () => { canceled = true }
  }, [providerId, extSid, favZone, zone?.uuid]) // eslint-disable-line react-hooks/exhaustive-deps

  const already = favUri ? favorites.find((f) => favoriteKey(f.uri) === favoriteKey(favUri)) : null
  const addFavorite = async () => {
    const result = item
      ? await actions.addFavoriteItem(hzone, { uri: item.uri, metadata: item.metadata || '', title: item.title, art: item.art || '', description: item.favoriteDescription || '' })
      : await actions.addFavorite(zone.uuid)
    if (!result) return
    onMessage?.(t(result.exists ? 'desk.info.alreadyFavorite' : 'desk.info.addedFavorite', { title: result.title || transport.container_title || transport.title }))
    bumpFavorites()
  }
  const removeFavorite = already ? async () => {
    const done = await actions.removeFavorite(favZone, already.id)
    if (done) { onMessage?.(t('desk.info.removedFavorite', { title: already.title })); bumpFavorites() }
  } : null
  const runLink = async (link) => {
    if (link.type === 'openUrl') { window.open(link.url, '_blank', 'noopener,noreferrer'); return }
    const done = await actions.serviceAction(favZone, extSid, link)
    if (done?.ok) { onMessage?.(link.success || t('desk.info.actionDone')); if (link.refresh) bumpFavorites() }
    else if (done) onMessage?.(link.failure || t('desk.info.actionFailed'))
  }

  // A Spotify Connect session on an S2 room (x-sonos-vli:) is a song, so it
  // gets the song's options, as the S2 app gives it (2026-10-04).
  const station = transport.source !== 'queue' && !(!item && /^x-sonos-vli:/.test(transport.media_uri || ''))
  // An item handed over without a picture (Artist Info, or an album opened from a song) takes the
  // one the service gives for it once that arrives.
  const headerArt = item ? (item.art || (meta.art ? cachedArt(meta.art) : '')) : (zone ? nowPlayingArt(zone.host, transport) : '')
  const kind = meta.item_type || item?.item_type || ''
  const episode = /^episode\./.test(meta.semantic_type || item?.semantic_type || '')
  const fromQueue = item ? (item.kind !== undefined && item.item_type === undefined) : transport.source === 'queue'
  const audiobook = !fromQueue && Boolean(meta.author || meta.narrator || item?.author || (!item && (transport.narrator || transport.track_kind === 'audiobook')))
  const trackOnStation = station && !item && (transport.artist || transport.album) && transport.title && transport.title !== transport.container_title
  const lines = (station && !trackOnStation
    ? [[t('desk.info.station'), transport.container_title || (item ? item.title : transport.title)]]
    : trackOnStation
      ? [[t('desk.now.songLabel'), transport.title], [t('desk.now.artist'), transport.artist], [t('desk.now.album'), transport.album]]
      : kind === 'audiobook'
        ? [[t('desk.now.book'), meta.title || item?.title || ''], [t('desk.now.author'), meta.author || item?.author || '']]
        : audiobook
          ? [[t('desk.now.chapter'), meta.title || item?.title || transport.title], [t('desk.now.author'), meta.author || item?.author || transport.artist],
             ...(meta.narrator || item?.narrator || transport.narrator ? [[t('desk.now.narrator'), meta.narrator || item?.narrator || transport.narrator]] : [])]
          : episode
            ? [[t('desk.now.episode'), meta.title || item?.title || transport.title], [t('desk.now.podcast'), meta.podcast || item?.podcast || ''], [t('desk.info.provider'), meta.producer || item?.artist || transport.artist]]
            : kind === 'album'
              ? [[t('desk.now.album'), meta.title || transport.title], [t('desk.now.artist'), meta.artist || transport.artist]]
              : kind === 'artist'
                ? [[t('desk.now.artist'), meta.title || transport.title]]
                : [[t('desk.now.songLabel'), transport.title], [t('desk.now.artist'), meta.artist || transport.artist], [t('desk.now.album'), meta.album || transport.album],
                   // The station the service would start from this track (its relatedPlay).
                   [t('desk.info.station'), extended.related_play?.title || '']]
  ).filter(([, value]) => value)

  const pick = item ? { uri: item.uri, title: item.title, metadata: item.metadata || '' }
    : (zone?.transport?.track_uri ? { uri: zone.transport.track_uri, title: zone.transport.title || '', metadata: '' } : null)
  const addToPlaylist = onAddToPlaylist && pick?.uri ? () => onAddToPlaylist(pick, item ? undefined : 'Q:0') : null

  const favoriteRow = already
    ? { label: t('desk.info.removeFavorite'), act: removeFavorite, icon: <I.Star /> }
    : { label: t(station ? 'desk.info.addStationFavorite' : kind === 'album' ? 'desk.info.addAlbumFavorite' : kind === 'audiobook' ? 'desk.info.addBookFavorite'
                 : episode ? 'desk.info.addEpisodeFavorite' : 'desk.info.addSongFavorite'), act: addFavorite, icon: <I.Star /> }
  // An info link (Album Info, Artist Info, Podcast Info) carries the service and what the item is,
  // so the sheet can open on it; without the service the browser took its id for a folder of the
  // speaker's own library, which answered 701 (2026-10-06).
  const openItem = (id, title, info, kind = '', art = '') => (onOpen && id
    ? () => onOpen(info ? { id: `__info-${id}`, info: true, title, item: { id, title, item_type: kind, service_id: extSid, art: art && !art.startsWith('/api/art?') ? cachedArt(art) : art }, service: extSid, serviceName } : { id, title, item: id, service: extSid, serviceName })
    : null)
  const albumRows = kind === 'album'
    ? [{ label: t('desk.info.viewAllSongs'), more: true, act: openItem(item?.id, meta.title || item?.title, false) },
       ...(meta.artist_id ? [{ label: t('desk.info.artistInfo'), more: true, act: openItem(meta.artist_id, meta.artist, true, 'artist') }] : [])]
    : []
  const stationUri = item ? (item.uri || '') : (transport.media_uri || '')
  const stationName = item ? item.title : (transport.container_title || transport.title || '')
  const addToMyStations = favZone && stationUri && stationName ? async () => {
    const done = await actions.addRadioStation(favZone, stationUri, stationName)
    if (done) { onMessage?.(t(done.exists ? 'desk.radio.alreadyMine' : 'desk.radio.addedMine', { title: done.title || stationName })); myRadio.reload() }
  } : null
  // Already saved, the row takes it out again, as the app's does.
  const savedStation = stationUri ? myRadio.find(stationUri) : null
  const removeFromMyStations = savedStation ? async () => {
    const done = await actions.removeRadioStation(favZone, savedStation.id)
    if (done) { onMessage?.(t('desk.radio.removedMine', { title: savedStation.title || stationName })); myRadio.reload() }
  } : null
  const showId = item ? '' : (transport.stream_show_id || '')
  const showName = item ? '' : (transport.stream_show || '')
  const sidHere = sidOf(transport, item)
  const addToMyShows = favZone && showId && showName ? async () => {
    const uri = `x-sonosapi-stream:${encodeURIComponent(showId)}?sid=${sidHere}&flags=8224&sn=0`
    const done = await actions.addRadioStation(favZone, uri, showName, 'shows')
    if (done) onMessage?.(t(done.exists ? 'desk.radio.alreadyShow' : 'desk.radio.addedShow', { title: done.title || showName }))
  } : null
  const favoriteAction = (menuItem) => {
    const on = /^Add\w*ToFavorites$/.test(menuItem.item)
    const off = /^Remove\w*FromFavorites$/.test(menuItem.item)
    // Now Playing's page has no browse row: the playing item's own id then.
    const target = item?.id || providerId
    if ((!on && !off) || !extSid || !target) return null
    return async () => {
      const done = await actions.serviceFavorite(extSid, { item: item.id, favorite: on, zone: favZone || undefined })
      if (done?.ok) onMessage?.(menuItem.label)
    }
  }
  // "Add Song to <service> Playlist": asked once whether the service keeps
  // playlists of the account's own, and the row drawn only where it does.
  const songKind = !station && !episode && !['album', 'artist', 'playlist', 'audiobook'].includes(kind)
  const [userPlaylists, setUserPlaylists] = useState(false)
  const [pickingService, setPickingService] = useState(false)
  useEffect(() => {
    setUserPlaylists(false)
    if (!extSid || !providerId || !songKind) return undefined
    let canceled = false
    api.userPlaylists(extSid, { zone: favZone, account: extAccount, probe: true })
      .then((r) => { if (!canceled) setUserPlaylists(Boolean(r?.available)) }).catch(() => {})
    return () => { canceled = true }
  }, [extSid, providerId, songKind, favZone, extAccount])
  const sameService = services.filter((svc) => svc.id === extSid)
  const accountName = sameService.length > 1
    ? sameService.find((svc) => String(svc.account_id ?? '') === extAccount)?.nickname || '' : ''
  const servicePlaylistLabel = t('desk.info.addToServicePlaylist', { service: accountName ? `${serviceName} (${accountName})` : serviceName })
  // Start the station the service seeds from this item (its relatedPlay).
  const relatedPlay = extended.related_play?.id && !['album', 'artist', 'playlist'].includes(kind) ? extended.related_play : null
  const startRadio = relatedPlay && extSid ? async () => {
    const found = await api.serviceItem(extSid, relatedPlay.id, favZone, extAccount).catch(() => null)
    const target = zone?.uuid || favZone
    if (!found?.uri || !target) { onMessage?.(t('notice.error.title')); return }
    await actions.setSource(target, { uri: found.uri, metadata: found.metadata || '', title: relatedPlay.title || '', service: extSid, kind: relatedPlay.item_type || '' })
  } : null
  // Where the service says whether the item is one of its favorites (a
  // dynamic isHearted), only the row that applies is offered.
  const hearted = meta.properties?.isHearted
  const menuRows = (extended.menu || []).filter((m) => {
    const fav = /^(Add|Remove)(Album|Track|Artist|Playlist|Show|Episode)?(To|From)Favorites$/.exec(m.item || '')
    if (fav) {
      if (hearted === '0' && fav[1] === 'Remove') return false
      if (hearted === '1' && fav[1] === 'Add') return false
      const forKind = fav[2] || ''
      const itemKind = kind === 'album' || kind === 'artist' || kind === 'playlist' ? kind : episode ? 'episode' : 'track'
      if (forKind && forKind.toLowerCase() !== itemKind && !(forKind === 'Show' && episode)) return false
      return meta.can_add_to_favorites !== false
    }
    if (m.item === 'RelatedPlay') return Boolean(extended.related_play) && !['album', 'artist', 'playlist'].includes(kind)
    return true
  })
  const serviceRows = [
    ...(startRadio && !menuRows.some((m) => m.item === 'RelatedPlay') ? [{ label: t('desk.info.startRadio'), act: startRadio, icon: <I.Radio /> }] : []),
    // The service's own playlists, where it keeps any for the account.
    ...(userPlaylists ? [{ label: servicePlaylistLabel, more: true, act: () => setPickingService(true), icon: <I.Playlist /> }] : []),
    ...menuRows.map((m) => (m.item === 'RelatedPlay'
      ? { label: m.label, act: startRadio, icon: <I.Radio /> }
      : { label: m.label, act: favoriteAction(m), icon: <I.Heart /> })),
    ...(extended.related || []).filter((r) => r.label && r.id).map((r) => ({ label: r.label, more: true, act: onOpen ? () => onOpen({ id: r.id, title: r.label, item: r.id, service: extSid, serviceName }) : null })),
    ...(extended.text && extended.text_label
      ? [{ label: extended.text_label, more: true, act: onOpen ? () => onOpen({ id: `__text-${extended.text}`, prose: true, title: extended.text_label, header: { art: headerArt, lines }, textOf: { sid: extSid, item: extended.text, type: extended.text_type || 'DESCRIPTION' } }) : null }]
      : []),
  ]
  const rows = station ? [
    ...(sidHere === 254 ? [savedStation
      ? { label: t('desk.info.removeMyStations'), act: removeFromMyStations, icon: <I.Radio /> }
      : { label: t('desk.info.addMyStations'), act: addToMyStations, icon: <I.Radio /> }] : []),
    ...(sidHere === 254 && addToMyShows ? [{ label: t('desk.info.addMyShows'), act: addToMyShows, icon: <I.Radio /> }] : []),
    favoriteRow,
  ] : [
    ...serviceRows,
    ...albumRows,
    ...(episode && meta.podcast_id ? [{ label: t('desk.info.podcastInfo'), more: true, act: openItem(meta.podcast_id, meta.podcast, true, 'container') }] : []),
    ...(albumRows.length || episode ? [] : meta.album_id || meta.artist_id
      ? [...(meta.album_id ? [{ label: t('desk.info.albumInfo'), more: true, act: openItem(meta.album_id, meta.album, true, 'album', meta.art || item?.art || '') }] : []),
         ...(meta.artist_id ? [{ label: t('desk.info.artistInfo'), more: true, act: openItem(meta.artist_id, meta.artist, true, 'artist') }] : [])]
      : (transport.album && transport.artist ? [{ label: t('desk.info.albumInfo'), more: true }, { label: t('desk.info.artistInfo'), more: true }] : [])),
    ...(extended.links || []).filter((l) => l.label).map((l) => ({ label: l.label, act: () => runLink(l), icon: <I.Link /> })),
    favoriteRow,
    ...(kind === 'audiobook' ? [] : [{ label: t(kind === 'album' ? 'desk.info.addAlbumPlaylist' : episode ? 'desk.info.addEpisodePlaylist' : 'desk.info.addToSonosPlaylist'), more: true, act: addToPlaylist, icon: <I.Playlist /> }]),
  ].filter((r) => r.label)

  return (
    <Sheet kind="side" title={t('desk.now.infoOptions')} onClose={onClose} className="mg-info">
      <SheetBar title={t('desk.now.infoOptions')} sub={serviceName} onClose={onClose} />
      <div className="mg-sheet-body">
        <div className="mg-card mg-card-tonal mg-info-head">
          <ShapeArt src={headerArt} shape={SHAPES.cookie12} size={112} fallback="note" />
          <dl className="mg-info-lines">
            {lines.map(([label, value]) => (
              <React.Fragment key={label}><dt>{label}</dt><dd>{value}</dd></React.Fragment>
            ))}
          </dl>
        </div>
        {!settled && <Skeleton label={t('desk.browse.loading')} kind="list" rows={3} />}
        {settled && (
          <div className="mg-list">
            {rows.map((row) => (
              <ListItem key={row.label} disabled={!row.act} onClick={row.act || (() => {})} title={row.act ? undefined : t('desk.menu.disabledNote')}
                        leading={<span className="mg-li-glyph">{row.icon || <I.Sparkle />}</span>} headline={row.label}
                        trailing={row.more ? <I.Chevron /> : null} />
            ))}
          </div>
        )}
      </div>
      {pickingService && (
        <ServicePlaylistSheet title={servicePlaylistLabel} sid={extSid} account={extAccount} zone={favZone}
                              song={{ id: providerId, title: item?.title || transport.title || '' }}
                              onClose={() => setPickingService(false)} onMessage={onMessage} />
      )}
    </Sheet>
  )
}

// The account's own playlists on the service, the ones it only follows
// grayed, and New Playlist, which makes one seeded with the song.
function ServicePlaylistSheet({ title, sid, account, zone, song, onClose, onMessage }) {
  const { t } = useI18n()
  const [rows, setRows] = useState(null)
  const [naming, setNaming] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let canceled = false
    api.userPlaylists(sid, { zone, account }).then((r) => { if (!canceled) setRows(r?.items || []) }).catch(() => { if (!canceled) setRows([]) })
    return () => { canceled = true }
  }, [sid, zone, account])
  const add = async (body, name) => {
    setBusy(true)
    try {
      await api.addToUserPlaylist(sid, { zone, account, item: song.id, ...body })
      onMessage?.(t('desk.playlists.added', { title: song.title, playlist: name }))
      onClose()
    } catch (exc) {
      onMessage?.(exc?.message || t('notice.error.title'))
      setBusy(false)
    }
  }
  return (
    <Sheet kind="bottom" title={title} onClose={onClose}>
      <SheetBar title={title} sub={song.title} onClose={onClose} />
      <div className="mg-sheet-body">
        {rows === null ? <Skeleton label={t('desk.browse.loading')} kind="list" rows={3} /> : (
          <div className="mg-list">
            <ListItem leading={<span className="mg-li-glyph mg-li-glyph-primary"><I.Plus /></span>} headline={t('desk.playlists.new')} disabled={busy} onClick={() => setNaming(true)} />
            {rows.map((row) => (
              <ListItem key={row.id} disabled={!row.editable || busy} onClick={() => add({ playlist: row.id }, row.title)}
                        leading={<span className="mg-li-art"><Art src={row.art} size={40} fallback="container" /></span>}
                        headline={row.title} supporting={row.owner || ''} />
            ))}
          </div>
        )}
      </div>
      {naming && (
        <Confirm title={t('desk.playlists.nameTitle')} body={t('desk.playlists.nameBody')} action={t('common.ok')} icon={<I.Playlist />}
                 input={{ initial: '', label: t('desk.playlists.nameTitle') }}
                 onClose={() => setNaming(false)} onConfirm={(name) => { setNaming(false); add({ title: name }, name) }} />
      )}
    </Sheet>
  )
}

// The prose behind a service's Description row ("About this Book").
export function ProseSheet({ node, onClose, onBack }) {
  const { t } = useI18n()
  const [text, setText] = useState(null)
  useEffect(() => {
    let canceled = false
    api.serviceText(node.textOf.sid, node.textOf.item, node.textOf.type, node.hzone)
      .then((r) => { if (!canceled) setText(r?.text || '') }).catch(() => { if (!canceled) setText('') })
    return () => { canceled = true }
  }, [node.textOf.sid, node.textOf.item, node.textOf.type, node.hzone])
  return (
    <Sheet kind="side" title={node.title} onClose={onClose} className="mg-info">
      <SheetBar title={node.title} onClose={onClose} back={onBack} />
      <div className="mg-sheet-body">
        {node.header && (
          <div className="mg-card mg-card-tonal mg-info-head">
            <ShapeArt src={node.header.art || ''} shape={SHAPES.cookie12} size={112} fallback="note" />
            <dl className="mg-info-lines">
              {(node.header.lines || []).map(([label, value]) => (
                <React.Fragment key={label}><dt>{label}</dt><dd>{value}</dd></React.Fragment>
              ))}
            </dl>
          </div>
        )}
        {text === null ? <Skeleton label={t('desk.browse.loading')} kind="list" rows={3} />
          : !text ? <p className="mg-muted">{t('desk.browse.noSelections')}</p>
          : <div className="mg-prose">{text.split('\n').map((line, i) => <p key={i}>{line}</p>)}</div>}
      </div>
    </Sheet>
  )
}
