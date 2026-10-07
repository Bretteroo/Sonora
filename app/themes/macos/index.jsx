import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { macTransportIcons } from './icons.jsx'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { orderedHouseholds, controllerTitle, isLiveStream, systemChoiceMatters } from '../../frontend/src/lib/format.js'
import MenuBar from './MenuBar.jsx'
import DevThemeSwitch from '../../frontend/src/components/DevThemeSwitch.jsx'
import Transport from './Transport.jsx'
import Rooms from './Rooms.jsx'
import { NowPlaying, Queue } from './Center.jsx'
import Browse from './Browse.jsx'
import PaneSwitch, { isNarrowShell, usePaneDirection } from './PaneSwitch.jsx'
import { Window, About, AddServices, Confirm, GroupRooms, Preferences, Shortcuts, SleepTimer, Alarms, AddRadioStation, ClearQueueConfirm } from './Dialogs.jsx'
import S2Upgrade from '../../frontend/src/components/S2Upgrade.jsx'
import AboutSonora from '../../frontend/src/components/AboutSonora.jsx'
import ErrorLog from '../../frontend/src/components/ErrorLog.jsx'
import TransientMessage from '../../frontend/src/components/TransientMessage.jsx'
import { tokens } from './tokens.js'
import Mini, { openMiniWindow, openMiniPip, isMiniWindow } from './Mini.jsx'
import { MINI_CHANNEL } from '../../frontend/src/lib/miniWindow.js'
import { isBrowserRoom } from '../../frontend/src/lib/browserRoom.js'
import { api } from '../../frontend/src/lib/api.js'
import { editState, editActions } from '../../frontend/src/lib/editMenu.js'
import './desktop.css'
import './mac.css'
import './responsive.css'
import thumbnail from './thumbnail.webp'
import { useNarrow } from '../../frontend/src/lib/useNarrow.js'
import ConnectionOverlay from './ConnectionOverlay.jsx'
import { useThemeLanding } from '../../frontend/src/lib/theme.jsx'

// A replication of the Sonos S1 desktop controller, built from the Mac build's
// own interface files.
//
// The layout is the application's own, taken from its interface definitions:
// the system menu bar and the window's title bar, an 80px transport strip
// with the group volume on the left, transport in the middle and search on
// the right, then three panes side by side: Rooms (264px), Now Playing over
// the Queue (322px), and Music (the remainder, never narrower than 418px).
// Selecting a room tile changes which group the strip and the center column
// describe, and the Music pane browses and plays into that group.
//
// Chrome the interface files do not describe (the menu bar's metrics, the
// window frames) follows the Mac's own conventions of the application's era.

const GROUP_KEY = 'sonora.desktop.group'
const SYSTEM_KEY = 'sonora.system'

function readStoredGroup() {
  try { return window.localStorage.getItem(GROUP_KEY) || null } catch { return null }
}

function readStoredSystem() {
  try { return window.localStorage.getItem(SYSTEM_KEY) || null } catch { return null }
}

