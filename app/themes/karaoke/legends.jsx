import React from 'react'

// The legends printed on the machine's keys. The
// small marks inside lists are bitmaps (glyphs.jsx); a key is molded plastic
// with its legend printed on, so these are smooth: drawn on a twenty-four
// unit grid in round strokes and solid shapes, and scaled to whatever size
// the key asks for.

function legend(name, body) {
  function Legend({ size = 24, className = '', ...rest }) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
           aria-hidden="true" focusable="false" className={['km-legend', className].filter(Boolean).join(' ')} {...rest}>
        {body}
      </svg>
    )
  }
  Legend.displayName = name
  return Legend
}

const solid = { fill: 'currentColor', stroke: 'none' }

export const Play = legend('Play', <path {...solid} d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l10.6-6.8a.8.8 0 0 0 0-1.4L9.2 4.5a.8.8 0 0 0-1.2.7z" />)
export const Pause = legend('Pause', <><rect {...solid} x="6" y="5" width="4.2" height="14" rx="1" /><rect {...solid} x="13.8" y="5" width="4.2" height="14" rx="1" /></>)
export const Stop = legend('Stop', <rect {...solid} x="6" y="6" width="12" height="12" rx="1.5" />)
export const Prev = legend('Prev', <><rect {...solid} x="4" y="5.5" width="2.6" height="13" rx="0.8" /><path {...solid} d="M12.6 6.2v11.6a.7.7 0 0 1-1.1.6L5.9 12.6a.7.7 0 0 1 0-1.2l5.6-5.8a.7.7 0 0 1 1.1.6z" /><path {...solid} d="M20 6.2v11.6a.7.7 0 0 1-1.1.6l-5.6-5.8a.7.7 0 0 1 0-1.2l5.6-5.8a.7.7 0 0 1 1.1.6z" /></>)
export const Next = legend('Next', <><rect {...solid} x="17.4" y="5.5" width="2.6" height="13" rx="0.8" /><path {...solid} d="M11.4 6.2v11.6a.7.7 0 0 0 1.1.6l5.6-5.8a.7.7 0 0 0 0-1.2l-5.6-5.8a.7.7 0 0 0-1.1.6z" /><path {...solid} d="M4 6.2v11.6a.7.7 0 0 0 1.1.6l5.6-5.8a.7.7 0 0 0 0-1.2L5.1 5.6A.7.7 0 0 0 4 6.2z" /></>)
// Round once and back to where it began: the song over again.
export const Restart = legend('Restart', <><path d="M5.3 14.4A7.5 7.5 0 1 0 6 8.8" /><path d="M4.7 11.2l3.7-1.1-4.8-2.8z" fill="currentColor" strokeWidth="1" /></>)
// The one key that does both: start and hold, side by side.
export function PlayWhat({ what = 'play', ...rest }) {
  return what === 'pause' ? <Pause {...rest} /> : what === 'stop' ? <Stop {...rest} /> : <Play {...rest} />
}

// Bars along the grid alone, so they are snapped to whole pixels: at a key's size each is a pixel
// and a half thick, and left to fall where it would it blurs across two.
const bar = { ...solid, shapeRendering: 'crispEdges' }
export const Plus = legend('Plus', <><rect {...bar} x="5" y="10.8" width="14" height="2.4" /><rect {...bar} x="10.8" y="5" width="2.4" height="14" /></>)
export const Minus = legend('Minus', <rect {...bar} x="5" y="10.8" width="14" height="2.4" />)
export const Left = legend('Left', <path {...solid} d="M15 5.8v12.4a.8.8 0 0 1-1.3.6L6.6 12.6a.8.8 0 0 1 0-1.2l7.1-6.2a.8.8 0 0 1 1.3.6z" />)
export const Right = legend('Right', <path {...solid} d="M9 5.8v12.4a.8.8 0 0 0 1.3.6l7.1-6.2a.8.8 0 0 0 0-1.2l-7.1-6.2A.8.8 0 0 0 9 5.8z" />)
export const Up = legend('Up', <path {...solid} d="M5.8 15h12.4a.8.8 0 0 0 .6-1.3l-6.2-7.1a.8.8 0 0 0-1.2 0l-6.2 7.1a.8.8 0 0 0 .6 1.3z" />)
export const Down = legend('Down', <path {...solid} d="M5.8 9h12.4a.8.8 0 0 1 .6 1.3l-6.2 7.1a.8.8 0 0 1-1.2 0l-6.2-7.1A.8.8 0 0 1 5.8 9z" />)
export const Check = legend('Check', <path d="M5 12.5l4.5 4.5L19 7.5" strokeWidth="2.4" />)

export const Shuffle = legend('Shuffle', <><path d="M3 7h3.5c4.5 0 6.5 10 11 10H21" /><path d="M3 17h3.5c1.8 0 3-1.6 4.1-3.6M13.4 9.6C14.5 8.1 15.7 7 17.5 7H21" /><path d="M18.5 4.5L21 7l-2.5 2.5M18.5 14.5L21 17l-2.5 2.5" /></>)
export const Repeat = legend('Repeat', <><path d="M4 11V9.5A2.5 2.5 0 0 1 6.5 7H19" /><path d="M16.5 4.5L19 7l-2.5 2.5" /><path d="M20 13v1.5a2.5 2.5 0 0 1-2.5 2.5H5" /><path d="M7.5 19.5L5 17l2.5-2.5" /></>)
export const RepeatOne = legend('RepeatOne', <><path d="M4 11V9.5A2.5 2.5 0 0 1 6.5 7H19" /><path d="M16.5 4.5L19 7l-2.5 2.5" /><path d="M20 13v1.5a2.5 2.5 0 0 1-2.5 2.5H5" /><path d="M7.5 19.5L5 17l2.5-2.5" /><path d="M11 11l1.3-1v4.5" strokeWidth="1.6" /></>)
export const Crossfade = legend('Crossfade', <><path d="M3 6.5h3c5 0 7 11 12 11h3" /><path d="M3 17.5h3c5 0 7-11 12-11h3" /></>)
export const Lyrics = legend('Lyrics', <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" /></>)
// Two speakers joined: a bar across their tops ties the cabinets into one group.
export const Group = legend('Group', <><rect x="3" y="9" width="7" height="11" rx="1.5" /><rect x="14" y="9" width="7" height="11" rx="1.5" /><circle {...solid} cx="6.5" cy="15.5" r="1.8" /><circle {...solid} cx="17.5" cy="15.5" r="1.8" /><path d="M6.5 9V5h11v4" /></>)
// A loudspeaker, its cone solid, two arcs of sound off its face.
export const Speaker = legend('Speaker', <><path {...solid} d="M4 9.2h3.4L12 5.6v12.8l-4.6-3.6H4z" /><path d="M15.4 9.4a3.6 3.6 0 0 1 0 5.2M18 6.8a7.2 7.2 0 0 1 0 10.4" /></>)
// The same loudspeaker turned low: one arc.
export const Book = legend('Book', <><path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z" /><path d="M9 4v16" /><path d="M2.6 8h4M2.6 12h4M2.6 16h4" strokeWidth="2.4" /></>)
export const Search = legend('Search', <><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5 5" strokeWidth="2.4" /></>)
export const Info = legend('Info', <><circle cx="12" cy="12" r="9" /><path d="M12 11v6" /><path d="M12 7.5h0" strokeWidth="2.6" /></>)

// The function row: the programs.
export const Queue = legend('Queue', <><path d="M4 6h11M4 11h11M4 16h7" /><path {...solid} d="M15 13.5v6.3a.6.6 0 0 0 .9.5l5-3.2a.6.6 0 0 0 0-1l-5-3.1a.6.6 0 0 0-.9.5z" /></>)
export const Folder = legend('Folder', <path d="M3 7.5V18a1.5 1.5 0 0 0 1.5 1.5h15A1.5 1.5 0 0 0 21 18V9.5A1.5 1.5 0 0 0 19.5 8h-8l-2-2.5h-5A1.5 1.5 0 0 0 3 7z" />)
export const Rooms = legend('Rooms', <><rect x="3.5" y="3.5" width="7" height="7" rx="1.2" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.2" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.2" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.2" /></>)
export const Settings = legend('Settings', <><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" /><circle cx="12" cy="12" r="6.6" /></>)
// A loudspeaker with a stroke through it.
export const Muted = legend('Muted', <><path {...solid} d="M4 9.2h3.4L12 5.6v12.8l-4.6-3.6H4z" /><path d="M15.5 9.5l5 5M20.5 9.5l-5 5" /></>)
// Four corners pulled outward, and the same four drawn in.
export const Full = legend('Full', <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />)
export const Window = legend('Window', <path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5" />)
