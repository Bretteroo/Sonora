import './shared.css'
import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useI18n, LANGUAGES } from '../i18n/index.jsx'
import { useTheme, APPEARANCES, appearancesOf, thumbnailFor } from '../lib/theme.jsx'
import { api } from '../lib/api.js'
import { DEFAULT_THEME } from '../../../themes/index.js'

// The one theme chooser, worn by every settings page.
//
// Language, then the theme, then -- only where the theme in the list has both
// a light and a dark variant -- three buttons in a pill for light, dark and
// system. A theme with one look shows no pill at all and is never described
// as having none: the buttons' presence is the whole of what is said about it
// (user's order and rule). Under that, the still of the chosen
// theme with its name, version, description, and Apply beside it, and last a
// Manage Themes heading over installing and deleting.
//
// A theme is not swapped under the reader as they browse the list; the choice
// is held here and applied when they say so. The appearance buttons are not
// held back that way -- they are the appearance setting itself, and pressing
// one swaps the still so the reader sees what they chose.
//
// Each shell passes its own class names, so the chooser sits in the Windows
// dialog, Sonofuture's sheet and the web page in each one's own dress while
// the arrangement stays the same everywhere.
function DefaultRow({ c, label, hint, children }) {
  return (
    <div className={c.field}>
      <span className={c.label}>{label}</span>
      {children}
      {hint && <p className={c.hint}>{hint}</p>}
    </div>
  )
}

