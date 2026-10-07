import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as Icon from './Icons.jsx'

// Album art with a real fallback.
//
// An <img> whose source fails renders as a broken-image glyph no matter how it
// is styled, because there is nothing inside it to show instead. Art routinely
// fails here: speakers serve their own covers fine, but anything proxied by a
// third-party bridge on the network may be unreachable from the browser even
// when the backend can fetch it. So the failure is tracked in state and a
// different element is rendered.

const FALLBACKS = {
  note: Icon.Note,
  disc: Icon.Disc,
  track: Icon.GenericTrack,
  station: Icon.GenericStation,
  multi: Icon.GenericMulti,
  container: Icon.GenericContainer,
  playlist: Icon.Playlist,
}

// `src` may be one URL or a list of candidates tried in order: the speaker's
// own /getaa proxy first and the provider's URL after it. Some services'
// pictures never come through the proxy (AccuRadio answers 404 for whole
// tracks, measured 2026-09-07) while the apps show the cover the service
// itself names, so a failed candidate hands over to the next.
// The sizes Sonora keeps a picture at (backend/sonos/artcache.py SIZES).
const ART_SIZES = [64, 128, 256, 512, 1024]
const bucketFor = (px) => ART_SIZES.find((b) => b >= px) || 0

// Sonora's own picture URL asked for no larger than `px` device pixels, as
// the apps keep browse art at 40px rather than decoding the full cover: a
// library's covers are often a megabyte each. Other URLs pass unchanged.
//
// A URL marked for the best copy (nowPlayingArt's `best`) is not shrunk: it
// is told the size drawn, and the backend asks the source for that much.
export function sizedArtUrl(url, px) {
  if (typeof url === 'string' && url.startsWith('/api/art?') && /[?&]best=1(&|$)/.test(url)) {
    const drawn = Math.min(4096, Math.max(512, Math.ceil(px / 256) * 256))
    return url.replace(/([?&])best=1(?=&|$)/, `$1best=${drawn}`)
  }
  const bucket = bucketFor(px)
  if (!bucket || typeof url !== 'string' || !url.startsWith('/api/art?')) return url
  return `${url}&s=${bucket}`
}

// A picture that would not load is asked for again after these waits, the
// next candidate (or the placeholder) standing in meanwhile. A speaker asked
// for a new track's art the moment the track changes may not have it yet,
// and a picture that failed once stayed failed until the page was reloaded.
// After the last wait it is given up on.
const RETRY_MS = [3000, 10000, 30000, 60000]

