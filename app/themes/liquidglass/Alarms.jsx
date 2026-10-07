import React, { useState } from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { orderedHouseholds } from '../../frontend/src/lib/format.js'
import { useAlarms, recurrenceKey, recurrenceDays } from '../../frontend/src/lib/useAlarms.js'
import { useSleepTimers, SLEEP_CHOICES, sleepLabel, clockText } from '../../frontend/src/lib/useSleepTimer.js'
import AlarmEditorPanel from '../../frontend/src/components/AlarmEditorPanel.jsx'
import * as I from './icons.jsx'
import { Sheet, SheetHeader, Button, Toggle, Confirm, Empty, SystemTabs, IconButton, Spinner, Chip } from './ui.jsx'
import { groupTitle } from './house.js'

// Alarms and the sleep timer: the two things a room does on a clock.

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function AlarmsSection({ households, zones, activeZone, activeGroup, systemFilter }) {
  const { t } = useI18n()
  const { zoneList } = useSystem()
  const ordered = orderedHouseholds(households).filter((h) => !systemFilter || systemFilter === 'all' || h.id === systemFilter)
  const [tab, setTab] = useState(null)
  const activeHh = tab && ordered.some((h) => h.id === tab) ? tab
    : (activeZone && ordered.find((h) => h.zone_uuids.includes(activeZone.uuid))?.id) || ordered[0]?.id
  const zoneUuid = ordered.find((h) => h.id === activeHh)?.zone_uuids?.find((u) => zones[u]) || ''
  const { alarms, error, busy, toggle, remove, create, update } = useAlarms(zoneUuid)
  const rooms = zoneList.filter((z) => households.find((h) => h.id === activeHh)?.zone_uuids.includes(z.uuid)).sort((a, b) => a.name.localeCompare(b.name))
  const [editing, setEditing] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const describe = (a) => {
    const key = recurrenceKey(a.Recurrence)
    if (key === 'ON') return recurrenceDays(a.Recurrence).map((i) => DAY_LETTERS[i]).join(' ')
    return t(`desk.alarms.recurrence.${key}`)
  }
  const music = (a) => (a.ProgramURI === 'x-rincon-buzzer:0' ? t('win.alarm.chime') : (a.music || a.ProgramTitle || ''))
  return (
    <div className="sf-alarms">
      <header className="sf-page-head">
        <div>
          <h1>{t('desk.browse.alarms')}</h1>
        </div>
        <div className="sf-page-actions">
          <SystemTabs households={ordered} value={activeHh} onChange={setTab} />
          <Button primary icon={<I.Plus />} disabled={busy || !zoneUuid} onClick={() => setEditing('new')}>{t('win.alarms.add')}</Button>
        </div>
      </header>

      <SleepCard zone={activeZone} groupLabel={activeGroup ? groupTitle(activeGroup, zones, t) : ''} />

      <section className="sf-alarm-list" aria-label={t('desk.browse.alarms')}>
        {alarms === null && !error && <div className="sf-loading"><Spinner />{t('desk.browse.loading')}</div>}
        {error && <p className="sf-error">{error}</p>}
        {alarms && alarms.length === 0 && <Empty icon={<I.Bell />} title={t('desk.alarms.none')} />}
        {alarms && alarms.map((a) => (
          <article key={a.ID} className="sf-alarm" data-on={a.Enabled === '1' || undefined}>
            <Toggle checked={a.Enabled === '1'} disabled={busy} label="" onChange={(on) => toggle(a.ID, on)} />
            <div className="sf-alarm-time">
              <strong>{a.StartTime.replace(/:00$/, '')}</strong>
              <span>{describe(a)}</span>
            </div>
            <div className="sf-alarm-text">
              <span className="sf-alarm-room"><I.Speaker />{a.room || '—'}</span>
              {music(a) && <span className="sf-alarm-music"><I.Note />{music(a)}</span>}
            </div>
            <div className="sf-alarm-tools">
              <IconButton size="sm" label={t('win.alarms.edit')} disabled={busy} onClick={() => setEditing(a)}><I.Pencil /></IconButton>
              <IconButton size="sm" label={t('desk.alarms.delete')} disabled={busy} onClick={() => setConfirm(a)}><I.Trash /></IconButton>
            </div>
          </article>
        ))}
      </section>
      {editing && (
        <Sheet kind="center" title={editing === 'new' ? t('win.alarm.addTitle') : t('win.alarm.editTitle')} onClose={() => setEditing(null)} className="sf-alarm-editor">
          <SheetHeader title={editing === 'new' ? t('win.alarm.addTitle') : t('win.alarm.editTitle')} onClose={() => setEditing(null)} />
          <div className="sf-sheet-body">
            <AlarmEditorPanel heading={false} alarm={editing === 'new' ? null : editing} rooms={rooms} households={households} busy={busy}
                              onCancel={() => setEditing(null)}
                              onSave={async (d) => { if (editing === 'new') await create(d); else await update(editing.ID, d); setEditing(null) }} />
          </div>
        </Sheet>
      )}
      {confirm && (
        <Confirm title={t('desk.alarms.deleteTitle')} body={t('desk.alarms.deleteBody', { time: confirm.StartTime.replace(/:00$/, ''), room: confirm.room || '' })}
                 action={t('desk.alarms.delete')} danger disabled={busy}
                 onConfirm={() => { remove(confirm.ID); setConfirm(null) }} onClose={() => setConfirm(null)} />
      )}
    </div>
  )
}

