import React, { useEffect, useRef, useState } from 'react'
import { api } from '../../frontend/src/lib/api.js'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import * as Icon from '../../frontend/src/components/Icons.jsx'
import { withoutBrowserRoom } from '../../frontend/src/lib/browserRoom.js'
import { useHeld } from '../../frontend/src/lib/useHeld.js'
import { Row, Section, Toggle } from './SettingsPage.jsx'

// A room's sound settings, which the product does not offer at all: it is
// Sonora's own page, laid out in the product's Settings language (sections of
// 52px rows, toggles at the right). Opened from the player's menu, for the
// room in view. Every group appears only where the speaker reports it: Height
// for a speaker that tunes it, TV for a soundbar, Sub and Surround when they
// are bonded, Line-in for a speaker with a socket, Touch Controls for a
// speaker with buttons.

const RANGES = { SubGain: [-15, 15], SurroundLevel: [-15, 15], MusicSurroundLevel: [-15, 15], AudioDelay: [0, 5], HeightChannelLevel: [-10, 10] }
// The speaker counts a surround's distance from 0, the farthest.
const DISTANCE_CHOICES = [[0, 'desk.room.distanceFar'], [1, 'desk.room.distanceMid'], [2, 'desk.room.distanceNear']]
const SPEECH_LEVELS = [[1, 'desk.room.levelLow'], [2, 'desk.room.levelMedium'], [3, 'desk.room.levelHigh'], [4, 'desk.room.levelMax']]

