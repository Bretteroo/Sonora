import React, { useLayoutEffect, useRef, useState } from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import Art, { nowPlayingArt } from '../../frontend/src/components/Art.jsx'
import { dayPart } from '../../frontend/src/lib/playlistName.js'
import * as I from './icons.jsx'
import { IconButton, Button, Chip, Slider, Menu, MenuItem, MenuSep, Empty, ListItem } from './m3.jsx'
import { KIND_SHAPES } from './shapes.js'
import { nowSummary, nextTransport, togglePlay, isLoaded, genericArt, groupTitle } from './data.js'
import { Transport, WavySeek } from './Player.jsx'
import Battery, { groupBattery } from '../../frontend/src/components/Battery.jsx'

// Listen: the house as it sounds right now.
//
// A hero carousel of the rooms playing music leads the page. The room
// in view is the wide item, its cover filling the card; the others wait
// beside it as narrow slivers of their own covers and widen into the hero
// when chosen. Under it sit that room's transport, its volume and its
// shortcuts; then the quiet rooms as chips, then what the room played
// lately, the Sonos Favorites and the Sonos Playlists, each as a carousel.

function HeroItem({ group, zones, active, onSelect, onPlayer, onMenu }) {
  const { t } = useI18n()
  const zone = zones[group.coordinator]
  if (!zone) return null
  const tr = zone.transport || {}
  const summary = nowSummary(tr, t)
  // The hero draws the cover across most of the page, so it asks for the
  // largest copy the source has rather than the one the URL names.
  const art = tr.source !== 'tv' ? nowPlayingArt(zone.host, tr, { best: true, zone: zone.uuid }) : ''
  const playing = tr.state === 'PLAYING' || tr.state === 'TRANSITIONING'
  return (
    <div className="mg-hero-item" data-active={active || undefined} data-playing={playing || undefined}
         role="button" tabIndex={0} aria-pressed={active} title={groupTitle(group, zones, t)}
         onClick={() => (active ? onPlayer() : onSelect())}
         onKeyDown={(event) => { if (event.key === 'Enter') (active ? onPlayer() : onSelect()) }}
         onContextMenu={(event) => { event.preventDefault(); onMenu(event) }}>
      <span className="mg-hero-bg">
        {tr.source === 'tv' ? <span className="mg-hero-glyph"><I.Tv /></span> : <Art src={art} size={480} fallback="note" brokenFallback="note" />}
      </span>
      <span className="mg-hero-scrim" aria-hidden="true" />
      <span className="mg-state" aria-hidden="true" />
      <span className="mg-hero-text">
        <span className="mg-hero-room">
          {playing && <span className="mg-bars" data-on aria-hidden="true"><i /><i /><i /><i /></span>}
          {groupTitle(group, zones, t)}
          {groupBattery(group.members.map((u) => zones[u])) && <Battery battery={groupBattery(group.members.map((u) => zones[u]))} className="mg-room-battery mg-hero-battery" />}
        </span>
        {active && <span className="mg-hero-title">{summary.title || (isLoaded(tr) ? t('desk.now.noMusic') : t('common.noMusicSelected'))}</span>}
        {active && summary.sub && <span className="mg-hero-sub">{summary.sub}</span>}
      </span>
      {active && <span className="mg-hero-open" aria-hidden="true"><I.Expand /></span>}
    </div>
  )
}

// One item of a browse carousel: the cover in a rounded square, the title
// and a line under it.
function Tile({ item, kind, onPlay, onOpen, onMenu }) {
  const { t } = useI18n()
  const unavailable = item.available === false
  const opens = kind === 'favorite' && item.browse_id && item.service_id && !unavailable
  return (
    <div className="mg-tile" role="button" tabIndex={0} aria-disabled={unavailable || undefined} title={item.title}
         onClick={() => (unavailable ? null : onPlay(item))}
         onKeyDown={(event) => { if (event.key === 'Enter' && !unavailable) onPlay(item) }}
         onContextMenu={(event) => { event.preventDefault(); onMenu(item, event) }}>
      <span className="mg-tile-art">
        {unavailable ? <span className="mg-tile-glyph"><I.Warning /></span>
          : <Art src={item.art} size={240} fallback={genericArt(item)} brokenFallback={genericArt(item)} />}
        <span className="mg-state" aria-hidden="true" />
        <span className="mg-tile-play" aria-hidden="true"><I.Play /></span>
      </span>
      <span className="mg-tile-title">{item.title}</span>
      <span className="mg-tile-sub">{item.description || item.service_name || ''}</span>
      <span className="mg-tile-tools" onClick={(event) => event.stopPropagation()}>
        {opens && <IconButton size="xs" variant="tonal" label={t('mg.open')} onClick={() => onOpen(item)}><I.Chevron /></IconButton>}
        <IconButton size="xs" variant="tonal" label={t('desk.browse.actions')} onClick={(event) => onMenu(item, event)}><I.More /></IconButton>
      </span>
    </div>
  )
}

