import React, { useState } from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { orderedHouseholds, systemChoiceMatters } from '../../frontend/src/lib/format.js'
import { useAlarms, recurrenceKey, recurrenceDays } from '../../frontend/src/lib/useAlarms.js'
import { useSleepTimers, SLEEP_CHOICES, sleepLabel, clockText } from '../../frontend/src/lib/useSleepTimer.js'
import AlarmEditorPanel from '../../frontend/src/components/AlarmEditorPanel.jsx'
import * as G from './glyphs.jsx'
import { Unit, Display, Key, IconKey, Lever, Led, Panel, PanelHead, Button, Confirm, Empty, Loading, KeyBank } from './controls.jsx'
import { groupTitle } from './house.js'
import { useRackClock } from './Preamp.jsx'

// The program timer: the two things a room does on a clock. The sleep
// section is a row of keys, one per duration, beside a display counting the
// timer down; the programs are the system's alarms, each a line of the
// timer's memory with its time, its seven day lamps, its room and its music.

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

function dayLetters(t) {
  // Monday first, as the apps list them; each letter from the locale's own
  // narrow weekday name, so the lamps read in the reader's language.
  const fmt = new Intl.DateTimeFormat(undefined, { weekday: 'narrow' })
  // 2026-09-06 was a Sunday; day i of the week is that date plus i.
  return DAY_ORDER.map((d) => fmt.format(new Date(2026, 8, 6 + d)))
}

