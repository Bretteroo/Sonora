// node frontend/src/lib/rooms.check.mjs
import { membersOf, roomSections, roomRows } from './rooms.js'

const zones = {
  a: { uuid: 'a', name: 'Pantry' },
  b: { uuid: 'b', name: 'Terrace' },
  c: { uuid: 'c', name: 'Studio' },
  br: { uuid: 'br', name: 'This browser' },
}
const households = [
  { id: 'h2', generation: 'S2', zone_uuids: ['c'] },
  { id: 'h1', generation: 'S1', zone_uuids: ['a', 'b'] },
]
const groups = [
  { id: 'g1', coordinator: 'a', members: ['a', 'b'], household: 'h1' },
  { id: 'g2', coordinator: 'c', members: ['c'], household: 'h2' },
  { id: 'gl', coordinator: 'br', members: ['br'], local: true },
]

let bad = 0
const is = (got, want, why) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) { bad++; console.log(`FAIL  ${why}\n      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`) }
  else console.log(`ok    ${why}`)
}

is(membersOf(groups[0], zones).map((z) => z.name), ['Pantry', 'Terrace'],
   'members resolve in the order the group names them')
is(membersOf({ members: ['a', 'gone'] }, zones).map((z) => z.name), ['Pantry'],
   'a member the household has forgotten is dropped, not left as a hole')

const all = roomSections({ groups, zones, households, systemFilter: 'all' })
is(all.map((s) => s.key), ['h1', 'h2', 'local'],
   'systems in Sonora\'s order, S1 before S2, browser room last')
is(all[0].rows.map((r) => r.lead.name), ['Pantry'], 'a group is one row, led by its coordinator')
is(all[2].household, null, 'the browser room belongs to no system')

const one = roomSections({ groups, zones, households, systemFilter: 'h2' })
is(one.map((s) => s.key), ['h2', 'local'],
   'the picker hides the other system but never the browser room')

const empty = roomSections({ groups: [groups[1], groups[2]], zones, households, systemFilter: 'all' })
is(empty.map((s) => s.rows.length), [0, 1, 1],
   'a system with no rooms keeps its section, so a shell can say so')

is(roomRows({ groups, zones, households, systemFilter: 'all' }).map((r) => r.lead.name),
   ['Pantry', 'Studio', 'This browser'], 'flattened for a single column')
is(roomRows({ groups, zones, households, systemFilter: 'all' })[0].household.id, 'h1',
   'a flattened row still knows its system')

process.exit(bad ? 1 : 0)
