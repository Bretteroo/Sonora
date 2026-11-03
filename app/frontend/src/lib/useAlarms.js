import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api.js'
import { useSystem } from './store.jsx'
import { isBrowserRoom } from './browserRoom.js'

// The household's alarms (read from any of its speakers), with on/off,
// delete, create and update. The speakers take a full alarm definition each
// time, so the editors send the whole thing.
export function useAlarms(zoneUuid) {
  // AlarmClock's AlarmListVersion reaches the store as an "alarms" message,
  // so a change made in one of the desktop apps refreshes the list here too.
  const { alarmsEpoch, households, zones } = useSystem()
  const [alarms, setAlarms] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // The room the list shown was read for. Changing system keeps the old list
  // up until the new one arrives, so a theme can move one into the other
  // (lib/listMotion.js); until then nothing on it can be changed.
  const [readFor, setReadFor] = useState(null)
  const latest = useRef(0)
  // This browser belongs to no household, so it has no alarm list of its own
  // and the speakers refused its id. Chosen, it lists every household's
  // alarms, each read through one of that household's rooms; an alarm is
  // then changed through its own room, and a new one through the room it
  // will play in. Alarm ids count from 1 in each household, so they are kept
  // apart here as "<room>|<id>". A scene alarm is Sonora's, listed whichever
  // household is read, so it keeps its own id and is listed once.
  const every = isBrowserRoom(zoneUuid)
  const readers = every
    ? (households || []).map((h) => (h.zone_uuids.find((uuid) => zones?.[uuid]?.online !== false && zones?.[uuid]) || h.zone_uuids.find((uuid) => zones?.[uuid]))).filter(Boolean)
    : []
  const readersKey = readers.join(',')
  const load = useCallback(() => {
    if (!zoneUuid) return
    const asked = ++latest.current
    const read = every
      ? Promise.all(readers.map((uuid) => api.alarms(uuid))).then((lists) => {
        const all = lists.flatMap((r) => r.alarms || [])
        const scenes = [...new Map(all.filter((a) => a.scene).map((a) => [a.ID, a])).values()]
        return { alarms: [...all.filter((a) => !a.scene).map((a) => ({ ...a, ID: `${a.RoomUUID}|${a.ID}` })), ...scenes] }
      })
      : api.alarms(zoneUuid)
    read.then((r) => { if (asked === latest.current) { setAlarms(r.alarms || []); setReadFor(zoneUuid); setError('') } })
      .catch((exc) => { if (asked === latest.current) { setAlarms(null); setReadFor(zoneUuid); setError(exc.message) } })
  }, [zoneUuid, readersKey])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])
  const switching = alarms !== null && readFor !== zoneUuid
  useEffect(() => { if (alarmsEpoch) load() }, [alarmsEpoch, load])
  // A save (create, update) the speakers refuse answers with their reason, for
  // the editor to show over itself; any other refusal is the list's error.
  const apply = async (fn, save = false) => {
    setBusy(true); setError('')
    let refused = ''
    try {
      const r = await fn()
      if (every) load()
      else setAlarms(r.alarms || [])
    } catch (exc) { if (save) refused = exc.message; else setError(exc.message) }
    setBusy(false)
    return refused
  }
  // The room to send a change through, and the speakers' own id.
  const target = (id) => {
    if (!every) return [zoneUuid, id]
    if (!String(id).includes('|')) return [readers[0], id]
    const cut = String(id).lastIndexOf('|')
    return [String(id).slice(0, cut), String(id).slice(cut + 1)]
  }
  return {
    alarms, error, busy: busy || switching, refresh: load,
    toggle: (id, enabled) => { const [zone, own] = target(id); return apply(() => api.setAlarm(own, { zone, enabled })) },
    remove: (id) => { const [zone, own] = target(id); return apply(() => api.deleteAlarm(own, zone)) },
    create: (definition) => apply(() => api.createAlarm({ zone: every ? (definition.room_uuid || readers[0]) : zoneUuid, ...definition }), true),
    update: (id, definition) => {
      const [zone, own] = target(id)
      // A scene alarm made a room's alarm again goes to that room's household.
      const via = every && !definition.scene && !String(id).includes('|') ? (definition.room_uuid || zone) : zone
      return apply(() => api.updateAlarm(own, { zone: via, ...definition }), true)
    },
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
    // An alarm plays on a speaker: chosen from this browser, a new one opens
    // on the first room instead.
    room: alarm?.RoomUUID || (isBrowserRoom(defaultRoom) ? '' : defaultRoom) || rooms[0]?.uuid || '',
    musicTitle: alarm?.scene_name || (alarm && alarm.ProgramURI !== 'x-rincon-buzzer:0' ? (alarm.program_title || alarm.ProgramURI) : ''),
    // A Sonora scene the alarm sets in place of music: the room and volume are then the scene's.
    scene: alarm?.scene || '',
    programUri: alarm?.ProgramURI || 'x-rincon-buzzer:0',
    programMetadata: alarm?.ProgramMetaData || '',
    // A new alarm has every day ticked and Once Only clear, in both apps'
    // Add Alarm (Windows capture alarm-editor.png; the Mac app, 2026-09-23).
    once: alarm ? rec === 'ONCE' : false,
    days: alarm ? days : [0, 1, 2, 3, 4, 5, 6],
    // A scene alarm is saved silent; set back to music, it starts from the usual level.
    volume: alarm && !alarm.scene ? Number(alarm.Volume || 25) : 25,
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
    include_linked_zones: form.linked, scene: form.scene || '',
  }
}

// The alarm music pickers' "Sonora Scenes": every scene, each a choice of its own.
// The backend saves it as a silent alarm in a room of its choosing; the scene
// itself may be on any system.
export function alarmScenes(list) {
  return (list?.scenes || []).map((s) => ({ id: `scene:${s.id}`, title: s.name, leaf: true, uri: 'x-rincon-buzzer:0', metadata: '', scene: s.id }))
}

