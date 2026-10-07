// Thin wrapper over the backend's HTTP API.
//
// The backend distinguishes two kinds of failure and the interface needs to
// tell them apart: a refusal because the speaker's current state does not
// allow the request (409 conflict, carrying the UPnP code), and an actual
// fault. Callers get a typed
// error rather than having to re-parse the response.

import { browserSleep } from './browserSleep.js'
import { browserQueue } from './browserQueue.js'

export class ApiError extends Error {
  constructor(status, payload) {
    super(payload?.message || payload?.detail || `Request failed with ${status}`)
    this.status = status
    this.kind = payload?.error || 'error'
    this.code = payload?.code
    this.service = payload?.service
    this.action = payload?.action
    this.hint = payload?.hint
  }

  get isConflict() {
    return this.kind === 'conflict'
  }

  /** The speaker stopped answering: its fault, and usually its own to fix. */
  get isSilent() {
    return this.kind === 'speaker_silent'
  }
}

//: The reader's locale, as a BCP 47 tag, sent with every request.
//
// A music service answers in whatever language it is asked for -- its
// presentation map's labels, its strings table, the message after a rating --
// so the backend has to know which one the reader is in, and `Accept-Language`
// is the header that already means exactly this. The i18n layer sets it when
// the locale is chosen or changed; until then the backend's own default
// answers.
let locale = ''

