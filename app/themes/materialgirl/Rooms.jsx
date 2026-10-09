import React, { useEffect, useRef, useState } from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { api } from '../../frontend/src/lib/api.js'
import { orderedHouseholds, twoLineMetadata } from '../../frontend/src/lib/format.js'
import { roomSections, canStereoPair } from '../../frontend/src/lib/rooms.js'
import { proposedGroups, groupingPlan, runPlan, leaderOf as groupLeader } from '../../frontend/src/lib/grouping.js'
import { nowPlayingArt } from '../../frontend/src/components/Art.jsx'
import * as I from './icons.jsx'
import { Sheet, SheetBar, IconButton, Button, Slider, Switch, Confirm, Empty, Select, TextField, ListItem, ShapeArt, Menu, MenuItem, cx } from './m3.jsx'
import { KIND_SHAPES, SHAPES } from './shapes.js'
import { nowSummary, hasMusic, householdOf } from './data.js'
import { PlayButton } from './Player.jsx'
import Battery, { batteryShown } from '../../frontend/src/components/Battery.jsx'
import { versionLabel } from '../../frontend/src/lib/version.js'

// Rooms: every room of the systems in view, arranged by what plays together.
// Each group is an outlined card; its rooms are list items with their own
// volume. A card dragged onto another joins it. A room's sound and settings
// open in a side sheet with tabs; grouping opens a dialog that shows what
// will play before anything moves.

