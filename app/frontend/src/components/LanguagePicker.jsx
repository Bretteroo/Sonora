import React from 'react'
import { useI18n } from '../i18n/index.jsx'

// Language selection. Theme-agnostic, like the theme picker, so any theme's
// settings surface can host it.
export default function LanguagePicker({ compact = false }) {
  const { t, language, languages, selectLanguage } = useI18n()

  return (
    <label style={compact ? styles.compact : styles.wrap}>
      <span style={compact ? styles.srOnly : styles.label}>
        {t('common.language')}
      </span>
      <select
        value={language}
        onChange={(event) => selectLanguage(event.target.value)}
        style={styles.select}
      >
        {languages.map((entry) => (
          <option key={entry.code} value={entry.code}>{entry.name}</option>
        ))}
      </select>
    </label>
  )
}

const styles = {
  wrap: { display: 'inline-flex', alignItems: 'center', gap: 8 },
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
    color: 'var(--t-fg, #111)',
  },
}
