import React, { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useI18n } from '../i18n/index.jsx'
import { api } from '../lib/api.js'
import { SCENE_PLAY_MODES, blankGroup, blankScene, isLocalSource, playModeLabel, playSource, playTitle, serviceSidOf } from '../lib/scenes.js'
import * as Icon from './Icons.jsx'
import './scene.css'

// The scene editor every theme with Scenes shares, drawn with the theme's
// tokens. A scene is one or more groups: each names the system it is on
// and gathers rooms that play the same thing, with each room's level and,
// when asked, its tone and a soundbar's modes; what the group starts; and
// its shuffle and repeat. The scene as a whole has a sleep timer and
// whether every other room is paused. Which room leads a group is
// Sonora's business (the soundbar for the television, otherwise a room
// already playing, else the first).
//
// Laid out as cards with one label column, so every row lines up: the
// name on top, the groups as tabs with one card open, a card for what the
// whole scene does, and the actions. `households` are the systems /api/scenes returns,
// each with its id, generation and rooms ({uuid, name, soundbar,
// line_in}); every group names the one its rooms are on, and a new group
// starts on `defaultHousehold`. `Select` is the dropdown the lists are
// chosen with: the browser's by default, or a theme's own. `onTry` sets
// the scene as it stands without saving it, and `onEnd` puts the rooms
// back after a try. `formId` lets a theme submit from a button outside the
// form; `heading` is false where the theme's own sheet already names the
// editor.
export default function SceneEditorPanel({ scene = null, households = [], defaultHousehold = '', onCancel, onSave, onTry = null, onEnd = null, tried = false,
                                           busy = false, formId = undefined, Select = 'select', Slider = RangeSlider, ToneSwitch = ToneToggle, ToneGlyph = Icon.Gear, menuClass = '', heading = true }) {
  const { t } = useI18n()
  const firstHh = households.some((h) => h.id === defaultHousehold) ? defaultHousehold : households[0]?.id || ''
  const [form, setForm] = useState(() => {
    const base = { ...blankScene(firstHh), ...(scene || {}) }
    const groups = (scene?.groups || []).map((g) => ({ ...g, household: g.household || firstHh, rooms: (g.rooms || []).map((r) => ({ ...r })) }))
    return { ...base, groups: groups.length ? groups : [blankGroup(firstHh)] }
  })
  // The groups are tabs, one open at a time, so a scene with several stays short.
  const [tab, setTab] = useState(0)
  const current = Math.min(tab, form.groups.length - 1)
  // The group on show: on a change of tab the one showing slides up shut, then the new one slides down open.
  const [stage, setStage] = useState({ index: current, open: true, fresh: false })
  useEffect(() => {
    if (stage.index === current) return undefined
    setStage((at) => ({ ...at, open: false }))
    const timer = setTimeout(() => setStage({ index: current, open: true, fresh: true }), 230)
    return () => clearTimeout(timer)
  }, [current]) // eslint-disable-line react-hooks/exhaustive-deps
  const switchTab = (i) => setTab(i)
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const rooms = useMemo(() => households.flatMap((h) => h.rooms || []), [households])
  const roomsOf = (hh) => households.find((h) => h.id === hh)?.rooms || []
  const order = useMemo(() => rooms.map((r) => r.uuid), [rooms])
  // Which group each room is in, so a room offered to one group is not in another.
  const groupOf = useMemo(() => {
    const out = {}
    form.groups.forEach((g, i) => g.rooms.forEach((r) => { out[r.uuid] = i }))
    return out
  }, [form.groups])
  const used = Object.keys(groupOf).length
  const patchGroup = (i, patch) => set({ groups: form.groups.map((g, j) => (j === i ? { ...g, ...patch } : g)) })
  const toggleRoom = (i, room) => {
    const group = form.groups[i]
    if (group.rooms.some((r) => r.uuid === room.uuid)) {
      const next = group.rooms.filter((r) => r.uuid !== room.uuid)
      const play = group.play?.kind === 'tv' && group.play.source === room.uuid ? null : group.play
      patchGroup(i, { rooms: next, play })
    } else {
      if (groupOf[room.uuid] !== undefined) return
      const next = [...group.rooms, { uuid: room.uuid, name: room.name, volume: 20, tone: null, soundbar: null }]
        .sort((a, b) => (order.indexOf(a.uuid) + 1 || 999) - (order.indexOf(b.uuid) + 1 || 999))
      patchGroup(i, { rooms: next })
    }
  }
  const patchRoom = (i, uuid, patch) => patchGroup(i, { rooms: form.groups[i].rooms.map((r) => (r.uuid === uuid ? { ...r, ...patch } : r)) })
  const addGroup = () => { set({ groups: [...form.groups, blankGroup(form.groups[form.groups.length - 1]?.household || firstHh)] }); setTab(form.groups.length) }
  const removeGroup = (i) => { set({ groups: form.groups.filter((_, j) => j !== i) }); setTab(Math.max(0, i - 1)) }
  const body = () => ({ ...form, name: form.name.trim(), groups: form.groups.filter((g) => g.rooms.length) })
  // A group set to a favorite or playlist needs one chosen before the scene can be saved.
  const valid = form.name.trim() && used > 0 && form.groups.every((g) => g.play?.kind !== 'item' || g.play.uri)
  // Why Save is off, on the button itself, so the reason can be read before anything is typed.
  const unsaveable = !form.name.trim() && !used ? t('scenes.saveNeedsBoth')
    : !form.name.trim() ? t('scenes.saveNeedsName') : !used ? t('scenes.saveNeedsRooms') : ''
  const canAdd = used < rooms.length && form.groups.every((g) => g.rooms.length)

  return (
    <form className="scene-form" id={formId} onSubmit={(e) => { e.preventDefault(); if (busy || !valid) return; onSave(body()) }}>
      {heading && <h3>{scene?.id ? t('scenes.editTitle') : t('scenes.addTitle')}</h3>}
      <label className="scene-name-field">
        <span className="scene-eyebrow">{t('scenes.name')}</span>
        <input id={`${formId || 'scene'}-name`} className="scene-name" type="text" value={form.name} maxLength={60} placeholder={t('scenes.namePlaceholder')} data-autofocus
               onChange={(e) => set({ name: e.target.value })} />
      </label>

      <div className="scene-tabs" role="tablist" aria-label={t('scenes.rooms')}>
        {form.groups.map((g, i) => (
          <button key={i} type="button" role="tab" className="scene-tab" aria-selected={i === current} onClick={() => switchTab(i)}>
            <span className="scene-badge">{i + 1}</span>
            <span className="scene-key-text">{form.groups.length > 1 ? t('scenes.group', { n: i + 1 }) : t('scenes.groupOne')}</span>
            {g.rooms.length > 0 && <small>{g.rooms.length}</small>}
          </button>
        ))}
        {canAdd && (
          <button type="button" className="scene-tab scene-tab-add" title={t('scenes.addGroupHint')} onClick={addGroup}>
            <Icon.Plus /><span className="scene-key-text">{t('scenes.addGroup')}</span>
          </button>
        )}
      </div>
      {/* The group on show slides shut and the next slides open; a group that is not the current one is on show only while it slides shut. */}
      <Slide key={stage.index} className="scene-group-stage" open={stage.open} fresh={stage.fresh}>
        <SceneGroup index={stage.index} group={form.groups[stage.index] || form.groups[current]} rooms={roomsOf((form.groups[stage.index] || form.groups[current]).household)} households={households} groupOf={groupOf}
                    count={form.groups.length} Select={Select} Slider={Slider} ToneSwitch={ToneSwitch} ToneGlyph={ToneGlyph} menuClass={menuClass}
                    onToggle={(room) => toggleRoom(stage.index, room)} onRoom={(uuid, patch) => patchRoom(stage.index, uuid, patch)}
                    onPatch={(patch) => patchGroup(stage.index, patch)} onRemove={() => removeGroup(stage.index)}
                    onSystem={(hh) => patchGroup(stage.index, { household: hh, rooms: [], play: null })} />
      </Slide>

      <section className="scene-card">
        <div className="scene-row">
          <span className="scene-label">{t('scenes.others')}</span>
          <div className="scene-field">
            <Toggle on={form.pause_others} onChange={(on) => set({ pause_others: on })}>{t('scenes.pauseOthers')}</Toggle>
          </div>
        </div>
      </section>

      <div className="scene-actions">
        <span className="scene-grow" />
        <button type="button" className="scene-btn" onClick={onCancel}><span className="scene-key-text">{t('common.cancel')}</span></button>
        {onTry && (tried && onEnd
          ? <button type="button" className="scene-btn" disabled={busy} onClick={onEnd}><span className="scene-key-text">{t('scenes.endTest')}</span></button>
          : <button type="button" className="scene-btn" disabled={busy || !used} onClick={() => onTry(body())}><span className="scene-key-text">{t('scenes.try')}</span></button>)}
        <button type="submit" className="scene-btn scene-btn-primary" disabled={busy || !valid} title={unsaveable || undefined}><span className="scene-key-text">{t('common.save')}</span></button>
      </div>
    </form>
  )
}

