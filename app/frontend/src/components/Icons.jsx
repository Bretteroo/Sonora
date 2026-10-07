import './shared.css'
import React from 'react'

// Sonora's own glyphs, drawn here from primitives. Where a replica theme
// matches an app, the sizes and proportions are measured off it, but no
// bitmap, vector path or font of anyone else's is copied or traced: the one
// exception is RoomSpeaker below, from Material Design Icons, credited in
// THIRD-PARTY-NOTICES.md. Shared by every theme; a theme that wants a
// different drawing style defines its own alongside these.

const base = {
  width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.6,
  strokeLinecap: 'round', strokeLinejoin: 'round',
  'aria-hidden': true,
}

export const Play = (p) => (
  // Fills more of its box than a typical line-icon triangle: the product's
  // play glyph covers roughly 60% more area, measured in rendered pixels.
  <svg {...base} {...p}><path d="M4.6 2.2v11.6l9-5.8z" fill="currentColor" stroke="none" /></svg>
)
export const Pause = (p) => (
  <svg {...base} {...p}><path d="M5.5 3v10M10.5 3v10" /></svg>
)
export const Stop = (p) => (
  // Fills 19 of its 20px: the product's stop square is nearly the whole box.
  <svg {...base} {...p}><rect x="0.3" y="0.3" width="15.4" height="15.4" rx="0.8" fill="currentColor" stroke="none" /></svg>
)
export const Next = (p) => (
  // Drawn to the product's proportions at 24px: a 16px triangle against a 2px bar.
  <svg {...base} viewBox="0 0 24 24" strokeWidth={2} {...p}><path d="M4 4 17.5 12 4 20z" fill="currentColor" stroke="none" /><rect x="18" y="4" width="2" height="16" fill="currentColor" stroke="none" /></svg>
)
export const Prev = (p) => (
  <svg {...base} viewBox="0 0 24 24" strokeWidth={2} {...p}><path d="M20 4 6.5 12 20 20z" fill="currentColor" stroke="none" /><rect x="4" y="4" width="2" height="16" fill="currentColor" stroke="none" /></svg>
)
export const Speaker = (p) => (
  <svg {...base} {...p}><rect x="3.5" y="1.8" width="9" height="12.4" rx="2" /><circle cx="8" cy="10.4" r="2.1" /><circle cx="8" cy="5" r="1" /></svg>
)
export const VolumeOn = (p) => (
  <svg {...base} {...p}><path d="M3 6.2h2L8 3.6v8.8L5 9.8H3z" /><path d="M10.6 6a2.8 2.8 0 0 1 0 4" /></svg>
)
export const VolumeOff = (p) => (
  <svg {...base} {...p}><path d="M3 6.2h2L8 3.6v8.8L5 9.8H3z" /><path d="M11 6.5l3 3M14 6.5l-3 3" /></svg>
)
export const Group = (p) => (
  <svg {...base} {...p}><circle cx="5.4" cy="5.4" r="2.2" /><circle cx="10.8" cy="10.6" r="2.2" /><path d="M7.2 7.1l1.9 1.8" /></svg>
)
export const Signal = (p) => (
  <svg {...base} {...p}><path d="M2.5 13.5v-3M6.2 13.5v-6M9.8 13.5v-9M13.5 13.5v-11" /></svg>
)
export const Warning = (p) => (
  <svg {...base} {...p}><path d="M8 2.2 14.4 13H1.6z" /><path d="M8 6.4v3.1M8 11.4h.01" /></svg>
)
export const Refresh = (p) => (
  <svg {...base} {...p}><path d="M13.4 8a5.4 5.4 0 1 1-1.7-3.9" /><path d="M13.6 2.3v3.2h-3.2" /></svg>
)
export const Shuffle = (p) => (
  // Two 45-degree crossings ending in filled heads; ink 22x17 at 24px.
  <svg {...base} viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="butt" strokeLinejoin="miter" {...p}>
    <path d="M1 6.75h4l10.5 10.5h3.5" /><path d="M1 17.25h4l10.5-10.5h3.5" />
    <path d="M19 3.5 23 6.75l-4 3.25z" fill="currentColor" stroke="none" />
    <path d="M19 14 23 17.25l-4 3.25z" fill="currentColor" stroke="none" />
  </svg>
)
export const Repeat = (p) => (
  // Rounded loop with heads at the top-right and bottom-left; ink 22x17.
  <svg {...base} viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="butt" {...p}>
    <path d="M17 7H5a3 3 0 0 0-3 3v5.5" /><path d="M7 17.5h12a3 3 0 0 0 3-3V9" />
    <path d="M17 3.75l3.5 3.25-3.5 3.25z" fill="currentColor" stroke="none" />
    <path d="M7 14.25l-3.5 3.25 3.5 3.25z" fill="currentColor" stroke="none" />
  </svg>
)
export const RepeatOne = (p) => (
  <svg {...base} {...p}><path d="M4.6 2.9h6.2a2.6 2.6 0 0 1 2.6 2.6v1.2" /><path d="M6.3 1.3 4.5 2.9l1.8 1.7" /><path d="M11.4 13.1H5.2a2.6 2.6 0 0 1-2.6-2.6V9.3" /><path d="M9.7 14.7l1.8-1.6-1.8-1.7" /><path d="M7.4 6.6 8.4 6v4" /></svg>
)
export const Queue = (p) => (
  // Three 2px rules, the middle one shortened for a small play triangle.
  <svg {...base} viewBox="0 0 20 20" strokeWidth={2} strokeLinecap="butt" {...p}>
    <path d="M1 4h18M7.5 10h11.5M1 16h18" />
    <path d="M1.5 7.5 5.5 9.75 1.5 12z" fill="currentColor" stroke="none" />
  </svg>
)
export const Gear = (p) => (
  // Teeth drawn as one outline around the ring. An earlier version used eight
  // straight spokes, which reads as a sun rather than a cog.
  <svg {...base} {...p}>
    <path d="M6.6 1.6h2.8l.35 1.75 1.2.7 1.7-.6 1.4 2.42-1.35 1.15v1.4l1.35 1.15-1.4 2.42-1.7-.6-1.2.7-.35 1.75H6.6l-.35-1.75-1.2-.7-1.7.6-1.4-2.42L3.3 8.42v-1.4L1.95 5.87l1.4-2.42 1.7.6 1.2-.7z" />
    <circle cx="8" cy="8" r="2.15" />
  </svg>
)
export const Search = (p) => (
  <svg {...base} {...p}><circle cx="7" cy="7" r="4.4" /><path d="M10.3 10.3 14 14" /></svg>
)
export const ChevronLeft = (p) => (
  <svg {...base} {...p}><path d="M10 3 5 8l5 5" /></svg>
)
export const ChevronRight = (p) => (
  <svg {...base} {...p}><path d="M6 3l5 5-5 5" /></svg>
)
export const Note = (p) => (
  // Built from primitives to the proportions of the product's 48px art tile:
  // two filled heads, 2px stems and a 3px beam; ink 19.5x20.5 at 24px.
  //
  // One path rather than five shapes, because the placeholder is usually
  // painted in a color that carries alpha -- Liquid Glass's --t-fg-dim is
  // 42% ink -- and five overlapping shapes each composite separately, so
  // every stem, beam and head crossing came out darker than the rest and the
  // glyph read as a bundle of transparent pieces. An element is
  // painted once however many subpaths it holds, so the seams cannot appear.
  // The subpaths all wind clockwise: one drawn the other way would punch a
  // hole through the others rather than join them.
  //
  // Three places where the drawing was half a unit out, invisible while the
  // overlaps were muddy and plain once the glyph became one flat shape. Both
  // heads now sit with their widest point on their stem's right edge -- the
  // left moved out to 4.5, the right in to 16.5 -- and each stem ends on that
  // point rather than a quarter-unit past it, so the two meet as a tangent
  // instead of leaving a corner sticking out. The right stem starts at the
  // beam's own top edge (2.2143 at x=18) rather than at 1.5, where its corner
  // stood proud of the beam as a spur.
  <svg {...base} viewBox="0 0 24 24" fill="currentColor" stroke="none" {...p}>
    <path d="M6 6.5h2v12.25H6zM18 2.2143h2v12.5357h-2zM6 6.5 20 1.5v3L6 9.5zM8 18.75a3.5 3 0 1 1-7 0 3.5 3 0 1 1 7 0M20 14.75a3.5 3 0 1 1-7 0 3.5 3 0 1 1 7 0" />
  </svg>
)
export const Explicit = (p) => (
  // The mark a service puts on a track its own catalog calls explicit. The
  // web client draws a 10px rounded square in its muted gray with the E cut
  // out of it, so the page shows through -- measured off play.sonos.com's
  // album page at 1536 wide, where the square is #9fa2a8 and sits 6px after
  // the title. Cut rather than drawn: a filled E in the panel's color would
  // be wrong on every other ground, and this glyph is used on album art too.
  <svg {...base} viewBox="0 0 10 10" width={10} height={10}
       fill="currentColor" stroke="none" fillRule="evenodd" {...p}>
    <path d="M0 2a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2zM3.4 2.6v4.8h3.2V6.2H4.6v-.6h1.6V4.4H4.6v-.6h2V2.6z" />
  </svg>
)
export const ExplicitWin = (p) => (
  // Where the S1 desktop apps put their explicit mark, which is an 11x11
  // bitmap, Sonora draws its own: a 9x9 square of #868686 with softened
  // corners and an E cut out of it, in the app's 11px slot.
  //
  // Each app draws it in Now Playing and nowhere else. Windows binds it in
  // nowplaying/metadatacontrol.xaml (Width="11" Margin="5,0,5,1") for the
  // track and for the next one; the Mac app's Now Playing controller holds
  // exactly two image views for it, explicitBadgeView and
  // nextExplicitBadgeView, and no other class in the binary names one. A
  // browse row in either app carries the word in its accessible name and no
  // picture at all.
  //
  // Sonora badges the track and not the coming one: the next track's flag
  // would need the queue item's own metadata, which nothing reads yet.
  <svg {...base} viewBox="0 0 11 11" width={11} height={11}
       fill="#868686" stroke="none" fillRule="evenodd" {...p}>
    <path d="M2 1h7a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zM3.75 2.75v5.5h3.5v-1.1H5v-1.1h2v-1.1H5v-1.1h2.25v-1.1z" />
  </svg>
)
export const VolumeLow = (p) => (
  // The product's low-volume speaker: a filled horn and one 2px wave; ink
  // 12x10.5 at 24px, sitting at x=4.
  <svg {...base} viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="butt" {...p}>
    <path d="M4 10 10 6.5h1V17h-1L4 13.5z" fill="currentColor" stroke="none" />
    <path d="M13.5 8.5a5 5 0 0 1 0 6" />
  </svg>
)
export const Tv = (p) => (
  // Drawn to the 48px art tile's proportions: a 24x13 screen over a 10px stand.
  <svg {...base} viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="butt" {...p}><rect x="1" y="5" width="22" height="11" rx="1.5" /><path d="M7 20h10" /></svg>
)
export const LineIn = (p) => (
  <svg {...base} {...p}><path d="M8 1.8v6.4" /><path d="M5.4 5.2a3.6 3.6 0 1 0 5.2 0" /><circle cx="8" cy="12.6" r="1.6" /></svg>
)
export const Close = (p) => (
  <svg {...base} {...p}><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" /></svg>
)
export const ExternalLink = (p) => (
  // A box with an arrow leaving its top-right corner.
  <svg {...base} {...p}><path d="M7 3.5H4a1 1 0 0 0-1 1V12a1 1 0 0 0 1 1h7.5a1 1 0 0 0 1-1V9" /><path d="M9.5 2.5h4v4M13.5 2.5 7.5 8.5" /></svg>
)
export const Mic = (p) => (
  // A microphone on a stand, the product's Artists glyph.
  <svg {...base} {...p}><rect x="6" y="1.5" width="4" height="7" rx="2" /><path d="M4 7a4 4 0 0 0 8 0M8 11v3.5M5.5 14.5h5" /></svg>
)
export const Clef = (p) => (
  // A treble clef, the product's Composers glyph.
  <svg {...base} {...p}><path d="M8 1.5c-1.6 1.6-2.2 3.4-1.7 5.3l1.9 6.4c.4 1.2-.3 2.2-1.5 2.2-.9 0-1.5-.6-1.4-1.4" /><path d="M8.2 6.8c-2.4.4-4 2-3.7 4a3 3 0 0 0 5.8-.6c0-1.6-1.2-2.6-2.7-2.6" /></svg>
)
export const Folder = (p) => (
  <svg {...base} {...p}><path d="M1.5 4.5v8a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H8L6.5 3.2H2.5a1 1 0 0 0-1 1.3z" /></svg>
)
export const Pin = (p) => (
  <svg {...base} {...p}><path d="M9.5 1.5 14.5 6.5 12 7l-2.5 2.5V13L8 14.5 5 11.5 1.5 15M5 11.5 8.5 8 9 5.5z" /></svg>
)
export const Heart = (p) => (
  <svg {...base} {...p}><path d="M8 13.5S2 9.8 2 5.9A3 3 0 0 1 8 4.6a3 3 0 0 1 6 1.3c0 3.9-6 7.6-6 7.6z" /></svg>
)
export const Ellipsis = (p) => (
  // Three dots in a row, the product's "more options" glyph.
  <svg {...base} {...p}><circle cx="3" cy="8" r="1.3" fill="currentColor" stroke="none" /><circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none" /><circle cx="13" cy="8" r="1.3" fill="currentColor" stroke="none" /></svg>
)
export const Library = (p) => (
  <svg {...base} {...p}><path d="M2.5 3h11v10h-11z" /><path d="M5.5 3v10M9.5 3v10" /></svg>
)

