// The audio output of the page itself: one <audio> element, wrapped.
//
// This is what the "This browser" room plays through. It is deliberately a
// single element rather than one per room: the page is one output, so two
// rooms playing at once through it would just be two streams over each other.
//
// Nothing here talks to Sonos. State is reported through subscribers so the
// virtual room can present a transport the way a real one does.

import { api } from './api.js'
import { setBrowserQueue } from './browserQueue.js'
import { setBrowserItem } from './browserItem.js'

const listeners = new Set()

let element = null
// The HLS player, only when a stream needs one. Loaded on demand so the
// library is not in the bundle every page pays for.
let hls = null
// What is left of a playlist: a station often opens with a pre-roll and puts
// the live stream after it, and a speaker plays the entries in turn.
let rest = []
let nextTrack = null
// An album or playlist's way to a given track (index from 0), beside
// nextTrack; null for a station, which has no list.
let jumpTrack = null
// The list's own Next, kept apart from nextTrack: a station playing beside
// the list has a Next of its own (or none), and a double-click back into the
// list needs the list's again.
let listNext = null
// The service the list came from, for the same reason.
let listService = ''
// How the list's source is opened again at one of its tracks, for when the
// server no longer holds the list: after a reload, or hours of a station
// playing beside it. Null for a list built here by Add to Queue, which has
// no source to ask again.
let reopenList = null
let ticker = null
// What the last load was asked to play, so that Play after Stop can start it
// again: Stop drops the element's source to end the connection, and a
// speaker's Play after Stop goes back to the station.
let lastLoad = null
// How long the service says the loaded track is, in seconds: 0 for a station,
// and wherever it does not say.
let stated = 0
// The loaded track's length. The service's figure stands from the moment the
// track is loaded, and goes on standing while the element's own measurement
// agrees with it to within a couple of seconds: the lyrics are looked up by
// this number, so it has to be there before the file's header is, and must
// not then shift by a rounding. An element that measures something else is
// believed over the service. One that measures nothing (a browser gives no
// length for some files, and none at all until the header has arrived) leaves
// the service's figure where it is; with neither, 0, which reads as live.
export function trackLength(measured, said) {
  const own = Number.isFinite(measured) && measured > 0 ? measured : 0
  if (!own) return said
  return said && Math.abs(own - said) < 2 ? said : Math.floor(own)
}
const lengthOf = (el) => trackLength(el ? el.duration : 0, stated)
// The page cannot read a stream's own metadata, so a stream that carries
// titles comes through Sonora, which notes them as it passes (/api/stream/
// title). Asked every ten seconds while it plays; three empty answers in a
// row and the stream is taken to have none.
let titleTimer = null
function watchTitle(url, station, isHls) {
  if (titleTimer) { clearTimeout(titleTimer); titleTimer = null }
  if (!url || isHls) return
  let empty = 0
  const ask = async () => {
    titleTimer = null
    if (current.url !== url) return
    if (current.state === 'PLAYING' || current.state === 'TRANSITIONING') {
      let title = ''
      try { title = (await api.streamTitle(url, station))?.title || '' } catch { title = '' }
      if (current.url !== url) return
      empty = title ? 0 : empty + 1
      if (title !== current.streamText) { current = { ...current, streamText: title }; emit() }
      if (empty >= 3) return
    }
    titleTimer = setTimeout(ask, 10000)
  }
  titleTimer = setTimeout(ask, 3000)
}
// What the room last played, kept across a reload (browserRecall.js puts it
// back): shown stopped, and started again on Play by asking the backend for a
// fresh stream, since the resolved stream URL does not outlive its session.
let replay = null
// A replay under way: a jump it leads to does not start another (they would go round for ever).
let replaying = false
// A Web Audio analyser on the element, made the first time a display asks
// for one (analyser() below). This is the one room whose sound the page
// itself plays, and so the one a level display can honestly show, for the
// sources the page is allowed to read (see readable()).
let audioCtx = null
let analyserNode = null
// One analyser per channel beside the main one, for a pair of level meters.
let channelNodes = null
let splitterNode = null
// The element the analysers listen to, and its source node. Web Audio can
// only read audio the page is allowed to read: a stream from another origin
// that sends no CORS headers (a Plex server's plex.direct address) comes out
// of a routed element as silence, while the element still reports playing.
// So only a same-origin source, or an HLS stream the
// page assembles itself, is ever routed; any other source plays from an
// element that never was, and the level displays say there is nothing to read.
let graphElement = null
let graphSource = null
function readable(url, isHls) {
  if (isHls) return true
  try { return new URL(url, window.location.href).origin === window.location.origin } catch { return false }
}
// Swap out an element that is routed through Web Audio for a fresh one, for
// a source it could not play aloud. A routed element cannot be unrouted.
function retire() {
  const old = element
  if (!old) return
  element = null
  try { old.pause(); old.removeAttribute('src'); old.load() } catch { /* already gone */ }
  old.remove()
}
function wakeAudio() {
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {})
}
const SAVED_LEVEL = 'sonora.browser.level'
function savedLevel() {
  try {
    const raw = JSON.parse(window.localStorage.getItem(SAVED_LEVEL) || 'null')
    return raw && Number.isFinite(raw.volume) ? raw : null
  } catch { return null }
}
function saveLevel() {
  try { window.localStorage.setItem(SAVED_LEVEL, JSON.stringify({ volume: current.volume, muted: current.muted })) } catch { /* fine */ }
}
// The room's play mode, named as a speaker names them. It steers a track
// playing out of the room's list and nothing else: a station playing beside
// the list has a Next of its own.
const MODES = ['NORMAL', 'REPEAT_ALL', 'REPEAT_ONE', 'SHUFFLE', 'SHUFFLE_NOREPEAT', 'SHUFFLE_REPEAT_ONE']
const SAVED_MODE = 'sonora.browser.mode'
function savedMode() {
  try {
    const raw = window.localStorage.getItem(SAVED_MODE)
    return MODES.includes(raw) ? raw : null
  } catch { return null }
}
let current = {
  url: '',
  // The service URI the room was asked to play, kept beside the resolved
  // audio URL. The panes classify what is playing from it -- a station is
  // labeled Station / On Now, a track Song / Artist / Album -- so without it
  // the browser room drew a station as though it were a track.
  mediaUri: '',
  title: '',
  sub: '',
  // What the stream itself says is on (its ICY title), which is what a
  // speaker prints on the Information line.
  streamText: '',
  artist: '',
  album: '',
  art: '',
  service: '',
  // The service's id, the playing item's id there, and the room the source
  // was browsed from: what the panes' rating buttons are asked for by.
  serviceId: 0,
  itemId: '',
  fromZone: '',
  //  Seconds. `duration` is 0 for a live stream, which has none.
  position: 0,
  duration: 0,
  // Whether a station or a book has another track after this one.
  hasNext: false,
  // An album or playlist playing here: its tracks, shaped like a speaker's
  // queue items, and the place of the one playing (from 0). Null otherwise.
  queue: null,
  queueIndex: -1,
  // Whether what plays came out of that list. A station or a stream plays
  // beside the list and leaves it as it was, the way a speaker's queue stays
  // while radio plays.
  inList: false,
  // The server's session for that list, which edits and Save name.
  session: null,
  state: 'STOPPED',   // STOPPED | PLAYING | PAUSED_PLAYBACK | TRANSITIONING
  volume: 35,
  muted: false,
  error: '',
  // True while what is shown is only remembered: nothing is loaded, and Play
  // resolves it again.
  restored: false,
  // Whether the page may read what it plays, for a level display (see
  // readable() below).
  readable: false,
  // One of MODES. SHUFFLE alone repeats the list, as on a speaker.
  playMode: 'NORMAL',
}
{
  const level = typeof window === 'undefined' ? null : savedLevel()
  if (level) current = { ...current, volume: Math.max(0, Math.min(100, Math.round(level.volume))), muted: Boolean(level.muted) }
  const mode = typeof window === 'undefined' ? null : savedMode()
  if (mode) current = { ...current, playMode: mode }
}

