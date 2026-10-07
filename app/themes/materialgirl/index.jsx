import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { orderedHouseholds, systemChoiceMatters } from '../../frontend/src/lib/format.js'
import { useSleepTimer } from '../../frontend/src/lib/useSleepTimer.js'
import AboutSonora from '../../frontend/src/components/AboutSonora.jsx'
import { nowPlayingArt } from '../../frontend/src/components/Art.jsx'
import { useShellSelection } from '../../frontend/src/lib/shellSelection.js'
import { isTyping, isCommand, keyOf, shuffleToggled, repeatCycled } from '../../frontend/src/lib/keys.js'
import logo from '../../frontend/src/assets/sonora.png'
import * as I from './icons.jsx'
import { IconButton, Menu, MenuItem, MenuSep, Confirm, Snackbars, SystemPicker, TooltipLayer, cx } from './m3.jsx'
import { SECTION_KEY, readStored, writeStored, useServices, useLibraryPresence, useAccountChoice, useFavorites, usePlaylists, useRecent,
         useQueue, householdOf, zoneForHousehold, playItems, pauseEverything, togglePlay, groupTitle, describeFavorite, isQueueable, favoriteTarget } from './data.js'
import { useDynamicColor, readDynamic } from './color.js'
import { loadRobotoFlex } from './fonts.js'
import { useWindowClass, isLarge } from './layout.js'
import Listen from './Listen.jsx'
import Browse, { AddToPlaylistSheet, AddRadioSheet } from './Browse.jsx'
import RoomsPage, { RoomSettings, GroupDialog } from './Rooms.jsx'
import ClockPage, { SleepSheet } from './Clock.jsx'
import SettingsPage, { LinkServiceSheet, ShortcutsSheet } from './Settings.jsx'
import { NowToolbar, PlayerView } from './Player.jsx'
import { QueueSheet, QueuePane } from './Queue.jsx'
import InfoSheet, { ProseSheet } from './Info.jsx'
import SearchView from './SearchView.jsx'
import { tokens } from './tokens.js'
import './mg.css'
import thumbnail from './thumbnail.webp'
import darkThumbnail from './thumbnail-dark.webp'
import strings from './strings.js'
import { useThemeLanding } from '../../frontend/src/lib/theme.jsx'

// Material Girl: the Sonos controller rebuilt on Material 3 Expressive.
//
// The window takes its navigation from its width, as M3's adaptive layouts
// do: a navigation bar along the bottom of a phone, a navigation rail on a
// tablet, and a rail that opens out with its labels on a desktop. The music
// playing in the room in view rides in a floating toolbar at the foot of
// every page and opens into a full player whose colors come from the cover.
// The house-wide actions stand in the Rooms page's header. Everything the
// desktop themes can do is here, on Material's own paths.

const SECTIONS = ['listen', 'browse', 'rooms', 'clock', 'settings']
const NAV = {
  listen: [I.Home, I.HomeLine],
  browse: [I.Browse, I.BrowseLine],
  rooms: [I.Rooms, I.RoomsLine],
  clock: [I.Alarm, I.AlarmLine],
  settings: [I.Settings, I.SettingsLine],
}
const RAIL_KEY = 'sonora.mg.rail'
const QUEUE_KEY = 'sonora.mg.queue'

