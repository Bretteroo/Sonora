import React, { useEffect, useState } from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { api } from '../../frontend/src/lib/api.js'
import { orderedHouseholds, twoLineMetadata } from '../../frontend/src/lib/format.js'
import { roomSections, canStereoPair } from '../../frontend/src/lib/rooms.js'
import { proposedGroups, groupingPlan, runPlan, leaderOf as groupLeader } from '../../frontend/src/lib/grouping.js'
import Art, { nowPlayingArt } from '../../frontend/src/components/Art.jsx'
import * as G from './glyphs.jsx'
import { Unit, Display, Key, IconKey, Knob, Fader, Lever, Led, Panel, PanelHead, Button, Confirm, Menu, MenuItem, MenuSep, Select, Field, Empty, KeyBank } from './controls.jsx'
import { nowSummary, hasMusic, nextTransport, togglePlay, isLoaded, householdOf, pauseEverything, canSkip, canNext } from './house.js'
import Battery, { batteryShown } from '../../frontend/src/components/Battery.jsx'
import { versionLabel } from '../../frontend/src/lib/version.js'

// The zone amplifier: one module per group, side by side in the rack. Each
// module has a small display naming the rooms and what they play, a knob for
// the group's volume, and a channel strip per room with its own fader. A
// module's name plate drags onto another module to link the two, the way a
// patch cord would.