// Glyphs for the desktop theme, drawn after the S1 controller's own set.
export const Replay = (p) => (
  <svg {...base} {...p}><path d="M3.2 8a4.8 4.8 0 1 0 1.4-3.4" /><path d="M3 2.6v2.6h2.6" /><path d="M6.4 6.4h1.2v3.4" /></svg>
)
export const Forward = (p) => (
  <svg {...base} {...p}><path d="M12.8 8a4.8 4.8 0 1 1-1.4-3.4" /><path d="M13 2.6v2.6h-2.6" /><path d="M6.4 6.4h1.2v3.4" /></svg>
)
export const Crossfade = (p) => (
  <svg {...base} {...p}><path d="M2 4.5v7L8 8z" /><path d="M14 4.5v7L8 8z" /></svg>
)
export const Equalizer = (p) => (
  <svg {...base} {...p}><path d="M4 14V2M8 14V2M12 14V2" /><path d="M2.4 9.5h3.2M6.4 5.5h3.2M10.4 10.5h3.2" /></svg>
)
export const Info = (p) => (
  <svg {...base} {...p}><circle cx="8" cy="8" r="6.2" /><path d="M8 7.2v3.6" /><circle cx="8" cy="5" r="0.5" fill="currentColor" /></svg>
)
// "Update Now" in the source list: two arrows side by side pointing in, the
// left one up to the right and the right one down to the left, with square
// corners -- the apps' icn_update (Assets/Browse, 72px, measured 2026-09-23).
export const Update = (p) => (
  <svg {...base} {...p}>
    <path d="M2 9.9 6.3 5.6M1.3 5.3h5.8v5.4" strokeWidth="1.8" strokeLinecap="butt" strokeLinejoin="miter" />
    <path d="M14 5.7 9.7 10M8.9 5.3v5.4h5.8" strokeWidth="1.8" strokeLinecap="butt" strokeLinejoin="miter" />
  </svg>
)
export const Star = (p) => (
  <svg {...base} {...p}><path d="M8 2.2l1.8 3.7 4 .6-2.9 2.8.7 4L8 11.4l-3.6 1.9.7-4L2.2 6.5l4-.6z" fill="currentColor" /></svg>
)
// The same star drawn hollow, for a rating not yet given: the web app's own
// pair is an outline before the press and a filled one after (2026-09-15).
export const StarOutline = (p) => (
  <svg {...base} {...p}><path d="M8 2.2l1.8 3.7 4 .6-2.9 2.8.7 4L8 11.4l-3.6 1.9.7-4L2.2 6.5l4-.6z" /></svg>
)
// A circle with a bar through it: what a service's "ban this" rating draws.
export const Prohibit = (p) => (
  <svg {...base} {...p}><circle cx="8" cy="8" r="6" /><path d="M3.8 12.2 12.2 3.8" /></svg>
)
export const Playlist = (p) => (
  <svg {...base} {...p}><path d="M2.5 4h7M2.5 7h7M2.5 10h4" /><path d="M12.5 3.5v6.2" /><circle cx="11" cy="10.4" r="1.6" fill="currentColor" /><path d="M12.5 3.5l1.8 1" /></svg>
)
export const Radio = (p) => (
  <svg {...base} {...p}><rect x="2" y="5" width="12" height="8.5" rx="1.5" /><path d="M4.5 5l7-3" /><circle cx="10.5" cy="9.3" r="1.8" /><path d="M4 8h3.2M4 10.6h3.2" /></svg>
)
export const Plus = (p) => (
  <svg {...base} {...p}><path d="M8 3v10M3 8h10" /></svg>
)
// The Mac app's group button on a room tile: a rounded square left open at
// its foot, where a filled triangle rises through the gap (drawn to the S1
// Mac app's proportions at 2x, 2026-09-23).
export const GroupRooms = (p) => (
  <svg {...base} {...p}>
    <path d="M5.4 13.4H4.6a2.1 2.1 0 0 1-2.1-2.1V4.7a2.1 2.1 0 0 1 2.1-2.1h6.8a2.1 2.1 0 0 1 2.1 2.1v6.6a2.1 2.1 0 0 1-2.1 2.1h-.8" strokeWidth="1.5" />
    <path d="M8 9.6 12 14.6H4Z" fill="currentColor" stroke="none" />
  </svg>
)
export const RoomSpeaker = (p) => (
  // Material Design Icons "speaker-multiple" by Pictogrammers, the one glyph
  // in this file that is not drawn here; its license is in
  // THIRD-PARTY-NOTICES.md. Asked for by name.
  <svg {...base} viewBox="0 0 24 24" fill="currentColor" stroke="none" {...p}>
    <path d="M14,10A3,3 0 0,0 11,13A3,3 0 0,0 14,16A3,3 0 0,0 17,13A3,3 0 0,0 14,10M14,18A5,5 0 0,1 9,13A5,5 0 0,1 14,8A5,5 0 0,1 19,13A5,5 0 0,1 14,18M14,2A2,2 0 0,1 16,4A2,2 0 0,1 14,6A2,2 0 0,1 12,4A2,2 0 0,1 14,2M19,0H9A2,2 0 0,0 7,2V18A2,2 0 0,0 9,20H19A2,2 0 0,0 21,18V2A2,2 0 0,0 19,0M5,22H17V24H5A2,2 0 0,1 3,22V4H5" />
  </svg>
)
export const ThumbUp = (p) => (
  <svg {...base} {...p}><path d="M5.5 7.5v6H3v-6z" /><path d="M5.5 7.5l2.8-4.6c.9-.3 1.7.3 1.6 1.2L9.5 7h3c.8 0 1.4.7 1.2 1.5l-1 4.2c-.1.5-.6.8-1.1.8H5.5" /></svg>
)
export const ThumbDown = (p) => (
  <svg {...base} {...p}><path d="M10.5 8.5v-6H13v6z" /><path d="M10.5 8.5l-2.8 4.6c-.9.3-1.7-.3-1.6-1.2L6.5 9h-3c-.8 0-1.4-.7-1.2-1.5l1-4.2c.1-.5.6-.8 1.1-.8h6.1" /></svg>
)
export const ChevronDown = (p) => (
  <svg {...base} {...p}><path d="M3.5 6l4.5 4.5L12.5 6" /></svg>
)
export const ChevronUp = (p) => (
  <svg {...base} {...p}><path d="M3.5 10l4.5-4.5L12.5 10" /></svg>
)
export const CaretDown = (p) => (
  <svg {...base} {...p}><path d="M3.5 6l4.5 4.5L12.5 6z" fill="currentColor" stroke="none" /></svg>
)

