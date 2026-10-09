import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useHeld } from '../../frontend/src/lib/useHeld.js'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { api } from '../../frontend/src/lib/api.js'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { orderedHouseholds } from '../../frontend/src/lib/format.js'
import { Window, BasicPage } from './Dialogs.jsx'
import WinLibrary from './Library.jsx'
import WinServices from './Services.jsx'
import WinParental from './Parental.jsx'
import Busy from '../../frontend/src/components/Busy.jsx'
import { withoutBrowserRoom } from '../../frontend/src/lib/browserRoom.js'

// The Windows app's Settings window (settingsmenu/settingswindow.xaml, checked
// against a capture of the real one on 2026-09-05): a plain list of pages on
// the left with no headings, EQ chosen per room from a dropdown rather than a
// page per room, and a note at the foot of the list pointing at the mobile
// app. Its four pages come first in its order; Sonora's own settings page
// follows. 57.23's SettingsWindow.xaml holds only those four tabs -- the view
// models for Parental Controls and Date and Time exist in the shared core but
// are never shown -- so this window had neither. Parental Controls is back
// at the user's request, rebuilt from the tab 9.1 did ship; Date and Time is
// not, and is still on the Mac window.
export default function Settings({ initial, activeRoom = '', onClose, onAddService, onServicesChanged }) {
  const [libraryBusy, setLibraryBusy] = useState(false)
  const { zoneList, households } = useSystem()
  const { t } = useI18n()
  // Room settings are a speaker's, so the browser room is not one of these.
  const rooms = useMemo(() => withoutBrowserRoom(zoneList).sort((a, b) => a.name.localeCompare(b.name)), [zoneList])
  const systems = orderedHouseholds(households)
  // A room id from the caller means the EQ page for that room.
  const initialRoom = rooms.some((z) => z.uuid === initial) ? initial : null
  const [page, setPage] = useState(initialRoom ? 'eq' : (initial || 'eq'))
  // The app opens the EQ page on the room in view, not on the first room of
  // the list (seen 2026-09-06: the room selected was the room offered).
  const [room, setRoom] = useState(initialRoom || activeRoom || rooms[0]?.uuid || '')
  const zone = rooms.find((z) => z.uuid === room) || rooms[0]

  const pages = [
    ['eq', t('win.settings.eq')],
    ['library', t('win.settings.library')],
    ['services', t('win.settings.services')],
    // The app's list ends here. Parental Controls is 9.1's own tab, rebuilt
    // from its XAML and put back at the user's request; Sonora's
    // own page follows it, as it always has.
    ['parental', t('win.parental.title')],
    ['basic', t('win.settings.sonora')],
  ]
  const tocRef = useRef(null)
  const onTocKey = (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const ids = pages.map(([id]) => id)
    const at = ids.indexOf(page)
    const next = ids[Math.min(ids.length - 1, Math.max(0, at + (event.key === 'ArrowDown' ? 1 : -1)))]
    if (!next || next === page) return
    setPage(next)
    tocRef.current?.querySelector(`[data-page="${next}"]`)?.focus()
  }

  return (
    <Window title={t('win.settings.title')} onClose={onClose} className="dk-prefs win-settings">
      {libraryBusy && <Busy text={t('desk.library.working')} />}
      <nav className="dk-prefs-toc" aria-label={t('win.settings.title')} ref={tocRef} onKeyDown={onTocKey}>
        {/* Below the width where a column of pages fits, the shared
            responsive sheet hides the list and shows this instead. A
            dropdown, rather than a strip of tabs that has to be scrolled
            sideways to be read (the user's call). */}
        <label className="dk-prefs-jump">
          <span className="dk-sr-only">{t('win.settings.title')}</span>
          <select value={page} onChange={(event) => setPage(event.target.value)}>
            {pages.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <div className="win-settings-list">
          {pages.map(([id, label]) => (
            <button key={id} type="button" data-page={id} aria-selected={page === id} onClick={() => setPage(id)}>{label}</button>
          ))}
        </div>
        <div className="win-settings-foot">
          <p>{t('win.settings.mobileNote')}</p>
          <button type="button" className="dk-win-btn"
                  onClick={() => window.open('https://www.sonos.com/controller-app', '_blank', 'noopener')}>
            {t('win.settings.getApp')}
          </button>
        </div>
      </nav>
      <div className="dk-prefs-page">
        {page === 'eq' && (
          <>
            <h3 className="win-settings-for">
              <span>{t('win.settings.eqFor')}</span>
              <select value={zone?.uuid || ''} onChange={(e) => setRoom(e.target.value)} disabled={!rooms.length}>
                {systems.map((h) => {
                  const hrooms = rooms.filter((z) => h.zone_uuids.includes(z.uuid))
                  if (!hrooms.length) return null
                  const options = hrooms.map((z) => <option key={z.uuid} value={z.uuid}>{z.name}</option>)
                  return systems.length > 1
                    ? <optgroup key={h.id} label={h.generation}>{options}</optgroup>
                    : options
                })}
              </select>
            </h3>
            {zone ? <WinEq zone={zone} /> : <p>{t('desk.browse.selectRoom')}</p>}
          </>
        )}
        {page === 'library' && <WinLibrary households={households} onBusy={setLibraryBusy} />}
        {page === 'services' && <WinServices households={households} onAdd={onAddService} onChanged={onServicesChanged} />}
        {page === 'parental' && <WinParental households={households} />}
        {page === 'basic' && <BasicPage title={t('win.settings.sonora')} />}
      </div>
    </Window>
  )
}

// The app's EQ tab (observed 2026-09-05): "Adjust treble and bass to your
// taste.", Bass and Treble sliders with - and + above their ends, Balance
// with L and R for a stereo pair only, a Loudness checkbox, Reset at the
// right. A fixed-output device shows the app's note instead.
//
// The app adds a Sub, a Surrounds and a TV tab beside EQ when a soundbar has
// those (SubEQTabViewModel, SurroundEQTabViewModel, TVDialogTabViewModel),
// built from the speaker's own settings; they are here on the same terms.
// Beyond the app: Height on the EQ tab for a speaker that tunes it, Night
// Sound and Speech Enhancement on the TV tab (the app puts them in Now
// Playing while TV plays), and a Line-in tab for a speaker with a socket.
// The app's Sub tab also holds the sub's phase. It keeps the IR light, IR
// repeater and TV autoplay with a room's TV settings instead, which these
// themes have no page for, so they join the TV tab here; the surrounds'
// distances, Speech Enhancement's level, Trueplay and Touch Controls are
// beyond the app.
const EQ_RANGES = { SubGain: [-15, 15], SurroundLevel: [-15, 15], MusicSurroundLevel: [-15, 15], AudioDelay: [0, 5], HeightChannelLevel: [-10, 10] }
// The speaker counts a surround's distance from 0, the farthest.
const DISTANCE_CHOICES = [[0, 'desk.room.distanceFar'], [1, 'desk.room.distanceMid'], [2, 'desk.room.distanceNear']]
const SPEECH_LEVELS = [[1, 'desk.room.levelLow'], [2, 'desk.room.levelMedium'], [3, 'desk.room.levelHigh'], [4, 'desk.room.levelMax']]
function WinEq({ zone }) {
  const { t } = useI18n()
  const { actions, zoneList } = useSystem()
  // Balance where the apps offer it: a pair, or a speaker with two channels.
  const paired = Boolean(zone.has_balance ?? zone.paired)
  const [tab, setTab] = useState('eq')
  const [extras, setExtras] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let canceled = false
    setExtras(null); setTab('eq')
    api.roomSettings(zone.uuid).then((r) => { if (!canceled) setExtras(r) }).catch(() => { if (!canceled) setExtras({ eq: {} }) })
    return () => { canceled = true }
  }, [zone.uuid])
  const apply = async (patch) => {
    setBusy(true)
    try { setExtras(await api.setRoomSettings(zone.uuid, patch)) } catch { /* the notice carries it */ }
    setBusy(false)
  }
  const eq = extras?.eq || {}
  const has = (...keys) => keys.some((k) => k in eq)
  const tabs = [
    ['eq', t('win.eq.tab')],
    ...(has('SubEnable', 'SubGain', 'SubPolarity') ? [['sub', t('desk.room.sub')]] : []),
    ...(has('SurroundEnable', 'SurroundLevel', 'MusicSurroundLevel', 'AudioDelayLeftRear', 'AudioDelayRightRear') ? [['surround', t('desk.room.surround')]] : []),
    ...(has('AudioDelay', 'NightMode', 'DialogLevel') || (extras && ['ir_light', 'ir_repeater', 'tv_autoplay'].some((k) => k in extras))
      ? [['tv', t('source.tv')]] : []),
    ...(extras && ('line_in_level' in extras || 'autoplay_room' in extras) ? [['linein', t('source.line_in')]] : []),
  ]
  const shown = tabs.some(([id]) => id === tab) ? tab : 'eq'
  const level = (k, label) => k in eq && (
    <WinEqRow key={k} label={label} value={eq[k]} min={EQ_RANGES[k][0]} max={EQ_RANGES[k][1]} low="-" high="+"
              onChange={(v) => apply({ eq: { [k]: v } })} />
  )
  const flag = (k, label) => k in eq && (
    <label key={k} className="win-eq-loudness">
      <input type="checkbox" checked={eq[k] === 1} disabled={busy} onChange={(e) => apply({ eq: { [k]: e.target.checked ? 1 : 0 } })} />
      <span>{label}</span>
    </label>
  )
  // A switch the room's settings carry beside its EQ, shown only where the speaker reports it.
  const toggle = (k, label, checked, onSet, off = false) => extras && k in extras && (
    <label key={k} className="win-eq-loudness">
      <input type="checkbox" checked={checked} disabled={busy || off} onChange={(e) => onSet(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
  // A choice of a few, on the Line-in tab's label and combo box row.
  const choice = (k, label, value, options, onPick) => (
    <fieldset key={k} className="win-eq-linein" disabled={busy}>
      <div className="win-eq-field">
        <span className="win-eq-label">{label}</span>
        <select value={value} onChange={(e) => onPick(Number(e.target.value))}>
          {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
        </select>
      </div>
    </fieldset>
  )
  return (
    <>
      <div className="dk-tabs" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={shown === id} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      <div className="win-settings-panel win-eq-panel" data-tab={shown}>
        {shown === 'eq' && (zone.fixed_output ? <p>{t('desk.prefs.eqFixed')}</p> : (
          <>
            <p className="win-eq-intro">{t('win.eq.intro')}</p>
            <WinEqRow label={t('desk.prefs.bass')} value={zone.bass} min={-10} max={10} low="-" high="+"
                      onChange={(v) => actions.setTone(zone.uuid, { bass: v })} />
            <WinEqRow label={t('desk.prefs.treble')} value={zone.treble} min={-10} max={10} low="-" high="+"
                      onChange={(v) => actions.setTone(zone.uuid, { treble: v })} />
            {paired && (
              <WinEqRow label={t('desk.prefs.balance')} value={zone.balance ?? 0} min={-100} max={100}
                        low={t('desk.prefs.left').slice(0, 1)} high={t('desk.prefs.right').slice(0, 1)}
                        onChange={(v) => actions.setTone(zone.uuid, { balance: v })} />
            )}
            {level('HeightChannelLevel', t('desk.room.heightLevel'))}
            <label className="win-eq-loudness">
              <input type="checkbox" checked={Boolean(zone.loudness)}
                     onChange={(e) => actions.setTone(zone.uuid, { loudness: e.target.checked })} />
              <span>{t('desk.prefs.loudness')}</span>
            </label>
            {toggle('trueplay', t('desk.room.trueplay'), Boolean(extras?.trueplay), (on) => apply({ trueplay: on }))}
            {/* Touch Controls is on while the buttons are not locked. The app has no
                place for it; any speaker may have it, and EQ is the one tab every room has. */}
            {toggle('button_lock', t('desk.room.touchControls'), !extras?.button_lock, (on) => apply({ button_lock: !on }))}
            <div className="win-eq-reset">
              <button type="button" className="dk-win-btn"
                      onClick={() => actions.setTone(zone.uuid, { bass: 0, treble: 0, balance: 0, loudness: true })}>
                {t('desk.prefs.reset')}
              </button>
            </div>
          </>
        ))}
        {shown === 'sub' && (
          <>
            {flag('SubEnable', t('desk.room.sub'))}
            {level('SubGain', t('desk.room.subLevel'))}
            {'SubPolarity' in eq && choice('SubPolarity', t('desk.room.subPhase'), eq.SubPolarity, [[0, '0°'], [1, '180°']],
              (v) => apply({ eq: { SubPolarity: v } }))}
          </>
        )}
        {shown === 'surround' && (
          <>
            {flag('SurroundEnable', t('desk.room.surround'))}
            {level('SurroundLevel', t('desk.room.surroundLevel'))}
            {level('MusicSurroundLevel', t('desk.room.musicSurroundLevel'))}
            {[['AudioDelayLeftRear', 'desk.room.surroundDistanceLeft'], ['AudioDelayRightRear', 'desk.room.surroundDistanceRight']]
              .filter(([k]) => k in eq).map(([k, label]) => choice(k, t(label), eq[k],
                DISTANCE_CHOICES.map(([v, key]) => [v, t(key)]), (v) => apply({ eq: { [k]: v } })))}
          </>
        )}
        {shown === 'tv' && (
          <>
            {level('AudioDelay', t('desk.room.audioDelay'))}
            {flag('NightMode', t('desk.room.nightSound'))}
            {flag('DialogLevel', t('desk.room.speech'))}
            {/* The level only means something while Speech Enhancement is on. */}
            {extras && 'speech_level' in extras && eq.DialogLevel === 1 && choice('speech_level', t('desk.room.speechLevel'), extras.speech_level ?? 1,
              SPEECH_LEVELS.filter(([v]) => v < 4 || extras.speech_max).map(([v, key]) => [v, t(key)]), (v) => apply({ speech_level: v }))}
            {toggle('ir_light', t('desk.room.irLight'), Boolean(extras?.ir_light), (on) => apply({ ir_light: on }))}
            {toggle('ir_repeater', t('desk.room.irRepeater'), Boolean(extras?.ir_repeater), (on) => apply({ ir_repeater: on }))}
            {toggle('tv_autoplay', t('desk.room.tvAutoplay'), Boolean(extras?.tv_autoplay), (on) => apply({ tv_autoplay: on }))}
            {toggle('tv_autoplay_ungroup', t('desk.room.tvUngroup'), Boolean(extras?.tv_autoplay_ungroup),
              (on) => apply({ tv_autoplay_ungroup: on }), !extras?.tv_autoplay)}
          </>
        )}
        {shown === 'linein' && extras && (
          <fieldset className="win-eq-linein" disabled={busy}>
            {'line_in_level' in extras && (
              <>
                <div className="win-eq-field">
                  <span className="win-eq-label">{t('desk.room.lineInName')}</span>
                  <input className="dk-win-input" key={extras.line_in_name} defaultValue={extras.line_in_name}
                         onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== extras.line_in_name) apply({ line_in_name: v }) }} />
                </div>
                <WinEqRow label={t('desk.room.lineInLevel')} value={extras.line_in_level} min={1} max={10} low="1" high="10"
                          onChange={(v) => apply({ line_in_level: v })} />
              </>
            )}
            {'autoplay_room' in extras && (
              <>
                <div className="win-eq-field">
                  <span className="win-eq-label">{t('desk.room.autoplayRoom')}</span>
                  <select value={extras.autoplay_room || ''} onChange={(e) => apply({ autoplay_room: e.target.value })}>
                    <option value="">{t('desk.room.autoplayOff')}</option>
                    {/* Autoplay hands a line-in feed to a speaker. */}
                    {withoutBrowserRoom(zoneList).map((z) => <option key={z.uuid} value={z.uuid}>{z.name}</option>)}
                  </select>
                </div>
                {extras.autoplay_room && (
                  <>
                    <label className="win-eq-loudness"><input type="checkbox" checked={Boolean(extras.autoplay_linked)} onChange={(e) => apply({ autoplay_linked: e.target.checked })} /><span>{t('desk.room.autoplayLinked')}</span></label>
                    <label className="win-eq-loudness"><input type="checkbox" checked={Boolean(extras.autoplay_use_volume)} onChange={(e) => apply({ autoplay_use_volume: e.target.checked })} /><span>{t('desk.room.autoplayUseVolume')}</span></label>
                    {extras.autoplay_use_volume && (
                      <WinEqRow label={t('desk.room.autoplayVolume')} value={extras.autoplay_volume} min={0} max={100} low="0" high="100"
                                onChange={(v) => apply({ autoplay_volume: v })} />
                    )}
                  </>
                )}
              </>
            )}
          </fieldset>
        )}
      </div>
    </>
  )
}

