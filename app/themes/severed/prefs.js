import { useEffect, useState } from 'react'

// Severed's own settings, kept in this browser: the color of the screen's
// phosphor, whether art is drawn in it or in its own colors, and whether
// the keys sound when they are pressed. Setup's Appearance page changes them;
// every part of the theme that cares listens for the change.

export const PHOSPHORS = ['cyan', 'ice', 'teal', 'green', 'amber']
const KEYS = { phosphor: 'sonora.sv.phosphor', colorArt: 'sonora.sv.colorArt', sound: 'sonora.sv.keySound' }
const EVENT = 'sonora:svprefs'

function read(key, fallback) {
  try { return window.localStorage.getItem(key) ?? fallback } catch { return fallback }
}

export function readPrefs() {
  const phosphor = read(KEYS.phosphor, 'cyan')
  return {
    phosphor: PHOSPHORS.includes(phosphor) ? phosphor : 'cyan',
    colorArt: read(KEYS.colorArt, '0') === '1',
    sound: read(KEYS.sound, '1') !== '0',
  }
}

export function writePref(name, value) {
  const stored = name === 'phosphor' ? value : value ? '1' : '0'
  try { window.localStorage.setItem(KEYS[name], stored) } catch { /* private mode */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: readPrefs() }))
}

export function usePrefs() {
  const [prefs, setPrefs] = useState(readPrefs)
  useEffect(() => {
    const on = (event) => setPrefs(event.detail || readPrefs())
    window.addEventListener(EVENT, on)
    return () => window.removeEventListener(EVENT, on)
  }, [])
  return prefs
}