export const Caution = (p) => (
  // A warning triangle with a bar and dot, filled so it reads at 10px.
  <svg {...base} {...p}><path d="M8 1.6 15 14H1z" fill="currentColor" stroke="none" /><path d="M8 6v4" stroke="var(--icon-hole, #fff)" strokeWidth="1.8" /><circle cx="8" cy="12" r="1" fill="var(--icon-hole, #fff)" stroke="none" /></svg>
)

export const Moon = (p) => (
  <svg {...base} {...p}><path d="M12.8 10.4A5.4 5.4 0 0 1 5.6 3.2a5.6 5.6 0 1 0 7.2 7.2z" /></svg>
)
export const Alarm = (p) => (
  <svg {...base} {...p}><circle cx="8" cy="9" r="5" /><path d="M8 6.4V9l1.8 1.2M3.2 3.4l1.6 1.4M12.8 3.4l-1.6 1.4" /></svg>
)

// The app's placeholder for art it could not load (browse_missing_album_art):
// a gray record on a faint square.
export const Disc = (p) => (
  <svg viewBox="0 0 16 16" {...p}><rect width="16" height="16" fill="currentColor" opacity="0.06" /><circle cx="8" cy="8" r="4.6" fill="#666666" /><circle cx="8" cy="8" r="1.1" fill="#1e1e1e" /></svg>
)
// The app's mark for a favorite whose service is no longer on the system
// (icn_missing_music_service): a disc with a slashed service tile.
export const MissingService = (p) => (
  <svg viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="11" fill="currentColor" /><rect x="6" y="8" width="12" height="8" rx="1.5" fill="#222222" /><path d="M7.5 15.5l9-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
)

