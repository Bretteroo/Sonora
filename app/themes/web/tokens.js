// Tokens measured from the official web controller rather than guessed.
//
// Captured at a 1440px viewport and confirmed by sampling pixels out of a
// screenshot of the running product, which corrected an earlier reading: room
// cards are rgb(47,48,50), not the rgb(71,74,77) an earlier DOM walk reported
// after climbing to the wrong element. Page, header and transport bar are all
// pure black. Search pill rgb(54,57,58). Header 76px, transport bar 84px,
// sidebar 420px.
//
// Sonos sets `aktiv-grotesk` and declares `Helvetica, Arial, sans-serif` as its
// own fallbacks. Aktiv Grotesk is licensed, so this uses that declared
// fallback chain: the same shapes the majority of their users already see,
// without redistributing a font we have no right to.

export const tokens = {
  // Sonos declares `aktiv-grotesk, Helvetica, Arial, sans-serif`. Dropping
  // only the licensed first entry leaves the identical fallback chain, so the
  // rendered result matches on any machine without Aktiv Grotesk installed.
  font: 'Helvetica, Arial, sans-serif',

  bg: '#000000',
  'bg-elevated': '#111315',
  // A room card's fill is how the product marks the active room: inactive
  // cards are #2f3032 and the active one is #474a4d. Confirmed by sampling
  // two captures in which different rooms were active, which also resolved an
  // earlier contradiction between two DOM readings.
  surface: '#2f3032',
  // A service's page: the panel a browse column becomes (measured 2026-09-14).
  'surface-panel': '#222426',
  'surface-active': '#474a4d',
  'surface-hover': '#3a3b3e',
  'surface-input': '#36393a',
  'surface-sunken': '#1c1e20',
  // The gray a menu is drawn on, and the ground of an empty art square in a
  // tile: rgb(54,57,58) in both places (measured 2026-09-22). It had only
  // ever been a fallback inside the stylesheet.
  'surface-raised': '#36393a',
  // Unfilled slider rail, measured off the product.
  rail: '#3b3e40',
  // Empty album-art square on a room card: a lighter gray than the sunken
  // surface, with a near-white glyph. Measured, not guessed.
  'art-bg': '#3b3e40',
  'art-fg': '#e1e7ef',
  // On the active (lighter) card the art square lightens with it. Sampled
  // from rendered pixels, not computed styles.
  'art-bg-active': '#53575a',
  // The play control on a room card sits on its own disc.
  disc: '#36393a',
  'disc-active': '#53575a',
  // The volume readout is dimmer than body text.
  'num-fg': '#9fa2a8',
  // Disabled controls dim to this rather than fading by opacity.
  'fg-disabled': '#333333',
  border: '#2c2f32',

  fg: '#ffffff',
  'fg-muted': '#9fa3a8',
  'fg-faint': '#71767c',

  accent: '#ffffff',
  'accent-fg': '#000000',
  focus: '#7fb2ff',

  good: '#4cc2a8',
  fair: '#e0a53f',
  poor: '#e8743f',
  critical: '#e05263',

  'radius-card': '24px',
  'radius-tile': 'clamp(8px, 8%, 16px)',
  'header-h': '76px',
  'transport-h': '84px',
  'sidebar-w': '420px',
}
