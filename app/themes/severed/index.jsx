import { createPortal } from 'react-dom'
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useOneAlert } from '../../frontend/src/lib/oneAlert.js'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { orderedHouseholds, systemChoiceMatters, isLiveStream, parseDuration, positionNow } from '../../frontend/src/lib/format.js'
import { useSleepTimer } from '../../frontend/src/lib/useSleepTimer.js'
import AboutSonora from '../../frontend/src/components/AboutSonora.jsx'
import { useShellSelection } from '../../frontend/src/lib/shellSelection.js'
import { isTyping, isCommand, keyOf, shuffleToggled, repeatCycled } from '../../frontend/src/lib/keys.js'
import { useThemeLanding } from '../../frontend/src/lib/theme.jsx'
import logo from '../../frontend/src/assets/sonora.png'
import * as G from './glyphs.jsx'
import * as L from './legends.jsx'
import { Key, Cluster, Led, Lcd, Fader, KnobSwitch, SlideSwitch, DriveLamp, FloppyFace, useFloppyRead, Menu, MenuItem, MenuSep, Confirm, Ticker, TooltipLayer, cx } from './kit.jsx'
import { PROGRAM_KEY, readStored, writeStored, useServices, useLibraryPresence, useAccountChoice, useFavorites, usePlaylists, useRecent,
         useQueue, householdOf, zoneForHousehold, playItems, pauseEverything, togglePlay, canAct, groupTitle, describeFavorite, isQueueable, favoriteTarget,
         canNext, canPrevious, canSkip, isLoaded, nextTransport, searchScopesOf, useProviderMetadata, usePrefetchProviders } from './house.js'
import { PlayerProgram, NowLcd, Volumes, RatingGlyph, useModes, useProgress, hms } from './Player.jsx'
import { useOptimisticRatings } from '../../frontend/src/lib/optimisticRatings.js'
import { ratingGlyph } from '../../frontend/src/lib/ratingGlyph.js'
import { QueueProgram } from './Queue.jsx'
import Library, { AddToPlaylistWindow, AddRadioWindow } from './Library.jsx'
import RoomsProgram, { RoomSettings, GroupWindow, useJoin } from './Rooms.jsx'
import ClockProgram, { SleepWindow } from './Clock.jsx'
import SetupProgram, { LinkServiceWindow, ShortcutsWindow } from './Setup.jsx'
import InfoWindow, { ProseWindow } from './Info.jsx'
import Command from './Command.jsx'
import { usePrefs } from './prefs.js'
import { keySound, floppySound } from './sound.js'
import { lyricsSong, useLyricsOpen } from '../../frontend/src/lib/lyrics.js'
import { loadFaces } from './fonts.js'
import { useSize, rectOf, pt, viewW, viewH, zoom } from './layout.js'
import { tokens } from './tokens.js'
import './severed.css'
import thumbnail from './thumbnail.webp'
import darkThumbnail from './thumbnail-dark.webp'
import strings from './strings.js'

// Severed: the controller as a desk terminal of the late seventies, in
// molded plastic.
//
// A cathode-ray screen sits in the middle of the console, and everything the
// controller shows is drawn on it in phosphor: one program at a time --
// Player, Queue, Library, Rooms, Clock, Setup -- chosen with the row of
// function keys across the top of the keyboard deck. Along the foot of the
// screen the rooms wait in numbered bins, each showing its level; pressing
// one brings that room into view, and dragging one onto another groups them.
// Either side of the screen, keys are gathered under bracketed labels: the
// room, the play modes and the sleep timer at the left, a liquid-crystal
// display of what plays and the volume fader at the right. Under it all, the
// deck: the transport keys, cursor keys that walk the screen, and a trackball
// that scrolls it. Every key goes down under a press and sounds as it does.
//
// Narrower, the wings fold into the deck; on a phone the console becomes a
// handheld terminal, its screen above and a short deck below.

const PROGRAMS = ['player', 'queue', 'library', 'rooms', 'clock', 'setup']
const PROGRAM_GLYPHS = { player: L.Play, queue: L.Queue, library: L.Folder, rooms: L.Rooms, clock: L.Alarm, setup: L.Settings }

// The screen's scroller, which the trackball and the cursor keys move.
// The control nearest `from` in a direction: ahead of it on that axis, scored by the distance
// ahead plus twice the distance off to the side, so the one straight ahead wins over a closer
// one far across. With none, the cursor keys scroll the screen instead.
function nearest(from, list, dir) {
  const a = rectOf(from)
  // Up and down keep to the column the cursor is in, measured across the row it sits in (a radio
  // button's whole choice, a list row), so they never jump to a menu beside it.
  const band = rectOf(from.closest('label, li, tr, [role="row"], .sv-li, .sv-row') || from)
  const ax = a.left + a.width / 2
  const ay = a.top + a.height / 2
  let best = null
  let score = Infinity
  for (const el of list) {
    if (el === from || el.contains(from) || from.contains(el)) continue
    const b = rectOf(el)
    if (!b.width && !b.height) continue
    const bx = b.left + b.width / 2
    const by = b.top + b.height / 2
    let ahead
    let side
    if ((dir === 'down' || dir === 'up') && (b.right <= band.left || b.left >= band.right)) continue
    if (dir === 'down') { if (by <= ay + 2) continue; ahead = Math.max(0, b.top - a.bottom); side = Math.max(0, Math.abs(bx - ax) - (a.width + b.width) / 2) }
    else if (dir === 'up') { if (by >= ay - 2) continue; ahead = Math.max(0, a.top - b.bottom); side = Math.max(0, Math.abs(bx - ax) - (a.width + b.width) / 2) }
    else if (dir === 'right') { if (bx <= ax + 2) continue; ahead = Math.max(0, b.left - a.right); side = Math.max(0, Math.abs(by - ay) - (a.height + b.height) / 2) }
    else { if (bx >= ax - 2) continue; ahead = Math.max(0, a.left - b.right); side = Math.max(0, Math.abs(by - ay) - (a.height + b.height) / 2) }
    const s = ahead + side * 2 + (dir === 'up' || dir === 'down' ? Math.abs(bx - ax) : Math.abs(by - ay)) * 0.05
    if (s < score) { score = s; best = el }
  }
  return best
}

// What the trackball and the cursor keys scroll: the screen, or, where a program scrolls its own
// panes instead (a settings page beside its menu), the page.
function screenScroller(screen) {
  if (!screen || getComputedStyle(screen).overflowY !== 'hidden') return screen
  return screen.querySelector('.sv-setup-page') || screen
}

// What the trackball rolled sideways scrolls: the first thing on the screen wider than its room
// that scrolls across (a table too wide for it, as the log's can be), or else the screen.
function screenScrollerAcross(screen) {
  const pane = screenScroller(screen)
  if (!pane) return pane
  for (const el of pane.querySelectorAll('.sv-table-wrap')) {
    if (el.scrollWidth > el.clientWidth + 1 && el.getClientRects().length) return el
  }
  return pane
}

// The nearest ancestor that scrolls.
function scrollerOf(el) {
  for (let node = el?.parentElement; node; node = node.parentElement) {
    const style = getComputedStyle(node)
    if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) return node
  }
  return null
}

function focusables(root) {
  if (!root) return []
  return [...root.querySelectorAll('button:not(:disabled), [role="button"]:not([aria-disabled="true"]), a[href], input:not(:disabled):not([type="range"]), [tabindex="0"]')]
    .filter((el) => el.offsetParent !== null && !el.closest('[inert]'))
}

