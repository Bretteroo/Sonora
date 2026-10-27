// The rule, against the shapes the speakers actually report.
// node frontend/src/lib/transport.check.mjs
import { nextTransport, isLoaded, canAct } from './transport.js'
import { browserTransport } from './browserRoom.js'
const cases = [
  // measured on this household 2026-09-18
  [{ source: 'service_radio', state: 'PLAYING', can_pause: false }, 'stop',  'a station the speaker will not pause'],
  [{ source: 'http_stream',   state: 'PLAYING', can_pause: true  }, 'pause', 'an http stream the speaker WILL pause (the old list said stop)'],
  [{ source: 'service_track', state: 'PLAYING', can_pause: true  }, 'pause', 'an ordinary track'],
  [{ source: 'queue',         state: 'PLAYING', can_pause: true  }, 'pause', 'the queue'],
  [{ source: 'tv',            state: 'PLAYING', can_pause: true  }, 'stop',  'television: nothing to resume, whatever the field says'],
  [{ source: 'line_in',       state: 'PLAYING', can_pause: true  }, 'stop',  'line-in, likewise'],
  [{ source: 'queue',         state: 'PAUSED_PLAYBACK', can_pause: true }, 'play', 'paused'],
  [{ source: 'queue',         state: 'STOPPED', can_pause: false }, 'play',  'stopped'],
  [{ source: 'queue',         state: 'TRANSITIONING', can_pause: true }, 'pause', 'still counts as playing'],
  // The browser room builds its own transport, and left can_pause unset,
  // which read as pausable: pause bars over 80s80s Reggae.
  [browserTransport({ state: 'PLAYING', url: 'https://x/80s', mediaUri: 'x-sonosapi-stream:a36?sid=321', duration: 0 }),
   'stop', 'this browser, a broadcast playing'],
  [browserTransport({ state: 'TRANSITIONING', url: 'https://x/80s', mediaUri: 'x-sonosapi-stream:a36?sid=321', duration: 0 }),
   'stop', 'this browser, a broadcast still connecting'],
  [browserTransport({ state: 'PLAYING', url: 'https://x/radio.mp3', mediaUri: '', duration: 0 }),
   'stop', 'this browser, a bare radio URL with no length'],
  [browserTransport({ state: 'PLAYING', url: 'https://x/t.mp4', mediaUri: 'x-sonosapi-radio:ch?sid=188', duration: 214 }),
   'pause', 'this browser, a station track with a length'],
  [browserTransport({ state: 'TRANSITIONING', url: 'https://x/t.mp4', mediaUri: 'x-sonosapi-radio:ch?sid=188', duration: 0 }),
   'pause', 'this browser, a track still loading'],
  [browserTransport({ state: 'STOPPED', url: 'https://x/80s', mediaUri: 'x-sonosapi-stream:a36?sid=321', duration: 0 }),
   'play', 'this browser, stopped'],
]
let bad = 0
for (const [tr, want, why] of cases) {
  const got = nextTransport(tr)
  const ok = got === want
  if (!ok) bad++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${got.padEnd(5)} (want ${want.padEnd(5)})  ${why}`)
}
console.log('loaded:', isLoaded({ track_uri: 'x' }), isLoaded({ queue_length: 3 }), isLoaded({}), '(expect true true false)')
// What the speaker takes decides whether the button does anything: an S2
// soundbar on TV lists "Set, Play" and refuses Stop (2026-10-27).
for (const [tr, want, why] of [
  [{ source: 'tv', state: 'PLAYING', can_pause: false, can_stop: false }, false, 'an S2 soundbar on TV: nothing to press'],
  [{ source: 'tv', state: 'PLAYING', can_pause: false, can_stop: true }, true, 'a soundbar on TV that takes Stop'],
  [{ source: 'service_radio', state: 'PLAYING', can_pause: false }, true, 'a station (no can_stop reported)'],
  [{ source: 'tv', state: 'STOPPED', can_pause: false, can_stop: false }, true, 'stopped: Play is always there'],
]) {
  const ok = canAct(tr) === want
  if (!ok) bad++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  canAct ${String(canAct(tr)).padEnd(5)} (want ${String(want).padEnd(5)})  ${why}`)
}
process.exit(bad ? 1 : 0)
