import { itemAccount } from '../../frontend/src/lib/itemAccount.js'
import { libraryScope } from '../../frontend/src/lib/librarySearch.js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SONOS_RADIO } from '../../frontend/src/lib/sonosServices.js'
import { api } from '../../frontend/src/lib/api.js'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { orderedHouseholds, streamText, streamFileName } from '../../frontend/src/lib/format.js'
import { isPlayableLeaf } from '../../frontend/src/lib/items.js'
import { serviceCaution } from '../../frontend/src/components/CautionBadge.jsx'
import { artUrl, cachedArt } from '../../frontend/src/components/Art.jsx'

// What Hi-Fi knows about the house: the data hooks and the rules for playing
// things, shared by every component in the rack. A copy of the rules the
// other modern shells follow (an audiobook is handed to the player whole, a
// station cannot be queued, Play Now on a queueable item drops it after the
// current track), kept here so the theme stands alone and a room behaves the
// same whichever theme drives it.

import { isLoaded, nextTransport, togglePlay, isFixedSource } from '../../frontend/src/lib/transport.js'
import { groupTitle } from '../../frontend/src/lib/groups.js'
import { useQueue } from '../../frontend/src/lib/useQueue.js'
import { tvSignalLine } from '../../frontend/src/lib/tvFormat.js'
import { versionLabel } from '../../frontend/src/lib/version.js'

export const GROUP_KEY = 'sonora.desktop.group'  // the room in view, shared with the desktop themes
export const SYSTEM_KEY = 'sonora.system'
export const FUNCTION_KEY = 'sonora.hifi.function'
export const VIEW_KEY = 'sonora.hifi.view'
export const ACCOUNT_CHOICE_KEY = 'sonora.serviceAccounts'
export const TUNEIN_ICONS = 'http://cdn-albums.tunein.com/sonos'
export const STATION_URI = /^(x-sonos-htastream|x-rincon-stream|x-sonosapi-radio|x-sonosapi-stream|x-sonosapi-hls|x-rincon-mp3radio):/

export function readStored(key, fallback = null) {
  try { return window.localStorage.getItem(key) ?? fallback } catch { return fallback }
}
export function writeStored(key, value) {
  try { window.localStorage.setItem(key, value) } catch { /* private mode */ }
}

// --- rules -----------------------------------------------------------------

export function isQueueable(item) {
  if (!item || item.item_type === 'audiobook') return false
  return Boolean(item.uri) && !STATION_URI.test(item.uri)
}
export function isStation(item) {
  return /^x-sonosapi-(radio|stream|hls):/.test(item?.uri || '') || item?.item_type === 'program' || item?.item_type === 'stream'
}
export function sidOf(transport, item) {
  const uri = (item ? item.uri : transport?.media_uri) || ''
  const found = /[?&]sid=(\d+)/.exec(uri)
  // An item with no URI (an album opened from Album Info) names its service itself.
  return found ? Number(found[1]) : (item?.service_id || transport?.service_id || 0)
}
export function favoriteKey(uri) {
  if (!uri) return ''
  const [path, query = ''] = String(uri).split('?')
  const sid = /(?:^|&)sid=(\d+)/.exec(query)?.[1] || ''
  return `${path.replace(/%[0-9a-f]{2}/gi, (m) => m.toLowerCase())}|${sid}`
}
export function genericArt(item) {
  const kind = item.item_type || ''
  if (item.playlist || kind === 'playlist' || kind === 'albumList' || item.kind === 'playlist') return 'playlist'
  // A Recently Played entry names its kind, not an item type.
  if (kind === 'stream' || kind === 'program' || item.radio || item.kind === 'station' || item.kind === 'stream'
      || /^x-sonosapi-(radio|stream|hls):/.test(item.uri || '')) return 'station'
  if (item.is_container || item.container) return kind === 'album' ? 'disc' : (kind === 'container' || !kind ? 'container' : 'multi')
  return kind === 'track' || kind === 'episode' ? 'track' : 'disc'
}
// The app's description for a favorite: "<Service> Station", "<Service>
// Playlist", "Album by <artist>", "By <artist>", else the service's name.
export function describeFavorite(item, serviceName) {
  const kind = item.item_type || (item.is_container ? 'container' : 'track')
  if (kind === 'program' || kind === 'stream' || /^x-sonosapi-(radio|stream|hls):/.test(item.uri || '')) return serviceName ? `${serviceName} Station` : 'Station'
  if (kind === 'album') return item.artist ? `Album by ${item.artist}` : (serviceName ? `${serviceName} Album` : 'Album')
  if (kind === 'track') return item.artist ? `By ${item.artist}` : serviceName
  if (item.is_container) return serviceName ? `${serviceName} Playlist` : 'Playlist'
  return serviceName
}
export function bodyFor(item, service) {
  const body = { uri: item.uri, metadata: item.metadata || '', title: item.title || '', kind: item.item_type || '' }
  return service ? { ...body, service } : body
}
export function hasMusic(tr) {
  return Boolean(tr && (tr.title || tr.stream_content || (tr.queue_length ?? 0) > 0
    || ['tv', 'line_in', 'external_session'].includes(tr.source)))
}

