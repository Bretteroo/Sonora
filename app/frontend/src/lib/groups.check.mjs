// node frontend/src/lib/groups.check.mjs
//
// The label needs two rooms actually grouped to appear on screen, which is a
// change to somebody's household; this checks the rule instead.
import { groupTitle, groupLabelFor } from './groups.js'

const t = (key, vars) => (key === 'common.groupLabel'
  ? `${vars.room} + ${vars.count}` : key)

const zones = {
  a: { uuid: 'a', name: 'Pantry' },
  b: { uuid: 'b', name: 'Terrace' },
  c: { uuid: 'c', name: 'Gym' },
}
let bad = 0
const is = (got, want, why) => {
  const ok = got === want
  if (!ok) bad++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${JSON.stringify(got).padEnd(20)} ${why}`)
}

is(groupTitle({ coordinator: 'a', members: ['a'] }, zones, t), 'Pantry',
   'one room is just its name')
is(groupTitle({ coordinator: 'a', members: ['a', 'b'] }, zones, t), 'Pantry + 1',
   'two rooms')
is(groupTitle({ coordinator: 'a', members: ['a', 'b', 'c'] }, zones, t), 'Pantry + 2',
   'three rooms count the others, not themselves')
is(groupTitle({ coordinator: 'b', members: ['a', 'b'] }, zones, t), 'Terrace + 1',
   'the coordinator leads, whichever member it is')
is(groupTitle({ name: 'Gone', members: [] }, zones, t), 'Gone',
   'a group whose zones are not here falls back to its own name')
is(groupTitle({ coordinator: 'a', members: ['a', 'b'] }, zones, null), 'Pantry + 1',
   'without a translator it still reads')

// The web themes hold zones and members rather than a group.
const kitchen = { uuid: 'a', name: 'Pantry' }
is(groupLabelFor(kitchen, [kitchen], t), 'Pantry', 'alone')
is(groupLabelFor(kitchen, [kitchen, zones.b], t), 'Pantry + 1', 'with one other')
is(groupLabelFor({ ...kitchen, topology_label: 'Pantry (L + R)' }, [kitchen], t),
   'Pantry (L + R)', 'a bonded pair keeps the name the household knows it by')

process.exit(bad ? 1 : 0)
