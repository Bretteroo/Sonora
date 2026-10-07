// Sedona's design tokens.
//
// Read top to bottom, the palette is a desert section: sky, then haze at the
// horizon, then the exposed rock below it, then the sand and dirt it sits on.
// The theme wears the desktop application's own components (panes, tiles,
// rows, dialogs, the Mini Controller), so beneath the desert vocabulary it
// also supplies every token those components read, mapped into the same
// range: sand for grounds and panels, rock for headers and emphasis, sky for
// the frame overhead.

export const tokens = {
  font: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
  'font-ui': 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  mono: 'ui-monospace, "SF Mono", Menlo, monospace',

  // sky
  'sky-zenith': '#2c6b9e',
  'sky-mid': '#5d9cc6',
  'sky-haze': '#a9cbdd',
  sun: '#f0b73f',
  'sun-deep': '#dd9520',

  // rock, in the order a cliff face exposes it
  'rock-cap': '#c9873f',
  'rock-red': '#a83f2c',
  'rock-red-light': '#c25c40',
  rust: '#b0663a',
  ochre: '#cc9a4a',
  'rock-shadow': '#7a3524',

  // ground
  sand: '#e7d9bf',
  'sand-light': '#f4ecdc',
  'sand-dark': '#d4c3a3',
  dirt: '#6d4b32',
  'dirt-dark': '#46301f',

  // ink and structure
  ink: '#2f1e13',
  'ink-muted': '#6b5340',
  'ink-faint': '#95816c',
  'border-strong': '#a8906c',

  // status, kept inside the desert range so nothing reads as a web alert:
  // a healthy reading is the calm blue of open sky, a problem the red of
  // exposed rock, which also keeps them apart for the common forms of
  // color blindness.
  good: '#3f7fa8',
  fair: '#cc9a4a',
  poor: '#c2703a',
  critical: '#a83f2c',

  shadow: '0 10px 24px rgba(70, 48, 31, 0.22)',
  'shadow-inset': 'inset 0 1px 0 rgba(255, 248, 235, 0.5)',

  // --- what the shared desktop components read ---------------------------
  bg: '#e7d9bf',
  fg: '#2f1e13',
  'fg-muted': '#6b5340',
  'fg-dim': '#95816c',
  surface: '#f4ecdc',
  'surface-hover': '#efe2c8',
  'surface-active': '#e2d2b3',
  border: '#c9b491',
  accent: '#b0663a',
  'accent-fg': '#f4ecdc',
  focus: '#a83f2c',
  // pane headers: exposed rock with the caprock band along the top
  'header-top': '#c25c40',
  'header-bottom': '#a83f2c',
  'header-rule': '#7a3524',
  // room tiles are boulders of sand
  tile: '#f4ecdc',
  'tile-edge': '#d4c3a3',
  'tile-selected': '#fbf6ea',
  'tile-selected-edge': '#a83f2c',
  'tile-hover': '#f8f1e2',
  'tile-hover-edge': '#cc9a4a',
  // list rows
  'row-selected': '#e6cfa0',
  'row-selected-edge': '#cc9a4a',
  'row-hover': 'rgba(204, 154, 74, 0.18)',
  'row-playing': 'rgba(176, 102, 58, 0.16)',
  // sliders
  'slider-fill': '#a83f2c',
  'slider-track': 'rgba(70, 48, 31, 0.18)',
  thumb: '#b0663a',
  info: '#3f7fa8',
  // the transport strip is the haze band between sky and ground
  'strip-top': '#f4ecdc',
  'strip-mid': '#e7d9bf',
  'strip-bottom': '#d4c3a3',
  // menus: dirt under the sky, sand panels when open
  'menubar-bg': '#6d4b32',
  'menubar-fg': '#f4ecdc',
  'menu-bg': '#f4ecdc',
  'menu-hover': '#e6cfa0',
  'menu-border': '#a8906c',
  'win-titlebar': '#5d9cc6',
  'win-titlebar-fg': '#f6f1e6',
  'win-titlebar-border': '#2c6b9e',
  'win-menubar-bg': '#6d4b32',
  'win-menubar-fg': '#f4ecdc',
  'win-menu-bg': '#f4ecdc',
  'win-menu-border': '#a8906c',
  'win-menu-hover': '#e6cfa0',
  'win-menu-hover-fg': '#2f1e13',
  'win-close-hover': '#a83f2c',
  'win-btn-hover': 'rgba(47, 30, 19, 0.1)',
}
