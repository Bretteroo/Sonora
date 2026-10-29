import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n/index.jsx'
import { APP } from '../lib/meta.js'
import { useTheme } from '../lib/theme.jsx'
import { api } from '../lib/api.js'
import { Heart } from './Icons.jsx'
import icon from '../assets/sonora.png'
import './about.css'
import { guardAboutText } from '../lib/aboutGuard.js'
import { playUnlockChime } from '../lib/unlockChime.js'

// A single About dialog, shared by every theme. It draws itself with the
// active theme's design tokens, so it fits each theme without a per-theme
// copy. Themes only decide when to open it and provide the trigger.
//
// Standard About contents: the app icon, the name, the version, a one-line
// description and what Sonora offers, then the one ask (a way to chip in), then
// the trademark note, a rule, and what it is (free software, and the license) with
// its source and the third-party licenses.
//
// The support control is a blue wash behind the theme's own text rather than a
// solid button (blue; it was Ko-fi's coral): a
// saturated solid button fights every palette this card is drawn in.

// The Konami code, then Enter.
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a', 'Enter']

export default function AboutSonora({ onClose }) {
  const { t } = useI18n()

  // Whether a newer release is out, from the server's weekly check of GitHub;
  // opening the card only reads its answer, and nothing shows without one.
  const [latest, setLatest] = useState(null)
  useEffect(() => {
    let live = true
    api.appUpdate().then((r) => { if (live && r?.available) setLatest({ version: r.latest }) }).catch(() => {})
    return () => { live = false }
  }, [])

  // The words are Sonora's: a theme may restyle the card but not hide what it says
  // (lib/aboutGuard.js). Checked as it opens, once the fonts are in, and again
  // whenever a stylesheet or the theme changes while it is open.
  const cardRef = useRef(null)
  useLayoutEffect(() => {
    const check = () => guardAboutText(cardRef.current)
    // The card fades and scales in, and halfway through that looks like hiding; the
    // first look waits for it, or 600ms, so an endless animation cannot dodge it.
    const backdrop = cardRef.current?.parentElement
    const opening = backdrop?.getAnimations ? backdrop.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => {})) : []
    let done = false
    const first = () => { if (!done) { done = true; check() } }
    Promise.all(opening).then(first)
    const late = setTimeout(first, 600)
    document.fonts?.ready?.then(() => { if (done) check() })
    const watch = new MutationObserver(() => requestAnimationFrame(check))
    watch.observe(document.head, { childList: true, subtree: true, characterData: true })
    watch.observe(document.documentElement, { attributes: true })
    return () => { watch.disconnect(); clearTimeout(late) }
  }, [])

  // The Konami code typed while the card is open unlocks the hidden themes
  // until the page reloads and switches to one. Enter, the last key, is kept from
  // reaching the card's buttons.
  const { unlockHidden } = useTheme()
  const typed = useRef([])
  // The listener is added once and reads the latest callbacks from here. A
  // theme that hands over a new onClose each render, and renders on the arrow
  // keys, had the listener swapped mid-keystroke, and a listener removed during
  // an event never hears it.
  const handlers = useRef({ onClose, unlockHidden })
  handlers.current = { onClose, unlockHidden }
  useEffect(() => {
    const onKey = (event) => {
      const { onClose, unlockHidden } = handlers.current
      if (event.key === 'Escape') { onClose(); return }
      if (event.repeat) return
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
      typed.current = [...typed.current, key].slice(-11)
      if (KONAMI.every((want, i) => typed.current[typed.current.length - KONAMI.length + i] === want)) {
        typed.current = []
        event.preventDefault()
        playUnlockChime()
        onClose()
        unlockHidden()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div
      className="about-backdrop"
      role="presentation"
      onPointerDown={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div className="about-card" ref={cardRef} role="dialog" aria-modal="true" aria-label={t('about.title')}>
        <button type="button" className="about-close" title={t('common.close')} onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor"
                  strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>

        <img className="about-icon" src={icon} width="88" height="88" alt="" />
        <h1 className="about-name" data-about-text>{APP.name}</h1>
        <p className="about-version" data-about-text>{t('about.version', { version: APP.version })}</p>
        {latest && (
          <p className="about-update">
            <span data-about-text>{t('about.updateAvailable', { version: latest.version })}</span>
            {' '}
            <a href={APP.releases} target="_blank" rel="noopener noreferrer" data-about-text>{t('about.whatsNew')}</a>
          </p>
        )}
        <p className="about-tagline" data-about-text>{t('about.tagline')}</p>

        <ul className="about-points">
          <li data-about-text>{t('about.pointLocal')}</li>
          <li data-about-text>{t('about.pointThemes')}</li>
          <li data-about-text>{t('about.pointNetwork')}</li>
          <li data-about-text>{t('about.pointUpgrade')}</li>
          <li data-about-text>{t('about.pointMore')}</li>
        </ul>

        <p className="about-support-note about-support-lead" data-about-text>{t('about.supportNote')}</p>
        <a className="about-support" href={APP.donate} target="_blank" rel="noopener noreferrer">
          <Heart className="about-support-glyph" width={20} height={20} />
          <span data-about-text>{t('about.support')}</span>
        </a>

        <p className="about-note about-note-first" data-about-text>{t('about.trademark')}</p>
        <hr className="about-rule" />
        {/* Non-breaking hyphens keep the license's name on one line ("AGPL-3.0-" / "only" in Outrun). */}
        <p className="about-license" data-about-text>{t('about.license', { license: APP.license.replace(/-/g, '\u2011') })}</p>
        {/* The source (AGPL-3.0-only's network clause: whoever uses this copy may have
            it) and the licenses of what Sonora includes from others, as they ask. */}
        <p className="about-links">
          <a href={APP.source} target="_blank" rel="noopener noreferrer" data-about-text>{t('about.github')}</a>
          <span aria-hidden="true"> | </span>
          <a href="/third-party-notices" target="_blank" rel="noopener noreferrer" data-about-text>{t('about.thirdParty')}</a>
        </p>

      </div>
    </div>
  )
}
