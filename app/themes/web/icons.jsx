import React from 'react'

// The web client's own glyphs, where Sonora's shared set draws a different
// shape. Everything else this theme uses comes from components/Icons.jsx;
// what lives here is what play.sonos.com draws its own way.

// The volume cone. The product fills it -- a solid trapezoid pointing left
// with one arc beside it -- where Sonora's shared VolumeOn strokes an
// outline, and it paints it white rather than in the muted gray. Measured on
// play.sonos.com at 1536 wide, 2026-09-22: the ink is 12x12, it starts at the
// left edge of the text column beside it (x=1180 of a pane at 1100), and the
// slider starts 32px further on.
//
// The box is the ink, with nothing to spare: the product's glyph begins where
// its box begins, so a glyph inset inside a larger box would sit to the right
// of the name above it however the button is placed.
const cone = 'M7 0.6v10.8L2.4 8.2H0.6V3.8h1.8z'

export const VolumeCone = (p) => (
  <svg viewBox="0 0 12 12" width={12} height={12} fill="currentColor"
       stroke="none" aria-hidden="true" {...p}>
    <path d={cone} />
    <path d="M8.9 3.9a4 4 0 0 1 0 4.2l-1-.7a2.8 2.8 0 0 0 0-2.8z" />
  </svg>
)

export const VolumeConeOff = (p) => (
  <svg viewBox="0 0 12 12" width={12} height={12} fill="currentColor"
       stroke="none" aria-hidden="true" {...p}>
    <path d={cone} />
    <path d="M8.6 4.3l1.1 1.1 1.1-1.1.9.9-1.1 1.1 1.1 1.1-.9.9-1.1-1.1-1.1 1.1-.9-.9 1.1-1.1-1.1-1.1z" />
  </svg>
)

// The play triangle in a menu row. The product's fills its box -- 12 wide and
// 14 tall, its point 29px from the menu's left edge with the label 20px
// further on -- where the shared Play glyph keeps 4px of air inside its own
// box and so starts three pixels late (measured 2026-09-22).
export const PlayRow = (p) => (
  <svg viewBox="0 0 12 14" width={12} height={14} fill="currentColor"
       stroke="none" aria-hidden="true" {...p}>
    <path d="M0.5 0.6 11.5 7 0.5 13.4z" />
  </svg>
)

// The queue's own two glyphs. The product empties a queue with a bin and
// drags a track by three stacked lines; Sonora reached for a crossed circle
// and a stack of cards (measured 2026-09-22).
export const Bin = (p) => (
  <svg viewBox="0 0 20 20" width={20} height={20} fill="none" stroke="currentColor"
       strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    <path d="M3.5 5.5h13M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5" />
    <path d="M5.5 5.5 6.2 16a1 1 0 0 0 1 .9h5.6a1 1 0 0 0 1-.9l.7-10.5" />
    <path d="M8.6 8.6v5.2M11.4 8.6v5.2" />
  </svg>
)

export const Handle = (p) => (
  <svg viewBox="0 0 20 20" width={20} height={20} fill="none" stroke="currentColor"
       strokeWidth="1.6" strokeLinecap="round" aria-hidden="true" {...p}>
    <path d="M4 6.5h12M4 10h12M4 13.5h12" />
  </svg>
)

// The volume glyphs of the big player and of a room's card, drawn in a 24px
// box the way the product sets them in both: a solid wedge 7 wide and 10 tall with a flat point at the left,
// then one arc beside it while the room is on and a small cross while it is
// muted. The ink is 12x10 and 16x10 (play.sonos.com at 1600x767,
// 2026-09-24); Sonora's shared outlines were 19x16. The product may draw more
// arcs at higher levels; at 45 it draws the one.
const wedge = 'M4.4 10.2 9.4 6.9C10.1 6.4 11 6.9 11 7.7V16C11 16.8 10.1 17.2 9.4 16.8L4.4 13.4C4.2 13.2 4 12.9 4 12.6V11C4 10.7 4.2 10.4 4.4 10.2Z'

export const NpVolume = (p) => (
  <svg viewBox="0 0 24 24" width={24} height={24} fill="none" aria-hidden="true" {...p}>
    <path d={wedge} fill="currentColor" />
    <path d="M14.2 9.7a3 3 0 0 1 0 4.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
)

export const NpVolumeMute = (p) => (
  <svg viewBox="0 0 24 24" width={24} height={24} fill="none" aria-hidden="true" {...p}>
    <path d={wedge} fill="currentColor" />
    <path d="M15 9.9 19 13.9M19 9.9 15 13.9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
  </svg>
)

// One speaker, as the product draws it on a room's card and in the big
// player's room pill: an outline with a small tweeter over a ringed woofer,
// square at the top and rounder at the foot. It paints 14x18 at 20px in both
// places, where Sonora's shared speaker painted 16x20 on the card and its two
// stacked speakers 16x20 in the pill (2026-09-24).
export const SpeakerOutline = (p) => (
  <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor"
       strokeWidth="2" aria-hidden="true" {...p}>
    <path d="M7 2h10a2 2 0 0 1 2 2v15a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V4a2 2 0 0 1 2-2z" />
    <circle cx="12" cy="7" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="12" cy="15" r="3" />
  </svg>
)

