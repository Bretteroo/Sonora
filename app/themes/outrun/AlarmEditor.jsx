import React, { useEffect, useState } from 'react'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { api } from '../../frontend/src/lib/api.js'
import { Window } from './Dialogs.jsx'
import * as Icon from '../../frontend/src/components/Icons.jsx'
import { isPlayableLeaf } from '../../frontend/src/lib/items.js'
import { ALARM_DAYS, alarmToForm, formToDefinition } from '../../frontend/src/lib/useAlarms.js'

// The app's alarm editor (alarms/editalarmwindow.xaml, captured 2026-09-05,
// 494x494 "Add Alarm" / "Edit Alarm"): a 110px label column with Alarm
// (On/Off), Time, Room, Music + "Select…", Schedule (Once Only and the days
// in two columns), Volume, Duration (No Limit + a time), Include grouped
// rooms, Shuffle music; OK / Cancel. "Select…" swaps the page for "Browse to
// alarm music": a bordered "Alarm Music" list of Sonos Chime, Sonos
// Playlists, Imported Playlists and each service, browsed in place, with
// "Set Alarm Music" live once a playable item is chosen.
const DAYS = ALARM_DAYS

export default function AlarmEditor({ alarm = null, rooms, households, onClose, onSave, busy = false, defaultRoom = ''}) {
  const { t } = useI18n()
  const [form, setForm] = useState(() => alarmToForm(alarm, rooms, defaultRoom))
  const [picking, setPicking] = useState(false)
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const toggleDay = (d) => set({ once: false, days: form.days.includes(d) ? form.days.filter((x) => x !== d) : [...form.days, d] })
  const save = () => onSave(formToDefinition(form))
  const title = alarm ? t('win.alarm.editTitle') : t('win.alarm.addTitle')
  const musicText = form.programUri === 'x-rincon-buzzer:0' ? t('win.alarm.chime') : form.musicTitle

  if (picking) {
    return (
      <Window title={title} onClose={onClose} className="win-alarm-editor">
        <AlarmMusicPicker room={rooms.find((r) => r.uuid === form.room) || rooms[0]} households={households}
                          onCancel={() => setPicking(false)}
                          onPick={(item) => { set({ programUri: item.uri, programMetadata: item.metadata || '', musicTitle: item.title }); setPicking(false) }} />
      </Window>
    )
  }
  return (
    <Window title={title} onClose={onClose} className="win-alarm-editor">
      <div className="win-alarm-body">
        <div className="win-alarm-grid">
          <span className="win-alarm-label">{t('win.alarm.alarm')}</span>
          <div className="win-alarm-radios">
            <label><input type="radio" name="alarm-on" checked={form.enabled} onChange={() => set({ enabled: true })} /> {t('win.alarm.on')}</label>
            <label><input type="radio" name="alarm-on" checked={!form.enabled} onChange={() => set({ enabled: false })} /> {t('win.alarm.off')}</label>
          </div>
          <span className="win-alarm-label">{t('desk.alarms.time')}</span>
          <div><input type="time" className="win-alarm-time" value={form.time} onChange={(e) => e.target.value && set({ time: e.target.value })} /></div>
          <span className="win-alarm-label">{t('desk.alarms.room')}</span>
          <div><select className="win-alarm-room" value={form.room} onChange={(e) => set({ room: e.target.value })}>
            {rooms.map((r) => <option key={r.uuid} value={r.uuid}>{r.name}</option>)}
          </select></div>
          <span className="win-alarm-label">{t('win.alarm.music')}</span>
          <div className="win-alarm-music">
            <input type="text" readOnly value={musicText} />
            <button type="button" className="dk-win-btn" onClick={() => setPicking(true)}>{t('win.alarm.select')}</button>
          </div>
          <span className="win-alarm-label">{t('win.alarm.schedule')}</span>
          <div className="win-alarm-days">
            <label><input type="checkbox" checked={form.once} onChange={(e) => set({ once: e.target.checked })} /> {t('win.alarm.onceOnly')}</label>
            {DAYS.map((d) => (
              <label key={d}><input type="checkbox" checked={!form.once && form.days.includes(d)} onChange={() => toggleDay(d)} /> {t(`win.alarm.day.${d}`)}</label>
            ))}
          </div>
          <span className="win-alarm-label">{t('win.alarm.volume')}</span>
          <div><input type="range" className="win-alarm-volume" data-wheel-step="2" min="0" max="100" value={form.volume} onChange={(e) => set({ volume: Number(e.target.value) })} /></div>
          <span className="win-alarm-label">{t('win.alarm.duration')}</span>
          <div className="win-alarm-duration">
            <label><input type="checkbox" checked={form.noLimit} onChange={(e) => set({ noLimit: e.target.checked })} /> {t('win.alarm.noLimit')}</label>
            <input type="text" className="win-alarm-time win-alarm-length" value={form.duration} disabled={form.noLimit} inputMode="numeric"
                   pattern="[0-9]{2}:[0-9]{2}" title="HH:MM" onChange={(e) => set({ duration: e.target.value })}
                   onBlur={(e) => { const m = /^(\d{1,2}):?(\d{2})$/.exec(e.target.value.trim()); set({ duration: m ? `${m[1].padStart(2, '0')}:${m[2]}` : '02:00' }) }} />
            <label><input type="checkbox" checked={form.linked} onChange={(e) => set({ linked: e.target.checked })} /> {t('win.alarm.linked')}</label>
            <label><input type="checkbox" checked={form.shuffle} disabled={form.programUri === 'x-rincon-buzzer:0'} onChange={(e) => set({ shuffle: e.target.checked })} /> {t('win.alarm.shuffle')}</label>
          </div>
        </div>
      </div>
      <div className="win-dialog-foot win-alarm-foot">
        <button type="button" className="dk-win-btn" data-default="true" disabled={busy || !form.room} onClick={save}>{t('common.ok')}</button>
        <button type="button" className="dk-win-btn" onClick={onClose}>{t('common.cancel')}</button>
      </div>
    </Window>
  )
}

