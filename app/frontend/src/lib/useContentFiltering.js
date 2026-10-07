import { useCallback, useEffect, useState } from 'react'
import { api } from './api.js'
import { useSystem } from './store.jsx'

// Whether each system filters explicit content, and the switch for it.
//
// The setting belongs to the household, not to Sonora and not to a speaker:
// every Sonos controller reads and writes the same one, and Sonora reads it
// off the speakers with no Sonos account involved.
//
// The speakers refuse the write to a controller without a credential of their
// own (401, `Bearer realm="service"`), so `changeable` comes back false and
// the switch is shown set the way the household has it and unable to move,
// with the reason beside it. Nothing here pretends otherwise, and nothing has
// to change here on the day the write starts working: the same call is
// already wired to it.
export function useContentFiltering() {
  const { households, zoneList } = useSystem()
  const [state, setState] = useState({})
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  // Any online player of the household answers the same value.
  const zoneOf = useCallback((household) => (
    (household.zone_uuids || []).find(
      (uuid) => (zoneList || []).some((z) => z.uuid === uuid && z.online !== false))
    || (household.zone_uuids || [])[0] || ''
  ), [zoneList])

  const refresh = useCallback(() => {
    const systems = households || []
    if (!systems.length) { setState({}); return }
    Promise.all(systems.map(async (household) => {
      const zone = zoneOf(household)
      if (!zone) return [household.id, null]
      try {
        return [household.id, await api.contentFiltering(zone)]
      } catch (exc) {
        setError(exc?.message || String(exc))
        return [household.id, null]
      }
    })).then((pairs) => setState(Object.fromEntries(pairs)))
  }, [households, zoneOf])

  useEffect(refresh, [refresh])

  const set = useCallback(async (householdId, on) => {
    const household = (households || []).find((h) => h.id === householdId)
    const zone = household ? zoneOf(household) : ''
    if (!zone) return false
    setBusy(householdId); setError('')
    try {
      const result = await api.setContentFiltering({ zone, filtering: on })
      setState((prev) => ({ ...prev, [householdId]: result }))
      return true
    } catch (exc) {
      setError(exc?.message || String(exc))
      // The speakers may have taken it even when the reply went astray, and
      // a switch showing the wrong state is worse than one that did nothing.
      refresh()
      return false
    } finally {
      setBusy('')
    }
  }, [households, zoneOf, refresh])

  return { byHousehold: state, busy, error, refresh, set }
}
