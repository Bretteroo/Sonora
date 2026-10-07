import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSystem } from './store.jsx'
import { orderedHouseholds, systemChoiceMatters } from './format.js'

// Which room a shell is looking at, and which system it is filtered to.
//
// Every shell needs this and, at one time, every shell had its own copy:
// the same two localStorage keys declared in five files, the same group filter
// written out twice verbatim, the same "the household I was filtered to has
// gone" correction in two shapes. It is the first thing to share on the way to
// a shell being an arrangement rather than an application, because it is the
// state a layout cannot avoid having an opinion about.
//
// The keys are deliberately common to all shells, so switching theme keeps you
// in the room you were in.

export const GROUP_KEY = 'sonora.desktop.group'
export const SYSTEM_KEY = 'sonora.system'

/**
 * The system the S1 / S2 / All picker has chosen, when it names one of these
 * households: where a page that lists one system at a time -- the services,
 * adding a service -- opens, whatever the theme. With
 * All chosen, or nothing, the first system.
 */
export function chosenHousehold(ordered) {
  const picked = readStored(SYSTEM_KEY)
  return (picked && ordered.some((h) => h.id === picked) ? picked : ordered[0]?.id) ?? null
}

export function readStored(key, fallback = null) {
  try { return window.localStorage.getItem(key) ?? fallback } catch { return fallback }
}

export function writeStored(key, value) {
  try { window.localStorage.setItem(key, value) } catch { /* private mode */ }
}

/**
 * The room in view and the system filter, persisted.
 *
 * `onSelect` is called after a room is chosen, for a shell that has somewhere
 * to go next — the desktop shells move a narrow window to the Now Playing
 * pane, which is a layout decision and so stays in the layout.
 *
 * `byMember` resolves a room to its group even when the uuid names a member
 * rather than the coordinator. Sonofuture wants that and the desktop shells
 * do not, because there a member's tile is not selectable in the first place.
 */
export function useShellSelection({ onSelect = null, byMember = false,
                                   preferAllWhenMany = false } = {}) {
  const { zones, groups, households, zoneList } = useSystem()
  const [activeId, setActiveId] = useState(() => readStored(GROUP_KEY))
  const [systemFilter, setSystemFilter] = useState(() => readStored(SYSTEM_KEY))

  // A filter naming a household that is no longer here shows nothing at all,
  // which reads as "Sonora has lost my speakers" rather than as a stale
  // setting. The two shells disagree about where to land, and both are
  // defensible, so neither is changed here: the desktop shells go to the
  // first system, because their room list is a single column and All would
  // mix two households in it; Sonofuture goes to All when there is more than
  // one, because its rooms page groups them under headings anyway.
  useEffect(() => {
    if (!households.length) return
    const known = new Set(households.map((h) => h.id))
    // With no picker drawn there must be nothing to unlock: several systems
    // of the same generation offer no choice worth making, so they are all
    // shown rather than pinned to one with no way back -- including one a
    // picker chose earlier, while there was still a choice to make.
    const noPicker = households.length > 1 && !systemChoiceMatters(households)
    if (systemFilter === 'all' || (known.has(systemFilter) && !noPicker)) return
    setSystemFilter(noPicker || (preferAllWhenMany && households.length > 1)
      ? 'all' : orderedHouseholds(households)[0].id)
  }, [households, systemFilter, preferAllWhenMany])

  const chooseSystem = useCallback((value) => {
    setSystemFilter(value)
    writeStored(SYSTEM_KEY, value)
  }, [])

  const select = useCallback((uuid) => {
    setActiveId(uuid)
    writeStored(GROUP_KEY, uuid)
    if (onSelect) onSelect(uuid)
  }, [onSelect])

  // "This browser" is local to the page and belongs to every system, so it
  // survives the filter whichever one is chosen.
  const visibleGroups = useMemo(
    () => groups.filter((g) => g.local || !systemFilter || systemFilter === 'all'
                              || g.household === systemFilter),
    [groups, systemFilter])

  // The rooms behind those groups, in the order the system lists them, so a
  // shell can say how many rooms the chosen system has rather than how many
  // exist. A room reaches this two ways: it is in a group that survived the
  // filter (which is also how "This browser" survives, belonging to no
  // household), or the household itself remembers it -- a speaker that is
  // remembered but not reachable is in no group at all and would otherwise go
  // uncounted.
  const visibleZones = useMemo(() => {
    if (!systemFilter || systemFilter === 'all') return zoneList
    const grouped = new Set(visibleGroups.flatMap((g) => g.members))
    const remembered = new Set(
      households.find((h) => h.id === systemFilter)?.zone_uuids || [])
    return zoneList.filter((z) => grouped.has(z.uuid) || remembered.has(z.uuid))
  }, [zoneList, visibleGroups, households, systemFilter])

  const activeGroup = useMemo(() => (
    visibleGroups.find((g) => g.coordinator === activeId)
    || (byMember ? visibleGroups.find((g) => g.members.includes(activeId)) : null)
    || visibleGroups[0] || null
  ), [visibleGroups, activeId, byMember])

  const activeZone = activeGroup ? zones[activeGroup.coordinator] : null

  return { activeId, setActiveId, activeGroup, activeZone, visibleGroups,
           visibleZones, systemFilter, setSystemFilter, chooseSystem, select }
}
