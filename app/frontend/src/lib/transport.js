// What a room's transport can do, and what its play button should therefore be.
//
// Four shells had four answers to this, and they disagreed. The one that is
// right is the one that asks the speaker: a transport carries `can_pause`,
// derived from the actions the player itself advertises -- a TuneIn station
// allows only "Set, Stop, Play" -- and that is what decided a radio room
// showing a stop square in the S1 app where Sonora drew pause bars (fixed
// at first in the desktop parts and nowhere else).
//
// The others layered a list of source names over the top, and the list is
// wrong. Measured on this household 2026-09-18: three rooms playing
// `http_stream` report `can_pause: true`, while Sonofuture's list names
// `http_stream` as unpausable and draws Stop on them. A `service_radio` room
// reports false, so the field is per-source rather than per-state and the
// field and the list agree there. Where they disagree, the field wins --
// which is also the standing rule about capability-driven behavior.
//
// The one hardcoded exception left is the television and line-in inputs.
// Those are not a stream the speaker is fetching and there is nothing to
// resume, so Stop is structurally right whatever the field says.

const FIXED_SOURCES = ['tv', 'line_in']

/** A television or line-in input: never pausable, whatever else is true. */
/**
 * A Spotify Connect session: someone's Spotify app is driving the room.
 * On S1 the speaker plays it from a queue of its own, x-rincon-queue:<uuid>#vli
 * (the room's queue is #0); on S2 from an x-sonos-vli: source. Either way the
 * session's queue lives in Spotify's cloud, where no controller can list it,
 * and the speaker reports the track that comes next (next_title). Every theme
 * asks this one question so they treat the session alike.
 */
export function isConnectSession(transport) {
  const uri = transport?.media_uri || ''
  return /^x-sonos-vli:/.test(uri) || /^x-rincon-queue:.*#vli$/.test(uri)
}

export function isFixedSource(transport) {
  return FIXED_SOURCES.includes(transport?.source)
}

/** Whether there is anything on the deck to act on at all. */
export function isLoaded(transport) {
  return Boolean(transport?.track_uri) || (transport?.queue_length ?? 0) > 0 || holdsStation(transport)
}

// A stopped station keeps its URI but drops its track: Play starts it again,
// so it counts as loaded, as the web theme already counted it.
const STATION_SOURCES = ['radio', 'service_radio', 'service_stream', 'service_hls']
function holdsStation(transport) {
  return Boolean(transport && !transport.track_uri && transport.media_uri && STATION_SOURCES.includes(transport.source))
}

/** Whether pausing is meaningful here, as the speaker reports it. */
export function canPause(transport) {
  return !isFixedSource(transport) && transport?.can_pause !== false
}

/** 'play', 'pause' or 'stop': what the next press of the button does. */
export function nextTransport(transport) {
  const playing = transport?.state === 'PLAYING' || transport?.state === 'TRANSITIONING'
  if (!playing) return 'play'
  return canPause(transport) ? 'pause' : 'stop'
}

/** Perform it, on the zone's own coordinator. */
export function togglePlay(actions, zone) {
  if (!zone) return
  const what = nextTransport(zone.transport)
  if (what === 'play') actions.play(zone.uuid)
  else if (what === 'stop') actions.stop(zone.uuid)
  else actions.pause(zone.uuid)
}
