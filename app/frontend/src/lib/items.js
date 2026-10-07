// Whether a browse item is something to play rather than open.
//
// Providers mark stations and programs as containers (a station "contains"
// what it will play), so the container flag alone sends a click into a
// getMetadata call the provider refuses. Anything with a playback URI whose
// kind is a station, stream or track is played; only true folders are opened.
//
// An audiobook is a collection of chapters that Sonos' SMAPI reference says
// are "not user-selectable individually": the apps hand the book's id to
// the player instead of opening it, so Libby by OverDrive shows one level
// where Sonora showed the chapter list. A collection the
// provider marks canEnumerate=false cannot be opened either.
//
// A track that is a real collection opens, though: Plex answers a song search
// with mediaCollections of itemType "track" (one per copy of the song), and
// the Windows app draws each with a chevron and opens it onto Play, Shuffle
// and the copies (2026-10-02). A track that is a plain item still plays.
const PLAYABLE_KINDS = new Set(['program', 'stream', 'track', 'audiobook'])

export function isPlayableLeaf(item) {
  if (!item?.uri) return false
  if (!item.is_container) return true
  if (item.can_enumerate === false && Boolean(item.can_play)) return true
  if (item.item_type === 'track') return false
  return PLAYABLE_KINDS.has(item.item_type)
}

// The provider's own id for an item the speakers are playing or holding in
// the queue, read out of the URI the way the backend does: x-sonos-http:
// <escaped id>.<ext>?sid=.. and its relatives carry it percent-encoded with
// a file extension bolted on. A raw stream names none.
export function providerIdOf(uri) {
  // Stations count too: their id is what getExtendedMetadata wants, and
  // without them Info & Options never asked the service about a playing
  // station, so Community Radio Plus' "About this station" row was missing
  // where the app shows it.
  const m = /^(x-sonos-http|x-sonosprog-http|x-sonos-spotify|x-sonosapi-hls|x-sonosapi-hls-static|x-sonosapi-stream|x-sonosapi-radio):([^?]+)/i.exec(uri || '')
  if (!m) return ''
  const rest = m[2].replace(/\.(mp3|m4a|mp4|aac|flac|ogg|wma|wav)$/i, '')
  try { return decodeURIComponent(rest) } catch (exc) { return rest }
}

// Whether an item can be put in the queue.
//
// The rule is the service's own declared item type, not a list of services.
// Measured against the Windows app on 2026-09-14, right-clicking a row in each:
//
//   Mixcloud show (track)   Play Now / Play Next / Add to End of Queue /
//                           Replace Queue / favorites / playlist / info
//   Plex album (album)      the same full set
//   TuneIn station (stream) Play Now / Add to Sonos Favorites / Info only
//   Libby book (audiobook)  not offered, and the speakers themselves refuse
//                           AddURIToQueue for one with UPnP error 800
//
// So a queue takes what is, or resolves to, tracks. A live stream takes the
// transport instead of a place in the queue, and a book is played whole.
// Everything else here -- navigation containers, artists, stations -- is
// browsed rather than queued.
const QUEUEABLE = new Set([
  'track', 'episode', 'album', 'playlist', 'trackList', 'artistTrackList',
])

export function canEnqueue(item) {
  if (!item?.uri || item.can_play === false) return false
  return QUEUEABLE.has(item.item_type || '')
}
