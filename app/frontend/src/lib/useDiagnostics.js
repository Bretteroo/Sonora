import { useCallback, useEffect, useState } from 'react'
import { api } from './api.js'

// Shared diagnostics fetching. Every theme's network view draws the result
// with the shared NetworkMap, which orders rooms by their verdict
// (``byHealth``); the per-room tables and the sorting and scaling helpers
// they used went with them.

// Fifteen probes per speaker, always: the count is not a choice the person
// should have to make, and the verdicts are tuned to it (the re-test
// button is gone too: the check runs when the page opens).
const SAMPLES = 15

export function useDiagnostics() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async (count) => {
    setLoading(true)
    setError(null)
    try {
      setData(await api.diagnostics({ samples: count, probe: true }))
    } catch (exc) {
      setError(exc.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(SAMPLES) }, [load])

  return { data, loading, error }
}
