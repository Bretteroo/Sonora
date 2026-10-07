import { useSystem } from '../../frontend/src/lib/store.jsx'
import { nextTransport, isConnectSession } from '../../frontend/src/lib/transport.js'
import { useElapsed } from '../../frontend/src/lib/useElapsed.js'
import { streamText } from '../../frontend/src/lib/format.js'

// What the transport controls need to know about a room, and the handlers
// that drive it. Shared by the bar along the bottom and the Now Playing view,
// which show the same controls at different sizes.
//
// Elapsed position needs a local clock. Speakers report position only when
// something changes, so a progress bar fed purely by events sits still while
// a track plays. The reported position is taken as the anchor and advanced
// locally once a second, and reset whenever the speaker reports again.

// A station a stopped room still holds. The speaker keeps the station loaded,
// with its name in the source's own DIDL and no track at all, and the product
// goes on naming it with its play button live: a stopped room reads
// "Chill" over "AccuRadio" there, where Sonora said No Music Selected and
// Queue is empty (play.sonos.com, 2026-09-24). Returns the station's name, or
// '' when the room holds no station or the speaker never named it.
const STATION_SOURCES = ['radio', 'service_radio', 'service_stream', 'service_hls']

// A live broadcast: the speaker was given an x-sonosapi-stream: URI (a TuneIn
// or Audacy station, 80s80s' channels) rather than a service radio built from
// tracks (x-sonosapi-radio:) or a queue. The product treats the two
// differently: a broadcast's "..." holds Sleep Timer alone, and while it
// plays its on-air text heads the player (1010 WINS stopped and 80s80s
// Reggae playing, against AccuRadio's Chill, play.sonos.com 2026-09-24).
export function isBroadcast(transport) {
  return /^x-sonosapi-stream:/i.test(transport?.media_uri || '')
}

// What a playing broadcast prints: whatever is on air, over the station's
// name -- "Dennis Brown - Sitting and Watching" over "80s80s Reggae" in the
// big player, on the room's card and in the bar alike. Stopped, the same room
// goes back to the station over the service's name, which is what the rest of
// the theme draws, so this answers null then (2026-09-24).
export function broadcastLines(transport, t) {
  if (!isBroadcast(transport)) return null
  if (transport.state !== 'PLAYING' && transport.state !== 'TRANSITIONING') return null
  // The speaker's own placeholders ("Connecting...") are not on air; the
  // product never prints them, and an S2 speaker can report one for the
  // whole time a station plays (2026-09-28).
  const onAir = /^ZPSTR_/.test((transport.stream_content || '').trim()) ? '' : streamText(transport.stream_content, t)
  const station = transport.title || transport.container_title || ''
  if (!onAir || onAir === station) return null
  return { title: onAir, sub: station }
}

// The second line a room's description offers, less what a broadcast left
// behind. A speaker keeps the last on-air text after the stream stops, and the
// product stops printing it then: a stopped 80s80s Reggae reads the station
// alone in the big player and the station over the service in the bar, where
// Sonora went on naming the last song (2026-09-24).
export function restingSecondary(transport, now) {
  // A soundbar on TV: the input, when the cloud names it, and the format the
  // speaker reports receiving, on one line.
  if (transport?.source === 'tv') return [now?.secondary, now?.detail].filter(Boolean).join(' · ')
  const playing = transport?.state === 'PLAYING' || transport?.state === 'TRANSITIONING'
  if (isBroadcast(transport) && !playing) return ''
  return now?.secondary || ''
}

export function isStation(transport) {
  return STATION_SOURCES.includes(transport?.source)
}

export function holdsStation(transport) {
  return Boolean(transport && !transport.track_uri && transport.media_uri
    && STATION_SOURCES.includes(transport.source))
}

export function heldStation(transport) {
  return holdsStation(transport) ? (transport.container_title || '') : ''
}

// A stopped station reads as the station over its service, whatever song the
// speaker still remembers: a stopped Lovers Rock Reggae is
// "Lovers Rock Reggae" over "AccuRadio" on its card and in the bar, where
// Sonora went on printing "Love Grows" by Fantan Mojah, the last track it
// played (play.sonos.com, 2026-09-28). The speaker drops the track's title
// some time later, which is why another room already read right.
export function heldStationLines(transport) {
  const station = heldStation(transport)
  return station ? { title: station, sub: transport.service_name || '' } : null
}

