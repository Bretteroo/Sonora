import { useEffect, useState } from 'react'
import { api } from '../../frontend/src/lib/api.js'

// The machine's own settings: whether the picture bends with the glass,
// whether videos play behind the words, and the list of them. The switches
// are kept in this browser. The list is kept by Sonora, under this theme's
// name, so every browser plays the same videos; this browser holds a copy to
// start from before Sonora has answered. The list starts empty, and it is
// kept as it is while the videos are switched off.
// Settings' Appearance page changes them; every part of the theme that cares
// listens for the change.

const KEYS = { bend: 'sonora.km.bend', videosOn: 'sonora.km.videosOn', videos: 'sonora.km.videos', keySound: 'sonora.km.keySound', zoomVideo: 'sonora.km.zoomVideo', altDesign: 'sonora.km.altDesign' }
const EVENT = 'sonora:kmprefs'
// What the video box holds before the reader has touched it: nothing, unless
// whoever built this copy named a list for it (VITE_KM_VIDEOS in
// frontend/.env.local, written as the box would hold it).
const FIRST_VIDEOS = import.meta.env?.VITE_KM_VIDEOS || ''

// This machine keeps its settings with the Karaoke Machine's, as it keeps the same browser
// settings: the same videos play on either, and a change made on one is there on the other.
const THEME = 'karaoke'
// How long after the last change to the list it is sent, so a list being
// typed is not sent letter by letter.
const SEND_AFTER = 700

function read(key, fallback) {
  try { return window.localStorage.getItem(key) ?? fallback } catch { return fallback }
}

export function readPrefs() {
  return {
    bend: read(KEYS.bend, '1') !== '0',
    videosOn: read(KEYS.videosOn, '1') !== '0',
    keySound: read(KEYS.keySound, '1') !== '0',
    // Off unless turned on: a video drawn larger so a squarer picture fills a wide screen.
    zoomVideo: read(KEYS.zoomVideo, '0') === '1',
    // Off unless turned on: the same machine in another cabinet, with other keys.
    altDesign: read(KEYS.altDesign, '0') === '1',
    videos: read(KEYS.videos, FIRST_VIDEOS),
  }
}

function announce() {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: readPrefs() }))
}

export function writePref(name, value) {
  try { window.localStorage.setItem(KEYS[name], value ? '1' : '0') } catch { /* private mode */ }
  announce()
}

function hold(name, text) {
  try { window.localStorage.setItem(KEYS[name], text) } catch { /* private mode */ }
}

// Whether the last change to a kept setting has reached Sonora. It is not said of a setting
// nobody has changed since the page was opened.
const SAVED = 'sonora:kmsaved'
let saved = false
function tell(now) {
  if (saved === now) return
  saved = now
  window.dispatchEvent(new CustomEvent(SAVED))
}

export function useSaved() {
  const [now, setNow] = useState(saved)
  useEffect(() => {
    const on = () => setNow(saved)
    on()
    window.addEventListener(SAVED, on)
    return () => window.removeEventListener(SAVED, on)
  }, [])
  return now
}

// What is waiting to be sent, and the timer that will send it.
let waiting = null
let timer = 0

function send() {
  window.clearTimeout(timer)
  if (waiting === null) return
  const changes = waiting
  waiting = null
  api.keepThemeSettings(THEME, changes).then(() => { if (waiting === null) tell(true) }).catch(() => { waiting = { ...changes, ...waiting }; timer = window.setTimeout(send, 5000) })
}

// A change still waiting as the page is left is sent in a way that outlives the page.
function sendLeaving() {
  window.clearTimeout(timer)
  if (waiting === null) return
  const body = JSON.stringify(waiting)
  waiting = null
  try { fetch(`/api/themes/${THEME}/settings`, { method: 'PUT', keepalive: true, headers: { 'Content-Type': 'application/json' }, body }).catch(() => {}) } catch { /* nothing more to do from a page that is going */ }
}

// A setting that is words, not a switch. An emptied one is kept as empty, so
// a box the reader cleared stays clear. It is Sonora's to keep.
export function writeText(name, text) {
  const value = text.trim() ? text : ''
  hold(name, value)
  waiting = { ...waiting, [name]: value }
  window.clearTimeout(timer)
  timer = window.setTimeout(send, SEND_AFTER)
  tell(false)
  announce()
}

// Sonora's copy of the list is asked for once.
let asked = false
function ask() {
  if (asked) return
  asked = true
  api.themeSettings(THEME).then(({ settings }) => {
    if (waiting && 'videos' in waiting) return
    if (typeof settings?.videos !== 'string' || settings.videos === read(KEYS.videos, null)) return
    hold('videos', settings.videos)
    announce()
  }).catch(() => { asked = false })
}

if (typeof window !== 'undefined') window.addEventListener('pagehide', sendLeaving)

export function usePrefs() {
  const [prefs, setPrefs] = useState(readPrefs)
  useEffect(() => {
    ask()
    const on = (event) => setPrefs(event.detail || readPrefs())
    window.addEventListener(EVENT, on)
    return () => window.removeEventListener(EVENT, on)
  }, [])
  return prefs
}
