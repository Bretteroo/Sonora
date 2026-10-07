import React, { useEffect, useRef, useState } from 'react'
import { isLoaded } from '../../frontend/src/lib/transport.js'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { describeNowPlaying, orderedHouseholds, streamFileName, twoLineMetadata, systemChoiceMatters } from '../../frontend/src/lib/format.js'
// The same member resolution the web themes and Sonofuture use.
import { membersOf } from '../../frontend/src/lib/rooms.js'
import * as Icon from '../../frontend/src/components/Icons.jsx'
import Battery, { batteryShown } from '../../frontend/src/components/Battery.jsx'

// The Rooms pane: a 32px "Rooms" header, one tile per group, and a 32px
// "Pause All" footer. Each tile, from the application's cell view: a row of
// 35px per device (label 22px, top-aligned), a 34px group button at the top
// right (11px down, 14px in), and a bottom row of a 28x25 transport indicator
// at x=3 with a 22px marquee of what is playing beside it.

// `idlePlayDisabled`: the Mac app grays "Play <room>" for a room with no
// music selected (2026-09-15); the Windows app lights it regardless.
// `s2System`: the S2 Mac app heads this pane "System" where the S1 app says
// "Rooms" (2026-09-15); the Mac shell turns it on, and the title follows
// which systems are showing.
export default function Rooms({ groups, zones, activeId, onSelect, onGroup, onPauseAll, onEq, plainNames = false, idlePlayDisabled = false, s2System = false, households = [], systemFilter = 'all', onSystem = null }) {
  const { t } = useI18n()
  const anyPlaying = groups.some((g) => g.transport?.state === 'PLAYING')

  return (
    <section className="dk-pane" aria-label={t('desk.rooms.title')}>
      <div className="dk-header">
        <h2 className="dk-header-title">{s2System && households.length > 0
          && households.filter((h) => systemFilter === 'all' || h.id === systemFilter).every((h) => h.generation === 'S2')
          ? t('desk.rooms.system') : t('desk.rooms.title')}</h2>
        {/* Which system's rooms to show, at the header's right (moved here
            from the transport strip at the user's request, 2026-09-06). */}
        {onSystem && systemChoiceMatters(households) && (
          <label className="dk-strip-select dk-rooms-system">
            <span className="dk-sr-only">{t('desk.showSystem')}</span>
            <select value={systemFilter ?? 'all'} onChange={(event) => onSystem(event.target.value)}>
              {orderedHouseholds(households).map((h) => (
                <option key={h.id} value={h.id}>{h.generation}</option>
              ))}
              <option value="all">{t('desk.rooms.allSystems')}</option>
            </select>
          </label>
        )}
      </div>
      <div className="dk-scroll">
        <div className="dk-rooms-list">
          {groups.map((group) => (
            <Tile
              key={group.id}
              group={group}
              zones={zones}
              active={group.coordinator === activeId}
              onSelect={() => onSelect(group.coordinator)}
              onGroup={() => onGroup(group)}
              onEq={onEq}
              plainNames={plainNames} idlePlayDisabled={idlePlayDisabled}
            />
          ))}
        </div>
      </div>
      <div className="dk-footer">
        <button type="button" disabled={!anyPlaying} onClick={onPauseAll}>
          {t('desk.rooms.pauseAll')}
        </button>
      </div>
    </section>
  )
}