export default function ThemeChooser({ classes = {}, title = null, Field = null, Select = 'select' }) {
  const { themes, themeId, selectTheme, reloadThemes, appearance, setAppearance, theme,
          systemDark } = useTheme()
  const { t, language, selectLanguage } = useI18n()
  const [pending, setPending] = useState(themeId)
  // The appearance is held back with the theme rather than applied as it is
  // pressed. Pressing Dark used to turn the running interface dark under the
  // reader while they were still deciding; now it only changes the still, and
  // what Apply puts on.
  const [pendingAppearance, setPendingAppearance] = useState(appearance)
  const [error, setError] = useState('')
  const file = useRef(null)
  useEffect(() => { setPending(themeId) }, [themeId])
  // Someone else may change the setting while this is open -- another window,
  // another settings page -- and the buttons should say what is true.
  useEffect(() => { setPendingAppearance(appearance) }, [appearance])
  const chosen = themes.find((entry) => entry.id === pending)
  // The still shows what Apply would put on: the theme being considered, in
  // the appearance being considered.
  const shot = thumbnailFor(chosen || theme, pendingAppearance, systemDark)
  const variants = appearancesOf(chosen || theme)
  const hasBoth = variants.includes('light') && variants.includes('dark')

  // The theme list is as wide as its longest name, in every theme: each one
  // draws its own list, so the name is measured in the list's own font,
  // spacing and case, and the list's padding and arrow are added to it.
  const fitId = useId()
  useLayoutEffect(() => {
    const box = document.querySelector(`[data-fit-list="${CSS.escape(fitId)}"]`)
    if (!box) return
    box.style.minWidth = ''
    const text = box.querySelector('[class*="select-label"], [class*="select-value"]') || box
    const style = window.getComputedStyle(text)
    const canvas = document.createElement('canvas').getContext('2d')
    if (!canvas) return
    canvas.font = style.font || `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    const spacing = parseFloat(style.letterSpacing) || 0
    const upper = style.textTransform === 'uppercase'
    const widest = Math.max(0, ...themes.map((entry) => {
      const name = upper ? String(entry.name || '').toUpperCase() : String(entry.name || '')
      return canvas.measureText(name).width + spacing * name.length
    }))
    // What the list has beside its text: a custom list's padding and arrow
    // around its label, or a native select's padding and its own arrow.
    const boxStyle = window.getComputedStyle(box)
    const chrome = text === box
      ? (parseFloat(boxStyle.paddingLeft) || 0) + (parseFloat(boxStyle.paddingRight) || 0) + 28
      : box.getBoundingClientRect().width - text.getBoundingClientRect().width
    box.style.minWidth = `${Math.ceil(widest + chrome + 2)}px`
  }, [themes, language, fitId])

  const install = async (picked) => {
    if (!picked) return
    setError('')
    try {
      const answer = await api.installTheme(picked)
      await reloadThemes?.()
      if (answer?.theme?.id) setPending(answer.theme.id)
    } catch (exc) {
      setError(exc?.message || String(exc))
    }
  }
  const remove = async () => {
    if (!chosen?.installed) return
    setError('')
    try {
      if (themeId === chosen.id) selectTheme(DEFAULT_THEME)
      await api.deleteTheme(chosen.id)
      await reloadThemes?.()
      setPending(themeId === chosen.id ? DEFAULT_THEME : themeId)
    } catch (exc) {
      setError(exc?.message || String(exc))
    }
  }

  const c = {
    field: 'dk-field', label: '', select: '', button: 'dk-win-btn', primary: 'dk-win-btn',
    preview: 'dk-theme-preview', version: 'dk-theme-version', blurb: 'dk-theme-blurb',
    noshot: 'dk-theme-noshot', actions: 'dk-theme-actions', error: 'dk-add-error', hint: 'dk-theme-hint',
    manage: 'dk-theme-manage',
    ...classes,
  }
  // A shell may hand over its own labeled-field component; the default is
  // the desktop dialog's label-over-control pair. The default is a component
  // of its own, defined once below: written inline here it was a new kind of
  // component on every render, so React rebuilt each row, the theme list with
  // it, on every tick of a playing track, and an open list closed by itself
  // (Firefox on Ubuntu, a Plex album playing to This browser).
  const Row = Field || DefaultRow
  const rowProps = Field ? {} : { c }
  return (
    <>
      {title && <h3>{title}</h3>}
      <Row {...rowProps} label={t('common.language')}>
        {/* A shell may bring its own dropdown that takes <option>s. */}
        <Select className={c.select} value={language} onChange={(e) => selectLanguage(e.target.value)}>
          {LANGUAGES.map((lang) => <option key={lang.code} value={lang.code}>{lang.name}</option>)}
        </Select>
      </Row>
      <Row {...rowProps} label={t('common.theme')}>
        <Select className={c.select} value={pending} onChange={(e) => setPending(e.target.value)}
                data-fit-list={fitId} style={{ maxWidth: '100%' }}>
          {themes.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
        </Select>
      </Row>
      {hasBoth && (
        <Row {...rowProps} label={t('common.appearance')}>
          <span className="theme-pill" role="group" aria-label={t('common.appearance')}>
            {APPEARANCES.map((mode) => (
              <button key={mode} type="button" aria-pressed={pendingAppearance === mode}
                      onClick={() => setPendingAppearance(mode)}>
                {t(`common.appearance${mode[0].toUpperCase()}${mode.slice(1)}`)}
              </button>
            ))}
          </span>
        </Row>
      )}
      <div className={c.preview}>
        {shot
          ? <img src={shot} alt={t('desk.prefs.themeShot', { theme: chosen?.name || pending })} width={320} height={200} />
          : <span className={c.noshot}>{t('desk.prefs.themeNoShot')}</span>}
        <div className="theme-about">
          <p className={c.version}>
            {chosen?.name || pending}
            {chosen?.version && <span> {t('desk.prefs.themeVersion', { version: chosen.version })}</span>}
            {chosen?.installed && <em> {t('desk.prefs.themeInstalled')}</em>}
          </p>
          {chosen?.description && <p className={c.blurb}>{chosen.description}</p>}
          {/* Apply commits both, and is offered whenever either differs. The
              appearance is only worth committing where the theme in hand has
              two ways up: a theme with one look would otherwise change the
              setting for whatever is worn next. */}
          <button type="button" className={`${c.primary} theme-apply`} data-default="true"
                  disabled={pending === themeId && (!hasBoth || pendingAppearance === appearance)}
                  onClick={() => {
                    if (hasBoth && pendingAppearance !== appearance) setAppearance(pendingAppearance)
                    if (pending !== themeId) selectTheme(pending, { land: true })
                  }}>{t('common.apply')}</button>
        </div>
      </div>
      <div className={c.manage}>
        <h4>{t('desk.prefs.manageThemes')}</h4>
        {error && <p className={c.error}>{error}</p>}
        <div className={c.actions}>
          <button type="button" className={c.button} onClick={() => file.current?.click()}>{t('desk.prefs.themeUpload')}</button>
          <button type="button" className={c.button} disabled={!chosen?.installed}
                  title={chosen?.installed ? undefined : t('desk.prefs.themeBuiltIn')}
                  onClick={remove}>{t('desk.prefs.themeDelete')}</button>
          <input ref={file} type="file" accept="application/zip,.zip" hidden
                 onChange={(event) => { install(event.target.files?.[0]); event.target.value = '' }} />
        </div>
      </div>
    </>
  )
}