// A drag that comes within a step of the middle settles on it (a user
// request; the app's sliders have the pips but no pull): the range moves
// in twentieths so the thumb follows the pointer, and lands on whole steps
// everywhere else. The keys still move one whole step.
// The pull reaches one bass or treble step (a twentieth of their range) and
// five of Balance's two hundred, so the middle is as easy to find on both.
const detentOf = (min, max) => Math.max(1, (max - min) / 40)
const settle = (raw, mid, detent) => (Math.abs(raw - mid) < detent ? mid : Math.round(raw))

function WinEqRow({ label, value, min, max, low, high, onChange }) {
  const [local, setLocal] = useState(value)
  // What was let go of stays until the room reports it, past any value between (useHeld).
  const [held, setHeld] = useHeld(value)
  useEffect(() => { if (held === null) setLocal(value) }, [value, held])
  const mid = (min + max) / 2
  // Only a slider centered on zero has a middle to settle on (Bass, Balance...); Audio Delay
  // runs 0-5 and line-in level 1-10, where the middle is no value the speaker takes.
  const centered = min + max === 0
  const keyStep = (e) => {
    const by = { ArrowRight: 1, ArrowUp: 1, PageUp: 1, ArrowLeft: -1, ArrowDown: -1, PageDown: -1 }[e.key]
    if (by === undefined) return
    e.preventDefault()
    const next = Math.max(min, Math.min(max, Math.round(local) + by))
    setLocal(next); setHeld(next); onChange(next)
  }
  return (
    <div className="win-eq-row">
      <span className="win-eq-label">{label}</span>
      <div className="win-eq-track" data-plain={centered ? undefined : ''}>
        <span className="win-eq-end win-eq-low">{low}</span><span className="win-eq-end win-eq-high">{high}</span>
        <input type="range" className="win-slider" min={min} max={max} step="0.05" value={local}
               onChange={(e) => setLocal(centered ? settle(Number(e.target.value), mid, detentOf(min, max)) : Math.round(Number(e.target.value)))}
               onPointerUp={() => { setHeld(local); onChange(local) }} onKeyDown={keyStep} />
      </div>
    </div>
  )
}
