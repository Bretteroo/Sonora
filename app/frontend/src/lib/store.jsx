import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useReducer,
  useRef, useState,
} from 'react'
import { ApiError, api } from './api.js'
import { localOut } from './localOut.js'
import { BROWSER_UUID, browserGroup, browserZone, isBrowserRoom } from './browserRoom.js'
import { browserSleep } from './browserSleep.js'
import { forgetLast, readLast, saveLast } from './browserRecall.js'
import { useI18n } from '../i18n/index.jsx'
import { useTheme } from './theme.jsx'

// Live system state, fed by the backend's WebSocket.
//
// Two things make this more than a thin cache. First, volume needs optimistic
// updates: a slider that waits for a speaker to confirm each step feels
// broken, so local intent wins until the speaker's own event catches up.
// Second, a refused action is normal rather than exceptional here, because the
// speaker refusals are collected as notices
// the interface can present instead of being thrown away.

const SystemContext = createContext(null)

const initialState = {
  connected: false,
  loading: true,
  error: null,
  // Bumped whenever the speakers report a configured-service change, so
  // views listing services refetch without a manual reload.
  servicesEpoch: 0,
  queueEpochs: {},
  favoritesEpoch: 0,
  recentEpoch: 0,
  sleepEpoch: 0,
  //: Whether the live socket has sent its own snapshot yet; a slower HTTP
  //: one that lands afterwards is stale and ignored.
  pushed: false,
  playlistsEpoch: 0,
  radioEpoch: 0,
  libraryEpoch: 0,
  alarmsEpoch: 0,
  households: [],
  zones: {},
  groups: [],
  zoneOrder: [],
  // uuid -> { level, at } while a local change is outstanding
  pendingVolume: {},
  notices: [],
  // A rescan has no percentage to report: discovery is a fixed multicast
  // listen followed by enrichment. What can be shown is that one is running,
  // and afterwards what it found.
  scanning: false,
  lastScan: null,
}

// When a room's state arrived, on the page's own clock. Its position_age
// is how old the reading was when the server sent it; the page adds how long
// it has held it since, so a room chosen well after its state arrived does
// not start its count that far behind (12 seconds).
function stamped(zone) {
  if (!zone?.transport) return zone
  return { ...zone, transport: { ...zone.transport, received_at: performance.now() } }
}

function indexZones(list) {
  const zones = {}
  for (const zone of list) zones[zone.uuid] = stamped(zone)
  return zones
}

function reducer(state, action) {
  switch (action.type) {
    case 'connected':
      return { ...state, connected: action.value }

    case 'snapshot': {
      // Two snapshots race at start-up: one fetched over HTTP so the page has
      // content even if the socket is slow, and one the socket itself sends
      // on connecting. The socket's is the live one and everything after it
      // arrives in order, so a late HTTP answer is dropped rather than
      // rolling a room back to how it looked before the first push.
      if (action.from === 'fetch' && state.pushed) return state
      const { zones, groups, households } = action.data
      return {
        pushed: state.pushed || action.from === 'socket',
        ...state,
        loading: false,
        error: null,
        households: households ?? [],
        zones: indexZones(zones ?? []),
        zoneOrder: (zones ?? []).map((z) => z.uuid),
        groups: groups ?? [],
        // A fresh snapshot is authoritative, so outstanding local guesses go.
        pendingVolume: {},
      }
    }

    case 'zone': {
      const incoming = stamped(action.data)
      const pending = state.pendingVolume[incoming.uuid]
      // Ignore a stale volume from the speaker while our own change is in
      // flight, otherwise a dragged slider jumps backwards.
      const zone = pending && pending.level !== incoming.volume
        ? { ...incoming, volume: pending.level }
        : incoming
      const pendingVolume = { ...state.pendingVolume }
      if (pending && pending.level === incoming.volume) {
        delete pendingVolume[incoming.uuid]
      }
      const known = incoming.uuid in state.zones
      return {
        ...state,
        zones: { ...state.zones, [incoming.uuid]: zone },
        zoneOrder: known ? state.zoneOrder : [...state.zoneOrder, incoming.uuid],
        pendingVolume,
      }
    }

    case 'services':
      return { ...state, servicesEpoch: state.servicesEpoch + 1 }

    // A container the speakers keep -- the queue, favorites, Sonos playlists,
    // saved stations -- changed, in this controller or another one. Each is
    // counted rather than carried, so a pane refetches by naming the counter
    // in its effect and nothing has to merge a partial update. The queue is
    // counted per room, since every room has its own.
    case 'queue':
      return {
        ...state,
        queueEpochs: {
          ...state.queueEpochs,
          [action.zone]: (state.queueEpochs[action.zone] || 0) + 1,
        },
      }
    case 'favorites':
      return { ...state, favoritesEpoch: state.favoritesEpoch + 1 }
    case 'recent':
      return { ...state, recentEpoch: state.recentEpoch + 1 }
    case 'sleep':
      return { ...state, sleepEpoch: state.sleepEpoch + 1 }
    case 'playlists':
      return { ...state, playlistsEpoch: state.playlistsEpoch + 1 }
    case 'radio':
      return { ...state, radioEpoch: state.radioEpoch + 1 }
    case 'library':
      return { ...state, libraryEpoch: state.libraryEpoch + 1 }
    case 'alarms':
      return { ...state, alarmsEpoch: state.alarmsEpoch + 1 }

    case 'localVolume':
      return {
        ...state,
        zones: state.zones[action.uuid]
          ? {
              ...state.zones,
              [action.uuid]: { ...state.zones[action.uuid], volume: action.level },
            }
          : state.zones,
        pendingVolume: {
          ...state.pendingVolume,
          [action.uuid]: { level: action.level, at: Date.now() },
        },
      }

    case 'notice':
      return {
        ...state,
        notices: [
          { id: action.id, ...action.notice },
          ...state.notices,
        ].slice(0, 6),
      }

    case 'dismiss':
      return {
        ...state,
        notices: state.notices.filter((n) => n.id !== action.id),
      }

    case 'scanning':
      return { ...state, scanning: action.value }

    case 'scanned':
      return { ...state, scanning: false, lastScan: action.result }

    case 'error':
      return { ...state, loading: false, error: action.message }

    default:
      return state
  }
}

