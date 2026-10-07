import React from 'react'
import Base from '../../frontend/src/components/Art.jsx'

import { nowPlayingArt as baseArt } from '../../frontend/src/components/Art.jsx'
import { holdsStation } from './useTransport.js'

export { artUrl, cachedArt } from '../../frontend/src/components/Art.jsx'

// A stopped station keeps the cover of the last song it played, fetched
// through /getaa for that song's own URI, and the product draws the station
// placeholder instead: a stopped Lovers Rock Reggae showed radio waves on its
// card and in the bar while the speaker still offered Love Grows' cover
// (play.sonos.com, 2026-09-28). Art that names the station's own URI stays.
export function nowPlayingArt(host, transport) {
  const list = baseArt(host, transport)
  if (!holdsStation(transport)) return list
  // Both URIs are compared without their query strings, since the one
  // inside /getaa carries its own &-separated parameters.
  const bare = (uri) => {
    let out = uri
    for (let i = 0; i < 3; i += 1) {
      try { out = decodeURIComponent(out) } catch { break }
    }
    return out.split('?')[0].toLowerCase()
  }
  const own = bare(transport.media_uri || '')
  return list.filter((url) => {
    let decoded = url
    try { decoded = decodeURIComponent(decodeURIComponent(url)) } catch { /* keep it */ }
    const named = /\/getaa\?(?:[^]*?&)?u=([^&]+)/.exec(decoded)?.[1]
    return !named || bare(named) === own
  })
}

// The web theme's art, which differs from the apps' in one way: a browser
// draws SVG, so this theme shows the vector icons the desktop replicas skip
// (play.sonos.com draws Pandora's stations glyph, an SVG at every size the
// service publishes above 40px; the S1 app decodes bitmaps only and shows a
// disc in its place).
//
// Its placeholder is the product's too: a note on a gray tile for anything
// without a picture, and radio waves for a station (AccuRadio's Most Popular
// Channels), whether the art was never offered or would not load. The apps'
// disc for broken art is theirs alone. `kind` is the row's
// itemType where the caller knows it.
const STATIONS = new Set(['program', 'stream', 'station'])

export default function Art({ kind = '', fallback, ...props }) {
  const glyph = fallback || (STATIONS.has(kind) ? 'station' : 'note')
  return <Base vector fallback={glyph} brokenFallback={glyph} {...props} />
}