// A switch drawn as a pill: pressed when on.
// A button's words sit in a .scene-key-text span of their own, so a theme can trim the line to its capitals and center
// them on the key whatever room the font leaves above and below its letters.
function Toggle({ on, onChange, disabled = false, small = false, title = undefined, children }) {
  return (
    <button type="button" className={`scene-pill${small ? ' scene-pill-small' : ''}`} aria-pressed={on} disabled={disabled} title={title}
            onClick={() => onChange(!on)}>
      <Check /><span className="scene-key-text">{children}</span>
    </button>
  )
}


function Check() {
  return <svg className="scene-pill-check" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.5l2.6 2.5L10 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

// The gear at the end of a room's line that opens its tone, turning as it
// opens and turning back as it shuts; the theme brings its own gear.
function ToneButton({ Glyph, shown, onToggle, title }) {
  return (
    <button type="button" className="scene-caret" aria-expanded={shown} onClick={onToggle} title={title} aria-label={title}>
      {/* Turned as an HTML box, not as the drawing, so the browser can run the turn on its own while the page lays out the tone. */}
      <span className="scene-gear" aria-hidden="true"><Glyph aria-hidden="true" /></span>
    </button>
  )
}

// The plain tone switch, a small chip, for themes that bring none of their own.
function ToneToggle({ on, label, onChange }) {
  return <Toggle small on={on} onChange={onChange}>{label}</Toggle>
}

// The plain slider, for themes that bring none of their own.
function RangeSlider({ label, value, min, max, step, disabled = false, onChange }) {
  return (
    <span className="scene-slider" data-disabled={disabled || undefined}>
      {label && <span className="scene-slider-label">{label}</span>}
      <span className="scene-slider-track" data-center={(min < 0 && max > 0) || undefined}>
        <input type="range" data-wheel-step={step} min={min} max={max} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} />
      </span>
      <span className="scene-value">{value}</span>
    </span>
  )
}

