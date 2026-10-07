import React, { useEffect, useMemo, useRef, useState } from 'react'
import { SONOS_RADIO } from '../lib/sonosServices.js'
import { useSystem } from '../lib/store.jsx'
import { useI18n } from '../i18n/index.jsx'
import { useMyRadioStations } from '../lib/myRadio.js'
import { api } from '../lib/api.js'
import { orderedHouseholds } from '../lib/format.js'
import * as Icon from '../components/Icons.jsx'
import { playTarget } from '../lib/browserRoom.js'
import { CautionBadge, serviceCaution } from '../components/CautionBadge.jsx'
import { readLibraryPrefs, libraryRows } from '../lib/libraryPrefs.js'
import { libraryScope, searchLibrary } from '../lib/librarySearch.js'
import { canEnqueue, isPlayableLeaf, providerIdOf } from '../lib/items.js'
import Art, { nowPlayingArt } from '../components/Art.jsx'
import { Confirm } from './Dialogs.jsx'
import { itemAccount } from '../lib/itemAccount.js'
import { versionLabel } from '../lib/version.js'

// The Music pane. Its header reads "Select a Music Source" at the root and the
// container's title below it, with a 42px back button on the left and a 30px
// "Music" home button on the right. Rows are 50px with 40px art at x=8, a
// title from x=56, a 12px disclosure for containers and a 44px actions button.
//
// The root list is what the S1 controller shows, one set per system: Sonos
// Favorites, Music Library, Sonos Playlists, Radio by TuneIn, and each
// configured service. Because a household has its own favorites, library and
// services, and a source only plays into a room of its own system, the root
// is grouped under an "S1" / "S2" header per household, filtered by the toggle
// in the transport strip. Each row remembers which household it belongs to, so
// browsing and playing use a room from that system.

const ROOT = { id: '__root', title: '' }

