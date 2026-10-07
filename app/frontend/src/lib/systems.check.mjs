// node frontend/src/lib/systems.check.mjs
//
// Whether a system picker is worth drawing. As asked for: a house
// with only S1 speakers, or only S2, should not be offered a choice between
// generations anywhere in the app.
//
// The picker names its options by generation, so the rule is about
// generations rather than about how many systems were found: two systems of
// the same generation would draw two buttons reading "S1", which says nothing.
import { systemChoiceMatters } from './format.js'

let failed = 0
const is = (got, want, what) => {
  const ok = got === want
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok ? '' : `\n      got ${got}, want ${want}`}`)
}

is(systemChoiceMatters([{ generation: 'S1' }]), false,
   'one S1 system offers no choice')
is(systemChoiceMatters([{ generation: 'S2' }]), false,
   'nor does one S2 system')
is(systemChoiceMatters([{ generation: 'S1' }, { generation: 'S2' }]), true,
   'an S1 system beside an S2 one is a choice')
is(systemChoiceMatters([{ generation: 'S1' }, { generation: 'S1' }]), false,
   'two systems of the same generation are not: the picker would say "S1" twice')
is(systemChoiceMatters([]), false,
   'nothing found yet is not a choice')
is(systemChoiceMatters(undefined), false,
   'and neither is nothing at all')
is(systemChoiceMatters([{ generation: '' }, { generation: 'S2' }]), false,
   'a system whose generation is not known yet does not make one')
is(systemChoiceMatters([{ generation: 'S1' }, { generation: 'S2' }, { generation: 'S2' }]), true,
   'three systems across two generations still is')

process.exit(failed ? 1 : 0)
