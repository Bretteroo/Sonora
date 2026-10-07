import React, { useEffect, useState } from 'react'
import TimeField from './TimeField.jsx'
import { useI18n } from '../i18n/index.jsx'
import { useSystem } from '../lib/store.jsx'
import { api } from '../lib/api.js'
import { isPlayableLeaf } from '../lib/items.js'
import { ALARM_DAYS, alarmToForm, formToDefinition } from '../lib/useAlarms.js'
import * as Icon from './Icons.jsx'
import './alarm.css'

// The alarm editor every theme but Windows shares (Windows has the app's own
// dialog): the same fields the Sonos apps offer, drawn with the theme's
// tokens. "Choose…" swaps the form for a music picker: Sonos Chime, Sonos
// Playlists, Imported Playlists and each service, browsed in place.
// `Select` is the dropdown the room is chosen with: the browser's by default, or a theme's own
// (Material Girl passes its exposed dropdown, which follows its menus).
// `heading`: false where the theme's own sheet already names the editor in its header, so
// "Add Alarm" is not said twice (Liquid Glass).
export default function AlarmEditorPanel({ alarm = null, rooms, households, onCancel, onSave, busy = false, clock = null, formId = undefined, Select = 'select', heading = true }) {
  const { t, language } = useI18n()
  // 12 or 24; a theme that copies an app says which (the Mac app's is 24),
  // and otherwise the locale decides.
  const hours = clock || (new Intl.DateTimeFormat(language, { hour: 'numeric' }).resolvedOptions().hour12 ? 12 : 24)
  const [form, setForm] = useState(() => alarmToForm(alarm, rooms))
  const [picking, setPicking] = useState(false)
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const toggleDay = (d) => set({ once: false, days: form.days.includes(d) ? form.days.filter((x) => x !== d) : [...form.days, d] })
  const musicText = form.programUri === 'x-rincon-buzzer:0' ? t('win.alarm.chime') : form.musicTitle
  if (picking) {
    return (
      <div className="alarm-form">
        <AlarmMusicPicker room={rooms.find((r) => r.uuid === form.room) || rooms[0]} households={households}
                          onCancel={() => setPicking(false)}
                          onPick={(item) => { set({ programUri: item.uri, programMetadata: item.metadata || '', musicTitle: item.title }); setPicking(false) }} />
      </div>
    )
  }
  return (
    // `formId` lets a theme submit the form from a button of its own, outside it (Material Girl's
    // full-screen dialog puts Save in its top bar); a form with no room is not saved from there either.
    <form className="alarm-form" id={formId} onSubmit={(e) => { e.preventDefault(); if (busy || !form.room) return; onSave(formToDefinition(form)) }}>
      {heading && <h3>{alarm ? t('win.alarm.editTitle') : t('win.alarm.addTitle')}</h3>}
      <div className="alarm-grid">
        <label>{t('win.alarm.alarm')}</label>
        <div className="alarm-inline">
          <label><input type="radio" checked={form.enabled} onChange={() => set({ enabled: true })} /> {t('win.alarm.on')}</label>
          <label><input type="radio" checked={!form.enabled} onChange={() => set({ enabled: false })} /> {t('win.alarm.off')}</label>
        </div>
        <label>{t('desk.alarms.time')}</label>
        <div><TimeField className="alarm-time" value={form.time} clock={hours} label={t('desk.alarms.time')} onChange={(time) => set({ time })} /></div>
        <label>{t('desk.alarms.room')}</label>
        <div><Select value={form.room} onChange={(e) => set({ room: e.target.value })}>
          {rooms.map((r) => <option key={r.uuid} value={r.uuid}>{r.name}</option>)}
        </Select></div>
        <label>{t('win.alarm.music')}</label>
        <div className="alarm-inline"><span className="alarm-music">{musicText}</span>
          <button type="button" className="alarm-btn" onClick={() => setPicking(true)}>{t('win.alarm.select')}</button></div>
        <label>{t('win.alarm.schedule')}</label>
        <div className="alarm-days">
          <label><input type="checkbox" checked={form.once} onChange={(e) => set({ once: e.target.checked })} /> {t('win.alarm.onceOnly')}</label>
          {ALARM_DAYS.map((d) => (
            <label key={d}><input type="checkbox" checked={!form.once && form.days.includes(d)} onChange={() => toggleDay(d)} /> {t(`win.alarm.day.${d}`)}</label>
          ))}
        </div>
        <label>{t('win.alarm.volume')}</label>
        <div><input type="range" data-wheel-step="2" min="0" max="100" value={form.volume} onChange={(e) => set({ volume: Number(e.target.value) })} /> <span className="alarm-value">{form.volume}</span></div>
        <label>{t('win.alarm.duration')}</label>
        <div className="alarm-stack">
          <label><input type="checkbox" checked={form.noLimit} onChange={(e) => set({ noLimit: e.target.checked })} /> {t('win.alarm.noLimit')}</label>
          <TimeField className="alarm-time" value={form.duration} clock={24} disabled={form.noLimit}
                     label={t('win.alarm.duration')} onChange={(duration) => set({ duration })} />
          <label><input type="checkbox" checked={form.linked} onChange={(e) => set({ linked: e.target.checked })} /> {t('win.alarm.linked')}</label>
          <label><input type="checkbox" checked={form.shuffle} disabled={form.programUri === 'x-rincon-buzzer:0'} onChange={(e) => set({ shuffle: e.target.checked })} /> {t('win.alarm.shuffle')}</label>
        </div>
      </div>
      <div className="alarm-actions">
        <button type="button" className="alarm-btn" onClick={onCancel}>{t('common.cancel')}</button>
        <button type="submit" className="alarm-btn alarm-btn-primary" disabled={busy || !form.room}>{t('common.ok')}</button>
      </div>
    </form>
  )
}

