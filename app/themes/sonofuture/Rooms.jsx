import React, { useEffect, useRef, useState } from 'react'
import { useHeld } from '../../frontend/src/lib/useHeld.js'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { api } from '../../frontend/src/lib/api.js'
import { orderedHouseholds, twoLineMetadata } from '../../frontend/src/lib/format.js'
import { roomSections, canStereoPair } from '../../frontend/src/lib/rooms.js'
import { proposedGroups, groupingPlan, runPlan, leaderOf as groupLeader } from '../../frontend/src/lib/grouping.js'
import Art, { nowPlayingArt } from '../../frontend/src/components/Art.jsx'
import * as I from './icons.jsx'
import { Sheet, SheetHeader, IconButton, Slider, Button, Toggle, Field, Confirm, Segmented, Empty, SystemPicker, Select } from './ui.jsx'
import { nowSummary, hasMusic, nextTransport, togglePlay, isLoaded, householdOf } from './house.js'
import Battery, { batteryShown } from '../../frontend/src/components/Battery.jsx'
import { versionLabel } from '../../frontend/src/lib/version.js'

// Rooms: every room of the systems in view, arranged by group, each with its
// own volume; a room's settings in a side panel; grouping as a sheet that
// shows what will play before anything moves.

// A group's card on the Rooms page drags onto another to join it: the page
// about the speakers is where they are arranged (it had
// been on Home). In Firefox a range input inside a draggable element drags
// the element instead of its thumb, so a press on a control takes the card's
// draggable away until the press ends.
function DragCard({ group, dragging, onDragStart, onDragEnd, onDropOn, className, active, children }) {
  const [over, setOver] = useState(false)
  const ref = useRef(null)
  const holdControl = (event) => {
    if (!event.target.closest('input, button, .sf-slider')) return
    const card = ref.current
    if (!card) return
    card.draggable = false
    const restore = () => { card.draggable = true; window.removeEventListener('pointerup', restore); window.removeEventListener('pointercancel', restore) }
    window.addEventListener('pointerup', restore)
    window.addEventListener('pointercancel', restore)
  }
  const movable = !group.local
  return (
    <article ref={ref} onPointerDownCapture={movable ? holdControl : undefined} className={className}
             data-active={active || undefined} data-over={over || undefined}
             data-dragging={dragging === group.coordinator || undefined}
             draggable={movable}
             onDragStart={movable ? (event) => { event.dataTransfer.setData('text/plain', group.coordinator); event.dataTransfer.effectAllowed = 'move'; onDragStart(group.coordinator) } : undefined}
             onDragEnd={onDragEnd}
             onDragOver={(event) => { if (dragging && dragging !== group.coordinator) { event.preventDefault(); setOver(true) } }}
             onDragLeave={() => setOver(false)}
             onDrop={(event) => { event.preventDefault(); setOver(false); onDropOn(group.coordinator) }}>
      {children}
    </article>
  )
}