export default function Browse({
  households, zones, groups, systemFilter, activeZone,
  query, onDone, onAddServices, onLinkService, servicesVersion = 0, homeSignal = 0, favoritesSignal = 0,
  selectionCommand = null, addServicesAsPage = false, roomChosen = true,
  onSleepTimer, onAlarms, infoSignal = 0, infoItem = null, scope = null, onScope, onScopes, onMessage, onAddRadio,
  queueEdited = false, onQueueReplaced, icons = null, onLibrarySettings = null,
  // The Mac app shows each library song's cover in its Songs list; the
  // Windows app leaves the slot empty (both S2 apps, 2026-09-29).
  librarySongArt = false,
}) {
  const { actions } = useSystem()
  // A theme may hand over its own drawings of the shared glyphs.
  const G = icons ? { ...Icon, ...icons } : Icon
  const { t } = useI18n()
  const [stack, setStack] = useState([ROOT])
  // The app keeps the row you browsed into painted like a hovered row once you
  // come back to the list (its keyboard selection); so does Sonora.
  const [lastRoot, setLastRoot] = useState(null)
  const [items, setItems] = useState([])
  // The service's DisplayType map for the page's rows (see the Row).
  const [displayTypes, setDisplayTypes] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // Whether the error is the service refusing the browse outright, which the
  // Mac app words as "Unable to browse music" in the middle of the pane.
  const [failed, setFailed] = useState(false)
  // A service configured in the Sonos app but not linked in Sonora browses with
  // no token and comes back needs_auth. Rather than a dead end, offer to link
  // it here. Distinct from `error`, which stays a plain message.
  const [needsLink, setNeedsLink] = useState(false)
  const lastNode = useRef(null)
  const [menu, setMenu] = useState(null)
  const [refresh, setRefresh] = useState(0)
  // Rows ticked through the hover checkbox; the menu's queue actions take
  // them all when the clicked row is among them.
  const [checked, setChecked] = useState(() => new Set())
  const [rename, setRename] = useState(null)
  const [naming, setNaming] = useState(null)      // a playlist to rename, or 'new'
  const [replaceAsk, setReplaceAsk] = useState(null) // pending Play/Shuffle while the queue is edited
  // The app slides pages: the new list enters from the right (from the left
  // for Back) over 350ms with an exponential ease while the old one leaves.
  // A static copy of the outgoing list is what slides out.
  const [slide, setSlide] = useState(null)
  const slideTimer = useRef(null)
  const navigate = (nextStack, dir) => {
    const html = scroller.current ? scroller.current.innerHTML : ''
    clearTimeout(slideTimer.current)
    setSlide({ html, dir, key: Date.now() })
    slideTimer.current = setTimeout(() => setSlide(null), 360)
    // A page remembers the row opened from it, and shows it selected on the
    // way back, as the app's lists do (TuneIn > iHeartRadio and back;
    // Local Radio after Pick a City, 2026-09-23). Local Radio is marked by
    // what it is, since its id is the location and changes with the city.
    const deeper = nextStack.length > stack.length
      && stack.every((entry, index) => nextStack[index]?.id === entry.id)
    if (deeper) {
      const into = nextStack[stack.length]
      // The id, and the title as a fallback: this page is read again on the
      // way back, and some services mint new ids every time (TuneIn's
      // "featured:c100005513--<session>").
      const picked = into.localRadio ? '__local' : into.id
      nextStack = nextStack.map((entry, index) => (index === stack.length - 1
        ? { ...entry, picked, pickedTitle: into.localRadio ? '' : into.title || '' } : entry))
    }
    setStack(nextStack)
  }
  // One row per service; a household holding several accounts on it shows
  // the chosen account on the row and a dropdown to switch, as the app does.
  // The choice is kept in this browser across page loads and sessions, as
  // the app keeps its own (asked for 2026-09-07).
  const [accountChoice, setAccountChoice] = useState(() => {
    try { return JSON.parse(localStorage.getItem(ACCOUNT_CHOICE_KEY) || '{}') || {} } catch { return {} }
  })
  const [accountMenu, setAccountMenu] = useState(null)
  const [servicesByHh, setServicesByHh] = useState({})
  // Which households have a music library share; the app lists Music
  // Library only when there is one (observed 2026-09-05).
  const [libraryByHh, setLibraryByHh] = useState({})
  const scroller = useRef(null)
  const node = stack[stack.length - 1]
  // Whether a service keeps playlists of the account's own, per service and
  // account, asked when a song's menu first opens on it: the menu then
  // offers "Add to <service> (<account>) Playlist" as the app's does.
  const [userPlaylistsBy, setUserPlaylistsBy] = useState({})
  const menuService = menu?.item && !menu.item.root && !menu.item.is_container && (menu.item.service || node.service)
  const menuAccount = (menu?.item?.uri || '').match(/[?&]sn=(\d+)/)?.[1] || ''
  const menuKey = menuService ? `${menuService}:${menuAccount}` : ''
  useEffect(() => {
    if (!menuKey || menuKey in userPlaylistsBy || !menu?.item?.hzone) return
    const [sid, account] = menuKey.split(':')
    setUserPlaylistsBy((prev) => ({ ...prev, [menuKey]: false }))
    api.userPlaylists(Number(sid), { zone: menu.item.hzone, account, probe: true })
      .then((r) => setUserPlaylistsBy((prev) => ({ ...prev, [menuKey]: Boolean(r?.available) }))).catch(() => {})
  }, [menuKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const menuServiceLabel = (() => {
    if (!menuKey || !userPlaylistsBy[menuKey]) return null
    const same = (servicesByHh[node.hh] || []).filter((svc) => svc.id === Number(menuService))
    if (!same.length) return null
    const nick = same.length > 1 ? same.find((svc) => String(svc.account_id ?? '') === menuAccount)?.nickname || '' : ''
    return t('desk.favorites.addToServicePlaylist', { service: nick ? `${same[0].name} (${nick})` : same[0].name })
  })()
  // Ticks belong to the page they were made on.
  useEffect(() => { setChecked(new Set()) }, [node])
  // The node keeps what was true when it was opened; the row in the current
  // services list says what is true now.
  const sameService = node.service != null
    ? (servicesByHh[node.hh] || []).filter((s) => s.id === node.service) : []
  const liveRow = sameService.find((s) => (s.account_id ?? '') === (node.account ?? ''))
    ?? (!node.account && sameService.length === 1 ? sameService[0] : null)
  const caution = liveRow ? serviceCaution(liveRow) : node.caution
  const liveAccount = liveRow?.account_id ?? node.account ?? ''
  // A service removed while its pane is open (from Service Settings, or in
  // another app) has nothing left to show; the pane returns to the listing.
  // Only a household whose list has loaded can say the service is gone.
  useEffect(() => {
    if (node.service == null) return
    const list = servicesByHh[node.hh]
    if (!list || list.some((s) => s.id === node.service)) return
    setStack([ROOT])
  }, [node, servicesByHh])

  // A home request from the header or the Window menu returns to the root.
  useEffect(() => { if (homeSignal) setStack([ROOT]) }, [homeSignal])
  // The app's keys that act on what is ticked: Play Selected Track Next,
  // Replace Queue with Selection, Play Selection Later. They do exactly what
  // the row menu's entries do, on the same rows.
  useEffect(() => {
    if (!selectionCommand?.how) return
    const rows = items.filter((i) => checked.has(i.id) && i.uri)
    const target = rows[0] || items.find((i) => i.uri)
    if (target) act({ ...target, hzone: node.hzone }, selectionCommand.how)
  }, [selectionCommand])  // eslint-disable-line react-hooks/exhaustive-deps

  // The app's Ctrl+* jumps straight to Sonos Favorites from wherever you are.
  useEffect(() => {
    if (!favoritesSignal) return
    const row = sections.flatMap((sec) => sec.rows).find((r) => r.id === 'FV:2')
    if (row?.hzone) navigate([ROOT, { id: 'FV:2', title: row.title, item: 'root', hzone: row.hzone, hh: row.hh, Glyph: row.Glyph, icon: row.icon }], 'forward')
  }, [favoritesSignal])  // eslint-disable-line react-hooks/exhaustive-deps
  // The Windows app's Info & Options is a page of this pane, not a window:
  // the header (i) pushes it, showing the active room's track.
  useEffect(() => {
    if (!infoSignal || !activeZone) return
    // Already showing: the page stays put, with no slide (reported
    // 2026-09-23 on the header (i)).
    const top = stack[stack.length - 1]
    if (top?.info && (infoItem
      ? top.id === '__info-item' && top.item && (top.item.id || top.item.uri) === (infoItem.id || infoItem.uri)
      : top.id === '__info' && top.hzone === activeZone.uuid)) return
    const transport = activeZone.transport || {}
    const hh = households.find((h) => h.zone_uuids.includes(activeZone.uuid))
    const sid = infoItem ? Number((/[?&]sid=(\d+)/.exec(infoItem.uri || '') || [])[1]) || transport.service_id : transport.service_id
    const service = (servicesByHh[hh?.id] || []).find((svc) => svc.id === sid)
    // Slides in like any other page, as the app's does. A queue row's Info &
    // Options hands its item in; the header (i) shows the playing track.
    navigate([...stack.filter((n) => !n.info),
      infoItem
        ? { id: '__info-item', info: true, title: t('desk.now.infoOptions'), icon: service?.icon || '',
            Glyph: Icon.serviceGlyph(sid), item: { ...infoItem, serviceName: service?.name || '' },
            hzone: activeZone.uuid, hh: hh?.id, serviceName: service?.name || '' }
        : { id: '__info', info: true, title: t('desk.now.infoOptions'), icon: service?.icon || '',
            Glyph: Icon.serviceGlyph(sid), zone: activeZone, hzone: activeZone.uuid, hh: hh?.id,
            serviceName: transport.service_name || service?.name || '' }], 'forward')
  }, [infoSignal])  // eslint-disable-line react-hooks/exhaustive-deps

  // A representative room for a household: the active room when it belongs to
  // that household, otherwise the household's first room. This is the room a
  // source from that system browses and plays through.
  const zoneForHousehold = useMemo(() => (hid) => {
    const household = households.find((h) => h.id === hid)
    if (!household) return null
    if (activeZone && household.zone_uuids.includes(activeZone.uuid)) return activeZone
    for (const uuid of household.zone_uuids) {
      if (zones[uuid]) return zones[uuid]
    }
    return null
  }, [households, zones, activeZone])

  const activeHouseholdId = useMemo(() => {
    if (!activeZone) return null
    return households.find((h) => h.zone_uuids.includes(activeZone.uuid))?.id ?? null
  }, [households, activeZone])

  // One call returns every household's services; keep them keyed by household.
  useEffect(() => {
    let canceled = false
    api.services().then((result) => {
      if (canceled) return
      const map = {}
      for (const hh of result.households || []) {
        const list = [...(hh.in_use || [])]
        // TuneIn is built into an S1 household and needs no account, so the
        // app lists it among the services whether or not anything from it
        // has been saved; it browses anonymously over SMAPI. On S2 it is not
        // built in at all -- Sonos Radio and "TuneIn (New)" replaced it, and
        // the S2 app's own source list has no TuneIn row (measured against
        // this household 2026-09-11), so nothing is added there.
        const tunein = hh.generation === 'S1' ? (hh.available || []).find((svc) => svc.id === 254) : null
        if (tunein && !list.some((svc) => svc.id === 254)) list.push({ ...tunein, in_use: true })
        map[hh.household] = list
      }
      setServicesByHh(map)
    }).catch(() => { if (!canceled) setServicesByHh({}) })
    for (const h of households) {
      const zone = h.zone_uuids?.[0]
      if (!zone) continue
      api.librarySettings(zone).then((r) => {
        if (!canceled) setLibraryByHh((prev) => ({ ...prev, [h.id]: (r.shares || []).length > 0 }))
      }).catch(() => {})
    }
    return () => { canceled = true }
  }, [servicesVersion])

  // Deeper than the root: browse the container against its household's room.
  useEffect(() => {
    // Sonora's own nodes are namespaced with a double underscore -- the root,
    // Info & Options, Add a Service, Add to Playlist, the chime picker -- and
    // the pane draws every one of them itself. Only "__root" was held back
    // here, so opening Info & Options asked a speaker to browse an object
    // called "__info", which it answered 701 "no such object" while the
    // browser got a 409. Nineteen of them in one log, and every 701 in that
    // log was this.
    if (node.id?.startsWith('__') || !node.hzone) {
      setItems([]); setError(''); setNeedsLink(false); return undefined
    }
    let canceled = false
    // Drop the previous container's rows at once, so a slow fetch (Plex's
    // Other Sources asks several servers) never shows the old list under the
    // new title.
    // A different node starts from empty; a refresh of the same node (the
    // household's services changed) refetches behind what is showing, so the
    // pane does not flash while speakers and cloud settle after an add.
    const fresh = lastNode.current !== node
    lastNode.current = node
    if (fresh) { setItems([]); setLoading(true); setError(''); setNeedsLink(false) }
    const fetcher = node.service
      ? api.browseService(node.service, { zone: node.hzone, item: node.item ?? 'root', count: 200,
                                          account: liveAccount })
      : api.browse(node.id, { zone: node.hzone, count: 200 })
    fetcher.then((result) => {
      if (canceled) return
      setItems(result.items || [])
      setDisplayTypes(result.display_types || {})
      setError(''); setNeedsLink(false); setFailed(false)
      if (result.error) {
        // A service that needs an account can be linked in Sonora right here;
        // anything else is just a message.
        // Whether a provider will actually sign in from here is only known by
        // asking it (Plex and Spotify do despite being "AppLink"; SoundCloud
        // refuses), so the button is always offered and the link flow reports
        // the provider's answer.
        if (result.error.needs_auth && node.service) setNeedsLink(true)
        else setError(result.error.needs_auth
          ? t('services.needsSignIn', { service: node.serviceName || node.title })
          : result.error.message)
        setFailed(!result.error.needs_auth)
      }
      setLoading(false)
      if (scroller.current) scroller.current.scrollTop = 0
    }).catch((exc) => {
      if (canceled) return
      setItems([]); setLoading(false)
      setError(exc?.message || t('notice.error.title')); setFailed(true)
    })
    return () => { canceled = true }
  }, [node, servicesVersion, liveAccount, refresh, t])

  // Naming the page after the system it will add to, so "Add Music Services"
  // becomes "Add S1 Music Services" once a system is settled on (2026-09-06).
  const openAddServices = (household) => {
    if (!household) return
    const section = sections.find((sec) => sec.household.id === household.id)
    navigate([...stack, { id: '__addsvc', addServices: true,
                          title: t('desk.browse.addServicesFor', { gen: household.generation }),
                          Glyph: Icon.Plus, hh: household.id,
                          hzone: section?.rows?.[0]?.hzone || '' }], 'forward')
  }

  // The root, grouped by system: one section per visible household.
  // Whether each system's speakers have an update waiting; read with the
  // page and every ten minutes (the speakers look for updates themselves).
  const [updatesByHh, setUpdatesByHh] = useState({})
  const [updateAsk, setUpdateAsk] = useState(null)
  const householdIds = households.map((h) => h.id).join(',')
  useEffect(() => {
    let canceled = false
    const read = () => {
      for (const h of households) {
        api.softwareUpdate(h.id)
          .then((r) => { if (!canceled) setUpdatesByHh((prev) => ({ ...prev, [h.id]: r })) })
          .catch(() => {})
      }
    }
    read()
    const timer = setInterval(read, 600000)
    return () => { canceled = true; clearInterval(timer) }
  }, [householdIds]) // eslint-disable-line react-hooks/exhaustive-deps

  const sections = useMemo(() => {
    const visible = orderedHouseholds(households).filter(
      (h) => !systemFilter || systemFilter === 'all' || h.id === systemFilter)
    // A system header only when more than one system is on show; a single
    // system's list starts with its rows, as the app's does.
    const showHeaders = visible.length > 1
    return visible.map((h) => {
      const hzone = zoneForHousehold(h.id)
      const rows = [
        // A speaker update waiting heads the list, as it does in the apps.
        // Only the speakers' own: the Mac app also puts its self-update
        // here, which is nothing Sonora has (2026-09-23).
        ...(updatesByHh[h.id]?.pending
          ? [{ id: 'update', title: t('desk.browse.updateNow'), Glyph: Icon.Update, action: true }] : []),
        { id: 'FV:2', title: t('desk.browse.favorites'), Glyph: Icon.Star, container: true },
      ]
      // The room's own television input, directly under Sonos Favorites and
      // above Music Library, which is where the app puts it (measured
      // 2026-09-11). It belongs to the active room's system only.
      if (h.id === activeHouseholdId && activeZone
          && /arc|beam|ray|playbar|playbase|amp/i.test(activeZone.model || '')) {
        rows.push({ id: 'tv', title: t('common.tv'), Glyph: Icon.Tv, playable: true,
                    uri: `x-sonos-htastream:${activeZone.uuid}:spdif` })
      }
      // The Mac app lists Music Library with no folders shared as well, and
      // opens it on the words below (2026-09-29); a shell measured against it
      // passes onLibrarySettings.
      if (libraryByHh[h.id] !== false || onLibrarySettings) rows.push({ id: 'A:', title: t('desk.browse.library'), Glyph: Icon.Library, container: true })
      // The app's order: Sonos Radio, then every service A-Z (TuneIn among
      // them), then Sonos Playlists and the room's inputs.
      const byService = new Map()
      for (const service of servicesByHh[h.id] || []) {
        const list = byService.get(service.id) || []
        list.push(service)
        byService.set(service.id, list)
      }
      const services = []
      for (const [sid, accounts] of byService) {
        const chosen = accountChoice[`${h.id}:${sid}`]
        // Until someone picks from the row's caret, the account Sonora can
        // actually browse leads. This household holds two Spotify accounts;
        // the app opens either, Sonora only the one it has its own sign-in
        // for, and taking the list's first opened Spotify on a "Sonora Link
        // Required" page while the app was showing alexsounds's rows
        // (2026-09-14).
        const service = accounts.find((a) => (a.account_id ?? '') === chosen)
          || accounts.find((a) => a.sonora_token || a.sonora_linked)
          || accounts[0]
        services.push({
          id: `svc:${sid}`, title: service.name,
          sub: accounts.length > 1 ? service.nickname : '',
          accounts: accounts.length > 1 ? accounts : null,
          icon: service.icon, Glyph: Icon.serviceGlyph(sid), container: true, service: sid,
          caution: serviceCaution(service), gen: h.generation, initials: service.initials,
          account: service.account_id ?? '',
        })
      }
      const rank = (row) => (row.service === SONOS_RADIO ? 0 : 1)
      services.sort((a, b) => rank(a) - rank(b)
        || a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
      rows.push(...services)
      rows.push({ id: 'SQ:', title: t('desk.browse.playlists'), Glyph: Icon.Playlist, container: true })
      // Line-In is listed whether or not anything is plugged in, but only
      // where a player could take a cable at all: the S2 system here is an
      // Arc Ultra, a Beam and a Ray, none of which has a socket, and the
      // app's source list for it has no Line-In row (2026-09-11).
      if ((h.zone_uuids || []).some((uuid) => zones[uuid]?.supports_line_in)) {
        rows.push({ id: 'linein', title: t('desk.browse.lineIn'), Glyph: G.LineIn, container: true })
      }
      for (const row of rows) { row.hzone = hzone?.uuid || null; row.hh = h.id }
      // With both systems on show, the sources of the system the selected
      // room does not belong to are dimmed and inert: an S1 room cannot play
      // an S2 system's services, and the other way round. Nothing selected
      // (no room at all) leaves every row live (user request 2026-09-06).
      const otherSystem = showHeaders && roomChosen && activeHouseholdId && h.id !== activeHouseholdId
      if (otherSystem) for (const row of rows) row.disabled = true
      return { household: h, header: showHeaders ? h.generation : '', rows, otherSystem }
    })
  }, [households, zones, systemFilter, servicesByHh, libraryByHh, accountChoice,
      activeHouseholdId, activeZone, zoneForHousehold, roomChosen, updatesByHh, t])

  // TuneIn's local-radio row is named after the household's own location, as
  // the app names it: SCLib has RHHSTR_LOCALRADIO taking the city and
  // RHHSTR_LOCALRADIO_NOLOCDCR for a household with none. The speakers hold
  // both the city and TuneIn's node for it in R_RadioLocation.
  const [radioLocation, setRadioLocation] = useState({ node: '', city: '' })
  // Bumped after Change Location writes, so the Local Radio row renames at
  // once rather than on the next visit.
  const [locationEpoch, setLocationEpoch] = useState(0)
  useEffect(() => {
    const hzone = sections[0]?.rows?.[0]?.hzone || ''
    let canceled = false
    api.radioLocation(hzone).then((r) => { if (!canceled) setRadioLocation(r || { node: '', city: '' }) }).catch(() => {})
    return () => { canceled = true }
  }, [sections[0]?.household?.id, locationEpoch]) // eslint-disable-line react-hooks/exhaustive-deps


  // The services the search box may search: every account of every service on
  // the systems in view that can be searched at all, each searched through its
  // own household's room. Bit 0 of a service's Capabilities is search, which
  // is why the app's list leaves out Pocket Casts and Libby by OverDrive
  // (measured 2026-09-07), and the order is the source list's -- Sonos Radio,
  // then the rest by name.
  useEffect(() => {
    const list = []
    for (const h of orderedHouseholds(households)) {
      if (systemFilter && systemFilter !== 'all' && h.id !== systemFilter) continue
      const hzone = zoneForHousehold(h.id)
      // A household with a music library searches that first, as both
      // desktop apps do (lib/librarySearch.js).
      if (libraryByHh[h.id] !== false) list.push(libraryScope(h, hzone?.uuid, t))
      // One entry per service, named for the account this controller uses
      // for it: the S1 Windows app lists "Spotify (brettface)" and the Mac
      // app "Spotify (Kate's Spotify)" for the same household, each the
      // account it had chosen, never both (2026-10-02). Sonora's choice is
      // the service row's caret, else the account it holds a login for.
      const all = (servicesByHh[h.id] || []).filter((svc) => ((svc.capabilities ?? 0) & 1) === 1)
      const searchable = all
        .filter((svc, n) => {
          const same = all.filter((other) => other.id === svc.id)
          if (same.length < 2) return true
          const pick = itemAccount('-', same, svc.id)
          return String(svc.account_id ?? '') === pick && same.findIndex((o) => String(o.account_id ?? '') === pick) === same.indexOf(svc)
        })
        .sort((a, b) => (a.id === SONOS_RADIO ? 0 : 1) - (b.id === SONOS_RADIO ? 0 : 1)
          || (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }))
      for (const svc of searchable) {
        list.push({ key: `${h.id}:${svc.id}:${svc.account_id ?? ''}`, id: svc.id, name: svc.name,
                    nickname: svc.nickname || '', icon: svc.icon, account: svc.account_id ?? '',
                    // How many accounts the service has, so the one listed
                    // still names its account, "Spotify (brettface)".
                    accounts: all.filter((other) => other.id === svc.id).length,
                    hh: h.id, hzone: hzone?.uuid || null, gen: h.generation })
      }
    }
    onScopes?.(list)
    if (list.length && (!scope || !list.some((item) => item.key === scope.key))) onScope?.(list[0])
  }, [servicesByHh, households, systemFilter, zoneForHousehold, libraryByHh])  // eslint-disable-line react-hooks/exhaustive-deps

  // The search scope follows the service the selected room is playing, as
  // the app's pill does; the menu can still pick another until it changes.
  // The app tints the row of the station the room is playing, at rest, with
  // the same fill as hover: #262626 against #1a1a1a, measured on the S1 app's
  // My Radio Stations (2026-09-12). Matched on the service item in the URI,
  // because the flags and serial a speaker reports differ from the ones the
  // browse list carries for the same station.
  const streamId = (uri) => {
    const found = /^x-sonosapi-(?:stream|radio|hls):([^?]+)/.exec(uri || '')
    return found ? decodeURIComponent(found[1]) : ''
  }
  const nowStream = streamId(activeZone?.transport?.media_uri || '')
  const playingSid = activeZone?.transport?.service_id ?? null
  useEffect(() => {
    if (!playingSid || !onScope || !activeZone) return
    const hh = households.find((h) => h.zone_uuids.includes(activeZone.uuid))
    const match = (servicesByHh[hh?.id] || []).find((svc) => svc.id === playingSid)
    if (!match) return
    const hzone = zoneForHousehold(hh.id)
    onScope({ key: `${hh.id}:${match.id}:${match.account_id ?? ''}`, id: match.id, name: match.name,
              nickname: match.nickname || '', icon: match.icon, account: match.account_id ?? '',
              hh: hh.id, hzone: hzone?.uuid || null, gen: hh.generation })
  }, [playingSid, activeZone?.uuid, servicesByHh])  // eslint-disable-line react-hooks/exhaustive-deps

  // Entering a service also makes it the scope, as the app's pill switches
  // when you click into a source. Whichever changed last, the source being
  // browsed or the service playing, is what the box searches.
  useEffect(() => {
    if (!node.service || !onScope) return
    const match = (servicesByHh[node.hh] || []).find((svc) => svc.id === node.service
      && String(svc.account_id ?? '') === String(node.account ?? ''))
      || Object.values(servicesByHh).flat().find((svc) => svc.id === node.service)
    if (!match) return
    onScope({ key: `${node.hh}:${node.service}:${node.account ?? ''}`, id: node.service, name: match.name,
              nickname: match.nickname || '', icon: match.icon, account: node.account ?? '',
              hh: node.hh, hzone: node.hzone, gen: node.gen })
  }, [node.service, node.account])  // eslint-disable-line react-hooks/exhaustive-deps

  // A search: the term goes to the scoped service, category by category, a
  // moment after typing stops.
  // A search: the term goes to the scoped service a moment after typing
  // stops. The apps put a scope bar over the results naming every category
  // the provider searches and ask for one at a time, so a category is only
  // fetched when its tab is showing (asking for all six of Pandora's cost
  // 18 seconds; one costs about two).
  const [search, setSearch] = useState({ term: '', available: [], category: '', categories: [], loading: false, error: '' })
  const [pickedCategory, setPickedCategory] = useState('')
  // A dimmed system's sources start collapsed and its header grows a caret,
  // so the list stays about the rooms you can actually play to (user request
  // 2026-09-06). Re-opening one is remembered while it stays dimmed.
  const [openOther, setOpenOther] = useState(() => new Set())
  // The picked tab outlives a change of scope where the new service has it
  // too: Songs chosen over Plex stays Songs over Pandora in the Windows app
  // (2026-10-02). A service without it opens on its first tab, below.
  useEffect(() => {
    const term = query.trim()
    if (!scope || !term) { setSearch({ term: '', available: [], category: '', categories: [], loading: false, error: '' }); return undefined }
    let canceled = false
    setSearch((prev) => ({ ...prev, loading: true, error: '' }))
    const timer = setTimeout(() => {
      if (scope.library) {
        searchLibrary({ zone: scope.hzone, term, picked: pickedCategory, t })
          .then((result) => { if (!canceled) setSearch({ term, loading: false, error: '', ...result }) })
          .catch((exc) => { if (!canceled) setSearch({ term, available: [], category: '', categories: [], loading: false, error: exc?.message || '' }) })
        return
      }
      api.searchService(scope.id, { zone: scope.hzone, term, account: scope.account, category: pickedCategory })
        .then((result) => {
          if (canceled) return
          // The scope bar names the categories the provider searches, and
          // the "all" some of them declare is not one of them: the app's
          // bar over Pandora reads Artists, Albums, Genres, Stations,
          // Playlists, Songs, and opens on the first (the core does the
          // same -- SearchViewModel.UpdateCategories sets its index to 0).
          const available = (result.available || []).filter((cat) => cat.id !== 'all')
          if (available.length && !available.some((cat) => cat.id === pickedCategory)) {
            setPickedCategory(available[0].id)
            return
          }
          setSearch({ term, available, loading: false,
                      category: pickedCategory || available[0]?.id || '',
                      categories: result.categories || [],
                      // Results read their lines from the service's own
                      // DisplayType map, the same one a browse page uses.
                      displayTypes: result.display_types || {},
                      error: result.error ? result.error.message : '' })
        })
        .catch((exc) => { if (!canceled) setSearch({ term, available: [], category: '', categories: [], loading: false, error: exc?.message || '' }) })
    }, 450)
    return () => { canceled = true; clearTimeout(timer) }
  }, [query, scope, pickedCategory])

  // Which system's block carries "Add Music Services": the one the chosen
  // room is on, or the first on show when nothing is chosen. Hidden while a
  // search is filtering the list.
  const addHouseholdId = useMemo(() => {
    if (query.trim()) return null
    const visible = sections.map((sec) => sec.household.id)
    if (activeHouseholdId && visible.includes(activeHouseholdId)) return activeHouseholdId
    return visible[0] || null
  }, [sections, activeHouseholdId, query])

  const q = query.trim().toLowerCase()
  const filteredSections = useMemo(() => {
    if (node.id !== '__root') return []
    if (!q) return sections
    return sections
      .map((s) => ({ ...s, rows: s.rows.filter((r) => r.title.toLowerCase().includes(q)) }))
      .filter((s) => s.rows.length > 0)
  }, [sections, q, node])

  const deepItems = useMemo(() => {
    if (node.id === '__root') return []
    if (!q) return items
    return items.filter((item) => [item.title, item.artist, item.album]
      .some((v) => v && v.toLowerCase().includes(q)))
  }, [items, q, node])

  const open = (item) => {
    if (item.disabled) return
    if (node.id === '__root') {
      if (item.id === 'update') { setUpdateAsk({ hh: item.hh, version: versionLabel(updatesByHh[item.hh]?.display, updatesByHh[item.hh]?.version) }); return }
      if (!item.playable) setLastRoot({ id: item.id, hh: item.hh })
      // Root rows carry their own household room; deeper items inherit the
      // node's room, since API items don't know which system they belong to.
      if (!item.hzone) return
      if (item.playable) { setMenu({ item }); return }
      // The saved-stations list is "My Radio Stations" inside TuneIn, as the
      // app titles it.
      if (item.id === 'linein') {
        navigate([...stack, { id: 'linein', lineIn: true, title: item.title, Glyph: G.LineIn,
                              hzone: item.hzone, hh: item.hh }], 'forward')
        return
      }
      // A service with several accounts is titled with the one in use, as
      // the app's header reads "Spotify (alexsounds)" (2026-09-07).
      const rootTitle = item.id === 'R:0/0' ? t('desk.radio.myStations')
        : item.sub && item.sub !== item.title ? `${item.title} (${item.sub})` : item.title
      navigate([...stack, { id: item.id, title: rootTitle, service: item.service,
                            item: 'root', hzone: item.hzone, hh: item.hh,
                            caution: item.caution, gen: item.gen, Glyph: item.Glyph,
                            icon: item.icon, initials: item.initials, account: item.account }], 'forward')
      return
    }
    if (!node.hzone) return
    if (item.available === false) return
    // A Sonos Favorite that is a playlist or album opens inside its service,
    // as the app's chevron rows do.
    if (node.id === 'FV:2' && item.browse_id && item.service_id) {
      const accounts = (servicesByHh[node.hh] || []).filter((s) => s.id === item.service_id)
      // A favorite remembers the account it was saved under, which may since
      // have left the system while the service stayed: Hamilton was saved
      // under Spotify account 9, and the S1 Mac app opens it with the
      // household's Spotify of today (2026-09-23). Sonora takes the account
      // the source list would, rather than asking to link one that is gone.
      const svc = accounts.find((s) => (s.account_id ?? '') === (item.account || ''))
        || accounts.find((s) => (s.account_id ?? '') === accountChoice[`${node.hh}:${item.service_id}`])
        || accounts.find((s) => s.sonora_token || s.sonora_linked)
        || accounts[0]
      navigate([...stack, { id: `${item.service_id}:${item.browse_id}`, title: item.title, service: item.service_id,
                            item: item.browse_id, hzone: node.hzone, hh: node.hh, account: svc ? (svc.account_id ?? '') : (item.account || ''),
                            serviceName: svc?.name || item.service_name || '',
                            icon: svc?.icon || '', Glyph: Icon.serviceGlyph(item.service_id),
                            // The DIDL's class says album in any language; the
                            // description is the saving app's words ("Album by
                            // Various Artists"), which the old lower-case test
                            // never matched, so an album favorite opened with
                            // pictured rows instead of numbered ones.
                            kind: /<upnp:class>object\.container\.album/.test(item.metadata || '') || /album/i.test(item.description || '') ? 'album' : 'playlist',
                            uri: item.uri, metadata: item.metadata, art: item.art }], 'forward')
      return
    }
    // As the app behaves: a container opens; a station or track does nothing
    // on a plain click. Its actions come from the row's caret or a right
    // click, which open the menu.
    if (isPlayableLeaf(item)) return
    if (node.pickCity && peek[item.id] === 'final') { chooseCity(item); return }
    if (item.is_container) {
      // A container the service says cannot be enumerated opens like any
      // other, onto an empty pane. Amazon Music's "Try Amazon Music Unlimited"
      // is the example: it holds a relatedActions openUrl to amzn.to and
      // enumerates to nothing, and Sonora used to follow that link into a new
      // browser window. The app does not -- walked 2026-09-14, single click
      // and double click both open the row's own pane, headed by the row's
      // name, reading "No selections are available.", and the browser is never
      // opened. Its right-click menu offers only Add to Sonos Favorites / Add
      // to Sonos Playlist, no Play and no Info & Options.
      navigate([...stack, { id: item.id, title: item.title, service: node.service,
                            item: item.id, hzone: node.hzone, hh: node.hh, account: node.account,
                            // The service's mark stays in the header all the way
                            // down, as the app's HeaderArt does. A service with a
                            // cloud logo carried `icon` already; one drawn from a
                            // glyph -- the built-in TuneIn -- lost its mark on the
                            // first step inside.
                            icon: node.icon, Glyph: node.Glyph,
                            // A library row comes as the speaker's DIDL, which names its
                            // kind in `kind` ("album"); a service row in item_type. Either
                            // way the page below needs to know it is an album, so its
                            // tracks are numbered rather than pictured (2026-09-14).
                            kind: item.item_type || item.kind || (node.id === 'SQ:' ? 'playlist' : undefined), displayType: item.display_type || '',
                            uri: item.uri, metadata: item.metadata, art: item.art, artist: item.artist,
                            pickCity: node.pickCity, serviceName: node.serviceName }], 'forward')
    }
  }

  // Picking a city, as the S1 Windows app does it (walked 2026-09-23): each
  // row of TuneIn's location tree is looked at one level down before it is
  // drawn. A row whose children are more places carries a chevron and opens;
  // one whose children are stations is a place you can live in -- Bermuda and
  // St. Pierre-Miquelon at the country level, a city further down -- drawn
  // with no chevron, and clicking it sets the household's local radio there
  // and returns to TuneIn's own first page, where Local Radio now names it. A
  // row with nothing under it at all ("Other North America") is not shown.
  const [peek, setPeek] = useState({})
  useEffect(() => {
    if (!node.pickCity || loading || !items.length) return undefined
    let canceled = false
    const ask = items.filter((entry) => entry.is_container && !(entry.id in peek))
    ask.forEach((entry) => {
      api.browseService(node.service, { zone: node.hzone, item: entry.id, count: 1, account: node.account })
        .then((data) => {
          if (canceled) return
          const first = (data.items ?? [])[0]
          const kind = !first ? 'empty' : first.is_container ? 'place' : 'final'
          setPeek((prev) => ({ ...prev, [entry.id]: kind }))
        })
        .catch(() => { if (!canceled) setPeek((prev) => ({ ...prev, [entry.id]: 'place' })) })
    })
    return () => { canceled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.pickCity, node.item, loading, items])

  const chooseCity = async (item) => {
    const done = await actions.setRadioLocation(node.hzone, item.id, item.title)
    setLocationEpoch((v) => v + 1)
    onMessage?.(t('desk.radio.locationSet', { city: done?.city || item.title }))
    const home = stack.findIndex((entry) => entry.service === node.service && (entry.item === 'root' || !entry.item))
    navigate(home >= 0 ? stack.slice(0, home + 1) : stack.slice(0, 1), 'back')
  }

  // A row as its menu and its keys see it.
  // A track dragged within a Sonos Playlist's own page moves there, as the
  // app's does (The Prize dragged above What Child Is This? on "test", the
  // S1 Windows app, 2026-09-29). Where it came from, and before which row it
  // would land; a drop on the queue still adds it as before.
  const [plDrag, setPlDrag] = useState(null)
  const [plDrop, setPlDrop] = useState(null)
  const reorderable = /^SQ:\d+$/.test(node.id || '') && !q
  const reorderFor = (index) => (reorderable ? {
    mark: plDrag != null && plDrop === index ? 'before'
      : plDrag != null && plDrop === shownItems.length && index === shownItems.length - 1 ? 'after' : '',
    onStart: () => { setPlDrag(index); setPlDrop(null) },
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
      // The rows move now; the refetch behind the write settles them.
      setItems((prev) => {
        const next = [...prev]
        const [moved] = next.splice(from, 1)
        next.splice(landing, 0, moved)
        return next
      })
      const done = await actions.movePlaylistTrack(node.hzone, node.id, from + 1, landing + 1)
      setRefresh((v) => v + 1)
      if (!done) onMessage?.(t('notice.error.title'))
    },
    onEnd: () => { setPlDrag(null); setPlDrop(null) },
  } : null)
  const rowItem = (item, index) => ({
    ...item, hzone: node.hzone, favorite: node.id === 'FV:2', radio: node.id === 'R:0/0' || node.id === 'R:0/1', playlist: node.id === 'SQ:',
    // A track sitting in a Sonos Playlist can be taken out of it, as the
    // app's menu offers (observed 2026-09-06).
    inPlaylist: /^SQ:\d/.test(node.id) ? node.id : '', position: index + 1,
    serviceLabel: item.service_label || item.service_name || serviceLabelFor(item, servicesByHh[node.hh]) })
  // Delete and Backspace remove the selected row where the app's list has a
  // delete action for it -- a Sonos Favorite, a Sonos Playlist, a track in
  // one (BrowseItemListBox: Key.Delete and Key.Back run RemoveFromBrowse,
  // which performs the item's SC_ACTIONID_DELETE_FAVORITE or DELETE_ITEM,
  // the same action as the menu's Remove). Elsewhere they do nothing.
  const removal = (at) => (at.id === 'FV:2' ? 'remove' : at.id === 'SQ:' ? 'deletePlaylist'
    : /^SQ:\d/.test(at.id || '') ? 'removeFromPlaylist' : null)

  const browseInto = (item) => {
    navigate([...stack, { id: item.id, title: item.title, service: node.service,
                          item: item.id, hzone: node.hzone, hh: node.hh, account: node.account,
                          icon: node.icon, kind: item.item_type, displayType: item.display_type || '', canPlay: item.can_play,
                          uri: item.uri, metadata: item.metadata, art: item.art, artist: item.artist }], 'forward')
  }

  // A search result opens inside its service (a container) or, for a
  // station or track, waits for its menu like any other row.
  // Double-clicking a result plays it, as the app does; a container opens.
  const playResult = (item) => {
    if (!scope?.hzone) return
    act({ ...item, hzone: scope.hzone, service: scope.id }, 'now')
  }
  const openResult = (item) => {
    if (!scope?.hzone || isPlayableLeaf(item) || !item.is_container) return
    onDone?.()
    navigate([...stack, { id: item.id, title: item.title, service: scope.id, item: item.id,
                          hzone: scope.hzone, hh: scope.hh, account: scope.account, gen: scope.gen,
                          icon: scope.icon, kind: item.item_type, displayType: item.display_type || '', canPlay: item.can_play,
                          uri: item.uri, metadata: item.metadata,
                          art: item.art, artist: item.artist }], 'forward')
  }

  // The app's description for a favorite: "<Service> Station", "<Service>
  // Playlist", "Album by <artist>", "By <artist>", else the service's name.
  const describeFavorite = (item, serviceName) => {
    const kind = item.item_type || (item.is_container ? 'container' : 'track')
    if (kind === 'program' || kind === 'stream' || /^x-sonosapi-(radio|stream|hls):/.test(item.uri || '')) return serviceName ? `${serviceName} Station` : 'Station'
    if (kind === 'album') return item.artist ? `Album by ${item.artist}` : (serviceName ? `${serviceName} Album` : 'Album')
    if (kind === 'track') return item.artist ? `By ${item.artist}` : serviceName
    if (item.is_container) return serviceName ? `${serviceName} Playlist` : 'Playlist'
    return serviceName
  }
  // The household's favorites, read when a row's menu opens, so the menu can
  // say Remove for a row that already is one: the app's menu on Pandora's
  // "Cocktail Jazz Radio", a favorite, reads "Remove from Sonos Favorites"
  // (reported 2026-09-23), as its Info & Options does.
  // Read with the page, so the first menu already knows: a Play:1 takes up
  // to four seconds to list the favorites, and asking again as each menu
  // opened canceled the read still under way. Read again after an add or a
  // remove made here.
  const [menuFavorites, setMenuFavorites] = useState({ hzone: '', items: [] })
  const [menuFavoritesVersion, setMenuFavoritesVersion] = useState(0)
  const menuZone = menu?.item?.hzone || node.hzone || ''
  useEffect(() => {
    if (!menuZone) return undefined
    let canceled = false
    api.favorites(menuZone).then((r) => { if (!canceled) setMenuFavorites({ hzone: menuZone, items: r?.items || [] }) }).catch(() => {})
    return () => { canceled = true }
  }, [menuZone, menuFavoritesVersion])
  const savedFavorite = (() => {
    const it = menu?.item
    if (!it || it.favorite || menuFavorites.hzone !== menuZone) return null
    const key = favoriteKey(it.uri || it.favorite_uri || '')
    return key ? menuFavorites.items.find((f) => favoriteKey(f.uri) === key) || null : null
  })()
  const act = async (item, how) => {
    const saved = savedFavorite
    setMenu(null)
    if (!item.hzone) return
    const service = item.service || node.service
    const serviceName = (servicesByHh[node.hh] || []).find((svc) => svc.id === service)?.name || scope?.name || ''
    if (how === 'unfavorite' && saved) {
      const done = await actions.removeFavorite(item.hzone, saved.id)
      if (done) onMessage?.(t('desk.info.removedFavorite', { title: saved.title || item.title }))
      setMenuFavoritesVersion((v) => v + 1)
      return
    }
    if (how === 'favorite') {
      const result = await actions.addFavoriteItem(item.hzone, {
        uri: item.uri || item.favorite_uri || '',
        metadata: item.metadata || item.favorite_metadata || '',
        title: item.title, art: item.art || '',
        description: describeFavorite(item, serviceName) })
      if (result) onMessage?.(t(result.exists ? 'desk.info.alreadyFavorite' : 'desk.info.addedFavorite', { title: item.title }))
      setMenuFavoritesVersion((v) => v + 1)
      return
    }
    if (how === 'info') {
      navigate([...stack.filter((n) => !n.info),
        { id: '__info-item', info: true, title: t('desk.now.infoOptions'), icon: node.icon || '',
          item: { ...item, serviceName, favoriteDescription: describeFavorite(item, serviceName) },
          source: node.id, hzone: item.hzone, hh: node.hh, serviceName }], 'forward')
      return
    }
    const body = service
      ? { uri: item.uri, metadata: item.metadata || '', service }
      : { uri: item.uri, metadata: item.metadata || '' }
    if (how === 'rename') { setRename(item); return }
    if (how === 'remove') {
      const done = await actions.removeFavorite(item.hzone, item.id)
      if (done) {
        // The row goes now; the refetch behind it settles the list, since a
        // speaker can hand the old list back for a moment after the write.
        setItems((prev) => prev.filter((entry) => entry.id !== item.id))
        setRefresh((v) => v + 1)
        onMessage?.(t('desk.favorites.removed', { title: item.title }))
      }
      return
    }
    if (how === 'removeFromPlaylist') {
      const done = await actions.removePlaylistTrack(item.hzone, item.inPlaylist, item.position)
      if (done) { setRefresh((v) => v + 1); onMessage?.(t('desk.playlists.removedSong', { title: item.title })) }
      return
    }
    if (how === 'unselect') { setChecked(new Set()); return }
    if (how === 'addToPlaylist') {
      // The app turns the browse pane into "Add Song to Playlist": the
      // household's playlists, a New Playlist row above the footer, and
      // Cancel where MUSIC sits (observed 2026-09-06).
      // A container with no play URI goes in by its favorite reference.
      const asPick = (i) => (i.uri ? i : { ...i, uri: i.favorite_uri || '', metadata: i.favorite_metadata || '' })
      const group = (checked.has(item.id) ? items.filter((i) => checked.has(i.id) && (i.uri || i.favorite_uri)) : [item]).map(asPick)
      navigate([...stack, { id: '__addpl', addToPlaylist: true, cancel: true,
                            title: t('desk.playlists.addTitle'), Glyph: Icon.Playlist,
                            picks: group, source: node.id, hzone: item.hzone, hh: node.hh }], 'forward')
      return
    }
    if (how === 'renamePlaylist') { setNaming(item); return }
    if (how === 'addToServicePlaylist') {
      const sid = Number(item.service || node.service)
      const account = (item.uri || '').match(/[?&]sn=(\d+)/)?.[1] || ''
      navigate([...stack, { id: `__svcpl-${item.id}`, servicePlaylist: true, cancel: true, title: menuServiceLabel || '',
                            icon: node.icon, sid, account, pick: { id: item.id, title: item.title },
                            hzone: item.hzone, hh: node.hh }], 'forward')
      return
    }
    if (how === 'deletePlaylist') {
      const done = await actions.removePlaylist(item.hzone, item.id)
      if (done) { setRefresh((v) => v + 1); onMessage?.(t('desk.playlists.deleted', { title: item.title })) }
      return
    }
    // Ticked rows travel together when the clicked row is one of them.
    const group = checked.has(item.id) ? items.filter((i) => checked.has(i.id) && i.uri) : [item]
    // The title travels with the request so the backend can compose the
    // metadata for a station that arrived without any -- the speakers' saved
    // radio list is the case that has none (2026-09-06).
    // The item's kind travels too: the backend keeps an audiobook out of the
    // queue and points the transport at it, as the app does (2026-09-08).
    const bodyFor = (i) => (service
      ? { uri: i.uri, metadata: i.metadata || '', title: i.title || '', service, kind: i.item_type || '' }
      : { uri: i.uri, metadata: i.metadata || '', title: i.title || '', kind: i.item_type || '' })
    // Browsing goes through a speaker; playing goes to the selected room,
    // which may be this browser.
    const into = (hzone) => playTarget(activeZone, hzone)
    // For the browser room, the browse zone travels with the request: it is
    // how the backend knows whose service login resolves the URI.
    const from = (hzone) => (activeZone?.local ? { from_zone: hzone } : {})
    if (how === 'now' && group.every((i) => isQueueable(i))) {
      // The app's Play Now on something queueable does not take over the
      // transport: it drops the item into the queue right after what is
      // playing and jumps to it (measured 2026-09-06 -- a Plex album playing
      // as Song [1/12] became Song [2/13]). The backend does the whole move,
      // including pointing the transport at the queue, because seeking a
      // queue the transport is not on answers 701 (2026-09-07).
      const zoneId = into(item.hzone)
      await actions.setSource(zoneId, { ...bodyFor(group[0]), ...from(item.hzone) })
      for (const i of group.slice(1).reverse()) {
        await actions.setSource(zoneId, { ...bodyFor(i), ...from(item.hzone), enqueue: true, next: true })
      }
    } else if (how === 'now' || how === 'replace') {
      await actions.setSource(into(item.hzone), { ...bodyFor(group[0]), ...from(item.hzone), ...(how === 'replace' ? { replace: true } : {}) })
      for (const i of group.slice(1)) await actions.setSource(into(item.hzone), { ...bodyFor(i), enqueue: true })
    } else if (how === 'next') {
      for (const i of [...group].reverse()) await actions.setSource(into(item.hzone), { ...bodyFor(i), enqueue: true, next: true })
    } else {
      for (const i of group) await actions.setSource(into(item.hzone), { ...bodyFor(i), enqueue: true })
    }
    setChecked(new Set())
    onDone?.()
  }
  // The album page's Play and Shuffle rows: the album plays at once, with
  // shuffle set or cleared as the row says.
  // Play (double-click): the album replaces the queue and plays from its first
  // track. Shuffle (single click, every time): shuffle goes on, the album
  // replaces the queue and the first item of the shuffled order plays.
  const playAlbum = async (shuffle, force = false) => {
    if (!node.hzone || !node.uri) return
    // The app asks first when the queue has been edited since it was loaded
    // ("The Queue Has Been Edited", observed 2026-09-05).
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
  const shuffled = /SHUFFLE/.test(activeZone?.transport?.play_mode || '')
  // Which panes carry the Play and Shuffle rows over their tracks: any
  // container the app can hand to a player whole. An album and a playlist
  // always could; so can a service's own list -- the app puts both rows over
  // Mixcloud's Trending, whose type is trackList (measured in the S1 app
  // 2026-09-20) -- and a plain folder of containers cannot.
  // The Play row wears the cover where there is one to wear -- an album's or
  // a playlist's -- and the stack glyph everywhere else: the app draws the
  // stack over Mixcloud's Trending even though the row that opened it carries
  // a star, and over the library's Songs list (measured 2026-09-20).
  // The library's Songs list is a playlist to the speaker but has no cover:
  // its Play row wears the stack glyph (S2 Windows app, 2026-09-29).
  const coverOnPlayRow = (node.kind === 'album' || node.kind === 'playlist') && node.id !== 'A:TRACKS'
  // The library's lists of artists, albums, composers and genres open with
  // their first row, not Play and Shuffle: the S2 app has those rows over
  // Songs and over an album, not over the lists that lead to them.
  const libraryIndexList = /^A:(ALBUM|ARTIST|ALBUMARTIST|COMPOSER|GENRE)$/.test(node.id || '')
  // Not over an artist-typed container, whatever it says of itself: each copy of a Plex song
  // ("Music / on <server>") is one, marked canPlay, and both S1 apps list the song in it with no
  // Play or Shuffle row (Windows and Mac, 2026-10-03). The rows come from the apps' core library,
  // so this is measured rather than read.
  const playsWhole = Boolean(node.uri) && !libraryIndexList && node.kind !== 'artist'
    && (node.canPlay !== false || node.kind === 'album' || node.kind === 'playlist')
  // The album page's own container as a menu item, for its Play row.
  const albumItem = () => ({ id: `${node.id}#album`, title: node.title, uri: node.uri, metadata: node.metadata || '',
                             art: node.art, artist: node.artist, is_container: true, item_type: 'album',
                             hzone: node.hzone, service: node.service })
  const toggleCheck = (id) => setChecked((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })

  // The Music Library's controller-side preferences (lib/libraryPrefs.js):
  // which rows its root shows and how a folder is ordered.
  const [libraryPrefs, setLibraryPrefs] = useState(readLibraryPrefs)
  useEffect(() => {
    const onPrefs = (event) => setLibraryPrefs(event.detail || readLibraryPrefs())
    window.addEventListener('sonora:libraryprefs', onPrefs)
    return () => window.removeEventListener('sonora:libraryprefs', onPrefs)
  }, [])
  // The library's own lists: the root relabeled and reordered as above, a
  // folder in the order the controller preference asks for. Declared after
  // the helpers it calls -- a const read above its own line blanks the shell.
  const bareLibrary = Boolean(onLibrarySettings) && node.id === 'A:' && !q && libraryByHh[node.hh] === false
  const shownItems = bareLibrary ? [] : libraryRows(node.id, deepItems, libraryPrefs, t)
    .filter((item) => !(node.pickCity && peek[item.id] === 'empty'))
  const initialOf = (item) => {
    const first = (item?.title || '').trim().charAt(0).toLocaleUpperCase()
    return /\p{L}/u.test(first) ? first : '#'
  }
  const anyRoom = households.some((h) => h.zone_uuids.length > 0)
  const title = node.id === '__root' ? t('desk.browse.root') : node.title
  const results = q ? t('desk.browse.results', { query: query.trim() }) : ''

  return (
    <section className="dk-pane" aria-label={t('desk.browse.music')}>
      {scope && q ? (
        /* browse/scopebar.xaml: 31 tall over a #303030-to-#1E1E1E gradient,
           a 43px back button with the same chevron as the browse header,
           then one tab per searchable category with a divider on each right
           edge; the showing tab inverts the gradient and takes a #2F2F2F
           border. It stands where the header would be. */
        <div className="dk-scopebar">
          <button type="button" className="dk-scopebar-back" title={t('common.back')}
                  onClick={() => { onDone?.(); setPickedCategory('') }}>
            {G.ScopeBack ? <G.ScopeBack /> : <Icon.ChevronLeft />}
          </button>
          <div className="dk-scopebar-tabs" role="tablist">
            {search.available.map((cat) => (
              <button key={cat.id} type="button" role="tab"
                      aria-selected={cat.id === search.category}
                      onClick={() => setPickedCategory(cat.id)}>{categoryLabel(cat, t)}</button>
            ))}
          </div>
        </div>
      ) : (
      <div className="dk-header">
        {stack.length > 1 && !node.cancel && (
          <button type="button" className="dk-header-btn dk-header-back"
                  title={t('common.back')} onClick={() => navigate(stack.slice(0, -1), 'back')}>
            <Icon.ChevronLeft />
          </button>
        )}
        <h2 className="dk-header-title" title={title}>
          {node.icon && !results && <img className="dk-header-logo" src={node.icon} alt="" />}
          {/* A built-in source shows its row glyph in the header, as the app's
              HeaderArt does (browsepanel.xaml sourceIcon, 24px). */}
          {!node.icon && node.Glyph && !results && <span className="dk-header-glyph"><node.Glyph /></span>}
          {results || title}
        </h2>
        {stack.length > 1 && (node.cancel ? (
          <button type="button" className="dk-header-btn dk-header-cancel"
                  onClick={() => navigate(stack.slice(0, -1), 'back')}>{t('common.cancel')}</button>
        ) : (
          <button type="button" className="dk-header-btn dk-header-home"
                  title={t('desk.browse.music')} onClick={() => navigate([ROOT], 'back')}>
            <Icon.Note />
            <span className="dk-header-home-label">{t('desk.browse.music')}</span>
          </button>
        ))}
      </div>
      )}
      <div className="dk-slide-stage">
      {slide && (
        <div key={slide.key} className={`dk-scroll dk-slide-out dk-slide-out-${slide.dir}`} aria-hidden="true"
             dangerouslySetInnerHTML={{ __html: slide.html }} />
      )}
      <div className={`dk-scroll${slide ? ` dk-slide-in-${slide.dir}` : ''}`} ref={scroller}>
        {!anyRoom && <p className="dk-browse-note">{t('desk.browse.selectRoom')}</p>}
        {scope && q ? (
          <div className="dk-search-results">
            {search.loading && <p className="dk-browse-note">{t('desk.browse.loading')}</p>}
            {search.error && <p className="dk-browse-note">{search.error}</p>}
            {!search.loading && !search.error && search.categories.length === 0 && search.term && (
              <div className="dk-empty">
                <Icon.Search />
                <p>{t('desk.browse.noResults', { query: search.term })}</p>
              </div>
            )}
            {/* One category at a time, as the scope bar's tab chooses; the
                app leans the matched words of each title. */}
            {search.categories.map((cat) => (
              <div key={cat.id}>
                {cat.items.map((item, index) => (
                  <Row key={`${cat.id}-${item.id}-${index}`} item={item} match={search.term}
                       displayTypes={search.displayTypes}
                       onOpen={() => openResult(item)}
                       onPlay={() => playResult(item)}
                       onMenu={(event) => {
                         event.stopPropagation()
                         setMenu({ item: { ...item, hzone: scope.hzone, service: scope.id }, x: event.clientX, y: event.clientY , context: event.type === 'contextmenu' })
                       }} />
                ))}
              </div>
            ))}
          </div>
        ) : node.lineIn ? (
          <LineInPage node={node} zones={zones} households={households} Glyph={G.LineIn} onPlay={(zone) => (
            actions.setSource(zone.uuid, { uri: `x-rincon-stream:${zone.uuid}`, metadata: '' })
          )} />
        ) : node.addServices ? (
          <AddServicesPage node={node} households={households} onPick={onLinkService} />
        ) : node.addToPlaylist ? (
          <AddToPlaylistPage node={node} onMessage={onMessage}
                             onDone={() => navigate(stack.slice(0, -1), 'back')} />
        ) : node.servicePlaylist ? (
          <ServicePlaylistPage node={node} onMessage={onMessage}
                               onDone={() => navigate(stack.slice(0, -1), 'back')} />
        ) : node.changeLocation ? (
          /* Two rows, as the app's pane holds: a dialog for a postcode and
             TuneIn's own location tree (2026-09-07). */
          <>
            {[[t('desk.radio.enterZip'), false, () => setNaming('zip')],
              [t('desk.radio.pickCity'), true, () => navigate([...stack, {
                id: 'r0', item: 'r0', service: node.service, title: t('desk.radio.pickCity'),
                hzone: node.hzone, hh: node.hh, icon: node.icon, pickCity: true,
                serviceName: node.serviceName }], 'forward')]].map(([label, chevron, act]) => (
              <div key={label} className="dk-browse-row" role="button" tabIndex={0}
                   onClick={act} onKeyDown={(event) => { if (event.key === 'Enter') act() }}>
                <span className="dk-browse-art"><Icon.GenericContainer width={40} height={40} /></span>
                <span className="dk-browse-text"><p className="dk-browse-title">{label}</p></span>
                {chevron && <Icon.ChevronRight className="dk-browse-disclosure" />}
              </div>
            ))}
          </>
        ) : node.prose ? (
          <ProsePage node={node} />
        ) : node.info ? (
          <InfoPage zone={activeZone?.uuid === node.zone?.uuid ? activeZone : node.zone} serviceName={node.serviceName}
                    onMessage={onMessage} item={node.item} hzone={node.hzone} services={servicesByHh[node.hh] || []}
                    onOpen={(next) => navigate([...stack, { ...next, hzone: node.hzone, hh: node.hh, icon: node.icon }], 'forward')}
                    onAddToPlaylist={(pick, source) => navigate([...stack, {
                      id: '__addpl', addToPlaylist: true, cancel: true, title: t('desk.playlists.addTitle'),
                      Glyph: Icon.Playlist, picks: [pick], source: source || node.source || '',
                      hzone: node.hzone || activeZone?.uuid || '', hh: node.hh }], 'forward')} />
        ) : node.id === '__root' ? (
          <>
            {filteredSections.map((section) => (
              <div key={section.household.id} className={section.otherSystem ? 'dk-browse-other-system' : undefined}>
                {section.header && (() => {
                  // The whole header row folds the system's block, not just
                  // the caret at its end (user request 2026-09-07).
                  const collapsible = section.otherSystem
                  const open = openOther.has(section.household.id)
                  const toggle = () => setOpenOther((prev) => {
                    const next = new Set(prev)
                    if (next.has(section.household.id)) next.delete(section.household.id)
                    else next.add(section.household.id)
                    return next
                  })
                  return (
                    <p className="dk-browse-section" role={collapsible ? 'button' : undefined}
                       tabIndex={collapsible ? 0 : undefined}
                       aria-expanded={collapsible ? open : undefined}
                       title={collapsible ? t(open ? 'desk.queue.collapse' : 'desk.queue.expand') : undefined}
                       onClick={collapsible ? toggle : undefined}
                       onKeyDown={collapsible
                         ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle() } }
                         : undefined}>
                      <span>{section.header}</span>
                      {collapsible && (
                        <span className="dk-browse-section-caret" aria-hidden="true">
                          {open ? <Icon.ChevronUp /> : <Icon.ChevronDown />}
                        </span>
                      )}
                    </p>
                  )
                })()}
                <div className="dk-browse-section-rows"
                     data-collapsed={section.otherSystem && !openOther.has(section.household.id) ? 'true' : undefined}>
                  <div>
                    {section.rows.map((item, index) => (
                      <Row key={`${section.household.id}-${item.id}-${index}`} item={item} root
                           menuOpen={(menu?.item?.id === item.id && (menu.context ? 'context' : 'open')) || (accountMenu?.item?.id === item.id && 'open')}
                           selected={menu?.item?.id === item.id || accountMenu?.item?.id === item.id
                                     || (lastRoot?.id === item.id && lastRoot?.hh === item.hh)}
                           onOpen={() => open(item)}
                           /* Right-click at the root: a playable row (TV) offers
                              its one action, and a service with more than one
                              account offers the account picker -- the app opens
                              that list from a right-click as well as from the
                              caret (measured on the S1 app's Spotify row,
                              2026-09-11). Rows that merely lead somewhere have
                              no menu at all. */
                           onMenu={item.disabled ? undefined
                             : item.playable ? (event) => {
                               event.preventDefault()
                               event.stopPropagation()
                               setMenu({ item, x: event.clientX, y: event.clientY , context: event.type === 'contextmenu' })
                             } : item.accounts ? (event) => {
                               event.preventDefault()
                               event.stopPropagation()
                               setAccountMenu({ item, x: event.clientX, y: event.clientY })
                             } : undefined}
                           onAccounts={item.disabled ? undefined : (event) => {
                             const row = event.currentTarget.closest('.dk-browse-row')
                             const rect = (row || event.currentTarget).getBoundingClientRect()
                             setAccountMenu({ item, x: event.clientX, y: event.clientY, right: rect.right, bottom: rect.bottom })
                           }} />
                    ))}
                    {/* The row belongs to the system the chosen room is on, so
                        it sits at the end of that system's own block and goes
                        straight to that system's page (user request
                        2026-09-07). */}
                    {addHouseholdId === section.household.id && (
                      <div className="dk-browse-row dk-browse-add">
                        <button type="button" className="dk-browse-add-main"
                                onClick={() => {
                                  if (!addServicesAsPage) { onAddServices?.(); return }
                                  openAddServices(section.household)
                                }}>
                          <span className="dk-browse-art dk-browse-glyph"><Icon.Plus /></span>
                          <span className="dk-browse-text">
                            <p className="dk-browse-title">{t('desk.browse.addServices')}</p>
                          </span>
                          {/* Both desktop apps give this row the same chevron
                              as the services above it; a theme that is not
                              replicating one of them leaves it off. */}
                          <Icon.ChevronRight className="dk-browse-disclosure dk-browse-add-chev" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </>
        ) : (
          <>
            {needsLink && (
              <div className="dk-browse-link">
                <div className="dk-caution-row">
                  <CautionBadge kind="sonos" size="large" logo={node}
                                title={t('services.caution.sonos', { gen: node.gen ?? 'S1' })} />
                  <p><strong>{t('services.needsSonora.title')}</strong><br />
                    {t('desk.browse.needsLink.body', { service: (node.serviceName || node.title), gen: node.gen ?? 'S1' })
                    .split('\n').map((line, i) => (
                      <React.Fragment key={i}>{i > 0 && <br />}{line}</React.Fragment>
                    ))}</p>
                </div>
                <button type="button" className="dk-win-btn" data-default="true"
                        onClick={() => onLinkService?.(
                          { sid: node.service, householdId: node.hh, name: (node.serviceName || node.title),
                            account: liveAccount })}>
                  {t('desk.browse.needsLink.action', { service: (node.serviceName || node.title) })}
                </button>
              </div>
            )}
            {!loading && !error && caution === 'sonora' && node.item === 'root' && (
              <div className="dk-browse-link">
                <div className="dk-caution-row">
                  <CautionBadge kind="sonora" size="large" logo={node}
                                title={t('services.caution.sonora', { gen: node.gen ?? 'S1' })} />
                  <p><strong>{t('services.needsSonos.title', { gen: node.gen ?? 'S1' })}</strong><br />
                    {t('services.sonoraOnly.body', { service: node.title, gen: node.gen ?? 'S1' })
                    .split('\n').map((line, i) => (
                      <React.Fragment key={i}>{i > 0 && <br />}{line}</React.Fragment>
                    ))}</p>
                </div>
              </div>
            )}
            {error && <p className={`dk-browse-note${failed ? ' dk-browse-fault' : ''}`}>{error}</p>}
            {/* The Mac app's words for a browse the service refused (Brain
                Food, a Spotify playlist Spotify no longer has, 2026-09-23);
                the other themes keep the service's own message above. */}
            {error && failed && <p className="dk-browse-empty dk-browse-failed">{t('desk.browse.unableToBrowse')}</p>}
            {loading && <p className="dk-browse-note">{t('desk.browse.loading')}</p>}
            {/* A container that holds nothing is a line of text in the middle
                of an otherwise bare pane -- no glyph, no panel -- which is
                what the app shows (walked 2026-09-14 on Amazon Music's "Try
                Amazon Music Unlimited"). A search that matched nothing keeps
                the illustrated empty state. */}
            {/* A library with no folders: the speaker still answers with its
                empty category folders, and the Mac app draws none of them,
                only "You haven't added any music folders to your Sonos system
                yet." over a line naming Music Library Settings as a link
                (2026-09-29). */}
            {bareLibrary && (
              <div className="dk-browse-nofolders">
                <p>{t('desk.library.noFolders')}</p>
                <p>{(() => {
                  const [before, after = ''] = t('desk.library.addHint', { menu: t('desk.menu.manage'), link: '\u0000' }).split('\u0000')
                  return (
                    <>
                      {before}
                      <button type="button" className="dk-link" onClick={onLibrarySettings}>
                        {t('desk.menu.musicLibrarySettings').replace(/(…|\.\.\.)$/, '')}
                      </button>
                      {after}
                    </>
                  )
                })()}</p>
              </div>
            )}
            {!bareLibrary && !loading && !error && !needsLink && deepItems.length === 0 && (
              q ? (
                <div className="dk-empty">
                  <Icon.Search />
                  <p>{t('desk.browse.noResults', { query: query.trim() })}</p>
                </div>
              ) : <p className="dk-browse-empty">{t('desk.browse.empty')}</p>
            )}
            {/* TuneIn's page opens with the household's own saved stations and
                shows (the speakers' R:0/0 and R:0/1) ahead of TuneIn's nodes,
                as the app lists them (observed 2026-09-05). */}
            {node.service === 254 && node.item === 'root' && !q && !loading && (
              <>
                {/* Three pinned rows, as the app lists them (2026-09-06): the
                    household's own saved stations and shows (the speakers'
                    R:0/0 and R:0/1) and TuneIn's "local" node. The service's
                    own nodes follow, "Location" among them -- the app shows
                    that too, so local radio is an extra row rather than a
                    rename. Each wears TuneIn's own browse icon, which is what
                    the app draws: the same 40px art square as the rows below,
                    holding station/show/local_legacy.png off TuneIn's CDN
                    (measured 2026-09-07 -- the app's headphones, radio set and
                    map pin are those files pixel for pixel). */}
                {[['R:0/0', t('desk.radio.myStations'), 'station', false],
                  ['R:0/1', t('desk.radio.myShows'), 'show', false],
                  [radioLocation.node || 'local',
                   radioLocation.city
                     ? t('desk.radio.localRadioIn', { city: radioLocation.city })
                     : t('desk.radio.localRadio'),
                   'local', true]].map(([id, title, icon, viaService]) => {
                  // Glyph as well as icon: TuneIn is a built-in with no cloud
                  // logo, so its mark in the header is drawn, and without it
                  // these three rows opened a page with a bare title.
                  const to = viaService
                    ? { id, title, item: id, service: node.service, hzone: node.hzone, hh: node.hh, icon: node.icon, Glyph: node.Glyph, serviceName: node.serviceName, localRadio: true }
                    : { id, title, item: 'root', hzone: node.hzone, hh: node.hh, icon: node.icon, Glyph: node.Glyph }
                  return (
                    <div key={id} className="dk-browse-row dk-tunein-pinned" role="button" tabIndex={0}
                         aria-selected={(viaService ? node.picked === '__local' : node.picked === id) || undefined}
                         onClick={() => navigate([...stack, to], 'forward')}
                         onKeyDown={(event) => { if (event.key === 'Enter') navigate([...stack, to], 'forward') }}>
                      <span className="dk-browse-art">
                        <img src={`${TUNEIN_ICONS}/${icon}_legacy.png`} alt="" />
                      </span>
                      <span className="dk-browse-text"><p className="dk-browse-title">{title}</p></span>
                      <Icon.ChevronRight className="dk-browse-disclosure" />
                    </div>
                  )
                })}
              </>
            )}
            {/* An album, as the app lays it out: a Play row carrying the art, a
                Shuffle row, then the tracks numbered where art would be. */}
            {playsWhole && !q && !loading && !error && deepItems.length > 0 && (
              <>
                <div className="dk-browse-row dk-album-play" role="button" tabIndex={0} onDoubleClick={() => playAlbum(false)}
                     aria-selected={menu?.item?.id === `${node.id}#album` || undefined}
                     onKeyDown={(event) => { if (event.key === 'Enter') playAlbum(false) }}
                     onContextMenu={(event) => { event.preventDefault(); setMenu({ item: albumItem(), x: event.clientX, y: event.clientY }) }}>
                  {/* An album's Play row carries the album's art; the library's
                      Songs list, which has none, wears the library's own stack
                      glyph there, as the app draws it (2026-09-14). */}
                  <span className={`dk-browse-art${coverOnPlayRow ? '' : ' dk-browse-glyph'}`}>
                    {coverOnPlayRow
                      ? <><Art src={node.art} size={40} fallback="disc" /><Icon.Play className="dk-album-play-badge" /></>
                      : <Icon.Stack className="dk-browse-stack" width={40} height={40} />}
                  </span>
                  <span className="dk-browse-text"><p className="dk-browse-title">{t('common.play')}</p></span>
                  {/* The Play row carries the album's own menu (observed
                      2026-09-05): a caret on hover, nothing else. */}
                  <button type="button" className="dk-browse-actions" title={t('desk.browse.actions')}
                          onClick={(event) => { event.stopPropagation(); setMenu({ item: albumItem(), x: event.clientX, y: event.clientY }) }}>
                    <Icon.CaretDown />
                  </button>
                </div>
                <div className="dk-browse-row dk-album-shuffle" role="button" tabIndex={0} onClick={() => playAlbum(true)}
                     data-on={shuffled ? 'true' : 'false'}
                     onKeyDown={(event) => { if (event.key === 'Enter') playAlbum(true) }}>
                  <span className="dk-browse-art dk-browse-glyph"><Icon.Shuffle /></span>
                  <span className="dk-browse-text"><p className="dk-browse-title">{t('common.shuffle')}</p></span>
                </div>
              </>
            )}
            {shownItems.map((item, index) => (
              <React.Fragment key={`${item.id}-${index}`}>
              {/* The Songs list is indexed by initial, as the app's is (A, C...
                  over its alphabetical run, 2026-09-14). */}
              {node.id === 'A:TRACKS' && !q && (index === 0 || initialOf(shownItems[index - 1]) !== initialOf(item)) && (
                <p className="dk-browse-section dk-browse-index">{initialOf(item)}</p>
              )}
              <Row item={item} selected={menu ? menu.item?.id === item.id
                     : Boolean(node.picked) && (node.picked === item.id
                       || (node.pickedTitle && item.title === node.pickedTitle && !shownItems.some((other) => other.id === node.picked)))}
                   displayTypes={displayTypes} under={node.kind || ''}
                   place={node.pickCity && peek[item.id] === 'final'}
                   parentLines={displayTypes?.[node.displayType || '']?.lines || null}
                   songArt={librarySongArt}
                   library={node.id === 'A:' ? 'root' : /^A:(ALBUM)?ARTIST\/[^/]+$/.test(node.id || '') ? 'artist' : /^(A:|S:)/.test(node.id || '') ? 'list' : ''}
                   menuOpen={menu?.item?.id === item.id && (menu.context ? 'context' : 'open')}
                   reorder={reorderFor(index)}
                   playing={Boolean(nowStream) && streamId(item.uri) === nowStream}
                   onBack={stack.length > 1 ? () => navigate(stack.slice(0, -1), 'back') : undefined}
                   number={node.kind === 'album' && !item.is_container ? index + 1 : 0}
                   checked={checked.has(item.id)} onCheck={() => toggleCheck(item.id)}
                   selectable={node.id !== 'FV:2'} radio={node.id === 'R:0/0' || node.id === 'R:0/1'} playlist={node.id === 'SQ:'}
                   onOpen={() => open(item)}
                   onPlay={item.uri && isPlayableLeaf(item) ? () => act({ ...item, hzone: node.hzone }, 'now') : undefined}
                   onDelete={removal(node) ? () => act(rowItem(item, index), removal(node)) : undefined}
                   onMenu={node.id === 'A:' ? undefined : (event) => {
                     event.stopPropagation()
                     setMenu({ item: rowItem(item, index), x: event.clientX, y: event.clientY , context: event.type === 'contextmenu' })
                   }} />
              </React.Fragment>
            ))}
          </>
        )}
      </div>
      </div>
      {/* My Radio Stations ends with the app's "Add New Radio Station" row
          pinned above the footer (observed 2026-09-05). */}
      {node.id === 'R:0/0' && onAddRadio && (
        <button type="button" className="dk-browse-addrow" onClick={onAddRadio}>{t('desk.radio.addNew')}</button>
      )}
      {node.id === 'SQ:' && (
        <button type="button" className="dk-browse-addrow" onClick={() => setNaming('new')}>{t('desk.playlists.new')}</button>
      )}
      {/* Local Radio ends with "Change Location" pinned above the footer, as
          the app's does (measured 2026-09-07). */}
      {node.localRadio && (
        <button type="button" className="dk-browse-addrow"
                onClick={() => navigate([...stack, {
                  id: '__changeloc', changeLocation: true, title: t('desk.radio.changeLocation'),
                  service: node.service, hzone: node.hzone, hh: node.hh, icon: node.icon,
                  serviceName: node.serviceName }], 'forward')}>
          {t('desk.radio.changeLocation')}
        </button>
      )}
      {naming === 'zip' && (
        <NameDialog title={t('desk.radio.enterZip')} body={t('desk.radio.zipBody')} initial=""
                    onClose={() => setNaming(null)}
                    onSubmit={async (zip) => {
                      setNaming(null)
                      const place = zip.replace(/\s+/g, '')
                      // TuneIn spells the place out for its postcode node
                      // ("Anaheim, CA, United States"), and the apps keep the
                      // first part of that as the row's label.
                      let city = ''
                      try {
                        const found = await api.serviceItem(node.service, `z${place}`, node.hzone)
                        city = String(found?.title || '').split(',')[0].trim()
                      } catch (exc) { city = '' }
                      const done = await actions.setRadioLocation(node.hzone, `z${place}`, city)
                      if (done) {
                        setLocationEpoch((v) => v + 1)
                        onMessage?.(t('desk.radio.locationSet', { city: done.city || place }))
                        const back = stack.findIndex((entry) => entry.localRadio)
                        const local = back >= 0 ? { ...stack[back], id: `z${place}`, item: `z${place}`,
                                                    title: done.city ? t('desk.radio.localRadioIn', { city: done.city }) : t('desk.radio.localRadio') } : null
                        navigate(back >= 0 ? [...stack.slice(0, back), local] : stack.slice(0, 1), 'back')
                      }
                    }} />
      )}
      {naming && naming !== 'zip' && (
        <NameDialog title={naming === 'new' ? t('desk.playlists.nameTitle') : t('desk.playlists.rename')}
                    body={naming === 'new' ? t('desk.playlists.nameBody') : t('desk.playlists.renameBody')}
                    initial={naming === 'new' ? '' : naming.title} onClose={() => setNaming(null)}
                    onSubmit={async (title) => {
                      const target = naming; setNaming(null)
                      const done = target === 'new'
                        ? await actions.createPlaylist(node.hzone, title)
                        : await actions.renamePlaylist(target.hzone, target.id, target.title, title)
                      if (done) setRefresh((v) => v + 1)
                    }} />
      )}
      {/* "Update Now": the speakers' own update, confirmed first, since
          music stops in each room while it installs. */}
      {updateAsk && (
        <Confirm title={t('desk.update.title')} body={t('desk.update.body', { version: updateAsk.version })}
                 action={t('desk.update.start')} cancelLabel={t('desk.update.notNow')}
                 onClose={() => setUpdateAsk(null)}
                 onConfirm={async () => {
                   const ask = updateAsk
                   setUpdateAsk(null)
                   const done = await api.startSoftwareUpdate(ask.hh).catch(() => null)
                   if (done?.started?.length) {
                     onMessage?.(t('desk.update.started'))
                     setUpdatesByHh((prev) => ({ ...prev, [ask.hh]: { ...prev[ask.hh], pending: false } }))
                   }
                 }} />
      )}
      {replaceAsk && (
        <Confirm title={t('desk.queue.editedTitle')} body={t('desk.queue.editedBody')} action={t('desk.queue.playAnyway')}
                 onClose={() => setReplaceAsk(null)}
                 onConfirm={() => { const ask = replaceAsk; setReplaceAsk(null); playAlbum(ask.shuffle, true) }} />
      )}
      <div className="dk-footer">
        <button type="button" disabled={!activeZone} onClick={(event) => onSleepTimer?.(event.currentTarget.getBoundingClientRect())}>{t('desk.browse.sleepTimer')}</button>
        <button type="button" disabled={!activeZone} onClick={() => onAlarms?.()}>{t('desk.browse.alarms')}</button>
      </div>

      {accountMenu && (
        <AccountMenu
          item={accountMenu.item} x={accountMenu.x} y={accountMenu.y}
          right={accountMenu.right} bottom={accountMenu.bottom}
          onClose={() => setAccountMenu(null)}
          onPick={(account) => {
            const key = `${accountMenu.item.hh}:${accountMenu.item.service}`
            setAccountChoice((prev) => {
              const next = { ...prev, [key]: account }
              try { localStorage.setItem(ACCOUNT_CHOICE_KEY, JSON.stringify(next)) } catch { /* private mode */ }
              return next
            })
            setAccountMenu(null)
          }}
        />
      )}
      {menu && (
        <ActionMenu
          item={menu.item}
          x={menu.x}
          y={menu.y}
          saved={savedFavorite}
          onClose={() => setMenu(null)}
          onAct={(how) => act(menu.item, how)} canUnselect={checked.size > 0}
          servicePlaylistLabel={menuServiceLabel}
        />
      )}
      {rename && (
        <RenameFavorite item={rename} onClose={() => setRename(null)}
                        onRename={async (title) => {
                          const done = await actions.renameFavorite(rename.hzone, rename.id, rename.title, title)
                          setRename(null)
                          if (done) setRefresh((v) => v + 1)
                        }} />
      )}
    </section>
  )
}

function Row({ item, root, displayTypes = {}, library = '', songArt = false, under = '', parentLines = null, place = false, onOpen, onMenu, onDelete, onAccounts, onBack, selected = false, menuOpen = false, playing = false, number = 0, checked = false, onCheck, onPlay, selectable = true, radio = false, playlist = false, match = '', reorder = null }) {
  const { t } = useI18n()
  const container = root ? item.container : (item.is_container && !isPlayableLeaf(item))
  // Second line: track metadata when there is any, else the provider's own
  // summary (Plex names the server here, which is what tells two "Music"
  // libraries apart), else a child count.
  // A Sonos Favorite shows the app's description ("Pandora Station", "Album
  // by Audien") and opens when it is a playlist or album.
  const favorite = item.kind === 'favorite'
  const unavailable = favorite && item.available === false
  // A service can refuse one track while listing it -- Mixcloud marks its
  // subscriber-only shows <trackMetadata><canPlay>false</canPlay> -- and the
  // app calls that row restricted: BrowseItemWrapper sets IsRestricted from
  // "(!CanExecute && !CanBrowse) || isUnavailable()", ListContainerControl
  // paints its title rgb(110,110,110) where an ordinary row is white, leaves
  // the second line at its usual rgb(134,134,134), and the library hands the
  // row SCALBUMART_RESTRICTED so the slashed circle replaces the cover the
  // service did send. Confirmed live on Mixcloud's Trending list, whose
  // "[Exclusive]" rows read exactly 110 against the others' 255 (2026-09-22).
  // A favorite that can no longer play is the same case -- isUnavailable() in
  // that expression -- and the Mac app draws it so: the slashed circle on its
  // plate, both lines #666666 (102.7 KIIS FM and KXT 91.7, 2026-09-23).
  const restricted = (!root && !favorite && !item.is_container && item.can_play === false) || unavailable
  // A SMAPI container the service says cannot be enumerated, and cannot be
  // played either, is drawn grayed with no chevron and opens nothing: Plex
  // marks the library currently in view that way in Other Sources, and the
  // app shows it dimmed (2026-09-14). A home row from a browse endpoint is
  // not held to this -- Amazon marks "Try Amazon Music Unlimited" the same
  // and the app opens it onto an empty pane.
  const dead = !root && !favorite && item.is_container && item.can_enumerate === false
    && !item.can_play && item.origin !== 'browse'
  // A place to live in Pick a City is chosen, not opened: no chevron.
  const opens = ((container && !dead) || (favorite && Boolean(item.browse_id) && !unavailable)) && !place
  // Album tracks show only their title after the number, as the app's do.
  const queueable = canEnqueue(item)
  // What the row says under -- or after -- its title. The service's own
  // DisplayType decides: its Lines name the fields the row shows, and a row
  // naming none shows its title alone whatever summary it carries. Measured
  // 2026-09-14 across three services: Plex's Other Sources libraries
  // (titleSummary, no DisplayMode) read "Comedy Albums / Burrito" on one
  // line; Pandora's stations (station, no DisplayMode) read the date under
  // the name on two; Pocket Casts' root containers, which carry summaries
  // but no display type, show no summary at all. Tracks and albums keep the
  // artist line the app gives them without any map.
  // Only a type with no DisplayMode, LIST or EDITORIAL is honored: the desktop app
  // predates the other modes and falls back to its own default for them, so
  // Pocket Casts' podcastContainer (HERO: title, summary) draws the show's
  // title alone where the phone apps draw a hero card (2026-09-14).
  //
  // A row that names no display type is looked up by its itemType instead,
  // which is the protocol's own second key: Spotify's map defines "track",
  // "album" and "playlist" beside ids like "CAROUSEL" and "albumsList", and
  // its rows carry no displayType at all. It is what makes the app print
  // "Dr. Dre" under a Spotify track and not "Dr. Dre - 2001" -- seen on the
  // playlist "Dr. Dre - 2001" and in the Songs search results, both of which
  // stop at the artist (2026-09-22). A service with no entry for its item
  // types is unaffected, which is most of them.
  const declared = !root && !number && !favorite
    ? displayTypes?.[item.display_type || item.item_type || ''] : null
  // EDITORIAL is honored as well: AccuRadio's channels (channelEditorial:
  // title, summary) read their blurb under the name in both S1 apps -- "Only
  // the biggest hits and best new Country." under Today's New Country, Most
  // Popular Channels, 2026-09-22.
  const typed = declared && (!declared.mode || ['LIST', 'EDITORIAL'].includes(declared.mode)) ? declared : null
  const lineOf = (token) => (token === 'title' ? item.title
    : token === 'artist' ? (item.artist || item.author || '')
    : token === 'album' ? (item.album || '')
    : token === 'summary' ? (item.summary || '') : '')
  const typedSecond = typed && typed.lines?.length > 1
    ? typed.lines.slice(1).map(lineOf).filter(Boolean).join(' – ') : ''
  // Inline for a row that only leads somewhere; on two lines for one that can
  // play. Plex's libraries (no canPlay) read "Comedy Albums / Burrito", its
  // playlists (canPlay) and Pandora's stations read their second line under
  // the first, all three typed with lines and no mode (2026-09-14).
  // Not in search results: there the app's rows always take two lines, the
  // service's second line grey under the title -- Plex's artist "The
  // Beatles" over "in 3 locations", Windows app 2026-10-02.
  const inline = Boolean(typedSecond) && !item.can_play && !typed.mode && !match
  const titleText = inline ? `${item.title} / ${typedSecond}` : item.title
  // A podcast episode is dated, not attributed: the app prints its release
  // date under the title (Pocket Casts, "9/11/2026", 2026-09-14) where a
  // track gets its artist. Keyed on the SMAPI semanticType, so every
  // service's episodes read the same way.
  const episode = /^episode\./.test(item.semantic_type || '') && item.release_date
  // Under an artist the albums are that artist's: the app prints their
  // titles alone there, and the artist line only in the Albums list. The same
  // holds on a service's artist page, ahead of anything the service's map
  // names: Spotify's Dr. Dre lists Compton and 2001 by title alone in the S1
  // Windows app, and Snoop Dogg's Missionary among them without his name,
  // though every one of those items carries its artist and the same albums
  // print it in a search (2026-09-22).
  //
  // More generally an album's artist line is the page's to give: the
  // container a row sits in names, through its own displayType, the lines its
  // children show. Spotify's shelves are CAROUSEL and its artist pages
  // albumsList, both with no lines, and their albums read by title alone;
  // Plex's By Album is "albums" (title, artist) and keeps the artist, as does
  // any page whose container names no type at all -- Plex's Recently Added,
  // and every search (Windows app, 2026-09-22). Playlists keep their owner
  // regardless: Spotify's mixes, in a CAROUSEL, still read "Spotify".
  const pageDropsArtist = Array.isArray(parentLines) && !parentLines.includes('artist')
  const onArtistPage = (library === 'artist' || under === 'artist' || pageDropsArtist)
    && (item.item_type || item.kind) === 'album'
  // The same holds for a track: on a page that drops the artist, it reads by its title alone. Plex's
  // song search opens a song onto its copies, one "Music / on <server>" row per library, and each of
  // those (an artist-typed container whose titleSummary type names no artist) shows the song by
  // title alone in both S1 apps (Windows 2026-10-02, Mac 2026-10-03), though it carries its artist
  // and album.
  // Only a type that names its lines and leaves the artist out: a CAROUSEL names none, and what a
  // track on one of Spotify's shelves shows has not been measured.
  const namesNoArtist = Array.isArray(parentLines) && parentLines.length > 0 && !parentLines.includes('artist')
  const trackTitleAlone = (namesNoArtist || under === 'artist') && !item.is_container
    && (item.item_type || 'track') === 'track'
  const sub = root || number || onArtistPage || trackTitleAlone ? (root ? item.sub || '' : '') : (favorite && item.description)
    || (typed ? (inline ? '' : typedSecond)
        : episode ? shortDate(item.release_date)
        // The artist line belongs to what is or holds music -- a track, an
        // album -- and not to a container that merely names one: a podcast
        // show carries its producer as <artist> and the app prints the
        // show's title alone (Pocket Casts, 2026-09-14).
        : library && !item.is_container ? (item.artist || '')
        // A playlist prints its owner there the way an album prints its
        // artist: every one of Spotify's mixes reads "Spotify" under its
        // name in both S1 apps (Your top mixes, 2026-09-22).
        : (!container || ['album', 'playlist'].includes(item.item_type || item.kind))
          && [item.artist || item.author, item.album].filter(Boolean).join(' – ')
          || (item.child_count ? t.plural('common.items', item.child_count) : ''))
  return (
    <div
      data-library={library || undefined}
      className={`dk-browse-row${unavailable ? ' dk-browse-unavailable' : ''}${restricted ? ' dk-browse-restricted' : ''}${number ? ' dk-browse-numbered' : ''}`}
      aria-checked={onCheck && !root ? checked : undefined}
      role="button"
      aria-selected={selected || undefined}
      aria-current={playing ? 'true' : undefined}
      /* 'open' when the row's caret opened its menu, 'context' for a
         right-click: the Windows app lights the caret for the first and shows
         none for the second (2026-09-29). */
      data-menu={menuOpen ? (menuOpen === 'context' ? 'context' : 'open') : undefined}
      tabIndex={item.disabled || dead ? -1 : 0}
      aria-disabled={item.disabled || dead || unavailable || restricted || undefined}
      style={item.disabled || dead ? { color: 'var(--t-fg-dim)' } : undefined}
      /* The tooltip both apps take from the core's SCITooltip: a track's
         album -- "100 Best Movie Soundtracks" over a row of Spotify's
         Soundtrack Mix in the Windows app, 2026-09-22 -- and a stream's
         show. */
      title={item.stream_show || (!item.is_container && item.album) || undefined}
      /* Dragged into the Queue where the service says the item is, or holds,
         tracks -- see canEnqueue. A row that cannot be queued is not
         draggable, so nothing suggests a drop that would be refused. */
      draggable={queueable || Boolean(reorder) || undefined}
      onDragStart={queueable || reorder ? (event) => {
        if (queueable) {
          event.dataTransfer.setData('application/x-sonora-item', JSON.stringify({
            uri: item.uri, title: item.title, metadata: item.metadata || '',
          }))
        } else {
          // Firefox starts no drag that carries nothing.
          event.dataTransfer.setData('text/plain', '')
        }
        event.dataTransfer.effectAllowed = reorder ? 'copyMove' : 'copy'
        reorder?.onStart()
      } : undefined}
      onDragOver={reorder?.onOver}
      onDrop={reorder?.onDrop}
      onDragEnd={reorder?.onEnd}
      data-drop={reorder?.mark || undefined}
      onClick={dead ? undefined : onOpen}
      onDoubleClick={dead ? undefined : onPlay}
      onContextMenu={onMenu ? (event) => { event.preventDefault(); onMenu(event) } : undefined}
      /* The app's keys on a browse row: Enter and Right browse in, Left goes
         back (BrowsePanel's KeyDown, confirmed against the decompiled
         handlers 2026-09-11); Delete and Backspace remove it where it can
         be removed. */
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === 'ArrowRight') { event.preventDefault(); onOpen() }
        else if (event.key === 'ArrowLeft' && onBack) { event.preventDefault(); onBack() }
        else if ((event.key === 'Delete' || event.key === 'Backspace') && onDelete) { event.preventDefault(); onDelete() }
      }}
    >
      <span className={`dk-browse-art${root ? ' dk-browse-glyph' : ''}${number ? ' dk-browse-number' : ''}`}>
        {number
          ? <span>{String(number).padStart(2, '0')}</span>
          : root
          ? (item.icon ? <img src={item.icon} alt="" /> : <item.Glyph />)
          /* The Music Library, as the S2 Windows app draws it (2026-09-14):
             its root rows wear the generic placeholder; artists, genres,
             composers, folders and an artist's "All" wear the library's stack
             glyph; a song outside an album has an empty slot -- the title
             keeps its indent, and nothing is fetched for it -- while an album
             keeps its art. */
          : library === 'root'
            ? <Icon.GenericContainer className="dk-browse-folder" width={40} height={40} />
          : library && item.is_container && !item.art
            ? <Icon.Stack className="dk-browse-stack" width={40} height={40} />
          : library && !item.is_container && !songArt
            ? null
          : restricted
            ? <Icon.Restricted className="dk-browse-restricted-art"
                               role="img" aria-label={t('common.restricted')} />
          : unavailable
            ? <Icon.MissingService className="dk-browse-missing" />
            : (favorite && !item.uri && !item.art)
              ? <Icon.Stack width={40} height={40} />
              : (radio && !item.art)
                ? <span className="dk-radio-glyph"><Icon.Radio /></span>
                : playlist
                  /* A Sonos playlist always wears the playlist tile in the
                     app, even when the playlist has art of its own: both of
                     this household's showed browse_playlist (2026-09-06). */
                  ? <span className="dk-radio-glyph dk-playlist-glyph"><Icon.Playlist /></span>
                : <Art src={item.art} size={40} fallback={genericArt(item)} />}
        {root && item.caution && (
          <CautionBadge kind={item.caution}
                        title={t(`services.caution.${item.caution}`, { gen: item.gen ?? 'S1' })} />
        )}
      </span>
      <span className="dk-browse-text">
        {/* The explicit badge the app pins after a row's title, not only in
            Now Playing: ListContainerControl builds a two-column grid for a
            row whose ShowExplicitBadge is set, puts the title in the first
            with a 5px right margin and an 11x11 image in the second, and
            picks explicit_restricted_dcr over explicit_dcr when the row is
            restricted. Seen on Spotify's "2001", where every track carries it
            (2026-09-22); the color comes from the skin because the two apps
            ship the same drawing in different grays. */}
        <p className="dk-browse-title">
          {/* Its own span, so the row can be a flex line for the badge
              without collapsing the space before a highlighted word:
              "The Cure", not "TheCure". */}
          <span className="dk-browse-title-text">{leaned(titleText, match)}</span>
          {item.explicit && (
            <Icon.ExplicitWin className="dk-browse-explicit"
                              role="img" aria-label={t('common.explicit')} />
          )}
        </p>
        {sub && <p className="dk-browse-sub">{match ? leaned(sub, match) : sub}</p>}
      </span>
      {/* The caret the app shows on hover. Deeper rows all have one; at the
          root only a playable row does -- TV, where the app's own row grows a
          caret on hover and opens "Play Now" from it (measured against the S2
          app 2026-09-11). A row that merely leads somewhere has a chevron
          instead and no menu. */}
      {/* The Music Library's own root rows (Artists, Albums...) lead
          somewhere and nothing more: no caret, no checkbox, no menu in the
          S2 app (2026-09-29). */}
      {((!root && library !== 'root') || (item.playable && onMenu)) && (
        <button type="button" className="dk-browse-actions" title={t('desk.browse.actions')} onClick={onMenu}>
          <Icon.CaretDown />
        </button>
      )}
      {/* The app's row checkbox (checkbox_normal/hover/checked): shown while
          the pointer is over the row or while ticked. */}
      {/* The app's checkbox sits on rows that can join the queue (tracks,
          albums, playlists); stations and Sonos Favorites have none. */}
      {!root && library !== 'root' && onCheck && selectable && item.uri && !unavailable && !favorite && item.item_type !== 'audiobook'
        && !/^(x-sonosapi-radio|x-sonosapi-stream|x-sonosapi-hls|x-rincon-mp3radio|x-rincon-stream):/.test(item.uri) && (
        <button type="button" className="dk-browse-check" role="checkbox" aria-checked={checked}
                title={t('desk.browse.select')} onClick={(event) => { event.stopPropagation(); onCheck() }}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="1.5" width="13" height="13" rx="1" fill="none" stroke="currentColor" strokeWidth="1" />{checked && <path d="M4 8.2l2.6 2.6L12 5.4" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}</svg>
        </button>
      )}
      {root && item.accounts && (
        <button type="button" className="dk-browse-actions dk-browse-accounts"
                title={t('desk.browse.switchAccount')}
                onClick={(event) => { event.stopPropagation(); onAccounts?.(event) }}>
          <Icon.CaretDown />
        </button>
      )}
      {!number && (opens && !item.disabled
        ? <Icon.ChevronRight className="dk-browse-disclosure" />
        /* The app hides this rather than collapsing it, so the slot stays
           reserved and the caret to its left keeps its place whether the row
           opens or not (ListContainerControl reserves the gutter either way). */
        : <span className="dk-browse-disclosure dk-browse-disclosure-blank" aria-hidden="true" />)}
    </div>
  )
}

// localStorage key for the account chosen per "<household id>:<service id>".
const ACCOUNT_CHOICE_KEY = 'sonora.serviceAccounts'

// The dropdown on a service row with several accounts: the nicknames, with
// the one in use marked. Picking one re-points the row and its browsing.
function AccountMenu({ item, x, y, right = null, bottom = null, onClose, onPick }) {
  const ref = useRef(null)
  useEffect(() => {
    const close = (event) => { if (ref.current && !ref.current.contains(event.target)) onClose() }
    const key = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', key)
    }
  }, [onClose])
  // The app drops the list under its row, flush with the row's right edge
  // and overlapping its bottom by 3px (measured on the Spotify row,
  // 2026-09-05 capture: row ending 649/1531, popup at 646, 1409-1530).
  const style = right != null && bottom != null
    ? { right: Math.max(6, window.innerWidth - right + 1), top: Math.min(bottom - 3, window.innerHeight - 80), left: 'auto' }
    : { left: Math.min(x, window.innerWidth - 240), top: Math.min(y, window.innerHeight - 180) }
  return (
    <div className="dk-popover dk-action-menu dk-account-menu" ref={ref} role="menu" style={style}>
      <p className="dk-popover-title">{item.title}</p>
      {/* Listed by name, as the app lists them (alexsounds above Sam's
          Spotify in the 2026-09-05 capture). */}
      {[...item.accounts].sort((a, b) => (a.nickname || '').localeCompare(b.nickname || '', undefined, { sensitivity: 'base' })).map((account) => (
        <button key={`${account.account_id ?? ''}-${account.nickname}`} type="button" role="menuitemradio"
                aria-checked={(account.account_id ?? '') === item.account}
                onClick={() => onPick(account.account_id ?? '')}>
          {/* The app ticks the account in use, as its search menu ticks the
              scope; the same 19px column carries it. */}
          <span className="dk-scope-check" aria-hidden="true">
            {(account.account_id ?? '') === item.account ? <Icon.Check /> : null}
          </span>
          {account.nickname || item.title}
        </button>
      ))}
    </div>
  )
}

// Info & Options as the Windows app lays it out (captured 2026-09-05): the
// art beside captioned lines, then the app's action rows. For a queue track
// the lines are Song / Artist / Album / Station and the rows Start Radio,
// Add Song to <Service> Playlist, Save to Your Music, Album Info, Artist
// Info, Add Song to Sonos Playlist. For a station (anything not played from
// the queue) the app shows Song / Artist / Album and a single "Add Station to
// Sonos Favorites" row. Rows are grayed until Sonora performs them; the
// metadata block is the part that informs.
// "Add Song to Playlist", as the app turns the browse pane into a picker
// (observed 2026-09-06): the household's Sonos Playlists, a New Playlist row
// pinned above the footer, and Cancel in the header. Picking a playlist
// appends the item and returns to where the menu was opened.
// "Add to Spotify (Sam's Spotify) Playlist": the service a row came from,
// named as the app names it. A row browsed inside a container carries no
// service facts of its own, so the sid in its URI is matched against the
// household's services and the account's nickname added in brackets.
function serviceLabelFor(item, services) {
  const sid = Number((/[?&]sid=(\d+)/.exec(item.uri || '') || [])[1])
  if (!sid || !services) return ''
  const svc = services.find((s) => s.id === sid)
  if (!svc) return ''
  return svc.nickname && svc.nickname !== svc.name ? `${svc.name} (${svc.nickname})` : svc.name
}

// "Add Music Services" as the Windows app shows it (captured 2026-09-06): not
// a dialog but a page in the browse pane, every service the household can add
// on a 48px row with its logo, the name over "Sign in with <name>". Choosing
// one hands off to the linking flow the dialog already runs.
// The Line-In page, as the app shows it: the players with something plugged
// into their socket, or its sentence when none has (seen 2026-09-06 with
// nothing connected). Connection comes from each player's AudioIn events.
function LineInPage({ node, zones, households, onPlay, Glyph = Icon.LineIn }) {
  const { t } = useI18n()
  const household = households.find((h) => h.id === node.hh)
  const mine = (household?.zone_uuids || []).map((uuid) => zones[uuid]).filter(Boolean)
  const connected = mine.filter((z) => z.line_in_connected)
  if (!connected.length) {
    return <p className="dk-browse-note dk-linein-note">{t('desk.browse.lineInNone')}</p>
  }
  return (
    <div className="dk-browse-list">
      {connected.map((zone) => (
        <div key={zone.uuid} className="dk-browse-row" role="button" tabIndex={0}
             onClick={() => onPlay(zone)}
             onKeyDown={(event) => { if (event.key === 'Enter') onPlay(zone) }}>
          <span className="dk-browse-art dk-browse-glyph"><Glyph /></span>
          <span className="dk-browse-text">
            <p className="dk-browse-title">{zone.line_in_name || zone.name}</p>
          </span>
        </div>
      ))}
    </div>
  )
}

function AddServicesPage({ node, households, onPick }) {
  const { t } = useI18n()
  const [rows, setRows] = useState(null)
  useEffect(() => {
    let canceled = false
    api.services().then((all) => {
      if (canceled) return
      const logos = {}
      for (const hh of all.households || []) {
        for (const svc of hh.in_use || []) if (svc.icon && svc.id != null) logos[svc.id] = svc.icon
      }
      const hh = (all.households || []).find((h) => h.household === node.hh) || (all.households || [])[0]
      const used = new Set((hh?.in_use || []).map((s) => s.id))
      setRows((hh?.available || [])
        .filter((s) => !used.has(s.id) || s.auth !== 'Anonymous')
        .map((s) => ({ ...s, icon: s.icon || logos[s.id] || '' }))
        .sort((a, b) => a.name.localeCompare(b.name)))
    }).catch(() => { if (!canceled) setRows([]) })
    return () => { canceled = true }
  }, [node.hh])
  if (rows === null) return <div className="dk-add-loading"><span className="dk-spinner" />{t('desk.browse.loading')}</div>
  return (
    <div className="dk-browse-list">
      {rows.map((svc) => (
        <div key={svc.id} className="dk-browse-row" role="button" tabIndex={0}
             onClick={() => onPick?.({ sid: svc.id, name: svc.name, householdId: node.hh })}
             onKeyDown={(event) => { if (event.key === 'Enter') onPick?.({ sid: svc.id, name: svc.name, householdId: node.hh }) }}>
          <span className="dk-browse-art dk-browse-glyph">
            {svc.icon ? <img src={svc.icon} alt="" /> : <Icon.Note />}
          </span>
          <span className="dk-browse-text">
            <p className="dk-browse-title">{svc.name}</p>
            <p className="dk-browse-sub">{t('win.services.signInWith', { service: svc.name })}</p>
          </span>
        </div>
      ))}
    </div>
  )
}

function AddToPlaylistPage({ node, onMessage, onDone }) {
  const { t } = useI18n()
  const { actions } = useSystem()
  const [playlists, setPlaylists] = useState(null)
  const [naming, setNaming] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!node.hzone) return
    api.playlists(node.hzone).then((r) => setPlaylists(r.items || [])).catch(() => setPlaylists([]))
  }, [node.hzone])
  const picks = (node.picks || []).filter((item) => item.uri)
  const addAll = async (id, title) => {
    setBusy(true)
    let added = 0
    for (const item of picks) {
      const done = await actions.addToPlaylist(node.hzone, id, item, node.source || '')
      if (done) added += 1
    }
    setBusy(false)
    if (added) {
      onMessage?.(added === 1
        ? t('desk.playlists.added', { title: picks[0].title, playlist: title })
        : t('desk.playlists.addedMany', { count: added, playlist: title }))
      onDone()
    }
  }
  return (
    <>
      <div className="dk-browse-list">
        {playlists === null
          ? <div className="dk-add-loading"><span className="dk-spinner" />{t('desk.browse.loading')}</div>
          : playlists.map((item) => (
            <Row key={item.id} item={item} playlist selectable={false}
                 onOpen={() => { if (!busy) addAll(item.id, item.title) }} />
          ))}
      </div>
      <button type="button" className="dk-browse-addrow" disabled={busy}
              onClick={() => setNaming(true)}>{t('desk.playlists.new')}</button>
      {naming && (
        <NameDialog title={t('desk.playlists.nameTitle')} body={t('desk.playlists.nameBody')} initial=""
                    onClose={() => setNaming(false)}
                    onSubmit={async (title) => {
                      setNaming(false)
                      const made = await actions.createPlaylist(node.hzone, title)
                      if (made?.id) await addAll(made.id, title)
                    }} />
      )}
    </>
  )
}