// Whether a room counts as "on" for the Home page, which lists what is
// playing rather than every room that exists. Playing and transitioning
// obviously count; so does paused with something on the deck, since that is a
// room you are coming back to. Stopped does not, and neither does paused with
// nothing loaded: a queue left behind from last week is not music playing.
export function isOnAir(tr) {
  if (tr?.state === 'PLAYING' || tr?.state === 'TRANSITIONING') return true
  if (tr?.state !== 'PAUSED_PLAYBACK') return false
  return Boolean(tr.title || tr.stream_content
                 || ['tv', 'line_in', 'external_session'].includes(tr.source))
}
// Moved to lib/transport.js, where every shell reads the same
// rule. The NO_PAUSE list that used to sit here overrode the speaker's own
// can_pause and got http_stream wrong; see that file. Imported rather than
// re-exported straight through, because this file calls them itself and a
// bare `export … from` gives no local binding.
export { isLoaded, nextTransport, togglePlay, isFixedSource }
export function canSkip(tr) {
  // A transport that says it cannot skip means it: the browser room plays a
  // single live stream with nothing on either side of it.
  return isLoaded(tr) && tr?.can_skip !== false && !isFixedSource(tr)
    && !tr?.is_external_session && tr?.state !== 'STOPPED'
}
// Next as well: where the position cannot be moved, the speaker's word on Next decides, as in
// Sonos' own apps. A skip it then refuses (UPnP 800, a skip limit) is said in a notice and the
// key stays live.
export function canNext(tr) {
  return canSkip(tr) && (tr?.can_seek !== false || tr?.can_next !== false)
}
// Previous the same way: a Sonos Radio station offers no Previous and answers it with
// UPnP 701 (2026-10-03).
export function canPrevious(tr) {
  return canSkip(tr) && (tr?.can_seek !== false || tr?.can_previous !== false)
}
// Pause every playing group the way the app's Pause All does: Stop for what
// will not pause, and television rooms left alone.
export function pauseEverything(actions, groups, zones) {
  for (const g of groups) {
    const tr = zones[g.coordinator]?.transport
    if (tr?.state !== 'PLAYING' || tr.source === 'tv') continue
    if (nextTransport(tr) === 'stop') actions.stop(g.coordinator)
    else actions.pause(g.coordinator)
  }
}