export function Shell() {
  const { zones, groups, households, connected, actions, notices, dismiss, servicesEpoch, recentEpoch, favoritesEpoch: savedEpoch, playlistsEpoch } = useSystem()
  const { t } = useI18n()
  const size = useSize()
  const compact = size === 'compact'
  const wide = size === 'wide'
  const prefs = usePrefs()
  const [program, setProgramState] = useState(() => (PROGRAMS.includes(readStored(PROGRAM_KEY)) ? readStored(PROGRAM_KEY) : 'player'))
  const setProgram = useCallback((id) => { setProgramState(id); writeStored(PROGRAM_KEY, id) }, [])
  const { activeId, activeGroup, activeZone, visibleGroups: shownGroups, visibleZones, systemFilter, chooseSystem, select } =
    useShellSelection({ byMember: true, preferAllWhenMany: true })
  // Every list of rooms puts the groups of two or more before the rooms playing alone.
  const visibleGroups = useMemo(() => [
    ...shownGroups.filter((g) => (g.members?.length || 0) > 1),
    ...shownGroups.filter((g) => (g.members?.length || 0) <= 1),
  ], [shownGroups])
  const [setupPage, setSetupPage] = useState('')
  // Chosen just now from the theme chooser: open on this theme's own theme page.
  useThemeLanding(() => { setProgram('setup'); setSetupPage('appearance') })
  const [groupWindow, setGroupWindow] = useState(null)
  const [roomSettings, setRoomSettings] = useState(null)
  const [info, setInfo] = useState(null)
  const [prose, setProse] = useState(null)
  const [command, setCommand] = useState(false)
  const [sleepOpen, setSleepOpen] = useState(false)
  const [addRadio, setAddRadio] = useState(false)
  const [linking, setLinking] = useState(null)
  const [addTo, setAddTo] = useState(null)
  const [about, setAbout] = useState(false)
  const [shortcuts, setShortcuts] = useState(false)
  const [quickMenu, setQuickMenu] = useState(null)
  const [roomMenu, setRoomMenu] = useState(null)
  const [mixer, setMixer] = useState(null)
  const [libraryRequest, setLibraryRequest] = useState(null)
  const [messages, setMessages] = useState([])
  // One line on the ticker at a time, whether Sonora's notice or the desk's own word.
  const alerts = useOneAlert([
    ...notices.map((notice) => ({ id: `n-${notice.id}`, noticeId: notice.id, dismissible: true, title: t(notice.titleKey),
                                  text: notice.detail || (notice.detailKey ? t(notice.detailKey, notice.detailParams) : '') })),
    ...messages.map((message) => ({ ...message, dismissible: true })),
  ])
  // Bumped when this theme saves or removes a favorite; savedEpoch and playlistsEpoch are the
  // store's, bumped when the speakers announce a change made anywhere (another app included).
  const [favoritesEpoch, setFavoritesEpoch] = useState(0)
  const [servicesVersion, setServicesVersion] = useState(0)
  const [queueEdited, setQueueEdited] = useState(false)
  const [scopeState, setScopeState] = useState({ scope: null, scopes: [] })
  const screenRef = useRef(null)

  // The phosphor and the covers belong on the document, where windows and menus drawn outside
  // the console can read them too.
  useEffect(() => {
    const root = document.documentElement
    root.dataset.svPhosphor = prefs.phosphor
    root.dataset.svArt = prefs.colorArt ? 'color' : 'phosphor'
    return () => { delete root.dataset.svPhosphor; delete root.dataset.svArt }
  }, [prefs.phosphor, prefs.colorArt])
  // One device pixel in CSS pixels, for the segmented bars (--sv-dpx); kept current as the window
  // moves between screens or the page is zoomed.
  useEffect(() => {
    const root = document.documentElement
    let query = null
    const update = () => {
      const ratio = window.devicePixelRatio || 1
      root.style.setProperty('--sv-dpx', `${1 / (ratio * zoom())}px`)
      query?.removeEventListener('change', update)
      query = window.matchMedia(`(resolution: ${ratio}dppx)`)
      query.addEventListener('change', update)
    }
    update()
    window.addEventListener('sonora:svzoom', update)
    return () => { query?.removeEventListener('change', update); window.removeEventListener('sonora:svzoom', update); root.style.removeProperty('--sv-dpx') }
  }, [])
  useEffect(() => { loadFaces() }, [])
  // Typing into any field on the console sounds as the keys do: a press as each key goes down,
  // a release as it comes up. A key held to repeat sounds once. A phone's on-screen keyboard
  // names no keys, so there each change to the field's text sounds a press and its release.
  useEffect(() => {
    let lastKey = 0
    const isField = (el) => el instanceof HTMLTextAreaElement || el?.isContentEditable
      || (el instanceof HTMLInputElement && /^(text|search|email|url|tel|password|number|)$/.test(el.type))
    const typed = (event) => !(event.ctrlKey || event.metaKey || event.altKey || event.isComposing) && isField(event.target)
      && (event.key.length === 1 || ['Backspace', 'Delete', 'Enter'].includes(event.key))
    const down = (event) => {
      if (event.repeat || !typed(event)) return
      lastKey = performance.now()
      keySound('down', event.key === ' ' || event.key === 'Enter' ? 1.2 : 0.85)
    }
    const up = (event) => { if (typed(event)) keySound('up', 0.85) }
    const input = (event) => {
      if (!isField(event.target) || performance.now() - lastKey < 120) return
      keySound('down', 0.85)
      setTimeout(() => keySound('up', 0.85), 70)
    }
    document.addEventListener('keydown', down, true)
    document.addEventListener('keyup', up, true)
    document.addEventListener('input', input, true)
    return () => {
      document.removeEventListener('keydown', down, true)
      document.removeEventListener('keyup', up, true)
      document.removeEventListener('input', input, true)
    }
  }, [])
  // A new program starts at the top of the screen.
  useEffect(() => { screenRef.current?.scrollTo?.({ top: 0 }) }, [program, setupPage])

  // --- the data every program shares -----------------------------------------
  const services = useServices(servicesVersion + servicesEpoch)
  const libraryByHh = useLibraryPresence(households, servicesVersion)
  const [accountChoice, pickAccount] = useAccountChoice()
  const activeHousehold = activeZone ? householdOf(households, activeZone.uuid) : null
  // Where a search can go, as the Library lists it: kept here too, so the command line offers
  // "Search in" rows whether or not the Library program has run yet.
  const searchScopes = useMemo(() => {
    const every = searchScopesOf({ households, systemFilter, zones, activeZone, servicesByHh: services.byHousehold, libraryByHh, t })
    const list = activeHousehold ? every.filter((s) => s.hh === activeHousehold.id) : every
    const rest = list.filter((s) => !s.library)
    const allLabel = activeHousehold?.generation ? t('sv.allServicesGen', { gen: activeHousehold.generation }) : t('sv.allServices')
    return rest.length > 1 ? [{ key: 'all', all: true, name: allLabel, icon: '' }, ...list] : list
  }, [households, systemFilter, zones, activeZone, activeHousehold, services.byHousehold, libraryByHh, t])
  const hzone = activeZone?.uuid || ''
  // "This browser" belongs to no system, so its favorites are those of the system the switch
  // has chosen, or of the first when it shows all, read through one of that system's rooms.
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
  const modes = useModes(activeZone)
  // Lyrics on or off: one switch for the key on the console and the button on the screen.
  const lyrics = useLyricsOpen()
  const progress = useProgress(activeZone)
  useEffect(() => { setQueueEdited(false) }, [activeZone?.uuid])

  const say = useCallback((text) => {
    if (!text) return
    const id = Date.now() + Math.random()
    setMessages((prev) => [...prev.slice(-1), { id, text }])
    setTimeout(() => setMessages((prev) => prev.filter((x) => x.id !== id)), 4500)
  }, [])

  // Where the screen was last pressed, for the filing animation to set out from.
  const lastPress = useRef(null)
  useEffect(() => {
    const press = (event) => {
      const el = event.target.closest?.('[data-item], .sv-tile, .sv-row, .sv-li, .sv-menu-item, .sv-btn, .sv-ibtn, button')
      lastPress.current = { el, x: pt(event.clientX), y: pt(event.clientY), at: Date.now() }
    }
    document.addEventListener('pointerdown', press, true)
    return () => document.removeEventListener('pointerdown', press, true)
  }, [])
  const [filing, setFiling] = useState(null)
  const file = useCallback((item) => {
    const bin = activeGroup?.coordinator || activeZone?.uuid
    if (!bin || !item) return
    const press = lastPress.current
    let from = null
    if (press && Date.now() - press.at < 4000 && press.el?.isConnected) {
      const r = rectOf(press.el)
      if (r.width && r.height) from = { x: r.left, y: r.top, w: Math.min(r.width, 320), h: Math.min(r.height, 64) }
    }
    if (!from) {
      const r = rectOf(screenRef.current || document.body)
      from = { x: r.left + r.width / 2 - 120, y: r.top + r.height / 2 - 20, w: 240, h: 40 }
    }
    // The room's number and name as they stand now (fileCtx, filled each render), and how much of
    // each temper the refinement found in what was filed: nobody can say, so it is drawn by lot.
    const { visibleGroups, groupLabel } = fileCtx.current
    const at = visibleGroups.findIndex((g) => g.coordinator === bin)
    setFiling({ id: Date.now(), bin, from, title: item.title || '', art: item.art || item.album_art || '',
                number: String(at + 1).padStart(2, '0'), room: groupLabel,
                tempers: TEMPERS.map(() => Math.round(8 + Math.random() * 92)) })
  }, [activeGroup, activeZone])
  const fileCtx = useRef({ visibleGroups: [], groupLabel: '' })
  const filed = useCallback(() => setFiling(null), [])

  // --- playing from the index and the command line --------------------------------
  // A press on a cover answers only once the source has started, and a stream can take
  // a moment to resolve; a second press on the same cover in that time is the same
  // request, not another.
  const starting = useRef(new Set())
  const playItem = useCallback(async (item, sourceId, how = 'now') => {
    if (!activeZone) return
    const key = `${activeZone.uuid}|${how}|${item.uri || item.id || item.title}`
    if (starting.current.has(key)) return
    starting.current.add(key)
    try {
      if (how === 'now' || how === 'replace') setQueueEdited(false)
      const done = await playItems(actions, [item], how, { hzone: activeZone.uuid, from: activeZone.local ? (item.hzone || '') : '' })
      if (done) {
        say(t(how === 'now' ? 'sv.playingNow' : how === 'next' ? 'sv.queuedNext' : how === 'replace' ? 'sv.replacedQueue' : 'sv.addedToQueue', { title: item.title }))
        file(item)
      }
    } finally {
      starting.current.delete(key)
    }
  }, [activeZone, actions, say, t, file])
  // A favorite is opened through the room it was read through: the room in view, or for "This
  // browser", which belongs to no system, the room its favorites were borrowed from.
  const openFavorite = useCallback((item) => {
    const via = item.hzone || readZone
    const hh = via ? householdOf(households, via) : null
    if (!via || !hh) return
    const { svc, account, kind } = favoriteTarget((services.byHousehold[hh.id] || []).filter((s) => s.id === item.service_id), item,
                                                  accountChoice[`${hh.id}:${item.service_id}`])
    setLibraryRequest({ n: Date.now(), kind: 'node',
      path: [{ id: 'FV:2', title: t('desk.browse.favorites'), item: 'root', hzone: via, hh: hh.id, gen: hh.generation, glyph: 'star' }],
      node: { id: `${item.service_id}:${item.browse_id}`, title: item.title, service: item.service_id, item: item.browse_id, hzone: via, hh: hh.id,
              gen: hh.generation, account, icon: svc?.icon || '', kind, uri: item.uri, metadata: item.metadata, art: item.art, serviceName: svc?.name || '' } })
    setProgram('library')
  }, [readZone, households, services.byHousehold, accountChoice, setProgram, t])
  const browseSource = useCallback((id) => { setLibraryRequest({ n: Date.now(), kind: 'source', id }); setProgram('library') }, [setProgram])
  const serviceNameOf = useCallback((uri, sidFallback = null) => {
    const sid = Number((/[?&]sid=(\d+)/.exec(uri || '') || [])[1]) || sidFallback
    if (!sid || !activeHousehold) return ''
    return (services.byHousehold[activeHousehold.id] || []).find((s) => s.id === sid)?.name || ''
  }, [services.byHousehold, activeHousehold])

  // --- info, and the paths out of it -------------------------------------------
  const openInfoForNow = () => { if (activeZone && isLoaded(activeZone.transport || {})) setInfo({ now: true }) }
  const openInfoForItem = (item, ctx = {}) => setInfo({ item, hzone: ctx.hzone || activeZone?.uuid, serviceName: ctx.serviceName || serviceNameOf(item.uri, item.service_id), source: ctx.source || '' })
  const infoOpen = (node) => {
    if (node.prose) { setProse({ ...node, hzone: info?.hzone || activeZone?.uuid }); return }
    // Album Info and its kind open the item's own Info & Options, as the desktop apps' do.
    if (node.info) { setProse(null); setInfo({ item: node.item, hzone: info?.hzone || activeZone?.uuid, serviceName: node.serviceName || '' }); return }
    const hh = activeHousehold?.id
    setInfo(null); setProse(null)
    setLibraryRequest({ n: Date.now(), kind: 'node', node: { ...node, hzone: info?.hzone || activeZone?.uuid, hh, gen: activeHousehold?.generation, icon: node.icon || '' } })
    setProgram('library')
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
  // Each playing room's reactions are read ahead, so choosing a room changes its reaction keys
  // with the rest of the keys that follow the room.
  usePrefetchProviders(zones, groups.map((g) => g.coordinator))

  // The system disk in FDD0. Ejected, the terminal has nothing to run: the screen goes to the
  // BIOS's complaint, the console goes dead, and every room that was playing is paused and
  // remembered. Pushed back in, the interface comes back and those rooms play on.
  const [disk, setDisk] = useState('in')
  const crashed = disk === 'out' || disk === 'inserting'
  const fddLit = useFloppyRead(program, disk)
  const crashedRef = useRef(false)
  crashedRef.current = crashed
  const resume = useRef([])
  const ejectDisk = () => {
    if (disk !== 'in') return
    floppySound('eject')
    setDisk('ejecting')
    setTimeout(() => {
      resume.current = groups.filter((g) => zones[g.coordinator]?.transport?.state === 'PLAYING' && zones[g.coordinator].transport.source !== 'tv').map((g) => g.coordinator)
      pauseEverything(actions, groups, zones)
      setDisk('out')
    }, 620)
  }
  const insertDisk = () => {
    if (disk !== 'out') return
    floppySound('insert')
    setDisk('inserting')
    setTimeout(() => {
      setDisk('in')
      for (const uuid of resume.current) actions.play(uuid)
      resume.current = []
    }, 520)
  }
  const stepRoom = (forward) => {
    if (!visibleGroups.length) return
    const index = visibleGroups.findIndex((g) => g.coordinator === activeGroup?.coordinator)
    const next = visibleGroups[(index + (forward ? 1 : visibleGroups.length - 1)) % visibleGroups.length]
    if (next) select(next.coordinator)
  }
  const volumeBy = (delta) => {
    if (!activeZone) return
    const grouped = (activeGroup?.members?.length || 1) > 1
    const level = (grouped ? activeZone.group_volume : activeZone.volume) ?? 0
    const next = Math.max(0, Math.min(100, level + delta))
    if (grouped) actions.setGroupVolume(activeZone.uuid, next)
    else actions.setVolume(activeZone.uuid, next)
  }

  // --- the console's cursor keys and trackball ---------------------------------------
  // The cursor keys walk whatever the screen shows: the topmost menu or window over it, or the
  // program under them. Each arrow moves to the nearest control in its direction; left with
  // nothing to its left goes back a level, right with nothing to its right opens what the
  // cursor is on, and the middle key presses it. The cursor is the control last focused there,
  // so pressing a key on the deck with the mouse does not lose it.
  const cursorAt = useRef(null)
  useEffect(() => {
    const seen = (event) => { if (event.target?.closest?.('.sv-crt-scroll, .sv-menu, .sv-window')) cursorAt.current = event.target }
    document.addEventListener('focusin', seen)
    return () => document.removeEventListener('focusin', seen)
  }, [])
  const cursor = (dir) => {
    const layers = [...document.querySelectorAll('.sv-menu, .sv-window')].filter((el) => el.offsetParent !== null || el.getClientRects().length)
    const scope = layers[layers.length - 1] || screenRef.current
    const list = focusables(scope)
    const active = document.activeElement
    const here = [active, cursorAt.current].find((el) => el && el.isConnected && scope?.contains(el) && list.includes(el))
    // Into a row of choices, the cursor lands on the one chosen, as Tab would.
    const go = (to) => {
      const el = to.closest('[role="radiogroup"]')?.querySelector('[aria-checked="true"]') || to
      el.focus({ preventScroll: true })
      el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
    }
    if (!here) {
      if (dir === 'left' && !layers.length) { back(); return }
      const view = rectOf(scope)
      const shown = list.filter((el) => { const r = rectOf(el); return view && r.bottom > view.top && r.top < view.bottom })
      const pick = dir === 'up' ? (shown[shown.length - 1] || list[list.length - 1]) : (shown[0] || list[0])
      if (pick) go(pick)
      return
    }
    if (dir === 'enter') { here.click(); return }
    const next = nearest(here, list, dir)
    // A control out of sight below or above is scrolled toward a step at a time rather than jumped
    // to, so what lies between, a table with nothing to press in it, is read on the way.
    if (next && (dir === 'up' || dir === 'down')) {
      const pane = scrollerOf(here)
      const view = rectOf(pane)
      const r = rectOf(next)
      if (view && (dir === 'down' ? r.top > view.bottom : r.bottom < view.top)) {
        pane.scrollBy({ top: dir === 'down' ? 120 : -120 })
        return
      }
    }
    if (next) { go(next); return }
    if (dir === 'left' && !layers.length) back()
    else if (dir === 'right') here.click()
    else if (dir === 'up' || dir === 'down') screenScroller(screenRef.current)?.scrollBy?.({ top: dir === 'down' ? 80 : -80 })
  }
  // The deck's Esc: what the real key does where the focus is, closing the window or menu on top;
  // with nothing over the screen, back a level (the keyboard handler below does that part).
  const escape = () => {
    const layers = [...document.querySelectorAll('.sv-menu, .sv-window')].filter((el) => el.getClientRects().length)
    const target = document.activeElement && document.activeElement !== document.body ? document.activeElement : (layers[layers.length - 1] || document.body)
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }))
  }
  const back = () => {
    if (program === 'library') window.dispatchEvent(new Event('sonora:svback'))
    else if (program === 'setup' && compact) setSetupPage('')
  }

  // The real keyboard's arrows and Enter do what the deck's do, and the deck's keys go down with
  // them. Where the focus is on something that takes the arrows itself, a field, a slider, a
  // menu, or the system knob, or Enter on a control that Enter already presses, the key is left
  // to it, and only the deck's key moves.
  const [heldKeys, setHeldKeys] = useState(() => new Set())
  const cursorRef = useRef(cursor)
  cursorRef.current = cursor
  const backRef = useRef(back)
  backRef.current = back
  useEffect(() => {
    const DIRS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'enter', Escape: 'escape' }
    const hold = (dir, on) => setHeldKeys((prev) => {
      if (prev.has(dir) === on) return prev
      const next = new Set(prev)
      if (on) next.add(dir); else next.delete(dir)
      return next
    })
    const down = (event) => {
      const dir = DIRS[event.key]
      if (!dir) return
      // Esc with nothing open over the screen backs out of whatever has been dug into: a folder
      // in the library, or a settings page on a phone. Over a window or menu it closes that.
      if (dir === 'escape' && !event.defaultPrevented && !isTyping(event)
          && ![...document.querySelectorAll('.sv-menu, .sv-window')].some((el) => el.getClientRects().length)) backRef.current()
      // The deck's own Esc sends a key event of its own; only the real key moves the deck's key.
      if (!event.isTrusted) return
      if (!event.repeat) {
        hold(dir, true)
        if (!isTyping(event)) keySound('down', dir === 'enter' ? 0.9 : 0.6)
      }
      if (dir === 'escape' || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target
      // A one-line field has no use for up and down, so those leave it; everything else typed stays.
      const line = target?.matches?.('input:not([type]), input[type="text"], input[type="search"]') && !target.getAttribute('aria-expanded')
      const choice = target?.matches?.('input[type="radio"], input[type="checkbox"]')
      if (!(line && (dir === 'up' || dir === 'down'))) {
        if (isTyping(event) && !choice) return
        // Radio buttons and checkboxes are walked past like any control, so a list of choices
        // does not hold the cursor; Enter picks one.
        if (target?.closest?.('input:not([type="radio"]):not([type="checkbox"]), select, textarea, [role="menu"], [role="listbox"], [role="slider"]')) return
        // A row of choices (the S1 and S2 switch, tabs) keeps left and right; up and down leave it.
        if ((dir === 'left' || dir === 'right') && target?.closest?.('[role="radiogroup"], [role="tablist"]')) return
      }
      if (dir === 'enter' && target?.closest?.('button, a[href], [role="button"], [role="option"], [role="menuitem"]')) return
      event.preventDefault()
      cursorRef.current(dir)
    }
    const up = (event) => {
      const dir = DIRS[event.key]
      if (!dir) return
      hold(dir, false)
      if (!isTyping(event)) keySound('up', dir === 'enter' ? 0.9 : 0.6)
    }
    const clear = () => setHeldKeys(new Set())
    document.addEventListener('keydown', down)
    document.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    return () => {
      document.removeEventListener('keydown', down)
      document.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
    }
  }, [])

  // --- keyboard ---------------------------------------------------------------------
  // A program chosen from the keyboard presses its key on the deck, with its sound, until the
  // key that chose it comes up.
  const [heldProgram, setHeldProgram] = useState(null)
  const programPress = useRef(null)
  const pressProgram = (id, event) => {
    setProgram(id)
    if (event.repeat || !event.isTrusted) return
    programPress.current = event.code
    setHeldProgram(id)
    keySound('down', 1)
  }
  useEffect(() => {
    const up = (event) => {
      if (!programPress.current || event.code !== programPress.current) return
      programPress.current = null
      setHeldProgram(null)
      keySound('up', 1)
    }
    const clear = () => { programPress.current = null; setHeldProgram(null) }
    document.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    return () => { document.removeEventListener('keyup', up); window.removeEventListener('blur', clear) }
  }, [])
  const anyLayer = groupWindow || roomSettings || info || prose || command || sleepOpen || addRadio || linking || addTo || about || shortcuts
  useEffect(() => {
    const onKey = (event) => {
      if (crashedRef.current) return
      const typing = isTyping(event)
      const cmd = isCommand(event)
      const key = keyOf(event)
      if (cmd && key === 'k') { event.preventDefault(); setCommand((v) => !v); return }
      if (cmd && key === 'f') { event.preventDefault(); pressProgram('library', event); setLibraryRequest({ n: Date.now(), kind: 'focus' }); return }
      if (cmd && key === 'g') { event.preventDefault(); pressProgram('queue', event); return }
      if (cmd && key === 'j') { event.preventDefault(); pressProgram('player', event); return }
      if (cmd && (key === '*' || (event.shiftKey && key === '8'))) { event.preventDefault(); browseSource('FV:2'); return }
      if (cmd && event.shiftKey && key === 'x') { event.preventDefault(); if (activeZone) actions.setCrossfade(activeZone.uuid, !activeZone.transport?.crossfade); return }
      if (typing || anyLayer) return
      if (event.key === '?') { event.preventDefault(); setShortcuts(true); return }
      // The program keys answer to the digits alone, as a terminal's function keys would.
      if (!cmd && !event.altKey && /^[1-6]$/.test(event.key)) { event.preventDefault(); pressProgram(PROGRAMS[Number(event.key) - 1], event); return }
      if (!activeZone) return
      const mode = activeZone.transport?.play_mode || 'NORMAL'
      // Space plays and pauses unless a key or button has the focus, which Space presses instead.
      const onControl = event.target?.closest?.('button, [role="button"], [role="option"], label')
      if ((event.key === ' ' && !onControl) || (cmd && key === 'p')) { event.preventDefault(); togglePlay(actions, activeZone) }
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
        stepRoom(event.key === '.' || event.key === ']')
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }) // re-bound each render: it reads the room in view, the groups and the open layers

  // --- the command line's actions ------------------------------------------------------
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
    else if (id === 'queue') setProgram('queue')
    else if (id === 'player') setProgram('player')
    else if (id === 'group') setGroupWindow(activeGroup)
    else if (id === 'party') partyMode()
    else if (id === 'sleepoff') sleep.set(null)
    else if (id.startsWith('sleep:')) sleep.set(Number(id.slice(6)))
    else if (id === 'clock') setProgram('clock')
    else if (id === 'settings') setProgram('setup')
    else if (id === 'shortcuts') setShortcuts(true)
  }

  const ordered = orderedHouseholds(households)
  const groupLabel = activeGroup ? groupTitle(activeGroup, zones, t) : ''
  const grouped = (activeGroup?.members?.length || 1) > 1
  const tr = activeZone?.transport || {}
  const hasLyrics = Boolean(lyricsSong(tr))
  const what = nextTransport(tr)
  const level = activeZone ? ((grouped ? activeZone.group_volume : activeZone.volume) ?? 0) : 0
  const muted = activeZone ? (grouped ? activeZone.group_muted : activeZone.muted) : false
  const setLevel = (next) => { if (!activeZone) return; if (grouped) actions.setGroupVolume(activeZone.uuid, next); else actions.setVolume(activeZone.uuid, next) }
  fileCtx.current = { visibleGroups, groupLabel }
  const common = { households, zones, activeZone, activeGroup, systemFilter, onSystem: chooseSystem, onMessage: say, compact }

  // --- the program on the screen ------------------------------------------------------
  const page = program === 'player' ? (
    <PlayerProgram zone={activeZone} group={activeGroup} zones={zones} queue={queue} compact={compact} lyrics={lyrics} keys={{ modes: wide, sleep: wide, group: !compact, info: !compact, sound: !compact }}
                   onInfo={openInfoForNow} onMessage={say} onGroup={() => activeGroup && setGroupWindow(activeGroup)}
                   onSleep={() => setSleepOpen(true)} sleepOn={Boolean(sleep.remaining)} onQueue={() => setProgram('queue')} onRoomSettings={setRoomSettings} />
  ) : program === 'queue' ? (
    <QueueProgram zone={activeZone} queue={queue} onMessage={say} onEdited={() => setQueueEdited(true)}
                  onInfo={(item) => openInfoForItem(item, { hzone: activeZone?.uuid })} />
  ) : program === 'library' ? (
    <Library {...common} roomGroups={visibleGroups} onSelectRoom={select} roomChosen={Boolean(activeId)}
             servicesByHh={services.byHousehold} servicesRaw={services.raw} libraryByHh={libraryByHh} accountChoice={accountChoice} pickAccount={pickAccount}
             request={libraryRequest} onInfo={openInfoForItem} onLinkService={setLinking} onAddRadio={() => setAddRadio(true)}
             favoritesEpoch={favoritesEpoch} onFavoritesChanged={() => setFavoritesEpoch((v) => v + 1)} servicesVersion={servicesVersion + servicesEpoch}
             queueEdited={queueEdited} onQueueReplaced={() => setQueueEdited(false)} onScopeChange={(scope, scopes) => setScopeState({ scope, scopes })}
             favorites={favorites} playlists={playlists} recent={recent} onPlayItem={playItem} onOpenFavorite={openFavorite} onPlayed={file}
             onItemMenu={(item, sourceId, event) => setQuickMenu({ item, sourceId, x: pt(event.clientX), y: pt(event.clientY) })} />
  ) : program === 'rooms' ? (
    <RoomsProgram {...common} groups={visibleGroups} activeId={activeGroup?.coordinator} onSelect={select}
                  onGroup={setGroupWindow} onRoomSettings={setRoomSettings} onPlayer={() => setProgram('player')}
                  onPauseAll={() => pauseEverything(actions, groups, zones)} pauseDisabled={!anyPlaying}
                  onParty={partyMode} partyDisabled={!activeZone || activeZone.local || (activeHousehold?.zone_uuids?.length || 0) < 2} />
  ) : program === 'clock' ? (
    <ClockProgram {...common} />
  ) : (
    <SetupProgram {...common} page={setupPage} setPage={setSetupPage} onLinkService={setLinking}
                  servicesVersion={servicesVersion + servicesEpoch} onServicesChanged={() => setServicesVersion((v) => v + 1)}
                  onAbout={() => setAbout(true)} onShortcuts={() => setShortcuts(true)} />
  )

  // --- the console's parts ------------------------------------------------------------
  const programKeys = PROGRAMS.map((id, i) => {
    const Glyph = PROGRAM_GLYPHS[id]
    return (
      <Key key={id} tone="teal" size={compact ? 's' : 'm'} className="sv-fkey" legend={t(`sv.prog.${id}`)} sub={compact ? '' : String(i + 1)}
           glyph={<Glyph size={compact ? 14 : 20} />} lit={program === id} pressed={program === id} held={heldProgram === id}
           label={`${t(`sv.prog.${id}`)} (${i + 1})`} lamp={id === 'queue' ? { tone: 'amber', on: Boolean(queue.total || queue.items.length) } : null}
           onPress={() => setProgram(id)} />
    )
  })
  // Thirty seconds back or on, read against the position at the moment the key goes down, as the
  // screen's own -30 and +30 do; a track that cannot be skipped through leaves the keys out.
  const trLength = isLiveStream(tr.track_duration, tr.media_uri) ? 0 : parseDuration(tr.track_duration)
  const skippable = Boolean(activeZone && trLength) && tr.can_seek !== false && canSkip(tr)
  const skipBy = (delta) => {
    const at = Math.floor(positionNow(tr, { exact: true }))
    actions.seek(activeZone.uuid, hms(Math.max(0, Math.min(trLength, at + delta))))
  }
  const transportKeys = (
    <div className="sv-transport" role="group" aria-label={t('desk.now.title')}>
      <Key absent={!skippable} tone="navy" size="s" legend="−30" label={t('desk.transport.back30')} onPress={() => skipBy(-30)} />
      {<Key absent={!canPrevious(tr)} tone="navy" size="l" glyph={<L.Prev size={24} />} label={t('common.previous')} onPress={() => actions.previous(activeZone.uuid)} />}
      {(
        <Key absent={!activeZone || !isLoaded(tr) || !canAct(tr)} tone="navy" size="bar" className="sv-key-play" glyph={<L.PlayWhat what={what} size={24} />}
             legend={what === 'play' ? t('common.play') : what === 'stop' ? t('common.stop') : t('common.pause')}
             label={what === 'play' ? t('common.play') : what === 'stop' ? t('common.stop') : t('common.pause')}
             onPress={() => togglePlay(actions, activeZone)} />
      )}
      {<Key absent={!canNext(tr)} tone="navy" size="l" glyph={<L.Next size={24} />} label={t('common.next')} onPress={() => actions.next(activeZone.uuid)} />}
      <Key absent={!skippable} tone="navy" size="s" legend="+30" label={t('desk.transport.forward30')} onPress={() => skipBy(30)} />
    </div>
  )
  const volumeCluster = (
    <Cluster label={grouped ? t('desk.transport.groupVolume') : t('sv.volume')} className={activeZone ? 'sv-volume' : 'sv-volume sv-volume-off'}>
      <Fader value={level} label={grouped ? t('desk.transport.groupVolume') : (activeZone?.name || t('sv.volume'))} onCommit={setLevel} disabled={!activeZone} lamp={tr.state === 'PLAYING'} />
      <div className="sv-volume-keys">
        <Key absent={!activeZone} size="s" glyph={<L.Minus size={14} />} label={t('desk.shortcuts.volDown')} onPress={() => volumeBy(-2)} />
        <Key absent={!activeZone} size="s" glyph={<L.Plus size={14} />} label={t('desk.shortcuts.volUp')} onPress={() => volumeBy(2)} />
        <Key absent={!activeZone} size="m" tone="coral" legend={t('sv.muteKey')} lit={Boolean(muted)} pressed={Boolean(muted)} label={muted ? t('common.unmute') : t('common.mute')}
             onPress={() => actions.setMute(activeZone.uuid, !muted, grouped)} />
        <Key absent={!activeZone} size="m" tone="sage" legend={t('sv.mixKey')} label={t('sv.mixer')}
             onPress={(event) => setMixer(mixer ? null : event.currentTarget)} />
      </div>
    </Cluster>
  )
  const roomCluster = (
    <Cluster label={t('sv.roomKeys')} className="sv-roomkeys">
      {<Key absent={visibleGroups.length < 2} size="s" glyph={<L.Left size={14} />} label={t('desk.shortcuts.prevZone')} onPress={() => stepRoom(false)} />}
      {<Key absent={visibleGroups.length < 2} size="s" glyph={<L.Right size={14} />} label={t('desk.shortcuts.nextZone')} onPress={() => stepRoom(true)} />}
      {(
        <Key absent={!activeGroup || activeGroup.local} size="s" tone="sage" glyph={<L.Group size={14} />} label={t('desk.grouping.title')} onPress={() => setGroupWindow(activeGroup)} />
      )}
      {/* The room's sound and settings, the window the player's own button opens. */}
      <Key absent={!activeZone || activeZone.local} size="s" tone="sage" glyph={<L.Speaker size={14} />} label={t('sv.soundAndRoom')} onPress={() => setRoomSettings(activeZone.uuid)} />
    </Cluster>
  )
  const modeCluster = (
    <Cluster label={t('sv.modeKeys')} className="sv-modekeys">
      {<Key absent={!modes.canShuffle} size="s" glyph={<L.Shuffle size={14} />} lit={modes.shuffled} pressed={modes.shuffled} label={t('common.shuffle')} onPress={modes.toggleShuffle} />}
      {(
        <Key absent={!modes.canRepeat} size="s" glyph={modes.repeat === 'one' ? <L.RepeatOne size={14} /> : <L.Repeat size={14} />} lit={modes.repeat !== 'off'} pressed={modes.repeat !== 'off'}
             label={modes.repeat === 'one' ? t('desk.transport.repeatOne') : modes.repeat === 'all' ? t('desk.transport.repeatAll') : t('desk.transport.repeatOff')}
             onPress={modes.cycleRepeat} />
      )}
      {<Key absent={!modes.canCrossfade} size="s" glyph={<L.Crossfade size={14} />} lit={modes.crossfade} pressed={modes.crossfade} label={t('desk.transport.crossfade')} onPress={modes.toggleCrossfade} />}
      {<Key absent={!hasLyrics} size="s" glyph={<L.Lyrics size={14} />} lit={lyrics[0]} pressed={lyrics[0]} label={t('lyrics.show')} onPress={lyrics[1]} />}
    </Cluster>
  )
  const systemOptions = [...ordered.map((h) => ({ id: h.id, label: h.generation })), { id: 'all', label: t('sv.all') }]
  const systemSwitch = systemChoiceMatters(households) && (
    <div className="sv-systemswitch">
      <span className="sv-print">{t('sv.systemKeys')}</span>
      {!wide
        ? <SlideSwitch label={t('desk.showSystem')} value={systemFilter || 'all'} onChange={chooseSystem} options={systemOptions} />
        : <KnobSwitch label={t('desk.showSystem')} value={systemFilter || 'all'} onChange={chooseSystem} options={systemOptions} broad={wide} />}
    </div>
  )

  return (
    <div className={cx('sv-root', `sv-size-${size}`)} data-program={program} data-connected={connected || undefined}>
      <header className="sv-head">
        <span className="sv-brand-rule" aria-hidden="true" />
        <button type="button" className="sv-brand" onClick={() => setAbout(true)} title={t('about.menu')}>
          <span className="sv-brand-name">Sonora</span>
          <span className="sv-brand-model">{t('sv.model')}</span>
        </button>
        <span className="sv-head-end">
          <span className="sv-brand-rule" aria-hidden="true" />
          {!wide && systemSwitch}
          <span className="sv-power" title={connected ? t('net.live') : t('common.reconnecting')}>
            <Led on={connected} tone={connected ? 'green' : 'amber'} blink={!connected} />
            <span className="sv-print">{connected ? t('sv.online') : t('sv.offline')}</span>
          </span>
        </span>
      </header>


      <section className="sv-monitor" aria-label={t('sv.screen')}>
        <div className="sv-bezel">
          {/* The drive lamps, set into the case beside the screen where the bay cannot show them:
              the system floppy's above the hard drive's, each with its name printed above it. */}
          <div className="sv-edgelamps" aria-hidden="true">
            <span className="sv-drive"><span className="sv-drive-lamp" data-on={fddLit || undefined} /><span className="sv-drive-label">FDD0</span></span>
            <DriveLamp label={t('sv.driveLamp')} quiet={wide} playing={anyPlaying} />
          </div>
          <div className="sv-crt">
            <div className="sv-crt-glass" aria-hidden="true" />
            {crashed ? <Crash /> : <>
            <header className="sv-crt-head">
              <span className="sv-crt-room">{activeZone ? groupLabel : t('desk.browse.selectRoom')}</span>
              <span className="sv-crt-program">{t(`sv.prog.${program}`)}</span>
              <span className="sv-crt-complete">{t('sv.complete', { pct: progress ?? 0 })}</span>
              <button type="button" className="sv-crt-mark" onClick={() => setAbout(true)} title={t('about.menu')} aria-label={t('about.menu')}>
                <i className="sv-crt-logo" aria-hidden="true" style={{ '--sv-logo': `url(${logo})` }} />Sonora
              </button>
            </header>
            <Ticker onDismiss={(item) => (item.noticeId ? dismiss(item.noticeId) : setMessages((prev) => prev.filter((x) => x.id !== item.id)))} items={[
              ...(!connected ? [{ id: 'offline', kind: 'warn', text: t('common.reconnecting') }] : []),
              ...alerts,
            ]} />
            <div className="sv-crt-scroll" ref={screenRef}>
              <main className="sv-program" key={program}>{page}</main>
            </div>
            <Bins groups={visibleGroups} zones={zones} activeId={activeGroup?.coordinator} onSelect={select} onMessage={say}
                  onMenu={(group, event) => setRoomMenu({ group, x: pt(event.clientX), y: pt(event.clientY) })} t={t} />
            </>}
          </div>
        </div>
      </section>

      {wide && (
        <aside className="sv-wing sv-wing-right">
          {/* The one panel, beside the screen on the right: the display and the volume, the speaker
              grille, the room, playback, and reaction keys under them, and the drive bay at its foot. */}
          <Lcd className="sv-lcd-big" label={t('desk.now.title')}><NowLcd zone={activeZone} group={activeGroup} zones={zones} /></Lcd>
          {volumeCluster}
          <SpeakerGrille />
          {roomCluster}
          {modeCluster}
          <ReactionCluster zone={activeZone} t={t} onMessage={say} />
          <div className="sv-bay">
            <FloppyFace label="FDD0" lit={fddLit} disk={disk} onEject={ejectDisk} onInsert={insertDisk} ejectLabel={t('sv.eject')} insertLabel={t('sv.insertDisk')} />
            <FloppyFace label="FDD1" empty />
            <DriveLamp label={t('sv.driveLamp')} playing={anyPlaying} />
          </div>
        </aside>
      )}

      <footer className="sv-deck" aria-label={t('sv.keyboard')} inert={crashed || undefined}>
        <div className="sv-fnrow">
          <div className="sv-programs" role="group" aria-label={t('sv.programs')}>{programKeys}</div>
          {!compact && (
            <div className="sv-tools">
              <Key tone="navy" className="sv-fkey" legend={t('sv.findKey')} sub="K" glyph={<L.Search size={20} />} label={`${t('common.search')} (Ctrl K)`} onPress={() => setCommand(true)} />
              <Key absent={!activeZone || !isLoaded(tr)} tone="navy" className="sv-fkey" legend={t('sv.infoKey')} glyph={<L.Info size={20} />} label={t('desk.now.infoOptions')} onPress={openInfoForNow} />
            </div>
          )}
        </div>
        {!compact && <DeckEdge />}
        <div className="sv-deck-main">
          {wide && systemSwitch}
          {!wide && !compact && <div className="sv-deck-pair">{volumeCluster}{roomCluster}</div>}
          {transportKeys}
          {compact && volumeCluster}
          {!compact && <CursorKeys onCursor={cursor} onEscape={escape} held={heldKeys} t={t} />}
        </div>
        {!compact && <Trackball target={screenRef} t={t} off={crashed} />}
      </footer>

      {mixer && activeZone && (
        <Menu anchor={mixer} align="right" width={360} onClose={() => setMixer(null)} title={groupLabel}>
          <div className="sv-menu-pad"><Volumes zone={activeZone} group={activeGroup} zones={zones} /></div>
        </Menu>
      )}
      {roomMenu && (() => {
        const { group } = roomMenu
        const zone = zones[group.coordinator]
        if (!zone) return null
        const next = nextTransport(zone.transport || {})
        const name = group.members.length > 1 ? t('desk.rooms.menu.group') : zone.name
        return (
          <Menu x={roomMenu.x} y={roomMenu.y} onClose={() => setRoomMenu(null)} title={groupTitle(group, zones, t)}>
            {isLoaded(zone.transport || {}) && canAct(zone.transport) && (
              <MenuItem icon={<G.PlayWhat what={next} size={12} />} onSelect={() => { setRoomMenu(null); togglePlay(actions, zone) }}>
                {t(next === 'play' ? 'desk.rooms.menu.play' : next === 'stop' ? 'desk.rooms.menu.stop' : 'desk.rooms.menu.pause', { name })}
              </MenuItem>
            )}
            <MenuItem icon={zone.group_muted ? <G.Volume size={12} /> : <G.Muted size={12} />} onSelect={() => { setRoomMenu(null); actions.setMute(zone.uuid, !zone.group_muted, true) }}>
              {t(zone.group_muted ? 'desk.rooms.menu.unmute' : 'desk.rooms.menu.mute', { name })}
            </MenuItem>
            <MenuSep />
            {!group.local && <MenuItem icon={<G.Group size={12} />} onSelect={() => { setRoomMenu(null); setGroupWindow(group) }}>{t('desk.grouping.title')}</MenuItem>}
            <MenuItem icon={<G.Moon size={12} />} onSelect={() => { setRoomMenu(null); select(group.coordinator); setSleepOpen(true) }}>{t('desk.browse.sleepTimer')}</MenuItem>
            <MenuSep />
            {group.members.map((uuid) => zones[uuid]).filter((m) => m && !m.local).map((m) => (
              <MenuItem key={m.uuid} icon={<G.Settings size={12} />} onSelect={() => { setRoomMenu(null); setRoomSettings(m.uuid) }}>{t('desk.rooms.menu.eq', { name: m.name })}</MenuItem>
            ))}
          </Menu>
        )
      })()}
      {groupWindow && <GroupWindow group={groups.find((g) => g.id === groupWindow.id) || groupWindow} zones={zones} households={households} onClose={() => setGroupWindow(null)} />}
      {roomSettings && <RoomSettings uuid={roomSettings} households={households} onClose={() => setRoomSettings(null)} />}
      {info && !prose && (
        <InfoWindow zone={info.now ? activeZone : null} item={info.now ? null : info.item} hzone={info.now ? activeZone?.uuid : info.hzone}
                    serviceName={info.now ? (activeZone?.transport?.service_name || serviceNameOf(activeZone?.transport?.media_uri, activeZone?.transport?.service_id)) : info.serviceName}
                    onClose={() => setInfo(null)} onMessage={say} onOpen={infoOpen} onFavoritesChanged={() => setFavoritesEpoch((v) => v + 1)}
                    onAddToPlaylist={(pick, source) => setAddTo({ picks: [pick], source: source || info.source || '', hzone: info.now ? activeZone?.uuid : info.hzone })}
                    services={Object.values(services.byHousehold || {}).flat()} />
      )}
      {prose && <ProseWindow node={prose} onClose={() => { setProse(null); setInfo(null) }} onBack={() => setProse(null)} />}
      {addTo && <AddToPlaylistWindow picks={addTo.picks} source={addTo.source} hzone={addTo.hzone} onClose={() => setAddTo(null)} onMessage={say} />}
      {sleepOpen && <SleepWindow zone={activeZone} groupLabel={groupLabel} onClose={() => setSleepOpen(false)} />}
      {addRadio && <AddRadioWindow zone={activeZone} onClose={() => setAddRadio(false)} onAdded={(r) => say(t(r.exists ? 'desk.radio.exists' : 'desk.radio.added', { title: r.title }))} />}
      {linking && <LinkServiceWindow households={households} preset={linking} onClose={() => setLinking(null)} onLinked={() => setServicesVersion((v) => v + 1)} />}
      {command && (
        <Command onClose={() => setCommand(false)} groups={visibleGroups} zones={zones} activeZone={activeZone} favorites={favorites} playlists={playlists}
                 scopes={searchScopes} onSelectRoom={select} onAction={runAction} onPlayItem={playItem} compact={compact}
                 onSearch={(term, scope) => { setLibraryRequest({ n: Date.now(), kind: 'search', term, scope }); setProgram('library') }}
                 onOpenSource={(scope) => browseSource(`svc:${scope.id}`)} />
      )}
      {about && <AboutSonora onClose={() => setAbout(false)} />}
      {shortcuts && <ShortcutsWindow onClose={() => setShortcuts(false)} />}
      {quickMenu && (
        <Menu x={quickMenu.x} y={quickMenu.y} onClose={() => setQuickMenu(null)} title={quickMenu.item.title}>
          <MenuItem icon={<G.Play size={12} />} onSelect={() => { setQuickMenu(null); playItem(quickMenu.item, quickMenu.sourceId, 'now') }}>{t('desk.actions.playNow')}</MenuItem>
          {isQueueable(quickMenu.item) && (
            <>
              <MenuItem icon={<G.Next size={12} />} onSelect={() => { setQuickMenu(null); playItem(quickMenu.item, quickMenu.sourceId, 'next') }}>{t('desk.actions.playNext')}</MenuItem>
              <MenuItem icon={<G.Queue size={12} />} onSelect={() => { setQuickMenu(null); playItem(quickMenu.item, quickMenu.sourceId, 'add') }}>{t('desk.actions.addToQueue')}</MenuItem>
              <MenuItem icon={<G.Refresh size={12} />} onSelect={() => { setQuickMenu(null); playItem(quickMenu.item, quickMenu.sourceId, 'replace') }}>{t('desk.actions.replaceQueue')}</MenuItem>
            </>
          )}
          <MenuSep />
          {quickMenu.item.browse_id && quickMenu.item.service_id && (
            <MenuItem icon={<G.Chevron size={12} />} onSelect={() => { setQuickMenu(null); openFavorite(quickMenu.item) }}>{t('sv.open')}</MenuItem>
          )}
          {quickMenu.sourceId && quickMenu.sourceId !== 'recent' && (
            <MenuItem icon={<G.Folder size={12} />} onSelect={() => { setQuickMenu(null); browseSource(quickMenu.sourceId) }}>{t('sv.showInLibrary')}</MenuItem>
          )}
          {quickMenu.item.uri && (
            <MenuItem icon={<G.Info size={12} />} onSelect={() => { setQuickMenu(null); openInfoForItem({ ...quickMenu.item, favoriteDescription: describeFavorite(quickMenu.item, serviceNameOf(quickMenu.item.uri, quickMenu.item.service_id)) }, { hzone: activeZone?.uuid, source: quickMenu.sourceId }) }}>{t('desk.now.infoOptions')}</MenuItem>
          )}
        </Menu>
      )}
      <TooltipLayer />
      {filing && <Filing key={filing.id} job={filing} onDone={filed} />}
    </div>
  )
}