function ZoneModule({ group, lead, members, active, showSystem, onSelect, onLink, onTone, onSleep, onDragStart, onDragEnd, dragging, onDropOn }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const tr = lead?.transport || {}
  const summary = nowSummary(tr, t)
  const what = nextTransport(tr)
  const loaded = isLoaded(tr)
  const playing = tr.state === 'PLAYING' || tr.state === 'TRANSITIONING'
  const [over, setOver] = useState(false)
  const [menu, setMenu] = useState(null)
  const grouped = members.length > 1
  const title = grouped ? `${lead.name} + ${members.length - 1}` : lead.name
  const movable = !group.local
  return (
    <article className="hf-zone" data-active={active || undefined} data-playing={playing || undefined} data-over={over || undefined}
             data-dragging={dragging === group.coordinator || undefined}
             onDragOver={(event) => { if (dragging && dragging !== group.coordinator) { event.preventDefault(); setOver(true) } }}
             onDragLeave={() => setOver(false)}
             onDrop={(event) => { event.preventDefault(); setOver(false); onDropOn(group.coordinator) }}
             onContextMenu={(event) => { event.preventDefault(); setMenu({ x: event.clientX, y: event.clientY }) }}>
      <header className="hf-zone-plate" draggable={movable}
              onDragStart={movable ? (event) => { event.dataTransfer.setData('text/plain', group.coordinator); event.dataTransfer.effectAllowed = 'move'; onDragStart(group.coordinator) } : undefined}
              onDragEnd={onDragEnd} title={movable ? t('hifi.dragToLink') : undefined}>
        <Led on={active} />
        <h3 title={members.map((m) => m.name).join(', ')}>{title}</h3>
        {/* A portable room's battery, engraved on its plate beside the name. */}
        {!grouped && batteryShown(lead) && <Battery battery={lead.battery} className="hf-zone-battery" />}
        {showSystem && lead.generation && <span className="hf-tag">{lead.generation}</span>}
        <IconKey label={t('desk.browse.actions')} onClick={(event) => setMenu({ x: event.clientX, y: event.clientY })}><G.Ellipsis /></IconKey>
      </header>
      <div className="hf-zone-face">
        <button type="button" className="hf-zone-window" onClick={() => onSelect(group.coordinator)} title={t('hifi.selectZone')}>
          <Display className="hf-zone-display">
            <span className="hf-zone-art">{tr.source === 'tv' ? <G.Tv /> : <Art src={nowPlayingArt(lead.host, tr)} size={44} fallback="note" />}</span>
            <span className="hf-zone-lines">
              <span className="hf-zone-title">{summary.title || t('common.noMusicSelected')}</span>
              <span className="hf-zone-sub">{summary.sub || tr.service_name || ''}</span>
            </span>
          </Display>
        </button>
        <div className="hf-zone-controls">
          <Knob value={lead.group_volume ?? 0} onCommit={(level) => actions.setGroupVolume(lead.uuid, level)}
                label={grouped ? `${t('desk.transport.groupVolume')} · ${title}` : lead.name} size="sm" showValue />
          <div className="hf-zone-keys">
            <Key label={what === 'play' ? t('common.play') : what === 'stop' ? t('common.stop') : t('common.pause')}
                 icon={what === 'play' ? <G.Play /> : what === 'stop' ? <G.Stop /> : <G.Pause />} disabled={!loaded}
                 led={playing} onClick={() => togglePlay(actions, lead)} size="xs" />
            <Key label={t('common.next')} icon={<G.Next />} disabled={!canNext(tr)} onClick={() => actions.next(lead.uuid)} size="xs" />
            <Key label={lead.group_muted ? t('common.unmute') : t('common.mute')} icon={lead.group_muted ? <G.Muted /> : <G.Volume />}
                 led={Boolean(lead.group_muted)} tone="danger" onClick={() => actions.setMute(lead.uuid, !lead.group_muted, true)} size="xs" />
            {!group.local && <Key label={t('desk.grouping.title')} icon={<G.Link />} onClick={() => onLink(group)} size="xs" />}
            <Key label={t('hifi.selectZone')} legend={t('hifi.select')} icon={<G.Speaker />} led={active} onClick={() => onSelect(group.coordinator)} size="xs" />
          </div>
        </div>
      </div>
      <ul className="hf-strips">
        {members.map((m) => (
          // A room on its own is named on the module's plate already, so its
          // strip is only the controls; in a group each strip names its room
          // on a line of its own, whole, above them.
          <li key={m.uuid} className="hf-strip" data-grouped={grouped || undefined} data-offline={m.online === false || undefined}>
            {grouped && (
              <span className="hf-strip-name">
                {m.name}
                <small>{m.model}{m.paired ? ` · ${t('desk.room.stereoPair')}` : ''}{m.online === false ? ` · ${t('desk.rooms.offline')}` : ''}{batteryShown(m) && <>{' · '}<Battery battery={m.battery} className="hf-zone-battery" /></>}</small>
              </span>
            )}
            <IconKey className="hf-strip-mute" label={m.muted ? t('common.unmute') : t('common.mute')} active={Boolean(m.muted)} onClick={() => actions.setMute(m.uuid, !m.muted)}>
              {m.muted ? <G.Muted /> : <G.Volume />}
            </IconKey>
            <Fader wheelStep={2} className="hf-strip-fader" value={m.volume ?? 0} label={m.name} onCommit={(level) => actions.setVolume(m.uuid, level)} />
            <output className="hf-strip-level">{m.volume ?? 0}</output>
            {grouped && <IconKey className="hf-strip-leave" label={t('hifi.leaveGroup', { room: m.name })} onClick={() => actions.leave(m.uuid)}><G.Leave /></IconKey>}
            <IconKey className="hf-strip-eq" label={t('desk.rooms.menu.eq', { name: m.name })} disabled={Boolean(m.local)} onClick={() => onTone(m.uuid)}><G.Sliders /></IconKey>
          </li>
        ))}
      </ul>
      {menu && (
        <Menu x={menu.x} y={menu.y} onClose={() => setMenu(null)} title={title}>
          <MenuItem icon={what === 'play' ? <G.Play /> : what === 'stop' ? <G.Stop /> : <G.Pause />} disabled={!loaded}
                    onSelect={() => { setMenu(null); togglePlay(actions, lead) }}>
            {t(what === 'play' ? 'desk.rooms.menu.play' : what === 'stop' ? 'desk.rooms.menu.stop' : 'desk.rooms.menu.pause', { name: grouped ? t('desk.rooms.menu.group') : lead.name })}
          </MenuItem>
          <MenuItem icon={lead.group_muted ? <G.Volume /> : <G.Muted />} onSelect={() => { setMenu(null); actions.setMute(lead.uuid, !lead.group_muted, true) }}>
            {t(lead.group_muted ? 'desk.rooms.menu.unmute' : 'desk.rooms.menu.mute', { name: grouped ? t('desk.rooms.menu.group') : lead.name })}
          </MenuItem>
          <MenuSep />
          {!group.local && <MenuItem icon={<G.Link />} onSelect={() => { setMenu(null); onLink(group) }}>{t('desk.grouping.title')}</MenuItem>}
          <MenuItem icon={<G.Moon />} onSelect={() => { setMenu(null); onSelect(group.coordinator); onSleep() }}>{t('desk.browse.sleepTimer')}</MenuItem>
          <MenuSep />
          {members.map((m) => (m.local ? null : (
            <MenuItem key={m.uuid} icon={<G.Sliders />} onSelect={() => { setMenu(null); onTone(m.uuid) }}>{t('desk.rooms.menu.eq', { name: m.name })}</MenuItem>
          )))}
        </Menu>
      )}
    </article>
  )
}