function Shell() {
  const { zones, groups, households, connected, actions, notices, dismiss, servicesEpoch } = useSystem()
  const { t } = useI18n()
  const [activeId, setActiveId] = useState(readStoredGroup)
  const [pane, setPane] = useState('now')
  const [queueExpanded, setQueueExpanded] = useState(false)
  const paneDirection = usePaneDirection(pane)
  // Info & Options opens in the music pane. On a wide screen that pane is
  // already beside Now Playing; on a narrow one it is not on screen at all,
  // so pressing the glyph looked like it did nothing. It carries you there,
  // at the user's request.
  const showInfo = (item) => {
    setInfoItem(item)
    setInfoSignal((v) => v + 1)
    if (isNarrowShell()) setPane('music')
  }
  const [query, setQuery] = useState('')
  const [infoSignal, setInfoSignal] = useState(0)
  const [infoItem, setInfoItem] = useState(null)
  const [dialog, setDialog] = useState(null)
  // Chosen just now from the theme chooser: open on this theme's own theme page.
  useThemeLanding(() => setDialog({ kind: 'prefs', page: 'basic' }))
  // Bumped when a service is linked, so the Music pane lists it.
  const [servicesVersion, setServicesVersion] = useState(0)
  // Bumped to send the Music pane back to its root and close any dialog.
  const [homeSignal, setHomeSignal] = useState(0)
  const goHome = useCallback(() => { setDialog(null); setHomeSignal((v) => v + 1) }, [])
  // Which system to show. Shared with the other themes via the same key;
  // remembered across loads, defaulting to the oldest generation the first
  // time. 'all' shows every system.
  const [systemFilter, setSystemFilter] = useState(readStoredSystem)
  // Which service the search box searches, and the services it may pick from.
  const [searchScope, setSearchScope] = useState(null)
  const [transient, setTransient] = useState('')
  const [searchScopes, setSearchScopes] = useState([])
  const searchRef = useRef(null)

  // Settle the filter to a real household the first time, or when the stored
  // one is no longer present.
  useEffect(() => {
    if (!households.length) return
    const known = new Set(households.map((h) => h.id))
    // Systems of one generation get no picker, so none of them may be left
    // chosen: all of them are shown.
    const noPicker = households.length > 1 && !systemChoiceMatters(households)
    if (systemFilter === 'all' || (known.has(systemFilter) && !noPicker)) return
    setSystemFilter(noPicker ? 'all' : orderedHouseholds(households)[0].id)
  }, [households, systemFilter])

  const chooseSystem = useCallback((value) => {
    setSystemFilter(value)
    try { window.localStorage.setItem(SYSTEM_KEY, value) } catch { /* fine */ }
  }, [])

  // Rooms shown for the chosen system; the active room stays within them.
  const visibleGroups = useMemo(() => groups.filter(
    // The browser room belongs to no household, and shows whichever
    // system is being looked at.
    (g) => g.local || !systemFilter || systemFilter === 'all' || g.household === systemFilter),
    [groups, systemFilter])
  const activeGroup = useMemo(
    () => visibleGroups.find((g) => g.coordinator === activeId) || visibleGroups[0] || null,
    [visibleGroups, activeId])
  const activeZone = activeGroup ? zones[activeGroup.coordinator] : null

  const select = useCallback((uuid) => {
    setActiveId(uuid)
    try { window.localStorage.setItem(GROUP_KEY, uuid) } catch { /* fine */ }
    if (isNarrowShell()) setPane('now')
  }, [])

  // The Mini Controller (Window > Mini Controller, Option-Command-2). This
  // page may itself be that window (?mini=1); then it draws only the mini and
  // follows the main window's room through storage. Otherwise it opens one:
  // picture-in-picture where the browser has it, a popup where not, and a
  // panel in the page when both are refused or the room is "This browser",
  // whose audio lives in this page alone.
  const isMini = isMiniWindow()
  const miniWindow = useRef(null)
  const [pipWindow, setPipWindow] = useState(null)
  const [miniPanel, setMiniPanel] = useState(false)
  const toggleMini = useCallback(async () => {
    if (pipWindow && !pipWindow.closed) { pipWindow.close(); setPipWindow(null); return }
    if (miniWindow.current && !miniWindow.current.closed) { miniWindow.current.close(); miniWindow.current = null; return }
    if (miniPanel) { setMiniPanel(false); return }
    if (isBrowserRoom(activeZone?.uuid || '')) { setMiniPanel(true); return }
    const pip = await openMiniPip()
    if (pip) {
      pip.addEventListener('pagehide', () => setPipWindow((w) => (w === pip ? null : w)))
      setPipWindow(pip)
      return
    }
    const w = openMiniWindow()
    if (w) { miniWindow.current = w; w.focus() } else setMiniPanel(true)
  }, [miniPanel, pipWindow, activeZone])
  useEffect(() => {
    if (!isMini) return undefined
    const onStorage = (event) => {
      if (event.key === GROUP_KEY) setActiveId(event.newValue)
      if (event.key === SYSTEM_KEY) setSystemFilter(event.newValue)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [isMini])
  useEffect(() => {
    if (isMini || typeof BroadcastChannel === 'undefined') return undefined
    const channel = new BroadcastChannel(MINI_CHANNEL)
    channel.onmessage = (event) => {
      if (event.data?.type === 'info') { setInfoSignal((v) => v + 1); window.focus() }
    }
    return () => channel.close()
  }, [isMini])
  // The mini's info button opens Info & Options in the main window.
  const miniInfo = useCallback(() => {
    if (!isMini) { setInfoSignal((v) => v + 1); try { window.focus() } catch { /* fine */ } return }
    try { const ch = new BroadcastChannel(MINI_CHANNEL); ch.postMessage({ type: 'info' }); ch.close() } catch { /* fine */ }
    if (window.opener && !window.opener.closed) { try { window.opener.focus() } catch { /* fine */ } }
  }, [isMini])

  const pauseAll = () => {
    setDialog({ kind: 'confirm', title: t('desk.rooms.pauseAll'), body: t('desk.rooms.confirmPauseAll'),
                action: t('desk.rooms.pause'),
                onConfirm: () => {
                  setDialog(null)
                  // Streams, radio, TV, and line-in cannot pause; the speakers
                  // answer 701 to Pause there and want Stop, as the app sends.
                  for (const g of groups) {
                    const z = zones[g.coordinator]
                    const tr = z?.transport
                    if (tr?.state !== 'PLAYING') continue
                    // A TV input has no transport to pause or stop (701); the app's
                    // Pause All leaves those rooms be.
                    if (tr.source === 'tv') continue
                    const fixed = isLiveStream(tr.track_duration, tr.media_uri) || ['tv', 'line_in', 'radio', 'http_stream', 'service_stream', 'service_radio', 'service_hls'].includes(tr.source)
                    if (fixed) actions.stop(g.coordinator)
                    else actions.pause(g.coordinator)
                  }
                } })
  }

  // Keyboard shortcuts, as the application lists them.
  useEffect(() => {
    const onKey = (event) => {
      const tag = event.target?.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
      // The command key on a Mac; control stands in for it elsewhere.
      const cmd = event.metaKey || event.ctrlKey
      // Window's two items: Option-Command-1 the main window, -2 the mini.
      if (cmd && event.altKey && (event.code === 'Digit1' || event.code === 'Digit2')) {
        event.preventDefault()
        if (event.code === 'Digit1') goHome()
        else toggleMini()
        return
      }
      // The app's Search is Option-Command-F; with Option held a Mac reports
      // the key as "ƒ", so the physical key is what is matched.
      if (cmd && (event.key.toLowerCase() === 'f' || event.code === 'KeyF')) {
        event.preventDefault(); searchRef.current?.focus(); return
      }
      if (cmd && event.key === ',') {
        event.preventDefault(); setDialog({ kind: 'prefs' }); return
      }
      if (typing || dialog || !activeZone) return
      const transport = activeZone.transport || {}
      if (event.key === ' ') {
        event.preventDefault()
        if (transport.state === 'PLAYING') actions.pause(activeZone.uuid)
        else if (transport.track_uri) actions.play(activeZone.uuid)
      } else if (cmd && event.key === 'ArrowUp') {
        event.preventDefault(); actions.setGroupVolume(activeZone.uuid, Math.min(100, (activeZone.group_volume ?? 0) + 2))
      } else if (cmd && event.key === 'ArrowDown') {
        event.preventDefault(); actions.setGroupVolume(activeZone.uuid, Math.max(0, (activeZone.group_volume ?? 0) - 2))
      } else if (cmd && event.key.toLowerCase() === 'm') {
        event.preventDefault(); actions.setMute(activeZone.uuid, !activeZone.group_muted, true)
      } else if (cmd && event.key === 'ArrowRight') {
        event.preventDefault(); actions.next(activeZone.uuid)
      } else if (cmd && event.key === 'ArrowLeft') {
        event.preventDefault(); actions.previous(activeZone.uuid)
      } else if (cmd && (event.key === ']' || event.key === '[')) {
        event.preventDefault()
        const index = groups.findIndex((g) => g.coordinator === activeGroup?.coordinator)
        const next = groups[(index + (event.key === ']' ? 1 : groups.length - 1)) % groups.length]
        if (next) select(next.coordinator)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [activeZone, activeGroup, groups, actions, dialog, select, goHome, toggleMini])

  const external = (url) => () => window.open(url, '_blank', 'noopener')

  const fullScreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.()
    else document.documentElement.requestFullscreen?.()
  }

  // The application's MainMenu archive, in its order; the Debug menu is left out.
  // Nothing on a phone can press a keyboard shortcut, so the Help menu
  // leaves that entry out there, at the user's request.
  const narrow = useNarrow()
  const menus = [
    { id: 'sonos', title: controllerTitle(households, systemFilter, t), app: true, items: [
      { id: 'about', label: t('desk.menu.about'), icon: 'info', onSelect: () => setDialog({ kind: 'about' }) },
      'sep',
      { id: 'prefs', label: t('desk.menu.settings'), icon: 'gear', shortcut: '⌘,', onSelect: () => setDialog({ kind: 'prefs' }) },
      { id: 'updates', label: t('desk.menu.checkUpdates'), disabled: true },
      'sep',
      // The rest of the app's own menu (2026-09-24), grayed: a page can
      // neither uninstall itself nor hide itself from the Dock.
      { id: 'uninstall', label: t('desk.menu.uninstall'), disabled: true },
      'sep',
      { id: 'services', label: t('desk.menu.services'), icon: 'gears', submenu: true, disabled: true },
      'sep',
      { id: 'hide', label: t('desk.menu.hideSonos'), icon: 'hide', shortcut: '⌘H', disabled: true },
      { id: 'hideOthers', label: t('desk.menu.hideOthers'), icon: 'hideOthers', shortcut: '⌥⌘H', disabled: true },
      { id: 'showAll', label: t('desk.menu.showAll'), icon: 'showAll', disabled: true },
      'sep',
      { id: 'quit', label: t('desk.menu.quit'), icon: 'quit', shortcut: '⌘Q', disabled: true },
    ] },
    { id: 'edit', title: t('desk.menu.edit'), items: [
      // AppKit's cut:, copy:, paste:, delete: and selectAll: go to the text
      // field that has the focus, and are gray when none does.
      { id: 'cut', label: t('desk.menu.cut'), icon: 'cut', shortcut: '⌘X', disabled: editState.cut, onSelect: editActions.cut },
      { id: 'copy', label: t('desk.menu.copy'), icon: 'copy', shortcut: '⌘C', disabled: editState.copy, onSelect: editActions.copy },
      { id: 'paste', label: t('desk.menu.paste'), icon: 'paste', shortcut: '⌘V', disabled: editState.paste, onSelect: editActions.paste },
      { id: 'delete', label: t('desk.menu.delete'), icon: 'trash', disabled: editState.delete, onSelect: editActions.delete },
      'sep',
      { id: 'selectAll', label: t('desk.menu.selectAll'), icon: 'selectAll', shortcut: '⌘A', disabled: editState.selectAll, onSelect: editActions.selectAll },
      'sep',
      { id: 'search', label: t('common.search'), shortcut: '⌥⌘F', onSelect: () => searchRef.current?.focus() },
      // What macOS adds under Edit for any app (2026-09-24), grayed here.
      'sep',
      { id: 'autofill', label: t('desk.menu.autofill'), icon: 'keyboard', submenu: true, disabled: true },
      { id: 'dictation', label: t('desk.menu.dictation'), icon: 'mic', shortcut: 'fn D', disabled: true },
      { id: 'emoji', label: t('desk.menu.emoji'), icon: 'emoji', shortcut: 'fn E', disabled: true },
    ] },
    { id: 'view', title: t('desk.menu.view'), items: [
      { id: 'fullscreen', label: t('desk.menu.fullScreen'), icon: 'fullScreen', shortcut: 'fn F', onSelect: fullScreen },
    ] },
    { id: 'manage', title: t('desk.menu.manage'), items: [
      { id: 'lib', label: t('desk.menu.musicLibrarySettings'), onSelect: () => setDialog({ kind: 'prefs', page: 'library' }) },
      { id: 'svc', label: t('desk.menu.serviceSettings'), onSelect: () => setDialog({ kind: 'prefs', page: 'services' }) },
      { id: 'radio', label: t('desk.menu.addRadioStation'), disabled: !activeZone, onSelect: () => setDialog({ kind: 'radio' }) },
      'sep',
      // The app's archive has Update iTunes Playlists Now and Update Album
      // Art Now here too, both hidden; only the library update shows.
      { id: 'reindex', label: t('desk.menu.updateLibrary'), shortcut: '⇧⌘I', disabled: !activeZone,
        onSelect: () => api.setLibrary({ zone: activeZone.uuid, refresh: true }) },
    ] },
    { id: 'window', title: t('desk.menu.window'), items: [
      { id: 'close', label: t('desk.menu.close'), icon: 'close', shortcut: '⌘W', disabled: !dialog, onSelect: () => setDialog(null) },
      { id: 'minimize', label: t('desk.menu.minimize'), icon: 'minimize', shortcut: '⌘M', disabled: true },
      { id: 'zoom', label: t('desk.menu.zoom'), icon: 'zoom', onSelect: fullScreen },
      // macOS Tahoe's window tiling, which it adds to every app's Window
      // menu (2026-09-24); a page has no window of its own to tile.
      { id: 'fill', label: t('desk.menu.fill'), icon: 'fill', shortcut: '⌃fn F', disabled: true },
      { id: 'center', label: t('desk.menu.center'), icon: 'center', shortcut: '⌃fn C', disabled: true },
      'sep',
      { id: 'moveResize', label: t('desk.menu.moveResize'), icon: 'moveResize', submenu: true, disabled: true },
      { id: 'tile', label: t('desk.menu.fullScreenTile'), icon: 'tile', submenu: true, disabled: true },
      'sep',
      { id: 'removeFromSet', label: t('desk.menu.removeFromSet'), icon: 'removeFromSet', disabled: true },
      'sep',
      // The app gives these two their own shortcuts (2026-09-15).
      { id: 'main', label: t('desk.menu.mainWindow'), shortcut: '⌥⌘1', onSelect: goHome },
      { id: 'mini', label: t('desk.menu.miniController'), shortcut: '⌥⌘2', onSelect: toggleMini },
      { id: 'front', label: t('desk.menu.bringAllToFront'), icon: 'front', onSelect: () => window.focus() },
    ] },
    { id: 'help', title: t('desk.menu.help'), search: true, items: [
      { id: 'shop', label: t('desk.menu.shop'), onSelect: external('https://www.sonos.com/') },
      { id: 's2', label: `${t('s2.title')}\u2026`, onSelect: () => setDialog({ kind: 's2' }) },
      'sep',
      ...(narrow ? [] : [{ id: 'keys', label: t('desk.shortcuts.title'), onSelect: () => setDialog({ kind: 'shortcuts' }) }]),
      { id: 'help', label: t('desk.menu.systemHelp'), icon: 'bulb', onSelect: external('https://support.sonos.com/') },
      // The app sends this one to Sonos' article in the browser (2026-09-28).
      { id: 'firewall', label: t('desk.menu.firewallHelp'), onSelect: external('https://support.sonos.com/en-us/article/configure-your-firewall-to-work-with-sonos') },
      { id: 'support', label: t('desk.menu.supportSite'), onSelect: external('https://support.sonos.com/') },
      'sep',
      { id: 'log', label: t('desk.menu.errorLog'), onSelect: () => setDialog({ kind: 'errorlog' }) },
      { id: 'diag', label: t('desk.menu.submitDiagnostics'), disabled: true },
      { id: 'reset', label: t('desk.menu.reset'), disabled: true },
      { id: 'forget', label: t('desk.menu.forget'), disabled: true },
    ] },
  ]

  if (isMini) {
    return (
      <div className="dk-root mac-root mac-mini-root">
        <Mini zone={activeZone} mode="popup" onInfo={miniInfo} />
      </div>
    )
  }

  return (
    <div className="dk-root mac-root">
      <MenuBar menus={menus} onLogo={() => setDialog({ kind: 'aboutSonora' })} />
      <div className="dk-titlebar">
        <div className="dk-lights" data-inactive={Boolean(dialog)}>
          <span className="dk-light-close" /><span className="dk-light-min" /><span className="dk-light-zoom" />
        </div>
        {/* The dev theme switcher, at the right of the window's title row
            rather than in the system menu bar (2026-09-28). */}
        <DevThemeSwitch className="mac-titlebar-theme" />
      </div>
      {/* The Mac app counts down what is left of a track, as the Windows one does (2026-09-15). */}
      <Transport zone={activeZone} group={activeGroup} query={query} onQuery={setQuery}
                 scope={searchScope} scopes={searchScopes} onScope={setSearchScope} remainingTime
                 onEq={(uuid) => setDialog({ kind: 'prefs', page: uuid })}
                 searchRef={searchRef} households={households} icons={macTransportIcons}
                 />
      <PaneSwitch value={pane} onChange={setPane} />
      {/* The way the panes just moved, so the one arriving slides in from
          the side the tabs say it was on. */}
      <div className="dk-panes" data-pane={pane} data-slide={paneDirection || undefined}>
        <ConnectionOverlay />
        {/* The Mac app's tiles carry the room name alone, with no "(L + R)"
            for a stereo pair (2026-09-15). That suffix is Sonora's own
            default from the topology, which the Windows theme also turns
            off; neither app prints it. */}
        <Rooms plainNames idlePlayDisabled s2System
          households={households} systemFilter={systemFilter} onSystem={chooseSystem}
          groups={visibleGroups}
          zones={zones}
          activeId={activeGroup?.coordinator}
          onEq={(uuid) => setDialog({ kind: 'prefs', page: uuid })}
          onSelect={select}
          onGroup={(group) => setDialog({ kind: 'group', group })}
          onPauseAll={pauseAll}
        />
        <div className="dk-divider" />
        {/* The queue's chevron expands it over Now Playing, as the Mac app's
            does (it was once the Windows shell's alone). */}
        <div className="dk-pane dk-center" data-queue-expanded={queueExpanded || undefined}>
          {/* The Mac app's (i) and a queue row's Info both open Info & Options
              in the music pane, as the Windows app's do (2026-09-15). */}
          <NowPlaying zone={activeZone} onInfo={() => showInfo(null)} onMessage={setTransient} marquee="mac" />
          <div className="dk-divider" style={{ height: 1 }} />
          <Queue zone={activeZone} ClearDialog={ClearQueueConfirm} onInfo={(item) => showInfo(item)} cloudQueueInUse={false}
                 expanded={queueExpanded} onExpand={() => setQueueExpanded((v) => !v)} />
        </div>
        <div className="dk-divider" />
        <Browse households={households} zones={zones} groups={groups} librarySongArt
                scope={searchScope} onScope={setSearchScope} onScopes={setSearchScopes}
                systemFilter={systemFilter} activeZone={activeZone} roomChosen={Boolean(activeId)}
                query={query} onDone={() => setQuery('')}
                servicesVersion={servicesVersion + servicesEpoch} homeSignal={homeSignal}
                onAddServices={() => setDialog({ kind: 'addService' })}
                onLinkService={(info) => setDialog({ kind: 'addService', preset: info })}
                infoSignal={infoSignal} infoItem={infoItem}
                onSleepTimer={(rect) => setDialog({ kind: 'sleep', anchor: rect })} onAlarms={() => setDialog({ kind: 'alarms' })} onMessage={setTransient}
                onAddRadio={() => setDialog({ kind: 'radio' })}
                onLibrarySettings={() => setDialog({ kind: 'prefs', page: 'library' })} />
      </div>

      <TransientMessage text={transient} onDone={() => setTransient('')} />
      {dialog?.kind === 'prefs' && (
        <Preferences initial={dialog.page} current={activeZone?.uuid || null} onClose={() => setDialog(null)}
                     onServicesChanged={() => setServicesVersion((v) => v + 1)}
                     onAddService={() => setDialog({ kind: 'addService' })}
                     onLinkService={(info) => setDialog({ kind: 'addService', preset: info })} />
      )}
      {dialog?.kind === 'addService' && (
        <AddServices households={households} zones={zones} onClose={() => setDialog(null)}
                     preset={dialog.preset} onLinked={() => setServicesVersion((v) => v + 1)} />
      )}
      {dialog?.kind === 'radio' && (
        <AddRadioStation zone={activeZone} onClose={() => setDialog(null)}
                         onAdded={(r) => setTransient?.(t(r.exists ? 'desk.radio.exists' : 'desk.radio.added', { title: r.title }))} />
      )}
      {miniPanel && <Mini zone={activeZone} onClose={() => setMiniPanel(false)} onInfo={miniInfo} />}
      {pipWindow && !pipWindow.closed && createPortal(
        <Mini zone={activeZone} mode="pip" win={pipWindow} onClose={() => setPipWindow(null)} onInfo={miniInfo} />,
        pipWindow.document.body)}
      {dialog?.kind === 'errorlog' && (
        <Window title={t('desk.menu.errorLog')} onClose={() => setDialog(null)}><div className="dk-errorlog"><ErrorLog /><div className="dk-add-actions"><button type="button" className="dk-win-btn" data-default="true" onClick={() => setDialog(null)}>{t('common.done')}</button></div></div></Window>
      )}
      {dialog?.kind === 'about' && <About onClose={() => setDialog(null)} />}
      {dialog?.kind === 's2' && <S2Upgrade onClose={() => setDialog(null)} />}
      {dialog?.kind === 'aboutSonora' && <AboutSonora onClose={() => setDialog(null)} />}
      {dialog?.kind === 'shortcuts' && <Shortcuts onClose={() => setDialog(null)} />}
      {dialog?.kind === 'sleep' && (
        <SleepTimer zone={activeZone} anchor={dialog.anchor} placement="left" chooseKey="desk.sleep.setFor"
                    groupLabel={activeZone && activeGroup && activeGroup.members.length > 1 ? `${activeZone.name} + ${activeGroup.members.length - 1}` : ''} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'alarms' && <Alarms zone={activeZone} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'group' && (
        <GroupRooms group={dialog.group} zones={zones} households={households} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'confirm' && (
        <Confirm title={dialog.title} body={dialog.body} action={dialog.action}
                 onConfirm={dialog.onConfirm} onClose={() => setDialog(null)} />
      )}

      {(notices.length > 0 || !connected) && (
        <div className="dk-notices" aria-live="polite">
          {!connected && <div className="dk-notice"><strong>{t('common.reconnecting')}</strong></div>}
          {notices.map((notice) => (
            <div key={notice.id} className="dk-notice">
              <strong>{t(notice.titleKey)}</strong>
              <span>{notice.detail || (notice.detailKey ? t(notice.detailKey, notice.detailParams) : '')}</span>
              <div>
                {' '}
                <button type="button" onClick={() => dismiss(notice.id)}>{t('common.dismiss')}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default {
  id: 'macos',
  name: 'Sonos macOS Desktop',
  version: '1.0.0',
  thumbnail,
  description: 'Replicates the Sonos S1 desktop controller as shipped for the Mac: its menus, the transport strip, and Rooms, Now Playing, Queue and Music panes side by side.',
  colorScheme: 'dark',
  tokens,
  Shell,
}
