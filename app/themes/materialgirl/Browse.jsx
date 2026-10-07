import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
import * as I from './icons.jsx'
import { IconButton, Button, SplitButton, Menu, MenuItem, MenuSep, Confirm, Empty, Busy, Sheet, SheetBar, Chip, SearchBar,
         TextField, ListItem, ShapeArt, SystemPicker, cx, Skeleton } from './m3.jsx'
import { KIND_SHAPES, SHAPES } from './shapes.js'
import { useBrowsePage, useSources, searchScopesOf, playItems, isQueueable, genericArt, describeFavorite, serviceLabelFor,
         TUNEIN_ICONS, readStored, writeStored, VIEW_KEY, householdOf, useSpeakerUpdates, favoriteTarget } from './data.js'

// Browse: every source of music the systems hold, and what is inside each.
//
// It opens on the sources as a grid of cards, one group per system, each
// source's logo set in a scalloped shape. Choosing one moves into a
// list-detail layout: on a wide window the sources stay listed in a pane
// beside the page, on a narrow one the page takes the window and the top
// bar carries the way back. A search bar heads every page; the service it
// searches is its leading avatar. Albums and playlists open onto a hero
// with a split button (Play, and the rest behind its chevron). Ticking rows
// brings up a floating toolbar of what can be done with them.

const ROOT = { root: true, title: '' }
const GLYPHS = { star: I.Star, library: I.Library, playlist: I.Playlist, tv: I.Tv, linein: I.LineIn, note: I.Note, tunein: I.Radio, plus: I.Plus, update: I.Update }

function categoryLabel(cat, t) {
  if (cat.custom && cat.title) return cat.title
  const key = `search.category.${(cat.id || '').toLowerCase()}`
  const label = t(key)
  return label && label !== key ? label : (cat.title || cat.id || '')
}

