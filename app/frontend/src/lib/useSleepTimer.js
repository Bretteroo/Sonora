import { useCallback, useEffect, useState } from 'react'
import { api } from './api.js'
import { useSystem } from './store.jsx'

//: The choices Sonos' own controllers offer, in minutes.
// The app's durations: 15, 30 and 45 minutes, then 1 and 2 hours.
export const SLEEP_CHOICES = [15, 30, 45, 60, 120]

// A duration named the way the app names it: minutes below an hour, hours from
// there ("1 hour", "2 hours").
export function sleepLabel(t, minutes) {
  return minutes >= 60 ? t.plural('desk.sleep.hours', minutes / 60) : t('desk.sleep.minutes', { count: minutes })
}

// Every sleep-timer hook on the page hears a press made through any other,
// at the press: a timer set in a timer view lit the head's lamp only once
// the speaker announced it, a beat or more later.
const pressed = new EventTarget()
function announce(zoneUuid, minutes) {
  pressed.dispatchEvent(Object.assign(new Event('press'), { zoneUuid, minutes }))
}

export function minutesToDuration(minutes) {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}:00`
}

// The sleep timer of the group a zone belongs to: what remains, and a setter
// taking minutes (or null to clear). Read once, again whenever a player
// announces its timer changed (a controller elsewhere set or cleared one,
// which is what sleepEpoch carries) and every 30 seconds besides, so the
// countdown on screen stays near the truth. This one once
// ignored the announcement and could sit half a minute behind while its
// sibling below, reading the same broadcast, was current.
export function useSleepTimer(zoneUuid) {
  const { actions, sleepEpoch } = useSystem()
  const [remaining, setRemaining] = useState('')
  const load = useCallback(() => {
    if (!zoneUuid) return
    api.sleepTimer(zoneUuid).then((r) => setRemaining(r.remaining || '')).catch(() => {})
  }, [zoneUuid])
  useEffect(() => { setRemaining(''); load() }, [load])
  useEffect(() => { load() }, [sleepEpoch]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const hear = (e) => { if (e.zoneUuid === zoneUuid) setRemaining(e.minutes ? minutesToDuration(e.minutes) : '') }
    pressed.addEventListener('press', hear)
    return () => pressed.removeEventListener('press', hear)
  }, [zoneUuid])
  useEffect(() => {
    if (!remaining) return undefined
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [remaining, load])
  // Shown at the press, not after the speaker answers; a refusal reads the
  // truth back.
  const set = useCallback(async (minutes) => {
    if (!zoneUuid) return
    setRemaining(minutes ? minutesToDuration(minutes) : '')
    announce(zoneUuid, minutes)
    const r = await actions.setSleepTimer(zoneUuid, minutes ? minutesToDuration(minutes) : null)
    if (r) setRemaining(r.remaining || '')
    else load()
  }, [zoneUuid, actions, load])
  return { remaining, set, refresh: load }
}

// ``H:MM:SS`` as the speaker reports it, in seconds.
export function durationSeconds(text) {
  const parts = String(text || '').split(':').map(Number)
  if (parts.some(Number.isNaN) || parts.length === 0) return 0
  return parts.reduce((total, part) => total * 60 + part, 0)
}

// Seconds as a clock reads them: ``m:ss`` under an hour, ``h:mm:ss`` from there.
export function clockText(seconds) {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n) => String(n).padStart(2, '0')
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}

// Every sleep timer set anywhere on the system, ticking. The speakers report
// a timer only when asked, so the list is read on mount, again whenever a
// player announces its timer changed (a controller elsewhere set or cleared
// one), and every thirty seconds besides; between reads each timer counts
// down locally, one second at a time, so the clock on screen keeps moving.
export function useSleepTimers() {
  const { actions, sleepEpoch } = useSystem()
  const [timers, setTimers] = useState([])   // [{ zone, seconds }]
  const [loaded, setLoaded] = useState(false)
  const load = useCallback(() => {
    api.sleepTimers().then((r) => {
      setTimers((r.items ?? []).map((row) => ({ zone: row.zone, seconds: durationSeconds(row.remaining) })))
      setLoaded(true)
    }).catch(() => {})
  }, [])
  useEffect(() => { load() }, [load, sleepEpoch])
  useEffect(() => {
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [load])
  useEffect(() => {
    if (!timers.length) return undefined
    const id = setInterval(() => {
      setTimers((current) => current
        .map((row) => ({ ...row, seconds: row.seconds - 1 }))
        .filter((row) => row.seconds > 0))
    }, 1000)
    return () => clearInterval(id)
  }, [timers.length])
  // The countdown starts at the press. It waited for the speaker to take the
  // timer and then for every room's timer to be read again, a dozen calls,
  // so a key pressed showed nothing for a second or more. The reads still follow, and put right anything the guess
  // got wrong, a refusal included.
  useEffect(() => {
    const hear = (e) => setTimers((current) => {
      const rest = current.filter((row) => row.zone !== e.zoneUuid)
      return e.minutes ? [...rest, { zone: e.zoneUuid, seconds: e.minutes * 60 }] : rest
    })
    pressed.addEventListener('press', hear)
    return () => pressed.removeEventListener('press', hear)
  }, [])
  const set = useCallback(async (zoneUuid, minutes) => {
    announce(zoneUuid, minutes)
    setTimers((current) => {
      const rest = current.filter((row) => row.zone !== zoneUuid)
      return minutes ? [...rest, { zone: zoneUuid, seconds: minutes * 60 }] : rest
    })
    await actions.setSleepTimer(zoneUuid, minutes ? minutesToDuration(minutes) : null)
    load()
  }, [actions, load])
  return { timers, loaded, set, cancel: (zoneUuid) => set(zoneUuid, null), refresh: load }
}