function Tile({ group, zones, active, onSelect, onGroup, onEq, plainNames, idlePlayDisabled = false }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const transport = group.transport ?? {}
  const now = describeNowPlaying(transport, t)
  const state = transport.state
  const Indicator = state === 'PLAYING' ? Icon.Play
    : state === 'PAUSED_PLAYBACK' ? Icon.Pause : Icon.Stop
  // The Windows app draws its own 8x9 state bitmaps here, not the transport
  // glyphs; both are rendered and the theme hides the one it does not use.
  const WinIndicator = state === 'PLAYING' ? Icon.WinTilePlay
    : state === 'PAUSED_PLAYBACK' ? Icon.WinTilePause : Icon.WinTileStop
  // The coordinator first and the rest by name, as the S1 Windows app lists a
  // group, even a seven-room group that had been joined in another order
  // (2026-09-29). The
  // speakers report members in the order they joined.
  const members = (() => {
    const all = membersOf(group, zones)
    const lead = all.filter((z) => z.uuid === group.coordinator)
    const rest = all.filter((z) => z.uuid !== group.coordinator)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    return [...lead, ...rest]
  })()
  // The app's line under the room (observed 2026-09-05): the station's name
  // for a station, otherwise "Title - Artist"; a stream's own text as given.
  // A plain http stream (Music Assistant, Home Assistant) is not a station
  // to the app: it shows "Title - Artist", and the file's name when the
  // stream carries no title at all (observed: "6d92…767.mp3?authSig=…").
  const lines = twoLineMetadata(transport, t)
  // A room holding nothing -- its queue emptied, no track, no station --
  // reads "[No music selected]" with no state glyph, as the Windows app's
  // room tile did over a cleared queue (2026-09-29).
  const empty = !transport.track_uri && !(transport.queue_length > 0)
    && !/^x-(sonosapi|rincon-mp3radio|sonos-htastream|rincon-stream)/.test(transport.media_uri || '')
    && transport.source !== 'tv' && transport.source !== 'line_in'
  const marquee = [lines.line1, lines.line2].filter(Boolean).join(' - ')
    || streamFileName(transport.track_uri)
    || now.detail || (transport.source === 'idle' ? t('common.noMusicSelected')
      : empty ? t('desk.now.noMusic') : '')
  // A big group lists six rooms and "Show N More…"; from seven devices up the
  // app drops that to five, so the link never hides a single room
  // (ZoneGroupViewModel.Update).
  const [expanded, setExpanded] = useState(false)
  const limit = members.length >= 7 ? 5 : 6
  const shown = expanded ? members : members.slice(0, limit)
  const hidden = members.length - shown.length
  const playable = isLoaded(transport)
  // The menu says Stop rather than Pause for anything the player will
  // not pause: a television or line-in feed, and a broadcast stream,
  // which is what the app shows for a TuneIn station (2026-09-07).
  const fixed = ['tv', 'line_in'].includes(transport.source) || transport.can_pause === false
  // Right-click menu, as zonegroupcontrol.xaml's ContextMenu: for a group,
  // "Play/Pause Group" and "Mute/Unmute Group", a rule, then the device row
  // under the pointer's "Mute <room>" and "<room> EQ…"; a single room gets
  // "Play <room>" in place of the group items.
  const [menu, setMenu] = useState(null)
  const openMenu = (event) => {
    event.preventDefault()
    const row = event.target.closest('.dk-tile-device')
    const index = row ? [...row.parentNode.querySelectorAll('.dk-tile-device')].indexOf(row) : -1
    setMenu({ x: event.clientX, y: event.clientY, zone: shown[index] || members[0] })
  }

  return (
    <div
      className="dk-tile"
      role="button"
      tabIndex={0}
      aria-pressed={active}
      aria-label={t('common.setActive', { room: group.name })}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect() }
      }}
      onContextMenu={openMenu}
    >
      <div className="dk-tile-devices">
        {shown.map((zone) => (
          <div key={zone.uuid} className="dk-tile-device" title={zone.model}>
            <span>{plainNames ? zone.name : (zone.topology_label || zone.name)}</span>
            {zone.online === false && <small>{t('desk.rooms.offline')}</small>}
            {/* A portable player's battery on its own line under the name, as
                zoneplayercontrol.xaml's adornment row. */}
            {batteryShown(zone) && <Battery battery={zone.battery} className="dk-tile-battery" />}
          </div>
        ))}
        {(hidden > 0 || expanded) && members.length > limit && (
          <button type="button" className="dk-tile-more" onClick={(event) => { event.stopPropagation(); setExpanded((v) => !v) }}>
            {expanded ? t('desk.rooms.showLess') : t('desk.rooms.showMore', { n: hidden })}
          </button>
        )}
      </div>
      {/* The browser room cannot be grouped, so it is not offered. */}
      {!group.local && (
        <button
          type="button"
          className="dk-tile-group"
          title={t('desk.grouping.title')}
          onClick={(event) => { event.stopPropagation(); onGroup() }}
        >
          <Icon.GroupRooms className="dk-tile-group-mac" />
          <Icon.RoomSpeaker className="dk-tile-group-win" />
        </button>
      )}
      <div className="dk-tile-now">
        {/* The state glyph is information only, as on the app's tiles. */}
        <span className="dk-tile-indicator" aria-hidden="true" style={empty && transport.source !== 'idle' ? { display: 'none' } : undefined}>
          <Indicator className="dk-tile-state-mac" />
          <WinIndicator className="dk-tile-state-win" />
        </span>
        <span className="dk-tile-marquee" title={marquee}>{marquee}</span>
      </div>
      {menu && menu.zone && (
        <TileMenu x={menu.x} y={menu.y} group={group} zone={menu.zone} state={state} fixed={fixed}
                  playDisabled={idlePlayDisabled && state !== 'PLAYING'
                    // A stopped station has no track but is loaded all the
                    // same: the Mac app offers "Play Group" for a stopped
                    // Lovers Rock Reggae (2026-09-29).
                    && !(zones[group.coordinator]?.transport?.track_uri || zones[group.coordinator]?.transport?.media_uri)}
                  onEq={group.local ? null : onEq} actions={actions} onClose={() => setMenu(null)} />
      )}
    </div>
  )
}

