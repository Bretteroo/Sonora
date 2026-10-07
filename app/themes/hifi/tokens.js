// Hi-Fi's design tokens.
//
// Two finishes of the same equipment. The dark one is black anodized
// aluminum with engraved warm-white legends and an amber vacuum-fluorescent
// display; the light one is brushed silver with dark legends and a pale,
// backlit liquid-crystal display. The accent is the display's own color,
// because on a component the only thing that glows is what is live: the
// display, the lit key, the LED over the selected zone.
//
// The materials themselves (the faceplate gradients, the display glass, the
// wood of the cheeks) are not design tokens; they live in hifi.css keyed on
// :root[data-theme='hifi'][data-variant=...]. What is here is what the shared
// panels read -- the alarm editor, About, the upgrade advisor, the network
// map -- so they sit in the rack in its own colors.
export const tokens = {
  font: '"Helvetica Neue", "Nimbus Sans", "Liberation Sans", Arial, "Segoe UI", system-ui, sans-serif',
  mono: '"DejaVu Sans Mono", "Menlo", "Consolas", "Liberation Mono", ui-monospace, monospace',

  bg: '#0c0b0a',
  'bg-raised': '#1d1d20',
  surface: '#1c1c1f',
  'surface-hover': '#26262a',
  'surface-active': '#303035',
  border: 'rgba(255, 255, 255, 0.1)',
  'border-strong': 'rgba(255, 255, 255, 0.22)',

  fg: '#ebe6dc',
  'fg-muted': '#aaa397',
  'fg-dim': '#7f796f',
  'fg-faint': '#7f796f',

  accent: '#ffb23e',
  'accent-2': '#ff7b1c',
  'accent-fg': '#1b1206',
  'accent-dim': '#c7862a',
  focus: '#ffc867',

  good: '#72e06a',
  fair: '#ffce4a',
  poor: '#ff8b3d',
  critical: '#ff5040',
  info: '#79b8ff',

  radius: '5px',
  'radius-sm': '3px',
  shadow: '0 22px 50px rgba(0, 0, 0, 0.62)',

  // --- generic tokens the shared components read ------------------------
  'row-selected': 'rgba(255, 178, 62, 0.15)',
  'row-hover': 'rgba(255, 255, 255, 0.05)',
  'row-playing': 'rgba(255, 178, 62, 0.1)',
  'slider-fill': '#ffb23e',
  'slider-track': 'rgba(255, 255, 255, 0.14)',
  thumb: '#dedad2',
}

// Brushed silver by daylight. Only what differs from the black finish is
// listed; the set above carries the rest.
export const lightTokens = {
  bg: '#c9c6bf',
  'bg-raised': '#eeece7',
  surface: '#f3f1ec',
  'surface-hover': '#e7e4dd',
  'surface-active': '#dcd8cf',
  border: 'rgba(40, 36, 30, 0.16)',
  'border-strong': 'rgba(40, 36, 30, 0.32)',

  fg: '#1f1d19',
  'fg-muted': '#56514a',
  'fg-dim': '#77716a',
  'fg-faint': '#77716a',

  accent: '#b4561a',
  'accent-2': '#8f3f0e',
  'accent-fg': '#ffffff',
  'accent-dim': '#8f4515',
  focus: '#b4561a',

  good: '#2f8a2a',
  fair: '#a26a00',
  poor: '#c2511a',
  critical: '#c5261d',
  info: '#2562b8',

  shadow: '0 18px 44px rgba(30, 26, 20, 0.28)',

  'row-selected': 'rgba(180, 86, 26, 0.13)',
  'row-hover': 'rgba(40, 36, 30, 0.06)',
  'row-playing': 'rgba(180, 86, 26, 0.09)',
  'slider-fill': '#b4561a',
  'slider-track': 'rgba(40, 36, 30, 0.2)',
  thumb: '#ffffff',
}
