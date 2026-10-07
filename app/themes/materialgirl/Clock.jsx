import React, { useMemo, useState } from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { orderedHouseholds } from '../../frontend/src/lib/format.js'
import { useAlarms, recurrenceKey, recurrenceDays } from '../../frontend/src/lib/useAlarms.js'
import { useSleepTimers, SLEEP_CHOICES, sleepLabel, clockText } from '../../frontend/src/lib/useSleepTimer.js'
import AlarmEditorPanel from '../../frontend/src/components/AlarmEditorPanel.jsx'
import * as I from './icons.jsx'
import { Sheet, SheetBar, Button, Switch, Confirm, Empty, Busy, Chip, IconButton, Menu, MenuItem, SystemPicker, Select, Skeleton } from './m3.jsx'
import { SHAPES } from './shapes.js'
import { groupTitle } from './data.js'

// Clock: the two things a room does on a clock. The sleep timer leads, as a
// tonal card whose countdown is set in display type; the alarms follow as
// cards, each with its time large, its days as a row of small discs, and a
// switch. A card opens the editor; its menu deletes it.

// The week's initials in the reader's own language, Sunday first as the
// speakers count.
function useWeekdays() {
  return useMemo(() => {
    const fmt = new Intl.DateTimeFormat(undefined, { weekday: 'narrow' })
    // 2023-01-01 was a Sunday.
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2023, 0, 1 + i)))
  }, [])
}

export default function ClockPage({ households, zones, activeZone, activeGroup, systemFilter }) {
  const { t } = useI18n()
  const { zoneList } = useSystem()
  const days = useWeekdays()
  const ordered = orderedHouseholds(households).filter((h) => !systemFilter || systemFilter === 'all' || h.id === systemFilter)
  const [tab, setTab] = useState(null)
  const activeHh = tab && ordered.some((h) => h.id === tab) ? tab
    : (activeZone && ordered.find((h) => h.zone_uuids.includes(activeZone.uuid))?.id) || ordered[0]?.id
  const zoneUuid = ordered.find((h) => h.id === activeHh)?.zone_uuids?.find((u) => zones[u]) || ''
  const { alarms, error, busy, toggle, remove, create, update } = useAlarms(zoneUuid)
  const rooms = zoneList.filter((z) => households.find((h) => h.id === activeHh)?.zone_uuids.includes(z.uuid)).sort((a, b) => a.name.localeCompare(b.name))
  const [editing, setEditing] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [menu, setMenu] = useState(null)
  const music = (a) => (a.ProgramURI === 'x-rincon-buzzer:0' ? t('win.alarm.chime') : (a.music || a.ProgramTitle || ''))
  return (
    <div className="mg-page mg-clock">
      <header className="mg-appbar mg-appbar-medium">
        <h1 className="mg-headline">{t('desk.browse.alarms')}</h1>
      </header>

      <SleepCard zone={activeZone} groupLabel={activeGroup ? groupTitle(activeGroup, zones, t) : ''} />

      <section className="mg-alarms" aria-label={t('desk.browse.alarms')}>
        <div className="mg-alarms-head">
          <h2 className="mg-title-l">{t('desk.browse.alarms')}</h2>
          <SystemPicker households={ordered} value={activeHh} onChange={setTab} all={false} />
          <span className="mg-grow" />
          <Button variant="filled" size="s" icon={<I.Plus />} disabled={busy || !zoneUuid} onClick={() => setEditing('new')}>{t('win.alarms.add')}</Button>
        </div>
        {alarms === null && !error && <Skeleton label={t('desk.browse.loading')} kind="cards" rows={4} />}
        {error && <p className="mg-error">{error}</p>}
        {alarms && alarms.length === 0 && <Empty icon={<I.Alarm />} title={t('desk.alarms.none')} />}
        <div className="mg-alarm-grid">
          {alarms && alarms.map((a) => {
            const on = a.Enabled === '1'
            const key = recurrenceKey(a.Recurrence)
            const set = new Set(recurrenceDays(a.Recurrence))
            return (
              <article key={a.ID} className="mg-card mg-alarm" data-on={on || undefined} role="button" tabIndex={0}
                       onClick={() => !busy && setEditing(a)} onKeyDown={(event) => { if (event.key === 'Enter' && !busy) setEditing(a) }}
                       onContextMenu={(event) => { event.preventDefault(); setMenu({ a, x: event.clientX, y: event.clientY }) }}>
                <span className="mg-state" aria-hidden="true" />
                <div className="mg-alarm-top">
                  <strong className="mg-alarm-time">{a.StartTime.replace(/:00$/, '')}</strong>
                  <span onClick={(event) => event.stopPropagation()}>
                    <Switch checked={on} disabled={busy} onChange={(v) => toggle(a.ID, v)}
                            ariaLabel={`${a.StartTime.replace(/:00$/, '')} ${t('desk.alarms.enabled')}`} />
                  </span>
                </div>
                <div className="mg-alarm-days" aria-label={key === 'ON' ? '' : t(`desk.alarms.recurrence.${key}`)}>
                  {key === 'ON'
                    ? days.map((d, i) => <span key={i} className="mg-day" data-on={set.has(i) || undefined}>{d}</span>)
                    : <span className="mg-alarm-rec">{t(`desk.alarms.recurrence.${key}`)}</span>}
                </div>
                <div className="mg-alarm-lines">
                  <span><I.Speaker />{a.room || '—'}</span>
                  {music(a) && <span><I.Note />{music(a)}</span>}
                </div>
                <IconButton size="xs" className="mg-alarm-more" label={t('desk.browse.actions')}
                            onClick={(event) => { event.stopPropagation(); setMenu({ a, anchor: event.currentTarget }) }}><I.More /></IconButton>
              </article>
            )
          })}
        </div>
      </section>
      {menu && (
        <Menu x={menu.x} y={menu.y} anchor={menu.anchor || null} align="right" onClose={() => setMenu(null)} title={menu.a.StartTime.replace(/:00$/, '')}>
          <MenuItem icon={<I.Edit />} disabled={busy} onSelect={() => { const a = menu.a; setMenu(null); setEditing(a) }}>{t('win.alarms.edit')}</MenuItem>
          <MenuItem icon={<I.Trash />} danger disabled={busy} onSelect={() => { const a = menu.a; setMenu(null); setConfirm(a) }}>{t('desk.alarms.delete')}</MenuItem>
        </Menu>
      )}
      {editing && (
        <Sheet kind="full" title={editing === 'new' ? t('win.alarm.addTitle') : t('win.alarm.editTitle')} onClose={() => setEditing(null)} className="mg-alarm-editor">
          {/* A full-screen dialog: close at the leading end, the confirming action at the trailing end
              of the top bar (Material's full-screen dialog). */}
          <SheetBar title={editing === 'new' ? t('win.alarm.addTitle') : t('win.alarm.editTitle')} onClose={() => setEditing(null)}>
            <Button variant="text" size="s" type="submit" form="mg-alarm-form" disabled={busy}>{t('common.save')}</Button>
          </SheetBar>
          <div className="mg-sheet-body">
            <AlarmEditorPanel heading={false} formId="mg-alarm-form" Select={Select} alarm={editing === 'new' ? null : editing} rooms={rooms} households={households} busy={busy}
                              onCancel={() => setEditing(null)}
                              onSave={async (d) => { if (editing === 'new') await create(d); else await update(editing.ID, d); setEditing(null) }} />
          </div>
        </Sheet>
      )}
      {confirm && (
        <Confirm title={t('desk.alarms.deleteTitle')} body={t('desk.alarms.deleteBody', { time: confirm.StartTime.replace(/:00$/, ''), room: confirm.room || '' })}
                 action={t('desk.alarms.delete')} danger disabled={busy} icon={<I.Alarm />}
                 onConfirm={() => { remove(confirm.ID); setConfirm(null) }} onClose={() => setConfirm(null)} />
      )}
    </div>
  )
}