// The rooms along the foot of the screen, each a numbered bin with its level. A bin dragged
// onto another groups the two.
function Bins({ groups, zones, activeId, onSelect, onMenu, onMessage, t }) {
  const [dragging, setDragging] = useState(null)
  const [over, setOver] = useState(null)
  const join = useJoin(groups, onSelect, onMessage)
  const strip = useRef(null)
  // The room in view is kept in sight along the strip. The strip alone is scrolled: asked to
  // scroll a bin into view, the browser also moved the console's clipped boxes and the whole
  // screen slid sideways.
  useEffect(() => {
    const bar = strip.current
    const bin = bar?.querySelector('[aria-pressed="true"]')
    if (!bar || !bin) return
    const start = bin.offsetLeft
    const end = start + bin.offsetWidth
    if (start < bar.scrollLeft) bar.scrollTo({ left: start - 4, behavior: 'smooth' })
    else if (end > bar.scrollLeft + bar.clientWidth) bar.scrollTo({ left: end - bar.clientWidth + 4, behavior: 'smooth' })
  }, [activeId])
  // When there are more rooms than the strip shows, a wheel turned over it runs along them. A strip
  // that fits leaves the wheel to the page.
  useEffect(() => {
    const bar = strip.current
    if (!bar) return undefined
    const wheel = (event) => {
      if (bar.scrollWidth <= bar.clientWidth + 1) return
      const along = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
      if (!along) return
      event.preventDefault()
      const step = event.deltaMode === 1 ? along * 40 : event.deltaMode === 2 ? along * bar.clientWidth : along
      bar.scrollBy({ left: step })
    }
    bar.addEventListener('wheel', wheel, { passive: false })
    return () => bar.removeEventListener('wheel', wheel)
  }, [])
  return (
    <nav className="sv-binsbar" aria-label={t('desk.rooms.title')} ref={strip}>
      {groups.map((g, i) => {
        const zone = zones[g.coordinator]
        if (!zone) return null
        const many = g.members.length > 1
        const level = (many ? zone.group_volume : zone.volume) ?? 0
        const muted = many ? zone.group_muted : zone.muted
        const playing = zone.transport?.state === 'PLAYING' || zone.transport?.state === 'TRANSITIONING'
        return (
          <button key={g.id} type="button" className="sv-binbtn" data-bin={g.coordinator} aria-pressed={g.coordinator === activeId} data-playing={playing || undefined}
                  data-over={over === g.coordinator || undefined} data-muted={muted || undefined}
                  title={groupTitle(g, zones, t)} draggable={!g.local}
                  onClick={() => onSelect(g.coordinator)}
                  onContextMenu={(event) => { event.preventDefault(); onMenu(g, event) }}
                  onDragStart={(event) => { event.dataTransfer.setData('text/plain', g.coordinator); event.dataTransfer.effectAllowed = 'move'; setDragging(g.coordinator) }}
                  onDragEnd={() => { setDragging(null); setOver(null) }}
                  onDragOver={(event) => { if (dragging && dragging !== g.coordinator) { event.preventDefault(); setOver(g.coordinator) } }}
                  onDragLeave={() => setOver(null)}
                  onDrop={(event) => { event.preventDefault(); const from = dragging; setDragging(null); setOver(null); join(from, g.coordinator) }}>
            <span className="sv-binbtn-top">
              <span className="sv-binbtn-n">{String(i + 1).padStart(2, '0')}</span>
              <span className="sv-binbtn-name">{groupTitle(g, zones, t)}</span>
              {playing && <G.Play size={12} className="sv-binbtn-on" />}
            </span>
            <span className="sv-binbtn-meter" style={{ '--sv-pct': muted ? 0 : level }} aria-hidden="true" />
            <span className="sv-binbtn-pct">{muted ? t('sv.muted') : `${level}%`}</span>
          </button>
        )
      })}
    </nav>
  )
}

