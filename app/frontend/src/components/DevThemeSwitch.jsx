import './shared.css'
import React from 'react'
import { useI18n } from '../i18n/index.jsx'
import { useTheme } from '../lib/theme.jsx'

// A development-only theme switcher: a way to flip between skins without
// walking into Settings and back for every comparison.
//
// It rides at the end of the menu bar, past Help, because that row has spare
// width and nothing else wants it. It used to sit in the transport strip
// beside the search box, where the real app has no control at all, and it
// crowded the one part of the window that is measured against the app.
// Settings still holds the real chooser, which is what a
// person uses; this is for whoever is building the themes.
export default function DevThemeSwitch({ className }) {
  const { themes, themeId, selectTheme } = useTheme()
  const { t } = useI18n()
  return (
    <label className={className} title="Theme (dev)">
      <span className="dk-sr-only">{t('common.theme')}</span>
      <select value={themeId} onChange={(event) => selectTheme(event.target.value)}>
        {themes.map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}
      </select>
    </label>
  )
}