const shuffles = () => current.playMode.startsWith('SHUFFLE')
// 'one', 'all', or '' for no repeat.
const repeats = () => (current.playMode.endsWith('REPEAT_ONE') ? 'one'
  : (current.playMode === 'SHUFFLE' || current.playMode === 'REPEAT_ALL' ? 'all' : ''))
// Whether what plays is a track of the room's list, which is what the modes steer.
const listed = () => Array.isArray(current.queue) && current.inList
  && current.queueIndex >= 0 && current.queueIndex < current.queue.length

// The shuffled order: the list's places (from 0) in the order they play. It is
// made for one list (orderRows) and remembers each row by a key (orderKeys),
// so a list that is added to, trimmed, or rearranged keeps the turns of the
// rows still in it. The place in the order is never kept; it is wherever the
// track playing stands.
let order = null
let orderRows = null
let orderKeys = null
// True while the list's source is being opened again at one of its tracks (see go()).
let reopening = false
function forgetOrder() { order = null; orderRows = null; orderKeys = null }
const pick = (n) => Math.floor(Math.random() * n)
// The same track twice in a list is two rows, told apart by which one it is.
function rowKeys(rows) {
  const seen = new Map()
  return rows.map((row) => {
    const id = row.uri || `${row.title}\n${row.artist}`
    const n = seen.get(id) || 0
    seen.set(id, n + 1)
    return `${n}\n${id}`
  })
}
function playOrder() {
  const rows = current.queue
  if (!Array.isArray(rows) || !rows.length) { forgetOrder(); return [] }
  if (order && orderRows === rows) return order
  const keys = rowKeys(rows)
  const place = new Map(keys.map((key, i) => [key, i]))
  const at = current.inList ? current.queueIndex : -1
  const turns = order ? order.map((was) => place.get(orderKeys[was])).filter((i) => i !== undefined) : []
  const have = new Set(turns)
  // The track playing opens an order made around it.
  if (at >= 0 && !have.has(at)) { turns.unshift(at); have.add(at) }
  for (let i = 0; i < rows.length; i += 1) {
    if (have.has(i)) continue
    const from = turns.indexOf(at) + 1
    // A row put straight after the track playing (Play Next) has the next
    // turn. Any other new row takes a turn at random among those to come,
    // which from an empty order is a plain shuffle.
    if (order && at >= 0 && i === at + 1) turns.splice(from, 0, i)
    else turns.splice(from + pick(turns.length - from + 1), 0, i)
  }
  order = turns
  orderRows = rows
  orderKeys = keys
  return order
}
// Where the list goes after the track playing: a place in it, -1 for nowhere
// (the order has run out), or null where the modes have no say and the
// list's own Next decides.
function following() {
  if (!listed()) return null
  const rows = current.queue
  const round = repeats() === 'all'
  if (!shuffles()) return round && current.queueIndex + 1 >= rows.length ? 0 : null
  const turns = playOrder()
  const pos = turns.indexOf(current.queueIndex)
  if (pos + 1 < turns.length) return turns[pos + 1]
  if (!round) return -1
  // Round again in a new order, which does not open with the track just played.
  const again = []
  for (let i = 0; i < rows.length; i += 1) again.splice(pick(again.length + 1), 0, i)
  if (again.length > 1 && again[0] === current.queueIndex) {
    const other = 1 + pick(again.length - 1)
    again[0] = again[other]
    again[other] = current.queueIndex
  }
  order = again
  orderRows = rows
  orderKeys = rowKeys(rows)
  return again[0]
}
// A track picked by hand takes the next turn, and the tracks not yet played keep theirs.
function pull(index) {
  if (index === current.queueIndex && current.inList) return
  const turns = playOrder()
  const was = turns.indexOf(index)
  if (was < 0) return
  const here = current.inList ? turns.indexOf(current.queueIndex) : -1
  turns.splice(was, 1)
  turns.splice(here < 0 ? 0 : (was < here ? here : here + 1), 0, index)
}
// What subscribers are told. Next is offered while the list has somewhere to
// go: a shuffled list that does not repeat ends with its last turn.
function snapshot() {
  // When the reported whole second began, on the page's clock, so a reader can tell exactly how
  // far into the song the music is at any moment rather than to the nearest second: words and a
  // video kept in step with the song need that.
  const el = element
  const positionAt = el && Number.isFinite(el.currentTime)
    ? performance.now() - Math.max(0, el.currentTime - (current.position || 0)) * 1000 : null
  const base = { ...current, positionAt }
  if (!current.hasNext || !listed() || !shuffles() || repeats() === 'all') return base
  const turns = playOrder()
  return { ...base, hasNext: turns.indexOf(current.queueIndex) + 1 < turns.length }
}