// The speaker grille: holes punched in an oval of the plastic on an 11px grid, every one whole. A hole
// is punched only where all of it falls inside the oval, so none is cut by the edge; each is darkest
// near the middle, where the cone sits right behind it, and paler toward the rim.
const GRILLE = { w: 200, h: 89, pitch: 11, r: 2.4, rows: 7 }
const GRILLE_HOLES = (() => {
  const { w, h, pitch, r, rows } = GRILLE
  const a = w / 2, b = h / 2
  const holes = []
  for (let row = 0; row < rows; row += 1) {
    const y = (row - (rows - 1) / 2) * pitch
    // Alternate rows sit half a pitch over, as punched sheet is laid out.
    const shift = (row % 2) * (pitch / 2)
    for (let x = -Math.floor(a / pitch) * pitch - shift; x <= a; x += pitch) {
      // Whole inside: the hole's centre lies inside the oval shrunk by its radius.
      if ((x / (a - r)) ** 2 + (y / (b - r)) ** 2 > 1) continue
      const d = Math.hypot(x / a, y / b)
      const shade = d < 0.18 ? 1 : d < 0.52 ? 1 - (d - 0.18) / 0.34 * 0.4 : d < 0.88 ? 0.6 - (d - 0.52) / 0.36 * 0.32 : 0.28 - (d - 0.88) / 0.12 * 0.06
      holes.push([x + a, y + b, (0.85 * shade).toFixed(3)])
    }
  }
  return holes
})()
function SpeakerGrille() {
  return (
    <svg className="sv-grille" viewBox={`0 0 ${GRILLE.w} ${GRILLE.h}`} width={GRILLE.w} height={GRILLE.h} aria-hidden="true" focusable="false">
      {GRILLE_HOLES.map(([x, y, o]) => <circle key={`${x},${y}`} cx={x.toFixed(1)} cy={y.toFixed(1)} r={GRILLE.r} fill="black" fillOpacity={o} />)}
    </svg>
  )
}