// The lines under a piece of music, captioned the way the source calls
// for: a queue track is Song / Artist / Album, a broadcast Station / On Now
// / Information, a chapter Chapter / Author / Narrator, a podcast Episode /
// Podcast / Release date. `provider` is the service's own metadata when read.
export function nowLines(transport, provider, t) {
  const tr = transport || {}
  const broadcast = /^x-sonosapi-stream:/.test(tr.media_uri || '')
  const episode = provider && /^episode\./.test(provider.semantic_type || '')
  const audiobook = tr.source !== 'queue' && Boolean(provider?.author || provider?.narrator || tr.narrator || tr.track_kind === 'audiobook')
  // A soundbar on TV: the input when the cloud names it, then "No Signal" or the format the speaker
  // reports receiving (lib/tvFormat.js).
  if (tr.source === 'tv') {
    const signal = tvSignalLine(tr, t)
    return [[t('source.tv'), tr.tv_input || t('source.tv')],
      ...(signal ? [[tr.tv_signal === false ? t('desk.now.information') : t('desk.now.tvFormat'), signal]] : [])]
  }
  if (audiobook) {
    return [[t('desk.now.chapter'), provider?.title || tr.title || ''], [t('desk.now.author'), provider?.author || tr.artist || ''],
      [t('desk.now.narrator'), provider?.narrator || tr.narrator || ''], [t('desk.now.book'), provider?.book || tr.book || tr.container_title || '']].filter(([, v]) => v)
  }
  if (episode) {
    const date = provider.release_date && !/^0001/.test(provider.release_date) ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(provider.release_date)) : ''
    return [[t('desk.now.episode'), provider.title || tr.title || ''], [t('desk.now.podcast'), provider.podcast || provider.artist || ''],
      [t('desk.now.releaseDate'), date]].filter(([, v]) => v)
  }
  if (broadcast) {
    const raw = tr.stream_content || ''
    const info = /^ZPSTR_/.test(raw.trim()) ? '' : streamText(raw, t)
    return [[t('desk.now.station'), tr.container_title || tr.title || ''], [t('desk.now.onNow'), tr.stream_show || ''], [t('desk.now.information'), info]].filter(([, v]) => v)
  }
  const title = tr.title || streamFileName(tr.track_uri) || ''
  return [[t('desk.now.songLabel'), title], [t('desk.now.artist'), tr.artist || ''], [t('desk.now.album'), tr.album || '']].filter(([, v]) => v)
}
const HELD_STATION_SOURCES = ['radio', 'service_radio', 'service_stream', 'service_hls']
// One line naming what plays and one naming who, for cards and the bar.
export function nowSummary(transport, t) {
  const tr = transport || {}
  if (tr.source === 'tv') return { title: t('source.tv'), sub: [tr.tv_input, tvSignalLine(tr, t)].filter(Boolean).join(' · ') }
  if (tr.source === 'line_in') return { title: t('source.line_in'), sub: tr.container_title || '' }
  // A stopped station has no track, only the station it will play: it reads
  // as the station over its service, as on play.sonos.com. It used to read
  // "No Music Selected" here.
  if (!tr.track_uri && tr.media_uri && HELD_STATION_SOURCES.includes(tr.source) && tr.container_title) {
    return { title: tr.container_title, sub: tr.service_name || '' }
  }
  const broadcast = /^x-sonosapi-stream:/.test(tr.media_uri || '')
  if (broadcast) {
    const raw = tr.stream_content || ''
    // The speaker's "Connecting..." is not on air: the official apps never
    // print it on a card or in the bar, and an S2 speaker can go on
    // reporting it long after the station plays (2026-09-28).
    const info = /^ZPSTR_/.test(raw.trim()) ? '' : streamText(raw, t)
    return { title: tr.container_title || tr.title || '', sub: tr.stream_show || info || '' }
  }
  const title = tr.title || streamFileName(tr.track_uri) || (tr.stream_content ? streamText(tr.stream_content, t) : '')
  const sub = [tr.artist, tr.album].filter(Boolean).join(' · ')
  return { title, sub }
}

// --- households ------------------------------------------------------------