export default function ZonesUnit({ groups, zones, households, systemFilter, activeId, onSelect, onLink, onTone, onSleep, onMessage, systemSwitch }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  const [dragging, setDragging] = useState(null)
  const [busy, setBusy] = useState(false)
  // This browser belongs to no system, and the shared sections give it a bank
  // of its own; here it joins the last bank instead, as its last module.
  const sections = (() => {
    const all = roomSections({ groups, zones, households, systemFilter })
    const local = all.filter((sec) => !sec.household)
    const banks = all.filter((sec) => sec.household)
    if (!local.length || !banks.length) return all
    const last = banks[banks.length - 1]
    return [...banks.slice(0, -1), { ...last, rows: [...last.rows, ...local.flatMap((sec) => sec.rows)] }]
  })()
  const many = sections.filter((s) => s.household).length > 1
  const activeZone = zones[activeId] || null
  const household = activeZone ? householdOf(households, activeZone.uuid) : null
  const anyPlaying = groups.some((g) => zones[g.coordinator]?.transport?.state === 'PLAYING')
  const dropOn = async (target) => {
    const from = dragging
    setDragging(null)
    if (!from || from === target) return
    const source = groups.find((g) => g.coordinator === from)
    const dest = groups.find((g) => g.coordinator === target)
    if (!source || !dest) return
    if (source.local || dest.local) { onMessage?.(t('local.cannotGroup.detail')); return }
    if (source.household !== dest.household) { onMessage?.(t('hifi.linkAcrossSystems')); return }
    for (const uuid of source.members) await actions.join(uuid, target)
    onSelect(target)
  }
  // Party mode: every room of the zone in view's system joins it.
  const partyMode = async () => {
    if (!activeZone || !household) return
    setBusy(true)
    for (const uuid of household.zone_uuids) {
      if (!zones[uuid] || uuid === activeZone.uuid) continue
      const g = groups.find((gr) => gr.members.includes(uuid))
      if (g && g.coordinator === activeZone.uuid) continue
      await actions.join(uuid, activeZone.uuid)
    }
    setBusy(false)
  }
  return (
    <Unit className="hf-zones-unit" name={t('hifi.unit.zones')} model={t.plural('common.rooms', groups.reduce((n, g) => n + g.members.length, 0))}>
      <div className="hf-unit-toolbar">
        <Key legend={t('desk.rooms.pauseAll')} label={t('desk.rooms.pauseAll')} icon={<G.Pause />} disabled={!anyPlaying}
             onClick={() => pauseEverything(actions, groups, zones)} size="sm" />
        <Key legend={t('hifi.party')} label={t('hifi.partyHint')} icon={<G.Party />} disabled={!activeZone || busy || !household || household.zone_uuids.length < 2}
             onClick={partyMode} size="sm" />
        <span className="hf-grow" />
        {groups.filter((g) => !g.local).length > 1 && <p className="hf-hint hf-hint-drag">{t('hifi.dragToLink')}</p>}
        {systemSwitch}
      </div>
      {sections.map((section) => {
        const label = many && section.household ? section.household.generation : ''
        return (
          <section key={section.key} className="hf-zone-bank">
            {label && <h3 className="hf-bank-title">{label}</h3>}
            {section.rows.length === 0 && section.household && <Empty icon={<G.Speaker />} title={t('hifi.noRooms')} />}
            <div className="hf-zone-grid">
              {/* Linked zones lead the bank, then the rooms playing alone, each
                  run in the order the system lists them, and This browser last. */}
              {[...section.rows.filter((r) => r.members.length > 1),
                ...section.rows.filter((r) => r.members.length <= 1 && !r.group.local),
                ...section.rows.filter((r) => r.group.local)].map(({ group, lead, members }) => (
                <ZoneModule key={group.id} group={group} lead={lead} members={members} active={group.coordinator === activeId} showSystem={many}
                            onSelect={onSelect} onLink={onLink} onTone={onTone} onSleep={onSleep}
                            dragging={dragging} onDragStart={setDragging} onDragEnd={() => setDragging(null)} onDropOn={dropOn} />
              ))}
            </div>
          </section>
        )
      })}
    </Unit>
  )
}

