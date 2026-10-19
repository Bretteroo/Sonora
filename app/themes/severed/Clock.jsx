import React, { useMemo, useState } from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { orderedHouseholds } from '../../frontend/src/lib/format.js'
import { useAlarms, recurrenceKey, recurrenceDays } from '../../frontend/src/lib/useAlarms.js'
import { useSleepTimers, SLEEP_CHOICES, sleepLabel, clockText } from '../../frontend/src/lib/useSleepTimer.js'
import AlarmEditorPanel from '../../frontend/src/components/AlarmEditorPanel.jsx'
import * as G from './glyphs.jsx'
import { Window, WindowBar, Btn, IconBtn, Toggle, Confirm, Empty, Busy, Menu, MenuItem, SystemPicker, Select } from './kit.jsx'
import { groupTitle } from './house.js'
import { pt } from './layout.js'

// The Clock program: the two things a room does on a clock. The sleep timer
// leads, its countdown in the screen's biggest figures; the alarms follow as
// a table, one line each: the time, the week as seven letters lit or dark,
// the room, the music, and a switch. A line opens the editor; its menu
// deletes it.

// The week's initials in the reader's own language, Sunday first as the speakers count.
function useWeekdays() {
  return useMemo(() => {
    const fmt = new Intl.DateTimeFormat(undefined, { weekday: 'narrow' })
    // 2023-01-01 was a Sunday.
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2023, 0, 1 + i)))
  }, [])
}

