// Which of the product's content labels an item wears.
//
// Shared by the tiles on the home, the search results and the page an item
// opens on, so all three call a stream a Station and none keeps its own
// table. The product's word for a track is "Song" (Community Radio Plus'
// search results, measured 2026-09-19).
// The product prints a content type under each tile. Favorites carry no
// useful UPnP class, so it is derived from the URI scheme.
export function kindLabel(item) {
  if (item.kind === 'station') return 'web.kind.station'
  if (item.kind === 'other') return 'web.kind.other'
  // A podcast and its episodes are named by what they are, whatever itemType
  // carries them: Amazon Music sends its shows as itemType "show" and their
  // episodes as "track", and the product labels them Podcast and Episode in
  // search and on the show's page (2026-09-22). semanticType is the
  // protocol's own word for it.
  const semantic = item.semantic_type || ''
  if (semantic === 'podcast' || semantic.startsWith('podcast.')) return 'web.kind.podcast'
  if (semantic.startsWith('episode.')) return 'web.kind.episode'
  // A service's items name their type outright.
  if (item.item_type === 'album') return 'common.kind.album'
  if (item.item_type === 'playlist') return 'common.kind.playlist'
  if (item.item_type === 'track') return 'web.kind.track'
  if (item.item_type === 'artist') return 'web.kind.artist'
  if (item.item_type === 'stream' || item.item_type === 'program') return 'web.kind.station'
  if (item.item_type === 'container') return 'web.kind.other'
  // Libby's books: the product's meta line under one reads "Audiobook"
  // (measured 2026-09-20).
  if (item.item_type === 'audiobook') return 'web.kind.audiobook'
  const uri = item.uri || ''
  if (uri.startsWith('x-sonosapi-stream') || uri.startsWith('x-rincon-mp3radio')
      || uri.startsWith('x-sonosapi-hls')) return 'web.kind.station'
  if (uri.startsWith('x-rincon-cpcontainer')) return 'common.kind.playlist'
  if (uri.startsWith('x-sonosapi-radio')) return 'web.kind.radio'
  if (item.kind === 'album') return 'common.kind.album'
  if (item.kind === 'playlist') return 'common.kind.playlist'
  if (item.kind === 'track') return 'web.kind.track'
  return 'web.kind.other'
}
