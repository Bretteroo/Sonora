// A search's category chips filter what the search already found, rather
// than searching again.
//
// Searched with no chip, a service without an "all" of its own answers in
// each of its first six categories at once (the backend's search with no
// category), so the rows of any of those are already in hand. A service's
// "all" answer comes mixed, and the library answers in one category at a
// time, so their other chips search once, and what they found is kept for
// the rest of that search.

// The same term searched in the same place, whose answers can be reused.
export function sameSearch(prev, q, scope) {
  return Boolean(prev && scope) && prev.term === q && prev.scopeKey === scope.key
}

// The categories a chip shows without searching again, or null when they
// must be asked for. `picked` is the chip, '' for none.
export function localCategories(search, scope, picked) {
  if (!scope || scope.all) return null
  if (search.cache?.[picked]) return search.cache[picked]
  if (scope.library || !search.full) return null
  if (!picked) return search.full
  // `offered` is every category the service declared, its "all" too, where
  // a theme shows only the tabs in `available`.
  const ids = (search.offered || search.available || []).map((c) => c.id)
  if (ids.includes('all')) return null
  if (!ids.slice(0, 6).includes(picked)) return null
  return search.full.filter((c) => c.id === picked)
}

// The search state after a service's answer: the rows shown, plus what is
// kept for the chips (`full`, the chipless answer; `cache`, each chip's).
export function serviceAnswer(prev, { q, scope, picked, result }) {
  const keep = sameSearch(prev, q, scope)
  const available = result.available || []
  const categories = result.categories || []
  const failed = Boolean(result.error)
  return {
    term: q, scopeKey: scope.key, available, loading: false,
    category: picked || available[0]?.id || '', picked,
    categories, displayTypes: result.display_types || {},
    error: failed ? result.error.message : '',
    full: picked ? (keep ? prev.full : null) : (failed ? null : categories),
    cache: { ...(keep ? prev.cache : {}), ...(picked && !failed ? { [picked]: categories } : {}) },
  }
}

// The search state after the library's answer, kept per category.
export function libraryAnswer(prev, { q, scope, picked, result }) {
  const keep = sameSearch(prev, q, scope)
  return {
    term: q, scopeKey: scope.key, loading: false, error: '', picked, ...result,
    cache: { ...(keep ? prev.cache : {}), [result.category]: result.categories, ...(picked ? {} : { '': result.categories }) },
  }
}

// The search state when a chip's rows are already in hand.
export function localAnswer(prev, picked, categories) {
  return { ...prev, loading: false, error: '', picked, categories, category: picked || prev.available?.[0]?.id || '' }
}

// What one search result is, named on its row where results of every kind
// are mixed: a song and its album share a title and a cover, and read as the
// same thing twice without it.
const KIND_OF_CATEGORY = {
  tracks: 'desk.now.songLabel', songs: 'desk.now.songLabel', albums: 'desk.now.album', artists: 'desk.now.artist',
  playlists: 'common.kind.playlist', podcasts: 'desk.now.podcast', episodes: 'desk.now.episode',
  stations: 'desk.info.station', audiobooks: 'desk.now.book',
}
// A category that names one kind gives its rows that name; a mixed one (a
// service's own "all") leaves each row to say what it is by its type, and a
// row whose type says nothing useful goes unlabeled.
const KIND_OF_TYPE = {
  track: 'desk.now.songLabel', album: 'desk.now.album', artist: 'desk.now.artist', playlist: 'common.kind.playlist',
  program: 'desk.info.station', stream: 'desk.info.station', show: 'desk.now.podcast', podcast: 'desk.now.podcast',
  episode: 'desk.now.episode', audiobook: 'desk.now.book',
}
export function kindOf(item, cat, t) {
  const byCategory = KIND_OF_CATEGORY[(cat?.id || '').toLowerCase()]
  if (byCategory) return t(byCategory)
  const byType = KIND_OF_TYPE[(item?.item_type || '').toLowerCase()]
  if (byType) return t(byType)
  return cat && cat.id !== 'all' ? (cat.title || '') : ''
}

// Each row of a mixed answer tagged with the category it came from, so its
// row can say what it is.
export function tagCategories(categories) {
  return (categories || []).map((c) => ({ ...c, items: (c.items || []).map((item) => ({ ...item, searchCategory: { id: c.id, title: c.title } })) }))
}