// The room's emotional response: the reactions the service playing there declares for the item
// (Pandora's thumbs, AccuRadio's star and ban, a heart), each a key wearing the service's own
// glyph and no words (the service's own are its tooltip), its lamp lit while the rating is
// given. Where the room offers none, the four tempers stand in, switched off.
const TEMPERS = ['woe', 'frolic', 'dread', 'malice']
const TEMPER_GLYPHS = { woe: L.Woe, frolic: L.Frolic, dread: L.Dread, malice: L.Malice }
const TEMPER_TAGS = { woe: 'WO', frolic: 'FC', dread: 'DR', malice: 'MA' }
const KEYS_FADE_MS = 400
function ReactionCluster({ zone, t, onMessage }) {
  const { actions } = useSystem()
  const tr = zone?.transport || {}
  const { provider, known, refresh } = useProviderMetadata(zone)
  const offered = (provider?.ratings || []).filter((b) => b.icon)
  const readKey = `${zone?.uuid || ''}|${tr.track_uri || ''}`
  const { ratings, press } = useOptimisticRatings(offered, readKey)
  const playing = Boolean(zone && isLoaded(tr))
  // Until the item playing has been read (the next track, or another room's), its reactions are
  // not known, and a room skipping through Pandora, or one chosen after another, would show the
  // tempers for that moment. The keys already up stay, unlit, and a press waits; the new set
  // comes once the service has answered, the tempers only once it has said it has none. A read
  // that never answers is given up after a few seconds.
  const [gaveUp, setGaveUp] = useState('')
  const waiting = playing && !known && gaveUp !== readKey
  useEffect(() => {
    if (!waiting) return undefined
    const id = setTimeout(() => setGaveUp(readKey), 4000)
    return () => clearTimeout(id)
  }, [waiting, readKey])
  const stale = waiting
  const [shownKind, setShownKind] = useState('tempers')
  const keysFor = useRef({})
  const live = !playing ? [] : waiting ? (keysFor.current[shownKind] || []) : ratings
  const rate = async (button) => {
    // A lit button the service gives no way back from does nothing (rating_is_inert in
    // backend/main.py).
    if (button.inert) return
    const fromUri = (() => {
      const m = /^x-sonos-http:([^?]+?)(?:\.[a-z0-9]+)?\?/i.exec(tr.track_uri || '')
      try { return m ? decodeURIComponent(m[1]) : '' } catch { return '' }
    })()
    const item = provider?.item_id || tr.item_id || fromUri
    if (!item) return
    const result = await actions.rateItemById(zone.uuid, tr.service_id, item, button.id)
    if (result?.ok) { onMessage?.(result.message || button.message || ''); refresh() }
    return result?.ok
  }
  // A different set of keys (another service's, or the tempers) takes the row's place as the set
  // it replaces fades away under it; a press, which only lights a lamp, does not.
  const kind = waiting ? shownKind : live.length ? `${tr.service_id}:${live.map((b) => b.id).join(',')}` : 'tempers'
  const [leaving, setLeaving] = useState(null)
  if (!waiting) keysFor.current[kind] = live
  useEffect(() => {
    if (kind === shownKind) return
    setLeaving({ kind: shownKind, keys: keysFor.current[shownKind] || [] })
    setShownKind(kind)
  }, [kind, shownKind])
  useEffect(() => {
    if (!leaving) return undefined
    const id = setTimeout(() => setLeaving(null), KEYS_FADE_MS)
    return () => clearTimeout(id)
  }, [leaving])
  const shown = shownKind === kind ? live : (keysFor.current[shownKind] || [])
  const keysOf = (setKind, buttons, live) => (setKind === 'tempers'
    ? TEMPERS.map((id) => <Key key={id} size="s" absent legend={t(`sv.temper.${id}`)} glyph={React.createElement(TEMPER_GLYPHS[id], { size: 14 })} label={t(`sv.temper.${id}`)} tip />)
    : buttons.map((button) => {
      const { selected } = ratingGlyph(button.icon)
      // The key's picture is the rating not given, whatever the item's state: a press lights the
      // key's lamp and leaves its legend as it was.
      const icon = String(button.icon).replace(/_SELECTED(?=[-.])/i, '_UNSELECTED')
      // A button the service marks to always skip is an action, not a toggle, and has no lamp:
      // AccuRadio's ban and Pandora's thumbs-down move straight on to the next track.
      const toggle = String(button.skip || '').toUpperCase() !== 'ALWAYS'
      const lit = toggle ? live && !stale && selected : null
      return (
        <Key key={button.id} size="s" glyph={<RatingGlyph icon={icon} size={16} />} lit={lit} pressed={toggle ? lit : null}
             label={button.inert ? t('rating.cannotUndo', { service: tr.service_name || '' }) : (button.label || '')}
             aria-disabled={button.inert || undefined} onPress={() => { if (live && !stale) press(button, rate) }} />
      )
    }))
  const setClass = (setKind) => (setKind === 'tempers' ? 'sv-reactionset-tempers' : '')
  return (
    <Cluster key={shownKind} label={t('sv.emotionalResponse')} className="sv-reactionkeys" keysClassName={setClass(shownKind)}
             data-entering={leaving ? '' : undefined}
             aside={leaving && (
               <div className={cx('sv-cluster-keys', 'sv-reaction-leaving', setClass(leaving.kind))} aria-hidden="true" inert>
                 {keysOf(leaving.kind, leaving.keys, false)}
               </div>
             )}>
      {keysOf(shownKind, shown, true)}
    </Cluster>
  )
}