// In Firefox a range input inside a draggable element drags the element
// instead of its thumb, so a press on a control takes the card's draggable
// away until the press ends.
function DragCard({ group, dragging, onDragStart, onDragEnd, onDropOn, className, active, children }) {
  const [over, setOver] = useState(false)
  const ref = useRef(null)
  const holdControl = (event) => {
    if (!event.target.closest('input, button, .mg-slider')) return
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
             data-active={active || undefined} data-over={over || undefined} data-dragging={dragging === group.coordinator || undefined}
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

export default function RoomsPage({ groups, zones, households, systemFilter, activeId, onSelect, onGroup, onRoomSettings, onPlayer, onMessage,
                                   onPauseAll, pauseDisabled = true, onParty, partyDisabled = true }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const [dragging, setDragging] = useState(null)
  const [memberMenu, setMemberMenu] = useState(null)
  const dropOn = async (target) => {
    const from = dragging
    setDragging(null)
    if (!from || from === target) return
    const source = groups.find((g) => g.coordinator === from)
    const dest = groups.find((g) => g.coordinator === target)
    if (!source || !dest) return
    if (source.local || dest.local) { onMessage?.(t('local.cannotGroup.detail')); return }
    if (source.household !== dest.household) { onMessage?.(t('mg.groupAcrossSystems')); return }
    for (const uuid of source.members) await actions.join(uuid, target)
    onSelect(target)
  }
  // This browser joins the last system's grid rather than starting a row of its own.
  const sections = roomSections({ groups, zones, households, systemFilter }).reduce((out, section) => {
    const last = out[out.length - 1]
    if (!section.household && last) return [...out.slice(0, -1), { ...last, rows: [...last.rows, ...section.rows] }]
    return [...out, section]
  }, [])
  const many = sections.filter((s) => s.household).length > 1
  return (
    <div className="mg-page mg-rooms">
      <header className="mg-appbar mg-appbar-medium">
        <div className="mg-rooms-head">
          <h1 className="mg-headline">{t('desk.rooms.title')}</h1>
          {/* The whole house's actions, beside the rooms they act on. */}
          <div className="mg-rooms-actions">
            <Button variant="tonal" size="s" icon={<I.Pause />} disabled={pauseDisabled} onClick={onPauseAll}>{t('desk.rooms.pauseAll')}</Button>
            <Button variant="tonal" size="s" icon={<I.Sparkle />} disabled={partyDisabled} onClick={onParty}>{t('mg.partyMode')}</Button>
          </div>
        </div>
        {groups.filter((g) => !g.local).length > 1 && <p className="mg-hint mg-hint-drag"><I.Drag />{t('mg.dragToGroup')}</p>}
      </header>
      {sections.map((section) => {
        const label = many && section.household ? section.household.generation : ''
        return (
          <section key={section.key} className="mg-rooms-system">
            {label && <h2 className="mg-title-l mg-system-label">{label}</h2>}
            {section.rows.length === 0 && section.household && <Empty icon={<I.Speaker />} title={t('mg.noRooms')} />}
            <div className="mg-rooms-grid">
              {section.rows.map(({ group, lead, members }) => {
                const tr = lead?.transport || {}
                const summary = nowSummary(tr, t)
                return (
                  <DragCard key={group.id} group={group} className="mg-card mg-card-outlined mg-group" active={group.coordinator === activeId}
                            dragging={dragging} onDragStart={setDragging} onDragEnd={() => setDragging(null)} onDropOn={dropOn}>
                    <header className="mg-group-head" role="button" tabIndex={0} onClick={() => onSelect(group.coordinator)}
                            onKeyDown={(event) => { if (event.key === 'Enter') onSelect(group.coordinator) }}>
                      <button type="button" className="mg-group-art" title={t('mg.openPlayer')}
                              onClick={(event) => { event.stopPropagation(); onSelect(group.coordinator); onPlayer() }}>
                        {tr.source === 'tv' ? <span className="mg-li-glyph" style={{ clipPath: SHAPES.squircle }}><I.Tv /></span>
                          : <ShapeArt src={lead ? nowPlayingArt(lead.host, tr) : ''} shape={KIND_SHAPES.room} size={56} fallback="note" />}
                      </button>
                      <div className="mg-group-text">
                        <p className="mg-group-title">{summary.title || t('common.noMusicSelected')}</p>
                        <p className="mg-group-sub">{summary.sub || tr.service_name || ''}</p>
                      </div>
                      <div className="mg-group-tools" onClick={(event) => event.stopPropagation()}>
                        <PlayButton zone={lead} size="s" />
                        {!group.local && (
                          <Button variant="tonal" size="xs" icon={<I.Group />} onClick={() => onGroup(group)}>{members.length > 1 ? t('mg.editGroup') : t('mg.addRooms')}</Button>
                        )}
                      </div>
                    </header>
                    <div className="mg-group-rooms">
                      {members.length > 1 && lead && (
                        <div className="mg-member mg-member-group">
                          <span className="mg-member-name">{t('desk.transport.groupVolume')}</span>
                          <IconButton size="xs" variant="toggle" selected={lead.group_muted} label={lead.group_muted ? t('common.unmute') : t('common.mute')}
                                      onClick={() => actions.setMute(lead.uuid, !lead.group_muted, true)}>{lead.group_muted ? <I.Muted /> : <I.Volume />}</IconButton>
                          <Slider wheelStep={2} size="xs" value={lead.group_volume ?? 0} label={t('desk.transport.groupVolume')} onCommit={(level) => actions.setGroupVolume(lead.uuid, level)} />
                          <span className="mg-member-level">{lead.group_volume ?? 0}</span>
                          <span />
                        </div>
                      )}
                      {members.map((m) => (
                        <div key={m.uuid} className="mg-member" data-offline={m.online === false || undefined}>
                          <span className="mg-member-name">
                            <span className="mg-room-name-line"><span className="sn-name-text">{m.name}</span>{batteryShown(m) && <Battery battery={m.battery} className="mg-room-battery" />}</span>
                            <small>{m.model}{m.paired ? ` · ${t('desk.room.stereoPair')}` : ''}{m.online === false ? ` · ${t('desk.rooms.offline')}` : ''}</small>
                          </span>
                          <IconButton size="xs" variant="toggle" selected={m.muted} label={m.muted ? t('common.unmute') : t('common.mute')}
                                      onClick={() => actions.setMute(m.uuid, !m.muted)}>{m.muted ? <I.Muted /> : <I.Volume />}</IconButton>
                          <Slider wheelStep={2} size="xs" value={m.volume ?? 0} label={m.name} onCommit={(level) => actions.setVolume(m.uuid, level)} />
                          <span className="mg-member-level">{m.volume ?? 0}</span>
                          <IconButton size="xs" label={t('desk.browse.actions')} disabled={Boolean(m.local) && members.length < 2}
                                      onClick={(event) => setMemberMenu({ m, grouped: members.length > 1, anchor: event.currentTarget })}><I.More /></IconButton>
                        </div>
                      ))}
                    </div>
                  </DragCard>
                )
              })}
            </div>
          </section>
        )
      })}
      {memberMenu && (
        <Menu anchor={memberMenu.anchor} align="right" onClose={() => setMemberMenu(null)} title={memberMenu.m.name}>
          {memberMenu.grouped && (
            <MenuItem icon={<I.Unlink />} onSelect={() => { const m = memberMenu.m; setMemberMenu(null); actions.leave(m.uuid) }}>{t('mg.leaveGroup', { room: memberMenu.m.name })}</MenuItem>
          )}
          {!memberMenu.m.local && (
            <MenuItem icon={<I.Tune />} onSelect={() => { const m = memberMenu.m; setMemberMenu(null); onRoomSettings(m.uuid) }}>{t('desk.rooms.menu.eq', { name: memberMenu.m.name })}</MenuItem>
          )}
        </Menu>
      )}
    </div>
  )
}

// --- a room's settings -------------------------------------------------------------------

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

// A tone control: the Expressive slider with its value on the handle, the
// range's two ends named beside it.
// The middle is ticked, and a drag that ends near it settles on it, as the
// Windows theme's EQ does: one step of Bass or Treble, five of
// Balance's two hundred.
const detentOf = (min, max) => Math.max(1, (max - min) / 40)
const settle = (raw, mid, detent) => (Math.abs(raw - mid) < detent ? mid : Math.round(raw))
// Only a slider centered on zero has a middle to settle on (Bass, Balance...); Audio Delay
// runs 0-5 and line-in level 1-10, where the middle is no value the speaker takes, and a
// wheel notch away from it was pulled straight back.
const stepOf = (raw, min, max) => (min + max === 0 ? settle(raw, 0, detentOf(min, max)) : Math.round(raw))

function Tone({ label, value, min, max, onChange, minLabel = '-', maxLabel = '+', wheelStep = null }) {
  // The rounded value last sent, so a glide within one step sends nothing new.
  const sent = useRef(value)
  const commit = (raw) => { const n = stepOf(raw, min, max); if (n !== sent.current) { sent.current = n; onChange(n) } }
  useEffect(() => { sent.current = value }, [value])
  return (
    <div className="mg-tone">
      <span className="mg-tone-label">{label}<output>{value > 0 ? `+${value}` : value}</output></span>
      <span className="mg-tone-end">{minLabel}</span>
      <span className="mg-tone-track">
        {/* The thumb glides in twentieths so a range of 21 values follows the pointer; what is sent
            and shown is the whole step it is nearest (settle). */}
        <Slider size="xs" min={min} max={max} step={0.05} value={value} label={label} wheelStep={wheelStep} onCommit={commit}
                format={(v) => { const n = stepOf(v, min, max); return n > 0 ? `+${n}` : `${n}` }} />
      </span>
      <span className="mg-tone-end">{maxLabel}</span>
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
  const [lineInName, setLineInName] = useState('')
  useEffect(() => { setName(zone?.name || '') }, [zone?.name])
  useEffect(() => {
    if (!uuid) return undefined
    let canceled = false
    api.roomSettings(uuid).then((r) => { if (!canceled) { setExtras(r); setLineInName(r?.line_in_name || '') } }).catch(() => { if (!canceled) setExtras({ eq: {} }) })
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
  const base = (model) => (model || '').replace(/ \(Gen \d\)$/, '')
  const candidates = zoneList.filter((z) => z.uuid !== zone.uuid && !z.paired && base(z.model) === base(zone.model) && canStereoPair(z) && canStereoPair(zone))
  const chosen = candidates.find((z) => z.uuid === partner)
  return (
    <Sheet kind="side" title={t('desk.prefs.settingsFor', { room: zone.name })} onClose={onClose} className="mg-roomsettings">
      <SheetBar title={zone.name} sub={`${zone.model}${household ? ` · ${household.generation}` : ''}`} onClose={onClose} />
      <div className="mg-tabs" role="tablist">
        {[['sound', t('desk.prefs.musicEq'), <I.Tune key="s" />], ['device', t('desk.prefs.device'), <I.Speaker key="d" />], ['about', t('win.about.title'), <I.Info key="a" />]].map(([id, label, icon]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            <span className="mg-state" aria-hidden="true" />{icon}<span>{label}</span>
          </button>
        ))}
      </div>
      <div className="mg-sheet-body">
        {tab === 'sound' && (
          zone.fixed_output ? <p className="mg-muted">{t('desk.prefs.eqFixed')}</p> : (
            <div className="mg-stack">
              <Tone label={t('desk.prefs.bass')} value={zone.bass ?? 0} min={-10} max={10} onChange={(v) => actions.setTone(uuid, { bass: v })} />
              <Tone label={t('desk.prefs.treble')} value={zone.treble ?? 0} min={-10} max={10} onChange={(v) => actions.setTone(uuid, { treble: v })} />
              {zone.has_balance !== false && (
                <Tone label={t('desk.prefs.balance')} value={zone.balance ?? 0} min={-100} max={100} minLabel={t('desk.prefs.left')} maxLabel={t('desk.prefs.right')} onChange={(v) => actions.setTone(uuid, { balance: v })} />
              )}
              <Switch checked={Boolean(zone.loudness)} label={t('desk.prefs.loudness')} onChange={(on) => actions.setTone(uuid, { loudness: on })} />
              {extraKeys.length > 0 && (
                <fieldset className="mg-stack mg-fieldset" disabled={busy}>
                  {extraKeys.map((k) => EQ_FLAGS.has(k) ? (
                    <Switch key={k} checked={eq[k] === 1} label={t(EQ_LABELS[k])} onChange={(on) => applyExtras({ eq: { [k]: on ? 1 : 0 } })} />
                  ) : (
                    <Tone key={k} label={t(EQ_LABELS[k])} value={eq[k]} min={EQ_RANGES[k]?.[0] ?? -10} max={EQ_RANGES[k]?.[1] ?? 10} onChange={(v) => applyExtras({ eq: { [k]: v } })} />
                  ))}
                  {'speech_level' in (extras || {}) && eq.DialogLevel === 1 && (
                    <div className="mg-setting">
                      <span className="mg-setting-label">{t('desk.room.speechLevel')}</span>
                      <Select value={extras.speech_level ?? 1} onChange={(e) => applyExtras({ speech_level: Number(e.target.value) })}>
                        {SPEECH_LEVELS.filter(([v]) => v < 4 || extras.speech_max).map(([v, key]) => <option key={v} value={v}>{t(key)}</option>)}
                      </Select>
                    </div>
                  )}
                  {Object.entries(SURROUND_DISTANCES).filter(([k]) => k in eq).map(([k, label]) => (
                    <div key={k} className="mg-setting">
                      <span className="mg-setting-label">{t(label)}</span>
                      <Select value={eq[k]} onChange={(e) => applyExtras({ eq: { [k]: Number(e.target.value) } })}>
                        {DISTANCE_CHOICES.map(([v, key]) => <option key={v} value={v}>{t(key)}</option>)}
                      </Select>
                    </div>
                  ))}
                  {'SubPolarity' in eq && (
                    <div className="mg-setting">
                      <span className="mg-setting-label">{t('desk.room.subPhase')}</span>
                      <Select value={eq.SubPolarity} onChange={(e) => applyExtras({ eq: { SubPolarity: Number(e.target.value) } })}>
                        <option value={0}>0°</option>
                        <option value={1}>180°</option>
                      </Select>
                    </div>
                  )}
                </fieldset>
              )}
              {extras && 'trueplay' in extras && (
                <Switch checked={Boolean(extras.trueplay)} label={t('desk.room.trueplay')} disabled={busy} onChange={(on) => applyExtras({ trueplay: on })} />
              )}
              <div><Button variant="outlined" size="xs" icon={<I.Refresh />} onClick={() => actions.setTone(uuid, { bass: 0, treble: 0, balance: 0, loudness: true })}>{t('desk.prefs.reset')}</Button></div>
            </div>
          )
        )}
        {tab === 'device' && (
          <div className="mg-stack">
            <div className="mg-inline">
              <TextField label={t('desk.prefs.roomName')} value={name} onChange={setName}
                         onEnter={() => { if (name.trim() && name !== zone.name) actions.rename(uuid, name.trim()) }} />
              <Button variant="filled" size="s" disabled={!name.trim() || name === zone.name} onClick={() => actions.rename(uuid, name.trim())}>{t('desk.prefs.apply')}</Button>
            </div>
            <Switch checked={Boolean(extras?.status_light)} disabled={!extras} label={t('desk.prefs.statusLight')}
                    onChange={(on) => applyExtras({ status_light: on })} />
            {extras && 'button_lock' in extras && (
              <Switch checked={!extras.button_lock} label={t('desk.room.touchControls')} disabled={busy} onChange={(on) => applyExtras({ button_lock: !on })} />
            )}
            {extras && 'tv_autoplay' in extras && (
              <div className="mg-stack">
                <Switch checked={Boolean(extras.tv_autoplay)} label={t('desk.room.tvAutoplay')} disabled={busy} onChange={(on) => applyExtras({ tv_autoplay: on })} />
                <Switch checked={Boolean(extras.tv_autoplay_ungroup)} label={t('desk.room.tvUngroup')} disabled={busy || !extras.tv_autoplay}
                        onChange={(on) => applyExtras({ tv_autoplay_ungroup: on })} />
              </div>
            )}
            {extras && 'ir_light' in extras && (
              <Switch checked={Boolean(extras.ir_light)} label={t('desk.room.irLight')} disabled={busy} onChange={(on) => applyExtras({ ir_light: on })} />
            )}
            {extras && 'ir_repeater' in extras && (
              <Switch checked={Boolean(extras.ir_repeater)} label={t('desk.room.irRepeater')} disabled={busy} onChange={(on) => applyExtras({ ir_repeater: on })} />
            )}
            {extras && 'line_in_level' in extras && (
              <>
                <TextField label={t('desk.room.lineInName')} value={lineInName} onChange={setLineInName}
                           onEnter={() => { const v = lineInName.trim(); if (v && v !== extras.line_in_name) applyExtras({ line_in_name: v }) }} />
                <Tone label={t('desk.room.lineInLevel')} value={extras.line_in_level} min={1} max={10} minLabel="1" maxLabel="10" onChange={(v) => applyExtras({ line_in_level: v })} />
              </>
            )}
            {extras && 'autoplay_room' in extras && (
              <div className="mg-setting">
                <span className="mg-setting-label">{t('desk.room.autoplayRoom')}</span>
                <Select value={extras.autoplay_room || ''} onChange={(e) => applyExtras({ autoplay_room: e.target.value })}>
                  <option value="">{t('desk.room.autoplayOff')}</option>
                  {zoneList.map((z) => <option key={z.uuid} value={z.uuid}>{z.name}</option>)}
                </Select>
                {extras.autoplay_room && (
                  <div className="mg-stack">
                    <Switch checked={Boolean(extras.autoplay_linked)} label={t('desk.room.autoplayLinked')} onChange={(on) => applyExtras({ autoplay_linked: on })} />
                    <Switch checked={Boolean(extras.autoplay_use_volume)} label={t('desk.room.autoplayUseVolume')} onChange={(on) => applyExtras({ autoplay_use_volume: on })} />
                    {extras.autoplay_use_volume && (
                      <Tone wheelStep={2} label={t('desk.room.autoplayVolume')} value={extras.autoplay_volume} min={0} max={100} minLabel="0" maxLabel="100" onChange={(v) => applyExtras({ autoplay_volume: v })} />
                    )}
                  </div>
                )}
              </div>
            )}
            {/* Only a pair, or a speaker that says it can be one (a soundbar cannot). */}
            {(zone.paired || canStereoPair(zone)) && (
            <div className="mg-setting">
              <span className="mg-setting-label">{t('desk.room.stereoPair')}</span>
              {zone.paired ? (
                <div><Button variant="outlined" size="xs" icon={<I.Unlink />} onClick={() => setConfirm('separate')}>{t('desk.room.separate')}</Button></div>
              ) : candidates.length === 0 ? <p className="mg-muted">{t('mg.noPairCandidates')}</p> : (
                <div className="mg-inline">
                  <Select value={partner} onChange={(e) => setPartner(e.target.value)}>
                    <option value="">{t('desk.room.pairWith')}</option>
                    {candidates.map((z) => <option key={z.uuid} value={z.uuid}>{z.name}</option>)}
                  </Select>
                  <Button variant="filled" size="xs" disabled={!chosen} onClick={() => setConfirm('pair')}>{t('desk.room.createPair')}</Button>
                </div>
              )}
            </div>
            )}
          </div>
        )}
        {tab === 'about' && (
          <div className="mg-card mg-card-filled mg-list">
            <ListItem overline={t('desk.about.model')} headline={zone.model} />
            <ListItem overline={t('desk.about.version')} headline={versionLabel(zone.display_version, zone.software_version)} />
            <ListItem overline={t('desk.about.system')} headline={household?.generation || ''} />
            <ListItem overline={t('desk.about.address')} headline={<span className="mg-mono">{zone.host}</span>} />
            <ListItem overline={t('mg.lineIn')} headline={zone.supports_line_in ? (zone.line_in_connected ? t('mg.connected') : t('mg.nothingConnected')) : t('mg.none')} />
          </div>
        )}
      </div>
      {confirm === 'separate' && (
        <Confirm title={t('desk.room.separate')} body={t('desk.room.separateBody', { room: zone.name })} action={t('desk.room.separate')} icon={<I.Unlink />}
                 onConfirm={() => { setConfirm(null); actions.separateStereoPair(uuid) }} onClose={() => setConfirm(null)} />
      )}
      {confirm === 'pair' && chosen && (
        <Confirm title={t('desk.room.createPair')} body={t('desk.room.pairBody', { left: zone.name, right: chosen.name })} action={t('desk.room.createPair')} icon={<I.Link />}
                 onConfirm={() => { setConfirm(null); actions.createStereoPair(uuid, chosen.uuid) }} onClose={() => setConfirm(null)} />
      )}
    </Sheet>
  )
}

// --- grouping ------------------------------------------------------------------------------

// Tick the rooms that should play together. The card at the top says what
// will play; when more than one of the merging groups has music, the dialog
// asks which should go on before anything moves.
export function GroupDialog({ group, zones, households, onClose }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const coordinator = zones[group.coordinator]
  const household = orderedHouseholds(households).find((h) => h.zone_uuids.includes(group.coordinator))
  const candidates = (household?.zone_uuids || []).map((u) => zones[u]).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name))
  const [selected, setSelected] = useState(() => new Set(group.members))
  const [picking, setPicking] = useState(null)
  const [chosen, setChosen] = useState('')
  const [askNone, setAskNone] = useState(false)
  const allSelected = candidates.every((z) => selected.has(z.uuid))
  const toggle = (uuid) => {
    const next = new Set(selected)
    if (next.has(uuid)) next.delete(uuid); else next.add(uuid)
    setSelected(next)
  }
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
  if (group.local) {
    return (
      <Confirm title={t('local.cannotGroup.title')} body={t('local.cannotGroup.detail')} action={t('common.ok')} icon={<I.Group />}
               onConfirm={onClose} onClose={onClose} />
    )
  }
  if (askNone) {
    return (
      <Confirm title={t('desk.grouping.noneTitle')} body={t('desk.grouping.noneBody')} action={t('desk.grouping.noneYes')} icon={<I.Stop />}
               onClose={() => setAskNone(false)} onConfirm={() => { onClose(); actions.stop(group.coordinator) }} />
    )
  }
  return (
    <Sheet kind="dialog" title={t('desk.grouping.title')} onClose={onClose} className="mg-groupdialog">
      <span className="mg-dialog-icon" aria-hidden="true"><I.Group /></span>
      <h2 className="mg-dialog-headline" data-centered="">{picking ? t('desk.grouping.pickHeading') : t('desk.grouping.title')}</h2>
      <div className="mg-dialog-body">
        {!picking ? (
          <>
            <div className="mg-card mg-card-filled mg-willplay">
              {transport.source === 'tv' ? <span className="mg-li-glyph"><I.Tv /></span>
                : <ShapeArt src={selected.size && showing ? nowPlayingArt(showing.host, transport) : ''} shape={SHAPES.cookie9} size={56} fallback="note" />}
              <div>
                <p className="mg-overline">{t('desk.grouping.willPlay')}</p>
                <p className="mg-title-m">{preview || t('common.noMusicSelected')}</p>
                {selected.size > 0 && proposed.length <= 1 && lines.line2 && <p className="mg-muted">{lines.line2}</p>}
              </div>
            </div>
            <p className="mg-muted">{t('desk.grouping.select')}</p>
            <div className="mg-list">
              {candidates.map((zone) => {
                const lead = groupLeader(zones, zone.uuid)
                const elsewhere = !group.members.includes(zone.uuid) && lead !== zone.uuid
                const own = zones[lead]?.transport
                return (
                  <label key={zone.uuid} className={cx('mg-li', 'mg-li-action', 'mg-li-check')} data-selected={selected.has(zone.uuid) || undefined}>
                    <span className="mg-state" aria-hidden="true" />
                    <span className="mg-li-lead"><span className="mg-li-glyph" style={{ clipPath: KIND_SHAPES.room }}><I.Speaker /></span></span>
                    <span className="mg-li-text">
                      <span className="mg-li-head">{zone.name}</span>
                      <span className="mg-li-sup">{zone.uuid === group.coordinator ? t('mg.thisRoom') : elsewhere ? t('mg.groupedWith', { room: zones[lead]?.name || '' }) : hasMusic(own) ? nowSummary(own, t).title : ''}</span>
                    </span>
                    <span className="mg-li-trail">
                      <span className="mg-check"><input type="checkbox" checked={selected.has(zone.uuid)} onChange={() => toggle(zone.uuid)} /><span aria-hidden="true"><I.Check /></span></span>
                    </span>
                  </label>
                )
              })}
            </div>
            <div><Button variant="tonal" size="xs" icon={allSelected ? <I.Close /> : <I.Sparkle />} onClick={() => setSelected(new Set(allSelected ? [] : candidates.map((z) => z.uuid)))}>
              {allSelected ? t('desk.grouping.unselectAll') : t('desk.grouping.partyMode')}
            </Button></div>
          </>
        ) : (
          <div className="mg-list" role="listbox">
            {picking.map((uuid) => {
              const zone = zones[uuid]
              const tr = zone?.transport ?? {}
              const two = twoLineMetadata(tr, t)
              return (
                <ListItem key={uuid} role="option" aria-selected={chosen === uuid} selected={chosen === uuid} onClick={() => setChosen(uuid)} onDoubleClick={() => applyTo(uuid)}
                          leading={<ShapeArt src={zone ? nowPlayingArt(zone.host, tr) : ''} shape={KIND_SHAPES.room} size={48} fallback="note" />}
                          headline={two.line1 || zone?.name || ''} supporting={two.line2 || zone?.name}
                          trailing={chosen === uuid ? <I.Check /> : null} />
              )
            })}
          </div>
        )}
      </div>
      <footer className="mg-dialog-actions">
        <Button variant="text" onClick={picking ? () => setPicking(null) : onClose}>{picking ? t('common.back') : t('common.cancel')}</Button>
        {picking
          ? <Button variant="filled" disabled={!chosen} onClick={() => applyTo(chosen)}>{t('common.done')}</Button>
          : <Button variant="filled" onClick={apply}>{t('common.done')}</Button>}
      </footer>
    </Sheet>
  )
}

