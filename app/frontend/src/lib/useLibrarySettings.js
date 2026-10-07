import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api.js'
import { orderedHouseholds } from './format.js'
import { chosenHousehold } from './shellSelection.js'

// The Music Library settings data: one household at a time, its shares,
// indexing state and options, with the calls that change them. Every theme
// that shows Music Library settings draws them from this.
// `section`: the tab the reader is on. A failed add is this session's news,
// not a standing condition: the app reports it once, in the wizard that
// tried, while the backend keeps the failure in pending_shares for as long as
// the share is missing. So whatever was already failing when the page opened,
// or when the reader came back to a tab, is not shown again; only a failure
// that arrives while they are looking is (user's report). This
// once lived in the Windows theme's own Library page, which is
// why the Mac and Sonofuture panes went on showing a stale error for ever.
export function useLibrarySettings(households, { section = '' } = {}) {
  const ordered = orderedHouseholds(households)
  const [tab, setTab] = useState(null)
  const activeTab = tab && ordered.some((h) => h.id === tab) ? tab : chosenHousehold(ordered)
  const zone = households.find((h) => h.id === activeTab)?.zone_uuids?.[0]
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState(null)

  const load = useCallback(() => {
    if (!zone) return
    api.librarySettings(zone).then((r) => { setData(r); setError('') })
      .catch((exc) => setError(exc.message))
  }, [zone])
  useEffect(() => { setData(null); setSelected(null); load() }, [load])
  // Indexing runs for a while after a change: follow it closely until it is
  // done, and keep an eye out the rest of the time as well, since an index can
  // be started from a phone or from the desktop app and the pane should show
  // that it is happening rather than wait for a reload.
  useEffect(() => {
    if (!zone) return undefined
    // A share being mounted is followed as closely as an index: reading the
    // settings is what notices it land.
    const busyNow = data?.indexing || (data?.pending_shares || []).some((p) => p.state === 'adding')
    const id = setInterval(load, busyNow ? 5000 : 15000)
    return () => clearInterval(id)
  }, [data?.indexing, data?.pending_shares, load, zone])

  const apply = async (patch) => {
    setBusy(true); setError('')
    try { setData(await api.setLibrary({ zone, ...patch })) } catch (exc) { setError(exc.message) }
    setBusy(false)
  }
  const highlighted = data?.shares.find((s) => s.id === selected) || null
  const scheduled = Boolean(data?.daily_refresh)
  const scheduleTime = (data?.daily_refresh || '02:00:00').slice(0, 5)
  const everything = data?.pending_shares || []
  const failedPaths = (list) => new Set(list.filter((p) => p.state === 'failed').map((p) => p.path))
  const seenFailures = useRef(null)
  if (seenFailures.current === null && data) seenFailures.current = failedPaths(everything)
  useEffect(() => { if (data) seenFailures.current = failedPaths(data.pending_shares || []) }, [section]) // eslint-disable-line react-hooks/exhaustive-deps
  const pending = everything.filter((p) => p.state !== 'failed' || !seenFailures.current?.has(p.path))
  return { ordered, activeTab, setTab, data, error, busy, selected, setSelected, apply, highlighted, scheduled, scheduleTime, reload: load, pending }
}
