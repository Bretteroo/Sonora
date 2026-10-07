import React, { useRef, useState } from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import Art, { nowPlayingArt } from '../../frontend/src/components/Art.jsx'
import { orderedHouseholds } from '../../frontend/src/lib/format.js'
import { dayPart } from '../../frontend/src/lib/playlistName.js'
import * as I from './icons.jsx'
import { IconButton, Slider, Menu, MenuItem, MenuSep, Button, Empty, SystemPicker } from './ui.jsx'
import { nowSummary, nextTransport, togglePlay, isLoaded, canSkip, canNext, canPrevious, pauseEverything, hasMusic, isOnAir, genericArt, householdOf } from './house.js'
import Battery, { groupBattery } from '../../frontend/src/components/Battery.jsx'

// Home: the house at a glance. One card per group with its artwork, what it
// plays, its transport and its volume; drop one card on another to group the
// rooms; the household's favorites and playlists as one-press starts for the
// room in view.

function GroupCard({ group, zones, active, onSelect, onGroupSheet, onRoomSettings, onSleep, onStage, showSystem }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const zone = zones[group.coordinator]
  const tr = zone?.transport || {}
  const summary = nowSummary(tr, t)
  const members = group.members.map((u) => zones[u]).filter(Boolean)
  const loaded = isLoaded(tr)
  const playing = tr.state === 'PLAYING' || tr.state === 'TRANSITIONING'
  const what = nextTransport(tr)
  const [menu, setMenu] = useState(null)
  if (!zone) return null
  const art = tr.source !== 'tv' ? nowPlayingArt(zone.host, tr) : []
  const title = members.length === 1 ? zone.name : `${zone.name} + ${members.length - 1}`
  return (
    <article className="sf-card" data-active={active || undefined} data-playing={playing || undefined}
             onClick={onSelect}
             onContextMenu={(event) => { event.preventDefault(); setMenu({ x: event.clientX, y: event.clientY }) }}>
      <button type="button" className="sf-card-art" onClick={(event) => { event.stopPropagation(); onSelect(); onStage() }} title={t('sf.openStage')}>
        {tr.source === 'tv' ? <I.Tv /> : <Art src={art} size={160} fallback="note" />}
        {playing && <span className="sf-eq sf-card-eq" data-on><i /><i /><i /></span>}
      </button>
      <div className="sf-card-body">
        <header className="sf-card-head">
          <h3 className="sf-card-title" title={members.map((m) => m.name).join(', ')}>
            {title}
            {showSystem && zone.generation && <span className="sf-tag">{zone.generation}</span>}
            {groupBattery(members) && <Battery battery={groupBattery(members)} className="sf-room-battery sf-card-battery" />}
          </h3>
          <IconButton size="sm" label={t('desk.browse.actions')} onClick={(event) => { event.stopPropagation(); setMenu({ x: event.clientX, y: event.clientY }) }}><I.Ellipsis /></IconButton>
        </header>
        {members.length > 1 && (
          <p className="sf-card-members">{members.map((m) => m.name).join(' · ')}</p>
        )}
        <p className="sf-card-now" title={[summary.title, summary.sub].filter(Boolean).join(' — ')}>
          {loaded || summary.title ? (
            <>
              <span className="sf-card-track">{summary.title || t('desk.now.noMusic')}</span>
              {summary.sub && <span className="sf-card-sub">{summary.sub}</span>}
            </>
          ) : <span className="sf-card-idle">{t('common.noMusicSelected')}</span>}
        </p>
      </div>
        <div className="sf-card-controls" onClick={(event) => event.stopPropagation()}>
          <IconButton size="sm" label={t('common.previous')} disabled={!canPrevious(tr)} onClick={() => actions.previous(zone.uuid)}><I.Prev /></IconButton>
          <button type="button" className="sf-play sf-play-sm" disabled={!loaded} onClick={() => togglePlay(actions, zone)}
                  title={what === 'play' ? t('common.play') : what === 'stop' ? t('common.stop') : t('common.pause')}>
            {what === 'play' ? <I.Play /> : what === 'stop' ? <I.Stop /> : <I.Pause />}
          </button>
          <IconButton size="sm" label={t('common.next')} disabled={!canNext(tr)} onClick={() => actions.next(zone.uuid)}><I.Next /></IconButton>
          <IconButton size="sm" label={zone.group_muted ? t('common.unmute') : t('common.mute')} onClick={() => actions.setMute(zone.uuid, !zone.group_muted, true)}>
            {zone.group_muted ? <I.Muted /> : <I.Volume />}
          </IconButton>
          <Slider value={zone.group_volume ?? 0} label={t('desk.transport.groupVolume')} onCommit={(level) => actions.setGroupVolume(zone.uuid, level)} />
        </div>
      {menu && (
        <Menu x={menu.x} y={menu.y} onClose={() => setMenu(null)} title={title}>
          <MenuItem icon={what === 'play' ? <I.Play /> : what === 'stop' ? <I.Stop /> : <I.Pause />} disabled={!loaded}
                    onSelect={() => { setMenu(null); togglePlay(actions, zone) }}>
            {t(what === 'play' ? 'desk.rooms.menu.play' : what === 'stop' ? 'desk.rooms.menu.stop' : 'desk.rooms.menu.pause', { name: members.length > 1 ? t('desk.rooms.menu.group') : zone.name })}
          </MenuItem>
          <MenuItem icon={zone.group_muted ? <I.Volume /> : <I.Muted />} onSelect={() => { setMenu(null); actions.setMute(zone.uuid, !zone.group_muted, true) }}>
            {t(zone.group_muted ? 'desk.rooms.menu.unmute' : 'desk.rooms.menu.mute', { name: members.length > 1 ? t('desk.rooms.menu.group') : zone.name })}
          </MenuItem>
          <MenuSep />
          {!group.local && <MenuItem icon={<I.Rooms />} onSelect={() => { setMenu(null); onGroupSheet(group) }}>{t('desk.grouping.title')}</MenuItem>}
          <MenuItem icon={<I.Moon />} onSelect={() => { setMenu(null); onSelect(); onSleep() }}>{t('desk.browse.sleepTimer')}</MenuItem>
          <MenuSep />
          {members.map((m) => (
            /* An output has no equalizer to set. */
            m.local ? null : <MenuItem key={m.uuid} icon={<I.Sliders />} onSelect={() => { setMenu(null); onRoomSettings(m.uuid) }}>{t('desk.rooms.menu.eq', { name: m.name })}</MenuItem>
          ))}
        </Menu>
      )}
    </article>
  )
}

