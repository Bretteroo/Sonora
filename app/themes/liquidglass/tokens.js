// Liquid Glass: Apple's material, as design tokens.
//
// The palette is Apple's system colors (blue, indigo, green, orange, red)
// over a light ground, because the material only reads as glass when there is
// color behind it to bend. Surfaces are deliberately translucent here rather
// than solid: the stylesheet layers a blur and a specular rim on top, and a
// token that was opaque would flatten the effect.
//
// Both ways up are declared. The dark set used to live in the stylesheet
// under prefers-color-scheme, which meant the material followed the operating
// system and the Light/Dark/System setting did nothing here -- and, because
// the chooser draws its three buttons from a theme's declared variants, no
// buttons were drawn either. Declared, the setting
// works and System still follows the operating system, which is what the
// material wants when nobody has said otherwise.
export const tokens = {
  font: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", system-ui, sans-serif',
  mono: 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace',

  bg: '#eef1f6',
  'bg-raised': 'rgba(255, 255, 255, 0.72)',
  surface: 'rgba(255, 255, 255, 0.6)',
  'surface-hover': 'rgba(255, 255, 255, 0.78)',
  'surface-active': 'rgba(255, 255, 255, 0.92)',
  glass: 'rgba(255, 255, 255, 0.62)',
  border: 'rgba(255, 255, 255, 0.55)',
  'border-strong': 'rgba(120, 130, 150, 0.28)',

  fg: '#12141a',
  'fg-muted': 'rgba(24, 28, 38, 0.62)',
  'fg-dim': 'rgba(24, 28, 38, 0.42)',
  'fg-faint': 'rgba(24, 28, 38, 0.42)',

  accent: '#007aff',
  'accent-2': '#5e5ce6',
  'accent-fg': '#ffffff',
  'accent-dim': '#0060df',
  focus: '#007aff',

  good: '#28a745',
  fair: '#c47f00',
  poor: '#e06c00',
  critical: '#e02f28',
  info: '#007aff',

  radius: '22px',
  'radius-sm': '14px',
  shadow: '0 24px 60px rgba(16, 24, 40, 0.22)',

  'row-selected': 'rgba(0, 122, 255, 0.14)',
  'row-hover': 'rgba(120, 130, 150, 0.1)',
  'row-playing': 'rgba(94, 92, 230, 0.14)',
  'slider-fill': '#007aff',
  'slider-track': 'rgba(120, 130, 150, 0.24)',
  thumb: '#ffffff',
}

// The same material lit from a darker room. Only what differs is listed; the
// light set above carries the rest. The --lg-* and --sf-* variables the glass
// itself is built from are not design tokens and stay in the stylesheet,
// keyed on :root[data-theme='liquidglass'][data-variant='dark'].
export const darkTokens = {
  'bg': '#0b0d12',
  'bg-raised': 'rgba(46, 48, 58, 0.78)',
  'surface': 'rgba(38, 40, 48, 0.6)',
  'surface-hover': 'rgba(52, 54, 64, 0.72)',
  'surface-active': 'rgba(64, 66, 78, 0.85)',
  'glass': 'rgba(28, 30, 38, 0.64)',
  'border': 'rgba(255, 255, 255, 0.14)',
  'border-strong': 'rgba(255, 255, 255, 0.26)',
  'fg': '#f2f3f7',
  'fg-muted': 'rgba(242, 243, 247, 0.66)',
  'fg-dim': 'rgba(242, 243, 247, 0.44)',
  'fg-faint': 'rgba(242, 243, 247, 0.44)',
  'accent': '#0a84ff',
  'accent-2': '#6e6bff',
  'accent-dim': '#0a84ff',
  'focus': '#0a84ff',
  'good': '#30d158',
  'fair': '#ffd60a',
  'poor': '#ff9f0a',
  'critical': '#ff453a',
  'info': '#0a84ff',
  'row-selected': 'rgba(10, 132, 255, 0.22)',
  'row-hover': 'rgba(255, 255, 255, 0.08)',
  'row-playing': 'rgba(110, 107, 255, 0.22)',
  'slider-track': 'rgba(255, 255, 255, 0.2)',
  'shadow': '0 30px 80px rgba(0, 0, 0, 0.6)',
}
