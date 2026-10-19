import vtLatin from './fonts/vt323-latin.woff2?url'
import vtLatinExt from './fonts/vt323-latin-ext.woff2?url'
import mxLatin from './fonts/michroma-latin.woff2?url'
import mxLatinExt from './fonts/michroma-latin-ext.woff2?url'

// The two faces Severed is set in, both under the SIL Open Font License (see
// THIRD-PARTY-NOTICES.md) and served by Sonora with the theme: VT323, a
// terminal's bitmap face, for everything on the screen, and Michroma, a wide
// grotesque, for what is printed on the plastic. Added through the FontFace
// API, as Material Girl's and Hi-Fi's are, because an installed theme's
// stylesheet may name no file. Other scripts fall back along each stack.
const LATIN = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD'
const LATIN_EXT = 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF'
const FACES = [
  ['Severed Screen', vtLatinExt, LATIN_EXT],
  ['Severed Screen', vtLatin, LATIN],
  ['Severed Panel', mxLatinExt, LATIN_EXT],
  ['Severed Panel', mxLatin, LATIN],
]

let loaded = false
export function loadFaces() {
  if (loaded || typeof FontFace === 'undefined' || !document.fonts) return
  loaded = true
  for (const [family, url, unicodeRange] of FACES) {
    const face = new FontFace(family, `url(${url}) format("woff2")`, { weight: '400', style: 'normal', display: 'swap', unicodeRange })
    document.fonts.add(face)
    face.load().catch(() => {})
  }
}