// A one-press start: a favorite or a Sonos playlist for the room in view.
function QuickTile({ item, onPlay, onOpen, onMenu, kind }) {
  const { t } = useI18n()
  const unavailable = item.available === false
  const opens = kind === 'favorite' && item.browse_id && item.service_id && !unavailable
  return (
    <div className="sf-quick" role="button" tabIndex={0} aria-disabled={unavailable || undefined} title={item.title}
         onClick={() => (unavailable ? null : onPlay(item))}
         onKeyDown={(event) => { if (event.key === 'Enter') onPlay(item) }}
         onContextMenu={(event) => { event.preventDefault(); onMenu(item, event) }}>
      <span className="sf-quick-art">
        {kind === 'playlist' ? <span className="sf-quick-glyph"><I.Playlist /></span>
          : unavailable ? <span className="sf-quick-glyph"><I.Warning /></span>
          : <Art src={item.art} size={96} fallback={genericArt(item)} brokenFallback={genericArt(item)} />}
        <span className="sf-quick-play" aria-hidden="true"><I.Play /></span>
      </span>
      <span className="sf-quick-title">{item.title}</span>
      <span className="sf-quick-sub">{kind === 'playlist' ? t('desk.browse.playlists') : (item.description || item.service_name || '')}</span>
      {opens && (
        <button type="button" className="sf-quick-open" title={t('sf.open')} onClick={(event) => { event.stopPropagation(); onOpen(item) }}><I.Chevron /></button>
      )}
    </div>
  )
}

