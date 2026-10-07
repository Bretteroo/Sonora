import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react'
import { THEMES, DEFAULT_THEME } from '../../../themes/index.js'
import { api } from './api.js'

// The theming engine.
//
// A theme here is not a palette swap. Several replicate existing products
// whose layouts and user flows differ fundamentally: one is a single-column
// web player, another is a three-pane desktop application. So Sonora has no
// shell of its own -- every theme brings one and composes the shared state
// itself -- and the engine only handles selection, persistence, and publishing
// design tokens as CSS custom properties.

const ThemeContext = createContext(null)
const STORAGE_KEY = 'sonora.theme'
// Light, dark or follow the system. A theme that declares `variants` -- a
// light or dark set of tokens laid over its base -- answers to it; one that
// declares none has one appearance and keeps it whatever is chosen, which is
// what the setting promises ("where supported"). Solarized is the first with
// both.
const APPEARANCE_KEY = 'sonora.appearance'
//: Set when a theme is chosen from the theme chooser, cleared by the theme it
//: names once it has opened its own theme page (useThemeLanding below).
const LANDING_KEY = 'sonora.themeLanding'
export const APPEARANCES = ['light', 'dark', 'system']

function readStoredAppearance() {
  try {
    const stored = window.localStorage.getItem(APPEARANCE_KEY)
    if (APPEARANCES.includes(stored)) return stored
  } catch { /* the default is fine */ }
  return 'system'
}

function systemPrefersDark() {
  try { return window.matchMedia('(prefers-color-scheme: dark)').matches } catch { return false }
}

// The variants a theme offers, in the setting's own words.
export function appearancesOf(theme) {
  return Object.keys(theme?.variants || {}).filter((k) => k === 'light' || k === 'dark')
}

// Which of a theme's own variants an appearance setting comes down to, or
// null where the theme has none. "system" follows the browser.
export function variantFor(theme, appearance, systemDark) {
  const resolved = appearance === 'system' ? (systemDark ? 'dark' : 'light') : appearance
  return theme?.variants?.[resolved] ? resolved : null
}

// The still to show for a theme: the one its variant carries when that
// variant has its own, else the theme's.
export function thumbnailFor(theme, appearance, systemDark) {
  const variant = variantFor(theme, appearance, systemDark)
  return (variant && theme?.variants?.[variant]?.thumbnail) || theme?.thumbnail || ''
}

// Themes that were renamed (Hi-Fi 2 became Hi-Fi when the first Hi-Fi was
// retired): a browser that saved the old id lands on the new one.
const RENAMED = { strata: 'sedona', nocturne: 'outrun', desktop: 'macos', hifi2: 'hifi' }

function readStoredTheme() {
  try {
    const stored = RENAMED[window.localStorage.getItem(STORAGE_KEY)] || window.localStorage.getItem(STORAGE_KEY)
    // An id that is not a built-in is kept rather than discarded: it may
    // belong to an installed theme, whose package has not been fetched yet on
    // the first paint. Resolution below falls back to the default for as long
    // as nothing answers to it, so a theme that was deleted still lands
    // somewhere without the stored id being rewritten from under the reader.
    if (stored) return stored
  } catch {
    // Private browsing and blocked storage both land here; the default is fine.
  }
  return DEFAULT_THEME
}

function applyTokens(tokens, colorScheme) {
  const root = document.documentElement
  // Clear tokens from the previous theme so a partial palette cannot inherit
  // stale values from the one before it.
  for (const name of Array.from(root.style)) {
    if (name.startsWith('--t-')) root.style.removeProperty(name)
  }
  for (const [key, value] of Object.entries(tokens || {})) {
    root.style.setProperty(`--t-${key}`, value)
  }
  root.style.colorScheme = colorScheme || 'light dark'
}

// A theme installed as a file rather than compiled in. The package carries
// tokens, a stylesheet and its own layout, which is what gives it a shape --
// it cannot borrow one from a theme, because a theme that another theme needs
// in order to work is not a theme you can install on its own.
//
// The layout travels on the theme and App draws it with LayoutShell; importing
// that here made a cycle -- theme.jsx to LayoutShell to the shared dialogs to
// ThemeChooser and back to theme.jsx -- which works until module ordering
// shifts and then does not. Nothing in a package executes: the CSS is injected
// and the tokens are published, and that is the whole of its reach.
function fromPackage(pkg) {
  return ({
    id: pkg.id,
    name: pkg.name,
    version: pkg.version,
    thumbnail: pkg.thumbnail || '',
    description: pkg.description || '',
    colorScheme: pkg.colorScheme || 'light dark',
    tokens: pkg.tokens || {},
    // Optional light/dark token sets, data like the rest; a package's CSS
    // keys its own variant rules on :root[data-appearance].
    variants: pkg.variants && typeof pkg.variants === 'object' ? pkg.variants : undefined,
    css: pkg.css || '',
    installed: true,
    layout: pkg.layout,
  })
}

const PACKAGE_STYLE = 'sonora-theme-package'