// The clock, while something plays: the position is passed on once a second,
// enough for a position bar and few enough renders that the rest of the
// interface does not feel it. It is looked at four times as often, so the
// new second is reported within a quarter of a second of starting. Looked at
// once a second, it was reported up to a second late whenever play resumed
// partway through one, and words timed to the music ran that far behind.
function clock(on) {
  if (ticker) { clearInterval(ticker); ticker = null }
  if (!on) return
  ticker = setInterval(() => {
    const el = element
    if (!el) return
    const position = Math.floor(el.currentTime || 0)
    const duration = lengthOf(el)
    if (position === current.position && duration === current.duration) return
    current = { ...current, position, duration }
    emit()
  }, 250)
}

function emit() {
  const now = snapshot()
  for (const listener of listeners) listener(now)
}

function audio() {
  if (element) return element
  if (typeof document === 'undefined') return null
  const el = document.createElement('audio')
  element = el
  // A retired element (see retire()) may still fire an event or two as it
  // is taken down; only the current one speaks for the room.
  const mine = (fn) => (...args) => { if (el === element) fn(...args) }
  element.id = 'sonora-local-out'
  element.preload = 'none'
  // A stream is live: never let the browser try to resume from a cached point.
  element.autoplay = false
  element.volume = current.volume / 100
  element.muted = current.muted
  element.addEventListener('playing', mine(() => {
    current = { ...current, state: 'PLAYING', error: '' }
    clock(true)
    emit()
  }))
  const measured = () => {
    const duration = lengthOf(element)
    if (duration === current.duration) return
    current = { ...current, duration }
    emit()
  }
  element.addEventListener('loadedmetadata', mine(measured))
  element.addEventListener('durationchange', mine(measured))
  element.addEventListener('pause', mine(() => {
    // A track that plays to its end is paused by the browser a moment before
    // the browser says it has ended. `ended` speaks for that; reported as a
    // pause, the end of a song would look like someone stopping it.
    if (element.ended) { clock(false); return }
    // Pausing a live stream and pausing a track look the same to the element;
    // the room reports PAUSED and picks up from live on the next play.
    if (current.state !== 'STOPPED') { clock(false); current = { ...current, state: 'PAUSED_PLAYBACK' }; emit() }
  }))
  element.addEventListener('waiting', mine(() => { current = { ...current, state: 'TRANSITIONING' }; emit() }))
  element.addEventListener('ended', mine(() => {
    const next = rest.shift()
    if (next) { element.src = next; element.play().catch(() => {}); return }
    // The list's modes come first: one track over again, or the place the
    // shuffled or repeating list goes to next.
    if (listed() && repeats() === 'one') {
      element.currentTime = 0
      element.play().catch(() => {})
      current = { ...current, position: 0 }
      emit()
      return
    }
    const to = following()
    if (to !== null) {
      if (to >= 0) go(to)
      else { current = { ...current, state: 'STOPPED' }; emit() }
      return
    }
    // A station serves one track at a time: ask for the next, as a speaker
    // does, rather than falling silent after one song.
    if (nextTrack) { advance(); return }
    current = { ...current, state: 'STOPPED' }
    emit()
  }))
  element.addEventListener('error', mine(() => {
    // A station's list is often the same stream several ways over, so a
    // failure moves to the next entry before it is called a failure.
    const next = rest.shift()
    if (next) { element.src = next; element.play().catch(() => {}); return }
    // The element's own error codes say little a person can act on; what
    // matters is that the page could not play it.
    current = { ...current, state: 'STOPPED', error: 'playback' }
    emit()
  }))
  // In the page rather than detached: the element is then inspectable, and a
  // browser treats a document's own media element consistently.
  document.body.appendChild(element)
  return element
}

