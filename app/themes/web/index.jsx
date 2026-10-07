import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { roomRows } from '../../frontend/src/lib/rooms.js'
import { orderedHouseholds, systemChoiceMatters } from '../../frontend/src/lib/format.js'
import * as Icon from '../../frontend/src/components/Icons.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import Browse from './Browse.jsx'
import RoomCard, { groupLabel } from './RoomCard.jsx'
import { addRecentSearch } from '../../frontend/src/lib/recentSearches.js'
import TransportBar from './TransportBar.jsx'
import NowPlaying from './NowPlaying.jsx'
import QueuePanel from './QueuePanel.jsx'
import GroupPanel from './GroupPanel.jsx'
import LinkServiceModal from './LinkServiceModal.jsx'
import AboutSonora from '../../frontend/src/components/AboutSonora.jsx'
import { useNavigation } from './useNavigation.js'
import { api } from '../../frontend/src/lib/api.js'
import { tokens } from './tokens.js'
import './web.css'
import thumbnail from './thumbnail.webp'
import strings from './strings.js'
import { useThemeLanding } from '../../frontend/src/lib/theme.jsx'

// A replication of the official Sonos web controller, extended to work with S1
// systems, which the original refuses outright.
//
// The interaction model is theirs and is the point of the exercise: a browse
// column on the left, "Your System" down the right as a stack of room cards,
// one of which is active, and a transport bar along the bottom that drives
// whichever room that is. Selecting a card changes what the bottom bar
// controls, exactly as it does in the real client.
//
// One structural difference, forced by not using their cloud: the original
// leads with "Recently Played", which is server-held history a local
// controller cannot see. That slot carries the household's own favorites,
// playlists and saved stations instead, all of which the speakers hold
// themselves.

const SYSTEM_KEY = 'sonora.system'
//: The room in view, under the key every other shell uses, so a reload -- or
//: a change of theme -- leaves you in the room you were listening to. The web
//: theme alone forgot, and landed on whichever room happened to be first.
const GROUP_KEY = 'sonora.desktop.group'

// A remembered choice is validated against what is actually on the network
// before it is used, so a stale id cannot strand the interface.
function readStoredRoom() {
  try {
    return window.localStorage.getItem(GROUP_KEY) || null
  } catch {
    return null
  }
}

function readStoredSystem() {
  try {
    return window.localStorage.getItem(SYSTEM_KEY) || null
  } catch {
    return null
  }
}