// A multi-browse carousel (M3 carousel, "Multi-browse"): the item at the
// leading edge is large and the rest small. Which one is large follows the
// scroll, not a fixed position: as the leading item scrolls off it narrows
// while the next widens into its place, both by how far the row has moved.
// Every tile has a small slot plus a share of one large bonus, and the shares
// always sum to one bonus, so the row's length never changes as the sizes do
// and the scroll position never has to be corrected. Each tile's share is
// --mg-grow, from 0 to 1; mg.css turns it into a width.
function useMultiBrowse(ref) {
  useLayoutEffect(() => {
    const row = ref.current
    if (!row) return undefined
    let frame = 0
    const place = () => {
      frame = 0
      const style = getComputedStyle(row)
      const pitch = parseFloat(style.getPropertyValue('--mg-tile-w')) + parseFloat(style.columnGap || '0')
      // Right to left, the leading edge is the right one and scrollLeft runs negative.
      const at = pitch > 0 ? Math.abs(row.scrollLeft) / pitch : 0
      Array.from(row.children).forEach((tile, i) => {
        tile.style.setProperty('--mg-grow', Math.max(0, 1 - Math.abs(i - at)).toFixed(4))
      })
    }
    const queue = () => { if (!frame) frame = requestAnimationFrame(place) }
    place()
    row.addEventListener('scroll', queue, { passive: true })
    window.addEventListener('resize', queue)
    // Keyboard focus moves the large item too: a tile taking focus is brought to the edge.
    const focus = (event) => {
      const tile = event.target.closest?.('.mg-tile')
      if (!tile || tile.parentElement !== row || !event.target.matches(':focus-visible')) return
      const i = Array.from(row.children).indexOf(tile)
      const pitch = parseFloat(getComputedStyle(row).getPropertyValue('--mg-tile-w')) + parseFloat(getComputedStyle(row).columnGap || '0')
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      row.scrollTo({ left: (getComputedStyle(row).direction === 'rtl' ? -1 : 1) * i * pitch, behavior: reduce ? 'auto' : 'smooth' })
    }
    row.addEventListener('focusin', focus)
    return () => {
      cancelAnimationFrame(frame)
      row.removeEventListener('scroll', queue)
      window.removeEventListener('resize', queue)
      row.removeEventListener('focusin', focus)
    }
  })
}

function Carousel({ label, icon, sub = '', action = null, children, empty = null }) {
  const row = useRef(null)
  useMultiBrowse(row)
  return (
    <section className="mg-shelf" aria-label={label}>
      <header className="mg-shelf-head">
        <span className="mg-shelf-icon" aria-hidden="true">{icon}</span>
        <div>
          <h2>{label}</h2>
          {sub && <p>{sub}</p>}
        </div>
        {action}
      </header>
      {empty || <div className="mg-carousel mg-carousel-multi" ref={row}>{children}</div>}
    </section>
  )
}