async function advance() {
  const asked = nextTrack
  let more = null
  try {
    more = await asked()
  } catch {
    more = null
  }
  // The station may have been swapped for something else while this was in
  // flight; only the answer to the current one is used.
  if (!more || !more.url || asked !== nextTrack) {
    if (asked === nextTrack) { current = { ...current, state: 'STOPPED' }; emit() }
    return
  }
  await localOut.load({ ...more, service: current.service, next: asked })
}

function detachHls() {
  if (!hls) return
  try { hls.destroy() } catch { /* already gone */ }
  hls = null
}

// The server's list edits, for a list the page holds alone. `index` is the place of the
// track playing (-1 for none); it moves with the track, and is -1 once that track is removed.
// Places count from 0, a move's `insert_before` in the list as it was.
export function editRows(queue, index, edit) {
  const rows = [...queue]
  let at = index
  if (edit.action === 'remove') {
    const i = Number(edit.index)
    if (i < 0 || i >= rows.length) return { queue: rows, index: at }
    rows.splice(i, 1)
    at = at === i ? -1 : at > i ? at - 1 : at
  } else if (edit.action === 'move') {
    const start = Number(edit.start)
    const count = Math.max(1, Number(edit.count) || 1)
    const moved = rows.splice(start, count)
    let before = Number(edit.insert_before)
    if (before > start) before -= count
    before = Math.max(0, Math.min(rows.length, before))
    rows.splice(before, 0, ...moved)
    if (at >= start && at < start + count) at = before + (at - start)
    else if (at >= 0) {
      if (at >= start + count) at -= count
      if (at >= before) at += count
    }
  } else if (edit.action === 'clear') {
    rows.length = 0
    at = -1
  }
  return { queue: rows.map((row, i) => ({ ...row, track_number: i + 1 })), index: at }
}