// The mark both S1 desktop apps put where a row's cover would go when the
// service refuses the item: Assets/Browse/restricted_track_icon (Windows) and
// Resources/restricted_track_icon.tiff (Mac), which are the same drawing --
// a filled circle cut by a diagonal bar that runs past it at both ends. The
// bitmap is 40x40 with the ink in an 18x18 box, so this is drawn at 18 from
// primitives: circle r=8 about (9,9), a 2.1-wide bar corner to corner, and a
// 1.4-wide gap either side of it. The two apps color it
// differently -- #666666 in the Windows bitmap, #868686 in the Mac one -- so
// it takes its color from the skin rather than carrying one.
//
// The library reaches for it itself (SCALBUMART_RESTRICTED in the Windows
// ArtworkFinder's table), which is why the app shows it instead of the cover
// the service did send.
export const Restricted = (p) => (
  <svg viewBox="0 0 18 18" width={18} height={18} fill="currentColor"
       stroke="none" aria-hidden {...p}>
    <mask id="sonora-restricted" maskUnits="userSpaceOnUse" x="0" y="0" width="18" height="18">
      <rect width="18" height="18" fill="#ffffff" />
      <path d="M1.25 19.25 20 0.5" stroke="#000000" strokeWidth="1.4" fill="none" />
      <path d="M-1.25 16.75 17.5 -2" stroke="#000000" strokeWidth="1.4" fill="none" />
    </mask>
    <g mask="url(#sonora-restricted)">
      <circle cx="9" cy="9" r="8" />
      <path d="M0 18 18 0" stroke="currentColor" strokeWidth="2.1" fill="none" />
    </g>
  </svg>
)

