import React from 'react'

// Glyphs Sonofuture adds to the shared set: navigation and control marks the
// other themes have no use for. Drawn in the same 16-unit box and stroke as
// components/Icons.jsx so the two sets mix on one row.
const base = {
  width: 18, height: 18, viewBox: '0 0 16 16', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.5,
  strokeLinecap: 'round', strokeLinejoin: 'round',
  'aria-hidden': true,
}

export const Home = (p) => (
  <svg {...base} {...p}><path d="M2.5 7.5 8 3l5.5 4.5V13a.8.8 0 0 1-.8.8H3.3a.8.8 0 0 1-.8-.8z" /><path d="M6.3 13.8V9.6h3.4v4.2" /></svg>
)
export const Grid = (p) => (
  <svg {...base} {...p}><rect x="2.2" y="2.2" width="4.8" height="4.8" rx="1.2" /><rect x="9" y="2.2" width="4.8" height="4.8" rx="1.2" /><rect x="2.2" y="9" width="4.8" height="4.8" rx="1.2" /><rect x="9" y="9" width="4.8" height="4.8" rx="1.2" /></svg>
)
export const Rows = (p) => (
  <svg {...base} {...p}><path d="M2.5 4h11M2.5 8h11M2.5 12h11" /></svg>
)
export const Rooms = (p) => (
  <svg {...base} {...p}><rect x="3.2" y="1.8" width="9.6" height="12.4" rx="1.6" /><circle cx="8" cy="9.6" r="2.3" /><circle cx="8" cy="4.6" r="0.9" fill="currentColor" stroke="none" /></svg>
)
export const Bell = (p) => (
  <svg {...base} {...p}><path d="M4 11.5V7.6a4 4 0 0 1 8 0v3.9l1 1.2H3z" /><path d="M6.6 14a1.5 1.5 0 0 0 2.8 0" /></svg>
)
export const Sliders = (p) => (
  <svg {...base} {...p}><path d="M3 3.5v9M8 3.5v9M13 3.5v9" /><circle cx="3" cy="6" r="1.4" fill="var(--t-bg)" /><circle cx="8" cy="10" r="1.4" fill="var(--t-bg)" /><circle cx="13" cy="5" r="1.4" fill="var(--t-bg)" /></svg>
)
export const Ellipsis = (p) => (
  <svg {...base} {...p}><circle cx="3.5" cy="8" r="1.1" fill="currentColor" stroke="none" /><circle cx="8" cy="8" r="1.1" fill="currentColor" stroke="none" /><circle cx="12.5" cy="8" r="1.1" fill="currentColor" stroke="none" /></svg>
)
export const ArrowLeft = (p) => (
  <svg {...base} {...p}><path d="M13 8H3.5M7.5 4 3.5 8l4 4" /></svg>
)
export const Expand = (p) => (
  <svg {...base} {...p}><path d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9 7M2.5 13.5 7 9" /></svg>
)
export const Collapse = (p) => (
  <svg {...base} {...p}><path d="M3 13l4-4M13 3 9 7M7 9v3.5H3.5M9 7V3.5h3.5" /></svg>
)
export const Search = (p) => (
  <svg {...base} {...p}><circle cx="7" cy="7" r="4.3" /><path d="m10.3 10.3 3.2 3.2" /></svg>
)
export const Close = (p) => (
  <svg {...base} {...p}><path d="M4 4l8 8M12 4l-8 8" /></svg>
)
export const Plus = (p) => (
  <svg {...base} {...p}><path d="M8 3v10M3 8h10" /></svg>
)
export const Check = (p) => (
  <svg {...base} {...p}><path d="m3 8.4 3.2 3.1L13 4.6" /></svg>
)
export const Chevron = (p) => (
  <svg {...base} {...p}><path d="m6 3.5 4.5 4.5L6 12.5" /></svg>
)
export const ChevronDown = (p) => (
  <svg {...base} {...p}><path d="m3.5 6 4.5 4.5L12.5 6" /></svg>
)
export const Play = (p) => (
  <svg {...base} {...p}><path d="M5 2.8v10.4l8.2-5.2z" fill="currentColor" stroke="none" /></svg>
)
export const Pause = (p) => (
  <svg {...base} {...p}><rect x="3.6" y="2.8" width="3" height="10.4" rx="0.8" fill="currentColor" stroke="none" /><rect x="9.4" y="2.8" width="3" height="10.4" rx="0.8" fill="currentColor" stroke="none" /></svg>
)
export const Stop = (p) => (
  <svg {...base} {...p}><rect x="3.2" y="3.2" width="9.6" height="9.6" rx="1.4" fill="currentColor" stroke="none" /></svg>
)
export const Prev = (p) => (
  <svg {...base} {...p}><path d="M12.5 3v10L5.5 8z" fill="currentColor" stroke="none" /><rect x="2.8" y="3" width="1.8" height="10" rx="0.6" fill="currentColor" stroke="none" /></svg>
)
export const Next = (p) => (
  <svg {...base} {...p}><path d="M3.5 3v10l7-5z" fill="currentColor" stroke="none" /><rect x="11.4" y="3" width="1.8" height="10" rx="0.6" fill="currentColor" stroke="none" /></svg>
)
export const Volume = (p) => (
  <svg {...base} {...p}><path d="M2.5 6.2v3.6h2.4L8.2 13V3L4.9 6.2z" fill="currentColor" stroke="none" /><path d="M10.4 5.6a3.2 3.2 0 0 1 0 4.8M12.3 3.8a5.8 5.8 0 0 1 0 8.4" /></svg>
)
export const Muted = (p) => (
  <svg {...base} {...p}><path d="M2.5 6.2v3.6h2.4L8.2 13V3L4.9 6.2z" fill="currentColor" stroke="none" /><path d="m10.3 6.2 3.4 3.6M13.7 6.2l-3.4 3.6" /></svg>
)
export const Queue = (p) => (
  <svg {...base} {...p}><path d="M2.5 4h7M2.5 8h7M2.5 12h5" /><path d="M11.5 7.2v5.2l3-2.6z" fill="currentColor" stroke="none" /></svg>
)
export const Shuffle = (p) => (
  <svg {...base} {...p}><path d="M2.5 4.5h1.8c1.3 0 2.2.6 3 1.7l1.4 2.1c.8 1.1 1.7 1.7 3 1.7h1.3M2.5 11.5h1.8c1.3 0 2.2-.6 3-1.7M8.2 6.2c.8-1.1 1.7-1.7 3-1.7h1.8" /><path d="m11.8 2.8 1.9 1.7-1.9 1.7M11.8 8.3l1.9 1.7-1.9 1.7" /></svg>
)
export const Repeat = (p) => (
  <svg {...base} {...p}><path d="M3 9V7.2A2.7 2.7 0 0 1 5.7 4.5H13M13 7v1.8a2.7 2.7 0 0 1-2.7 2.7H3" /><path d="m11.2 2.6 1.9 1.9-1.9 1.9M4.8 9.5 2.9 11.4l1.9 1.9" /></svg>
)
export const RepeatOne = (p) => (
  <svg {...base} {...p}><path d="M3 9V7.2A2.7 2.7 0 0 1 5.7 4.5H13M13 7v1.8a2.7 2.7 0 0 1-2.7 2.7H3" /><path d="m11.2 2.6 1.9 1.9-1.9 1.9M4.8 9.5 2.9 11.4l1.9 1.9" /><path d="M7.4 7.1 8.4 6.4V9.6" strokeWidth="1.3" /></svg>
)
export const Crossfade = (p) => (
  <svg {...base} {...p}><path d="M2.5 11.5c3 0 4-7 7-7h4M2.5 4.5c3 0 4 7 7 7h4" /></svg>
)
export const Moon = (p) => (
  <svg {...base} {...p}><path d="M13.2 9.8A5.6 5.6 0 0 1 6.2 2.8a5.6 5.6 0 1 0 7 7z" /></svg>
)
export const Info = (p) => (
  <svg {...base} {...p}><circle cx="8" cy="8" r="5.8" /><path d="M8 7.2v4M8 4.9v.1" /></svg>
)
export const Star = (p) => (
  <svg {...base} {...p}><path d="m8 2.3 1.8 3.7 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4L2.2 6.6l4-.6z" /></svg>
)
export const Heart = (p) => (
  <svg {...base} {...p}><path d="M8 13.5 3.1 8.8a3 3 0 0 1 4.3-4.2L8 5.2l.6-.6a3 3 0 0 1 4.3 4.2z" /></svg>
)
export const Playlist = (p) => (
  <svg {...base} {...p}><path d="M2.5 4h8M2.5 7.5h8M2.5 11h4.5" /><circle cx="11.6" cy="11.3" r="1.8" /><path d="M13.4 11.3V6.5l1.2.5" /></svg>
)
export const Library = (p) => (
  <svg {...base} {...p}><path d="M2.5 3v10M6 3v10M9.4 3.6l3.5 9.1" /></svg>
)
export const Radio = (p) => (
  <svg {...base} {...p}><rect x="2" y="5.5" width="12" height="8" rx="1.6" /><circle cx="5.8" cy="9.5" r="1.9" /><path d="M10 8h2.3M10 10.6h2.3M4.5 5.5 11 2.5" /></svg>
)
export const Tv = (p) => (
  <svg {...base} {...p}><rect x="2" y="3" width="12" height="8" rx="1.4" /><path d="M5.5 13.5h5" /></svg>
)
export const LineIn = (p) => (
  <svg {...base} {...p}><path d="M8 2.5v5M5.3 7.5h5.4v1.6a2.7 2.7 0 0 1-5.4 0z" /><path d="M8 11.8v1.7" /></svg>
)
export const Speaker = (p) => (
  <svg {...base} {...p}><rect x="3.5" y="1.8" width="9" height="12.4" rx="1.6" /><circle cx="8" cy="9.4" r="2.2" /><circle cx="8" cy="4.8" r="0.9" fill="currentColor" stroke="none" /></svg>
)
export const Link = (p) => (
  <svg {...base} {...p}><path d="M6.6 9.4a2.6 2.6 0 0 1 0-3.7l1.9-1.9a2.6 2.6 0 0 1 3.7 3.7l-.9.9M9.4 6.6a2.6 2.6 0 0 1 0 3.7l-1.9 1.9a2.6 2.6 0 0 1-3.7-3.7l.9-.9" /></svg>
)
export const Unlink = (p) => (
  <svg {...base} {...p}><path d="M6.6 9.4a2.6 2.6 0 0 1 0-3.7l1-1M9.4 6.6a2.6 2.6 0 0 1 0 3.7l-1 1M3 3l10 10" /></svg>
)
// Leaving a group: Material Design Icons' "link-off" (Apache-2.0, see
// THIRD-PARTY-NOTICES.md), filled on its own 24px grid.
export const LeaveGroup = (p) => (
  <svg width={base.width} height={base.height} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
    <path d="M17,7H13V8.9H17C18.71,8.9 20.1,10.29 20.1,12C20.1,13.43 19.12,14.63 17.79,15L19.25,16.44C20.88,15.61 22,13.95 22,12A5,5 0 0,0 17,7M16,11H13.81L15.81,13H16V11M2,4.27L5.11,7.38C3.29,8.12 2,9.91 2,12A5,5 0 0,0 7,17H11V15.1H7C5.29,15.1 3.9,13.71 3.9,12C3.9,10.41 5.11,9.1 6.66,8.93L8.73,11H8V13H10.73L13,15.27V17H14.73L18.74,21L20,19.74L3.27,3L2,4.27Z" />
  </svg>
)
// The account: a head over shoulders.
export const Person = (p) => (
  <svg {...base} {...p}><circle cx="8" cy="5.5" r="2.6" /><path d="M2.8 13.6c.6-2.6 2.7-4.1 5.2-4.1s4.6 1.5 5.2 4.1" /></svg>
)
export const Refresh = (p) => (
  <svg {...base} {...p}><path d="M13 8a5 5 0 1 1-1.5-3.6" /><path d="M13 2.8v3.4H9.6" /></svg>
)
// The speakers' software update: an arrow down into a tray.
export const Update = (p) => (
  <svg {...base} {...p}><path d="M8 2.5v7M5 6.8 8 9.8l3-3" /><path d="M2.8 10.5v1.8c0 .5.4.9.9.9h8.6c.5 0 .9-.4.9-.9v-1.8" /></svg>
)
export const Signal = (p) => (
  <svg {...base} {...p}><path d="M2.5 12.5h1.5M5.5 12.5v-3M8.5 12.5V6M11.5 12.5V3" /></svg>
)
export const Clock = (p) => (
  <svg {...base} {...p}><circle cx="8" cy="8" r="5.8" /><path d="M8 4.8V8l2.3 1.4" /></svg>
)
export const Pin = (p) => (
  <svg {...base} {...p}><path d="M8 14s4.3-4 4.3-7.4A4.3 4.3 0 0 0 3.7 6.6C3.7 10 8 14 8 14z" /><circle cx="8" cy="6.6" r="1.5" /></svg>
)
export const Keyboard = (p) => (
  <svg {...base} {...p}><rect x="1.8" y="4" width="12.4" height="8" rx="1.4" /><path d="M4.3 6.8h.1M6.8 6.8h.1M9.3 6.8h.1M11.8 6.8h.1M4.8 9.6h6.4" /></svg>
)
export const Sparkle = (p) => (
  <svg {...base} {...p}><path d="M8 2.2c.4 3 1.6 4.4 5.8 5.8-4.2 1.4-5.4 2.8-5.8 5.8-.4-3-1.6-4.4-5.8-5.8 4.2-1.4 5.4-2.8 5.8-5.8z" fill="currentColor" stroke="none" /></svg>
)
export const Drag = (p) => (
  <svg {...base} {...p}><circle cx="6" cy="4" r="1" fill="currentColor" stroke="none" /><circle cx="10" cy="4" r="1" fill="currentColor" stroke="none" /><circle cx="6" cy="8" r="1" fill="currentColor" stroke="none" /><circle cx="10" cy="8" r="1" fill="currentColor" stroke="none" /><circle cx="6" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="10" cy="12" r="1" fill="currentColor" stroke="none" /></svg>
)
export const Trash = (p) => (
  <svg {...base} {...p}><path d="M3 4.5h10M6.3 4.5V3h3.4v1.5M4.3 4.5l.6 8.3h6.2l.6-8.3" /></svg>
)
export const Pencil = (p) => (
  <svg {...base} {...p}><path d="m3 13 .6-3 7.2-7.2 2.4 2.4L6 12.4z" /></svg>
)
export const Note = (p) => (
  // Stem and heads in one path, not three shapes: these themes paint dim text
  // in a color that carries alpha, and three strokes that touch composite
  // twice where they meet, leaving a dark wedge on each head. One element is
  // painted once however many subpaths it holds.
  <svg {...base} {...p}><path d="M6.3 12.2V3.5l6.2-1.2v8.3M6.3 12.2a1.9 1.9 0 1 1-3.8 0 1.9 1.9 0 0 1 3.8 0M12.5 10.6a1.9 1.9 0 1 1-3.8 0 1.9 1.9 0 0 1 3.8 0" /></svg>
)
export const Disc = (p) => (
  <svg {...base} {...p}><circle cx="8" cy="8" r="5.8" /><circle cx="8" cy="8" r="1.6" /></svg>
)
export const Folder = (p) => (
  <svg {...base} {...p}><path d="M2.2 4.6c0-.7.5-1.2 1.2-1.2h3l1.4 1.5h4.8c.7 0 1.2.5 1.2 1.2v5.7c0 .7-.5 1.2-1.2 1.2H3.4c-.7 0-1.2-.5-1.2-1.2z" /></svg>
)
export const ThumbUp = (p) => (
  <svg {...base} {...p}><path d="M5.5 7.2v6.3M2.5 8.2c0-.6.4-1 1-1h2l2.6-4.5a1.3 1.3 0 0 1 2.4.8L9.9 6.2h2.7a1.3 1.3 0 0 1 1.3 1.5l-.8 4.6a1.3 1.3 0 0 1-1.3 1.2H3.5a1 1 0 0 1-1-1z" /></svg>
)
export const ThumbDown = (p) => (
  <svg {...base} {...p}><path d="M10.5 8.8V2.5M13.5 7.8c0 .6-.4 1-1 1h-2l-2.6 4.5a1.3 1.3 0 0 1-2.4-.8l.6-2.7H3.4a1.3 1.3 0 0 1-1.3-1.5l.8-4.6A1.3 1.3 0 0 1 4.2 2.5h8.3a1 1 0 0 1 1 1z" /></svg>
)
export const Sun = (p) => (
  <svg {...base} {...p}><circle cx="8" cy="8" r="3" /><path d="M8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M3.6 12.4l1.1-1.1M11.3 4.7l1.1-1.1" /></svg>
)
export const Warning = (p) => (
  <svg {...base} {...p}><path d="M8 2.5 14 13H2z" /><path d="M8 6.5v3M8 11.6v.1" /></svg>
)
// The mark a service puts on a track its own catalog calls explicit. Drawn
// solid with the letter knocked out, so it reads at 11px and sits correctly
// on art as well as on a row -- the shape every Sonos client uses, in this
// theme's rounding.
export const Explicit = (p) => (
  <svg {...base} viewBox="0 0 12 12" width={12} height={12}
       fill="currentColor" stroke="none" fillRule="evenodd" {...p}>
    <path d="M0 3a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H3a3 3 0 0 1-3-3zM4 3v6h4V7.8H5.2v-1.2H7.6V5.4H5.2V4.2H8V3z" />
  </svg>
)

// Content Filters: the circle-and-bar every interface uses for "not this".
export const Prohibit = (p) => (
  <svg {...base} {...p}><circle cx="8" cy="8" r="5.6" /><path d="M4 12 12 4" /></svg>
)
export const Sonos = (p) => (
  <svg {...base} {...p}><circle cx="8" cy="8" r="2.4" /><path d="M4.2 4.2a5.4 5.4 0 0 0 0 7.6M11.8 4.2a5.4 5.4 0 0 1 0 7.6" /></svg>
)
