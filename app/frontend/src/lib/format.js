// Formatting helpers shared by every theme.

import { tvSignalLine } from './tvFormat.js'

// Sonos reports durations as H:MM:SS, sometimes with a leading zero hour and
// sometimes as NOT_IMPLEMENTED for live streams.
export function parseDuration(value) {
  if (!value || typeof value !== 'string') return 0
  const parts = value.split(':').map(Number)
  if (parts.some(Number.isNaN)) return 0
  return parts.reduce((total, part) => total * 60 + part, 0)
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  const pad = (n) => String(n).padStart(2, '0')
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(secs)}`
    : `${minutes}:${pad(secs)}`
}

// Where a track has reached, from the last reading the speakers gave and how
// long ago it was taken. The position is not evented: a client that renders
// well after that reading would otherwise start its own clock from a stale
// figure and stay behind for the whole track (measured 2026-09-14 at a
// constant 29 seconds behind the speaker). Only a playing room has moved on
// since; a paused one is exactly where it was left.
export function positionNow(transport, { exact = false } = {}) {
  const base = parseDuration(transport?.rel_time)
  const playing = transport?.state === 'PLAYING' || transport?.state === 'TRANSITIONING'
  // The reading's age when sent, plus how long this page has held it (the
  // store stamps received_at), so the figure is right whenever it is read.
  const held = playing && transport?.received_at
    ? Math.max(0, (performance.now() - transport.received_at) / 1000) : 0
  const age = playing ? (Number(transport?.position_age) || 0) + held : 0
  // RelTime is whole seconds, truncated, so a playing track is on average
  // half a second past it; `exact` hands back that unrounded figure for a
  // clock to run from. A paused one is exactly where the reading says.
  return exact ? Math.max(0, base + age + (playing ? 0.5 : 0)) : Math.max(0, Math.round(base + age))
}

export function isLiveStream(duration, uri = '') {
  // A broadcast is live whatever the speaker reports for it. Some services
  // hand the player a rolling HLS window and it duly reports a duration and a
  // position inside it, both of which slide: Community Radio Plus stations did
  // that and the progress bar jumped forwards and back every few seconds.
  // x-sonosapi-hls-static: is deliberately not here -- that is a
  // fixed-length item, a Mixcloud show or an Amazon track, which
  // does have a real position worth drawing.
  if (/^x-sonosapi-(?:stream|hls):/.test(uri || '')) return true
  return !duration || duration === '0:00:00' || duration === 'NOT_IMPLEMENTED'
}

// The translation key naming a transport source. Kept as a key rather than a
// string so this module stays language-agnostic and the caller resolves it.
export function sourceKey(source) {
  return `source.${source || 'unknown'}`
}

// Some stations announce themselves in a keyed form rather than as a
// sentence: TuneIn sends "TYPE=SNG|TITLE Midnight Sun|ARTIST Zara Larsson|
// ALBUM " for BBC Radio 1. The apps print none of it. Measured 2026-09-12
// against the Windows app with that station on one room and the speaker
// reporting that string: the Now Playing pane showed "Station / BBC Radio 1"
// over an empty "On Now" and no Information line at all, and the room tile
// read "Radio - BBC Radio 1"; the same held through a track change and on a
// second station. Sonora had been printing the song in the Information line,
// which no app view shows.
function isKeyedStream(value) {
  const raw = (value || '').trim()
  return /^TYPE=/.test(raw) && raw.includes('|')
}

// While a stream is starting the speakers put a placeholder in
// r:streamContent rather than a track: ZPSTR_CONNECTING, ZPSTR_BUFFERING and
// the like. The apps print those as ordinary sentences -- measured on the
// Windows app 2026-09-06, ZPSTR_CONNECTING showed as "Connecting..." in the
// Information line at the same moment Sonora was showing the raw token.
// A token with no translation of its own is title-cased and given the same
// ellipsis, so a new one from the firmware still reads as a sentence.
export function streamText(value, t) {
  if (isKeyedStream(value)) return ''
  const token = /^ZPSTR_([A-Z0-9_]+)$/.exec((value || '').trim())
  if (!token) return value || ''
  const key = `desk.now.zp.${token[1].toLowerCase()}`
  const known = t(key)
  if (known && known !== key) return known
  const words = token[1].toLowerCase().replace(/_/g, ' ')
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}...`
}

