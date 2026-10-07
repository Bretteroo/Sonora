import React from 'react'
import Rooms from './Rooms.jsx'
import Browse from './Browse.jsx'
import Transport from './Transport.jsx'
import PaneSwitch from './PaneSwitch.jsx'
import { NowPlaying, Queue } from './Center.jsx'
import Settings from './Settings.jsx'

// Which component each name in the vocabulary resolves to. The vocabulary
// itself is in vocabulary.js, with no React in it, so an arrangement can be
// validated without a bundler.
export { VOCABULARY, isPart, layoutPropsFor } from './vocabulary.js'

// The tabs get the shell's own choice, which the pane conditions answer from.
function LayoutPaneSwitch({ pane, onPane }) {
  return React.createElement(PaneSwitch, { value: pane || 'now', onChange: onPane })
}

/** The desktop family's implementations, used by any theme that names none. */
export const DEFAULT_PARTS = {
  rooms: Rooms,
  nowPlaying: NowPlaying,
  queue: Queue,
  browse: Browse,
  transport: Transport,
  paneSwitch: LayoutPaneSwitch,
  settings: Settings,
}

/**
 * The parts a theme draws with: its own where it has them, the defaults
 * otherwise. A theme declares them as `parts` on its registry entry.
 */
export function partsFor(theme) {
  return { ...DEFAULT_PARTS, ...(theme?.parts || {}) }
}