// Play the list's track at a place (from 0), whoever asked: a double-click, or the modes.
async function go(index) {
  if (current.restored && replay && current.queue?.[index] && !replaying) {
    const again = replay
    replaying = true
    current = { ...current, state: 'TRANSITIONING' }
    emit()
    let started = false
    try { started = await again(current.queue[index].uri, index) } finally { replaying = false }
    if (!started && !current.url) { current = { ...current, state: 'STOPPED' }; emit() }
    return
  }
  const row = current.queue?.[index]
  const asked = jumpTrack
  const back = reopenList
  if (!row || (!asked && !back)) return
  const was = current.state
  const beside = !current.inList
  current = { ...current, state: 'TRANSITIONING' }
  emit()
  let more = null
  if (asked) { try { more = await asked(index) } catch { more = null } }
  if (asked !== jumpTrack) return
  if (more && more.url) {
    // Back in the list, whatever was playing beside it: the list's own
    // Next and service, not the station's.
    await localOut.load({ ...more, service: (beside ? listService : '') || current.service,
                          next: (beside ? listNext : null) || nextTrack || listNext, inList: true })
    return
  }
  // The server no longer holds the list, so its source is opened again at
  // this track. It is the same list come back, so a shuffled order stands.
  if (back) {
    reopening = true
    try { if (await back(row.uri)) return } finally { reopening = false }
  }
  if (current.state !== 'TRANSITIONING') return
  // Nothing came, and nothing was let go of to ask: what was playing plays on, the list's
  // own track as much as a station beside it, and a room that was not playing is as it was.
  const sounding = Boolean(element && current.url && !element.paused && !element.ended)
  current = { ...current, state: was === 'TRANSITIONING' ? (sounding ? 'PLAYING' : current.url ? 'PAUSED_PLAYBACK' : 'STOPPED') : was }
  emit()
}

