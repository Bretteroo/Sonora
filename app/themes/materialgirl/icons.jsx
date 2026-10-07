import React from 'react'

// Material Girl's icons: drawn for this theme on a 24-unit grid, filled
// rather than stroked where Material's own style fills, with the rounded
// joins M3 uses. Every path here is this theme's own.

function G({ children, size = 24, className = '', ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" className={className} {...rest}>
      {children}
    </svg>
  )
}
const line = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }

// A gear is a circle of teeth: generated rather than drawn by hand.
function gearPath() {
  const teeth = 8
  const pts = []
  for (let i = 0; i < teeth * 4; i += 1) {
    const a = (i / (teeth * 4)) * Math.PI * 2
    const r = i % 4 < 2 ? 10 : 7.6
    pts.push(`${(12 + Math.cos(a) * r).toFixed(2)} ${(12 + Math.sin(a) * r).toFixed(2)}`)
  }
  return `M${pts.join(' L')} Z M12 8.6 A3.4 3.4 0 1 0 12.001 8.6 Z`
}
const GEAR = gearPath()

export const Home = (p) => <G {...p}><path d="M4 10.2 12 4l8 6.2V19a1.5 1.5 0 0 1-1.5 1.5H15v-6h-6v6H5.5A1.5 1.5 0 0 1 4 19z" /></G>
export const HomeLine = (p) => <G {...p}><path {...line} d="M4.5 10.5 12 4.6l7.5 5.9V19.5h-5v-5.5h-5v5.5h-5z" /></G>
export const Browse = (p) => <G {...p}><path d="M9 4.5v9.6A3.4 3.4 0 1 0 11 17V8.5h6V4.5z" /><rect x="14" y="11.5" width="6" height="2" rx="1" /><rect x="14" y="15.5" width="6" height="2" rx="1" /></G>
export const BrowseLine = (p) => <G {...p}><path {...line} d="M10 16.8V5h6.5" /><circle {...line} cx="7.8" cy="16.8" r="2.2" /><path {...line} d="M14.5 12h5M14.5 16h5" /></G>
export const Speaker = (p) => <G {...p}><path fillRule="evenodd" d="M7.5 2.5h9A2.5 2.5 0 0 1 19 5v14a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 19V5a2.5 2.5 0 0 1 2.5-2.5M12 10.5a3.6 3.6 0 1 0 .01 0M12 5.5a1.3 1.3 0 1 0 .01 0" /></G>
export const SpeakerLine = (p) => <G {...p}><rect {...line} x="6" y="3" width="12" height="18" rx="2.5" /><circle {...line} cx="12" cy="14" r="3" /><circle cx="12" cy="7" r="1.2" /></G>
export const Rooms = (p) => <G {...p}><path fillRule="evenodd" d="M4.5 5h4A2 2 0 0 1 10.5 7v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2m2 6.3a2.2 2.2 0 1 0 .01 0M15.5 5h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2m2 6.3a2.2 2.2 0 1 0 .01 0" /></G>
export const RoomsLine = (p) => <G {...p}><rect {...line} x="3" y="5" width="7.5" height="14" rx="2" /><rect {...line} x="13.5" y="5" width="7.5" height="14" rx="2" /><circle cx="6.75" cy="13.5" r="1.4" /><circle cx="17.25" cy="13.5" r="1.4" /></G>
export const Alarm = (p) => <G {...p}><path d="M12 5a8 8 0 1 0 .01 0m-.9 3h1.8v4.6l3.2 1.9-.9 1.5-4.1-2.5z" /><path d="M3.2 6.6 6.8 3.5l1.2 1.4-3.6 3.1zM20.8 6.6l-3.6-3.1-1.2 1.4 3.6 3.1z" /></G>
export const AlarmLine = (p) => <G {...p}><circle {...line} cx="12" cy="13" r="7.5" /><path {...line} d="M12 9v4.2l2.8 1.7M4 6.5 7 4M20 6.5 17 4" /></G>
export const Settings = (p) => <G {...p}><path fillRule="evenodd" d={GEAR} /></G>
export const SettingsLine = (p) => <G {...p}><path {...line} strokeWidth="1.7" d={GEAR} /></G>
export const Search = (p) => <G {...p}><path {...line} d="M10.5 4.5a6 6 0 1 1 0 12 6 6 0 0 1 0-12M15 15l5 5" /></G>
export const Play = (p) => <G {...p}><path d="M8 5.6v12.8a1 1 0 0 0 1.5.86l10.2-6.4a1 1 0 0 0 0-1.72L9.5 4.74A1 1 0 0 0 8 5.6" /></G>
export const Pause = (p) => <G {...p}><rect x="6" y="5" width="4.2" height="14" rx="1.4" /><rect x="13.8" y="5" width="4.2" height="14" rx="1.4" /></G>
export const Stop = (p) => <G {...p}><rect x="6" y="6" width="12" height="12" rx="2" /></G>

