import { useEffect, useState } from 'react'

// A value a slider has just sent, held on screen until the room reports it.
//
// Sonora does not change its copy of a room when it sends a setting; it waits
// for the speaker's event. A slider that showed the stored value again on
// release jumped back to the old setting and then forward to the new one, and
// Balance could show a third value between them, since it is written as two
// channel levels and the speaker reports each. While a value is held the
// stored one is ignored until it matches (within half a step) or three
// seconds pass, in case the speaker never confirms.
const HOLD_MS = 3000

export function useHeld(value) {
  const [held, setHeld] = useState(null)
  useEffect(() => {
    if (held === null) return undefined
    if (value !== null && value !== undefined && Math.abs(Number(value) - held) < 0.5) {
      setHeld(null)
      return undefined
    }
    const timer = setTimeout(() => setHeld(null), HOLD_MS)
    return () => clearTimeout(timer)
  }, [value, held])
  return [held, setHeld]
}
