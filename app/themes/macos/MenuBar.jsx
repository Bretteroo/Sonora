import React, { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import appIcon from '../../frontend/src/assets/sonora.png'
import { MENU_ICONS } from './menuIcons.jsx'

// The Mac system menu bar. Titles and items follow the application's own
// MainMenu archive: Sonos, Edit, View, Manage, Window, Help. Items whose
// function needs something the speakers do not offer a local controller are
// present but disabled rather than missing.
//
// `menus` is [{ id, title, items: [{ id, label, shortcut, onSelect, disabled,
// submenu } | 'sep'] }]; `disabled` may be a function, asked when the menu
// opens, and `submenu` draws the arrow of an item that opens one.

export default function MenuBar({ menus, onLogo }) {
  const [open, setOpen] = useState(null)
  const ref = useRef(null)
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  useEffect(() => { if (!open) setQuery('') }, [open])
  // Tahoe gives a group an icon column when any item in it has an icon, and
  // the rest of that group stands indented to it; a group with none sits
  // flush left (the S1 app's Help menu, 2026-09-28).
  const withSlots = (items) => {
    const groups = []
    let current = []
    for (const item of items) {
      if (item === 'sep') { groups.push(current); groups.push(['sep']); current = [] } else current.push(item)
    }
    groups.push(current)
    return groups.flatMap((group) => {
      if (group[0] === 'sep') return [{ item: 'sep' }]
      const slot = group.some((item) => item.icon)
      return group.map((item) => ({ item, slot }))
    })
  }
  const matches = (text) => {
    const needle = text.trim().toLowerCase()
    const found = menus.flatMap((m) => m.items.filter((item) => item !== 'sep' && !item.submenu
      && item.label.toLowerCase().includes(needle)))
    return found.map((item) => ({ item, slot: false }))
  }

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
    <ul className="dk-menubar" ref={ref} role="menubar">
      {/* Where macOS puts the Apple menu, Sonora's own icon: it opens About
          Sonora, the one thing here that is Sonora's rather than the app's. */}
      {onLogo && (
        <li role="none">
          <button type="button" role="menuitem" className="dk-menubar-logo" aria-label={t('about.menu')}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => { setOpen(null); onLogo() }}>
            <img src={appIcon} alt="" width="16" height="16" />
          </button>
        </li>
      )}
      {menus.map((menu) => (
        <li key={menu.id} role="none">
          <button
            type="button"
            role="menuitem"
            className="dk-menubar-title"
            data-app={menu.app || undefined}
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
            <ul className="dk-menu" role="menu">
              {/* Help opens on a search field, as every Tahoe app's does; typed
                  into, it lists the menu items of every menu that match. */}
              {menu.search && (
                <li className="dk-menu-search" role="none">
                  <input type="search" autoFocus value={query} placeholder={t('common.search')}
                         aria-label={t('common.search')}
                         onChange={(event) => setQuery(event.target.value)} />
                </li>
              )}
              {(menu.search && query.trim() ? matches(query) : withSlots(menu.items)).map(({ item, slot }, index) => (
                item === 'sep'
                  ? <li key={`sep-${index}`} className="dk-menu-sep" role="separator" />
                  : (
                    <li key={item.id} role="none">
                      <button
                        type="button"
                        role="menuitem"
                        className="dk-menu-item"
                        data-slot={slot || undefined}
                        disabled={typeof item.disabled === 'function' ? item.disabled() : item.disabled}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => { setOpen(null); item.onSelect?.() }}
                      >
                        {slot && (
                          <span className="dk-menu-icon" aria-hidden="true">
                            {item.icon && MENU_ICONS[item.icon] ? React.createElement(MENU_ICONS[item.icon]) : null}
                          </span>
                        )}
                        <span>{item.label}</span>
                        {item.shortcut && <kbd>{item.shortcut}</kbd>}
                        {item.submenu && <span className="dk-menu-arrow" aria-hidden="true">›</span>}
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
    </ul>
  )
}