// The app's generic art tiles (assets/browse/browse_generic_*.png), used when
// an item brings no art of its own: a single note for a track, broadcast
// waves for a station, a stack of squares with a note for a container of
// tracks, and a disc for an album. Each is a gray glyph on the same faint
// square the disc already used.
export const GenericTrack = (p) => (
  <svg viewBox="0 0 16 16" {...p}>
    <rect width="16" height="16" fill="currentColor" opacity="0.06" />
    <g fill="#6f6f6f">
      <path d="M11.4 3.1 6.9 4.3v6.1a1.9 1.9 0 1 0 1.2 1.8V6.2l3.3-.9z" />
    </g>
  </svg>
)
export const GenericStation = (p) => (
  <svg viewBox="0 0 16 16" {...p}>
    <rect width="16" height="16" fill="currentColor" opacity="0.06" />
    <circle cx="8" cy="8" r="1.5" fill="#6f6f6f" />
    <g fill="none" stroke="#6f6f6f" strokeWidth="1.05" strokeLinecap="round">
      <path d="M5.5 5.9a3 3 0 0 0 0 4.2M10.5 5.9a3 3 0 0 1 0 4.2" />
      <path d="M3.6 4.2a5.5 5.5 0 0 0 0 7.6M12.4 4.2a5.5 5.5 0 0 1 0 7.6" />
    </g>
  </svg>
)
export const GenericMulti = (p) => (
  <svg viewBox="0 0 16 16" {...p}>
    <rect width="16" height="16" fill="currentColor" opacity="0.06" />
    <g fill="none" stroke="#6f6f6f" strokeWidth="1">
      <path d="M4.4 4.2h7.2M3.2 5.6h8.4" />
    </g>
    <rect x="5.6" y="6.6" width="7.4" height="7" rx="0.6" fill="#6f6f6f" />
    <path d="M11.4 7.8 9.2 8.4v2.9a.95.95 0 1 0 .6.9V9.1l1.6-.45z" fill="#2b2b2b" />
  </svg>
)
// A container that brings no art and no kind: what the app shows for every
// row of Amazon Music's home and TuneIn's Change Location rows. The app's
// tile is a folder with notes cut out of it; this is Sonora's own drawing of
// that idea, a folder with a single note cut out, filling the same 40x32 of a
// 40px square at #666666.
export const GenericContainer = (p) => (
  <svg viewBox="0 0 16 16" {...p}>
    <path fill="#666666" fillRule="evenodd"
          d="M4 5.2a.6.6 0 0 1 .6-.6h2.2l.8.8h3.8a.6.6 0 0 1 .6.6v4.6a.6.6 0 0 1-.6.6H4.6a.6.6 0 0 1-.6-.6zM9.3 6.6 7.9 7v2.1a.75.65 0 1 0 .5.6V7.5l.9-.25z" />
  </svg>
)

