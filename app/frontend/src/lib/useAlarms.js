import { useCallback, useEffect, useState } from 'react'
import { api } from './api.js'
import { useSystem } from './store.jsx'

// The household's alarms (read from any of its speakers), with on/off,
// delete, create and update. The speakers take a full alarm definition each
// time, so the editors send the whole thing.
export function useAlarms(zoneUuid) {
  // AlarmClock's AlarmListVersion reaches the store as an "alarms" message,
  // so a change made in one of the desktop apps refreshes the list here too.
  const { alarmsEpoch } = useSystem()
  const [alarms, setAlarms] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => {
    if (!zoneUuid) return
    api.alarms(zoneUuid).then((r) => { setAlarms(r.alarms || []); setError('') })
      .catch((exc) => setError(exc.message))
  }, [zoneUuid])
  useEffect(() => { setAlarms(null); load() }, [load])
  useEffect(() => { if (alarmsEpoch) load() }, [alarmsEpoch, load])
  const apply = async (fn) => {
    setBusy(true); setError('')
    try { const r = await fn(); setAlarms(r.alarms || []) } catch (exc) { setError(exc.message) }
    setBusy(false)
  }
  return {
    alarms, error, busy, refresh: load,
    toggle: (id, enabled) => apply(() => api.setAlarm(id, { zone: zoneUuid, enabled })),
    remove: (id) => apply(() => api.deleteAlarm(id, zoneUuid)),
    create: (definition) => apply(() => api.createAlarm({ zone: zoneUuid, ...definition })),
    update: (id, definition) => apply(() => api.updateAlarm(id, { zone: zoneUuid, ...definition })),
  }
}

// "ONCE", "DAILY", "WEEKDAYS", "WEEKENDS" or "ON_135" (days, 0 = Sunday).
export function recurrenceKey(recurrence) {
  if (!recurrence) return 'ONCE'
  if (recurrence.startsWith('ON_')) return 'ON'
  return recurrence
}
export function recurrenceDays(recurrence) {
  return recurrence?.startsWith('ON_') ? recurrence.slice(3).split('').map(Number) : []
}

// The editors' form model <-> the speakers' alarm definition.
export const ALARM_DAYS = [1, 2, 3, 4, 5, 6, 0] // Monday first, as the apps list them
export function alarmToForm(alarm, rooms, defaultRoom = '') {
  const rec = alarm?.Recurrence || 'ONCE'
  const days = rec === 'DAILY' ? [0, 1, 2, 3, 4, 5, 6] : rec === 'WEEKDAYS' ? [1, 2, 3, 4, 5]
    : rec === 'WEEKENDS' ? [0, 6] : rec.startsWith('ON_') ? rec.slice(3).split('').map(Number) : []
  return {
    enabled: alarm ? alarm.Enabled === '1' : true,
    time: (alarm?.StartTime || '07:00:00').slice(0, 5),
    room: alarm?.RoomUUID || defaultRoom || rooms[0]?.uuid || '',
    musicTitle: alarm && alarm.ProgramURI !== 'x-rincon-buzzer:0' ? (alarm.program_title || alarm.ProgramURI) : '',
    programUri: alarm?.ProgramURI || 'x-rincon-buzzer:0',
    programMetadata: alarm?.ProgramMetaData || '',
    // A new alarm has every day ticked and Once Only clear, in both apps'
    // Add Alarm (Windows capture alarm-editor.png; the Mac app, 2026-09-23).
    once: alarm ? rec === 'ONCE' : false,
    days: alarm ? days : [0, 1, 2, 3, 4, 5, 6],
    volume: alarm ? Number(alarm.Volume || 25) : 25,
    noLimit: alarm ? !alarm.Duration : false,
    duration: (alarm?.Duration || '02:00:00').slice(0, 5),
    linked: alarm ? alarm.IncludeLinkedZones === '1' : false,
    shuffle: alarm ? /SHUFFLE/.test(alarm.PlayMode || '') : false,
  }
}
export function recurrenceOf(form) {
  if (form.once || form.days.length === 0) return 'ONCE'
  const set = new Set(form.days)
  if (set.size === 7) return 'DAILY'
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return 'WEEKDAYS'
  if (set.size === 2 && set.has(0) && set.has(6)) return 'WEEKENDS'
  return 'ON_' + [...set].sort().join('')
}
export function formToDefinition(form) {
  return {
    start_time: `${form.time}:00`, duration: form.noLimit ? '' : `${form.duration}:00`,
    recurrence: recurrenceOf(form), enabled: form.enabled, room_uuid: form.room,
    program_uri: form.programUri, program_metadata: form.programMetadata,
    play_mode: form.shuffle ? 'SHUFFLE_NOREPEAT' : 'NORMAL', volume: form.volume,
    include_linked_zones: form.linked,
  }
}
