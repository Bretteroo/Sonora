import React, { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../frontend/src/lib/api.js'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { orderedHouseholds, systemChoiceMatters } from '../../frontend/src/lib/format.js'
import { chosenHousehold } from '../../frontend/src/lib/shellSelection.js'
import { zoneLabel } from '../../frontend/src/lib/timezones.js'
import RoomIcon from './RoomIcon.jsx'
import { Window } from './Dialogs.jsx'

// Pages and controls of the 2018 Windows app (9.1) that the later app dropped:
// the Basic tab of Room Settings, with the room's name and icon, and the Date
// and Time page. Their layout follows the 9.1 build's settings templates
// (settingswindowdictionary.xaml: a bold label column, a 215px control, an
// Apply and a Cancel mark after a field that is being edited) and the Date and
// Time page as the running 9.1 app draws it.

// The names the app offers for a room, each with the icon the household
// stores beside it (RoomIconConverter in 9.1 maps these same icon names).
export const ROOM_NAMES = [
  ['bathroom', 'w91.room.name.bathroom'], ['bedroom', 'w91.room.name.bedroom'], ['den', 'w91.room.name.den'],
  ['dining', 'w91.room.name.dining'], ['family', 'w91.room.name.family'], ['foyer', 'w91.room.name.foyer'],
  ['garage', 'w91.room.name.garage'], ['garden', 'w91.room.name.garden'], ['guestroom', 'w91.room.name.guestroom'],
  ['hallway', 'w91.room.name.hallway'], ['kitchen', 'w91.room.name.kitchen'], ['library', 'w91.room.name.library'],
  ['living', 'w91.room.name.living'], ['masterbedroom', 'w91.room.name.masterbedroom'], ['media', 'w91.room.name.media'],
  ['office', 'w91.room.name.office'], ['patio', 'w91.room.name.patio'], ['playroom', 'w91.room.name.playroom'],
  ['pool', 'w91.room.name.pool'], ['portable', 'w91.room.name.portable'], ['study', 'w91.room.name.study'],
  ['tvroom', 'w91.room.name.tvroom'],
]
const ICON_PREFIX = 'x-rincon-roomicon:'

// The app's image combo box: the chosen item's icon at the left of the field,
// a drop-down of items each with its own icon, and (when editable) a text
// field for a name of one's own. Choosing an item hands back its text and
// icon; typing hands back the text with the icon left as it was.
export function IconCombo({ items, text, icon, editable = false, onPick, onType, label, className = '' }) {
  const [open, setOpen] = useState(false)
  const [lit, setLit] = useState(-1)
  const root = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const away = (event) => { if (!root.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])
  const choose = (item) => { setOpen(false); onPick?.(item) }
  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) { setOpen(true); setLit(Math.max(0, items.findIndex((i) => i.text === text))); return }
      setLit((n) => Math.min(items.length - 1, Math.max(0, n + (event.key === 'ArrowDown' ? 1 : -1))))
    } else if (event.key === 'Enter' && open && items[lit]) {
      event.preventDefault(); choose(items[lit])
    } else if (event.key === 'Escape' && open) {
      event.preventDefault(); setOpen(false)
    }
  }
  return (
    <div className={`w91-combo ${className}`.trim()} ref={root} data-open={open || undefined}>
      <RoomIcon uri={icon} />
      {editable
        ? <input className="w91-combo-text" value={text} aria-label={label} onChange={(e) => onType?.(e.target.value)} onKeyDown={onKeyDown} />
        : (
          <button type="button" className="w91-combo-text" aria-label={label} aria-haspopup="listbox" aria-expanded={open}
                  onClick={() => setOpen((v) => !v)} onKeyDown={onKeyDown}>{text}</button>
        )}
      <button type="button" className="w91-combo-arrow" tabIndex={-1} aria-hidden="true" onClick={() => setOpen((v) => !v)} />
      {open && (
        <ul className="w91-combo-list" role="listbox">
          {items.map((item, n) => (
            <li key={item.key} role="option" aria-selected={item.text === text} data-lit={n === lit || undefined}
                onPointerEnter={() => setLit(n)} onPointerDown={(e) => { e.preventDefault(); choose(item) }}>
              <RoomIcon uri={item.icon} /><span>{item.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// A settings row (HeaderControl): the bold label, then the control.
export function Row({ label, children }) {
  return (
    <div className="w91-row">
      <span className="w91-label">{label}</span>
      <div className="w91-control">{children}</div>
    </div>
  )
}

// The field's Apply and Cancel marks (ApplyCancelValidationControl), shown
// while what is typed differs from what the room has.
function ApplyCancel({ dirty, onApply, onCancel }) {
  const { t } = useI18n()
  if (!dirty) return null
  return (
    <span className="w91-applycancel">
      <button type="button" className="w91-apply" title={t('common.apply')} aria-label={t('common.apply')} onClick={onApply} />
      <button type="button" className="w91-cancel" title={t('common.cancel')} aria-label={t('common.cancel')} onClick={onCancel} />
    </span>
  )
}

// Room Settings > Basic: the room's name and icon, then its status light,
// touch controls and Trueplay where the speaker has them.
export function RoomBasic({ zone, extras, busy, apply, stereo }) {
  const { t } = useI18n()
  const items = ROOM_NAMES.map(([key, label]) => ({ key, text: t(label), icon: ICON_PREFIX + key }))
  const [draft, setDraft] = useState({ text: zone.name, icon: zone.room_icon || '' })
  useEffect(() => { setDraft({ text: zone.name, icon: zone.room_icon || '' }) }, [zone.uuid, zone.name, zone.room_icon])
  const dirty = draft.text.trim() !== '' && (draft.text !== zone.name || draft.icon !== (zone.room_icon || ''))
  const save = () => {
    const name = draft.text.trim()
    apply({ name: name !== zone.name ? name : undefined, icon: draft.icon !== (zone.room_icon || '') ? draft.icon : undefined })
  }
  const check = (key, label, checked, onSet) => extras && key in extras && (
    <label className="w91-check">
      <input type="checkbox" checked={checked} disabled={busy} onChange={(e) => onSet(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
  return (
    <div className="w91-page-rows">
      <Row label={t('desk.prefs.roomName')}>
        <IconCombo items={items} text={draft.text} icon={draft.icon} editable label={t('desk.prefs.roomName')}
                   onPick={(item) => setDraft({ text: item.text, icon: item.icon })}
                   onType={(text) => setDraft((d) => ({ ...d, text }))} />
        <ApplyCancel dirty={dirty} onApply={save} onCancel={() => setDraft({ text: zone.name, icon: zone.room_icon || '' })} />
      </Row>
      {extras && 'status_light' in extras && (
        <Row label={t('desk.prefs.statusLight')}>
          {check('status_light', t('w91.room.statusLightOn'), Boolean(extras.status_light), (on) => apply({ status_light: on }))}
        </Row>
      )}
      {extras && 'button_lock' in extras && (
        <Row label={t('desk.room.touchControls')}>
          {check('button_lock', t('w91.room.touchOn'), !extras.button_lock, (on) => apply({ button_lock: !on }))}
        </Row>
      )}
      {extras && 'trueplay' in extras && (
        <Row label={t('desk.room.trueplay')}>
          {check('trueplay', t('w91.room.trueplayOn'), Boolean(extras.trueplay), (on) => apply({ trueplay: on }))}
        </Row>
      )}
      {/* Line-Out Level, on a player with a line out for another amplifier
          (a Connect, a Port): Variable follows Sonos volume, Fixed hands
          the full level on. */}
      {hasLineOut(zone) && (
        <Row label={t('w91.room.lineOut')}>
          <select value={zone.fixed_output ? 'fixed' : 'variable'} disabled={busy}
                  onChange={(e) => apply({ fixed_output: e.target.value === 'fixed' })}>
            <option value="variable">{t('w91.room.variable')}</option>
            <option value="fixed">{t('w91.room.fixed')}</option>
          </select>
        </Row>
      )}
      {stereo}
    </div>
  )
}

// The players whose line out a Line-Out Level setting governs.
function hasLineOut(zone) {
  return /^(Connect|Port)\b/.test(zone.model || '') && !/Amp/.test(zone.model || '')
}

// Date and Time, as the 9.1 app lays it out: the time zone across the panel,
// two checkboxes under it, then the date, the time and the two formats.
const DATE_FORMATS = [['MDY', 'w91.time.fmt.MDY'], ['DMY', 'w91.time.fmt.DMY'], ['YMD', 'w91.time.fmt.YMD']]
const TIME_FORMATS = [['12H', 'w91.time.fmt.12H'], ['24H', 'w91.time.fmt.24H']]
export function DateTime91({ households }) {
  const { t } = useI18n()
  const ordered = orderedHouseholds(households)
  const [tab, setTab] = useState(null)
  const activeTab = tab && ordered.some((h) => h.id === tab) ? tab : chosenHousehold(ordered)
  const zone = households.find((h) => h.id === activeTab)?.zone_uuids?.[0]
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [manual, setManual] = useState({ date: '', time: '' })
  const load = useCallback(() => {
    if (!zone) return
    api.timeSettings(zone).then((r) => { setData(r); setError('') }).catch((exc) => setError(exc.message))
  }, [zone])
  useEffect(() => { setData(null); load() }, [load])
  useEffect(() => { const id = setInterval(load, 30000); return () => clearInterval(id) }, [load])
  const apply = async (patch) => {
    setBusy(true); setError('')
    try { setData(await api.setTime({ zone, ...patch })) } catch (exc) { setError(exc.message) }
    setBusy(false)
  }
  const fixed = Boolean(data?.server_fixed)
  const internet = fixed || Boolean(data?.server)
  const zoneEntry = data?.zones.find((z) => z.index === data.index)
  const local = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/.exec(data?.local || '')
  const isoDate = local ? `${local[1]}-${local[2]}-${local[3]}` : ''
  const isoTime = local ? `${local[4]}:${local[5]}` : ''
  const setNow = (date, time) => {
    if (!date || !time) return
    apply({ desired_time: `${date} ${time}:00` })
  }
  return (
    <>
      <h3 className="w91-page-title">{t('w91.time.title')}</h3>
      {systemChoiceMatters(households) && (
        <div className="dk-tabs w91-system-tabs" role="tablist">
          {ordered.map((h) => (
            <button key={h.id} type="button" role="tab" aria-selected={activeTab === h.id} onClick={() => setTab(h.id)}>{h.generation}</button>
          ))}
        </div>
      )}
      <div className="w91-panel w91-time">
        {!data && !error && <p>{t('desk.time.loading')}</p>}
        {error && <p className="dk-add-error">{error}</p>}
        {data && (
          <fieldset disabled={busy}>
            <Row label={t('desk.time.timeZone')}>
              <select className="w91-wide" value={data.index} onChange={(e) => apply({ index: Number(e.target.value) })}>
                {data.zones.map((z) => <option key={z.index} value={z.index}>{zoneLabel(z)}</option>)}
              </select>
            </Row>
            <Row label="">
              <label className="w91-check" aria-disabled={!zoneEntry?.dst || undefined}>
                <input type="checkbox" checked={data.auto_dst} disabled={!zoneEntry?.dst} onChange={(e) => apply({ auto_dst: e.target.checked })} />
                <span>{t('w91.time.dst')}</span>
              </label>
            </Row>
            {!fixed && (
              <Row label="">
                <label className="w91-check">
                  <input type="checkbox" checked={internet} onChange={(e) => apply({ internet_time: e.target.checked })} />
                  <span>{t('w91.time.internet')}</span>
                </label>
              </Row>
            )}
            <Row label={t('desk.time.date')}>
              <input type="date" className="w91-date" disabled={internet} value={internet ? isoDate : (manual.date || isoDate)}
                     onChange={(e) => setManual({ ...manual, date: e.target.value })}
                     onBlur={() => !internet && setNow(manual.date || isoDate, manual.time || isoTime)} />
            </Row>
            <Row label={t('desk.time.time')}>
              <input type="time" className="w91-timefield" disabled={internet} value={internet ? isoTime : (manual.time || isoTime)}
                     onChange={(e) => setManual({ ...manual, time: e.target.value })}
                     onBlur={() => !internet && setNow(manual.date || isoDate, manual.time || isoTime)} />
            </Row>
            <Row label={t('desk.time.dateFormat')}>
              <select value={data.date_format} onChange={(e) => apply({ date_format: e.target.value })}>
                {!DATE_FORMATS.some(([v]) => v === data.date_format) && <option value={data.date_format}>{t('desk.time.notSet')}</option>}
                {DATE_FORMATS.map(([v, key]) => <option key={v} value={v}>{t(key)}</option>)}
              </select>
            </Row>
            <Row label={t('desk.time.timeFormat')}>
              <select value={data.time_format} onChange={(e) => apply({ time_format: e.target.value })}>
                {!TIME_FORMATS.some(([v]) => v === data.time_format) && <option value={data.time_format}>{t('desk.time.notSet')}</option>}
                {TIME_FORMATS.map(([v, key]) => <option key={v} value={v}>{t(key)}</option>)}
              </select>
            </Row>
          </fieldset>
        )}
      </div>
    </>
  )
}

// Manage > Change Language… in 9.1 opens the setup assistant's language page
// on its own: "Choose a language:" over a list of languages, each under its
// own name, and Back, Done and Cancel at the foot (Back has nowhere to go).
export function Language91({ onClose }) {
  const { t, language, languages, selectLanguage } = useI18n()
  const [choice, setChoice] = useState(language)
  return (
    <Window title={t('win.setup.title')} onClose={onClose} className="win-wizard w91-language">
      <div className="win-wizard-body">
        <h3 className="w91-wizard-heading">{t('w91.lang.choose')}</h3>
        <ul className="w91-language-list" role="listbox" aria-label={t('w91.lang.choose')}>
          {languages.map((l) => (
            <li key={l.code} role="option" aria-selected={choice === l.code} tabIndex={choice === l.code ? 0 : -1}
                lang={l.code} onClick={() => setChoice(l.code)} onDoubleClick={() => { selectLanguage(l.code); onClose() }}>
              {l.name}
            </li>
          ))}
        </ul>
      </div>
      <div className="win-dialog-foot win-wizard-foot">
        <button type="button" className="dk-win-btn" disabled>{t('common.back')}</button>
        <button type="button" className="dk-win-btn" data-default="true" onClick={() => { selectLanguage(choice); onClose() }}>{t('common.done')}</button>
        <button type="button" className="dk-win-btn" onClick={onClose}>{t('common.cancel')}</button>
      </div>
    </Window>
  )
}

// Advanced Settings (9.1): General, Music Sources and Usage, each a page of
// the household's own settings. The SonosNet channel is shown as the speakers
// report it; Sonora knows no way to move it. Usage is Sonos' data sharing,
// which Sonora takes no part in, so its box stays clear and inert.
const COMPRESSION = [['AUTO', 'w91.adv.compAuto'], ['UNCOMPRESSED', 'w91.adv.compOff'], ['COMPRESSED', 'w91.adv.compOn']]
export function Advanced91({ households }) {
  const { t } = useI18n()
  const ordered = orderedHouseholds(households).filter((h) => h.generation === 'S1')
  const [system, setSystem] = useState(null)
  const household = ordered.find((h) => h.id === system) || ordered[0]
  const [tab, setTab] = useState('general')
  const [data, setData] = useState(null)
  const [channel, setChannel] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!household) return undefined
    let canceled = false
    setData(null); setChannel(null)
    api.advancedSettings(household.id).then((r) => { if (!canceled) setData(r) }).catch((exc) => { if (!canceled) setError(exc.message) })
    api.diagnostics({ household: household.id, probe: false, samples: 3 }).then((r) => {
      if (canceled) return
      const rooms = (r.households?.[0]?.rooms || r.rooms || []).filter((room) => room.sonosnet && room.channel)
      const counts = {}
      for (const room of rooms) counts[room.channel] = (counts[room.channel] || 0) + 1
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
      setChannel(top ? top[0] : '')
    }).catch(() => { if (!canceled) setChannel('') })
    return () => { canceled = true }
  }, [household?.id])
  const write = async (key, value) => {
    setBusy(true); setError('')
    try { setData(await api.setAdvancedSetting(household.id, key, value)) } catch (exc) { setError(exc.message) }
    setBusy(false)
  }
  const flag = (key, label, on = '1', off = '0') => data && (
    <label className="w91-check">
      <input type="checkbox" checked={data[key] === on} disabled={busy} onChange={(e) => write(key, e.target.checked ? on : off)} />
      <span>{label}</span>
    </label>
  )
  return (
    <>
      <h3 className="w91-page-title">{t('w91.adv.title')}</h3>
      <div className="dk-tabs" role="tablist">
        {[['general', 'w91.adv.general'], ['sources', 'w91.adv.sources'], ['usage', 'w91.adv.usage']].map(([id, key]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{t(key)}</button>
        ))}
      </div>
      <div className="w91-panel w91-advanced">
        {!household && <p>{t('desk.prefs.noRooms')}</p>}
        {household && !data && !error && <p>{t('desk.time.loading')}</p>}
        {error && <p className="dk-add-error">{error}</p>}
        {data && tab === 'general' && (
          <>
            <Row label={t('w91.adv.channel')}>
              <select value={channel || ''} disabled>
                <option value={channel || ''}>{channel || '—'}</option>
              </select>
            </Row>
            <Row label={t('w91.adv.compression')}>
              <select value={data.audio_compression} disabled={busy} onChange={(e) => write('audio_compression', e.target.value)}>
                {!COMPRESSION.some(([v]) => v === data.audio_compression) && <option value={data.audio_compression}>{t('desk.time.notSet')}</option>}
                {COMPRESSION.map(([v, key]) => <option key={v} value={v}>{t(key)}</option>)}
              </select>
            </Row>
            <Row label={t('w91.adv.updates')}>{flag('auto_update', t('w91.adv.autoUpdate'), 'all', 'none')}</Row>
          </>
        )}
        {data && tab === 'sources' && (
          <>
            <Row label={t('w91.adv.mediaServers')}>{flag('show_media_servers', t('w91.adv.showMediaServers'))}</Row>
            <Row label={t('w91.adv.upnp')}>{flag('show_upnp', t('w91.adv.showUpnp'))}</Row>
          </>
        )}
        {/* 9.1 stacks this tab: the heading, the paragraph and its link,
            then the checkbox, all from the left edge. Sonora cannot read or
            set the choice, so the box stays off and disabled. */}
        {tab === 'usage' && (
          <div className="w91-usage">
            <h4 className="w91-section-head">{t('w91.adv.usageHead')}</h4>
            <p>{t('w91.adv.usageBody')}</p>
            <p className="w91-usage-link">
              <a href="https://www.sonos.com/legal/privacy" target="_blank" rel="noreferrer">{t('w91.adv.privacyLink')}</a>
            </p>
            <label className="w91-check">
              <input type="checkbox" checked={false} disabled readOnly />
              <span>{t('w91.adv.usageShare')}</span>
            </label>
          </div>
        )}
      </div>
    </>
  )
}