// --- tone controls: a room's own settings -------------------------------------

const EQ_LABELS = { NightMode: 'desk.room.nightSound', DialogLevel: 'desk.room.speech', SubEnable: 'desk.room.sub',
                    SubGain: 'desk.room.subLevel', SurroundEnable: 'desk.room.surround', SurroundLevel: 'desk.room.surroundLevel',
                    MusicSurroundLevel: 'desk.room.musicSurroundLevel', AudioDelay: 'desk.room.audioDelay', HeightChannelLevel: 'desk.room.heightLevel' }
const EQ_FLAGS = new Set(['NightMode', 'DialogLevel', 'SubEnable', 'SurroundEnable'])
const EQ_RANGES = { SubGain: [-15, 15], SurroundLevel: [-15, 15], MusicSurroundLevel: [-15, 15], AudioDelay: [0, 5], HeightChannelLevel: [-10, 10] }
const signed = (v) => (v > 0 ? `+${v}` : String(v))
// The settings a soundbar's speaker takes as a choice of a few: how far each
// surround sits (the speaker counts 0 as farthest), the sub's phase, and the
// strength of speech enhancement where it is apart from its switch. Each is a
// stepped knob with a pip for every stop, or a lever for the phase.
const SURROUND_DISTANCES = { AudioDelayLeftRear: 'desk.room.surroundDistanceLeft', AudioDelayRightRear: 'desk.room.surroundDistanceRight' }
const DISTANCE_CHOICES = ['desk.room.distanceFar', 'desk.room.distanceMid', 'desk.room.distanceNear']
const SPEECH_LEVELS = ['desk.room.levelLow', 'desk.room.levelMedium', 'desk.room.levelHigh', 'desk.room.levelMax']

// A labeled knob with its value under it, the way a tone control reads.
// Every control on the tone panel sits in the same cell: a label of up to
// two lines resting on the control, then the control, then its reading on
// one line. Knobs and levers share the cell's center line, so a row of them
// reads as one strip of a front panel.
function ToneKnob({ label, value, min, max, onChange, detent = true, format = signed, ends = null, ticks = null }) {
  return (
    <div className="hf-tone">
      <span className="hf-legend hf-tone-label">{label}</span>
      <div className="hf-tone-control">
        <Knob value={value ?? 0} min={min} max={max} onCommit={onChange} label={label} size="md" detent={detent} format={format} showValue ticks={ticks ?? (detent ? 11 : 6)} />
        {ends && <span className="hf-tone-ends" aria-hidden="true"><span>{ends[0]}</span><span>{ends[1]}</span></span>}
      </div>
    </div>
  )
}