// The sleep timer, shared by the page card and the sheet the bar opens.
//
// With no timer on the selected room the durations are offered; with one, a
// large clock counts it down live in their place and a single Cancel clears
// it. Under that, every other room on the system with a timer running has a
// row of its own with its clock and Cancel; rooms without one are not
// listed. The selected room always heads the list, marked.
function SleepBody({ zone, groupLabel = '', zones, compact = false }) {
  const { t } = useI18n()
  const { timers, set, cancel } = useSleepTimers()
  if (!zone) return null
  const mine = timers.find((row) => row.zone === zone.uuid)
  const others = timers.filter((row) => row.zone !== zone.uuid && zones?.[row.zone])
  return (
    <>
      <div className="sf-sleep-row" data-active="true">
        <div className="sf-sleep-row-text">
          <strong>{groupLabel || zone.name}</strong>
          {mine ? <span className="sf-sleep-clock" aria-live="off">{clockText(mine.seconds)}</span>
                : <span className="sf-muted">{t('desk.sleep.none')}</span>}
        </div>
        {mine ? (
          <Button onClick={() => cancel(zone.uuid)}>{t('common.cancel')}</Button>
        ) : (
          <div className="sf-chips">
            {SLEEP_CHOICES.map((m) => <Chip key={m} onClick={() => set(zone.uuid, m)}>{sleepLabel(t, m)}</Chip>)}
          </div>
        )}
      </div>
      {others.length > 0 && (
        <div className="sf-sleep-others">
          {!compact && <p className="sf-muted sf-sleep-others-title">{t('desk.sleep.elsewhere')}</p>}
          {others.map((row) => (
            <div className="sf-sleep-row" key={row.zone}>
              <div className="sf-sleep-row-text">
                <strong>{zones[row.zone].topology_label || zones[row.zone].name}</strong>
                <span className="sf-sleep-clock sf-sleep-clock-small">{clockText(row.seconds)}</span>
              </div>
              <Button onClick={() => cancel(row.zone)}>{t('common.cancel')}</Button>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

export function SleepCard({ zone, groupLabel = '' }) {
  const { t } = useI18n()
  const { zones } = useSystem()
  if (!zone) return null
  return (
    <section className="sf-sleep-card" aria-label={t('desk.browse.sleepTimer')}>
      <h2><I.Moon />{t('desk.browse.sleepTimer')}</h2>
      <SleepBody zone={zone} groupLabel={groupLabel} zones={zones} />
    </section>
  )
}

export function SleepSheet({ zone, groupLabel = '', onClose }) {
  const { t } = useI18n()
  const { zones } = useSystem()
  return (
    <Sheet kind="center" title={t('desk.browse.sleepTimer')} onClose={onClose} className="sf-sleepsheet">
      <SheetHeader title={t('desk.browse.sleepTimer')} sub={groupLabel || zone?.name || ''} onClose={onClose} />
      <div className="sf-sheet-body">
        <SleepBody zone={zone} groupLabel={groupLabel} zones={zones} compact />
      </div>
      <footer className="sf-sheet-foot"><Button primary onClick={onClose}>{t('common.done')}</Button></footer>
    </Sheet>
  )
}
