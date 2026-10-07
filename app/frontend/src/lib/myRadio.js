import { useCallback, useEffect, useState } from 'react'
import { api } from './api.js'

// The household's My Radio Stations (the speakers' R:0/0), so Info & Options
// can say Remove where the station is already saved: the app flips its row
// to "Remove from My Radio Stations" for one that is (102.7 KIIS-FM,
// 2026-09-07), with the favorites row under it as before.

// A station URI without the parts that differ between two saves of it: the
// query's flags and serial, and the case of its escapes.
export function stationKey(uri) {
  if (!uri) return ''
  const [path, query = ''] = String(uri).split('?')
  const sid = /(?:^|&)sid=(\d+)/.exec(query)?.[1] || ''
  return `${path.replace(/%[0-9a-f]{2}/gi, (m) => m.toLowerCase())}|${sid}`
}

export function useMyRadioStations(zone) {
  const [items, setItems] = useState([])
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let canceled = false
    if (!zone) { setItems([]); return undefined }
    api.radio(zone).then((r) => { if (!canceled) setItems(r?.items || []) }).catch(() => {})
    return () => { canceled = true }
  }, [zone, version])
  const find = useCallback((uri) => {
    const key = stationKey(uri)
    return key ? items.find((entry) => stationKey(entry.uri) === key) || null : null
  }, [items])
  const reload = useCallback(() => setVersion((v) => v + 1), [])
  return { find, reload }
}