// The speaker's transport status, in words. Anything it reports that is not
// listed keeps its own name rather than being flattened to "failed": a status
// this does not know yet is still better read than hidden.
function playbackReason(status) {
  return PLAYBACK_REASONS[status] || ''
}

//: Statuses where the machine serving the source is the thing to name.
const REACH_ERRORS = new Set(['ERROR_CANT_CONNECT', 'ERROR_NOT_FOUND'])

const PLAYBACK_REASONS = {
  ERROR_UNSUPPORTED_FORMAT: 'notice.cannotPlay.format',
  ERROR_CANT_CONNECT: 'notice.cannotPlay.connect',
  ERROR_CANNOT_PLAY: 'notice.cannotPlay.refused',
  ERROR_NOT_FOUND: 'notice.cannotPlay.missing',
  ERROR_NO_PERMISSION: 'notice.cannotPlay.permission',
}

// What to call a room in a message about it: the group's name when it is in
// one with others, its own otherwise. The group's name is its coordinator's,
// which is how every pane labels it.
function roomLabel(state, uuid) {
  const zone = state.zones?.[uuid]
  const group = (state.groups || []).find((g) => g.members?.includes(uuid))
  if (group && (group.members?.length || 0) > 1) {
    return group.name || state.zones?.[group.coordinator]?.name || zone?.name || ''
  }
  return zone?.name || ''
}