export default function RoomsSection({ groups, zones, households, systemFilter, onSystem, activeId, onSelect, onGroupSheet, onRoomSettings, onStage, onMessage }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const [dragging, setDragging] = useState(null)
  // Dropping a card on another joins the dragged group's rooms to the target.
  const dropOn = async (target) => {
    const from = dragging
    setDragging(null)
    if (!from || from === target) return
    const source = groups.find((g) => g.coordinator === from)
    const dest = groups.find((g) => g.coordinator === target)
    if (!source || !dest) return
    // The browser room plays on its own; say so rather than reporting it as
    // a different system.
    if (source.local || dest.local) { onMessage?.(t('local.cannotGroup.detail')); return }
    if (source.household !== dest.household) { onMessage?.(t('sf.groupAcrossSystems')); return }
    for (const uuid of source.members) await actions.join(uuid, target)
    onSelect(target)
  }
  // The web themes build the same list; the rule is in lib/rooms.js.
  // This browser joins the last system's grid rather than starting a row of its own.
  const sections = roomSections({ groups, zones, households, systemFilter }).reduce((out, section) => {
    const last = out[out.length - 1]
    if (!section.household && last) return [...out.slice(0, -1), { ...last, rows: [...last.rows, ...section.rows] }]
    return [...out, section]
  }, [])
  const many = sections.filter((s) => s.household).length > 1
  return (
    <div className="sf-rooms">
      <SystemPicker households={households} value={systemFilter} onChange={onSystem} label={t('desk.showSystem')} allLabel={t('sf.all')} />
      <header className="sf-page-head">
        <div>
          <h1>{t('desk.rooms.title')}</h1>
          {/* Dragging needs a pointer, so the hint is for the widths that have one. */}
          {groups.filter((g) => !g.local).length > 1 && <p className="sf-hint sf-hint-drag">{t('sf.dragToGroup')}</p>}
        </div>
      </header>
      {sections.map((section) => {
        const label = many && section.household ? section.household.generation : ''
        return (
          <section key={section.key} className="sf-rooms-system">
            {label && <h2 className="sf-rooms-gen">{label}</h2>}
            {section.rows.length === 0 && section.household && <Empty icon={<I.Speaker />} title={t('outrun.noRooms')} />}
            {/* Groups first, so the cards of two rooms or more head the page,
                and the single rooms after them in a grid of their own: the
                first single room starts a new row at the left rather than
                filling the space beside the last group. */}
            {[section.rows.filter((r) => r.members.length > 1), section.rows.filter((r) => r.members.length <= 1)]
              .filter((list) => list.length).map((list, li) => (
            <div key={li} className="sf-group-grid">
            {list.map(({ group, lead, members }) => {
              const tr = lead?.transport || {}
              const summary = nowSummary(tr, t)
              const what = nextTransport(tr)
              return (
                <DragCard key={group.id} group={group} className="sf-group" active={group.coordinator === activeId}
                          dragging={dragging} onDragStart={setDragging} onDragEnd={() => setDragging(null)} onDropOn={dropOn}>
                  <header className="sf-group-head" onClick={() => onSelect(group.coordinator)} role="button" tabIndex={0}
                          onKeyDown={(event) => { if (event.key === 'Enter') onSelect(group.coordinator) }}>
                    <button type="button" className="sf-group-art" onClick={(event) => { event.stopPropagation(); onSelect(group.coordinator); onStage() }} title={t('sf.openStage')}>
                      {tr.source === 'tv' ? <I.Tv /> : <Art src={lead ? nowPlayingArt(lead.host, tr) : ''} size={48} fallback="note" />}
                    </button>
                    <div className="sf-group-text">
                      <p className="sf-group-title">{summary.title || t('common.noMusicSelected')}</p>
                      <p className="sf-group-sub">{summary.sub || tr.service_name || ''}</p>
                    </div>
                    <div className="sf-group-tools" onClick={(event) => event.stopPropagation()}>
                      <button type="button" className="sf-play sf-play-sm" disabled={!isLoaded(tr)} onClick={() => togglePlay(actions, lead)}
                              title={what === 'play' ? t('common.play') : what === 'stop' ? t('common.stop') : t('common.pause')}>
                        {what === 'play' ? <I.Play /> : what === 'stop' ? <I.Stop /> : <I.Pause />}
                      </button>
                      {/* Nothing to group the browser room with. */}
                      {!group.local && <Button small quiet icon={<I.Rooms />} onClick={() => onGroupSheet(group)}>{members.length > 1 ? t('sf.editGroup') : t('sf.addRooms')}</Button>}
                    </div>
                  </header>
                  <ul className="sf-room-list">
                    {members.length > 1 && lead && (
                      <li className="sf-room sf-room-groupvol">
                        <span className="sf-room-name">{t('desk.transport.groupVolume')}</span>
                        <IconButton size="sm" label={lead.group_muted ? t('common.unmute') : t('common.mute')} onClick={() => actions.setMute(lead.uuid, !lead.group_muted, true)}>
                          {lead.group_muted ? <I.Muted /> : <I.Volume />}
                        </IconButton>
                        <Slider value={lead.group_volume ?? 0} label={t('desk.transport.groupVolume')} onCommit={(level) => actions.setGroupVolume(lead.uuid, level)} />
                        <span className="sf-room-level">{lead.group_volume ?? 0}</span>
                        <span className="sf-room-tools" />
                      </li>
                    )}
                    {members.map((m) => (
                      <li key={m.uuid} className="sf-room" data-offline={m.online === false || undefined}>
                        <span className="sf-room-name">
                          <span className="sf-room-name-line"><span className="sn-name-text">{m.name}</span>{batteryShown(m) && <Battery battery={m.battery} className="sf-room-battery" />}</span>
                          <small>{m.model}{m.paired ? ` · ${t('desk.room.stereoPair')}` : ''}{m.online === false ? ` · ${t('desk.rooms.offline')}` : ''}</small>
                        </span>
                        <IconButton size="sm" label={m.muted ? t('common.unmute') : t('common.mute')} onClick={() => actions.setMute(m.uuid, !m.muted)}>
                          {m.muted ? <I.Muted /> : <I.Volume />}
                        </IconButton>
                        <Slider value={m.volume ?? 0} label={m.name} onCommit={(level) => actions.setVolume(m.uuid, level)} />
                        <span className="sf-room-level">{m.volume ?? 0}</span>
                        <span className="sf-room-tools">
                          {members.length > 1 && (
                            <IconButton size="sm" label={t('sf.leaveGroup', { room: m.name })} onClick={() => actions.leave(m.uuid)}><I.LeaveGroup /></IconButton>
                          )}
                          {/* An output has no equalizer, status light or name to set. */}
                          <IconButton size="sm" disabled={Boolean(m.local)} label={t('desk.rooms.menu.eq', { name: m.name })} onClick={() => onRoomSettings(m.uuid)}><I.Sliders /></IconButton>
                        </span>
                      </li>
                    ))}
                  </ul>
                </DragCard>
              )
            })}
            </div>
            ))}
          </section>
        )
      })}
    </div>
  )
}

