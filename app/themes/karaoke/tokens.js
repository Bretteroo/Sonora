// Karaoke Machine's design tokens.
//
// Everything Sonora's shared components draw (the alarm editor, About
// Sonora, the theme chooser, the network map, the upgrade advisor) lands on
// the machine's screen, so the tokens are the screen's: its song-select
// pages' cards, ink, and candy colors. They name karaoke.css's variables
// rather than colors, and follow them into the light and dark versions.
export const tokens = {
  font: '"Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", "Segoe UI", system-ui, sans-serif',
  mono: 'ui-monospace, "DejaVu Sans Mono", Menlo, Consolas, monospace',

  bg: 'var(--km-scr)',
  'bg-raised': 'var(--km-card)',
  surface: 'var(--km-card)',
  'surface-hover': 'var(--km-ph-wash)',
  'surface-active': 'var(--km-ph-wash-strong)',
  glass: 'var(--km-card)',
  border: 'var(--km-ph-line)',
  'border-strong': 'var(--km-ph-dim)',

  fg: 'var(--km-ph)',
  'fg-muted': 'var(--km-ph-dim)',
  'fg-dim': 'var(--km-ph-dim)',
  'fg-faint': 'var(--km-ph-faint)',

  accent: 'var(--km-tok-accent)',
  'accent-2': 'var(--km-ph-dim)',
  'accent-fg': 'var(--km-tok-accent-ink)',
  'accent-dim': 'var(--km-ph-wash-strong)',
  focus: 'var(--km-focus)',

  good: 'var(--km-good)',
  fair: 'var(--km-fair)',
  poor: 'var(--km-poor)',
  critical: 'var(--km-critical)',
  info: 'var(--km-ph)',

  radius: '14px',
  'radius-sm': '10px',
  shadow: '4px 4px 0 var(--km-shade)',

  'row-selected': 'var(--km-sel)',
  'row-hover': 'var(--km-ph-wash)',
  'row-playing': 'var(--km-ph-wash-strong)',
  'slider-fill': 'var(--km-pink)',
  'slider-track': 'var(--km-ph-faint)',
  thumb: 'var(--km-hi)',
}
