import { searchLibrary } from '../../frontend/src/lib/librarySearch.js'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { api } from '../../frontend/src/lib/api.js'
import { stationKey } from '../../frontend/src/lib/myRadio.js'
import { isPlayableLeaf } from '../../frontend/src/lib/items.js'
import { groupName } from '../../frontend/src/lib/format.js'
import Art from '../../frontend/src/components/Art.jsx'
import { CautionBadge } from '../../frontend/src/components/CautionBadge.jsx'
import * as G from './glyphs.jsx'
import LevelDeck from './LevelDeck.jsx'
import { IconKey, Button, Menu, MenuItem, MenuSep, Confirm, Empty, Loading, Panel, PanelHead, Chip, SlideSwitch, Unit, Display, Led, Key } from './controls.jsx'
import { playTarget } from '../../frontend/src/lib/browserRoom.js'
import { readLibraryPrefs, libraryRows } from '../../frontend/src/lib/libraryPrefs.js'
import { useBrowsePage, useSources, searchScopesOf, playItems, isQueueable, genericArt, describeFavorite, serviceLabelFor,
         TUNEIN_ICONS, readStored, writeStored, VIEW_KEY, householdOf, useSpeakerUpdates, favoriteTarget, favoriteKey } from './house.js'
import { updateBody } from '../../frontend/src/lib/version.js'

// The source tuner: every source of music the systems hold, as a bank of lit
// selector keys down the left, and what the chosen one holds on the screen
// beside it -- sleeves where the rows have covers, a list where they are
// tracks. Across the top runs the preset dial, the system's Sonos Favorites
// printed along a glass scale with a needle over whichever one is on. One
// search line searches whichever service is in scope, category by category.
// A row's actions come from a press on it, its dots, or a right click.

const ROOT = { root: true, title: '' }
const GLYPHS = { star: G.Star, library: G.Library, playlist: G.Playlist, tv: G.Tv, linein: G.LineIn, note: G.Note, tunein: G.Radio, plus: G.Plus, update: G.Update }

function categoryLabel(cat, t) {
  // A service's own category keeps its own name (Mixcloud's Shows).
  if (cat.custom && cat.title) return cat.title
  const key = `search.category.${(cat.id || '').toLowerCase()}`
  const label = t(key)
  return label && label !== key ? label : (cat.title || cat.id || '')
}

