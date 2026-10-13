// Song lyrics from LRCLIB (https://lrclib.net), asked by the browser itself.
//
// LRCLIB is a free, community-kept library of lyrics with no account and no
// key, and most of its entries carry LRC timings, one per line:
//
//     [00:31.48] Like the legend of the phoenix, huh
//
// The lookup goes straight from the reader's browser to lrclib.net, not
// through Sonora: Sonora never fetches, holds or passes on a song's words.
// It is only made while a big player's lyrics are open, and the answers live
// in this page's memory and nowhere else. LRCLIB sends the CORS headers for
// this and reads who is asking from the X-User-Agent header, its stand-in
// for the User-Agent a page cannot set.
//
// Finding the song:
//
// 1. /api/get with the title, artist, album and length. LRCLIB matches the
//    length within a couple of seconds and answers 404 for anything less than
//    all four, so it is skipped when the length is unknown.
// 2. /api/search on the title and artist, then on the title stripped of the
//    decorations services add ("Get Lucky - Radio Edit", "(2011 Remaster)",
//    "(feat. ...)") and the first of several artists. Timed lyrics are only
//    taken from an entry whose length is within a few seconds of the playing
//    track's: another edit of the song has other timings. An entry of
//    another length still gives its words, untimed.
//
// Asking politely, as LRCLIB's implementation requirements ask: every request
// on the page waits its turn in one line, a moment after the last one ended,
// and a 429 or 503 holds the whole line for as long as its Retry-After says.
// A song the player has moved on from is not asked about at all.

const API = 'https://lrclib.net/api'
//: How far, in seconds, an entry's length may be from the track's for its
//: timings to be trusted.
const TIMING_SLACK = 3
//: The pause, in milliseconds, between one request to LRCLIB and the next.
const GAP_MS = 300
//: The longest track /api/get takes, in seconds; it refuses longer ones.
const LONGEST = 3600
//: How long to hold off, in seconds, after a 429 or 503 that names no time.
const BACK_OFF = { 429: 30, 503: 1 }

const LRC_LINE = /^((?:\[\d+:\d+(?:[.:]\d+)?\])+)(.*)$/
const LRC_STAMP = /\[(\d+):(\d+)(?:[.:](\d+))?\]/g
// What services add to a title that the song's own name does not have: a
// bracketed or dashed "Remastered 2011", "Radio Edit", "Live", "feat. X",
// "From the Motion Picture ..." and the like.
const DECORATION = new RegExp(
  String.raw`\s*(?:[(\[][^)\]]*(?:remaster|edit|version|live|mono|stereo|mix|feat\.?|ft\.|with |from |deluxe|bonus|explicit|clean)[^)\]]*[)\]]`
  + String.raw`|\s-\s.*(?:remaster|edit|version|live|mono|stereo|mix|deluxe|bonus).*$)`, 'gi')
const FEATURING = /\s+(?:feat\.?|ft\.|featuring)\s+.*$/i
const SEVERAL = /\s*(?:,|;|&|\band\b|\bx\b|\/)\s*/i

/** [[seconds, line], ...] in time order from LRC text. A line stamped with
 * several times (a repeated chorus) is listed at each; tag lines such as
 * [ar: ...] and lines with no stamp are dropped. */
export function parseLrc(text) {
  const out = []
  for (const raw of String(text || '').split(/\r?\n/)) {
    const m = LRC_LINE.exec(raw.trim())
    if (!m) continue
    const words = m[2].trim()
    for (const [, mm, ss, frac] of m[1].matchAll(LRC_STAMP)) {
      const at = Number(mm) * 60 + Number(ss) + (frac ? Number(frac) / 10 ** frac.length : 0)
      out.push([Math.round(at * 100) / 100, words])
    }
  }
  return out.sort((a, b) => a[0] - b[0])
}

/** The song's own name, with what a service added to it taken off. */
export function plainTitle(title) {
  const cleaned = String(title || '').replace(DECORATION, '').replace(FEATURING, '').trim().replace(/^[\s-]+|[\s-]+$/g, '')
  return cleaned || String(title || '').trim()
}

/** The first of several credited artists ("Daft Punk, Pharrell Williams"). */
export function firstArtist(artist) {
  const lead = String(artist || '').replace(FEATURING, '')
  return (lead.split(SEVERAL)[0] || lead).trim()
}

function answer(entry, timed) {
  const synced = timed ? parseLrc(entry.syncedLyrics) : []
  let plain = String(entry.plainLyrics || '').trim()
  if (!plain && entry.syncedLyrics) plain = parseLrc(entry.syncedLyrics).map(([, words]) => words).join('\n')
  return { found: true, instrumental: Boolean(entry.instrumental), synced, plain }
}

/** The best of a search's entries for a track `duration` seconds long (0
 * when unknown): timed lyrics of the right length first, then any words. */
