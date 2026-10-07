import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSystem } from './store.jsx'
import { api, ApiError } from './api.js'
import { orderedHouseholds } from './format.js'
import { chosenHousehold } from './shellSelection.js'

// The one place the music-service linking flow lives, so every theme renders
// the same behavior and none carries its own copy of the state machine.
//
// It reads the household catalogs once and exposes, per household, both the
// services already configured (with whether Sonora holds a login for each) and
// the ones that could still be added (with their logo and whether the provider
// will pair with Sonora at all). `start(service, zone)` asks the provider for
// a sign-in; the flow then moves through 'starting' -> 'waiting' (a link and
// code, polled every 3s) -> 'done', or 'needsApp' when the provider only signs
// in through Sonos' own app, or 'failed'. A `preset` ({ sid, name, zone })
// skips the catalog and starts that one service at once, which is how a
// service the Sonos app already has gets linked in Sonora too.

export function useServiceLink({ preset = null, initialTab = null, onLinked } = {}) {
  // servicesEpoch bumps when the speakers report a service added or removed in
  // another app, so every view on this hook updates live, without a reload.
  const { households, zones, servicesEpoch } = useSystem()
  const [all, setAll] = useState(null)      // raw /api/services households
  const [tab, setTab] = useState(null)
  const [chosen, setChosen] = useState(null) // { service, zone, accountId }
  const [link, setLink] = useState(null)
  const [status, setStatus] = useState('idle')
  const [registered, setRegistered] = useState(true)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)

  const ordered = useMemo(() => orderedHouseholds(households), [households])
  const presetHousehold = preset?.zone
    ? households.find((h) => h.zone_uuids.includes(preset.zone))?.id ?? null
    : null
  const activeTab = tab && ordered.some((h) => h.id === tab) ? tab
    : (initialTab && ordered.some((h) => h.id === initialTab) ? initialTab
      : (presetHousehold ?? chosenHousehold(ordered)))

  const zoneForHousehold = useCallback((hid) => {
    const h = households.find((x) => x.id === hid)
    for (const u of h?.zone_uuids || []) if (zones[u]) return zones[u]
    return null
  }, [households, zones])

  const refresh = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    let canceled = false
    api.services().then((result) => {
      if (!canceled) setAll(result.households || [])
    }).catch((exc) => { if (!canceled) { setAll([]); setError(exc.message) } })
    return () => { canceled = true }
  }, [version, servicesEpoch])

  // Per household: what is configured, and what could be added.
  const byHousehold = useMemo(() => {
    const out = {}
    for (const hh of all || []) {
      const used = new Set((hh.in_use || []).map((s) => s.id))
      // A service already on the household can take another account (a
      // second person's Spotify), unless it needs no account at all.
      out[hh.household] = {
        configured: hh.in_use || [],
        addable: (hh.available || [])
          .filter((s) => !used.has(s.id) || s.auth !== 'Anonymous')
          .map((s) => (used.has(s.id) ? { ...s, in_use: true } : s))
          .sort((a, b) => a.name.localeCompare(b.name)),
      }
    }
    return out
  }, [all])

  // Poll while a code is outstanding. One request at a time: the next poll is
  // scheduled only after the current one returns, so a slow poll and its
  // successor never overlap. Overlapping polls once turned a link that had just
  // succeeded into a failure, because the provider rejects a code the instant
  // it is consumed.
  useEffect(() => {
    if (status !== 'waiting' || !link || !chosen) return undefined
    let stop = false
    let timer = null
    const poll = async () => {
      try {
        const r = await api.completeLink(chosen.service.id, {
          zone: chosen.zone, link_code: link.link_code, device_id: link.device_id || '',
          account_id: chosen.accountId || '', reauthorize: Boolean(chosen.reauthorize) })
        if (stop) return
        if (r.linked) {
          setRegistered(r.registered !== false && r.replaced !== false); setStatus('done'); refresh(); onLinked?.(); return
        }
      } catch (exc) {
        if (stop) return
        setStatus('failed'); setError(exc.message); return
      }
      if (!stop) timer = setTimeout(run, 3000)
    }
    let busy = false
    const run = async () => { timer = null; busy = true; try { await poll() } finally { busy = false } }
    // Coming back from the provider's sign-in page is the moment the link is
    // likely done, so ask then rather than at the next tick. Still one
    // request at a time (Pocket Casts reauthorize).
    const now = () => {
      if (stop || busy || document.visibilityState !== 'visible') return
      if (timer) clearTimeout(timer)
      run()
    }
    window.addEventListener('focus', now)
    document.addEventListener('visibilitychange', now)
    timer = setTimeout(run, 3000)
    return () => {
      stop = true; if (timer) clearTimeout(timer)
      window.removeEventListener('focus', now); document.removeEventListener('visibilitychange', now)
    }
  }, [status, link, chosen, onLinked, refresh])

  // `accountId` names which of the household's accounts is being linked, when
  // the service is already on the system with several; each is linked on its
  // own so every row browses and plays as its own person.
  // `reauthorize`: the Sonos app's Reauthorize, whose new login also replaces
  // the household account's own, in place (ReplaceAccountX).
  const start = useCallback(async (service, zoneUuid, accountId = '', reauthorize = false) => {
    const zu = zoneUuid || zoneForHousehold(activeTab)?.uuid
    if (!zu) return
    setChosen({ service, zone: zu, accountId, reauthorize }); setError(''); setLink(null); setStatus('starting')
    try {
      const r = await api.linkService(service.id, { zone: zu, account_id: accountId })
      if (r.linked) {
        setRegistered(r.registered !== false && r.replaced !== false); setStatus('done'); refresh(); onLinked?.(); return
      }
      if (r.method === 'app') { setStatus('needsApp'); return }
      setLink(r); setStatus('waiting')
      // Open the provider's sign-in at once, so the person does not have to
      // click through. A browser may block a popup this long after the click;
      // the "Open in browser" button stays as the fallback.
      if (r.reg_url) window.open(r.reg_url, '_blank', 'noopener')
    } catch (exc) {
      setStatus('failed'); setError(exc instanceof ApiError ? exc.message : String(exc))
    }
  }, [activeTab, zoneForHousehold, onLinked, refresh])

  const reset = useCallback(() => {
    setChosen(null); setStatus('idle'); setLink(null); setError('')
  }, [])

  // Opened for one service: go straight to its sign-in.
  const startedPreset = useRef(false)
  useEffect(() => {
    if (!preset || startedPreset.current || !preset.zone) return
    startedPreset.current = true
    start({ id: preset.sid, name: preset.name, auth: preset.auth }, preset.zone,
          preset.account_id || '', Boolean(preset.reauthorize))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset])

  return {
    loaded: all !== null,
    households: ordered,
    activeTab,
    setTab,
    byHousehold,
    configuredFor: (hid) => byHousehold[hid]?.configured ?? [],
    addableFor: (hid) => byHousehold[hid]?.addable ?? [],
    zoneForHousehold,
    chosen,
    link,
    status,
    registered,
    error,
    start,
    reset,
    refresh,
  }
}
