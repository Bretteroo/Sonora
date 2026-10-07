// What Group Rooms does once Done is pressed, as the S1 Windows app does it.
// Its dialog (zones/groupingdialog.xaml, ZoneGroupingViewModel) hands the tick
// list to sclib's createSmartAddDevicesAction; what that does was measured on
// 2026-09-23 against the speakers' own topology, sampled twice a second:
//
//  * Every room can be unticked, the one the dialog was opened from included.
//  * Unticking the group's coordinator while others in its group stay ticked
//    hands them the lead and the music; the coordinator drops out, stopped.
//  * Unticking every room from the group while ticking others leaves those
//    others with what they had; the group's rooms each go their own way.
//  * Unticking everything asks first ("No Rooms Selected") and then stops the
//    group's music, leaving the grouping as it was.
//
// The music the rooms end up with is one group's. The groups the ticked rooms
// come from that are playing are what the app's groupIDsForProposedSmartGroup
// answers; more than one and it asks which. Stopped music does not count: a
// ticked room from outside with stopped music of its own brought no question
// on 2026-09-23, and the Android app withdraws its picker when a selected
// group starts or stops (RoomGroupingFragment.didNowPlayingForSelectedGroupsChange).
// None playing and the rooms keep the opening group's music.

export function isPlaying(tr) {
  return tr?.state === 'PLAYING' || tr?.state === 'TRANSITIONING'
}

// Which room leads a room's current group.
export function leaderOf(zones, uuid) {
  const zone = zones[uuid]
  if (!zone) return uuid
  if (zone.is_coordinator) return zone.uuid
  const lead = Object.values(zones).find((z) => z.group_id && z.group_id === zone.group_id && z.is_coordinator)
  return lead?.uuid || zone.uuid
}

// The rooms that share a room's group, the room included.
function membersOf(zones, candidates, group, uuid) {
  if (group.members.includes(uuid)) return group.members
  const lead = leaderOf(zones, uuid)
  return candidates.filter((z) => leaderOf(zones, z.uuid) === lead).map((z) => z.uuid)
}

// The leaders of the playing groups the ticked rooms come from, the opening
// group first.
export function proposedGroups({ group, zones, candidates, selected }) {
  const ids = []
  const keepsOwn = group.members.some((uuid) => selected.has(uuid))
  if (keepsOwn && isPlaying(zones[group.coordinator]?.transport)) ids.push(group.coordinator)
  for (const zone of candidates) {
    if (!selected.has(zone.uuid) || group.members.includes(zone.uuid)) continue
    const lead = leaderOf(zones, zone.uuid)
    if (!ids.includes(lead) && isPlaying(zones[lead]?.transport)) ids.push(lead)
  }
  return ids
}

// The steps that turn the current grouping into the ticked one, with the
// music of the group ``target`` leads. Each is [action, ...arguments] for the
// store's actions: delegate, join or leave.
export function groupingPlan({ group, zones, candidates, selected, target }) {
  const steps = []
  let lead = target
  const start = membersOf(zones, candidates, group, target)
  let gone = null
  if (!selected.has(lead)) {
    const heir = candidates.find((z) => selected.has(z.uuid) && start.includes(z.uuid))
    if (heir) {
      steps.push(['delegate', lead, heir.uuid])
      gone = lead
      lead = heir.uuid
    } else {
      lead = candidates.find((z) => selected.has(z.uuid))?.uuid
    }
  }
  if (!lead) return steps
  const current = start.includes(lead) ? start : membersOf(zones, candidates, group, lead)
  for (const zone of candidates) {
    if (zone.uuid === lead || zone.uuid === gone) continue
    const wanted = selected.has(zone.uuid)
    const inside = current.includes(zone.uuid)
    if (wanted && !inside) steps.push(['join', zone.uuid, lead])
    else if (!wanted && (inside || group.members.includes(zone.uuid))) steps.push(['leave', zone.uuid])
  }
  return steps
}

// Done closes the dialog at once and the changes run behind it; each takes
// the speakers a few seconds, and the app does not keep its dialog up for
// them. Failures surface as notices through the actions.
export async function runPlan(steps, actions) {
  for (const [action, ...args] of steps) await actions[action](...args)
}