// The last path segment of an http(s) URL, query string included, as the
// apps label a stream that has no title.
export function streamFileName(uri) {
  if (!/^https?:\/\//i.test(uri || '')) return ''
  try {
    const url = new URL(uri)
    const name = url.pathname.split('/').filter(Boolean).pop() || url.host
    return decodeURIComponent(name) + url.search
  } catch {
    return uri.split('/').pop() || ''
  }
}

// The two lines the desktop apps show for what a room is playing (SCLib's
// getTwoLineMetadata): the room card joins them with " - ", the Group Rooms
// dialog stacks them under the artwork. A track reads as its title over its
// artist; a station with no track of its own reads as its source over its
// name -- "Radio" over "BBC Radio 1", measured on the Windows app
// 2026-09-07, where Sonora had been printing the station's name alone.
export function twoLineMetadata(transport, t) {
  if (!transport) return { line1: '', line2: '' }
  const label = (key, fallback) => (t ? t(key) : fallback)
  const { title, artist, stream_content: stream, source, state } = transport
  if (source === 'tv') {
    return { line1: label('source.tv', 'TV'), line2: transport.tv_input || '' }
  }
  const station = ['radio', 'service_radio', 'service_stream', 'service_hls'].includes(source)
    ? (transport.container_title || title || '')
    : ''
  // A TuneIn stream is "Radio" over the station; a service's radio
  // (x-sonosapi-radio: Sonos Radio's stations, AccuRadio's channels) is just
  // its name. The Windows app on 2026-09-23: "Radio - harmony Feelings" under
  // a TuneIn room, "Progressive House Radio" and "Chill" under the others,
  // and "Chill" alone in Group Rooms.
  if (station && !artist && (!title || title === station)) {
    if (source === 'service_radio') return { line1: station, line2: '' }
    return { line1: label(sourceKey(source), 'Radio'), line2: station }
  }
  if (title) return { line1: title, line2: artist || '' }
  const streamed = streamText(stream, t)
  if (streamed) return { line1: streamed, line2: '' }
  const file = streamFileName(transport.track_uri)
  if (file) return { line1: file, line2: '' }
  if (state === 'STOPPED' || source === 'idle') return { line1: '', line2: '' }
  return { line1: '', line2: '' }
}

// The two lines the mini controller prints. Its MiniTrack and MiniArtist
// (nowplaying/minipanel.xaml) bind MetadataLine1.Property and
// MetadataLine2.Property -- the same first two slots the Now Playing pane
// captions, with the labels dropped and the third slot left out. A broadcast
// fills those slots with Station and On Now, so the mini names the station
// and whatever is on air, and never prints the Information line, which is
// where the speaker's ZPSTR_ placeholders live and where one leaked into
// Sonora's mini. `provider` is the service's own
// metadata where the caller has it, for the podcast and audiobook wording.
export function metadataLines(transport, t, provider = null) {
  if (!transport) return { line1: '', line2: '' }
  if (transport.source === 'tv') {
    return { line1: t ? t('source.tv') : 'TV', line2: transport.tv_input || '' }
  }
  if (/^x-sonosapi-stream:/.test(transport.media_uri || '')) {
    return { line1: transport.container_title || '', line2: transport.stream_show || '' }
  }
  if (/^episode\./.test(provider?.semantic_type || '')) {
    return {
      line1: provider.title || transport.title || '',
      line2: provider.podcast || provider.artist || '',
    }
  }
  const audiobook = transport.source !== 'queue'
    && Boolean(provider?.author || provider?.narrator || transport.narrator
      || transport.track_kind === 'audiobook')
  if (audiobook) {
    return {
      line1: provider?.title || transport.title || '',
      line2: provider?.author || transport.artist || '',
    }
  }
  return { line1: transport.title || '', line2: transport.artist || '' }
}

// What to show as the primary line for whatever a room is doing. A radio
// stream often has no track title but does have a stream description, and an
// externally driven session may have neither. `t` is the translator; the
// source name is the last resort.
export function describeNowPlaying(transport, t) {
  if (!transport) return { primary: '', secondary: '' }
  const { title, artist, album, stream_content: stream, source, state } = transport

  // A soundbar on its television input. The card shows "TV" over the input's
  // name (SPDIF, HDMI), which only the cloud feed knows, so it is blank when
  // signed out. The detail line is the signal: "No Signal", or the format the
  // speaker reports receiving (see tvFormat.js), which the LAN does give.
  if (source === 'tv') {
    return {
      primary: t ? t('source.tv') : 'TV',
      secondary: transport.tv_input || '',
      detail: tvSignalLine(transport, t),
    }
  }

  if (state === 'STOPPED' && !title && !stream) {
    return { primary: '', secondary: '' }
  }
  // The speaker's own placeholders reach here as tokens: a starting stream
  // reports ZPSTR_BUFFERING, and the mini controller printed it verbatim.
  // streamText turns it into the words the pane uses.
  // With a title to show, a placeholder adds nothing and can outstay the
  // start of the stream by the whole broadcast on an S2 speaker (2026-09-28).
  const placeholder = /^ZPSTR_/.test((stream || '').trim())
  const streamed = title && placeholder ? '' : streamText(stream, t)
  if (title) {
    return {
      primary: title,
      secondary: [artist, album].filter(Boolean).join(' — ') || streamed || '',
    }
  }
  if (streamed) return { primary: streamed, secondary: '' }
  return { primary: t ? t(sourceKey(source)) : '', secondary: '' }
}

export function groupName(group, zones) {
  const names = group.members
    .map((uuid) => zones[uuid]?.name)
    .filter(Boolean)
  if (names.length === 0) return group.name || ''
  if (names.length === 1) return names[0]
  return `${names[0]} + ${names.length - 1}`
}

// Discovery returns households in whatever order the network answered, which
// reshuffles the page between reloads. Order by generation so the same system
// is always in the same place, with the older one first since that is the one
// this project exists to serve.
export function orderedHouseholds(households) {
  return [...households].sort((a, b) => {
    const gen = (a.generation || '').localeCompare(b.generation || '')
    return gen !== 0 ? gen : (a.id || '').localeCompare(b.id || '')
  })
}

/**
 * Whether choosing a system is a choice worth offering.
 *
 * The picker names its options by generation -- "S1", "S2" -- so it only says
 * anything when the systems differ by generation. One system has nothing to
 * choose between; two of the same generation would draw two buttons with the
 * same word on them, which tells a reader nothing and was never useful.
 *
 * A house with only S1 speakers, or only S2, therefore sees no system picker
 * anywhere. Where several same-generation systems do exist,
 * the rooms of all of them are shown rather than hidden behind a control that
 * is not drawn -- see shellSelection.js.
 */
export function systemChoiceMatters(households) {
  const generations = new Set((households || [])
    .map((h) => h.generation).filter(Boolean))
  return generations.size > 1
}

// The window title names the systems in view, as "Sonora S1 Controller",
// "Sonora S2 Controller" or "Sonora S1 · S2 Controller"; plain "Sonora" until
// a system is found.
export function controllerTitle(households, systemFilter, t) {
  const visible = orderedHouseholds(households).filter(
    (h) => !systemFilter || systemFilter === 'all' || h.id === systemFilter)
  if (!visible.length) return t('desk.window.title')
  return t('desk.window.controller', { systems: visible.map((h) => h.generation).join(' · ') })
}