// A room's own settings: its name, its sound, its extras, the light, the
// stereo pair and what it is.
const EQ_LABELS = { NightMode: 'desk.room.nightSound', DialogLevel: 'desk.room.speech', SubEnable: 'desk.room.sub',
                    SubGain: 'desk.room.subLevel', SurroundEnable: 'desk.room.surround', SurroundLevel: 'desk.room.surroundLevel',
                    MusicSurroundLevel: 'desk.room.musicSurroundLevel', AudioDelay: 'desk.room.audioDelay', HeightChannelLevel: 'desk.room.heightLevel' }
const EQ_FLAGS = new Set(['NightMode', 'DialogLevel', 'SubEnable', 'SurroundEnable'])
const EQ_RANGES = { SubGain: [-15, 15], SurroundLevel: [-15, 15], MusicSurroundLevel: [-15, 15], AudioDelay: [0, 5], HeightChannelLevel: [-10, 10] }
// The settings a soundbar's speaker takes as a choice of a few: how far each
// surround sits (the speaker counts 0 as farthest), the sub's phase, and the
// strength of speech enhancement where it is apart from its switch.
const SURROUND_DISTANCES = { AudioDelayLeftRear: 'desk.room.surroundDistanceLeft', AudioDelayRightRear: 'desk.room.surroundDistanceRight' }
const DISTANCE_CHOICES = [[0, 'desk.room.distanceFar'], [1, 'desk.room.distanceMid'], [2, 'desk.room.distanceNear']]
const SPEECH_LEVELS = [[1, 'desk.room.levelLow'], [2, 'desk.room.levelMedium'], [3, 'desk.room.levelHigh'], [4, 'desk.room.levelMax']]

