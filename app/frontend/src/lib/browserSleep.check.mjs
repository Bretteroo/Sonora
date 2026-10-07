// The browser room's sleep timer: it counts down, reports in the speakers'
// shape, can be cleared, and stops the page's output when it runs out.
import { makeSleepTimer } from './browserSleep.js'

let failures = 0
const is = (got, want, what) => {
  if (got !== want) { failures += 1; console.log(`FAIL ${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`) }
}

let stops = 0
const timer = makeSleepTimer(() => { stops += 1 })
let heard = 0
timer.subscribe(() => { heard += 1 })

is(timer.remaining(), '', 'nothing set reads empty')
is(timer.set('0:15:00'), '0:15:00', 'a set answers what is left')
is(timer.set(null), '', 'null clears it')
is(stops, 0, 'clearing does not stop playback')

timer.set('0:00:01')
await new Promise((resolve) => setTimeout(resolve, 1200))
is(stops, 1, 'running out stops playback once')
is(timer.remaining(), '', 'and leaves nothing set')
is(heard, 4, 'every change is announced: set, clear, set, run out')

if (failures) process.exit(1)
console.log('browserSleep: ok')
