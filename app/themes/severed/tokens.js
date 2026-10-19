// Severed's design tokens.
//
// Everything Sonora's shared components draw (the alarm editor, About
// Sonora, the theme chooser, the network map, the upgrade advisor) lands on
// the console's screen, so the tokens are the screen's: phosphor on a dark
// tube. The phosphor's color is a setting of the theme's own, so the tokens
// name severed.css's variables rather than colors, and follow it. Light and
// dark change the plastic of the console, never the screen: a cathode-ray
// tube is dark either way, which is why both variants keep the dark scheme.
export const tokens = {
  font: '"Severed Screen", "VT323", "Courier New", ui-monospace, monospace',
  mono: '"Severed Screen", "VT323", "Courier New", ui-monospace, monospace',

  bg: 'var(--sv-scr)',
  'bg-raised': 'var(--sv-scr-raised)',
  surface: 'var(--sv-scr-raised)',
  'surface-hover': 'var(--sv-ph-wash)',
  'surface-active': 'var(--sv-ph-wash-strong)',
  glass: 'var(--sv-scr-raised)',
  border: 'var(--sv-ph-line)',
  'border-strong': 'var(--sv-ph-dim)',

  fg: 'var(--sv-ph)',
  'fg-muted': 'var(--sv-ph-dim)',
  'fg-dim': 'var(--sv-ph-dim)',
  'fg-faint': 'var(--sv-ph-faint)',

  accent: 'var(--sv-ph)',
  'accent-2': 'var(--sv-ph-dim)',
  'accent-fg': 'var(--sv-scr)',
  'accent-dim': 'var(--sv-ph-wash-strong)',
  focus: 'var(--sv-ph)',

  good: 'var(--sv-good)',
  fair: 'var(--sv-fair)',
  poor: 'var(--sv-poor)',
  critical: 'var(--sv-critical)',
  info: 'var(--sv-ph)',

  radius: '2px',
  'radius-sm': '0px',
  shadow: '0 0 0 1px var(--sv-ph-line)',

  'row-selected': 'var(--sv-ph-wash-strong)',
  'row-hover': 'var(--sv-ph-wash)',
  'row-playing': 'var(--sv-ph-wash-strong)',
  'slider-fill': 'var(--sv-ph)',
  'slider-track': 'var(--sv-ph-faint)',
  thumb: 'var(--sv-ph)',
}
