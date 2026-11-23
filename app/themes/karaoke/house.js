// What the machine knows about the house: the data hooks and the rules for
// playing things. A copy of the rules every modern shell follows, kept here so
// this theme stands on its own (an audiobook is handed to the player whole, a
// station cannot be queued, Play Now on something queueable drops it in
// after the current track), so a room behaves the same whichever theme
// drives it.

import { useEffect, useState } from 'react'
import { api } from '../../frontend/src/lib/api.js'
import { streamText, streamFileName } from '../../frontend/src/lib/format.js'
import { isPlayableLeaf } from '../../frontend/src/lib/items.js'
import { isLoaded, nextTransport, togglePlay, isFixedSource, canAct } from '../../frontend/src/lib/transport.js'
import { groupTitle } from '../../frontend/src/lib/groups.js'
import { useQueue } from '../../frontend/src/lib/useQueue.js'
import { tvSignalLine } from '../../frontend/src/lib/tvFormat.js'

export const STATION_URI = /^(x-sonos-htastream|x-rincon-stream|x-sonosapi-radio|x-sonosapi-stream|x-sonosapi-hls|x-rincon-mp3radio):/

export function isQueueable(item) {
  if (!item || item.item_type === 'audiobook') return false
  return Boolean(item.uri) && !STATION_URI.test(item.uri)
}
export function sidOf(transport, item) {
  const uri = (item ? item.uri : transport?.media_uri) || ''
  const found = /[?&]sid=(\d+)/.exec(uri)
  // An item with no URI (an album opened from Album Info) names its service itself.
  return found ? Number(found[1]) : (item?.service_id || transport?.service_id || 0)
}
export function favoriteKey(uri) {
  if (!uri) return ''
  const [path, query = ''] = String(uri).split('?')
  const sid = /(?:^|&)sid=(\d+)/.exec(query)?.[1] || ''
  return `${path.replace(/%[0-9a-f]{2}/gi, (m) => m.toLowerCase())}|${sid}`
}
export function bodyFor(item, service) {
  const body = { uri: item.uri, metadata: item.metadata || '', title: item.title || '', kind: item.item_type || '' }
  return service ? { ...body, service } : body
}
export function hasMusic(tr) {
  return Boolean(tr && (tr.title || tr.stream_content || (tr.queue_length ?? 0) > 0
    || ['tv', 'line_in', 'external_session'].includes(tr.source)))
}

export { isLoaded, nextTransport, togglePlay, isFixedSource, canAct }

/** Whether the machine's Play/Pause key does anything. A stopped room has no song on the
 *  screen, so there the key is the queue's alone: with the queue empty it starts nothing,
 *  whatever the room last held (a station, a line-in). `total` is the queue's length where
 *  the caller has counted it. */
export function canPress(tr, total) {
  if (!tr || !isLoaded(tr) || !canAct(tr)) return false
  if (emptied(tr, total)) return false
  return tr.state !== 'STOPPED' || (total ?? tr.queue_length ?? 0) > 0
}
/** Whether a room at rest is set on a queue with nothing in it. A room paused on a song goes
 *  on naming that song for a moment after its queue is emptied; Play, sent then, is refused. */
export function emptied(tr, total) {
  const playing = tr?.state === 'PLAYING' || tr?.state === 'TRANSITIONING'
  return !playing && tr?.source === 'queue' && (total ?? tr.queue_length ?? 0) === 0
}
/** Whether a room is the browser's own, stopped on the song it last played with no queue round
 *  it (after a reload, or once the song ended): Play starts that song again, as it does in the
 *  other themes, rather than the queue it does not have. */
export function replays(zone) {
  const tr = zone?.transport
  return Boolean(zone?.local) && tr?.state === 'STOPPED' && tr.source !== 'queue' && Boolean(tr.track_uri)
}
/** Whether a stopped room is set on something other than its queue, which Play would start
 *  in the queue's place. */