// Bass, Treble and Balance mark their middle with a tick and pull a drag
// that comes near it onto it, as the Windows theme's EQ does:
// one step of Bass or Treble, five of Balance's two hundred.
const detentOf = (min, max) => Math.max(1, (max - min) / 40)
const settle = (raw, mid, detent) => (Math.abs(raw - mid) < detent ? mid : Math.round(raw))

function ToneRow({ label, value, min, max, onChange, minLabel = '-', maxLabel = '+', wheelStep = null }) {
  const [local, setLocal] = useState(value)
  // What was let go of stays until the room reports it, past any value between (useHeld).
  const [held, setHeld] = useHeld(value)
  useEffect(() => { if (held === null) setLocal(value) }, [value, held])
  const mid = (min + max) / 2
  // Only a slider centered on zero has a middle to settle on (Bass, Balance...); Audio Delay
  // runs 0-5 and line-in level 1-10, where the middle is no value the speaker takes, and a
  // wheel notch away from it was pulled straight back.
  const centered = min + max === 0
  const keyStep = (e) => {
    const by = { ArrowRight: 1, ArrowUp: 1, PageUp: 1, ArrowLeft: -1, ArrowDown: -1, PageDown: -1 }[e.key]
    if (by === undefined) return
    e.preventDefault()
    const next = Math.max(min, Math.min(max, Math.round(local) + by))
    setLocal(next); setHeld(next); onChange(next)
  }
  return (
    <div className="sf-tone">
      <span className="sf-tone-label">{label}</span>
      <span className="sf-tone-end">{minLabel}</span>
      <span className="sf-tone-track">
        <input type="range" min={min} max={max} step="0.05" value={local} aria-label={label} className="sf-range" data-wheel-step={wheelStep || undefined}
               onChange={(e) => setLocal(centered ? settle(Number(e.target.value), mid, detentOf(min, max)) : Math.round(Number(e.target.value)))}
               onPointerUp={() => { setHeld(local); onChange(local) }} onKeyDown={keyStep} />
      </span>
      <span className="sf-tone-end">{maxLabel}</span>
      <output className="sf-tone-value">{local > 0 ? `+${local}` : local}</output>
    </div>
  )
}

