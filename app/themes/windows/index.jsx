import { winTransportIcons, winBrowseIcons } from '../../frontend/src/components/Icons.jsx'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { controllerTitle, isLiveStream } from '../../frontend/src/lib/format.js'
import { isBrowserRoom } from '../../frontend/src/lib/browserRoom.js'
import { useShellSelection, GROUP_KEY, SYSTEM_KEY } from '../../frontend/src/lib/shellSelection.js'
import { isTyping, isCommand, keyOf, useFullscreen, shuffleToggled, repeatCycled } from '../../frontend/src/lib/keys.js'
import { api } from '../../frontend/src/lib/api.js'
import MenuBar from './MenuBar.jsx'
import Transport from './Transport.jsx'
import Rooms from './Rooms.jsx'
import { NowPlaying, Queue } from './Center.jsx'
import Browse from './Browse.jsx'
import PaneSwitch, { isNarrowShell, usePaneDirection } from './PaneSwitch.jsx'
import { AddServices, Confirm, GroupRooms, TrackInfo, SleepTimer, AddRadioStation } from './Dialogs.jsx'
import S2Upgrade from '../../frontend/src/components/S2Upgrade.jsx'
import AboutSonora from '../../frontend/src/components/AboutSonora.jsx'
import TransientMessage from '../../frontend/src/components/TransientMessage.jsx'
import Settings from './Settings.jsx'
import WinAbout from './About.jsx'
import WinShortcuts from './Shortcuts.jsx'
import WinAlarms from './Alarms.jsx'
import WinSaveQueue from './SaveQueue.jsx'
import WinClearQueue from './ClearQueue.jsx'
import ErrorLogWindow from './ErrorLogWindow.jsx'
import Mini, { openMiniWindow, openMiniPip, isMiniWindow, MINI_CHANNEL } from './Mini.jsx'
import appIcon from '../../frontend/src/assets/sonora.png'
import { tokens } from './tokens.js'
import './desktop.css'
import './window-chrome.css'
import './responsive.css'
import thumbnail from './thumbnail.webp'
import { useNarrow } from '../../frontend/src/lib/useNarrow.js'
import ConnectionOverlay from './ConnectionOverlay.jsx'
import { editState, editActions } from '../../frontend/src/lib/editMenu.js'
import { useThemeLanding } from '../../frontend/src/lib/theme.jsx'

// A replication of the Sonos S1 desktop controller as shipped for Windows.
//
// It is the same application as the Mac build, so the content is the Mac
// theme's own components reused unchanged: the 80px transport strip and the
// Rooms, Now Playing over Queue, and Music panes side by side. Only the window
// frame is Windows: a light title bar with the icon and title on the left and
// minimize, maximize and close on the right; a classic menu bar beneath it
// (File, Edit, Manage, Help, as the app has them); Segoe UI; Ctrl-key shortcuts.
//
// Confirmed against the Windows installer (Sonos S1 Controller 57.23.74170) and
// the application core decompiled from the shared build.

// The small window icon at the left of the title bar: Sonora's own icon,
// where the app shows Sonos'.
function WinIcon() {
  return <img className="win-titlebar-icon" src={appIcon} alt="" />
}

