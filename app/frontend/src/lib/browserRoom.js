// "This browser": a room that is not a speaker.
//
// It looks like a room everywhere a room is drawn -- a tile in the room list,
// a transport, a volume -- but nothing about it reaches Sonos. It is built
// here in the shape the panes already read, so no pane needs to know it is
// different, with two exceptions it must know about:
//
//   * `local: true` marks it, so the household filters can let it through
//     whichever system is being shown. It belongs to no household: a browser
//     cannot join one.
//   * it can never be grouped. Sonos grouping is speakers keeping a shared
//     clock over their own network; a page has neither the clock nor a way to
//     be told about one, so a group containing it would drift immediately and
//     mean nothing. The store refuses join and leave for it, and the grouping
//     pickers leave it out.

export const BROWSER_UUID = 'SONORA_BROWSER'
export const BROWSER_GROUP_ID = 'SONORA_BROWSER:0'

export function isBrowserRoom(uuid) {
  return uuid === BROWSER_UUID
}

/** Drop the browser room from a list of rooms or uuids meant for grouping. */
export function withoutBrowserRoom(list) {
  return (list || []).filter((entry) => {
    const uuid = typeof entry === 'string' ? entry : entry?.uuid
    return uuid !== BROWSER_UUID
  })
}

/**
 * Where a play should land.
 *
 * Browsing and playing are not the same room. A service listing is fetched
 * through a speaker, with the household's own token, so browse requests keep
 * naming a real player; but what the reader presses Play on belongs to the
 * room they have selected, and that can be this browser.
 */
export function playTarget(activeZone, hzone) {
  return activeZone?.local ? BROWSER_UUID : hzone
}

/**
 * The virtual zone, filled in from the page's own output.
 *
 * `out` is localOut's state. `name` comes from the interface so the room is
 * named in the reader's language.
 */
export function browserZone(out, name) {
  const playing = out.state === 'PLAYING'
  return {
    uuid: BROWSER_UUID,
    name,
    host: '',
    model: 'Sonora',
    generation: '',
    display_version: '',
    online: true,
    paired: false,
    local: true,
    topology_label: name,
    volume: out.volume,
    muted: out.muted,
    bass: 0,
    treble: 0,
    loudness: false,
    balance: 0,
    fixed_output: false,
    supports_line_in: false,
    line_in_connected: false,
    group_id: BROWSER_GROUP_ID,
    is_coordinator: true,
    group_members: [BROWSER_UUID],
    group_volume: out.volume,
    group_muted: out.muted,
    transport: browserTransport(out),
    radio: {},
    ht_audio_in: 0,
    last_play_state: `${out.state},,,`,
    ht_input: '',
    ht_signal: null,
    // No speaker to ask, so nothing to poll or diagnose.
    diagnostics: null,
  }
}

/** Seconds as the players report time: ``H:MM:SS``. */
function hms(seconds) {
  const whole = Math.max(0, Math.floor(seconds || 0))
  const two = (n) => String(n).padStart(2, '0')
  return `${Math.floor(whole / 3600)}:${two(Math.floor(whole / 60) % 60)}:${two(whole % 60)}`
}

function liveActions(out) {
  const live = /^x-sonosapi-stream:/i.test(out.mediaUri || '')
    || (out.state === 'PLAYING' && !(out.duration > 0))
  return {
    can_pause: !live,
    can_next: Boolean(out.hasNext),
    // Previous here goes back to the top of what is playing, which a live
    // stream does not have.
    can_previous: !live && Boolean(out.url),
  }
}

export function browserTransport(out) {
  return {
    state: out.state,
    status: out.error ? 'ERROR' : 'OK',
    play_mode: 'NORMAL',
    crossfade: false,
    // An album or playlist counts its tracks as a speaker's queue does.
    track_number: out.queue ? out.queueIndex + 1 : (out.url ? 1 : 0),
    // A remembered item has no stream yet; its service URI stands in, so the
    // panes count the room as loaded and offer Play, which resolves it again.
    track_uri: out.url || (out.restored ? out.mediaUri : ''),
    // The service URI, as a speaker reports it. The panes classify from this:
    // x-sonosapi-stream: is a broadcast and gets Station / On Now.
    media_uri: out.mediaUri || '',
    // A live stream has no duration and the panes read that as "Live"; a
    // track from a station or a book has one, and can be moved within.
    track_duration: out.duration ? hms(out.duration) : '0:00:00',
    rel_time: hms(out.position),
    position: out.position,
    title: out.title,
    // A live stream, presented the way a station is everywhere else: the name
    // on the station line, with the host it comes from as the stream's own
    // text rather than as an artist.
    artist: out.artist,
    album: out.album,
    // Both names: the panes read album_art_uri, and provider_art_uri is the
    // fallback they try when a speaker's own copy fails. There is no speaker
    // here, so the service's URL is both.
    album_art: out.art,
    album_art_uri: out.art,
    provider_art_uri: out.art,
    // The station's own name where it has one apart from what plays on it
    // (a service's station hands back a song at a time); otherwise the
    // title, which for a plain broadcast is the station.
    container_title: out.station ?? out.title,
    // The show on air, which is what the Station pane's second line reads.
    stream_show: out.sub,
    // What is on now: the stream's own title where Sonora could read one, as
    // a speaker prints it on the Information line, and the show otherwise.
    stream_content: out.streamText || out.sub,
    // Playing through an album or playlist is playing from a queue, which is
    // what puts the panes' queue in use with the playing track marked.
    // A remembered album's list counts too, stopped, with its track marked.
    source: out.queue ? 'queue' : (out.url ? 'radio' : 'idle'),
    service: out.service,
    // The service's name under the key a speaker's transport uses, which is
    // what every theme reads; without it Hi-Fi's display read "Radio" over
    // AccuRadio. No service_id: the panes take that as a speaker
    // to ask for ratings and the item's metadata, and there is none here.
    service_name: out.service || '',
    // Radio does not fill a queue, here or on a speaker; an album does.
    queue_length: out.queue ? out.queue.length : 0,
    // A station or a book has a next track to ask the service for; a live
    // stream has nowhere to go. Seeking works wherever there is a duration.
    can_skip: Boolean(out.hasNext),
    // A remembered item has a length but no stream yet, so nothing to move in.
    can_seek: out.duration > 0 && Boolean(out.url),
    // What a speaker would say it can do, which is what every pane reads.
    // A live stream stops rather than pausing, as a speaker's broadcast does
    // ("Set, Stop, Play"): the source is a broadcast, or it plays and has no
    // length. Unset, the panes took it as pausable and drew pause bars over
    // 80s80s Reggae playing here.
    ...liveActions(out),
  }
}

export function browserGroup(out, name) {
  return {
    id: BROWSER_GROUP_ID,
    household: '',
    local: true,
    coordinator: BROWSER_UUID,
    members: [BROWSER_UUID],
    name,
    transport: browserTransport(out),
  }
}