// The big player's transport glyphs. The product's play is a broad triangle,
// 28x32 in its 80px disc (Sonora's shared one painted 21x28), and its pause
// two thin bars the same height; they are drawn here in a 48px box, the size
// that puts them there. Shuffle is two S-curves crossing, each with an
// arrowhead at the right, and Repeat a loop with round ends, one arrow along
// the top and one along the foot -- where the shared glyphs cross straight
// lines and square the loop's corners. Both paint 28x21 at 32px
// (play.sonos.com at 1600x767, 2026-09-24).
export const NpPlay = (p) => (
  <svg viewBox="0 0 48 48" width={48} height={48} fill="currentColor" aria-hidden="true" {...p}>
    <path d="M14 9.05v29.9c0 .81.86 1.3 1.55.9l25.93-14.94c.7-.4.7-1.41 0-1.82L15.55 8.15C14.86 7.75 14 8.24 14 9.05z" />
  </svg>
)

// The product's stop square, 44px with 4px corners in the 80px disc.
export const NpStop = (p) => (
  <svg viewBox="0 0 48 48" width={48} height={48} fill="currentColor" aria-hidden="true" {...p}>
    <rect x="2" y="2" width="44" height="44" rx="4.4" />
  </svg>
)

export const NpPause = (p) => (
  <svg viewBox="0 0 48 48" width={48} height={48} fill="currentColor" aria-hidden="true" {...p}>
    <rect x="12" y="8" width="4" height="32" rx="1" />
    <rect x="32" y="8" width="4" height="32" rx="1" />
  </svg>
)

export const NpShuffle = (p) => (
  <svg viewBox="0 0 24 24" width={32} height={32} fill="none" aria-hidden="true" {...p}>
    <g stroke="currentColor" strokeWidth="1.8">
      <path d="M1 18.9c6.2-.2 9.1-3.8 11.2-6.8s4-5.15 7.3-5.15" />
      <path d="M1 6.04c4.9.16 7.4 2.26 9.17 4.27M13.55 14.6c1.85 2 3.55 3.3 5.85 3.3" />
    </g>
    <g fill="currentColor" stroke="currentColor" strokeWidth="0.6" strokeLinejoin="round">
      <path d="M19.3 4.5 22.4 6.95 19.3 9.4z" />
      <path d="M19.3 15.45 22.4 17.9 19.3 20.35z" />
    </g>
  </svg>
)

export const NpRepeat = (p) => (
  <svg viewBox="0 0 24 24" width={32} height={32} fill="none" aria-hidden="true" {...p}>
    <g stroke="currentColor" strokeWidth="1.8">
      <path d="M17 7H7.6A5.7 5.1 0 0 0 2.66 14.65" />
      <path d="M7 17h9.4a5.7 5.1 0 0 0 4.94-7.65" />
    </g>
    <g fill="currentColor" stroke="currentColor" strokeWidth="0.6" strokeLinejoin="round">
      <path d="M16.9 4.5 20.1 7 16.9 9.5z" />
      <path d="M7.1 14.5 3.9 17 7.1 19.5z" />
    </g>
  </svg>
)

// Repeat one is the same loop with a disc over its upper arrowhead and a 1
// cut out of the disc, 9px across and centered at (18.5, 6) of the 24px
// glyph (play.sonos.com's bar on a queue, 2026-09-28). The 1 is a
// hole rather than a black stroke so the glyph reads on a tinted card too.
export const NpRepeatOne = (p) => {
  const id = React.useId()
  return (
    <svg viewBox="0 0 24 24" width={32} height={32} fill="none" aria-hidden="true" {...p}>
      <defs>
        <mask id={id}>
          <rect width="24" height="24" fill="#fff" />
          <circle cx="18.5" cy="6" r="5.9" fill="#000" />
        </mask>
      </defs>
      <g mask={`url(#${id})`}>
        <g stroke="currentColor" strokeWidth="1.8">
          <path d="M17 7H7.6A5.7 5.1 0 0 0 2.66 14.65" />
          <path d="M7 17h9.4a5.7 5.1 0 0 0 4.94-7.65" />
        </g>
        <path d="M7.1 14.5 3.9 17 7.1 19.5z" fill="currentColor" stroke="currentColor"
              strokeWidth="0.6" strokeLinejoin="round" />
      </g>
      <path fill="currentColor" fillRule="evenodd"
            d="M18.5 1.5a4.5 4.5 0 1 1 0 9a4.5 4.5 0 1 1 0-9zM18.95 3.7h-.8l-1.25.75v.9l1.1-.6V8.3h.95z" />
    </svg>
  )
}

// What a room's card shows for a station with no picture: a dot with two arcs
// either side, 14x8 of ink in the middle of the 32px tile, drawn in black at
// 35% so it reads darker than the tile rather than lighter -- rgb(35,37,38)
// on rgb(54,57,58) for AccuRadio's Chill on a stopped room
// (play.sonos.com, 2026-09-24). Sonora drew its light note there.
//
// The big player draws the same glyph across its 342px tile, 143x90 of ink,
// and it is drawn from that size: a dot a third of the glyph's height, arcs
// close round it (2026-09-24).
export const StationGlyph = (p) => (
  <svg viewBox="0 0 16 16" width={16} height={16} fill="none" stroke="currentColor"
       strokeWidth="1.2" strokeLinecap="round" aria-hidden="true" {...p}>
    <circle cx="8" cy="8" r="1.55" fill="currentColor" stroke="none" />
    <path d="M5.5 6a3.2 3.2 0 0 0 0 4M10.5 6a3.2 3.2 0 0 1 0 4" />
    <path d="M3.5 4.2a5.9 5.9 0 0 0 0 7.6M12.5 4.2a5.9 5.9 0 0 1 0 7.6" />
  </svg>
)