// TuneIn's three pinned rows in the app carry a headphone set, a radio and a
// map pin on its blue tile (2026-09-06). Sonora drew the radio for both of
// the two rows it had.
export const Headphones = (p) => (
  <svg {...base} {...p}><path d="M3 10.5V8a5 5 0 0 1 10 0v2.5" /><rect x="1.8" y="9.6" width="3" height="4.6" rx="1.3" /><rect x="11.2" y="9.6" width="3" height="4.6" rx="1.3" /></svg>
)
export const MapPin = (p) => (
  <svg {...base} {...p}><path d="M8 14.4s4.6-4.3 4.6-7.6a4.6 4.6 0 1 0-9.2 0C3.4 10.1 8 14.4 8 14.4z" /><circle cx="8" cy="6.7" r="1.8" /></svg>
)
// Group Rooms' picture when there is no music to show yet: Sonora's own
// tile, a flat blue square with the shared note glyph in white on it.
export const NoMusicTile = (p) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
    <rect width="24" height="24" fill="#6fa8d6" />
    <g transform="translate(5 5) scale(0.5833)" fill="#ffffff" fillOpacity="0.85">
      <path d="M6 6.5h2v12.25H6zM18 2.2143h2v12.5357h-2zM6 6.5 20 1.5v3L6 9.5zM8 18.75a3.5 3 0 1 1-7 0 3.5 3 0 1 1 7 0M20 14.75a3.5 3 0 1 1-7 0 3.5 3 0 1 1 7 0" />
    </g>
  </svg>
)
// A network share, as the Mac lists one: a blue sphere with linked nodes
// (the Mac app's folder table, 2026-09-29). Sonora's own drawing.
export const NetworkShare = (p) => (
  <svg viewBox="0 0 16 16" aria-hidden="true" {...p}>
    <defs>
      <radialGradient id="ns-g" cx="0.38" cy="0.32" r="0.75">
        <stop offset="0" stopColor="#6fa8ff" /><stop offset="0.55" stopColor="#1f4fc7" /><stop offset="1" stopColor="#0b1f5c" />
      </radialGradient>
    </defs>
    <circle cx="8" cy="8" r="7.2" fill="url(#ns-g)" />
    <g stroke="#dbe8ff" strokeWidth="0.7" strokeOpacity="0.85" fill="none">
      <path d="M4.2 5.6 8.3 7.4 11.6 4.9M8.3 7.4 6.6 11.8M8.3 7.4 12.1 10.2" />
    </g>
    <g fill="#ffffff">
      <circle cx="4.2" cy="5.6" r="0.9" /><circle cx="8.3" cy="7.4" r="1" /><circle cx="11.6" cy="4.9" r="0.8" />
      <circle cx="6.6" cy="11.8" r="0.8" /><circle cx="12.1" cy="10.2" r="0.8" />
    </g>
  </svg>
)
export const Stack = (p) => (
  <svg viewBox="0 0 16 16" {...p}><rect width="16" height="16" fill="currentColor" opacity="0.06" /><rect x="3" y="5.5" width="7.5" height="7.5" rx="0.8" fill="none" stroke="#8a8a8a" strokeWidth="1.1" /><path d="M5.5 5.5V3.8a.8.8 0 0 1 .8-.8h6.4a.8.8 0 0 1 .8.8v6.4a.8.8 0 0 1-.8.8h-1.7" fill="none" stroke="#8a8a8a" strokeWidth="1.1" /></svg>
)

