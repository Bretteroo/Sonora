import React, { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../frontend/src/lib/api.js'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import * as Icon from '../../frontend/src/components/Icons.jsx'
import { readRecentSearches, clearRecentSearches } from '../../frontend/src/lib/recentSearches.js'
import { isPlayableLeaf } from '../../frontend/src/lib/items.js'
import { kindLabel } from './kinds.js'
import { CautionBadge, serviceCaution } from '../../frontend/src/components/CautionBadge.jsx'
import Art, { artUrl, cachedArt } from './Art.jsx'
import TileRow from './TileRow.jsx'
import ServicePage from './ServicePage.jsx'
import ServiceItemPage from './ServiceItemPage.jsx'
import ServiceListPage from './ServiceListPage.jsx'
import LibraryPage from './LibraryPage.jsx'
import SystemDetailsPage from './SystemDetailsPage.jsx'
import AddServicesView from './AddServicesView.jsx'
import SearchResults from './SearchResults.jsx'
import SettingsPage from './SettingsPage.jsx'
import RoomSoundPage from './RoomSoundPage.jsx'
import TroubleshootingPage from './TroubleshootingPage.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { orderedHouseholds } from '../../frontend/src/lib/format.js'
import useEdgeFade from './useEdgeFade.js'
import { orderServices } from './serviceOrder.js'

// The browse column.
//
// The product's own order is Recently Played, then a row of circular service
// icons, then pinned collections rendered as square tiles with a label and a
// content type beneath. Recently played is cloud-held listening history that a
// local controller cannot see, so that slot carries the household's own
// content: favorites, playlists and saved stations, all held by the speakers.
//
// "Your Services" is reproduced, and it is genuinely local. The catalog
// comes from the speaker, and which services a household actually uses is
// recovered from the `sid` carried by its own content, because no firmware
// endpoint lists linked accounts. Selecting a service filters the household's
// content down to that service, which is what gives the header's back and
// forward arrows something real to traverse.

// The home's tile sections, in the product's order around the services row
// (play.sonos.com, 2026-09-14): Recently Played above it, Sonos Favorites
// below; there is no Radio group there. Recently Played is Sonora's own
// record of what the household started (the product's is cloud history).
const SECTIONS = [
  // A recent entry's art is the speaker's own /getaa path, made absolute
  // against the player that reported it and cached like every other picture.
  // The list is per household, which is known from the room, so with no room
  // yet there is nothing to ask for: asking anyway sent `zone=null` and took
  // a 404 back.
  { key: 'recent', above: true, load: (zone) => (zone ? api.recent(zone) : Promise.resolve({ items: [] })).then((data) => ({
    ...data, items: (data.items ?? []).map((item) => ({ ...item, art: item.art ? cachedArt(artUrl(item.host, item.art)) : '' })),
  })) },
  // A pinned collection lives in the same list, typed "shortcut", and the
  // product draws it as a Pinned collection row, never as a favorite: an S2
  // household with Plex's "Music" pinned and no favorites shows the tip card
  // here (play.sonos.com, 2026-09-22).
  { key: 'favorites', load: (zone) => api.favorites(zone).then((data) => ({
    ...data, items: (data.items ?? []).filter((item) => item.favorite_type !== 'shortcut'),
  })) },
  { key: 'playlists', load: (zone) => api.playlists(zone) },
]

export default function Browse({ activeUuid, query, nav, systemFilter,
                                 searchOpen = false, onCloseSearch, onSearchBusy, onSearchTerm,
                                 servicesVersion = 0, onLinkService, onServicesChanged }) {
  // Adding a service is a page of its own; signing in to one is a modal.
  // The list of services to add opens on a system's own tab: the system of
  // the page it was opened from, else the active room's.
  const openAdd = (householdId) => nav.push({ kind: 'add-services',
    tab: (typeof householdId === 'string' && householdId) || browseHousehold || null })
  const { actions, zones, households, favoritesEpoch, playlistsEpoch, recentEpoch } = useSystem()
  const { t } = useI18n()
  const [data, setData] = useState({})
  // What each room's household answered last time. Switching systems changes
  // which room the home is read through, and a fetch takes a moment; without
  // this the pane went on showing the other system's music until it landed,
  // while the room list beside it had already changed.
  const seen = useRef({})
  //: And what each household's service list said, so switching back to a
  //: system already visited restores its row on the click rather than on the
  //: refetch.
  const seenServices = useRef({})
  const [services, setServices] = useState([])
  const [error, setError] = useState(null)
  // Content and services are gated on one flag so the column appears whole.
  // Fetching them separately made the services row drop in after everything
  // else had painted, shoving the page down.
  const [contentReady, setContentReady] = useState(false)
  const [servicesReady, setServicesReady] = useState(false)

  // Browsing goes through a speaker even when the browser room is the one
  // selected: a favorite list, a playlist and a service catalog all belong
  // to a household, and only a player can ask for them. What plays still
  // plays where the reader pointed.
  const browseUuid = useMemo(() => {
    if (!zones[activeUuid]?.local) return activeUuid
    const ordered = orderedHouseholds(households)
      .filter((h) => !systemFilter || systemFilter === 'all' || h.id === systemFilter)
    for (const household of ordered) {
      for (const uuid of household.zone_uuids) if (zones[uuid]) return uuid
    }
    return activeUuid
  }, [activeUuid, zones, households, systemFilter])

  // Which household the browsing room belongs to. Favorites, playlists and
  // the recently-played list are the household's, not the room's, so this is
  // what the home is keyed and refetched on: tapping another room in the same
  // system asks for nothing and changes nothing (keyed by room, every room
  // tap had blanked the column and refetched the same answer).
  const browseHousehold = useMemo(() => orderedHouseholds(households)
    .find((household) => household.zone_uuids.includes(browseUuid))?.id ?? '',
  [households, browseUuid])

  // The Search page's history, read again each time the page opens.
  const [history, setHistory] = useState(readRecentSearches)
  const introOpen = searchOpen && !query.trim()
  useEffect(() => { if (introOpen) setHistory(readRecentSearches()) }, [introOpen])

  // Whether the household has a music library to offer under Your Sources:
  // the product lists "Music Library" only where shares are configured.
  const [hasLibrary, setHasLibrary] = useState(false)
  useEffect(() => {
    if (!browseUuid) return undefined
    let canceled = false
    api.librarySettings(browseUuid)
      .then((data) => !canceled && setHasLibrary((data.shares ?? []).length > 0))
      .catch(() => !canceled && setHasLibrary(false))
    return () => { canceled = true }
  }, [browseUuid, servicesVersion])

  // A service removed while its page is open (here or in another app) has
  // nothing left to show, so the column returns to the listing. Only a
  // household whose list fetched can say the service is gone.
  useEffect(() => {
    if (nav.view.kind !== 'service' && nav.view.kind !== 'service-item') return
    if (!servicesReady) return
    const vsid = nav.view.sid ?? nav.view.id
    const zone = nav.view.zone ?? browseUuid
    const group = services.find((g) => !g.failed && g.household.zone_uuids.includes(zone))
    if (!group) return
    if (!group.items.some((s) => (s.service_id ?? s.id) === vsid)) nav.home()
  }, [nav, services, servicesReady, browseUuid])
  const ready = contentReady && servicesReady

  useEffect(() => {
    let canceled = false
    // Immediately: whatever this room's household said last time, or nothing.
    // Either is this system's answer; the previous system's is not.
    setData(seen.current[browseHousehold] ?? {})
    Promise.all(SECTIONS.map((section) =>
      section.load(browseUuid)
        .then((result) => [section.key, result.items ?? []])
        .catch(() => [section.key, []])
    )).then((pairs) => {
      if (canceled) return
      const fresh = Object.fromEntries(pairs)
      seen.current = { ...seen.current, [browseHousehold]: fresh }
      setData(fresh)
      setContentReady(true)
    }).catch((exc) => {
      if (canceled) return
      setError(String(exc.message))
      setContentReady(true)
    })
    return () => { canceled = true }
    // Refetched when the speakers (or a room starting to play) say a list
    // changed, so the home follows every controller, not only this one.
  }, [browseHousehold, favoritesEpoch, playlistsEpoch, recentEpoch])  // eslint-disable-line react-hooks/exhaustive-deps

  // With the first system's home in hand, quietly fetch the others', so the
  // switch that follows is as quick as the room list beside it. One room per
  // household, once; the lists refresh on their own events after that.
  useEffect(() => {
    if (!contentReady) return undefined
    let canceled = false
    const elsewhere = orderedHouseholds(households)
      .filter((household) => household.id !== browseHousehold && !seen.current[household.id])
      .map((household) => [household.id, household.zone_uuids.find((uuid) => zones[uuid])])
      .filter(([, uuid]) => uuid)
    Promise.all(elsewhere.map(([id, uuid]) =>
      Promise.all(SECTIONS.map((section) =>
        section.load(uuid)
          .then((result) => [section.key, result.items ?? []])
          .catch(() => [section.key, []])))
        .then((pairs) => [id, Object.fromEntries(pairs)])
        .catch(() => null)))
      .then((got) => {
        if (canceled) return
        for (const entry of got) {
          if (entry) seen.current[entry[0]] = entry[1]
        }
      })
    return () => { canceled = true }
  }, [contentReady, households, zones, browseHousehold])

  // Scoped to the selected system. Each household has its own catalog and
  // its own content, so asking once for whichever room is active reports the
  // wrong household's services as soon as the two are mixed.
  // Which households' services the column offers. With one chosen it is that
  // one; with All chosen it is the household of the room you are in, since
  // the services of the other system cannot be played in it -- selecting an
  // S1 speaker takes "Your S2 Services" off the page, and back again when an
  // S2 speaker is selected. Before the rooms have
  // answered there is no room, and both stand.
  const scoped = useMemo(() => {
    const ordered = orderedHouseholds(households)
    if (systemFilter && systemFilter !== 'all') {
      return ordered.filter((h) => h.id === systemFilter)
    }
    const here = ordered.filter((h) => h.id === browseHousehold)
    return here.length ? here : ordered
  }, [households, systemFilter, browseHousehold])

  useEffect(() => {
    let canceled = false
    if (scoped.length === 0) {
      setServices([])
      setServicesReady(true)
      return undefined
    }
    Promise.all(scoped.map((household) => {
      const anyZone = household.zone_uuids[0]
      return api.services(anyZone)
        .then((result) => ({
          household,
          // In this browser's order, as the product keeps it (serviceOrder.js).
          items: orderServices(household.id, result.households?.[0]?.in_use ?? []),
        }))
        .catch(() => ({ household, items: [], failed: true }))
    })).then((groups) => {
      if (canceled) return
      for (const group of groups) {
        if (!group.failed) seenServices.current[group.household.id] = group
      }
      setServices(groups)
      setServicesReady(true)
    })
    return () => { canceled = true }
  }, [scoped, servicesVersion])

  // The services already fetched, narrowed to the chosen system now rather
  // than when the refetch lands. Switching to S1 drops the S2 row on the
  // click; switching back to All restores both from what is still held.
  const shown = useMemo(() => scoped.map((household) =>
    services.find((group) => group.household.id === household.id)
    ?? seenServices.current[household.id]).filter(Boolean), [services, scoped])

  const active = zones[activeUuid]
  const needle = query.trim().toLowerCase()

  // The home is never cut down by what is in the search box: a search is a
  // page of its own, and the page Back returns to is drawn whole, words in the
  // box or not, as the product's is (2026-09-24).
  const filtered = useMemo(() => {
    const out = {}
    for (const section of SECTIONS) out[section.key] = data[section.key] ?? []
    return out
  }, [data])

  const multipleSystems = shown.length > 1
  // The browse zone travels with the request for the browser room: it is
  // how the backend knows whose service login resolves the URI.
  // A tile opens what it names rather than starting it, which is what the
  // product does: clicking a Recently Played album takes the page to that
  // album and nothing plays (measured on play.sonos.com 2026-09-19). The
  // backend works out where each one leads from its URI (`opens`); anything
  // it cannot place -- a line-in, a saved queue -- still plays, which beats a
  // tile that does nothing.
  const openTile = (item) => {
    const opens = item.opens || {}
    if (!opens.kind) { play(item); return }
    if (opens.kind === 'library') {
      nav.push({ kind: 'library', item: opens.item, zone: browseUuid })
      return
    }
    const service = shown.flatMap((group) => group.items ?? [])
      .find((row) => (row.service_id ?? row.id) === opens.sid)
    nav.push({
      kind: opens.kind,
      sid: opens.sid,
      name: item.title,
      item: opens.item,
      zone: browseUuid,
      account_id: opens.account || '',
      gen: shown.find((group) => group.household.zone_uuids.includes(browseUuid))
        ?.household.generation,
      uri: item.uri || '',
      metadata: item.metadata || '',
      art: item.art || '',
      item_type: '',
      service: service?.name || item.service_name || '',
      icon: service?.icon || '',
      initials: service?.initials || '',
    })
  }

  const play = (item) => actions.setSource(activeUuid, {
    ...(zones[activeUuid]?.local ? { from_zone: browseUuid } : {}),
    uri: item.uri, metadata: item.metadata || '',
    // A recently played album or playlist filled the queue; it plays back
    // the way the apps replay one, by replacing the queue with it.
    ...(item.replace ? { replace: true } : {}),
  })

  // A single expanded section, or a service, shows one full list.
  const only = nav.view.kind === 'section' ? nav.view.key : null

  if (nav.view.kind === 'system-details') {
    return (
      <div className="wb-content wb-content-panel">
        {/* Its X goes home with the search box emptied, as the product's does. */}
        <SystemDetailsPage onClose={onCloseSearch} systemFilter={systemFilter} />
      </div>
    )
  }

  if (nav.view.kind === 'library') {
    return (
      <div className="wb-content wb-content-panel">
        <LibraryPage item={nav.view.item} name={nav.view.name} uri={nav.view.uri ?? ''} metadata={nav.view.metadata ?? ''}
                     zone={nav.view.zone ?? browseUuid} playZone={activeUuid} nav={nav} />
      </div>
    )
  }

  if (nav.view.kind === 'settings') {
    return (
      <div className="wb-content wb-content-panel">
        <SettingsPage onClose={nav.back} systemFilter={systemFilter}
                      onTroubleshoot={() => nav.push({ kind: 'troubleshooting' })}
                      onSystemDetails={() => nav.push({ kind: 'system-details' })} />
      </div>
    )
  }

  if (nav.view.kind === 'room-sound') {
    return (
      <div className="wb-content wb-content-panel">
        <RoomSoundPage uuid={nav.view.zone} onClose={nav.back} />
      </div>
    )
  }

  if (nav.view.kind === 'troubleshooting') {
    return (
      <div className="wb-content wb-content-panel">
        <TroubleshootingPage onClose={nav.back} />
      </div>
    )
  }

  if (nav.view.kind === 'services-all') {
    const group = services.find((g) => g.household.id === nav.view.household)
    return (
      <div className="wb-content wb-content-panel">
        {/* No breadcrumb: the product's list has none, and the header's back
            arrow is the way out. */}
        <ServicesList
          items={group?.items ?? []}
          duplicates={duplicateIds(group?.items ?? [])}
          title={multipleSystems
            ? t('web.yourServicesFor', { generation: nav.view.generation })
            : t('web.yourServices')}
          onOpen={(service) => nav.push({
            kind: 'service',
            id: service.service_id ?? service.id,
            name: service.name,
            zone: group?.household.zone_uuids[0] ?? browseUuid,
            account_id: service.account_id ?? '',
            sonora_linked: service.sonora_linked,
            on_system: service.on_system,
            gen: group?.household.generation,
            icon: service.icon, initials: service.initials, accounts: service.accounts,
            site: service.site || '',
          })}
          onAdd={() => openAdd(group?.household.id)}
          onClose={nav.home}
        />
      </div>
    )
  }

  if (nav.view.kind === 'add-services') {
    return (
      <div className="wb-content">
        <Crumb nav={nav} label={t('desk.add.title')} />
        <AddServicesView onLink={onLinkService} servicesVersion={servicesVersion} initialTab={nav.view.tab} />
      </div>
    )
  }

  if (nav.view.kind === 'library-list') {
    return (
      <div className="wb-content wb-content-panel">
        <ServiceListPage library
          zone={nav.view.zone ?? browseUuid}
          item={nav.view.item}
          title={nav.view.name}
          art={nav.view.art}
          uri={nav.view.uri}
          metadata={nav.view.metadata}
          placeholder={nav.view.placeholder}
          playZone={activeUuid}
          onPlay={play}
          nav={nav}
        />
      </div>
    )
  }

  if (nav.view.kind === 'service-list') {
    return (
      <div className="wb-content wb-content-panel">
        <ServiceListPage
          sid={nav.view.sid}
          zone={nav.view.zone ?? browseUuid}
          item={nav.view.item}
          title={nav.view.name}
          art={nav.view.art}
          uri={nav.view.uri}
          metadata={nav.view.metadata}
          serviceName={nav.view.service}
          logo={{ icon: nav.view.icon, initials: nav.view.initials }}
          itemType={nav.view.item_type}
          summary={nav.view.summary ?? ''}
          secondLine={nav.view.second_line ?? ''}
          artist={nav.view.artist ?? ''}
          producer={nav.view.producer ?? ''}
          semanticType={nav.view.semantic_type ?? ''}
          accountId={nav.view.account_id ?? ''}
          playZone={activeUuid}
          onPlay={play}
          nav={nav}
        />
      </div>
    )
  }

  if (nav.view.kind === 'service-leaf') {
    return (
      <div className="wb-content wb-content-panel">
        <ServiceItemPage
          sid={nav.view.sid}
          zone={nav.view.zone ?? browseUuid}
          title={nav.view.name}
          art={nav.view.art}
          uri={nav.view.uri}
          metadata={nav.view.metadata}
          serviceName={nav.view.service}
          logo={{ icon: nav.view.icon, initials: nav.view.initials }}
          itemType={nav.view.item_type}
          playZone={activeUuid}
          onPlay={play}
          nav={nav}
        />
      </div>
    )
  }

  if (nav.view.kind === 'service' || nav.view.kind === 'service-item') {
    // The view holds what was true when it was opened; the services list is
    // refetched as the household changes, so the row is looked up again on
    // every render and its current state wins (a service just added in the
    // Sonos app stops asking for that link without leaving the page).
    const vsid = nav.view.sid ?? nav.view.id
    const vacc = nav.view.account_id ?? ''
    const rows = services.flatMap((g) => g.items).filter((s) => (s.service_id ?? s.id) === vsid)

    // Opened without an account (a login not yet attributed), the page follows
    // the service's single row once the login lands on a household account.
    const live = rows.find((s) => (s.account_id ?? '') === vacc)
      ?? (vacc === '' && rows.length === 1 ? rows[0] : undefined)
    const row = live ?? nav.view
    return (
      <div className="wb-content wb-content-panel">
        <ServicePage
          sid={vsid}
          name={nav.view.name}
          summary={nav.view.summary || ''}
          preset={nav.view.preset || null}
          zone={nav.view.zone ?? browseUuid}
          item={nav.view.item}
          accountId={live?.account_id ?? vacc}
          sonoraLinked={row.sonora_linked !== false}
          onSystem={row.on_system !== false}
          gen={nav.view.gen}
          art={nav.view.art || ''}
          itemType={nav.view.item_type || ''}
          logo={{ icon: row.icon ?? nav.view.icon, initials: row.initials ?? nav.view.initials }}
          accounts={row.accounts}
          auth={row.auth ?? nav.view.auth}
          nickname={row.nickname ?? ''}
          site={row.site ?? nav.view.site ?? ''}
          nav={nav}
          refresh={servicesVersion}
          onLink={onLinkService}
          onRemoved={onServicesChanged}
        />
      </div>
    )
  }

  // Nothing real renders until every initial request has settled, so the
  // column arrives in one piece rather than reflowing as each request lands.
  // What shows meanwhile is the shape of it: an empty black column read as a
  // broken page on a cold backend, where the services directory alone can
  // take seconds.
  if (!ready) {
    return (
      <div className="wb-content wb-waiting" aria-busy="true">
        <section className="wb-section">
          <div className="wb-section-head"><div><h2>{t('web.recent')}</h2></div></div>
          <div className="wb-tiles">
            {Array.from({ length: 6 }, (unused, n) => (
              <div className="wb-tile" key={n} aria-hidden="true">
                <div className="wb-tile-art" />
                <div className="wb-ghost wb-ghost-line" />
                <div className="wb-ghost wb-ghost-line wb-ghost-short" />
              </div>
            ))}
          </div>
        </section>
        <section className="wb-section">
          <div className="wb-section-head"><div><h2>{t('web.yourServices')}</h2></div></div>
          <div className="wb-services">
            {Array.from({ length: 9 }, (unused, n) => (
              <span className="wb-ghost wb-ghost-disc" key={n} aria-hidden="true" />
            ))}
          </div>
        </section>
      </div>
    )
  }

  // A search is a page of its own, as the product's /search is: typing puts
  // it on top of whatever page was open, Back returns to that page with the
  // words still in the box, and only while it is the page in view are its
  // results drawn (play.sonos.com, 2026-09-24). Sonora had drawn them over
  // the home whenever the box held a word, and over no other page at all.
  const inSearch = nav.view.kind === 'search'
  const showResults = inSearch && Boolean(needle)
  // Focused and empty, on whatever page: the product opens its Search page
  // over the column -- what can be searched for, the searches made before,
  // and the household's services (play.sonos.com, 2026-09-28).
  const showIntro = searchOpen && !needle
  const homeHidden = showResults || showIntro

  return (
    <div className="wb-content" data-panel={homeHidden || undefined}>
      {error && <div className="wb-empty-card">{error}</div>}


      {/* Focused but empty, the product says what can be searched for and
          leaves the services row under it; a term replaces both with the
          providers' answers, and nothing of the household's own. */}
      {showIntro && (
        <div className="wb-search-intro">
          <button type="button" className="wb-service-close" title={t('common.close')}
                  onClick={onCloseSearch}>
            <Icon.Close width={16} height={16} />
          </button>
          <h1>{t('web.search.title')}</h1>
          <p>{t('web.search.prose')}</p>
          {history.length > 0 && (
            <section className="wb-search-history">
              <div className="wb-section-head">
                <h2>{t('web.search.history')}</h2>
                <button type="button" className="wb-viewall" onClick={() => setHistory(clearRecentSearches())}>
                  {t('web.search.clearHistory')}
                </button>
              </div>
              {history.map((term) => (
                <button key={term} type="button" className="wb-row" onClick={() => onSearchTerm?.(term)}>
                  <span className="wb-row-art"><Icon.Search width={20} height={20} /></span>
                  <span className="wb-row-text"><span className="wb-row-label"><span>{term}</span></span></span>
                </button>
              ))}
            </section>
          )}
          {shown.map((group) => (
            <Services key={group.household.id} group={group} multiple={households.length > 1}
                      onViewAll={() => nav.push({ kind: 'services-all', household: group.household.id, generation: group.household.generation })}
                      onOpen={(service) => nav.push({
                        kind: 'service', id: service.service_id ?? service.id, name: service.name,
                        zone: group.household.zone_uuids[0], account_id: service.account_id ?? '',
                        sonora_linked: service.sonora_linked, on_system: service.on_system,
                        gen: group.household.generation, icon: service.icon, initials: service.initials,
                        accounts: service.accounts, site: service.site || '',
                      })} />
          ))}
        </div>
      )}

      {nav.view.kind === 'section'
        && <Crumb nav={nav} label={t(`web.${only}`)} />}

      {SECTIONS.filter((section) => section.above).map(renderSection)}

      {nav.view.kind === 'home' && !homeHidden && shown.map((group) => (
        <Services
          key={group.household.id}
          group={group}
          // Named by generation whenever the house has more than one system,
          // so it is plain which one's services these are even though only
          // the room's are shown.
          multiple={households.length > 1}
          onViewAll={() => nav.push({
            kind: 'services-all',
            household: group.household.id,
            generation: group.household.generation,
          })}
          onOpen={(service) => nav.push({
            kind: 'service',
            // Cloud and local entries differ in shape; the catalog id is
            // what the browse endpoint takes, whichever field carries it.
            id: service.service_id ?? service.id,
            name: service.name,
            zone: group.household.zone_uuids[0],
            account_id: service.account_id ?? '',
            sonora_linked: service.sonora_linked,
            on_system: service.on_system,
            gen: group.household.generation,
            icon: service.icon, initials: service.initials, accounts: service.accounts,
            site: service.site || '',
          })}
          // The product's row ends at its last service, with no tile after
          // it (play.sonos.com, 2026-09-24: Amazon Music, then the next
          // section). Sonora adds services from View All's list; the tile
          // stays only for a system with none yet, which has no row and so
          // no View All to reach that list through.
          onAdd={group.items.length ? undefined : () => openAdd(group.household.id)}
        />
      ))}

      {showResults && (
        <SearchResults term={query} groups={shown} nav={nav} onPlay={play}
                       onClose={onCloseSearch} onBusy={onSearchBusy}
                       library={hasLibrary ? browseUuid : ''} />
      )}

      {nav.view.kind === 'home' && !homeHidden && (
        <PinnedRows zone={browseUuid} nav={nav} onPlay={play} refresh={servicesVersion} />
      )}

      {SECTIONS.filter((section) => !section.above).map(renderSection)}

      {nav.view.kind === 'home' && !homeHidden && (
        <Sources active={active} onPlay={actions.setSource} library={hasLibrary}
                 onLibrary={() => nav.push({ kind: 'library', item: 'A:', zone: browseUuid })} />
      )}
    </div>
  )

  function renderSection(section) {
        // A search replaces the home entirely in the product: its panel holds
        // the services' results and nothing of the household's own.
        if (homeHidden || inSearch) return null
        if (only && section.key !== only) return null
        const items = filtered[section.key] ?? []
        const expanded = Boolean(only)
        const shown = expanded ? items : items.slice(0, 6)
        return (
          /* No section at all for an empty Sonos Playlists: the product's
             home goes from Sonos Favorites straight to Your Sources when
             the system has saved none (2026-09-22). */
          (section.key === 'playlists' && items.length === 0 && !expanded) ? null :
          <section className="wb-section" key={section.key}>
            <div className="wb-section-head">
              <div>
                <h2>{t(`web.${section.key}`)}</h2>
              </div>
              {!expanded && items.length > 0 && (
                <button
                  type="button"
                  className="wb-viewall"
                  onClick={() => nav.push({ kind: 'section', key: section.key })}
                >
                  {t('common.viewAll')}
                </button>
              )}
            </div>
            {items.length === 0 ? (
              section.key === 'favorites' ? (
                /* The product's tip in place of an empty favorites list: a
                   382px card with "Tip" over the line and a heart disc. */
                <div className="wb-tip">
                  <div>
                    <p className="wb-tip-label">{t('web.favorites.tip')}</p>
                    <p className="wb-tip-body">{t('web.favorites.tipBody')}</p>
                  </div>
                  <span className="wb-tip-disc"><Icon.Heart width={20} height={20} /></span>
                </div>
              ) : (
                <div className="wb-empty-card">
                  {t(`web.${section.key}.empty`)}
                </div>
              )
            ) : expanded ? (
              <div className="wb-tiles">
                {shown.map((item) => (
                  <Tile key={item.id} item={item} onPlay={() => openTile(item)} />
                ))}
              </div>
            ) : (
              /* Not `shown`: a wide window fits more than six on the line,
                 and the product fills it. */
              <TileRow items={items}
                       render={(item) => (
                         <Tile key={item.id} item={item} onPlay={() => openTile(item)} />
                       )} />
            )}
          </section>
        )
  }
}

// The circular service row. The catalog carries no local artwork, only a
// manifest URI on Sonos' CDN, so each service gets a monogram rather than a
// logo fetched from somewhere this controller has no business calling.
function Services({ group, multiple, onOpen, onViewAll, onAdd }) {
  const { t } = useI18n()
  const { household, items } = group
  const duplicates = useMemo(() => duplicateIds(items), [items])
  // The edges fade to the page where there is more row beyond them, on
  // whichever side has it (play.sonos.com, 2026-09-19); the filter pills over
  // search results are drawn the same way.
  const [row, edges] = useEdgeFade([items])
  // A system with nothing in use contributes no heading at all, whether it is
  // shown alone or beside another, unless a service can be added from here, in
  // which case the "+" tile is the only way to add the first one.
  if (!items.length && !onAdd) return null
  return (
    <section className="wb-section">
      <div className="wb-section-head">
        <div>
          <h2>
            {multiple
              ? t('web.yourServicesFor', { generation: household.generation })
              : t('web.yourServices')}
          </h2>
        </div>
        <button
          type="button"
          className="wb-viewall"
          onClick={onViewAll}
        >
          {t('common.viewAll')}
        </button>
      </div>
      <div className="wb-services" ref={row}
           data-fade-left={edges.left || undefined}
           data-fade-right={edges.right || undefined}>
        {items.map((service, index) => {
          const key = `${service.service_id ?? service.id}-${service.account_id ?? index}`
          const repeated = duplicates.has(service.service_id ?? service.id)
          const label = repeated && service.nickname
            ? `${service.name} — ${service.nickname}`
            : service.name
          return (
            <button
              key={key}
              type="button"
              className="wb-service"
              aria-label={label}
              title={label}
              onClick={() => onOpen(service)}
            >
              <ServiceBadge service={service} />
              <CautionBadge kind={serviceCaution(service)} />
              {repeated && service.nickname && (
                <span className="wb-service-profile" aria-hidden="true">
                  {profileLetter(service.nickname)}
                </span>
              )}
            </button>
          )
        })}
        {onAdd && (
          <button
            type="button"
            className="wb-service wb-service-add"
            aria-label={t('desk.browse.addServices')}
            title={t('desk.browse.addServices')}
            onClick={() => onAdd()}
          >
            <span className="wb-service-badge" aria-hidden="true"><Icon.Plus /></span>
          </button>
        )}
      </div>
    </section>
  )
}

// Services configured more than once, keyed by catalog id. A household with
// several accounts on one service shows one entry per account, so those need
// distinguishing wherever they are listed.
function duplicateIds(items) {
  const seen = new Map()
  for (const s of items) {
    const id = s.service_id ?? s.id
    seen.set(id, (seen.get(id) ?? 0) + 1)
  }
  return new Set([...seen].filter(([, n]) => n > 1).map(([id]) => id))
}

// The list the product shows at /browse/services: a 40px title over one 72px
// row per configured service, artwork left of a 14px label.
function ServicesList({ items, duplicates, title, onOpen, onAdd, onClose }) {
  const { t } = useI18n()
  return (
    <div className="wb-services-page">
      {onClose && (
        <button type="button" className="wb-service-close" title={t('common.close')}
                onClick={onClose}>
          <Icon.Close width={16} height={16} />
        </button>
      )}
      <h1>{title}</h1>
      <div className="wb-rows">
        {items.map((service, index) => {
          const id = service.service_id ?? service.id
          const label = duplicates.has(id) && service.nickname
            ? `${service.name} — ${service.nickname}`
            : service.name
          return (
            <button
              key={`${id}-${service.account_id ?? index}`}
              type="button"
              className="wb-row"
              onClick={() => onOpen(service)}
            >
              <span className="wb-row-art">
                <ServiceBadge service={service} />
              </span>
              <span className="wb-row-label">{label}</span>
              {/* Every row carries one, as the product's list does. */}
              <Icon.ChevronRight className="wb-row-chev" width={20} height={20} aria-hidden="true" />
            </button>
          )
        })}
        {/* Sonora's own, after the household's services rather than before
            them: the product has no way to add a service at all -- it is done
            in the Sonos app -- so this is the one row of this list that is
            not in the product, and it reads as one of its rows. */}
        {onAdd && (
          <button type="button" className="wb-row" onClick={() => onAdd()}>
            <span className="wb-row-art wb-add-art">
              <span className="wb-service-badge" aria-hidden="true"><Icon.Plus /></span>
            </span>
            <span className="wb-row-label">{t('desk.browse.addServices')}</span>
            <Icon.ChevronRight className="wb-row-chev" width={20} height={20} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}

// The first letter of an account nickname, as the product's data names it:
// "Tammy's Spotify" gives T. Skips leading quotes and whitespace.
function profileLetter(nickname) {
  const match = /[\p{L}\p{N}]/u.exec(nickname || '')
  return match ? match[0].toUpperCase() : ''
}

// A service's logo, or its initials when there is none. Logos come from the
// signed-in account by way of the backend's proxy; without a sign-in there is
// no artwork to be had, and initials are the honest fallback rather than a
// broken image.
export function ServiceBadge({ service }) {
  const [failed, setFailed] = useState(false)
  const showLogo = Boolean(service.icon) && !failed
  return (
    <span className="wb-service-badge">
      {showLogo
        ? <img src={service.icon} alt="" onError={() => setFailed(true)} />
        : service.initials}
    </span>
  )
}

// The back affordance for a pushed view.
function Crumb({ nav, label }) {
  const { t } = useI18n()
  return (
    <div className="wb-crumb">
      <button type="button" onClick={nav.back}>
        <Icon.ChevronLeft width={13} height={13} />
        {t('common.back')}
      </button>
      <span>{label}</span>
    </div>
  )
}

function Sources({ active, onPlay, library = false, onLibrary }) {
  const { t } = useI18n()
  if (!active) return null
  const sources = []
  if (active.model && /arc|beam|ray|playbar|playbase|amp/i.test(active.model)) {
    sources.push({ key: 'tv', label: t('common.tv'), Glyph: Icon.Tv,
                   uri: `x-sonos-htastream:${active.uuid}:spdif` })
  }
  if (active.supports_line_in) {
    sources.push({ key: 'line', label: t('web.lineIn'), Glyph: Icon.LineIn,
                   uri: `x-rincon-stream:${active.uuid}` })
  }
  // The household's library, when it has one, as the product lists it.
  if (library) {
    sources.push({ key: 'library', label: t('desk.browse.library'), Glyph: Icon.Library, open: onLibrary })
  }
  if (sources.length === 0) return null

  return (
    <section className="wb-section">
      <div className="wb-section-head wb-sources-head">
        <div>
          <h2>{t('web.yourSources')}</h2>
        </div>
      </div>
      <div className="wb-sources">
        {sources.map(({ key, label, Glyph, uri, open }) => (
          <button
            key={key}
            type="button"
            className="wb-source"
            aria-label={label}
            onClick={() => (open ? open() : onPlay(active.uuid, { uri, metadata: '' }))}
          >
            <span className="wb-source-main">
              <span className="wb-source-circle"><Glyph /></span>
              <span className="wb-source-label">{label}</span>
            </span>
            <Icon.ChevronRight className="wb-source-chev" width={24} height={24} aria-hidden="true" />
          </button>
        ))}
      </div>
    </section>
  )
}

function Tile({ item, onPlay }) {
  const { t } = useI18n()
  // The service's own attribution mark, before the content type under the
  // tile. Not on the artwork: the pale 'a' at the corner of Audacy's
  // stations turned out to be Audacy's own watermark, baked into the
  // pictures they serve, and the product stamps nothing of its own there
  // (checked against a Pandora station's art, which has no mark at all).
  // A service that publishes no badge answers 404 and the mark removes
  // itself, which is why Mixcloud's and Plex's rows carry none.
  const sid = item.service_id
  const badge = (className, size) => (sid ? (
    <img className={className} src={`/api/services/badge/${sid}?size=${size}`}
         alt="" aria-hidden="true"
         onError={(event) => { event.currentTarget.style.display = 'none' }} />
  ) : null)
  // The whole tile is the target, as the product's is: hovering dims the
  // artwork and nothing else appears, so a play disc floating over the corner
  // -- which is what Sonora drew -- is a control the product does not have.
  return (
    <button type="button" className="wb-tile"
            title={t('web.playTitle', { title: item.title })} onClick={onPlay}>
      <div className="wb-tile-art">
        {/* A station with no picture draws the product's radio waves rather
            than the note (the Art placeholder rule). */}
        <Art src={item.art} size={30} kind={item.kind === 'station' ? 'station' : item.kind === 'stream' ? 'stream' : ''} />
      </div>
      <p className="wb-tile-label" title={item.title}>{item.title}</p>
      <p className="wb-tile-sub">{badge('wb-tile-mark', 40)}{t(kindLabel(item))}</p>
    </button>
  )
}

// The collections pinned to the home, one row each, as the product draws
// them (play.sonos.com, 2026-09-14): the service's 40px icon, the
// collection's name in 18px over "Pinned collection" in 14px, View All at the
// right, and the collection's first five children as tiles. A folder among
// them opens; anything playable plays.
function PinnedRows({ zone, nav, onPlay, refresh }) {
  const { t } = useI18n()
  const [pins, setPins] = useState([])
  const [children, setChildren] = useState({})
  useEffect(() => {
    if (!zone) return undefined
    let canceled = false
    api.pins(zone).then((data) => !canceled && setPins(data.items ?? [])).catch(() => {})
    const onPins = (event) => setPins(event.detail || [])
    window.addEventListener('sonora:pins', onPins)
    return () => { canceled = true; window.removeEventListener('sonora:pins', onPins) }
  }, [zone, refresh])
  useEffect(() => {
    let canceled = false
    for (const pin of pins) {
      const key = `${pin.sid}|${pin.item}`
      if (children[key]) continue
      // Twelve rather than five: the line takes as many as it fits, which is
      // ten on a wide window.
      //
      // Asked twice before the row gives up: the first call of the day to
      // Plex is answered by a server that has to wake, and one transport
      // error left "Unable to load content." standing over a row that the
      // very next request filled.
      const ask = () => api.browseService(pin.sid, { zone, item: pin.item, count: 12,
                                                     account: pin.account_id || '', art: 290 })
        .then((data) => (data?.error ? Promise.reject(new Error(data.error.message)) : data))
      ask()
        .catch(() => new Promise((done) => { setTimeout(done, 2000) }).then(ask))
        .then((data) => !canceled && setChildren((c) => ({
          ...c, [key]: { items: data.items ?? [], failed: false } })))
        .catch(() => !canceled && setChildren((c) => ({ ...c, [key]: { items: [], failed: true } })))
    }
    return () => { canceled = true }
  }, [pins, zone]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!pins.length) return null
  const openPin = (pin) => nav.push({ kind: 'service-item', sid: pin.sid, name: pin.title, item: pin.item, zone, account_id: pin.account_id || '' })
  return pins.map((pin) => {
    const answer = children[`${pin.sid}|${pin.item}`]
    const rows = answer?.items ?? []
    // The product says so rather than leaving a heading over nothing: a
    // pinned row whose service will not answer carries "Unable to load
    // content." on a card the width of the column (measured 2026-09-20).
    const failed = Boolean(answer?.failed) || (answer && rows.length === 0)
    return (
      <section className="wb-section" key={`${pin.sid}|${pin.item}`}>
        <div className="wb-section-head wb-pinned-head">
          <span className="wb-pinned-icon" aria-hidden="true">
            {pin.icon ? <img src={pin.icon} alt="" /> : <span>{(pin.service || pin.title).slice(0, 2)}</span>}
          </span>
          <div>
            <h2>{pin.title}</h2>
            <p>{t('web.pinned')}</p>
          </div>
          <button type="button" className="wb-viewall" onClick={() => openPin(pin)}>{t('common.viewAll')}</button>
        </div>
        {failed ? (
          <div className="wb-empty-card wb-pinned-failed">
            <Icon.Caution width={16} height={16} aria-hidden="true" />
            <span>{t('web.pinned.failed')}</span>
          </div>
        ) : (
          <TileRow
            items={rows}
            render={(item) => (
              <Tile key={item.id} item={item}
                    onPlay={() => (item.is_container && !isPlayableLeaf(item)
                      ? nav.push({ kind: 'service-item', sid: pin.sid, name: item.title, item: item.id, zone, account_id: pin.account_id || '' })
                      : onPlay(item))} />
            )} />
        )}
      </section>
    )
  })
}