export function householdOf(households, uuid) {
  return households.find((h) => h.zone_uuids.includes(uuid)) || null
}
// The room a household's sources browse and play through: the room in view
// when it belongs to that household, otherwise the household's first room.
export function zoneForHousehold(households, zones, activeZone, hid) {
  const household = households.find((h) => h.id === hid)
  if (!household) return null
  if (activeZone && household.zone_uuids.includes(activeZone.uuid)) return activeZone
  for (const uuid of household.zone_uuids) if (zones[uuid]) return zones[uuid]
  return null
}
// Moved to lib/groups.js, where the web themes' copy of it lives too. The
// version here built "<room> + 2" by hand and so could not be translated.
export { groupTitle }

// --- services ---------------------------------------------------------------

// Every household's services, keyed by household id. TuneIn is built into
// every household and needs no account, so it is listed whether or not the
// household saved anything from it.
export function useServices(version = 0) {
  const [byHousehold, setByHousehold] = useState({})
  const [raw, setRaw] = useState(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let canceled = false
    api.services().then((result) => {
      if (canceled) return
      const map = {}
      for (const hh of result.households || []) {
        const list = [...(hh.in_use || [])]
        // Built into an S1 household and needing no account, so it is listed
        // whether or not anything from it has been saved. Not on S2, where
        // Sonos Radio and "TuneIn (New)" replaced it and the app's own source
        // list has no TuneIn row (2026-09-11).
        const tunein = hh.generation === 'S1' ? (hh.available || []).find((svc) => svc.id === 254) : null
        if (tunein && !list.some((svc) => svc.id === 254)) list.push({ ...tunein, in_use: true })
        map[hh.household] = list
      }
      setByHousehold(map); setRaw(result.households || [])
    }).catch(() => { if (!canceled) { setByHousehold({}); setRaw([]) } })
    return () => { canceled = true }
  }, [version, tick])
  return { byHousehold, raw, loaded: raw !== null, reload: () => setTick((v) => v + 1) }
}

// Which households have a music library share; Music Library is listed only
// where there is one.
export function useLibraryPresence(households, version = 0) {
  const [map, setMap] = useState({})
  useEffect(() => {
    let canceled = false
    for (const h of households) {
      const zone = h.zone_uuids?.[0]
      if (!zone) continue
      api.librarySettings(zone).then((r) => {
        if (!canceled) setMap((prev) => ({ ...prev, [h.id]: (r.shares || []).length > 0 }))
      }).catch(() => {})
    }
    return () => { canceled = true }
  }, [households, version])
  return map
}

// The account chosen per "<household>:<service>", kept in this browser.
// Where a Sonos Favorite that is a playlist or album opens. It remembers the
// account it was saved under, which may since have left the system while the
// service stayed: Hamilton was saved under Spotify account 9, and the S1 Mac
// app opens it with the household's Spotify of today (2026-09-23). So the
// account is the favorite's own if it is still there, else the one the
// source list would take. Album or playlist comes from the DIDL's class,
// which says album in any language; the description is the saving app's
// words ("Album by Various Artists").
export function favoriteTarget(accounts, item, chosen) {
  const svc = accounts.find((s) => (s.account_id ?? '') === (item.account || ''))
    || accounts.find((s) => (s.account_id ?? '') === chosen)
    || accounts.find((s) => s.sonora_token || s.sonora_linked)
    || accounts[0]
  const album = /<upnp:class>object\.container\.album/.test(item.metadata || '') || /album/i.test(item.description || '')
  return { svc, account: svc ? (svc.account_id ?? '') : (item.account || ''), kind: album ? 'album' : 'playlist' }
}

export function useAccountChoice() {
  const [choice, setChoice] = useState(() => {
    try { return JSON.parse(readStored(ACCOUNT_CHOICE_KEY, '{}') || '{}') || {} } catch { return {} }
  })
  const pick = useCallback((key, account) => {
    setChoice((prev) => {
      const next = { ...prev, [key]: account }
      writeStored(ACCOUNT_CHOICE_KEY, JSON.stringify(next))
      return next
    })
  }, [])
  return [choice, pick]
}

