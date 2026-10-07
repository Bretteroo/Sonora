import React, { useEffect, useRef, useState } from 'react'
import DevThemeSwitch from '../../frontend/src/components/DevThemeSwitch.jsx'

// The classic Windows menu bar that sits under the title bar: File, Edit, View,
// Manage, Help, each opening a square-cornered dropdown. Same menu model as the
// Mac bar ([{ id, title, items: [{ id, label, shortcut, onSelect, disabled } |
// 'sep'] }], `disabled` a value or a function asked when the menu opens); the styling and, on Windows, the click-then-hover
// behavior differ. Items whose function needs something a local controller
// cannot do are shown disabled rather than hidden.

export default function MenuBar({ menus }) {
  const [open, setOpen] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const close = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(null)
    }
    const key = (event) => { if (event.key === 'Escape') setOpen(null) }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', key)
    }
  }, [open])

  return (
    <ul className="win-menubar" ref={ref} role="menubar">
      {menus.map((menu) => (
        <li key={menu.id} role="none">
          <button
            type="button"
            role="menuitem"
            className="win-menubar-title"
            aria-haspopup="menu"
            aria-expanded={open === menu.id}
            // A menu takes no focus, so a text field keeps its selection
            // for Edit's items, as the apps' menus leave it.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setOpen(open === menu.id ? null : menu.id)}
            onPointerEnter={() => { if (open && open !== menu.id) setOpen(menu.id) }}
          >
            {menu.title}
          </button>
          {open === menu.id && (
            <ul className="win-menu" role="menu">
              {menu.items.map((item, index) => (
                item === 'sep'
                  ? <li key={`sep-${index}`} className="win-menu-sep" role="separator" />
                  : (
                    <li key={item.id} role="none">
                      <button
                        type="button"
                        role="menuitem"
                        className="win-menu-item"
                        disabled={typeof item.disabled === 'function' ? item.disabled() : item.disabled}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => { setOpen(null); item.onSelect?.() }}
                      >
                        <span>{item.label}</span>
                        {item.shortcut && <kbd>{item.shortcut}</kbd>}
                      </button>
                    </li>
                  )
              ))}
            </ul>
          )}
        </li>
      ))}
      {/* Past Help, at the end of the row: a build-time convenience that has
          no business anywhere the app's own layout is being matched. */}
      <li className="win-menubar-aside" role="none"><DevThemeSwitch className="win-menubar-theme" /></li>
    </ul>
  )
}
