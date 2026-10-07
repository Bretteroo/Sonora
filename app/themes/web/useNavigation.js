import { useCallback, useMemo, useState } from 'react'

// In-app navigation history for the browse column.
//
// The header's two arrows exist in the product and are a real control there.
// An earlier version of this theme wired them to window.history, which does
// nothing in a single-page app, so they were decoration. They now drive a
// stack of browse views, and report whether there is anywhere to go, which is
// also how the product renders them: grayed out at the root, because there is
// no history yet.

export const HOME = { kind: 'home' }

export function useNavigation() {
  const [stack, setStack] = useState([HOME])
  const [cursor, setCursor] = useState(0)

  const push = useCallback((view) => {
    setStack((current) => {
      // Moving forward from a mid-stack position discards what was ahead,
      // which is what a browser does and what people expect.
      const kept = current.slice(0, cursor + 1)
      return [...kept, view]
    })
    setCursor((c) => c + 1)
  }, [cursor])

  const back = useCallback(() => {
    setCursor((c) => Math.max(0, c - 1))
  }, [])

  const forward = useCallback(() => {
    setCursor((c) => Math.min(stack.length - 1, c + 1))
  }, [stack.length])

  const home = useCallback(() => {
    setStack([HOME])
    setCursor(0)
  }, [])

  return useMemo(() => ({
    view: stack[cursor] ?? HOME,
    canGoBack: cursor > 0,
    canGoForward: cursor < stack.length - 1,
    push,
    back,
    forward,
    home,
  }), [stack, cursor, push, back, forward, home])
}
