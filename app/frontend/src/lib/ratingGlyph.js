// Which glyph to draw for a rating button a service declared.
//
// Sonos hosts the rating icons itself and names each file by family and
// state: STAR_UNSELECTED, STAR_SELECTED, PROHIBITED_UNSELECTED,
// THUMBSUP_SELECTED, HEART_UNSELECTED and so on, one per controller skin.
// The desktop apps draw the picture for their own skin. The web app does
// not: it draws its own monochrome glyph from that family, hollow while the
// rating is not given and filled once it is (read off play.sonos.com with
// AccuRadio playing, 2026-09-15 -- its star and prohibition sign came out as
// the app's own Star and Prohibit).
//
// This reads the name Sonos gives the asset, not the service, so a service
// that declares a family listed here gets the matching glyph and one that
// declares anything else falls back to its own picture.
const FAMILIES = ['STAR', 'PROHIBITED', 'THUMBSUP', 'THUMBSDOWN', 'HEART']

export function ratingGlyph(icon) {
  const name = String(icon || '').split('/').pop().toUpperCase()
  const family = FAMILIES.find((f) => name.startsWith(`${f}_`)) || ''
  // A file that says neither is treated as not yet given, which is what an
  // unrated item's button is.
  const selected = /(^|_)SELECTED/.test(name) && !/UNSELECTED/.test(name)
  return { family, selected }
}