// The music picker page. Roots: Sonos Chime (a leaf), Sonos Playlists (SQ:),
//: The household's services as last read, so the alarm music page does not
//: rebuild its list from nothing every time it opens.
const servicesCache = new Map()

// Imported Playlists (A:PLAYLISTS) and each service (SMAPI root). Deeper
// levels browse the same way the Music pane does.
function AlarmMusicPicker({ room, households, onCancel, onPick }) {
  const { t } = useI18n()
  const { zones } = useSystem()
  const [stack, setStack] = useState([])
  const [items, setItems] = useState([])
  const [services, setServices] = useState(null)
  const [loading, setLoading] = useState(false)
  const [chosen, setChosen] = useState(null)
  const zone = room?.uuid
  const household = households.find((h) => h.zone_uuids?.includes(zone))
  // The list appears complete rather than growing: the services answer is
  // kept from the last time it was asked for, so reopening the page shows
  // everything at once, and the first open holds the rows back until the
  // answer lands instead of letting services snap in seconds later (reported
  // 2026-09-07).
  useEffect(() => {
    let canceled = false
    const held = servicesCache.get(household?.id || '')
    if (held) setServices(held)
    api.services().then((r) => {
      const hh = (r.households || []).find((h) => h.household === household?.id)
      // What the app offers as alarm music is not simply every service on
      // the household: its list showed 80s80s, Amazon Music, Audacy, Libby,
      // Mixcloud, Pandora and Plex but not AccuRadio (2026-09-07), and the
      // only thing separating them is the service's Capabilities -- bits 23
      // and 24 are set on every one it listed and clear on AccuRadio.
      const list = [...(hh?.in_use || [])]
        .filter((svc) => ((svc.capabilities ?? 0) & 0x1800000) === 0x1800000)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
      servicesCache.set(household?.id || '', list)
      if (!canceled) setServices(list)
    }).catch(() => { if (!canceled && !held) setServices([]) })
    return () => { canceled = true }
  }, [household?.id])
  const node = stack[stack.length - 1] || null
  useEffect(() => {
    setChosen(null)
    if (!node) { setItems([]); return undefined }
    let canceled = false
    setLoading(true)
    const fetcher = node.service
      ? api.browseService(node.service, { zone, item: node.item ?? 'root', count: 200, account: node.account || '' })
      : api.browse(node.id, { zone, count: 200 })
    fetcher.then((r) => { if (!canceled) { setItems(r.items || []); setLoading(false) } })
      .catch(() => { if (!canceled) { setItems([]); setLoading(false) } })
    return () => { canceled = true }
  }, [node, zone])
  const roots = services === null ? [] : [
    { id: '__chime', title: t('win.alarm.chime'), leaf: true, uri: 'x-rincon-buzzer:0', metadata: '' },
    { id: 'SQ:', title: t('desk.browse.playlists') },
    { id: 'A:PLAYLISTS', title: t('win.alarm.importedPlaylists') },
    ...services.map((s) => ({ id: `svc:${s.id}`, title: s.name, service: s.id, account: s.account_id ?? '' })),
  ]
  const rows = node ? items : roots
  // Anything the speakers can play is alarm music: a station, an album, a
  // playlist (Sonos or a service's), a track. Containers without a URI open.
  const isLeaf = (row) => Boolean(row.leaf) || (Boolean(node) && Boolean(row.uri) && (isPlayableLeaf(row) || row.is_container))
  const open = (row) => {
    if (isLeaf(row)) { setChosen(row); return }
    if (row.service) { setStack([...stack, { id: row.id, title: row.title, service: row.service, item: 'root', account: row.account }]); return }
    if (node?.service) { setStack([...stack, { ...node, id: row.id, title: row.title, item: row.id }]); return }
    setStack([...stack, { id: row.id, title: row.title }])
  }
  return (
    <>
      <div className="win-alarm-body">
        <h3>{t('win.alarm.browseTitle')}</h3>
        <div className="win-alarm-picker">
          <div className="win-alarm-picker-head">
            {stack.length > 0 && <button type="button" className="win-alarm-picker-back" onClick={() => setStack(stack.slice(0, -1))}><Icon.ChevronLeft /></button>}
            <span>{node ? node.title : t('win.alarm.alarmMusic')}</span>
          </div>
          <div className="win-alarm-picker-list" role="listbox">
            {loading && <p className="win-alarm-picker-note">{t('desk.browse.loading')}</p>}
            {!loading && rows.map((row, i) => (
              <button key={`${row.id}-${i}`} type="button" role="option" aria-selected={chosen?.id === row.id}
                      className="win-alarm-picker-row" onClick={() => open(row)}
                      onDoubleClick={() => { if (isLeaf(row)) onPick(row) }}>
                <span>{row.title}</span>
                {!isLeaf(row) && <Icon.ChevronRight />}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="win-dialog-foot win-alarm-foot">
        <button type="button" className="dk-win-btn" data-default="true" disabled={!chosen} onClick={() => chosen && onPick(chosen)}>{t('win.alarm.setMusic')}</button>
        <button type="button" className="dk-win-btn" onClick={onCancel}>{t('common.cancel')}</button>
      </div>
    </>
  )
}
