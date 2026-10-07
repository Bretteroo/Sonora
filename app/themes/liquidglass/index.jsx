import React from 'react'
import { Shell as RailShell } from './RailShell.jsx'
import { tokens, darkTokens } from './tokens.js'
import './liquidglass.css'
import thumbnail from './thumbnail.webp'
import darkThumbnail from './thumbnail-dark.webp'
import strings from './strings.js'

// Liquid Glass: Apple's material, worn by the reimagined shell.
//
// The design language is about a surface, not a layout, so it takes the
// Sonofuture shell whole -- the same rail, bar, stage, library, queue and
// palette, with every capability behind them -- and re-lights it: a mesh
// wallpaper for the glass to bend, wide blurs with the saturation pushed up,
// a specular hairline along every top edge, concentric radii, capsule
// controls, and Apple's system colors where color carries meaning. It
// follows the operating system between light and dark rather than picking
// one, as the material itself does.
function Shell() {
  return <RailShell />
}

export default {
  id: 'liquidglass',
  name: 'Liquid Glass',
  version: '1.0.0',
  thumbnail,
  description:
    "Apple's Liquid Glass material over the reimagined shell: floating panels of frosted, "
    + 'specular glass above a drifting mesh wallpaper, capsule controls, concentric corners '
    + 'and the system palette, following the operating system between light and dark.',
  colorScheme: 'light dark',
  strings,
  tokens,
  // Both ways up, so the Light/Dark/System buttons appear in the chooser and
  // mean something here. "System" still follows the operating system, which
  // is how this theme behaved before either way.
  // Each way up carries its own still, so the chooser's Light and Dark
  // buttons show what they mean rather than describing it.
  variants: {
    light: { tokens: {}, colorScheme: 'light', thumbnail },
    dark: { tokens: darkTokens, colorScheme: 'dark', thumbnail: darkThumbnail },
  },
  Shell,
}
