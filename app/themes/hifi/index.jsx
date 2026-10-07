import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { orderedHouseholds, systemChoiceMatters } from '../../frontend/src/lib/format.js'
import { useSleepTimer } from '../../frontend/src/lib/useSleepTimer.js'
import { useNarrow } from '../../frontend/src/lib/useNarrow.js'
import { useShellSelection } from '../../frontend/src/lib/shellSelection.js'
import { isTyping, isCommand, keyOf, shuffleToggled, repeatCycled } from '../../frontend/src/lib/keys.js'
import AboutSonora from '../../frontend/src/components/AboutSonora.jsx'
import * as G from './glyphs.jsx'
import { IconKey, Menu, MenuItem, MenuSep, Confirm } from './controls.jsx'
import { FUNCTION_KEY, readStored, writeStored, useServices, useLibraryPresence, useAccountChoice, useFavorites, usePlaylists, useRecent,
         useWholeQueue, householdOf, zoneForHousehold, playItems, togglePlay, groupTitle, describeFavorite, isQueueable, favoriteTarget } from './house.js'
import Preamp, { RemoteHead, FunctionKeys, SystemSwitch, FUNCTIONS } from './Preamp.jsx'
import ZonesUnit, { ToneControl, SpeakerSelector } from './Zones.jsx'
import TunerUnit, { AddToPlaylistSheet, AddRadioSheet } from './Tuner.jsx'
import TapeUnit from './Tape.jsx'
import TimerUnit, { SleepPanel } from './Timer.jsx'
import SetupUnit, { LinkServiceSheet, ShortcutsSheet } from './Setup.jsx'
import InfoPanel, { ProsePanel } from './Info.jsx'
import { tokens, lightTokens } from './tokens.js'
import './hifi.css'
import thumbnail from './thumbnail.webp'
import lightThumbnail from './thumbnail-light.webp'
import strings from './strings.js'
import { useThemeLanding } from '../../frontend/src/lib/theme.jsx'

// Hi-Fi: the house as a rack of audio components.
//
// At the top of the rack sits the control amplifier, always in reach: what
// the zone in view plays on its display, a record turning on its platter,
// the transport keys and the volume knob. Its function selector
// decides which component fills the bay beneath it -- the zone amplifier
// with a module per group, the source tuner with its preset dial, the queue
// deck, the program timer, or the rear panel where the settings are. On a
// phone the rack folds into a remote control: the amplifier's display and
// keys at the top, the component under them, the function keys along the
// foot.

const REMOTE = '(max-width: 760px)'

// A phone's browser asked for the desktop site (Firefox for Android's
// "Desktop site"): the page is laid out 980px wide on a screen under 760px,
// with no hover. Rather than the narrow-window stacking that 980px would
// get, the rack is drawn at the desktop's 1440px and zoomed to the page,
// so it looks as it does on a desktop. The narrow-
// window rules in hifi.css skip :root[data-desktop-mode].
const DESKTOP_WIDTH = 1440
function desktopModeZoom() {
  if (typeof window === 'undefined') return 0
  const touch = window.matchMedia?.('(hover: none)').matches
  const small = Math.min(window.screen?.width || 0, window.screen?.height || 0) < 760
  const wide = window.innerWidth > 760
  return touch && small && wide && window.innerWidth < DESKTOP_WIDTH ? window.innerWidth / DESKTOP_WIDTH : 0
}
function useDesktopMode(remote) {
  useEffect(() => {
    const root = document.documentElement
    const apply = () => {
      const zoom = remote ? 0 : desktopModeZoom()
      if (zoom) { root.dataset.desktopMode = ''; root.style.zoom = String(zoom) }
      else { delete root.dataset.desktopMode; root.style.zoom = '' }
    }
    apply()
    window.addEventListener('resize', apply)
    return () => { window.removeEventListener('resize', apply); delete root.dataset.desktopMode; root.style.zoom = '' }
  }, [remote])
}

