import { useCallback, useEffect, useState } from 'react'
import { api } from './api.js'
import { useSystem } from './store.jsx'

// A room's queue, refetched when it actually changes.
//
// Three shells fetched this three times. Knowing *when* to fetch again is the
// whole difficulty, and they did not agree:
//
//   A queue changed by any controller arrives as a push from the speakers
//   (ContainerUpdateIDs), which the store turns into `queueEpochs`. That is
//   the only signal for a reorder, which moves neither the queue's length nor
//   the playing track.
//
//   The zone object itself is replaced on every store tick -- a progress
//   second, a volume nudge -- so depending on it refetches the whole queue
//   several times a minute for nothing. The web themes did that.
//
// So the dependency is a stamp of the things that mean the queue is different,
// plus the epoch for everything the stamp cannot see.

export function useQueue(zone, { count = 500, onItems = null } = {}) {
  const { queueEpochs } = useSystem()
  const [state, setState] = useState({ items: [], total: 0, loading: Boolean(zone) })
  const [tick, setTick] = useState(0)

  const uuid = zone?.uuid
  const transport = zone?.transport || {}
  const stamp = `${uuid}|${transport.queue_length}|${transport.track_uri}`
  const epoch = queueEpochs[uuid] || 0

  useEffect(() => {
    if (!uuid) { setState({ items: [], total: 0, loading: false }); return undefined }
    let canceled = false
    setState((prev) => ({ ...prev, loading: true }))
    api.queue(uuid, { count }).then((result) => {
      if (canceled) return
      const items = result.items || []
      setState({ items, total: result.total || 0, loading: false })
      onItems?.(items)
    }).catch(() => {
      if (canceled) return
      setState({ items: [], total: 0, loading: false })
      onItems?.([])
    })
    return () => { canceled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp, uuid, tick, epoch, count])

  const reload = useCallback(() => setTick((v) => v + 1), [])
  return { ...state, reload }
}