export function RoomSettings({ uuid, households, onClose }) {
  const { zones, zoneList, actions } = useSystem()
  const { t } = useI18n()
  const zone = zones[uuid]
  const [tab, setTab] = useState('sound')
  const [name, setName] = useState(zone?.name || '')
  const [extras, setExtras] = useState(null)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [partner, setPartner] = useState('')
  useEffect(() => { setName(zone?.name || '') }, [zone?.name])
  useEffect(() => {
    if (!uuid) return undefined
    let canceled = false
    api.roomSettings(uuid).then((r) => { if (!canceled) setExtras(r) }).catch(() => { if (!canceled) setExtras({ eq: {} }) })
    return () => { canceled = true }
  }, [uuid])
  if (!zone) return null
  const household = householdOf(households, uuid)
  const applyExtras = async (patch) => {
    setBusy(true)
    try { setExtras(await api.setRoomSettings(uuid, patch)) } catch { /* the notice carries it */ }
    setBusy(false)
  }
  const eq = extras?.eq || {}
  const extraKeys = Object.keys(EQ_LABELS).filter((k) => k in eq && k !== 'SurroundMode')
  // The generations of a model pair with each other, so the "(Gen 2)" on
  // its name is not compared.
  const base = (model) => (model || '').replace(/ \(Gen \d\)$/, '')
  const candidates = zoneList.filter((z) => z.uuid !== zone.uuid && !z.paired && base(z.model) === base(zone.model) && canStereoPair(z) && canStereoPair(zone))
  const chosen = candidates.find((z) => z.uuid === partner)
  return (
    <Sheet kind="side" title={t('desk.prefs.settingsFor', { room: zone.name })} onClose={onClose} className="sf-roomsettings">
      <SheetHeader title={zone.name} sub={`${zone.model}${household ? ` · ${household.generation}` : ''}`} onClose={onClose} />
      <div className="sf-sheet-body">
        <Segmented value={tab} onChange={setTab} options={[
          { id: 'sound', label: t('desk.prefs.musicEq') }, { id: 'device', label: t('desk.prefs.device') }, { id: 'about', label: t('win.about.title') }]} />
        {tab === 'sound' && (
          zone.fixed_output ? <p className="sf-muted">{t('desk.prefs.eqFixed')}</p> : (
            <div className="sf-settings-block">
              <ToneRow label={t('desk.prefs.bass')} value={zone.bass ?? 0} min={-10} max={10} onChange={(v) => actions.setTone(uuid, { bass: v })} />
              <ToneRow label={t('desk.prefs.treble')} value={zone.treble ?? 0} min={-10} max={10} onChange={(v) => actions.setTone(uuid, { treble: v })} />
              {zone.has_balance !== false && (
                <ToneRow label={t('desk.prefs.balance')} value={zone.balance ?? 0} min={-100} max={100} minLabel={t('desk.prefs.left')} maxLabel={t('desk.prefs.right')} onChange={(v) => actions.setTone(uuid, { balance: v })} />
              )}
              <Toggle checked={Boolean(zone.loudness)} label={t('desk.prefs.loudness')} onChange={(on) => actions.setTone(uuid, { loudness: on })} />
              {extraKeys.length > 0 && (
                <fieldset className="sf-extras" disabled={busy}>
                  {extraKeys.map((k) => EQ_FLAGS.has(k) ? (
                    <Toggle key={k} checked={eq[k] === 1} label={t(EQ_LABELS[k])} onChange={(on) => applyExtras({ eq: { [k]: on ? 1 : 0 } })} />
                  ) : (
                    <ToneRow key={k} label={t(EQ_LABELS[k])} value={eq[k]} min={EQ_RANGES[k]?.[0] ?? -10} max={EQ_RANGES[k]?.[1] ?? 10} onChange={(v) => applyExtras({ eq: { [k]: v } })} />
                  ))}
                  {'speech_level' in (extras || {}) && eq.DialogLevel === 1 && (
                    <Field label={t('desk.room.speechLevel')}>
                      <Select value={extras.speech_level ?? 1} onChange={(e) => applyExtras({ speech_level: Number(e.target.value) })}>
                        {SPEECH_LEVELS.filter(([v]) => v < 4 || extras.speech_max).map(([v, key]) => <option key={v} value={v}>{t(key)}</option>)}
                      </Select>
                    </Field>
                  )}
                  {Object.entries(SURROUND_DISTANCES).filter(([k]) => k in eq).map(([k, label]) => (
                    <Field key={k} label={t(label)}>
                      <Select value={eq[k]} onChange={(e) => applyExtras({ eq: { [k]: Number(e.target.value) } })}>
                        {DISTANCE_CHOICES.map(([v, key]) => <option key={v} value={v}>{t(key)}</option>)}
                      </Select>
                    </Field>
                  ))}
                  {'SubPolarity' in eq && (
                    <Field label={t('desk.room.subPhase')}>
                      <Select value={eq.SubPolarity} onChange={(e) => applyExtras({ eq: { SubPolarity: Number(e.target.value) } })}>
                        <option value={0}>0°</option>
                        <option value={1}>180°</option>
                      </Select>
                    </Field>
                  )}
                </fieldset>
              )}
              {extras && 'trueplay' in extras && (
                <Toggle checked={Boolean(extras.trueplay)} label={t('desk.room.trueplay')} disabled={busy} onChange={(on) => applyExtras({ trueplay: on })} />
              )}
              <Button quiet small onClick={() => actions.setTone(uuid, { bass: 0, treble: 0, balance: 0, loudness: true })}>{t('desk.prefs.reset')}</Button>
            </div>
          )
        )}
        {tab === 'device' && (
          <div className="sf-settings-block">
            <Field label={t('desk.prefs.roomName')}>
              <div className="sf-inline">
                <input className="sf-input" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && name.trim() && name !== zone.name) actions.rename(uuid, name.trim()) }} />
                <Button small primary disabled={!name.trim() || name === zone.name} onClick={() => actions.rename(uuid, name.trim())}>{t('desk.prefs.apply')}</Button>
              </div>
            </Field>
            {/* A switch in the light's real position, read from the speaker; a pair of
                buttons said nothing about which way it was. It is a row like the
                room's other switches. */}
            <Toggle checked={Boolean(extras?.status_light)} label={t('desk.prefs.statusLight')} disabled={!extras}
                    onChange={(on) => applyExtras({ status_light: on })} />
            {extras && 'button_lock' in extras && (
              <Toggle checked={!extras.button_lock} label={t('desk.room.touchControls')} disabled={busy} onChange={(on) => applyExtras({ button_lock: !on })} />
            )}
            {extras && 'tv_autoplay' in extras && (
              <div className="sf-stack">
                <Toggle checked={Boolean(extras.tv_autoplay)} label={t('desk.room.tvAutoplay')} disabled={busy} onChange={(on) => applyExtras({ tv_autoplay: on })} />
                <Toggle checked={Boolean(extras.tv_autoplay_ungroup)} label={t('desk.room.tvUngroup')} disabled={busy || !extras.tv_autoplay}
                        onChange={(on) => applyExtras({ tv_autoplay_ungroup: on })} />
              </div>
            )}
            {extras && 'ir_light' in extras && (
              <Toggle checked={Boolean(extras.ir_light)} label={t('desk.room.irLight')} disabled={busy} onChange={(on) => applyExtras({ ir_light: on })} />
            )}
            {extras && 'ir_repeater' in extras && (
              <Toggle checked={Boolean(extras.ir_repeater)} label={t('desk.room.irRepeater')} disabled={busy} onChange={(on) => applyExtras({ ir_repeater: on })} />
            )}
            {extras && 'line_in_level' in extras && (
              <>
                <Field label={t('desk.room.lineInName')}>
                  <input className="sf-input" defaultValue={extras.line_in_name} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== extras.line_in_name) applyExtras({ line_in_name: v }) }} />
                </Field>
                <ToneRow label={t('desk.room.lineInLevel')} value={extras.line_in_level} min={1} max={10} minLabel="1" maxLabel="10" onChange={(v) => applyExtras({ line_in_level: v })} />
              </>
            )}
            {extras && 'autoplay_room' in extras && (
              <Field label={t('desk.room.autoplayRoom')}>
                <Select value={extras.autoplay_room || ''} onChange={(e) => applyExtras({ autoplay_room: e.target.value })}>
                  <option value="">{t('desk.room.autoplayOff')}</option>
                  {zoneList.map((z) => <option key={z.uuid} value={z.uuid}>{z.name}</option>)}
                </Select>
                {extras.autoplay_room && (
                  <div className="sf-stack">
                    <Toggle checked={Boolean(extras.autoplay_linked)} label={t('desk.room.autoplayLinked')} onChange={(on) => applyExtras({ autoplay_linked: on })} />
                    <Toggle checked={Boolean(extras.autoplay_use_volume)} label={t('desk.room.autoplayUseVolume')} onChange={(on) => applyExtras({ autoplay_use_volume: on })} />
                    {extras.autoplay_use_volume && (
                      <ToneRow wheelStep={2} label={t('desk.room.autoplayVolume')} value={extras.autoplay_volume} min={0} max={100} minLabel="0" maxLabel="100" onChange={(v) => applyExtras({ autoplay_volume: v })} />
                    )}
                  </div>
                )}
              </Field>
            )}
            {/* Only a pair, or a speaker that says it can be one (a soundbar cannot). */}
            {(zone.paired || canStereoPair(zone)) && (
            <Field label={t('desk.room.stereoPair')}>
              {zone.paired ? (
                <Button small quiet icon={<I.Unlink />} onClick={() => setConfirm('separate')}>{t('desk.room.separate')}</Button>
              ) : candidates.length === 0 ? <p className="sf-muted">{t('sf.noPairCandidates')}</p> : (
                <div className="sf-inline">
                  <Select value={partner} onChange={(e) => setPartner(e.target.value)}>
                    <option value="">{t('desk.room.pairWith')}</option>
                    {candidates.map((z) => <option key={z.uuid} value={z.uuid}>{z.name}</option>)}
                  </Select>
                  <Button small primary disabled={!chosen} onClick={() => setConfirm('pair')}>{t('desk.room.createPair')}</Button>
                </div>
              )}
            </Field>
            )}
          </div>
        )}
        {tab === 'about' && (
          <dl className="sf-facts">
            <dt>{t('desk.about.model')}</dt><dd>{zone.model}</dd>
            <dt>{t('desk.about.version')}</dt><dd>{versionLabel(zone.display_version, zone.software_version)}</dd>
            <dt>{t('desk.about.system')}</dt><dd>{household?.generation || ''}</dd>
            <dt>{t('desk.about.address')}</dt><dd>{zone.host}</dd>
            <dt>{t('sf.lineIn')}</dt><dd>{zone.supports_line_in ? (zone.line_in_connected ? t('sf.connected') : t('sf.nothingConnected')) : t('sf.none')}</dd>
          </dl>
        )}
      </div>
      {confirm === 'separate' && (
        <Confirm title={t('desk.room.separate')} body={t('desk.room.separateBody', { room: zone.name })} action={t('desk.room.separate')}
                 onConfirm={() => { setConfirm(null); actions.separateStereoPair(uuid) }} onClose={() => setConfirm(null)} />
      )}
      {confirm === 'pair' && chosen && (
        <Confirm title={t('desk.room.createPair')} body={t('desk.room.pairBody', { left: zone.name, right: chosen.name })} action={t('desk.room.createPair')}
                 onConfirm={() => { setConfirm(null); actions.createStereoPair(uuid, chosen.uuid) }} onClose={() => setConfirm(null)} />
      )}
    </Sheet>
  )
}