function applyPackageCss(css) {
  let tag = document.getElementById(PACKAGE_STYLE)
  if (!css) { if (tag) tag.remove(); return }
  if (!tag) {
    tag = document.createElement('style')
    tag.id = PACKAGE_STYLE
    document.head.append(tag)
  }
  tag.textContent = css
}

export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(readStoredTheme)
  // Installed packages arrive after the first paint; until then the built-ins
  // are the whole list, which is why a saved id that belongs to a package
  // falls back to the default for that moment and then resolves.
  const [packages, setPackages] = useState({})
  useEffect(() => {
    let canceled = false
    api.themes().then((r) => {
      if (canceled) return
      const map = {}
      for (const pkg of r?.items || []) map[pkg.id] = fromPackage(pkg)
      setPackages(map)
    }).catch(() => { /* the built-ins are enough */ })
    return () => { canceled = true }
  }, [])

  const all = useMemo(() => ({ ...THEMES, ...packages }), [packages])
  const theme = all[themeId] ?? all[DEFAULT_THEME] ?? THEMES[DEFAULT_THEME]

  const [appearance, setAppearanceState] = useState(readStoredAppearance)
  const [systemDark, setSystemDark] = useState(systemPrefersDark)
  useEffect(() => {
    let media
    try { media = window.matchMedia('(prefers-color-scheme: dark)') } catch { return undefined }
    const onChange = (event) => setSystemDark(event.matches)
    media.addEventListener?.('change', onChange)
    return () => media.removeEventListener?.('change', onChange)
  }, [])
  const resolved = appearance === 'system' ? (systemDark ? 'dark' : 'light') : appearance
  // The variant worn: the one asked for when the theme has it, else nothing
  // (the theme's base is its only look).
  const variant = theme.variants?.[resolved] || null

  useEffect(() => {
    applyPackageCss(theme.css || '')
    applyTokens({ ...(theme.tokens || {}), ...(variant?.tokens || {}) },
                variant?.colorScheme || theme.colorScheme)
    const root = document.documentElement
    root.dataset.theme = theme.id
    // A package drawn by the layout renderer: the renderer's sheets key on it.
    if (theme.layout) root.dataset.layout = ''
    else delete root.dataset.layout
    // What was asked for, and what this theme is actually wearing: CSS keys
    // variant rules on the second, so a one-look theme is never half-swapped.
    root.dataset.appearance = resolved
    if (variant) root.dataset.variant = resolved
    else delete root.dataset.variant
    // The page title is the app's name, whatever the theme; themes do not
    // rename the tab.
    document.title = 'Sonora'
  }, [theme, variant, resolved])

  const setAppearance = useCallback((value) => {
    if (!APPEARANCES.includes(value)) return
    setAppearanceState(value)
    try { window.localStorage.setItem(APPEARANCE_KEY, value) } catch { /* session only */ }
  }, [])

  // `land`: chosen from the theme chooser, so the new theme opens on its own
  // theme page rather than wherever it was last left.
  const selectTheme = useCallback((id, { land = false } = {}) => {
    if (!all[id]) return
    if (land) {
      try { window.sessionStorage.setItem(LANDING_KEY, id) } catch { /* it opens where it was */ }
    }
    setThemeId(id)
    try {
      window.localStorage.setItem(STORAGE_KEY, id)
    } catch {
      // Selection still applies for this session even if it cannot persist.
    }
  }, [all])

  // Installed themes are listed after the built-ins, so the shipped set keeps
  // its order and an upload appends rather than shuffling the list.
  const value = useMemo(() => ({
    theme,
    themeId: theme.id,
    themes: [...Object.values(THEMES), ...Object.values(packages)],
    reloadThemes: () => api.themes().then((r) => {
      const map = {}
      for (const pkg of r?.items || []) map[pkg.id] = fromPackage(pkg)
      setPackages(map)
    }).catch(() => {}),
    selectTheme,
    appearance,
    setAppearance,
    resolvedAppearance: resolved,
    //: Whether the browser is asking for dark, for a chooser that wants to
    //: show what "system" comes down to right now.
    systemDark,
    // Whether the theme in hand answers to the setting at all.
    appearanceSupported: Boolean(variant) || appearancesOf(theme).length > 0,
  }), [theme, packages, selectTheme, all, appearance, setAppearance, resolved, variant, systemDark])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used inside ThemeProvider')
  return value
}

/**
 * Open this theme's own theme page, once, when it has just been chosen from
 * the theme chooser. Every theme calls it with whatever opens the page holding
 * its ThemeChooser; a theme put on any other way (a reload, the dev switch)
 * opens as it was left.
 */
export function useThemeLanding(open) {
  const { themeId } = useTheme()
  const latest = useRef(open)
  latest.current = open
  useEffect(() => {
    let wanted = null
    try { wanted = window.sessionStorage.getItem(LANDING_KEY) } catch { return }
    if (!wanted || wanted !== themeId) return
    try { window.sessionStorage.removeItem(LANDING_KEY) } catch { /* fine */ }
    latest.current()
  }, [themeId])
}
