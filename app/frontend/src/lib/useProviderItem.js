import { useCallback, useEffect, useState } from 'react'
import { api } from './api.js'

// What the service itself says the playing item is, and the buttons it
// declares for rating it.
//
// The buttons are not a per-service list Sonora keeps: a service's
// presentation map names them, and getExtendedMetadata returns them with the
// item -- an icon, a label, the message to show after the press and the id to
// send back. AccuRadio answers with a star ("Love track") and a prohibition
// sign ("Ban track"); Amazon Music answers with a heart. Any service that
// declares them gets its buttons drawn, and one that declares none gets none,
// so nothing here keys on a service id (read live off AccuRadio on 2026-09-15).
//
// A rating made in another controller reaches the service, not the speakers,
// so nothing announces it: while an item with buttons is playing its metadata
// is re-read every ten seconds, which is how a press in the desktop app shows
// up here.
export function useProviderItem(zone, transport, { enabled = true } = {}) {
  const [provider, setProvider] = useState(null)
  // Bumped after a rating so the buttons are read again and the pressed one
  // comes back in its other state rather than disappearing.
  const [epoch, setEpoch] = useState(0)
  const uuid = zone?.uuid || ''
  const trackKey = `${uuid}|${transport?.track_uri || ''}`

  useEffect(() => {
    if (!enabled || !uuid || !transport?.service_id || !transport?.track_uri) { setProvider(null); return undefined }
    let canceled = false
    api.itemMetadata(uuid).then((r) => { if (!canceled) setProvider(r || null) }).catch(() => {})
    return () => { canceled = true }
  }, [trackKey, epoch, enabled]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setProvider(null); setEpoch(0) }, [trackKey])

  const ratings = (provider?.ratings || []).filter((b) => b.icon)
  const hasRatings = ratings.length > 0
  useEffect(() => {
    if (!hasRatings || transport?.state !== 'PLAYING') return undefined
    const timer = setInterval(() => setEpoch((v) => v + 1), 10000)
    return () => clearInterval(timer)
  }, [hasRatings, transport?.state, trackKey])

  // The SMAPI id of what is playing. The service gives it with the metadata;
  // failing that it is in the track URI as x-sonos-http:<encoded id>.<ext>?...
  const itemId = provider?.item_id || (() => {
    const m = /^x-sonos-http:([^?]+?)(?:\.[a-z0-9]+)?\?/i.exec(transport?.track_uri || '')
    try { return m ? decodeURIComponent(m[1]) : '' } catch { return '' }
  })()

  const refresh = useCallback(() => setEpoch((v) => v + 1), [])
  return { provider, ratings, itemId, refresh }
}
