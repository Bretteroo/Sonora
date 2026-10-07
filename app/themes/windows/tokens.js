// The Windows S1 controller shares the application's dark content chrome with
// the Mac build -- same tiles, panes and transport strip -- so it carries the
// same values. They are written out here rather than imported from the Mac
// theme: a theme is a self-contained thing, and one that reads another
// theme's palette stops working the moment that theme is not there.
// Palette of the S1 desktop controller as it runs on macOS Tahoe, read off
// the application itself on 2026-09-15 (see THEMES.md, "Sonos macOS
// Desktop"). The navy the theme used to wear came from image tiles still in
// the bundle that the application no longer draws with: on screen it is
// black chrome, #1a1a1a panes, #262626 headers, a white selected room tile.
// Every value here was read from a pixel; nothing is a guess except where
// the comment says so.
const shared = {
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

export const tokens = {
  ...shared,
  // The Windows S1 controller is not the Mac's navy: its content chrome is
  // grays on near-black, read from the application's own theme resources
  // (MainBackgroundBrush #0A0A0A, PanelBackgroundBrush #1A1A1A,
  // HeaderBackgroundBrush #262626, BaseHighlightBrush #3399FF) and from the
  // colors its skin bitmaps paint (room tiles #262626 / hover #333333 /
  // selected #FFFFFF; browse rows hover #262626, playing #222222; the
  // transport strip's #6F6F6F -> #0F0F0F gradient).
  bg: '#0a0a0a',
  surface: '#1a1a1a',
  'surface-hover': '#333333',
  'surface-active': '#222222',
  border: '#0a0a0a',
  accent: '#3399ff',
  'header-top': '#262626',
  'header-bottom': '#262626',
  'header-rule': '#262626',
  tile: '#262626',
  'tile-edge': '#262626',
  'tile-hover': '#333333',
  'tile-hover-edge': '#333333',
  'tile-selected': '#ffffff',
  'tile-selected-edge': '#ffffff',
  'row-selected': '#222222',
  'row-selected-edge': '#222222',
  'row-hover': '#262626',
  'row-playing': '#222222',
  info: '#3399ff',
  'strip-top': '#6f6f6f',
  'strip-mid': '#2c2c2c',
  'strip-bottom': '#0f0f0f',
  // Windows window frame as captured: a light title bar over a dark menu
  // bar with white text, rather than the Mac's gray strip and system menu.
  'win-titlebar': '#f3f3f3',
  'win-titlebar-fg': '#1a1a1a',
  'win-titlebar-border': '#d0d0d0',
  'win-menubar-bg': '#0a0a0a',
  'win-menubar-fg': '#ffffff',
  'win-menu-bg': '#ffffff',
  'win-menu-border': '#a0a0a0',
  'win-menu-hover': '#cde3fb',
  'win-menu-hover-fg': '#000000',
  // The Windows 10 close-button red.
  // Windows 11 caption colors, read off the S1 app's title bar (2026-09-14):
  // #e9e9e9 under the pointer and #ededed while pressed on the light bar;
  // Close goes #c42b1c, then #c84031 pressed, with a white glyph.
  'win-close-hover': '#c42b1c',
  'win-close-active': '#c84031',
  'win-btn-hover': '#e9e9e9',
  'win-btn-active': '#ededed',
}