// The sleep timer. With none on the room in view, the durations are offered
// as chips; with one, its countdown in display type and a Cancel. Every
// other room with a timer running follows with its own clock.
function SleepBody({ zone, groupLabel = '', zones }) {
  const { t } = useI18n()
  const { timers, set, cancel } = useSleepTimers()
  if (!zone) return null
  const mine = timers.find((row) => row.zone === zone.uuid)
  const others = timers.filter((row) => row.zone !== zone.uuid && zones?.[row.zone])
  return (
    <>
      <div className="mg-sleep-main" data-active={mine ? '' : undefined}>
        <span className="mg-sleep-badge" style={{ clipPath: SHAPES.sunny }} aria-hidden="true"><I.Moon /></span>
        <div className="mg-sleep-text">
          <span className="mg-overline">{groupLabel || zone.name}</span>
          {mine ? <strong className="mg-sleep-clock" aria-live="off">{clockText(mine.seconds)}</strong>
                : <span className="mg-title-m">{t('desk.sleep.none')}</span>}
        </div>
        {mine && <Button variant="tonal" size="s" onClick={() => cancel(zone.uuid)}>{t('common.cancel')}</Button>}
      </div>
      {!mine && (
        <div className="mg-chips">
          {SLEEP_CHOICES.map((m) => <Chip key={m} kind="suggestion" icon={<I.Timer />} onClick={() => set(zone.uuid, m)}>{sleepLabel(t, m)}</Chip>)}
        </div>
      )}
      {others.length > 0 && (
        <div className="mg-list mg-sleep-others">
          <p className="mg-overline">{t('desk.sleep.elsewhere')}</p>
          {others.map((row) => (
            <div className="mg-li" key={row.zone}>
              <span className="mg-li-text">
                <span className="mg-li-head">{zones[row.zone].topology_label || zones[row.zone].name}</span>
                <span className="mg-li-sup mg-mono">{clockText(row.seconds)}</span>
              </span>
              <span className="mg-li-trail"><Button variant="text" size="xs" onClick={() => cancel(row.zone)}>{t('common.cancel')}</Button></span>
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
    <section className="mg-card mg-card-tonal mg-sleep" aria-label={t('desk.browse.sleepTimer')}>
      <h2 className="mg-title-l">{t('desk.browse.sleepTimer')}</h2>
      <SleepBody zone={zone} groupLabel={groupLabel} zones={zones} />
    </section>
  )
}

export function SleepSheet({ zone, groupLabel = '', onClose }) {
  const { t } = useI18n()
  const { zones } = useSystem()
  return (
    <Sheet kind="bottom" title={t('desk.browse.sleepTimer')} onClose={onClose} className="mg-sleepsheet">
      <SheetBar title={t('desk.browse.sleepTimer')} sub={groupLabel || zone?.name || ''} onClose={onClose} />
      <div className="mg-sheet-body mg-stack">
        <SleepBody zone={zone} groupLabel={groupLabel} zones={zones} />
      </div>
      <footer className="mg-dialog-actions"><Button variant="filled" onClick={onClose}>{t('common.done')}</Button></footer>
    </Sheet>
  )
}