// The keyboard case's front edge, as narrow walls standing down from the rim: one along the
// front, and on each front corner a run of short ones turned a little more each time, so the
// edge follows the rim's rounding round onto the sides. Measured in the deck's own plane.
const RIM = 14
const RIM_RADIUS = 30 + RIM
const EDGE_HEIGHT = 68
const EDGE_STEPS = 9
function DeckEdge() {
  // The case's wall, from the rim down to the table, and round its foot the lip it stands on: a
  // second, lower wall a little farther out, and the lip's top between the two, flat and parallel
  // to the deck. On the table round the lip's foot, the case's shadow, flat too: the footprint,
  // hidden under the case, casting a soft shadow out from its edge.
  return (
    <span className="sv-deck-edge" aria-hidden="true" style={{ '--sv-edge-h': `${EDGE_HEIGHT}px` }}>
      <span className="sv-deck-shadow" style={{ '--sv-foot-out': `${RIM + LIP}px`, '--sv-foot-r': `${RIM_RADIUS + LIP}px`, '--sv-foot-z': `${0.5 - EDGE_HEIGHT}px` }} />
      <span className="sv-deck-liptop" style={{ '--sv-lip-out': `${RIM + LIP}px`, '--sv-lip-r': `${RIM_RADIUS + LIP}px`, '--sv-lip-z': `${LIP_HEIGHT - EDGE_HEIGHT}px`, '--sv-lip-step': `${LIP}px` }} />
      {edgeWalls(0, EDGE_HEIGHT, 0, 'wall')}
      {edgeWalls(LIP, LIP_HEIGHT, LIP_HEIGHT - EDGE_HEIGHT, 'lip')}
    </span>
  )
}

// One run of narrow walls round the deck's front: `out` past the rim, `height` tall, its top
// `drop` below the deck's plane (negative is down).
const LIP = 12
const LIP_HEIGHT = 12
function edgeWalls(out, height, drop, kind) {
  const walls = []
  const radius = RIM_RADIUS + out
  const rim = RIM + out
  const step = 90 / EDGE_STEPS
  const chord = 2 * radius * Math.sin((step / 2) * Math.PI / 180) + 0.8
  const reach = radius * Math.cos((step / 2) * Math.PI / 180)
  // Standing down from a line `drop` below the deck: the wall's foot is at that depth, so it is
  // set out by its own height less the drop and lifted back by the drop.
  const top = (dy) => `calc(100% + ${rim - radius + dy - height}px)`
  for (const side of [-1, 1]) {
    for (let k = 0; k < EDGE_STEPS; k += 1) {
      const turn = side * (k + 0.5) * step
      const phi = (90 - turn) * Math.PI / 180
      const dx = reach * Math.cos(phi)
      const dy = reach * Math.sin(phi)
      const across = side < 0
        ? `${-rim + radius + dx - chord / 2}px`
        : `calc(100% + ${rim - radius + dx - chord / 2}px)`
      walls.push(<i key={`${kind}-${side}-${k}`} data-kind={kind} style={{
        left: across, top: top(dy), width: `${chord}px`, height: `${height}px`, '--sv-drop': `${drop}px`,
        '--sv-turn': `${-turn}deg`, '--sv-shade': (0.32 * Math.abs(Math.sin(turn * Math.PI / 180))).toFixed(3),
      }} />)
    }
  }
  walls.push(<i key={`${kind}-front`} data-kind={kind} style={{ left: `${radius - rim - 0.4}px`, right: `${radius - rim - 0.4}px`, top: top(radius), height: `${height}px`, '--sv-drop': `${drop}px`, '--sv-turn': '0deg', '--sv-shade': 0 }} />)
  return walls
}

// Cursor keys, with Esc above and left of them. The arrows walk whatever the screen shows, the
// middle key presses what the cursor is on, and Esc does what the real key does.
function CursorKeys({ onCursor, onEscape, held, t }) {
  // A press here must not take the focus off the screen, or the cursor would be lost.
  const keep = { onMouseDown: (event) => event.preventDefault(), tabIndex: -1 }
  return (
    <div className="sv-cursor" role="group" aria-label={t('sv.cursorKeys')}>
      <Key tone="navy" size="s" className="sv-cursor-esc" legend="Esc" label="Esc" held={held.has('escape')} onPress={onEscape} {...keep} />
      <Key tone="navy" size="s" className="sv-cursor-up" glyph={<L.Up size={14} />} label={t('sv.cursorUp')} held={held.has('up')} onPress={() => onCursor('up')} {...keep} />
      <Key tone="navy" size="s" className="sv-cursor-left" glyph={<L.Left size={14} />} label={t('common.back')} held={held.has('left')} onPress={() => onCursor('left')} {...keep} />
      <Key tone="aqua" size="s" className="sv-cursor-enter" glyph={<L.Check size={14} />} label={t('sv.enterKey')} held={held.has('enter')} onPress={() => onCursor('enter')} {...keep} />
      <Key tone="navy" size="s" className="sv-cursor-right" glyph={<L.Right size={14} />} label={t('sv.open')} held={held.has('right')} onPress={() => onCursor('right')} {...keep} />
      <Key tone="navy" size="s" className="sv-cursor-down" glyph={<L.Down size={14} />} label={t('sv.cursorDown')} held={held.has('down')} onPress={() => onCursor('down')} {...keep} />
    </div>
  )
}

// The trackball scrolls the screen: rolled with a drag, or with the wheel over it. The ball's
// speckle (Face) turns with it.
//
// The well lies on the tilted deck, so anything drawn on it shows foreshortened and, away from
// the deck's middle, leaning. The ball is drawn on the deck's plane all the same, as the shape the
// deck's projection turns back into a circle. The deck's projection of its own plane is a
// homography, fixed by where the well's four corners land on the screen (and a fifth point stood
// off the deck gives where "up" lands); the ball takes its inverse. Stood up in 3D instead, some
// GPUs drew its lower half behind the deck or ignored the cut at the collar; drawn flat over the
// page, it was left behind whenever the deck reflowed. The collar's near half is painted over the
// ball's foot (the well's ::after), so nothing needs cutting.
// The speckle in the ball's plastic: flecks spread evenly over a sphere (a Fibonacci spiral),
// turned by as far as the ball has rolled and drawn where they land on its face, each pressed
// flat toward the rim as the surface turns away from the reader, so they follow the ball's curve.
const flecks = (count, seed) => Array.from({ length: count }, (_, i) => {
  const y = 1 - (2 * (i + 0.5)) / count
  const ring = Math.sqrt(1 - y * y)
  const angle = Math.PI * (3 - Math.sqrt(5)) * i + seed
  return [ring * Math.cos(angle), y, ring * Math.sin(angle)]
})
const SPECKLE = [{ at: flecks(96, 0), size: 1.1, fill: 'rgba(255, 255, 255, 0.07)' }, { at: flecks(140, 2.1), size: 0.9, fill: 'rgba(170, 200, 255, 0.05)' }]