// "Add Song to <service> Playlist": the account's own playlists on the
// service, as the app lists them (Sam's Spotify, S1 Mac app, 2026-09-24) --
// every playlist in its library with its owner under the name, the ones the
// account only follows grayed and not to be picked -- and a New Playlist bar
// at the foot, which makes one seeded with the song.
function ServicePlaylistPage({ node, onMessage, onDone }) {
  const { t } = useI18n()
  const [rows, setRows] = useState(null)
  const [naming, setNaming] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let canceled = false
    api.userPlaylists(node.sid, { zone: node.hzone, account: node.account })
      .then((r) => { if (!canceled) setRows(r?.items || []) }).catch(() => { if (!canceled) setRows([]) })
    return () => { canceled = true }
  }, [node.sid, node.hzone, node.account])
  const add = async (body, name) => {
    setBusy(true)
    try {
      await api.addToUserPlaylist(node.sid, { zone: node.hzone, account: node.account, item: node.pick.id, ...body })
      onMessage?.(t('desk.playlists.added', { title: node.pick.title, playlist: name }))
      onDone()
    } catch (exc) {
      onMessage?.(exc?.message || t('notice.error.title'))
      setBusy(false)
    }
  }
  return (
    <>
      <div className="dk-browse-list">
        {rows === null
          ? <div className="dk-add-loading"><span className="dk-spinner" />{t('desk.browse.loading')}</div>
          : rows.map((row) => (
            <div key={row.id} className={`dk-browse-row${row.editable ? '' : ' dk-browse-readonly'}`}
                 role="button" tabIndex={row.editable ? 0 : -1} aria-disabled={!row.editable || busy || undefined}
                 onClick={() => { if (row.editable && !busy) add({ playlist: row.id }, row.title) }}
                 onKeyDown={(event) => { if (event.key === 'Enter' && row.editable && !busy) add({ playlist: row.id }, row.title) }}>
              <span className="dk-browse-art"><Art src={row.art} size={40} fallback="container" /></span>
              <span className="dk-browse-text">
                <p className="dk-browse-title">{row.title}</p>
                {row.owner && <p className="dk-browse-sub">{row.owner}</p>}
              </span>
            </div>
          ))}
      </div>
      <button type="button" className="dk-browse-addrow" disabled={busy}
              onClick={() => setNaming(true)}>{t('desk.playlists.new')}</button>
      {naming && (
        <NameDialog title={t('desk.playlists.nameTitle')} body={t('desk.playlists.nameBody')} initial=""
                    onClose={() => setNaming(false)}
                    onSubmit={(title) => { setNaming(false); add({ title }, title) }} />
      )}
    </>
  )
}

