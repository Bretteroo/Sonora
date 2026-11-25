import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useReducer,
  useRef, useState,
} from 'react'
import { ApiError, api } from './api.js'
import { localOut } from './localOut.js'
import { PAGE_ID, socketUrl } from './base.js'
import { BROWSER_UUID, browserGroup, browserZone, isBrowserRoom, noteHouseholds } from './browserRoom.js'
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

// How long a group volume this controller set is shown over the speakers'
// differing reports before theirs is believed.
const GROUP_VOLUME_HOLD_MS = 3000

// The speakers scale a group's rooms from the levels they held when the
// adjustment began, and begin a new adjustment after this long without one.
const GROUP_VOLUME_GESTURE_MS = 1500

// Where a room lands when its group's level moves from `g0` to `level`, having
// been at `v0` when the adjustment began. Going up, a room covers the same
// share of its own headroom as the group does of the group's; going down, it
// keeps its share of the group's level. Measured on S2 speakers 2026-11-16.
function groupScaled(v0, g0, level) {
  const scaled = level >= g0
    ? (g0 >= 100 ? v0 : v0 + (100 - v0) * (level - g0) / (100 - g0))
    : v0 * level / g0
  return Math.max(0, Math.min(100, Math.floor(scaled + 0.5)))
}

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
  scenesEpoch: 0,
  // A scene that is on with every room it plays in stopped or paused, as the
  // server says: { key, name }, for the theme to ask whether to end it.
  sceneQuiet: null,
  // Bumped when the speakers announce a change in their software update (one
  // found, or the players now running it), so "Update Now" asks again.
  updatesEpoch: 0,
  households: [],
  zones: {},
  groups: [],
  zoneOrder: [],
  // uuid -> { level, at } while a local change is outstanding
  pendingVolume: {},
  pendingGroupVolume: {},
  groupGesture: {},
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
        pendingGroupVolume: {},
        groupGesture: {},
      }
    }

    case 'zone': {
      const incoming = stamped(action.data)
      const pending = state.pendingVolume[incoming.uuid]
      const pendingVolume = { ...state.pendingVolume }
      // Ignore a stale volume from the speaker while our own change is in
      // flight, otherwise a dragged slider jumps backwards. A level worked
      // out from the group's (a guess) can be a step off where the speaker
      // lands, so it also gives way with age, and what the speaker last said
      // is kept for the moment it does.
      let zone = incoming
      if (pending) {
        const over = pending.level === incoming.volume
          || (pending.guess && Date.now() - pending.at > GROUP_VOLUME_HOLD_MS)
        if (over) delete pendingVolume[incoming.uuid]
        else {
          zone = { ...incoming, volume: pending.level }
          if (pending.guess) pendingVolume[incoming.uuid] = { ...pending, seen: incoming.volume }
        }
      }
      // The same for a group's volume, which the speakers report on the
      // coordinator. A group can settle a step or two from the level asked
      // for, so the guess also gives way once it is a few seconds old.
      const groupPending = state.pendingGroupVolume[incoming.uuid]
      const pendingGroupVolume = { ...state.pendingGroupVolume }
      if (groupPending) {
        const settled = groupPending.level === incoming.group_volume
          || Date.now() - groupPending.at > GROUP_VOLUME_HOLD_MS
        if (settled) delete pendingGroupVolume[incoming.uuid]
        else zone = { ...zone, group_volume: groupPending.level }
      }
      const known = incoming.uuid in state.zones
      return {
        ...state,
        zones: { ...state.zones, [incoming.uuid]: zone },
        zoneOrder: known ? state.zoneOrder : [...state.zoneOrder, incoming.uuid],
        pendingVolume,
        pendingGroupVolume,
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
    case 'scenes':
      return { ...state, scenesEpoch: state.scenesEpoch + 1 }
    case 'sceneQuiet':
      if (action.over) return state.sceneQuiet?.key === action.key ? { ...state, sceneQuiet: null } : state
      return { ...state, sceneQuiet: { key: action.key, name: action.name || '' } }
    case 'sceneQuietSeen':
      return { ...state, sceneQuiet: null }
    case 'softwareUpdate':
      return { ...state, updatesEpoch: state.updatesEpoch + 1 }

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

    case 'localGroupVolume': {
      const lead = state.zones[action.uuid]
      if (!lead) return state
      const now = Date.now()
      const zones = { ...state.zones, [action.uuid]: { ...lead, group_volume: action.level } }
      const pendingVolume = { ...state.pendingVolume }
      const groupGesture = { ...state.groupGesture }
      // The rooms' own levels are moved along with the group's, to where the
      // speakers will put them, so their sliders follow the drag instead of
      // trailing it one report at a time.
      const rooms = (state.groups.find((g) => g.coordinator === action.uuid)?.members || [])
        .filter((uuid) => state.zones[uuid] && !state.zones[uuid].fixed_output && state.zones[uuid].volume != null)
      if (rooms.length > 1) {
        let gesture = groupGesture[action.uuid]
        const same = gesture && rooms.length === Object.keys(gesture.base).length && rooms.every((uuid) => uuid in gesture.base)
        if (!same || now - gesture.at > GROUP_VOLUME_GESTURE_MS) {
          const base = Object.fromEntries(rooms.map((uuid) => [uuid, state.zones[uuid].volume]))
          const mean = rooms.reduce((sum, uuid) => sum + base[uuid], 0) / rooms.length
          gesture = { base, g0: lead.group_volume ?? Math.floor(mean + 0.5) }
        }
        groupGesture[action.uuid] = { ...gesture, at: now }
        for (const uuid of rooms) {
          const level = groupScaled(gesture.base[uuid], gesture.g0, action.level)
          const before = pendingVolume[uuid]
          zones[uuid] = { ...zones[uuid], volume: level }
          pendingVolume[uuid] = { level, at: now, guess: true, seen: before?.guess ? before.seen : state.zones[uuid].volume }
        }
      }
      return {
        ...state,
        zones,
        pendingVolume,
        groupGesture,
        pendingGroupVolume: {
          ...state.pendingGroupVolume,
          [action.uuid]: { level: action.level, at: now },
        },
      }
    }

    // A group adjustment has been over for a while: any room still shown at
    // a worked-out level goes to what its speaker last reported.
    case 'settleGroupVolume': {
      const gesture = state.groupGesture[action.uuid]
      if (!gesture) return state
      const now = Date.now()
      const zones = { ...state.zones }
      const pendingVolume = { ...state.pendingVolume }
      let changed = false
      for (const uuid of Object.keys(gesture.base)) {
        const pending = pendingVolume[uuid]
        if (!pending?.guess || now - pending.at < GROUP_VOLUME_HOLD_MS) continue
        delete pendingVolume[uuid]
        if (zones[uuid] && pending.seen != null) zones[uuid] = { ...zones[uuid], volume: pending.seen }
        changed = true
      }
      return changed ? { ...state, zones, pendingVolume } : state
    }

    case 'notice':
      // One at a time: the newest replaces the one before, the same words again included.
      return { ...state, notices: [{ id: action.id, ...action.notice }] }

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
  // A service that is already streaming to as many places as the account allows. Sonos names
  // it per service (ERROR_SONOS_STREAM_LIMIT, and its kin), so it is told by its ending.
  if (/_STREAM_LIMIT$/.test(status || '')) return 'notice.cannotPlay.streamLimit'
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

// The mode an album's Play (shuffle off) or Shuffle (shuffle on) key leaves a
// queue in, repeat staying as it was; '' when the queue is in it already.
function albumMode(mode, shuffle) {
  const repeats = mode !== 'NORMAL' && mode !== 'SHUFFLE_NOREPEAT'
  const want = shuffle ? (repeats ? 'SHUFFLE' : 'SHUFFLE_NOREPEAT')
    : (/SHUFFLE/.test(mode) ? (repeats ? 'REPEAT_ALL' : 'NORMAL') : mode)
  return want === mode ? '' : want
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
  const settleTimers = useRef({})

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
      const socket = new WebSocket(socketUrl(`/ws?page=${PAGE_ID}`))
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
        } else if (message.type === 'sceneQuiet') {
          dispatch({ type: 'sceneQuiet', key: message.key, name: message.name, over: Boolean(message.over) })
        } else if (message.type === 'scenes') {
          // Sonora's own scenes changed, here or in another window.
          dispatch({ type: 'scenes' })
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
        } else if (message.type === 'softwareUpdate') {
          dispatch({ type: 'softwareUpdate' })
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
    // A scene was saved, removed, set or ended from this page: every list
    // of scenes reads again now, without waiting on the server's push (which
    // does not arrive while the socket is between connections).
    scenesChanged: () => dispatch({ type: 'scenes' }),
    sceneQuietSeen: () => dispatch({ type: 'sceneQuietSeen' }),
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
    setGroupVolume: (uuid, level) => {
      dispatch({ type: 'localGroupVolume', uuid, level })
      clearTimeout(settleTimers.current[uuid])
      settleTimers.current[uuid] = setTimeout(() => dispatch({ type: 'settleGroupVolume', uuid }), GROUP_VOLUME_HOLD_MS + 50)
      return run(() => api.volume(uuid, level, true), { describe: 'notice.conflict.title', uuid })
    },
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
    // Not asked for where the speaker says it will not take it: an S2
    // soundbar on its TV input lists only "Set, Play" and answers Stop with
    // 701, whichever button, menu or "pause all" reached for it.
    // `tv` asks that a soundbar go back to its television input as it stops;
    // the server decides whether the room is one.
    stop: (uuid, { tv = false } = {}) => {
      if (stateRef.current.zones?.[uuid]?.transport?.can_stop === false) return Promise.resolve(false)
      return run(() => api.transport(uuid, tv ? 'stop-tv' : 'stop'), { describe: 'notice.conflict.title', uuid })
    },
    next: (uuid) => run(() => api.transport(uuid, 'next'), { uuid, skip: true }),
    previous: (uuid) => run(() => api.transport(uuid, 'previous'), { uuid, skip: true }),
    seek: (uuid, position) => run(() => api.seek(uuid, { position }),
                                  { describe: 'notice.conflict.title', uuid }),
    seekTrack: (uuid, track) => run(() => api.seek(uuid, { track }),
                                    { describe: 'notice.conflict.title', uuid }),
    // A mode the speaker said it will not take for what it plays is not
    // asked for: the keyboard shortcuts reach past a dimmed key. `held` says
    // the mode is for the room's queue rather than for what plays: a queue
    // waiting beside a station takes it when it next plays
    // (transport.queue_play_mode is what it waits with).
    setPlayMode: (uuid, mode, { held = false } = {}) => {
      const tr = stateRef.current.zones?.[uuid]?.transport || {}
      const refused = !held && ((/SHUFFLE/.test(mode) && tr.can_shuffle === false)
        || (/REPEAT_ONE/.test(mode) ? tr.can_repeat_one === false
          : (/REPEAT_ALL/.test(mode) || mode === 'SHUFFLE') && tr.can_repeat === false))
      return refused ? Promise.resolve(null)
        : run(() => api.playMode(uuid, mode, held), { describe: 'notice.conflict.title', uuid })
    },
    // Before an album replaces a room's queue: its Shuffle key turns shuffle
    // on and its Play key turns it off. The mode is the queue's, so it goes
    // to the room the album goes to, and is kept for the queue where a
    // station is what plays there now.
    setAlbumShuffle: (uuid, shuffle) => {
      const tr = stateRef.current.zones?.[uuid]?.transport || {}
      const want = albumMode(tr.queue_play_mode || tr.play_mode || 'NORMAL', shuffle)
      return want ? run(() => api.playMode(uuid, want, true), { describe: 'notice.conflict.title', uuid })
        : Promise.resolve(null)
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
    rateItemById: (uuid, sid, itemId, rating) => (isBrowserRoom(uuid)
      // The browser room rates with the service directly, and a rating the
      // service skips on moves the page's own output on, as a speaker moves.
      ? run(async () => {
        const answer = await api.rateBrowserItem({ sid, item_id: itemId, rating, zone: localOut.state.fromZone || '' })
        if (answer?.skip) localOut.next()
        return answer && { ...answer, skipped: Boolean(answer.skip) }
      }, { describe: 'notice.error.title' })
      : run(() => api.rateItem(sid, { zone: uuid, item_id: itemId, rating }), { describe: 'notice.error.title', uuid })),
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
  // The request the room's list came from. It is the same as recallBody while
  // the room plays through the list, and stays behind when a station starts
  // beside it, so the list can be opened again. Null for a list built by Add
  // to Queue, which no one request describes.
  const listBody = useRef(null)
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
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
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
        // How long the service says the track is, in seconds. The room has a
        // length from this before the audio's own header arrives, and where
        // the browser never reports one; a station's answer has no track.
        duration: Number(track?.duration) || 0,
        // The service's name. The stream's answer names it; a caller may
        // pass a sid here instead, and Hi-Fi's display then read "188" over
        // AccuRadio, so a bare number never stands for a name.
        service: answer.service || (/^\d*$/.test(String(body.service ?? '')) ? '' : String(body.service)),
        // What was asked for, not what it resolved to: the panes read this to
        // tell a station from a track.
        mediaUri: body.uri || '',
        // The service and the track's id there, and the room the source was
        // browsed from: what the room's rating buttons are asked for by.
        serviceId: Number((/[?&]sid=(\d+)/.exec(body.uri || '') || [])[1]) || 0,
        itemId: track?.id || '',
        fromZone: body.from_zone || '',
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
            const more = await jumped(answer.session, index)
            return more && more.url ? fromAnswer(more, body) : null
          }
          : undefined,
        // The list's source again, begun at one of its tracks: the way back
        // into the list when the server has let its session go.
        reopen: Array.isArray(answer.queue) ? (start) => local.setSource({ ...body, start }) : undefined,
      }
    }
    // One track of the room's list, asked of the server by its place. A track the service
    // will not serve comes back with the reason, and the reader is told it: the room goes on
    // with what it was playing, and saying nothing would leave a click with no answer.
    const jumped = async (session, index) => {
      const more = await api.streamJump(session, index).catch(() => null)
      if (more && !more.url && more.reason && more.reason !== 'ended') local.refuseSource(more)
      return more
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
      setPlayMode: (mode) => localOut.setPlayMode(mode),
      setAlbumShuffle: (shuffle) => {
        const want = albumMode(localOut.state.playMode || 'NORMAL', shuffle)
        if (want) localOut.setPlayMode(want)
        return Promise.resolve(null)
      },
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
      clearQueue: () => run(async () => {
        const done = await localOut.clearQueue()
        recallBody.current = null
        listBody.current = null
        forgetLast()
        return done
      },
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
      // Why the room cannot take a source, in the words the backend uses.
      refuseSource: (answer) => {
        const why = { 'needs-speaker': 'local.cannotPlay.needsSpeaker',
                      'needs-queue': 'local.cannotPlay.needsQueue',
                      'needs-link': 'local.cannotPlay.needsLink',
                      'service-refused': 'local.cannotPlay.serviceRefused',
                      'protected': 'local.cannotPlay.protected' }[answer.reason]
        notify({ kind: 'warning', titleKey: 'local.cannotPlay.title',
                 detailKey: why || 'local.cannotPlay.unknown',
                 detailParams: { service: answer.service || '' } })
        return null
      },
      // Add to Queue and Play Next: the track goes into the room's list where
      // a speaker's queue would take it. A room holding no list (a single
      // track or a station playing, or nothing) starts one, headed by the
      // track playing; a station playing keeps playing beside the list.
      // A list the page holds with no session on the server (restored after a reload) given
      // back to the server as it stands, so an add or a play goes by the rows the reader sees
      // and not by the source the list first came from. True when the server took it.
      relist: async () => {
        const held = localOut.state
        if (held.session || !Array.isArray(held.queue) || !held.queue.length) return false
        const zone = held.fromZone || listBody.current?.from_zone || ''
        const answer = await api.streamRebuild({ rows: held.queue.map((r) => ({
          uri: r.uri || '', sid: Number(r.sid) || 0, title: r.title || '', artist: r.artist || '', album: r.album || '',
          art: r.art || '', duration: r.duration || '' })), zone, source: listBody.current?.uri || '',
          index: held.queueIndex ?? -1 }).catch(() => null)
        if (!answer || answer.reason || !answer.session || localOut.state.session) return false
        const session = answer.session
        const asked = { uri: listBody.current?.uri || '', from_zone: zone }
        localOut.adopt({ session, queue: answer.queue, queueIndex: held.queueIndex ?? -1, playing: false,
                         service: answer.service || '',
                         next: async () => { const more = await api.streamNext(session).catch(() => null); return more && more.url ? fromAnswer(more, asked) : null },
                         jump: async (index) => { const more = await jumped(session, index); return more && more.url ? fromAnswer(more, asked) : null } })
        return true
      },
      enqueueTrack: async (body) => {
        if (await local.relist()) return local.enqueueTrack(body)
        const held = localOut.state
        // A list the page holds with no session on the server that the server would not take
        // back: the track joins the page's own copy of it, where it stands, rather than
        // starting a new list. A whole album or playlist cannot be one row, so it is refused.
        if (!held.session && Array.isArray(held.queue) && held.queue.length) {
          if (/^object\.container/.test(classFrom(body.metadata)) || /^x-rincon-cpcontainer:|savedqueues\.rsq#/i.test(body.uri || '')) {
            return local.refuseSource({ reason: 'needs-queue' })
          }
          // The ampersand is unescaped last, so a title that spells out an entity ("&amp;lt;") keeps it.
          const field = (tag) => {
            const found = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`).exec(body.metadata || '')
            return found ? found[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&') : ''
          }
          const row = { id: `local:${body.uri}`, title: body.title || field('dc:title'), artist: field('dc:creator'), album: field('upnp:album'),
                        art: field('upnp:albumArtURI'), kind: 'track', is_container: false, uri: body.uri }
          const added = localOut.addRow(row, Boolean(body.next))
          return { queue: added.queue, index: added.index, playing: added.index >= 0 }
        }
        const zone = body.from_zone || held.fromZone || ''
        const listed = Boolean(held.session && Array.isArray(held.queue))
        const track = held.url && !held.queue && !held.station ? held.mediaUri : ''
        const answer = await run(() => (listed
          ? api.streamQueueEdit(held.session, { action: 'add', uri: body.uri, zone, next: Boolean(body.next) })
          : api.streamQueueStart({ uri: body.uri, zone, now_uri: track, now_zone: held.fromZone || '' })),
          { describe: 'notice.conflict.title' })
        if (!answer) return null
        if (answer.reason) return local.refuseSource(answer)
        const asked = { uri: body.uri, from_zone: zone }
        const session = answer.session || held.session
        const follow = answer.session ? {
          next: async () => { const more = await api.streamNext(session).catch(() => null); return more && more.url ? fromAnswer(more, asked) : null },
          jump: async (index) => { const more = await jumped(session, index); return more && more.url ? fromAnswer(more, asked) : null },
        } : {}
        // The server's place is the list's last track played. That is the
        // one playing unless a station is on beside the list.
        const marked = Boolean(answer.playing) && (!listed || held.inList)
        if (answer.session) listBody.current = null
        localOut.adopt({ session, queue: answer.queue, queueIndex: marked ? answer.index : -1,
                         playing: marked, service: answer.service || '', ...follow })
        return answer
      },
      // Play Now on a single track while the room holds a list: the track
      // goes into the list after the one last played there and plays from
      // it, which is what a speaker's Play Now does with its queue. With
      // `at_end` it goes to the end of the list instead and plays from
      // there. Null where there is no list to take it or the list will not,
      // and the track then plays on its own.
      playInList: async (asked) => {
        const held = localOut.state
        if (!held.session || !Array.isArray(held.queue)) return null
        // A song asked for at the end (a song reserved from the karaoke songbook) is a single
        // track whatever its metadata says; a library's often says nothing.
        if (!asked.at_end && !/object\.item\.audioItem\.musicTrack/.test(classFrom(asked.metadata))) return null
        const zone = asked.from_zone || held.fromZone || ''
        const answer = await api.streamQueueEdit(held.session, { action: 'add', uri: asked.uri, zone, next: !asked.at_end }).catch(() => null)
        if (!answer || answer.reason || !Array.isArray(answer.queue)) return null
        // The first of what was added: an album or a playlist adds all its tracks.
        const at = asked.at_end ? held.queue.length : answer.index + 1
        localOut.adopt({ session: held.session, queue: answer.queue,
                         queueIndex: held.inList && answer.playing ? answer.index : -1 })
        await localOut.jump(at)
        const now = localOut.state
        return now.inList && now.queueIndex === at ? answer : null
      },
      setSource: async (body) => {
        if (body.enqueue && !body.replace) return local.enqueueTrack(body)
        // `start`: a track of the album to begin at (a restored queue).
        const { start = '', ...asked } = body
        if (!start && !body.replace) {
          // A song started from the room's list is what a reload comes back to: the request
          // kept for it is the song's own, not that of a station or album played before it.
          const keep = () => {
            recallBody.current = asked
            saveLast(asked, localOut.state, listBody.current)
          }
          const placed = await local.playInList(asked)
          if (placed) { keep(); return placed }
          // Played from the end with no list on the server to join: the room starts one with it,
          // as a speaker's empty queue takes it, and plays it from there. A list held only on the
          // page (after a reload) is not added to here: a jump into it would replay its saved
          // request, which is no way to play a song just added.
          if (asked.at_end && !(Array.isArray(localOut.state.queue) && localOut.state.queue.length && !localOut.state.session)) {
            const listed = await local.enqueueTrack({ ...asked, enqueue: true })
            if (listed && Array.isArray(listed.queue) && listed.queue.length && localOut.state.session) {
              await localOut.jump(listed.queue.length - 1)
              if (localOut.state.inList) keep()
              return listed
            }
          }
        }
        const answer = await run(() => api.streamUrl(asked.uri, asked.from_zone || '', start), { describe: 'notice.error.title' })
        if (!answer) return null
        if (!answer.url) return local.refuseSource(answer)
        // An album or a playlist brings its list, which becomes the room's.
        // A station, a stream, or a lone track brings none and plays beside
        // the list the room holds, which stays as it was: a speaker's queue
        // is still there after radio, and so is this one.
        const listed = Array.isArray(answer.queue)
        // A list begun with shuffle on opens on any of its tracks, not always
        // its first. The list and its session are the first answer's.
        let first = answer
        if (listed && !start && body.play !== false && answer.session && answer.queue.length > 1
            && String(localOut.state.playMode || '').startsWith('SHUFFLE')) {
          const at = Math.floor(Math.random() * answer.queue.length)
          if (at !== answer.index) {
            const more = await api.streamJump(answer.session, at).catch(() => null)
            if (more && more.url) first = { ...more, queue: answer.queue, session: answer.session }
          }
        }
        const loaded = { ...fromAnswer(first, asked), ...(listed ? {} : { inList: false }) }
        recallBody.current = asked
        if (listed) listBody.current = asked
        await localOut.load(loaded)
        // A queue loaded without being started (Replace Queue with play: false) waits, paused.
        if (body.play === false) localOut.pause()
        if (!localOut.state.queue) listBody.current = null
        // The length may have arrived while it loaded, and was saved then;
        // this save comes after and must not take it away.
        saveLast(asked, localOut.state, listBody.current)
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
    const shown = saved.shown || {}
    // Where the list came from: its own request where one was kept, and what
    // was playing otherwise (a save from before the two were told apart).
    const list = shown.queue ? (saved.listBody === undefined ? saved.body : saved.listBody) : null
    listBody.current = list
    const inList = shown.inList === undefined ? shown.queueIndex >= 0 : shown.inList
    // Play resumes the track the album was on, or the station that was on
    // beside it; a double-click in the restored queue names its own track.
    const at = shown.queue?.[shown.queueIndex]?.uri || ''
    localOut.restore(shown,
      async (start, index) => {
        // The list is played from as the page shows it, rows added after its source included,
        // and a list built a song at a time, which has no source of its own, as much as an album's.
        const place = index ?? (inList ? shown.queueIndex : -1)
        if (shown.queue?.length && place >= 0 && await localActions.relist()) {
          await localOut.jump(place)
          return Boolean(localOut.state.url)
        }
        return (list && (start || inList)
          ? localActions.setSource({ ...list, start: start || at })
          : localActions.setSource(saved.body))
      },
      list ? (start) => localActions.setSource({ ...list, start }) : null)
  }, [localActions])

  // Kept as it moves on, not only when it starts: a new track, a jump, or an
  // edit of the album's list is saved, so a reload comes back to the track
  // and the list as they were.
  useEffect(() => {
    let seen = null
    // The list of a room playing nothing, as it was last seen: `undefined` until the first look.
    let idle
    return localOut.subscribe((now) => {
      if (!now.url) {
        // A list that came back with the page plays nothing until Play is pressed. A song taken
        // out of it, moved, or added is kept all the same, or a reload would undo the edit.
        const edited = idle !== undefined && idle !== now.queue && Array.isArray(now.queue)
        idle = now.queue
        if (edited && recallBody.current) saveLast(recallBody.current, now, listBody.current)
        return
      }
      idle = now.queue
      if (!recallBody.current) return
      const key = `${now.url}|${now.queueIndex}`
      const timed = now.duration > 0
      const same = seen && seen.key === key && seen.queue === now.queue
      // Saved once more when the track's length becomes known, which is after
      // it starts; never again when it drops to nothing, as it does while the
      // page unloads and the element is emptied.
      if (same && (seen.timed || !timed)) return
      seen = { key, queue: now.queue, timed: timed || Boolean(same && seen.timed) }
      saveLast(recallBody.current, now, listBody.current)
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

  // Where a play lands depends on which household each room is in.
  useEffect(() => { noteHouseholds(state.households) }, [state.households])
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
