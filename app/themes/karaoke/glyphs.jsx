import React from 'react'
import * as L from './legends.jsx'

// The marks on the machine's screen: in buttons, beside rows, on the menu's
// tiles. They are drawn the way the legends on its keys are, on a
// twenty-four unit grid in fat round strokes and solid shapes, and where a
// key already carries the mark the screen borrows the key's drawing.
//
// Callers ask in the sizes of a line of text (12), a button (24), and a
// placard (48). A stroked mark at twelve pixels is a smudge, so the small
// sizes are drawn a little larger than asked.

const px = (size) => (size <= 12 ? 16 : size <= 18 ? 18 : size)

function wrap(name, Legend) {
  function Glyph({ size = 24, className = '', ...rest }) {
    return <Legend size={px(size)} className={['km-glyph', className].filter(Boolean).join(' ')} {...rest} />
  }
  Glyph.displayName = name
  return Glyph
}

function glyph(name, body, strokeWidth = 2.2) {
  function Drawing({ size = 24, className = '', ...rest }) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
           aria-hidden="true" focusable="false" className={className} {...rest}>
        {body}
      </svg>
    )
  }
  return wrap(name, Drawing)
}

const solid = { fill: 'currentColor', stroke: 'none' }
const cone = <path {...solid} d="M4 9.2h3.4L12 5.6v12.8l-4.6-3.6H4z" />
const chain = (
  <>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3A4 4 0 0 0 13 5.3l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </>
)

// Transport and modes: the keys' own drawings.
export const Play = wrap('Play', L.Play)
export const Pause = wrap('Pause', L.Pause)
export const Stop = wrap('Stop', L.Stop)
export const Prev = wrap('Prev', L.Prev)
export const Next = wrap('Next', L.Next)
export const Shuffle = wrap('Shuffle', L.Shuffle)
export const Repeat = wrap('Repeat', L.Repeat)
export const RepeatOne = wrap('RepeatOne', L.RepeatOne)
export const Crossfade = wrap('Crossfade', L.Crossfade)
export const Lyrics = wrap('Lyrics', L.Lyrics)
export const Volume = wrap('Volume', L.Speaker)
export const VolumeLow = glyph('VolumeLow', <>{cone}<path d="M15.4 9.4a3.6 3.6 0 0 1 0 5.2" /></>)
export const Muted = wrap('Muted', L.Muted)
export const Plus = wrap('Plus', L.Plus)
export const Minus = wrap('Minus', L.Minus)
export const Left = wrap('Left', L.Left)
export const Right = wrap('Right', L.Right)
export const Up = wrap('Up', L.Up)
export const Down = wrap('Down', L.Down)
export const Check = wrap('Check', L.Check)

// Ways around.
export const Chevron = glyph('Chevron', <path d="M9 5l7 7-7 7" />, 2.8)
export const ChevronDown = glyph('ChevronDown', <path d="M5 9l7 7 7-7" />, 2.8)
export const ChevronUp = glyph('ChevronUp', <path d="M5 15l7-7 7 7" />, 2.8)
export const Back = glyph('Back', <path d="M19.5 12h-15M11 5.5L4.5 12l6.5 6.5" />, 2.6)
export const Close = glyph('Close', <path d="M6 6l12 12M18 6L6 18" />, 2.8)
export const More = glyph('More', <><circle {...solid} cx="5" cy="12" r="2.1" /><circle {...solid} cx="12" cy="12" r="2.1" /><circle {...solid} cx="19" cy="12" r="2.1" /></>)
export const Home = glyph('Home', <path d="M3.5 11.5L12 4l8.5 7.5M6 10v10h12V10" />)
export const Search = wrap('Search', L.Search)
export const Info = wrap('Info', L.Info)

// Rooms.
export const Speaker = glyph('Speaker', <><rect x="6" y="3" width="12" height="18" rx="2.2" /><circle cx="12" cy="14.5" r="3.1" /><circle {...solid} cx="12" cy="7.4" r="1.4" /></>)
export const Group = wrap('Group', L.Group)
export const Rooms = wrap('Rooms', L.Rooms)

