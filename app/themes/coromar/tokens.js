// Coromar's design tokens, read off a photograph of the building the theme is
// named for: the Sonos headquarters at 301 Coromar Drive, Goleta.
//
// The exterior is tilt-up concrete painted a warm off-white, scored by panel
// reveals and inset with small gray accent panels; deep navy vision glass in a
// grid of aluminium mullions, two storeys of it wrapping the corner; stacked
// sandstone veneer on the piers at the entry; a white steel trellis over the
// walkway; and a cobalt sky above it all. Every color below was sampled from
// that photograph. Grounds are concrete, chrome is glass, and whatever is
// chosen or playing turns to glass as well.
export const tokens = {
  font: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace',

  // --- the materials, as sampled ----------------------------------------
  concrete: '#fbfbf8', 'concrete-field': '#eeeee9', 'concrete-shade': '#dcdcd6',
  reveal: '#cdd0cb', 'reveal-deep': '#a9ada7', 'panel-gray': '#a8b0b2',
  glass: '#0c3f55', 'glass-deep': '#082e3f', 'glass-lit': '#0f5f7f',
  'glass-sky': '#8aa8bd', mullion: '#c9d1d2', 'mullion-bright': '#e8edec',
  sky: '#5b8fd4', 'sky-low': '#83b8e2', signage: '#2162b0',
  taupe: '#d9d2c4', 'taupe-deep': '#bdb4a2',
  sandstone: '#a89573', 'sandstone-deep': '#7f7861',
  bark: '#80624c', sand: '#dbcfb4', olive: '#54625b', agave: '#7a8d4f',
  ada: '#fedd66', rose: '#ad8d97',

  bg: '#e8e8e2',
  'bg-raised': '#f1f1ec',
  surface: '#fbfbf8',
  'surface-hover': '#f3f4f0',
  'surface-active': '#e6e8e3',
  border: '#cdd0cb',
  'border-strong': '#a9ada7',

  fg: '#1b2a31',
  'fg-muted': '#556670',
  'fg-dim': '#7d868e',
  'fg-faint': '#9aa2a9',

  accent: '#0f5f7f',
  'accent-fg': '#f4fafc',
  'accent-dim': '#0c3f55',
  focus: '#2162b0',

  good: '#5b7a45',
  fair: '#9a7412',
  poor: '#b06a34',
  critical: '#a2413c',
  info: '#0f5f7f',

  // Panel corners, mullion joints and reveals are all square on the
  // building, so the radii here are barely there.
  radius: '4px',
  'radius-sm': '2px',
  shadow: '0 1px 2px rgba(12, 44, 58, 0.10), 0 10px 24px rgba(12, 44, 58, 0.12)',
  glow: '0 0 0 1px rgba(15, 95, 127, 0.5), 0 0 0 4px rgba(91, 143, 212, 0.16)',

  // --- what the shared desktop components read ---------------------------
  'header-top': '#f7f7f4',
  'header-bottom': '#edeee9',
  'header-rule': '#cdd0cb',
  tile: '#fbfbf8',
  'tile-edge': '#cdd0cb',
  'tile-selected': '#0c3f55',
  'tile-selected-edge': '#0f5f7f',
  'tile-hover': '#f3f5f7',
  'tile-hover-edge': '#a9ada7',
  'row-selected': 'rgba(15, 95, 127, 0.16)',
  'row-selected-edge': '#0f5f7f',
  'row-hover': 'rgba(12, 44, 58, 0.05)',
  'row-playing': 'rgba(91, 143, 212, 0.13)',
  'slider-fill': '#0f5f7f',
  'slider-track': 'rgba(12, 44, 58, 0.16)',
  thumb: '#a9ada7',
  'strip-top': '#12556f',
  'strip-mid': '#0e4760',
  'strip-bottom': '#0a3448',
  'menubar-bg': '#f1f1ec',
  'menubar-fg': '#1e2a38',
  'menu-bg': '#fbfbf8',
  'menu-hover': '#0f5f7f',
  'menu-border': '#a9ada7',
  'win-titlebar': '#0c3f55',
  'win-titlebar-fg': '#eaf1f6',
  'win-titlebar-border': '#a9ada7',
  'win-menubar-bg': '#f1f1ec',
  'win-menubar-fg': '#1e2a38',
  'win-menu-bg': '#fbfbf8',
  'win-menu-border': '#a9ada7',
  'win-menu-hover': '#0f5f7f',
  'win-menu-hover-fg': '#ffffff',
  'win-close-hover': '#a2413c',
  'win-btn-hover': 'rgba(18, 38, 63, 0.08)',
}
