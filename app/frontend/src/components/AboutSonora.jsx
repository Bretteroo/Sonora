import React, { useEffect, useLayoutEffect, useRef } from 'react'
import { useI18n } from '../i18n/index.jsx'
import { APP } from '../lib/meta.js'
import { Heart } from './Icons.jsx'
import icon from '../assets/sonora.png'
import './about.css'
import { guardAboutText } from '../lib/aboutGuard.js'

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

export default function AboutSonora({ onClose }) {
  const { t } = useI18n()

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

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

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