export function setRequestLocale(tag) {
  locale = tag || ''
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'
  if (locale) headers['Accept-Language'] = locale
  // The reader's default account per service (a service row's account
  // caret), which the backend needs where an item names an account the
  // household does not have: a Spotify Connect session's track.
  try {
    const accounts = localStorage.getItem('sonora.serviceAccounts')
    if (accounts && accounts !== '{}') headers['X-Sonora-Accounts'] = accounts
  } catch { /* no storage: the backend's own default answers */ }
  const response = await fetch(path, {
    method,
    headers: Object.keys(headers).length ? headers : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) {
    let payload = null
    try {
      payload = await response.json()
    } catch {
      // A non-JSON error body still needs to surface as an ApiError.
    }
    throw new ApiError(response.status, payload)
  }
  if (response.status === 204) return null
  return response.json()
}

export const api = {
  state: () => request('/api/state'),
  health: () => request('/api/health'),
  refresh: () => request('/api/refresh', { method: 'POST' }),
  // A URL the page itself can play, for the "This browser" room.
  // `zone` is the room the listing was browsed through: which household,
  // and so which service login, resolves the URI.
  streamUrl: (uri, zone = '', start = '') => request(
    `/api/stream?uri=${encodeURIComponent(uri)}${zone ? `&zone=${encodeURIComponent(zone)}` : ''}${start ? `&start=${encodeURIComponent(start)}` : ''}`),
  // The next track of a station the browser room is listening to.
  streamNext: (session) => request(`/api/stream/next?session=${encodeURIComponent(session)}`),
  // One track of the album or playlist the browser room is playing, by its
  // place (from 0) in the list the session answered with.
  streamJump: (session, index) => request(`/api/stream/jump?session=${encodeURIComponent(session)}&index=${index}`),
  // Its list edited (remove / move / clear, places from 0), or saved as a
  // Sonos playlist through a speaker of its household.
  streamQueueEdit: (session, body) => request(`/api/stream/${encodeURIComponent(session)}/queue`, { method: 'POST', body }),
  streamSave: (session, body) => request(`/api/stream/${encodeURIComponent(session)}/save`, { method: 'POST', body }),
  // What a radio stream says is on now (its ICY StreamTitle), read by Sonora.
  streamTitle: (url, station = '') => request(`/api/stream/title?url=${encodeURIComponent(url)}&station=${encodeURIComponent(station)}`),

  volume: (uuid, level, group = false) =>
    request(`/api/zones/${uuid}/volume`, {
      method: 'POST',
      body: { level, group },
    }),
  nudgeVolume: (uuid, delta) =>
    request(`/api/zones/${uuid}/volume`, { method: 'POST', body: { delta } }),
  mute: (uuid, muted, group = false) =>
    request(`/api/zones/${uuid}/mute`, {
      method: 'POST',
      body: { muted, group },
    }),
  transport: (uuid, action) =>
    request(`/api/zones/${uuid}/transport/${action}`, { method: 'POST' }),
  seek: (uuid, body) =>
    request(`/api/zones/${uuid}/seek`, { method: 'POST', body }),
  playMode: (uuid, mode) =>
    request(`/api/zones/${uuid}/playmode`, { method: 'POST', body: { mode } }),
  createStereoPair: (uuid, rightUuid) => request(`/api/zones/${uuid}/stereo-pair`, { method: 'POST', body: { right_uuid: rightUuid } }),
  separateStereoPair: (uuid) => request(`/api/zones/${uuid}/separate`, { method: 'POST' }),
  // A room's settings need a room: an empty id (a pane open before any room
  // is chosen) is answered here instead of as GET /api/zones//settings.
  roomSettings: (uuid) => (!uuid || uuid === 'SONORA_BROWSER' ? Promise.resolve({ eq: {} }) : request(`/api/zones/${uuid}/settings`)),
  setRoomSettings: (uuid, body) => request(`/api/zones/${uuid}/settings`, { method: 'POST', body }),
  tone: (uuid, patch) =>
    request(`/api/zones/${uuid}/tone`, { method: 'POST', body: patch }),
  settings: (uuid, patch) =>
    request(`/api/zones/${uuid}/settings`, { method: 'POST', body: patch }),

  join: (uuid, coordinator) =>
    request(`/api/zones/${uuid}/group`, {
      method: 'POST',
      body: { coordinator },
    }),
  leave: (uuid) => request(`/api/zones/${uuid}/group`, { method: 'DELETE' }),
  delegate: (uuid, heir) =>
    request(`/api/zones/${uuid}/delegate`, { method: 'POST', body: { heir } }),

  browse: (objectId, { zone, start = 0, count = 100, sort = '' } = {}) => {
    const params = new URLSearchParams({
      object_id: objectId,
      start: String(start),
      count: String(count),
    })
    if (zone) params.set('zone', zone)
    if (sort) params.set('sort', sort)
    return request(`/api/browse?${params}`)
  },
  queue: (uuid, { start = 0, count = 200 } = {}) =>
    // The browser room has no speaker to ask: its queue is the album or
    // playlist the page is playing, which localOut hands over (see
    // browserQueue.js), and empty for a station.
    uuid === 'SONORA_BROWSER'
      ? Promise.resolve(browserQueue(start, count))
      : request(`/api/queue/${uuid}?start=${start}&count=${count}`),
  clearQueue: (uuid) => request(`/api/queue/${uuid}`, { method: 'DELETE' }),
  reorderQueue: (uuid, body) => request(`/api/queue/${uuid}/reorder`, { method: 'POST', body }),
  removeFromQueue: (uuid, index) => request(`/api/queue/${uuid}/${index}`, { method: 'DELETE' }),
  saveQueue: (uuid, title, objectId = '') =>
    request(`/api/queue/${uuid}/save`, { method: 'POST', body: { title, object_id: objectId } }),
  crossfade: (uuid, enabled) => request(`/api/zones/${uuid}/crossfade`, { method: 'POST', body: { enabled } }),
  // The browser room's timer is the page's own (browserSleep.js); it is
  // answered here in the speakers' shape so every sleep pane reads it the
  // same way, and the all-timers list carries it beside theirs.
  sleepTimer: (uuid) => (uuid === 'SONORA_BROWSER'
    ? Promise.resolve({ remaining: browserSleep.remaining() })
    : request(`/api/zones/${uuid}/sleep`)),
  sleepTimers: () => request('/api/sleep').then((r) => {
    const left = browserSleep.remaining()
    return left ? { ...r, items: [...(r?.items ?? []), { zone: 'SONORA_BROWSER', remaining: left }] } : r
  }),
  setSleepTimer: (uuid, duration) => (uuid === 'SONORA_BROWSER'
    ? Promise.resolve({ remaining: browserSleep.set(duration) })
    : request(`/api/zones/${uuid}/sleep`, { method: 'POST', body: { duration } })),
  errorLog: () => request('/api/log'),
  dropouts: () => request('/api/dropouts'),
  alarms: (zone) => request(`/api/alarms?zone=${encodeURIComponent(zone)}`),
  createAlarm: (body) => request('/api/alarms', { method: 'POST', body }),
  updateAlarm: (id, body) => request(`/api/alarms/${encodeURIComponent(id)}`, { method: 'PUT', body }),
  setAlarm: (id, body) => request(`/api/alarms/${encodeURIComponent(id)}`, { method: 'POST', body }),
  deleteAlarm: (id, zone) => request(`/api/alarms/${encodeURIComponent(id)}?zone=${encodeURIComponent(zone)}`, { method: 'DELETE' }),
  addRadioStation: (body) => request('/api/radio', { method: 'POST', body }),
  removeRadioStation: (body) => request('/api/radio/remove', { method: 'POST', body }),
  addFavoriteItem: (body) => request('/api/favorites/add', { method: 'POST', body }),
  renameFavorite: (body) => request('/api/favorites/rename', { method: 'POST', body }),
  removeFavorite: (body) => request('/api/favorites/remove', { method: 'POST', body }),
  addFavorite: (uuid) => request(`/api/zones/${uuid}/favorite`, { method: 'POST' }),
  serviceFavorite: (sid, body) =>
    request(`/api/services/${sid}/favorite`, { method: 'POST', body }),
  serviceText: (sid, item, type, zone) =>
    request(`/api/services/${sid}/text?item=${encodeURIComponent(item)}&type=${encodeURIComponent(type)}${zone ? `&zone=${zone}` : ''}`),
  serviceExtended: (sid, item, zone, account = '') =>
    request(`/api/services/${sid}/extended?item=${encodeURIComponent(item)}${zone ? `&zone=${zone}` : ''}${account ? `&account=${encodeURIComponent(account)}` : ''}`),
  serviceAction: (sid, body) => request(`/api/services/${sid}/action`, { method: 'POST', body }),
  // The account's own playlists on the service ("Add Song to <service>
  // Playlist"); `probe` only asks whether there are any.
  userPlaylists: (sid, { zone, account = '', probe = false } = {}) => {
    const params = new URLSearchParams()
    if (zone) params.set('zone', zone)
    if (account) params.set('account', account)
    if (probe) params.set('probe', '1')
    return request(`/api/services/${sid}/user-playlists?${params}`)
  },
  addToUserPlaylist: (sid, body) => request(`/api/services/${sid}/user-playlists/add`, { method: 'POST', body }),
  serviceItem: (sid, item, zone, account = '') =>
    request(`/api/services/${sid}/item?item=${encodeURIComponent(item)}${zone ? `&zone=${zone}` : ''}${account ? `&account=${encodeURIComponent(account)}` : ''}`),
  // The browser room belongs to no household and has no speaker behind it,
  // so the household's lists and a player's own metadata have no answer
  // there; it gets the empty one here, as its queue does above, rather than
  // a 404 from the backend for every pane that asks (99 an hour).
  itemMetadata: (uuid) => (uuid === 'SONORA_BROWSER' ? Promise.resolve(null) : request(`/api/zones/${uuid}/item-metadata`)),
  radioLocation: (zone) => request(`/api/radio-location${zone ? `?zone=${zone}` : ''}`),
  setRadioLocation: (body) => request('/api/radio-location', { method: 'POST', body }),
  favorites: (zone) => (zone === 'SONORA_BROWSER' ? Promise.resolve({ items: [] })
    : request(`/api/favorites${zone ? `?zone=${zone}` : ''}`)),
  createPlaylist: (body) => request('/api/playlists', { method: 'POST', body }),
  addToPlaylist: (body) => request('/api/playlists/add', { method: 'POST', body }),
  removePlaylistTrack: (body) => request('/api/playlists/remove-track', { method: 'POST', body }),
  movePlaylistTrack: (body) => request('/api/playlists/move-track', { method: 'POST', body }),
  renamePlaylist: (body) => request('/api/playlists/rename', { method: 'POST', body }),
  removePlaylist: (body) => request('/api/playlists/remove', { method: 'POST', body }),
  playlists: (zone) => (zone === 'SONORA_BROWSER' ? Promise.resolve({ items: [] })
    : request(`/api/playlists${zone ? `?zone=${zone}` : ''}`)),
  radio: (zone) => (zone === 'SONORA_BROWSER' ? Promise.resolve({ items: [] }) : request(`/api/radio${zone ? `?zone=${zone}` : ''}`)),
  // A product's own facts for View System Details (model, color, Max
  // Volume, version), read from the player; its picture at playerIcon.
  playerDetails: (uuid) => request(`/api/players/${encodeURIComponent(uuid)}/details`),
  playerIcon: (uuid) => `/api/players/${encodeURIComponent(uuid)}/icon`,
  // For a player that names no color of its own; '' is Unknown. Answers
  // with the player's details as they now read.
  setPlayerColor: (uuid, color) =>
    request(`/api/players/${encodeURIComponent(uuid)}/color`, { method: 'POST', body: { color } }),
  softwareUpdate: (household) => request(`/api/households/${encodeURIComponent(household)}/software-update`),
  startSoftwareUpdate: (household) =>
    request(`/api/households/${encodeURIComponent(household)}/software-update`, { method: 'POST' }),
  recent: (zone) => (zone === 'SONORA_BROWSER' ? Promise.resolve({ items: [] }) : request(`/api/recent?zone=${encodeURIComponent(zone)}`)),
  cloudStatus: () => request('/api/cloud/status'),
  cloudLogin: (email, password) =>
    request('/api/cloud/login', { method: 'POST', body: { email, password } }),
  cloudLogout: () => request('/api/cloud/logout', { method: 'POST' }),

  services: (zone) => request(`/api/services${zone ? `?zone=${zone}` : ''}`),
  labsServices: (zone) => request(`/api/services/labs${zone ? `?zone=${zone}` : ''}`),
  themes: () => request('/api/themes'),
  // The body is the theme archive itself, posted byte for byte: the server
  // opens the zip, so nothing here reads or repacks it.
  installTheme: (file) => fetch('/api/themes', {
    method: 'POST', headers: { 'Content-Type': 'application/zip' }, body: file,
  }).then(async (response) => {
    const payload = await response.json().catch(() => null)
    if (!response.ok) throw new ApiError(response.status, payload)
    return payload
  }),
  deleteTheme: (id) => request(`/api/themes/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  contentFiltering: (zone) => request(`/api/content-filtering?zone=${encodeURIComponent(zone)}`),
  setContentFiltering: (body) => request('/api/content-filtering', { method: 'POST', body }),
  timeSettings: (zone) => request(`/api/time?zone=${encodeURIComponent(zone)}`),
  setTime: (body) => request('/api/time', { method: 'POST', body }),
  librarySettings: (zone) => request(`/api/library?zone=${encodeURIComponent(zone)}`),
  setLibrary: (body) => request('/api/library', { method: 'POST', body }),
  browseService: (sid, { zone, item = 'root', count = 100, index = 0, account = '', art = 0 } = {}) => {
    const params = new URLSearchParams({ item, count: String(count), index: String(index) })
    if (zone) params.set('zone', zone)
    if (account) params.set('account', account)
    // The size the caller draws art at, where the service publishes sizes;
    // omitted, the provider's own default comes back, as the apps get it.
    if (art) params.set('art', String(art))
    return request(`/api/services/${sid}/browse?${params}`)
  },
  searchService: (sid, { zone, term, account = '', category = '', count = 10, index = 0 } = {}) => {
    const params = new URLSearchParams({ term, count: String(count) })
    if (index) params.set('index', String(index))
    if (zone) params.set('zone', zone)
    if (account) params.set('account', account)
    // Named, only that category is searched, as the apps' scope bar does.
    if (category) params.set('category', category)
    return request(`/api/services/${sid}/search?${params}`)
  },
  rateItem: (sid, body) => request(`/api/services/${sid}/rate`, { method: 'POST', body }),
  linkService: (sid, body) =>
    request(`/api/services/${sid}/link`, { method: 'POST', body }),
  completeLink: (sid, body) =>
    request(`/api/services/${sid}/link/complete`, { method: 'POST', body }),
  removeService: (sid, body) =>
    request(`/api/services/${sid}`, { method: 'DELETE', body }),
  pins: (zone) => request(`/api/pins?zone=${encodeURIComponent(zone)}`),
  addPin: (body) => request('/api/pins', { method: 'POST', body }),
  removePin: (zone, sid, item) => request(`/api/pins?zone=${encodeURIComponent(zone)}&sid=${sid}&item=${encodeURIComponent(item)}`, { method: 'DELETE' }),
  systemNames: () => request('/api/system-names'),
  setSystemName: (body) => request('/api/system-names', { method: 'POST', body }),
  renameServiceAccount: (sid, body) =>
    request(`/api/services/${sid}/nickname`, { method: 'POST', body }),
  setSource: (uuid, body) =>
    request(`/api/zones/${uuid}/source`, { method: 'POST', body }),

  diagnostics: ({ household, probe = true, samples = 15 } = {}) => {
    const params = new URLSearchParams({
      probe: String(probe),
      samples: String(samples),
    })
    if (household) params.set('household', household)
    return request(`/api/diagnostics?${params}`)
  },
}