export function pick(results, duration, album = '') {
  if (!Array.isArray(results) || !results.length) return null
  const off = (entry) => {
    const length = Number(entry.duration)
    return Number.isFinite(length) ? Math.abs(length - duration) : Infinity
  }
  const sameAlbum = String(album || '').toLowerCase()
  const rank = (a, b) => ((duration ? off(a) - off(b) : 0)
    || (String(a.albumName || '').toLowerCase() !== sameAlbum) - (String(b.albumName || '').toLowerCase() !== sameAlbum))
  // With no length to go by, no entry's timings can be trusted to fit, and
  // the words are shown as they are.
  if (duration) {
    const fitting = results.filter((e) => e.syncedLyrics && off(e) <= TIMING_SLACK).sort(rank)
    if (fitting.length) return answer(fitting[0], true)
  }
  const worded = results.filter((e) => e.plainLyrics || e.syncedLyrics || e.instrumental).sort(rank)
  return worded.length ? answer(worded[0], false) : null
}

const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms) })

/**
 * One line for requests: `run(job)` starts `job` once every earlier one has
 * finished and the gap after it has passed, and `hold(seconds)` keeps the
 * line still that long from now. `now` and `sleep` stand in for the clock in
 * lyrics.check.mjs.
 */
export function createPacer({ gap = GAP_MS, now = () => Date.now(), sleep = wait } = {}) {
  let tail = Promise.resolve()
  let next = 0
  const run = (job) => {
    const turn = tail.then(async () => {
      for (let left = next - now(); left > 0; left = next - now()) await sleep(left)
      try { return await job() } finally { next = Math.max(next, now() + gap) }
    })
    tail = turn.catch(() => {})
    return turn
  }
  const hold = (seconds) => { next = Math.max(next, now() + seconds * 1000) }
  return { run, hold }
}

// The page's one line to LRCLIB, shared by every lookup.
const line = createPacer()
// Thrown in place of a request for a song nobody wants any more.
const GONE = Symbol('gone')

/**
 * Looks a song up on LRCLIB: { found, instrumental, synced: [[seconds, line]],
 * plain }, with `unreachable: true` added when LRCLIB could not be asked, and
 * `gone: true` when `wanted()` turned false before the lookup was done.
 * `client` names the asker in the X-User-Agent header; `get` and `pacer`
 * stand in for the network and the clock in lyrics.check.mjs.
 */
export async function findLyrics({ title, artist, album = '', duration = 0 }, { client = 'Sonora', get = request, pacer = line, wanted = () => true } = {}) {
  title = String(title || '').trim()
  artist = String(artist || '').trim()
  album = String(album || '').trim()
  duration = Math.max(0, Number(duration) || 0)
  const none = { found: false, instrumental: false, synced: [], plain: '' }
  if (!title || !artist) return none
  // A try that fails does not end the lookup -- LRCLIB answers 503 now and
  // then under load -- but a miss is only reported when every try was
  // answered, since a miss is kept for the page's life and a failure is not.
  // A 429 ends it: LRCLIB has asked for quiet.
  let failed = false
  let stop = null
  const ask = async (path, params) => {
    for (let attempt = 1; ; attempt++) {
      try {
        return await pacer.run(() => { if (!wanted()) throw GONE; return get(path, params, client) })
      } catch (error) {
        if (error === GONE) { stop = 'gone'; return null }
        const status = error?.status
        if (status === 429 || status === 503) pacer.hold(error.retryAfter || BACK_OFF[status])
        if (status === 429) { stop = 'limited'; return null }
        if (status >= 500 && attempt === 1) continue
        failed = true
        return null
      }
    }
  }
  const tries = []
  const seconds = Math.round(duration)
  if (album && seconds >= 1 && seconds <= LONGEST) {
    tries.push(['/get', { track_name: title, artist_name: artist, album_name: album, duration: String(seconds) }])
  }
  const searched = []
  for (const pair of [[title, artist], [plainTitle(title), artist], [plainTitle(title), firstArtist(artist)]]) {
    if (searched.some(([a, b]) => a === pair[0] && b === pair[1])) continue
    searched.push(pair)
    tries.push(['/search', { track_name: pair[0], artist_name: pair[1] }])
  }
  for (const [path, params] of tries) {
    const got = await ask(path, params)
    if (stop) break
    const found = path === '/get' ? (got && answer(got, Boolean(got.syncedLyrics))) : pick(got, duration, album)
    if (found) return found
  }
  if (stop === 'gone') return { ...none, unreachable: true, gone: true }
  return failed || stop ? { ...none, unreachable: true } : none
}

// One request to LRCLIB. 404 is "no such song", not a failure; any other
// refusal is thrown with its status and the Retry-After it named, if any.
// `no-store` keeps the answer out of the browser's own HTTP cache, which is
// on disk: LRCLIB's answers say nothing about caching, so a browser was free
// to keep a copy of each song's lyrics there.
async function request(path, params, client) {
  const response = await fetch(`${API}${path}?${new URLSearchParams(params)}`,
    { headers: { 'X-User-Agent': client }, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store' })
  if (response.status === 404) return null
  if (response.ok) return response.json()
  const retryAfter = Number(response.headers.get('Retry-After'))
  throw Object.assign(new Error(`LRCLIB answered ${response.status}`),
    { status: response.status, retryAfter: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 0 })
}
