import React, { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../frontend/src/i18n/index.jsx'

// Below the width the three panes fit side by side, the desktop shells show
// one pane at a time and this row chooses which. It is in the page at every
// width and the shared stylesheet hides it where the panes stand together.
export default function PaneSwitch({ value, onChange }) {
  const { t } = useI18n()
  const items = [['rooms', t('desk.rooms.title')], ['now', t('desk.now.title')], ['music', t('desk.browse.music')]]
  // The labels are in PANES order; the slide direction is read from it.
  return (
    <div className="dk-pane-switch" role="tablist">
      {items.map(([id, label]) => (
        <button key={id} type="button" role="tab" aria-selected={value === id} onClick={() => onChange(id)}>{label}</button>
      ))}
    </div>
  )
}

// Whether the shell is in its one-pane layout right now.
export function isNarrowShell() {
  try { return window.matchMedia('(max-width: 936px)').matches } catch { return false }
}

//: Left to right, which is the order the tabs are drawn in.
export const PANES = ['rooms', 'now', 'music']

// Which way the panes just moved, so the one coming in slides from the side
// it would have been on. Returns "forward" for a move rightward along the
// tabs and "back" for one leftward; the first render has no direction and
// animates nothing.
export function usePaneDirection(pane) {
  const previous = useRef(pane)
  const [direction, setDirection] = useState('')
  useEffect(() => {
    const was = PANES.indexOf(previous.current)
    const now = PANES.indexOf(pane)
    previous.current = pane
    if (was === now || was < 0 || now < 0) return
    setDirection(now > was ? 'forward' : 'back')
  }, [pane])
  return direction
}
