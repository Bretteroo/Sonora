import { api } from './api.js'
import { readLibraryPrefs, libraryRootRows } from './libraryPrefs.js'

// Searching the household's own music library.
//
// The library is not a music service and has no service id: Sonos answers a
// browse of "<container>:<term>" with the matches, so each of the library's
// own categories is one browse and the scope bar picks which. Verified
// against a real share on 2026-09-15: "A:ALBUM:genesys" returned the three
// albums whose names carry the word.
//
// Both desktop apps offer this, and neither decides it for itself: their
// search list comes from the shared Sonos core (getAllSearchables in the
// Windows app's SearchViewModel), which is why the two show exactly the same
// list for the same household. On a household with a library share the Mac
// app's list opens with Music Library; on one without, both open with Sonos
// Radio.

export function libraryScope(household, hzone, t) {
  return {
    key: `${household.id}:library`,
    id: 0,
    library: true,
    name: t('desk.browse.library'),
    nickname: '',
    icon: '',
    account: '',
    hh: household.id,
    hzone: hzone || null,
    gen: household.generation,
  }
}

// The categories, in the order and wording the library pane already uses, and
// the matches for the chosen one. Shaped like a service search's answer so
// the panes can render either without caring which they asked.
export async function searchLibrary({ zone, term, picked = '', count = 100, t }) {
  const roots = await api.browse('A:', { zone, count: 20 })
  const available = libraryRootRows(roots.items || [], readLibraryPrefs(), t)
    // Folders (S:) is a share listing, not a searchable container.
    .filter((row) => String(row.id).startsWith('A:'))
    .map((row) => ({ id: row.id, title: row.title }))
  const category = available.some((c) => c.id === picked) ? picked : (available[0]?.id || '')
  const found = category ? await api.browse(`${category}:${term}`, { zone, count }) : { items: [] }
  const items = found.items || []
  return { available, category, categories: items.length ? [{ id: category, items }] : [] }
}
