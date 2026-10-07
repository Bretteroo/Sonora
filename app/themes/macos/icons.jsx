import React from 'react'

// Glyphs the Mac app draws its own way, redrawn from the app at 2x.

// The transport's EQ button (2026-09-23): three 1pt bars in a 14 x 10pt
// box, each with a 4pt knob set off from it by a gap -- the left knob at
// the top, the middle at the foot, the right between.
export const MacEqualizer = (p) => (
  // On the transport's 14px grid, so the box is the app's 14 x 10pt, and on
  // whole pixels so it stays sharp at 1x.
  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true" {...p}>
    <rect x="0" y="2" width="4" height="1" />
    <rect x="2" y="4" width="1" height="8" />
    <rect x="7" y="2" width="1" height="8" />
    <rect x="5" y="11" width="4" height="1" />
    <rect x="12" y="2" width="1" height="3" />
    <rect x="10" y="6" width="4" height="1" />
    <rect x="12" y="8" width="1" height="4" />
  </svg>
)

// Crossfade (2026-09-23): two verticals and the diagonals between them, the
// one rising to the right broken where it passes under the other, 15 x 8.5pt.
// Wider than the 14px the other mode glyphs get, so mac.css gives it 16.
export const MacCrossfade = (p) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="0.9"
       strokeLinejoin="miter" aria-hidden="true" {...p}>
    <path d="M1 11.8V4.2L15 11.8V4.2L9.3 7.3" />
    <path d="M6.7 8.7 1 11.8" />
  </svg>
)

// Play, pause, and stop as the running app draws them (two rooms
// at 2x, 2026-09-28), in the 28px box the play button gives a glyph,
// all centered 80.75pt down the window: an 18 x 20.5pt triangle, and a
// 13 x 16pt stop block, taller than wide, the skip glyphs' height. Pause
// fills the same box with two 3pt bars, their ends rounded.
export const MacPlay = (p) => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="currentColor" aria-hidden="true" {...p}>
    <path d="M5.5 3.75v20.5l18-10.25z" />
  </svg>
)
export const MacPause = (p) => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="currentColor" aria-hidden="true" {...p}>
    <rect x="7.5" y="6" width="3" height="16" rx="0.75" /><rect x="17.5" y="6" width="3" height="16" rx="0.75" />
  </svg>
)
export const MacStop = (p) => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="currentColor" aria-hidden="true" {...p}>
    <rect x="7.5" y="6" width="13" height="16" />
  </svg>
)

// The transport's speaker (2x, 2026-09-28): a 3.2pt box and a cone 15.8pt
// tall, then two 1.5pt arcs, the whole 22.5 x 15.5pt.
export const MacVolumeOn = (p) => (
  <svg width="24" height="18" viewBox="0 0 24 18" aria-hidden="true" {...p}>
    <rect x="0.4" y="5.6" width="3.3" height="7.2" fill="currentColor" />
    <path d="M3.6 5.6 9.4 1.1v15.8l-5.8-4.5z" fill="currentColor" />
    <path d="M15.4 5.6Q18.9 9.2 15.4 12.8M19.9 1.6Q25.1 9 19.9 16.4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

export const macTransportIcons = { Equalizer: MacEqualizer, Crossfade: MacCrossfade, Play: MacPlay, Pause: MacPause, Stop: MacStop, VolumeOn: MacVolumeOn }