export const localOut = {
  subscribe(listener) {
    listeners.add(listener)
    listener(snapshot())
    return () => listeners.delete(listener)
  },

  get state() {
    return snapshot()
  },

  /** Point the output at a URL and start it. */
  async load({ url, urls = null, title = '', sub = '', artist = '', album = '', art = '',
               service = '', mediaUri = '', station = '', hls: isHls = false, next = null,
               queue, queueIndex = -1, jump, session, reopen = null, inList,
               serviceId = 0, itemId = '', fromZone = '', duration = 0 }) {
    const able = typeof window !== 'undefined' && readable(url, isHls)
    if (!able && element && element === graphElement) retire()
    const el = audio()
    if (!el) return
    wakeAudio()
    // `undefined` keeps the list already held. A next or a jump within the
    // list answers without it, and so does a station, a stream, or a lone
    // track, which plays beside the list as radio plays beside a speaker's
    // queue: the queue is still there afterwards. Only a new list or Clear
    // Queue replaces it. A list there would be no way back into (no session
    // on the server and no source to open again) does go.
    const fresh = queue !== undefined
    // A new list is shuffled anew, around the track it starts with.
    if (fresh && !reopening) forgetOrder()
    const through = inList === undefined ? (fresh ? Boolean(queue) : current.inList) : Boolean(inList)
    const list = fresh ? queue : (through || current.session || reopenList ? current.queue : null)
    const held = !list ? null : (session === undefined ? current.session : session)
    if (jump !== undefined) jumpTrack = jump
    if (fresh && list) { listNext = next; listService = service; reopenList = reopen }
    if (!list) { jumpTrack = null; listNext = null; listService = ''; reopenList = null }
    const within = Boolean(list) && through
    stated = Math.max(0, Math.floor(Number(duration) || 0))
    // The list is not kept here: Play after Stop keeps whatever list the
    // room holds by then, which an edit may have changed.
    lastLoad = { url, urls, title, sub, artist, album, art, service, mediaUri, station, hls: isHls, next,
                 serviceId, itemId, fromZone, duration: stated }
    nextTrack = next
    replay = null
    current = { ...current, url, title, sub, artist, album, art, service, mediaUri, station, serviceId, itemId, fromZone,
                restored: false, readable: able,
                position: 0, duration: stated, hasNext: Boolean(next), streamText: '',
                queue: list || null, queueIndex: within ? queueIndex : -1, inList: within, session: held,
                error: '', state: 'TRANSITIONING' }
    emit()
    watchTitle(url, title, isHls)
    detachHls()
    rest = (urls || []).slice(1)
    if (isHls && !el.canPlayType('application/vnd.apple.mpegurl')) {
      // Several services publish their stations as HLS -- iHeartRadio does,
      // and Amazon's tracks arrive that way -- and no browser but Safari
      // plays a manifest natively.
      try {
        const { default: Hls } = await import('hls.js')
        if (Hls.isSupported()) {
          hls = new Hls({ enableWorker: true })
          // A manifest that will not load leaves the element at readyState 0
          // with no error of its own, so the room would sit on "connecting"
          // for ever. hls.js knows, and says so here.
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (!data?.fatal) return
            current = { ...current, state: 'STOPPED', error: 'playback' }
            emit()
          })
          hls.loadSource(url)
          hls.attachMedia(el)
        } else {
          el.src = url
        }
      } catch {
        el.src = url
      }
    } else {
      el.src = url
    }
    try {
      await el.play()
    } catch (exc) {
      // Autoplay policies: a play() not started by a click is refused, and the
      // room shows stopped rather than pretending.
      current = { ...current, state: 'STOPPED', error: exc?.name === 'NotAllowedError' ? 'blocked' : 'playback' }
      emit()
    }
    // Nothing at all after twenty seconds is a failure, whatever the element
    // and the library have to say about it.
    const started = url
    setTimeout(() => {
      if (current.url !== started || current.state !== 'TRANSITIONING') return
      const now = audio()
      if (now && now.readyState > 0) return
      current = { ...current, state: 'STOPPED', error: 'playback' }
      emit()
    }, 20000)
  },

  /**
   * The analyser the page's audio runs through, for a level display, or null
   * where Web Audio is missing. Routing the element through it is for good:
   * its sound then goes out by way of the context, which is woken whenever
   * the room is played.
   */
  analyser() {
    if (!current.readable) return null
    const el = audio()
    if (!el) return null
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return null
    try {
      if (!audioCtx) {
        audioCtx = new Ctx()
        analyserNode = audioCtx.createAnalyser()
        analyserNode.fftSize = 4096
        analyserNode.smoothingTimeConstant = 0.72
        analyserNode.connect(audioCtx.destination)
        // The channels are only listened to, never played: the splitter's
        // outputs end at their analysers.
        splitterNode = audioCtx.createChannelSplitter(2)
        channelNodes = [0, 1].map((channel) => {
          const node = audioCtx.createAnalyser()
          node.fftSize = 2048
          splitterNode.connect(node, channel)
          return node
        })
      }
      if (graphElement !== el) {
        if (graphSource) { try { graphSource.disconnect() } catch { /* gone with its element */ } }
        graphSource = audioCtx.createMediaElementSource(el)
        graphSource.connect(analyserNode)
        graphSource.connect(splitterNode)
        graphElement = el
      }
    } catch {
      return null
    }
    wakeAudio()
    return analyserNode
  },

  /** The left and right channels' analysers, for level meters, or null. */
  channelAnalysers() {
    return localOut.analyser() ? channelNodes : null
  },

  /**
   * Show what the room last played, stopped, after a reload. `again` starts
   * it for real when Play is pressed.
   */
  restore({ title = '', sub = '', artist = '', album = '', art = '', service = '', mediaUri = '', station = '',
            queue = null, queueIndex = -1, inList, duration = 0 }, again, reopen = null) {
    if (current.url || current.state !== 'STOPPED') return
    replay = again
    // The album's list comes back as it was, stopped; it has no session yet,
    // so a double-click in it or Play starts the album again at that track.
    // `reopen` is the way back into it once a station that was playing
    // beside it has been started again.
    const list = Array.isArray(queue) && queue.length ? queue : null
    const within = Boolean(list) && (inList === undefined ? queueIndex >= 0 : Boolean(inList))
    listNext = null
    listService = ''
    reopenList = list ? reopen : null
    current = { ...current, title, sub, artist, album, art, service, mediaUri, station, restored: true,
                serviceId: 0, itemId: '', fromZone: '',
                duration: Number(duration) || 0, position: 0,
                queue: list, queueIndex: within ? queueIndex : -1, inList: within, session: null }
    emit()
  },

  async play() {
    wakeAudio()
    const el = audio()
    if (el && !current.url && replay) {
      const again = replay
      current = { ...current, state: 'TRANSITIONING' }
      emit()
      const started = await again()
      if (!started && !current.url) { current = { ...current, state: 'STOPPED' }; emit() }
      return
    }
    if (!el || !current.url) return
    // Stopped, the element holds no source any more; starting it again is a
    // load of what it last played, as a speaker's Play after Stop is.
    if (!el.getAttribute('src') && !hls && lastLoad) {
      await localOut.load({ ...lastLoad, queueIndex: current.queueIndex, inList: current.inList })
      return
    }
    try {
      await el.play()
    } catch (exc) {
      current = { ...current, state: 'STOPPED', error: exc?.name === 'NotAllowedError' ? 'blocked' : 'playback' }
      emit()
    }
  },

  pause() {
    const el = audio()
    if (el) el.pause()
  },

  stop() {
    const el = audio()
    detachHls()
    rest = []
    nextTrack = null
    clock(false)
    if (el) {
      el.pause()
      // Dropping the source ends the connection to the station rather than
      // leaving it buffering in the background.
      el.removeAttribute('src')
      el.load()
    }
    if (titleTimer) { clearTimeout(titleTimer); titleTimer = null }
    // Nothing is loaded now; Play loads it again, with its length (lastLoad).
    stated = 0
    current = { ...current, state: 'STOPPED', position: 0, duration: 0, hasNext: false, streamText: '' }
    emit()
  },

  /** Move within the current track. Seconds; a live stream ignores it. */
  seek(seconds) {
    const el = audio()
    const length = el && Number.isFinite(el.duration) && el.duration > 0 ? el.duration : stated
    if (!el || !length) return
    el.currentTime = Math.max(0, Math.min(length, Number(seconds) || 0))
    current = { ...current, position: Math.floor(el.currentTime) }
    emit()
  },

  /**
   * The next track, as the speaker's Next does: the list's next turn under
   * its modes, otherwise whatever the station, book, or list serves next.
   */
  next() {
    const to = current.hasNext ? following() : null
    if (to === null) return nextTrack ? advance() : undefined
    return to >= 0 ? go(to) : undefined
  },

  /** One of the speaker's play modes, for the room's list. */
  setPlayMode(mode) {
    if (!MODES.includes(mode) || mode === current.playMode) return
    const was = shuffles()
    current = { ...current, playMode: mode }
    // Shuffle switched on makes its order around the track playing; switched
    // off, the list carries on from that track in its own order.
    if (shuffles() !== was) forgetOrder()
    try { window.localStorage.setItem(SAVED_MODE, mode) } catch { /* fine */ }
    emit()
  },

  /**
   * Play one track of the album or playlist, by its place (from 0): a
   * double-click in the queue, as on a speaker.
   */
  async jump(index) {
    if (shuffles() && current.queue?.[index]) pull(index)
    return go(index)
  },

  /**
   * An edit of the album or playlist's list (remove / move, places from 0):
   * the server applies it to its session, so Next and a double-click follow
   * the list as it now is, and answers with the list.
   */
  // A track added to a list the page holds with no session on the server (a list restored
  // with the page): into the page's copy, at the end or after the track playing.
  addRow(row, next = false) {
    const rows = Array.isArray(current.queue) ? [...current.queue] : []
    const at = next && current.queueIndex >= 0 ? current.queueIndex + 1 : rows.length
    rows.splice(at, 0, row)
    const queue = rows.map((r, i) => ({ ...r, track_number: i + 1 }))
    current = { ...current, queue }
    emit()
    return { queue, index: current.queueIndex ?? -1 }
  },

  async editQueue(edit) {
    if (current.session) {
      try {
        const answer = await api.streamQueueEdit(current.session, edit)
        // The server's place is the list's last track played, which is not what
        // plays while a station is on beside the list.
        current = { ...current, queue: answer.queue, queueIndex: answer.playing && current.inList ? answer.index : -1 }
        emit()
        return answer
      } catch (error) {
        // A server that no longer holds the list (it was restarted, or the list sat idle)
        // answers 404; the list the page holds is edited instead, below.
        if (error?.status !== 404) throw error
        current = { ...current, session: '' }
      }
    }
    // No list on the server: a list restored with the page, or one the server let go. The
    // edit is made to the page's own copy, by the server's rules, and the copy is what is
    // shown, kept, and played from (a jump into it opens its source again at that track).
    if (!Array.isArray(current.queue)) throw new Error('nothing to edit')
    const done = editRows(current.queue, current.queueIndex ?? -1, edit)
    current = { ...current, queue: done.queue, queueIndex: done.index }
    emit()
    return { queue: done.queue, index: done.index, playing: done.index >= 0 }
  },

  /**
   * Hold a list the room was handed (Add to Queue, Play Next): shown as its
   * queue, with a double-click following it. `playing` says the track
   * playing is in the list, so Next follows it too; a station playing keeps
   * its own Next, and a room playing nothing starts the list from Play.
   */
  adopt({ session, queue, queueIndex = -1, playing = false, next = null, jump = null, service = '' }) {
    if (jump) jumpTrack = jump
    if (next) listNext = next
    // A list started here has no source of its own to open again.
    if (session !== current.session) { reopenList = null; listService = service }
    if (playing && next) {
      nextTrack = next
      if (lastLoad) lastLoad = { ...lastLoad, next }
    }
    // Play on a room holding a list it has not started begins it where the room stands: on the
    // track it shows, where that track is in the list (a list brought back with the page and
    // handed over again, as adding a song to it does). Otherwise what Play was already going to
    // start, the song a reload brought back, is kept; and a room with neither begins the list at
    // its top, or with the first turn of a shuffled one.
    if (!current.url) {
      const shown = Array.isArray(queue) && queueIndex >= 0 && queueIndex < queue.length ? queueIndex : -1
      if (shown >= 0) replay = async () => { await go(shown); return Boolean(current.url) }
      else if (!replay) replay = async () => { await go(shuffles() ? (playOrder()[0] ?? 0) : 0); return Boolean(current.url) }
    }
    current = { ...current, queue, queueIndex, inList: playing || current.inList, session, restored: false,
                hasNext: Boolean(nextTrack) }
    emit()
  },

  /** Clear Queue: the room stops and holds nothing, as a speaker does. */
  async clearQueue() {
    if (current.session) await api.streamQueueEdit(current.session, { action: 'clear' }).catch(() => null)
    localOut.stop()
    nextTrack = null
    jumpTrack = null
    listNext = null
    listService = ''
    reopenList = null
    lastLoad = null
    // What a reload brought back to be played again is cleared with the rest: Play on the
    // empty room starts nothing.
    replay = null
    forgetOrder()
    current = { ...current, url: '', mediaUri: '', title: '', sub: '', artist: '', album: '', art: '', station: '',
                service: '', serviceId: 0, itemId: '', fromZone: '',
                streamText: '', hasNext: false, restored: false, queue: null, queueIndex: -1, inList: false, session: null }
    emit()
    return true
  },

  /** Save Queue: the list as a new Sonos playlist, written through a speaker. */
  async saveQueue(title) {
    if (!current.session) throw new Error('nothing to save')
    return api.streamSave(current.session, { title })
  },

  /**
   * Previous, as a player means it: within an album, the track before when
   * this one has barely begun; otherwise back to the top of this one.
   */
  previous() {
    if (listed() && current.position < 3) {
      let to = -1
      if (shuffles()) {
        const turns = playOrder()
        const pos = turns.indexOf(current.queueIndex)
        if (pos > 0) to = turns[pos - 1]
      } else if (current.queueIndex > 0) to = current.queueIndex - 1
      if (to >= 0) return go(to)
    }
    const el = audio()
    if (el) { el.currentTime = 0; current = { ...current, position: 0 }; emit() }
  },

  setVolume(level) {
    const clamped = Math.max(0, Math.min(100, Math.round(level)))
    current = { ...current, volume: clamped }
    const el = audio()
    if (el) el.volume = clamped / 100
    saveLevel()
    emit()
  },

  setMute(muted) {
    current = { ...current, muted: Boolean(muted) }
    const el = audio()
    if (el) el.muted = Boolean(muted)
    saveLevel()
    emit()
  },
}

// The queue panes read the browser room's queue through api.queue.
setBrowserQueue((start = 0, count = 200) => {
  const list = current.queue || []
  return { items: list.slice(start, start + count), total: list.length }
})

setBrowserItem(() => ({ sid: current.url ? current.serviceId : 0, item: current.itemId, zone: current.fromZone }))