// Music.
export const Star = glyph('Star', <path {...solid} d="M12 2.6l2.9 6 6.5.9-4.8 4.5 1.2 6.5L12 17.4l-5.8 3.1 1.2-6.5L2.6 9.5l6.5-.9z" />)
export const Heart = glyph('Heart', <path {...solid} d="M12 20.6S3.8 15.7 3.8 9.9A4.4 4.4 0 0 1 12 7.5a4.4 4.4 0 0 1 8.2 2.4c0 5.8-8.2 10.7-8.2 10.7z" />)
export const Playlist = glyph('Playlist', <><path d="M4 6h12M4 11h12M4 16h6" /><circle {...solid} cx="15.6" cy="18" r="2.4" /><path d="M18 18V9.6l3 1.2" /></>)
export const Queue = wrap('Queue', L.Queue)
export const Folder = wrap('Folder', L.Folder)
export const Radio = glyph('Radio', <><rect x="3" y="8" width="18" height="12" rx="2.2" /><path d="M7 8l9.5-5M14.5 12.5H18M14.5 15.5H18" /><circle cx="8.5" cy="14" r="2.4" /></>)
export const Tv = glyph('Tv', <><rect x="3" y="6.5" width="18" height="12" rx="2.2" /><path d="M8.5 2.8L12 6.5l3.5-3.7M8 21.5h8" /></>)
export const LineIn = glyph('LineIn', <><path d="M5.5 13a6.5 6.5 0 0 0 13 0" /><path d="M12 2.8v10.7M8 9.5l4 4 4-4" /></>)
export const Note = glyph('Note', <><circle {...solid} cx="7.5" cy="17.5" r="3" /><circle {...solid} cx="17" cy="15.5" r="3" /><path d="M10.5 17.5V6l9.5-2.4v11.9" /></>)
export const Explicit = glyph('Explicit', <><rect x="3.5" y="3.5" width="17" height="17" rx="3.5" /><path d="M15 8H9.5v8H15M9.5 12h4.5" /></>)

// Things done to things.
export const Gear = wrap('Gear', L.Settings)
export const Settings = glyph('Settings', <><path d="M4 7h8.5M17.5 7H20M4 17h2.5M11.5 17H20" /><circle cx="15" cy="7" r="2.4" /><circle cx="9" cy="17" r="2.4" /></>)
export const Person = glyph('Person', <><circle cx="12" cy="8" r="4" /><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" /></>)
export const Link = glyph('Link', chain)
export const Unlink = glyph('Unlink', <>{chain}<path d="M4 4l16 16" /></>)
export const Trash = glyph('Trash', <path d="M4.5 7h15M9.5 7V4.2h5V7M6.5 7l1 12.4a1.6 1.6 0 0 0 1.6 1.5h5.8a1.6 1.6 0 0 0 1.6-1.5l1-12.4M10 11v6M14 11v6" />, 2)
export const Edit = glyph('Edit', <path d="M4 20l1-4.6L16.4 4a2.1 2.1 0 0 1 3 3L8 18.6zM14.4 6.2l3 3" />)
export const Refresh = glyph('Refresh', <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 3.8v4.7h-4.7" />)
export const Warning = glyph('Warning', <><path d="M12 3.5l9.3 16.3H2.7z" /><path d="M12 10v4.4" /><path d="M12 17.2h0" strokeWidth="2.8" /></>)
export const Prohibit = glyph('Prohibit', <><circle cx="12" cy="12" r="8.5" /><path d="M6 6l12 12" /></>)
export const Update = glyph('Update', <path d="M12 3.5v11M7.5 10.2l4.5 4.5 4.5-4.5M4.5 19.8h15" />)
export const Pin = glyph('Pin', <path d="M9 3.5h6l-1 6 3.5 3.6h-11L10 9.5zM12 13.1v7.4" />)
export const Drag = glyph('Drag', <>{[6, 12, 18].flatMap((y) => [9, 15].map((x) => <circle key={`${x}-${y}`} {...solid} cx={x} cy={y} r="1.7" />))}</>)
export const Keyboard = glyph('Keyboard', <><rect x="2.5" y="6" width="19" height="12" rx="2.2" /><path d="M6.5 10h0M10.2 10h0M13.8 10h0M17.5 10h0" strokeWidth="2.6" /><path d="M7.5 14.2h9" /></>)
export const Infinity = glyph('Infinity', <path d="M12 12c-2-3-3.5-4.5-6-4.5a4.5 4.5 0 0 0 0 9c2.5 0 4-1.5 6-4.5s3.5-4.5 6-4.5a4.5 4.5 0 0 1 0 9c-2.5 0-4-1.5-6-4.5z" />)
export const Sparkle = glyph('Sparkle', <path {...solid} d="M12 2.5c.6 5 2.5 7 9.5 9.5-7 2.5-8.9 4.5-9.5 9.5-.6-5-2.5-7-9.5-9.5 7-2.5 8.9-4.5 9.5-9.5z" />)
export const ViewGrid = glyph('ViewGrid', <>{[4, 13.5].flatMap((y) => [4, 13.5].map((x) => <rect key={`${x}-${y}`} {...solid} x={x} y={y} width="6.5" height="6.5" rx="1.4" />))}</>)
export const ViewList = glyph('ViewList', <><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4.5 6h0M4.5 12h0M4.5 18h0" strokeWidth="2.8" /></>)
export const ViewAuto = glyph('ViewAuto', <><rect x="3.5" y="3.5" width="17" height="17" rx="3.5" /><path d="M8.5 16.5L12 7.5l3.5 9M9.8 13.4h4.4" /></>, 2)
export const Screen = glyph('Screen', <><rect x="3" y="4" width="18" height="12.5" rx="2.2" /><path d="M8.5 20.5h7M12 16.5v4" /></>)

// Play, pause or stop by what the next press of the key would do.
export function PlayWhat({ what = 'play', ...rest }) {
  return what === 'pause' ? <Pause {...rest} /> : what === 'stop' ? <Stop {...rest} /> : <Play {...rest} />
}
