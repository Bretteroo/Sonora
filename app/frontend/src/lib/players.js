// The speakers a system is made of, rather than the rooms they present as.
//
// A stereo pair is two speakers and one room; so is a soundbar with
// satellites. Anything listing what a household physically contains has to
// read the players, since the room list has one entry for the pair and names
// only the half the controller talks to. `role` is the channel a bonded
// speaker carries -- L and R for a pair, LF/RF/SW/LR/RR for a home theater --
// and is empty for a speaker that stands alone.
//
// Falls back to the rooms when a snapshot predates the players list, which
// loses the second half of a pair but never leaves the list empty.

export function playersOf(household, zones = []) {
  if (household?.players?.length) {
    return [...household.players].sort(
      (a, b) => a.name.localeCompare(b.name) || (a.role || '').localeCompare(b.role || ''))
  }
  return zones
    .filter((z) => household?.zone_uuids?.includes(z.uuid))
    .map((z) => ({ uuid: z.uuid, name: z.name, model: z.model, role: '',
                   display_version: z.display_version, host: z.host, online: z.online }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

// "<room> (L)" for a bonded half, the plain name for a speaker on its own.
export function playerLabel(player) {
  return player.role ? `${player.name} (${player.role})` : player.name
}