export default function ClockProgram({ households, zones, activeZone, activeGroup, systemFilter }) {
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
    <div className="sv-clock">
      <SleepBox zone={activeZone} groupLabel={activeGroup ? groupTitle(activeGroup, zones, t) : ''} />

      <section className="sv-alarms" aria-label={t('desk.browse.alarms')}>
        <header className="sv-programhead">
          <h1 className="sv-title">{t('desk.browse.alarms')}</h1>
          <div className="sv-programhead-tools">
            <SystemPicker households={ordered} value={activeHh} onChange={setTab} all={false} />
            <Btn variant="solid" size="s" icon={<G.Plus size={12} />} disabled={busy || !zoneUuid} onClick={() => setEditing('new')}>{t('win.alarms.add')}</Btn>
          </div>
        </header>
        {alarms === null && !error && <Busy label={t('desk.browse.loading')} />}
        {error && <p className="sv-error">{error}</p>}
        {alarms && alarms.length === 0 && <Empty icon={<G.Alarm size={48} />} title={t('desk.alarms.none')} />}
        {alarms && alarms.length > 0 && (
          <div className="sv-alarm-table" role="table" aria-label={t('desk.browse.alarms')}>
            {alarms.map((a) => {
              const on = a.Enabled === '1'
              const key = recurrenceKey(a.Recurrence)
              const set = new Set(recurrenceDays(a.Recurrence))
              const time = a.StartTime.replace(/:00$/, '')
              return (
                <div key={a.ID} className="sv-alarm" data-on={on || undefined} role="row" tabIndex={0}
                     onClick={() => !busy && setEditing(a)} onKeyDown={(event) => { if (event.key === 'Enter' && !busy) setEditing(a) }}
                     onContextMenu={(event) => { event.preventDefault(); setMenu({ a, x: pt(event.clientX), y: pt(event.clientY) }) }}>
                  <strong className="sv-alarm-time" role="cell">{time}</strong>
                  <span className="sv-alarm-days" role="cell" aria-label={key === 'ON' ? '' : t(`desk.alarms.recurrence.${key}`)}>
                    {key === 'ON'
                      ? days.map((d, i) => <span key={i} className="sv-day" data-on={set.has(i) || undefined}>{d}</span>)
                      : <span className="sv-alarm-rec">{t(`desk.alarms.recurrence.${key}`)}</span>}
                  </span>
                  <span className="sv-alarm-room" role="cell">{a.room || '-'}</span>
                  <span className="sv-alarm-music" role="cell">{music(a)}</span>
                  <span className="sv-alarm-tools" role="cell" onClick={(event) => event.stopPropagation()}>
                    <Toggle checked={on} disabled={busy} onChange={(v) => toggle(a.ID, v)} ariaLabel={`${time} ${t('desk.alarms.enabled')}`} />
                    <IconBtn size="s" label={t('desk.browse.actions')} onClick={(event) => setMenu({ a, anchor: event.currentTarget })}><G.More size={24} /></IconBtn>
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </section>
      {menu && (
        <Menu x={menu.x} y={menu.y} anchor={menu.anchor || null} align="right" onClose={() => setMenu(null)} title={menu.a.StartTime.replace(/:00$/, '')}>
          <MenuItem icon={<G.Edit size={12} />} disabled={busy} onSelect={() => { const a = menu.a; setMenu(null); setEditing(a) }}>{t('win.alarms.edit')}</MenuItem>
          <MenuItem icon={<G.Trash size={12} />} danger disabled={busy} onSelect={() => { const a = menu.a; setMenu(null); setConfirm(a) }}>{t('desk.alarms.delete')}</MenuItem>
        </Menu>
      )}
      {editing && (
        <Window kind="full" title={editing === 'new' ? t('win.alarm.addTitle') : t('win.alarm.editTitle')} onClose={() => setEditing(null)} className="sv-alarm-editor">
          <WindowBar title={editing === 'new' ? t('win.alarm.addTitle') : t('win.alarm.editTitle')} onClose={() => setEditing(null)}>
            <Btn variant="solid" size="s" type="submit" form="sv-alarm-form" disabled={busy}>{t('common.save')}</Btn>
          </WindowBar>
          <div className="sv-window-body">
            <AlarmEditorPanel heading={false} formId="sv-alarm-form" Select={Select} alarm={editing === 'new' ? null : editing} rooms={rooms} households={households} busy={busy}
                              onCancel={() => setEditing(null)}
                              onSave={async (d) => { if (editing === 'new') await create(d); else await update(editing.ID, d); setEditing(null) }} />
          </div>
        </Window>
      )}
      {confirm && (
        <Confirm title={t('desk.alarms.deleteTitle')} body={t('desk.alarms.deleteBody', { time: confirm.StartTime.replace(/:00$/, ''), room: confirm.room || '' })}
                 action={t('desk.alarms.delete')} danger disabled={busy} icon={<G.Alarm size={48} />}
                 onConfirm={() => { remove(confirm.ID); setConfirm(null) }} onClose={() => setConfirm(null)} />
      )}
    </div>
  )
}

// The sleep timer. With none on the room in view, the durations are offered as buttons; with
// one, its countdown in the big figures and a Cancel. Every other room with a timer running
// follows with its own clock.
function SleepBody({ zone, groupLabel = '', zones }) {
  const { t } = useI18n()
  const { timers, set, cancel } = useSleepTimers()
  if (!zone) return null
  const mine = timers.find((row) => row.zone === zone.uuid)
  const others = timers.filter((row) => row.zone !== zone.uuid && zones?.[row.zone])
  return (
    <>
      <div className="sv-sleep-main" data-active={mine ? '' : undefined}>
        <span className="sv-over">{groupLabel || zone.name}</span>
        <strong className="sv-sleep-clock" aria-live="off">{mine ? clockText(mine.seconds) : '0:00'}</strong>
        {mine ? <Btn size="s" onClick={() => cancel(zone.uuid)}>{t('common.cancel')}</Btn> : <span className="sv-dim">{t('desk.sleep.none')}</span>}
      </div>
      {!mine && (
        <div className="sv-btnrow sv-btnrow-wrap" role="group" aria-label={t('desk.browse.sleepTimer')}>
          {SLEEP_CHOICES.map((m) => <Btn key={m} size="s" icon={<G.Timer size={12} />} onClick={() => set(zone.uuid, m)}>{sleepLabel(t, m)}</Btn>)}
        </div>
      )}
      {others.length > 0 && (
        <div className="sv-sleep-others">
          <p className="sv-over">{t('desk.sleep.elsewhere')}</p>
          {others.map((row) => (
            <div className="sv-li" key={row.zone}>
              <span className="sv-li-text">
                <span className="sv-li-title">{zones[row.zone].topology_label || zones[row.zone].name}</span>
                <span className="sv-li-sub">{clockText(row.seconds)}</span>
              </span>
              <span className="sv-li-trail"><Btn variant="text" size="s" onClick={() => cancel(row.zone)}>{t('common.cancel')}</Btn></span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

export function SleepBox({ zone, groupLabel = '' }) {
  const { t } = useI18n()
  const { zones } = useSystem()
  if (!zone) return null
  return (
    <section className="sv-sleep" aria-label={t('desk.browse.sleepTimer')}>
      <h2 className="sv-rule-head">{t('desk.browse.sleepTimer')}</h2>
      <SleepBody zone={zone} groupLabel={groupLabel} zones={zones} />
    </section>
  )
}

export function SleepWindow({ zone, groupLabel = '', onClose }) {
  const { t } = useI18n()
  const { zones } = useSystem()
  return (
    <Window kind="dialog" title={t('desk.browse.sleepTimer')} onClose={onClose} className="sv-sleepwindow">
      <WindowBar title={t('desk.browse.sleepTimer')} sub={groupLabel || zone?.name || ''} onClose={onClose} />
      <div className="sv-window-body sv-stack">
        <SleepBody zone={zone} groupLabel={groupLabel} zones={zones} />
      </div>
      <footer className="sv-window-actions"><Btn variant="solid" onClick={onClose}>{t('common.done')}</Btn></footer>
    </Window>
  )
}