function ToneLever({ label, checked, onChange, states = null, disabled = false }) {
  const { t } = useI18n()
  return (
    <div className="hf-tone">
      <span className="hf-legend hf-tone-label">{label}</span>
      <div className="hf-tone-control">
        <Lever checked={checked} label="" hint={label} disabled={disabled} onChange={onChange} />
        <span className="hf-tone-state" aria-hidden="true">{states ? states[checked ? 1 : 0] : checked ? t('desk.prefs.on') : t('desk.prefs.off')}</span>
      </div>
    </div>
  )
}

export function ToneControl({ uuid, households, onClose }) {
  const { zones, zoneList, actions } = useSystem()
  const { t } = useI18n()
  const zone = zones[uuid]
  const [tab, setTab] = useState('sound')
  const [name, setName] = useState(zone?.name || '')
  const [extras, setExtras] = useState(null)
  const [lightSet, setLight] = useState(null)
  const light = lightSet ?? Boolean(extras?.status_light)
  useEffect(() => { setLight(null) }, [uuid])
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
  const base = (model) => (model || '').replace(/ \(Gen \d\)$/, '')
  const candidates = zoneList.filter((z) => z.uuid !== zone.uuid && !z.paired && base(z.model) === base(zone.model) && canStereoPair(z) && canStereoPair(zone))
  const chosen = candidates.find((z) => z.uuid === partner)
  return (
    <Panel kind="side" title={t('desk.prefs.settingsFor', { room: zone.name })} onClose={onClose} className="hf-tonepanel">
      <PanelHead title={zone.name} sub={`${zone.model}${household ? ` · ${household.generation}` : ''}`} onClose={onClose} />
      <div className="hf-panel-body">
        <KeyBank value={tab} onChange={setTab} label={t('desk.prefs.settingsFor', { room: zone.name })} options={[
          { id: 'sound', label: t('desk.prefs.musicEq') }, { id: 'device', label: t('desk.prefs.device') }, { id: 'about', label: t('win.about.title') }]} />
        {tab === 'sound' && (zone.fixed_output ? <p className="hf-muted">{t('desk.prefs.eqFixed')}</p> : (
          <div className="hf-tone-panel">
            <div className="hf-tone-row">
              <ToneKnob label={t('desk.prefs.bass')} value={zone.bass ?? 0} min={-10} max={10} onChange={(v) => actions.setTone(uuid, { bass: v })} />
              <ToneKnob label={t('desk.prefs.treble')} value={zone.treble ?? 0} min={-10} max={10} onChange={(v) => actions.setTone(uuid, { treble: v })} />
              {zone.has_balance !== false && (
                <ToneKnob label={t('desk.prefs.balance')} value={zone.balance ?? 0} min={-100} max={100}
                        ends={[t('desk.prefs.left'), t('desk.prefs.right')]} format={(v) => (v === 0 ? '0' : v < 0 ? `L${-v}` : `R${v}`)}
                        onChange={(v) => actions.setTone(uuid, { balance: v })} />
              )}
              <ToneLever label={t('desk.prefs.loudness')} checked={Boolean(zone.loudness)} onChange={(on) => actions.setTone(uuid, { loudness: on })} />
            </div>
            {(extraKeys.length > 0 || 'trueplay' in (extras || {})) && (
              <fieldset className="hf-tone-row hf-tone-extras" disabled={busy}>
                {extraKeys.map((k) => (EQ_FLAGS.has(k) ? (
                  <ToneLever key={k} label={t(EQ_LABELS[k])} checked={eq[k] === 1} onChange={(on) => applyExtras({ eq: { [k]: on ? 1 : 0 } })} />
                ) : (
                  <ToneKnob key={k} label={t(EQ_LABELS[k])} value={eq[k]} min={EQ_RANGES[k]?.[0] ?? -10} max={EQ_RANGES[k]?.[1] ?? 10}
                            detent={(EQ_RANGES[k]?.[0] ?? -10) < 0} onChange={(v) => applyExtras({ eq: { [k]: v } })} />
                )))}
                {'speech_level' in (extras || {}) && eq.DialogLevel === 1 && (
                  <ToneKnob label={t('desk.room.speechLevel')} value={extras.speech_level ?? 1} min={1} max={extras.speech_max ? 4 : 3}
                            detent={false} ticks={extras.speech_max ? 4 : 3} format={(v) => t(SPEECH_LEVELS[v - 1] || SPEECH_LEVELS[0])}
                            onChange={(v) => applyExtras({ speech_level: v })} />
                )}
                {Object.entries(SURROUND_DISTANCES).filter(([k]) => k in eq).map(([k, label]) => (
                  <ToneKnob key={k} label={t(label)} value={eq[k]} min={0} max={2} detent={false} ticks={3}
                            format={(v) => t(DISTANCE_CHOICES[v] || DISTANCE_CHOICES[0])} onChange={(v) => applyExtras({ eq: { [k]: v } })} />
                ))}
                {'SubPolarity' in eq && (
                  <ToneLever label={t('desk.room.subPhase')} checked={eq.SubPolarity === 1} states={['0°', '180°']}
                             onChange={(on) => applyExtras({ eq: { SubPolarity: on ? 1 : 0 } })} />
                )}
                {'trueplay' in (extras || {}) && (
                  <ToneLever label={t('desk.room.trueplay')} checked={Boolean(extras.trueplay)} onChange={(on) => applyExtras({ trueplay: on })} />
                )}
              </fieldset>
            )}
            <Button quiet small icon={<G.Refresh />} onClick={() => actions.setTone(uuid, { bass: 0, treble: 0, balance: 0, loudness: true })}>{t('desk.prefs.reset')}</Button>
          </div>
        ))}
        {tab === 'device' && (
          <div className="hf-form">
            <Field label={t('desk.prefs.roomName')}>
              <div className="hf-inline">
                <input className="hf-input" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && name.trim() && name !== zone.name) actions.rename(uuid, name.trim()) }} />
                <Button small primary disabled={!name.trim() || name === zone.name} onClick={() => actions.rename(uuid, name.trim())}>{t('desk.prefs.apply')}</Button>
              </div>
            </Field>
            {/* The room's switches across the panel in a row of cells, as the
                Music EQ tab sets out its own. The light's lever is in its real
                position, read with the room's settings; it moves at once and the
                speaker is told. */}
            <fieldset className="hf-tone-row" disabled={busy}>
              <ToneLever label={t('desk.prefs.statusLight')} checked={light} disabled={!extras}
                         onChange={(on) => { setLight(on); actions.setStatusLight(uuid, on) }} />
              {extras && 'button_lock' in extras && (
                <ToneLever label={t('desk.room.touchControls')} checked={!extras.button_lock} onChange={(on) => applyExtras({ button_lock: !on })} />
              )}
              {extras && 'tv_autoplay' in extras && (
                <>
                  <ToneLever label={t('desk.room.tvAutoplay')} checked={Boolean(extras.tv_autoplay)} onChange={(on) => applyExtras({ tv_autoplay: on })} />
                  <ToneLever label={t('desk.room.tvUngroup')} checked={Boolean(extras.tv_autoplay_ungroup)} disabled={!extras.tv_autoplay}
                             onChange={(on) => applyExtras({ tv_autoplay_ungroup: on })} />
                </>
              )}
              {extras && 'ir_light' in extras && (
                <ToneLever label={t('desk.room.irLight')} checked={Boolean(extras.ir_light)} onChange={(on) => applyExtras({ ir_light: on })} />
              )}
              {extras && 'ir_repeater' in extras && (
                <ToneLever label={t('desk.room.irRepeater')} checked={Boolean(extras.ir_repeater)} onChange={(on) => applyExtras({ ir_repeater: on })} />
              )}
            </fieldset>
            {extras && 'line_in_level' in extras && (
              <>
                <Field label={t('desk.room.lineInName')}>
                  <input className="hf-input" defaultValue={extras.line_in_name} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== extras.line_in_name) applyExtras({ line_in_name: v }) }} />
                </Field>
                <Field label={t('desk.room.lineInLevel')}>
                  <div className="hf-inline"><Fader value={extras.line_in_level} min={1} max={10} label={t('desk.room.lineInLevel')} onCommit={(v) => applyExtras({ line_in_level: v })} /><output className="hf-strip-level">{extras.line_in_level}</output></div>
                </Field>
              </>
            )}
            {extras && 'autoplay_room' in extras && (
              <Field label={t('desk.room.autoplayRoom')}>
                <Select value={extras.autoplay_room || ''} onChange={(e) => applyExtras({ autoplay_room: e.target.value })}>
                  <option value="">{t('desk.room.autoplayOff')}</option>
                  {zoneList.map((z) => <option key={z.uuid} value={z.uuid}>{z.name}</option>)}
                </Select>
                {extras.autoplay_room && (
                  <div className="hf-stack">
                    <Lever checked={Boolean(extras.autoplay_linked)} label={t('desk.room.autoplayLinked')} onChange={(on) => applyExtras({ autoplay_linked: on })} />
                    <Lever checked={Boolean(extras.autoplay_use_volume)} label={t('desk.room.autoplayUseVolume')} onChange={(on) => applyExtras({ autoplay_use_volume: on })} />
                    {extras.autoplay_use_volume && (
                      <div className="hf-inline"><Fader wheelStep={2} value={extras.autoplay_volume} min={0} max={100} label={t('desk.room.autoplayVolume')} onCommit={(v) => applyExtras({ autoplay_volume: v })} /><output className="hf-strip-level">{extras.autoplay_volume}</output></div>
                    )}
                  </div>
                )}
              </Field>
            )}
            {/* Only a pair, or a speaker that says it can be one (a soundbar cannot). */}
            {(zone.paired || canStereoPair(zone)) && (
            <Field label={t('desk.room.stereoPair')}>
              {zone.paired ? (
                <Button small icon={<G.Unlink />} onClick={() => setConfirm('separate')}>{t('desk.room.separate')}</Button>
              ) : candidates.length === 0 ? <p className="hf-muted">{t('hifi.noPairCandidates')}</p> : (
                <div className="hf-inline">
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
          <dl className="hf-facts">
            <dt>{t('desk.about.model')}</dt><dd>{zone.model}</dd>
            <dt>{t('desk.about.version')}</dt><dd>{versionLabel(zone.display_version, zone.software_version)}</dd>
            <dt>{t('desk.about.system')}</dt><dd>{household?.generation || ''}</dd>
            <dt>{t('desk.about.address')}</dt><dd className="hf-mono">{zone.host}</dd>
            <dt>{t('hifi.lineIn')}</dt><dd>{zone.supports_line_in ? (zone.line_in_connected ? t('hifi.connected') : t('hifi.nothingConnected')) : t('hifi.none')}</dd>
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
    </Panel>
  )
}

// --- linking rooms: the speaker selector -----------------------------------------

// A row of speaker switches, one per room of the system, as on an amplifier's
// speaker selector: up to play together. The display says what will play;
// where more than one of the merging groups has music, it asks which one
// carries on before anything moves.
export function SpeakerSelector({ group, zones, households, onClose }) {
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
      <Panel kind="center" title={t('desk.grouping.title')} onClose={onClose}>
        <PanelHead title={t('local.cannotGroup.title')} onClose={onClose} />
        <div className="hf-panel-body"><p className="hf-muted">{t('local.cannotGroup.detail')}</p></div>
      </Panel>
    )
  }
  if (askNone) {
    return (
      <Confirm title={t('desk.grouping.noneTitle')} body={t('desk.grouping.noneBody')} action={t('desk.grouping.noneYes')}
               onClose={() => setAskNone(false)} onConfirm={() => { onClose(); actions.stop(group.coordinator) }} />
    )
  }
  return (
    <Panel kind="center" title={t('desk.grouping.title')} onClose={onClose} className="hf-selectorpanel" wide>
      <PanelHead title={t('hifi.speakerSelector')} sub={t('desk.grouping.select')} onClose={onClose} />
      <div className="hf-panel-body">
        {!picking ? (
          <>
            <Display className="hf-willplay">
              <span className="hf-zone-art">{transport.source === 'tv' ? <G.Tv /> : <Art src={selected.size && showing ? nowPlayingArt(showing.host, transport) : ''} size={48} fallback="note" />}</span>
              <span className="hf-zone-lines">
                <span className="hf-vfd-caption">{t('desk.grouping.willPlay')}</span>
                <span className="hf-zone-title">{preview || t('common.noMusicSelected')}</span>
                {selected.size > 0 && proposed.length <= 1 && lines.line2 && <span className="hf-zone-sub">{lines.line2}</span>}
              </span>
            </Display>
            <div className="hf-speaker-bank">
              {candidates.map((zone, i) => {
                const lead = groupLeader(zones, zone.uuid)
                const elsewhere = !group.members.includes(zone.uuid) && lead !== zone.uuid
                const own = zones[lead]?.transport
                return (
                  <div key={zone.uuid} className="hf-speaker-switch" data-on={selected.has(zone.uuid) || undefined}>
                    <span className="hf-speaker-letter" aria-hidden="true">{String.fromCharCode(65 + (i % 26))}</span>
                    <Lever checked={selected.has(zone.uuid)} onChange={() => toggle(zone.uuid)} label={zone.name} />
                    <small>{zone.uuid === group.coordinator ? t('hifi.thisRoom') : elsewhere ? t('hifi.linkedWith', { room: zones[lead]?.name || '' }) : hasMusic(own) ? nowSummary(own, t).title : ''}</small>
                  </div>
                )
              })}
            </div>
            <Button small onClick={() => setSelected(new Set(allSelected ? [] : candidates.map((z) => z.uuid)))} icon={<G.Party />}>
              {allSelected ? t('desk.grouping.unselectAll') : t('desk.grouping.partyMode')}
            </Button>
          </>
        ) : (
          <>
            <p className="hf-confirm-body">{t('desk.grouping.pickHeading')}</p>
            <div className="hf-picklist" role="listbox">
              {picking.map((uuid) => {
                const zone = zones[uuid]
                const tr = zone?.transport ?? {}
                const two = twoLineMetadata(tr, t)
                return (
                  <button key={uuid} type="button" className="hf-pick" role="option" aria-selected={chosen === uuid} onClick={() => setChosen(uuid)} onDoubleClick={() => applyTo(uuid)}>
                    <Led on={chosen === uuid} />
                    <span className="hf-zone-art"><Art src={zone ? nowPlayingArt(zone.host, tr) : ''} size={40} fallback="note" /></span>
                    <span className="hf-zone-lines"><span className="hf-zone-title">{two.line1 || zone?.name || ''}</span><span className="hf-zone-sub">{two.line2 || zone?.name}</span></span>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>
      <footer className="hf-panel-foot">
        <Button quiet onClick={picking ? () => setPicking(null) : onClose}>{picking ? t('common.back') : t('common.cancel')}</Button>
        {picking
          ? <Button primary disabled={!chosen} onClick={() => applyTo(chosen)}>{t('common.done')}</Button>
          : <Button primary onClick={apply}>{t('common.done')}</Button>}
      </footer>
    </Panel>
  )
}
