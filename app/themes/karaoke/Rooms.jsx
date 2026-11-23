import React, { useLayoutEffect, useRef, useState } from 'react'
import { useSystem } from '../../frontend/src/lib/store.jsx'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { orderedHouseholds, twoLineMetadata, systemChoiceMatters } from '../../frontend/src/lib/format.js'
import { roomSections } from '../../frontend/src/lib/rooms.js'
import { proposedGroups, groupingPlan, runPlan, leaderOf as groupLeader } from '../../frontend/src/lib/grouping.js'
import Art, { nowPlayingArt } from '../../frontend/src/components/Art.jsx'
import Battery, { batteryShown } from '../../frontend/src/components/Battery.jsx'
import * as G from './glyphs.jsx'
import { Window, WindowBar, Btn, IconBtn, Bar, Confirm, Empty, Row, Tick, SystemPicker } from './kit.jsx'
import { nowSummary, hasMusic, nextTransport, isLoaded, togglePlay, canAct, groupTitle } from './house.js'

// The Rooms program: every room of the systems in view, a line to each room, as the search page
// lists rooms. A room playing alone is one line: its number, its name, the song and who sings it,
// the keys for grouping and playing, and its level. Rooms that play together stand under a line
// of the group's own, which takes the number, a name counted down the page, the song, the keys,
// and the level of the whole group; every room of the group sits indented under it with its own
// level, and those levels move as the group's is moved. One band cut across the middle of the
// cover runs down all the lines of a group. Grouping opens a window that says what will play
// before anything moves.

