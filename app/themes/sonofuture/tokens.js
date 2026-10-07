// Sonofuture's design tokens.
//
// Ink-dark grounds with a little blue in them, glass surfaces that let the
// artwork's color through, and one accent that runs from teal to violet.
// The accent is for what is live (the playing room, the active section, the
// play button); everything else stays in grays so the artwork is the color
// on the page. The shared components Sonofuture borrows (the alarm editor,
// the About card, the caution badge) read the generic tokens at the end.
export const tokens = {
  font: '"Inter", "SF Pro Text", "Segoe UI Variable", "Segoe UI", system-ui, -apple-system, Roboto, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace',

  bg: '#0b0e14',
  'bg-raised': '#111621',
  surface: '#161c29',
  'surface-hover': '#1c2434',
  'surface-active': '#222c40',
  glass: 'rgba(17, 22, 33, 0.72)',
  border: 'rgba(148, 163, 184, 0.14)',
  'border-strong': 'rgba(148, 163, 184, 0.3)',

  fg: '#e9edf5',
  'fg-muted': '#98a4b8',
  'fg-dim': '#5c6879',
  'fg-faint': '#5c6879',

  accent: '#4fe3c1',
  'accent-2': '#8b7cf6',
  'accent-fg': '#08111a',
  'accent-dim': '#2aa38b',
  focus: '#7de8d2',

  good: '#4fe3c1',
  fair: '#f5c451',
  poor: '#ff9a62',
  critical: '#ff5d7a',
  info: '#6ea8ff',

  radius: '14px',
  'radius-sm': '9px',
  shadow: '0 18px 50px rgba(0, 0, 0, 0.55)',

  // --- generic tokens the shared components read ------------------------
  'row-selected': 'rgba(79, 227, 193, 0.16)',
  'row-hover': 'rgba(148, 163, 184, 0.08)',
  'row-playing': 'rgba(139, 124, 246, 0.18)',
  'slider-fill': '#4fe3c1',
  'slider-track': 'rgba(148, 163, 184, 0.2)',
  thumb: '#ffffff',
}

// The same controller by daylight. Cool paper grounds with the same little
// blue in them, white surfaces, and the accent taken down a few steps so the
// teal and violet still read as live against white. Only what differs from
// the dark set is listed; the dark set above carries the rest.
export const lightTokens = {
  bg: '#f3f5f9',
  'bg-raised': '#ffffff',
  surface: '#ffffff',
  'surface-hover': '#eef1f6',
  'surface-active': '#e3e8f0',
  glass: 'rgba(255, 255, 255, 0.78)',
  border: 'rgba(71, 85, 105, 0.14)',
  'border-strong': 'rgba(71, 85, 105, 0.28)',

  fg: '#101723',
  'fg-muted': '#4f5b6d',
  'fg-dim': '#77839a',
  'fg-faint': '#77839a',

  accent: '#0c9a81',
  'accent-2': '#6a58e6',
  'accent-fg': '#ffffff',
  'accent-dim': '#0a7a66',
  focus: '#0c9a81',

  good: '#0a8a72',
  fair: '#b27400',
  poor: '#d25a1c',
  critical: '#d92d55',
  info: '#2d6bdc',

  shadow: '0 18px 50px rgba(15, 23, 42, 0.14)',

  'row-selected': 'rgba(12, 154, 129, 0.12)',
  'row-hover': 'rgba(71, 85, 105, 0.07)',
  'row-playing': 'rgba(106, 88, 230, 0.12)',
  'slider-fill': '#0c9a81',
  'slider-track': 'rgba(71, 85, 105, 0.2)',
  thumb: '#ffffff',
}
