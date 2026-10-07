import React, { useEffect, useState } from 'react'
import { useI18n } from '../i18n/index.jsx'
import { api } from '../lib/api.js'

// The apps' Error Log body: a read-only text with one entry per problem,
// each dated the app's way ("Saturday, September 5, 2026 - 8:08 AM Pacific
// Time") over its message, blank lines between. Sonora's entries are its
// backend's warnings and errors: speaker refusals, services out of reach.
export default function ErrorLog({ className = '' }) {
  const { t } = useI18n()
  const [entries, setEntries] = useState(null)
  useEffect(() => {
    let canceled = false
    api.errorLog().then((r) => { if (!canceled) setEntries(r.entries || []) }).catch(() => { if (!canceled) setEntries([]) })
    return () => { canceled = true }
  }, [])
  const stamp = (seconds) => {
    const d = new Date(seconds * 1000)
    return `${new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(d)} - ${
      new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZoneName: 'long' }).format(d)}`
  }
  const text = entries === null ? t('desk.browse.loading')
    : entries.length === 0 ? t('desk.errorLog.empty')
    : entries.map((e) => `${stamp(e.time)}\n${e.message}`).join('\n\n')
  return <textarea className={`error-log ${className}`} readOnly value={text} aria-label={t('desk.menu.errorLog')} />
}