// The Windows app's transport glyphs, drawn here from primitives to the
// sizes of its bitmaps (tc_now_playing_*.png are 44x44 and 34x44 cells; the
// tc_progress_* cells are 20x22 and 21x22 with the ink 16 wide, 1px
// hairlines). Boxes match the bitmaps so the theme can place them as the app
// does.
const winBase = { fill: 'none', stroke: 'currentColor', strokeWidth: 1, strokeLinecap: 'butt', strokeLinejoin: 'miter', 'aria-hidden': true }
export const WinPlay = (p) => (
  <svg {...winBase} width={44} height={44} viewBox="0 0 44 44" {...p}><path d="M14 11v22l19-11z" fill="currentColor" stroke="none" /></svg>
)
export const WinPause = (p) => (
  <svg {...winBase} width={44} height={44} viewBox="0 0 44 44" {...p}><rect x="15.5" y="14" width="3" height="16" fill="currentColor" stroke="none" /><rect x="25.5" y="14" width="3" height="16" fill="currentColor" stroke="none" /></svg>
)
export const WinStop = (p) => (
  <svg {...winBase} width={44} height={44} viewBox="0 0 44 44" {...p}><rect x="14" y="14" width="16" height="16" fill="currentColor" stroke="none" /></svg>
)
export const WinPrev = (p) => (
  <svg {...winBase} width={34} height={44} viewBox="0 0 34 44" {...p}><rect x="9" y="14" width="2" height="16" fill="currentColor" stroke="none" /><path d="M25 14v16L11.5 22z" fill="currentColor" stroke="none" /></svg>
)
export const WinNext = (p) => (
  <svg {...winBase} width={34} height={44} viewBox="0 0 34 44" {...p}><rect x="23" y="14" width="2" height="16" fill="currentColor" stroke="none" /><path d="M9 14v16L22.5 22z" fill="currentColor" stroke="none" /></svg>
)
export const WinShuffle = (p) => (
  <svg {...winBase} width={20} height={22} viewBox="0 0 20 22" {...p}>
    <path d="M2.5 7h3.5c2 0 3 1.6 4 4s2 4 4 4h3.5" /><path d="M2.5 15h3.5c2 0 3-1.6 4-4s2-4 4-4h3.5" />
    <path d="M15.5 5.5 17.5 7l-2 1.5" /><path d="M15.5 13.5 17.5 15l-2 1.5" />
  </svg>
)
export const WinRepeat = (p) => (
  <svg {...winBase} width={20} height={22} viewBox="0 0 20 22" {...p}>
    <path d="M15.5 7.5H5a2 2 0 0 0-2 2v3.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9.5" />
    <path d="M13.5 5.5l2 2-2 2" /><path d="M6.5 13l-2 2 2 2" />
  </svg>
)
export const WinRepeatOne = (p) => (
  <svg {...winBase} width={20} height={22} viewBox="0 0 20 22" {...p}>
    <path d="M11.5 7.5H5.5a2 2 0 0 0-2 2v3.5a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V11" />
    <path d="M6.5 13l-2 2 2 2" />
    <circle cx="14.5" cy="7.5" r="3" fill="currentColor" stroke="none" /><path d="M14.5 5.75v3.5" stroke="var(--t-bg, #0a0a0a)" />
  </svg>
)
export const WinCrossfade = (p) => (
  <svg {...winBase} width={21} height={22} viewBox="0 0 21 22" {...p}><path d="M3.5 7.5v7.5l7-3.75z" /><path d="M17.5 7.5v7.5l-7-3.75z" /></svg>
)
export const WinEqualizer = (p) => (
  <svg {...winBase} width={21} height={22} viewBox="0 0 21 22" {...p}>
    <path d="M3 6.5h5M5.5 8v7.5" /><path d="M10.5 6v8M8 15.5h5" /><path d="M15.5 6v3M13 10.5h5M15.5 12v3.5" />
  </svg>
)
// wdcr_zm_indicator_{play,pause,stop}_enable.png: 8x9 cells whose ink runs
// x1..6 over rows 0..7, drawn 80% opaque on the room card.
export const WinTilePlay = (p) => (
  <svg {...winBase} width={8} height={9} viewBox="0 0 8 9" {...p}><path d="M1 0v8l5.5-4z" fill="currentColor" stroke="none" /></svg>
)
export const WinTilePause = (p) => (
  <svg {...winBase} width={8} height={9} viewBox="0 0 8 9" {...p}><path d="M1 0h2v8H1zM5 0h2v8H5z" fill="currentColor" stroke="none" /></svg>
)
export const WinTileStop = (p) => (
  // 6x6, measured off the app's own room list (s1win-screens/main-window.png,
  // Sam's Room stopped: the marker's bounding box is 33,389..38,394). The
  // 8x9 box around it is the indicator's slot, not the glyph.
  <svg {...winBase} width={8} height={9} viewBox="0 0 8 9" {...p}><path d="M1 1h6v6H1z" fill="currentColor" stroke="none" /></svg>
)
export const WinCaretDown = (p) => (
  <svg {...winBase} width={8} height={5} viewBox="0 0 8 5" {...p}><path d="M0 0h8L4 5z" fill="currentColor" stroke="none" /></svg>
)
export const WinSearch = (p) => (
  // The magnifier painted into search_btn_box_normal.png (30x25): a #868686
  // ring 2px thick, 15px across, centered at 13.5,10.5 with a short handle.
  <svg {...winBase} width={30} height={25} viewBox="0 0 30 25" {...p}><circle cx="13.5" cy="10.5" r="6.5" strokeWidth={2} /><path d="M18.3 15.3 21.5 18.8" strokeWidth={2} /></svg>
)
export const WinVolumeOn = (p) => (
  // tc_vol_speakers_normal.png (34x34): the cone paints x5..14 over rows
  // 9..24, the inner arc x21..24 over rows 13..21 and the outer arc x25..30
  // over rows 9..24.
  <svg {...winBase} width={34} height={34} viewBox="0 0 34 34" {...p}>
    <path d="M5 13h3l5.5-4H14v16h-.5L8 21H5z" fill="currentColor" stroke="none" />
    <path d="M21.75 14q4 3.5 0 7" strokeWidth={1.5} /><path d="M26 10q7.5 7 0 14" strokeWidth={1.5} />
  </svg>
)
export const WinVolumeOff = (p) => (
  <svg {...winBase} width={34} height={34} viewBox="0 0 34 34" {...p}>
    <path d="M5 13h3l5.5-4H14v16h-.5L8 21H5z" fill="currentColor" stroke="none" />
    <path d="M22.75 14 28.75 20M28.75 14l-6 6" strokeWidth={1.5} />
  </svg>
)