export function Shell() {
  const { zones, groups, households, connected, actions, notices, dismiss, servicesEpoch, recentEpoch, favoritesEpoch: savedEpoch, playlistsEpoch } = useSystem()
  const { t, language } = useI18n()
  const size = useWindowClass()
  const compact = size === 'compact'
  const wide = size === 'expanded' || isLarge(size)
  const [section, setSectionState] = useState(() => (SECTIONS.includes(readStored(SECTION_KEY)) ? readStored(SECTION_KEY) : 'listen'))
  const setSection = useCallback((id) => { setSectionState(id); writeStored(SECTION_KEY, id) }, [])
  const { activeId, activeGroup, activeZone, visibleGroups: shownGroups, visibleZones, systemFilter, chooseSystem, select } =
    useShellSelection({ byMember: true, preferAllWhenMany: true })
  // Every list of rooms puts the groups of two or more before the rooms playing alone, each part in
  // the order it came.
  const visibleGroups = useMemo(() => [
    ...shownGroups.filter((g) => (g.members?.length || 0) > 1),
    ...shownGroups.filter((g) => (g.members?.length || 0) <= 1),
  ], [shownGroups])
  const [railOpen, setRailOpen] = useState(() => readStored(RAIL_KEY, '1') === '1')
  useEffect(() => { writeStored(RAIL_KEY, railOpen ? '1' : '0') }, [railOpen])
  // At medium width the rail expands as a modal over the content (Material's modal wide rail); it is
  // not remembered, and going anywhere closes it.
  const [modalRail, setModalRail] = useState(false)
  useEffect(() => { setModalRail(false) }, [section, size])
  const modal = size === 'medium' && modalRail
  const [settingsPage, setSettingsPage] = useState('')
  // Every settings page opens at its top. They share the one scrolling main,
  // so a page used to open wherever the last one had been scrolled to.
  // Going back to the list on a phone returns to
  // where the list was.
  // The list's place is taken as a page is chosen: by the time the page has
  // drawn, the browser has already pulled the scroll in to fit it.
  const mainRef = useRef(null)
  const listScroll = useRef(0)
  const openSettingsPage = useCallback((next) => {
    if (!settingsPage && mainRef.current) listScroll.current = mainRef.current.scrollTop
    setSettingsPage(next)
  }, [settingsPage])
  // Chosen just now from the theme chooser: open on this theme's own theme page.
  useThemeLanding(() => { setSection('settings'); setSettingsPage('appearance') })
  useLayoutEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = settingsPage ? 0 : listScroll.current
  }, [settingsPage])
  const [playerOpen, setPlayerOpen] = useState(false)
  const [queueOpen, setQueueOpen] = useState(() => readStored(QUEUE_KEY) === '1')
  useEffect(() => { writeStored(QUEUE_KEY, queueOpen ? '1' : '0') }, [queueOpen])
  const [groupDialog, setGroupDialog] = useState(null)
  const [roomSettings, setRoomSettings] = useState(null)
  const [info, setInfo] = useState(null)
  const [prose, setProse] = useState(null)
  const [search, setSearch] = useState(false)
  const [sleepOpen, setSleepOpen] = useState(false)
  const [addRadio, setAddRadio] = useState(false)
  const [linking, setLinking] = useState(null)
  const [addTo, setAddTo] = useState(null)
  const [about, setAbout] = useState(false)
  const [shortcuts, setShortcuts] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [quickMenu, setQuickMenu] = useState(null)
  const [libraryRequest, setLibraryRequest] = useState(null)
  const [snacks, setSnacks] = useState([])
  // Bumped when this theme saves or removes a favorite; savedEpoch and playlistsEpoch are the
  // store's, bumped when the speakers announce a change made anywhere (another app included).
  const [favoritesEpoch, setFavoritesEpoch] = useState(0)
  const [servicesVersion, setServicesVersion] = useState(0)
  const [queueEdited, setQueueEdited] = useState(false)
  const [scopeState, setScopeState] = useState({ scope: null, scopes: [] })

  // --- the data every section shares -----------------------------------------
  const services = useServices(servicesVersion + servicesEpoch)
  const libraryByHh = useLibraryPresence(households, servicesVersion)
  const [accountChoice, pickAccount] = useAccountChoice()
  const activeHousehold = activeZone ? householdOf(households, activeZone.uuid) : null
  const hzone = activeZone?.uuid || ''
  // "This browser" belongs to no system, so its favorites are
  // those of the system the picker has chosen, or of the first when it shows
  // all, read through one of that system's rooms; the browser's own id names
  // no speaker to read them from, and Home said there were none (as
  // Hi-Fi already did). Each favorite carries that room, so playing one in
  // the browser knows which household resolves it.
  const readZone = activeZone?.local
    ? (zoneForHousehold(households, zones, null,
        (households.find((h) => h.id === systemFilter) || orderedHouseholds(households)[0])?.id)?.uuid || '')
    : hzone
  const readFavorites = useFavorites(readZone, favoritesEpoch + savedEpoch)
  const favorites = useMemo(() => (activeZone?.local
    ? { ...readFavorites, items: readFavorites.items.map((item) => ({ ...item, hzone: item.hzone || readZone })) }
    : readFavorites), [readFavorites, activeZone?.local, readZone])
  const playlists = usePlaylists(hzone, favoritesEpoch + playlistsEpoch)
  const recent = useRecent(hzone, recentEpoch)
  const queue = useQueue(activeZone)
  const sleep = useSleepTimer(activeZone?.uuid)
  useEffect(() => { setQueueEdited(false) }, [activeZone?.uuid])

  // Dynamic color: the room in view's cover seeds the scheme.
  const [dynamic, setDynamic] = useState(readDynamic)
  useEffect(() => {
    const on = (event) => setDynamic(Boolean(event.detail))
    window.addEventListener('sonora:mgdynamic', on)
    return () => window.removeEventListener('sonora:mgdynamic', on)
  }, [])
  const art = activeZone && activeZone.transport?.source !== 'tv' ? nowPlayingArt(activeZone.host, activeZone.transport || {}) : ''
  useDynamicColor(Array.isArray(art) ? art[0] : art, dynamic)
  useEffect(() => { loadRobotoFlex() }, [])

  const toast = useCallback((text) => {
    if (!text) return
    const id = Date.now() + Math.random()
    setSnacks((prev) => [...prev.slice(-2), { id, text }])
    setTimeout(() => setSnacks((prev) => prev.filter((x) => x.id !== id)), 4000)
  }, [])

  // --- playing from Listen and the search view --------------------------------
  const playItem = useCallback(async (item, sourceId, how = 'now') => {
    if (!activeZone) return
    if (how === 'now' || how === 'replace') setQueueEdited(false)
    const done = await playItems(actions, [item], how, { hzone: activeZone.uuid, from: activeZone.local ? (item.hzone || '') : '' })
    if (done) toast(t(how === 'now' ? 'mg.playingNow' : how === 'next' ? 'mg.queuedNext' : how === 'replace' ? 'mg.replacedQueue' : 'mg.addedToQueue', { title: item.title }))
  }, [activeZone, actions, toast, t])
  const openFavorite = useCallback((item) => {
    if (!activeZone || !activeHousehold) return
    const { svc, account, kind } = favoriteTarget((services.byHousehold[activeHousehold.id] || []).filter((s) => s.id === item.service_id), item,
                                                  accountChoice[`${activeHousehold.id}:${item.service_id}`])
    setLibraryRequest({ n: Date.now(), kind: 'node',
      path: [{ id: 'FV:2', title: t('desk.browse.favorites'), item: 'root', hzone: activeZone.uuid, hh: activeHousehold.id, glyph: 'star' }],
      node: { id: `${item.service_id}:${item.browse_id}`, title: item.title, service: item.service_id, item: item.browse_id, hzone: activeZone.uuid, hh: activeHousehold.id,
              account, icon: svc?.icon || '', kind, uri: item.uri, metadata: item.metadata, art: item.art, serviceName: svc?.name || '' } })
    setSection('browse')
  }, [activeZone, activeHousehold, services.byHousehold, accountChoice, setSection, t])
  const browseSource = useCallback((id) => { setLibraryRequest({ n: Date.now(), kind: 'source', id }); setSection('browse') }, [setSection])
  const serviceNameOf = useCallback((uri, sidFallback = null) => {
    const sid = Number((/[?&]sid=(\d+)/.exec(uri || '') || [])[1]) || sidFallback
    if (!sid || !activeHousehold) return ''
    return (services.byHousehold[activeHousehold.id] || []).find((s) => s.id === sid)?.name || ''
  }, [services.byHousehold, activeHousehold])

  // --- info, and the paths out of it -------------------------------------------
  const openInfoForNow = () => { if (activeZone) setInfo({ now: true }) }
  const openInfoForItem = (item, ctx = {}) => setInfo({ item, hzone: ctx.hzone || activeZone?.uuid, serviceName: ctx.serviceName || serviceNameOf(item.uri, item.service_id), source: ctx.source || '' })
  const infoOpen = (node) => {
    if (node.prose) { setProse({ ...node, hzone: info?.hzone || activeZone?.uuid }); return }
    // Album Info and its kind open the item's own Info & Options, as the desktop apps' do.
    if (node.info) { setProse(null); setInfo({ item: node.item, hzone: info?.hzone || activeZone?.uuid, serviceName: node.serviceName || '' }); return }
    const hh = activeHousehold?.id
    setInfo(null); setProse(null); setPlayerOpen(false)
    setLibraryRequest({ n: Date.now(), kind: 'node', node: { ...node, hzone: info?.hzone || activeZone?.uuid, hh, icon: node.icon || '' } })
    setSection('browse')
  }

  // Party mode: every room of the household in view joins the room in view.
  const partyMode = async () => {
    if (!activeZone || !activeHousehold) return
    for (const uuid of activeHousehold.zone_uuids) {
      if (!zones[uuid] || uuid === activeZone.uuid) continue
      const g = groups.find((gr) => gr.members.includes(uuid))
      if (g && g.coordinator === activeZone.uuid) continue
      await actions.join(uuid, activeZone.uuid)
    }
  }
  const anyPlaying = groups.some((g) => zones[g.coordinator]?.transport?.state === 'PLAYING')

  // --- keyboard ---------------------------------------------------------------------
  const anyLayer = playerOpen || groupDialog || roomSettings || info || prose || search || sleepOpen || addRadio || linking || addTo || about || shortcuts || confirm
  useEffect(() => {
    const onKey = (event) => {
      const typing = isTyping(event)
      const cmd = isCommand(event)
      const key = keyOf(event)
      if (cmd && key === 'k') { event.preventDefault(); setSearch((v) => !v); return }
      if (cmd && key === 'f') { event.preventDefault(); setSection('browse'); setLibraryRequest({ n: Date.now(), kind: 'focus' }); return }
      if (cmd && key === 'g') { event.preventDefault(); setQueueOpen((v) => !v); return }
      if (cmd && key === 'j') { event.preventDefault(); if (activeZone) setPlayerOpen((v) => !v); return }
      if (cmd && (key === '*' || (event.shiftKey && key === '8'))) { event.preventDefault(); browseSource('FV:2'); return }
      if (cmd && /^[1-5]$/.test(key)) { event.preventDefault(); setPlayerOpen(false); setSection(SECTIONS[Number(key) - 1]); return }
      if (cmd && event.shiftKey && key === 'x') { event.preventDefault(); if (activeZone) actions.setCrossfade(activeZone.uuid, !activeZone.transport?.crossfade); return }
      if (typing || (anyLayer && !playerOpen)) return
      if (event.key === '?') { event.preventDefault(); setShortcuts(true); return }
      if (!activeZone) return
      const mode = activeZone.transport?.play_mode || 'NORMAL'
      if (event.key === ' ' || (cmd && key === 'p')) { event.preventDefault(); togglePlay(actions, activeZone) }
      else if (cmd && key === 'e') { event.preventDefault(); actions.setPlayMode(activeZone.uuid, shuffleToggled(mode)) }
      else if (cmd && key === 'r') { event.preventDefault(); actions.setPlayMode(activeZone.uuid, repeatCycled(mode)) }
      else if (cmd && event.shiftKey && key === 'm') { event.preventDefault(); groups.forEach((g) => actions.setMute(g.coordinator, true, true)) }
      else if (cmd && key === 'm') { event.preventDefault(); actions.setMute(activeZone.uuid, !activeZone.group_muted, true) }
      else if (cmd && (event.key === 'ArrowUp' || event.key === '+' || event.key === '=')) { event.preventDefault(); actions.setGroupVolume(activeZone.uuid, Math.min(100, (activeZone.group_volume ?? 0) + 2)) }
      else if (cmd && (event.key === 'ArrowDown' || event.key === '-')) { event.preventDefault(); actions.setGroupVolume(activeZone.uuid, Math.max(0, (activeZone.group_volume ?? 0) - 2)) }
      else if (cmd && event.key === 'ArrowRight') { event.preventDefault(); actions.next(activeZone.uuid) }
      else if (cmd && event.key === 'ArrowLeft') { event.preventDefault(); actions.previous(activeZone.uuid) }
      else if (cmd && (event.key === '.' || event.key === ',' || event.key === ']' || event.key === '[')) {
        event.preventDefault()
        const forward = event.key === '.' || event.key === ']'
        const index = visibleGroups.findIndex((g) => g.coordinator === activeGroup?.coordinator)
        const next = visibleGroups[(index + (forward ? 1 : visibleGroups.length - 1)) % visibleGroups.length]
        if (next) select(next.coordinator)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [activeZone, activeGroup, visibleGroups, groups, actions, select, anyLayer, playerOpen, browseSource, setSection])

  // --- the search view's actions ------------------------------------------------------
  const runAction = (id) => {
    if (!activeZone && !['settings', 'clock', 'shortcuts'].includes(id)) return
    if (id === 'playpause') togglePlay(actions, activeZone)
    else if (id === 'next') actions.next(activeZone.uuid)
    else if (id === 'previous') actions.previous(activeZone.uuid)
    else if (id === 'mute') actions.setMute(activeZone.uuid, !activeZone.group_muted, true)
    else if (id === 'pauseall') pauseEverything(actions, groups, zones)
    else if (id === 'shuffle') actions.setPlayMode(activeZone.uuid, shuffleToggled(activeZone.transport?.play_mode || 'NORMAL'))
    else if (id === 'repeat') actions.setPlayMode(activeZone.uuid, repeatCycled(activeZone.transport?.play_mode || 'NORMAL'))
    else if (id === 'crossfade') actions.setCrossfade(activeZone.uuid, !activeZone.transport?.crossfade)
    else if (id === 'queue') setQueueOpen((v) => !v)
    else if (id === 'player') setPlayerOpen(true)
    else if (id === 'group') setGroupDialog(activeGroup)
    else if (id === 'party') partyMode()
    else if (id === 'sleepoff') sleep.set(null)
    else if (id.startsWith('sleep:')) sleep.set(Number(id.slice(6)))
    else if (id === 'clock') setSection('clock')
    else if (id === 'settings') setSection('settings')
    else if (id === 'shortcuts') setShortcuts(true)
  }

  const ordered = orderedHouseholds(households)
  const groupLabel = activeGroup ? groupTitle(activeGroup, zones, t) : ''
  // The whole-house actions stand in the Rooms page's header, where rooms are
  // managed; Add Radio Station is on Browse's My Radio Stations page. The
  // rail's FAB that held them is gone: Material keeps a FAB for a screen's
  // main action, and these are occasional ones.
  const houseActions = {
    onPauseAll: () => pauseEverything(actions, groups, zones), pauseDisabled: !anyPlaying,
    onParty: partyMode, partyDisabled: !activeZone || activeZone.local || (activeHousehold?.zone_uuids?.length || 0) < 2,
  }

  const common = { households, zones, activeZone, activeGroup, systemFilter, onSystem: chooseSystem, onMessage: toast, compact }
  const page = section === 'listen' ? (
    <Listen {...common} groups={visibleGroups} activeId={activeGroup?.coordinator} onSelect={select}
            onGroup={setGroupDialog} onRoomSettings={setRoomSettings} onSleep={() => setSleepOpen(true)} onPlayer={() => setPlayerOpen(true)}
            favorites={favorites} playlists={playlists} recent={recent} onPlayItem={playItem} onOpenFavorite={openFavorite} onBrowse={browseSource}
            onRooms={() => setSection('rooms')} onSearch={() => setSearch(true)}
            onItemMenu={(item, sourceId, event) => setQuickMenu({ item, sourceId, x: event.clientX, y: event.clientY })} />
  ) : section === 'browse' ? (
    <Browse {...common} groups={groups} roomGroups={visibleGroups} onSelectRoom={select} roomChosen={Boolean(activeId)}
            servicesByHh={services.byHousehold} servicesRaw={services.raw} libraryByHh={libraryByHh} accountChoice={accountChoice} pickAccount={pickAccount}
            request={libraryRequest} onInfo={openInfoForItem} onLinkService={setLinking} onAddRadio={() => setAddRadio(true)}
            favoritesEpoch={favoritesEpoch} onFavoritesChanged={() => setFavoritesEpoch((v) => v + 1)} servicesVersion={servicesVersion + servicesEpoch}
            queueEdited={queueEdited} onQueueReplaced={() => setQueueEdited(false)} onScopeChange={(scope, scopes) => setScopeState({ scope, scopes })} />
  ) : section === 'rooms' ? (
    <RoomsPage {...common} groups={visibleGroups} activeId={activeGroup?.coordinator} onSelect={select}
               onGroup={setGroupDialog} onRoomSettings={setRoomSettings} onPlayer={() => setPlayerOpen(true)} {...houseActions} />
  ) : section === 'clock' ? (
    <ClockPage {...common} />
  ) : (
    <SettingsPage {...common} page={settingsPage} setPage={openSettingsPage} onLinkService={setLinking}
                  servicesVersion={servicesVersion + servicesEpoch} onServicesChanged={() => setServicesVersion((v) => v + 1)}
                  onAbout={() => setAbout(true)} onShortcuts={() => setShortcuts(true)} />
  )

  const destinations = SECTIONS.map((id) => {
    const [Filled, Outline] = NAV[id]
    const on = section === id && !playerOpen
    return (
      <button key={id} type="button" className="mg-dest" aria-current={on ? 'page' : undefined}
              title={`${t(`mg.nav.${id}`)} (Ctrl ${SECTIONS.indexOf(id) + 1})`}
              onClick={() => { setPlayerOpen(false); setSection(id) }}>
        <span className="mg-dest-indicator"><span className="mg-state" aria-hidden="true" />{on ? <Filled /> : <Outline />}</span>
        <span className="mg-dest-label">{t(`mg.nav.${id}`)}</span>
      </button>
    )
  })
  const dockQueue = queueOpen && isLarge(size) && !playerOpen

  // The expanded rail is as wide as what it holds, within Material's 220-360dp for an expanded
  // navigation rail: a fixed 280 left English with a broad empty column and German's "Whole-house
  // actions" sticking out past it. Measured from the widest of its own pieces, which
  // keep their natural width in the open rail, again whenever the language or the fonts change.
  const rootRef = useRef(null)
  const railOpenNow = (!compact && railOpen && wide) || modal
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || !railOpenNow) return undefined
    let live = true
    const fit = () => {
      if (!live) return
      const parts = [...root.querySelectorAll('.mg-rail .mg-dest, .mg-rail .mg-brand')]
      // The system selector's segments stretch to fill the rail, so its own width says
      // nothing; what it needs is its segments at their 44px least, plus gaps and padding.
      const segments = root.querySelectorAll('.mg-rail-systems button').length
      const selector = segments ? segments * 44 + (segments - 1) * 2 + 8 : 0
      const widest = Math.max(0, selector, ...parts.map((e) => e.scrollWidth))
      if (!widest) return
      // No floor beyond what the rail holds: 220px was the FAB's, and with the FAB gone it left
      // a wide blank band beside the labels. Never narrower than the collapsed rail.
      root.style.setProperty('--mg-rail-open', `${Math.min(360, Math.max(140, Math.ceil(widest + 24)))}px`)
    }
    fit()
    document.fonts?.ready?.then(fit)
    return () => { live = false }
  }, [railOpenNow, language, size])

  return (
    <div ref={rootRef} className={cx('mg-root', `mg-size-${size}`)} data-rail={!compact && railOpen && wide ? 'open' : modal ? 'modal' : undefined}
         data-queue={dockQueue || undefined} data-section={section}>
      {modal && <div className="mg-rail-scrim" aria-hidden="true" onClick={() => setModalRail(false)} />}
      {!compact && (
        <nav className="mg-rail" aria-label={t('mg.navigation')}>
          <div className="mg-rail-top">
            {wide ? (
              <IconButton label={railOpen ? t('mg.collapseRail') : t('mg.expandRail')} onClick={() => setRailOpen((v) => !v)}>
                {railOpen ? <I.MenuOpen /> : <I.Menu />}
              </IconButton>
            ) : (
              <IconButton label={modal ? t('mg.collapseRail') : t('mg.expandRail')} onClick={() => setModalRail((v) => !v)}>
                {modal ? <I.MenuOpen /> : <I.Menu />}
              </IconButton>
            )}
            <button type="button" className="mg-brand" onClick={() => setAbout(true)} title={t('about.menu')}>
              <img src={logo} alt="" width="32" height="32" /><span>Sonora</span>
            </button>
          </div>
          <div className="mg-rail-dests">{destinations}</div>
          <div className="mg-rail-foot">
            <IconButton label={`${t('common.search')} (Ctrl K)`} onClick={() => setSearch(true)}><I.Search /></IconButton>
            {systemChoiceMatters(households) && (
              <div className="mg-rail-systems" role="radiogroup" aria-label={t('desk.showSystem')}>
                {[...ordered.map((h) => ({ id: h.id, label: h.generation })), { id: 'all', label: t('mg.all') }].map((opt) => (
                  <button key={opt.id} type="button" role="radio" aria-checked={(systemFilter || 'all') === opt.id} onClick={() => chooseSystem(opt.id)}>
                    <span className="mg-state" aria-hidden="true" />{opt.label}
                  </button>
                ))}
              </div>
            )}
            <span className="mg-rail-live" title={connected ? t('net.live') : t('common.reconnecting')}>
              <span className="mg-dot" data-on={connected || undefined} />
              <span>{connected ? t.plural('common.rooms', visibleZones.length) : t('common.reconnecting')}</span>
            </span>
          </div>
        </nav>
      )}

      <main className="mg-main" key={section} ref={mainRef}>
        {/* On a phone the system selector sits at the far right of the page's header row, beside
            the title rather than above it; the stylesheet places it there. */}
        {compact && systemChoiceMatters(households) && section !== 'settings' && (
          <div className="mg-compact-systems">
            <SystemPicker households={households} value={systemFilter} onChange={chooseSystem} />
          </div>
        )}
        {page}
      </main>

      {dockQueue && (
        <QueuePane zone={activeZone} queue={queue} onClose={() => setQueueOpen(false)} onMessage={toast} onEdited={() => setQueueEdited(true)}
                   onInfo={(item) => openInfoForItem(item, { hzone: activeZone?.uuid })} />
      )}

      {!playerOpen && (
        <NowToolbar zone={activeZone} group={activeGroup} zones={zones} compact={compact} onOpen={() => setPlayerOpen(true)}
                    onQueue={() => setQueueOpen((v) => !v)} queueOpen={queueOpen} queueCount={queue.total || queue.items.length}
                    onGroup={() => activeGroup && setGroupDialog(activeGroup)} onInfo={openInfoForNow} />
      )}

      {compact && (
        <>
          <nav className="mg-navbar" aria-label={t('mg.navigation')}>{destinations}</nav>
        </>
      )}

      {playerOpen && activeZone && (
        <PlayerView zone={activeZone} group={activeGroup} zones={zones} groups={visibleGroups} onSelect={select} queue={queue} compact={compact} size={size}
                    onClose={() => setPlayerOpen(false)} onInfo={openInfoForNow} onMessage={toast}
                    onGroup={() => setGroupDialog(activeGroup)} onSleep={() => setSleepOpen(true)} sleepOn={Boolean(sleep.remaining)}
                    onQueueEdited={() => setQueueEdited(true)} onQueueItemInfo={(item) => openInfoForItem(item, { hzone: activeZone?.uuid })} />
      )}
      {queueOpen && !dockQueue && !playerOpen && (
        <QueueSheet zone={activeZone} queue={queue} onClose={() => setQueueOpen(false)} onMessage={toast} onEdited={() => setQueueEdited(true)}
                    onInfo={(item) => openInfoForItem(item, { hzone: activeZone?.uuid })} />
      )}
      {groupDialog && <GroupDialog group={groups.find((g) => g.id === groupDialog.id) || groupDialog} zones={zones} households={households} onClose={() => setGroupDialog(null)} />}
      {roomSettings && <RoomSettings uuid={roomSettings} households={households} onClose={() => setRoomSettings(null)} />}
      {info && !prose && (
        <InfoSheet zone={info.now ? activeZone : null} item={info.now ? null : info.item} hzone={info.now ? activeZone?.uuid : info.hzone}
                   serviceName={info.now ? (activeZone?.transport?.service_name || serviceNameOf(activeZone?.transport?.media_uri, activeZone?.transport?.service_id)) : info.serviceName}
                   onClose={() => setInfo(null)} onMessage={toast} onOpen={infoOpen} onFavoritesChanged={() => setFavoritesEpoch((v) => v + 1)}
                   onAddToPlaylist={(pick, source) => setAddTo({ picks: [pick], source: source || info.source || '', hzone: info.now ? activeZone?.uuid : info.hzone })}
                   services={Object.values(services.byHousehold || {}).flat()} />
      )}
      {prose && <ProseSheet node={prose} onClose={() => { setProse(null); setInfo(null) }} onBack={() => setProse(null)} />}
      {addTo && <AddToPlaylistSheet picks={addTo.picks} source={addTo.source} hzone={addTo.hzone} onClose={() => setAddTo(null)} onMessage={toast} />}
      {sleepOpen && <SleepSheet zone={activeZone} groupLabel={groupLabel} onClose={() => setSleepOpen(false)} />}
      {addRadio && <AddRadioSheet zone={activeZone} onClose={() => setAddRadio(false)} onAdded={(r) => toast(t(r.exists ? 'desk.radio.exists' : 'desk.radio.added', { title: r.title }))} />}
      {linking && <LinkServiceSheet households={households} preset={linking} onClose={() => setLinking(null)} onLinked={() => setServicesVersion((v) => v + 1)} />}
      {search && (
        <SearchView onClose={() => setSearch(false)} groups={visibleGroups} zones={zones} activeZone={activeZone} favorites={favorites} playlists={playlists}
                    scopes={scopeState.scopes} onSelectRoom={select} onAction={runAction} onPlayItem={playItem} compact={compact}
                    onSearch={(term, scope) => { setLibraryRequest({ n: Date.now(), kind: 'search', term, scope }); setPlayerOpen(false); setSection('browse') }}
                    onOpenSource={(scope) => { setPlayerOpen(false); browseSource(`svc:${scope.id}`) }} />
      )}
      {about && <AboutSonora onClose={() => setAbout(false)} />}
      {shortcuts && <ShortcutsSheet onClose={() => setShortcuts(false)} />}
      {confirm && <Confirm title={confirm.title} body={confirm.body} action={confirm.action} onConfirm={() => { setConfirm(null); confirm.onConfirm() }} onClose={() => setConfirm(null)} />}
      {quickMenu && (
        <Menu x={quickMenu.x} y={quickMenu.y} onClose={() => setQuickMenu(null)} title={quickMenu.item.title}>
          <MenuItem icon={<I.Play />} onSelect={() => { setQuickMenu(null); playItem(quickMenu.item, quickMenu.sourceId, 'now') }}>{t('desk.actions.playNow')}</MenuItem>
          {isQueueable(quickMenu.item) && (
            <>
              <MenuItem icon={<I.Next />} onSelect={() => { setQuickMenu(null); playItem(quickMenu.item, quickMenu.sourceId, 'next') }}>{t('desk.actions.playNext')}</MenuItem>
              <MenuItem icon={<I.Queue />} onSelect={() => { setQuickMenu(null); playItem(quickMenu.item, quickMenu.sourceId, 'add') }}>{t('desk.actions.addToQueue')}</MenuItem>
              <MenuItem icon={<I.Refresh />} onSelect={() => { setQuickMenu(null); playItem(quickMenu.item, quickMenu.sourceId, 'replace') }}>{t('desk.actions.replaceQueue')}</MenuItem>
            </>
          )}
          <MenuSep />
          {quickMenu.item.browse_id && quickMenu.item.service_id && (
            <MenuItem icon={<I.Chevron />} onSelect={() => { setQuickMenu(null); openFavorite(quickMenu.item) }}>{t('mg.open')}</MenuItem>
          )}
          {quickMenu.sourceId && quickMenu.sourceId !== 'recent' && (
            <MenuItem icon={<I.Browse />} onSelect={() => { setQuickMenu(null); browseSource(quickMenu.sourceId) }}>{t('mg.showInBrowse')}</MenuItem>
          )}
          {quickMenu.item.uri && (
            <MenuItem icon={<I.Info />} onSelect={() => { setQuickMenu(null); openInfoForItem({ ...quickMenu.item, favoriteDescription: describeFavorite(quickMenu.item, serviceNameOf(quickMenu.item.uri, quickMenu.item.service_id)) }, { hzone: activeZone?.uuid, source: quickMenu.sourceId }) }}>{t('desk.now.infoOptions')}</MenuItem>
          )}
        </Menu>
      )}

      <TooltipLayer />
      <Snackbars onDismiss={(item) => dismiss(item.noticeId)} items={[
        ...(!connected ? [{ id: 'offline', kind: 'warn', text: t('common.reconnecting') }] : []),
        ...notices.map((notice) => ({ id: `n-${notice.id}`, noticeId: notice.id, dismissible: true, title: t(notice.titleKey),
                                      text: notice.detail || (notice.detailKey ? t(notice.detailKey, notice.detailParams) : '') })),
        ...snacks,
      ]} />
    </div>
  )
}

export default {
  id: 'materialgirl',
  name: 'Material Girl',
  version: '1.0.0',
  thumbnail,
  description: 'The controller rebuilt on Material 3 Expressive: adaptive navigation from phone to desktop, a floating player whose colors come '
    + 'from the cover, shape-shifting artwork, button groups and split buttons. Light or dark.',
  colorScheme: 'light',
  strings,
  tokens,
  // The same roles at two sets of tones; mg.css keys them on the variant.
  variants: {
    light: { tokens: {}, colorScheme: 'light', thumbnail },
    dark: { tokens: {}, colorScheme: 'dark', thumbnail: darkThumbnail },
  },
  Shell,
}
