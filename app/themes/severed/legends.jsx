import React from 'react'

// The legends printed on the console's keys. The screen draws in its character
// generator's bitmaps (glyphs.jsx); a key is molded plastic with its legend
// printed on, so these are smooth: drawn on a twenty-four unit grid in round
// strokes and solid shapes, and scaled to whatever size the key asks for.

function legend(name, body) {
  function Legend({ size = 24, className = '', ...rest }) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
           aria-hidden="true" focusable="false" className={['sv-legend', className].filter(Boolean).join(' ')} {...rest}>
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
// The four tempers, for a room whose music offers no reactions of its own: a falling tear,
// a burst, a wide eye, a jagged bolt.
export const Woe = legend('Woe', <path {...solid} d="M12 3.5c3.2 4.4 5.5 7.6 5.5 10.7a5.5 5.5 0 0 1-11 0c0-3.1 2.3-6.3 5.5-10.7z" />)
export const Frolic = legend('Frolic', <path {...solid} d="M12 2.5l2 7.5 7.5 2-7.5 2-2 7.5-2-7.5-7.5-2 7.5-2z" />)
export const Dread = legend('Dread', <><path d="M2.5 12c2.6-4.4 5.8-6.5 9.5-6.5s6.9 2.1 9.5 6.5c-2.6 4.4-5.8 6.5-9.5 6.5S5.1 16.4 2.5 12z" /><circle {...solid} cx="12" cy="12" r="3" /></>)
export const Malice = legend('Malice', <path {...solid} d="M13.5 2.5L5 13.5h5.5L9 21.5l9.5-12H13z" />)
export const Moon = legend('Moon', <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" />)
export const Search = legend('Search', <><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5 5" strokeWidth="2.4" /></>)
export const Info = legend('Info', <><circle cx="12" cy="12" r="9" /><path d="M12 11v6" /><path d="M12 7.5h0" strokeWidth="2.6" /></>)

// The function row: the programs.
export const Queue = legend('Queue', <><path d="M4 6h11M4 11h11M4 16h7" /><path {...solid} d="M15 13.5v6.3a.6.6 0 0 0 .9.5l5-3.2a.6.6 0 0 0 0-1l-5-3.1a.6.6 0 0 0-.9.5z" /></>)
export const Folder = legend('Folder', <path d="M3 7.5V18a1.5 1.5 0 0 0 1.5 1.5h15A1.5 1.5 0 0 0 21 18V9.5A1.5 1.5 0 0 0 19.5 8h-8l-2-2.5h-5A1.5 1.5 0 0 0 3 7z" />)
export const Rooms = legend('Rooms', <><rect x="3.5" y="3.5" width="7" height="7" rx="1.2" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.2" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.2" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.2" /></>)
export const Alarm = legend('Alarm', <><circle cx="12" cy="13" r="7.5" /><path d="M12 9v4l2.5 2M4 5.5L6.5 3M20 5.5L17.5 3" /></>)
export const Settings = legend('Settings', <><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" /><circle cx="12" cy="12" r="6.6" /></>)
