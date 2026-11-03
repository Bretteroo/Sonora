// node frontend/src/lib/listMotion.check.mjs
import { settle, leaving } from './listMotion.js'

let bad = 0
const is = (got, want, why) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) { bad++; console.log(`FAIL  ${why}\n      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`) }
  else console.log(`ok    ${why}`)
}
const key = (a) => a.ID
const brief = (rows) => rows.map((r) => `${r.key}:${r.phase}${r.phase === 'enter' ? r.order : ''}`)

const s1 = [{ ID: '1' }, { ID: 'sa_a' }]
const s2 = [{ ID: '7' }, { ID: '8' }, { ID: 'sa_a' }]
const first = settle([], s1, key)
is(brief(first), ['1:enter0', 'sa_a:enter1'], 'the first list comes in, one row after another')
is(brief(leaving(first, s2, key)), ['1:leave', 'sa_a:stay'], 'switching system, a row the new list lacks leaves first, in place')
is(brief(settle(leaving(first, s2, key), s2, key)), ['7:enter0', '8:enter1', 'sa_a:stay'],
   'then the new rows come in and a row in both lists stays')
is(leaving(first, [...s1, { ID: '2' }], key), null, 'adding a row leaves nothing to wait for')
const fresh = [{ ID: '1', Enabled: '0' }, { ID: 'sa_a' }]
is(settle(first, fresh, key)[0].item.Enabled, '0', 'a row that stays shows its new content')
is(brief(settle([], null, key)), [], 'no list yet is no rows')

if (bad) { console.log(`\n${bad} failed`); process.exit(1) }
