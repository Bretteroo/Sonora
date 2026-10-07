import React from 'react'

// The small line icons macOS Tahoe puts beside menu items, drawn here from
// primitives in Sonora's own hand: the same idea at the same size (14px
// ink in a 16px box), not the system's artwork. Which items carry one, and
// the indent the rest of their group takes, were read off the S1 app's menus
// on Tahoe (2026-09-28).

const base = {
  width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
}
const I = (children) => (p) => <svg {...base} {...p}>{children}</svg>

export const MENU_ICONS = {
  info: I(<><circle cx="8" cy="8" r="6" /><path d="M8 7.2v3.8" /><circle cx="8" cy="5" r="0.6" fill="currentColor" stroke="none" /></>),
  gear: I(<><circle cx="8" cy="8" r="2.2" /><path d="M8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M3.6 12.4l1.1-1.1M11.3 4.7l1.1-1.1" /></>),
  gears: I(<><circle cx="5.5" cy="6" r="2.4" /><circle cx="11" cy="10.5" r="1.9" /><path d="M5.5 2.6v1M5.5 8.4v1M2.1 6h1M7.9 6h1M11 7.6v1M11 12.4v1M8.1 10.5h1M12.9 10.5h1" /></>),
  hide: I(<rect x="2" y="3.5" width="12" height="9" rx="1.5" strokeDasharray="1.6 1.4" />),
  hideOthers: I(<><rect x="4.5" y="5.5" width="9.5" height="7" rx="1.2" /><path d="M2 10V4.2c0-.7.5-1.2 1.2-1.2H10" /></>),
  showAll: I(<><rect x="4.5" y="5.5" width="9.5" height="7" rx="1.2" /><rect x="2" y="3" width="9.5" height="7" rx="1.2" /></>),
  quit: I(<><rect x="2" y="2.5" width="12" height="11" rx="1.8" /><path d="M5.8 6.2l4.4 4.4M10.2 6.2l-4.4 4.4" /></>),
  cut: I(<><circle cx="4.5" cy="11.5" r="1.8" /><circle cx="11.5" cy="11.5" r="1.8" /><path d="M5.8 10.2 11.5 2.5M10.2 10.2 4.5 2.5" /></>),
  copy: I(<><rect x="5.5" y="5" width="8" height="9" rx="1.4" /><path d="M3.5 11V3.4c0-.8.6-1.4 1.4-1.4H10" /></>),
  paste: I(<><rect x="3" y="3" width="10" height="11" rx="1.4" /><rect x="5.8" y="1.8" width="4.4" height="2.4" rx="0.8" /></>),
  trash: I(<><path d="M2.5 4h11M6 4V2.6h4V4M4 4l.7 9.4h6.6L12 4" /><path d="M6.8 6.5v4.5M9.2 6.5v4.5" /></>),
  selectAll: I(<><rect x="2" y="3" width="12" height="10" rx="1.4" strokeDasharray="1.6 1.4" /><path d="M5.8 10.2 8 5l2.2 5.2M6.6 8.4h2.8" /></>),
  keyboard: I(<><rect x="1.5" y="4" width="13" height="8" rx="1.4" /><path d="M4 6.5h1M7.5 6.5h1M11 6.5h1M4.5 9.5h7" /></>),
  mic: I(<><rect x="6" y="1.8" width="4" height="7.5" rx="2" /><path d="M3.8 7.8a4.2 4.2 0 0 0 8.4 0M8 12v2.2" /></>),
  emoji: I(<><circle cx="8" cy="8" r="6" /><circle cx="6" cy="6.6" r="0.6" fill="currentColor" stroke="none" /><circle cx="10" cy="6.6" r="0.6" fill="currentColor" stroke="none" /><path d="M5.3 9.4a3.1 3.1 0 0 0 5.4 0" /></>),
  fullScreen: I(<><rect x="1.8" y="3" width="12.4" height="10" rx="1.6" /><path d="M5 8.8V7h1.8M11 7.2V9H9.2" /></>),
  close: I(<path d="M4 4l8 8M12 4l-8 8" />),
  minimize: I(<><rect x="2" y="3" width="12" height="10" rx="1.6" /><path d="M5.2 8h5.6" /></>),
  zoom: I(<><path d="M2.5 5.5V3.8c0-.7.6-1.3 1.3-1.3h1.7M10.5 2.5h1.7c.7 0 1.3.6 1.3 1.3v1.7M13.5 10.5v1.7c0 .7-.6 1.3-1.3 1.3h-1.7M5.5 13.5H3.8c-.7 0-1.3-.6-1.3-1.3v-1.7" /><rect x="5.5" y="5.5" width="5" height="5" rx="0.8" /></>),
  fill: I(<><rect x="2" y="3" width="12" height="10" rx="1.6" /><rect x="4" y="5" width="8" height="6" rx="0.6" fill="currentColor" stroke="none" /></>),
  center: I(<><rect x="2" y="3" width="12" height="10" rx="1.6" /><rect x="5.5" y="6" width="5" height="4" rx="0.6" fill="currentColor" stroke="none" /></>),
  moveResize: I(<><rect x="2" y="3" width="12" height="10" rx="1.6" /><path d="M9 6h3v3M12 6 8.5 9.5" /></>),
  tile: I(<><rect x="2" y="3" width="12" height="10" rx="1.6" /><path d="M8 3v10" /></>),
  removeFromSet: I(<><rect x="2" y="3.5" width="9.5" height="7" rx="1.2" /><path d="M5 12.8h8.2c.4 0 .8-.4.8-.8V6" /></>),
  front: I(<><path d="M8 2 14 5 8 8 2 5z" /><path d="M2 8l6 3 6-3M2 11l6 3 6-3" /></>),
  bulb: I(<><path d="M5.2 9.6a4 4 0 1 1 5.6 0c-.6.6-.9 1.2-.9 2H6.1c0-.8-.3-1.4-.9-2z" /><path d="M6.4 13.6h3.2" /></>),
}