// The sources of every system in view, one section per household: Sonos
// Favorites, the Music Library where there is one, the services (Sonos Radio
// first, then A-Z), Sonos Playlists, the room's television input, Line-In.
// Whether each system's speakers have a software update waiting (never the
// app's own): read with the page, again whenever the speakers announce a change
// (an update found, or the players running it), and every ten minutes behind
// that. ``clear`` drops a system's row once its update started.
export function useSpeakerUpdates(households) {
  const { updatesEpoch } = useSystem()
  const [updates, setUpdates] = useState({})
  const ids = households.map((h) => h.id).join(',')
  useEffect(() => {
    let canceled = false
    const read = () => {
      for (const h of households) {
        api.softwareUpdate(h.id)
          .then((r) => { if (!canceled) setUpdates((prev) => ({ ...prev, [h.id]: r })) })
          .catch(() => {})
      }
    }
    read()
    const timer = setInterval(read, 600000)
    return () => { canceled = true; clearInterval(timer) }
  }, [ids, updatesEpoch]) // eslint-disable-line react-hooks/exhaustive-deps
  const clear = (hh) => setUpdates((prev) => ({ ...prev, [hh]: { ...prev[hh], pending: false } }))
  return { updates, clear }
}

export function useSources({ households, systemFilter, zones, activeZone, servicesByHh, libraryByHh, accountChoice, roomChosen, updates = {}, t }) {
  return useMemo(() => {
    const visible = orderedHouseholds(households).filter((h) => !systemFilter || systemFilter === 'all' || h.id === systemFilter)
    const showHeaders = visible.length > 1
    const activeHousehold = activeZone ? householdOf(households, activeZone.uuid)?.id ?? null : null
    return visible.map((h) => {
      const hzone = zoneForHousehold(households, zones, activeZone, h.id)
      const rows = []
      // "Update Now" heads the list while the speakers have an update waiting.
      if (updates[h.id]?.pending) rows.push({ id: 'update', title: t('desk.browse.updateNow'), glyph: 'update', version: versionLabel(updates[h.id].display, updates[h.id].version) })
      rows.push({ id: 'FV:2', title: t('desk.browse.favorites'), glyph: 'star', container: true })
      // The television input sits directly under Sonos Favorites and above
      // Music Library, where the app puts it (2026-09-11).
      if (h.id === activeHousehold && activeZone && /arc|beam|ray|playbar|playbase|amp/i.test(activeZone.model || '')) {
        rows.push({ id: 'tv', title: t('common.tv'), glyph: 'tv', playable: true, uri: `x-sonos-htastream:${activeZone.uuid}:spdif` })
      }
      if (libraryByHh[h.id] !== false) rows.push({ id: 'A:', title: t('desk.browse.library'), glyph: 'library', container: true })
      const byService = new Map()
      for (const service of servicesByHh[h.id] || []) {
        const list = byService.get(service.id) || []
        list.push(service)
        byService.set(service.id, list)
      }
      const services = []
      for (const [sid, accounts] of byService) {
        const chosen = accountChoice[`${h.id}:${sid}`]
        const service = accounts.find((a) => (a.account_id ?? '') === chosen) || accounts[0]
        services.push({
          id: `svc:${sid}`, title: service.name, sub: accounts.length > 1 ? service.nickname : '',
          accounts: accounts.length > 1 ? accounts : null, icon: service.icon, glyph: sid === 254 ? 'tunein' : 'note',
          container: true, service: sid, caution: serviceCaution(service), gen: h.generation,
          initials: service.initials, account: service.account_id ?? '', capabilities: service.capabilities ?? 0,
        })
      }
      services.sort((a, b) => ((a.service === SONOS_RADIO ? 0 : 1) - (b.service === SONOS_RADIO ? 0 : 1))
        || a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
      rows.push(...services)
      rows.push({ id: 'SQ:', title: t('desk.browse.playlists'), glyph: 'playlist', container: true })
      // Only where a player could take a cable at all.
      if ((h.zone_uuids || []).some((uuid) => zones[uuid]?.supports_line_in)) {
        rows.push({ id: 'linein', title: t('desk.browse.lineIn'), glyph: 'linein', container: true })
      }
      for (const row of rows) { row.hzone = hzone?.uuid || null; row.hh = h.id; row.gen = h.generation }
      // With both systems in view, the sources of the system the chosen room
      // is not in are dimmed and inert, as the Windows theme has them: an S1
      // room cannot play an S2 system's services, nor the other way round.
      // With no room chosen every row stays live.
      const otherSystem = showHeaders && roomChosen && activeHousehold && h.id !== activeHousehold
      if (otherSystem) for (const row of rows) row.disabled = true
      return { household: h, header: showHeaders ? h.generation : '', rows, otherSystem, hzone: hzone?.uuid || null }
    })
  }, [households, systemFilter, zones, activeZone, servicesByHh, libraryByHh, accountChoice, roomChosen, updates, t])
}

// What the search box may search: the household's own music library where it
// has one, then every account of every service on the systems in view whose
// capabilities carry the search bit. Both desktop apps lead with the library
// (lib/librarySearch.js).
export function searchScopesOf({ households, systemFilter, zones, activeZone, servicesByHh, libraryByHh = {}, t = null }) {
  const list = []
  for (const h of orderedHouseholds(households)) {
    if (systemFilter && systemFilter !== 'all' && h.id !== systemFilter) continue
    const hzone = zoneForHousehold(households, zones, activeZone, h.id)
    if (t && libraryByHh[h.id] !== false) list.push(libraryScope(h, hzone?.uuid, t))
    // One entry per service, for the account this browser uses with it, as
    // both S1 apps list a service once, named for their chosen account
    // (2026-10-02): the service row's caret, else the account Sonora holds a
    // login for, else the first (lib/itemAccount.js).
    const all = (servicesByHh[h.id] || []).filter((svc) => ((svc.capabilities ?? 0) & 1) === 1)
    const searchable = all
      .filter((svc) => {
        const same = all.filter((other) => other.id === svc.id)
        if (same.length < 2) return true
        const pick = itemAccount('-', same, svc.id)
        return same.find((o) => String(o.account_id ?? '') === pick) === svc
      })
      .sort((a, b) => (a.id === SONOS_RADIO ? 0 : 1) - (b.id === SONOS_RADIO ? 0 : 1) || (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }))
    for (const svc of searchable) {
      list.push({ key: `${h.id}:${svc.id}:${svc.account_id ?? ''}`, id: svc.id, name: svc.name, nickname: svc.nickname || '',
                  accounts: all.filter((other) => other.id === svc.id).length,
                  icon: svc.icon, account: svc.account_id ?? '', hh: h.id, hzone: hzone?.uuid || null, gen: h.generation })
    }
  }
  return list
}