export default function RoomsProgram({ groups, zones, households, systemFilter, onSystem, activeId, onSelect, onPlay, onGroup,
                                      onPauseAll, pauseDisabled = true, onParty, partyDisabled = true }) {
  const { actions } = useSystem()
  const { t } = useI18n()
  // This browser joins the last system's lines rather than starting a list of its own.
  const sections = roomSections({ groups, zones, households, systemFilter }).reduce((out, section) => {
    const last = out[out.length - 1]
    if (!section.household && last) return [...out.slice(0, -1), { ...last, rows: [...last.rows, ...section.rows] }]
    return [...out, section]
  }, [])
  const many = sections.filter((s) => s.household).length > 1
  // Which system's rooms are listed is chosen at the head of the page, in its far corner, and
  // only where there is more than one kind of system to choose between.
  const mixed = systemChoiceMatters(households)
  // On a phone the levels of the rooms in a group are folded away under their names until a room's
  // caret is pressed; these are the rooms opened.
  const [unfolded, setUnfolded] = useState(() => new Set())
  const unfold = (uuid) => setUnfolded((was) => {
    const next = new Set(was)
    if (next.has(uuid)) next.delete(uuid); else next.add(uuid)
    return next
  })
  // The page opens at its top, or, where the room in view would be out of sight there, scrolled to
  // put that room near the top.
  const root = useRef(null)
  useLayoutEffect(() => {
    const scroller = root.current?.closest('.km-crt-scroll')
    const picked = root.current?.querySelector('.km-roomgroup[data-active]')
    if (!scroller) return
    scroller.scrollTop = 0
    if (!picked) return
    const view = scroller.getBoundingClientRect()
    const box = picked.getBoundingClientRect()
    if (box.top >= view.top && box.bottom <= view.bottom) return
    scroller.scrollTop = Math.max(0, scroller.scrollTop + box.top - view.top - 12)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  let number = 0
  return (
    <div className="km-rooms" ref={root}>
      {(!pauseDisabled || !partyDisabled || mixed) && (
        <header className="km-programhead">
          <div />
          <div className="km-programhead-tools">
            {!pauseDisabled && <Btn size="s" icon={<G.Pause size={12} />} onClick={onPauseAll}>{t('desk.rooms.pauseAll')}</Btn>}
            {!partyDisabled && <Btn size="s" icon={<G.Sparkle size={12} />} onClick={onParty}>{t('km.partyMode')}</Btn>}
            <SystemPicker households={households} value={systemFilter} onChange={onSystem} />
          </div>
        </header>
      )}
      {sections.map((section) => {
        const label = many && section.household ? section.household.generation : ''
        if (section.rows.length === 0) {
          return section.household ? <section key={section.key}><Empty icon={<G.Speaker size={48} />} title={t('km.noRooms')} /></section> : null
        }
        return (
          <section key={section.key} className="km-rooms-system" aria-label={label || undefined}>
            {label && <h2 className="km-rooms-head">{label}</h2>}
            {section.rows.map(({ group, lead, members }) => {
              const tr = lead?.transport || {}
              const summary = nowSummary(tr, t, { album: false })
              const artist = summary.sub || (summary.title ? tr.service_name : '') || ''
              const what = nextTransport(tr)
              // The room that leads comes first; the rooms playing along with it follow.
              const rooms = lead ? [lead, ...members.filter((m) => m.uuid !== lead.uuid)] : members
              const grouped = rooms.length > 1
              // A group's own line goes above its rooms' lines; a room alone is its own line.
              const lines = grouped ? [null, ...rooms] : rooms
              const pick = () => onSelect(group.coordinator)
              // The group's keys: grouping, and play or pause.
              const toolsOf = () => (
                <span className="km-roomrow-tools" onClick={(event) => event.stopPropagation()}>
                  {group.local ? <span className="km-roomrow-none" aria-hidden="true" />
                    : <IconBtn size="s" label={grouped ? t('km.editGroup') : t('km.addRooms')} onClick={() => onGroup(group)}><G.Group size={24} /></IconBtn>}
                  <IconBtn size="s" disabled={!isLoaded(tr) || !canAct(tr)} onClick={() => (onPlay ? onPlay(lead) : togglePlay(actions, lead))}
                           label={what === 'play' ? t('common.play') : what === 'stop' ? t('common.stop') : t('common.pause')}>
                    <G.PlayWhat what={what} size={24} />
                  </IconBtn>
                </span>
              )
              // A level: Mute and the slider, for one room, or for the whole group when no room is given.
              const levelOf = (room, name) => {
                const whole = !room
                const muted = Boolean(whole ? lead?.group_muted : room.muted)
                const level = (whole ? lead?.group_volume : room.volume) ?? 0
                return (
                  <span className="km-roomrow-level" onClick={(event) => event.stopPropagation()}>
                    <IconBtn size="s" selected={muted} label={muted ? t('common.unmute') : t('common.mute')}
                             onClick={() => (whole ? actions.setMute(group.coordinator, !muted, true) : actions.setMute(room.uuid, !muted))}>
                      {muted ? <G.Muted size={24} /> : level < 40 ? <G.VolumeLow size={24} /> : <G.Volume size={24} />}
                    </IconBtn>
                    <span className="km-roomrow-bar">
                      <Bar wheelStep={2} value={level} label={whole ? t('desk.transport.groupVolume') : name}
                           onCommit={(to) => (whole ? actions.setGroupVolume(group.coordinator, to) : actions.setVolume(room.uuid, to))} />
                    </span>
                  </span>
                )
              }
              number += 1
              return (
                <div key={group.id} className="km-roomgroup" data-active={group.coordinator === activeId || undefined} data-grouped={grouped || undefined}
                     data-offline={rooms.every((room) => room.online === false) || undefined} style={{ '--km-rooms': lines.length }} onClick={pick}>
                  {lines.map((room, at) => {
                    const head = at === 0
                    const whole = !room
                    const name = whole ? t('km.mixerGroup') : grouped ? room.name : groupTitle(group, zones, t)
                    return (
                      <div key={whole ? 'group' : room.uuid} className="km-roomrow" data-member={!head || undefined} data-last={(!head && at === lines.length - 1) || undefined}
                           data-offline={(!whole && room.online === false) || undefined} style={{ '--km-at': at + 1 }}>
                        <button type="button" className="km-roomrow-main" tabIndex={head ? undefined : -1}
                                aria-current={(head && group.coordinator === activeId) || undefined}>
                          {head ? <span className="km-songno" aria-hidden="true">{String(number).padStart(2, '0')}</span>
                            : <span className="km-roomrow-elbow" aria-hidden="true" />}
                          <span className="km-roomrow-text">
                            <span className="km-roomrow-name">
                              <span className="sn-name-text">{name}</span>
                              {!whole && batteryShown(room) && <Battery battery={room.battery} className="km-battery" />}
                            </span>
                            {head && (
                              <span className="km-roomrow-now">
                                <span className="km-roomrow-song">{summary.title || t('common.noMusicSelected')}</span>
                                {artist && <span className="km-roomrow-artist">{artist}</span>}
                              </span>
                            )}
                          </span>
                        </button>
                        {head && !grouped && toolsOf()}
                        {!whole && !head && (
                          <IconBtn size="s" className="km-roomrow-caret" label={`${t('km.volume')}: ${name}`} aria-expanded={unfolded.has(room.uuid)}
                                   onClick={(event) => { event.stopPropagation(); unfold(room.uuid) }}><G.Down size={16} /></IconBtn>
                        )}
                        {!whole && (head ? levelOf(room, name) : (
                          <span className="km-roomrow-fold" data-open={unfolded.has(room.uuid) || undefined}>{levelOf(room, name)}</span>
                        ))}
                      </div>
                    )
                  })}
                  {/* A group's level is a line of its own after its rooms. A narrow list shows it there,
                      the width of the list under the cover; a wide one lifts it into the group's line. */}
                  {grouped && (
                    <div className="km-roomrow km-roomrow-sum" style={{ '--km-at': lines.length + 1 }}>
                      {toolsOf()}
                      {levelOf(null, t('km.mixerGroup'))}
                    </div>
                  )}
                  <span className="km-art km-roomrow-art" aria-hidden="true">
                    {tr.source === 'tv' ? <G.Tv size={48} /> : <Art src={lead ? nowPlayingArt(lead.host, tr) : ''} size={320} fallback="note" />}
                  </span>
                </div>
              )
            })}
          </section>
        )
      })}
    </div>
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
    <Window kind="panel" title={t('desk.grouping.title')} onClose={onClose} className="km-groupwindow">
      <WindowBar title={picking ? t('desk.grouping.pickHeading') : t('desk.grouping.title')} onClose={onClose} />
      <div className="km-window-body">
        {!picking ? (
          <>
            <div className="km-willplay">
              {transport.source === 'tv' ? <G.Tv size={48} />
                : <span className="km-art km-willplay-art"><Art src={selected.size && showing ? nowPlayingArt(showing.host, transport) : ''} size={56} fallback="note" /></span>}
              <div>
                <p className="km-over">{t('desk.grouping.willPlay')}</p>
                <p className="km-strong">{preview || t('common.noMusicSelected')}</p>
                {selected.size > 0 && proposed.length <= 1 && lines.line2 && <p className="km-dim">{lines.line2}</p>}
              </div>
            </div>
            <p className="km-dim">{t('desk.grouping.select')}</p>
            <div className="km-listing">
              {candidates.map((zone) => {
                const lead = groupLeader(zones, zone.uuid)
                const elsewhere = !group.members.includes(zone.uuid) && lead !== zone.uuid
                const own = zones[lead]?.transport
                return (
                  <label key={zone.uuid} className="km-li km-li-action km-li-check" data-selected={selected.has(zone.uuid) || undefined}>
                    <span className="km-li-lead"><Tick checked={selected.has(zone.uuid)} onChange={() => toggle(zone.uuid)} label={zone.name} /></span>
                    <span className="km-li-text">
                      <span className="km-li-title">{zone.name}</span>
                      <span className="km-li-sub">{zone.uuid === group.coordinator ? t('km.thisRoom') : elsewhere ? t('km.groupedWith', { room: zones[lead]?.name || '' }) : hasMusic(own) ? nowSummary(own, t).title : ''}</span>
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
          <div className="km-listing" role="listbox">
            {picking.map((uuid) => {
              const zone = zones[uuid]
              const tr = zone?.transport ?? {}
              const two = twoLineMetadata(tr, t)
              return (
                <Row key={uuid} role="option" aria-selected={chosen === uuid} selected={chosen === uuid} onClick={() => setChosen(uuid)} onDoubleClick={() => applyTo(uuid)}
                     lead={<span className="km-art"><Art src={zone ? nowPlayingArt(zone.host, tr) : ''} size={40} fallback="note" /></span>}
                     title={two.line1 || zone?.name || ''} sub={two.line2 || zone?.name}
                     trail={chosen === uuid ? <G.Check size={24} /> : null} />
              )
            })}
          </div>
        )}
      </div>
      <footer className="km-window-actions">
        <Btn onClick={picking ? () => setPicking(null) : onClose}>{picking ? t('common.back') : t('common.cancel')}</Btn>
        {picking
          ? <Btn variant="solid" disabled={!chosen} onClick={() => applyTo(chosen)}>{t('common.done')}</Btn>
          : <Btn variant="solid" onClick={apply}>{t('common.done')}</Btn>}
      </footer>
    </Window>
  )
}