export function offQueue(tr) {
  return tr?.state === 'STOPPED' && tr.source !== 'queue' && tr.source !== 'external_session'
}
export function canSkip(tr) {
  // A transport that says it cannot skip means it: the browser room plays a
  // single live stream with nothing on either side of it.
  return isLoaded(tr) && tr?.can_skip !== false && !isFixedSource(tr)
    && !tr?.is_external_session && tr?.state !== 'STOPPED'
}
// Next as well: where the position cannot be moved, the speaker's word on Next decides, as in
// Sonos' own apps. A skip it then refuses (UPnP 800, a skip limit) is said in a notice and the
// key stays live.
export function canNext(tr) {
  return canSkip(tr) && (tr?.can_seek !== false || tr?.can_next !== false)
}
// Previous the same way: a Sonos Radio station offers no Previous and answers it with
// UPnP 701 (2026-10-03).
export function canPrevious(tr) {
  return canSkip(tr) && (tr?.can_seek !== false || tr?.can_previous !== false)
}
// Pause every playing group the way the app's Pause All does: Stop for what
// will not pause, and television rooms left alone.
export function pauseEverything(actions, groups, zones) {
  for (const g of groups) {
    const tr = zones[g.coordinator]?.transport
    if (tr?.state !== 'PLAYING' || tr.source === 'tv') continue
    if (nextTransport(tr) === 'stop') actions.stop(g.coordinator)
    else actions.pause(g.coordinator)
  }
}

// The song a station names, where it names one: a title of its own beside an
// artist, rather than the station's name standing in for a title.
function stationSong(tr) {
  return tr.artist && tr.title && tr.title !== tr.container_title ? tr.title : ''
}

const HELD_STATION_SOURCES = ['radio', 'service_radio', 'service_stream', 'service_hls']
// One line naming what plays and one naming who, for cards and the bar. A song's second line
// is its artist and album; `album: false` leaves the artist alone.
export function nowSummary(transport, t, { album = true } = {}) {
  const tr = transport || {}
  if (tr.source === 'tv') return { title: t('source.tv'), sub: [tr.tv_input, tvSignalLine(tr, t)].filter(Boolean).join(' · ') }
  if (tr.source === 'line_in') return { title: t('source.line_in'), sub: tr.container_title || '' }
  // A stopped station has no track, only the station it will play: it reads
  // as the station over its service, as on play.sonos.com. It used to read
  // "No Music Selected" here.
  if (!tr.track_uri && tr.media_uri && HELD_STATION_SOURCES.includes(tr.source) && tr.container_title) {
    return { title: tr.container_title, sub: tr.service_name || '' }
  }
  const broadcast = /^x-sonosapi-stream:/.test(tr.media_uri || '')
  if (broadcast) {
    const raw = tr.stream_content || ''
    // The speaker's "Connecting..." is not on air: the official apps never
    // print it on a card or in the bar, and an S2 speaker can go on
    // reporting it long after the station plays (2026-09-28).
    const info = /^ZPSTR_/.test(raw.trim()) ? '' : streamText(raw, t)
    const song = stationSong(tr)
    return { title: tr.container_title || tr.title || '', sub: tr.stream_show || (song ? [song, tr.artist].join(' · ') : '') || info || '' }
  }
  const title = tr.title || streamFileName(tr.track_uri) || (tr.stream_content ? streamText(tr.stream_content, t) : '')
  const sub = [tr.artist, album && tr.album].filter(Boolean).join(' · ')
  return { title, sub }
}

// --- households ------------------------------------------------------------

export function householdOf(households, uuid) {
  return households.find((h) => h.zone_uuids.includes(uuid)) || null
}
// The room a household's sources browse and play through: the room in view
// when it belongs to that household, otherwise the household's first room.
export function zoneForHousehold(households, zones, activeZone, hid) {
  const household = households.find((h) => h.id === hid)
  if (!household) return null
  if (activeZone && household.zone_uuids.includes(activeZone.uuid)) return activeZone
  for (const uuid of household.zone_uuids) if (zones[uuid]) return zones[uuid]
  return null
}
// Moved to lib/groups.js, where the web themes' copy of it lives too. The
// version here built "<room> + 2" by hand and so could not be translated.
export { groupTitle }

// --- services ---------------------------------------------------------------

