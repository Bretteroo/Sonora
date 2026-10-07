import React from 'react'
import { Shell as DesktopShell } from './DesktopShell.jsx'
import { tokens } from './tokens.js'
import './hotdog.css'
import thumbnail from './thumbnail.webp'

// Hot Dog Stand: the Sonos desktop controller in the Windows 3.1 color
// scheme of that name. The Windows shell is kept whole, title bar and all;
// only the colors change, to the red, yellow, black, and white the scheme
// used, with the square corners and white-and-black bevels of the period.

function Shell() {
  return <DesktopShell rootClass="hd-root" />
}

export default {
  id: 'hotdog',
  name: 'Hot Dog Stand',
  version: '1.0.0',
  thumbnail,
  description:
    'The desktop controller in the Windows 3.1 color scheme of the same name: '
    + 'red, yellow, black and white, square corners, bevelled buttons.',
  colorScheme: 'light',
  tokens,
  Shell,
}
