import React, { useEffect, useMemo, useRef, useState } from 'react'
import { searchLibrary } from '../../frontend/src/lib/librarySearch.js'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { api } from '../../frontend/src/lib/api.js'
import { stationKey } from '../../frontend/src/lib/myRadio.js'
import { isPlayableLeaf } from '../../frontend/src/lib/items.js'
import { groupName } from '../../frontend/src/lib/format.js'
import { playTarget } from '../../frontend/src/lib/browserRoom.js'
import { readLibraryPrefs, libraryRows } from '../../frontend/src/lib/libraryPrefs.js'
import Art from '../../frontend/src/components/Art.jsx'
import { CautionBadge } from '../../frontend/src/components/CautionBadge.jsx'
import * as G from './glyphs.jsx'
import { holdDisk } from './disk.js'
import { rectOf, pt, viewW, viewH } from './layout.js'
import { Btn, IconBtn, Menu, MenuItem, MenuSep, Confirm, Empty, Busy, Window, WindowBar, Prompt, Field, Row, SystemPicker, Tick, SvcImg, cx } from './kit.jsx'
import { useBrowsePage, useSources, searchScopesOf, playItems, isQueueable, genericArt, describeFavorite, serviceLabelFor,
         TUNEIN_ICONS, readStored, writeStored, VIEW_KEY, householdOf, useSpeakerUpdates, favoriteTarget } from './house.js'
import { updateBody } from '../../frontend/src/lib/version.js'

// The Library program: every source of music the systems hold, as a disk
// would be listed on a terminal.
//
// It opens on an index. The command line at its head searches whichever
// service its scope names. Under it, what the room in view played lately,
// the household's Sonos Favorites and its Sonos Playlists, and then every
// source of every system in view as a directory, a system that is not the
// room's folded away until opened. Inside a source the page is a listing:
// the path along the top (each part of it a way back), a ".." row to go up a
// level, folders marked <DIR>, tracks with their length. Albums and
// playlists open onto a header with Play and Shuffle. Ticking rows brings up
// a bar of what can be done with them.

const ROOT = { root: true, title: '' }
const GLYPHS = { star: G.Star, library: G.Folder, playlist: G.Playlist, tv: G.Tv, linein: G.LineIn, note: G.Note, tunein: G.Radio, plus: G.Plus, update: G.Update }

function categoryLabel(cat, t) {
  if (cat.custom && cat.title) return cat.title
  const key = `search.category.${(cat.id || '').toLowerCase()}`
  const label = t(key)
  return label && label !== key ? label : (cat.title || cat.id || '')
}

