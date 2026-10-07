// node frontend/src/parts/vocabulary.check.mjs
//
// The vocabulary is what a theme-authored layout is written in, so the thing
// worth checking is that it stays a closed list with a stable meaning: a
// layout naming a part that does not exist has to fail loudly rather than
// render nothing, and a part's layout props are its contract.
import { VOCABULARY, isPart, layoutPropsFor } from './vocabulary.js'

let bad = 0
const is = (got, want, why) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) { bad++; console.log(`FAIL  ${why}\n      got ${JSON.stringify(got)}`) }
  else console.log(`ok    ${why}`)
}

is(Object.keys(VOCABULARY).sort(),
   ['browse', 'nowPlaying', 'paneSwitch', 'queue', 'rooms', 'settings', 'transport'],
   'the vocabulary is these seven parts')
is(isPart('rooms'), true, 'a part in the list is a part')
is(isPart('stage'), false, "a theme's own concept is not in the vocabulary")
is(isPart('__proto__'), false, 'and neither is anything inherited')
is(layoutPropsFor('rooms'), ['plainNames'],
   'a layout may set these on the room list')
is(layoutPropsFor('paneSwitch'), [], 'and nothing on the pane switch')
is(layoutPropsFor('nonsense'), [], 'an unknown part offers no props rather than throwing')

for (const [name, entry] of Object.entries(VOCABULARY)) {
  if (!entry.what || !Array.isArray(entry.layoutProps)) {
    bad++; console.log(`FAIL  ${name} is missing its description or its props`)
  }
}
console.log(bad ? '' : 'ok    every part says what it is for')
process.exit(bad ? 1 : 0)
