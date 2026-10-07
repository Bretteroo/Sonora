// node themes/web/presentation.check.mjs
//
// Rows or tiles, and what goes on the second line. The rule was read off
// play.sonos.com on 2026-09-19 with four services open beside each other, so
// the cases below are those four pages and the odd item inside them.
import { tiled, round, second, declaredMode } from './presentation.js'

let failed = 0
const is = (got, want, what) => {
  const ok = got === want
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok ? '' : `\n      got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`)
}

// Pandora's My Stations: ninety programs and one plain folder among them.
const stations = [
  { title: 'Shuffle', item_type: 'program', display_type: 'station', summary: '' },
  { title: 'Stations (A-Z)', item_type: 'container', display_type: '', summary: '' },
  { title: 'Cocktail Jazz Radio', item_type: 'program', display_type: 'station', summary: '9/14/2026' },
]
const pandoraMap = { station: { mode: '', lines: ['title', 'summary'] } }

is(tiled(stations), true, 'a page of stations is a grid')
is(tiled(stations, { root: true }), false,
   "but a service's own front page is a list, whatever is on it")
is(round(stations), false, 'stations are square')
is(second(stations[2], pandoraMap), '9/14/2026',
   "the station's second line is the date its display type names")
is(second(stations[0], pandoraMap), '',
   'a station with no date gets no second line rather than a blank one')
is(second(stations[1], pandoraMap), '',
   'and the folder sitting among them carries none either')

// Plex's By Album and By Artist: no display type at all on the items.
const albums = [
  { title: '_Hello World', item_type: 'album', display_type: '', artist: 'Information Society' },
  { title: '3 in 1', item_type: 'album', display_type: '', artist: 'The Kruger Brothers' },
]
const artists = [
  { title: 'µ-Ziq', item_type: 'artist', display_type: '' },
  { title: 'The 3 Sounds', item_type: 'artist', display_type: '' },
]

is(tiled(albums), true, 'a page of albums is a grid')
is(round(albums), false, 'albums are square')
is(second(albums[0], {}), 'Information Society',
   'an album with no display type falls back to its artist')
is(tiled(artists), true, 'a page of artists is a grid')
is(round(artists), true, 'and artists are round')
is(second(artists[0], {}), '', 'an artist has nothing to say on a second line')

// The pages that stay lists: folders, track lists and streams.
is(tiled([{ item_type: 'container' }, { item_type: 'container' }]), false,
   "Plex's and AccuRadio's roots are rows")
is(tiled([{ item_type: 'trackList' }, { item_type: 'container' }]), false,
   "Mixcloud's root is rows, playable track lists and all")
is(tiled([{ item_type: 'stream' }, { item_type: 'stream' }]), false,
   "80er-Radio harmony's sixteen streams are rows")
is(tiled([]), false, 'an empty page is not a grid')

// Community Radio Plus' Near Me: streams, each with a logo and a line about
// itself, which the product tiles.
const nearMe = [
  { title: 'Radio NGM', item_type: 'stream', art: 'https://x/ngm.jpg', summary: 'Pulse of the Yarnangu' },
  { title: 'Ngaarda Radio', item_type: 'stream', art: 'https://x/ng.jpg', summary: 'Voice of the Traditional Owners' },
]
is(tiled(nearMe), true, 'a page of pictured streams is a grid')
is(tiled(nearMe, { root: true }), false, 'the same rows at a service root are a list')
is(second(nearMe[0], {}), 'Pulse of the Yarnangu',
   "and a station's line is what it says about itself")
is(tiled([{ item_type: 'stream' }, { item_type: 'stream' }]), false,
   'streams with no artwork stay a list')

// The page decides, not the item: one folder among the stations does not
// break the grid, and one album among the folders does not make one.
is(tiled([...stations, { item_type: 'container' }]), true,
   'a majority of tiled items carries the page')
is(tiled([{ item_type: 'album' }, { item_type: 'container' }, { item_type: 'container' }]), false,
   'a single album among folders does not')

// A display type that names only the title suppresses the fallback: the
// service has said what it wants shown.
is(second({ title: 'Trending', display_type: 'plain', artist: 'DJ THEORY' },
          { plain: { mode: '', lines: ['title'] } }), '',
   'a display type naming only the title leaves the second line empty')


// AccuRadio's artist page: every child declares a display type whose mode is
// EDITORIAL, and the product draws rows -- though the items are programs,
// which the item-type rule above would tile (measured 2026-09-22).
const editorial = [
  { title: "Listeners' Top 100: Jazz", item_type: 'program', display_type: 'channelEditorial', summary: 'The Top 100' },
  { title: 'Pure Jazz', item_type: 'program', display_type: 'channelEditorial', summary: 'The rich art of Jazz' },
  { title: 'Bebop', item_type: 'program', display_type: 'channelEditorial', summary: 'The masters of swing' },
]
const accuMap = { channelEditorial: { mode: 'EDITORIAL', lines: ['title', 'summary'] } }

is(declaredMode(editorial, accuMap), 'EDITORIAL', 'the page carries the mode its items declare')
// The same programs under EDITORIAL are tiles on AccuRadio's Reggae page
// and rows on its artist page (2026-09-28): the artist's page asks for no
// tiles itself, so here the item types decide.
is(tiled(editorial, { displayTypes: accuMap }), true,
   'EDITORIAL leaves the item types to decide')
is(tiled(editorial, { displayTypes: accuMap, root: true }), false,
   'a service root is still a list under EDITORIAL')
is(tiled(stations, { displayTypes: pandoraMap }), true,
   'a display type with no mode leaves the item types to decide')
is(declaredMode(stations, pandoraMap), '',
   'and a page whose types name no mode declares none')

// A grid says so outright.
const grid = [
  { title: 'One', item_type: 'container', display_type: 'browse' },
  { title: 'Two', item_type: 'container', display_type: 'browse' },
]
is(tiled(grid, { displayTypes: { browse: { mode: 'GRID', lines: [] } } }), true,
   'GRID is a grid, though the items are plain containers')

// LIST is rows at the front page and tiles below it: Audacy declares it
// everywhere, and the product rows its root and tiles "All stations", a
// single folder with no picture, a level down (2026-09-28).
const audacyMap = { list: { mode: 'LIST', lines: [] } }
const folder = [{ title: 'All stations', item_type: 'container', display_type: 'list' }]
is(tiled(folder, { displayTypes: audacyMap, root: true }), false, 'LIST at a root is rows')
is(tiled(folder, { displayTypes: audacyMap }), true, 'LIST below a root is tiles')

process.exit(failed ? 1 : 0)