export default function Art({ src, size = 16, alt = '', className, fallback = 'note',
                              vector = false, brokenFallback = 'disc' }) {
  // url -> { tries, down }: how often it has failed, and whether it is
  // waiting out a retry now.
  const [failed, setFailed] = useState(() => new Map())
  const timers = useRef(new Set())
  useEffect(() => () => { for (const id of timers.current) clearTimeout(id) }, [])
  const fail = (url) => {
    const tries = (failed.get(url)?.tries || 0) + 1
    setFailed((prev) => new Map(prev).set(url, { tries, down: true }))
    // Only Sonora's own picture URLs are retried: they take a cache-busting
    // parameter, and the backend holds a failure for only a few seconds.
    if (tries > RETRY_MS.length || !url.startsWith('/api/art?')) return
    const id = setTimeout(() => {
      timers.current.delete(id)
      setFailed((prev) => new Map(prev).set(url, { tries, down: false }))
    }, RETRY_MS[tries - 1])
    timers.current.add(id)
  }
  // What the picture is drawn at. `size` is the caller's word for it, but a
  // skin may draw it larger, so the drawn box is measured and a bigger copy
  // asked for when the first would be blurred.
  const ref = useRef(null)
  const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1
  const [drawn, setDrawn] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const note = () => { const w = Math.max(el.clientWidth, el.clientHeight); if (w) setDrawn((d) => Math.max(d, w)) }
    note()
    const observer = new ResizeObserver(note)
    observer.observe(el)
    return () => observer.disconnect()
  })
  const want = Math.ceil(Math.max(size, drawn) * dpr)
  const candidates = (Array.isArray(src) ? src : [src]).filter(Boolean)
  // The app decodes art as a bitmap, so SVG art never shows there: it draws
  // browse_missing_album_art (the disc) for such a row. Amazon Music's
  // Collections rows (v2-library.svg and its like) and SomaFM's containers
  // are the cases measured (2026-09-06, 2026-09-07). Matching that means not
  // drawing the SVG here either.
  // ...but the web client is a browser and draws them: Pandora's stations
  // icon is an SVG at every size above 40, and the product shows it where
  // the desktop app would show a disc. A theme replicating the web client
  // asks for them with `vector`.
  const isVector = (url) => {
    if (vector) return false
    const m = /^\/api\/art\?u=(.*)$/.exec(url)
    let target = url
    if (m) { try { target = decodeURIComponent(m[1]) } catch { target = url } }
    return /\.svg(\?|#|$)/i.test(target)
  }
  const usable = candidates.find((url) => !isVector(url) && !failed.get(url)?.down) || ''
  const offered = candidates.length > 0

  if (!usable) {
    // The app keeps a different placeholder per kind of row rather than one
    // for everything: browse_generic_track, browse_generic_station,
    // browse_generic_multi_track and browse_missing_album_art. Sonora was
    // showing the disc for all of them.
    //
    // Which one depends on why there is no picture. Art that was offered and
    // would not load falls back to the disc (browse_missing_album_art); art
    // that was never offered falls back to the tile for the row's kind. Read
    // off the app's own SomaFM pane, where SVG container art it cannot
    // decode shows the disc while a row with no art at all shows the stack.
    // A surface that draws one picture whatever went wrong names it in
    // `brokenFallback` (the Mac app's Group Rooms shows its note either way).
    const Glyph = (offered ? FALLBACKS[brokenFallback] || Icon.Disc : FALLBACKS[fallback]) || Icon.Note
    return <Glyph width={size} height={size} aria-hidden="true" className={className} />
  }
  return (
    // No Referer: some providers' image hosts refuse hot-linked requests
    // (AccuRadio's answers 403 to any request naming a referring page,
    // measured 2026-09-07), and the apps never send one.
    <img
      ref={ref}
      className={className}
      src={withRetry(sizedArtUrl(usable, want), failed.get(usable)?.tries)}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => fail(usable)}
    />
  )
}

// A retry is a new URL, so the browser asks again rather than answering
// from what it remembers of the failure.
function withRetry(url, tries) {
  return tries && url.startsWith('/api/art?') ? `${url}&retry=${tries}` : url
}

// Art paths reported by a speaker are relative to that speaker. Most begin
// with a slash (/getaa?...); a Sonos playlist's stock picture does not
// ("images/playlist_legacy.png"), and was joined as host:1400images/...,
// which 404s (66 times in an afternoon's log).
export function artUrl(host, uri) {
  if (!uri) return ''
  if (uri.startsWith('http://') || uri.startsWith('https://')) return uri
  return `http://${host}:1400${uri.startsWith('/') ? '' : '/'}${uri}`
}

// Everything known to picture what a room is playing, best source first:
// the speaker's copy, then the provider's own URL when the backend has
// read one from the service.
//
// With `best`, for a page that draws the cover large (Material Girl's Listen
// hero), the provider's own URL comes first, since it can be asked for a
// bigger copy where the speaker's cannot, and each URL asks Sonora for the
// largest copy its source gives up to the size drawn. Every
// other caller gets what it always has.
export function nowPlayingArt(host, transport, { best = false, zone = '' } = {}) {
  const speaker = artUrl(host, transport?.album_art_uri)
  const provider = transport?.provider_art_uri || ''
  const list = best ? [provider, speaker] : [speaker, provider]
  const urls = list.filter((url, i) => url && list.indexOf(url) === i).map(cachedArt)
  if (!best) return urls
  const sid = Number(transport?.service_id) || 0
  const extra = `&best=1${sid ? `&sid=${sid}` : ''}${zone ? `&zone=${encodeURIComponent(zone)}` : ''}`
  return urls.map((url) => (url.startsWith('/api/art?') ? `${url}${extra}` : url))
}

// Now-playing pictures come through Sonora's own cache (/api/art): the
// speakers fetch art from the service on every request and send no cache
// headers, which left the Mini Controller gray for seconds while the main
// window already showed the cover (Libby by OverDrive).
export function cachedArt(url) {
  if (!url || url.startsWith('/api/art?')) return url
  return `/api/art?u=${encodeURIComponent(url)}`
}