export function AlarmMusicPicker({ room, households, onCancel, onPick }) {
  const { t } = useI18n()
  useSystem()
  const [stack, setStack] = useState([])
  const [items, setItems] = useState([])
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(false)
  const [chosen, setChosen] = useState(null)
  const zone = room?.uuid
  const household = households.find((h) => h.zone_uuids?.includes(zone))
  useEffect(() => {
    api.services().then((r) => {
      const hh = (r.households || []).find((h) => h.household === household?.id)
      setServices([...(hh?.in_use || [])].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })))
    }).catch(() => setServices([]))
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
  const roots = [
    { id: '__chime', title: t('win.alarm.chime'), leaf: true, uri: 'x-rincon-buzzer:0', metadata: '' },
    { id: 'SQ:', title: t('desk.browse.playlists') },
    { id: 'A:PLAYLISTS', title: t('win.alarm.importedPlaylists') },
    ...services.map((s) => ({ id: `svc:${s.id}`, title: s.name, service: s.id, account: s.account_id ?? '' })),
  ]
  const rows = node ? items : roots
  const isLeaf = (row) => Boolean(row.leaf) || (Boolean(node) && Boolean(row.uri) && (isPlayableLeaf(row) || row.is_container))
  const open = (row) => {
    if (isLeaf(row)) { setChosen(row); return }
    if (row.service) { setStack([...stack, { id: row.id, title: row.title, service: row.service, item: 'root', account: row.account }]); return }
    if (node?.service) { setStack([...stack, { ...node, id: row.id, title: row.title, item: row.id }]); return }
    setStack([...stack, { id: row.id, title: row.title }])
  }
  return (
    <>
      <h3>{t('win.alarm.browseTitle')}</h3>
      <div className="alarm-picker">
        <div className="alarm-picker-head">
          {stack.length > 0 && <button type="button" className="alarm-picker-back" onClick={() => setStack(stack.slice(0, -1))}><Icon.ChevronLeft /></button>}
          <span>{node ? node.title : t('win.alarm.alarmMusic')}</span>
        </div>
        <div className="alarm-picker-list" role="listbox">
          {loading && <p className="alarm-note">{t('desk.browse.loading')}</p>}
          {!loading && rows.map((row, i) => (
            <button key={`${row.id}-${i}`} type="button" role="option" aria-selected={chosen?.id === row.id}
                    className="alarm-picker-row" onClick={() => open(row)} onDoubleClick={() => { if (isLeaf(row)) onPick(row) }}>
              <span>{row.title}</span>{!isLeaf(row) && <Icon.ChevronRight />}
            </button>
          ))}
        </div>
      </div>
      <div className="alarm-actions">
        <button type="button" className="alarm-btn" onClick={onCancel}>{t('common.cancel')}</button>
        <button type="button" className="alarm-btn alarm-btn-primary" disabled={!chosen} onClick={() => chosen && onPick(chosen)}>{t('win.alarm.setMusic')}</button>
      </div>
    </>
  )
}
