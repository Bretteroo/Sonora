// node frontend/src/lib/items.check.mjs
//
// Which browse rows play and which open, as the S1 app draws them: a station
// collection marked "stream" (Radio France's under ICI > Les directs) opens
// onto the live station and its podcasts; one marked "program" (CBC's,
// Pandora's) plays, since those refuse to be opened.
import { isPlayableLeaf } from './items.js'

let failed = 0
const is = (got, want, what) => {
  const ok = got === want
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok ? '' : `\n      got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`)
}
const row = (fields) => ({ uri: 'x-rincon-cpcontainer:1006206cid?sid=1&flags=8300&sn=1', can_play: true, ...fields })

is(isPlayableLeaf(row({ is_container: true, item_type: 'stream' })), false, 'a stream collection opens like a folder')
is(isPlayableLeaf(row({ is_container: true, item_type: 'program' })), true, 'a program collection plays as a station')
is(isPlayableLeaf(row({ is_container: true, item_type: 'audiobook' })), true, 'a book plays whole')
is(isPlayableLeaf(row({ is_container: true, item_type: 'track' })), false, 'a track collection opens')
is(isPlayableLeaf(row({ is_container: false, item_type: 'stream' })), true, 'a plain station plays')
is(isPlayableLeaf(row({ is_container: true, item_type: 'stream', can_enumerate: false })), true,
   'a collection the service will not list plays')

if (failed) {
  console.log(`${failed} failed`)
  process.exit(1)
}