export default function Browse({ households, zones, groups, roomGroups, onSelectRoom, systemFilter, onSystem, activeZone, roomChosen, servicesByHh, servicesRaw, libraryByHh,
                                 accountChoice, pickAccount, request, onMessage, onInfo, onLinkService, onAddRadio, favoritesEpoch,
                                 onFavoritesChanged, servicesVersion, queueEdited, onQueueReplaced, onScopeChange, compact }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const [stack, setStack] = useState([ROOT])
  const node = stack[stack.length - 1]
  // Which way the reader just went, for the page's transition: one level deeper slides in from the
  // right, back from the left (motion: transitions, Forward and backward).
  const depth = useRef(stack.length)
  const [motion, setMotion] = useState('')
  useLayoutEffect(() => {
    if (stack.length !== depth.current) setMotion(stack.length > depth.current ? 'forward' : 'back')
    depth.current = stack.length
  }, [stack])
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
  const [openedOther, setOpenOther] = useState(() => new Set())
  const toggleOther = (id) => setOpenOther((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const scroller = useRef(null)
  useEffect(() => { setChecked(new Set()); setMenu(null); if (scroller.current) scroller.current.scrollTop = 0 }, [node])
  useEffect(() => { writeStored(VIEW_KEY, view) }, [view])

  const speakerUpdates = useSpeakerUpdates(households)
  const [updateAsk, setUpdateAsk] = useState(null)
  const sections = useSources({ households, systemFilter, zones, activeZone, servicesByHh, libraryByHh, accountChoice, roomChosen, updates: speakerUpdates.updates, t })
  const activeHousehold = activeZone ? householdOf(households, activeZone.uuid)?.id ?? null : null
  const activeGen = activeHousehold ? households.find((h) => h.id === activeHousehold)?.generation || '' : ''
  const allLabel = activeGen ? t('mg.allServicesGen', { gen: activeGen }) : t('mg.allServices')
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
      setMenu({ item: { ...item, root: true }, anchor, x: event?.clientX ?? window.innerWidth / 2, y: event?.clientY ?? window.innerHeight / 2 })
      return
    }
    setTerm('')
    if (item.id === 'linein') { setStack([ROOT, { id: 'linein', virtual: 'lineIn', title: item.title, glyph: 'linein', hzone: item.hzone, hh: item.hh }]); return }
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
  // Each row of the location tree is looked at one level down: more places
  // under it and it opens; stations under it and it is a place to live,
  // chosen on a press; nothing under it and it is not shown.
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
    setMenu({ item: { ...item, ...extra }, x: event?.clientX, y: event?.clientY, anchor: event?.type === 'contextmenu' ? null : anchor })
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
    // speakers would not know the account.
    const itemHousehold = householdOf(households, hzone)?.id
    if (!activeZone?.local && activeHousehold && itemHousehold && itemHousehold !== activeHousehold) {
      onMessage?.(t('mg.playOtherSystem', { gen: households.find((h) => h.id === itemHousehold)?.generation || '' }))
      return
    }
    if (how === 'now' || how === 'replace') onQueueReplaced?.()
    const done = await playItems(actions, group.filter((i) => i.uri), how,
                                 { hzone: playTarget(activeZone, hzone), service, from: activeZone?.local ? hzone : '' })
    if (done) {
      setChecked(new Set())
      onMessage?.(t(how === 'now' ? 'mg.playingNow' : how === 'next' ? 'mg.queuedNext' : how === 'replace' ? 'mg.replacedQueue' : 'mg.addedToQueue',
                    { title: group.length > 1 ? t.plural('common.items', group.length) : group[0].title }))
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
    await actions.setSource(playTarget(activeZone, node.hzone),
                            { uri: node.uri, metadata: node.metadata || '', service: node.service,
                              ...(activeZone?.local ? { from_zone: node.hzone } : {}), replace: true })
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
  // A service's home that arrives as shelves is drawn as carousels, each under
  // its name with View All at its end, in the automatic view.
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
  const back = () => { if (stack.length > 1) setStack(stack.slice(0, -1)) }
  const current = (row) => !node.root && (stack[1]?.id === row.id || (row.service != null && stack[1]?.service === row.service && stack[1]?.hh === row.hh))

  // The source list, for the pane beside a page on a wide window.
  const sourcePane = !atRoot && !searching && !compact && (
    <nav className="mg-sources" aria-label={t('mg.musicSources')}>
      {sections.map((section) => {
        const folded = section.otherSystem && !openedOther.has(section.household.id)
        return (
          <div key={section.household.id} className="mg-sources-group" data-dim={section.otherSystem || undefined}>
            {section.header && (
              <button type="button" className="mg-sources-gen" aria-expanded={!folded} disabled={!section.otherSystem}
                      onClick={() => toggleOther(section.household.id)}>
                <span>{section.header}</span>{section.otherSystem && (folded ? <I.ChevronDown /> : <I.ChevronUp />)}
              </button>
            )}
            {!folded && section.rows.map((row) => {
              const Glyph = GLYPHS[row.glyph] || I.Note
              return (
                <button key={`${section.household.id}-${row.id}`} type="button" className="mg-source" data-current={current(row) || undefined}
                        disabled={row.disabled} title={row.disabled ? t('mg.otherSystem', { gen: row.gen }) : row.title}
                        onClick={(event) => openRoot(row, false, event)}
                        onContextMenu={row.disabled ? undefined : row.playable ? (event) => openRoot(row, false, event)
                          : row.accounts ? (event) => { event.preventDefault(); setAccountMenu({ row, anchor: null, x: event.clientX, y: event.clientY }) } : undefined}>
                  <span className="mg-state" aria-hidden="true" />
                  <span className="mg-caution-anchor">
                    <span className="mg-source-icon">{row.icon ? <img src={row.icon} alt="" /> : <Glyph />}</span>
                    {row.caution && <CautionBadge kind={row.caution} title={t(`services.caution.${row.caution}`, { gen: row.gen ?? 'S1' })} />}
                  </span>
                  <span className="mg-source-title">{row.title}{row.sub && <small>{row.sub}</small>}</span>
                </button>
              )
            })}
          </div>
        )
      })}
    </nav>
  )

  return (
    <div className={cx('mg-page', 'mg-browse', sourcePane && 'mg-browse-split')}>
      {sourcePane}
      <div className="mg-browse-page" ref={scroller}>
        <header className="mg-appbar mg-appbar-browse">
          {!atRoot && !searching ? (
            <div className="mg-appbar-row">
              <IconButton label={t('common.back')} onClick={back}><I.Back /></IconButton>
              <div className="mg-crumbs">
                {stack.slice(1, -1).map((entry, i) => (
                  <button key={`${entry.id}-${i}`} type="button" className="mg-crumb" onClick={() => setStack(stack.slice(0, i + 2))}><span className="mg-crumb-label">{entry.title}</span></button>
                ))}
              </div>
              <span className="mg-grow" />
              <IconButton label={t('mg.view')} onClick={(event) => setViewMenu(event.currentTarget)}>
                {view === 'grid' ? <I.ViewGrid /> : view === 'list' ? <I.ViewList /> : <I.ViewAuto />}
              </IconButton>
            </div>
          ) : (
            <h1 className="mg-headline">{t('mg.nav.browse')}</h1>
          )}
          <SearchBar ref={searchRef} value={term} onChange={setTerm} label={t('common.search')}
                     placeholder={scope && !scope.all ? t('desk.search.in', { service: scope.name }) : t('common.search')}
                     onKeyDown={(event) => { if (event.key === 'Escape' && term) { event.stopPropagation(); setTerm('') } }}
                     leading={scope ? (
                       <button type="button" className="mg-scope" title={t('desk.search.scope')} aria-label={t('desk.search.scope')} aria-haspopup="menu"
                               onClick={(event) => setScopeMenu(event.currentTarget)}>
                         {scope.icon ? <img src={scope.icon} alt="" /> : <I.Search />}
                       </button>
                     ) : null}
                     trailing={term ? <IconButton label={t('common.close')} onClick={() => setTerm('')}><I.Close /></IconButton> : null} />
          <div className="mg-browse-context">
            <Chip kind="assist" icon={<I.Speaker />} disabled={roomOptions.length < 2} title={t('mg.activeRoom')}
                  onClick={(event) => setRoomMenu(event.currentTarget)}>
              {activeRoomName ? t('mg.playsIn', { room: activeRoomName }) : t('mg.chooseRoom')}
            </Chip>
            {/* On a phone the shell's own selector already stands in the title row. */}
            {atRoot && !compact && <SystemPicker households={households} value={systemFilter} onChange={onSystem} />}
          </div>
        </header>

        <div className="mg-browse-body" key={`${stack.length}:${node.id}`} data-motion={motion || undefined}>
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
            <SourceCards sections={sections} t={t} opened={openedOther} onFold={toggleOther} addHouseholdId={addHouseholdId}
                         onOpen={(row, event) => openRoot(row, false, event)}
                         onAdd={(section) => push({ id: '__addsvc', virtual: 'addServices', title: t('desk.browse.addServicesFor', { gen: section.household.generation }), glyph: 'plus', hh: section.household.id, hzone: section.hzone })}
                         onAccounts={(row, event) => { event.preventDefault(); event.stopPropagation(); setAccountMenu({ row, anchor: event.currentTarget, x: event.clientX, y: event.clientY }) }} />
          ) : node.virtual === 'lineIn' ? (
            <LineInPage node={node} zones={zones} households={households} t={t}
                        onPlay={(zone) => actions.setSource(zone.uuid, { uri: `x-rincon-stream:${zone.uuid}`, metadata: '' })} />
          ) : node.virtual === 'addServices' ? (
            <AddServicesPage node={node} servicesRaw={servicesRaw} t={t} onPick={onLinkService} />
          ) : node.virtual === 'changeLocation' ? (
            <div className="mg-card mg-card-filled mg-list">
              <ListItem leading={<span className="mg-li-glyph"><I.Pin /></span>} headline={t('desk.radio.enterZip')} onClick={() => setNaming({ kind: 'zip' })} />
              <ListItem leading={<span className="mg-li-glyph"><I.Folder /></span>} headline={t('desk.radio.pickCity')} trailing={<I.Chevron />}
                        onClick={() => push({ id: 'r0', item: 'r0', service: node.service, title: t('desk.radio.pickCity'), hzone: node.hzone, hh: node.hh, icon: node.icon, pickCity: true, serviceName: node.serviceName })} />
            </div>
          ) : (
            <>
              <PageHead node={node} caution={caution} liveAccount={liveAccount} page={page} t={t} onLinkService={onLinkService}
                        isCollection={isCollection} onPlay={() => playAlbum(false)} onShuffle={() => playAlbum(true)} onAct={(how) => act(albumItem(), how)}
                        onMenu={(event) => openMenu(albumItem(), event)} count={items.length} />
              {page.error && <p className="mg-error">{page.error}</p>}
              {page.loading && <Skeleton label={t('desk.browse.loading')} kind="list" rows={6} />}
              {!page.loading && !page.error && !page.needsLink && items.length === 0 && node.service !== 254 && (
                <Empty icon={<I.Folder />} title={t('desk.browse.empty')} />
              )}
              {node.service === 254 && node.item === 'root' && !page.loading && (
                <div className="mg-chips mg-pins">
                  {[['R:0/0', t('desk.radio.myStations'), 'station', false],
                    ['R:0/1', t('desk.radio.myShows'), 'show', false],
                    [radioLocation.node || 'local', radioLocation.city ? t('desk.radio.localRadioIn', { city: radioLocation.city }) : t('desk.radio.localRadio'), 'local', true]].map(([id, title, icon, viaService]) => (
                    <Chip key={id} kind="assist" icon={<img src={`${TUNEIN_ICONS}/${icon}_legacy.png`} alt="" className="mg-chip-img" />}
                          onClick={() => push(viaService
                            ? { id, title, item: id, service: node.service, hzone: node.hzone, hh: node.hh, icon: node.icon, serviceName: node.serviceName, localRadio: true }
                            : { id, title, item: 'root', hzone: node.hzone, hh: node.hh, icon: node.icon, glyph: 'tunein' })}>{title}</Chip>
                  ))}
                </div>
              )}
              {shelves.map((shelf, si) => (
                <section key={`${shelf.id}-${si}`} className="mg-shelf" aria-label={shelf.title}>
                  <header className="mg-shelf-head">
                    <div><h2>{shelf.title}</h2></div>
                    {shelf.id && <Button variant="text" size="xs" trailing={<I.Chevron />} onClick={() => browseInto(shelf, { preset: shelf.children })}>{t('common.viewAll')}</Button>}
                  </header>
                  <div className="mg-carousel">
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
                <div className="mg-grid">
                  {loose.map((item, index) => (
                    <ItemCard key={`${item.id}-${index}`} item={item} node={node} t={t} displayTypes={page.displayTypes}
                              onDelete={removal ? () => act({ ...item, ...rowExtras(item, index) }, removal) : undefined}
                              onOpen={(event) => open({ ...item, ...rowExtras(item, index) }, event)} onPlay={item.uri ? () => act({ ...item, ...rowExtras(item, index) }, 'now') : null}
                              onMenu={(event) => openMenu(item, event, rowExtras(item, index))} />
                  ))}
                </div>
              ) : loose.length > 0 && (
                <div className="mg-rows">
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
              {node.id === 'R:0/0' && !page.loading && <div className="mg-page-foot"><Button variant="tonal" icon={<I.Plus />} onClick={onAddRadio}>{t('desk.radio.addNew')}</Button></div>}
              {node.id === 'SQ:' && !page.loading && <div className="mg-page-foot"><Button variant="tonal" icon={<I.Plus />} onClick={() => setNaming({ kind: 'newPlaylist' })}>{t('desk.playlists.new')}</Button></div>}
              {node.localRadio && !page.loading && (
                <div className="mg-page-foot"><Button variant="tonal" icon={<I.Pin />} onClick={() => push({ id: '__changeloc', virtual: 'changeLocation', title: t('desk.radio.changeLocation'), service: node.service, hzone: node.hzone, hh: node.hh, icon: node.icon, serviceName: node.serviceName })}>{t('desk.radio.changeLocation')}</Button></div>
              )}
            </>
          )}
        </div>
      </div>

      {/* The contextual floating toolbar for ticked rows. */}
      {checked.size > 0 && (
        <div className="mg-select-toolbar" role="toolbar" aria-label={t('mg.selected', { count: checked.size })}>
          <IconButton label={t('desk.actions.unselectAll')} onClick={() => setChecked(new Set())}><I.Close /></IconButton>
          <span className="mg-select-count">{t('mg.selected', { count: checked.size })}</span>
          <IconButton variant="filled" label={t('desk.actions.playNow')} onClick={() => act(items.find((i) => checked.has(i.id)), 'now')}><I.Play /></IconButton>
          <IconButton variant="tonal" label={t('desk.actions.playNext')} onClick={() => act(items.find((i) => checked.has(i.id)), 'next')}><I.Next /></IconButton>
          <IconButton variant="tonal" label={t('desk.actions.addToQueue')} onClick={() => act(items.find((i) => checked.has(i.id)), 'add')}><I.Queue /></IconButton>
          <IconButton variant="tonal" label={t('desk.favorites.addToSonosPlaylist')} onClick={() => act(items.find((i) => checked.has(i.id)), 'addToPlaylist')}><I.Playlist /></IconButton>
        </div>
      )}

      {viewMenu && (
        <Menu anchor={viewMenu} align="right" onClose={() => setViewMenu(null)} title={t('mg.view')}>
          {[['auto', 'mg.viewAuto', <I.ViewAuto key="a" />], ['grid', 'mg.viewGrid', <I.ViewGrid key="g" />], ['list', 'mg.viewList', <I.ViewList key="l" />]].map(([id, key, icon]) => (
            <MenuItem key={id} icon={icon} checked={view === id} onSelect={() => { setView(id); setViewMenu(null) }}>{t(key)}</MenuItem>
          ))}
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
        <Menu anchor={scopeMenu} onClose={() => setScopeMenu(null)} title={t('desk.search.scope')}>
          <div className="mg-menu-scroll">
            {scopes.map((s) => (
              <MenuItem key={s.key} checked={scope?.key === s.key} icon={s.icon ? <img src={s.icon} alt="" className="mg-menu-img" /> : <I.Search />}
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
            <MenuItem key={`${account.account_id ?? ''}`} icon={<I.Person />} checked={(account.account_id ?? '') === accountMenu.row.account}
                      onSelect={() => { pickAccount(`${accountMenu.row.hh}:${accountMenu.row.service}`, account.account_id ?? ''); setAccountMenu(null) }}>
              {account.nickname || accountMenu.row.title}
            </MenuItem>
          ))}
        </Menu>
      )}
      {menu && <ActionMenu item={menu.item} x={menu.x} y={menu.y} anchor={menu.anchor} onClose={() => setMenu(null)} onAct={(how) => act(menu.item, how)}
                           canUnselect={checked.size > 0} saved={savedFavorite} t={t} />}
      {addTo && <AddToPlaylistSheet picks={addTo.picks} source={addTo.source} hzone={addTo.hzone} onClose={() => setAddTo(null)} onMessage={onMessage} />}
      {naming?.kind === 'favorite' && (
        <Confirm title={t('desk.favorites.rename')} body={t('desk.favorites.renameBody')} action={t('common.ok')} icon={<I.Edit />}
                 input={{ initial: naming.item.title || '', label: t('desk.favorites.rename') }} onClose={() => setNaming(null)}
                 onConfirm={async (title) => { const target = naming.item; setNaming(null); const done = await actions.renameFavorite(target.hzone || node.hzone, target.id, target.title, title); if (done) { setRefresh((v) => v + 1); onFavoritesChanged?.() } }} />
      )}
      {(naming?.kind === 'playlist' || naming?.kind === 'newPlaylist') && (
        <Confirm title={naming.kind === 'newPlaylist' ? t('desk.playlists.nameTitle') : t('desk.playlists.rename')} icon={<I.Playlist />}
                 body={naming.kind === 'newPlaylist' ? t('desk.playlists.nameBody') : t('desk.playlists.renameBody')} action={t('common.ok')}
                 input={{ initial: naming.kind === 'newPlaylist' ? '' : naming.item.title, label: t('desk.playlists.nameTitle') }} onClose={() => setNaming(null)}
                 onConfirm={async (title) => {
                   const target = naming; setNaming(null)
                   const done = target.kind === 'newPlaylist' ? await actions.createPlaylist(node.hzone, title) : await actions.renamePlaylist(target.item.hzone || node.hzone, target.item.id, target.item.title, title)
                   if (done) setRefresh((v) => v + 1)
                 }} />
      )}
      {naming?.kind === 'zip' && (
        <Confirm title={t('desk.radio.enterZip')} body={t('desk.radio.zipBody')} action={t('common.ok')} icon={<I.Pin />} input={{ initial: '', label: t('desk.radio.enterZip') }} onClose={() => setNaming(null)}
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
        <Confirm title={t('desk.update.title')} body={t('desk.update.body', { version: updateAsk.version })} icon={<I.Update />}
                 action={t('desk.update.start')} cancelLabel={t('desk.update.notNow')} onClose={() => setUpdateAsk(null)}
                 onConfirm={async () => {
                   const ask = updateAsk
                   setUpdateAsk(null)
                   const done = await api.startSoftwareUpdate(ask.hh).catch(() => null)
                   if (done?.started?.length) { onMessage?.(t('desk.update.started')); speakerUpdates.clear(ask.hh) }
                 }} />
      )}
      {replaceAsk && (
        <Confirm title={t('desk.queue.editedTitle')} body={t('desk.queue.editedBody')} action={t('desk.queue.playAnyway')} icon={<I.Queue />} onClose={() => setReplaceAsk(null)}
                 onConfirm={() => { const ask = replaceAsk; setReplaceAsk(null); playAlbum(ask.shuffle, true) }} />
      )}
    </div>
  )
}

// The root: every source as a card, one block per system. A system whose
// rooms are not the one in view folds away until opened.
function SourceCards({ sections, onOpen, onAccounts, onAdd, opened, onFold, addHouseholdId, t }) {
  return (
    <div className="mg-sourcecards">
      {sections.map((section) => {
        const shut = section.otherSystem && !opened.has(section.household.id)
        return (
          <section key={section.household.id} className="mg-sourcecards-system" data-dim={section.otherSystem || undefined}>
            {section.header && (
              <header className="mg-sourcecards-head">
                <h2 className="mg-title-l">{section.header}</h2>
                {section.otherSystem && (
                  <>
                    <span className="mg-muted">{t('mg.otherSystem', { gen: section.header })}</span>
                    <IconButton label={t(shut ? 'desk.queue.expand' : 'desk.queue.collapse')} onClick={() => onFold(section.household.id)}>
                      {shut ? <I.ChevronDown /> : <I.ChevronUp />}
                    </IconButton>
                  </>
                )}
              </header>
            )}
            {!shut && (
              <div className="mg-sourcecards-grid">
                {section.rows.map((row) => {
                  const Glyph = GLYPHS[row.glyph] || I.Note
                  return (
                    <div key={row.id} className="mg-sourcecard" role="button" tabIndex={row.disabled ? -1 : 0} aria-disabled={row.disabled || undefined}
                         onClick={(event) => onOpen(row, event)} onKeyDown={(event) => { if (event.key === 'Enter') onOpen(row, event) }}
                         onContextMenu={row.disabled ? undefined : row.playable ? (event) => onOpen(row, event) : row.accounts ? (event) => onAccounts(row, event) : undefined}>
                      <span className="mg-state" aria-hidden="true" />
                      <span className="mg-caution-anchor">
                        <span className="mg-sourcecard-icon" style={{ clipPath: KIND_SHAPES.service }}>
                          {row.icon ? <img src={row.icon} alt="" /> : <Glyph />}
                        </span>
                        {row.caution && <CautionBadge kind={row.caution} title={t(`services.caution.${row.caution}`, { gen: row.gen ?? 'S1' })} />}
                      </span>
                      <span className="mg-sourcecard-title">{row.title}</span>
                      {row.sub && <span className="mg-sourcecard-sub">{row.sub}</span>}
                      {row.accounts && !row.disabled && (
                        <IconButton size="xs" className="mg-sourcecard-more" label={t('desk.browse.switchAccount')} onClick={(event) => onAccounts(row, event)}><I.Person /></IconButton>
                      )}
                    </div>
                  )
                })}
                {addHouseholdId === section.household.id && (
                  <div className="mg-sourcecard mg-sourcecard-add" role="button" tabIndex={0} onClick={() => onAdd(section)} onKeyDown={(event) => { if (event.key === 'Enter') onAdd(section) }}>
                    <span className="mg-state" aria-hidden="true" />
                    <span className="mg-sourcecard-icon" style={{ clipPath: SHAPES.circle }}><I.Plus /></span>
                    <span className="mg-sourcecard-title">{t('desk.browse.addServices')}</span>
                  </div>
                )}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

function PageHead({ node, caution, liveAccount, page, t, onLinkService, isCollection, onPlay, onShuffle, onAct, onMenu, count }) {
  const Glyph = GLYPHS[node.glyph] || I.Note
  return (
    <>
      {isCollection ? (
        <header className="mg-collection">
          <ShapeArt src={node.art} shape={node.kind === 'album' ? SHAPES.softSquare : SHAPES.cookie12} size={220} fallback={node.kind === 'album' ? 'disc' : 'playlist'} className="mg-collection-art" />
          <div className="mg-collection-text">
            <p className="mg-overline">{t(node.kind === 'album' ? 'common.kind.album' : 'common.kind.playlist')}</p>
            <h1 className="mg-display-s">{node.title}</h1>
            <p className="mg-muted">{[node.artist, t.plural('common.tracks', count)].filter(Boolean).join(' · ')}</p>
            <div className="mg-collection-actions">
              <SplitButton label={t('common.play')} icon={<I.Play />} onClick={onPlay} menuLabel={t('desk.browse.actions')} size="m">
                {(close) => (
                  <>
                    <MenuItem icon={<I.Shuffle />} onSelect={() => { close(); onShuffle() }}>{t('common.shuffle')}</MenuItem>
                    <MenuItem icon={<I.Next />} onSelect={() => { close(); onAct('next') }}>{t('desk.actions.playNext')}</MenuItem>
                    <MenuItem icon={<I.Queue />} onSelect={() => { close(); onAct('add') }}>{t('desk.actions.addToQueue')}</MenuItem>
                    <MenuItem icon={<I.Refresh />} onSelect={() => { close(); onAct('replace') }}>{t('desk.actions.replaceQueue')}</MenuItem>
                  </>
                )}
              </SplitButton>
              <IconButton variant="tonal" size="m" label={t('common.shuffle')} onClick={onShuffle}><I.Shuffle /></IconButton>
              <IconButton variant="outlined" size="m" label={t('desk.browse.actions')} onClick={onMenu}><I.More /></IconButton>
            </div>
          </div>
        </header>
      ) : (
        <header className="mg-pagetitle">
          {/* A service is a circle, as everywhere else (KIND_SHAPES); the nine-lobed cookie here cut
              into every square logo (Amazon Music, Mixcloud, planet radio). */}
          <span className="mg-pagetitle-icon" style={{ clipPath: KIND_SHAPES.service }}>{node.icon ? <img src={node.icon} alt="" /> : <Glyph />}</span>
          <h1 className="mg-headline">{node.title}</h1>
        </header>
      )}
      {page.needsLink && (
        <div className="mg-banner">
          <CautionBadge kind="sonos" size="large" logo={node} title={t('services.caution.sonos', { gen: node.gen ?? 'S1' })} />
          <div>
            <strong>{t('services.needsSonora.title')}</strong>
            <p>{t('desk.browse.needsLink.body', { service: node.serviceName || node.title, gen: node.gen ?? 'S1' })}</p>
            <Button variant="filled" size="xs" icon={<I.Link />} onClick={() => onLinkService?.({ sid: node.service, householdId: node.hh, name: node.serviceName || node.title, account: liveAccount })}>
              {t('desk.browse.needsLink.action', { service: node.serviceName || node.title })}
            </Button>
          </div>
        </div>
      )}
      {!page.loading && !page.error && caution === 'sonora' && node.item === 'root' && (
        <div className="mg-banner">
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

// The service's DisplayType decides what a row says beyond its title: its
// Lines name the fields. A row naming no display type shows its title alone
// whatever summary it carries. A container whose type has lines but no
// DisplayMode reads them on one line; a playable row reads them under the
// title. Tracks and albums keep the artist line without any map.
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
  // A track on such a page reads by its title alone too: Plex's copies of a song, each an artist-typed
  // "Music / on <server>" container, show it so in both S1 apps (2026-10-02, 2026-10-03).
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
  return (
    <div className="mg-row" data-item role="button" tabIndex={0} data-selected={selected || undefined} data-checked={checked || undefined}
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
      <span className="mg-state" aria-hidden="true" />
      <span className={cx('mg-row-art', item.item_type === 'artist' && 'mg-row-art-round')}>
        {number ? <span className="mg-row-num">{number}</span>
          : restricted ? <I.Prohibit role="img" aria-label={t('common.restricted')} />
          : unavailable ? <I.Warning />
          : (favorite && !item.uri && !item.art) ? <I.Folder />
          : radio && !item.art ? <I.Radio />
          : playlist ? <I.Playlist />
          : <Art src={item.art} size={48} fallback={genericArt(item)} />}
        {onPlay && !opens && !unavailable && (
          <button type="button" className="mg-row-play" title={t('desk.actions.playNow')} aria-label={t('desk.actions.playNow')} onClick={(event) => { event.stopPropagation(); onPlay() }}><I.Play /></button>
        )}
      </span>
      <span className="mg-row-text">
        <span className="mg-row-title">
          <span>{titleText}</span>
          {item.explicit && <I.Explicit className="mg-explicit" role="img" aria-label={t('common.explicit')} />}
        </span>
        {sub && <span className="mg-row-sub">{sub}</span>}
      </span>
      {typeof item.duration === 'string' && item.duration && item.duration !== '0:00:00' ? <span className="mg-row-dur">{item.duration.replace(/^0:0?/, '')}</span> : null}
      <span className="mg-row-tools" onClick={(event) => event.stopPropagation()}>
        {selectable && onCheck && (
          <label className="mg-check" title={t('desk.browse.select')}>
            <input type="checkbox" checked={checked} onChange={onCheck} aria-label={t('desk.browse.select')} />
            <span aria-hidden="true"><I.Check /></span>
          </label>
        )}
        <IconButton size="xs" label={t('desk.browse.actions')} onClick={onMenu}><I.More /></IconButton>
      </span>
      {opens && <I.Chevron className="mg-row-more" />}
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
    <div className="mg-tile mg-tile-grid" data-item role="button" tabIndex={dead ? -1 : 0} aria-disabled={unavailable || dead || undefined} title={titleText}
         data-dead={dead || undefined}
         onClick={dead ? undefined : (event) => onOpen(event)} onDoubleClick={dead ? undefined : (onPlay || undefined)}
         onKeyDown={(event) => {
           if (event.key === 'Enter' && !dead) onOpen(event)
           else if ((event.key === 'Delete' || event.key === 'Backspace') && onDelete) { event.preventDefault(); onDelete() }
         }}
         onContextMenu={(event) => { event.preventDefault(); onMenu(event) }}>
      <span className="mg-tile-art" data-round={item.item_type === 'artist' || undefined}>
        {unavailable ? <span className="mg-tile-glyph"><I.Warning /></span> : <Art src={item.art} size={180} fallback={genericArt(item)} />}
        {onPlay && <button type="button" className="mg-tile-play mg-tile-play-btn" title={t('desk.actions.playNow')} aria-label={t('desk.actions.playNow')} onClick={(event) => { event.stopPropagation(); onPlay() }}><I.Play /></button>}
      </span>
      <span className="mg-tile-title">{titleText}{item.explicit && <I.Explicit className="mg-explicit" role="img" aria-label={t('common.explicit')} />}</span>
      {sub && <span className="mg-tile-sub">{sub}</span>}
      <span className="mg-tile-tools" onClick={(event) => event.stopPropagation()}>
        {container && !dead && <span className="mg-tile-chev" aria-hidden="true"><I.Chevron /></span>}
        <IconButton size="xs" variant="tonal" label={t('desk.browse.actions')} onClick={onMenu}><I.More /></IconButton>
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
      <div className="mg-results">
        <p className="mg-overline">{allLabel}</p>
        <h1 className="mg-headline">{t('desk.browse.results', { query: search.term })}</h1>
        {shown.map(({ scope: from, items, displayTypes }) => (
          <section key={from.key} className="mg-results-service">
            <h2 className="mg-results-head">
              <span className="mg-results-icon">{from.icon ? <img src={from.icon} alt="" /> : <I.Radio />}</span>
              <span>{from.nickname && from.nickname !== from.name ? `${from.name} (${from.nickname})` : from.name}{multi ? ` · ${from.gen}` : ''}</span>
            </h2>
            <div className="mg-rows">
              {items.slice(0, 6).map((item, index) => (
                <ItemRow key={`${from.key}-${item.id}-${index}`} item={item} node={{ id: 'search' }} t={t} displayTypes={displayTypes}
                         onOpen={(event) => (isPlayableLeaf(item) || !item.is_container ? onMenu(item, event, from) : onOpen(item, from))}
                         onPlay={item.uri ? () => onPlay(item, from) : null} onMenu={(event) => onMenu(item, event, from)} />
              ))}
            </div>
          </section>
        ))}
        {search.loading && <Skeleton label={t('desk.browse.loading')} kind="list" rows={6} />}
        {!search.loading && !shown.length && search.term && <Empty icon={<I.Search />} title={t('desk.browse.noResults', { query: search.term })} />}
      </div>
    )
  }
  return (
    <div className="mg-results">
      <p className="mg-overline">{t('desk.search.in', { service: scope?.name || '' })}</p>
      <h1 className="mg-headline">{t('desk.browse.results', { query: search.term })}</h1>
      {search.available.length > 0 && (
        <div className="mg-chips">
          {search.available.map((cat) => (
            <Chip key={cat.id} selected={cat.id === (pickedCategory || search.category)} onClick={() => onCategory(cat.id)}>{categoryLabel(cat, t)}</Chip>
          ))}
        </div>
      )}
      {search.loading && <Skeleton label={t('desk.browse.loading')} kind="list" rows={6} />}
      {search.error && <p className="mg-error">{search.error}</p>}
      {!search.loading && !search.error && search.categories.length === 0 && search.term && <Empty icon={<I.Search />} title={t('desk.browse.noResults', { query: search.term })} />}
      {search.categories.map((cat) => (
        <div key={cat.id} className="mg-rows">
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

function LineInPage({ node, zones, households, onPlay, t }) {
  const household = households.find((h) => h.id === node.hh)
  const mine = (household?.zone_uuids || []).map((uuid) => zones[uuid]).filter(Boolean)
  const connected = mine.filter((z) => z.line_in_connected)
  if (!connected.length) return <Empty icon={<I.LineIn />} title={t('desk.browse.lineInNone')} />
  return (
    <div className="mg-card mg-card-filled mg-list">
      {connected.map((zone) => (
        <ListItem key={zone.uuid} leading={<span className="mg-li-glyph"><I.LineIn /></span>} headline={zone.line_in_name || zone.name} supporting={zone.name}
                  trailing={<I.Play />} onClick={() => onPlay(zone)} />
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
  if (!servicesRaw) return <Skeleton label={t('desk.browse.loading')} kind="list" rows={6} />
  return (
    <div className="mg-stack">
      <TextField label={t('mg.filterServices')} value={filter} onChange={setFilter} leading={<I.Search />} />
      <ServiceGrid services={shown} t={t} onPick={(svc) => onPick?.({ sid: svc.id, name: svc.name, householdId: node.hh, auth: svc.auth })} />
    </div>
  )
}

// The catalog of services as cards: a logo, the name, and how it signs in.
export function ServiceGrid({ services, onPick, t }) {
  return (
    <div className="mg-sourcecards-grid">
      {services.map((svc) => {
        const unpairable = svc.pairable === false
        return (
          <button key={svc.id} type="button" className="mg-sourcecard" disabled={unpairable} title={unpairable ? t('desk.add.unpairable', { service: svc.name }) : ''}
                  onClick={() => !unpairable && onPick(svc)}>
            <span className="mg-state" aria-hidden="true" />
            <span className="mg-sourcecard-icon" style={{ clipPath: KIND_SHAPES.service }}>{svc.icon ? <img src={svc.icon} alt="" /> : <span className="mg-initials">{svc.initials}</span>}</span>
            <span className="mg-sourcecard-title">{svc.name}</span>
            <span className="mg-sourcecard-sub">{unpairable ? t('desk.add.appOnly') : svc.in_use ? t('desk.add.another') : t(`desk.add.auth.${svc.auth}`)}</span>
          </button>
        )
      })}
    </div>
  )
}

// The row menu, shaped by what the row is: a track offers the queue and the
// adds; a station only Play Now and the favorite; a Sonos Favorite its
// rename and removal; a Sonos Playlist its rename and deletion.
function ActionMenu({ item, x, y, anchor, onClose, onAct, canUnselect, saved = null, t }) {
  if (item.root) {
    return (
      <Menu x={x} y={y} anchor={anchor} onClose={onClose}>
        <MenuItem icon={<I.Play />} onSelect={() => onAct('now')}>{t('desk.actions.playNow')}</MenuItem>
      </Menu>
    )
  }
  const playable = Boolean(item.uri)
  const queueable = isQueueable(item)
  const usable = item.available !== false && playable
  const title = item.title
  const queueRows = (
    <>
      <MenuItem icon={<I.Next />} onSelect={() => onAct('next')}>{t('desk.actions.playNext')}</MenuItem>
      <MenuItem icon={<I.Queue />} onSelect={() => onAct('add')}>{t('desk.actions.addToQueue')}</MenuItem>
      <MenuItem icon={<I.Refresh />} onSelect={() => onAct('replace')}>{t('desk.actions.replaceQueue')}</MenuItem>
    </>
  )
  if (item.playlist) {
    return (
      <Menu x={x} y={y} anchor={anchor} onClose={onClose} title={title}>
        <MenuItem icon={<I.Play />} onSelect={() => onAct('now')}>{t('desk.actions.playNow')}</MenuItem>
        {queueRows}
        <MenuSep />
        <MenuItem icon={<I.Edit />} onSelect={() => onAct('renamePlaylist')}>{t('desk.playlists.rename')}</MenuItem>
        <MenuItem icon={<I.Trash />} danger onSelect={() => onAct('deletePlaylist')}>{t('desk.playlists.delete')}</MenuItem>
        <MenuSep />
        <MenuItem icon={<I.Star />} onSelect={() => onAct(saved ? 'unfavorite' : 'favorite')}>{t(saved ? 'desk.favorites.remove' : 'desk.actions.addFavorite')}</MenuItem>
        <MenuItem icon={<I.Playlist />} onSelect={() => onAct('addToPlaylist')}>{t('desk.favorites.addToSonosPlaylist')}</MenuItem>
        {canUnselect && <><MenuSep /><MenuItem icon={<I.Close />} onSelect={() => onAct('unselect')}>{t('desk.actions.unselectAll')}</MenuItem></>}
      </Menu>
    )
  }
  if (item.favorite) {
    return (
      <Menu x={x} y={y} anchor={anchor} onClose={onClose} title={title}>
        {usable && <MenuItem icon={<I.Play />} onSelect={() => onAct('now')}>{t('desk.actions.playNow')}</MenuItem>}
        {usable && queueable && queueRows}
        {usable && <MenuSep />}
        <MenuItem icon={<I.Edit />} onSelect={() => onAct('rename')}>{t('desk.favorites.rename')}</MenuItem>
        <MenuItem icon={<I.Trash />} danger onSelect={() => onAct('remove')}>{t('desk.favorites.remove')}</MenuItem>
        {usable && queueable && (
          <>
            <MenuSep />
            <MenuItem icon={<I.Playlist />} onSelect={() => onAct('addToPlaylist')}>{t('desk.favorites.addToSonosPlaylist')}</MenuItem>
            <MenuItem icon={<I.Info />} onSelect={() => onAct('info')}>{t('desk.now.infoOptions')}</MenuItem>
          </>
        )}
      </Menu>
    )
  }
  return (
    <Menu x={x} y={y} anchor={anchor} onClose={onClose} title={title}>
      {playable && <MenuItem icon={<I.Play />} onSelect={() => onAct('now')}>{t('desk.actions.playNow')}</MenuItem>}
      {playable && queueable && queueRows}
      {item.inPlaylist && <><MenuSep /><MenuItem icon={<I.Trash />} danger onSelect={() => onAct('removeFromPlaylist')}>{t('desk.playlists.removeSong')}</MenuItem></>}
      {playable && <MenuSep />}
      <MenuItem icon={<I.Star />} disabled={!playable && !item.favorite_uri} note={playable || item.favorite_uri ? '' : t('desk.menu.disabledNote')} onSelect={() => onAct(saved ? 'unfavorite' : 'favorite')}>{t(saved ? 'desk.favorites.remove' : 'desk.actions.addFavorite')}</MenuItem>
      {(playable && queueable) || (!playable && item.is_container && item.playlist_policy) ? (
        <MenuItem icon={<I.Playlist />} disabled={!playable && !item.favorite_uri} onSelect={() => onAct('addToPlaylist')}>{t('desk.favorites.addToSonosPlaylist')}</MenuItem>
      ) : null}
      {(playable || (item.is_container && ['playlist', 'album', 'artist', 'show'].includes(item.item_type))) && (
        <><MenuSep /><MenuItem icon={<I.Info />} onSelect={() => onAct('info')}>{t('desk.now.infoOptions')}</MenuItem></>
      )}
      {canUnselect && <><MenuSep /><MenuItem icon={<I.Close />} onSelect={() => onAct('unselect')}>{t('desk.actions.unselectAll')}</MenuItem></>}
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
    <Sheet kind="bottom" title={t('desk.playlists.addTitle')} onClose={onClose}>
      <SheetBar title={t('desk.playlists.addTitle')} sub={items.length === 1 ? items[0].title : t.plural('common.items', items.length)} onClose={onClose} />
      <div className="mg-sheet-body">
        {playlists === null ? <Skeleton label={t('desk.browse.loading')} kind="list" rows={6} /> : (
          <div className="mg-list">
            <ListItem leading={<span className="mg-li-glyph mg-li-glyph-primary"><I.Plus /></span>} headline={t('desk.playlists.new')} onClick={() => setNaming(true)} />
            {playlists.map((item) => (
              <ListItem key={item.id} leading={<span className="mg-li-glyph" style={{ clipPath: KIND_SHAPES.playlist }}><I.Playlist /></span>} headline={item.title}
                        disabled={busy} onClick={() => { if (!busy) addAll(item.id, item.title) }} />
            ))}
          </div>
        )}
      </div>
      {naming && (
        <Confirm title={t('desk.playlists.nameTitle')} body={t('desk.playlists.nameBody')} action={t('common.ok')} icon={<I.Playlist />} input={{ initial: '', label: t('desk.playlists.nameTitle') }}
                 onClose={() => setNaming(false)}
                 onConfirm={async (title) => { setNaming(false); const made = await actions.createPlaylist(hzone, title); if (made?.id) await addAll(made.id, title) }} />
      )}
    </Sheet>
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
    <Sheet kind="dialog" title={t('desk.radio.title')} onClose={onClose}>
      <span className="mg-dialog-icon" aria-hidden="true"><I.Radio /></span>
      <h2 className="mg-dialog-headline" data-centered="">{t('desk.radio.title')}</h2>
      <div className="mg-dialog-body mg-stack">
        <p>{t('desk.radio.intro')} {t('desk.radio.where')}</p>
        <TextField label={t('desk.radio.url')} type="url" value={url} placeholder="http://" autoFocus onChange={setUrl} onEnter={submit} />
        <TextField label={t('desk.radio.name')} value={name} onChange={setName} onEnter={submit} />
      </div>
      <footer className="mg-dialog-actions">
        <Button variant="text" onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="text" disabled={!urlOk || !nameOk || busy || !zone} onClick={submit}>{t('common.ok')}</Button>
      </footer>
    </Sheet>
  )
}