// The Mini Controller's glyphs (mp_now_playing_*.png, mp_vol_*.png,
// mp_info/mp_close/mp_resize): the same 44x44 and 34x44 cells with smaller
// ink; the 22x22 chrome buttons.
export const WinMiniPlay = (p) => (
  <svg {...winBase} width={44} height={44} viewBox="0 0 44 44" {...p}><path d="M16 14v16l14-8z" fill="currentColor" stroke="none" /></svg>
)
export const WinMiniPause = (p) => (
  <svg {...winBase} width={44} height={44} viewBox="0 0 44 44" {...p}><rect x="17" y="16" width="2.5" height="12" fill="currentColor" stroke="none" /><rect x="24.5" y="16" width="2.5" height="12" fill="currentColor" stroke="none" /></svg>
)
export const WinMiniStop = (p) => (
  <svg {...winBase} width={44} height={44} viewBox="0 0 44 44" {...p}><rect x="17" y="16" width="10" height="12" fill="currentColor" stroke="none" /></svg>
)
export const WinMiniPrev = (p) => (
  <svg {...winBase} width={34} height={44} viewBox="0 0 34 44" {...p}><rect x="11.5" y="17" width="1.5" height="10" fill="currentColor" stroke="none" /><path d="M23 17v10l-9-5z" fill="currentColor" stroke="none" /></svg>
)
export const WinMiniNext = (p) => (
  <svg {...winBase} width={34} height={44} viewBox="0 0 34 44" {...p}><rect x="21" y="17" width="1.5" height="10" fill="currentColor" stroke="none" /><path d="M11 17v10l9-5z" fill="currentColor" stroke="none" /></svg>
)
export const WinMiniVolumeOn = (p) => (
  <svg {...winBase} width={34} height={44} viewBox="0 0 34 44" {...p}>
    <path d="M9 19h2l3.5-3H15v12h-.5L11 25H9z" fill="currentColor" stroke="none" />
    <path d="M19 19q2.2 3 0 6" strokeWidth={1.3} /><path d="M22 16.5q3.3 5.5 0 11" strokeWidth={1.3} />
  </svg>
)
export const WinMiniVolumeOff = (p) => (
  <svg {...winBase} width={34} height={44} viewBox="0 0 34 44" {...p}>
    <path d="M9 19h2l3.5-3H15v12h-.5L11 25H9z" fill="currentColor" stroke="none" />
    <path d="M19.5 19.5 24.5 24.5M24.5 19.5l-5 5" strokeWidth={1.3} />
  </svg>
)
export const WinMiniInfo = (p) => (
  // A filled 16px disc with the "i" cut out of it.
  <svg {...winBase} width={34} height={44} viewBox="0 0 34 44" {...p}><path fillRule="evenodd" fill="currentColor" stroke="none" d="M17 14a8 8 0 1 0 0 16a8 8 0 1 0 0-16zM16 20.5h2v6.5h-2zM16 17h2v2h-2z" /></svg>
)
export const WinMiniClose = (p) => (
  <svg {...winBase} width={22} height={22} viewBox="0 0 22 22" {...p}><path d="M7 7l8 8M15 7l-8 8" strokeWidth={2} /></svg>
)
export const WinMiniResize = (p) => (
  <svg {...winBase} width={22} height={22} viewBox="0 0 22 22" {...p}><path d="M11 6v10M6 11h10" strokeWidth={2} /></svg>
)
export const WinChevronLeft = (p) => (
  // browse_scope_back_arrow.png: a 2px chevron, 9 wide and 14 tall, in a 17x14 cell.
  <svg {...winBase} width={17} height={14} viewBox="0 0 17 14" {...p}><path d="M11 1 4 7l7 6" strokeWidth={2} /></svg>
)
export const Check = (p) => (
  // scopemenu_checkmark.png: an 11x13 tick, thick and slightly slanted.
  <svg {...winBase} width={11} height={13} viewBox="0 0 11 13" {...p}><path d="M0 6.5 4 11 10.5 1" strokeWidth={2.2} strokeLinecap="round" fill="none" /></svg>
)
export const WinLineIn = (p) => (
  // Line-in, in the Windows browse pane's 24px slot: Sonora's own drawing of
  // a jack plug, a body with a tip pointing right and a cable curving away
  // below it.
  <svg {...winBase} className="win-linein" width={24} height={24} viewBox="0 0 24 24" {...p}>
    <path fill="currentColor" stroke="none" d="M8 7h6v4H8zM14 8h2.5v2H14zM16.5 8.5H19v1h-2.5z" />
    <path d="M8 9H6.5a1.5 1.5 0 0 0-1.5 1.5V15a2 2 0 0 0 2 2h8" strokeWidth={1.5} fill="none" strokeLinecap="round" />
  </svg>
)
// A built-in source's own glyph, for the surfaces that show a service where
// the cloud has no icon for it (the search scope pill and its menu, the
// browse rows). Sonos' own ids: 254 is TuneIn, which gets Sonora's radio
// rather than TuneIn's logo; the app draws TuneIn's mark there, and that is
// TuneIn's artwork.
export function serviceGlyph(sid) {
  return Number(sid) === 254 ? Radio : Note
}

export const winTransportIcons = {
  Play: WinPlay, Pause: WinPause, Stop: WinStop, Prev: WinPrev, Next: WinNext,
  Shuffle: WinShuffle, Repeat: WinRepeat, RepeatOne: WinRepeatOne, Crossfade: WinCrossfade, Equalizer: WinEqualizer,
  CaretDown: WinCaretDown, Search: WinSearch, VolumeOn: WinVolumeOn, VolumeOff: WinVolumeOff,
}

// Glyphs the Windows app draws in the browse pane, kept apart from the
// transport set so a theme can take one without the other.
export const winBrowseIcons = { LineIn: WinLineIn, ScopeBack: WinChevronLeft }
export const Coffee = (p) => (
  // A cup with a heart and two curls of steam: what a small thank-you looks
  // like. Drawn here rather than taken from anyone's brand assets.
  <svg {...base} {...p}><path d="M2.6 6.4h8.2v3.1a3.1 3.1 0 0 1-3.1 3.1H5.7a3.1 3.1 0 0 1-3.1-3.1z" /><path d="M10.8 7.1h1.3a1.6 1.6 0 0 1 0 3.2h-1.3" /><path d="M3.4 14.4h6.6" /><path d="M6.7 8.1c-.5-.5-1.4-.2-1.4.6 0 .7 1 1.3 1.4 1.6.4-.3 1.4-.9 1.4-1.6 0-.8-.9-1.1-1.4-.6z" fill="currentColor" stroke="none" /><path d="M5.4 4.4c.6-.5.1-1.2-.2-1.7M8.2 4.4c.6-.5.1-1.2-.2-1.7" /></svg>
)
