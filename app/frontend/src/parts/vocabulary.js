// The vocabulary an arrangement is written in.
//
// A shell places parts. For a theme to bring its own layout, the parts need
// names that a layout can refer to, and a name needs an implementation to
// resolve to. This is that list.
//
// What it is *not* is one component per name with a style switch. The three
// shells draw a room three ways and all three are deliberate: the desktop tile
// reproduces the S1 application down to its 8x9 state bitmaps and its "six
// rooms, then Show N More" rule; the web card reproduces play.sonos.com;
// Sonofuture's is Sonora's own. Merging that markup would put three replicas
// in one file where a change for one endangers the others.
//
// So a name resolves to whichever implementation the theme registers, and the
// defaults here are the desktop family's. What keeps the implementations from
// drifting apart is not shared markup but the shared facts underneath them --
// lib/rooms.js, lib/transport.js, lib/useQueue.js, lib/groups.js,
// lib/shellSelection.js -- which is where the agreement belongs.

/**
 * Every part an arrangement may place, with what it is for and which props a
 * layout is allowed to set on it. Anything else a part needs comes from the
 * shell, which knows the selection and the dialogs; a layout does not.
 */

export const VOCABULARY = {
  rooms: {
    what: 'The rooms of the household, and which one is in view.',
    layoutProps: ['plainNames'],
  },
  nowPlaying: {
    what: 'What the room in view is playing: art, title, metadata.',
    layoutProps: ['bestArt'],
  },
  queue: {
    what: "The room's queue, with save, clear and reordering.",
    layoutProps: ['expanded'],
  },
  browse: {
    what: 'Music: services, favorites, playlists, the library, search.',
    layoutProps: [],
  },
  transport: {
    what: 'Volume, the transport buttons, progress and search.',
    layoutProps: ['remainingTime'],
  },
  paneSwitch: {
    what: 'The tab row a narrow window uses to show one pane at a time.',
    layoutProps: [],
  },
  settings: {
    what: "Sonora's settings, including the theme chooser. A layout that "
      + 'places none gets one anyway, because a layout with no way out of '
      + 'itself strands whoever installs it.',
    layoutProps: ['variant'],
  },
}

/** Whether a name is in the vocabulary at all, for validating an arrangement. */
export function isPart(name) {
  return Object.hasOwn(VOCABULARY, name)
}

/** The props a layout may set on a part, for validating an arrangement. */
export function layoutPropsFor(name) {
  return VOCABULARY[name]?.layoutProps || []
}
