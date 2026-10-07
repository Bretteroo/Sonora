import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react'
import { useTheme } from '../lib/theme.jsx'
import { setRequestLocale } from '../lib/api.js'
import { LOCALES, REFERENCE, bestMatch, canonical, chainFor, localeOf } from './locales.js'
import enUS from './en-US.js'
import deDE from './de-DE.js'
import esES from './es-ES.js'
import frFR from './fr-FR.js'
import itIT from './it-IT.js'
import jaJP from './ja-JP.js'
import koKR from './ko-KR.js'
import zhCN from './zh-CN.js'
import zhTW from './zh-TW.js'
import nlNL from './nl-NL.js'
import ptBR from './pt-BR.js'
import ukUA from './uk-UA.js'
import csCZ from './cs-CZ.js'
import daDK from './da-DK.js'
import fiFI from './fi-FI.js'
import nbNO from './nb-NO.js'
import plPL from './pl-PL.js'
import ptPT from './pt-PT.js'
import svSE from './sv-SE.js'
import huHU from './hu-HU.js'

// Translation.
//
// Every user-visible string lives in one file per locale under this directory
// (locales.js lists them), keyed identically. en-US is the reference: a key
// missing from another catalog is looked for along its fallback chain and then
// in English rather than rendering the key, so a partial translation degrades
// into mixed language instead of into debug output.
//
// Counts that change wording carry .one and .other variants. That is spelled
// out rather than delegated to a pluralization library because the set is
// small and the languages disagree about it: Spanish pluralizes the noun after
// a numeral, Hungarian does not.
//
// The catalogs here are Sonora's own: what the shared components and the
// shared browse parts render, in every theme. A theme's own words are the
// theme's own file -- it declares `strings` in its manifest and they are laid
// over these for as long as it is the chosen one, so a theme carries
// everything it says as well as everything it draws. Two themes may use the
// same key for different words; only the chosen theme's are ever merged.

export const CATALOGS = {
  'en-US': enUS,
  'de-DE': deDE,
  'es-ES': esES,
  'fr-FR': frFR,
  'it-IT': itIT,
  'ja-JP': jaJP,
  'ko-KR': koKR,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  'nl-NL': nlNL,
  'pt-BR': ptBR,
  'uk-UA': ukUA,
  'hu-HU': huHU,
  'cs-CZ': csCZ,
  'da-DK': daDK,
  'fi-FI': fiFI,
  'nb-NO': nbNO,
  'pl-PL': plPL,
  'pt-PT': ptPT,
  'sv-SE': svSE,
}

//: What the chooser offers, in the registry's order, each under its own name
//: for itself. `code` is the BCP 47 tag, which is what everything stores.
export const LANGUAGES = LOCALES.filter((locale) => CATALOGS[locale.tag])
  .map((locale) => ({ code: locale.tag, name: locale.name, english: locale.english }))

const STORAGE_KEY = 'sonora.language'
const I18nContext = createContext(null)

function detect() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored) {
      // Sonora once stored bare language codes. A reader who
      // chose "es" then meant the only Spanish there was, so it is read as
      // that tag rather than thrown away and re-detected.
      const wanted = canonical(stored)
      if (CATALOGS[wanted]) return wanted
      const matched = bestMatch([wanted])
      if (matched) return matched
    }
  } catch {
    // Blocked storage is not an error here; fall through to the browser.
  }
  return bestMatch(navigator.languages ?? [navigator.language ?? REFERENCE])
}

function interpolate(template, vars) {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (whole, name) =>
    (name in vars ? String(vars[name]) : whole))
}

export function I18nProvider({ children }) {
  const [language, setLanguage] = useState(detect)

  useEffect(() => {
    document.documentElement.lang = language
    // What a music service is asked for, too: the backend passes it on.
    setRequestLocale(language)
  }, [language])

  const select = useCallback((code) => {
    if (!CATALOGS[code]) return
    setLanguage(code)
    try {
      window.localStorage.setItem(STORAGE_KEY, code)
    } catch {
      // Selection still applies for this session.
    }
  }, [])

  // The chosen theme's own catalog, if it brought one. A package that names
  // no strings, and the moment before the themes have loaded, both leave this
  // empty and the core catalog answers alone.
  const { theme } = useTheme()
  const themeStrings = theme?.strings || null

  const value = useMemo(() => {
    // The reader's locale, then whatever it falls back to, then the reference
    // one. Each step is the core catalog with the chosen theme's own words
    // laid over it, so a theme may translate a string the core has not and
    // the other way about.
    // A theme's words are laid over every string but Sonora's own About ones: a theme
    // may restyle and rearrange the About view, never change what it says
    // A theme's "about.*" entries are dropped.
    const steps = chainFor(language).map((tag) => ({
      ...(CATALOGS[tag] || {}),
      ...ownWords((themeStrings && themeStrings[tag]) || {}),
    }))

    const t = (key, vars) => {
      const template = steps.reduce(
        (found, step) => (found === undefined ? step[key] : found), undefined)
      if (template === undefined) {
        // Loud in development, harmless in production: showing the key is
        // more useful than showing nothing.
        if (import.meta.env?.DEV) console.warn('missing translation', key)
        return key
      }
      return interpolate(template, vars)
    }

    // Count-aware lookup: t.plural('common.rooms', 3) -> "3 rooms"
    t.plural = (baseKey, count, vars) =>
      t(`${baseKey}.${count === 1 ? 'one' : 'other'}`, { count, ...vars })

    return { t, language, languages: LANGUAGES, selectLanguage: select }
  }, [language, select, themeStrings])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

/** A theme's catalog without the strings no theme may reword. */
export const PROTECTED_PREFIXES = ['about.']
function ownWords(strings) {
  const out = {}
  for (const [key, value] of Object.entries(strings)) {
    if (!PROTECTED_PREFIXES.some((prefix) => key.startsWith(prefix))) out[key] = value
  }
  return out
}

export function useI18n() {
  const value = useContext(I18nContext)
  if (!value) throw new Error('useI18n must be used inside I18nProvider')
  return value
}
