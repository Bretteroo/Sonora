import React, { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n/index.jsx'
import { APP } from '../lib/meta.js'
import { api } from '../lib/api.js'
import icon from '../assets/sonora.png'
import './about.css'

// The card that says a newer Sonora is out, shared by every theme and drawn,
// like About, in the active theme's tokens. It reads the server's weekly check
// of GitHub (backend/release.py) when the page opens and every hour after, so
// a page left open for days still hears of a release.
//
// "Got it" puts this release away for good in this browser; the next one
// asks again. "Remind me in 24 hours" puts it away until then. Escape or a
// click outside only closes it until the page is opened again.

const SEEN_KEY = 'sonora.appUpdate.seen'
const SNOOZE_KEY = 'sonora.appUpdate.snooze'
const LOOK_MS = 60 * 60 * 1000
const SNOOZE_MS = 24 * 60 * 60 * 1000

function read(key) {
  try { return window.localStorage.getItem(key) } catch { return null }
}
function write(key, value) {
  try { window.localStorage.setItem(key, value) } catch { /* private mode */ }
}
function snoozed(version) {
  try {
    const snooze = JSON.parse(read(SNOOZE_KEY) || 'null')
    return snooze?.version === version && Date.now() < snooze.until
  } catch { return false }
}

export default function UpdateNotice() {
  const { t } = useI18n()
  const [offer, setOffer] = useState(null)
  const closed = useRef(null)
  const ok = useRef(null)
  useEffect(() => {
    let live = true
    const look = () => api.appUpdate().then((r) => {
      if (!live || !r?.available || !r.latest) return
      if (read(SEEN_KEY) === r.latest || snoozed(r.latest) || closed.current === r.latest) return
      setOffer({ version: r.latest, current: r.current })
    }).catch(() => {})
    look()
    const timer = setInterval(look, LOOK_MS)
    return () => { live = false; clearInterval(timer) }
  }, [])

  const close = () => { closed.current = offer?.version; setOffer(null) }
  const later = () => { write(SNOOZE_KEY, JSON.stringify({ version: offer.version, until: Date.now() + SNOOZE_MS })); setOffer(null) }
  const gotIt = () => { write(SEEN_KEY, offer.version); setOffer(null) }

  useEffect(() => {
    if (!offer) return undefined
    const key = (event) => { if (event.key === 'Escape') close() }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  })

  // "Got it" takes the keyboard as the card opens, without the focus ring a
  // pointer user would read as a second border.
  const shown = Boolean(offer)
  useEffect(() => { if (shown) ok.current?.focus({ focusVisible: false }) }, [shown])

  if (!offer) return null
  return (
    <div className="about-backdrop" role="presentation"
         onPointerDown={(event) => { if (event.target === event.currentTarget) close() }}>
      <div className="about-card update-card" role="dialog" aria-modal="true" aria-labelledby="update-card-title">
        <img className="about-icon update-icon" src={icon} width="64" height="64" alt="" />
        <h2 className="update-title" id="update-card-title">{t('appUpdate.title')}</h2>
        <p className="update-body">
          {t('appUpdate.body', { version: offer.version, current: offer.current })}
          {' '}
          <a href={APP.releases} target="_blank" rel="noopener noreferrer">{t('about.whatsNew')}</a>
        </p>
        <div className="update-actions">
          <button type="button" className="update-later" onClick={later}>{t('appUpdate.later')}</button>
          <button type="button" className="update-ok" onClick={gotIt} ref={ok}>{t('appUpdate.ok')}</button>
        </div>
      </div>
    </div>
  )
}