// Play, pause and stop as one glyph that morphs between them, as Android's own media controls do:
// the pause bars fold into the two halves of the play triangle, or close up into the stop square,
// over 333ms. Each half is the same four-point outline in every state, so the browser can tween
// it; a round stroke of the same color softens the corners the outlines lose.
const MORPH = {
  pause: ['M6 5L10.2 5L10.2 19L6 19Z', 'M13.8 5L18 5L18 19L13.8 19Z'],
  play: ['M8 5L13.6 8.5L13.6 15.5L8 19Z', 'M13.6 8.5L19.2 12L19.2 12L13.6 15.5Z'],
  stop: ['M6.5 6.5L12 6.5L12 17.5L6.5 17.5Z', 'M12 6.5L17.5 6.5L17.5 17.5L12 17.5Z'],
}
export function PlayMorph({ what = 'play', ...p }) {
  const [left, right] = MORPH[what] || MORPH.play
  return (
    <G {...p} className={['mg-morph', p.className].filter(Boolean).join(' ')}>
      <path style={{ d: `path("${left}")` }} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path style={{ d: `path("${right}")` }} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </G>
  )
}
export const Next = (p) => <G {...p}><path d="M5 6.3v11.4a.9.9 0 0 0 1.4.75l8.3-5.7a.9.9 0 0 0 0-1.5L6.4 5.55A.9.9 0 0 0 5 6.3" /><rect x="16.5" y="5.5" width="2.5" height="13" rx="1.2" /></G>
export const Prev = (p) => <G {...p}><path d="M19 6.3v11.4a.9.9 0 0 1-1.4.75l-8.3-5.7a.9.9 0 0 1 0-1.5l8.3-5.7A.9.9 0 0 1 19 6.3" /><rect x="5" y="5.5" width="2.5" height="13" rx="1.2" /></G>
export const Shuffle = (p) => <G {...p}><path {...line} d="M4 7h3.2c2.4 0 3.6 1.2 4.8 5s2.4 5 4.8 5H20M4 17h3.2c1.2 0 2-.3 2.6-1M14.2 8c.6-.7 1.4-1 2.6-1H20M17.5 4.5 20 7l-2.5 2.5M17.5 14.5 20 17l-2.5 2.5" /></G>
export const Repeat = (p) => <G {...p}><path {...line} d="M5 11V9.5A2.5 2.5 0 0 1 7.5 7H19M16 4l3 3-3 3M19 13v1.5a2.5 2.5 0 0 1-2.5 2.5H5M8 20l-3-3 3-3" /></G>
export const RepeatOne = (p) => <G {...p}><path {...line} d="M5 11V9.5A2.5 2.5 0 0 1 7.5 7H19M16 4l3 3-3 3M19 13v1.5a2.5 2.5 0 0 1-2.5 2.5H5M8 20l-3-3 3-3" /><path d="M11.3 10.2h1.6v4.6h-1.3v-3.2l-.9.4-.4-1z" /></G>
export const Crossfade = (p) => <G {...p}><path {...line} d="M3 17c4 0 5-10 9-10s5 10 9 10M3 7c4 0 5 10 9 10s5-10 9-10" strokeWidth="1.8" /></G>
export const Volume = (p) => <G {...p}><path d="M4 9.2v5.6c0 .5.4.9.9.9h3l4 3.6a.7.7 0 0 0 1.1-.5V5.2a.7.7 0 0 0-1.1-.5l-4 3.6h-3c-.5 0-.9.4-.9.9" /><path {...line} d="M16 8.8a4.5 4.5 0 0 1 0 6.4M18.6 6.2a8.2 8.2 0 0 1 0 11.6" /></G>
export const VolumeLow = (p) => <G {...p}><path d="M5 9.2v5.6c0 .5.4.9.9.9h3l4 3.6a.7.7 0 0 0 1.1-.5V5.2a.7.7 0 0 0-1.1-.5l-4 3.6h-3c-.5 0-.9.4-.9.9" /><path {...line} d="M17 8.8a4.5 4.5 0 0 1 0 6.4" /></G>
export const Muted = (p) => <G {...p}><path d="M4 9.2v5.6c0 .5.4.9.9.9h3l4 3.6a.7.7 0 0 0 1.1-.5V5.2a.7.7 0 0 0-1.1-.5l-4 3.6h-3c-.5 0-.9.4-.9.9" /><path {...line} d="m16 9.5 5 5M21 9.5l-5 5" /></G>
export const Queue = (p) => <G {...p}><rect x="3" y="5" width="12" height="2" rx="1" /><rect x="3" y="10" width="12" height="2" rx="1" /><rect x="3" y="15" width="7" height="2" rx="1" /><path d="M16 11v5.3a2.3 2.3 0 1 0 2 2.2V13h3v-2z" /></G>
export const Close = (p) => <G {...p}><path {...line} d="m6 6 12 12M18 6 6 18" /></G>
export const Back = (p) => <G {...p}><path {...line} d="M19.5 12h-15M10.5 6l-6 6 6 6" /></G>
export const Chevron = (p) => <G {...p}><path {...line} d="m9.5 6 6 6-6 6" /></G>
export const ChevronDown = (p) => <G {...p}><path {...line} d="m6 9.5 6 6 6-6" /></G>
export const ChevronUp = (p) => <G {...p}><path {...line} d="m6 14.5 6-6 6 6" /></G>
export const More = (p) => <G {...p}><circle cx="12" cy="5.5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="18.5" r="2" /></G>
export const Plus = (p) => <G {...p}><path {...line} strokeWidth="2.2" d="M12 5v14M5 12h14" /></G>
export const Check = (p) => <G {...p}><path {...line} strokeWidth="2.4" d="m5 12.5 4.5 4.5L19 7.5" /></G>
export const Star = (p) => <G {...p}><path d="m12 3.2 2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6-4.4-4.2 6-.8z" strokeLinejoin="round" /></G>
export const Heart = (p) => <G {...p}><path d="M12 20.5 4.6 13.3A4.7 4.7 0 0 1 12 7.3a4.7 4.7 0 0 1 7.4 6z" /></G>
export const Playlist = (p) => <G {...p}><rect x="3" y="5" width="13" height="2" rx="1" /><rect x="3" y="10" width="13" height="2" rx="1" /><rect x="3" y="15" width="8" height="2" rx="1" /><path d="M18 13v3h-3v2h3v3h2v-3h3v-2h-3v-3z" /></G>
export const Radio = (p) => <G {...p}><path d="M4 8.5 16.8 4l.6 1.7-8 2.8H19a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7.6c0-.9.4-1.6 1-1.9m4 3.5a3 3 0 1 0 .01 0M14 12h4v1.6h-4zm0 3h4v1.6h-4z" /></G>
export const Tv = (p) => <G {...p}><rect {...line} x="3" y="5" width="18" height="12" rx="2" /><path {...line} d="M8 20.5h8" /></G>
export const LineIn = (p) => <G {...p}><path {...line} d="M12 3v7M8.5 10h7v3.5a3.5 3.5 0 0 1-7 0zM12 17v4" /></G>
export const Info = (p) => <G {...p}><circle {...line} cx="12" cy="12" r="8.5" /><path d="M11 11h2v6h-2zM12 7a1.25 1.25 0 1 0 .01 0" /></G>
export const Moon = (p) => <G {...p}><path d="M14.5 3.3a8.7 8.7 0 1 0 6.2 11.2A7 7 0 0 1 14.5 3.3" /></G>
export const Group = (p) => <G {...p}><rect x="2" y="6" width="7" height="12" rx="2" /><rect x="15" y="6" width="7" height="12" rx="2" /><path {...line} d="M10.5 12h3M12 10.5v3" /></G>
export const Link = (p) => <G {...p}><path {...line} d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></G>
export const Unlink = (p) => <G {...p}><path {...line} d="M8.5 12.5 5.3 15.7a3.2 3.2 0 0 0 4.5 4.5l3-3M15.5 11.5l3.2-3.2a3.2 3.2 0 0 0-4.5-4.5l-3 3M4 4l16 16" /></G>
export const Trash = (p) => <G {...p}><path d="M9 3.5h6l.8 1.5H20v2H4V5h4.2zM5.5 8.5h13l-1 11a2 2 0 0 1-2 1.8h-7a2 2 0 0 1-2-1.8zM9.5 11v7.5h1.6V11zm3.4 0v7.5h1.6V11z" /></G>
export const Edit = (p) => <G {...p}><path d="m15.4 4.6 4 4L9 19H5v-4zM16.8 3.2a1.6 1.6 0 0 1 2.3 0l1.7 1.7a1.6 1.6 0 0 1 0 2.3l-.6.6-4-4z" /></G>
export const Refresh = (p) => <G {...p}><path {...line} d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4.2h-4.2" /></G>
export const Sparkle = (p) => <G {...p}><path d="M12 2.5c.7 4.4 2.6 6.8 7 7.5-4.4.7-6.3 3.1-7 7.5-.7-4.4-2.6-6.8-7-7.5 4.4-.7 6.3-3.1 7-7.5M18.5 15c.3 1.9 1.1 2.9 3 3.2-1.9.3-2.7 1.3-3 3.2-.3-1.9-1.1-2.9-3-3.2 1.9-.3 2.7-1.3 3-3.2" /></G>
export const Person = (p) => <G {...p}><circle cx="12" cy="8" r="4" /><path d="M4 20a8 8 0 0 1 16 0z" /></G>
export const Clock = (p) => <G {...p}><circle {...line} cx="12" cy="12" r="8.5" /><path {...line} d="M12 7.5V12l3 2" /></G>
export const Prohibit = (p) => <G {...p}><circle {...line} cx="12" cy="12" r="8.5" /><path {...line} d="m6 6 12 12" /></G>
export const Signal = (p) => <G {...p}><rect x="3" y="15" width="3.2" height="5" rx="1" /><rect x="8.3" y="11" width="3.2" height="9" rx="1" /><rect x="13.6" y="7" width="3.2" height="13" rx="1" /><rect x="18.9" y="3" width="3.2" height="17" rx="1" opacity=".38" /></G>
export const Palette = (p) => <G {...p}><path d="M12 3a9 9 0 0 0 0 18c1.1 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2a1.8 1.8 0 0 1 1.3-3.1H17A4 4 0 0 0 21 11c0-4.4-4-8-9-8m-5 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3m3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3m4 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3m3 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3" /></G>
export const Warning = (p) => <G {...p}><path d="M10.3 3.9a2 2 0 0 1 3.4 0l7.6 13.2A2 2 0 0 1 19.6 20H4.4a2 2 0 0 1-1.7-2.9zM11 9v5h2V9zm1 6.6a1.2 1.2 0 1 0 .01 0" /></G>
export const Folder = (p) => <G {...p}><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h5l2 2h8A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" /></G>
export const Keyboard = (p) => <G {...p}><rect {...line} x="2.5" y="6" width="19" height="12" rx="2.5" /><path d="M6 9h2v2H6zm3.5 0h2v2h-2zM13 9h2v2h-2zm3.5 0h2v2h-2zM6 12.5h2v2H6zm11 0h1.5v2H17zM9 15h6v1.6H9z" /></G>
export const Drag = (p) => <G {...p}><circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" /></G>
export const Expand = (p) => <G {...p}><path {...line} d="M14 4h6v6M10 20H4v-6M20 4l-6.5 6.5M4 20l6.5-6.5" /></G>
export const Tune = (p) => <G {...p}><path {...line} d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle {...line} cx="15" cy="7" r="2" /><circle {...line} cx="9" cy="17" r="2" /></G>
export const Pin = (p) => <G {...p}><path d="M12 2.5a7 7 0 0 0-7 7c0 5 7 12 7 12s7-7 7-12a7 7 0 0 0-7-7m0 4.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5" /></G>
export const Explicit = (p) => <G {...p}><rect x="3.5" y="3.5" width="17" height="17" rx="3" /><path d="M9.5 7.5h5.5v1.8h-3.6v1.8h3.4v1.8h-3.4v1.8H15v1.8H9.5z" fill="var(--mg-surface, #fff)" /></G>
export const Menu = (p) => <G {...p}><rect x="3.5" y="6" width="17" height="2" rx="1" /><rect x="3.5" y="11" width="17" height="2" rx="1" /><rect x="3.5" y="16" width="17" height="2" rx="1" /></G>
export const MenuOpen = (p) => <G {...p}><rect x="3.5" y="6" width="11" height="2" rx="1" /><rect x="3.5" y="11" width="8" height="2" rx="1" /><rect x="3.5" y="16" width="11" height="2" rx="1" /><path {...line} d="m20 8.5-3.5 3.5 3.5 3.5" /></G>
export const Up = (p) => <G {...p}><path {...line} d="M12 19V5M6 11l6-6 6 6" /></G>
export const Down = (p) => <G {...p}><path {...line} d="M12 5v14M6 13l6 6 6-6" /></G>
export const Disc = (p) => <G {...p}><path d="M12 3a9 9 0 1 0 .01 0m0 6.5a2.5 2.5 0 1 1-.01 0" fillRule="evenodd" /></G>
export const Note = (p) => <G {...p}><path d="M10 4.5v10.3a3.4 3.4 0 1 0 2 3.1V8.5h6v-4z" /></G>
export const Update = (p) => <G {...p}><path {...line} d="M12 4v10M7.5 9.5 12 14l4.5-4.5M5 19.5h14" /></G>
// The browse view: tiles, rows, or one of each by what the page holds.
export const ViewGrid = (p) => <G {...p}><rect x="3.5" y="3.5" width="7.5" height="7.5" rx="2" /><rect x="13" y="3.5" width="7.5" height="7.5" rx="2" /><rect x="3.5" y="13" width="7.5" height="7.5" rx="2" /><rect x="13" y="13" width="7.5" height="7.5" rx="2" /></G>
export const ViewList = (p) => <G {...p}><rect x="3" y="4.5" width="4" height="4" rx="1.2" /><rect x="9" y="5.5" width="12" height="2" rx="1" /><rect x="3" y="10" width="4" height="4" rx="1.2" /><rect x="9" y="11" width="12" height="2" rx="1" /><rect x="3" y="15.5" width="4" height="4" rx="1.2" /><rect x="9" y="16.5" width="12" height="2" rx="1" /></G>
export const ViewAuto = (p) => <G {...p}><rect x="3.5" y="3.5" width="7.5" height="7.5" rx="2" /><rect x="13" y="3.5" width="7.5" height="7.5" rx="2" /><rect x="3.5" y="13.5" width="17" height="2.5" rx="1.25" /><rect x="3.5" y="18" width="11" height="2.5" rx="1.25" /></G>
export const Library = (p) => <G {...p}><rect x="3" y="4" width="3.5" height="16" rx="1" /><rect x="8" y="4" width="3.5" height="16" rx="1" /><path d="m13.6 5 3.4-.9 3.8 14.4-3.4.9z" /></G>
export const Collapse = (p) => <G {...p}><path {...line} d="M4 14h6v6M20 10h-6V4M4 20l6-6M20 4l-6 6" /></G>
export const Wave = (p) => <G {...p}><path {...line} d="M3 12c1.5-3 3-3 4.5 0s3 3 4.5 0 3-3 4.5 0 3 3 4.5 0" /></G>
export const Timer = (p) => <G {...p}><circle {...line} cx="12" cy="13.5" r="7" /><path {...line} d="M10 3h4M12 13.5V9.5M18 7.5l1.3-1.3" /></G>
