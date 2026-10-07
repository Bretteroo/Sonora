import React from 'react'

// The spinner the desktop themes show while a system is busy: ten dots on a
// ring, each larger and darker than the one behind it, so the ring reads as
// turning towards its largest dot. Sonora's own drawing; the Sonos app's own
// busy swirl is its artwork and is not copied here.
//
// The app draws its spinner 32px in #666666 over a white mask while the
// music index is rebuilding; this one takes the same place and size. Color
// comes from currentColor, and the turn is CSS (.swirl), so a theme can place
// it anywhere.

export default function Swirl({ size = 32, className = '', title = '' }) {
  return (
    <svg className={`swirl ${className}`.trim()} width={size} height={size}
         viewBox="0 0 32 32" role={title ? 'img' : 'presentation'}
         aria-label={title || undefined} aria-hidden={title ? undefined : 'true'}
         fill="currentColor">
      <g>
      <circle cx="16.00" cy="5.00" r="1.10" fillOpacity="0.250" />
      <circle cx="22.47" cy="7.10" r="1.30" fillOpacity="0.325" />
      <circle cx="26.46" cy="12.60" r="1.50" fillOpacity="0.400" />
      <circle cx="26.46" cy="19.40" r="1.70" fillOpacity="0.475" />
      <circle cx="22.47" cy="24.90" r="1.90" fillOpacity="0.550" />
      <circle cx="16.00" cy="27.00" r="2.10" fillOpacity="0.625" />
      <circle cx="9.53" cy="24.90" r="2.30" fillOpacity="0.700" />
      <circle cx="5.54" cy="19.40" r="2.50" fillOpacity="0.775" />
      <circle cx="5.54" cy="12.60" r="2.70" fillOpacity="0.850" />
      <circle cx="9.53" cy="7.10" r="2.90" fillOpacity="0.925" />
      </g>
    </svg>
  )
}
