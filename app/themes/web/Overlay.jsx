import React, { useEffect, useRef } from 'react'

// One modal wrapper for every panel in this theme.
//
// Written once because it was not: an earlier version of the settings panel
// carried its own copy of this markup without the key handler, so Escape
// silently did nothing there while working everywhere else. A dialog has to
// dismiss on Escape, dismiss on a backdrop click, and take focus when it
// opens, and that is easiest to guarantee if there is only one of them.

export default function Overlay({ children, onClose, label, variant = '' }) {
  const panel = useRef(null)
  // The latest onClose, read when a key arrives: the handler is not re-added
  // (and focus not moved) every time the page behind re-renders.
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        close.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Focus is taken once, on opening, and left alone after -- including by a
  // field inside that took it first with autoFocus. Tied to onClose, which the
  // pages pass anew on every render, it was taken back at each speaker event:
  // System Name's system list closed before S2 could be picked from it.
  useEffect(() => {
    if (!panel.current?.contains(document.activeElement)) panel.current?.focus()
  }, [])

  return (
    <div
      className="wb-overlay"
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div
        className="wb-panel"
        data-variant={variant || undefined}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        ref={panel}
      >
        {children}
      </div>
    </div>
  )
}
