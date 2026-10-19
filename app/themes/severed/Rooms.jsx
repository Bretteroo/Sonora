import React, { useEffect, useRef, useState } from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { api } from '../../frontend/src/lib/api.js'
import { orderedHouseholds, twoLineMetadata } from '../../frontend/src/lib/format.js'
import { roomSections, canStereoPair } from '../../frontend/src/lib/rooms.js'
import { proposedGroups, groupingPlan, runPlan, leaderOf as groupLeader } from '../../frontend/src/lib/grouping.js'
import Art, { nowPlayingArt } from '../../frontend/src/components/Art.jsx'
import Battery, { batteryShown } from '../../frontend/src/components/Battery.jsx'
import { versionLabel } from '../../frontend/src/lib/version.js'
import * as G from './glyphs.jsx'
import { Window, WindowBar, Btn, IconBtn, Bar, Toggle, Confirm, Empty, Select, Field, Row, Seg, Menu, MenuItem, Tick, cx } from './kit.jsx'
import { nowSummary, hasMusic, householdOf, nextTransport, isLoaded, togglePlay } from './house.js'

// The Rooms program: every room of the systems in view, filed by what plays
// together. Each group is a numbered bin, its rooms listed inside with their
// own levels. A bin dragged onto another joins it. A room's sound and
// settings open in a window of their own; grouping opens a window that says
// what will play before anything moves.

