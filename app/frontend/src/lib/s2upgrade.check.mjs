// node frontend/src/lib/s2upgrade.check.mjs
//
// What the upgrade advisor makes of four houses. The page asks a different
// question of each -- keep two systems apart, stay on S1, spend on S2.1, or
// nothing at all -- and picks it from these three flags, so they are worth
// pinning down away from the browser.
//
// The S2-only house is the one the page used to get wrong: the plan walked
// only S1 households, so a house wholly on S2 had no rows, no S2.1 bill and
// nothing to read.
import { s21Status, s2Status, upgradePlan } from './s2upgrade.js'

let failed = 0
const is = (got, want, what) => {
  const ok = got === want
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok ? '' : `\n      got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`)
}

const player = (name, model, number) => ({ name, model, model_number: number, display_version: '11.2' })
//: Legacy: a Connect gen 1 answers ZP90, and nothing on that list runs S2.
const zp90 = player('Study', 'Sonos Connect', 'ZP90')
//: Runs S2, frozen at S2.0: a Play:1 is matched by name.
const play1 = player('Pantry', 'Sonos Play:1', 'S12')
//: Current: an Era 100 is on neither list.
const era100 = player('Den', 'Sonos Era 100', 'S38')

const s1House = (players) => ({ id: 'h1', generation: 'S1', players })
const s2House = (players) => ({ id: 'h2', generation: 'S2', players })

// A house on both systems: the page offers keeping them apart, moving to S2,
// or going to S2.1.
let plan = upgradePlan([s1House([zp90, play1]), s2House([era100])])
is(plan.hasS1, true, 'both systems: there is an S1 half')
is(plan.hasS2, true, 'both systems: and an S2 one')
is(plan.allS21, false, 'both systems: something is left to upgrade')
is(plan.rows.length, 3, 'both systems: every room is listed, not only the S1 ones')
is(plan.legacy.length, 1, 'both systems: one device cannot run S2 at all')
is(plan.forS21.length, 2, 'both systems: that one and the Play:1 stand between it and S2.1')

// Each bill lists every device, and says what each one needs.
const status = (fn) => plan.rows.map((row) => `${row.room}:${fn(row)}`).join(' ')
is(status(s2Status), 'Den:running Pantry:upgradable Study:legacy', 'S2 bill: running, upgradable, and legacy')
is(status(s21Status), 'Den:running Pantry:lower Study:legacy', 'S2.1 bill: running, S2.0 only, and legacy')
const one = upgradePlan([s1House([player('Workshop', 'Sonos One (Gen 2)', 'S18')])]).rows[0]
is(s21Status(one), 'upgradable', 'S2.1 bill: an S1 One needs only the software')
is(one.product, 'Sonos One (Gen 2)', 'the generation stays on the product name')

// S1 alone: stay, or move.
plan = upgradePlan([s1House([zp90, play1])])
is(plan.hasS1, true, 'S1 alone: an S1 half')
is(plan.hasS2, false, 'S1 alone: and no S2 one')
is(plan.allS21, false, 'S1 alone: plenty left to upgrade')

// S2 alone: no S1 half to move, so the only spend is reaching S2.1.
plan = upgradePlan([s2House([play1, era100])])
is(plan.hasS1, false, 'S2 alone: no S1 half')
is(plan.hasS2, true, 'S2 alone: an S2 one')
is(plan.allS21, false, 'S2 alone: the Play:1 would only ever reach S2.0')
is(plan.rows.length, 2, 'S2 alone: the rooms are still listed')
is(plan.legacy.length, 0, 'S2 alone: nothing is stuck on S1')
is(plan.forS21.length, 1, 'S2 alone: the Play:1 is the whole bill')
is(plan.total, 0, 'S2 alone: reaching S2 costs nothing, it is already there')

// Wholly current: nothing to ask.
plan = upgradePlan([s2House([era100, player('Terrace', 'Sonos Era 300', 'S39')])])
is(plan.allS21, true, 'all current: nothing to upgrade')
is(plan.totalS21, 0, 'all current: and nothing to pay')

// A device that will not say which generation it is keeps that claim off.
plan = upgradePlan([s2House([era100, player('Lounge', 'Sonos Sub', 'S17')])])
is(plan.tierUnknown, 1, 'an unplaceable device is counted')
is(plan.allS21, false, 'and the house is not called finished on its account')

// Nothing found yet.
plan = upgradePlan([])
is(plan.allS21, false, 'an empty house has not finished upgrading, it is just empty')
is(plan.rows.length, 0, 'and has no rooms')

process.exit(failed ? 1 : 0)