// The app puts the service's own logo left of a page title, Info & Options
// included. A cloud logo covers most services; TuneIn is built in and the
// cloud carries none for it, so the app's own mark stands in (2026-09-06).
// Whether an item can join the queue at all. A station, a stream, line-in
// and the television cannot: those the app plays by pointing the transport
// at them, which is also how Sonora has always played everything.
// The scope bar's tab labels. A category the service's presentation map names
// by one of Sonos' own ids takes the controller's own wording -- "podcasts"
// reads "Podcasts & Shows", which is what the app shows over TuneIn's results
// even though its SMAPI tree calls that container "Shows" (2026-09-07) -- and
// a service's CustomCategory keeps the string the service supplies.
function categoryLabel(cat, t) {
  // A CustomCategory is named in the service's words even when its id looks
  // like one of Sonos' own: Mixcloud's "Shows" tab reads Shows in the app,
  // not the controller's "Podcasts & Shows" (2026-09-23).
  if (cat.custom && cat.title) return cat.title
  const key = `search.category.${(cat.id || '').toLowerCase()}`
  const label = t(key)
  if (label && label !== key) return label
  return cat.title || cat.id || ''
}

// The app leans the words a search matched: "The Cure" is in bold italic at
// the head of every Pandora result for "the cure", and the rest of each title
// stands upright (measured in the S1 app 2026-09-20).
// The match ignores accents, case and the joiners between words: the app
// leans "Thè Curè" in Brayoh Thè Curè and "The-cure" in Vaccine Dlamini
// The-cure for a search of "the cure" (Mixcloud's Users, 2026-09-23). Each
// character folds to exactly one, so a match in the folded text is the same
// span of the original.
function foldChar(ch) {
  const base = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const one = (base || ch).toLowerCase()[0] ?? ch
  return /[-_\s]/.test(one) ? ' ' : one
}
// Spaces do not count either, in the title or the search: "oris" leans
// "Ori S" in Ori Shochat among Pandora's artists (S1 Mac app, 2026-09-29).
function leaned(title, term) {
  const text = String(title || '')
  const needle = Array.from(String(term || '').trim(), foldChar).filter((c) => c !== ' ').join('')
  if (!needle) return text
  const chars = Array.from(text)
  // The title without its spaces, and where each kept character came from.
  const kept = []
  const from = []
  chars.forEach((ch, i) => {
    const folded = foldChar(ch)
    if (folded !== ' ') { kept.push(folded); from.push(i) }
  })
  const at = kept.join('').indexOf(needle)
  if (at < 0) return text
  const start = from[at]
  const end = from[at + Array.from(needle).length - 1] + 1
  return (
    <>
      {chars.slice(0, start).join('')}
      <em>{chars.slice(start, end).join('')}</em>
      {chars.slice(end).join('')}
    </>
  )
}

