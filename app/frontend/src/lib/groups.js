// Naming a group of rooms.
//
// "<room> + 2": the coordinator's name, and how many other rooms are playing
// with it. Two shells worked this out separately and one of them built the
// string by hand, so the "+" was not translatable and a language that says it
// differently could not. The desktop shells do something
// else entirely -- they list every member by name rather than counting them --
// and that is a different thing rather than a third copy of this one.

/**
 * The label for a group, from the group and the household's zones.
 *
 * `t` is the translator; the string is `web.groupLabel`, which each language
 * arranges for itself.
 */
export function groupTitle(group, zones, t) {
  const names = (group?.members || []).map((u) => zones[u]?.name).filter(Boolean)
  if (!names.length) return group?.name || ''
  const lead = zones[group.coordinator]?.name || names[0]
  if (names.length === 1) return lead
  return t ? t('common.groupLabel', { room: lead, count: names.length - 1 })
           : `${lead} + ${names.length - 1}`
}

/**
 * The same, from a zone and the member zones beside it, which is the shape the
 * web themes' cards already hold. Prefers a speaker's topology label -- the
 * name the household knows it by, when it differs from the room's.
 */
export function groupLabelFor(zone, members, t) {
  const others = (members ?? []).filter((m) => m.uuid !== zone.uuid).length
  const own = zone.topology_label || zone.name
  return others ? t('common.groupLabel', { room: own, count: others }) : own
}