export default function RoomSoundPage({ uuid, onClose }) {
  const { t } = useI18n()
  const { zones, zoneList, actions } = useSystem()
  const zone = zones[uuid]
  const [extras, setExtras] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let canceled = false
    setExtras(null)
    api.roomSettings(uuid).then((r) => { if (!canceled) setExtras(r) }).catch(() => { if (!canceled) setExtras({ eq: {} }) })
    return () => { canceled = true }
  }, [uuid])
  const apply = async (patch) => {
    setBusy(true)
    try { setExtras(await api.setRoomSettings(uuid, patch)) } catch { /* the notice carries it */ }
    setBusy(false)
  }
  if (!zone) return null
  const eq = extras?.eq || {}
  const level = (k, label) => k in eq && (
    <Row key={k} label={label} control={<Level value={eq[k]} min={RANGES[k][0]} max={RANGES[k][1]} label={label}
                                                  onCommit={(v) => apply({ eq: { [k]: v } })} />} />
  )
  const flag = (k, label) => k in eq && (
    <Row key={k} label={label} control={<Toggle label={label} checked={eq[k] === 1} disabled={busy} onChange={(on) => apply({ eq: { [k]: on ? 1 : 0 } })} />} />
  )
  const has = (...keys) => keys.some((k) => k in eq)
  const hasExtra = (...keys) => Boolean(extras) && keys.some((k) => k in extras)
  // A switch the room reports beside its EQ.
  const extraFlag = (k, label, checked, onSet, off = false) => hasExtra(k) && (
    <Row key={k} label={label} control={<Toggle label={label} checked={checked} disabled={busy || off} onChange={onSet} />} />
  )
  // A choice of a few, in the same box as the line-in's autoplay room.
  const choice = (k, label, value, options, onPick) => (
    <Row key={k} label={label} control={
      <select className="wb-sound-input" value={value} aria-label={label} disabled={busy} onChange={(e) => onPick(Number(e.target.value))}>
        {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
      </select>} />
  )
  const distance = (k, label) => k in eq &&
    choice(k, label, eq[k], DISTANCE_CHOICES.map(([v, key]) => [v, t(key)]), (v) => apply({ eq: { [k]: v } }))

  return (
    <section className="wb-settings wb-sound" aria-label={t('desk.prefs.settingsFor', { room: zone.name })}>
      <header className="wb-settings-head">
        <h1>{t('desk.prefs.settingsFor', { room: zone.name })}</h1>
        <button type="button" className="wb-settings-close" aria-label={t('common.close')} onClick={onClose}>
          <Icon.Close width={18} height={18} />
        </button>
      </header>

      <Section title={t('desk.prefs.musicEq')}>
        {zone.fixed_output ? <Row label={t('desk.prefs.eqFixed')} /> : (
          <>
            <Row label={t('desk.prefs.bass')} control={<Level value={zone.bass ?? 0} min={-10} max={10} label={t('desk.prefs.bass')}
                                                                 onCommit={(v) => actions.setTone(uuid, { bass: v })} />} />
            <Row label={t('desk.prefs.treble')} control={<Level value={zone.treble ?? 0} min={-10} max={10} label={t('desk.prefs.treble')}
                                                                   onCommit={(v) => actions.setTone(uuid, { treble: v })} />} />
            {Boolean(zone.has_balance ?? zone.paired) && (
              <Row label={t('desk.prefs.balance')} control={<Level value={zone.balance ?? 0} min={-100} max={100} label={t('desk.prefs.balance')}
                                                                      onCommit={(v) => actions.setTone(uuid, { balance: v })} />} />
            )}
            {level('HeightChannelLevel', t('desk.room.heightLevel'))}
            <Row label={t('desk.prefs.loudness')} control={<Toggle label={t('desk.prefs.loudness')} checked={Boolean(zone.loudness)}
                                                                  onChange={(on) => actions.setTone(uuid, { loudness: on })} />} />
            {extraFlag('trueplay', t('desk.room.trueplay'), Boolean(extras?.trueplay), (on) => apply({ trueplay: on }))}
            <Row label={t('desk.prefs.reset')} onClick={() => actions.setTone(uuid, { bass: 0, treble: 0, balance: 0, loudness: true })} />
          </>
        )}
      </Section>

      {(has('AudioDelay', 'NightMode', 'DialogLevel') || hasExtra('tv_autoplay', 'ir_light', 'ir_repeater')) && (
        <Section title={t('source.tv')}>
          {flag('NightMode', t('desk.room.nightSound'))}
          {flag('DialogLevel', t('desk.room.speech'))}
          {/* The level only means something while Speech Enhancement is on. */}
          {hasExtra('speech_level') && eq.DialogLevel === 1 && choice('speech_level', t('desk.room.speechLevel'), extras.speech_level ?? 1,
            SPEECH_LEVELS.filter(([v]) => v < 4 || extras.speech_max).map(([v, key]) => [v, t(key)]), (v) => apply({ speech_level: v }))}
          {level('AudioDelay', t('desk.room.audioDelay'))}
          {extraFlag('tv_autoplay', t('desk.room.tvAutoplay'), Boolean(extras?.tv_autoplay), (on) => apply({ tv_autoplay: on }))}
          {extraFlag('tv_autoplay_ungroup', t('desk.room.tvUngroup'), Boolean(extras?.tv_autoplay_ungroup),
            (on) => apply({ tv_autoplay_ungroup: on }), !extras?.tv_autoplay)}
          {extraFlag('ir_light', t('desk.room.irLight'), Boolean(extras?.ir_light), (on) => apply({ ir_light: on }))}
          {extraFlag('ir_repeater', t('desk.room.irRepeater'), Boolean(extras?.ir_repeater), (on) => apply({ ir_repeater: on }))}
        </Section>
      )}
      {has('SubEnable', 'SubGain', 'SubPolarity') && (
        <Section title={t('desk.room.sub')}>
          {flag('SubEnable', t('desk.room.sub'))}
          {level('SubGain', t('desk.room.subLevel'))}
          {'SubPolarity' in eq && choice('SubPolarity', t('desk.room.subPhase'), eq.SubPolarity, [[0, '0°'], [1, '180°']],
            (v) => apply({ eq: { SubPolarity: v } }))}
        </Section>
      )}
      {has('SurroundEnable', 'SurroundLevel', 'MusicSurroundLevel', 'AudioDelayLeftRear', 'AudioDelayRightRear') && (
        <Section title={t('desk.room.surround')}>
          {flag('SurroundEnable', t('desk.room.surround'))}
          {level('SurroundLevel', t('desk.room.surroundLevel'))}
          {level('MusicSurroundLevel', t('desk.room.musicSurroundLevel'))}
          {distance('AudioDelayLeftRear', t('desk.room.surroundDistanceLeft'))}
          {distance('AudioDelayRightRear', t('desk.room.surroundDistanceRight'))}
        </Section>
      )}
      {extras && ('line_in_level' in extras || 'autoplay_room' in extras) && (
        <Section title={t('source.line_in')}>
          {'line_in_level' in extras && (
            <>
              <Row label={t('desk.room.lineInName')} control={
                <input className="wb-sound-input" key={extras.line_in_name} defaultValue={extras.line_in_name} aria-label={t('desk.room.lineInName')}
                       onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== extras.line_in_name) apply({ line_in_name: v }) }} />} />
              <Row label={t('desk.room.lineInLevel')} control={<Level value={extras.line_in_level} min={1} max={10} label={t('desk.room.lineInLevel')}
                                                                     onCommit={(v) => apply({ line_in_level: v })} />} />
            </>
          )}
          {'autoplay_room' in extras && (
            <>
              <Row label={t('desk.room.autoplayRoom')} control={
                <select className="wb-sound-input" value={extras.autoplay_room || ''} aria-label={t('desk.room.autoplayRoom')}
                        onChange={(e) => apply({ autoplay_room: e.target.value })}>
                  <option value="">{t('desk.room.autoplayOff')}</option>
                  {withoutBrowserRoom(zoneList).map((z) => <option key={z.uuid} value={z.uuid}>{z.name}</option>)}
                </select>} />
              {extras.autoplay_room && (
                <>
                  <Row label={t('desk.room.autoplayLinked')} control={<Toggle label={t('desk.room.autoplayLinked')} checked={Boolean(extras.autoplay_linked)} onChange={(on) => apply({ autoplay_linked: on })} />} />
                  <Row label={t('desk.room.autoplayUseVolume')} control={<Toggle label={t('desk.room.autoplayUseVolume')} checked={Boolean(extras.autoplay_use_volume)} onChange={(on) => apply({ autoplay_use_volume: on })} />} />
                  {extras.autoplay_use_volume && (
                    <Row label={t('desk.room.autoplayVolume')} control={<Level value={extras.autoplay_volume} min={0} max={100} wheelStep={2} label={t('desk.room.autoplayVolume')}
                                                                               onCommit={(v) => apply({ autoplay_volume: v })} />} />
                  )}
                </>
              )}
            </>
          )}
        </Section>
      )}
      {/* Touch Controls is on while the buttons are not locked. Any speaker with buttons may
          have it, TV or not, so it has a section of its own. */}
      {hasExtra('button_lock') && (
        <Section title={t('desk.room.touchControls')}>
          {extraFlag('button_lock', t('desk.room.touchControls'), !extras.button_lock, (on) => apply({ button_lock: !on }))}
        </Section>
      )}
    </section>
  )
}

