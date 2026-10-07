// This theme's own copy of the rail shell.
//
// It began as Sonofuture's and is free to diverge from it. Nothing here is
// imported from another theme: a theme is a self-contained thing, and one
// that reaches into another stops working the moment that other theme is not
// installed. The shared layer underneath -- parts/, lib/, components/ -- is
// Sonora's and is fair game.

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { orderedHouseholds, systemChoiceMatters } from '../../frontend/src/lib/format.js'
import { useSleepTimer } from '../../frontend/src/lib/useSleepTimer.js'
import AboutSonora from '../../frontend/src/components/AboutSonora.jsx'
import logo from '../../frontend/src/assets/sonora.png'
import * as I from './icons.jsx'
import { IconButton, Menu, MenuItem, MenuSep, Confirm, Segmented } from './ui.jsx'
import { GROUP_KEY, SYSTEM_KEY, SECTION_KEY, readStored, writeStored, useServices, useLibraryPresence, useAccountChoice, useFavorites, usePlaylists, useRecent,
         useQueue, zoneForHousehold, householdOf, playItems, pauseEverything, togglePlay, groupTitle, describeFavorite, isQueueable, favoriteTarget } from './house.js'
import NowBar from './NowBar.jsx'
import Stage from './Stage.jsx'
import QueueDrawer from './QueueDrawer.jsx'
import Home from './Home.jsx'
import Library, { AddToPlaylistSheet, AddRadioSheet } from './Library.jsx'
import { useNarrow, SF_NARROW } from '../../frontend/src/lib/useNarrow.js'
import { useShellSelection } from '../../frontend/src/lib/shellSelection.js'
import { isTyping, isCommand, keyOf, shuffleToggled, repeatCycled } from '../../frontend/src/lib/keys.js'
import InfoPanel, { ProsePanel } from './Info.jsx'
import RoomsSection, { RoomSettings, GroupSheet } from './Rooms.jsx'
import AlarmsSection, { SleepSheet } from './Alarms.jsx'
import SettingsSection, { LinkServiceSheet, ShortcutsSheet } from './Settings.jsx'
import Palette from './Palette.jsx'
import Mini, { isMiniWindow, openMiniPip, openMiniWindow } from './Mini.jsx'
import { useThemeLanding } from '../../frontend/src/lib/theme.jsx'
import './rail-shell.css'

// Sonofuture: the controller thought out again around what people do with a
// house full of speakers, rather than around the desktop application's three
// panes. A rail of five places (Home, Library, Rooms, Alarms, Settings), one
// bar along the bottom for the room in view, the queue beside the content
// when wanted, a stage that fills the window, and a command palette that
// reaches everything by keyboard. Every capability of the Windows theme is
// here; the paths to them are shorter.

const SECTIONS = ['home', 'library', 'rooms', 'alarms', 'settings']
const SECTION_ICONS = { home: I.Home, library: I.Grid, rooms: I.Rooms, alarms: I.Bell, settings: I.Sliders }