// One group of the scene, as the open tab's card: which system it is on, its rooms
// among that system's as a row of pills, then one line per room ticked
// with its level and, opened from that line, its tone and a soundbar's
// modes; what it plays; shuffle and repeat. Kept short on purpose: a house
// with many rooms would otherwise make the editor a long scroll.
function SceneGroup({ index, group, rooms, households, groupOf, count, Select, Slider = RangeSlider, ToneSwitch = ToneToggle, ToneGlyph = Icon.Gear, menuClass, onToggle, onRoom, onPatch, onRemove, onSystem }) {
  const { t } = useI18n()
  const mine = Object.fromEntries(group.rooms.map((r) => [r.uuid, r]))
  const byUuid = Object.fromEntries(rooms.map((r) => [r.uuid, r]))
  // Rooms the household no longer has stay in the scene (it applies around a
  // missing speaker) and are listed after the household's, marked.
  const missing = group.rooms.filter((r) => !byUuid[r.uuid])
  const soundbars = rooms.filter((r) => r.soundbar && mine[r.uuid])
  const lineInRooms = rooms.filter((r) => r.line_in)
  const itemKind = (play) => (play?.item_kind === 'playlist' || /savedqueues\.rsq/i.test(play?.uri || '') ? 'playlist' : 'favorite')
  const kind = group.play?.kind === 'item' ? itemKind(group.play) : group.play?.kind || 'keep'
  // The group's play duration is kept in minutes; the hours and minutes boxes each change their part of it.
  // Two digits at most in either box, and nothing but digits.
  const digits = (value) => value.replace(/\D/g, '').slice(0, 2)
  // The duration and the delay are each kept in minutes; the hours and
  // minutes boxes each change their part of it.
  const setMinutes = (field) => (hours, minutes) => {
    const clamp = (v, top) => Math.max(0, Math.min(top, Math.round(Number(v) || 0)))
    const h = hours === null ? Math.floor((group[field] || 0) / 60) : clamp(hours, 24)
    const m = minutes === null ? (group[field] || 0) % 60 : clamp(minutes, 59)
    const total = h * 60 + m
    onPatch({ [field]: total > 0 ? Math.min(total, 1440) : null })
  }
  const setDuration = setMinutes('sleep')
  const setDelay = setMinutes('delay')
  // Which rooms' tone and soundbar settings are open; a room setting either starts open.
  const [opened, setOpened] = useState({})
  const setPlay = (next) => {
    if (next === 'keep') { onPatch({ play: null }); return }
    if (next === 'tv') { onPatch({ play: { kind: 'tv', source: soundbars.some((r) => r.uuid === group.play?.source) ? group.play.source : soundbars[0]?.uuid || '' } }); return }
    if (next === 'line_in') { onPatch({ play: { kind: 'line_in', source: group.play?.source || lineInRooms[0]?.uuid || '' } }); return }
    if (next === 'silence') { onPatch({ play: { kind: 'silence' } }); return }
    if (kind !== next) onPatch({ play: { kind: 'item', uri: '', metadata: '', title: '', art: '', item_kind: next, service: '' } })
  }
  const choices = useMusicChoices(households.find((h) => h.id === group.household))
  const lines = useSlidingList(group.rooms, (r) => r.uuid)
  // The row's label sits level with the first line of text in its field,
  // so with the Volume row that is the first room's line, or the switch
  // alone while the rooms keep their own settings. For the switch to be
  // first, the tucked-in lines leave the page once their slide is done, and
  // come back in two steps so they still slide open (a block that is off the
  // page cannot start a slide); while they are on
  // their way the label keeps to the switch, and it glides between the two
  // places rather than jumping.
  const kept = Boolean(group.keep_levels)
  const [linesAt, setLinesAt] = useState(kept ? 'away' : 'open')
  useEffect(() => {
    if (!kept) {
      setLinesAt((at) => (at === 'open' ? at : 'opening'))
      const timer = setTimeout(() => setLinesAt('open'), 20)
      return () => clearTimeout(timer)
    }
    setLinesAt((at) => (at === 'away' ? at : 'closing'))
    const timer = setTimeout(() => setLinesAt('away'), 260)
    return () => clearTimeout(timer)
  }, [kept])
  const volumeLabel = useRef(null), labelTop = useRef(null)
  useLayoutEffect(() => {
    const el = volumeLabel.current
    // The label changes row as the lines start to shut and as they start to open: from where it was to where it now is.
    if (!el || labelTop.current == null || (linesAt !== 'closing' && linesAt !== 'open')) return
    const was = labelTop.current
    el.getAnimations().forEach((a) => a.cancel())
    const delta = was - el.getBoundingClientRect().top
    if (Math.abs(delta) > 0.5 && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      el.animate([{ transform: `translateY(${delta}px)` }, { transform: 'none' }], { duration: 240, easing: 'ease' })
    }
  }, [linesAt])
  useLayoutEffect(() => { const el = volumeLabel.current; if (el) labelTop.current = el.getBoundingClientRect().top })
  // The switch's line is as tall as the Music row's control, so the two rows
  // are the same height; the control's height is the theme's to set.
  const volumeRow = useRef(null), musicRow = useRef(null)
  // Each room's name and gear keep to the volume slider's row: the line
  // carries that row's height, so when the bass and treble open on a row of
  // their own beneath it, neither name nor gear moves.
  useLayoutEffect(() => {
    const row = volumeRow.current
    if (!row) return undefined
    const pairs = [...row.querySelectorAll('.scene-level')].map((line) => [line, line.querySelector('.scene-level-sliders > :first-child')]).filter(([, v]) => v)
    const fit = () => pairs.forEach(([line, v]) => line.style.setProperty('--sc-volume-h', `${v.offsetHeight}px`))
    fit()
    const watch = new ResizeObserver(fit)
    pairs.forEach(([, v]) => watch.observe(v))
    return () => watch.disconnect()
  }, [lines.length, group.rooms.length])
  useLayoutEffect(() => {
    const control = musicRow.current?.firstElementChild, row = volumeRow.current
    if (!control || !row) return undefined
    const fit = () => row.style.setProperty('--sc-control-h', `${control.offsetHeight}px`)
    fit()
    const watch = new ResizeObserver(fit)
    watch.observe(control)
    return () => watch.disconnect()
  }, [])
  // The triangle and the source beside the kind of music fade in and out;
  // while fading out they keep showing the kind just left.
  const isItem = kind === 'favorite' || kind === 'playlist'
  const hasPair = isItem || ((kind === 'tv' || kind === 'line_in') && (kind === 'tv' ? soundbars : lineInRooms).length > 0)
  const pair = usePresence(hasPair, 200)
  const lastPairKind = useRef(kind)
  if (hasPair) lastPairKind.current = kind
  const pairKind = lastPairKind.current
  const choose = (uri) => {
    const item = (choices || []).find((row) => row.uri === uri)
    if (item) onPatch({ play: { kind: 'item', uri: item.uri, metadata: item.metadata || '', title: item.title, art: item.art || '', item_kind: item.kind || '', service: item.service_name || '' } })
  }
  return (
    <section className="scene-card scene-group" role="tabpanel">
      {count > 1 && (
      <header className="scene-card-head">
        <span className="scene-grow" />
        <button type="button" className="scene-link" onClick={onRemove}>{t('scenes.removeGroup')}</button>
      </header>
      )}

      <div className="scene-row">
        <span className="scene-label scene-label-system">
          <span>{t('scenes.rooms')}</span>
          {households.length > 1 && (
            // Which system's rooms the group is built from; a household of one generation has nothing to choose.
            <Select className="scene-system" value={group.household} aria-label={t('desk.showSystem')}
                    onChange={(e) => { if (e.target.value !== group.household) onSystem(e.target.value) }}>
              {households.map((h) => <option key={h.id} value={h.id}>{h.generation}</option>)}
            </Select>
          )}
        </span>
        <div className="scene-field scene-pills">
          {rooms.map((room) => {
            const elsewhere = !mine[room.uuid] && groupOf[room.uuid] !== undefined
            return (
              <Toggle key={room.uuid} on={Boolean(mine[room.uuid])} disabled={elsewhere} onChange={() => onToggle(room)}
                      title={elsewhere ? t('scenes.inGroup', { n: groupOf[room.uuid] + 1 }) : undefined}>{room.name}</Toggle>
            )
          })}
          {missing.map((room) => (
            <Toggle key={room.uuid} on onChange={() => onToggle(room)} title={t('scenes.roomMissing')}>{room.name || room.uuid}</Toggle>
          ))}
        </div>
      </div>

      {/* The volume row is always there, its switch included; each room's line slides in and out as the room is ticked. */}
      <div className="scene-row" ref={volumeRow}>
          <span className="scene-label" ref={volumeLabel}>{t(group.rooms.length > 1 ? 'scenes.volumes' : 'scenes.volume')}</span>
          <div className="scene-field scene-levels">
            {/* The room lines slide away while the rooms keep their own settings, and back when they stop. */}
            <Slide className="scene-level-lines" open={linesAt === 'open'} data-kept={linesAt !== 'open' || undefined} data-away={(linesAt === 'away' || lines.length === 0) || undefined}>
            {lines.map(({ item: me, open, fresh, leaving }) => {
              const room = byUuid[me.uuid]
              const shown = opened[me.uuid] ?? Boolean(me.tone || me.soundbar)
              // Flat and loud until a control is moved; the room's tone is only set by the scene once one is.
              const tone = me.tone || { bass: 0, treble: 0, loudness: true }
              const bar = me.soundbar || { night_mode: false, speech: false }
              return (
                <Slide key={me.uuid} className="scene-level-slot" open={open} fresh={fresh} aria-hidden={leaving || undefined}>
                <div className="scene-level">
                  <span className="scene-level-name">{me.name || room?.name || me.uuid}</span>
                  {/* Opened, the bass and treble share the line with the volume: half the width to the volume, a quarter each to them. */}
                  <span className="scene-level-sliders">
                    <Slider value={me.volume ?? 20} min={0} max={100} step={2} onChange={(v) => onRoom(me.uuid, { volume: v })} />
                    <ToneInline shown={shown}>
                      <Slider label={t('desk.prefs.bass')} value={tone.bass} min={-10} max={10} step={1} onChange={(v) => onRoom(me.uuid, { tone: { ...tone, bass: v } })} />
                      <Slider label={t('desk.prefs.treble')} value={tone.treble} min={-10} max={10} step={1} onChange={(v) => onRoom(me.uuid, { tone: { ...tone, treble: v } })} />
                    </ToneInline>
                  </span>
                  <ToneButton Glyph={ToneGlyph} shown={shown} onToggle={() => setOpened({ ...opened, [me.uuid]: !shown })}
                              title={room?.soundbar ? `${t('scenes.tone')}, ${t('scenes.soundbar')}` : t('scenes.tone')} />
                  <ToneDrawer shown={shown}>
                    <div className="scene-level-extra">
                      <ToneSwitch kind="loudness" label={t('desk.prefs.loudness')} on={tone.loudness} onChange={(on) => onRoom(me.uuid, { tone: { ...tone, loudness: on } })} />
                      {room?.soundbar && <ToneSwitch kind="night" label={t('scenes.nightMode')} on={bar.night_mode} onChange={(on) => onRoom(me.uuid, { soundbar: { ...bar, night_mode: on } })} />}
                      {room?.soundbar && <ToneSwitch kind="speech" label={t('scenes.speech')} on={bar.speech} onChange={(on) => onRoom(me.uuid, { soundbar: { ...bar, speech: on } })} />}
                    </div>
                  </ToneDrawer>
                </div>
                </Slide>
              )
            })}
            </Slide>
            <div className="scene-level-foot">
              <Toggle on={Boolean(group.keep_levels)} title={t('scenes.captureHint')} onChange={(on) => onPatch({ keep_levels: on })}>
                {t('scenes.capture')}
              </Toggle>
            </div>
          </div>
      </div>

      <div className="scene-row">
        <span className="scene-label">{t('scenes.music')}</span>
        <div className="scene-field">
          {/* The kind of music, and for a television or line-in with more
              than one to choose from, the room it comes from to its right. */}
          <span className="scene-music-row" ref={musicRow}>
            <Select value={kind} aria-label={t('scenes.music')} onChange={(e) => setPlay(e.target.value)}>
              <option value="keep">{t('scenes.play.keep')}</option>
              <option value="favorite">{t('scenes.play.favorite')}</option>
              <option value="playlist">{t('scenes.play.playlist')}</option>
              {soundbars.length > 0 && <option value="tv">{t('common.tv')}</option>}
              {lineInRooms.length > 0 && <option value="line_in">{t('desk.browse.lineIn')}</option>}
              <option value="silence">{t('scenes.play.silence')}</option>
            </Select>
            {pair.mounted && (
              <Fade key={pairKind} shown={pair.shown} fresh aria-hidden={!pair.shown || undefined}>
                <Icon.TriangleRight className="scene-source-arrow" aria-hidden="true" />
                {pairKind === 'favorite' || pairKind === 'playlist'
                  ? <MusicMenu t={t} choices={(choices || []).filter((row) => row.group === (pairKind === 'playlist' ? 'playlists' : 'favorites'))} loading={choices === null}
                               plain={pairKind === 'playlist'} value={group.play?.uri || ''} chosenPlay={group.play} onPick={(row) => choose(row.uri)} buttonClass={menuClass} />
                  : (pairKind === 'tv' ? soundbars : lineInRooms).length > 1
                    ? <Select value={group.play?.source || ''} aria-label={pairKind === 'tv' ? t('common.tv') : t('desk.browse.lineIn')}
                              onChange={(e) => onPatch({ play: { ...group.play, source: e.target.value } })}>
                        {(pairKind === 'tv' ? soundbars : lineInRooms).map((r) => <option key={r.uuid} value={r.uuid}>{r.name}</option>)}
                      </Select>
                    : <span className="scene-source-name">{(pairKind === 'tv' ? soundbars : lineInRooms)[0]?.name}</span>}
              </Fade>
            )}
          </span>
          {isItem && choices && choices.length === 0 && <p className="scene-note">{t('scenes.noMusic')}</p>}
        </div>
      </div>

      <div className="scene-row">
        <span className="scene-label">{t('scenes.mode')}</span>
        <div className="scene-field">
          <Select value={group.play_mode || ''} onChange={(e) => onPatch({ play_mode: e.target.value || null })}>
            <option value="">{playModeLabel(t, '')}</option>
            {SCENE_PLAY_MODES.map((m) => <option key={m} value={m}>{playModeLabel(t, m)}</option>)}
          </Select>
        </div>
      </div>

      <div className="scene-row">
        <span className="scene-label">{t('scenes.delay')}</span>
        <div className="scene-field">
          <HoursAndMinutes t={t} minutes={group.delay} onChange={setDelay} digits={digits} />
          <p className="scene-note scene-duration-note">{t(group.rooms.length === 1 ? 'scenes.delayHintOne' : 'scenes.delayHint')}</p>
        </div>
      </div>

      <div className="scene-row">
        <span className="scene-label">{t('scenes.sleep')}</span>
        <div className="scene-field">
          <HoursAndMinutes t={t} minutes={group.sleep} onChange={setDuration} digits={digits} />
          <p className="scene-note scene-duration-note">{t(group.rooms.length === 1 ? 'scenes.durationHintOne' : 'scenes.durationHint')}</p>
        </div>
      </div>
    </section>
  )
}

