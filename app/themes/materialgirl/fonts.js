import cyrillicExt from './fonts/roboto-flex-cyrillic-ext.woff2?url'
import cyrillic from './fonts/roboto-flex-cyrillic.woff2?url'
import latinExt from './fonts/roboto-flex-latin-ext.woff2?url'
import latin from './fonts/roboto-flex-latin.woff2?url'

// Roboto Flex, Material's own variable face (SIL Open Font License; see THIRD-PARTY-NOTICES.md),
// served by Sonora with the theme. The tokens named it, but nothing loaded it, so every page was
// set in the system's sans. The faces are added through the FontFace API, as
// Hi-Fi's marker is, because an installed theme's stylesheet may name no file. Latin and Cyrillic;
// other scripts fall back to the next face in the stack.
const SUBSETS = [
  [cyrillicExt, 'U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F'],
  [cyrillic, 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116'],
  [latinExt, 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF'],
  [latin, 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD'],
]

let loaded = false
export function loadRobotoFlex() {
  if (loaded || typeof FontFace === 'undefined' || !document.fonts) return
  loaded = true
  for (const [url, unicodeRange] of SUBSETS) {
    const face = new FontFace('Roboto Flex', `url(${url}) format("woff2")`, { weight: '100 1000', style: 'normal', display: 'swap', unicodeRange })
    document.fonts.add(face)
    face.load().catch(() => {})
  }
}