// Every household's services, keyed by household id. TuneIn is built into
// every household and needs no account, so it is listed whether or not the
// household saved anything from it.
export function useServices(version = 0) {
  const [byHousehold, setByHousehold] = useState({})
  const [raw, setRaw] = useState(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let canceled = false
    api.services().then((result) => {
      if (canceled) return
      const map = {}
      for (const hh of result.households || []) {
        const list = [...(hh.in_use || [])]
        // Built into an S1 household and needing no account, so it is listed
        // whether or not anything from it has been saved. Not on S2, where
        // Sonos Radio and "TuneIn (New)" replaced it and the app's own source
        // list has no TuneIn row (2026-09-11).
        const tunein = hh.generation === 'S1' ? (hh.available || []).find((svc) => svc.id === 254) : null
        if (tunein && !list.some((svc) => svc.id === 254)) list.push({ ...tunein, in_use: true })
        map[hh.household] = list
      }
      setByHousehold(map); setRaw(result.households || [])
    }).catch(() => { if (!canceled) { setByHousehold({}); setRaw([]) } })
    return () => { canceled = true }
  }, [version, tick])
  return { byHousehold, raw, loaded: raw !== null, reload: () => setTick((v) => v + 1) }
}

export function useFavorites(zoneUuid, epoch = 0) {
  const [items, setItems] = useState(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!zoneUuid) { setItems([]); return undefined }
    let canceled = false
    api.favorites(zoneUuid).then((r) => { if (!canceled) setItems(r?.items || []) }).catch(() => { if (!canceled) setItems([]) })
    return () => { canceled = true }
  }, [zoneUuid, epoch, tick])
  return { items: items || [], loaded: items !== null, reload: () => setTick((v) => v + 1) }
}
export { useQueue }

// Play, queue or replace with one or more items, the way the app does it:
// Play Now on something queueable drops it after the current track and jumps
// to it; a station or an audiobook takes over the transport; Play Next and
// Add to End queue in order.
export async function playItems(actions, items, how, { hzone, service = null, from = '', play = true, room = null } = {}) {
  const group = items.filter((i) => i && i.uri)
  if (!group.length || !hzone) return false
  // `from` is the room the listing was browsed through, which only the
  // browser room needs: it is how the backend knows whose service login
  // resolves the URI.
  const body = (i) => (from ? { ...bodyFor(i, service), from_zone: from } : bodyFor(i, service))
  // The first call is the one that says whether this worked: a refusal there
  // -- a speaker's, or the browser room's for a source it cannot fetch --
  // means nothing started, so the caller must not report that it did.
  if (how === 'now' && group.every(isQueueable)) {
    if (!await actions.setSource(hzone, body(group[0]))) return false
    for (const i of group.slice(1).reverse()) await actions.setSource(hzone, { ...body(i), enqueue: true, next: true })
  } else if (how === 'now' || how === 'replace') {
    if (!await actions.setSource(hzone, { ...body(group[0]), ...(how === 'replace' ? { replace: true, ...(play ? {} : { play: false }) } : {}) })) return false
    for (const i of group.slice(1)) await actions.setSource(hzone, { ...body(i), enqueue: true })
  } else if (how === 'end') {
    // Play Now from the end of the queue: each item joins the end, and the queue plays from the first.
    if (!await actions.setSource(hzone, { ...body(group[0]), at_end: true })) return false
    for (const i of group.slice(1)) await actions.setSource(hzone, { ...body(i), enqueue: true })
  } else if (how === 'next') {
    for (const i of [...group].reverse()) if (!await actions.setSource(hzone, { ...body(i), enqueue: true, next: true })) return false
  } else {
    // "The end" (place 0) of a queue on shuffle is wherever the speaker likes while it plays, as
    // often as not straight after the song playing; the place after its last song is the end.
    const shuffled = !room?.local && String(room?.transport?.play_mode || '').startsWith('SHUFFLE')
    let place = shuffled ? (Number(room.transport.queue_length) || 0) + 1 : 0
    for (const i of group) {
      const done = await actions.setSource(hzone, { ...body(i), enqueue: true, ...(place > 1 ? { position: place } : {}) })
      if (!done) return false
      if (place) place = (Number(done.NewQueueLength) || 0) + 1
    }
  }
  return true
}

export { isPlayableLeaf }
