import { useEffect, useMemo, useState } from 'react'
import { api } from './api.js'
import { PAGE_ID } from './base.js'

// Scenes are Sonora's own (backend/sonos/scenes.py): one or more groups of
// rooms, each on the system (S1 or S2) it names, with its levels and what
// it plays, set on the speakers in one go and ended again with everything
// put back. Every scene, the systems and rooms a scene is built from, and
// which scenes are on now. Read once, again whenever the server says they
// changed (scenesEpoch) and when the rooms change.
// The last list read, so a view that mounts again (Hi-Fi rebuilds its unit
// on every visit) draws at once and refreshes behind it.
let lastScenes = null

export function useScenes(epoch = 0, roomsKey = '') {
  const [data, setData] = useState(() => lastScenes)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let canceled = false
    api.scenes().then((r) => {
      lastScenes = r || {}
      if (lastScenes.now) skew = lastScenes.now - Date.now() / 1000
      if (!canceled) setData(lastScenes)
    })
      .catch(() => { if (!canceled) setData((d) => d || {}) })
    return () => { canceled = true }
  }, [epoch, roomsKey, tick])
  // While a scene that is on has a group still waiting on its delay, the
  // list is drawn again every few seconds so its "in 3 min" counts down.
  const [now, setNow] = useState(0)
  const waiting = Object.values(data?.active || {}).some((on) => on.started)
  useEffect(() => {
    if (!waiting) return undefined
    const id = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(id)
  }, [waiting])
  const scenes = useMemo(() => orderScenes(data?.scenes || [], data?.active || {})
    .map((scene) => (data?.active?.[sceneKey(scene)] ? { ...scene, live: data.active[sceneKey(scene)] } : scene)),
  [data, now]) // eslint-disable-line react-hooks/exhaustive-deps
  return { households: data?.households || [], scenes, active: data?.active || {},
           loaded: data !== null, reload: () => setTick((v) => v + 1) }
}

// How far the server's clock is ahead of this page's, in seconds, from the
// last list read: a scene's end time is on the server's clock.
let skew = 0

// The seconds left before a scene that ends on its own does, from its `ends`.
export function sceneSecondsLeft(ends) {
  return Math.max(0, Math.ceil(ends - (Date.now() / 1000 + skew)))
}