export default function TunerUnit({ households, zones, groups, roomGroups, onSelectRoom, systemFilter, activeZone, roomChosen, servicesByHh, servicesRaw, libraryByHh,
                                    accountChoice, pickAccount, request, onMessage, onInfo, onLinkService, onAddRadio, favoritesEpoch,
                                    onFavoritesChanged, servicesVersion, queueEdited, onQueueReplaced, onScopeChange,
                                    favorites = null, recent = null, onPlayItem = null, onItemMenu = null }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const [stack, setStack] = useState([ROOT])
  const node = stack[stack.length - 1]
  const [view, setView] = useState(() => readStored(VIEW_KEY, 'auto'))
  const [menu, setMenu] = useState(null)
  const [accountMenu, setAccountMenu] = useState(null)
  const [checked, setChecked] = useState(() => new Set())
  const [naming, setNaming] = useState(null)
  const [addTo, setAddTo] = useState(null)
  const [replaceAsk, setReplaceAsk] = useState(null)
  const [refresh, setRefresh] = useState(0)
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [roomMenu, setRoomMenu] = useState(null)
  // A system whose rooms cannot be reached from here folds away, as it does
  // in the desktop themes' source list.
  // They start folded, as in the Windows theme, and one opened by hand
  // stays open while it stays the other system.
  const [openedOther, setOpenOther] = useState(() => new Set())
  const openOther = { has: (id) => openedOther.has(id) }
  const toggleOther = (id) => setOpenOther((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const scroller = useRef(null)
  // A new page starts at its top. On a phone the page scrolls in the bay
  // rather than in its own box, so the bay goes back to its top too.
  useEffect(() => {
    setChecked(new Set()); setMenu(null)
    if (scroller.current) scroller.current.scrollTop = 0
    const bay = scroller.current?.closest?.('.hf-bay')
    if (bay) bay.scrollTop = 0
  }, [node])
  useEffect(() => { writeStored(VIEW_KEY, view) }, [view])
  useEffect(() => {
    if (!sourcesOpen) return undefined
    const key = (event) => { if (event.key === 'Escape') setSourcesOpen(false) }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [sourcesOpen])

  const speakerUpdates = useSpeakerUpdates(households)
  const [updateAsk, setUpdateAsk] = useState(null)
  const sections = useSources({ households, systemFilter, zones, activeZone, servicesByHh, libraryByHh, accountChoice, roomChosen, updates: speakerUpdates.updates, t })
  const activeHousehold = activeZone ? householdOf(households, activeZone.uuid)?.id ?? null : null
  // "All services" heads the list, as the Sonos web app's search does, and
  // asks every service in view at once. With a room chosen, only its own
  // system's services are offered, since only they can play there, and the
  // head of the list says which system.
  const activeGen = activeHousehold ? households.find((h) => h.id === activeHousehold)?.generation || '' : ''
  const allLabel = activeGen ? t('hifi.allServicesGen', { gen: activeGen }) : t('hifi.allServices')
  const scopes = useMemo(() => {
    const every = searchScopesOf({ households, systemFilter, zones, activeZone, servicesByHh, libraryByHh, t })
    const list = activeHousehold ? every.filter((s) => s.hh === activeHousehold) : every
    const services = list.filter((s) => !s.library)
    return services.length > 1 ? [{ key: 'all', all: true, name: allLabel, icon: '' }, ...list] : list
  }, [households, systemFilter, zones, activeZone, activeHousehold, servicesByHh, libraryByHh, allLabel, t])

  // The live row for the service being browsed says what is true now: the
  // account in use and whether it is linked.
  const sameService = node.service != null ? (servicesByHh[node.hh] || []).filter((s) => s.id === node.service) : []
  const liveRow = sameService.find((s) => (s.account_id ?? '') === (node.account ?? '')) ?? (!node.account && sameService.length === 1 ? sameService[0] : null)
  const liveAccount = liveRow?.account_id ?? node.account ?? ''
  const caution = liveRow ? (liveRow.on_system === false ? 'sonora' : null) : node.caution
  const presets = useRef([])
  const everLocal = useRef(false)
  const page = useBrowsePage(node, liveAccount, servicesVersion + refresh + (node.id === 'FV:2' ? favoritesEpoch : 0))
  useEffect(() => {
    if (node.service == null) return
    const list = servicesByHh[node.hh]
    if (!list || list.some((s) => s.id === node.service)) return
    setStack([ROOT])
  }, [node, servicesByHh])

  // --- search ------------------------------------------------------------
  const [term, setTerm] = useState('')
  const [scope, setScope] = useState(null)
  const [pickedCategory, setPickedCategory] = useState('')
  const [search, setSearch] = useState({ term: '', available: [], category: '', categories: [], loading: false, error: '' })
  const [scopeMenu, setScopeMenu] = useState(null)
  const searchRef = useRef(null)
  useEffect(() => {
    if (scopes.length && (!scope || !scopes.some((s) => s.key === scope.key))) setScope(scopes[0])
  }, [scopes]) // eslint-disable-line react-hooks/exhaustive-deps
  // The scope follows the service the room plays and the service being
  // browsed, whichever changed last.
  const playingSid = activeZone?.transport?.service_id ?? null
  useEffect(() => {
    if (!playingSid) return
    const match = scopes.find((s) => s.id === playingSid && s.hh === activeHousehold) || scopes.find((s) => s.id === playingSid)
    if (match) setScope(match)
  }, [playingSid, activeZone?.uuid]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!node.service) return
    const match = scopes.find((s) => s.id === node.service && String(s.account) === String(node.account ?? '') && s.hh === node.hh) || scopes.find((s) => s.id === node.service)
    if (match) setScope(match)
  }, [node.service, node.account]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { onScopeChange?.(scope, scopes) }, [scope, scopes]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPickedCategory('') }, [scope?.key])
  useEffect(() => {
    const q = term.trim()
    if (!scope || !q) { setSearch({ term: '', available: [], category: '', categories: [], loading: false, error: '' }); return undefined }
    let canceled = false
    setSearch((prev) => ({ ...prev, loading: true, error: '' }))
    const timer = setTimeout(() => {
      if (scope.all) {
        const targets = scopes.filter((s) => !s.all && !s.library)
        setSearch({ term: q, available: [], category: '', categories: [], sections: [], order: targets.map((x) => x.key), loading: true, error: '' })
        let waiting = targets.length
        for (const target of targets) {
          api.searchService(target.id, { zone: target.hzone, term: q, account: target.account, count: 6 })
            .then((result) => {
              if (canceled) return
              const items = interleaveCategories(result.categories || [])
              setSearch((prev) => ({ ...prev, sections: [...(prev.sections || []), {
                scope: target, items, displayTypes: result.display_types || {},
                error: result.error ? result.error.message : '' }] }))
            })
            .catch((exc) => {
              if (!canceled) setSearch((prev) => ({ ...prev, sections: [...(prev.sections || []), { scope: target, items: [], error: exc?.message || '' }] }))
            })
            .finally(() => { waiting -= 1; if (!canceled && waiting <= 0) setSearch((prev) => ({ ...prev, loading: false })) })
        }
        if (!targets.length) setSearch((prev) => ({ ...prev, loading: false }))
        return
      }
      // The library is browsed rather than asked as a provider would be.
      if (scope.library) {
        searchLibrary({ zone: scope.hzone, term: q, picked: pickedCategory, count: 30, t })
          .then((result) => { if (!canceled) setSearch({ term: q, loading: false, error: '', ...result }) })
          .catch((exc) => { if (!canceled) setSearch({ term: q, available: [], category: '', categories: [], loading: false, error: exc?.message || '' }) })
        return
      }
      api.searchService(scope.id, { zone: scope.hzone, term: q, account: scope.account, category: pickedCategory, count: 30 })
        .then((result) => {
          if (canceled) return
          const available = result.available || []
          setSearch({ term: q, available, loading: false, category: pickedCategory || available[0]?.id || '',
                      categories: result.categories || [],
                      // Results read their lines from the service's own map,
                      // the same one a browse page uses.
                      displayTypes: result.display_types || {},
                      error: result.error ? result.error.message : '' })
        })
        .catch((exc) => { if (!canceled) setSearch({ term: q, available: [], category: '', categories: [], loading: false, error: exc?.message || '' }) })
    }, 450)
    return () => { canceled = true; clearTimeout(timer) }
  }, [term, scope, pickedCategory]) // eslint-disable-line react-hooks/exhaustive-deps
  const searching = Boolean(scope && term.trim())

  // --- requests from the shell ---------------------------------------------
  useEffect(() => {
    if (!request) return
    if (request.kind === 'home') { setStack([ROOT]); setTerm('') }
    else if (request.kind === 'search') { if (request.scope) setScope(request.scope); setTerm(request.term || ''); setTimeout(() => searchRef.current?.focus(), 0) }
    else if (request.kind === 'focus') { setTimeout(() => { searchRef.current?.focus(); searchRef.current?.select() }, 0) }
    else if (request.kind === 'node') { setTerm(''); setStack([ROOT, ...(request.path || []), request.node]) }
    else if (request.kind === 'source') {
      setTerm('')
      const row = sections.flatMap((s) => s.rows).find((r) => r.id === request.id)
      if (row) openRoot(row, true)
    }
  }, [request?.n]) // eslint-disable-line react-hooks/exhaustive-deps

  // --- opening --------------------------------------------------------------
  const push = (next) => setStack((prev) => [...prev, next])
  const openRoot = (item, force = false, event = null) => {
    if (item.disabled && !force) return
    if (item.id === 'update') { setSourcesOpen(false); setUpdateAsk({ hh: item.hh, version: item.version }); return }
    if (!item.hzone) return
    setSourcesOpen(false)
    // A root row that plays rather than opens -- the television input. Its menu
    // hangs off whatever was used to summon it: the caret, or the pointer on a
    // right-click.
    if (item.playable) {
      event?.preventDefault?.()
      event?.stopPropagation?.()
      const anchor = event && event.type !== 'contextmenu' ? event.currentTarget : null
      setMenu({ item: { ...item, root: true }, anchor,
                x: event?.clientX ?? window.innerWidth / 2, y: event?.clientY ?? window.innerHeight / 2 })
      return
    }
    if (item.id === 'linein') { push({ id: 'linein', virtual: 'lineIn', title: item.title, glyph: 'linein', hzone: item.hzone, hh: item.hh }); return }
    const title = item.sub && item.sub !== item.title ? `${item.title} (${item.sub})` : item.title
    setStack([ROOT, { id: item.id, title, service: item.service, item: 'root', hzone: item.hzone, hh: item.hh, caution: item.caution, gen: item.gen,
                      glyph: item.glyph, icon: item.icon, initials: item.initials, account: item.account, serviceName: item.title }])
  }
  const browseInto = (item, extra = {}) => push({
    id: item.id, title: item.title, service: node.service, item: item.id, hzone: node.hzone, hh: node.hh, account: node.account,
    icon: node.icon, glyph: node.glyph, kind: item.item_type || (node.id === 'SQ:' ? 'playlist' : undefined), displayType: item.display_type || '', uri: item.uri, metadata: item.metadata || '',
    art: item.art, artist: item.artist, serviceName: node.serviceName, pickCity: node.pickCity, ...extra })
  const open = (item, event) => {
    if (node.root) { openRoot(item, false, event); return }
    if (!node.hzone || item.available === false) return
    if (node.id === 'FV:2' && item.browse_id && item.service_id) {
      const { svc, account, kind } = favoriteTarget((servicesByHh[node.hh] || []).filter((s) => s.id === item.service_id), item,
                                                    accountChoice[`${node.hh}:${item.service_id}`])
      push({ id: `${item.service_id}:${item.browse_id}`, title: item.title, service: item.service_id, item: item.browse_id, hzone: node.hzone, hh: node.hh,
             account, icon: svc?.icon || '', kind,
             uri: item.uri, metadata: item.metadata, art: item.art, serviceName: svc?.name || '' })
      return
    }
    if (isPlayableLeaf(item) || (node.id === 'FV:2' && item.uri)) { openMenu(item, event); return }
    if (node.pickCity && peek[item.id] === 'final') { chooseCity(item); return }
    // A container that enumerates to nothing still opens, onto an empty
    // pane; the app does not follow the openUrl such a row can carry.
    if (item.is_container) browseInto(item)
  }
  // Picking a city.
  const [locationEpoch, setLocationEpoch] = useState(0)
  const [radioLocation, setRadioLocation] = useState({ node: '', city: '' })
  useEffect(() => {
    const hzone = sections[0]?.hzone || ''
    if (!hzone) return undefined
    let canceled = false
    api.radioLocation(hzone).then((r) => { if (!canceled) setRadioLocation(r || { node: '', city: '' }) }).catch(() => {})
    return () => { canceled = true }
  }, [sections[0]?.household?.id, locationEpoch]) // eslint-disable-line react-hooks/exhaustive-deps
  // Each row of the location tree is looked at one level down, as the S1
  // app does (2026-09-23): more places under it and it opens; stations under
  // it and it is a place to live, drawn without a chevron and chosen on a
  // click; nothing under it and it is not shown.
  const [peek, setPeek] = useState({})
  useEffect(() => {
    if (!node.pickCity || page.loading || !page.items.length) return undefined
    let canceled = false
    page.items.filter((entry) => entry.is_container && !(entry.id in peek)).forEach((entry) => {
      api.browseService(node.service, { zone: node.hzone, item: entry.id, count: 1, account: node.account })
        .then((data) => {
          if (canceled) return
          const first = (data.items ?? [])[0]
          setPeek((prev) => ({ ...prev, [entry.id]: !first ? 'empty' : first.is_container ? 'place' : 'final' }))
        })
        .catch(() => { if (!canceled) setPeek((prev) => ({ ...prev, [entry.id]: 'place' })) })
    })
    return () => { canceled = true }
  }, [node.pickCity, node.item, page.loading, page.items]) // eslint-disable-line react-hooks/exhaustive-deps
  const chooseCity = async (item) => {
    const done = await actions.setRadioLocation(node.hzone, item.id, item.title)
    setLocationEpoch((v) => v + 1)
    onMessage?.(t('desk.radio.locationSet', { city: done?.city || item.title }))
    const home = stack.findIndex((entry) => entry.service === node.service && entry.item === 'root')
    setStack(home >= 0 ? stack.slice(0, home + 1) : stack.slice(0, 1))
  }

  // --- acting ---------------------------------------------------------------
  // The menu opens where it was asked for: under the "..." key, its right
  // edge on the key's, when that key was pressed; at the pointer for a
  // right-click or a press on the row itself. It was anchored to the whole
  // row, so pressing "..." at a row's right end opened it under the row's
  // far left. A row reached from the keyboard has no
  // pointer, so it opens under the row.
  const openMenu = (item, event, extra = {}) => {
    event?.stopPropagation?.()
    const target = event?.currentTarget
    const row = target?.closest?.('[data-item]') || null
    const onKey = Boolean(target?.matches?.('button') && target !== row) && event?.type !== 'contextmenu'
    const pointed = Boolean(event?.clientX || event?.clientY)
    setMenu({ item: { ...item, ...extra }, x: event?.clientX, y: event?.clientY,
              anchor: onKey ? target : pointed ? null : row, align: onKey ? 'right' : 'left' })
  }
  const serviceOf = (item) => item.service ?? node.service ?? scope?.id ?? null
  // The household's favorites, read with the page, so a row's menu can say
  // Remove for one that already is a favorite, as the app's does (Pandora's
  // "Cocktail Jazz Radio", 2026-09-23).
  const [menuFavorites, setMenuFavorites] = useState({ hzone: '', items: [] })
  const [menuFavoritesVersion, setMenuFavoritesVersion] = useState(0)
  const menuZone = menu?.item?.hzone || node.hzone || scope?.hzone || ''
  useEffect(() => {
    if (!menuZone) return undefined
    let canceled = false
    api.favorites(menuZone).then((r) => { if (!canceled) setMenuFavorites({ hzone: menuZone, items: r?.items || [] }) }).catch(() => {})
    return () => { canceled = true }
  }, [menuZone, menuFavoritesVersion])
  const savedFavorite = (() => {
    const it = menu?.item
    if (!it || it.favorite || it.root || node.id === 'FV:2' || menuFavorites.hzone !== menuZone) return null
    const key = stationKey(it.uri || it.favorite_uri || '')
    return key ? menuFavorites.items.find((f) => stationKey(f.uri) === key) || null : null
  })()
  const act = async (item, how) => {
    const saved = savedFavorite
    setMenu(null)
    const hzone = item.hzone || node.hzone || scope?.hzone
    if (!hzone) return
    if (how === 'unfavorite' && saved) {
      const done = await actions.removeFavorite(hzone, saved.id)
      if (done) { onMessage?.(t('desk.info.removedFavorite', { title: saved.title || item.title })); onFavoritesChanged?.() }
      setMenuFavoritesVersion((v) => v + 1)
      return
    }
    const service = serviceOf(item)
    const serviceName = (servicesByHh[item.hh || node.hh] || []).find((svc) => svc.id === service)?.name || node.serviceName || scope?.name || ''
    const group = checked.has(item.id) ? page.items.filter((i) => checked.has(i.id) && (i.uri || i.favorite_uri)) : [item]
    if (how === 'favorite') {
      const result = await actions.addFavoriteItem(hzone, { uri: item.uri || item.favorite_uri || '', metadata: item.metadata || item.favorite_metadata || '',
                                                            title: item.title, art: item.art || '', description: describeFavorite(item, serviceName) })
      if (result) { onMessage?.(t(result.exists ? 'desk.info.alreadyFavorite' : 'desk.info.addedFavorite', { title: item.title })); onFavoritesChanged?.() }
      setMenuFavoritesVersion((v) => v + 1)
      return
    }
    if (how === 'info') { onInfo?.({ ...item, serviceName, favoriteDescription: describeFavorite(item, serviceName) }, { hzone, serviceName, source: node.id }); return }
    if (how === 'rename') { setNaming({ kind: 'favorite', item }); return }
    if (how === 'remove') {
      const done = await actions.removeFavorite(hzone, item.id)
      if (done) { setRefresh((v) => v + 1); onFavoritesChanged?.(); onMessage?.(t('desk.favorites.removed', { title: item.title })) }
      return
    }
    if (how === 'removeFromPlaylist') {
      const done = await actions.removePlaylistTrack(hzone, item.inPlaylist, item.position)
      if (done) { setRefresh((v) => v + 1); onMessage?.(t('desk.playlists.removedSong', { title: item.title })) }
      return
    }
    if (how === 'unselect') { setChecked(new Set()); return }
    if (how === 'addToPlaylist') {
      const asPick = (i) => (i.uri ? i : { ...i, uri: i.favorite_uri || '', metadata: i.favorite_metadata || '' })
      setAddTo({ picks: group.map(asPick), source: node.id, hzone })
      return
    }
    if (how === 'renamePlaylist') { setNaming({ kind: 'playlist', item }); return }
    if (how === 'deletePlaylist') {
      const done = await actions.removePlaylist(hzone, item.id)
      if (done) { setRefresh((v) => v + 1); onMessage?.(t('desk.playlists.deleted', { title: item.title })) }
      return
    }
    // Content from the other system cannot play in the room in view: its
    // speakers would not know the account. Say which system it is on rather
    // than start it in some room of that system nobody chose.
    const itemHousehold = householdOf(households, hzone)?.id
    if (!activeZone?.local && activeHousehold && itemHousehold && itemHousehold !== activeHousehold) {
      onMessage?.(t('hifi.playOtherSystem', { gen: households.find((h) => h.id === itemHousehold)?.generation || '' }))
      return
    }
    if (how === 'now' || how === 'replace') onQueueReplaced?.()
    // Browsing goes through a speaker; playing goes to the selected room,
    // which may be this browser.
    const done = await playItems(actions, group.filter((i) => i.uri), how,
                                 { hzone: playTarget(activeZone, hzone), service,
                                   from: activeZone?.local ? hzone : '' })
    if (done) {
      setChecked(new Set())
      onMessage?.(t(how === 'now' ? 'hifi.playingNow' : how === 'next' ? 'hifi.queuedNext' : how === 'replace' ? 'hifi.replacedQueue' : 'hifi.addedToQueue', { title: group.length > 1 ? t.plural('common.items', group.length) : group[0].title }))
    }
  }
  const playAlbum = async (shuffle, force = false) => {
    if (!node.hzone || !node.uri) return
    if (queueEdited && !force) { setReplaceAsk({ shuffle }); return }
    onQueueReplaced?.()
    const mode = activeZone?.transport?.play_mode || 'NORMAL'
    const repeatOn = /REPEAT/.test(mode) && mode !== 'SHUFFLE_NOREPEAT'
    // A browser has no queue to order, so it has no play mode to set either.
    if (!activeZone?.local) {
      if (shuffle) await actions.setPlayMode(node.hzone, repeatOn ? 'SHUFFLE' : 'SHUFFLE_NOREPEAT')
      else if (/SHUFFLE/.test(mode)) await actions.setPlayMode(node.hzone, repeatOn ? 'REPEAT_ALL' : 'NORMAL')
    }
    await actions.setSource(playTarget(activeZone, node.hzone),
                            { uri: node.uri, metadata: node.metadata || '', service: node.service,
                              ...(activeZone?.local ? { from_zone: node.hzone } : {}), replace: true })
  }
  const albumItem = () => ({ id: `${node.id}#album`, title: node.title, uri: node.uri, metadata: node.metadata || '', art: node.art, artist: node.artist,
                             is_container: true, item_type: node.kind, hzone: node.hzone, service: node.service })
  const toggleCheck = (id) => setChecked((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })

  // --- what to show -----------------------------------------------------------
  // The Music Library's root as the app names and orders it, and a folder in
  // the preferred order; both are controller preferences (lib/libraryPrefs.js).
  const [libraryPrefs, setLibraryPrefs] = useState(readLibraryPrefs)
  useEffect(() => {
    const onPrefs = (event) => setLibraryPrefs(event.detail || readLibraryPrefs())
    window.addEventListener('sonora:libraryprefs', onPrefs)
    return () => window.removeEventListener('sonora:libraryprefs', onPrefs)
  }, [])
  const items = libraryRows(node.id, page.items, libraryPrefs, t)
    .filter((item) => !(node.pickCity && peek[item.id] === 'empty'))
  const isCollection = (node.kind === 'album' || node.kind === 'playlist') && !page.loading && !page.error && items.length > 0
  const autoGrid = !isCollection && items.length > 0 && items.filter((i) => i.is_container && !isPlayableLeaf(i)).length >= Math.ceil(items.length * 0.6)
    && items.filter((i) => i.art).length >= Math.ceil(items.length * 0.5)
  const grid = view === 'grid' ? !isCollection : view === 'list' ? false : autoGrid
  // A service's home that arrives as shelves -- Sonos Radio's Trending Now
  // and Sonos Presents, each carrying its first stations, Spotify's and
  // TuneIn's the same way -- is drawn as the Sonos Web theme draws it: each
  // shelf a line of tiles under its name with View All at its right, rather
  // than a row to open before anything shows. Only in
  // the automatic view; Grid and List still mean what they say.
  const shelves = view === 'auto' && !isCollection ? items.filter((item) => (item.children || []).length > 0) : []
  const loose = shelves.length ? items.filter((item) => !(item.children || []).length) : items
  const addHouseholdId = (() => {
    const visible = sections.map((sec) => sec.household.id)
    if (activeHousehold && visible.includes(activeHousehold)) return activeHousehold
    return visible[0] || null
  })()
  const crumbs = stack.slice(1)
  // The library opens on its tiles alone; choosing one slides the source
  // list in beside the rows.
  const atRoot = node.root && !searching
  const roomOptions = roomGroups || []
  const activeRoomName = activeZone
    ? groupName(roomOptions.find((g) => g.coordinator === activeZone.uuid) || { members: [activeZone.uuid], name: activeZone.name }, zones)
    : ''
  // Delete and Backspace remove a Sonos Favorite, a Sonos Playlist or a
  // track in one, as the S1 apps' lists do (the menu's own Remove).
  const removal = node.id === 'FV:2' ? 'remove' : node.id === 'SQ:' ? 'deletePlaylist'
    : /^SQ:\d/.test(node.id || '') ? 'removeFromPlaylist' : null
  // A track dragged within a Sonos Playlist's page moves there, as the S1
  // apps' do (The Prize above What Child Is This? on "test", 2026-09-29).
  const [plDrag, setPlDrag] = useState(null)
  const [plDrop, setPlDrop] = useState(null)
  const reorderable = /^SQ:\d+$/.test(node.id || '') && !searching
  const reorderFor = (index, count) => (reorderable ? {
    mark: plDrag != null && plDrop === index ? 'before'
      : plDrag != null && plDrop === count && index === count - 1 ? 'after' : '',
    onStart: (event) => { event.dataTransfer.setData('text/plain', ''); event.dataTransfer.effectAllowed = 'move'; setPlDrag(index); setPlDrop(null) },
    onOver: (event) => {
      if (plDrag == null) return
      event.preventDefault()
      const box = event.currentTarget.getBoundingClientRect()
      setPlDrop(event.clientY < box.top + box.height / 2 ? index : index + 1)
    },
    onDrop: async (event) => {
      if (plDrag == null || plDrop == null) return
      event.preventDefault()
      const from = plDrag
      const landing = plDrop > from ? plDrop - 1 : plDrop
      setPlDrag(null); setPlDrop(null)
      if (landing === from) return
      const done = await actions.movePlaylistTrack(node.hzone, node.id, from + 1, landing + 1)
      setRefresh((v) => v + 1)
      if (!done) onMessage?.(t('notice.error.title'))
    },
    onEnd: () => { setPlDrag(null); setPlDrop(null) },
  } : null)
  const rowExtras = (item, index) => ({
    hzone: node.hzone, hh: node.hh, favorite: node.id === 'FV:2', radio: node.id === 'R:0/0' || node.id === 'R:0/1', playlist: node.id === 'SQ:',
    inPlaylist: /^SQ:\d/.test(node.id) ? node.id : '', position: index + 1,
    serviceLabel: item.service_label || item.service_name || serviceLabelFor(item, servicesByHh[node.hh]),
  })

  // The preset dial slides away for a room with no presets ("This browser"
  // has none) and back for one with them, so it keeps the last presets it
  // showed to slide out with rather than vanishing mid-motion.
  const showEq = Boolean(activeZone?.local)
  const showPresets = !showEq && Boolean(activeZone) && (favorites?.items?.length > 0)
  if (showPresets) presets.current = favorites.items
  if (showEq) everLocal.current = true

  return (
    <Unit className={`hf-tuner-unit${sourcesOpen ? ' hf-sources-open' : ''}${atRoot ? ' hf-tuner-root' : ''}`}
          name={t('hifi.unit.tuner')} model={node.root ? t('desk.browse.music') : (node.serviceName || node.title || '')}>
      {/* This browser has no presets, and is the one room whose sound the
          page plays, so its window shows the sound itself instead. */}
      <div className="hf-dial-slot" data-open={showEq || undefined} inert={!showEq} aria-hidden={!showEq || undefined}>
        <div className="hf-dial-slot-inner">
          {everLocal.current && (
            <LevelDeck playing={showEq && activeZone?.transport?.state === 'PLAYING'}
                       presets={showEq && favorites?.items?.length > 0 ? (
                         <PresetDial items={favorites.items} zone={activeZone} onPlay={(item) => onPlayItem?.(item, 'FV:2')}
                                     onMenu={(item, event) => onItemMenu?.(item, 'FV:2', event)} />
                       ) : null} />
          )}
        </div>
      </div>
      {presets.current.length > 0 && (
        <div className="hf-dial-slot" data-open={showPresets || undefined} inert={!showPresets} aria-hidden={!showPresets || undefined}>
          <div className="hf-dial-slot-inner">
            <PresetDial items={presets.current} zone={activeZone} onPlay={(item) => onPlayItem?.(item, 'FV:2')}
                        onMenu={(item, event) => onItemMenu?.(item, 'FV:2', event)} />
          </div>
        </div>
      )}
      <div className="hf-tuner-body">
      {sourcesOpen && <div className="hf-sources-backdrop" onClick={() => setSourcesOpen(false)} />}
      <nav className="hf-sources" aria-label={t('hifi.musicSources')}>
        {/* The zone the sources below play to, and a way to hand the tuner
            to another one without leaving it. */}
        <button type="button" className="hf-output" aria-haspopup="menu" aria-expanded={Boolean(roomMenu)}
                disabled={roomOptions.length < 2} onClick={(event) => setRoomMenu(event.currentTarget)}>
          <span className="hf-legend">{t('hifi.output')}</span>
          <span className="hf-output-name"><G.Speaker />{activeRoomName || t('hifi.chooseZone')}</span>
          <G.ChevronDown />
        </button>
        <div className="hf-sources-head">
          <h3 className="hf-legend">{t('hifi.musicSources')}</h3>
          <IconKey label={t('common.close')} className="hf-sources-close" onClick={() => setSourcesOpen(false)}><G.Close /></IconKey>
        </div>
        <div className="hf-sources-scroll">
          {sections.map((section) => {
            const folded = section.otherSystem && !openOther.has(section.household.id)
            return (
            <div key={section.household.id} className="hf-source-group" data-dim={section.otherSystem || undefined}>
              {section.header && (section.otherSystem ? (
                <button type="button" className="hf-source-gen hf-source-fold" aria-expanded={!folded}
                        title={t(folded ? 'desk.queue.expand' : 'desk.queue.collapse')}
                        onClick={() => toggleOther(section.household.id)}>
                  <span>{section.header}</span>
                  <G.ChevronDown />
                </button>
              ) : <p className="hf-source-gen">{section.header}</p>)}
              <div className="hf-fold" data-collapsed={folded || undefined} inert={folded || undefined}>
              <div>
              {section.rows.map((row) => {
                const Glyph = GLYPHS[row.glyph] || G.Note
                const current = !node.root && (node.id === row.id || (row.service != null && node.service === row.service && node.hh === row.hh) || (row.id === 'linein' && node.virtual === 'lineIn' && node.hh === row.hh))
                return (
                  <div key={`${section.household.id}-${row.id}`} className="hf-source" data-current={current || undefined} aria-disabled={row.disabled || undefined}
                       onContextMenu={row.disabled ? undefined
                         : row.playable ? (event) => openRoot(row, false, event)
                         : row.accounts ? (event) => { event.preventDefault(); setAccountMenu({ row, anchor: null, x: event.clientX, y: event.clientY }) }
                         : undefined}>
                    <button type="button" className="hf-source-main" disabled={row.disabled} onClick={(event) => openRoot(row, false, event)}
                            aria-current={current || undefined} title={row.disabled ? t('hifi.otherSystem', { gen: row.gen }) : row.title}>
                      <Led on={current} />
                      <span className="hf-source-icon">
                        {row.icon ? <img src={row.icon} alt="" /> : <Glyph />}
                        {row.caution && <CautionBadge kind={row.caution} title={t(`services.caution.${row.caution}`, { gen: row.gen ?? 'S1' })} />}
                      </span>
                      <span className="hf-source-text">
                        <span className="hf-source-title">{row.title}</span>
                        {row.sub && <span className="hf-source-sub">{row.sub}</span>}
                      </span>
                    </button>
                    {row.accounts && !row.disabled && (
                      <IconKey label={t('desk.browse.switchAccount')} onClick={(event) => setAccountMenu({ row, anchor: event.currentTarget })}><G.ChevronDown /></IconKey>
                    )}
                    {row.playable && !row.disabled && (
                      <IconKey label={t('desk.browse.actions')} onClick={(event) => openRoot(row, false, event)}><G.ChevronDown /></IconKey>
                    )}
                  </div>
                )
              })}
              {addHouseholdId === section.household.id && (
                <button type="button" className="hf-source hf-source-main hf-source-add"
                        onClick={() => { setSourcesOpen(false); push({ id: '__addsvc', virtual: 'addServices', title: t('desk.browse.addServicesFor', { gen: section.household.generation }), glyph: 'plus', hh: section.household.id, hzone: section.hzone }) }}>
                  <span className="hf-source-icon"><G.Plus /></span>
                  <span className="hf-source-text"><span className="hf-source-title">{t('desk.browse.addServices')}</span></span>
                </button>
              )}
              </div>
              </div>
            </div>
          )})}
        </div>
      </nav>

      <section className="hf-screen-bay" aria-label={t('desk.browse.music')}>
        <Display className="hf-screen">
        <header className="hf-screen-head">
          <div className="hf-crumbs">
            <IconKey label={t('hifi.musicSources')} className="hf-sources-toggle" onClick={() => setSourcesOpen(true)}><G.Rows /></IconKey>
            <button type="button" className="hf-crumb" data-current={crumbs.length === 0 || undefined} onClick={() => { setStack([ROOT]); setTerm('') }}>{t('desk.browse.music')}</button>
            {crumbs.map((entry, i) => (
              <React.Fragment key={`${entry.id}-${i}`}>
                <G.Chevron className="hf-crumb-sep" />
                <button type="button" className="hf-crumb" data-current={i === crumbs.length - 1 || undefined}
                        onClick={() => setStack(stack.slice(0, i + 2))}>{entry.title}</button>
              </React.Fragment>
            ))}
          </div>
          <div className="hf-search" role="search">
            {scope && (
              <button type="button" className="hf-search-scope" title={t('desk.search.scope')} aria-haspopup="menu" onClick={(event) => setScopeMenu(event.currentTarget)}>
                {scope.icon ? <img src={scope.icon} alt="" /> : scope.all ? <G.Search /> : <G.Radio />}
                <G.ChevronDown />
              </button>
            )}
            <G.Search className="hf-search-glyph" />
            <input ref={searchRef} type="search" value={term} placeholder={scope && !scope.all ? t('desk.search.in', { service: scope.name }) : t('common.search')}
                   aria-label={t('common.search')} onChange={(event) => setTerm(event.target.value)}
                   onKeyDown={(event) => { if (event.key === 'Escape' && term) { event.stopPropagation(); setTerm('') } }} />
            {term && <IconKey label={t('common.close')} onClick={() => setTerm('')}><G.Close /></IconKey>}
          </div>
          {/* The root draws its own tiles whatever this says, so the choice
              is not offered there. */}
          {!node.root && (
            <SlideSwitch label={t('hifi.view')} value={view} onChange={setView} className="hf-view-switch" options={[
              { id: 'auto', icon: <G.Auto />, title: t('hifi.viewAuto') }, { id: 'grid', icon: <G.Grid />, title: t('hifi.viewGrid') }, { id: 'list', icon: <G.Rows />, title: t('hifi.viewList') }]} />
          )}
        </header>
        <div className="hf-content-scroll" ref={scroller}>
          {searching ? (
            <SearchResults allLabel={allLabel} search={search} scope={scope} pickedCategory={pickedCategory} onCategory={setPickedCategory}
                           onOpen={(item, from = scope) => {
                             if (isPlayableLeaf(item) || !item.is_container) return
                             setTerm('')
                             setStack([ROOT, { id: `svc:${from.id}`, title: from.name, service: from.id, item: 'root', hzone: from.hzone, hh: from.hh, account: from.account, icon: from.icon, serviceName: from.name, gen: from.gen },
                                       { id: item.id, title: item.title, service: from.id, item: item.id, hzone: from.hzone, hh: from.hh, account: from.account, gen: from.gen, icon: from.icon,
                                         kind: item.item_type, displayType: item.display_type || '', uri: item.uri, metadata: item.metadata, art: item.art, artist: item.artist, serviceName: from.name }])
                           }}
                           onPlay={(item, from = scope) => act({ ...item, hzone: from.hzone, service: from.id, hh: from.hh }, 'now')}
                           onMenu={(item, event, from = scope) => openMenu(item, event, { hzone: from.hzone, service: from.id, hh: from.hh })} />
          ) : node.root ? (
            <RootOverview sections={sections} onOpen={(row, event) => openRoot(row, false, event)} t={t}
                          recent={activeZone ? recent?.items || [] : []} onPlayItem={onPlayItem} onItemMenu={onItemMenu}
                          folded={(id) => !openOther.has(id)} onFold={toggleOther}
                          onAccounts={(row, event) => { event.preventDefault(); setAccountMenu({ row, anchor: null, x: event.clientX, y: event.clientY }) }} />
          ) : node.virtual === 'lineIn' ? (
            <LineInPage node={node} zones={zones} households={households} t={t}
                        onPlay={(zone) => actions.setSource(zone.uuid, { uri: `x-rincon-stream:${zone.uuid}`, metadata: '' })} />
          ) : node.virtual === 'addServices' ? (
            <AddServicesPage node={node} servicesRaw={servicesRaw} t={t} onPick={onLinkService} />
          ) : node.virtual === 'changeLocation' ? (
            <div className="hf-rows">
              <RowButton icon={<G.Pin />} label={t('desk.radio.enterZip')} onClick={() => setNaming({ kind: 'zip' })} />
              <RowButton icon={<G.Folder />} label={t('desk.radio.pickCity')} more onClick={() => push({ id: 'r0', item: 'r0', service: node.service, title: t('desk.radio.pickCity'), hzone: node.hzone, hh: node.hh, icon: node.icon, pickCity: true, serviceName: node.serviceName })} />
            </div>
          ) : (
            <>
              <PageHead node={node} caution={caution} liveAccount={liveAccount} page={page} t={t} onLinkService={onLinkService}
                        isCollection={isCollection} onPlay={() => playAlbum(false)} onShuffle={() => playAlbum(true)}
                        onMenu={(event) => openMenu(albumItem(), event)} count={items.length}
                        shuffled={/SHUFFLE/.test(activeZone?.transport?.play_mode || '')} />
              {page.error && <p className="hf-error">{page.error}</p>}
              {page.loading && <Loading>{t('desk.browse.loading')}</Loading>}
              {!page.loading && !page.error && !page.needsLink && items.length === 0 && node.service !== 254 && (
                <Empty icon={<G.Folder />} title={t('desk.browse.empty')} />
              )}
              {node.service === 254 && node.item === 'root' && !page.loading && (
                <div className="hf-pinned">
                  {[['R:0/0', t('desk.radio.myStations'), 'station', false],
                    ['R:0/1', t('desk.radio.myShows'), 'show', false],
                    [radioLocation.node || 'local', radioLocation.city ? t('desk.radio.localRadioIn', { city: radioLocation.city }) : t('desk.radio.localRadio'), 'local', true]].map(([id, title, icon, viaService]) => (
                    <button key={id} type="button" className="hf-pin" onClick={() => push(viaService
                      ? { id, title, item: id, service: node.service, hzone: node.hzone, hh: node.hh, icon: node.icon, serviceName: node.serviceName, localRadio: true }
                      : { id, title, item: 'root', hzone: node.hzone, hh: node.hh, icon: node.icon, glyph: 'tunein' })}>
                      <img src={`${TUNEIN_ICONS}/${icon}_legacy.png`} alt="" />
                      <span>{title}</span>
                      <G.Chevron />
                    </button>
                  ))}
                </div>
              )}
              {shelves.length > 0 && (
                <div className="hf-shelves">
                  {shelves.map((shelf, si) => (
                    <section key={`${shelf.id}-${si}`} className="hf-quick-section" aria-label={shelf.title}>
                      <header className="hf-section-head">
                        <h2>{shelf.title}</h2>
                        {shelf.id && (
                          <button type="button" className="hf-link" onClick={() => browseInto(shelf, { preset: shelf.children })}>
                            {t('common.viewAll')}<G.Chevron />
                          </button>
                        )}
                      </header>
                      <div className="hf-shelf-row">
                        {shelf.children.map((item, index) => (
                          <ItemCard key={`${item.id}-${index}`} item={item} node={node} t={t} displayTypes={page.displayTypes}
                                    onOpen={(event) => open({ ...item, ...rowExtras(item, index) }, event)}
                                    onPlay={item.uri ? () => act({ ...item, ...rowExtras(item, index) }, 'now') : null}
                                    onMenu={(event) => openMenu(item, event, rowExtras(item, index))} />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
              {shelves.length > 0 && loose.length === 0 ? null : grid ? (
                <div className="hf-grid">
                  {loose.map((item, index) => (
                    <ItemCard key={`${item.id}-${index}`} item={item} onDelete={removal ? () => act({ ...item, ...rowExtras(item, index) }, removal) : undefined} node={node} t={t} displayTypes={page.displayTypes}
                              onOpen={(event) => open({ ...item, ...rowExtras(item, index) }, event)} onPlay={item.uri ? () => act({ ...item, ...rowExtras(item, index) }, 'now') : null}
                              onMenu={(event) => openMenu(item, event, rowExtras(item, index))} />
                  ))}
                </div>
              ) : (
                <div className="hf-rows">
                  {loose.map((item, index) => (
                    <ItemRow key={`${item.id}-${index}`} item={item} onDelete={removal ? () => act({ ...item, ...rowExtras(item, index) }, removal) : undefined} node={node} t={t} displayTypes={page.displayTypes} place={node.pickCity && peek[item.id] === 'final'} number={isCollection && node.kind === 'album' && !item.is_container ? index + 1 : 0}
                             checked={checked.has(item.id)} onCheck={() => toggleCheck(item.id)}
                             selected={menu?.item?.id === item.id}
                             reorder={reorderFor(index, loose.length)}
                             onOpen={(event) => open({ ...item, ...rowExtras(item, index) }, event)}
                             onPlay={item.uri ? () => act({ ...item, ...rowExtras(item, index) }, 'now') : null}
                             onMenu={(event) => openMenu(item, event, rowExtras(item, index))} />
                  ))}
                </div>
              )}
              {node.id === 'R:0/0' && !page.loading && (
                <div className="hf-page-foot"><Button quiet icon={<G.Plus />} onClick={onAddRadio}>{t('desk.radio.addNew')}</Button></div>
              )}
              {node.id === 'SQ:' && !page.loading && (
                <div className="hf-page-foot"><Button quiet icon={<G.Plus />} onClick={() => setNaming({ kind: 'newPlaylist' })}>{t('desk.playlists.new')}</Button></div>
              )}
              {node.localRadio && !page.loading && (
                <div className="hf-page-foot"><Button quiet icon={<G.Pin />} onClick={() => push({ id: '__changeloc', virtual: 'changeLocation', title: t('desk.radio.changeLocation'), service: node.service, hzone: node.hzone, hh: node.hh, icon: node.icon, serviceName: node.serviceName })}>{t('desk.radio.changeLocation')}</Button></div>
              )}
            </>
          )}
        </div>
        {checked.size > 0 && (
          <div className="hf-selection-bar" role="toolbar" aria-label={t('hifi.selected', { count: checked.size })}>
            <span>{t('hifi.selected', { count: checked.size })}</span>
            <Button small primary icon={<G.Play />} onClick={() => act(items.find((i) => checked.has(i.id)), 'now')}>{t('desk.actions.playNow')}</Button>
            <Button small quiet onClick={() => act(items.find((i) => checked.has(i.id)), 'next')}>{t('desk.actions.playNext')}</Button>
            <Button small quiet onClick={() => act(items.find((i) => checked.has(i.id)), 'add')}>{t('desk.actions.addToQueue')}</Button>
            <Button small quiet icon={<G.Playlist />} onClick={() => act(items.find((i) => checked.has(i.id)), 'addToPlaylist')}>{t('desk.favorites.addToSonosPlaylist')}</Button>
            <IconKey label={t('desk.actions.unselectAll')} onClick={() => setChecked(new Set())}><G.Close /></IconKey>
          </div>
        )}
        </Display>
      </section>
      </div>

      {roomMenu && (
        <Menu anchor={roomMenu} onClose={() => setRoomMenu(null)} width={260} title={t('desk.rooms.title')}>
          {roomOptions.map((group) => (
            <MenuItem key={group.coordinator} checked={group.coordinator === activeZone?.uuid}
                      onSelect={() => { onSelectRoom?.(group.coordinator); setRoomMenu(null) }}>
              {groupName(group, zones)}
            </MenuItem>
          ))}
        </Menu>
      )}
      {scopeMenu && (
        <Menu anchor={scopeMenu} onClose={() => setScopeMenu(null)} width={280} title={t('desk.search.scope')}>
          {scopes.map((s) => (
            <MenuItem key={s.key} checked={scope?.key === s.key} onSelect={() => { setScope(s); setScopeMenu(null); searchRef.current?.focus() }}>
              {s.all ? s.name : <>{(s.accounts > 1 || scopes.filter((o) => o.id === s.id).length > 1) && s.nickname ? `${s.name} (${s.nickname})` : s.name}{scopes.some((o) => !o.all && o.hh !== s.hh) ? ` · ${s.gen}` : ''}</>}
            </MenuItem>
          ))}
        </Menu>
      )}
      {accountMenu && (
        <Menu anchor={accountMenu.anchor} x={accountMenu.x} y={accountMenu.y} align="right" onClose={() => setAccountMenu(null)} title={accountMenu.row.title}>
          {[...accountMenu.row.accounts].sort((a, b) => (a.nickname || '').localeCompare(b.nickname || '', undefined, { sensitivity: 'base' })).map((account) => (
            <MenuItem key={`${account.account_id ?? ''}`} checked={(account.account_id ?? '') === accountMenu.row.account}
                      onSelect={() => { pickAccount(`${accountMenu.row.hh}:${accountMenu.row.service}`, account.account_id ?? ''); setAccountMenu(null) }}>
              {account.nickname || accountMenu.row.title}
            </MenuItem>
          ))}
        </Menu>
      )}
      {menu && (
        <ActionMenu item={menu.item} x={menu.x} y={menu.y} anchor={menu.anchor} align={menu.align} onClose={() => setMenu(null)} onAct={(how) => act(menu.item, how)}
                    canUnselect={checked.size > 0} saved={savedFavorite} t={t} />
      )}
      {addTo && (
        <AddToPlaylistSheet picks={addTo.picks} source={addTo.source} hzone={addTo.hzone} onClose={() => setAddTo(null)} onMessage={onMessage} />
      )}
      {naming?.kind === 'favorite' && (
        <Confirm title={t('desk.favorites.rename')} body={t('desk.favorites.renameBody')} action={t('common.ok')} input={{ initial: naming.item.title || '' }}
                 onClose={() => setNaming(null)}
                 onConfirm={async (title) => { const target = naming.item; setNaming(null); const done = await actions.renameFavorite(target.hzone || node.hzone, target.id, target.title, title); if (done) { setRefresh((v) => v + 1); onFavoritesChanged?.() } }} />
      )}
      {(naming?.kind === 'playlist' || naming?.kind === 'newPlaylist') && (
        <Confirm title={naming.kind === 'newPlaylist' ? t('desk.playlists.nameTitle') : t('desk.playlists.rename')}
                 body={naming.kind === 'newPlaylist' ? t('desk.playlists.nameBody') : t('desk.playlists.renameBody')} action={t('common.ok')}
                 input={{ initial: naming.kind === 'newPlaylist' ? '' : naming.item.title }} onClose={() => setNaming(null)}
                 onConfirm={async (title) => {
                   const target = naming; setNaming(null)
                   const done = target.kind === 'newPlaylist' ? await actions.createPlaylist(node.hzone, title) : await actions.renamePlaylist(target.item.hzone || node.hzone, target.item.id, target.item.title, title)
                   if (done) setRefresh((v) => v + 1)
                 }} />
      )}
      {naming?.kind === 'zip' && (
        <Confirm title={t('desk.radio.enterZip')} body={t('desk.radio.zipBody')} action={t('common.ok')} input={{ initial: '' }} onClose={() => setNaming(null)}
                 onConfirm={async (zip) => {
                   setNaming(null)
                   const place = zip.replace(/\s+/g, '')
                   let city = ''
                   try { const found = await api.serviceItem(node.service, `z${place}`, node.hzone); city = String(found?.title || '').split(',')[0].trim() } catch { city = '' }
                   const done = await actions.setRadioLocation(node.hzone, `z${place}`, city)
                   if (done) {
                     setLocationEpoch((v) => v + 1)
                     onMessage?.(t('desk.radio.locationSet', { city: done.city || place }))
                     const back = stack.findIndex((entry) => entry.localRadio)
                     if (back >= 0) setStack([...stack.slice(0, back), { ...stack[back], id: `z${place}`, item: `z${place}`, title: done.city ? t('desk.radio.localRadioIn', { city: done.city }) : t('desk.radio.localRadio') }])
                     else setStack(stack.slice(0, 1))
                   }
                 }} />
      )}
      {/* The speakers' own update, confirmed first: music stops in each room
          while it installs. */}
      {updateAsk && (
        <Confirm title={t('desk.update.title')} body={updateBody(t, households, updateAsk.hh, updateAsk.version)}
                 action={t('desk.update.start')} cancelLabel={t('desk.update.notNow')} onClose={() => setUpdateAsk(null)}
                 onConfirm={async () => {
                   const ask = updateAsk
                   setUpdateAsk(null)
                   const done = await api.startSoftwareUpdate(ask.hh).catch(() => null)
                   if (done?.started?.length) { onMessage?.(t('desk.update.started')); speakerUpdates.clear(ask.hh) }
                 }} />
      )}
      {replaceAsk && (
        <Confirm title={t('desk.queue.editedTitle')} body={t('desk.queue.editedBody')} action={t('desk.queue.playAnyway')} onClose={() => setReplaceAsk(null)}
                 onConfirm={() => { const ask = replaceAsk; setReplaceAsk(null); playAlbum(ask.shuffle, true) }} />
      )}
    </Unit>
  )
}

// The preset dial: the system's Sonos Favorites along a glass scale, each a
// numbered preset key under its name. The bank always has twelve memories,
// as a tuner's does; the ones with nothing stored are blank. The needle
// stands over the preset the room is playing when it is one of them, and
// parks at the left end when it is not; it moves for nothing else.
const PRESETS = 12
function PresetDial({ items, zone, onPlay, onMenu }) {
  const { t } = useI18n()
  const stored = items.slice(0, PRESETS)
  const slots = Array.from({ length: PRESETS }, (_, i) => stored[i] || null)
  const tr = zone?.transport || {}
  const playing = [tr.media_uri, tr.track_uri].filter(Boolean).map(favoriteKey)
  const at = stored.findIndex((item) => item.uri && playing.includes(favoriteKey(item.uri)))
  const pos = at >= 0 ? ((at + 0.5) / PRESETS) * 100 : 0
  return (
    <div className="hf-dial" role="group" aria-label={t('hifi.presets')}>
      <div className="hf-dial-track">
        <div className="hf-dial-glass" aria-hidden="true">
          <span className="hf-dial-scale">
            {Array.from({ length: 61 }, (_, i) => <i key={i} data-major={i % 5 === 0 || undefined} />)}
          </span>
          <span className="hf-dial-names">
            {slots.map((item, i) => <span key={item?.id || `empty-${i}`} data-on={i === at || undefined}>{item?.title || ''}</span>)}
          </span>
          <span className="hf-dial-needle" data-parked={at < 0 || undefined} style={{ left: `${pos}%` }} />
        </div>
        <div className="hf-dial-keys">
          {slots.map((item, i) => (
            <button key={item?.id || `empty-${i}`} type="button" className="hf-preset" disabled={!item || item.available === false}
                    aria-pressed={i === at || undefined} title={item?.title || undefined}
                    aria-label={item ? `${t('hifi.preset', { n: i + 1 })}: ${item.title}` : t('hifi.preset', { n: i + 1 })}
                    onClick={() => item && onPlay(item)} onContextMenu={(event) => { event.preventDefault(); if (item) onMenu(item, event) }}>
              <Led on={i === at} />
              <span>{i + 1}</span>
              {/* On a phone the dial's glass is too narrow for twelve names,
                  so each key carries its own. */}
              <span className="hf-preset-name" aria-hidden="true">{item?.title || ''}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// The root: what the room played lately, then the sources as keys, so a
// first visit shows what is there.
function RootOverview({ sections, onOpen, onAccounts, folded, onFold, t, recent = [], onPlayItem = null, onItemMenu = null }) {
  return (
    <div className="hf-root-overview">
      {/* The memory: what this room played lately, newest first. The
          speakers keep the list, so it follows the room. */}
      {recent.length > 0 && (
        <section className="hf-memory" aria-label={t('hifi.memory')}>
          <h3 className="hf-screen-title"><G.Clock />{t('hifi.memory')}</h3>
          <div className="hf-sleeve-row">
            {recent.slice(0, 24).map((item) => (
              <button key={item.id} type="button" className="hf-sleeve" title={item.title}
                      onClick={() => onPlayItem?.(item, 'recent')}
                      onContextMenu={(event) => { event.preventDefault(); onItemMenu?.(item, 'recent', event) }}>
                <span className="hf-sleeve-art"><Art src={item.art} size={112} fallback={genericArt(item)} brokenFallback={genericArt(item)} /></span>
                <span className="hf-sleeve-title">{item.title}</span>
                <span className="hf-sleeve-sub">{item.description || item.service_name || ''}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      {sections.map((section) => {
        const shut = section.otherSystem && folded(section.household.id)
        return (
        <section key={section.household.id} className="hf-root-system" data-dim={section.otherSystem || undefined}>
          {section.header && (section.otherSystem ? (
            <button type="button" className="hf-root-gen hf-root-fold" aria-expanded={!shut}
                    onClick={() => onFold(section.household.id)}>
              <span>{section.header}</span>
              <small>{t('hifi.otherSystem', { gen: section.header })}</small>
              <G.ChevronDown />
            </button>
          ) : <h2 className="hf-root-gen">{section.header}</h2>)}
          <div className="hf-fold" data-collapsed={shut || undefined} inert={shut || undefined}>
          <div>
          <div className="hf-root-grid">
            {section.rows.map((row) => {
              const Glyph = GLYPHS[row.glyph] || G.Note
              return (
                <button key={row.id} type="button" className="hf-root-tile" disabled={row.disabled} onClick={(event) => onOpen(row, event)}
                        onContextMenu={row.disabled ? undefined
                          : row.playable ? (event) => onOpen(row, event)
                          : row.accounts ? (event) => onAccounts(row, event)
                          : undefined}>
                  <span className="hf-root-icon">
                    {row.icon ? <img src={row.icon} alt="" /> : <Glyph />}
                    {row.caution && <CautionBadge kind={row.caution} title={t(`services.caution.${row.caution}`, { gen: row.gen ?? 'S1' })} />}
                  </span>
                  <span className="hf-root-title">{row.title}</span>
                  {row.sub && <span className="hf-root-sub">{row.sub}</span>}
                </button>
              )
            })}
          </div>
          </div>
          </div>
        </section>
      )})}
    </div>
  )
}

function PageHead({ node, caution, liveAccount, page, t, onLinkService, isCollection, onPlay, onShuffle, onMenu, count, shuffled }) {
  const Glyph = GLYPHS[node.glyph] || G.Note
  return (
    <>
      <header className={`hf-page-title${isCollection ? ' hf-hero' : ''}`}>
        {isCollection ? (
          <span className="hf-hero-art"><Art src={node.art} size={200} fallback={node.kind === 'album' ? 'disc' : 'playlist'} /></span>
        ) : (
          <span className="hf-page-icon">{node.icon ? <img src={node.icon} alt="" /> : <Glyph />}</span>
        )}
        <div className="hf-page-titles">
          {isCollection && <p className="hf-caption">{t(node.kind === 'album' ? 'common.kind.album' : 'common.kind.playlist')}</p>}
          <h1>{node.title}</h1>
          {isCollection && <p className="hf-muted">{[node.artist, t.plural('common.tracks', count)].filter(Boolean).join(' · ')}</p>}
          {isCollection && (
            <div className="hf-hero-actions">
              <Button primary icon={<G.Play />} onClick={onPlay}>{t('common.play')}</Button>
              <Button quiet icon={<G.Shuffle />} onClick={onShuffle} aria-pressed={shuffled || undefined}>{t('common.shuffle')}</Button>
              <IconKey label={t('desk.browse.actions')} onClick={onMenu}><G.Ellipsis /></IconKey>
            </div>
          )}
        </div>
      </header>
      {page.needsLink && (
        <div className="hf-banner">
          <CautionBadge kind="sonos" size="large" logo={node} title={t('services.caution.sonos', { gen: node.gen ?? 'S1' })} />
          <div>
            <strong>{t('services.needsSonora.title')}</strong>
            <p>{t('desk.browse.needsLink.body', { service: node.serviceName || node.title, gen: node.gen ?? 'S1' })}</p>
            <Button primary small icon={<G.Link />} onClick={() => onLinkService?.({ sid: node.service, householdId: node.hh, name: node.serviceName || node.title, account: liveAccount })}>
              {t('desk.browse.needsLink.action', { service: node.serviceName || node.title })}
            </Button>
          </div>
        </div>
      )}
      {!page.loading && !page.error && caution === 'sonora' && node.item === 'root' && (
        <div className="hf-banner">
          <CautionBadge kind="sonora" size="large" logo={node} title={t('services.caution.sonora', { gen: node.gen ?? 'S1' })} />
          <div>
            <strong>{t('services.needsSonos.title', { gen: node.gen ?? 'S1' })}</strong>
            <p>{t('services.sonoraOnly.body', { service: node.title, gen: node.gen ?? 'S1' })}</p>
          </div>
        </div>
      )}
    </>
  )
}

function RowButton({ icon, label, sub = '', more = false, onClick }) {
  return (
    <button type="button" className="hf-row hf-row-btn" onClick={onClick}>
      <span className="hf-row-art hf-row-glyph">{icon}</span>
      <span className="hf-row-text"><span className="hf-row-title">{label}</span>{sub && <span className="hf-row-sub">{sub}</span>}</span>
      {more && <G.Chevron className="hf-row-more" />}
    </button>
  )
}

// The service's DisplayType decides what a row says beyond its title: its
// Lines name the fields, and a row naming no display type shows its title
// alone whatever summary it carries (Pocket Casts' root). A container whose
// type has lines but no DisplayMode reads them on one line, "Comedy Albums /
// Burrito" (Plex's Other Sources); a playable row reads them under the title
// (Pandora's stations). Measured against the desktop app 2026-09-14; tracks
// and albums keep the artist line the app gives them without any map.
function linesOf(item, displayTypes) {
  // A row naming no display type is looked up by its itemType, the
  // protocol's second key for the same map: Spotify's names "track",
  // "album" and "playlist" and its rows carry no displayType, which is why
  // a track reads "Dr. Dre" and not "Dr. Dre - 2001" (2026-09-22).
  const declared = displayTypes?.[item.display_type || item.item_type || ''] || null
  // Only a type with no DisplayMode, LIST or EDITORIAL is honored -- the desktop app
  // falls back to its default for the modes it predates (HERO, GRID...).
  const typed = declared && (!declared.mode || ['LIST', 'EDITORIAL'].includes(declared.mode)) ? declared : null
  if (!typed) return null
  const lineOf = (token) => (token === 'title' ? item.title
    : token === 'artist' ? (item.artist || item.author || '')
    : token === 'album' ? (item.album || '')
    : token === 'summary' ? (item.summary || '') : '')
  const second = (typed.lines || []).slice(1).map(lineOf).filter(Boolean).join(' · ')
  // Inline for a row that only leads somewhere (Plex's libraries); two lines
  // for one that can play (Plex's playlists, Pandora's stations).
  return { second, inline: Boolean(second) && !item.can_play && !typed.mode }
}

function subtitleOf(item, node, t, displayTypes = {}) {
  const favorite = item.kind === 'favorite'
  if (favorite) return item.description || ''
  // An album's artist line is the page's to give, as in the desktop apps: the
  // container a row sits in names its children's lines through its own
  // displayType. Spotify's shelves (CAROUSEL) and artist pages (albumsList)
  // name none and list their albums by title alone; Plex's By Album
  // ("albums": title, artist) keeps the artist, as does a page whose
  // container names no type (S1 Windows app, 2026-09-22).
  const parentLines = displayTypes?.[node?.displayType || '']?.lines
  const pageDropsArtist = node?.kind === 'artist' || (Array.isArray(parentLines) && !parentLines.includes('artist'))
  if (pageDropsArtist && (item.item_type || item.kind) === 'album') return ''
  // A track on such a page reads by its title alone too: Plex's copies of a song, each an artist-typed
  // "Music / on <server>" container, show it so in both S1 apps (2026-10-02, 2026-10-03).
  if ((node?.kind === 'artist' || (Array.isArray(parentLines) && parentLines.length > 0 && !parentLines.includes('artist')))
    && !item.is_container && (item.item_type || 'track') === 'track') return ''
  const typed = linesOf(item, displayTypes)
  if (typed) return typed.inline ? '' : typed.second
  // An episode is dated, not attributed, as the desktop app prints it.
  if (/^episode\./.test(item.semantic_type || '') && item.release_date) {
    const when = new Date(item.release_date)
    if (!Number.isNaN(when.getTime())) return when.toLocaleDateString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric' })
  }
  // The artist line belongs to a track, an album or a playlist (whose owner
  // arrives there -- Spotify's mixes read "Spotify"), not to a container that
  // merely names one (a podcast show's <artist> is its producer).
  const container = item.is_container && !isPlayableLeaf(item)
  return ((!container || ['album', 'playlist'].includes(item.item_type || item.kind)) && [item.artist || item.author, item.album].filter(Boolean).join(' · '))
    || (item.child_count ? t.plural('common.items', item.child_count) : '')
}

function ItemRow({ item, node, t, displayTypes = {}, place = false, onDelete, number = 0, checked, onCheck, selected, onOpen, onPlay, onMenu, reorder = null }) {
  const favorite = item.kind === 'favorite'
  const unavailable = favorite && item.available === false
  const container = item.is_container && !isPlayableLeaf(item)
  // A SMAPI container that can neither be enumerated nor played is grayed
  // and opens nothing: Plex marks the library in view that way in Other
  // Sources, and the app dims it (2026-09-14). Home rows from a browse
  // endpoint are exempt -- Amazon's upsell row is marked the same and opens.
  const dead = !favorite && item.is_container && item.can_enumerate === false && !item.can_play && item.origin !== 'browse'
  // A leaf the service lists but refuses -- Mixcloud's subscriber-only shows
  // send <trackMetadata><canPlay>false</canPlay>. It is drawn dim, with the
  // theme's own "not this" mark where the cover would be.
  const restricted = !favorite && !item.is_container && item.can_play === false
  const opens = ((container && !dead) || (favorite && Boolean(item.browse_id) && !unavailable)) && !place
  const radio = node.id === 'R:0/0' || node.id === 'R:0/1'
  const playlist = node.id === 'SQ:'
  const sub = number ? '' : subtitleOf(item, node, t, displayTypes)
  const typed = number ? null : linesOf(item, displayTypes)
  const titleText = typed?.inline ? `${item.title} / ${typed.second}` : item.title
  const selectable = item.uri && !unavailable && !favorite && item.item_type !== 'audiobook' && isQueueable(item)
  return (
    <div className="hf-row" data-item role="button" tabIndex={0} aria-selected={selected || undefined} aria-checked={checked || undefined}
         data-restricted={restricted || undefined}
         draggable={Boolean(reorder) || undefined} onDragStart={reorder?.onStart} onDragOver={reorder?.onOver}
         onDrop={reorder?.onDrop} onDragEnd={reorder?.onEnd} data-drop={reorder?.mark || undefined}
         aria-disabled={unavailable || dead || restricted || undefined} title={item.stream_show || (!item.is_container && item.album) || undefined}
         style={dead ? { color: 'var(--t-fg-dim)' } : undefined}
         onClick={dead ? undefined : (event) => onOpen(event)} onDoubleClick={dead ? undefined : (onPlay || undefined)}
         onKeyDown={(event) => {
           if (event.key === 'Enter') onOpen(event)
           else if ((event.key === 'Delete' || event.key === 'Backspace') && onDelete) { event.preventDefault(); onDelete() }
         }}
         onContextMenu={(event) => { event.preventDefault(); onMenu(event) }}>
      <span className="hf-row-art">
        {number ? <span className="hf-row-num">{String(number).padStart(2, '0')}</span>
          : restricted ? <G.Prohibit role="img" aria-label={t('common.restricted')} />
          : unavailable ? <G.Warning />
          : (favorite && !item.uri && !item.art) ? <G.Folder />
          : radio && !item.art ? <G.Radio />
          : playlist ? <G.Playlist />
          : <Art src={item.art} size={44} fallback={genericArt(item)} />}
        {onPlay && !opens && !unavailable && (
          <button type="button" className="hf-row-play" title={t('desk.actions.playNow')} onClick={(event) => { event.stopPropagation(); onPlay() }}><G.Play /></button>
        )}
      </span>
      <span className="hf-row-text">
        <span className="hf-row-title">
          <span className="hf-row-title-text">{titleText}</span>
          {item.explicit && <G.Explicit className="hf-explicit" role="img" aria-label={t('common.explicit')} />}
        </span>
        {sub && <span className="hf-row-sub">{sub}</span>}
      </span>
      {typeof item.duration === 'string' && item.duration && item.duration !== '0:00:00' ? <span className="hf-row-dur">{item.duration.replace(/^0:0?/, '')}</span> : null}
      <span className="hf-row-tools" onClick={(event) => event.stopPropagation()}>
        {selectable && onCheck && (
          <label className="hf-check" title={t('desk.browse.select')}>
            <input type="checkbox" checked={checked} onChange={onCheck} />
            <span aria-hidden="true"><G.Check /></span>
          </label>
        )}
        <IconKey label={t('desk.browse.actions')} onClick={onMenu}><G.Ellipsis /></IconKey>
      </span>
      {opens && <G.Chevron className="hf-row-more" />}
    </div>
  )
}

function ItemCard({ item, node, t, displayTypes = {}, onOpen, onPlay, onMenu, onDelete }) {
  const container = item.is_container && !isPlayableLeaf(item)
  const favorite = item.kind === 'favorite'
  const unavailable = favorite && item.available === false
  const sub = subtitleOf(item, node, t, displayTypes)
  // The same two rules the list row follows (see ItemRow): a display type's
  // inline lines join the title, and an unenumerable, unplayable SMAPI
  // container is grayed and opens nothing.
  const typed = linesOf(item, displayTypes)
  const titleText = typed?.inline ? `${item.title} / ${typed.second}` : item.title
  const dead = !favorite && item.is_container && item.can_enumerate === false && !item.can_play && item.origin !== 'browse'
  return (
    <div className="hf-tile" data-item role="button" tabIndex={dead ? -1 : 0} aria-disabled={unavailable || dead || undefined} title={titleText}
         style={dead ? { color: 'var(--t-fg-dim)' } : undefined}
         onClick={dead ? undefined : (event) => onOpen(event)} onDoubleClick={dead ? undefined : (onPlay || undefined)}
         onKeyDown={(event) => {
           if (event.key === 'Enter' && !dead) onOpen(event)
           else if ((event.key === 'Delete' || event.key === 'Backspace') && onDelete) { event.preventDefault(); onDelete() }
         }}
         onContextMenu={(event) => { event.preventDefault(); onMenu(event) }}>
      <span className="hf-tile-art" data-round={item.item_type === 'artist' || undefined}>
        {unavailable ? <G.Warning /> : <Art src={item.art} size={160} fallback={genericArt(item)} />}
        {onPlay && (
          <button type="button" className="hf-tile-play" title={t('desk.actions.playNow')} onClick={(event) => { event.stopPropagation(); onPlay() }}><G.Play /></button>
        )}
        <button type="button" className="hf-tile-more" title={t('desk.browse.actions')} onClick={onMenu}><G.Ellipsis /></button>
      </span>
      <span className="hf-tile-title">
        {titleText}
        {item.explicit && <G.Explicit className="hf-explicit" role="img" aria-label={t('common.explicit')} />}
      </span>
      {sub && <span className="hf-tile-sub">{sub}</span>}
      {container && !dead && <G.Chevron className="hf-tile-chev" />}
    </div>
  )
}

// SMAPI answers one category at a time; the product takes one of each in
// turn, so a service's first rows show what kinds of thing it found.
function interleaveCategories(categories) {
  const lists = categories.map((c) => c.items || [])
  const out = []
  for (let i = 0; lists.some((l) => i < l.length); i += 1) for (const l of lists) if (i < l.length) out.push(l[i])
  return out
}

function SearchResults({ search, scope, pickedCategory, onCategory, onOpen, onPlay, onMenu, allLabel }) {
  const { t } = useI18n()
  if (scope?.all) {
    // One section per service, in the order the list gives them, each as it
    // answers; a service that found nothing is left out.
    const byKey = new Map((search.sections || []).map((section) => [section.scope.key, section]))
    const order = (search.order || [])
    const shown = [...byKey.values()].filter((section) => section.items.length)
      .sort((a, b) => order.indexOf(a.scope.key) - order.indexOf(b.scope.key))
    const multi = new Set(shown.map((section) => section.scope.hh)).size > 1
    return (
      <div className="hf-results">
        <header className="hf-page-title">
          <span className="hf-page-icon"><G.Search /></span>
          <div className="hf-page-titles">
            <p className="hf-caption">{allLabel}</p>
            <h1>{t('desk.browse.results', { query: search.term })}</h1>
          </div>
        </header>
        {shown.map(({ scope: from, items, displayTypes }) => (
          <section key={from.key} className="hf-results-service">
            <h2 className="hf-results-head">
              {from.icon ? <img src={from.icon} alt="" /> : <G.Radio />}
              <span>{from.nickname && from.nickname !== from.name ? `${from.name} (${from.nickname})` : from.name}{multi ? ` · ${from.gen}` : ''}</span>
            </h2>
            <div className="hf-rows">
              {items.slice(0, 6).map((item, index) => (
                <ItemRow key={`${from.key}-${item.id}-${index}`} item={item} node={{ id: 'search' }} t={t} displayTypes={displayTypes}
                         onOpen={(event) => (isPlayableLeaf(item) || !item.is_container ? onMenu(item, event, from) : onOpen(item, from))}
                         onPlay={item.uri ? () => onPlay(item, from) : null} onMenu={(event) => onMenu(item, event, from)} />
              ))}
            </div>
          </section>
        ))}
        {search.loading && <Loading>{t('desk.browse.loading')}</Loading>}
        {!search.loading && !shown.length && search.term && (
          <Empty icon={<G.Search />} title={t('desk.browse.noResults', { query: search.term })} />
        )}
      </div>
    )
  }
  return (
    <div className="hf-results">
      <header className="hf-page-title">
        <span className="hf-page-icon">{scope?.icon ? <img src={scope.icon} alt="" /> : <G.Search />}</span>
        <div className="hf-page-titles">
          <p className="hf-caption">{t('desk.search.in', { service: scope?.name || '' })}</p>
          <h1>{t('desk.browse.results', { query: search.term })}</h1>
        </div>
      </header>
      {search.available.length > 0 && (
        <div className="hf-chips">
          {search.available.map((cat) => (
            <Chip key={cat.id} active={cat.id === (pickedCategory || search.category)} onClick={() => onCategory(cat.id)}>{categoryLabel(cat, t)}</Chip>
          ))}
        </div>
      )}
      {search.loading && <Loading>{t('desk.browse.loading')}</Loading>}
      {search.error && <p className="hf-error">{search.error}</p>}
      {!search.loading && !search.error && search.categories.length === 0 && search.term && (
        <Empty icon={<G.Search />} title={t('desk.browse.noResults', { query: search.term })} />
      )}
      {search.categories.map((cat) => (
        <div key={cat.id} className="hf-rows">
          {cat.items.map((item, index) => (
            <ItemRow key={`${cat.id}-${item.id}-${index}`} item={item} node={{ id: 'search' }} t={t}
                     displayTypes={search.displayTypes}
                     onOpen={(event) => (isPlayableLeaf(item) || !item.is_container ? onMenu(item, event) : onOpen(item))}
                     onPlay={item.uri ? () => onPlay(item) : null} onMenu={(event) => onMenu(item, event)} />
          ))}
        </div>
      ))}
    </div>
  )
}

function LineInPage({ node, zones, households, onPlay, t }) {
  const household = households.find((h) => h.id === node.hh)
  const mine = (household?.zone_uuids || []).map((uuid) => zones[uuid]).filter(Boolean)
  const connected = mine.filter((z) => z.line_in_connected)
  if (!connected.length) return <Empty icon={<G.LineIn />} title={t('desk.browse.lineInNone')} />
  return (
    <div className="hf-rows">
      {connected.map((zone) => (
        <RowButton key={zone.uuid} icon={<G.LineIn />} label={zone.line_in_name || zone.name} sub={zone.name} onClick={() => onPlay(zone)} />
      ))}
    </div>
  )
}

function AddServicesPage({ node, servicesRaw, t, onPick }) {
  const rows = useMemo(() => {
    const all = servicesRaw || []
    const logos = {}
    for (const hh of all) for (const svc of hh.in_use || []) if (svc.icon && svc.id != null) logos[svc.id] = svc.icon
    const hh = all.find((h) => h.household === node.hh) || all[0]
    const used = new Set((hh?.in_use || []).map((s) => s.id))
    return (hh?.available || []).filter((s) => !used.has(s.id) || s.auth !== 'Anonymous')
      .map((s) => ({ ...s, icon: s.icon || logos[s.id] || '' })).sort((a, b) => a.name.localeCompare(b.name))
  }, [servicesRaw, node.hh])
  const [filter, setFilter] = useState('')
  const shown = rows.filter((s) => !filter || s.name.toLowerCase().includes(filter.toLowerCase()))
  if (!servicesRaw) return <Loading>{t('desk.browse.loading')}</Loading>
  return (
    <div className="hf-addsvc">
      <div className="hf-search hf-search-inline"><G.Search className="hf-search-glyph" /><input type="search" value={filter} placeholder={t('hifi.filterServices')} onChange={(e) => setFilter(e.target.value)} /></div>
      <div className="hf-grid">
        {shown.map((svc) => {
          const unpairable = svc.pairable === false
          return (
            <button key={svc.id} type="button" className="hf-tile hf-tile-btn" disabled={unpairable} title={unpairable ? t('desk.add.unpairable', { service: svc.name }) : ''}
                    onClick={() => !unpairable && onPick?.({ sid: svc.id, name: svc.name, householdId: node.hh, auth: svc.auth })}>
              <span className="hf-tile-art hf-tile-logo">{svc.icon ? <img src={svc.icon} alt="" /> : <span className="hf-initials">{svc.initials}</span>}</span>
              <span className="hf-tile-title">{svc.name}</span>
              <span className="hf-tile-sub">{unpairable ? t('desk.add.appOnly') : svc.in_use ? t('desk.add.another') : t(`desk.add.auth.${svc.auth}`)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// The row menu, shaped by what the row is: a track offers the queue and the
// adds; a station only Play Now and the favorite; a Sonos Favorite its
// rename and removal; a Sonos Playlist its rename and deletion.
function ActionMenu({ item, x, y, anchor, align = 'left', onClose, onAct, canUnselect, saved = null, t }) {
  // The television input, reached from the source list: the S2 app's menu for
  // it holds one item and no title line (measured 2026-09-11).
  if (item.root) {
    return (
      <Menu x={x} y={y} anchor={anchor} align={align} onClose={onClose} width={200}>
        <MenuItem icon={<G.Play />} onSelect={() => onAct('now')}>{t('desk.actions.playNow')}</MenuItem>
      </Menu>
    )
  }
  const playable = Boolean(item.uri)
  const queueable = isQueueable(item)
  const usable = item.available !== false && playable
  const title = item.title
  if (item.playlist) {
    return (
      <Menu x={x} y={y} anchor={anchor} align={align} onClose={onClose} title={title}>
        <MenuItem icon={<G.Play />} onSelect={() => onAct('now')}>{t('desk.actions.playNow')}</MenuItem>
        <MenuItem icon={<G.Next />} onSelect={() => onAct('next')}>{t('desk.actions.playNext')}</MenuItem>
        <MenuItem icon={<G.Tape />} onSelect={() => onAct('add')}>{t('desk.actions.addToQueue')}</MenuItem>
        <MenuItem icon={<G.Refresh />} onSelect={() => onAct('replace')}>{t('desk.actions.replaceQueue')}</MenuItem>
        <MenuSep />
        <MenuItem icon={<G.Pencil />} onSelect={() => onAct('renamePlaylist')}>{t('desk.playlists.rename')}</MenuItem>
        <MenuItem icon={<G.Trash />} danger onSelect={() => onAct('deletePlaylist')}>{t('desk.playlists.delete')}</MenuItem>
        <MenuSep />
        <MenuItem icon={<G.Star />} onSelect={() => onAct(saved ? 'unfavorite' : 'favorite')}>{t(saved ? 'desk.favorites.remove' : 'desk.actions.addFavorite')}</MenuItem>
        <MenuItem icon={<G.Playlist />} onSelect={() => onAct('addToPlaylist')}>{t('desk.favorites.addToSonosPlaylist')}</MenuItem>
        {canUnselect && <><MenuSep /><MenuItem onSelect={() => onAct('unselect')}>{t('desk.actions.unselectAll')}</MenuItem></>}
      </Menu>
    )
  }
  if (item.favorite) {
    return (
      <Menu x={x} y={y} anchor={anchor} align={align} onClose={onClose} title={title}>
        {usable && <MenuItem icon={<G.Play />} onSelect={() => onAct('now')}>{t('desk.actions.playNow')}</MenuItem>}
        {usable && queueable && (
          <>
            <MenuItem icon={<G.Next />} onSelect={() => onAct('next')}>{t('desk.actions.playNext')}</MenuItem>
            <MenuItem icon={<G.Tape />} onSelect={() => onAct('add')}>{t('desk.actions.addToQueue')}</MenuItem>
            <MenuItem icon={<G.Refresh />} onSelect={() => onAct('replace')}>{t('desk.actions.replaceQueue')}</MenuItem>
          </>
        )}
        {usable && <MenuSep />}
        <MenuItem icon={<G.Pencil />} onSelect={() => onAct('rename')}>{t('desk.favorites.rename')}</MenuItem>
        <MenuItem icon={<G.Trash />} danger onSelect={() => onAct('remove')}>{t('desk.favorites.remove')}</MenuItem>
        {usable && queueable && (
          <>
            <MenuSep />
            <MenuItem icon={<G.Playlist />} onSelect={() => onAct('addToPlaylist')}>{t('desk.favorites.addToSonosPlaylist')}</MenuItem>
            <MenuItem icon={<G.Info />} onSelect={() => onAct('info')}>{t('desk.now.infoOptions')}</MenuItem>
          </>
        )}
      </Menu>
    )
  }
  return (
    <Menu x={x} y={y} anchor={anchor} align={align} onClose={onClose} title={title}>
      {playable && <MenuItem icon={<G.Play />} onSelect={() => onAct('now')}>{t('desk.actions.playNow')}</MenuItem>}
      {playable && queueable && (
        <>
          <MenuItem icon={<G.Next />} onSelect={() => onAct('next')}>{t('desk.actions.playNext')}</MenuItem>
          <MenuItem icon={<G.Tape />} onSelect={() => onAct('add')}>{t('desk.actions.addToQueue')}</MenuItem>
          <MenuItem icon={<G.Refresh />} onSelect={() => onAct('replace')}>{t('desk.actions.replaceQueue')}</MenuItem>
        </>
      )}
      {item.inPlaylist && <><MenuSep /><MenuItem icon={<G.Trash />} danger onSelect={() => onAct('removeFromPlaylist')}>{t('desk.playlists.removeSong')}</MenuItem></>}
      {playable && <MenuSep />}
      <MenuItem icon={<G.Star />} disabled={!playable && !item.favorite_uri} note={playable || item.favorite_uri ? '' : t('desk.menu.disabledNote')} onSelect={() => onAct(saved ? 'unfavorite' : 'favorite')}>{t(saved ? 'desk.favorites.remove' : 'desk.actions.addFavorite')}</MenuItem>
      {(playable && queueable) || (!playable && item.is_container && item.playlist_policy) ? (
        <MenuItem icon={<G.Playlist />} disabled={!playable && !item.favorite_uri} onSelect={() => onAct('addToPlaylist')}>{t('desk.favorites.addToSonosPlaylist')}</MenuItem>
      ) : null}
      {(playable || (item.is_container && ['playlist', 'album', 'artist', 'show'].includes(item.item_type))) && (
        <><MenuSep /><MenuItem icon={<G.Info />} onSelect={() => onAct('info')}>{t('desk.now.infoOptions')}</MenuItem></>
      )}
      {canUnselect && <><MenuSep /><MenuItem onSelect={() => onAct('unselect')}>{t('desk.actions.unselectAll')}</MenuItem></>}
    </Menu>
  )
}

// "Add to Sonos Playlist": the household's playlists and a new one.
export function AddToPlaylistSheet({ picks, source, hzone, onClose, onMessage }) {
  const { t } = useI18n()
  const { actions } = useSystem()
  const [playlists, setPlaylists] = useState(null)
  const [naming, setNaming] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!hzone) return
    api.playlists(hzone).then((r) => setPlaylists(r.items || [])).catch(() => setPlaylists([]))
  }, [hzone])
  const items = (picks || []).filter((item) => item.uri)
  const addAll = async (id, title) => {
    setBusy(true)
    let added = 0
    for (const item of items) { const done = await actions.addToPlaylist(hzone, id, item, source || ''); if (done) added += 1 }
    setBusy(false)
    if (added) {
      onMessage?.(added === 1 ? t('desk.playlists.added', { title: items[0].title, playlist: title }) : t('desk.playlists.addedMany', { count: added, playlist: title }))
      onClose()
    }
  }
  return (
    <Panel kind="center" title={t('desk.playlists.addTitle')} onClose={onClose}>
      <PanelHead title={t('desk.playlists.addTitle')} sub={items.length === 1 ? items[0].title : t.plural('common.items', items.length)} onClose={onClose} />
      <div className="hf-panel-body">
        {playlists === null ? <Loading>{t('desk.browse.loading')}</Loading> : (
          <div className="hf-rows">
            {playlists.map((item) => (
              <RowButton key={item.id} icon={<G.Playlist />} label={item.title} onClick={() => { if (!busy) addAll(item.id, item.title) }} />
            ))}
            <RowButton icon={<G.Plus />} label={t('desk.playlists.new')} onClick={() => setNaming(true)} />
          </div>
        )}
      </div>
      {naming && (
        <Confirm title={t('desk.playlists.nameTitle')} body={t('desk.playlists.nameBody')} action={t('common.ok')} input={{ initial: '' }} onClose={() => setNaming(false)}
                 onConfirm={async (title) => { setNaming(false); const made = await actions.createPlaylist(hzone, title); if (made?.id) await addAll(made.id, title) }} />
      )}
    </Panel>
  )
}

// A radio station by its stream URL, saved to My Radio Stations.
export function AddRadioSheet({ zone, onClose, onAdded }) {
  const { t } = useI18n()
  const { actions } = useSystem()
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const urlOk = /^(https?|x-rincon-mp3radio):\/\/\S+$/i.test(url.trim())
  const nameOk = name.trim().length > 0
  const submit = async () => {
    if (!urlOk || !nameOk || !zone) return
    setBusy(true)
    const result = await actions.addRadioStation(zone.uuid, url.trim(), name.trim())
    setBusy(false)
    if (result) { onAdded?.(result); onClose() }
  }
  return (
    <Panel kind="center" title={t('desk.radio.title')} onClose={onClose}>
      <PanelHead title={t('desk.radio.title')} onClose={onClose} />
      <div className="hf-panel-body">
        <p className="hf-confirm-body">{t('desk.radio.intro')} {t('desk.radio.where')}</p>
        <label className="hf-field"><span className="hf-field-label">{t('desk.radio.url')}</span>
          <input className="hf-input" type="url" value={url} data-autofocus placeholder="http://" onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit() }} /></label>
        <label className="hf-field"><span className="hf-field-label">{t('desk.radio.name')}</span>
          <input className="hf-input" type="text" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit() }} /></label>
      </div>
      <footer className="hf-panel-foot">
        <Button quiet onClick={onClose}>{t('common.cancel')}</Button>
        <Button primary disabled={!urlOk || !nameOk || busy || !zone} onClick={submit}>{t('common.ok')}</Button>
      </footer>
    </Panel>
  )
}
