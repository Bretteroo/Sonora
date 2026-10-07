// Theme registry.
//
// The themes live here, at the repository's own `themes/`, rather than inside
// the frontend's source tree: a theme is a thing of Sonora's, and a folder
// here is the whole of one -- shell, styles, tokens, thumbnail, and words.
//
// Each entry supplies its own Shell, so a theme can restructure the entire
// interface rather than only restyling a fixed layout. Sonora has no shell of
// its own and keeps no list of shells: a shell belongs to the theme that
// brings it. Several themes here carry a copy of one that started somewhere
// else -- the five desktop skins each have their own copy of the S1 window,
// Liquid Glass its own copy of the rail -- and a copy is all it is. Nothing
// in this directory imports across theme folders, so any one theme can be
// removed and the rest keep building and drawing.
//
// A package cannot import anything, so it brings a layout instead and Sonora
// draws that; it never borrows a shell from a theme here. Tokens are published
// as CSS custom properties by the theming engine and are available to any
// shared component a theme chooses to reuse.
//
// Everything a theme owns is in its folder: its shell, its stylesheet, its
// tokens, its thumbnail, and its words. A theme that says anything of its own
// carries `strings.js` -- the three languages in one file -- and names it in
// its manifest; the i18n layer lays it over Sonora's catalog while that theme
// is the chosen one. Sonora's catalog keeps what the shared components and the
// shared browse parts render in every theme, and nothing that only one theme
// says (Outrun's and Sedona's labels had been sitting in en.js).

import coromar from './coromar/index.jsx'
import sonofuture from './sonofuture/index.jsx'
import liquidglass from './liquidglass/index.jsx'
import outrun from './outrun/index.jsx'
import sedona from './sedona/index.jsx'
import web from './web/index.jsx'
import macos from './macos/index.jsx'
import windows from './windows/index.jsx'
import hotdog from './hotdog/index.jsx'
import solarized from './solarized/index.jsx'
import materialgirl from './materialgirl/index.jsx'
import hifi from './hifi/index.jsx'

export const THEMES = {
  [coromar.id]: coromar,
  [sonofuture.id]: sonofuture,
  [liquidglass.id]: liquidglass,
  [web.id]: web,
  [macos.id]: macos,
  [windows.id]: windows,
  [outrun.id]: outrun,
  [sedona.id]: sedona,
  [hotdog.id]: hotdog,
  [solarized.id]: solarized,
  [materialgirl.id]: materialgirl,
  [hifi.id]: hifi,
}

export const DEFAULT_THEME = coromar.id