// Filing: what was just sent to a room goes into that room's bin at the foot of the screen, the
// way the terminal's work is filed. Taken from the film's refining, frame by frame: the bin is
// brought into view along the strip; two flaps, thin outlined bars hinged at the bin's top
// corners, swing open and stand out at forty-five degrees; a card for the item drifts down the
// screen toward the bin, slowly at first, its letters jumbling into figures as it gathers speed,
// and shrinks into the bin's mouth; after a moment a readout rises out of the bin, the bin's
// number over bars for what the room holds, holds, and sinks back; the flaps swing shut through
// upright, lie flat, and are gone. All of it is drawn over the page, in fixed coordinates taken
// from the bin and from where the item was pressed; the readout hangs from the bin's top edge by
// its own height, since a phone's 100vh counts the address bar and set it that far too high.
// With reduced motion asked for, the bin only comes into view and lights up.
const FIGURES = '0123456789'
function Filing({ job, onDone }) {
  const [stage, setStage] = useState(null)
  const [shown, setShown] = useState(job.title)
  const [angle, setAngle] = useState(0)
  const ghost = useRef(null)
  useEffect(() => {
    const bin = document.querySelector(`.sv-binbtn[data-bin="${CSS.escape(job.bin)}"]`)
    if (!bin) { onDone(); return undefined }
    // The flaps' swing, a frame at a time: out to 135 degrees, and back.
    let frame = 0
    const swing = (from, to, ms, ease) => {
      cancelAnimationFrame(frame)
      const t0 = performance.now()
      const step = (now) => {
        const p = Math.min(1, (now - t0) / ms)
        setAngle(from + (to - from) * ease(p))
        if (p < 1) frame = requestAnimationFrame(step)
      }
      frame = requestAnimationFrame(step)
    }
    const out = (p) => 1 - (1 - p) ** 3
    const back = (p) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2)
    const bar = bin.closest('.sv-binsbar')
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    // Where the strip is scrolled to bring the bin into view, if it is not in view.
    let target = null
    if (bar) {
      const start = bin.offsetLeft, end = start + bin.offsetWidth
      if (start < bar.scrollLeft) target = start - 4
      else if (end > bar.scrollLeft + bar.clientWidth) target = end - bar.clientWidth + 4
      if (target !== null) {
        target = Math.max(0, Math.min(target, bar.scrollWidth - bar.clientWidth))
        bar.scrollTo({ left: target, behavior: still ? 'auto' : 'smooth' })
      }
    }
    const timers = []
    const later = (ms, fn) => timers.push(setTimeout(fn, ms))
    // The bin is measured once, so nothing starts until the strip is there: at its target, or
    // its scrollend, and never more than a second and a half. A smooth scroll's length is the
    // browser's own (Firefox takes over half a second, and can wait a few frames to begin), and
    // measuring partway through set the flaps off the bin's corners.
    let ended = null
    const settled = (fn) => {
      if (target === null) { fn(); return }
      let done = false
      const go = () => { if (!done) { done = true; cancelAnimationFrame(frame); bar.removeEventListener('scrollend', ended); fn() } }
      ended = go
      bar.addEventListener('scrollend', go)
      const t0 = performance.now()
      const look = (now) => {
        if (Math.abs(bar.scrollLeft - target) < 1 || now - t0 > 1500) go()
        else frame = requestAnimationFrame(look)
      }
      frame = requestAnimationFrame(look)
    }
    // The bin's own mark outlives the overlay, so its timer is not among those cleared with it.
    const feed = () => { bin.setAttribute('data-fed', ''); setTimeout(() => bin.removeAttribute('data-fed'), 300) }
    const stop = () => { timers.forEach(clearTimeout); cancelAnimationFrame(frame); if (ended) bar.removeEventListener('scrollend', ended) }
    if (still) { settled(() => { feed(); onDone() }); return stop }
    let jumble = 0
    settled(() => {
      const r = rectOf(bin)
      const at = { x: r.left, y: r.top, w: r.width, h: r.height }
      // Nothing drawn past the screen's glass: the overlay is cut to the CRT's face.
      const crt = rectOf(bin.closest('.sv-crt'))
      const glass = crt ? `inset(${crt.top}px ${viewW() - crt.right}px ${viewH() - crt.bottom}px ${crt.left}px round 26px / 30px)` : 'none'
      setStage({ bin: at, glass, glassTop: crt ? crt.top : 0, flaps: 'open', readout: null })
      swing(0, 135, 300, out)
      // The card's way down: a slow drift, gathering speed, then the plunge into the mouth.
      later(400, () => {
        const el = ghost.current
        if (!el) return
        const from = job.from
        const dx = at.x + at.w / 2 - (from.x + from.w / 2), dy = at.y + 4 - (from.y + from.h / 2)
        el.animate([
          { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 0, easing: 'cubic-bezier(0.4, 0, 0.9, 0.6)' },
          { transform: `translate(${(dx * 0.7).toFixed(1)}px, ${(dy * 0.7).toFixed(1)}px) scale(0.85)`, opacity: 1, offset: 0.62, easing: 'cubic-bezier(0.3, 0, 0.7, 1)' },
          { transform: `translate(${dx.toFixed(1)}px, ${(dy - 14).toFixed(1)}px) scale(0.32)`, opacity: 1, offset: 0.88, easing: 'ease-in' },
          { transform: `translate(${dx.toFixed(1)}px, ${(dy + 6).toFixed(1)}px) scale(0.1)`, opacity: 0, offset: 1 },
        ], { duration: 1500, fill: 'forwards' })
        let step = 0
        later(650, () => {
          jumble = setInterval(() => {
            step += 1
            const p = Math.min(0.95, 0.2 + step * 0.1)
            setShown(job.title.replace(/\S/g, (ch) => (Math.random() < p ? FIGURES[Math.floor(Math.random() * 10)] : ch)))
          }, 70)
          timers.push(jumble)
        })
      })
      later(1900, () => { clearInterval(jumble); feed() })
      later(2500, () => setStage((v) => v && { ...v, readout: 'up' }))
      later(2800, () => setStage((v) => v && { ...v, readout: 'full' }))
      later(4200, () => setStage((v) => v && { ...v, readout: 'down' }))
      later(4600, () => { setStage((v) => v && { ...v, flaps: 'closing', readout: null }); swing(135, 0, 500, back) })
      later(5100, () => setStage((v) => v && { ...v, flaps: 'shut' }))
      later(5300, onDone)
    })
    return () => { stop(); clearInterval(jumble) }
  }, [job, onDone])
  if (!stage) return null
  const { bin, glass, glassTop, flaps, readout } = stage
  const from = job.from
  // Each flap: its base lies on the bin's rim, a thickness wide from the corner inward, at every
  // angle of its swing; the bar runs from the corner up and out along the angle. Flat, it is a
  // line along the rim from the corner to the middle; open, it stands out at forty-five degrees.
  const thick = 7, long = bin.w / 2, rad = (angle * Math.PI) / 180
  const corners = [
    { x: bin.x, y: bin.y, inward: 1, dx: Math.cos(rad), dy: -Math.sin(rad) },
    { x: bin.x + bin.w, y: bin.y, inward: -1, dx: -Math.cos(rad), dy: -Math.sin(rad) },
  ].map((c) => ({ ...c, pts: [[0, 0], [c.inward * thick, 0], [c.inward * thick + long * c.dx, long * c.dy], [long * c.dx, long * c.dy]] }))
  return (
    <div className="sv-filing" aria-hidden="true" style={{ clipPath: glass, '--sv-glass-top': `${glassTop.toFixed(1)}px` }}>
      <svg className="sv-filing-flaps">
        {corners.map((c, i) => (
          <polygon key={i} className="sv-filing-flap" data-flaps={flaps}
                   points={c.pts.map(([x, y]) => `${(c.x + x).toFixed(1)},${(c.y + y).toFixed(1)}`).join(' ')} />
        ))}
      </svg>
      {readout && (
        <div className="sv-filing-readout" data-state={readout} style={{ left: bin.x, width: bin.w, top: bin.y, transform: 'translateY(-100%)' }}>
          <div className="sv-filing-readout-head">{job.number}</div>
          <div className="sv-filing-row"><span>NOW</span><em>{job.title}</em></div>
          {TEMPERS.map((id, i) => (
            <div key={id} className="sv-filing-row"><span>{TEMPER_TAGS[id]}</span><i className="sv-filing-bar" data-temper={id} style={{ '--p': readout === 'up' ? 0 : job.tempers[i] }} /></div>
          ))}
        </div>
      )}
      <span className="sv-filing-ghost" ref={ghost} style={{ left: from.x, top: from.y, width: from.w, height: from.h }}>
        {job.art && <i className="sv-filing-art"><img src={job.art} alt="" /></i>}
        <span>{shown}</span>
      </span>
    </div>
  )
}

// The ball's face, drawn as one shape: the sphere's outline above its center, the hole's edge
// below (`b` is how far below the center that reaches), filled with the plastic's shade, the
// speckle in it, and the light on it, all in the sphere's own coordinates (center 0, 0; half
// width `w` / 2; half height `h` / 2). SVG, so the shape's edge is smoothed before the deck's
// transform takes it: a rounded box's edge is not, on the tilted plane.
// A color written as SVG has always taken one: opaque, its opacity apart. With its translucent
// layers (the speckle, the sheen, the highlight) given as rgba(), Chrome on a Mac showed the ball a
// flat black.
function paint(kind, color) {
  const m = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(color)
  const hex = m ? '#' + [m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, '0')).join('') : color
  const alpha = m ? Number(m[4]) : 1
  return kind === 'stop' ? { stopColor: hex, stopOpacity: alpha } : { fill: hex, fillOpacity: alpha }
}

function Face({ w, h, b, roll }) {
  const W = w / 2, H = h / 2
  const egg = `M ${-W} 0 A ${W} ${H} 0 0 1 ${W} 0 A ${W} ${b} 0 0 1 ${-W} 0 Z`
  const r = H
  const across = roll.x / r, down = roll.y / r
  const ca = Math.cos(across), sa = Math.sin(across), cd = Math.cos(down), sd = Math.sin(down)
  // A gradient centered at (cx, cy) with radii (rx, ry); stops as [offset, color].
  const radial = (id, cx, cy, rx, ry, stops) => (
    <radialGradient id={id} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform={`translate(${cx.toFixed(2)} ${cy.toFixed(2)}) scale(${rx.toFixed(2)} ${ry.toFixed(2)})`}>
      {stops.map(([at, color], i) => <stop key={i} offset={at} {...paint('stop', color)} />)}
    </radialGradient>
  )
  const corner = Math.hypot(1.16 * W, 1.24 * H) // from 42% 38% of the sphere's box to its far corner
  return (
    <svg className="sv-trackball-face" viewBox={`${-W} ${-H} ${w} ${H + b}`} aria-hidden="true">
      <defs>
        {radial('sv-ball-plastic', -0.16 * W, -0.24 * H, corner, corner, [[0, '#262a30'], [0.45, '#121417'], [0.78, '#08090b'], [1, '#020304']])}
        {radial('sv-ball-shade', -0.16 * W, -0.24 * H, corner, corner, [[0.45, 'rgba(18, 20, 23, 0)'], [0.78, '#08090b'], [1, '#020304']])}
        <linearGradient id="sv-ball-hole" x1="0" y1={-H} x2="0" y2={H} gradientUnits="userSpaceOnUse">
          <stop offset="0.48" stopColor="#000" stopOpacity="0" /><stop offset="0.7" stopColor="#000" stopOpacity="0.55" /><stop offset="0.85" stopColor="#000" stopOpacity="0.8" />
        </linearGradient>
        {radial('sv-ball-rim', 0, 0, Math.hypot(W, H), Math.hypot(W, H), [[0.62, 'rgba(0, 0, 0, 0)'], [0.72, 'rgba(0, 0, 0, 0.5)'], [1, 'rgba(0, 0, 0, 0.5)']])}
        {radial('sv-ball-sheen', -0.26 * W, -0.44 * H, 0.6 * W, 0.44 * H, [[0, 'rgba(255, 255, 255, 0.22)'], [1, 'rgba(255, 255, 255, 0)']])}
        {radial('sv-ball-light', -0.3 * W, -0.52 * H, 0.32 * W, 0.2 * H, [[0, 'rgba(255, 255, 255, 0.95)'], [0.45, 'rgba(255, 255, 255, 0.55)'], [1, 'rgba(255, 255, 255, 0)']])}
      </defs>
      <path d={egg} fill="url(#sv-ball-plastic)" />
      {SPECKLE.map(({ at, size, fill }, layer) => at.map(([x0, y0, z0], i) => {
        const grain = size * (W / 38) // the flecks grow with the ball
        const x = x0 * ca + z0 * sa, z1 = z0 * ca - x0 * sa
        const y = y0 * cd + z1 * sd, z = z1 * cd - y0 * sd
        if (z < 0.03) return null
        const cx = x * W, cy = y * H
        // None crosses the shape's edge: above the center the sphere's outline, below it the hole's.
        if ((cx / W) ** 2 + (cy / (cy > 0 ? b : H)) ** 2 > 0.9) return null
        return <ellipse key={`${layer}-${i}`} cx={cx.toFixed(2)} cy={cy.toFixed(2)} rx={(grain * z).toFixed(2)} ry={grain.toFixed(2)} {...paint('fill', fill)} opacity={Math.sqrt(z).toFixed(2)}
                        transform={`rotate(${((Math.atan2(y, x) * 180) / Math.PI).toFixed(1)} ${cx.toFixed(2)} ${cy.toFixed(2)})`} />
      }))}
      {/* Light from above and to the left: the plastic's own shade back over the speckle toward the
          rim, the hole's shadow over the part down in it, a darker rim, a soft sheen, and a hard
          highlight. */}
      <path d={egg} fill="url(#sv-ball-shade)" />
      <path d={egg} fill="url(#sv-ball-hole)" />
      <path d={egg} fill="url(#sv-ball-rim)" />
      <path d={egg} fill="url(#sv-ball-sheen)" />
      <path d={egg} fill="url(#sv-ball-light)" />
    </svg>
  )
}

const BALL_MARGIN = 1.03 // the outline is drawn this much over its true size, so the hole's edge never shows past it
const PROBE_LIFT = 20 // px the fifth probe stands off the deck

const mul3 = (A, B) => A.map((row) => [0, 1, 2].map((j) => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j]))
const apply3 = (m, x, y) => {
  const w = m[2][0] * x + m[2][1] * y + m[2][2]
  return [(m[0][0] * x + m[0][1] * y + m[0][2]) / w, (m[1][0] * x + m[1][1] * y + m[1][2]) / w]
}
function inv3(m) {
  const [[a, b, c], [d, e, f], [g, h, i]] = m
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g
  const det = a * A + b * B + c * C
  if (!det) return null
  return [[A, -(b * i - c * h), b * f - c * e], [B, a * i - c * g, -(a * f - c * d)], [C, -(a * h - b * g), a * e - b * d]].map((row) => row.map((v) => v / det))
}
// The homography taking the unit square's corners, in order round it, to four points.
function squareToQuad([x0, y0], [x1, y1], [x2, y2], [x3, y3]) {
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3
  let g = 0, h = 0
  if (dx3 || dy3) {
    const den = dx1 * dy2 - dx2 * dy1
    g = (dx3 * dy2 - dx2 * dy3) / den
    h = (dx1 * dy3 - dx3 * dy1) / den
  }
  return [[x1 - x0 + g * x1, x3 - x0 + h * x3, x0], [y1 - y0 + g * y1, y3 - y0 + h * y3, y0], [g, h, 1]]
}

