import React from 'react'
import { useTheme } from '../lib/theme.jsx'
import { useI18n } from '../i18n/index.jsx'

// Deliberately plain and theme-agnostic, since it has to be usable from
// inside any theme including ones that replicate a product with no such
// control of its own.
export default function ThemePicker({ compact = false }) {
  const { themes, themeId, selectTheme } = useTheme()
  const { t } = useI18n()

  return (
    <label style={compact ? styles.compact : styles.wrap}>
      <span style={compact ? styles.srOnly : styles.label}>
        {t('common.theme')}
      </span>
      <select
        value={themeId}
        onChange={(event) => selectTheme(event.target.value)}
        style={styles.select}
      >
        {themes.map((theme) => (
          <option key={theme.id} value={theme.id}>
            {theme.name}
          </option>
        ))}
      </select>
    </label>
  )
}

const styles = {
  wrap: { display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 24 },
  compact: { display: 'inline-flex', alignItems: 'center', gap: 6 },
  label: { fontSize: 12, color: 'var(--t-fg-muted, #888)' },
  srOnly: {
    position: 'absolute', width: 1, height: 1, overflow: 'hidden',
    clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap',
  },
  select: {
    padding: '5px 8px',
    borderRadius: 6,
    border: '1px solid var(--t-border, #ccc)',
    background: 'var(--t-surface, #fff)',
    // The color has to be set explicitly. A theme may place this control on
    // a colored band with light inherited text, which then lands on the
    // control's own light background and disappears.
    color: 'var(--t-fg, #111)',
  },
}