function isQueueable(item) {
  // An audiobook never goes into the queue: the app hands the book to the
  // player (SetAVTransportURI on its container), which plays the chapters
  // in order and resumes; queueing it expanded 21 chapters into the queue
  // (Libby, 2026-09-08).
  if (item.item_type === 'audiobook') return false
  return Boolean(item.uri) && !/^(x-sonos-htastream|x-rincon-stream|x-sonosapi-radio|x-sonosapi-stream|x-sonosapi-hls|x-rincon-mp3radio):/.test(item.uri)
}

// Which of the app's generic tiles a row falls back to when it brings no art
// of its own (assets/browse/browse_generic_*): a container of tracks gets the
// stack, a station or stream the broadcast waves, a playlist the ruled note,
// an album the disc, and a plain track the single note. Seen on Audacy, whose
// "Stations" and "All stations" both carry the stack in the app while Sonora
// drew a disc for them (2026-09-06).
// TuneIn's own browse icons, which the service also gives for its SMAPI
// rows (albumArtURI channel_legacy.png and its like); the three rows the app
// pins above them are drawn from the same set.
const TUNEIN_ICONS = 'http://cdn-albums.tunein.com/sonos'

function genericArt(item) {
  const kind = item.item_type || ''
  if (item.playlist || kind === 'playlist' || kind === 'albumList') return 'playlist'
  if (kind === 'stream' || kind === 'program' || item.radio) return 'station'
  if (item.is_container || item.container) {
    if (kind === 'album') return 'disc'
    // A container the service says nothing more about than "container" gets
    // the folder tile, which is what the app shows for Amazon Music's home
    // rows; a list of tracks it names (albumList, trackList) gets the stack.
    return kind === 'container' || !kind ? 'container' : 'multi'
  }
  return kind === 'track' || kind === 'episode' ? 'track' : 'disc'
}

