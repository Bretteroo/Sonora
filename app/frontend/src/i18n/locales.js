// The locales Sonora speaks, as BCP 47 language tags.
//
// A locale, not a language: en-US and en-GB are different catalogs, so are
// pt-BR and pt-PT, and so are zh-CN and zh-TW -- Simplified and Traditional
// Chinese are not spelling variants of one another and neither is a fallback
// for the other. The tag is what the interface stores, what the backend is
// told, and what a music service is asked for in `Accept-Language`, so there
// is one spelling of a locale everywhere rather than three.
//
// `fallback` is a chain, not a language: a key missing from pt-BR is looked
// for in pt-PT before English, once there is a pt-PT to look in. Every chain
// ends at the reference locale, which is the only one guaranteed complete.
//
// `name` is the locale's own name for itself, which is what the chooser shows
// -- someone looking for their language is looking for the word they call it
// by, not for the English for it. `english` is for the places that must sort
// or report in English.

export const REFERENCE = 'en-US'

export const LOCALES = [
  { tag: 'en-US', name: 'English (US)', english: 'English (US)', fallback: [] },
  { tag: 'cs-CZ', name: 'Čeština', english: 'Czech', fallback: [] },
  { tag: 'da-DK', name: 'Dansk', english: 'Danish', fallback: [] },
  { tag: 'de-DE', name: 'Deutsch', english: 'German', fallback: [] },
  { tag: 'es-ES', name: 'Español', english: 'Spanish', fallback: [] },
  { tag: 'fr-FR', name: 'Français', english: 'French', fallback: [] },
  { tag: 'it-IT', name: 'Italiano', english: 'Italian', fallback: [] },
  { tag: 'hu-HU', name: 'Magyar', english: 'Hungarian', fallback: [] },
  { tag: 'nl-NL', name: 'Nederlands', english: 'Dutch', fallback: [] },
  { tag: 'nb-NO', name: 'Norsk (bokmål)', english: 'Norwegian (Bokmål)', fallback: [] },
  { tag: 'pl-PL', name: 'Polski', english: 'Polish', fallback: [] },
  { tag: 'pt-BR', name: 'Português (Brasil)', english: 'Portuguese (Brazil)',
    fallback: ['pt-PT'] },
  { tag: 'pt-PT', name: 'Português (Portugal)', english: 'Portuguese (Portugal)', fallback: [] },
  { tag: 'fi-FI', name: 'Suomi', english: 'Finnish', fallback: [] },
  { tag: 'sv-SE', name: 'Svenska', english: 'Swedish', fallback: [] },
  { tag: 'uk-UA', name: 'Українська', english: 'Ukrainian', fallback: [] },
  { tag: 'ja-JP', name: '日本語', english: 'Japanese', fallback: [] },
  { tag: 'ko-KR', name: '한국어', english: 'Korean', fallback: [] },
  { tag: 'zh-CN', name: '简体中文', english: 'Chinese (Simplified)', fallback: [] },
  { tag: 'zh-TW', name: '繁體中文', english: 'Chinese (Traditional)', fallback: [] },
]

export const TAGS = LOCALES.map((locale) => locale.tag)

/** The entry for a tag, or undefined. Tags are compared case-insensitively,
 *  since a browser may say `zh-cn` where the registry says `zh-CN`. */
export function localeOf(tag) {
  const wanted = String(tag || '').toLowerCase()
  return LOCALES.find((locale) => locale.tag.toLowerCase() === wanted)
}

/** A tag in its canonical shape: `zh-hant-tw` -> `zh-Hant-TW`. Unknown but
 *  well-formed tags come back tidied rather than rejected, because the caller
 *  may be matching them rather than looking them up. */
export function canonical(tag) {
  const parts = String(tag || '').replace(/_/g, '-').split('-').filter(Boolean)
  if (!parts.length) return ''
  return parts.map((part, i) => {
    if (i === 0) return part.toLowerCase()
    if (part.length === 4) return part[0].toUpperCase() + part.slice(1).toLowerCase()
    if (part.length === 2 || part.length === 3) return part.toUpperCase()
    return part.toLowerCase()
  }).join('-')
}

/** The lookup order for a locale: itself, what it falls back to, then the
 *  reference. A catalog answers for a key only if it has it, so this is the
 *  order the reader's words are looked for in. */
export function chainFor(tag) {
  const entry = localeOf(tag)
  const chain = entry ? [entry.tag, ...entry.fallback] : [tag]
  if (!chain.includes(REFERENCE)) chain.push(REFERENCE)
  return chain.filter((step) => localeOf(step))
}

/** The best locale for what the browser asks for.
 *
 *  `navigator.languages` is in the reader's order of preference, so it is
 *  walked in that order and the first thing that can be answered wins: an
 *  exact tag first, then any locale of the same language (de-AT asked for,
 *  de-DE offered, is closer than English), and English if nothing matches.
 *  A region is never guessed the other way about: zh-TW does not answer for
 *  zh-CN, which is the whole reason these are separate catalogs.
 */
export function bestMatch(wanted) {
  const asked = (wanted || []).map(canonical).filter(Boolean)
  for (const tag of asked) {
    const exact = localeOf(tag)
    if (exact) return exact.tag
  }
  for (const tag of asked) {
    let language = tag.split('-')[0].toLowerCase()
    // Norwegian also arrives as the macrolanguage "no", and Nynorsk ("nn")
    // reads Bokmal more easily than English.
    if (language === 'no' || language === 'nn') language = 'nb'
    // Portuguese outside Brazil follows the European norm (Portugal,
    // Angola, Mozambique ...); Brazil has a catalog of its own.
    if (language === 'pt') return /^BR$/i.test(tag.split('-')[1] || '') ? 'pt-BR' : 'pt-PT'
    // Chinese is the exception a plain language match gets wrong: zh on its
    // own says nothing about the script, and the two scripts are not
    // interchangeable. The script subtag decides when there is one.
    if (language === 'zh') {
      const script = tag.split('-')[1]
      if (/^Hant$/i.test(script) || /^(TW|HK|MO)$/i.test(script)) return 'zh-TW'
      if (/^Hans$/i.test(script) || /^(CN|SG)$/i.test(script)) return 'zh-CN'
      continue
    }
    const near = LOCALES.find((locale) => locale.tag.split('-')[0] === language)
    if (near) return near.tag
  }
  return REFERENCE
}