export function Shell() {
  const { zones, groups, households, connected, actions, notices, dismiss, servicesEpoch, recentEpoch, favoritesEpoch: savedEpoch, playlistsEpoch } = useSystem()
  const { t } = useI18n()
  const [section, setSectionState] = useState(() => (SECTIONS.includes(readStored(SECTION_KEY)) ? readStored(SECTION_KEY) : 'home'))
  const setSection = useCallback((id) => { setSectionState(id); writeStored(SECTION_KEY, id) }, [])
  const { activeId, setActiveId, activeGroup, activeZone, visibleGroups, visibleZones,
          systemFilter, setSystemFilter, chooseSystem, select } = useShellSelection({ byMember: true, preferAllWhenMany: true })
  const [settingsPage, setSettingsPage] = useState('services')
  // Chosen just now from the theme chooser: open on this theme's own theme page.
  useThemeLanding(() => { setSettingsPage('appearance'); setSection('settings') })
  // Every settings page opens at its top. They share the one scrolling main,
  // which is keyed by section alone, so a page that drew tall at once kept
  // the last page's scroll.
  const mainRef = useRef(null)
  useLayoutEffect(() => { if (mainRef.current) mainRef.current.scrollTop = 0 }, [settingsPage])
  const [stageOpen, setStageOpen] = useState(false)
  const [queueOpen, setQueueOpen] = useState(() => readStored('sonora.sf.queue') === '1')
  const [groupSheet, setGroupSheet] = useState(null)
  const [roomSettings, setRoomSettings] = useState(null)
  const [info, setInfo] = useState(null)
  const [prose, setProse] = useState(null)
  const [palette, setPalette] = useState(false)
  const [sleepOpen, setSleepOpen] = useState(false)
  const [addRadio, setAddRadio] = useState(false)
  const [linking, setLinking] = useState(null)
  const [addTo, setAddTo] = useState(null)
  const [about, setAbout] = useState(false)
  const [shortcuts, setShortcuts] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [quickMenu, setQuickMenu] = useState(null)
  const [libraryRequest, setLibraryRequest] = useState(null)
  const [toasts, setToasts] = useState([])
  // Bumped when this theme saves or removes a favorite; savedEpoch and playlistsEpoch are the
  // store's, bumped when the speakers announce a change made anywhere (another app included).
  const [favoritesEpoch, setFavoritesEpoch] = useState(0)
  const [servicesVersion, setServicesVersion] = useState(0)
  const [queueEdited, setQueueEdited] = useState(false)
  const [scopeState, setScopeState] = useState({ scope: null, scopes: [] })
  const isMini = isMiniWindow()
  // A phone's navigation bar carries four places, not five: alarms move into
  // Settings there, and the system filter takes the freed room.
  const narrow = useNarrow(SF_NARROW)
  const railSections = narrow ? SECTIONS.filter((id) => id !== 'alarms') : SECTIONS
  useEffect(() => { writeStored('sonora.sf.queue', queueOpen ? '1' : '0') }, [queueOpen])
  // Alarms live in one place or the other, never nowhere: narrowing the
  // window carries the open section into Settings and widening it carries
  // the page back out.
  useEffect(() => {
    if (narrow && section === 'alarms') { setSettingsPage('alarms'); setSection('settings') }
    else if (!narrow && section === 'settings' && settingsPage === 'alarms') { setSettingsPage('services'); setSection('alarms') }
  }, [narrow, section, settingsPage, setSection])

  // --- the room in view ---------------------------------------------------------
  useEffect(() => {
    if (!isMini) return undefined
    const onStorage = (event) => { if (event.key === GROUP_KEY) setActiveId(event.newValue); if (event.key === SYSTEM_KEY) setSystemFilter(event.newValue) }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [isMini])

  // --- the data every section shares ---------------------------------------------
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
  useEffect(() => { setQueueEdited(false) }, [activeZone?.uuid, activeZone?.transport?.queue_length && 0])

  const toast = useCallback((text) => {
    if (!text) return
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev.slice(-3), { id, text }])
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 3600)
  }, [])

  // --- playing from Home and the palette -----------------------------------------
  const playItem = useCallback(async (item, sourceId, how = 'now') => {
    if (!activeZone) return
    if (how === 'now' || how === 'replace') setQueueEdited(false)
    const done = await playItems(actions, [item], how,
                                 // The browser room needs to say which household's
                                 // service should resolve the item.
                                 { hzone: activeZone.uuid, from: activeZone.local ? (item.hzone || '') : '' })
    if (done) toast(t(how === 'now' ? 'sf.playingNow' : how === 'next' ? 'sf.queuedNext' : how === 'replace' ? 'sf.replacedQueue' : 'sf.addedToQueue', { title: item.title }))
  }, [activeZone, actions, toast, t])
  const openFavorite = useCallback((item) => {
    if (!activeZone || !activeHousehold) return
    const { svc, account, kind } = favoriteTarget((services.byHousehold[activeHousehold.id] || []).filter((s) => s.id === item.service_id), item,
                                                  accountChoice[`${activeHousehold.id}:${item.service_id}`])
    setLibraryRequest({ n: Date.now(), kind: 'node',
      path: [{ id: 'FV:2', title: t('desk.browse.favorites'), item: 'root', hzone: activeZone.uuid, hh: activeHousehold.id, glyph: 'star' }],
      node: { id: `${item.service_id}:${item.browse_id}`, title: item.title, service: item.service_id, item: item.browse_id, hzone: activeZone.uuid, hh: activeHousehold.id,
              account, icon: svc?.icon || '', kind, uri: item.uri, metadata: item.metadata, art: item.art, serviceName: svc?.name || '' } })
    setSection('library')
  }, [activeZone, activeHousehold, services.byHousehold, accountChoice, setSection, t])
  const browseSource = useCallback((id) => { setLibraryRequest({ n: Date.now(), kind: 'source', id }); setSection('library') }, [setSection])
  const serviceNameOf = useCallback((uri, sidFallback = null) => {
    const sid = Number((/[?&]sid=(\d+)/.exec(uri || '') || [])[1]) || sidFallback
    if (!sid || !activeHousehold) return ''
    return (services.byHousehold[activeHousehold.id] || []).find((s) => s.id === sid)?.name || ''
  }, [services.byHousehold, activeHousehold])

  // --- info and the paths out of it ------------------------------------------------
  const openInfoForNow = () => { if (activeZone) setInfo({ now: true }) }
  const openInfoForItem = (item, ctx = {}) => setInfo({ item, hzone: ctx.hzone || activeZone?.uuid, serviceName: ctx.serviceName || serviceNameOf(item.uri, item.service_id), source: ctx.source || '' })
  const infoOpen = (node) => {
    if (node.prose) { setProse({ ...node, hzone: info?.hzone || activeZone?.uuid }); return }
    // Album Info and its kind open the item's own Info & Options, as the desktop apps' do.
    if (node.info) { setProse(null); setInfo({ item: node.item, hzone: info?.hzone || activeZone?.uuid, serviceName: node.serviceName || '' }); return }
    const hh = activeHousehold?.id
    setInfo(null); setProse(null)
    setLibraryRequest({ n: Date.now(), kind: 'node', node: { ...node, hzone: info?.hzone || activeZone?.uuid, hh, icon: node.icon || '' } })
    setSection('library')
  }

  // --- the compact controller -------------------------------------------------------
  const miniWindow = useRef(null)
  const [pipWindow, setPipWindow] = useState(null)
  const [miniPanel, setMiniPanel] = useState(false)
  const toggleMini = useCallback(async () => {
    if (pipWindow && !pipWindow.closed) { pipWindow.close(); setPipWindow(null); return }
    if (miniWindow.current && !miniWindow.current.closed) { miniWindow.current.close(); miniWindow.current = null; return }
    if (miniPanel) { setMiniPanel(false); return }
    // "This browser" lives only in this page: a popup is another page, which
    // has no such room and cannot reach its audio, so its keys sat dimmed
    // in the Windows VM. It gets the in-page panel, as the
    // desktop themes give it.
    if (activeZone?.local) { setMiniPanel(true); return }
    const pip = await openMiniPip()
    if (pip) { pip.addEventListener('pagehide', () => setPipWindow((w) => (w === pip ? null : w))); setPipWindow(pip); return }
    const w = openMiniWindow()
    if (w) { miniWindow.current = w; w.focus() } else setMiniPanel(true)
  }, [miniPanel, pipWindow, activeZone?.local])

  // --- keyboard ------------------------------------------------------------------------
  const anyLayer = stageOpen || groupSheet || roomSettings || info || prose || palette || sleepOpen || addRadio || linking || addTo || about || shortcuts || confirm
  useEffect(() => {
    const onKey = (event) => {
      const typing = isTyping(event)
      const cmd = isCommand(event)
      const key = keyOf(event)
      if (cmd && key === 'k') { event.preventDefault(); setPalette((v) => !v); return }
      if (cmd && key === 'f') { event.preventDefault(); setSection('library'); setLibraryRequest({ n: Date.now(), kind: 'focus' }); return }
      if (cmd && key === 'g') { event.preventDefault(); setQueueOpen((v) => !v); return }
      if (cmd && key === 'd') { event.preventDefault(); toggleMini(); return }
      if (cmd && (key === '*' || (event.shiftKey && key === '8'))) { event.preventDefault(); browseSource('FV:2'); return }
      if (cmd && /^[1-5]$/.test(key)) { event.preventDefault(); setSection(SECTIONS[Number(key) - 1]); return }
      if (cmd && event.shiftKey && key === 'x') { event.preventDefault(); if (activeZone) actions.setCrossfade(activeZone.uuid, !activeZone.transport?.crossfade); return }
      if (typing || anyLayer) return
      if (event.key === '?' ) { event.preventDefault(); setShortcuts(true); return }
      if (!activeZone) return
      const tr = activeZone.transport || {}
      const mode = tr.play_mode || 'NORMAL'
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
  }, [activeZone, activeGroup, visibleGroups, groups, actions, select, anyLayer, toggleMini, browseSource, setSection])

  // --- the palette's actions ---------------------------------------------------------------
  const paletteAction = (id) => {
    if (!activeZone && !['settings', 'alarms', 'shortcuts'].includes(id)) return
    if (id === 'playpause') togglePlay(actions, activeZone)
    else if (id === 'next') actions.next(activeZone.uuid)
    else if (id === 'previous') actions.previous(activeZone.uuid)
    else if (id === 'mute') actions.setMute(activeZone.uuid, !activeZone.group_muted, true)
    else if (id === 'pauseall') pauseEverything(actions, groups, zones)
    else if (id === 'shuffle') { const mode = activeZone.transport?.play_mode || 'NORMAL'; actions.setPlayMode(activeZone.uuid, mode.startsWith('SHUFFLE') ? (mode === 'SHUFFLE' ? 'REPEAT_ALL' : mode === 'SHUFFLE_REPEAT_ONE' ? 'REPEAT_ONE' : 'NORMAL') : (mode === 'REPEAT_ALL' ? 'SHUFFLE' : mode === 'REPEAT_ONE' ? 'SHUFFLE_REPEAT_ONE' : 'SHUFFLE_NOREPEAT')) }
    else if (id === 'repeat') { const mode = activeZone.transport?.play_mode || 'NORMAL'; actions.setPlayMode(activeZone.uuid, repeatCycled(mode)) }
    else if (id === 'crossfade') actions.setCrossfade(activeZone.uuid, !activeZone.transport?.crossfade)
    else if (id === 'queue') setQueueOpen((v) => !v)
    else if (id === 'stage') setStageOpen(true)
    else if (id === 'group') setGroupSheet(activeGroup)
    else if (id === 'mini') toggleMini()
    else if (id === 'sleepoff') sleep.set(null)
    else if (id.startsWith('sleep:')) sleep.set(Number(id.slice(6)))
    else if (id === 'alarms') setSection('alarms')
    else if (id === 'settings') setSection('settings')
    else if (id === 'shortcuts') setShortcuts(true)
  }

  if (isMini) {
    return (
      <div className="sf-root sf-mini-root">
        <Mini zone={activeZone} mode="popup" onOpenMain={() => { try { window.opener?.focus() } catch { /* fine */ } }} />
      </div>
    )
  }

  const ordered = orderedHouseholds(households)
  const groupLabel = activeGroup ? groupTitle(activeGroup, zones, t) : ''
  const Section = section === 'home' ? (
    <Home groups={visibleGroups} zones={zones} households={households} systemFilter={systemFilter} onSystem={chooseSystem} activeId={activeGroup?.coordinator} activeZone={activeZone}
          onSelect={select} onGroupSheet={setGroupSheet} onRoomSettings={setRoomSettings} onSleep={() => setSleepOpen(true)} onStage={() => setStageOpen(true)}
          favorites={favorites} playlists={playlists} recent={recent} onPlayItem={playItem} onOpenFavorite={openFavorite} onBrowse={browseSource} onMessage={toast}
          onRooms={() => setSection('rooms')}
          onItemMenu={(item, sourceId, event) => setQuickMenu({ item, sourceId, x: event.clientX, y: event.clientY })} />
  ) : section === 'library' ? (
    <Library households={households} zones={zones} groups={groups} roomGroups={visibleGroups} onSelectRoom={select}
             systemFilter={systemFilter} onSystem={chooseSystem} activeZone={activeZone} roomChosen={Boolean(activeId)}
             servicesByHh={services.byHousehold} servicesRaw={services.raw} libraryByHh={libraryByHh} accountChoice={accountChoice} pickAccount={pickAccount}
             request={libraryRequest} onMessage={toast} onInfo={openInfoForItem} onLinkService={setLinking} onAddRadio={() => setAddRadio(true)}
             favoritesEpoch={favoritesEpoch} onFavoritesChanged={() => setFavoritesEpoch((v) => v + 1)} servicesVersion={servicesVersion + servicesEpoch}
             queueEdited={queueEdited} onQueueReplaced={() => setQueueEdited(false)} onScopeChange={(scope, scopes) => setScopeState({ scope, scopes })} />
  ) : section === 'rooms' ? (
    <RoomsSection groups={visibleGroups} zones={zones} households={households} systemFilter={systemFilter} onSystem={chooseSystem} activeId={activeGroup?.coordinator} onMessage={toast}
                  onSelect={select} onGroupSheet={setGroupSheet} onRoomSettings={setRoomSettings} onStage={() => setStageOpen(true)} />
  ) : section === 'alarms' ? (
    <AlarmsSection households={households} zones={zones} activeZone={activeZone} activeGroup={activeGroup} systemFilter={systemFilter} />
  ) : (
    <SettingsSection households={households} zones={zones} activeZone={activeZone} activeGroup={activeGroup} systemFilter={systemFilter} page={settingsPage} setPage={setSettingsPage}
                     onLinkService={setLinking} servicesVersion={servicesVersion + servicesEpoch} onServicesChanged={() => setServicesVersion((v) => v + 1)}
                     onMessage={toast} onAbout={() => setAbout(true)} onShortcuts={() => setShortcuts(true)} />
  )

  return (
    // Covered while the big player is open: it fills the window opaquely, so
    // the shell under it has nothing to show, and its glass rail and bar were
    // re-blurring behind it on every frame of a volume drag (~150ms
    // frames).
    <div className="sf-root" data-queue={queueOpen || undefined} data-section={section} data-covered={stageOpen || undefined}>
      <nav className="sf-rail" aria-label={t('sf.navigation')}>
        {/* The rail names the application, so its wordmark opens About Sonora,
            as an application's name does; the Home rail item below still goes
            home. */}
        <button type="button" className="sf-brand" onClick={() => setAbout(true)} title={t('about.menu')}>
          <img src={logo} alt="" width="34" height="34" />
          <span>Sonora</span>
        </button>
        <div className="sf-rail-items">
          {railSections.map((id) => {
            const Glyph = SECTION_ICONS[id]
            return (
              <button key={id} type="button" className="sf-rail-item" aria-current={section === id ? 'page' : undefined} onClick={() => setSection(id)} title={`${t(`sf.nav.${id}`)} (Ctrl ${SECTIONS.indexOf(id) + 1})`}>
                <Glyph /><span>{t(`sf.nav.${id}`)}</span>
              </button>
            )
          })}
        </div>
        <div className="sf-rail-foot">
          <button type="button" className="sf-rail-item sf-rail-palette" onClick={() => setPalette(true)} title={`${t('sf.commandPalette')} (Ctrl K)`}>
            <I.Search /><span>{t('sf.nav.search')}</span>
          </button>
          {systemChoiceMatters(households) && (
            <div className="sf-rail-systems" role="radiogroup" aria-label={t('desk.showSystem')}>
              {[...ordered.map((h) => ({ id: h.id, label: h.generation })), { id: 'all', label: t('sf.all') }].map((opt) => (
                <button key={opt.id} type="button" role="radio" aria-checked={(systemFilter || 'all') === opt.id} onClick={() => chooseSystem(opt.id)}>{opt.label}</button>
              ))}
            </div>
          )}
          <span className="sf-rail-link" title={connected ? t('net.live') : t('common.reconnecting')}>
            <span className="sf-dot" data-on={connected || undefined} />
            {/* The count follows the system chooser above it: picking S1
                counts S1's rooms, not every room Sonora can see. */}
            <span>{connected ? t.plural('common.rooms', visibleZones.length) : t('common.reconnecting')}</span>
          </span>
        </div>
      </nav>

      <main className="sf-main" key={section} ref={mainRef}>{Section}</main>

      {/* The drawer stays mounted so it can slide out as well as in; the
          column it sits in carries the width and CSS hides it when shut. */}
      <QueueDrawer zone={activeZone} queue={queue} open={queueOpen} onClose={() => setQueueOpen(false)} onMessage={toast} onEdited={() => setQueueEdited(true)}
                   onInfo={(item) => openInfoForItem(item, { hzone: activeZone?.uuid })} />

      <NowBar zone={activeZone} group={activeGroup} zones={zones} onStage={() => setStageOpen(true)} onQueue={() => setQueueOpen((v) => !v)} queueOpen={queueOpen}
              queueCount={queue.total || queue.items.length} onRooms={() => activeGroup && setGroupSheet(activeGroup)} onInfo={openInfoForNow}
              onSleep={() => setSleepOpen(true)} sleepOn={Boolean(sleep.remaining)} onMini={toggleMini} />

      {stageOpen && activeZone && (
        <Stage zone={activeZone} group={activeGroup} zones={zones} queue={queue} onClose={() => setStageOpen(false)} onInfo={openInfoForNow} onMessage={toast}
               onRooms={() => setGroupSheet(activeGroup)} onQueueEdited={() => setQueueEdited(true)} />
      )}
      {groupSheet && <GroupSheet group={groups.find((g) => g.id === groupSheet.id) || groupSheet} zones={zones} households={households} onClose={() => setGroupSheet(null)} />}
      {roomSettings && <RoomSettings uuid={roomSettings} households={households} onClose={() => setRoomSettings(null)} />}
      {info && !prose && (
        <InfoPanel zone={info.now ? activeZone : null} item={info.now ? null : info.item} hzone={info.now ? activeZone?.uuid : info.hzone}
                   serviceName={info.now ? (activeZone?.transport?.service_name || serviceNameOf(activeZone?.transport?.media_uri, activeZone?.transport?.service_id)) : info.serviceName}
                   onClose={() => setInfo(null)} onMessage={toast} onOpen={infoOpen} onFavoritesChanged={() => setFavoritesEpoch((v) => v + 1)}
                   onAddToPlaylist={(pick, source) => setAddTo({ picks: [pick], source: source || info.source || '', hzone: info.now ? activeZone?.uuid : info.hzone })}
                   services={Object.values(services.byHousehold || {}).flat()} />
      )}
      {prose && <ProsePanel node={prose} onClose={() => { setProse(null); setInfo(null) }} onBack={() => setProse(null)} />}
      {addTo && <AddToPlaylistSheet picks={addTo.picks} source={addTo.source} hzone={addTo.hzone} onClose={() => setAddTo(null)} onMessage={toast} />}
      {sleepOpen && <SleepSheet zone={activeZone} groupLabel={groupLabel} onClose={() => setSleepOpen(false)} />}
      {addRadio && <AddRadioSheet zone={activeZone} onClose={() => setAddRadio(false)} onAdded={(r) => toast(t(r.exists ? 'desk.radio.exists' : 'desk.radio.added', { title: r.title }))} />}
      {linking && <LinkServiceSheet households={households} preset={linking} onClose={() => setLinking(null)} onLinked={() => setServicesVersion((v) => v + 1)} />}
      {palette && (
        <Palette onClose={() => setPalette(false)} groups={visibleGroups} zones={zones} activeZone={activeZone} favorites={favorites} playlists={playlists}
                 scopes={scopeState.scopes} onSelectRoom={select} onAction={paletteAction} onPlayItem={playItem}
                 onSearch={(term, scope) => { setLibraryRequest({ n: Date.now(), kind: 'search', term, scope }); setSection('library') }}
                 onOpenSource={(scope) => { browseSource(`svc:${scope.id}`) }} />
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
            <MenuItem icon={<I.Chevron />} onSelect={() => { setQuickMenu(null); openFavorite(quickMenu.item) }}>{t('sf.open')}</MenuItem>
          )}
          {/* Recently played is Sonora's own list, not a source the library
              pane can open, so it has no row to show. */}
          {quickMenu.sourceId && quickMenu.sourceId !== 'recent' && (
            <MenuItem icon={<I.Grid />} onSelect={() => { setQuickMenu(null); browseSource(quickMenu.sourceId) }}>{t('sf.showInLibrary')}</MenuItem>
          )}
          {quickMenu.item.uri && (
            <MenuItem icon={<I.Info />} onSelect={() => { setQuickMenu(null); openInfoForItem({ ...quickMenu.item, favoriteDescription: describeFavorite(quickMenu.item, serviceNameOf(quickMenu.item.uri, quickMenu.item.service_id)) }, { hzone: activeZone?.uuid, source: quickMenu.sourceId }) }}>{t('desk.now.infoOptions')}</MenuItem>
          )}
        </Menu>
      )}

      {miniPanel && <Mini zone={activeZone} onClose={() => setMiniPanel(false)} onOpenMain={openInfoForNow} />}
      {pipWindow && !pipWindow.closed && createPortal(<Mini zone={activeZone} mode="pip" win={pipWindow} onClose={() => setPipWindow(null)} onOpenMain={openInfoForNow} />, pipWindow.document.body)}

      <div className="sf-toasts" aria-live="polite">
        {!connected && <div className="sf-toast sf-toast-warn"><I.Signal />{t('common.reconnecting')}</div>}
        {notices.map((notice) => (
          <div key={notice.id} className="sf-toast sf-toast-notice">
            <div><strong>{t(notice.titleKey)}</strong><span>{notice.detail || (notice.detailKey ? t(notice.detailKey, notice.detailParams) : '')}</span></div>
            <IconButton size="sm" label={t('common.dismiss')} onClick={() => dismiss(notice.id)}><I.Close /></IconButton>
          </div>
        ))}
        {toasts.map((x) => <div key={x.id} className="sf-toast" role="status">{x.text}</div>)}
      </div>
    </div>
  )
}