// Grouping: tick the rooms that should play together. The panel says what
// will play; when more than one of the merging groups has music, it asks
// which should continue before anything moves.
export function GroupSheet({ group, zones, households, onClose }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const coordinator = zones[group.coordinator]
  const household = orderedHouseholds(households).find((h) => h.zone_uuids.includes(group.coordinator))
  const local = Boolean(group.local)
  const candidates = (household?.zone_uuids || []).map((u) => zones[u]).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name))
  const [selected, setSelected] = useState(() => new Set(group.members))
  const [picking, setPicking] = useState(null)
  const [chosen, setChosen] = useState('')
  const [askNone, setAskNone] = useState(false)
  const allSelected = candidates.every((z) => selected.has(z.uuid))
  // Every room can be unticked, this one as well; lib/grouping.js has what
  // Done then does, as the S1 app does it.
  const toggle = (uuid) => {
    const next = new Set(selected)
    if (next.has(uuid)) next.delete(uuid); else next.add(uuid)
    setSelected(next)
  }
  const leaderOf = (uuid) => groupLeader(zones, uuid)
  const proposed = proposedGroups({ group, zones, candidates, selected })
  const showing = proposed.length === 1 ? zones[proposed[0]] || coordinator : coordinator
  const transport = showing?.transport ?? {}
  const applyTo = (target) => {
    const steps = groupingPlan({ group, zones, candidates, selected, target })
    onClose()
    runPlan(steps, actions)
  }
  const apply = () => {
    if (selected.size === 0) { setAskNone(true); return }
    if (proposed.length > 1) { setPicking(proposed); return }
    applyTo(proposed[0] || group.coordinator)
  }
  const lines = twoLineMetadata(transport, t)
  const preview = selected.size === 0 ? t('desk.grouping.noMusic') : proposed.length > 1 ? t('desk.grouping.chooseMusic') : lines.line1
  // Reachable from a keyboard shortcut even though no button offers it.
  if (local) {
    return (
      <Sheet kind="center" title={t('desk.grouping.title')} onClose={onClose} className="sf-groupsheet">
        <SheetHeader title={t('local.cannotGroup.title')} onClose={onClose} />
        <div className="sf-sheet-body">
          <p className="sf-muted">{t('local.cannotGroup.detail')}</p>
        </div>
      </Sheet>
    )
  }
  if (askNone) {
    return (
      <Confirm title={t('desk.grouping.noneTitle')} body={t('desk.grouping.noneBody')} action={t('desk.grouping.noneYes')}
               onClose={() => setAskNone(false)} onConfirm={() => { onClose(); actions.stop(group.coordinator) }} />
    )
  }
  return (
    <Sheet kind="center" title={t('desk.grouping.title')} onClose={onClose} className="sf-groupsheet">
      <SheetHeader title={t('desk.grouping.title')} sub={t('desk.grouping.select')} onClose={onClose} />
      <div className="sf-sheet-body">
        {!picking ? (
          <>
            <div className="sf-willplay">
              <span className="sf-willplay-art">
                {transport.source === 'tv' ? <I.Tv /> : <Art src={selected.size && showing ? nowPlayingArt(showing.host, transport) : ''} size={48} fallback="note" />}
              </span>
              <div>
                <p className="sf-caption">{t('desk.grouping.willPlay')}</p>
                <p className="sf-willplay-title">{preview || t('common.noMusicSelected')}</p>
                {selected.size > 0 && proposed.length <= 1 && lines.line2 && <p className="sf-muted">{lines.line2}</p>}
              </div>
            </div>
            <ul className="sf-picklist">
              {candidates.map((zone) => {
                const lead = leaderOf(zone.uuid)
                const elsewhere = !group.members.includes(zone.uuid) && lead !== zone.uuid
                const own = zones[lead]?.transport
                return (
                  <li key={zone.uuid}>
                    <label className="sf-pick">
                      <input type="checkbox" checked={selected.has(zone.uuid)} onChange={() => toggle(zone.uuid)} />
                      <span className="sf-pick-box" aria-hidden="true"><I.Check /></span>
                      <span className="sf-pick-text">
                        <span>{zone.name}</span>
                        <small>{zone.uuid === group.coordinator ? t('sf.thisRoom') : elsewhere ? t('sf.groupedWith', { room: zones[lead]?.name || '' }) : hasMusic(own) ? nowSummary(own, t).title : ''}</small>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
            <Button quiet small onClick={() => setSelected(new Set(allSelected ? [] : candidates.map((z) => z.uuid)))}>
              {allSelected ? t('desk.grouping.unselectAll') : t('desk.grouping.partyMode')}
            </Button>
          </>
        ) : (
          <>
            <p className="sf-confirm-body">{t('desk.grouping.pickHeading')}</p>
            <ul className="sf-picklist" role="listbox">
              {picking.map((uuid) => {
                const zone = zones[uuid]
                const tr = zone?.transport ?? {}
                const two = twoLineMetadata(tr, t)
                return (
                  <li key={uuid}>
                    <button type="button" className="sf-pick sf-pick-btn" role="option" aria-selected={chosen === uuid} onClick={() => setChosen(uuid)} onDoubleClick={() => applyTo(uuid)}>
                      <span className="sf-willplay-art"><Art src={zone ? nowPlayingArt(zone.host, tr) : ''} size={40} fallback="note" /></span>
                      <span className="sf-pick-text"><span>{two.line1 || zone?.name || ''}</span><small>{two.line2 || zone?.name}</small></span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
      <footer className="sf-sheet-foot">
        <Button quiet onClick={picking ? () => setPicking(null) : onClose}>{picking ? t('common.back') : t('common.cancel')}</Button>
        {picking
          ? <Button primary disabled={!chosen} onClick={() => applyTo(chosen)}>{t('common.done')}</Button>
          : <Button primary onClick={apply}>{t('common.done')}</Button>}
      </footer>
    </Sheet>
  )
}
