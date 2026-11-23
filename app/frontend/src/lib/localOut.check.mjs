// The page-only room's track length: the service's figure from the moment a
// track is loaded, the audio element's own once it measures something else,
// and nothing for a station. The lyrics are looked up and timed by it.
import { localOut, trackLength, editRows } from './localOut.js'
import { browserTransport } from './browserRoom.js'
import { lyricsSong } from './lyricsSong.js'

let failures = 0
const is = (got, want, what) => {
  if (got !== want) { failures += 1; console.log(`FAIL ${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`) }
}

is(trackLength(NaN, 216), 216, 'no header yet: the service is taken at its word')
is(trackLength(Infinity, 216), 216, 'an element that never measures leaves it standing')
is(trackLength(0, 216), 216, 'a zero from the element is no measurement')
is(trackLength(215.4, 216), 216, 'a rounding apart is the same length, so the song is looked up once')
is(trackLength(217.9, 216), 216, 'either side of it')
is(trackLength(187.2, 216), 187, 'an element that measures something else is believed')
is(trackLength(162.35, 0), 162, 'nothing said: the element alone')
is(trackLength(NaN, 0), 0, 'neither: no length, which reads as live')
is(trackLength(Infinity, 0), 0, 'a live stream stays live')

// Loaded without a page, nothing plays, and the room still carries what it
// was told: a track's length reaches the transport, and from there the song
// the lyrics are asked for.
is(localOut.state.duration, 0, 'an empty room has no length')
const song = (out) => lyricsSong(browserTransport(out))
is(song({ state: 'PLAYING', title: 'A', artist: 'B', album: 'C', url: 'u', position: 0, duration: 216 }).duration,
   216, 'a stated length is the song\'s length before a second has played')
is(song({ state: 'PLAYING', title: 'A', artist: 'B', album: 'C', url: 'u', position: 0, duration: 0 }).duration,
   0, 'no length is a live stream to the lyrics')

// The room's list beside a station: what a speaker reports with radio on and
// a queue waiting. The source is the radio, the list is still counted, and
// no place in it is claimed.
const rows = [{ uri: 'a' }, { uri: 'b' }, { uri: 'c' }]
const beside = browserTransport({ state: 'PLAYING', url: 'u', queue: rows, queueIndex: -1, inList: false, position: 0 })
is(beside.source, 'radio', 'a station beside the list is radio')
is(beside.queue_length, 3, 'and the list is still counted')
const through = browserTransport({ state: 'PLAYING', url: 'u', queue: rows, queueIndex: 1, inList: true, position: 0 })
is(through.source, 'queue', 'playing through the list is playing from a queue')
is(through.track_number, 2, 'at the list\'s own place')
const kept = browserTransport({ state: 'STOPPED', url: '', restored: true, mediaUri: 'm', queue: rows, queueIndex: -1, inList: false, position: 0 })
is(kept.source, 'idle', 'a remembered station beside a list is not the list')
is(kept.queue_length, 3, 'and its list is remembered with it')
const album = browserTransport({ state: 'STOPPED', url: '', restored: true, mediaUri: 'm', queue: rows, queueIndex: 1, inList: true, position: 0 })
is(album.source, 'queue', 'a remembered album is its list, stopped')
is(album.track_number, 2, 'with its track marked')

// A list the page holds alone is edited by the server's rules.
const five = ['a', 'b', 'c', 'd', 'e'].map((uri) => ({ uri }))
const order = (r) => r.queue.map((row) => row.uri).join('')
let e = editRows(five, 2, { action: 'remove', index: 0 })
is(`${order(e)} ${e.index}`, 'bcde 1', 'removing before the playing track moves its place up')
e = editRows(five, 2, { action: 'remove', index: 2 })
is(`${order(e)} ${e.index}`, 'abde -1', 'removing the playing track leaves no place marked')
e = editRows(five, 2, { action: 'remove', index: 4 })
is(`${order(e)} ${e.index}`, 'abcd 2', 'removing after it leaves its place')
e = editRows(five, 2, { action: 'move', start: 0, count: 1, insert_before: 5 })
is(`${order(e)} ${e.index}`, 'bcdea 1', 'moving a track from before to the end')
e = editRows(five, 2, { action: 'move', start: 2, count: 1, insert_before: 0 })
is(`${order(e)} ${e.index}`, 'cabde 0', 'moving the playing track to the top takes its place along')
e = editRows(five, 1, { action: 'move', start: 3, count: 2, insert_before: 1 })
is(`${order(e)} ${e.index}`, 'adebc 3', 'moving two tracks up past the playing one')
is(editRows(five, 1, { action: 'remove', index: 0 }).queue.map((r) => r.track_number).join(','), '1,2,3,4', 'rows are numbered again')

if (failures) process.exit(1)
console.log('localOut: ok')