// --- lists -------------------------------------------------------------------

export function useFavorites(zoneUuid, epoch = 0) {
  const [items, setItems] = useState(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!zoneUuid) { setItems([]); return undefined }
    let canceled = false
    api.favorites(zoneUuid).then((r) => { if (!canceled) setItems(r?.items || []) }).catch(() => { if (!canceled) setItems([]) })
    return () => { canceled = true }
  }, [zoneUuid, epoch, tick])
  return { items: items || [], loaded: items !== null, reload: () => setTick((v) => v + 1) }
}
// What this room played lately, newest first. The speakers keep the list, so
// it follows the room rather than the browser, and a container's art is the
// reporting player's own /getaa path and has to be made absolute against it.
export function useRecent(zoneUuid, epoch = 0) {
  const [items, setItems] = useState(null)
  useEffect(() => {
    if (!zoneUuid) { setItems([]); return undefined }
    let canceled = false
    api.recent(zoneUuid)
      .then((r) => {
        if (canceled) return
        setItems((r?.items || []).map((item) => ({
          ...item, art: item.art ? cachedArt(artUrl(item.host, item.art)) : '',
        })))
      })
      .catch(() => { if (!canceled) setItems([]) })
    return () => { canceled = true }
  }, [zoneUuid, epoch])
  return { items: items || [], loaded: items !== null }
}
export function usePlaylists(zoneUuid, epoch = 0) {
  const [items, setItems] = useState(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!zoneUuid) { setItems([]); return undefined }
    let canceled = false
    api.playlists(zoneUuid).then((r) => { if (!canceled) setItems(r?.items || []) }).catch(() => { if (!canceled) setItems([]) })
    return () => { canceled = true }
  }, [zoneUuid, epoch, tick])
  return { items: items || [], loaded: items !== null, reload: () => setTick((v) => v + 1) }
}
// The queue of a room, re-read when the speaker says its length or track
// changed, or when asked. lib/useQueue.js reads one page; the backend gives
// at most 500 rows a page, and a queue can run to more than that, so the
// deck reads it the same way at the same moments but page after page until
// it has the whole of it (up to a bound, past which it says how many more).
export { useQueue }
const PAGE = 500
const MOST = 5000
export function useWholeQueue(zone) {
  const { queueEpochs } = useSystem()
  const [state, setState] = useState({ items: [], total: 0, loading: Boolean(zone) })
  const [tick, setTick] = useState(0)
  const uuid = zone?.uuid
  const transport = zone?.transport || {}
  const stamp = `${uuid}|${transport.queue_length}|${transport.track_uri}`
  const epoch = queueEpochs[uuid] || 0
  useEffect(() => {
    if (!uuid) { setState({ items: [], total: 0, loading: false }); return undefined }
    let canceled = false
    setState((prev) => ({ ...prev, loading: true }))
    const read = async () => {
      let items = []
      let total = 0
      try {
        for (let start = 0; start < MOST; start += PAGE) {
          const page = await api.queue(uuid, { start, count: PAGE })
          if (canceled) return
          total = page.total || 0
          items = items.concat(page.items || [])
          // The first page is drawn at once; the rest arrive behind it.
          setState({ items, total, loading: false })
          if (!page.has_more || !(page.items || []).length || items.length >= total) break
        }
      } catch {
        if (!canceled) setState({ items, total, loading: false })
      }
    }
    read()
    return () => { canceled = true }
  }, [stamp, uuid, tick, epoch])
  const reload = useCallback(() => setTick((v) => v + 1), [])
  return { ...state, reload }
}

