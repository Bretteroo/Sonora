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
let ticker = null
// What the last load was asked to play, so that Play after Stop can start it
// again: Stop drops the element's source to end the connection, and a
// speaker's Play after Stop goes back to the station.
let lastLoad = null
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
  //  Seconds. `duration` is 0 for a live stream, which has none.
  position: 0,
  duration: 0,
  // Whether a station or a book has another track after this one.
  hasNext: false,
  // An album or playlist playing here: its tracks, shaped like a speaker's
  // queue items, and the place of the one playing (from 0). Null otherwise.
  queue: null,
  queueIndex: -1,
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
}
{
  const level = typeof window === 'undefined' ? null : savedLevel()
  if (level) current = { ...current, volume: Math.max(0, Math.min(100, Math.round(level.volume))), muted: Boolean(level.muted) }
}

// The clock, once a second while something plays: enough for a position bar,
// and few enough renders that the rest of the interface does not feel it.
function clock(on) {
  if (ticker) { clearInterval(ticker); ticker = null }
  if (!on) return
  ticker = setInterval(() => {
    const el = element
    if (!el) return
    const position = Math.floor(el.currentTime || 0)
    const duration = Number.isFinite(el.duration) ? Math.floor(el.duration) : 0
    if (position === current.position && duration === current.duration) return
    current = { ...current, position, duration }
    emit()
  }, 1000)
}

function emit() {
  const snapshot = { ...current }
  for (const listener of listeners) listener(snapshot)
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
    const duration = Number.isFinite(element.duration) ? Math.floor(element.duration) : 0
    if (duration === current.duration) return
    current = { ...current, duration }
    emit()
  }
  element.addEventListener('loadedmetadata', mine(measured))
  element.addEventListener('durationchange', mine(measured))
  element.addEventListener('pause', mine(() => {
    // Pausing a live stream and pausing a track look the same to the element;
    // the room reports PAUSED and picks up from live on the next play.
    if (current.state !== 'STOPPED') { clock(false); current = { ...current, state: 'PAUSED_PLAYBACK' }; emit() }
  }))
  element.addEventListener('waiting', mine(() => { current = { ...current, state: 'TRANSITIONING' }; emit() }))
  element.addEventListener('ended', mine(() => {
    const next = rest.shift()
    if (next) { element.src = next; element.play().catch(() => {}); return }
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

export const localOut = {
  subscribe(listener) {
    listeners.add(listener)
    listener({ ...current })
    return () => listeners.delete(listener)
  },

  get state() {
    return { ...current }
  },

  /** Point the output at a URL and start it. */
  async load({ url, urls = null, title = '', sub = '', artist = '', album = '', art = '',
               service = '', mediaUri = '', station = '', hls: isHls = false, next = null,
               queue, queueIndex = -1, jump, session }) {
    const able = typeof window !== 'undefined' && readable(url, isHls)
    if (!able && element && element === graphElement) retire()
    const el = audio()
    if (!el) return
    wakeAudio()
    // A next or a jump within the same album answers without the list;
    // `undefined` keeps the one already held, and a new source says null.
    const list = queue === undefined ? current.queue : queue
    const held = !list ? null : (session === undefined ? current.session : session)
    if (jump !== undefined) jumpTrack = jump
    if (!list) jumpTrack = null
    lastLoad = { url, urls, title, sub, artist, album, art, service, mediaUri, station, hls: isHls, next,
                 queue: list, queueIndex, jump: jumpTrack }
    nextTrack = next
    replay = null
    current = { ...current, url, title, sub, artist, album, art, service, mediaUri, station, restored: false, readable: able,
                position: 0, duration: 0, hasNext: Boolean(next), streamText: '',
                queue: list || null, queueIndex: list ? queueIndex : -1, session: held,
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
            queue = null, queueIndex = -1, duration = 0 }, again) {
    if (current.url || current.state !== 'STOPPED') return
    replay = again
    // The album's list comes back as it was, stopped; it has no session yet,
    // so a double-click in it or Play starts the album again at that track.
    const list = Array.isArray(queue) && queue.length ? queue : null
    current = { ...current, title, sub, artist, album, art, service, mediaUri, station, restored: true,
                duration: Number(duration) || 0, position: 0,
                queue: list, queueIndex: list ? queueIndex : -1, session: null }
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
      await localOut.load(lastLoad)
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
    current = { ...current, state: 'STOPPED', position: 0, duration: 0, hasNext: false, streamText: '' }
    emit()
  },

  /** Move within the current track. Seconds; a live stream ignores it. */
  seek(seconds) {
    const el = audio()
    if (!el || !Number.isFinite(el.duration) || el.duration <= 0) return
    el.currentTime = Math.max(0, Math.min(el.duration, Number(seconds) || 0))
    current = { ...current, position: Math.floor(el.currentTime) }
    emit()
  },

  /** The next track of a station or book, as the speaker's Next does. */
  next() {
    if (nextTrack) advance()
  },

  /**
   * Play one track of the album or playlist, by its place (from 0): a
   * double-click in the queue, as on a speaker.
   */
  async jump(index) {
    if (current.restored && replay && current.queue?.[index]) {
      const again = replay
      current = { ...current, state: 'TRANSITIONING' }
      emit()
      const started = await again(current.queue[index].uri)
      if (!started && !current.url) { current = { ...current, state: 'STOPPED' }; emit() }
      return
    }
    const asked = jumpTrack
    if (!asked || !current.queue || index < 0 || index >= current.queue.length) return
    current = { ...current, state: 'TRANSITIONING' }
    emit()
    let more = null
    try { more = await asked(index) } catch { more = null }
    if (asked !== jumpTrack) return
    if (!more || !more.url) { current = { ...current, state: 'STOPPED' }; emit(); return }
    await localOut.load({ ...more, service: current.service, next: nextTrack })
  },

  /**
   * An edit of the album or playlist's list (remove / move, places from 0):
   * the server applies it to its session, so Next and a double-click follow
   * the list as it now is, and answers with the list.
   */
  async editQueue(edit) {
    if (!current.session) throw new Error('nothing to edit')
    const answer = await api.streamQueueEdit(current.session, edit)
    current = { ...current, queue: answer.queue, queueIndex: answer.playing ? answer.index : -1 }
    emit()
    return answer
  },

  /** Clear Queue: the room stops and holds nothing, as a speaker does. */
  async clearQueue() {
    if (current.session) await api.streamQueueEdit(current.session, { action: 'clear' }).catch(() => null)
    localOut.stop()
    nextTrack = null
    jumpTrack = null
    lastLoad = null
    current = { ...current, url: '', mediaUri: '', title: '', sub: '', artist: '', album: '', art: '', station: '',
                service: '', streamText: '', hasNext: false, restored: false, queue: null, queueIndex: -1, session: null }
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
    if (current.queue && current.queueIndex > 0 && current.position < 3) {
      localOut.jump(current.queueIndex - 1)
      return
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
