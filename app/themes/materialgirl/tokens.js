// Material Girl's design tokens.
//
// The color scheme is a Material 3 tonal scheme built in mg.css: every role
// (primary, its container, the surface containers from lowest to highest,
// outline, and the rest) is an OKLCH color whose lightness is fixed by the
// role's tone and whose hue follows --mg-h, the seed. The seed is
// Material's own baseline violet (#6750A4) until the playing artwork offers a
// hue of its own (color.js). Light and dark are the same roles at different
// tones, keyed on the variant.
//
// The tokens below hand those roles to the shared components (the alarm
// editor, About Sonora, the theme chooser), so they wear the scheme too.
// Both variants read the same names; mg.css decides what each resolves to.
export const tokens = {
  font: '"Google Sans Flex", "Google Sans", "Roboto Flex", Roboto, "Segoe UI Variable", "Segoe UI", system-ui, -apple-system, sans-serif',
  mono: '"Roboto Mono", "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace',

  bg: 'var(--mg-surface)',
  'bg-raised': 'var(--mg-surface-container)',
  surface: 'var(--mg-surface-container-low)',
  'surface-hover': 'var(--mg-surface-container-high)',
  'surface-active': 'var(--mg-secondary-container)',
  glass: 'var(--mg-surface-container)',
  border: 'var(--mg-outline-variant)',
  'border-strong': 'var(--mg-outline)',

  fg: 'var(--mg-on-surface)',
  'fg-muted': 'var(--mg-on-surface-variant)',
  'fg-dim': 'var(--mg-on-surface-variant)',
  'fg-faint': 'var(--mg-on-surface-variant)',

  accent: 'var(--mg-primary)',
  'accent-2': 'var(--mg-tertiary)',
  'accent-fg': 'var(--mg-on-primary)',
  'accent-dim': 'var(--mg-primary-container)',
  focus: 'var(--mg-primary)',

  good: 'var(--mg-good)',
  fair: 'var(--mg-fair)',
  poor: 'var(--mg-poor)',
  critical: 'var(--mg-error)',
  info: 'var(--mg-info)',

  radius: '16px',
  'radius-sm': '12px',
  shadow: '0 2px 6px 2px var(--mg-shadow-15), 0 1px 2px var(--mg-shadow-30)',

  // --- generic tokens the shared components read ------------------------
  'row-selected': 'var(--mg-secondary-container)',
  'row-hover': 'var(--mg-hover)',
  'row-playing': 'var(--mg-tertiary-container)',
  'slider-fill': 'var(--mg-primary)',
  'slider-track': 'var(--mg-secondary-container)',
  thumb: 'var(--mg-primary)',
}