// Seconds as a clock: "1:05:09", or "5:09" under an hour.
export function clockText(seconds) {
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60
  const two = (n) => String(n).padStart(2, '0')
  return h ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`
}

// The scenes that are on head the list, in the order they were set; the
// rest follow as they were made, which is where each goes back to when it ends.
export function orderScenes(scenes, active) {
  const when = (scene) => active[sceneKey(scene)]?.at || 0
  const on = scenes.filter((scene) => active[sceneKey(scene)]).sort((a, b) => when(a) - when(b))
  return [...on, ...scenes.filter((scene) => !active[sceneKey(scene)])]
}

// The play modes a group can set, in the order the editor offers them.
export const SCENE_PLAY_MODES = ['NORMAL', 'SHUFFLE_NOREPEAT', 'REPEAT_ALL', 'SHUFFLE', 'REPEAT_ONE', 'SHUFFLE_REPEAT_ONE']

export function sceneName(t, scene) {
  return scene?.name || ''
}

// The key a scene is on under, which its End goes by: a saved scene's id,
// or "try" for one tried from the editor.
export function sceneKey(scene) {
  return scene?.id || 'try'
}

export function playModeLabel(t, mode) {
  return t(`scenes.mode.${mode || 'keep'}`)
}

// A chosen item, named with where it comes from: "SomaFM Radio: Groove
// Salad", "Sonos Playlists: Dinner", "Music Library: Blue Train". The
// service name is kept with the scene when the item is chosen, and the
// list route names it for a scene saved without.
export function playTitle(t, play) {
  const title = play?.title || ''
  const from = playSource(t, play)
  return from && title ? `${from}: ${title}` : title || from
}

// Where an item comes from: its service's name, or the Sonos playlists or
// the music library for an item of the speakers' own.
export function playSource(t, play) {
  const uri = play?.uri || ''
  return play?.service || play?.service_name
    || (/^file:\/\/\/jffs\/settings\/savedqueues\.rsq#/i.test(uri) ? t('desk.browse.playlists') : '')
    || (/^(x-file-cifs|x-rincon-playlist):/i.test(uri) ? t('desk.browse.library') : '')
}

// The service id a service item's URI carries, as the speakers' own
// logo route wants it; 0 for an item of the speakers' own.
export function serviceSidOf(play) {
  const own = Number(play?.service_id)
  if (own > 0) return own
  return Number(/[?&]sid=(\d+)/.exec(play?.uri || '')?.[1] || 0)
}

// Whether a source is one of the speakers' own: a Sonos playlist or the library.
export function isLocalSource(play) {
  return /^(file:\/\/\/jffs\/settings\/savedqueues\.rsq#|x-file-cifs:|x-rincon-playlist:)/i.test(play?.uri || '')
}

// What a group starts, as the row under the scene's name says it.
export function playLabel(t, play) {
  // A group that leaves its rooms' music alone says so, rather than nothing.
  if (!play) return t('scenes.play.keepShort')
  if (play.kind === 'tv') return t('common.tv')
  if (play.kind === 'line_in') return t('desk.browse.lineIn')
  if (play.kind === 'silence') return t('scenes.play.silence')
  return playTitle(t, play)
}

// The minutes until a delayed group of a scene that is on starts, counted
// from when the scene was last set; null once it has started, or for a
// scene that is off (whose line says the delay itself).
export function groupStartsIn(scene, group) {
  const started = scene?.live?.started
  if (!started || !group?.delay) return null
  const left = started + group.delay * 60 - (Date.now() / 1000 + skew)
  return left > 0 ? Math.ceil(left / 60) : 0
}

// The minutes left of a group's play duration in a scene that is on, once
// the group has started; 0 when it has run out, null for a group without
// one, still waiting, or in a scene that is off.
export function groupPlaysFor(scene, group) {
  const started = scene?.live?.started
  if (!started || !group?.sleep) return null
  const now = Date.now() / 1000 + skew
  const from = started + (group.delay || 0) * 60
  if (now < from) return null
  const left = from + group.sleep * 60 - now
  return left > 0 ? Math.ceil(left / 60) : 0
}

// Every room of a scene, group by group.
export function sceneRooms(scene) {
  return (scene?.groups || []).flatMap((g) => g.rooms || [])
}

// The line under a scene's name. One group reads "Kitchen, Dining Room ·
// Jazz FM"; several read "Living Room, Dining Room: Jazz FM · Kitchen:
// Line-In", each group with what it plays. Given as
// lines, one per group, each a list of pieces of text with each room name a
// piece of its own marked `room`, for a theme that sets the names apart or
// starts each group on a line of its own. A scene of one group ends its
// line with its play duration; with several, each group says its own delay
// and duration: "(after 2 min, for 5 min)". A scene that is on says instead
// where each group is: "(in 3 min)" while it waits on its delay, "(12 more
// mins)" while it plays out its duration, and nothing once that is over or
// for a group that plays until ended.
export function sceneSummaryLines(t, scene) {
  const groups = scene?.groups || []
  const live = Boolean(scene?.live?.started)
  const rooms = (g) => (g.rooms || []).map((r) => r.name).filter(Boolean)
    .flatMap((name, i) => (i ? [{ text: ', ' }, { text: name, room: true }] : [{ text: name, room: true }]))
  const joined = (pieces) => pieces.filter((piece) => piece.length).flatMap((piece, i) => (i ? [{ text: ' · ' }, ...piece] : piece))
  const timed = groups.map((g) => g.sleep).filter(Boolean)
  // One group's duration is the scene's, said at the end of its line; with several, each says its own.
  const sleep = !live && groups.length === 1 && timed.length ? [{ text: t('scenes.sleepFor', { minutes: timed[0] }) }] : []
  const when = (g) => {
    if (!live) {
      if (groups.length === 1) return ''
      return [g.delay && t('scenes.delayFor', { minutes: g.delay }), g.sleep && t('scenes.playsFor', { minutes: g.sleep })].filter(Boolean).join(', ')
    }
    const waits = groupStartsIn(scene, g)
    if (waits) return t('scenes.delayIn', { minutes: waits })
    const plays = groupPlaysFor(scene, g)
    return plays ? t.plural('scenes.moreFor', plays) : ''
  }
  const noted = (line, g) => { const note = when(g); return note ? [...line, { text: ` (${note})` }] : line }
  let lines
  if (groups.length === 1) {
    const play = playLabel(t, groups[0].play)
    lines = [noted(joined([rooms(groups[0]), play ? [{ text: play }] : []]), groups[0])]
  } else {
    lines = groups.map((g) => {
      const play = playLabel(t, g.play)
      return noted(play ? [...rooms(g), { text: `: ${play}` }] : rooms(g), g)
    }).filter((line) => line.length)
  }
  if (sleep.length) lines = lines.length ? [...lines.slice(0, -1), joined([lines[lines.length - 1], sleep])] : [sleep]
  return lines.filter((line) => line.length)
}

// The same as one run of pieces, the lines joined with " · ".
export function sceneSummaryParts(t, scene) {
  return sceneSummaryLines(t, scene).flatMap((line, i) => (i ? [{ text: ' · ' }, ...line] : line))
}

export function sceneSummary(t, scene) {
  return sceneSummaryParts(t, scene).map((part) => part.text).join('')
}

// Apply a scene: a saved one by its id, an edited one by its body.
export async function applyScene(t, scene) {
  const report = await (scene?.id ? api.applyScene(scene.id) : api.applySceneBody(scene))
  landOn(scene, report)
  return report
}

// A scene tried from the editor, as it stands there. The test is this
// page's: ending it here, and if the page is closed or reloaded first, it
// is ended as the page goes (and by the server, should the page go without
// a word: backend/main.py, _check_test_later).
let testing = false

export async function trySceneBody(body) {
  const report = await api.applySceneBody(body)
  testing = true
  landOn(body, report)
  return report
}

export function endSceneTest() {
  testing = false
  return api.endScene(sceneKey(null))
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    if (!testing) return
    testing = false
    // keepalive lets the request outlive the page; the page id keeps it to this page's own test.
    try { fetch(`/api/scenes/try/end?page=${PAGE_ID}`, { method: 'POST', keepalive: true }) } catch { /* the server ends it once the page's socket is gone */ }
  })
}

// A scene that starts brings Sonora to its music: the rooms of its first
// group that plays something (an item, a TV, or a line-in), named in order,
// go out on this event and the shell makes the first it can find its room
// in view (lib/shellSelection.js).
export const SCENE_ROOM_EVENT = 'sonora:scene-room'
const PLAYS = new Set(['item', 'tv', 'line_in'])

export function sceneMusicRooms(scene) {
  const group = (scene?.groups || []).find((g) => PLAYS.has(g.play?.kind))
  return (group?.rooms || []).map((room) => room.uuid).filter(Boolean)
}

function landOn(scene, report) {
  const rooms = sceneMusicRooms(scene)
  if (!rooms.length || !(report?.set?.length || report?.later?.length)) return
  try { window.dispatchEvent(new CustomEvent(SCENE_ROOM_EVENT, { detail: rooms })) } catch { /* no window */ }
}

// The report, as one sentence or three: set (or ended), then the rooms not
// found, then what a speaker refused. Never an error; a scene started with
// nothing reachable says so.
export function reportText(t, scene, report, ended = false) {
  const name = sceneName(t, scene) || report?.name || ''
  if (!report) return t(ended ? 'scenes.report.endFailed' : 'scenes.report.failed', { name })
  const out = []
  // An End that put nothing back has still ended the scene: its groups had
  // not started yet, or a scene set later holds all its rooms.
  if (ended) out.push(t('scenes.report.ended', { name }))
  else if (report.set?.length || report.later?.length) out.push(t('scenes.report.set', { name }))
  else out.push(t('scenes.report.nothing', { name }))
  if (report.missing?.length) {
    out.push(report.missing.length === 1
      ? t('scenes.report.missing.one', { room: report.missing[0] })
      : t('scenes.report.missing.other', { rooms: report.missing.join(', ') }))
  }
  for (const f of report.failed || []) {
    out.push(t('scenes.report.refused', { room: f.room, step: t(`scenes.step.${f.step}`) }))
  }
  for (const l of (!ended && report.later) || []) {
    out.push(t(l.rooms.length === 1 ? 'scenes.report.later.one' : 'scenes.report.later.other',
               { rooms: l.rooms.join(', '), time: t.plural('scenes.minutesFor', l.minutes) }))
  }
  return out.join(' ')
}

// Whether the report deserves a warning rather than a plain note.
export function reportOk(report) {
  return Boolean(report?.set?.length) && !(report.failed?.length)
}

// An empty group on the system named, and an empty scene with one. A new group
// starts out leaving its rooms' levels alone; a volume is a thing to opt into.
export function blankGroup(householdId = '') {
  return { household: householdId, rooms: [], play: null, play_mode: null, keep_levels: true, sleep: null, delay: null }
}

export function blankScene(householdId = '') {
  return { id: '', name: '', groups: [blankGroup(householdId)], pause_others: false }
}