// What the terminal shows with no system disk: a screenful of garbage as the program it was
// running comes apart, then the BIOS, which has looked for something to boot and found nothing.
// The BIOS speaks English whatever the household's language, as a BIOS does.
const GARBLE = '█▓▒░▌▐▀▄■□▪▫╬╫╪┼╳≡≈∞∩∑∂·:;0123456789ABCDEF'
function Crash() {
  const [stage, setStage] = useState('garble')
  // The garbage fills the whole screen, however large: as many rows and columns of it as the
  // screen holds characters, measured from a run of them in its own type, and a few over.
  const box = useRef(null)
  const cell = useRef(null)
  const [grid, setGrid] = useState({ rows: 30, cols: 120 })
  useLayoutEffect(() => {
    const el = box.current, probe = cell.current
    if (!el || !probe) return
    const w = probe.offsetWidth / 10, h = probe.offsetHeight
    if (w && h) setGrid({ rows: Math.ceil(el.clientHeight / h) + 2, cols: Math.ceil(el.clientWidth / w) + 4 })
  }, [])
  const lines = useMemo(() => Array.from({ length: grid.rows }, () => Array.from({ length: grid.cols }, () => GARBLE[Math.floor(Math.random() * GARBLE.length)]).join('')), [grid])
  useEffect(() => {
    const timer = setTimeout(() => setStage('bios'), 1100)
    return () => clearTimeout(timer)
  }, [])
  const bios = ['SONORA TERMINAL BIOS  REV 2.1', 'COPYRIGHT (C) HOUSEHOLD MUSIC SYSTEMS', '', 'MEMORY TEST ........ 640K OK', 'FDD0 ............... NO DISK',
                'FDD1 ............... NO DISK', 'HDD0 ............... OK', '', 'OS NOT FOUND', '', 'INSERT SYSTEM DISK IN FDD0 TO CONTINUE']
  return (
    <div className="sv-crash" data-stage={stage} role="alert" ref={box}>
      {stage === 'garble' && <pre className="sv-crash-cell" aria-hidden="true" ref={cell}>MMMMMMMMMM</pre>}
      {stage === 'garble'
        ? <pre className="sv-crash-garble" aria-hidden="true">{lines.join('\n')}</pre>
        : <pre className="sv-crash-bios">{bios.map((line, i) => <span key={i} style={{ '--sv-line': i }}>{line}{'\n'}</span>)}<span className="sv-crash-cursor">_</span></pre>}
    </div>
  )
}

function Trackball({ target, t, off = false }) {
  const ball = useRef(null)
  const drag = useRef(null)
  const [roll, setRoll] = useState({ x: 0, y: 0 })
  const move = (dx, dy) => {
    if (dy) screenScroller(target.current)?.scrollBy?.({ top: dy * 3, left: 0 })
    if (dx) screenScrollerAcross(target.current)?.scrollBy?.({ top: 0, left: dx * 3 })
    setRoll((prev) => ({ x: prev.x + dx, y: prev.y + dy }))
  }
  useEffect(() => {
    const el = ball.current
    if (!el) return undefined
    const wheel = (event) => { event.preventDefault(); move(event.deltaX / 3, event.deltaY / 3) }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  })
  // The ball is the console's pointer, so any wheel turned anywhere on the page turns it too,
  // whatever that wheel scrolls. A wheel that a control took for itself (the system switch, the
  // strip of bins, the ball itself) is not one.
  useEffect(() => {
    const anywhere = (event) => {
      if (event.defaultPrevented) return
      const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1
      setRoll((prev) => ({ x: prev.x + (event.deltaX * scale) / 3, y: prev.y + (event.deltaY * scale) / 3 }))
    }
    window.addEventListener('wheel', anywhere, { passive: true })
    return () => window.removeEventListener('wheel', anywhere)
  }, [])
  const well = useRef(null)
  const [fit, setFit] = useState(null)
  useLayoutEffect(() => {
    const el = well.current
    if (!el) return undefined
    const measure = () => {
      const side = el.clientWidth
      const pts = [...el.querySelectorAll('.sv-trackwell-probe')].map((p) => { const r = rectOf(p); return [r.left, r.top] })
      if (!side || pts.length < 5) { setFit(null); return }
      const [c0, c1, c2, c3, up] = pts
      // Plane px from the well's center, to screen px from where that center lands.
      const toScreen = mul3(squareToQuad(c0, c1, c2, c3), [[1 / side, 0, 0.5], [0, 1 / side, 0.5], [0, 0, 1]])
      const [cx, cy] = apply3(toScreen, 0, 0)
      const fromCenter = mul3([[1, 0, -cx], [0, 1, -cy], [0, 0, 1]], toScreen)
      const toPlane = inv3(fromCenter)
      if (!toPlane) { setFit(null); return }
      // The ball's radius is the hole's, a hair past the dark disc: its equator lies at the hole's
      // edge, its center on the deck, and the half above the deck shows.
      const radius = (parseFloat(getComputedStyle(el).getPropertyValue('--sv-hole')) || side * 0.8) / 2 + 1.5
      // A line of sight that drops one unit through the deck moves across the screen by (nx, ny):
      // as much as "up" moves there.
      const nx = (up[0] - cx) / PROBE_LIFT, ny = (up[1] - cy) / PROBE_LIFT
      // Seen off to one side, a sphere's outline is not a circle but an ellipse drawn out along the
      // line from the deck's vanishing point (the point its tilt turns about, the eye's distance in
      // front), by one over the cosine of the angle it is seen at.
      const deck = el.closest('.sv-deck')
      const dr = rectOf(deck)
      const row = (getComputedStyle(deck || el).transform.match(/^matrix3d\((.*)\)$/)?.[1] || '').split(',').map(Number)
      const depth = row.length === 16 ? 1 / Math.hypot(row[3], row[7], row[11]) : 0
      const ex = dr ? cx - (dr.left + dr.width / 2) : 0, ey = dr ? cy - dr.bottom : 0
      const stretch = Number.isFinite(depth) && depth ? Math.hypot(depth, ex, ey) / depth : 1
      // Where the ball goes behind the near rim: the two points of the hole's edge where the eye's
      // line grazes the ball. Across the deck a line of sight moves by (dx, dy) per unit down; the
      // ball's surface at a point of the hole's edge, at angle psi round from the near side, faces
      // along (sin psi, cos psi), and grazes where the two are at right angles. What shows of the
      // ball is bounded by its own outline above the line between those two points and by the
      // hole's edge below it, and it is drawn as that one shape.
      const dx = (toPlane[0][0] * nx + toPlane[0][1] * ny) / toPlane[2][2], dy = (toPlane[1][0] * nx + toPlane[1][1] * ny) / toPlane[2][2]
      let cut = 0
      if (Math.hypot(dx, dy) > 0) {
        const psi0 = Math.atan2(dx, dy)
        const p1 = [radius * Math.cos(psi0), -radius * Math.sin(psi0)]
        // The line between the two points as it lies on the screen.
        const s1 = apply3(fromCenter, p1[0], p1[1]), s2 = apply3(fromCenter, -p1[0], -p1[1])
        let v = [s2[0] - s1[0], s2[1] - s1[1]]
        if (v[0] < 0) v = [-v[0], -v[1]]
        cut = Math.atan2(v[1], v[0])
      }
      // The hole's edge below that line, as far down the screen as it reaches from the center,
      // measured along the ball's own axes: the lower half of the shape is that ellipse.
      let below = 0
      for (let k = 0; k < 72; k++) {
        const a = (k / 72) * 2 * Math.PI
        const [qx, qy] = apply3(fromCenter, radius * Math.cos(a), radius * Math.sin(a))
        below = Math.max(below, -qx * Math.sin(cut) + qy * Math.cos(cut))
      }
      // The ball's own axes lie along that line. The outline is drawn out along it, near enough
      // to the line from the vanishing point for the eye.
      const cos = Math.cos(cut), sin = Math.sin(cut)
      // The transform takes the ball's own (screen-true) coordinates to the deck's.
      const m = mul3(toPlane, [[cos, -sin, 0], [sin, cos, 0], [0, 0, 1]]).map((r) => r.map((v) => v / toPlane[2][2]))
      const [ax, ay] = apply3(m, 0, 0)
      const [bx, by] = apply3(fromCenter, ax + 1, ay), [ox, oy] = apply3(fromCenter, ax, ay)
      const r = radius * Math.hypot(bx - ox, by - oy)
      const next = { m: m.flat(), w: r * stretch * BALL_MARGIN, h: r * BALL_MARGIN, b: below + 1, cx, cy, cut }
      setFit((prev) => (prev && Math.abs(prev.w - next.w) < 1e-3 && Math.abs(prev.h - next.h) < 1e-3 && Math.abs(prev.b - next.b) < 1e-3
                        && Math.abs(prev.cx - next.cx) < 1e-2 && Math.abs(prev.cy - next.cy) < 1e-2
                        && prev.m.every((v, i) => Math.abs(v - next.m[i]) < 1e-4) ? prev : next))
    }
    let queued = 0
    const soon = () => { cancelAnimationFrame(queued); queued = requestAnimationFrame(measure) }
    measure()
    const deck = el.closest('.sv-deck') || el.parentElement
    const sizes = new ResizeObserver(soon)
    sizes.observe(el); sizes.observe(deck); sizes.observe(document.documentElement)
    // Keys come and go on the deck as the program changes, and the well moves over with them.
    const moves = new MutationObserver(soon)
    moves.observe(deck, { childList: true, subtree: true })
    window.addEventListener('resize', soon)
    window.addEventListener('scroll', soon, { capture: true, passive: true })
    return () => { cancelAnimationFrame(queued); sizes.disconnect(); moves.disconnect(); window.removeEventListener('resize', soon); window.removeEventListener('scroll', soon, true) }
  }, [])
  // Once measured, the ball is drawn flat on the page over its well, not inside the tipped-back
  // deck: its shape is already the one the eye sees there, so a plain turn places it. Laid into the
  // deck under the deck's own inverse, as it was, Chrome on a Mac drew it a solid black. Until then
  // it rests in the well, a circle.
  const style = {}
  if (fit) {
    style['--sv-ball-w'] = `${(fit.w * 2).toFixed(3)}px`
    style['--sv-ball-h'] = `${fit.h.toFixed(3)}px`
    style['--sv-ball-b'] = `${fit.b.toFixed(3)}px`
    style.left = `${(fit.cx - fit.w).toFixed(2)}px`
    style.top = `${(fit.cy - fit.h).toFixed(2)}px`
    style.transform = `rotate(${fit.cut.toFixed(5)}rad)`
  }
  const theBall = (
    <div className={cx('sv-trackball', fit && 'sv-trackball-laid')} ref={ball} role="scrollbar" aria-label={t('sv.trackball')} aria-orientation="vertical" aria-valuenow={0} tabIndex={off ? -1 : 0}
         style={style} inert={off || undefined}
         onKeyDown={(event) => {
           const by = { ArrowDown: 40, ArrowUp: -40, PageDown: 200, PageUp: -200 }[event.key]
           const across = { ArrowRight: 40, ArrowLeft: -40 }[event.key]
           if (by) { event.preventDefault(); move(0, by / 3) }
           if (across) { event.preventDefault(); move(across / 3, 0) }
         }}
         onPointerDown={(event) => { drag.current = { x: pt(event.clientX), y: pt(event.clientY) }; event.currentTarget.setPointerCapture(event.pointerId) }}
         onPointerMove={(event) => {
           if (!drag.current) return
           const dx = pt(event.clientX) - drag.current.x
           const dy = pt(event.clientY) - drag.current.y
           drag.current = { x: pt(event.clientX), y: pt(event.clientY) }
           move(dx, dy)
         }}
         onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}>
      <Face w={fit ? fit.w * 2 : 58} h={fit ? fit.h * 2 : 58} b={fit ? fit.b : 29} roll={roll} />
    </div>
  )
  return (
    <div className="sv-trackwell" ref={well}>
      <i className="sv-trackwell-probe" aria-hidden="true" />
      <i className="sv-trackwell-probe" aria-hidden="true" style={{ left: '100%' }} />
      <i className="sv-trackwell-probe" aria-hidden="true" style={{ left: '100%', top: '100%' }} />
      <i className="sv-trackwell-probe" aria-hidden="true" style={{ top: '100%' }} />
      <i className="sv-trackwell-probe" aria-hidden="true" style={{ left: '50%', top: '50%', transform: `translateZ(${PROBE_LIFT}px)` }} />
      {fit && well.current?.closest('.sv-root') ? createPortal(theBall, well.current.closest('.sv-root')) : theBall}
    </div>
  )
}

export default {
  id: 'severed',
  name: 'Severed',
  thumbnail,
  description: 'A desk terminal for doing mysterious and important work. Soothing scanlines and a phosphor glow pour over your music library. '
    + 'Uniquely suited for macrodata refinement.',
  colorScheme: 'dark',
  strings,
  tokens,
  // The plastic changes with the variant; the screen is a tube and stays dark, so both keep the
  // dark scheme for the controls drawn on it.
  variants: {
    light: { tokens: {}, colorScheme: 'dark', thumbnail },
    dark: { tokens: {}, colorScheme: 'dark', thumbnail: darkThumbnail },
  },
  Shell,
}
