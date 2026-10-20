// One alert on screen at a time. A theme passes everything its alert stack would draw (Sonora's
// notices and its own messages) and draws what comes back: the newest item, and for a moment the
// one it replaced, marked leaving so the theme can animate it away. An item that has been
// replaced never comes back, even while its own list still holds it.
import { useEffect, useReducer, useRef } from 'react'

// Longer than any theme's leaving and the arrival it holds back put together, so the hold is
// never let go of partway through the arrival.
export const LEAVE_MS = 540

// The pure step, kept apart from React so it can be checked on its own. `state` is
// { seen: Set of ids, current: id or null, leaving: item or null, last: item or null }.
export function stepAlert(state, items) {
  const fresh = items.filter((item) => !state.seen.has(item.id))
  const seen = fresh.length ? new Set([...state.seen, ...fresh.map((item) => item.id)]) : state.seen
  const present = state.current != null ? items.find((item) => item.id === state.current) : null
  if (fresh.length) {
    const next = fresh[0]
    const outgoing = state.current != null ? (present || state.last) : state.leaving
    return { seen, current: next.id, leaving: outgoing, last: next }
  }
  if (state.current != null && !present) {
    // Dismissed, or run out: it goes the same way a replaced one does.
    return { seen, current: null, leaving: state.last, last: null }
  }
  return present ? { ...state, last: present } : state
}

export const EMPTY_ALERT = { seen: new Set(), current: null, leaving: null, last: null }

export function shownAlerts(state) {
  return [
    ...(state.last ? [state.last] : []),
    ...(state.leaving && state.leaving.id !== state.last?.id ? [{ ...state.leaving, leaving: true }] : []),
  ]
}

export function useOneAlert(items) {
  const ref = useRef(EMPTY_ALERT)
  const [, rerender] = useReducer((n) => n + 1, 0)
  ref.current = stepAlert(ref.current, items)
  const leaving = ref.current.leaving
  useEffect(() => {
    if (!leaving) return undefined
    const timer = setTimeout(() => {
      if (ref.current.leaving === leaving) { ref.current = { ...ref.current, leaving: null }; rerender() }
    }, LEAVE_MS)
    return () => clearTimeout(timer)
  }, [leaving])
  return shownAlerts(ref.current)
}
