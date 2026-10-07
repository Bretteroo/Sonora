import { useMemo } from 'react'
import { orderedHouseholds } from './format.js'

// What rooms there are to draw, and how they fall into systems.
//
// The three shells draw a room three different ways -- a compact tile, a card
// grouped under its household with a volume slider per member, a card with a
// group slider -- but they were all working out the same two things first, and
// each had its own copy:
//
//   the member zones of a group, `group.members.map(u => zones[u])`, written
//   out identically in three files; and
//
//   the rooms of each system in order, filtered by the system picker, with the
//   browser room last because it belongs to no household. The web themes and
//   Sonofuture had that algorithm each, in different shapes.
//
// This is the facts layer those renderings sit on. It says nothing about how a
// room looks, which is the part that should stay different.

/** The zones a group is made of, in the order the group names them. */
export function membersOf(group, zones) {
  return (group?.members || []).map((uuid) => zones[uuid]).filter(Boolean)
}

/** One drawable room: its group, the zone that leads it, and its members. */
function row(group, zones) {
  return { group, lead: zones[group.coordinator] || null, members: membersOf(group, zones) }
}

/**
 * The rooms, in sections by system.
 *
 * A section per household in Sonora's usual order, filtered by the system
 * picker, then one last section holding the browser room, whose `household` is
 * null because it belongs to none and shows whichever system is chosen.
 *
 * Sections with no rooms are kept: a shell that wants to say "no rooms in this
 * system" needs the empty one to say it about, and a shell that does not can
 * drop them.
 */
export function roomSections({ groups = [], zones = {}, households = [],
                               systemFilter = 'all' }) {
  const visible = orderedHouseholds(households).filter(
    (h) => !systemFilter || systemFilter === 'all' || h.id === systemFilter)
  const sections = visible.map((household) => ({
    key: household.id,
    household,
    rows: groups.filter((g) => g.household === household.id && !g.local)
      .map((g) => row(g, zones)).filter((r) => r.lead),
  }))
  const local = groups.filter((g) => g.local).map((g) => row(g, zones)).filter((r) => r.lead)
  if (local.length) sections.push({ key: 'local', household: null, rows: local })
  return sections
}

/** The same rooms with the systems flattened away, for a single column. */
export function roomRows(options) {
  return roomSections(options).flatMap((section) =>
    section.rows.map((r) => ({ ...r, household: section.household })))
}

/** Memoised, for a shell that recomputes on every store tick. */
export function useRoomSections(options) {
  const { groups, zones, households, systemFilter } = options
  return useMemo(() => roomSections(options),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groups, zones, households, systemFilter])
}

/**
 * Whether a room may be offered as half of a stereo pair. An S2 player says
 * so itself, STEREO_PAIR in the features it declares in /info: a Roam 2 does,
 * a Ray or an Arc Ultra does not (measured 2026-10-05). The S1 train declares
 * no features, so there a room is judged by its model alone, as before.
 */
export function canStereoPair(zone) {
  const features = zone?.features
  if (!Array.isArray(features) || features.length === 0) return true
  return features.includes('STEREO_PAIR')
}