// The service's own metadata for what a room plays: the rating buttons it
// declares, the author and narrator of a chapter, the show of an episode.
// Re-read every ten seconds while an item with rating buttons plays, so a
// rating made in another controller shows here.
export function useProviderMetadata(zone) {
  const [provider, setProvider] = useState(null)
  const [epoch, setEpoch] = useState(0)
  const tr = zone?.transport || {}
  const key = `${zone?.uuid || ''}|${tr.track_uri || ''}`
  useEffect(() => { setProvider(null); setEpoch(0) }, [key])
  useEffect(() => {
    if (!zone?.uuid || !tr.service_id || !tr.track_uri) { setProvider(null); return undefined }
    let canceled = false
    api.itemMetadata(zone.uuid).then((r) => { if (!canceled) setProvider(r || null) }).catch(() => {})
    return () => { canceled = true }
  }, [key, epoch]) // eslint-disable-line react-hooks/exhaustive-deps
  const hasRatings = Boolean(provider?.ratings?.length)
  useEffect(() => {
    if (!hasRatings || tr.state !== 'PLAYING') return undefined
    const timer = setInterval(() => setEpoch((v) => v + 1), 10000)
    return () => clearInterval(timer)
  }, [hasRatings, tr.state, key])
  return { provider, refresh: () => setEpoch((v) => v + 1) }
}