export default function Library({ households, zones, roomGroups, onSelectRoom, systemFilter, onSystem, activeZone, roomChosen, servicesByHh, servicesRaw, libraryByHh,
                                  accountChoice, pickAccount, request, onMessage, onInfo, onLinkService, onAddRadio, favoritesEpoch,
                                  onFavoritesChanged, servicesVersion, queueEdited, onQueueReplaced, onScopeChange, compact, onPlayed,
                                  favorites, playlists, recent, onPlayItem, onOpenFavorite, onItemMenu }) {
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
  const [roomMenu, setRoomMenu] = useState(null)
  const [viewMenu, setViewMenu] = useState(null)
  const [sourceMenu, setSourceMenu] = useState(null)
  const [openedOther, setOpenOther] = useState(() => new Set())
  const toggleOther = (id) => setOpenOther((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const top = useRef(null)
  useEffect(() => {
    setChecked(new Set()); setMenu(null)
    top.current?.closest('.sv-crt-scroll')?.scrollTo?.({ top: 0 })
  }, [node])
  useEffect(() => { writeStored(VIEW_KEY, view) }, [view])
  // The console's cursor-left key steps back up the path.
  useEffect(() => {
    const back = () => setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev))
    window.addEventListener('sonora:svback', back)
    return () => window.removeEventListener('sonora:svback', back)
  }, [])

  const speakerUpdates = useSpeakerUpdates(households)
  const [updateAsk, setUpdateAsk] = useState(null)
  const sections = useSources({ households, systemFilter, zones, activeZone, servicesByHh, libraryByHh, accountChoice, roomChosen, updates: speakerUpdates.updates, t })
  const activeHousehold = activeZone ? householdOf(households, activeZone.uuid)?.id ?? null : null
  const activeGen = activeHousehold ? households.find((h) => h.id === activeHousehold)?.generation || '' : ''
  const allLabel = activeGen ? t('sv.allServicesGen', { gen: activeGen }) : t('sv.allServices')
  const scopes = useMemo(() => {
    const every = searchScopesOf({ households, systemFilter, zones, activeZone, servicesByHh, libraryByHh, t })
    const list = activeHousehold ? every.filter((s) => s.hh === activeHousehold) : every
    const services = list.filter((s) => !s.library)
    return services.length > 1 ? [{ key: 'all', all: true, name: allLabel, icon: '' }, ...list] : list
  }, [households, systemFilter, zones, activeZone, activeHousehold, servicesByHh, libraryByHh, allLabel, t])

  const sameService = node.service != null ? (servicesByHh[node.hh] || []).filter((s) => s.id === node.service) : []
  const liveRow = sameService.find((s) => (s.account_id ?? '') === (node.account ?? '')) ?? (!node.account && sameService.length === 1 ? sameService[0] : null)
  const liveAccount = liveRow?.account_id ?? node.account ?? ''
  const caution = liveRow ? (liveRow.on_system === false ? 'sonora' : null) : node.caution
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
                scope: target, items, displayTypes: result.display_types || {}, error: result.error ? result.error.message : '' }] }))
            })
            .catch((exc) => {
              if (!canceled) setSearch((prev) => ({ ...prev, sections: [...(prev.sections || []), { scope: target, items: [], error: exc?.message || '' }] }))
            })
            .finally(() => { waiting -= 1; if (!canceled && waiting <= 0) setSearch((prev) => ({ ...prev, loading: false })) })
        }
        if (!targets.length) setSearch((prev) => ({ ...prev, loading: false }))
        return
      }
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
                      categories: result.categories || [], displayTypes: result.display_types || {},
                      error: result.error ? result.error.message : '' })
        })
        .catch((exc) => { if (!canceled) setSearch({ term: q, available: [], category: '', categories: [], loading: false, error: exc?.message || '' }) })
    }, 450)
    return () => { canceled = true; clearTimeout(timer) }
  }, [term, scope, pickedCategory]) // eslint-disable-line react-hooks/exhaustive-deps
  // A search keeps the console's drive busy from the first key typed to the last result in.
  useEffect(() => (search.loading ? holdDisk() : undefined), [search.loading])
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
    if (item.id === 'update') { setUpdateAsk({ hh: item.hh, version: item.version }); return }
    if (!item.hzone) return
    if (item.playable) {
      event?.preventDefault?.()
      event?.stopPropagation?.()
      const anchor = event && event.type !== 'contextmenu' ? event.currentTarget : null
      setMenu({ item: { ...item, root: true }, anchor, x: pt(event?.clientX) ?? viewW() / 2, y: pt(event?.clientY) ?? viewH() / 2 })
      return
    }
    setTerm('')
    if (item.id === 'linein') { setStack([ROOT, { id: 'linein', virtual: 'lineIn', title: item.title, glyph: 'linein', hzone: item.hzone, hh: item.hh, gen: item.gen }]); return }
    const title = item.sub && item.sub !== item.title ? `${item.title} (${item.sub})` : item.title
    setStack([ROOT, { id: item.id, title, service: item.service, item: 'root', hzone: item.hzone, hh: item.hh, caution: item.caution, gen: item.gen,
                      glyph: item.glyph, icon: item.icon, initials: item.initials, account: item.account, serviceName: item.title }])
  }
  const browseInto = (item, extra = {}) => push({
    id: item.id, title: item.title, service: node.service, item: item.id, hzone: node.hzone, hh: node.hh, account: node.account, gen: node.gen,
    icon: node.icon, glyph: node.glyph, kind: item.item_type || (node.id === 'SQ:' ? 'playlist' : undefined), displayType: item.display_type || '', uri: item.uri, metadata: item.metadata || '',
    art: item.art, artist: item.artist, serviceName: node.serviceName, pickCity: node.pickCity, ...extra })
  const open = (item, event) => {
    if (node.root) { openRoot(item, false, event); return }
    if (!node.hzone || item.available === false) return
    if (node.id === 'FV:2' && item.browse_id && item.service_id) {
      const { svc, account, kind } = favoriteTarget((servicesByHh[node.hh] || []).filter((s) => s.id === item.service_id), item,
                                                    accountChoice[`${node.hh}:${item.service_id}`])
      push({ id: `${item.service_id}:${item.browse_id}`, title: item.title, service: item.service_id, item: item.browse_id, hzone: node.hzone, hh: node.hh, gen: node.gen,
             account, icon: svc?.icon || '', kind, uri: item.uri, metadata: item.metadata, art: item.art, serviceName: svc?.name || '' })
      return
    }
    if (isPlayableLeaf(item) || (node.id === 'FV:2' && item.uri)) { openMenu(item, event); return }
    if (node.pickCity && peek[item.id] === 'final') { chooseCity(item); return }
    if (item.is_container) browseInto(item)
  }
  // Picking a city for local radio.
  const [locationEpoch, setLocationEpoch] = useState(0)
  const [radioLocation, setRadioLocation] = useState({ node: '', city: '' })
  useEffect(() => {
    const hzone = sections[0]?.hzone || ''
    if (!hzone) return undefined
    let canceled = false
    api.radioLocation(hzone).then((r) => { if (!canceled) setRadioLocation(r || { node: '', city: '' }) }).catch(() => {})
    return () => { canceled = true }
  }, [sections[0]?.household?.id, locationEpoch]) // eslint-disable-line react-hooks/exhaustive-deps
  // Each row of the location tree is looked at one level down: more places under it and it
  // opens; stations under it and it is a place to live, chosen on a press; nothing under it and
  // it is not shown.
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
  const openMenu = (item, event, extra = {}) => {
    event?.stopPropagation?.()
    const anchor = event?.currentTarget?.closest?.('[data-item]') || null
    setMenu({ item: { ...item, ...extra }, x: pt(event?.clientX), y: pt(event?.clientY), anchor: event?.type === 'contextmenu' ? null : anchor })
  }
  const serviceOf = (item) => item.service ?? node.service ?? scope?.id ?? null
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
  const starting = useRef(new Set())
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
    // Content from the other system cannot play in the room in view: its speakers would not know
    // the account.
    const itemHousehold = householdOf(households, hzone)?.id
    if (!activeZone?.local && activeHousehold && itemHousehold && itemHousehold !== activeHousehold) {
      onMessage?.(t('sv.playOtherSystem', { gen: households.find((h) => h.id === itemHousehold)?.generation || '' }))
      return
    }
    // A second press on the same row while its source is still starting is the same
    // request, not another.
    const key = `${hzone}|${how}|${group.map((i) => i.uri || i.id).join(',')}`
    if (starting.current.has(key)) return
    starting.current.add(key)
    try {
      if (how === 'now' || how === 'replace') onQueueReplaced?.()
      const done = await playItems(actions, group.filter((i) => i.uri), how,
                                   { hzone: playTarget(activeZone, hzone), service, from: activeZone?.local ? hzone : '' })
      if (done) {
        setChecked(new Set())
        onMessage?.(t(how === 'now' ? 'sv.playingNow' : how === 'next' ? 'sv.queuedNext' : how === 'replace' ? 'sv.replacedQueue' : 'sv.addedToQueue',
                      { title: group.length > 1 ? t.plural('common.items', group.length) : group[0].title }))
        onPlayed?.(group.length > 1 ? { title: t.plural('common.items', group.length), art: group[0].art } : group[0])
      }
    } finally {
      starting.current.delete(key)
    }
  }
  const playAlbum = async (shuffle, force = false) => {
    if (!node.hzone || !node.uri) return
    if (queueEdited && !force) { setReplaceAsk({ shuffle }); return }
    onQueueReplaced?.()
    const mode = activeZone?.transport?.play_mode || 'NORMAL'
    const repeatOn = /REPEAT/.test(mode) && mode !== 'SHUFFLE_NOREPEAT'
    if (!activeZone?.local) {
      if (shuffle) await actions.setPlayMode(node.hzone, repeatOn ? 'SHUFFLE' : 'SHUFFLE_NOREPEAT')
      else if (/SHUFFLE/.test(mode)) await actions.setPlayMode(node.hzone, repeatOn ? 'REPEAT_ALL' : 'NORMAL')
    }
    const done = await actions.setSource(playTarget(activeZone, node.hzone),
                                         { uri: node.uri, metadata: node.metadata || '', service: node.service,
                                           ...(activeZone?.local ? { from_zone: node.hzone } : {}), replace: true })
    if (done) onPlayed?.({ title: node.title, art: node.art })
  }
  const albumItem = () => ({ id: `${node.id}#album`, title: node.title, uri: node.uri, metadata: node.metadata || '', art: node.art, artist: node.artist,
                             is_container: true, item_type: node.kind, hzone: node.hzone, service: node.service })
  const toggleCheck = (id) => setChecked((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })

  // --- what to show -----------------------------------------------------------
  const [libraryPrefs, setLibraryPrefs] = useState(readLibraryPrefs)
  useEffect(() => {
    const onPrefs = (event) => setLibraryPrefs(event.detail || readLibraryPrefs())
    window.addEventListener('sonora:libraryprefs', onPrefs)
    return () => window.removeEventListener('sonora:libraryprefs', onPrefs)
  }, [])
  const items = libraryRows(node.id, page.items, libraryPrefs, t).filter((item) => !(node.pickCity && peek[item.id] === 'empty'))
  const isCollection = (node.kind === 'album' || node.kind === 'playlist') && !page.loading && !page.error && items.length > 0
  const autoGrid = !isCollection && items.length > 0 && items.filter((i) => i.is_container && !isPlayableLeaf(i)).length >= Math.ceil(items.length * 0.6)
    && items.filter((i) => i.art).length >= Math.ceil(items.length * 0.5)
  const grid = view === 'grid' ? !isCollection : view === 'list' ? false : autoGrid
  // A service's home that arrives as shelves is drawn shelf by shelf, each under its name with
  // View All at its end, in the automatic view.
  const shelves = view === 'auto' && !isCollection ? items.filter((item) => (item.children || []).length > 0) : []
  const loose = shelves.length ? items.filter((item) => !(item.children || []).length) : items
  const addHouseholdId = (() => {
    const visible = sections.map((sec) => sec.household.id)
    if (activeHousehold && visible.includes(activeHousehold)) return activeHousehold
    return visible[0] || null
  })()
  const atRoot = node.root && !searching
  const roomOptions = roomGroups || []
  const activeRoomName = activeZone
    ? groupName(roomOptions.find((g) => g.coordinator === activeZone.uuid) || { members: [activeZone.uuid], name: activeZone.name }, zones)
    : ''
  const removal = node.id === 'FV:2' ? 'remove' : node.id === 'SQ:' ? 'deletePlaylist' : /^SQ:\d/.test(node.id || '') ? 'removeFromPlaylist' : null
  // A track dragged within a Sonos Playlist's page moves there.
  const [plDrag, setPlDrag] = useState(null)
  const [plDrop, setPlDrop] = useState(null)
  const reorderable = /^SQ:\d+$/.test(node.id || '') && !searching
  const reorderFor = (index, count) => (reorderable ? {
    mark: plDrag != null && plDrop === index ? 'before' : plDrag != null && plDrop === count && index === count - 1 ? 'after' : '',
    onStart: (event) => { event.dataTransfer.setData('text/plain', ''); event.dataTransfer.effectAllowed = 'move'; setPlDrag(index); setPlDrop(null) },
    onOver: (event) => {
      if (plDrag == null) return
      event.preventDefault()
      const box = rectOf(event.currentTarget)
      setPlDrop(pt(event.clientY) < box.top + box.height / 2 ? index : index + 1)
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
  const back = () => { if (stack.length > 1) setStack(stack.slice(0, -1)) }
  // The path, as a terminal would print it: the system as the drive, each level a folder.
  const drive = stack[1]?.gen || node.gen || activeGen || ''
  const sourceRows = sections.flatMap((s) => s.rows.map((row) => ({ ...row, header: s.header, otherSystem: s.otherSystem })))

  return (
    <div className="sv-library" ref={top}>
      <div className="sv-library-head">
        <Prompt ref={searchRef} value={term} onChange={setTerm} label={t('common.search')} prompt={t('sv.findPrompt')}
                placeholder={scope && !scope.all ? t('desk.search.in', { service: scope.name }) : t('common.search')}
                onKeyDown={(event) => { if (event.key === 'Escape' && term) { event.stopPropagation(); setTerm('') } }}
                trailing={(
                  <>
                    {term && <IconBtn size="s" label={t('common.close')} onClick={() => setTerm('')}><G.Close size={12} /></IconBtn>}
                    {scope && (
                      <button type="button" className="sv-scope" title={t('desk.search.scope')} aria-label={t('desk.search.scope')} aria-haspopup="menu"
                              onClick={(event) => setScopeMenu(event.currentTarget)}>
                        {scope.icon ? <SvcImg src={scope.icon} /> : <G.Search size={12} />}
                        <span>{scope.all ? t('sv.all') : scope.name}</span>
                        <G.Down size={12} />
                      </button>
                    )}
                  </>
                )} />
        <div className="sv-library-context">
          {roomOptions.length > 1 ? (
            <Btn size="s" variant="text" icon={<G.Speaker size={12} />} title={t('sv.activeRoom')}
                 onClick={(event) => setRoomMenu(event.currentTarget)} trailing={<G.Down size={12} />}>
              {activeRoomName ? t('sv.playsIn', { room: activeRoomName }) : t('sv.chooseRoom')}
            </Btn>
          ) : activeRoomName && (
            <span className="sv-library-room" title={t('sv.activeRoom')}><G.Speaker size={12} />{t('sv.playsIn', { room: activeRoomName })}</span>
          )}
          {atRoot && <SystemPicker households={households} value={systemFilter} onChange={onSystem} />}
        </div>
      </div>

      {!atRoot && !searching && (
        <nav className="sv-path" aria-label={t('sv.path')}>
          <button type="button" className="sv-path-part" onClick={() => setStack([ROOT])}>{drive ? `${drive}:` : t('sv.index')}</button>
          {stack.slice(1).map((entry, i) => (
            <React.Fragment key={`${entry.id}-${i}`}>
              <span className="sv-path-sep" aria-hidden="true">\</span>
              {i === stack.length - 2
                ? <span className="sv-path-part" aria-current="page">{entry.title}</span>
                : <button type="button" className="sv-path-part" onClick={() => setStack(stack.slice(0, i + 2))}>{entry.title}</button>}
            </React.Fragment>
          ))}
          <span className="sv-grow" />
          <IconBtn size="s" label={t('sv.sources')} onClick={(event) => setSourceMenu(event.currentTarget)}><G.Folder size={24} /></IconBtn>
          <IconBtn size="s" label={t('sv.view')} onClick={(event) => setViewMenu(event.currentTarget)}>
            {view === 'grid' ? <G.ViewGrid size={24} /> : view === 'list' ? <G.ViewList size={24} /> : <G.ViewAuto size={24} />}
          </IconBtn>
        </nav>
      )}

      <div className="sv-library-body" key={`${stack.length}:${node.id}`}>
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
          <>
            {activeZone && (
              <Shelves activeZone={activeZone} favorites={favorites} playlists={playlists} recent={recent} onPlayItem={onPlayItem}
                       onOpenFavorite={onOpenFavorite} onItemMenu={onItemMenu}
                       onViewAll={(id) => { const row = sourceRows.find((r) => r.id === id && r.hh === activeHousehold) || sourceRows.find((r) => r.id === id); if (row) openRoot(row, true) }} />
            )}
            <Directory sections={sections} t={t} opened={openedOther} onFold={toggleOther} addHouseholdId={addHouseholdId}
                       onOpen={(row, event) => openRoot(row, false, event)}
                       onAdd={(section) => push({ id: '__addsvc', virtual: 'addServices', title: t('desk.browse.addServicesFor', { gen: section.household.generation }), glyph: 'plus', hh: section.household.id, hzone: section.hzone, gen: section.household.generation })}
                       onAccounts={(row, event) => { event.preventDefault(); event.stopPropagation(); setAccountMenu({ row, anchor: event.currentTarget, x: pt(event.clientX), y: pt(event.clientY) }) }} />
          </>
        ) : node.virtual === 'lineIn' ? (
          <LineInPage node={node} zones={zones} households={households} t={t} onBack={back}
                      onPlay={(zone) => actions.setSource(zone.uuid, { uri: `x-rincon-stream:${zone.uuid}`, metadata: '' })} />
        ) : node.virtual === 'addServices' ? (
          <AddServicesPage node={node} servicesRaw={servicesRaw} t={t} onPick={onLinkService} />
        ) : node.virtual === 'changeLocation' ? (
          <div className="sv-listing">
            <UpRow onBack={back} t={t} />
            <Row lead={<G.Pin size={24} />} title={t('desk.radio.enterZip')} onClick={() => setNaming({ kind: 'zip' })} />
            <Row lead={<G.Folder size={24} />} title={t('desk.radio.pickCity')} trail={<span className="sv-dirtag">{t('sv.dir')}</span>}
                 onClick={() => push({ id: 'r0', item: 'r0', service: node.service, title: t('desk.radio.pickCity'), hzone: node.hzone, hh: node.hh, gen: node.gen, icon: node.icon, pickCity: true, serviceName: node.serviceName })} />
          </div>
        ) : (
          <>
            <PageHead node={node} caution={caution} liveAccount={liveAccount} page={page} t={t} onLinkService={onLinkService}
                      isCollection={isCollection} onPlay={() => playAlbum(false)} onShuffle={() => playAlbum(true)} onAct={(how) => act(albumItem(), how)}
                      onMenu={(event) => openMenu(albumItem(), event)} count={items.length} />
            {page.error && <p className="sv-error">{page.error}</p>}
            {page.loading && <Busy label={t('desk.browse.loading')} />}
            {!page.loading && !page.error && !page.needsLink && items.length === 0 && node.service !== 254 && (
              <Empty icon={<G.Folder size={48} />} title={t('desk.browse.empty')} />
            )}
            {node.service === 254 && node.item === 'root' && !page.loading && (
              <div className="sv-pins">
                {[['R:0/0', t('desk.radio.myStations'), 'station', false],
                  ['R:0/1', t('desk.radio.myShows'), 'show', false],
                  [radioLocation.node || 'local', radioLocation.city ? t('desk.radio.localRadioIn', { city: radioLocation.city }) : t('desk.radio.localRadio'), 'local', true]].map(([id, title, icon, viaService]) => (
                  <Btn key={id} size="s" icon={<SvcImg src={`${TUNEIN_ICONS}/${icon}_legacy.png`} className="sv-btn-img" />}
                       onClick={() => push(viaService
                         ? { id, title, item: id, service: node.service, hzone: node.hzone, hh: node.hh, gen: node.gen, icon: node.icon, serviceName: node.serviceName, localRadio: true }
                         : { id, title, item: 'root', hzone: node.hzone, hh: node.hh, gen: node.gen, icon: node.icon, glyph: 'tunein' })}>{title}</Btn>
                ))}
              </div>
            )}
            {shelves.map((shelf, si) => (
              <section key={`${shelf.id}-${si}`} className="sv-shelf" aria-label={shelf.title}>
                <header className="sv-shelf-head">
                  <h2 className="sv-rule-head">{shelf.title}</h2>
                  {shelf.id && <Btn variant="text" size="s" trailing={<G.Chevron size={12} />} onClick={() => browseInto(shelf, { preset: shelf.children })}>{t('common.viewAll')}</Btn>}
                </header>
                <div className="sv-strip">
                  {shelf.children.map((item, index) => (
                    <ItemCard key={`${item.id}-${index}`} item={item} node={node} t={t} displayTypes={page.displayTypes}
                              onOpen={(event) => open({ ...item, ...rowExtras(item, index) }, event)}
                              onPlay={item.uri ? () => act({ ...item, ...rowExtras(item, index) }, 'now') : null}
                              onMenu={(event) => openMenu(item, event, rowExtras(item, index))} />
                  ))}
                </div>
              </section>
            ))}
            {shelves.length > 0 && loose.length === 0 ? null : grid ? (
              <>
                <div className="sv-listing"><UpRow onBack={back} t={t} /></div>
                <div className="sv-grid">
                  {loose.map((item, index) => (
                    <ItemCard key={`${item.id}-${index}`} item={item} node={node} t={t} displayTypes={page.displayTypes}
                              onDelete={removal ? () => act({ ...item, ...rowExtras(item, index) }, removal) : undefined}
                              onOpen={(event) => open({ ...item, ...rowExtras(item, index) }, event)} onPlay={item.uri ? () => act({ ...item, ...rowExtras(item, index) }, 'now') : null}
                              onMenu={(event) => openMenu(item, event, rowExtras(item, index))} />
                  ))}
                </div>
              </>
            ) : (
              <div className="sv-listing">
                <UpRow onBack={back} t={t} />
                {loose.map((item, index) => (
                  <ItemRow key={`${item.id}-${index}`} item={item} node={node} t={t} displayTypes={page.displayTypes}
                           onDelete={removal ? () => act({ ...item, ...rowExtras(item, index) }, removal) : undefined}
                           place={node.pickCity && peek[item.id] === 'final'} number={isCollection && node.kind === 'album' && !item.is_container ? index + 1 : 0}
                           checked={checked.has(item.id)} onCheck={() => toggleCheck(item.id)} selected={menu?.item?.id === item.id}
                           reorder={reorderFor(index, loose.length)}
                           onOpen={(event) => open({ ...item, ...rowExtras(item, index) }, event)}
                           onPlay={item.uri ? () => act({ ...item, ...rowExtras(item, index) }, 'now') : null}
                           onMenu={(event) => openMenu(item, event, rowExtras(item, index))} />
                ))}
              </div>
            )}
            {node.id === 'R:0/0' && !page.loading && <div className="sv-pagefoot"><Btn icon={<G.Plus size={12} />} onClick={onAddRadio}>{t('desk.radio.addNew')}</Btn></div>}
            {node.id === 'SQ:' && !page.loading && <div className="sv-pagefoot"><Btn icon={<G.Plus size={12} />} onClick={() => setNaming({ kind: 'newPlaylist' })}>{t('desk.playlists.new')}</Btn></div>}
            {node.localRadio && !page.loading && (
              <div className="sv-pagefoot"><Btn icon={<G.Pin size={12} />} onClick={() => push({ id: '__changeloc', virtual: 'changeLocation', title: t('desk.radio.changeLocation'), service: node.service, hzone: node.hzone, hh: node.hh, gen: node.gen, icon: node.icon, serviceName: node.serviceName })}>{t('desk.radio.changeLocation')}</Btn></div>
            )}
          </>
        )}
      </div>

      {checked.size > 0 && (
        <div className="sv-selectbar" role="toolbar" aria-label={t('sv.selected', { count: checked.size })}>
          <span>{t('sv.selected', { count: checked.size })}</span>
          <Btn variant="solid" size="s" icon={<G.Play size={12} />} onClick={() => act(items.find((i) => checked.has(i.id)), 'now')}>{t('desk.actions.playNow')}</Btn>
          <Btn size="s" icon={<G.Next size={12} />} onClick={() => act(items.find((i) => checked.has(i.id)), 'next')}>{t('desk.actions.playNext')}</Btn>
          <Btn size="s" icon={<G.Queue size={12} />} onClick={() => act(items.find((i) => checked.has(i.id)), 'add')}>{t('desk.actions.addToQueue')}</Btn>
          <Btn size="s" icon={<G.Playlist size={12} />} onClick={() => act(items.find((i) => checked.has(i.id)), 'addToPlaylist')}>{t('desk.favorites.addToSonosPlaylist')}</Btn>
          <Btn size="s" variant="text" onClick={() => setChecked(new Set())}>{t('desk.actions.unselectAll')}</Btn>
        </div>
      )}

      {viewMenu && (
        <Menu anchor={viewMenu} align="right" onClose={() => setViewMenu(null)} title={t('sv.view')}>
          {[['auto', 'sv.viewAuto', <G.ViewAuto key="a" size={12} />], ['grid', 'sv.viewGrid', <G.ViewGrid key="g" size={12} />], ['list', 'sv.viewList', <G.ViewList key="l" size={12} />]].map(([id, key, icon]) => (
            <MenuItem key={id} icon={icon} checked={view === id} onSelect={() => { setView(id); setViewMenu(null) }}>{t(key)}</MenuItem>
          ))}
        </Menu>
      )}
      {sourceMenu && (
        <Menu anchor={sourceMenu} align="right" onClose={() => setSourceMenu(null)} title={t('sv.sources')}>
          <div className="sv-menu-scroll">
            {sourceRows.filter((row) => !row.disabled && !row.playable && row.id !== 'update').map((row) => {
              const Glyph = GLYPHS[row.glyph] || G.Note
              return (
                <MenuItem key={`${row.hh}-${row.id}`} icon={row.icon ? <SvcImg src={row.icon} className="sv-menu-img" /> : <Glyph size={12} />}
                          checked={stack[1]?.id === row.id && stack[1]?.hh === row.hh ? true : null}
                          onSelect={() => { setSourceMenu(null); openRoot(row) }}>
                  {row.title}{row.header ? ` · ${row.header}` : ''}
                </MenuItem>
              )
            })}
          </div>
        </Menu>
      )}
      {roomMenu && (
        <Menu anchor={roomMenu} onClose={() => setRoomMenu(null)} title={t('desk.rooms.title')}>
          {roomOptions.map((group) => (
            <MenuItem key={group.coordinator} checked={group.coordinator === activeZone?.uuid}
                      onSelect={() => { onSelectRoom?.(group.coordinator); setRoomMenu(null) }}>{groupName(group, zones)}</MenuItem>
          ))}
        </Menu>
      )}
      {scopeMenu && (
        <Menu anchor={scopeMenu} align="right" onClose={() => setScopeMenu(null)} title={t('desk.search.scope')}>
          <div className="sv-menu-scroll">
            {scopes.map((s) => (
              <MenuItem key={s.key} checked={scope?.key === s.key} icon={s.icon ? <SvcImg src={s.icon} className="sv-menu-img" /> : <G.Search size={12} />}
                        onSelect={() => { setScope(s); setScopeMenu(null); searchRef.current?.focus() }}>
                {s.all ? s.name : <>{(s.accounts > 1 || scopes.filter((o) => o.id === s.id).length > 1) && s.nickname ? `${s.name} (${s.nickname})` : s.name}{scopes.some((o) => !o.all && o.hh !== s.hh) ? ` · ${s.gen}` : ''}</>}
              </MenuItem>
            ))}
          </div>
        </Menu>
      )}
      {accountMenu && (
        <Menu anchor={accountMenu.anchor} x={accountMenu.x} y={accountMenu.y} align="right" onClose={() => setAccountMenu(null)} title={accountMenu.row.title}>
          {[...accountMenu.row.accounts].sort((a, b) => (a.nickname || '').localeCompare(b.nickname || '', undefined, { sensitivity: 'base' })).map((account) => (
            <MenuItem key={`${account.account_id ?? ''}`} icon={<G.Person size={12} />} checked={(account.account_id ?? '') === accountMenu.row.account}
                      onSelect={() => { pickAccount(`${accountMenu.row.hh}:${accountMenu.row.service}`, account.account_id ?? ''); setAccountMenu(null) }}>
              {account.nickname || accountMenu.row.title}
            </MenuItem>
          ))}
        </Menu>
      )}
      {menu && <ActionMenu item={menu.item} x={menu.x} y={menu.y} anchor={menu.anchor} onClose={() => setMenu(null)} onAct={(how) => act(menu.item, how)}
                           canUnselect={checked.size > 0} saved={savedFavorite} t={t} />}
      {addTo && <AddToPlaylistWindow picks={addTo.picks} source={addTo.source} hzone={addTo.hzone} onClose={() => setAddTo(null)} onMessage={onMessage} />}
      {naming?.kind === 'favorite' && (
        <Confirm title={t('desk.favorites.rename')} body={t('desk.favorites.renameBody')} action={t('common.ok')} icon={<G.Edit size={48} />}
                 input={{ initial: naming.item.title || '', label: t('desk.favorites.rename') }} onClose={() => setNaming(null)}
                 onConfirm={async (title) => { const target = naming.item; setNaming(null); const done = await actions.renameFavorite(target.hzone || node.hzone, target.id, target.title, title); if (done) { setRefresh((v) => v + 1); onFavoritesChanged?.() } }} />
      )}
      {(naming?.kind === 'playlist' || naming?.kind === 'newPlaylist') && (
        <Confirm title={naming.kind === 'newPlaylist' ? t('desk.playlists.nameTitle') : t('desk.playlists.rename')} icon={<G.Playlist size={48} />}
                 body={naming.kind === 'newPlaylist' ? t('desk.playlists.nameBody') : t('desk.playlists.renameBody')} action={t('common.ok')}
                 input={{ initial: naming.kind === 'newPlaylist' ? '' : naming.item.title, label: t('desk.playlists.nameTitle') }} onClose={() => setNaming(null)}
                 onConfirm={async (title) => {
                   const target = naming; setNaming(null)
                   const done = target.kind === 'newPlaylist' ? await actions.createPlaylist(node.hzone, title) : await actions.renamePlaylist(target.item.hzone || node.hzone, target.item.id, target.item.title, title)
                   if (done) setRefresh((v) => v + 1)
                 }} />
      )}
      {naming?.kind === 'zip' && (
        <Confirm title={t('desk.radio.enterZip')} body={t('desk.radio.zipBody')} action={t('common.ok')} icon={<G.Pin size={48} />} input={{ initial: '', label: t('desk.radio.enterZip') }} onClose={() => setNaming(null)}
                 onConfirm={async (zip) => {
                   setNaming(null)
                   const place = zip.replace(/\s+/g, '')
                   let city = ''
                   try { const found = await api.serviceItem(node.service, `z${place}`, node.hzone); city = String(found?.title || '').split(',')[0].trim() } catch { city = '' }
                   const done = await actions.setRadioLocation(node.hzone, `z${place}`, city)
                   if (done) {
                     setLocationEpoch((v) => v + 1)
                     onMessage?.(t('desk.radio.locationSet', { city: done.city || place }))
                     const backTo = stack.findIndex((entry) => entry.localRadio)
                     if (backTo >= 0) setStack([...stack.slice(0, backTo), { ...stack[backTo], id: `z${place}`, item: `z${place}`, title: done.city ? t('desk.radio.localRadioIn', { city: done.city }) : t('desk.radio.localRadio') }])
                     else setStack(stack.slice(0, 1))
                   }
                 }} />
      )}
      {updateAsk && (
        <Confirm title={t('desk.update.title')} body={updateBody(t, households, updateAsk.hh, updateAsk.version)} icon={<G.Update size={48} />}
                 action={t('desk.update.start')} cancelLabel={t('desk.update.notNow')} onClose={() => setUpdateAsk(null)}
                 onConfirm={async () => {
                   const ask = updateAsk
                   setUpdateAsk(null)
                   const done = await api.startSoftwareUpdate(ask.hh).catch(() => null)
                   if (done?.started?.length) { onMessage?.(t('desk.update.started')); speakerUpdates.clear(ask.hh) }
                 }} />
      )}
      {replaceAsk && (
        <Confirm title={t('desk.queue.editedTitle')} body={t('desk.queue.editedBody')} action={t('desk.queue.playAnyway')} icon={<G.Queue size={48} />} onClose={() => setReplaceAsk(null)}
                 onConfirm={() => { const ask = replaceAsk; setReplaceAsk(null); playAlbum(ask.shuffle, true) }} />
      )}
    </div>
  )
}