// Two URIs name the same favorite even when their text differs: the
// speakers hand back lowercase percent escapes and a live `flags` value while
// the saved favorite keeps whatever was written, so only the path and the
// service id are compared (Pandora's Cocktail Jazz Radio came back as
// %3a/flags=0 against %3A/flags=8300, 2026-09-06).
// Which service a station belongs to, from whichever URI is to hand.
function sidOf(transport, item) {
  const uri = (item ? item.uri : transport.media_uri) || ''
  const found = /[?&]sid=(\d+)/.exec(uri)
  return found ? Number(found[1]) : (transport.service_id || 0)
}

// The app's short date: the platform's numeric form, "9/11/2026" on a US
// Windows, without leading zeros.
function shortDate(iso) {
  const when = new Date(iso)
  if (Number.isNaN(when.getTime())) return ''
  return when.toLocaleDateString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric' })
}

function favoriteKey(uri) {
  if (!uri) return ''
  const [path, query = ''] = String(uri).split('?')
  const sid = /(?:^|&)sid=(\d+)/.exec(query)?.[1] || ''
  return `${path.replace(/%[0-9a-f]{2}/gi, (m) => m.toLowerCase())}|${sid}`
}

// The prose behind a service's Description row, fetched when the page opens.
function ProsePage({ node }) {
  const { t } = useI18n()
  const [text, setText] = useState(null)
  useEffect(() => {
    let canceled = false
    api.serviceText(node.textOf.sid, node.textOf.item, node.textOf.type, node.hzone)
      .then((r) => { if (!canceled) setText(r?.text || '') })
      .catch(() => { if (!canceled) setText('') })
    return () => { canceled = true }
  }, [node.textOf.sid, node.textOf.item, node.textOf.type, node.hzone])
  // The app's Description page keeps the item's header -- art and the same
  // labeled lines Info & Options shows -- above the text (measured on a
  // Mixcloud show 2026-09-07); the text itself is the service's, paragraph
  // by paragraph, its first line often a heading of the service's own.
  const header = node.header ? (
    <div className="dk-info-block">
      <span className="dk-info-art"><Art src={node.header.art || ''} size={64} /></span>
      <dl>
        {(node.header.lines || []).map(([label, value]) => (
          <React.Fragment key={label}><dt>{label}</dt><dd>{value}</dd></React.Fragment>
        ))}
      </dl>
    </div>
  ) : null
  if (text === null) return <>{header}<p className="dk-browse-note">{t('desk.browse.loading')}</p></>
  if (!text) return <>{header}<p className="dk-browse-note">{t('desk.browse.noSelections')}</p></>
  return <>{header}<div className="dk-browse-prose">{text.split('\n').map((line, i) => <p key={i}>{line}</p>)}</div></>
}