export default function Listen({ groups, zones, households, activeId, activeZone, activeGroup, onSelect, onGroup, onRoomSettings, onSleep, onPlayer,
                                 favorites, playlists, recent, onPlayItem, onOpenFavorite, onItemMenu, onBrowse, onRooms, onSearch, compact }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const [menu, setMenu] = useState(null)
  // The hero holds the rooms that are playing, and the room in view. A paused
  // room waits with the quiet ones (a paused room had shared the hero
  // with the chosen one).
  const sounding = (g) => ['PLAYING', 'TRANSITIONING'].includes(zones[g.coordinator]?.transport?.state)
  const live = groups.filter((g) => sounding(g) || g.coordinator === activeId)
  const quiet = groups.filter((g) => !live.includes(g))
  const playing = groups.filter(sounding).length
  const tr = activeZone?.transport || {}
  const members = activeGroup ? activeGroup.members.map((u) => zones[u]).filter(Boolean) : []

  const roomMenu = (group, event) => {
    const zone = zones[group.coordinator]
    if (!zone) return
    setMenu({ group, zone, x: event.clientX, y: event.clientY })
  }

  return (
    <div className="mg-page mg-listen">
      <header className="mg-appbar mg-appbar-large">
        <div className="mg-appbar-row">
          <span className="mg-grow" />
          <IconButton label={`${t('common.search')} (Ctrl K)`} onClick={onSearch}><I.Search /></IconButton>
        </div>
        <h1 className="mg-display">{t(`mg.greeting.${dayPart()}`)}</h1>
        {/* Said only while something plays. */}
        {playing > 0 && <p className="mg-appbar-sub">{t('mg.playingIn', { rooms: t.plural('common.rooms', playing) })}</p>}
      </header>

      {groups.length === 0 ? <Empty icon={<I.Speaker />} title={t('mg.noRooms')} /> : (
        <section className="mg-hero" aria-label={t('desk.rooms.title')} style={{ '--mg-hero-others': Math.max(0, live.length - 1) }}>
          {live.map((group) => (
            <HeroItem key={group.id} group={group} zones={zones} active={group.coordinator === activeId}
                      onSelect={() => onSelect(group.coordinator)} onPlayer={onPlayer} onMenu={(event) => roomMenu(group, event)} />
          ))}
        </section>
      )}

      {activeZone && (
        <section className="mg-here" aria-label={t('mg.inThisRoom')}>
          <WavySeek zone={activeZone} />
          <div className="mg-here-row">
            <Transport zone={activeZone} size={compact ? 'm' : 'l'} />
            <div className="mg-here-volume">
              <IconButton variant="toggle" selected={activeZone.group_muted} label={activeZone.group_muted ? t('common.unmute') : t('common.mute')}
                          onClick={() => actions.setMute(activeZone.uuid, !activeZone.group_muted, true)}>{activeZone.group_muted ? <I.Muted /> : <I.Volume />}</IconButton>
              <Slider wheelStep={2} size="s" value={activeZone.group_volume ?? 0} label={members.length > 1 ? t('desk.transport.groupVolume') : activeZone.name}
                      onCommit={(level) => actions.setGroupVolume(activeZone.uuid, level)} />
            </div>
          </div>
          <div className="mg-chips">
            {!activeGroup?.local && (
              <Chip kind="assist" icon={<I.Group />} onClick={() => onGroup(activeGroup)}>
                {members.length > 1 ? t('mg.editGroup') : t('mg.addRooms')}
              </Chip>
            )}
            <Chip kind="assist" icon={<I.Moon />} onClick={onSleep}>{t('desk.browse.sleepTimer')}</Chip>
            {!activeZone.local && <Chip kind="assist" icon={<I.Tune />} onClick={() => onRoomSettings(activeZone.uuid)}>{t('mg.soundAndRoom')}</Chip>}
            <Chip kind="assist" icon={<I.Expand />} onClick={onPlayer}>{t('mg.openPlayer')}</Chip>
          </div>
        </section>
      )}

      {quiet.length > 0 && (
        <section className="mg-quiet" aria-label={t.plural('mg.quietRooms', quiet.length)}>
          <h2 className="mg-title-s">{t.plural('mg.quietRooms', quiet.length)}</h2>
          <div className="mg-chips">
            {quiet.slice(0, 12).map((group) => (
              <Chip key={group.id} kind="suggestion" icon={<span className="mg-chip-shape" style={{ clipPath: KIND_SHAPES.room }} />}
                    onClick={() => onSelect(group.coordinator)}>
                {groupTitle(group, zones, t)}
                {groupBattery(group.members.map((u) => zones[u])) && <Battery battery={groupBattery(group.members.map((u) => zones[u]))} className="mg-room-battery mg-chip-battery" />}
              </Chip>
            ))}
            <Chip kind="suggestion" icon={<I.Rooms />} onClick={onRooms}>{t('mg.allRooms')}</Chip>
          </div>
        </section>
      )}

      {activeZone && (
        <>
          {recent?.items?.length > 0 && (
            <Carousel label={t('mg.recent')} icon={<I.Clock />} sub={t('mg.forRoom', { room: activeZone.name })}>
              {recent.items.slice(0, 24).map((item) => (
                <Tile key={item.id} item={item} kind="recent" onPlay={(it) => onPlayItem(it, 'recent')} onOpen={() => {}}
                      onMenu={(it, event) => onItemMenu(it, 'recent', event)} />
              ))}
            </Carousel>
          )}
          <Carousel label={t('desk.browse.favorites')} icon={<I.Star />} sub={t('mg.forRoom', { room: activeZone.name })}
                    action={<Button variant="text" size="xs" trailing={<I.Chevron />} onClick={() => onBrowse('FV:2')}>{t('common.viewAll')}</Button>}
                    empty={favorites.loaded && favorites.items.length === 0 ? <p className="mg-muted">{t('mg.favoritesEmpty')}</p> : null}>
            {favorites.items.slice(0, 24).map((item) => (
              <Tile key={item.id} item={item} kind="favorite" onPlay={(it) => onPlayItem(it, 'FV:2')} onOpen={onOpenFavorite}
                    onMenu={(it, event) => onItemMenu(it, 'FV:2', event)} />
            ))}
          </Carousel>
          <section className="mg-shelf" aria-label={t('desk.browse.playlists')}>
            <header className="mg-shelf-head">
              <span className="mg-shelf-icon" aria-hidden="true"><I.Playlist /></span>
              <div><h2>{t('desk.browse.playlists')}</h2></div>
              <Button variant="text" size="xs" trailing={<I.Chevron />} onClick={() => onBrowse('SQ:')}>{t('common.viewAll')}</Button>
            </header>
            {playlists.loaded && playlists.items.length === 0 ? <p className="mg-muted">{t('mg.playlistsEmpty')}</p> : (
              <div className="mg-card mg-card-filled mg-list">
                {playlists.items.slice(0, 8).map((item) => (
                  <ListItem key={item.id} leading={<span className="mg-li-glyph" style={{ clipPath: KIND_SHAPES.playlist }}><I.Playlist /></span>}
                            headline={item.title} supporting={t('desk.browse.playlists')}
                            onClick={() => onPlayItem(item, 'SQ:')}
                            onContextMenu={(event) => { event.preventDefault(); onItemMenu(item, 'SQ:', event) }}
                            trailing={<span className="mg-li-play" aria-hidden="true"><I.Play /></span>} />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {menu && (() => {
        const { group, zone } = menu
        const what = nextTransport(zone.transport || {})
        const many = group.members.length > 1
        const name = many ? t('desk.rooms.menu.group') : zone.name
        return (
          <Menu x={menu.x} y={menu.y} onClose={() => setMenu(null)} title={groupTitle(group, zones, t)}>
            <MenuItem icon={what === 'play' ? <I.Play /> : what === 'stop' ? <I.Stop /> : <I.Pause />} disabled={!isLoaded(zone.transport || {})}
                      onSelect={() => { setMenu(null); togglePlay(actions, zone) }}>
              {t(what === 'play' ? 'desk.rooms.menu.play' : what === 'stop' ? 'desk.rooms.menu.stop' : 'desk.rooms.menu.pause', { name })}
            </MenuItem>
            <MenuItem icon={zone.group_muted ? <I.Volume /> : <I.Muted />} onSelect={() => { setMenu(null); actions.setMute(zone.uuid, !zone.group_muted, true) }}>
              {t(zone.group_muted ? 'desk.rooms.menu.unmute' : 'desk.rooms.menu.mute', { name })}
            </MenuItem>
            <MenuSep />
            {!group.local && <MenuItem icon={<I.Group />} onSelect={() => { setMenu(null); onGroup(group) }}>{t('desk.grouping.title')}</MenuItem>}
            <MenuItem icon={<I.Moon />} onSelect={() => { setMenu(null); onSelect(group.coordinator); onSleep() }}>{t('desk.browse.sleepTimer')}</MenuItem>
            <MenuSep />
            {group.members.map((uuid) => zones[uuid]).filter((m) => m && !m.local).map((m) => (
              <MenuItem key={m.uuid} icon={<I.Tune />} onSelect={() => { setMenu(null); onRoomSettings(m.uuid) }}>{t('desk.rooms.menu.eq', { name: m.name })}</MenuItem>
            ))}
          </Menu>
        )
      })()}
    </div>
  )
}
