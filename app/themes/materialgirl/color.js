import { useEffect } from 'react'
import {
  Hct, MaterialDynamicColors, QuantizerCelebi, SchemeTonalSpot, Score, argbFromRgb, hexFromArgb,
} from '@material/material-color-utilities'

// Dynamic color, the Material You way: the playing artwork picks the seed every role in the
// scheme is built from.
//
// The scheme is Material's own, from Material Color Utilities (Apache-2.0): the cover's pixels are
// quantized and scored as Android does, so the seed is a color that is really in the art, and the
// tonal-spot scheme of the 2025 (Expressive) spec turns it into every role at its exact tone, in
// gamut, for light and for dark. Both sets are written into one style element, so the variant
// switch in mg.css keeps working. mg.css carries an OKLCH approximation of the same scheme for the
// moment before this runs. It used to be the scheme: hue and chroma from an average of the cover,
// tones by OKLCH lightness, tertiary turned the wrong way round the wheel.

export const DYNAMIC_KEY = 'sonora.mg.dynamic'
// Material's baseline seed, the purple of the reference scheme.
const BASELINE = 0xff6750a4

export function readDynamic() {
  try { return window.localStorage.getItem(DYNAMIC_KEY) !== '0' } catch { return true }
}
export function writeDynamic(on) {
  try { window.localStorage.setItem(DYNAMIC_KEY, on ? '1' : '0') } catch { /* private mode */ }
  window.dispatchEvent(new CustomEvent('sonora:mgdynamic', { detail: on }))
}

const ROLES = [
  'primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer', 'inversePrimary',
  'secondary', 'onSecondary', 'secondaryContainer', 'onSecondaryContainer',
  'tertiary', 'onTertiary', 'tertiaryContainer', 'onTertiaryContainer',
  'error', 'onError', 'errorContainer', 'onErrorContainer',
  'surface', 'surfaceDim', 'surfaceBright', 'surfaceContainerLowest', 'surfaceContainerLow',
  'surfaceContainer', 'surfaceContainerHigh', 'surfaceContainerHighest',
  'onSurface', 'onSurfaceVariant', 'outline', 'outlineVariant', 'inverseSurface', 'inverseOnSurface',
]
const cssName = (role) => `--mg-${role.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`

// A checkbox's check in the scheme's on-primary, as an image: the native checkboxes Material Girl
// restyles (in shared panels such as the alarm editor) draw no glyph of their own once their
// appearance is removed, and a data URI cannot read a custom property.
export function checkGlyph(hex) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 18 18'><path d='M4.5 9.3l3 3 6-6.6' fill='none' stroke='${hex}' stroke-width='2'/></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

function declarations(seed, dark) {
  const scheme = new SchemeTonalSpot(Hct.fromInt(seed), dark, 0, '2025')
  const roles = ROLES.map((role) => `${cssName(role)}: ${hexFromArgb(MaterialDynamicColors[role].getArgb(scheme))};`).join(' ')
  return `${roles} --mg-check-glyph: ${checkGlyph(hexFromArgb(MaterialDynamicColors.onPrimary.getArgb(scheme)))};`
}

const sheets = new Map()
function schemeCss(seed) {
  if (!sheets.has(seed)) {
    sheets.set(seed, `:root[data-theme='materialgirl'] { ${declarations(seed, false)} }\n`
      + `:root[data-theme='materialgirl'][data-variant='dark'] { ${declarations(seed, true)} }`)
  }
  return sheets.get(seed)
}

const seeds = new Map()

// The artwork's seed as Android picks a wallpaper's: its pixels quantized to at most 128 colors
// and scored for how well each would carry a scheme. A cover with nothing usable (gray, black and
// white) gives null, and the baseline stands.
export function seedFromImage(src) {
  if (!src) return Promise.resolve(null)
  if (seeds.has(src)) return Promise.resolve(seeds.get(src))
  return new Promise((resolve) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      try {
        const size = 64
        const canvas = document.createElement('canvas')
        canvas.width = size; canvas.height = size
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        ctx.drawImage(img, 0, 0, size, size)
        const { data } = ctx.getImageData(0, 0, size, size)
        const pixels = []
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 255) continue
          pixels.push(argbFromRgb(data[i], data[i + 1], data[i + 2]))
        }
        const ranked = Score.score(QuantizerCelebi.quantize(pixels, 128), { desired: 1, fallbackColorARGB: 0, filter: true })
        const seed = ranked[0] ? ranked[0] : null
        seeds.set(src, seed)
        resolve(seed)
      } catch { resolve(null) }
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
}

// Builds the scheme from `src`, or from the baseline when there is no art, the art has no usable
// color, or dynamic color is off. Removed when the shell unmounts, so another theme never inherits
// the roles.
export function useDynamicColor(src, enabled) {
  useEffect(() => {
    let canceled = false
    const apply = (seed) => {
      if (canceled) return
      let el = document.getElementById('mg-scheme')
      if (!el) {
        el = document.createElement('style')
        el.id = 'mg-scheme'
        document.head.appendChild(el)
      }
      const css = schemeCss(seed || BASELINE)
      if (el.textContent !== css) el.textContent = css
    }
    if (!enabled || !src) apply(null)
    else seedFromImage(src).then(apply)
    return () => { canceled = true }
  }, [src, enabled])
  useEffect(() => () => { document.getElementById('mg-scheme')?.remove() }, [])
}
