// Outrun's design tokens.
//
// Deep indigo grounds under a synthwave sunset, with neon magenta and cyan
// for edges and selection and a sunset orange-to-yellow for the sun. Status
// colors stay apart for the common forms of color blindness (cyan good,
// yellow fair, orange poor, hot pink critical), which Troubleshoot depends on.
// The theme wears the desktop application's components, so it also supplies
// every token those read, mapped into the same range.
export const tokens = {
  font: '"Segoe UI", system-ui, -apple-system, Roboto, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace',

  magenta: '#ff2bd6', pink: '#ff6ec7', cyan: '#19e6ff', electric: '#3b8bff', purple: '#7b2cff',
  sunset: '#ff7b3a', sun: '#ffd23f',

  bg: '#0b0621',
  'bg-raised': '#160a33',
  surface: '#160a33',
  'surface-hover': '#1e0f45',
  'surface-active': '#23104d',
  border: 'rgba(25, 230, 255, 0.35)',
  'border-strong': '#19e6ff',

  fg: '#e9e6ff',
  'fg-muted': '#a99ad6',
  'fg-dim': '#6f5fa3',
  'fg-faint': '#6f5fa3',

  accent: '#ff2bd6',
  'accent-fg': '#ffffff',
  'accent-dim': '#7b2cff',
  focus: '#19e6ff',

  good: '#19e6ff',
  fair: '#ffd23f',
  poor: '#ff7b3a',
  critical: '#ff2bd6',
  info: '#3b8bff',

  radius: '6px',
  'radius-sm': '4px',
  shadow: '0 12px 30px rgba(0, 0, 0, 0.6)',

  // --- what the shared desktop components read ---------------------------
  'header-top': '#ff2bd6',
  'header-bottom': '#7b2cff',
  'header-rule': '#7b2cff',
  tile: '#160a33',
  'tile-edge': 'rgba(25, 230, 255, 0.45)',
  'tile-selected': '#3a1470',
  'tile-selected-edge': '#ff2bd6',
  'tile-hover': '#1e0f45',
  'tile-hover-edge': '#19e6ff',
  'row-selected': 'rgba(255, 43, 214, 0.28)',
  'row-selected-edge': '#ff2bd6',
  'row-hover': 'rgba(25, 230, 255, 0.1)',
  'row-playing': 'rgba(59, 139, 255, 0.22)',
  'slider-fill': '#ff2bd6',
  'slider-track': 'rgba(233, 230, 255, 0.14)',
  thumb: '#ff2bd6',
  'strip-top': '#160a33',
  'strip-mid': '#120832',
  'strip-bottom': '#0f0727',
  'menubar-bg': '#120832',
  'menubar-fg': '#19e6ff',
  'menu-bg': '#160a33',
  'menu-hover': '#ff2bd6',
  'menu-border': '#ff2bd6',
  'win-titlebar': '#2a0f5e',
  'win-titlebar-fg': '#ffffff',
  'win-titlebar-border': '#ff2bd6',
  'win-menubar-bg': '#120832',
  'win-menubar-fg': '#19e6ff',
  'win-menu-bg': '#160a33',
  'win-menu-border': '#ff2bd6',
  'win-menu-hover': '#ff2bd6',
  'win-menu-hover-fg': '#ffffff',
  'win-close-hover': '#ff2bd6',
  'win-btn-hover': 'rgba(25, 230, 255, 0.14)',
}