export function useTransport(zone) {
  const { actions } = useSystem()
  const transport = zone?.transport ?? {}
  // Buffering (TRANSITIONING) keeps the pause glyph up, as the desktop
  // apps do.
  const playing = transport.state === 'PLAYING' || transport.state === 'TRANSITIONING'
  const external = transport.is_external_session

  // With no source loaded there is nothing to transport, and the product
  // grays the whole cluster rather than offering controls that will be
  // refused.
  const loaded = Boolean(transport.track_uri) || (transport.queue_length ?? 0) > 0
    || holdsStation(transport)
  // The position and the length, counted locally between the speaker's
  // reports; a live broadcast has neither (lib/useElapsed.js).
  const { elapsed, duration, live } = useElapsed(transport)

  // Television and line-in have no queue: the product disables the whole
  // cluster at opacity 0.2 and shows Stop in the center instead of Pause. An
  // AirPlay or Connect session keeps play and pause but cannot be skipped.
  // Shuffle and Repeat stay live even with nothing queued; only the three
  // transport controls gray out then.
  const fixedSource = ['tv', 'line_in'].includes(transport.source)
  const skippable = loaded && !fixedSource && !external
  // A room playing its own queue has the queue loaded as its transport URI
  // (source 'queue'); a station does not.
  const queued = transport.source === 'queue'
  // A Spotify Connect session orders itself like a queue: play.sonos.com keeps
  // Shuffle and Repeat live for it, in the bar and the queue panel, and the
  // speaker lists both among its play modes (2026-10-04).
  const connect = isConnectSession(transport)
  // The speaker says which way it can be skipped, and the product follows it
  // one button at a time: on a Pandora station Next is white and Previous is
  // dimmed with it (measured on play.sonos.com 2026-09-21). A queue is the
  // exception for Previous: on its first track the speaker leaves Previous
  // out of its actions, and the product keeps the button white and takes it
  // back to the start of the track (2026-09-24).
  const canNext = skippable && transport.can_next !== false
  const canPrevious = skippable && (queued || transport.can_previous !== false)
  // Shuffle and Repeat belong to a queue, and the product grays both discs on
  // a station. This read the enqueued URI, which names the album or playlist
  // that was queued rather than the queue, and so grayed them on every album
  // another app had started.
  const orderable = loaded && !fixedSource && !external && (queued || connect) && transport.can_shuffle !== false
  // The bar's pair differs only with nothing loaded, where they stay live
  // (the note on fixedSource above); a station grays them there as well --
  // all four bar glyphs read white at a fifth on a stopped 1010 WINS, where
  // Sonora's bar kept every one of them lit (2026-09-24).
  const barOrderable = !fixedSource && !(loaded && !((queued || connect) && !external))
  const mode = transport.play_mode ?? 'NORMAL'
  const shuffled = mode.startsWith('SHUFFLE')
  const repeat = mode.includes('REPEAT_ONE') ? 'one'
    : mode.includes('REPEAT_ALL') || mode === 'SHUFFLE' ? 'all' : 'off'
  const seekable = Boolean(duration) && transport.can_seek !== false

  const uuid = zone?.uuid
  // What a press of the play disc does, which is also what it shows: a
  // stream the speaker cannot pause wears a stop square while it plays, in
  // the product's big player, bar and room cards alike (80s80s Reggae,
  // 2026-09-24). Sonora drew pause bars there and sent Stop.
  const next = nextTransport(transport)
  const cycleRepeat = () => {
    const base = repeat === 'off' ? 'REPEAT_ALL'
      : repeat === 'all' ? 'REPEAT_ONE' : 'NORMAL'
    actions.setPlayMode(uuid, shuffled ? shuffleEquivalent(base) : base)
  }
  const toggleShuffle = () => {
    const next = shuffled ? plainEquivalent(mode) : shuffleEquivalent(mode)
    actions.setPlayMode(uuid, next)
  }
  // Was `fixedSource && playing ? stop : pause`, which ignored the speaker's
  // own can_pause and so drew pause on a station that only stops.
  const togglePlay = () => {
    const what = nextTransport(transport)
    if (what === 'play') actions.play(uuid)
    else if (what === 'stop') actions.stop(uuid)
    else actions.pause(uuid)
  }
  // A click on the rail: the ratio along it becomes a position.
  const seekAt = (event) => {
    if (!seekable) return
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientX - rect.left) / rect.width
    actions.seek(uuid, formatSeek(Math.max(0, Math.min(duration, ratio * duration))))
  }

  return {
    transport, playing, next, external, loaded, live, fixedSource, skippable,
    canNext, canPrevious, orderable, barOrderable, connect,
    shuffled, repeat, elapsed, duration, seekable,
    cycleRepeat, toggleShuffle, togglePlay, seekAt,
  }
}

// Sonos encodes shuffle and repeat in a single play mode string, so toggling
// one has to preserve the other.
export function shuffleEquivalent(mode) {
  if (mode.includes('REPEAT_ONE')) return 'SHUFFLE_REPEAT_ONE'
  if (mode.includes('REPEAT_ALL')) return 'SHUFFLE'
  return 'SHUFFLE_NOREPEAT'
}

export function plainEquivalent(mode) {
  if (mode === 'SHUFFLE_REPEAT_ONE') return 'REPEAT_ONE'
  if (mode === 'SHUFFLE') return 'REPEAT_ALL'
  return 'NORMAL'
}

export function formatSeek(seconds) {
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n) => String(n).padStart(2, '0')
  return `${h}:${pad(m)}:${pad(s)}`
}