// A page of a source: the speakers' own containers (favorites, playlists,
// the library, saved radio) or a service's, browsed through the household's
// room. A service that needs an account comes back `needsLink`.
export function useBrowsePage(node, account, version = 0) {
  const [state, setState] = useState({ items: [], displayTypes: {}, loading: false, error: '', needsLink: false })
  const [tick, setTick] = useState(0)
  const last = useRef(null)
  useEffect(() => {
    if (!node || node.root || !node.hzone || node.virtual) { setState({ items: [], loading: false, error: '', needsLink: false }); return undefined }
    // A shelf opened from a service's home carries its rows with it: they came
    // inline with the home, and the service need not answer for the shelf's
    // own id (TuneIn's do not). The rows in hand are the page.
    if (node.preset) { last.current = node; setState({ items: node.preset, displayTypes: {}, loading: false, error: '', needsLink: false }); return undefined }
    let canceled = false
    const fresh = last.current !== node
    last.current = node
    if (fresh) setState({ items: [], loading: true, error: '', needsLink: false })
    const fetcher = node.service
      ? api.browseService(node.service, { zone: node.hzone, item: node.item ?? 'root', count: 200, account: account || '' })
      : api.browse(node.id, { zone: node.hzone, count: 200 })
    fetcher.then((result) => {
      if (canceled) return
      const err = result.error
      setState({ items: result.items || [], displayTypes: result.display_types || {}, loading: false,
                 needsLink: Boolean(err?.needs_auth && node.service),
                 error: err && !(err.needs_auth && node.service) ? (err.message || '') : '' })
    }).catch((exc) => { if (!canceled) setState({ items: [], loading: false, error: exc?.message || 'Error', needsLink: false }) })
    return () => { canceled = true }
  }, [node, account, version, tick])
  return { ...state, reload: () => setTick((v) => v + 1) }
}

// --- playing -----------------------------------------------------------------

// Play, queue or replace with one or more items, the way the app does it:
// Play Now on something queueable drops it after the current track and jumps
// to it; a station or an audiobook takes over the transport; Play Next and
// Add to End queue in order.
export async function playItems(actions, items, how, { hzone, service = null, from = '' } = {}) {
  const group = items.filter((i) => i && i.uri)
  if (!group.length || !hzone) return false
  // `from` is the room the listing was browsed through, which only the
  // browser room needs: it is how the backend knows whose service login
  // resolves the URI.
  const body = (i) => (from ? { ...bodyFor(i, service), from_zone: from } : bodyFor(i, service))
  // The first call is the one that says whether this worked: a refusal there
  // -- a speaker's, or the browser room's for a source it cannot fetch --
  // means nothing started, so the caller must not report that it did.
  if (how === 'now' && group.every(isQueueable)) {
    if (!await actions.setSource(hzone, body(group[0]))) return false
    for (const i of group.slice(1).reverse()) await actions.setSource(hzone, { ...body(i), enqueue: true, next: true })
  } else if (how === 'now' || how === 'replace') {
    if (!await actions.setSource(hzone, { ...body(group[0]), ...(how === 'replace' ? { replace: true } : {}) })) return false
    for (const i of group.slice(1)) await actions.setSource(hzone, { ...body(i), enqueue: true })
  } else if (how === 'next') {
    for (const i of [...group].reverse()) if (!await actions.setSource(hzone, { ...body(i), enqueue: true, next: true })) return false
  } else {
    for (const i of group) if (!await actions.setSource(hzone, { ...body(i), enqueue: true })) return false
  }
  return true
}

// The service a row belongs to, by the sid in its URI, named as the app names
// it: "Spotify (alexsounds)" when the account matters.
export function serviceLabelFor(item, services) {
  const sid = Number((/[?&]sid=(\d+)/.exec(item?.uri || '') || [])[1])
  if (!sid || !services) return ''
  const svc = services.find((s) => s.id === sid)
  if (!svc) return ''
  return svc.nickname && svc.nickname !== svc.name ? `${svc.name} (${svc.nickname})` : svc.name
}

export { isPlayableLeaf }