// The ".." row: one level up, as a directory listing has it.
function UpRow({ onBack, t }) {
  return (
    <button type="button" className="sv-row sv-row-up" onClick={onBack} title={t('common.back')}>
      <span className="sv-row-art"><G.Back size={24} /></span>
      <span className="sv-row-text"><span className="sv-row-title">..</span></span>
      <span className="sv-dirtag">{t('sv.dir')}</span>
    </button>
  )
}

// The index's shelves: what the room played lately, the Sonos Favorites and the Sonos
// Playlists, each a press from playing.
function Shelves({ activeZone, favorites, playlists, recent, onPlayItem, onOpenFavorite, onItemMenu, onViewAll }) {
  const { t } = useI18n()
  return (
    <>
      {recent?.items?.length > 0 && (
        <section className="sv-shelf" aria-label={t('sv.recent')}>
          <header className="sv-shelf-head">
            <h2 className="sv-rule-head">{t('sv.recent')}<small>{t('sv.forRoom', { room: activeZone.name })}</small></h2>
          </header>
          <div className="sv-strip">
            {recent.items.slice(0, 24).map((item) => (
              <Tile key={item.id} item={item} onPlay={(it) => onPlayItem(it, 'recent')} onMenu={(it, event) => onItemMenu(it, 'recent', event)} />
            ))}
          </div>
        </section>
      )}
      <section className="sv-shelf" aria-label={t('desk.browse.favorites')}>
        <header className="sv-shelf-head">
          <h2 className="sv-rule-head">{t('desk.browse.favorites')}<small>{t('sv.forRoom', { room: activeZone.name })}</small></h2>
          <Btn variant="text" size="s" trailing={<G.Chevron size={12} />} onClick={() => onViewAll('FV:2')}>{t('common.viewAll')}</Btn>
        </header>
        {favorites.loaded && favorites.items.length === 0 ? <p className="sv-dim">{t('sv.favoritesEmpty')}</p> : (
          <div className="sv-strip">
            {favorites.items.slice(0, 24).map((item) => (
              <Tile key={item.id} item={item} kind="favorite" onPlay={(it) => onPlayItem(it, 'FV:2')} onOpen={onOpenFavorite}
                    onMenu={(it, event) => onItemMenu(it, 'FV:2', event)} />
            ))}
          </div>
        )}
      </section>
      <section className="sv-shelf" aria-label={t('desk.browse.playlists')}>
        <header className="sv-shelf-head">
          <h2 className="sv-rule-head">{t('desk.browse.playlists')}</h2>
          <Btn variant="text" size="s" trailing={<G.Chevron size={12} />} onClick={() => onViewAll('SQ:')}>{t('common.viewAll')}</Btn>
        </header>
        {playlists.loaded && playlists.items.length === 0 ? <p className="sv-dim">{t('sv.playlistsEmpty')}</p> : (
          <div className="sv-listing sv-listing-cols">
            {playlists.items.slice(0, 8).map((item) => (
              <button key={item.id} type="button" className="sv-row" data-item onClick={() => onPlayItem(item, 'SQ:')}
                      onContextMenu={(event) => { event.preventDefault(); onItemMenu(item, 'SQ:', event) }}>
                <span className="sv-row-art"><G.Playlist size={24} /></span>
                <span className="sv-row-text"><span className="sv-row-title">{item.title}</span></span>
                <span className="sv-row-play" aria-hidden="true"><G.Play size={24} /></span>
              </button>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

// One cover on a shelf: the art, the title and a line under it.
function Tile({ item, kind = '', onPlay, onOpen = null, onMenu }) {
  const { t } = useI18n()
  const unavailable = item.available === false
  const opens = kind === 'favorite' && item.browse_id && item.service_id && !unavailable && onOpen
  return (
    <div className="sv-tile" role="button" tabIndex={0} aria-disabled={unavailable || undefined} title={item.title} data-item
         onClick={() => (unavailable ? null : onPlay(item))}
         onKeyDown={(event) => { if (event.key === 'Enter' && !unavailable) onPlay(item) }}
         onContextMenu={(event) => { event.preventDefault(); onMenu(item, event) }}>
      <span className="sv-art sv-tile-art">
        {unavailable ? <G.Warning size={48} /> : <Art src={item.art} size={180} fallback={genericArt(item)} brokenFallback={genericArt(item)} />}
        <span className="sv-tile-play" aria-hidden="true"><G.Play size={24} /></span>
      </span>
      <span className="sv-tile-title">{item.title}</span>
      <span className="sv-tile-sub">{item.description || item.service_name || ''}</span>
      <span className="sv-tile-tools" onClick={(event) => event.stopPropagation()}>
        {opens && <IconBtn size="s" label={t('sv.open')} onClick={() => onOpen(item)}><G.Folder size={12} /></IconBtn>}
        <IconBtn size="s" label={t('desk.browse.actions')} onClick={(event) => onMenu(item, event)}><G.More size={12} /></IconBtn>
      </span>
    </div>
  )
}

// The sources, one directory per system. A system whose rooms are not the one in view folds
// away until opened.
function Directory({ sections, onOpen, onAccounts, onAdd, opened, onFold, addHouseholdId, t }) {
  return (
    <section className="sv-dir" aria-label={t('sv.sources')}>
      <h2 className="sv-rule-head">{t('sv.sources')}</h2>
      {sections.map((section) => {
        const shut = section.otherSystem && !opened.has(section.household.id)
        return (
          <div key={section.household.id} className="sv-dir-system" data-dim={section.otherSystem || undefined}>
            {section.header && (
              <button type="button" className="sv-dir-drive" aria-expanded={!shut} disabled={!section.otherSystem} onClick={() => onFold(section.household.id)}>
                <span>{`${section.header}:\\`}</span>
                {section.otherSystem && <span className="sv-dim">{t('sv.otherSystem', { gen: section.header })}</span>}
                {section.otherSystem && (shut ? <G.ChevronDown size={12} /> : <G.ChevronUp size={12} />)}
              </button>
            )}
            {!shut && (
              <div className="sv-listing sv-listing-cols">
                {section.rows.map((row) => {
                  const Glyph = GLYPHS[row.glyph] || G.Note
                  return (
                    <div key={row.id} className="sv-row sv-source" role="button" tabIndex={row.disabled ? -1 : 0} aria-disabled={row.disabled || undefined} data-item
                         title={row.disabled ? t('sv.otherSystem', { gen: row.gen }) : row.title}
                         onClick={(event) => onOpen(row, event)} onKeyDown={(event) => { if (event.key === 'Enter') onOpen(row, event) }}
                         onContextMenu={row.disabled ? undefined : row.playable ? (event) => onOpen(row, event) : row.accounts ? (event) => onAccounts(row, event) : undefined}>
                      <span className="sv-row-art sv-caution-anchor">
                        <span className="sv-source-icon">{row.icon ? <SvcImg src={row.icon} /> : <Glyph size={24} />}</span>
                        {row.caution && <CautionBadge kind={row.caution} title={t(`services.caution.${row.caution}`, { gen: row.gen ?? 'S1' })} />}
                      </span>
                      <span className="sv-row-text">
                        <span className="sv-row-title">{row.title}</span>
                        {(row.sub || row.version) && <span className="sv-row-sub">{row.sub || row.version}</span>}
                      </span>
                      {row.accounts && !row.disabled && (
                        <span className="sv-row-tools" onClick={(event) => event.stopPropagation()}>
                          <IconBtn size="s" label={t('desk.browse.switchAccount')} onClick={(event) => onAccounts(row, event)}><G.Person size={12} /></IconBtn>
                        </span>
                      )}
                      <span className="sv-dirtag">{row.playable ? '' : row.id === 'update' ? '' : t('sv.dir')}</span>
                    </div>
                  )
                })}
                {addHouseholdId === section.household.id && (
                  <button type="button" className="sv-row sv-source" onClick={() => onAdd(section)}>
                    <span className="sv-row-art"><G.Plus size={24} /></span>
                    <span className="sv-row-text"><span className="sv-row-title">{t('desk.browse.addServices')}</span></span>
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}

function PageHead({ node, caution, liveAccount, page, t, onLinkService, isCollection, onPlay, onShuffle, onAct, onMenu, count }) {
  const [more, setMore] = useState(null)
  return (
    <>
      {isCollection && (
        <header className="sv-collection">
          <span className="sv-art sv-collection-art"><Art src={node.art} size={200} fallback={node.kind === 'album' ? 'disc' : 'playlist'} /></span>
          <div className="sv-collection-text">
            <p className="sv-over">{t(node.kind === 'album' ? 'common.kind.album' : 'common.kind.playlist')}</p>
            <h1 className="sv-title">{node.title}</h1>
            <p className="sv-dim">{[node.artist, t.plural('common.tracks', count)].filter(Boolean).join(' · ')}</p>
            <div className="sv-btnrow">
              <Btn variant="solid" icon={<G.Play size={12} />} onClick={onPlay}>{t('common.play')}</Btn>
              <Btn icon={<G.Shuffle size={12} />} onClick={onShuffle}>{t('common.shuffle')}</Btn>
              <Btn trailing={<G.Down size={12} />} aria-haspopup="menu" onClick={(event) => setMore(more ? null : event.currentTarget)}>{t('sv.more')}</Btn>
              <IconBtn label={t('desk.browse.actions')} onClick={onMenu}><G.More size={24} /></IconBtn>
            </div>
          </div>
          {more && (
            <Menu anchor={more} onClose={() => setMore(null)}>
              <MenuItem icon={<G.Next size={12} />} onSelect={() => { setMore(null); onAct('next') }}>{t('desk.actions.playNext')}</MenuItem>
              <MenuItem icon={<G.Queue size={12} />} onSelect={() => { setMore(null); onAct('add') }}>{t('desk.actions.addToQueue')}</MenuItem>
              <MenuItem icon={<G.Refresh size={12} />} onSelect={() => { setMore(null); onAct('replace') }}>{t('desk.actions.replaceQueue')}</MenuItem>
            </Menu>
          )}
        </header>
      )}
      {page.needsLink && (
        <div className="sv-banner">
          <CautionBadge kind="sonos" size="large" logo={node} title={t('services.caution.sonos', { gen: node.gen ?? 'S1' })} />
          <div>
            <strong>{t('services.needsSonora.title')}</strong>
            <p>{t('desk.browse.needsLink.body', { service: node.serviceName || node.title, gen: node.gen ?? 'S1' })}</p>
            <Btn variant="solid" size="s" icon={<G.Link size={12} />} onClick={() => onLinkService?.({ sid: node.service, householdId: node.hh, name: node.serviceName || node.title, account: liveAccount })}>
              {t('desk.browse.needsLink.action', { service: node.serviceName || node.title })}
            </Btn>
          </div>
        </div>
      )}
      {!page.loading && !page.error && caution === 'sonora' && node.item === 'root' && (
        <div className="sv-banner">
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

// The service's DisplayType decides what a row says beyond its title: its Lines name the
// fields. A row naming no display type shows its title alone whatever summary it carries. A
// container whose type has lines but no DisplayMode reads them on one line; a playable row
// reads them under the title. Tracks and albums keep the artist line without any map.
function linesOf(item, displayTypes) {
  const declared = displayTypes?.[item.display_type || item.item_type || ''] || null
  const typed = declared && (!declared.mode || ['LIST', 'EDITORIAL'].includes(declared.mode)) ? declared : null
  if (!typed) return null
  const lineOf = (token) => (token === 'title' ? item.title
    : token === 'artist' ? (item.artist || item.author || '')
    : token === 'album' ? (item.album || '')
    : token === 'summary' ? (item.summary || '') : '')
  const second = (typed.lines || []).slice(1).map(lineOf).filter(Boolean).join(' · ')
  return { second, inline: Boolean(second) && !item.can_play && !typed.mode }
}

function subtitleOf(item, node, t, displayTypes = {}) {
  if (item.kind === 'favorite') return item.description || ''
  const parentLines = displayTypes?.[node?.displayType || '']?.lines
  const pageDropsArtist = node?.kind === 'artist' || (Array.isArray(parentLines) && !parentLines.includes('artist'))
  if (pageDropsArtist && (item.item_type || item.kind) === 'album') return ''
  // A track on such a page reads by its title alone too: Plex's copies of a song, each an
  // artist-typed "Music / on <server>" container, show it so in both S1 apps.
  if ((node?.kind === 'artist' || (Array.isArray(parentLines) && parentLines.length > 0 && !parentLines.includes('artist')))
    && !item.is_container && (item.item_type || 'track') === 'track') return ''
  const typed = linesOf(item, displayTypes)
  if (typed) return typed.inline ? '' : typed.second
  if (/^episode\./.test(item.semantic_type || '') && item.release_date) {
    const when = new Date(item.release_date)
    if (!Number.isNaN(when.getTime())) return when.toLocaleDateString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric' })
  }
  const container = item.is_container && !isPlayableLeaf(item)
  return ((!container || ['album', 'playlist'].includes(item.item_type || item.kind)) && [item.artist || item.author, item.album].filter(Boolean).join(' · '))
    || (item.child_count ? t.plural('common.items', item.child_count) : '')
}

function ItemRow({ item, node, t, displayTypes = {}, place = false, onDelete, number = 0, checked, onCheck, selected, onOpen, onPlay, onMenu, reorder = null }) {
  const favorite = item.kind === 'favorite'
  const unavailable = favorite && item.available === false
  const container = item.is_container && !isPlayableLeaf(item)
  const dead = !favorite && item.is_container && item.can_enumerate === false && !item.can_play && item.origin !== 'browse'
  const restricted = !favorite && !item.is_container && item.can_play === false
  const opens = ((container && !dead) || (favorite && Boolean(item.browse_id) && !unavailable)) && !place
  const radio = node.id === 'R:0/0' || node.id === 'R:0/1'
  const playlist = node.id === 'SQ:'
  const sub = number ? '' : subtitleOf(item, node, t, displayTypes)
  const typed = number ? null : linesOf(item, displayTypes)
  const titleText = typed?.inline ? `${item.title} / ${typed.second}` : item.title
  const selectable = item.uri && !unavailable && !favorite && item.item_type !== 'audiobook' && isQueueable(item)
  const duration = typeof item.duration === 'string' && item.duration && item.duration !== '0:00:00' ? item.duration.replace(/^0:0?/, '') : ''
  return (
    <div className="sv-row" data-item role="button" tabIndex={0} data-selected={selected || undefined} data-checked={checked || undefined}
         data-restricted={restricted || undefined} data-dead={dead || undefined}
         draggable={Boolean(reorder) || undefined} onDragStart={reorder?.onStart} onDragOver={reorder?.onOver}
         onDrop={reorder?.onDrop} onDragEnd={reorder?.onEnd} data-drop={reorder?.mark || undefined}
         aria-disabled={unavailable || dead || restricted || undefined} title={item.stream_show || (!item.is_container && item.album) || undefined}
         onClick={dead ? undefined : (event) => onOpen(event)} onDoubleClick={dead ? undefined : (onPlay || undefined)}
         onKeyDown={(event) => {
           if (event.key === 'Enter') onOpen(event)
           else if ((event.key === 'Delete' || event.key === 'Backspace') && onDelete) { event.preventDefault(); onDelete() }
         }}
         onContextMenu={(event) => { event.preventDefault(); onMenu(event) }}>
      <span className={cx('sv-row-art', item.item_type === 'artist' && 'sv-row-art-round')}>
        {number ? <span className="sv-row-num">{String(number).padStart(2, '0')}</span>
          : restricted ? <G.Prohibit size={24} role="img" aria-label={t('common.restricted')} />
          : unavailable ? <G.Warning size={24} />
          : (favorite && !item.uri && !item.art) ? <G.Folder size={24} />
          : radio && !item.art ? <G.Radio size={24} />
          : playlist ? <G.Playlist size={24} />
          : <span className="sv-art"><Art src={item.art} size={36} fallback={genericArt(item)} /></span>}
        {onPlay && !opens && !unavailable && (
          <button type="button" className="sv-row-play" title={t('desk.actions.playNow')} aria-label={t('desk.actions.playNow')} onClick={(event) => { event.stopPropagation(); onPlay() }}><G.Play size={24} /></button>
        )}
      </span>
      <span className="sv-row-text">
        <span className="sv-row-title">
          <span>{titleText}</span>
          {item.explicit && <G.Explicit size={12} className="sv-explicit" role="img" aria-label={t('common.explicit')} />}
        </span>
        {sub && <span className="sv-row-sub">{sub}</span>}
      </span>
      <span className="sv-row-tools" onClick={(event) => event.stopPropagation()}>
        {selectable && onCheck && <Tick checked={checked} onChange={onCheck} label={t('desk.browse.select')} />}
        <IconBtn size="s" label={t('desk.browse.actions')} onClick={onMenu}><G.More size={24} /></IconBtn>
      </span>
      <span className="sv-dirtag">{opens ? t('sv.dir') : duration}</span>
    </div>
  )
}

function ItemCard({ item, node, t, displayTypes = {}, onOpen, onPlay, onMenu, onDelete }) {
  const container = item.is_container && !isPlayableLeaf(item)
  const favorite = item.kind === 'favorite'
  const unavailable = favorite && item.available === false
  const sub = subtitleOf(item, node, t, displayTypes)
  const typed = linesOf(item, displayTypes)
  const titleText = typed?.inline ? `${item.title} / ${typed.second}` : item.title
  const dead = !favorite && item.is_container && item.can_enumerate === false && !item.can_play && item.origin !== 'browse'
  return (
    <div className="sv-tile" data-item role="button" tabIndex={dead ? -1 : 0} aria-disabled={unavailable || dead || undefined} title={titleText}
         data-dead={dead || undefined}
         onClick={dead ? undefined : (event) => onOpen(event)} onDoubleClick={dead ? undefined : (onPlay || undefined)}
         onKeyDown={(event) => {
           if (event.key === 'Enter' && !dead) onOpen(event)
           else if ((event.key === 'Delete' || event.key === 'Backspace') && onDelete) { event.preventDefault(); onDelete() }
         }}
         onContextMenu={(event) => { event.preventDefault(); onMenu(event) }}>
      <span className="sv-art sv-tile-art" data-round={item.item_type === 'artist' || undefined}>
        {unavailable ? <G.Warning size={48} /> : <Art src={item.art} size={180} fallback={genericArt(item)} />}
        {onPlay && <button type="button" className="sv-tile-play sv-tile-play-btn" title={t('desk.actions.playNow')} aria-label={t('desk.actions.playNow')} onClick={(event) => { event.stopPropagation(); onPlay() }}><G.Play size={24} /></button>}
      </span>
      <span className="sv-tile-title">{titleText}{item.explicit && <G.Explicit size={12} className="sv-explicit" role="img" aria-label={t('common.explicit')} />}</span>
      {sub && <span className="sv-tile-sub">{sub}</span>}
      <span className="sv-tile-tools" onClick={(event) => event.stopPropagation()}>
        {container && !dead && <span className="sv-dirtag">{t('sv.dir')}</span>}
        <IconBtn size="s" label={t('desk.browse.actions')} onClick={onMenu}><G.More size={12} /></IconBtn>
      </span>
    </div>
  )
}

function interleaveCategories(categories) {
  const lists = categories.map((c) => c.items || [])
  const out = []
  for (let i = 0; lists.some((l) => i < l.length); i += 1) for (const l of lists) if (i < l.length) out.push(l[i])
  return out
}

function SearchResults({ search, scope, pickedCategory, onCategory, onOpen, onPlay, onMenu, allLabel }) {
  const { t } = useI18n()
  if (scope?.all) {
    const byKey = new Map((search.sections || []).map((section) => [section.scope.key, section]))
    const order = (search.order || [])
    const shown = [...byKey.values()].filter((section) => section.items.length).sort((a, b) => order.indexOf(a.scope.key) - order.indexOf(b.scope.key))
    const multi = new Set(shown.map((section) => section.scope.hh)).size > 1
    return (
      <div className="sv-results">
        <p className="sv-over">{allLabel}</p>
        <h1 className="sv-title">{t('desk.browse.results', { query: search.term })}</h1>
        {shown.map(({ scope: from, items, displayTypes }) => (
          <section key={from.key} className="sv-results-service">
            <h2 className="sv-rule-head">
              <span className="sv-results-icon">{from.icon ? <SvcImg src={from.icon} /> : <G.Radio size={12} />}</span>
              {from.nickname && from.nickname !== from.name ? `${from.name} (${from.nickname})` : from.name}{multi ? ` · ${from.gen}` : ''}
            </h2>
            <div className="sv-listing">
              {items.slice(0, 6).map((item, index) => (
                <ItemRow key={`${from.key}-${item.id}-${index}`} item={item} node={{ id: 'search' }} t={t} displayTypes={displayTypes}
                         onOpen={(event) => (isPlayableLeaf(item) || !item.is_container ? onMenu(item, event, from) : onOpen(item, from))}
                         onPlay={item.uri ? () => onPlay(item, from) : null} onMenu={(event) => onMenu(item, event, from)} />
              ))}
            </div>
          </section>
        ))}
        {search.loading && <Busy label={t('desk.browse.loading')} />}
        {!search.loading && !shown.length && search.term && <Empty icon={<G.Search size={48} />} title={t('desk.browse.noResults', { query: search.term })} />}
      </div>
    )
  }
  return (
    <div className="sv-results">
      <p className="sv-over">{t('desk.search.in', { service: scope?.name || '' })}</p>
      <h1 className="sv-title">{t('desk.browse.results', { query: search.term })}</h1>
      {search.available.length > 0 && (
        <div className="sv-btnrow sv-btnrow-wrap" role="group">
          {search.available.map((cat) => (
            <Btn key={cat.id} size="s" selected={cat.id === (pickedCategory || search.category)} onClick={() => onCategory(cat.id)}>{categoryLabel(cat, t)}</Btn>
          ))}
        </div>
      )}
      {search.loading && <Busy label={t('desk.browse.loading')} />}
      {search.error && <p className="sv-error">{search.error}</p>}
      {!search.loading && !search.error && search.categories.length === 0 && search.term && <Empty icon={<G.Search size={48} />} title={t('desk.browse.noResults', { query: search.term })} />}
      {search.categories.map((cat) => (
        <div key={cat.id} className="sv-listing">
          {cat.items.map((item, index) => (
            <ItemRow key={`${cat.id}-${item.id}-${index}`} item={item} node={{ id: 'search' }} t={t} displayTypes={search.displayTypes}
                     onOpen={(event) => (isPlayableLeaf(item) || !item.is_container ? onMenu(item, event) : onOpen(item))}
                     onPlay={item.uri ? () => onPlay(item) : null} onMenu={(event) => onMenu(item, event)} />
          ))}
        </div>
      ))}
    </div>
  )
}

function LineInPage({ node, zones, households, onPlay, onBack, t }) {
  const household = households.find((h) => h.id === node.hh)
  const mine = (household?.zone_uuids || []).map((uuid) => zones[uuid]).filter(Boolean)
  const connected = mine.filter((z) => z.line_in_connected)
  return (
    <div className="sv-listing">
      <UpRow onBack={onBack} t={t} />
      {!connected.length ? <Empty icon={<G.LineIn size={48} />} title={t('desk.browse.lineInNone')} /> : connected.map((zone) => (
        <Row key={zone.uuid} lead={<G.LineIn size={24} />} title={zone.line_in_name || zone.name} sub={zone.name}
             trail={<G.Play size={24} />} onClick={() => onPlay(zone)} />
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
  if (!servicesRaw) return <Busy label={t('desk.browse.loading')} />
  return (
    <div className="sv-stack">
      <Field label={t('sv.filterServices')} value={filter} onChange={setFilter} leading={<G.Search size={12} />} />
      <ServiceGrid services={shown} t={t} onPick={(svc) => onPick?.({ sid: svc.id, name: svc.name, householdId: node.hh, auth: svc.auth })} />
    </div>
  )
}

// The catalog of services: a logo, the name, and how it signs in.
export function ServiceGrid({ services, onPick, t }) {
  return (
    <div className="sv-servicegrid">
      {services.map((svc) => {
        const unpairable = svc.pairable === false
        return (
          <button key={svc.id} type="button" className="sv-servicecard" disabled={unpairable} title={unpairable ? t('desk.add.unpairable', { service: svc.name }) : ''}
                  onClick={() => !unpairable && onPick(svc)}>
            <span className="sv-source-icon">{svc.icon ? <SvcImg src={svc.icon} /> : <span className="sv-initials">{svc.initials}</span>}</span>
            <span className="sv-servicecard-title">{svc.name}</span>
            <span className="sv-servicecard-sub">{unpairable ? t('desk.add.appOnly') : svc.in_use ? t('desk.add.another') : t(`desk.add.auth.${svc.auth}`)}</span>
          </button>
        )
      })}
    </div>
  )
}

// The row menu, shaped by what the row is: a track offers the queue and the adds; a station
// only Play Now and the favorite; a Sonos Favorite its rename and removal; a Sonos Playlist its
// rename and deletion.
function ActionMenu({ item, x, y, anchor, onClose, onAct, canUnselect, saved = null, t }) {
  if (item.root) {
    return (
      <Menu x={x} y={y} anchor={anchor} onClose={onClose}>
        <MenuItem icon={<G.Play size={12} />} onSelect={() => onAct('now')}>{t('desk.actions.playNow')}</MenuItem>
      </Menu>
    )
  }
  const playable = Boolean(item.uri)
  const queueable = isQueueable(item)
  const usable = item.available !== false && playable
  const title = item.title
  const queueRows = (
    <>
      <MenuItem icon={<G.Next size={12} />} onSelect={() => onAct('next')}>{t('desk.actions.playNext')}</MenuItem>
      <MenuItem icon={<G.Queue size={12} />} onSelect={() => onAct('add')}>{t('desk.actions.addToQueue')}</MenuItem>
      <MenuItem icon={<G.Refresh size={12} />} onSelect={() => onAct('replace')}>{t('desk.actions.replaceQueue')}</MenuItem>
    </>
  )
  if (item.playlist) {
    return (
      <Menu x={x} y={y} anchor={anchor} onClose={onClose} title={title}>
        <MenuItem icon={<G.Play size={12} />} onSelect={() => onAct('now')}>{t('desk.actions.playNow')}</MenuItem>
        {queueRows}
        <MenuSep />
        <MenuItem icon={<G.Edit size={12} />} onSelect={() => onAct('renamePlaylist')}>{t('desk.playlists.rename')}</MenuItem>
        <MenuItem icon={<G.Trash size={12} />} danger onSelect={() => onAct('deletePlaylist')}>{t('desk.playlists.delete')}</MenuItem>
        <MenuSep />
        <MenuItem icon={<G.Star size={12} />} onSelect={() => onAct(saved ? 'unfavorite' : 'favorite')}>{t(saved ? 'desk.favorites.remove' : 'desk.actions.addFavorite')}</MenuItem>
        <MenuItem icon={<G.Playlist size={12} />} onSelect={() => onAct('addToPlaylist')}>{t('desk.favorites.addToSonosPlaylist')}</MenuItem>
        {canUnselect && <><MenuSep /><MenuItem icon={<G.Close size={12} />} onSelect={() => onAct('unselect')}>{t('desk.actions.unselectAll')}</MenuItem></>}
      </Menu>
    )
  }
  if (item.favorite) {
    return (
      <Menu x={x} y={y} anchor={anchor} onClose={onClose} title={title}>
        {usable && <MenuItem icon={<G.Play size={12} />} onSelect={() => onAct('now')}>{t('desk.actions.playNow')}</MenuItem>}
        {usable && queueable && queueRows}
        {usable && <MenuSep />}
        <MenuItem icon={<G.Edit size={12} />} onSelect={() => onAct('rename')}>{t('desk.favorites.rename')}</MenuItem>
        <MenuItem icon={<G.Trash size={12} />} danger onSelect={() => onAct('remove')}>{t('desk.favorites.remove')}</MenuItem>
        {usable && queueable && (
          <>
            <MenuSep />
            <MenuItem icon={<G.Playlist size={12} />} onSelect={() => onAct('addToPlaylist')}>{t('desk.favorites.addToSonosPlaylist')}</MenuItem>
            <MenuItem icon={<G.Info size={12} />} onSelect={() => onAct('info')}>{t('desk.now.infoOptions')}</MenuItem>
          </>
        )}
      </Menu>
    )
  }
  return (
    <Menu x={x} y={y} anchor={anchor} onClose={onClose} title={title}>
      {playable && <MenuItem icon={<G.Play size={12} />} onSelect={() => onAct('now')}>{t('desk.actions.playNow')}</MenuItem>}
      {playable && queueable && queueRows}
      {item.inPlaylist && <><MenuSep /><MenuItem icon={<G.Trash size={12} />} danger onSelect={() => onAct('removeFromPlaylist')}>{t('desk.playlists.removeSong')}</MenuItem></>}
      {playable && <MenuSep />}
      {(playable || item.favorite_uri) && <MenuItem icon={<G.Star size={12} />} onSelect={() => onAct(saved ? 'unfavorite' : 'favorite')}>{t(saved ? 'desk.favorites.remove' : 'desk.actions.addFavorite')}</MenuItem>}
      {((playable && queueable) || (!playable && item.is_container && item.playlist_policy)) && (playable || item.favorite_uri) ? (
        <MenuItem icon={<G.Playlist size={12} />} onSelect={() => onAct('addToPlaylist')}>{t('desk.favorites.addToSonosPlaylist')}</MenuItem>
      ) : null}
      {(playable || (item.is_container && ['playlist', 'album', 'artist', 'show'].includes(item.item_type))) && (
        <><MenuSep /><MenuItem icon={<G.Info size={12} />} onSelect={() => onAct('info')}>{t('desk.now.infoOptions')}</MenuItem></>
      )}
      {canUnselect && <><MenuSep /><MenuItem icon={<G.Close size={12} />} onSelect={() => onAct('unselect')}>{t('desk.actions.unselectAll')}</MenuItem></>}
    </Menu>
  )
}

// "Add to Sonos Playlist": the household's playlists and a new one.
export function AddToPlaylistWindow({ picks, source, hzone, onClose, onMessage }) {
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
    <Window kind="panel" title={t('desk.playlists.addTitle')} onClose={onClose}>
      <WindowBar title={t('desk.playlists.addTitle')} sub={items.length === 1 ? items[0].title : t.plural('common.items', items.length)} onClose={onClose} />
      <div className="sv-window-body">
        {playlists === null ? <Busy label={t('desk.browse.loading')} /> : (
          <div className="sv-listing">
            <Row lead={<G.Plus size={24} />} title={t('desk.playlists.new')} onClick={() => setNaming(true)} />
            {playlists.map((item) => (
              <Row key={item.id} lead={<G.Playlist size={24} />} title={item.title} disabled={busy} onClick={() => { if (!busy) addAll(item.id, item.title) }} />
            ))}
          </div>
        )}
      </div>
      {naming && (
        <Confirm title={t('desk.playlists.nameTitle')} body={t('desk.playlists.nameBody')} action={t('common.ok')} icon={<G.Playlist size={48} />} input={{ initial: '', label: t('desk.playlists.nameTitle') }}
                 onClose={() => setNaming(false)}
                 onConfirm={async (title) => { setNaming(false); const made = await actions.createPlaylist(hzone, title); if (made?.id) await addAll(made.id, title) }} />
      )}
    </Window>
  )
}

// A radio station by its stream URL, saved to My Radio Stations.
export function AddRadioWindow({ zone, onClose, onAdded }) {
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
    <Window kind="dialog" title={t('desk.radio.title')} onClose={onClose}>
      <WindowBar title={t('desk.radio.title')} onClose={onClose} />
      <div className="sv-window-body sv-stack">
        <p>{t('desk.radio.intro')} {t('desk.radio.where')}</p>
        <Field label={t('desk.radio.url')} type="url" value={url} placeholder="http://" autoFocus onChange={setUrl} onEnter={submit} />
        <Field label={t('desk.radio.name')} value={name} onChange={setName} onEnter={submit} />
      </div>
      <footer className="sv-window-actions">
        <Btn onClick={onClose}>{t('common.cancel')}</Btn>
        <Btn variant="solid" disabled={!urlOk || !nameOk || busy || !zone} onClick={submit}>{t('common.ok')}</Btn>
      </footer>
    </Window>
  )
}
