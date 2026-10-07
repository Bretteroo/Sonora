// Palette of the S1 desktop controller as it runs on macOS Tahoe, read off
// the application itself on 2026-09-15 (see THEMES.md, "Sonos macOS
// Desktop"). The navy the theme used to wear came from image tiles still in
// the bundle that the application no longer draws with: on screen it is
// black chrome, #1a1a1a panes, #262626 headers, a white selected room tile.
// Every value here was read from a pixel; nothing is a guess except where
// the comment says so.
export const tokens = {
  // Pane and window grounds. The tiles only show what sits on top of them,
  // so the ground itself is the one value chosen rather than sampled: dark
  // enough that the #262626 browse chrome and the navy tiles both read.
  bg: '#1a1a1a',
  fg: '#ffffff',
  'fg-muted': '#838383',
  'fg-dim': '#5a5a5a',
  surface: '#262626',
  'surface-hover': '#444444',
  'surface-active': '#333333',
  border: '#0a0a0a',
  accent: '#0e568d',
  'accent-fg': '#ffffff',
  // Header bars: a 32px navy gradient with a black rule and a lighter line.
  'header-top': '#262626',
  'header-bottom': '#262626',
  'header-rule': '#262626',
  // Room tiles.
  'tile': '#262626',
  'tile-edge': '#262626',
  'tile-selected': '#ffffff',
  'tile-selected-edge': '#ffffff',
  'tile-hover': '#444444',
  'tile-hover-edge': '#444444',
  // List rows.
  'row-selected': '#333333',
  'row-selected-edge': '#333333',
  'row-hover': '#262626',
  'row-playing': '#262626',
  // Sliders.
  'slider-fill': '#ffffff',
  'slider-track': '#313131',
  'thumb': '#333333',
  // The blue used for the empty-queue message.
  'info': '#277ac5',
  // Transport strip gradient (from the transport background tiles).
  'strip-top': '#0a0a0a',
  'strip-mid': '#0a0a0a',
  'strip-bottom': '#0a0a0a',
  // Mac chrome around the application: the system menu bar and menus.
  'menubar-bg': '#dadada',
  'menubar-fg': '#000000',
  'menu-bg': 'rgba(219, 219, 219, 0.96)',
  'menu-hover': '#2f6fe3',
  'menu-border': 'rgba(0, 0, 0, 0.18)',
}