function Shell() {
  const { zones, groups, households, connected, actions, notices,
          dismiss, servicesEpoch } = useSystem()
  const { t } = useI18n()
  const [activeUuid, setActiveUuid] = useState(readStoredRoom)
  const [query, setQuery] = useState('')
  // The product turns the panel into a Search page the moment the box is
  // focused, before anything is typed: a title, a line of prose and the
  // services row (play.sonos.com, 2026-09-19).
  const [searchOpen, setSearchOpen] = useState(false)
  //: Whether any provider is still answering, which the pill shows.
  const [searching, setSearching] = useState(false)
  const [groupFor, setGroupFor] = useState(null)
  const [queueOpen, setQueueOpen] = useState(false)
  // Now Playing stands in for the browse column while it is open; it is not a
  // step in the browse history, so the header's arrows do not know about it.
  const [nowOpen, setNowOpen] = useState(false)
  // The sign-in modal, open when a preset ({ sid, name, zone }) names a service.
  const [linking, setLinking] = useState(null)
  // Bumped when a service is linked here, so the browse column lists it.
  const [servicesVersion, setServicesVersion] = useState(0)
  // Which system to show. Remembered across loads; the first-ever visit
  // falls back to the oldest-generation household rather than to everything.
  const [systemFilter, setSystemFilter] = useState(readStoredSystem)
  const chooseRoom = useCallback((uuid) => {
    setActiveUuid(uuid)
    try { window.localStorage.setItem(GROUP_KEY, uuid) } catch { /* private window */ }
  }, [])
  const [aboutOpen, setAboutOpen] = useState(false)
  const nav = useNavigation()
  // Chosen just now from the theme chooser: open on this theme's own theme page.
  useThemeLanding(() => nav.push({ kind: 'settings' }))
  // A word typed, or a "Search for" chosen from a menu, opens the search page
  // on top of whatever page was open -- and over the big player, which would
  // otherwise hide it -- unless the search page is already the one in view.
  // A room's sound settings, from the player's menu: they open in the browse column as Settings does.
  const openRoomSound = (uuid) => { setNowOpen(false); nav.push({ kind: 'room-sound', zone: uuid }) }
  const search = (term) => {
    setQuery(term)
    if (!term.trim()) return
    setNowOpen(false)
    if (nav.view.kind !== 'search') nav.push({ kind: 'search' })
  }
  // Every page starts at its top, a page opened and a page gone back to alike.
  // They all draw into the one content element, so without this a page
  // opened from halfway down a search began partway down its own list; the
  // product opens a result at the top and returns to the top of the search on
  // Back, with no position kept (play.sonos.com, 2026-09-22).
  useLayoutEffect(() => {
    const el = document.querySelector('.wb-content')
    if (el) el.scrollTop = 0
  }, [nav.view])

  const sidebarRooms = useMemo(() => {
    // Sonofuture works the same rooms out for its own page; the rule lives in
    // lib/rooms.js so the two cannot drift. `zone` here is the row's lead.
    return roomRows({ groups, zones, households, systemFilter })
      .map(({ household, lead, members }) => ({ household, zone: lead, members }))
  }, [zones, groups, households, systemFilter])

  // Settle the selection once discovery has reported: honor a remembered
  // choice, but only if it still names something on the network. A household
  // that has gone away must not leave the room list permanently empty.
  useEffect(() => {
    if (households.length === 0) return
    const known = new Set(households.map((h) => h.id))
    // Systems of one generation get no picker, so none of them may be left
    // chosen: all of them are shown.
    const noPicker = households.length > 1 && !systemChoiceMatters(households)
    if (systemFilter === 'all' || (known.has(systemFilter) && !noPicker)) return
    setSystemFilter(noPicker ? 'all' : orderedHouseholds(households)[0].id)
  }, [households, systemFilter])

  const chooseSystem = useCallback((value) => {
    setSystemFilter(value)
    try {
      window.localStorage.setItem(SYSTEM_KEY, value)
    } catch {
      // The choice still applies for this session.
    }
  }, [])

  // Keep an active room at all times, and recover if the current one is
  // absorbed into another group or disappears. The room chosen last time
  // stands until then: it is read from storage before the speakers answer,
  // so the first paint is already the right room rather than the first in
  // the list.
  useEffect(() => {
    const valid = sidebarRooms.some((row) => row.zone.uuid === activeUuid)
    if (!valid && sidebarRooms.length > 0) {
      // A member of a group is a valid thing to have chosen -- the card for
      // it is the coordinator's -- so the group it is in stands in for it
      // rather than the choice being thrown away.
      const asMember = sidebarRooms.find(
        (row) => row.members.some((member) => member.uuid === activeUuid))
      const playing = sidebarRooms.find(
        (row) => row.zone.transport?.state === 'PLAYING')
      chooseRoom((asMember ?? playing ?? sidebarRooms[0]).zone.uuid)
    }
  }, [sidebarRooms, activeUuid, chooseRoom])

  const activeZone = zones[activeUuid] ?? null
  const activeMembers = sidebarRooms.find((row) => row.zone.uuid === activeUuid)?.members ?? []
  const activeLabel = activeZone ? groupLabel(activeZone, activeMembers, t) : ''
  // The system dropdown is drawn only when there is an S1 system and an S2
  // one; a house on one generation has nothing to choose between.
  const multiple = systemChoiceMatters(households)
  // The heading over the rooms: a name given in Settings > System Name, else
  // "Your S1 System" or "Your S2 System" for one system and "Your System"
  // for the lot; the generation comes from the household the dropdown names.
  const [systemNames, setSystemNames] = useState({})
  useEffect(() => {
    const load = () => api.systemNames().then(setSystemNames).catch(() => {})
    load()
    const onNamed = (event) => setSystemNames(event.detail || {})
    window.addEventListener('sonora:systemnames', onNamed)
    return () => window.removeEventListener('sonora:systemnames', onNamed)
  }, [])
  const shownHousehold = households.find((h) => h.id === systemFilter)
  const systemHeading = (shownHousehold && systemNames[shownHousehold.id])
    || (shownHousehold?.generation
      ? t('web.yourSystemGen', { generation: shownHousehold.generation })
      : t('web.yourSystem'))

  return (
    // `data-pushed` says the browse column is showing something that was
    // asked for -- Settings, a service, a search -- rather than the home
    // view. Below 640px the rooms sit above that column, so anything pushed
    // into it lands under them and off the bottom of the screen: tapping the
    // gear on a phone changed nothing you could see, and the same was true of
    // searching. The rooms stand aside for it, as they
    // already do for the Now Playing card, and the header's back arrow is
    // what brings them back.
    <div className="wb" data-now={nowOpen || undefined}
         data-pushed={(nav.view.kind !== 'home' || Boolean(query)) || undefined}>
      <header className="wb-header">
        <div className="wb-header-left">
          <button
            type="button"
            className="wb-nav-btn"
            title={nav.canGoBack ? t('common.back') : t('web.nothingBack')}
            onClick={nav.back}
            disabled={!nav.canGoBack}
          >
            <Icon.ChevronLeft width={17} height={17} />
          </button>
          <button
            type="button"
            className="wb-nav-btn"
            title={nav.canGoForward ? t('common.next') : t('web.nothingForward')}
            onClick={nav.forward}
            disabled={!nav.canGoForward}
          >
            <Icon.ChevronRight width={17} height={17} />
          </button>
          {/* The wordmark is the way home, as the product's is: clicking
              SONOS on play.sonos.com drops whatever page you were on and
              empties the search box (measured 2026-09-22). This theme only --
              the others name themselves in a header too, and there the
              wordmark stays what an application's name usually is, the way
              into About Sonora. About is in this theme's
              Settings, under its own heading. */}
          <button type="button" className="wb-wordmark"
                  title={t('web.home')}
                  onClick={() => {
                    nav.home()
                    setQuery('')
                    setSearchOpen(false)
                    setNowOpen(false)
                    setGroupFor(null)
                  }}>
            Sonora
          </button>
        </div>

        <div className="wb-search">
          <div className="wb-search-pill">
            <Icon.Search width={16} height={16} />
            <input
              type="search"
              placeholder={t('common.search')}
              value={query}
              onChange={(event) => search(event.target.value)}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={(event) => { if (event.key === 'Enter' && query.trim()) addRecentSearch(query) }}
              aria-label={t('web.searchAria')}
            />
            {/* The product spins a ring at the right of the pill while the
                services answer (play.sonos.com, 2026-09-19). */}
            {searching && <span className="wb-search-spin" aria-hidden="true" />}
          </div>
        </div>

        <div className="wb-header-right">
          {multiple && (
            <label className="wb-system-filter">
              <span className="sr-only">{t('web.showRoomsFrom')}</span>
              <select
                value={systemFilter ?? 'all'}
                onChange={(event) => chooseSystem(event.target.value)}
              >
                <option value="all">
                  {orderedHouseholds(households)
                    .map((h) => h.generation).join(' · ')}
                </option>
                {orderedHouseholds(households).map((h) => (
                  <option key={h.id} value={h.id}>{h.generation}</option>
                ))}
              </select>
            </label>
          )}
          {/* The gear clears the column first: the product's closes the big
              player (and replaces a search's results) before Settings shows,
              and leaves the rooms' column as it was (play.sonos.com,
              2026-09-24). Sonora pushed Settings under the big player, where
              it never showed. */}
          <button type="button" className="wb-icon-btn" title={t('common.settings')}
                  onClick={() => {
                    setNowOpen(false)
                    if (nav.view.kind !== 'settings') nav.push({ kind: 'settings' })
                  }}>
            <Icon.Gear width={18} height={18} />
          </button>
        </div>
      </header>

      <div className="wb-main">
        {nowOpen && activeZone && (
          <NowPlaying zone={activeZone} label={activeLabel} onClose={() => setNowOpen(false)}
                      onQueue={() => setQueueOpen(true)}
                      grouping={groupFor === activeZone.uuid}
                      onRooms={() => setGroupFor(groupFor === activeZone.uuid ? null : activeZone.uuid)}
                      onSearch={search} onRoomSound={openRoomSound} />
        )}
        {/* The page stays under Now Playing rather than going away with it:
            the product returns to the page it covered, and Sonora, which
            unmounted it, fetched the whole home again on the way back and
            showed its skeleton until the slowest list answered -- seconds,
            after the logo or the X, where the product's is immediate. */}
        <div className="wb-browse-slot" hidden={(nowOpen && activeZone) || undefined}>
          <Browse
            activeUuid={activeUuid}
            query={query}
            searchOpen={searchOpen}
            onSearchTerm={search}
            onSearchBusy={setSearching}
            // The results' X goes home with the box emptied, from wherever
            // the search began (the product's, from a service's page too).
            onCloseSearch={() => { setQuery(''); setSearchOpen(false); nav.home() }}
            nav={nav}
            systemFilter={systemFilter}
            servicesVersion={servicesVersion + servicesEpoch}
            onLinkService={(preset) => setLinking(preset)}
            onServicesChanged={() => setServicesVersion((v) => v + 1)}
          />
        </div>

        <aside className="wb-sidebar">
          {/* Grouping takes the column over, as it does in the product: the
              room list is what it is about, so it stands in its place rather
              than covering the page. */}
          {queueOpen && activeZone ? (
            /* The queue takes the column too, as grouping does: it is a list
               of what the room is playing, and the product puts it where the
               room list was rather than over the page. */
            <QueuePanel zone={activeZone} onClose={() => setQueueOpen(false)} />
          ) : groupFor && zones[groupFor] ? (
            <GroupPanel zone={zones[groupFor]} onClose={() => setGroupFor(null)} />
          ) : (<>
          <div className="wb-section-head">
            <h2>{systemHeading}</h2>
            {!connected && (
              <span className="wb-viewall">{t('common.reconnecting')}</span>
            )}
          </div>
          <div className="wb-rooms">
          {sidebarRooms.map(({ household, zone, members }, index) => {
            return (
              <React.Fragment key={zone.uuid}>
                <RoomCard
                  zone={zone}
                  members={members}
                  active={zone.uuid === activeUuid}
                  onSelect={() => chooseRoom(zone.uuid)}
                  onGroup={() => setGroupFor(zone.uuid)}
                />
              </React.Fragment>
            )
          })}

          </div>
          </>)}
        </aside>
      </div>

      {!(nowOpen && activeZone) && (
        <TransportBar zone={activeZone} label={activeLabel} members={activeMembers}
                      queueOpen={queueOpen} onQueue={() => setQueueOpen((open) => !open)}
                      onNowPlaying={() => setNowOpen(true)}
                      onViewOther={(view) => nav.push(view.library
                        ? { kind: 'library', item: view.item, zone: view.zone }
                        : view.list ? { ...view, kind: 'service-list' }
                        : { kind: 'service-item', ...view })}
                      onSearch={search} onRoomSound={openRoomSound} />
      )}

      {aboutOpen && <AboutSonora onClose={() => setAboutOpen(false)} />}
      {linking && (
        <LinkServiceModal preset={linking}
                          onClose={() => setLinking(null)}
                          onRelink={(hid) => { setLinking(null); nav.push({ kind: 'add-services', tab: hid }) }}
                          onLinked={() => setServicesVersion((v) => v + 1)} />
      )}

      <div className="wb-toasts">
        {notices.map((notice) => (
          <div className="wb-toast" key={notice.id}>
            <h4>{t(notice.titleKey)}</h4>
            <p>{notice.detail || t(notice.detailKey, notice.detailParams)}</p>
            <div className="wb-toast-row">
              <button type="button" className="wb-btn" data-variant="ghost"
                      onClick={() => dismiss(notice.id)}>
                {t('common.dismiss')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default {
  id: 'web',
  name: 'Sonos Web',
  version: '1.0.0',
  thumbnail,
  description:
    'Replicates the official web controller at play.sonos.com, extended to '
    + 'work with S1 systems that the original refuses.',
  colorScheme: 'dark',
  strings,
  tokens,
  Shell,
  // What this theme draws each part of the vocabulary with
  // (parts/registry.js). RoomCard is one room rather than the list, so the
  // list stays the shell's for now; the rest map straight across.
  parts: {
    nowPlaying: NowPlaying,
    queue: QueuePanel,
    browse: Browse,
    transport: TransportBar,
  },
}