function InfoPage({ zone, serviceName, onMessage, item = null, hzone = null, onAddToPlaylist = null, onOpen = null, services = [] }) {
  const { t } = useI18n()
  const { actions } = useSystem()
  const transport = item
    ? { title: item.title, artist: item.artist, album: item.album, album_art_uri: item.art,
        source: /^x-sonosapi-(radio|stream|hls):/.test(item.uri || '') || item.item_type === 'program' || item.item_type === 'stream' ? 'service_radio' : 'queue' }
    : (zone?.transport || {})
  // The station row works: it saves the station (the one playing, or the
  // browsed one) as a Sonos Favorite and says so in the app's transient
  // message.
  const [favorites, setFavorites] = useState([])
  const [favoritesVersion, setFavoritesVersion] = useState(0)
  // `saveTrack` is filled in below once the service has answered: on a
  // station playing a track it can name, the row saves that track rather than
  // the station, which is what the app does.
  const saveTrack = useRef(null)
  const addStation = async () => {
    const song = saveTrack.current
    const result = item
      ? await actions.addFavoriteItem(hzone, { uri: item.uri, metadata: item.metadata || '', title: item.title,
                                                art: item.art || '', description: item.favoriteDescription || '' })
      : song
        ? await actions.addFavoriteItem(zone.uuid, song)
        : await actions.addFavorite(zone.uuid)
    if (!result) return
    const title = result.title || transport.container_title || transport.title
    onMessage?.(t(result.exists ? 'desk.info.alreadyFavorite' : 'desk.info.addedFavorite', { title }))
    setFavoritesVersion((v) => v + 1)
  }
  const favZone = (item ? hzone : zone?.uuid) || ''
  const myRadio = useMyRadioStations(favZone)
  useEffect(() => {
    let canceled = false
    if (!favZone) { setFavorites([]); return undefined }
    api.favorites(favZone).then((r) => { if (!canceled) setFavorites(r?.items || []) }).catch(() => {})
    return () => { canceled = true }
  }, [favZone, favoritesVersion])
  // One call per pane, never per render: for a browsed item it is asked for
  // by id, and for the playing track the zone route carries it already.
  const [extended, setExtended] = useState({})
  // What the service says the item itself is: its type decides the labels
  // ("Album" over "Song"), and the artist and album ids it returns are what
  // Artist Info and View All Songs on Album open (2026-09-07).
  const [meta, setMeta] = useState({})
  const extSid = sidOf(transport, item)
  // A queue row's own id is its position (Q:0/1); the service knows the item
  // by the id inside the row's URI, which is what the app asks it about. A
  // browsed row already carries the service's id. Asked about Q:0/1, Amazon
  // answered with nothing but its upsell link, so an episode opened from the
  // queue lost its Podcast Info and library rows (2026-09-07).
  // A station's track URI is the stream it resolved to (aac://https://...),
  // which names no service item; the id is in the media URI the speaker was
  // given. Without this fallback Info & Options never asked the service about
  // a playing station.
  const providerId = item
    ? (providerIdOf(item.uri) || item.id)
    : (providerIdOf(transport.track_uri || '') || providerIdOf(transport.media_uri || ''))
  // Which of the service's accounts the item belongs to: its URI's sn=. With
  // two Spotify accounts on the system the service answered for whichever
  // came first, and a favorite made here went under the wrong one.
  const extAccount = itemAccount(((item ? item.uri : (transport.track_uri || transport.media_uri)) || '').match(/[?&]sn=(\d+)/)?.[1] || '', services, extSid)
  // The service's rows and the Sonos rows are drawn together, once the
  // service has answered: they were arriving a few seconds apart (Mixcloud).
  // Nothing to ask means nothing to wait for.
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    setExtended({})
    setMeta({})
    setSettled(!extSid || !(providerId || (!item && zone?.uuid)))
    let canceled = false
    const asks = []
    if (providerId && extSid) {
      asks.push(api.serviceExtended(extSid, providerId, favZone, extAccount).then((r) => {
        if (!canceled) setExtended((prev) => ({ ...prev, ...(r || {}) }))
      }).catch(() => {}))
      asks.push(api.serviceItem(extSid, providerId, favZone, extAccount).then((r) => {
        if (!canceled) setMeta(r || {})
      }).catch(() => {}))
    }
    if (!item && zone?.uuid) {
      // The playing item: the zone route carries its ratings and, when the
      // track URI does not name the provider's id itself, the id to ask
      // the service about.
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
  const runLink = async (link) => {
    if (link.type === 'openUrl') { window.open(link.url, '_blank', 'noopener,noreferrer'); return }
    const done = await actions.serviceAction(favZone, extSid, link)
    if (done?.ok) {
      onMessage?.(link.success || t('desk.info.actionDone'))
      // The service asks for a re-read after some of these (an added
      // favorite flips the row to its remove form).
      if (link.refresh) setFavoritesVersion((v) => v + 1)
    } else if (done) {
      onMessage?.(link.failure || t('desk.info.actionFailed'))
    }
  }
  const station = transport.source !== 'queue'
  // A station playing a track the service itself can name: the app's Info &
  // Options is then the *track's* page, not the station's. Measured against
  // the app on 2026-09-14 with an Amazon Music station playing "Shivers":
  // Artist Info, the service's own two actions, and "Add Song to Sonos
  // Favorites" -- and clicking that row put the song in the household's
  // favorites (x-sonosapi-hls-static:catalog:track:asin:...), not the
  // station. A station whose track the service cannot name keeps the
  // station's page: AccuRadio names none, and the app offered "Add Station to
  // Sonos Favorites" there (2026-09-07). The test is what the service says
  // the current item is, not which service it is: Amazon answers for the
  // playing track with canAddToFavorites, an artistId and its own two
  // actions, while AccuRadio -- which also names Song, Artist and Album --
  // answers with none of them, and the app's page for that one is the
  // station's, three header lines over "Add Station to Sonos Favorites"
  // alone (2026-09-14). So the row follows the capability the
  // row is about: whether the service says this item can be favorited.
  const namedTrack = station && !item && meta.can_add_to_favorites === true
  saveTrack.current = namedTrack && meta.uri
    ? { uri: meta.uri, metadata: meta.metadata || '', title: meta.title || transport.title,
        art: meta.art || '', description: '' }
    : null
  // A station describes itself with one line, "Station <name>" -- measured on
  // the app 2026-09-06 with KNX 1070 playing, which showed no Song, Artist or
  // Album at all. A queue item keeps the three-line set.
  // A browsed album or artist is not a song: the app labels the collection
  // by what it is and drops the lines it has nothing for (measured on a Plex
  // album 2026-09-07: "Album Portrait In Jazz" over "Artist Bill Evans
  // Trio", no Song line).
  const headerArt = item ? (item.art || '') : (zone ? nowPlayingArt(zone.host, transport) : '')
  const kind = meta.item_type || item?.item_type || ''
  // A podcast episode (semanticType episode.*) is labeled Episode over
  // Podcast over Provider, the provider being the producer the service names
  // (measured on an Amazon Music episode 2026-09-07: "Wow in the World",
  // "Tinkercast").
  const episode = /^episode\./.test(meta.semantic_type || item?.semantic_type || '')
  // An audiobook chapter: the service names an author and narrator (Libby by
  // OverDrive) or the speaker reports the audioBook class. The app's info
  // header shows the same blocks as Now Playing, Chapter / Author / Narrator
  // (its InfoViewHeader binds the one metadata model), so this does too.
  // ...but not for a queued chapter: the app's info header for one reads
  // "Song / Artist" like any queue track (2026-09-07). A queue row arrives as
  // the speaker's DIDL (it has a `kind`), a browsed chapter as the service's
  // item (an `item_type`).
  const fromQueue = item ? (item.kind !== undefined && item.item_type === undefined)
    : transport.source === 'queue'
  const audiobook = !fromQueue && Boolean(meta.author || meta.narrator || item?.author
    || (!item && (transport.narrator || transport.track_kind === 'audiobook')))
  // A station playing a track it can name -- AccuRadio's channels, Amazon's
  // stations -- is described by that track: Song / Artist / Album, with the
  // rows still about the station (measured 2026-09-07 on AccuRadio:
  // "Maneater / Daryl Hall & John Oates / H2O" over "Add Station to Sonos
  // Favorites"). A broadcast stream with no such track reads "Station <name>"
  // (KNX 1070, 2026-09-06).
  const trackOnStation = station && !item && (transport.artist || transport.album)
    && transport.title && transport.title !== transport.container_title
  const lines = (station && !trackOnStation
    // A browsed station carries its own title; the playing one is named by
    // its container (the header was empty on a browsed Amazon station,
    // 2026-09-07).
    ? [[t('desk.info.station'), transport.container_title || (item ? item.title : transport.title)]]
    : trackOnStation
      // The service's own answer wins over the speaker's DIDL where it has
      // one: Amazon named no album for "Shivers" and the app's header showed
      // Song and Artist alone, while Now Playing, reading the speaker, showed
      // Album "=" (2026-09-14). An empty line is dropped rather than drawn
      // with nothing after it.
      ? [
          [t('desk.now.songLabel'), (namedTrack && meta.title) || transport.title],
          [t('desk.now.artist'), namedTrack ? meta.artist : transport.artist],
          [t('desk.now.album'), namedTrack ? meta.album : transport.album],
        ].filter(([, value]) => value)
    : kind === 'audiobook'
      ? [
          [t('desk.now.book'), meta.title || item?.title || ''],
          [t('desk.now.author'), meta.author || item?.author || ''],
        ]
    : audiobook
      ? [
          [t('desk.now.chapter'), meta.title || item?.title || transport.title],
          [t('desk.now.author'), meta.author || item?.author || transport.artist],
          ...(meta.narrator || item?.narrator || transport.narrator
            ? [[t('desk.now.narrator'), meta.narrator || item?.narrator || transport.narrator]] : []),
        ]
    : episode
      ? [
          [t('desk.now.episode'), meta.title || item?.title || transport.title],
          [t('desk.now.podcast'), meta.podcast || item?.podcast || ''],
          [t('desk.info.provider'), meta.producer || item?.artist || transport.artist],
        ]
    : kind === 'album'
      ? [
          [t('desk.now.album'), meta.title || transport.title],
          [t('desk.now.artist'), meta.artist || transport.artist],
        ]
      : kind === 'artist'
        ? [[t('desk.now.artist'), meta.title || transport.title]]
        : [
            [t('desk.now.songLabel'), transport.title],
            [t('desk.now.artist'), meta.artist || transport.artist],
            [t('desk.now.album'), meta.album || transport.album],
            // The station the service would start from this track -- its
            // relatedPlay -- is the fourth line in both apps ("Station
            // Alexander Hamilton Radio", Mac 2026-09-23; "Perfect Jazz for
            // the Jazz Cafe Radio", Windows 2026-09-05).
            [t('desk.info.station'), extended.related_play?.title || ''],
          ]).filter(([, value]) => value)
  // The queue track being described, so "Add to Sonos Playlist" can act on
  // it: a browsed row brings its own container, the playing track is read
  // back out of the queue (Q:0), which is where its DIDL lives.
  const pick = item
    ? { uri: item.uri, title: item.title, metadata: item.metadata || '' }
    : (zone?.transport?.track_uri
        ? { uri: zone.transport.track_uri, title: zone.transport.title || '', metadata: '' }
        : null)
  const addToPlaylist = onAddToPlaylist && pick?.uri
    ? () => onAddToPlaylist(pick, item ? undefined : 'Q:0')
    : null
  // The apps build this list from what the service itself returns for the
  // item, so a Spotify track offers Start Radio and Save to Your Music while
  // a Mixcloud show offers Favorite Show and Related shows. Sonora does not
  // read those yet (it is on the parity list), so it shows the rows Sonos
  // itself owns -- which is exactly what the app draws for a Plex track:
  // album and artist, the favorites toggle, and the playlist.
  // What a favorite of this thing would point at, so the row can say Remove
  // when the household already holds it: the app flips the label rather than
  // offering to add a second copy (seen 2026-09-06 on a Pandora station that
  // was already a favorite). On a station playing a named track that is the
  // track's own URI, which is what the app saves there.
  const favUri = item ? (item.uri || '')
    : (namedTrack && meta.uri ? meta.uri : (transport.media_uri || transport.track_uri || ''))
  const already = favUri ? favorites.find((f) => favoriteKey(f.uri) === favoriteKey(favUri)) : null
  const removeFavorite = already
    ? async () => {
        const done = await actions.removeFavorite(favZone, already.id)
        if (done) { onMessage?.(t('desk.info.removedFavorite', { title: already.title })); setFavoritesVersion((v) => v + 1) }
      }
    : null
  const favoriteRow = already
    ? [t('desk.info.removeFavorite'), false, removeFavorite]
    : [t(namedTrack ? (episode ? 'desk.info.addEpisodeFavorite' : 'desk.info.addSongFavorite')
          : station ? 'desk.info.addStationFavorite'
          : kind === 'album' ? 'desk.info.addAlbumFavorite'
          : kind === 'audiobook' ? 'desk.info.addBookFavorite'
          : episode ? 'desk.info.addEpisodeFavorite' : 'desk.info.addSongFavorite'),
       false, addStation]
  // Where the service says this item's album and artist live, so the rows
  // that open them can actually go there.
  const openItem = (id, title, info) => (onOpen && id
    ? () => onOpen(info
        ? { id: `__info-${id}`, info: true, title, item: { id, title }, serviceName }
        : { id, title, item: id, service: extSid, serviceName })
    : null)
  const albumRows = kind === 'album'
    ? [
        [t('desk.info.viewAllSongs'), true, openItem(item?.id, meta.title || item?.title, false)],
        ...(meta.artist_id ? [[t('desk.info.artistInfo'), true, openItem(meta.artist_id, meta.artist, true)]] : []),
      ]
    : []
  // The app offers a playing station to My Radio Stations before offering it
  // to Sonos Favorites (KNX 1070, 2026-09-06: "Add to My Radio Stations" then
  // "Add Station to Sonos Favorites", neither with a chevron).
  const stationUri = item ? (item.uri || '') : (transport.media_uri || '')
  const stationName = item ? item.title : (transport.container_title || transport.title || '')
  const addToMyStations = favZone && stationUri && stationName
    ? async () => {
        const done = await actions.addRadioStation(favZone, stationUri, stationName)
        if (done) {
          onMessage?.(t(done.exists ? 'desk.radio.alreadyMine' : 'desk.radio.addedMine',
                        { title: done.title || stationName }))
          myRadio.reload()
        }
      }
    : null
  // Already saved, the row takes it out again (lib/myRadio.js).
  const savedStation = stationUri ? myRadio.find(stationUri) : null
  const removeFromMyStations = savedStation
    ? async () => {
        const done = await actions.removeRadioStation(favZone, savedStation.id)
        if (done) {
          onMessage?.(t('desk.radio.removedMine', { title: savedStation.title || stationName }))
          myRadio.reload()
        }
      }
    : null
  const myStationsRow = savedStation
    ? [t('desk.info.removeMyStations'), false, removeFromMyStations]
    : [t('desk.info.addMyStations'), false, addToMyStations]
  // The show a station says is on air is a stream in its own right -- TuneIn
  // returns p1151215 titled "Marci Wiser" for 95.5 KLOS -- and the app offers
  // it to My Radio Shows (the speakers' R:0/1) beside the stations row
  // (2026-09-07).
  const showId = item ? '' : (transport.stream_show_id || '')
  const showName = item ? '' : (transport.stream_show || '')
  const sidHere = sidOf(transport, item)
  const addToMyShows = favZone && showId && showName
    ? async () => {
        const uri = `x-sonosapi-stream:${encodeURIComponent(showId)}?sid=${sidHere}&flags=8224&sn=0`
        const done = await actions.addRadioStation(favZone, uri, showName, 'shows')
        if (done) {
          onMessage?.(t(done.exists ? 'desk.radio.alreadyShow' : 'desk.radio.addedShow',
                        { title: done.title || showName }))
        }
      }
    : null
  // "My Radio Stations" is TuneIn's own container, so the app offers it only
  // for a TuneIn station: KNX 1070 showed both rows, Audacy's WEEI 93.7 only
  // the favorites one (measured 2026-09-06).
  // The service's own rows come first, in its own wording: its InfoView
  // presentation map names the menu items and its strings table supplies the
  // labels, while getExtendedMetadata gives the related list and the
  // description. Measured on the app 2026-09-06: a Mixcloud show shows
  // Favorite Show / Unfavorite Show / Related shows / Description above
  // Sonos' own rows, and a Plex track shows none of its own.
  // Favorite / Unfavorite are the service's own, and they are createItem and
  // deleteItem with a <favorite> -- not ratings (measured on Mixcloud
  // 2026-09-06, whose schema rejects rateItem outright).
  const favoriteAction = (menuItem) => {
    const on = /^Add\w*ToFavorites$/.test(menuItem.item)
    const off = /^Remove\w*FromFavorites$/.test(menuItem.item)
    // Now Playing's page has no browse row: the playing item's own id then.
    const target = item?.id || providerId
    if ((!on && !off) || !extSid || !target) return null
    return async () => {
      const done = await actions.serviceFavorite(extSid, {
        item: target, favorite: on, zone: favZone || undefined, account: extAccount })
      if (done?.ok) onMessage?.(menuItem.label)
    }
  }
  // A menu item only shows where it can act. RelatedPlay ("Start Plex Mix")
  // is a mix seeded from a track: the app's info view for a Plex album, which
  // the same presentation map covers, does not offer it (measured
  // 2026-09-07), and it needs the item's own <relatedPlay>: Pandora's map
  // names "Play Curated Mode", but a station carries none and the app shows
  // no such row (2026-09-23). A favorite row needs the provider to take the
  // item.
  // The service's own playlists, for a song: asked once (the answer is
  // remembered), and the row only drawn where the service keeps any.
  const songKind = !station && !episode && !['album', 'artist', 'playlist', 'audiobook'].includes(kind)
  const [userPlaylists, setUserPlaylists] = useState(false)
  useEffect(() => {
    setUserPlaylists(false)
    if (!extSid || !providerId || !songKind) return undefined
    let canceled = false
    api.userPlaylists(extSid, { zone: favZone, account: extAccount, probe: true })
      .then((r) => { if (!canceled) setUserPlaylists(Boolean(r?.available)) }).catch(() => {})
    return () => { canceled = true }
  }, [extSid, providerId, songKind, favZone, extAccount])
  // With two accounts of the service the app names the one: "Spotify
  // (Sam's Spotify)".
  const sameService = services.filter((svc) => svc.id === extSid)
  const accountName = sameService.length > 1
    ? sameService.find((svc) => String(svc.account_id ?? '') === extAccount)?.nickname || '' : ''
  const serviceLabel = accountName ? `${serviceName} (${accountName})` : serviceName
  const servicePlaylistLabel = t('desk.info.addToServicePlaylist', { service: serviceLabel })
  const servicePlaylistRow = userPlaylists && onOpen
    ? [servicePlaylistLabel, true, () => onOpen({
        id: `__svcpl-${providerId}`, servicePlaylist: true, cancel: true, title: servicePlaylistLabel,
        sid: extSid, account: extAccount, pick: { id: providerId, title: item?.title || transport.title || '' } })]
    : null
  // Start the station the service seeds from this item (its relatedPlay):
  // the item it names is looked up for the URI a speaker plays, and the
  // room in view is pointed at it.
  const relatedPlay = extended.related_play?.id && !['album', 'artist', 'playlist'].includes(kind)
    ? extended.related_play : null
  const startRadio = relatedPlay && extSid
    ? async () => {
        const found = await api.serviceItem(extSid, relatedPlay.id, favZone, extAccount).catch(() => null)
        const target = zone?.uuid || hzone
        if (!found?.uri || !target) { onMessage?.(t('notice.error.title')); return }
        await actions.setSource(target, { uri: found.uri, metadata: found.metadata || '',
                                          title: relatedPlay.title || '', service: extSid, kind: relatedPlay.item_type || '' })
      }
    : null
  // Whether the service says the item is already one of its favorites: a
  // dynamic isHearted of 0 or 1. Where it says, the apps show only the row
  // that applies -- "Save to Your Music" on a Spotify track that is not
  // saved, never its Remove twin (both apps); where it says nothing
  // (Mixcloud) they keep both.
  const hearted = meta.properties?.isHearted
  const menuRows = (extended.menu || []).filter((m) => {
    const fav = /^(Add|Remove)(Album|Track|Artist|Playlist|Show|Episode)?(To|From)Favorites$/.exec(m.item || '')
    if (fav) {
      if (hearted === '0' && fav[1] === 'Remove') return false
      if (hearted === '1' && fav[1] === 'Add') return false
      // A service declares its favorites rows per kind of thing, and the
      // app shows the pair for the kind in hand: Spotify names Add/Remove
      // for both albums and tracks under the same "Save to Your Music"
      // label, and a track's page showed each label twice here
      // (2026-09-07). An unqualified pair (Mixcloud's) applies to anything.
      const forKind = fav[2] || ''
      const itemKind = kind === 'album' || kind === 'artist' || kind === 'playlist' ? kind
        : episode ? 'episode' : 'track'
      if (forKind && forKind.toLowerCase() !== itemKind && !(forKind === 'Show' && episode)) return false
      return meta.can_add_to_favorites !== false
    }
    if (m.item === 'RelatedPlay') return Boolean(extended.related_play) && !['album', 'artist', 'playlist'].includes(kind)
    return true
  })
  const serviceRows = [
    // Start Radio heads the page wherever the item seeds a station and the
    // service's map names no row of its own for it (it does for Plex: "Start
    // Plex Mix"); both apps put it first (2026-09-05, 2026-09-23).
    ...(startRadio && !menuRows.some((m) => m.item === 'RelatedPlay')
      ? [[t('desk.info.startRadio'), false, startRadio]] : []),
    // "Add Song to Spotify (Sam's Spotify) Playlist", second in both apps,
    // where the service keeps playlists of the user's own.
    ...(servicePlaylistRow ? [servicePlaylistRow] : []),
    ...menuRows.map((m) => [m.label, false, m.item === 'RelatedPlay' ? startRadio : favoriteAction(m)]),
    ...(extended.related || []).filter((r) => r.label && r.id).map((r) => [r.label, true,
      onOpen ? () => onOpen({ id: r.id, title: r.label, item: r.id, service: extSid,
                              serviceName }) : null]),
    ...(extended.text && extended.text_label
      ? [[extended.text_label, true, onOpen
          ? () => onOpen({ id: `__text-${extended.text}`, prose: true, title: extended.text_label,
                           header: { art: headerArt, lines },
                           textOf: { sid: extSid, item: extended.text, type: extended.text_type || 'DESCRIPTION' } })
          : null]]
      : []),
  ]
  // The playlist row is the one thing a named track on a station does not
  // get: the app's page for "Shivers" on an Amazon station ended at the
  // favorites row (2026-09-14), while a queued track offers "Add Song to
  // Sonos Playlist" below it.
  const rows = (station && !namedTrack) ? [
    // A station has the service's own rows too: Community Radio Plus offers
    // "About this station" above the favorites row, and the app draws it
    // there with a chevron (measured 2026-09-12, where Sonora showed the
    // favorites row alone). TuneIn returns no description, so its page is
    // unchanged.
    ...serviceRows,
    ...(sidHere === 254 ? [myStationsRow] : []),
    ...(sidHere === 254 && addToMyShows
      ? [[t('desk.info.addMyShows'), false, addToMyShows]] : []),
    favoriteRow,
  ] : [
    ...serviceRows,
    // Album Info and Artist Info are navigations, so the app offers them only
    // where there is an album and an artist to open: a Plex track showed both
    // and a Mixcloud show, which names no album, showed neither
    // (2026-09-06).
    ...albumRows,
    // An episode opens its show: "Podcast Info" on the podcastId the
    // service returns (Amazon Music, 2026-09-07).
    ...(episode && meta.podcast_id
      ? [[t('desk.info.podcastInfo'), true, openItem(meta.podcast_id, meta.podcast, true)]]
      : []),
    ...(albumRows.length || episode ? [] : meta.album_id || meta.artist_id
      ? [
          ...(meta.album_id ? [[t('desk.info.albumInfo'), true, openItem(meta.album_id, meta.album, true)]] : []),
          ...(meta.artist_id ? [[t('desk.info.artistInfo'), true, openItem(meta.artist_id, meta.artist, true)]] : []),
        ]
      : (transport.album && transport.artist
          ? [[t('desk.info.albumInfo'), true], [t('desk.info.artistInfo'), true]]
          : [])),
    // What the service offers to do with the item, from its relatedActions:
    // a request it names outright (Amazon's "Add to my Amazon Music
    // Library") or a page to open ("Upgrade to Amazon Music Unlimited").
    // The app lists them here, after the navigations and before the Sonos
    // rows, without chevrons (2026-09-07).
    ...(extended.links || []).filter((l) => l.label).map((l) => [l.label, false, () => runLink(l)]),
    // Kept beside a service's own favorites row too: the Mac app draws "Add
    // Song to Sonos Favorites" on a Spotify track's page a moment after the
    // rest (2026-09-24), which an earlier look taken too soon had missed.
    favoriteRow,
    // An audiobook is never queued or put in a playlist: the app's page for
    // one ends at "Add Book to Sonos Favorites" (Libby, 2026-09-08).
    ...(kind === 'audiobook' || namedTrack ? [] : [[t(kind === 'album' ? 'desk.info.addAlbumPlaylist'
        : episode ? 'desk.info.addEpisodePlaylist' : 'desk.info.addToSonosPlaylist'), true, addToPlaylist]]),
  ].filter(([label]) => label)
  return (
    <>
      <div className="dk-info-block">
        <span className="dk-info-art">
          <Art src={headerArt} size={64} />
        </span>
        <dl>
          {lines.map(([label, value]) => (
            <React.Fragment key={label}><dt>{label}</dt><dd>{value}</dd></React.Fragment>
          ))}
        </dl>
      </div>
      {settled && rows.map(([label, more, act]) => (
        act ? (
          <button key={label} type="button" className="dk-browse-row dk-info-row" onClick={act}>
            <span className="dk-browse-text"><p className="dk-browse-title">{label}</p></span>
            {more && <Icon.ChevronRight className="dk-browse-disclosure" />}
          </button>
        ) : (
          <div key={label} className="dk-browse-row dk-info-row" aria-disabled="true" title={t('desk.menu.disabledNote')}>
            <span className="dk-browse-text"><p className="dk-browse-title">{label}</p></span>
            {more && <Icon.ChevronRight className="dk-browse-disclosure" />}
          </div>
        )
      ))}
    </>
  )
}

// The app's text dialog (utilities/textinputdialogwindow.xaml): a bold
// instruction over a text field with a validator mark, OK and Cancel.
function NameDialog({ title, body, initial = '', onClose, onSubmit }) {
  const { t } = useI18n()
  const [value, setValue] = useState(initial)
  const ok = value.trim() && value.trim() !== initial
  return (
    <Confirm title={title} body={body} action={t('common.ok')} disabled={!ok} onClose={onClose}
             className="win-textdialog" cancelLabel={t('common.cancel')}
             onConfirm={() => onSubmit(value.trim())}>
      <input type="text" className="dk-rename-input" value={value} autoFocus
             onFocus={(event) => event.target.select()}
             onChange={(event) => setValue(event.target.value)}
             onKeyDown={(event) => { if (event.key === 'Enter' && ok) onSubmit(value.trim()) }} />
    </Confirm>
  )
}
function RenameFavorite({ item, onClose, onRename }) {
  const { t } = useI18n()
  return <NameDialog title={t('desk.favorites.rename')} body={t('desk.favorites.renameBody')} initial={item.title || ''} onClose={onClose} onSubmit={onRename} />
}

function ActionMenu({ item, x, y, onClose, onAct, canUnselect = false, saved = null, servicePlaylistLabel = null }) {
  const { t } = useI18n()
  const ref = useRef(null)
  useEffect(() => {
    const close = (event) => { if (ref.current && !ref.current.contains(event.target)) onClose() }
    const key = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', key)
    }
  }, [onClose])
  const style = x != null
    ? { left: Math.min(x, window.innerWidth - 240), top: Math.min(y, window.innerHeight - 180) }
    : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
  const playable = Boolean(item.uri)
  const favoriteButton = saved
    ? <button type="button" role="menuitem" onClick={() => onAct('unfavorite')}>{t('desk.favorites.remove')}</button>
    : <button type="button" role="menuitem" onClick={() => onAct('favorite')}>{t('desk.actions.addFavorite')}</button>
  // Radio-style sources play directly; the speakers cannot queue them.
  // Streams and stations are not queued; nor is an audiobook, which the app
  // hands to the player whole (its row menu reads Play Now / Add to Sonos
  // Favorites / Info & Options, no queue rows -- Libby, 2026-09-08).
  const queueable = !/^(x-sonos-htastream|x-rincon-stream|x-sonosapi-radio|x-sonosapi-stream|x-rincon-mp3radio):/.test(item.uri || '')
    && item.item_type !== 'audiobook'
  // The television input: the app's caret and right-click both open a menu
  // holding nothing but Play Now -- no title line, no favorites, no info
  // (measured against the S2 app on an Arc Ultra, 2026-09-11).
  if (item.id === 'tv') {
    return (
      <div className="dk-popover dk-action-menu dk-action-menu-one" ref={ref} role="menu" style={style}>
        <button type="button" role="menuitem" onClick={() => onAct('now')}>{t('desk.actions.playNow')}</button>
      </div>
    )
  }
  if (item.playlist) {
    // The app's menu on a Sonos Playlist (observed 2026-09-05): the queue
    // actions | Rename Playlist, Delete Playlist | Add to Sonos Favorites,
    // Add to Sonos Playlist | Unselect All.
    return (
      <div className="dk-popover dk-action-menu" ref={ref} role="menu" style={style}>
        <p className="dk-popover-title">{item.title}</p>
        <button type="button" role="menuitem" onClick={() => onAct('now')}>{t('desk.actions.playNow')}</button>
        <button type="button" role="menuitem" onClick={() => onAct('next')}>{t('desk.actions.playNext')}</button>
        <button type="button" role="menuitem" onClick={() => onAct('add')}>{t('desk.actions.addToQueue')}</button>
        <button type="button" role="menuitem" onClick={() => onAct('replace')}>{t('desk.actions.replaceQueue')}</button>
        <hr className="dk-popover-sep" />
        <button type="button" role="menuitem" onClick={() => onAct('renamePlaylist')}>{t('desk.playlists.rename')}</button>
        <button type="button" role="menuitem" onClick={() => onAct('deletePlaylist')}>{t('desk.playlists.delete')}</button>
        <hr className="dk-popover-sep" />
        {favoriteButton}
        <button type="button" role="menuitem" onClick={() => onAct('addToPlaylist')}>{t('desk.favorites.addToSonosPlaylist')}</button>
        <hr className="dk-popover-sep" />
        <button type="button" role="menuitem" disabled={!canUnselect} onClick={() => onAct('unselect')}>{t('desk.actions.unselectAll')}</button>
      </div>
    )
  }
  if (item.favorite) {
    // The app's menu on a Sonos Favorite, both shapes captured 2026-09-06.
    // A favorite that can join the queue (a playlist, an album): Play Now,
    // Play Next, Add to End of Queue, Replace Queue | Rename, Remove | Add to
    // Sonos Playlist, Add to <Service> Playlist | Info & Options. A station
    // favorite, which the speakers cannot queue: Play Now | Rename, Remove,
    // and nothing else. One whose service has left the system keeps only
    // Rename and Remove.
    const usable = item.available !== false && playable
    return (
      <div className="dk-popover dk-action-menu" ref={ref} role="menu" style={style}>
        <p className="dk-popover-title">{item.title}</p>
        {usable && (
          <>
            <button type="button" role="menuitem" onClick={() => onAct('now')}>{t('desk.actions.playNow')}</button>
            {queueable && (
              <>
                <button type="button" role="menuitem" onClick={() => onAct('next')}>{t('desk.actions.playNext')}</button>
                <button type="button" role="menuitem" onClick={() => onAct('add')}>{t('desk.actions.addToQueue')}</button>
                <button type="button" role="menuitem" onClick={() => onAct('replace')}>{t('desk.actions.replaceQueue')}</button>
              </>
            )}
            <hr className="dk-popover-sep" />
          </>
        )}
        <button type="button" role="menuitem" onClick={() => onAct('rename')}>{t('desk.favorites.rename')}</button>
        <button type="button" role="menuitem" onClick={() => onAct('remove')}>{t('desk.favorites.remove')}</button>
        {usable && queueable && (
          <>
            <hr className="dk-popover-sep" />
            <button type="button" role="menuitem" onClick={() => onAct('addToPlaylist')}>{t('desk.favorites.addToSonosPlaylist')}</button>
            <hr className="dk-popover-sep" />
            <button type="button" role="menuitem" onClick={() => onAct('info')}>{t('desk.now.infoOptions')}</button>
          </>
        )}
      </div>
    )
  }
  return (
    <div className="dk-popover dk-action-menu" ref={ref} role="menu" style={style}>
      <p className="dk-popover-title">{item.title}</p>
      {/* A row that only leads somewhere (no URI to play) offers just the
          favorites entry and Unselect All, as the app's does. */}
      {/* Two layouts observed in the app on 2026-09-05. Anything that can
          join the queue (tracks, albums, playlists): Play Now, Play Next, Add
          to End of Queue, Replace Queue | Add to Sonos Favorites, Add to
          Sonos Playlist | Info & Options | Unselect All. A station: Play
          Now, Add to Sonos Favorites | Info & Options, Unselect All. */}
      {playable && queueable ? (
        <>
          <button type="button" role="menuitem" onClick={() => onAct('now')}>{t('desk.actions.playNow')}</button>
          <button type="button" role="menuitem" onClick={() => onAct('next')}>{t('desk.actions.playNext')}</button>
          <button type="button" role="menuitem" onClick={() => onAct('add')}>{t('desk.actions.addToQueue')}</button>
          <button type="button" role="menuitem" onClick={() => onAct('replace')}>{t('desk.actions.replaceQueue')}</button>
          {/* A track inside a Sonos Playlist can leave it, in its own group
              between the queue actions and the adds (observed 2026-09-06). */}
          {item.inPlaylist && (
            <>
              <hr className="dk-popover-sep" />
              <button type="button" role="menuitem" onClick={() => onAct('removeFromPlaylist')}>{t('desk.playlists.removeSong')}</button>
            </>
          )}
          <hr className="dk-popover-sep" />
          {favoriteButton}
          <button type="button" role="menuitem" onClick={() => onAct('addToPlaylist')}>{t('desk.favorites.addToSonosPlaylist')}</button>
          {/* "Add to Spotify (Sam's Spotify) Playlist", under the Sonos one
              in the app's menu on a song (2026-09-23). */}
          {servicePlaylistLabel && !item.is_container && (
            <button type="button" role="menuitem" onClick={() => onAct('addToServicePlaylist')}>{servicePlaylistLabel}</button>
          )}
          <hr className="dk-popover-sep" />
          <button type="button" role="menuitem" onClick={() => onAct('info')}>{t('desk.now.infoOptions')}</button>
          <hr className="dk-popover-sep" />
          <button type="button" role="menuitem" disabled={!canUnselect} onClick={() => onAct('unselect')}>{t('desk.actions.unselectAll')}</button>
        </>
      ) : (
        <>
          {/* A saved radio station (My Radio Stations) puts a rule between
              every entry; a service's station only before Info & Options. */}
          {playable && (
            <button type="button" role="menuitem" onClick={() => onAct('now')}>{t('desk.actions.playNow')}</button>
          )}
          {/* A station's menu rules off every entry (TuneIn station and the
              saved-station list alike, re-measured 2026-09-07: the rules sit
              between Play Now, Add to Sonos Favorites, Info & Options and
              Unselect All); a bare category's has only the one above
              Unselect All (Amazon's Collections). */}
          {playable && <hr className="dk-popover-sep" />}
          {/* A browse category has no URI to play but can still be saved:
              the apps enable this on rows like AccuRadio's "Most Popular
              Channels" (seen 2026-09-06). */}
          <button type="button" role="menuitem" disabled={!playable && !item.favorite_uri}
                  title={playable || item.favorite_uri ? undefined : t('desk.menu.disabledNote')}
                  onClick={() => onAct(saved ? 'unfavorite' : 'favorite')}>{t(saved ? 'desk.favorites.remove' : 'desk.actions.addFavorite')}</button>
          {/* A home row whose browse policies speak to playback (a canPlay
              key, true or false) pairs the favorite with Add to Sonos
              Playlist: Amazon's Collections, Top Stations, even Try Amazon
              Music Unlimited (2026-09-07). One whose policies do not --
              Spotify's shelves declare none, Sonos Radio's only favorites --
              gets the favorite alone, like a SMAPI container inside
              (measured 2026-09-14; this used to key on the row being a home
              row at all, which gave those two a row the app never draws). A
              playlist gets Info & Options besides. */}
          {!playable && item.is_container && item.playlist_policy && (
            <button type="button" role="menuitem" disabled={!item.favorite_uri}
                    title={item.favorite_uri ? undefined : t('desk.menu.disabledNote')}
                    onClick={() => onAct('addToPlaylist')}>{t('desk.favorites.addToSonosPlaylist')}</button>
          )}
          {/* A podcast show has extended metadata to open: the app's menu on
              a Pocket Casts show is Add to Sonos Favorites, Info & Options,
              Unselect All (2026-09-14). */}
          {(playable || (item.is_container && ['playlist', 'album', 'artist', 'show'].includes(item.item_type))) && (
            <>
              <hr className="dk-popover-sep" />
              <button type="button" role="menuitem" onClick={() => onAct('info')}>{t('desk.now.infoOptions')}</button>
            </>
          )}
          <hr className="dk-popover-sep" />
          <button type="button" role="menuitem" disabled={!canUnselect} onClick={() => onAct('unselect')}>{t('desk.actions.unselectAll')}</button>
        </>
      )}
    </div>
  )
}