// What a group can start: the household's Sonos Favorites, then its Sonos
// Playlists, in one list. Read through any of its rooms, the lists being
// the household's.
// A span of time as an hours box and a minutes box, kept in minutes.
function HoursAndMinutes({ t, minutes, onChange, digits }) {
  return (
    <span className="scene-duration-wrap">
      <span className="scene-duration-part">
        <span className="scene-duration-box">
          <input type="text" className="scene-duration" inputMode="numeric" pattern="[0-9]*" maxLength={2} value={Math.floor((minutes || 0) / 60) || ''}
                 aria-label={t('scenes.hours')} onChange={(e) => onChange(digits(e.target.value), null)} />
        </span>
        <span className="scene-duration-unit">{t('scenes.hours')}</span>
      </span>
      <span className="scene-duration-part">
        <span className="scene-duration-box">
          <input type="text" className="scene-duration" inputMode="numeric" pattern="[0-9]*" maxLength={2} value={(minutes || 0) % 60 || ''}
                 aria-label={t('scenes.minutes')} onChange={(e) => onChange(null, digits(e.target.value))} />
        </span>
        <span className="scene-duration-unit">{t('scenes.minutes')}</span>
      </span>
    </span>
  )
}

// The music pop-up: a button that reads as the theme's pop-up, and a list
// of the system's favorites and playlists beneath it, each with its
// service's mark, since the browser's own list cannot carry one. The
// arrow keys move through it, Enter chooses, Escape and a click elsewhere
// close it. `buttonClass` is the theme's pop-up class, when it has one.
function MusicMenu({ t, choices, loading = false, value, chosenPlay = null, onPick, buttonClass = '', plain = false }) {
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(0)
  const wrap = useRef(null)
  const list = useRef(null)
  const chosen = (choices || []).find((row) => row.uri === value) || (value && chosenPlay) || null
  const groups = ['favorites', 'playlists'].map((g) => ({ g, items: (choices || []).filter((r) => r.group === g) })).filter((x) => x.items.length)
  const flat = groups.flatMap((x) => x.items)
  useEffect(() => {
    if (!open) return undefined
    const away = (e) => { if (!wrap.current?.contains(e.target)) setOpen(false) }
    // Escape closes the menu alone: taken before anything else hears it,
    // so the window or sheet the editor is in stays open.
    const escape = (e) => {
      if (e.key !== 'Escape') return
      e.preventDefault(); e.stopPropagation()
      setOpen(false)
      wrap.current?.querySelector('.scene-music-btn')?.focus({ preventScroll: true })
    }
    document.addEventListener('pointerdown', away)
    window.addEventListener('keydown', escape, true)
    // Focus without the browser scrolling the panel to bring the list into view.
    list.current?.focus({ preventScroll: true })
    return () => { document.removeEventListener('pointerdown', away); window.removeEventListener('keydown', escape, true) }
  }, [open])
  // The list scrolls itself to the row under the cursor; scrollIntoView
  // would scroll the panel around the menu as well.
  useEffect(() => {
    const box = list.current
    const row = box?.querySelector('[data-cursor]')
    if (!open || !box || !row) return
    const top = row.offsetTop
    if (top < box.scrollTop) box.scrollTop = top
    else if (top + row.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = top + row.offsetHeight - box.clientHeight
  }, [open, cursor])
  // The menu is a popover: shown in the browser's top layer, so a scrolling
  // panel cannot cut it off, while it stays in the editor's tree for the
  // theme's styles. It is placed under the button before the first paint,
  // hanging from the button's right edge or opening upward when the window
  // has no room the other way, and any scroll or resize closes it.
  const menu = useRef(null)
  useLayoutEffect(() => {
    const el = menu.current
    const btn = wrap.current?.querySelector('.scene-music-btn')
    if (!open || !el || !btn) return undefined
    let lifted = false
    try { el.showPopover(); lifted = true } catch { /* no popover support: the menu stays in flow, under the button */ }
    el.dataset.inflow = lifted ? '' : 'yes'
    if (lifted) {
      // Under the button, its list shortened to the room the window leaves
      // below; over it when that is less than a short list, as low on a phone.
      const b = btn.getBoundingClientRect()
      const vw = window.innerWidth, vh = window.innerHeight
      const below = vh - b.bottom - 16, above = b.top - 16
      const up = below < 160 && above > below
      const list = el.querySelector('.scene-picker-list')
      if (list) list.style.maxHeight = `${Math.max(160, Math.min(440, up ? above : below))}px`
      const m = el.getBoundingClientRect()
      const left = Math.max(8, Math.min(b.left, vw - m.width - 8))
      const top = up ? Math.max(8, b.top - 4 - m.height) : b.bottom + 4
      // Where the box lands for a given top and left is not the window's
      // own coordinates when an ancestor is scaled or moved, as the Hi-Fi
      // deck is on a small window: two placements give the mapping, and
      // the wanted spot is solved for through it.
      const landing = (x, y) => { el.style.left = `${x}px`; el.style.top = `${y}px`; const r = el.getBoundingClientRect(); return [r.left, r.top] }
      const [x1, y1] = landing(0, 0)
      const [x2, y2] = landing(100, 100)
      const kx = (x2 - x1) / 100 || 1, ky = (y2 - y1) / 100 || 1
      el.style.left = `${(left - x1) / kx}px`
      el.style.top = `${(top - y1) / ky}px`
    }
    // A scroll anywhere but inside the list, or a resize, closes it.
    const away = (e) => { if (e.type === 'scroll' && el.contains(e.target)) return; setOpen(false) }
    window.addEventListener('scroll', away, true)
    window.addEventListener('resize', away)
    return () => { window.removeEventListener('scroll', away, true); window.removeEventListener('resize', away); try { el.hidePopover() } catch { /* gone */ } }
  }, [open])
  const pick = (row) => { onPick(row); setOpen(false) }
  const toggle = () => { setCursor(Math.max(0, flat.findIndex((r) => r.uri === value))); setOpen((o) => !o) }
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) toggle(); else setCursor((c) => Math.min(flat.length - 1, c + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)) }
    else if (e.key === 'Enter' && open) { e.preventDefault(); if (flat[cursor]) pick(flat[cursor]) }
  }
  const label = chosen ? (plain ? chosen.title : playTitle(t, chosen)) : loading ? t('desk.browse.loading') : t('scenes.chooseTitle')
  return (
    <span className="scene-music-wrap" ref={wrap}>
      <button type="button" className={`scene-music-btn ${buttonClass}`.trim()} aria-haspopup="listbox" aria-expanded={open} aria-label={t('scenes.chooseTitle')}
              disabled={loading || choices.length === 0} onClick={toggle} onKeyDown={onKey}>
        {chosen && <SourceMark play={chosen} />}
        <span className="scene-music-label">{label}</span>
        <Icon.ChevronDown className="scene-music-chev" aria-hidden="true" />
      </button>
      {open && (
        <div className="scene-menu" ref={menu} popover="manual">
          <div className="scene-picker">
            <div className="scene-picker-list" role="listbox" tabIndex={-1} ref={list} onKeyDown={onKey}>
              {groups.map(({ g, items }) => (
                <React.Fragment key={g}>
                  {items.map((row) => (
                    <button key={`${g}:${row.id || row.uri}`} type="button" role="option" className="scene-picker-row" aria-selected={row.uri === value}
                            data-cursor={flat.indexOf(row) === cursor || undefined} onClick={() => pick(row)} onMouseMove={() => setCursor(flat.indexOf(row))}
                            title={row.available === false ? missingText(t, row) : undefined}>
                      <span className="scene-picker-text">
                        {plain ? <span className="scene-picker-from"><SourceMark play={row} /></span> : <SourceBadge t={t} row={row} />}
                        <span className="scene-picker-title">{row.title}</span>
                      </span>
                      {row.available === false && <Icon.Warning role="img" aria-hidden={false} aria-label={missingText(t, row)} />}
                    </button>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}
    </span>
  )
}

// The service an item comes from, by its mark and name, before the title.
// Why a row carries the warning mark: its service is not on the system, so
// the speakers have nothing to play it with. Said on hover, and to a screen
// reader in place of the mark.
function missingText(t, row) {
  return t('scenes.serviceMissing', { service: playSource(t, row) || row.service_name || '' })
}

function SourceBadge({ t, row }) {
  const name = playSource(t, row)
  if (!name) return <span className="scene-picker-from" />
  return (
    <span className="scene-picker-from">
      <SourceMark play={row} />
      <span>{name}</span>
    </span>
  )
}

// The mark of where an item comes from: the service's logo, or a playlist
// or library glyph for the speakers' own.
function SourceMark({ play }) {
  const [failed, setFailed] = useState(false)
  const sid = serviceSidOf(play)
  const Glyph = isLocalSource(play) ? (/savedqueues/i.test(play.uri) ? Icon.Playlist : Icon.Library) : Icon.serviceGlyph(sid)
  const logo = sid > 0 && !failed ? `/api/services/logo/sid/${sid}?size=32` : ''
  return logo
    ? <span className="scene-source-mark"><img src={logo} alt="" width="16" height="16" onError={() => setFailed(true)} /></span>
    : <Glyph className="scene-source-mark" />
}

// Whether something is on the page and whether it is shown: it mounts
// unseen and is shown a painted frame later, and on leaving stays, unseen,
// until its fade is over.
function usePresence(present, ms = 200) {
  const [state, setState] = useState(present ? 'in' : 'out')
  useEffect(() => {
    if (present) { setState('in'); return undefined }
    setState((at) => (at === 'out' ? at : 'leave'))
    const timer = setTimeout(() => setState('out'), ms)
    return () => clearTimeout(timer)
  }, [present, ms])
  return { mounted: state !== 'out', shown: state === 'in' }
}

// A block's height once the slides inside it are done: its height now, plus
// what each sliding part inside it has still to gain or lose. A block that
// opens with its first line measures the line's end, not its start.
function settledHeight(block) {
  let extra = 0
  for (const part of block.querySelectorAll('.scene-slide')) {
    for (const a of part.getAnimations()) {
      const frames = a.effect.getKeyframes()
      const end = parseFloat(frames[frames.length - 1]?.height)
      if (!Number.isNaN(end)) extra += end - part.getBoundingClientRect().height
    }
  }
  return block.scrollHeight + extra
}

// A block that slides open on arrival and shut on leaving. The slide runs
// from whatever height the block has at the moment, so a change of mind
// midway (a room ticked and unticked at once) reverses from there instead
// of jumping to an end and starting over.
function Slide({ open, fresh = false, className = '', children, ...rest }) {
  const ref = useRef(null)
  const been = useRef(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const first = !been.current
    been.current = true
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    // Where it stands now, read before any earlier slide is dropped: an
    // interrupted slide reverses from there. A new block starts from nothing.
    const from = first ? 0 : el.getBoundingClientRect().height
    el.getAnimations().forEach((a) => a.cancel())
    el.style.height = open ? '' : '0px'
    el.style.opacity = open ? '' : '0'
    if (still || (first && !fresh)) return
    const to = open ? settledHeight(el.firstElementChild) : 0
    const fromOpacity = to > 0 ? Math.min(1, from / to) : 1
    // It clips only while it moves, so an open block's rounded shadow is never cut square.
    el.dataset.moving = ''
    const run = el.animate([{ height: `${from}px`, opacity: fromOpacity }, { height: `${to}px`, opacity: open ? 1 : 0 }],
                           { duration: 220, easing: 'ease', fill: 'forwards' })
    // Open, the block goes back to its own height once the slide is done; shut, the slide's end holds.
    run.onfinish = () => { delete el.dataset.moving; if (open) run.cancel() }
    // A slide cut short by the next one leaves the clip to it; the cancel event arrives after the next has begun.
    run.oncancel = () => { if (!el.getAnimations().length) delete el.dataset.moving }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div ref={ref} className={`scene-slide ${className}`.trim()} data-open={open || undefined} {...rest}>
      <div className="scene-slide-inner">{children}</div>
    </div>
  )
}

// The bass and treble beside a room's volume, fading in and out with the caret.
function ToneInline({ shown, children }) {
  const at = usePresence(shown, 360)
  if (!at.mounted) return null
  return <Fade className="scene-level-tone" shown={at.shown} fresh aria-hidden={!at.shown || undefined}>{children}</Fade>
}

// The switches under a room's volume, sliding open and shut with the
// caret; off the page once shut.
function ToneDrawer({ shown, children }) {
  const at = usePresence(shown, 220)
  if (!at.mounted) return null
  return <Slide className="scene-level-extra-slot" open={at.shown} fresh>{children}</Slide>
}

// A piece that fades in on arrival and out on leaving, the same way.
function Fade({ shown, fresh = false, className = '', children, ...rest }) {
  return <span className={`scene-source-fade ${className}`.trim()} data-show={shown || undefined} data-enter={(fresh && shown) || undefined} {...rest}>{children}</span>
}

// The rows of a list as they come and go, for sliding them. Worked out in
// the render itself, so a row that has just arrived is on the page in the
// same commit as whatever opens around it; a row removed stays, shut, until
// its slide is over, then a tick drops it.
function useSlidingList(items, keyOf, ms = 220) {
  const prev = useRef(new Map())
  const gone = useRef([])
  const [, bump] = useReducer((n) => n + 1, 0)
  const nowKeys = new Set(items.map(keyOf))
  const at = Date.now()
  let index = 0
  for (const [key, item] of prev.current) {
    if (!nowKeys.has(key) && !gone.current.some((g) => g.key === key)) gone.current.push({ key, item, index, until: at + ms })
    index += 1
  }
  gone.current = gone.current.filter((g) => g.until > at && !nowKeys.has(g.key))
  // On the list's first render every row is simply there: a group just
  // switched to shows its lines in place under the crossfade, not sliding in.
  const settled = useRef(false)
  const rows = items.map((item) => ({ key: keyOf(item), item, open: true, fresh: settled.current && !prev.current.has(keyOf(item)), leaving: false }))
  settled.current = true
  for (const g of gone.current) rows.splice(Math.min(g.index, rows.length), 0, { key: g.key, item: g.item, open: false, fresh: false, leaving: true })
  useEffect(() => { prev.current = new Map(items.map((item) => [keyOf(item), item])) })
  const leaving = gone.current.length > 0
  useEffect(() => {
    if (!leaving) return undefined
    const timer = setTimeout(bump, ms + 20)
    return () => clearTimeout(timer)
  }, [leaving, ms, rows.length])
  return rows
}

// The Sonos Favorites and Sonos Playlists of a group's system, the choices
// its music pop-up offers; null while they are read.
// Kept across the group cards, which are remounted as the tabs change, so a
// group switched to has its choices at once.
const musicChoices = new Map()

function useMusicChoices(household) {
  const zone = household?.rooms?.[0]?.uuid || ''
  const [rows, setRows] = useState(() => (zone ? musicChoices.get(zone) ?? null : []))
  useEffect(() => {
    let canceled = false
    if (!zone) { setRows([]); return undefined }
    const held = musicChoices.get(zone)
    setRows(held ?? null)
    Promise.all([api.favorites(zone).catch(() => null), api.playlists(zone).catch(() => null)]).then(([fav, pl]) => {
      if (!fav && !pl) return
      const out = []
      for (const item of fav?.items || []) if (item.uri) out.push({ ...item, group: 'favorites' })
      for (const item of pl?.items || []) if (item.uri) out.push({ ...item, group: 'playlists' })
      musicChoices.set(zone, out)
      if (!canceled) setRows(out)
    })
    return () => { canceled = true }
  }, [zone])
  return rows
}