export function Shell() {
  const { zones, groups, households, connected, actions, notices, dismiss, servicesEpoch, recentEpoch, favoritesEpoch: savedEpoch, playlistsEpoch } = useSystem()
  const { t } = useI18n()
  const [fn, setFnState] = useState(() => (FUNCTIONS.includes(readStored(FUNCTION_KEY)) ? readStored(FUNCTION_KEY) : 'zones'))
  const setFn = useCallback((id) => { setFnState(id); writeStored(FUNCTION_KEY, id) }, [])
  const { activeId, activeGroup, activeZone, visibleGroups, visibleZones,
          systemFilter, chooseSystem, select } = useShellSelection({ byMember: true, preferAllWhenMany: true })
  const remote = useNarrow(REMOTE)
  useDesktopMode(remote)
  const [setupPage, setSetupPage] = useState('services')
  // Chosen just now from the theme chooser: open on this theme's own theme page.
  useThemeLanding(() => { setSetupPage('appearance'); setFn('setup') })
  const [linkSheet, setLinkSheet] = useState(null)
  const [tone, setTone] = useState(null)
  const [info, setInfo] = useState(null)
  const [prose, setProse] = useState(null)
  const [sleepOpen, setSleepOpen] = useState(false)
  const [addRadio, setAddRadio] = useState(false)
  const [linking, setLinking] = useState(null)
  const [addTo, setAddTo] = useState(null)
  const [about, setAbout] = useState(false)
  const [shortcuts, setShortcuts] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [quickMenu, setQuickMenu] = useState(null)
  const [tunerRequest, setTunerRequest] = useState(null)
  const [toasts, setToasts] = useState([])
  // Bumped when this theme saves or removes a favorite; savedEpoch and playlistsEpoch are the
  // store's, bumped when the speakers announce a change made anywhere (another app included).
  const [favoritesEpoch, setFavoritesEpoch] = useState(0)
  const [servicesVersion, setServicesVersion] = useState(0)
  const [queueEdited, setQueueEdited] = useState(false)

  // --- what every component shares --------------------------------------------------
  const services = useServices(servicesVersion + servicesEpoch)
  const libraryByHh = useLibraryPresence(households, servicesVersion)
  const [accountChoice, pickAccount] = useAccountChoice()
  const activeHousehold = activeZone ? householdOf(households, activeZone.uuid) : null
  const hzone = activeZone?.uuid || ''
  // "This browser" belongs to no system, so its presets are the favorites of
  // the system the switch has chosen, or of the first when it shows all,
  // read through one of that system's rooms. Each carries that room, so
  // playing one in the browser knows which household resolves it.
  const favoritesZone = activeZone?.local
    ? (zoneForHousehold(households, zones, null,
        (households.find((h) => h.id === systemFilter) || orderedHouseholds(households)[0])?.id)?.uuid || '')
    : hzone
  const readFavorites = useFavorites(favoritesZone, favoritesEpoch + savedEpoch)
  const favorites = useMemo(() => (activeZone?.local
    ? { ...readFavorites, items: readFavorites.items.map((item) => ({ ...item, hzone: item.hzone || favoritesZone })) }
    : readFavorites), [readFavorites, activeZone?.local, favoritesZone])
  usePlaylists(hzone, favoritesEpoch + playlistsEpoch)
  const recent = useRecent(hzone, recentEpoch)
  // A queue can run past the 500 rows a single read returns.
  const queue = useWholeQueue(activeZone)
  const sleep = useSleepTimer(activeZone?.uuid)
  useEffect(() => { setQueueEdited(false) }, [activeZone?.uuid])

  const toast = useCallback((text) => {
    if (!text) return
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev.slice(-3), { id, text }])
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 3600)
  }, [])

  // --- playing from a preset or the memory -------------------------------------------
  const playItem = useCallback(async (item, sourceId, how = 'now') => {
    if (!activeZone) return
    if (how === 'now' || how === 'replace') setQueueEdited(false)
    const done = await playItems(actions, [item], how,
                                 // The browser room needs to say which household's
                                 // service should resolve the item.
                                 { hzone: activeZone.uuid, from: activeZone.local ? (item.hzone || '') : '' })
    if (done) toast(t(how === 'now' ? 'hifi.playingNow' : how === 'next' ? 'hifi.queuedNext' : how === 'replace' ? 'hifi.replacedQueue' : 'hifi.addedToQueue', { title: item.title }))
  }, [activeZone, actions, toast, t])
  const openFavorite = useCallback((item) => {
    if (!activeZone || !activeHousehold) return
    const { svc, account, kind } = favoriteTarget((services.byHousehold[activeHousehold.id] || []).filter((s) => s.id === item.service_id), item,
                                                  accountChoice[`${activeHousehold.id}:${item.service_id}`])
    setTunerRequest({ n: Date.now(), kind: 'node',
      path: [{ id: 'FV:2', title: t('desk.browse.favorites'), item: 'root', hzone: activeZone.uuid, hh: activeHousehold.id, glyph: 'star' }],
      node: { id: `${item.service_id}:${item.browse_id}`, title: item.title, service: item.service_id, item: item.browse_id, hzone: activeZone.uuid, hh: activeHousehold.id,
              account, icon: svc?.icon || '', kind, uri: item.uri, metadata: item.metadata, art: item.art, serviceName: svc?.name || '' } })
    setFn('tuner')
  }, [activeZone, activeHousehold, services.byHousehold, accountChoice, setFn, t])
  const browseSource = useCallback((id) => { setTunerRequest({ n: Date.now(), kind: 'source', id }); setFn('tuner') }, [setFn])
  const serviceNameOf = useCallback((uri, sidFallback = null) => {
    const sid = Number((/[?&]sid=(\d+)/.exec(uri || '') || [])[1]) || sidFallback
    if (!sid || !activeHousehold) return ''
    return (services.byHousehold[activeHousehold.id] || []).find((s) => s.id === sid)?.name || ''
  }, [services.byHousehold, activeHousehold])

  // --- info and the paths out of it -------------------------------------------------------
  const openInfoForNow = () => { if (activeZone) setInfo({ now: true }) }
  const openInfoForItem = (item, ctx = {}) => setInfo({ item, hzone: ctx.hzone || activeZone?.uuid, serviceName: ctx.serviceName || serviceNameOf(item.uri, item.service_id), source: ctx.source || '' })
  const infoOpen = (node) => {
    if (node.prose) { setProse({ ...node, hzone: info?.hzone || activeZone?.uuid }); return }
    // Album Info and its kind open the item's own Info & Options, as the desktop apps' do.
    if (node.info) { setProse(null); setInfo({ item: node.item, hzone: info?.hzone || activeZone?.uuid, serviceName: node.serviceName || '' }); return }
    const hh = activeHousehold?.id
    setInfo(null); setProse(null)
    setTunerRequest({ n: Date.now(), kind: 'node', node: { ...node, hzone: info?.hzone || activeZone?.uuid, hh, icon: node.icon || '' } })
    setFn('tuner')
  }

  // --- keyboard ---------------------------------------------------------------------------
  const anyLayer = linkSheet || tone || info || prose || sleepOpen || addRadio || linking || addTo || about || shortcuts || confirm
  useEffect(() => {
    const onKey = (event) => {
      const typing = isTyping(event)
      const cmd = isCommand(event)
      const key = keyOf(event)
      if (cmd && key === 'f') { event.preventDefault(); setFn('tuner'); setTunerRequest({ n: Date.now(), kind: 'focus' }); return }
      if (cmd && key === 'g') { event.preventDefault(); setFn('tape'); return }
      if (cmd && (key === '*' || (event.shiftKey && key === '8'))) { event.preventDefault(); browseSource('FV:2'); return }
      if (cmd && /^[1-5]$/.test(key)) { event.preventDefault(); setFn(FUNCTIONS[Number(key) - 1]); return }
      if (cmd && event.shiftKey && key === 'x') { event.preventDefault(); if (activeZone) actions.setCrossfade(activeZone.uuid, !activeZone.transport?.crossfade); return }
      if (typing || anyLayer) return
      if (event.key === '?') { event.preventDefault(); setShortcuts(true); return }
      if (!activeZone) return
      const tr = activeZone.transport || {}
      const mode = tr.play_mode || 'NORMAL'
      if (event.key === ' ' || (cmd && key === 'p')) {
        // A focused key or knob keeps Space for itself.
        if (event.target?.closest?.('button, [role="slider"], input, label')) return
        event.preventDefault(); togglePlay(actions, activeZone)
      }
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
  }, [activeZone, activeGroup, visibleGroups, groups, actions, select, anyLayer, browseSource, setFn])

  const ordered = orderedHouseholds(households)
  const groupLabel = activeGroup ? groupTitle(activeGroup, zones, t) : ''
  const rooms = visibleZones.length
  // The amplifier's model number: the system the switch has chosen, or the
  // one generation a house has; with both in view it names neither.
  const pickedHousehold = ordered.find((h) => h.id === systemFilter)
  const generations = [...new Set(ordered.map((h) => h.generation).filter(Boolean))]
  const generation = pickedHousehold?.generation || (generations.length === 1 ? generations[0] : '')
  const systemSwitch = systemChoiceMatters(households)
    ? <SystemSwitch households={ordered} value={systemFilter} onChange={chooseSystem} small={remote} /> : null
  const onLink = () => { if (activeGroup) setLinkSheet(activeGroup) }

  const Bay = fn === 'zones' ? (
    <ZonesUnit groups={visibleGroups} zones={zones} households={households} systemFilter={systemFilter} activeId={activeGroup?.coordinator}
               onSelect={select} onLink={setLinkSheet} onTone={setTone} onSleep={() => setSleepOpen(true)} onMessage={toast}
               systemSwitch={remote ? systemSwitch : null} />
  ) : fn === 'tuner' ? (
    <TunerUnit households={households} zones={zones} groups={groups} roomGroups={visibleGroups} onSelectRoom={select}
               systemFilter={systemFilter} activeZone={activeZone} roomChosen={Boolean(activeId)}
               servicesByHh={services.byHousehold} servicesRaw={services.raw} libraryByHh={libraryByHh} accountChoice={accountChoice} pickAccount={pickAccount}
               request={tunerRequest} onMessage={toast} onInfo={openInfoForItem} onLinkService={setLinking} onAddRadio={() => setAddRadio(true)}
               favoritesEpoch={favoritesEpoch} onFavoritesChanged={() => setFavoritesEpoch((v) => v + 1)} servicesVersion={servicesVersion + servicesEpoch}
               queueEdited={queueEdited} onQueueReplaced={() => setQueueEdited(false)}
               favorites={favorites} recent={recent} onPlayItem={playItem}
               onItemMenu={(item, sourceId, event) => setQuickMenu({ item, sourceId, x: event.clientX, y: event.clientY })} />
  ) : fn === 'tape' ? (
    <TapeUnit zone={activeZone} name={groupLabel} queue={queue} onMessage={toast} onEdited={() => setQueueEdited(true)}
              onInfo={(item) => openInfoForItem(item, { hzone: activeZone?.uuid })} />
  ) : fn === 'timer' ? (
    <TimerUnit households={households} zones={zones} activeZone={activeZone} activeGroup={activeGroup} systemFilter={systemFilter} />
  ) : (
    <SetupUnit households={households} zones={zones} page={setupPage} setPage={setSetupPage}
               onLinkService={setLinking} servicesVersion={servicesVersion + servicesEpoch} onServicesChanged={() => setServicesVersion((v) => v + 1)}
               onMessage={toast} onAbout={() => setAbout(true)} onShortcuts={() => setShortcuts(true)} />
  )

  // On a phone the head folds to one line while the bay is scrolled, so the
  // unit below has the screen. It folds only when
  // there is more to scroll than the fold gives back, else the bay would
  // stop scrolling, unfold, and fold again; it opens at the top, on a tap,
  // and with a new function.
  const [headFolded, setHeadFolded] = useState(false)
  const bayRef = useRef(null)
  useEffect(() => { setHeadFolded(false) }, [fn, remote])
  useEffect(() => {
    const bay = bayRef.current
    if (!remote || !bay) return undefined
    const onScroll = (event) => {
      const el = event.target
      if (!(el instanceof Element)) return
      const top = el.scrollTop
      if (top <= 0) setHeadFolded(false)
      else if (top > 40 && el.scrollHeight - el.clientHeight > 260) setHeadFolded(true)
    }
    bay.addEventListener('scroll', onScroll, { capture: true, passive: true })
    return () => bay.removeEventListener('scroll', onScroll, { capture: true })
  }, [remote, fn])

  const head = {
    zone: activeZone, group: activeGroup, zones, groups: visibleGroups, onSelect: select,
    sleepRemaining: sleep.remaining,
    // A lit sleep key turns the timer off at the press; an unlit one opens
    // the durations.
    onSleep: () => (sleep.remaining ? sleep.set(null) : setSleepOpen(true)), onInfo: openInfoForNow, onLink,
    connected, rooms, onAbout: () => setAbout(true), systemSwitch, generation, onMessage: toast,
  }

  return (
    <div className="hf-root" data-remote={remote || undefined} data-fn={fn}>
      <div className="hf-rack">
        {remote ? <RemoteHead {...head} collapsed={headFolded} onExpand={() => setHeadFolded(false)} />
          : <Preamp {...head} fn={fn} onFunction={setFn} />}
        <main className="hf-bay" key={fn} ref={bayRef} aria-label={t(`hifi.fn.${fn}`)}>{Bay}</main>
        {remote && <FunctionKeys value={fn} onChange={setFn} />}
      </div>

      {linkSheet && <SpeakerSelector group={groups.find((g) => g.id === linkSheet.id) || linkSheet} zones={zones} households={households} onClose={() => setLinkSheet(null)} />}
      {tone && <ToneControl uuid={tone} households={households} onClose={() => setTone(null)} />}
      {info && !prose && (
        <InfoPanel zone={info.now ? activeZone : null} item={info.now ? null : info.item} hzone={info.now ? activeZone?.uuid : info.hzone}
                   serviceName={info.now ? (activeZone?.transport?.service_name || serviceNameOf(activeZone?.transport?.media_uri, activeZone?.transport?.service_id)) : info.serviceName}
                   onClose={() => setInfo(null)} onMessage={toast} onOpen={infoOpen} onFavoritesChanged={() => setFavoritesEpoch((v) => v + 1)}
                   onAddToPlaylist={(pick, source) => setAddTo({ picks: [pick], source: source || info.source || '', hzone: info.now ? activeZone?.uuid : info.hzone })}
                   services={Object.values(services.byHousehold || {}).flat()} />
      )}
      {prose && <ProsePanel node={prose} onClose={() => { setProse(null); setInfo(null) }} onBack={() => setProse(null)} />}
      {addTo && <AddToPlaylistSheet picks={addTo.picks} source={addTo.source} hzone={addTo.hzone} onClose={() => setAddTo(null)} onMessage={toast} />}
      {sleepOpen && <SleepPanel zone={activeZone} groupLabel={groupLabel} onClose={() => setSleepOpen(false)} />}
      {addRadio && <AddRadioSheet zone={activeZone} onClose={() => setAddRadio(false)} onAdded={(r) => toast(t(r.exists ? 'desk.radio.exists' : 'desk.radio.added', { title: r.title }))} />}
      {linking && <LinkServiceSheet households={households} preset={linking} onClose={() => setLinking(null)} onLinked={() => setServicesVersion((v) => v + 1)} />}
      {about && <AboutSonora onClose={() => setAbout(false)} />}
      {shortcuts && <ShortcutsSheet onClose={() => setShortcuts(false)} />}
      {confirm && <Confirm title={confirm.title} body={confirm.body} action={confirm.action} onConfirm={() => { setConfirm(null); confirm.onConfirm() }} onClose={() => setConfirm(null)} />}
      {quickMenu && (
        <Menu x={quickMenu.x} y={quickMenu.y} onClose={() => setQuickMenu(null)} title={quickMenu.item.title}>
          <MenuItem icon={<G.Play />} onSelect={() => { setQuickMenu(null); playItem(quickMenu.item, quickMenu.sourceId, 'now') }}>{t('desk.actions.playNow')}</MenuItem>
          {isQueueable(quickMenu.item) && (
            <>
              <MenuItem icon={<G.Next />} onSelect={() => { setQuickMenu(null); playItem(quickMenu.item, quickMenu.sourceId, 'next') }}>{t('desk.actions.playNext')}</MenuItem>
              <MenuItem icon={<G.Tape />} onSelect={() => { setQuickMenu(null); playItem(quickMenu.item, quickMenu.sourceId, 'add') }}>{t('desk.actions.addToQueue')}</MenuItem>
              <MenuItem icon={<G.Refresh />} onSelect={() => { setQuickMenu(null); playItem(quickMenu.item, quickMenu.sourceId, 'replace') }}>{t('desk.actions.replaceQueue')}</MenuItem>
            </>
          )}
          <MenuSep />
          {quickMenu.item.browse_id && quickMenu.item.service_id && (
            <MenuItem icon={<G.Chevron />} onSelect={() => { setQuickMenu(null); openFavorite(quickMenu.item) }}>{t('hifi.open')}</MenuItem>
          )}
          {/* Recently played is the speakers' own list, not a source the
              tuner can open, so it has no row to show. */}
          {quickMenu.sourceId && quickMenu.sourceId !== 'recent' && (
            <MenuItem icon={<G.Tuner />} onSelect={() => { setQuickMenu(null); browseSource(quickMenu.sourceId) }}>{t('hifi.showInTuner')}</MenuItem>
          )}
          {quickMenu.item.uri && (
            <MenuItem icon={<G.Info />} onSelect={() => { setQuickMenu(null); openInfoForItem({ ...quickMenu.item, favoriteDescription: describeFavorite(quickMenu.item, serviceNameOf(quickMenu.item.uri, quickMenu.item.service_id)) }, { hzone: activeZone?.uuid, source: quickMenu.sourceId }) }}>{t('desk.now.infoOptions')}</MenuItem>
          )}
        </Menu>
      )}

      <div className="hf-toasts" aria-live="polite">
        {!connected && <div className="hf-toast hf-toast-warn"><G.Signal />{t('common.reconnecting')}</div>}
        {notices.map((notice) => (
          <div key={notice.id} className="hf-toast hf-toast-notice">
            <div><strong>{t(notice.titleKey)}</strong><span>{notice.detail || (notice.detailKey ? t(notice.detailKey, notice.detailParams) : '')}</span></div>
            <IconKey label={t('common.dismiss')} onClick={() => dismiss(notice.id)}><G.Close /></IconKey>
          </div>
        ))}
        {toasts.map((x) => <div key={x.id} className="hf-toast" role="status">{x.text}</div>)}
      </div>
    </div>
  )
}

export default {
  id: 'hifi',
  name: 'Hi-Fi',
  version: '1.0.0',
  thumbnail,
  description: 'Your house as a rack of high-fidelity components: a control amplifier with a turning record, a glowing display, '
    + 'and a volume knob, over a zone amplifier, a source tuner with a preset dial, a cassette deck for the queue, a program timer, '
    + 'and a rear panel of settings. Black anodized with an amber display, or brushed silver by daylight.',
  colorScheme: 'dark',
  strings,
  tokens,
  // Black is the rack's own finish; silver is the same equipment by day.
  // Declaring both draws the chooser's Light/Dark/System buttons, and each
  // finish carries its own still.
  variants: {
    dark: { tokens: {}, colorScheme: 'dark', thumbnail },
    light: { tokens: lightTokens, colorScheme: 'light', thumbnail: lightThumbnail },
  },
  Shell,
}
