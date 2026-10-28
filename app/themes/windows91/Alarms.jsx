import React, { useState } from 'react'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { useAlarms, recurrenceKey, recurrenceDays } from '../../frontend/src/lib/useAlarms.js'
import { Window, Confirm } from './Dialogs.jsx'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import AlarmEditor from './AlarmEditor.jsx'
import { withoutBrowserRoom } from '../../frontend/src/lib/browserRoom.js'

// The app names the zone generically ("6:44 AM Pacific Time"), not by the
// season ("Pacific Daylight Time"), so the line reads the same all year.
function zoneTime(now) {
  const opts = { hour: 'numeric', minute: '2-digit' }
  try {
    return new Intl.DateTimeFormat(undefined, { ...opts, timeZoneName: 'longGeneric' }).format(now)
  } catch {
    return new Intl.DateTimeFormat(undefined, { ...opts, timeZoneName: 'long' }).format(now)
  }
}

// "Alarms" as the Windows app draws it (captured 2026-09-05, 494x494): the
// heading, the current time, a Where / When / ON table with Add, Edit and
// Remove beside it, two help lines and Done. Adding and editing wait on the
// alarm editor; on/off and remove work today.
export default function Alarms({ zone, onClose }) {
  const { t } = useI18n()
  const { alarms, error, busy, toggle, remove, create, update } = useAlarms(zone?.uuid)
  const { zoneList, households } = useSystem()
  // An alarm lives on a speaker, so the browser room is not one of these.
  const rooms = withoutBrowserRoom(zoneList).sort((a, b) => a.name.localeCompare(b.name))
  // A new alarm opens on the chosen room's group, first by name -- the app's
  // Add Alarm showed the member whose name sorts first, not the coordinator.
  const defaultRoom = (() => {
    const members = (zone?.group_members || []).map((u) => zoneList.find((z) => z.uuid === u)).filter(Boolean)
    const sorted = members.sort((a, b) => a.name.localeCompare(b.name))
    return sorted[0]?.uuid || zone?.uuid || ''
  })()
  const [selected, setSelected] = useState(null)
  const [editing, setEditing] = useState(null) // null, 'new' or an alarm
  const [confirm, setConfirm] = useState(null)
  const now = new Date()
  const stamp = `${new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(now)} - ${
    zoneTime(now)}`
  // "3:00 AM - Once", as the app prints it (observed 2026-09-05).
  const when = (a) => {
    const [h, m] = (a.StartTime || '00:00:00').split(':').map(Number)
    const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(2000, 0, 1, h, m))
    const key = recurrenceKey(a.Recurrence)
    const days = key === 'ON'
      ? recurrenceDays(a.Recurrence).map((d) => t(`desk.alarms.day.${d}`)).join(', ')
      : t(`desk.alarms.recurrence.${key}`)
    return `${time} - ${days}`
  }
  const chosen = alarms?.find((a) => a.ID === selected) || null
  return (
    <Window title={t('desk.browse.alarms')} onClose={onClose} className="win-alarms">
      <div className="win-alarms-body">
        <h3>{t('win.alarms.manage')}</h3>
        <p className="win-alarms-time">{t('win.alarms.currentTime', { time: stamp })}</p>
        <div className="win-alarms-main">
          <div className="win-alarms-table" role="grid">
            <div className="win-alarms-head" role="row">
              <span>{t('win.alarms.where')}</span><span>{t('win.alarms.when')}</span><span>{t('win.alarms.on')}</span>
            </div>
            {(alarms || []).map((a) => (
              <div key={a.ID} role="row" className="win-alarms-row" aria-selected={selected === a.ID}
                   onClick={() => setSelected(a.ID)}>
                <span>{a.room || ''}</span>
                <span>{when(a)}</span>
                <span>
                  <input type="checkbox" checked={a.Enabled === '1'} disabled={busy}
                         title={t('desk.alarms.enabled')}
                         onChange={(e) => toggle(a.ID, e.target.checked)} onClick={(e) => e.stopPropagation()} />
                </span>
              </div>
            ))}
            {error && <p className="dk-add-error">{error}</p>}
          </div>
          <div className="win-alarms-buttons">
            <button type="button" className="dk-win-btn" disabled={busy} onClick={() => setEditing('new')}>{t('win.alarms.add')}</button>
            <span />
            <button type="button" className="dk-win-btn" disabled={!chosen || busy} onClick={() => setEditing(chosen)}>{t('win.alarms.edit')}</button>
            <button type="button" className="dk-win-btn" disabled={!chosen || busy} onClick={() => setConfirm(chosen)}>{t('win.alarms.remove')}</button>
          </div>
        </div>
        <p className="win-alarms-help">{t('win.alarms.help1')}<br />{t('win.alarms.help2')}</p>
      </div>
      {editing && (
        <AlarmEditor alarm={editing === 'new' ? null : editing} rooms={rooms} households={households} busy={busy}
                     defaultRoom={defaultRoom}
                     onClose={() => setEditing(null)}
                     onSave={async (definition) => {
                       if (editing === 'new') await create(definition); else await update(editing.ID, definition)
                       setEditing(null)
                     }} />
      )}
      <div className="win-dialog-foot">
        <button type="button" className="dk-win-btn" data-default="true" onClick={onClose}>{t('common.done')}</button>
      </div>
      {confirm && (
        <Confirm title={t('win.queue.confirmTitle')}
                 body={t('win.alarms.deleteConfirm')}
                 action={t('desk.alarms.delete')} disabled={busy}
                 cancelLabel={t('common.cancel')}
                 onConfirm={async () => { await remove(confirm.ID); setConfirm(null); setSelected(null) }}
                 onClose={() => setConfirm(null)} />
      )}
    </Window>
  )
}
