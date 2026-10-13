// node frontend/src/lib/lyrics.check.mjs
//
// What a big player looks up for the lyrics, how LRCLIB is asked, and which
// line is being sung.
import { lineAt, lyricsSong } from './lyricsSong.js'
import { createPacer, findLyrics, firstArtist, parseLrc, pick, plainTitle } from './lrclib.js'

let failed = 0
const is = (got, want, what) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok ? '' : `\n      got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`)
}

const track = { source: 'queue', title: 'Song', artist: 'Band', album: 'Album', track_duration: '0:03:27', media_uri: '' }
is(lyricsSong(track), { title: 'Song', artist: 'Band', album: 'Album', duration: 207 }, 'a queued track is looked up with its length')
is(lyricsSong({ ...track, artist: '' }), null, 'no artist, nothing to look up')
is(lyricsSong({ ...track, source: 'tv' }), null, 'a TV has no song')
is(lyricsSong({ ...track, source: 'line_in' }), null, 'a line-in has no song')
is(lyricsSong({ ...track, track_duration: '0:00:00' }).duration, 0, 'a stream has no length to time against')
is(lyricsSong({ ...track, media_uri: 'x-sonosapi-hls:station' }).duration, 0, 'a live broadcast has none either')

const lines = [[5, 'a'], [10, 'b'], [20, 'c']]
is(lineAt(lines, 0), -1, 'before the first line, none')
is(lineAt(lines, 5), 0, 'a line starts at its stamp')
is(lineAt(lines, 19.9), 1, 'and runs until the next')
is(lineAt(lines, 400), 2, 'the last runs to the end')
is(lineAt([], 10), -1, 'no lines, none')

// --- reading LRC and finding the song
is(parseLrc('[ar: Someone]\n[00:12.50] Second\n[00:03.07]First\n[01:02.5][00:20.00] Twice\nno stamp\n[00:30.00]'),
  [[3.07, 'First'], [12.5, 'Second'], [20, 'Twice'], [30, ''], [62.5, 'Twice']], 'LRC lines are read in time order, a repeated line at each stamp')
is(plainTitle('Get Lucky (Radio Edit) [feat. Pharrell Williams]'), 'Get Lucky', 'a title loses an edit and a guest')
is(plainTitle('Here Comes the Sun - Remastered 2009'), 'Here Comes the Sun', 'and a dashed remaster')
is(plainTitle('Live and Let Die'), 'Live and Let Die', 'a song whose own name holds one of the words is left alone')
is(firstArtist('Daft Punk, Pharrell Williams'), 'Daft Punk', 'the first of several artists')
is(firstArtist('Calvin Harris feat. Rihanna'), 'Calvin Harris', 'a featured artist is dropped')

const entry = (duration, { synced = true, album = '', plain = 'words' } = {}) =>
  ({ duration, albumName: album, instrumental: false, plainLyrics: plain, syncedLyrics: synced ? '[00:01.00] words' : null })
is(pick([entry(369), entry(249)], 248).synced, [[1, 'words']], 'timings come from a recording of the same length')
is(pick([entry(369)], 248).synced, [], 'another length gives the words, untimed')
is(pick([entry(200)], 0).synced, [], 'with no length to go by, the words come untimed')
is(pick([entry(248, { plain: 'other' }), entry(248, { album: 'Album', plain: 'this' })], 248, 'Album').plain, 'this', 'the same album wins a tie')

