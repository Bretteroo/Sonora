import keysUrl from './fonts/blackhansans-keys.woff2?url'
import hangulUrl from './fonts/blackhansans-hangul.woff2?url'
import bookLatinUrl from './fonts/robotocondensed-latin.woff2?url'
import bookLatinExtUrl from './fonts/robotocondensed-latin-ext.woff2?url'
import bookCyrillicUrl from './fonts/robotocondensed-cyrillic.woff2?url'
import bookCyrillicExtUrl from './fonts/robotocondensed-cyrillic-ext.woff2?url'
import bookLatin400Url from './fonts/robotocondensed-latin-400.woff2?url'
import bookLatinExt400Url from './fonts/robotocondensed-latin-ext-400.woff2?url'
import bookCyrillic400Url from './fonts/robotocondensed-cyrillic-400.woff2?url'
import bookCyrillicExt400Url from './fonts/robotocondensed-cyrillic-ext-400.woff2?url'

// The machine's one typeface is Black Han Sans, by Zess Type, under the SIL
// Open Font License (see THIRD-PARTY-NOTICES.md): the heavy display gothic
// the lyrics are set in, and the lettering on the keys. It comes in two
// files. The small one holds ASCII and the syllables printed on the cabinet,
// and is fetched with the theme. The large one holds the rest of the Hangul
// the face draws and is fetched only when a song's words need it: the
// browser asks for a face the first time it draws a character in its range.
// Both are added through the FontFace API, because an installed theme's
// stylesheet may name no file. Scripts the
// face does not draw fall back along the stack.
export const FAMILY = 'Karaoke Display'
// The syllables on the keys and the nameplate (fonts/blackhansans-keys.woff2
// holds exactly these). One added to a key and not here still draws: it
// comes from the large file.
const KEYS = 'U+0020-007E, U+AC04, U+AC70, U+ACE1, U+AE30, U+B178, U+B274, U+B2E4, U+B798, U+B7C9, U+B85D, U+B9AC, U+BA54, U+BA74, U+BAA9, U+BBF9, U+BC18, U+BC29, U+BC88, U+BD80, U+C0DD, U+C11C, U+C120, U+C18C, U+C2DC, U+C57D, U+C608, U+C74C, U+C774, U+C77C, U+C791, U+C7AC, U+C804, U+C815, U+C8FC, U+C9C0, U+C9C4, U+CC45, U+CC98, U+CCB4, U+CD95, U+CDE8, U+CF1C, U+D130, U+D589, U+D638, U+D654'
const HANGUL = 'U+3130-318F, U+AC00-D7A3'

// The songbook prints its song titles in Roboto Condensed (Google, SIL Open Font License; see
// THIRD-PARTY-NOTICES.md), narrow as a printed songbook's type is, so a long title fits its cell.
// Its Latin and Cyrillic subsets, each fetched only when a title needs it. The lighter weight
// is for a line said beside a title: the artist of a song the ruled line found.
export const BOOK_FAMILY = 'Karaoke Book Condensed'
const BOOK_FILES = [
  [bookLatinUrl, bookLatin400Url, 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD'],
  [bookLatinExtUrl, bookLatinExt400Url, 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF'],
  [bookCyrillicUrl, bookCyrillic400Url, 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116'],
  [bookCyrillicExtUrl, bookCyrillicExt400Url, 'U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F'],
]

let loaded = false
export function loadFaces() {
  if (loaded || typeof FontFace === 'undefined' || !document.fonts) return
  loaded = true
  const make = (url, unicodeRange) => new FontFace(FAMILY, `url(${url}) format("woff2")`, { weight: '400', style: 'normal', display: 'swap', unicodeRange })
  // Where two faces of a family cover a character the later one is used, so the
  // small file goes in last and the keys never ask for the large one.
  document.fonts.add(make(hangulUrl, HANGUL))
  const keys = make(keysUrl, KEYS)
  document.fonts.add(keys)
  keys.load().catch(() => {})
  for (const [medium, regular, unicodeRange] of BOOK_FILES) {
    for (const [url, weight] of [[medium, '500'], [regular, '400']]) {
      document.fonts.add(new FontFace(BOOK_FAMILY, `url(${url}) format("woff2")`, { weight, style: 'normal', display: 'swap', unicodeRange }))
    }
  }
}