export default function Home({ groups, zones, households, systemFilter, onSystem, activeId, activeZone, onSelect, onGroupSheet, onRoomSettings, onSleep, onStage,
                               favorites, playlists, recent, onPlayItem, onOpenFavorite, onItemMenu, onBrowse, onMessage, onRooms }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const visible = orderedHouseholds(households).filter((h) => !systemFilter || systemFilter === 'all' || h.id === systemFilter)
  const showSystem = visible.length > 1
  const playingCount = groups.filter((g) => zones[g.coordinator]?.transport?.state === 'PLAYING').length
  const rooms = groups.reduce((n, g) => n + g.members.length, 0)
  const household = activeZone ? householdOf(households, activeZone.uuid) : null
  const greeting = t(`sf.greeting.${dayPart()}`)

  // Party mode: every room of the household in view joins the room in view.
  const partyMode = async () => {
    if (!activeZone || !household) return
    setBusy(true)
    for (const uuid of household.zone_uuids) {
      const z = zones[uuid]
      if (!z || uuid === activeZone.uuid) continue
      const g = groups.find((gr) => gr.members.includes(uuid))
      if (g && g.coordinator === activeZone.uuid) continue
      await actions.join(uuid, activeZone.uuid)
    }
    setBusy(false)
  }
  const anyPlaying = playingCount > 0
  // Home is about what is playing. A room with nothing on it belongs to the
  // Rooms page, which is the one that is about the speakers themselves.
  // The room in view stays whatever it is doing, so a favorite always has
  // somewhere to go.
  const live = groups.filter((g) => isOnAir(zones[g.coordinator]?.transport) || g.coordinator === activeId)
  const quiet = groups.length - live.length

  return (
    <div className="sf-home">
      <SystemPicker households={households} value={systemFilter} onChange={onSystem} label={t('desk.showSystem')} allLabel={t('sf.all')} />
      <header className="sf-page-head">
        <div>
          <h1>{greeting}</h1>
          <p className="sf-page-sub">
            {/* The line says what the cards below show: what plays, else what
                is paused and waiting, else that the house is quiet. */}
            {anyPlaying ? t('sf.playingIn', { count: playingCount, rooms: t.plural('common.rooms', rooms) })
              : live.length > 0 ? t('sf.pausedIn', { rooms: t.plural('common.rooms', live.length) })
              : t('sf.quietHouse', { rooms: t.plural('common.rooms', rooms) })}
          </p>
        </div>
        <div className="sf-page-actions">
          <Button quiet icon={<I.Pause />} disabled={!anyPlaying} onClick={() => pauseEverything(actions, groups, zones)}>{t('desk.rooms.pauseAll')}</Button>
          <Button quiet icon={<I.Sparkle />} disabled={!activeZone || busy || (household && household.zone_uuids.length < 2)} onClick={partyMode} title={t('sf.partyModeHint')}>{t('sf.partyMode')}</Button>
        </div>
      </header>

      <section className="sf-cards" aria-label={t('desk.rooms.title')}>
        {live.map((group) => (
          <GroupCard key={group.id} group={group} zones={zones} active={group.coordinator === activeId} showSystem={showSystem}
                     onSelect={() => onSelect(group.coordinator)} onGroupSheet={onGroupSheet} onRoomSettings={onRoomSettings}
                     onSleep={onSleep} onStage={onStage} />
        ))}
        {groups.length === 0 && <Empty icon={<I.Speaker />} title={t('outrun.noRooms')} />}
      </section>
      <p className="sf-hint sf-home-foot">
        {/* The count of rooms not listed here; grouping by dragging lives on
            the Rooms page. */}
        {quiet > 0 && (
          <button type="button" className="sf-link" onClick={onRooms}>
            {t.plural('sf.quietRooms', quiet)}<I.Chevron />
          </button>
        )}
      </p>

      {activeZone && (
        <>
          {/* What this room played lately, which is the shortest path back to
              something already heard and the one thing here that the Rooms
              page has no version of. The speakers
              keep the list, so it follows the room. */}
          {recent?.items?.length > 0 && (
            <section className="sf-quick-section" aria-label={t('sf.recent')}>
              <header className="sf-section-head">
                <h2><I.Clock />{t('sf.recent')}</h2>
                <span className="sf-section-for">{t('sf.forRoom', { room: activeZone.name })}</span>
              </header>
              <div className="sf-quick-row">
                {recent.items.slice(0, 24).map((item) => (
                  <QuickTile key={item.id} item={item} kind="recent" onPlay={(it) => onPlayItem(it, 'recent')}
                             onOpen={() => {}} onMenu={(it, event) => onItemMenu(it, 'recent', event)} />
                ))}
              </div>
            </section>
          )}
          <section className="sf-quick-section" aria-label={t('desk.browse.favorites')}>
            <header className="sf-section-head">
              <h2><I.Star />{t('desk.browse.favorites')}</h2>
              <span className="sf-section-for">{t('sf.forRoom', { room: activeZone.name })}</span>
              <button type="button" className="sf-link" onClick={() => onBrowse('FV:2')}>{t('common.viewAll')}<I.Chevron /></button>
            </header>
            {favorites.loaded && favorites.items.length === 0 ? (
              <p className="sf-muted">{t('web.favorites.empty')}</p>
            ) : (
              <div className="sf-quick-row">
                {favorites.items.slice(0, 24).map((item) => (
                  <QuickTile key={item.id} item={item} kind="favorite" onPlay={(it) => onPlayItem(it, 'FV:2')} onOpen={onOpenFavorite} onMenu={(it, event) => onItemMenu(it, 'FV:2', event)} />
                ))}
              </div>
            )}
          </section>
          <section className="sf-quick-section" aria-label={t('desk.browse.playlists')}>
            <header className="sf-section-head">
              <h2><I.Playlist />{t('desk.browse.playlists')}</h2>
              <button type="button" className="sf-link" onClick={() => onBrowse('SQ:')}>{t('common.viewAll')}<I.Chevron /></button>
            </header>
            {playlists.loaded && playlists.items.length === 0 ? (
              <p className="sf-muted">{t('web.playlists.empty')}</p>
            ) : (
              <div className="sf-quick-row">
                {playlists.items.slice(0, 24).map((item) => (
                  <QuickTile key={item.id} item={item} kind="playlist" onPlay={(it) => onPlayItem(it, 'SQ:')} onOpen={() => {}} onMenu={(it, event) => onItemMenu(it, 'SQ:', event)} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