export function SystemProvider({ children }) {
  // "This browser": the page's own audio output, presented as a room. It is
  // built here rather than in a theme so every theme gets it, and so the one
  // <audio> element is shared however many panes are drawn.
  const { t } = useI18n()
  const [out, setOut] = useState(() => localOut.state)
  useEffect(() => localOut.subscribe(setOut), [])
  const { theme } = useTheme()
  const [state, dispatch] = useReducer(reducer, initialState)
  // The browser room's sleep timer changing (set, cleared or run out) is
  // announced the way a speaker's is, so every sleep pane reads it again.
  useEffect(() => browserSleep.subscribe(() => dispatch({ type: 'sleep' })), [])
  const noticeId = useRef(0)
  const socketRef = useRef(null)

  // The latest state for run(), which is memoised once.
  const stateRef = useRef(state)
  stateRef.current = state

  const notify = useCallback((notice) => {
    noticeId.current += 1
    dispatch({ type: 'notice', id: noticeId.current, notice })
  }, [])

  const dismiss = useCallback((id) => dispatch({ type: 'dismiss', id }), [])

  // Translate a backend refusal into something worth showing a person.
  const run = useCallback(async (fn, { describe, uuid, skip = false } = {}) => {
    try {
      return await fn()
    } catch (error) {
      // Named after the room the action was for, so a notice about one
      // speaker among many says which.
      const room = uuid ? roomLabel(stateRef.current, uuid) : ''
      const detail = room ? `${room}: ${error.message}` : error.message
      if (skip && error instanceof ApiError) {
        // Next and Previous as the S1 Android app answers them: UPnP 800 is a
        // skip limit reached (its SC_NP_ERR_SKIP_LIMIT), said each time, and
        // any other refusal leaves the page as it was.
        if (error.code === '800') {
          notify({ kind: 'warning', titleKey: 'notice.skipLimit.title', detailKey: 'notice.skipLimit.body' })
        } else {
          console.warn(detail)
        }
        return null
      }
      if (error instanceof ApiError) {
        // Notices carry translation keys rather than sentences: the store
        // has no translator, and the theme that renders them does.
        if (error.isConflict) {
          notify({
            kind: 'conflict',
            titleKey: describe || 'notice.conflict.title',
            detail,
          })
        } else if (error.isSilent) {
          // The speaker went quiet rather than refusing: an older one busy
          // resolving a service stream can take half a minute to come back.
          notify({ kind: 'warning', titleKey: 'notice.silent.title',
                   detailKey: 'notice.silent.body',
                   detailParams: { room: room || '' } })
        } else {
          notify({ kind: 'error', titleKey: describe || 'notice.error.title',
                   detail })
        }
      } else {
        notify({ kind: 'network', titleKey: 'notice.network.title',
                 detail: String(error?.message || error) })
      }
      return null
    }
  }, [notify])

  useEffect(() => {
    let closed = false
    let retry = 0
    let timer = null

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const socket = new WebSocket(`${protocol}://${window.location.host}/ws`)
      socketRef.current = socket

      socket.onopen = () => {
        retry = 0
        dispatch({ type: 'connected', value: true })
        // Something has to travel client to server periodically or an idle
        // proxy may drop the connection.
        socket.send('hello')
      }
      socket.onmessage = (event) => {
        const message = JSON.parse(event.data)
        if (message.type === 'snapshot') {
          dispatch({ type: 'snapshot', data: message.data, from: 'socket' })
        } else if (message.type === 'zone') {
          dispatch({ type: 'zone', data: message.data })
        } else if (message.type === 'services') {
          dispatch({ type: 'services' })
        } else if (message.type === 'alarms') {
          dispatch({ type: 'alarms' })
        } else if (message.type === 'playbackError') {
          // The speaker's own account of a source it could not open, whatever
          // service it came from and however playback was started. This is the
          // only place a playback failure is reported: a speaker answers Play
          // with success and then fails quietly, so nothing the caller sees
          // says so.
          notify({
            kind: 'warning',
            titleKey: 'notice.cannotPlay.title',
            // The machine is only worth naming when reaching it was the
            // problem. An unsupported format came back from a host that
            // answered perfectly well, and saying "nothing came back from
            // hls.somafm.com" about it would be wrong.
            detailKey: message.host && REACH_ERRORS.has(message.status)
              ? 'notice.cannotPlay.stream' : 'notice.cannotPlay.detail',
            detailParams: {
              room: message.room || '',
              item: message.title || '',
              service: message.service || '',
              host: message.host || '',
              reason: playbackReason(message.status) ? t(playbackReason(message.status))
                : message.status,
            },
          })
        } else if (message.type === 'queue') {
          // A container the speakers keep changed, here or in another
          // controller. Every kind is forwarded by name; this handler is an
          // allowlist, and a push not named here is dropped silently.
          dispatch({ type: 'queue', zone: message.zone })
        } else if (message.type === 'favorites' || message.type === 'playlists'
                   || message.type === 'radio' || message.type === 'library'
                   || message.type === 'recent') {
          // 'recent' is the backend's own: a room started something new. It was missing here,
          // so Recently Played never refreshed until a reload.
          dispatch({ type: message.type })
        }
      }
      socket.onclose = () => {
        dispatch({ type: 'connected', value: false })
        if (closed) return
        retry = Math.min(retry + 1, 6)
        timer = setTimeout(connect, 500 * 2 ** (retry - 1))
      }
      socket.onerror = () => socket.close()
    }

    // Fetch so the interface has content even if the socket is slow, and keep
    // fetching until something answers.
    //
    // This used to be one attempt, and a page that made it while Sonora was
    // not answering -- a restart, a phone waking up, a moment of no Wi-Fi --
    // showed "cannot reach the controller" and stayed there. The socket
    // reconnects and the server sends a snapshot when it does, so recovery
    // was possible; it just depended entirely on the socket getting through.
    // Reported from a phone after a backend restart.
    //
    // The error is still raised on the first failure, because a person
    // looking at a blank screen is owed the reason, and it clears itself the
    // moment any snapshot arrives from either channel.
    let attempt = 0
    let fetchTimer = null
    const load = () => {
      api.state()
        .then((data) => dispatch({ type: 'snapshot', data, from: 'fetch' }))
        .catch((error) => {
          if (closed) return
          dispatch({ type: 'error', message: String(error.message) })
          attempt = Math.min(attempt + 1, 6)
          fetchTimer = setTimeout(load, 500 * 2 ** (attempt - 1))
        })
    }
    load()
    connect()

    const keepalive = setInterval(() => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send('ping')
      }
    }, 25000)

    return () => {
      closed = true
      clearInterval(keepalive)
      if (timer) clearTimeout(timer)
      if (fetchTimer) clearTimeout(fetchTimer)
      socketRef.current?.close()
    }
  }, [])

  const actions = useMemo(() => ({
    refresh: async () => {
      dispatch({ type: 'scanning', value: true })
      const result = await run(() => api.refresh(), { describe: 'notice.error.title' })
      dispatch({ type: 'scanned', result: result
        ? { rooms: result.zones, systems: result.households, at: Date.now() }
        : null })
      return result
    },

    setVolume: (uuid, level) => {
      dispatch({ type: 'localVolume', uuid, level })
      return run(() => api.volume(uuid, level), { describe: 'notice.conflict.title', uuid })
    },
    setGroupVolume: (uuid, level) =>
      run(() => api.volume(uuid, level, true), { describe: 'notice.conflict.title', uuid }),
    nudgeVolume: (uuid, delta) => run(() => api.nudgeVolume(uuid, delta), { uuid }),
    setMute: (uuid, muted, group = false) =>
      run(() => api.mute(uuid, muted, group), { describe: 'notice.conflict.title', uuid }),

    // A Play that does not start is reported by the speaker itself, in an
    // AVTransport event naming the status and what failed, and the notice is
    // raised from there (see playbackError above). Watching the transport from
    // here could only ever guess: a service resolving a URL of its own sits in
    // STOPPED for seconds and then plays perfectly, which the old check read as
    // a failure and toasted over the top of.
    play: (uuid) => run(() => api.transport(uuid, 'play'),
                        { describe: 'notice.conflict.title', uuid }),
    pause: (uuid) => run(() => api.transport(uuid, 'pause'),
                         { describe: 'notice.conflict.title', uuid }),
    stop: (uuid) => run(() => api.transport(uuid, 'stop'), { describe: 'notice.conflict.title', uuid }),
    next: (uuid) => run(() => api.transport(uuid, 'next'), { uuid, skip: true }),
    previous: (uuid) => run(() => api.transport(uuid, 'previous'), { uuid, skip: true }),
    seek: (uuid, position) => run(() => api.seek(uuid, { position }),
                                  { describe: 'notice.conflict.title', uuid }),
    seekTrack: (uuid, track) => run(() => api.seek(uuid, { track }),
                                    { describe: 'notice.conflict.title', uuid }),
    // A mode the speaker said it will not take for what it plays is not
    // asked for: the keyboard shortcuts reach past a dimmed key.
    setPlayMode: (uuid, mode) => {
      const tr = stateRef.current.zones?.[uuid]?.transport || {}
      const refused = (/SHUFFLE/.test(mode) && tr.can_shuffle === false)
        || (/REPEAT_ONE/.test(mode) ? tr.can_repeat_one === false
          : (/REPEAT_ALL/.test(mode) || mode === 'SHUFFLE') && tr.can_repeat === false)
      return refused ? Promise.resolve(null)
        : run(() => api.playMode(uuid, mode), { describe: 'notice.conflict.title', uuid })
    },
    setTone: (uuid, patch) => run(() => api.tone(uuid, patch),
                                  { describe: 'notice.conflict.title', uuid }),
    rename: (uuid, name) => run(() => api.settings(uuid, { name }),
                                { describe: 'notice.conflict.title', uuid }),
    setStatusLight: (uuid, on) =>
      run(() => api.settings(uuid, { status_light: on }),
          { describe: 'notice.conflict.title', uuid }),

    join: (uuid, coordinator) => run(() => api.join(uuid, coordinator),
                                     { describe: 'notice.conflict.title', uuid }),
    leave: (uuid) => run(() => api.leave(uuid), { describe: 'notice.conflict.title', uuid }),
    delegate: (uuid, heir) => run(() => api.delegate(uuid, heir), { describe: 'notice.conflict.title', uuid }),

    reorderQueue: (uuid, start, insertBefore, count = 1) =>
      run(() => api.reorderQueue(uuid, { start, count, insert_before: insertBefore }), { describe: 'notice.conflict.title', uuid }),
    removeFromQueue: (uuid, index) => run(() => api.removeFromQueue(uuid, index), { describe: 'notice.conflict.title', uuid }),
    clearQueue: (uuid) => run(() => api.clearQueue(uuid),
                              { describe: 'notice.conflict.title', uuid }),
    // Every service names its own ratings, in the map that travels with the
    // item: the id to send is the button's. Pandora's thumbs were once a
    // table written out by hand here, because its map uses the
    // newer spelling the reader did not know.
    rateItemById: (uuid, sid, itemId, rating) =>
      run(() => api.rateItem(sid, { zone: uuid, item_id: itemId, rating }), { describe: 'notice.error.title', uuid }),
    serviceFavorite: (sid, body) => run(() => api.serviceFavorite(sid, body), { describe: 'notice.conflict.title', uuid: body.zone }),
    // The URL names which of the service's own declared actions to carry
    // out; the method and headers come from what the service declared, not
    // from here, so there is nothing for a caller to point elsewhere.
    serviceAction: (uuid, sid, link) => run(() => api.serviceAction(sid, { zone: uuid, url: link.url }), { describe: 'notice.conflict.title', uuid }),
    setRadioLocation: (uuid, node, city) => run(() => api.setRadioLocation({ zone: uuid, node, city }), { describe: 'notice.conflict.title', uuid }),
    addRadioStation: (uuid, url, title, kind = 'stations') => run(() => api.addRadioStation({ zone: uuid, url, title, kind }), { describe: 'notice.conflict.title', uuid }),
    removeRadioStation: (uuid, id) => run(() => api.removeRadioStation({ zone: uuid, id }), { describe: 'notice.conflict.title', uuid }),
    addFavoriteItem: (uuid, body) => run(() => api.addFavoriteItem({ zone: uuid, ...body }), { describe: 'notice.conflict.title', uuid }),
    createStereoPair: (uuid, rightUuid) => run(() => api.createStereoPair(uuid, rightUuid), { describe: 'notice.conflict.title', uuid }),
    separateStereoPair: (uuid) => run(() => api.separateStereoPair(uuid), { describe: 'notice.conflict.title', uuid }),
    createPlaylist: (uuid, title) => run(() => api.createPlaylist({ zone: uuid, title }), { describe: 'notice.conflict.title', uuid }),
    addToPlaylist: (uuid, id, item, sourceId = '') => run(() => api.addToPlaylist({ zone: uuid, id, uri: item.uri, metadata: item.metadata || '', title: item.title || '', source_id: sourceId }), { describe: 'notice.conflict.title', uuid }),
    removePlaylistTrack: (uuid, id, index) => run(() => api.removePlaylistTrack({ zone: uuid, id, index }), { describe: 'notice.conflict.title', uuid }),
    movePlaylistTrack: (uuid, id, index, to) => run(() => api.movePlaylistTrack({ zone: uuid, id, index, to }), { describe: 'notice.conflict.title', uuid }),
    renamePlaylist: (uuid, id, current, title) =>
      run(() => api.renamePlaylist({ zone: uuid, id, current, title }), { describe: 'notice.conflict.title', uuid }),
    removePlaylist: (uuid, id) => run(() => api.removePlaylist({ zone: uuid, id }), { describe: 'notice.conflict.title', uuid }),
    renameFavorite: (uuid, id, current, title) =>
      run(() => api.renameFavorite({ zone: uuid, id, current, title }), { describe: 'notice.conflict.title', uuid }),
    removeFavorite: (uuid, id) =>
      run(() => api.removeFavorite({ zone: uuid, id }), { describe: 'notice.conflict.title', uuid }),
    addFavorite: (uuid) => run(() => api.addFavorite(uuid), { describe: 'notice.conflict.title', uuid }),
    saveQueue: (uuid, title, objectId = '') => run(() => api.saveQueue(uuid, title, objectId),
                                    { describe: 'notice.conflict.title', uuid }),
    // A source the speaker will not crossfade (a Spotify Connect queue) is
    // not asked: a keyboard shortcut reached it past the dimmed key and the
    // speaker answered UPnP 712.
    setCrossfade: (uuid, enabled) => (stateRef.current.zones?.[uuid]?.transport?.can_crossfade === false
      ? Promise.resolve(null)
      : run(() => api.crossfade(uuid, enabled), { describe: 'notice.conflict.title', uuid })),
    setSleepTimer: (uuid, duration) => run(() => api.setSleepTimer(uuid, duration),
                                           { describe: 'notice.conflict.title', uuid }),
    // An item dropped into the queue. `position` is 1-based; 0 is the end,
    // which is what the apps' "Add to End of Queue" asks for.
    enqueue: (uuid, item, position = 0) => run(
      () => api.setSource(uuid, {
        uri: item.uri, metadata: item.metadata || '', title: item.title || '',
        enqueue: true, position,
      }),
      { describe: 'notice.conflict.title', uuid }),
    setSource: (uuid, body) => run(() => api.setSource(uuid, body),
                                   { describe: 'notice.conflict.title', uuid }),
  }), [run, notify])

  // What the browser room does instead. A page is not a speaker: it has no
  // clock to share, no service tokens and no way to mount a share, so the
  // things it cannot do say so rather than failing quietly.
  // The request the browser room is playing, which a reload replays.
  const recallBody = useRef(null)
  const localActions = useMemo(() => {
    const refuseGrouping = () => {
      notify({ kind: 'warning', titleKey: 'local.cannotGroup.title',
               detailKey: 'local.cannotGroup.detail' })
      return null
    }
    const refuseFeature = () => {
      notify({ kind: 'warning', titleKey: 'local.cannotDo.title',
               detailKey: 'local.cannotDo.detail' })
      return null
    }
    const titleFrom = (metadata) => {
      const m = /<dc:title>([^<]*)<\/dc:title>/.exec(metadata || '')
      return m ? m[1] : ''
    }
    const classFrom = (metadata) => {
      const m = /<upnp:class>([^<]*)<\/upnp:class>/.exec(metadata || '')
      return m ? m[1] : ''
    }
    // A single track's artist and album, from its own DIDL: the backend's
    // answer names them only for a station's track, and without them the
    // panes had nothing to call a Plex song but a station.
    const fieldFrom = (metadata, tag) => {
      const m = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`).exec(metadata || '')
      return m ? m[1] : ''
    }
    // The item's own picture, from its DIDL, for a request that names none.
    // Most panes send only the browsed item's metadata, so a station started
    // from a favorite or a service page reached the browser room, and was
    // remembered, with no art at all. A speaker's
    // relative /getaa path is made whole against the speaker it was browsed
    // from, or any speaker found, since the page has no host of its own.
    const artFrom = (body) => {
      const raw = fieldFrom(body.metadata, 'upnp:albumArtURI')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      if (!raw) return ''
      if (/^https?:\/\//.test(raw)) return raw
      const zones = stateRef.current.zones || {}
      const host = zones[body.from_zone]?.host
        || Object.values(zones).find((zone) => zone?.host && zone.online !== false)?.host
      return host ? `http://${host}:1400${raw.startsWith('/') ? '' : '/'}${raw}` : ''
    }
    // What the output plays, from what the backend resolved. A station hands
    // back a track and a session: the track is what the room shows, and the
    // session is how the next one is asked for when this ends.
    const fromAnswer = (answer, body = {}) => {
      const track = answer.track || null
      const artist = track?.artist || fieldFrom(body.metadata, 'dc:creator') || fieldFrom(body.metadata, 'upnp:artist')
      const album = track?.album || fieldFrom(body.metadata, 'upnp:album')
      return {
        url: answer.url,
        urls: answer.urls || null,
        hls: Boolean(answer.hls),
        title: track?.title || body.title || titleFrom(body.metadata) || answer.host,
        // The station the track came from, kept apart from the track: a
        // service's station ("Trending for you") hands back a song at a
        // time, and the station line is the station's name, not the song's.
        // A single track (a Plex song) is no station at all, and says so in
        // its own class, so it gets none and reads as Song, Artist, Album.
        station: /object\.item\.audioItem\.(musicTrack|audioBook)/.test(classFrom(body.metadata))
          ? ''
          : (body.title || titleFrom(body.metadata) || (track ? '' : answer.host)),
        // A station's second line is the show on air, as a speaker prints it;
        // a track's is its artist and album. The host the stream comes from is
        // the last resort, for a bare radio URL that no service describes.
        sub: track ? (track.show || [track.artist, track.album].filter(Boolean).join(' — '))
                   : ([artist, album].filter(Boolean).join(' — ') || answer.host),
        artist,
        album,
        art: track?.art || body.art || artFrom(body),
        // The service's name. The stream's answer names it; a caller may
        // pass a sid here instead, and Hi-Fi's display then read "188" over
        // AccuRadio, so a bare number never stands for a name.
        service: answer.service || (/^\d*$/.test(String(body.service ?? '')) ? '' : String(body.service)),
        // What was asked for, not what it resolved to: the panes read this to
        // tell a station from a track.
        mediaUri: body.uri || '',
        next: answer.session
          ? async () => {
            const more = await api.streamNext(answer.session).catch(() => null)
            return more && more.url ? fromAnswer(more, body) : null
          }
          : null,
        // An album or playlist answers with its whole list once, as it
        // starts; each later answer only says where in it the room is.
        // `undefined` leaves the list the room already holds.
        queue: Array.isArray(answer.queue) ? answer.queue : undefined,
        queueIndex: Number.isInteger(answer.index) ? answer.index : -1,
        // The server's session, which the queue's edits and Save name.
        session: Array.isArray(answer.queue) ? answer.session : undefined,
        jump: Array.isArray(answer.queue) && answer.session
          ? async (index) => {
            const more = await api.streamJump(answer.session, index).catch(() => null)
            return more && more.url ? fromAnswer(more, body) : null
          }
          : undefined,
      }
    }
    // Named, because one of these is built out of another.
    const local = {
      play: () => localOut.play(),
      pause: () => localOut.pause(),
      stop: () => localOut.stop(),
      next: () => localOut.next(),
      previous: () => localOut.previous(),
      // The panes send a position as the players take it, "H:MM:SS".
      seek: (position) => localOut.seek(
        String(position).split(':').reduce((total, part) => total * 60 + Number(part), 0)),
      // A double-click in the queue: the album or playlist's track at that
      // place (the panes count from 1, as a speaker's queue does).
      seekTrack: (n) => localOut.jump(Number(n) - 1),
      setPlayMode: () => null,
      setVolume: (level) => localOut.setVolume(level),
      setGroupVolume: (level) => localOut.setVolume(level),
      nudgeVolume: (delta) => localOut.setVolume(localOut.state.volume + delta),
      setMute: (muted) => localOut.setMute(muted),
      join: refuseGrouping,
      leave: refuseGrouping,
      delegate: refuseGrouping,
      // An output, not a player: no tone controls, no light, no queue of its
      // own, no pairing. Reached only from a pane that offers them anyway.
      setTone: refuseFeature,
      setStatusLight: refuseFeature,
      setCrossfade: refuseFeature,
      // The page keeps this room's sleep timer itself and stops its own
      // output when it runs out (browserSleep.js).
      setSleepTimer: (duration) => ({ remaining: browserSleep.set(duration) }),
      createStereoPair: refuseFeature,
      separateStereoPair: refuseFeature,
      rename: refuseFeature,
      // An album or playlist's list takes a speaker queue's edits; the panes
      // count from 1, the session from 0. Clearing stops the room, as it
      // stops a speaker; Save writes a Sonos playlist through a speaker.
      clearQueue: () => run(async () => { const done = await localOut.clearQueue(); recallBody.current = null; forgetLast(); return done },
        { describe: 'notice.conflict.title' }),
      reorderQueue: (start, insertBefore, count = 1) => run(() => localOut.editQueue(
        { action: 'move', start: Number(start) - 1, count, insert_before: Number(insertBefore) - 1 }),
        { describe: 'notice.conflict.title' }),
      removeFromQueue: (index) => run(() => localOut.editQueue({ action: 'remove', index: Number(index) - 1 }),
        { describe: 'notice.conflict.title' }),
      saveQueue: (title) => run(() => localOut.saveQueue(title), { describe: 'notice.error.title' }),
      addFavorite: refuseFeature,
      // "Add Radio Station" for this room plays the URL rather than saving it:
      // a browser belongs to no household, so there is no saved-station list
      // of its own to put it in. It is also the only source Sonora has when
      // no Sonos is on the network at all.
      addRadioStation: async (url, title) => {
        const answer = await local.setSource({ uri: url, title })
        return answer ? { title: title || url } : null
      },
      setSource: async (body) => {
        // `start`: a track of the album to begin at (a restored queue).
        const { start = '', ...asked } = body
        const answer = await run(() => api.streamUrl(asked.uri, asked.from_zone || '', start), { describe: 'notice.error.title' })
        if (!answer) return null
        if (!answer.url) {
          const why = { 'needs-speaker': 'local.cannotPlay.needsSpeaker',
                        'needs-queue': 'local.cannotPlay.needsQueue',
                        'needs-link': 'local.cannotPlay.needsLink',
                        'service-refused': 'local.cannotPlay.serviceRefused',
                        'protected': 'local.cannotPlay.protected' }[answer.reason]
          notify({ kind: 'warning', titleKey: 'local.cannotPlay.title',
                   detailKey: why || 'local.cannotPlay.unknown',
                   detailParams: { service: answer.service || '' } })
          return null
        }
        // A new source: a station or a single track brings no list, so the
        // one from before goes.
        const loaded = { ...fromAnswer(answer, asked), ...(Array.isArray(answer.queue) ? {} : { queue: null, jump: null }) }
        recallBody.current = asked
        await localOut.load(loaded)
        // The length may have arrived while it loaded, and was saved then;
        // this save comes after and must not take it away.
        saveLast(asked, { ...loaded, duration: localOut.state.duration || 0 })
        return answer
      },
    }
    return local
  }, [run, notify])

  // What the room last played comes back after a reload, stopped, and Play
  // starts it again (browserRecall.js).
  useEffect(() => {
    const saved = readLast()
    if (!saved) return
    recallBody.current = saved.body
    // Play resumes the track the album was on; a double-click in the restored
    // queue names its own.
    const at = saved.shown?.queue?.[saved.shown.queueIndex]?.uri || ''
    localOut.restore(saved.shown, (start) => localActions.setSource({ ...saved.body, start: start || at }))
  }, [localActions])

  // Kept as it moves on, not only when it starts: a new track, a jump, or an
  // edit of the album's list is saved, so a reload comes back to the track
  // and the list as they were.
  useEffect(() => {
    let seen = null
    return localOut.subscribe((now) => {
      if (!recallBody.current || !now.url) return
      const key = `${now.url}|${now.queueIndex}`
      const timed = now.duration > 0
      const same = seen && seen.key === key && seen.queue === now.queue
      // Saved once more when the track's length becomes known, which is after
      // it starts; never again when it drops to nothing, as it does while the
      // page unloads and the element is emptied.
      if (same && (seen.timed || !timed)) return
      seen = { key, queue: now.queue, timed: timed || Boolean(same && seen.timed) }
      saveLast(recallBody.current, now)
    })
  }, [])

  // One surface for the panes: a call naming the browser room goes to the
  // page's output, everything else to a speaker.
  const routed = useMemo(() => {
    const merged = { ...actions }
    for (const [name, local] of Object.entries(localActions)) {
      const remote = actions[name]
      merged[name] = (uuid, ...rest) => (isBrowserRoom(uuid)
        ? local(...rest)
        : (name === 'join' && isBrowserRoom(rest[0]) ? local(...rest) : remote(uuid, ...rest)))
    }
    return merged
  }, [actions, localActions])

  const browserName = t('local.room')
  // Whether the browser room is offered: the theme has to want it (one that
  // sets localOutput false does not), and there has to be a system for it to
  // sit alongside. It
  // stands in for a speaker, so with no S1 or S2 found the page says it found
  // nothing rather than offering an output on its own (user's decision).
  const offerLocal = theme?.localOutput !== false && (state.households || []).length > 0
  // Only something actually loaded is stopped. Every page starts with no
  // system found yet, and stopping then wiped the length of the item just
  // brought back from the last visit, so a station's song read "Live".
  useEffect(() => { if (!offerLocal && localOut.state.url) localOut.stop() }, [offerLocal])
  const value = useMemo(() => {
    const zones = offerLocal ? { ...state.zones, [BROWSER_UUID]: browserZone(out, browserName) } : state.zones
    const zoneOrder = offerLocal
      ? [...state.zoneOrder.filter((uuid) => uuid !== BROWSER_UUID), BROWSER_UUID]
      : state.zoneOrder
    // A group's transport is its coordinator's, so it is read from the zone
    // rather than kept as a second copy. The copy came with the last full
    // snapshot and nothing updated it afterwards -- zone events land on
    // `zones` alone -- so a room card, which reads the group, went on showing
    // the stream before last while Now Playing, which reads the zone, was
    // right (reported on Amazon Music).
    // A group carries a copy of its coordinator's transport, taken when the
    // topology was last built, so it is stale the moment the track changes.
    // The room's own state is the live one and it is what every surface must
    // read: a card that took the group's copy showed the previous stream
    // while Now Playing had moved on. The copy is
    // replaced here, once, rather than each caller remembering to.
    const fromZones = (state.groups || []).map((group) => {
      const lead = state.zones[group.coordinator]
      return lead?.transport ? { ...group, transport: lead.transport } : group
    })
    const groups = offerLocal ? [...fromZones, browserGroup(out, browserName)] : fromZones
    return {
      ...state,
      zones,
      zoneOrder,
      groups,
      zoneList: zoneOrder.map((uuid) => zones[uuid]).filter(Boolean),
      actions: routed,
      notify,
      dismiss,
    }
  }, [state, routed, notify, dismiss, out, browserName, offerLocal])

  return (
    <SystemContext.Provider value={value}>{children}</SystemContext.Provider>
  )
}

export function useSystem() {
  const value = useContext(SystemContext)
  if (!value) throw new Error('useSystem must be used inside SystemProvider')
  return value
}

// A single room, plus the group it belongs to and whichever zone owns its
// transport. Themes need this constantly and getting it wrong is the most
// common source of grouping bugs.
export function useZone(uuid) {
  const { zones, groups } = useSystem()
  return useMemo(() => {
    const zone = zones[uuid]
    if (!zone) return null
    const group = groups.find((g) => g.members.includes(uuid))
    const coordinator = group ? zones[group.coordinator] : zone
    return {
      zone,
      group,
      coordinator: coordinator || zone,
      isCoordinator: !group || group.coordinator === uuid,
      members: (group?.members ?? [uuid]).map((id) => zones[id]).filter(Boolean),
    }
  }, [zones, groups, uuid])
}