const table = (answers) => {
  const asked = []
  const get = async (path, params, client) => {
    asked.push([path, params.track_name, params.artist_name, client])
    const found = answers[`${path}|${params.track_name}|${params.artist_name}`]
    if (found instanceof Error) throw found
    return found ?? null
  }
  return { asked, get }
}
{
  const t1 = table({ '/get|Song|Band': entry(200) })
  const got = await findLyrics({ title: 'Song', artist: 'Band', album: 'Album', duration: 200 }, { client: 'Sonora/9', get: t1.get })
  is([got.synced.length, t1.asked], [1, [['/get', 'Song', 'Band', 'Sonora/9']]], 'an exact match is asked first, naming the client')
}
{
  const t2 = table({ '/search|Song|Band': [entry(200)] })
  const got = await findLyrics({ title: 'Song (2011 Remaster)', artist: 'Band, Guest', duration: 200 }, { get: t2.get })
  is([got.synced.length, t2.asked.map((a) => a[0])], [1, ['/search', '/search', '/search']], 'a search falls back to the plain title and first artist')
}
{
  const t3 = table({ '/search|Song (Live)|Band': new Error('503'), '/search|Song|Band': [entry(200)] })
  is((await findLyrics({ title: 'Song (Live)', artist: 'Band', duration: 200 }, { get: t3.get })).synced.length, 1, 'one failed try does not end the lookup')
}
is((await findLyrics({ title: 'Song', artist: 'Band' }, { get: table({}).get })), { found: false, instrumental: false, synced: [], plain: '' }, 'nothing found is said so')
is((await findLyrics({ title: 'Song', artist: 'Band' }, { get: table({ '/search|Song|Band': new Error('down') }).get })).unreachable, true, 'LRCLIB unreachable is said so')
{
  const t4 = table({})
  await findLyrics({ title: '', artist: 'Band' }, { get: t4.get })
  is(t4.asked, [], 'no title, nothing is asked')
}

// --- asking politely: one at a time, spaced, and quiet when told to be
const clock = () => {
  let t = 0
  return { now: () => t, sleep: async (ms) => { t += ms } }
}
const refusal = (status, retryAfter = 0) => Object.assign(new Error(String(status)), { status, retryAfter })
const timed = (c, answers) => {
  const t = table(answers)
  const get = (path, params, client) => { t.asked.push(c.now()); return t.get(path, params, client) }
  return { asked: t.asked, get }
}
{
  const c = clock()
  const pacer = createPacer(c)
  const t5 = timed(c, {})
  await findLyrics({ title: 'Song (Live)', artist: 'Band, Guest' }, { get: t5.get, pacer })
  is(t5.asked.filter((x) => typeof x === 'number'), [0, 300, 600], 'requests go one at a time, 300 ms apart')
}
{
  const c = clock()
  const pacer = createPacer(c)
  const t6 = timed(c, { '/search|Song (Live)|Band': refusal(429, 5) })
  const got = await findLyrics({ title: 'Song (Live)', artist: 'Band' }, { get: t6.get, pacer })
  is([got.unreachable, t6.asked.length], [true, 2], 'a 429 ends the lookup at once')
  const t7 = timed(c, {})
  await findLyrics({ title: 'Other', artist: 'Band' }, { get: t7.get, pacer })
  is(t7.asked[0] >= 5000, true, 'and the next request waits out its Retry-After')
}
{
  const c = clock()
  const pacer = createPacer(c)
  let tries = 0
  const get = async () => { tries++; if (tries === 1) throw refusal(503, 2); return [entry(200)] }
  const got = await findLyrics({ title: 'Song', artist: 'Band', duration: 200 }, { get, pacer })
  is([got.synced.length, c.now() >= 2000], [1, true], 'a 503 is tried again after its Retry-After')
}
{
  const t8 = table({})
  const got = await findLyrics({ title: 'Song', artist: 'Band' }, { get: t8.get, pacer: createPacer(clock()), wanted: () => false })
  is([got.gone, t8.asked.length], [true, 0], 'a song nobody wants any more is not asked about')
}
{
  const t9 = table({})
  await findLyrics({ title: 'Suite', artist: 'Band', album: 'Album', duration: 4000 }, { get: t9.get, pacer: createPacer(clock()) })
  is(t9.asked.map((a) => a[0]), ['/search'], 'a track over an hour skips /get, which refuses it')
}

if (failed) { console.log(`${failed} failed`); process.exit(1) }
