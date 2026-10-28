import React from 'react'

// The room glyph the 2018 Windows app drew before every room's name: a ring
// with a small picture of the kind of room inside it, chosen by the icon the
// household keeps for the room (x-rincon-roomicon:<name>). These pictures are
// Sonora's own drawings in that style; only the choice of subjects and which
// names share one follow the app (RoomIconConverter in 9.1).

const KIND = {
  bathroom: 'bath', bath: 'bath',
  bedroom: 'bed', guestroom: 'bed', masterbedroom: 'bed',
  dining: 'glass',
  family: 'pawn', playroom: 'pawn',
  garage: 'car',
  hallway: 'door', foyer: 'door',
  kitchen: 'cutlery',
  library: 'book',
  living: 'sofa',
  media: 'tv', den: 'tv', tvroom: 'tv',
  patio: 'plant', garden: 'plant',
  pool: 'swim',
  portable: 'arrow',
  study: 'phone', office: 'phone',
  unnamedzone: 'lamp', generic: 'lamp',
}

// Each picture sits inside the ring, on a 28px grid centered at 14,14.
const PICTURES = {
  bath: (
    <>
      <path d="M7.5 13.5h13v1.5a4.5 4.5 0 0 1-4.5 4.5h-4a4.5 4.5 0 0 1-4.5-4.5z" />
      <path d="M9 19l-1 2M19 19l1 2" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <path d="M17 13.5V10a1.5 1.5 0 0 1 3 0" stroke="currentColor" strokeWidth="1.3" fill="none" />
    </>
  ),
  bed: (
    <>
      <rect x="7.5" y="9" width="1.6" height="11" />
      <rect x="7.5" y="15" width="13" height="2.4" />
      <rect x="18.9" y="15" width="1.6" height="5" />
      <rect x="9.8" y="12.6" width="3.4" height="2" rx="0.8" />
    </>
  ),
  glass: (
    <>
      <path d="M10.5 7.5h7l-.6 4.8a2.9 2.9 0 0 1-5.8 0z" />
      <rect x="13.3" y="15" width="1.4" height="4.5" />
      <rect x="11" y="19.5" width="6" height="1.4" rx="0.5" />
    </>
  ),
  pawn: (
    <>
      <circle cx="14" cy="9.3" r="2.3" />
      <path d="M12.4 12h3.2l.8 5.6h-4.8z" />
      <rect x="10" y="17.8" width="8" height="2.8" rx="0.8" />
    </>
  ),
  car: (
    <>
      <path d="M10.6 10.2h6.3l2.2 3.3h1.4a1 1 0 0 1 1 1v2.8h-15v-2.8a1 1 0 0 1 1-1h1z" />
      <circle cx="10.2" cy="18.2" r="1.7" />
      <circle cx="17.8" cy="18.2" r="1.7" />
    </>
  ),
  door: (
    <>
      <path d="M9.5 7.5h9v13h-9z M11 9v10h6V9z" fillRule="evenodd" />
      <circle cx="15.6" cy="14.3" r="0.9" />
    </>
  ),
  cutlery: (
    <>
      <path d="M8.6 8.4l11 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <path d="M19.4 8.4l-11 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <path d="M17.2 7.2l3.6 3.6-1.4 1.4-3.6-3.6z" />
    </>
  ),
  book: (
    <>
      <path d="M8 12.4l7-4.4 5 7.6-7 4.4z" />
      <path d="M8.6 14.2l4.6 7 7.2-4.6" stroke="currentColor" strokeWidth="1.1" fill="none" />
    </>
  ),
  sofa: (
    <>
      <path d="M9 10.2h10a1.6 1.6 0 0 1 1.6 1.6v1.6H7.4v-1.6A1.6 1.6 0 0 1 9 10.2z" />
      <path d="M6.6 13.6h2v3.8h10.8v-3.8h2v5.4H6.6z" />
    </>
  ),
  tv: (
    <>
      <path d="M8 11h12a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V12a1 1 0 0 1 1-1z M8.6 12.6v5.3h10.8v-5.3z" fillRule="evenodd" />
      <path d="M11.5 7.5l2.5 3 2.5-3" stroke="currentColor" strokeWidth="1.1" fill="none" />
    </>
  ),
  plant: (
    <>
      <circle cx="14" cy="9.4" r="2.6" />
      <rect x="13.3" y="11.6" width="1.4" height="6.4" />
      <path d="M14 15.4c-2.6-1.6-4.4-1-5 .4 1.6.6 3.4.4 5-.4z" />
      <path d="M14 14.2c2.4-1.8 4.3-1.4 5-.1-1.5.7-3.3.6-5 .1z" />
      <path d="M9.6 18h8.8l-1 2.6h-6.8z" />
    </>
  ),
  swim: (
    <>
      <circle cx="17.6" cy="10" r="1.7" />
      <path d="M9 13.4l4.2-2.4 2.8 3.1-2 1.2z" />
      <path d="M6.8 17.6c1.2-.9 2.4-.9 3.6 0s2.4.9 3.6 0 2.4-.9 3.6 0 2.4.9 3.6 0" stroke="currentColor" strokeWidth="1.3" fill="none" />
    </>
  ),
  arrow: (
    <>
      <path d="M14 7.6l5 5.4h-3v4.2h-4V13H9z" />
      <rect x="9.5" y="19" width="9" height="1.5" rx="0.7" />
    </>
  ),
  phone: (
    <>
      <path d="M7.6 12.2c3.8-3.1 9-3.1 12.8 0l-.9 2.2-2.6-.7-.4-1.6c-1.7-.6-3.3-.6-5 0l-.4 1.6-2.6.7z" />
      <path d="M10.6 14.6h6.8l1.8 5.2H8.8z M12.4 16.2v2h3.2v-2z" fillRule="evenodd" />
    </>
  ),
  lamp: (
    <>
      <path d="M11 8h6l2 5.4H9z" />
      <rect x="13.3" y="13.4" width="1.4" height="5" />
      <path d="M10.5 20.6a3.5 2 0 0 1 7 0z" />
    </>
  ),
}

export function roomIconKind(uri) {
  const name = String(uri || '').replace(/^x-rincon-roomicon:/, '')
  return KIND[name] || 'lamp'
}

export default function RoomIcon({ uri }) {
  return (
    <svg className="dk-room-icon" viewBox="0 0 28 28" width="28" height="28" aria-hidden="true" fill="currentColor">
      <circle cx="14" cy="14" r="11.9" fill="none" stroke="currentColor" strokeWidth="2.2" />
      {PICTURES[roomIconKind(uri)]}
    </svg>
  )
}