// In Firefox a range input inside a draggable element drags the element instead of its thumb,
// so a press on a control takes the bin's draggable away until the press ends.
function DragBin({ group, dragging, onDragStart, onDragEnd, onDropOn, className, active, children }) {
  const [over, setOver] = useState(false)
  const ref = useRef(null)
  const holdControl = (event) => {
    if (!event.target.closest('input, button, .sv-bar')) return
    const bin = ref.current
    if (!bin) return
    bin.draggable = false
    const restore = () => { bin.draggable = true; window.removeEventListener('pointerup', restore); window.removeEventListener('pointercancel', restore) }
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

// Joining one group onto another by its coordinator, as a drag between bins does here and on
// the screen's foot. Rooms of two systems, or the browser's own room, cannot join.
export function useJoin(groups, onSelect, onMessage) {
  const { actions } = useSystem()
  const { t } = useI18n()
  return async (from, target) => {
    if (!from || from === target) return
    const source = groups.find((g) => g.coordinator === from)
    const dest = groups.find((g) => g.coordinator === target)
    if (!source || !dest) return
    if (source.local || dest.local) { onMessage?.(t('local.cannotGroup.detail')); return }
    if (source.household !== dest.household) { onMessage?.(t('sv.groupAcrossSystems')); return }
    for (const uuid of source.members) await actions.join(uuid, target)
    onSelect(target)
  }
}

export default function RoomsProgram({ groups, zones, households, systemFilter, activeId, onSelect, onGroup, onRoomSettings, onPlayer, onMessage,
                                      onPauseAll, pauseDisabled = true, onParty, partyDisabled = true }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const [dragging, setDragging] = useState(null)
  const [memberMenu, setMemberMenu] = useState(null)
  const join = useJoin(groups, onSelect, onMessage)
  const dropOn = (target) => { const from = dragging; setDragging(null); join(from, target) }
  // This browser joins the last system's bins rather than starting a row of its own.
  const sections = roomSections({ groups, zones, households, systemFilter }).reduce((out, section) => {
    const last = out[out.length - 1]
    if (!section.household && last) return [...out.slice(0, -1), { ...last, rows: [...last.rows, ...section.rows] }]
    return [...out, section]
  }, [])
  const many = sections.filter((s) => s.household).length > 1
  let number = 0
  return (
    <div className="sv-rooms">
      <header className="sv-programhead">
        <div>
          <h1 className="sv-title">{t('desk.rooms.title')}</h1>
          {groups.filter((g) => !g.local).length > 1 && <p className="sv-dim">{t('sv.dragToGroup')}</p>}
        </div>
        <div className="sv-programhead-tools">
          {!pauseDisabled && <Btn size="s" icon={<G.Pause size={12} />} onClick={onPauseAll}>{t('desk.rooms.pauseAll')}</Btn>}
          {!partyDisabled && <Btn size="s" icon={<G.Sparkle size={12} />} onClick={onParty}>{t('sv.partyMode')}</Btn>}
        </div>
      </header>
      {sections.map((section) => {
        const label = many && section.household ? section.household.generation : ''
        return (
          <section key={section.key} className="sv-rooms-system">
            {label && <h2 className="sv-rule-head">{label}</h2>}
            {section.rows.length === 0 && section.household && <Empty icon={<G.Speaker size={48} />} title={t('sv.noRooms')} />}
            <div className="sv-bins">
              {section.rows.map(({ group, lead, members }) => {
                const tr = lead?.transport || {}
                const summary = nowSummary(tr, t)
                const what = nextTransport(tr)
                number += 1
                return (
                  <DragBin key={group.id} group={group} className="sv-bin" active={group.coordinator === activeId}
                           dragging={dragging} onDragStart={setDragging} onDragEnd={() => setDragging(null)} onDropOn={dropOn}>
                    <header className="sv-bin-head" role="button" tabIndex={0} onClick={() => onSelect(group.coordinator)}
                            onKeyDown={(event) => { if (event.key === 'Enter') onSelect(group.coordinator) }}>
                      <span className="sv-bin-n">{String(number).padStart(2, '0')}</span>
                      <button type="button" className="sv-art sv-bin-art" title={t('sv.openPlayer')}
                              onClick={(event) => { event.stopPropagation(); onSelect(group.coordinator); onPlayer() }}>
                        {tr.source === 'tv' ? <G.Tv size={36} /> : <Art src={lead ? nowPlayingArt(lead.host, tr) : ''} size={48} fallback="note" />}
                      </button>
                      <span className="sv-bin-text">
                        <span className="sv-bin-title">{summary.title || t('common.noMusicSelected')}</span>
                        <span className="sv-bin-sub">{summary.sub || tr.service_name || ''}</span>
                      </span>
                      <span className="sv-bin-tools" onClick={(event) => event.stopPropagation()}>
                        {lead && isLoaded(tr) && (
                          <IconBtn size="l" onClick={() => togglePlay(actions, lead)}
                                   label={what === 'play' ? t('common.play') : what === 'stop' ? t('common.stop') : t('common.pause')}>
                            <G.PlayWhat what={what} size={24} />
                          </IconBtn>
                        )}
                        {!group.local && <IconBtn size="l" label={members.length > 1 ? t('sv.editGroup') : t('sv.addRooms')} onClick={() => onGroup(group)}><G.Group size={24} /></IconBtn>}
                      </span>
                    </header>
                    <div className="sv-bin-rooms">
                      {members.length > 1 && lead && (
                        <div className="sv-member sv-member-group">
                          <span className="sv-member-name">{t('desk.transport.groupVolume')}</span>
                          <IconBtn size="s" selected={lead.group_muted} label={lead.group_muted ? t('common.unmute') : t('common.mute')}
                                   onClick={() => actions.setMute(lead.uuid, !lead.group_muted, true)}>{lead.group_muted ? <G.Muted size={24} /> : <G.Volume size={24} />}</IconBtn>
                          <Bar wheelStep={2} value={lead.group_volume ?? 0} label={t('desk.transport.groupVolume')} onCommit={(level) => actions.setGroupVolume(lead.uuid, level)} />
                          <span />
                        </div>
                      )}
                      {members.map((m) => (
                        <div key={m.uuid} className="sv-member" data-offline={m.online === false || undefined}>
                          <span className="sv-member-name">
                            <span className="sv-member-line"><span className="sn-name-text">{m.name}</span>{batteryShown(m) && <Battery battery={m.battery} className="sv-battery" />}</span>
                            <small>{m.model}{m.paired ? ` · ${t('desk.room.stereoPair')}` : ''}{m.online === false ? ` · ${t('desk.rooms.offline')}` : ''}</small>
                          </span>
                          <IconBtn size="s" selected={m.muted} label={m.muted ? t('common.unmute') : t('common.mute')}
                                   onClick={() => actions.setMute(m.uuid, !m.muted)}>{m.muted ? <G.Muted size={24} /> : <G.Volume size={24} />}</IconBtn>
                          <Bar wheelStep={2} value={m.volume ?? 0} label={m.name} onCommit={(level) => actions.setVolume(m.uuid, level)} />
                          {!(m.local && members.length < 2) && (
                            <IconBtn size="s" label={t('desk.browse.actions')}
                                     onClick={(event) => setMemberMenu({ m, grouped: members.length > 1, anchor: event.currentTarget })}><G.More size={24} /></IconBtn>
                          )}
                        </div>
                      ))}
                    </div>
                  </DragBin>
                )
              })}
            </div>
          </section>
        )
      })}
      {memberMenu && (
        <Menu anchor={memberMenu.anchor} align="right" onClose={() => setMemberMenu(null)} title={memberMenu.m.name}>
          {memberMenu.grouped && (
            <MenuItem icon={<G.Unlink size={12} />} onSelect={() => { const m = memberMenu.m; setMemberMenu(null); actions.leave(m.uuid) }}>{t('sv.leaveGroup', { room: memberMenu.m.name })}</MenuItem>
          )}
          {!memberMenu.m.local && (
            <MenuItem icon={<G.Settings size={12} />} onSelect={() => { const m = memberMenu.m; setMemberMenu(null); onRoomSettings(m.uuid) }}>{t('desk.rooms.menu.eq', { name: memberMenu.m.name })}</MenuItem>
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
// The settings a soundbar's speaker takes as a choice of a few: how far each surround sits (the
// speaker counts 0 as farthest), the sub's phase, and the strength of speech enhancement where it
// is apart from its switch.
const SURROUND_DISTANCES = { AudioDelayLeftRear: 'desk.room.surroundDistanceLeft', AudioDelayRightRear: 'desk.room.surroundDistanceRight' }
const DISTANCE_CHOICES = [[0, 'desk.room.distanceFar'], [1, 'desk.room.distanceMid'], [2, 'desk.room.distanceNear']]
const SPEECH_LEVELS = [[1, 'desk.room.levelLow'], [2, 'desk.room.levelMedium'], [3, 'desk.room.levelHigh'], [4, 'desk.room.levelMax']]

// The middle is marked, and a drag that ends near it settles on it, as the Windows theme's EQ
// does: one step of Bass or Treble, five of Balance's two hundred. Only a level centered on zero
// has a middle to settle on; Audio Delay runs 0-5 and line-in level 1-10.
const detentOf = (min, max) => Math.max(1, (max - min) / 40)
const settle = (raw, mid, detent) => (Math.abs(raw - mid) < detent ? mid : Math.round(raw))
const stepOf = (raw, min, max) => (min + max === 0 ? settle(raw, 0, detentOf(min, max)) : Math.round(raw))

function Tone({ label, value, min, max, onChange, minLabel = '-', maxLabel = '+', wheelStep = null }) {
  // The rounded value last sent, so a glide within one step sends nothing new.
  const sent = useRef(value)
  const commit = (raw) => { const n = stepOf(raw, min, max); if (n !== sent.current) { sent.current = n; onChange(n) } }
  useEffect(() => { sent.current = value }, [value])
  return (
    <div className="sv-tone">
      <span className="sv-tone-label">{label}</span>
      <span className="sv-tone-end">{minLabel}</span>
      <Bar min={min} max={max} step={0.05} value={value} label={label} wheelStep={wheelStep} onCommit={commit} center={min + max === 0}
           format={(v) => { const n = stepOf(v, min, max); return n > 0 ? `+${n}` : `${n}` }} />
      <span className="sv-tone-end">{maxLabel}</span>
    </div>
  )
}

function Setting({ label, children }) {
  return (
    <div className="sv-setting">
      <span className="sv-setting-label">{label}</span>
      <div className="sv-setting-value">{children}</div>
    </div>
  )
}

export function RoomSettings({ uuid: opened, households, onClose }) {
  const { zones, zoneList, groups, actions } = useSystem()
  const { t } = useI18n()
  // Opened for a group, the window steps through its speakers: each has its own sound and
  // settings, and the group's first is only where it starts.
  const [uuid, setUuid] = useState(opened)
  useEffect(() => { setUuid(opened) }, [opened])
  const members = ((groups || []).find((g) => g.members?.includes(opened))?.members || [])
    .map((m) => zones[m]).filter((m) => m && !m.local)
  const zone = zones[uuid]
  const [tab, setTab] = useState('sound')
  const [name, setName] = useState(zone?.name || '')
  const [extras, setExtras] = useState(null)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [partner, setPartner] = useState('')
  const [lineInName, setLineInName] = useState('')
  useEffect(() => { setName(zone?.name || '') }, [zone?.name])
  useEffect(() => { setConfirm(null); setPartner('') }, [uuid])
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
    <Window kind="panel" title={t('desk.prefs.settingsFor', { room: zone.name })} onClose={onClose} className="sv-roomsettings">
      <WindowBar title={zone.name} sub={`${zone.model}${household ? ` · ${household.generation}` : ''}`} onClose={onClose} />
      {members.length > 1 && (
        <div className="sv-window-tabs sv-roomsettings-members">
          <Seg value={uuid} onChange={setUuid} label={t('desk.rooms.title')}
               options={members.map((m) => ({ id: m.uuid, label: m.name }))} />
        </div>
      )}
      <div className="sv-window-tabs">
        <Seg value={tab} onChange={setTab} label={zone.name}
             options={[{ id: 'sound', label: t('desk.prefs.musicEq') }, { id: 'device', label: t('desk.prefs.device') }, { id: 'about', label: t('win.about.title') }]} />
      </div>
      <div className="sv-window-body">
        {tab === 'sound' && (
          zone.fixed_output ? <p className="sv-dim">{t('desk.prefs.eqFixed')}</p> : (
            <div className="sv-stack">
              <Tone label={t('desk.prefs.bass')} value={zone.bass ?? 0} min={-10} max={10} onChange={(v) => actions.setTone(uuid, { bass: v })} />
              <Tone label={t('desk.prefs.treble')} value={zone.treble ?? 0} min={-10} max={10} onChange={(v) => actions.setTone(uuid, { treble: v })} />
              {zone.has_balance !== false && (
                <Tone label={t('desk.prefs.balance')} value={zone.balance ?? 0} min={-100} max={100} minLabel={t('desk.prefs.left')} maxLabel={t('desk.prefs.right')} onChange={(v) => actions.setTone(uuid, { balance: v })} />
              )}
              <Toggle checked={Boolean(zone.loudness)} label={t('desk.prefs.loudness')} onChange={(on) => actions.setTone(uuid, { loudness: on })} />
              {extraKeys.length > 0 && (
                <fieldset className="sv-stack sv-fieldset" disabled={busy}>
                  {extraKeys.map((k) => EQ_FLAGS.has(k) ? (
                    <Toggle key={k} checked={eq[k] === 1} label={t(EQ_LABELS[k])} onChange={(on) => applyExtras({ eq: { [k]: on ? 1 : 0 } })} />
                  ) : (
                    <Tone key={k} label={t(EQ_LABELS[k])} value={eq[k]} min={EQ_RANGES[k]?.[0] ?? -10} max={EQ_RANGES[k]?.[1] ?? 10} onChange={(v) => applyExtras({ eq: { [k]: v } })} />
                  ))}
                  {'speech_level' in (extras || {}) && eq.DialogLevel === 1 && (
                    <Setting label={t('desk.room.speechLevel')}>
                      <Select value={extras.speech_level ?? 1} onChange={(e) => applyExtras({ speech_level: Number(e.target.value) })}>
                        {SPEECH_LEVELS.filter(([v]) => v < 4 || extras.speech_max).map(([v, key]) => <option key={v} value={v}>{t(key)}</option>)}
                      </Select>
                    </Setting>
                  )}
                  {Object.entries(SURROUND_DISTANCES).filter(([k]) => k in eq).map(([k, label]) => (
                    <Setting key={k} label={t(label)}>
                      <Select value={eq[k]} onChange={(e) => applyExtras({ eq: { [k]: Number(e.target.value) } })}>
                        {DISTANCE_CHOICES.map(([v, key]) => <option key={v} value={v}>{t(key)}</option>)}
                      </Select>
                    </Setting>
                  ))}
                  {'SubPolarity' in eq && (
                    <Setting label={t('desk.room.subPhase')}>
                      <Select value={eq.SubPolarity} onChange={(e) => applyExtras({ eq: { SubPolarity: Number(e.target.value) } })}>
                        <option value={0}>0°</option>
                        <option value={1}>180°</option>
                      </Select>
                    </Setting>
                  )}
                </fieldset>
              )}
              {extras && 'trueplay' in extras && (
                <Toggle checked={Boolean(extras.trueplay)} label={t('desk.room.trueplay')} disabled={busy} onChange={(on) => applyExtras({ trueplay: on })} />
              )}
              <div><Btn size="s" icon={<G.Refresh size={12} />} onClick={() => actions.setTone(uuid, { bass: 0, treble: 0, balance: 0, loudness: true })}>{t('desk.prefs.reset')}</Btn></div>
            </div>
          )
        )}
        {tab === 'device' && (
          <div className="sv-stack">
            <div className="sv-inline">
              <Field label={t('desk.prefs.roomName')} value={name} onChange={setName}
                     onEnter={() => { if (name.trim() && name !== zone.name) actions.rename(uuid, name.trim()) }} />
              <Btn variant="solid" size="s" disabled={!name.trim() || name === zone.name} onClick={() => actions.rename(uuid, name.trim())}>{t('desk.prefs.apply')}</Btn>
            </div>
            <Toggle checked={Boolean(extras?.status_light)} disabled={!extras} label={t('desk.prefs.statusLight')} onChange={(on) => applyExtras({ status_light: on })} />
            {extras && 'button_lock' in extras && (
              <Toggle checked={!extras.button_lock} label={t('desk.room.touchControls')} disabled={busy} onChange={(on) => applyExtras({ button_lock: !on })} />
            )}
            {extras && 'tv_autoplay' in extras && (
              <div className="sv-stack">
                <Toggle checked={Boolean(extras.tv_autoplay)} label={t('desk.room.tvAutoplay')} disabled={busy} onChange={(on) => applyExtras({ tv_autoplay: on })} />
                {extras.tv_autoplay && (
                  <Toggle checked={Boolean(extras.tv_autoplay_ungroup)} label={t('desk.room.tvUngroup')} disabled={busy}
                          onChange={(on) => applyExtras({ tv_autoplay_ungroup: on })} />
                )}
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
                <Field label={t('desk.room.lineInName')} value={lineInName} onChange={setLineInName}
                       onEnter={() => { const v = lineInName.trim(); if (v && v !== extras.line_in_name) applyExtras({ line_in_name: v }) }} />
                <Tone label={t('desk.room.lineInLevel')} value={extras.line_in_level} min={1} max={10} minLabel="1" maxLabel="10" onChange={(v) => applyExtras({ line_in_level: v })} />
              </>
            )}
            {extras && 'autoplay_room' in extras && (
              <Setting label={t('desk.room.autoplayRoom')}>
                <Select value={extras.autoplay_room || ''} onChange={(e) => applyExtras({ autoplay_room: e.target.value })}>
                  <option value="">{t('desk.room.autoplayOff')}</option>
                  {zoneList.map((z) => <option key={z.uuid} value={z.uuid}>{z.name}</option>)}
                </Select>
                {extras.autoplay_room && (
                  <div className="sv-stack">
                    <Toggle checked={Boolean(extras.autoplay_linked)} label={t('desk.room.autoplayLinked')} onChange={(on) => applyExtras({ autoplay_linked: on })} />
                    <Toggle checked={Boolean(extras.autoplay_use_volume)} label={t('desk.room.autoplayUseVolume')} onChange={(on) => applyExtras({ autoplay_use_volume: on })} />
                    {extras.autoplay_use_volume && (
                      <Tone wheelStep={2} label={t('desk.room.autoplayVolume')} value={extras.autoplay_volume} min={0} max={100} minLabel="0" maxLabel="100" onChange={(v) => applyExtras({ autoplay_volume: v })} />
                    )}
                  </div>
                )}
              </Setting>
            )}
            {/* Only a pair, or a speaker that says it can be one (a soundbar cannot). */}
            {(zone.paired || canStereoPair(zone)) && (
              <Setting label={t('desk.room.stereoPair')}>
                {zone.paired ? (
                  <div><Btn size="s" icon={<G.Unlink size={12} />} onClick={() => setConfirm('separate')}>{t('desk.room.separate')}</Btn></div>
                ) : candidates.length === 0 ? <p className="sv-dim">{t('sv.noPairCandidates')}</p> : (
                  <div className="sv-inline">
                    <Select value={partner} onChange={(e) => setPartner(e.target.value)}>
                      <option value="">{t('desk.room.pairWith')}</option>
                      {candidates.map((z) => <option key={z.uuid} value={z.uuid}>{z.name}</option>)}
                    </Select>
                    <Btn variant="solid" size="s" disabled={!chosen} onClick={() => setConfirm('pair')}>{t('desk.room.createPair')}</Btn>
                  </div>
                )}
              </Setting>
            )}
          </div>
        )}
        {tab === 'about' && (
          <dl className="sv-leaders sv-leaders-wide">
            <div><dt>{t('desk.about.model')}</dt><dd>{zone.model}</dd></div>
            <div><dt>{t('desk.about.version')}</dt><dd>{versionLabel(zone.display_version, zone.software_version)}</dd></div>
            <div><dt>{t('desk.about.system')}</dt><dd>{household?.generation || ''}</dd></div>
            <div><dt>{t('desk.about.address')}</dt><dd>{zone.host}</dd></div>
            <div><dt>{t('sv.lineIn')}</dt><dd>{zone.supports_line_in ? (zone.line_in_connected ? t('sv.connected') : t('sv.nothingConnected')) : t('sv.none')}</dd></div>
          </dl>
        )}
      </div>
      {confirm === 'separate' && (
        <Confirm title={t('desk.room.separate')} body={t('desk.room.separateBody', { room: zone.name })} action={t('desk.room.separate')} icon={<G.Unlink size={48} />}
                 onConfirm={() => { setConfirm(null); actions.separateStereoPair(uuid) }} onClose={() => setConfirm(null)} />
      )}
      {confirm === 'pair' && chosen && (
        <Confirm title={t('desk.room.createPair')} body={t('desk.room.pairBody', { left: zone.name, right: chosen.name })} action={t('desk.room.createPair')} icon={<G.Link size={48} />}
                 onConfirm={() => { setConfirm(null); actions.createStereoPair(uuid, chosen.uuid) }} onClose={() => setConfirm(null)} />
      )}
    </Window>
  )
}

// --- grouping ------------------------------------------------------------------------------

// Tick the rooms that should play together. The box at the top says what will play; when more
// than one of the merging groups has music, the window asks which should go on before anything
// moves.
export function GroupWindow({ group, zones, households, onClose }) {
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
    return <Confirm title={t('local.cannotGroup.title')} body={t('local.cannotGroup.detail')} action={t('common.ok')} icon={<G.Group size={48} />} onConfirm={onClose} onClose={onClose} />
  }
  if (askNone) {
    return (
      <Confirm title={t('desk.grouping.noneTitle')} body={t('desk.grouping.noneBody')} action={t('desk.grouping.noneYes')} icon={<G.Stop size={48} />}
               onClose={() => setAskNone(false)} onConfirm={() => { onClose(); actions.stop(group.coordinator) }} />
    )
  }
  return (
    <Window kind="panel" title={t('desk.grouping.title')} onClose={onClose} className="sv-groupwindow">
      <WindowBar title={picking ? t('desk.grouping.pickHeading') : t('desk.grouping.title')} onClose={onClose} />
      <div className="sv-window-body">
        {!picking ? (
          <>
            <div className="sv-willplay">
              {transport.source === 'tv' ? <G.Tv size={48} />
                : <span className="sv-art sv-willplay-art"><Art src={selected.size && showing ? nowPlayingArt(showing.host, transport) : ''} size={56} fallback="note" /></span>}
              <div>
                <p className="sv-over">{t('desk.grouping.willPlay')}</p>
                <p className="sv-strong">{preview || t('common.noMusicSelected')}</p>
                {selected.size > 0 && proposed.length <= 1 && lines.line2 && <p className="sv-dim">{lines.line2}</p>}
              </div>
            </div>
            <p className="sv-dim">{t('desk.grouping.select')}</p>
            <div className="sv-listing">
              {candidates.map((zone) => {
                const lead = groupLeader(zones, zone.uuid)
                const elsewhere = !group.members.includes(zone.uuid) && lead !== zone.uuid
                const own = zones[lead]?.transport
                return (
                  <label key={zone.uuid} className="sv-li sv-li-action sv-li-check" data-selected={selected.has(zone.uuid) || undefined}>
                    <span className="sv-li-lead"><Tick checked={selected.has(zone.uuid)} onChange={() => toggle(zone.uuid)} label={zone.name} /></span>
                    <span className="sv-li-text">
                      <span className="sv-li-title">{zone.name}</span>
                      <span className="sv-li-sub">{zone.uuid === group.coordinator ? t('sv.thisRoom') : elsewhere ? t('sv.groupedWith', { room: zones[lead]?.name || '' }) : hasMusic(own) ? nowSummary(own, t).title : ''}</span>
                    </span>
                  </label>
                )
              })}
            </div>
            <div><Btn size="s" icon={allSelected ? <G.Close size={12} /> : <G.Sparkle size={12} />} onClick={() => setSelected(new Set(allSelected ? [] : candidates.map((z) => z.uuid)))}>
              {allSelected ? t('desk.grouping.unselectAll') : t('desk.grouping.partyMode')}
            </Btn></div>
          </>
        ) : (
          <div className="sv-listing" role="listbox">
            {picking.map((uuid) => {
              const zone = zones[uuid]
              const tr = zone?.transport ?? {}
              const two = twoLineMetadata(tr, t)
              return (
                <Row key={uuid} role="option" aria-selected={chosen === uuid} selected={chosen === uuid} onClick={() => setChosen(uuid)} onDoubleClick={() => applyTo(uuid)}
                     lead={<span className="sv-art"><Art src={zone ? nowPlayingArt(zone.host, tr) : ''} size={40} fallback="note" /></span>}
                     title={two.line1 || zone?.name || ''} sub={two.line2 || zone?.name}
                     trail={chosen === uuid ? <G.Check size={24} /> : null} />
              )
            })}
          </div>
        )}
      </div>
      <footer className="sv-window-actions">
        <Btn onClick={picking ? () => setPicking(null) : onClose}>{picking ? t('common.back') : t('common.cancel')}</Btn>
        {picking
          ? <Btn variant="solid" disabled={!chosen} onClick={() => applyTo(chosen)}>{t('common.done')}</Btn>
          : <Btn variant="solid" onClick={apply}>{t('common.done')}</Btn>}
      </footer>
    </Window>
  )
}