// The sleep keys and the countdown, for the room in view and every other
// room with a timer running.
function SleepBody({ zone, groupLabel = '', zones, compact = false }) {
  const { t } = useI18n()
  const { timers, set, cancel } = useSleepTimers()
  if (!zone) return <p className="hf-muted">{t('desk.browse.selectRoom')}</p>
  const mine = timers.find((row) => row.zone === zone.uuid)
  const others = timers.filter((row) => row.zone !== zone.uuid && zones?.[row.zone])
  return (
    <div className="hf-sleep">
      <Display className="hf-sleep-display">
        <span className="hf-vfd-caption">{t('hifi.ann.sleep')} · {groupLabel || zone.name}</span>
        <span className="hf-vfd-num hf-sleep-clock" aria-live="off">{mine ? clockText(mine.seconds) : '--:--'}</span>
        {!mine && <span className="hf-vfd-sub">{t('desk.sleep.none')}</span>}
      </Display>
      <div className="hf-sleep-keys" role="group" aria-label={t('desk.browse.sleepTimer')}>
        {SLEEP_CHOICES.map((m) => (
          <Key key={m} onClick={() => set(zone.uuid, m)} size="sm" shape="key">{sleepLabel(t, m)}</Key>
        ))}
        {/* Off is an action, not a setting, so it has no lamp; it can be
            pressed while a timer runs. */}
        <Key onClick={() => cancel(zone.uuid)} size="sm" disabled={!mine}>{t('desk.sleep.off')}</Key>
      </div>
      {others.length > 0 && (
        <div className="hf-sleep-others">
          {!compact && <p className="hf-legend hf-legend-left">{t('desk.sleep.elsewhere')}</p>}
          {others.map((row) => (
            <div className="hf-sleep-row" key={row.zone}>
              <Led on />
              <strong>{zones[row.zone].topology_label || zones[row.zone].name}</strong>
              <span className="hf-mono">{clockText(row.seconds)}</span>
              <Button small onClick={() => cancel(row.zone)}>{t('common.cancel')}</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function SleepPanel({ zone, groupLabel = '', onClose }) {
  const { t } = useI18n()
  const { zones } = useSystem()
  return (
    <Panel kind="center" title={t('desk.browse.sleepTimer')} onClose={onClose} className="hf-sleeppanel">
      <PanelHead title={t('desk.browse.sleepTimer')} sub={groupLabel || zone?.name || ''} onClose={onClose} />
      <div className="hf-panel-body"><SleepBody zone={zone} groupLabel={groupLabel} zones={zones} compact /></div>
      <footer className="hf-panel-foot"><Button primary onClick={onClose}>{t('common.done')}</Button></footer>
    </Panel>
  )
}

function TimeOfDay() {
  const now = useRackClock()
  const text = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(now)
  const date = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(now)
  return (
    <Display className="hf-clock">
      <span className="hf-vfd-num hf-clock-time">{text}</span>
      <span className="hf-vfd-sub">{date}</span>
    </Display>
  )
}

export default function TimerUnit({ households, zones, activeZone, activeGroup, systemFilter }) {
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
  const letters = dayLetters(t)
  const daysOf = (a) => {
    const key = recurrenceKey(a.Recurrence)
    const all = [0, 1, 2, 3, 4, 5, 6]
    if (key === 'DAILY') return new Set(all)
    if (key === 'WEEKDAYS') return new Set([1, 2, 3, 4, 5])
    if (key === 'WEEKENDS') return new Set([0, 6])
    if (key === 'ON') return new Set(recurrenceDays(a.Recurrence))
    return new Set()
  }
  const recurrence = (a) => {
    const key = recurrenceKey(a.Recurrence)
    return key === 'ON' ? '' : t(`desk.alarms.recurrence.${key}`)
  }
  const music = (a) => (a.ProgramURI === 'x-rincon-buzzer:0' ? t('win.alarm.chime') : (a.music || a.ProgramTitle || ''))
  return (
    <Unit className="hf-timer-unit" name={t('hifi.unit.timer')} model={t('desk.browse.alarms')}>
      <div className="hf-timer-body">
        <section className="hf-timer-sleep" aria-label={t('desk.browse.sleepTimer')}>
          <TimeOfDay />
          <h3 className="hf-section-plate"><G.Moon />{t('desk.browse.sleepTimer')}</h3>
          <SleepBody zone={activeZone} groupLabel={activeGroup ? groupTitle(activeGroup, zones, t) : ''} zones={zones} />
        </section>
        <section className="hf-timer-programs" aria-label={t('desk.browse.alarms')}>
          <div className="hf-unit-toolbar">
            <h3 className="hf-section-plate"><G.Bell />{t('desk.browse.alarms')}</h3>
            <span className="hf-grow" />
            {systemChoiceMatters(ordered) && (
              <KeyBank value={activeHh} onChange={setTab} label={t('desk.showSystem')}
                       options={ordered.map((h) => ({ id: h.id, label: h.generation }))} />
            )}
            <Key legend={t('hifi.newProgram')} label={t('win.alarm.addTitle')} icon={<G.Plus />} disabled={busy || !zoneUuid} onClick={() => setEditing('new')} size="sm" />
          </div>
          {alarms === null && !error && <Loading>{t('desk.browse.loading')}</Loading>}
          {error && <p className="hf-error">{error}</p>}
          {alarms && alarms.length === 0 && <Empty icon={<G.Bell />} title={t('desk.alarms.none')} />}
          {alarms && alarms.length > 0 && (
            <ol className="hf-programs">
              {alarms.map((a, i) => {
                const days = daysOf(a)
                const on = a.Enabled === '1'
                return (
                  <li key={a.ID} className="hf-program" data-on={on || undefined}>
                    <span className="hf-program-num">{t('hifi.program', { n: i + 1 })}</span>
                    <Display className="hf-program-display">
                      <span className="hf-vfd-num hf-program-time">{a.StartTime.replace(/:00$/, '')}</span>
                      <span className="hf-days" aria-label={recurrence(a) || [...days].map((d) => letters[DAY_ORDER.indexOf(d)]).join(' ')}>
                        {DAY_ORDER.map((d, k) => <span key={d} className="hf-day" data-on={days.has(d) || undefined}>{letters[k]}</span>)}
                      </span>
                      {recurrence(a) && <span className="hf-vfd-sub">{recurrence(a)}</span>}
                    </Display>
                    <span className="hf-program-text">
                      <span className="hf-program-room"><G.Speaker />{a.room || '—'}</span>
                      {music(a) && <span className="hf-program-music"><G.Note />{music(a)}</span>}
                    </span>
                    <Lever checked={on} disabled={busy} label={on ? t('win.alarm.on') : t('win.alarm.off')} onChange={(next) => toggle(a.ID, next)} />
                    <span className="hf-program-tools">
                      <IconKey label={t('win.alarms.edit')} disabled={busy} onClick={() => setEditing(a)}><G.Pencil /></IconKey>
                      <IconKey label={t('desk.alarms.delete')} disabled={busy} onClick={() => setConfirm(a)}><G.Trash /></IconKey>
                    </span>
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      </div>
      {editing && (
        <Panel kind="center" title={editing === 'new' ? t('win.alarm.addTitle') : t('win.alarm.editTitle')} onClose={() => setEditing(null)} className="hf-alarm-editor">
          <PanelHead title={editing === 'new' ? t('win.alarm.addTitle') : t('win.alarm.editTitle')} onClose={() => setEditing(null)} />
          <div className="hf-panel-body">
            <AlarmEditorPanel heading={false} alarm={editing === 'new' ? null : editing} rooms={rooms} households={households} busy={busy}
                              onCancel={() => setEditing(null)}
                              onSave={async (d) => { if (editing === 'new') await create(d); else await update(editing.ID, d); setEditing(null) }} />
          </div>
        </Panel>
      )}
      {confirm && (
        <Confirm title={t('desk.alarms.deleteTitle')} body={t('desk.alarms.deleteBody', { time: confirm.StartTime.replace(/:00$/, ''), room: confirm.room || '' })}
                 action={t('desk.alarms.delete')} danger disabled={busy}
                 onConfirm={() => { remove(confirm.ID); setConfirm(null) }} onClose={() => setConfirm(null)} />
      )}
    </Unit>
  )
}
