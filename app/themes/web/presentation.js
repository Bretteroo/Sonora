// How a service's page wants to be drawn.
//
// Measured on play.sonos.com 2026-09-19 across four services. A page is a
// grid of tiles or a list of rows, and the choice is the items' own itemType,
// not the service and not the row that opened the page:
//
//   Pandora's My Stations   program   -> square tiles, title over the date
//   Plex's By Album         album     -> square tiles, title over the artist
//   Plex's By Artist        artist    -> round tiles, the name centered
//   Plex's root             container -> rows with a chevron
//   Mixcloud's root         trackList -> rows with a chevron
//   80er-Radio harmony      stream    -> rows with a chevron
//
// The grid is the page's, not the item's: "Stations (A-Z)", a plain container
// sitting among Pandora's ninety stations, is drawn as a tile like the rest.
// So a majority decides, and the odd folder joins in.

//: Item types the product draws as tiles wherever they appear.
const TILED = new Set(['album', 'artist', 'program', 'playlist'])

//: An artist is a face: the product rounds the picture and centers one line
//: under it, where an album carries its artist on a second line.
const ROUND = new Set(['artist'])

// What the service's own presentation map says a page is, where it says
// anything. A display type carries a mode -- GRID, LIST, EDITORIAL, TEXT,
// HERO, TABLE -- and that is the protocol's own answer to this question, so
// it outranks any guess from the items' types. Measured 2026-09-22:
// AccuRadio's artist page declares EDITORIAL and the product draws rows,
// while Pandora's stations declare a display type with no mode at all and it
// draws tiles, though both are itemType program.
//
// EDITORIAL is not a list on its own, though: AccuRadio's Reggae page
// declares it over the same channelEditorial programs its artist page
// does, and the product draws tiles there and rows on the artist's page
// (2026-09-28). An artist's page is rows whatever it holds (ServicePage
// asks for no tiles there); anywhere else under EDITORIAL the items' own
// type decides.
const GRIDS = new Set(['GRID'])
const LISTS = new Set(['LIST'])

export function declaredMode(items = [], displayTypes = {}) {
  const counts = new Map()
  for (const row of items) {
    const mode = (displayTypes[row?.display_type] || {}).mode || ''
    if (mode) counts.set(mode, (counts.get(mode) || 0) + 1)
  }
  let best = ''
  let seen = 0
  for (const [mode, n] of counts) {
    if (n > seen) { best = mode; seen = n }
  }
  // A mode only decides when most of the page carries it.
  return seen * 2 >= items.length ? best : ''
}

export function tiled(items = [], { root = false, displayTypes = {} } = {}) {
  if (!items.length) return false
  const mode = declaredMode(items, displayTypes)
  if (GRIDS.has(mode)) return true
  // LIST is rows at a service's front page and tiles below it: Audacy
  // declares it on every page, and the product draws its root's Stations as
  // a row, the page under it ("All stations", one plain folder with no
  // picture) as a 166px tile, and the stations under that as tiles
  // (play.sonos.com, 2026-09-28).
  if (LISTS.has(mode)) return !root
  const typed = items.filter((row) => TILED.has(row.item_type || '')).length
  if (mode === 'EDITORIAL') return !root && typed * 2 >= items.length
  // A service's own front page is a list whatever is on it: 80er-Radio
  // harmony's sixteen streams, Community Radio Plus' six sections and
  // Pandora's single My Stations row are all rows, and each of those
  // services draws tiles a level down (measured 2026-09-19).
  if (root) return false
  if (typed * 2 >= items.length) return true
  // Below the root a page of pictures is a grid: Community Radio Plus' Near
  // Me is 45 community stations with their logos and a line of description
  // each, and the product tiles them exactly as it tiles Pandora's stations.
  // A page whose rows have no artwork stays a list.
  const pictured = items.filter((row) => row.art).length
  return pictured * 2 >= items.length
}

export function round(items = []) {
  if (!items.length) return false
  const many = items.filter((row) => ROUND.has(row.item_type || '')).length
  return many * 2 >= items.length
}

// The second line, as the service's own presentation map names it: a row's
// display type lists Line tokens, the first of which is the title, and the
// rest are what goes underneath. Pandora's "station" names title + summary,
// which is the date the station was made; Plex's albums name no display type
// at all and take the artist the item carries.
export function second(row, displayTypes = {}) {
  const declared = row.display_type ? displayTypes[row.display_type] : null
  const lineOf = (token) => (token === 'title' ? row.title
    : token === 'artist' ? (row.artist || row.author || '')
    : token === 'album' ? (row.album || '')
    : token === 'summary' ? (row.summary || '') : '')
  if (declared?.lines?.length > 1) {
    return declared.lines.slice(1).map(lineOf).filter(Boolean).join(' • ')
  }
  if (declared) return ''          // a type that names only the title gets only it
  // A tile from a browse document that names no type of its own says
  // nothing under its name: Amazon Music's playlists carry "Amazon Music" in
  // the field an album's artist arrives in and the product prints only their
  // names, where Spotify's, which name themselves albumItem and
  // playlistItem, carry their artist and their owner under them (measured
  // 2026-09-20).
  if (row.origin === 'browse' && !row.display_type) return ''
  return row.artist || row.author || row.summary || ''
}

// The second line a service's own display type names, and nothing else.
//
// The page an item opens on prints this under its title where the service
// names it -- Pandora's stations name the date they were made -- and prints
// the item's description where it does not: the product's page for Libby's
// audiobook carries the blurb, not its author, though the item names one
// (measured 2026-09-20).
export function declaredSecond(row, displayTypes = {}) {
  if (!row?.display_type) return ''
  const declared = displayTypes[row.display_type]
  if (!declared?.lines?.length || declared.lines.length < 2) return ''
  return second(row, displayTypes)
}

// How a shelf of a browse document wants to be drawn.
//
// The document says so on each view, and services spell it their own way:
// Amazon Music sends LIST, TEXT and GRID, Spotify CAROUSEL and
// YOURMUSIC_LIST, TuneIn Grid and List, Sonos Radio swimlane. The product
// obeys it -- Amazon's Collections is four rows where its Followed Playlists
// is a line of tiles, and its upsell shelf is a sentence under a heading
// (measured 2026-09-20). Anything unnamed is tiles, which is what a shelf
// mostly is.
export function shelfShape(shelf) {
  const named = String(shelf?.display_type || '').toUpperCase()
  if (named === 'TEXT') return 'text'
  if (named.includes('LIST')) return 'rows'
  return 'tiles'
}
