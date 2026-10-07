// Two Music Library preferences the app keeps on the controller, not the
// speakers -- its own wording says so: "This preference affects only this
// controller." Sonora keeps them in the browser the same way.
//
// `contributing`: show the Contributing Artists node (the speakers' A:ARTIST)
// in the library root. `folderSort`: how a folder's children are ordered --
// the app offers Song Name, Song Number (its default) and File Name (S1
// Windows app, 2026-09-14).
const KEY = 'sonora.library'
const DEFAULTS = { contributing: false, folderSort: 'songNumber' }
export const FOLDER_SORTS = ['songName', 'songNumber', 'fileName']

export function readLibraryPrefs() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(KEY) || '{}')
    return { ...DEFAULTS, ...(stored && typeof stored === 'object' ? stored : {}) }
  } catch {
    return { ...DEFAULTS }
  }
}

export function writeLibraryPrefs(patch) {
  const next = { ...readLibraryPrefs(), ...patch }
  try { window.localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* session only */ }
  window.dispatchEvent(new CustomEvent('sonora:libraryprefs', { detail: next }))
  return next
}

// A folder's rows in the chosen order. Folders stay ahead of files in every
// mode, as the speakers list them. Song Number is the speakers' own order,
// which is by track number where the files carry one; Song Name sorts by the
// tag's title; File Name by the file itself, the last segment of its path.
export function sortFolderItems(items, mode) {
  if (mode !== 'songName' && mode !== 'fileName') return items
  const fileName = (i) => { try { return decodeURIComponent((i.uri || i.id || '').split('/').pop() || '') } catch { return (i.uri || i.id || '').split('/').pop() || '' } }
  const key = mode === 'fileName' ? (i) => fileName(i).toLocaleLowerCase() : (i) => (i.title || '').toLocaleLowerCase()
  const folders = items.filter((i) => i.is_container)
  const files = items.filter((i) => !i.is_container)
  const cmp = (a, b) => key(a).localeCompare(key(b), undefined, { numeric: true })
  return [...folders.sort(cmp), ...files.sort(cmp)]
}

// The library root as the desktop app lays it out (S2 Windows app, walked
// 2026-09-14). The speakers list A:ARTIST "Contributing Artists",
// A:ALBUMARTIST "Artists", A:ALBUM, A:GENRE, A:COMPOSER, A:TRACKS "Tracks" and
// A:PLAYLISTS "Playlists"; the app shows Artists, Albums, Composers, Genres,
// Songs, Imported Playlists and Folders (the shares, S:), in that order, and
// Contributing Artists only when the controller preference says so.
const ROOT_ORDER = [['A:ALBUMARTIST', 'artists'], ['A:ARTIST', 'contributingArtists'], ['A:ALBUM', 'albums'],
                    ['A:COMPOSER', 'composers'], ['A:GENRE', 'genres'], ['A:TRACKS', 'songs'], ['A:PLAYLISTS', 'importedPlaylists']]
export function libraryRootRows(rows, prefs, t) {
  const byId = new Map(rows.map((r) => [r.id, r]))
  const out = []
  for (const [id, label] of ROOT_ORDER) {
    if (id === 'A:ARTIST' && !prefs.contributing) continue
    const row = byId.get(id)
    if (row) out.push({ ...row, title: t(`desk.library.${label}`), libraryNode: true })
  }
  out.push({ id: 'S:', title: t('desk.library.foldersNode'), kind: 'container', is_container: true, libraryNode: true })
  return out
}

// A library node's rows as the app shows them: the root relabeled, a folder
// in the preferred order, anything else untouched.
export function libraryRows(nodeId, rows, prefs, t) {
  if (nodeId === 'A:') return libraryRootRows(rows, prefs, t)
  if (/^S:/.test(nodeId || '')) return sortFolderItems(rows, prefs.folderSort)
  return rows
}