function TileMenu({ x, y, group, zone, state, fixed, onEq, actions, onClose, playDisabled = false }) {
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
  const grouped = group.members.length > 1
  const coordinator = group.coordinator
  const playing = state === 'PLAYING'
  const playKey = playing ? (fixed ? 'desk.rooms.menu.stop' : 'desk.rooms.menu.pause') : 'desk.rooms.menu.play'
  const subject = grouped ? t('desk.rooms.menu.group') : zone.name
  const groupMuted = Boolean(group.group_muted ?? zone.group_muted)
  const act = (fn) => (event) => { event.stopPropagation(); onClose(); fn() }
  const togglePlay = () => (playing ? (fixed ? actions.stop(coordinator) : actions.pause(coordinator)) : actions.play(coordinator))
  return (
    <div className="dk-popover dk-tile-menu" ref={ref} role="menu" style={{ position: 'fixed', left: x, top: y }}
         onClick={(event) => event.stopPropagation()} onContextMenu={(event) => event.preventDefault()}>
      {/* Lit even for a stopped room with an empty transport in the Windows
          app; grayed there in the Mac app, which passes playDisabled. */}
      <button type="button" role="menuitem" disabled={playDisabled} onClick={act(togglePlay)}>{t(playKey, { name: subject })}</button>
      {grouped && (
        <button type="button" role="menuitem" onClick={act(() => actions.setMute(coordinator, !groupMuted, true))}>
          {t(groupMuted ? 'desk.rooms.menu.unmute' : 'desk.rooms.menu.mute', { name: subject })}
        </button>
      )}
      <hr className="dk-popover-sep" />
      <button type="button" role="menuitem" onClick={act(() => actions.setMute(zone.uuid, !zone.muted, false))}>
        {t(zone.muted ? 'desk.rooms.menu.unmute' : 'desk.rooms.menu.mute', { name: zone.name })}
      </button>
      <button type="button" role="menuitem" disabled={!onEq} onClick={act(() => onEq?.(zone.uuid))}>{t('desk.rooms.menu.eq', { name: zone.name })}</button>
    </div>
  )
}
