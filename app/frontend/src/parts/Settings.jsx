import React, { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n/index.jsx'
import ThemeChooser from '../components/ThemeChooser.jsx'
import AboutSonora from '../components/AboutSonora.jsx'
import { useThemeLanding } from '../lib/theme.jsx'

// Settings, for a layout that places them.
//
// The theme chooser is the part that matters: a layout decides what is on the
// screen, so a layout that shows no way to leave it leaves whoever installed
// it with the browser console as the only way back. A theme shipped that way
// once, for about an hour, which is where this came from.
//
// Sonora's own settings windows are each shell's own -- the Windows replica's
// Settings dialog, the Mac's Preferences, Sonofuture's settings section -- and
// this is not a replacement for them. It is the smallest thing that keeps a
// layout escapable, plus About.
export default function PartSettings({ variant = 'panel' }) {
  const { t } = useI18n()
  const [about, setAbout] = useState(false)
  // A theme just chosen in the chooser opens on its theme page, as every
  // built-in theme does (2026-10-05): here, the settings part is scrolled
  // into view.
  const ref = useRef(null)
  useThemeLanding(() => ref.current?.scrollIntoView({ block: 'start' }))
  return (
    <section ref={ref} className={`pt-settings pt-settings-${variant}`} aria-label={t('common.settings')}>
      <h2>{t('common.settings')}</h2>
      <ThemeChooser />
      <button type="button" className="pt-settings-about" onClick={() => setAbout(true)}>
        {t('about.menu')}
      </button>
      {about && <AboutSonora onClose={() => setAbout(false)} />}
    </section>
  )
}

/**
 * The way out of a layout that offers none.
 *
 * Rendered by the renderer itself when an arrangement places no `settings`
 * part, so no theme -- built in or installed from a file -- can strand a
 * person in itself. It is deliberately small and out of the way: a theme that
 * does place settings never shows it.
 */
export function EscapeHatch() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  // A theme just chosen opens with this panel showing its chooser.
  useThemeLanding(() => setOpen(true))
  const corner = useVisibleCorner()
  return (
    <div className="pt-escape" style={corner}>
      <button type="button" className="pt-escape-button" onClick={() => setOpen((v) => !v)}
              title={t('common.settings')} aria-expanded={open}>
        {t('common.settings')}
      </button>
      {open && (
        <div className="pt-escape-panel" role="dialog" aria-label={t('common.settings')}>
          <ThemeChooser />
          <button type="button" className="pt-escape-close" onClick={() => setOpen(false)}>
            {t('common.close')}
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Where the bottom-right corner actually is on screen.
 *
 * `position: fixed` is relative to the *layout* viewport, which on a phone
 * asking for the desktop site is wider and taller than the part you can see:
 * the page is scaled to fit the width, so the bottom of the layout viewport
 * is below the screen and a button anchored there cannot be found until you
 * scroll. Reported from Firefox on a phone, in desktop view, where the button
 * was visible in mobile view and not in desktop view.
 *
 * `visualViewport` describes the part that is actually shown -- its offset
 * within the layout viewport, its size, and the scale -- so the button is
 * placed against that instead, and follows a pinch or a pan. Browsers without
 * it keep the plain corner, which is what the stylesheet already says.
 */
function useVisibleCorner() {
  const [style, setStyle] = useState(null)
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    if (!vv) return undefined
    const place = () => {
      // Off by a hair rather than exactly on the edge, and clear of a notch.
      const inset = 16
      setStyle({
        left: `${vv.offsetLeft + vv.width - inset}px`,
        top: `${vv.offsetTop + vv.height - inset}px`,
        right: 'auto',
        bottom: 'auto',
        transform: `translate(-100%, -100%) scale(${1 / (vv.scale || 1)})`,
        transformOrigin: 'bottom right',
      })
    }
    place()
    vv.addEventListener('resize', place)
    vv.addEventListener('scroll', place)
    return () => {
      vv.removeEventListener('resize', place)
      vv.removeEventListener('scroll', place)
    }
  }, [])
  return style || undefined
}
