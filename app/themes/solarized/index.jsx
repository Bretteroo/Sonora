import React from 'react'
import { Shell as DesktopShell } from './DesktopShell.jsx'
import { tokens, lightTokens } from './tokens.js'
import './solarized.css'
import thumbnail from './thumbnail.webp'
import lightThumbnail from './thumbnail-light.webp'

// Solarized: the desktop controller in Ethan Schoonover's palette, either way
// up. Dark is base03 ground, base02 panels and base0 text; light lays the
// same palette the other way, base3 and base2 under base00. Blue is
// selection in both.
//
// The dialogs are the light half whichever way the application is worn --
// base3 on base2 -- because the two halves of the scheme are meant to sit
// together, and that is the one thing about this theme that does not follow
// the Appearance setting.

function Shell() {
  return <DesktopShell rootClass="sz-root" />
}

export default {
  id: 'solarized',
  name: 'Solarized',
  version: '1.0.0',
  thumbnail,
  description:
    'The desktop controller in Ethan Schoonover\u2019s Solarized palette, light '
    + 'or dark as you choose, with blue for selection. Its windows and dialogs '
    + 'follow the half you choose.',
  colorScheme: 'dark',
  tokens,
  // Both appearances: dark is the base above, light lays the palette the
  // other way up over it (solarized.css keys its rules on data-variant).
  // Each variant carries its own still, so the chooser's light and dark
  // buttons show what they mean rather than describing it.
  variants: {
    dark: { tokens: {}, colorScheme: 'dark', thumbnail },
    light: { tokens: lightTokens, colorScheme: 'light', thumbnail: lightThumbnail },
  },
  Shell,
}