// `frame` draws the top of the window (the Windows title bar by default) and
// receives what it needs from the shell; `rootClass` adds a theme's own class
// to the root so its stylesheet can restyle everything below; `extraHelpItems`
// appends entries to the Help menu (given the shell's dialog opener); and
// `extraDialogs` renders a theme's own dialog kinds. Sedona uses all four.
export function Shell({ rootClass = '', frame = null, extraHelpItems = null, extraDialogs = null }) {
  const { zones, groups, households, connected, actions, notices, dismiss, servicesEpoch } = useSystem()
  const { t } = useI18n()
  // Choosing a room on a narrow window moves on to Now Playing, as the phone
  // apps do. That is a layout decision, so it stays in the layout.
  const { activeId, setActiveId, activeGroup, activeZone, visibleGroups,
          systemFilter, setSystemFilter, chooseSystem, select } = useShellSelection({
    onSelect: () => { if (isNarrowShell()) setPane('now') },
  })
  const [query, setQuery] = useState('')
  const [dialog, setDialog] = useState(null)
  // Chosen just now from the theme chooser: open on this theme's own theme page.
  useThemeLanding(() => setDialog({ kind: 'prefs', page: 'basic' }))
  const [servicesVersion, setServicesVersion] = useState(0)
  const [homeSignal, setHomeSignal] = useState(0)
  const goHome = useCallback(() => { setDialog(null); setHomeSignal((v) => v + 1) }, [])
  // The themes that dress this shell name themselves in their own header
  // rather than in a title bar, and their wordmark opens About Sonora the
  // way an application's name does elsewhere.
  const openAbout = useCallback(() => setDialog({ kind: 'aboutSonora' }), [])
  const [favoritesSignal, setFavoritesSignal] = useState(0)
  const [selectionCommand, setSelectionCommand] = useState(null)
  const [queueScroll, setQueueScroll] = useState(0)
  // Which service the search box searches, and the services it may pick from.
  const [searchScope, setSearchScope] = useState(null)
  const [transient, setTransient] = useState('')
  const [searchScopes, setSearchScopes] = useState([])
  // The app's queue header caret slides the queue up over Now Playing.
  const [queueExpanded, setQueueExpanded] = useState(false)
  // The queue as last read, so Now Playing can name the coming track.
  const [queueItems, setQueueItems] = useState([])
  // The (i) in Now Playing opens Info & Options in the browse pane.
  const [infoSignal, setInfoSignal] = useState(0)
  // A queue row asking for Info & Options hands its item to the Music pane.
  const [infoItem, setInfoItem] = useState(null)
  // Set when a queue row is moved or removed, cleared when the queue is replaced; the
  // app then asks before Play/Shuffle replace it.
  const [queueEdited, setQueueEdited] = useState(false)
  // Which pane shows when the window is too narrow for all three (the
  // shared responsive sheet decides when that is). Choosing a room there
  // moves on to Now Playing, as the phone apps do.
  const [pane, setPane] = useState('now')
  const paneDirection = usePaneDirection(pane)
  // Info & Options opens in the music pane. On a wide screen that pane is
  // already beside Now Playing; on a narrow one it is not on screen at all,
  // so pressing the glyph looked like it did nothing. It carries you there
  // (user request).
  const showInfo = (item) => {
    setInfoItem(item)
    setInfoSignal((v) => v + 1)
    if (isNarrowShell()) setPane('music')
  }
  // The Mini Controller. This page may itself be that window (opened with
  // ?mini=1), in which case it renders only the panel and talks to the main
  // window over a BroadcastChannel; otherwise it holds the popup's handle,
  // and falls back to a floating panel when the browser blocks the popup.
  const isMini = isMiniWindow()
  const miniWindow = useRef(null)
  // Which room is in view, for the callbacks defined above the line that
  // works it out. Naming activeZone in a dependency array up here reads it
  // before its declaration and the whole shell fails to render.
  const roomRef = useRef('')
  const [pipWindow, setPipWindow] = useState(null)
  const [miniPanel, setMiniPanel] = useState(false)
  const toggleMini = useCallback(async () => {
    if (pipWindow && !pipWindow.closed) { pipWindow.close(); setPipWindow(null); return }
    const open = miniWindow.current && !miniWindow.current.closed
    if (open) { miniWindow.current.close(); miniWindow.current = null; return }
    if (miniPanel) { setMiniPanel(false); return }
    // "This browser" only exists in the page holding the audio element: its
    // room, its transport and its clock are all in memory here, and a popup is
    // a separate document that fetches state from the backend, which has never
    // heard of it. That window came up blank. The
    // in-page panel is part of this React tree, so it sees the room and its
    // buttons reach the same output. Picture-in-picture is portalled out of
    // this tree and would have been fine, but Firefox has none.
    if (isBrowserRoom(roomRef.current)) { setMiniPanel(true); return }
    const pip = await openMiniPip()
    if (pip) {
      pip.addEventListener('pagehide', () => setPipWindow((w) => (w === pip ? null : w)))
      setPipWindow(pip)
      return
    }
    const w = openMiniWindow()
    if (w) { miniWindow.current = w; w.focus() } else setMiniPanel(true)
  }, [miniPanel, pipWindow])
  useEffect(() => {
    if (isMini || typeof BroadcastChannel === 'undefined') return undefined
    const channel = new BroadcastChannel(MINI_CHANNEL)
    channel.onmessage = (event) => {
      if (event.data?.type === 'info') { setInfoSignal((v) => v + 1); window.focus() }
    }
    return () => channel.close()
  }, [isMini])
  // The mini window follows the room chosen in the main window.
  useEffect(() => {
    if (!isMini) return undefined
    const onStorage = (event) => {
      if (event.key === GROUP_KEY) setActiveId(event.newValue)
      if (event.key === SYSTEM_KEY) setSystemFilter(event.newValue)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [isMini])
  // Info from the mini opens Info & Options in the main window and brings
  // that window forward: from the PiP window this code already runs in the
  // main window (focus() raises its tab and restores it when minimized);
  // from a popup the opener is told over the channel and focused.
  const miniInfo = useCallback(() => {
    if (!isMini) { setInfoSignal((v) => v + 1); try { window.focus() } catch { /* fine */ } return }
    try { const ch = new BroadcastChannel(MINI_CHANNEL); ch.postMessage({ type: 'info' }); ch.close() } catch { /* fine */ }
    if (window.opener && !window.opener.closed) { try { window.opener.focus() } catch { /* fine */ } }
  }, [isMini])
  const searchRef = useRef(null)

  roomRef.current = activeZone?.uuid || ''

  const pauseAll = () => {
    setDialog({ kind: 'confirm', title: t('win.queue.confirmTitle'), body: t('desk.rooms.confirmPauseAll'),
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

  useEffect(() => {
    const onKey = (event) => {
      // The app's own bindings (KeyboardShortcutManager.cs), less the ones a
      // browser keeps for itself. Space stays as a play/pause key as well.
      // The three tests above them are shared: lib/keys.js.
      const typing = isTyping(event)
      const cmd = isCommand(event)
      const key = keyOf(event)
      if (cmd && key === 'f') { event.preventDefault(); searchRef.current?.focus(); return }
      if (cmd && key === 'k') { event.preventDefault(); setDialog({ kind: 'shortcuts' }); return }
      if (cmd && key === 'u') { event.preventDefault(); goHome(); return }
      if (cmd && key === 'd') { event.preventDefault(); toggleMini(); return }
      // Ctrl+* (Ctrl+Shift+8 on most keyboards) opens Sonos Favorites, and
      // Ctrl+G folds the queue open or shut, as the app's list has them.
      if (cmd && (key === '*' || (event.shiftKey && key === '8'))) { event.preventDefault(); setDialog(null); setFavoritesSignal((v) => v + 1); return }
      if (cmd && key === 'g') { event.preventDefault(); setQueueExpanded((v) => !v); return }
      // Three of the app's keys are ones a browser keeps for itself
      // (Ctrl+T new tab, Ctrl+L address bar, Ctrl+W close tab), so Sonora
      // binds the nearest free ones and says so in the shortcut list:
      // Ctrl+Shift+X crossfades (X for cross), Ctrl+Shift+L finds the
      // playing row, and Escape closes the window on top.
      if (cmd && event.shiftKey && key === 'x') {
        event.preventDefault()
        if (activeZone) actions.setCrossfade(activeZone.uuid, !(activeZone.transport?.crossfade))
        return
      }
      if (cmd && event.shiftKey && key === 'l') { event.preventDefault(); setQueueScroll((v) => v + 1); return }
      // The app's keys for the ticked rows: play them next, replace the queue
      // with them, or add them to its end.
      if (!typing && event.shiftKey && event.key === 'Enter') { event.preventDefault(); setSelectionCommand({ n: Date.now(), how: 'next' }); return }
      if (cmd && event.shiftKey && key === 'q') { event.preventDefault(); setSelectionCommand({ n: Date.now(), how: 'replace' }); return }
      if (cmd && key === 'q') { event.preventDefault(); setSelectionCommand({ n: Date.now(), how: 'add' }); return }
      if (event.key === 'F1') { event.preventDefault(); window.open('https://support.sonos.com/', '_blank', 'noopener'); return }
      if (event.key === 'F11') { event.preventDefault(); fullScreen(); return }
      if (typing || dialog || !activeZone) return
      const transport = activeZone.transport || {}
      const mode = transport.play_mode || 'NORMAL'
      const toggle = () => {
        if (transport.state === 'PLAYING') actions.pause(activeZone.uuid)
        else if (transport.track_uri) actions.play(activeZone.uuid)
      }
      if (event.key === ' ' || (cmd && key === 'p')) {
        event.preventDefault(); toggle()
      } else if (cmd && key === 'e') {
        event.preventDefault()

        actions.setPlayMode(activeZone.uuid, shuffleToggled(mode))
      } else if (cmd && key === 'r') {
        event.preventDefault()
        actions.setPlayMode(activeZone.uuid, repeatCycled(mode))
      } else if (cmd && event.shiftKey && key === 'm') {
        event.preventDefault(); groups.forEach((g) => actions.setMute(g.coordinator, true, true))
      } else if (cmd && key === 'm') {
        event.preventDefault(); actions.setMute(activeZone.uuid, !activeZone.group_muted, true)
      } else if (cmd && event.shiftKey && key === 'i') {
        event.preventDefault(); api.setLibrary({ zone: activeZone.uuid, refresh: true })
      } else if (cmd && (event.key === 'ArrowUp' || event.key === '+' || event.key === '=')) {
        event.preventDefault(); actions.setGroupVolume(activeZone.uuid, Math.min(100, (activeZone.group_volume ?? 0) + 2))
      } else if (cmd && (event.key === 'ArrowDown' || event.key === '-')) {
        event.preventDefault(); actions.setGroupVolume(activeZone.uuid, Math.max(0, (activeZone.group_volume ?? 0) - 2))
      } else if (cmd && event.key === 'ArrowRight') {
        event.preventDefault(); actions.next(activeZone.uuid)
      } else if (cmd && event.key === 'ArrowLeft') {
        event.preventDefault(); actions.previous(activeZone.uuid)
      } else if (cmd && (event.key === '.' || event.key === ',' || event.key === ']' || event.key === '[')) {
        event.preventDefault()
        const forward = event.key === '.' || event.key === ']'
        const index = groups.findIndex((g) => g.coordinator === activeGroup?.coordinator)
        const next = groups[(index + (forward ? 1 : groups.length - 1)) % groups.length]
        if (next) select(next.coordinator)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [activeZone, activeGroup, groups, actions, dialog, select])

  const external = (url) => () => window.open(url, '_blank', 'noopener')
  // Which glyph the middle caption button wears: Windows draws the two
  // overlapping squares (restore) on a maximized window and the single square
  // (maximize) otherwise. Full screen is the nearest thing this page has to
  // maximized, and leaving it the nearest to restoring.
  const { isFull, toggle: fullScreen } = useFullscreen()

  // The application's menus as the Windows build has them (captured
  // 2026-09-05): File holds only the Mini Controller and Exit, Edit only the
  // clipboard trio, Manage ends in Settings, Help opens with the shop.
  // Labels the app writes with a trailing ellipsis on Windows.
  const dots = (label) => (label.endsWith('…') ? label : `${label}…`)
  // Nothing on a phone can press a keyboard shortcut, so the Help menu
  // leaves that entry out there (user request).
  const narrow = useNarrow()
  const menus = [
    { id: 'file', title: t('win.menu.file'), items: [
      { id: 'mini', label: t('win.menu.showMini'), onSelect: toggleMini },
      'sep',
      { id: 'exit', label: t('win.menu.exit'), disabled: true },
    ] },
    { id: 'edit', title: t('desk.menu.edit'), items: [
      // WPF's clipboard commands: live only in a text field, Cut and Copy
      // only with a selection in it.
      { id: 'cut', label: t('desk.menu.cut'), shortcut: 'Ctrl+X', disabled: editState.cut, onSelect: editActions.cut },
      { id: 'copy', label: t('desk.menu.copy'), shortcut: 'Ctrl+C', disabled: editState.copy, onSelect: editActions.copy },
      { id: 'paste', label: t('desk.menu.paste'), shortcut: 'Ctrl+V', disabled: editState.paste, onSelect: editActions.paste },
    ] },
    { id: 'manage', title: t('desk.menu.manage'), items: [
      { id: 'lib', label: t('desk.menu.musicLibrarySettings'), onSelect: () => setDialog({ kind: 'prefs', page: 'library' }) },
      { id: 'svc', label: t('desk.menu.serviceSettings'), onSelect: () => setDialog({ kind: 'prefs', page: 'services' }) },
      { id: 'radio', label: t('desk.menu.addRadioStation'), disabled: !activeZone, onSelect: () => setDialog({ kind: 'radio' }) },
      'sep',
      { id: 'reindex', label: t('desk.menu.updateLibrary'), disabled: !activeZone,
        onSelect: () => api.setLibrary({ zone: activeZone.uuid, refresh: true }) },
      'sep',
      { id: 'updates', label: t('win.menu.checkUpdates'), disabled: true },
      'sep',
      { id: 'lang', label: t('win.menu.changeLanguage'), onSelect: () => setDialog({ kind: 'prefs', page: 'basic' }) },
      'sep',
      { id: 'prefs', label: t('win.menu.settings'), onSelect: () => setDialog({ kind: 'prefs' }) },
    ] },
    { id: 'help', title: t('desk.menu.help'), items: [
      { id: 'shop', label: dots(t('desk.menu.shop')), onSelect: external('https://www.sonos.com/') },
      { id: 's2', label: dots(t('s2.title')), onSelect: () => setDialog({ kind: 's2' }) },
      'sep',
      ...(narrow ? [] : [{ id: 'keys', label: dots(t('desk.shortcuts.title')), onSelect: () => setDialog({ kind: 'shortcuts' }) }]),
      { id: 'help', label: dots(t('desk.menu.systemHelp')), onSelect: external('https://support.sonos.com/') },
      { id: 'support', label: dots(t('desk.menu.supportSite')), onSelect: external('https://support.sonos.com/') },
      ...(extraHelpItems ? ['sep', ...extraHelpItems((kind) => setDialog({ kind }))] : []),
      'sep',
      { id: 'log', label: dots(t('desk.menu.errorLog')), onSelect: () => setDialog({ kind: 'errorlog' }) },
      // Submit Beta Feedback is in the app's menu archive but bound to a
      // visibility only beta builds turn on; the shipping app does not show it
      // (mainmenu.xaml; the S1 Windows app, 2026-09-29).
      { id: 'diag', label: dots(t('desk.menu.submitDiagnostics')), disabled: true },
      { id: 'forget', label: dots(t('desk.menu.forget')), disabled: true },
      { id: 'reset', label: dots(t('desk.menu.reset')), disabled: true },
      'sep',
      { id: 'about', label: dots(t('desk.menu.about')), onSelect: () => setDialog({ kind: 'about' }) },
      { id: 'aboutSonora', label: t('about.menu'), onSelect: () => setDialog({ kind: 'aboutSonora' }) },
    ] },
  ]

  if (isMini) {
    return (
      <div className={`dk-root win-root win-mini-root ${rootClass}`.trim()}>
        <Mini zone={activeZone} mode="popup" onInfo={miniInfo} />
      </div>
    )
  }

  const title = controllerTitle(households, systemFilter, t)
  return (
    <div className={`dk-root win-root ${rootClass}`.trim()}>
      {frame ? frame({ goHome, openAbout, fullScreen, title, t, connected, households, systemFilter }) : (
      <div className="win-titlebar">
        <div className="win-titlebar-id">
          <WinIcon />
          <button type="button" className="win-titlebar-home" onClick={goHome}
                  title={t('desk.menu.mainWindow')}>
            {title}
          </button>
        </div>
        <div className="win-titlebar-buttons">
          {/* Caption buttons drawn to the sizes Windows 11 gives them, measured
              off the S1 app's title bar at 100% (2026-09-14): a 10x1 line, a 10x10 square with 1px
              corners (or, maximized, an 8x8 square with a second one peeking
              out 2px up and right), and a 10x10 X, all in 1px strokes. The
              drawings are 10 wide and 11 tall so that, centered in the 21px
              button, the line lands on a whole pixel row. */}
          <button type="button" className="win-tb-btn" title={t('desk.menu.minimize')} tabIndex={-1}>
            <svg viewBox="0 0 10 11" aria-hidden="true"><rect x="0" y="5" width="10" height="1" fill="currentColor" /></svg>
          </button>
          <button type="button" className="win-tb-btn" title={isFull ? t('win.restore') : t('win.maximize')} onClick={fullScreen}>
            {isFull ? (
              <svg viewBox="0 0 10 11" aria-hidden="true">
                <rect x="0.5" y="2.5" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1" />
                <path d="M2.5 2.5V1.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H7.5" fill="none" stroke="currentColor" strokeWidth="1" />
              </svg>
            ) : (
              <svg viewBox="0 0 10 11" aria-hidden="true"><rect x="0.5" y="0.5" width="9" height="9" rx="1" fill="none" stroke="currentColor" strokeWidth="1" /></svg>
            )}
          </button>
          <button type="button" className="win-tb-btn win-tb-close" title={t('desk.menu.close')} tabIndex={-1}>
            <svg viewBox="0 0 10 11" aria-hidden="true"><path d="M0 0L10 10M10 0L0 10" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>
          </button>
        </div>
      </div>
      )}
      <MenuBar menus={menus} />
      <Transport zone={activeZone} group={activeGroup} query={query} onQuery={setQuery}
                 icons={winTransportIcons}
                 scope={searchScope} scopes={searchScopes} onScope={setSearchScope} remainingTime
                 onEq={(uuid) => setDialog({ kind: 'prefs', page: uuid })}
                 searchRef={searchRef} households={households}
                 />
      <PaneSwitch value={pane} onChange={setPane} />
      {/* The way the panes just moved, so the one arriving slides in from
          the side the tabs say it was on. */}
      <div className="dk-panes" data-pane={pane} data-slide={paneDirection || undefined}>
        <ConnectionOverlay />
        <Rooms plainNames
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
        <div className="dk-pane dk-center" data-queue-expanded={queueExpanded || undefined}>
          <NowPlaying zone={activeZone} onInfo={() => showInfo(null)} onMessage={setTransient} marquee
                      onArt={toggleMini}
                      // The room's own queue (#0) names its next entry; a Spotify Connect
                      // session plays a queue of its own (#vli) that no controller can
                      // list, so Next is the track the speaker reports, as the Windows
                      // app shows it (2026-10-04).
                      nextTrack={/^x-rincon-queue:.*#(?!0$)/.test(activeZone?.transport?.media_uri || '')
                        ? undefined : queueItems[(activeZone?.transport?.track_number || 0)] || null}
                      groupLabel={activeZone && activeGroup && activeGroup.members.length > 1 ? `${activeZone.name} + ${activeGroup.members.length - 1}` : ''} />
          <div className="dk-divider" style={{ height: 1 }} />
          <Queue zone={activeZone} expanded={queueExpanded} onExpand={() => setQueueExpanded((v) => !v)} SaveDialog={WinSaveQueue} ClearDialog={WinClearQueue} emptyKey="win.queue.empty" scrollSignal={queueScroll}
                 onItems={setQueueItems} onInfo={(item) => showInfo(item)}
                 onEdited={() => setQueueEdited(true)} />
        </div>
        <div className="dk-divider" />
        <Browse households={households} zones={zones} groups={groups}
                scope={searchScope} onScope={setSearchScope} onScopes={setSearchScopes}
                systemFilter={systemFilter} activeZone={activeZone} roomChosen={Boolean(activeId)}
                query={query} onDone={() => setQuery('')}
                servicesVersion={servicesVersion + servicesEpoch} homeSignal={homeSignal} favoritesSignal={favoritesSignal} selectionCommand={selectionCommand}
                infoSignal={infoSignal} infoItem={infoItem}
                onAddServices={() => setDialog({ kind: 'addService' })} addServicesAsPage icons={winBrowseIcons}
                onLinkService={(info) => setDialog({ kind: 'addService', preset: info })}
                onSleepTimer={(anchor) => setDialog({ kind: 'sleep', anchor })} onAlarms={() => setDialog({ kind: 'alarms' })} onMessage={setTransient}
                onAddRadio={() => setDialog({ kind: 'radio' })}
                queueEdited={queueEdited} onQueueReplaced={() => setQueueEdited(false)} />
      </div>

      <TransientMessage text={transient} onDone={() => setTransient('')} />
      {miniPanel && <Mini zone={activeZone} onClose={() => setMiniPanel(false)} onInfo={miniInfo} />}
      {pipWindow && !pipWindow.closed && createPortal(
        <Mini zone={activeZone} mode="pip" win={pipWindow} onClose={() => setPipWindow(null)} onInfo={miniInfo} />,
        pipWindow.document.body)}
      {dialog?.kind === 'prefs' && (
        <Settings initial={dialog.page} activeRoom={activeZone?.uuid || ''} onClose={() => setDialog(null)}
                     onAddService={(preset) => setDialog({ kind: 'addService', preset })} />
      )}
      {dialog?.kind === 'addService' && (
        <AddServices households={households} zones={zones} onClose={() => setDialog(null)} authorizeStep
                     wizard={!dialog.preset} preset={dialog.preset} onLinked={() => setServicesVersion((v) => v + 1)} />
      )}
      {dialog?.kind === 'radio' && (
        <AddRadioStation zone={activeZone} onClose={() => setDialog(null)}
                         onAdded={(r) => setTransient?.(t(r.exists ? 'desk.radio.exists' : 'desk.radio.added', { title: r.title }))} />
      )}
      {dialog?.kind === 'about' && <WinAbout onClose={() => setDialog(null)} />}
      {dialog?.kind === 'errorlog' && <ErrorLogWindow onClose={() => setDialog(null)} />}
      {dialog?.kind === 's2' && <S2Upgrade onClose={() => setDialog(null)} />}
      {dialog?.kind === 'aboutSonora' && <AboutSonora onClose={() => setDialog(null)} />}
      {dialog?.kind === 'shortcuts' && <WinShortcuts onClose={() => setDialog(null)} />}
      {dialog?.kind === 'info' && <TrackInfo zone={activeZone} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'sleep' && <SleepTimer zone={activeZone} anchor={dialog.anchor}
                                              groupLabel={activeGroup?.name || ''} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'alarms' && <WinAlarms zone={activeZone} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'group' && (
        <GroupRooms windows group={dialog.group} zones={zones} households={households} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'confirm' && (
        <Confirm title={dialog.title} body={dialog.body} action={dialog.action}
                 cancelLabel={t('common.cancel')}
                 onConfirm={dialog.onConfirm} onClose={() => setDialog(null)} />
      )}
      {extraDialogs ? extraDialogs(dialog, () => setDialog(null)) : null}

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
  id: 'windows',
  name: 'Sonos Windows Desktop',
  version: '1.0.0',
  thumbnail,
  description: 'Replicates the Sonos S1 desktop controller as shipped for Windows: a light title bar and menu bar over the same transport strip and Rooms, Now Playing, Queue and Music panes as the Mac build.',
  colorScheme: 'dark',
  tokens,
  Shell,
}