// The theme's slider (a 2px rail, a 12px thumb) over any range, signed or not. The thumb glides
// in twentieths of a step, so a range of a few values (Bass has 21) follows the pointer rather
// than jumping a twentieth of the track at a time; the value shown and sent is the whole step it
// is nearest, and a signed range settles on its middle when the thumb comes within a step of it.
// It sends once, on release: an EQ value is a setting, and the speaker announces the result.
function Level({ value, min, max, label, onCommit, wheelStep = null }) {
  const [moving, setMoving] = useState(null)
  const [held, setHeld] = useHeld(value)
  const latest = useRef(null)
  const whole = (raw) => (min < 0 && Math.abs(raw) < 1 ? 0 : Math.round(raw))
  const shown = moving ?? held ?? value ?? min
  const pct = ((shown - min) / (max - min)) * 100
  const finish = () => {
    const last = latest.current
    latest.current = null
    setMoving(null)
    if (last !== null && whole(last) !== value) { setHeld(whole(last)); onCommit(whole(last)) }
  }
  const number = whole(shown)
  // The keys still move a whole step (the fine steps are for the pointer).
  const keyStep = (e) => {
    const by = { ArrowRight: 1, ArrowUp: 1, PageUp: 1, ArrowLeft: -1, ArrowDown: -1, PageDown: -1 }[e.key]
    if (by === undefined) return
    e.preventDefault()
    const next = Math.max(min, Math.min(max, number + by))
    latest.current = next; setMoving(next)
  }
  return (
    <span className="wb-sound-level">
      <span className="wb-slider">
        <span className="wb-slider-rail" />
        <span className="wb-slider-fill" style={{ width: `${pct}%` }} />
        <input type="range" min={min} max={max} step="0.05" value={shown} aria-label={label} aria-valuetext={String(number)}
               data-wheel-step={wheelStep || undefined}
               onChange={(e) => { const v = Number(e.target.value); latest.current = v; setMoving(v) }}
               onKeyDown={keyStep} onPointerUp={finish} onKeyUp={finish} onBlur={finish} />
      </span>
      <output>{number > 0 && min < 0 ? `+${number}` : number}</output>
    </span>
  )
}
