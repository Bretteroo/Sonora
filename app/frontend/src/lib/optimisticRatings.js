import { useEffect, useRef, useState } from 'react'

// Rating buttons that answer the press at once.
//
// A rating goes to the service and the buttons are read back afterwards, so
// a heart or a thumb lit only once the service had answered, a beat after
// the press. A toggle -- a button the backend gives a
// `toggled_icon`, the picture it shows once pressed -- is drawn pressed the
// moment it is pressed, and stays so until the buttons read back say
// something new, or the rating fails. A button that skips the track, or one
// that would only repeat its rating, is no toggle and is left alone.

const signature = (ratings) => (ratings || []).map((b) => `${b.id}:${b.icon}`).join('|')

/**
 * `ratings` are the buttons as last read for the item `itemKey` names.
 * Returns the buttons to draw and `press(button, rate)`, where `rate` sends
 * the rating and resolves truthy when the service took it.
 */
export function useOptimisticRatings(ratings, itemKey) {
  const [pressed, setPressed] = useState(null)   // { key, id, icon, seen }
  const latest = useRef(signature(ratings))
  latest.current = signature(ratings)
  // A new item, or new buttons read back, end the guess either way.
  useEffect(() => { setPressed(null) }, [itemKey])
  useEffect(() => {
    setPressed((p) => (p && p.seen !== latest.current ? null : p))
  }, [latest.current]) // eslint-disable-line react-hooks/exhaustive-deps

  const shown = pressed && pressed.key === itemKey
    ? (ratings || []).map((b) => (b.id === pressed.id ? { ...b, icon: pressed.icon, toggled_icon: b.icon, optimistic: true } : b))
    : (ratings || [])

  const press = async (button, rate) => {
    // While a press is still unanswered the button stands for the rating it
    // had before, so a second press would send that again: it waits.
    if (button.optimistic) return false
    const guess = button.toggled_icon
      ? { key: itemKey, id: button.id, icon: button.toggled_icon, seen: latest.current } : null
    if (guess) setPressed(guess)
    let ok = false
    try { ok = Boolean(await rate(button)) } catch { ok = false }
    if (!ok && guess) setPressed((p) => (p === guess ? null : p))
    return ok
  }
  return { ratings: shown, press }
}
